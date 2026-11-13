# usage: dl.py <url> <name> ; saves to data/bm-competing-approaches, appends manifest line (url, date, bytes, sha256)
import sys, urllib.request, hashlib, os, datetime, json
url,name=sys.argv[1],sys.argv[2]
D='D:/Users/ashenoy00000/delphi-work/data/bm-competing-approaches'; os.makedirs(D,exist_ok=True)
r=urllib.request.Request(url,headers={'User-Agent':'delphi-research/0.1 (research; contact none)'})
b=urllib.request.urlopen(r,timeout=120).read()
if len(b)>40e6: sys.exit('too big')
open(f'{D}/{name}','wb').write(b)
m={'url':url,'file':name,'date':str(datetime.date.today()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
open(f'{D}/MANIFEST.jsonl','a').write(json.dumps(m)+'\n'); print(m)
