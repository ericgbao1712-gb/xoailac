// Route building on the scene layouts (TECH_SPEC §6.10). Pure functions, no allocation beyond the returned path.

export function floorOf(L, y) {
  const fl = L.floors;
  if (!fl || fl.length < 2) return 1;
  for (let i = 0; i < fl.length; i++) if (y >= fl[i].y0 && y < fl[i].y1) return fl[i].id;
  return fl[fl.length - 1].id;
}

function serviceYFor(L, floor) { return floor === 2 && L.serviceY2 != null ? L.serviceY2 : L.serviceY; }

// aisle that minimises the total detour A.x → aisle → B.x (ties → closest to B)
function pickAisle(L, ax, bx) {
  let best = L.aisles[0], bc = Infinity;
  for (const x of L.aisles) {
    const c = Math.abs(ax - x) + Math.abs(bx - x) + Math.abs(bx - x) * 0.001;
    if (c < bc) { bc = c; best = x; }
  }
  return best;
}

function push(out, x, y) {
  const n = out.length;
  if (n) {
    const p = out[n - 1];
    if (Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5) return;
    if (n >= 2) { // collapse collinear axis-aligned runs
      const q = out[n - 2];
      if ((Math.abs(q.x - p.x) < 0.5 && Math.abs(p.x - x) < 0.5) || (Math.abs(q.y - p.y) < 0.5 && Math.abs(p.y - y) < 0.5)) { p.x = x; p.y = y; return; }
    }
  }
  out.push({ x, y });
}

function sameFloor(L, a, b, floor, out) {
  const sy = serviceYFor(L, floor);
  const Y = a.y <= sy ? sy : a.y;
  push(out, a.x, a.y);
  if (Math.abs(a.y - Y) > 0.5) push(out, a.x, Y);
  if (Math.abs(Y - b.y) > 1) {
    const ax = pickAisle(L, a.x, b.x);
    push(out, ax, Y);
    push(out, ax, b.y);
  }
  push(out, b.x, b.y);
}

/** Path from a to b as an array of points (first point = a). */
export function route(L, a, b) {
  const out = [];
  if (L.counter) {
    // counter view: straight lines; stepping back from the counter first (toward the pavement), then sideways
    out.push({ x: a.x, y: a.y });
    const back = L.counter.qY + 6;
    if (a.y > back + 4 && b.y < back) out.push({ x: a.x + (b.x - a.x) * 0.15, y: back });
    out.push({ x: b.x, y: b.y });
    return out;
  }
  const fa = floorOf(L, a.y), fb = floorOf(L, b.y);
  if (fa === fb || !L.stairs) { sameFloor(L, a, b, fa, out); return out; }
  const s1 = fa === 1 ? L.stairs.bottom : L.stairs.top;
  const s2 = fa === 1 ? L.stairs.top : L.stairs.bottom;
  sameFloor(L, a, s1, fa, out);
  push(out, s2.x, s2.y);
  const tail = [];
  sameFloor(L, s2, b, fb, tail);
  for (let i = 1; i < tail.length; i++) push(out, tail[i].x, tail[i].y);
  return out;
}

export function pathLength(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return d;
}
