#!/bin/bash
# usage: cr.sh "query" [rows]; prints DOI | year | first authors | title | journal
q="$1"; n="${2:-6}"
curl -s -G "https://api.crossref.org/works" -H "User-Agent: delphi-research/0.1" --data-urlencode "query.bibliographic=$q" --data-urlencode "rows=$n" --data-urlencode "select=DOI,title,author,issued,container-title" | python -I -c "
import sys,json
for i in json.load(sys.stdin)['message']['items']:
    a=', '.join((x.get('family','?')) for x in i.get('author',[])[:4])
    print(i['DOI'],'|',i.get('issued',{}).get('date-parts',[[None]])[0][0],'|',a,'|',(i.get('title') or ['?'])[0][:110],'|',(i.get('container-title') or ['?'])[0])
"
