"""Downloads the context picture for every trivia question and records it in content-src/q-images.json.

Input: content-src/q-image-subjects.json, a list of {q, kind, key, fb?} where kind is club, nation,
player or competition, and fb is the competition logo to show when the subject has no picture.
Club ids found on FotMob are kept in content-src/img-ids.json so a wrong match can be fixed by hand.
Output: small WebP files in public/content/img/ and content-src/q-images.json ({q, img, imgKind}).
Run: python3 scripts/fetch-question-images.py
"""
import io
import json
import os
import time
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'content-src')
OUT = os.path.join(ROOT, 'public', 'content', 'img')

LEAGUES = {
    'ucl': 42, 'uel': 73, 'uecl': 10216, 'uefa-super-cup': 74, 'club-wc': 78, 'wc': 77, 'euro': 50,
    'copa': 44, 'afcon': 289, 'nations-league': 9806, 'pl': 47, 'laliga': 87, 'seriea': 55,
    'bundesliga': 54, 'ligue1': 53, 'ligat-haal': 127, 'israel-cup': 9097, 'toto-cup': 127,
    'fa-cup': 132, 'copa-del-rey': 138, 'coppa-italia': 141, 'dfb-pokal': 209, 'olympics': 66,
    'asian-cup': 290,
}
UA = {'User-Agent': 'Mozilla/5.0 (football-arena content build)'}


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def save_webp(data, path, size):
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(path, 'WEBP', quality=82, method=6)


def find_team(name):
    url = 'https://www.fotmob.com/api/data/search/suggest?' + urllib.parse.urlencode({'term': name, 'lang': 'en'})
    groups = json.loads(get(url))
    teams = [s for g in groups for s in g.get('suggestions', []) if s.get('type') == 'team']
    if not teams:
        return None
    exact = [t for t in teams if t['name'].lower() == name.lower()]
    return int((exact or teams)[0]['id'])


def main():
    subjects = json.load(open(os.path.join(SRC, 'q-image-subjects.json')))
    ids_path = os.path.join(SRC, 'img-ids.json')
    ids = json.load(open(ids_path)) if os.path.exists(ids_path) else {}
    os.makedirs(OUT, exist_ok=True)
    out, missing = [], []
    def resolve(kind, key):
        if kind == 'player':
            img = f'./content/players/{key}.webp'
            if not os.path.exists(os.path.join(ROOT, 'public', img[2:])):
                raise ValueError('no such photo')
            return img, 'photo'
        if kind == 'nation':
            name = f'f-{key}.webp'
            if not os.path.exists(os.path.join(OUT, name)):
                save_webp(get(f'https://flagcdn.com/w320/{key}.png'), os.path.join(OUT, name), 320)
            return f'./content/img/{name}', 'flag'
        if kind == 'competition':
            name = f'l-{key}.webp'
            if not os.path.exists(os.path.join(OUT, name)):
                if key not in LEAGUES:
                    raise ValueError('no logo for competition')
                save_webp(get(f'https://images.fotmob.com/image_resources/logo/leaguelogo/dark/{LEAGUES[key]}.png'), os.path.join(OUT, name), 256)
            return f'./content/img/{name}', 'logo'
        if kind == 'club':
            if key not in ids:
                ids[key] = find_team(key)
                time.sleep(0.3)
            tid = ids[key]
            if not tid:
                raise ValueError('club not found on FotMob')
            name = f'c{tid}.webp'
            if not os.path.exists(os.path.join(OUT, name)):
                save_webp(get(f'https://images.fotmob.com/image_resources/logo/teamlogo/{tid}.png'), os.path.join(OUT, name), 256)
            return f'./content/img/{name}', 'logo'
        raise ValueError('unknown kind')

    for s in subjects:
        try:
            img, img_kind = resolve(s['kind'], s['key'])
        except Exception as e:
            missing.append(f"{s['kind']}:{s['key']}: {e}")
            # fb: the competition the question belongs to, shown when the subject has no picture
            if not s.get('fb'):
                continue
            img, img_kind = resolve('competition', s['fb'])
        out.append({'q': s['q'], 'img': img, 'imgKind': img_kind})
    json.dump(ids, open(ids_path, 'w'), ensure_ascii=False, indent=1, sort_keys=True)
    json.dump(out, open(os.path.join(SRC, 'q-images.json'), 'w'), ensure_ascii=False, indent=0)
    print(f'{len(out)} questions with a picture, {len(missing)} without')
    for m in sorted(set(missing)):
        print('  missing', m)


if __name__ == '__main__':
    main()
