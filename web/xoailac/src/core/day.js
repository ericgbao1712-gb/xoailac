// Day cycle, report, tiers, marketing, lottery lady, branches, offline earnings (TECH_SPEC §6.11–6.14).
import * as C from '../config.js';
import { clamp, round2 } from './util.js';
import { fmtMoney, fmtRating, fmtClock } from './format.js';
import { newToday } from './state.js';
import {
  addMoney, spend, tierDef, mods, autoRestock, rollMarket, salaryTotal, MARKETING_BY_ID, BRANCH_BY_ID, UP,
  featureUnlocked, builtTables, isPotUnlocked, xpNeed, addXp, syncLots, expireStock, deliverOrders, staffSalary, ambienceOf, perkFx, branchMaxLevel,
} from './economy.js';
import { syncLayout, makeActor, removeActor, setPath, stepActor } from './world.js';
import { route } from './routing.js';
import { startDay, beginClosing, resetCustomers, collectCoins, spawnGroup } from './customers.js';
import { resetWorkers, syncWorkers } from './workers.js';
import { genCandidates } from './staff.js';
import { rollDaily, autoClaimDailies, counter } from './quests.js';
import { clearStove, dressStoves } from './kitchen.js';

const fail = (reason, msg) => ({ ok: false, reason, msg });
const TM = (G) => C.TIER_MULT[G.state.tier - 1];

// ───────────── weather / events / forecast ─────────────
export function rollWeather(G, prev) {
  return G.rng.weighted(Object.keys(C.WEATHER), (id) => (id === 'storm' && prev === 'storm' ? 0 : C.WEATHER[id].weight)) || 'sun';
}
export function rollEvent(G) {
  const k = perkFx(G).eventChance;            // Lv 38 Mùa lễ hội
  for (const e of G.rng.shuffle(C.EVENTS.slice())) if (G.rng.chance(e.chance * k)) return e.id;
  return null;
}

export function weatherEffectText(G, weather, tierNo = G.state.tier) {
  const W = C.WEATHER[weather], up = G.state.upgrades;
  const pct = (m) => (m >= 1 ? '+' : '−') + Math.abs(Math.round((m - 1) * 100)) + '%';
  switch (weather) {
    case 'rain':
      if (C.TIERS[tierNo - 1].covered) return `Mưa rả rích, thèm ly xoài lắc cay cay, khách ${pct(W.demand)}.`;
      return up.tarp > 0 ? `Có mưa rào — mưa thì chạm Kéo bạt, khách ${pct(W.demand)}!` : 'Có mưa rào mà chưa có bạt — khách ướt sẽ bỏ về!';
    case 'hot': return up.cooling > 0 ? 'Có quạt rồi, khách vẫn bình thường.' : `Chưa có quạt nên khách ${pct(W.noCoolingDemand)}.`;
    case 'cold': return `Trời se lạnh, thèm đồ chua cay, khách ${pct(W.demand)}!`;
    case 'storm': return C.TIERS[tierNo - 1].covered || up.tarp > 0 ? `Bão to, ít người ra đường, khách ${pct(W.demand)}.` : 'Bão to mà chưa có bạt — mưa cả ngày, khách không dám ngồi!';
    default: return 'Trời đẹp, khách bình thường.';
  }
}
export function forecastInfo(G) {
  const f = G.state.forecast, W = C.WEATHER[f.weather] || C.WEATHER.sun;
  const ev = C.EVENTS.find((e) => e.id === f.event);
  let text = `Ngày mai: ${W.name}. ${weatherEffectText(G, f.weather)}`;
  if (ev) text += ` ${ev.name}: ${ev.desc}`;
  return { weather: f.weather, event: f.event, text };
}

// ───────────── tier info / expansion ─────────────
export function tierInfo(G) {
  const s = G.state, next = C.TIERS[s.tier] || null;
  if (!next) return { tier: s.tier, next: null, canExpand: false, reasons: [], cost: 0, require: null };
  const rq = next.require, reasons = [];
  if (s.level < rq.level) reasons.push(`Cần Lv ${rq.level} (đang Lv ${s.level})`);
  if (s.rating.avg < rq.rating || s.rating.count < 20) {
    reasons.push(`Cần ${fmtRating(rq.rating)}★ với ít nhất 20 đánh giá (đang ${fmtRating(s.rating.avg)}★, ${s.rating.count} lượt)`);
  }
  if (s.money + 1e-9 < next.cost) reasons.push(`Cần thêm ${fmtMoney(next.cost - s.money)} tiền`);
  return { tier: s.tier, next: next.id, canExpand: reasons.length === 0, reasons, cost: next.cost, require: rq };
}

