"""Tier 1: pathway membership for every gene in the vetted genotype map, from BULK files only.

Sources (all downloaded by genotype/agent_fetch.py into C:/Temp/genotype/pathways, every call in
genotype/cache/calls_pathways.json):
  - Gene Ontology biological process, from ZFIN's GAF (current.geneontology.org/annotations/zfin.gaf.gz).
    Every evidence code is kept and recorded; NOT-qualified annotations are dropped. GO is a process
    vocabulary, not a pathway database, so these are labelled source "GO:BP".
  - Reactome, from Ensembl2Reactome.txt. Every Danio rerio row carries evidence code IEA, and Reactome's own
    documentation states that non-human events are electronically inferred from curated human reactions using
    PANTHER orthology, so every Reactome entry here is marked inferred_by_orthology: true with that quote.
    Reactome holds no Oryzias latipes rows (checked: 0).
  - KEGG pathways for Danio rerio (dre), from rest.kegg.jp link/list/info. KEGG gene ids for dre are NCBI
    GeneIDs, joined to ZFIN ids through ZFIN's gene.txt. KEGG REST is free for academic use; this build makes
    four calls in total.

PATHWAY MEMBERSHIP IS NOT CAUSATION, and a membership is not evidence that the gene acts in that pathway in
the fin, in a flying fish, or at all: GO IEA and Reactome IEA rows are computational. The causal chains with
graded evidence are in genotype/causal-chains.json.

Offline. Usage: python -I genotype/build_pathways.py [--raw DIR] [--pw DIR]
"""
import collections, gzip, json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, "cache")
RAW = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else "C:/Temp/genotype/raw"
PW = sys.argv[sys.argv.index("--pw") + 1] if "--pw" in sys.argv else "C:/Temp/genotype/pathways"
CALLS = {c["name"]: c for c in json.load(open(os.path.join(CACHE, "calls_pathways.json")))["calls"]}
def src(name, database, note=None):
    c = CALLS[name]; return {"database": database, "call": name, "url": c["url"], "retrieved": c["retrieved"], "sha256": c["sha256"], **({"note": note} if note else {})}
def tsv(path):
    for line in open(path, encoding="utf8", errors="replace"): yield line.rstrip("\r\n").split("\t")

# ------------------------------------------------------------------ the gene universe: the vetted map
M = json.load(open(os.path.join(HERE, "map.vetted.json"), encoding="utf8"))
genes = M["genes"]                      # key -> {symbol, breadth}
sym_of = {k: v.get("symbol") for k, v in genes.items()}
zdb_keys = {k[3:]: k for k in genes if k.startswith("ZF:ZDB-GENE-")}
ens_keys = {k[3:]: k for k in genes if k.startswith("ZF:ENSDARG")}
md_keys = {k[3:]: k for k in genes if k.startswith("MD:")}
# ZFIN's own identifier tables, for joining the other two sources
zdb2ens, ens2zdb = {}, collections.defaultdict(set)
for r in tsv(os.path.join(RAW, "ensembl_1_to_1.txt")):
    if len(r) >= 4: zdb2ens[r[0]] = r[3]; ens2zdb[r[3]].add(r[0])
zdb2ncbi, ncbi2zdb = {}, collections.defaultdict(set)
for r in tsv(os.path.join(PW, "zfin_gene.txt")):
    if len(r) >= 4 and r[0].startswith("ZDB-GENE-") and r[3]: zdb2ncbi[r[0]] = r[3]; ncbi2zdb[r[3]].add(r[0])
def key_for_zdb(z): return zdb_keys.get(z) or (ens_keys.get(zdb2ens.get(z, "")) if zdb2ens.get(z) else None)

pathways = collections.defaultdict(list)          # gene key -> [entry]
pw_meta = {}                                      # pathway id -> {name, source}
unmatched = collections.Counter()

