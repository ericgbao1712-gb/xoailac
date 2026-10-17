// Sheet 4 — Nhân viên: my team + hiring board per role.
import { h, div, span, ico } from '../dom.js';
import { ctx, act, G, S, sfx } from '../ctx.js';
import * as D from '../data.js';
import * as C from '../../config.js';
import { fmtShort, fmtMoney } from '../../core/format.js';
import { uniformCard } from '../looks.js';
import { secTitle, noteBox, celebrate, floatAt, costBtn, stars, statRow, portrait, lockCard } from './common.js';

const SC = C.STAFF;
const roleIcon = (r) => 'role_' + r;
const traitOf = (id) => SC.traits.find((t) => t.id === id) || null;
const STAT = [['spd', 'Nhanh nhẹn'], ['skl', 'Tay nghề'], ['chm', 'Dễ thương']];

const MOOD_ICON = { good: 'emo_love', ok: 'emo_yum', bad: 'emo_sweat', risk: 'emo_angry' };
/** Mood, wage debt and the three ways to keep someone: pay back, talk, bonus. */
function moodBox(m, api) {
  const md = G().get?.staffMood?.(m);
  if (!md) return div('');
  const box = div('mood-box mood-' + md.band);
  box.appendChild(div('mood-top', ico(MOOD_ICON[md.band] || 'emo_yum', 32, 'mood-ico'),
    div('grow', div('mood-l', h('b', null, md.label), span('muted sm', md.mood + '/100')),
      div('bar thin noshine ' + (md.band === 'good' ? 'leaf' : md.band === 'ok' ? 'jade' : 'red'), h('i', { style: { '--p': md.mood } })))));
  if (md.owed > 0) box.appendChild(div('mood-debt', ico('ui_coin', 16), span('', `Quán còn nợ ${fmtShort(md.owed)} lương (${md.owedDays} ngày)`)));
  if (md.warned) box.appendChild(div('mood-warn', ico('emo_exclaim', 16), span('', md.leavesIn > 0 ? `${m.name} định nghỉ việc sau ${md.leavesIn} lần đóng cửa nữa nếu không khá hơn!` : `${m.name} sẽ nghỉ tối nay nếu không khá hơn!`)));
  const say = div('mood-say');
  const row = div('mood-act');
  if (md.owed > 0) {
    const all = h('button', { class: 'btn red sm' }, 'Trả nợ ' + fmtShort(Math.min(md.owed, S().money)));
    if (S().money <= 0) all.classList.add('off');
    all.addEventListener('click', () => { const r = act('payStaffDebt', m.id, 'all'); if (r.ok === false) return; celebrate(all, { sound: 'cash' }); ctx.flashMoney?.(); api.rerender(); });
    row.appendChild(all);
  }
  const talk = h('button', { class: 'btn paper sm' + (md.talked ? ' off' : '') }, md.talked ? 'Đã nói chuyện' : 'Nói chuyện');
  talk.addEventListener('click', () => {
    const r = act('talkStaff', m.id); if (r.ok === false) return;
    sfx(r.success ? 'sparkle' : 'error');
    ctx.toast(`${m.name}: ${r.line}`, r.success ? 'good' : 'info', r.success ? 'emo_love' : 'emo_sweat');
    api.rerender();
  });
  const bonusOn = D.featureOn('staffBonus');
  const bonus = h('button', { class: 'btn jade sm cost' + (!bonusOn || md.bonused || S().money < md.bonusCost ? ' off' : '') },
    span('lb', !bonusOn ? `Thưởng (Lv ${C.FEATURES.staffBonus})` : md.bonused ? 'Đã thưởng' : 'Thưởng'), !bonusOn || md.bonused ? null : span('pr', ico('ui_coin', 16), span('num', fmtShort(md.bonusCost))));
  bonus.addEventListener('click', () => {
    const r = act('bonusStaff', m.id); if (r.ok === false) return;
    celebrate(bonus, { sound: r.success ? 'cash' : null });
    ctx.toast(`${m.name}: ${r.line}`, r.success ? 'good' : 'info', 'ui_gift');
    api.rerender();
  });
  row.append(talk, bonus);
  box.append(row, say);
  return box;
}