export function expandTier(G) {
  const s = G.state, w = G.world;
  const info = tierInfo(G);
  if (!info.next) return fail('max', 'Quán đã ở cấp cao nhất rồi nha!');
  if (s.phase === 'open' || s.phase === 'closing') return fail('phase', 'Đóng cửa rồi mới dọn sang quán mới được nha!');
  if (!info.canExpand) return fail('requirements', info.reasons[0]);
  addMoney(G, -info.cost, 'tier');
  s.tier++;
  s.upgrades.table = 0; s.upgrades.stove = 0;
  G.modsDirty = true;
  resetCustomers(G);
  resetWorkers(G);
  syncLayout(G, true);
  w.lowWarned = {}; w.outWarned = {};
  syncWorkers(G, true);
  G.emit('tierUp', { tier: s.tier });
  // no G.mom('tier…') here: the tier-up modal shows Má's tier line itself
  G.toast(`Chúc mừng! ${C.TIERS[s.tier - 1].name} đã mở cửa!`, 'good', 'ui_shop');
  return { ok: true, tier: s.tier };
}

// ───────────── goal hint ─────────────
export function goalHint(G) {
  const s = G.state, ti = tierInfo(G);
  if (ti.next) {
    const nt = C.TIERS[ti.next - 1];
    const levelOk = s.level >= ti.require.level, ratingOk = s.rating.avg >= ti.require.rating && s.rating.count >= 20;
    if (levelOk && ratingOk && s.money < ti.cost) return `Còn ${fmtMoney(ti.cost - s.money)} nữa là đủ tiền mở ${nt.name}!`;
    if (!ratingOk && levelOk && s.money >= ti.cost * 0.6) return `Giữ khách vui lên ${fmtRating(ti.require.rating)}★ để mở ${nt.name} nha (đang ${fmtRating(s.rating.avg)}★).`;
    if (!levelOk && s.money >= ti.cost * 0.6) return `Còn ${s.xp > 0 ? 'ít' : 'một chút'} kinh nghiệm: cần Lv ${ti.require.level} để mở ${nt.name} (đang Lv ${s.level}).`;
  }
  const q = C.MAIN_QUESTS[s.quests.main];
  if (q) return `Mục tiêu tiếp theo: ${q.text}.`;
  if (s.tier >= 5) return 'Mở chi nhánh khắp Việt Nam để thành Vua Xoài Lắc!';
  return 'Mai làm tốt hơn hôm nay nha!';
}

// ───────────── open / close / report ─────────────
export function openShop(G) {
  const s = G.state, w = G.world;
  if (!s.started) return fail('notStarted', 'Chưa bắt đầu game nha.');
  if (s.phase !== 'prep') return fail('phase', 'Quán đang mở cửa rồi.');
  deliverOrders(G);
  if (mods(G).hasQuankho) autoRestock(G, true);   // v2.6.20: only the quản kho restocks (Mối vựa trái cây removed)
  s.phase = 'open';
  s.clock = C.TIME.dayStart;
  w.tMin = 0; w.rushOn = false; w.closingFor = 0;
  startDay(G);
  dressStoves(G);
  G.emit('phase', { phase: 'open' });
  return { ok: true };
}

export function enterClosing(G) {
  const s = G.state;
  s.phase = 'closing';
  beginClosing(G);
  G.emit('phase', { phase: 'closing' });
  G.toast('Sắp đóng cửa, phục vụ nốt các bàn còn lại nha!', 'info', 'ui_clock');
}

/** Sold out mid-day (the kho only restocks in the morning): the player may close up early. */
export function closeEarly(G) {
  const s = G.state;
  if (s.phase !== 'open') return fail('phase', 'Quán đâu có đang mở mà đóng nha.');
  if (G.world.rushOn) { G.world.rushOn = false; G.emit('rush', { on: false }); }
  enterClosing(G);
  return { ok: true };
}