# ------------------------------------------------------------------ GO biological process (ZFIN GAF)
go_name, cur = {}, None
for line in open(os.path.join(PW, "go-basic.obo"), encoding="utf8"):
    line = line.strip()
    if line.startswith("id: GO:"): cur = line[4:]
    elif cur and line.startswith("name: "): go_name[cur] = line[6:]
    elif cur and line.startswith("namespace: "): go_name[cur + "|ns"] = line[11:]
gaf_date, go_rows = None, collections.Counter()
seen = set()
with gzip.open(os.path.join(PW, "zfin.gaf.gz"), "rt", encoding="utf8") as f:
    for line in f:
        if line.startswith("!date-generated"): gaf_date = line.split(":", 1)[1].strip()
        if line.startswith("!"): continue
        r = line.rstrip("\n").split("\t")
        if len(r) < 15: continue
        zdb, sym, qual, go, ref, code, aspect = r[1], r[2], r[3], r[4], r[5], r[6], r[8]
        if aspect != "P" or "NOT" in qual: continue        # biological process only
        k = key_for_zdb(zdb)
        if not k: unmatched["GO row's gene not in the vetted map"] += 1; continue
        if (k, go, code) in seen: continue
        seen.add((k, go, code))
        go_rows[code] += 1
        pathways[k].append({"pathway": go, "name": go_name.get(go, ""), "source": "GO:BP", "evidence_code": code,
                            "inferred_by_orthology": False, "computational": code in ("IEA", "ISS", "ISO", "ISA", "ISM", "IBA", "IKR", "IRD", "RCA"), "reference": ref})
        pw_meta[go] = {"name": go_name.get(go, ""), "source": "GO:BP", "ontology_namespace": go_name.get(go + "|ns")}

# ------------------------------------------------------------------ Reactome (inferred by orthology from human)
REACTOME_QUOTE = ("Reactome documentation, 'Inferred events': \"we use curated human reactions to electronically infer reactions in fourteen "
                  "evolutionarily divergent eukaryotic species\"; homology comes from PANTHER. Every Danio rerio row in Ensembl2Reactome.txt "
                  "carries evidence code IEA, and the ContentService reports isInferred: true for a Danio rerio pathway (checked on R-DRE-8866652).")
reactome_version = open(os.path.join(PW, "reactome_version.txt"), encoding="utf8").read().strip()
rx_rows = collections.Counter()
for r in tsv(os.path.join(PW, "Ensembl2Reactome.txt")):
    if len(r) < 6 or r[5] != "Danio rerio": continue
    ens, pid, _url, pname, code = r[0], r[1], r[2], r[3], r[4]
    ks = {ens_keys[ens]} if ens in ens_keys else {zdb_keys[z] for z in ens2zdb.get(ens, ()) if z in zdb_keys}
    if not ks: unmatched["Reactome row's Ensembl gene not in the vetted map"] += 1; continue
    for k in ks:
        rx_rows[code] += 1
        pathways[k].append({"pathway": pid, "name": pname, "source": "Reactome", "evidence_code": code, "inferred_by_orthology": True,
                            "computational": True, "inference_note": "Reactome's zebrafish events are electronically inferred from curated human reactions (PANTHER orthology); see sources.reactome.note"})
        pw_meta[pid] = {"name": pname, "source": "Reactome", "inferred_by_orthology": True}

# ------------------------------------------------------------------ KEGG dre
kegg_info = open(os.path.join(PW, "kegg_info_dre.txt"), encoding="utf8").read().strip().splitlines()
kegg_name = {}
for r in tsv(os.path.join(PW, "kegg_list_pathway_dre.txt")):
    if len(r) >= 2: kegg_name[r[0]] = r[1].split(" - Danio rerio")[0]
