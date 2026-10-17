// HUD: level ring, money (rolling), rating, clock+weather, main-quest pill, speed, settings.
import * as C from '../config.js';
import { fmtMoney, fmtShort, fmtRating, fmtClock, weekday } from '../core/format.js';
import { h, div, span, ico, setIco, setText, setClass, setStyleVar, vibrate } from './dom.js';
import { ctx, S, G, act, sfx } from './ctx.js';
import { levelInfo, mainQuest, wxIcon, featureOn } from './data.js';
import { frame } from './modals.js';

export function mountHud(root) {
  // ---- row 1
  const lvNum = h('b', null, '1');
  const ringFill = h('i', { class: 'pxdisc' });
  const lvl = h('button', { class: 'lvl', 'aria-label': 'Cấp độ', onclick: () => { sfx('click'); ctx.modals?.roadmap(); } },
    div('ring pxdisc', ringFill), div('core pxdisc', lvNum));

  const moneyNum = span('num', '0');
  const moneyIcon = ico('ui_coin', 16);
  const money = div('hchip money', moneyIcon, moneyNum);

  const ratingNum = span('num', '3,5');
  const rating = h('button', { class: 'hchip rating', 'aria-label': 'Đánh giá', onclick: () => { sfx('click'); ctx.openSheet('shop', 'reviews'); } }, ico('ui_star', 16), ratingNum);

  const wd = span('num wd', 'T2');
  const clockT = span('num', '10:00');
  const wxImg = ico('wx_sun', 16);
  const rushTag = span('rush', 'ĐÔNG');
  rushTag.hidden = true;
  const clock = div('hchip clock', wxImg, wd, clockT, rushTag);

  const r1 = div('hud-row r1', lvl, money, rating, clock);

  // ---- v2.6.2 EXP bar: how far to the next level, in numbers
  const xpFill = h('i');
  const xpTxt = span('xp-t', '');
  const xpPct = span('xp-p', '');
  const xpBar = h('button', { class: 'xpbar', 'aria-label': 'Kinh nghiệm', onclick: () => { sfx('click'); ctx.modals?.roadmap(); } },
    span('xp-lv', 'EXP'), div('xp-track', xpFill, xpTxt), xpPct);
  const rx = div('hud-row rx', xpBar);

  // ---- row 2
  const qIco = ico('ui_quest', 32, 'qi');
  const qText = span('qtext', '');
  const qBar = h('i'); const qBarWrap = div('bar thin', qBar);
  const qN = span('qn', '');
  const qRw = span('qrw', '');
  const quest = h('button', { class: 'quest', onclick: onQuest }, qIco, span('qt', qText, span('qrow', qBarWrap, qN)), qRw);

  const speedLbl = span('', '1×');
  const speedLock = ico('ui_lock', 16);
  const speed = h('button', { class: 'hbtn speed', 'aria-label': 'Tốc độ', onclick: onSpeed }, speedLbl);
  const gear = h('button', { class: 'hbtn gear', 'aria-label': 'Cài đặt', onclick: () => { sfx('click'); ctx.modals?.settings(); } }, ico('ui_gear', 32));
  const pauseBtn = h('button', { class: 'hbtn pause', 'aria-label': 'Tạm dừng', onclick: () => { sfx('click'); openPause(); } }, ico('ui_pause', 32));
  const r2 = div('hud-row r2', quest, pauseBtn, speed, gear);

  root.append(r1, rx, r2);

  // tutorial hooks
  quest.dataset.tut = 'quest';

  // ---- money tween
  let shown = null, hold = 0;
  const onCollected = () => { hold = performance.now() + 420; };
  ctx.game.on('collected', onCollected);
  ctx.game.on('xp', () => { lvl.classList.remove('glow'); void lvl.offsetWidth; lvl.classList.add('glow'); xpBar.classList.remove('gain'); void xpBar.offsetWidth; xpBar.classList.add('gain'); });
  ctx.game.on('rush', (e) => { rushTag.hidden = !e.on; });

  function fmtM(k) {
    const s = fmtMoney(k).replace(/đ$/, '');
    return s.length > 8 ? fmtShort(k) : s;
  }

  function onSpeed() {
    sfx('click');
    if (!featureOn('speed2')) { ctx.toast(`Tốc độ ×2 mở ở Lv ${C.FEATURES.speed2} nha.`, 'info', 'ui_lock'); return; }
    // v2.6.10: 1× → 2× → 3× (from Lv 10) → 1×
    const cur = S().speed;
    const next = cur === 1 ? 2 : cur === 2 && featureOn('speed3') ? 3 : 1;
    if (cur === 2 && !featureOn('speed3') && C.FEATURES.speed3) ctx.toast(`Tốc độ ×3 mở ở Lv ${C.FEATURES.speed3} nha.`, 'info', 'ui_lock');
    act('setSpeed', next);
  }
  async function onQuest() {
    sfx('click');
    const mq = mainQuest();
    if (mq.quest && (S().quests?.mainClaimable || mq.done)) {
      const rect = quest.getBoundingClientRect();
      const r = act('claimMainQuest');
      if (r.ok) {
        quest.classList.remove('claimpop'); void quest.offsetWidth; quest.classList.add('claimpop');
        sfx('cash'); vibrate(20);
        ctx.fx?.coins({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, moneyAnchor(), r.reward?.money || mq.quest.reward?.money || 50, () => ctx.flashMoney());
        const rw = r.reward || mq.quest.reward || {};
        if (rw.money) ctx.toast(`Nhận ${fmtShort(rw.money)} từ mục tiêu!`, 'good', 'ui_coin');
        if (rw.deco) ctx.toast('Nhận món trang trí mới!', 'good', 'ui_deco');
      }
      return;
    }
    ctx.openSheet('shop', 'quests');
  }

  function moneyAnchor() {
    const r = moneyIcon.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  ctx.flashMoney = () => { money.classList.remove('bump'); void money.offsetWidth; money.classList.add('bump'); };
  ctx.moneyAnchor = moneyAnchor;

  // ---- per-frame
  let acc = 0;
  function update(dt) {
    const s = S();
    // money roll
    const target = s.money;
    if (shown == null) shown = target;
    if (shown !== target && performance.now() >= hold) {
      const diff = target - shown;
      const step = diff * Math.min(1, dt * 7) + Math.sign(diff) * Math.min(Math.abs(diff), Math.max(0.5, Math.abs(diff) * 0.02));
      shown = Math.abs(step) >= Math.abs(diff) ? target : shown + step;
    }
    setText(moneyNum, fmtM(shown === target ? target : Math.round(shown)));

    acc += dt;
    if (acc < 0.1) return;
    acc = 0;
    const lv = levelInfo();
    setText(lvNum, lv.level);
    setStyleVar(ringFill, '--p', Math.round(lv.pct));
    setStyleVar(xpFill, '--p', lv.pct.toFixed(1));
    const nf = (v) => Math.floor(v).toLocaleString('vi-VN');
    setText(xpTxt, `${nf(lv.xp)} / ${nf(lv.need)}`);
    setText(xpPct, `${Math.floor(lv.pct)}% → Lv ${lv.level + 1}`);
    setText(ratingNum, fmtRating(s.rating?.avg ?? 3.5));
    setText(wd, weekday(s.day));
    setText(clockT, fmtClock(s.clock));
    let wxN = s.weather;
    try { wxN = ctx.game.get?.weatherNow?.() || s.weather; } catch (e) { /* day weather */ }
    setIco(wxImg, wxIcon(wxN), 16);
    // speed
    const sp = s.speed === 2 || s.speed === 3;
    setClass(speed, 'on', sp);
    setClass(speed, 'x3', s.speed === 3);
    setClass(speed, 'dim', !featureOn('speed2'));
    setText(speedLbl, featureOn('speed2') ? (s.speed === 3 ? '3×' : sp ? '2×' : '1×') : '1×');
    // quest
    const mq = mainQuest();
    const claim = !!(s.quests?.mainClaimable || mq.done) && !!mq.quest;
    if (!mq.quest) {
      setText(qText, 'Hoàn thành mọi mục tiêu rồi!');
      setText(qN, ''); setText(qRw, ''); setStyleVar(qBar, '--p', 100);
    } else {
      setText(qText, mq.quest.text);
      const cur = typeof mq.progress === 'number' ? mq.progress : 0;
      const fmtN = (v) => (v >= 1000 ? v.toLocaleString('vi-VN') : String(Math.round(v * 10) / 10).replace('.', ','));
      setText(qN, claim ? 'NHẬN' : `${fmtN(cur)}/${fmtN(mq.target)}`);
      setStyleVar(qBar, '--p', Math.min(100, Math.round((cur / (mq.target || 1)) * 100)));
      const rw = mq.quest.reward || {};
      setText(qRw, (rw.money ? '+' + fmtShort(rw.money) : '') + (rw.deco ? ' 🎁' : ''));
    }
    setClass(quest, 'ready', claim);
    setClass(qN, 'claim', claim);
  }

  return { update, moneyAnchor, els: { quest, lvl, money, speed, gear, rating } };
}

/** v2.6.17: "Đóng cửa sớm" in the pause box too (only while the shop is open); asks once more before closing. */
function closeEarlyBtn(m) {
  const open = S().phase === 'open';
  const b = h('button', { class: 'btn warn block pz-close', disabled: !open }, ico('ui_home', 16), open ? 'Đóng cửa sớm' : S().phase === 'closing' ? 'Quán đang dọn hàng' : 'Đóng cửa sớm (khi đang bán)');
  b.addEventListener('click', () => {
    if (S().phase !== 'open') return;
    sfx('click');
    ctx.confirm({
      title: 'Đóng cửa sớm hôm nay?', icon: 'ui_home', yes: 'Đóng cửa', no: 'Bán tiếp',
      text: 'Không nhận thêm khách mới. Khách đang ở quầy vẫn được phục vụ xong rồi mới tổng kết ngày.',
      onYes: () => { const r = act('closeEarly'); if (r && r.ok === false) return; sfx('door'); m.close('closed'); },
    });
  });
  return b;
}

/** pause: a pausing modal (ctx.modal pauses the sim while it is open) */
function openPause() {
  return ctx.modal({
    id: 'pause', cls: 'pause', queue: false, priority: 25, pause: true,
    build: (m) => frame('Tạm dừng', { icon: 'ui_pause', onClose: () => m.close('x') },
      div('pause-box',
        span('pz-txt', 'Quán đang tạm nghỉ — khách đứng yên, đồng hồ không chạy. Bấm chơi tiếp khi sẵn sàng nha!'),
        h('button', { class: 'btn jade block', onclick: () => { sfx('click'); m.close('resume'); } }, ico('ui_play', 16), 'Chơi tiếp'),
        closeEarlyBtn(m))),
  });
}
