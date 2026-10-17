// Visual effects layer: coin fly, ingredient fly, puffs, floating text, confetti.
import { ctx } from './ctx.js';
import { h, ico } from './dom.js';

export function createFx(root) {
  const items = [];
  let raf = 0;
  const reduced = () => ctx.reduced;

  const toLocal = (p) => {
    const r = ctx.el.app.getBoundingClientRect();
    return { x: p.x - r.left, y: p.y - r.top };
  };
  const centerOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const ease = (u) => 1 - (1 - u) * (1 - u);

  function loop(now) {
    raf = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const u = (now - it.t0 - it.delay) / it.dur;
      if (u < 0) continue;
      if (u >= 1) { it.step(1); it.el.remove(); items.splice(i, 1); it.done?.(); continue; }
      it.step(u);
    }
    if (items.length) raf = requestAnimationFrame(loop);
  }
  function add(it) {
    it.t0 = performance.now();
    it.delay = it.delay || 0;
    items.push(it);
    if (it.delay > 0) { it.el.style.opacity = '0'; }
    if (!raf) raf = requestAnimationFrame(loop);
    return it;
  }

  /** icon travelling along a curve from client point A to B */
  function fly(name, from, to, { size = 32, dur = 600, delay = 0, arc = -60, endScale = 0.7, spin = false, done } = {}) {
    const a = toLocal(from), b = toLocal(to);
    const img = ico(name, size, 'fx-ico');
    root.appendChild(img);
    const cx = (a.x + b.x) / 2 + (b.x - a.x) * 0.1, cy = Math.min(a.y, b.y) + arc;
    return add({
      el: img, dur, delay, done,
      step: (u) => {
        const e = ease(u), q = 1 - e;
        const x = q * q * a.x + 2 * q * e * cx + e * e * b.x;
        const y = q * q * a.y + 2 * q * e * cy + e * e * b.y;
        const s = 1 + (endScale - 1) * u;
        img.style.opacity = '1';
        img.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) scale(${s})${spin ? ` rotate(${u * 360}deg)` : ''}`;
      },
    });
  }

  function coins(from, to, amount = 50, onArrive) {
    const n = reduced() ? 3 : Math.max(5, Math.min(10, 5 + Math.floor(amount / 60)));
    let arrived = 0;
    for (let i = 0; i < n; i++) {
      const jx = { x: from.x + (Math.random() - 0.5) * 36, y: from.y + (Math.random() - 0.5) * 16 };
      fly('ui_coin', jx, to, {
        size: 32, dur: reduced() ? 380 : 620 + Math.random() * 160, delay: i * (reduced() ? 20 : 45), arc: -50 - Math.random() * 60, endScale: 0.55,
        done: () => { arrived++; if (arrived === 1 || arrived === n) onArrive?.(arrived === n); },
      });
    }
  }

  function puff(client) {
    if (reduced()) return;
    const p = toLocal(client);
    for (let i = 0; i < 3; i++) {
      const el = h('i', { class: 'fx-puff' });
      root.appendChild(el);
      const dx = (Math.random() - 0.5) * 30, dy = -18 - Math.random() * 22, s0 = 4 + Math.random() * 6;
      add({ el, dur: 420 + Math.random() * 160, delay: i * 25, step: (u) => {
        el.style.opacity = String(1 - u);
        el.style.transform = `translate(${p.x + dx * ease(u) - 3}px, ${p.y + dy * ease(u) - 3}px) scale(${s0 / 6 * (1 + u)})`;
      } });
    }
  }

  function floatText(text, client, { color, dur = 900, rise = 40 } = {}) {
    const p = toLocal(client);
    const el = h('div', { class: 'fx-text' }, text);
    if (color) el.style.color = color;
    root.appendChild(el);
    el.style.left = '0'; el.style.top = '0';
    const w = 40;
    add({ el, dur, step: (u) => {
      el.style.opacity = u > 0.7 ? String(1 - (u - 0.7) / 0.3) : '1';
      el.style.transform = `translate(${p.x - w}px, ${p.y - rise * ease(u)}px)`;
    } });
  }

  /** confetti on a canvas inside `container`. returns stop() */
  function confetti(container, { count = 90, loop = false, duration = 2600 } = {}) {
    const cv = h('canvas', { class: 'fx-conf' });
    container.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 400, H = cv.clientHeight || 700;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const cols = ['#e2433b', '#f6b83c', '#ffdc7a', '#2f9a8a', '#86d4bf', '#ff9eae', '#fffaf0', '#5fb2df'];
    const n = reduced() ? Math.round(count / 3) : count;
    const ps = Array.from({ length: n }, () => ({ x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140, s: 4 + Math.floor(Math.random() * 3) * 2, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6 }));
    let t0 = performance.now(), last = t0, id = 0, stopped = false;
    const frame = (now) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      g.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of ps) {
        p.x += p.vx * dt + Math.sin(now / 300 + p.rot) * 0.6; p.y += p.vy * dt; p.rot += dt * 4;
        if (p.y > H + 10) { if (loop || now - t0 < duration * 0.6) { p.y = -10; p.x = Math.random() * W; } else continue; }
        alive++;
        g.fillStyle = '#2a1b2d'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.s + 2, p.s + 2);
        g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      }
      if (alive && (loop || now - t0 < duration + 3000)) id = requestAnimationFrame(frame); else cv.remove();
    };
    id = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(id); cv.remove(); };
  }

  return { fly, coins, puff, floatText, confetti, centerOf, toLocal };
}
