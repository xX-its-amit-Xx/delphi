"""Reproduce the Ubergraph typed-literal gotcha with two logged probe queries, for the nanopub record.
Same term (ZFA:0001161, pectoral fin), same query, one VALUES block with a plain literal and one with an
xsd:string-typed literal. Appends to genotype/cache/calls.json; results in genotype/cache/.
Usage: python -I genotype/fetch_ubergraph_probe.py
"""
import hashlib, json, os, time, urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, "cache"); LOG = os.path.join(CACHE, "calls.json")
UA = {"User-Agent": "delphisci-genotype-thread/0.2 (ScienceClaw hackathon; research use)", "Accept": "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded"}
log = json.load(open(LOG)); calls = log["calls"]
UG = "https://ubergraph.apps.renci.org/sparql"
Q = ("PREFIX oio: <http://www.geneontology.org/formats/oboInOwl#> SELECT ?u ?x WHERE { VALUES ?x { %s } ?u oio:hasDbXref ?x . "
     "FILTER(STRSTARTS(STR(?u),\"http://purl.obolibrary.org/obo/UBERON_\")) }")
out = {}
for name, lit in (("ubergraph_probe_plain_literal_values", '"ZFA:0001161"'), ("ubergraph_probe_typed_literal_values", '"ZFA:0001161"^^<http://www.w3.org/2001/XMLSchema#string>')):
    q = Q % lit
    rec = {"name": name, "url": UG, "method": "POST", "body": urllib.parse.urlencode({"query": q}), "retrieved": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "by": "genotype/fetch_ubergraph_probe.py"}
    try:
        with urllib.request.urlopen(urllib.request.Request(UG, data=rec["body"].encode(), headers=UA), timeout=120) as r: body = r.read(); rec["status"] = r.status
    except urllib.error.HTTPError as e: body = e.read(); rec["status"] = e.code; rec["error"] = str(e)
    rec["bytes"] = len(body); rec["sha256"] = hashlib.sha256(body).hexdigest()
    res = json.loads(body) if rec["status"] == 200 else None
    n = len(res["results"]["bindings"]) if res else None
    rec["note"] = f"{n} bindings"
    out[name] = {"query": q, "retrieved": rec["retrieved"], "status": rec["status"], "bytes": rec["bytes"], "bindings": n, "result": res}
    calls[:] = [c for c in calls if c["name"] != name] + [rec]
    print(rec["status"], rec["bytes"], name, "bindings", n)
    time.sleep(0.5)
json.dump(out, open(os.path.join(CACHE, "ubergraph_probe_literal_typing.json"), "w"), indent=1)
log["calls"] = calls; json.dump(log, open(LOG, "w"), indent=1)
