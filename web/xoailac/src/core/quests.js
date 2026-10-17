// Main quests, daily tasks, chests, login streak, reviews (TECH_SPEC §6.13).
import * as C from '../config.js';
import { clamp, dateKey, prevDateKey } from './util.js';
import { shownFacade } from './looks.js';
import { addMoney, addXp, addStock, featureUnlocked, isPotUnlocked, isIngUnlocked, khoInfo, DECO_BY_ID } from './economy.js';

const fail = (reason, msg) => ({ ok: false, reason, msg });
const DAILY_BY_ID = Object.fromEntries(C.DAILY_POOL.map((d) => [d.id, d]));
const noAngryTarget = () => 18 * 60 - C.TIME.dayStart;

// ───────────── counters ─────────────
export function counter(G, name, n = 1) {
  const c = G.state.quests.counters;
  c[name] = (c[name] || 0) + n;
}

// ───────────── main quests ─────────────
function decoCount(G) {
  const s = G.state;
  let n = 0;
  for (const cat of C.DECO_CATS) {
    const id = s.deco.equipped[cat.id], d = DECO_BY_ID[id];
    if (d && !d.default) n++;
  }
  const f = shownFacade(s);                         // v2.4: cờ, chậu hoa, bảng hiệu, bóng bay count too
  for (const cat of C.FACADE.cats) if (f[cat.id] !== C.FACADE.def[cat.id]) n++;
  return n;
}
function liveProfit(G) {
  const t = G.state.today;
  let c = 0;
  for (const k in t.costs) c += t.costs[k];
  return t.revenue + t.tips + t.lotteryWon - c;
}

export function mainProgress(G, q) {
  const s = G.state, t = q.type;
  switch (t) {
    case 'potsSold': return s.stats.potsSold;
    case 'served': return s.stats.served;
    case 'fiveStars': return s.stats.fiveStars;
    case 'extrasServed': return s.stats.extrasServed;
    case 'level': return s.level;
    case 'tier': return s.tier;
    case 'staffCount': return s.staff.length;
    case 'rating': return s.rating.avg;
    case 'decoEquipped': return decoCount(G);
    case 'recipeLevel': { let m = 1; for (const k in s.recipes) m = Math.max(m, s.recipes[k].lvl); return m; }
    case 'branches': { let n = 0; for (const k in s.branches) if (s.branches[k] > 0) n++; return n; }
    case 'kindsMet': { let n = 0; for (const k in s.book.kinds) if (s.book.kinds[k] > 0) n++; return n; }
    case 'dayProfit': return Math.max(s.stats.bestDayProfit, liveProfit(G));
    case 'dayRevenue': return Math.max(s.stats.bestDayRevenue, s.today.revenue);
    case 'combo': return s.combo.best;
    case 'seatedTotal': return s.stats.seated || 0;
    case 'packsUsed': return s.stats.packsUsed || 0;
    case 'drinksSoldTotal': return s.stats.drinksSold || 0;
    case 'sidesSoldTotal': return s.stats.sidesSold || 0;
    case 'recipesAt6': { let n = 0; for (const k in s.recipes) if (s.recipes[k].lvl >= 6) n++; return n; }
    case 'sideTables': return C.SIDE.base + (s.upgrades.sidetable || 0);
    case 'noDebtStreak': return s.quests.counters.noDebtBest || 0;
    default:
      if (t.startsWith('potsSoldOf:')) return s.stats.potsSoldOf[t.slice(11)] || 0;
      // v2.6.7: a 'hire' quest also counts the staff of that role already on the team (old saves, restores)
      if (t.startsWith('hire:')) return Math.max(s.quests.counters[t] || 0, (s.staff || []).filter((m) => m.role === t.slice(5)).length);
      // v2.6.8: same for upgrades: what is already built counts
      if (t.startsWith('upgrade:')) {
        const id = t.slice(8);
        // from the 2nd shop on the tarp cannot be bought (tán cây / mái che): the Nâng cấp tab shows it as owned, so
        // the quest counts it as done instead of staying at 0/1 forever
        const covered = id === 'tarp' && (C.TIERS[(s.tier || 1) - 1] || {}).covered ? 1 : 0;
        return Math.max(s.quests.counters[t] || 0, (s.upgrades || {})[id] || 0, covered);
      }
      if (t === 'staffHired') return Math.max(s.quests.counters[t] || 0, (s.staff || []).length);
      return s.quests.counters[t] || 0;
  }
}
export function mainDone(G, q, progress) {
  if (progress < q.target - 1e-9) return false;
  if (q.type === 'rating' && q.minReviews && G.state.rating.count < q.minReviews) return false;
  return true;
}
export function mainQuestInfo(G) {
  const s = G.state, q = C.MAIN_QUESTS[s.quests.main] || null;
  if (!q) return { quest: null, progress: 0, target: 1, done: false, claimable: false, index: s.quests.main, total: C.MAIN_QUESTS.length };
  const p = mainProgress(G, q);
  const done = s.quests.mainClaimable || mainDone(G, q, p);
  return { quest: q, progress: Math.min(p, q.target), target: q.target, done, claimable: s.quests.mainClaimable, index: s.quests.main, total: C.MAIN_QUESTS.length,
    minReviews: q.minReviews || 0, reviews: s.rating.count };
}

