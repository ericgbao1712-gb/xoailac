// Demand, spawning, group lifecycle, billing (TECH_SPEC §6.1, §6.2, §6.7–6.9).
import * as C from '../config.js';
import { clamp, round2 } from './util.js';
import { isWeekend } from './format.js';
import { route } from './routing.js';
import { makeActor, removeActor, setPath, stepActor, nid } from './world.js';
import {
  POT, ING, DRINK, MARKETING_BY_ID, UP, tierDef, eventDef, mods, ambienceOf, potPrice, addMoney, spend, addXp,
  isPotUnlocked, isDrinkUnlocked, featureUnlocked, sellPrice, priceRatio, menuPriceDemand, useSupply, perkFx, SIDES, isSideUnlocked, consumeIngredient,
} from './economy.js';
import { createTicket, removeTicket, ticketRecipe } from './kitchen.js';
import { scoreGroup, pushRating, makeReview, angryLine } from './rating.js';
import { raining } from './rain.js';

const K = C.CUSTOMERS;
export const CUSTOMER_WALK = 17; // px per game minute

// ───────────── demand ─────────────
export function marketingDemand(G) {
  let m = 1;
  const mt = G.state.marketingToday;
  const hour = Math.floor(G.state.clock / 60);
  for (const id in mt) if (mt[id]) { const d = MARKETING_BY_ID[id]; if (d && d.demand && inHours(d, hour, G)) m *= d.demand; }
  return m;
}
/** Marketing with an hour window (Giờ vàng) only works inside it. */
export const inHours = (d, hour, G) => {
  if (!d.hours) return true;
  const from = d.id === 'giovang' && G && perkFx(G).goldenFrom != null ? Math.min(d.hours[0], perkFx(G).goldenFrom) : d.hours[0];   // Lv 37: from 13h
  return hour >= from && hour < d.hours[1];
};
function marketingDrinkChance(G) {
  let c = 0;
  for (const id in G.state.marketingToday) if (G.state.marketingToday[id]) { const d = MARKETING_BY_ID[id]; if (d && d.drinkChance) c += d.drinkChance + perkFx(G).comboDrink; }
  return c;
}
function marketingDrinkPrice(G) {
  let m = 1;
  for (const id in G.state.marketingToday) if (G.state.marketingToday[id]) { const d = MARKETING_BY_ID[id]; if (d && d.drinkPriceMult) m *= d.drinkPriceMult; }
  return m;
}
export function weatherDemand(G) {
  const s = G.state, w = C.WEATHER[s.weather] || C.WEATHER.sun, t = tierDef(G);
  let m = w.demand;
  if ((s.weather === 'rain' || s.weather === 'storm') && !t.covered) {
    // vỉa hè: nobody sits down in the rain without the tarp; between showers it is an ordinary day
    if (raining(G)) m = s.today.tarp ? w.demand : 0;
    else m = s.weather === 'storm' ? w.demand : 1;
  }
  if (s.weather === 'hot' && s.upgrades.cooling === 0) m = w.noCoolingDemand;
  return m;
}
/** groups per game hour right now */
export function demandRate(G) {
  const s = G.state;
  const hour = Math.floor(s.clock / 60);
  const curve = C.TIME.demandCurve[hour] ?? 0;
  if (!curve) return 0;
  const ev = eventDef(G);
  let r = curve * tierDef(G).demand * C.RATING.demandMult(s.rating.avg) * weatherDemand(G);
  r *= (ev && ev.demand) || 1;
  if (ev && ev.id === 'bongda') r *= mods(G).footballMult;
  if (isWeekend(s.day)) r *= C.TIME.weekendMult;
  r *= marketingDemand(G) * s.viral.mult * (s.boost || 1) * mods(G).demand;
  r *= menuPriceDemand(G);                    // word of mouth: cheap menus pull people in, pricey ones push them away
  return r;
}

// ───────────── helpers ─────────────
export const findGroup = (G, id) => G.world.groups.find((g) => g.id === id) || null;
const tutorialActive = (G) => G.state.day === 1 && !G.state.tutorial.done;

function freeTables(G) {
  const out = [];
  for (const t of G.world.tables) if (t.status === 'free' && !t.reserved) out.push(t);
  return out;
}
function freeDoorIdx(G) {
  const d = G.world.doors;
  for (let i = 0; i < d.length; i++) if (!d[i]) return i;
  return -1;
}
function resetTableView(t) {
  t.pot = null; t.potFill = 0; t.boiling = false; t.plates = 0; t.drinks = 0; t.dirty = false; t.plates0 = 0;
}

function pickExit(L, x) {
  return L.spawn[Math.abs(L.spawn[0].x - x) <= Math.abs(L.spawn[L.spawn.length - 1].x - x) ? 0 : L.spawn.length - 1];
}
const DOOR_OFF = [[0, 0], [7, 1], [-7, 1], [14, 2]];

// ───────────── kind selection ─────────────
function pickKind(G) {
  const s = G.state, w = G.world, rng = G.rng;
  const hour = Math.floor(s.clock / 60);
  const ev = eventDef(G);
  const amb = ambienceOf(G);
  let unlocked = 0;
  for (const p of C.HOTPOTS) if (isPotUnlocked(G, p.id)) unlocked++;
  const ids = Object.keys(K);
  const pf = perkFx(G);
  const mkKind = (id) => { let x = 1; for (const mid in s.marketingToday) if (s.marketingToday[mid]) { const d = MARKETING_BY_ID[mid]; if (d && d.kinds && d.kinds[id]) x *= d.kinds[id]; } return x; };
  return rng.weighted(ids, (id) => {
    const k = K[id];
    if (!k.weight || k.minTier > s.tier || k.oncePerDay) return 0;
    if (k.special && (w.specialSpawned[id] || 0) >= 1) return 0;
    if (k.special && s.day < 3) return 0;
    let m = k.weight * ((k.hours && k.hours[hour]) ?? 1) * ((ev && ev.kinds && ev.kinds[id]) || 1);
    m *= (pf.kindDemand[id] || 1) * mkKind(id);   // level perks (Thẻ khách quen, Tour ăn vặt) · Ngày hội học trò
    if (k.likesAmbience) m *= 1 + 1.5 * amb;
    if (k.likesNew) m *= 1 + 0.2 * Math.max(0, unlocked - 2);
    return m;
  });
}

