// Offline earnings, ending, settings, level roadmap, table popover, boot checks.
import * as C from '../../config.js';
import { h, div, span, ico, setText, store } from '../dom.js';
import { ctx, act, G, S, sfx } from '../ctx.js';
import * as D from '../data.js';
import { fmtMoney, fmtDuration, fmtRating } from '../../core/format.js';
import { frame } from '../modals.js';
import { showPopover } from '../popover.js';
import { openLogin } from './rewards.js';
import { openBackup, openRestore } from '../backup.js';
import { songPicker } from '../songs.js';
import { countUp, confettiFor, unlockIcon, unlocksAtLevel, UNLOCK_LABEL, vibrate } from './kit.js';

/** self-updating switch (the shared `toggle` needs a rebuild to flip) */
function switchBtn(initial, onChange, label) {
  let on = !!initial;
  const b = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label }, span('sr', on ? 'Bật' : 'Tắt'));
  b.addEventListener('click', () => { on = !on; sfx('click'); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); onChange(on); });
  return b;
}

// ================================================================ offline earnings
export function openOffline(p = {}) {
  const money = +p.money || 0;
  if (!(money > 0)) return null;
  const secs = +p.seconds || 0;
  return ctx.modal({
    id: 'offline', cls: 'celebrate offline', priority: 8, sound: 'whoosh',
    build: (m) => {
      const big = span('num off-big', fmtMoney(0));
      setTimeout(() => { if (!m.closed) countUp(big, money, { dur: 1100, fmt: (v) => fmtMoney(Math.round(v)) }); }, 300);
      return div('mbody cel',
        div('rays soft on'),
        div('cel-top', ico('emo_zzz', 48), h('b', { class: 'cel-title sm' }, 'Chào mừng trở lại!')),
        h('p', { class: 'cel-sub' }, `Trong lúc bạn đi vắng${secs ? ' (' + fmtDuration(secs) + ')' : ''}, quán kiếm được`),
        div('off-box', ico('ui_coin', 48), big),
        h('p', { class: 'cel-sub' }, 'Nhân viên làm việc chăm chỉ ghê nha!'),
        h('button', { class: 'btn red lg block', onclick: () => { sfx('cash'); m.close('ok'); } }, 'Thu tiền!'));
    },
    onClose: () => {
      try { ctx.fx?.coins({ x: window.innerWidth / 2, y: window.innerHeight * 0.45 }, ctx.moneyAnchor(), money, () => ctx.flashMoney()); } catch (e) { /* ignore */ }
    },
  });
}

// ================================================================ ending
export function openEnding() {
  const h0 = ctx.modal({
    id: 'ending', cls: 'celebrate ending', priority: 9, dismissible: false, sound: null,
    build: (m) => {
      const s = S();
      const chips = [
        span('chip', ico('ui_calendar', 16), `${s.stats?.daysPlayed || s.day} ngày`),
        span('chip', ico('ui_menu', 16), `${s.stats?.potsSold || 0} phần xoài lắc`),
        span('chip', ico('ui_staff', 16), `${s.stats?.served || 0} lượt khách`),
        span('chip gold', ico('ui_star', 16), fmtRating(s.rating?.avg || 0) + ' sao'),
      ];
      return div('mbody cel',
        div('rays on'),
        div('cel-top', ico('ui_trophy', 64), span('cel-kicker', 'BẠN ĐÃ TRỞ THÀNH'), h('b', { class: 'cel-title sm' }, 'VUA XOÀI LẮC VIỆT NAM!')),
        h('p', { class: 'cel-sub' }, `Chuỗi ${s.shopName || 'Xoài Lắc Nhà Mình'} đã có mặt khắp Việt Nam.`),
        div('rp-chips c', chips),
        div('card note mom-say', ico('ui_mom', 32), h('p', null, C.MOM.ending)),
        div('card soon', h('b', null, 'Sắp ra mắt'), div('soon-row', C.NEXT_GAMES.map((g) => span('chip jade', ico('ui_star', 16), g)))),
        h('button', { class: 'btn jade lg block', onclick: () => { sfx('click'); m.close('ok'); } }, 'Tiếp tục kinh doanh'));
    },
  });
  if (h0) { confettiFor(h0, { count: 100, loop: true }); vibrate([40, 60, 40, 60, 80]); }
  return h0;
}

