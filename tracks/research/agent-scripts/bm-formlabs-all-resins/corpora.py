"""Source corpora for verbatim-quote checking. corpus(name) -> whitespace-normalised text; Q(name, needle) asserts needle is in it."""
import os, re, json, html

SC = 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins'
DD = 'D:/Users/ashenoy00000/delphi-work/data/formlabs-tds'


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def html_text(path):
    h = open(path, encoding='utf8', errors='ignore').read()
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', h, flags=re.S)
    return norm(html.unescape(re.sub(r'<[^>]+>', ' ', t)))


_cache = {}


def corpus(name):
    if name in _cache:
        return _cache[name]
    kind, _, key = name.partition(':')
    if kind == 'solvent':      # every table row as joined cell text
        d = json.load(open(SC + '/solvent.json', encoding='utf8'))
        t = ' '.join(f"{k} " + ' '.join(v.values()) if isinstance(v, dict) else k for k, v in d['rows'].items())
    elif kind == 'tbl':        # TDS table rows (PyMuPDF find_tables), cells joined
        t = open(f'{SC}/tables/{key}.txt', encoding='utf8').read().replace(' | ', ' ')
    elif kind == 'raw':        # TDS PDF text in reading order
        t = open(f'{SC}/txtraw/{key}.txt', encoding='utf8', errors='ignore').read()
    elif kind == 'sds':
        t = open(f'{SC}/sds/{key}.txt', encoding='utf8', errors='ignore').read()
    elif kind == 'page':       # product page / web page visible text
        t = html_text(f'{SC}/pages/{key}.html') if os.path.exists(f'{SC}/pages/{key}.html') else html_text(f'{SC}/web/{key}.html')
        t = t.replace('|', ' ')
    elif kind == 'pagehtml':   # raw html of a product page
        t = open(f'{SC}/pages/{key}.html', encoding='utf8', errors='ignore').read()
    elif kind == 'head':       # product page headline list + tables + texts
        p = json.load(open(SC + '/products.json', encoding='utf8'))[key]
        t = ' '.join(f'{a} {b}' for a, b in (p['headline'] or [])) + ' ' + ' '.join(' '.join(r) for tb in p['tables'] for r in tb) + ' ' + ' '.join(p['texts'])
    elif kind == 'oldpdf':
        import fitz
        d = fitz.open(f'{SC}/old/clear_v5_old.pdf')
        t = ' '.join(pg.get_text() for pg in d)
    elif kind == 'catalogue':
        t = html_text(SC + '/materials.html').replace('|', ' ')
    else:
        raise KeyError(name)
    t = norm(html.unescape(t))
    _cache[name] = t
    return t


def Q(name, needle):
    n = norm(needle)
    assert len(n.split()) <= 40, ('quote too long', len(n.split()), n)
    if n not in corpus(name):
        raise AssertionError(f'quote not found in {name}: {n}')
    return n