// ───────────── spawning ─────────────
export function startDay(G) {
  const w = G.world, s = G.state, rng = G.rng;
  w.spawnAcc = 0; w.spawnTarget = rng.exp();
  w.specialSpawned = {}; w.scriptIdx = 0; w.comboN = 0;
  w.chutuDone = false; w.chutuAt = s.day >= 2 ? rng.range(17 * 60, 19 * 60 + 59) : -1;
  w.reviewerAt = s.marketingToday.reviewer ? rng.range(12 * 60, 20 * 60) : -1;
}

const SCRIPT = [
  { at: C.TIME.dayStart + 2, kind: 'sinhvien', size: 2, pot: 'xoailac', drinks: ['trada', 'trada'] },
  { at: C.TIME.dayStart + 40, kind: 'sinhvien', size: 2, pot: 'coclac', drinks: ['trada', 'nuocngot'] },
];

/** v2.6.9 Xe máy giao hàng: while the shop is open, app orders come in (perHour × level per game hour). Each one
 *  takes a portion's fruit and its cup/box + bag from the kho, pays the selling price minus the app's cut, and
 *  never uses a counter spot. No stock → the order is skipped (counted, so the report can say so). */
export function deliveryTick(G, dtMin) {
  const s = G.state, w = G.world, lvl = s.upgrades.delivery || 0;
  if (!lvl || s.phase !== 'open') return;
  const D = C.UPGRADES.find((u) => u.id === 'delivery');
  w.deliveryAcc = (w.deliveryAcc || 0) + (dtMin / 60) * D.perHour * lvl;
  while (w.deliveryAcc >= 1) {
    w.deliveryAcc -= 1;
    const reserved = reservedStock(G);
    const pots = C.HOTPOTS.filter((p) => s.menu[p.id] && isPotUnlocked(G, p.id) && canMake(G, p.id, reserved));
    if (!pots.length) { s.today.deliveryMissed = (s.today.deliveryMissed || 0) + 1; continue; }
    const p = G.rng.pick(pots);
    for (const i of p.recipe) consumeIngredient(G, i, 1);
    const box = boxFor(G, p.id, reserved);
    if (box) { useSupply(G, box, 1); s.stats.packsUsed = (s.stats.packsUsed || 0) + 1; }
    useSupply(G, 'tui', 1);
    const base = round2(sellPrice(G, p.id) * (1 - D.appFee));
    addMoney(G, base, 'delivery');
    s.today.revenue = round2(s.today.revenue + base);
    s.today.potsSold++; s.stats.potsSold++;
    s.today.potsSoldOf[p.id] = (s.today.potsSoldOf[p.id] || 0) + 1;
    s.stats.potsSoldOf[p.id] = (s.stats.potsSoldOf[p.id] || 0) + 1;
    s.recipes[p.id].sold++;
    s.today.delivered = (s.today.delivered || 0) + 1;
    s.stats.delivered = (s.stats.delivered || 0) + 1;
    if (s.today.delivered === 1) G.toast('Có đơn giao hàng đầu tiên trong ngày! Xe máy đã chạy đi giao.', 'info', 'eq_moto');
  }
}

export function spawnTick(G, dtMin) {
  const s = G.state, w = G.world, rng = G.rng;
  if (s.phase !== 'open' || s.clock >= C.TIME.lastSeat) return;
  const tut = tutorialActive(G);
  if (tut && w.scriptIdx < SCRIPT.length) {
    const sc = SCRIPT[w.scriptIdx];
    if (s.clock >= sc.at) { w.scriptIdx++; spawnGroup(G, sc.kind, { size: sc.size, pot: sc.pot, drinks: sc.drinks, tutorial: true }); }
    return;
  }
  if (w.soldOutDay !== s.day) soldOut(G);   // tell the player the moment the kho runs dry, not at the next arrival
  if (w.chutuAt >= 0 && !w.chutuDone && s.clock >= w.chutuAt) { w.chutuDone = true; spawnGroup(G, 'chutu'); }
  if (w.reviewerAt >= 0 && s.clock >= w.reviewerAt) { w.reviewerAt = -1; spawnGroup(G, 'reviewer'); }
  if (tut && w.groups.length > 0) return;
  w.spawnAcc += (demandRate(G) * dtMin) / 60;
  while (w.spawnAcc >= w.spawnTarget) {
    w.spawnAcc -= w.spawnTarget;
    w.spawnTarget = rng.exp();
    // sold out: passers-by see the "hết hàng" board and walk on (the kho restocks tomorrow morning)
    if (soldOut(G)) { s.today.lost++; continue; }
    const kind = pickKind(G);
    if (kind) spawnGroup(G, kind);
  }
}

/** Nothing on the menu can be cooked with what is left in the kho (pending tickets keep their share). */
export function soldOut(G) {
  const s = G.state, reserved = reservedStock(G);
  for (const p of C.HOTPOTS) if (s.menu[p.id] && isPotUnlocked(G, p.id) && canMake(G, p.id, reserved)) return false;
  const w = G.world;
  if (!w.soldOutDay || w.soldOutDay !== s.day) { w.soldOutDay = s.day; s.today.soldOut = true; G.emit('soldOut', {}); }
  return true;
}

