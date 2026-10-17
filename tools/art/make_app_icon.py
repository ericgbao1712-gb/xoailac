"""Xoài Lắc Ơi! app icons (PWA manifest, iOS home screen, favicon) built from the game's own pixel icons.
Run from the repo root: python3 tools/art/make_app_icon.py  → web/xoailac/assets/app/*.png"""
import json, math, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'xoailac')
OUT = os.path.join(ROOT, 'assets', 'app')
s = open(os.path.join(ROOT, 'src/art/data/icons.js')).read()
FR = json.loads(s[s.index('{'):s.rindex('}') + 1])
FR = FR.get('frames', FR)
ATLAS = Image.open(os.path.join(ROOT, 'assets/icons.png')).convert('RGBA')

def sprite(key, px):
    x, y, w, h = FR[key][:4]
    return ATLAS.crop((x, y, x + w, y + h)).resize((px, px), Image.NEAREST)

def lerp(a, b, k): return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))

def background(S):
    """sunny mango gradient with soft rays, the shop's green awning scallops along the top"""
    im = Image.new('RGBA', (S, S))
    top, bot = (255, 214, 92), (255, 146, 54)
    px = im.load()
    cx, cy = S * 0.5, S * 0.56
    for y in range(S):
        for x in range(S):
            k = y / (S - 1)
            c = lerp(top, bot, k)
            a = math.atan2(y - cy, x - cx)
            ray = 0.5 + 0.5 * math.cos(a * 12)
            d = math.hypot(x - cx, y - cy) / S
            c = lerp(c, (255, 236, 160), 0.18 * ray * max(0, 1 - d * 1.6))
            px[x, y] = c + (255,)
    g = ImageDraw.Draw(im)
    band = round(S * 0.13); n = 6; w = S / n
    g.rectangle((0, 0, S, band * 0.55), fill=(47, 80, 18))
    for i in range(n):
        col = (122, 186, 52) if i % 2 == 0 else (255, 247, 220)
        x0 = i * w
        g.rectangle((x0, band * 0.55 - 1, x0 + w, band * 0.8), fill=col)
        g.ellipse((x0, band * 0.55, x0 + w, band * 0.8 + w * 0.5), fill=col)
    return im

def compose(S, scale, bg=True):
    """scale = how much of the icon the artwork spans (maskable icons keep it inside the safe circle)"""
    im = background(S) if bg else Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cup_px = round(S * 0.62 * scale / 32) * 32 or 32
    man_px = round(S * 0.40 * scale / 32) * 32 or 32
    cx, cy = S // 2, round(S * (0.55 if bg else 0.5))
    # shadow under the cup
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((cx - cup_px * 0.36, cy + cup_px * 0.36, cx + cup_px * 0.36, cy + cup_px * 0.48), fill=(120, 50, 0, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S / 90)))
    mango = sprite('fr_xoai', man_px).rotate(-18, resample=Image.NEAREST, expand=True)
    im.alpha_composite(mango, (round(cx - cup_px * 0.62 - mango.width * 0.15), round(cy - cup_px * 0.62)))
    cup = sprite('pot_xoailac', cup_px)
    im.alpha_composite(cup, (cx - cup_px // 2, cy - cup_px // 2))
    return im

os.makedirs(OUT, exist_ok=True)
big = compose(512, 1.0)
big.save(os.path.join(OUT, 'icon-512.png'))
big.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon-192.png'))
big.resize((180, 180), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))   # iOS: no alpha
mask = compose(512, 0.78)          # Android adaptive icons crop to a circle/squircle of ~80%
mask.save(os.path.join(OUT, 'maskable-512.png'))
mask.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'maskable-192.png'))
compose(256, 1.0).resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, 'favicon-32.png'))
print('ok', sorted(os.listdir(OUT)))