// ================================================================ settings
function slider(label, icon, key, apply) {
  const cur = Math.round(((S().settings || {})[key] ?? 0.6) * 100);
  const val = span('num sl-v', cur + '%');
  const inp = h('input', { type: 'range', class: 'slider', min: '0', max: '100', step: '5', 'aria-label': label, value: String(cur) });
  inp.style.setProperty('--p', cur);
  inp.addEventListener('input', () => {
    const n = +inp.value;
    inp.style.setProperty('--p', n); setText(val, n + '%');
    const r = ctx.game?.act?.setSetting?.(key, n / 100);
    void r;
    try { apply?.(n / 100); } catch (e) { /* ignore */ }
  });
  inp.addEventListener('change', () => { if (key === 'sfx') sfx('pop'); });
  return div('set-row', ico(icon, 32), div('grow', span('sl-l', label), inp), val);
}

/** Settings → "Độ dài 1 ngày": real minutes a selling day lasts at 1×. */
function dayLenCard() {
  const cur = C.daySecOf(S()) / 60;
  const note = span('muted sm', '');
  const setNote = (m) => setText(note, `1 ngày bán hàng = ${m} phút thật (×2 thì ${String(m / 2).replace('.', ',')} phút). Đổi lúc nào cũng được.`);
  setNote(cur);
  const btns = C.TIME.dayMinOptions.map((m) => {
    const b = h('button', { class: 'seg' + (m === cur ? ' on' : ''), 'aria-label': m + ' phút' }, String(m));
    b.addEventListener('click', () => {
      const r = act('setSetting', 'dayMin', m);
      if (r.ok === false) return;
      sfx('click');
      btns.forEach((x) => x.classList.toggle('on', x === b));
      setNote(m);
    });
    return b;
  });
  return div('card set-card',
    div('set-row', ico('ui_clock', 32), div('grow', span('sl-l', 'Độ dài 1 ngày (phút)'), note)),
    div('seg-row daylen', btns));
}

async function resetEverything() {
  try { const m = await import('../../storage.js'); await m.clearSave?.(); } catch (e) { /* ignore */ }
  try { localStorage.removeItem('xoai-lac/save/v1'); } catch (e) { /* ignore */ }
  // keep autosave / pagehide from writing the old game back before the reload
  try { ctx.game.serialize = () => null; } catch (e) { /* ignore */ }
  ctx.toast('Đã xóa sạch. Mình làm lại từ đầu nha!', 'info', 'ui_trash');
  setTimeout(() => { try { localStorage.removeItem('xoai-lac/save/v1'); } catch (e) { /* ignore */ } try { location.reload(); } catch (e) { /* ignore */ } }, 700);
}

/** v2.6.16 Settings → "Đóng cửa sớm": end today's selling now (only while the shop is open). Guests already at the
 *  counter are still served, nobody new comes in, then the day report shows as usual. */
function closeEarlyCard(m) {
  const open = S().phase === 'open';
  const btn = h('button', { class: 'btn warn sm', disabled: !open }, 'Đóng cửa');
  btn.addEventListener('click', () => {
    if (S().phase !== 'open') return;
    sfx('click');
    ctx.confirm({
      title: 'Đóng cửa sớm hôm nay?', icon: 'ui_home', yes: 'Đóng cửa', no: 'Bán tiếp',
      text: 'Không nhận thêm khách mới. Khách đang ở quầy vẫn được phục vụ xong rồi mới tổng kết ngày.',
      onYes: () => { const r = act('closeEarly'); if (r.ok === false) return; sfx('door'); m.close('closed'); },
    });
  });
  return div('card set-card set-close',
    div('set-row', ico('ui_clock', 32), div('grow', span('sl-l', 'Đóng cửa sớm'),
      span('muted sm', open ? 'Nghỉ bán sớm hôm nay, qua tổng kết ngày luôn.' : S().phase === 'closing' ? 'Quán đang dọn hàng, sắp đóng rồi.' : 'Chỉ dùng được khi quán đang mở bán.')), btn));
}

