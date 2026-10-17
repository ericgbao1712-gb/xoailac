// Xoài Lắc Ơi! — all game content and balance numbers (engine shared with Lẩu Ơi!).
// Pure data + pure helper functions. NO DOM access (imported by the headless balance sim).
// Money unit: k = 1.000đ (so 99 means 99.000đ). Time unit: game minutes unless noted.
// Ids here are the contract shared by sim, UI and art. Don't rename ids without updating art + UI.

export const VERSION = 2;   // v2 (2026-10): giá bán tự đặt, vật tư, nhà cung cấp, nợ lương, bàn ghế hai bên quán

// ───────────────────────────── TIME ─────────────────────────────
export const TIME = {
  dayStart: 10 * 60,          // 10:00
  lastSeat: 22 * 60 + 30,     // no new groups after 22:30
  dayEnd: 23 * 60,            // 23:00 → remaining groups hurry up, then report
  // Real minutes per selling day at 1× is a player setting (Cài đặt → Độ dài 1 ngày), state.settings.dayMin.
  dayMinOptions: [4, 5, 6, 7, 8, 9, 10],
  defaultDayMin: 6,
  baseDaySec: 540,            // branch income (k per real second) is tuned for a 540 s day and rescaled to the setting
  orderDelay: 4,              // after sitting, the order ticket appears
  eatMinutes: [5, 8],         // counter mode: the customer tastes the cup at the counter (may ask for an extra), then pays
  payDelay: 1,                // after tasting, they pay (money goes straight into the két)
  collectMinutes: 3,          // time to collect + wipe table once a worker is there
  doorPatience: 90,           // groups waiting in the queue for a free counter spot (×2 since 2026-10-13)
  // groups per game hour, multiplied by tier.demand and all other multipliers
  demandCurve: { 10: 0.5, 11: 1.2, 12: 1.4, 13: 0.8, 14: 0.4, 15: 0.4, 16: 0.6, 17: 1.2, 18: 1.9, 19: 2.2, 20: 1.9, 21: 1.3, 22: 0.7 },
  rushHours: [[11 * 60, 13 * 60], [17 * 60 + 30, 21 * 60]],
  weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], // day 1 = T2
  weekendMult: 1.3,
};

// ───────────────────────────── START ─────────────────────────────
/** Real seconds one selling day lasts at 1× for this save. */
export const daySecOf = (s) => {
  const m = Number(s && s.settings && s.settings.dayMin);
  return (TIME.dayMinOptions.includes(m) ? m : TIME.defaultDayMin) * 60;
};
/** Game minutes per real second at 1×. */
export const minPerSecOf = (s) => (TIME.dayEnd - TIME.dayStart) / daySecOf(s);
/** Branch income per real second is × this, so a whole day of branches pays the same whatever the day length. */
export const branchScale = (s) => TIME.baseDaySec / daySecOf(s);

export const START = {
  money: 500,                                  // 500.000đ tiền chu cấp
  inventory: { muoitom: 6, ot: 6, duong: 6, dauphong: 4, sotme: 4, tc_xoai: 4, tc_coc: 4 }, // rổ trái cây + hũ muối Má để lại
  supplies: { ly_lac: 30, hop_giay: 10, ly_nuoc: 30, xien: 40, tui: 20, khan: 40, dua: 10 },   // xấp ly, túi Má gom sẵn
  shopName: 'Xoài Lắc Nhà Mình',
  intro: [
    'Hơn hai mươi năm, Má bán xoài lắc trước cổng trường. Học trò mấy khoá đều gọi Má là "Má Xoài".',
    'Năm nay lưng Má yếu, Má giao lại cho bạn chiếc xe đẩy và hũ muối tôm bí truyền.',
    'Vốn liếng có 500.000đ, một rổ xoài keo, ít cóc non và hai bộ bàn nhựa đỏ.',
    'Trống tan trường sắp vang rồi kìa… Lắc thôi!',
  ],
};

// Owner avatars the player picks at the start (art draws them via makeOwnerLook(avatar, tier))
export const AVATARS = [
  { id: 0, name: 'Tóc búi hoa' },
  { id: 1, name: 'Tóc húi cua' },
  { id: 2, name: 'Đeo kính cận' },
  { id: 3, name: 'Tóc ngắn kẹp' },
];

// ───────────────────────────── INGREDIENTS ─────────────────────────────
// Display order matters (dock grid is 2×5 in this order).
// shelf: days a portion stays usable, counting the day it was bought (2 = today + tomorrow).
// Fresh fruit & herbs 2, dried things / jars / sauces 5.
export const INGREDIENTS = [
  { id: 'muoitom',  name: 'Muối tôm',  short: 'Muối tôm', icon: 'ing_muoitom',  cost: 5,  extraPrice: 15, unlockLv: 1,  shelf: 5 },
  { id: 'ot',       name: 'Ớt tươi',   short: 'Ớt',       icon: 'ing_ot',       cost: 3,  extraPrice: 10, unlockLv: 1,  shelf: 2 },
  { id: 'duong',    name: 'Đường',     short: 'Đường',    icon: 'ing_duong',    cost: 2,  extraPrice: 10, unlockLv: 1,  shelf: 5 },
  { id: 'dauphong', name: 'Đậu phộng', short: 'Đậu',      icon: 'ing_dauphong', cost: 4,  extraPrice: 15, unlockLv: 1,  shelf: 5 },
  { id: 'sotme',    name: 'Sốt me',    short: 'Sốt me',   icon: 'ing_sotme',    cost: 5,  extraPrice: 15, unlockLv: 1,  shelf: 5 },
  { id: 'ximuoi',   name: 'Xí muội',   short: 'Xí muội',  icon: 'ing_ximuoi',   cost: 20, extraPrice: 45, unlockLv: 3,  shelf: 5 },
  { id: 'rauram',   name: 'Rau răm',   short: 'Rau răm',  icon: 'ing_rauram',   cost: 8,  extraPrice: 20, unlockLv: 3,  shelf: 2 },
  { id: 'mamruoc',  name: 'Mắm ruốc',  short: 'Mắm ruốc', icon: 'ing_mamruoc',  cost: 15, extraPrice: 40, unlockLv: 5,  shelf: 5 },
  { id: 'khobo',    name: 'Khô bò',    short: 'Khô bò',   icon: 'ing_khobo',    cost: 22, extraPrice: 50, unlockLv: 8,  shelf: 5 },
  { id: 'khomuc',   name: 'Khô mực',   short: 'Khô mực',  icon: 'ing_khomuc',   cost: 20, extraPrice: 45, unlockLv: 11, shelf: 5 },
  // Fruit ("Trái cây") is stocked like any ingredient (one item per dish, first in its recipe). broth: <dish id> keeps it
  // out of the dock's topping grid (it has its own row) and out of level-up unlock lists. (Field name kept from Lẩu Ơi!.)
  { id: 'tc_xoai',    name: 'Xoài keo',       short: 'Xoài keo', icon: 'fr_xoai',    cost: 15, extraPrice: 30, unlockLv: 1,  broth: 'xoailac', shelf: 2 },
  { id: 'tc_coc',     name: 'Cóc',            short: 'Cóc',      icon: 'fr_coc',     cost: 4,  extraPrice: 20, unlockLv: 1,  broth: 'coclac',  shelf: 2 },
  { id: 'tc_oi',      name: 'Ổi',             short: 'Ổi',       icon: 'fr_oi',      cost: 12, extraPrice: 30, unlockLv: 3,  broth: 'oilac',   shelf: 2 },
  { id: 'tc_xoaicat', name: 'Xoài cát non',   short: 'Xoài cát', icon: 'fr_xoaicat', cost: 8,  extraPrice: 30, unlockLv: 5,  broth: 'xoaicat', shelf: 2 },
  { id: 'tc_thom',    name: 'Thơm',           short: 'Thơm',     icon: 'fr_thom',    cost: 10, extraPrice: 30, unlockLv: 8,  broth: 'thomlac', shelf: 2 },
  { id: 'tc_man',     name: 'Mận',            short: 'Mận',      icon: 'fr_man',     cost: 12, extraPrice: 35, unlockLv: 11, broth: 'manlac',  shelf: 2 },
  { id: 'tc_mix',     name: 'Trái cây Nhà Mình', short: 'Nhà Mình', icon: 'fr_mix',  cost: 6,  extraPrice: 40, unlockLv: 18, broth: 'thapcam', shelf: 2 },
  // v2.5 món ăn kèm: stocked in the kho like everything else (bought, expire, auto-restock), never in the topping grid.
  // side = price the guest pays on top ("thu thêm"); quest = main-quest id that must be claimed first; kinds = who likes it.
  { id: 'ak_banhtrangtron',  name: 'Bánh tráng trộn',    short: 'BT trộn',   icon: 'ak_banhtrangtron',  cost: 8,  side: 20, unlockLv: 4,  shelf: 3, kinds: { sinhvien: 3, hoiban: 2 } },
  { id: 'ak_cavien',         name: 'Cá viên chiên',      short: 'Cá viên',   icon: 'ak_cavien',         cost: 6,  side: 15, unlockLv: 6,  shelf: 3, kinds: { sinhvien: 3, giadinh: 2 } },
  { id: 'ak_phomaique',      name: 'Phô mai que',        short: 'Phô mai',   icon: 'ak_phomaique',      cost: 7,  side: 18, unlockLv: 9,  shelf: 2, kinds: { giadinh: 3, capdoi: 2, sinhvien: 2 } },
  { id: 'ak_banhtrangnuong', name: 'Bánh tráng nướng',   short: 'BT nướng',  icon: 'ak_banhtrangnuong', cost: 8,  side: 22, unlockLv: 1,  quest: 'q12', shelf: 2, kinds: { khachtay: 3, hoiban: 2, capdoi: 2 } },
  { id: 'ak_bobia',          name: 'Bò bía',             short: 'Bò bía',    icon: 'ak_bobia',          cost: 6,  side: 15, unlockLv: 12, shelf: 2, kinds: { vanphong: 2, giadinh: 2 } },
  { id: 'ak_xoaisay',        name: 'Xoài sấy dẻo',       short: 'Xoài sấy',  icon: 'ak_xoaisay',        cost: 10, side: 25, unlockLv: 14, shelf: 6, kinds: { vanphong: 2, khachtay: 3, doandulich: 3 } },
  { id: 'ak_trungcut',       name: 'Trứng cút xào me',   short: 'Trứng cút', icon: 'ak_trungcut',       cost: 11, side: 28, unlockLv: 1,  quest: 'q19', shelf: 2, kinds: { hoiban: 3, sinhvien: 2 } },
  { id: 'ak_khoga',          name: 'Khô gà lá chanh',    short: 'Khô gà',    icon: 'ak_khoga',          cost: 14, side: 35, unlockLv: 1,  quest: 'q25', shelf: 6, kinds: { vanphong: 3, chutu: 3, doandulich: 2 } },
];
// chance a group adds a side (only unlocked ones in stock); a second one for groups of 3+
// v2.6.20–21 nhạc nền: base songs + songs unlocked by the Loa nhạc upgrade (speaker level `lv`).
// `time`: when the "Tự đổi bài" playlist plays it ('day' before 18:30, 'night' after, 'both').
export const SONGS = [
  { id: 'day',    name: 'Trưa phố',     lv: 0, time: 'day' },
  { id: 'night',  name: 'Đêm hẻm',      lv: 0, time: 'night' },
  { id: 'pho',    name: 'Phố chiều',    lv: 1, time: 'both' },
  { id: 'que',    name: 'Quê nhà',      lv: 1, time: 'day' },
  { id: 'san',    name: 'Nhạc sàn vui', lv: 2, time: 'day' },
  { id: 'bolero', name: 'Bolero đêm',   lv: 2, time: 'night' },
];
export const SONG_IDS = SONGS.map((x) => x.id);
export const SIDE_CHANCE = { first: 0.40, second: 0.30 };   // v2.6.20 (was 0.32 / 0.25): guests order a side a bit more often
// v2.6.20: every side dish keeps one day longer (shelf +1)
// v2.5.2 quản kho during service: checks every few minutes; ≤ lowAt portions left → buys max(minBuy, today's use × usageShare)
// at the market price (no fee), back after `minutes`. Keeps keepMoney in the till. sideMin = morning stock of each side.
// v2.6 thanh lý hàng cũ: Cô Ba buys stock back in the morning (prep only), oldest lots first, at a share of what each
// portion cost: rates[min(days left, 2)] — 0 = expires after today. Always below every supplier price, so no buy-low-sell-high.
export const LIQUIDATE = { buyer: 'Cô Ba đầu hẻm', rates: [0.35, 0.5, 0.6] };
export const QUANKHO = { checkEvery: 5, lowAt: 2, minBuy: 6, usageShare: 0.5, minutes: 0, supplyLowAt: 8, supplyBuy: 50, keepMoney: 50, sideMin: 4 };

