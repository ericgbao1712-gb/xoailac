// Quán ▸ Nhiệm vụ: main quest, daily tasks (chests), 7-day login streak.
import { h, div, span, ico } from '../dom.js';
import { ctx, act, G, S, sfx } from '../ctx.js';
import * as D from '../data.js';
import * as C from '../../config.js';
import { fmtShort, fmtRating, fmtClock } from '../../core/format.js';
import { secTitle, noteBox, celebrate, costBtn, lockCard } from './common.js';

export const CHEST_ICON = { wood: 'ui_chest_wood', silver: 'ui_chest_silver', gold: 'ui_chest_gold' };

export function fmtProg(type, v) {
  if (type === 'rating') return fmtRating(v);
  if (type === 'dayProfit' || type === 'dayRevenue' || type === 'tips') return fmtShort(v);
  return String(Math.floor(v + 1e-9));
}

const xpFor = (kind, base) => { try { return G().get?.questXp?.(kind, base) ?? base ?? 0; } catch (e) { return base || 0; } };
const nfx = (v) => Math.round(v).toLocaleString('vi-VN');
function rewardChips(r, kind) {
  const out = [];
  const xp = kind ? xpFor(kind, r?.xp) : r?.xp;                   // v2.6.11: XP scales with the level
  if (r?.money) out.push(span('chip gold', ico('ui_coin', 16), span('num', fmtShort(r.money))));
  if (xp) out.push(span('chip jade', ico('ui_xp', 16), span('num', nfx(xp) + ' XP')));
  if (r?.deco) out.push(span('chip', ico('ui_deco', 16), C.DECO.find((d) => d.id === r.deco)?.name || 'Trang trí'));
  return out;
}

function mainCard(api) {
  const mq = D.mainQuest();
  const q = mq.quest;
  if (!q) return div('card jade main done', ico('ui_trophy', 48), div('grow', h('b', null, 'Xong hết mục tiêu rồi!'), span('muted', 'Bạn đúng là Vua Xoài Lắc. Cứ thong thả kinh doanh nha.')));
  const ready = !!mq.done;
  const card = div('card main' + (ready ? ' gold ready' : ''));
  const idx = (mq.index ?? S().quests?.main ?? 0) + 1, total = mq.total || C.MAIN_QUESTS.length;
  card.appendChild(div('mq-top', ico(ready ? 'ui_gift' : 'ui_trophy', 48),
    div('grow', span('muted sm', `Mục tiêu ${idx}/${total}`), h('b', { class: 'mq-t' }, q.text), div('chips', rewardChips(q.reward, 'main'), ...C.INGREDIENTS.filter((x) => x.side && x.quest === q.id).map((x) => span('chip gold', ico(x.icon, 16), 'Mở món: ' + x.name))))));
  const pct = Math.min(100, (mq.progress / Math.max(0.0001, mq.target)) * 100);
  card.appendChild(div('mq-bar', div('bar ' + (ready ? '' : 'jade'), h('i', { style: { '--p': pct } })), span('num', `${fmtProg(q.type, mq.progress)}/${fmtProg(q.type, mq.target)}`)));
  if (q.minReviews && mq.reviews != null) card.appendChild(span('muted sm', `Đánh giá: ${mq.reviews}/${q.minReviews}`));
  if (ready) {
    const b = h('button', { class: 'btn red block lg claim', 'aria-label': 'Nhận thưởng' }, 'NHẬN THƯỞNG');
    b.addEventListener('click', () => {
      const r = act('claimMainQuest');
      if (r.ok === false) return;
      sfx('chest');
      ctx.modals.chest?.('gift', r.reward || { money: q.reward?.money || 0 }, { title: 'Hoàn thành mục tiêu!', sub: q.text });
      ctx.tutorial?.onAction?.('claimMain');
      api.rerender();
    });
    card.appendChild(b);
  }
  return card;
}

