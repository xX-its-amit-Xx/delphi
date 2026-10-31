#!/usr/bin/env python
"""Fetch, for every parameter a dynamical simulation needs, what the databases
actually hold for the 4,571 genes in genotype/map.vetted.json.

Every outbound request is logged to simulation-readiness/calls.json with the full
URL, UTC time, HTTP status, bytes and SHA-256 of the body. No personal identifier
(no email, no name, no API key) is ever sent: the User-Agent is generic.
Raw bodies are kept in C:/Temp/simready/raw and are NOT committed (D: is full).

Run:  python -I simulation-readiness/fetch.py [stage ...]
Stages: zfin paxdb sabio brenda bionumbers gxa pride string intact omnipath epmc
"""
import hashlib, json, os, sys, time, urllib.parse
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = "C:/Temp/simready/raw"
CALLS = os.path.join(HERE, "calls.json")
UA = "DELPHI-simulation-readiness/1.0 (research; no contact data sent)"
os.makedirs(RAW, exist_ok=True)

_log = []
if os.path.exists(CALLS):
    try:
        _log = json.load(open(CALLS, encoding="utf-8"))["calls"]
    except Exception:
        _log = []


def save_log():
    json.dump({
        "note": ("Every outbound request made for simulation-readiness/. No personal identifier "
                 "was sent: generic User-Agent, no email, no name, no API key. Raw bodies are in "
                 "C:/Temp/simready/raw and are not committed."),
        "user_agent": UA,
        "n": len(_log),
        "calls": _log,
    }, open(CALLS, "w", encoding="utf-8"), indent=1)


def get(url, out=None, item=None, why=None, accept=None, tries=3, timeout=180):
    """GET url, log it, return (status, body, local path)."""
    hdr = {"User-Agent": UA}
    if accept:
        hdr["Accept"] = accept
    status, body, err, path = None, None, None, None
    for t in range(tries):
        try:
            r = requests.get(url, headers=hdr, timeout=timeout)
            status, body = r.status_code, r.content
            break
        except Exception as e:
            err = "%s: %s" % (type(e).__name__, e)
            status = 0
            time.sleep(2 + 3 * t)
    rec = {
        "t": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "method": "GET",
        "url": url,
        "status": status,
        "bytes": len(body) if body else 0,
        "sha256": hashlib.sha256(body).hexdigest() if body else None,
        "item": item,
        "why": why,
    }
    if err:
        rec["error"] = err
    if body and out:
        path = os.path.join(RAW, out)
        with open(path, "wb") as f:
            f.write(body)
        rec["saved"] = path
    _log.append(rec)
    save_log()
    print("  %3s %10d  %s" % (status, len(body) if body else 0, url[:110]))
    return status, body, path


# ---------------------------------------------------------------- stages

def stage_zfin():
    """ZFIN identifier crosswalks: our gene keys are ZFIN IDs; the databases
    below are keyed on UniProt, Ensembl or human symbol."""
    for fn, why in [
        ("uniprot.txt", "ZFIN gene -> UniProt accession, to query SABIO-RK and PaxDb"),
        ("ensembl_1_to_1.txt", "ZFIN gene -> Ensembl gene, to query STRING and Expression Atlas"),
        ("gene.txt", "ZFIN gene -> NCBI GeneID"),
        ("human_orthos.txt", "ZFIN gene -> human ortholog, the only route to human-only TF-target sets"),
    ]:
        get("https://zfin.org/downloads/" + fn, out="zfin_" + fn, item="crosswalk", why=why)


def stage_paxdb():
    get("https://pax-db.org/downloads/latest/datasets/7955/", out="paxdb_7955_index.html",
        item="a", why="list every PaxDb Danio rerio abundance dataset")
    for ds in ["7955-WHOLE_ORGANISM-integrated.txt", "7955-EMBRYO-integrated.txt",
               "7955-ZF_Embryo48hrs_Kelkar_2014_SEQUEST.txt",
               "7955-ZF_Embryo120hr_Kelkar_2014_SEQUEST.txt",
               "7955-PXD016235_juvenile_proteome.txt"]:
        get("https://pax-db.org/downloads/latest/datasets/7955/" + ds, out="paxdb_" + ds,
            item="a", why="protein abundance (ppm, relative) per zebrafish gene")


