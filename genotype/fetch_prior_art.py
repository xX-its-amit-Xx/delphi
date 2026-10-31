"""One logged PubMed lookup for the propagation-rule precedent (nuance 2 of the brief): do Phenoscape, Monarch
or the EQ phenotype-ontology literature document propagation of phenotypes along part_of? Appends to
genotype/cache/calls.json and writes genotype/cache/pubmed_propagation.json. No personal identifier is sent.
Usage: python -I genotype/fetch_prior_art.py
"""
import hashlib, json, os, time, urllib.parse, urllib.request, urllib.error
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, "cache"); LOG = os.path.join(CACHE, "calls.json")
UA = {"User-Agent": "delphisci-genotype-thread/0.2 (ScienceClaw hackathon; research use)"}
log = json.load(open(LOG)); calls = log["calls"]
def now(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
def call(name, url):
    rec = {"name": name, "url": url, "method": "GET", "retrieved": now(), "by": "genotype/fetch_prior_art.py"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r: body = r.read(); rec["status"] = r.status
    except urllib.error.HTTPError as e: body = e.read(); rec["status"] = e.code; rec["error"] = str(e)
    except Exception as e: body = b""; rec["status"] = None; rec["error"] = repr(e)
    rec["bytes"] = len(body); rec["sha256"] = hashlib.sha256(body).hexdigest()
    calls[:] = [c for c in calls if c["name"] != name] + [rec]; print(rec["status"], rec["bytes"], name); return rec, body
EU = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
out = {"queries": [], "abstracts": {}}
for term in ('"phenotype ontology" AND "part of" AND propagation', 'Phenoscape AND reasoning AND phenotype AND (part_of OR "part of")',
             'uPheno AND cross-species AND phenotype ontology', 'Monarch Initiative AND phenotype AND ontology AND inference'):
    rec, b = call("pubmed_esearch_propagation: " + term, EU + "esearch.fcgi?" + urllib.parse.urlencode({"db": "pubmed", "retmode": "json", "retmax": 20, "term": term}))
    r = json.loads(b)["esearchresult"] if rec["status"] == 200 else {}
    out["queries"].append({"term": term, "count": r.get("count"), "ids": r.get("idlist", []), "retrieved": rec["retrieved"]}); time.sleep(0.4)
ids = sorted({i for q in out["queries"] for i in q["ids"]})
if ids:
    rec, b = call("pubmed_efetch_propagation_abstracts", EU + "efetch.fcgi?" + urllib.parse.urlencode({"db": "pubmed", "retmode": "xml", "rettype": "abstract", "id": ",".join(ids)}))
    if rec["status"] == 200:
        for a in ET.fromstring(b).iter("PubmedArticle"):
            pmid = a.find(".//PMID").text
            doi = next((x.text for x in a.findall(".//ArticleId") if x.get("IdType") == "doi"), None)
            out["abstracts"][pmid] = {"title": "".join(a.find(".//ArticleTitle").itertext()), "doi": doi, "year": (a.find(".//PubDate/Year").text if a.find(".//PubDate/Year") is not None else None),
                                     "journal": (a.find(".//Journal/Title").text if a.find(".//Journal/Title") is not None else None),
                                     "abstract": " ".join("".join(x.itertext()) for x in a.findall(".//AbstractText"))}
json.dump(out, open(os.path.join(CACHE, "pubmed_propagation.json"), "w"), indent=1)
log["calls"] = calls; json.dump(log, open(LOG, "w"), indent=1)
for pmid, a in out["abstracts"].items():
    hit = [w for w in ("part of", "part_of", "partonomy", "propagat", "inherit", "reasoner", "subsumption") if w in a["abstract"].lower()]
    print(pmid, a["doi"], a["year"], a["title"][:90], hit)
