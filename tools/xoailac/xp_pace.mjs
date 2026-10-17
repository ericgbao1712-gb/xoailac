// Usage: node xp_pace.mjs [days] [seed] → which day the bot reaches Lv 5/10/…/40 and where its XP came from.
// XP by source + level curve over N days, a bot that also claims every quest the way a player would.
const ROOT = process.env.XL_ROOT || '/home/claude/src/meegame-main/web/xoailac/src';
const { createGame } = await import(ROOT + '/core/game.js');
const C = await import(ROOT + '/config.js');
const DAYS = +process.argv[2] || 60, SEED = +process.argv[3] || 1;
const g = createGame(null, { headless: true, seed: SEED, now: 1.8e12 });
g.act.newGame({ shopName: 'Sim' }); g.state.tutorial.done = true;
const S = g.state;
let src = 'serve'; const xp = {}; g.on('xp', (p) => { xp[src] = (xp[src] || 0) + (p.delta || 0); });
function morningBuy() {
  const want = {};
  for (const p of C.HOTPOTS) if (S.menu[p.id] && S.level >= p.unlockLv) for (const i of p.recipe) want[i] = 1;
  for (const i of C.INGREDIENTS) if (i.side && g.get.isIngUnlocked(i.id)) want[i.id] = 1;
  for (const id of Object.keys(want)) { const used = S.usageYesterday[id] || (C.INGREDIENTS.find((x) => x.id === id).side ? 3 : 6); const need = Math.ceil(used * 1.25) + 2 - (S.inventory[id] || 0); if (need > 0) g.act.buyIngredient(id, need); }
  if (g.get.supplyInfo) for (const sp of g.get.supplyInfo()) { if (!sp.needed) continue; const need = Math.max(40, sp.target) - sp.have; if (need > 0) g.act.buySupply(sp.id, Math.max(50, need)); }
}
const UPS = ['tarp', 'table', 'cooling', 'sign', 'knife', 'tablestyle', 'speaker', 'cooler', 'stovetype', 'kho', 'shaker', 'hygiene', 'icemaker', 'blender', 'pos', 'packing', 'kiosk', 'scale', 'menuscreen', 'filter', 'delivery', 'master'];
function shop() {
  for (const role of ['phucvu', 'daubep', 'thungan', 'quankho']) { if (S.staff.some((m) => m.role === role)) continue; const c = S.candidates.list.find((x) => x.role === role); if (c && S.money > 1500) g.act.hire(role, String(c.cid)); }
  for (const id of UPS) { const inf = g.get.upgradeInfo(id); if (inf && inf.cost != null && !inf.lockedReason && S.money - inf.cost > 600) g.act.buyUpgrade(id); }
  const ti = g.get.tierInfo(); if (ti && ti.canExpand && S.money > ti.cost * 1.3) g.act.expandTier();
}
const lv = []; var mainN = 0;
for (let d = 0; d < DAYS; d++) {
  morningBuy(); g.act.openShop(); let guard = 0;
  while ((S.phase === 'open' || S.phase === 'closing') && guard++ < 200000) {
    const w = g.world;
    if (!w.tray.ticketId) { const t = w.tickets.find((x) => x.status === 'new'); if (t) g.act.selectTicket(t.id); }
    const info = g.get.trayInfo();
    if (info && info.ticket) { for (const n of info.need) if (!n.done) g.act.addIngredient(n.ing); if (info.drinks && info.drinks.need) g.act.addDrinks(); if (info.sides && info.sides.need && !info.sides.done) g.act.addSides(); g.act.serve('good'); }
    src = 'serve'; g.update(0.25);
  }
  src = 'main'; for (let i = 0; i < 5; i++) { const x = g.act.claimMainQuest(); if (!x || x.ok === false) { break; } mainN=(mainN||0)+1; }
  src = 'v2'; for (let i = 0; i < 5; i++) { const x = g.act.claimV2Quest?.(); if (!x || x.ok === false) break; }
  src = 'daily'; const L = g.get.dailyTasks() || []; L.forEach((t, i) => { if (t.done && !t.claimed) g.act.claimDaily(i); }); g.act.claimDailyAll?.();
  src = 'other'; shop(); g.act.startNextDay();
  lv.push(S.level);
}
const tot = Object.values(xp).reduce((a, b) => a + b, 0);
const pct = Object.fromEntries(Object.entries(xp).map(([k, v]) => [k, Math.round(v / tot * 100) + '%']));
const firstDay = (L) => lv.findIndex((x) => x >= L) + 1 || '-';
console.log(JSON.stringify({ mainN, seed: SEED, lvEnd: S.level, tier: S.tier, share: pct, dayLv: { 5: firstDay(5), 10: firstDay(10), 15: firstDay(15), 20: firstDay(20), 25: firstDay(25), 30: firstDay(30), 35: firstDay(35), 40: firstDay(40) } }));
