// Money, XP/levels/unlocks, prices, market, stock, modifiers (TECH_SPEC §6.7, §6.11, §6.12).
import * as C from '../config.js';
import { clamp, round2 } from './util.js';
import { fmtMoney } from './format.js';
import { facadeAmb } from './looks.js';

export const ING = Object.fromEntries(C.INGREDIENTS.map((i) => [i.id, i]));
export const POT = Object.fromEntries(C.HOTPOTS.map((p) => [p.id, p]));
export const DRINK = Object.fromEntries(C.DRINKS.map((d) => [d.id, d]));
export const UP = Object.fromEntries(C.UPGRADES.map((u) => [u.id, u]));
export const DECO_BY_ID = Object.fromEntries(C.DECO.map((d) => [d.id, d]));
export const BRANCH_BY_ID = Object.fromEntries(C.BRANCHES.map((b) => [b.id, b]));
export const MARKETING_BY_ID = Object.fromEntries(C.MARKETING.map((m) => [m.id, m]));
export const SUPPLY = Object.fromEntries(C.SUPPLIES.map((x) => [x.id, x]));
export const SUPPLIER = Object.fromEntries(C.SUPPLIERS.map((x) => [x.id, x]));

export const FEATURE_NAMES = {
  deco: 'Trang trí quán', daily: 'Nhiệm vụ hằng ngày', reservations: 'Đặt bàn trước', mkt_reviewer: 'Mời Food Reviewer',
  mkt_livestream: 'Livestream bán hàng', speed2: 'Tốc độ ×2', speed3: 'Tốc độ ×3', manageMode: 'Chế độ Quản lý', extras: 'Khách gọi thêm', lottery: 'Vé số',
  pricing: 'Tự đặt giá bán', sideUp: 'Kê thêm bàn ghế', staffBonus: 'Thưởng nóng nhân viên', daily4: '4 nhiệm vụ mỗi ngày',
};

export const tierDef = (G) => C.TIERS[G.state.tier - 1];

// ───────────── level perks (C.PERKS) ─────────────
const PERK_NUM = { quality: 0, queue: 0, priceValue: 0, moodBase: 0, ambience: 0, recipeMax: 0, branchMax: 0, shelf: 0, satBonus: 0, comboDrink: 0 };
const PERK_MUL = { patience: 1, tip: 1, prepSpeed: 1, staffSpeed: 1, buyPrice: 1, boxCost: 1, eventChance: 1, staffXp: 1 };
/** Sum of every perk unlocked at the current level (cached per level). */
export function perkFx(G) {
  const lv = G.state.level;
  if (G._perk && G._perkLv === lv) return G._perk;
  const fx = Object.assign({}, PERK_NUM, PERK_MUL, { kindDemand: {}, goldenFrom: null });
  for (const p of C.PERKS) {
    if (lv < p.lv || !p.fx) continue;
    for (const k in p.fx) {
      const v = p.fx[k];
      if (k === 'kindDemand') { for (const kk in v) fx.kindDemand[kk] = (fx.kindDemand[kk] || 1) * v[kk]; }
      else if (k === 'goldenFrom') fx.goldenFrom = v;
      else if (k in PERK_MUL) fx[k] *= v;
      else fx[k] = (fx[k] || 0) + v;
    }
  }
  G._perk = fx; G._perkLv = lv;
  return fx;
}
export const recipeMaxLevel = (G) => C.RECIPE.maxLevel + perkFx(G).recipeMax;
export const branchMaxLevel = (G) => C.BRANCH.maxLevel + perkFx(G).branchMax;
export const nextTierDef = (G) => C.TIERS[G.state.tier] || null;
export const builtTables = (G) => { const t = tierDef(G); return Math.min(t.maxTables, t.startTables + G.state.upgrades.table); };
export const builtStoves = (G) => { const t = tierDef(G); return Math.min(t.maxStoves, t.startStoves + (G.state.upgrades.stove || 0)); };

// ───────────── money ─────────────
/** Add (or subtract, clamped at 0) money and emit the event. Returns the applied delta. */
export function addMoney(G, delta, reason = '', x, y) {
  const s = G.state;
  const before = s.money;
  s.money = Math.max(0, round2(s.money + delta));
  const applied = round2(s.money - before);
  if (applied !== 0) G.emit('money', { delta: applied, total: s.money, reason, x, y });
  return applied;
}
/** Record an operating cost in today's costs and take it out of the till (never below 0). */
export function spend(G, costKey, amount, reason = costKey) {
  if (!(amount > 0)) return 0;
  const today = G.state.today;
  const applied = -addMoney(G, -amount, reason); // clamped: money never goes below 0
  today.costs[costKey] = round2((today.costs[costKey] || 0) + applied);
  return applied;
}
/** Pay for a purchase; false (and no change) when the player cannot afford it. */
export function pay(G, amount, reason) {
  if (G.state.money + 1e-9 < amount) return false;
  addMoney(G, -amount, reason);
  return true;
}
export const cantAfford = (G, amount) => ({ ok: false, reason: 'money', msg: `Chưa đủ tiền (cần ${fmtMoney(amount)}) nha!` });

// ───────────── prices ─────────────
export function eventDef(G) { return C.EVENTS.find((e) => e.id === G.state.event) || null; }

