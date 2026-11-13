"""Scan the 64 saved Formlabs product pages (earlier agent, scratch/bm-formlabs-all-resins/pages) for bio-based / renewable /
recyclable / sustainability claims. Run: python -I claims_scan.py"""
import re,glob,html
hits={}
for f in sorted(glob.glob('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins/pages/*.html')):
    t=open(f,encoding='utf8',errors='replace').read()
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S); t=html.unescape(re.sub(r'<[^>]+>',' ',t)); t=re.sub(r'\s+',' ',t)
    for m in re.finditer(r'.{60}(bio-?based|renewable|recycl|sustainab|carbon footprint|castor|biodegrad|compostable|eco-?friendly).{80}',t,re.I):
        s=m.group(0)
        if 'Sign Up' in s or 'Careers' in s: continue
        hits.setdefault(f.split('/')[-1],[]).append(s)
print(len(glob.glob('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins/pages/*.html')),'pages scanned; pages with hits:',len(hits))
for k,v in hits.items(): print(k,len(v),'|',v[0][:170])