/** "Sổ tay quán mới": the v2 chain that teaches the new systems, one task at a time. */
function v2Card(api) {
  const info = G().get?.v2Quest?.();
  if (!info) return null;
  const q = info.quest;
  if (!q) return div('card jade main done', ico('ui_book', 48), div('grow', h('b', null, 'Xong cả Sổ tay quán mới!'), span('muted', 'Bạn đã thử hết các tính năng mới rồi đó.')));
  const ready = !!info.done;
  const card = div('card main v2' + (ready ? ' gold ready' : info.locked ? ' locked' : ''));
  card.appendChild(div('mq-top', ico(info.locked ? 'ui_lock' : ready ? 'ui_gift' : 'ui_book', 48),
    div('grow', span('muted sm', `Việc ${info.index + 1}/${info.total}` + (info.locked ? ` · mở ở Lv ${q.minLv}` : '')), h('b', { class: 'mq-t' }, q.text), div('chips', rewardChips(q.reward, 'v2')))));
  const pct = Math.min(100, (info.progress / Math.max(0.0001, info.target)) * 100);
  card.appendChild(div('mq-bar', div('bar ' + (ready ? '' : 'jade'), h('i', { style: { '--p': pct } })), span('num', `${fmtProg(q.type, info.progress)}/${fmtProg(q.type, info.target)}`)));
  if (ready) {
    const b = h('button', { class: 'btn red block claim' }, 'NHẬN THƯỞNG');
    b.addEventListener('click', () => {
      const r = act('claimV2Quest'); if (r.ok === false) return;
      sfx('chest'); ctx.modals.chest?.('gift', r.reward || {}, { title: 'Xong việc trong Sổ tay!', sub: q.text });
      api.rerender();
    });
    card.appendChild(b);
  }
  if (info.next?.length) card.appendChild(div('v2-next', span('muted sm', 'Tiếp theo: ' + info.next.map((n) => n.text + (n.minLv && n.minLv > S().level ? ` (Lv ${n.minLv})` : '')).join(' · '))));
  return card;
}

function dailyCard(t, i, api) {
  const failed = !!t.failed;
  const ready = t.done && !t.claimed && !failed;
  const card = div('card daily' + (t.claimed ? ' claimed' : ready ? ' gold ready' : failed ? ' locked' : ''));
  let prog;
  if (t.type === 'noSupplyMiss') prog = failed ? 'Thiếu rồi, mai thử lại nha' : (t.done ? 'Xong!' : 'Tính lúc đóng cửa');
  else if (t.type === 'servedNoPrice' && failed) prog = 'Có khách chê đắt rồi, mai thử lại nha';
  else if (t.type === 'noAngryUntil') prog = failed ? 'Hỏng rồi, mai thử lại nha' : `${fmtClock(C.TIME.dayStart + t.progress)} / ${fmtClock(C.TIME.dayStart + t.target)}`;
  else prog = `${fmtProg(t.type, t.progress)}/${fmtProg(t.type, t.target)}`;
  card.appendChild(div('dq-top', ico(CHEST_ICON[t.chest] || CHEST_ICON.wood, 32, t.claimed ? 'dim' : ''),
    div('grow', h('b', null, t.text), div('mq-bar', div('bar thin ' + (ready ? '' : 'jade'), h('i', { style: { '--p': Math.min(100, (t.progress / Math.max(1, t.target)) * 100) } })), span('num sm', prog)))));
  const st = div('dq-act');
  if (t.claimed) st.appendChild(span('chip jade', ico('ui_check', 16), 'Đã nhận'));
  else if (ready) {
    const b = h('button', { class: 'btn red sm' }, 'Mở rương');
    b.addEventListener('click', () => {
      const r = act('claimDaily', i);
      if (r.ok === false) return;
      sfx('chest');
      ctx.modals.chest?.(r.chest || t.chest, r.reward || {});
      ctx.tutorial?.onAction?.('claimDaily');
      api.rerender();
    });
    st.appendChild(b);
  } else st.appendChild(span('muted sm', (C.CHESTS[t.chest]?.name || 'Rương') + ' · +' + nfx(xpFor(t.chest, C.CHESTS[t.chest]?.xp)) + ' XP'));
  card.appendChild(st);
  return card;
}

