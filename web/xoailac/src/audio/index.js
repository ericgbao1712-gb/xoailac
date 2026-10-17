// Lẩu Ơi! - procedural WebAudio engine (no audio files).
//
//   import { createAudio } from './audio/index.js'
//   const audio = createAudio(game)   // -> { unlock(), update(dt), setMusic(v), setSfx(v), sfx(name, opts?) }
//
// Nothing touches AudioContext until a user gesture (unlock). Everything is wrapped so a missing / failing
// WebAudio can never throw into the game.
//
// Game fields read (all optional-chained / defensive):
//   game.state.phase ('prep'|'open'|'closing'|'report'), .clock (game minutes), .weather, .started,
//   game.state.settings.music / .sfx (0..1)
//   game.world.stoves[i].pot, game.world.tables[i].boiling|pot, game.world.groups[i].state|status === 'eating'
//   (see boilingCount() in ambience.js - the one place to adapt)
//   game.on / game.off for the events in events.js

import {
  clamp, volCurve, mulberry32, makeNoiseBuffer, makeImpulse, makeSoftClipCurve,
} from './util.js';
import { makeGain, makeDeferred } from './kit.js';
import { createSfx, SFX_NAMES } from './sfx.js';
import { createBgm } from './bgm.js?v=a21';   // v2.6.21: versioned so an old cached copy can't drop the new songs
import { createAmbience, boilingCount, boilLevel, rainLevel } from './ambience.js';
import { wireEvents } from './events.js';
import { SONGS } from '../config.js';

export { boilingCount, boilLevel, rainLevel, SFX_NAMES };

const DEFAULT_MUSIC = 0.6;
const DEFAULT_SFX = 0.8;
const NIGHT_FROM = 18.5 * 60;   // clock (game minutes) when the night BGM takes over
const MUSIC_TRIM = 1.4;         // overall BGM level at slider = 1 (tuned with the offline renders)
const MASTER = 0.9;
const VARIANT_HOLD = 4;         // min seconds between BGM variant switches (no flip-flopping)

// v2.6.20: each Loa nhạc level adds songs; while the shop is open the radio rotates through what's unlocked
// every SONG_MIN game minutes (day and night have their own playlists).
// v2.6.21: settings.song picks one song (any unlocked one); it plays from the morning until the day report.
export const SONG_NAMES = Object.fromEntries(SONGS.map((x) => [x.id, x.name]));
const SONG_MIN = 75;
const speakerLv = (state) => Math.max(0, (state && state.upgrades && state.upgrades.speaker) | 0);
export function songUnlocked(state, id) { const sg = SONGS.find((x) => x.id === id); return !!sg && speakerLv(state) >= sg.lv; }
export function playlistOf(state, night) {
  const lv = speakerLv(state);
  return SONGS.filter((x) => x.lv <= lv && (x.time === 'both' || x.time === (night ? 'night' : 'day'))).map((x) => x.id);
}
export function pickVariant(state) {
  const ph = state && state.phase;
  const pick = state && state.settings && state.settings.song;
  if (pick && pick !== 'auto' && ph !== 'report' && songUnlocked(state, pick)) return pick;
  if (ph === 'open' || ph === 'closing') {
    const night = state.clock >= NIGHT_FROM;
    const list = playlistOf(state, night);
    if (list.length === 1) return list[0];
    const slot = Math.floor(Math.max(0, state.clock - (night ? NIGHT_FROM : 0)) / SONG_MIN) + ((state.day | 0) * 3);
    return list[slot % list.length];
  }
  return 'calm';
}

function num(v, d) { return typeof v === 'number' && isFinite(v) ? clamp(v, 0, 1) : d; }