export function spawnGroup(G, kind, opts = {}) {
  const s = G.state, w = G.world, rng = G.rng, L = w.layout;
  const k = K[kind];
  if (!k) return null;
  const counter = !!L.counter;
  const takeaway = !counter && !!k.takeaway;   // at the counter everybody orders the same way (grab drivers too)
  const size = opts.size || rng.int(k.group[0], k.group[1]);
  let table = null, door = -1;
  if (!takeaway) {
    const rt = opts.reservation ? w.tables[opts.reservation.tableIdx] : null;
    if (rt && rt.status === 'free') table = rt;
    else {
      const free = freeTables(G);
      // counter: newcomers line up behind whoever is already waiting
      if (free.length && !(counter && queueLen(G) > 0)) table = counter ? free[0] : rng.pick(free);
    }
  }
  if (!table) door = freeDoorIdx(G);
  const gid = nid(w);
  if (!table && door < 0) { // nowhere to wait → they walk past
    s.today.lost++;
    if (k.special) w.specialSpawned[kind] = (w.specialSpawned[kind] || 0) + 1;
    G.emit('customerLeft', { groupId: gid, angry: false, reason: 'door' });
    return null;
  }
  if (k.special) w.specialSpawned[kind] = (w.specialSpawned[kind] || 0) + 1;
  const g = {
    id: gid, kind, size, special: !!k.special, takeaway, state: 'walkingIn', tableIdx: table ? table.idx : -1, doorIdx: door,
    members: [], ticket: null, extraTicket: null, pot: opts.pot || null, drinks: opts.drinks || null, scripted: !!opts.pot,
    timer: 0, doorLeft: C.TIME.doorPatience * (tutorialActive(G) ? 3 : 1), eatTotal: 0, eatLeft: 0, plan: [], extrasServed: 0, extrasExpired: 0, extraRev: 0,
    substitute: false, stars: 0, angry: false, moodT: 0, mood: null, leaveStarted: false, tutorial: !!opts.tutorial || tutorialActive(G),
    born: w.tMin, info: null, deadline: 0, comboAt: 0, lookSeed: rng.int(1, 999999), reservation: opts.reservation || null,
  };
  w.groups.push(g);
  // members appear at an entrance and walk in
  const sp = rng.pick(L.spawn);
  const dir = sp.x < L.w / 2 ? -1 : 1;
  for (let i = 0; i < size; i++) {
    const a = makeActor(G, { type: 'customer', kind, memberIdx: i, lookSeed: g.lookSeed, groupId: g.id, x: sp.x + dir * i * 7, y: sp.y, speed: CUSTOMER_WALK + (i % 2) * 1.5, pose: 'walk' });
    g.members.push(a);
  }
  if (table) assignTable(G, g, table);
  else {
    w.doors[door] = g.id;
    g.state = 'walkingDoor';
    sendToDoor(G, g);
  }
  // collection book
  const first = !(s.book.kinds[kind] > 0);
  s.book.kinds[kind] = (s.book.kinds[kind] || 0) + 1;
  if (first) s.today.newKinds.push(kind);
  G.emit('customerArrive', { groupId: g.id, kind, size, special: g.special, firstTime: first });
  return g;
}

function sendToDoor(G, g) {
  const L = G.world.layout, spot = L.waitSpots[g.doorIdx];
  const OFFS = L.queueOff || DOOR_OFF;
  g.members.forEach((a, i) => {
    const o = OFFS[i % OFFS.length];
    setPath(a, route(L, { x: a.x, y: a.y }, { x: spot.x + o[0], y: spot.y + o[1] }));
    a.pose = 'walk'; a.doorFace = spot.facing;
  });
}

function assignTable(G, g, table) {
  const w = G.world, L = w.layout;
  if (g.doorIdx >= 0) { w.doors[g.doorIdx] = 0; g.doorIdx = -1; }
  table.status = 'occupied'; table.groupId = g.id; table.claimedBy = 0;
  resetTableView(table);
  g.tableIdx = table.idx;
  g.state = 'walkingIn';
  g.members.forEach((a, i) => {
    const seat = table.seats[i % table.seats.length];
    setPath(a, route(L, { x: a.x, y: a.y }, { x: seat.x, y: seat.y }));
    a.pose = 'walk'; a.seatFace = seat.facing; a.carry = null;
  });
}

const allArrived = (g) => g.members.every((a) => !a.path);
const inQueue = (g) => g.doorIdx >= 0 && (g.state === 'waitingDoor' || g.state === 'walkingDoor');
function queueLen(G) { let n = 0; for (const g of G.world.groups) if (inQueue(g)) n++; return n; }

/** Counter view: the queue closes up — the first in line always stands at spot 0. */
function packQueue(G) {
  const w = G.world;
  let i = 0;
  for (const g of w.groups) {
    if (!inQueue(g)) continue;
    if (g.doorIdx !== i) {
      g.doorIdx = i;
      sendToDoor(G, g);
      if (g.state === 'waitingDoor') g.state = 'walkingDoor';
    }
    i++;
  }
  for (let j = 0; j < w.doors.length; j++) w.doors[j] = 0;
  for (const g of w.groups) if (inQueue(g) && g.doorIdx < w.doors.length) w.doors[g.doorIdx] = g.id;
}

// ───────────── per-step group update ─────────────
export function updateGroups(G, dtMin) {
  const w = G.world, s = G.state;
  // door queue → free tables (first come, first served)
  if (w.groups.length && s.phase === 'open') {
    for (const g of w.groups) {
      if (w.layout.counter ? !(inQueue(g) && g.doorIdx === 0) : g.state !== 'waitingDoor' || g.takeaway) continue;
      const free = freeTables(G);
      if (!free.length) break;
      assignTable(G, g, free[0]);
    }
  }
  for (let i = w.groups.length - 1; i >= 0; i--) {
    const g = w.groups[i];
    updateGroup(G, g, dtMin);
    if (g.state === 'gone') w.groups.splice(i, 1);
  }
  if (w.layout && w.layout.counter) packQueue(G);
}

