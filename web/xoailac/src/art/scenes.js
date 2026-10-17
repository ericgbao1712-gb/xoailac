// Scenes + props (Art-B). Same API as the original stub (TECH_SPEC.md §2.3), real "pastel chibi pixel" art:
//   * 4 empty daytime backgrounds  -> assets/scenes/<id>.png        (data/scenes.js)
//   * every prop (tables, stoves, pots, kho, coolers, signs, deco, vehicles, coins…) -> assets/props.png (data/props.js)
//   * particles, tarp, string lights, rain, night/dusk lighting stay code-drawn
// The renderer draws into a buffer at DETAIL px per world px with integer world coordinates, so sprites blit 1:1.
// Everything is wrapped so that unknown ids / a missing atlas never throw (the frame just lacks that sprite).
import { PAL } from './palette.js';
import { drawIcon } from './icons.js';
import { loadAtlas, blit, frameCanvas, DETAIL } from './assets.js';
import PROPS from './data/props.js';
import SCENES from './data/scenes.js';
import { SEAT } from './layouts.js';

const hasDOM = typeof document !== 'undefined';
const U = 1 / DETAIL;                       // one sprite pixel in world units
const P = loadAtlas(PROPS.file);
const F = PROPS.frames;
const BG = {};
for (const id of Object.keys(SCENES)) BG[id] = loadAtlas(SCENES[id].file);   // main.js awaits artReady() before frame 1

let warned = false;
function guard(e) { if (!warned) { warned = true; console.warn('[art/scenes]', e); } }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lvl = (v) => (v | 0);
/** fillRect in sprite-pixel units (1 = half a world px). */
function R(ctx, x, y, w, h) { ctx.fillRect(x * U, y * U, w * U, h * U); }

/** Blit props.png frame `name` with its anchor at world (x, y). */
function put(ctx, name, x, y, flip = false, alpha = 1) {
  const f = F[name];
  return f ? blit(ctx, P, f, x, y, flip, alpha) : false;
}
/** Like put() but the sprite's TOP edge sits at world y (for things that hang or are fixed to a wall). */
function putTop(ctx, name, x, y, alpha = 1) {
  const f = F[name];
  return f ? blit(ctx, P, f, x, y + (f[5] - 1) * U, false, alpha) : false;
}

// ─────────────────────────────── backgrounds ───────────────────────────────
// The scene PNGs carry a baked, stretched margin around the painted art (data/scenes.js `art` rect). A phone shows much more
// than the core at the lower zoom levels, so that margin used to read as smeared streaks. Instead the painted art is
// continued sideways by mirror-tiling its outer band (the facade / pavement just repeats, seamlessly) and downwards by
// mirror-tiling the road; a soft dusk vignette fades the continuation so the real scene stays the focus.
const MARG = 320;                                    // sprite px of continuation on every side (= 160 world px)
const BAND_X = 44, BAND_Y = 40;                      // sprite px of the outer band that is mirrored
const bgExt = {};
/** Mirror-tile `band` px wide strips of c outwards: horizontal=true fills x < x0 (dir -1) or x > x1 (dir +1). */
function mirrorFill(g, c, horizontal, dir, edge, band, to, a0, a1) {
  // edge = coordinate of the first painted line next to the fill (inclusive); to = coordinate where filling stops
  // a0..a1 = the extent along the other axis
  const len = a1 - a0;
  g.save();
  for (let k = 0, pos = edge; dir < 0 ? pos > to : pos < to; k++) {
    const flipped = k % 2 === 0;
    // source band lies inside the art, starting at the edge
    const src = dir < 0 ? edge : edge - band + 1;
    const dst = dir < 0 ? pos - band : pos + 1;
    if (horizontal) {
      if (flipped) { g.setTransform(-1, 0, 0, 1, dst * 2 + band, 0); g.drawImage(c, src, a0, band, len, dst, a0, band, len); }
      else g.drawImage(c, src, a0, band, len, dst, a0, band, len);
    } else if (flipped) { g.setTransform(1, 0, 0, -1, 0, dst * 2 + band); g.drawImage(c, a0, src, len, band, a0, dst, len, band); }
    else g.drawImage(c, a0, src, len, band, a0, dst, len, band);
    g.setTransform(1, 0, 0, 1, 0, 0);
    pos += dir * band;
  }
  g.restore();
}
function bgFor(id) {
  let e = bgExt[id];
  if (e !== undefined) return e;
  const rec = BG[id], sc = SCENES[id];
  if (!rec || !rec.img || !sc || !hasDOM) return null;      // not decoded yet: do not cache
  try {
    const img = rec.img, iw = img.width, ih = img.height, M = MARG;
    const W = iw + 2 * M, H = ih + 2 * M;
    const c = canvas(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, M, M);
    const art = sc.art || [4, 4, iw - 5, ih - 5];
    const L = M + art[0], T = M + art[1], Rr = M + art[2], B = M + art[3];
    // 1) sides: mirror-tile the outer band of the painted art, over the PNG's baked margin and beyond it
    mirrorFill(g, c, true, -1, L, BAND_X, 0, M, M + ih);
    mirrorFill(g, c, true, +1, Rr, BAND_X, W, M, M + ih);
    // 2) below the art: mirror-tile the road across the full width
    mirrorFill(g, c, false, +1, B, BAND_Y, H, 0, W);
    // 3) above the PNG: stretch the (smooth sky) top row; the sides were already filled so the row is clean
    g.drawImage(c, 0, M, W, 1, 0, 0, W, M);
    // soft dusk vignette on the continuation only (fades in away from the painted art, never a visible seam)
    const fade = (x0, x1, y0, y1, flip) => {
      const gr = g.createLinearGradient(flip ? x1 : x0, 0, flip ? x0 : x1, 0);
      gr.addColorStop(0, 'rgba(70,56,110,0)'); gr.addColorStop(1, 'rgba(70,56,110,0.34)');
      g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    };
    const F2 = 64;                                                       // fade length in sprite px
    fade(L - F2, L, 0, H, true); g.fillStyle = 'rgba(70,56,110,0.34)'; g.fillRect(0, 0, L - F2, H);
    fade(Rr, Rr + F2, 0, H, false); g.fillStyle = 'rgba(70,56,110,0.34)'; g.fillRect(Rr + F2, 0, W - Rr - F2, H);
    e = { c, dx: sc.x - M * U, dy: sc.y - M * U };
  } catch (err) { guard(err); e = null; }
  bgExt[id] = e;
  return e;
}

