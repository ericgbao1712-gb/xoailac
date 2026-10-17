// v2.6.21 chọn bài nhạc nền: "Tự đổi bài" or one unlocked song (locked ones show the Loa nhạc level they need).
// Used in Cài đặt and on the Loa nhạc upgrade card.
import { h, div, span, ico } from './dom.js';
import { ctx, act, S, sfx } from './ctx.js';
import * as C from '../config.js';
import { pickVariant, SONG_NAMES } from '../audio/index.js?v=a21';

export function songPicker({ compact = false } = {}) {
  const wrap = div('song-pick' + (compact ? ' compact' : ''));
  const now = span('muted sm song-now', '');
  const render = () => {
    const s = S(), lv = (s.upgrades && s.upgrades.speaker) | 0, cur = (s.settings && s.settings.song) || 'auto';
    wrap.textContent = '';
    const opts = [{ id: 'auto', name: 'Tự đổi bài', lv: 0 }].concat(C.SONGS);
    for (const o of opts) {
      const locked = lv < o.lv;
      const b = h('button', { type: 'button', class: 'song-b' + (o.id === cur ? ' on' : '') + (locked ? ' locked' : ''), 'aria-pressed': String(o.id === cur),
        'aria-label': o.name + (locked ? ` (cần Loa nhạc cấp ${o.lv})` : '') },
        ico(locked ? 'ui_lock' : o.id === 'auto' ? 'ui_music' : 'ui_music', 16), span('song-n', o.name),
        locked ? span('song-lv', 'Loa cấp ' + o.lv) : null);
      b.addEventListener('click', () => {
        if (locked) { sfx('error'); ctx.toast(`Nâng Loa nhạc lên cấp ${o.lv} để mở bài "${o.name}" nha.`, 'info', 'ui_lock'); return; }
        const r = act('setSetting', 'song', o.id);
        if (r.ok === false) return;
        sfx('click');
        try { ctx.audio?.unlock?.(); } catch (e) { /* ignore */ }
        if (o.id !== 'auto') ctx.toast(`Đang phát: ${o.name}`, 'good', 'ui_music');
        render();
      });
      wrap.appendChild(b);
    }
    const playing = SONG_NAMES[pickVariant(s)];
    now.textContent = cur === 'auto'
      ? (playing ? `Đang phát: ${playing} · tự đổi bài trong ca (sáng chưa mở hàng thì nhạc nhẹ)` : 'Tự đổi giữa các bài đã mở trong lúc bán')
      : `Phát "${SONG_NAMES[cur]}" từ sáng tới lúc tổng kết ngày`;
    wrap.appendChild(now);
  };
  render();
  return wrap;
}
