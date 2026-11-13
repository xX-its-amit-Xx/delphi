import sys, json, urllib.request, urllib.parse
UA={"User-Agent":"delphi-research/0.1"}
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
for q in sys.argv[1:]:
    u="https://api.datacite.org/dois?page[size]=8&resource-type-id=dataset&query="+urllib.parse.quote(q)
    print("##",q)
    for r in get(u)["data"]:
        a=r["attributes"]; t=(a.get("titles") or [{}])[0].get("title","")
        print(a["doi"],"|",t[:100],"|",a.get("publicationYear"),"|",a.get("publisher"),"|",a.get("sizes"))
