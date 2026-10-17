// Sheet 2 — Thực đơn: dishes (enable, recipe level, mastery) + drinks + món ăn kèm. Prices live in Nâng cấp ▸ Giá bán.
import { h, div, span, ico } from '../dom.js';
import { act, sfx, S } from '../ctx.js';
import * as D from '../data.js';
import * as C from '../../config.js';
import { fmtShort, fmtMoney } from '../../core/format.js';
import { secTitle, noteBox, celebrate, floatAt, toggle, costBtn, pips, stars, unitPrice } from './common.js';
import { ctx } from '../ctx.js';

/** Selling-price editor for one dish: −5 −1 [price] +1 +5, reference, cost, profit, how guests will react. */
export function priceRow(p, api) {
  const pi = ctx.game.get?.priceInfo?.(p.id);
  if (!pi) return null;
  if (!D.featureOn('pricing')) return div('price-ed', div('pe-row', ico('ui_lock', 32, 'pe-tag'), div('pe-lbl', span('pe-t', 'Tự đặt giá bán'), span('muted sm', `Mở ở Lv ${C.FEATURES.pricing} — tạm bán giá gợi ý ${fmtShort(pi.ref)}`))));
  const set = (v) => {
    const r = act('setPrice', p.id, v);
    if (r.ok === false) { sfx('error'); if (r.msg) ctx.toast(r.msg, 'bad'); return; }
    sfx('click'); api.rerender();
  };
  const step = (d) => {
    const b = h('button', { class: 'pstep', 'aria-label': (d > 0 ? 'Tăng ' : 'Giảm ') + Math.abs(d) + 'k' }, (d > 0 ? '+' : '−') + Math.abs(d));
    const v = pi.price + d;
    if (v < pi.min || v > pi.max) b.disabled = true;
    b.addEventListener('click', () => set(Math.max(pi.min, Math.min(pi.max, pi.price + d))));
    return b;
  };
  const bandTxt = { cheap: 'Giá rẻ', normal: 'Giá vừa', pricey: 'Giá cao' }[pi.band];
  const refusePct = Math.round(pi.refuse * 100);
  const reset = pi.custom ? h('button', { class: 'plink', onclick: () => set(null) }, 'Về giá gợi ý') : null;
  return div('price-ed band-' + pi.band,
    div('pe-row',
      ico('ui_tag', 32, 'pe-tag'),
      div('pe-lbl', span('pe-t', 'Giá bán'), span('chip ' + (pi.band === 'cheap' ? 'jade' : pi.band === 'pricey' ? 'red' : 'gold'), bandTxt)),
      div('pe-ctl', step(-5), step(-1), span('num pe-v', fmtShort(pi.price)), step(1), step(5))),
    div('pe-info',
      span('', 'Gợi ý ' + fmtShort(pi.ref)), span('', 'Vốn ~' + unitPrice(pi.cost)),
      span(pi.profit > 0 ? 'pe-ok' : 'pe-bad', 'Lời ' + unitPrice(pi.profit) + '/phần'),
      span('', '≈ ' + refusePct + '% khách chê đắt'), reset));
}

function potCard(p, api, fresh) {
  const info = D.recipeInfo(p.id);
  const s = S();
  if (!info.unlocked) {
    return div('card pot locked',
      div('pot-top', div('pot-ico', ico(p.icon, 48, 'dim')),
        div('pot-info', h('b', null, p.name), span('muted', 'Mở ở Lv ' + p.unlockLv),
          div('recipe', p.recipe.map((i) => ico(D.ING[i].icon, 16, 'dim')))),
        ico('ui_lock', 32)));
  }
  const on = !!info.enabled;
  const card = div('card pot' + (on ? '' : ' off') + (fresh ? ' fresh' : ''));
  const rc = div('recipe');
  p.recipe.forEach((i) => {
    const out = D.stock(i) < 1;
    rc.appendChild(div('ri' + (out ? ' out' : ''), ico(D.ING[i].icon, 16)));
  });
  card.appendChild(div('pot-top',
    div('pot-ico', ico(p.icon, 48)),
    div('pot-info',
      div('pn', h('b', null, p.name), fresh ? span('newtag', 'Mới!') : null),
      div('pp', span('num', fmtShort(D.sellPrice ? D.sellPrice(p.id) : info.price)), span('muted', '/phần')),
      rc),
    toggle(on, () => { const r = act('toggleMenuItem', p.id); if (r.ok !== false) api.rerender(); }, 'Bán ' + p.name)));
  // the price editor lives in its own tab (Nâng cấp ▸ Giá bán) so this card stays calm
  if (D.featureOn('pricing')) card.appendChild(h('button', { class: 'plink go-price', onclick: () => { sfx('click'); ctx.openSheet('upgrade', 'gia'); } }, ico('ui_tag', 16), 'Chỉnh giá bán ›'));
  // recipe level + mastery
  const maxed = info.cost == null;
  card.appendChild(div('pot-mid',
    div('lv', span('lb', 'Công thức'), pips(info.lvl, info.max), span('num', `${info.lvl}/${info.max}`)),
    div('mast', span('lb', 'Sổ công thức'), stars(info.mastery, 4, 16, 'gold'),
      span('muted sm', info.nextMastery ? `${info.sold}/${info.nextMastery} phần` : `đã bán ${info.sold} phần`))));
  const bot = div('pot-bot');
  bot.appendChild(span('muted sm', maxed ? 'Công thức đã đạt tối đa!' : `Lên cấp ${info.lvl + 1}: ngon hơn, gợi ý ${fmtShort(info.nextPrice)}`));
  if (!maxed) {
    const b = costBtn(info.cost, {
      can: info.canUpgrade, label: 'Nâng ▲',
      onClick: (btn) => { const r = act('upgradeRecipe', p.id); if (r.ok === false) return; celebrate(btn); floatAt(btn, 'Lên cấp ' + (r.lvl ?? info.lvl + 1) + '!', '#e08e2b'); api.rerender(); },
    });
    bot.appendChild(b);
  }
  card.appendChild(bot);
  return card;
}

