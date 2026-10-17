// Procedural one-shot sound effects. Every voice is synthesized from oscillators / filtered noise.
// Levels are deliberately modest (single-voice peaks around -14..-8 dBFS) and bright partials are lowpassed.

import { EPS, clamp, pentHz } from './util.js';
import { tone, noiseBurst, voiceBus } from './kit.js';

const P = pentHz; // scale index -> Hz (0 = C4, 5 = C5, 10 = C6, 15 = C7)

// Bell made of inharmonic partials: [ratio, vol, dur] triples.
function bell(k, dest, t, f, parts, a) {
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    tone(k, dest, { type: 'sine', f: f * p[0], t, dur: p[2], vol: p[1], a: a === undefined ? 0.002 : a });
  }
}

// Soft two-oscillator note (triangle + faint octave sine), the basic "pleasant" timbre.
function softNote(k, dest, t, f, vol, dur, o) {
  const opt = o || {};
  tone(k, dest, { type: 'triangle', f, t, dur, vol, a: opt.a === undefined ? 0.004 : opt.a, lp: opt.lp || 5200 });
  tone(k, dest, { type: 'sine', f: f * 2, t, dur: dur * 0.7, vol: vol * 0.3, a: opt.a === undefined ? 0.004 : opt.a });
}

function sparkleNotes(k, dest, t, count, vol, span) {
  for (let i = 0; i < count; i++) {
    const idx = 10 + Math.min(6, Math.floor((i / count) * 6 + k.rng() * 1.6));
    const tt = t + (i / count) * span + k.rng() * 0.012;
    tone(k, dest, { type: 'sine', f: P(idx), t: tt, dur: 0.2 + (i / count) * 0.12, vol: vol * (0.75 + 0.25 * k.rng()), a: 0.002 });
  }
}

const V = {};

V.click = (k, o, t) => {
  const vb = voiceBus(k);
  const f = 1250 * (1 + (k.rng() - 0.5) * 0.1);
  tone(k, vb, { type: 'triangle', f: f * 0.62, from: f, glideT: 0.022, t, dur: 0.07, vol: 0.2, a: 0.001, lp: 3800 });
  noiseBurst(k, vb, { t, dur: 0.018, vol: 0.06, a: 0.0008, type: 'bandpass', f: 2600, q: 1.2 });
};

V.tap = (k, o, t) => {
  const vb = voiceBus(k);
  tone(k, vb, { type: 'sine', f: 1500, from: 2100, glideT: 0.012, t, dur: 0.04, vol: 0.085, a: 0.0008 });
};

V.whoosh = (k, o, t) => {
  const vb = voiceBus(k);
  const close = !!(o.close || o.dir === 'close' || o.dir === 'down');
  noiseBurst(k, vb, {
    t, dur: 0.3, vol: 0.15, a: 0.09, type: 'bandpass',
    f: close ? 2300 : 480, fTo: close ? 480 : 2400, q: 0.9, lp: 5200,
  });
};

V.error = (k, o, t) => {
  const vb = voiceBus(k);
  const f0 = [220, 185];
  for (let i = 0; i < 2; i++) {
    const tt = t + i * 0.115;
    tone(k, vb, { type: 'triangle', f: f0[i], t: tt, dur: 0.1, vol: 0.18, a: 0.004, lp: 1100 });
    tone(k, vb, { type: 'square', f: f0[i], t: tt, dur: 0.09, vol: 0.04, a: 0.004, lp: 800 });
  }
};

V.confirm = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.15 });
  softNote(k, vb, t, P(8), 0.13, 0.26);
  softNote(k, vb, t + 0.085, P(10), 0.14, 0.42);
};

V.pop = (k, o, t) => {
  const vb = voiceBus(k);
  const n = clamp(Math.round(+o.n || 0), 0, 9);
  const f = P(5 + n); // C5 D5 F5 G5 A5 C6 D6 F6 G6 A6
  tone(k, vb, { type: 'sine', f, from: f * 0.62, glideT: 0.03, t, dur: 0.15, vol: 0.2, a: 0.002 });
  tone(k, vb, { type: 'triangle', f: f * 2, from: f * 1.4, glideT: 0.03, t, dur: 0.06, vol: 0.035, a: 0.002, lp: 4000 });
  noiseBurst(k, vb, { t, dur: 0.012, vol: 0.03, a: 0.001, type: 'bandpass', f: 3000, q: 1 });
};

