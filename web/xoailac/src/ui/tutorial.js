// Tutorial (TECH_SPEC §9.5): story intro → avatar + shop name → newGame → coach marks (7 steps, state-driven) → contextual tips.
// API used by the rest of the UI: boot(), update(dt), onAction(name, arg), onSheet(id), reportTip().
import * as C from '../config.js';
import { h, div, span, ico, rich, clear } from './dom.js';
import { ctx, S, G, sfx } from './ctx.js';
import { openRestore } from './backup.js';
import { POT, ING } from './data.js';
import { portrait } from './sheets/common.js';
import { makeOwnerLook } from '../art/index.js';

// ------------------------------------------------------------------ pixel pointing hand (no art dependency)
const HAND = [
  '....OO.......',
  '...OSSO......',
  '...OSSO......',
  '...OSSO......',
  '...OSSOOO....',
  '...OSSOSSOO..',
  '...OSSOSSOSO.',
  'OO.OSSSSSSSSO',
  'OSOOSSSSSSSSO',
  'OSSOSSSSSSSHO',
  '.OSSSSSSSSHHO',
  '..OSSSSSSSHO.',
  '..OSSSSSSHHO.',
  '...OSSSSSHO..',
  '...OSSSSHHO..',
  '....OOOOOO...',
];
let handURL = '';
function handSrc() {
  if (handURL) return handURL;
  try {
    const c = document.createElement('canvas'); c.width = 13; c.height = 16;
    const g = c.getContext('2d');
    const col = { O: '#5a3a2a', S: '#ffdcb8', H: '#f0b58a' };
    HAND.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); } }));
    handURL = c.toDataURL();
  } catch (e) { handURL = ''; }
  return handURL;
}
const HAND_W = 52, HAND_H = 64, TIP_X = 20;     // 4× scale; fingertip at (20, 0)

const q = (key, root = document) => root.querySelector(`[data-tut="${key}"]`);
const visible = (el) => !!el && el.isConnected && el.getClientRects().length > 0;

