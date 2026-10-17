// Small pure helpers shared by the audio modules. No DOM, no AudioContext at top level.

export const EPS = 0.0001; // "silence" for exponential ramps (can't ramp to 0)

// Vietnamese-flavoured pentatonic used everywhere: C D F G A
export const PENT = [0, 2, 5, 7, 9];

// Scale index -> MIDI note. Index 0 = C4 (60), 5 = C5, 10 = C6, -1 = A3 ...
export function pentMidi(i) {
  const o = Math.floor(i / 5);
  return 60 + 12 * o + PENT[i - o * 5];
}
export function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
export function pentHz(i) { return mtof(pentMidi(i)); }

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function cents(c) { return Math.pow(2, c / 1200); }

// Slider 0..1 -> linear gain (gentle curve so the low end of the slider is usable).
export function volCurve(v) {
  const x = clamp(+v || 0, 0, 1);
  return Math.pow(x, 1.6);
}

// Deterministic PRNG for tests (the live game uses Math.random).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mono noise buffer. kind: 'white' | 'brown' (leaky-integrated, ~ -6 dB/oct above ~140 Hz).
export function makeNoiseBuffer(ctx, seconds, kind, rng) {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(seconds * sr));
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  if (kind === 'brown') {
    let last = 0;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const w = rng() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last;
      const a = last < 0 ? -last : last;
      if (a > max) max = a;
    }
    const g = max > 0 ? 0.9 / max : 1;
    for (let i = 0; i < n; i++) d[i] *= g;
  } else {
    for (let i = 0; i < n; i++) d[i] = rng() * 2 - 1;
  }
  return buf;
}

// Stereo impulse response from exponentially decaying, progressively darker noise (~60 dB over `seconds`).
export function makeImpulse(ctx, seconds, rng) {
  const sr = ctx.sampleRate;
  const len = Math.max(8, Math.floor(seconds * sr));
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(0.012 * sr);
  const rise = Math.floor(0.006 * sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const w = rng() * 2 - 1;
      const a = 0.25 + 0.65 * t; // one-pole lowpass gets heavier along the tail
      lp = lp * a + w * (1 - a);
      let env = Math.exp(-6.9 * t);
      if (i < pre) env = 0;
      else if (i < pre + rise) env *= (i - pre) / rise;
      d[i] = lp * env * 2.2;
    }
  }
  return buf;
}

// Soft clipper: linear below 0.7, smooth saturation above, hard ceiling ~0.92 (input is clamped to +-1).
export function makeSoftClipCurve(n) {
  const size = n || 2049;
  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const a = x < 0 ? -x : x;
    const y = a < 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28);
    c[i] = x < 0 ? -y : y;
  }
  return c;
}
