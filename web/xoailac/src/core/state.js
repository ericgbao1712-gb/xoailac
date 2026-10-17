// Persistent state factory + migration (TECH_SPEC §4).
import * as C from '../config.js';
import { mergeDefaults, clone } from './util.js';
import { sanitizeBrand, sanitizeUniform, sanitizeFacade } from './looks.js';

export const COST_KEYS = ['ingredients', 'broth', 'supplies', 'drinks', 'salary', 'rent', 'marketing', 'lottery', 'liquidation'];   // liquidation = lỗ thanh lý so với vốn

export function newToday() {
  const costs = {};
  for (const k of COST_KEYS) costs[k] = 0;
  return {
    revenue: 0, tips: 0, costs,
    served: 0, angry: 0, fiveStars: 0, potsSold: 0, potsSoldOf: {}, drinksSold: 0, sidesSold: 0, extrasServed: 0, thanked: 0,
    comboMax: 0, newKinds: [], bestReviewId: null, noAngryUntil: null,
    stars: 0, rated: 0, lost: 0,            // star sum / count of finished groups, walk-aways
    usage: {},                              // ingredients consumed today (→ usageYesterday)
    ratingBefore: 3.5, levelBefore: 1, lotteryWon: 0, lotteryTickets: 0,
    supplyUse: {}, supplyMiss: {},          // vật tư used / missing today
    priceLost: 0, priceRefused: {},         // groups that walked away over the price (per dish)
    seated: 0,                              // groups that sat at a side table
    salaryOwed: 0, debtPaid: 0,             // salary that could not be paid tonight · old debt paid back today
  };
}

export function defaultState(now = Date.now()) {
  const inventory = {}, market = { mult: {}, trend: {} };
  for (const i of C.INGREDIENTS) { inventory[i.id] = C.START.inventory[i.id] || 0; market.mult[i.id] = 1; market.trend[i.id] = 0; }
  const recipes = {}, menu = {};
  for (const p of C.HOTPOTS) { recipes[p.id] = { lvl: 1, sold: 0 }; menu[p.id] = p.unlockLv <= 1; }
  const upgrades = {};
  for (const u of C.UPGRADES) upgrades[u.id] = 0;
  const marketingToday = {};
  for (const m of C.MARKETING) marketingToday[m.id] = false;
  const defaults = C.DECO.filter((d) => d.default);
  const equipped = {};
  for (const c of C.DECO_CATS) equipped[c.id] = (defaults.find((d) => d.cat === c.id) || {}).id;
  const supplies = {}, supplyAvg = {};
  for (const x of C.SUPPLIES) { supplies[x.id] = (C.START.supplies && C.START.supplies[x.id]) || 0; supplyAvg[x.id] = x.cost; }
  const branches = {};
  for (const b of C.BRANCHES) branches[b.id] = 0;
  const kinds = {};
  return {
    v: C.VERSION, savedAt: now, createdAt: now,
    started: false,
    shopName: C.START.shopName, avatar: 0,
    money: C.START.money, xp: 0, level: 1, tier: 1,
    day: 1, clock: C.TIME.dayStart, phase: 'prep',
    speed: 1,
    tutorial: { step: 0, done: false },
    flags: { mom: {}, seenUnlock: {}, ui: {} },
    inventory, lots: {}, expired: null, market, autoRestock: false, usageYesterday: {},
    recipes, menu,
    upgrades,
    deco: { owned: defaults.map((d) => d.id), equipped },
    homeCity: null,
    packPref: null,   // v2.6.19: container for new orders (null = each dish's own, 'ly_lac' / 'hop_giay')   // v2.6.7: branch id the main shop moved to (scene only)
    brand: { ...C.BRAND.def }, uniform: { ...C.UNIFORM.def }, facade: { ...C.FACADE.def },   // v2.3 looks (Lv 24 / 21 / 31)
    prices: {},                                  // dishId → selling price the player set (k); missing = reference price
    supplies, supplyAvg, supplyUseYesterday: {},
    orders: [], nextOrderId: 1, supplier: 'cho',  // deliveries on their way · supplier picked in the Kho
    wageDebt: [],                                // { name, amount } owed to people who already left
    staff: [], candidates: { day: 0, list: [] }, staffTickets: 0, masteryChests: 0, ownerMode: 'work', nextStaffId: 1, nextCid: 1,
    rating: { recent: [], avg: C.RATING.prior, count: 0 },
    reviews: [], nextReviewId: 1, combo: { best: 0 },
    weather: 'sun', event: null,
    forecast: { weather: 'rain', event: null },
    marketingToday,
    viral: { days: 0, mult: 1 }, boost: 1, nextBoost: 1,   // boost = today's TikToker bonus, nextBoost = tomorrow's
    reservations: [],
    lottery: { tickets: 0 },
    quests: { main: 0, mainClaimable: false, v2: 0, v2Claimable: false, daily: { day: 0, list: [], allClaimed: false }, counters: {} },
    login: { lastDate: '', streak: 0, claimedDate: null },
    book: { kinds },
    stats: { potsSold: 0, potsSoldOf: {}, served: 0, fiveStars: 0, angry: 0, extrasServed: 0, drinksSold: 0, sidesSold: 0, daysPlayed: 0,
      bestDayRevenue: 0, bestDayProfit: 0, avgDayProfit: 0, seated: 0, packsUsed: 0 },
    today: newToday(),
    report: null,
    branches,
    ended: false,
    settings: { music: 0.6, sfx: 0.8, haptics: true, dayMin: C.TIME.defaultDayMin },
  };
}

