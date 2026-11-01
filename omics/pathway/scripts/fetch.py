"""Every network call for the pathway layer. Downloads into C:/Temp/omics-cache/pathway/raw (gzip where the
source is not already compressed) and appends one record per call to omics/pathway/calls.json:
full URL, UTC time, HTTP status, bytes, SHA-256 of the bytes as served. Skips a file already present.
Polite: one request at a time, >=1 s apart (KEGG asks for no more than ~3/s). No credentials.
Usage: python -I omics/pathway/scripts/fetch.py
"""
import gzip, hashlib, json, os, sys, time, urllib.request, datetime

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = "C:/Temp/omics-cache/pathway/raw"
LOG = os.path.join(HERE, "calls.json")
os.makedirs(RAW, exist_ok=True)
calls = json.load(open(LOG)) if os.path.exists(LOG) else []
UA = {"User-Agent": "DELPHI-omics-pathway/1.0 (academic research; contact via github ScienceClaw)"}

# name, url, local file, filter (keep line predicate on decoded text) or None
JOBS = [
 ("zfin_gaf", "https://current.geneontology.org/annotations/zfin.gaf.gz", "zfin.gaf.gz", None),
 ("goa_zebrafish_gaf", "https://ftp.ebi.ac.uk/pub/databases/GO/goa/ZEBRAFISH/goa_zebrafish.gaf.gz", "goa_zebrafish.gaf.gz", None),
 ("quickgo_annotation_probe", "https://www.ebi.ac.uk/QuickGO/services/annotation/search?taxonId=7955&limit=1", "quickgo_probe.json.gz", None),
 ("go_basic_obo", "http://purl.obolibrary.org/obo/go/go-basic.obo", "go-basic.obo.gz", None),
 ("reactome_version", "https://reactome.org/ContentService/data/database/version", "reactome_version.txt.gz", None),
 ("reactome_ensembl2reactome_all_levels", "https://reactome.org/download/current/Ensembl2Reactome_All_Levels.txt", "Ensembl2Reactome_All_Levels_dre.txt.gz", lambda l: "\tDanio rerio" in l),
 ("reactome_ensembl2reactome_lowest", "https://reactome.org/download/current/Ensembl2Reactome.txt", "Ensembl2Reactome_dre.txt.gz", lambda l: "\tDanio rerio" in l),
 ("reactome_pathways", "https://reactome.org/download/current/ReactomePathways.txt", "ReactomePathways_dre.txt.gz", lambda l: "\tDanio rerio" in l),
 ("reactome_pathways_relation", "https://reactome.org/download/current/ReactomePathwaysRelation.txt", "ReactomePathwaysRelation_dre.txt.gz", lambda l: l.startswith("R-DRE-")),
 ("kegg_info_dre", "https://rest.kegg.jp/info/dre", "kegg_info_dre.txt.gz", None),
 ("kegg_list_pathway_dre", "https://rest.kegg.jp/list/pathway/dre", "kegg_list_pathway_dre.txt.gz", None),
 ("kegg_link_pathway_dre", "https://rest.kegg.jp/link/pathway/dre", "kegg_link_pathway_dre.txt.gz", None),
 ("kegg_conv_dre_ncbi_geneid", "https://rest.kegg.jp/conv/dre/ncbi-geneid", "kegg_conv_dre_ncbi.txt.gz", None),
 ("wikipathways_gmt_danio_rerio", "https://data.wikipathways.org/20261010/gmt/wikipathways-20261010-gmt-Danio_rerio.gmt", "wikipathways_Danio_rerio.gmt.gz", None),
 ("zfin_gene_ncbi", "https://zfin.org/downloads/gene.txt", "zfin_gene.txt.gz", None),
 ("zfin_uniprot", "https://zfin.org/downloads/uniprot.txt", "zfin_uniprot.txt.gz", None),
 ("zfin_ensembl_1_to_1", "https://zfin.org/downloads/ensembl_1_to_1.txt", "zfin_ensembl_1_to_1.txt.gz", None),
 ("pathwaycommons_v14_gmt", "https://download.baderlab.org/PathwayCommons/PC2/v14/pc-hgnc.gmt.gz", "pc-hgnc.gmt.gz", None),
 ("pathwaycommons_v14_sif", "https://download.baderlab.org/PathwayCommons/PC2/v14/pc-hgnc.sif.gz", "pc-hgnc.sif.gz", None),
 ("pathwaycommons_v14_datasources", "https://download.baderlab.org/PathwayCommons/PC2/v14/datasources.txt", "pc-datasources.txt.gz", None),
 ("zfin_human_orthos", "https://zfin.org/downloads/human_orthos.txt", "zfin_human_orthos.txt.gz", None),
]
EXTRA = [a for a in sys.argv[1:]]
for name, url, fn, filt in JOBS:
    if EXTRA and name not in EXTRA: continue
    out = os.path.join(RAW, fn)
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print("have", fn); continue
    t = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rec = {"call": name, "url": url, "retrieved": t, "local": out}
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=600) as r:
            data = r.read(); rec["status"] = r.status
        rec["bytes"] = len(data); rec["sha256"] = hashlib.sha256(data).hexdigest()
        if url.endswith(".gz"):
            payload = data
        else:
            text = data.decode("utf-8", "replace")
            if filt:
                lines = text.splitlines(True); kept = [l for l in lines if filt(l)]
                rec["filter"] = f"kept {len(kept)} of {len(lines)} lines"; text = "".join(kept)
            payload = gzip.compress(text.encode("utf-8"))
        open(out, "wb").write(payload)
        print("got", fn, rec["bytes"], rec.get("filter", ""))
    except Exception as e:
        rec["status"] = getattr(e, "code", None); rec["error"] = repr(e)[:300]; print("FAIL", name, e)
    calls.append(rec); json.dump(calls, open(LOG, "w"), indent=1)
    time.sleep(1.2)

# Step 2: one GPML per Danio rerio WikiPathways pathway, to read its provenance comment (many zebrafish
# pathways were HomologyConvert-ed from a human pathway; those are labelled borrowed-ortholog downstream).
GP = os.path.join(RAW, "wikipathways_gpml"); os.makedirs(GP, exist_ok=True)
gmt = gzip.open(os.path.join(RAW, "wikipathways_Danio_rerio.gmt.gz"), "rt", encoding="utf-8").read().splitlines()
for line in gmt:
    wp = line.split("\t")[0].split("%")[2]
    out = os.path.join(GP, wp + ".gpml.gz")
    if os.path.exists(out): continue
    url = f"https://www.wikipathways.org/wikipathways-assets/pathways/{wp}/{wp}.gpml"
    t = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rec = {"call": "wikipathways_gpml", "url": url, "retrieved": t, "local": out}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            data = r.read(); rec["status"] = r.status
        rec["bytes"] = len(data); rec["sha256"] = hashlib.sha256(data).hexdigest()
        open(out, "wb").write(gzip.compress(data))
    except Exception as e:
        rec["status"] = getattr(e, "code", None); rec["error"] = repr(e)[:300]; print("FAIL", wp, e)
    calls.append(rec); json.dump(calls, open(LOG, "w"), indent=1)
    time.sleep(1.0)
print("gpml done")
