"""RCSB PDB metadata (method, resolution, title, release date) for PDB IDs cross-referenced from the universe genes' zebrafish UniProt entries."""
import json, os, sys, time, requests
sys.path.insert(0, os.path.dirname(__file__))
from common import *
genes = load_genes(); z2 = zfin_to_entries(load_uniprot())
ids = sorted({p for g in genes for r in z2.get(g['zfin_id'], []) for p in r['PDB'].strip(';').split(';') if p})
print(len(ids))
q = 'query($ids:[String!]!){entries(entry_ids:$ids){rcsb_id exptl{method} rcsb_entry_info{resolution_combined} struct{title} rcsb_accession_info{initial_release_date}}}'
out = {}
for i in range(0, len(ids), 100):
    r = requests.post('https://data.rcsb.org/graphql', json={'query': q, 'variables': {'ids': ids[i:i+100]}}, timeout=120)
    for e in r.json()['data']['entries']:
        out[e['rcsb_id']] = e
    time.sleep(0.5)
json.dump({'retrieved': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'url': 'https://data.rcsb.org/graphql', 'entries': out}, open(f'{CACHE}/rcsb_entries.json', 'w'))
print(len(out))
