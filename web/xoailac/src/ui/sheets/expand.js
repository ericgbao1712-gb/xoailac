// Quán → Mở rộng (tier up) and Chi nhánh (Vietnam map, tier 5).
import { h, div, span, ico, svg } from '../dom.js';
import { ctx, act, G, S, sfx } from '../ctx.js';
import * as D from '../data.js';
import * as C from '../../config.js';
import { sceneThumbURL } from '../../art/index.js';
import { fmtShort, fmtMoney, fmtRating } from '../../core/format.js';
import { secTitle, noteBox, celebrate, floatAt, costBtn, lockCard, pips } from './common.js';

const vnNum = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');

function thumb(tier, cls = '') {
  const img = h('img', { class: 'pix thumb ' + cls, alt: '' });
  img.draggable = false;
  try { img.src = sceneThumbURL(tier, 2); } catch (e) { /* ignore */ }
  return img;
}

/** Core's tierInfo with a config-based fallback (sandbox / older Core). */
function tierInfo() {
  const r = G().get?.tierInfo?.();
  if (r && 'canExpand' in r) return r;
  const s = S(); const next = C.TIERS[s.tier] || null;
  if (!next) return { tier: s.tier, next: null, canExpand: false, reasons: [], cost: 0, require: null };
  const rq = next.require, reasons = [];
  if (s.level < rq.level) reasons.push(`Cần Lv ${rq.level} (đang Lv ${s.level})`);
  if (s.rating.avg < rq.rating || s.rating.count < 20) reasons.push(`Cần ${fmtRating(rq.rating)}★ với ít nhất 20 đánh giá`);
  if (s.money < next.cost) reasons.push(`Cần thêm ${fmtMoney(next.cost - s.money)} tiền`);
  return { tier: s.tier, next: next.id, canExpand: !reasons.length, reasons, cost: next.cost, require: rq };
}

function statLine(label, a, b, fmt = (v) => String(v)) {
  const better = b != null && b !== a;
  return div('xs-row', span('xs-l', label), span('num xs-a', fmt(a)), b != null ? [span('xs-arr', '→'), span('num xs-b' + (better ? ' up' : ''), fmt(b))] : null);
}

function tierCard(t, label, current) {
  return div('card tcard' + (current ? ' cur' : ''), span('tlabel', label), thumb(t.id), h('b', { class: 'tname' }, t.name), h('p', { class: 'tdesc' }, t.desc));
}

export function expandView(body, api) {
  const s = S();
  const info = tierInfo();
  const cur = C.TIERS[(s.tier || 1) - 1];
  const next = info.next ? C.TIERS[info.next - 1] : null;

  if (!next) {
    body.appendChild(tierCard(cur, 'Quán hiện tại', true));
    body.appendChild(noteBox('ui_star', 'Bạn đã có **Chuỗi Xoài Lắc Nhà Mình** rồi! Qua tab **Chi nhánh** mở thêm quán khắp Việt Nam nha.', 'gold'));
    return;
  }

  body.appendChild(div('tpair', tierCard(cur, 'Hiện tại', true), span('tarrow', ico('ui_up', 32)), tierCard(next, 'Mở rộng', false)));

  const stats = div('card xstats');
  stats.appendChild(statLine('Bàn tối đa', cur.maxTables, next.maxTables));
  stats.appendChild(statLine('Kho chứa', cur.kho, next.kho));
  stats.appendChild(statLine('Lượng khách', cur.demand, next.demand, (v) => '×' + vnNum(v)));
  stats.appendChild(statLine('Tiền thuê / ngày', cur.rent, next.rent, (v) => (v ? fmtShort(v) : '0')));
  body.appendChild(stats);

  // requirement checklist
  const rq = next.require;
  const lvOk = s.level >= rq.level;
  const rtOk = s.rating.avg >= rq.rating && s.rating.count >= 20;
  const moOk = s.money + 1e-9 >= next.cost;
  const req = (ok, text, now) => div('req' + (ok ? ' ok' : ''), span('rk', ok ? ico('ui_check', 16) : ico('ui_lock', 16)), span('rt', text), span('num rn', now));
  body.appendChild(secTitle('Điều kiện để mở rộng'));
  body.appendChild(div('card reqs',
    req(lvOk, `Cấp độ ${rq.level}`, `Lv ${s.level}`),
    req(rtOk, `${fmtRating(rq.rating)}★ (từ 20 lượt đánh giá)`, `${fmtRating(s.rating.avg)}★ · ${s.rating.count}`),
    req(moOk, `Tiền dọn quán ${fmtShort(next.cost)}`, fmtShort(s.money))));

  const open = D.isOpenPhase();
  const btn = h('button', { class: 'btn lg block ' + (info.canExpand && !open ? 'red' : 'off'), 'data-tut': 'expand' }, ico('ui_shop', 32), 'Mở rộng quán', span('num', fmtShort(next.cost)));
  btn.addEventListener('click', () => {
    if (open) { ctx.toast('Đóng cửa rồi mới dọn sang quán mới được nha!', 'bad'); sfx('error'); return; }
    if (!info.canExpand) { ctx.toast(info.reasons?.[0] || 'Chưa đủ điều kiện nha.', 'bad'); sfx('error'); btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); return; }
    ctx.confirm({
      title: 'Dọn sang quán mới?', icon: 'ui_shop', yes: 'Dọn thôi!', no: 'Để sau',
      text: `${next.name} tốn ${fmtMoney(next.cost)}. Bàn, quầy lắc sẽ về mức khởi điểm của quán mới nhưng đồ nghề và thực đơn vẫn giữ nguyên nha.`,
      onYes: () => { const r = act('expandTier'); if (r.ok !== false) { api.rerender(); } },
    });
  });
  body.appendChild(btn);
  if (!info.canExpand && info.reasons?.length) body.appendChild(h('p', { class: 'muted sm xhint' }, info.reasons[0]));
}

