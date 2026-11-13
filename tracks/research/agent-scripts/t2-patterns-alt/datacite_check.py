import json,sys,time,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding="utf8",errors="replace")
# usage: datacite_check.py DOI... -> DataCite metadata (title, publisher, year, sizes, rights, related)
for doi in sys.argv[1:]:
    time.sleep(1)
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request("https://api.datacite.org/dois/"+urllib.parse.quote(doi),headers={"User-Agent":"delphi-research/0.1"}),timeout=60))["data"]["attributes"]
        print(json.dumps(dict(doi=doi,title=d["titles"][0]["title"][:110],publisher=d.get("publisher"),year=d.get("publicationYear"),sizes=d.get("sizes"),rights=[r.get("rights") for r in d.get("rightsList",[])],formats=d.get("formats"))))
    except Exception as e: print(json.dumps(dict(doi=doi,err=str(e))))
