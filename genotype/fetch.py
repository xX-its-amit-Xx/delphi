"""Fetch every source record for the genotype thread.

Raw downloads (tens of MB) go to RAW (default C:/Temp/genotype/raw, because D: is nearly full).
Every call, success or failure, is written to genotype/cache/calls.json with the full URL, the UTC
time, the HTTP status, the byte count and the SHA-256 of the body. Small query results (SPARQL,
PubMed) are also kept in genotype/cache/ so the map can be audited from the repository alone.

Usage: python -I genotype/fetch.py [--raw DIR]
"""
import hashlib, json, os, sys, time, urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
RAW = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else "C:/Temp/genotype/raw"
os.makedirs(CACHE, exist_ok=True); os.makedirs(RAW, exist_ok=True)
LOG = os.path.join(CACHE, "calls.json")
calls = []
UA = {"User-Agent": "delphisci-genotype-thread/0.2 (ScienceClaw hackathon; research use)"}


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def call(name, url, data=None, headers=None, dest=None, timeout=900):
    h = dict(UA); h.update(headers or {})
    rec = {"name": name, "url": url, "method": "POST" if data else "GET", "retrieved": now()}
    if data:
        rec["body"] = data
    try:
        req = urllib.request.Request(url, data=data.encode() if data else None, headers=h)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(); rec["status"] = r.status
            rec["last_modified"] = r.headers.get("Last-Modified")
    except urllib.error.HTTPError as e:
        body = e.read(); rec["status"] = e.code; rec["error"] = str(e)
    except Exception as e:
        body = b""; rec["status"] = None; rec["error"] = repr(e)
    rec["bytes"] = len(body); rec["sha256"] = hashlib.sha256(body).hexdigest()
    if rec["status"] != 200:
        rec["body_head"] = body[:300].decode("utf8", "replace")
    if dest and rec["status"] == 200:
        with open(dest, "wb") as f:
            f.write(body)
        rec["saved_to"] = dest.replace("\\", "/")
    calls.append(rec)
    print(rec["status"], rec["bytes"], name, flush=True)
    return rec, body


def sparql(name, endpoint, q):
    rec, body = call(name, endpoint, data=urllib.parse.urlencode({"query": q}),
                     headers={"Accept": "application/sparql-results+json",
                              "Content-Type": "application/x-www-form-urlencoded"})
    out = None
    if rec["status"] == 200:
        try:
            out = json.loads(body)
        except Exception as e:
            rec["error"] = "not JSON: " + repr(e)[:200]; rec["body_head"] = body[:300].decode("utf8", "replace")
    if out is not None:
        json.dump({"endpoint": endpoint, "query": q, "retrieved": rec["retrieved"], "result": out},
                  open(os.path.join(CACHE, name + ".json"), "w"), indent=1)
    return out


blueprint = json.load(open(os.path.join(HERE, "..", "organism-design", "examples", "a-flying-fish.json")))
cells = sorted({n["iri"] for n in blueprint["nodes"] if n["level"] == "cell"})
uberon = sorted({n["iri"] for n in blueprint["nodes"] if n["level"] != "cell"})
systems = sorted({n["iri"] for n in blueprint["nodes"] if n["level"] == "organ_system"})
body = [n["iri"] for n in blueprint["nodes"] if n["level"] == "body"]

# 1. Bgee SPARQL (tried first; recorded whatever happens)
sparql("bgee_sparql_probe", "https://www.bgee.org/sparql/",
       "PREFIX up: <http://purl.uniprot.org/core/> SELECT ?t WHERE { ?t a up:Taxon } LIMIT 3")
# 2. Bgee REST expression-call page for pectoral fin (tried; recorded)
rec, b = call("bgee_api_expr_calls_pectoral_fin_zebrafish",
              "https://www.bgee.org/api/?page=data&action=expr_calls&display_type=json&species_id=7955"
              "&anat_entity_id=UBERON:0000151&cond_param2=anat_entity&data_type=all")
try:
    j = json.loads(b)
    rec["note"] = "HTTP 200 but no call list; expressionData keys returned: " + ",".join(j.get("data", {}).get("expressionData", {}).keys())
except Exception:
    pass
# 3. Bgee release listing and the two species' anatomy-level call files (advanced: says whether a call
#    includes data observed in that very structure, and which data types)
call("bgee_ftp_root_listing", "https://www.bgee.org/ftp/", dest=os.path.join(RAW, "bgee_root_listing.html"))
call("bgee_ftp_current_listing", "https://www.bgee.org/ftp/current/", dest=os.path.join(RAW, "bgee_current_listing.html"))
for sp in ("Danio_rerio", "Oryzias_latipes"):
    call("bgee_expr_advanced_" + sp,
         f"https://www.bgee.org/ftp/current/download/calls/expr_calls/{sp}_expr_advanced.tsv.gz",
         dest=os.path.join(RAW, f"{sp}_expr_advanced.tsv.gz"))