// ───────────────────────────── DISHES (array name kept from Lẩu Ơi!) ─────────────────────────────
// One "phần" per group, shared, served in a bag / cup / bowl. broth: colour key the art uses for the fruit (palette.js BROTH)
export const HOTPOTS = [
  { id: 'xoailac', name: 'Xoài lắc muối tôm', icon: 'pot_xoailac', broth: 'xoailac', recipe: ['tc_xoai', 'muoitom', 'ot', 'duong', 'dauphong'], price: 92,  brothCost: 5,  cookMin: 12, unlockLv: 1,
    desc: 'Xoài keo giòn rụm lắc muối tôm cam cam, cay cay. Món "quốc dân" của cổng trường.' },
  { id: 'coclac',  name: 'Cóc lắc',            icon: 'pot_coclac',  broth: 'coclac',  recipe: ['tc_coc', 'muoitom', 'sotme', 'ot', 'duong'],  price: 72,  brothCost: 3,  cookMin: 10, unlockLv: 1,
    desc: 'Cóc non chua lè, chấm thêm tí sốt me. Ăn một miếng là nhăn mặt, rồi xin thêm miếng nữa.' },
  { id: 'oilac',   name: 'Ổi lắc xí muội',     icon: 'pot_oilac',   broth: 'oilac',   recipe: ['tc_oi', 'ximuoi', 'muoitom', 'rauram', 'ot', 'duong'], price: 139, brothCost: 7, cookMin: 15, unlockLv: 3,
    desc: 'Ổi giòn ngọt áo một lớp bột xí muội chua chua mặn mặn, thơm mùi rau răm.' },
  { id: 'xoaicat', name: 'Xoài lắc mắm ruốc',  icon: 'pot_xoaicat', broth: 'xoaicat', recipe: ['tc_xoaicat', 'mamruoc', 'rauram', 'dauphong', 'ot', 'duong'], price: 129, brothCost: 7, cookMin: 16, unlockLv: 5,
    desc: 'Xoài cát non chấm mắm ruốc xào đường sệt sệt. Đậm đà tới mức muốn liếm luôn cái ly.' },
  { id: 'thomlac', name: 'Thơm lắc khô bò',    icon: 'pot_thomlac', broth: 'thomlac', recipe: ['tc_thom', 'khobo', 'dauphong', 'muoitom', 'ot', 'duong'], price: 159, brothCost: 9, cookMin: 16, unlockLv: 8,
    desc: 'Thơm vàng ươm mọng nước, lắc cùng khô bò sợi cay cay và đậu phộng rang giòn.' },
  { id: 'manlac',  name: 'Mận lắc sốt me',     icon: 'pot_manlac',  broth: 'manlac',  recipe: ['tc_man', 'sotme', 'khomuc', 'ximuoi', 'ot', 'duong'], price: 169, brothCost: 8, cookMin: 15, unlockLv: 11,
    desc: 'Mận đỏ au giòn sần sật, sốt me sóng sánh, thêm khô mực xé. Ngon tới mức quên cả ra chơi.' },
  { id: 'thapcam', name: 'Trái cây lắc thập cẩm Nhà Mình', icon: 'pot_thapcam', broth: 'thapcam',
    recipe: ['tc_mix', 'muoitom', 'ot', 'duong', 'dauphong', 'sotme', 'ximuoi', 'rauram', 'mamruoc', 'khobo', 'khomuc'], price: 279, brothCost: 12, cookMin: 20, unlockLv: 18,
    desc: 'Món tủ của xe: đủ mười loại topping, hộp to bự, lắc theo công thức bí truyền của Má.' },
];

export const RECIPE = {
  maxLevel: 5,
  pricePerLevel: 0.12,           // +12% price per level above 1
  qualityPerLevel: 0.08,
  upgradeCost: (pot, lvl) => Math.round(pot.price * 2.5 * Math.pow(2.0, lvl - 1)), // cost to go lvl → lvl+1
  masteryAt: [10, 50, 200, 500], // pots sold → mastery stars 1..4
  masteryPriceBonus: 0.03,       // per mastery star
};

// ───────────────────────────── DRINKS ─────────────────────────────
// Drinks are not stocked; serving one deducts `cost` automatically.
export const DRINKS = [
  { id: 'trada',    name: 'Trà đá',    icon: 'drk_trada',    price: 3,  cost: 0.5, unlockLv: 1 },
  { id: 'nuocngot', name: 'Nước ngọt', icon: 'drk_nuocngot', price: 15, cost: 7,   unlockLv: 1 },
  { id: 'tratac',   name: 'Trà tắc',   icon: 'drk_tratac',   price: 12, cost: 3,   unlockLv: 2 },
  { id: 'nuocsam',  name: 'Nước sâm',  icon: 'drk_nuocsam',  price: 15, cost: 4,   unlockLv: 4 },
  { id: 'nuocdua',  name: 'Nước dừa',  icon: 'drk_nuocdua',  price: 22, cost: 9,   unlockLv: 7 },
  { id: 'sinhto',   name: 'Sinh tố xoài', icon: 'drk_sinhto', price: 30, cost: 12, unlockLv: 19, needs: 'blender' },   // v2.6.9: needs the blender
];
export const DRINK_CHANCE = 0.75;     // per person; + cooler level × 0.06

// ───────────────────────────── CUSTOMERS ─────────────────────────────
// patience: game minutes from order ticket to food served (×staff/upgrade multipliers, ×PATIENCE_MULT)
export const PATIENCE_MULT = 2;   // the player asked for customers to wait twice as long
// prefers: weights over dish ids (missing = 0.5). drinks: weights over drink ids (missing = 1)
// hours: demand multipliers per hour for this kind (missing = 1). weight: base share of spawns.
// v2.6.4: groups are 1–3 people (pairs are one of each, families dad + mom + kid) so the counter never looks crowded
export const CUSTOMERS = {
  sinhvien: { name: 'Học trò', group: [1, 2], patience: 90, budget: 110, weight: 1.3, minTier: 1,
    tipChance: 0.05, tip: [2, 5], extraChance: 0.25,
    prefers: { coclac: 3, xoailac: 2, oilac: 1.2 }, drinks: { trada: 4, tratac: 2, nuocngot: 1 },
    hours: { 10: 0.3, 11: 1.0, 12: 1.2, 14: 0.5, 18: 1.0, 19: 1.3, 20: 1.6, 21: 1.8, 22: 1.6 },
    desc: 'Trống tan trường là ùa ra cổng. Tiền ăn vặt ít mà ghé mỗi ngày, cười giòn như xoài keo.' },
  vanphong: { name: 'Dân văn phòng', group: [1, 2], patience: 60, budget: 180, weight: 1.0, minTier: 1,
    tipChance: 0.18, tip: [5, 15], extraChance: 0.15,
    prefers: { oilac: 3, xoaicat: 2, xoailac: 1.5, manlac: 1.5 }, drinks: { tratac: 3, nuocngot: 2, nuocsam: 2 },
    hours: { 11: 1.9, 12: 2.0, 13: 1.0, 14: 0.3, 17: 1.5, 18: 1.6, 19: 1.0, 21: 0.4, 22: 0.2 },
    desc: 'Ghé mua ly xoài lắc ăn cho tỉnh ngủ giờ trưa. Lắc chậm là ăn ngay 3 sao.' },
  giadinh:  { name: 'Phụ huynh & bé', group: [3, 3], patience: 75, budget: 200, weight: 0.8, minTier: 1,
    tipChance: 0.1, tip: [5, 10], extraChance: 0.3,
    prefers: { xoailac: 3, xoaicat: 2.5, coclac: 1, thomlac: 2 }, drinks: { nuocngot: 3, nuocdua: 2, nuocsam: 2 },
    hours: { 10: 0.5, 11: 1.0, 12: 1.2, 17: 1.2, 18: 1.6, 19: 1.8, 20: 1.0, 21: 0.4, 22: 0.1 },
    desc: 'Ba mẹ đón con tan trường. Bé thích nhất là lúc chị chủ lắc hũ xoài rổn rảng.' },
  capdoi:   { name: 'Cặp đôi', group: [2, 2], patience: 80, budget: 190, weight: 0.9, minTier: 1,
    tipChance: 0.12, tip: [5, 15], extraChance: 0.2, likesAmbience: true,
    prefers: { oilac: 3, manlac: 3, coclac: 1, xoailac: 1 }, drinks: { tratac: 2, nuocdua: 2, nuocsam: 1 },
    hours: { 11: 0.5, 12: 0.6, 18: 1.2, 19: 1.6, 20: 1.8, 21: 1.6, 22: 1.0 },
    desc: 'Chia nhau một ly xoài lắc, ai được miếng cuối là cả một vấn đề. Để ý từng cái đèn, từng chậu cây.' },
  hoiban:   { name: 'Hội bạn thân', group: [2, 2], patience: 90, budget: 230, weight: 0.7, minTier: 1,
    tipChance: 0.1, tip: [5, 20], extraChance: 0.65,
    prefers: { oilac: 2, manlac: 2.5, thomlac: 2, thapcam: 2.5, xoaicat: 1 }, drinks: { nuocngot: 3, tratac: 2, trada: 2 },
    hours: { 10: 0.1, 11: 0.4, 12: 0.5, 18: 1.0, 19: 1.4, 20: 1.8, 21: 2.0, 22: 1.8 },
    desc: '"Lắc mạnh lên chị ơi!" Gọi thêm topping liên tục, tám tới tối mịt mới chịu về.' },
  chutu:    { name: 'Chú Tư bảo vệ', group: [1, 1], patience: 140, budget: 160, weight: 0, minTier: 1,
    tipChance: 0.3, tip: [5, 5], extraChance: 0.2, regular: true, oncePerDay: true, arriveHour: [17, 19],
    prefers: { xoaicat: 3, xoailac: 2, coclac: 1 }, drinks: { trada: 5 },
    desc: 'Bảo vệ trường kế bên. Ngày nào cũng ghé, ngồi đúng một bàn quen, kể chuyện hồi Má mới mở xe.' },
  khachtay: { name: 'Khách Tây', group: [1, 2], patience: 80, budget: 280, weight: 0.22, minTier: 2,
    tipChance: 0.6, tip: [20, 60], extraChance: 0.3, likesNew: true,
    prefers: { oilac: 2, thomlac: 2, manlac: 2, xoailac: 1 }, drinks: { nuocdua: 4, tratac: 2 },
    hours: { 11: 1.0, 12: 1.0, 19: 1.3, 20: 1.3 },
    desc: 'Lần đầu ăn trái cây chấm muối. Nhăn mặt vì chua, rồi tip mạnh tay. "So sour! Ngon quá!"' },
  reviewer: { name: 'Food Reviewer', group: [1, 1], patience: 65, budget: 320, weight: 0.03, minTier: 1,
    tipChance: 0.2, tip: [10, 30], extraChance: 0.5, special: true, reviewWeight: 5,
    prefers: { thapcam: 3, manlac: 2, thomlac: 2, oilac: 2, xoaicat: 1, xoailac: 1, coclac: 1 }, drinks: { tratac: 1, nuocsam: 1 },
    desc: 'Một video của anh ấy có thể làm cả con đường xếp hàng. Hoặc làm quán vắng cả tuần.' },
  tiktoker: { name: 'Hot TikToker', group: [1, 1], patience: 60, budget: 250, weight: 0.05, minTier: 2,
    tipChance: 0.2, tip: [10, 20], extraChance: 0.3, special: true, likesAmbience: true,
    prefers: { oilac: 2, manlac: 2, thapcam: 2 }, drinks: { nuocdua: 2, tratac: 2 },
    hours: { 19: 1.5, 20: 1.5, 21: 1.5 },
    desc: '"Hello cả nhà iu!" Quay cảnh lắc xoài một cái là lên xu hướng liền.' },
  doandulich: { name: 'Đoàn du lịch', group: [2, 2], patience: 70, budget: 350, weight: 0.04, minTier: 3,
    tipChance: 0.4, tip: [20, 50], extraChance: 0.6, special: true,
    prefers: { thapcam: 4, thomlac: 2, manlac: 2 }, drinks: { nuocdua: 3, nuocngot: 2 },
    hours: { 12: 1.5, 18: 1.5, 19: 1.5 },
    desc: 'Hướng dẫn viên cầm cờ dẫn cả đoàn tới thử ăn vặt Sài Gòn. Ăn nhanh, trả nhanh, khen nức nở.' },
  shipper:  { name: 'Anh shipper', group: [1, 1], patience: 45, budget: 200, weight: 0.35, minTier: 2,
    tipChance: 0.15, tip: [2, 5], extraChance: 0, takeaway: true,
    prefers: { xoailac: 2, oilac: 2, xoaicat: 2 }, drinks: {},
    hours: { 11: 1.5, 12: 1.5, 18: 1.5, 19: 1.5, 20: 1.2 },
    desc: 'Đơn mang về cho khách đặt qua app. Không cần bàn, chỉ cần nhanh.' },
};

// Ambient NPC (not a customer): cô bán vé số
export const LOTTERY = {
  name: 'Cô bán vé số', ticketPrice: 10, maxPerDay: 5, visitChancePerHour: 0.12,
  prizes: [{ chance: 0.01, amount: 1000 }, { chance: 0.10, amount: 100 }], // checked in order at day end
};

// ───────────────────────────── SATISFACTION / RATING ─────────────────────────────
export const SAT = {
  base: 3.5,                    // fast owner-served early table ≈ 4.3★ avg (tune with the sim)
  qualityWeight: 1.3,           // quality ~0.55 .. 1.15
  baseQuality: 0.55,
  ownerSkill: 0.12,             // owner prepares → quality bonus
  chefSkillPer: 0.02,           // per chef skl point
  stoveQualityPer: 0.03,        // per stove-type level
  knifeQualityPer: 0.02,
  wait: [[0.35, 0.5], [0.6, 0.15], [0.85, -0.35], [Infinity, -0.9]], // waited/patience thresholds → bonus
  ambienceWeight: 0.6,          // × ambience score 0..1
  charmMax: 0.3,                // best cashier/waiter charm bonus
  pricePenalty: 1.2,            // × (price/budget − 1), capped
  pricePenaltyCap: 1.0,
  substitutePenalty: 0.5,       // ordered dish unavailable → picked another
  hotNoCooling: -0.4,
  rainNoTarp: -0.5,
  noise: 0.35,
  angryStars: 1,                // left before being served
};
export const RATING = {
  window: 60, prior: 3.5, priorWeight: 8,
  reviewChance: 0.55,           // regular customers leaving a written review (specials: always)
  demandMult: (r) => 0.5 + 0.25 * (r - 1), // 1★ → 0.5×, 5★ → 1.5×
};