export function buyPrice(G, ing) {
  const d = ING[ing];
  if (!d) return 0;
  let m = G.state.market.mult[ing] ?? 1;
  const ev = eventDef(G);
  if (ev && ev.priceMult && ev.priceMult[ing]) m *= ev.priceMult[ing];
  m *= G.state ? perkFx(G).buyPrice * mods(G).buyMult : 1;      // v2.6.9: Cân điện tử −4 %
  return Math.max(1, Math.round(d.cost * m * 2) / 2);
}
export function masteryStars(G, potId) {
  const sold = G.state.recipes[potId]?.sold || 0;
  let n = 0;
  for (const t of C.RECIPE.masteryAt) if (sold >= t) n++;
  return n;
}
export function potPrice(G, potId) {
  const p = POT[potId];
  if (!p) return 0;
  const lvl = G.state.recipes[potId]?.lvl || 1;
  return Math.round(p.price * (1 + (lvl - 1) * C.RECIPE.pricePerLevel) * (1 + masteryStars(G, potId) * C.RECIPE.masteryPriceBonus));
}
// ───────────── selling price (player-set) ─────────────
/** Allowed selling-price range for a dish (fixed multiples of its base price, so a stored price never needs moving). */
export function priceBounds(potId) {
  const p = POT[potId];
  if (!p) return { min: 1, max: 1 };
  return { min: Math.max(1, Math.round(p.price * C.PRICING.minMult)), max: Math.max(2, Math.round(p.price * C.PRICING.maxMult)) };
}
/** What the dish sells for right now: the player's price if set (clamped to the bounds), else the reference price. */
export function sellPrice(G, potId) {
  const v = G.state.prices && G.state.prices[potId];
  if (typeof v === 'number' && isFinite(v) && v > 0) { const b = priceBounds(potId); return clamp(Math.round(v), b.min, b.max); }
  return potPrice(G, potId);
}
/** price / reference for a dish (1 = reference). */
export const priceRatio = (G, potId) => sellPrice(G, potId) / Math.max(1, potPrice(G, potId));
/** Ingredient cost of one portion at today's chợ price (+ its container), for the menu's "giá vốn". */
export function portionCost(G, potId) {
  const p = POT[potId];
  if (!p) return 0;
  let c = 0;
  for (const i of p.recipe) c += buyPrice(G, i);
  const pk = C.DISH_PACK[potId];
  if (pk) { c += supplyUnitCost(G, pk.box); if (pk.tool) c += supplyUnitCost(G, pk.tool); }
  return round2(c);
}
/** Word of mouth: average price ratio of the dishes on the menu → arrivals multiplier. */
export function menuPriceDemand(G) {
  const s = G.state;
  let sum = 0, n = 0;
  for (const p of C.HOTPOTS) if (s.menu[p.id] && isPotUnlocked(G, p.id)) { sum += priceRatio(G, p.id); n++; }
  if (!n) return 1;
  const P = C.PRICING;
  return clamp(Math.pow(sum / n, -P.demandExp), P.demandMin, P.demandMax);
}

export function khoInfo(G) {
  const s = G.state;
  let used = 0;
  for (const k in s.inventory) used += s.inventory[k];
  let incoming = 0;
  for (const o of s.orders || []) for (const k in o.items || {}) if (ING[k]) incoming += o.items[k];
  const up = UP.kho;
  const cap = Math.round(tierDef(G).kho * (up.capMult[s.upgrades.kho] || 1));
  return { used, cap, incoming };
}

// ───────────── modifiers (cached, recomputed when dirty) ─────────────
export function mods(G) {
  if (G._mods && !G.modsDirty) return G._mods;
  const s = G.state, up = s.upgrades;
  const staff = s.staff;
  const has = (trait) => staff.some((m) => m.trait === trait);
  const count = (trait) => staff.filter((m) => m.trait === trait).length;
  let decoDemand = 1, decoTip = 1, decoPatience = 1, decoFootball = 1;
  for (const cat of Object.keys(s.deco.equipped)) {
    const d = DECO_BY_ID[s.deco.equipped[cat]];
    const e = d && d.effect;
    if (!e) continue;
    if (e.demandMult) decoDemand *= e.demandMult;
    if (e.tipMult) decoTip *= e.tipMult;
    if (e.patienceMult) decoPatience *= e.patienceMult;
    if (e.footballMult) decoFootball = e.footballMult;
  }
  const cashier = staff.some((m) => m.role === 'thungan');
  const waiter = staff.some((m) => m.role === 'phucvu');   // at the counter: hands the cups over, keeps the queue happy
  // v2.6.9 thiết bị mới (missing levels in old saves read as 0)
  const L = (id) => up[id] || 0;
  const master = 1 + L('master') * UP.master.per;
  const posTip = UP.pos.tipMult[Math.min(L('pos'), UP.pos.tipMult.length - 1)];
  G._mods = {
    patience: (1 + up.tablestyle * UP.tablestyle.patiencePer + up.speaker * UP.speaker.patiencePer + L('kiosk') * UP.kiosk.patiencePer + (L('pos') >= 2 ? UP.pos.patienceQr : 0))
      * (cashier ? 1.2 : 1) * (waiter ? 1.15 : 1) * (has('hat') ? 1.1 : 1) * decoPatience * perkFx(G).patience * master,
    tip: posTip * decoTip * (has('ngot') ? 1.25 : 1) * (waiter ? 1.15 : 1) * perkFx(G).tip * master,
    demand: (1 + up.sign * UP.sign.demandPer + L('packing') * UP.packing.demandPer) * decoDemand * Math.pow(1.05, count('tiktok')) * master,
    eqQuality: L('shaker') * UP.shaker.qualityPer + L('hygiene') * UP.hygiene.qualityPer + L('packing') * UP.packing.qualityPer,
    shakeZone: L('shaker') * UP.shaker.zonePer,
    buyMult: L('scale') ? UP.scale.buyMult : 1,
    drinkCostMult: Math.max(0.4, 1 - L('icemaker') * UP.icemaker.drinkCostPer - L('filter') * UP.filter.drinkCostPer),
    drinkChance: L('icemaker') * UP.icemaker.drinkChancePer + L('blender') * UP.blender.drinkChancePer + L('filter') * UP.filter.drinkChancePer,
    priceValue: L('menuscreen') ? UP.menuscreen.priceValue : 0,
    footballMult: decoFootball,
    cashier,
    hasWaiter: waiter,
    hasChef: staff.some((m) => m.role === 'daubep'),
    hasQuankho: staff.some((m) => m.role === 'quankho'),
  };
  G.modsDirty = false;
  return G._mods;
}
export function dirtyMods(G) { G.modsDirty = true; }

export function ambienceOf(G) {
  const s = G.state, up = s.upgrades;
  let a = 0;
  for (const cat of Object.keys(s.deco.equipped)) a += (DECO_BY_ID[s.deco.equipped[cat]] || {}).amb || 0;
  a += facadeAmb(s);                                   // v2.4: mặt tiền items count like deco
  a += up.tablestyle * UP.tablestyle.amb + up.cooling * UP.cooling.amb + up.speaker * UP.speaker.amb + up.sign * UP.sign.amb;
  return clamp(a / tierDef(G).ambCap + perkFx(G).ambience, 0, 1);
}

