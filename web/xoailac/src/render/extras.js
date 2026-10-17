// v2.3 counter-view extras (render only, no game logic):
//   • staff on the pavement wearing the chosen uniform; a phục vụ wipes a side table after its guests leave
//   • mặt tiền (Lv 31): sign board style, bunting, flower pots on the counter
//   • the equipped deco lamps / plants (they used to exist only in the old top-down view)
//   • tem logo (Lv 24) on the sign board and on cups (hi-res overlay, drawn after the pixel buffer)
import { drawChar, makeStaffLook, stampCanvas } from '../art/index.js';
import { loadAtlas, blit } from '../art/assets.js';
import { drawIcon } from '../art/icons.js';
import { BAR } from '../art/layouts.js';
import PROPS from '../art/data/props.js';
import * as C from '../config.js';

const P = loadAtlas(PROPS.file);
const PF = PROPS.frames;
const putProp = (ctx, k, x, y) => (PF[k] ? blit(ctx, P, PF[k], x, y, false, 1) : false);
const putTop = (ctx, k, x, y) => { const f = PF[k]; return f ? blit(ctx, P, f, x, y + (f[5] - 1) / 2, false, 1) : false; };

export const SIGN_STYLES = {
  go:   { edge: '#2e5010', fill: '#3f6a14', hi: '#5f9a1a', text: '#ffcf3d', stroke: '#1d3608' },
  vang: { edge: '#b8261f', fill: '#ffcf3d', hi: '#fff0a8', text: '#b8261f', stroke: '#fff3c9' },
  neon: { edge: '#2a1630', fill: '#3a1f45', hi: '#5a3166', text: '#ffd1f0', stroke: '#e0379a', glow: '#ff5fc8' },
  nau:  { edge: '#4a2a14', fill: '#7a4a22', hi: '#9a6a3a', text: '#fff6e6', stroke: '#3b2010' },
  hong: { edge: '#c2386f', fill: '#ffd6e4', hi: '#fff0f5', text: '#c2386f', stroke: '#ffffff' },
};
const LAMP_KIND = { den_long_do: ['den_long_do', 'den_cam'], den_hoian: ['den_hoian1', 'den_hoian2'], den_chum: ['den_chum1', 'den_chum2'] };
// v2.6.7: every waiter on the team shows (was capped at 2); extra spots by the outer tables and the walkway
const HOME = [{ x: 47, y: 99 }, { x: 153, y: 99 }, { x: 100, y: 104 }, { x: 6, y: 104 }, { x: 194, y: 104 }, { x: 72, y: 106 }, { x: 128, y: 106 }];
const SPEED = 38;                     // world px / s

