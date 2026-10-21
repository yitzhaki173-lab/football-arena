"""Turns the player photos in content-src/players-src into small WebP files for the app.

Text that names the player (shirt backs, captions) is blurred out and some photos are
cropped, as listed in content-src/player-masks.json. Output: public/content/players/p<NNN>.webp
Run: python3 scripts/build-player-images.py
"""
import json
import os
import re
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'content-src', 'players-src')
OUT = os.path.join(ROOT, 'public', 'content', 'players')
MAX_SIDE = 900


def image_id(name):
    m = re.match(r'(\d{3}b?)_', name)
    return 'p' + m.group(1) if m else None


def box(frac, w, h):
    x0, y0, x1, y1 = frac
    return (round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))


def main():
    masks = json.load(open(os.path.join(ROOT, 'content-src', 'player-masks.json')))
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name in sorted(os.listdir(SRC)):
        pid = image_id(name)
        if not pid:
            continue
        im = Image.open(os.path.join(SRC, name)).convert('RGB')
        w, h = im.size
        rule = masks.get(name, {})
        for frac in rule.get('blur', []):
            b = box(frac, w, h)
            patch = im.crop(b)
            radius = max(8, (b[3] - b[1]) // 2)
            im.paste(patch.filter(ImageFilter.GaussianBlur(radius)), b)
        if 'crop' in rule:
            im = im.crop(box(rule['crop'], w, h))
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        path = os.path.join(OUT, pid + '.webp')
        im.save(path, 'WEBP', quality=70, method=6)
        total += os.path.getsize(path)
        print(pid, name, im.size, os.path.getsize(path) // 1024, 'KB')
    print('total', total // 1024, 'KB', file=sys.stderr)


if __name__ == '__main__':
    main()
