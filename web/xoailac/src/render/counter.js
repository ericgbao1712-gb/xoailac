// Counter-view renderer ("quầy gánh", seen from the vendor's side). Same API as the old top-down renderer
// (render / resize / pick / worldToClient / focus / onTap …) so the UI does not care which one runs.
// The player stands behind the counter: a front-view street backdrop, passers-by, the queue on the pavement
// (drawn ×1), customers stepping up to the counter (growing to ×2 as they come closer), the wooden counter in
// front, order bubbles, weather, lighting and particles. World px (layout COUNTER, core 200×150) → detail buffer
// (DETAIL px per world px) → integer upscale onto #scene, then hi-res text.
import { drawBubble, drawParticle, drawWeather, drawCanopy, drawLighting, drawChar, drawIcon, makeLook, drawSideTable, setUniform } from '../art/index.js';
import { createExtras, SIGN_STYLES } from './extras.js';
import { bandFor, MATS } from './counterMat.js';
import { activeLooks } from '../core/looks.js';
import { loadAtlas, DETAIL } from '../art/assets.js';
import { BACKDROPS, COUNTER_ART } from '../art/data/counter.js';
import { PAL } from '../art/palette.js';
import { TIME, RAIN, INGREDIENTS, BRANCHES } from '../config.js';
const ING_ICON = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i.icon]));
import { fmtShort } from '../core/format.js';
import { createCamera } from './camera.js';
import { createFx, FONT_BUNGEE } from './fx.js';
import { createAmbient } from './ambient.js';

const TAP_PX = 10;
const NEAR0 = 90, NEAR1 = 116;     // feet y where a character is drawn ×1 … ×1.5 (3 buffer px per art px: stays crisp) (walking up to the counter in between)
const LY = 13;                     // string lights hang just below the HUD awning

