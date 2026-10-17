// Owner, waiter, chef, cashier and storekeeper brains (TECH_SPEC §6.5, §6.6).
// Every worker is an actor with an explicit task object (no closures) so a tick allocates nothing.
import * as C from '../config.js';
import { makeActor, removeActor, stepActor, walkTo } from './world.js';
import { UP, mods, consumeIngredient, featureUnlocked, ING, perkFx } from './economy.js';
import { findTicket, missingIngredients, needsDrinks, needsSides, putSides } from './kitchen.js';
import { onTicketServed, collectCoins } from './customers.js';
import { staffJob } from './staff.js';

// ───────────── speed helpers ─────────────
export const managing = (G) => G.state.ownerMode === 'manage' && featureUnlocked(G, 'manageMode');
/** Mood band of a staff member: 'good' | 'ok' | 'bad' | 'risk' (C.MOOD.levels). */
export function moodBand(m) {
  const v = typeof m.mood === 'number' ? m.mood : C.MOOD.start;
  for (const [min, , key] of C.MOOD.levels) if (v >= min) return key;
  return 'risk';
}
export function staffSpeed(G, m) {
  let f = C.STAFF.speedMult(m.spd) * (C.MOOD.speed[moodBand(m)] || 1) * perkFx(G).staffSpeed;   // unhappy (unpaid) staff drag their feet · Lv 27 Quản lý ca
  if (m.trait === 'nhanh') f *= 1.2;
  else if (m.trait === 'vung') f *= 0.9;
  if (managing(G)) f *= 1 + C.STAFF.managerBonus;
  return f;
}
function staffWalk(G, m) {
  let f = C.STAFF.walkPxPerMin(m.spd);
  if (m.trait === 'nhanh') f *= 1.2;
  else if (m.trait === 'vung') f *= 0.9;
  if (managing(G)) f *= 1 + C.STAFF.managerBonus;
  return f;
}
const prepTime = (G, m) => C.OWNER.chefPrepPerIngredient / (staffSpeed(G, m) * (1 + G.state.upgrades.knife * UP.knife.speedPer) * perkFx(G).prepSpeed);

// ───────────── actors ─────────────
function homeOf(G, m) {
  const L = G.world.layout, s = G.state;
  const same = s.staff.filter((x) => x.role === m.role);
  const ord = Math.max(0, same.indexOf(m));
  if (m.role === 'phucvu') return L.staffSpots.waiter[ord % L.staffSpots.waiter.length];
  if (m.role === 'daubep') return L.kitchen.chefSpots[ord % L.kitchen.chefSpots.length];
  if (m.role === 'thungan') return L.staffSpots.cashier || L.staffSpots.waiter[0];
  return L.staffSpots.quankho || L.kitchen.ownerHome;
}

/** Create/remove actors so they match the owner + state.staff. */
export function syncWorkers(G, teleport = false) {
  const w = G.world, s = G.state, L = w.layout;
  if (!w.owner) {
    const h = L.kitchen.ownerHome;
    w.owner = makeActor(G, { type: 'owner', kind: 'owner', x: h.x, y: h.y, speed: C.OWNER.walkPxPerMin, home: h, facing: 'down' });
  } else if (teleport) {
    const h = L.kitchen.ownerHome;
    w.owner.x = h.x; w.owner.y = h.y; w.owner.path = null; w.owner.task = null; w.owner.carry = null; w.owner.floor = 1;
  }
  w.owner.home = L.kitchen.ownerHome;
  const alive = new Set();
  for (const m of s.staff) {
    alive.add(m.id);
    let a = w.staffActors.get(m.id);
    const h = homeOf(G, m);
    if (!a) {
      const sp = L.spawn[0];
      a = makeActor(G, { type: 'staff', kind: m.role, role: m.role, staffId: m.id, lookSeed: m.look.lookSeed, x: teleport ? h.x : sp.x, y: teleport ? h.y : sp.y, speed: staffWalk(G, m), facing: 'down' });
      w.staffActors.set(m.id, a);
    } else if (teleport) { a.x = h.x; a.y = h.y; a.path = null; a.task = null; a.carry = null; a.floor = 1; }
    a.home = h;
  }
  for (const [id, a] of w.staffActors) {
    if (alive.has(id)) continue;
    releaseTask(G, a);
    removeActor(G, a);
    w.staffActors.delete(id);
  }
  G.workersDirty = false;
}

