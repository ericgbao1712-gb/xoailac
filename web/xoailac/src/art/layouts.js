// Scene layouts per tier — PURE DATA, no DOM (the headless balance sim imports this).
// Owned by the scene artist (Art-B). Initial version by the designer; Art-B may move any
// coordinate to match the art, but must keep the schema and the counts (tables = TIERS.maxTables,
// stoves = TIERS.maxStoves, waitSpots ≥ TIERS.waitSpots).
//
// Coordinates: world pixels, origin = top-left of the scene core (w × h). Characters are anchored
// at their FEET (bottom-centre). Every drawable is y-sorted by its `y` (or `sortY` when given).
//
// Schema (see TECH_SPEC.md §Layout):
// {
//   scene, w, h,
//   lane: { y },                         // pedestrians walk along this line, off-screen to on-screen
//   aisles: [x…],                        // vertical walkways between table columns (routing, see TECH_SPEC §Routing)
//   serviceY: y,                         // horizontal walkway between kitchen and dining area (per floor: serviceY2 on floor 2)
//   spawn: [{x,y}],                      // off-screen entry/exit points (left, right)
//   waitSpots: [{x,y,facing}],           // groups waiting for a free table (door queue)
//   tables: [{x,y,floor, seats:[{x,y,facing}]×4 }],  // tabletop centre; seat order = fill order
//   kitchen: { stoves:[{x,y,sortY}], chefSpots:[{x,y,facing}], pickup:{x,y}, ownerHome:{x,y} },
//   staffSpots: { waiter:[{x,y}], cashier:{x,y}|null, quankho:{x,y}|null, manager:{x,y} },
//   props: [{id,x,y}],                   // static y-sorted props art draws via drawProp(id,…)
//   deco: { den:[…], cay:[…], tuong:[…], dacbiet:[…] },  // where equipped deco is drawn
//   equip: { cooler, cooling, speaker, pos, tarp },       // where upgrade props are drawn
//   sign: {x,y,w,h},                     // shop-name text box (overlay text drawn by renderer)
//   street: { y } | null,                // vehicles drive along this y
//   floors: [{id,y0,y1}], stairs: {bottom:{x,y}, top:{x,y}} | null
// }

// Stools stand at these spots; a seated guest is drawn SIT_LIFT px higher so they sit ON the stool (feet off the ground).
export const SEAT = [
  { dx: -16, dy: 3, facing: 'right' }, // left of table, looking right
  { dx: 16, dy: 3, facing: 'left' },   // right of table
  { dx: 0, dy: -8, facing: 'down' },   // behind the table, faces the camera
  { dx: 0, dy: 13, facing: 'up' },     // in front, back to the camera
];
export const SIT_LIFT = 3.5;
const table = (x, y, floor = 1) => ({ x, y, floor, seats: SEAT.map((s) => ({ x: x + s.dx, y: y + s.dy, facing: s.facing })) });

