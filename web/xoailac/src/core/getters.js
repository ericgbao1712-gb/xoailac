// Pure derived helpers for the UI/renderer (TECH_SPEC §5.3). Cheap enough to call every frame.
import * as C from '../config.js';
import {
  ING, POT, UP, xpNeed, tierDef, builtTables, builtStoves, khoInfo, buyPrice as baseBuyPrice, potPrice, masteryStars,
  ambienceOf, featureUnlocked, isPotUnlocked, isIngUnlocked, liquidateQuote, oldStock, isDrinkUnlocked, salaryTotal, staffSalary,
  sellPrice, priceBounds, portionCost, menuPriceDemand, SUPPLY, SUPPLIER, supplierUnlocked, supplierSells, supplierPrice, quoteOrder,
  supplyPrice, supplyUnitCost, suppliesWanted, isFresh, recipeMaxLevel, branchMaxLevel, perkFx,
} from './economy.js';
import { refuseChance } from './customers.js';
import { moodBand } from './workers.js';
import { owedTotal } from './staff.js';
import { staffSlots, roleUnlocked, roleCount, candidatesOf } from './staff.js';
import { trayStatus } from './kitchen.js';
import { mainQuestInfo, dailyTasks, loginInfo, v2QuestInfo, questXp } from './quests.js';
import { tierInfo, forecastInfo } from './day.js';
import { raining, exposed, needsTarp, ownsTarp, tarpOpen, weatherNow, nextShowerIn } from './rain.js';

// ───────────── level names for upgrades without a `levels` list ─────────────
const GENERIC_NAMES = {
  knife: ['Dao thường', 'Dao bén', 'Dao Nhật', 'Bộ dao gọt xoài', 'Dao chuyên nghiệp', 'Dao huyền thoại'],
  cooler: ['Chưa có', 'Tủ mát nhỏ', 'Tủ mát đôi', 'Tủ mát lớn'],
  speaker: ['Chưa có', 'Loa mini', 'Dàn loa'],
};

