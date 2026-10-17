// Sheet 3 — Nâng cấp: category tabs, a card per upgrade.
import { h, div, span, ico } from '../dom.js';
import { ctx, act, G } from '../ctx.js';
import * as D from '../data.js';
import * as C from '../../config.js';
import { fmtShort } from '../../core/format.js';
import { celebrate, floatAt, costBtn, pips, noteBox } from './common.js';
import { pricesView } from './prices.js';
import { songPicker } from '../songs.js';

const CAT_ICON = { banghe: 'eq_table', bep: 'eq_stove', thietbi: 'eq_fridge', quangba: 'ui_megaphone' };
const info = (id) => G().get?.upgradeInfo?.(id) || { level: 0, max: 0, cost: null, canBuy: false, lockedReason: null, levelName: '', nextLevelName: null };

function upCard(up, api) {
  const i = info(up.id);
  const maxed = i.cost == null;
  const card = div('card up' + (maxed ? ' maxed' : i.canBuy ? ' can' : '') + (i.lockedReason ? ' locked-up' : ''));
  const icon = div('up-ico', ico(up.icon, 48), i.max > 0 ? span('lvb num', maxed ? 'MAX' : 'Lv' + i.level) : null);
  const names = div('up-names',
    span('cur', i.levelName || 'Chưa có'),
    !maxed && i.nextLevelName ? [span('arrow', '→'), span('nxt', i.nextLevelName)] : null);
  card.appendChild(div('up-top', icon, div('up-info', h('b', null, up.name), names, h('p', null, up.desc))));
  const bot = div('up-bot', i.max > 0 ? pips(i.level, i.max) : span(''));
  if (maxed) {
    bot.appendChild(span('chip jade', ico('ui_check', 16), 'Tối đa'));
  } else {
    if (i.lockedReason) bot.appendChild(span('chip red', ico('ui_lock', 16), i.lockedReason));
    bot.appendChild(costBtn(i.cost, {
      can: i.canBuy, label: 'Mua', cls: i.canBuy ? 'jade' : 'jade',
      onClick: (btn) => {
        const r = act('buyUpgrade', up.id);
        if (r.ok === false) return;
        celebrate(btn); floatAt(btn, 'Đã nâng cấp!', '#2f9a8a');
        ctx.tutorial?.onAction?.('upgrade', up.id);
        api.rerender();
      },
    }));
  }
  card.appendChild(bot);
  if (up.id === 'speaker') card.appendChild(songPicker({ compact: true }));   // v2.6.21 chọn bài ngay trên thẻ Loa nhạc
  return card;
}

export const upgradeSheet = {
  title: 'Nâng cấp quán',
  icon: 'ui_upgrade',
  build(body, api) {
    const cats = C.UPGRADE_CATS;
    let sub = api.sub;
    if (sub !== 'gia' && !cats.some((c) => c.id === sub)) sub = cats.find((c) => C.UPGRADES.some((u) => u.cat === c.id && info(u.id).canBuy))?.id || cats[0].id;
    // v2.5: prices get their own tab, after the upgrade categories
    api.tabs(cats.map((c) => ({ id: c.id, label: c.name, icon: CAT_ICON[c.id], dot: C.UPGRADES.some((u) => u.cat === c.id && info(u.id).canBuy) }))
      .concat([{ id: 'gia', label: 'Giá bán', icon: 'ui_tag', locked: !D.featureOn('pricing') }]), sub, (id) => api.setSub(id));
    if (sub === 'gia') { pricesView(body, api); return; }
    const list = C.UPGRADES.filter((u) => u.cat === sub);
    if (!list.length) body.appendChild(div('nodata', 'Chưa có gì để nâng cấp ở mục này.'));
    list.forEach((u) => body.appendChild(upCard(u, api)));
    if (sub === 'bep' && D.tierNow() >= 1) body.appendChild(noteBox('ui_info', 'Trái cây mua sẵn ở **Kho** như topping. Quầy xịn thì món ngon hơn, dao bén thì thợ lắc soạn phần nhanh hơn.'));
    if (sub === 'quangba') body.appendChild(noteBox('ui_megaphone', 'Muốn kéo khách trong ngày? Vào **Quán ▸ Quảng bá** nha.'));
  },
};