function personCard(m, { hired = false, onFire, hireBtn, idx = 0, api = null } = {}) {
  const apiRef = api;
  const t = traitOf(m.trait);
  const card = div(`card person rar${m.rarity}` + (m.rarity >= 4 ? ' shimmer' : ''));
  card.appendChild(div('pe-top',
    div('pe-pic', portrait(D.staffLook(m), 56)),
    div('pe-id', div('pe-name', h('b', null, m.name), hired ? span('chip lvc', 'Cấp ' + (m.lvl || 1)) : null),
      div('pe-role', ico(roleIcon(m.role), 16), span('', SC.roles[m.role]?.name || m.role)),
      stars(m.rarity, 5, 16, 'gold'),
      t ? div('trait', span('chip gold', t.name), span('muted', t.desc)) : div('trait', span('muted', 'Chưa có đặc điểm riêng')))));
  const stats = div('pe-stats');
  STAT.forEach(([k, label]) => stats.appendChild(statRow(label, m[k] || 1, 10, k === 'spd' ? 'sky' : k === 'skl' ? 'red' : 'jade')));
  card.appendChild(stats);
  const bot = div('pe-bot');
  if (hired) {
    const lvl = m.lvl || 1;
    const need = lvl >= 10 ? null : SC.levelXp[lvl - 1] * (m.trait === 'chamchi' ? 2 : 1);
    const prev = lvl <= 1 ? 0 : SC.levelXp[lvl - 2] * (m.trait === 'chamchi' ? 2 : 1);
    const pct = need == null ? 100 : Math.max(0, Math.min(100, (((m.jobs || 0) - prev) / Math.max(1, need - prev)) * 100));
    bot.appendChild(div('xpw', div('bar thin leaf', h('i', { style: { '--p': pct } })), span('muted sm', need == null ? 'Cấp tối đa' : `Lên cấp ${lvl + 1}: ${m.jobs || 0}/${need} việc`)));
    bot.appendChild(div('sal', span('muted sm', 'Lương'), span('num', fmtShort(D.salaryOf(m)) + '/ngày')));
    const fire = h('button', { class: 'btn dark sm', 'aria-label': 'Cho ' + m.name + ' nghỉ việc' }, 'Cho nghỉ');
    fire.addEventListener('click', () => { sfx('click'); onFire?.(); });
    bot.appendChild(fire);
    card.appendChild(moodBox(m, apiRef));
  } else {
    bot.appendChild(div('sal', span('muted sm', 'Lương'), span('num', fmtShort(m.salary ?? D.salaryOf(m)) + '/ngày')));
    if (hireBtn) bot.appendChild(hireBtn);
  }
  card.appendChild(bot);
  return card;
}

function teamView(body, api) {
  const s = S();
  const slots = G().get?.staffSlots?.() || { used: s.staff.length, max: SC.slotsByTier[D.tierNow() - 1] };
  const total = G().get?.salaryTotal?.() ?? s.staff.reduce((a, m) => a + D.salaryOf(m), 0);
  const debt = G().get?.wageDebt?.() || 0;
  body.appendChild(div('card sum',
    div('sum-c', span('muted sm', 'Chỗ làm'), span('num', `${slots.used}/${slots.max}`)),
    div('sum-c', span('muted sm', 'Lương mỗi ngày'), span('num', fmtShort(total))),
    debt > 0 ? div('sum-c debt', span('muted sm', 'Đang nợ lương'), span('num', fmtShort(debt))) : div('sum-c', span('muted sm', 'Vé tuyển ★3+'), span('num', String(s.staffTickets || 0)))));
  if (debt > 0) body.appendChild(noteBox('ui_coin', 'Lương trả lúc **đóng cửa**. Két không đủ thì thành **nợ lương**: nhân viên buồn, làm chậm, nợ lâu sẽ **xin nghỉ**. Còn nợ thì **không thuê được người mới**.', 'red'));
  else if (s.staff.length) body.appendChild(noteBox('ui_heart', 'Lương trả tự động lúc đóng cửa. Quán đẹp, trả lương đúng hạn thì nhân viên vui và làm nhanh hơn.', ''));
  (s.wageDebt || []).forEach((d, i) => {
    const b = h('button', { class: 'btn red sm' + (s.money > 0 ? '' : ' off') }, 'Trả ' + fmtShort(Math.min(d.amount, s.money)));
    b.addEventListener('click', () => { const r = act('payOldDebt', i); if (r.ok === false) return; celebrate(b, { sound: 'cash' }); api.rerender(); });
    body.appendChild(div('card row', ico('role_' + (d.role || 'phucvu'), 32), div('grow', h('b', null, d.name + ' (đã nghỉ)'), span('muted sm', 'Quán còn nợ ' + fmtMoney(d.amount) + ' lương')), b));
  });

  if (D.featureOn('manageMode')) {
    const mode = s.ownerMode === 'manage' ? 'manage' : 'work';
    const seg = (id, label, icon) => {
      const b = h('button', { class: 'seg' + (mode === id ? ' on' : ''), 'aria-pressed': String(mode === id) }, ico(icon, 16), span('', label));
      b.addEventListener('click', () => { if (mode === id) return; sfx('click'); const r = act('setOwnerMode', id); if (r.ok !== false) api.rerender(); });
      return b;
    };
    body.appendChild(div('card mode',
      div('seg-row', seg('work', 'Làm việc', 'ui_fire'), seg('manage', 'Quản lý', 'ui_review')),
      h('p', null, mode === 'manage' ? 'Bạn đứng ghi sổ, cả quán nhanh hơn 10%. Nhớ có đủ thợ lắc và phục vụ nha.' : 'Bạn tự tay lắc xoài và bưng bê cùng nhân viên.')));
  }

  if ((s.level || 1) >= C.UNIFORM.lv - 4) body.appendChild(uniformCard(api));
  body.appendChild(secTitle('Đội của mình', s.staff.length ? s.staff.length + ' người' : null));
  if (!s.staff.length) {
    body.appendChild(div('card empty-card', ico('ui_staff', 48), h('b', null, 'Chưa có ai phụ quán'), h('p', null, 'Thuê Phục vụ để có người bưng xoài và thu tiền, bạn rảnh tay lắc.')));
    return;
  }
  s.staff.forEach((m) => {
    body.appendChild(personCard(m, {
      hired: true, api,
      onFire: () => ctx.confirm({
        title: `Cho ${m.name} nghỉ?`, text: 'Bạn sẽ không được hoàn lại tiền thuê, và phải trả công tuyển người mới nha.', yes: 'Cho nghỉ', no: 'Giữ lại', danger: true, icon: 'role_' + m.role,
        onYes: () => { const r = act('fire', m.id); if (r.ok !== false) api.rerender(); },
      }),
    }));
  });
}