// ─────────────────────────────── signs ───────────────────────────────
const signCache = new Map();
function signCanvas(level, wWorld) {
  const f = F['sign' + level];
  if (!f || !P.img || !hasDOM) return null;
  const key = level + '@' + wWorld;
  let c = signCache.get(key);
  if (c) return c;
  const [fx, fy, fw, fh] = f;
  const tw = Math.round(wWorld * DETAIL / 2) * 2;
  c = canvas(tw, fh);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const cap = level === 1 ? 24 : level === 4 ? 18 : 16;
  if (tw <= fw) {
    g.drawImage(P.img, fx, fy, fw, fh, 0, 0, tw, fh);
  } else {
    g.drawImage(P.img, fx, fy, cap, fh, 0, 0, cap, fh);
    g.drawImage(P.img, fx + fw - cap, fy, cap, fh, tw - cap, 0, cap, fh);
    const mw = fw - 2 * cap, sx = fx + cap;
    for (let x = cap; x < tw - cap; x += mw) g.drawImage(P.img, sx, fy, Math.min(mw, tw - cap - x), fh, x, 0, Math.min(mw, tw - cap - x), fh);
  }
  signCache.set(key, c);
  return c;
}
function signBox(L, level) {
  const sg = L.sign, f = F['sign' + level];
  if (!sg || !f) return null;
  const w = Math.round(sg.w + 8);
  const c = signCanvas(level, w);
  if (!c) return null;
  return { c, x: Math.round(sg.x - 4), y: Math.round(sg.y + sg.h / 2 - c.height * U / 2) };
}

// ─────────────────────────────── stools / tables ───────────────────────────────
const stoolOf = (style) => 'stool' + clamp(style | 0, 0, 4);
const tableOf = (style) => 'table' + clamp(style | 0, 0, 4);

/** The back seat's stool lives in the back layer (the guest and the table are drawn over it). */
function drawBackStools(ctx, L, env) {
  const st = stoolOf(env.up ? env.up.tablestyle : 0);
  for (const t of L.tables) put(ctx, st, t.x + SEAT[2].dx, t.y + SEAT[2].dy + 2);
}

