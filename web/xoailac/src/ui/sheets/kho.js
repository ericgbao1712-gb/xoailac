// Sheet 1 — Kho: capacity, supplier choice, ingredients + supplies (vật tư), deliveries on the way, auto-restock.
// Chợ (Cô Ba) sells on the spot before opening; the other suppliers take an order (cart) and deliver later.
import { h, div, span, ico } from '../dom.js';
import { ctx, act, sfx, S } from '../ctx.js';
import * as D from '../data.js';
import * as C from '../../config.js';
import { fmtShort, fmtMoney, fmtClock } from '../../core/format.js';
import { secTitle, noteBox, celebrate, floatAt, toggle, unitPrice } from './common.js';

const cart = {};                                   // id → qty (kept while the sheet is reopened in the same session)
const SUP = Object.fromEntries(C.SUPPLIERS.map((x) => [x.id, x]));
const SPL = Object.fromEntries(C.SUPPLIES.map((x) => [x.id, x]));
const nameOf = (id) => (D.ING[id] || SPL[id] || { name: id }).name;
const iconOf = (id) => (D.ING[id] || SPL[id] || { icon: 'ui_kho' }).icon;
const g = () => ctx.game.get || {};

function supplierCard(x, active, api) {
  const pct = Math.round((x.priceMult - 1) * 100);
  const od = Math.min(C.DELIVERY_MAX, x.openDelay != null ? x.openDelay : (x.delay === 'morning' ? C.DELIVERY_MAX : x.delay || 0));
  const when = x.delay > 0 || x.delay === 'morning' ? `Giao trong ${od} phút` : 'Lấy liền';   // v2.6.3: ≤ DELIVERY_MAX while selling
  const q = x.quality > 0 ? 'Ngon hơn' : x.quality < 0 ? 'Hơi dập' : 'Bình thường';
  const el = h('button', { class: 'sup-card' + (active ? ' on' : '') + (x.unlocked ? '' : ' locked'), 'aria-pressed': String(active) },
    div('sup-h', ico(x.icon, 32), span('sup-n', x.name)),
    div('sup-tags',
      span('chip ' + (pct < 0 ? 'jade' : pct > 0 ? 'red' : ''), pct === 0 ? 'Giá chợ' : (pct > 0 ? '+' : '−') + Math.abs(pct) + '% giá'),
      span('chip', when),
      span('chip ' + (x.quality > 0 ? 'jade' : x.quality < 0 ? 'red' : ''), q)),
    x.unlocked ? null : span('muted sm', 'Mở ở Lv ' + x.unlockLv));
  el.addEventListener('click', () => {
    if (!x.unlocked) { sfx('error'); ctx.toast(`${x.name} mở ở Lv ${x.unlockLv} nha.`, 'info', 'ui_lock'); return; }
    const r = act('setSupplier', x.id);
    if (r.ok !== false) { sfx('click'); api.rerender(); }
  });
  return el;
}