export const COMBO = { fastRatio: 0.35, bonusPer: 0.03, maxBonus: 0.30 };

// "Giữ để lắc": hold LẮC!, the ring fills over holdSec, release inside the dish's zone for a perfect shake.
// Staff-made portions carry no grade (neutral). Score is added to the satisfaction score (≈ ±stars).
export const SHAKE = {
  holdSec: 1.25, tapSec: 0.16, nearPad: 0.08,
  zone: { xoailac: [0.58, 0.80], coclac: [0.48, 0.70], oilac: [0.52, 0.74], xoaicat: [0.62, 0.82],
          thomlac: [0.66, 0.86], manlac: [0.50, 0.72], thapcam: [0.70, 0.90] },
  tutorialZone: [0.40, 0.90],
  score: { perfect: 0.4, good: 0, weak: -0.2, over: -0.25 },
  tip: 0.15, streakTip: 0.04, maxStreakTip: 0.2,       // perfect: extra tip = pot price × (tip + streak bonus)
  label: { perfect: 'Lắc đều tay!', good: 'Tạm được', weak: 'Lắc chưa thấm…', over: 'Lắc mạnh quá, văng muối!' },
  phone: 'Lắc thật luôn!',
};

// ───────────────────────────── STAFF ─────────────────────────────
export const STAFF = {
  roles: {
    phucvu:  { name: 'Phục vụ',  icon: 'ui_staff', unlockLv: 2,  minTier: 1, max: 99, desc: 'Đứng quầy đưa ly, rót nước mời khách đang xếp hàng — khách đợi lâu hơn, tip nhiều hơn.' },
    daubep:  { name: 'Thợ lắc',  icon: 'eq_pot',  unlockLv: 3,  minTier: 1, max: 99, desc: 'Gọt trái, pha muối và lắc từng phần cho mỗi phiếu.' },
    thungan: { name: 'Thu ngân', icon: 'ui_coin',  unlockLv: 7,  minTier: 2, max: 1,  desc: 'Khách kiên nhẫn hơn 20%, tip nhiều hơn.' },
    quankho: { name: 'Quản kho', icon: 'ui_kho',   unlockLv: 10, minTier: 3, max: 1,  desc: 'Mỗi sáng tự nhập đủ trái cây, topping, món ăn kèm, ly hộp. Đang bán mà sắp hết thì tự chạy ra chợ mua về liền.' },
  },
  slotsByTier: [2, 4, 6, 9, 9],
  rarityWeights: [40, 30, 18, 9, 3],          // ★1..★5
  rarityPoints: [6, 9, 12, 16, 21],           // total stat points (spd+skl+chm), ±2
  salary: (s, tier) => Math.round((30 + 5 * (s.spd + s.skl + s.chm)) * [1, 1.6, 2.4, 2.8, 2.8][tier - 1]), // k/day
  hireFeeDays: 1,
  refreshCost: (tier) => 30 * [1, 3, 8, 20, 20][tier - 1],
  levelXp: [10, 30, 60, 100, 160, 240, 350, 500, 700], // jobs done to reach lvl 2..10
  levelSalaryUp: 0.05,
  // speeds are multipliers on top of base action times
  speedMult: (spd) => 0.6 + 0.08 * spd,      // spd 1..10 → 0.68..1.4
  walkPxPerMin: (spd) => 11 + spd,           // owner walks 14 px / game-min
  managerBonus: 0.10,                        // owner in manage mode → all staff +10% speed
  traits: [
    { id: 'nhanh',    name: 'Nhanh như sóc', desc: 'Tốc độ +20%' },
    { id: 'ngot',     name: 'Miệng ngọt',    desc: 'Tip +25%' },
    { id: 'chamchi',  name: 'Chăm chỉ',      desc: 'Lên cấp nhanh gấp đôi' },
    { id: 'tiktok',   name: 'Mê TikTok',     desc: 'Khách tới quán +5%' },
    { id: 'hat',      name: 'Hay hát',       desc: 'Khách kiên nhẫn hơn 10%' },
    { id: 'kytinh',   name: 'Kỹ tính',       desc: 'Món ngon hơn (+0.05 chất lượng)' },
    { id: 'tietkiem', name: 'Tiết kiệm',     desc: '10% cơ hội không tốn nguyên liệu' },
    { id: 'vung',     name: 'Hơi vụng',      desc: 'Chậm hơn 10% nhưng lương rẻ 30%' },
  ],
  traitChance: 0.6,
  names: ['Bé Na', 'Anh Tèo', 'Chị Mơ', 'Tí', 'Tủn', 'Bông', 'Su', 'Mít', 'Bin', 'Thỏ', 'Cốm', 'Gạo', 'Bắp', 'Đậu',
    'Xu', 'Út Hiền', 'Cu Tí', 'Khoa', 'Thảo', 'Vy', 'Trâm', 'Duy', 'Phát', 'Lộc', 'Hân', 'Tuấn', 'Long', 'Nhi',
    'Quân', 'Hậu', 'Kem', 'Mận', 'Bơ', 'Sóc', 'Tũn', 'Chíp', 'Na Na', 'Bé Ba', 'Anh Hai', 'Chị Út'],
};

// Owner base action speeds (game minutes)
export const OWNER = {
  walkPxPerMin: 14,
  prepPerIngredient: 0,     // player taps = instant
  chefPrepPerIngredient: 4, // thợ lắc: 4 min / (speedMult × knifeMult)
  tapBoostMin: 1.5,         // each tap on a cooking pot adds this much progress (max 8 taps/s)
};

// ───────────────────────────── UPGRADES ─────────────────────────────
// costs[i] = price to go from level i to i+1. minTier[i] = tier needed for that step.
// perTier: level resets meaning per tier (count added beyond tier.start*); cost uses tierCostBase.
export const UPGRADE_CATS = [
  { id: 'banghe',  name: 'Bàn ghế' },
  { id: 'bep',     name: 'Quầy lắc' },
  { id: 'thietbi', name: 'Thiết bị' },
  { id: 'quangba', name: 'Quảng bá' },
];
export const UPGRADES = [
  { id: 'table', cat: 'banghe', name: 'Mở thêm ô quầy', icon: 'eq_table', perTier: true, tierCostBase: [180, 900, 4000, 8000], growth: 1.6,
    desc: 'Thêm một chỗ đứng gọi món trước quầy — phục vụ được nhiều khách cùng lúc hơn.' },
  { id: 'sidetable', cat: 'banghe', name: 'Bàn ghế hai bên quán', icon: 'eq_table', costs: [400, 1500, 6000], minTier: [1, 2, 3],
    levels: ['2 bộ bàn nhựa', '3 bộ bàn', '4 bộ bàn', '4 bộ + bàn dài sát lan can'],
    desc: 'Kê thêm bàn ghế trên vỉa hè hai bên quầy. Khách mua xong ra bàn ngồi ăn, ô quầy trống sớm cho người sau, khách cũng vui hơn.' },
  { id: 'tablestyle', cat: 'banghe', name: 'Ghế chờ cho khách', icon: 'eq_table', costs: [300, 2200, 9000, 32000], minTier: [1, 2, 3, 4],
    levels: ['Đứng đợi', 'Ghế nhựa', 'Băng ghế gỗ', 'Ghế đệm', 'Sofa mini'], amb: 4, patiencePer: 0.08,
    desc: 'Khách xếp hàng có ghế ngồi đợi thì kiên nhẫn hơn, gánh cũng sang hơn.' },
  { id: 'stovetype', cat: 'bep', name: 'Quầy sơ chế', icon: 'eq_stove', costs: [400, 2400, 8000, 32000], minTier: [1, 1, 2, 3],
    levels: ['Quầy gỗ mộc', 'Gỗ sồi + tủ kính nhỏ', 'Sơn bạc hà + khay topping', 'Quầy inox', 'Đá cẩm thạch viền vàng'], speedPer: 0.25,
    desc: 'Mặt quầy đổi chất liệu theo từng cấp. Trái giữ lạnh giòn ngon, topping bày gọn gàng: phần lắc ngon hơn, khách chấm điểm cao hơn.' },
  { id: 'knife', cat: 'bep', name: 'Dao thớt bén', icon: 'eq_knife', costs: [150, 600, 2400, 8000, 25000, 60000, 150000], minTier: [1, 1, 2, 3, 4, 4, 4],
    minLv: [1, 1, 1, 1, 1, 21, 30],   // v2.6.9: levels 6–7 = máy bào sợi xoài
    levels: ['Dao cũ', 'Dao bén', 'Dao Thái', 'Bộ dao inox', 'Dao + thớt gỗ nghiến', 'Bộ dao chuyên nghiệp', 'Máy bào sợi xoài', 'Máy bào sợi đôi'],
    speedPer: 0.15, desc: 'Thợ lắc gọt trái nhanh hơn, miếng xoài cũng đẹp hơn. Từ Lv 21 có máy bào sợi xoài.' },
  // ── v2.6.9 thiết bị mới: open on levels that only had a decoration / perk (minLv per level) ──
  { id: 'shaker', cat: 'bep', name: 'Hũ lắc inox', icon: 'eq_shaker', costs: [6000, 20000, 60000], minLv: [13, 18, 24],
    levels: ['Hũ nhựa', 'Hũ inox', 'Hũ inox 2 lớp', 'Bình lắc chuyên nghiệp'], zonePer: 0.025, qualityPer: 0.02,
    desc: 'Lắc đều tay hơn: vùng LẮC chuẩn rộng hơn, món ngon hơn một chút.' },
  { id: 'hygiene', cat: 'bep', name: 'Bồn rửa tay & khay inox', icon: 'eq_sink', costs: [15000, 40000], minLv: [20, 26],
    levels: ['Chưa có', 'Bồn rửa tay', 'Bồn rửa + khay inox, găng tay'], qualityPer: 0.03,
    desc: 'Sạch sẽ thấy rõ: khách yên tâm, chấm điểm cao hơn.' },
  { id: 'scale', cat: 'bep', name: 'Cân điện tử', icon: 'eq_scale', costs: [70000], minLv: [31], buyMult: 0.96,
    desc: 'Định lượng chuẩn từng phần, đỡ hao hụt: nhập trái cây, topping rẻ hơn 4%.' },
  { id: 'icemaker', cat: 'thietbi', name: 'Đá viên', icon: 'eq_ice', costs: [12000, 45000], minLv: [17, 22],
    levels: ['Mua đá ngoài', 'Thùng đá giữ lạnh', 'Máy làm đá'], drinkCostPer: 0.12, drinkChancePer: 0.02,
    desc: 'Có đá sẵn: nước uống rẻ vốn hơn, ly nào cũng mát lạnh nên khách gọi nước nhiều hơn.' },
  { id: 'blender', cat: 'thietbi', name: 'Máy xay sinh tố', icon: 'eq_blender', costs: [30000], minLv: [19], drinkChancePer: 0.04,
    desc: 'Mở món nước Sinh tố xoài (30k) và khách gọi nước nhiều hơn.' },
  { id: 'packing', cat: 'thietbi', name: 'Máy ép miệng ly', icon: 'eq_pack', costs: [50000], minLv: [25], demandPer: 0.04, qualityPer: 0.02,
    desc: 'Ly ép kín, mang đi không đổ: thêm khách mua mang về, món tới tay vẫn ngon.' },
  { id: 'kiosk', cat: 'thietbi', name: 'Máy tính bảng gọi món', icon: 'eq_tablet', costs: [90000], minLv: [27], patiencePer: 0.12,
    desc: 'Khách tự xem menu và chọn món trong lúc xếp hàng nên chờ được lâu hơn.' },
  { id: 'filter', cat: 'thietbi', name: 'Máy lọc nước', icon: 'eq_filter', costs: [150000], minLv: [36], drinkCostPer: 0.15, drinkChancePer: 0.03,
    desc: 'Nước lọc sạch tại chỗ: trà, nước pha rẻ vốn hơn, khách gọi nước nhiều hơn.' },
  { id: 'delivery', cat: 'thietbi', name: 'Xe máy giao hàng', icon: 'eq_moto', costs: [100000, 220000, 400000], minLv: [35, 38, 40],
    levels: ['Chưa có', '1 xe giao', '2 xe giao', '3 xe giao'], perHour: 1.5, appFee: 0.2,
    desc: 'Trong giờ bán có đơn giao tận nơi: lấy hàng trong kho, thu tiền món (trừ 20% phí app). Không chiếm ô quầy.' },
  { id: 'master', cat: 'thietbi', name: 'Bảo trì bậc thầy', icon: 'eq_master', costs: [300000, 420000, 590000, 830000, 1160000, 1620000, 2270000, 3180000, 4450000, 6230000],
    minLv: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50], per: 0.015,
    desc: 'Sau Lv 40: mỗi cấp bảo trì cả quán, khách +1,5%, tip +1,5%, kiên nhẫn +1,5%.' },
  { id: 'kho', cat: 'thietbi', name: 'Kho chứa', icon: 'ui_kho', costs: [300, 2000, 7500, 26000, 90000], minTier: [1, 2, 3, 4, 4],
    levels: ['Thùng xốp', 'Tủ mát', 'Tủ mát đôi', 'Kho lạnh mini', 'Kho lạnh lớn', 'Kho lạnh siêu lớn'], capMult: [1, 1.6, 2.4, 3.5, 5, 7], minLv: [1, 1, 1, 1, 17],
    desc: 'Chứa được nhiều trái cây và topping hơn.' },
  { id: 'cooler', cat: 'thietbi', name: 'Tủ mát nước', icon: 'eq_cooler', costs: [200, 1200, 5000], minTier: [1, 2, 3],
    drinkChancePer: 0.06, desc: 'Nước lạnh mát, khách gọi nước nhiều hơn.' },
  { id: 'tarp', cat: 'thietbi', name: 'Bạt che mưa', icon: 'eq_tarp', costs: [200], minTier: [1],
    desc: 'Mưa rào thì chạm Kéo bạt để che khách. Không có bạt, khách ướt sẽ bỏ về!' },
  { id: 'cooling', cat: 'thietbi', name: 'Quạt & dù che', icon: 'eq_fan', costs: [250, 2000, 10000, 180000], minTier: [1, 2, 3, 4], minLv: [1, 1, 1, 37],
    levels: ['Không có', 'Quạt đứng', 'Dù sọc che nắng', 'Quạt phun sương', 'Quạt hơi nước + rèm tre'], amb: 3,
    desc: 'Ngày nắng nóng không mất khách.' },
  { id: 'speaker', cat: 'thietbi', name: 'Loa nhạc', icon: 'eq_speaker', costs: [400, 4000], minTier: [1, 2], amb: 2, patiencePer: 0.10,
    levels: ['Không có', 'Loa thùng · +2 bài: Phố chiều, Quê nhà', 'Loa kéo · +2 bài: Nhạc sàn vui, Bolero đêm'],
    desc: 'Nhạc hay thì khách chờ cũng không thấy lâu. Mỗi cấp loa thêm 2 bài nhạc nền; chọn bài ngay dưới đây hoặc trong Cài đặt.' },
  { id: 'pos', cat: 'thietbi', name: 'Máy tính tiền', icon: 'ui_coin', costs: [3000, 25000], minTier: [2, 3], minLv: [1, 23], tipMult: [1, 1.2, 1.32],
    levels: ['Chưa có', 'Máy tính tiền', 'Máy tính tiền + mã QR'], patienceQr: 0.05,
    desc: 'Thu tiền nhanh gọn, khách vui tip thêm. Từ Lv 23 thêm mã QR chuyển khoản.' },
  // v2.6.20: 'supplier' (Mối vựa trái cây, 2000k, morning auto-delivery +8 %) removed; old saves are refunded (state.js)
  { id: 'sign', cat: 'quangba', name: 'Biển hiệu', icon: 'eq_sign', costs: [200, 1500, 7500, 26000, 80000], minTier: [1, 2, 3, 4, 4], minLv: [1, 1, 1, 1, 26], amb: 2, demandPer: 0.12,
    levels: ['Không có', 'Bảng giấy', 'Bảng gỗ sơn', 'Hộp đèn', 'Đèn neon', 'Đèn LED nháy chữ'],
    desc: 'Người đi đường dễ thấy quán hơn.' },
  { id: 'menuscreen', cat: 'quangba', name: 'Màn hình menu điện tử', icon: 'eq_menuscreen', costs: [120000], minLv: [33], priceValue: 0.15,
    desc: 'Hình món đẹp, giá rõ ràng: ít khách chê đắt hơn.' },
];
// helper: price of the next level of an upgrade; returns null at max
export function upgradeCost(up, level, tier, tierLevelsBought = level) {
  if (up.perTier) {
    const base = up.tierCostBase[Math.min(tier, 4) - 1];
    return Math.round(base * Math.pow(up.growth, tierLevelsBought));
  }
  if (level >= up.costs.length) return null;
  return up.costs[level];
}

