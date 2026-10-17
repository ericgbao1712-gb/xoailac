// Ambience layers: boiling-pot loop (+ bubbles), rain loop (+ distant thunder), occasional motorbike pass.
// All of them route to k.ambBus (which is scaled by the SFX volume). Loop layers are built lazily and torn
// down after a few idle seconds so a quiet screen costs nothing.

import { EPS, clamp, lerp } from './util.js';
import { loopSource, makeGain, makeFilter, tone } from './kit.js';

// ───────────── game-state readers (adjust these if the Core's shape differs) ─────────────

function isList(a) { return a && typeof a.length === 'number'; }

// Number of pots currently bubbling: stoves with a pot (cooking or ready) + tables / eating groups.
// Tables and groups describe the same thing from two sides, so the larger of the two is used (no double count).
export function boilingCount(game) {
  const w = game && game.world;
  if (!w) return 0;
  let n = 0;
  const stoves = w.stoves;
  if (isList(stoves)) {
    for (let i = 0; i < stoves.length; i++) {
      const s = stoves[i];
      if (s && s.pot) n++;
    }
  }
  let tableN = 0;
  const tables = w.tables;
  if (isList(tables)) {
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      if (t && (t.boiling || t.pot)) tableN++;
    }
  }
  let eatN = 0;
  const groups = w.groups;
  if (isList(groups)) {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g && (g.state === 'eating' || g.status === 'eating')) eatN++;
    }
  }
  return n + (tableN > eatN ? tableN : eatN);
}

// Boil loudness 0..1 from the count: 0 silent, 1 soft, 5+ max.
const BOIL_CURVE = [0, 0.26, 0.42, 0.56, 0.7, 0.85, 1];
export function boilLevel(count) {
  if (!(count > 0)) return 0;
  const c = Math.min(count, BOIL_CURVE.length - 1);
  const i = Math.floor(c);
  if (i >= BOIL_CURVE.length - 1) return 1;
  return lerp(BOIL_CURVE[i], BOIL_CURVE[i + 1], c - i);
}

// Rain loudness factor: 0 none, 0.5 rain, 1 storm; halved while preparing, silent on the report.
export function rainLevel(weather, phase) {
  if (phase === 'report') return 0;
  let l = weather === 'storm' ? 1 : weather === 'rain' ? 0.5 : 0;
  if (phase === 'prep') l *= 0.5;
  return l;
}

// ───────────── tunables ─────────────
const BOIL_MAX_DB = -16.5;                              // gain-node value at 5+ pots (before the SFX slider)
const BOIL_MAX = Math.pow(10, BOIL_MAX_DB / 20);
const RAIN_MAX = 0.065;                               // gain-node value in a storm (rain = half)
const BOIL_TC = 0.5;                                  // smoothing time constant (s)
const RAIN_TC = 0.9;
const IDLE_TEARDOWN = 4;                              // seconds at zero level before a loop layer is stopped

function stopAll(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    try { if (nodes[i].stop) nodes[i].stop(); } catch (e) { /* not started */ }
    try { nodes[i].disconnect(); } catch (e) { /* ok */ }
  }
}

