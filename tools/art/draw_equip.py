"""v2.6.9 equipment icons (thiết bị mới), 32×32 in the style of draw_supplies.py / draw_sides.py:
dark-brown 1px outline, light from the top-left, 3-4 tones, white specular dots.
python3 draw_equip.py → tools/art/out/xl_equip.png (preview ×6). pack_icons.py packs them."""
from PIL import Image
import os
from draw_supplies import canvas, px, rect, hline, outline
from draw_sides import ell, GOLD, BROWN, CREAM, ORANGE, GREEN, WHITE, RED

STEEL = [(240, 244, 248), (206, 214, 224), (168, 178, 192), (124, 134, 150)]
DARK = [(110, 116, 130), (80, 86, 100), (56, 60, 72), (36, 40, 50)]
BLUE = [(150, 210, 250), (90, 170, 230), (52, 126, 196), (34, 88, 150)]
MANGO = [(255, 226, 110), (250, 190, 60), (232, 150, 40), (196, 112, 30)]

def box(im, x0, y0, x1, y1, tones):
    """shaded box: light left/top edge, dark right/bottom edge."""
    rect(im, x0, y0, x1, y1, tones[1])
    hline(im, x0, x1, y0, tones[0]); rect(im, x0, y0, x0, y1, tones[0])
    rect(im, x1, y0, x1, y1, tones[2]); hline(im, x0, x1, y1, tones[3] if len(tones) > 3 else tones[2])

def vgrad(im, x0, x1, y, tones):
    w = x1 - x0
    for x in range(x0, x1 + 1):
        u = (x - x0) / max(1, w)
        px(im, x, y, tones[0] if u < 0.18 else tones[1] if u < 0.55 else tones[2] if u < 0.85 else tones[3])

def shaker():                      # hũ lắc inox with a lid and mango pieces seen through the window
    im = canvas()
    for y in range(9, 29):
        half = 8 if y > 11 else 7
        vgrad(im, 16 - half, 16 + half - 1, y, STEEL)
    for y in range(4, 9): vgrad(im, 10, 21, y, DARK if y < 6 else STEEL)
    rect(im, 13, 2, 18, 3, DARK[1]); px(im, 14, 2, DARK[0])
    rect(im, 11, 14, 20, 23, (255, 236, 160))
    for (x, y) in ((12, 15), (15, 17), (18, 15), (13, 20), (17, 21), (19, 18)): rect(im, x, y, x + 1, y + 1, MANGO[2])
    px(im, 14, 16, (226, 67, 59)); px(im, 18, 20, (226, 67, 59))
    hline(im, 8, 23, 12, STEEL[3]); hline(im, 8, 23, 25, STEEL[3])
    px(im, 10, 10, (255, 255, 255)); px(im, 10, 11, (255, 255, 255))
    return outline(im)

def icemaker():                    # máy làm đá: white machine, blue door, ice cubes in front
    im = canvas()
    box(im, 6, 4, 25, 25, WHITE)
    rect(im, 9, 7, 22, 15, BLUE[1]); hline(im, 9, 22, 7, BLUE[0]); rect(im, 22, 7, 22, 15, BLUE[2])
    hline(im, 12, 19, 18, DARK[1]); px(im, 21, 21, (90, 200, 120)); px(im, 21, 22, (90, 200, 120))
    for (x, y) in ((4, 25), (10, 26), (16, 26), (22, 25)):
        rect(im, x, y, x + 4, y + 4, (214, 240, 255)); hline(im, x, x + 4, y, (255, 255, 255)); rect(im, x + 4, y, x + 4, y + 4, (150, 200, 230))
        px(im, x + 1, y + 1, (255, 255, 255))
    return outline(im)

def blender():                     # máy xay sinh tố with a mango smoothie in the jar
    im = canvas()
    for y in range(3, 21):
        half = 6 - (y - 3) // 6
        for x in range(16 - half, 16 + half):
            u = (x - (16 - half)) / (2 * half)
            px(im, x, y, (230, 244, 250) if u < 0.25 else (206, 226, 236))
    for y in range(9, 21):
        half = 6 - (y - 3) // 6
        for x in range(16 - half + 1, 16 + half - 1): px(im, x, y, MANGO[1] if x < 16 else MANGO[2])
    hline(im, 11, 20, 2, DARK[1]); rect(im, 22, 7, 23, 15, (206, 226, 236))
    box(im, 8, 21, 23, 29, RED); rect(im, 14, 24, 17, 26, (255, 236, 160)); px(im, 15, 25, (255, 255, 255))
    px(im, 12, 5, (255, 255, 255)); px(im, 12, 6, (255, 255, 255))
    return outline(im)

