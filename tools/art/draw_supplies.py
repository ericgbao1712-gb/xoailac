"""Code-drawn pixel icons for Xoài Lắc v2 (vật tư, price tag), 32×32, matched to assets/icons.png:
dark-brown 1px outline (74,46,38), light from the top-left, 3-4 tone shading, white specular dots.
Writes tools/art/out/xl_supplies.png (preview sheet ×6) and returns the frames to pack_icons()."""
from PIL import Image
import os

OL = (74, 46, 38, 255)
T = (0, 0, 0, 0)

def canvas():
    return Image.new('RGBA', (32, 32), T)

def px(im, x, y, c):
    if 0 <= x < 32 and 0 <= y < 32:
        im.putpixel((int(x), int(y)), c if len(c) == 4 else c + (255,))

def rect(im, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(im, x, y, c)

def hline(im, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        px(im, x, y, c)

def outline(im, col=OL):
    """1px outline around every opaque region (4-neighbour), drawn on transparent pixels."""
    src = im.copy()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            if src.getpixel((x, y))[3] > 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and 0 <= yy < H and src.getpixel((xx, yy))[3] > 0:
                    im.putpixel((x, y), col)
                    break
    return im

def shade_rows(im, x0, x1, y0, y1, fn):
    """fn(x, y, u, v) -> colour or None for a box; u,v in 0..1"""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            v = (y - y0) / max(1, y1 - y0)
            c = fn(x, y, u, v)
            if c:
                px(im, x, y, c)

# ───────────────────────── ly lắc (stack of lidded cups) ─────────────────────────
def cup_shape(im, cx, top, bot, wt, wb, body, lid=True):
    clear = [(236, 244, 248), (214, 228, 236), (190, 206, 218), (160, 178, 194)]
    for y in range(top, bot + 1):
        v = (y - top) / max(1, bot - top)
        half = (wt + (wb - wt) * v) / 2
        x0, x1 = round(cx - half), round(cx + half) - 1
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            c = clear[0] if u < 0.2 else clear[1] if u < 0.55 else clear[2] if u < 0.85 else clear[3]
            px(im, x, y, c)
    return

def ly_lac():
    im = canvas()
    # back cup (stack peeks behind), front cup
    cup_shape(im, 13, 9, 27, 18, 13, None)
    cup_shape(im, 19, 7, 28, 19, 14, None)
    # rims of stacked cups on the front one
    for y in (12, 15):
        hline(im, 11, 27, y, (244, 250, 252))
    # dome lid on the front cup
    lid = [(250, 252, 253), (226, 236, 242), (196, 212, 224)]
    for y in range(2, 8):
        w = [6, 10, 14, 16, 18, 20][y - 2]
        x0 = 19 - w // 2
        for x in range(x0, x0 + w):
            u = (x - x0) / max(1, w - 1)
            px(im, x, y, lid[0] if u < 0.3 else lid[1] if u < 0.75 else lid[2])
    hline(im, 8, 29, 7, (180, 198, 212))                     # lid rim
    px(im, 18, 1, (226, 236, 242)); px(im, 19, 1, (226, 236, 242))   # straw hole nub
    # little orange label sticker (shop logo)
    rect(im, 16, 18, 21, 22, (240, 191, 52)); hline(im, 16, 21, 22, (217, 158, 40)); px(im, 17, 19, (255, 236, 160))
    px(im, 19, 20, (98, 140, 40)); px(im, 20, 19, (98, 140, 40))
    outline(im)
    # speculars after the outline
    for y in range(9, 26, 1):
        if y % 5 != 0: px(im, 12, y + 1, (255, 255, 255)) if y < 22 else None
    px(im, 13, 4, (255, 255, 255)); px(im, 14, 3, (255, 255, 255))
    return im

# ───────────────────────── hộp giấy (kraft takeaway box) ─────────────────────────
def hop_giay():
    im = canvas()
    k = [(232, 186, 122), (214, 160, 96), (189, 132, 74), (160, 106, 58)]
    # body: trapezoid, front face + right side face
    for y in range(12, 29):
        v = (y - 12) / 16
        x0 = round(5 + v * 2); x1 = round(21 - v * 1)
        for x in range(x0, x1 + 1):
            px(im, x, y, k[0] if x < x0 + 3 else k[1])
        for x in range(x1 + 1, round(27 - v * 1) + 1):
            px(im, x, y, k[2] if x < x1 + 4 else k[3])
    # open flaps on top
    for i, (a, b) in enumerate(((4, 9), (21, 12))):
        pass
    flapF = [(240, 200, 140), (222, 174, 108)]
    for y in range(6, 12):
        w = 16 - (11 - y)
        for x in range(4 + (11 - y), 4 + (11 - y) + w):
            px(im, x, y, flapF[0] if y < 9 else flapF[1])
    for y in range(4, 12):
        for x in range(22, 29):
            if x - 22 <= (y - 4) + 1:
                px(im, x, y, k[2])
    hline(im, 5, 27, 12, k[3])                                   # fold line
    # green leaf print + "XL" stamp
    for (x, y) in ((10, 18), (11, 17), (12, 17), (12, 18), (11, 19), (13, 16)):
        px(im, x, y, (98, 140, 40))
    px(im, 11, 18, (150, 196, 70))
    rect(im, 14, 20, 18, 22, (215, 87, 16)); hline(im, 14, 18, 22, (178, 60, 14)); px(im, 15, 20, (240, 140, 80))
    outline(im)
    px(im, 7, 14, (250, 222, 170)); px(im, 7, 15, (250, 222, 170)); px(im, 8, 13, (250, 222, 170))
    return im

# ───────────────────────── ly nhựa đựng nước (clear cup + straw) ─────────────────────────
def ly_nuoc():
    im = canvas()
    # straw: red/white stripes, leaning
    for i in range(0, 14):
        x, y = 21 + i // 3, 1 + i
        c = (226, 60, 52) if (i // 2) % 2 == 0 else (250, 246, 240)
        px(im, x, y, c); px(im, x + 1, y, c)
    cup_shape(im, 15, 9, 29, 19, 13, None)
    # back cup of the stack (sleeve)
    for y in range(13, 29):
        px(im, 23 + (y - 13) // 6, y, (190, 206, 218))
    hline(im, 6, 24, 9, (246, 250, 252)); hline(im, 6, 24, 10, (176, 194, 208))
    # straw inside the cup (seen through)
    for y in range(11, 22):
        px(im, 19 + (y - 11) // 4, y, (236, 150, 140))
    outline(im)
    for y in range(12, 26, 3):
        px(im, 8, y, (255, 255, 255))
    px(im, 9, 12, (255, 255, 255))
    return im

# ───────────────────────── que xiên tre (tied bundle) ─────────────────────────
def xien():
    im = canvas()
    bam = [(246, 222, 160), (226, 196, 128), (196, 160, 96)]
    for k in range(6):
        ox = k - 2
        for t in range(0, 26):
            x = 5 + t + ox * 0 + (k % 3)
            y = 27 - t + (k // 3) - (k % 3)
            c = bam[0] if k in (0, 3) else bam[1] if k in (1, 4) else bam[2]
            if t < 2:
                c = (178, 140, 86)                                  # pointed tips darker
            px(im, x + ox, y + 1, c)
    # red string tie
    for t in range(-3, 4):
        px(im, 15 + t, 15 + t, (215, 59, 51)); px(im, 16 + t, 15 + t, (179, 54, 43))
    px(im, 19, 12, (239, 95, 88)); px(im, 20, 11, (215, 59, 51)); px(im, 21, 12, (215, 59, 51))
    outline(im)
    return im

# ───────────────────────── đũa tre (pair in a paper sleeve) ─────────────────────────
def dua():
    im = canvas()
    bam = [(246, 222, 160), (214, 182, 118)]
    for t in range(0, 26):
        px(im, 4 + t, 28 - t, bam[0]); px(im, 5 + t, 28 - t, bam[1])
        px(im, 6 + t, 29 - t, bam[0]); px(im, 7 + t, 29 - t, bam[1])
    # paper sleeve (red with white band)
    for t in range(4, 15):
        for w in range(0, 5):
            x, y = 3 + t + w, 30 - t - 1 + (w - 2) // 2 + w // 3
            c = (226, 70, 60) if t % 6 not in (2, 3) else (250, 244, 236)
            if w == 0: c = (240, 110, 96) if c != (250, 244, 236) else (255, 255, 255)
            if w == 4: c = (170, 46, 40) if c != (250, 244, 236) else (222, 210, 200)
            px(im, x, y - 1, c)
    outline(im)
    return im

# ───────────────────────── túi quai xách (plastic bag) ─────────────────────────
def tui():
    im = canvas()
    bag = [(255, 250, 246), (246, 232, 230), (226, 206, 206), (200, 176, 180)]
    # handles
    for y in range(3, 11):
        for x in (8, 9, 22, 23):
            pass
    for t in range(0, 9):
        import math
        a = math.pi * t / 8
        hx = 11 + round(4 * math.cos(a) * -1) if False else None
    for (cx) in (11, 20):
        for t in range(0, 13):
            import math
            a = math.pi * t / 12
            x = cx + round(-3.5 * math.cos(a)); y = 10 - round(6 * math.sin(a))
            px(im, x, y, bag[1]); px(im, x, y + 1, bag[2])
    # body with soft crinkles
    for y in range(10, 30):
        v = (y - 10) / 19
        x0 = round(6 - 2 * v); x1 = round(25 + 2 * v)
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            c = bag[0] if u < 0.25 else bag[1] if u < 0.65 else bag[2] if u < 0.9 else bag[3]
            if (x + y * 2) % 11 == 0 and 0.3 < u < 0.8: c = bag[2]
            px(im, x, y, c)
    # red "Cảm ơn" smiley print
    for (x, y) in ((13, 18), (18, 18), (12, 21), (13, 22), (14, 23), (15, 23), (16, 23), (17, 22), (18, 21)):
        px(im, x, y, (215, 59, 51))
    hline(im, 11, 20, 26, (239, 95, 88))
    outline(im)
    px(im, 8, 13, (255, 255, 255)); px(im, 8, 14, (255, 255, 255)); px(im, 9, 12, (255, 255, 255))
    return im

# ───────────────────────── khăn giấy (napkin stack) ─────────────────────────
def khan():
    im = canvas()
    sheet = [(255, 255, 255), (240, 238, 236), (220, 214, 210)]
    for i in range(5):
        y0 = 22 - i * 3
        for y in range(y0, y0 + 4):
            for x in range(4 + (y - y0), 27 + (y - y0) // 2):
                px(im, x, y, sheet[1] if y > y0 else sheet[0])
        hline(im, 5, 27, y0 + 3, (236, 160, 170))               # pink edge line of each napkin
    # top napkin folded corner
    for y in range(7, 12):
        for x in range(20 + (y - 7), 27):
            px(im, x, y, sheet[2] if x - 20 < y - 5 else sheet[1])
    # small flower print
    for (x, y) in ((10, 11), (11, 10), (12, 11), (11, 12)):
        px(im, x, y, (239, 120, 150))
    px(im, 11, 11, (240, 191, 52))
    outline(im)
    return im

# ───────────────────────── price tag ─────────────────────────
def tag():
    im = canvas()
    g = [(255, 224, 120), (240, 191, 52), (217, 158, 40), (188, 130, 30)]
    # tag body rotated ~45°: a diamond-ish pentagon
    for y in range(4, 29):
        for x in range(3, 29):
            # inside a rotated rect with a cut corner at the top-left (the string hole end)
            a = (x - y)                     # along the diagonal
            b = (x + y)
            if -9 <= a <= 9 and 14 <= b <= 50 and not (b < 20 and abs(a) > 20 - b + 6):
                u = (a + 9) / 18
                c = g[0] if u < 0.25 else g[1] if u < 0.6 else g[2] if u < 0.85 else g[3]
                px(im, x, y, c)
    # hole + string
    for (x, y) in ((10, 10), (11, 10), (10, 11), (11, 11)):
        px(im, x, y, T)
    for t in range(6):
        px(im, 10 - t, 9 - t // 2, (215, 59, 51))
    # "k" glyph
    for (x, y) in ((17, 15), (17, 16), (17, 17), (17, 18), (17, 19), (18, 17), (19, 16), (20, 15), (19, 18), (20, 19)):
        px(im, x, y, (130, 70, 20))
    outline(im)
    px(im, 9, 15, (255, 246, 200)); px(im, 10, 16, (255, 246, 200))
    return im

ICONS = {
    'sup_lylac': ly_lac, 'sup_hop': hop_giay, 'sup_lynuoc': ly_nuoc, 'sup_xien': xien, 'sup_dua': dua,
    'sup_tui': tui, 'sup_khan': khan, 'ui_tag': tag,
}

def build():
    return {k: f() for k, f in ICONS.items()}

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), 'out')
    os.makedirs(out, exist_ok=True)
    ims = build()
    sheet = Image.new('RGBA', (34 * len(ims), 34), (200, 230, 200, 255))
    for i, im in enumerate(ims.values()):
        sheet.alpha_composite(im, (i * 34 + 1, 1))
    sheet.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(os.path.join(out, 'xl_supplies.png'))
    print('ok', list(ims))
