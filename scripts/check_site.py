"""Validate the published static files. No packages or Anki access required."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
SITE = 'https://dkpolish.github.io/dk-polish/'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.references, self.remote_images, self.canonical = [], [], set(), []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('href', 'src', 'data-light-src', 'data-dark-src'):
            if attrs.get(key):
                self.references.append(attrs[key])
                if (tag == 'img' or key.startswith('data-')) and attrs[key].startswith('https://'):
                    self.remote_images.add(attrs[key])
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name') == 'robots':
            assert 'noindex' not in attrs.get('content', '').lower(), 'Site must remain indexable'

page = Page()
page.feed((DOCS / 'index.html').read_text(encoding='utf-8'))
assert len(page.ids) == len(set(page.ids)), 'Duplicate HTML IDs'
assert page.canonical == [SITE], 'Canonical URL changed or missing'

def local_reference(base, value):
    url = urlparse(value)
    if url.scheme or url.netloc:
        return
    target = (base / unquote(url.path)).resolve()
    assert target.is_relative_to(ROOT), f'Link outside repository: {value}'
    assert target.exists(), f'Missing link or asset: {value}'
    if not url.path and url.fragment and base == DOCS:
        assert unquote(url.fragment) in page.ids, f'Missing page anchor: {value}'

for value in page.references:
    local_reference(DOCS, value)
for path in ROOT.rglob('*.md'):
    if any(part in ('node_modules', 'playwright-report', 'test-results', '.git') for part in path.parts):
        continue
    text = path.read_text(encoding='utf-8')
    for value in re.findall(r'\]\(([^\s)]+)(?:\s+"[^"]*")?\)', text) + re.findall(r'(?:src|href)="([^"]+)"', text):
        local_reference(path.parent, value)

vocabulary = json.loads((DOCS / 'assets/vocabulary.js').read_text(encoding='utf-8').split('=', 1)[1].rstrip(';\n'))
words = vocabulary['words']
assert words and len({word['id'] for word in words}) == len(words), 'Duplicate vocabulary IDs'
counts = Counter(word['pos'] for word in words)
assert set(counts) == {group['code'] for group in vocabulary['groups']}
example_count = 0
for group in vocabulary['groups']:
    assert counts[group['code']] == group['count'], f'Incorrect count for {group["code"]}'
    examples = json.loads((DOCS / f'assets/examples/{group["code"]}.json').read_text(encoding='utf-8'))
    assert set(examples) == {word['id'] for word in words if word['pos'] == group['code']}, 'Missing example IDs'
    for items in examples.values():
        assert len(items) == 3, 'Each dictionary word needs three examples'
        assert all(isinstance(item.get(lang), str) and item[lang].strip() for item in items for lang in ('pl', 'ru'))
        example_count += len(items)

demo = (DOCS / 'assets/experience.js').read_text(encoding='utf-8')
demo_ids = re.findall(r"\{ id: '(t2k-[^']+)'", demo)
assert demo_ids and len(set(demo_ids)) == len(demo_ids)
for identity in demo_ids:
    assert identity.upper() in {word['id'] for word in words}, identity
    image = DOCS / f'assets/demo-images/{identity}.jpg'
    assert image.read_bytes().startswith(b'\xff\xd8\xff'), f'Invalid demo image: {identity}'
    for kind in ('word', 'sentence'):
        audio = DOCS / f'assets/audio/{identity}-{kind}.mp3'
        assert audio.stat().st_size > 1000, f'Missing or empty recording: {audio.name}'

with zipfile.ZipFile(DOCS / 'downloads/DK-Polish_Words_RU.xlsx') as workbook:
    assert workbook.testzip() is None, 'Damaged Excel archive'
    assert 'xl/workbook.xml' in workbook.namelist(), 'Not an Excel workbook'
urls = ET.parse(DOCS / 'sitemap.xml').findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')
assert [url.text for url in urls] == [SITE], 'Incorrect sitemap URL'

def check_remote_image(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'DK-Polish-site-check'}), timeout=15) as response:
                data = response.read()
                assert response.status == 200 and response.headers.get('Content-Type', '').startswith('image/')
                assert len(data) > 1000, f'Empty remote image: {url}'
                return
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

if '--remote' in sys.argv:
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(check_remote_image, sorted(page.remote_images)))
print(f'OK: {len(words)} words, {example_count} examples, {len(demo_ids)} demo cards, links, media and Excel.')
if '--remote' in sys.argv:
    print(f'OK: {len(page.remote_images)} external screenshot images.')