// ───────────────────────────── DECO ─────────────────────────────
// One equipped item per category. amb = ambience points. source: shop | login | quest | chest
export const DECO_CATS = [
  { id: 'den',     name: 'Đèn' },
  { id: 'cay',     name: 'Cây' },
];
// v2.4: only items that are actually drawn outside the shop stay on sale. Removed (refunded on load, see state.js
// REMOVED_DECO): đèn dây vàng (the string lights are always there), every Tường and Đặc biệt item.
export const DECO = [
  { id: 'den_bong',     cat: 'den', name: 'Bóng đèn tròn',     price: 0,     amb: 0,  default: true },
  { id: 'den_long_do',  cat: 'den', name: 'Đèn lồng đỏ',       price: 900,   amb: 8 },
  { id: 'den_hoian',    cat: 'den', name: 'Đèn lồng Hội An',   price: 5000,  amb: 14, minTier: 2 },
  { id: 'den_chum',     cat: 'den', name: 'Đèn lồng tre đan',  price: 25000, amb: 22, minTier: 3 },   // v2.6.20: was 'Đèn chùm pha lê' (same id for saves)

  { id: 'cay_none',     cat: 'cay', name: 'Chưa có cây',       price: 0,     amb: 0,  default: true },
  { id: 'cay_luoiho',   cat: 'cay', name: 'Chậu lưỡi hổ',      price: 200,   amb: 3 },
  { id: 'cay_kimtien',  cat: 'cay', name: 'Cây kim tiền',      price: 600,   amb: 6,  desc: 'Tên nghe đã thấy giàu.' },
  { id: 'cay_tre',      cat: 'cay', name: 'Khóm trúc',         price: 3000,  amb: 10, minTier: 2 },
  { id: 'cay_bonsai',   cat: 'cay', name: 'Bonsai cổ thụ',     price: 15000, amb: 18, minTier: 3 },
  { id: 'cay_mai',      cat: 'cay', name: 'Cây mai ngày Tết',  price: 0,     amb: 15, source: 'login', desc: 'Quà điểm danh ngày 4.' },
];
// price paid for each removed item (k): refunded once when an old save loads
export const REMOVED_DECO = {
  den_day: 250, tuong_lich: 150, tuong_dongho: 1100, tuong_quat: 4000, tuong_sonmai: 20000,
  db_ongdia: 888, db_meo: 2500, db_tivi: 6000, db_beca: 18000, db_karaoke: 40000, tuong_tron: 0, db_none: 0,
};

// ───────────────────────────── LOOKS (v2.3: cosmetic choices unlocked by level perks) ─────────────────────────────
// Free to change any time once unlocked; they only change how things look (the perk itself carries the bonus).
// Tem logo (Lv 24): printed on every cup and next to the name on the sign board.
export const BRAND = {
  lv: 24,
  frames: [{ id: 'tron', name: 'Tròn' }, { id: 'bogoc', name: 'Bo góc' }, { id: 'ruybang', name: 'Ruy băng' }],
  texts: [{ id: 'thang', name: 'Thẳng hàng' }, { id: 'congtren', name: 'Cong phía trên' }, { id: 'congduoi', name: 'Cong phía dưới' }],
  // bg = stamp fill, ink = text/border colour picked to read on it
  colors: [
    { id: 'trang', bg: '#ffffff', ink: '#2f6b1f' }, { id: 'kem', bg: '#fbe9cf', ink: '#8a4b1c' },
    { id: 'hong', bg: '#fadadd', ink: '#b8325a' },  { id: 'bacha', bg: '#cfeee3', ink: '#1f6b57' },
    { id: 'nau', bg: '#a8714a', ink: '#fff3d6' },   { id: 'den', bg: '#3a2d36', ink: '#ffcf3d' },
    { id: 'vang', bg: '#ffe08a', ink: '#8a4b1c' },  { id: 'tim', bg: '#e2d4f5', ink: '#6b3fa0' },
  ],
  mascots: ['fr_xoai', 'pot_xoailac', 'fr_coc', 'fr_oi', 'fr_thom', 'emo_love', 'ui_heart', 'ui_star', 'emo_yum',
    'mas_xoai', 'mas_meo', 'mas_cun', 'mas_ga', 'mas_heo', 'mas_tho', 'mas_trau', 'mas_sao'],   // v2.6.20 linh vật mới
  slogans: ['Chua cay mặn ngọt', 'Lắc là ghiền', 'Xoài tươi mỗi ngày', 'Ăn là mê', 'Ngon từ miếng đầu'],
  sloganMax: 22,
  def: { on: true, frame: 'tron', text: 'thang', color: 'kem', mascot: 'fr_xoai', slogan: '' },
};
// Đồng phục (Lv 21): recolours the staff sprites' apron / vest / neckerchief (and the shirt, for some styles).
export const UNIFORM = {
  lv: 21,
  colors: [
    { id: 'goc', name: 'Màu gốc', hex: null }, { id: 'cam', name: 'Cam', hex: '#f08a24' },
    { id: 'vang', name: 'Vàng xoài', hex: '#f2c230' }, { id: 'xanhla', name: 'Xanh lá', hex: '#4f9a2a' },
    { id: 'xanhduong', name: 'Xanh dương', hex: '#2f7fd0' }, { id: 'tim', name: 'Tím', hex: '#8a55c8' },
    { id: 'hong', name: 'Hồng', hex: '#e8679a' }, { id: 'nau', name: 'Nâu', hex: '#8a5a36' },
  ],
  styles: [
    { id: 'tapde', name: 'Tạp dề', desc: 'Áo trắng, đổi màu tạp dề / áo gile / khăn.' },
    { id: 'aothun', name: 'Áo thun đồng màu', desc: 'Cả áo nhạt cùng tông với tạp dề.' },
    { id: 'aotoi', name: 'Áo tối, tạp dề màu', desc: 'Áo màu than, tạp dề nổi màu đã chọn.' },
  ],
  def: { color: 'goc', style: 'tapde' },
};
// Mặt tiền (v2.4): every item opens on its own level (see the facade perks in PERKS) and adds ambience points
// (like DECO.amb) while it is up. Free to switch once unlocked.
export const FACADE = {
  cats: [
    { id: 'sign', name: 'Bảng hiệu' }, { id: 'bunting', name: 'Cờ dây' },
    { id: 'flower', name: 'Chậu hoa trên quầy' }, { id: 'balloon', name: 'Bóng bay cạnh bảng hiệu' },
  ],
  items: {
    sign: [
      { id: 'go', name: 'Gỗ xanh (gốc)', lv: 1, amb: 0 }, { id: 'vang', name: 'Bảng vàng viền đỏ', lv: 16, amb: 6 },
      { id: 'nau', name: 'Gỗ nâu chữ trắng', lv: 22, amb: 8 }, { id: 'hong', name: 'Bảng hồng pastel', lv: 26, amb: 10 },
      { id: 'neon', name: 'Đèn neon hồng', lv: 31, amb: 14 },
    ],
    bunting: [
      { id: 'none', name: 'Không treo', lv: 1, amb: 0 },
      { id: 'tet', name: 'Cờ đỏ vàng', lv: 9, amb: 4, cols: ['#e2433b', '#ffcf3d'] },
      { id: 'xoai', name: 'Cờ xanh xoài', lv: 18, amb: 6, cols: ['#7bbf2a', '#ffe08a', '#4f9a2a'] },
      { id: 'cauvong', name: 'Cờ cầu vồng', lv: 33, amb: 9, cols: ['#e2433b', '#f08a24', '#ffcf3d', '#4f9a2a', '#2f7fd0', '#8a55c8'] },
      { id: 'longmini', name: 'Dây đèn lồng mini', lv: 38, amb: 12, cols: ['#e2433b', '#ffcf3d', '#f08a24'] },
    ],
    flower: [
      { id: 'none', name: 'Không đặt', lv: 1, amb: 0 },
      { id: 'cuc', name: 'Chậu cúc vàng', lv: 13, amb: 4, cols: ['#ffcf3d', '#f2a81d'] },
      { id: 'giay', name: 'Hoa giấy hồng', lv: 20, amb: 6, cols: ['#e8679a', '#c2386f'] },
      { id: 'sen', name: 'Sen đá', lv: 28, amb: 8, cols: ['#8fd19e', '#4f9a6a'] },
      { id: 'xuongrong', name: 'Xương rồng ra hoa', lv: 36, amb: 10, cols: ['#4f9a2a', '#ff7ab0'] },
      { id: 'lan', name: 'Lan tím', lv: 40, amb: 12, cols: ['#a066d8', '#7a3fb0'] },
    ],
    balloon: [
      { id: 'none', name: 'Không treo', lv: 1, amb: 0 },
      { id: 'tim', name: 'Bóng bay trái tim', lv: 24, amb: 5, cols: ['#e2433b', '#ff7ab0'] },
      { id: 'maucau', name: 'Chùm bóng 7 màu', lv: 35, amb: 9, cols: ['#e2433b', '#f08a24', '#ffcf3d', '#4f9a2a', '#2f7fd0', '#8a55c8', '#ff7ab0'] },
    ],
  },
  def: { sign: 'go', bunting: 'none', flower: 'none', balloon: 'none' },
};

