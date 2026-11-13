# Run: python -I parts.py <Eco1C1G1T1.UCF.json>  -- shows cassettes for the BM3R1/SrpR gates and part types; cytometry table size
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
parts={r['name']:r for r in d if r.get('collection')=='parts'}
st={r['name']:r for r in d if r.get('collection')=='structures'}
for n in ['B1_BM3R1','B2_BM3R1','B3_BM3R1','S1_SrpR','S2_SrpR','S3_SrpR','S4_SrpR','P1_PhlF','P2_PhlF','P3_PhlF']:
    s=st[n+'_structure']
    c=[x for x in s['devices'] if 'cassette' in x['name'].lower()][0]['components']
    print(n,[(x,parts.get(x,{}).get('type')) for x in c])
for r in d:
    if r.get('collection')=='functions' and r['name']=='B1_BM3R1_cytometry':
        print({k:(type(v).__name__, (len(v) if hasattr(v,'__len__') else v)) for k,v in r.items()})
        t=r.get('tables') or r.get('table') or r.get('parameters')
        print(json.dumps(r)[:700])