V.sizzle = (k, o, t) => {
  // Xoài Lắc: the shaker jar rattling (name kept from Lẩu Ơi! so the event wiring stays the same).
  // Six short bandpassed noise "shk" bursts, alternating pitch like salt + mango slices hitting the lid.
  const vb = voiceBus(k, { echo: 0.05 });
  for (let i = 0; i < 6; i++) {
    const at = t + i * 0.11 + (k.rng() - 0.5) * 0.012;
    const hi = i % 2 === 0;
    noiseBurst(k, vb, { t: at, dur: 0.07, vol: (hi ? 0.11 : 0.085) * (1 - i * 0.07), a: 0.004, type: 'bandpass', f: hi ? 4300 : 3000, q: 1.4, lp: 9000 });
  }
  // a soft plastic "tok" when the jar lands
  noiseBurst(k, vb, { t: t + 0.7, dur: 0.06, vol: 0.06, a: 0.002, type: 'bandpass', f: 900, q: 2, lp: 3000 });
};

V.ting = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.25 });
  const f = P(10) * (1 + (k.rng() - 0.5) * 0.01);
  bell(k, vb, t, f, [[1, 0.17, 1.4], [2.76, 0.05, 0.55]]);
};

V.clink = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.08 });
  const j = 1 + (k.rng() - 0.5) * 0.06;
  const parts = [[2349, 0.075, 0.15], [3517, 0.045, 0.1], [5104, 0.02, 0.055]];
  for (let i = 0; i < parts.length; i++) {
    tone(k, vb, { type: 'sine', f: parts[i][0] * j, t, dur: parts[i][2], vol: parts[i][1], a: 0.0008, lp: 7000 });
  }
  noiseBurst(k, vb, { t, dur: 0.012, vol: 0.03, a: 0.0006, type: 'bandpass', f: 4200, q: 1.5 });
  // faint second touch
  const t2 = t + 0.075;
  tone(k, vb, { type: 'sine', f: 2093 * j, t: t2, dur: 0.11, vol: 0.035, a: 0.0008, lp: 6500 });
  tone(k, vb, { type: 'sine', f: 3136 * j, t: t2, dur: 0.07, vol: 0.02, a: 0.0008, lp: 6500 });
};

V.coin = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.12 });
  tone(k, vb, { type: 'triangle', f: P(11), t, dur: 0.09, vol: 0.1, a: 0.002, lp: 5200 });
  tone(k, vb, { type: 'triangle', f: P(13), t: t + 0.06, dur: 0.32, vol: 0.12, a: 0.002, lp: 5200 });
  tone(k, vb, { type: 'sine', f: P(13) * 2, t: t + 0.06, dur: 0.16, vol: 0.03, a: 0.002 });
};

V.kaching = (k, o, t) => {
  const amount = clamp(+o.amount || 0, 0, 1e7);
  const r = clamp(Math.log10(amount + 1) / 3.6, 0, 1); // 0 .. 1 richness
  const soft = o.soft ? 0.6 : 1;
  const vb = voiceBus(k, { echo: 0.18 + 0.1 * r, gain: soft });
  // mechanical "cha"
  noiseBurst(k, vb, { t, dur: 0.05, vol: 0.06, a: 0.002, type: 'bandpass', f: 1900, q: 1.1, lp: 5000 });
  tone(k, vb, { type: 'triangle', f: 130, from: 200, glideT: 0.05, t, dur: 0.1, vol: 0.09, a: 0.002, lp: 900 });
  // register bell
  bell(k, vb, t + 0.05, P(14), [[1, 0.09 + 0.05 * r, 0.7 + 0.5 * r], [2.76, 0.025 + 0.02 * r, 0.35]]);
  // sprinkled coin chimes
  const coins = 2 + Math.round(r * 5);
  const cv = 0.085 / Math.sqrt(coins / 2);
  let tt = t + 0.05;
  for (let i = 0; i < coins; i++) {
    tt += 0.04 + k.rng() * 0.035;
    const f = P(11 + Math.floor(k.rng() * 5)); // D6 .. C7-ish
    tone(k, vb, { type: 'triangle', f, t: tt, dur: 0.18 + 0.16 * r, vol: cv * (0.8 + 0.4 * k.rng()), a: 0.002, lp: 5200 });
  }
};