// ───────────── xp / levels / unlocks ─────────────
export const xpNeed = (lv) => C.LEVEL.xpToNext(lv);

/** Everything that becomes available exactly at `level`. */
export function unlocksAt(level) {
  const out = [];
  for (const p of C.HOTPOTS) if (p.unlockLv === level && level > 1) out.push({ type: 'pot', id: p.id, name: p.name });
  for (const i of C.INGREDIENTS) if (i.unlockLv === level && level > 1 && !i.broth && !i.side) out.push({ type: 'ingredient', id: i.id, name: i.name });
  for (const i of C.INGREDIENTS) if (i.side && !i.quest && i.unlockLv === level) out.push({ type: 'side', id: i.id, name: i.name, desc: `Món ăn kèm: thu thêm ${i.side}k mỗi phần, vốn ${i.cost}k, để được ${i.shelf} ngày.` });
  for (const d of C.DRINKS) if (d.unlockLv === level && level > 1) out.push({ type: 'drink', id: d.id, name: d.name });
  for (const r of Object.keys(C.STAFF.roles)) if (C.STAFF.roles[r].unlockLv === level) out.push({ type: 'role', id: r, name: C.STAFF.roles[r].name });
  for (const f of Object.keys(C.FEATURES)) if (C.FEATURES[f] === level && FEATURE_NAMES[f]) out.push({ type: 'feature', id: f, name: FEATURE_NAMES[f] });
  for (const t of C.TIERS) if (t.require && t.require.level === level) out.push({ type: 'tier', id: t.id, name: t.name });
  for (const x of C.SUPPLIERS) if (x.unlockLv === level && level > 1) out.push({ type: 'supplier', id: x.id, name: x.name });
  for (const m of C.MARKETING) if (m.hours || m.drinkChance || m.kinds) if (m.unlockLv === level) out.push({ type: 'marketing', id: m.id, name: m.name });
  for (const p of C.PERKS) if (p.lv === level && !p.marketing && !p.supplier) out.push({ type: 'perk', id: p.id, name: p.name, desc: p.desc });
  // v2.6.9: a piece of equipment (or its next level) that becomes buyable at this level
  for (const u of C.UPGRADES) (u.minLv || []).forEach((lv, i) => {
    if (lv !== level || level <= 1 || u.id === 'kho') return;                 // kho Lv 17 is the Kho lạnh perk card
    const nm = u.levels ? u.levels[i + 1] : u.name + (i ? ' cấp ' + (i + 1) : '');
    out.push({ type: 'equip', id: u.id, name: nm || u.name, desc: i ? `Mở mua cấp ${i + 1} trong Nâng cấp.` : u.desc });   // v2.6.24: no repeated long text per level
  });
  return out;
}

export function addXp(G, n, x, y) {
  const s = G.state;
  n = Math.round(n);
  if (!(n > 0)) return;
  s.xp += n;
  let leveled = 0;
  while (s.xp >= xpNeed(s.level)) {
    s.xp -= xpNeed(s.level);
    s.level++;
    leveled++;
    onLevel(G, s.level);
  }
  G.emit('xp', { delta: n, total: s.xp, level: s.level, need: xpNeed(s.level), x, y });
  return leveled;
}

/** v2.6.1: after the XP curve got easier, a loaded save may already hold enough XP for the next level(s).
 *  Grant them (with every unlock / mastery chest) without waiting for the next XP. Returns levels gained. */
export function settleXp(G) {
  const s = G.state;
  let up = 0;
  while (s.xp >= xpNeed(s.level) && up < 60) { s.xp -= xpNeed(s.level); s.level++; up++; onLevel(G, s.level); }
  return up;
}

function onLevel(G, level) {
  const s = G.state;
  const unlocks = unlocksAt(level);
  for (const u of unlocks) if (u.type === 'pot') s.menu[u.id] = true; // new pots go straight on the menu
  G.modsDirty = true;
  const mr = C.masteryReward(level);
  if (mr && mr.milestone) {
    // v2.6.24 mốc thành thạo (Lv 45, 50, 55…): a diamond chest (opened in the quest book) + a ★3+ hiring ticket.
    // The other mastery levels give their own perk (C.PERKS 'm_<lv>'), already in `unlocks`.
    s.diamondChests = (s.diamondChests || 0) + 1;
    s.staffTickets = (s.staffTickets || 0) + 1;
  } else if (level > C.MASTERY.namedTo) {
    // past the named levels: every level pays out a gold chest (+ a ★3+ hiring ticket every 5th level), as before
    unlocks.push({ type: 'mastery', id: 'mastery' + level, name: 'Rương thành thạo' + (level % C.MASTERY.ticketEvery === 0 ? ' + vé tuyển ★3+' : ''), desc: 'Sau Lv 100 mỗi cấp nhận 1 rương vàng (mở ở sổ nhiệm vụ)' + (level % C.MASTERY.ticketEvery === 0 ? '; cấp chia hết cho 5 tặng thêm vé tuyển nhân viên.' : '.') });
    s.masteryChests = (s.masteryChests || 0) + 1;
    if (level % C.MASTERY.ticketEvery === 0) s.staffTickets = (s.staffTickets || 0) + 1;
  }
  G.emit('levelUp', { level, unlocks });
  if (G.onLevelUp) G.onLevelUp(level, unlocks);
}

/** Set level directly (debug), firing level-up events for every step. */
export function setLevel(G, target) {
  const s = G.state;
  target = Math.max(1, Math.floor(target));
  if (target < s.level) { s.level = target; s.xp = 0; G.emit('xp', { delta: 0, total: 0, level: s.level, need: xpNeed(s.level) }); return; }
  while (s.level < target) { s.level++; onLevel(G, s.level); }
  s.xp = 0;
  G.emit('xp', { delta: 0, total: 0, level: s.level, need: xpNeed(s.level) });
}

