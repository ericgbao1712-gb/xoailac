// Small pure helpers shared by the core modules. DOM-free.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const round2 = (v) => Math.round(v * 100) / 100;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
export const isPlain = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

/**
 * Fill every key that exists in `def` but is missing in `src` (deep). Keys that only exist in
 * `src` are kept (maps keyed by ids may grow). Values whose primitive type changed fall back to `def`.
 * Used to migrate old saves when new fields are added.
 */
export function mergeDefaults(def, src) {
  if (def === null) return src === undefined ? null : src;
  if (src === undefined || src === null) return clone(def);
  if (isPlain(def)) {
    if (!isPlain(src)) return clone(def);
    const out = {};
    for (const k of Object.keys(def)) out[k] = mergeDefaults(def[k], src[k]);
    for (const k of Object.keys(src)) if (!(k in def)) out[k] = src[k];
    return out;
  }
  if (Array.isArray(def)) return Array.isArray(src) ? src : clone(def);
  return typeof def === typeof src ? src : def;
}

// 'YYYY-MM-DD' in local time
export function dateKey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function prevDateKey(ms) { return dateKey(ms - 86400000); }