def sink():                        # bồn rửa tay inox + vòi + bọt xà phòng
    im = canvas()
    rect(im, 14, 4, 17, 6, STEEL[2]); rect(im, 20, 5, 21, 12, STEEL[2]); hline(im, 16, 21, 4, STEEL[1]); rect(im, 15, 5, 16, 9, STEEL[1])
    for y in range(11, 13): px(im, 15, y, (120, 190, 240))
    for y in range(14, 22):
        half = 12 - (y - 14) // 3
        vgrad(im, 16 - half, 16 + half - 1, y, STEEL)
    hline(im, 4, 27, 14, STEEL[0]); rect(im, 9, 15, 22, 17, (150, 200, 230))
    rect(im, 14, 22, 17, 29, STEEL[2]); hline(im, 10, 21, 29, STEEL[3])
    for (cx, cy, r) in ((8, 8, 2.4), (11, 5, 1.6), (24, 9, 1.8)): ell(im, cx, cy, r, r, WHITE)
    return outline(im)

def pack():                        # máy ép miệng ly: sealed cup on the press
    im = canvas()
    box(im, 5, 4, 26, 9, ORANGE); box(im, 21, 9, 26, 27, ORANGE)
    rect(im, 11, 10, 20, 11, DARK[1])
    for y in range(13, 27):
        half = 5 - (y - 13) // 6
        for x in range(15 - half, 15 + half + 1): px(im, x, y, MANGO[1] if x < 15 else MANGO[2])
    hline(im, 9, 21, 12, (255, 246, 222)); hline(im, 10, 20, 13, (226, 67, 59))
    box(im, 4, 27, 27, 29, DARK); px(im, 12, 16, (255, 255, 255))
    return outline(im)