function putCanvas(ctx, c, f, x, y, alpha = 1) {
  if (!c) return;
  const px = Math.round(x * DETAIL), py = Math.round(y * DETAIL);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(c, (px - f[4]) / DETAIL, (py - f[5]) / DETAIL, c.width / DETAIL, c.height / DETAIL);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// ─────────────────────────────── scene back / front ───────────────────────────────
export function drawSceneBack(ctx, tier, env, view) {
  try {
    const L = env.layout;
    if (!L) return;
    const sc = SCENES[L.scene];
    const e = bgFor(L.scene);
    ctx.fillStyle = (sc && sc.fill) || PAL.stone;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    if (e) ctx.drawImage(e.c, e.dx, e.dy, e.c.width * U, e.c.height * U);
    else { ctx.fillStyle = PAL.paper2; ctx.fillRect(0, 0, L.w, L.h); }
    const up = env.up || {}, dc = env.deco || {};
    // wall hangings (tường)
    if (dc.tuong && F[dc.tuong]) for (const s of (L.deco.tuong || [])) putTop(ctx, dc.tuong, s.x, s.y);
    // shop sign
    const sl = lvl(up.sign);
    if (sl >= 1) { const b = signBox(L, clamp(sl, 1, 4)); if (b) ctx.drawImage(b.c, b.x, b.y, b.c.width * U, b.c.height * U); }
    drawBackStools(ctx, L, env);
  } catch (e) { guard(e); }
}

// ── hanging lamps (den) ──
const DEN_STEP = { den_bong: 24, den_long_do: 26, den_hoian: 28, den_chum: 70 };
const DEN_KIND = { den_bong: ['den_bong'], den_long_do: ['den_long_do', 'den_cam'], den_hoian: ['den_hoian1', 'den_hoian2'], den_chum: ['den_chum1', 'den_chum2'] };
const denCache = { key: '', list: [] };
/** [{k, x, y, sway, glow}] for every hanging lamp of the equipped den + the string-light slots. */
function denItems(L, env) {
  const id = env.deco && env.deco.den;
  const tarp = env.tier === 1 && env.up && env.up.tarp && L.equip && L.equip.tarp;
  const key = L.scene + '|' + id + '|' + (tarp ? 1 : 0);
  if (denCache.key === key && denCache.layout === L) return denCache.list;
  const list = [];
  const slots = (L.deco && L.deco.den) || [];
  for (const s of slots) {
    const y = s.y + (tarp ? 10 : 0);
    if (id === 'den_day') { list.push({ string: true, x: s.x, y, w: s.w }); continue; }
    const kinds = DEN_KIND[id];
    if (!kinds) continue;
    const n = Math.max(1, Math.floor(s.w / (DEN_STEP[id] || 26))), sp = s.w / n;
    for (let i = 0; i < n; i++) list.push({ k: kinds[i % kinds.length], x: Math.round(s.x + sp * (i + 0.5)), y, sway: id !== 'den_bong', ph: i * 1.3 });
  }
  denCache.key = key; denCache.list = list; denCache.layout = L;
  return list;
}
const BULB_STEP = 13;
function stringY(it, x) { const u = (x - it.x) / it.w; return it.y + 5 * 4 * u * (1 - u); }
function drawString(ctx, it, t) {
  ctx.fillStyle = PAL.ink2;
  for (let sx = 0; sx <= it.w * DETAIL; sx++) { const x = it.x + sx * U; R(ctx, Math.round(x * DETAIL), Math.round(stringY(it, x) * DETAIL), 1, 1); }
  const n = Math.max(2, Math.floor(it.w / BULB_STEP));
  for (let i = 0; i <= n; i++) {
    const bx = Math.round(it.x + it.w * i / n);
    putTop(ctx, 'den_day', bx, stringY(it, bx));
  }
}
function stringBulbs(it) {
  const n = Math.max(2, Math.floor(it.w / BULB_STEP)), out = [];
  for (let i = 0; i <= n; i++) { const bx = Math.round(it.x + it.w * i / n); out.push({ x: bx, y: stringY(it, bx) + 4 }); }
  return out;
}

function drawTarp(ctx, t) {
  // sloping striped awning: stripes alternate coral / cream, scalloped hem, ink outline, soft shadow underneath
  const x0 = Math.round(t.x), w = Math.round(t.w), y0 = Math.round(t.y), H = 9;
  ctx.fillStyle = 'rgba(60,40,70,0.18)'; ctx.fillRect(x0 + 1, y0 + H + 1, w - 2, 3);
  for (let i = 0; i < w; i += 6) {
    const sw = Math.min(6, w - i), cx = i + sw / 2, col = (i / 6) % 2 === 0 ? PAL.coral : PAL.cream;
    ctx.fillStyle = col; ctx.fillRect(x0 + i, y0, sw, H);
    ctx.fillStyle = (i / 6) % 2 === 0 ? PAL.red : PAL.paper2; ctx.fillRect(x0 + i, y0 + H - 2, sw, 1);       // fold shadow
    ctx.fillStyle = col; ctx.fillRect(x0 + i + 1, y0 + H, sw - 2, 1); ctx.fillRect(x0 + i + 2, y0 + H + 1, sw - 4, 0.5);
    ctx.fillStyle = PAL.ink2; ctx.fillRect(x0 + i + 1, y0 + H + 1.5, sw - 2, 0.5); ctx.fillRect(x0 + i, y0 + H - 0.5, 1, 1.5);
    void cx;
  }
  ctx.fillStyle = PAL.ink2; ctx.fillRect(x0, y0 - 0.5, w, 0.5);
  ctx.fillStyle = PAL.cream; ctx.fillRect(x0, y0, w, 0.5);
}

/** The rain tarp pulled out over the dining area (vỉa hè). k = 0 rolled up … 1 fully out. */
export function drawCanopy(ctx, L, k, t) {
  try {
    const c = L && L.canopy;
    if (!c || k <= 0.01) return;
    const x0 = c.x0, x1 = c.x1, yT = c.yTop, yF = Math.round(yT + (c.yFront - yT) * k), W = x1 - x0, B = 8;
    // the sheet: translucent so the tables under it still read. v2.6.5: it fades in towards the hem (the part
    // overhead, near the camera, stays clear) so the sky and the shop sign are not striped over
    const FADE = 6, fadeH = Math.min(yF - yT, 24), ys = yF - fadeH;
    for (let f = 0; f < FADE; f++) {
      const a0 = ys + (fadeH * f) / FADE, a1 = ys + (fadeH * (f + 1)) / FADE;
      ctx.globalAlpha = 0.3 * (f + 1) / FADE;
      for (let i = 0; i < W; i += B) {
        ctx.fillStyle = (i / B) % 2 === 0 ? PAL.coral : PAL.cream;
        ctx.fillRect(x0 + i, a0, Math.min(B, W - i), a1 - a0);
      }
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PAL.ink2;
    ctx.fillRect(x0, ys, 0.5, yF - ys); ctx.fillRect(x1 - 0.5, ys, 0.5, yF - ys);
    // ripple: the sheet sags and flutters a little in the wind
    ctx.globalAlpha = 0.18;
    const ry = ys + ((t * 14) % Math.max(1, yF - ys));
    ctx.fillStyle = PAL.cream; ctx.fillRect(x0, Math.round(ry), W, 1);
    ctx.globalAlpha = 1;
    // front hem: solid scalloped stripe band
    for (let i = 0; i < W; i += B) {
      const sw = Math.min(B, W - i), col = (i / B) % 2 === 0 ? PAL.coral : PAL.cream;
      ctx.fillStyle = col; ctx.fillRect(x0 + i, yF, sw, 3);
      ctx.fillRect(x0 + i + 1, yF + 3, sw - 2, 1);
      ctx.fillStyle = PAL.ink2; ctx.fillRect(x0 + i + 1, yF + 4, sw - 2, 0.5); ctx.fillRect(x0 + i, yF + 2.5, 0.5, 1);
    }
    ctx.fillStyle = PAL.ink2; ctx.fillRect(x0, yF - 0.5, W, 0.5);
    // corner poles once it is (nearly) out
    if (k > 0.85) {
      ctx.globalAlpha = Math.min(1, (k - 0.85) / 0.15);
      for (const px of [x0 + 1, x1 - 2]) {
        ctx.fillStyle = PAL.ink2; ctx.fillRect(px - 0.5, yF + 3, 2, c.ground - yF - 3);
        ctx.fillStyle = '#c9c3cf'; ctx.fillRect(px, yF + 3, 1, c.ground - yF - 3);
      }
      ctx.globalAlpha = 1;
    }
  } catch (e) { guard(e); }
}

export function sceneDrawables(tier, env) {
  try {
    const L = env.layout;
    if (!L) return [];
    const up = env.up || {}, dc = env.deco || {};
    const key = [L.scene, tier, L.kitchen.stoves.length, lvl(up.kho), lvl(up.cooler), lvl(up.cooling), lvl(up.speaker), lvl(up.pos), dc.cay, dc.dacbiet].join('|');
    if (sceneDrawables.key === key && sceneDrawables.layout === L) return sceneDrawables.list;
    const sc = SCENES[L.scene] || {}, list = [], E = L.equip || {};
    // kitchen counters under every built stove
    L.kitchen.stoves.forEach((s, i) => {
      const k = (sc.counters || ['counter_a'])[i % (sc.counters || ['x']).length], yy = (s.sortY != null ? s.sortY : s.y + 12) - 0.5;
      list.push({ y: yy, draw: (ctx) => put(ctx, k, s.x, yy) });
    });
    // cashier desks (+ the POS terminal on top)
    for (const p of (L.props || [])) {
      if (p.id.indexOf('cashier_desk') < 0) continue;
      list.push({ y: p.y, draw: (ctx) => put(ctx, 'desk', p.x, p.y) });
      if (lvl(up.pos) >= 1 && E.pos) list.push({ y: p.y + 0.1, draw: (ctx) => put(ctx, 'pos', E.pos.x, E.pos.y) });
    }
    if (E.kho) { const k = 'kho' + clamp(lvl(up.kho), 0, 4); list.push({ y: E.kho.y, draw: (ctx) => put(ctx, k, E.kho.x, E.kho.y) }); }
    if (E.cooler && lvl(up.cooler) >= 1) { const k = 'cooler' + clamp(lvl(up.cooler) - 1, 0, 2); list.push({ y: E.cooler.y, draw: (ctx) => put(ctx, k, E.cooler.x, E.cooler.y) }); }
    if (E.cooling && lvl(up.cooling) === 1) list.push({ y: E.cooling.y, draw: (ctx) => put(ctx, 'fan', E.cooling.x, E.cooling.y) });
    // level 3: misting fans standing on the pavement
    if (lvl(up.cooling) >= 3 && sc.cool && F.mistfan) for (const m of (sc.cool.mist || [])) list.push({ y: m.y, draw: (ctx) => put(ctx, 'mistfan', m.x, m.y) });
    if (E.speaker && lvl(up.speaker) >= 1) { const k = lvl(up.speaker) >= 2 ? 'spk2' : 'spk1'; list.push({ y: E.speaker.y, draw: (ctx) => put(ctx, k, E.speaker.x, E.speaker.y) }); }
    // equipped plants / special items
    if (dc.cay && F[dc.cay]) for (const s of (L.deco.cay || [])) list.push({ y: s.y, draw: (ctx) => put(ctx, dc.cay, s.x, s.y) });
    if (dc.dacbiet && F[dc.dacbiet]) for (const s of (L.deco.dacbiet || [])) list.push({ y: s.y, draw: (ctx) => put(ctx, dc.dacbiet, s.x, s.y) });
    // static decor of the scene
    for (const p of (sc.props || [])) list.push({ y: p.y, draw: (ctx) => put(ctx, p.k, p.x, p.y) });
    sceneDrawables.key = key; sceneDrawables.layout = L; sceneDrawables.list = list;
    return list;
  } catch (e) { guard(e); return []; }
}

export function drawSceneFront(ctx, tier, env, view) {
  try {
    const L = env.layout;
    if (!L) return;
    const up = env.up || {}, sc = SCENES[L.scene] || {};
    if (tier === 1 && up.tarp && L.equip && L.equip.tarp) drawTarp(ctx, L.equip.tarp);
    for (const it of denItems(L, env)) {
      if (it.string) drawString(ctx, it, env.t);
      else putTop(ctx, it.k, it.x + (it.sway ? Math.round(Math.sin(env.t * 1.3 + it.ph) * 1) / 2 : 0), it.y);
    }
    // level 2+: big striped market umbrellas over the vendor carts (outdoor stall, no ceiling)
    if (lvl(up.cooling) >= 2 && sc.cool && F.umbrella) for (const c of sc.cool.ceil) putTop(ctx, 'umbrella', c.x, c.y);
  } catch (e) { guard(e); }
}

// ─────────────────────────────── table ───────────────────────────────
// side saucers of topping next to the serving (xoài lắc: muối tôm, sốt me, khô bò, khô mực, rau răm)
const PLATES = ['side_muoi', 'side_me', 'side_khobo', 'side_khomuc', 'side_rauram'];
const PLATE_POS = [[-8, -2], [8, -2], [-8, -8], [8, -8], [0, 0]];
const DRINK_POS = [[-10, -9], [10, -9], [-4, -10], [4, -10]];

export function drawTable(ctx, table, opts = {}) {
  try {
    const { x, y } = table, st = clamp(opts.style | 0, 0, 4);
    const sk = stoolOf(st);
    // left / right / front stools tuck in beside and under the table; the back one is in the back layer
    put(ctx, sk, x + SEAT[0].dx, y + SEAT[0].dy + 2);
    put(ctx, sk, x + SEAT[1].dx, y + SEAT[1].dy + 2);
    put(ctx, sk, x + SEAT[3].dx, y + SEAT[3].dy + 1);
    put(ctx, tableOf(st), x, y);
    const t = opts.t || 0;
    if (opts.dirty) {
      put(ctx, 'dirty_bowls', x - 5, y - 2); put(ctx, 'dirty_cup', x + 6, y - 4);
    } else {
      const n = Math.min(5, opts.plates | 0);
      for (let i = 0; i < n; i++) put(ctx, PLATES[i % PLATES.length], x + PLATE_POS[i][0], y + PLATE_POS[i][1]);
      const dn = Math.min(4, opts.drinks | 0);
      for (let i = 0; i < dn; i++) put(ctx, i % 2 ? 'bottle_orange' : 'cup_tea', x + DRINK_POS[i][0], y + DRINK_POS[i][1]);
    }
    if (opts.pot) {
      // the served xoài lắc: bag / cup / paper bowl / porcelain bowl / glass bowl by table style; nearly eaten past half
      const pf = opts.potFill == null ? 1 : opts.potFill;
      put(ctx, 'dish' + st + (pf > 0.5 ? '_t' : '_e'), x, y - 3);
      if (!opts.dirty && !opts.reserved) put(ctx, 'condiments', x + 9, y - 8);
    }
    if (opts.reserved) put(ctx, 'reserved', x, y - 3);
    if (opts.highlight && Math.floor(t * 3) % 2) {
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 0.5;
      ctx.strokeRect(x - 13.25, y - 13.75, 26.5, 20);
      ctx.strokeStyle = PAL.ink2; ctx.strokeRect(x - 13.75, y - 14.25, 27.5, 21);
    }
  } catch (e) { guard(e); }
}

/** Side table (counter view): the back stool first, then the table with its left/right/front stools. */
export function drawSideTable(ctx, t, opts = {}) {
  try {
    const st = clamp(opts.style | 0, 0, 4);
    put(ctx, stoolOf(st), t.x + SEAT[2].dx, t.y + SEAT[2].dy + 2);
  } catch (e) { guard(e); }
  drawTable(ctx, t, opts);
}

// ─────────────────────────────── prep station ───────────────────────────────
// Xoài lắc needs no cooking: each "stove" slot is a fruit prep station (basket + board → glass display case).
export function drawStove(ctx, stove, opts = {}) {
  try {
    const { x, y } = stove, ty = clamp(opts.type | 0, 0, 4), t = opts.t || 0;
    put(ctx, 'stove' + ty, x, y);
    const sf = F['stove' + ty];
    if (opts.pot && sf) {
      // the shaker cup on the counter: rattles side to side while it is being shaken, salt specks fly off,
      // then sits still with a twinkle once the portion is ready
      const top = y - (sf[5] / DETAIL) * 0.55, cx = x + 3;
      if (!opts.ready) {
        const ph = Math.floor(t * 12) % 4, dx = ph === 0 ? -1 : ph === 2 ? 1 : 0, dy = ph % 2 ? -0.5 : 0;
        put(ctx, 'dish1_t', cx + dx, top + dy);
        const cols = [PAL.coral, PAL.gold, PAL.cream];
        for (let i = 0; i < 4; i++) {
          const q = (t * 1.8 + i * 0.27) % 1, side = i % 2 ? 1 : -1;
          ctx.globalAlpha = clamp(1 - q, 0, 1);
          ctx.fillStyle = cols[i % 3];
          R(ctx, Math.round((cx + side * (3 + q * 5)) * DETAIL), Math.round((top - 11 - q * 3 + q * q * 6) * DETAIL), 1, 1);
        }
        ctx.globalAlpha = 1;
      } else {
        put(ctx, 'dish1_t', cx, top);
        if ((t * 1.3) % 1 < 0.35) {
          const sx = Math.round((cx + 3) * DETAIL), sy = Math.round((top - 10) * DETAIL);
          ctx.fillStyle = PAL.cream; R(ctx, sx - 1, sy, 3, 1); R(ctx, sx, sy - 1, 1, 3);
        }
      }
    }
    if (opts.highlight && Math.floor(t * 3) % 2) {
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 0.5;
      ctx.strokeRect(x - 11.25, y - 17.75, 22.5, 20);
      ctx.strokeStyle = PAL.ink2; ctx.strokeRect(x - 11.75, y - 18.25, 23.5, 21);
    }
  } catch (e) { guard(e); }
}

// ─────────────────────────────── steam, coins, bubble, particles ───────────────────────────────
export function drawSteam(ctx, x, y, t, intensity = 1) {
  const n = Math.max(1, Math.ceil(3 * clamp(intensity, 0, 1.2)));
  ctx.fillStyle = PAL.cream;
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.75 + i / n) % 1;
    const px = x - 3 + i * (6 / Math.max(1, n - 1)) * (n > 1 ? 1 : 0) + Math.sin(ph * 6 + i * 2) * 1.4;
    const s = ph < 0.25 ? 2 : ph < 0.7 ? 3 : 2;
    ctx.globalAlpha = clamp((1 - ph) * 0.75 * clamp(intensity, 0.2, 1), 0, 1);
    R(ctx, Math.round(px * DETAIL) - 1, Math.round((y - ph * 12) * DETAIL), s, s - 1);
    if (s === 3) R(ctx, Math.round(px * DETAIL), Math.round((y - ph * 12) * DETAIL) - 1, 1, 1);
  }
  ctx.globalAlpha = 1;
}

