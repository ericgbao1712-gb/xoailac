// Celebration modals: level-up, tier-up, chest reveal, 7-day login calendar.
import * as C from '../../config.js';
import { h, div, span, ico } from '../dom.js';
import { ctx, act, G, S, sfx } from '../ctx.js';
import * as D from '../data.js';
import { fmtMoney } from '../../core/format.js';
import { sceneThumbURL } from '../../art/index.js';
import { countUp, confettiFor, createTimeline, unlockIcon, UNLOCK_LABEL, decoImg, vibrate } from './kit.js';

// ================================================================ level up
export function openLevelUp(p = {}) {
  const level = p.level || S().level;
  const unlocks = Array.isArray(p.unlocks) ? p.unlocks : [];
  const h0 = ctx.modal({
    id: 'levelup-' + level, cls: 'celebrate levelup', priority: 5, sound: null,
    build: (m) => {
      const cards = unlocks.map((u) => div('ul-card',
        div('ul-pic', ico(unlockIcon(u), 48)),
        span('ul-type', UNLOCK_LABEL[u.type] || 'Mới'),
        h('b', null, u.name || u.id),
        u.desc ? span('muted sm', u.desc) : null));
      cards.forEach((c, i) => { c.style.setProperty('--i', i); });
      const btn = h('button', { class: 'btn jade lg block', onclick: () => { sfx('click'); m.close('ok'); } }, unlocks.length ? 'Tuyệt vời!' : 'Cố lên nào!');
      return div('mbody cel',
        div('rays'),
        div('cel-top', span('cel-kicker', 'CHÚC MỪNG!'), h('b', { class: 'cel-title' }, 'LÊN CẤP'),
          div('lvl-orb', span('num', String(level)))),
        unlocks.length
          ? [h('p', { class: 'cel-sub' }, `Bạn đã đạt cấp ${level}! Mở khóa:`), div('ul-grid' + (unlocks.length === 1 ? ' one' : ''), cards)]
          : h('p', { class: 'cel-sub' }, `Bạn đã đạt cấp ${level}! Cấp sau còn nhiều thứ hay lắm nha.`),
        btn);
    },
  });
  if (h0) { confettiFor(h0, { count: 70, duration: 2200 }); vibrate([30, 40, 30]); }
  return h0;
}

// ================================================================ tier up
export function openTierUp(p = {}) {
  const tier = p.tier || S().tier;
  const nt = C.TIERS[tier - 1], pt = C.TIERS[tier - 2];
  if (!nt) return null;
  const thumb = (t) => { const img = h('img', { class: 'pix thumb', alt: '' }); img.draggable = false; try { img.src = sceneThumbURL(t, 2); } catch (e) { /* ignore */ } return img; };
  const mom = C.MOM['tier' + tier];
  const h0 = ctx.modal({
    id: 'tierup-' + tier, cls: 'celebrate tierup', priority: 6, sound: null,
    build: (m) => {
      const gains = [];
      if (pt) {
        if (nt.maxTables !== pt.maxTables) gains.push(['Ô quầy tối đa', pt.maxTables, nt.maxTables]);
        if (nt.kho !== pt.kho) gains.push(['Kho chứa', pt.kho, nt.kho]);
      }
      return div('mbody cel',
        div('rays'),
        div('cel-top', span('cel-kicker', 'MỞ RỘNG THÀNH CÔNG!'), h('b', { class: 'cel-title sm' }, nt.name.toUpperCase())),
        div('tu-pair', pt ? [div('tu-pic old', thumb(tier - 1), span('tu-l', 'Trước')), span('tu-arrow', ico('ui_up', 32))] : null, div('tu-pic new', thumb(tier), span('tu-l', 'Bây giờ'))),
        h('p', { class: 'cel-sub' }, nt.desc),
        gains.length ? div('tu-gains', gains.map(([l, a, b]) => div('xs-row', span('xs-l', l), span('num xs-a', String(a)), span('xs-arr', '→'), span('num xs-b up', String(b))))) : null,
        mom ? div('card note mom-say', ico('ui_mom', 32), h('p', null, mom)) : null,
        h('button', { class: 'btn red lg block', onclick: () => { sfx('click'); m.close('ok'); } }, 'Vào quán mới!'));
    },
  });
  if (h0) { confettiFor(h0, { count: 110, duration: 3200 }); vibrate([40, 40, 40, 40, 60]); }
  return h0;
}