// ------------------------------------------------------------------ Chi nhánh
// Stylised Vietnam outline in a 200×300 box + pin positions (same box, %).
const VN_PATH = 'M40 10 L80 5 L105 18 L130 12 L142 30 L120 55 L110 75 L113 95 L126 115 L129 140 L139 165 L151 185 L153 205 L161 225 L166 245 L151 262 L136 275 L119 286 L97 292 L76 298 L60 292 L65 275 L82 262 L95 248 L105 225 L100 205 L90 190 L96 165 L84 140 L75 120 L62 100 L50 85 L38 70 L28 50 L30 30 Z';
const PINS = { hanoi: [96, 50], danang: [143, 172], dalat: [104, 210], vungtau: [144, 282], cantho: [72, 279], phuquoc: [30, 262] };

function vnMap(onPick) {
  const s = S();
  const map = div('vnmap');
  const sv = svg('svg', { viewBox: '0 0 200 300', class: 'vnsvg', 'aria-hidden': 'true', 'shape-rendering': 'crispEdges' },
    svg('path', { d: VN_PATH, class: 'vnland' }),
    svg('path', { d: 'M150 130 L172 118 L182 140 L168 152 Z M158 214 L178 206 L184 226 L166 236 Z', class: 'vnisle', opacity: '0' }));
  map.appendChild(sv);
  C.BRANCHES.forEach((b) => {
    const lvl = s.branches?.[b.id] || 0;
    const [x, y] = PINS[b.id] || [100, 150];
    const pin = h('button', { class: 'pin' + (lvl ? ' open' : '') + (s.homeCity === b.id ? ' home' : ''), style: { left: (x / 2) + '%', top: (y / 3) + '%' }, 'aria-label': b.name },
      span('pin-dot', lvl ? span('num', String(lvl)) : ico('ui_lock', 16)), span('pin-name', b.name));
    pin.addEventListener('click', () => { sfx('click'); onPick(b.id); });
    map.appendChild(pin);
  });
  const hq = h('div', { class: 'pin hq' + (s.homeCity ? ' was' : ''), style: { left: '76%', top: '80%' } }, span('pin-dot', ico('ui_shop', 16)), span('pin-name', 'TP.HCM'));
  map.appendChild(hq);
  return map;
}

