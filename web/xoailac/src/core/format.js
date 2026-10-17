// Shared Vietnamese formatting helpers. PURE (no DOM). Imported by core, render and UI.
// Money in the game is stored in k (1 = 1.000đ).

const dot = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// 1250 → "1.250.000đ" ; 99 → "99.000đ" ; 0.5 → "500đ"
export function fmtMoney(k) {
  const d = Math.round(k * 1000);
  return (d < 0 ? '-' : '') + dot(Math.abs(d)) + 'đ';
}

// Compact form for HUD/badges: 99 → "99k", 1250 → "1,25 tr", 3400000 → "3,4 tỷ"
export function fmtShort(k) {
  const a = Math.abs(k), s = k < 0 ? '-' : '';
  const trim = (x, digits) => { let t = x.toFixed(digits); if (t.includes('.')) t = t.replace(/\.?0+$/, ''); return t.replace('.', ','); };
  if (a < 1000) return s + Math.round(a) + 'k';
  if (a < 1e6) return s + trim(a / 1000, a < 10000 ? 2 : a < 100000 ? 1 : 0) + ' tr';
  return s + trim(a / 1e6, a < 1e7 ? 2 : 1) + ' tỷ';
}

// Floating "+128k" style
export function fmtDelta(k) { return (k >= 0 ? '+' : '') + fmtShort(k); }

// game minutes → "19:40"
export function fmtClock(min) {
  const m = Math.floor(min) % (24 * 60);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

// day number → weekday short label (day 1 = T2)
export function weekday(day) { return ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][(day - 1) % 7]; }
export function isWeekend(day) { const w = (day - 1) % 7; return w === 5 || w === 6; }

// 4.56 → "4,6"
export function fmtRating(r) { return r.toFixed(1).replace('.', ','); }

// seconds → "3 giờ 12 phút" / "45 phút" / "30 giây"
export function fmtDuration(sec) {
  if (sec < 60) return Math.round(sec) + ' giây';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h} giờ${m ? ' ' + m + ' phút' : ''}` : `${m} phút`;
}

// Replace {n}, {mon}, {quan}… in template strings
export function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)); }
