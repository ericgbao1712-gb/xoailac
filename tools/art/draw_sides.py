"""Code-drawn pixel icons for the v2.5 side dishes (món ăn kèm), 32×32, same style as draw_supplies.py:
dark-brown 1px outline, light from the top-left, 3-4 tone shading, white specular dots.
python3 draw_sides.py → tools/art/out/xl_sides.png (preview ×6). pack_icons.py packs them with the supplies."""
from PIL import Image
import math, os
from draw_supplies import canvas, px, rect, hline, outline

def ell(im, cx, cy, rx, ry, tones, hl=True):
    """filled ellipse, 4 tones by distance from the top-left light."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1: continue
            l = (dx + dy) * 0.5 + d * 0.3       # lower-right darker
            c = tones[0] if l < -0.35 else tones[1] if l < 0.05 else tones[2] if l < 0.4 else tones[3]
            px(im, x, y, c)
    if hl: px(im, round(cx - rx * 0.45), round(cy - ry * 0.45), (255, 255, 255))

GOLD = [(255, 214, 120), (240, 172, 70), (206, 128, 44), (160, 92, 34)]
BROWN = [(214, 150, 90), (184, 112, 58), (146, 82, 40), (110, 60, 30)]
CREAM = [(255, 246, 222), (240, 224, 190), (218, 196, 156), (186, 160, 120)]
ORANGE = [(255, 190, 90), (246, 150, 40), (218, 112, 24), (176, 80, 20)]
GREEN = [(150, 210, 90), (100, 170, 50), (64, 128, 34), (40, 90, 24)]
WHITE = [(255, 255, 255), (238, 240, 236), (214, 218, 210), (182, 186, 178)]
RED = [(255, 120, 100), (226, 67, 59), (180, 40, 40), (130, 28, 28)]

def cup(im, top=12, bot=29, wt=22, wb=16):
    """clear takeaway cup body (things drawn inside afterwards show through the tint)."""
    clear = [(236, 244, 248), (214, 228, 236), (190, 206, 218)]
    for y in range(top, bot + 1):
        v = (y - top) / max(1, bot - top)
        half = (wt + (wb - wt) * v) / 2
        for x in range(round(16 - half), round(16 + half)):
            u = (x - (16 - half)) / max(1, 2 * half)
            px(im, x, y, clear[0] if u < 0.2 else clear[1] if u < 0.7 else clear[2])

def banhtrangtron():
    im = canvas(); cup(im, 15, 29, 24, 17)
    ell(im, 16, 14, 11, 5.5, [(250, 236, 200), (236, 214, 170), (214, 186, 140), (190, 160, 116)], hl=False)   # heap over the rim
    import random; r = random.Random(3)
    cols = [(240, 150, 60), (226, 67, 59), (110, 170, 60), (186, 120, 60), (255, 246, 222), (240, 150, 60)]
    for i in range(140):
        x = r.randint(5, 27); y = r.randint(8, 27)
        inside = (x - 16) ** 2 / 110 + (y - 14) ** 2 / 28 <= 1 or (y > 16 and abs(x - 16) < 10 - (y - 16) * 0.2)
        if not inside: continue
        c = r.choice(cols); px(im, x, y, c)
        if r.random() < 0.5: px(im, x + 1, y, c)
    ell(im, 12, 11, 2.4, 2.1, CREAM); ell(im, 20, 10, 2.2, 1.9, CREAM)   # quail eggs on top
    return outline(im)

def cavien():
    im = canvas()
    for y in range(4, 31): px(im, 16 + (y - 4) // 9 - 1, y, (196, 160, 110))   # bamboo skewer
    for i, cy in enumerate((9, 16, 23)):
        ell(im, 16 + i * 0.5, cy, 5, 4, GOLD)
        px(im, 13 + i, cy - 1, (255, 236, 170))
    for x, y in ((19, 12), (14, 19), (20, 25)): px(im, x, y, (226, 67, 59))   # chilli sauce dots
    return outline(im)

def phomaique():
    im = canvas()
    for x0 in (8, 18):                                     # two breaded sticks standing up, a cheese pull between
        for y in range(6, 27):
            for w in range(-3, 3):
                c = GOLD[0] if w < -1 else GOLD[1] if w < 1 else GOLD[2]
                px(im, x0 + w, y, c)
        for y in range(8, 26, 3): px(im, x0 - 1 + (y // 3) % 2, y, GOLD[3])   # crumbs
        px(im, x0 - 2, 8, (255, 246, 200))
    for x in range(11, 16):
        y = 15 + round(math.sin((x - 11) / 4 * math.pi) * 2)
        px(im, x, y, (255, 226, 90)); px(im, x, y + 1, (255, 240, 150))
    for y in range(26, 31): px(im, 8, y, (196, 160, 110)); px(im, 18, y, (196, 160, 110))   # sticks
    return outline(im)

def bobia():
    im = canvas()
    for k, cy in enumerate((11, 21)):                      # two white rolls lying across
        rect(im, 5, cy - 4, 25, cy + 3, WHITE[1]); hline(im, 5, 25, cy - 4, WHITE[0]); hline(im, 5, 25, cy + 3, WHITE[3])
        hline(im, 5, 25, cy + 2, WHITE[2])
        for y in range(cy - 3, cy + 3):                    # cut end shows the filling
            px(im, 26, y, (240, 150, 60) if y < cy else (110, 170, 60)); px(im, 27, y, (186, 120, 60))
        for x in range(8, 24, 4): px(im, x, cy - 1, (200, 230, 190))   # greens through the wrapper
    return outline(im)

def xoaisay():
    im = canvas()
    for cx, cy, rx, ry in ((12, 11, 8, 4.5), (20, 17, 8, 4.5), (12, 23, 8, 4.5)):   # flat slices of dried mango
        ell(im, cx, cy, rx, ry, ORANGE)
        for x in range(round(cx - rx + 2), round(cx + rx - 1), 3): px(im, x, round(cy + 1), ORANGE[2])   # fibres
    for x, y in ((9, 9), (18, 15), (10, 21), (23, 19)): px(im, x, y, (255, 255, 255))   # sugar
    return outline(im)

def banhtrangnuong():
    im = canvas()
    for y in range(9, 27):                                 # folded half-moon grilled rice paper
        for x in range(4, 29):
            dx, dy = (x - 16) / 12.5, (y - 26) / 16
            if dx * dx + dy * dy > 1 or y > 26: continue
            l = (x - 4) / 24 * 0.5 + (26 - y) / 17 * -0.5
            c = (250, 214, 140) if l < -0.15 else (236, 182, 96) if l < 0.12 else (206, 140, 64)
            px(im, x, y, c)
    for x, y in ((9, 21), (13, 16), (18, 14), (22, 19), (15, 22), (20, 24), (11, 24)): px(im, x, y, (140, 70, 30))   # grill marks
    for x, y in ((12, 19), (17, 19), (21, 22), (15, 13)): px(im, x, y, (100, 170, 60))   # green onion
    for x, y in ((14, 20), (19, 17), (10, 22)): px(im, x, y, (255, 200, 60))  # egg
    return outline(im)

def trungcut():
    im = canvas()
    for y in range(16, 29):                                # small bowl
        v = (y - 16) / 12
        half = 12 - v * v * 6
        for x in range(round(16 - half), round(16 + half)):
            u = (x - (16 - half)) / (2 * half)
            px(im, x, y, (236, 240, 244) if u < 0.25 else (210, 220, 228) if u < 0.75 else (178, 190, 200))
    hline(im, 5, 26, 16, (150, 80, 36)); hline(im, 6, 25, 17, (120, 60, 26))   # tamarind sauce surface
    for cx, cy in ((10, 13), (16, 11), (22, 13), (13, 15), (19, 15)):
        ell(im, cx, cy, 2.6, 2.2, BROWN)                   # sauce-glazed quail eggs
    px(im, 15, 10, (255, 236, 200))
    for x, y in ((9, 12), (21, 11)): px(im, x, y, (100, 170, 60))   # rau răm
    return outline(im)

def khoga():
    im = canvas()
    rect(im, 8, 9, 23, 29, (226, 236, 242))               # jar
    rect(im, 9, 12, 22, 28, (214, 150, 70))                 # packed with shredded chicken
    rect(im, 7, 5, 24, 8, (226, 67, 59)); hline(im, 7, 24, 5, (255, 120, 100)); hline(im, 7, 24, 8, (160, 34, 34))  # red lid
    import random; r = random.Random(5)
    for i in range(120):
        x = r.randint(9, 22); y = r.randint(12, 28)
        c = r.choice([(236, 180, 96), (180, 108, 44), (250, 206, 120), (90, 150, 50), (226, 67, 59), (180, 108, 44)])
        px(im, x, y, c)
        if r.random() < 0.4: px(im, x + 1, y + 1, c)
    for y in range(10, 28): px(im, 10, y, (240, 248, 252))   # glass highlight
    hline(im, 9, 22, 10, (240, 248, 252))
    return outline(im)

ICONS = {
    'ak_banhtrangtron': banhtrangtron, 'ak_cavien': cavien, 'ak_phomaique': phomaique, 'ak_bobia': bobia,
    'ak_xoaisay': xoaisay, 'ak_banhtrangnuong': banhtrangnuong, 'ak_trungcut': trungcut, 'ak_khoga': khoga,
}

def build():
    return {k: f() for k, f in ICONS.items()}

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), 'out')
    os.makedirs(out, exist_ok=True)
    ims = build()
    sheet = Image.new('RGBA', (34 * len(ims), 34), (250, 240, 220, 255))
    for i, im in enumerate(ims.values()):
        sheet.alpha_composite(im, (i * 34 + 1, 1))
    sheet.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(os.path.join(out, 'xl_sides.png'))
    print('ok', list(ims))
