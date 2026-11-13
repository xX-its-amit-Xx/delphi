import sys, json, urllib.request, urllib.parse
UA={"User-Agent":"delphi-research/0.1"}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
for q in sys.argv[1:]:
    u="https://api.crossref.org/works?rows=6&select=DOI,title,author,issued,container-title&query.bibliographic="+urllib.parse.quote(q)
    print("##",q)
    for it in get(u)["message"]["items"]:
        a=it.get("author",[{}])[0].get("family","?")
        print(it["DOI"],"|",(it.get("title") or ["?"])[0][:90],"|",a,it.get("issued",{}).get("date-parts",[[None]])[0][0],"|",(it.get("container-title") or [""])[0][:30])