export const isPotUnlocked = (G, id) => !!POT[id] && G.state.level >= POT[id].unlockLv;
export const isIngUnlocked = (G, id) => !!ING[id] && G.state.level >= ING[id].unlockLv && (!ING[id].quest || questClaimed(G, ING[id].quest));
/** v2.5: main quest `id` already claimed (the main-quest pointer is past it). */
export function questClaimed(G, id) {
  const i = C.MAIN_QUESTS.findIndex((q) => q.id === id);
  return i >= 0 && (G.state.quests.main || 0) > i;
}
/** v2.5 món ăn kèm (stocked like ingredients, flagged side). */
export const SIDES = C.INGREDIENTS.filter((i) => i.side);
export const isSideUnlocked = (G, id) => !!ING[id] && !!ING[id].side && isIngUnlocked(G, id);
export const isDrinkUnlocked = (G, id) => !!DRINK[id] && G.state.level >= DRINK[id].unlockLv && (!DRINK[id].needs || (G.state.upgrades[DRINK[id].needs] || 0) > 0);   // v2.6.9: Sinh tố needs the blender
export const featureUnlocked = (G, key) => (key in C.FEATURES ? G.state.level >= C.FEATURES[key] : true);

// ───────────── shelf life ─────────────
// state.inventory keeps the totals everything reads; state.lots[id] = [{ n, e }] splits them by expiry
// (e = last day the portions are usable). Used oldest-first; past-date lots are thrown out each morning.
export const shelfOf = (id) => (ING[id] && ING[id].shelf) || 5;
function lotsOf(s, id) {
  if (!s.lots || typeof s.lots !== 'object') s.lots = {};
  const L = s.lots[id];
  return Array.isArray(L) ? L : (s.lots[id] = []);
}
/** Last usable day for a portion that enters the kho right now (after closing it counts from tomorrow). */
const expDayNow = (s, id) => s.day + shelfOf(id) - 1 + (s.phase === 'report' ? 1 : 0);
// A lot may also remember what each portion cost (c, k) and its quality bonus (q) from the supplier. Old lots have
// neither: they cost today's chợ price when used and have quality 0.
function pushLot(s, id, n, e, c, q) {
  const L = lotsOf(s, id);
  const same = L.find((l) => l.e === e && l.c === c && (l.q || 0) === (q || 0));
  if (same) { same.n += n; return; }
  const lot = { n, e };
  if (c != null) lot.c = c;
  if (q) lot.q = q;
  L.push(lot);
  L.sort((a, b) => a.e - b.e);
}
/** Take n portions oldest-first. Returns { cost, known, q } — cost of the portions whose price is known (known = how many). */
function takeLots(s, id, n) {
  const L = lotsOf(s, id);
  let cost = 0, known = 0, qs = 0, taken = 0;
  while (n > 0 && L.length) {
    const k = Math.min(n, L[0].n);
    if (L[0].c != null) { cost += k * L[0].c; known += k; }
    qs += k * (L[0].q || 0); taken += k;
    L[0].n -= k; n -= k;
    if (L[0].n <= 0) L.shift();
  }
  return { cost, known, q: taken ? qs / taken : 0 };
}
// ───────────── v2.6 thanh lý hàng cũ ─────────────
const unitBasis = (s, id, lot) => (lot.c != null ? lot.c : (ING[id] ? ING[id].cost : 0) * (s.market.mult[id] ?? 1));
const liqRate = (s, lot) => C.LIQUIDATE.rates[clamp(lot.e - s.day, 0, C.LIQUIDATE.rates.length - 1)];
/** What Cô Ba would pay for the oldest n portions of `id` (n defaults to everything). */
export function liquidateQuote(G, id, n) {
  const s = G.state;
  if (!ING[id]) return { ok: false, n: 0, money: 0, basis: 0, groups: [] };
  const have = Math.max(0, Math.floor(s.inventory[id] || 0));
  if (n == null) n = have;
  n = Math.max(0, Math.min(Math.floor(n), have));
  const L = lotsOf(s, id);
  let left = n, money = 0, basis = 0;
  const groups = [];                                        // by days left: { left, n, unit, rate }
  for (const lot of L) {
    if (left <= 0) break;
    const k = Math.min(left, lot.n), b = unitBasis(s, id, lot), r = liqRate(s, lot), dl = Math.max(0, lot.e - s.day);
    money += k * b * r; basis += k * b; left -= k;
    const g = groups.find((x) => x.left === dl);
    if (g) { g.n += k; g.money += k * b * r; } else groups.push({ left: dl, n: k, rate: r, money: k * b * r });
  }
  return { ok: n > 0, n: n - left, money: round2(money), basis: round2(basis), groups };
}
/** Portions of `id` whose date runs out after today (the ones worth selling first). */
export function oldStock(G, id) {
  const s = G.state;
  let n = 0;
  for (const l of lotsOf(s, id)) if (l.e <= s.day) n += l.n;
  return n;
}
/** Sell the oldest n portions of `id` back to the market. Morning only. */
export function liquidate(G, id, n) {
  const s = G.state;
  if (!ING[id]) return { ok: false, reason: 'unknown', msg: 'Không có món hàng này.' };
  if (s.phase !== 'prep') return { ok: false, reason: 'phase', msg: `${C.LIQUIDATE.buyer} chỉ mua lại hàng buổi sáng, trước khi mở hàng nha.` };
  const q = liquidateQuote(G, id, n);
  if (!q.ok) return { ok: false, reason: 'empty', msg: 'Kho không còn món này để bán.' };
  takeLots(s, id, q.n);
  s.inventory[id] = Math.max(0, (s.inventory[id] || 0) - q.n);
  addMoney(G, q.money, 'liquidation');
  const loss = round2(Math.max(0, q.basis - q.money));
  s.today.costs.liquidation = round2((s.today.costs.liquidation || 0) + loss);
  G.counter('liquidated', q.n);
  if (s.inventory[id] <= 2 && G.world) resetStockWarn(G, id);
  return { ok: true, n: q.n, money: q.money, basis: q.basis, loss };
}