def stage_sabio():
    """SABIO-RK, the enzyme-kinetics database. Its API moved to /api/sabio/*."""
    get("https://sabiork.h-its.org/api/sabio/statistics/digest-website", out="sabio_digest.json",
        item="e", why="total size of SABIO-RK, for context", accept="application/json")
    for p in range(1, 9):
        get("https://sabiork.h-its.org/api/sabio/uniprot/index-website?size=1000&page=%d" % p,
            out="sabio_uniprot_%d.json" % p, item="e",
            why="every UniProt accession with kinetic entries in SABIO-RK; _DANRE = zebrafish",
            accept="application/json")
    for p in range(1, 55):
        get("https://sabiork.h-its.org/api/sabio/organism/index-website?size=25&page=%d" % p,
            out="sabio_organism_%d.json" % p, item="e",
            why="SABIO-RK entry count per organism, to read off Danio rerio",
            accept="application/json")
    get("https://sabiork.h-its.org/api/sabio/parameter-type/index-website?size=100",
        out="sabio_paramtypes.json", item="g",
        why="does SABIO-RK hold a Hill coefficient parameter type at all",
        accept="application/json")


def stage_brenda():
    base = "https://sparql.dsmz.de/api/brenda"
    qs = [
        ("triples", "SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }"),
        ("classes", "SELECT ?c (COUNT(?s) AS ?n) WHERE { ?s a ?c } GROUP BY ?c ORDER BY DESC(?n)"),
        ("predicates", "SELECT ?p (COUNT(*) AS ?n) WHERE { ?s ?p ?o } GROUP BY ?p ORDER BY DESC(?n)"),
        ("danio_taxid", 'SELECT ?bm ?t WHERE { ?bm <http://purl.org/dc/terms/hasTaxID> ?t . '
                        'FILTER(CONTAINS(STR(?t), "7955")) } LIMIT 200'),
        ("danio_label", 'SELECT ?bm ?l WHERE { ?bm a <https://purl.dsmz.de/schema/BiologicalMaterial> ; '
                        '<http://www.w3.org/2000/01/rdf-schema#label> ?l . '
                        'FILTER(CONTAINS(STR(?l), "Danio")) } LIMIT 200'),
    ]
    for name, q in qs:
        get(base + "?" + urllib.parse.urlencode({"query": q}), out="brenda_%s.json" % name,
            item="e", why="BRENDA open SPARQL prototype: " + name,
            accept="application/sparql-results+json")
    get("https://www.brenda-enzymes.org/download.php", out="brenda_download.html",
        item="e", why="what BRENDA bulk kinetic data requires (licence / registration)")


def stage_bionumbers():
    terms = [
        ("zebrafish", None), ("Danio rerio", None),
        ("protein degradation rate", None), ("protein degradation rate", "Danio rerio"),
        ("mRNA degradation rate", None), ("mRNA degradation rate", "Danio rerio"),
        ("mRNA lifetime", "Danio rerio"), ("protein lifetime", "Danio rerio"),
        ("transcription rate", None), ("transcription rate", "Danio rerio"),
        ("translation rate", "Danio rerio"),
        ("Hill coefficient", None), ("Hill coefficient", "Danio rerio"),
        ("diffusion coefficient", None), ("diffusion coefficient", "Danio rerio"),
        ("protein concentration", "Danio rerio"), ("copy number", "Danio rerio"),
        ("dissociation constant", "Danio rerio"), ("Km", "Danio rerio"),
        ("promoter strength", None),
    ]
    for trm, org in terms:
        p = {"task": "searchbytrmorg", "trm": trm}
        if org:
            p["org"] = org
        tag = (trm + ("_" + org if org else "")).replace(" ", "_")
        get("https://bionumbers.hms.harvard.edu/search.aspx?" + urllib.parse.urlencode(p),
            out="bn_%s.html" % tag, item="b/c/d/g",
            why="BioNumbers search: term=%r org=%r" % (trm, org))