// ───────────────────────────── TIERS (restaurants) ─────────────────────────────
export const TIERS = [
  { id: 1, scene: 'vihe',    name: 'Gánh xoài cổng trường',      cost: 0,      require: null,
    startTables: 1, maxTables: 2,  startStoves: 2, maxStoves: 2, waitSpots: 2, kho: 300, rent: 0,   demand: 1.0, ambCap: 20, covered: false,
    desc: 'Gánh xoài của Má dưới gốc phượng trước cổng trường, vài bộ bàn nhựa đỏ và rất nhiều quyết tâm.' },
  { id: 2, scene: 'hem',     name: 'Gánh gốc me công viên',   cost: 2500,   require: { level: 5, rating: 3.6 },
    startTables: 2, maxTables: 3,  startStoves: 2, maxStoves: 3, waitSpots: 3, kho: 640, rent: 80,  demand: 1.5, ambCap: 40, covered: true,
    desc: 'Dời gánh vào góc công viên dưới cây me già. Tán me che nắng che mưa, khách tập thể dục ghé ăn đông dần.' },
  { id: 3, scene: 'mapho',   name: 'Dãy xe đẩy ven hồ', cost: 15000,  require: { level: 10, rating: 4.0 },
    startTables: 2, maxTables: 3, startStoves: 3, maxStoves: 4, waitSpots: 4, kho: 1200, rent: 300, demand: 2.1, ambCap: 65, covered: true,
    desc: 'Cả dãy xe đẩy dọc bờ hồ, dù sọc che mát, gió hồ lồng lộng. Giờ bạn là "trùm" ăn vặt bờ hồ.' },
  { id: 4, scene: 'haitang', name: 'Chợ đêm bờ kè 2 tầng',  cost: 60000,  require: { level: 16, rating: 4.3 },
    startTables: 3, maxTables: 5, startStoves: 4, maxStoves: 5, waitSpots: 5, kho: 2000, rent: 900, demand: 2.7, ambCap: 90, covered: true,
    desc: 'Bao trọn bờ kè ven sông: tầng trên ngắm sông cho hội bạn ngồi tám, tầng dưới sát lề đường bán mang đi.' },
  { id: 5, scene: 'haitang', name: 'Chuỗi gánh Xoài Lắc Nhà Mình',   cost: 250000, require: { level: 22, rating: 4.5 }, chain: true,
    startTables: 4, maxTables: 5, startStoves: 5, maxStoves: 5, waitSpots: 5, kho: 2000, rent: 900, demand: 2.7, ambCap: 90, covered: true,
    desc: 'Mở chi nhánh khắp Việt Nam. Gánh gốc vẫn bán như cũ, đòn gánh của Má treo ngay chỗ đẹp nhất.' },
];
export const TIER_MULT = [1, 3, 8, 20, 50]; // reward/price scaling helper by tier

// ───────────────────────────── LEVELS ─────────────────────────────
export const XP_EASE = 0.8;
export const XP_LATE = 0.9;
export const LEVEL = {
  // Lv 1–22 unchanged. From Lv 22 each level costs +8 % of the Lv 22 step (linear), so Lv 23–40 stay reachable (~4–7 days each).
  // v2.6.1: every level needs 20 % less XP than before (XP_EASE), so the ring fills up a little sooner
  xpBase: (lv) => (lv === 1 ? 60 : lv <= 22 ? 450 * Math.pow(1.295, lv - 2) : 450 * Math.pow(1.295, 20) * (1 + 0.08 * (lv - 22))),
  // v2.6.7: from Lv 22 on, a further 10 % less (XP_LATE)
  xpToNext: (lv) => Math.round(LEVEL.xpBase(lv) * XP_EASE * (lv >= 22 ? XP_LATE : 1)),
  // XP for a finished table: price/8 + 3/person + 6 if 5★, × tierXp
  xpForGroup: (potPrice, size, stars, tier) => Math.round((potPrice / 8 + 3 * size + (stars >= 5 ? 6 : 0)) * [1, 1.3, 1.7, 2.2, 2.6][tier - 1]),
  thankXp: 2,
  // v2.6.18: serving XP stays full while the player learns (Lv 1–9), then eases to 85 % by Lv 20 so the mid game
  // is not rushed; quest XP (QUEST_XP) was trimmed too. Target: Lv 10 ≈ day 10, Lv 20 ≈ day 35, Lv 30 ≈ day 90.
  serveXpMult: (lv) => (lv < 10 ? 1 : lv >= 20 ? 0.85 : 1 - 0.015 * (lv - 10)),
};
// Feature flags unlocked by level (dishes/ingredients/drinks unlock by their own unlockLv).
export const FEATURES = {
  hire_phucvu: 2, hire_daubep: 3, deco: 4, daily: 4, reservations: 6, mkt_reviewer: 6,
  hire_thungan: 7, mkt_livestream: 9, hire_quankho: 10, speed2: 5, speed3: 10, manageMode: 7, extras: 3, lottery: 3,
  // v2 (2026-10): new systems open up as the player levels
  pricing: 2,        // Nâng cấp ▸ Giá bán: tự đặt giá bán
  sideUp: 3,         // Nâng cấp: kê thêm bàn ghế hai bên quán (2 bộ có sẵn từ đầu)
  staffBonus: 4,     // Nhân viên: thưởng nóng
  daily4: 6,         // nhiệm vụ ngày: 4 việc thay vì 3
};

// ───────────────────────────── MARKET ─────────────────────────────
export const MARKET = {
  dailyVol: 0.10, meanRevert: 0.2, min: 0.75, max: 1.35, // multiplier random walk on cost
  // no buying while the restaurant is open: the kho is stocked at the start of the day only
  packs: [10, 50],               // buy buttons (+ "Đầy kho")
  soldOutTargetMult: 2,         // …or × this when yesterday sold out (usage undercounts the real demand)
  autoBuyTargetMult: 1.3,        // auto restock to yesterday usage × this (min 8 each for enabled pots)
};

// ───────────────────────────── RAIN SHOWERS (vỉa hè only) ─────────────────────────────
// Rain/storm days bring showers (game-minute windows). At an uncovered tier the player pulls the tarp out
// (button in the scene) while it rains; guests caught in the rain walk out after wetLeaveMin.
export const RAIN = {
  showers: { rain: [2, 3], storm: [1, 1] },
  showerMin: [60, 140],
  from: 10 * 60 + 25, to: 22 * 60 + 40,
  wetLeaveMin: 30,               // game minutes a guest sits in the rain before giving up
  tarpPullSec: 0.9,              // real seconds the unrolling animation takes
  autoTarpTier: 4,               // v2.6.5: from Chợ đêm bờ kè on, the staff roll the tarp out by themselves when a shower starts
};

// ───────────────────────────── WEATHER & EVENTS ─────────────────────────────
export const WEATHER = {
  sun:   { name: 'Nắng đẹp',   icon: 'wx_sun',   weight: 40, demand: 1.0 },
  hot:   { name: 'Nắng nóng',  icon: 'wx_hot',   weight: 20, demand: 1.0, noCoolingDemand: 0.75, noCoolingSat: -0.4 },
  rain:  { name: 'Mưa',        icon: 'wx_rain',  weight: 22, demand: 1.3, uncoveredDemand: 0.6, uncoveredSat: -0.5 },
  cold:  { name: 'Trời lạnh',  icon: 'wx_cold',  weight: 13, demand: 1.45 },
  storm: { name: 'Bão',        icon: 'wx_storm', weight: 5,  demand: 0.5 },
};
export const EVENTS = [
  { id: 'valentine', name: 'Lễ tình nhân',     chance: 0.03, kinds: { capdoi: 3 },   desc: 'Cặp đôi đông gấp 3!' },
  { id: 'bongda',    name: 'Chung kết bóng đá', chance: 0.04, kinds: { hoiban: 2 },   desc: 'Hội bạn kéo nhau đi xem bóng, ghé mua xoài lắc nhâm nhi.' },
  { id: 'luong',     name: 'Ngày lĩnh lương',   chance: 0.04, kinds: { vanphong: 2 }, budgetMult: 1.3, desc: 'Dân văn phòng rủng rỉnh, chịu chi.' },
  { id: 'haisan',    name: 'Xoài vào mùa',      chance: 0.03, priceMult: { tc_xoai: 0.65, tc_xoaicat: 0.65, tc_mix: 0.65 }, desc: 'Xoài keo, xoài cát rẻ hơn 35% ở chợ.' },
  { id: 'lehoi',     name: 'Lễ hội ẩm thực',    chance: 0.02, demand: 1.5, desc: 'Phố đông nghẹt người đi ăn vặt, khách +50%.' },
];

// ───────────────────────────── MARKETING ─────────────────────────────
export const MARKETING = [
  { id: 'toroi',      name: 'Phát tờ rơi',        icon: 'ui_megaphone', cost: 100,  scale: true, demand: 1.35, unlockLv: 1, desc: 'Khách +35% trong ngày.' },
  { id: 'giamgia',    name: 'Khuyến mãi giảm 10%', icon: 'ui_gift',     cost: 0,    demand: 1.5, priceMult: 0.9, unlockLv: 2, desc: 'Khách +50%, giá giảm 10% trong ngày.' },
  { id: 'reviewer',   name: 'Mời Food Reviewer',  icon: 'ui_review',    cost: 800,  scale: true, unlockLv: 6, desc: 'Chắc chắn có reviewer ghé hôm nay.' },
  { id: 'livestream', name: 'Livestream bán hàng', icon: 'ui_music',    cost: 1500, scale: true, demand: 1.7, xp: 200, unlockLv: 9, desc: 'Khách +70% và +XP.' },
  // v2: only inside its hours (h0 ≤ hour < h1) — the quiet afternoon becomes a second rush, at 20 % off
  { id: 'giovang',    name: 'Giờ vàng 14h–17h',    icon: 'ui_clock',     cost: 0,    demand: 1.8, priceMult: 0.8, hours: [14, 17], unlockLv: 8, desc: '14h–17h khách +80%, giá giảm 20% đúng khung giờ đó.' },
  // v2: every guest is offered a drink with the cup, drinks 20 % off all day
  { id: 'hoitro',     name: 'Ngày hội học trò',    icon: 'ui_megaphone', cost: 300,  scale: true, demand: 1.2, kinds: { sinhvien: 2 }, unlockLv: 15, desc: 'Học trò kéo tới gấp đôi, khách +20% cả ngày.' },
  { id: 'combonuoc',  name: 'Combo kèm nước',      icon: 'drk_tratac',   cost: 50,   scale: true, drinkChance: 0.2, drinkPriceMult: 0.8, unlockLv: 12, desc: 'Khách gọi nước nhiều hơn (+20%), nước giảm 20% cả ngày.' },
];
export const VIRAL = { days: 2, demand: 1.6, badDemand: 0.8 };

// ───────────────────────────── OFFLINE & CHAIN ─────────────────────────────
export const OFFLINE = { minAwaySec: 120, shopShare: 0.25, daySec: 240 /* offline pays as if a day took 4 min (kept when days became 9 min) */, shopCapSec: 4 * 3600, chainCapSec: 8 * 3600 };
export const BRANCHES = [
  { id: 'dalat',   name: 'Đà Lạt',   dish: 'Dâu tây lắc',          cost: 70000,   income: 0.9, scene: 'dalat' },  // k per real second at level 1 (×240/540 when days went 4 → 9 min)
  { id: 'vungtau', name: 'Vũng Tàu', dish: 'Xoài lắc khô mực',           cost: 140000,  income: 1.6, scene: 'vungtau' },
  { id: 'cantho',  name: 'Cần Thơ',  dish: 'Cóc lắc mắm ruốc',               cost: 245000,  income: 2.6, scene: 'cantho' },
  { id: 'danang',  name: 'Đà Nẵng',  dish: 'Me lắc đường',                cost: 420000,  income: 4.1, scene: 'haitang' },
  { id: 'hanoi',   name: 'Hà Nội',   dish: 'Sấu dầm gừng',   cost: 700000,  income: 6.7, scene: 'mapho' },
  { id: 'phuquoc', name: 'Phú Quốc', dish: 'Xoài lắc nước mắm Phú Quốc', cost: 1100000, income: 9.5, minLevel: 34, bonus: true, scene: 'phuquoc' },   // v2.2: not needed for the ending
];
// v2.6.7 dời quán chính: once a branch is open, the main shop can move to that city (scene = its counter backdrop).
// Purely the view: money, tier and customers stay the same. null = TP.HCM (the scene follows the tier as before).
export const BRANCH = { maxLevel: 5, upgradeCost: (b, lvl) => Math.round(b.cost * 0.6 * Math.pow(2.2, lvl - 1)) };

