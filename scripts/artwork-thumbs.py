#!/usr/bin/env python3
"""Make the gallery thumbnails Commons cannot make small.

Commons renders a PNG upload only as another PNG: the 330px manuscript scans in the
galleries weigh 300-370 KB each, and about 200 KB even at Commons' own 250px width. Our
server cannot resize them either (Commons answers its fetches with 429). So this runs on a
laptop: it reads the artworks whose image is a Commons PNG upload from the local library,
fetches Commons' own 330px rendering of each once (250px where the upload is narrower; the
uploads themselves are refused after a handful, the standard renderings are what Commons
asks robots to use), and writes a WebP of at most 320px to
apps/web/public/artworks/<id>.webp (about 20 KB), plus the list of ids the gallery reads
(apps/web/lib/artwork-thumbs.ts). Files already made are kept, so a re-run only adds new ones.

    python3 scripts/artwork-thumbs.py            # needs psql, python3 with Pillow
    python3 scripts/artwork-thumbs.py --dry-run  # only say what it would fetch
    python3 scripts/artwork-thumbs.py --no-fetch # only rewrite the list from the files here

Commit what it writes. An artwork without a file here still loads Commons' 250px rendering.
Commons limits robots hard (HTTP 429 after a handful of files, for an hour or more): the script
waits and retries, and a run cut short loses nothing, so run it again later for the rest.
"""
import io
import os
import subprocess
import sys
import re
import time
import urllib.error
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'apps', 'web', 'public', 'artworks')
MANIFEST = os.path.join(ROOT, 'apps', 'web', 'lib', 'artwork-thumbs.ts')
DATABASE = os.environ.get('ARTWORKS_DATABASE_URL', 'postgresql://localhost:5432/irs_az')
WIDTH = 320
AGENT = 'kitabxana-artwork-thumbs/1.0 (one-off thumbnail build)'


def rendering(url: str, width: int) -> str:
    """.../commons/a/ab/Name.png -> .../commons/thumb/a/ab/Name.png/330px-Name.png"""
    base, shard, name = re.match(r'(.*/commons)/([0-9a-f]/[0-9a-f]{2})/([^/]+)$', url).groups()
    return f'{base}/thumb/{shard}/{name}/{width}px-{name}'


def fetch(url: str) -> bytes:
    """The widest standard rendering Commons has; waits and tries again when told to slow down"""
    for width in (330, 250):
        for attempt in range(4):
            try:
                request = urllib.request.Request(rendering(url, width), headers={'User-Agent': AGENT})
                with urllib.request.urlopen(request, timeout=60) as response:
                    return response.read()
            except urllib.error.HTTPError as error:
                if error.code != 429:
                    break  # no rendering at this width (the upload is narrower): try the next
                time.sleep(int(error.headers.get('Retry-After') or 0) or 30 * (attempt + 1))
    raise RuntimeError('no 330px or 250px rendering to be had')


QUERY = """
select id, split_part(coalesce("imageSmallUrl", "imageUrl"), '?', 1)
from "Artwork"
where coalesce("imageSmallUrl", "imageUrl") ~ '^https://upload\\.wikimedia\\.org/wikipedia/commons/[0-9a-f]/[0-9a-f]{2}/[^/]+\\.png(\\?.*)?$'
order by id
"""


def main() -> int:
    dry = '--dry-run' in sys.argv
    no_fetch = '--no-fetch' in sys.argv
    rows = subprocess.run(['psql', DATABASE, '-At', '-F', '\t', '-c', QUERY], check=True, capture_output=True, text=True).stdout
    works = [line.split('\t') for line in rows.splitlines() if line]
    os.makedirs(OUT, exist_ok=True)
    made, kept, failed = 0, 0, []
    for art_id, url in works:
        path = os.path.join(OUT, f'{art_id}.webp')
        if os.path.exists(path):
            kept += 1
            continue
        if dry or no_fetch:
            if dry:
                print('would fetch', url)
            continue
        try:
            image = Image.open(io.BytesIO(fetch(url)))
            image = image.convert('RGBA' if image.mode in ('RGBA', 'LA', 'P') else 'RGB')
            if image.width > WIDTH:
                image = image.resize((WIDTH, round(image.height * WIDTH / image.width)), Image.Resampling.LANCZOS)
            image.save(path, 'WEBP', quality=80, method=6)
            made += 1
        except Exception as error:  # one bad file must not stop the rest
            failed.append(f'{art_id} {url}: {error}')
        time.sleep(2)  # unhurried: Commons limits robots that are not

    ids = sorted(name[:-5] for name in os.listdir(OUT) if name.endswith('.webp'))
    if not dry:
        with open(MANIFEST, 'w') as out:
            out.write('// Written by scripts/artwork-thumbs.py: artworks whose gallery thumbnail is a file of ours\n')
            out.write('// (public/artworks/<id>.webp) because Commons can only serve their PNG at full weight.\n')
            out.write('export const ARTWORK_THUMBS: ReadonlySet<string> = new Set([\n')
            out.writelines(f"  '{art_id}',\n" for art_id in ids)
            out.write(']);\n')
    print(f'{len(works)} PNG uploads: {made} made, {kept} already here, {len(failed)} failed; {len(ids)} thumbnails in all')
    for line in failed:
        print('FAILED', line)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
