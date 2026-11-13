#!/bin/bash
# usage: fetch.sh name url ; saves text-stripped page to scratch, prints size+sha256
S=D:/Users/ashenoy00000/delphi-work/agents2/scratch/pp-funding-computational-biology
curl -sL -m 40 -A "delphi-research/0.1" "$2" -o $S/$1.html
python -I -c "
import re,sys,html,hashlib
p=sys.argv[1];b=open(p,'rb').read()
t=re.sub(r'(?s)<(script|style).*?</\1>','',b.decode('utf8','ignore'));t=re.sub(r'<[^>]+>',' ',t);t=re.sub(r'\s+',' ',html.unescape(t))
open(p.replace('.html','.txt'),'w',encoding='utf8').write(t)
print(sys.argv[1].split('/')[-1],len(b),hashlib.sha256(b).hexdigest()[:16],len(t))" $S/$1.html