// ───────────────────────────── QUESTS ─────────────────────────────
// type: counter name the sim tracks (see TECH_SPEC §Quests). target: number. reward: { money, xp, deco }
export const MAIN_QUESTS = [
  { id: 'q1',  text: 'Bán phần xoài lắc đầu tiên',            type: 'potsSold', target: 1,   reward: { money: 50 }, mom: 'firstSale' },
  { id: 'q2',  text: 'Bán cho 3 khách',                  type: 'served', target: 3,     reward: { money: 60 } },
  { id: 'q3',  text: 'Đi chợ nhập thêm trái cây',    type: 'buyIngredients', target: 1, reward: { money: 40 } },
  { id: 'q4',  text: 'Nhận 3 đánh giá 5★',              type: 'fiveStars', target: 3,  reward: { money: 80 } },
  { id: 'q5',  text: 'Thuê nhân viên phục vụ đầu tiên', type: 'hire:phucvu', target: 1, reward: { money: 100 }, mom: 'firstStaff' },
  { id: 'q6',  text: 'Mua bạt che mưa',                 type: 'upgrade:tarp', target: 1, reward: { money: 80 } },
  { id: 'q7',  text: 'Mở thêm một ô quầy',                 type: 'upgrade:table', target: 1, reward: { money: 120 } },
  { id: 'q8',  text: 'Mở khoá Ổi lắc xí muội (đạt Lv 3)',     type: 'level', target: 3,      reward: { money: 100 } },
  { id: 'q9',  text: 'Thuê thợ lắc',                    type: 'hire:daubep', target: 1, reward: { money: 150 } },
  { id: 'q10', text: 'Bán 5 phần Ổi lắc xí muội',       type: 'potsSoldOf:oilac', target: 5, reward: { money: 150 } },
  { id: 'q11', text: 'Treo đèn lồng, đặt cây hoặc treo cờ trước quán', type: 'decoEquipped', target: 1, reward: { money: 150 } },
  { id: 'q12', text: 'Lãi một ngày từ 800.000đ',        type: 'dayProfit', target: 800, reward: { money: 200 } },
  { id: 'q13', text: 'Nâng công thức bất kỳ lên cấp 2', type: 'recipeLevel', target: 2, reward: { money: 200 } },
  { id: 'q14', text: 'Đạt Lv 5',                        type: 'level', target: 5,      reward: { money: 300 } },
  { id: 'q15', text: 'Dời gánh vào gốc me công viên',  type: 'tier', target: 2,       reward: { money: 600 }, mom: 'tier2' },
  { id: 'q16', text: 'Có 3 nhân viên',                  type: 'staffCount', target: 3, reward: { money: 500 } },
  { id: 'q17', text: 'Gặp 6 kiểu khách khác nhau',      type: 'kindsMet', target: 6,   reward: { money: 500 } },
  { id: 'q18', text: 'Phục vụ 15 lần gọi thêm',         type: 'extrasServed', target: 15, reward: { money: 600 } },
  { id: 'q19', text: 'Đạt 4.0★ với ít nhất 40 đánh giá', type: 'rating', target: 4.0, minReviews: 40, reward: { money: 800 } },
  { id: 'q20', text: 'Mời Food Reviewer và nhận 5★',    type: 'reviewer5', target: 1,  reward: { money: 1000 } },
  { id: 'q21', text: 'Bán 300 phần xoài lắc',                 type: 'potsSold', target: 300, reward: { money: 1500 } },
  { id: 'q22', text: 'Mở dãy xe đẩy ven hồ',          type: 'tier', target: 3,       reward: { money: 3000 }, mom: 'tier3' },
  { id: 'q23', text: 'Thuê Quản kho',                   type: 'hire:quankho', target: 1, reward: { money: 2000 } },
  { id: 'q24', text: 'Trang trí 4 món (đèn, cây, cờ, chậu hoa…)', type: 'decoEquipped', target: 4, reward: { money: 2500 } },
  { id: 'q25', text: 'Doanh thu một ngày từ 8 triệu',   type: 'dayRevenue', target: 8000, reward: { money: 3000 } },
  { id: 'q26', text: 'Mở khoá Mận lắc sốt me (Lv 11)',    type: 'level', target: 11,     reward: { money: 3000 } },
  { id: 'q27', text: 'Đạt combo x10',                   type: 'combo', target: 10,     reward: { money: 3000 } },
  { id: 'q28', text: 'Gặp đủ 10 kiểu khách',            type: 'kindsMet', target: 10,  reward: { money: 5000 } },
  { id: 'q29', text: 'Bao trọn chợ đêm bờ kè',          type: 'tier', target: 4,       reward: { money: 10000 }, mom: 'tier4' },
  { id: 'q30', text: 'Có 8 nhân viên',                  type: 'staffCount', target: 8, reward: { money: 8000 } },
  { id: 'q31', text: 'Mở khoá Trái cây lắc thập cẩm',   type: 'level', target: 18,     reward: { money: 10000 } },
  { id: 'q32', text: 'Bán 2.000 phần xoài lắc',               type: 'potsSold', target: 2000, reward: { money: 15000 } },
  { id: 'q33', text: 'Đạt 4.5★ với ít nhất 60 đánh giá', type: 'rating', target: 4.5, minReviews: 60, reward: { money: 20000 } },
  { id: 'q34', text: 'Mở Chuỗi Xoài Lắc Nhà Mình',           type: 'tier', target: 5,       reward: { money: 50000 }, mom: 'tier5' },
  { id: 'q35', text: 'Mở chi nhánh đầu tiên',           type: 'branches', target: 1,   reward: { money: 30000 } },
  { id: 'q36', text: 'Mở 3 chi nhánh',                  type: 'branches', target: 3,   reward: { money: 100000 } },
  { id: 'q37', text: 'Phủ sóng cả 5 thành phố',         type: 'branches', target: 5,   reward: { money: 300000 }, mom: 'ending' },
  // v2.2 — appended after q37 so old saves keep their place
  { id: 'q38', text: 'Đạt Lv 25',                         type: 'level', target: 25,     reward: { money: 150000 } },
  { id: 'q39', text: 'Nâng 3 món lên công thức cấp 6',    type: 'recipesAt6', target: 3, reward: { money: 200000 } },
  { id: 'q40', text: 'Bán 10.000 phần xoài lắc',          type: 'potsSold', target: 10000, reward: { money: 250000 } },
  { id: 'q41', text: 'Đạt Lv 30',                         type: 'level', target: 30,     reward: { money: 400000 } },
  { id: 'q42', text: 'Đạt 4.8★ với ít nhất 100 đánh giá', type: 'rating', target: 4.8, minReviews: 100, reward: { money: 500000 } },
  { id: 'q43', text: 'Mở chi nhánh Phú Quốc',             type: 'branches', target: 6,   reward: { money: 800000 } },
  { id: 'q44', text: 'Lãi một ngày từ 50 triệu',          type: 'dayProfit', target: 50000, reward: { money: 1000000 } },
  { id: 'q45', text: 'Đạt Lv 35',                         type: 'level', target: 35,     reward: { money: 1500000 } },
  { id: 'q46', text: 'Gặp đủ mọi kiểu khách',             type: 'kindsMet', target: 11,  reward: { money: 2000000 } },
  { id: 'q47', text: 'Trở thành Huyền thoại Xoài Lắc (Lv 40)', type: 'level', target: 40, reward: { money: 5000000 } },
];

// Daily tasks: 3 picked per game day from the pool (only those whose `minLv` ≤ level).
// target(t) receives tier; reward is a chest tier.
export const DAILY_POOL = [
  { id: 'd_served',  text: 'Phục vụ {n} lượt khách',               type: 'served',     target: (t) => [10, 18, 30, 45, 45][t - 1], chest: 'wood' },
  { id: 'd_5star',   text: 'Nhận {n} đánh giá 5★',          type: 'fiveStars',  target: (t) => [4, 7, 12, 18, 18][t - 1],  chest: 'silver' },
  { id: 'd_drinks',  text: 'Bán {n} ly nước',               type: 'drinksSold', target: (t) => [15, 30, 50, 80, 80][t - 1], chest: 'wood' },
  { id: 'd_thai',    text: 'Bán {n} phần Ổi lắc xí muội',   type: 'potsSoldOf:oilac', target: (t) => [3, 6, 10, 14, 14][t - 1], chest: 'wood', minLv: 3 },
  { id: 'd_bo',      text: 'Bán {n} phần Xoài lắc mắm ruốc', type: 'potsSoldOf:xoaicat',   target: (t) => [3, 6, 10, 14, 14][t - 1], chest: 'wood', minLv: 5 },
  { id: 'd_noangry', text: 'Không để khách nào bỏ về trước 18:00', type: 'noAngryUntil', target: () => 18 * 60, chest: 'silver' },
  { id: 'd_combo',   text: 'Đạt combo x{n}',                type: 'combo',      target: (t) => [4, 6, 8, 10, 10][t - 1], chest: 'silver', minLv: 3 },
  { id: 'd_extras',  text: 'Phục vụ {n} lần gọi thêm',      type: 'extrasServed', target: (t) => [3, 6, 10, 15, 15][t - 1], chest: 'wood', minLv: 3 },
  { id: 'd_sides',   text: 'Bán {n} món ăn kèm',             type: 'sidesSold', target: (t) => [3, 6, 10, 15, 20][t - 1], chest: 'silver', minLv: 5 },
  { id: 'd_revenue', text: 'Doanh thu trong ngày đạt {n}',  type: 'dayRevenue', target: (t) => [1500, 4000, 9000, 18000, 18000][t - 1], chest: 'gold' },
  { id: 'd_thank',   text: 'Cảm ơn {n} đánh giá',           type: 'thank',      target: () => 3, chest: 'wood' },
  // v2
  { id: 'd_seated',  text: 'Có {n} nhóm khách ngồi bàn ăn',  type: 'seated',     target: (t) => [4, 7, 10, 14, 14][t - 1], chest: 'wood', minLv: 2 },
  { id: 'd_tips',    text: 'Nhận {n} tiền tip',              type: 'tips',       target: (t) => [60, 150, 400, 800, 800][t - 1], chest: 'silver', minLv: 2 },
  { id: 'd_profit',  text: 'Lãi trong ngày đạt {n}',          type: 'dayProfit',  target: (t) => [600, 1800, 4500, 9000, 9000][t - 1], chest: 'gold', minLv: 3 },
  { id: 'd_xoailac', text: 'Bán {n} phần Xoài lắc muối tôm',  type: 'potsSoldOf:xoailac', target: (t) => [5, 8, 12, 16, 16][t - 1], chest: 'wood' },
  { id: 'd_coclac',  text: 'Bán {n} phần Cóc lắc',            type: 'potsSoldOf:coclac',  target: (t) => [4, 7, 10, 14, 14][t - 1], chest: 'wood' },
  { id: 'd_fullpack', text: 'Cả ngày không thiếu ly, hộp, túi, khăn', type: 'noSupplyMiss', target: () => 1, chest: 'silver', minLv: 2 },
  { id: 'd_noprice', text: 'Phục vụ {n} khách mà không ai chê đắt', type: 'servedNoPrice', target: (t) => [8, 14, 22, 30, 30][t - 1], chest: 'silver', minLv: 3 },
];
export const CHESTS = {
  wood:   { name: 'Rương gỗ',  money: [80, 150],  xp: 20, decoChance: 0 },
  silver: { name: 'Rương bạc', money: [150, 300], xp: 40, decoChance: 0.05, ingredientPack: 5 },
  gold:   { name: 'Rương vàng', money: [300, 600], xp: 80, decoChance: 0.15, ingredientPack: 10 },
}; // money × TIER_MULT[tier-1]
export const DAILY_ALL_BONUS = 'gold';
// v2.6.11: quests pay XP as a share of the EXP bar of the current level (so they still matter at Lv 30+);
// the fixed `xp` of a reward / chest is the minimum. main = mục tiêu chính, v2 = Sổ tay quán mới.
export const QUEST_XP = { main: 0.03, v2: 0.015, wood: 0.005, silver: 0.01, gold: 0.02 };   // v2.6.18 (v2.6.14: 0.0375 / 0.02 / 0.01 / 0.0175 / 0.03)
// v2.6.14: the two containers a portion can go in; the player can switch on the tray (both carry the shop's logo)
export const CONTAINER_IDS = ['ly_lac', 'hop_giay'];

// 7-day real-date login streak (money × TIER_MULT)
export const LOGIN_REWARDS = [
  { day: 1, money: 200,  text: '200k' },
  { day: 2, ingredients: 8, text: 'Giỏ trái cây' },
  { day: 3, money: 500,  text: '500k' },
  { day: 4, deco: 'cay_mai', text: 'Cây mai ngày Tết' },
  { day: 5, staffTicket: 3, text: 'Vé tuyển dụng ★3+' },
  { day: 6, money: 1500, text: '1,5 triệu' },
  { day: 7, money: 5500, text: 'Lì xì 5,5 triệu' },
];

// ───────────────────────────── TEXT: REVIEWS ─────────────────────────────
// {mon} = dish name, {quan} = shop name. Tags chosen by the sim from what drove the score.
export const REVIEW_TEXT = {
  5: ['Xoài giòn rụm, muối tôm thơm lừng, đỉnh nóc kịch trần!', '{mon} ở đây ngon xỉu 🔥', 'Lắc nhanh xỉu, chị chủ dễ thương.',
      'Mai tan học ghé nữa nha!', 'Giá học trò mà chất lượng nhà hàng.', '10 điểm không có nhưng!', 'Ăn xong muốn ăn thêm ly nữa 😋',
      '{quan} là chân ái của tui.', 'Chua chua cay cay mặn mặn ngọt ngọt, đã!', 'Xe nhỏ mà có tâm ghê.'],
  4: ['Ngon nha, chờ hơi lâu xíu thôi.', '{mon} vừa miệng, lần sau thử món khác.', 'Ổn áp, giá hợp lý.', 'Muối tôm ngon, mà xoài hơi ít.',
      'Ngồi chill, ăn ngon, sẽ ghé lại.', 'Chị lắc đều tay, món ổn.'],
  3: ['Cũng được, không có gì đặc biệt.', 'Chờ hơi lâu, thèm muốn xỉu.', 'Giá hơi chát so với xe đẩy.', 'Ăn tạm ổn, quán hơi nóng.',
      'Muối hơi nhạt, chưa đủ cay.'],
  2: ['Chờ lâu quá trời 😤', 'Gọi {mon} mà hết hàng, đổi món buồn ghê.', 'Ngồi dưới mưa ăn xoài… ướt nhẹp.', 'Nóng như cái lò, ngồi không nổi.',
      'Giá cao mà món bình thường.'],
  1: ['Đợi nửa tiếng không ai ra, về luôn!', 'Hết chỗ ngồi, đứng chờ mỏi chân rồi về.', 'Không bao giờ quay lại.', 'Bỏ về, thèm còn bực.'],
  tags: {
    fast:      ['Lắc nhanh như chớp ⚡', 'Vừa ngồi xuống đã có xoài!'],
    slow:      ['Chờ hơi lâu nha quán ơi.', 'Đông khách nên chờ lâu, thông cảm.'],
    quality:   ['Xoài giòn, muối tôm thơm, chuẩn vị.', 'Trái cây tươi rói thấy rõ.'],
    ambience:  ['Quán decor xinh xỉu, chụp hình mỏi tay 📸', 'Đèn đóm lung linh, hẹn hò hợp lắm.'],
    cheap:     ['Giá quá hời luôn!', 'Ăn đã miệng mà ví vẫn khoẻ.'],
    pricey:    ['Hơi mắc so với túi tiền tụi mình.', 'Ngon mà giá này thì để bữa khác vậy.', 'Nhìn bảng giá xong đi luôn 😅', 'Xe đẩy mà giá như nhà hàng.'],
    rain:      ['Trời mưa mà có ly xoài lắc cay cay là chân ái 🥲', 'Mưa rả rích, ngồi tám với bạn, vui ghê!'],
    cold:      ['Trời se lạnh mà ăn cay cay, ấm cả người.'],
    hot:       ['Trời nóng hầm hập, ăn ly xoài cay mà mồ hôi như tắm.'],
    substitute:['Hết món mình thích, đổi món khác cũng ổn.'],
    staff:     ['Bạn nhân viên dễ thương, nói chuyện có duyên.'],
    extra:     ['Gọi thêm topping nào ra liền topping đó, thích!'],
    tourist:   ['So good! Ngon quá! 🇻🇳', 'Best street snack in Saigon, for real.'],
    regular:   ['Ngày nào chú cũng ghé, vẫn ngon như mọi khi.'],
  },
};
export const REVIEW_NAMES = ['Thư Nguyễn', 'Minh Khang', 'Bảo Anh', 'Tuấn Kiệt', 'Ngọc Hân', 'Gia Huy', 'Khánh Linh', 'Đức Anh',
  'Phương Vy', 'Hoàng Long', 'Thảo My', 'Quốc Bảo', 'Mai Anh', 'Trung Hiếu', 'Lan Chi', 'Nhật Minh', 'Hà Vy', 'Tấn Phát',
  'Kim Ngân', 'Văn Toàn', 'Thanh Trúc', 'Hữu Nghĩa', 'Yến Nhi', 'Công Danh', 'Bích Ngọc', 'Thành Đạt', 'Diệu Linh', 'Anh Thư'];
