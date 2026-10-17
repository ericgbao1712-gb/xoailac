// Transient simulation world + actor movement (TECH_SPEC §3, §6.10). Not saved.
import * as C from '../config.js';
import { getLayout } from '../art/layouts.js';
import { route, floorOf } from './routing.js';
import { builtTables, builtStoves, perkFx } from './economy.js';

export function createWorld(G) {
  return {
    rng: G.rng,
    layout: null,
    tables: [], stoves: [], groups: [], tickets: [], actors: [], side: [],
    tray: { ticketId: null },   // the player's tray
    owner: null,                // owner actor
    staffActors: new Map(),     // staff id → actor
    chefWarn: {}, chefClock: 0,               // ingredient → tMin of the last "hết hàng" toast from a chef
    get coinPiles() {           // read-only view for UI/QA: uncollected coins per table
      const out = [];
      for (const t of this.tables) if (t.coins) out.push({ tableIdx: t.idx, amount: t.coins.amount, tip: t.coins.tip, x: t.x, y: t.y });
      return out;
    },
    veso: null,                 // lottery lady actor (when visible)
    nextId: 1,
    tMin: 0,                    // game minutes since the day opened (monotonic, keeps running while closing)
    doors: [],                  // door spot occupancy: group id | 0
    lowWarned: {}, outWarned: {},
    spawnAcc: 0, spawnTarget: 1,
    specialSpawned: {}, chutuAt: -1, chutuDone: false, reviewerAt: -1, scriptIdx: 0,
    comboN: 0,
    closingFor: 0,
    fanTokens: [],              // per stove
    lotteryT: 0, vesoLeft: 0,
    cookPoseT: 0,               // owner shows the 'cook' pose while > 0
    pauses: new Set(),
    branchAcc: 0, branchAccT: 0,
    time: 0,                    // real seconds animation clock
  };
}

export const nid = (w) => w.nextId++;

/** Recompute layout for the current tier/upgrades and grow tables/stoves arrays (never shrinks unless rebuild). */
export function syncLayout(G, rebuild = false) {
  const w = G.world, s = G.state;
  const nT = builtTables(G), nS = builtStoves(G);
  w.layout = getLayout(s.tier, { tables: nT, stoves: nS });
  const L = w.layout;
  if (rebuild) { w.tables.length = 0; w.stoves.length = 0; w.fanTokens.length = 0; }
  for (let i = 0; i < L.tables.length; i++) {
    const lt = L.tables[i];
    let t = w.tables[i];
    if (!t) {
      t = w.tables[i] = { idx: i, x: lt.x, y: lt.y, floor: lt.floor || 1, seats: lt.seats, status: 'free', groupId: 0, coins: null,
        pot: null, potFill: 0, boiling: false, plates: 0, drinks: 0, dirty: false, reserved: false, claimedBy: 0, fresh: 0 };
    } else { t.x = lt.x; t.y = lt.y; t.floor = lt.floor || 1; t.seats = lt.seats; }
  }
  w.tables.length = L.tables.length;
  for (let i = 0; i < L.kitchen.stoves.length; i++) {
    const ls = L.kitchen.stoves[i];
    let st = w.stoves[i];
    if (!st) {
      st = w.stoves[i] = { idx: i, x: ls.x, y: ls.y, sortY: ls.sortY, pot: null, progress: 0, ready: false, portions: 0, maxPortions: 0, cookTotal: 0, fresh: 0 };
      w.fanTokens[i] = 8;
    } else { st.x = ls.x; st.y = ls.y; st.sortY = ls.sortY; }
  }
  w.stoves.length = L.kitchen.stoves.length;
  // side tables (counter view): base + bought, in build order; existing ones keep their group
  const nSide = Math.min((L.side || []).length, C.SIDE.base + (s.upgrades.sidetable || 0));
  if (rebuild || !w.side) w.side = [];
  for (let i = 0; i < nSide; i++) {
    const ls = L.side[i];
    if (!w.side[i]) w.side[i] = { idx: i, x: ls.x, y: ls.y, seats: ls.seats, bar: !!ls.bar, groupId: 0, pot: null, fill: 0, drinks: 0 };
    else { w.side[i].x = ls.x; w.side[i].y = ls.y; w.side[i].seats = ls.seats; w.side[i].bar = !!ls.bar; }
  }
  w.side.length = nSide;
  const nDoor = Math.min(L.waitSpots.length, C.TIERS[s.tier - 1].waitSpots + (L.counter ? 2 : 0) + perkFx(G).queue);
  while (w.doors.length < nDoor) w.doors.push(0);
  w.doors.length = nDoor;
}

// ───────────── actors ─────────────
export function makeActor(G, props) {
  const a = Object.assign({
    id: nid(G.world), type: 'customer', kind: null, lookSeed: 1, memberIdx: 0, groupId: 0, staffId: 0, role: null,
    x: 0, y: 0, floor: 1, facing: 'down', pose: 'idle', carry: null, path: null, pi: 0, speed: 16,
    moving: false, bubble: null, hidden: false, task: null, home: null, alpha: 1,
  }, props);
  G.world.actors.push(a);
  return a;
}
export function removeActor(G, a) {
  const arr = G.world.actors;
  const i = arr.indexOf(a);
  if (i >= 0) arr.splice(i, 1);
}

export function setPath(a, pts) {
  if (!pts || pts.length < 2) { a.path = null; a.pi = 0; return; }
  a.path = pts;
  a.pi = 1;
}
export function walkTo(G, a, tx, ty) {
  const pts = route(G.world.layout, { x: a.x, y: a.y }, { x: tx, y: ty });
  setPath(a, pts);
  return pts;
}
export const arrived = (a) => !a.path;

/** Advance along the path. Returns true when still moving. */
export function stepActor(L, a, dtMin) {
  if (!a.path) { a.moving = false; return false; }
  let rem = a.speed * dtMin;
  const path = a.path;
  while (a.pi < path.length && rem > 0) {
    const p = path[a.pi];
    const dx = p.x - a.x, dy = p.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d <= rem + 1e-6) { a.x = p.x; a.y = p.y; rem -= d; a.pi++; if (d > 0.01) face(a, dx, dy); }
    else { a.x += (dx / d) * rem; a.y += (dy / d) * rem; face(a, dx, dy); rem = 0; }
  }
  if (a.pi >= path.length) { a.path = null; a.moving = false; a.floor = floorOf(L, a.y); return false; }
  a.moving = true;
  a.floor = floorOf(L, a.y);
  return true;
}
function face(a, dx, dy) {
  a.facing = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}
