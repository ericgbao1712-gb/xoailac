// Game event -> sound wiring (TECH_SPEC §5.2). Kept separate so it can be tested without any audio.
// `play(name, opts)` is whatever plays sounds (a no-op before the audio unlock).
// The `money` event is intentionally NOT handled: the UI plays purchase sounds itself.

export function wireEvents(game, play, opts) {
  const clock = (opts && opts.now) || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  if (!game || typeof game.on !== 'function') {
    const noop = () => {};
    noop.handlers = {};
    return noop;
  }

  let trayCount = 0;      // ingredients added to the current tray (pitch of `pop` rises with it)
  let lastAdd = -1e9;
  let lastDoor = -1e9;
  let lastAngry = -1e9;

  const handlers = {
    brothStart() { play('sizzle'); },

    ingredientAdded(p) {
      const t = clock();
      if (t - lastAdd > 6000) trayCount = 0; // tray went idle -> start over
      lastAdd = t;
      const n = trayCount++;
      play('pop', { n });
      if (p && p.complete) trayCount = 0;
    },

    brothReady() { play('ting'); },
    served() { play('clink'); },

    collected(p) {
      play('kaching', { amount: (p && +p.amount) || 0, soft: !!(p && p.by === 'staff') });
    },

    customerArrive() {
      const t = clock();
      if (t - lastDoor < 1200) return;
      lastDoor = t;
      play('door');
    },

    levelUp() { play('levelup'); },
    tierUp() { play('tierup'); },

    review(p) {
      const r = p && p.review;
      if (r && r.stars >= 5) play('sparkle');
    },

    customerLeft(p) {
      if (!p || !p.angry) return;
      const t = clock();
      if (t - lastAngry < 500) return; // closing time can dump several at once
      lastAngry = t;
      play('grumble');
    },

    combo(p) { play('combo', { n: (p && p.n) || 2 }); },

    rush(p) { if (p && p.on) play('rush'); },

    mom() { play('mom'); },
  };

  const names = Object.keys(handlers);
  for (let i = 0; i < names.length; i++) game.on(names[i], handlers[names[i]]);

  function unwire() {
    if (typeof game.off !== 'function') return;
    for (let i = 0; i < names.length; i++) game.off(names[i], handlers[names[i]]);
  }
  unwire.handlers = handlers;
  return unwire;
}
