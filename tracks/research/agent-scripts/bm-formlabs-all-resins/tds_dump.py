"""Dump metric TDS table rows of interest for every saved TDS PDF -> scratch/<label>/tables/<file>.txt
Run: python -E -P tds_dump.py"""
import os,re,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import tds_tables
DD='D:/Users/ashenoy00000/delphi-work/data/formlabs-tds'
OUT='D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins/tables'
os.makedirs(OUT,exist_ok=True)
for f in sorted(os.listdir(DD)):
    if not f.endswith('.pdf'): continue
    try: rows=tds_tables.rows_of(DD+'/'+f)
    except Exception as e: print('ERR',f,e); continue
    lines=[]
    imp=False
    for pn,lab,cells in rows:
        j=' | '.join(c.replace('\n',' ') for c in cells)
        if 'IMPERIAL' in j: imp=True
        if 'METRIC' in j: imp=False
        if imp: continue
        lines.append(f'p{pn} | {lab} | {j}')
    open(f'{OUT}/{f[:-4]}.txt','w',encoding='utf8').write('\n'.join(lines))
    print(f,len(lines))
