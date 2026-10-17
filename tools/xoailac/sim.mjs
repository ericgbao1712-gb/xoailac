// Headless balance sim for Xoài Lắc Ơi!: a bot plays N days (owner makes every ticket, shake grade "good"),
// buys stock each morning to ~yesterday's usage, buys the cheapest useful upgrade when it can afford it with a
// reserve, hires when unlocked. Prints per-day revenue / costs / profit / money. Usage: node sim.mjs [days] [seed] [skill]
const ROOT = process.env.XL_ROOT || '../../web/xoailac/src';
const { createGame } = await import(ROOT + '/core/game.js');
const C = await import(ROOT + '/config.js');
const DAYS = +process.argv[2] || 20, SEED = +process.argv[3] || 7, SKILL = process.argv[4] || 'good';
const g = createGame(null, { headless: true, seed: SEED, now: 1.8e12 });
g.act.newGame({ shopName: 'Sim' });
g.state.tutorial.done = true;
const S = g.state;
const log = [];
function morningBuy() {
  const want = {};
  for (const p of C.HOTPOTS) if (S.menu[p.id] && S.level >= p.unlockLv) for (const i of p.recipe) want[i] = 1;
  for (const i of C.INGREDIENTS) if (i.side && g.get.isIngUnlocked(i.id)) want[i.id] = 1;   // v2.5 món ăn kèm
  for (const id of Object.keys(want)) {
    const used = S.usageYesterday[id] || (C.INGREDIENTS.find((x) => x.id === id).side ? 3 : 6);
    const target = Math.ceil(used * 1.25) + 2;
    const need = target - (S.inventory[id] || 0);
    if (need > 0) g.act.buyIngredient(id, need);
  }
  if (g.get.supplyInfo) for (const sp of g.get.supplyInfo()) { if (!sp.needed) continue; const need = Math.max(40, sp.target) - sp.have; if (need > 0) g.act.buySupply(sp.id, Math.max(50, need)); }
}
function shop() {
  // hire one phục vụ / thợ lắc when unlocked and affordable (keep 2 days of salary)
  for (const role of ['daubep', 'phucvu']) {
    if (S.staff.some((m) => m.role === role)) continue;
    const c = S.candidates.list.find((x) => x.role === role);
    if (c && S.money > 1500) g.act.hire(role, String(c.cid));
  }
  const ups = ['tarp', 'table', 'cooling', 'sign', 'knife', 'tablestyle', 'speaker', 'cooler', 'stovetype', 'kho'];
  // v2.6.9 thiết bị mới (NEWEQ=0 to compare without them)
  if (process.env.NEWEQ !== '0') ups.push('shaker', 'hygiene', 'icemaker', 'blender', 'pos', 'packing', 'kiosk', 'scale', 'menuscreen', 'filter', 'delivery', 'master');
  for (const id of ups) {
    const inf = g.get.upgradeInfo(id);
    if (inf && inf.cost != null && !inf.lockedReason && S.money - inf.cost > 600) g.act.buyUpgrade(id);
  }
  const ti = g.get.tierInfo ? g.get.tierInfo() : null;
  if (ti && ti.canExpand && S.money > ti.cost * 1.3) g.act.expandTier();
}
for (let d = 0; d < DAYS; d++) {
  morningBuy();
  g.act.openShop();
  let guard = 0;
  while ((S.phase === 'open' || S.phase === 'closing') && guard++ < 200000) {
    const w = g.world;
    if (!w.tray.ticketId) { const t = w.tickets.find((x) => x.status === 'new'); if (t) g.act.selectTicket(t.id); }
    const info = g.get.trayInfo();
    if (info && info.ticket) {
      for (const n of info.need) if (!n.done) g.act.addIngredient(n.ing);
      if (info.drinks && info.drinks.need) g.act.addDrinks();
      if (info.sides && info.sides.need && !info.sides.done) g.act.addSides();
      g.act.serve(SKILL);
    }
    g.update(0.25);
  }
  const r = S.report;
  log.push({ day: r.day, tier: S.tier, lv: S.level, served: r.served, angry: r.angry, lost: r.lost, rev: Math.round(r.revenue + r.tips), cost: Math.round(r.costTotal), profit: Math.round(r.profit), money: Math.round(S.money), rating: S.rating.avg.toFixed(2),
    c: Object.fromEntries(Object.entries(r.costs).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)])) });
  for (const k of ['claimMainQuest']) { for (let i = 0; i < 5; i++) { const x = g.act[k](); if (!x || x.ok === false) break; } }
  g.act.claimDailyAll?.();
  shop();
  g.act.startNextDay();
}
if (process.env.SUMMARY) {
  const tot = (k, a, b) => log.slice(a, b).reduce((x, l) => x + l[k], 0);
  console.log(JSON.stringify({ seed: SEED, profit1_7: tot('profit', 0, 7), profit8_20: tot('profit', 7, 20), served: tot('served', 0, DAYS), lost: tot('lost', 0, DAYS), tierEnd: log[log.length - 1].tier, lvEnd: log[log.length - 1].lv, money: log[log.length - 1].money, dayTier2: (log.find((l) => l.tier >= 2) || {}).day, dayTier3: (log.find((l) => l.tier >= 3) || {}).day }));
} else for (const l of log) console.log(JSON.stringify(l));
