// Renderer (TECH_SPEC §7): world → detail buffer (1 world px = DETAIL×DETAIL buffer px) → integer upscale onto #scene,
// then a hi-res overlay for text. Reads game.state / game.world, never writes them.
// The art keeps drawing in world units; sprite art made at DETAIL px per world px draws `drawImage(img, x, y, w/DETAIL, h/DETAIL)`
// at integer world coordinates and lands 1:1 on buffer pixels.
import {
  drawSceneBack, sceneDrawables, drawSceneFront, drawTable, drawStove, drawCoinPile, drawBubble, drawParticle,
  drawVehicle, drawWeather, drawCanopy, drawLighting, drawChar, makeLook, makeOwnerLook, makeStaffLook,
} from '../art/index.js';
import { PAL } from '../art/palette.js';
import { TIME, RAIN } from '../config.js';
import { fmtShort } from '../core/format.js';
import { createCamera } from './camera.js';
import { createFx, FONT_BUNGEE } from './fx.js';
import { createAmbient } from './ambient.js';

/** Buffer pixels per world pixel (the sprite sheets are drawn at this density). */
export const DETAIL = 2;

const TAP_PX = 6;                 // CSS px: below this a press is a tap, above it a pan
const SLOP = 8;                   // generous world-px hit slop (§7)

// y-sort entry kinds
const K_DRAW = 0, K_TABLE = 1, K_STOVE = 2, K_ACTOR = 3, K_COINS = 4, K_PED = 5, K_VEH = 6;

