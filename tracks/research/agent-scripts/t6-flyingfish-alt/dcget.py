import sys, json, urllib.request, urllib.parse
UA={"User-Agent":"delphi-research/0.1"}
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
for doi in sys.argv[1:]:
    a=get("https://api.datacite.org/dois/"+urllib.parse.quote(doi))["data"]["attributes"]
    print("==",doi,a["titles"][0]["title"],a["publicationYear"],a["publisher"])
    print(" sizes",a.get("sizes"),"formats",a.get("formats"),"rights",[r.get("rights") for r in a.get("rightsList",[])])
    print(" related",[(r.get("relatedIdentifier"),r.get("relationType")) for r in a.get("relatedIdentifiers",[])][:4])
    print(" desc",(a.get("descriptions") or [{}])[0].get("description","")[:700])
