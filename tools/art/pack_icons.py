"""Append code-drawn icons to web/<game>/assets/icons.png + src/art/data/icons.js without touching existing frames.
Usage: python3 pack_icons.py xoailac   (re-running replaces only the frames it owns)."""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from draw_supplies import build as build_supplies
from draw_sides import build as build_sides

def build():
    out = build_supplies()
    out.update(build_sides())      # v2.5 món ăn kèm
    return out

game = sys.argv[1] if len(sys.argv) > 1 else 'xoailac'
root = os.path.join(os.path.dirname(__file__), '..', '..', 'web', game)
png = os.path.join(root, 'assets', 'icons.png')
js = os.path.join(root, 'src', 'art', 'data', 'icons.js')
src = open(js).read()
head, body = src[:src.index('{')], src[src.index('{'):src.rindex('}') + 1]
tail = src[src.rindex('}') + 1:]
data = json.loads(body)
fr = data['frames']
atlas = Image.open(png).convert('RGBA')
before = {k: atlas.crop((v[0], v[1], v[0] + v[2], v[1] + v[3])).tobytes() for k, v in fr.items()}
icons = build()
for k in icons:
    fr.pop(k, None)
mine_y = max(v[1] + v[3] for v in fr.values()) + 2       # first free row under the existing frames
x, y = 1, mine_y
for k, im in icons.items():
    if x + 32 > atlas.width:
        x, y = 1, y + 33
    if y + 32 > atlas.height:
        raise SystemExit('atlas full')
    atlas.paste(Image.new('RGBA', (32, 32), (0, 0, 0, 0)), (x, y))
    atlas.alpha_composite(im, (x, y))
    fr[k] = [x, y, 32, 32, 16, 16]
    x += 33
# old frames must be untouched
for k, b in before.items():
    if k in icons: continue
    v = fr[k]
    assert atlas.crop((v[0], v[1], v[0] + v[2], v[1] + v[3])).tobytes() == b, 'changed ' + k
atlas.save(png)
open(js, 'w').write(head + json.dumps(data, separators=(',', ':')) + tail)
print('packed', list(icons), 'at y', mine_y)