function updateGroup(G, g, dtMin) {
  const w = G.world, s = G.state;
  const closing = s.phase === 'closing';
  for (let i = 0; i < g.members.length; i++) { const a = g.members[i]; if (a.path) stepActor(w.layout, a, dtMin); }
  // closing grace: anyone not yet eating leaves (no penalty) after a while
  if (closing && g.deadline > 0 && ['waitingDoor', 'walkingDoor', 'walkingIn', 'seated', 'ordered', 'doorOrder'].includes(g.state)) {
    g.deadline -= dtMin;
    if (g.deadline <= 0) { closingLeave(G, g); return; }
  }
  switch (g.state) {
    case 'walkingIn': {
      if (!allArrived(g)) break;
      g.state = 'seated';
      g.timer = g.scripted ? 3 : C.TIME.orderDelay;
      g.members.forEach((a) => { a.pose = w.layout.counter ? 'idle' : 'sit'; a.facing = a.seatFace || 'down'; });
      G.emit('seated', { groupId: g.id, tableIdx: g.tableIdx });
      break;
    }
    case 'walkingDoor': {
      if (!allArrived(g)) break;
      g.members.forEach((a) => { a.pose = 'idle'; a.facing = a.doorFace || 'right'; });
      if (g.takeaway) { g.state = 'doorOrder'; g.timer = 1; } else g.state = 'waitingDoor';
      break;
    }
    case 'waitingDoor': {
      g.doorLeft -= dtMin * (mods(G).hasWaiter ? 0.75 : 1);   // the phục vụ pours them a cup of trà đá while they wait
      if (g.doorLeft <= 0) angryLeave(G, g, 'door');
      break;
    }
    case 'doorOrder': {
      g.timer -= dtMin;
      if (g.timer <= 0) placeOrder(G, g);
      break;
    }
    case 'seated': {
      g.timer -= dtMin;
      if (g.timer <= 0) placeOrder(G, g);
      break;
    }
    case 'toSide': {
      if (!allArrived(g)) break;
      g.state = 'eating';
      g.members.forEach((a) => { a.pose = 'sit'; a.facing = a.seatFace || 'down'; });
      break;
    }
    case 'eating': {
      // counter: done with extras → finish eating at a free side table, the counter spot frees up for the next in line
      if (w.layout.counter && !g.seated && !closing && !g.plan.length && !g.extraTicket && g.eatLeft > 1.5 && g.tableIdx >= 0) {
        const st = freeSide(G);
        if (st) { moveToSide(G, g, st); break; }
      }
      // counter: while an extra is on its way they just wait for it
      if (!(w.layout.counter && g.extraTicket)) g.eatLeft -= dtMin / (closing ? 0.3 : 1);
      const prog = 1 - g.eatLeft / g.eatTotal;
      const t = w.tables[g.tableIdx];
      if (t) {
        t.potFill = clamp(1 - 0.7 * prog, 0.2, 1);
        t.plates = Math.min(4, Math.ceil((t.plates0 || 0) * (1 - prog * 0.9)));
      }
      if (g.plan.length && prog >= g.plan[0] && !g.extraTicket && !closing) {
        g.plan.shift();
        orderExtra(G, g);
      }
      if (g.seated) { const sd = w.side[g.sideIdx]; if (sd) sd.fill = clamp(1 - 0.8 * prog, 0.2, 1); }
      if (g.eatLeft <= 0) {
        if (g.extraTicket) { removeTicket(G, g.extraTicket); g.extraTicket = null; g.extrasExpired++; }
        g.state = 'billing'; g.timer = C.TIME.payDelay;
        if (t) { t.boiling = false; t.dirty = true; t.pot = null; t.plates = 0; t.drinks = 0; t.potFill = 0; }
        if (!g.seated) g.members.forEach((a) => { a.pose = 'idle'; });
      }
      break;
    }
    case 'billing': {
      g.timer -= dtMin;
      if (g.timer <= 0) finishGroup(G, g);
      break;
    }
    case 'leaving': {
      if (!g.leaveStarted) {
        g.moodT -= dtMin;
        if (g.moodT > 0) break;
        g.leaveStarted = true;
        const L = w.layout;
        if (g.seated) freeSideOf(G, g);
        g.members.forEach((a) => {
          const ex = pickExit(L, a.x);
          // from a side table: step back onto the pavement walkway, then off-screen
          if (g.seated && L.counter) setPath(a, [{ x: a.x, y: a.y }, { x: a.x, y: L.counter.qY - 1 }, { x: ex.x, y: ex.y }]);
          else setPath(a, route(L, { x: a.x, y: a.y }, { x: ex.x, y: ex.y }));
          a.pose = 'walk';
        });
        break;
      }
      if (allArrived(g)) {
        g.members.forEach((a) => removeActor(G, a));
        g.members.length = 0;
        g.state = 'gone';
      }
      break;
    }
    default: break;
  }
  // actors that are walking show the walk pose
  for (const a of g.members) if (a.path && a.pose !== 'angry') a.pose = 'walk';
}

// ───────────── ordering ─────────────
function reservedStock(G) {
  const r = {};
  for (const t of G.world.tickets) {
    if (t.status === 'done' || t.status === 'dead') continue;
    // supplies are used when the portion is handed over, so every live order holds its container / cups
    if (!t.extra) {
      const pk = C.DISH_PACK[t.pot];
      const box = t.box || (pk && pk.box);                  // v2.6.14: the container chosen for this order
      if (box) r['$' + box] = (r['$' + box] || 0) + 1;
      if (t.drinks.length) r.$ly_nuoc = (r.$ly_nuoc || 0) + t.drinks.length;
    }
    if (t.status === 'ready' || t.status === 'carrying') continue;
    for (const i of ticketRecipe(t)) if (!t.added[i]) r[i] = (r[i] || 0) + 1;
    if (!t.extra && !t.sidesAdded) for (const i of t.sides || []) r[i] = (r[i] || 0) + 1;
  }
  return r;
}
const supplyLeft = (G, id, reserved) => (G.state.supplies[id] || 0) - (reserved['$' + id] || 0);
/** v2.6.14: the dish's own container if there is one left, otherwise the other kind (a cup instead of a box…). */
export function boxFor(G, potId, reserved) {
  const pk = C.DISH_PACK[potId];
  if (!pk) return null;
  const pref = G.state.packPref;                                    // v2.6.19: the shop's chosen container comes first
  if (pref && supplyLeft(G, pref, reserved) >= 1) return pref;
  if (supplyLeft(G, pk.box, reserved) >= 1) return pk.box;
  return C.CONTAINER_IDS.find((id) => id !== pk.box && supplyLeft(G, id, reserved) >= 1) || false;
}
function canMake(G, potId, reserved) {
  if (!POT[potId]) return false;
  for (const i of POT[potId].recipe) if ((G.state.inventory[i] || 0) - (reserved[i] || 0) < 1) return false;
  if (boxFor(G, potId, reserved) === false) return false;           // no cup and no box → this dish cannot be sold
  return true;
}
/** Chance this group walks away from `potId` at its current selling price (C.PRICING). */
export function refuseChance(G, kind, potId) {
  const P = C.PRICING, k = K[kind], s = G.state;
  if (!k || !POT[potId]) return 0;
  const price = sellPrice(G, potId), ref = Math.max(1, potPrice(G, potId));
  const ev = eventDef(G);
  const budget = k.budget * (ev && ev.budgetMult && kind === 'vanphong' ? ev.budgetMult : 1);
  const lvl = (s.recipes[potId] && s.recipes[potId].lvl) || 1;
  const value = P.valueRating * Math.max(0, s.rating.avg - 4) + P.valueRecipe * (lvl - 1) + perkFx(G).priceValue + mods(G).priceValue;
  const z = P.overW * (price / ref - P.overC) + P.budW * (price / budget - P.budC) - value;
  return 1 / (1 + Math.exp(-P.k * z));
}
const choiceMult = (G, potId) => clamp(Math.pow(priceRatio(G, potId), -C.PRICING.choiceExp), C.PRICING.choiceMin, C.PRICING.choiceMax);

