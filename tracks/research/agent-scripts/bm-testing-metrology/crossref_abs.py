"""Print Crossref abstract (if any) for DOIs. usage: python crossref_abs.py doi..."""
import sys, json, urllib.request, urllib.parse, re, time
for doi in sys.argv[1:]:
    d=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+urllib.parse.quote(doi),headers={"User-Agent":"delphi-research/0.1"}),timeout=30))['message']
    a=re.sub('<.*?>','',d.get('abstract','(no abstract in Crossref)'))
    print(doi,'|',d['title'][0],'|',d.get('issued',{}).get('date-parts',[[None]])[0][0]); print(a[:1500]); print(); time.sleep(1)
