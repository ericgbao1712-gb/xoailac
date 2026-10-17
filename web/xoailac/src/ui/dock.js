// Kitchen dock (open phase): ticket strip, broth row, tray, ingredient keys, drinks, serve.
import * as C from '../config.js';
import { h, div, span, ico, setIco, setText, setClass, setStyleVar, setShown, clear, onPress, store, vibrate } from './dom.js';
import { ctx, S, G, act, sfx } from './ctx.js';
import { ING, POT, DRINK, stock, ingUnlocked, staffCount } from './data.js';
import { stampURL } from './looks.js';
import { activeLooks } from '../core/looks.js';

const KEYS = C.INGREDIENTS.filter((i) => !i.broth && !i.side);   // món ăn kèm have their own button      // broth items get their own row above the tray
const quiet = (name, ...a) => { try { const r = ctx.game.act?.[name]?.(...a); return r || { ok: true }; } catch (e) { console.error('[ui] ' + name, e); return { ok: false }; } };

export function mountDock(root, sceneUi) {
  const flying = new Set();            // ingredient ids currently flying to the tray
  const play = div('dock-play');
  const lower = div('dock-lower');

  // ------------------------------------------------------------- toggle
  const toggle = h('button', { class: 'dock-toggle', 'aria-label': 'Thu gọn quầy lắc' }, ico('ui_down', 16));
  toggle.addEventListener('click', () => {
    sfx('click');
    collapsed = !collapsed; store.set('dockCollapsed', collapsed);
    applyCollapsed();
  });
  let collapsed = !!store.get('dockCollapsed', false);
  function applyCollapsed() {
    play.classList.toggle('collapsed', collapsed);
    toggle.classList.toggle('up', collapsed);
    toggle.setAttribute('aria-label', collapsed ? 'Mở rộng quầy lắc' : 'Thu gọn quầy lắc');
    requestAnimationFrame(() => ctx.renderer?.resize?.());
  }

  // ------------------------------------------------------------- tickets
  const strip = div('tickets');
  const emptyTxt = span('', 'Chưa có phiếu — chờ khách gọi món nha'); const emptyIco = ico('emo_zzz', 16);
  const closeBtn = h('button', { class: 'btn warn sm body closeearly' }, 'Đóng cửa sớm'); closeBtn.hidden = true;
  closeBtn.addEventListener('click', () => { sfx('click'); askCloseEarly(); });
  const stripEmpty = div('tk-empty', emptyIco, emptyTxt, closeBtn);
  strip.appendChild(stripEmpty);
  // nothing on the menu can be made: restock now (the market is open all day) or close up early
  function askCloseEarly() {
    if (S().phase !== 'open') return;
    ctx.confirm({ title: 'Hết hàng rồi!', icon: 'ui_kho', yes: 'Nhập thêm hàng', no: 'Đóng cửa sớm',
      text: 'Kho hết món để bán rồi. Nhập thêm hàng để bán tiếp, hay đóng cửa sớm qua ngày mới?',
      onYes: () => { ctx.openSheet('kho'); },
      onNo: () => { const r = act('closeEarly'); if (r.ok !== false) sfx('door'); } });
  }
  ctx.game.on?.('soldOut', () => setTimeout(askCloseEarly, 600));
  const tk = new Map();                 // ticketId -> refs
  let tkKey = '';

  function makeTicket(t) {
    const num = span('tb', ''); const potI = ico('pot_ga', 32, 'tpot'); const exI = ico('ing_ga', 16, 'tex');
    const plus = span('tplus', '+'); const drk = div('tdrk');
    const stI = ico('ui_check', 16, 'tst'); const bar = h('i'); const pb = div('pbar', bar);
    const el = h('button', { class: 'tk', dataset: { id: String(t.id) } }, num, potI, exI, plus, drk, stI, pb);
    onPress(el, () => { sfx('click'); const r = quiet('selectTicket', t.id); if (r.ok === false && r.msg) ctx.toast(r.msg, 'bad'); tickNow(); ctx.tutorial?.onAction?.('select'); });
    return { el, num, potI, exI, plus, drk, stI, bar, drkKey: '' };
  }
  function updateTicket(r, t, trayId) {
    const ratio = Math.max(0, Math.min(1, 1 - (t.waited || 0) / (t.patience || 1)));
    setText(r.num, 'Ô' + ((t.tableIdx ?? 0) + 1));
    if (t.extra) { setIco(r.exI, ING[t.extra]?.icon || 'ing_ga', 32); r.exI.width = r.exI.height = 32; setClass(r.exI, 'big', true); r.potI.style.display = 'none'; r.plus.style.display = ''; }
    else { setIco(r.potI, POT[t.pot]?.icon || 'pot_ga', 32); r.potI.style.display = ''; r.exI.style.display = 'none'; r.plus.style.display = 'none'; }
    if (t.extra) r.exI.style.display = '';
    const dk = (t.drinks || []).join(',');
    if (r.drkKey !== dk) { r.drkKey = dk; clear(r.drk); (t.drinks || []).slice(0, 3).forEach((d) => r.drk.appendChild(ico(DRINK[d]?.icon || 'drk_trada', 16))); }
    setClass(r.el, 'sel', t.id === trayId || t.status === 'tray');
    setClass(r.el, 'chef', t.status === 'chef');
    setClass(r.el, 'ready', t.status === 'ready' || t.status === 'carrying');
    setClass(r.el, 'extra', !!t.extra);
    const st = t.status === 'chef' ? 'eq_knife' : (t.status === 'ready' ? 'ui_check' : (t.status === 'carrying' ? 'ui_speed' : null));
    if (st) { setIco(r.stI, st, 16); r.stI.style.display = ''; } else r.stI.style.display = 'none';
    setStyleVar(r.bar, '--p', Math.round(ratio * 20) * 5);
    setClass(r.el, 'p-ok', ratio > 0.5); setClass(r.el, 'p-mid', ratio <= 0.5 && ratio > 0.25); setClass(r.el, 'p-low', ratio <= 0.25);
    r.el.disabled = t.status === 'chef' || t.status === 'ready' || t.status === 'carrying';
  }
  function updateTickets(trayId) {
    const list = (ctx.game.world?.tickets || []).filter((t) => t.status !== 'done');
    const key = list.map((t) => t.id).join(',');
    for (const [id, r] of tk) if (!list.some((t) => t.id === id)) { r.el.remove(); tk.delete(id); }
    list.forEach((t) => { if (!tk.has(t.id)) tk.set(t.id, makeTicket(t)); });
    if (key !== tkKey) {
      tkKey = key;
      list.forEach((t, i) => { const r = tk.get(t.id); if (strip.children[i + 1] !== r.el) strip.insertBefore(r.el, strip.children[i + 1] || null); if (!r.shown) { r.shown = true; r.el.classList.add('pop'); } });
      list.forEach((t, i) => { const r = tk.get(t.id); r.el.dataset.tut = i === 0 ? 'ticket-first' : ''; });
    }
    list.forEach((t) => updateTicket(tk.get(t.id), t, trayId));
    stripEmpty.style.display = list.length ? 'none' : '';
    if (!list.length) {
      const out = S().phase === 'open' && (ctx.game.get?.availablePots?.() || [1]).length === 0;
      setText(emptyTxt, out ? 'Hết hàng! Nhập thêm ở Kho nha' : 'Chưa có phiếu — chờ khách gọi món nha');
      setIco(emptyIco, out ? 'ui_kho' : 'emo_zzz', 16);
      closeBtn.hidden = !out; setClass(stripEmpty, 'out', out);
    }
  }

  // ------------------------------------------------------------- fruit keys
  // Fruit is a kho item like the toppings: one key per fruit on the menu, placed first in the (compact) key grid
  // so the whole dock stays short and the street stays visible.
  const brothRow = div('keys');                 // the single key grid (fruits first, then unlocked toppings)
  let brothKeys = [], brothSig = '';
  const menuBroths = () => {
    const st = S();
    return C.INGREDIENTS.filter((i) => i.broth && st.menu?.[i.broth] && (ctx.game.get?.isPotUnlocked?.(i.broth) ?? st.level >= i.unlockLv));
  };
  function buildBroths(list) {
    brothKeys.forEach((r) => r.el.remove()); brothKeys = [];
    const first = brothRow.firstChild;
    list.forEach((ing) => {
      const icn = ico(ing.icon, 32, 'kico'); const sub = span('kc', '0'); const ck = h('i', { class: 'ck kck' });
      const el = h('button', { class: 'key fruit', dataset: { ing: ing.id, tut: 'key-' + ing.id }, 'aria-label': ing.name, title: ing.name }, icn, sub, ck);
      onPress(el, () => onKey(ing.id, el, icn));
      brothRow.insertBefore(el, first); brothKeys.push({ id: ing.id, el, icn, sub });
    });
  }
  function updateBroths(info) {
    const list = menuBroths();
    const sig = list.map((i) => i.id).join(',');
    if (sig !== brothSig) { brothSig = sig; buildBroths(list); }
    const need = new Map((info?.need || []).map((n) => [n.ing, n]));
    const hasTray = !!info?.ticket;
    brothKeys.forEach((r) => {
      const n = stock(r.id), nd = need.get(r.id);
      setText(r.sub, String(n));
      setClass(r.el, 'zero', n < 1);
      setClass(r.el, 'low', n > 0 && n <= 3);
      setClass(r.el, 'need', !!nd && !nd.done);
      setClass(r.el, 'done', !!nd && nd.done && !flying.has(r.id));
      setClass(r.el, 'dim', hasTray && !nd);
    });
  }

  // ------------------------------------------------------------- tray
  const trayBox = div('tray');
  const trayHead = span('thead', '');
  const traySlots = div('tslots');
  // v2.6.16 chọn ly / hộp: two key-sized buttons at the end of the topping grid (easy to tap), each with the
  // container, its stock and the shop's logo stamp once it is designed (Lv 24)
  const PACKS = [{ id: 'ly_lac', icon: 'sup_lylac', label: 'Ly' }, { id: 'hop_giay', icon: 'sup_hop', label: 'Hộp' }];
  const packBtns = PACKS.map((p) => {
    const st = h('img', { class: 'pk-stamp', alt: '', width: 14, height: 14 }); st.hidden = true;
    const cnt = span('kc', '0');
    const b = h('button', { class: 'key pack', type: 'button', 'aria-label': 'Đựng bằng ' + p.label.toLowerCase(), title: 'Đựng bằng ' + p.label.toLowerCase() },
      span('pk-i', ico(p.icon, 32, 'kico'), st), span('pk-l', p.label), cnt);
    onPress(b, () => {
      // v2.6.19: with an order on the tray → that order; otherwise → what every new order (staff's too) goes in.
      // Tapping the chosen kind again goes back to "each dish's own".
      const info = trayInfo(), t = info?.ticket;
      let r;
      if (t && !t.extra && info.box) {
        r = act('setPack', p.id);
        if (r && r.ok !== false) act('setPackPref', p.id);
      } else {
        const cur = S().packPref || null;
        r = act('setPackPref', cur === p.id ? null : p.id);
        if (r && r.ok !== false) ctx.toast(r.packPref ? `Đơn mới đựng bằng ${p.label.toLowerCase()}` : 'Đơn mới đựng theo từng món', 'info', p.icon, 'packpref');
      }
      if (r && r.ok === false) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
      sfx('click'); vibrate(8); tickNow();
    });
    b._st = st; b._id = p.id; b._cnt = cnt;
    b.hidden = true;
    return b;
  });
  trayBox.append(trayHead, traySlots);
  function updatePack(info) {
    // v2.6.19: always on screen while selling (staff make the orders too); lit = the tray order's container, or the
    // shop's choice for new orders when nothing is on the tray
    const t = info?.ticket;
    const cur = t && !t.extra && info.box ? info.box : (S().packPref || null);
    packBtns.forEach((b) => { b.hidden = false; });
    const br = activeLooks(S()).brand, bk = br ? JSON.stringify(br) + S().shopName : '';
    packBtns.forEach((b) => {
      setClass(b, 'on', cur === b._id);
      setText(b._cnt, String(Math.floor(S().supplies?.[b._id] || 0)));
      setClass(b, 'zero', (S().supplies?.[b._id] || 0) < 1 && cur !== b._id);
      if (b._st._k !== bk) { b._st._k = bk; if (br) { const u = stampURL(br, 14); if (u) b._st.src = u; else b._st._k = ''; } }
      b._st.hidden = !br;
    });
  }
  let traySig = '';
  const slotEls = {};
  const trayTicket = () => {
    const id = ctx.game.world?.tray?.ticketId;
    return id == null ? null : (ctx.game.world?.tickets || []).find((t) => t.id === id) || null;
  };
  function buildTray(info) {
    clear(traySlots); Object.keys(slotEls).forEach((k) => delete slotEls[k]);
    if (!info?.ticket) return;
    (info.need || []).forEach((n) => {
      const el = div('slot', ico(ING[n.ing]?.icon || 'ing_ga', 16), h('i', { class: 'ck' }));
      el.dataset.ing = n.ing; slotEls[n.ing] = el; traySlots.appendChild(el);
    });
    if (info.drinks?.need > 0) {
      const t = info.ticket;
      const el = div('slot drk', ico(DRINK[t.drinks[0]]?.icon || 'drk_trada', 16), info.drinks.need > 1 ? span('dn', '×' + info.drinks.need) : null, h('i', { class: 'ck' }));
      slotEls.__drk = el; traySlots.appendChild(el);
    }
    if (info.sides?.need > 0) {
      const ids = info.sides.ids;
      const el = div('slot side', ico(ING[ids[0]]?.icon || 'ak_cavien', 16), ids.length > 1 ? span('dn', '×' + ids.length) : null, h('i', { class: 'ck' }));
      slotEls.__side = el; traySlots.appendChild(el);
    }
  }
  function trayInfo() { try { return ctx.game.get?.trayInfo?.() || null; } catch (e) { return null; } }
  function updateTray(info) {
    const t = info?.ticket;
    const sig = t ? t.id + ':' + (info.need || []).map((n) => n.ing).join('') + ':' + (info.drinks?.need || 0) + ':' + (info.sides?.ids || []).join('') : 'none';
    if (sig !== traySig) { traySig = sig; buildTray(info); }
    if (!t) {
      const hasNew = (ctx.game.world?.tickets || []).some((x) => x.status === 'new');
      setText(trayHead, hasNew ? 'Chạm vào phiếu để soạn phần' : 'Chưa có phiếu nào');
      setClass(trayBox, 'empty', true); setClass(trayBox, 'point', hasNew); setClass(trayBox, 'warn', false);
      return;
    }
    setClass(trayBox, 'empty', false); setClass(trayBox, 'point', false);
    setText(trayHead, t.extra ? `Ô${t.tableIdx + 1} · Gọi thêm ${ING[t.extra]?.name?.toLowerCase() || ''}` : `Ô${t.tableIdx + 1} · ${POT[t.pot]?.name || ''}`);
    (info.need || []).forEach((n) => {
      const el = slotEls[n.ing]; if (!el) return;
      setClass(el, 'done', n.done && !flying.has(n.ing));
      setClass(el, 'zero', !n.done && !n.inStock);
    });
    if (slotEls.__drk) setClass(slotEls.__drk, 'done', info.drinks.done >= info.drinks.need);
    if (slotEls.__side) setClass(slotEls.__side, 'done', info.sides.done >= info.sides.need);
  }

  // ------------------------------------------------------------- actions
  const drinkBtn = h('button', { class: 'btn night body dbtn', dataset: { tut: 'drink-btn' } }, ico('drk_trada', 32, 'dico'), span('dl', 'Nước'));
  // v2.5 món ăn kèm: shown only while the selected order has one
  const sideBtn = h('button', { class: 'btn gold body dbtn sbtn', 'aria-label': 'Thêm món ăn kèm' }, ico('ak_cavien', 32, 'dico'), span('dl', 'Ăn kèm'));
  sideBtn.hidden = true;
  onPress(sideBtn, () => {
    const r = act('addSides');
    if (r.ok !== false) {
      sfx('pop'); const to = slotEls.__side ? ctx.fx.centerOf(slotEls.__side) : ctx.fx.centerOf(trayBox);
      const t = trayTicket(); flying.add('__side');
      ctx.fx.fly(ING[t?.sides?.[0]]?.icon || 'ak_cavien', ctx.fx.centerOf(sideBtn), to, { size: 32, dur: 360, endScale: .6, done: () => { flying.delete('__side'); tickNow(); } });
    }
    tickNow();
  });
  // LẮC! is a hold-to-shake gauge: the ring fills while held, release inside the green zone.
  const shStamp = h('img', { class: 'sh-stamp', alt: '', width: 18, height: 18 }); shStamp.hidden = true;   // tem logo (Lv 24) on the cup
  const shCup = ico('pot_ga', 32, 'sh-cup'); const shLbl = span('sh-lbl', 'LẮC!'); const shSub = span('sh-sub', 'giữ để lắc');
  const serveBtn = h('button', { class: 'shaker off', dataset: { tut: 'serve-btn' }, 'aria-label': 'Giữ để lắc' }, div('sh-ring'), div('sh-face', shCup, shStamp, shLbl), shSub);
  onPress(drinkBtn, () => {
    const r = act('addDrinks');
    if (r.ok !== false) {
      sfx('pop'); const to = slotEls.__drk ? ctx.fx.centerOf(slotEls.__drk) : ctx.fx.centerOf(trayBox);
      const t = trayTicket(); flying.add('__drk');
      ctx.fx.fly(DRINK[t?.drinks?.[0]]?.icon || 'drk_trada', ctx.fx.centerOf(drinkBtn), to, { size: 32, dur: 360, endScale: .6, done: () => { flying.delete('__drk'); tickNow(); } });
      ctx.tutorial?.onAction?.('drinks');
    }
    tickNow();
  });
  let hold = null;
  const SH = C.SHAKE;
  const nope = () => { serveBtn.classList.remove('nope'); void serveBtn.offsetWidth; serveBtn.classList.add('nope'); };
  function setZone(z) {
    serveBtn.style.setProperty('--z0', (z[0] * 100).toFixed(1));
    serveBtn.style.setProperty('--z1', (z[1] * 100).toFixed(1));
  }
  function gradeOf(p, z) {
    if (p >= z[0] && p <= z[1]) return 'perfect';
    if (p < z[0] - SH.nearPad) return 'weak';
    if (p > z[1] + SH.nearPad) return 'over';
    return 'good';
  }
  function holdStart(e) {
    if (hold || (e.button != null && e.button > 0)) return;
    const info = trayInfo();
    if (!info?.canServe) {
      ctx.toast(!info?.ticket ? 'Chọn phiếu trước đã nha.' : 'Phần này chưa đủ — còn thiếu món đang sáng nha.', 'bad'); sfx('error'); nope(); return;
    }
    try { serveBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    hold = { t0: performance.now(), zone: info.zone || [0.58, 0.8], id: info.ticket.id, rattle: -1e9, buzz: 0, p: 0 };
    setZone(hold.zone);
    serveBtn.classList.add('holding');
    hold.raf = requestAnimationFrame(holdFrame);
  }
  function holdFrame(now) {
    if (!hold) return;
    const info = trayInfo();
    if (!info?.canServe || info.ticket?.id !== hold.id) { holdStop(); return; }
    const p = Math.min(1, (now - hold.t0) / (SH.holdSec * 1000));
    hold.p = p;
    serveBtn.style.setProperty('--p', (p * 100).toFixed(1));
    const inz = p >= hold.zone[0] && p <= hold.zone[1];
    setClass(serveBtn, 'inzone', inz); setText(shLbl, inz ? 'THẢ!' : 'LẮC…');
    setClass(serveBtn, 'over', p > hold.zone[1] + SH.nearPad);
    if (now - hold.rattle > 640) { hold.rattle = now; sfx('sizzle'); }
    if (now - hold.buzz > 110) { hold.buzz = now; vibrate(7); }
    if (ctx.game.world) ctx.game.world.cookPoseT = 0.6;
    if (p >= 1) { holdEnd(); return; }
    hold.raf = requestAnimationFrame(holdFrame);
  }
  function holdStop() {
    if (!hold) return null;
    cancelAnimationFrame(hold.raf);
    const hd = hold; hold = null;
    serveBtn.classList.remove('holding', 'inzone', 'over');
    serveBtn.style.setProperty('--p', '0'); setText(shLbl, 'LẮC!');
    return hd;
  }
  function holdEnd() {
    const hd = holdStop(); if (!hd) return;
    const held = (performance.now() - hd.t0) / 1000;
    if (held < SH.tapSec) {
      ctx.toast('Giữ nút LẮC! rồi thả tay khi vòng chạy vào vùng xanh nha!', 'info', 'ui_hand'); nope(); return;
    }
    doServe(gradeOf(hd.p, hd.zone));
  }
  function doServe(grade, phone) {
    const from = ctx.fx.centerOf(serveBtn);
    const r = act('serve', grade);
    if (r.ok === false) { tickNow(); return; }
    serveBtn.classList.remove('pop'); void serveBtn.offsetWidth; serveBtn.classList.add('pop'); vibrate(grade === 'perfect' ? [20, 40, 20] : 15);
    const n = ctx.game.world?.shakeN || 0;
    const txt = phone ? SH.phone : SH.label[grade] + (grade === 'perfect' && n >= 2 ? ' ×' + n : '');
    const col = grade === 'perfect' ? '#ffe36b' : grade === 'good' ? '#ffffff' : '#ffb199';
    ctx.fx.floatText(txt, { x: from.x - 40, y: from.y - 46 }, { color: col, dur: 1100, rise: 46 });
    if (grade === 'perfect') sfx('sparkle'); else if (grade !== 'good') sfx('error');
    ctx.tutorial?.onAction?.('serve');
    tickNow();
  }
  serveBtn.addEventListener('pointerdown', holdStart);
  ['pointerup', 'pointercancel'].forEach((t) => serveBtn.addEventListener(t, () => holdEnd()));
  serveBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  serveBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdStart(e); } });
  serveBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') holdEnd(); });

  // shaking the phone for real (Cài đặt → Lắc điện thoại): a few hard jolts serve a perfect portion
  let jolts = [], lastMag = 0;
  window.addEventListener('devicemotion', (e) => {
    if (!ctx.phoneShake || hold) return;
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0), d = Math.abs(m - lastMag); lastMag = m;
    if (d < 11) return;
    const now = performance.now();
    jolts = jolts.filter((t) => now - t < 900); jolts.push(now);
    if (jolts.length < 4) return;
    jolts = [];
    if (S().phase !== 'open' && S().phase !== 'closing') return;
    if (trayInfo()?.canServe) doServe('perfect', true);
  });

  // ------------------------------------------------------------- keys
  const keys = brothRow;
  const keyRefs = {};
  KEYS.forEach((ing) => {
    const icn = ico(ing.icon, 32, 'kico'); const nm = span('kn', ing.short); const cnt = span('kc', '0');
    const lock = div('klock', ico('ui_lock', 16), span('', 'Lv ' + ing.unlockLv));
    const ck = h('i', { class: 'ck kck' });
    const el = h('button', { class: 'key', dataset: { ing: ing.id, tut: 'key-' + ing.id }, 'aria-label': ing.name, title: ing.name }, icn, nm, cnt, ck, lock);
    onPress(el, () => onKey(ing.id, el, icn));
    keys.appendChild(el);
    keyRefs[ing.id] = { el, icn, nm, cnt, lock, ck };
  });
  packBtns.forEach((b) => keys.appendChild(b));          // v2.6.16 ly / hộp at the end of the grid
  function onKey(id, el, icn) {
    if (!ingUnlocked(id)) { ctx.toast(`${ING[id].name} mở ở Lv ${ING[id].unlockLv} nha.`, 'info', 'ui_lock'); sfx('error'); return; }
    if (stock(id) < 1) { ctx.toast(`Hết ${ING[id].name.toLowerCase()} rồi — mở Kho nhập thêm nha!`, 'bad', ING[id].icon); sfx('error'); return; }
    const r = quiet('addIngredient', id);
    if (r.ok === false) {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); sfx('error');
      if (r.msg && r.reason !== 'notNeeded') ctx.toast(r.msg, 'bad');
      else if (r.reason === 'notNeeded') ctx.toast('Phần này không cần ' + ING[id].name.toLowerCase() + ' nha.', 'info');
      return;
    }
    vibrate(8);                                           // the 'pop' sound comes from audio (ingredientAdded)
    flying.add(id);
    tickNow();                                            // builds the tray slot if the ticket was just auto-selected
    const slot = slotEls[id];
    const to = slot ? ctx.fx.centerOf(slot) : ctx.fx.centerOf(trayBox);
    ctx.fx.fly(ING[id].icon, ctx.fx.centerOf(icn), to, { size: 32, dur: 340, arc: -30, endScale: 0.8, done: () => { flying.delete(id); tickNow(); if (slot) { slot.classList.remove('land'); void slot.offsetWidth; slot.classList.add('land'); } } });
    ctx.tutorial?.onAction?.('ingredient', id);
  }
  function updateKeys(info) {
    const need = new Map((info?.need || []).map((n) => [n.ing, n]));
    const hasTray = !!info?.ticket;
    KEYS.forEach((ing) => {
      const r = keyRefs[ing.id]; const un = ingUnlocked(ing.id); const n = stock(ing.id);
      const nd = need.get(ing.id);
      setClass(r.el, 'lock', !un);
      r.el.hidden = !un;                                  // locked toppings take no room in the compact grid
      setText(r.cnt, un ? n : '');
      setClass(r.el, 'zero', un && n < 1);
      setClass(r.el, 'need', un && !!nd && !nd.done);
      setClass(r.el, 'done', un && !!nd && nd.done && !flying.has(ing.id));
      setClass(r.el, 'dim', un && hasTray && !nd);
      r.lock.style.display = un ? 'none' : '';
    });
  }

  // drinks button state
  function updateActions(info) {
    const t = info?.ticket;
    const hasDrinks = !!t && info.drinks?.need > 0;
    setShown(drinkBtn, hasDrinks);
    if (hasDrinks) {
      setIco(drinkBtn.querySelector('.dico'), DRINK[t.drinks[0]]?.icon || 'drk_trada', 32);
      const done = info.drinks.done >= info.drinks.need;
      setClass(drinkBtn, 'off', done); setClass(drinkBtn, 'pulse', !done);
      setText(drinkBtn.querySelector('.dl'), done ? 'Xong' : 'Nước');
    }
    const hasSides = !!t && info.sides?.need > 0;
    setShown(sideBtn, hasSides);
    if (hasSides) {
      setIco(sideBtn.querySelector('.dico'), ING[info.sides.ids[0]]?.icon || 'ak_cavien', 32);
      const done = info.sides.done >= info.sides.need;
      setClass(sideBtn, 'off', done); setClass(sideBtn, 'pulse', !done);
      setText(sideBtn.querySelector('.dl'), done ? 'Xong' : 'Ăn kèm');
    }
    const can = !!info?.canServe;
    setClass(serveBtn, 'off', !can); setClass(serveBtn, 'ready', can);
    if (t && !t.extra && POT[t.pot]) { if (serveBtn._pot !== t.pot) { serveBtn._pot = t.pot; setIco(shCup, POT[t.pot].icon, 32); } shCup.style.visibility = ''; }
    else shCup.style.visibility = 'hidden';
    const br = activeLooks(S()).brand, bk = br ? JSON.stringify(br) + S().shopName : '';
    if (bk !== shStamp._k) { shStamp._k = bk; if (br) { const u = stampURL(br, 18); if (u) shStamp.src = u; else shStamp._k = ''; } }
    shStamp.hidden = !br || shCup.style.visibility === 'hidden';
    if (can && !hold) setZone(info.zone || [0.58, 0.8]);
    setText(shSub, can ? 'giữ để lắc' : (t ? 'soạn chưa đủ' : 'chọn phiếu'));
  }

  // hint line ------------------------------------------------------------
  const hint = div('hintbar'); const hintS = span('', ''); hint.appendChild(hintS); hint.hidden = true; sceneUi.appendChild(hint);
  let idleT = 0, hintT = 0;

  // rain tarp button (vỉa hè only): shows while it rains and the tarp is still rolled up ------
  const tarpLbl = span('tl', 'Kéo bạt');
  const tarpBtn = h('button', { class: 'btn warn tarpbtn', onclick: onTarp }, ico('wx_rain', 32), tarpLbl);
  tarpBtn.hidden = true; sceneUi.appendChild(tarpBtn);
  function onTarp() {
    const rn = ctx.game.get?.rain?.();
    if (rn && !rn.owns) { sfx('click'); ctx.openSheet('upgrade'); return; }
    const r = act('pullTarp');
    if (r && r.ok) { sfx('whoosh'); vibrate(15); }
  }
  function updateTarp() {
    let rn = null;
    try { rn = ctx.game.get?.rain?.(); } catch (e) { rn = null; }
    const show = !!(rn && rn.raining && rn.needsTarp && !rn.tarp);
    tarpBtn.hidden = !show;
    if (show) { setText(tarpLbl, rn.owns ? 'KÉO BẠT!' : 'Mua bạt che mưa'); setClass(tarpBtn, 'buy', !rn.owns); }
  }

  // ------------------------------------------------------------- assemble
  const actionRow = div('arow', trayBox, drinkBtn, sideBtn, serveBtn);
  lower.append(actionRow, keys);
  play.append(toggle, strip, lower);
  root.appendChild(play);
  applyCollapsed();

  function tickNow() { tick(0, true); }
  let acc = 0;
  function tick(dt, force) {
    acc += dt;
    if (!force && acc < 0.08) return;
    acc = 0;
    const info = trayInfo();
    updateTickets(info?.ticket?.id ?? ctx.game.world?.tray?.ticketId);
    const canCollapse = staffCount('daubep') >= 1 && staffCount('phucvu') >= 1;
    toggle.style.display = canCollapse ? '' : 'none';
    if (!canCollapse && collapsed) { collapsed = false; applyCollapsed(); }
    updateBroths(info); updateTray(info); updatePack(info); updateKeys(info); updateActions(info);
  }
  function update(dt) {
    const open = S().phase === 'open' || S().phase === 'closing';
    setShown(play, open);
    if (!open) { hint.hidden = true; tarpBtn.hidden = true; return; }
    tick(dt);
    updateTarp();
    // idle hint
    const noTickets = !(ctx.game.world?.tickets || []).length;
    idleT = noTickets ? idleT + dt : 0;
    if (idleT > 4) { hintT += dt; if (hintT > 0.5) { hintT = 0; const t = ctx.game.get?.hint?.(); if (t) { setText(hintS, t); hint.hidden = false; } } } else hint.hidden = true;
  }

  return { update, tickNow, els: { strip, keys, serveBtn, drinkBtn, trayBox, brothRow }, keyRefs };
}
