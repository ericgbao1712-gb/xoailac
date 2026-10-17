// Characters (TECH_SPEC §2.2, ART_PIPELINE.md): sprite-sheet based people. Every character is one 4×4 pose sheet
// (idle/walk/cheer, side, back, act, carry, sit ×3, angry) sliced to 2× detail sprites by tools/art/build.py and
// packed into assets/chars.png (frame table: src/art/data/chars.js, keys "<sheet>/<pose>", "carry/<item>").
// Look = plain JSON {kind, sheet, ...} (staff looks are saved in the game state). Never throws; unknown ids → idle.
import { loadAtlas, blit, DETAIL } from './assets.js';
import CHARS from './data/chars.js';
import { SIT_LIFT } from './layouts.js';

export const CHAR_W = 16, CHAR_H = 24;

const rec = loadAtlas(CHARS.file);
const FR = CHARS.frames;

// ───────────────────────── sheet tables ─────────────────────────
const POSES = ['idle_d', 'walk_d1', 'walk_d2', 'cheer_d', 'idle_r', 'walk_r1', 'walk_r2', 'act_r',
  'idle_u', 'walk_u1', 'walk_u2', 'carry_d', 'sit_d', 'sit_r', 'sit_u', 'angry_d'];

/** sheet name → { pose: frame } for the sheets that exist in the atlas. */
const SPR = Object.create(null);
for (const key of Object.keys(FR)) {
  const i = key.indexOf('/');
  const sheet = key.slice(0, i), pose = key.slice(i + 1);
  (SPR[sheet] || (SPR[sheet] = Object.create(null)))[pose] = FR[key];
}
const has = (sheet) => !!(SPR[sheet] && SPR[sheet].idle_d);

const OWNER_SHEETS = ['owner0', 'owner1', 'owner2', 'owner3'];
const STAFF_SHEETS = {
  phucvu: ['staff_phucvu_f', 'staff_phucvu_m'],
  daubep: ['staff_daubep_f', 'staff_daubep_m'],
  thungan: ['staff_thungan'],
  quankho: ['staff_quankho'],
};
const KIND_SHEETS = {
  sinhvien: ['cust_sinhvien_m', 'cust_sinhvien_f'],
  vanphong: ['cust_vanphong_m', 'cust_vanphong_f'],
  giadinh: ['cust_giadinh_dad', 'cust_giadinh_mom', 'cust_giadinh_kid'],      // by memberIdx: dad, mom, kid(s)
  capdoi: ['cust_capdoi_m', 'cust_capdoi_f'],                                  // by memberIdx: him, her (long hair)
  hoiban: ['cust_hoiban_a', 'cust_hoiban_b'],                                  // matching club tees, alternate
  chutu: ['cust_chutu'],
  khachtay: ['cust_khachtay_m', 'cust_khachtay_f'],
  reviewer: ['cust_reviewer'],
  tiktoker: ['cust_tiktoker'],
  doandulich: ['cust_doandulich_leader', 'cust_doandulich_member'],           // member 0 = flag leader, others = caps
  shipper: ['cust_shipper'],
  veso: ['cust_veso'],
  pedestrian: ['cust_ped_a', 'cust_ped_b'],
};

function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; }

/** First sheet of `list` (starting at preferred index, wrapping) that exists in the atlas, else a generic fallback. */
function firstExisting(list, pref = 0) {
  for (let k = 0; k < list.length; k++) {
    const s = list[(pref + k) % list.length];
    if (has(s)) return s;
  }
  for (const s of OWNER_SHEETS.concat(['cust_ped_a', 'cust_ped_b'], Object.keys(SPR))) if (has(s)) return s;
  return list[0];
}