function placeOrder(G, g) {
  const s = G.state, rng = G.rng, k = K[g.kind];
  const reserved = reservedStock(G);
  const pots = C.HOTPOTS.filter((p) => s.menu[p.id] && isPotUnlocked(G, p.id));
  const weight = (p) => (k.prefers[p.id] ?? 0.5) * choiceMult(G, p.id);
  if (!g.scripted) {
    // dishes whose stock ran out are off the menu until tomorrow (no buying while open)
    let pick = rng.weighted(pots, weight);
    if (pick && !canMake(G, pick.id, reserved)) {
      const alt = rng.weighted(pots.filter((p) => canMake(G, p.id, reserved)), weight);
      if (alt) { g.substitute = true; pick = alt; } else pick = null;
    }
    if (!pick) { soldOutLeave(G, g); return; }
    // the price on the board: they may find it too dear, look at one other dish, then walk away
    if (!g.tutorial && !g.reservation && rng.chance(refuseChance(G, g.kind, pick.id))) {
      bumpRefused(G, pick.id);
      const others = pots.filter((p) => p.id !== pick.id && canMake(G, p.id, reserved));
      const alt = rng.weighted(others, weight);
      if (alt && !rng.chance(refuseChance(G, g.kind, alt.id))) { pick = alt; g.substitute = true; }
      else { if (alt) bumpRefused(G, alt.id); priceLeave(G, g, pick.id); return; }
    }
    g.pot = pick.id;
  } else if (!canMake(G, g.pot, reserved)) {
    // scripted tutorial order but stock got wasted: pick something makeable
    const alt = pots.find((p) => canMake(G, p.id, reserved));
    if (!alt) { soldOutLeave(G, g); return; }
    g.pot = alt.id;
  }
  if (!g.drinks) {
    g.drinks = [];
    if (!g.takeaway) {
      const drinks = C.DRINKS.filter((d) => isDrinkUnlocked(G, d.id));
      const chance = C.DRINK_CHANCE + s.upgrades.cooler * UP.cooler.drinkChancePer + marketingDrinkChance(G) + mods(G).drinkChance;
      for (let i = 0; i < g.size; i++) {
        if (!rng.chance(chance)) continue;
        const d = rng.weighted(drinks, (x) => (k.drinks && k.drinks[x.id]) ?? 1);
        if (d) g.drinks.push(d.id);
      }
    }
  }
  // v2.5 món ăn kèm: one (sometimes two) of the unlocked sides that are in stock and not promised to another order
  if (!g.sides) {
    g.sides = [];
    if (!g.tutorial) {
      const left = (id) => (s.inventory[id] || 0) - (reserved[id] || 0) - g.sides.filter((x) => x === id).length;
      const pickSide = () => {
        const av = SIDES.filter((d) => isSideUnlocked(G, d.id) && left(d.id) >= 1);
        const d = av.length ? rng.weighted(av, (x) => (x.kinds && x.kinds[g.kind]) || 1) : null;
        if (d) g.sides.push(d.id);
        return !!d;
      };
      // roll only when something is on offer, so shops without sides keep exactly the old random sequence
      const any = SIDES.some((d) => isSideUnlocked(G, d.id) && left(d.id) >= 1);
      if (any && rng.chance(C.SIDE_CHANCE.first) && pickSide() && g.size >= 3 && rng.chance(C.SIDE_CHANCE.second)) pickSide();
    }
  }
  // every drink needs a plastic cup: none left → no drinks for this group
  const cups = Math.max(0, supplyLeft(G, 'ly_nuoc', reserved));
  if (g.drinks.length > cups) {
    s.today.supplyMiss.ly_nuoc = (s.today.supplyMiss.ly_nuoc || 0) + (g.drinks.length - cups);
    g.drinks.length = cups;
    if (!G.world.supplyWarned || !G.world.supplyWarned['ly_nuoc:out']) { G.world.supplyWarned = G.world.supplyWarned || {}; G.world.supplyWarned['ly_nuoc:out'] = true; G.emit('supplyOut', { id: 'ly_nuoc' }); }
  }
  g.price = sellPrice(G, g.pot);   // the price on the board when they ordered is the price they pay
  g.box = boxFor(G, g.pot, reserved) || null;                      // v2.6.14: cup or box (the player can switch it)
  g.ticket = createTicket(G, g);
  g.state = 'ordered';
  g.deadline = s.phase === 'closing' ? 45 : 0;
  G.emit('order', { ticketId: g.ticket.id, tableIdx: g.tableIdx, pot: g.pot, drinks: g.drinks.slice(), extra: null, groupId: g.id });
}

function orderExtra(G, g) {
  const rng = G.rng, reserved = reservedStock(G);
  const left = POT[g.pot].recipe.filter((i) => (G.state.inventory[i] || 0) - (reserved[i] || 0) >= 1);
  if (!left.length) return;                     // nothing left to bring them
  const ing = rng.pick(left);
  const t = createTicket(G, g, ing);
  g.extraTicket = t;
  G.emit('order', { ticketId: t.id, tableIdx: g.tableIdx, pot: g.pot, drinks: [], extra: ing, groupId: g.id });
}