def stage_bnall():
    """Enumerate EVERY BioNumbers entry that mentions zebrafish, by following the
    &pi= paging links to the end. This is the complete census: it does not depend
    on the org= filter, whose behaviour is not documented."""
    for trm in ["zebrafish", "Danio rerio"]:
        tag = trm.replace(" ", "_")
        pi = 1
        while pi <= 40:
            url = ("https://bionumbers.hms.harvard.edu/search.aspx?"
                   + urllib.parse.urlencode({"task": "searchbytrmorg", "trm": trm})
                   + ("&pi=%d" % pi if pi > 1 else ""))
            st, body, _ = get(url, out="bnall_%s_p%d.html" % (tag, pi), item="census",
                              why="complete BioNumbers census for %r, page %d" % (trm, pi))
            if not body:
                break
            h = body.decode("utf-8", "replace")
            if "No results" in h or ('aria-label="Paging Next"' in h
                                     and 'Paging Next">\n' not in h and "pi=%d" % (pi + 1) not in h):
                break
            pi += 1
    # does org= filter at all? two controls with the same term
    for org in ["Danio rerio", "Escherichia coli"]:
        get("https://bionumbers.hms.harvard.edu/search.aspx?"
            + urllib.parse.urlencode({"task": "searchbytrmorg", "trm": "egg diameter", "org": org}),
            out="bnctl_egg_%s.html" % org.replace(" ", "_"), item="census",
            why="control: does the BioNumbers org= parameter actually filter (org=%s)" % org)


def stage_gxa():
    get("https://www.ebi.ac.uk/gxa/json/experiments", out="gxa_experiments.json",
        item="a", why="every Expression Atlas experiment, to count the zebrafish ones and their units",
        accept="application/json")


def stage_pride():
    for url, out in [
        ("https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects?keyword=Danio%20rerio&pageSize=100&page=0",
         "pride_danio_p0.json"),
        ("https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects?keyword=zebrafish%20absolute%20quantification&pageSize=100&page=0",
         "pride_absquant.json"),
    ]:
        get(url, out=out, item="a",
            why="PRIDE projects: is there a calibrated absolute zebrafish proteome",
            accept="application/json")


def stage_string():
    for url, out, why in [
        ("https://stringdb-downloads.org/download/protein.links.full.v12.0/7955.protein.links.full.v12.0.txt.gz",
         "string_7955.links.full.txt.gz",
         "STRING zebrafish network with evidence channels separated (experiments vs transferred)"),
        ("https://stringdb-downloads.org/download/protein.aliases.v12.0/7955.protein.aliases.v12.0.txt.gz",
         "string_7955.aliases.txt.gz", "STRING protein id -> ZFIN/Ensembl/symbol"),
        ("https://stringdb-downloads.org/download/protein.info.v12.0/7955.protein.info.v12.0.txt.gz",
         "string_7955.info.txt.gz", "STRING protein id -> preferred name"),
    ]:
        get(url, out=out, item="h", why=why, timeout=1200)


def stage_intact():
    get("https://www.ebi.ac.uk/intact/ws/interaction/countTotal", out="intact_total.json",
        item="h", why="IntAct total, for context", accept="application/json")
    for q, out in [
        ("taxidA:7955 AND taxidB:7955", "intact_danio_both.json"),
        ('species:"Danio rerio"', "intact_danio_species.json"),
    ]:
        get("https://www.ebi.ac.uk/intact/ws/interaction/findInteractions/"
            + urllib.parse.quote(q) + "?page=0&pageSize=1",
            out=out, item="h", why="IntAct curated interactions, query %r" % q,
            accept="application/json")