export const REVIEW_NAMES_SPECIAL = {
  khachtay: ['John', 'Emma', 'Lukas', 'Sofia', 'Kenji', 'Mia', 'Noah', 'Chloé'],
  reviewer: ['Kênh Ăn Gì Đây', 'Reviewer Bụng Bự', 'Hội Săn Quán Ngon'],
  tiktoker: ['@chillcungxoai', '@anvatsaigon', '@bonbonreview'],
  chutu: ['Chú Tư bảo vệ'],
  doandulich: ['Đoàn du lịch Hạnh Phúc', 'Tour ăn vặt Sài Gòn'],
};

// ───────────────────────────── TEXT: MÁ NHẮN ─────────────────────────────
export const MOM = {
  start:      'Mở hàng nhớ cười tươi nha con. Muối tôm Má rang sẵn rồi, lắc đều tay là bán đắt! 🧧',
  firstSale:  'Ly xoài lắc đầu tiên! Má nghe tụi nhỏ khen rồi đó nghen 😆',
  firstFive:  '5 sao lận hả? Con của Má giỏi quá trời!',
  firstAngry: 'Khách bỏ về cũng đừng buồn. Mai mình lắc nhanh hơn chút là được.',
  firstStaff: 'Có người phụ rồi thì nhớ trả lương đàng hoàng, đối xử tử tế nha con.',
  rain:       'Trời mưa rồi! Nhớ kéo bạt kẻo khách với rổ xoài ướt hết nha con.',
  cold:       'Trời se lạnh, tụi nhỏ thèm đồ chua cay lắm đó. Nhập thêm trái cây đi con.',
  lowStock:   'Rổ trái cây sắp hết rồi đó con. Mở Kho nhập thêm liền kẻo khách tới không có mà bán nha.',
  tier2:      'Gánh con dời vô gốc me công viên rồi! Ba con đi khoe khắp xóm 🥹',
  tier3:      'Cả dãy xe đẩy ven hồ! Má không dám tin luôn. Nhớ giữ sức khoẻ nha.',
  tier4:      'Hai tầng lận… Con giỏi hơn Má tưởng nhiều.',
  tier5:      'Giờ con có cả chuỗi xoài lắc rồi. Nhưng cuối tuần nhớ về ăn cơm với ba má nghen.',
  lateNight:  'Khuya rồi, dọn hàng nghỉ sớm đi con.',
  reviewerGood: 'Má thấy cái clip quay xe xoài của con trên mạng rồi! Đông khách lắm nha!',
  reviewerBad:  'Một lời chê thôi mà, mình sửa là được. Má tin con.',
  ending:     'Vua Xoài Lắc Việt Nam hả? Với Má, con vẫn là đứa nhỏ hay ăn vụng muối tôm của Má. Má thương con! ❤️',
};

// Teaser for the next games in the series (shown at the ending + settings)
export const NEXT_GAMES = ['Lẩu Ơi!', 'Bánh tráng trộn', 'Phở Việt Nam'];

// ═════════════════════════════ v2 SYSTEMS (2026-10) ═════════════════════════════

// ───────────────────────────── SELLING PRICE (player-set, per dish) ─────────────────────────────
// state.prices[dishId] = price in k the player chose; missing = the reference price (potPrice: base × recipe level × mastery).
// Bounds are fixed multiples of the dish's BASE price so a stored price never has to change when the recipe levels up.
export const PRICING = {
  minMult: 0.5, maxMult: 2.0,             // allowed price = base × [0.5 … 2.0], whole k, never below 1
  // 1) which dish a group picks: weight × (price / reference)^-choiceExp
  choiceExp: 2, choiceMin: 0.3, choiceMax: 2.5,
  // 2) buy or walk away: refuse = sigmoid(k × (overW·(over − overC) + budW·(price/budget − budC) − value))
  //    over = price / reference; value = rating & recipe bonus. At the reference price ≈ 3–5 % refuse; +30 % ≈ 50 %.
  k: 1.6, overW: 3.5, overC: 1.3, budW: 2, budC: 1.35,
  valueRating: 0.5,                       // per ★ above 4.0
  valueRecipe: 0.15,                      // per recipe level above 1
  // 3) word of mouth: whole-menu price index → arrivals × index^-demandExp (clamped)
  demandExp: 0.8, demandMin: 0.7, demandMax: 1.3,
  // 4) value for money in the satisfaction score: × (1 − over), clamped
  valueW: 1.2, valueMin: -0.5, valueMax: 0.35,
  priceyReviewChance: 0.15,               // a refusing customer sometimes leaves a 3★ "đắt quá" note
};

// ───────────────────────────── SUPPLIES (vật tư tiêu hao) ─────────────────────────────
// need: 'container' = required, one per portion (no container → the dish cannot be ordered);
//       'drink' = required per drink (none left → drinks are not offered);
//       'optional' = served without it, small satisfaction penalty (one toast per day).
// per: 'portion' | 'group' (one per group that takes the food away / sits) — see SUPPLY_USE.
export const SUPPLIES = [
  { id: 'ly_lac',   name: 'Ly lắc có nắp',    short: 'Ly lắc',  icon: 'sup_lylac', cost: 1.2, need: 'container', desc: 'Ly nhựa có nắp để lắc xoài, cóc, ổi, mận.' },
  { id: 'hop_giay', name: 'Hộp giấy',          short: 'Hộp',     icon: 'sup_hop',   cost: 2,   need: 'container', desc: 'Hộp giấy cho xoài cát, thơm lắc và phần thập cẩm to bự.' },
  { id: 'ly_nuoc',  name: 'Ly nhựa đựng nước', short: 'Ly nước', icon: 'sup_lynuoc', cost: 0.5, need: 'drink',    desc: 'Mỗi ly nước cần một ly nhựa. Hết ly là không bán được nước.' },
  { id: 'xien',     name: 'Que xiên tre',      short: 'Xiên',    icon: 'sup_xien',  cost: 0.1, need: 'optional', desc: 'Một que cho mỗi ly lắc. Thiếu thì khách phải bốc tay, hơi phiền.' },
  { id: 'dua',      name: 'Đũa tre',           short: 'Đũa',     icon: 'sup_dua',   cost: 0.3, need: 'optional', desc: 'Một đôi cho mỗi hộp giấy.' },
  { id: 'tui',      name: 'Túi quai xách',     short: 'Túi',     icon: 'sup_tui',   cost: 0.3, need: 'optional', desc: 'Một túi cho mỗi nhóm mua mang đi (khách ngồi bàn thì không cần).' },
  { id: 'khan',     name: 'Khăn giấy',         short: 'Khăn',    icon: 'sup_khan',  cost: 0.2, need: 'optional', desc: 'Một xấp cho mỗi nhóm khách. Ăn xoài lắc mà không có khăn là dính tay.' },
];
export const SUPPLY_PACKS = [{ n: 50, off: 0 }, { n: 100, off: 0.05 }, { n: 200, off: 0.1 }];   // bulk discount
// which container each dish is packed in (+ the matching optional utensil)
export const DISH_PACK = {
  xoailac: { box: 'ly_lac', tool: 'xien' }, coclac: { box: 'ly_lac', tool: 'xien' }, oilac: { box: 'ly_lac', tool: 'xien' },
  manlac: { box: 'ly_lac', tool: 'xien' }, xoaicat: { box: 'hop_giay', tool: 'dua' }, thomlac: { box: 'hop_giay', tool: 'dua' },
  thapcam: { box: 'hop_giay', tool: 'dua' },
};
export const SUPPLY_MISS_SAT = 0.15;      // per missing optional item, on that group's score

// ───────────────────────────── SUPPLIERS (nhà cung cấp) ─────────────────────────────
// delay: game minutes after ordering (time runs only while the shop is open; an order placed in the evening arrives
// next morning), or 'morning' = start of the next day. quality is added to the dish quality of portions made with
// those items (lots remember it). sells: 'all' | 'fresh' (fruit, chilli, herbs = shelf 2 days).
// v2.6.3: an order placed before or during selling arrives within DELIVERY_MAX game minutes (openDelay per supplier);
// only orders placed after closing wait for the next morning.
export const DELIVERY_MAX = 10;
export const SUPPLIERS = [
  { id: 'cho',  name: 'Chợ đầu hẻm — Cô Ba', icon: 'ui_shop',  priceMult: 1,    fee: 0,  delay: 0,         quality: 0,     sells: 'all',   unlockLv: 1, prepOnly: true,
    desc: 'Giá chợ, tự xách về liền. Chỉ đi chợ được lúc chưa mở hàng.' },
  { id: 'app',  name: 'Đi chợ hộ qua app',   icon: 'ui_phone', priceMult: 1.12, fee: 15, delay: 40, openDelay: 5, quality: 0,     sells: 'all',   unlockLv: 1,
    desc: 'Đặt lúc nào cũng được, shipper giao trong 5 phút. Đắt hơn 12% và tốn 15k phí ship mỗi đơn.' },
  { id: 'vua',  name: 'Vựa sỉ Bình Điền',    icon: 'eq_truck', priceMult: 0.8,  fee: 0,  delay: 'morning', openDelay: 10, quality: -0.06, sells: 'all',   unlockLv: 3, minOrder: 200,
    desc: 'Rẻ hơn 20%, xe vựa giao trong 10 phút (đặt sau khi đóng cửa thì sáng mai), đơn tối thiểu 200k. Trái hơi dập nên phần lắc kém ngon một chút.' },
  { id: 'htx',  name: 'Hợp tác xã Tiền Giang', icon: 'eq_truck', priceMult: 0.9,  fee: 0,  delay: 60, openDelay: 8, quality: 0.05,  sells: 'all',   unlockLv: 30,
    desc: 'Mối ruột của quán lớn: rẻ hơn chợ 10%, giao trong 8 phút, hàng ngon hơn một chút.' },
  { id: 'vuon', name: 'Nhà vườn Cái Bè',     icon: 'fr_xoai',  priceMult: 1.3,  fee: 0,  delay: 120, openDelay: 10, quality: 0.12,  sells: 'fresh', unlockLv: 5, shelfBonus: 1,
    desc: 'Trái cây, ớt, rau răm hái trong ngày: phần lắc ngon hơn hẳn và để lâu thêm 1 ngày. Giá cao hơn 30%, giao trong 10 phút.' },
];

// ───────────────────────────── SIDE TABLES (bàn ghế hai bên quán) ─────────────────────────────
// Served groups that are done ordering extras walk to a free side table to finish eating; the counter spot frees up.
export const SIDE = { base: 2, eatMult: 1.6, satBonus: 0.2, ambienceBonus: 0.1 };

// ───────────────────────────── WAGES & STAFF MOOD ─────────────────────────────
// Salaries are paid per person at closing. What the till cannot cover becomes debt (m.owed); nothing is conjured up.
// mood 0..100: ≥75 Hài lòng · ≥50 Bình thường · ≥25 Không hài lòng · <25 Có nguy cơ nghỉ việc.
export const MOOD = {
  start: 70, base: 58, ambienceBase: 20,  // nightly drift target = base + ambience × ambienceBase (+ chair upgrades)
  drift: 0.25,                            // share of the gap closed each night when paid in full
  paidBonus: 3, owedHit: 14, owedPerDay: 7,
  levels: [[75, 'Hài lòng', 'good'], [50, 'Bình thường', 'ok'], [25, 'Không hài lòng', 'bad'], [-1, 'Có nguy cơ nghỉ việc', 'risk']],
  speed: { good: 1.05, ok: 1, bad: 0.88, risk: 0.75 },
  warnBelow: 25, quitAfterDays: 2,        // under 25 → announces leaving; still under 25 two closings later → leaves
  owedQuitDays: 4,                        // 4 unpaid closings in a row → announces leaving even if the mood is higher
  talk: { chance: 0.65, owedPenalty: 0.18, lowMoodPenalty: 0.15, gain: 12, fail: -4 },   // free, once per person per day
  bonus: { mult: 0.5, chance: 0.9, owedPenalty: 0.22, gain: 20, failGain: 6 },        // costs 50 % of a day's salary
  payBackGain: 8,                         // per full day of debt paid back
};