/** Give back whatever the actor was holding (fired, tier change…). */
function releaseTask(G, a) {
  const t = a.task;
  a.task = null; a.carry = null;
  if (!t) return;
  const w = G.world;
  if (t.tid) {
    const tk = findTicket(G, t.tid);
    if (tk && tk.claimedBy === a.id) {
      if (tk.status === 'chef') { tk.status = 'new'; tk.claimedBy = 0; }
      else if (tk.status === 'carrying') { tk.status = 'ready'; tk.claimedBy = 0; }
    }
  }
  if (t.type === 'collect') { const tb = w.tables[t.idx]; if (tb && tb.claimedBy === a.id) tb.claimedBy = 0; }
}

export function resetWorkers(G) {
  const w = G.world;
  for (const a of w.actors) if (a.type === 'owner' || a.type === 'staff') { releaseTask(G, a); a.path = null; }
}

// ───────────── serve points ─────────────
function servePoint(G, t, out) {
  const w = G.world, L = w.layout;
  if (t.takeaway || t.tableIdx < 0) {
    const g = L.waitSpots[Math.max(0, t.door)];
    out.x = g.x + 12; out.y = g.y; return out;
  }
  const tb = w.tables[t.tableIdx];
  let ax = L.aisles[0];
  for (const x of L.aisles) if (Math.abs(x - tb.x) < Math.abs(ax - tb.x)) ax = x;
  const dx = tb.x - ax;
  const shift = Math.sign(dx) * Math.max(0, Math.min(10, Math.abs(dx) - 18));
  out.x = ax + shift; out.y = tb.y; return out;
}
const _p = { x: 0, y: 0 };

// ───────────── per-frame worker update ─────────────
export function updateWorkers(G, dtMin) {
  const w = G.world, s = G.state;
  if (G.workersDirty || w.staffActors.size !== s.staff.length) syncWorkers(G);
  const open = s.phase === 'open' || s.phase === 'closing';
  if (open) {
    if (w.layout.counter) handOver(G, dtMin);
    else assignDeliveries(G);
  }
  tickOwner(G, w.owner, dtMin);
  for (const m of s.staff) {
    const a = w.staffActors.get(m.id);
    if (!a) continue;
    a.speed = staffWalk(G, m);
    switch (m.role) {
      case 'phucvu': tickWaiter(G, a, m, dtMin, open); break;
      case 'daubep': tickChef(G, a, m, dtMin, open); break;
      case 'thungan': tickStander(G, a, dtMin, 'idle'); break;
      default: tickStander(G, a, dtMin, 'write');
    }
  }
}

function goHome(G, a, pose) {
  const h = a.home;
  if (!h) return;
  if (Math.abs(a.x - h.x) > 1.5 || Math.abs(a.y - h.y) > 1.5) { walkTo(G, a, h.x, h.y); a.pose = 'walk'; return; }
  a.pose = pose;
  a.facing = h.facing || 'down';
}

