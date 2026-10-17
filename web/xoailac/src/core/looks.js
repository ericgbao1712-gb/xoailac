// v2.3 cosmetic choices (tem logo Lv 24, đồng phục Lv 21, mặt tiền Lv 31). Pure: no DOM.
// Every value read from a save goes through these sanitizers, so a hand-edited or older save can never break drawing.
import * as C from '../config.js';

const pick = (v, list, def) => (list.some((x) => x.id === v) ? v : def);
const cleanText = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export function sanitizeBrand(b) {
  const D = C.BRAND.def, B = C.BRAND;
  b = b && typeof b === 'object' ? b : {};
  return {
    on: b.on !== false,
    frame: pick(b.frame, B.frames, D.frame),
    text: pick(b.text, B.texts, D.text),
    color: pick(b.color, B.colors, D.color),
    mascot: B.mascots.includes(b.mascot) ? b.mascot : D.mascot,
    slogan: cleanText(b.slogan, B.sloganMax),
  };
}
export function sanitizeUniform(u) {
  const D = C.UNIFORM.def;
  u = u && typeof u === 'object' ? u : {};
  return { color: pick(u.color, C.UNIFORM.colors, D.color), style: pick(u.style, C.UNIFORM.styles, D.style) };
}
export function sanitizeFacade(f) {
  f = f && typeof f === 'object' ? f : {};
  const out = {};
  for (const cat of C.FACADE.cats) out[cat.id] = pick(f[cat.id], C.FACADE.items[cat.id], C.FACADE.def[cat.id]);
  return out;
}
/** Facade item definition (or null). */
export const facadeItem = (cat, id) => ((C.FACADE.items[cat] || []).find((x) => x.id === id) || null);
/** First level at which any facade item opens. */
export const FACADE_FIRST_LV = Math.min(...Object.values(C.FACADE.items).flat().filter((x) => x.amb > 0).map((x) => x.lv));
/** The facade as shown: items above the player's level fall back to the default of their slot. */
export function shownFacade(s) {
  const lv = s.level || 1, f = s.facade || C.FACADE.def, out = {};
  for (const cat of C.FACADE.cats) {
    const it = facadeItem(cat.id, f[cat.id]);
    out[cat.id] = it && it.lv <= lv ? it.id : C.FACADE.def[cat.id];
  }
  return out;
}
/** Ambience points from the facade (added to the deco points in economy.ambienceOf). */
export function facadeAmb(s) {
  const f = shownFacade(s);
  let a = 0;
  for (const cat of C.FACADE.cats) a += (facadeItem(cat.id, f[cat.id]) || {}).amb || 0;
  return a;
}

/** What the renderer should show right now (null = feature not unlocked yet → original look). */
export function activeLooks(s) {
  const lv = s.level || 1;
  return {
    brand: lv >= C.BRAND.lv && s.brand && s.brand.on !== false ? s.brand : null,
    uniform: lv >= C.UNIFORM.lv ? s.uniform : null,
    facade: lv >= FACADE_FIRST_LV ? shownFacade(s) : null,
  };
}
