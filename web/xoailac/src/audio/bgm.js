// Generative lo-fi BGM in the Vietnamese pentatonic (C D F G A).
// Three variants (day / night / calm), each with its own bus gain so they crossfade cleanly. Only the active
// variant schedules notes (lookahead scheduler); the old one simply rings out while its bus fades.
//
// Layers: soft kick / hat / rim-snare, đàn-tranh-like pluck melody (a 1-2 bar motif that repeats with small
// mutations, with rests and breathing bars), warm detuned pad on chord tones, soft sine bass, delay + a shared
// generated convolution reverb.

import { EPS, clamp, cents, mtof, pentHz, pentMidi } from './util.js';
import { makeGain } from './kit.js';

export const LOOKAHEAD = 0.25; // s of music scheduled ahead of ctx.currentTime
export const TICK_MS = 25;     // scheduler interval

// Pad voicings are built only from C D F G A (+ the occasional chord-colour tone) -> open, "sus" sounding chords.
const CHORDS = {
  C:  { root: 48, tones: [55, 60, 62, 67] },   // C  (G C D G)
  Am: { root: 45, tones: [57, 60, 62, 67] },   // Am7(add11)
  F:  { root: 41, tones: [53, 57, 60, 67] },   // Fadd9
  G:  { root: 43, tones: [55, 60, 62, 65] },   // G7sus4
  Dm: { root: 50, tones: [57, 60, 62, 65] },   // Dm7
};
for (const key in CHORDS) {
  const c = CHORDS[key];
  const pcs = [c.root % 12];
  for (let i = 0; i < c.tones.length; i++) pcs.push(c.tones[i] % 12);
  c.pcs = pcs;
}

// Per-step probabilities (16th-note grid, one bar).
const P = (a) => a;
const VARIANTS = {
  day: {
    bpm: 92, swing: 0.11, drums: 1,
    padLp: 1900, padAtk: 0.55, padVol: 0.012,
    pluckLp: 3400, pluckVol: 1.0,
    bassVol: 0.06, bassLp: 600,
    kickVol: 0.11, hatVol: 0.03, snareVol: 0.055,
    kickPat: P([1, 0, 0, 0, 0, 0, 0, 0.22, 0, 0, 0.8, 0, 0, 0, 0.12, 0]),
    snarePat: P([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
    hatPat: P([0.9, 0.18, 0.85, 0.18, 0.9, 0.18, 0.85, 0.15, 0.9, 0.18, 0.85, 0.18, 0.9, 0.18, 0.85, 0.3]),
    bassPat: [[0, 1, 0, 6, 1], [6, 0.5, 7, 2, 0.7], [10, 0.65, 0, 4, 0.85]],
    motifNotes: 5, keep: 0.93, maxPerBar: 4, restBar: 0.2,
    delaySend: 0.2, fb: 0.3, delayLp: 2400, revSend: 0.2, revPad: 0.16,
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'Am', 'G'], ['Am', 'F', 'C', 'G'], ['C', 'Am', 'Dm', 'G'], ['C', 'G', 'Am', 'F']],
  },
  night: {
    bpm: 78, swing: 0.15, drums: 0.55,
    padLp: 1150, padAtk: 0.8, padVol: 0.013,
    pluckLp: 2300, pluckVol: 0.95,
    bassVol: 0.06, bassLp: 500,
    kickVol: 0.10, hatVol: 0.024, snareVol: 0.045,
    kickPat: P([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.55, 0, 0, 0, 0, 0]),
    snarePat: P([0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0]),
    hatPat: P([0, 0, 0.75, 0, 0, 0, 0.7, 0, 0, 0, 0.75, 0, 0, 0, 0.7, 0.2]),
    bassPat: [[0, 1, 0, 8, 1], [10, 0.5, 0, 4, 0.8]],
    motifNotes: 4, keep: 0.9, maxPerBar: 3, restBar: 0.3,
    delaySend: 0.36, fb: 0.42, delayLp: 1700, revSend: 0.42, revPad: 0.3,
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'Dm', 'F', 'G'], ['Am', 'G', 'F', 'C'], ['F', 'C', 'G', 'Am'], ['Am', 'F', 'Dm', 'G']],
  },
  calm: {
    bpm: 70, swing: 0.08, drums: 0,
    padLp: 1400, padAtk: 1.2, padVol: 0.015,
    pluckLp: 2600, pluckVol: 0.85,
    bassVol: 0.05, bassLp: 450,
    kickVol: 0, hatVol: 0, snareVol: 0,
    kickPat: null, snarePat: null, hatPat: null,
    bassPat: [[0, 0.8, 0, 14, 0.8]],
    motifNotes: 3, keep: 0.8, maxPerBar: 2, restBar: 0.45,
    delaySend: 0.34, fb: 0.4, delayLp: 1800, revSend: 0.45, revPad: 0.35,
    progs: [['C', 'F', 'C', 'G'], ['C', 'Am', 'F', 'G'], ['F', 'C', 'G', 'C'], ['Am', 'F', 'C', 'G']],
  },
};
export const VARIANT_NAMES = Object.keys(VARIANTS);

