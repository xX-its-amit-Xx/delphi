"""Fetch Crossref records for DOIs (generic UA), save compact JSON to scratch. Usage: cr_fetch.py doi1 doi2 ..."""
import sys, json, time, urllib.request, urllib.error, os, re
UA={'User-Agent':'delphi-research/0.1'}
OUT='D:/Users/ashenoy00000/delphi-work/agents2/scratch/t4-glide-deep/crossref.json'
db=json.load(open(OUT)) if os.path.exists(OUT) else {}
for doi in sys.argv[1:]:
    if doi in db: continue
    for t in range(5):
        try:
            d=json.load(urllib.request.urlopen(urllib.request.Request('https://api.crossref.org/works/'+doi,headers=UA),timeout=40))['message']
            db[doi]={'title':(d.get('title') or [''])[0],'authors':[a.get('family','') for a in d.get('author',[])][:6],'n_auth':len(d.get('author',[])),'year':(d.get('issued',{}).get('date-parts') or [[None]])[0][0],'journal':(d.get('container-title') or [''])[0],'abstract':re.sub('<[^>]+>','',d.get('abstract',''))[:1500]}
            print('OK ',doi,db[doi]['year'],db[doi]['title'][:80]); break
        except urllib.error.HTTPError as e:
            if e.code==429: time.sleep(8*(t+1)); continue
            print('ERR',doi,e.code); break
        except Exception as e: print('ERR',doi,e); break
    time.sleep(1.5)
os.makedirs(os.path.dirname(OUT),exist_ok=True)
json.dump(db,open(OUT,'w'),indent=1)