kegg_rows = 0
for r in tsv(os.path.join(PW, "kegg_link_pathway_dre.txt")):
    if len(r) < 2: continue
    gene, path = r[0].replace("dre:", ""), r[1].replace("path:", "")
    ks = {zdb_keys[z] for z in ncbi2zdb.get(gene, ()) if z in zdb_keys} | {ens_keys[zdb2ens[z]] for z in ncbi2zdb.get(gene, ()) if zdb2ens.get(z) in ens_keys}
    if not ks: unmatched["KEGG dre gene (NCBI GeneID) not in the vetted map"] += 1; continue
    for k in ks:
        kegg_rows += 1
        pathways[k].append({"pathway": path, "name": kegg_name.get(path, ""), "source": "KEGG", "evidence_code": "KEGG pathway membership (curated map, zebrafish-specific)",
                            "inferred_by_orthology": False, "computational": False, "note": "KEGG assigns zebrafish genes to its dre maps through KEGG Orthology; the map is drawn per species"})
        pw_meta[path] = {"name": kegg_name.get(path, ""), "source": "KEGG"}

# ------------------------------------------------------------------ per-pathway gene lists, coverage
by_pathway = collections.defaultdict(set)
for k, es in pathways.items():
    for e in es: by_pathway[e["pathway"]].add(k)
def cov(keys):
    have = sum(1 for k in keys if pathways.get(k))
    per_src = {s: sum(1 for k in keys if any(e["source"] == s for e in pathways.get(k, ()))) for s in ("GO:BP", "Reactome", "KEGG")}
    return {"genes": len(keys), "with_any_pathway": have, "fraction": round(have / len(keys), 4) if keys else 0, "by_source": per_src}
fin = json.load(open(os.path.join(HERE, "fin-subtree.full.json"), encoding="utf8"))
fin_genes = {l["gene"] for L in fin["layers"].values() for l in L["links"] if l["link_type"] in ("required for", "sufficient for")}
pf_genes = {l["gene"] for L in fin["layers"].values() for l in L["links"] if l["blueprint_node"] == "ZFA:0001161"}

