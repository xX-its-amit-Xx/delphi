"""Fetch AlphaFold DB prediction summaries and InterPro entry matches per gene's protein, cached per accession.
Polite: InterPro returned HTTP 429 at 10 concurrent requests, so 2 threads with a 0.4 s pause each, retries with backoff. Priority order: causal-chain, fin required/sufficient, fin-expressed, rest."""
import json, os, sys, time, threading, concurrent.futures as cf, requests
sys.path.insert(0, os.path.dirname(__file__))
from common import *
S = requests.Session(); S.headers['User-Agent'] = 'DELPHI-omics-proteomic/1.0 (research; contact via repo)'
def get(url, path):
    if os.path.exists(path): return
    for i in range(5):
        try:
            r = S.get(url, timeout=60)
            if r.status_code in (200, 404, 204):
                tmp = path + '.tmp'
                with open(tmp, 'w', encoding='utf8') as f:
                    json.dump({'status': r.status_code, 'url': url, 'retrieved': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                               'body': (r.json() if r.status_code == 200 and r.text.strip() else None)}, f)
                os.replace(tmp, path); return
            if r.status_code == 408 or r.status_code == 429 or r.status_code >= 500:
                time.sleep(int(r.headers.get('Retry-After', 0) or 0) or 2 ** i * 5); continue
            return
        except Exception as e:
            time.sleep(2 ** i)
def interpro_all(acc):
    path = f'{CACHE}/interpro/{acc}.json'
    if os.path.exists(path): return
    url = f'https://www.ebi.ac.uk/interpro/api/entry/all/protein/uniprot/{acc}?page_size=200'
    get(url, path); time.sleep(0.4)
genes = load_genes(); rows = load_uniprot(); z2 = zfin_to_entries(rows); sets = priority_sets()
genes.sort(key=lambda g: tier(g['zfin_id'], sets))
af, ip = [], []
for g in genes:
    c, a = pick_entries(g, z2)
    acc = g.get('uniprot') or (c and c['Entry'])
    if acc: ip.append(acc)
    if a: af.append(a['Entry'])
print('interpro', len(ip), 'alphafold', len(af), flush=True)
with cf.ThreadPoolExecutor(3) as ex1, cf.ThreadPoolExecutor(2) as ex2:
    f1 = [ex1.submit(get, f'https://alphafold.ebi.ac.uk/api/prediction/{a}', f'{CACHE}/alphafold/{a}.json') for a in af]
    f2 = [ex2.submit(interpro_all, a) for a in ip]
    n = 0
    for f in cf.as_completed(f1 + f2):
        n += 1
        if n % 500 == 0: print(n, time.strftime('%H:%M:%S'), flush=True)
print('done', flush=True)
