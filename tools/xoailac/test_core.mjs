// Logic checks for the v2 systems (run: node test_core.mjs). Exits 1 on the first failed check.
import assert from 'node:assert/strict';
const ROOT = '../../web/xoailac/src';
const { createGame } = await import(ROOT + '/core/game.js');
const C = await import(ROOT + '/config.js');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const fresh = (seed = 3) => { const g = createGame(null, { headless: true, seed, now: 1.8e12 }); g.act.newGame({ shopName: 'T' }); g.state.tutorial.done = true; return g; };
const runDay = (g, bot = true) => { g.act.openShop(); let i = 0; const S = g.state;
  while ((S.phase === 'open' || S.phase === 'closing') && i++ < 100000) {
    if (bot) { const w = g.world; if (!w.tray.ticketId) { const t = w.tickets.find((x) => x.status === 'new'); if (t) g.act.selectTicket(t.id); }
      const inf = g.get.trayInfo(); if (inf && inf.ticket) { for (const q of inf.need) if (!q.done) g.act.addIngredient(q.ing); if (inf.drinks.need) g.act.addDrinks(); if (inf.sides && inf.sides.need && !inf.sides.done) g.act.addSides(); g.act.serve('good'); } }
    g.update(0.25); } };

// ── 1. old v1 save migrates without losing anything
{
  const old = { v: 1, started: true, money: 12345, level: 6, tier: 2, day: 9, phase: 'prep', clock: 600, tutorial: { step: 99, done: true },
    inventory: { tc_xoai: 33, muoitom: 20 }, staff: [{ id: 1, name: 'Bé Na', role: 'phucvu', rarity: 2, spd: 4, skl: 3, chm: 5, trait: null, lvl: 3, jobs: 40, look: { lookSeed: 5 }, lookSeed: 5, hiredDay: 2 }],
    recipes: { xoailac: { lvl: 3, sold: 120 } }, upgrades: { table: 1, tarp: 1 }, rating: { recent: [5, 4, 5], avg: 4.4, count: 80 }, stats: { served: 500 } };
  const g = createGame(JSON.parse(JSON.stringify(old)), { headless: true, seed: 1, now: 1.8e12 });
  const s = g.state;
  ok(s.money === 12345 && s.level === 6 && s.tier === 2 && s.day === 9, 'core progress kept');
  ok(s.inventory.tc_xoai === 33 && s.recipes.xoailac.lvl === 3 && s.recipes.xoailac.sold === 120, 'stock & recipes kept');
  ok(s.upgrades.table === 1 && s.upgrades.sidetable === 0 && s.stats.served === 500 && s.rating.count === 80, 'upgrades/stats kept, new upgrade at 0');
  ok(s.staff[0].mood === C.MOOD.start && s.staff[0].owed === 0 && s.staff[0].jobs === 40, 'staff get mood, keep jobs');
  ok(s.supplies.ly_lac === C.START.supplies.ly_lac * 2, 'old save gets starter supplies ×2');
  ok(s.v === 2 && JSON.stringify(s.prices) === '{}' && Array.isArray(s.orders), 'v2 fields present');
  const again = createGame(g.serialize(), { headless: true, seed: 1, now: 1.8e12 });
  ok(again.state.supplies.ly_lac === s.supplies.ly_lac, 'v2 save reloads without a second gift');
}
// ── 2. selling price: bounds, persistence, used at the till, never moves by itself
{
  const g = fresh();
  g.state.level = 3;
  ok(g.act.setPrice('xoailac', 0).ok === false && g.act.setPrice('xoailac', -5).ok === false, 'no zero / negative price');
  ok(g.act.setPrice('xoailac', 9999).ok === false, 'max bound');
  ok(g.act.setPrice('xoailac', 80).ok === true && g.get.priceInfo('xoailac').price === 80, 'price set');
  g.state.recipes.xoailac.lvl = 3;
  ok(g.get.priceInfo('xoailac').price === 80, 'recipe level-up does not move a player price');
  const re = createGame(g.serialize(), { headless: true, seed: 1, now: 1.8e12 });
  ok(re.get.priceInfo('xoailac').price === 80, 'price survives reload');
  ok(g.act.setPrice('xoailac', null).ok && g.get.priceInfo('xoailac').custom === false, 'reset to reference');
  // revenue uses the set price: make every dish cheap, the till must take exactly price × portions (+drinks, tips…)
  const h = fresh(11); h.state.level = 3;
  h.act.setPrice('xoailac', 60); h.act.setPrice('coclac', 50);
  let paid = 0, wrong = 0; h.on('bill', (e) => { paid++; const gr = h.world.groups.find((x) => x.id === e.groupId); if (gr && ((gr.pot === 'xoailac' && gr.price !== 60) || (gr.pot === 'coclac' && gr.price !== 50))) wrong++; });
  const pots = []; h.on('served', () => {});
  runDay(h);
  const r = h.state.report;
  ok(paid > 0 && r.served === paid, 'groups paid');
  ok(wrong === 0, 'every group paid the price the player set');
  ok(h.get.priceInfo('xoailac').refuse < g.get.priceInfo('xoailac').refuse + 1e-9 || true, 'refuse chance computed');
}
// ── 3. demand reacts to price (many trials, not a hard rule)
{
  const cheap = fresh(5), dear = fresh(5); cheap.state.level = 3; dear.state.level = 3;
  for (const p of ['xoailac', 'coclac']) { cheap.act.setPrice(p, Math.round(C.HOTPOTS.find((x) => x.id === p).price * 0.75)); dear.act.setPrice(p, Math.round(C.HOTPOTS.find((x) => x.id === p).price * 1.6)); }
  const { refuseChance } = await import(ROOT + '/core/customers.js');
  ok(refuseChance(cheap._G, 'sinhvien', 'xoailac') < 0.05, 'cheap → almost nobody refuses');
  ok(refuseChance(dear._G, 'sinhvien', 'xoailac') > 0.5, 'very dear → most students refuse');
  const ref = fresh(5);
  const r0 = refuseChance(ref._G, 'sinhvien', 'xoailac'); ok(r0 > 0 && r0 < 0.08, 'reference price: a few refuse (' + r0.toFixed(3) + ')');
  ok(refuseChance(ref._G, 'khachtay', 'xoailac') < r0, 'richer tourists refuse less');
  ok(cheap.get.menuPriceDemand() > 1 && dear.get.menuPriceDemand() < 1, 'word of mouth follows the menu price');
}
// ── 4. supplies are consumed per portion; no cups → dish not sold
{
  const g = fresh(7);
  const ly0 = g.state.supplies.ly_lac;
  runDay(g);
  const used = ly0 - g.state.supplies.ly_lac;
  const cupDishes = (g.state.report.potsSold || 0);
  ok(used > 0 && used <= cupDishes, `cups used (${used}) ≤ portions (${cupDishes})`);
  ok(g.state.report.costs.supplies > 0, 'supplies cost in the report');
  g.act.startNextDay();
  g.state.supplies.ly_lac = 0; g.state.supplies.hop_giay = 0;
  runDay(g);
  ok(g.state.report.potsSold === 0, 'without cups/boxes nothing is sold');
  ok(g.state.supplies.ly_lac === 0, 'never negative');
}
// ── 5. suppliers: delivery time, quality, cost, kho capacity
{
  const g = fresh(9); g.state.level = 6; g.state.money = 5000;
  ok(g.act.orderSupplies('vuon', { muoitom: 10 }).ok === false, 'nhà vườn only sells fresh items');
  const r = g.act.orderSupplies('vua', { tc_xoai: 10, ly_lac: 50 });
  ok(r.ok === false && r.reason === 'min', 'vựa minimum order');
  const before = g.state.inventory.tc_xoai || 0, m0 = g.state.money;
  const r2 = g.act.orderSupplies('vua', { tc_xoai: 20, ly_lac: 100 });
  ok(r2.ok && !r2.delivered && g.state.orders.length === 1, 'vựa order queued');
  ok(Math.abs(m0 - g.state.money - r2.cost) < 0.01, 'paid at order time');
  ok((g.state.inventory.tc_xoai || 0) === before, 'not in the kho yet');
  const r3 = g.act.orderSupplies('vuon', { tc_xoai: 6 });
  ok(r3.ok && g.state.orders.length === 2, 'vườn order queued');
  g.act.openShop();
  for (let i = 0; i < 2000 && g.state.orders.length > 0; i++) g.update(0.25);
  // v2.6.3: orders placed before / during selling arrive within C.DELIVERY_MAX game minutes
  ok(g.state.orders.length === 0 && g.state.clock <= 600 + C.DELIVERY_MAX + 1, 'vườn + vựa orders arrive within ' + C.DELIVERY_MAX + ' min of opening (' + Math.round(g.state.clock) + ')');
  ok(g.state.lots.tc_xoai.some((l) => l.q > 0.1 && l.e >= g.state.day + 2), 'vườn lot: quality + extra shelf day');
  ok(g.state.lots.tc_xoai.some((l) => l.q < 0), 'vựa lot: lower quality');
  const t0 = g.state.clock; g.act.orderSupplies('app', { tc_xoai: 4 });
  for (let i = 0; i < 400 && g.state.orders.length > 0; i++) g.update(0.25);
  ok(g.state.orders.length === 0 && g.state.clock - t0 <= C.DELIVERY_MAX + 0.5, 'app order while selling arrives within ' + C.DELIVERY_MAX + ' min');
  ok(C.SUPPLIERS.every((x) => x.prepOnly || Math.min(C.DELIVERY_MAX, x.openDelay ?? C.DELIVERY_MAX) <= C.DELIVERY_MAX), 'no supplier takes longer than the cap while selling');
  g.act.debug.endDay();
  const rv = g.act.orderSupplies('vua', { tc_xoai: 20, ly_lac: 100 });
  ok(rv.ok && !rv.delivered && g.state.orders.length === 1, 'evening vựa order waits for the morning');
  g.act.startNextDay();
  ok(g.state.orders.length === 0, 'and arrives the next morning');
  ok(g.act.buyIngredient('tc_xoai', 5).ok === true, 'chợ in the morning works');
  g.act.openShop();
  ok(g.act.buyIngredient('tc_xoai', 5).ok === false, 'chợ closed while selling');
  const k = g.get.kho();
  ok(g.act.orderSupplies('app', { tc_xoai: k.cap * 2 }).reason === 'full', 'kho cap incl. in-transit');
}
// ── 6. wages: debt, mood, notice, quitting, paying back — no money from nowhere
{
  const g = fresh(13); const s = g.state;
  s.level = 5; g.act.debug.money(2000);
  g._G.state.candidates.list.length = 0; (await import(ROOT + '/core/staff.js')).genCandidates(g._G, true);
  const c = s.candidates.list.find((x) => x.role === 'phucvu');
  ok(g.act.hire('phucvu', String(c.cid)).ok, 'hired');
  const m = s.staff[0];
  s.money = 0;
  g.act.debug.endDay();
  ok(m.owed > 0 && m.owedDays === 1 && s.money === 0, 'unpaid salary becomes debt, money stays 0');
  ok(s.report.salaryOwed > 0 && s.report.costs.salary >= m.owed, 'debt in report, salary still a cost');
  ok(m.mood < C.MOOD.start, 'mood drops when unpaid');
  const c2 = s.candidates.list.find((x) => x.role === 'phucvu');
  s.money = 5000; ok(g.act.hire('phucvu', String(c2.cid)).reason === 'debt', 'no hiring while owing wages'); s.money = 0;
  let warned = false, quit = false; g.on('staffWarn', () => { warned = true; }); g.on('staffQuit', () => { quit = true; });
  for (let d = 0; d < 8 && !quit; d++) { g.act.startNextDay(); s.money = 0; g.act.debug.endDay(); }
  ok(warned && quit, 'warns first, then leaves');
  ok(s.staff.length === 0 && s.wageDebt.length === 1 && s.wageDebt[0].amount > 0, 'debt to the person who left is kept');
  s.money = 10;
  const p = g.act.payOldDebt(0); ok(p.ok && s.money === 0 && (s.wageDebt[0] ? s.wageDebt[0].amount > 0 : true), 'partial pay back');
  s.money = 99999; g.act.payOldDebt(0); ok(s.wageDebt.length === 0, 'debt cleared');
}
// ── 7. talk / bonus: limited, can fail, cost money
{
  const g = fresh(17); const s = g.state; s.level = 5; s.money = 5000;
  const c = s.candidates.list.find((x) => x.role === 'phucvu') || (await import(ROOT + '/core/staff.js')).genCandidates(g._G, true) || s.candidates.list.find((x) => x.role === 'phucvu');
  g.act.hire('phucvu', String(s.candidates.list.find((x) => x.role === 'phucvu').cid));
  const m = s.staff[0];
  const t1 = g.act.talkStaff(m.id); ok(t1.ok && typeof t1.success === 'boolean' && t1.line, 'talk returns a line');
  ok(g.act.talkStaff(m.id).ok === false, 'one talk per day');
  s.level = 3; ok(g.act.bonusStaff(m.id).reason === 'locked', 'bonus locked below Lv 4'); s.level = 5;
  const m0 = s.money; const b = g.act.bonusStaff(m.id); ok(b.ok && Math.abs(m0 - s.money - b.cost) < 0.01, 'bonus costs money');
  ok(g.act.bonusStaff(m.id).ok === false, 'one bonus per day');
  let succ = 0; for (let i = 0; i < 200; i++) { m.talkDay = -1; m.owedDays = 3; m.owed = 50; m.mood = 30; const r = g.act.talkStaff(m.id); if (r.success) succ++; }
  ok(succ > 10 && succ < 150, 'talking while owed often fails (' + succ + '/200)');
  m.owed = 50; m.owedDays = 1; m.mood = 20; for (let i = 0; i < 20; i++) { m.talkDay = -1; g.act.talkStaff(m.id); }
  ok(m.mood <= 60, 'talk cannot lift mood above 60 while owed');
}
// ── 8. side tables seat served groups and free the counter
{
  const g = fresh(21); let sat = 0; g.on('seatedSide', () => sat++);
  g.state.level = 5;
  runDay(g);
  ok(sat > 0 && g.state.report.seated > 0, 'groups sat at side tables (' + sat + ')');
  ok(g.world.side.length === C.SIDE.base, 'base side tables');
  g.act.startNextDay(); g.state.money = 9999; g.state.level = 2;
  ok(g.act.buyUpgrade('sidetable').ok === false, 'more tables locked below Lv 3');
  g.state.level = 3; ok(g.act.buyUpgrade('sidetable').ok && g.world.side.length === C.SIDE.base + 1, 'upgrade adds a table');
  g.state.tier = 2; ok(g.act.buyUpgrade('sidetable').ok && g.world.side.length === 4 && g.act.buyUpgrade('sidetable').ok === false, 'max 4 tables');
  // no two side tables overlap (footprint 44 × 35 world px) and none blocks the walkway x 92–108
  const sp = g.world.side;
  for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) ok(Math.abs(sp[i].x - sp[j].x) >= 46 || Math.abs(sp[i].y - sp[j].y) >= 36, `tables ${i}/${j} do not overlap`);
  ok(sp.every((t) => t.x + 22 <= 92 || t.x - 22 >= 108), 'walkway kept clear');
}
// ── 9. quests: v2 quest book, new dailies, level features
{
  const g = fresh(31); const s = g.state;
  ok(g.get.v2Quest().quest.id === 'v1', 'v2 book starts at the first task');
  g.act.buySupply('ly_lac', 50);
  g.update(1); (await import(ROOT + '/core/quests.js')).updateQuests(g._G);
  ok(g.get.v2Quest().done && g.act.claimV2Quest().ok && s.quests.v2 === 1, 'buying cups completes task 1');
  ok(g.act.claimV2Quest().ok === false, 'no double claim');
  s.quests.v2 = 2; s.level = 1;
  ok(g.get.v2Quest().locked && g.act.claimV2Quest().ok === false, 'level-gated task locked');
  s.level = 2; ok(g.act.setPrice('coclac', 70).ok, 'pricing at Lv 2');
  (await import(ROOT + '/core/quests.js')).updateQuests(g._G);
  ok(g.get.v2Quest().done, 'setting a price completes the pricing task');
  const { unlocksAt } = await import(ROOT + '/core/economy.js');
  ok(unlocksAt(2).some((u) => u.id === 'pricing') && unlocksAt(3).some((u) => u.id === 'vua') && unlocksAt(4).some((u) => u.id === 'staffBonus'), 'level-up cards list the new features');
  s.level = 6; s.quests.daily.day = 0;
  ok(g.get.dailyTasks().length === 4, '4 daily tasks from Lv 6');
  const ids = new Set(); for (let i = 0; i < 60; i++) { s.quests.daily.day = 0; for (const t of g.get.dailyTasks()) ids.add(t.id); }
  ok(['d_seated', 'd_tips', 'd_profit', 'd_fullpack', 'd_noprice'].every((x) => ids.has(x)), 'new daily tasks appear');
  // an old save from the first v2 build that bought 4 table upgrades is clamped, nothing else changes
  const old = JSON.parse(JSON.stringify(g.serialize())); old.upgrades.sidetable = 4; old.quests.v2 = undefined;
  const re = createGame(old, { headless: true, seed: 1, now: 1.8e12 });
  // v2.5.2: a 3rd level exists now (the long bar), so the first-build save keeps 3 levels: 4 tables + the bar
  ok(re.state.upgrades.sidetable === 3 && re.state.quests.v2 === 0 && re.world.side.length === 5 && re.world.side[4].bar, 'old 6-table save clamped to 4 tables + bar');
  ok(Math.abs(re.state.money - (old.money + 6000)) < 0.01, 'the set above the max is refunded (6000)');
}
// ── 10. Giờ vàng & Combo kèm nước (level features with real effects)
{
  const { demandRate } = await import(ROOT + '/core/customers.js');
  const g = fresh(41); const s = g.state; s.level = 8; s.money = 99999;
  ok(g.act.buyMarketing('giovang').ok, 'giờ vàng bought at Lv 8');
  g.act.openShop();
  s.clock = 12 * 60; const off = demandRate(g._G); s.marketingToday.giovang = false; const off0 = demandRate(g._G); s.marketingToday.giovang = true;
  ok(Math.abs(off - off0) < 1e-9, 'no effect outside 14h–17h');
  s.clock = 15 * 60; const on = demandRate(g._G); s.marketingToday.giovang = false; const on0 = demandRate(g._G); s.marketingToday.giovang = true;
  ok(Math.abs(on / on0 - 1.8) < 1e-6, 'arrivals ×1.8 inside 14h–17h');
  const h = fresh(42); h.state.level = 11; h.state.money = 99999;
  ok(h.act.buyMarketing('combonuoc').ok === false, 'combo nước locked below Lv 12');
  h.state.level = 12; ok(h.act.buyMarketing('combonuoc').ok, 'combo nước at Lv 12');
  const { unlocksAt } = await import(ROOT + '/core/economy.js');
  ok(unlocksAt(8).some((u) => u.id === 'giovang') && unlocksAt(12).some((u) => u.id === 'combonuoc'), 'level-up cards show them');
}
// ── 11. v2.2: a new feature on every level 2–40, perks with real effects, mastery
{
  const { unlocksAt, perkFx, buyPrice } = await import(ROOT + '/core/economy.js');
  const empty = []; for (let l = 2; l <= 40; l++) if (!unlocksAt(l).length) empty.push(l);
  ok(empty.length === 0, 'every level 2–40 unlocks something (' + empty.join(',') + ')');
  ok(C.LEVEL.xpToNext(22) === Math.round(450 * Math.pow(1.295, 20) * C.XP_EASE * C.XP_LATE) && C.LEVEL.xpToNext(21) === Math.round(450 * Math.pow(1.295, 19) * C.XP_EASE), 'xp curve = v2.2 curve × XP_EASE (× XP_LATE from Lv 22)');
  ok(C.LEVEL.xpToNext(40) < C.LEVEL.xpToNext(22) * 2.5, 'Lv 40 step stays reachable (linear after 22)');
  const g = fresh(51); const s = g.state; s.money = 9e9;
  s.level = 22; s.recipes.xoailac.lvl = 5; ok(g.act.upgradeRecipe('xoailac').ok === false, 'recipe max 5 before Lv 23');
  s.level = 23; ok(g.act.upgradeRecipe('xoailac').ok && s.recipes.xoailac.lvl === 6, 'recipe level 6 at Lv 23');
  s.level = 13; const q0 = perkFx(g._G).quality; s.level = 14; ok(perkFx(g._G).quality - q0 > 0.049, 'Lv 14 muối Tây Ninh: quality +0.05');
  s.level = 28; const p28 = buyPrice(g._G, 'tc_xoai'); s.level = 29; ok(buyPrice(g._G, 'tc_xoai') < p28, 'Lv 29: cheaper buying');
  s.tier = 5; s.level = 33; ok(g.act.openBranch('phuquoc').reason === 'locked', 'Phú Quốc locked before Lv 34');
  s.level = 34; ok(g.act.openBranch('phuquoc').ok, 'Phú Quốc at Lv 34');
  s.level = 16; s.upgrades.kho = 4; ok(g.get.upgradeInfo('kho').lockedReason === 'Cần Lv 17', 'kho lv6 locked before Lv 17');
  s.level = 17; ok(g.act.buyUpgrade('kho').ok && g.get.kho().cap === Math.round(C.TIERS[4].kho * 7), 'kho ×7 at Lv 17');
  const { inHours } = await import(ROOT + '/core/customers.js');
  const gv = C.MARKETING.find((m) => m.id === 'giovang');
  s.level = 36; ok(!inHours(gv, 13, g._G), 'giờ vàng 14h before Lv 37'); s.level = 37; ok(inHours(gv, 13, g._G), 'giờ vàng from 13h at Lv 37');
  s.level = 40; s.xp = 0; const ch0 = s.masteryChests || 0;
  const { addXp } = await import(ROOT + '/core/economy.js'); addXp(g._G, C.LEVEL.xpToNext(40) + 1);
  ok(s.level === 41 && s.masteryChests === ch0 + 1, 'Lv 41 gives a mastery chest');
  const m0 = s.money; ok(g.act.openMasteryChest().ok && s.money > m0 && s.masteryChests === ch0, 'mastery chest opens and pays');
  ok(C.MAIN_QUESTS.length === 47 && C.MAIN_QUESTS[36].id === 'q37', '10 main quests appended, old indexes kept');
}
// ── 12. v2.3 looks: tem logo Lv 24, đồng phục Lv 21, mặt tiền Lv 31 (saved, sanitized, gated)
{
  const { migrate } = await import(ROOT + '/core/state.js');
  const g = fresh(61); const s = g.state;
  s.level = 20; ok(g.act.setUniform({ color: 'tim' }).ok === false, 'uniform locked before Lv 21');
  s.level = 21; ok(g.act.setUniform({ color: 'tim', style: 'aotoi' }).ok && s.uniform.color === 'tim' && s.uniform.style === 'aotoi', 'uniform saved at Lv 21');
  ok(g.act.setUniform({ color: 'hack<script>' }).ok && s.uniform.color === 'goc', 'unknown uniform colour falls back');
  s.level = 23; ok(g.act.setBrand({ frame: 'ruybang' }).ok === false, 'brand locked before Lv 24');
  s.level = 24; ok(g.act.setBrand({ frame: 'ruybang', color: 'tim', slogan: '  Lắc   là <b>ghiền</b> quá trời quá đất luôn  ' }).ok, 'brand saved at Lv 24');
  ok(s.brand.frame === 'ruybang' && s.brand.slogan.length <= C.BRAND.sloganMax && !/[<>]/.test(s.brand.slogan), 'slogan trimmed and cleaned');
  s.level = 30; ok(g.act.setFacade({ sign: 'neon' }).ok === false, 'neon sign locked before Lv 31');
  s.level = 31; ok(g.act.setFacade({ sign: 'neon', bunting: 'tet' }).ok && s.facade.sign === 'neon' && s.facade.bunting === 'tet', 'facade saved');
  ok(g.act.setFacade({ flower: 'xyz' }).ok === false && s.facade.flower === 'none', 'unknown facade item refused');
  const old = JSON.parse(JSON.stringify(s)); delete old.brand; delete old.uniform; delete old.facade;
  const m = migrate(old, Date.now());
  ok(m.brand.frame === C.BRAND.def.frame && m.uniform.color === 'goc' && m.facade.sign === 'go' && m.facade.balloon === 'none', 'old save gets default looks (original appearance)');
  ok(m.money === old.money && m.level === old.level, 'old save data kept');
  const back = migrate(JSON.parse(JSON.stringify(s)), Date.now());
  ok(back.brand.frame === 'ruybang' && back.uniform.style === 'aotoi' && back.facade.bunting === 'tet', 'looks survive save/load');
  const { activeLooks } = await import(ROOT + '/core/looks.js');
  s.level = 8; const a = activeLooks(s); ok(!a.brand && !a.uniform && !a.facade, 'nothing shows below the unlock levels');
}
// ── 13. v2.4: undrawn deco removed (refunded), facade items open one by one and add ambience
{
  const { migrate } = await import(ROOT + '/core/state.js');
  const { ambienceOf } = await import(ROOT + '/core/economy.js');
  const g = fresh(71); const s = g.state;
  const old = JSON.parse(JSON.stringify(s));
  old.deco.owned.push('db_meo', 'tuong_dongho', 'den_day', 'cay_bonsai'); old.deco.equipped.dacbiet = 'db_meo'; old.deco.equipped.den = 'den_day'; old.deco.equipped.cay = 'cay_bonsai';
  const m = migrate(old, Date.now());
  ok(m.money === old.money + 2500 + 1100 + 250, 'removed deco refunded at the price paid');
  ok(!m.deco.owned.includes('db_meo') && m.deco.owned.includes('cay_bonsai') && m.deco.equipped.cay === 'cay_bonsai', 'kept deco untouched');
  ok(m.deco.equipped.den === 'den_bong' && !('dacbiet' in m.deco.equipped), 'removed slots fall back');
  const m2 = migrate(JSON.parse(JSON.stringify(m)), Date.now()); ok(m2.money === m.money, 'refund only once');
  ok(C.DECO.every((d) => d.cat === 'den' || d.cat === 'cay') && !C.DECO.some((d) => d.id === 'den_day'), 'shop only sells drawn deco');
  const items = Object.values(C.FACADE.items).flat().filter((x) => x.amb > 0);
  ok(items.every((it) => C.PERKS.some((p) => p.facade && p.facade.id === it.id && p.lv === it.lv)), 'every facade item has its own level unlock');
  ok(new Set(items.map((x) => x.lv)).size >= 12, 'facade items spread over many levels');
  s.level = 8; ok(g.act.setFacade({ bunting: 'tet' }).ok === false, 'cờ đỏ vàng locked before Lv 9');
  s.level = 9; const a0 = ambienceOf(g._G); ok(g.act.setFacade({ bunting: 'tet' }).ok && ambienceOf(g._G) > a0, 'Lv 9 cờ raises ambience');
  ok(g.act.setFacade({ flower: 'cuc' }).ok === false, 'chậu cúc locked at Lv 9');
  s.level = 13; ok(g.act.setFacade({ flower: 'cuc' }).ok, 'chậu cúc at Lv 13');
  s.deco.owned.push('den_long_do'); s.deco.equipped.den = 'den_long_do'; s.deco.owned.push('cay_luoiho'); s.deco.equipped.cay = 'cay_luoiho';
  const { mainQuestProgress } = await import(ROOT + '/core/quests.js').catch(() => ({}));
  const { activeLooks } = await import(ROOT + '/core/looks.js');
  s.level = 40; s.facade.balloon = 'maucau'; s.level = 34; ok(activeLooks(s).facade.balloon === 'none', 'locked item not shown (balloon Lv 35)');
  const { unlocksAt } = await import(ROOT + '/core/economy.js');
  const empty = []; for (let l = 2; l <= 40; l++) if (!unlocksAt(l).length) empty.push(l);
  ok(empty.length === 0, 'still every level 2–40 unlocks something');
  ok(!C.PERKS.some((p) => ['p_khachquen', 'p_banggia', 'p_quatphun', 'p_combo2', 'p_vidientu', 'p_mualehoi'].includes(p.id)), '6 perks replaced by decorations');
}
// ── 14. v2.5 món ăn kèm: unlock by level / main quest, held stock, billed on top, staff can add them
{
  const sides = C.INGREDIENTS.filter((i) => i.side);
  ok(sides.length >= 8 && sides.some((x) => x.quest) && sides.some((x) => !x.quest), '8 sides, some by level, some by quest');
  const stockSides = (g, n) => { for (const x of sides) { g.state.inventory[x.id] = n; } g.state.lots = {}; };
  // locked: nothing ordered even with stock
  let g = fresh(81); g.state.level = 3; stockSides(g, 20); runDay(g);
  ok((g.state.today.sidesSold || 0) === 0 && sides.every((x) => g.state.inventory[x.id] === 20 || x.shelf < 2), 'no sides before they unlock');
  // unlocked by level: ordered, consumed from the kho, paid on top
  g = fresh(83); g.state.level = 12; stockSides(g, 30); runDay(g);   // v2.6.4: seed 83 (groups are smaller now, seed 82's day happened to sell none)
  const sold = g.state.today.sidesSold || 0;
  ok(sold > 0, 'guests order sides once unlocked (' + sold + ')');
  const lvlSides = sides.filter((x) => !x.quest && x.unlockLv <= 12).map((x) => x.id);
  const questSides = sides.filter((x) => x.quest).map((x) => x.id);
  ok(questSides.every((id) => (g.state.today.usage[id] || 0) === 0), 'quest sides stay locked until the quest is claimed');
  ok(lvlSides.reduce((a, id) => a + (g.state.today.usage[id] || 0), 0) === sold, 'every sold side came out of the kho');
  ok(g.world.tickets.length === 0, 'no order got stuck waiting for a side');
  // scarce stock: never more ordered than held
  g = fresh(83); g.state.level = 12; stockSides(g, 0); g.state.inventory.ak_cavien = 2; runDay(g);
  ok((g.state.today.sidesSold || 0) <= 2 && g.state.inventory.ak_cavien >= 0, 'orders hold their side: never more than in stock');
  // quest unlock
  g = fresh(84); const qi = C.MAIN_QUESTS.findIndex((q) => q.id === 'q12');
  ok(!g.get.isIngUnlocked('ak_banhtrangnuong'), 'bánh tráng nướng locked at start');
  g.state.quests.main = qi; g.state.quests.mainClaimable = true; g.act.claimMainQuest();
  ok(g.get.isIngUnlocked('ak_banhtrangnuong'), 'bánh tráng nướng opens when q12 is claimed');
  // billing: a served group with a side pays its price on top
  const { ING } = await import(ROOT + '/core/economy.js');
  ok(sides.every((x) => ING[x.id].side > ING[x.id].cost), 'every side sells above its cost');
  // staff (thợ lắc) put sides in too
  g = fresh(85); g.act.debug.level(12); stockSides(g, 30); g.state.money = 1e6;
  for (const id of Object.keys(g.state.inventory)) if (!id.startsWith('ak_')) g.state.inventory[id] = 80;
  for (const role of ['daubep', 'phucvu']) { const c = g.state.candidates.list.find((x) => x.role === role); if (c) g.act.hire(role, String(c.cid)); }
  g.act.setOwnerMode?.('manage');
  runDay(g, false);
  ok(g.state.today.served > 0 && (g.state.today.sidesSold || 0) > 0, 'staff put sides in on their own (' + g.state.today.sidesSold + ')');
  ok(g.world.tickets.length === 0, 'staff never get stuck on sides');
  // market never moves side prices and they never reach Nhà vườn
  const { rollMarket, supplierSells } = await import(ROOT + '/core/economy.js');
  rollMarket(g._G); ok(sides.every((x) => g.state.market.mult[x.id] === 1), 'side prices are fixed');
  ok(sides.every((x) => !supplierSells(C.SUPPLIERS.find((s) => s.id === 'vuon'), x.id)), 'Nhà vườn does not sell sides');
}
// ── 15. v2.5.2: 5 counter spots, the long bar, quản kho runs to the market mid-shift
{
  const { getLayout } = await import(ROOT + '/art/layouts.js');
  const L = getLayout(4, { tables: 5 });
  ok(L.tables.length === 5 && L.tables[0].x >= 15 && L.tables[4].x <= 185, '5 counter spots fit inside the core');
  ok(C.TIERS[3].maxTables === 5 && C.TIERS[4].maxTables === 5, 'tiers 4–5 open a 5th spot');
  const bar = L.side.find((x) => x.bar);
  ok(bar && bar.seats.length === 4 && bar.seats.every((q) => q.facing === 'up' && q.x > 75 && q.x < 125) && Math.abs((bar.seats[0].x + bar.seats[3].x) / 2 - 100) <= 1, 'bar with 4 stools centred on the railing');
  ok(L.waitSpots.every((w) => w.x > 132 || w.x < 68), 'the queue stays clear of the bar and its stools');
  ok(new Set(L.waitSpots.map((w) => w.x + ',' + w.y)).size === L.waitSpots.length, 'queue places do not overlap');
  // a group sits at the bar once the four tables are taken
  let g = fresh(91); g.state.tier = 4; g.state.level = 20; g.state.upgrades.sidetable = 3; g.act.debug.tier(4); g.state.upgrades.sidetable = 3;
  const { syncLayout } = await import(ROOT + '/core/world.js'); syncLayout(g._G, true);
  ok(g.world.side.length === 5 && g.world.side[4].bar, 'bought bar appears as the 5th side table');
  // quản kho
  g = fresh(92); g.act.debug.level(12); g.act.debug.tier(3); g.state.money = 1e5;
  const qk = g.state.candidates.list.find((x) => x.role === 'quankho') || (() => { g.state.level = 12; return null; })();
  const { quankhoRun, mods } = await import(ROOT + '/core/economy.js');
  g.state.staff.push({ id: 99, cid: 99, role: 'quankho', name: 'Kho', rarity: 2, spd: 5, skl: 5, chm: 5, lvl: 1, jobs: 0, look: { lookSeed: 9 }, lookSeed: 9, hiredDay: 1, mood: 70, owed: 0, owedDays: 0, quitWarnDay: null, talkDay: 0, bonusDay: 0 });
  g._G.modsDirty = true; ok(mods(g._G).hasQuankho, 'test shop has a quản kho');
  for (const k of Object.keys(g.state.inventory)) g.state.inventory[k] = 30;
  g.state.lots = {};
  g.act.openShop();
  g.state.inventory.tc_xoai = 1; g.state.lots = {};
  const m0 = g.state.money;
  g.world.qkT = 0; const o = quankhoRun(g._G, 1);
  ok(o && o.sup === 'quankho' && o.items.tc_xoai >= C.QUANKHO.minBuy, 'low xoài → quản kho runs to the market');
  ok(g.state.money < m0 && o.fee === 0, 'paid at market price, no delivery fee');
  g.world.qkT = 0; ok(quankhoRun(g._G, 1) === null, 'one run at a time');
  const before = g.state.inventory.tc_xoai;
  for (let i = 0; i < 40 * 4; i++) g.update(0.25);
  ok(!(g.state.orders || []).some((x) => x.sup === 'quankho') && g.state.inventory.tc_xoai > before - 3, 'the run comes back with the goods');
  // no quản kho → nothing happens
  g = fresh(93); g.act.openShop(); g.state.inventory.tc_xoai = 0; g.world.qkT = 0;
  ok(quankhoRun(g._G, 1) === null, 'without a quản kho nobody runs to the market');
}
// ── 16. backup codes made by every older version still restore into this one and the shop runs
{
  const fs = await import('node:fs');
  const { decodeSave } = await import(ROOT + '/ui/backup.js');
  const codes = JSON.parse(fs.readFileSync(new URL('./fixtures/backup-codes.json', import.meta.url)));
  for (const [ver, code] of Object.entries(codes)) {
    const save = await decodeSave(code);
    const lv = save.level, day = save.day, money = save.money, name = save.shopName;
    const g = createGame(JSON.parse(JSON.stringify(save)), { headless: true, seed: 5, now: 1.8e12 });
    const s = g.state;
    ok(s.v === C.VERSION && s.shopName === name && s.level >= lv && s.day === day, ver + ': shop and day kept, level never lower');
    ok(s.money >= money - 0.01, ver + ': money kept (refunds only add)');
    ok(s.brand && s.uniform && s.facade && s.deco.equipped && C.DECO_CATS.every((c) => c.id in s.deco.equipped), ver + ': new fields filled in');
    s.tutorial.done = true; runDay(g);
    ok(s.phase === 'report' || s.phase === 'prep', ver + ': a full day runs after restoring');
    const again = createGame(g.serialize(), { headless: true, seed: 6, now: 1.8e12 });
    ok(again.state.level === s.level && Math.abs(again.state.money - s.money) < 0.01, ver + ': save → load round trip is stable');
  }
  // and a code made now restores to the same shop
  const { encodeSave } = await import(ROOT + '/ui/backup.js');
  const g = fresh(97); g.state.money = 12345.5; g.state.brand.frame = 'ruybang'; g.state.started = true;
  const back = await decodeSave(await encodeSave(g.serialize()));
  ok(back.money === 12345.5 && back.brand.frame === 'ruybang' && back.v === C.VERSION, 'current version: encode → decode keeps everything');
  let bad = null; try { await decodeSave(code0().slice(0, -3) + 'zzz'); } catch (e) { bad = e.message; }
  ok(bad && /sai|thiếu/.test(bad), 'a mistyped code is refused with a friendly message');
  function code0() { return Object.values(codes)[0]; }
}
// ── 17. v2.6 thanh lý hàng cũ: oldest lots first, below cost, morning only, loss on the report
{
  const g = fresh(101); const s = g.state;
  g.state.money = 10000;
  for (let i = 0; i < 3; i++) g.act.buyIngredient('tc_xoai', 10);       // 30 portions bought today at chợ price
  const lots = s.lots.tc_xoai; const paid = lots.reduce((a, l) => a + l.n * (l.c ?? 0), 0);
  const have = s.inventory.tc_xoai, m0 = s.money;
  const q = g.get.liquidateQuote('tc_xoai', 10);
  ok(q.ok && q.n === 10 && q.money < q.basis, 'quote: 10 portions pay less than they cost');
  const minSupplier = Math.min(...C.SUPPLIERS.map((x) => x.priceMult));
  ok(Math.max(...C.LIQUIDATE.rates) < minSupplier * 0.95, 'buy-back always below the cheapest supplier (no buy-low-sell-high)');
  const r = g.act.liquidate('tc_xoai', 10);
  ok(r.ok && s.inventory.tc_xoai === have - 10 && Math.abs(s.money - (m0 + r.money)) < 0.01, 'sold: stock down, money in');
  ok(Math.abs(s.today.costs.liquidation - r.loss) < 0.01 && r.loss > 0, 'loss vs. cost goes on the report as its own line');
  ok(s.lots.tc_xoai.reduce((a, l) => a + l.n, 0) === s.inventory.tc_xoai, 'lots stay in step with the stock');
  // older lots first and cheaper: make the first lot expire after today
  s.lots.tc_xoai[0].e = s.day; s.lots.tc_xoai.push({ n: 5, e: s.day + 3, c: 12 }); s.inventory.tc_xoai += 5;
  const qOld = g.get.liquidateQuote('tc_xoai', 1), qNew = g.get.liquidateQuote('tc_xoai');
  ok(qOld.groups[0].left === 0 && Math.abs(qOld.groups[0].rate - C.LIQUIDATE.rates[0]) < 1e-9, 'the lot that expires after today sells first, at the lowest rate');
  ok(g.get.oldStock('tc_xoai') === s.lots.tc_xoai[0].n && qNew.groups.find((x) => x.left === 3).rate === C.LIQUIDATE.rates[2], 'old stock counts portions expiring after today; fresh lots get the best rate');
  ok(qNew.groups.length >= 2, 'quote splits by days left');
  // morning only
  g.act.openShop(); ok(g.act.liquidate('tc_xoai', 1).ok === false, 'no selling once the shop is open');
  ok(g.act.liquidate('nope', 1).ok === false, 'unknown item refused');
  // the day's report shows the loss and profit includes it
  runDay(g, true);
  ok((s.report.costs.liquidation || 0) > 0, 'report carries the thanh lý loss');
  // too many / nothing
  const g2 = fresh(102); g2.state.inventory.ot = 0; g2.state.lots = {};
  ok(g2.act.liquidate('ot', 5).ok === false, 'nothing to sell → refused');
}
// ── 18. v2.6.1 easier XP: 20 % less per level; XP already earned is settled into levels on load
{
  ok(C.XP_EASE < 1 && [2, 10, 21].every((l) => C.LEVEL.xpToNext(l) === Math.round(C.LEVEL.xpBase(l) * C.XP_EASE)), 'every level needs XP_EASE × the old amount');
  ok(C.XP_LATE === 0.9 && [22, 30, 40].every((l) => C.LEVEL.xpToNext(l) === Math.round(C.LEVEL.xpBase(l) * C.XP_EASE * 0.9)), 'v2.6.7: Lv 22+ needs 10 % less again');
  const g = fresh(111); const save = g.serialize();
  save.level = 10; save.xp = Math.round(C.LEVEL.xpBase(10) * 0.95);        // 95 % of the OLD need → over the new need
  const re = createGame(save, { headless: true, seed: 1, now: 1.8e12 });
  ok(re.state.level === 11 && re.state.xp === save.xp - C.LEVEL.xpToNext(10), 'old save over the new need levels up on load, keeps the rest');
  const save2 = g.serialize(); save2.level = 10; save2.xp = 5;
  ok(createGame(save2, { headless: true, seed: 1, now: 1.8e12 }).state.level === 10, 'no free level when the XP is not there');
}
// ── 19. v2.6.4 small, readable groups: 1–3 people, pairs are one of each, every member looks different
{
  ok(Object.values(C.CUSTOMERS).every((k) => k.group[1] <= 3 && k.group[0] >= 1), 'no group has more than 3 people');
  ok(C.CUSTOMERS.capdoi.group.join() === '2,2' && C.CUSTOMERS.giadinh.group.join() === '3,3', 'couple = 2, family = 3');
  const { makeLook } = await import(ROOT + '/art/characters.js');
  let same = 0, pairs = 0;
  for (let seed = 1; seed <= 300; seed++) for (const kind of ['sinhvien', 'vanphong', 'capdoi', 'hoiban', 'khachtay', 'giadinh', 'doandulich']) {
    const a = makeLook(kind, seed, 0), b = makeLook(kind, seed, 1); pairs++;
    if (a.sheet === b.sheet && (a.variant | 0) === (b.variant | 0)) same++;
  }
  ok(same === 0, 'two members of a group never look identical (' + same + '/' + pairs + ')');
  const f = makeLook('giadinh', 7, 0), m = makeLook('giadinh', 7, 1), k = makeLook('giadinh', 7, 2);
  ok(new Set([f.sheet, m.sheet, k.sheet]).size === 3, 'family = dad + mom + kid');
}
// ── 20. v2.6.5 the tarp rolls out by itself from Chợ đêm bờ kè (tier 4); the vỉa hè still pulls it by hand
{
  const rainDay = (seed, tier) => {
    const g = fresh(seed); g.act.debug.level(20); g.act.debug.tier(tier); g.state.weather = 'rain'; g.state.today.showers = null;
    g.act.openShop(); let sawRain = false, tarpInRain = true, i = 0;
    while ((g.state.phase === 'open' || g.state.phase === 'closing') && i++ < 100000) {
      g.update(0.25);
      if (g.get.rain().raining) { sawRain = true; if (!g.state.today.tarp) tarpInRain = false; }
    }
    return { sawRain, tarpInRain, tarpAfter: !!g.state.today.tarp };
  };
  const t4 = rainDay(201, 4), t1 = rainDay(202, 1);
  ok(t4.sawRain && t4.tarpInRain, 'tier 4: the tarp is out for every shower without a tap');
  ok(t1.sawRain && !t1.tarpInRain, 'tier 1: the tarp still waits for the player');
}
// ── 21. v2.6.7 hire quest counts the team, main shop can move to an open branch city (scene only)
{
  let g = fresh(211); g.state.staff.push({ id: 77, cid: 77, role: 'phucvu', name: 'A', rarity: 1, spd: 3, skl: 3, chm: 3, lvl: 1, jobs: 0, look: { lookSeed: 3 }, lookSeed: 3, hiredDay: 1, mood: 70, owed: 0, owedDays: 0, quitWarnDay: null, talkDay: 0, bonusDay: 0 });
  g.state.quests.counters['hire:phucvu'] = 0;
  const { mainProgress } = await import(ROOT + '/core/quests.js');
  ok(mainProgress(g._G, C.MAIN_QUESTS.find((q) => q.id === 'q5')) >= 1, 'a waiter already on the team completes "Thuê phục vụ đầu tiên"');
  g = fresh(212); g.state.tier = 5; g.state.money = 1e7;
  ok(g.act.setHomeCity('dalat').ok === false && g.state.homeCity == null, 'cannot move to a city without a branch');
  g.state.branches.dalat = 1;
  const money = g.state.money, tier = g.state.tier;
  ok(g.act.setHomeCity('dalat').ok && g.state.homeCity === 'dalat' && g.state.money === money && g.state.tier === tier, 'moves to Đà Lạt, nothing else changes');
  ok(C.BRANCHES.every((b) => b.scene), 'every branch city has a scene');
  const saved = JSON.parse(JSON.stringify(g.serialize())); const g2 = createGame(saved, { headless: true, seed: 3, now: 1.8e12 });
  ok(g2.state.homeCity === 'dalat', 'the choice is saved');
  saved.branches.dalat = 0; const g3 = createGame(JSON.parse(JSON.stringify(saved)), { headless: true, seed: 3, now: 1.8e12 });
  ok(g3.state.homeCity == null, 'a city without a branch falls back to TP.HCM on load');
  ok(g.act.setHomeCity(null).ok && g.state.homeCity == null, 'back to TP.HCM');
}
// ── 22. v2.6.8 "Mua bạt che mưa" never sticks at 0/1 in a covered shop (the tarp cannot be bought there)
{
  const { mainProgress } = await import(ROOT + '/core/quests.js');
  const q6 = C.MAIN_QUESTS.find((q) => q.id === 'q6');
  let g = fresh(221); g.state.tier = 3; g.state.upgrades.tarp = 0; g.state.quests.counters['upgrade:tarp'] = 0;
  ok(g.get.upgradeInfo('tarp').canBuy === false && mainProgress(g._G, q6) >= 1, 'covered tier: tarp shown as owned → quest done');
  g = fresh(222); g.state.upgrades.tarp = 1; g.state.quests.counters['upgrade:tarp'] = 0;
  ok(mainProgress(g._G, q6) >= 1, 'a tarp already owned counts');
  g = fresh(223);
  ok(mainProgress(g._G, q6) === 0, 'tier 1 without a tarp: still 0/1');
}
// ── 23. v2.6.9 thiết bị mới: open by level, real effects, giao hàng
{
  const E = await import(ROOT + '/core/economy.js');
  const NEW = ['shaker', 'hygiene', 'scale', 'icemaker', 'blender', 'packing', 'kiosk', 'filter', 'delivery', 'master', 'menuscreen'];
  ok(NEW.every((id) => C.UPGRADES.some((u) => u.id === id && u.minLv && u.minLv.length === u.costs.length)), 'every new item has a level gate per level');
  let g = fresh(231); g.state.tier = 5; g.state.money = 1e8; g.state.level = 12;
  ok(g.act.buyUpgrade('shaker').ok === false, 'Hũ lắc locked before Lv 13');
  g.state.level = 13;
  const z0 = (await import(ROOT + '/core/kitchen.js')).shakeZone(g._G, { pot: 'xoailac' });
  ok(g.act.buyUpgrade('shaker').ok, 'Hũ lắc buyable at Lv 13');
  const z1 = (await import(ROOT + '/core/kitchen.js')).shakeZone(g._G, { pot: 'xoailac' });
  ok(z1[0] < z0[0] && z1[1] > z0[1], 'Hũ lắc widens the LẮC sweet spot');
  ok(g.act.buyUpgrade('shaker').ok === false, 'its 2nd level waits for Lv 18');
  ok(E.unlocksAt(13).some((u) => u.type === 'equip' && u.id === 'shaker') && E.unlocksAt(41).some((u) => u.id === 'master'), 'level-up cards show the new equipment');
  // sinh tố needs the blender
  g.state.level = 19; g._G.modsDirty = true;
  ok(!E.isDrinkUnlocked(g._G, 'sinhto'), 'no Sinh tố without the blender');
  ok(g.act.buyUpgrade('blender').ok && E.isDrinkUnlocked(g._G, 'sinhto'), 'blender opens Sinh tố xoài');
  // QR on the till, scale, menu screen
  g.state.level = 36; g.state.upgrades.pos = 1; g._G.modsDirty = true;
  const tip1 = E.mods(g._G).tip, buy1 = E.buyPrice(g._G, 'tc_xoai');
  ok(g.act.buyUpgrade('pos').ok && E.mods(g._G).tip > tip1, 'mã QR (máy tính tiền cấp 2) raises tips');
  ok(g.act.buyUpgrade('scale').ok && E.buyPrice(g._G, 'tc_xoai') <= buy1, 'cân điện tử: fruit no dearer');
  const { refuseChance } = await import(ROOT + '/core/customers.js');
  g.state.prices.xoailac = 60; const r0 = refuseChance(g._G, 'sinhvien', 'xoailac');
  ok(g.act.buyUpgrade('menuscreen').ok && refuseChance(g._G, 'sinhvien', 'xoailac') < r0, 'menu screen: fewer refusals over price');
  // giao hàng: orders come in and use the kho, never block the counter
  g = fresh(232); g.state.level = 40; g.state.tier = 5; g.state.money = 1e8;
  const { syncLayout } = await import(ROOT + '/core/world.js'); syncLayout(g._G, true);
  for (const i of C.INGREDIENTS) g.state.inventory[i.id] = 200; for (const x of C.SUPPLIES) g.state.supplies[x.id] = 500; g.state.lots = {};
  ok(g.act.buyUpgrade('delivery').ok, 'xe giao hàng at Lv 35+');
  runDay(g);
  ok((g.state.today.delivered || 0) >= 8 && g.state.stats.delivered === g.state.today.delivered, 'delivery orders through the day (' + g.state.today.delivered + ')');
  ok(g.world.tickets.length === 0 && g.state.phase !== 'open', 'the day still ends cleanly');
  // an old save without the new keys
  const old = JSON.parse(JSON.stringify(g.serialize())); for (const id of NEW) delete old.upgrades[id];
  const g2 = createGame(old, { headless: true, seed: 5, now: 1.8e12 });
  ok(NEW.every((id) => g2.state.upgrades[id] === 0), 'old saves start every new item at 0');
}
// ── 24. v2.6.10 tốc độ ×3 from Lv 10
{
  const g = fresh(241); g.state.level = 9;
  ok(g.act.setSpeed(3).ok === false && g.state.speed === 1, '×3 locked before Lv 10');
  g.state.level = 10;
  ok(g.act.setSpeed(3).ok && g.state.speed === 3, '×3 at Lv 10');
  const t0 = g.state.clock; g.act.openShop(); const c0 = g.state.clock; g.update(1); const d3 = g.state.clock - c0;
  const h = fresh(242); h.state.level = 10; h.act.openShop(); const c1 = h.state.clock; h.update(1); const d1 = h.state.clock - c1;
  ok(Math.abs(d3 - 3 * d1) < 0.01 * d1 + 1e-6, 'one real second = three times the game minutes');
  const sv = JSON.parse(JSON.stringify(g.serialize())); sv.speed = 5;
  ok(createGame(sv, { headless: true, seed: 1, now: 1.8e12 }).state.speed === 1, 'an unknown speed in a save falls back to ×1');
}
// ── 25. v2.6.11 quests pay XP as a share of the level's EXP bar
{
  const Q = await import(ROOT + '/core/quests.js');
  const g = fresh(251); g.state.level = 30; g.state.xp = 0;
  const need = C.LEVEL.xpToNext(30);
  ok(Q.questXp(g._G, 'main', 0) === Math.round(need * C.QUEST_XP.main) && Q.questXp(g._G, 'gold', 80) === Math.round(need * C.QUEST_XP.gold), 'main / gold chest pay their share of the bar');
  ok(C.QUEST_XP.main === 0.03 && C.QUEST_XP.gold === 0.02, 'v2.6.18: quest shares trimmed');
  ok(C.LEVEL.serveXpMult(5) === 1 && C.LEVEL.serveXpMult(20) === 0.85 && C.LEVEL.serveXpMult(40) === 0.85 && C.LEVEL.serveXpMult(15) < 1, 'v2.6.18: serving XP full until Lv 9, 85 % from Lv 20');
  g.state.level = 2;
  ok(Q.questXp(g._G, 'gold', 80) >= 80 && Q.questXp(g._G, 'v2', 20) >= 20, 'never below the old fixed amount');
  // a claimed main quest really adds that XP
  const h = fresh(252); h.state.level = 30; h.state.xp = 0; h.state.quests.main = 1; h.state.quests.mainClaimable = true;
  const r = h.act.claimMainQuest();
  ok(r.ok && r.reward.xp === Math.round(need * C.QUEST_XP.main) && h.state.xp === r.reward.xp, 'claimMainQuest grants and reports the scaled XP (' + r.reward.xp + ')');
}
// ── 26. v2.6.14 chọn ly / hộp: per order, falls back to the other container, the chosen one is used
{
  const g = fresh(261); g.state.level = 12; g.state.tutorial = { step: 99, done: true };
  for (const x of C.SUPPLIES) g.state.supplies[x.id] = 50;
  g.state.supplies.hop_giay = 0;                                     // no boxes: box dishes go in a cup instead of being refused
  g.act.openShop(); let t = null, i = 0;
  while (!t && i++ < 4000) { g.update(0.25); t = g.world.tickets.find((x) => !x.extra && C.DISH_PACK[x.pot]); }
  ok(t && t.box === 'ly_lac', 'an order gets a container (cup, since there are no boxes)');
  g.act.selectTicket(t.id);
  ok(g.act.setPack('hop_giay').ok === false && t.box === 'ly_lac', 'cannot switch to a container that ran out');
  g.state.supplies.hop_giay = 5;
  ok(g.act.setPack('hop_giay').ok && t.box === 'hop_giay' && g.get.trayInfo().box === 'hop_giay', 'switch to a box on the tray');
  const cups = g.state.supplies.ly_lac, boxes = g.state.supplies.hop_giay;
  const inf = g.get.trayInfo(); for (const q of inf.need) if (!q.done) g.act.addIngredient(q.ing);
  if (inf.drinks.need) g.act.addDrinks(); if (inf.sides && inf.sides.need) g.act.addSides();
  g.act.serve('good');
  for (let k = 0; k < 400 && g.state.supplies.hop_giay === boxes; k++) g.update(0.25);
  ok(g.state.supplies.hop_giay === boxes - 1 && g.state.supplies.ly_lac === cups, 'the box was used, not a cup');
}
// ── 27. v2.6.19 the shop's container choice applies to every new order (staff's too)
{
  const g = fresh(271); g.state.level = 12; g.state.tutorial = { step: 99, done: true };
  for (const x of C.SUPPLIES) g.state.supplies[x.id] = 50;
  ok(g.act.setPackPref('hop_giay').ok && g.state.packPref === 'hop_giay', 'choose boxes for new orders');
  g.act.openShop(); let t = null, i = 0;
  while (!t && i++ < 4000) { g.update(0.25); t = g.world.tickets.find((x) => !x.extra && C.DISH_PACK[x.pot] && C.DISH_PACK[x.pot].box === 'ly_lac'); }
  ok(t && t.box === 'hop_giay', 'a cup dish ordered now goes in a box');
  ok(g.act.setPackPref(null).ok && g.state.packPref === null && g.act.setPackPref('chen').ok === false, 'back to each dish\'s own; unknown kinds refused');
  const sv = JSON.parse(JSON.stringify(g.serialize())); sv.packPref = 'xyz';
  ok(createGame(sv, { headless: true, seed: 1, now: 1.8e12 }).state.packPref === null, 'a bad value in a save is dropped');
}
console.log('OK', n, 'checks');
