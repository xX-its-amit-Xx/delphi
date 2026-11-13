#!/bin/sh
# usage: crossref_verify.sh DOI... ; prints authors/year/title/venue from Crossref (proves DOI resolves)
export PYTHONIOENCODING=utf-8
for d in "$@"; do
 curl -s -A "delphi-research/0.1" "https://api.crossref.org/works/$d" | python -I -X utf8 -c "
import json,sys
try:
  m=json.load(sys.stdin)['message']
except Exception as e:
  print('$d','NOT FOUND'); sys.exit()
au=', '.join((a.get('family','')+' '+a.get('given','')[:1]) for a in m.get('author',[])[:6])
print('$d','|',au,'|',m['issued']['date-parts'][0][0],'|',m['title'][0],'|',(m.get('container-title') or [''])[0])
"
done
