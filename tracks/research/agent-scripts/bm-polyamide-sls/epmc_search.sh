#!/bin/sh
# usage: epmc_search.sh "query" [pageSize]; prints id, doi, year, title, OA flag
q="$1"; n="${2:-15}"
curl -s -A "delphi-research/0.1" -G "https://www.ebi.ac.uk/europepmc/webservices/rest/search" --data-urlencode "query=$q" --data-urlencode "format=json" --data-urlencode "pageSize=$n" | python -I -X utf8 -c "
import json,sys
d=json.load(sys.stdin)
for r in d['resultList']['result']:
    print(r.get('pmcid',''),'|',r.get('doi',''),'|',r.get('pubYear'),'|',r.get('isOpenAccess'),'|',r.get('title','')[:120].encode('ascii','replace').decode())
"
