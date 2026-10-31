"""Fetch zebrafish gene IDs and orthologue protein sequences from Ensembl REST (release recorded in output).
Only the listed panel species are requested as targets (see README for the holdout exclusion)."""
import json, os, sys
from net import jget, get
E = 'https://rest.ensembl.org'
CT = 'content-type=application/json'
FOCAL = ['kcnk5b', 'kcnh2a', 'slc43a2a', 'gja1b', 'tbx5a', 'fgf10a', 'shha', 'hhip', 'prdm1a']
TARGETS = ['oryzias_latipes', 'myotis_lucifugus', 'pteropus_vampyrus', 'rhinolophus_ferrumequinum',
           'mus_musculus', 'homo_sapiens', 'drosophila_melanogaster']
OUT = 'C:/Temp/sequences/orthologs_raw.json'

def all_genes():
    here = os.path.dirname(os.path.abspath(__file__))
    cc = json.load(open(os.path.join(here, '../../genotype/causal-chains.json'), encoding='utf-8'))
    syms = [g['symbol'] for g in cc['genes']]
    for s in FOCAL:
        if s not in syms: syms.append(s)
    return syms, {g['symbol']: g.get('zfin_id') for g in cc['genes']}

def main():
    syms, zfin = all_genes()
    res = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for s in syms:
        if s in res and res[s].get('homologies') is not None: continue
        lk = jget(f'{E}/lookup/symbol/danio_rerio/{s}?{CT}', f'Ensembl lookup zebrafish gene {s}')
        if not lk:
            res[s] = {'symbol': s, 'error': 'lookup failed', 'homologies': None}; continue
        gid = lk['id']
        tq = ';'.join(f'target_species={t}' for t in TARGETS)
        h = jget(f'{E}/homology/id/danio_rerio/{gid}?{CT};type=orthologues;sequence=protein;aligned=0;{tq}',
                 f'Ensembl orthologues (protein seq) of zebrafish {s} in the requested panel species')
        homs = h['data'][0]['homologies'] if h and h.get('data') else []
        res[s] = {'symbol': s, 'zfin_id': zfin.get(s), 'ensembl_gene': gid,
                  'location': f"{lk.get('seq_region_name')}:{lk.get('start')}-{lk.get('end')}",
                  'description': lk.get('description'), 'homologies': homs}
        print(s, gid, len(homs), sorted(set(x['target']['species'] for x in homs)), flush=True)
        json.dump(res, open(OUT, 'w'))
    json.dump(res, open(OUT, 'w'))

if __name__ == '__main__':
    main()
