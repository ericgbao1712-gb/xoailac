// Bottom navigation with red-dot badges.
import { h, div, span, ico } from './dom.js';
import { ctx, sfx } from './ctx.js';
import { dots } from './data.js';

export const TABS = [
  { id: 'kho', label: 'Kho', icon: 'ui_kho' },
  { id: 'menu', label: 'Thực đơn', icon: 'ui_menu' },
  { id: 'upgrade', label: 'Nâng cấp', icon: 'ui_upgrade' },
  { id: 'staff', label: 'Nhân viên', icon: 'ui_staff' },
  { id: 'shop', label: 'Quán', icon: 'ui_shop' },
];

export function mountNav(root) {
  const btns = {};
  const dotEls = {};
  TABS.forEach((t) => {
    const b = h('button', { class: 'tab', dataset: { tab: t.id, tut: 'tab-' + t.id }, onclick: () => { sfx('click'); if (t.id === 'menu') { try { ctx.game.act?.setFlag?.('menuNudgeSeen', true); } catch (e) { /* optional */ } } ctx.openSheet(t.id); } }, ico(t.icon, 32), span('', t.label));
    btns[t.id] = b;
    root.appendChild(b);
  });
  let acc = 1;
  function update(dt) {
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    const d = dots();
    const open = ctx.sheetOpen();
    TABS.forEach((t) => {
      const on = !!d[t.id];
      if (on && !dotEls[t.id]) { dotEls[t.id] = h('i', { class: 'dot' }); btns[t.id].appendChild(dotEls[t.id]); }
      else if (!on && dotEls[t.id]) { dotEls[t.id].remove(); dotEls[t.id] = null; }
      btns[t.id].classList.toggle('active', open === t.id);
    });
  }
  return { update, btns };
}