/** Deep-merge a (possibly old) save onto the defaults so new fields never break old saves. */
export function migrate(save, now) {
  const def = defaultState(now);
  if (!save || typeof save !== 'object') return def;
  const hadBroth = !!(save.inventory && 'nl_ga' in save.inventory);
  const fromV = Number(save.v) || 1;
  const s = mergeDefaults(def, save);
  delete s.potAssign;
  // saves from before broth was a kho item: Má sends a few portions of every broth on the menu
  if (save.started && !hadBroth) {
    for (const i of C.INGREDIENTS) if (i.broth && s.level >= i.unlockLv) s.inventory[i.id] = Math.max(s.inventory[i.id] || 0, 12);
  }
  // v1 → v2: supplies did not exist. A started game gets Má's starter stack (same as a new game, ×2) so nobody is
  // blocked the moment they load; staff get a neutral mood and no debt. Nothing old is removed.
  if (fromV < 2 && save.started && !(save.supplies && typeof save.supplies === 'object')) {
    for (const x of C.SUPPLIES) s.supplies[x.id] = ((C.START.supplies && C.START.supplies[x.id]) || 0) * 2;
    s.flags.ui.v2Gift = true;
  }
  migrateStaff(s);
  // v2.4: decorations that were never drawn outside the shop are gone. Whatever was paid for them goes back to the
  // till (once: they leave the owned list), equipped slots fall back to the default, and Má explains it.
  let decoRefund = 0;
  s.deco.owned = (s.deco.owned || []).filter((id) => {
    if (C.REMOVED_DECO[id] == null) return true;
    decoRefund += C.REMOVED_DECO[id];
    return false;
  });
  for (const cat of Object.keys(s.deco.equipped || {})) {
    if (!C.DECO_CATS.some((c) => c.id === cat)) { delete s.deco.equipped[cat]; continue; }
    if (!C.DECO.some((d) => d.id === s.deco.equipped[cat])) s.deco.equipped[cat] = (C.DECO.find((d) => d.cat === cat && d.default) || {}).id;
  }
  if (decoRefund > 0) { s.money = (s.money || 0) + decoRefund; s.flags.ui.decoRefund = decoRefund; }
  if (s.homeCity != null && !(C.BRANCHES.some((b) => b.id === s.homeCity) && (s.branches || {})[s.homeCity] > 0)) s.homeCity = null;
  if (s.packPref != null && !(C.CONTAINER_IDS || []).includes(s.packPref)) s.packPref = null;
  s.brand = sanitizeBrand(s.brand); s.uniform = sanitizeUniform(s.uniform); s.facade = sanitizeFacade(s.facade);
  // the side-table row holds 4 sets (2 + 2 upgrades); an early v2 build sold up to 6
  const sideMax = C.UPGRADES.find((u) => u.id === 'sidetable').costs.length;
  if (!(s.upgrades.sidetable >= 0)) s.upgrades.sidetable = 0;
  if (s.upgrades.sidetable > sideMax) {
    // those extra sets were paid for: give the money back (prices of the early build: 250, 900, 2500, 6000)
    const OLD = [250, 900, 2500, 6000];
    let refund = 0;
    for (let i = sideMax; i < Math.min(s.upgrades.sidetable, OLD.length); i++) refund += OLD[i];
    s.money = (s.money || 0) + refund;
    s.upgrades.sidetable = sideMax;
    if (refund > 0) s.flags.ui.sideRefund = refund;
  }
  // v2.6.20: the "Mối vựa trái cây" upgrade is gone: give its price back once (the quản kho still restocks)
  if ((s.upgrades.supplier || 0) > 0) { s.money = (s.money || 0) + 2000; s.flags.ui.supplierRefund = 2000; }
  delete s.upgrades.supplier;
  if (s.autoRestock && !(s.staff || []).some((m) => m.role === 'quankho')) s.autoRestock = false;
  if (!(s.quests.v2 >= 0)) s.quests.v2 = 0;
  // prices: drop anything that is not a positive number for a known dish
  if (!s.prices || typeof s.prices !== 'object' || Array.isArray(s.prices)) s.prices = {};
  for (const k of Object.keys(s.prices)) if (!C.HOTPOTS.some((p) => p.id === k) || !(Number(s.prices[k]) > 0)) delete s.prices[k];
  for (const x of C.SUPPLIES) if (!(s.supplies[x.id] >= 0)) s.supplies[x.id] = 0;
  if (!Array.isArray(s.orders)) s.orders = [];
  s.orders = s.orders.filter((o) => o && typeof o === 'object' && o.items && typeof o.at === 'number');
  if (!Array.isArray(s.wageDebt)) s.wageDebt = [];
  if (!C.SUPPLIERS.some((x) => x.id === s.supplier)) s.supplier = 'cho';
  // sanity
  if (!(s.clock >= C.TIME.dayStart)) s.clock = C.TIME.dayStart;
  if (!['prep', 'open', 'closing', 'report'].includes(s.phase)) s.phase = 'prep';
  if (!(s.tier >= 1 && s.tier <= C.TIERS.length)) s.tier = 1;
  if (!(s.money >= 0)) s.money = 0;
  if (![1, 2, 3, 4, 8].includes(s.speed)) s.speed = 1;
  s.v = C.VERSION;
  return s;
}
export { clone };

/** Staff records from before v2 get the new fields (mood, wage debt…). Safe to run on every load. */
export function migrateStaff(s) {
  for (const m of s.staff || []) {
    if (!(typeof m.mood === 'number' && isFinite(m.mood))) m.mood = C.MOOD.start;
    m.mood = Math.max(0, Math.min(100, m.mood));
    if (!(m.owed >= 0)) m.owed = 0;
    if (!(m.owedDays >= 0)) m.owedDays = 0;
    if (m.quitWarnDay != null && !(m.quitWarnDay > 0)) m.quitWarnDay = null;
    if (m.quitWarnDay === undefined) m.quitWarnDay = null;
    if (!(m.talkDay >= 0)) m.talkDay = 0;
    if (!(m.bonusDay >= 0)) m.bonusDay = 0;
  }
}
