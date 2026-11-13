"""Extract GHS classification, H-statements, composition, flash point, photoinitiator CAS from the 18 Formlabs
SDS PDFs already downloaded by an earlier agent (data/formlabs-tds/sds). Needs poppler pdftotext (-layout).
Run: python -I sds_extract.py
Writes: agents2/scratch/bm-safety-lca/sds_summary.tsv, sds_sha256.tsv, sds_table.json"""
import re, subprocess, hashlib, glob, os, json
BASE='D:/Users/ashenoy00000/delphi-work'
OUT=BASE+'/agents2/scratch/bm-safety-lca'
PI={'162881-26-7':'BAPO (phenyl bis(2,4,6-trimethylbenzoyl)phosphine oxide)','84434-11-7':'TPO-L (ethyl phenyl(2,4,6-trimethylbenzoyl)phosphinate)','75980-60-8':'TPO'}
def sect(t,a,b):
    m=re.search(a+r'.*?(?='+b+r')',t,re.S); return m.group(0) if m else ''
rows=[]; sha=[]; tab=[]
for f in sorted(glob.glob(BASE+'/data/formlabs-tds/sds/*.pdf')):
    t=subprocess.run(['pdftotext','-layout',f,'-'],capture_output=True,text=True,encoding='utf8',errors='replace').stdout
    name=os.path.basename(f)
    sha.append((name,os.path.getsize(f),hashlib.sha256(open(f,'rb').read()).hexdigest()))
    prod=re.search(r'Product Name:\s*(.+)',t); prod=prod.group(1).strip() if prod else ''
    rev=re.search(r'Revision date:\s*([\d.]+)',t) or re.search(r'Initial [Pp]reparation [Dd]ate:\s*([\d.\-]+)',t)
    rev=rev.group(1) if rev else ''
    s2=sect(t,'SECTION 2','SECTION 3')
    cls=re.search(r'(?:paragraph \(d\) of.*?:|GHS Classification:|2\.1 Classification.*?:|Classification according to Regulation.*?:)\s*(.*?)\s*(?:Label elements|Hazard-determining|2\.2 Label)',s2,re.S)
    cls=re.sub(r'\s+',' ',cls.group(1)) if cls else ''
    hs=sorted(set(re.findall(r'\bH\d{3}[A-Za-z]?\b',s2)))
    s3=re.sub(r'\s+',' ',sect(t,'SECTION 3','SECTION 4'))
    cas=sorted(set(c for c in PI if c in s3))
    fp=re.search(r'Flash point[^\n]*?(>?\s*[\d.]+\s*.C)',t); fp=fp.group(1).strip() if fp else ('solid' if 'the product is a solid' in t else '')
    s13=re.sub(r'\s+',' ',sect(t,'SECTION 13','SECTION 14'))[:420]
    rows.append((name,prod,rev,cls,','.join(hs),fp,s3[:600],s13))
    tab.append({'file':name,'product':prod,'rev':rev,'classification':cls,'H':hs,'flash_point':fp,'named_photoinitiator':[PI[c] for c in cas]})
os.makedirs(OUT,exist_ok=True)
with open(OUT+'/sds_summary.tsv','w',encoding='utf8') as g:
    g.write('file\tproduct\trevision\tclassification\tH\tflash\tsection3\tsection13\n')
    for r in rows: g.write('\t'.join(r)+'\n')
with open(OUT+'/sds_sha256.tsv','w') as g:
    for r in sha: g.write('\t'.join(map(str,r))+'\n')
json.dump(tab,open(OUT+'/sds_table.json','w',encoding='utf8'),indent=1)
print(len(rows),'SDS parsed')
