// Icons (TECH_SPEC §2.1): 32×32 sprites (2× detail) = 16×16 world px, packed in assets/icons.png
// (frame table src/art/data/icons.js, keys = icon names). Never throws; unknown names draw a magenta 2×2 marker.
import { loadAtlas } from './assets.js';
import ICON_DATA from './data/icons.js';

const rec = loadAtlas(ICON_DATA.file);
const FR = ICON_DATA.frames;

export const ICONS = [
  'ing_bo', 'ing_heo', 'ing_ga', 'ing_tom', 'ing_muc', 'ing_ca', 'ing_rau', 'ing_nam', 'ing_dauphu', 'ing_mi',
  'pot_ga', 'pot_nam', 'pot_thai', 'pot_bo', 'pot_rieucua', 'pot_chuacay', 'pot_dacbiet',
  'drk_trada', 'drk_nuocngot', 'drk_tratac', 'drk_nuocsam', 'drk_nuocdua',
  'ui_coin', 'ui_star', 'ui_star_empty', 'ui_star_half', 'ui_heart', 'ui_kho', 'ui_menu', 'ui_upgrade', 'ui_staff', 'ui_review',
  'ui_deco', 'ui_quest', 'ui_book', 'ui_gear', 'ui_clock', 'ui_lock', 'ui_check', 'ui_cross', 'ui_up', 'ui_down', 'ui_gift',
  'ui_calendar', 'ui_speed', 'ui_pause', 'ui_play', 'ui_music', 'ui_sound', 'ui_mute', 'ui_fire', 'ui_table', 'ui_shop', 'ui_map',
  'ui_megaphone', 'ui_trophy', 'ui_xp', 'ui_ticket', 'ui_reserve', 'ui_chest_wood', 'ui_chest_silver', 'ui_chest_gold', 'ui_mom',
  'ui_phone', 'ui_fan_tap', 'ui_trash', 'ui_info', 'ui_close', 'ui_home',
  'wx_sun', 'wx_cloud', 'wx_rain', 'wx_cold', 'wx_hot', 'wx_storm',
  'emo_love', 'emo_yum', 'emo_angry', 'emo_sweat', 'emo_zzz', 'emo_music', 'emo_exclaim', 'emo_question', 'emo_money', 'emo_cold', 'emo_hot', 'emo_wait',
  'eq_stove', 'eq_pot', 'eq_fridge', 'eq_cooler', 'eq_tarp', 'eq_fan', 'eq_ac', 'eq_speaker', 'eq_sign', 'eq_knife', 'eq_table', 'eq_pos', 'eq_truck',
  'role_phucvu', 'role_daubep', 'role_thungan', 'role_quankho',
  'ui_plus',     // extra: green "+" button (not in the spec list)
  'ui_hand',     // extra: pointing-hand tutorial cursor
];

/** Draw icon `name` with its top-left at world (x, y): a 32 px sprite fills 16×16 world px (16×scale for other scales). */
export function drawIcon(ctx, name, x, y, scale = 1) {
  const s = 16 * (scale || 1);
  const f = FR[name];
  if (!f) {                                             // unknown id: magenta 2×2 marker
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(x + s / 2 - 1, y + s / 2 - 1, 2, 2);
    return;
  }
  if (!rec.img) return;                                 // atlas still loading
  if (ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rec.img, f[0], f[1], f[2], f[3], x, y, s, s);
}

const urlCache = new Map();
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Cached PNG data URL (16×scale px square) for DOM <img> (use CSS image-rendering: pixelated). */
export function iconURL(name, scale = 3) {
  try {
    const sc = Math.max(1, Math.round(scale) || 1);
    const key = name + '@' + sc;
    let url = urlCache.get(key);
    if (url) return url;
    if (typeof document === 'undefined') return BLANK;
    const f = FR[name];
    if (f && !rec.img) return BLANK;                    // not loaded yet: do not cache the blank
    const c = document.createElement('canvas');
    c.width = c.height = 16 * sc;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawIcon(g, name, 0, 0, sc);
    url = c.toDataURL();
    urlCache.set(key, url);
    return url;
  } catch (e) { return BLANK; }
}