V.door = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.3 });
  const pairs = [[9, 7], [8, 5], [10, 8]];
  const pr = pairs[Math.floor(k.rng() * pairs.length)];
  const f1 = P(pr[0]); const f2 = P(pr[1]);
  tone(k, vb, { type: 'sine', f: f1, t, dur: 0.8, vol: 0.085, a: 0.006 });
  tone(k, vb, { type: 'sine', f: f1 * 2, t, dur: 0.35, vol: 0.02, a: 0.006 });
  tone(k, vb, { type: 'sine', f: f2, t: t + 0.3, dur: 1.0, vol: 0.085, a: 0.006 });
  tone(k, vb, { type: 'sine', f: f2 * 2, t: t + 0.3, dur: 0.4, vol: 0.02, a: 0.006 });
};

V.levelup = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.3 });
  const seq = [5, 6, 8, 9, 10, 11, 13];
  for (let i = 0; i < seq.length; i++) {
    softNote(k, vb, t + i * 0.085, P(seq[i]), 0.1 + i * 0.006, 0.34);
  }
  const tc = t + 0.64;
  const chord = [5, 8, 10, 13];
  for (let i = 0; i < chord.length; i++) softNote(k, vb, tc, P(chord[i]), 0.085, 1.15, { a: 0.012 });
  // soft pad swell underneath
  tone(k, vb, { type: 'sine', f: P(0), t, dur: 1.5, vol: 0.06, a: 0.2, lp: 1500 });
  tone(k, vb, { type: 'sine', f: P(5), t, dur: 1.5, vol: 0.05, a: 0.2, lp: 1500 });
  sparkleNotes(k, vb, tc + 0.05, 5, 0.03, 0.3);
};

V.tierup = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.4 });
  // soft timpani hit
  tone(k, vb, { type: 'sine', f: 52, from: 110, glideT: 0.12, t, dur: 0.7, vol: 0.28, a: 0.004 });
  tone(k, vb, { type: 'triangle', f: 104, from: 220, glideT: 0.12, t, dur: 0.4, vol: 0.1, a: 0.004, lp: 700 });
  // swelling pad chord
  const padNotes = [-5, 0, 3, 5, 6];
  for (let i = 0; i < padNotes.length; i++) {
    tone(k, vb, { type: 'sine', f: P(padNotes[i]) * 0.5, t, dur: 3.2, vol: 0.055, a: 0.7, lp: 1400 });
    tone(k, vb, { type: 'triangle', f: P(padNotes[i]), t, dur: 3.0, vol: 0.03, a: 0.7, lp: 1300 });
  }
  // slow-then-quickening arpeggio over two octaves
  const seq = [0, 3, 5, 6, 8, 9, 10, 11];
  const at = [0.15, 0.45, 0.72, 0.96, 1.16, 1.34, 1.5, 1.64];
  for (let i = 0; i < seq.length; i++) {
    softNote(k, vb, t + at[i], P(seq[i]), 0.1 + i * 0.004, 0.55);
  }
  // grand final chord
  const tc = t + 1.78;
  const chord = [5, 8, 10, 11, 13, 15];
  for (let i = 0; i < chord.length; i++) softNote(k, vb, tc, P(chord[i]), 0.07, 1.6, { a: 0.015 });
  sparkleNotes(k, vb, tc + 0.1, 9, 0.032, 0.7);
};

V.sparkle = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.35 });
  sparkleNotes(k, vb, t, 11, 0.05, 0.34);
};

V.grumble = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.05 });
  // "bwah" - saw through a lowpass that opens (vowel) then closes
  tone(k, vb, { type: 'sawtooth', f: 174, from: 192, glideT: 0.12, t, dur: 0.2, vol: 0.12, a: 0.012, lp: 380, lpTo: 900, q: 2.5 });
  tone(k, vb, { type: 'sawtooth', f: 174, from: 192, glideT: 0.12, t, dur: 0.2, vol: 0.06, a: 0.012, lp: 380, lpTo: 900, q: 2.5, detune: 14 });
  const t2 = t + 0.2;
  tone(k, vb, { type: 'sawtooth', f: 118, from: 160, glideT: 0.2, t: t2, dur: 0.34, vol: 0.12, a: 0.012, lp: 900, lpTo: 300, q: 2.5 });
  tone(k, vb, { type: 'sawtooth', f: 118, from: 160, glideT: 0.2, t: t2, dur: 0.34, vol: 0.06, a: 0.012, lp: 900, lpTo: 300, q: 2.5, detune: 14 });
};