export function drawCoinPile(ctx, x, y, amount, t) {
  try {
    const k = amount < 150 ? 'coin_s' : amount < 400 ? 'coin_mid' : 'coin_l';
    put(ctx, k, x, y);
    const ph = (t * 1.1 + x * 0.13) % 1;
    if (ph < 0.3) {                                   // twinkle
      const sx = Math.round((x + 3) * DETAIL), sy = Math.round((y - 9) * DETAIL);
      ctx.fillStyle = PAL.cream;
      R(ctx, sx, sy, 1, 1);
      if (ph > 0.08 && ph < 0.22) { R(ctx, sx - 1, sy, 3, 1); R(ctx, sx, sy - 1, 1, 3); }
    }
  } catch (e) { guard(e); }
}

const BUB_LINE = '#4a2c22';
export function drawBubble(ctx, x, y, content = {}, opts = {}) {
  try {
    const t = opts.t || 0, pulse = !!opts.pulse;
    const bob = pulse ? (Math.floor(t * 6) % 2 ? 0 : -0.5) : 0;
    const W = 40, H = 42;                                           // sprite px
    const bx = Math.round((x - 10) * DETAIL), by = Math.round((y - 24 + bob) * DETAIL);
    const line = pulse && Math.floor(t * 4) % 2 ? PAL.red2 : BUB_LINE;
    // soft drop shadow
    ctx.fillStyle = 'rgba(42,27,45,0.18)'; R(ctx, bx + 2, by + 2, W - 4, H);
    // rounded silhouette in outline colour, cream body inset by one pixel
    ctx.fillStyle = line; R(ctx, bx + 1, by, W - 2, H); R(ctx, bx, by + 1, W, H - 2);
    ctx.fillStyle = PAL.cream; R(ctx, bx + 2, by + 1, W - 4, H - 2); R(ctx, bx + 1, by + 2, W - 2, H - 4);
    ctx.fillStyle = PAL.paper2; R(ctx, bx + 2, by + H - 4, W - 4, 3); R(ctx, bx + 1, by + H - 5, W - 2, 3);       // faint inner shading
    ctx.fillStyle = PAL.cream; R(ctx, bx + 3, by + 1, W - 6, 2);
    // tail
    const tx = Math.round(x * DETAIL) - 3;
    ctx.fillStyle = line; R(ctx, tx, by + H, 6, 1); R(ctx, tx + 1, by + H + 1, 4, 1); R(ctx, tx + 2, by + H + 2, 2, 1);
    ctx.fillStyle = PAL.cream; R(ctx, tx + 1, by + H - 1, 4, 1); R(ctx, tx + 2, by + H, 2, 1);
    if (content && content.icon) drawIcon(ctx, content.icon, (bx + 4) * U, (by + 3) * U, 1);
    if (opts.patience != null) {
      const p = clamp(opts.patience, 0, 1), col = p > 0.5 ? PAL.leaf : p > 0.25 ? PAL.gold : PAL.red;
      ctx.fillStyle = BUB_LINE; R(ctx, bx + 3, by + H - 8, W - 6, 5);
      ctx.fillStyle = PAL.stone1; R(ctx, bx + 4, by + H - 7, W - 8, 3);
      ctx.fillStyle = col; R(ctx, bx + 4, by + H - 7, Math.round((W - 8) * p), 3);
      ctx.fillStyle = 'rgba(255,250,240,0.55)'; R(ctx, bx + 4, by + H - 7, Math.round((W - 8) * p), 1);
    }
  } catch (e) { guard(e); }
}

