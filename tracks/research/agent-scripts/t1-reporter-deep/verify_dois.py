# Verify candidate DOIs against Crossref; save metadata + abstract (Europe PMC) to scratch. Run: python -I verify_dois.py
import sys; sys.stdout.reconfigure(encoding="utf-8")
import json, urllib.request, urllib.parse, hashlib, sys, os, re
OUT = r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/t1-reporter-deep"
UA = {"User-Agent": "delphi-research/0.1"}
dois = """10.1126/science.aac7341
10.1038/nbt.1568
10.1038/nmeth.2404
10.1038/nchembio.1411
10.1073/pnas.1301301110
10.1016/j.tibs.2014.08.003
10.1096/fasebj.11.11.9285481
10.1073/pnas.78.11.6840
10.1038/35002125
10.1038/35002131
10.1073/pnas.252535999
10.1016/j.gde.2005.02.005
10.1126/science.1106914
10.1038/msb4100187
10.1038/nmeth.2926
10.1186/1754-1611-3-4
10.1038/s41564-020-0757-2
10.1038/s41587-020-0468-5
10.1038/s41596-021-00675-2
10.1093/nar/gkt1139
10.1073/pnas.71.4.1342
10.1016/j.cell.2014.02.022
10.1073/pnas.0900617106
10.1093/nar/25.6.1203
10.1126/science.1109090
10.1038/msb.2008.19
10.1073/pnas.0502264102
10.1016/j.cell.2005.09.031
10.1038/nature04281
10.1038/msb.2011.26""".split()
import time
P=os.path.join(OUT,"crossref.json")
res = json.load(open(P)) if os.path.exists(P) else {}
def get(d):
    for i in range(6):
        try: return urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+d, headers=UA), timeout=30).read()
        except Exception as e:
            if "429" in str(e): time.sleep(8*(i+1))
            else: raise
    raise RuntimeError("429 persists")
for d in dois:
    if res.get(d,{}).get("ok"): continue
    r = {"doi": d}
    try:
        raw = get(d)
        m = json.loads(raw)["message"]
        r.update(ok=True, title=(m.get("title") or [""])[0], container=(m.get("container-title") or [""])[0],
                 year=(m.get("issued",{}).get("date-parts") or [[None]])[0][0],
                 authors=[ (a.get("family","")+" "+a.get("given","")[:1]) for a in m.get("author",[])][:6],
                 sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
    except Exception as e:
        r.update(ok=False, err=str(e)[:100])
    res[d] = r
    print(d, r.get("ok"), r.get("year"), (r.get("title") or r.get("err"))[:90])
json.dump(res, open(os.path.join(OUT,"crossref.json"),"w"), indent=1)