V.combo = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.15 });
  const n = clamp(Math.round(+o.n || 2), 2, 12);
  const count = n < 4 ? 2 : n < 7 ? 3 : 4;
  const top = 5 + Math.min(n - 2, 8);
  for (let i = 0; i < count; i++) {
    const idx = top - 2 * (count - 1 - i);
    const last = i === count - 1;
    softNote(k, vb, t + i * 0.06, P(idx), 0.11 + 0.01 * i, last ? 0.42 : 0.16);
  }
};

V.chest = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.25 });
  // shake: alternating thumps + rattle that grows
  for (let i = 0; i < 10; i++) {
    const tt = t + i * 0.055;
    const grow = 0.6 + i * 0.05;
    tone(k, vb, { type: 'triangle', f: i % 2 ? 150 : 128, t: tt, dur: 0.07, vol: 0.09 * grow, a: 0.002, lp: 700 });
    noiseBurst(k, vb, { t: tt + 0.01, dur: 0.045, vol: 0.05 * grow, a: 0.002, type: 'bandpass', f: 1500 + 200 * (i % 3), q: 2, lp: 4500 });
  }
  // open
  const to = t + 0.66;
  noiseBurst(k, vb, { t: to, dur: 0.26, vol: 0.07, a: 0.06, type: 'bandpass', f: 600, fTo: 3200, q: 0.9, lp: 5200 });
  tone(k, vb, { type: 'triangle', f: 196, from: 150, glideT: 0.1, t: to, dur: 0.25, vol: 0.1, a: 0.004, lp: 900 });
  const chime = [10, 13, 15];
  for (let i = 0; i < chime.length; i++) {
    softNote(k, vb, to + 0.08 + i * 0.055, P(chime[i]), 0.1, 0.95);
  }
  sparkleNotes(k, vb, to + 0.2, 8, 0.032, 0.45);
};

V.cash = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.2 });
  // "cha"
  noiseBurst(k, vb, { t, dur: 0.06, vol: 0.09, a: 0.002, type: 'bandpass', f: 2200, q: 1.1, lp: 5200 });
  tone(k, vb, { type: 'triangle', f: 120, from: 190, glideT: 0.06, t, dur: 0.11, vol: 0.1, a: 0.002, lp: 900 });
  // drawer slide
  noiseBurst(k, vb, { t: t + 0.07, dur: 0.05, vol: 0.035, a: 0.002, type: 'bandpass', f: 900, q: 1.2 });
  // "ching"
  bell(k, vb, t + 0.11, P(14), [[1, 0.12, 0.9], [2.76, 0.035, 0.45]]);
  tone(k, vb, { type: 'triangle', f: P(12), t: t + 0.2, dur: 0.22, vol: 0.04, a: 0.002, lp: 5000 });
};

V.tick = (k, o, t) => {
  const vb = voiceBus(k);
  const f = 1050 + k.rng() * 520;
  tone(k, vb, { type: 'square', f, t, dur: 0.03, vol: 0.045, a: 0.0008, lp: 2800 });
  noiseBurst(k, vb, { t, dur: 0.01, vol: 0.02, a: 0.0006, type: 'bandpass', f: 3200, q: 1 });
};

V.rush = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.35 });
  const f = 196;
  // gong-ish: inharmonic partials with a slow swell; the doubled fundamental beats slowly
  tone(k, vb, { type: 'sine', f, t, dur: 2.7, vol: 0.12, a: 0.32, lp: 2400 });
  tone(k, vb, { type: 'sine', f: f + 2.4, t, dur: 2.6, vol: 0.07, a: 0.32, lp: 2400 });
  tone(k, vb, { type: 'sine', f: f * 2.0, t, dur: 2.1, vol: 0.06, a: 0.28, lp: 2400 });
  tone(k, vb, { type: 'sine', f: f * 2.76, t, dur: 1.6, vol: 0.045, a: 0.25, lp: 2400 });
  tone(k, vb, { type: 'sine', f: f * 4.1, t, dur: 1.0, vol: 0.02, a: 0.22, lp: 2400 });
  noiseBurst(k, vb, { t, dur: 1.3, vol: 0.04, a: 0.55, type: 'bandpass', f: 700, fTo: 1500, q: 0.8, lp: 3000 });
};

