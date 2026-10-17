// Derived data + defensive adapters between the game API and the UI.
// The real game (Code-Core) and the sandbox mock both go through these helpers.
import * as C from '../config.js';
import { makeStaffLook, makeLook, makeOwnerLook } from '../art/index.js';
import { fmtShort } from '../core/format.js';
import { ctx } from './ctx.js';

export const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
export const ING = byId(C.INGREDIENTS);
export const POT = byId(C.HOTPOTS);
export const DRINK = byId(C.DRINKS);
export const UP = byId(C.UPGRADES);
export const DECO = byId(C.DECO);
export const MKT = byId(C.MARKETING);
export const BR = byId(C.BRANCHES);
export const tierCfg = (t) => C.TIERS[Math.max(1, Math.min(5, t || 1)) - 1];
export const hotpotIds = C.HOTPOTS.map((p) => p.id);

const g = () => ctx.game;
const st = () => ctx.game.state;
const get = (name, ...a) => { try { const f = g().get?.[name]; return typeof f === 'function' ? f.apply(g().get, a) : undefined; } catch (e) { console.error('[ui] get.' + name, e); return undefined; } };

export function levelInfo() {
  const r = get('level');
  if (r && r.need != null) return r;
  const s = st(); const need = C.LEVEL.xpToNext(s.level);
  return { level: s.level, xp: s.xp, need, pct: Math.min(100, (s.xp / need) * 100) };
}
export const khoInfo = () => get('kho') || { used: 0, cap: 60 };
export const stock = (id) => st().inventory?.[id] ?? 0;
/** Portions of id that must be used today (they are thrown out tomorrow morning). */
export const expiringToday = (id) => { const s = st(); let n = 0; for (const l of s.lots?.[id] || []) if (l.e <= s.day) n += l.n; return n; };
export const shelfOf = (id) => ING[id]?.shelf || 5;
export function buyPrice(id) {
  const v = get('buyPrice', id);
  if (typeof v === 'number') return v;
  return ING[id].cost * (st().market?.mult?.[id] ?? 1);
}
export function potPrice(id) {
  const v = get('potPrice', id);
  if (typeof v === 'number') return v;
  const p = POT[id]; const lvl = st().recipes?.[id]?.lvl ?? 1;
  return Math.round(p.price * (1 + (lvl - 1) * C.RECIPE.pricePerLevel));
}
/** What a dish sells for now (player price or reference). */
export function sellPrice(id) { const v = get('priceInfo', id); return v ? v.price : potPrice(id); }
/** v2.5 món ăn kèm: why a side is still locked ("Mở ở Lv 9" / "Xong nhiệm vụ: …"). */
export function lockText(id) {
  const d = ING[id]; if (!d) return '';
  if (st().level < d.unlockLv) return 'Mở ở Lv ' + d.unlockLv;
  if (d.quest) { const q = C.MAIN_QUESTS.find((x) => x.id === d.quest); return 'Xong nhiệm vụ: ' + (q ? q.text : d.quest); }
  return '';
}
export const SIDES = C.INGREDIENTS.filter((i) => i.side);
export const ingUnlocked = (id) => { const v = get('isIngUnlocked', id); return v ?? st().level >= ING[id].unlockLv; };
export const potUnlocked = (id) => { const v = get('isPotUnlocked', id); return v ?? st().level >= POT[id].unlockLv; };
export const drinkUnlocked = (id) => { const v = get('isDrinkUnlocked', id); return v ?? st().level >= DRINK[id].unlockLv; };
export const featureOn = (key) => { const v = get('unlocked', key); return v ?? st().level >= (C.FEATURES[key] ?? 1); };

export const tierNow = () => st().tier || 1;
export function stoveCount() {
  const w = g().world?.stoves;
  if (Array.isArray(w) && w.length) return w.length;
  const t = tierCfg(tierNow());
  return Math.min(t.maxStoves, t.startStoves + (st().upgrades?.stove || 0));
}
export const tableCount = () => { const t = tierCfg(tierNow()); return Math.min(t.maxTables, t.startTables + (st().upgrades?.table || 0)); };
export const hasStaff = (role) => (st().staff || []).some((s) => s.role === role);
export const staffCount = (role) => (st().staff || []).filter((s) => s.role === role).length;
export const isOpenPhase = () => st().phase === 'open' || st().phase === 'closing';

export function mainQuest() {
  const r = get('mainQuest');
  if (r) return r;
  const s = st(); const quest = C.MAIN_QUESTS[s.quests?.main ?? 0] || null;
  return { quest, progress: 0, target: quest?.target ?? 1, done: !!s.quests?.mainClaimable };
}