// ───────────────────────── looks ─────────────────────────
export function makeLook(kind, seed = 1, memberIdx = 0) {
  kind = KIND_SHEETS[kind] ? kind : 'pedestrian';
  seed = (seed | 0) || 1; memberIdx = memberIdx | 0;
  const list = KIND_SHEETS[kind];
  // v2.6.4: one hash per GROUP (seed), members walk through the kind's sheets in turn, so a pair is always
  // one of each (nam + nữ, hội bạn a + b) instead of two random picks that often matched
  const h = hash(seed * 31 + 7);
  let pick;
  if (kind === 'giadinh') pick = Math.min(Math.max(memberIdx, 0), 2);
  else if (kind === 'capdoi') pick = memberIdx & 1;
  else if (kind === 'doandulich') pick = memberIdx === 0 ? 0 : 1;
  else pick = (h + memberIdx) % list.length;
  const look = { kind, sheet: firstExisting(list, pick), seed, memberIdx };
  // clothes colour: one of CUST_VARIANTS per person (0 = as painted), different for each member of a group
  if (!KEEP_COLOURS.has(look.sheet)) look.variant = (hash(seed * 13 + 5) + (kind === 'hoiban' ? 0 : memberIdx)) % CUST_VARIANTS.length;   // hội bạn: same club tee colour
  if (kind === 'giadinh' && memberIdx >= 2) look.kid = true;
  return look;
}

export function makeOwnerLook(avatar = 0, tier = 1) {
  const a = ((avatar | 0) % 4 + 4) % 4;
  return { kind: 'owner', sheet: firstExisting([OWNER_SHEETS[a]]), avatar: a, tier: tier | 0 };
}

export function makeStaffLook(role, seed = 1) {
  const r = STAFF_SHEETS[role] ? role : 'phucvu';
  seed = (seed | 0) || 1;
  const h = hash(seed * 17 + r.length);
  return { kind: r, role: r, sheet: firstExisting(STAFF_SHEETS[r], h & 1), seed };
}

const sheetCache = new WeakMap();
/** Sheet name for any look-like object (also repairs looks saved without a sheet, e.g. {lookSeed}). */
function sheetOf(look) {
  if (!look || typeof look !== 'object') return firstExisting(KIND_SHEETS.pedestrian);
  if (look.sheet && has(look.sheet)) return look.sheet;
  let s = sheetCache.get(look);
  if (s) return s;
  const seed = look.seed ?? look.lookSeed ?? 1;
  if (look.kind === 'owner') s = makeOwnerLook(look.avatar | 0, look.tier | 0).sheet;
  else if (STAFF_SHEETS[look.kind]) s = makeStaffLook(look.kind, seed).sheet;
  else if (KIND_SHEETS[look.kind]) s = makeLook(look.kind, seed, look.memberIdx | 0).sheet;
  else s = makeStaffLook('phucvu', seed).sheet;          // kind-less record such as {lookSeed}: treat as a waiter
  sheetCache.set(look, s);
  return s;
}