def tablet():                      # máy tính bảng gọi món on a stand, menu tiles on screen
    im = canvas()
    box(im, 5, 3, 26, 22, DARK)
    rect(im, 7, 5, 24, 20, (250, 246, 236))
    cols = [MANGO[1], (226, 67, 59), (110, 170, 60), (90, 170, 230)]
    for i in range(4):
        x, y = 8 + (i % 2) * 8, 6 + (i // 2) * 7
        rect(im, x, y, x + 6, y + 5, cols[i]); hline(im, x, x + 6, y + 5, (200, 190, 170))
    rect(im, 15, 23, 16, 27, DARK[1]); hline(im, 9, 22, 28, DARK[2]); hline(im, 10, 21, 27, DARK[1])
    px(im, 8, 4, (255, 255, 255))
    return outline(im)

def scale():                       # cân điện tử with a mango on the tray, green digits
    im = canvas()
    for y in range(17, 28): vgrad(im, 5, 26, y, WHITE)
    rect(im, 9, 21, 22, 25, (30, 40, 36)); hline(im, 10, 21, 23, (90, 230, 120))
    for x in (11, 14, 17, 20): px(im, x, 22, (90, 230, 120)); px(im, x, 24, (90, 230, 120))
    hline(im, 3, 28, 15, STEEL[1]); hline(im, 4, 27, 16, STEEL[2])
    ell(im, 16, 9, 7, 5.5, MANGO); rect(im, 15, 2, 16, 4, (110, 70, 40)); ell(im, 19, 4, 2.5, 1.4, GREEN, hl=False)
    return outline(im)

def menuscreen():                  # màn hình menu điện tử: price list + a cup picture
    im = canvas()
    box(im, 2, 5, 29, 24, DARK)
    rect(im, 4, 7, 27, 22, (40, 52, 70))
    for i, y in enumerate((9, 13, 17)):
        hline(im, 6, 15, y, (255, 246, 222)); hline(im, 19, 24, y, (255, 214, 120))
        hline(im, 6, 11, y + 1, (160, 170, 190))
    px(im, 26, 20, (90, 230, 120))
    rect(im, 14, 25, 17, 27, DARK[1]); hline(im, 9, 22, 28, DARK[2])
    px(im, 3, 6, (255, 255, 255))
    return outline(im)

def filt():                        # máy lọc nước RO: tall white unit, blue filter tubes, a glass of water
    im = canvas()
    box(im, 4, 3, 19, 29, WHITE)
    for x in (6, 10, 14):
        rect(im, x, 6, x + 2, 20, BLUE[1]); rect(im, x, 6, x, 20, BLUE[0]); rect(im, x + 2, 6, x + 2, 20, BLUE[2])
    rect(im, 6, 23, 17, 25, (200, 206, 210)); px(im, 7, 24, (90, 200, 120))
    for y in range(17, 29):
        for x in range(21, 28): px(im, x, y, (214, 238, 252) if y > 19 else (240, 248, 252))
    rect(im, 21, 16, 27, 16, (190, 210, 220)); px(im, 22, 21, (255, 255, 255))
    return outline(im)

def moto():                        # xe máy giao hàng with a delivery box
    im = canvas()
    ell(im, 8, 24, 5, 5, DARK); ell(im, 24, 24, 5, 5, DARK)
    ell(im, 8, 24, 2, 2, STEEL, hl=False); ell(im, 24, 24, 2, 2, STEEL, hl=False)
    for x in range(9, 24): px(im, x, 20, RED[2]); px(im, x, 19, RED[1])
    rect(im, 11, 16, 19, 18, RED[1]); hline(im, 11, 19, 16, RED[0])
    rect(im, 20, 10, 21, 19, DARK[1]); hline(im, 19, 24, 9, DARK[2])
    box(im, 3, 7, 14, 15, (255, 206, 90) and GOLD); rect(im, 6, 10, 11, 11, (226, 67, 59))
    px(im, 25, 13, (255, 246, 160)); px(im, 26, 13, (255, 246, 160))
    return outline(im)

def master():                      # bảo trì bậc thầy: golden wrench + star
    im = canvas()
    for i in range(16):
        x, y = 8 + i, 24 - i
        for d in (-1, 0, 1): px(im, x + d, y, GOLD[1] if d < 1 else GOLD[2])
    ell(im, 24, 8, 5, 5, GOLD); ell(im, 26, 6, 2.2, 2.2, [(0, 0, 0, 0)] * 4, hl=False)
    for y in range(4, 9):
        for x in range(25, 30): im.putpixel((x, y), (0, 0, 0, 0)) if (x - 27) ** 2 + (y - 5) ** 2 < 6 else None
    ell(im, 7, 25, 4, 4, GOLD)
    star = [(7, 2), (6, 4), (8, 4), (4, 5), (10, 5), (5, 6), (9, 6), (5, 8), (9, 8), (7, 7), (6, 5), (7, 5), (8, 5), (7, 4), (7, 3), (6, 6), (7, 6), (8, 6)]
    for x, y in star: px(im, x + 1, y + 1, (255, 236, 120))
    return outline(im)

def sinhto():                      # drk_sinhto: tall mango smoothie with a straw
    im = canvas()
    for y in range(9, 30):
        half = 7 - (y - 9) // 7
        for x in range(16 - half, 16 + half):
            u = (x - (16 - half)) / (2 * half)
            px(im, x, y, MANGO[0] if u < 0.25 else MANGO[1] if u < 0.7 else MANGO[2])
    ell(im, 16, 9, 7, 2.6, CREAM, hl=False)
    for y in range(1, 10): px(im, 20 + (9 - y) // 3, y, (226, 67, 59))
    rect(im, 12, 6, 13, 7, GREEN[1]); px(im, 11, 13, (255, 255, 255)); px(im, 11, 14, (255, 255, 255))
    return outline(im)

ICONS = {'eq_shaker': shaker, 'eq_ice': icemaker, 'eq_blender': blender, 'eq_sink': sink, 'eq_pack': pack, 'eq_tablet': tablet,
         'eq_scale': scale, 'eq_menuscreen': menuscreen, 'eq_filter': filt, 'eq_moto': moto, 'eq_master': master, 'drk_sinhto': sinhto}

def build():
    return {k: f() for k, f in ICONS.items()}

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), 'out')
    os.makedirs(out, exist_ok=True)
    ims = build()
    sheet = Image.new('RGBA', (34 * len(ims), 34), (250, 240, 220, 255))
    for i, im in enumerate(ims.values()):
        sheet.alpha_composite(im, (i * 34 + 1, 1))
    sheet.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(os.path.join(out, 'xl_equip.png'))
    print('ok', list(ims))