// ───────────── serving (called by workers when the order reaches the table) ─────────────
export function onTicketServed(G, t, carrier) {
  const w = G.world, s = G.state;
  const g = findGroup(G, t.groupId);
  t.status = 'done';
  const i = w.tickets.indexOf(t);
  if (i >= 0) w.tickets.splice(i, 1);
  if (w.tray.ticketId === t.id) w.tray.ticketId = null;
  if (!g) return;
  const table = g.tableIdx >= 0 ? w.tables[g.tableIdx] : null;
  const ratio = t.waited / t.patience;
  const x = table ? table.x : w.layout.waitSpots[Math.max(0, g.doorIdx)].x, y = table ? table.y : w.layout.waitSpots[Math.max(0, g.doorIdx)].y;
  if (t.extra) {
    g.extraTicket = null;
    g.extrasServed++;
    g.extraRev += ING[t.extra].extraPrice;
    s.stats.extrasServed++; s.today.extrasServed++;
    if (table) table.plates = Math.min(4, table.plates + 1);
    G.emit('served', { ticketId: t.id, tableIdx: g.tableIdx, fast: ratio <= C.COMBO.fastRatio, x, y, extra: true });
    return;
  }
  const fast = ratio <= C.COMBO.fastRatio;
  // combo
  if (fast) {
    w.comboN++;
    if (w.comboN >= 2) G.emit('combo', { n: w.comboN, x, y });
    if (w.comboN > s.combo.best) s.combo.best = w.comboN;
    if (w.comboN > s.today.comboMax) s.today.comboMax = w.comboN;
  } else if (ratio > 0.6) comboBreak(G);
  g.comboAt = w.comboN;
  const mk = MARKETING_BY_ID;
  let pm = 1;
  const hourNow = Math.floor(s.clock / 60);
  for (const id in s.marketingToday) if (s.marketingToday[id] && mk[id] && mk[id].priceMult && inHours(mk[id], hourNow, G)) pm *= mk[id].priceMult;
  g.info = { pot: g.pot, maker: t.maker, waitRatio: ratio, priceMult: pm, combo: w.comboN, shake: t.shake || null, shakeN: t.shake === 'perfect' ? w.shakeN || 1 : 0,
    ingQ: t.qN ? t.qSum / t.qN : 0 };
  // packing: the cup / box (reserved at order time), its skewer or chopsticks, one plastic cup per drink
  const pk = C.DISH_PACK[g.pot];
  g.supplyMiss = 0;
  if (pk) {
    if (useSupply(G, t.box || pk.box, 1) < 1) g.supplyMiss++;
    else s.stats.packsUsed = (s.stats.packsUsed || 0) + 1;
    if (pk.tool && useSupply(G, pk.tool, 1) < 1) g.supplyMiss++;
  }
  if (t.drinks.length) useSupply(G, 'ly_nuoc', t.drinks.length);
  // drinks cost is paid when they reach the table
  let dcost = 0;
  for (const d of t.drinks) dcost += DRINK[d].cost * mods(G).drinkCostMult;   // v2.6.9: đá viên, máy lọc nước
  if (dcost > 0) spend(G, 'drinks', dcost, 'drinks');
  G.emit('served', { ticketId: t.id, tableIdx: g.tableIdx, fast, x, y });
  if (g.takeaway) { finishGroup(G, g); return; }
  g.state = 'eating';
  g.eatTotal = g.eatLeft = G.rng.range(C.TIME.eatMinutes[0], C.TIME.eatMinutes[1]);
  g.plan = [];
  if (featureUnlocked(G, 'extras') && K[g.kind].extraChance > 0) {
    const kc = K[g.kind].extraChance;
    if (G.rng.chance(Math.min(0.95, kc))) {
      const f1 = G.world.layout.counter ? G.rng.range(0.15, 0.3) : G.rng.range(0.3, 0.55);
      g.plan.push(f1);
      if (G.rng.chance(Math.min(0.6, kc * 0.5))) g.plan.push(Math.min(0.75, f1 + G.rng.range(0.12, 0.2)));
    }
  }
  if (table) {
    table.pot = g.pot; table.potFill = 1; table.boiling = true; table.dirty = false;
    table.plates0 = Math.min(4, POT[g.pot].recipe.length); table.plates = table.plates0; table.drinks = Math.min(4, t.drinks.length);
  }
  g.members.forEach((a) => { a.pose = G.world.layout.counter ? 'idle' : 'eat'; });
}

export function comboBreak(G) {
  const w = G.world;
  if (w.comboN >= 2) G.emit('comboBreak', { n: w.comboN });
  w.comboN = 0;
}

// ───────────── billing / finishing ─────────────
function tipFor(G, g, stars) {
  const k = K[g.kind], rng = G.rng;
  const gate = stars >= 4 ? 1 : stars === 3 ? 0.5 : 0;
  if (!gate || !rng.chance(k.tipChance * gate)) return 0;
  const m = mods(G).tip * (G.state.rating.avg >= 4.5 ? 1.2 : 1);
  return Math.max(1, Math.round(rng.range(k.tip[0], k.tip[1]) * m));
}

