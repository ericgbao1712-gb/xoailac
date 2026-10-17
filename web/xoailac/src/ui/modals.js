// Modal framework: stack + queue, pausing, scrim, confirm dialog.
import { h, div, span, ico, clear } from './dom.js';
import { ctx, sfx } from './ctx.js';

let root = null;
const stack = [];     // visible modals (top = last)
const queue = [];     // waiting modals

export function mountModalRoot(el) { root = el; }

function updateRootPE() { root.style.pointerEvents = stack.length ? 'auto' : 'none'; }

/**
 * spec: { id, cls, dismissible = true, queue = true, pause = true, build(handle) -> Node|Node[],
 *         onClose, priority = 0, sound = 'whoosh' }
 */
export function openModal(spec) {
  const s = { dismissible: true, queue: true, pause: true, priority: 0, sound: 'whoosh', ...spec };
  if (s.id && (stack.some((m) => m.spec.id === s.id) || queue.some((q) => q.id === s.id))) return null;
  if (s.queue && stack.some((m) => m.spec.queue)) {
    queue.push(s);
    queue.sort((a, b) => b.priority - a.priority);
    return null;
  }
  return show(s);
}

function show(s) {
  const scrim = div('scrim');
  const box = div('mbox ' + (s.cls || ''));
  scrim.appendChild(box);
  const handle = {
    el: box, scrim, spec: s, closed: false,
    close: (why) => close(handle, why),
    rebuild: () => { clear(box); const n = s.build(handle); if (n) [].concat(n).forEach((x) => x && box.appendChild(x)); },
  };
  handle.rebuild();
  if (s.dismissible) scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) handle.close('scrim'); });
  root.appendChild(scrim);
  stack.push(handle);
  updateRootPE();
  if (s.pause) ctx.pauseFor('modal');
  if (s.sound) sfx(s.sound);
  return handle;
}

function close(handle, why) {
  if (handle.closed) return;
  handle.closed = true;
  const i = stack.indexOf(handle);
  if (i >= 0) stack.splice(i, 1);
  handle.scrim.classList.add('out');
  setTimeout(() => { handle.scrim.remove(); }, 200);
  if (handle.spec.pause) ctx.resumeFor('modal');
  try { handle.spec.onClose?.(why); } catch (e) { console.error(e); }
  updateRootPE();
  if (!stack.some((m) => m.spec.queue) && queue.length) setTimeout(() => {
    if (stack.some((m) => m.spec.queue) || !queue.length) return;
    show(queue.shift());
  }, 260);
}

export function closeAllModals() {
  queue.length = 0;
  [...stack].forEach((m) => close(m, 'all'));
}
export const modalCount = () => stack.length + queue.length;
export const modalOpen = (id) => stack.some((m) => m.spec.id === id) || queue.some((q) => q.id === id);

/** standard titled frame */
export function frame(title, { icon = null, onClose = null, sub = null } = {}, ...kids) {
  const head = div('mhead',
    icon ? ico(icon, 32) : null,
    div('mtitle', h('b', null, title), sub ? span('msub', sub) : null),
    onClose ? h('button', { class: 'xbtn', 'aria-label': 'Đóng', onclick: () => { sfx('click'); onClose(); } }, ico('ui_close', 32)) : null);
  return [head, div('mbody', ...kids)];
}

/** typed-confirm compare: ignore case and Vietnamese diacritics (so "xoa" works for XÓA) */
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').trim().toUpperCase();

/** confirm dialog — always stacks above everything (not queued) */
export function confirmDialog({ title = 'Chắc chưa?', text = '', yes = 'Đồng ý', no = 'Thôi', danger = false, icon = 'ui_info', onYes, onNo, input = null } = {}) {
  let inp = null;
  return openModal({
    id: null, queue: false, cls: 'confirm', sound: 'click',
    build: (m) => {
      const yesBtn = h('button', { class: 'btn ' + (danger ? 'warn' : 'jade') + ' body', onclick: () => { if (inp && norm(inp.value) !== norm(input.word)) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); return; } sfx('click'); m.close('yes'); onYes?.(); } }, yes);
      if (input) {
        inp = h('input', { class: 'tinput', type: 'text', placeholder: input.hint || '', autocomplete: 'off', autocapitalize: 'characters', maxlength: 12 });
      }
      return [
        div('mbody conf',
          div('cico', ico(icon, 48)),
          div('mtitle c', h('b', null, title)),
          h('p', { class: 'ctext' }, text),
          inp,
          div('mrow', h('button', { class: 'btn paper body', onclick: () => { sfx('click'); m.close('no'); onNo?.(); } }, no), yesBtn)),
      ];
    },
  });
}

export function installModalApi() {
  ctx.modal = openModal;
  ctx.closeModals = closeAllModals;
  ctx.confirm = confirmDialog;
  ctx.modalOpen = modalOpen;
  ctx.modalCount = modalCount;
}