// ───────────── daily tasks ─────────────
export function rollDaily(G) {
  const s = G.state, d = s.quests.daily;
  d.day = s.day; d.allClaimed = false; d.list = [];
  if (!featureUnlocked(G, 'daily')) return;
  const pool = C.DAILY_POOL.filter((p) => (p.minLv || 1) <= s.level);
  const picks = G.rng.shuffle(pool.slice()).slice(0, dailyCount(G));
  d.list = picks.map((p) => ({ id: p.id, target: p.type === 'noAngryUntil' ? noAngryTarget() : p.target(s.tier), progress: 0, claimed: false, notified: false }));
}
export const dailyCount = (G) => (featureUnlocked(G, 'daily4') ? 4 : 3);
export function ensureDaily(G) {
  const s = G.state, d = s.quests.daily;
  if (d.day !== s.day || (!d.list.length && featureUnlocked(G, 'daily'))) rollDaily(G);
}
function dailyProgress(G, e) {
  const def = DAILY_BY_ID[e.id];
  if (!def) return 0;
  const t = G.state.today, s = G.state;
  switch (def.type) {
    case 'served': return t.served;
    case 'fiveStars': return t.fiveStars;
    case 'drinksSold': return t.drinksSold;
    case 'sidesSold': return t.sidesSold || 0;
    case 'combo': return t.comboMax;
    case 'extrasServed': return t.extrasServed;
    case 'dayRevenue': return t.revenue;
    case 'thank': return t.thanked;
    case 'seated': return t.seated || 0;
    case 'tips': return t.tips;
    case 'dayProfit': return Math.max(0, liveProfit(G));
    case 'noSupplyMiss': {
      let miss = 0;
      for (const k in t.supplyMiss || {}) miss += t.supplyMiss[k];
      return s.phase === 'report' && t.served > 0 && miss === 0 ? 1 : 0;   // judged at closing
    }
    case 'servedNoPrice': return t.priceLost > 0 ? 0 : t.served;
    case 'noAngryUntil': {
      if (t.noAngryUntil != null && t.noAngryUntil < 18 * 60) return 0; // failed
      if (s.phase === 'prep' && s.clock <= C.TIME.dayStart) return 0;
      return clamp(s.clock - C.TIME.dayStart, 0, e.target);
    }
    default:
      if (def.type.startsWith('potsSoldOf:')) return t.potsSoldOf[def.type.slice(11)] || 0;
      return 0;
  }
}
export function dailyTasks(G) {
  ensureDaily(G);
  const list = G.state.quests.daily.list;
  return list.map((e) => {
    const def = DAILY_BY_ID[e.id] || {};
    const progress = Math.min(e.target, dailyProgress(G, e));
    const t = G.state.today;
    let miss = 0; for (const k in t.supplyMiss || {}) miss += t.supplyMiss[k];
    const failed = (def.type === 'noAngryUntil' && t.noAngryUntil != null && t.noAngryUntil < 18 * 60)
      || (def.type === 'servedNoPrice' && t.priceLost > 0) || (def.type === 'noSupplyMiss' && miss > 0);
    return Object.assign(e, { progress, text: (def.text || e.id).replace('{n}', e.target), chest: def.chest || 'wood', done: progress >= e.target, failed });
  });
}

/** Cheap periodic check: marks claimable quests and fires questReady once. */
export function updateQuests(G) {
  const s = G.state;
  if (!s.started) return;
  const q = C.MAIN_QUESTS[s.quests.main];
  if (q && !s.quests.mainClaimable && mainDone(G, q, mainProgress(G, q))) {
    s.quests.mainClaimable = true;
    G.emit('questReady', { kind: 'main', quest: q });
  }
  for (const e of dailyTasks(G)) {
    if (e.done && !e.notified && !e.claimed) { e.notified = true; G.emit('questReady', { kind: 'daily', quest: e }); }
  }
  const v = C.V2_QUESTS[s.quests.v2];
  if (v && !s.quests.v2Claimable && s.level >= (v.minLv || 1) && mainDone(G, v, mainProgress(G, v))) {
    s.quests.v2Claimable = true;
    G.emit('questReady', { kind: 'v2', quest: v });
  }
}