export function createExtras(game) {
  const helpers = [];                 // { id, look, x, y, home, target, wipeT, face, t }
  const lastGroup = [];
  let staffKey = '';

  function syncHelpers(s) {
    // all phục vụ (they work the floor); with fewer than 2, other staff fill up to 2 as before
    const all = (s.staff || []).slice().sort((a, b) => (a.role === 'phucvu' ? 0 : 1) - (b.role === 'phucvu' ? 0 : 1));
    const nWait = all.filter((m) => m.role === 'phucvu').length;
    const list = all.slice(0, Math.min(HOME.length, Math.max(2, nWait)));
    const key = list.map((m) => m.id + m.role).join(',');
    if (key === staffKey) return;
    staffKey = key;
    const old = new Map(helpers.map((h) => [h.id, h]));
    helpers.length = 0;
    list.forEach((m, i) => {
      const h = old.get(m.id) || { id: m.id, x: HOME[i].x, y: HOME[i].y, target: null, wipeT: 0, face: 'down', t: i * 0.7 };
      h.look = makeStaffLook(m.role, m.lookSeed || (m.look && m.look.lookSeed) || m.id);
      h.home = HOME[i]; h.role = m.role;
      helpers.push(h);
    });
  }

  function update(dt) {
    const s = game.state, w = game.world;
    syncHelpers(s);
    const side = w.side || [];
    // a side table just freed → the nearest idle helper goes to wipe it
    side.forEach((sd, i) => {
      if (lastGroup[i] && !sd.groupId && s.phase !== 'prep') {
        let best = null, bd = 1e9;
        for (const h of helpers) { if (h.target) continue; const d = Math.abs(h.x - sd.x); if (d < bd) { bd = d; best = h; } }
        if (best) best.target = { x: sd.x + (sd.x < 100 ? 11 : -11), y: sd.y + 3, tx: sd.x };
      }
      lastGroup[i] = sd.groupId;
    });
    lastGroup.length = side.length;
    for (const h of helpers) {
      h.t += dt;
      const goal = h.target || h.home;
      const dx = goal.x - h.x, dy = goal.y - h.y, d = Math.hypot(dx, dy);
      if (d > 0.6) {
        const k = Math.min(1, SPEED * dt / d);
        h.x += dx * k; h.y += dy * k;
        h.pose = 'walk'; h.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      } else if (h.target) {
        h.wipeT += dt; h.pose = 'cook'; h.face = h.target.tx < h.x ? 'left' : 'right';
        if (h.wipeT > 1.6) { h.target = null; h.wipeT = 0; }
      } else { h.pose = 'idle'; h.face = 'down'; }
    }
  }

  const hOpts = { pose: 'idle', facing: 'down', t: 0, carry: null, alpha: 1 };
  function drawHelper(ctx, h) {
    hOpts.pose = h.pose || 'idle'; hOpts.facing = h.face || 'down'; hOpts.t = h.t;
    drawChar(ctx, h.look, Math.round(h.x * 2) / 2, Math.round(h.y * 2) / 2, hOpts);
  }

  // ───────── mặt tiền + deco (inside the pixel buffer, before lighting) ─────────
  function drawBunting(ctx, view, ly, id, t) {
    const b = C.FACADE.items.bunting.find((x) => x.id === id);
    if (!b || !b.cols) return;
    const span = 50, x0 = Math.floor((view.x0 - 10) / span) * span, sag = 7, y0 = ly + 3;
    let n = 0;
    for (let a = x0; a < view.x1 + span; a += span) {
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(a, y0); ctx.quadraticCurveTo(a + span / 2, y0 + sag * 2, a + span, y0); ctx.stroke();
      for (let j = 0; j < 8; j++) {
        const u = (j + 0.5) / 8, x = a + span * u, y = y0 + sag * 4 * u * (1 - u);
        const flap = Math.sin(t * 2.4 + x * 0.3) * 0.5;
        ctx.fillStyle = b.cols[n++ % b.cols.length];
        if (id === 'longmini') {                       // little round lanterns: cap, body, tassel
          const sw = Math.round(Math.sin(t * 1.8 + x) * 0.5) / 2;
          ctx.fillRect(x - 2 + sw, y + 1, 4, 4); ctx.fillRect(x - 1.5 + sw, y + 0.5, 3, 5);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 1 + sw, y + 1.5, 1, 2);
          ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 1 + sw, y, 2, 0.5); ctx.fillRect(x - 0.25 + sw, y + 5.5, 0.5, 1.5);
          continue;
        }
        ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x + 2.5, y); ctx.lineTo(x + flap, y + 5.5); ctx.closePath(); ctx.fill();
      }
    }
  }
  function drawLamps(ctx, view, ly, id, t) {
    const kinds = LAMP_KIND[id];
    if (!kinds) return;
    // v2.6.20: den_chum is now "Đèn lồng tre đan" (bamboo lanterns, round + drum), a bit denser than the old chandelier
    const step = id === 'den_chum' ? 70 : 50, x0 = Math.floor(view.x0 / step) * step + step / 2;
    let i = 0;
    for (let x = x0; x < view.x1 + step; x += step) {
      const sway = Math.round(Math.sin(t * (id === 'den_chum' ? 1.1 : 1.6) + x) * 1) / 2;
      ctx.fillStyle = '#3b2f22'; ctx.fillRect(x - 0.25, ly + 3, 0.5, 3);
      putTop(ctx, kinds[i++ % kinds.length], x + sway, ly + 5);
    }
  }
  function drawPlants(ctx, view, id) {
    if (!id || !PF[id]) return;
    // in the gaps between the side tables (behind where the staff stand)
    putProp(ctx, id, 4, 76);                         // v2.5.2: back corners by the railing (the bar took the left gap)
    putProp(ctx, id, 196, 76);
  }
  function drawFlowers(ctx, w, L, id, t) {
    const fl = C.FACADE.items.flower.find((x) => x.id === id);
    if (!fl || !fl.cols) return;
    const xs = [];
    const tb = w.tables.map((x) => x.x).sort((a, b) => a - b);
    if (tb.length === 1) xs.push(tb[0] - 36, tb[0] + 36);
    else for (let i = 0; i + 1 < tb.length; i++) xs.push((tb[i] + tb[i + 1]) / 2);
    const y = L.counter.top + 9;
    for (const x of xs) {
      // terracotta pot
      ctx.fillStyle = '#8a4320'; ctx.fillRect(x - 4.5, y - 5, 9, 1.5);
      ctx.fillStyle = '#b5622e'; ctx.fillRect(x - 4, y - 3.5, 8, 3.5);
      ctx.fillStyle = '#d27a3c'; ctx.fillRect(x - 4, y - 3.5, 8, 0.5);
      if (id === 'xuongrong') {                       // cactus columns with a pink flower on top
        ctx.fillStyle = fl.cols[0]; ctx.fillRect(x - 1.5, y - 12, 3, 8.5); ctx.fillRect(x - 4, y - 9, 2, 4); ctx.fillRect(x + 2, y - 10, 2, 5);
        ctx.fillRect(x - 3, y - 6, 2, 1); ctx.fillRect(x + 1.5, y - 6, 1.5, 1);
        ctx.fillStyle = '#7bbf2a'; ctx.fillRect(x - 1, y - 12, 0.5, 8);
        ctx.fillStyle = fl.cols[1]; ctx.fillRect(x - 1.5, y - 14, 3, 2); ctx.fillStyle = '#fff3c9'; ctx.fillRect(x - 0.25, y - 13.5, 0.5, 0.5);
        continue;
      }
      if (id === 'lan') {                             // orchid: tall arching stem, purple blooms
        ctx.fillStyle = '#3f7a28'; ctx.fillRect(x - 4, y - 5.5, 8, 1.5); ctx.fillRect(x - 0.25, y - 15, 0.5, 10); ctx.fillRect(x, y - 15, 3, 0.5);
        [[2.5, -14], [-1, -12], [2, -10.5], [-1.5, -9]].forEach(([bx, by], k) => {
          const bob = Math.round(Math.sin(t * 1.1 + x + k) * 0.5) / 2;
          ctx.fillStyle = fl.cols[k % 2]; ctx.fillRect(x + bx - 1.25, y + by + bob, 2.5, 2);
          ctx.fillStyle = '#fff3c9'; ctx.fillRect(x + bx - 0.25, y + by + 0.75 + bob, 0.5, 0.5);
        });
        continue;
      }
      // leaves + blooms
      ctx.fillStyle = id === 'sen' ? fl.cols[1] : '#3f7a28';
      ctx.fillRect(x - 4, y - 7, 8, 2); ctx.fillRect(x - 2.5, y - 8.5, 5, 1.5);
      const blooms = id === 'sen' ? [[-2.5, -8], [1.5, -8.5], [-0.5, -10]] : [[-3, -9], [0, -11], [3, -9], [-1.5, -7.5], [2, -7]];
      blooms.forEach(([bx, by], k) => {
        ctx.fillStyle = fl.cols[k % 2];
        const bob = Math.round(Math.sin(t * 1.3 + x + k) * 0.5) / 2;
        ctx.fillRect(x + bx - 1, y + by + bob, 2, 2);
        if (id !== 'sen') { ctx.fillStyle = '#fff3c9'; ctx.fillRect(x + bx - 0.25, y + by + 0.75 + bob, 0.5, 0.5); }
      });
    }
  }

  // v2.6.4 bàn bar giữa lan can: two-tone wood top on a black steel frame with a footrest, round bar stools on
  // chrome stems (cushion colour follows the furniture upgrade), a succulent and a napkin box on the ends
  const STOOL = [['#c0392b', '#8e2a20'], ['#d98a3a', '#9a5a22'], ['#7a5a3a', '#4e3622'], ['#3f6a8a', '#2a4a62'], ['#2f2f3a', '#1d1d26']];
  const TOP = [['#e8b878', '#b97c45'], ['#e2b27a', '#a8703f'], ['#c99a6a', '#8a5a34'], ['#d8c3a5', '#9c8366'], ['#efe6da', '#b8a48a']];
  function drawBar(ctx, sd, style, t) {
    const x0 = BAR.x0, x1 = BAR.x1, ly = BAR.ledgeY, w = x1 - x0, st = Math.max(0, Math.min(4, style | 0));
    ctx.fillStyle = 'rgba(40,28,18,0.2)'; ctx.fillRect(x0 + 2, ly + 6, w - 4, 1.5);               // soft shadow on the pavement
    // steel frame: two slim A-legs, a cross bar and a footrest
    ctx.fillStyle = '#26262c';
    for (const lx of [x0 + 4, x1 - 6]) { ctx.fillRect(lx, ly - 4, 1.5, 10.5); ctx.fillRect(lx - 1.5, ly + 6, 4.5, 1); }
    ctx.fillRect(x0 + 4, ly - 4, w - 8.5, 0.75);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(x0 + 4, ly + 2.5, w - 8.5, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x0 + 4, ly + 2.5, w - 8.5, 0.35);
    // top: light face, darker edge, a pale highlight and a thin black trim (modern slab)
    const tp = TOP[st];
    ctx.fillStyle = tp[0]; ctx.fillRect(x0, ly - 7.5, w, 2.25);
    ctx.fillStyle = tp[1]; ctx.fillRect(x0, ly - 5.25, w, 1.25);
    ctx.fillStyle = '#1d1d22'; ctx.fillRect(x0, ly - 4, w, 0.5);
    ctx.fillStyle = 'rgba(255,248,230,0.7)'; ctx.fillRect(x0 + 1, ly - 7.5, w - 2, 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let gx = x0 + 6; gx < x1 - 3; gx += 9) ctx.fillRect(gx, ly - 7, 3, 0.35);   // wood grain
    // ends of the ledge: a succulent in a white pot (left) and a napkin box (right)
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x0 + 1.5, ly - 10, 3, 2.5); ctx.fillStyle = '#d6d0c4'; ctx.fillRect(x0 + 1.5, ly - 8, 3, 0.5);
    ctx.fillStyle = '#5c9a52'; ctx.fillRect(x0 + 2, ly - 11.5, 2, 1.5); ctx.fillStyle = '#7fbf6a'; ctx.fillRect(x0 + 1.5, ly - 11, 1, 1); ctx.fillRect(x0 + 3.5, ly - 11, 1, 1);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(x1 - 5, ly - 9.5, 3.5, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x1 - 4.5, ly - 10.5, 2.5, 1);
    // stools: round cushion with a rim, chrome stem, foot ring and a round base
    const sc = STOOL[st];
    for (const s of sd.seats) {
      const sx = s.x, sy = s.y;
      ctx.fillStyle = 'rgba(40,28,18,0.18)'; ctx.fillRect(sx - 3, sy + 3, 6, 1);
      ctx.fillStyle = '#9aa0aa'; ctx.fillRect(sx - 0.5, sy - 1.5, 1, 4.5);
      ctx.fillStyle = '#d8dde4'; ctx.fillRect(sx - 0.5, sy - 1.5, 0.4, 4.5);
      ctx.fillStyle = '#7d828c'; ctx.fillRect(sx - 2, sy + 0.5, 4, 0.6); ctx.fillRect(sx - 2.5, sy + 2.8, 5, 0.8);
      ctx.fillStyle = sc[1]; ctx.fillRect(sx - 3.5, sy - 2.25, 7, 1);
      ctx.fillStyle = sc[0]; ctx.fillRect(sx - 3, sy - 3.25, 6, 1.25);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(sx - 2, sy - 3.25, 3, 0.4);
    }
    if (sd.pot) {
      const n = Math.max(1, Math.min(4, sd.groupId ? sd.seats.length : 0));
      for (let i = 0; i < Math.min(2, n); i++) drawIcon(ctx, 'pot_' + sd.pot, sd.seats[i * 2].x + 1, ly - 15, 0.55);
      for (let i = 0; i < Math.min(4, sd.drinks | 0); i++) { const sx = sd.seats[i].x - 4; ctx.fillStyle = '#e8f4fa'; ctx.fillRect(sx, ly - 11, 3, 4); ctx.fillStyle = '#d98a3a'; ctx.fillRect(sx, ly - 9, 3, 2); }
    }
  }

  // v2.6.20 quạt quanh chỗ khách ngồi (upgrade 'cooling'): code-drawn so the blades spin and the head turns.
  //   Lv1-2 quạt đứng · Lv3 quạt phun sương (mist puffs) · Lv4 quạt hơi nước (tall cooler tower) + phun sương
  // v2.6.21: every spot is BEHIND the row of side tables (y 84, by the railing) and clear of all 4 stools of each
  // table (stools sit at table x ±16 / y+3 and x / y−8 & y+13), so a fan never overlaps a seat or a seated guest.
  // Edge pair from level 1, the pair between the tables from level 3 (phun sương).
  const FAN_SPOTS = [{ x: 11, y: 84 }, { x: 189, y: 84, flip: true }, { x: 47, y: 84 }, { x: 153, y: 84, flip: true }];
  function fanSpots(lv, nSide) {
    if (!(lv > 0)) return [];
    const out = [FAN_SPOTS[0], FAN_SPOTS[1]];
    if (lv >= 3 && nSide >= 3) out.push(FAN_SPOTS[2], FAN_SPOTS[3]);
    return out.map((f, i) => ({ ...f, i, kind: lv >= 4 && i < 2 ? 'tower' : lv >= 3 ? 'mist' : 'stand', fan: true }));
  }
  function drawFanHead(ctx, hx, hy, r, t, i, turn) {
    // cage
    ctx.fillStyle = 'rgba(70,80,96,0.9)';
    ctx.beginPath(); ctx.ellipse(hx, hy, r * turn, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,225,240,0.55)';
    ctx.beginPath(); ctx.ellipse(hx, hy, (r - 0.6) * turn, r - 0.6, 0, 0, Math.PI * 2); ctx.fill();
    // three spinning blades
    ctx.fillStyle = 'rgba(80,150,200,0.85)';
    const a0 = t * 14 + i;
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * 2.094;
      ctx.beginPath(); ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(a) * (r - 0.8) * turn, hy + Math.sin(a) * (r - 0.8));
      ctx.lineTo(hx + Math.cos(a + 0.7) * (r - 1) * turn, hy + Math.sin(a + 0.7) * (r - 1));
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e8edf2'; ctx.fillRect(hx - 0.75, hy - 0.75, 1.5, 1.5);
    // cage ribs
    ctx.fillStyle = 'rgba(60,70,84,0.55)'; ctx.fillRect(hx - 0.2, hy - r, 0.4, r * 2); ctx.fillRect(hx - r * turn, hy - 0.2, r * 2 * turn, 0.4);
  }
  function drawFan(ctx, f, t, on) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1.35, 1.35);
    drawFan0(ctx, f, t, on);
    ctx.restore();
  }
  function drawFan0(ctx, f, t, on) {
    const x = 0, y = 0, spin = on ? t : 0;
    const turn = 0.62 + 0.3 * Math.cos(t * 0.7 + f.i * 1.7);          // oscillating head (seen from the front)
    ctx.fillStyle = 'rgba(40,28,18,0.2)'; ctx.fillRect(x - 4, y + 0.5, 8, 1.2);
    if (f.kind === 'tower') {                                         // quạt hơi nước: tall box, vents, water tank
      ctx.fillStyle = '#d9dee6'; ctx.fillRect(x - 3.5, y - 17, 7, 17.5);
      ctx.fillStyle = '#b8c0cc'; ctx.fillRect(x + 2, y - 17, 1.5, 17.5);
      ctx.fillStyle = '#5b6b7e'; for (let r = 0; r < 5; r++) ctx.fillRect(x - 2.5, y - 15.5 + r * 1.6, 4.5, 0.6);
      ctx.fillStyle = '#7ec4e6'; ctx.fillRect(x - 2.5, y - 6.5, 4.5, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - 2.5, y - 6.5, 4.5, 0.6);
      ctx.fillStyle = '#3d4654'; ctx.fillRect(x - 3, y, 1.5, 0.8); ctx.fillRect(x + 1.5, y, 1.5, 0.8);
      ctx.fillStyle = on ? '#6fe08a' : '#888'; ctx.fillRect(x - 2.5, y - 2, 1, 1);
    } else {
      const tall = f.kind === 'mist' ? 15 : 13;
      ctx.fillStyle = '#4a5260'; ctx.fillRect(x - 3, y - 1, 6, 1.2);                 // base
      ctx.fillStyle = '#8e97a6'; ctx.fillRect(x - 0.5, y - tall + 4, 1, tall - 4);    // pole
      if (f.kind === 'mist') { ctx.fillStyle = '#7ec4e6'; ctx.fillRect(x - 1.5, y - 5, 3, 4); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1.5, y - 5, 3, 0.6); }
      drawFanHead(ctx, x, y - tall + 1, 4, spin, f.i, turn);
    }
    if (on && f.kind !== 'stand') {                                   // mist puffs blowing toward the tables
      const dir = f.flip ? -1 : 1, hy = f.kind === 'tower' ? y - 11 : y - 14;
      for (let k = 0; k < 5; k++) {
        const u = ((t * 0.55 + k / 5 + f.i * 0.13) % 1);
        const px = x + dir * (3 + u * 16), py = hy + Math.sin(u * 6 + k) * 1.5 + u * 2;
        ctx.fillStyle = `rgba(235,248,255,${(0.8 * (1 - u)).toFixed(3)})`;
        const r = 0.8 + u * 2.2; ctx.fillRect(px - r, py - r * 0.6, r * 2, r * 1.2);
      }
    }
  }

  // night glow of the mini lanterns (same positions as drawBunting)
  // v2.6.20: warm glow of the bamboo lanterns (deco den_chum) at night — same spots as drawLamps
  function glowLamps(ctx, view, ly, id, night) {
    if (id !== 'den_chum' || night < 0.03) return;
    const step = 70, x0 = Math.floor(view.x0 / step) * step + step / 2;
    ctx.globalCompositeOperation = 'lighter';
    for (let x = x0; x < view.x1 + step; x += step) {
      const y = ly + 17, g = ctx.createRadialGradient(x, y, 0, x, y, 22);
      g.addColorStop(0, `rgba(255,190,100,${(0.5 * night).toFixed(3)})`); g.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function glowLanterns(ctx, view, ly, id, night) {
    if (id !== 'longmini' || night < 0.03) return;
    const span = 50, x0 = Math.floor((view.x0 - 10) / span) * span, sag = 7, y0 = ly + 3;
    ctx.globalCompositeOperation = 'lighter';
    for (let a = x0; a < view.x1 + span; a += span) for (let j = 0; j < 8; j++) {
      const u = (j + 0.5) / 8, x = a + span * u, y = y0 + sag * 4 * u * (1 - u) + 3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
      g.addColorStop(0, `rgba(255,140,80,${(0.45 * night).toFixed(3)})`); g.addColorStop(1, 'rgba(255,140,80,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 8, y - 8, 16, 16);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // balloons tied to both ends of the sign board
  function drawBalloons(ctx, L, id, t) {
    const b = C.FACADE.items.balloon.find((x) => x.id === id), sg = L.sign;
    if (!b || !b.cols || !sg) return;
    const heart = id === 'tim';
    const sides = [{ ax: sg.x - 19, dir: -1 }, { ax: sg.x + sg.w + 9, dir: 1 }];   // beside the board (it hangs right under the awning)
    let n = 0;
    for (const sd of sides) {
      const k = heart ? 3 : 4;
      for (let i = 0; i < k; i++) {
        const bx = sd.ax + sd.dir * (i % 2 ? 3 : 0) + (i - (k - 1) / 2) * 3.5, by = sg.y + 3 - (i % 2) * 4 - (i === 1 ? 2 : 0);
        const bob = Math.sin(t * 1.4 + i + sd.dir) * 0.6, x = Math.round(bx * 2) / 2, y = Math.round((by + bob) * 2) / 2;
        ctx.strokeStyle = 'rgba(80,60,40,0.7)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(sd.dir < 0 ? sg.x - 11 : sg.x + sg.w, sg.y + sg.h - 2); ctx.stroke();
        ctx.fillStyle = b.cols[n++ % b.cols.length];
        if (heart) { ctx.fillRect(x - 2.5, y - 2, 2.5, 2.5); ctx.fillRect(x, y - 2, 2.5, 2.5); ctx.fillRect(x - 2, y, 4, 1.5); ctx.fillRect(x - 1, y + 1.5, 2, 1); }
        else { ctx.fillRect(x - 2, y - 2.5, 4, 5); ctx.fillRect(x - 2.5, y - 1.5, 5, 3); ctx.fillRect(x - 0.5, y + 2.5, 1, 0.5); }
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x - 1.5, y - 1.5, 1, 1);
      }
    }
  }

  // ───────── hi-res overlay: stamps on cups and the sign ─────────
  const cups = [];                     // world { x, y, size } of cup centres collected while drawing
  function clearCups() { cups.length = 0; }
  function addCup(x, y, size) { if (cups.length < 40) cups.push({ x, y, size }); }
  function drawStamps(ctx, cam, brand, name, night, shx, shy) {
    if (!brand) return;
    ctx.save();
    ctx.globalAlpha = 1 - 0.45 * night;
    ctx.imageSmoothingEnabled = true;
    for (const c of cups) {
      const S = Math.round(c.size * 0.56 * cam.scale);
      if (S < 8) continue;
      const img = stampCanvas(brand, name, S);
      if (img) ctx.drawImage(img, Math.round(cam.toDeviceX(c.x) - S / 2) + shx, Math.round(cam.toDeviceY(c.y + c.size * 0.12) - S / 2) + shy);
    }
    ctx.restore();
  }
  function drawSignStamp(ctx, cam, L, brand, name, shx, shy) {
    const sg = L.sign;
    if (!brand || !sg) return;
    const S = Math.round(sg.h * 1.7 * cam.scale);
    const img = stampCanvas(brand, name, S);
    if (!img) return;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, Math.round(cam.toDeviceX(sg.x + 1) - S / 2) + shx, Math.round(cam.toDeviceY(sg.y + sg.h / 2) - S / 2) + shy);
    ctx.restore();
  }

  return { update, helpers, drawHelper, drawBar, drawFan, fanSpots, glowLanterns, glowLamps, drawBalloons, drawBunting, drawLamps, drawPlants, drawFlowers, clearCups, addCup, drawStamps, drawSignStamp };
}
