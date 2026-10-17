// Voice-building primitives shared by sfx / bgm / ambience.
// A "kit" `k` is the shared environment: { ctx, rng, noise, sfxBus, ambBus, echoIn, reverbIn, musicIn, ... }.
// Everything here is defensive about missing optional nodes (StereoPanner) and never throws on bad numbers.

import { EPS } from './util.js';

function finite(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

// One enveloped oscillator -> optional lowpass -> optional panner -> dest.
// o: { t, dur, vol, f, from?, glideT?, type?, a?, lp?, lpTo?, q?, detune?, pan?, noDetune? }
export function tone(k, dest, o) {
  const ctx = k.ctx;
  const t = o.t;
  const a = o.a === undefined ? 0.004 : o.a;
  const vol = finite(o.vol, 0);
  if (vol <= EPS) return;
  const end = t + Math.max(o.dur, a + 0.012);
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  if (o.from && o.from !== o.f) {
    osc.frequency.setValueAtTime(o.from, t);
    osc.frequency.exponentialRampToValueAtTime(o.f, t + (o.glideT || 0.05));
  } else {
    osc.frequency.setValueAtTime(o.f, t);
  }
  const det = (o.detune || 0) + (o.noDetune ? 0 : k.voiceDetune || 0);
  if (det) osc.detune.value = det;

  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(EPS, end);

  let head = osc;
  if (o.lp) {
    const bq = ctx.createBiquadFilter();
    bq.type = 'lowpass';
    bq.Q.value = o.q === undefined ? 0.7 : o.q;
    if (o.lpTo) {
      bq.frequency.setValueAtTime(o.lp, t);
      bq.frequency.exponentialRampToValueAtTime(o.lpTo, end);
    } else {
      bq.frequency.value = o.lp;
    }
    head.connect(bq);
    head = bq;
  }
  head.connect(g);
  let out = g;
  if (o.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan;
    g.connect(p);
    out = p;
  }
  out.connect(dest);
  osc.start(t);
  osc.stop(end + 0.03);
}

// Enveloped filtered-noise burst.
// o: { t, dur, vol, a?, buf?, type?, f, fTo?, q?, lp?, hp?, pan? }
export function noiseBurst(k, dest, o) {
  const ctx = k.ctx;
  const t = o.t;
  const a = o.a === undefined ? 0.003 : o.a;
  const vol = finite(o.vol, 0);
  if (vol <= EPS) return;
  const end = t + Math.max(o.dur, a + 0.012);
  const buffer = k.noise[o.buf || 'white'];
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const room = Math.max(0, buffer.duration - (end - t) - 0.1);
  const offset = k.rng() * room;

  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(EPS, end);

  let head = src;
  if (o.type) {
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.Q.value = o.q === undefined ? 0.8 : o.q;
    if (o.fTo) {
      f.frequency.setValueAtTime(o.f, t);
      f.frequency.exponentialRampToValueAtTime(o.fTo, end);
    } else {
      f.frequency.value = o.f;
    }
    head.connect(f);
    head = f;
  }
  if (o.hp) {
    const h = ctx.createBiquadFilter();
    h.type = 'highpass';
    h.frequency.value = o.hp;
    h.Q.value = 0.6;
    head.connect(h);
    head = h;
  }
  if (o.lp) {
    const l = ctx.createBiquadFilter();
    l.type = 'lowpass';
    l.frequency.value = o.lp;
    l.Q.value = 0.6;
    head.connect(l);
    head = l;
  }
  head.connect(g);
  let out = g;
  if (o.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan;
    g.connect(p);
    out = p;
  }
  out.connect(dest);
  src.start(t, offset);
  src.stop(end + 0.03);
}

// Per-sfx-call bus: -> sfxBus, with an optional send to the shared echo and optional pan.
// Disconnected a little after the sfx is over (see kit.sweep()).
export function voiceBus(k, o) {
  const ctx = k.ctx;
  const opt = o || {};
  const g = ctx.createGain();
  g.gain.value = (opt.gain === undefined ? 1 : opt.gain) * (k.voiceTrim || 1); // voiceTrim = per-sfx level trim (sfx.js META)
  let out = g;
  if (opt.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = opt.pan;
    g.connect(p);
    out = p;
  }
  out.connect(k.sfxBus);
  if (opt.echo > 0 && k.echoIn) {
    const s = ctx.createGain();
    s.gain.value = opt.echo;
    out.connect(s);
    s.connect(k.echoIn);
    k.defer(s, k.curEnd || ctx.currentTime + 4);
  }
  k.defer(out, k.curEnd || ctx.currentTime + 4);
  if (out !== g) k.defer(g, k.curEnd || ctx.currentTime + 4);
  return g;
}

// Looping buffer source with a random start offset (already started).
export function loopSource(k, kind) {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise[kind || 'white'];
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = src.buffer.duration;
  src.start(0, k.rng() * src.buffer.duration * 0.9);
  return src;
}

export function makeGain(ctx, v) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

export function makeFilter(ctx, type, f, q) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  if (q !== undefined) b.Q.value = q;
  return b;
}

// Deferred disconnects: tiny list swept from update() (no timers, no per-frame allocation).
export function makeDeferred(ctx) {
  const nodes = [];
  const times = [];
  return {
    defer(node, at) { nodes.push(node); times.push(at); },
    sweep(now) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (times[i] <= now) {
          try { nodes[i].disconnect(); } catch (e) { /* already gone */ }
          const last = nodes.length - 1;
          nodes[i] = nodes[last]; times[i] = times[last];
          nodes.pop(); times.pop();
        }
      }
    },
    size() { return nodes.length; },
  };
}