export function createGetters(G) {
  const s = G.state;
  const open = () => s.phase === 'open' || s.phase === 'closing';

  function level() {
    const need = xpNeed(s.level);
    return { level: s.level, xp: s.xp, need, pct: Math.min(100, (s.xp / need) * 100) };
  }
  const kho = () => khoInfo(G);
  /** Price per unit at today's market (buying is only possible before opening). */
  const buyPrice = (id) => baseBuyPrice(G, id);
  const availablePots = () => {
    const out = [];
    for (const p of C.HOTPOTS) {
      if (!s.menu[p.id] || !isPotUnlocked(G, p.id)) continue;
      let ok = true;
      for (const i of p.recipe) if ((s.inventory[i] || 0) < 1) { ok = false; break; }
      if (ok) out.push(p.id);
    }
    return out;
  };

  // ───────────── upgrades ─────────────
  function levelNames(up) {
    if (up.levels) return up.levels;
    if (GENERIC_NAMES[up.id]) return GENERIC_NAMES[up.id];
    return null;
  }
  function upgradeInfo(id) {
    const up = UP[id];
    if (!up) return { level: 0, max: 0, cost: null, canBuy: false, lockedReason: 'Không có nâng cấp này', levelName: '', nextLevelName: null };
    const t = tierDef(G);
    const level = s.upgrades[id] || 0;
    let max, cost = null, lockedReason = null, levelName, nextLevelName = null;
    if (up.perTier) {
      const start = t.startTables, cap = t.maxTables;
      max = cap - start;
      cost = level >= max ? null : C.upgradeCost(up, level, s.tier, level);
      const unit = 'ô quầy';
      levelName = `${start + level} ${unit}`;
      nextLevelName = level >= max ? null : `${start + level + 1} ${unit}`;
    } else if (id === 'tarp' && t.covered) {
      return { level: 1, max: 1, cost: null, canBuy: false, lockedReason: null, levelName: 'Có tán che', nextLevelName: null };
    } else {
      max = up.costs.length;
      cost = level >= max ? null : C.upgradeCost(up, level, s.tier, level);
      const names = levelNames(up);
      levelName = names ? names[Math.min(level, names.length - 1)] : level ? 'Đã có' : 'Chưa có';
      if (level < max) nextLevelName = names ? names[Math.min(level + 1, names.length - 1)] : max === 1 ? 'Đã có' : 'Cấp ' + (level + 1);
      if (cost != null && up.minTier && up.minTier[level] > s.tier) lockedReason = `Cần ${C.TIERS[up.minTier[level] - 1].name}`;
      if (cost != null && id === 'sidetable' && !featureUnlocked(G, 'sideUp')) lockedReason = `Cần Lv ${C.FEATURES.sideUp}`;
      if (cost != null && up.minLv && (up.minLv[level] || 1) > s.level) lockedReason = `Cần Lv ${up.minLv[level]}`;
    }
    return { level, max, cost, canBuy: cost != null && !lockedReason && s.money + 1e-9 >= cost, lockedReason, levelName, nextLevelName };
  }

  // ───────────── recipes ─────────────
  function recipeInfo(potId) {
    const p = POT[potId];
    if (!p) return null;
    const r = s.recipes[potId] || { lvl: 1, sold: 0 };
    const max = recipeMaxLevel(G);
    const cost = r.lvl >= max ? null : C.RECIPE.upgradeCost(p, r.lvl);
    const stars = masteryStars(G, potId);
    const nextMastery = C.RECIPE.masteryAt[stars] ?? null;
    return {
      id: potId, lvl: r.lvl, max, cost, canUpgrade: cost != null && s.money + 1e-9 >= cost && isPotUnlocked(G, potId),
      price: potPrice(G, potId), sold: r.sold, mastery: stars, nextMastery, unlocked: isPotUnlocked(G, potId), enabled: !!s.menu[potId],
      nextPrice: r.lvl >= max ? null : Math.round(p.price * (1 + r.lvl * C.RECIPE.pricePerLevel) * (1 + stars * C.RECIPE.masteryPriceBonus)),
    };
  }

  function candidates(role) {
    const out = [];
    for (const c of candidatesOf(G, role)) out.push(Object.assign({}, c, { salary: staffSalary(G, c), fee: staffSalary(G, c) * C.STAFF.hireFeeDays }));
    return out;
  }

  // ───────────── tray ─────────────
  function trayInfo() {
    const t = trayStatus(G);
    if (t) return t;
    return { ticket: null, need: [], drinks: { need: 0, done: 0 }, broth: { need: false, ready: false, readyStoveIdx: -1 }, canServe: false };
  }

  // ───────────── red dots ─────────────
  function decoBuyable(d) {
    return !d.default && !d.source && d.price > 0 && (d.minTier || 1) <= s.tier && !s.deco.owned.includes(d.id);
  }
  function dots() {
    // kho: something used by the menu is nearly out, or the supplier is bought but not switched on
    let kho = false;
    const used = new Set();
    for (const p of C.HOTPOTS) if (s.menu[p.id] && isPotUnlocked(G, p.id)) for (const i of p.recipe) used.add(i);
    for (const i of used) if (isIngUnlocked(G, i) && (s.inventory[i] || 0) < 5 && s.money >= baseBuyPrice(G, i) && khoInfo(G).used < khoInfo(G).cap) { kho = true; break; }
    // menu: recipe upgrade affordable or a new pot not yet looked at
    let menu = false;
    for (const p of C.HOTPOTS) {
      if (!isPotUnlocked(G, p.id)) continue;
      const r = s.recipes[p.id];
      if (r.lvl < recipeMaxLevel(G) && s.money >= C.RECIPE.upgradeCost(p, r.lvl)) menu = true;
      if (p.unlockLv > 1 && r.sold === 0 && !s.flags.seenUnlock['pot:' + p.id]) menu = true;
    }
    if (s.flags.ui && s.flags.ui.menuNudge && !s.flags.ui.menuNudgeSeen) menu = true;   // Má pointed the player here
    // upgrade
    let upgrade = false;
    for (const u of C.UPGRADES) if (upgradeInfo(u.id).canBuy) { upgrade = true; break; }
    // staff
    let staff = false;
    const sl = staffSlots(G);
    for (const role of Object.keys(C.STAFF.roles)) {
      if (!roleUnlocked(G, role)) continue;
      if (s.flags.seenUnlock['role:' + role]) continue;
      if (sl.used < sl.max && roleCount(G, role) < C.STAFF.roles[role].max && roleCount(G, role) === 0) {
        const cs = candidatesOf(G, role);
        if (cs.length && s.money >= staffSalary(G, cs[0]) * C.STAFF.hireFeeDays) { staff = true; break; }
      }
    }
    // shop
    let shop = !!s.quests.mainClaimable || !!s.quests.v2Claimable;
    if (!shop && featureUnlocked(G, 'daily')) for (const e of dailyTasks(G)) if (e.done && !e.claimed) { shop = true; break; }
    if (!shop && loginInfo(G).canClaim && s.started) shop = true;
    if (!shop) for (const r of s.reviews) if (r.stars >= 5 && !r.thanked) { shop = true; break; }
    if (!shop && featureUnlocked(G, 'deco')) for (const d of C.DECO) if (decoBuyable(d) && s.money >= d.price) { shop = true; break; }
    if (!shop && tierInfo(G).canExpand) shop = true;
    return { kho, menu, upgrade, staff, shop };
  }

  // ───────────── hint ─────────────
  function hint() {
    const w = G.world;
    if (open()) {
      const piles = w.coinPiles;
      // low stock of something the menu needs
      let low = null;
      for (const p of C.HOTPOTS) {
        if (!s.menu[p.id] || !isPotUnlocked(G, p.id)) continue;
        for (const i of p.recipe) if (isIngUnlocked(G, i) && (s.inventory[i] || 0) <= 2 && (!low || s.inventory[i] < s.inventory[low])) low = i;
      }
      const tray = trayStatus(G);
      if (tray && tray.ticket && !tray.canServe) {
        const miss = tray.need.find((n) => !n.done);
        if (miss) return `Còn thiếu ${ING[miss.ing].name.toLowerCase()} trong phần.`;
      }
      const wait = w.tickets.find((t) => t.status === 'new');
      if (wait) {
        const pot = POT[wait.pot];
        return `Có khách gọi ${pot.name.toLowerCase()} — chạm vào phiếu để soạn phần nha.`;
      }
      if (!availablePots().length) return 'Hết hàng rồi! Mở Kho nhập thêm, hoặc đóng cửa sớm nha.';
      if (low) return `Kho còn ${s.inventory[low]} phần ${ING[low].name.toLowerCase()} — mở Kho nhập thêm kẻo hết nha.`;
      return 'Quán ổn áp rồi, cứ giữ nhịp nha!';
    }
    if (s.phase === 'report') return 'Xem báo cáo rồi chuẩn bị cho ngày mới nha.';
    const ti = tierInfo(G);
    if (ti.canExpand) return `Đủ điều kiện rồi! Mở ${C.TIERS[ti.next - 1].name} thôi.`;
    for (const i of used3()) if ((s.inventory[i] || 0) < 5) return `Kho còn ${s.inventory[i] || 0} phần ${ING[i].name.toLowerCase()} — đi chợ thôi!`;
    if (s.weather === 'rain' && !tierDef(G).covered && s.upgrades.tarp === 0) return 'Hôm nay có mưa rào mà chưa có bạt che — khách ướt sẽ bỏ về đó nha!';
    return 'Sẵn sàng thì bấm MỞ HÀNG nha!';
  }
  function used3() {
    const set = new Set();
    for (const p of C.HOTPOTS) if (s.menu[p.id] && isPotUnlocked(G, p.id)) for (const i of p.recipe) if (isIngUnlocked(G, i)) set.add(i);
    return set;
  }

  // ───────────── v2: prices, supplies, suppliers, wages ─────────────
  /** Menu pricing row: reference, chosen price, cost, profit, bounds and how a typical guest reacts. */
  function priceInfo(potId) {
    const p = POT[potId];
    if (!p) return null;
    const ref = potPrice(G, potId), price = sellPrice(G, potId), cost = portionCost(G, potId), b = priceBounds(potId);
    // refuse chance averaged over the customer kinds of this tier, weighted like arrivals
    let wsum = 0, rsum = 0;
    for (const id of Object.keys(C.CUSTOMERS)) {
      const k = C.CUSTOMERS[id];
      if (!k.weight || k.minTier > s.tier) continue;
      const w = k.weight * ((k.prefers && k.prefers[potId]) ?? 0.5);
      wsum += w; rsum += w * refuseChance(G, id, potId);
    }
    const refuse = wsum ? rsum / wsum : 0;
    const ratio = price / Math.max(1, ref);
    return { id: potId, ref, price, custom: typeof s.prices[potId] === 'number', cost, profit: Math.round((price - cost) * 10) / 10, min: b.min, max: b.max, ratio, refuse,
      band: ratio < 0.9 ? 'cheap' : ratio > 1.12 ? 'pricey' : 'normal' };
  }
  function supplyInfo() {
    const want = suppliesWanted(G);
    return C.SUPPLIES.map((x) => {
      const used = (s.supplyUseYesterday && s.supplyUseYesterday[x.id]) || 0;
      const have = s.supplies[x.id] || 0;
      let incoming = 0;
      for (const o of s.orders) incoming += (o.items && o.items[x.id]) || 0;
      return { ...x, have, incoming, used, needed: !!want[x.id], avg: supplyUnitCost(G, x.id), price: supplyPrice(G, x.id, 1),
        low: !!want[x.id] && have < Math.max(10, used * 0.5), target: Math.max(30, Math.ceil(used * 1.3)) };
    });
  }
  function suppliers() {
    return C.SUPPLIERS.map((x) => ({ ...x, unlocked: supplierUnlocked(G, x.id), active: s.supplier === x.id,
      canNow: !(x.prepOnly && (s.phase === 'open' || s.phase === 'closing' || s.phase === 'report')) }));
  }
  function staffMood(m) {
    const band = moodBand(m);
    const lv = C.MOOD.levels.find((l) => l[2] === band);
    return { mood: Math.round(m.mood ?? C.MOOD.start), band, label: lv ? lv[1] : '', owed: m.owed || 0, owedDays: m.owedDays || 0,
      warned: m.quitWarnDay != null, leavesIn: m.quitWarnDay != null ? Math.max(0, C.MOOD.quitAfterDays - (s.day - m.quitWarnDay)) : null,
      talked: m.talkDay === s.day, bonused: m.bonusDay === s.day, bonusCost: Math.max(1, Math.round(staffSalary(G, m) * C.MOOD.bonus.mult)) };
  }

  return {
    priceInfo, supplyInfo, suppliers, staffMood,
    branchMax: () => branchMaxLevel(G), recipeMax: () => recipeMaxLevel(G), perks: () => perkFx(G),
    menuPriceDemand: () => menuPriceDemand(G),
    supplierPrice: (supId, id, qty) => supplierPrice(G, supId, id, qty),
    supplierSells: (supId, id) => !!SUPPLIER[supId] && supplierSells(SUPPLIER[supId], id),
    quoteOrder: (supId, items) => quoteOrder(G, supId, items),
    isFresh,
    wageDebt: () => owedTotal(G),
    sideTables: () => (G.world.side || []).length,
    level, kho, buyPrice,
    buyPriceBase: (id) => baseBuyPrice(G, id),
    potPrice: (id) => potPrice(G, id),
    ambience: () => ambienceOf(G),
    unlocked: (key) => featureUnlocked(G, key),
    isPotUnlocked: (id) => isPotUnlocked(G, id),
    isIngUnlocked: (id) => isIngUnlocked(G, id),
    liquidateQuote: (id, n) => liquidateQuote(G, id, n),   // v2.6 thanh lý
    oldStock: (id) => oldStock(G, id),
    isDrinkUnlocked: (id) => isDrinkUnlocked(G, id),
    availablePots, upgradeInfo, recipeInfo, candidates,
    tierInfo: () => tierInfo(G),
    staffSlots: () => staffSlots(G),
    salaryTotal: () => salaryTotal(G),
    mainQuest: () => mainQuestInfo(G),
    v2Quest: () => v2QuestInfo(G),
    dailyTasks: () => dailyTasks(G),
    loginInfo: () => loginInfo(G),
    dots, trayInfo, hint,
    forecastText: () => forecastInfo(G).text,
    tables: () => builtTables(G),
    stoves: () => builtStoves(G),
    weatherNow: () => weatherNow(G),
    questXp: (kind, base) => questXp(G, kind, base),   // v2.6.11
    rain: () => ({ raining: raining(G), exposed: exposed(G), needsTarp: needsTarp(G), owns: ownsTarp(G), tarp: tarpOpen(G), next: nextShowerIn(G) }),
  };
}