// ───────────────────────── đồng phục (v2.3, Lv 21) ─────────────────────────
// Staff sheets are recoloured once per choice into a copy of the atlas: saturated red/orange cloth below the head
// (apron, vest, neckerchief, bow; the stock-keeper's green cap too) → the chosen colour, and for some styles the
// white shirt → a pale tint or charcoal. Skin, hair and faces stay untouched (head rows and low-chroma tones skip).
import * as CFG from '../config.js';
let uniKey = '', uniRec = null;
function rgb2hsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb(h, s, l) {
  if (!s) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
function buildUniform(color, style) {
  const c = document.createElement('canvas');
  c.width = rec.img.width; c.height = rec.img.height;
  const g = c.getContext('2d');
  g.drawImage(rec.img, 0, 0);
  const tgt = color ? rgb2hsl(...hexRgb(color)) : null;
  const shirtH = rgb2hsl(...hexRgb(color || '#d9473a'));
  for (const key of Object.keys(FR)) {
    if (key.indexOf('staff_') !== 0) continue;
    const [fx, fy, fw, fh] = FR[key];
    const id = g.getImageData(fx, fy, fw, fh), p = id.data;
    let t0 = -1, b1 = -1;
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) if (p[(j * fw + i) * 4 + 3]) { if (t0 < 0) t0 = j; b1 = j; }
    if (t0 < 0) continue;
    const cut = t0 + 25, foot = b1 - 4, cap = key.indexOf('staff_quankho') === 0;
    for (let j = 0; j < foot; j++) for (let i = 0; i < fw; i++) {
      const o = (j * fw + i) * 4;
      if (!p[o + 3]) continue;
      const r = p[o] / 255, gg = p[o + 1] / 255, b = p[o + 2] / 255;
      const [H, S, L] = rgb2hsl(r, gg, b), hd = H * 360, ch = Math.max(r, gg, b) - Math.min(r, gg, b);
      let accent = j > cut && S > 0.45 && L >= 0.12 && L <= 0.62 && (hd <= 45 || hd >= 335) && ch > 0.25;
      if (cap && hd >= 60 && hd <= 110 && S > 0.2 && ch > 0.12) accent = true;
      const shirt = !accent && j > cut && ch < 0.12 && Math.max(r, gg, b) > 0.55;
      let out = null;
      if (accent && tgt) out = hsl2rgb(tgt[0], tgt[1], cl(tgt[2] + (L - 0.5), 0.05, 0.95));
      else if (shirt && style === 'aothun') out = hsl2rgb(shirtH[0], shirtH[1] * 0.6, cl(0.84 + (L - 0.93), 0.3, 0.97));
      else if (shirt && style === 'aotoi') out = hsl2rgb(0.72, 0.1, cl(0.26 + (L - 0.93) * 0.8, 0.08, 0.6));
      if (out) { p[o] = out[0] * 255; p[o + 1] = out[1] * 255; p[o + 2] = out[2] * 255; }
    }
    g.putImageData(id, fx, fy);
  }
  return { img: c, flipped: null, file: 'chars:uniform' };
}
/** Pick the staff uniform (state.uniform, or null = original sprites). Cheap to call every frame. */
export function setUniform(u) {
  const col = u && (CFG.UNIFORM.colors.find((x) => x.id === u.color) || {}).hex || null;
  const style = u && u.style !== 'tapde' ? u.style : 'tapde';
  const key = col || style !== 'tapde' ? (col || '-') + '/' + style : '';
  if (key === uniKey && (uniRec || !key)) return;
  if (key && (!rec.img || typeof document === 'undefined')) return;          // atlas not ready: retry next call
  uniKey = key;
  try { uniRec = key ? buildUniform(col, style) : null; } catch (e) { uniRec = null; }
}
const recFor = (sheet) => (uniRec && sheet.indexOf('staff_') === 0 ? uniRec : rec);

// ───────────────────────── customer clothes colours (v2.6.4) ─────────────────────────
// Each customer sheet exists in 4 colourings: the clothes below the neck are hue-shifted; skin, hair (dark browns
// and auburns), whites, greys and blacks stay as painted. Characters with a signature look keep their colours.
const CUST_VARIANTS = [0, 0.33, 0.58, 0.82];
const KEEP_COLOURS = new Set(['cust_khachtay_f', 'cust_tiktoker', 'cust_reviewer', 'cust_chutu', 'cust_veso', 'cust_shipper', 'cust_doandulich_leader']);
const custRecs = [];
function buildCustVariant(shift) {
  const c = document.createElement('canvas');
  c.width = rec.img.width; c.height = rec.img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(rec.img, 0, 0);
  for (const key of Object.keys(FR)) {
    const sheet = key.slice(0, key.indexOf('/'));
    if (sheet.indexOf('cust_') !== 0 || KEEP_COLOURS.has(sheet)) continue;
    const [fx, fy, fw, fh] = FR[key];
    const id = g.getImageData(fx, fy, fw, fh), p = id.data;
    let t0 = -1, b1 = -1;
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) if (p[(j * fw + i) * 4 + 3]) { if (t0 < 0) t0 = j; b1 = j; }
    if (t0 < 0) continue;
    const cut = t0 + Math.round(0.5 * (b1 - t0));          // the neck, for adults and kids alike
    for (let j = cut; j <= b1; j++) for (let i = 0; i < fw; i++) {
      const o = (j * fw + i) * 4;
      if (!p[o + 3]) continue;
      const r = p[o] / 255, gg = p[o + 1] / 255, b = p[o + 2] / 255;
      const [H, S, L] = rgb2hsl(r, gg, b), hd = H * 360, ch = Math.max(r, gg, b) - Math.min(r, gg, b);
      const skin = hd >= 8 && hd <= 42 && L > 0.5 && S > 0.3 && ch < 0.45;
      const hair = hd >= 5 && hd <= 45 && L < 0.45;
      if (S < 0.28 || ch < 0.16 || L < 0.14 || L > 0.9 || skin || hair) continue;
      const out = hsl2rgb((H + shift) % 1, S, L);
      p[o] = out[0] * 255; p[o + 1] = out[1] * 255; p[o + 2] = out[2] * 255;
    }
    g.putImageData(id, fx, fy);
  }
  return { img: c, flipped: null, file: 'chars:cust' + shift };
}
function recForLook(sheet, look) {
  const v = look && look.variant | 0;
  if (!v || sheet.indexOf('cust_') !== 0 || KEEP_COLOURS.has(sheet)) return recFor(sheet);
  if (!custRecs[v] && rec.img && typeof document !== 'undefined') { try { custRecs[v] = buildCustVariant(CUST_VARIANTS[v]); } catch (e) { custRecs[v] = rec; } }
  return custRecs[v] || rec;
}

