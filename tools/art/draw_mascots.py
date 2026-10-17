"""v2.6.20 linh vật cho logo quán (brand designer), 32×32 in the house icon style:
dark-brown 1px outline, light from the top-left, cute faces (2px eyes + white catchlight, pink blush).
python3 draw_mascots.py → tools/art/out/xl_mascots.png (preview ×6). pack_icons.py packs them."""
from PIL import Image
import os
from draw_supplies import canvas, px, rect, hline, outline
from draw_sides import ell, GOLD, GREEN, WHITE

EYE = (44, 30, 26); BLUSH = (255, 150, 160); MOUTH = (120, 50, 40)
ORANGE = [(255, 200, 120), (246, 160, 70), (220, 120, 44), (176, 86, 30)]
PINK = [(255, 214, 222), (250, 180, 196), (228, 140, 162), (190, 104, 128)]
YEL = [(255, 244, 150), (255, 222, 90), (240, 190, 50), (204, 150, 30)]
TAN = [(236, 204, 160), (214, 172, 120), (184, 138, 90), (146, 104, 64)]
GREY = [(170, 170, 178), (136, 136, 148), (104, 104, 118), (76, 76, 90)]
MANGO = [(255, 226, 110), (250, 190, 60), (232, 150, 40), (196, 112, 30)]

def face(im, cx, ey, gap=4, my=None, blush=True):
    for sx in (cx - gap, cx + gap - 2):
        rect(im, sx, ey, sx + 1, ey + 2, EYE); px(im, sx, ey, (255, 255, 255))
    if blush:
        hline(im, cx - gap - 3, cx - gap - 2, ey + 3, BLUSH); hline(im, cx + gap + 1, cx + gap + 2, ey + 3, BLUSH)
    m = ey + 3 if my is None else my
    px(im, cx - 2, m, MOUTH); px(im, cx - 1, m + 1, MOUTH); px(im, cx, m, MOUTH)

def meo():                       # mèo mướp cam
    im = canvas()
    for i in range(7):           # pointy ears (triangles)
        hline(im, 6, 6 + i, 3 + i, ORANGE[1]); hline(im, 25 - i, 25, 3 + i, ORANGE[2])
        if 2 <= i <= 5: hline(im, 7, 6 + i - 1, 3 + i, PINK[1]); hline(im, 25 - i + 1, 24, 3 + i, PINK[1])
    ell(im, 16, 18, 11, 9.5, ORANGE)
    for x in (13, 16, 19): rect(im, x, 9, x, 11, ORANGE[3])        # forehead stripes
    ell(im, 16, 22, 4.5, 3, [(255, 244, 228), (255, 238, 214), (240, 220, 196), (230, 206, 180)], hl=False)
    face(im, 16, 16, gap=5, my=21)
    px(im, 15, 20, PINK[2]); px(im, 16, 20, PINK[2])
    for y in (19, 21): hline(im, 3, 7, y, (90, 60, 50)); hline(im, 24, 28, y, (90, 60, 50))   # whiskers
    return outline(im)

def cun():                       # cún tai cụp
    im = canvas()
    ell(im, 16, 17, 10, 10, TAN)
    ell(im, 6, 15, 3.5, 7, [(150, 100, 60)] * 2 + [(120, 80, 46)] * 2, hl=False)
    ell(im, 26, 15, 3.5, 7, [(150, 100, 60)] * 2 + [(120, 80, 46)] * 2, hl=False)
    ell(im, 16, 22, 5.5, 4, WHITE)
    rect(im, 14, 19, 17, 20, EYE); px(im, 14, 19, (120, 120, 120))
    face(im, 16, 13, gap=5, my=23)
    rect(im, 20, 9, 23, 12, (150, 100, 60))                        # patch over the eye
    rect(im, 20, 13, 21, 15, EYE); px(im, 20, 13, (255, 255, 255))
    return outline(im)