const CONF = [PAL.red, PAL.gold, PAL.jade, PAL.pink, PAL.sky2, PAL.lime];
export function drawParticle(ctx, p) {
  try {
    const x = Math.round(p.x * DETAIL), y = Math.round(p.y * DETAIL), k = p.age != null && p.life ? p.age / p.life : 0;
    const fade = k > 0.7 ? clamp(1 - (k - 0.7) / 0.3, 0, 1) : 1;
    if (fade < 1) ctx.globalAlpha = fade;
    switch (p.kind) {
      case 'coin': {
        const spin = Math.floor((p.age || 0) * 14 + (p.seed || 0)) % 4;
        const w = spin === 0 ? 4 : spin === 2 ? 2 : 3;
        ctx.fillStyle = PAL.gold3; R(ctx, x - 1, y - 2, w + 1, 5);
        ctx.fillStyle = PAL.gold; R(ctx, x - 1 + 1, y - 1, w - 1, 3);
        ctx.fillStyle = PAL.gold1; R(ctx, x, y - 1, 1, 1);
        break;
      }
      case 'star':
        ctx.fillStyle = PAL.gold1; R(ctx, x - 1, y, 3, 1); R(ctx, x, y - 1, 1, 3);
        ctx.fillStyle = PAL.cream; R(ctx, x, y, 1, 1);
        break;
      case 'heart':
        ctx.fillStyle = PAL.red2; R(ctx, x - 2, y - 1, 5, 2); R(ctx, x - 1, y + 1, 3, 1); R(ctx, x, y + 2, 1, 1);
        ctx.fillStyle = PAL.pink; R(ctx, x - 2, y - 2, 2, 2); R(ctx, x + 1, y - 2, 2, 2); R(ctx, x - 1, y, 3, 1); R(ctx, x, y + 1, 1, 1);
        break;
      case 'confetti': ctx.fillStyle = CONF[(p.seed | 0) % CONF.length]; R(ctx, x, y, 2, (Math.floor((p.age || 0) * 9 + (p.seed || 0)) % 2) ? 1 : 3); break;
      case 'spark': ctx.fillStyle = PAL.cream; R(ctx, x, y, 1, 1); R(ctx, x - 1, y, 3, 1); R(ctx, x, y - 1, 1, 3); break;
      case 'smoke': {
        const s = 2 + Math.floor(k * 4);
        ctx.fillStyle = 'rgba(195,185,196,0.8)'; R(ctx, x - (s >> 1), y - (s >> 1), s, s);
        ctx.fillStyle = 'rgba(141,131,153,0.7)'; R(ctx, x - (s >> 1), y + (s >> 1) - 1, s, 1);
        break;
      }
      case 'leaf': ctx.fillStyle = PAL.lime; R(ctx, x, y, 3, 1); ctx.fillStyle = PAL.leaf; R(ctx, x + 1, y + 1, 2, 1); break;
      case 'drop': ctx.fillStyle = PAL.sky2; R(ctx, x, y, 1, 2); ctx.fillStyle = PAL.sky; R(ctx, x, y, 1, 1); break;
      default: ctx.fillStyle = PAL.cream; R(ctx, x, y, 2, 2); break;
    }
    if (fade < 1) ctx.globalAlpha = 1;
  } catch (e) { ctx.globalAlpha = 1; guard(e); }
}