const ONSET_POOL = [0, 3, 6, 8, 10, 12, 14]; // pleasant, slightly syncopated 16th positions within a bar
const EMPTY = [];
const STEPS_PER_LOOP = 64;                   // 4 bars x 16 sixteenths

function newStats() {
  return { kick: 0, hat: 0, snare: 0, pad: 0, bass: 0, pluck: 0, bars: 0 };
}

export function createBgm(k, opts) {
  const ctx = k.ctx;
  const rng = k.rng;
  const manual = !!(opts && opts.manual);
  const buses = {};
  const stats = { day: newStats(), night: newStats(), calm: newStats() };
  const layers = { pad: true, bass: true, drums: true, pluck: true }; // dev switches (stem renders in tests)

  let cur = null;
  let cfg = null;
  let bus = null;
  let st = null;            // stats for the current variant
  let nextT = 0;
  let stepIdx = 0;
  let stepDur = 0.16;
  let cycle = 0;
  let chords = null;
  let lastProg = null;
  let motifA = null;
  let motifB = null;
  const rest = [false, false, false, false];
  let barNotes = 0;
  let timer = null;

  // ───────── buses ─────────
  function getBus(name) {
    if (buses[name]) return buses[name];
    const c = VARIANTS[name];
    const inG = makeGain(ctx, 0);
    inG.connect(k.musicIn);

    const pluckBus = makeGain(ctx, 1);
    pluckBus.connect(inG);
    const dl = ctx.createDelay(2);
    dl.delayTime.value = (60 / c.bpm) * 0.75; // dotted eighth
    const dsend = makeGain(ctx, c.delaySend);
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = c.delayLp; dlp.Q.value = 0.4;
    const fb = makeGain(ctx, c.fb);
    pluckBus.connect(dsend); dsend.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl);
    dlp.connect(inG);
    const rsP = makeGain(ctx, c.revSend);
    pluckBus.connect(rsP); rsP.connect(k.reverbIn);

    const padBus = makeGain(ctx, 1);
    padBus.connect(inG);
    const rsPad = makeGain(ctx, c.revPad);
    padBus.connect(rsPad); rsPad.connect(k.reverbIn);

    buses[name] = { inG, pluckBus, padBus };
    return buses[name];
  }

  // ───────── voices ─────────
  function pad(chord, t, dur) {
    const c = cfg;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(c.padLp * 0.6, t);
    lp.frequency.linearRampToValueAtTime(c.padLp, t + c.padAtk * 1.3);
    const g = ctx.createGain();
    const rel = 1.2;
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(c.padVol, t + c.padAtk);
    g.gain.setValueAtTime(c.padVol, t + dur);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur + rel);
    lp.connect(g); g.connect(bus.padBus);
    for (let i = 0; i < chord.tones.length; i++) {
      const f = mtof(chord.tones[i]);
      const o1 = ctx.createOscillator();
      o1.type = 'sine'; o1.frequency.value = f; o1.detune.value = -6 - rng() * 3;
      const o2 = ctx.createOscillator();
      o2.type = 'triangle'; o2.frequency.value = f; o2.detune.value = 6 + rng() * 3;
      o1.connect(lp); o2.connect(lp);
      o1.start(t); o2.start(t);
      o1.stop(t + dur + rel + 0.05); o2.stop(t + dur + rel + 0.05);
    }
    st.pad++;
  }

  function bass(midi, t, len, vel) {
    const c = cfg;
    const f = mtof(midi);
    const o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle'; o2.frequency.value = f * 2;
    const g2 = makeGain(ctx, 0.5); // octave harmonic so phone speakers can hear the line
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = c.bassLp; lp.Q.value = 0.5;
    const g = ctx.createGain();
    const v = c.bassVol * vel;
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(v * 0.5, t + len * 0.45);
    g.gain.exponentialRampToValueAtTime(EPS, t + len);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bus.inG);
    o1.start(t); o2.start(t);
    o1.stop(t + len + 0.05); o2.stop(t + len + 0.05);
    st.bass++;
  }

  function kick(t, vel) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const g = ctx.createGain();
    const v = cfg.kickVol * vel;
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.34);
    o.connect(g); g.connect(bus.inG);
    o.start(t); o.stop(t + 0.38);
    st.kick++;
  }

  function noiseSrc(t, dur) {
    const src = ctx.createBufferSource();
    src.buffer = k.noise.white;
    src.start(t, rng() * (src.buffer.duration - dur - 0.1));
    src.stop(t + dur + 0.02);
    return src;
  }

  function hat(t, vel, open) {
    const dur = open ? 0.12 : 0.04;
    const src = noiseSrc(t, dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6500; hp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 10500; lp.Q.value = 0.5;
    const g = ctx.createGain();
    const v = cfg.hatVol * vel;
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(v, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(bus.inG);
    st.hat++;
  }

  function snare(t, vel) {
    const v = cfg.snareVol * vel;
    const src = noiseSrc(t, 0.14);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.13);
    src.connect(bp); bp.connect(g); g.connect(bus.padBus);
    // soft body + rim click
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(250, t);
    o.frequency.exponentialRampToValueAtTime(175, t + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(EPS, t);
    og.gain.linearRampToValueAtTime(v * 0.7, t + 0.002);
    og.gain.exponentialRampToValueAtTime(EPS, t + 0.1);
    o.connect(og); og.connect(bus.padBus);
    o.start(t); o.stop(t + 0.12);
    const r = ctx.createOscillator();
    r.type = 'sine'; r.frequency.value = 1750;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(EPS, t);
    rg.gain.linearRampToValueAtTime(v * 0.45, t + 0.001);
    rg.gain.exponentialRampToValueAtTime(EPS, t + 0.03);
    r.connect(rg); rg.connect(bus.padBus);
    r.start(t); r.stop(t + 0.05);
    st.snare++;
  }

  // đàn-tranh-like pluck: triangle + sine (+ a faint octave), starts ~25 cents flat and slides up in ~50 ms,
  // fast two-stage exponential decay, gentle lowpass that closes as the note decays.
  function pluck(t, hz, vel, dec, fromCents, glide) {
    const c = cfg;
    const f0 = hz * cents(-fromCents);
    const bq = ctx.createBiquadFilter();
    bq.type = 'lowpass'; bq.Q.value = 0.5;
    bq.frequency.setValueAtTime(c.pluckLp * 1.7, t);
    bq.frequency.exponentialRampToValueAtTime(c.pluckLp, t + 0.25);
    const g = ctx.createGain();
    const peak = 0.13 * c.pluckVol * vel;
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(peak * 0.4, t + 0.1);
    g.gain.exponentialRampToValueAtTime(EPS, t + dec);
    const o1 = ctx.createOscillator(); o1.type = 'triangle';
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    o2.detune.value = 3 + rng() * 3;
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const g3 = makeGain(ctx, 0.22);
    o1.frequency.setValueAtTime(f0, t); o1.frequency.exponentialRampToValueAtTime(hz, t + glide);
    o2.frequency.setValueAtTime(f0, t); o2.frequency.exponentialRampToValueAtTime(hz, t + glide);
    o3.frequency.setValueAtTime(f0 * 2, t); o3.frequency.exponentialRampToValueAtTime(hz * 2, t + glide);
    o1.connect(bq); o2.connect(bq); o3.connect(g3); g3.connect(bq);
    bq.connect(g);
    let out = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = (rng() * 2 - 1) * 0.25;
      g.connect(p);
      out = p;
    }
    out.connect(bus.pluckBus);
    const end = t + dec + 0.05;
    o1.start(t); o2.start(t); o3.start(t);
    o1.stop(end); o2.stop(end); o3.stop(end);
    st.pluck++;
  }

  // ───────── melody material ─────────
  function snapPc(d, pcs) {
    const offs = [0, 1, -1, 2, -2];
    for (let i = 0; i < offs.length; i++) {
      const pc = pentMidi(d + offs[i]) % 12;
      if (pcs.indexOf(pc) >= 0) return d + offs[i];
    }
    return d;
  }

  function fixLens(notes, span) {
    notes.sort((a, b) => a.s - b.s);
    for (let i = 0; i < notes.length; i++) {
      const next = i + 1 < notes.length ? notes[i + 1].s : span;
      notes[i].len = clamp(next - notes[i].s, 2, 8);
    }
  }

  function makeMotif(c) {
    const bars = rng() < 0.45 ? 1 : 2;
    const span = bars * 16;
    let n = Math.round(c.motifNotes * (0.75 + rng() * 0.5));
    if (bars === 1) n = Math.ceil(n * 0.6);
    n = clamp(n, 2, 6);
    const cand = [];
    for (let b = 0; b < bars; b++) for (let i = 0; i < ONSET_POOL.length; i++) cand.push(b * 16 + ONSET_POOL[i]);
    const chosen = [];
    if (rng() < 0.75) chosen.push(0);
    let guard = 0;
    while (chosen.length < n && guard++ < 40) {
      const s = cand[Math.floor(rng() * cand.length)];
      if (chosen.indexOf(s) < 0) chosen.push(s);
    }
    chosen.sort((a, b) => a - b);
    const walk = [-2, -1, -1, -1, 0, 1, 1, 1, 2];
    let d = 8 + Math.floor(rng() * 3); // G5 A5 C6
    const notes = [];
    for (let i = 0; i < chosen.length; i++) {
      if (i > 0) {
        let step = walk[Math.floor(rng() * walk.length)];
        if (d > 11 && step > 0) step = -step || -1;
        if (d < 6 && step < 0) step = -step || 1;
        d = clamp(d + step, 4, 13);
      }
      notes.push({ s: chosen[i], d, len: 4 });
    }
    notes[notes.length - 1].d = snapPc(notes[notes.length - 1].d, [0, 7]); // finish on C or G
    fixLens(notes, span);
    return { bars, span, notes };
  }

  function mutate(m, amt) {
    const notes = [];
    for (let i = 0; i < m.notes.length; i++) notes.push({ s: m.notes[i].s, d: m.notes[i].d, len: m.notes[i].len });
    for (let i = 0; i < notes.length; i++) {
      if (rng() < amt * 0.45) notes[i].d = clamp(notes[i].d + (rng() < 0.5 ? -1 : 1), 4, 13);
    }
    if (notes.length > 2 && rng() < amt * 0.5) notes.splice(Math.floor(rng() * notes.length), 1);
    if (rng() < amt * 0.35) {
      const n = notes[Math.floor(rng() * notes.length)];
      const ns = n.s + (rng() < 0.5 ? -2 : 2);
      let free = ns >= 0 && ns < m.span;
      for (let i = 0; i < notes.length; i++) if (notes[i].s === ns) free = false;
      if (free) n.s = ns;
    }
    fixLens(notes, m.span);
    return { bars: m.bars, span: m.span, notes };
  }

  function startCycle() {
    cycle++;
    const pool = cfg.progs;
    let p = pool[Math.floor(rng() * pool.length)];
    if (pool.length > 1) { let g = 0; while (p === lastProg && g++ < 8) p = pool[Math.floor(rng() * pool.length)]; }
    lastProg = p;
    chords = [CHORDS[p[0]], CHORDS[p[1]], CHORDS[p[2]], CHORDS[p[3]]];
    if (rng() < 0.25) chords[3] = CHORDS[rng() < 0.5 ? 'G' : 'Dm']; // small turnaround variation

    if (!motifA || cycle % 3 === 1) motifA = makeMotif(cfg);
    else motifA = mutate(motifA, 0.3);
    motifB = mutate(motifA, 0.55);

    for (let b = 0; b < 4; b++) rest[b] = rng() < cfg.restBar;
    if (rest[0] && rest[1] && rest[2] && rest[3]) rest[Math.floor(rng() * 4)] = false;
    if (cfg.restBar < 0.35 && rest[0] && rest[1]) rest[1] = false; // keep it from going barren
  }

  // ───────── step player ─────────
  function swingShift(s) {
    const m = s & 3;
    return (m === 2 || m === 3) ? cfg.swing * stepDur * 2 : 0;
  }

  function playStep(idx, t0) {
    const c = cfg;
    if (idx === 0) startCycle();
    const bar = idx >> 4;
    const s = idx & 15;
    const t = t0 + swingShift(s) + (rng() - 0.5) * 0.008;

    if (s === 0) {
      st.bars++;
      barNotes = 0;
      if (layers.pad) pad(chords[bar], t0, stepDur * 16 + 0.1);
    }

    // bass
    const bp = layers.bass ? c.bassPat : EMPTY;
    for (let i = 0; i < bp.length; i++) {
      const e = bp[i];
      if (e[0] === s && rng() < e[1]) bass(chords[bar].root + e[2], t, e[3] * stepDur * 0.95, e[4]);
    }

    // drums
    if (c.drums > 0 && layers.drums) {
      const kp = c.kickPat[s];
      if (kp > 0 && rng() < kp) kick(t0 + (rng() - 0.5) * 0.004, 0.85 + rng() * 0.15);
      const sp = c.snarePat[s];
      if (sp > 0 && rng() < sp) snare(t, 0.8 + rng() * 0.2);
      const hp = c.hatPat[s];
      if (hp > 0 && rng() < hp) {
        const m = s & 3;
        const vel = (m === 2 ? 0.85 : m === 0 ? 0.6 : 0.3) * (0.8 + rng() * 0.2);
        const open = s === 14 && rng() < 0.3;
        hat(t, open ? 0.7 : vel, open);
      }
    }

    // melody
    if (!rest[bar] && layers.pluck) {
      const m = (bar >> 1) === 0 ? motifA : motifB;
      const pos = m.bars === 2 ? ((bar & 1) << 4) + s : s;
      const ns = m.notes;
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        if (n.s !== pos) continue;
        if (barNotes >= c.maxPerBar) break;
        if (rng() > c.keep) continue;
        let d = n.d;
        if (s === 0 && n.len >= 4) d = snapPc(d, chords[bar].pcs);
        const grace = barNotes > 0 && n.len >= 3 && rng() < 0.14;
        const vel = (0.72 + rng() * 0.28) * (s === 0 ? 1 : 0.9);
        const dec = clamp(n.len * stepDur * 1.5, 0.55, 1.5);
        if (grace) pluck(t, pentHz(d), vel, dec, 200, 0.08);
        else pluck(t, pentHz(d), vel, dec, 25, 0.05);
        barNotes++;
      }
    }
  }

  // ───────── scheduler ─────────
  function schedule(until) {
    if (!cur) return;
    if (!manual) {
      const now = ctx.currentTime;
      if (nextT < now - 0.05) nextT = now + 0.02; // fell behind (tab throttled?) -> skip, don't burst
    }
    let guard = 0;
    while (nextT < until && guard++ < 4096) {
      playStep(stepIdx, nextT);
      nextT += stepDur;
      stepIdx++;
      if (stepIdx >= STEPS_PER_LOOP) stepIdx = 0;
    }
  }

  function setVariant(name, when) {
    if (!VARIANTS[name] || name === cur) return;
    const t = when === undefined ? ctx.currentTime : when;
    if (cur) {
      const ob = getBus(cur);
      ob.inG.gain.cancelScheduledValues(t);
      ob.inG.gain.setTargetAtTime(0, t, 0.6);
    }
    cur = name;
    cfg = VARIANTS[name];
    st = stats[name];
    bus = getBus(name);
    bus.inG.gain.cancelScheduledValues(t);
    bus.inG.gain.setTargetAtTime(1, t, 0.8); // ~95% after 2.4 s
    stepDur = 60 / cfg.bpm / 4;
    stepIdx = 0;
    nextT = t + 0.06;
    lastProg = null;
    motifA = null; // fresh motif tuned to the new variant's density
  }

  function start() {
    if (timer || manual) return;
    timer = setInterval(() => {
      try { schedule(ctx.currentTime + LOOKAHEAD); } catch (e) { /* never let the scheduler die */ }
    }, TICK_MS);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  return {
    setVariant, schedule, start, stop, stats, layers,
    current() { return cur; },
    names: VARIANT_NAMES,
  };
}