/** Put n portions into the kho (dated today). opts: { c: unit cost paid, q: quality bonus, shelfBonus: extra days } */
export function addStock(G, id, n, opts = {}) {
  if (!(n > 0)) return;
  const s = G.state;
  s.inventory[id] = (s.inventory[id] || 0) + n;
  pushLot(s, id, n, expDayNow(s, id) + (opts.shelfBonus || 0) + perkFx(G).shelf, opts.c, opts.q || 0);
}
/** Keep lots in step with the totals (old saves, gifts, debug edits). */
export function syncLots(G) {
  const s = G.state;
  for (const i of C.INGREDIENTS) {
    const have = Math.max(0, Math.floor(s.inventory[i.id] || 0)), L = lotsOf(s, i.id);
    let sum = 0;
    for (const l of L) sum += l.n;
    if (have > sum) pushLot(s, i.id, have - sum, expDayNow(s, i.id));
    else if (have < sum) takeLots(s, i.id, sum - have);
  }
}
/** Portions of `id` that are past their date after today (must be sold today). */
export function expiringToday(G, id) {
  const s = G.state;
  let n = 0;
  for (const l of lotsOf(s, id)) if (l.e <= s.day) n += l.n;
  return n;
}
/** Morning: throw out everything past its date. Returns { total, value, items: { id: n } }. */
export function expireStock(G) {
  const s = G.state, items = {};
  let total = 0, value = 0;
  for (const i of C.INGREDIENTS) {
    const L = lotsOf(s, i.id);
    let n = 0;
    let v = 0;
    while (L.length && L[0].e < s.day) { const l = L.shift(); n += l.n; v += l.n * (l.c != null ? l.c : i.cost); }
    if (n <= 0) continue;
    s.inventory[i.id] = Math.max(0, (s.inventory[i.id] || 0) - n);
    items[i.id] = n; total += n; value += v;
  }
  value = round2(value);
  s.expired = total ? { day: s.day, total, value, items } : null;
  if (total) G.emit('expired', s.expired);
  return { total, value, items };
}

// ───────────── stock ─────────────
/** Use n portions (oldest first). Cost = what those portions were bought for. Returns their quality bonus. */
export function consumeIngredient(G, ing, n = 1) {
  const s = G.state;
  const have = Math.min(n, s.inventory[ing] || 0);
  const tk = takeLots(s, ing, have);
  s.inventory[ing] = Math.max(0, (s.inventory[ing] || 0) - n);
  const cost = tk.cost + (ING[ing] ? ING[ing].cost : 0) * (s.market.mult[ing] ?? 1) * (n - tk.known);
  s.today.costs.ingredients = round2(s.today.costs.ingredients + cost);
  s.today.usage[ing] = (s.today.usage[ing] || 0) + n;
  if (s.inventory[ing] <= 2 && G.world) {
    const w = G.world;
    if (!w.lowWarned[ing]) {
      w.lowWarned[ing] = true;
      G.emit(s.inventory[ing] <= 0 ? 'stockOut' : 'stockLow', { ing });
    } else if (s.inventory[ing] <= 0 && !w.outWarned[ing]) {
      w.outWarned[ing] = true;
      G.emit('stockOut', { ing });
    }
  }
  return tk.q;
}
export function resetStockWarn(G, ing) {
  if (!G.world) return;
  if ((G.state.inventory[ing] || 0) > 2) { G.world.lowWarned[ing] = false; G.world.outWarned[ing] = false; }
}

export function buyIngredient(G, ing, qty) {
  const s = G.state, def = ING[ing];
  if (!def) return { ok: false, reason: 'unknown', msg: 'Không có nguyên liệu này.' };
  if (!isIngUnlocked(G, ing)) return { ok: false, reason: 'locked', msg: `${def.name} mở ở Lv ${def.unlockLv} nha!` };
  if (s.phase === 'report') return { ok: false, reason: 'closed', msg: 'Chợ đóng rồi, sáng mai nhập tiếp nha!' };
  if (s.phase === 'open' || s.phase === 'closing') return { ok: false, reason: 'open', msg: 'Đang bán không bỏ quầy đi chợ được — đặt hàng qua app hoặc nhà cung cấp nha!' };
  const price = buyPrice(G, ing);
  const { used, cap } = khoInfo(G);
  const free = cap - used;
  if (free <= 0) return { ok: false, reason: 'full', msg: 'Kho đầy rồi! Nâng cấp kho hoặc bán bớt nha.' };
  let n = qty === 'fill' ? free : Math.max(1, Math.floor(qty || 1));
  n = Math.min(n, free);
  const afford = Math.floor((s.money + 1e-9) / price);
  if (afford <= 0) return { ok: false, reason: 'money', msg: `Chưa đủ tiền mua ${def.name} (${fmtMoney(price)}/phần).` };
  const partial = n > afford;
  n = Math.min(n, afford);
  const cost = round2(n * price);
  addMoney(G, -cost, 'buy');
  addStock(G, ing, n, { c: price });
  G.counter('buyIngredients', 1);
  resetStockWarn(G, ing);
  if (G.world) G.world.soldOutDay = 0;          // restocked mid-day: the "hết hàng" prompt may show again later
  return { ok: true, bought: n, cost, price, partial };
}