def stage_intactpages():
    """The IntAct ws Lucene fields (taxidA:, species:) all return 0; the free-text
    query '7955' returns 5,741 records, each carrying taxIdA / taxIdB / uniqueIdA /
    uniqueIdB. Pull them all and filter on taxId exactly, so the count is exact."""
    for p in range(0, 12):
        st, body, _ = get("https://www.ebi.ac.uk/intact/ws/interaction/findInteractions/7955"
                          "?page=%d&pageSize=500" % p,
                          out="intact_7955_p%d.json" % p, item="h",
                          why="IntAct curated interactions, free-text 7955, page %d" % p,
                          accept="application/json", timeout=300)
        try:
            d = json.loads(body)
            if d.get("last") or not d.get("content"):
                break
        except Exception:
            break


def stage_omnipath():
    get("https://omnipathdb.org/queries/interactions", out="omnipath_queries.txt",
        item="h", why="which organisms OmniPath / CollecTRI / DoRothEA serve at all")
    get("https://omnipathdb.org/interactions?datasets=collectri&organisms=9606&fields=sources,references&format=tsv",
        out="omnipath_collectri_human.tsv", item="h",
        why="CollecTRI human signed TF-target edges; the only route to zebrafish is orthology transfer",
        timeout=900)
    get("https://omnipathdb.org/interactions?datasets=collectri&organisms=7955&limit=3",
        out="omnipath_collectri_danio.txt", item="h",
        why="record that OmniPath refuses a zebrafish request")


def stage_epmc():
    """Literature hit counts only. A paper count is NOT a parameter count; these
    are recorded to show whether the measurement exists in the literature at all."""
    qs = [
        ("protein_halflife", '(ZEBRAFISH OR "Danio rerio") AND ("protein half-life" OR "protein turnover" OR "protein degradation rate")'),
        ("mrna_halflife", '(ZEBRAFISH OR "Danio rerio") AND ("mRNA half-life" OR "mRNA decay rate" OR "transcript stability")'),
        ("transcription_rate", '(ZEBRAFISH OR "Danio rerio") AND ("transcription rate" OR "promoter strength" OR "polymerase elongation rate")'),
        ("absolute_copies", '(ZEBRAFISH OR "Danio rerio") AND ("molecules per cell" OR "copies per cell" OR "absolute quantification")'),
        ("hill_coefficient", '(ZEBRAFISH OR "Danio rerio") AND "Hill coefficient"'),
        ("kd_affinity", '(ZEBRAFISH OR "Danio rerio") AND ("dissociation constant" OR "binding affinity")'),
        ("grn_zebrafish", '(ZEBRAFISH OR "Danio rerio") AND "gene regulatory network"'),
    ]
    for name, q in qs:
        get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?"
            + urllib.parse.urlencode({"query": q, "format": "json", "pageSize": "1"}),
            out="epmc_%s.json" % name, item="b/c/d/e/g",
            why="Europe PMC hit count for %s: does the measurement exist in the literature" % name,
            accept="application/json")


def stage_xu():
    """The worked example: the only flying-fish genome paper. Does a genome with
    near-complete functional annotation carry any simulation parameter?"""
    get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?"
        + urllib.parse.urlencode({"query": 'DOI:"10.3389/fgene.2021.695700"',
                                  "format": "json", "resultType": "core"}),
        out="xu2021_epmc.json", item="worked_example",
        why="metadata and open-access status of Xu et al. 2021, the mirrorwing flyingfish genome",
        accept="application/json")
    get("https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8294118/fullTextXML",
        out="xu2021_fulltext.xml", item="worked_example",
        why="full text of Xu et al. 2021, to count annotated genes and check for any kinetic parameter")
    get("https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8294118/supplementaryFiles",
        out="xu2021_suppl.zip", item="worked_example",
        why="supplementary files of Xu et al. 2021: is any parameter table there")


STAGES = {k[6:]: v for k, v in list(globals().items()) if k.startswith("stage_")}

if __name__ == "__main__":
    want = sys.argv[1:] or list(STAGES)
    for s in want:
        print("\n=== %s ===" % s)
        STAGES[s]()
    save_log()
    print("\n%d calls logged to %s" % (len(_log), CALLS))
