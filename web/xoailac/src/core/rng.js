// Seeded RNG (mulberry32) with convenience helpers. Deterministic given the seed.

export function createRng(seed = 1) {
  let a = (seed >>> 0) || 0x9e3779b9;
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rng = {
    next,
    /** uniform float in [lo, hi) */
    range: (lo, hi) => lo + next() * (hi - lo),
    /** uniform int in [lo, hi] inclusive */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** exponential(1) */
    exp: () => -Math.log(1 - next()),
    /** standard normal (Box–Muller) */
    gauss: () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    },
    /** pick one item; weightOf(item, index) → number ≥ 0. Returns undefined when all weights are 0. */
    weighted(items, weightOf) {
      let total = 0;
      for (let i = 0; i < items.length; i++) total += Math.max(0, weightOf(items[i], i));
      if (total <= 0) return undefined;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= Math.max(0, weightOf(items[i], i));
        if (r < 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
  return rng;
}
