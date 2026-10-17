// Bottom-sheet framework (Kho / Thực đơn / Nâng cấp / Nhân viên / Quán).
import { h, div, span, ico, clear, store, setIco } from './dom.js';
import { ctx, S, sfx } from './ctx.js';

const REG = {};          // id -> { title, icon, build(body, api) }
let root, scrim, sheet, headT, headI, body, subBar, handle;
let cur = null, curSub = null, closing = 0;
let builder = null;

export function registerSheet(id, def) { REG[id] = def; }

export function mountSheets(el) {
  root = el;
  scrim = div('sheet-scrim');
  scrim.addEventListener('pointerdown', () => closeSheet());
  headI = ico('ui_kho', 32);
  headT = h('b', null, '');
  const closeBtn = h('button', { class: 'xbtn', 'aria-label': 'Đóng', onclick: () => { sfx('click'); closeSheet(); } }, ico('ui_close', 32));
  handle = div('shandle', h('i'));
  subBar = div('subtabs');
  subBar.hidden = true;
  const head = div('shead', headI, div('stitle', headT), closeBtn);
  body = div('sbody');
  sheet = div('sheet', handle, head, subBar, body);
  root.append(scrim, sheet);
  scrim.hidden = true; sheet.hidden = true;

  // drag the handle/header down to close
  let sy = 0, dy = 0, dragging = false, pid = 0;
  const startDrag = (e) => { if (e.target.closest('.xbtn')) return; dragging = true; sy = e.clientY; dy = 0; pid = e.pointerId; sheet.style.transition = 'none'; try { sheet.setPointerCapture(pid); } catch (er) { /* ignore */ } };
  const moveDrag = (e) => { if (!dragging) return; dy = Math.max(0, e.clientY - sy); sheet.style.transform = `translateY(${dy}px)`; };
  const endDrag = () => { if (!dragging) return; dragging = false; sheet.style.transition = ''; if (dy > 80) { sheet.style.transform = ''; closeSheet(); } else sheet.style.transform = ''; try { sheet.releasePointerCapture(pid); } catch (er) { /* ignore */ } };
  [handle, head].forEach((t) => { t.addEventListener('pointerdown', startDrag); });
  sheet.addEventListener('pointermove', moveDrag);
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);

  ctx.openSheet = openSheet;
  ctx.closeSheet = closeSheet;
  ctx.sheetOpen = () => cur;
  ctx.sheetSub = () => curSub;
  ctx.rerenderSheet = rerender;
}

const api = {
  rerender: () => rerender(),
  setSub: (s) => { curSub = s; store.set('sub:' + cur, s); rerender(true); },
  get sub() { return curSub; },
  body: () => body,
  /** render sub-tab pills: items [{id,label,icon,dot,locked}] */
  tabs(items, active, onPick, cls = '') {
    clear(subBar); subBar.hidden = false; subBar.className = 'subtabs ' + cls;
    items.forEach((it) => {
      const b = h('button', { class: 'stab' + (it.id === active ? ' on' : '') + (it.locked ? ' lock' : ''), onclick: () => { sfx('click'); onPick(it.id); } },
        it.icon ? ico(it.icon, 16) : null, span('', it.label), it.dot ? h('i', { class: 'dot sm' }) : null);
      subBar.appendChild(b);
      if (it.id === active) requestAnimationFrame(() => { try { b.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* ignore */ } });
    });
  },
  noTabs() { subBar.hidden = true; clear(subBar); },
};

export function openSheet(id, sub) {
  const def = REG[id]; if (!def) return;
  if (ctx.modalCount?.() > 0) return;
  if (cur === id && sub == null) { closeSheet(); return; }
  const wasOpen = !!cur;
  cur = id;
  curSub = sub || store.get('sub:' + id, null);
  clearTimeout(closing);
  scrim.hidden = false; sheet.hidden = false;
  sheet.classList.remove('out');
  if (!wasOpen) { sheet.classList.remove('in'); void sheet.offsetWidth; sheet.classList.add('in'); ctx.pauseFor('sheet'); sfx('whoosh'); }
  else { sheet.classList.remove('swap'); void sheet.offsetWidth; sheet.classList.add('swap'); sfx('click'); }
  rerender(true);
  ctx.tutorial?.onSheet?.(id);
}

export function closeSheet() {
  if (!cur) return;
  cur = null; curSub = null;
  sheet.classList.remove('in', 'swap'); sheet.classList.add('out');
  scrim.classList.add('out');
  ctx.resumeFor('sheet');
  sfx('whoosh');
  closing = setTimeout(() => { sheet.hidden = true; scrim.hidden = true; sheet.classList.remove('out'); scrim.classList.remove('out'); clear(body); }, 220);
}

let lastSig = '';
export function rerender(resetScroll = false) {
  if (!cur) return;
  const def = REG[cur];
  const top = resetScroll ? 0 : body.scrollTop;
  headT.textContent = def.title;
  setIco(headI, def.icon, 32);
  const next = div('sbody-inner');
  try { def.build(next, api); } catch (e) { console.error('[ui] sheet ' + cur, e); next.appendChild(div('nodata', 'Ôi, có lỗi nhỏ. Thử lại nha!')); }
  clear(body); body.appendChild(next);
  body.scrollTop = top;
  lastSig = sig();
}

const sig = () => { const s = S(); return [s.money, s.level, s.day, s.phase, s.tier].join('|'); };

let acc = 0;
export function updateSheets(dt) {
  if (!cur) return;
  acc += dt; if (acc < 0.5) return; acc = 0;
  if (sig() !== lastSig && !ctx.busy?.()) rerender();
}
export const sheetBody = () => body;