// ───────────────────────────── engine (context injected, testable offline) ─────────────────────────────
// opts: { rng, manual (no timers / visibility), music, sfx (initial 0..1, applied immediately) }
export function _createEngine(ctx, game, opts) {
  const o = opts || {};
  const rng = o.rng || Math.random;
  const manual = !!o.manual;

  const k = { ctx, rng, voiceDetune: 0, curEnd: 0 };
  k.noise = {
    white: makeNoiseBuffer(ctx, 2.5, 'white', rng),
    brown: makeNoiseBuffer(ctx, 6, 'brown', rng),
  };
  const def = makeDeferred(ctx);
  k.defer = def.defer;
  k.sweep = def.sweep;

  // master chain: master -> compressor -> soft clipper (hard ceiling < 1) -> destination
  const master = makeGain(ctx, MASTER);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSoftClipCurve();
  master.connect(comp); comp.connect(shaper); shaper.connect(ctx.destination);

  const musicGain = makeGain(ctx, 0);
  const sfxGain = makeGain(ctx, 0);
  musicGain.connect(master);
  sfxGain.connect(master);
  k.musicIn = makeGain(ctx, 1); k.musicIn.connect(musicGain);
  k.sfxBus = makeGain(ctx, 1); k.sfxBus.connect(sfxGain);
  k.ambBus = makeGain(ctx, 1); k.ambBus.connect(sfxGain);

  // shared convolution reverb (generated impulse ~1.6 s), returns into the music bus
  k.reverbIn = makeGain(ctx, 1);
  try {
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 1.6, rng);
    const ret = makeGain(ctx, 0.85);
    k.reverbIn.connect(conv); conv.connect(ret); ret.connect(k.musicIn);
  } catch (e) { /* no convolver: dry music */ }

  // shared short echo for SFX tails (bells, fanfares), returns into the sfx bus
  k.echoIn = makeGain(ctx, 1);
  {
    const ed = ctx.createDelay(1);
    ed.delayTime.value = 0.19;
    const elp = ctx.createBiquadFilter();
    elp.type = 'lowpass'; elp.frequency.value = 2400; elp.Q.value = 0.4;
    const efb = makeGain(ctx, 0.32);
    const eout = makeGain(ctx, 0.7);
    k.echoIn.connect(ed); ed.connect(elp); elp.connect(efb); efb.connect(ed);
    elp.connect(eout); eout.connect(k.sfxBus);
  }

  const sfxPlayer = createSfx(k);
  const bgm = createBgm(k, { manual });
  const amb = createAmbience(k);

  let musicVol = num(o.music, DEFAULT_MUSIC);
  let sfxVol = num(o.sfx, DEFAULT_SFX);
  let seenMusic = null;
  let seenSfx = null;
  let hidden = false;
  let variantHold = 0;
  let seenSong = null;
  let slow = 1;
  let lastCount = 0;
  const ambOpts = { rain: false, storm: false, bike: false };

  function setMusic(v, immediate) {
    musicVol = num(v, musicVol);
    const g = volCurve(musicVol) * MUSIC_TRIM;
    if (immediate) musicGain.gain.value = g;
    else musicGain.gain.setTargetAtTime(g, ctx.currentTime, 0.06);
  }
  function setSfx(v, immediate) {
    sfxVol = num(v, sfxVol);
    const g = volCurve(sfxVol);
    if (immediate) sfxGain.gain.value = g;
    else sfxGain.gain.setTargetAtTime(g, ctx.currentTime, 0.06);
  }
  setMusic(musicVol, true);
  setSfx(sfxVol, true);

  function sfx(name, popts) {
    try { return sfxPlayer.play(name, popts); } catch (e) { return false; }
  }

  function setHidden(h) {
    hidden = !!h;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(hidden ? 0 : MASTER, now, 0.04);
  }

  function update(dt) {
    const state = game && game.state;
    if (!state) return;
    if (!(dt > 0)) dt = 0;
    else if (dt > 0.5) dt = 0.5;
    const now = ctx.currentTime;
    k.sweep(now);

    // settings written through game.act.setSetting are picked up here
    const set = state.settings;
    if (set) {
      if (typeof set.music === 'number' && set.music !== seenMusic) {
        seenMusic = set.music;
        if (set.music !== musicVol) setMusic(set.music);
      }
      if (typeof set.sfx === 'number' && set.sfx !== seenSfx) {
        seenSfx = set.sfx;
        if (set.sfx !== sfxVol) setSfx(set.sfx);
      }
    }

    // BGM variant (a song picked in Settings switches right away)
    variantHold -= dt;
    const songSet = set && set.song;
    if (songSet !== seenSong) { seenSong = songSet; variantHold = 0; }
    const want = pickVariant(state);
    const have = bgm.current();
    if (want !== have && (have === null || variantHold <= 0)) {
      bgm.setVariant(want);
      variantHold = VARIANT_HOLD;
    }

    // ambience targets (4 Hz is plenty)
    slow += dt;
    if (slow >= 0.25) {
      slow = 0;
      const phase = state.phase;
      lastCount = phase === 'report' ? 0 : boilingCount(game);
      amb.setBoil(0, now);                  // Xoài Lắc: no boiling pots, keep the boil layer silent
      let wx = state.weather;
      try { if (game.get && game.get.weatherNow) wx = game.get.weatherNow(); } catch (e) { /* keep the day's weather */ }
      const rl = rainLevel(wx, phase);
      amb.setRain(rl, now);
      ambOpts.rain = rl > 0;
      ambOpts.storm = rl > 0 && wx === 'storm';
      ambOpts.bike = phase === 'open' || phase === 'closing';
    }
    amb.tick(dt, now, ambOpts);
  }

  function start() { bgm.start(); }

  function dispose() {
    bgm.stop();
    amb.stop();
  }

  return {
    ctx, k, bgm, amb, sfxPlayer,
    sfx, update, start, dispose, setMusic, setSfx, setHidden,
    debug() {
      return { variant: bgm.current(), boilCount: lastCount, ambOpts, musicVol, sfxVol, hidden };
    },
    nodes: { master, comp, shaper, musicGain, sfxGain },
  };
}

