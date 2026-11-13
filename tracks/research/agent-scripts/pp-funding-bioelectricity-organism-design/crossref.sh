#!/bin/bash
# usage: crossref.sh doi... ; prints title, year, journal, funders
for d in "$@"; do
 curl -s -A "delphi-research/0.1" "https://api.crossref.org/works/$d" | python -I -c "
import sys,json
try:
 m=json.load(sys.stdin)['message']
 print('$d','|',m['title'][0],'|',m.get('issued',{}).get('date-parts'),'|',(m.get('container-title') or [''])[0],'|',[(f.get('name'),f.get('award')) for f in m.get('funder',[])])
except Exception as e: print('$d','FAIL',e)
"
done