export const menuSheet = {
  title: 'Thực đơn',
  icon: 'ui_menu',
  build(body, api) {
    api.noTabs();
    const s = S();
    const enabled = C.HOTPOTS.filter((p) => s.menu?.[p.id] && D.potUnlocked(p.id)).length;
    body.appendChild(secTitle('Các món lắc', `${enabled} món đang bán`));
    const fresh = [];
    C.HOTPOTS.forEach((p) => {
      const isNew = p.unlockLv > 1 && D.potUnlocked(p.id) && !D.seen('pot:' + p.id);
      if (isNew) fresh.push(p.id);
      body.appendChild(potCard(p, api, isNew));
    });
    fresh.forEach((id) => D.markSeen('pot:' + id));

    body.appendChild(secTitle('Nước uống', 'tự tính vốn, không cần nhập kho'));
    C.DRINKS.forEach((d) => {
      const ok = D.drinkUnlocked(d.id);
      body.appendChild(div('card row drink' + (ok ? '' : ' locked'),
        ico(d.icon, 32, ok ? '' : 'dim'),
        div('grow', h('b', null, d.name), span('muted', ok ? `Vốn ${fmtShort(d.cost)} · lời ${fmtShort(d.price - d.cost)}` : 'Mở ở Lv ' + d.unlockLv)),
        ok ? div('dp', span('num', fmtShort(d.price))) : ico('ui_lock', 32)));
    });
    // v2.5 món ăn kèm
    const sides = D.SIDES;
    const open = sides.filter((x) => D.ingUnlocked(x.id)).length;
    body.appendChild(secTitle('Món ăn kèm', `${open}/${sides.length} món đã mở`));
    const box = div('card side-list');
    sides.forEach((x) => {
      const ok = D.ingUnlocked(x.id), n = D.stock(x.id);
      box.appendChild(div('side-row' + (ok ? '' : ' locked'),
        ico(x.icon, 32, ok ? '' : 'dim'),
        div('grow', h('b', null, x.name), span('muted sm', `Thu thêm ${fmtShort(x.side)} · vốn ${fmtShort(x.cost)} · giữ ${x.shelf} ngày`)),
        ok ? span('chip ' + (n > 0 ? 'jade' : 'red'), n > 0 ? `Kho: ${n}` : 'Hết hàng') : span('chip lockchip', ico('ui_lock', 16), x.quest ? 'Nhiệm vụ' : 'Lv ' + x.unlockLv)));
      if (!ok && x.quest) box.lastChild.title = D.lockText(x.id);
    });
    body.appendChild(box);
    body.appendChild(noteBox('ak_cavien', 'Khách thỉnh thoảng gọi thêm **món ăn kèm** nếu kho còn hàng. Nhập ở **Kho ▸ Món ăn kèm**, khi soạn phiếu bấm nút **Ăn kèm** rồi mới lắc. Món khoá theo cấp hoặc theo **nhiệm vụ chính**.', ''));
    body.appendChild(noteBox('ui_info', 'Mỗi phần cần **đủ trái cây, topping và một ly/hộp** trong kho mới bán được. Món nào hết hàng sẽ **mờ** ở quầy.', ''));
  },
};