/** One row: item, price at this supplier, stock, and either buy-now buttons (chợ) or add-to-cart buttons. */
function itemRow(body, id, sup, api, { isSupply = false } = {}) {
  const s = S();
  const def = D.ING[id] || SPL[id];
  if (!isSupply && !D.ingUnlocked(id)) {
    if (def.broth) return;
    body.appendChild(div('card ing locked', div('ing-top', div('ing-ico', ico(def.icon, 32, 'dim')), div('ing-name', h('b', null, def.name), span('muted', def.side ? D.lockText(id) : 'Mở ở Lv ' + def.unlockLv)), ico('ui_lock', 32))));
    return;
  }
  const sells = g().supplierSells?.(sup.id, id) ?? true;
  const have = isSupply ? (s.supplies?.[id] ?? 0) : D.stock(id);
  const incoming = (s.orders || []).reduce((a, o) => a + ((o.items && o.items[id]) || 0), 0);
  const unit = g().supplierPrice?.(sup.id, id, isSupply ? 100 : 1) ?? D.buyPrice(id);
  const trend = !isSupply ? (s.market?.trend?.[id] || 0) : 0;
  const expT = !isSupply && have > 0 ? Math.min(have, D.expiringToday(id)) : 0;
  const low = isSupply ? have < 15 : have < 3;
  const row = div('card ing' + (have === 0 ? ' out' : low ? ' low' : '') + (sells ? '' : ' off'));
  const sub = [];
  if (!sells) sub.push(span('muted', `${sup.name} không bán món này`));
  else {
    sub.push(span('px' + (trend > 0 ? ' up' : trend < 0 ? ' down' : ''), unitPrice(unit) + (isSupply ? '/cái (từ 100 cái)' : '/phần'), trend ? ico(trend > 0 ? 'ui_up' : 'ui_down', 16) : null));
    if (isSupply) sub.push(span('hsd', (def.need === 'container' ? 'Bắt buộc · ' : def.need === 'drink' ? 'Cho nước · ' : 'Nên có · ') + `hôm qua dùng ${s.supplyUseYesterday?.[id] || 0}`));
    else if (def.side) sub.push(span('hsd' + (expT ? ' warn' : ''), `Thu thêm ${fmtShort(def.side)} · HSD ${D.shelfOf(id)} ngày` + (expT ? ` · ${expT} phần hết hạn sau hôm nay` : '')));
    else sub.push(span('hsd' + (expT ? ' warn' : ''), expT ? `HSD ${D.shelfOf(id)} ngày · ${expT} phần hết hạn sau hôm nay` : `HSD ${D.shelfOf(id)} ngày`));
  }
  row.appendChild(div('ing-top',
    div('ing-ico', ico(def.icon, 32)),
    div('ing-name', h('b', null, def.name), ...sub),
    div('ing-stock', span('num' + (have === 0 ? ' zero' : ''), String(have)), h('small', null, incoming ? `+${incoming} đang giao` : (isSupply ? 'cái' : 'trong kho')))));
  if (sells) {
    const packs = isSupply ? C.SUPPLY_PACKS.map((p) => p.n) : C.MARKET.packs;
    const btns = div('ing-btns');
    const instant = !(sup.delay > 0) && sup.delay !== 'morning';
    packs.forEach((n) => {
      const price = g().supplierPrice?.(sup.id, id, n) ?? unit;
      const cost = Math.round(price * n * 10) / 10;
      const inCart = cart[id] || 0;
      const b = h('button', { class: 'btn jade sm pack' + (s.money >= cost ? '' : ' off'), 'aria-label': `${instant ? 'Mua' : 'Thêm'} ${n} ${def.name}` },
        span('lb', (instant ? '+' : 'Giỏ +') + n), span('pr', ico('ui_coin', 16), span('num', fmtShort(cost))));
      b.addEventListener('click', () => {
        if (instant) {
          const r = isSupply ? act('buySupply', id, n) : act('buyIngredient', id, n);
          if (r.ok === false) return;
          celebrate(b, { sound: 'cash' }); floatAt(b, '+' + (r.bought ?? n), '#2f9a8a');
          ctx.flashMoney?.(); ctx.tutorial?.onAction?.('buy');
        } else {
          cart[id] = inCart + n; sfx('pop'); floatAt(b, 'Giỏ +' + n, '#2f9a8a');
        }
        api.rerender();
      });
      btns.appendChild(b);
    });
    if (!instant && cart[id]) {
      const x = h('button', { class: 'btn paper sm pack' }, span('lb', 'Bỏ ' + cart[id]), span('pr', span('muted', 'khỏi giỏ')));
      x.addEventListener('click', () => { delete cart[id]; sfx('click'); api.rerender(); });
      btns.appendChild(x);
    }
    row.appendChild(btns);
  }
  body.appendChild(row);
}

