"""v2.6.7 counter-view backdrops for the branch cities (Đà Lạt, Vũng Tàu, Cần Thơ, Phú Quốc).
Painted in code at half resolution (1 art pixel = 2 image pixels, like the existing scenes), then the bottom of an
existing backdrop (railing + pavement) is laid over it, with the water showing through the railing gaps replaced by
the new water. Run from the repo root: python3 tools/art/draw_city_backdrops.py → web/xoailac/assets/scenes/front_<id>.png"""
import colorsys, math, os, random
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'xoailac', 'assets', 'scenes')
W, H = 449, 561
HW, HH = (W + 1) // 2, (H + 1) // 2           # half-res canvas 225 × 281

def hx(c): c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, k): return tuple(int(round(a[i] + (b[i] - a[i]) * k)) for i in range(3))

# ───────── painting helpers (half-res) ─────────
def sky(im, y1, stops):
    """stepped vertical gradient: stops = [(k, colour)…] from 0 (top) to 1 (y1); 14 flat bands like pixel art"""
    g = ImageDraw.Draw(im); bands = 30
    for b in range(bands):
        k0, k1 = b / bands, (b + 1) / bands; k = (k0 + k1) / 2
        for (a, ca), (bb, cb) in zip(stops, stops[1:]):
            if a <= k <= bb: col = mix(hx(ca), hx(cb), (k - a) / max(1e-6, bb - a)); break
        g.rectangle((0, round(k0 * y1), HW, round(k1 * y1)), fill=col)

def cloud(im, cx, cy, s, body='#ffffff', shade='#cfe3f2', rim=None, rng=None):
    rng = rng or random
    g = ImageDraw.Draw(im)
    puffs = [(cx + dx * s, cy + dy * s, r * s) for dx, dy, r in [(-9, 1, 5), (-3, -3, 7), (5, -1, 6), (11, 2, 4), (2, 2, 6)]]
    for x, y, r in puffs: g.ellipse((x - r, y - r + 1.5, x + r, y + r + 1.5), fill=hx(shade))
    for x, y, r in puffs: g.ellipse((x - r, y - r, x + r, y + r - 1), fill=hx(body))
    if rim:
        for x, y, r in puffs[:3]: g.ellipse((x - r * 0.6, y - r, x + r * 0.4, y - r * 0.4), fill=hx(rim))
    g.rectangle((cx - 13 * s, cy + 2 * s, cx + 15 * s, cy + 5 * s), fill=hx(shade))

def ridge(im, y_base, amp, col, seed, freq=0.05, top=None):
    """a hill line: y = base - amp·noise(x)"""
    rng = random.Random(seed); ph = [rng.random() * 6 for _ in range(3)]
    g = ImageDraw.Draw(im); ys = []
    for x in range(HW):
        y = y_base - amp * (0.55 * math.sin(x * freq + ph[0]) + 0.3 * math.sin(x * freq * 2.3 + ph[1]) + 0.15 * math.sin(x * freq * 5.1 + ph[2]) + 0.5)
        ys.append(round(y)); g.line((x, round(y), x, top if top is not None else HH), fill=hx(col))
    return ys