// ───────────── delivery (waiters first, owner as fallback) ─────────────
function assignDeliveries(G) {
  const w = G.world, s = G.state, L = w.layout;
  for (const t of w.tickets) {
    if (t.status !== 'ready' || t.claimedBy) continue;
    let best = null, bd = Infinity;
    for (const m of s.staff) {
      if (m.role !== 'phucvu') continue;
      const a = w.staffActors.get(m.id);
      if (!a || a.task) continue;
      const d = Math.abs(a.x - L.kitchen.pickup.x) + Math.abs(a.y - L.kitchen.pickup.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) {
      const o = w.owner;
      if (o && !o.task && (!managing(G) || !mods(G).hasWaiter)) best = o;
    }
    if (!best) break;
    t.claimedBy = best.id;
    best.task = { type: 'deliver', stage: 'toPickup', tid: t.id, idx: -1, timer: 0 };
    walkTo(G, best, L.kitchen.pickup.x, L.kitchen.pickup.y);
  }
}

/** Counter view: a finished cup is handed straight over the counter (by a phục vụ when there is one). */
let handRR = 0;
function handOver(G, dtMin) {
  const w = G.world, s = G.state;
  for (let i = w.tickets.length - 1; i >= 0; i--) {
    const t = w.tickets[i];
    if (t.status !== 'ready') continue;
    t.handT = (t.handT || 0) + dtMin;
    if (t.handT < 0.5) continue;
    const waiters = s.staff.filter((m) => m.role === 'phucvu');
    const m = waiters.length ? waiters[handRR++ % waiters.length] : null;
    onTicketServed(G, t, m ? w.staffActors.get(m.id) : w.owner);
    if (m) staffJob(G, m);
  }
}

/** Shared deliver step. Returns true while the task is still running. */
function stepDeliver(G, a, m, dtMin) {
  const w = G.world, L = w.layout, task = a.task;
  const t = findTicket(G, task.tid);
  if (!t || t.status === 'dead' || t.status === 'done') { a.task = null; a.carry = null; return false; }
  if (a.path) { stepActor(L, a, dtMin); a.pose = 'walk'; return true; }
  if (task.stage === 'toPickup') {
    t.status = 'carrying';
    a.carry = 'pot';
    task.stage = 'toTable';
    servePoint(G, t, _p);
    walkTo(G, a, _p.x, _p.y);
    return true;
  }
  a.carry = null; a.task = null; a.pose = 'idle';
  onTicketServed(G, t, a);
  if (m) staffJob(G, m);
  return false;
}

// ───────────── owner ─────────────
function tickOwner(G, a, dtMin) {
  if (!a) return;
  const L = G.world.layout;
  a.speed = C.OWNER.walkPxPerMin;
  if (a.task) { stepDeliver(G, a, null, dtMin); return; }
  if (a.path) { stepActor(L, a, dtMin); a.pose = 'walk'; return; }
  const mg = managing(G);
  const target = mg ? L.staffSpots.manager : L.kitchen.ownerHome;
  if (Math.abs(a.x - target.x) > 1.5 || Math.abs(a.y - target.y) > 1.5) { walkTo(G, a, target.x, target.y); a.pose = 'walk'; return; }
  a.facing = 'down';
  if (mg) a.pose = 'write';
  else a.pose = G.world.cookPoseT > 0 ? 'cook' : 'idle';
}

// ───────────── waiter ─────────────
function tickWaiter(G, a, m, dtMin, open) {
  const w = G.world;
  const task = a.task;
  if (task) {
    if (task.type === 'deliver') { stepDeliver(G, a, m, dtMin); return; }
    if (task.type === 'collect') {
      const tb = w.tables[task.idx];
      if (!tb || !tb.coins) { if (tb && tb.claimedBy === a.id) tb.claimedBy = 0; a.task = null; return; }
      if (a.path) { stepActor(w.layout, a, dtMin); a.pose = 'walk'; return; }
      if (task.stage === 'toTable') { task.stage = 'work'; task.timer = C.TIME.collectMinutes / staffSpeed(G, m); a.pose = 'idle'; a.facing = 'down'; return; }
      task.timer -= dtMin;
      a.carry = 'coins';
      if (task.timer <= 0) {
        tb.claimedBy = 0;
        a.task = null; a.carry = null;
        collectCoins(G, task.idx, 'staff');
        staffJob(G, m);
      }
      return;
    }
  }
  if (a.path) { stepActor(w.layout, a, dtMin); a.pose = 'walk'; return; }
  if (open || G.state.phase === 'report') {
    let best = null, bd = Infinity;
    for (const tb of w.tables) {
      if (tb.status !== 'coins' || !tb.coins || tb.claimedBy) continue;
      const d = Math.abs(a.x - tb.x) + Math.abs(a.y - tb.y);
      if (d < bd) { bd = d; best = tb; }
    }
    if (best) {
      best.claimedBy = a.id;
      a.task = { type: 'collect', stage: 'toTable', tid: 0, idx: best.idx, timer: 0 };
      const L = w.layout;
      let ax = L.aisles[0];
      for (const x of L.aisles) if (Math.abs(x - best.x) < Math.abs(ax - best.x)) ax = x;
      walkTo(G, a, ax, best.y);
      return;
    }
  }
  goHome(G, a, 'idle');
}

// ───────────── cashier / storekeeper ─────────────
function tickStander(G, a, dtMin, pose) {
  if (a.path) { stepActor(G.world.layout, a, dtMin); a.pose = 'walk'; return; }
  goHome(G, a, pose);
}

// ───────────── chef ─────────────
function stockBlocked(G, t) {
  const inv = G.state.inventory;
  for (const i of missingIngredients(t)) if ((inv[i] || 0) <= 0) return i;
  return null;
}
function warnOut(G, ing) {
  const w = G.world;
  if ((w.chefWarn[ing] ?? -99) < w.tMin - 20) { w.chefWarn[ing] = w.tMin; G.toast(`Hết ${ING[ing].name.toLowerCase()} rồi — mở Kho nhập thêm nha.`, 'bad', ING[ing].icon); }
}

function tickChef(G, a, m, dtMin, open) {
  const w = G.world, s = G.state, L = w.layout;
  if (a.path) { stepActor(L, a, dtMin); a.pose = 'walk'; return; }
  if (!a.task) {
    if (open) {
      for (const t of w.tickets) {
        if (t.status !== 'new' || t.claimedBy || (t.chefBlock || 0) > w.tMin) continue;
        if (w.tMin - t.createdAt < 1.5) continue;
        const lack = stockBlocked(G, t);
        if (lack) { warnOut(G, lack); t.chefBlock = w.tMin + 6; continue; }
        t.status = 'chef'; t.claimedBy = a.id;
        a.task = { type: 'chef', stage: 'prep', tid: t.id, idx: -1, timer: prepTime(G, m) };
        break;
      }
    }
    if (!a.task) { goHome(G, a, 'idle'); return; }
    if (Math.abs(a.x - a.home.x) > 1.5 || Math.abs(a.y - a.home.y) > 1.5) { walkTo(G, a, a.home.x, a.home.y); a.pose = 'walk'; return; }
  }
  const tk = a.task;
  const t = findTicket(G, tk.tid);
  if (!t || t.status === 'dead') { a.task = null; a.carry = null; return; }
  a.pose = 'cook'; a.facing = 'down';
  if (tk.stage === 'prep') {
    tk.timer -= dtMin;
    while (tk.timer <= 0) {
      const miss = missingIngredients(t);
      if (miss.length) {
        const ing = miss[0];
        if ((s.inventory[ing] || 0) <= 0) { // ran out mid-prep
          t.status = 'new'; t.claimedBy = 0; t.chefBlock = w.tMin + 6; a.task = null;
          warnOut(G, ing);
          return;
        }
        if (!(m.trait === 'tietkiem' && G.rng.chance(0.1))) { const q = consumeIngredient(G, ing, 1); t.qSum = (t.qSum || 0) + (q || 0); t.qN = (t.qN || 0) + 1; }
        t.added[ing] = 1;
        G.emit('ingredientAdded', { ing, complete: miss.length === 1, ticketId: t.id, by: 'staff' });
        tk.timer += prepTime(G, m);
      } else if (needsDrinks(t)) {
        t.drinksAdded = true;
        G.emit('drinksAdded', { ticketId: t.id, by: 'staff' });
        tk.timer += prepTime(G, m) * 0.5;
      } else if (needsSides(t)) {
        if (!putSides(G, t)) {                           // a side ran out: the order goes on without it
          t.sides = []; t.sidesAdded = true; const g = (G.world.groups || []).find((x) => x.id === t.groupId); if (g) g.sides = [];
        }
        G.emit('sidesAdded', { ticketId: t.id, by: 'staff' });
        tk.timer += prepTime(G, m) * 0.5;
      } else {
        t.status = 'ready'; t.claimedBy = 0; t.readyAt = w.tMin;
        t.maker = { type: 'staff', skl: m.skl, trait: m.trait };
        a.task = null;
        G.emit('ticketReady', { ticketId: t.id, by: 'staff' });
        staffJob(G, m);
        return;
      }
    }
  }
}
