// Save backup: the whole save as a copyable code (or a .txt file holding it), and restoring from one.
// Code = "XOAILAC1." + base64url(deflate-raw(JSON)) + "." + 4-char checksum  ("XOAILAC0." = not compressed).
import * as C from '../config.js';
import { h, div, span, ico } from './dom.js';
import { ctx, S, sfx } from './ctx.js';
import { frame } from './modals.js';
import { writeSave } from '../storage.js';

const CODE_RE = /XOAILAC([01])\.([A-Za-z0-9_-]+)\.([0-9a-z]{4})/;

function checksum(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return ((x >>> 0) % 1679616).toString(36).padStart(4, '0');
}
function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeSave(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  let ver = '0', bytes = raw;
  if (typeof CompressionStream !== 'undefined') {
    try { bytes = await pipe(raw, new CompressionStream('deflate-raw')); ver = '1'; } catch (e) { bytes = raw; ver = '0'; }
  }
  const body = toB64url(bytes);
  return 'XOAILAC' + ver + '.' + body + '.' + checksum(ver + body);
}

/** Resolves to the save object; throws Error(friendly Vietnamese message) on a bad code. */
export async function decodeSave(text) {
  const m = String(text || '').replace(/\s+/g, '').match(CODE_RE);
  if (!m) throw new Error('Không thấy mã sao lưu Xoài Lắc Ơi! trong đó. Mã bắt đầu bằng chữ XOAILAC nha.');
  const [, ver, body, sum] = m;
  if (checksum(ver + body) !== sum) throw new Error('Mã bị thiếu hoặc sai vài chữ. Chép lại trọn vẹn cả mã nha.');
  let bytes;
  try { bytes = fromB64url(body); } catch (e) { throw new Error('Mã bị hỏng rồi, thử chép lại nha.'); }
  if (ver === '1') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt này cũ quá, chưa mở được mã. Thử Chrome hoặc Safari mới nha.');
    try { bytes = await pipe(bytes, new DecompressionStream('deflate-raw')); } catch (e) { throw new Error('Mã bị hỏng rồi, thử chép lại nha.'); }
  }
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('Mã bị hỏng rồi, thử chép lại nha.'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.started || typeof obj.level !== 'number') throw new Error('Mã này không phải tiến trình Xoài Lắc Ơi! hợp lệ.');
  return obj;
}

const summary = (s) => `${s.shopName || C.START.shopName} · Ngày ${s.day || 1} · Cấp ${s.level || 1}`;
const pad = (n) => String(n).padStart(2, '0');

/** Settings → "Tạo mã sao lưu": shows the code with copy / download buttons. */
export function openBackup() {
  const save = ctx.game.serialize();
  const s = S();
  const area = h('textarea', { class: 'tinput bk-code', readonly: '', rows: '5', spellcheck: 'false', 'aria-label': 'Mã sao lưu' }, 'Đang tạo mã…');
  const copyBtn = h('button', { class: 'btn jade body', disabled: true }, ico('ui_check', 16), 'Sao chép mã');
  const fileBtn = h('button', { class: 'btn paper body', disabled: true }, ico('ui_down', 16), 'Tải file');
  let code = '';
  encodeSave(save).then((c) => {
    code = c; area.value = c; copyBtn.disabled = false; fileBtn.disabled = false;
  }).catch(() => { area.value = 'Chưa tạo được mã, thử lại nha.'; });

  copyBtn.addEventListener('click', async () => {
    sfx('click');
    try { await navigator.clipboard.writeText(code); ctx.toast('Đã chép mã! Dán vào chỗ an toàn nha (Zalo “Cloud của tôi” chẳng hạn).', 'good', 'ui_check'); }
    catch (e) { area.focus(); area.select(); ctx.toast('Mã đã được bôi đen — bấm giữ rồi chọn Sao chép nha.', 'info', 'ui_info'); }
  });
  fileBtn.addEventListener('click', () => {
    sfx('click');
    const d = new Date();
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const txt = `Mã sao lưu Xoài Lắc Ơi! — ${summary(s)} — lưu ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}\n`
      + 'Cách dùng: mở game → Cài đặt → Khôi phục (hoặc ở màn mở đầu bấm "Có mã sao lưu?"), rồi chọn file này hoặc dán đoạn mã bên dưới.\n\n'
      + code + '\n';
    try {
      const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
      const a = h('a', { href: url, download: `xoai-lac-sao-luu-ngay${s.day || 1}-${stamp}.txt` });
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      ctx.toast('Đang tải file sao lưu…', 'info', 'ui_down');
    } catch (e) { ctx.toast('Máy này không tải file được — dùng nút Sao chép mã nha.', 'bad'); }
  });

  return ctx.modal({
    id: 'backup', cls: 'backup', queue: false, priority: 30,
    build: (m) => frame('Mã sao lưu', { icon: 'ui_chest_gold', onClose: () => m.close('x'), sub: summary(s) },
      span('bk-txt', 'Giữ mã này (hoặc file) cẩn thận. Đổi máy, xóa trình duyệt hay chơi lại thì dán mã vào là quán về y như cũ.'),
      area,
      div('mrow', copyBtn, fileBtn),
      span('bk-tip', 'Mẹo: nếu tải file không được, chép mã rồi gửi vào Zalo “Cloud của tôi” cho chắc ăn.')),
  });
}