function cartBar(body, sup, api) {
  const items = Object.fromEntries(Object.entries(cart).filter(([id, n]) => n > 0 && (g().supplierSells?.(sup.id, id) ?? true)));
  const n = Object.values(items).reduce((a, b) => a + b, 0);
  if (!n) return;
  const q = g().quoteOrder?.(sup.id, items);
  const when = q?.arrive?.label || 'ngay';
  const btn = h('button', { class: 'btn red sm' }, 'Đặt hàng');
  btn.addEventListener('click', () => {
    const r = act('orderSupplies', sup.id, items);
    if (r.ok === false) { sfx('error'); return; }
    for (const id of Object.keys(items)) delete cart[id];
    celebrate(btn, { sound: 'cash' }); ctx.flashMoney?.();
    api.rerender();
  });
  const clearB = h('button', { class: 'plink', onclick: () => { for (const k of Object.keys(cart)) delete cart[k]; sfx('click'); api.rerender(); } }, 'Xoá giỏ');
  body.appendChild(div('card cart-bar',
    div('grow', h('b', null, `Giỏ hàng: ${n} món · ${q?.ok ? fmtMoney(q.total) : '—'}`),
      span('muted sm', `${sup.name} · giao ${when}${sup.fee ? ` · gồm phí ship ${fmtShort(sup.fee)}` : ''}${sup.minOrder ? ` · tối thiểu ${fmtShort(sup.minOrder)}` : ''}`), clearB),
    btn));
}

// ---------------------------------------------------------------- v2.6 Thanh lý hàng cũ
const RATE_TXT = (r) => Math.round(r * 100) + '% vốn';
const LEFT_TXT = (d) => (d <= 0 ? 'hết hạn sau hôm nay' : d === 1 ? 'còn 1 ngày' : `còn ${d} ngày`);
function liquidateView(body, api) {
  const s = S(), L = C.LIQUIDATE;
  const morning = s.phase === 'prep';
  const ids = C.INGREDIENTS.map((i) => i.id).filter((id) => D.stock(id) > 0);
  const quote = (id, n) => g().liquidateQuote?.(id, n) || { ok: false, n: 0, money: 0, basis: 0, groups: [] };
  const old = (id) => g().oldStock?.(id) || 0;
  body.appendChild(noteBox('ui_tag', `**${L.buyer}** mua lại hàng tồn, lô cũ nhất trước. Giá thu: hàng **${LEFT_TXT(0)}** ${RATE_TXT(L.rates[0])}, **còn 1 ngày** ${RATE_TXT(L.rates[1])}, **còn lâu hơn** ${RATE_TXT(L.rates[2])}. Luôn thấp hơn giá mua: bán là chịu lỗ, nhưng đỡ hơn để hư bỏ.`, ''));
  if (!morning) body.appendChild(noteBox('ui_lock', `Chỉ thanh lý được **buổi sáng, trước khi mở hàng** (${L.buyer} ở chợ).`, 'gold'));
  if (!ids.length) { body.appendChild(div('nodata', 'Kho trống, không có gì để thanh lý.')); return; }

  const sell = (id, n, btn) => {
    const r = act('liquidate', id, n);
    if (r.ok === false) { sfx('error'); return; }
    sfx('cash'); if (btn) floatAt(btn, '+' + fmtShort(r.money), '#2f9a8a');
    ctx.toast(`Đã bán ${r.n} phần ${D.ING[id].name.toLowerCase()}: thu ${fmtMoney(r.money)} (lỗ ${fmtMoney(r.loss)} so với vốn)`, 'info', 'ui_tag');
    api.rerender();
  };
  // everything that expires after today, in one go
  const oldIds = ids.filter((id) => old(id) > 0);
  if (oldIds.length) {
    let n = 0, money = 0, basis = 0;
    for (const id of oldIds) { const q = quote(id, old(id)); n += q.n; money += q.money; basis += q.basis; }
    const all = h('button', { class: 'btn red sm', disabled: !morning }, `Bán hết · +${fmtShort(money)}`);
    all.addEventListener('click', () => ctx.confirm({
      title: 'Thanh lý hàng sắp hết hạn?', icon: 'ui_tag', yes: 'Bán hết', no: 'Thôi',
      text: `Bán ${n} phần (${oldIds.length} món) ${LEFT_TXT(0)}: thu ${fmtMoney(money)}, vốn ${fmtMoney(basis)}. Không mua lại được với giá này đâu nha.`,
      onYes: () => { let got = 0, lost = 0; for (const id of oldIds) { const r = act('liquidate', id, old(id)); if (r.ok !== false) { got += r.money; lost += r.loss; } } sfx('cash'); ctx.toast(`Đã thanh lý hàng sắp hạn: thu ${fmtMoney(got)} (lỗ ${fmtMoney(lost)})`, 'info', 'ui_tag'); api.rerender(); },
    }));
    body.appendChild(div('card lq-sum red', ico('ui_clock', 32),
      div('grow', h('b', null, `${n} phần ${LEFT_TXT(0)}`), span('muted sm', `Thu về ${fmtMoney(money)} · vốn ${fmtMoney(basis)}`)), all));
  }
  body.appendChild(secTitle('Hàng trong kho', 'lô cũ bán trước'));
  ids.sort((a, b) => (old(b) > 0) - (old(a) > 0) || D.stock(b) - D.stock(a));
  for (const id of ids) {
    const def = D.ING[id], have = D.stock(id), o = old(id);
    const one = quote(id, 1);
    const unitNow = one.n ? one.money : 0, basisNow = one.n ? one.basis : 0;
    const chips = quote(id).groups.map((gp) => span('chip' + (gp.left <= 0 ? ' red' : gp.left === 1 ? ' gold' : ''), `${gp.n} ${LEFT_TXT(gp.left)} · ${RATE_TXT(gp.rate)}`));
    const btn = (label, n) => {
      const q = quote(id, n);
      const b = h('button', { class: 'btn paper sm lq-b', disabled: !morning || !q.ok }, label, span('lq-m', '+' + fmtShort(q.money)));
      b.addEventListener('click', () => sell(id, n, b));
      return b;
    };
    const btns = div('lq-btns', btn('Bán 1', 1), have >= 5 ? btn('Bán 5', 5) : null, o > 0 && o !== have ? btn(`Bán ${o} sắp hạn`, o) : null, btn(`Bán hết ${have}`, have));
    body.appendChild(div('card lq-row' + (o > 0 ? ' old' : ''),
      div('lq-top', ico(def.icon, 32), div('grow', h('b', null, def.name),
        span('muted sm', `Kho ${have} phần · lô cũ nhất thu ${fmtShort(unitNow)}/phần (vốn ${fmtShort(basisNow)})`)), span('num lq-n', String(have))),
      div('lq-chips', ...chips), btns));
  }
}