out = {
 "title": "Pathway membership for every gene in the vetted genotype map, from bulk sources",
 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/build_pathways.py", "vetted": True,
 "not_causation": ("Pathway membership is NOT causation and not a claim about the fin. A gene appears here because a database places it in a process or "
                   "map, often computationally: GO IEA and Reactome IEA rows are electronic annotations, and every Reactome zebrafish entry is inferred "
                   "by orthology from human. Membership does not show that the gene acts in that pathway in the pectoral fin, at any stage, or in a flying "
                   "fish. Graded causal evidence is in genotype/causal-chains.json."),
 "constraint": "Zebrafish (and, where a source has them, medaka) genes only. No flying-fish pathway data exists.",
 "sources": {
   "go_bp": {**src("zfin_gene_association_gaf", "Gene Ontology (ZFIN annotations)"), "gaf_date_generated": gaf_date, "aspect": "biological process (P) only; NOT-qualified annotations dropped",
             "note": "GO is a process ontology, not a pathway database. Evidence code is kept on every entry; computational codes are flagged.", "rows_by_evidence_code": dict(go_rows.most_common()),
             "go_obo": src("go_basic_obo", "Gene Ontology")},
   "reactome": {**src("reactome_ensembl2reactome", "Reactome"), "database_version": reactome_version, "species_filter": "Danio rerio rows only (Oryzias latipes rows in this file: 0)",
                "rows_by_evidence_code": dict(rx_rows.most_common()), "inferred_by_orthology": True, "note": REACTOME_QUOTE,
                "documentation": src("reactome_orthology_inference_doc", "Reactome"), "version_call": src("reactome_database_version", "Reactome"), "example_event_checked": src("reactome_query_dre_event_inferred", "Reactome")},
   "kegg": {**src("kegg_link_pathway_dre", "KEGG"), "release": kegg_info, "pathway_names": src("kegg_list_pathway_dre", "KEGG"), "gene_id_conversion": src("kegg_conv_dre_ncbi_geneid", "KEGG"),
            "note": "KEGG gene ids for dre are NCBI GeneIDs, joined to ZFIN ids through ZFIN's gene.txt. Free for academic use; four calls made.", "rows_matched": kegg_rows},
   "identifier_joins": {"zfin_ensembl_1_to_1": "C:/Temp/genotype/raw/ensembl_1_to_1.txt (already in the thread's raw set)", "zfin_gene_ncbi": src("zfin_gene_ids", "ZFIN")},
 },
 "coverage": {"all_genes_in_vetted_map": cov(set(genes)), "zebrafish_genes": cov({k for k in genes if k.startswith("ZF:")}),
              "medaka_genes": {**cov(set(md_keys.values()) if md_keys else set()), "note": "No source used here holds Oryzias latipes pathway rows: Reactome has none, KEGG dre is zebrafish, the GAF is ZFIN."},
              "fin_subtree_required_or_sufficient_genes": cov(fin_genes), "pectoral_fin_node_genes": cov(pf_genes),
              "unmatched_source_rows": dict(unmatched)},
 "summary": {"genes_with_any_pathway": sum(1 for k in genes if pathways.get(k)), "distinct_pathways": len(pw_meta),
             "distinct_pathways_by_source": dict(collections.Counter(v["source"] for v in pw_meta.values())),
             "entries": sum(len(v) for v in pathways.values()), "entries_by_source": dict(collections.Counter(e["source"] for v in pathways.values() for e in v)),
             "entries_computational": sum(1 for v in pathways.values() for e in v if e["computational"]),
             "entries_inferred_by_orthology": sum(1 for v in pathways.values() for e in v if e["inferred_by_orthology"]),
             "median_pathways_per_gene": (lambda xs: sorted(xs)[len(xs) // 2] if xs else 0)([len({e["pathway"] for e in v}) for v in pathways.values()])},
 "genes": {k: {"symbol": sym_of.get(k), "n": len({e["pathway"] for e in v}), "pathways": v} for k, v in sorted(pathways.items())},
 "pathways": {p: {**pw_meta[p], "n_genes": len(by_pathway[p]), "genes": sorted(by_pathway[p])} for p in sorted(pw_meta)},
}
dst = os.path.join(HERE, "pathways.json")
json.dump(out, open(dst, "w", encoding="utf8"), separators=(",", ":"))

# compact copy for the repository: names live once in the pathway table, each gene carries tuples
# [pathway id, source code, evidence code, inferred?]; per-pathway gene lists kept only for fin genes.
SRC_CODE = {"GO:BP": "G", "Reactome": "R", "KEGG": "K"}
slim = {k: out[k] for k in ("title", "built", "tool", "vetted", "not_causation", "constraint", "sources", "coverage", "summary")}
slim["encoding"] = {"genes": "gene key -> [[pathway id, source code, evidence code, inferred_by_orthology 0|1], ...]", "source_codes": SRC_CODE,
                    "pathways": "pathway id -> {name, source, n_genes}; the full per-pathway gene lists are in genotype/pathways.json (local)",
                    "fin_pathways": "pathway id -> the fin genes (required-for or sufficient-for in the fin subtree) that belong to it"}
slim["genes"] = {k: sorted({(e["pathway"], SRC_CODE[e["source"]], e["evidence_code"][:40], int(e["inferred_by_orthology"])) for e in v}) for k, v in sorted(pathways.items())}
slim["pathways"] = {p: {"name": pw_meta[p]["name"], "source": pw_meta[p]["source"], "n_genes": len(by_pathway[p])} for p in sorted(pw_meta)}
slim["fin_pathways"] = {p: sorted(by_pathway[p] & fin_genes) for p in sorted(pw_meta) if by_pathway[p] & fin_genes}
slim["slimming"] = {"of": "genotype/pathways.json", "rule": "names moved to the pathway table, entries deduplicated to tuples, per-pathway gene lists kept for fin genes only"}
d2 = os.path.join(HERE, "pathways.slim.json")
json.dump(slim, open(d2, "w", encoding="utf8"), separators=(",", ":"))
print("pathways.slim.json MB", round(os.path.getsize(d2) / 1e6, 2), "| fin pathways", len(slim["fin_pathways"]))
print(json.dumps({"coverage": out["coverage"], "summary": out["summary"]}, indent=1))
print("pathways.json MB", round(os.path.getsize(dst) / 1e6, 2))