/** Morning auto-restock (supplier upgrade or quản kho). fee = 0 for quản kho. */
export function autoRestock(G, byManager) {
  const s = G.state;
  const fee = 0;                                   // v2.6.20: only the quản kho restocks now, free of charge
  const { cap } = khoInfo(G);
  let used = khoInfo(G).used;
  // ingredients used by enabled pots
  const wanted = new Set();
  for (const p of C.HOTPOTS) if (s.menu[p.id] && isPotUnlocked(G, p.id)) for (const i of p.recipe) wanted.add(i);
  const rows = [];
  for (const id of wanted) {
    if (!isIngUnlocked(G, id)) continue;
    const target = Math.min(cap, Math.max(8, Math.ceil((s.usageYesterday[id] || 0) * (s.soldOutYesterday ? C.MARKET.soldOutTargetMult : C.MARKET.autoBuyTargetMult))));
    const need = target - (s.inventory[id] || 0);
    if (need > 0) rows.push({ id, need, ratio: (s.inventory[id] || 0) / target });
  }
  // v2.5.2 món ăn kèm: keep about yesterday's sales (+20 %), at least 4 of each unlocked one
  for (const sd of SIDES) {
    if (!isIngUnlocked(G, sd.id)) continue;
    const target = Math.min(cap, Math.max(C.QUANKHO.sideMin, Math.ceil((s.usageYesterday[sd.id] || 0) * 1.2)));
    const need = target - (s.inventory[sd.id] || 0);
    if (need > 0) rows.push({ id: sd.id, need, ratio: (s.inventory[sd.id] || 0) / target + 0.5 });   // after the dish ingredients
  }
  rows.sort((a, b) => a.ratio - b.ratio);
  let spent = 0, bought = 0;
  for (const r of rows) {
    const price = buyPrice(G, r.id) * (1 + fee);
    let n = Math.min(r.need, cap - used, Math.floor((s.money + 1e-9) / price));
    if (n <= 0) continue;
    const cost = round2(n * price);
    addMoney(G, -cost, 'restock');
    s.today.costs.ingredients = round2(s.today.costs.ingredients + n * buyPrice(G, r.id) * fee);
    addStock(G, r.id, n, { c: buyPrice(G, r.id) });
    used += n; spent += cost; bought += n;
    resetStockWarn(G, r.id);
  }
  // supplies: keep a day's worth (at least 30 of each container / cup the menu needs)
  const want = suppliesWanted(G);
  for (const id in want) {
    const target = Math.max(30, Math.ceil((s.supplyUseYesterday && s.supplyUseYesterday[id] || 0) * 1.3));
    const need = target - (s.supplies[id] || 0);
    if (need <= 0) continue;
    const price = supplyPrice(G, id, need) * (1 + fee);
    const n = Math.min(need, Math.floor((s.money + 1e-9) / price));
    if (n <= 0) continue;
    const cost = round2(n * price);
    addMoney(G, -cost, 'restock');
    addSupply(G, id, n, supplyPrice(G, id, need));
    spent += cost; bought += n;
  }
  if (bought > 0) G.toast(`Đã nhập ${bought} món hàng tự động (−${fmtMoney(spent)})`, 'info', 'ui_kho');
  return { bought, spent };
}

// ───────────── market (daily random walk) ─────────────
export function rollMarket(G) {
  const s = G.state, rng = G.rng;
  const M = C.MARKET;
  for (const i of C.INGREDIENTS) {
    if (i.side) { s.market.mult[i.id] = 1; s.market.trend[i.id] = 0; continue; }   // món ăn kèm: fixed price (and no extra RNG draws)
    const old = s.market.mult[i.id] ?? 1;
    const nv = clamp(old + rng.gauss() * M.dailyVol - M.meanRevert * (old - 1), M.min, M.max);
    s.market.mult[i.id] = Math.round(nv * 1000) / 1000;
    const d = nv - old;
    s.market.trend[i.id] = d > 0.02 ? 1 : d < -0.02 ? -1 : 0;
  }
}

// ───────────── staff pay ─────────────
export function staffSalary(G, m, tier = G.state.tier) {
  let sal = C.STAFF.salary(m, tier) * Math.pow(1 + C.STAFF.levelSalaryUp, (m.lvl || 1) - 1);
  if (m.trait === 'vung') sal *= 0.7;
  return Math.max(1, Math.round(sal));
}
export function salaryTotal(G) { let t = 0; for (const m of G.state.staff) t += staffSalary(G, m); return t; }

// ───────────── supplies (vật tư) ─────────────
/** Unit price at the chợ for a pack of `qty` (bulk discount from SUPPLY_PACKS). */
export function supplyPrice(G, id, qty = 1) {
  const d = SUPPLY[id];
  if (!d) return 0;
  let off = 0;
  for (const p of C.SUPPLY_PACKS) if (qty >= p.n) off = p.off;
  const box = d.need === 'container' ? perkFx(G).boxCost : 1;            // Ly in logo quán: cups/boxes cost more
  return Math.round(d.cost * (1 - off) * perkFx(G).buyPrice * box * 100) / 100;
}
/** Average price paid for what is on the shelf (falls back to the list price). */
export function supplyUnitCost(G, id) {
  const a = G.state.supplyAvg && G.state.supplyAvg[id];
  return typeof a === 'number' && a > 0 ? a : (SUPPLY[id] ? SUPPLY[id].cost : 0);
}
export function addSupply(G, id, n, unitCost) {
  if (!(n > 0) || !SUPPLY[id]) return;
  const s = G.state;
  const have = Math.max(0, s.supplies[id] || 0);
  const avg = supplyUnitCost(G, id);
  s.supplies[id] = have + n;
  s.supplyAvg[id] = Math.round(((have * avg + n * (unitCost != null ? unitCost : SUPPLY[id].cost)) / (have + n)) * 1000) / 1000;
  if (G.world && G.world.supplyWarned) G.world.supplyWarned[id] = false;
}
/** Use one (or n) of a supply. Returns how many were actually there. Cost goes into today's "Vật tư". */
export function useSupply(G, id, n = 1) {
  const s = G.state;
  const have = Math.max(0, s.supplies[id] || 0);
  const k = Math.min(have, n);
  if (k > 0) {
    s.supplies[id] = have - k;
    s.today.costs.supplies = round2((s.today.costs.supplies || 0) + k * supplyUnitCost(G, id));
    s.today.supplyUse[id] = (s.today.supplyUse[id] || 0) + k;
  }
  if (k < n) {
    s.today.supplyMiss[id] = (s.today.supplyMiss[id] || 0) + (n - k);
    warnSupply(G, id, true);
  } else if (s.supplies[id] <= 5) warnSupply(G, id, false);
  return k;
}
function warnSupply(G, id, out) {
  const w = G.world;
  if (!w) return;
  if (!w.supplyWarned) w.supplyWarned = {};
  const key = id + (out ? ':out' : ':low');
  if (w.supplyWarned[key]) return;
  w.supplyWarned[key] = true;
  G.emit(out ? 'supplyOut' : 'supplyLow', { id });
}
/** Supplies the current menu needs (containers + utensils of enabled dishes, drink cups, bags, napkins). */
export function suppliesWanted(G) {
  const s = G.state, out = { ly_nuoc: 1, tui: 1, khan: 1 };
  for (const p of C.HOTPOTS) {
    if (!s.menu[p.id] || !isPotUnlocked(G, p.id)) continue;
    const pk = C.DISH_PACK[p.id];
    if (pk) { out[pk.box] = 1; if (pk.tool) out[pk.tool] = 1; }
  }
  return out;
}
/** Chợ: buy supplies on the spot (before opening). */
export function buySupply(G, id, qty) {
  const s = G.state, d = SUPPLY[id];
  if (!d) return { ok: false, reason: 'unknown', msg: 'Không có vật tư này.' };
  if (s.phase === 'report') return { ok: false, reason: 'closed', msg: 'Chợ đóng rồi, sáng mai mua tiếp nha!' };
  if (s.phase === 'open' || s.phase === 'closing') return { ok: false, reason: 'open', msg: 'Đang bán không bỏ quầy đi chợ được — đặt qua app nha!' };
  let n = Math.max(1, Math.floor(qty || 1));
  const price = supplyPrice(G, id, n);
  const afford = Math.floor((s.money + 1e-9) / price);
  if (afford <= 0) return { ok: false, reason: 'money', msg: `Chưa đủ tiền mua ${d.name.toLowerCase()} nha.` };
  const partial = n > afford;
  n = Math.min(n, afford);
  const cost = round2(n * price);
  addMoney(G, -cost, 'buy');
  addSupply(G, id, n, price);
  G.counter('buySupplies', 1);
  G.counter('supplyBought:' + id, n);
  if (G.world) G.world.soldOutDay = 0;
  return { ok: true, bought: n, cost, price, partial };
}

