// Tiny DOM helpers for the UI layer (no framework).
import { iconURL } from '../art/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyStyle(el, obj) {
  for (const k in obj) {
    const v = obj[k];
    if (v == null) continue;
    if (k.startsWith('--')) el.style.setProperty(k, v);
    else el.style[k] = v;
  }
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

/** h('div', { class: 'x', onclick }, child, 'text') */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') applyStyle(el, v);
      else if (k === 'style') el.setAttribute('style', v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'src' || k === 'draggable') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}

export const div = (cls, ...kids) => h('div', { class: cls }, ...kids);
export const span = (cls, ...kids) => h('span', { class: cls }, ...kids);

export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
  for (const c of kids) if (c) el.appendChild(c);
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/** Pixel-perfect icon <img>. size must be a multiple of 16 (16, 32, 48, 64). */
export function ico(name, size = 32, cls = '') {
  const scale = Math.max(1, Math.round(size / 16));
  const img = document.createElement('img');
  img.className = 'ico' + (cls ? ' ' + cls : '');
  img.alt = '';
  img.draggable = false;
  img.width = img.height = size;
  try { img.src = iconURL(name, scale); } catch (e) { /* art not ready */ }
  return img;
}

/** Update an <img class=ico> in place. */
export function setIco(img, name, size = 32) {
  if (!img || img.dataset.n === name) return;
  img.dataset.n = name;
  try { img.src = iconURL(name, Math.max(1, Math.round(size / 16))); } catch (e) { /* ignore */ }
}

/** "Bấm **MỞ HÀNG** nha" → nodes with <b> */
export function rich(str) {
  const frag = document.createDocumentFragment();
  String(str).split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (!part) return;
    if (part.startsWith('**')) frag.appendChild(h('b', null, part.slice(2, -2)));
    else frag.appendChild(document.createTextNode(part));
  });
  return frag;
}

/** Set text only when changed (cheap per-frame updates). */
export function setText(el, v) {
  const s = String(v);
  if (el._t !== s) { el._t = s; el.textContent = s; }
}
export function setClass(el, name, on) {
  on = !!on;
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}
export function setStyleVar(el, name, v) {
  const s = String(v);
  const c = (el._v ||= {});
  if (c[name] !== s) { c[name] = s; el.style.setProperty(name, s); }
}
export function setShown(el, on) {
  if (el._s !== !!on) { el._s = !!on; el.hidden = !on; }
}

/** pointerdown-based press for the fast game loop (+ keyboard click fallback) */
export function onPress(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button > 0) return;
    fn(e);
  });
  el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
}

/** long press (ms) helper; short tap still calls onTap */
export function onLongPress(el, onLong, onTap, ms = 520) {
  let timer = 0, fired = false, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  el.addEventListener('pointerdown', (e) => {
    fired = false; sx = e.clientX; sy = e.clientY;
    cancel();
    timer = setTimeout(() => { fired = true; timer = 0; el.classList.add('lp-fired'); onLong(e); }, ms);
    el.classList.remove('lp-fired');
  });
  el.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, (e) => {
    const wasTimer = !!timer;
    cancel();
    if (t === 'pointerup' && wasTimer && !fired) onTap?.(e);
  }));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const nextFrame = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

export function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

/** per-viewer convenience storage (try/catch wrapped) */
export const store = {
  get(k, d) { try { const v = localStorage.getItem('xoai-lac/ui/' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('xoai-lac/ui/' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

export function vibrate(ms = 10) {
  try { navigator.vibrate?.(ms); } catch (e) { /* ignore */ }
}