// ───────────── wages, wage debt, staff mood ─────────────
export function wageDebtTotal(G) {
  const s = G.state;
  let t = 0;
  for (const m of s.staff) t += m.owed || 0;
  for (const d of s.wageDebt) t += d.amount || 0;
  return round2(t);
}
export const MOOD_TEXT = (m) => { for (const [min, label, key] of C.MOOD.levels) if ((m.mood ?? C.MOOD.start) >= min) return { label, key }; return { label: C.MOOD.levels[3][1], key: 'risk' }; };
const atRisk = (m) => (m.mood ?? C.MOOD.start) < C.MOOD.warnBelow || (m.owedDays || 0) >= C.MOOD.owedQuitDays;

/** Closing: pay each person's salary from the till. Unpaid → m.owed (+ owedDays). Then mood drifts / drops and
 *  people who were warned and are still unhappy hand in their notice. Never creates money. */
function payWages(G) {
  const s = G.state, t = s.today, M = C.MOOD;
  const notes = (t.staffNotes = t.staffNotes || []);
  const ambTarget = M.base + ambienceOf(G) * M.ambienceBase + (s.upgrades.tablestyle || 0) * 2 + perkFx(G).moodBase;
  for (const m of s.staff.slice()) {
    const sal = staffSalary(G, m);
    t.costs.salary = round2((t.costs.salary || 0) + sal);           // the wage is a cost of today whether paid or owed
    const pay = Math.min(sal, Math.max(0, s.money));
    if (pay > 0) addMoney(G, -pay, 'salary');
    const short = round2(sal - pay);
    if (short > 0.005) { m.owed = round2((m.owed || 0) + short); t.salaryOwed = round2((t.salaryOwed || 0) + short); }
    if ((m.owed || 0) > 0.005) {
      m.owedDays = (m.owedDays || 0) + 1;
      m.mood = clamp((m.mood ?? M.start) - M.owedHit - M.owedPerDay * (m.owedDays - 1), 0, 100);
    } else {
      m.owedDays = 0; m.owed = 0;
      const v = m.mood ?? M.start;
      m.mood = clamp(v + (ambTarget - v) * M.drift + M.paidBonus, 0, 100);
    }
    m.mood = Math.round(m.mood);
    // notice: warn first, leave only if nothing improves for quitAfterDays closings
    if (atRisk(m)) {
      if (m.quitWarnDay == null) {
        m.quitWarnDay = s.day;
        notes.push({ id: m.id, type: 'warn', name: m.name });
        G.emit('staffWarn', { staff: m });
        G.momText('warn_' + m.id + '_' + s.day, `${m.name} nói nhỏ với Má: "${m.owed > 0 ? 'Nợ lương ' + m.owedDays + ' ngày rồi' : 'Dạo này con mệt quá'}… ${C.MOOD.quitAfterDays} hôm nữa không khá hơn là con xin nghỉ." Trả lương hoặc nói chuyện với ${m.name} trong mục Nhân viên nha con.`);
      } else if (s.day - m.quitWarnDay >= M.quitAfterDays) {
        quitStaff(G, m);
        notes.push({ id: m.id, type: 'quit', name: m.name });
      }
    } else if (m.quitWarnDay != null) {
      m.quitWarnDay = null;
      notes.push({ id: m.id, type: 'stay', name: m.name });
      G.emit('staffStay', { staff: m });
    }
  }
}
/** Quest counter: closings in a row with at least one staff member and no wage debt at all. */
function wageStreak(G) {
  const s = G.state, c = s.quests.counters;
  const clean = s.staff.length > 0 && s.staff.every((m) => !(m.owed > 0.005)) && !s.wageDebt.some((d) => d.amount > 0.005);
  c.noDebtNow = clean ? (c.noDebtNow || 0) + 1 : 0;
  c.noDebtBest = Math.max(c.noDebtBest || 0, c.noDebtNow);
}
/** Someone leaves: whatever they are still owed stays as debt to them (paid from the Nhân viên sheet). */
export function quitStaff(G, m) {
  const s = G.state;
  const i = s.staff.indexOf(m);
  if (i < 0) return;
  s.staff.splice(i, 1);
  if ((m.owed || 0) > 0.005) s.wageDebt.push({ name: m.name, role: m.role, amount: round2(m.owed), since: s.day });
  G.modsDirty = true; G.workersDirty = true;
  G.emit('staffQuit', { staff: m });
  G.toast(`${m.name} đã nghỉ việc${m.owed > 0 ? ' — quán còn nợ ' + fmtMoney(m.owed) + ' lương' : ''}.`, 'bad', 'ui_staff');
}

