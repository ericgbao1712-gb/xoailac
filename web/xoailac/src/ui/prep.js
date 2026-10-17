// Prep phase panel (shown instead of the dock before opening): weather/event, shopping tips, marketing, MỞ HÀNG.
import * as C from '../config.js';
import { fmtShort, fmtClock, weekday } from '../core/format.js';
import { h, div, span, ico, setIco, clear, setShown } from './dom.js';
import { ctx, S, act, sfx } from './ctx.js';
import { ING, POT, MKT, buyPrice, stock, ingUnlocked, featureOn, weatherEffect, eventInfo, wxIcon, khoInfo } from './data.js';

export function mountPrep(root) {
  const el = div('prep');
  const wxI = ico('wx_sun', 32, 'pwx');
  const dayT = h('b', null, ''); const wxN = span('pwn', ''); const wxE = div('pwe', '');
  const evChip = div('pev'); evChip.hidden = true;
  const expChip = div('pev pexp'); expChip.hidden = true;
  const head = div('phead', wxI, div('pht', div('pdl', dayT, wxN), wxE, evChip, expChip));
  const sugg = div('psugg');
  const mkt = div('pmkt');
  const resv = div('presv');
  const openBtn = h('button', { class: 'btn red lg block openbtn', dataset: { tut: 'open-btn' } }, ico('ui_fire', 32), span('', 'MỞ HÀNG'));
  openBtn.addEventListener('click', onOpen);
  el.append(head, sugg, mkt, resv, openBtn);
  root.appendChild(el);

  // After an expansion the busier shop eats stock faster: nudge the player to restock (pulsing "Mua hết" + one Má message).
  // flags.ui.restockHint: 1 = pending (Má not shown yet), 2 = Má already said it. Cleared once the stock is fine again.
  const hint = () => S().flags?.ui?.restockHint | 0;
  const setHint = (v) => { if (hint() !== v) ctx.game.act?.setFlag?.('restockHint', v); };
  ctx.game.on?.('tierUp', () => setHint(1));
  const usedIngs = () => {
    const s = S(); const used = new Set();
    C.HOTPOTS.filter((p) => s.menu?.[p.id] && (ctx.game.get?.isPotUnlocked?.(p.id) ?? s.level >= p.unlockLv)).forEach((p) => p.recipe.forEach((i) => used.add(i)));
    return [...used].filter((id) => ingUnlocked(id));
  };
  const restockFloor = () => 10 + 5 * ((S().tier || 1) - 1);
  const stockLow = () => usedIngs().filter((id) => stock(id) < restockFloor()).length >= 2;

  function onOpen() {
    sfx('click');
    setHint(0);
    const go = () => { const r = act('openShop'); if (r.ok !== false) { sfx('door'); ctx.tutorial?.onAction?.('open'); } };
    const avail = ctx.game.get?.availablePots?.();
    if (Array.isArray(avail) && avail.length === 0 && S().started) {
      ctx.confirm({ title: 'Kho trống trơn!', text: 'Chưa đủ trái cây và topping để lắc món nào. Mở hàng bây giờ khách sẽ bỏ về hết đó. Đi chợ trước nha?', yes: 'Cứ mở', no: 'Đi chợ', danger: true, icon: 'ui_kho', onYes: go, onNo: () => ctx.openSheet('kho') });
      return;
    }
    go();
  }

  // suggestions from yesterday's usage
  function suggestions() {
    const s = S(); const out = [];
    const enabled = C.HOTPOTS.filter((p) => s.menu?.[p.id] && (ctx.game.get?.isPotUnlocked?.(p.id) ?? s.level >= p.unlockLv));
    const used = new Set(); enabled.forEach((p) => p.recipe.forEach((i) => used.add(i)));
    const k = khoInfo(); let space = Math.max(0, k.cap - k.used);
    [...used].filter((id) => ingUnlocked(id)).forEach((id) => {
      const y = s.usageYesterday?.[id] || 0;
      const target = Math.max(8, Math.ceil(y * (s.soldOutYesterday ? C.MARKET.soldOutTargetMult : C.MARKET.autoBuyTargetMult)), hint() ? restockFloor() + 8 : 0);
      const need = target - stock(id);
      if (need >= 3) out.push({ id, qty: need });
    });
    out.sort((a, b) => b.qty * ING[b.id].cost - a.qty * ING[a.id].cost);
    return { list: out, space };
  }

  let sig = '';
  function render() {
    const s = S();
    const w = C.WEATHER[s.weather] || C.WEATHER.sun;
    setIco(wxI, wxIcon(s.weather), 32);
    dayT.textContent = `Ngày ${s.day} · ${weekday(s.day)}`;
    wxN.textContent = ' · ' + w.name;
    wxE.textContent = weatherEffect(s.weather, s.upgrades || {});
    const ev = s.event ? eventInfo(s.event) : null;
    evChip.hidden = !ev;
    if (ev) { clear(evChip); evChip.append(ico('ui_calendar', 16), span('', `${ev.name}: ${ev.desc}`)); }
    const ex = s.expired && s.expired.day === s.day ? s.expired : null;
    expChip.hidden = !ex;
    if (ex) {
      clear(expChip);
      const top = Object.entries(ex.items).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${n} ${ING[id].short.toLowerCase()}`).join(', ');
      expChip.append(ico('ui_trash', 16), span('', `Bỏ ${ex.total} phần hết hạn (${top}) — mua vừa đủ thôi nha`));
    }

    // shopping
    clear(sugg);
    const { list, space } = suggestions();
    const lab = div('plabel', ico('ui_kho', 16), span('', 'Đi chợ nhanh'));
    sugg.appendChild(lab);
    if (!list.length) sugg.appendChild(div('pnone', 'Kho đủ hàng rồi — mở cửa thôi!'));
    else {
      const row = div('pchips');
      let total = 0; const buys = [];
      list.slice(0, 6).forEach((it) => {
        const qty = Math.max(1, Math.min(it.qty, space));
        const cost = buyPrice(it.id) * qty; total += cost; buys.push([it.id, qty]);
        const b = h('button', { class: 'pchip', onclick: () => { const r = act('buyIngredient', it.id, qty); if (r.ok !== false) { sfx('cash'); ctx.toast(`Đã mua ${r.qty || qty} ${ING[it.id].name.toLowerCase()}`, 'good', ING[it.id].icon); } render(); } },
          ico(ING[it.id].icon, 32), div('pcq', span('pcn', '+' + qty), span('pcc', fmtShort(cost))));
        row.appendChild(b);
      });
      sugg.appendChild(row);
      const nudge = hint() && stockLow();
      lab.appendChild(h('button', { class: 'btn jade sm body buyall' + (nudge ? ' nudge' : ''), onclick: () => { let n = 0; buys.forEach(([id, q]) => { const r = ctx.game.act?.buyIngredient?.(id, q); if (r?.ok !== false) n++; }); if (n) { sfx('cash'); setHint(0); ctx.toast('Đã đi chợ xong!', 'good', 'ui_kho'); } else { sfx('error'); ctx.toast('Không đủ tiền hoặc kho đầy rồi nha.', 'bad'); } render(); } },
        span('', 'Mua hết'), span('num', fmtShort(total))));
    }

    // marketing
    clear(mkt);
    const ms = C.MARKETING.filter((m) => s.level >= m.unlockLv && (m.id !== 'reviewer' || featureOn('mkt_reviewer')) && (m.id !== 'livestream' || featureOn('mkt_livestream')));
    if (ms.length) {
      mkt.appendChild(div('plabel', ico('ui_megaphone', 16), span('', 'Quảng bá hôm nay')));
      const row = div('pchips');
      ms.forEach((m) => {
        const done = !!s.marketingToday?.[m.id];
        const cost = m.cost * (m.scale ? C.TIER_MULT[(s.tier || 1) - 1] : 1);
        row.appendChild(h('button', { class: 'mchip' + (done ? ' done' : ''), onclick: () => { if (done) return; const r = act('buyMarketing', m.id); if (r.ok !== false) { sfx('cash'); ctx.toast(m.name + ' xong rồi!', 'good', m.icon); } render(); } },
          ico(m.icon, 32), div('mcq', span('mcn', m.name.replace('Khuyến mãi giảm 10%', 'Giảm 10%').replace('Livestream bán hàng', 'Livestream').replace('Mời Food Reviewer', 'Mời Reviewer').replace('Phát tờ rơi', 'Tờ rơi')), span('mcc', done ? 'Đã làm ✓' : (cost ? fmtShort(cost) : 'Miễn phí')))));
      });
      mkt.appendChild(row);
    }

    // reservations
    clear(resv);
    const rs = (s.reservations || []).filter((r) => r.status !== 'done' && r.status !== 'missed').slice(0, 2);
    if (rs.length && featureOn('reservations')) {
      resv.appendChild(div('plabel', ico('ui_reserve', 16), span('', 'Khách đặt trước')));
      rs.forEach((r) => resv.appendChild(div('prow', span('', fmtClock(r.clock)), span('', `${C.CUSTOMERS[r.kind]?.name || 'Khách'} · ${r.size} người`), r.pot ? ico(POT[r.pot]?.icon || 'pot_ga', 16) : null)));
    }
    sig = curSig();
  }
  const curSig = () => { const s = S(); return [s.day, s.weather, s.event, s.money, s.level, JSON.stringify(s.marketingToday), JSON.stringify(s.inventory), s.menu && JSON.stringify(s.menu), (s.reservations || []).length, s.tier, hint()].join('|'); };

  let acc = 1, wasShown = false;
  function update(dt) {
    const on = S().phase === 'prep' || S().phase === 'report';
    setShown(el, on);
    if (!on) { wasShown = false; return; }
    acc += dt;
    if (S().phase === 'prep' && hint()) {
      if (!stockLow()) setHint(0);
      else if (hint() === 1 && ctx.modalCount() === 0) { setHint(2); ctx.mom('Quán mới đông khách hơn — nhớ nhập thêm hàng nha!'); }
    }
    if (!wasShown) { wasShown = true; render(); acc = 0; return; }
    if (acc > 0.4) { acc = 0; if (curSig() !== sig) render(); }
  }
  return { update, render, openBtn };
}