export function createRenderer(canvas, game) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { alpha: false });
  const cam = createCamera(DETAIL);
  const fx = createFx();
  const amb = createAmbient();

  let bw = 1, bh = 1;               // buffer size in world px (the canvas itself is bw*DETAIL × bh*DETAIL)
  let cssW = 0, cssH = 0, dpr = 1;
  let coreW = 0, coreH = 0, sceneId = '';
  let tarpK = 0;                    // rain tarp 0 rolled … 1 out
  let time = 0;                     // animation clock (real seconds, runs while paused)
  let fontsOK = false, fontsCheckT = 0;
  let destroyed = false;

  const env = {
    t: 0, clock: 600, day: 1, weather: 'sun', event: null, tier: 1, layout: null, up: null, deco: null, open: false, shopName: '', boiling: 0,
  };
  const view = { x0: 0, y0: 0, x1: 1, y1: 1 };
  const tOpts = { style: 0, tier: 1, pot: null, potFill: 0, boiling: false, plates: 0, drinks: 0, dirty: false, reserved: false, highlight: false, t: 0 };
  const sOpts = { type: 0, pot: null, progress: 0, ready: false, portions: 0, maxPortions: 0, t: 0, highlight: false };
  const aOpts = { pose: 'idle', facing: 'down', t: 0, carry: null, alpha: 1 };
  const pOpts = { pose: 'walk', facing: 'right', t: 0, carry: null, alpha: 1 };
  const bc = { icon: null };       // reused bubble content / options
  const bo = { patience: null, t: 0, pulse: false };

  // ───────────── y-sorted entry pool ─────────────
  const pool = [];
  const list = [];
  let poolN = 0;
  function push(kind, y, o) {
    let e = pool[poolN];
    if (!e) e = pool[poolN] = { k: 0, y: 0, o: null };
    poolN++;
    e.k = kind; e.y = y; e.o = o;
    list.push(e);
  }
  function sortList() {
    for (let i = 1; i < list.length; i++) {
      const e = list[i];
      let j = i - 1;
      while (j >= 0 && list[j].y > e.y) { list[j + 1] = list[j]; j--; }
      list[j + 1] = e;
    }
  }

  // ───────────── looks ─────────────
  const looks = new WeakMap();
  let ownerLook = null, ownerKey = '';
  function lookOf(a) {
    if (a.type === 'owner') {
      const s = game.state, key = s.avatar + ':' + s.tier;
      if (key !== ownerKey || !ownerLook) { ownerKey = key; ownerLook = makeOwnerLook(s.avatar, s.tier); }
      return ownerLook;
    }
    let l = looks.get(a);
    if (l) return l;
    if (a.type === 'staff') {
      const m = game.state.staff.find((x) => x.id === a.staffId);
      l = makeStaffLook((m && m.role) || a.role || 'phucvu', (m && (m.lookSeed || (m.look && m.look.lookSeed))) || a.lookSeed || a.staffId || 1);
    } else if (a.type === 'veso') l = makeLook('veso', a.lookSeed || 1, 0);
    else l = makeLook(a.kind || 'sinhvien', a.lookSeed || 1, a.memberIdx || 0);
    looks.set(a, l);
    return l;
  }

  // ───────────── sizing ─────────────
  function refit(reset) {
    const w = game.world, L = w.layout;
    if (L) { coreW = L.w; coreH = L.h; sceneId = L.scene + ':' + game.state.tier; }
    if (cssW < 2 || cssH < 2 || !coreW) return;
    const Wd = Math.round(cssW * dpr), Hd = Math.round(cssH * dpr);
    if (canvas.width !== Wd || canvas.height !== Hd) { canvas.width = Wd; canvas.height = Hd; }
    cam.setViewport(Wd, Hd, dpr, coreW, coreH, reset, L && L.sign ? L.sign.y - 10 : 0);
    bw = Math.ceil(Wd / cam.scale) + 2;
    bh = Math.ceil(Hd / cam.scale) + 2;
    const pw = bw * DETAIL, ph = bh * DETAIL;
    if (buf.width !== pw || buf.height !== ph) { buf.width = pw; buf.height = ph; }
    ctx.imageSmoothingEnabled = false;
    bctx.imageSmoothingEnabled = false;
  }

  function resize() {
    if (destroyed) return;
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    const d = Math.min(3, window.devicePixelRatio || 1);
    if (w === cssW && h === cssH && d === dpr) return;
    cssW = w; cssH = h; dpr = d;
    refit(false);
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

  // ───────────── picking ─────────────
  function pick(clientX, clientY) {
    const w = game.world, L = w.layout;
    if (!L || !cam.scale) return null;
    const p = clientToWorld(clientX, clientY), x = p.x, y = p.y;

    const v = w.veso;
    if (v && !v.leaving && !v.path && Math.abs(x - v.x) <= 8 + SLOP * 0.6 && y >= v.y - 28 - SLOP && y <= v.y + 4 + SLOP * 0.5) return { type: 'veso' };

    let best = -1, bd = 1e9;
    for (const t of w.tables) {
      if (!t.coins) continue;
      const dx = x - t.x, dy = y - (t.y - 4);
      if (Math.abs(dx) <= 11 + SLOP && dy >= -14 - SLOP && dy <= 10 + SLOP) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = t.idx; } }
    }
    if (best >= 0) return { type: 'coins', tableIdx: best };

    best = -1; bd = 1e9;
    for (const st of w.stoves) {
      const dx = x - st.x, dy = y - (st.y - 4);
      if (Math.abs(dx) <= 10 + SLOP * 0.5 && dy >= -16 - SLOP * 0.6 && dy <= 10 + SLOP * 0.6) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = st.idx; } }
    }
    if (best >= 0) return { type: 'stove', idx: best };

    for (const g of w.groups) {
      for (let i = 0; i < g.members.length; i++) {
        const a = g.members[i];
        if (Math.abs(x - a.x) <= 6 + 3 && y >= a.y - 24 - 3 && y <= a.y + 3) {
          if (g.tableIdx >= 0 && w.tables[g.tableIdx] && g.state !== 'leaving' && g.state !== 'walkingIn') return { type: 'table', idx: g.tableIdx };
          return { type: 'customer', groupId: g.id };
        }
      }
    }

    best = -1; bd = 1e9;
    for (const t of w.tables) {
      const dx = x - t.x, dy = y - t.y;
      if (Math.abs(dx) <= 18 + SLOP && dy >= -13 - SLOP && dy <= 16 + SLOP) { const d = dx * dx + dy * dy * 1.4; if (d < bd) { bd = d; best = t.idx; } }
    }
    if (best >= 0) return { type: 'table', idx: best };
    return null;
  }

  // ───────────── focus (highlight + gentle pan) ─────────────
  let focusT = null;
  function focus(target, pan = true) {
    if (!target) { focusT = null; return; }
    focusT = target;
    if (!pan) return;
    const w = game.world;
    let px = target.x, py = target.y;
    if (target.type === 'stove' && w.stoves[target.idx]) { px = w.stoves[target.idx].x; py = w.stoves[target.idx].y; }
    else if (target.type === 'table' && w.tables[target.idx]) { px = w.tables[target.idx].x; py = w.tables[target.idx].y; }
    if (px != null && py != null && !cam.sees(px, py, 24)) cam.focus(px, py);
  }

  // ───────────── input: pan (inertia) vs tap ─────────────
  const ptr = { id: -1, sx: 0, sy: 0, lx: 0, ly: 0, lt: 0, drag: false, vx: 0, vy: 0 };
  function onDown(e) {
    if (ptr.id !== -1) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptr.id = e.pointerId; ptr.sx = ptr.lx = e.clientX; ptr.sy = ptr.ly = e.clientY; ptr.lt = e.timeStamp;
    ptr.drag = false; ptr.vx = ptr.vy = 0;
    cam.stop();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no active pointer */ }
  }
  function onMove(e) {
    if (e.pointerId !== ptr.id) return;
    if (!ptr.drag && Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > TAP_PX) ptr.drag = true;
    if (!ptr.drag) return;
    const k = dpr / cam.scale;                    // world px per CSS px
    const dx = (e.clientX - ptr.lx) * k, dy = (e.clientY - ptr.ly) * k;
    const dtS = Math.max(0.001, (e.timeStamp - ptr.lt) / 1000);
    ptr.vx = ptr.vx * 0.5 + (-dx / dtS) * 0.5;
    ptr.vy = ptr.vy * 0.5 + (-dy / dtS) * 0.5;
    ptr.lx = e.clientX; ptr.ly = e.clientY; ptr.lt = e.timeStamp;
    cam.panBy(-dx, -dy);
  }
  function onUp(e) {
    if (e.pointerId !== ptr.id) return;
    const wasDrag = ptr.drag;
    ptr.id = -1;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    if (wasDrag) {
      if (e.timeStamp - ptr.lt < 90) cam.fling(Math.max(-400, Math.min(400, ptr.vx)), Math.max(-400, Math.min(400, ptr.vy)));
      return;
    }
    if (e.type === 'pointercancel') return;
    const hit = pick(e.clientX, e.clientY);
    if (hit) fx.burst('spark', c2w.x, c2w.y, 3, 16, 0.3, 0, 0);
    if (renderer.onTap) {
      try { renderer.onTap(hit); } catch (err) { console.error('[renderer] onTap', err); }
    }
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const onWinResize = () => resize();
  window.addEventListener('resize', onWinResize);
  window.addEventListener('orientationchange', onWinResize);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => resize()); ro.observe(canvas); }

  // ───────────── juicy feedback: game events → particles / floating text ─────────────
  const offs = [];
  const on = (name, fn) => { game.on(name, fn); offs.push([name, fn]); };
  const ownerPos = () => { const o = game.world.owner; return o ? o : null; };
  const groupHead = (id) => {
    for (const g of game.world.groups) if (g.id === id) return g.members[0] || null;
    return null;
  };
  on('collected', (e) => {
    if (e.x == null) return;
    const player = e.by !== 'staff';
    fx.burst('coin', e.x, e.y - 2, player ? 8 : 3, 46, 0.65, 150, 0.7);
    fx.text('+' + fmtShort(e.amount), e.x, e.y - 8, PAL.gold, 0, player ? 8 : 6.5, 1.15, 20);
  });
  on('bill', (e) => { if (e.x != null && e.tableIdx >= 0) fx.burst('spark', e.x, e.y - 8, 5, 22, 0.5, 20, 0.2); });
  on('served', (e) => {
    if (e.x == null) return;
    fx.burst('spark', e.x, e.y - 8, e.extra ? 3 : 6, 28, 0.5, 30, 0.3);
    if (e.fast && !e.extra) fx.text('Nhanh!', e.x, e.y - 20, PAL.lime, 0, 6.5, 0.95, 12);
  });
  on('combo', (e) => {
    if (e.x == null) return;
    fx.text('Combo x' + e.n + '!', e.x, e.y - 26, e.n >= 5 ? PAL.coral : PAL.gold1, 1, 5.2 + Math.min(e.n, 8) * 0.3, 1.35, 22);
    if (e.n >= 4) fx.burst('confetti', e.x, e.y - 20, Math.min(18, 6 + e.n * 2), 50, 0.9, 120, 0.5);
  });
  on('review', (e) => {
    if (e.x == null || !e.review) return;
    const st = e.review.stars | 0;
    fx.stars(st, e.x, e.y - 30);
    if (st >= 5) fx.puff('heart', e.x, e.y - 22, 5, 1.1, 8);
    else if (st <= 2) fx.puff('smoke', e.x, e.y - 22, 4, 0.9, 6);
  });
  on('xp', (e) => {
    if (e.x == null || !(e.delta > 0)) return;
    fx.text('+' + Math.round(e.delta) + ' XP', e.x, e.y, PAL.mint, 0, 6, 1.05, 14, 0.12);
  });
  on('levelUp', () => fx.flash('level', view));
  on('tierUp', () => fx.flash('tier', view));
  on('ending', () => fx.flash('ending', view));
  on('upgrade', (e) => {
    if (e.x == null) return;
    fx.burst('spark', e.x, e.y - 6, 12, 38, 0.75, 30, 0.2);
    fx.burst('star', e.x, e.y - 8, 4, 30, 0.9, 60, 0.5);
  });
  on('brothStart', (e) => { if (e.x != null) fx.puff('smoke', e.x, e.y - 10, 3, 0.8, 5); });
  on('brothReady', (e) => { if (e.x != null) { fx.burst('spark', e.x, e.y - 12, 8, 30, 0.7, 10, 0.4); fx.puff('smoke', e.x, e.y - 12, 4, 1, 6); } });
  on('ingredientAdded', () => { const o = ownerPos(); if (o) fx.burst('leaf', o.x, o.y - 14, 3, 20, 0.6, 50, 0.4); });
  on('drinksAdded', () => { const o = ownerPos(); if (o) fx.burst('drop', o.x, o.y - 14, 4, 20, 0.6, 60, 0.4); });
  on('customerLeft', (e) => {
    if (!e.angry) return;
    const a = groupHead(e.groupId);
    if (a) fx.puff('smoke', a.x, a.y - 20, 4, 0.8, 5);
  });

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
      case 'eating': {
        const ex = g.extraTicket;
        if (ex && ex.status !== 'dead' && ex.status !== 'done' && ex.extra) {
          bc.icon = 'ing_' + ex.extra;
          bo.patience = 1 - ex.waited / ex.patience;
          bo.pulse = bo.patience < 0.3;
        }
        break;
      }
      case 'waitingDoor':
        bc.icon = 'emo_wait';
        bo.patience = g.doorLeft / (TIME.doorPatience * (g.tutorial ? 3 : 1));
        bo.pulse = bo.patience < 0.3;
        break;
      case 'doorOrder': bc.icon = 'emo_exclaim'; break;
      case 'leaving':
        if (g.angry) bc.icon = 'emo_angry';
        else if (g.stars >= 5) bc.icon = 'emo_love';
        else if (g.stars === 4) bc.icon = 'emo_yum';
        break;
      default: break;
    }
    // soaked in the rain (no tarp): a sweat-drop + how long until they give up and leave
    if (g.wet > 2 && g.state !== 'leaving') {
      bc.icon = 'emo_sweat';
      bo.patience = 1 - g.wet / (RAIN.wetLeaveMin * (g.tutorial ? 3 : 1));
      bo.pulse = true;
    }
    if (bo.patience != null) bo.patience = Math.max(0, Math.min(1, bo.patience));
    return bc.icon !== null;
  }

  function drawBubbles(w) {
    bo.t = time;
    for (const g of w.groups) {
      if (!g.members.length || !bubbleFor(g)) continue;
      const t = g.tableIdx >= 0 && g.state !== 'leaving' ? w.tables[g.tableIdx] : null;
      let x, y;
      if (t) { x = t.x; y = t.y - 31; } else { const a = g.members[0]; x = a.x; y = a.y - 27; }
      drawBubble(bctx, Math.round(x), Math.round(y), bc, bo);
    }
    const v = w.veso;
    if (v && !v.leaving && !v.path) {
      bc.icon = 'ui_ticket'; bo.patience = null; bo.pulse = true;
      drawBubble(bctx, Math.round(v.x), Math.round(v.y - 28), bc, bo);
    }
  }

  // ───────────── shop name on the sign (hi-res) ─────────────
  const fit = { name: '', w: 0, h: 0, sc: 0, fonts: false, px: 10, text: '' };
  // text colours that read on each sign sprite (props.png sign1..4): [fill, outline, night glow]
  const SIGN_INK = [
    null,
    ['#4a2a16', '#fbe7b8', null],                  // 1 tan paper board: dark brown on cream edge
    ['#fff1c9', '#5a1019', PAL.gold1],             // 2 red painted board: cream on deep red
    ['#ffffff', '#12405e', PAL.gold1],             // 3 blue/teal light box: white on navy edge
    ['#8ff0ff', '#0b1346', '#5fe0ff'],             // 4 navy neon: cyan neon with a glow
  ];
  function drawSign(L, s) {
    const sg = L.sign;
    const name = (s.shopName || '').trim();
    const sl = Math.min(4, s.upgrades.sign | 0);
    if (!sg || !name || sl < 1) return;             // no board, no name (level 0 has no sign sprite to put it on)
    const sc = cam.scale;
    const cxd = cam.toDeviceX(sg.x + sg.w / 2), cyd = cam.toDeviceY(sg.y + sg.h / 2);
    if (cxd < -sg.w * sc || cxd > canvas.width + sg.w * sc || cyd < -sg.h * sc || cyd > canvas.height + sg.h * sc) return;
    if (fit.name !== name || fit.w !== sg.w || fit.h !== sg.h || fit.sc !== sc || fit.fonts !== fontsOK) {
      fit.name = name; fit.w = sg.w; fit.h = sg.h; fit.sc = sc; fit.fonts = fontsOK;
      const maxW = sg.w * sc * 0.9, minPx = Math.max(6, Math.round(sg.h * sc * 0.3));
      let px = Math.max(minPx, Math.round(sg.h * sc * 0.62));
      let txt = name;
      ctx.font = `${px}px ${FONT_BUNGEE}`;
      while (px > minPx && ctx.measureText(txt).width > maxW) { px -= 1; ctx.font = `${px}px ${FONT_BUNGEE}`; }
      while (txt.length > 3 && ctx.measureText(txt).width > maxW) { txt = txt.slice(0, -2).trimEnd() + '…'; }
      fit.px = px; fit.text = txt;
    }
    ctx.font = `${fit.px}px ${FONT_BUNGEE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
    const night = s.clock >= 18.5 * 60;
    const ink = SIGN_INK[sl];
    const lit = sl >= 3 && (night || sl === 4);
    const y = Math.round(cyd + fit.px * 0.04);
    ctx.strokeStyle = ink[1];
    ctx.strokeText(fit.text, Math.round(cxd), y);
    if (lit && ink[2]) { ctx.shadowColor = ink[2]; ctx.shadowBlur = Math.round((night ? 9 : 4) * dpr); }
    ctx.fillStyle = lit && night && sl === 3 ? ink[2] : ink[0];
    ctx.fillText(fit.text, Math.round(cxd), y);
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  }

  // ───────────── the frame ─────────────
  function render(dt) {
    if (destroyed || (typeof document !== 'undefined' && document.hidden)) return;
    const s = game.state, w = game.world, L = w.layout;
    if (!L) return;
    if (cssW === 0) resize();
    if (cssW < 2 || cssH < 2) return;
    if (L.w !== coreW || L.h !== coreH || sceneId !== L.scene + ':' + s.tier) {
      const newScene = sceneId !== L.scene + ':' + s.tier;
      refit(newScene);
      if (newScene) { amb.reset(); fx.clear(); }
    }
    dt = Math.min(dt, 0.1);
    time += dt;
    fontsCheckT -= dt;
    if (fontsCheckT <= 0) {
      fontsCheckT = 1;
      try { fontsOK = !!(document.fonts && document.fonts.check(`12px ${FONT_BUNGEE}`)); } catch (e) { fontsOK = false; }
    }

    cam.update(dt);
    const ox = Math.floor(cam.x0), oy = Math.floor(cam.y0);
    view.x0 = ox; view.y0 = oy; view.x1 = ox + bw; view.y1 = oy + bh;
    fx.update(dt, view);
    let wxNow = s.weather;
    try { if (game.get && game.get.weatherNow) wxNow = game.get.weatherNow(); } catch (e) { /* keep the day's weather */ }
    // rain tarp: eases toward open/closed (only the vỉa hè has one)
    const tarpWant = s.today && s.today.tarp && L && L.canopy ? 1 : 0;
    tarpK += Math.sign(tarpWant - tarpK) * Math.min(Math.abs(tarpWant - tarpK), dt / 0.9);
    amb.update(dt, { x0: cam.x0, x1: cam.x0 + cam.viewW, layout: L, clock: s.clock, weather: wxNow, open: s.phase === 'open' });

    // environment handed to the art functions (one object, mutated in place)
    env.t = time; env.clock = s.clock; env.day = s.day; env.weather = wxNow; env.event = s.event; env.tier = s.tier;
    env.layout = L; env.up = s.upgrades; env.deco = s.deco.equipped; env.open = s.phase === 'open' || s.phase === 'closing';
    env.shopName = s.shopName;
    let boiling = 0;
    for (let i = 0; i < w.tables.length; i++) if (w.tables[i].boiling) boiling++;
    env.boiling = boiling;

    // ── pass 1: world into the low-res buffer
    bctx.setTransform(DETAIL, 0, 0, DETAIL, -ox * DETAIL, -oy * DETAIL);
    bctx.imageSmoothingEnabled = false;
    drawSceneBack(bctx, s.tier, env, view);

    poolN = 0; list.length = 0;
    const drawables = sceneDrawables(s.tier, env);
    if (drawables) for (let i = 0; i < drawables.length; i++) push(K_DRAW, drawables[i].y, drawables[i]);
    for (let i = 0; i < w.tables.length; i++) {
      const t = w.tables[i];
      push(K_TABLE, t.y, t);
      if (t.coins) push(K_COINS, t.y + 13.5, t);
    }
    for (let i = 0; i < w.stoves.length; i++) push(K_STOVE, w.stoves[i].sortY != null ? w.stoves[i].sortY : w.stoves[i].y, w.stoves[i]);
    const xl = view.x0 - 24, xr = view.x1 + 24;
    for (let i = 0; i < w.actors.length; i++) {
      const a = w.actors[i];
      if (a.hidden || a.x < xl || a.x > xr) continue;
      push(K_ACTOR, a.y, a);
    }
    for (let i = 0; i < amb.peds.length; i++) push(K_PED, amb.peds[i].y, amb.peds[i]);
    for (let i = 0; i < amb.vehs.length; i++) push(K_VEH, amb.vehs[i].y, amb.vehs[i]);
    sortList();

    // which table the player is working on gets a gold pulse
    let trayTable = -1;
    if (w.tray.ticketId) for (let i = 0; i < w.tickets.length; i++) if (w.tickets[i].id === w.tray.ticketId) { trayTable = w.tickets[i].tableIdx; break; }
    const fT = focusT;
    const up = s.upgrades;

    for (let i = 0; i < list.length; i++) {
      const e = list[i], o = e.o;
      switch (e.k) {
        case K_DRAW: o.draw(bctx); break;
        case K_TABLE: {
          tOpts.style = up.tablestyle | 0; tOpts.tier = s.tier; tOpts.pot = o.pot; tOpts.potFill = o.potFill; tOpts.boiling = o.boiling;
          tOpts.plates = o.plates; tOpts.drinks = o.drinks; tOpts.dirty = o.dirty; tOpts.reserved = o.reserved;
          tOpts.highlight = o.idx === trayTable || (fT !== null && fT.type === 'table' && fT.idx === o.idx); tOpts.t = time;
          drawTable(bctx, L.tables[o.idx], tOpts);
          break;
        }
        case K_STOVE: {
          sOpts.type = up.stovetype | 0; sOpts.pot = o.pot; sOpts.progress = o.progress; sOpts.ready = o.ready; sOpts.portions = o.portions;
          sOpts.maxPortions = o.maxPortions; sOpts.t = time; sOpts.highlight = fT !== null && fT.type === 'stove' && fT.idx === o.idx;
          drawStove(bctx, L.kitchen.stoves[o.idx], sOpts);
          break;
        }
        case K_ACTOR: {
          aOpts.pose = o.pose; aOpts.facing = o.facing; aOpts.carry = o.carry; aOpts.alpha = o.alpha == null ? 1 : o.alpha;
          aOpts.t = time + (o.id % 13) * 0.37;
          drawChar(bctx, lookOf(o), Math.round(o.x), Math.round(o.y), aOpts);
          break;
        }
        case K_COINS: {
          const age = w.time - o.coins.since;
          const k = age / 0.55;
          const bounce = k < 1 && k >= 0 ? 12 * (1 - k) * (1 - k) * Math.abs(Math.cos(k * Math.PI * 2.5)) : 0;
          drawCoinPile(bctx, Math.round(o.x), Math.round(o.y - 3 - bounce), o.coins.amount, time);
          break;
        }
        case K_PED:
          pOpts.facing = o.dir > 0 ? 'right' : 'left'; pOpts.t = o.t;
          drawChar(bctx, o.look, Math.round(o.x), Math.round(o.y), pOpts);
          break;
        case K_VEH: drawVehicle(bctx, o.kind, Math.round(o.x), Math.round(o.y), o.dir, o.t); break;
        default: break;
      }
    }
    drawSceneFront(bctx, s.tier, env, view);
    if (tarpK > 0.01) drawCanopy(bctx, L, tarpK, time);
    const cp = L && L.canopy;
    drawWeather(bctx, view, wxNow, time, cp && tarpK > 0.6 ? { x0: cp.x0, y0: cp.yTop, x1: cp.x1, y1: cp.ground } : null);
    drawLighting(bctx, view, env);
    drawBubbles(w);
    fx.drawParticles(bctx, drawParticle);

    // ── pass 2: integer upscale onto the visible canvas (sub-pixel camera offset in device px)
    const sc = cam.scale;
    let shx = 0, shy = 0;
    if (fx.shake > 0) { shx = Math.round((Math.random() - 0.5) * fx.shake * 14); shy = Math.round((Math.random() - 0.5) * fx.shake * 14); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, bw * DETAIL, bh * DETAIL, shx - Math.round((cam.x0 - ox) * sc), shy - Math.round((cam.y0 - oy) * sc), bw * sc, bh * sc);

    // ── pass 3: hi-res text
    drawSign(L, s);
    fx.drawText(ctx, cam);
    fx.drawScreen(ctx, canvas.width, canvas.height);
  }

  function destroy() {
    destroyed = true;
    for (const [n, f] of offs) game.off(n, f);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', onWinResize);
    window.removeEventListener('orientationchange', onWinResize);
    if (ro) ro.disconnect();
  }

  // load the two display fonts early so the first floating number is not drawn in a fallback face
  try {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('20px "XL Num"', '+0123456789kXP'), document.fonts.load('20px "XL Display"', 'Xoài Lắc Ơi Combo')]).then(() => { fontsOK = true; fit.name = ''; }).catch(() => {});
    }
  } catch (e) { /* fonts API unavailable */ }

  const renderer = {
    canvas,
    render,
    resize,
    pick,
    worldToClient,
    clientToWorld: (cx, cy) => { const p = clientToWorld(cx, cy); return { x: p.x, y: p.y }; },
    flash: (kind = 'gold') => fx.flash(kind, view),
    focus,
    onTap: null,
    destroy,
    detail: DETAIL,
    get scale() { return cam.scale; },
    get camera() { return cam; },
    get fx() { return fx; },
  };
  resize();
  return renderer;
}