// ───────────── suppliers & deliveries ─────────────
export const isFresh = (id) => !!ING[id] && !ING[id].side && (ING[id].shelf || 5) <= 2;
export const supplierUnlocked = (G, id) => !!SUPPLIER[id] && G.state.level >= SUPPLIER[id].unlockLv;
export function supplierSells(sup, id) {
  if (SUPPLY[id]) return sup.sells === 'all';
  if (!ING[id]) return false;
  return sup.sells === 'all' || (sup.sells === 'fresh' && isFresh(id));
}
/** Unit price at a supplier (market × supplier multiplier; supplies get the pack discount of the ordered qty). */
export function supplierPrice(G, supId, id, qty = 1) {
  const sup = SUPPLIER[supId];
  if (!sup) return 0;
  const base = ING[id] ? buyPrice(G, id) : supplyPrice(G, id, qty);
  return Math.round(base * sup.priceMult * 100) / 100;
}
const absMin = (s) => s.day * 1440 + s.clock;
/** When an order placed now arrives: { at (absolute minutes), label } */
/** Minutes a supplier needs before / during selling (v2.6.3: never more than C.DELIVERY_MAX). */
export const openDelayOf = (sup) => Math.min(C.DELIVERY_MAX, sup.openDelay != null ? sup.openDelay : (sup.delay === 'morning' ? C.DELIVERY_MAX : sup.delay || 0));
export function arrivalOf(G, sup) {
  const s = G.state;
  if (s.phase === 'report') {                 // after closing: the morning, as before
    if (sup.delay === 'morning') return { at: (s.day + 1) * 1440 + C.TIME.dayStart, label: 'sáng mai' };
    // v2.6.20: same wait as an order placed in the morning prep (it used to be the long night `delay`,
    // so ordering the night before arrived LATER than ordering at 10:00 the next day).
    const d = openDelayOf(sup);
    return { at: (s.day + 1) * 1440 + C.TIME.dayStart + d, label: `sáng mai ${Math.floor((C.TIME.dayStart + d) / 60)}:${String((C.TIME.dayStart + d) % 60).padStart(2, '0')}` };
  }
  const d = openDelayOf(sup);
  return { at: absMin(s) + d, label: d > 0 ? (s.phase === 'prep' ? `${d} phút sau khi mở hàng` : `trong ${d} phút`) : 'ngay' };
}
/** Quote an order (no side effects). items = { id: qty }. */
export function quoteOrder(G, supId, items) {
  const s = G.state, sup = SUPPLIER[supId];
  if (!sup) return { ok: false, reason: 'unknown', msg: 'Không có nhà cung cấp này.' };
  if (!supplierUnlocked(G, supId)) return { ok: false, reason: 'locked', msg: `${sup.name} mở ở Lv ${sup.unlockLv} nha!` };
  const lines = [];
  let total = 0, ingN = 0;
  for (const id of Object.keys(items || {})) {
    const n = Math.floor(items[id] || 0);
    if (n <= 0) continue;
    if (!supplierSells(sup, id)) return { ok: false, reason: 'sells', msg: `${sup.name} không bán ${(ING[id] || SUPPLY[id] || { name: id }).name.toLowerCase()}.` };
    if (ING[id] && !isIngUnlocked(G, id)) return { ok: false, reason: 'locked', msg: `${ING[id].name} mở ở Lv ${ING[id].unlockLv} nha!` };
    const unit = supplierPrice(G, supId, id, n);
    lines.push({ id, n, unit, cost: round2(unit * n) });
    total += unit * n;
    if (ING[id]) ingN += n;
  }
  if (!lines.length) return { ok: false, reason: 'empty', msg: 'Chưa chọn món nào để đặt nha.' };
  total = round2(total);
  const fee = sup.fee || 0;
  const k = khoInfo(G);
  const free = k.cap - k.used - k.incoming;
  return { ok: true, sup, lines, subtotal: total, fee, total: round2(total + fee), ingN, kFree: free, arrive: arrivalOf(G, sup) };
}
/** Place (and pay for) an order. Instant suppliers deliver at once; others arrive later (state.orders). */
/**
 * v2.5.2: while the shop is open the quản kho watches the stock. When an ingredient of a dish on the menu, an
 * unlocked side or a cup / box the menu needs runs low, they run to the market themselves: market price, no
 * delivery fee, back after C.QUANKHO.minutes. One run at a time; paid from the till when they leave.
 * Returns the order, or null when nothing was needed / possible.
 */