export function openSettings() {
  return ctx.modal({
    id: 'settings', cls: 'settings', queue: false, priority: 20, sound: 'whoosh',
    build: (m) => {
      const s = S();
      const name = h('input', { class: 'tinput', type: 'text', maxlength: '24', autocomplete: 'off', 'aria-label': 'Tên quán', placeholder: C.START.shopName, value: s.shopName || C.START.shopName });
      const saveName = h('button', { class: 'btn jade sm', onclick: () => {
        const v = name.value.trim();
        const r = act('setShopName', v);
        if (r.ok === false) return;
        sfx('confirm'); ctx.toast('Đã đổi tên quán rồi nha!', 'good', 'ui_check');
      } }, 'Lưu');
      const hap = switchBtn(ctx.haptics, (on) => { ctx.haptics = on; act('setSetting', 'haptics', on); if (on) vibrate(20); }, 'Rung khi bấm');
      const shk = switchBtn(!!ctx.phoneShake, async (on) => {
        if (on) {
          try {
            const DM = window.DeviceMotionEvent;
            if (DM && typeof DM.requestPermission === 'function' && (await DM.requestPermission()) !== 'granted') {
              ctx.toast('Máy chưa cho phép đọc cảm biến lắc.', 'bad', 'ui_phone'); on = false;
            }
          } catch (e) { on = false; }
        }
        ctx.phoneShake = on; store.set('phoneShake', on);
        if (on) ctx.toast('Lắc mạnh điện thoại 3–4 cái khi phần đã soạn đủ là ra món luôn!', 'good', 'ui_phone');
      }, 'Lắc điện thoại để lắc xoài');
      return frame('Cài đặt', { icon: 'ui_gear', onClose: () => m.close('x') },
        div('card set-card',
          slider('Nhạc nền', 'ui_music', 'music', (v) => ctx.audio?.setMusic?.(v)),
          slider('Âm thanh', 'ui_sound', 'sfx', (v) => ctx.audio?.setSfx?.(v)),
          div('set-row', ico('ui_phone', 32), div('grow', span('sl-l', 'Rung khi bấm'), span('muted sm', 'Chỉ có trên điện thoại')), hap),
          div('set-row', ico('fr_xoai', 32), div('grow', span('sl-l', 'Lắc điện thoại thật'), span('muted sm', 'Lắc máy để lắc ly xoài (cần cảm biến)')), shk)),
        div('card set-card',                                       // v2.6.21 chọn bài nhạc nền
          div('set-row', ico('eq_speaker', 32), div('grow', span('sl-l', 'Bài nhạc nền'), span('muted sm', 'Nâng Loa nhạc để mở thêm bài'))),
          songPicker()),
        dayLenCard(),
        closeEarlyCard(m),
        div('card set-card',
          span('sl-l', 'Tên quán'),
          div('set-name', name, saveName)),
        div('card set-card',
          div('set-row', ico('ui_chest_gold', 32), div('grow', span('sl-l', 'Sao lưu tiến trình'), span('muted sm', 'Lấy mã (hoặc file) để đổi máy, chơi lại vẫn giữ nguyên quán'))),
          div('set-bk',
            h('button', { class: 'btn jade sm', onclick: () => { sfx('click'); openBackup(); } }, 'Tạo mã sao lưu'),
            h('button', { class: 'btn paper sm', onclick: () => { sfx('click'); openRestore(); } }, 'Khôi phục'))),
        div('card set-card',
          div('set-about', ico('ui_home', 32), div('grow', h('b', null, 'Xoài Lắc Ơi!'), span('muted sm', 'Game quản lý xe xoài lắc pixel. Cảm ơn bạn đã ghé xe nha!'))),
          div('set-soon', span('sl-l', 'Sắp ra mắt'), div('soon-row', C.NEXT_GAMES.map((g) => span('chip jade', ico('ui_star', 16), g))))),
        h('button', { class: 'btn red sm block', onclick: () => {
          ctx.confirm({
            title: 'Xóa hết và chơi lại?', icon: 'ui_trash', danger: true, yes: 'Xóa hết', no: 'Thôi, giữ lại',
            text: 'Toàn bộ tiến trình (tiền, cấp độ, nhân viên…) sẽ mất sạch và không lấy lại được nha.',
            input: { word: 'XÓA', hint: 'Gõ XÓA để xác nhận' },
            onYes: () => { resetEverything(); },
          });
        } }, ico('ui_trash', 16), 'Xóa save, chơi lại từ đầu'),
        span('set-ver', 'Phiên bản ' + C.VERSION));
    },
  });
}

