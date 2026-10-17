// Sprite atlas loader shared by every art module (icons, characters, scenes, props).
// Atlases are PNGs in /assets; each has a frame table module in src/art/data/<atlas>.js:
//   export default { file: 'chars.png', frames: { name: [x, y, w, h, ax, ay], … } }
// (x, y, w, h) = rect in the PNG in sprite px; (ax, ay) = anchor inside the frame in sprite px
// (feet = bottom-centre for characters/props, centre for icons).
//
// Sprite px vs world px: the renderer's buffer runs at DETAIL buffer px per world px, so a sprite
// drawn with blit() at a world position lands 1:1 on buffer pixels (crisp, no resampling).
// Keep DETAIL in sync with `DETAIL` in src/render/renderer.js.
export const DETAIL = 2;
// The CDN caches PNGs for a long time: bump ASSET_VER whenever any assets/*.png changes.
export const ASSET_VER = 'xl7';

const hasDOM = typeof document !== 'undefined';
const atlases = new Map();     // file → { img, flipped }
const pending = [];

/** Start loading an atlas PNG (idempotent). Returns the record; `rec.img` is null until loaded. */
export function loadAtlas(file) {
  let rec = atlases.get(file);
  if (rec) return rec;
  rec = { img: null, flipped: null, file };
  atlases.set(file, rec);
  if (!hasDOM) return rec;
  const img = new Image();
  const p = new Promise((resolve) => {
    img.onload = () => { rec.img = img; resolve(); };
    img.onerror = () => { console.warn('[art] missing atlas', file); resolve(); };
  });
  img.src = new URL('../../assets/' + file + '?v=' + ASSET_VER, import.meta.url).href;
  pending.push(p);
  return rec;
}

/** Resolves when every atlas requested so far has loaded (or failed). main.js awaits this before the first frame. */
export function artReady() { return Promise.all(pending); }

/** Lazily built mirror image of an atlas (for facing 'left'). Frames keep their rects; x is mirrored. */
function flippedOf(rec) {
  if (rec.flipped || !rec.img) return rec.flipped;
  const c = document.createElement('canvas');
  c.width = rec.img.width; c.height = rec.img.height;
  const g = c.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(rec.img, 0, 0);
  rec.flipped = c;
  return c;
}

/**
 * Draw frame `f` ([x,y,w,h,ax,ay]) of atlas `rec` with its anchor at world (x, y).
 * flip = mirror horizontally around the anchor. Returns false if the atlas is not loaded yet.
 */
export function blit(ctx, rec, f, x, y, flip = false, alpha = 1) {
  if (!rec || !rec.img || !f) return false;
  const [fx, fy, fw, fh, ax, ay] = f;
  const px = Math.round(x * DETAIL), py = Math.round(y * DETAIL);   // snap to buffer pixels
  const dx = (px - (flip ? fw - ax : ax)) / DETAIL, dy = (py - ay) / DETAIL;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    const src = flippedOf(rec);
    ctx.drawImage(src, src.width - fx - fw, fy, fw, fh, dx, dy, fw / DETAIL, fh / DETAIL);
  } else {
    ctx.drawImage(rec.img, fx, fy, fw, fh, dx, dy, fw / DETAIL, fh / DETAIL);
  }
  if (alpha !== 1) ctx.globalAlpha = 1;
  return true;
}

/** Copy one frame into its own canvas, upscaled by an integer factor (for DOM <img> data URLs). */
export function frameCanvas(rec, f, scale = 1, flip = false) {
  if (!hasDOM || !rec || !rec.img || !f) return null;
  const [fx, fy, fw, fh] = f;
  const c = document.createElement('canvas');
  c.width = fw * scale; c.height = fh * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(rec.img, fx, fy, fw, fh, 0, 0, c.width, c.height);
  return c;
}