// ───────────────────────────── public API ─────────────────────────────
export function createAudio(game) {
  let ctx = null;
  let engine = null;
  let disposed = false;
  let hideTimer = null;
  let gestureOn = false;
  let explicitMusic = null; // set when setMusic()/setSfx() were called before the engine exists
  let explicitSfx = null;
  function settingsNow() { return (game && game.state && game.state.settings) || {}; }

  function play(name, opts) {
    if (!engine) return;
    try { engine.sfx(name, opts); } catch (e) { /* never throw into the game */ }
  }
  let unwire = null;
  try { unwire = wireEvents(game, play); } catch (e) { unwire = null; }

  function onGesture() { unlock(); }
  function addGestureListeners() {
    if (gestureOn || typeof window === 'undefined') return;
    gestureOn = true;
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    window.addEventListener('touchstart', onGesture, true);
  }
  function removeGestureListeners() {
    if (!gestureOn || typeof window === 'undefined') return;
    gestureOn = false;
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    window.removeEventListener('touchstart', onGesture, true);
  }

  function onRunning() {
    if (ctx && ctx.state === 'running') removeGestureListeners();
  }

  function unlock() {
    if (disposed) return;
    try {
      if (!ctx) {
        const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
        if (!AC) { removeGestureListeners(); return; }
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
        const st = settingsNow();
        engine = _createEngine(ctx, game, {
          music: explicitMusic !== null ? explicitMusic : num(st.music, DEFAULT_MUSIC),
          sfx: explicitSfx !== null ? explicitSfx : num(st.sfx, DEFAULT_SFX),
        });
        // keep the context alive across interruptions (iOS calls, tab switches)
        ctx.onstatechange = () => {
          if (!ctx) return;
          if (ctx.state === 'running') removeGestureListeners();
          else if (!(typeof document !== 'undefined' && document.hidden)) addGestureListeners();
        };
        // iOS: a (silent) started source inside the gesture fully unlocks output
        try {
          const b = ctx.createBuffer(1, 1, 22050);
          const s = ctx.createBufferSource();
          s.buffer = b; s.connect(ctx.destination); s.start(0);
        } catch (e) { /* ignore */ }
        engine.start();
      }
      if (ctx.state !== 'running') {
        const p = ctx.resume();
        if (p && p.then) p.then(onRunning, () => {});
      } else {
        onRunning();
      }
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[audio] unlock failed:', e);
    }
  }

  function onVisibility() {
    if (!ctx || !engine) return;
    const h = typeof document !== 'undefined' && document.hidden;
    try {
      engine.setHidden(h);
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (h) {
        hideTimer = setTimeout(() => {
          hideTimer = null;
          if (document.hidden && ctx && ctx.state === 'running') {
            const p = ctx.suspend();
            if (p && p.catch) p.catch(() => {});
          }
        }, 250);
      } else if (ctx.state !== 'running') {
        const p = ctx.resume();
        if (p && p.then) p.then(onRunning, () => {});
      }
    } catch (e) { /* ignore */ }
  }

  addGestureListeners();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  function update(dt) {
    if (!engine) return;
    try { engine.update(dt); } catch (e) { /* ignore */ }
  }
  function setMusic(v) {
    if (engine) { try { engine.setMusic(v); } catch (e) { /* ignore */ } }
    else explicitMusic = num(v, num(settingsNow().music, DEFAULT_MUSIC));
  }
  function setSfx(v) {
    if (engine) { try { engine.setSfx(v); } catch (e) { /* ignore */ } }
    else explicitSfx = num(v, num(settingsNow().sfx, DEFAULT_SFX));
  }
  function dispose() {
    disposed = true;
    removeGestureListeners();
    if (unwire) { try { unwire(); } catch (e) { /* ignore */ } }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    if (hideTimer) clearTimeout(hideTimer);
    if (engine) { try { engine.dispose(); } catch (e) { /* ignore */ } }
    if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } }
    ctx = null; engine = null;
  }

  return {
    unlock, update, setMusic, setSfx, sfx: play, dispose,
    _debug() { return { ctx, engine }; }, // for the dev test page only
  };
}
