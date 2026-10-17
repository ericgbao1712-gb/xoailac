// Tem logo (v2.3, Lv 24): the player's own stamp, printed on every cup and next to the name on the sign board.
// Drawn with canvas vectors + a pixel mascot from the icon atlas, at any size. Never throws.
import * as C from '../config.js';
import { drawIcon } from './icons.js';

const FONT = '"XL Display", "Baloo 2", "Nunito", system-ui, sans-serif';
const hasDOM = typeof document !== 'undefined';

const colorOf = (id) => C.BRAND.colors.find((c) => c.id === id) || C.BRAND.colors[0];

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
function shapePath(g, frame, cx, cy, r) {
  if (frame === 'bogoc') roundRect(g, cx - r, cy - r, r * 2, r * 2, r * 0.36);
  else { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); }
}

/** Largest font px ≤ start whose width fits maxW. */
function fitFont(g, text, start, maxW, weight = 800) {
  let px = Math.max(4, Math.round(start));
  g.font = `${weight} ${px}px ${FONT}`;
  while (px > 4 && g.measureText(text).width > maxW) { px -= 1; g.font = `${weight} ${px}px ${FONT}`; }
  return px;
}

/** Text along a circle: top = reads left→right over the top, else along the bottom (upright). */
function arcText(g, text, cx, cy, r, px, top) {
  const chars = Array.from(text);
  g.font = `800 ${px}px ${FONT}`;
  const ws = chars.map((ch) => g.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) / r;
  let a = top ? -Math.PI / 2 - total / 2 : Math.PI / 2 + total / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const half = ws[i] / 2 / r;
    a += top ? half : -half;
    g.save();
    g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
    a += top ? half : -half;
  });
}
/** Font px so that `text` spans at most `maxAng` radians on radius r. */
function fitArc(g, text, start, r, maxAng) {
  return fitFont(g, text, start, r * maxAng);
}

/**
 * Draw the stamp into a 2D context, filling the square (x, y, S, S).
 * brand: state.brand (sanitized) · name: shop name. Below 90 px the text would be unreadable, so small stamps show
 * only the frame, the mascot (and the ribbon band).
 */