export const khoSheet = {
  title: 'Kho hàng',
  icon: 'ui_kho',
  build(body, api) {
    // v2.6: two tabs — buying (as before) and thanh lý hàng cũ
    const hasOld = S().phase === 'prep' && C.INGREDIENTS.some((i) => (g().oldStock?.(i.id) || 0) > 0);
    const sub = api.sub === 'thanhly' ? 'thanhly' : 'nhap';
    api.tabs([{ id: 'nhap', label: 'Nhập hàng', icon: 'ui_kho' }, { id: 'thanhly', label: 'Thanh lý', icon: 'ui_tag', dot: hasOld }], sub, (id) => api.setSub(id));
    if (sub === 'thanhly') { liquidateView(body, api); return; }
    const s = S();
    const info = D.khoInfo();
    const incoming = info.incoming || 0;
    const free = Math.max(0, info.cap - info.used - incoming);
    const open = D.isOpenPhase();
    const upKho = C.UPGRADES.find((u) => u.id === 'kho');
    const khoName = upKho.levels?.[s.upgrades?.kho || 0] || 'Kho';
    const pct = info.cap ? Math.min(100, ((info.used + incoming) / info.cap) * 100) : 0;
    const sups = g().suppliers?.() || C.SUPPLIERS.map((x) => ({ ...x, unlocked: true, active: x.id === 'cho' }));
    let sup = sups.find((x) => x.active && x.unlocked) || sups[0];
    // chợ is closed while selling: show the first delivering supplier instead
    if (open && sup.prepOnly) sup = sups.find((x) => x.unlocked && !x.prepOnly) || sup;

    // ---- capacity
    body.appendChild(div('card cap' + (free === 0 ? ' red' : ''),
      div('cap-top', ico('ui_kho', 32), div('cap-t', h('b', null, khoName), span('muted', free === 0 ? 'Kho đầy rồi nha! Bán bớt hàng cũ ở tab Thanh lý.' : `Còn trống ${free} phần${incoming ? ` (đã tính ${incoming} đang giao)` : ''}`)),
        div('cap-n', span('num', String(info.used)), span('num dim', '/' + info.cap))),
      div('bar ' + (pct >= 100 ? 'red' : pct > 80 ? '' : 'leaf'), h('i', { style: { '--p': pct } }))));

    // ---- deliveries on the way
    if ((s.orders || []).length) {
      body.appendChild(secTitle('Hàng đang giao', s.orders.length + ' đơn'));
      s.orders.forEach((o) => {
        const sp = o.sup === 'quankho' ? { name: 'Quản kho đi chợ', icon: 'role_quankho' } : SUP[o.sup] || SUP.cho;   // v2.5.2 mid-shift run
        const day = Math.floor(o.at / 1440), clock = o.at - day * 1440;
        const eta = day > s.day ? (day === s.day + 1 ? 'sáng mai ' : `ngày ${day} `) + fmtClock(clock) : fmtClock(clock);
        const list = Object.keys(o.items).map((id) => div('ord-i', ico(iconOf(id), 16), span('', String(o.items[id]))));
        body.appendChild(div('card row order', ico(sp.icon, 32), div('grow', h('b', null, sp.name), span('muted sm', `Tới lúc ${eta} · đã trả ${fmtMoney(o.total)}`), div('ord-l', list))));
      });
    }

    // ---- supplier choice
    body.appendChild(secTitle('Nhập hàng từ', open ? 'đang bán: chợ đóng, đặt giao tận nơi' : 'chọn nơi mua'));
    body.appendChild(div('sup-list', sups.map((x) => supplierCard(x, x.id === sup.id, api))));
    body.appendChild(noteBox(sup.icon, sup.desc, sup.quality > 0 ? 'jade' : sup.quality < 0 ? 'red' : ''));
    if (open && sup.prepOnly) body.appendChild(noteBox('ui_lock', 'Đang bán không bỏ quầy đi chợ được. **Đặt qua app** hoặc nhập đủ hàng từ sáng nha.', 'gold'));
    cartBar(body, sup, api);
    if (s.event === 'haisan') body.appendChild(noteBox('ui_megaphone', 'Xoài vào mùa! **Xoài keo, xoài cát, trái cây Nhà Mình rẻ hơn 35%** hôm nay.', 'jade'));

    // ---- auto restock
    const hasMgr = D.hasStaff('quankho');
    if (hasMgr) body.appendChild(noteBox('role_quankho', 'Quản kho lo nhập trái cây, topping, món ăn kèm và ly hộp mỗi sáng, **không mất phí giao**. Đang bán mà món nào sắp hết (còn 2 phần) thì **tự chạy ra chợ mua về liền**.', 'jade'));

    // ---- lists
    const list = (title, sub, ids, isSupply) => {
      body.appendChild(secTitle(title, sub));
      ids.forEach((id) => itemRow(body, id, sup, api, { isSupply }));
    };
    list('Trái cây', `giá ${sup.name.split(' — ')[0].toLowerCase()} hôm nay`, C.INGREDIENTS.filter((i) => i.broth).map((i) => i.id), false);
    list('Topping', '', C.INGREDIENTS.filter((i) => !i.broth && !i.side).map((i) => i.id), false);
    list('Món ăn kèm', 'khách gọi thêm, thu tiền riêng', D.SIDES.map((i) => i.id), false);
    list('Vật tư: ly, hộp, túi…', 'không hết hạn', C.SUPPLIES.map((x) => x.id), true);
    body.appendChild(noteBox('sup_lylac', 'Mỗi phần bán ra tốn **1 ly hoặc 1 hộp** (hết là món đó ngưng bán), mỗi ly nước tốn **1 ly nhựa**. Túi, khăn giấy, xiên, đũa thiếu thì vẫn bán được nhưng **khách chấm điểm thấp hơn**.', ''));
    body.appendChild(noteBox('ui_kho', 'Trái cây, ớt, rau răm để được **2 ngày**, đồ khô và sốt **5 ngày** — mua vừa đủ kẻo bỏ phí nha.', 'jade'));
  },
};