// ================================================================ level roadmap
export function openRoadmap() {
  return ctx.modal({
    id: 'roadmap', cls: 'roadmap', queue: false, priority: 20, sound: 'whoosh',
    build: (m) => {
      const lv = D.levelInfo();
      const cur = lv.level ?? S().level;
      const maxLv = Math.max(C.MASTERY.fromLv, cur + 3);
      const rows = [];
      let nextMarked = false;
      for (let L = 2; L <= maxLv; L++) {
        const un = unlocksAtLevel(L);
        if (!un.length) continue;
        const past = L <= cur;
        const isNext = !past && !nextMarked; if (isNext) nextMarked = true;
        rows.push(div('rm-row' + (past ? ' past' : '') + (isNext ? ' next' : ''),
          div('rm-lv', span('num', String(L)), past ? span('mk', ico('ui_check', 16)) : null),
          div('rm-list', un.map((u) => div('rm-u', ico(unlockIcon(u), 32), div('', h('b', null, u.name || u.id), span('muted sm', u.desc || UNLOCK_LABEL[u.type] || '')))))));
      }
      const pct = Math.min(100, lv.pct ?? (lv.xp / Math.max(1, lv.need)) * 100);
      const [head, body] = frame('Hành trình lên cấp', { icon: 'ui_xp', onClose: () => m.close('x') });
      body.append(
        div('card rm-cur', div('rl-top', span('lvbadge', 'Lv ' + cur), span('muted sm', 'Kinh nghiệm'), span('num rl-xp', `${Math.round(lv.xp)}/${lv.need}`)),
          div('bar', h('i', { style: { '--p': pct } })),
          span('muted sm', 'Phục vụ khách, nhận thưởng nhiệm vụ để lên cấp nha.')),
        div('rm-rows', rows));
      setTimeout(() => { try { body.querySelector('.rm-row.next')?.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } }, 60);
      return [head, body];
    },
  });
}

// ================================================================ table popover
const STATE_TEXT = { walkingIn: 'đang bước tới quầy', seated: 'đang xem thực đơn', ordered: 'đang chờ món', eating: 'đang nếm thử', billing: 'đang trả tiền', leaving: 'đang ra về' };

export function tableInfo(hit) {
  const g = G(); const w = g?.world;
  const idx = hit?.idx ?? hit?.tableIdx;
  const t = w?.tables?.[idx];
  if (!t || !ctx.el?.pop) return;
  const grp = t.groupId ? (w.groups || []).find((x) => x.id === t.groupId) : null;
  let line;
  if (grp) line = `${C.CUSTOMERS[grp.kind]?.name || 'Khách'} · ${grp.size} người — ${STATE_TEXT[grp.state] || 'đang đứng quầy'}`;
  else if (t.reserved) line = 'Ô này giữ cho khách đặt trước.';
  else line = 'Ô quầy đang trống, chờ khách nha.';
  const extra = t.coins ? span('chip gold', ico('ui_coin', 16), 'Có tiền trên bàn, chạm để thu!') : null;
  const p = ctx.renderer?.worldToClient?.(t.x, t.y - 10);
  if (!p) return;
  const app = ctx.el.app.getBoundingClientRect();
  const anchor = div('tbl-anchor');
  anchor.style.cssText = `position:absolute;width:2px;height:2px;left:${Math.round(p.x - app.left)}px;top:${Math.round(p.y - app.top)}px;pointer-events:none`;
  ctx.el.pop.appendChild(anchor);
  showPopover(anchor, div('tinfo', h('b', null, 'Ô quầy ' + (idx + 1)), h('p', null, line), extra), { onClose: () => anchor.remove() });
  sfx('tap');
}

// ================================================================ boot checks
let bootDone = false;
export function bootChecks() {
  if (bootDone) return; bootDone = true;
  let tries = 0;
  const check = () => {
    try {
      const s = S();
      if (!s.started || !s.tutorial?.done) return;
      if ((ctx.modalCount?.() || 0) > 0 && tries++ < 12) { setTimeout(check, 1500); return; }   // wait for offline/report/settings to close
      const info = G().get?.loginInfo?.();
      if (info?.canClaim && !ctx.modalOpen?.('login')) openLogin();
    } catch (e) { console.error('[ui] bootChecks', e); }
  };
  setTimeout(check, 1200);
}