// ================================================================ chest
const CHEST_ICON = { wood: 'ui_chest_wood', silver: 'ui_chest_silver', gold: 'ui_chest_gold', gift: 'ui_gift' };

/** chest(kind, reward:{money,xp,ingredients,deco,staffTicket}, {title, sub}) */
export function openChest(kind = 'wood', reward = {}, { title, sub } = {}) {
  kind = CHEST_ICON[kind] ? kind : 'wood';
  const gift = kind === 'gift';
  const name = title || (gift ? 'Quà cho bạn!' : (C.CHESTS[kind]?.name || 'Rương') + ' nè!');
  let moneyEl = null, opened = false;
  const h0 = ctx.modal({
    id: null, cls: 'celebrate chest ' + kind, priority: 3, sound: null,
    build: (m) => {
      const chest = h('button', { class: 'chest-btn' + (gift ? '' : ' shake-loop'), 'aria-label': gift ? 'Mở quà' : 'Mở rương' }, ico(CHEST_ICON[kind], 64, 'chest-ico'));
      const glow = div('rays soft');
      const rewards = div('rw-list');
      const hint = span('chest-hint', gift ? 'Quà đây nè!' : 'Chạm vào rương để mở nha!');
      const foot = div('mrow');
      const okBtn = h('button', { class: 'btn jade lg block', onclick: () => { sfx('click'); m.close('ok'); } }, 'Nhận hết!');
      okBtn.hidden = true;
      foot.appendChild(okBtn);

      const items = [];
      if (reward.money) items.push({ cls: 'gold', icon: 'ui_coin', big: true, text: '+' + fmtMoney(reward.money), money: reward.money });
      if (reward.xp) items.push({ cls: 'jade', icon: 'ui_xp', text: '+' + reward.xp + ' XP' });
      if (reward.ingredients) items.push({ cls: '', icon: 'ui_kho', text: `+${reward.ingredients} phần nguyên liệu` });
      if (reward.deco) items.push({ cls: 'pink', deco: reward.deco, text: (D.DECO[reward.deco]?.name || 'Đồ trang trí mới') + ' (trang trí mới!)' });
      if (reward.staffTicket) items.push({ cls: '', icon: 'ui_ticket', text: `Vé tuyển dụng ★${reward.staffTicket}+` });
      if (!items.length) items.push({ cls: '', icon: 'ui_heart', text: 'Chúc bạn buôn may bán đắt nha!' });

      const open = () => {
        if (opened) return; opened = true;
        hint.remove();
        chest.classList.remove('shake-loop'); chest.classList.add('opened');
        glow.classList.add('on');
        if (!gift) sfx('chest');
        vibrate([20, 30, 20]);
        const tl = createTimeline();
        let t = gift ? 120 : 520;
        items.forEach((it) => {
          const row = div('rw-item ' + it.cls + (it.big ? ' big' : ''), it.deco ? decoImg(it.deco, 48) : ico(it.icon, it.big ? 48 : 32), span(it.big ? 'num rw-money' : 'rw-t', it.big ? '+' + fmtMoney(0) : it.text));
          if (it.money) moneyEl = row.querySelector('.rw-money');
          tl.at(t, (instant) => {
            rewards.appendChild(row); row.classList.add('in');
            if (it.money && moneyEl) countUp(moneyEl, it.money, { dur: instant ? 0 : 700, fmt: (v) => '+' + fmtMoney(Math.round(v)) });
            if (!instant) sfx(it.money ? 'coin' : 'pop');
          });
          t += 300;
        });
        tl.at(t + 100, () => { okBtn.hidden = false; okBtn.classList.add('pop'); });
        tl.start();
        m._tl = tl;
        if (!ctx.reduced) confettiFor(m, { count: kind === 'gold' ? 80 : 45, duration: 1800 });
      };
      chest.addEventListener('click', () => { if (!opened) open(); else m._tl?.skip(); });
      if (gift) setTimeout(() => { if (!m.closed) open(); }, 380);

      return div('mbody cel',
        glow,
        div('cel-top', h('b', { class: 'cel-title sm' }, name), sub ? span('cel-sub-s', sub) : null),
        div('chest-stage', chest), hint, rewards, foot);
    },
    onClose: () => {
      // coins fly up to the HUD (money was already added by Core)
      if (reward.money && ctx.fx && ctx.moneyAnchor) {
        try { const from = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 }; ctx.fx.coins(from, ctx.moneyAnchor(), reward.money, () => ctx.flashMoney()); } catch (e) { /* ignore */ }
      }
    },
  });
  return h0;
}

