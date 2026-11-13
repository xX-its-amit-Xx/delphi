"""Resolve DOIs via Crossref and print title/year/venue. usage: python crossref_check.py doi1 doi2 ..."""
import sys, json, urllib.request, urllib.parse
for doi in sys.argv[1:]:
    url="https://api.crossref.org/works/"+urllib.parse.quote(doi)
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"delphi-research/0.1"}),timeout=30))['message']
        au=', '.join((a.get('family','?')) for a in d.get('author',[])[:4])
        print("OK ",doi,'|',d['title'][0][:110],'|',d.get('issued',{}).get('date-parts',[[None]])[0][0],'|',(d.get('container-title') or [''])[0][:50],'|',au)
    except Exception as e: print("ERR",doi,e)
