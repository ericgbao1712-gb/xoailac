"""v2.6.20 — replace the 'Đèn chùm pha lê' (crystal chandelier) frames in props.png with woven bamboo lanterns
(Đèn lồng tre đan). Same frame rects/anchors (den_chum1, den_chum2, ico_den_chum), so the deco id and saves stay.
Usage: python3 tools/art/draw_lantern.py xoailac   (writes props.png in place; re-runnable)."""
import json, math, os, sys
from PIL import Image

CORD = (59, 47, 34, 255)
OUT = (74, 48, 22, 255)
DK = (138, 95, 42, 255)
MID = (201, 154, 79, 255)
LT = (232, 194, 122, 255)
G0 = (255, 246, 200, 255)
G1 = (255, 214, 120, 255)
G2 = (247, 168, 76, 255)

def glow(d):  # d 0 (centre) .. 1 (edge)
    return G0 if d < 0.38 else G1 if d < 0.72 else G2

def ball(im, cx, top, rx, ry):
    """Round woven lantern hanging from (cx, top). Returns the bottom y."""
    px = im.load()
    cy = top + 3 + ry
    # cap + cord
    for y in range(1, top + 1): px[cx, y] = CORD; px[cx - 1, y] = CORD
    for x in range(cx - 3, cx + 3): px[x, top + 1] = OUT; px[x, top + 2] = DK
    for y in range(cy - ry, cy + ry + 1):
        v = (y - cy) / ry
        if abs(v) > 1: continue
        hw = rx * math.sqrt(1 - v * v)
        for x in range(int(round(cx - hw)), int(round(cx + hw))):
            u = (x + 0.5 - cx) / max(hw, 0.5)
            d = math.hypot(u * 0.85, v)
            col = glow(d)
            # woven bands: every 3rd row a bamboo strip with alternating over/under
            row = (y - (cy - ry)) % 3
            if row == 0: col = MID if ((x + y // 3) % 4) < 2 else DK
            # meridian ribs
            for k in (-2, -1, 0, 1, 2):
                rxk = cx + hw * math.sin(k * math.pi / 5.2)
                if abs(x + 0.5 - rxk) < 0.55: col = LT if k <= 0 else MID
            px[x, y] = col
        # outline
        xl, xr = int(round(cx - hw)) - 1, int(round(cx + hw))
        if 0 <= xl < im.width: px[xl, y] = OUT
        if 0 <= xr < im.width: px[xr, y] = OUT
    for x in range(cx - int(rx * 0.35), cx + int(rx * 0.35) + 1):
        px[x, cy - ry - 1] = OUT; px[x, cy + ry + 1] = OUT
    # bottom rim
    for x in range(cx - 3, cx + 3): px[x, cy + ry] = DK; px[x, cy + ry + 1] = OUT
    return cy + ry + 1

def drum(im, cx, top, w, h):
    """Tall cylindrical bamboo lantern."""
    px = im.load()
    for y in range(1, top + 1): px[cx, y] = CORD; px[cx - 1, y] = CORD
    x0, x1, y0, y1 = cx - w // 2, cx + w // 2, top + 2, top + 2 + h
    for x in range(x0 + 2, x1 - 2): px[x, top] = OUT; px[x, top + 1] = DK
    for y in range(y0, y1):
        t = (y - y0) / (h - 1)
        bulge = 1 if 0.12 < t < 0.88 else 0          # slightly rounded shoulders
        for x in range(x0 + 1 - bulge, x1 - 1 + bulge):
            u = (x + 0.5 - cx) / (w / 2)
            col = glow(math.hypot(u * 0.9, (t - 0.5) * 1.6))
            if (x - x0) % 3 == 0: col = LT if x < cx else MID      # vertical slats
            if (y - y0) % 6 == 0: col = DK                          # tie bands
            px[x, y] = col
        px[x0 - bulge, y] = OUT; px[x1 - 1 + bulge, y] = OUT
    for x in range(x0, x1): px[x, y0 - 1] = OUT; px[x, y1] = OUT
    for x in range(x0 + 1, x1 - 1): px[x, y0] = DK; px[x, y1 - 1] = DK
    # little bamboo tassel ring at the bottom
    for y in range(y1 + 1, y1 + 3): px[cx, y] = DK; px[cx - 1, y] = DK
    return y1

def build_frames():
    a = Image.new('RGBA', (40, 44), (0, 0, 0, 0)); ball(a, 20, 8, 14, 15)
    b = Image.new('RGBA', (26, 54), (0, 0, 0, 0)); drum(b, 13, 12, 18, 34)
    ic = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); ball(ic, 12, 1, 9, 8)
    return {'den_chum1': a, 'den_chum2': b, 'ico_den_chum': ic}

if __name__ == '__main__':
    game = sys.argv[1] if len(sys.argv) > 1 else 'xoailac'
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'web', game)
    png = os.path.join(root, 'assets', 'props.png')
    js = open(os.path.join(root, 'src', 'art', 'data', 'props.js')).read()
    fr = json.loads(js[js.index('{'):js.rindex('}') + 1])['frames']
    atlas = Image.open(png).convert('RGBA')
    others = {k: atlas.crop((v[0], v[1], v[0] + v[2], v[1] + v[3])).tobytes() for k, v in fr.items() if k not in ('den_chum1', 'den_chum2', 'ico_den_chum')}
    for k, im in build_frames().items():
        x, y, w, h = fr[k][:4]
        assert im.size == (w, h), (k, im.size, (w, h))
        atlas.paste(Image.new('RGBA', (w, h), (0, 0, 0, 0)), (x, y))
        atlas.alpha_composite(im, (x, y))
    for k, v in fr.items():
        if k in others: assert atlas.crop((v[0], v[1], v[0] + v[2], v[1] + v[3])).tobytes() == others[k], 'touched ' + k
    atlas.save(png, optimize=True)
    prev = Image.new('RGBA', (100, 60), (40, 40, 60, 255)); f = build_frames()
    prev.alpha_composite(f['den_chum1'], (2, 2)); prev.alpha_composite(f['den_chum2'], (46, 2)); prev.alpha_composite(f['ico_den_chum'], (74, 2))
    os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
    prev.resize((600, 360), Image.NEAREST).save(os.path.join(os.path.dirname(__file__), 'out', 'xl_lantern.png'))
    print('ok: den_chum1/2 + ico_den_chum redrawn as bamboo lanterns')
