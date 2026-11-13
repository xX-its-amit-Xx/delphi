"""Resolve each DOI at Crossref (or DataCite) and print title / container / year. Run: python verify_dois.py"""
import urllib.request, json, sys
CR = ["10.1364/JOSA.11.000233","10.1098/rsif.2009.0184","10.1038/37745","10.1016/j.conbuildmat.2015.08.136",
      "10.1007/978-3-030-79876-5_37","10.1145/3372885.3373824","10.3390/polym15122600","10.1038/s41467-024-54808-8",
      "10.1038/nmat4544","10.1126/science.1140097","10.3390/polym18050597"]
DC = ["10.25405/ncl.34238076"]
def get(u):
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":"delphi-research/0.1"}), timeout=60).read())
res = {}
for d in CR:
    try:
        m = get("https://api.crossref.org/works/"+d)["message"]
        yr = (m.get("issued",{}).get("date-parts") or [[None]])[0][0]
        res[d] = {"title": (m.get("title") or [""])[0], "container": (m.get("container-title") or [""])[0], "year": yr,
                  "authors": "; ".join(a.get("family","") for a in m.get("author",[])[:4])}
    except Exception as e:
        res[d] = {"error": str(e)}
for d in DC:
    try:
        a = get("https://api.datacite.org/dois/"+d)["data"]["attributes"]
        res[d] = {"title": a["titles"][0]["title"], "year": a.get("publicationYear"), "publisher": a.get("publisher"),
                  "authors": "; ".join(c.get("name","") for c in a.get("creators",[])[:4])}
    except Exception as e:
        res[d] = {"error": str(e)}
json.dump(res, open("D:/Users/ashenoy00000/delphi-work/data/bm-lay/doi_check.json","w"), indent=1)
for k,v in res.items(): print(k, v)