function payFixed(G, key, amount, label) {
  if (!(amount > 0)) return 0;
  const paid = spend(G, key, amount, key);
  if (paid + 1e-6 < amount) {
    G.momText('shortfall_' + key, `Con ơi, ${label} còn thiếu ${fmtMoney(amount - paid)}, chủ mặt bằng cho khất lần này thôi đó. Mai làm ăn khá hơn nha!`);
  }
  return paid;
}

const costSum = (t) => { let c = 0; for (const k in t.costs) c += t.costs[k]; return round2(c); };
export const dayProfit = (t) => round2(t.revenue + t.tips + t.lotteryWon - costSum(t));

/** The §6.12 report for the day described by `state.today` (pure read, safe to rebuild after a reload). */
export function buildReport(G) {
  const s = G.state, t = s.today;
  const rep = {
    day: s.day, weather: s.weather, event: s.event,
    revenue: round2(t.revenue), tips: round2(t.tips), costs: Object.assign({}, t.costs), costTotal: costSum(t), profit: dayProfit(t),
    served: t.served, angry: t.angry, lost: t.lost, fiveStars: t.fiveStars, potsSold: t.potsSold, drinksSold: t.drinksSold, sidesSold: t.sidesSold || 0, delivered: t.delivered || 0, deliveryMissed: t.deliveryMissed || 0,
    avgStars: t.rated ? t.stars / t.rated : 0,
    bestReview: s.reviews.find((r) => r.id === t.bestReviewId) || null,
    comboMax: t.comboMax, newKinds: t.newKinds.slice(),
    lottery: { tickets: t.lotteryTickets || 0, won: t.lotteryWon || 0 },
    ratingBefore: t.ratingBefore, ratingAfter: s.rating.avg, levelBefore: t.levelBefore, levelAfter: s.level,
    xpAfter: s.xp, xpNeed: xpNeed(s.level),
    forecast: forecastInfo(G), reservationsTomorrow: s.reservations.map((r) => Object.assign({}, r)),
    goalHint: '', money: s.money,
    priceLost: t.priceLost || 0, seated: t.seated || 0, supplyMiss: Object.assign({}, t.supplyMiss || {}),
    salaryOwed: round2(t.salaryOwed || 0), wageDebtTotal: wageDebtTotal(G), staffNotes: (t.staffNotes || []).slice(),
  };
  rep.goalHint = goalHint(G);
  s.report = rep;
  return rep;
}

export function finishDay(G) {
  const s = G.state, w = G.world, t = s.today;
  // leftovers: collect every pile, send everybody home, empty the stoves
  for (const tb of w.tables) if (tb.coins) collectCoins(G, tb.idx, 'staff');
  resetCustomers(G);
  for (const st of w.stoves) clearStove(st);
  resetWorkers(G);
  if (w.veso) { removeActor(G, w.veso); w.veso = null; G.emit('lotteryLady', { on: false }); }
  if (w.rushOn) { w.rushOn = false; G.emit('rush', { on: false }); }
  // lottery draw
  const tickets = s.lottery.tickets;
  let won = 0;
  for (let i = 0; i < tickets; i++) for (const p of C.LOTTERY.prizes) if (G.rng.chance(p.chance)) { won += p.amount; break; }
  if (won > 0) addMoney(G, won, 'lottery');
  t.lotteryWon = won; t.lotteryTickets = tickets;
  s.lottery.tickets = 0;
  // fixed costs: wages person by person (what the till cannot cover becomes wage debt), then rent
  payWages(G);
  wageStreak(G);
  payFixed(G, 'rent', tierDef(G).rent, 'tiền thuê mặt bằng');
  // lifetime stats
  const profit = dayProfit(t);
  const st = s.stats;
  st.daysPlayed++;
  st.bestDayRevenue = Math.max(st.bestDayRevenue, t.revenue);
  st.bestDayProfit = Math.max(st.bestDayProfit, profit);
  st.avgDayProfit = st.daysPlayed <= 1 ? profit : round2(st.avgDayProfit * 0.7 + profit * 0.3);
  s.usageYesterday = Object.assign({}, t.usage);
  s.supplyUseYesterday = Object.assign({}, t.supplyUse);
  s.soldOutYesterday = !!t.soldOut;            // sold out → yesterday's usage undercounts demand
  // tomorrow
  if (s.viral.days > 0) { s.viral.days--; if (s.viral.days <= 0) s.viral = { days: 0, mult: 1 }; }
  rollMarket(G);
  makeReservations(G);
  const rep = buildReport(G);
  s.phase = 'report';
  G.emit('phase', { phase: 'report' });
  G.emit('dayEnd', { report: rep });
  return rep;
}