export function drawStamp(g, brand, name, S, x = 0, y = 0) {
  try {
    const b = brand || C.BRAND.def, col = colorOf(b.color);
    const cx = x + S / 2, cy = y + S / 2, R = S / 2 - Math.max(1, S * 0.03);
    const small = S < 90;
    name = String(name || C.START.shopName).trim();
    g.save();
    g.imageSmoothingEnabled = false;
    // body + border
    shapePath(g, b.frame, cx, cy, R);
    g.fillStyle = col.bg; g.fill();
    g.lineWidth = Math.max(1, S * 0.045); g.strokeStyle = col.ink; g.stroke();
    if (!small) {
      shapePath(g, b.frame, cx, cy, R - S * 0.065);
      g.lineWidth = Math.max(1, S * 0.012); g.setLineDash([S * 0.025, S * 0.02]); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = col.ink;
    const mascot = (m, size, mx, my) => { drawIcon(g, m, Math.round(mx - size / 2), Math.round(my - size / 2), size / 16); };
    if (small) {
      if (b.frame === 'ruybang') {
        mascot(b.mascot, S * 0.5, cx, cy - S * 0.08);
        g.fillStyle = col.ink; roundRect(g, cx - R * 1.02, cy + S * 0.14, R * 2.04, S * 0.17, S * 0.03); g.fill();
      } else mascot(b.mascot, S * 0.62, cx, cy);
      g.restore();
      return;
    }
    const slogan = (b.slogan || '').trim();
    if (b.frame === 'ruybang') {
      // slogan along the top (inside the dashed ring) · mascot · name on the ribbon. Nothing below the ribbon.
      const ar = R - S * 0.2;                       // top arc: accents rise outward, keep clear of the dashed ring
      if (slogan) {
        g.fillStyle = col.ink;
        arcText(g, slogan, cx, cy, ar, fitArc(g, slogan, S * 0.1, ar, Math.PI * 0.62), true);
      }
      mascot(b.mascot, slogan ? S * 0.32 : S * 0.36, cx, cy - (slogan ? -S * 0.005 : S * 0.1));
      const rw = R * 2.08, rh = S * 0.2, ry = cy + S * 0.15, rx = cx - rw / 2;
      g.fillStyle = shade(col.ink, -0.25);
      g.beginPath(); g.moveTo(rx - S * 0.02, ry + rh * 0.25); g.lineTo(rx + S * 0.1, ry + rh * 0.25); g.lineTo(rx + S * 0.1, ry + rh * 1.25); g.lineTo(rx - S * 0.02, ry + rh * 1.25); g.lineTo(rx + S * 0.03, ry + rh * 0.75); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(rx + rw + S * 0.02, ry + rh * 0.25); g.lineTo(rx + rw - S * 0.1, ry + rh * 0.25); g.lineTo(rx + rw - S * 0.1, ry + rh * 1.25); g.lineTo(rx + rw + S * 0.02, ry + rh * 1.25); g.lineTo(rx + rw - S * 0.03, ry + rh * 0.75); g.closePath(); g.fill();
      g.fillStyle = col.ink; roundRect(g, rx + S * 0.04, ry, rw - S * 0.08, rh, rh * 0.18); g.fill();
      g.fillStyle = col.bg; g.textAlign = 'center'; g.textBaseline = 'middle';
      const px = fitFont(g, name, rh * 0.66, rw - S * 0.18);
      g.font = `800 ${px}px ${FONT}`; g.fillText(name, cx, ry + rh * 0.54);
    } else if (b.text === 'congtren' || b.text === 'congduoi') {
      const top = b.text === 'congtren';
      const ar = R - S * 0.155, arTop = R - S * 0.185;
      mascot(b.mascot, S * 0.36, cx, cy + (slogan ? (top ? -S * 0.01 : S * 0.01) : 0));
      g.fillStyle = col.ink;
      arcText(g, name, cx, cy, top ? arTop : ar, fitArc(g, name, S * 0.13, top ? arTop : ar, Math.PI * 0.95), top);
      if (slogan) {
        const r2 = top ? ar : arTop;
        arcText(g, slogan, cx, cy, r2, fitArc(g, slogan, S * 0.1, r2, Math.PI * 0.62), !top);
      }
    } else {
      const my = cy - (slogan ? S * 0.14 : S * 0.09);
      mascot(b.mascot, S * 0.38, cx, my);
      g.fillStyle = col.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      const px = fitFont(g, name, S * 0.135, R * 1.42);
      g.font = `800 ${px}px ${FONT}`; g.fillText(name, cx, my + S * 0.27);
      if (slogan) {
        const sp = fitFont(g, slogan, Math.min(S * 0.1, px * 0.9), R * 1.1);   // never bigger than the name
        g.font = `800 ${sp}px ${FONT}`; g.fillText(slogan, cx, my + S * 0.39);
      }
    }
    g.restore();
  } catch (e) { try { g.restore(); } catch (e2) { /* ignore */ } }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ───────── caches ─────────
const canvasCache = new Map();
let fontsOK = false;
function fontsReady() {
  if (fontsOK || !hasDOM) return fontsOK;
  try { fontsOK = !!(document.fonts && document.fonts.check(`800 12px ${FONT}`)); } catch (e) { fontsOK = false; }
  return fontsOK;
}
const keyOf = (b, name, S) => [b.frame, b.text, b.color, b.mascot, b.slogan, name, S, fontsReady() ? 1 : 0].join('|');

/** Cached canvas of the stamp (S px square). Returns null without a DOM. */
export function stampCanvas(brand, name, S) {
  if (!hasDOM || !brand) return null;
  S = Math.max(8, Math.round(S));
  const k = keyOf(brand, name, S);
  let c = canvasCache.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = S;
  drawStamp(c.getContext('2d'), brand, name, S);
  if (canvasCache.size > 40) canvasCache.clear();
  canvasCache.set(k, c);
  return c;
}