// ─────────────────────────────── vehicles ───────────────────────────────
export function drawVehicle(ctx, kind, x, y, dir = 1, t = 0) {
  try {
    const key = F[kind] ? kind : 'xemay', f = F[key];
    if (!f) return;
    const hw = f[2] * U * 0.38;
    ctx.fillStyle = 'rgba(42,27,45,0.25)';
    R(ctx, Math.round((x - hw) * DETAIL), Math.round(y * DETAIL) - 1, Math.round(hw * 2 * DETAIL), 2);
    const bob = (kind === 'xedap' || kind === 'xebanhmi') ? 0 : (Math.floor(t * 9) % 2 ? 0 : -U);
    put(ctx, key, x, y + bob, dir < 0);
  } catch (e) { guard(e); }
}

// ─────────────────────────────── weather ───────────────────────────────
const TILE = 64;                                // world px, = 128 sprite px
const rainTiles = [];
function rainTile(i) {
  if (rainTiles[i] || !hasDOM) return rainTiles[i];
  const S = TILE * DETAIL, c = canvas(S, S), g = c.getContext('2d');
  let seed = 1234 + i * 977;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const n = i === 0 ? 34 : 22;
  for (let k = 0; k < n; k++) {
    const sx = Math.floor(rnd() * S), sy = Math.floor(rnd() * S), len = (i === 0 ? 9 : 6) + Math.floor(rnd() * 4);
    for (let j = 0; j < len; j++) {
      const px = (sx + Math.floor(j / 3)) % S, py = (sy + j) % S;
      g.fillStyle = j > len - 3 ? 'rgba(214,236,255,0.95)' : i === 0 ? 'rgba(190,222,250,0.7)' : 'rgba(190,222,250,0.45)';
      g.fillRect(px, py, 1, 1);
    }
  }
  rainTiles[i] = c;
  return c;
}
export function drawWeather(ctx, view, weather, t, hole, maxY) {
  let clipped = false;
  try {
    if (weather !== 'rain' && weather !== 'storm') return;
    // v2.6.5: `maxY` = where the vendor's own roof starts (the counter top): no rain falls on the counter
    const yEnd = maxY == null ? view.y1 : Math.min(view.y1, maxY);
    if (hole || maxY != null) {                        // no rain under the tarp / over the counter
      ctx.save(); clipped = true;
      ctx.beginPath();
      ctx.rect(view.x0, view.y0, view.x1 - view.x0, yEnd - view.y0);
      if (hole) {                                      // the hole is cut only inside the rainy area (even-odd would add rain outside it)
        const hx0 = Math.max(view.x0, hole.x0), hx1 = Math.min(view.x1, hole.x1), hy0 = Math.max(view.y0, hole.y0), hy1 = Math.min(yEnd, hole.y1);
        if (hx1 > hx0 && hy1 > hy0) ctx.rect(hx0, hy0, hx1 - hx0, hy1 - hy0);
      }
      ctx.clip('evenodd');
    }
    const layers = weather === 'storm' ? [[0, 230, 70], [1, 140, 40], [0, 180, -50]] : [[0, 200, 60], [1, 120, 36]];
    for (const [ti, sp, dr] of layers) {
      const c = rainTile(ti);
      if (!c) continue;
      const oy = Math.floor((t * sp) % TILE), ox = Math.floor((t * dr * 0.3) % TILE);
      const x0 = Math.floor(view.x0 / TILE) * TILE + ox - TILE, y0 = Math.floor(view.y0 / TILE) * TILE + oy - TILE;
      for (let yy = y0; yy < yEnd; yy += TILE) for (let xx = x0; xx < view.x1; xx += TILE) ctx.drawImage(c, xx, yy, TILE, TILE);
    }
  } catch (e) { guard(e); } finally { if (clipped) ctx.restore(); }
}

