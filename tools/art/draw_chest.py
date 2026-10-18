"""v2.6.24 ui_chest_diamond: the gold chest recoloured to icy blue/cyan with white sparkles (Rương kim cương).
Reads ui_chest_gold from the packed atlas; pack_icons.py packs the result."""
import colorsys, json, os
from PIL import Image

def build():
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'xoailac')
    js = open(os.path.join(root, 'src', 'art', 'data', 'icons.js')).read()
    fr = json.loads(js[js.index('{'):js.rindex('}') + 1])['frames']['ui_chest_gold']
    src = Image.open(os.path.join(root, 'assets', 'icons.png')).convert('RGBA').crop((fr[0], fr[1], fr[0] + fr[2], fr[1] + fr[3]))
    if src.size != (32, 32): src = src.resize((32, 32), Image.NEAREST)
    out = src.copy(); px = out.load()
    for y in range(32):
        for x in range(32):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if s > 0.3 and (h > 0.9 or h <= 0.02):     # red wood → deep violet-blue
                rr, gg, bb = colorsys.hls_to_rgb(0.68, l * 0.85, s * 0.7)
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a); continue
            if s > 0.25 and 0.02 < h < 0.2:            # golds / oranges → diamond blue
                h = 0.53 + (h - 0.1) * 0.4
                l = min(1, l * 1.05)
                rr, gg, bb = colorsys.hls_to_rgb(h, l, min(1, s * 0.9))
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    for (x, y) in ((6, 5), (25, 7), (27, 22)):            # sparkles
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < 32 and 0 <= y + dy < 32: px[x + dx, y + dy] = (255, 255, 255, 255)
    return {'ui_chest_diamond': out}

if __name__ == '__main__':
    im = build()['ui_chest_diamond']
    os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
    im.resize((192, 192), Image.NEAREST).save(os.path.join(os.path.dirname(__file__), 'out', 'xl_chest_diamond.png'))
