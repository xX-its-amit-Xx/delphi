# Fetch OA full texts: Europe PMC fullTextXML for PMC ids, arXiv abs API + PDF. Saves to data dir; manifest appended.
# Run: python -I fetch_fulltext.py
import sys, json, urllib.request, hashlib, os, time, datetime, re
sys.stdout.reconfigure(encoding='utf8')
DATA='D:/Users/ashenoy00000/delphi-work/data/buehler-papers/'
UA={'User-Agent':'delphi-research/0.1'}
man=json.load(open(DATA+'manifest.json'))
def get(url,fn):
    p=DATA+fn
    if not os.path.exists(p):
        b=None
        for a in range(4):
            try: b=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=90).read(); break
            except Exception as e: print('ERR',url,e); time.sleep(4*(a+1))
        if b is None: return None
        open(p,'wb').write(b)
    b=open(p,'rb').read()
    if not any(m['file']==p for m in man):
        man.append({'url':url,'file':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'date':datetime.date.today().isoformat()})
    print(fn,len(b)); return b
for pmc in ['PMC6397028','PMC4354200','PMC3216522','PMC4479035','PMC7189256']:
    b=get('https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML'%pmc,'fulltext_%s.xml'%pmc)
    if b:
        t=re.sub(r'<[^>]+>',' ',b.decode('utf8','ignore')); t=re.sub(r'\s+',' ',t)
        open(DATA+'fulltext_%s.txt'%pmc,'w',encoding='utf8').write(t)
for aid in ['2508.06591','2108.07877']:
    get('http://export.arxiv.org/api/query?id_list=%s'%aid,'arxiv_%s.atom'%aid)
    get('https://arxiv.org/pdf/%sv1'%aid if False else 'https://arxiv.org/pdf/%s'%aid,'arxiv_%s.pdf'%aid)
json.dump(man,open(DATA+'manifest.json','w'),indent=1)
