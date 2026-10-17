// Ambient life that is not part of the simulation: passers-by on the pavement and traffic on the street.
// Pure presentation — uses its own tiny RNG so the sim stays deterministic.
import { makeLook } from '../art/characters.js';

const VEHICLES = [['xemay', 5], ['xemay2', 3], ['xedap', 1.4], ['grab', 1.6], ['xebanhmi', 1], ['taxi', 0.6]];
const VEH_TOTAL = VEHICLES.reduce((a, v) => a + v[1], 0);

export function createAmbient() {
  let s = 0x2545f491;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const peds = [], vehs = [];
  let pedT = 2, vehT = 1;
  const amb = { peds, vehs };

  amb.reset = () => { peds.length = 0; vehs.length = 0; pedT = 1.5; vehT = 0.8; };

  function pickVehicle() {
    let r = rnd() * VEH_TOTAL;
    for (const v of VEHICLES) { r -= v[1]; if (r <= 0) return v[0]; }
    return 'xemay';
  }

  /**
   * @param dt real seconds
   * @param c  { x0, x1, layout, clock, weather, open }  (x0/x1 = visible world span)
   */
  amb.update = (dt, c) => {
    const L = c.layout;
    if (!L) return;
    const night = c.clock >= 18.5 * 60 || c.clock < 7 * 60;
    const wet = c.weather === 'rain' ? 2.2 : c.weather === 'storm' ? 4 : 1;
    const hot = c.weather === 'hot' ? 1.4 : 1;
    // pedestrians
    pedT -= dt;
    if (pedT <= 0) {
      pedT = (night ? 9 : 5.5) * wet * hot * (0.6 + rnd() * 0.8);
      if (peds.length < (night ? 3 : 5)) {
        const dir = rnd() < 0.5 ? 1 : -1;
        const baseY = L.lane ? L.lane.y + (L.street ? 7 : 6) : L.h - 6;
        peds.push({
          x: dir > 0 ? c.x0 - 14 : c.x1 + 14, y: baseY + Math.floor(rnd() * 4), dir, speed: 11 + rnd() * 9,
          look: makeLook('pedestrian', 1 + Math.floor(rnd() * 99999), 0), t: rnd() * 5,
        });
      }
    }
    for (let i = peds.length - 1; i >= 0; i--) {
      const p = peds[i];
      p.x += p.dir * p.speed * dt; p.t += dt;
      if ((p.dir > 0 && p.x > c.x1 + 20) || (p.dir < 0 && p.x < c.x0 - 20)) peds.splice(i, 1);
    }
    // traffic
    if (L.street) {
      vehT -= dt;
      if (vehT <= 0) {
        vehT = (night ? 7 : 4.5) * (c.weather === 'storm' ? 3 : 1) * (0.5 + rnd());
        if (vehs.length < 3) {
          const dir = rnd() < 0.5 ? 1 : -1;
          vehs.push({
            kind: pickVehicle(), dir, x: dir > 0 ? c.x0 - 30 : c.x1 + 30, y: L.street.y + (dir > 0 ? 4 : -3), speed: 42 + rnd() * 36, t: rnd() * 3,
          });
        }
      }
      for (let i = vehs.length - 1; i >= 0; i--) {
        const v = vehs[i];
        v.x += v.dir * v.speed * dt; v.t += dt;
        if ((v.dir > 0 && v.x > c.x1 + 40) || (v.dir < 0 && v.x < c.x0 - 40)) vehs.splice(i, 1);
      }
    } else if (vehs.length) vehs.length = 0;
  };

  return amb;
}