# 4. ZFIN bulk downloads
for f in ("wildtype-expression_fish", "phenoGeneCleanData_fish", "fish_components_fish", "features",
          "anatomy_item", "anatomy_relationship", "pub_to_pubmed_id_translation", "ensembl_1_to_1",
          "stage_ontology", "aliases"):
    call("zfin_" + f, f"https://zfin.org/downloads/{f}.txt", dest=os.path.join(RAW, f + ".txt"))
# 5. ZFA ontology (ZFA -> CL cross-references) and the GO annotations ZFIN contributes to GO
call("zfa_obo", "http://purl.obolibrary.org/obo/zfa.obo", dest=os.path.join(RAW, "zfa.obo"))
call("go_zfin_gaf", "https://current.geneontology.org/annotations/zfin.gaf.gz", dest=os.path.join(RAW, "zfin.gaf.gz"))
# 6. Ubergraph
UG = "https://ubergraph.apps.renci.org/sparql"
vals = " ".join(f"<{u}>" for u in uberon)
sparql("ubergraph_uberon_zfa_xrefs", UG,
       "PREFIX oio: <http://www.geneontology.org/formats/oboInOwl#> SELECT ?u ?x WHERE { VALUES ?u { " + vals +
       " } ?u oio:hasDbXref ?x . FILTER(STRSTARTS(STR(?x),\"ZFA:\")) }")
vals = " ".join(f"<{c}>" for c in cells)
sparql("ubergraph_cl_expresses", UG,
       "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX owl: <http://www.w3.org/2002/07/owl#> "
       "SELECT DISTINCT ?c ?g ?gl WHERE { VALUES ?c { " + vals + " } ?c rdfs:subClassOf ?r . ?r owl:onProperty "
       "<http://purl.obolibrary.org/obo/RO_0002292> ; owl:someValuesFrom ?g . OPTIONAL { ?g rdfs:label ?gl } }")
# GO biological processes that 'result in development of' (RO:0002296) each blueprint organ system
vals = " ".join(f"<{s}>" for s in systems)
sparql("ubergraph_go_system_development", UG,
       "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> SELECT DISTINCT ?go ?l ?s WHERE { VALUES ?s { " + vals +
       " } ?go <http://purl.obolibrary.org/obo/RO_0002296> ?s . ?go rdfs:label ?l . "
       "FILTER(STRSTARTS(STR(?go),\"http://purl.obolibrary.org/obo/GO_\")) }")
# GO body-plan patterning: anterior/posterior pattern specification (GO:0009952) and its subclasses
sparql("ubergraph_go_ap_patterning", UG,
       "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> SELECT DISTINCT ?go ?l WHERE { "
       "?go rdfs:subClassOf <http://purl.obolibrary.org/obo/GO_0009952> . ?go rdfs:label ?l . "
       "FILTER(STRSTARTS(STR(?go),\"http://purl.obolibrary.org/obo/GO_\")) }")

# 7. PubMed: verify the fin-size leads (never cite from memory)
EU = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
QUERIES = ["kcnk5b AND fin", "another longfin zebrafish", "longfin AND kcnh2a",
           "flying fish AND fin AND (bioelectric OR potassium)", "Exocoetidae AND fin"]
pm = {"queries": [], "summaries": {}, "abstracts_file": "pubmed_abstracts.xml"}
ids = []
for q in QUERIES:
    rec, b = call("pubmed_esearch: " + q, EU + "esearch.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "retmode": "json", "retmax": 50, "term": q}))
    try:
        r = json.loads(b)["esearchresult"]
        pm["queries"].append({"term": q, "count": r["count"], "ids": r["idlist"], "retrieved": rec["retrieved"]})
        ids += r["idlist"]
    except Exception as e:
        pm["queries"].append({"term": q, "error": repr(e)[:200], "retrieved": rec["retrieved"]})
    time.sleep(0.5)
ids = sorted(set(ids))
if ids:
    rec, b = call("pubmed_esummary", EU + "esummary.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "retmode": "json", "id": ",".join(ids)}))
    try:
        res = json.loads(b)["result"]
        for i in ids:
            s = res.get(i, {})
            pm["summaries"][i] = {"title": s.get("title"), "source": s.get("source"), "pubdate": s.get("pubdate"),
                                  "first_author": (s.get("authors") or [{}])[0].get("name"),
                                  "doi": next((a["value"] for a in s.get("articleids", []) if a.get("idtype") == "doi"), None)}
    except Exception as e:
        pm["esummary_error"] = repr(e)[:200]
    time.sleep(0.5)
    call("pubmed_efetch_abstracts", EU + "efetch.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "retmode": "xml", "rettype": "abstract", "id": ",".join(ids)}),
         dest=os.path.join(CACHE, "pubmed_abstracts.xml"))
json.dump(pm, open(os.path.join(CACHE, "pubmed.json"), "w"), indent=1)

json.dump({"note": "Every network call made by genotype/fetch.py, including failures and refusals.",
           "raw_dir": RAW, "calls": calls}, open(LOG, "w"), indent=1)
print("logged", len(calls), "calls to", LOG)
