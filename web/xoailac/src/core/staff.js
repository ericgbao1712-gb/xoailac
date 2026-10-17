// Hiring board, candidates, staff levelling (TECH_SPEC §6.6).
import * as C from '../config.js';
import { clamp } from './util.js';
import { fmtMoney } from './format.js';
import { dirtyMods, staffSalary, spend, tierDef, addMoney, featureUnlocked, perkFx } from './economy.js';
import { round2 } from './util.js';

const SC = C.STAFF;
const ROLE_BIAS = { phucvu: [1.4, 0.7, 1.2], daubep: [1.1, 1.6, 0.5], thungan: [0.8, 0.8, 1.6], quankho: [1, 1.2, 0.8] };
const fail = (reason, msg) => ({ ok: false, reason, msg });

export const roleUnlocked = (G, role) => !!SC.roles[role] && G.state.level >= SC.roles[role].unlockLv && G.state.tier >= SC.roles[role].minTier;
export const staffSlots = (G) => ({ used: G.state.staff.length, max: SC.slotsByTier[G.state.tier - 1] });
export const roleCount = (G, role) => G.state.staff.filter((m) => m.role === role).length;
export const candidatesOf = (G, role) => G.state.candidates.list.filter((c) => c.role === role);

function genCandidate(G, role, minRarity = 1) {
  const rng = G.rng, s = G.state;
  const rarity = rng.weighted([1, 2, 3, 4, 5], (r) => (r < minRarity ? 0 : SC.rarityWeights[r - 1])) || minRarity;
  const points = Math.max(3, SC.rarityPoints[rarity - 1] + rng.int(-2, 2));
  const st = [1, 1, 1];
  const bias = ROLE_BIAS[role] || [1, 1, 1];
  for (let left = points - 3; left > 0; left--) {
    const i = rng.weighted([0, 1, 2], (k) => (st[k] < 10 ? bias[k] : 0));
    if (i === undefined) break;
    st[i]++;
  }
  const lookSeed = rng.int(1, 999999);
  return {
    cid: s.nextCid++, role, name: rng.pick(SC.names), rarity, spd: st[0], skl: st[1], chm: st[2],
    trait: rng.chance(SC.traitChance) ? rng.pick(SC.traits).id : null,
    lvl: 1, jobs: 0, look: { lookSeed }, lookSeed, hiredDay: 0,
  };
}

/** Morning regeneration (all roles) and top-up when a role unlocks mid-run. */
export function genCandidates(G, force = false) {
  const s = G.state;
  if (force || s.candidates.day !== s.day) s.candidates = { day: s.day, list: [] };
  for (const role of Object.keys(SC.roles)) {
    if (!roleUnlocked(G, role)) continue;
    const have = candidatesOf(G, role).length;
    for (let i = have; i < 3; i++) s.candidates.list.push(genCandidate(G, role));
  }
}

export function refreshCandidates(G, role) {
  const s = G.state;
  if (!roleUnlocked(G, role)) return fail('locked', 'Vị trí này chưa mở nha.');
  let minR = 1, free = false;
  if (s.staffTickets > 0) { free = true; minR = 3; }
  else {
    const cost = SC.refreshCost(s.tier);
    if (s.money + 1e-9 < cost) return fail('money', `Làm mới cần ${fmtMoney(cost)} nha.`);
    spend(G, 'salary', cost, 'refresh');
  }
  if (free) s.staffTickets--;
  s.candidates.list = s.candidates.list.filter((c) => c.role !== role);
  for (let i = 0; i < 3; i++) s.candidates.list.push(genCandidate(G, role, minR));
  return { ok: true, usedTicket: free };
}

export function hire(G, role, idx) {
  const s = G.state;
  if (!SC.roles[role]) return fail('unknown', 'Không có vị trí này.');
  if (!roleUnlocked(G, role)) return fail('locked', `${SC.roles[role].name} mở ở Lv ${SC.roles[role].unlockLv}${SC.roles[role].minTier > s.tier ? ' và quán lớn hơn' : ''} nha!`);
  const list = candidatesOf(G, role);
  const cand = typeof idx === 'string' ? list.find((c) => String(c.cid) === idx) : list[idx];
  if (!cand) return fail('none', 'Chọn một ứng viên nha.');
  if (roleCount(G, role) >= SC.roles[role].max) return fail('roleMax', `Quán chỉ cần ${SC.roles[role].max} ${SC.roles[role].name.toLowerCase()} thôi nha.`);
  const sl = staffSlots(G);
  if (sl.used >= sl.max) return fail('slots', 'Hết chỗ rồi, mở rộng quán để thuê thêm nha.');
  const debt = owedTotal(G);
  if (debt > 0.005) return fail('debt', `Quán đang nợ lương ${fmtMoney(debt)} — trả hết nợ rồi mới có người chịu vào làm nha.`);
  const fee = staffSalary(G, cand) * SC.hireFeeDays;
  if (s.money + 1e-9 < fee) return fail('money', `Cần ${fmtMoney(fee)} (lương 1 ngày) để thuê nha.`);
  spend(G, 'salary', fee, 'hire');
  const m = { id: s.nextStaffId++, name: cand.name, role, rarity: cand.rarity, spd: cand.spd, skl: cand.skl, chm: cand.chm, trait: cand.trait,
    lvl: 1, jobs: 0, look: { lookSeed: cand.lookSeed }, lookSeed: cand.lookSeed, hiredDay: s.day,
    mood: C.MOOD.start, owed: 0, owedDays: 0, quitWarnDay: null, talkDay: 0, bonusDay: 0 };
  s.staff.push(m);
  s.candidates.list = s.candidates.list.filter((c) => c !== cand);
  dirtyMods(G);
  G.workersDirty = true;
  G.counter('hire:' + role, 1);
  G.counter('staffHired', 1);
  G.mom('firstStaff');
  G.emit('hired', { staff: m });
  G.toast(`${m.name} đã vào làm ${SC.roles[role].name.toLowerCase()}!`, 'good', SC.roles[role].icon);
  return { ok: true, staff: m, fee };
}

