// Shared UI context. mountUI() fills it; every UI module reads from here.
// (Keeps modules decoupled: no circular imports, one place to mock.)
export const ctx = {
  game: null, renderer: null, audio: null,
  el: {},                       // root elements
  reduced: false,
  haptics: true,
  phoneShake: false,
  // registered by modules:
  toast: () => {}, mom: () => {}, banner: () => {},
  openSheet: () => {}, closeSheet: () => {}, sheetOpen: () => false,
  modal: () => {}, confirm: () => {}, closeModals: () => {},
  fx: null, tutorial: null,
  flashMoney: () => {},
  pauseFor: () => {}, resumeFor: () => {}, modalCount: () => 0, modalOpen: () => false,
  modals: {}, busy: () => false,
};

export const G = () => ctx.game;
export const S = () => ctx.game.state;
export const sfx = (name, opts) => { try { ctx.audio?.sfx?.(name, opts); } catch (e) { /* ignore */ } };

/** Run a game action, toast the Vietnamese message on failure. Never throws. */
export function act(name, ...args) {
  const fn = ctx.game?.act?.[name];
  if (typeof fn !== 'function') { ctx.toast('Tính năng này chưa có nha.', 'bad'); return { ok: false, reason: 'missing' }; }
  let r;
  try { r = fn.apply(ctx.game.act, args); } catch (e) { console.error('[ui] act ' + name, e); r = { ok: false, reason: 'error' }; }
  if (r == null) r = { ok: true };
  if (r.ok === false) {
    if (r.msg) ctx.toast(r.msg, 'bad');
    sfx('error');
  }
  return r;
}
