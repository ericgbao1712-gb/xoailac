// v2.5: the counter's material follows the "Quầy sơ chế" upgrade (gỗ mộc → gỗ sồi → sơn bạc hà → inox → đá cẩm thạch).
// Built once per material from the painted wood tile: each pixel's brightness is mapped onto the material's colour
// ramp (so the grain, lip and plank shading of the original art stay), then a few material details are drawn on top.
// Tile rows (DETAIL px, 100×81): 0–43 top surface · 44–47 front lip · 48–63 front panel · 64–80 base planks.

export const MATERIALS = [
  null,                                                                        // 0: original wood
  { top: ['#8a5a34', '#c99560', '#e8c08a', '#f8e2bc'], front: ['#7a4c2a', '#b9824e', '#dcaa72', '#f0cf9c'], base: ['#5e3a20', '#8a5a34', '#a8744a', '#c08c5c'] },
  { top: ['#8a5a34', '#c99560', '#e8c08a', '#f8e2bc'], front: ['#2f7a62', '#4fa585', '#7ccaa8', '#b6ead2'], base: ['#24604c', '#2f7a62', '#3f8f74', '#56a587'], trim: '#f2c230' },
  { top: ['#5d6973', '#9aa6b0', '#cfd8de', '#f4f8fa'], front: ['#56626c', '#8c98a2', '#bcc6cd', '#e6ecf0'], base: ['#3e4850', '#5d6973', '#76838c', '#8e9aa3'], sheen: true },
  { top: ['#9a9a9e', '#d8d6d2', '#efece6', '#ffffff'], front: ['#1d2b45', '#2b3d5e', '#3b5279', '#526c96'], base: ['#141f33', '#1d2b45', '#26385a', '#31466c'], trim: '#e6b84a', veins: true },
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function ramp(stops, t) {
  t = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i, a = hex(stops[i]), b = hex(stops[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const cache = new Map();
/** Canvas (same size as the band frame) for material `m` (1..4), or null for the original wood / no DOM. */
export function bandFor(img, f, m) {
  const M = MATERIALS[m];
  if (!M || !img || typeof document === 'undefined') return null;
  const key = m + ':' + f.join(',');
  if (cache.has(key)) return cache.get(key);
  const [fx, fy, fw, fh] = f;
  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  const g = c.getContext('2d');
  g.drawImage(img, fx, fy, fw, fh, 0, 0, fw, fh);
  const id = g.getImageData(0, 0, fw, fh), p = id.data;
  for (let y = 0; y < fh; y++) {
    const stops = y < 44 ? M.top : y < 64 ? M.front : M.base;
    for (let x = 0; x < fw; x++) {
      const o = (y * fw + x) * 4;
      if (!p[o + 3]) continue;
      const l = (0.3 * p[o] + 0.59 * p[o + 1] + 0.11 * p[o + 2]) / 255;
      // the wood tile spans roughly 0.25–0.8 brightness: stretch it over the whole ramp
      const [r, gg, b] = ramp(stops, (l - 0.25) / 0.55);
      p[o] = r; p[o + 1] = gg; p[o + 2] = b;
    }
  }
  g.putImageData(id, 0, 0);
  if (M.sheen) {                                    // inox: brushed lines + a soft diagonal highlight
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = 3; y < 44; y += 6) g.fillRect(0, y, fw, 1);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = 4; x < fw; x += 9) g.fillRect(x, 48, 1, 16);
    g.fillStyle = 'rgba(40,50,58,0.5)';
    for (let x = 6; x < fw; x += 24) { g.fillRect(x, 66, 2, 2); g.fillRect(x, 76, 2, 2); }   // rivets
  }
  if (M.veins) {                                    // đá cẩm thạch: thin grey veins on the top
    g.strokeStyle = 'rgba(120,120,130,0.45)'; g.lineWidth = 1;
    for (const [x0, y0, x1, y1] of [[0, 8, 40, 30], [30, 2, 70, 20], [55, 26, 100, 12], [10, 38, 45, 22], [70, 40, 100, 30]]) {
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 6, (y0 + y1) / 2 - 5, x1, y1); g.stroke();
    }
  }
  if (M.trim) {                                     // gold / yellow trim along the lip and the base
    g.fillStyle = M.trim; g.fillRect(0, 44, fw, 2); g.fillRect(0, 63, fw, 1);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 44, fw, 1);
  }
  cache.set(key, c);
  return c;
}

/** Colours for the empty-spot placemats on the counter, per material. */
export const MATS = [
  { mat: '#8a5326', edge: '#5e3418', ring: 'rgba(255,240,210,0.55)' },
  { mat: '#9a6a3c', edge: '#6e4422', ring: 'rgba(255,244,220,0.6)' },
  { mat: '#f2c230', edge: '#b88a14', ring: 'rgba(255,255,255,0.7)' },
  { mat: '#3e4850', edge: '#262e34', ring: 'rgba(220,232,240,0.7)' },
  { mat: '#2b3d5e', edge: '#e6b84a', ring: 'rgba(255,230,160,0.8)' },
];
