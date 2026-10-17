// v2.3 look editors: tem logo (Lv 24), mặt tiền (Lv 31), đồng phục (Lv 21). Every change is saved immediately
// through the core actions (setBrand / setFacade / setUniform) and shows up in the shop right away.
import { h, div, span, ico } from './dom.js';
import { ctx, act, S, sfx } from './ctx.js';
import * as C from '../config.js';
import { drawStamp, stampCanvas, portraitURL, makeStaffLook, setUniform } from '../art/index.js';
import { frame } from './modals.js';
import { secTitle, lockCard } from './sheets/common.js';
import { shownFacade } from '../core/looks.js';

const lv = () => S().level || 1;
const shopName = () => (S().shopName || C.START.shopName);

/** Hi-DPI <canvas> showing the stamp at `css` px. */
export function stampPreview(brand, css = 120, cls = 'lk-stamp') {
  const d = Math.min(3, window.devicePixelRatio || 1), px = Math.round(css * d);
  const c = h('canvas', { class: cls, width: px, height: px, style: { width: css + 'px', height: css + 'px' } });
  drawStamp(c.getContext('2d'), brand, shopName(), px);
  return c;
}
/** Small data-URL stamp for <img> badges (dock cup). */
export function stampURL(brand, css = 20) {
  try { const c = stampCanvas(brand, shopName(), Math.round(css * Math.min(3, window.devicePixelRatio || 1))); return c ? c.toDataURL() : ''; } catch (e) { return ''; }
}

function chips(list, cur, onPick, label = (x) => x.name) {
  return div('lk-chips', ...list.map((x) => h('button', {
    class: 'lk-chip' + (x.id === cur ? ' on' : ''), type: 'button', 'aria-pressed': String(x.id === cur),
    onclick: () => { if (x.id === cur) return; sfx('click'); onPick(x.id); },
  }, label(x))));
}
function swatches(list, cur, onPick, colorOf, nameOf) {
  return div('lk-sw', ...list.map((x) => h('button', {
    class: 'lk-dot' + (x.id === cur ? ' on' : ''), type: 'button', title: nameOf(x), 'aria-label': nameOf(x), 'aria-pressed': String(x.id === cur),
    style: { '--c': colorOf(x) || 'linear-gradient(135deg,#e2433b 50%,#fff 50%)' },
    onclick: () => { if (x.id === cur) return; sfx('click'); onPick(x.id); },
  })));
}

// ───────────────────────── tem logo ─────────────────────────
export function openBrandDesigner(onDone) {
  ctx.modal({
    id: 'brand', queue: false, cls: 'lk-modal', sound: 'whoosh',
    onClose: () => onDone?.(),
    build: (m) => {
      const b = S().brand || C.BRAND.def;
      const set = (patch) => { const r = act('setBrand', patch); if (r.ok !== false) m.rebuild(); };
      const input = h('input', { class: 'tinput lk-in', type: 'text', maxlength: String(C.BRAND.sloganMax), value: b.slogan || '', placeholder: 'Khẩu hiệu của quán', 'aria-label': 'Khẩu hiệu', autocomplete: 'off' });
      input.addEventListener('change', () => set({ slogan: input.value }));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      const [head, body] = frame('Thiết kế tem thương hiệu', { icon: 'sup_lylac', onClose: () => m.close('x') });
      body.append(
        h('p', { class: 'lk-lead' }, 'Tem sẽ in lên mọi ly bạn lắc và gắn cạnh bảng hiệu. Tên quán tự hiện theo tên đã đặt.'),
        div('lk-preview', stampPreview(b, 150), div('lk-cup', ico('sup_lylac', 64), stampPreview(b, 34, 'lk-cupstamp'))),
        h('label', { class: 'lk-toggle' }, h('input', { type: 'checkbox', checked: b.on !== false, onchange: (e) => set({ on: e.target.checked }) }), span('', 'In tem lên ly')),
        secTitle('Kiểu khung'), chips(C.BRAND.frames, b.frame, (id) => set({ frame: id })),
        secTitle('Kiểu chữ tên quán', b.frame === 'ruybang' ? 'khung ruy băng: tên nằm trên dải băng' : null),
        chips(C.BRAND.texts, b.text, (id) => set({ text: id })),
        secTitle('Màu nền tem'), swatches(C.BRAND.colors, b.color, (id) => set({ color: id }), (x) => x.bg, (x) => 'Nền ' + x.id),
        secTitle('Linh vật'),
        div('lk-chips', ...C.BRAND.mascots.map((id) => h('button', { class: 'lk-chip ic' + (id === b.mascot ? ' on' : ''), type: 'button', 'aria-label': id, onclick: () => { sfx('click'); set({ mascot: id }); } }, ico(id, 32)))),
        secTitle('Khẩu hiệu (tuỳ chọn)'), input,
        div('lk-chips', ...C.BRAND.slogans.concat(['Bỏ trống']).map((t) => h('button', { class: 'lk-chip', type: 'button', onclick: () => { sfx('click'); set({ slogan: t === 'Bỏ trống' ? '' : t }); } }, t))),
        h('button', { class: 'btn teal body lk-done', onclick: () => { sfx('click'); m.close('done'); } }, 'Xong'),
      );
      return [head, body];
    },
  });
}