def pine(g, x, yb, h, dark, light):
    w = max(2, h // 3)
    for i in range(4):
        t = yb - h + i * h // 4; ww = w * (i + 1) // 4 + 1
        g.polygon([(x, t - 1), (x - ww, t + h // 3), (x + ww, t + h // 3)], fill=hx(dark))
        g.line((x, t, x - ww + 1, t + h // 3 - 1), fill=hx(light))
    g.line((x, yb - 2, x, yb), fill=hx('#4a3424'))

def palm(g, x, yb, h, lean, col, frond):
    pts = []
    for i in range(h + 1):
        u = i / h; pts.append((x + lean * u * u * h * 0.4, yb - i))
    for i in range(len(pts) - 1):
        u = i / max(1, len(pts) - 1)
        g.line((pts[i], pts[i + 1]), fill=hx(col), width=max(2, round(h / 18 * (1.3 - 0.6 * u))))
    tx, ty = pts[-1]
    L = h * 0.5
    for ang in (-175, -150, -122, -95, -62, -32, -5, 160, 20):
        a = math.radians(ang)
        # a leaf: a curved spine with leaflets hanging off it
        prev = (tx, ty)
        for k in range(1, 9):
            u = k / 8
            p = (tx + math.cos(a) * L * u, ty + math.sin(a) * L * u + (L * 0.45) * u * u)
            g.line((prev, p), fill=hx(frond), width=2)
            lw = max(1, round(L * 0.16 * (1 - u * 0.7)))
            g.line((p, (p[0] + math.cos(a + 1.3) * lw, p[1] + math.sin(a + 1.3) * lw + lw * 0.6)), fill=hx(frond), width=1)
            g.line((p, (p[0] + math.cos(a - 1.3) * lw, p[1] + math.sin(a - 1.3) * lw + lw * 0.6)), fill=hx(frond), width=1)
            prev = p
    g.ellipse((tx - 2, ty - 1, tx + 2, ty + 3), fill=hx(col))

def water(im, y0, y1, top, bottom, rng, dash='#ffffff', dash_n=90):
    g = ImageDraw.Draw(im)
    for y in range(y0, y1):
        k = (y - y0) / max(1, y1 - y0)
        g.line((0, y, HW, y), fill=mix(hx(top), hx(bottom), k ** 0.8))
    for _ in range(dash_n):
        y = rng.randint(y0 + 1, y1 - 1); x = rng.randint(-4, HW); ln = rng.randint(2, 6 + int(6 * (y - y0) / max(1, y1 - y0)))
        g.line((x, y, x + ln, y), fill=mix(hx(dash), im.getpixel((min(HW - 1, max(0, x)), y)), 0.45))

def reflect(im, y_h, depth, k=0.38, tint=None):
    """mirror the band above the horizon into the water (squashed), blended with the water colour"""
    band = im.crop((0, y_h - depth, HW, y_h)).transpose(Image.FLIP_TOP_BOTTOM)
    under = im.crop((0, y_h, HW, y_h + depth))
    out = Image.blend(under, band, k)
    # break it up with horizontal ripples
    px = out.load(); up = under.load()
    for y in range(depth):
        if y % 3 == 2:
            for x in range(HW): px[x, y] = up[x, y]
    im.paste(out, (0, y_h))

# ───────── compositing the existing railing + pavement ─────────
def railing_from(base_file, y_cut, is_water):
    """bottom of an existing backdrop from y_cut down; pixels that are the old water become transparent"""
    src = Image.open(os.path.join(ROOT, base_file)).convert('RGBA')
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    part = src.crop((0, y_cut, W, H)); px = part.load()
    for y in range(part.height):
        for x in range(W):
            r, g, b, a = px[x, y]
            if is_water(r, g, b, y + y_cut): px[x, y] = (0, 0, 0, 0)
    out.paste(part, (0, y_cut))
    return out

def mapho_water(r, g, b, y):
    if y >= 392: return False
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hd = h * 360
    lotus = y < 384 and s > 0.2 and (60 <= hd <= 160 or hd >= 290 or hd <= 8)      # Hồ Gươm's lily pads and flowers
    leftover = y < 372 and s > 0.3 and l > 0.35 and not (15 <= hd <= 45)                                    # anything coloured between the posts
    return (160 <= hd <= 215 and s > 0.25 and 0.3 < l < 0.92) or lotus or leftover
def haitang_water(r, g, b, y):
    if y >= 388: return False
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hd = h * 360
    stone = (15 <= hd <= 50 and s < 0.45 and l > 0.55)            # balusters / rail
    return not stone and s > 0.18 and l > 0.25 and (hd >= 220 or hd <= 45)

def seafront():
    """chain railing (Hồ Gươm) + the bờ kè's tiled promenade below it"""
    rail = railing_from('front_mapho.png', 355, mapho_water)
    tiles = Image.open(os.path.join(ROOT, 'front_haitang.png')).convert('RGBA').crop((0, 392, W, H))
    rail.paste(tiles, (0, 392))
    return rail

def finish(half, overlay, name):
    big = half.resize((HW * 2, HH * 2), Image.NEAREST).crop((0, 0, W, H)).convert('RGBA')
    big.alpha_composite(overlay)
    big.convert('RGB').quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE).save(os.path.join(ROOT, 'front_' + name + '.png'), optimize=True)
    return big

# ───────── the four cities ─────────
def dalat():
    rng = random.Random(11); im = Image.new('RGB', (HW, HH)); g = ImageDraw.Draw(im)
    HZ = 160                                        # lake horizon (half-res); low, so the landmarks show in the zoomed tier-5 view
    sky(im, HZ, [(0, '#4f9fe6'), (0.6, '#8cc8f2'), (1, '#d6eefb')])
    for cx, cy, s in [(40, 26, 1.0), (150, 18, 1.2), (205, 44, 0.8), (95, 52, 0.7)]: cloud(im, cx, cy, s, rng=rng)
    ridge(im, HZ - 34, 26, '#9bb7cc', 3, 0.035)                       # far misty hills
    ys = ridge(im, HZ - 14, 24, '#4f8a6c', 7, 0.045)                  # mid hills with pines
    for x in range(2, HW, 4):
        if rng.random() < 0.8: pine(g, x + rng.randint(-1, 1), ys[min(HW - 1, x)] + 6, rng.randint(9, 15), '#2e5a43', '#4b7d5c')
    # French villas on the slope
    for vx in (30, 58, 132, 176):
        vy = ys[vx] + 4
        g.rectangle((vx - 6, vy - 7, vx + 6, vy), fill=hx('#f3e6c8')); g.polygon([(vx - 8, vy - 7), (vx, vy - 13), (vx + 8, vy - 7)], fill=hx(rng.choice(['#c8553d', '#d9773a', '#9a4a3a'])))
        for wx in (vx - 3, vx + 2): g.rectangle((wx, vy - 5, wx + 1, vy - 3), fill=hx('#4a6a8a'))
    # the pink cathedral (Nhà thờ Con Gà) on the right hill
    cx, cy = 104, ys[104] + 2
    g.rectangle((cx - 9, cy - 12, cx + 9, cy), fill=hx('#f2b6a8')); g.polygon([(cx - 10, cy - 12), (cx, cy - 17), (cx + 10, cy - 12)], fill=hx('#b8524a'))
    g.rectangle((cx - 3, cy - 30, cx + 3, cy - 12), fill=hx('#f6c4b6')); g.polygon([(cx - 4, cy - 30), (cx, cy - 42), (cx + 4, cy - 30)], fill=hx('#b8524a'))
    g.line((cx, cy - 46, cx, cy - 42), fill=hx('#3a2a2a')); g.point((cx + 1, cy - 46), fill=hx('#e8b23a'))
    g.rectangle((cx - 1, cy - 25, cx + 1, cy - 22), fill=hx('#fff6d8')); g.rectangle((cx - 1, cy - 6, cx + 1, cy), fill=hx('#6a3a2a'))
    # shore line of pines
    g.rectangle((0, HZ - 4, HW, HZ), fill=hx('#3d6d52'))
    for x in range(0, HW, 3): pine(g, x, HZ, rng.randint(6, 10), '#2a5440', '#3f6f55')
    water(im, HZ, 198, '#7cc0d8', '#3f97b8', rng)
    reflect(im, HZ, 30, 0.33)
    return finish(im, railing_from('front_mapho.png', 355, mapho_water), 'dalat')

def vungtau():
    rng = random.Random(23); im = Image.new('RGB', (HW, HH)); g = ImageDraw.Draw(im)
    HZ = 152
    sky(im, HZ, [(0, '#3f8fe0'), (0.7, '#86c3f0'), (1, '#e2f3fb')])
    for cx, cy, s in [(30, 30, 1.1), (120, 16, 0.9), (190, 36, 1.2)]: cloud(im, cx, cy, s, rng=rng)
    # Núi Nhỏ on the right with the Christ statue, the lighthouse hill on the left
    ys = ridge(im, HZ + 2, 40, '#4e8a5c', 5, 0.03)
    g.rectangle((0, 0, 0, 0))
    hill = Image.new('RGB', (HW, HH)); hm = Image.new('L', (HW, HH), 0); hd = ImageDraw.Draw(hm)
    hd.polygon([(120, HZ + 1), (160, HZ - 30), (176, HZ - 38), (196, HZ - 30), (230, HZ + 1)], fill=255)
    hd.polygon([(-5, HZ + 1), (14, HZ - 18), (34, HZ - 22), (60, HZ + 1)], fill=255)
    im.paste(Image.new('RGB', (HW, HH), hx('#3f7a4e')), (0, 0), hm)
    sky_mask = Image.new('L', (HW, HH), 0); ImageDraw.Draw(sky_mask).rectangle((0, 0, HW, HZ - 41), fill=255)
    # (redraw sky above the ridge line drawn by `ridge`, keep only the two hills)
    top = Image.new('RGB', (HW, HZ)); sky(top, HZ, [(0, '#3f8fe0'), (0.7, '#86c3f0'), (1, '#e2f3fb')])
    for cx, cy, s in [(30, 30, 1.1), (120, 16, 0.9), (190, 36, 1.2)]: cloud(top, cx, cy, s, rng=rng)
    m2 = Image.new('L', (HW, HZ), 255); ImageDraw.Draw(m2).polygon([(120, HZ + 1), (160, HZ - 30), (176, HZ - 38), (196, HZ - 30), (230, HZ + 1)], fill=0)
    ImageDraw.Draw(m2).polygon([(-5, HZ + 1), (14, HZ - 18), (34, HZ - 22), (60, HZ + 1)], fill=0)
    im.paste(top, (0, 0), m2)
    for x in range(126, 226, 3):                     # trees on the hills
        y = HZ - 2 - max(0, min(38, 38 - abs(x - 176) * 0.7)); g.ellipse((x - 2, y - 2, x + 2, y + 1), fill=hx('#2f6a42'))
    for x in range(0, 58, 3):
        y = HZ - 2 - max(0, min(22, 22 - abs(x - 28) * 0.7)); g.ellipse((x - 2, y - 2, x + 2, y + 1), fill=hx('#2f6a42'))
    sx, sy = 176, HZ - 38                             # Christ statue (arms open) on its pedestal
    g.rectangle((sx - 3, sy - 4, sx + 3, sy), fill=hx('#e9e4da')); g.rectangle((sx - 1, sy - 15, sx + 1, sy - 4), fill=hx('#f6f2ea'))
    g.rectangle((sx - 6, sy - 13, sx + 6, sy - 12), fill=hx('#f6f2ea')); g.rectangle((sx - 1, sy - 17, sx + 1, sy - 15), fill=hx('#f6f2ea'))
    lx, ly = 30, HZ - 22                              # lighthouse
    g.rectangle((lx - 2, ly - 14, lx + 2, ly), fill=hx('#fbfbf6')); g.rectangle((lx - 3, ly - 17, lx + 3, ly - 14), fill=hx('#c8443a'))
    g.rectangle((lx - 1, ly - 16, lx + 1, ly - 15), fill=hx('#ffe08a')); g.line((lx - 2, ly - 8, lx + 2, ly - 8), fill=hx('#c8443a'))
    water(im, HZ, 198, '#5fb3e0', '#1f6fae', rng, dash_n=140)
    reflect(im, HZ, 18, 0.25)
    for bx, by, c in [(70, HZ + 10, '#2f5f9a'), (102, HZ + 6, '#c8443a'), (145, HZ + 16, '#2f5f9a')]:   # fishing boats
        g.polygon([(bx - 7, by), (bx + 7, by), (bx + 5, by + 3), (bx - 5, by + 3)], fill=hx(c)); g.rectangle((bx - 2, by - 4, bx + 2, by), fill=hx('#f2ead8'))
        g.line((bx - 6, by + 4, bx + 6, by + 4), fill=hx('#9fd2ee'))
    return finish(im, seafront(), 'vungtau')

def cantho():
    rng = random.Random(37); im = Image.new('RGB', (HW, HH)); g = ImageDraw.Draw(im)
    HZ = 158
    sky(im, HZ, [(0, '#5aa0de'), (0.55, '#a6d4ef'), (1, '#f6e6c4')])
    for cx, cy, s in [(46, 24, 1.0), (160, 30, 1.1), (210, 14, 0.7)]: cloud(im, cx, cy, s, shade='#e8d9c9', rng=rng)
    # Cần Thơ bridge: two pylons with fan cables, deck across the river
    deck = HZ - 16
    for px in (70, 160):
        g.polygon([(px - 5, deck + 2), (px - 1, deck - 40), (px + 1, deck - 40), (px + 5, deck + 2)], fill=hx('#d9d2c6'))
        g.line((px, deck - 40, px, deck), fill=hx('#b9b2a6'))
        for k in range(1, 8):
            g.line((px, deck - 38 + k, px - k * 6, deck), fill=hx('#eae6de')); g.line((px, deck - 38 + k, px + k * 6, deck), fill=hx('#eae6de'))
    g.rectangle((0, deck, HW, deck + 2), fill=hx('#8c8578')); g.line((0, deck, HW, deck), fill=hx('#c9c2b6'))
    for x in range(0, HW, 9): g.line((x, deck + 3, x, HZ - 2), fill=hx('#9a9286'))
    # coconut palms on the far bank
    g.rectangle((0, HZ - 5, HW, HZ), fill=hx('#4a7a3a'))
    for x in range(4, HW, 11): palm(g, x + rng.randint(-2, 2), HZ - 2, rng.randint(10, 16), rng.uniform(-1, 1), '#5a4632', '#3f7a35')
    water(im, HZ, 198, '#b9b48a', '#7d8a5c', rng, dash='#f6ecc8', dash_n=110)            # the brown-green Hậu river
    reflect(im, HZ, 26, 0.28)
    # floating market boats with the cây bẹo poles hung with fruit
    for bx, by in [(40, HZ + 14), (120, HZ + 10), (190, HZ + 18), (85, HZ + 26)]:
        g.polygon([(bx - 12, by), (bx + 12, by), (bx + 9, by + 4), (bx - 9, by + 4)], fill=hx('#6a4228')); g.line((bx - 12, by, bx + 12, by), fill=hx('#9a6a3a'))
        g.rectangle((bx - 6, by - 4, bx + 4, by), fill=hx('#3d6d8a')); g.line((bx - 7, by - 5, bx + 5, by - 5), fill=hx('#2b4e66'))
        g.line((bx + 8, by, bx + 8, by - 14), fill=hx('#5a3a20'))
        for i, c in enumerate(['#e8c13a', '#7fbf3f', '#e26a3a']): g.ellipse((bx + 7 + (i % 2) * 2, by - 14 + i * 3, bx + 9 + (i % 2) * 2, by - 12 + i * 3), fill=hx(c))
        for i in range(4): g.ellipse((bx - 5 + i * 3, by - 7, bx - 3 + i * 3, by - 5), fill=hx(['#e8c13a', '#7fbf3f', '#e8973a', '#d84a3a'][i]))
    return finish(im, railing_from('front_mapho.png', 355, mapho_water), 'cantho')

def phuquoc():
    rng = random.Random(41); im = Image.new('RGB', (HW, HH)); g = ImageDraw.Draw(im)
    HZ = 152
    sky(im, HZ, [(0, '#5b4a9a'), (0.35, '#c46a9a'), (0.7, '#f39a5a'), (1, '#ffd47a')])
    for cx, cy, s in [(40, 40, 1.0), (150, 28, 1.3), (205, 60, 0.8)]: cloud(im, cx, cy, s, body='#f7a8a0', shade='#b9688a', rim='#ffd8a8', rng=rng)
    g.ellipse((112 - 22, HZ - 18, 112 + 22, HZ + 26), fill=hx('#ffe9a0')); g.ellipse((112 - 18, HZ - 14, 112 + 18, HZ + 22), fill=hx('#fff4c8'))   # setting sun
    g.polygon([(150, HZ), (175, HZ - 12), (205, HZ - 8), (230, HZ)], fill=hx('#6a4a7a'))         # island
    water(im, HZ, 198, '#f0a070', '#5a4a8a', rng, dash='#ffe0a0', dash_n=120)
    for y in range(HZ, 198, 2):                       # the sun's path on the sea
        w = 4 + (y - HZ) * 0.6; x = 112 + rng.randint(-2, 2)
        g.line((x - w / 2, y, x + w / 2, y), fill=hx('#ffe2a0'))
    g.polygon([(60, HZ + 8), (70, HZ + 8), (68, HZ + 10), (62, HZ + 10)], fill=hx('#3a2a4a')); g.polygon([(65, HZ - 6), (65, HZ + 7), (72, HZ + 7)], fill=hx('#f6e6d6'))   # sailboat
    # palms framing the view
    palm(g, 8, 178, 92, 1.4, '#3a2a3a', '#2e2a3e'); palm(g, 214, 178, 80, -1.6, '#3a2a3a', '#2e2a3e'); palm(g, 196, 178, 58, -0.6, '#3a2a3a', '#2e2a3e')
    return finish(im, seafront(), 'phuquoc')

if __name__ == '__main__':
    for f in (dalat, vungtau, cantho, phuquoc): f(); print('ok', f.__name__)