export function createAmbience(k) {
  const ctx = k.ctx;
  const rng = k.rng;

  let boil = null;     // { out, nodes }
  let rain = null;
  let boilIdle = 0;
  let rainIdle = 0;
  let boilLvl = 0;
  let bubbleT = 1;
  let thunderT = 0;
  let bikeT = -1; // -1 = not armed yet
  let wasStorm = false;
  const stats = { bubbles: 0, thunders: 0, bikes: 0 };

  // ── boiling: bandpassed noise with a drifting centre + low rumble ──
  function buildBoil() {
    const out = makeGain(ctx, 0);
    out.connect(k.ambBus);
    const nodes = [out];

    const s1 = loopSource(k, 'white');
    const bp = makeFilter(ctx, 'bandpass', 950, 0.9);
    const lp = makeFilter(ctx, 'lowpass', 3000, 0.5);
    const g1 = makeGain(ctx, 0.85);
    s1.connect(bp); bp.connect(lp); lp.connect(g1); g1.connect(out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.27;
    const lfoG = makeGain(ctx, 330); // +-330 Hz drift of the band centre (600..1300 Hz)
    lfo.connect(lfoG); lfoG.connect(bp.frequency);
    lfo.start();
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.43;
    const lfo2G = makeGain(ctx, 0.22);
    lfo2.connect(lfo2G); lfo2G.connect(g1.gain);
    lfo2.start();

    const s2 = loopSource(k, 'brown');
    const lp2 = makeFilter(ctx, 'lowpass', 360, 0.6);
    const g2 = makeGain(ctx, 1.1);
    s2.connect(lp2); lp2.connect(g2); g2.connect(out);

    nodes.push(s1, bp, lp, g1, lfo, lfoG, lfo2, lfo2G, s2, lp2, g2);
    return { out, nodes };
  }

  // ── rain: highpassed + lowpassed noise with slow level / brightness drift ──
  function buildRain() {
    const out = makeGain(ctx, 0);
    out.connect(k.ambBus);
    const nodes = [out];
    const s = loopSource(k, 'white');
    const hp = makeFilter(ctx, 'highpass', 900, 0.6);
    const lp = makeFilter(ctx, 'lowpass', 6500, 0.5);
    const mod = makeGain(ctx, 0.88);
    s.connect(hp); hp.connect(lp); lp.connect(mod); mod.connect(out);
    const lfoA = ctx.createOscillator();
    lfoA.frequency.value = 0.13;
    const lfoAG = makeGain(ctx, 0.12);
    lfoA.connect(lfoAG); lfoAG.connect(mod.gain);
    lfoA.start();
    const lfoB = ctx.createOscillator();
    lfoB.frequency.value = 0.05;
    const lfoBG = makeGain(ctx, 1000);
    lfoB.connect(lfoBG); lfoBG.connect(lp.frequency);
    lfoB.start();
    // a second, darker patter layer for body
    const s2 = loopSource(k, 'white');
    const bp2 = makeFilter(ctx, 'bandpass', 2200, 0.45);
    const g2 = makeGain(ctx, 0.5);
    s2.connect(bp2); bp2.connect(g2); g2.connect(out);
    nodes.push(s, hp, lp, mod, lfoA, lfoAG, lfoB, lfoBG, s2, bp2, g2);
    return { out, nodes };
  }

  function setBoil(level, now, immediate) {
    boilLvl = level;
    if (level > 0.001) {
      boilIdle = 0;
      if (!boil) boil = buildBoil();
      const v = level * BOIL_MAX;
      if (immediate) boil.out.gain.value = v;
      else boil.out.gain.setTargetAtTime(v, now, BOIL_TC);
    } else if (boil) {
      if (immediate) boil.out.gain.value = 0;
      else boil.out.gain.setTargetAtTime(0, now, BOIL_TC);
    }
  }

  function setRain(level, now, immediate) {
    if (level > 0.001) {
      rainIdle = 0;
      if (!rain) rain = buildRain();
      const v = level * RAIN_MAX;
      if (immediate) rain.out.gain.value = v;
      else rain.out.gain.setTargetAtTime(v, now, RAIN_TC);
    } else if (rain) {
      if (immediate) rain.out.gain.value = 0;
      else rain.out.gain.setTargetAtTime(0, now, RAIN_TC);
    }
  }

  // ── one-shot pieces ──
  function bubble(t, level) {
    const lv = level === undefined ? boilLvl : level;
    const f0 = 150 + rng() * 70;
    const f1 = f0 * (2.0 + rng() * 0.45); // ~180 -> ~420 Hz in 60 ms
    const vol = 0.03 + 0.06 * lv;
    const pan = (rng() * 2 - 1) * 0.4;
    tone(k, k.ambBus, { type: 'sine', f: f1, from: f0, glideT: 0.06, t, dur: 0.11, vol, a: 0.003, pan, noDetune: true });
    stats.bubbles++;
  }

  function thunder(t, strength) {
    const s = strength === undefined ? 1 : strength;
    const src = ctx.createBufferSource();
    src.buffer = k.noise.brown;
    const lp1 = makeFilter(ctx, 'lowpass', 150, 0.7);
    const lp2 = makeFilter(ctx, 'lowpass', 260, 0.5);
    const g = ctx.createGain();
    const pk = 0.24 * s;
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.5);
    g.gain.exponentialRampToValueAtTime(pk * 0.35, t + 1.3);
    g.gain.linearRampToValueAtTime(pk * 0.6, t + 1.7); // a second, smaller roll
    g.gain.exponentialRampToValueAtTime(EPS, t + 4.2);
    src.connect(lp1); lp1.connect(lp2); lp2.connect(g);
    let out = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = (rng() * 2 - 1) * 0.5;
      g.connect(p);
      out = p;
    }
    out.connect(k.ambBus);
    src.start(t, rng() * Math.max(0, src.buffer.duration - 4.6));
    src.stop(t + 4.4);
    tone(k, out, { type: 'sine', f: 46 + rng() * 14, t, dur: 3.2, vol: 0.06 * s, a: 0.5, noDetune: true });
    stats.thunders++;
  }

  // Motorbike pass: sawtooth+square engine through a moving lowpass, tremolo "put-put", doppler pitch bend,
  // stereo pan sweep. Very quiet by design.
  function bike(t, dirOverride) {
    const dur = 2.8 + rng() * 1.4;
    const dir = dirOverride !== undefined ? dirOverride : (rng() < 0.5 ? -1 : 1);
    const base = 62 + rng() * 38;
    const peak = 0.034 + rng() * 0.012;
    const mid = t + dur * 0.46;
    const end = t + dur;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    const sub = makeGain(ctx, 0.5);
    o1.frequency.setValueAtTime(base * 1.1, t);
    o1.frequency.exponentialRampToValueAtTime(base * 1.0, mid);
    o1.frequency.exponentialRampToValueAtTime(base * 0.84, end);
    o2.frequency.setValueAtTime(base * 0.55, t);
    o2.frequency.exponentialRampToValueAtTime(base * 0.5, mid);
    o2.frequency.exponentialRampToValueAtTime(base * 0.42, end);
    const lp = makeFilter(ctx, 'lowpass', 420, 0.8);
    lp.frequency.setValueAtTime(380, t);
    lp.frequency.exponentialRampToValueAtTime(900, mid);
    lp.frequency.exponentialRampToValueAtTime(340, end);
    const trem = makeGain(ctx, 0.62);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13 + rng() * 6;
    const lfoG = makeGain(ctx, 0.38);
    lfo.connect(lfoG); lfoG.connect(trem.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(EPS, t);
    env.gain.exponentialRampToValueAtTime(peak, mid);
    env.gain.exponentialRampToValueAtTime(EPS, end);
    o1.connect(lp); o2.connect(sub); sub.connect(lp);
    lp.connect(trem); trem.connect(env);
    let out = env;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(0.85 * dir * -1, t);
      p.pan.linearRampToValueAtTime(0.85 * dir, end);
      env.connect(p);
      out = p;
    }
    out.connect(k.ambBus);
    o1.start(t); o2.start(t); lfo.start(t);
    o1.stop(end + 0.05); o2.stop(end + 0.05); lfo.stop(end + 0.05);
    // now and then a polite double beep as it passes
    if (rng() < 0.12) {
      tone(k, out, { type: 'triangle', f: 470, t: mid - 0.1, dur: 0.07, vol: 0.016, a: 0.004, lp: 1500, noDetune: true });
      tone(k, out, { type: 'triangle', f: 470, t: mid + 0.06, dur: 0.08, vol: 0.016, a: 0.004, lp: 1500, noDetune: true });
    }
    stats.bikes++;
    return dur;
  }

  // Called each frame from the engine (no allocations). `now` = ctx.currentTime.
  function tick(dt, now, opts) {
    // bubbles
    if (boilLvl > 0.02 && boil) {
      bubbleT -= dt;
      let guard = 0;
      while (bubbleT <= 0 && guard++ < 3) {
        bubble(now + 0.005, boilLvl);
        const rate = 0.7 + 7 * boilLvl; // bubbles per second
        bubbleT += -Math.log(1 - rng() * 0.999) / rate;
      }
      if (bubbleT < -1) bubbleT = 0.2;
    }
    // idle teardown
    if (boil && boilLvl <= 0.001) {
      boilIdle += dt;
      if (boilIdle > IDLE_TEARDOWN) { stopAll(boil.nodes); boil = null; }
    }
    if (rain && !opts.rain) {
      rainIdle += dt;
      if (rainIdle > IDLE_TEARDOWN + 2) { stopAll(rain.nodes); rain = null; }
    }
    // thunder
    if (opts.storm) {
      if (!wasStorm) { thunderT = 5 + rng() * 12; wasStorm = true; }
      thunderT -= dt;
      if (thunderT <= 0) {
        thunder(now + 0.02, 0.7 + rng() * 0.5);
        thunderT = 15 + rng() * 25;
      }
    } else wasStorm = false;
    // motorbike (countdown only runs while the shop is open; the first one comes 20-45 s after arming)
    if (opts.bike) {
      if (bikeT < 0) bikeT = 20 + rng() * 25;
      else {
        bikeT -= dt;
        if (bikeT <= 0) {
          bike(now + 0.05);
          bikeT = 20 + rng() * 25;
        }
      }
    }
  }

  function stop() {
    if (boil) { stopAll(boil.nodes); boil = null; }
    if (rain) { stopAll(rain.nodes); rain = null; }
  }

  return {
    setBoil, setRain, tick, bubble, thunder, bike, stop, stats,
    boilRunning() { return !!boil; },
    rainRunning() { return !!rain; },
  };
}
