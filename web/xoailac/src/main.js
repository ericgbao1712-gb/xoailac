// Boot (TECH_SPEC §8): save → game → renderer → audio → UI → one rAF loop. UI and audio are optional:
// if their modules fail to load the game still runs (no-op fallbacks), so Core/Render can be tested alone.
import { loadSave, writeSave, OWNER_KEY } from './storage.js';
import { createGame } from './core/game.js';
import { createCounterRenderer as createRenderer } from './render/counter.js';
import { artReady } from './art/index.js';

const AUTOSAVE_SEC = 15;

// The CDN caches style.css (JS is served no-cache), so swap the plain <link> for a versioned one.
// Bump CSS_VER on every deploy that touches style.css.
const CSS_VER = 'xl5-v12';
(function freshCss() {
  try {
    const old = document.querySelector('link[rel="stylesheet"][href="style.css"]');
    if (!old) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'style.css?v=' + CSS_VER;
    link.onload = () => old.remove();
    old.after(link);
  } catch (e) { /* keep the cached sheet */ }
})();
const noopAudio = { unlock() {}, update() {}, setMusic() {}, setSfx() {}, sfx() {} };
const noopUI = { update() {}, onScenePick() {} };

/** Log an error at most a few times per source so a per-frame bug cannot flood the console. */
const seen = Object.create(null);
function report(where, e) {
  seen[where] = (seen[where] || 0) + 1;
  if (seen[where] <= 3) console.error(`[boot] ${where}`, e);
}

function ensureCanvas() {
  let canvas = document.getElementById('scene');
  if (canvas) return canvas;
  const app = document.getElementById('app') || document.body;
  let wrap = document.getElementById('scene-wrap');
  if (!wrap) { wrap = document.createElement('main'); wrap.id = 'scene-wrap'; app.appendChild(wrap); }
  canvas = document.createElement('canvas');
  canvas.id = 'scene';
  wrap.appendChild(canvas);
  return canvas;
}

async function boot() {
  await Promise.race([artReady(), new Promise((r) => setTimeout(r, 4000))]);   // sprites decoded before the first frame (4 s cap)
  const save = await loadSave();
  const game = createGame(save, { now: Date.now() });
  window.__game = game;

  const canvas = ensureCanvas();
  const renderer = createRenderer(canvas, game);
  window.__renderer = renderer;

  let audio = noopAudio;
  try {
    const mod = await import('./audio/index.js?v=a21');
    audio = Object.assign({}, noopAudio, mod.createAudio(game));
  } catch (e) { console.warn('[boot] audio unavailable, continuing without it:', e && e.message); }

  let ui = noopUI;
  try {
    const mod = await import('./ui/index.js');
    ui = Object.assign({}, noopUI, mod.mountUI(game, { renderer, audio }));
  } catch (e) { console.error('[boot] UI failed to load, running scene only:', e); }
  window.__ui = ui;

  // ───────────── input: scene taps ─────────────
  renderer.onTap = (hit) => {
    try { audio.unlock(); } catch (e) { /* audio is optional */ }
    if (!hit) { ui.onScenePick(null); return; }
    if (hit.type === 'coins') game.act.collect(hit.tableIdx);
    else if (hit.type === 'veso') {
      const r = game.act.buyLottery();
      if (r && r.ok === false && r.msg) game.emit('toast', { text: r.msg, kind: 'bad', icon: 'ui_ticket' });
    }
    ui.onScenePick(hit);
  };
  // browsers only start audio after a gesture anywhere on the page
  window.addEventListener('pointerdown', () => { try { audio.unlock(); } catch (e) { /* ignore */ } }, { passive: true });

  // ───────────── saving ─────────────
  // v2.6.23 one writer at a time. Before, every open copy of the game (2 tabs, the installed app + a browser tab, a
  // tab the phone kept in the background, the claude.ai preview + a tab) wrote its own state every 15 s, so an old
  // copy kept overwriting newer progress: the next load came back at a lower level / with other money, and a backup
  // made in that copy was old too.
  // Now the copy that booted last owns the save (it loaded the newest progress). Every other copy stops saving,
  // pauses and shows "Quán đang mở ở nơi khác"; tapping it reloads that copy, which then becomes the owner.
  const TAB = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const owner = () => { try { return localStorage.getItem(OWNER_KEY); } catch (e) { return TAB; } };   // no storage: nothing to guard
  const claim = () => { try { localStorage.setItem(OWNER_KEY, TAB); } catch (e) { /* ignore */ } };
  claim();
  let stale = false;
  function goStale() {
    if (stale) return;
    stale = true;
    try { game.act.pause('stale'); } catch (e) { /* ignore */ }
    showStale();
  }
  const persist = () => {
    if (stale || !game.state.started) return;
    const o = owner();
    if (o === null) claim();                                // owner mark cleared (site data wiped): take it back
    else if (o !== TAB) { goStale(); return; }            // another copy took over: never write over its progress
    writeSave(game.serialize());
  };
  window.__persist = persist;
  window.addEventListener('storage', (e) => {
    if (e.key === OWNER_KEY && e.newValue && e.newValue !== TAB) goStale();
  });
  setInterval(() => persist(), AUTOSAVE_SEC * 1000);
  game.on('dayEnd', () => persist());
  game.on('tierUp', () => persist());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { persist(); game.act.pause('hidden'); } else { const o = owner(); if (!stale && o !== null && o !== TAB) goStale(); game.act.resume('hidden'); }
  });
  window.addEventListener('pagehide', () => persist());
  if (document.hidden) game.act.pause('hidden');

  // ───────────── main loop ─────────────
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
    last = now;
    try { game.update(dt); } catch (e) { report('game.update', e); }
    try { renderer.render(dt); } catch (e) { report('renderer.render', e); }
    try { ui.update(dt); } catch (e) { report('ui.update', e); }
    try { audio.update(dt); } catch (e) { report('audio.update', e); }
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => console.error('[boot] fatal', e));

/** v2.6.23 "this copy is old" cover: blocks play (and backups) until the player reloads the newest save. */
function showStale() {
  try {
    if (document.getElementById('stale-ov')) return;
    const ov = document.createElement('div');
    ov.id = 'stale-ov';
    ov.setAttribute('role', 'alertdialog');
    ov.innerHTML = '<div class="stale-card"><b>Quán đang mở ở nơi khác</b>'
      + '<p>Quán này vừa được mở ở một tab hoặc cửa sổ khác. Bản ở đây có thể đã cũ, nên game ngừng lưu ở đây để không ghi đè tiến trình mới.</p>'
      + '<button type="button" class="btn red">Chơi ở đây (tải bản mới nhất)</button></div>';
    ov.querySelector('button').addEventListener('click', () => { try { location.reload(); } catch (e) { /* ignore */ } });
    (document.getElementById('app') || document.body).appendChild(ov);
  } catch (e) { /* ignore */ }
}

// v2.6.6: install as an app (Android/desktop "Cài đặt", offline start). Only on a real http(s) origin; inside a
// sandboxed preview (no service workers) it just does nothing.
try {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[sw] not registered:', e && e.message)); });
  }
} catch (e) { /* not installable here, the game still runs */ }