function finishGroup(G, g) {
  const s = G.state, w = G.world, rng = G.rng;
  const table = g.tableIdx >= 0 ? w.tables[g.tableIdx] : null;
  const L = w.layout;
  const spot = !table && g.doorIdx >= 0 ? L.waitSpots[g.doorIdx] : null;
  const side = g.seated ? w.side[g.sideIdx] : null;
  const x = side ? side.x : table ? table.x : spot ? spot.x : 0, y = side ? side.y : table ? table.y : spot ? spot.y : 0;
  // a bag for whoever takes the food away, napkins for everybody
  if (!g.seated && useSupply(G, 'tui', 1) < 1) g.supplyMiss = (g.supplyMiss || 0) + 1;
  if (useSupply(G, 'khan', 1) < 1) g.supplyMiss = (g.supplyMiss || 0) + 1;
  const sc = scoreGroup(G, g);
  const stars = sc.stars;
  g.stars = stars;
  // money
  const info = g.info || { priceMult: 1, combo: 0 };
  const comboBonus = Math.min(info.combo * C.COMBO.bonusPer, C.COMBO.maxBonus);
  const potPart = (g.price != null ? g.price : sellPrice(G, g.pot)) * (info.priceMult || 1) * (1 + comboBonus);
  if (g.price != null && g.price > potPrice(G, g.pot)) G.counter('priceySold', 1);
  let drinksRev = 0;
  const drinkIds = g.drinks || [];
  const dpm = marketingDrinkPrice(G);
  for (const d of drinkIds) drinksRev += DRINK[d].price * dpm;
  const sideIds = g.sides || [];
  let sidesRev = 0;
  for (const d of sideIds) sidesRev += (ING[d] && ING[d].side) || 0;
  let tip = tipFor(G, g, stars);
  if (info.shake === 'perfect') tip += Math.max(1, Math.round(potPart * (C.SHAKE.tip + Math.min(C.SHAKE.maxStreakTip, C.SHAKE.streakTip * Math.max(0, (info.shakeN || 1) - 1)))));
  const base = round2(potPart + drinksRev + sidesRev + g.extraRev);
  // rating + XP
  pushRating(G, stars, g.special ? K[g.kind].reviewWeight || 1 : 1);
  s.today.stars += stars; s.today.rated++;
  if (stars >= 5) { s.stats.fiveStars++; s.today.fiveStars++; }
  addXp(G, Math.round(C.LEVEL.xpForGroup(potPrice(G, g.pot), g.size, stars, s.tier) * C.LEVEL.serveXpMult(s.level)), x, y - 10);   // v2.6.18
  // review
  const wantsReview = g.special || stars <= 1 || rng.chance(C.RATING.reviewChance);
  let review = null;
  if (wantsReview) {
    review = makeReview(G, g, stars, sc.f);
    if (!s.today.bestReviewId || review.stars >= (s.reviews.find((r) => r.id === s.today.bestReviewId) || { stars: 0 }).stars) {
      if (review.stars >= 4) s.today.bestReviewId = review.id;
    }
    G.emit('review', { review, x, y, groupId: g.id });
  }
  if (stars >= 5) G.mom('firstFive');
  // special-customer consequences
  if (g.kind === 'reviewer') {
    if (stars >= 5) { s.viral = { days: C.VIRAL.days, mult: C.VIRAL.demand }; G.mom('reviewerGood'); G.counter('reviewer5', 1); G.toast('Food Reviewer chấm 5★! Quán viral 2 ngày!', 'good', 'ui_review'); }
    else if (stars <= 3) { s.viral = { days: C.VIRAL.days, mult: C.VIRAL.badDemand }; G.mom('reviewerBad'); G.toast('Reviewer chê rồi… khách sẽ giảm vài hôm.', 'bad', 'ui_review'); }
  }
  if (g.kind === 'tiktoker' && stars >= 4) { s.nextBoost = 1.2; G.toast('TikToker khen quán! Mai khách đông hơn +20%.', 'good', 'ui_phone'); }
  g.coinInfo = { base, tip, amount: round2(base + tip), pot: g.pot, drinks: drinkIds.length, sides: sideIds.length, size: g.size, kind: g.kind, stars };
  g.members.forEach((a) => { a.pose = stars >= 5 ? 'cheer' : 'idle'; });
  if (g.takeaway) {
    G.emit('bill', { tableIdx: -1, amount: g.coinInfo.amount, tip, x, y, groupId: g.id });
    payCoins(G, g.coinInfo, 'staff', x, y);
    if (g.doorIdx >= 0) { w.doors[g.doorIdx] = 0; g.doorIdx = -1; }
    startLeaving(G, g, stars >= 5 ? 3.3 : 0.6, false, 'paid');
    return;
  }
  if (side) {
    // side table: they pay before getting up (straight into the két) and leave
    G.emit('bill', { tableIdx: -1, amount: g.coinInfo.amount, tip, x, y, groupId: g.id });
    payCoins(G, g.coinInfo, 'player', x, y - 8, -1);
    s.today.seated++; s.stats.seated = (s.stats.seated || 0) + 1;
    g.members.forEach((a) => { a.pose = stars >= 5 ? 'cheer' : 'idle'; });
    startLeaving(G, g, stars >= 5 ? 2.2 : 0.6, false, 'paid');
    return;
  }
  if (L.counter) {
    // counter: they pay over the counter, the money goes straight into the két
    G.emit('bill', { tableIdx: g.tableIdx, amount: g.coinInfo.amount, tip, x, y, groupId: g.id });
    payCoins(G, g.coinInfo, 'player', x, y - 8, g.tableIdx);
    if (table && table.groupId === g.id) { table.status = 'free'; table.groupId = 0; table.claimedBy = 0; resetTableView(table); }
    startLeaving(G, g, stars >= 5 ? 2.2 : 0.5, false, 'paid');
    return;
  }
  if (table) {
    table.coins = { amount: g.coinInfo.amount, tip, since: w.time, info: g.coinInfo };
    table.status = 'coins';
    table.groupId = 0;
    table.dirty = true;
    table.fresh = w.time;
  }
  G.emit('bill', { tableIdx: g.tableIdx, amount: g.coinInfo.amount, tip, x, y, groupId: g.id });
  startLeaving(G, g, stars >= 5 ? 3.3 : 0.6, false, 'paid');
}

function startLeaving(G, g, moodMin, angry, reason) {
  g.state = 'leaving';
  g.moodT = moodMin;
  g.leaveStarted = false;
  G.emit('customerLeft', { groupId: g.id, angry, reason });
}

function payCoins(G, info, by, x, y, tableIdx = -1) {
  const s = G.state;
  addMoney(G, info.amount, 'collect', x, y);
  s.today.revenue = round2(s.today.revenue + info.base);
  s.today.tips = round2(s.today.tips + info.tip);
  s.today.served++; s.stats.served++;
  s.today.potsSold++; s.stats.potsSold++;
  s.today.potsSoldOf[info.pot] = (s.today.potsSoldOf[info.pot] || 0) + 1;
  s.stats.potsSoldOf[info.pot] = (s.stats.potsSoldOf[info.pot] || 0) + 1;
  s.recipes[info.pot].sold++;
  s.today.drinksSold += info.drinks; s.stats.drinksSold += info.drinks;
  if (info.sides) { s.today.sidesSold = (s.today.sidesSold || 0) + info.sides; s.stats.sidesSold = (s.stats.sidesSold || 0) + info.sides; }
  G.emit('collected', { tableIdx, amount: info.amount, x, y, by });
}

/** Tap on a coin pile (player) or a worker finishing the collect job. */
export function collectCoins(G, tableIdx, by = 'player') {
  const t = G.world.tables[tableIdx];
  if (!t || !t.coins) return { ok: false, reason: 'noCoins', msg: 'Bàn này chưa có tiền để thu.' };
  const c = t.coins;
  t.coins = null; t.status = 'free'; t.claimedBy = 0;
  resetTableView(t);
  payCoins(G, c.info, by, t.x, t.y - 6, tableIdx);
  return { ok: true, amount: c.amount, tip: c.info ? c.tip : 0 };
}

