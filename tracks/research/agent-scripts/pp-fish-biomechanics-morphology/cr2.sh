#!/bin/bash
# usage: cr2.sh "author" "topic words" [from-year] [rows]
au="$1"; q="$2"; y="${3:-2021}"; n="${4:-8}"
for t in 1 2 3; do
out=$(curl -s -G "https://api.crossref.org/works" -H "User-Agent: delphi-research/0.1" --data-urlencode "query.author=$au" --data-urlencode "query.bibliographic=$q" --data-urlencode "filter=from-pub-date:$y,type:journal-article" --data-urlencode "rows=$n" --data-urlencode "select=DOI,title,author,issued,container-title")
echo "$out" | python -I -c "
import sys,json
d=json.load(sys.stdin)
for i in d['message']['items']:
    a=', '.join((x.get('family','?')) for x in i.get('author',[])[:4])
    print(i['DOI'],'|',i.get('issued',{}).get('date-parts',[[None]])[0][0],'|',a,'|',(i.get('title') or ['?'])[0][:110],'|',(i.get('container-title') or ['?'])[0])
" 2>/dev/null && break; sleep 2; done