// ================================================================ login calendar
export function openLogin() {
  const h0 = ctx.modal({
    id: 'login', cls: 'celebrate login', priority: 1, sound: 'whoosh',
    build: (m) => {
      const info = G().get?.loginInfo?.() || { canClaim: false, day: 1, streak: 0, rewards: C.LOGIN_REWARDS };
      const rewards = info.rewards || C.LOGIN_REWARDS;
      const claimedToday = info.claimedToday ?? !info.canClaim;
      const cur = info.day;
      const icon = (r) => (r.deco ? 'ui_deco' : r.staffTicket ? 'ui_ticket' : r.ingredients ? 'ui_kho' : 'ui_coin');
      const grid = div('lg-grid');
      rewards.forEach((r) => {
        const past = r.day < cur || (r.day === cur && claimedToday);
        const today = r.day === cur && !claimedToday;
        const cell = div('lg-day' + (past ? ' past' : '') + (today ? ' today' : '') + (r.day === 7 ? ' big' : ''),
          span('dn', 'Ngày ' + r.day),
          r.deco && r.day === 7 ? ico('ui_gift', 48) : ico(icon(r), r.day === 7 ? 48 : 32, past ? 'dim' : ''),
          span('lt', r.text),
          past ? span('mk', ico('ui_check', 16)) : null);
        grid.appendChild(cell);
      });
      const btn = claimedToday
        ? h('button', { class: 'btn paper lg block', onclick: () => { sfx('click'); m.close('ok'); } }, 'Mai quay lại nha!')
        : h('button', { class: 'btn red lg block', onclick: () => {
          const r = act('claimLogin');
          if (r.ok === false) return;
          sfx('chest');
          m.close('claimed');
          openChest('gift', r.reward || {}, { title: `Quà điểm danh ngày ${r.day || cur}`, sub: 'Chuỗi ' + (r.streak || (info.streak || 0) + 1) + ' ngày liên tiếp' });
        } }, 'Nhận quà hôm nay');
      return [
        div('mhead', ico('ui_calendar', 32), div('mtitle', h('b', null, 'Điểm danh 7 ngày'), span('msub', claimedToday ? 'Hôm nay bạn nhận rồi nha!' : `Chuỗi hiện tại: ${info.streak || 0} ngày`)),
          h('button', { class: 'xbtn', 'aria-label': 'Đóng', onclick: () => { sfx('click'); m.close('x'); } }, ico('ui_close', 32))),
        div('mbody', h('p', { class: 'cel-sub left' }, 'Ghé quán mỗi ngày để nhận quà to dần, tới ngày 7 có quà siêu to luôn!'), grid, btn),
      ];
    },
  });
  return h0;
}
