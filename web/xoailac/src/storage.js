// Save storage (TECH_SPEC §8). Async API so the lead can swap in a cloud adapter with the same signatures.
// Every access is wrapped: private windows / blocked storage just behave as "no save".
const KEY = 'xoai-lac/save/v1';
const BACKUP_V1 = 'xoai-lac/save/v1.truoc-nang-cap-v2';   // raw copy of a v1 save, written once, never read by the game

function store() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}

/** Resolves to the saved object, or null when there is none / storage is unavailable / data is corrupt. */
export async function loadSave() {
  try {
    const ls = store();
    if (!ls) return null;
    const raw = ls.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!(obj && typeof obj === 'object' && !Array.isArray(obj))) return null;
    // before the first load by v2 (prices, supplies, wage debt…) keep an untouched copy of the old save
    try { if (!(Number(obj.v) >= 2) && !ls.getItem(BACKUP_V1)) ls.setItem(BACKUP_V1, raw); } catch (e) { /* storage full: the game still loads */ }
    return obj;
  } catch (e) {
    return null;
  }
}

/** Persist `obj`. The write itself happens synchronously (safe to call from pagehide). Resolves true on success. */
export async function writeSave(obj) {
  try {
    const ls = store();
    if (!ls) return false;
    ls.setItem(KEY, JSON.stringify(obj));
    return true;
  } catch (e) {
    return false;
  }
}

/** v2.6.23: which open copy of the game may write the save (see main.js). */
export const OWNER_KEY = 'xoai-lac/save/owner';

/** Delete the save. Resolves true when nothing is left behind. */
export async function clearSave() {
  try {
    const ls = store();
    if (!ls) return false;
    ls.removeItem(KEY);
    return true;
  } catch (e) {
    return false;
  }
}