export function startNextDay(G) {
  const s = G.state, w = G.world;
  if (s.phase !== 'report') return fail('phase', 'Chưa hết ngày mà nha.');
  autoClaimDailies(G);
  s.day++;
  s.clock = C.TIME.dayStart;
  s.phase = 'prep';
  s.weather = s.forecast.weather; s.event = s.forecast.event;
  s.forecast = { weather: rollWeather(G, s.weather), event: rollEvent(G) };
  s.boost = s.nextBoost || 1; s.nextBoost = 1;
  for (const k in s.marketingToday) s.marketingToday[k] = false;
  s.today = newToday();
  s.today.ratingBefore = s.rating.avg; s.today.levelBefore = s.level;
  s.report = null;
  syncLots(G);
  expireStock(G);                                  // past-date portions go in the bin before the market opens
  deliverOrders(G);                                // the vựa's truck / evening orders arrive in the morning
  w.lowWarned = {}; w.outWarned = {};
  resetCustomers(G);
  resetWorkers(G);
  syncWorkers(G, true);
  rollDaily(G);
  genCandidates(G);
  if (s.weather === 'rain') G.mom('rain');
  if (s.weather === 'cold') G.mom('cold');
  G.emit('phase', { phase: 'prep' });
  G.emit('dayStart', { day: s.day, weather: s.weather, event: s.event, reservations: s.reservations.map((r) => Object.assign({}, r)) });
  return { ok: true };
}

// ───────────── marketing ─────────────
export function buyMarketing(G, id) {
  const s = G.state, def = MARKETING_BY_ID[id];
  if (!def) return fail('unknown', 'Không có hình thức quảng bá này.');
  if (s.phase !== 'prep') return fail('phase', 'Quảng bá được vào buổi sáng thôi nha.');
  if (s.level < def.unlockLv) return fail('locked', `${def.name} mở ở Lv ${def.unlockLv} nha!`);
  if (s.marketingToday[id]) return fail('done', 'Hôm nay làm rồi nha.');
  const cost = def.cost * (def.scale ? TM(G) : 1);
  if (s.money + 1e-9 < cost) return fail('money', `Cần ${fmtMoney(cost)} để ${def.name.toLowerCase()} nha.`);
  spend(G, 'marketing', cost, 'marketing');
  s.marketingToday[id] = true;
  if (def.xp) addXp(G, def.xp);
  counter(G, 'marketing:' + id, 1);
  G.toast(`Đã ${def.name.toLowerCase()}! ${def.desc}`, 'good', def.icon);
  return { ok: true, cost };
}

// ───────────── reservations (P2) ─────────────
export function makeReservations(G) {
  const s = G.state, rng = G.rng;
  s.reservations = [];
  if (!featureUnlocked(G, 'reservations')) return;
  const nT = builtTables(G);
  const n = Math.min(Math.floor(nT / 2), rng.int(0, 1 + Math.floor(s.tier / 2)));
  const pots = C.HOTPOTS.filter((p) => s.menu[p.id] && isPotUnlocked(G, p.id) && p.price >= 99);
  if (!pots.length) return;
  const idxs = [];
  for (let i = 0; i < nT; i++) idxs.push(i);
  rng.shuffle(idxs);
  for (let i = 0; i < n; i++) {
    const kind = rng.pick(['giadinh', 'capdoi', 'hoiban', 'vanphong']);
    const k = C.CUSTOMERS[kind];
    s.reservations.push({ id: i + 1, kind, size: rng.int(k.group[0], k.group[1]), pot: rng.pick(pots).id, clock: Math.round(rng.range(17.5 * 60, 20.5 * 60) / 10) * 10, tableIdx: idxs[i], status: 'pending' });
  }
  s.reservations.sort((a, b) => a.clock - b.clock);
}

