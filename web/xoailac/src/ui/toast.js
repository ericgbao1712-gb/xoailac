// Toasts (max 2), Má messages (queued), review popups, banners — and the game events that feed them.
import * as C from '../config.js';
import { fmtShort } from '../core/format.js';
import { h, div, span, ico, rich } from './dom.js';
import { ctx, sfx } from './ctx.js';
import { ING, DRINK } from './data.js';

export function stars(n, size = 16) {
  const w = span('stars');
  const full = Math.floor(n), half = n - full >= 0.5;
  for (let i = 0; i < 5; i++) w.appendChild(ico(i < full ? 'ui_star' : (i === full && half ? 'ui_star_half' : 'ui_star_empty'), size));
  return w;
}

export function mountToasts({ toastRoot, sceneUi }) {
  // ---------------------------------------------------------------- toasts
  // Three levels: 'info' (small, short), 'bad'/'good' (important), 'big' (quest done / unlock / reward: louder, short).
  // At most 2 on screen; a toast with the same key (or the same text) updates in place instead of stacking.
  const live = [];
  const LIFE = { info: 2200, good: 2600, bad: 3000, big: 3200 };
  const RANK = { info: 0, good: 1, bad: 2, big: 3 };
  ctx.toast = (text, kind = 'info', icon = null, key = null) => {
    if (!text) return;
    const life = LIFE[kind] || 2600;
    const dup = live.find((t) => (key && t.key === key) || t.text === text);
    if (dup) {
      if (dup.text !== text) { dup.text = text; dup.label.textContent = text; }
      dup.el.className = 'toast ' + kind;
      dup.el.classList.remove('pop'); void dup.el.offsetWidth; dup.el.classList.add('pop');
      clearTimeout(dup.timer); dup.timer = setTimeout(() => drop(dup), life);
      return;
    }
    const label = span('', text);
    const el = h('div', { class: 'toast ' + kind, role: 'status' }, icon ? ico(icon, 32) : null, label);
    toastRoot.appendChild(el);
    const rec = { el, text, key, kind, label, timer: 0 };
    live.push(rec);
    while (live.length > 2) {                       // make room: drop the least important (oldest first)
      let worst = live[0];
      for (const t of live) if ((RANK[t.kind] || 0) < (RANK[worst.kind] || 0)) worst = t;
      drop(worst === rec ? live[0] : worst);
    }
    rec.timer = setTimeout(() => drop(rec), life);
  };
  function drop(rec) {
    const i = live.indexOf(rec); if (i < 0) return;
    live.splice(i, 1); clearTimeout(rec.timer);
    rec.el.classList.add('out'); setTimeout(() => rec.el.remove(), 260);
  }

  // ---------------------------------------------------------------- Má
  const momWrap = div('mom-wrap'); sceneUi.appendChild(momWrap);
  const momQ = []; let momShown = 0;
  ctx.mom = (text, { tip = false, who = null } = {}) => {
    if (!text) return;
    momQ.push({ text, tip, who });
    pump();
  };
  function pump() {
    while (momShown < 1 && momQ.length) {
      const m = momQ.shift(); momShown++;
      const el = h('div', { class: 'mom' + (m.tip ? ' tip' : ''), role: 'status' },
        div('av', ico(m.tip ? 'ui_info' : 'ui_mom', 32)),
        div('bd', div('who', m.who || (m.tip ? 'Mẹo nhỏ' : 'Má nhắn'), m.tip ? null : h('i', null, 'vừa xong')), h('p', null, rich(m.text))));
      momWrap.appendChild(el);
      relayout();
      if (m.tip) sfx('pop');                  // real Má messages are voiced by the audio module (mom event)
      let closed = false;
      const close = () => { if (closed) return; closed = true; clearTimeout(t); el.classList.add('out'); setTimeout(() => { el.remove(); momShown--; relayout(); setTimeout(pump, 200); }, 300); };
      const t = setTimeout(close, Math.max(5000, m.text.length * 55));
      el.addEventListener('pointerdown', close);
    }
  }

  // ---------------------------------------------------------------- reviews
  let revEl = null, revT = 0;
  ctx.reviewPop = (rv) => {
    if (!rv) return;
    if (revEl) { revEl.remove(); clearTimeout(revT); }
    const bad = rv.stars <= 2;
    const el = h('div', { class: 'rev-pop' + (bad ? ' bad' : '') },
      div('rn', span('', rv.name || 'Khách'), stars(rv.stars, 16)),
      div('rt', rv.text || ''));
    sceneUi.appendChild(el); revEl = el;
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); if (revEl === el) revEl = null; };
    el.addEventListener('pointerdown', close);
    revT = setTimeout(close, 2500);
    if (bad) sfx('grumble'); else if (rv.stars < 5) sfx('sparkle');   // 5★ sparkle comes from audio (review event)
  };

  // ---------------------------------------------------------------- banners
  let banEl = null, banT = 0;
  ctx.banner = (text, kind = 'red', ms = 2600) => {
    if (banEl) { banEl.remove(); clearTimeout(banT); }
    const el = div('banner' + (kind === 'gold' ? ' gold' : ''), text);
    sceneUi.appendChild(el); banEl = el;
    relayout();
    banT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); relayout(); }, 300); if (banEl === el) banEl = null; }, ms);
  };

  // v2.6.15: Má's note, the banner and the toast chips never sit on top of each other: the banner goes right under
  // Má's note (when there is one), the toast chips under both. Positions are in px inside the scene.
  function relayout() {
    try {
      // offset* ignore the slide-in transforms, so the numbers are the settled layout
      const mom = momWrap.querySelector('.mom:not(.out)');
      let y = mom ? momWrap.offsetTop + mom.offsetTop + mom.offsetHeight + 6 : 0;
      if (banEl && banEl.isConnected) {
        banEl.style.top = y ? Math.round(y + 2) + 'px' : '';
        y = banEl.offsetTop + banEl.offsetHeight + 8;
      }
      const wrap = sceneUi.offsetParent === toastRoot.offsetParent ? 0 : (sceneUi.parentElement?.offsetTop || 0);
      toastRoot.style.top = Math.round(wrap + Math.max(30, y)) + 'px';
    } catch (e) { /* layout only */ }
  }


  // ---------------------------------------------------------------- game events
  const g = ctx.game;
  const on = (e, f) => g.on(e, (p) => { try { f(p || {}); } catch (err) { console.error('[ui] event ' + e, err); } });
  on('toast', (p) => ctx.toast(p.text, p.kind || 'info', p.icon, p.key || null));
  on('mom', (p) => ctx.mom(p.text));
  // in-scene stars already show every review; the card pops only for bad ones and special guests' good ones
  on('review', (p) => { const r = p.review || p; if (r && (r.stars <= 2 || (r.stars >= 5 && C.CUSTOMERS[r.kind]?.special))) ctx.reviewPop(r); });
  on('rush', (p) => { if (p.on) ctx.banner('GIỜ CAO ĐIỂM! KHÁCH ĐÔNG!', 'red'); });
  on('lotteryLady', (p) => { if (p.on) ctx.toast('Cô bán vé số ghé quán kìa — chạm vào cô nha!', 'info', 'ui_ticket'); });
  on('stockLow', (p) => ctx.toast(`Sắp hết ${ING[p.ing]?.name?.toLowerCase() || 'hàng'} rồi!`, 'bad', ING[p.ing]?.icon));
  on('stockOut', (p) => ctx.toast(`Hết ${ING[p.ing]?.name?.toLowerCase() || 'hàng'}! Mở Kho nhập thêm nha.`, 'bad', ING[p.ing]?.icon));
  on('expired', (p) => ctx.toast(`Đã bỏ ${p.total} phần hàng hết hạn (−${Math.round(p.value)}k) — mua vừa đủ thôi nha`, 'bad', 'ui_trash'));
  on('hired', (p) => ctx.toast(`${p.staff?.name || 'Nhân viên mới'} vào làm rồi!`, 'good', 'ui_staff'));
  on('staffLevel', (p) => {
    const nm = { spd: 'Nhanh nhẹn', skl: 'Tay nghề', chm: 'Dễ thương' }[p.stat] || '';
    ctx.toast(`${p.staff?.name || 'Nhân viên'} lên cấp! ${nm} +1`, 'good', 'ui_up');
  });
  on('questReady', (p) => {
    // v2.6.14: short, so the corner chip stays one line
    ctx.toast(p.kind === 'main' ? 'Xong mục tiêu! Bấm để nhận' : p.kind === 'v2' ? 'Xong việc Sổ tay! Nhận ở Quán' : 'Xong nhiệm vụ ngày! Nhận rương ở Quán', 'big', 'ui_gift');
    sfx('ting');
  });
  // the scene already floats "Combo xN" over the customer: the toast only marks milestones, as one updating pill
  on('combo', (p) => { if (p.n >= 5 && p.n % 5 === 0) ctx.toast(`Combo x${p.n}!`, 'good', 'ui_fire', 'combo'); });
  on('comboBreak', (p) => { if (p.n >= 5) ctx.toast(`Đứt combo x${p.n}, cố lại nha!`, 'info', 'emo_sweat', 'combo'); });
  // v2 systems
  const SUP = Object.fromEntries(C.SUPPLIES.map((x) => [x.id, x]));
  on('supplyLow', (p) => ctx.toast(`Sắp hết ${SUP[p.id]?.name?.toLowerCase() || 'vật tư'} — nhập thêm ở Kho nha.`, 'info', SUP[p.id]?.icon, 'sup_' + p.id));
  on('supplyOut', (p) => ctx.toast(SUP[p.id]?.need === 'optional' ? `Hết ${SUP[p.id]?.name?.toLowerCase()} — khách hơi phiền đó!`
    : (C.CONTAINER_IDS || []).includes(p.id) ? `Hết ${SUP[p.id]?.name?.toLowerCase()}! Món sẽ đựng bằng loại còn lại.`      // v2.6.14 ly ↔ hộp
    : `Hết ${SUP[p.id]?.name?.toLowerCase() || 'vật tư'}! Món cần nó tạm ngưng bán.`, 'bad', SUP[p.id]?.icon, 'sup_' + p.id));
  on('priceLeave', (p) => ctx.toast(`Khách chê đắt, bỏ đi (${p.n} lượt hôm nay)`, 'info', 'emo_money', 'priceLeave'));
  on('orderPlaced', (p) => { const sp = C.SUPPLIERS.find((x) => x.id === p.order?.sup); ctx.toast(`Đã đặt hàng ${sp ? sp.name : ''} — đang giao tới`, 'info', sp?.icon || 'eq_truck', 'order'); });
  on('staffWarn', (p) => ctx.toast(`${p.staff?.name || 'Nhân viên'} muốn nghỉ việc! Xem mục Nhân viên nha.`, 'bad', 'ui_staff', 'staff_' + p.staff?.id));
  on('staffStay', (p) => ctx.toast(`${p.staff?.name || 'Nhân viên'} vui vẻ ở lại làm tiếp!`, 'good', 'ui_heart', 'staff_' + p.staff?.id));
}
