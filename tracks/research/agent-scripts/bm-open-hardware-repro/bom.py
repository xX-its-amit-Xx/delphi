"""Total the bill of materials in bom.csv. Standard library only.
usage: python -I bom.py [bom.csv]
Prints totals for: all-new purchase, borrow-everything-flagged-Y, and per section. Exact = rows priced from a
Formlabs/Adafruit page fetched 2026-11-12; Snippet = search-result snippets (vendor page not opened);
Unverified = background guess. Tiers: core/optional counted separately; 'excluded' never counted."""
import csv, sys, os
here = os.path.dirname(os.path.abspath(__file__))
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'bom.csv')
rows = list(csv.DictReader(open(path, encoding='utf8')))
def line(r):
    lo = float(r['qty_low']) * float(r['unit_low_usd'])
    hi = float(r['qty_high']) * float(r['unit_high_usd'])
    return lo, hi
def basis_class(b):
    if b.startswith('formlabs') or b.startswith('adafruit'): return 'exact'
    if b.startswith('search-snippet') and '+' not in b: return 'snippet'
    return 'unverified'
tot = {}
def add(key, lo, hi):
    t = tot.setdefault(key, [0.0, 0.0]); t[0] += lo; t[1] += hi
for r in rows:
    if r['tier'] == 'excluded':
        continue
    lo, hi = line(r)
    cls = basis_class(r['price_basis'])
    for tier in ([r['tier']] if r['tier'] != 'core' else ['core']):
        add(('ALL', tier), lo, hi)
        add(('BASIS', tier, cls), lo, hi)
        if r['borrow'] == 'Y':
            add(('BORROWABLE', tier), lo, hi)
        else:
            add(('MUST_BUY', tier), lo, hi)
        add(('SECTION', r['section'], tier), lo, hi)
for k in sorted(tot, key=str):
    print('%-45s $%9.2f - $%9.2f' % (k, tot[k][0], tot[k][1]))
print()
print('formlabs-page core, single-person minimum: all rows F01-F07 listed as core')
print('Lines (low-high USD):')
for r in rows:
    lo, hi = line(r)
    print('%-4s %-9s %-9s %8.2f %9.2f  %s' % (r['id'], r['tier'], r['borrow'], lo, hi, r['item'][:70]))