export function branchesView(body, api) {
  const s = S();
  if (D.tierNow() < 5) { body.appendChild(lockCard('Chi nhánh', 'Mở rộng thành Chuỗi Xoài Lắc Nhà Mình rồi mới mở chi nhánh khắp Việt Nam được nha.', 'ui_map')); return; }
  const lvls = C.BRANCHES.map((b) => s.branches?.[b.id] || 0);
  const open = C.BRANCHES.filter((b, i) => !b.bonus && lvls[i] > 0).length;
  const mainN = C.BRANCHES.filter((b) => !b.bonus).length;
  const bMax = G().get?.branchMax?.() ?? C.BRANCH.maxLevel;
  const bs = C.branchScale(s);
  const rate = C.BRANCHES.reduce((a, b, i) => a + b.income * bs * lvls[i], 0);

  const cards = {};
  body.appendChild(vnMap((id) => { const el = cards[id]; if (!el) return; el.scrollIntoView({ block: 'center', behavior: ctx.reduced ? 'auto' : 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }));
  body.appendChild(div('card bsum', div('grow', h('b', null, `${open}/${mainN} chi nhánh`), span('muted sm', `Mở đủ ${mainN} nơi là hoàn thành hành trình nha!`)),
    span('chip gold', ico('ui_coin', 16), span('num', '+' + vnNum(rate) + 'k/giây'))));
  // v2.6.7 dời quán chính: pick any city with an open branch; only the view changes
  const home = C.BRANCHES.find((b) => b.id === s.homeCity);
  const homeCard = div('card bsum home-city', ico('ui_shop', 32),
    div('grow', h('b', null, 'Quán chính: ' + (home ? home.name : 'TP.HCM')),
      span('muted sm', home ? 'Đổi cảnh quầy sang thành phố này. Tiền, khách và cấp quán vẫn như cũ.' : 'Mở chi nhánh ở thành phố nào thì dời quán chính tới đó được, để đổi cảnh quầy.')));
  if (home) {
    const back = h('button', { class: 'btn paper sm' }, 'Về TP.HCM');
    back.addEventListener('click', () => { sfx('click'); const r = act('setHomeCity', null); if (r && r.ok === false) return; api.rerender(); });
    homeCard.appendChild(back);
  }
  body.appendChild(homeCard);
  body.appendChild(secTitle('Các chi nhánh', 'tiền về cả khi bạn đi vắng'));

  C.BRANCHES.forEach((b, i) => {
    const lvl = lvls[i];
    const card = div('card br' + (lvl ? ' open' : ''));
    cards[b.id] = card;
    card.appendChild(div('br-top', div('br-pin', span('num', lvl ? String(lvl) : '?')), div('grow', h('b', null, b.name), span('muted sm', b.dish)),
      lvl ? span('chip gold', ico('ui_coin', 16), span('num', '+' + vnNum(b.income * bs * lvl) + 'k/s')) : span('chip', 'Chưa mở')));
    const bot = div('br-bot');
    if (!lvl && b.minLevel && s.level < b.minLevel) {
      bot.appendChild(span('muted sm', `Mở ở Lv ${b.minLevel} · thu nhập ${vnNum(b.income * bs)}k mỗi giây`));
      bot.appendChild(span('chip', ico('ui_lock', 16), 'Lv ' + b.minLevel));
    } else if (!lvl) {
      bot.appendChild(span('muted sm', `Thu nhập ${vnNum(b.income * bs)}k mỗi giây`));
      bot.appendChild(costBtn(b.cost, { can: s.money >= b.cost, label: 'Khai trương', cls: 'red',
        onClick: (btn) => { const r = act('openBranch', b.id); if (r.ok === false) return; celebrate(btn); ctx.fx?.confetti?.(document.getElementById('fx-root'), { count: 40, duration: 1.4 }); api.rerender(); } }));
    } else {
      bot.appendChild(pips(lvl, bMax));
      if (lvl >= bMax) bot.appendChild(span('chip jade', ico('ui_check', 16), 'Tối đa'));
      else {
        const cost = C.BRANCH.upgradeCost(b, lvl);
        bot.appendChild(costBtn(cost, { can: s.money >= cost, label: 'Nâng cấp',
          onClick: (btn) => { const r = act('upgradeBranch', b.id); if (r.ok === false) return; celebrate(btn); floatAt(btn, 'Lên cấp ' + (lvl + 1), '#2f9a8a'); api.rerender(); } }));
      }
    }
    card.appendChild(bot);
    if (lvl) {                                        // v2.6.7: move the main shop here (scene only)
      const mv = div('br-bot br-home');
      if (s.homeCity === b.id) mv.appendChild(span('chip jade', ico('ui_check', 16), 'Quán chính đang ở đây'));
      else {
        mv.appendChild(span('muted sm', 'Đổi cảnh quầy sang ' + b.name));
        const go = h('button', { class: 'btn jade sm' }, ico('ui_shop', 16), 'Dời quán chính tới đây');
        go.addEventListener('click', () => { sfx('click'); const r = act('setHomeCity', b.id); if (r && r.ok === false) return; celebrate(go); api.rerender(); });
        mv.appendChild(go);
      }
      card.appendChild(mv);
    }
    body.appendChild(card);
  });
}
