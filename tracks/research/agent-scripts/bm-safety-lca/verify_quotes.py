"""Check that every evidence_quote in data_a/b/c occurs verbatim (ignoring case, whitespace, punctuation and non-ASCII)
in its local source file. Run: python -I verify_quotes.py   -> prints FAIL lines and a summary.
Local files are: pdftotext -layout text of Formlabs SDS/TDS PDFs, tag-stripped HTML, PMC XML, cached abstracts, PubChem JSON."""
import re, sys, json, html, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_a import FIND_A
from data_b import FIND_B
from data_c import FIND_C

def load(path):
    raw = open(path, encoding='utf8', errors='replace').read()
    if path.endswith('.json') and 'pubchem' in path:
        d = json.loads(raw); out = []
        def walk(x):
            if isinstance(x, dict):
                for v in x.values(): walk(v)
            elif isinstance(x, list):
                for v in x: walk(v)
            elif isinstance(x, str): out.append(x)
        walk(d); return ' '.join(out)
    if path.endswith('.json'):
        return raw
    if path.endswith('.xml'):
        raw = re.sub(r'<xref[^>]*>.*?</xref>', '', raw)
    if path.endswith(('.xml', '.html')):
        raw = re.sub(r'<script.*?</script>|<style.*?</style>', '', raw, flags=re.S)
        raw = html.unescape(re.sub(r'<[^>]+>', ' ', raw))
    return raw

def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

ALL = FIND_A + FIND_B + FIND_C
fails = 0; empty = 0; cache = {}
for i, (claim, val, url, path, quote, conf) in enumerate(ALL):
    if not quote:
        empty += 1; continue
    if len(quote.split()) > 40:
        print('TOO LONG', i, len(quote.split()), quote[:60]); fails += 1
    if path not in cache:
        try: cache[path] = norm(load(path))
        except Exception as e: cache[path] = None; print('NOFILE', path, e)
    if cache[path] is None or norm(quote) not in cache[path]:
        print('FAIL', i, path.split('/')[-1], '|', quote[:90]); fails += 1
print('findings', len(ALL), 'quotes checked', len(ALL) - empty, 'empty quotes', empty, 'FAILS', fails)