function hireView(body, api, role) {
  const s = S();
  const def = SC.roles[role];
  if (!D.roleUnlocked(role)) {
    const tierTxt = def.minTier > D.tierNow() ? ` và mở ${C.TIERS[def.minTier - 1].name}` : '';
    body.appendChild(lockCard(def.name, `Mở ở Lv ${def.unlockLv}${tierTxt}.`, roleIcon(role)));
    return;
  }
  D.markSeen('role:' + role);
  const slots = G().get?.staffSlots?.() || { used: s.staff.length, max: SC.slotsByTier[D.tierNow() - 1] };
  const have = D.staffCount(role);
  const full = slots.used >= slots.max;
  const roleFull = have >= def.max;
  body.appendChild(div('card role-head',
    ico(roleIcon(role), 48),
    div('grow', h('b', null, def.name), h('p', null, def.desc), span('muted sm', `Đang có ${have}${def.max < 99 ? '/' + def.max : ''} · Chỗ làm ${slots.used}/${slots.max}`))));
  if (roleFull) body.appendChild(noteBox('ui_info', `Quán chỉ cần **${def.max} ${def.name.toLowerCase()}** thôi nha.`));
  else if (full) body.appendChild(noteBox('ui_lock', 'Hết chỗ làm rồi. **Mở rộng quán** để thuê thêm người nha.', 'gold'));

  // refresh row
  const free = (s.staffTickets || 0) > 0;
  const rc = SC.refreshCost(D.tierNow());
  const refresh = costBtn(free ? null : rc, {
    can: free || s.money >= rc, cls: 'paper', label: free ? 'Dùng vé ★3+ làm mới' : 'Làm mới',
    onClick: (btn) => { const r = act('refreshCandidates', role); if (r.ok === false) return; sfx('sparkle'); celebrate(btn, { sound: null }); api.rerender(); },
  });
  body.appendChild(div('hire-bar', secTitle('Ứng viên hôm nay'), refresh));

  const list = D.candidates(role);
  if (!list.length) body.appendChild(div('nodata', 'Chưa có ứng viên. Bấm Làm mới nha.'));
  list.forEach((c, i) => {
    const can = !full && !roleFull && s.money >= (c.fee ?? c.salary);
    const btn = costBtn(c.fee ?? c.salary, {
      can, label: 'Thuê', cls: 'red',
      onClick: (b) => {
        if (roleFull || full) { ctx.toast(roleFull ? `Quán chỉ cần ${def.max} ${def.name.toLowerCase()} thôi nha.` : 'Hết chỗ rồi, mở rộng quán để thuê thêm nha.', 'bad'); sfx('error'); return; }
        const r = act('hire', role, i);
        if (r.ok === false) return;
        celebrate(b); floatAt(b, 'Chào mừng!', '#e2433b');
        ctx.tutorial?.onAction?.('hire', role);
        api.rerender();
      },
    });
    body.appendChild(personCard(c, { hireBtn: btn, idx: i }));
  });
  body.appendChild(noteBox('ui_coin', 'Phí thuê bằng **lương 1 ngày**. Nhân viên làm càng nhiều việc càng lên cấp và giỏi hơn.'));
}

export const staffSheet = {
  title: 'Nhân viên',
  icon: 'ui_staff',
  build(body, api) {
    const s = S();
    const roles = Object.keys(SC.roles);
    const ids = ['team', ...roles];
    let sub = api.sub;
    if (!ids.includes(sub)) sub = s.staff.length ? 'team' : (roles.find((r) => D.roleUnlocked(r)) || 'team');
    api.tabs([
      { id: 'team', label: 'Đội' + (s.staff.length ? ` (${s.staff.length})` : ''), icon: 'ui_staff' },
      ...roles.map((r) => ({ id: r, label: SC.roles[r].name, icon: roleIcon(r), locked: !D.roleUnlocked(r), dot: D.roleUnlocked(r) && !D.seen('role:' + r) })),
    ], sub, (id) => api.setSub(id));
    if (sub === 'team') teamView(body, api); else hireView(body, api, sub);
  },
};
