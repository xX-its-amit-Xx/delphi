"""Run parse_product over all saved product pages; write products.json. Usage: python -I parse_all.py"""
import os,json,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import parse_product as pp
SC='D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins'
out={}
for f in sorted(os.listdir(SC+'/pages')):
    if f.endswith('.html') and '__' not in f:
        try: out[f[:-5]]=pp.parse(SC+'/pages/'+f)
        except Exception as e: out[f[:-5]]={'error':str(e)}
json.dump(out,open(SC+'/products.json','w',encoding='utf8'),indent=1,ensure_ascii=False)
for k,v in out.items():
    if 'error' in v: print(k,'ERR',v['error']); continue
    t=v['tags']
    print(f"{k:28s} layer={t.get('Minimum Layer Thickness')} printers={[x for x in (t.get('Compatible Printer') or []) if 'Form 4' in x or 'Fuse' in x or 'Studio' in x]} cat={t.get('Categories')} tables={len(v['tables'])} head={len(v['headline'] or [])}")
