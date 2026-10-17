// Small helpers shared by the modal screens: count-up numbers, a skippable timeline, unlock icons, confetti hookup.
import * as C from '../../config.js';
import { h, ico } from '../dom.js';
import { ctx } from '../ctx.js';
import * as D from '../data.js';
import { decoIconURL } from '../../art/index.js';

/** rolls `el.textContent` from→to. Returns { finish() }. Instant under reduced motion. */
export function countUp(el, to, { from = 0, dur = 700, fmt = (v) => String(Math.round(v)), onDone } = {}) {
  if (ctx.reduced || dur <= 0) { el.textContent = fmt(to); onDone?.(); return { finish() {} }; }
  let raf = 0, done = false;
  const t0 = performance.now();
  el.textContent = fmt(from);
  const step = (now) => {
    const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (u < 1) raf = requestAnimationFrame(step);
    else { done = true; onDone?.(); }
  };
  raf = requestAnimationFrame(step);
  return { finish() { if (done) return; cancelAnimationFrame(raf); done = true; el.textContent = fmt(to); onDone?.(); } };
}

/**
 * Ordered steps `at(ms, fn(instant))`. skip() runs every unfinished step at once (instant = true).
 * Steps run through setTimeout so they stay correct even if the tab is throttled.
 */
export function createTimeline() {
  const steps = [];
  let timers = [], skipped = false, started = false, closed = false;
  let doneFn = null;
  const api = {
    at(ms, fn) { steps.push({ ms: ctx.reduced ? Math.min(ms, 60) : ms, fn, ran: false }); return api; },
    onDone(fn) { doneFn = fn; return api; },
    start() {
      if (started) return api; started = true;
      const last = steps.reduce((m, s) => Math.max(m, s.ms), 0);
      steps.forEach((s) => timers.push(setTimeout(() => run(s, false), s.ms)));
      timers.push(setTimeout(() => finish(), last + 30));
      return api;
    },
    skip() {
      if (skipped || closed) return; skipped = true;
      timers.forEach(clearTimeout); timers = [];
      steps.forEach((s) => run(s, true));
      finish();
    },
    stop() { closed = true; timers.forEach(clearTimeout); timers = []; },
    get done() { return skipped || steps.every((s) => s.ran); },
  };
  function run(s, instant) { if (s.ran || closed) return; s.ran = true; try { s.fn(instant); } catch (e) { console.error('[ui] timeline', e); } }
  function finish() { if (closed) return; const f = doneFn; doneFn = null; try { f?.(); } catch (e) { console.error('[ui] timeline done', e); } }
  return api;
}

/** confetti over a modal; stops itself when the modal closes. */
export function confettiFor(handle, opts = {}) {
  let stop = null;
  const t = setTimeout(() => {
    if (handle.closed) return;
    try { stop = ctx.fx?.confetti(handle.scrim, opts); } catch (e) { /* ignore */ }
  }, 80);
  const prev = handle.spec.onClose;
  handle.spec.onClose = (why) => { clearTimeout(t); try { stop?.(); } catch (e) { /* ignore */ } prev?.(why); };
}

// ---- unlock cards (level-up / roadmap) -------------------------------------------------------
export const UNLOCK_LABEL = { pot: 'Món lắc mới', ingredient: 'Nguyên liệu mới', drink: 'Đồ uống mới', role: 'Nhân viên mới', feature: 'Tính năng mới', tier: 'Mở rộng quán', supplier: 'Nhà cung cấp mới', marketing: 'Khuyến mãi mới', side: 'Món ăn kèm mới', perk: 'Tính năng mới', equip: 'Thiết bị mới', mastery: 'Cấp thành thạo' };
export const FEATURE_NAME = {
  deco: 'Trang trí quán', daily: 'Nhiệm vụ ngày', reservations: 'Khách đặt bàn', mkt_reviewer: 'Mời Food Reviewer', mkt_livestream: 'Livestream bán hàng',
  speed2: 'Tăng tốc ×2', speed3: 'Tăng tốc ×3', manageMode: 'Chế độ quản lý', extras: 'Khách gọi thêm món', lottery: 'Cô bán vé số',
  pricing: 'Tự đặt giá bán', sideUp: 'Kê thêm bàn ghế', staffBonus: 'Thưởng nóng nhân viên', daily4: '4 nhiệm vụ mỗi ngày',
};
const FEATURE_ICON = { deco: 'ui_deco', daily: 'ui_quest', reservations: 'ui_reserve', mkt_reviewer: 'ui_review', mkt_livestream: 'ui_music', speed2: 'ui_speed', speed3: 'ui_speed', manageMode: 'ui_staff', extras: 'ui_menu', lottery: 'ui_ticket',
  pricing: 'ui_tag', sideUp: 'eq_table', staffBonus: 'ui_gift', daily4: 'ui_quest' };

