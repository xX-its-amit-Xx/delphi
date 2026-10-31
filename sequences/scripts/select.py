"""Pick one orthologue per species per gene from Ensembl homology output -> C:/Temp/sequences/selected.json"""
import json
raw = json.load(open('C:/Temp/sequences/orthologs_raw.json'))
sel = {}
for g, r in raw.items():
    if not r.get('homologies'): 
        sel[g] = {'_zebrafish': None, '_note': r.get('error') or 'no orthologues in requested species'}
        if r.get('homologies') == [] and r.get('ensembl_gene'):
            sel[g]['_zebrafish_gene'] = r['ensembl_gene']
        continue
    src = r['homologies'][0]['source']
    out = {'danio_rerio': {'gene_id': src['id'], 'protein_id': src['protein_id'], 'seq': src['seq'], 'type': 'reference'}}
    by = {}
    for h in r['homologies']:
        by.setdefault(h['target']['species'], []).append(h)
    for sp, hs in by.items():
        best = max(hs, key=lambda h: (float(h['source']['perc_id']) + float(h['target']['perc_id'])) / 2)
        out[sp] = {'gene_id': best['target']['id'], 'protein_id': best['target']['protein_id'], 'seq': best['target']['seq'],
                   'type': best['type'], 'n_candidates': len(hs), 'taxonomy_level': best.get('taxonomy_level'),
                   'ensembl_perc_id_target': float(best['target']['perc_id']),
                   'ensembl_perc_id_zebrafish': float(best['source']['perc_id'])}
    out['_zebrafish_gene'] = r['ensembl_gene']; out['_location'] = r.get('location'); out['_description'] = r.get('description')
    out['_zfin_id'] = r.get('zfin_id')
    sel[g] = out
json.dump(sel, open('C:/Temp/sequences/selected.json', 'w'))
print(len(sel))
