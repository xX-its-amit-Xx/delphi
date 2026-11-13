"""Search Crossref by bibliographic query. usage: python crossref_search.py "query" [rows]"""
import sys, json, urllib.request, urllib.parse
q=sys.argv[1]; rows=sys.argv[2] if len(sys.argv)>2 else "6"
url="https://api.crossref.org/works?rows="+rows+"&select=DOI,title,issued,container-title,author&query.bibliographic="+urllib.parse.quote(q)
d=json.load(urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"delphi-research/0.1"}),timeout=40))['message']['items']
for i in d:
    print(i['DOI'],'|',(i.get('title') or [''])[0][:100],'|',i.get('issued',{}).get('date-parts',[[None]])[0][0],'|',(i.get('container-title') or [''])[0][:40],'|',', '.join(a.get('family','?') for a in i.get('author',[])[:3]))
