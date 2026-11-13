#!/usr/bin/env bash
# Resolves each DOI against Crossref and prints title / year / first author family name. Generic User-Agent.
for d in "$@"; do
  curl -s -A "delphi-research/0.1" "https://api.crossref.org/works/$d" | python -c "
import sys,json
try:
    m=json.load(sys.stdin)['message']
    y=(m.get('issued',{}).get('date-parts') or [[None]])[0][0]
    a=(m.get('author') or [{}])[0].get('family','?')
    print('OK  $d |',a,'|',y,'|',(m.get('title') or ['?'])[0][:90],'|',(m.get('container-title') or ['?'])[0][:40])
except Exception as e: print('FAIL $d',e)
"
done
