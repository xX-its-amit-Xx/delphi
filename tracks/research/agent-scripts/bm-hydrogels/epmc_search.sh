#!/bin/bash
# usage: epmc_search.sh "query" [pageSize]  -> prints id|source|pmcid|doi|year|title|isOpenAccess
q="$1"; n="${2:-10}"
curl -s -A "delphi-research/0.1" -G "https://www.ebi.ac.uk/europepmc/webservices/rest/search" --data-urlencode "query=$q" --data-urlencode "format=json" --data-urlencode "pageSize=$n" --data-urlencode "resultType=lite" | python -I -c "
import sys,json
d=json.load(sys.stdin)
for r in d['resultList']['result']:
    print(r.get('source'),r.get('id'),r.get('pmcid',''),r.get('doi',''),r.get('pubYear'),r.get('isOpenAccess'),'|',r.get('title','')[:110])
"