// ───────────────────────── drawing ─────────────────────────
const SHADOW = 'rgba(42,27,45,0.24)';
const ITEM_NAMES = { pot: 1, tray: 1, drinks: 1, coins: 1, box: 1, notebook: 1 };
// carried item centre relative to the feet anchor (world px): [dx (× facing sign), dy]
const ITEM_AT = { down: [0, -4.5], side: [4, -5.5], up: [0, -8] };

let flashCache = null;   // key → tinted canvas (created lazily: art modules never touch the DOM at import)
function tinted(f, flip, key) {
  if (!flashCache) flashCache = new Map();
  const k = key + (flip ? '<' : '>');
  let c = flashCache.get(k);
  if (c) return c;
  if (typeof document === 'undefined' || !rec.img) return null;
  c = document.createElement('canvas');
  c.width = f[2]; c.height = f[3];
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(rec.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(226,67,59,0.34)';
  g.fillRect(0, 0, c.width, c.height);
  flashCache.set(k, c);
  return c;
}

function drawTinted(ctx, c, f, x, y, flip) {
  const [, , fw, fh, ax, ay] = f;
  const px = Math.round(x * DETAIL), py = Math.round(y * DETAIL);
  ctx.drawImage(c, 0, 0, fw, fh, (px - (flip ? fw - ax : ax)) / DETAIL, (py - ay) / DETAIL, fw / DETAIL, fh / DETAIL);
}

function shadow(ctx, x, y, kid) {
  const w = kid ? 9 : 11;                       // world px; drawn in half-pixel rows so it reads as a flat ellipse
  ctx.fillStyle = SHADOW;
  ctx.fillRect(x - w / 2 + 1.5, y - 0.5, w - 3, 0.5);
  ctx.fillRect(x - w / 2, y, w, 0.5);
  ctx.fillRect(x - w / 2 + 1.5, y + 0.5, w - 3, 0.5);
}

function placeholder(ctx, x, y) {
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 12, 2, 2);
}

const q = (v) => Math.round(v * DETAIL) / DETAIL;       // snap to the 2× buffer grid

export function drawChar(ctx, look, x, y, opts) {
  try { draw(ctx, look, x, y, opts || {}); } catch (e) { /* art must never throw */ }
}