function loginStrip(api) {
  const info = G().get?.loginInfo?.() || { canClaim: false, day: 1, streak: 0, rewards: C.LOGIN_REWARDS };
  const rewards = info.rewards || C.LOGIN_REWARDS;
  const claimedToday = info.claimedToday ?? !info.canClaim;
  const cur = info.day;
  const strip = div('login-strip');
  rewards.forEach((r) => {
    const past = r.day < cur || (r.day === cur && claimedToday);
    const today = r.day === cur && !claimedToday;
    const icon = r.deco ? 'ui_deco' : r.staffTicket ? 'ui_ticket' : r.ingredients ? 'ui_kho' : 'ui_coin';
    strip.appendChild(div('ld' + (past ? ' past' : '') + (today ? ' today' : ''), span('dn', 'N' + r.day), ico(icon, 32, past ? 'dim' : ''), past ? span('mk', ico('ui_check', 16)) : null));
  });
  const card = div('card login');
  card.appendChild(div('lg-top', ico('ui_calendar', 32), div('grow', h('b', null, 'Điểm danh 7 ngày'), span('muted', claimedToday ? 'Hôm nay nhận rồi, mai quay lại nha!' : `Ngày ${cur}: ${rewards[cur - 1]?.text || ''}`))));
  card.appendChild(strip);
  if (!claimedToday) {
    const b = h('button', { class: 'btn jade block' }, 'Nhận quà hôm nay');
    b.addEventListener('click', () => {
      const r = act('claimLogin');
      if (r.ok === false) return;
      sfx('chest');
      ctx.modals.chest?.('gift', r.reward || {}, { title: `Quà điểm danh ngày ${r.day || cur}`, sub: 'Chuỗi ' + (r.streak || info.streak + 1) + ' ngày liên tiếp' });
      api.rerender();
    });
    card.appendChild(b);
  }
  return card;
}

export function questsView(body, api) {
  const s = S();
  body.appendChild(secTitle('Mục tiêu chính'));
  body.appendChild(mainCard(api));
  if ((s.masteryChests || 0) > 0) {
    const b = h('button', { class: 'btn red sm' }, 'Mở rương');
    b.addEventListener('click', () => { const r = act('openMasteryChest'); if (r.ok === false) return; sfx('chest'); ctx.modals.chest?.(r.chest || 'gold', r.reward || {}, { title: 'Rương thành thạo!' }); api.rerender(); });
    body.appendChild(div('card daily gold ready', div('dq-top', ico('ui_chest_gold', 48), div('grow', h('b', null, `Rương thành thạo ×${s.masteryChests}`), span('muted', 'Từ Lv 41 mỗi lần lên cấp được một rương vàng.')), b)));
  }
  const v2 = v2Card(api);
  if (v2) { body.appendChild(secTitle('Sổ tay quán mới', 'làm quen tính năng mới')); body.appendChild(v2); }
  body.appendChild(secTitle('Nhiệm vụ hôm nay', D.featureOn('daily') ? 'mỗi sáng đổi mới' : null));
  if (!D.featureOn('daily')) {
    body.appendChild(lockCard('Nhiệm vụ ngày', `Mở ở Lv ${C.FEATURES.daily}. Làm xong nhận rương thưởng nha!`, 'ui_chest_wood'));
  } else {
    const list = D.dailyList();
    if (!list.length) body.appendChild(div('nodata', 'Sáng mai sẽ có nhiệm vụ mới nha.'));
    list.forEach((t, i) => body.appendChild(dailyCard(t, i, api)));
    if (list.length && list.every((t) => t.claimed)) {
      const done = !!s.quests?.daily?.allClaimed;
      const card = div('card daily bonus' + (done ? ' claimed' : ' gold ready'));
      card.appendChild(div('dq-top', ico(CHEST_ICON[C.DAILY_ALL_BONUS || 'gold'], 48, done ? 'dim' : ''), div('grow', h('b', null, 'Rương vàng bonus'), span('muted', done ? 'Đã nhận hôm nay' : `Làm hết ${list.length} nhiệm vụ rồi nè!`))));
      if (!done) {
        const b = h('button', { class: 'btn red sm' }, 'Mở rương vàng');
        b.addEventListener('click', () => { const r = act('claimDailyAll'); if (r.ok === false) return; sfx('chest'); ctx.modals.chest?.(r.chest || 'gold', r.reward || {}); api.rerender(); });
        card.appendChild(div('dq-act', b));
      }
      body.appendChild(card);
    }
  }
  body.appendChild(secTitle('Điểm danh'));
  body.appendChild(loginStrip(api));
}
