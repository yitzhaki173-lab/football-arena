"""Turns the checked clue entries (one JSON array per batch) into content-src/players.json.

Entries whose photo may show someone else (photo.identity_ok false) are left out and listed,
and so are photos with visible name text that player-masks.json does not hide yet.
Run: python3 scripts/assemble-players.py batch1.json batch2.json ...
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'content-src')


def main(paths):
    masks = json.load(open(os.path.join(SRC, 'player-masks.json')))
    players, skipped = [], []
    for path in paths:
        for e in json.load(open(path)):
            pid = 'p' + e['file'][:3]
            photo = e.get('photo', {})
            if not photo.get('identity_ok', True):
                skipped.append(f"{e['file']}: photo may not show him ({photo.get('shows', '')})")
                continue
            if photo.get('giveaway_text') and e['file'] not in masks:
                skipped.append(f"{e['file']}: name visible, needs a mask ({photo['giveaway_text']})")
                continue
            players.append({
                'id': pid, 'file': e['file'], 'answer': e['answer'], 'scratch': e['scratch'],
                'topic': e['topic'], 'alt': [t for t in e.get('alt', []) if t != e['topic']],
                'l': e['level'], 'clues': e['clues'], 'w': e['w'],
            })
    ids = {p['id'] for p in players}
    # second photos of a player already in the list: scratch only
    for f in sorted(os.listdir(os.path.join(SRC, 'players-src'))):
        if f[3:4] == 'b' and 'p' + f[:3] in ids:
            players.append({'id': 'p' + f[:4], 'file': f, 'same': 'p' + f[:3]})
    players.sort(key=lambda p: p['id'])
    json.dump(players, open(os.path.join(SRC, 'players.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'{len(players)} entries written, {len(skipped)} left out')
    for s in skipped:
        print('  left out', s)


if __name__ == '__main__':
    main(sys.argv[1:])
