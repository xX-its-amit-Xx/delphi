"""Second pass: retry 429'd Crossref queries, verify two new DOIs by direct works/<doi> fetch, confirm arXiv API returns totalResults.
Run: python -I verify_refs2.py"""
import json, sys, time, urllib.request, urllib.parse, re, hashlib, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
UA = {"User-Agent": "delphi-research/0.1"}
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-ip-landscape-deep"
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read().decode('utf-8','replace')
res = {}
for d in ["10.1080/17452759.2025.2591322","10.1007/978-981-92-0615-5_25","10.1038/nmat4544"]:
    j = json.loads(get("https://api.crossref.org/works/" + d))["message"]
    res[d] = {"title": (j.get("title") or [""])[0], "year": (j.get("issued", {}).get("date-parts") or [[None]])[0][0], "venue": (j.get("container-title") or [""])[0],
              "authors": [a.get("family") for a in j.get("author", [])][:4]}
    time.sleep(1)
time.sleep(5)
for q in ["formal verification additive manufacturing design", "inverse design bilayer shape-shifting computational"]:
    try:
        j = json.loads(get("https://api.crossref.org/works?rows=6&select=DOI,title,issued&query.bibliographic=" + urllib.parse.quote(q)))["message"]["items"]
        res["crossref: " + q] = [{"doi": i["DOI"], "title": (i.get("title") or [""])[0], "year": (i.get("issued", {}).get("date-parts") or [[None]])[0][0]} for i in j]
    except Exception as e: res["crossref: " + q] = str(e)
    time.sleep(5)
for q in ["all:\"theorem prover\" AND all:\"material design\"", "all:\"proof assistant\" AND all:\"additive manufacturing\"", "all:\"Lean 4\" AND all:\"metamaterial\"", "all:\"proof assistant\" AND all:\"4D printing\""]:
    x = get("http://export.arxiv.org/api/query?max_results=5&search_query=" + urllib.parse.quote(q))
    m = re.search(r"<opensearch:totalResults[^>]*>(\d+)<", x)
    res["arxiv totalResults: " + q] = int(m.group(1)) if m else "no totalResults tag"
    time.sleep(3)
p = os.path.join(OUT, "refs2.json"); json.dump(res, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1, ensure_ascii=False))
print("sha256", hashlib.sha256(open(p, 'rb').read()).hexdigest(), os.path.getsize(p))