// ───────────── leaving without paying ─────────────
export function angryLeave(G, g, reason, potForText) {
  const s = G.state, w = G.world;
  if (g.state === 'leaving' || g.state === 'gone') return;
  g.angry = true; g.stars = C.SAT.angryStars;
  freeSeat(G, g);
  const sc = { f: { wRatio: 1 } };
  s.today.angry++; s.stats.angry++;
  if (s.today.noAngryUntil == null) s.today.noAngryUntil = Math.round(s.clock);
  pushRating(G, g.stars, g.special ? K[g.kind].reviewWeight || 1 : 1);
  s.today.stars += g.stars; s.today.rated++;
  const gg = Object.assign({}, g, { pot: potForText || g.pot || 'xoailac' });
  const review = makeReview(G, gg, 1, null, angryLine(reason));
  const table = g.tableIdx >= 0 ? w.tables[g.tableIdx] : null;
  const x = table ? table.x : g.members[0] ? g.members[0].x : 0, y = table ? table.y : g.members[0] ? g.members[0].y : 0;
  G.emit('review', { review, x, y, groupId: g.id });
  comboBreak(G);
  G.mom('firstAngry');
  g.members.forEach((a) => { a.pose = 'angry'; a.path = null; });
  startLeaving(G, g, 4.9, true, reason === 'wait' || reason === 'door' || reason === 'stock' || reason === 'rain' ? reason : 'wait');
  if (g.kind === 'reviewer') { s.viral = { days: C.VIRAL.days, mult: C.VIRAL.badDemand }; G.mom('reviewerBad'); }
  return sc;
}

/** Seated but everything is sold out: they leave disappointed, without a rating. */
function soldOutLeave(G, g) {
  const s = G.state;
  s.today.lost++;
  soldOut(G);
  freeSeat(G, g);
  startLeaving(G, g, 1.5, false, 'soldout');
  g.members.forEach((a) => { a.path = null; a.pose = 'idle'; });
}

export function closingLeave(G, g) {
  freeSeat(G, g);
  startLeaving(G, g, 0.5, false, 'closing');
  g.members.forEach((a) => { a.path = null; a.pose = 'idle'; });
}

/** Release table / door spot / tickets of a group that is leaving unserved. */
function freeSeat(G, g) {
  const w = G.world;
  if (g.ticket) { removeTicket(G, g.ticket); g.ticket = null; }
  if (g.extraTicket) { removeTicket(G, g.extraTicket); g.extraTicket = null; }
  for (const t of w.tickets.slice()) if (t.groupId === g.id) removeTicket(G, t);
  if (g.doorIdx >= 0) { w.doors[g.doorIdx] = 0; g.doorIdx = -1; }
  if (g.tableIdx >= 0) {
    const t = w.tables[g.tableIdx];
    if (t && t.groupId === g.id) { t.status = 'free'; t.groupId = 0; resetTableView(t); }
  }
  if (g.seated) freeSideOf(G, g);
}

// ───────────── side tables (bàn ghế hai bên quán) ─────────────
function freeSide(G) {
  for (const sd of G.world.side) if (!sd.groupId) return sd;
  return null;
}
function freeSideOf(G, g) {
  const sd = G.world.side[g.sideIdx];
  if (sd && sd.groupId === g.id) { sd.groupId = 0; sd.pot = null; sd.fill = 0; sd.drinks = 0; }
}
/** A served group carries its cups from the counter to a side table; the counter spot is free for the next in line. */
function moveToSide(G, g, sd) {
  const w = G.world, L = w.layout;
  const t = w.tables[g.tableIdx];
  if (t && t.groupId === g.id) { t.status = 'free'; t.groupId = 0; t.claimedBy = 0; resetTableView(t); }
  g.tableIdx = -1;
  g.seated = true; g.sideIdx = sd.idx;
  sd.groupId = g.id; sd.pot = g.pot; sd.fill = 1; sd.drinks = Math.min(4, (g.drinks || []).length);
  g.eatLeft *= C.SIDE.eatMult; g.eatTotal = Math.max(g.eatTotal, g.eatLeft);
  g.state = 'toSide';
  const mid = L.counter ? L.counter.qY + 4 : sd.y;
  g.members.forEach((a, i) => {
    const seat = sd.seats[i % sd.seats.length];
    setPath(a, [{ x: a.x, y: a.y }, { x: a.x, y: mid }, { x: seat.x, y: mid }, { x: seat.x, y: seat.y }]);
    a.pose = 'walk'; a.seatFace = seat.facing;
  });
  G.emit('seatedSide', { groupId: g.id, idx: sd.idx });
}

// ───────────── walking away over the price ─────────────
function bumpRefused(G, potId) {
  const t = G.state.today;
  t.priceRefused[potId] = (t.priceRefused[potId] || 0) + 1;
}
function priceLeave(G, g, potId) {
  const s = G.state;
  s.today.lost++; s.today.priceLost++;
  g.priceLeave = true;
  G.emit('priceLeave', { groupId: g.id, pot: potId, n: s.today.priceLost });
  if (G.rng.chance(C.PRICING.priceyReviewChance)) {
    pushRating(G, 3, 1);
    s.today.stars += 3; s.today.rated++;
    const gg = Object.assign({}, g, { pot: potId });
    const lines = C.REVIEW_TEXT.tags.pricey;
    const review = makeReview(G, gg, 3, null, G.rng.pick(lines));
    G.emit('review', { review, x: g.members[0] ? g.members[0].x : 0, y: g.members[0] ? g.members[0].y : 0, groupId: g.id });
  }
  freeSeat(G, g);
  startLeaving(G, g, 1.2, false, 'price');
  g.members.forEach((a) => { a.path = null; a.pose = 'idle'; });
}

export function ticketExpired(G, t) {
  const g = findGroup(G, t.groupId);
  if (t.extra) {
    removeTicket(G, t);
    if (g) { g.extraTicket = null; g.extrasExpired++; }
    return;
  }
  if (g) angryLeave(G, g, 'wait');
  else removeTicket(G, t);
}

/** Entering the closing phase: anyone who has not started eating gets a short grace, door-waiters leave now. */
export function beginClosing(G) {
  for (const g of G.world.groups) {
    if (g.state === 'waitingDoor' || g.state === 'walkingDoor') { closingLeave(G, g); continue; }
    if (['walkingIn', 'seated', 'ordered', 'doorOrder'].includes(g.state)) g.deadline = 45;
  }
}

export function resetCustomers(G) {
  const w = G.world;
  for (const a of w.actors.slice()) if (a.type === 'customer') removeActor(G, a);
  w.groups.length = 0; w.tickets.length = 0; w.tray.ticketId = null;
  for (let i = 0; i < w.doors.length; i++) w.doors[i] = 0;
  for (const t of w.tables) { t.status = 'free'; t.groupId = 0; t.coins = null; t.claimedBy = 0; resetTableView(t); }
  for (const sd of w.side || []) { sd.groupId = 0; sd.pot = null; sd.fill = 0; sd.drinks = 0; }
}
