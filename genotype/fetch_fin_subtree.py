"""Network calls for the fin-focused subtree (hub task, 2026-10-31): Uberon and MFO cross-references for the ZFA
terms under the zebrafish pectoral fin (and its precursor, the pectoral fin bud), and GEO searches for zebrafish
fin single-cell datasets (leads only). Appends to genotype/cache/calls.json; results in genotype/cache/.
The ZFA term set itself is computed offline from the ZFIN anatomy files already in RAW.
Usage: python -I genotype/fetch_fin_subtree.py [--raw DIR]
"""
import collections, hashlib, json, os, sys, time, urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, "cache"); LOG = os.path.join(CACHE, "calls.json")
RAW = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else "C:/Temp/genotype/raw"
UA = {"User-Agent": "delphisci-genotype-thread/0.2 (ScienceClaw hackathon; research use)"}
log = json.load(open(LOG)); calls = log["calls"]
def now(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
def call(name, url, data=None, headers=None):
    h = dict(UA); h.update(headers or {})
    rec = {"name": name, "url": url, "method": "POST" if data else "GET", "retrieved": now(), "by": "genotype/fetch_fin_subtree.py"}
    if data: rec["body"] = data
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data.encode() if data else None, headers=h), timeout=300) as r: body = r.read(); rec["status"] = r.status
    except urllib.error.HTTPError as e: body = e.read(); rec["status"] = e.code; rec["error"] = str(e)
    except Exception as e: body = b""; rec["status"] = None; rec["error"] = repr(e)
    rec["bytes"] = len(body); rec["sha256"] = hashlib.sha256(body).hexdigest()
    if rec["status"] != 200: rec["body_head"] = body[:300].decode("utf8", "replace")
    calls[:] = [c for c in calls if c["name"] != name] + [rec]; print(rec["status"], rec["bytes"], name, flush=True); return rec, body
def sparql(name, q):
    rec, body = call(name, "https://ubergraph.apps.renci.org/sparql", data=urllib.parse.urlencode({"query": q}),
                     headers={"Accept": "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded"})
    out = json.loads(body) if rec["status"] == 200 else None
    json.dump({"endpoint": "https://ubergraph.apps.renci.org/sparql", "query": q, "retrieved": rec["retrieved"], "status": rec["status"], "result": out}, open(os.path.join(CACHE, name + ".json"), "w"), indent=1)
    return out

def tsv(fn):
    for line in open(os.path.join(RAW, fn), encoding="utf8", errors="replace"): yield line.rstrip("\r\n").split("\t")
kids = collections.defaultdict(set)
for r in tsv("anatomy_relationship.txt"):
    if len(r) >= 3: kids[(r[0], r[2])].add(r[1])
def closure(root, rel):
    seen, todo = {root}, [root]
    while todo:
        x = todo.pop()
        for k in kids[(x, rel)]:
            if k not in seen: seen.add(k); todo.append(k)
    return seen
names = {r[0]: r[1] for r in tsv("anatomy_item.txt") if len(r) >= 2}
PF = "ZFA:0001161"; assert names[PF] == "pectoral fin", names.get(PF)
BUD = next(t for t, n in names.items() if n == "pectoral fin bud")
terms = sorted(closure(PF, "part of") | closure(BUD, "part of"))
json.dump({"pectoral_fin": PF, "pectoral_fin_bud": BUD, "zfa_terms": terms, "n": len(terms)}, open(os.path.join(CACHE, "fin_subtree_zfa_terms.json"), "w"), indent=1)
print("ZFA terms under pectoral fin + pectoral fin bud:", len(terms), "bud =", BUD)

vals = " ".join(f'"{t}"^^<http://www.w3.org/2001/XMLSchema#string>' for t in terms)   # xrefs are typed xsd:string in Ubergraph; a plain literal in VALUES matches nothing (found 2026-10-31)
# 1. Uberon terms cross-referenced to these ZFA terms (the only allowed attachment), with labels
sparql("ubergraph_fin_uberon_zfa_xrefs",
       "PREFIX oio: <http://www.geneontology.org/formats/oboInOwl#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
       "SELECT DISTINCT ?u ?ul ?x WHERE { VALUES ?x { " + vals + " } ?u oio:hasDbXref ?x . ?u rdfs:label ?ul . FILTER(STRSTARTS(STR(?u),\"http://purl.obolibrary.org/obo/UBERON_\")) }")
# 2. MFO (medaka anatomy) cross-references of those Uberon terms, if any exist
sparql("ubergraph_fin_uberon_mfo_xrefs",
       "PREFIX oio: <http://www.geneontology.org/formats/oboInOwl#> SELECT DISTINCT ?u ?x WHERE { { SELECT DISTINCT ?u WHERE { VALUES ?z { " + vals +
       " } ?u oio:hasDbXref ?z . FILTER(STRSTARTS(STR(?u),\"http://purl.obolibrary.org/obo/UBERON_\")) } } ?u oio:hasDbXref ?x . FILTER(STRSTARTS(STR(?x),\"MFO:\")) }")
# 3. CL cross-references of ZFA cell terms come from zfa.obo offline (xref: CL:); nothing to fetch.
# 4. GEO DataSets: zebrafish fin single-cell studies, as leads only (identifiers and titles fetched, nothing integrated)
EU = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
geo = {"queries": [], "series": {}}
for term in ('zebrafish[orgn] AND fin AND ("single cell" OR "single-cell" OR scRNA-seq) AND gse[ETYP]',
             'zebrafish[orgn] AND "pectoral fin" AND ("single cell" OR "single-cell") AND gse[ETYP]',
             'zebrafish[orgn] AND fin regeneration AND ("single cell" OR "single-cell") AND gse[ETYP]'):
    rec, b = call("geo_esearch: " + term, EU + "esearch.fcgi?" + urllib.parse.urlencode({"db": "gds", "retmode": "json", "retmax": 40, "term": term}))
    r = json.loads(b)["esearchresult"] if rec["status"] == 200 else {}
    geo["queries"].append({"term": term, "count": r.get("count"), "ids": r.get("idlist", []), "retrieved": rec["retrieved"]}); time.sleep(0.4)
ids = sorted({i for q in geo["queries"] for i in q["ids"]})
for i in range(0, len(ids), 50):
    rec, b = call(f"geo_esummary_{i // 50}", EU + "esummary.fcgi?" + urllib.parse.urlencode({"db": "gds", "retmode": "json", "id": ",".join(ids[i:i + 50])}))
    if rec["status"] == 200:
        res = json.loads(b)["result"]
        for k in ids[i:i + 50]:
            s = res.get(k, {})
            geo["series"][k] = {"accession": s.get("accession"), "title": s.get("title"), "summary": (s.get("summary") or "")[:600], "n_samples": s.get("n_samples"), "pubdate": s.get("pdat"),
                                "taxon": s.get("taxon"), "gdstype": s.get("gdstype"), "pubmed": s.get("pubmedids"), "ftp": s.get("ftplink")}
    time.sleep(0.4)
json.dump(geo, open(os.path.join(CACHE, "geo_fin_single_cell.json"), "w"), indent=1)
log["calls"] = calls; json.dump(log, open(LOG, "w"), indent=1)
print("GEO series found:", len(geo["series"]))
