"""Verify DOIs via Crossref and run discovery queries (Crossref + arXiv). Output: scratch/bm-ip-landscape-deep/refs.json + printed table.
Run: python -I verify_refs.py"""
import json, sys, time, urllib.request, urllib.parse, re, hashlib, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
UA = {"User-Agent": "delphi-research/0.1"}
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-ip-landscape-deep"
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read().decode('utf-8','replace')
dois = ["10.1364/josa.11.000233","10.1098/rsif.2009.0184","10.1063/1.4819837","10.1002/ad.1710","10.1038/nmat4544",
        "10.1016/j.enbuild.2017.10.042","10.1126/sciadv.aax1311","10.1038/s41467-024-54808-8","10.1073/pnas.1709025114",
        "10.1073/pnas.1908806116","10.1089/3dp.2015.0022","10.1145/2702123.2702611","10.1039/d3dd00077j","10.1016/j.cad.2014.02.010"]
res = {"dois": {}, "queries": {}}
for d in dois:
    try:
        j = json.loads(get("https://api.crossref.org/works/" + d))["message"]
        res["dois"][d] = {"title": (j.get("title") or [""])[0], "year": (j.get("issued", {}).get("date-parts") or [[None]])[0][0],
                          "venue": (j.get("container-title") or [""])[0], "first_author": (j.get("author") or [{}])[0].get("family")}
    except Exception as e:
        res["dois"][d] = {"error": str(e)}
    time.sleep(0.5)
qs = ["theorem prover proof assistant design of materials metamaterial formal verification",
      "Lean 4 formal verification mechanical metamaterial design",
      "formal verification additive manufacturing design",
      "hygromorphic 4D printing building facade review",
      "bilayer shape-shifting inverse design computational"]
for q in qs:
    try:
        j = json.loads(get("https://api.crossref.org/works?rows=6&select=DOI,title,issued,container-title&query.bibliographic=" + urllib.parse.quote(q)))["message"]["items"]
        res["queries"]["crossref: " + q] = [{"doi": i["DOI"], "title": (i.get("title") or [""])[0], "year": (i.get("issued", {}).get("date-parts") or [[None]])[0][0]} for i in j]
    except Exception as e:
        res["queries"]["crossref: " + q] = str(e)
    time.sleep(0.5)
for q in ["all:\"theorem prover\" AND all:\"material design\"", "all:\"Lean 4\" AND all:\"mechanical metamaterial\"", "all:\"formal verification\" AND all:\"4D printing\"", "all:\"proof assistant\" AND all:\"additive manufacturing\""]:
    try:
        x = get("http://export.arxiv.org/api/query?max_results=6&search_query=" + urllib.parse.quote(q))
        ents = re.findall(r"<entry>.*?<id>(.*?)</id>.*?<title>(.*?)</title>", x, flags=re.S)
        res["queries"]["arxiv: " + q] = [{"id": a, "title": re.sub(r"\s+", " ", b)} for a, b in ents]
    except Exception as e:
        res["queries"]["arxiv: " + q] = str(e)
    time.sleep(3)
p = os.path.join(OUT, "refs.json"); json.dump(res, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for d, v in res["dois"].items(): print(d, v)
for q, v in res["queries"].items():
    print("##", q)
    if isinstance(v, str): print("  ", v)
    else:
        for i in v: print("  ", i)
print("sha256", hashlib.sha256(open(p, 'rb').read()).hexdigest(), os.path.getsize(p))
