"""Shared helpers for the proteomic layer (omics/proteomic). Cache lives under C:/Temp/omics-cache/proteomic."""
import csv, gzip, json, collections, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CACHE = 'C:/Temp/omics-cache/proteomic'

def load_genes():
    return json.load(open(os.path.join(ROOT, 'omics', 'genes.json'), encoding='utf8'))['genes']

def load_uniprot():
    return list(csv.DictReader(gzip.open(f'{CACHE}/uniprot_7955.tsv.gz', 'rt', encoding='utf8'), delimiter='\t'))

def zfin_to_entries(rows):
    z2 = collections.defaultdict(list)
    for r in rows:
        for z in r['ZFIN'].strip(';').split(';'):
            if z.strip():
                z2[z.strip()].append(r)
    return z2

def priority_sets():
    """tier 0: causal-chain genes; tier 1: fin required/sufficient genes; tier 2: pectoral-fin expressed; tier 3: rest."""
    cc = json.load(open(os.path.join(ROOT, 'genotype', 'causal-chains.json'), encoding='utf8'))
    causal = {g['zfin_id'] for g in cc['genes'] if g.get('zfin_id')}
    fs = json.load(open(os.path.join(ROOT, 'genotype', 'fin-subtree.full.json'), encoding='utf8'))
    req, expr = set(), set()
    for lay in fs['layers'].values():
        for l in lay.get('links', []):
            z = (l.get('gene') or '').replace('ZF:', '')
            if not z.startswith('ZDB-GENE'):
                continue
            (req if l['link_type'] in ('required for', 'sufficient for') else expr).add(z)
    return causal, req, expr

def tier(z, sets):
    causal, req, expr = sets
    return 0 if z in causal else 1 if z in req else 2 if z in expr else 3

def pick_entries(g, z2):
    """Return (canonical_entry_or_None, af_entry_or_None) for a gene."""
    rs = z2.get(g['zfin_id'], [])
    canon = next((r for r in rs if r['Entry'] == g.get('uniprot')), None)
    def key(r): return (r['Reviewed'] == 'reviewed', int(r['Length'] or 0))
    if canon is None and rs:
        canon = max(rs, key=key)
    af = canon if canon and canon['AlphaFoldDB'] else None
    if af is None:
        cands = [r for r in rs if r['AlphaFoldDB']]
        af = max(cands, key=key) if cands else None
    return canon, af
