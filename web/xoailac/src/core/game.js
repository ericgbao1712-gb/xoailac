// createGame(): the whole simulation behind one object (TECH_SPEC §3–§6). DOM-free.
import * as C from '../config.js';
import { clamp, round2, clone } from './util.js';
import { createRng } from './rng.js';
import { migrate } from './state.js';
import { createWorld, syncLayout } from './world.js';
import {
  UP, DECO_BY_ID, POT, tierDef, mods, addMoney, addXp, settleXp, setLevel, isPotUnlocked, featureUnlocked, buyIngredient, builtTables, builtStoves, syncLots,
  priceBounds, buySupply, placeOrder, deliverOrders, quankhoRun, liquidate, liquidateQuote, oldStock, SUPPLIER, supplierUnlocked, recipeMaxLevel,
} from './economy.js';
import * as kitchen from './kitchen.js';
import * as customers from './customers.js';
import * as staff from './staff.js';
import * as workers from './workers.js';
import * as quests from './quests.js';
import * as day from './day.js';
import * as rain from './rain.js';
import { createGetters } from './getters.js';
import { fmtMoney, fmtDuration } from './format.js';
import { sanitizeBrand, sanitizeUniform, sanitizeFacade, facadeItem } from './looks.js';

const STEP = 0.1;            // max real seconds per simulation sub-step
const fail = (reason, msg) => ({ ok: false, reason, msg });
const isLive = (s) => s.phase === 'open' || s.phase === 'closing';
const inRush = (clock) => C.TIME.rushHours.some(([a, b]) => clock >= a && clock < b);

