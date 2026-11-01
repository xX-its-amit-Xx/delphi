"""Fetch UniProt entries (sequence + PTM features with evidence) for the zebrafish
proteins in omics/genes.json, their human orthologues, and mouse orthologues
(reviewed mouse entry with the same gene symbol as the human orthologue).
Cache: C:/Temp/omics-cache/ptm/uniprot/*.json.gz. No credentials. Polite: 1 request/s."""
import json, gzip, os, sys, time, requests
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))  # delphisci
CACHE = 'C:/Temp/omics-cache/ptm/uniprot'
os.makedirs(CACHE, exist_ok=True)
FIELDS = 'accession,id,gene_names,organism_id,reviewed,length,sequence,ft_mod_res,ft_carbohyd,ft_lipid,ft_disulfid,ft_crosslnk'
URL = 'https://rest.uniprot.org/uniprotkb/stream'
CALLS = []

def stream(query, tag):
    fn = f'{CACHE}/{tag}.json.gz'
    if os.path.exists(fn):
        return json.load(gzip.open(fn, 'rt', encoding='utf-8'))
    for attempt in range(4):
        r = requests.get(URL, params={'query': query, 'format': 'json', 'fields': FIELDS}, timeout=120)
        CALLS.append({'url': URL, 'query': query[:200], 'status': r.status_code})
        if r.status_code == 200:
            res = r.json()['results']
            json.dump(res, gzip.open(fn, 'wt', encoding='utf-8'))
            time.sleep(1)
            return res
        print('retry', r.status_code, r.text[:200]); time.sleep(5 * (attempt + 1))
    raise SystemExit('failed ' + tag)

def batches(xs, n):
    for i in range(0, len(xs), n): yield i // n, xs[i:i + n]

genes = json.load(open(f'{ROOT}/omics/genes.json', encoding='utf-8'))['genes']
zf = sorted({g['uniprot'] for g in genes if g.get('uniprot')})
hs = sorted({g['human_ortholog']['uniprot'] for g in genes if g.get('human_ortholog') and g['human_ortholog'].get('uniprot')})
hsym = sorted({g['human_ortholog']['symbol'] for g in genes if g.get('human_ortholog') and g['human_ortholog'].get('symbol')})
out = {}
for name, accs in (('zf', zf), ('hs', hs)):
    res = []
    for i, b in batches(accs, 95):
        res += stream('accession:(' + ' OR '.join(b) + ')', f'{name}_{i:03d}')
        print(name, i, len(res), flush=True)
    out[name] = res
# mouse: reviewed entries whose gene name equals the human symbol (case-insensitive)
res = []
for i, b in batches(hsym, 95):
    q = '(organism_id:10090) AND (reviewed:true) AND (' + ' OR '.join(f'gene_exact:{s}' for s in b) + ')'
    res += stream(q, f'mm_{i:03d}')
    print('mm', i, len(res), flush=True)
out['mm'] = res
json.dump({k: len(v) for k, v in out.items()}, sys.stdout); print()
json.dump(CALLS, open(f'{CACHE}/calls_new.json', 'w'))
