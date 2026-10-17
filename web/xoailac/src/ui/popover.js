// Anchored popover (pot picker, quick-buy). One at a time.
import { ctx } from './ctx.js';
import { div, clamp } from './dom.js';

let cur = null;

export function closePopover() {
  if (!cur) return;
  const c = cur; cur = null;
  document.removeEventListener('pointerdown', c.onDoc, true);
  c.el.classList.add('out');
  setTimeout(() => c.el.remove(), 120);
  c.onClose?.();
}
export const popoverOpen = () => !!cur;
export const popoverAnchor = () => cur?.anchor || null;

export function showPopover(anchor, content, { className = '', onClose = null } = {}) {
  closePopover();
  const root = ctx.el.pop;
  const el = div('popover ' + className, content);
  el.style.visibility = 'hidden';
  root.appendChild(el);
  const app = ctx.el.app.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  const pw = el.offsetWidth, ph = el.offsetHeight;
  let left = a.left + a.width / 2 - pw / 2 - app.left;
  left = clamp(left, 8, app.width - pw - 8);
  let top = a.top - ph - 14 - app.top;
  let below = false;
  if (top < 4) { top = a.bottom + 14 - app.top; below = true; }
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.style.setProperty('--ax', clamp(a.left + a.width / 2 - app.left - left, 18, pw - 18) + 'px');
  el.classList.toggle('below', below);
  el.style.visibility = '';
  const onDoc = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
  cur = { el, anchor, onDoc, onClose };
  return el;
}