// ─────────────────────────────── lighting (dusk / night / rain) ───────────────────────────────
const lerpC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const WHITE = [255, 255, 255], DUSK = [255, 196, 164], NIGHT = [124, 136, 206], RAIN = [198, 208, 228];
function nightK(clock) {
  const h = (((clock % 1440) + 1440) % 1440) / 60;
  if (h >= 19.5 || h < 5.5) return 1;
  if (h >= 17.5) return sstep(17.5, 19.5, h);
  if (h >= 5.5 && h < 6.8) return 1 - sstep(5.5, 6.8, h);
  return 0;
}
function duskK(clock) {
  const h = (((clock % 1440) + 1440) % 1440) / 60;
  if (h < 15.8 || h > 19.2) return 0;
  return Math.sin(Math.PI * clamp((h - 15.8) / 3.4, 0, 1));
}
const poolCache = new Map();
/** Stepped (posterised) disc of warm / cool light, r in world px. */
function poolCanvas(r, kind) {
  const key = r + kind;
  let c = poolCache.get(key);
  if (c || !hasDOM) return c;
  const R_ = Math.round(r * DETAIL), c2 = canvas(R_ * 2 + 2, R_ * 2 + 2), g = c2.getContext('2d');
  const col = kind === 'cool' ? '130,176,255' : '255,178,100';
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const ri = Math.round(R_ * (1 - i / steps));
    g.fillStyle = `rgba(${col},0.075)`;
    for (let y = -ri; y <= ri; y++) { const half = Math.floor(Math.sqrt(ri * ri - y * y)); g.fillRect(R_ + 1 - half, R_ + 1 + y, half * 2 + 1, 1); }
  }
  poolCache.set(key, c2);
  return c2;
}
function pool(ctx, x, y, r, kind, a) {
  const c = poolCanvas(r, kind);
  if (!c || a <= 0.01) return;
  ctx.globalAlpha = a;
  ctx.drawImage(c, Math.round(x - r - U), Math.round(y - r - U), c.width * U, c.height * U);
}