export function createTutorial({ coachRoot }) {
  const root = coachRoot;
  const game = () => G();
  const tut = () => S().tutorial || (S().tutorial = { step: 0, done: false });
  const quiet = (name, ...a) => { try { return ctx.game.act?.[name]?.(...a); } catch (e) { console.error('[tutorial] ' + name, e); return null; } };

  // ------------------------------------------------------------------ coach DOM
  const spot = div('spot'); spot.hidden = true;
  const handImg = h('img', { class: 'pix', alt: '', draggable: false, width: HAND_W, height: HAND_H }); handImg.src = handSrc();
  const handIn = div('hand-in', handImg);
  const hand = div('hand', handIn); hand.hidden = true;
  const msg = h('p', null, '');
  const skip = h('button', { class: 'skip', type: 'button' }, 'Bỏ qua hướng dẫn');
  const panel = div('coach', div('av', ico('ui_mom', 32)), div('cbody', msg, skip)); panel.hidden = true;
  root.append(spot, hand, panel);
  skip.addEventListener('click', () => { sfx('click'); finish(true); });

  // contextual tip bubble
  const tipTxt = h('p', null, '');
  const tipEl = h('button', { class: 'tipb', type: 'button', 'aria-label': 'Đóng gợi ý' }, tipTxt); tipEl.hidden = true;
  tipEl.addEventListener('click', () => { sfx('click'); hideTip(); });
  root.appendChild(tipEl);

  // ------------------------------------------------------------------ memory (not persisted; steps are state-driven)
  const mem = { fans: 0, cookSeen: 0, ticketId: null, served: false, piles: false, collected: false, stepAt: 0 };
  let active = false, introOn = false, acc = 0, lastStep = -1;

  // ------------------------------------------------------------------ world snapshot
  function snap() {
    const g = game(), s = S(), w = g.world || {};
    const tickets = (w.tickets || []).filter((t) => t.status !== 'dead' && t.status !== 'done');
    const tray = w.tray?.ticketId != null ? tickets.find((t) => t.id === w.tray.ticketId) || null : null;
    const byId = mem.ticketId != null ? tickets.find((t) => t.id === mem.ticketId) || null : null;
    const focus = tray || byId || tickets.find((t) => t.status === 'new') || null;
    return { s, w, phase: s.phase, tickets, tray, focus, stoves: w.stoves || [], piles: w.coinPiles || [] };
  }
  const missing = (t) => { try { const rec = t.extra ? [t.extra] : (POT[t.pot]?.recipe || []); return rec.filter((i) => !t.added?.[i]); } catch (e) { return []; } };
  const needsDrinks = (t) => !t.extra && (t.drinks?.length || 0) > 0 && !t.drinksAdded;
  const potName = (t) => (POT[t?.pot]?.name || 'Xoài lắc');
  const running = (c) => c.phase === 'open' || c.phase === 'closing';

  // ------------------------------------------------------------------ steps
  // view(c) → { text, el?|pt?, wait? }.  done(c) → true when the step's goal is reached.
  const STEPS = [
    null,
    { // 1 — open the shop
      done: (c) => c.phase !== 'prep',
      view: () => ({ text: 'Bấm **MỞ HÀNG** để bắt đầu ngày đầu tiên!', el: q('open-btn') }),
    },
    { // 2 — tap the first ticket
      done: (c) => !!c.tray || c.tickets.some((t) => t.status !== 'new'),
      view: (c) => (c.tickets.length
        ? { text: `Khách gọi **${potName(c.tickets[0])}**! Chạm vào phiếu.`, el: q('ticket-first') }
        : { text: 'Chờ khách đầu tiên ghé quán nha… Sắp có rồi đó!', wait: true }),
    },
    { // 3 — (was: cook the broth) broth is a kho item now, added like any ingredient in step 4
      done: () => true,
      view: () => ({ text: '', wait: true }),
    },
    { // 4 — ingredients
      done: (c) => !!c.focus && c.focus.status !== 'new' && missing(c.focus).length === 0,
      view: (c) => {
        const t = c.focus;
        if (!t || t.id !== c.tray?.id) return { text: 'Chạm vào **phiếu** để chọn món cần soạn nha.', el: q('ticket-first') };
        const m = missing(t);
        const broth = m.length && ING[m[0]]?.broth;
        return { text: broth ? 'Chạm **trái cây** đang sáng trước nè!' : 'Chạm các **topping** đang sáng để soạn phần.', el: m.length ? q('key-' + m[0]) : null, glow: m };
      },
    },
    { // 5 — drinks (only if the table ordered some)
      done: (c) => !c.focus || !needsDrinks(c.focus),
      view: () => ({ text: 'Có nước uống thì bấm **Nước** nha.', el: q('drink-btn') }),
    },
    { // 6 — serve
      done: (c) => mem.served || (!!mem.ticketId && !c.tickets.some((t) => t.id === mem.ticketId)) || (!!c.focus && ['ready', 'carrying'].includes(c.focus.status)),
      view: () => ({ text: '**Giữ** nút **LẮC!** để lắc ly — thả tay khi vòng chạy vào **vùng xanh**!', el: q('serve-btn') }),
    },
    { // 7 — the customer pays over the counter
      done: (c) => mem.collected,
      view: () => ({ text: 'Khách nếm thử rồi **trả tiền** liền — tiền bay thẳng vô két. Chờ xíu nha!', wait: true }),
    },
  ];
  const LAST = STEPS.length - 1;

  const setStep = (n) => {
    if (tut().step !== n) { quiet('setTutorialStep', n); tut().step = n; }
    mem.stepAt = performance.now();
    if (n <= 2) { mem.served = false; mem.ticketId = null; mem.fans = 0; mem.cookSeen = 0; mem.piles = false; mem.collected = false; }
  };

  function finish(skipped = false) {
    if (tut().done) return;
    quiet('finishTutorial'); tut().done = true;
    hideCoach();
    if (skipped) ctx.toast('Ok nha, bạn tự khám phá nghen. Cần gì Má ở đây!', 'info', 'ui_mom');
    else { sfx('levelup'); ctx.mom?.('Giỏi quá con ơi! Từ giờ con tự lo quán được rồi. Má tin con!'); }
  }

  // ------------------------------------------------------------------ poll / render
  function poll() {
    const t = tut(); const s = S();
    if (!s.started) return;
    if (t.done) { hideCoach(); return; }
    if (t.step < 1) setStep(1);
    let c = snap();
    // out-of-order loads / expired tickets
    if (t.step >= 2 && c.phase === 'prep') { if (s.day > 1) { finish(true); return; } setStep(1); }
    if (t.step >= 4 && t.step <= 6 && !c.focus) setStep(2);
    let guard = 0;
    while (guard++ < LAST + 1) {
      const st = STEPS[t.step];
      if (!st) { finish(false); return; }
      if (t.step === 2 && c.focus) mem.ticketId = (c.tray || c.focus).id;
      if (!st.done(c)) break;
      if (t.step === 2 && (c.tray || c.focus)) mem.ticketId = (c.tray || c.focus).id;
      if (t.step >= LAST) { finish(false); return; }
      setStep(t.step + 1); c = snap();
    }
    render(c);
  }

  function hideCoach() { panel.hidden = true; hand.hidden = true; spot.hidden = true; clearGlow(); }
  let glowing = [];
  function clearGlow() { glowing.forEach((e) => e.classList.remove('tut-glow')); glowing = []; }
  function setGlow(list) {
    clearGlow();
    (list || []).forEach((k) => { const e = q('key-' + k); if (e) { e.classList.add('tut-glow'); glowing.push(e); } });
  }

  function render(c) {
    const t = tut();
    const st = STEPS[t.step];
    const blocked = ctx.modalCount?.() > 0 || !!ctx.sheetOpen?.() || introOn;
    if (!st || blocked) { hideCoach(); return; }
    const v = st.view(c);
    if (!v) { hideCoach(); return; }
    // text
    const key = t.step + '|' + v.text;
    if (msg._k !== key) { msg._k = key; clear(msg); msg.appendChild(rich(v.text)); if (lastStep !== t.step || panel.hidden) { panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = ''; } }
    lastStep = t.step;
    skip.hidden = t.step < 2;
    panel.hidden = false;
    setGlow(v.glow);
    // target geometry (relative to coach root)
    const rr = root.getBoundingClientRect();
    let rect = null, point = null;
    if (v.el && visible(v.el)) { const b = v.el.getBoundingClientRect(); rect = { x: b.left - rr.left, y: b.top - rr.top, w: b.width, h: b.height }; }
    else if (v.pt) { point = { x: v.pt.x - rr.left, y: v.pt.y - rr.top }; rect = { x: point.x - 28, y: point.y - 28, w: 56, h: 56 }; }
    if (!rect || v.wait) { hand.hidden = true; spot.hidden = true; placePanel(rr, null); return; }
    // spot
    const pad = point ? 0 : 5;
    spot.hidden = false;
    spot.style.left = rect.x - pad + 'px'; spot.style.top = rect.y - pad + 'px'; spot.style.width = rect.w + pad * 2 + 'px'; spot.style.height = rect.h + pad * 2 + 'px';
    spot.style.borderRadius = point ? '50%' : '16px';
    // hand: below the target pointing up, or above pointing down when there is no room
    const navTop = ctx.el.nav ? ctx.el.nav.getBoundingClientRect().top - rr.top : rr.height;
    const cx = rect.x + rect.w / 2;
    const up = v.dir ? v.dir === 'up' : (rect.y + rect.h + HAND_H - 6 <= navTop || rect.y < HAND_H + 80);
    hand.hidden = false;
    hand.classList.toggle('down', !up);
    const hx = Math.max(2, Math.min(rr.width - HAND_W - 2, cx - (up ? TIP_X : HAND_W - TIP_X)));
    const hy = up ? rect.y + rect.h - 4 : rect.y - HAND_H + 4;
    hand.style.transform = `translate(${Math.round(hx)}px, ${Math.round(hy)}px)`;
    placePanel(rr, { rect, up });
  }

  function placePanel(rr, tgt) {
    const hudB = ctx.el.hud ? ctx.el.hud.getBoundingClientRect().bottom - rr.top : 0;
    const dockT = ctx.el.dock ? ctx.el.dock.getBoundingClientRect().top - rr.top : rr.height * 0.6;
    const ph = panel.offsetHeight || 80;
    const cands = [hudB + 14, Math.max(hudB + 6, dockT - ph - 8)];   // top of the scene first: the counter (the action) is at the bottom
    let top = cands[0];
    if (tgt) {
      const r = tgt.rect;
      const y0 = tgt.up ? r.y : r.y - HAND_H, y1 = tgt.up ? r.y + r.h + HAND_H : r.y + r.h;
      const clash = (t) => y0 < t + ph + 6 && y1 > t - 6;
      top = cands.find((t) => !clash(t)) ?? cands[0];
    }
    panel.style.top = Math.round(top) + 'px'; panel.style.bottom = 'auto';
  }

  // ------------------------------------------------------------------ contextual tips
  const flags = () => (S().flags ||= {}).ui ||= {};
  const tipQ = [];
  let tipCur = null, tipT = 0;
  function queueTip(id, text, tab) {
    if (flags()['tip_' + id] || tipQ.some((x) => x.id === id) || tipCur?.id === id) return;
    tipQ.push({ id, text, tab });
  }
  function hideTip() {
    if (!tipCur) return;
    tipEl.hidden = true; hand.hidden = true; spot.hidden = true;
    tipCur = null; tipT = 0;
  }
  function tipTick(dt) {
    if (tut().done === false || !S().started) { if (tipCur) hideTip(); return; }
    const busy = ctx.modalCount?.() > 0 || !!ctx.sheetOpen?.() || introOn || !(S().phase === 'open' || S().phase === 'prep');
    if (tipCur) {
      tipT += dt;
      if (busy || tipT > 9) { hideTip(); return; }
      placeTip(); return;
    }
    if (busy || !tipQ.length) return;
    const nx = tipQ.shift();
    const btn = q('tab-' + nx.tab);
    if (!visible(btn)) return;
    tipCur = nx; tipT = 0;
    try { quiet('setFlag', 'tip_' + nx.id, true); } catch (e) { /* ignore */ }
    clear(tipTxt); tipTxt.appendChild(rich(nx.text));
    tipEl.hidden = false; tipEl.classList.remove('in'); void tipEl.offsetWidth; tipEl.classList.add('in');
    sfx('pop');
    placeTip();
  }
  function placeTip() {
    if (!tipCur) return;
    const btn = q('tab-' + tipCur.tab); if (!visible(btn)) { hideTip(); return; }
    const rr = root.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const rect = { x: b.left - rr.left, y: b.top - rr.top, w: b.width, h: b.height };
    spot.hidden = false; spot.style.borderRadius = '16px';
    spot.style.left = rect.x - 3 + 'px'; spot.style.top = rect.y - 3 + 'px'; spot.style.width = rect.w + 6 + 'px'; spot.style.height = rect.h + 6 + 'px';
    hand.hidden = false; hand.classList.add('down');
    const cx = rect.x + rect.w / 2;
    hand.style.transform = `translate(${Math.round(Math.max(2, Math.min(rr.width - HAND_W - 2, cx - (HAND_W - TIP_X))))}px, ${Math.round(rect.y - HAND_H + 4)}px)`;
    const bw = Math.min(250, rr.width - 20);
    tipEl.style.width = bw + 'px';
    tipEl.style.left = Math.round(Math.max(10, Math.min(rr.width - bw - 10, cx - bw / 2))) + 'px';
    tipEl.style.bottom = Math.round(rr.height - (rect.y - HAND_H + 2)) + 'px';
    tipEl.style.setProperty('--ax', Math.round(cx - parseFloat(tipEl.style.left)) + 'px');
  }

  function wireEvents() {
    const g = game();
    const on = (e, f) => g.on?.(e, (p) => { try { f(p || {}); } catch (err) { console.error('[tutorial] ' + e, err); } });
    on('ticketReady', () => { mem.served = true; });
    on('collected', () => { if (!tut().done && tut().step >= LAST) mem.collected = true; });
    on('stockLow', () => { if (tut().done) queueTip('stock', 'Nguyên liệu sắp hết rồi! Đang bán thì mở **Kho** đặt qua app, shipper giao tới sau ít phút nha.', 'kho'); });
    on('levelUp', (p) => { if (p.level === 2) queueTip('staff', 'Giờ bạn thuê được **Phục vụ** rồi! Vào **Nhân viên** xem thử nha.', 'staff'); });
    on('customerLeft', (p) => { if (p.angry && tut().done) queueTip('angry', 'Khách bỏ về vì chờ lâu! Thuê người phụ hay nâng cấp dao thớt sẽ đỡ hơn nha.', 'upgrade'); });
    on('phase', (p) => {
      if (p.phase !== 'prep' || !tut().done) return;
      const s = S();
      if (/rain|storm/.test(String(s.weather)) && !(s.upgrades?.tarp > 0) && !C.TIERS?.find?.((t) => t.id === s.tier)?.covered) queueTip('rain', 'Hôm nay có mưa rào! Xe đẩy ngoài trời cần **Bạt che mưa** (ở **Nâng cấp**) — mưa xuống thì chạm **KÉO BẠT**, không thì khách ướt sẽ bỏ về.', 'upgrade');
    });
    on('dayEnd', () => { mem.served = false; });
  }

  // ------------------------------------------------------------------ intro (story → owner setup)
  function runIntro() {
    if (introOn) return;
    introOn = true;
    ctx.pauseFor?.('intro');
    const lines = Array.isArray(C.START.intro) ? C.START.intro : [];
    const el = div('intro');
    root.appendChild(el);
    hideCoach();

    const finishIntro = () => {
      introOn = false;
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
      ctx.resumeFor?.('intro');
    };

    // ---- stage 1: story
    const logo = div('in-logo', h('b', null, 'XOÀI LẮC', h('br'), 'ƠI!'), span('in-sub', 'Xe xoài lắc nhà mình'));
    const mom = div('in-mom', ico('ui_mom', 48));
    const text = h('p', { class: 'in-text' }, '');
    const dots = div('in-dots', ...lines.map(() => h('i')));
    const hint = span('in-hint', 'Chạm để tiếp ▶');
    const story = div('in-story', logo, div('in-card', mom, text), dots, hint, h('button', { class: 'in-skip', type: 'button' }, 'Bỏ qua ▸'));
    el.appendChild(story);

    let li = 0, ci = 0, timer = 0, typing = false;
    const fast = ctx.reduced;
    const paint = () => { text.textContent = lines[li].slice(0, ci); [...dots.children].forEach((d, i) => d.classList.toggle('on', i <= li)); };
    const type = () => {
      clearTimeout(timer);
      if (ci >= lines[li].length) { typing = false; hint.classList.add('show'); return; }
      ci += 1; paint();
      if (ci % 3 === 0) sfx('tick');
      timer = setTimeout(type, 26);
    };
    const startLine = () => { ci = fast ? lines[li].length : 0; typing = !fast; hint.classList.remove('show'); paint(); if (fast) { hint.classList.add('show'); typing = false; } else type(); };
    const next = () => {
      if (typing) { clearTimeout(timer); ci = lines[li].length; typing = false; paint(); hint.classList.add('show'); return; }
      sfx('click');
      if (li < lines.length - 1) { li += 1; startLine(); } else toSetup();
    };
    story.addEventListener('click', (e) => { if (e.target.closest('.in-skip')) { sfx('click'); clearTimeout(timer); toSetup(); return; } next(); });
    const onKey = (e) => { if (!el.isConnected) { document.removeEventListener('keydown', onKey); return; } if (story.isConnected && (e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('input,button')) { e.preventDefault(); next(); } };
    document.addEventListener('keydown', onKey);
    if (lines.length) startLine(); else toSetup();

    // ---- stage 2: avatar + name
    function toSetup() {
      clearTimeout(timer);
      story.remove();
      let pick = 0;
      const cards = C.AVATARS.map((a) => {
        const b = h('button', { class: 'av-card', type: 'button', 'aria-pressed': 'false' }, portrait(makeOwnerLook(a.id, 1), 64, 'owner'), span('', a.name), span('av-ck'));
        b.addEventListener('click', () => { sfx('pop'); pick = a.id; sync(); });
        return b;
      });
      const sync = () => cards.forEach((b, i) => { const on = i === pick; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      sync();
      const input = h('input', { class: 'tinput', type: 'text', maxlength: '24', value: C.START.shopName, placeholder: C.START.shopName, 'aria-label': 'Tên quán', autocomplete: 'off', spellcheck: 'false' });
      const go = h('button', { class: 'btn red lg block', type: 'button' }, 'Mở quán thôi!');
      const submit = () => {
        const name = input.value.trim() || C.START.shopName;
        const r = quiet('newGame', { shopName: name, avatar: pick });
        if (r && r.ok === false) { ctx.toast(r.msg || 'Chưa bắt đầu được, thử lại nha.', 'bad'); return; }
        sfx('confirm');
        try { tut().step = 1; quiet('setTutorialStep', 1); } catch (e) { /* ignore */ }
        document.removeEventListener('keydown', onKey);
        finishIntro();
        active = true; acc = 1;
      };
      go.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      input.addEventListener('focus', () => { setTimeout(() => { try { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ } }, 250); });
      const setup = div('in-setup',
        div('in-head', ico('ui_shop', 48), h('b', null, 'Chủ quán là ai nè?')),
        div('av-grid', cards),
        div('in-field', h('label', { class: 'in-lbl' }, 'Đặt tên quán nha'), input, span('in-help', 'Tối đa 24 chữ. Sau này đổi trong Cài đặt cũng được.')),
        go,
        h('button', { class: 'in-restore', type: 'button', onclick: () => { sfx('click'); root.classList.add('behind'); if (!openRestore({ onClose: () => root.classList.remove('behind') })) root.classList.remove('behind'); } }, 'Có mã sao lưu? Khôi phục quán cũ ▸'));
      el.appendChild(setup);
    }
  }

  // ------------------------------------------------------------------ public API
  return {
    boot() {
      try {
        wireEvents();
        const s = S();
        if (!s.started) { runIntro(); return; }
        active = true;
        if (!tut().done && (tut().step || 0) < 1) setStep(1);
      } catch (e) { console.error('[tutorial] boot', e); }
    },
    update(dt) {
      try {
        if (!active) return;
        acc += dt;
        if (acc >= 0.2) { acc = 0; poll(); }
        tipTick(dt);
      } catch (e) { if (!mem.err) { mem.err = 1; console.error('[tutorial] update', e); } }
    },
    onAction(name) {
      try {
        if (name === 'fan') mem.fans += 1;
        if (name === 'cook') mem.fans = 0;
        if (name === 'serve') mem.served = true;
        if (name === 'collect') mem.collected = true;
        if (active && !tut().done) { acc = 0; poll(); }
        if (name === 'open') hideTip();
      } catch (e) { console.error('[tutorial] onAction', e); }
    },
    onSheet() { try { if (tipCur) hideTip(); if (!tut().done) hideCoach(); } catch (e) { /* ignore */ } },
    /** first time the day report opens: a short explainer (rendered inside the report modal) */
    reportTip() {
      try {
        if (!S().started || flags().tip_report) return null;
        quiet('setFlag', 'tip_report', true);
        return 'Lần đầu xem báo cáo hả? **Lợi nhuận** = tiền bán được trừ đi mọi chi phí. Xem dự báo ngày mai để chuẩn bị hàng nha!';
      } catch (e) { return null; }
    },
    get active() { return active && !tut().done; },
  };
}
