// #debug floating panel (TECH_SPEC §11).
import { h, div, span } from './dom.js';
import { ctx } from './ctx.js';

export function mountDebug() {
  let panel = null;
  const want = () => /(^|[#-])debug(-|$)/.test(location.hash);
  function build() {
    const dbg = () => ctx.game.act.debug || {};
    const btn = (label, fn) => h('button', { class: 'dbgb', onclick: () => { try { fn(); } catch (e) { console.error(e); } } }, label);
    const kindSel = h('select', { class: 'dbgs' }, ...['sinhvien', 'vanphong', 'giadinh', 'capdoi', 'hoiban', 'chutu', 'khachtay', 'reviewer', 'tiktoker', 'doandulich', 'shipper'].map((k) => h('option', { value: k }, k)));
    const wxSel = h('select', { class: 'dbgs' }, ...['sun', 'hot', 'rain', 'cold', 'storm'].map((k) => h('option', { value: k }, k)));
    let spd = 1;
    const p = div('dbg',
      div('dbgt', span('', 'DEBUG'), h('button', { class: 'dbgx', onclick: () => { panel.classList.toggle('min'); } }, '–')),
      div('dbgg',
        btn('+1tr', () => dbg().money?.(1000)), btn('+10tr', () => dbg().money?.(10000)),
        btn('+Lv', () => dbg().level?.((ctx.game.state.level || 1) + 1)), btn('+XP', () => dbg().xp?.(100)),
        btn('Tier −', () => dbg().tier?.(Math.max(1, ctx.game.state.tier - 1))), btn('Tier +', () => dbg().tier?.(Math.min(5, ctx.game.state.tier + 1))),
        btn('Hết ngày', () => dbg().endDay?.()),
        btn('Tốc ×8', () => { spd = spd === 8 ? 1 : 8; ctx.game.act.setSpeed?.(spd); }),
        btn('Spawn', () => dbg().spawn?.(kindSel.value)), kindSel,
        btn('Thời tiết', () => dbg().weather?.(wxSel.value)), wxSel));
    document.getElementById('app').appendChild(p);
    return p;
  }
  function sync() { if (want() && !panel) panel = build(); else if (!want() && panel) { panel.remove(); panel = null; } }
  window.addEventListener('hashchange', sync);
  sync();
  return { update() {} };
}
