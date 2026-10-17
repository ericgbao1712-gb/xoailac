// Small building blocks shared by every bottom sheet.
import { h, div, span, ico, rich } from '../dom.js';
import { fmtShort } from '../../core/format.js';
import { ctx, sfx } from '../ctx.js';
import { portraitURL } from '../../art/index.js';

export const secTitle = (text, sub) => div('sec-title', span('', text), sub != null ? span('sub', sub) : null);

/** info strip: icon + text (**bold** supported) */
export function noteBox(icon, text, tone = '') {
  return div('card note ' + tone, icon ? ico(icon, 32) : null, h('p', null, rich(text)));
}

/** ★★★☆☆ */
export function stars(n, max = 5, size = 16, cls = '') {
  const w = span('stars ' + cls);
  for (let i = 0; i < max; i++) w.appendChild(ico(i < n ? 'ui_star' : 'ui_star_empty', size));
  return w;
}

/** price button: [label] 🪙 1,2 tr. Stays tappable when unaffordable so the game can explain why. */
export function costBtn(cost, { can = true, label = '', cls = 'jade', onClick, title = '' } = {}) {
  const b = h('button', { class: `btn ${cls} sm cost${can ? '' : ' off'}`, title },
    label ? span('lb', label) : null,
    cost != null ? span('pr', ico('ui_coin', 16), span('num', fmtShort(cost))) : null);
  if (onClick) b.addEventListener('click', (e) => onClick(b, e));
  return b;
}

/** little square pips: ■■□□ */
export function pips(n, max, cls = '') {
  const w = span('pips ' + cls);
  for (let i = 0; i < max; i++) w.appendChild(h('i', { class: i < n ? 'on' : '' }));
  return w;
}

/** 0..max stat bar with a label */
export function statRow(label, v, max = 10, cls = '') {
  return div('stat', span('sl', label), div('bar thin noshine ' + cls, h('i', { style: { '--p': Math.round((v / max) * 100) } })), span('sv num', String(v)));
}

/** celebratory puff + card flash after a successful purchase */
export function celebrate(el, { sound = 'cash' } = {}) {
  if (sound) sfx(sound);
  if (!el) return;
  try { ctx.fx?.puff(ctx.fx.centerOf(el)); } catch (e) { /* ignore */ }
  const card = el.closest?.('.card, .row') || el;
  card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
}

export function floatAt(el, text, color) {
  try { ctx.fx?.floatText(text, ctx.fx.centerOf(el), { color }); } catch (e) { /* ignore */ }
}

/** pixel toggle switch */
export function toggle(on, onChange, label = '') {
  const b = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label });
  b.appendChild(span('sr', on ? 'Bật' : 'Tắt'));
  b.addEventListener('click', () => { sfx('click'); onChange(!on); });
  return b;
}

/** big lock card */
export function lockCard(title, text, icon = 'ui_lock') {
  return div('card locked lock-card', ico(icon, 48), h('b', null, title), h('p', { style: { margin: 0 } }, text));
}

/** 12.88 → "12,9k" (unit prices need one decimal; fmtShort rounds to whole k) */
export const unitPrice = (k) => {
  const v = Math.round(k * 10) / 10;
  return String(Number.isInteger(v) ? v : v.toFixed(1)).replace('.', ',') + 'k';
};

/** pixel portrait of a Look (head & shoulders) */
export function portrait(look, size = 56, cls = '') {
  const img = h('img', { class: 'pix portrait ' + cls, width: size, height: size, alt: '' });
  img.draggable = false;
  try { img.src = portraitURL(look, Math.max(1, Math.round(size / 16))); } catch (e) { /* art not ready */ }
  return img;
}