export function unlockIcon(u) {
  switch (u.type) {
    case 'pot': return D.POT[u.id]?.icon || 'ui_menu';
    case 'ingredient': return D.ING[u.id]?.icon || 'ui_kho';
    case 'drink': return D.DRINK[u.id]?.icon || 'drk_trada';
    case 'side': return D.ING[u.id]?.icon || 'ak_cavien';
    case 'role': return 'role_' + u.id;
    case 'feature': return FEATURE_ICON[u.id] || 'ui_star';
    case 'tier': return 'ui_shop';
    case 'supplier': return C.SUPPLIERS.find((x) => x.id === u.id)?.icon || 'eq_truck';
    case 'marketing': return C.MARKETING.find((x) => x.id === u.id)?.icon || 'ui_megaphone';
    case 'perk': return C.PERKS.find((x) => x.id === u.id)?.icon || 'ui_star';
    case 'equip': return C.UPGRADES.find((x) => x.id === u.id)?.icon || 'eq_stove';
    case 'mastery': return 'ui_chest_gold';
    default: return 'ui_star';
  }
}

/** every unlock at a given level (mirrors Core's unlocksAt, from config only) */
export function unlocksAtLevel(level) {
  const out = [];
  if (level <= 1) return out;
  for (const p of C.HOTPOTS) if (p.unlockLv === level) out.push({ type: 'pot', id: p.id, name: p.name });
  for (const i of C.INGREDIENTS) if (i.unlockLv === level && !i.side) out.push({ type: 'ingredient', id: i.id, name: i.name });
  for (const i of C.INGREDIENTS) if (i.side && !i.quest && i.unlockLv === level) out.push({ type: 'side', id: i.id, name: i.name, desc: `Món ăn kèm: thu thêm ${i.side}k mỗi phần, vốn ${i.cost}k, để được ${i.shelf} ngày.` });
  for (const d of C.DRINKS) if (d.unlockLv === level) out.push({ type: 'drink', id: d.id, name: d.name });
  for (const r of Object.keys(C.STAFF.roles)) if (C.STAFF.roles[r].unlockLv === level) out.push({ type: 'role', id: r, name: C.STAFF.roles[r].name });
  for (const f of Object.keys(C.FEATURES)) if (C.FEATURES[f] === level && FEATURE_NAME[f]) out.push({ type: 'feature', id: f, name: FEATURE_NAME[f] });
  for (const t of C.TIERS) if (t.require && t.require.level === level) out.push({ type: 'tier', id: t.id, name: t.name });
  for (const x of C.SUPPLIERS) if (x.unlockLv === level) out.push({ type: 'supplier', id: x.id, name: x.name });
  for (const m of C.MARKETING) if ((m.hours || m.drinkChance || m.kinds) && m.unlockLv === level) out.push({ type: 'marketing', id: m.id, name: m.name });
  for (const p of C.PERKS) if (p.lv === level && !p.marketing && !p.supplier) out.push({ type: 'perk', id: p.id, name: p.name, desc: p.desc });
  // v2.6.9: a piece of equipment (or its next level) that becomes buyable at this level
  for (const u of C.UPGRADES) (u.minLv || []).forEach((lv, i) => {
    if (lv !== level || level <= 1 || u.id === 'kho') return;                 // kho Lv 17 is the Kho lạnh perk card
    const nm = u.levels ? u.levels[i + 1] : u.name + (i ? ' cấp ' + (i + 1) : '');
    out.push({ type: 'equip', id: u.id, name: nm || u.name, desc: (i ? u.name + ' cấp ' + (i + 1) + '. ' : '') + u.desc });
  });
  if (level >= C.MASTERY.fromLv) out.push({ type: 'mastery', id: 'mastery' + level, name: 'Rương thành thạo' + (level % C.MASTERY.ticketEvery === 0 ? ' + vé tuyển ★3+' : ''), desc: 'Mỗi cấp từ Lv 41 nhận 1 rương vàng (mở ở sổ nhiệm vụ)' + (level % C.MASTERY.ticketEvery === 0 ? '; cấp chia hết cho 5 tặng thêm vé tuyển nhân viên.' : '.') });
  return out;
}

/** pixel deco picture */
export function decoImg(id, size = 48) {
  const img = h('img', { class: 'pix deco-img', width: size, height: size, alt: '' });
  img.draggable = false;
  try { img.src = decoIconURL(id, Math.max(1, Math.round(size / 24))); } catch (e) { /* art not ready */ }
  return img;
}

export const wxName = (w) => C.WEATHER[w]?.name || '';
export const vibrate = (ms) => { if (ctx.haptics && navigator.userActivation?.hasBeenActive !== false) { try { navigator.vibrate?.(ms); } catch (e) { /* ignore */ } } };
export { ico };