export function createCounterRenderer(canvas, game) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { alpha: false });
  const cam = createCamera(DETAIL);
  const fx = createFx();
  const amb = createAmbient();
  const extras = createExtras(game);
  let looksNow = { brand: null, uniform: null, facade: null };
  const counterRec = loadAtlas(COUNTER_ART.file);
  const CF = COUNTER_ART.frames;

  let bw = 1, bh = 1, cssW = 0, cssH = 0, dpr = 1, coreKey = '';
  let tarpK = 0, time = 0, fontsOK = false, fontsCheckT = 0, destroyed = false;
  const view = { x0: 0, y0: 0, x1: 1, y1: 1 };
  const env = { t: 0, clock: 600, day: 1, weather: 'sun', event: null, tier: 1, layout: null, up: null, deco: null, open: false };
  const aOpts = { pose: 'idle', facing: 'down', t: 0, carry: null, alpha: 1 };
  const bc = { icon: null };
  const bo = { patience: null, t: 0, pulse: false };

  // ───────────── looks ─────────────
  const looks = new WeakMap();
  function lookOf(a) {
    let l = looks.get(a);
    if (l) return l;
    l = a.type === 'veso' ? makeLook('veso', a.lookSeed || 1, 0) : makeLook(a.kind || 'sinhvien', a.lookSeed || 1, a.memberIdx || 0);
    looks.set(a, l);
    return l;
  }

  // ───────────── sizing ─────────────
  function refit() {
    const L = game.world.layout;
    if (!L || cssW < 2 || cssH < 2) return;
    const Wd = Math.round(cssW * dpr), Hd = Math.round(cssH * dpr);
    if (canvas.width !== Wd || canvas.height !== Hd) { canvas.width = Wd; canvas.height = Hd; }
    cam.setViewport(Wd, Hd, dpr, L.w, L.h, true, 0);
    // never pan: show the whole counter, anchored to the bottom when the view is taller than the core
    cam.cx = L.w / 2;
    cam.cy = cam.viewH >= L.h ? L.h - cam.viewH / 2 + 4 : L.h / 2 + Math.min(6, (L.h - cam.viewH) / 2);
    cam.canPanX = cam.canPanY = false;
    cam.update(0);
    bw = Math.ceil(Wd / cam.scale) + 2;
    bh = Math.ceil(Hd / cam.scale) + 2;
    if (buf.width !== bw * DETAIL || buf.height !== bh * DETAIL) { buf.width = bw * DETAIL; buf.height = bh * DETAIL; }
    ctx.imageSmoothingEnabled = false;
    bctx.imageSmoothingEnabled = false;
    coreKey = L.w + 'x' + L.h;
  }
  function resize() {
    if (destroyed) return;
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height), d = Math.min(3, window.devicePixelRatio || 1);
    if (w === cssW && h === cssH && d === dpr) return;
    cssW = w; cssH = h; dpr = d;
    refit();
  }

  // ───────────── coordinates ─────────────
  const c2w = { x: 0, y: 0 };
  function clientToWorld(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const k = r.width > 0 ? canvas.width / r.width : dpr;
    c2w.x = cam.x0 + (cx - r.left) * k / cam.scale;
    c2w.y = cam.y0 + (cy - r.top) * k / cam.scale;
    return c2w;
  }
  function worldToClient(x, y) {
    const r = canvas.getBoundingClientRect();
    const k = canvas.width > 0 ? r.width / canvas.width : 1 / dpr;
    return { x: r.left + (x - cam.x0) * cam.scale * k, y: r.top + (y - cam.y0) * cam.scale * k };
  }

  const scaleAt = (y) => (y <= NEAR0 ? 1 : y >= NEAR1 ? 1.5 : 1 + 0.5 * (y - NEAR0) / (NEAR1 - NEAR0));

  // ───────────── picking ─────────────
  function pick(clientX, clientY) {
    const w = game.world, L = w.layout;
    if (!L || !cam.scale) return null;
    const p = clientToWorld(clientX, clientY), x = p.x, y = p.y;
    const v = w.veso;
    if (v && !v.leaving && !v.path && Math.abs(x - v.x) <= 11 && y >= v.y - 34 && y <= v.y + 6) return { type: 'veso' };
    // customers at the counter (big) first, then the queue
    for (const g of w.groups) {
      if (g.tableIdx < 0 || g.state === 'leaving' || g.state === 'walkingIn') continue;
      const t = w.tables[g.tableIdx];
      if (t && Math.abs(x - t.x) <= L.counter.slotW / 2 && y >= t.y - 52 && y <= t.y + 30) return { type: 'table', idx: g.tableIdx };
    }
    for (const g of w.groups) {
      for (const a of g.members) {
        const s = scaleAt(a.y);
        if (Math.abs(x - a.x) <= 7 * s && y >= a.y - 25 * s && y <= a.y + 2) return { type: 'customer', groupId: g.id };
      }
    }
    for (const t of w.tables) if (Math.abs(x - t.x) <= L.counter.slotW / 2 && y >= t.y - 40 && y <= t.y + 30) return { type: 'table', idx: t.idx };
    return null;
  }

  let focusT = null;
  function focus(target) { focusT = target || null; }

  // ───────────── input: taps only (the view never pans) ─────────────
  const ptr = { id: -1, sx: 0, sy: 0 };
  function onDown(e) {
    if (ptr.id !== -1) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptr.id = e.pointerId; ptr.sx = e.clientX; ptr.sy = e.clientY;
  }
  function onUp(e) {
    if (e.pointerId !== ptr.id) return;
    ptr.id = -1;
    if (e.type === 'pointercancel' || Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > TAP_PX) return;
    const hit = pick(e.clientX, e.clientY);
    if (hit) fx.burst('spark', c2w.x, c2w.y, 3, 16, 0.3, 0, 0);
    if (renderer.onTap) { try { renderer.onTap(hit); } catch (err) { console.error('[renderer] onTap', err); } }
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const onWinResize = () => resize();
  window.addEventListener('resize', onWinResize);
  window.addEventListener('orientationchange', onWinResize);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => resize()); ro.observe(canvas); }

  // ───────────── juicy feedback ─────────────
  const offs = [];
  const on = (name, fn) => { game.on(name, fn); offs.push([name, fn]); };
  const headOf = (id) => { for (const g of game.world.groups) if (g.id === id) return g.members[0] || null; return null; };
  const handoff = [];                                     // cups sliding from the vendor (bottom) to a customer
  on('collected', (e) => {
    if (e.x == null) return;
    fx.burst('coin', e.x, e.y - 2, 9, 50, 0.7, 150, 0.75);
    fx.text('+' + fmtShort(e.amount), e.x, e.y - 10, PAL.gold, 0, 8, 1.2, 22);
  });
  on('served', (e) => {
    if (e.x == null) return;
    fx.burst('spark', e.x, e.y - 14, e.extra ? 4 : 8, 30, 0.5, 30, 0.3);
    if (e.fast && !e.extra) fx.text('Nhanh!', e.x, e.y - 34, PAL.lime, 0, 7, 0.95, 12);
    const g = game.world.groups.find((x) => x.tableIdx >= 0 && game.world.tables[x.tableIdx] && game.world.tables[x.tableIdx].x === e.x);
    handoff.push({ x: e.x, t: 0, icon: e.extra ? null : g ? 'pot_' + g.pot : null });
  });
  on('combo', (e) => {
    if (e.x == null) return;
    fx.text('Combo x' + e.n + '!', e.x, e.y - 46, e.n >= 5 ? PAL.coral : PAL.gold1, 1, 4.5 + Math.min(e.n, 8) * 0.2, 1.1, 18);
    if (e.n >= 4) fx.burst('confetti', e.x, e.y - 40, Math.min(18, 6 + e.n * 2), 50, 0.9, 120, 0.5);
  });
  on('review', (e) => {
    if (e.x == null || !e.review) return;
    const st = e.review.stars | 0;
    const big = e.y > 100;
    fx.stars(st, e.x, e.y - (big ? 62 : 30));
    if (st >= 5) fx.puff('heart', e.x, e.y - (big ? 50 : 22), 6, 1.1, 10);
    else if (st <= 2) fx.puff('smoke', e.x, e.y - (big ? 50 : 22), 5, 0.9, 8);
  });
  on('xp', (e) => {
    if (e.x == null || !(e.delta > 0)) return;
    fx.text('+' + Math.round(e.delta) + ' XP', e.x, e.y - 30, PAL.mint, 0, 6.5, 1.05, 14, 0.12);
  });
  on('levelUp', () => fx.flash('level', view));
  on('tierUp', () => fx.flash('tier', view));
  on('ending', () => fx.flash('ending', view));
  on('upgrade', (e) => {
    if (e.x == null) return;
    fx.burst('spark', e.x, e.y - 6, 12, 38, 0.75, 30, 0.2);
    fx.burst('star', e.x, e.y - 8, 4, 30, 0.9, 60, 0.5);
  });
  on('ingredientAdded', () => fx.burst('leaf', view.x0 + (view.x1 - view.x0) / 2, view.y1 - 8, 3, 26, 0.6, 50, 0.6));
  on('customerLeft', (e) => {
    if (!e.angry) return;
    const a = headOf(e.groupId);
    if (a) { const s = scaleAt(a.y); fx.puff('smoke', a.x, a.y - 22 * s, 5, 0.9, 6); }
  });

  // ───────────── backdrop ─────────────
  const bgRecs = {};
  /** v2.6.7: the main shop moved to a branch city → that city's backdrop (the layout itself stays the tier's) */
  function cityScene() {
    const id = game.state.homeCity;
    if (!id) return null;
    const b = BRANCHES.find((x) => x.id === id);
    return b && b.scene && BACKDROPS[b.scene] ? b.scene : null;
  }
  function backdrop(scene) {
    const m = BACKDROPS[scene] || BACKDROPS.vihe;
    if (!bgRecs[scene]) bgRecs[scene] = loadAtlas(m.file);
    return { m, img: bgRecs[scene].img };
  }
  function drawBackdrop(L) {
    const { m, img } = backdrop(cityScene() || L.scene);
    const C = L.counter;
    const vw = view.x1 - view.x0;
    // world size of the image at 1:1 (DETAIL px per world px); widen when the view is wider than the art
    const k = Math.max(1, (vw + 4) / (m.w / DETAIL));
    const W = (m.w / DETAIL) * k, H = (m.h / DETAIL) * k;
    const x = Math.round((C.w - W) / 2), y = Math.round(C.ground - (m.ground / DETAIL) * k);
    bctx.fillStyle = '#9fd3f0';
    bctx.fillRect(view.x0, view.y0, vw, view.y1 - view.y0);
    if (!img) { bctx.fillStyle = '#d9c6a5'; bctx.fillRect(view.x0, C.ground, vw, view.y1 - C.ground); return; }
    bctx.imageSmoothingEnabled = k > 1;
    bctx.drawImage(img, x, y, W, H);
    bctx.imageSmoothingEnabled = false;
    if (y + H < view.y1) { bctx.fillStyle = '#c9b190'; bctx.fillRect(view.x0, y + H, vw, view.y1 - y - H); }
  }

  // string lights across the top: always there, glowing at dusk
  function drawLights(night) {
    const x0 = view.x0 - 6, x1 = view.x1 + 6, n = Math.ceil((x1 - x0) / 40);
    bctx.strokeStyle = '#3b2f22'; bctx.lineWidth = 0.5;
    for (let i = 0; i < n; i++) {
      const a = x0 + i * 40, b = a + 40;
      bctx.beginPath(); bctx.moveTo(a, LY); bctx.quadraticCurveTo((a + b) / 2, LY + 10, b, LY); bctx.stroke();
      for (let j = 1; j < 5; j++) {
        const u = j / 5, bx = a + (b - a) * u, by = LY + 20 * u * (1 - u);
        bctx.fillStyle = '#3b2f22'; bctx.fillRect(Math.round(bx) - 0.5, Math.round(by), 1, 1);
        bctx.fillStyle = night > 0.05 ? '#ffe9a0' : '#fff3c9';
        bctx.fillRect(Math.round(bx) - 1, Math.round(by) + 1, 2, 2.5);
      }
    }
  }
  function drawGlow(night) {
    if (night < 0.03) return;
    const x0 = view.x0 - 6, x1 = view.x1 + 6, n = Math.ceil((x1 - x0) / 40);
    bctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      for (let j = 1; j < 5; j++) {
        const u = j / 5, bx = x0 + i * 40 + 40 * u, by = LY + 2 + 20 * u * (1 - u);
        const g = bctx.createRadialGradient(bx, by, 0, bx, by, 14);
        g.addColorStop(0, `rgba(255,214,120,${(0.42 * night).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,214,120,0)');
        bctx.fillStyle = g; bctx.fillRect(bx - 14, by - 14, 28, 28);
      }
    }
    // warm spill from the vendor's lamp onto the counter
    const cx = (view.x0 + view.x1) / 2;
    const g = bctx.createRadialGradient(cx, 150, 10, cx, 150, 110);
    g.addColorStop(0, `rgba(255,190,90,${(0.32 * night).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    bctx.fillStyle = g; bctx.fillRect(view.x0, 40, view.x1 - view.x0, view.y1 - 40);
    bctx.globalCompositeOperation = 'source-over';
  }
  const nightOf = (clock) => clock >= 19 * 60 ? 1 : clock >= 17.5 * 60 ? (clock - 17.5 * 60) / 90 : 0;

  const counterMat = () => Math.max(0, Math.min(4, (game.state.upgrades && game.state.upgrades.stovetype) | 0));
  // ───────────── counter ─────────────
  function drawCounter(L) {
    const img = counterRec.img, C = L.counter;
    if (!img) { bctx.fillStyle = '#c98a4b'; bctx.fillRect(view.x0, C.top, view.x1 - view.x0, view.y1 - C.top); return; }
    const b = CF.band, bwW = b[2] / DETAIL, bhW = b[3] / DETAIL;
    // band, tiled from the centre outwards (so the seams are symmetric)
    const start = Math.floor((view.x0 - C.w / 2) / bwW) - 1, end = Math.ceil((view.x1 - C.w / 2) / bwW) + 1;
    const mat = counterMat(), tile = bandFor(img, b, mat);          // v2.5: material follows the Quầy sơ chế level
    for (let i = start; i <= end; i++) {
      if (tile) bctx.drawImage(tile, 0, 0, b[2], b[3], C.w / 2 + i * bwW, C.top, bwW, bhW);
      else bctx.drawImage(img, b[0], b[1], b[2], b[3], C.w / 2 + i * bwW, C.top, bwW, bhW);
    }
    if (C.top + bhW < view.y1) { bctx.fillStyle = ['#7a4a22', '#6e4422', '#24604c', '#3e4850', '#141f33'][mat] || '#7a4a22'; bctx.fillRect(view.x0, C.top + bhW, view.x1 - view.x0, view.y1 - C.top - bhW); }
    // v2.5.1: the fruit basket / salt jars (and the wooden slab painted under them) are gone: the counter shows its own material end to end
  }

  // ───────────── characters ─────────────
  const drawList = [];
  function drawActor(a, look, s) {
    aOpts.pose = a.pose === 'eat' ? 'idle' : a.pose;          // 'sit' only happens at the side tables
    aOpts.facing = a.facing; aOpts.carry = null; aOpts.alpha = a.alpha == null ? 1 : a.alpha;
    aOpts.t = time + (a.id % 13) * 0.37;
    const x = Math.round(a.x * DETAIL) / DETAIL, y = Math.round(a.y * DETAIL) / DETAIL;
    if (s === 1) { drawChar(bctx, look, Math.round(x), Math.round(y), aOpts); return; }
    bctx.save();
    bctx.translate(x, y);
    bctx.scale(s, s);
    drawChar(bctx, look, 0, 0, aOpts);
    bctx.restore();
  }
  /** the leader of a served group holds the cup in front of them */
  function drawCup(g, a, s) {
    if (!g.pot || g.angry || g.seated) return;           // seated groups have their cups on the table
    if (!(g.state === 'eating' || g.state === 'billing' || (g.state === 'leaving' && g.info))) return;
    const sz = 0.62 * s;                                 // icon scale (16 world px × sz)
    drawIcon(bctx, 'pot_' + g.pot, Math.round(a.x + 1 * s - 8 * sz), Math.round(a.y - 15 * s - 8 * sz), sz);
    extras.addCup(Math.round(a.x + 1 * s - 8 * sz) + 8 * sz, Math.round(a.y - 15 * s - 8 * sz) + 8 * sz, 16 * sz);
  }

  // ───────────── bubbles ─────────────
  function bubbleFor(g) {
    bc.icon = null; bo.patience = null; bo.pulse = false;
    switch (g.state) {
      case 'ordered': {
        const tk = g.ticket;
        if (tk && tk.status !== 'dead') {
          bc.icon = 'pot_' + (g.pot || tk.pot);
          bo.patience = 1 - tk.waited / tk.patience;
          bo.pulse = bo.patience < 0.3;
        }
        break;
      }
      case 'seated': bc.icon = 'emo_question'; break;
      case 'eating': {
        const ex = g.extraTicket;
        if (ex && ex.status !== 'dead' && ex.status !== 'done' && ex.extra) {
          bc.icon = ING_ICON[ex.extra] || 'ing_' + ex.extra;   // fruit extras use fr_* icons
          bo.patience = 1 - ex.waited / ex.patience;
          bo.pulse = bo.patience < 0.3;
        } else bc.icon = 'emo_yum';
        break;
      }
      case 'billing': bc.icon = 'emo_money'; break;
      case 'waitingDoor': {
        const p = g.doorLeft / (TIME.doorPatience * (g.tutorial ? 3 : 1));
        if (g.doorIdx !== 0 && p > 0.5) break;           // only the head of the line, or someone losing patience
        bc.icon = 'emo_wait'; bo.patience = p; bo.pulse = p < 0.3;
        break;
      }
      case 'leaving':
        if (g.priceLeave) bc.icon = 'emo_money';
        else if (g.angry) bc.icon = 'emo_angry';
        else if (g.stars >= 5) bc.icon = 'emo_love';
        else if (g.stars === 4) bc.icon = 'emo_yum';
        break;
      default: break;
    }
    if (g.wet > 2 && g.state !== 'leaving') {
      bc.icon = 'emo_sweat';
      bo.patience = 1 - g.wet / (RAIN.wetLeaveMin * (g.tutorial ? 3 : 1));
      bo.pulse = true;
    }
    if (bo.patience != null) bo.patience = Math.max(0, Math.min(1, bo.patience));
    return bc.icon !== null;
  }
  function drawBubbles(w, trayTable) {
    bo.t = time;
    for (const g of w.groups) {
      if (!g.members.length || !bubbleFor(g)) continue;
      const a = g.members[0];
      const s = scaleAt(a.y);
      const atCounter = g.tableIdx >= 0 && s > 1.45 && g.state !== 'leaving';
      if (atCounter) {
        const t = w.tables[g.tableIdx];
        const x = t.x + 12, y = a.y - 37;
        if (g.tableIdx === trayTable) {           // the order on the player's board: gold halo behind the bubble
          const k = 0.5 + 0.5 * Math.sin(time * 6);
          bctx.fillStyle = `rgba(255,207,61,${(0.35 + 0.35 * k).toFixed(2)})`;
          bctx.fillRect(x - 12, y - 26, 24, 25);
        }
        drawBubble(bctx, Math.round(x), Math.round(y), bc, bo);
      } else drawBubble(bctx, Math.round(a.x), Math.round(a.y - 25 * s - 2), bc, bo);
    }
    const v = w.veso;
    if (v && !v.leaving && !v.path) {
      bc.icon = 'ui_ticket'; bo.patience = null; bo.pulse = true;
      drawBubble(bctx, Math.round(v.x), Math.round(v.y - 27), bc, bo);
    }
  }

  // counter spot markers: an empty spot shows a small chalk tag, the selected order a gold bar on the counter
  function drawSpots(w, trayTable) {
    const L = w.layout, C = L.counter;
    for (const t of w.tables) {
      const busy = !!t.groupId;
      if (!busy) {                                   // an empty spot: a little placemat in the counter's style, cup ring on it
        const pm = MATS[counterMat()] || MATS[0];
        bctx.fillStyle = 'rgba(40,28,18,0.22)'; bctx.fillRect(t.x - 9, C.top + 6, 18, 6.5);
        bctx.fillStyle = t.reserved ? '#ffcf3d' : pm.edge; bctx.fillRect(t.x - 8.5, C.top + 5, 17, 6);
        bctx.fillStyle = t.reserved ? '#ffe08a' : pm.mat; bctx.fillRect(t.x - 7.5, C.top + 5.5, 15, 5);
        bctx.strokeStyle = pm.ring; bctx.lineWidth = 0.5;
        bctx.beginPath(); bctx.ellipse(t.x, C.top + 8, 3, 1.4, 0, 0, Math.PI * 2); bctx.stroke();
      }
      if (t.idx === trayTable) {
        const k = 0.5 + 0.5 * Math.sin(time * 6);
        bctx.fillStyle = `rgba(255,207,61,${(0.55 + 0.4 * k).toFixed(2)})`;
        bctx.fillRect(t.x - 16, C.top + 2, 32, 2);
      }
    }
  }

  // ───────────── shop name board (hi-res text) ─────────────
  const signStyle = () => SIGN_STYLES[(looksNow.facade && looksNow.facade.sign) || 'go'] || SIGN_STYLES.go;
  // v2.5: the sign hangs from the striped awning at the top of the screen, centred, on two ropes
  const signL = { sign: null };
  const sgNow = { x: 0, y: 0, w: 0, h: 0, rope: 0 };
  function placeSign(L) {
    const sg = L.sign;
    if (!sg || !cam.scale) { signL.sign = sg || null; return; }
    const css = (px) => (px * dpr) / cam.scale;                 // css px → world px
    sgNow.w = sg.w; sgNow.h = sg.h; sgNow.x = Math.round(L.w / 2 - sg.w / 2 + (looksNow.brand ? 6 : 0));   // stamp + board centred as one
    sgNow.rope = cam.y0 + css(8);                               // tucked under the awning scallops
    sgNow.y = Math.round(cam.y0 + css(30));
    signL.sign = sgNow;
  }
  function drawBoard(L) {
    const sg = L.sign;
    if (!sg) return;
    const st = signStyle();
    const ropeTop = sg.rope != null ? sg.rope : 0, sway = Math.sin(time * 1.2) * 0.25;
    bctx.fillStyle = '#3b2f22';
    bctx.fillRect(sg.x + 10 + sway, ropeTop, 0.5, sg.y + 1 - ropeTop); bctx.fillRect(sg.x + sg.w - 10.5 + sway, ropeTop, 0.5, sg.y + 1 - ropeTop);
    bctx.fillStyle = '#6b5440'; bctx.fillRect(sg.x + 9.5 + sway, sg.y - 1.5, 1.5, 1.5); bctx.fillRect(sg.x + sg.w - 11 + sway, sg.y - 1.5, 1.5, 1.5);   // rings
    bctx.fillStyle = st.edge; bctx.fillRect(sg.x - 1, sg.y - 1, sg.w + 2, sg.h + 2);
    bctx.fillStyle = st.fill; bctx.fillRect(sg.x, sg.y, sg.w, sg.h);
    bctx.fillStyle = st.hi; bctx.fillRect(sg.x, sg.y, sg.w, 1);
  }
  const fit = { name: '', sc: 0, fonts: false, px: 10, text: '' };
  function drawBoardText(L, s) {
    const sg = L.sign, name = (s.shopName || 'Xoài Lắc Ơi!').trim();
    if (!sg) return;
    const sc = cam.scale;
    const pad = looksNow.brand ? 13 : 0;                 // the logo stamp sits on the board's left end
    if (fit.name !== name || fit.sc !== sc || fit.fonts !== fontsOK || fit.pad !== pad) {
      fit.name = name; fit.sc = sc; fit.fonts = fontsOK; fit.pad = pad;
      const maxW = (sg.w - pad) * sc * 0.9;
      let px = Math.round(sg.h * sc * 0.62), txt = name;
      ctx.font = `${px}px ${FONT_BUNGEE}`;
      while (px > 8 && ctx.measureText(txt).width > maxW) { px -= 1; ctx.font = `${px}px ${FONT_BUNGEE}`; }
      while (txt.length > 3 && ctx.measureText(txt).width > maxW) txt = txt.slice(0, -2).trimEnd() + '…';
      fit.px = px; fit.text = txt;
    }
    ctx.font = `${fit.px}px ${FONT_BUNGEE}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
    const x = Math.round(cam.toDeviceX(sg.x + pad + (sg.w - pad) / 2)), y = Math.round(cam.toDeviceY(sg.y + sg.h / 2) + fit.px * 0.05);
    const st = signStyle();
    if (st.glow) { ctx.save(); ctx.shadowColor = st.glow; ctx.shadowBlur = Math.round(fit.px * (0.5 + 0.15 * Math.sin(time * 3))); }
    ctx.strokeStyle = st.stroke; ctx.strokeText(fit.text, x, y);
    ctx.fillStyle = st.text; ctx.fillText(fit.text, x, y);
    if (st.glow) ctx.restore();
  }

  // ───────────── the frame ─────────────
  function render(dt) {
    if (destroyed || (typeof document !== 'undefined' && document.hidden)) return;
    const s = game.state, w = game.world, L = w.layout;
    if (!L || !L.counter) return;
    if (cssW === 0) resize();
    if (cssW < 2 || cssH < 2) return;
    if (coreKey !== L.w + 'x' + L.h || !cam.scale) refit();
    dt = Math.min(dt, 0.1);
    time += dt;
    fontsCheckT -= dt;
    if (fontsCheckT <= 0) {
      fontsCheckT = 1;
      try { fontsOK = !!(document.fonts && document.fonts.check(`12px ${FONT_BUNGEE}`)); } catch (e) { fontsOK = false; }
    }
    const ox = Math.floor(cam.x0), oy = Math.floor(cam.y0);
    view.x0 = ox; view.y0 = oy; view.x1 = ox + bw; view.y1 = oy + bh;
    fx.update(dt, view);
    let wxNow = s.weather;
    try { if (game.get && game.get.weatherNow) wxNow = game.get.weatherNow(); } catch (e) { /* keep the day's weather */ }
    const tarpWant = s.today && s.today.tarp ? 1 : 0;   // v2.6.5: from Chợ đêm bờ kè the sim rolls it out by itself
    tarpK += Math.sign(tarpWant - tarpK) * Math.min(Math.abs(tarpWant - tarpK), dt / 0.9);
    amb.update(dt, { x0: view.x0, x1: view.x1, layout: L, clock: s.clock, weather: wxNow, open: s.phase === 'open' });
    const night = nightOf(s.clock);
    looksNow = activeLooks(s);
    setUniform(looksNow.uniform);
    extras.update(dt);
    extras.clearCups();

    bctx.setTransform(DETAIL, 0, 0, DETAIL, -ox * DETAIL, -oy * DETAIL);
    bctx.imageSmoothingEnabled = false;
    drawBackdrop(L);
    drawLights(night);
    extras.drawLamps(bctx, view, LY, s.deco && s.deco.equipped && s.deco.equipped.den, time);
    if (looksNow.facade) extras.drawBunting(bctx, view, LY, looksNow.facade.bunting, time);
    placeSign(L);
    if (looksNow.facade) extras.drawBalloons(bctx, signL, looksNow.facade.balloon, time);
    drawBoard(signL);
    extras.drawPlants(bctx, view, s.deco && s.deco.equipped && s.deco.equipped.cay);

    // passers-by, the lottery lady, customers — back to front
    drawList.length = 0;
    for (const p of amb.peds) drawList.push(p);
    if (w.veso) drawList.push(w.veso);
    for (const g of w.groups) for (const a of g.members) drawList.push(a);
    for (const sd of w.side || []) drawList.push(sd);
    for (const hp of extras.helpers) drawList.push(hp);
    for (const f of extras.fanSpots((s.upgrades && s.upgrades.cooling) | 0, (w.side || []).filter((x) => !x.bar).length)) drawList.push(f);   // v2.6.20 quạt
    drawList.sort((a, b) => a.y - b.y);
    const tStyle = (s.upgrades && s.upgrades.tablestyle) || 0;
    const groupOf = new Map();
    for (const g of w.groups) groupOf.set(g.id, g);
    for (const a of drawList) {
      if (a.fan) { extras.drawFan(bctx, a, time, s.phase !== 'report'); continue; }
      if (a.home) { extras.drawHelper(bctx, a); continue; }   // staff in the shop's uniform
      if (a.bar) { extras.drawBar(bctx, a, tStyle, time); continue; }   // v2.5.2 bàn dài sát lan can
      if (a.seats) {                                   // side table (bàn ghế hai bên quán)
        drawSideTable(bctx, a, { style: tStyle, pot: a.pot, potFill: a.fill, drinks: a.drinks, plates: a.pot ? 2 : 0, t: time });
        continue;
      }
      if (a.look) {                                    // ambient pedestrian
        aOpts.pose = 'walk'; aOpts.facing = a.dir > 0 ? 'right' : 'left'; aOpts.t = a.t; aOpts.carry = null; aOpts.alpha = 1;
        drawChar(bctx, a.look, Math.round(a.x), Math.round(a.y), aOpts);
        continue;
      }
      const s2 = a.pose === 'sit' ? 1 : scaleAt(a.y);     // seated guests match the (unscaled) side tables
      const sc = s2 > 1.45 ? 1.5 : s2 < 1.04 ? 1 : s2;
      drawActor(a, lookOf(a), sc);
      if (a.memberIdx === 0 && a.groupId) { const g = groupOf.get(a.groupId); if (g) drawCup(g, a, sc); }
    }

    drawCounter(L);
    if (looksNow.facade) extras.drawFlowers(bctx, w, L, looksNow.facade.flower, time);
    let trayTable = -1;
    if (w.tray.ticketId) for (const t of w.tickets) if (t.id === w.tray.ticketId) { trayTable = t.tableIdx; break; }
    if (trayTable < 0 && focusT && focusT.type === 'table') trayTable = focusT.idx;
    drawSpots(w, trayTable);

    // cups handed over the counter
    for (let i = handoff.length - 1; i >= 0; i--) {
      const h = handoff[i];
      h.t += dt;
      if (h.t > 0.35 || !h.icon) { handoff.splice(i, 1); continue; }
      const k = h.t / 0.35, y = view.y1 + 4 - (view.y1 + 4 - (L.counter.top - 6)) * (1 - (1 - k) * (1 - k));
      drawIcon(bctx, h.icon, Math.round(h.x - 8), Math.round(y - 8), 1);
      extras.addCup(Math.round(h.x - 8) + 8, Math.round(y - 8) + 8, 16);
    }

    drawWeather(bctx, view, wxNow, time, L.canopy && tarpK > 0.6 ? { x0: L.canopy.x0, y0: Math.round(L.canopy.yTop + (L.canopy.yFront - L.canopy.yTop) * tarpK) + 4, x1: L.canopy.x1, y1: L.canopy.ground } : null, L.counter.top);   // v2.6.5: dry under the tarp (rain still falls beyond its hem) and on the counter
    if (tarpK > 0.01) drawCanopy(bctx, L, tarpK, time);   // v2.6.5: after the rain, so the showers beyond read as falling behind the sheet
    env.t = time; env.clock = s.clock; env.day = s.day; env.weather = wxNow; env.event = s.event; env.tier = s.tier;
    env.layout = null; env.up = s.upgrades; env.deco = s.deco.equipped; env.open = s.phase === 'open' || s.phase === 'closing';
    drawLighting(bctx, view, env);
    drawGlow(night);
    if (looksNow.facade) extras.glowLanterns(bctx, view, LY, looksNow.facade.bunting, night);
    extras.glowLamps(bctx, view, LY, s.deco && s.deco.equipped && s.deco.equipped.den, night);
    drawBubbles(w, trayTable);
    fx.drawParticles(bctx, drawParticle);

    const sc = cam.scale;
    let shx = 0, shy = 0;
    if (fx.shake > 0) { shx = Math.round((Math.random() - 0.5) * fx.shake * 14); shy = Math.round((Math.random() - 0.5) * fx.shake * 14); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, bw * DETAIL, bh * DETAIL, shx - Math.round((cam.x0 - ox) * sc), shy - Math.round((cam.y0 - oy) * sc), bw * sc, bh * sc);
    extras.drawSignStamp(ctx, cam, signL, looksNow.brand, s.shopName, shx, shy);
    drawBoardText(signL, s);
    extras.drawStamps(ctx, cam, looksNow.brand, s.shopName, night, shx, shy);
    fx.drawText(ctx, cam);
    fx.drawScreen(ctx, canvas.width, canvas.height);
  }

  function destroy() {
    destroyed = true;
    for (const [n, f] of offs) game.off(n, f);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', onWinResize);
    window.removeEventListener('orientationchange', onWinResize);
    if (ro) ro.disconnect();
  }

  try {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('20px "XL Num"', '+0123456789kXP'), document.fonts.load('20px "XL Display"', 'Xoài Lắc Ơi Combo')]).then(() => { fontsOK = true; fit.name = ''; }).catch(() => {});
    }
  } catch (e) { /* fonts API unavailable */ }

  const renderer = {
    canvas, render, resize, pick, worldToClient,
    clientToWorld: (cx, cy) => { const p = clientToWorld(cx, cy); return { x: p.x, y: p.y }; },
    flash: (kind = 'gold') => fx.flash(kind, view),
    focus, onTap: null, destroy, detail: DETAIL,
    get scale() { return cam.scale; },
    get camera() { return cam; },
    get fx() { return fx; },
  };
  resize();
  return renderer;
}