// ───────────── v2 quest book ("Sổ tay quán mới") ─────────────
export function v2QuestInfo(G) {
  const s = G.state, q = C.V2_QUESTS[s.quests.v2] || null;
  if (!q) return { quest: null, index: s.quests.v2, total: C.V2_QUESTS.length };
  const p = mainProgress(G, q);
  const locked = s.level < (q.minLv || 1);
  return { quest: q, progress: Math.min(p, q.target), target: q.target, locked, done: !locked && (s.quests.v2Claimable || mainDone(G, q, p)),
    index: s.quests.v2, total: C.V2_QUESTS.length, next: C.V2_QUESTS.slice(s.quests.v2 + 1, s.quests.v2 + 3) };
}
export function claimV2(G) {
  const s = G.state;
  const info = v2QuestInfo(G);
  if (!info.quest) return fail('none', 'Sổ tay đã xong hết rồi nha!');
  if (!info.done) return fail('notReady', info.locked ? `Việc này mở ở Lv ${info.quest.minLv} nha.` : 'Việc này chưa xong nha.');
  const r = info.quest.reward || {};
  const xp = questXp(G, 'v2', r.xp);
  if (r.money) addMoney(G, r.money, 'quest');
  if (xp) addXp(G, xp);
  s.quests.v2++;
  s.quests.v2Claimable = false;
  updateQuests(G);
  return { ok: true, reward: { money: r.money || 0, xp, deco: null, ingredients: 0 } };
}

// ───────────── rewards ─────────────
/** v2.6.11: XP a quest / chest pays now: share of this level's EXP bar, never below its fixed amount. */
export function questXp(G, kind, base = 0) {
  const need = C.LEVEL.xpToNext(G.state.level || 1);
  return Math.max(base || 0, Math.round(need * (C.QUEST_XP[kind] || 0)));
}
const tierMult = (G) => C.TIER_MULT[G.state.tier - 1];

/** Add `each` units of up to `kinds` useful ingredients, as far as the storeroom allows. Returns total units. */
export function giveIngredients(G, each, kinds = 4) {
  const s = G.state;
  const want = new Set();
  for (const p of C.HOTPOTS) if (s.menu[p.id] && isPotUnlocked(G, p.id)) for (const i of p.recipe) if (isIngUnlocked(G, i)) want.add(i);
  const ids = G.rng.shuffle([...want]).slice(0, kinds);
  let total = 0;
  for (const id of ids) {
    const { used, cap } = khoInfo(G);
    const n = Math.min(each, cap - used);
    if (n <= 0) break;
    addStock(G, id, n); total += n;
  }
  return total;
}

function giveDeco(G, id) {
  const s = G.state, d = DECO_BY_ID[id];
  if (!d) return null;
  if (!s.deco.owned.includes(id)) s.deco.owned.push(id);
  const cur = DECO_BY_ID[s.deco.equipped[d.cat]];
  if (!cur || cur.default) s.deco.equipped[d.cat] = id;
  G.modsDirty = true;
  return id;
}

export function openChest(G, chestId) {
  const s = G.state, c = C.CHESTS[chestId] || C.CHESTS.wood;
  const money = Math.round(G.rng.range(c.money[0], c.money[1]) * tierMult(G));
  addMoney(G, money, 'chest');
  const xp = questXp(G, chestId in C.QUEST_XP ? chestId : 'wood', c.xp);
  addXp(G, xp);
  let deco = null;
  if (c.decoChance && G.rng.chance(c.decoChance)) {
    const cand = C.DECO.filter((d) => !d.default && !s.deco.owned.includes(d.id) && d.source !== 'login' && (d.minTier || 1) <= s.tier);
    if (cand.length) deco = giveDeco(G, G.rng.pick(cand).id);
  }
  const ingredients = c.ingredientPack ? giveIngredients(G, c.ingredientPack, 2) : 0;
  return { money, xp, deco, ingredients };
}

