"""Fetch current Ensembl (release 116) canonical proteins for the Daane 2021 sheet G genes (MEDAKA1-era IDs)."""
import json, openpyxl, os
from net import get
E = 'https://rest.ensembl.org'
HERE = os.path.dirname(os.path.abspath(__file__))
wb = openpyxl.load_workbook(os.path.join(HERE, '../../genotype/cache/daane2021_data_s1_mmc2.xlsx'), read_only=True)
ws = [w for w in wb.worksheets if w.title.startswith('G ')][0]
rows = [(i, list(r)) for i, r in enumerate(ws.iter_rows(values_only=True), start=1)]
ids = sorted({r[0] for i, r in rows if r and r[0] and str(r[0]).startswith('ENS')})
body = json.dumps({'ids': ids})
lk = json.loads(get(f'{E}/lookup/id?content-type=application/json;expand=1', 'Ensembl batch lookup of Daane 2021 sheet G gene IDs (canonical transcript)', data=body.encode()))
tl = {}
for gid, v in lk.items():
    if not v: continue
    for t in v.get('Transcript', []):
        if t.get('is_canonical') and t.get('Translation'):
            tl[gid] = {'translation': t['Translation']['id'], 'species': v['species'], 'display_name': v.get('display_name'), 'transcript': t['id']}
body = json.dumps({'ids': [x['translation'] for x in tl.values()], 'type': 'protein'})
sq = json.loads(get(f'{E}/sequence/id?content-type=application/json', 'Ensembl batch protein sequences for sheet G genes', data=body.encode()))
sm = {x['id']: x['seq'] for x in sq}
for gid, v in tl.items(): v['seq'] = sm.get(v['translation'])
missing = [g for g in ids if g not in tl]
json.dump({'genes': tl, 'missing_in_release116': missing}, open('C:/Temp/sequences/sheetG_proteins.json', 'w'), indent=1)
print(len(ids), len(tl), 'missing', missing)