/** Hold tables shortly before a booking, then seat the party at the booked time. */
export function tickReservations(G, dtMin) {
  const s = G.state, w = G.world;
  if (s.phase !== 'open' || !s.reservations.length) return;
  for (const r of s.reservations) {
    if (r.status === 'pending' && s.clock >= r.clock - (w.layout && w.layout.counter ? 6 : 30)) {
      let tb = w.tables[r.tableIdx];
      if (!tb || tb.status !== 'free' || tb.reserved) tb = w.tables.find((x) => x.status === 'free' && !x.reserved);
      if (tb) { tb.reserved = true; r.tableIdx = tb.idx; r.status = 'held'; }
    }
    if (r.status === 'pending' && s.clock >= r.clock) { r.status = 'missed'; G.toast('Khách đặt bàn trước không có chỗ, đành hẹn lần sau…', 'bad', 'ui_reserve'); }
    if (r.status === 'held' && s.clock >= r.clock) {
      const g = spawnGroup(G, r.kind, { size: r.size, pot: r.pot, reservation: r });
      const tb = w.tables[r.tableIdx];
      if (tb) tb.reserved = false;
      r.status = g ? 'seated' : 'missed';
      if (g) G.toast('Khách đặt bàn trước đã tới!', 'good', 'ui_reserve');
    }
  }
}

// ───────────── lottery lady (P2) ─────────────
export function updateLottery(G, dtMin) {
  const s = G.state, w = G.world, L = w.layout, LT = C.LOTTERY;
  if (!w.veso) {
    if (s.phase !== 'open' || !featureUnlocked(G, 'lottery') || s.clock > C.TIME.lastSeat - 60) return;
    if (!G.rng.chance(LT.visitChancePerHour * dtMin / 60)) return;
    const sp = L.spawn[G.rng.int(0, L.spawn.length - 1)];
    const left = sp.x < L.w / 2;
    const stand = { x: left ? Math.max(24, sp.x + 44) : Math.min(L.w - 24, sp.x - 44), y: L.lane.y };
    const a = makeActor(G, { type: 'veso', kind: 'veso', lookSeed: G.rng.int(1, 9999), x: sp.x, y: sp.y, speed: 12, facing: left ? 'right' : 'left', pose: 'walk' });
    a.stand = stand; a.leaving = false;
    setPath(a, route(L, { x: sp.x, y: sp.y }, stand));
    w.veso = a; w.vesoLeft = 20;
    G.emit('lotteryLady', { on: true });
    return;
  }
  const a = w.veso;
  if (a.path) { stepActor(L, a, dtMin); a.pose = 'walk'; return; }
  if (a.leaving) { removeActor(G, a); w.veso = null; G.emit('lotteryLady', { on: false }); return; }
  a.pose = 'idle';
  w.vesoLeft -= dtMin;
  if (w.vesoLeft <= 0 || s.phase !== 'open') {
    a.leaving = true;
    const ex = L.spawn[Math.abs(L.spawn[0].x - a.x) <= Math.abs(L.spawn[L.spawn.length - 1].x - a.x) ? 0 : L.spawn.length - 1];
    setPath(a, route(L, { x: a.x, y: a.y }, { x: ex.x, y: ex.y }));
    a.pose = 'walk';
  }
}