function draw(ctx, look, x, y, o) {
  if (!rec.img) return;                                  // atlas still loading: draw nothing
  const sheet = sheetOf(look), spr = SPR[sheet];
  if (!spr) { placeholder(ctx, x, y); return; }
  const pose = o.pose || 'idle', facing = o.facing || 'down', t = +o.t || 0;
  const alpha = o.alpha == null ? 1 : o.alpha;
  let carry = o.carry && ITEM_NAMES[o.carry] ? o.carry : null;
  const side = facing === 'left' || facing === 'right';
  const dir = facing === 'up' ? 'u' : side ? 'r' : 'd';
  let flip = facing === 'left';
  let name = 'idle_' + dir, dx = 0, dy = 0;
  let standing = true, flash = false;

  switch (pose) {
    case 'walk': {
      const step = Math.floor(t * 8) % 4;
      name = step % 2 === 0 ? `walk_${dir}${step === 0 ? 1 : 2}` : 'idle_' + dir;
      break;
    }
    case 'sit': case 'eat': {
      name = 'sit_' + dir; standing = false; carry = null;
      dy = -SIT_LIFT;                                                   // perched on the stool, not on the ground
      if (pose === 'eat' && Math.floor(t / 0.25) % 2) dy -= 0.5;       // chopstick bob
      break;
    }
    case 'cook': name = 'act_r'; flip = facing === 'left'; carry = null; dx = (Math.floor(t * 6) % 2) * 0.5; break;
    case 'cheer': name = 'cheer_d'; flip = false; carry = null; dy = -q(Math.abs(Math.sin(t * 9)) * 2); break;
    case 'angry': {
      name = 'angry_d'; flip = false; carry = null;
      dx = (Math.floor(t * 16) % 2 ? 0.5 : -0.5);                        // ±1 buffer px shake
      flash = Math.floor(t * 8) % 2 === 0;
      break;
    }
    case 'write': name = 'carry_d'; flip = false; if (!carry) carry = 'notebook'; break;
    default: // idle (and unknown poses)
      if (Math.floor(t / 0.7) % 2) dy = 0.5;                             // breathing, 1 buffer px
  }
  // carrying while facing the camera: arms-at-chest pose, with a small step bob when walking
  if (carry && facing === 'down' && (pose === 'idle' || pose === 'walk' || pose === 'write') && spr.carry_d) {
    name = 'carry_d';
    if (pose === 'walk' && Math.floor(t * 8) % 2) dy = -0.5;
  }
  const f = spr[name] || spr.idle_d;
  if (!f) { placeholder(ctx, x, y); return; }
  const kid = !!(look && look.kid);
  const bx = x + dx, by = y + dy;

  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (standing) shadow(ctx, x, y, kid);
  const it = carry ? FR['carry/' + carry] : null;
  const sg = side ? (flip ? -1 : 1) : 1;
  const ip = facing === 'up' ? ITEM_AT.up : side ? ITEM_AT.side : ITEM_AT.down;
  const ix = bx + ip[0] * sg, iy = by + ip[1];
  if (it && facing === 'up') blit(ctx, rec, it, ix, iy + 1.5, false, 1);
  let drawn = false;
  if (flash) {
    const c = tinted(f, flip, sheet + '/' + (spr[name] ? name : 'idle_d'));
    if (c) { drawTinted(ctx, c, f, bx, by, flip); drawn = true; }
  }
  if (!drawn) blit(ctx, recForLook(sheet, look), f, bx, by, flip, 1);
  if (it && facing !== 'up') blit(ctx, rec, it, ix, iy, false, 1);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// ───────────────────────── portraits ─────────────────────────
const urlCache = new Map();
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Head-and-shoulders crop (32×32 sprite px = 16×16 world px) of idle_d, scaled to 16×scale px. Cached. */
export function portraitURL(look, scale = 4) {
  try {
    if (!rec.img || typeof document === 'undefined') return BLANK;      // not cached: art not loaded yet
    const sheet = sheetOf(look);
    const key = sheet + '@' + scale + (sheet.indexOf('staff_') === 0 ? '#' + uniKey : '');
    let url = urlCache.get(key);
    if (url) return url;
    const f = (SPR[sheet] || {}).idle_d;
    if (!f) return BLANK;
    const base = document.createElement('canvas');
    base.width = base.height = 32;
    const bg = base.getContext('2d');
    bg.imageSmoothingEnabled = false;
    // centre the head on the crop; take the top 32 rows (hair/hat, face, shoulders)
    bg.drawImage(recFor(sheet).img, f[0], f[1], f[2], f[3], 16 - f[4], 1, f[2], f[3]);
    const size = Math.max(16, Math.round(16 * scale));
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, 32, 32, 0, 0, size, size);
    url = c.toDataURL();
    urlCache.set(key, url);
    return url;
  } catch (e) { return BLANK; }
}