export function createGame(save, opts = {}) {
  const now = opts.now ?? Date.now();
  const headless = !!opts.headless;
  const state = migrate(save, now);
  const seed = opts.seed ?? ((Math.random() * 4294967296) >>> 0);
  const rng = createRng(seed);
  const listeners = new Map();
  const pending = [];                       // events raised before the UI could subscribe (offline, resume)

  // ───────────── shared context handed to every module ─────────────
  const G = {
    state, world: null, rng, cfg: C, headless,
    hooks: {}, modsDirty: true, _mods: null, workersDirty: true, realDt: 0,
    emit(evt, payload = {}) {
      const set = listeners.get(evt);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try { fn(payload); } catch (e) { console.error('[game] listener for "' + evt + '"', e); }
      }
    },
    on(evt, fn) { let set = listeners.get(evt); if (!set) listeners.set(evt, (set = new Set())); set.add(fn); return () => G.off(evt, fn); },
    off(evt, fn) { const set = listeners.get(evt); if (set) set.delete(fn); },
    toast(text, kind = 'info', icon = null) { G.emit('toast', { text, kind, icon }); },
    mom(key) {
      const text = C.MOM[key];
      if (!text || state.flags.mom[key]) return;
      state.flags.mom[key] = true;
      G.emit('mom', { key, text });
    },
    momText(key, text) { G.emit('mom', { key, text }); },
    counter(name, n = 1) { quests.counter(G, name, n); },
    nowMs() { return headless ? now + Math.round((G.world ? G.world.time : 0) * 1000) : Date.now(); },
    onLevelUp(level, unlocks) {
      staff.genCandidates(G);
      G.workersDirty = true;
      if (unlocks.some((u) => u.type === 'pot')) G.toast('Có món lắc mới trong thực đơn!', 'good', 'ui_menu');
    },
  };
  const world = createWorld(G);
  G.world = world;
  world.rushOn = false;
  G.hooks.ticketExpired = (t) => customers.ticketExpired(G, t);
  G.on('stockLow', () => G.mom('lowStock'));
  G.on('stockOut', () => G.mom('lowStock'));

  syncLayout(G, true);
  workers.syncWorkers(G, true);
  syncLots(G);
  if (state.started) {
    const up = settleXp(G);                 // v2.6.1 easier XP curve: XP already earned may be worth a level now
    if (up > 0) pending.push(['mom', { key: 'xpEase', text: `Bản mới lên cấp dễ hơn nè con! Kinh nghiệm con tích được đủ lên thẳng Lv ${state.level} rồi đó.` }]);
    staff.genCandidates(G);
  }
  if (state.flags.ui.decoRefund) {
    pending.push(['mom', { key: 'decoRefund', text: `Mấy món tranh treo tường với đồ Đặc biệt đặt trong quán khách ngoài đường đâu có thấy, Má bán lại được ${fmtMoney(state.flags.ui.decoRefund)} bỏ vô két rồi. Giờ con trang trí mặt tiền (cờ, chậu hoa, bảng hiệu) cho khách nhìn thấy nha!` }]);
    delete state.flags.ui.decoRefund;
  }
  if (state.flags.ui.supplierRefund) {
    pending.push(['mom', { key: 'supplierRefund', text: `Mối vựa trái cây nghỉ giao rồi con, Má lấy lại ${fmtMoney(state.flags.ui.supplierRefund)} tiền cọc bỏ vô két. Muốn tự nhập hàng mỗi sáng thì thuê Quản kho nha.` }]);
    delete state.flags.ui.supplierRefund;
  }
  if (state.flags.ui.sideRefund) {
    pending.push(['mom', { key: 'sideRefund', text: `Vỉa hè chỉ kê vừa 4 bộ bàn thôi con, mấy bộ dư Má bán lại được ${fmtMoney(state.flags.ui.sideRefund)} rồi bỏ vô két cho con đó.` }]);
    delete state.flags.ui.sideRefund;
  }
  if (state.flags.ui.v2Gift) {
    delete state.flags.ui.v2Gift;
    pending.push(['mom', { key: 'v2Gift', text: 'Má gom sẵn cho con mấy xấp ly, hộp, túi với khăn giấy rồi đó. Từ giờ mỗi phần bán ra tốn một cái ly/hộp — nhớ coi Kho mà nhập thêm nha con!' }]);
  }

  // ───────────── load: offline earnings + mid-day resume ─────────────
  if (state.started && save && save.savedAt) {
    const away = Math.max(0, (now - save.savedAt) / 1000);
    const money = day.offlineEarnings(G, away);
    if (money > 0) {
      state.money = round2(state.money + money);
      pending.push(['offline', { seconds: Math.round(away), money }]);
    }
  }
  if (state.started) {
    if (state.phase === 'open' || state.phase === 'closing') {
      state.phase = state.clock >= C.TIME.dayEnd ? 'closing' : 'open';
      for (const r of state.reservations) if (r.status === 'held') r.status = 'pending';
      customers.startDay(G);
      pending.push(['phase', { phase: state.phase }]);
    } else if (state.phase === 'report') {
      if (!state.report) day.buildReport(G);
      pending.push(['phase', { phase: 'report' }]);
      pending.push(['dayEnd', { report: state.report }]);
    }
  }

  // ───────────── simulation step ─────────────
  function stepSim(h) {
    const s = state, w = world;
    const dtMin = h * C.minPerSecOf(s);
    s.clock += dtMin;
    w.tMin += dtMin;
    if (w.cookPoseT > 0) w.cookPoseT = Math.max(0, w.cookPoseT - dtMin);
    if (s.phase === 'open') {
      const rush = inRush(s.clock);
      if (rush !== w.rushOn) { w.rushOn = rush; G.emit('rush', { on: rush }); }
    }
    deliverOrders(G);                       // app / nhà vườn deliveries arrive while the shop is open
    quankhoRun(G, dtMin);                   // v2.5.2: the quản kho runs to the market when something runs low
    kitchen.updateTickets(G, dtMin);
    customers.spawnTick(G, dtMin);
    customers.deliveryTick(G, dtMin);       // v2.6.9 xe máy giao hàng
    day.tickReservations(G, dtMin);
    customers.updateGroups(G, dtMin);
    rain.rainTick(G, dtMin, customers.angryLeave);
    workers.updateWorkers(G, dtMin);
    day.updateLottery(G, dtMin);
    if (s.phase === 'open' && s.clock >= C.TIME.dayEnd) {
      if (w.rushOn) { w.rushOn = false; G.emit('rush', { on: false }); }
      day.enterClosing(G);
      if (s.day >= 3) G.mom('lateNight');
    } else if (s.phase === 'closing') {
      w.closingFor += dtMin;
      if (w.groups.length === 0 || s.clock >= C.TIME.dayEnd + 90) day.finishDay(G);
    }
  }

  function flushPending() {
    if (!pending.length) return;
    const list = pending.splice(0, pending.length);
    for (const [evt, payload] of list) G.emit(evt, payload);
  }

  function update(dtReal) {
    flushPending();
    if (!(dtReal > 0)) return;
    if (dtReal > 2) dtReal = 2;
    const w = world, s = state;
    w.time += dtReal;
    if (w.pauses.size) return;
    G.realDt = dtReal;
    if (s.started) day.updateBranches(G, dtReal);
    if (!isLive(s)) {
      if (G.workersDirty) workers.syncWorkers(G, true);
      return;
    }
    for (let i = 0; i < w.fanTokens.length; i++) w.fanTokens[i] = Math.min(8, w.fanTokens[i] + 8 * dtReal);
    let remaining = dtReal * s.speed;
    while (remaining > 1e-9) {
      const h = Math.min(STEP, remaining);
      remaining -= h;
      stepSim(h);
      if (!isLive(s)) break;
    }
    w.questT = (w.questT || 0) + dtReal;
    if (w.questT >= 0.5) { w.questT = 0; quests.updateQuests(G); }
  }

  // ───────────── actions ─────────────
  const wrap = (fn) => (...args) => {
    let r;
    try { r = fn(...args); } catch (e) { console.error('[game] action failed', e); return fail('error', 'Có lỗi nhỏ xảy ra, thử lại nha!'); }
    if (G.workersDirty && !isLive(state)) { try { workers.syncWorkers(G, true); } catch (e) { console.error(e); } }
    return r == null ? { ok: true } : r;
  };

  function hardReset() {
    const fresh = migrate(null, G.nowMs());
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh);
    const w = world;
    w.actors.length = 0; w.owner = null; w.staffActors.clear(); w.groups.length = 0; w.tickets.length = 0; w.veso = null;
    w.tray.ticketId = null; w.tables.length = 0; w.stoves.length = 0; w.doors.length = 0; w.fanTokens.length = 0;
    w.lowWarned = {}; w.outWarned = {}; w.comboN = 0; w.tMin = 0; w.rushOn = false;
    G.modsDirty = true;
    syncLayout(G, true);
    workers.syncWorkers(G, true);
  }

  function unitPos(id) {
    const L = world.layout;
    if (id === 'table') { const t = world.tables[world.tables.length - 1]; return t ? { x: t.x, y: t.y } : null; }
    if (id === 'stove') { const t = world.stoves[world.stoves.length - 1]; return t ? { x: t.x, y: t.y } : null; }
    if (id === 'tablestyle') { const t = world.tables[0]; return t ? { x: t.x, y: t.y } : null; }
    if (id === 'sign' && L.sign) return { x: L.sign.x + L.sign.w / 2, y: L.sign.y + L.sign.h / 2 };
    const e = L.equip && L.equip[id];
    if (e) return { x: e.x + (e.w ? e.w / 2 : 0), y: e.y };
    const st = world.stoves[0];
    return st ? { x: st.x, y: st.y } : null;
  }

  const act = {
    newGame: wrap(({ shopName, avatar } = {}) => {
      if (state.started) hardReset();
      const nm = String(shopName ?? '').trim().slice(0, 24);
      state.shopName = nm || C.START.shopName;
      state.avatar = clamp(Math.floor(Number(avatar) || 0), 0, C.AVATARS.length - 1);
      state.started = true;
      state.createdAt = G.nowMs();
      staff.genCandidates(G, true);
      quests.rollDaily(G);
      G.mom('start');
      G.emit('phase', { phase: 'prep' });
      return { ok: true };
    }),
    openShop: wrap(() => day.openShop(G)),
    selectTicket: wrap((id) => kitchen.selectTicket(G, id)),
    closeEarly: wrap(() => day.closeEarly(G)),
    pullTarp: wrap(() => rain.pullTarp(G)),
    addIngredient: wrap((ing) => kitchen.addIngredientAct(G, ing)),
    addDrinks: wrap(() => kitchen.addDrinksAct(G)),
    addSides: wrap(() => kitchen.addSidesAct(G)),
    setPack: wrap((box) => kitchen.setPackAct(G, box)),   // v2.6.14 ly / hộp
    // v2.6.19: container for every new order (player's and staff's); null = each dish's own
    setPackPref: wrap((box) => {
      if (box != null && !C.CONTAINER_IDS.includes(box)) return fail('unknown', 'Không có loại này.');
      state.packPref = box || null;
      return { ok: true, packPref: state.packPref };
    }),
    liquidate: wrap((id, n) => liquidate(G, id, n)),
    serve: wrap((grade) => kitchen.serveAct(G, grade)),
    collect: wrap((tableIdx) => customers.collectCoins(G, tableIdx, 'player')),
    buyIngredient: wrap((ing, qty) => buyIngredient(G, ing, qty)),
    buySupply: wrap((id, qty) => buySupply(G, id, qty)),
    orderSupplies: wrap((supId, items) => placeOrder(G, supId, items)),
    setSupplier: wrap((id) => {
      if (!SUPPLIER[id]) return fail('unknown', 'Không có nhà cung cấp này.');
      if (!supplierUnlocked(G, id)) return fail('locked', `${SUPPLIER[id].name} mở ở Lv ${SUPPLIER[id].unlockLv} nha!`);
      state.supplier = id;
      return { ok: true };
    }),
    /** price: whole k within priceBounds, or null to go back to the reference price. Never changes on its own. */
    setPrice: wrap((potId, price) => {
      if (!POT[potId]) return fail('unknown', 'Không có món này.');
      if (!featureUnlocked(G, 'pricing')) return fail('locked', `Tự đặt giá bán mở ở Lv ${C.FEATURES.pricing} nha.`);
      if (price == null) { delete state.prices[potId]; return { ok: true, price: null }; }
      const v = Math.round(Number(price));
      const b = priceBounds(potId);
      if (!isFinite(v) || v <= 0) return fail('range', 'Giá phải lớn hơn 0 nha.');
      if (v < b.min || v > b.max) return fail('range', `Giá ${POT[potId].name} chỉ đặt được từ ${fmtMoney(b.min)} đến ${fmtMoney(b.max)}.`);
      state.prices[potId] = v;
      G.counter('setPrice', 1);
      return { ok: true, price: v };
    }),
    payStaffDebt: wrap((id, amount) => staff.payStaffDebt(G, id, amount)),
    payOldDebt: wrap((idx) => staff.payOldDebt(G, idx)),
    talkStaff: wrap((id) => staff.talkStaff(G, id)),
    bonusStaff: wrap((id) => staff.bonusStaff(G, id)),
    setAutoRestock: wrap((on) => {
      if (on && !mods(G).hasQuankho) return fail('locked', 'Thuê Quản kho trước nha, Quản kho sẽ tự nhập hàng mỗi sáng.');
      state.autoRestock = !!on;
      return { ok: true };
    }),

    buyUpgrade: wrap((id) => {
      const up = UP[id];
      if (!up) return fail('unknown', 'Không có nâng cấp này.');
      const info = G.get.upgradeInfo(id);
      if (info.cost == null) return fail('max', 'Đã nâng cấp tối đa rồi nha!');
      if (info.lockedReason) return fail('locked', `${info.lockedReason} mới mua được nha.`);
      if (state.money + 1e-9 < info.cost) return fail('money', `Cần ${fmtMoney(info.cost)} để mua ${up.name.toLowerCase()} nha.`);
      addMoney(G, -info.cost, 'upgrade');
      state.upgrades[id]++;
      G.modsDirty = true;
      if (id === 'table' || id === 'sidetable') { syncLayout(G, false); }
      const pos = unitPos(id) || {};
      G.counter('upgrade:' + id, 1);
      G.emit('upgrade', { id, level: state.upgrades[id], x: pos.x, y: pos.y });
      G.toast(`Đã mua ${up.name}!`, 'good', up.icon);
      return { ok: true, level: state.upgrades[id] };
    }),
    buyDeco: wrap((id) => {
      const d = DECO_BY_ID[id];
      if (!d) return fail('unknown', 'Không có món trang trí này.');
      if (!featureUnlocked(G, 'deco')) return fail('locked', `Trang trí mở ở Lv ${C.FEATURES.deco} nha!`);
      if (state.deco.owned.includes(id)) return fail('owned', 'Bạn có món này rồi nha.');
      if (d.source) return fail('source', 'Món này chỉ nhận được qua quà tặng thôi nha.');
      if ((d.minTier || 1) > state.tier) return fail('tier', `Cần ${C.TIERS[d.minTier - 1].name} mới mua được nha.`);
      if (state.money + 1e-9 < d.price) return fail('money', `Cần ${fmtMoney(d.price)} để mua ${d.name.toLowerCase()} nha.`);
      addMoney(G, -d.price, 'deco');
      state.deco.owned.push(id);
      state.deco.equipped[d.cat] = id;
      G.modsDirty = true;
      G.counter('deco', 1);
      const pos = (world.layout.deco[d.cat] || [])[0] || {};
      G.emit('upgrade', { id, level: 1, x: pos.x, y: pos.y, deco: true });
      G.toast(`Đã treo ${d.name}!`, 'good', 'ui_deco');
      return { ok: true };
    }),
    equipDeco: wrap((id) => {
      const d = DECO_BY_ID[id];
      if (!d) return fail('unknown', 'Không có món trang trí này.');
      if (!state.deco.owned.includes(id)) return fail('notOwned', 'Bạn chưa có món này nha.');
      state.deco.equipped[d.cat] = id;
      G.modsDirty = true;
      return { ok: true };
    }),
    // v2.3 looks: free to change once the level perk is unlocked
    setBrand: wrap((patch) => {
      if (state.level < C.BRAND.lv) return fail('locked', `Thiết kế tem logo mở ở Lv ${C.BRAND.lv} nha!`);
      state.brand = sanitizeBrand({ ...state.brand, ...(patch || {}) });
      G.emit('looks', { what: 'brand' });
      return { ok: true, brand: state.brand };
    }),
    setUniform: wrap((patch) => {
      if (state.level < C.UNIFORM.lv) return fail('locked', `Đồng phục mở ở Lv ${C.UNIFORM.lv} nha!`);
      state.uniform = sanitizeUniform({ ...state.uniform, ...(patch || {}) });
      G.emit('looks', { what: 'uniform' });
      return { ok: true, uniform: state.uniform };
    }),
    setFacade: wrap((patch) => {
      patch = patch || {};
      for (const cat of Object.keys(patch)) {
        const it = facadeItem(cat, patch[cat]);
        if (!it) return fail('unknown', 'Không có món trang trí này.');
        if (it.lv > state.level) return fail('locked', `${it.name} mở ở Lv ${it.lv} nha!`);
      }
      state.facade = sanitizeFacade({ ...state.facade, ...patch });
      G.modsDirty = true;
      G.emit('looks', { what: 'facade' });
      return { ok: true, facade: state.facade };
    }),
    // v2.6.7: move the main shop to a city with an open branch (null = back to TP.HCM). Only the scene changes.
    setHomeCity: wrap((id) => {
      if (id == null || id === 'hcm') { state.homeCity = null; G.emit('looks', { what: 'city' }); G.toast('Quán chính về lại TP.HCM.', 'good', 'ui_shop'); return { ok: true, city: null }; }
      const b = C.BRANCHES.find((x) => x.id === id);
      if (!b) return fail('unknown', 'Không có thành phố này.');
      if (!(state.branches[id] > 0)) return fail('locked', `Khai trương chi nhánh ${b.name} trước rồi mới dời quán chính tới đó được nha.`);
      state.homeCity = id;
      G.emit('looks', { what: 'city' });
      G.toast(`Dời quán chính tới ${b.name}! Khung cảnh đã đổi.`, 'good', 'ui_map');
      return { ok: true, city: id };
    }),
    upgradeRecipe: wrap((potId) => {
      const p = POT[potId], r = state.recipes[potId];
      if (!p || !r) return fail('unknown', 'Không có công thức này.');
      if (!isPotUnlocked(G, potId)) return fail('locked', `${p.name} mở ở Lv ${p.unlockLv} nha!`);
      if (r.lvl >= recipeMaxLevel(G)) return fail('max', 'Công thức này đã tối đa rồi nha!');
      const cost = C.RECIPE.upgradeCost(p, r.lvl);
      if (state.money + 1e-9 < cost) return fail('money', `Cần ${fmtMoney(cost)} để nâng công thức nha.`);
      addMoney(G, -cost, 'recipe');
      r.lvl++;
      G.counter('recipeUp', 1);
      G.toast(`${p.name} lên cấp ${r.lvl}! Giá bán và chất lượng tăng.`, 'good', p.icon);
      return { ok: true, lvl: r.lvl };
    }),
    toggleMenuItem: wrap((potId) => {
      if (!POT[potId]) return fail('unknown', 'Không có món này.');
      if (!isPotUnlocked(G, potId)) return fail('locked', `${POT[potId].name} mở ở Lv ${POT[potId].unlockLv} nha!`);
      const on = !state.menu[potId];
      if (!on) {
        const others = C.HOTPOTS.filter((p) => p.id !== potId && state.menu[p.id] && isPotUnlocked(G, p.id)).length;
        if (others === 0) return fail('last', 'Phải giữ ít nhất một món trong thực đơn nha.');
      }
      state.menu[potId] = on;
      return { ok: true, on };
    }),

    hire: wrap((role, idx) => staff.hire(G, role, idx)),
    fire: wrap((id) => staff.fire(G, id)),
    refreshCandidates: wrap((role) => staff.refreshCandidates(G, role)),
    setOwnerMode: wrap((mode) => {
      if (mode !== 'work' && mode !== 'manage') return fail('unknown', 'Chế độ này không có.');
      if (mode === 'manage' && !featureUnlocked(G, 'manageMode')) return fail('locked', `Chế độ Quản lý mở ở Lv ${C.FEATURES.manageMode} nha!`);
      state.ownerMode = mode;
      return { ok: true };
    }),
    expandTier: wrap(() => day.expandTier(G)),
    buyMarketing: wrap((id) => day.buyMarketing(G, id)),
    buyLottery: wrap(() => day.buyLottery(G)),
    claimMainQuest: wrap(() => quests.claimMain(G)),
    claimV2Quest: wrap(() => quests.claimV2(G)),
    /** Cấp thành thạo: open one of the gold chests earned from Lv 41 on. */
    openMasteryChest: wrap(() => {
      if (!(state.masteryChests > 0)) return fail('none', 'Chưa có rương thành thạo nào nha.');
      state.masteryChests--;
      const r = quests.openChest(G, C.MASTERY.chest);
      return { ok: true, chest: C.MASTERY.chest, reward: r };
    }),
    claimDaily: wrap((i) => quests.claimDaily(G, i)),
    claimDailyAll: wrap(() => quests.claimDailyAll(G)),
    claimLogin: wrap(() => quests.claimLogin(G)),
    thankReview: wrap((id) => quests.thankReview(G, id)),
    startNextDay: wrap(() => day.startNextDay(G)),

    setSpeed: wrap((v) => {
      v = Number(v);
      if (![1, 2, 3, 4, 8].includes(v)) return fail('unknown', 'Tốc độ này không có.');
      if (v === 2 && !featureUnlocked(G, 'speed2')) return fail('locked', `Tốc độ ×2 mở ở Lv ${C.FEATURES.speed2} nha!`);
      if (v === 3 && !featureUnlocked(G, 'speed3')) return fail('locked', `Tốc độ ×3 mở ở Lv ${C.FEATURES.speed3} nha!`);   // v2.6.10
      state.speed = v;
      return { ok: true, speed: v };
    }),
    pause: wrap((reason = 'ui') => { world.pauses.add(reason); return { ok: true }; }),
    resume: wrap((reason = 'ui') => { world.pauses.delete(reason); return { ok: true }; }),
    setSetting: wrap((key, value) => {
      if (!(key in state.settings)) return fail('unknown', 'Không có cài đặt này.');
      if (key === 'song') {                                   // v2.6.21 chọn bài nhạc nền
        value = String(value);
        const sg = C.SONGS.find((x) => x.id === value);
        if (value !== 'auto' && !sg) return fail('unknown', 'Không có bài này.');
        if (sg && ((state.upgrades.speaker | 0) < sg.lv)) return fail('locked', `Nâng Loa nhạc lên cấp ${sg.lv} để mở bài "${sg.name}" nha.`);
      } else if (key === 'dayMin') {
        value = Math.round(Number(value));
        if (!C.TIME.dayMinOptions.includes(value)) return fail('range', 'Độ dài ngày này không có nha.');
      } else if (typeof state.settings[key] === 'number') value = clamp(Number(value) || 0, 0, 1);
      else if (typeof state.settings[key] === 'boolean') value = !!value;
      state.settings[key] = value;
      G.emit('setting', { key, value });
      return { ok: true };
    }),
    setShopName: wrap((name) => {
      const nm = String(name ?? '').trim().slice(0, 24);
      if (!nm) return fail('empty', 'Tên quán không được để trống nha.');
      state.shopName = nm;
      return { ok: true };
    }),
    setTutorialStep: wrap((n) => { state.tutorial.step = Math.max(0, Math.floor(Number(n) || 0)); return { ok: true }; }),
    finishTutorial: wrap(() => { state.tutorial.done = true; return { ok: true }; }),
    markSeen: wrap((key) => { state.flags.seenUnlock[String(key)] = true; return { ok: true }; }),
    setFlag: wrap((key, val = true) => { state.flags.ui[String(key)] = val; return { ok: true }; }),
    openBranch: wrap((id) => day.openBranch(G, id)),
    upgradeBranch: wrap((id) => day.upgradeBranch(G, id)),

    debug: {
      money: wrap((k) => { addMoney(G, Number(k) || 0, 'debug'); return { ok: true }; }),
      xp: wrap((n) => { addXp(G, Number(n) || 0); return { ok: true }; }),
      level: wrap((n) => { setLevel(G, Number(n) || 1); staff.genCandidates(G); return { ok: true }; }),
      tier: wrap((n) => {
        state.tier = clamp(Math.floor(Number(n) || 1), 1, C.TIERS.length);
        state.upgrades.table = 0; state.upgrades.stove = 0;
        G.modsDirty = true;
        customers.resetCustomers(G);
        syncLayout(G, true);
        world.lowWarned = {}; world.outWarned = {};
        workers.syncWorkers(G, true);
        G.emit('tierUp', { tier: state.tier });
        return { ok: true };
      }),
      endDay: wrap(() => {
        if (state.phase === 'report') return fail('phase', 'Đang ở báo cáo rồi.');
        if (state.phase === 'prep') { state.phase = 'open'; customers.startDay(G); }
        day.finishDay(G);
        return { ok: true };
      }),
      spawn: wrap((kind) => {
        if (!isLive(state)) return fail('phase', 'Mở hàng rồi mới có khách nha.');
        const g = customers.spawnGroup(G, kind || 'sinhvien');
        return g ? { ok: true, groupId: g.id } : fail('full', 'Không còn chỗ cho nhóm khách này.');
      }),
      weather: wrap((wx) => {
        if (!C.WEATHER[wx]) return fail('unknown', 'Thời tiết này không có.');
        state.weather = wx;
        G.modsDirty = true;
        return { ok: true };
      }),
    },
  };

  const game = {
    state, world, cfg: C,
    update,
    on: G.on, off: G.off, emit: G.emit,
    act,
    get: null,
    serialize() {
      const out = clone(state);
      out.savedAt = G.nowMs();
      return out;
    },
    _G: G,
  };
  G.get = game.get = createGetters(G);
  return game;
}