export function fire(G, staffId) {
  const s = G.state;
  const i = s.staff.findIndex((m) => m.id === staffId || String(m.id) === String(staffId));
  if (i < 0) return fail('none', 'Không tìm thấy nhân viên này.');
  const [m] = s.staff.splice(i, 1);
  if ((m.owed || 0) > 0.005) s.wageDebt.push({ name: m.name, role: m.role, amount: round2(m.owed), since: s.day });   // still owed
  dirtyMods(G);
  G.workersDirty = true;
  G.toast(`Đã cho ${m.name} nghỉ việc${m.owed > 0 ? ' (vẫn còn nợ ' + fmtMoney(m.owed) + ' lương)' : ''}.`, 'info', 'ui_staff');
  return { ok: true };
}

/** One completed task. Levels the member up when the job threshold is reached. */
export function staffJob(G, m) {
  m.jobs = (m.jobs || 0) + perkFx(G).staffXp;     // Lv 39 Thợ lắc bậc thầy
  if (m.lvl >= 10) return;
  let need = SC.levelXp[m.lvl - 1];
  if (m.trait === 'chamchi') need *= 2;
  if (m.jobs < need) return;
  m.lvl++;
  const stats = ['spd', 'skl', 'chm'];
  let low = null;
  for (const k of stats) if (m[k] < 10 && (low === null || m[k] < m[low])) low = k;
  if (low) m[low] = clamp(m[low] + 1, 1, 10);
  G.emit('staffLevel', { staff: m, stat: low });
  G.toast(`${m.name} lên cấp ${m.lvl}!`, 'good', 'ui_up');
}

