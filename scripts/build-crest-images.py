"""Turns the club and national team crests in content-src/crests-src into WebP files for scratch.

Each crest is cut out of its background, trimmed and centred on a transparent square. Words that
name the team are hidden as listed in content-src/crests.json under "mask":
  blur:   [[x0, y0, x1, y1], ...] boxes smoothed into plain colour
  circle: [cx, cy, r]  keep only this disc (drops the ring of words around a round crest)
  ring:   [[cx, cy, r0, r1], ...] smear the band between two circles (words around a round crest)
  erase:  [[cx, cy, r0, r1, top], ...] clear the band between two circles below the line y = top
  crop:   [x0, y0, x1, y1] keep only this part
All numbers are fractions of the trimmed square. Output: public/content/crests/<id>.webp
Run: python3 scripts/build-crest-images.py [ids...]
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'content-src', 'crests-src')
OUT = os.path.join(ROOT, 'public', 'content', 'crests')
SIZE = 512


def cut_background(im):
    """Makes the plain (or fake checkerboard) background around a crest transparent."""
    a = np.array(im.convert('RGBA'))
    rgb = a[:, :, :3].astype(int)
    if (a[:, :, 3] < 16).mean() > 0.02:
        return Image.fromarray(a)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    colours, counts = np.unique(border // 8, axis=0, return_counts=True)
    common = colours[np.argsort(-counts)[:3]] * 8 + 4
    like = np.zeros(rgb.shape[:2], bool)
    for c in common:
        like |= np.abs(rgb - c).max(axis=2) < 28
    grey = (np.abs(rgb - rgb.mean(axis=2, keepdims=True)).max(axis=2) < 10) & (rgb.min(axis=2) > 185)
    like |= grey
    seen = np.zeros_like(like)
    seen[0], seen[-1], seen[:, 0], seen[:, -1] = like[0], like[-1], like[:, 0], like[:, -1]
    while True:
        grow = seen.copy()
        grow[1:] |= seen[:-1]
        grow[:-1] |= seen[1:]
        grow[:, 1:] |= seen[:, :-1]
        grow[:, :-1] |= seen[:, 1:]
        grow &= like
        if (grow == seen).all():
            break
        seen = grow
    alpha = Image.fromarray(np.where(seen, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    a[:, :, 3] = np.minimum(a[:, :, 3], np.array(alpha))
    return Image.fromarray(a)


def square(im, size=SIZE):
    """Trims to the visible crest and centres it on a transparent square."""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 16)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = max(im.size)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    return sq.resize((size, size), Image.LANCZOS)


def smooth(im, frac):
    """Replaces a box with a soft blend of its own colours, so no letter shapes are left."""
    w, h = im.size
    b = (round(frac[0] * w), round(frac[1] * h), round(frac[2] * w), round(frac[3] * h))
    patch = im.crop(b)
    pw, ph = patch.size
    # average colours weighted by alpha, so the see-through area around a crest does not darken it
    pa = np.array(patch).astype(float)
    pa[:, :, :3] *= pa[:, :, 3:4] / 255
    small = (max(1, pw // 24), max(1, ph // 24))
    rad = max(3, min(pw, ph) // 4)

    def soften(ch):
        img = Image.fromarray(np.clip(ch, 0, 255).astype(np.uint8))
        return np.array(img.resize(small, Image.BOX).resize((pw, ph), Image.BILINEAR).filter(ImageFilter.GaussianBlur(rad))).astype(float)

    weight = np.maximum(soften(pa[:, :, 3]), 1)
    rgb = np.stack([soften(pa[:, :, k]) / weight * 255 for k in range(3)], axis=2)
    # letters cut out of the background are shapes in the alpha channel too: melt those into a blob
    # without growing past the crest's edge into the empty area around it
    a = patch.getchannel('A')
    alpha = np.clip(np.array(a.filter(ImageFilter.GaussianBlur(max(3, min(pw, ph) // 3)))).astype(int) * 3, 0, 255)
    quarter = a.resize((max(1, pw // 4), max(1, ph // 4)), Image.BOX)
    grown = quarter.filter(ImageFilter.MaxFilter(max(3, min(pw, ph) // 8) | 1)).resize((pw, ph), Image.BILINEAR)
    near = np.array(grown.filter(ImageFilter.GaussianBlur(3)))
    out = np.dstack([np.clip(rgb, 0, 255), np.minimum(alpha, near)]).astype(np.uint8)
    im.paste(Image.fromarray(out), b)


def prepare(path):
    return square(cut_background(Image.open(path)))


def apply(im, mask):
    w, h = im.size
    if 'circle' in mask:
        cx, cy, r = mask['circle']
        disc = Image.new('L', im.size, 0)
        ImageDraw.Draw(disc).ellipse(((cx - r) * w, (cy - r) * h, (cx + r) * w, (cy + r) * h), fill=255)
        a = np.array(im)
        a[:, :, 3] = np.minimum(a[:, :, 3], np.array(disc))
        im = Image.fromarray(a)
    for cx, cy, r0, r1 in mask.get('ring', []):
        # a ring of words around a round crest: smear it along with its colours
        band = Image.new('L', im.size, 0)
        d = ImageDraw.Draw(band)
        d.ellipse(((cx - r1) * w, (cy - r1) * h, (cx + r1) * w, (cy + r1) * h), fill=255)
        d.ellipse(((cx - r0) * w, (cy - r0) * h, (cx + r0) * w, (cy + r0) * h), fill=0)
        soft = im.filter(ImageFilter.GaussianBlur((r1 - r0) * w * 0.9))
        im = Image.composite(soft, im, band.filter(ImageFilter.GaussianBlur(2)))
    for cx, cy, r0, r1, top in mask.get('erase', []):
        # words standing free around a crest: just take them away
        a = np.array(im)
        yy, xx = np.mgrid[0:h, 0:w]
        dist = np.hypot(xx / w - cx, yy / h - cy)
        a[(dist >= r0) & (dist <= r1) & (yy / h >= top), 3] = 0
        im = Image.fromarray(a)
    for frac in mask.get('blur', []):
        smooth(im, frac)
    if 'crop' in mask:
        x0, y0, x1, y1 = mask['crop']
        im = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    if 'circle' in mask or 'crop' in mask or 'erase' in mask:
        im = square(im)
    return im


def main(only):
    crests = json.load(open(os.path.join(ROOT, 'content-src', 'crests.json')))
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for c in crests:
        if only and c['id'] not in only:
            continue
        im = apply(prepare(os.path.join(SRC, c['file'])), c.get('mask', {}))
        im = im.resize((384, 384), Image.LANCZOS)
        path = os.path.join(OUT, c['id'] + '.webp')
        im.save(path, 'WEBP', quality=82, method=6)
        total += os.path.getsize(path)
    print('total', total // 1024, 'KB', file=sys.stderr)


if __name__ == '__main__':
    main(set(sys.argv[1:]))