export function drawLighting(ctx, view, env) {
  try {
    const clock = env.clock == null ? 600 : env.clock;
    const k = nightK(clock), d = duskK(clock) * (1 - k);
    const wet = env.weather === 'rain' ? 0.55 : env.weather === 'storm' ? 0.85 : env.weather === 'cloud' ? 0.28 : 0;
    if (k < 0.01 && d < 0.01 && !wet) return;
    let col = lerpC(WHITE, DUSK, d * 0.8);
    col = lerpC(col, NIGHT, k);
    if (wet) col = lerpC(col, [col[0] * RAIN[0] / 255, col[1] * RAIN[1] / 255, col[2] * RAIN[2] / 255], wet * (1 - 0.4 * k));
    const W = view.x1 - view.x0, H = view.y1 - view.y0;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
    ctx.fillRect(view.x0, view.y0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    if (k > 0.02) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(118,94,200,${(0.1 * k).toFixed(3)})`;
      ctx.fillRect(view.x0, view.y0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const L = env.layout, sc = L && SCENES[L.scene], t = env.t || 0;
      if (L && sc) {
        for (const l of sc.lights) pool(ctx, l.x, l.y, l.r, l.c, k * (0.9 + 0.1 * Math.sin(t * 1.7 + l.x)));
        for (const it of denItems(L, env)) {
          if (it.string) for (const b of stringBulbs(it)) pool(ctx, b.x, b.y, 13, 'warm', k * (0.8 + 0.2 * Math.sin(t * 3 + b.x)));
          else pool(ctx, it.x, it.y + 12, env.deco.den === 'den_chum' ? 26 : 17, 'warm', k * 0.95);
        }
        const sl = env.up ? lvl(env.up.sign) : 0, sg = L.sign;
        if (sl >= 2 && sg) pool(ctx, sg.x + sg.w / 2, sg.y + sg.h / 2 + 2, Math.min(60, sg.w * 0.42 + 6), sl >= 3 ? 'cool' : 'warm', k * (sl >= 3 ? 1 : 0.7));
        if (env.up && lvl(env.up.speaker) && L.equip.speaker) pool(ctx, L.equip.speaker.x, L.equip.speaker.y - 8, 10, 'cool', k * 0.5);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  } catch (e) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; guard(e); }
}

// ─────────────────────────────── DOM thumbnails ───────────────────────────────
const urlCache = new Map();
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** 24×24 sprite px icon (× scale) of a DECO item, as a data URL for <img> (use image-rendering: pixelated). */
export function decoIconURL(decoId, scale = 3) {
  try {
    const sc = Math.max(1, Math.round(scale) || 1), key = decoId + '@' + sc;
    let url = urlCache.get(key);
    if (url) return url;
    if (!hasDOM) return BLANK;
    const f = F['ico_' + decoId];
    if (f && !P.img) return BLANK;                              // atlas not decoded yet: do not cache the blank
    let c;
    if (f) c = frameCanvas(P, f, sc);
    else {                                                       // "nothing equipped" glyph: ring with a slash
      c = canvas(24 * sc, 24 * sc);
      const g = c.getContext('2d');
      g.scale(sc, sc);
      g.fillStyle = PAL.stone1;
      for (let a = 0; a < 64; a++) { const an = a / 64 * Math.PI * 2; g.fillRect(Math.round(12 + Math.cos(an) * 8), Math.round(12 + Math.sin(an) * 8), 1, 1); g.fillRect(Math.round(12 + Math.cos(an) * 7.2), Math.round(12 + Math.sin(an) * 7.2), 1, 1); }
      for (let i = -5; i <= 5; i++) g.fillRect(12 + i, 12 + i, 1, 1);
    }
    url = c ? c.toDataURL() : BLANK;
    urlCache.set(key, url);
    return url;
  } catch (e) { return BLANK; }
}

/** Small daytime render (96×64 × scale) of the shop front for a tier's card. */
export function sceneThumbURL(tier, scale = 1) {
  try {
    const sc = Math.max(1, Math.round(scale) || 1), key = 'thumb:' + tier + '@' + sc;
    let url = urlCache.get(key);
    if (url) return url;
    if (!hasDOM) return BLANK;
    const id = tier >= 4 ? 'haitang' : tier === 3 ? 'mapho' : tier === 2 ? 'hem' : 'vihe';
    const rec = BG[id], s = SCENES[id];
    if (!rec || !rec.img || !s) return BLANK;
    const c = canvas(96 * sc, 64 * sc), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const [tx, ty, tw, th] = s.thumb;
    g.drawImage(rec.img, (tx - s.x) * DETAIL, (ty - s.y) * DETAIL, tw * DETAIL, th * DETAIL, 0, 0, c.width, c.height);
    url = c.toDataURL();
    urlCache.set(key, url);
    return url;
  } catch (e) { return BLANK; }
}