export function dailyList() {
  let list = get('dailyTasks');
  if (list && !Array.isArray(list)) list = list.list || list.tasks || [];
  list = list || st().quests?.daily?.list || [];
  return list.map((t) => {
    const def = C.DAILY_POOL.find((d) => d.id === t.id) || {};
    const target = t.target ?? 1;
    const nTxt = ['dayRevenue', 'dayProfit', 'tips'].includes(def.type) ? fmtShort(target) : target;
    const text = (def.text || t.text || t.id || '').replace('{n}', nTxt);
    const progress = t.progress || 0;
    return { ...t, text, type: def.type, chest: t.chest || def.chest || 'wood', progress, target, claimed: !!t.claimed, done: t.done ?? progress >= target, failed: !!t.failed };
  });
}
export function dots() { return get('dots') || {}; }

/** Look object for a staff record (Core stores only a lookSeed, art builds the Look). */
export function staffLook(s) {
  try {
    if (s.look && s.look.kind) return s.look;
    const seed = s.look?.lookSeed ?? s.lookSeed ?? s.look?.seed ?? (parseInt(String(s.id || 1).replace(/\D/g, ''), 10) || 1);
    return makeStaffLook(s.role, seed);
  } catch (e) { return { kind: 'pedestrian' }; }
}
export function customerLook(kind, seed = 1, idx = 0) { try { return makeLook(kind, seed, idx); } catch (e) { return { kind }; } }
export function ownerLook(avatar, tier) { try { return makeOwnerLook(avatar, tier); } catch (e) { return { kind: 'owner' }; } }

export function weatherEffect(w, up = {}) {
  const W = C.WEATHER[w]; if (!W) return '';
  const pct = (m) => (m >= 1 ? '+' : '−') + Math.abs(Math.round((m - 1) * 100)) + '%';
  const covered = !!C.TIERS[(st().tier || 1) - 1]?.covered;
  if (w === 'rain') return covered ? `Mưa rả rích mà có ly xoài lắc là chân ái! Khách ${pct(W.demand)}` : up.tarp ? 'Có mưa rào — mưa thì chạm KÉO BẠT nha!' : 'Có mưa rào mà chưa có bạt — khách ướt sẽ bỏ về!';
  if (w === 'hot') return up.cooling ? 'Có quạt rồi, khách vẫn bình thường' : `Chưa có quạt, khách ${pct(W.noCoolingDemand)}`;
  if (w === 'cold') return `Trời se lạnh, thèm đồ chua cay! Khách ${pct(W.demand)}`;
  if (w === 'storm') return covered || up.tarp ? `Bão to, ít người ra đường. Khách ${pct(W.demand)}` : 'Bão to mà chưa có bạt — khách không dám ngồi!';
  return 'Trời đẹp, khách bình thường';
}
export const eventInfo = (id) => C.EVENTS.find((e) => e.id === id) || null;

export function starsOf(r) { return Math.max(0, Math.min(5, Math.round(r))); }

/** icon for a weather key */
export const wxIcon = (w) => C.WEATHER[w]?.icon || 'wx_sun';

/** recipe info (level, price, mastery…) — prefers Core's get.recipeInfo, falls back to config maths */
export function recipeInfo(id) {
  const r = get('recipeInfo', id);
  if (r) return r;
  const p = POT[id]; const rec = st().recipes?.[id] || { lvl: 1, sold: 0 };
  const max = C.RECIPE.maxLevel;
  const cost = rec.lvl >= max ? null : C.RECIPE.upgradeCost(p, rec.lvl);
  const mastery = C.RECIPE.masteryAt.filter((n) => rec.sold >= n).length;
  return { id, lvl: rec.lvl, max, cost, canUpgrade: cost != null && st().money >= cost && potUnlocked(id), price: potPrice(id), sold: rec.sold, mastery,
    nextMastery: C.RECIPE.masteryAt[mastery] ?? null, unlocked: potUnlocked(id), enabled: !!st().menu?.[id],
    nextPrice: cost == null ? null : Math.round(p.price * (1 + rec.lvl * C.RECIPE.pricePerLevel)) };
}

/** hiring candidates for a role (Core adds salary + fee) */
export function candidates(role) {
  const r = get('candidates', role);
  if (Array.isArray(r)) return r;
  return (st().candidates?.list || []).filter((c) => c.role === role).map((c) => {
    const sal = Math.round(C.STAFF.salary(c, st().tier)); return { ...c, salary: sal, fee: sal };
  });
}

/** daily salary of a hired staff member (mirrors Core's staffSalary) */
export function salaryOf(m) {
  let sal = C.STAFF.salary(m, st().tier) * Math.pow(1 + C.STAFF.levelSalaryUp, (m.lvl || 1) - 1);
  if (m.trait === 'vung') sal *= 0.7;
  return Math.max(1, Math.round(sal));
}
export const roleUnlocked = (role) => { const r = C.STAFF.roles[role]; return !!r && st().level >= r.unlockLv && tierNow() >= r.minTier; };
export const seen = (key) => !!st().flags?.seenUnlock?.[key];
export const markSeen = (key) => { if (!seen(key)) { try { ctx.game.act.markSeen?.(key); } catch (e) { /* ignore */ } } };