export function claimMain(G) {
  const s = G.state;
  if (!s.quests.mainClaimable) return fail('notReady', 'Mục tiêu này chưa xong nha.');
  const q = C.MAIN_QUESTS[s.quests.main];
  const r = q.reward || {};
  const xp = questXp(G, 'main', r.xp);
  if (r.money) addMoney(G, r.money, 'quest');
  if (xp) addXp(G, xp);
  let deco = null;
  if (r.deco) deco = giveDeco(G, r.deco);
  s.quests.main++;
  s.quests.mainClaimable = false;
  // v2.5: some side dishes open with a main quest
  const sides = C.INGREDIENTS.filter((i) => i.side && i.quest === q.id);
  for (const sd of sides) { G.toast(`Mở khoá món ăn kèm: ${sd.name}! Nhập ở Kho nha.`, 'big', sd.icon); G.emit('sideUnlocked', { id: sd.id }); }
  if (q.mom && !/^tier\d/.test(q.mom)) G.mom(q.mom);   // tier lines are shown by the tier-up modal
  updateQuests(G);
  return { ok: true, reward: { money: r.money || 0, xp, deco, ingredients: 0, sides: sides.map((x) => x.id) } };
}

export function claimDaily(G, i) {
  const s = G.state;
  const list = dailyTasks(G);
  const e = list[i];
  if (!e) return fail('none', 'Không có nhiệm vụ này.');
  if (e.claimed) return fail('claimed', 'Nhiệm vụ này nhận rồi nha.');
  if (!e.done) return fail('notReady', 'Nhiệm vụ này chưa xong nha.');
  e.claimed = true;
  const reward = openChest(G, e.chest);
  G.counter('dailyClaimed', 1);
  return { ok: true, chest: e.chest, reward };
}

export function claimDailyAll(G) {
  const d = G.state.quests.daily;
  const list = dailyTasks(G);
  if (!list.length) return fail('none', 'Hôm nay chưa có nhiệm vụ nào.');
  if (d.allClaimed) return fail('claimed', 'Rương thưởng hôm nay nhận rồi nha.');
  if (!list.every((e) => e.claimed)) return fail('notReady', `Nhận hết ${list.length} rương nhiệm vụ để mở rương vàng nha!`);
  d.allClaimed = true;
  return { ok: true, chest: C.DAILY_ALL_BONUS, reward: openChest(G, C.DAILY_ALL_BONUS) };
}

/** Unclaimed finished dailies at midnight are paid out quietly so nothing is lost. */
export function autoClaimDailies(G) {
  const list = dailyTasks(G);
  let n = 0, money = 0;
  for (const e of list) {
    if (e.done && !e.claimed) { e.claimed = true; const r = openChest(G, e.chest); money += r.money; n++; }
  }
  if (n) G.toast(`Tự nhận ${n} rương nhiệm vụ hôm qua (+${Math.round(money)}k).`, 'info', 'ui_chest_wood');
}

// ───────────── reviews ─────────────
export function thankReview(G, id) {
  const s = G.state;
  const r = s.reviews.find((x) => x.id === id);
  if (!r) return fail('none', 'Không tìm thấy đánh giá này.');
  if (r.thanked) return fail('done', 'Bạn đã cảm ơn đánh giá này rồi nha.');
  r.thanked = true;
  s.today.thanked++;
  G.counter('thank', 1);
  addXp(G, C.LEVEL.thankXp);
  return { ok: true };
}

// ───────────── login streak ─────────────
export function loginInfo(G) {
  const s = G.state, now = G.nowMs();
  const today = dateKey(now), l = s.login;
  const claimedToday = l.claimedDate === today;
  const continues = l.lastDate === today || l.lastDate === prevDateKey(now);
  let streak = l.streak;
  if (!continues) streak = 0;
  const day = claimedToday ? ((l.streak - 1) % 7) + 1 : (streak % 7) + 1;
  return { streak, canClaim: !claimedToday, day, claimedToday, rewards: C.LOGIN_REWARDS };
}

export function claimLogin(G) {
  const s = G.state, now = G.nowMs();
  const info = loginInfo(G);
  if (!info.canClaim) return fail('claimed', 'Hôm nay bạn nhận quà rồi, mai quay lại nha!');
  const streak = info.streak + 1;
  const day = ((streak - 1) % 7) + 1;
  const r = C.LOGIN_REWARDS[day - 1];
  const out = { money: 0, xp: 0, deco: null, ingredients: 0, staffTicket: 0 };
  if (r.money) { out.money = Math.round(r.money * tierMult(G)); addMoney(G, out.money, 'login'); }
  if (r.ingredients) out.ingredients = giveIngredients(G, r.ingredients, 4);
  if (r.deco) out.deco = giveDeco(G, r.deco);
  if (r.staffTicket) { s.staffTickets++; out.staffTicket = r.staffTicket; }
  s.login = { lastDate: dateKey(now), streak, claimedDate: dateKey(now) };
  return { ok: true, reward: out, day, streak };
}
