// v2.5: Nâng cấp ▸ Giá bán — the selling-price editor on its own tab (it used to sit inside every Thực đơn card).
// One compact card per dish: icon, name, suggested price and cost, the − / + stepper, and one short line about
// profit and how many guests will find it too dear.
import { h, div, span, ico } from '../dom.js';
import { ctx, act, sfx, S } from '../ctx.js';
import * as D from '../data.js';
import * as C from '../../config.js';
import { fmtShort } from '../../core/format.js';
import { noteBox, lockCard, unitPrice, secTitle } from './common.js';

function priceCard(p, api) {
  const pi = ctx.game.get?.priceInfo?.(p.id);
  if (!pi) return null;
  const set = (v) => {
    const r = act('setPrice', p.id, v);
    if (r.ok === false) { sfx('error'); return; }
    sfx('click'); api.rerender();
  };
  const step = (d, big) => {
    const v = pi.price + d;
    return h('button', {
      class: 'pstep' + (big ? ' big' : ''), type: 'button', disabled: v < pi.min || v > pi.max,
      'aria-label': (d > 0 ? 'Tăng ' : 'Giảm ') + Math.abs(d) + 'k', onclick: () => set(Math.max(pi.min, Math.min(pi.max, v))),
    }, d > 0 ? '+' : '−');
  };
  const band = { cheap: ['jade', 'Rẻ'], normal: ['gold', 'Vừa'], pricey: ['red', 'Cao'] }[pi.band] || ['gold', 'Vừa'];
  const on = !!S().menu?.[p.id];
  return div('card pc-card band-' + pi.band + (on ? '' : ' off'),
    div('pc-top',
      ico(p.icon, 32, 'pc-ico'),
      div('pc-name', h('b', null, p.name), span('muted sm', `Gợi ý ${fmtShort(pi.ref)} · vốn ~${unitPrice(pi.cost)}`)),
      div('pc-ctl', step(-1), span('num pc-v', fmtShort(pi.price)), step(1))),
    div('pc-info',
      span('chip ' + band[0], band[1]),
      span(pi.profit > 0 ? 'pe-ok' : 'pe-bad', 'Lời ' + unitPrice(pi.profit) + '/phần'),
      span('muted', '≈ ' + Math.round(pi.refuse * 100) + '% khách chê đắt'),
      h('span', { class: 'pc-fast' }, h('button', { class: 'plink', type: 'button', onclick: () => set(Math.max(pi.min, pi.price - 5)) }, '−5'),
        h('button', { class: 'plink', type: 'button', onclick: () => set(Math.min(pi.max, pi.price + 5)) }, '+5'),
        pi.custom ? h('button', { class: 'plink', type: 'button', onclick: () => set(null) }, 'Về gợi ý') : null)));
}

export function pricesView(body, api) {
  if (!D.featureOn('pricing')) { body.appendChild(lockCard('Tự đặt giá bán', `Mở ở Lv ${C.FEATURES.pricing}. Tới lúc đó món bán theo giá gợi ý.`, 'ui_tag')); return; }
  const dm = ctx.game.get?.menuPriceDemand?.() ?? 1;
  const pct = Math.round((dm - 1) * 100);
  body.appendChild(noteBox('ui_tag', `Rẻ thì đông khách nhưng lời ít, đắt thì lời nhiều mỗi phần nhưng có người chê bỏ đi. Mặt bằng giá hiện tại: khách ghé **${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%**.`, pct > 3 ? 'jade' : pct < -3 ? 'red' : ''));
  const pots = C.HOTPOTS.filter((p) => D.potUnlocked(p.id));
  body.appendChild(secTitle('Món lắc', pots.length + ' món'));
  pots.forEach((p) => { const c = priceCard(p, api); if (c) body.appendChild(c); });
  const sides = D.SIDES.filter((x) => D.ingUnlocked(x.id));
  if (sides.length) {
    body.appendChild(secTitle('Món ăn kèm', 'giá cố định'));
    body.appendChild(div('card side-list', ...sides.map((x) => div('side-row', ico(x.icon, 32), div('grow', h('b', null, x.name), span('muted sm', `vốn ${fmtShort(x.cost)}`)), span('num pc-v', fmtShort(x.side))))));
  }
}