/** Restore from a pasted code or a chosen file. Works from Settings and from the intro screen. */
export function openRestore({ onClose } = {}) {
  const area = h('textarea', { class: 'tinput bk-code', rows: '5', spellcheck: 'false', autocomplete: 'off', placeholder: 'Dán mã XOAILAC… vào đây', 'aria-label': 'Dán mã sao lưu' });
  const fileIn = h('input', { type: 'file', accept: '.txt,text/plain', hidden: '' });
  const pickBtn = h('button', { class: 'btn paper body' }, ico('ui_book', 16), 'Chọn file');
  const goBtn = h('button', { class: 'btn red body' }, 'Khôi phục');
  const err = span('bk-err', '');
  pickBtn.addEventListener('click', () => { sfx('click'); fileIn.click(); });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    try { area.value = (await f.text()).slice(0, 200000); err.textContent = ''; } catch (e) { err.textContent = 'Không đọc được file này.'; }
  });

  return ctx.modal({
    id: 'restore', cls: 'backup', queue: false, priority: 30, onClose,
    build: (m) => {
      goBtn.addEventListener('click', async () => {
        sfx('click');
        let obj;
        try { obj = await decodeSave(area.value); } catch (e) { err.textContent = e.message; area.classList.add('shake'); setTimeout(() => area.classList.remove('shake'), 400); return; }
        const apply = () => { m.close('ok'); restoreSave(obj); };
        if (S().started) {
          ctx.confirm({
            title: 'Thay quán hiện tại?', icon: 'ui_chest_gold', danger: true, yes: 'Khôi phục', no: 'Thôi',
            text: `Quán đang chơi sẽ được thay bằng bản sao lưu: ${summary(obj)}.`,
            onYes: apply,
          });
        } else apply();
      });
      return frame('Khôi phục quán', { icon: 'ui_chest_gold', onClose: () => m.close('x') },
        span('bk-txt', 'Dán mã sao lưu, hoặc chọn file .txt đã tải về trước đó.'),
        area, fileIn, err,
        div('mrow', pickBtn, goBtn));
    },
  });
}

async function restoreSave(obj) {
  obj.savedAt = Date.now();            // no offline earnings for the time the backup sat in a drawer
  // keep autosave / pagehide from writing the current game back over it before the reload
  try { ctx.game.serialize = () => obj; } catch (e) { /* ignore */ }
  const ok = await writeSave(obj);
  if (!ok) { ctx.toast('Trình duyệt đang chặn lưu dữ liệu (chế độ ẩn danh?) nên chưa khôi phục được.', 'bad'); return; }
  ctx.toast('Đã khôi phục quán! Đang mở lại…', 'good', 'ui_check');
  setTimeout(() => { try { location.reload(); } catch (e) { /* ignore */ } }, 700);
}