def ga():                        # gà con
    im = canvas()
    ell(im, 16, 18, 10, 10, YEL)
    rect(im, 15, 5, 16, 8, YEL[2]); px(im, 14, 6, YEL[2]); px(im, 17, 5, YEL[2])   # tuft
    face(im, 16, 14, gap=5, my=99)
    for i in range(3): hline(im, 14 - 0 + i // 2, 18 - i, 18 + i, (250, 140, 40))   # beak
    ell(im, 7, 21, 3, 4, YEL, hl=False); ell(im, 25, 21, 3, 4, YEL, hl=False)        # wings
    rect(im, 12, 28, 13, 29, (250, 140, 40)); rect(im, 19, 28, 20, 29, (250, 140, 40))
    return outline(im)

def xoai():                      # bé xoài
    im = canvas()
    for y in range(6, 30):
        t = (y - 6) / 23
        half = 9.5 * max(0.0, 1 - (2 * t - 0.95) ** 2) ** 0.5 + 1.5
        cx = 16 + 2.5 * (t - 0.5)
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - (cx - half)) / (2 * half)
            px(im, x, y, MANGO[0] if u < 0.22 and t < 0.6 else MANGO[1] if u < 0.6 else MANGO[2] if u < 0.85 else MANGO[3])
    for (x, y) in ((22, 22), (23, 24), (21, 26)): px(im, x, y, (240, 120, 50))
    rect(im, 15, 2, 16, 6, (110, 80, 40))                          # stem
    for i in range(5): hline(im, 17 + i // 2, 19 + i, 4 - i // 2 + 1, GREEN[1])   # leaf
    hline(im, 18, 22, 3, GREEN[0])
    face(im, 16, 15, gap=4, my=19)
    px(im, 10, 9, (255, 255, 255)); px(im, 10, 10, (255, 255, 255))
    return outline(im)

def heo():                       # heo hồng
    im = canvas()
    for i in range(4): hline(im, 7 + i // 2, 10, 6 + i, PINK[2]); hline(im, 21, 24 - i // 2, 6 + i, PINK[2])
    ell(im, 16, 18, 11, 9.5, PINK)
    ell(im, 16, 21, 4.5, 3, [PINK[2], PINK[2], PINK[3], PINK[3]], hl=False)
    rect(im, 14, 20, 14, 22, (150, 70, 92)); rect(im, 17, 20, 17, 22, (150, 70, 92))
    face(im, 16, 14, gap=5, my=99)
    return outline(im)

def tho():                       # thỏ trắng
    im = canvas()
    for y in range(1, 13):
        hline(im, 9, 12, y, WHITE[1]); hline(im, 19, 22, y, WHITE[1])
        if 3 <= y <= 11: hline(im, 10, 11, y, PINK[1]); hline(im, 20, 21, y, PINK[1])
    ell(im, 16, 20, 10, 9, WHITE)
    face(im, 16, 18, gap=5, my=23)
    px(im, 15, 22, PINK[2]); px(im, 16, 22, PINK[2])
    return outline(im)

def trau():                      # trâu con (đồng quê)
    im = canvas()
    for i in range(6):            # horns curving up
        px(im, 4 + i // 2, 9 - i, (236, 228, 210)); px(im, 5 + i // 2, 9 - i, (236, 228, 210))
        px(im, 27 - i // 2, 9 - i, (236, 228, 210)); px(im, 26 - i // 2, 9 - i, (236, 228, 210))
    ell(im, 16, 16, 10, 9, GREY)
    ell(im, 4, 13, 3, 2, GREY, hl=False); ell(im, 28, 13, 3, 2, GREY, hl=False)
    ell(im, 16, 23, 7, 5, [(200, 180, 176), (186, 164, 160), (160, 140, 136), (136, 116, 112)])
    rect(im, 12, 22, 13, 23, (70, 50, 50)); rect(im, 19, 22, 20, 23, (70, 50, 50))
    face(im, 16, 12, gap=5, my=99)
    return outline(im)

def sao():                       # ngôi sao cười
    im = canvas()
    import math
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = 14 if k % 2 == 0 else 6.5
        pts.append((16 + r * math.cos(a), 17 + r * math.sin(a)))
    for y in range(32):
        for x in range(32):
            inside = False; j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i]; xj, yj = pts[j]
                if (yi > y + 0.5) != (yj > y + 0.5) and x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi: inside = not inside
                j = i
            if inside:
                l = (x - 16) + (y - 17)
                px(im, x, y, YEL[0] if l < -8 else YEL[1] if l < 4 else YEL[2])
    face(im, 16, 15, gap=4, my=19)
    return outline(im)

ICONS = {'mas_meo': meo, 'mas_cun': cun, 'mas_ga': ga, 'mas_xoai': xoai, 'mas_heo': heo, 'mas_tho': tho, 'mas_trau': trau, 'mas_sao': sao}

def build():
    return {k: f() for k, f in ICONS.items()}

if __name__ == '__main__':
    out = build()
    sheet = Image.new('RGBA', (34 * len(out), 34), (255, 248, 236, 255))
    for i, im in enumerate(out.values()): sheet.alpha_composite(im, (1 + 34 * i, 1))
    os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
    sheet.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(os.path.join(os.path.dirname(__file__), 'out', 'xl_mascots.png'))
    print('ok', list(out))