export function buyLottery(G) {
  const s = G.state, w = G.world, LT = C.LOTTERY;
  if (!featureUnlocked(G, 'lottery')) return fail('locked', `Vé số mở ở Lv ${C.FEATURES.lottery} nha!`);
  if (!w.veso || w.veso.leaving || w.veso.path) return fail('noLady', 'Cô bán vé số đi mất rồi.');
  if (s.lottery.tickets >= LT.maxPerDay) return fail('max', `Mỗi ngày mua tối đa ${LT.maxPerDay} tờ thôi nha.`);
  if (s.money + 1e-9 < LT.ticketPrice) return fail('money', `Vé số ${fmtMoney(LT.ticketPrice)} một tờ, chưa đủ tiền nha.`);
  spend(G, 'lottery', LT.ticketPrice, 'lottery');
  s.lottery.tickets++;
  G.toast(`Mua 1 vé số (${s.lottery.tickets}/${LT.maxPerDay}). Tối nay dò kết quả nghen!`, 'info', 'ui_ticket');
  return { ok: true, tickets: s.lottery.tickets };
}

// ───────────── branches (P2) ─────────────
const branchRate = (G) => {
  let r = 0;
  for (const b of C.BRANCHES) r += b.income * (G.state.branches[b.id] || 0);
  return r * C.branchScale(G.state);
};
export function updateBranches(G, dtReal) {
  const s = G.state, w = G.world;
  if (s.tier < 5) return;
  const r = branchRate(G);
  if (r <= 0) return;
  w.branchAcc += r * dtReal;
  w.branchAccT += dtReal;
  if (w.branchAccT >= 1) {
    addMoney(G, w.branchAcc, 'branch');
    w.branchAcc = 0; w.branchAccT = 0;
  }
}
function checkEnding(G) {
  const s = G.state;
  if (s.ended) return;
  if (C.BRANCHES.filter((b) => !b.bonus).every((b) => s.branches[b.id] > 0)) {
    s.ended = true;
    G.mom('ending');
    G.emit('ending', {});
  }
}
export function openBranch(G, id) {
  const s = G.state, b = BRANCH_BY_ID[id];
  if (!b) return fail('unknown', 'Không có chi nhánh này.');
  if (s.tier < 5) return fail('tier', 'Mở Chuỗi Xoài Lắc Nhà Mình rồi mới mở chi nhánh được nha!');
  if (s.branches[id] > 0) return fail('opened', 'Chi nhánh này mở rồi nha.');
  if (b.minLevel && s.level < b.minLevel) return fail('locked', `Chi nhánh ${b.name} mở ở Lv ${b.minLevel} nha.`);
  if (s.money + 1e-9 < b.cost) return fail('money', `Mở chi nhánh ${b.name} cần ${fmtMoney(b.cost)} nha.`);
  addMoney(G, -b.cost, 'branch');
  s.branches[id] = 1;
  G.toast(`Chi nhánh ${b.name} khai trương! "${b.dish}" đã lên menu.`, 'good', 'ui_map');
  checkEnding(G);
  return { ok: true };
}
export function upgradeBranch(G, id) {
  const s = G.state, b = BRANCH_BY_ID[id];
  if (!b) return fail('unknown', 'Không có chi nhánh này.');
  const lvl = s.branches[id] || 0;
  if (lvl <= 0) return fail('closed', 'Mở chi nhánh trước đã nha.');
  if (lvl >= branchMaxLevel(G)) return fail('max', 'Chi nhánh đã tối đa rồi nha.');
  const cost = C.BRANCH.upgradeCost(b, lvl);
  if (s.money + 1e-9 < cost) return fail('money', `Nâng cấp cần ${fmtMoney(cost)} nha.`);
  addMoney(G, -cost, 'branch');
  s.branches[id] = lvl + 1;
  G.toast(`Chi nhánh ${b.name} lên cấp ${lvl + 1}!`, 'good', 'ui_up');
  return { ok: true, level: lvl + 1 };
}

// ───────────── offline ─────────────
export function offlineEarnings(G, awaySec) {
  const s = G.state, O = C.OFFLINE;
  if (!s.started || awaySec < O.minAwaySec) return 0;
  let money = 0;
  if (mods(G).hasWaiter && mods(G).hasChef && s.stats.avgDayProfit > 0) {
    money += s.stats.avgDayProfit * O.shopShare * Math.min(awaySec, O.shopCapSec) / O.daySec;
  }
  money += branchRate(G) * Math.min(awaySec, O.chainCapSec);
  return round2(money);
}
