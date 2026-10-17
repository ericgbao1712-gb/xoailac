// Juice: pooled particles (drawn by the art API in the low-res buffer) and floating text / stars (drawn hi-res).
// Everything is pre-allocated: spawning and updating never allocate.
import { PAL } from '../art/palette.js';
import { drawIcon } from '../art/icons.js';

const MAX_P = 260;
const MAX_F = 28;

let seed = 0x9e3779b9;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();

export const FONT_VT = '"XL Num", "Baloo 2", sans-serif';
export const FONT_BUNGEE = '"XL Display", "Baloo 2", sans-serif';

export function createFx() {
  const parts = [];
  for (let i = 0; i < MAX_P; i++) parts.push({ on: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, ay: 0, age: 0, life: 1, seed: 0, drag: 0 });
  const floats = [];
  for (let i = 0; i < MAX_F; i++) floats.push({ on: false, kind: 'text', text: '', x: 0, y: 0, age: 0, life: 1, rise: 16, color: PAL.gold, font: 0, size: 7, n: 0, delay: 0 });
  let pi = 0, fi = 0;
  const fx = {
    parts, floats,
    screenAlpha: 0, screenColor: '#fffaf0',
    rain: 0, rainRate: 0, rainKinds: null,
    shake: 0,
  };

  function nextPart() {
    for (let k = 0; k < MAX_P; k++) {
      pi = (pi + 1) % MAX_P;
      if (!parts[pi].on) return parts[pi];
    }
    pi = (pi + 1) % MAX_P;       // pool full: recycle the next one
    return parts[pi];
  }

  fx.particle = (kind, x, y, vx, vy, life, ay = 0, drag = 0) => {
    const p = nextPart();
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.ay = ay; p.drag = drag;
    p.age = 0; p.life = life; p.seed = (rnd() * 1e6) | 0;
    return p;
  };

  /** Radial / upward burst. `up` biases the direction upward (0 = all around, 1 = a narrow cone). */
  fx.burst = (kind, x, y, n, speed = 40, life = 0.7, ay = 110, up = 0.6) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 2 * (1 - up * 0.75);
      const sp = speed * rr(0.5, 1.1);
      fx.particle(kind, x + rr(-2, 2), y + rr(-2, 2), Math.cos(a) * sp, Math.sin(a) * sp, life * rr(0.75, 1.15), ay);
    }
  };

  /** Slowly rising puffs (steam, smoke, hearts). */
  fx.puff = (kind, x, y, n, life = 0.9, spread = 5) => {
    for (let i = 0; i < n; i++) fx.particle(kind, x + rr(-spread, spread), y + rr(-2, 2), rr(-5, 5), rr(-22, -10), life * rr(0.8, 1.2), -4);
  };

  // ───────────── floating text ─────────────
  function nextFloat() {
    for (let k = 0; k < MAX_F; k++) {
      fi = (fi + 1) % MAX_F;
      if (!floats[fi].on) return floats[fi];
    }
    fi = (fi + 1) % MAX_F;
    return floats[fi];
  }
  function stackOffset(x, y) {
    let n = 0;
    for (let i = 0; i < MAX_F; i++) {
      const f = floats[i];
      if (f.on && f.age < 0.45 && Math.abs(f.x - x) < 20 && Math.abs(f.y - y) < 14) n++;
    }
    return n * 9;
  }

  /** font: 0 = VT323, 1 = Bungee. size in "world-px" units (multiplied by the render scale at draw time). */
  fx.text = (text, x, y, color = PAL.gold, font = 0, size = 7, life = 1.15, rise = 18, delay = 0) => {
    const f = nextFloat();
    f.on = true; f.kind = 'text'; f.text = text; f.x = x; f.y = y - stackOffset(x, y);
    f.age = -delay; f.life = life; f.rise = rise; f.color = color; f.font = font; f.size = size; f.n = 0;
    return f;
  };
  fx.stars = (n, x, y, life = 1.5) => {
    const f = nextFloat();
    f.on = true; f.kind = 'stars'; f.text = ''; f.x = x; f.y = y - stackOffset(x, y);
    f.age = 0; f.life = life; f.rise = 14; f.color = PAL.gold; f.font = 0; f.size = 7; f.n = Math.max(0, Math.min(5, n | 0));
    return f;
  };

  // ───────────── full-screen effects ─────────────
  /** kind: 'level' | 'tier' | 'ending' | 'gold' | 'white'. `view` = visible world rect. */
  fx.flash = (kind, view) => {
    const w = view.x1 - view.x0;
    const n = kind === 'tier' || kind === 'ending' ? 90 : kind === 'level' ? 50 : 18;
    for (let i = 0; i < n; i++) {
      fx.particle(rnd() < 0.5 ? 'confetti' : 'star', view.x0 + rnd() * w, view.y0 - rr(0, 40), rr(-14, 14), rr(25, 70), rr(2.2, 3.4), 36, 0);
    }
    if (kind === 'tier' || kind === 'ending') { fx.screenAlpha = 0.65; fx.screenColor = '#fff3c4'; fx.rain = kind === 'ending' ? 7 : 1.6; fx.rainRate = kind === 'ending' ? 26 : 30; }
    else if (kind === 'level') { fx.screenAlpha = 0.35; fx.screenColor = '#fffaf0'; fx.rain = 0.6; fx.rainRate = 30; }
    else if (kind === 'white') { fx.screenAlpha = 0.5; fx.screenColor = '#ffffff'; }
    else { fx.screenAlpha = 0.28; fx.screenColor = '#ffdc7a'; }
    if (kind === 'tier' || kind === 'ending') fx.shake = 0.35;
  };

  fx.update = (dt, view) => {
    for (let i = 0; i < MAX_P; i++) {
      const p = parts[i];
      if (!p.on) continue;
      p.age += dt;
      if (p.age >= p.life) { p.on = false; continue; }
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      p.vy += p.ay * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = 0; i < MAX_F; i++) {
      const f = floats[i];
      if (!f.on) continue;
      f.age += dt;
      if (f.age >= f.life) f.on = false;
    }
    if (fx.screenAlpha > 0) fx.screenAlpha = Math.max(0, fx.screenAlpha - dt * 1.1);
    if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt);
    if (fx.rain > 0 && view) {
      fx.rain -= dt;
      const n = fx.rainRate * dt + (rnd() < (fx.rainRate * dt) % 1 ? 1 : 0);
      const w = view.x1 - view.x0;
      for (let i = 0; i < n; i++) fx.particle(rnd() < 0.7 ? 'confetti' : 'star', view.x0 + rnd() * w, view.y0 - 6, rr(-12, 12), rr(30, 60), rr(2.4, 3.4), 30, 0);
    }
  };

  /** Particles into the low-res buffer, using the art API's drawParticle. */
  fx.drawParticles = (ctx, drawParticle) => {
    for (let i = 0; i < MAX_P; i++) {
      const p = parts[i];
      if (p.on) drawParticle(ctx, p);
    }
  };

  /** Hi-res text pass. `cam` supplies toDeviceX/Y, scale and dpr; ctx is in device pixels. */
  fx.drawText = (ctx, cam) => {
    const sc = cam.scale, stroke = Math.max(2, Math.round(2 * cam.dpr));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    for (let i = 0; i < MAX_F; i++) {
      const f = floats[i];
      if (!f.on || f.age < 0) continue;
      const k = f.age / f.life;
      const ease = 1 - (1 - Math.min(1, k * 1.25)) * (1 - Math.min(1, k * 1.25));
      const sx = Math.round(cam.toDeviceX(f.x));
      const sy = Math.round(cam.toDeviceY(f.y - f.rise * ease));
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.globalAlpha = a < 0 ? 0 : a;
      const pop = 1 + 0.4 * Math.max(0, 1 - f.age / 0.14);
      if (f.kind === 'stars') {
        const is = Math.max(1, Math.round(sc * 0.55));
        const wpx = 16 * is, gap = Math.round(is * 2);
        const total = 5 * wpx + 4 * gap;
        const x0 = sx - Math.round(total / 2);
        const y0 = sy - 16 * is;
        for (let s = 0; s < 5; s++) drawIcon(ctx, s < f.n ? 'ui_star' : 'ui_star_empty', x0 + s * (wpx + gap), y0, is);
      } else {
        const px = Math.round(f.size * sc * pop * (f.font ? 0.95 : 1.15));
        ctx.font = `${px}px ${f.font ? FONT_BUNGEE : FONT_VT}`;
        ctx.lineWidth = stroke;
        ctx.strokeStyle = PAL.ink;
        ctx.strokeText(f.text, sx, sy);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, sx, sy);
      }
    }
    ctx.globalAlpha = 1;
  };

  fx.drawScreen = (ctx, W, H) => {
    if (fx.screenAlpha <= 0.01) return;
    ctx.globalAlpha = Math.min(1, fx.screenAlpha);
    ctx.fillStyle = fx.screenColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  };

  fx.clear = () => {
    for (let i = 0; i < MAX_P; i++) parts[i].on = false;
    for (let i = 0; i < MAX_F; i++) floats[i].on = false;
    fx.screenAlpha = 0; fx.rain = 0; fx.shake = 0;
  };

  return fx;
}