export function quankhoRun(G, dtMin) {
  const s = G.state, w = G.world, Q = C.QUANKHO;
  if (!(s.phase === 'open' || s.phase === 'closing') || !mods(G).hasQuankho || !w) return null;
  w.qkT = (w.qkT || 0) - dtMin;
  if (w.qkT > 0) return null;
  w.qkT = Q.checkEvery;
  if ((s.orders || []).some((o) => o.sup === 'quankho')) return null;      // already out buying
  if (s.phase === 'closing' || s.clock > C.TIME.dayEnd - Q.minutes - 10) return null;   // too late to be worth it
  const want = new Set();
  for (const p of C.HOTPOTS) if (s.menu[p.id] && isPotUnlocked(G, p.id)) for (const i of p.recipe) if (isIngUnlocked(G, i)) want.add(i);
  for (const sd of SIDES) if (isIngUnlocked(G, sd.id) && (s.today.usage[sd.id] || s.usageYesterday[sd.id])) want.add(sd.id);
  const k = khoInfo(G);
  let free = k.cap - k.used - k.incoming, money = s.money - Q.keepMoney;
  const items = {}, unit = {};
  let total = 0, names = [];
  const low = [...want].filter((id) => (s.inventory[id] || 0) <= Q.lowAt).sort((a, b) => (s.inventory[a] || 0) - (s.inventory[b] || 0));
  for (const id of low) {
    const price = buyPrice(G, id);
    let n = Math.max(Q.minBuy, Math.ceil((s.today.usage[id] || 0) * Q.usageShare));
    n = Math.min(n, free, Math.floor((money - total + 1e-9) / price));
    if (n <= 0) continue;
    items[id] = n; unit[id] = price; total += n * price; free -= n; names.push(ING[id].name.toLowerCase());
  }
  const sw = suppliesWanted(G);
  for (const id in sw) {
    if ((s.supplies[id] || 0) > Q.supplyLowAt) continue;
    const n = Q.supplyBuy, price = supplyPrice(G, id, n);
    if (money - total < n * price) continue;
    items[id] = n; unit[id] = price; total += n * price; names.push(SUPPLY[id].name.toLowerCase());
  }
  if (!names.length) return null;
  total = round2(total);
  addMoney(G, -total, 'order');
  const order = { id: s.nextOrderId++, sup: 'quankho', label: 'Quản kho đi chợ', items, unit, total, fee: 0, at: absMin(s) + Q.minutes, placedDay: s.day, placedClock: Math.round(s.clock) };
  G.counter('buyIngredients', 1);
  const what = `${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
  if (Q.minutes > 0) {
    s.orders.push(order);
    G.emit('orderPlaced', { order });
    G.toast(`Sắp hết ${what}: Quản kho chạy đi chợ mua thêm (−${fmtMoney(total)}), ~${Q.minutes} phút về.`, 'info', 'role_quankho');
  } else {                                     // v2.6.3: the market is next door, back right away
    receiveOrder(G, order, true);
    G.emit('orderArrived', { order });
    G.toast(`Sắp hết ${what}: Quản kho chạy ra chợ mua về liền (−${fmtMoney(total)}).`, 'good', 'role_quankho');
  }
  return order;
}

export function placeOrder(G, supId, items) {
  const s = G.state;
  const q = quoteOrder(G, supId, items);
  if (!q.ok) return q;
  const sup = q.sup;
  if (sup.prepOnly && (s.phase === 'open' || s.phase === 'closing')) return { ok: false, reason: 'open', msg: `Đang bán không bỏ quầy đi chợ được — chọn nhà cung cấp giao tận nơi nha.` };
  if (s.phase === 'report' && sup.prepOnly) return { ok: false, reason: 'closed', msg: 'Chợ đóng rồi, sáng mai đi tiếp nha!' };
  if (sup.minOrder && q.subtotal + 1e-9 < sup.minOrder) return { ok: false, reason: 'min', msg: `${sup.name} nhận đơn từ ${fmtMoney(sup.minOrder)} trở lên nha.` };
  if (q.ingN > q.kFree) return { ok: false, reason: 'full', msg: q.kFree <= 0 ? 'Kho đầy rồi (tính cả hàng đang giao)! Nâng cấp kho hoặc bán bớt nha.' : `Kho chỉ còn chỗ cho ${q.kFree} phần (tính cả hàng đang giao).` };
  if (s.money + 1e-9 < q.total) return { ok: false, reason: 'money', msg: `Đơn này cần ${fmtMoney(q.total)} nha.` };
  addMoney(G, -q.total, 'order');
  if (q.fee > 0) s.today.costs.supplies = round2((s.today.costs.supplies || 0) + q.fee);   // ship fee is a cost of the day
  const order = { id: s.nextOrderId++, sup: sup.id, items: {}, unit: {}, total: q.total, fee: q.fee, at: q.arrive.at, placedDay: s.day, placedClock: Math.round(s.clock) };
  for (const l of q.lines) { order.items[l.id] = l.n; order.unit[l.id] = l.unit; if (SUPPLY[l.id]) G.counter('supplyBought:' + l.id, l.n); }
  G.counter('buyIngredients', 1);
  G.counter('order:' + sup.id, 1);
  if (q.arrive.at <= absMin(G.state) + 1e-6) { receiveOrder(G, order, true); return { ok: true, order, delivered: true, cost: q.total }; }
  s.orders.push(order);
  G.emit('orderPlaced', { order });
  return { ok: true, order, delivered: false, cost: q.total };
}
function receiveOrder(G, o, quiet) {
  const sup = SUPPLIER[o.sup] || SUPPLIER.cho;
  let n = 0;
  for (const id of Object.keys(o.items)) {
    const k = o.items[id];
    if (ING[id]) { addStock(G, id, k, { c: o.unit[id], q: sup.quality || 0, shelfBonus: isFresh(id) ? sup.shelfBonus || 0 : 0 }); resetStockWarn(G, id); }
    else addSupply(G, id, k, o.unit[id]);
    n += k;
  }
  if (G.world) G.world.soldOutDay = 0;
  if (!quiet) { G.emit('orderArrived', { order: o }); G.toast(o.sup === 'quankho' ? `Quản kho mua về ${n} món hàng rồi!` : `${sup.name} giao tới ${n} món hàng!`, 'good', o.sup === 'quankho' ? 'role_quankho' : sup.icon); }
}
/** Deliver every order whose time has come (called each sim step and at day changes). */
export function deliverOrders(G) {
  const s = G.state;
  if (!s.orders || !s.orders.length) return 0;
  const now = absMin(s);
  let done = 0;
  for (let i = 0; i < s.orders.length; i++) {
    const o = s.orders[i];
    if (now + 1e-6 < o.at) continue;
    s.orders.splice(i--, 1);
    receiveOrder(G, o, false);
    done++;
  }
  return done;
}