V.mom = (k, o, t) => {
  const vb = voiceBus(k, { echo: 0.2 });
  tone(k, vb, { type: 'sine', f: 440, from: 230, glideT: 0.07, t, dur: 0.16, vol: 0.16, a: 0.004 });
  const t2 = t + 0.13;
  tone(k, vb, { type: 'sine', f: P(11), t: t2, dur: 0.75, vol: 0.1, a: 0.004 });
  tone(k, vb, { type: 'sine', f: P(11) * 2, t: t2, dur: 0.3, vol: 0.03, a: 0.004 });
  tone(k, vb, { type: 'sine', f: P(13), t: t2 + 0.09, dur: 0.5, vol: 0.045, a: 0.004 });
};

// name -> { dur: approx length incl. tail (s), gap: min seconds between plays, prio: 0 = droppable under load }
const META = {
  click: { dur: 0.15, gap: 0.02, prio: 0, trim: 1.5 },
  tap: { dur: 0.1, gap: 0.04, prio: 0, trim: 1.4 },
  whoosh: { dur: 0.5, gap: 0.08, prio: 0 },
  error: { dur: 0.45, gap: 0.12, prio: 1 },
  confirm: { dur: 0.8, gap: 0.08, prio: 1 },
  pop: { dur: 0.3, gap: 0.03, prio: 0 },
  sizzle: { dur: 0.9, gap: 0.1, prio: 1 },
  ting: { dur: 2.0, gap: 0.12, prio: 1 },
  clink: { dur: 0.5, gap: 0.05, prio: 0 },
  kaching: { dur: 1.6, gap: 0.06, prio: 1 },
  coin: { dur: 0.8, gap: 0.04, prio: 0 },
  door: { dur: 2.2, gap: 0.5, prio: 1 },
  levelup: { dur: 2.8, gap: 0.3, prio: 2, trim: 0.8 },
  tierup: { dur: 5.2, gap: 0.5, prio: 2, trim: 0.6 },
  sparkle: { dur: 1.2, gap: 0.2, prio: 1 },
  grumble: { dur: 0.9, gap: 0.3, prio: 1 },
  combo: { dur: 0.9, gap: 0.05, prio: 1 },
  chest: { dur: 2.6, gap: 0.3, prio: 2 },
  cash: { dur: 1.4, gap: 0.08, prio: 1 },
  tick: { dur: 0.12, gap: 0.015, prio: 0 },
  rush: { dur: 3.6, gap: 0.5, prio: 2, trim: 0.8 },
  mom: { dur: 1.5, gap: 0.2, prio: 1 },
};

export const SFX_NAMES = Object.keys(V);
export const SFX_META = META;

const MAX_CONCURRENT = 16; // soft cap: droppable (prio 0) sounds are skipped above this

export function createSfx(k) {
  const lastAt = Object.create(null);
  const ends = [];

  function play(name, opts) {
    const fn = V[name];
    if (!fn) return false;
    const ctx = k.ctx;
    const meta = META[name];
    const o = opts || {};
    const now = ctx.currentTime;
    const scheduled = typeof o.when === 'number' && o.when > 0;
    if (!scheduled) {
      const prev = lastAt[name];
      if (prev !== undefined && now - prev < meta.gap) return false;
      lastAt[name] = now;
      // voice budget
      let live = 0;
      for (let i = ends.length - 1; i >= 0; i--) {
        if (ends[i] <= now) { ends[i] = ends[ends.length - 1]; ends.pop(); } else live++;
      }
      if (meta.prio === 0 && live >= MAX_CONCURRENT) return false;
    }
    const t = now + (scheduled ? o.when : 0) + 0.006;
    k.voiceDetune = (k.rng() * 2 - 1) * 10; // +-10 cents per play, shared by all partials
    k.voiceTrim = meta.trim || 1;
    k.curEnd = t + meta.dur + 0.6;
    ends.push(t + meta.dur);
    fn(k, o, t);
    k.voiceDetune = 0;
    k.voiceTrim = 1;
    return true;
  }

  return { play, names: SFX_NAMES, meta: META, activeCount() { return ends.length; } };
}
