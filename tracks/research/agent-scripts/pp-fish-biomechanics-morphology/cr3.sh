#!/bin/bash
# usage: cr3.sh "free-text bibliographic query" [rows] [from-year]
q="$1"; n="${2:-5}"; y="${3:-1900}"
for t in 1 2 3; do
curl -s -G "https://api.crossref.org/works" -H "User-Agent: delphi-research/0.1" --data-urlencode "query.bibliographic=$q" --data-urlencode "filter=from-pub-date:$y" --data-urlencode "rows=$n" --data-urlencode "select=DOI,title,author,issued,container-title" | python -I -c "
import sys,json
d=json.load(sys.stdin)
for i in d['message']['items']:
    a=', '.join((x.get('family','?')) for x in i.get('author',[])[:4])
    print(i['DOI'],'|',i.get('issued',{}).get('date-parts',[[None]])[0][0],'|',a,'|',(i.get('title') or ['?'])[0][:120],'|',(i.get('container-title') or ['?'])[0])
" 2>/dev/null && break; sleep 2; done
