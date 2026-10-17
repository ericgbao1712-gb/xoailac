// Rain showers + the tarp (C.RAIN). Rain/storm days bring showers at set game-minute windows. At an
// uncovered tier (the vỉa hè) the player pulls the tarp out while it rains; guests left in the rain walk out.
import * as C from '../config.js';
import { tierDef } from './economy.js';

const R = C.RAIN;
const fail = (reason, msg) => ({ ok: false, reason, msg });
const WET_STATES = new Set(['walkingIn', 'seated', 'ordered', 'eating', 'waitingDoor', 'walkingDoor', 'doorOrder']);

/** Today's shower windows [[from, to], …] in game minutes (made once per day, kept in state.today). */
export function showers(G) {
  const s = G.state, t = s.today;
  if (Array.isArray(t.showers) && t.showersDay === s.day) return t.showers;
  const list = [];
  const n = R.showers[s.weather];
  if (n) {
    const rng = G.rng;
    if (s.weather === 'storm') list.push([R.from - 10, C.TIME.dayEnd + 120]);
    else {
      const k = rng.int(n[0], n[1]), span = (R.to - R.from) / k;
      for (let i = 0; i < k; i++) {
        const len = rng.range(R.showerMin[0], R.showerMin[1]);
        const a = R.from + i * span + rng.range(0, Math.max(0, span - len));
        list.push([Math.round(a), Math.round(Math.min(a + len, R.from + (i + 1) * span))]);
      }
    }
  }
  t.showers = list; t.showersDay = s.day;
  return list;
}

/** Is it raining right now (only while the shop is open/closing)? */
export function raining(G) {
  const s = G.state;
  if (s.phase !== 'open' && s.phase !== 'closing') return false;
  const c = s.clock;
  for (const [a, b] of showers(G)) if (c >= a && c < b) return true;
  return false;
}
/** Minutes until the next shower starts (null = no more today). */
export function nextShowerIn(G) {
  const c = G.state.clock;
  for (const [a] of showers(G)) if (a > c) return a - c;
  return null;
}
export const needsTarp = (G) => !tierDef(G).covered;
export const ownsTarp = (G) => (G.state.upgrades.tarp || 0) > 0;
export const tarpOpen = (G) => !!G.state.today.tarp;
/** v2.6.5: from tier `autoTarpTier` (Chợ đêm bờ kè) the tarp rolls out by itself for every shower. */
export const autoTarp = (G) => (G.state.tier || 1) >= (R.autoTarpTier || 99);
/** Guests are getting wet right now. */
export const exposed = (G) => needsTarp(G) && !tarpOpen(G) && raining(G);

/** What the art/audio should show: rain only during a shower, grey sky between showers. */
export function weatherNow(G) {
  const s = G.state;
  if (s.weather !== 'rain' && s.weather !== 'storm') return s.weather;
  return raining(G) ? s.weather : 'cloud';
}

export function pullTarp(G) {
  const s = G.state;
  if (!needsTarp(G)) return fail('covered', 'Chỗ này có tán cây với dù che rồi, không cần bạt nha.');
  if (!ownsTarp(G)) return fail('noTarp', 'Chưa có bạt! Mua Bạt che mưa ở Nâng cấp nha.');
  if (s.phase !== 'open' && s.phase !== 'closing') return fail('phase', 'Mở hàng rồi mới cần kéo bạt nha.');
  if (s.today.tarp) return { ok: true, already: true };
  s.today.tarp = true;
  G.emit('tarp', { open: true });
  return { ok: true };
}

/** Per sim step: shower start/stop messages, auto-rolling the tarp, wet guests walking out. */
export function rainTick(G, dtMin, angryLeave) {
  const s = G.state, w = G.world;
  const on = raining(G);
  if (on !== !!w.rainOn) {
    w.rainOn = on;
    if (on) {
      G.emit('rainStart', { needsTarp: needsTarp(G), owns: ownsTarp(G) });
      if (autoTarp(G)) {
        if (!s.today.tarp) { s.today.tarp = true; G.emit('tarp', { open: true }); }
        G.toast('Mưa rồi! Bạt tự kéo ra che cho khách.', 'info', 'wx_rain');
      } else if (needsTarp(G)) {
        if (ownsTarp(G)) G.toast('Mưa rồi! Chạm KÉO BẠT kẻo khách ướt bỏ về!', 'bad', 'wx_rain');
        else G.toast('Mưa rồi mà chưa có bạt — khách ướt sẽ bỏ về! Mua Bạt che mưa ở Nâng cấp nha.', 'bad', 'wx_rain');
      }
    } else {
      G.emit('rainStop', {});
      if (s.today.tarp) { s.today.tarp = false; G.emit('tarp', { open: false }); G.toast('Tạnh mưa rồi, cuốn bạt lại thôi.', 'info', 'wx_sun'); }
    }
  }
  const wet = on && needsTarp(G) && !s.today.tarp;
  for (const g of w.groups.slice()) {
    if (!WET_STATES.has(g.state)) continue;
    if (wet) {
      g.wet = (g.wet || 0) + dtMin;
      if (g.wet >= R.wetLeaveMin * (g.tutorial ? 3 : 1)) angryLeave(G, g, 'rain');
    } else if (g.wet > 0) g.wet = Math.max(0, g.wet - dtMin * 0.5);
  }
}