export function brandCard(api) {
  if (lv() < C.BRAND.lv) return lockCard('Tem logo in trên ly', `Mở ở Lv ${C.BRAND.lv}. Tự thiết kế tem (khung, màu, linh vật, khẩu hiệu) in lên mọi ly và gắn cạnh bảng hiệu.`, 'sup_lylac');
  const b = S().brand || C.BRAND.def;
  return div('card lk-card',
    stampPreview(b, 72),
    div('grow', h('b', null, 'Tem logo in trên ly'), span('muted sm', b.on !== false ? 'Đang in trên ly và bảng hiệu.' : 'Đang tắt: ly trơn, bảng hiệu không gắn tem.')),
    h('button', { class: 'btn paper sm', onclick: () => { sfx('click'); openBrandDesigner(() => api.rerender()); } }, 'Thiết kế'));
}

// ───────────────────────── mặt tiền ─────────────────────────
export function facadeCard(api) {
  const f = shownFacade(S()), L = lv();             // a saved item above the current level shows as its default
  const set = (patch) => { const r = act('setFacade', patch); if (r.ok === false) return; api.rerender(); };
  const row = (cat) => div('lk-chips', ...C.FACADE.items[cat.id].map((it) => {
    const locked = it.lv > L, on = f[cat.id] === it.id;
    return h('button', {
      class: 'lk-chip' + (on ? ' on' : '') + (locked ? ' lock' : ''), type: 'button', 'aria-pressed': String(on), disabled: locked,
      title: locked ? `Mở ở Lv ${it.lv}` : it.name,
      onclick: () => { if (on || locked) return; sfx('click'); set({ [cat.id]: it.id }); },
    }, locked ? ico('ui_lock', 16) : null, span('', it.name), locked ? span('lk-lv', 'Lv ' + it.lv) : it.amb ? span('lk-amb', '+' + it.amb) : null);
  }));
  const open = Object.values(C.FACADE.items).flat().filter((x) => x.amb > 0 && x.lv <= L).length;
  const all = Object.values(C.FACADE.items).flat().filter((x) => x.amb > 0).length;
  return div('card lk-card col',
    div('lk-row', ico('ui_deco', 32), div('grow', h('b', null, 'Mặt tiền quán'), span('muted sm', `Đã mở ${open}/${all} món. Mỗi lần lên cấp mở thêm; khách nhìn thấy ngay ngoài quán, quán thêm sang.`))),
    ...C.FACADE.cats.flatMap((cat) => [secTitle(cat.name), row(cat)]));
}

// ───────────────────────── đồng phục ─────────────────────────
export function uniformCard(api) {
  if (lv() < C.UNIFORM.lv) return lockCard('Đồng phục quán', `Mở ở Lv ${C.UNIFORM.lv}. Chọn màu và kiểu đồng phục cho cả đội.`, 'ui_staff');
  const u = S().uniform || C.UNIFORM.def;
  const set = (patch) => { const r = act('setUniform', patch); if (r.ok === false) return; setUniform(S().uniform); api.rerender(); };
  setUniform(u);                                     // make the portraits below use the current choice
  const team = (S().staff || []).slice(0, 4);
  const sample = team.length ? team.map((m) => makeStaffLook(m.role, m.lookSeed || m.id)) : ['phucvu', 'daubep', 'thungan', 'quankho'].map((r, i) => makeStaffLook(r, i + 3));
  const pics = div('lk-team', ...sample.map((look) => h('img', { class: 'pix lk-face', width: 48, height: 48, alt: '', src: portraitURL(look, 3) })));
  const style = C.UNIFORM.styles.find((x) => x.id === u.style) || C.UNIFORM.styles[0];
  return div('card lk-card col',
    div('lk-row', ico('ui_staff', 32), div('grow', h('b', null, 'Đồng phục quán'), span('muted sm', team.length ? 'Cả đội mặc ngay, thấy trong quán và trong hồ sơ.' : 'Thuê nhân viên để thấy đồng phục trong quán.'))),
    pics,
    secTitle('Màu'), swatches(C.UNIFORM.colors, u.color, (id) => set({ color: id }), (x) => x.hex, (x) => x.name),
    secTitle('Kiểu', style.desc), chips(C.UNIFORM.styles, u.style, (id) => set({ style: id })));
}