// ───────────── wage debt & keeping people (v2) ─────────────
const findStaff = (G, id) => G.state.staff.find((m) => m.id === id || String(m.id) === String(id)) || null;
export function owedTotal(G) {
  let t = 0;
  for (const m of G.state.staff) t += m.owed || 0;
  for (const d of G.state.wageDebt) t += d.amount || 0;
  return round2(t);
}
function maybeCalm(G, m) {
  const M = C.MOOD;
  if (m.quitWarnDay != null && (m.mood ?? 0) >= M.warnBelow + 5 && (m.owedDays || 0) < M.owedQuitDays && !(m.owed > 0.005 && m.owedDays >= M.owedQuitDays)) {
    m.quitWarnDay = null;
    G.emit('staffStay', { staff: m });
    G.toast(`${m.name} quyết định ở lại làm tiếp!`, 'good', 'ui_heart');
  }
}
/** Pay back wage debt to a current staff member. amount: number (k) | 'all'. Paying never goes below 0 money. */
export function payStaffDebt(G, id, amount = 'all') {
  const s = G.state, m = findStaff(G, id);
  if (!m) return fail('none', 'Không tìm thấy nhân viên này.');
  if (!((m.owed || 0) > 0.005)) return fail('none', `Quán không nợ ${m.name} đồng nào.`);
  let want = amount === 'all' ? m.owed : Math.min(m.owed, Math.max(0, Number(amount) || 0));
  want = round2(Math.min(want, s.money));
  if (want <= 0) return fail('money', 'Trong két chưa có tiền để trả nha.');
  addMoney(G, -want, 'wagedebt');
  s.today.debtPaid = round2((s.today.debtPaid || 0) + want);
  m.owed = round2(m.owed - want);
  const sal = staffSalary(G, m);
  m.mood = Math.min(100, Math.round((m.mood ?? C.MOOD.start) + C.MOOD.payBackGain * Math.min(3, want / Math.max(1, sal))));
  if (m.owed <= 0.005) { m.owed = 0; m.owedDays = 0; }
  maybeCalm(G, m);
  G.emit('staffMood', { staff: m });
  G.toast(m.owed > 0 ? `Đã trả ${m.name} ${fmtMoney(want)}, còn nợ ${fmtMoney(m.owed)}.` : `Đã trả hết nợ lương cho ${m.name}!`, 'good', 'ui_coin');
  return { ok: true, paid: want, left: m.owed };
}
/** Pay someone who already left (state.wageDebt[idx]). */
export function payOldDebt(G, idx) {
  const s = G.state, d = s.wageDebt[idx];
  if (!d) return fail('none', 'Không có khoản nợ này.');
  const pay = round2(Math.min(d.amount, s.money));
  if (pay <= 0) return fail('money', 'Trong két chưa có tiền để trả nha.');
  addMoney(G, -pay, 'wagedebt');
  s.today.debtPaid = round2((s.today.debtPaid || 0) + pay);
  d.amount = round2(d.amount - pay);
  if (d.amount <= 0.005) s.wageDebt.splice(idx, 1);
  G.toast(d.amount > 0.005 ? `Đã trả ${d.name} ${fmtMoney(pay)}, còn nợ ${fmtMoney(d.amount)}.` : `Đã trả đủ lương cho ${d.name}.`, 'good', 'ui_coin');
  return { ok: true, paid: pay };
}
const TALK_OK = {
  owed: ['"Dạ, con hiểu quán đang kẹt. Con ráng thêm vài bữa nha chị."', '"Chị nói vậy thì con yên tâm. Có lương sớm sớm giùm con nha."'],
  fine: ['"Làm ở đây vui mà chị! Mai con đi sớm phụ chị bày hàng."', '"Dạ con ổn, khách dễ thương lắm."'],
};
const TALK_NO = {
  owed: ['"Nói hoài mà lương thì chưa thấy đâu hết chị ơi…"', '"Con cũng phải đóng tiền trọ nữa chị…"'],
  fine: ['"Dạ… con chỉ hơi mệt thôi."', '"Thôi chị để con làm cho xong đã."'],
};
/** Talk to someone: free, once a day, may or may not help (worse odds while they are owed money). */
export function talkStaff(G, id) {
  const s = G.state, m = findStaff(G, id), T = C.MOOD.talk;
  if (!m) return fail('none', 'Không tìm thấy nhân viên này.');
  if (m.talkDay === s.day) return fail('done', `Hôm nay nói chuyện với ${m.name} rồi, để mai nha.`);
  m.talkDay = s.day;
  G.counter('talkStaff', 1);
  const owed = (m.owed || 0) > 0.005;
  const p = Math.max(0.1, Math.min(0.9, T.chance - T.owedPenalty * (m.owedDays || 0) - ((m.mood ?? 70) < C.MOOD.warnBelow ? T.lowMoodPenalty : 0)));
  const ok = G.rng.chance(p);
  // talking cannot replace pay: while owed, a good talk lifts the mood to 60 at most
  const cap = owed ? 60 : 100;
  if (ok) m.mood = Math.max(m.mood ?? 70, Math.min(cap, Math.round((m.mood ?? 70) + T.gain)));
  else m.mood = Math.max(0, Math.round((m.mood ?? 70) + T.fail));
  const line = G.rng.pick((ok ? TALK_OK : TALK_NO)[owed ? 'owed' : 'fine']);
  maybeCalm(G, m);
  G.emit('staffMood', { staff: m });
  return { ok: true, success: ok, chance: p, line, mood: m.mood };
}
/** A cash bonus (50 % of a day's salary): likely but not certain to cheer them up. Once a day per person. */
export function bonusStaff(G, id) {
  const s = G.state, m = findStaff(G, id), B = C.MOOD.bonus;
  if (!m) return fail('none', 'Không tìm thấy nhân viên này.');
  if (!featureUnlocked(G, 'staffBonus')) return fail('locked', `Thưởng nóng mở ở Lv ${C.FEATURES.staffBonus} nha.`);
  if (m.bonusDay === s.day) return fail('done', `Hôm nay thưởng ${m.name} rồi nha.`);
  const cost = Math.max(1, Math.round(staffSalary(G, m) * B.mult));
  if (s.money + 1e-9 < cost) return fail('money', `Thưởng cần ${fmtMoney(cost)} nha.`);
  spend(G, 'salary', cost, 'bonus');
  m.bonusDay = s.day;
  G.counter('bonusStaff', 1);
  const p = Math.max(0.2, Math.min(0.95, B.chance - B.owedPenalty * (m.owedDays || 0)));
  const ok = G.rng.chance(p);
  m.mood = Math.min(100, Math.round((m.mood ?? 70) + (ok ? B.gain : B.failGain)));
  maybeCalm(G, m);
  G.emit('staffMood', { staff: m });
  const line = ok ? `"Ủa thưởng hả chị? Cảm ơn chị nhiều nha!"` : `"Dạ cảm ơn chị… mà chị trả lương con trước được không?"`;
  return { ok: true, success: ok, chance: p, cost, line, mood: m.mood };
}