// ───────────────────────────── V2 QUEST BOOK ("Sổ tay quán mới") ─────────────────────────────
// A second, separate chain that walks the player through the new systems. Runs alongside MAIN_QUESTS (whose
// indexes are untouched, so old saves keep their place). minLv: shown locked below that level (progress still counts).
// type: a quests counter name, or one of the stat types handled in quests.js (seatedTotal, sideTables, dayProfit…).
export const V2_QUESTS = [
  { id: 'v1',  text: 'Mua thêm 50 ly lắc ở Kho',                     type: 'supplyBought:ly_lac', target: 50, reward: { money: 60, xp: 20 } },
  { id: 'v2',  text: 'Có 5 nhóm khách ngồi bàn hai bên quán',        type: 'seatedTotal', target: 5,   reward: { money: 80, xp: 30 } },
  { id: 'v3',  text: 'Tự đặt giá bán một món (Nâng cấp ▸ Giá bán)',       type: 'setPrice', target: 1,      reward: { money: 80, xp: 30 }, minLv: 2 },
  { id: 'v4',  text: 'Đặt hàng qua app lúc đang bán',                type: 'order:app', target: 1,     reward: { money: 100, xp: 40 }, minLv: 2 },
  { id: 'v5',  text: 'Nói chuyện với nhân viên 3 lần',               type: 'talkStaff', target: 3,     reward: { money: 120, xp: 40 }, minLv: 2 },
  { id: 'v6',  text: 'Kê thêm một bộ bàn ghế hai bên quán',          type: 'upgrade:sidetable', target: 1, reward: { money: 200, xp: 60 }, minLv: 3 },
  { id: 'v7',  text: 'Nhập hàng từ Vựa sỉ Bình Điền',                type: 'order:vua', target: 1,     reward: { money: 200, xp: 60 }, minLv: 3 },
  { id: 'v8',  text: 'Bán 20 phần với giá cao hơn giá gợi ý',         type: 'priceySold', target: 20,   reward: { money: 300, xp: 80 }, minLv: 3 },
  { id: 'v9',  text: 'Thưởng nóng cho nhân viên một lần',            type: 'bonusStaff', target: 1,    reward: { money: 250, xp: 80 }, minLv: 4 },
  { id: 'v10', text: 'Nhập trái cây Nhà vườn Cái Bè',                type: 'order:vuon', target: 1,    reward: { money: 400, xp: 100 }, minLv: 5 },
  { id: 'v11', text: 'Có 100 nhóm khách ngồi bàn hai bên quán',      type: 'seatedTotal', target: 100, reward: { money: 800, xp: 150 }, minLv: 5 },
  { id: 'v12', text: 'Không nợ lương 7 ngày liền (có ít nhất 1 nhân viên)', type: 'noDebtStreak', target: 7, reward: { money: 1000, xp: 200 }, minLv: 5 },
  { id: 'v13', text: 'Kê đủ 4 bộ bàn ghế hai bên quán',              type: 'sideTables', target: 4,    reward: { money: 1500, xp: 250 }, minLv: 6 },
  { id: 'v14', text: 'Lãi một ngày từ 3 triệu',                      type: 'dayProfit', target: 3000,  reward: { money: 2000, xp: 300 }, minLv: 8 },
  { id: 'v15', text: 'Bán 500 phần trong ly/hộp của quán',           type: 'packsUsed', target: 500,   reward: { money: 3000, xp: 400 }, minLv: 10 },
  { id: 'v16', text: 'Mở Giờ vàng 14h–17h một lần',                  type: 'marketing:giovang', target: 1, reward: { money: 3000, xp: 400 }, minLv: 8 },
  { id: 'v17', text: 'Mở Combo kèm nước một lần',                    type: 'marketing:combonuoc', target: 1, reward: { money: 4000, xp: 500 }, minLv: 12 },
  { id: 'v18', text: 'Bán 300 ly nước',                              type: 'drinksSoldTotal', target: 300, reward: { money: 5000, xp: 600 }, minLv: 12 },
  // v2.5 món ăn kèm
  { id: 'v19', text: 'Bán 5 món ăn kèm (nhập ở Kho ▸ Món ăn kèm)',     type: 'sidesSoldTotal', target: 5,   reward: { money: 300, xp: 80 }, minLv: 4 },
  { id: 'v20', text: 'Bán 200 món ăn kèm',                             type: 'sidesSoldTotal', target: 200, reward: { money: 4000, xp: 500 }, minLv: 10 },
];

// ───────────────────────────── LEVEL PERKS (v2.2: one new thing on every level 13–40, then mastery) ─────────────────────────────
// Each perk is permanent once the level is reached. fx keys are read by the core (economy.perkFx):
//   quality (+dish quality) · patience (× customer patience) · tip (× tips) · prepSpeed (× thợ lắc speed) · staffSpeed (× all staff)
//   queue (+queue places) · priceValue (+willingness to pay) · moodBase (+staff mood target) · ambience (+0..1 ambience)
//   kindDemand {kind: ×} · recipeMax (+recipe levels) · branchMax (+branch levels) · shelf (+days for new stock)
//   buyPrice (× ingredient/supply prices) · satBonus (+score) · boxCost (× cup/box cost) · comboDrink (+drink chance with Combo kèm nước)
//   goldenFrom (Giờ vàng starts at this hour) · eventChance (× daily event chance) · staffXp (× staff job progress)
export const PERKS = [
  { lv: 13, id: 'f_flower_cuc', name: 'Chậu cúc vàng', icon: 'ui_deco', facade: { cat: 'flower', id: 'cuc' }, desc: 'Trang trí mới: chậu cúc trên quầy (Quán → Trang trí).' },
  { lv: 14, id: 'p_muoitn',    name: 'Muối tôm Tây Ninh chính gốc', icon: 'ing_muoitom', fx: { quality: 0.05 }, desc: 'Mọi phần lắc ngon hơn.' },
  { lv: 15, id: 'p_hoitro',    name: 'Ngày hội học trò', icon: 'ui_megaphone', marketing: 'hoitro', desc: 'Khuyến mãi mới: học trò tới gấp đôi trong ngày.' },
  { lv: 17, id: 'p_kho6',      name: 'Kho lạnh siêu lớn', icon: 'ui_kho', upgrade: 'kho', desc: 'Nâng cấp Kho lên cấp 6: chứa gấp 7 lần.' },
  { lv: 19, id: 'p_xeday2',    name: 'Xe đẩy thứ hai', icon: 'eq_table', fx: { queue: 2 }, desc: 'Hàng chờ dài thêm 2 chỗ, ít khách bỏ đi hơn.' },
  { lv: 20, id: 'f_flower_giay', name: 'Hoa giấy hồng', icon: 'ui_deco', facade: { cat: 'flower', id: 'giay' }, desc: 'Trang trí mới: chậu hoa giấy trên quầy.' },
  { lv: 21, id: 'p_dongphuc',  name: 'Đồng phục quán', icon: 'ui_staff', fx: { moodBase: 8 }, desc: 'Tự chọn màu và kiểu đồng phục (Nhân viên → Đội); nhân viên vui hơn, khó buồn hơn.' },
  { lv: 23, id: 'p_congthuc6', name: 'Công thức cấp 6', icon: 'ui_book', fx: { recipeMax: 1 }, desc: 'Mọi món nâng thêm được 1 cấp công thức.' },
  { lv: 24, id: 'p_lylogo',    name: 'Ly in logo quán', icon: 'sup_lylac', fx: { satBonus: 0.1, boxCost: 1.25 }, desc: 'Tự thiết kế tem logo in lên ly (Quán → Trang trí). Khách thích hơn (+0,1 điểm), ly hộp đắt hơn 25%.' },
  { lv: 25, id: 'p_chinhanh6', name: 'Chi nhánh cấp 6', icon: 'ui_map', fx: { branchMax: 1 }, desc: 'Chi nhánh nâng thêm được 1 cấp.' },
  { lv: 26, id: 'f_sign_hong', name: 'Bảng hiệu hồng pastel', icon: 'ui_deco', facade: { cat: 'sign', id: 'hong' }, desc: 'Trang trí mới: bảng hiệu nền hồng.' },
  { lv: 27, id: 'p_quanlyca',  name: 'Quản lý ca', icon: 'role_thungan', fx: { staffSpeed: 1.1 }, desc: 'Cả đội làm nhanh hơn 10%.' },
  { lv: 28, id: 'p_tutrungbay', name: 'Tủ trưng bày giữ lạnh', icon: 'eq_fridge', fx: { shelf: 1 }, desc: 'Hàng nhập mới để lâu thêm 1 ngày.' },
  { lv: 29, id: 'p_moiruot',   name: 'Mối ruột ngoài chợ', icon: 'ui_coin', fx: { buyPrice: 0.95 }, desc: 'Giá nhập trái cây, topping, ly hộp rẻ hơn 5%.' },
  { lv: 30, id: 'p_htx',       name: 'Hợp tác xã Tiền Giang', icon: 'eq_truck', supplier: 'htx', desc: 'Nhà cung cấp mới: rẻ, nhanh, hàng ngon.' },
  { lv: 31, id: 'p_vuasg',     name: 'Danh hiệu "Vua xoài lắc Sài Gòn"', icon: 'ui_trophy', fx: { ambience: 0.1 }, facade: { cat: 'sign', id: 'neon' }, desc: 'Bảng hiệu đèn neon hồng, quán sang hơn (+10%).' },
  { lv: 32, id: 'p_bepphu',    name: 'Quầy sơ chế phụ', icon: 'eq_knife', fx: { prepSpeed: 1.15 }, desc: 'Thợ lắc soạn phần nhanh hơn 15%.' },
  { lv: 33, id: 'f_bunting_cauvong', name: 'Cờ cầu vồng', icon: 'ui_deco', facade: { cat: 'bunting', id: 'cauvong' }, desc: 'Trang trí mới: dây cờ 6 màu trước quán.' },
  { lv: 34, id: 'p_phuquoc',   name: 'Chi nhánh Phú Quốc', icon: 'ui_map', branch: 'phuquoc', desc: 'Chi nhánh thứ 6 (thêm, không bắt buộc để về đích).' },
  { lv: 35, id: 'p_dulich',    name: 'Tour ăn vặt Sài Gòn', icon: 'ui_megaphone', fx: { kindDemand: { doandulich: 2, khachtay: 1.3 } }, desc: 'Đoàn du lịch ghé gấp đôi, khách Tây +30%.' },
  { lv: 36, id: 'f_flower_xuongrong', name: 'Xương rồng ra hoa', icon: 'ui_deco', facade: { cat: 'flower', id: 'xuongrong' }, desc: 'Trang trí mới: chậu xương rồng nở hoa hồng.' },
  { lv: 37, id: 'p_giovang2',  name: 'Giờ vàng 13h–17h', icon: 'ui_clock', fx: { goldenFrom: 13 }, desc: 'Giờ vàng bắt đầu sớm hơn 1 tiếng.' },
  { lv: 38, id: 'f_bunting_longmini', name: 'Dây đèn lồng mini', icon: 'ui_deco', facade: { cat: 'bunting', id: 'longmini' }, desc: 'Trang trí mới: dây đèn lồng nhỏ, sáng lung linh buổi tối.' },
  { lv: 39, id: 'p_baclac',    name: 'Thợ lắc bậc thầy', icon: 'role_daubep', fx: { staffXp: 1.5 }, desc: 'Nhân viên lên cấp nhanh hơn 50%.' },
  { lv: 40, id: 'p_huyenthoai', name: 'Huyền thoại Xoài Lắc', icon: 'ui_trophy', fx: { quality: 0.05, tip: 1.05 }, desc: 'Món ngon hơn, tip +5%, mở Cấp thành thạo (từ Lv 41 mỗi cấp một rương vàng).' },
  // v2.4 extra decorations on levels that already open something else
  { lv: 9, id: 'f_bunting_tet', name: 'Cờ đỏ vàng', icon: 'ui_deco', facade: { cat: 'bunting', id: 'tet' }, desc: 'Trang trí mới: dây cờ đỏ vàng trước quán (Quán → Trang trí).' },
  { lv: 16, id: 'f_sign_vang', name: 'Bảng hiệu vàng viền đỏ', icon: 'ui_deco', facade: { cat: 'sign', id: 'vang' }, desc: 'Trang trí mới: bảng hiệu vàng chữ đỏ.' },
  { lv: 18, id: 'f_bunting_xoai', name: 'Cờ xanh xoài', icon: 'ui_deco', facade: { cat: 'bunting', id: 'xoai' }, desc: 'Trang trí mới: dây cờ xanh vàng.' },
  { lv: 22, id: 'f_sign_nau', name: 'Bảng hiệu gỗ nâu', icon: 'ui_deco', facade: { cat: 'sign', id: 'nau' }, desc: 'Trang trí mới: bảng gỗ nâu chữ trắng.' },
  { lv: 24, id: 'f_balloon_tim', name: 'Bóng bay trái tim', icon: 'ui_deco', facade: { cat: 'balloon', id: 'tim' }, desc: 'Trang trí mới: chùm bóng tim cạnh bảng hiệu.' },
  { lv: 28, id: 'f_flower_sen', name: 'Chậu sen đá', icon: 'ui_deco', facade: { cat: 'flower', id: 'sen' }, desc: 'Trang trí mới: chậu sen đá trên quầy.' },
  { lv: 35, id: 'f_balloon_maucau', name: 'Chùm bóng 7 màu', icon: 'ui_deco', facade: { cat: 'balloon', id: 'maucau' }, desc: 'Trang trí mới: bóng bay 7 màu hai bên bảng hiệu.' },
  { lv: 40, id: 'f_flower_lan', name: 'Chậu lan tím', icon: 'ui_deco', facade: { cat: 'flower', id: 'lan' }, desc: 'Trang trí mới: chậu lan tím sang trọng.' },
];
export const MASTERY = { fromLv: 41, chest: 'gold', ticketEvery: 5 };   // each level ≥ 41: a gold chest; every 5th also a ★3+ hiring ticket
