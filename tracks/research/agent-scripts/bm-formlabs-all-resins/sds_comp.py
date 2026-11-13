"""Print SDS section 3 (composition) of each saved SDS text. Usage: python -I sds_comp.py"""
import os,re,sys
sys.stdout.reconfigure(encoding='utf-8')
D='D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins/sds'
for f in sorted(os.listdir(D)):
    t=open(D+'/'+f,encoding='utf8',errors='ignore').read()
    m=re.search(r'Product Name:\s*(.*)',t)
    i=t.find('SECTION 3'); j=t.find('SECTION 4',i)
    sec=re.sub(r'[ \t]+',' ',t[i:j])
    sec=re.sub(r'\n\s*\n+','\n',sec)
    print('#####',f,'| product:',m.group(1).strip() if m else None); print(sec[:1500])