const LAYOUTS = {
  // ── Tier 1: gánh xoài trước cổng trường (vỉa hè) ──────────────────
  // Art: scene PNG assets/scenes/vihe.png (see data/scenes.js). Kitchen counters stand in the shop doorway.
  vihe: {
    scene: 'vihe', w: 144, h: 168,
    lane: { y: 141 },
    aisles: [50, 95, 140], serviceY: 84,
    spawn: [{ x: -16, y: 141 }, { x: 160, y: 141 }],
    waitSpots: [{ x: 14, y: 116, facing: 'right' }, { x: 14, y: 132, facing: 'right' }],
    tables: [table(72, 96), table(118, 96), table(72, 126), table(118, 126)],
    canopy: { x0: 26, x1: 143, yTop: 26, yFront: 100, ground: 146 },   // rain tarp pulled out over the tables
    kitchen: {
      stoves: [{ x: 50, y: 62, sortY: 74.5 }, { x: 72, y: 62, sortY: 74.5 }],
      chefSpots: [{ x: 50, y: 60, facing: 'down' }, { x: 72, y: 60, facing: 'down' }],
      pickup: { x: 61, y: 82 },
      ownerHome: { x: 61, y: 60 },
    },
    staffSpots: { waiter: [{ x: 40, y: 88 }, { x: 40, y: 112 }], cashier: null, quankho: null, manager: { x: 96, y: 80 } },
    props: [{ id: 'vihe_counter', x: 61, y: 74 }],
    deco: { den: [{ x: 34, y: 22, w: 78 }], cay: [{ x: 126, y: 72 }], tuong: [{ x: 98, y: 32 }], dacbiet: [{ x: 22, y: 82 }] },
    equip: { cooler: { x: 104, y: 76 }, cooling: { x: 134, y: 98 }, speaker: { x: 14, y: 72 }, pos: null, tarp: { x: 28, y: 20, w: 92 }, kho: { x: 92, y: 74 } },
    sign: { x: 72, y: 24, w: 70, h: 12 },
    street: { y: 160 },
    floors: [{ id: 1, y0: 0, y1: 168 }], stairs: null,
  },

  // ── Tier 2: gánh dưới gốc me trong công viên ──────────────────────
  hem: {
    scene: 'hem', w: 176, h: 204,
    lane: { y: 196 },
    aisles: [64, 112, 162], serviceY: 91,
    spawn: [{ x: -16, y: 196 }, { x: 192, y: 196 }],
    waitSpots: [{ x: 154, y: 156, facing: 'left' }, { x: 154, y: 170, facing: 'left' }, { x: 138, y: 184, facing: 'up' }],
    tables: [table(88, 102), table(136, 102), table(40, 130), table(88, 130), table(136, 130), table(40, 158), table(88, 158)],
    kitchen: {
      stoves: [{ x: 34, y: 72, sortY: 84.5 }, { x: 56, y: 72, sortY: 84.5 }, { x: 78, y: 72, sortY: 84.5 }],
      chefSpots: [{ x: 34, y: 70, facing: 'down' }, { x: 56, y: 70, facing: 'down' }, { x: 78, y: 70, facing: 'down' }],
      pickup: { x: 56, y: 90 },
      ownerHome: { x: 45, y: 70 },
    },
    staffSpots: { waiter: [{ x: 64, y: 91 }, { x: 112, y: 118 }, { x: 64, y: 146 }], cashier: { x: 156, y: 79 }, quankho: null, manager: { x: 112, y: 91 } },
    props: [{ id: 'hem_counter', x: 56, y: 84 }, { id: 'hem_cashier_desk', x: 156, y: 85 }],
    deco: { den: [{ x: 24, y: 27, w: 64 }], cay: [{ x: 10, y: 118 }], tuong: [{ x: 150, y: 50 }], dacbiet: [{ x: 168, y: 118 }] },
    equip: { cooler: { x: 10, y: 92 }, cooling: { x: 166, y: 104 }, speaker: { x: 104, y: 86 }, pos: { x: 155, y: 79 }, tarp: null, kho: { x: 14, y: 142 } },
    sign: { x: 77, y: 30, w: 62, h: 16 },
    street: null,
    floors: [{ id: 1, y0: 0, y1: 204 }], stairs: null,
  },

  // ── Tier 3: dãy xe đẩy ven hồ ─────────────────────────────────────
  mapho: {
    scene: 'mapho', w: 192, h: 236,
    lane: { y: 196 },
    aisles: [53, 99, 145], serviceY: 92,
    spawn: [{ x: -16, y: 196 }, { x: 208, y: 196 }],
    waitSpots: [{ x: 92, y: 192, facing: 'up' }, { x: 106, y: 192, facing: 'up' }, { x: 120, y: 192, facing: 'up' }, { x: 78, y: 192, facing: 'up' }],
    tables: [table(76, 104), table(122, 104), table(168, 104), table(76, 135), table(122, 135), table(168, 135),
      table(30, 135), table(76, 166), table(122, 166), table(30, 104)],
    kitchen: {
      stoves: [{ x: 38, y: 68, sortY: 80.5 }, { x: 60, y: 68, sortY: 80.5 }, { x: 82, y: 68, sortY: 80.5 }, { x: 104, y: 68, sortY: 80.5 }],
      chefSpots: [{ x: 38, y: 66, facing: 'down' }, { x: 60, y: 66, facing: 'down' }, { x: 82, y: 66, facing: 'down' }, { x: 104, y: 66, facing: 'down' }],
      pickup: { x: 71, y: 90 },
      ownerHome: { x: 49, y: 66 },
    },
    staffSpots: { waiter: [{ x: 140, y: 92 }, { x: 53, y: 120 }, { x: 99, y: 152 }, { x: 145, y: 152 }], cashier: { x: 160, y: 79 }, quankho: { x: 18, y: 94 }, manager: { x: 150, y: 184 } },
    props: [{ id: 'mapho_counter', x: 71, y: 80 }, { id: 'mapho_cashier_desk', x: 160, y: 86 }],
    deco: { den: [{ x: 14, y: 31, w: 164 }], cay: [{ x: 184, y: 118 }, { x: 8, y: 158 }], tuong: [{ x: 176, y: 48 }], dacbiet: [{ x: 18, y: 112 }] },
    equip: { cooler: { x: 134, y: 86 }, cooling: { x: 182, y: 150 }, speaker: { x: 186, y: 74 }, pos: { x: 160, y: 80 }, tarp: null, kho: { x: 14, y: 84 } },
    sign: { x: 40, y: 34, w: 112, h: 15 },
    street: { y: 222 },
    floors: [{ id: 1, y0: 0, y1: 236 }], stairs: null,
  },

  // ── Tier 4 (and 5): chợ đêm bờ kè 2 tầng ──────────────────────────
  haitang: {
    scene: 'haitang', w: 192, h: 360,
    lane: { y: 326 },
    aisles: [59, 105, 151], serviceY: 232, serviceY2: 72,
    spawn: [{ x: -16, y: 326 }, { x: 208, y: 326 }],
    waitSpots: [{ x: 80, y: 322, facing: 'up' }, { x: 94, y: 322, facing: 'up' }, { x: 108, y: 322, facing: 'up' }, { x: 122, y: 322, facing: 'up' }, { x: 66, y: 322, facing: 'up' }],
    tables: [
      table(36, 250), table(82, 250), table(128, 250), table(36, 280), table(82, 280), table(128, 280), table(174, 280),
      table(36, 88, 2), table(82, 88, 2), table(128, 88, 2), table(36, 116, 2), table(82, 116, 2), table(128, 116, 2),
      table(105, 304),
    ],
    kitchen: {
      stoves: [{ x: 36, y: 212, sortY: 224.5 }, { x: 58, y: 212, sortY: 224.5 }, { x: 80, y: 212, sortY: 224.5 }, { x: 102, y: 212, sortY: 224.5 }, { x: 124, y: 212, sortY: 224.5 }],
      chefSpots: [{ x: 36, y: 210, facing: 'down' }, { x: 58, y: 210, facing: 'down' }, { x: 80, y: 210, facing: 'down' }, { x: 102, y: 210, facing: 'down' }, { x: 124, y: 210, facing: 'down' }],
      pickup: { x: 80, y: 231 },
      ownerHome: { x: 47, y: 210 },
    },
    staffSpots: {
      waiter: [{ x: 150, y: 234 }, { x: 59, y: 265 }, { x: 105, y: 265 }, { x: 59, y: 102 }, { x: 105, y: 102 }],
      cashier: { x: 152, y: 290 }, quankho: { x: 10, y: 228 }, manager: { x: 140, y: 240 },
    },
    props: [{ id: 'haitang_counter', x: 80, y: 224 }, { id: 'haitang_cashier_desk', x: 152, y: 296 }, { id: 'haitang_balcony', x: 96, y: 148 }],
    deco: {
      den: [{ x: 16, y: 192, w: 140 }, { x: 24, y: 34, w: 140 }],
      cay: [{ x: 10, y: 262 }, { x: 22, y: 130 }],
      tuong: [{ x: 146, y: 186 }, { x: 12, y: 176 }],
      dacbiet: [{ x: 14, y: 244 }],
    },
    equip: { cooler: { x: 146, y: 216 }, cooling: { x: 10, y: 100 }, speaker: { x: 152, y: 128 }, pos: { x: 152, y: 289 }, tarp: null, kho: { x: 14, y: 222 } },
    sign: { x: 28, y: 157, w: 126, h: 13 },
    street: { y: 346 },
    floors: [{ id: 2, y0: 0, y1: 160 }, { id: 1, y0: 160, y1: 360 }],
    stairs: { bottom: { x: 178, y: 258 }, top: { x: 178, y: 70 } },
  },
};

