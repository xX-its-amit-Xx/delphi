#!/bin/sh
# usage: crossref_search.sh "query" [rows]
curl -s -A "delphi-research/0.1" -G "https://api.crossref.org/works" --data-urlencode "query.bibliographic=$1" --data-urlencode "rows=${2:-8}" --data-urlencode "select=DOI,title,issued,container-title,author" | python -I -c "
import json,sys
d=json.load(sys.stdin)
for r in d['message']['items']:
    a=r.get('author',[{}])[0].get('family','')
    print(r['DOI'],'|',r.get('issued',{}).get('date-parts',[[None]])[0][0],'|',a,'|',(r.get('title') or [''])[0][:110].encode('ascii','replace').decode(),'|',(r.get('container-title') or [''])[0][:40])
"
