"""Extra source records fetched by the Genotype session while vetting map.json (2026-10-31).

Appends to genotype/cache/calls.json (same record shape as genotype/fetch.py) so every call stays logged.
Raw downloads go to RAW (default C:/Temp/genotype/raw). No personal identifier is sent in any request.

What and why:
- ZFIN phenotype_fish.txt + pheno_environment_fish.txt + experiment_details.txt: the "clean" phenotype file
  carries a ZDB-GENOX id but no condition; phenotype_fish.txt carries the ZDB-EXP id and the environment
  file gives each experiment's ZECO condition. Needed to drop chemical-treatment and other non-standard
  conditions from "required for" links.
- ZFIN features-affected-genes.txt: per-allele transcript consequence (premature stop, missense, ...), used
  to say how well "loss of function" is established for a homozygous allele.
- NCBI Gene esummary for zebrafish slc43a2a and human SLC43A2: to settle whether the paper symbol lat4a
  (Daane 2021) is ZFIN's slc43a2a.

Usage: python -I genotype/fetch_extra.py [--raw DIR]
"""
import hashlib, json, os, sys, time, urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
RAW = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else "C:/Temp/genotype/raw"
LOG = os.path.join(CACHE, "calls.json")
UA = {"User-Agent": "delphisci-genotype-thread/0.2 (ScienceClaw hackathon; research use)"}
log = json.load(open(LOG))
calls = log["calls"]


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def call(name, url, dest=None, timeout=900):
    rec = {"name": name, "url": url, "method": "GET", "retrieved": now(), "by": "genotype/fetch_extra.py"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
            body = r.read(); rec["status"] = r.status; rec["last_modified"] = r.headers.get("Last-Modified")
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
    calls[:] = [c for c in calls if c["name"] != name] + [rec]
    print(rec["status"], rec["bytes"], name, flush=True)
    return rec, body


for f in ("phenotype_fish", "pheno_environment_fish", "experiment_details", "features-affected-genes"):
    call("zfin_" + f, f"https://zfin.org/downloads/{f}.txt", dest=os.path.join(RAW, f + ".txt"))

EU = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
genes = {}
for name, term in (("ncbi_gene_esearch_slc43a2a_zebrafish", 'slc43a2a[gene] AND "Danio rerio"[orgn]'),
                   ("ncbi_gene_esearch_SLC43A2_human", 'SLC43A2[gene] AND "Homo sapiens"[orgn]')):
    rec, b = call(name, EU + "esearch.fcgi?" + urllib.parse.urlencode({"db": "gene", "retmode": "json", "term": term}))
    ids = json.loads(b)["esearchresult"]["idlist"] if rec["status"] == 200 else []
    time.sleep(0.4)
    if ids:
        rec2, b2 = call(name.replace("esearch", "esummary"), EU + "esummary.fcgi?" + urllib.parse.urlencode({"db": "gene", "retmode": "json", "id": ids[0]}))
        if rec2["status"] == 200:
            g = json.loads(b2)["result"][ids[0]]
            genes[term] = {"gene_id": ids[0], "retrieved": rec2["retrieved"],
                           **{k: g.get(k) for k in ("name", "description", "otheraliases", "otherdesignations", "organism")}}
    time.sleep(0.4)
json.dump({"note": "NCBI Gene esummary records used to settle the lat4a = slc43a2a question. Queries by symbol and organism only.",
           "genes": genes}, open(os.path.join(CACHE, "ncbi_gene_slc43a2.json"), "w"), indent=1)

log["calls"] = calls
log["note"] = log.get("note", "") + " Records with 'by': 'genotype/fetch_extra.py' were added by the Genotype session on 2026-10-31."
json.dump(log, open(LOG, "w"), indent=1)
print("logged; calls now", len(calls))