const SCENE_BY_TIER = { 1: 'vihe', 2: 'hem', 3: 'mapho', 4: 'haitang', 5: 'haitang' };

// ───────────── Counter view ("quầy gánh", seen from the vendor's side) ─────────────
// The player stands behind the counter. Customers queue on the pavement at the back and step up to the counter
// one group at a time. World px, core 200×150:
//   ground line (pavement starts) y = 70 · queue feet y 88 → 74 (drawn ×1) · counter top y = 114 ·
//   customers at the counter stand with their feet at y = 134 (drawn ×2, the counter front hides their legs).
// `tables` are the counter spots (ô quầy) and keep the sim's table schema; `waitSpots` are the queue places.
export const COUNTER = { w: 200, h: 150, ground: 70, qY: 88, top: 114, feet: 123, slotW: 48 };
const CSEATS = [[0, 0], [-12, -3], [12, -3], [-5, -6]];   // leader at the counter, friends peeking from behind
const OFF = { x: 100, y: 176 };
// One row on the pavement, 46+ px apart so tables and stools never overlap (footprint ≈ 44 × 35 world px),
// leaving a walkway down the middle (x 92–108) from the queue to the counter. Build order: left, right, inner left, inner right.
export const SIDE_SPOTS = [[24, 95], [176, 95], [70, 95], [130, 95]];
// v2.5.2: a long bar along the railing at the back-left (the queue keeps the back-right), four stools facing the
// view; it is the 5th side "table" (bought last). Ledge from x 10 to 86 at y 73, guests sit with their backs to us.
// v2.6.4: centred on the railing, in the gap between the two inner side tables; 4 modern bar stools
export const BAR = { x: 100, y: 78, ledgeY: 72, x0: 75, x1: 125, seatsX: [82, 94, 106, 118] };   // behind the camera: owner / staff / stoves (not drawn)
function counterLayout(scene, nSlots, nStoves) {
  const C0 = COUNTER;
  const tables = [];
  const slotW = nSlots >= 5 ? 40 : C0.slotW;      // v2.5.2: a 5th spot fits once the counter ends are clear
  for (let i = 0; i < nSlots; i++) {
    const x = Math.round(C0.w / 2 + (i - (nSlots - 1) / 2) * slotW);
    tables.push({ x, y: C0.top, floor: 1, seats: CSEATS.map(([dx, dy]) => ({ x: x + dx, y: C0.feet + dy, facing: 'down' })) });
  }
  const waitSpots = [];
  // v2: the queue stands further back (pavement behind the side tables)
  // the queue starts at the walkway behind the side tables and runs right/back along the shop front
  // v2.6.4: the bar now takes the middle of the railing, so the line forms to its right (5 places), then its left
  for (let i = 0; i < 5; i++) waitSpots.push({ x: 140 + i * 13, y: Math.round(C0.qY - 9 - i * 0.5), facing: 'left' });
  for (let i = 0; i < 3; i++) waitSpots.push({ x: 60 - i * 13, y: Math.round(C0.qY - 9 - i * 0.5), facing: 'right' });
  // side tables on the pavement, either side of the counter (build order: left, right, left, right, back-left, back-right)
  const side = SIDE_SPOTS.map(([x, y], i) => ({ idx: i, x, y, seats: SEAT.map((q) => ({ x: x + q.dx, y: y + q.dy, facing: q.facing })) }));
  side.push({ idx: side.length, x: BAR.x, y: BAR.y, bar: true, seats: BAR.seatsX.map((sx) => ({ x: sx, y: BAR.y + 1, facing: 'up' })) });   // seats sort just in front of the ledge
  const stoves = [], chefSpots = [];
  for (let i = 0; i < Math.max(1, nStoves); i++) { stoves.push({ x: OFF.x, y: OFF.y, sortY: OFF.y }); chefSpots.push({ x: OFF.x, y: OFF.y, facing: 'down' }); }
  return {
    scene, w: C0.w, h: C0.h, counter: { ...C0, slotW },
    lane: { y: 64 }, street: null, aisles: [C0.w / 2], serviceY: C0.qY + 6,
    spawn: [{ x: -22, y: C0.qY - 2 }, { x: C0.w + 22, y: C0.qY - 2 }],
    waitSpots, tables, side,
    queueOff: [[0, 0], [6, -1], [-5, 1], [10, -2]],
    canopy: { x0: -60, x1: C0.w + 60, yTop: -90, yFront: 30, ground: C0.h },   // v2.6.5: the sheet starts above the top of the screen (overhead)
    kitchen: { stoves, chefSpots, pickup: { ...OFF }, ownerHome: { ...OFF } },
    staffSpots: { waiter: [{ ...OFF }, { ...OFF }, { ...OFF }], cashier: { ...OFF }, quankho: { ...OFF }, manager: { ...OFF } },
    props: [], deco: { den: [], cay: [], tuong: [], dacbiet: [] },
    equip: { cooler: { x: 170, y: 112 }, cooling: { x: 30, y: 60 }, speaker: { x: 20, y: 100 }, pos: { x: 160, y: 112 }, tarp: { x: 0, y: 10, w: 200 }, kho: { x: 30, y: 112 } },
    sign: { x: 56, y: 17, w: 88, h: 13 },
    floors: null, stairs: null,
  };
}

// Returns the layout for a tier. `tables`/`stoves` = how many are currently built;
// the returned arrays are sliced to those counts (order = build order).
export function getLayout(tier, { tables = Infinity, stoves = Infinity } = {}) {
  const base = LAYOUTS[SCENE_BY_TIER[tier]];
  return counterLayout(base.scene, Math.min(5, tables === Infinity ? 5 : tables), Math.min(base.kitchen.stoves.length, stoves));
}

/** The old top-down shop layout (kept for reference tools). */
export function getShopLayout(tier, { tables = Infinity, stoves = Infinity } = {}) {
  const base = LAYOUTS[SCENE_BY_TIER[tier]];
  return {
    ...base,
    tables: base.tables.slice(0, tables),
    kitchen: {
      ...base.kitchen,
      stoves: base.kitchen.stoves.slice(0, stoves),
      chefSpots: base.kitchen.chefSpots.slice(0, Math.max(1, Math.min(stoves, base.kitchen.chefSpots.length))),
    },
  };
}

export function sceneForTier(tier) { return SCENE_BY_TIER[tier]; }
export const SCENES = Object.keys(LAYOUTS);
