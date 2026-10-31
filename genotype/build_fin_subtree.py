"""Fin-focused extension of the blueprint hierarchy (hub task with Amit's direction, 2026-10-31).

The blueprint puts the pectoral fin (UBERON:0000151) directly under the body with one tissue and no cell types,
so the zoom dead-ends one level below the organ. This script builds genotype/fin-subtree.json from what the
zebrafish anatomy ontology (ZFA, via ZFIN's anatomy files) actually holds under the pectoral fin:
  - nodes: the ZFA part_of closure of 'pectoral fin' plus its precursor 'pectoral fin bud' and the bud's parts
    (develops_from edges, labelled precursor), each with its ZFIN stage range, its Uberon cross-reference where
    Uberon declares one (from Ubergraph; never matched by name) and otherwise 'zebrafish_only': true;
  - cell nodes: ZFIN records are post-composed (superstructure + substructure); where the substructure is a ZFA
    cell term with a Cell Ontology cross-reference (zfa.obo), a cell node 'fin structure / cell type' is made;
  - links: ZFIN wild-type expression rows and ZFIN phenotype rows re-attached to the exact ZFA structure each row
    names (deepest node the record supports), typed with the same rules as genotype/build.py (expressed in;
    required for = single-gene, homozygous allele or knockdown, no construct, standard conditions, not a dominant
    non-truncating allele; sufficient for = hand-checked gain-of-function alleles). Bgee calls attach only where
    a node has a Uberon cross-reference that Bgee annotates. Nothing propagates down.
  - wing_genes: where the evidence for kcnk5b, kcnh2a and slc43a2a really sits;
  - single_cell_leads: GEO series from logged searches, not integrated.
Output shape: top-level 'layers' with nodes/links per layer, as dashboard/build-graph.mjs reads.
Offline. Usage: python -I genotype/build_fin_subtree.py [--raw DIR]
"""
import collections, hashlib, json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, "cache")
RAW = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else "C:/Temp/genotype/raw"
CALLS = {c["name"]: c for c in json.load(open(os.path.join(CACHE, "calls.json")))["calls"]}
def src(name, database):
    c = CALLS[name]; return {"database": database, "call": name, "url": c["url"], "retrieved": c["retrieved"], "sha256": c["sha256"]}
def tsv(fn):
    for line in open(os.path.join(RAW, fn), encoding="utf8", errors="replace"): yield line.rstrip("\r\n").split("\t")
OBO = "http://purl.obolibrary.org/obo/"
def curie(iri): return iri.replace(OBO, "").replace("_", ":", 1)

# ------------------------------------------------------------------ ZFA terms, names, stages, relations
names, stage0, stage1 = {}, {}, {}
for r in tsv("anatomy_item.txt"):
    if len(r) >= 4: names[r[0]] = r[1]; stage0[r[0]] = r[2]; stage1[r[0]] = r[3]
stage_name = {r[0]: r[2] for r in tsv("stage_ontology.txt") if len(r) >= 3}
stage_zfs = {r[0]: r[1] for r in tsv("stage_ontology.txt") if len(r) >= 3}
EMB = {"Zygote", "Cleavage", "Blastula", "Gastrula", "Segmentation", "Pharyngula", "Hatching"}
def period_name(name):
    p = (name or "Unknown").split(":")[0]
    return "embryo" if p in EMB else {"Larval": "larva", "Juvenile": "juvenile", "Adult": "adult"}.get(p, "unknown")
def period(sid):
    p = (stage_name.get(sid, "Unknown") or "Unknown").split(":")[0]
    return "embryo" if p in EMB else {"Larval": "larva", "Juvenile": "juvenile", "Adult": "adult"}.get(p, "unknown")
kids, pars = collections.defaultdict(set), collections.defaultdict(set)
for r in tsv("anatomy_relationship.txt"):
    if len(r) >= 3: kids[(r[0], r[2])].add(r[1]); pars[(r[1], r[2])].add(r[0])
def closure(root, rel):
    seen, todo = {root}, [root]
    while todo:
        x = todo.pop()
        for k in kids[(x, rel)]:
            if k not in seen: seen.add(k); todo.append(k)
    return seen
PF = "ZFA:0001161"; assert names[PF] == "pectoral fin"
BUD = next(t for t, n in names.items() if n == "pectoral fin bud")
FIELD = next(t for t, n in names.items() if n == "pectoral fin field")   # part_of posterior lateral plate mesoderm, the precursor field
fin_terms = closure(PF, "part of"); bud_terms = closure(BUD, "part of") | closure(FIELD, "part of")
# A subclass of a term that is part of the fin is itself inside the fin: 'pectoral fin endoskeletal disc' is_a
# 'pectoral fin cartilage'. The part_of closure alone misses these, and two subagents hit exactly that gap
# (ZFA:0001456 holds several of the deepest shha phenotype rows), so is_a descendants are added here.
subclass_of = {}
for base in (fin_terms, bud_terms):
    frontier = set(base)
    while frontier:
        nxt = set()
        for t in frontier:
            for k in kids[(t, "is_a")]:
                if k not in base and k not in subclass_of: subclass_of[k] = t; nxt.add(k)
        base |= nxt; frontier = nxt
fin_terms |= {t for t, p in subclass_of.items() if p in fin_terms or t in fin_terms}
terms = fin_terms | bud_terms | {FIELD}
cl_of, cur = {}, None
for line in open(os.path.join(RAW, "zfa.obo"), encoding="utf8"):
    line = line.strip()
    if line.startswith("id: "): cur = line[4:]
    elif cur and line.startswith("xref: CL:"): cl_of[cur] = line[6:].split()[0]
zfa_version = next(l.split(": ", 1)[1].strip() for l in open(os.path.join(RAW, "zfa.obo"), encoding="utf8") if l.startswith("data-version"))

# Uberon and MFO cross-references (Ubergraph; the only allowed attachment to other species' terms)
ux = json.load(open(os.path.join(CACHE, "ubergraph_fin_uberon_zfa_xrefs.json")))
zfa2uberon = collections.defaultdict(list)
for b in ux["result"]["results"]["bindings"]: zfa2uberon[b["x"]["value"]].append({"uberon": curie(b["u"]["value"]), "label": b["ul"]["value"]})
mx = json.load(open(os.path.join(CACHE, "ubergraph_fin_uberon_mfo_xrefs.json")))
uberon2mfo = collections.defaultdict(list)
for b in mx["result"]["results"]["bindings"]: uberon2mfo[curie(b["u"]["value"])].append(b["x"]["value"])

# depth below the pectoral fin along part_of (bud subtree hangs off the fin as a precursor)
def depth_from(root, pool):
    d, todo = {root: 0}, [root]
    while todo:
        x = todo.pop(0)
        for k in kids[(x, "part of")]:
            if k in pool and k not in d: d[k] = d[x] + 1; todo.append(k)
    return d
dep = depth_from(PF, fin_terms); depb = depth_from(BUD, bud_terms)
def level_of(t):
    if t == PF: return "organ"
    if t in (BUD, FIELD): return "precursor"
    if t in depb: return "precursor part"
    if t in subclass_of: return "subpart"     # a kind of a fin part, e.g. the endoskeletal disc
    return "part" if dep.get(t, 9) == 1 else "subpart"
edges = []
for t, p in subclass_of.items():
    if t in terms and p in terms: edges.append({"child": t, "parent": p, "rel": "is_a (a kind of this part)"})
for t in terms:
    for p in pars[(t, "part of")]:
        if p in terms: edges.append({"child": t, "parent": p, "rel": "part_of"})
    for p in pars[(t, "develops from")]:   # ZFIN file: parent column = the later structure, child column = what it develops from
        pass
for r in tsv("anatomy_relationship.txt"):
    if len(r) >= 3 and r[2] == "develops from" and r[0] in terms and r[1] in terms: edges.append({"child": r[1], "parent": r[0], "rel": "develops_from (precursor of)"})
nodes = {}
for t in sorted(terms):
    nodes[t] = {"term": t, "label": names[t], "ontology": "ZFA", "level": level_of(t), "depth_below_pectoral_fin": dep.get(t, depb.get(t)),
                "stage_range": {"start": stage_name.get(stage0.get(t)), "end": stage_name.get(stage1.get(t)), "start_zfs": stage_zfs.get(stage0.get(t)), "end_zfs": stage_zfs.get(stage1.get(t)),
                                "periods": sorted({period(stage0.get(t)), period(stage1.get(t))})},
                "uberon_xref": zfa2uberon.get(t, []), "mfo_xref": sorted({m for u in zfa2uberon.get(t, []) for m in uberon2mfo.get(u["uberon"], [])}),
                "zebrafish_only": not zfa2uberon.get(t), "in_blueprint": t == PF or any(u["uberon"] in ("UBERON:0000151",) for u in zfa2uberon.get(t, []))}

# ------------------------------------------------------------------ links: ZFIN rows re-attached to the structure they name
zdb2ens = {r[0]: r[3] for r in tsv("ensembl_1_to_1.txt") if len(r) >= 4}
# gene keys as in genotype/build.py: Bgee Ensembl id -> ZFIN id through ZFIN's 1:1 table, else through an exact symbol match, else kept
ens2zdb = collections.defaultdict(set)
for z, e in zdb2ens.items(): ens2zdb[e].add(z)
zsym2zdb = collections.defaultdict(set)
for r in tsv("ensembl_1_to_1.txt"):
    if len(r) >= 4: zsym2zdb[r[2]].add(r[0])
for fn, si, gi in (("phenoGeneCleanData_fish.txt", 1, 2), ("wildtype-expression_fish.txt", 1, 0), ("features-affected-genes.txt", 3, 4)):
    for r in tsv(fn):
        if len(r) > max(si, gi) and r[gi].startswith("ZDB-GENE-") and r[si]: zsym2zdb[r[si]].add(r[gi])
gene_key_rule = collections.Counter()
def zgene_from_ens(ens, sym):
    if len(ens2zdb.get(ens, ())) == 1: gene_key_rule["ZFIN 1:1 table"] += 1; return "ZF:" + next(iter(ens2zdb[ens]))
    if sym and len(zsym2zdb.get(sym, ())) == 1: gene_key_rule["exact symbol match"] += 1; return "ZF:" + next(iter(zsym2zdb[sym]))
    gene_key_rule["kept as Ensembl id"] += 1; return "ZF:" + ens
pub2pmid = {r[0]: r[1] for r in tsv("pub_to_pubmed_id_translation.txt") if len(r) >= 2 and r[1]}
def pubref(p): return {"zfin": p, **({"pmid": pub2pmid[p]} if p in pub2pmid else {})}
ZF = {"name": "Danio rerio (zebrafish)", "taxon": "NCBITaxon:7955"}
links, cell_nodes = [], {}
def cell_node(struct, cell):
    nid = f"{struct}+{cell}"
    if nid not in cell_nodes:
        cell_nodes[nid] = {"term": nid, "label": f"{names[struct]} / {names.get(cell, cell)}", "ontology": "ZFA post-composition (ZFIN superstructure + substructure)", "level": "cell",
                           "structure": struct, "cell_type": cell, "cl_xref": cl_of.get(cell), "stage_range": nodes[struct]["stage_range"], "uberon_xref": nodes[struct]["uberon_xref"],
                           "zebrafish_only": nodes[struct]["zebrafish_only"], "parent": struct}
        edges.append({"child": nid, "parent": struct, "rel": "part_of (post-composed cell in structure)"})
    return nid
def link(node, gkey, sym, typ, kind, source, stage, evidence, finding=None):
    links.append({"blueprint_node": node, "gene": gkey, "symbol": sym, "organism": ZF, "link_type": typ, "evidence_kind": kind, "derived": False, "stage": stage,
                  "source": {"database": source["database"], "call": source["call"]}, **({"finding": finding} if finding else {}), "evidence": evidence})

# expression
agg = collections.defaultdict(lambda: {"assays": set(), "pubs": set(), "stages": set(), "rows": 0})
expr_stats = collections.Counter()
for r in tsv("wildtype-expression_fish.txt"):
    if len(r) < 12: continue
    gid, sym, fish, sup, supn, sub, subn, st0, st1, assay, mmo, pub = r[:12]
    if sup not in terms and sub not in terms: continue
    expr_stats["rows"] += 1
    if sup in terms and sub and sub in cl_of: node = cell_node(sup, sub); expr_stats["rows_cell_level"] += 1
    elif sub in terms: node = sub
    elif sup in terms and sub and sub in terms: node = sub
    else:
        node = sup
        if sub: expr_stats["rows_with_unattached_substructure"] += 1
    kind = "in situ hybridisation" if "in situ" in assay else "immunostaining" if "immuno" in assay.lower() else f"other assay: {assay}"
    a = agg[(node, "ZF:" + gid, sym, kind, f"{period_name(st0)}..{period_name(st1)}")]   # expression file: stage names
    a["assays"].add(assay); a["pubs"].add(pub); a["stages"].add(f"{stage_name.get(st0, st0)} to {stage_name.get(st1, st1)}"); a["rows"] += 1
for (node, gkey, sym, kind, sk), a in agg.items():
    link(node, gkey, sym, "expressed in", kind, src("zfin_wildtype-expression_fish", "ZFIN"), {"period": sk, "zfin_stages": sorted(a["stages"])[:4]},
         {"assays": sorted(a["assays"]), "rows": a["rows"], "n_publications": len(a["pubs"]), "publications": [pubref(p) for p in sorted(a["pubs"])[:3]]})

# phenotypes: same rules as genotype/build.py (copied; keep in step with it)
comps = collections.defaultdict(list)
for r in tsv("fish_components_fish.txt"):
    if len(r) >= 8: comps[r[0]].append(r)
ftype = {r[0]: r[4] for r in tsv("features.txt") if len(r) >= 5}
KD = ("ZDB-MRPHLNO-", "ZDB-CRISPR-", "ZDB-TALEN-")
GOF = {"ZDB-ALT-980203-1093": {"gene": "kcnk5b", "allele": "ty86d", "pmid": "24453984", "quote": "alf mutants carry gain-of-function mutations in kcnk5b"},
       "ZDB-ALT-150923-2": {"gene": "kcnk5b", "allele": "dt30mh", "pmid": "24453984", "quote": "alf mutants carry gain-of-function mutations in kcnk5b"}}
env_of = collections.defaultdict(list)
for r in tsv("pheno_environment_fish.txt"):
    if len(r) >= 3: env_of[r[0]].append((r[2], r[1]))
ONT_ID = re.compile(r"^(ZFA|GO|CL|PATO|BSPO|MPATH|UBERON|CHEBI|ZFS):\d+")
exp_index = collections.defaultdict(set)
for r in tsv("phenotype_fish.txt"):
    if len(r) < 23: continue
    tag = [x for x in r if x in ("abnormal", "normal")]
    exp_index[(r[0], r[2], r[4], r[21], frozenset(x for x in r if ONT_ID.match(x)), tag[0] if tag else "")].add(r[22])
STD = "ZECO:0000103"
allele_cons = collections.defaultdict(set)
for r in tsv("features-affected-genes.txt"):
    if len(r) >= 21 and r[0].startswith("ZDB-ALT-") and r[20]: allele_cons[r[0]].add(r[20])
TRUNC = re.compile(r"premature stop|frameshift|splice|exon loss|start loss")
het_alleles = set()
for r in tsv("phenoGeneCleanData_fish.txt"):
    if len(r) < 25 or r[11] != "abnormal": continue
    for c in comps.get(r[18], ()):
        if c[4].startswith("ZDB-ALT-") and re.search(re.escape(c[5]) + r"/\+", r[19].replace("<sup>", "").replace("</sup>", "")): het_alleles.add(c[4])
def lof_class(aff):
    c = allele_cons.get(aff, set())
    if any(TRUNC.search(x) for x in c): return "truncating"
    if any(("missense" in x or "nonsynonymous" in x or "inframe" in x) for x in c): return "missense or in-frame"
    return "other recorded consequence" if c else "consequence not recorded"
def classify(fish, fish_name, gene):
    rows = comps.get(fish)
    if not rows: return None, None, "fish not in fish_components_fish.txt", None
    if {r[2] for r in rows} != {gene}: return None, None, "fish has components other than this one gene", None
    kinds, gof, hom, lof = [], [], True, []
    for r in rows:
        aff, ab, construct = r[4], r[5], r[6]
        if construct: return None, None, "fish carries a construct (transgene)", None
        if aff.startswith(KD): kinds.append(aff.split("-")[1].lower() + " " + ab); lof.append("knockdown"); continue
        if aff.startswith("ZDB-ALT-"):
            t = ftype.get(aff, "")
            if not t or "transgenic" in t.lower(): return None, None, f"allele type '{t or 'unknown'}'", None
            if aff in GOF: gof.append(aff)
            kinds.append(f"allele {ab} ({t}; {lof_class(aff)})")
            if not re.search(re.escape(ab) + r"/" + re.escape(ab) + r"\b", fish_name): hom = False
            lof.append(("dominant" if aff in het_alleles else "recessive") + " | " + lof_class(aff)); continue
        return None, None, "unrecognised affector " + aff, None
    if gof: return "sufficient for", kinds, None, "verified gain of function"
    only_alleles = not any(k == "knockdown" for k in lof)
    if only_alleles and not hom: return None, None, "allele not homozygous (dominant or heterozygous phenotype: loss of function not established)", None
    if only_alleles and any(x.startswith("dominant") for x in lof) and not any("truncating" in x for x in lof):
        return None, None, "homozygous allele that also has a heterozygous phenotype (dominant) and no truncating consequence: loss of function not established", None
    ev = ("knockdown" if not only_alleles else "truncating allele: loss of function established" if any("truncating" in x for x in lof) else
          "recessive allele, " + "; ".join(sorted({x.split(" | ")[1] for x in lof})) + ": loss of function presumed")
    return "required for", kinds, None, ev
pheno_stats = collections.Counter(); rejected = collections.Counter()
pagg = collections.defaultdict(lambda: {"rows": [], "lof": set(), "pubs": set()})
for r in tsv("phenoGeneCleanData_fish.txt"):
    if len(r) < 25 or r[11] != "abnormal": continue
    sup, sub = r[3], r[7]
    if sup not in terms and sub not in terms and r[12] not in terms and r[16] not in terms: continue
    pheno_stats["rows"] += 1
    if sup in terms and sub and sub in cl_of: node = cell_node(sup, sub); pheno_stats["rows_cell_level"] += 1
    elif sub in terms: node = sub
    elif sup in terms: node = sup
    else: node = r[16] if r[16] in terms else r[12]
    raw_name = r[19].replace("<sup>", "").replace("</sup>", "")
    typ, kinds, why, lof_ev = classify(r[18], raw_name, r[2])
    if why: rejected[why] += 1; continue
    exps = exp_index.get((r[18], r[20], r[21], r[23], frozenset(x for x in r if ONT_ID.match(x)), r[11]), set())
    conds = {c for e in exps for c in env_of.get(e, [("?", "no environment row")])}
    if not exps or not all(z == STD for z, _ in conds): rejected["experimental condition not standard, or ambiguous"] += 1; continue
    pheno_stats["rows_kept"] += 1
    a = pagg[(node, "ZF:" + r[2], r[1], typ, f"{period(r[20])}..{period(r[21])}")]
    a["lof"].add(lof_ev); a["pubs"].add(r[23])
    a["rows"].append({"eq": " ".join(v for v in (r[4], r[6], r[8]) if v), "quality": f"{r[9]} {r[10]}", "fish_name": raw_name, "perturbation": kinds, "stage": f"{stage_name.get(r[20], r[20])} to {stage_name.get(r[21], r[21])}", **pubref(r[23])})
for (node, gkey, sym, typ, sk), a in pagg.items():
    p0 = a["rows"][0]
    link(node, gkey, sym, typ, "gain-of-function allele phenotype (ZFIN EQ annotation)" if typ == "sufficient for" else "mutant or knockdown phenotype (ZFIN EQ annotation)",
         src("zfin_phenoGeneCleanData_fish", "ZFIN"), {"period": sk},
         {"loss_of_function_evidence": sorted(a["lof"]), "phenotype_rows": len(a["rows"]), "phenotypes": a["rows"][:3], "n_publications": len(a["pubs"]), "publications": [pubref(p) for p in sorted(a["pubs"])[:3]]},
         finding=f'{p0["eq"]} {p0["quality"]}' + (f' in a verified gain-of-function allele ({a["rows"][0]["perturbation"]})' if typ == "sufficient for" else ""))

# Bgee: only where a node has a Uberon cross-reference that Bgee annotates (anatomy-only call files)
import csv, gzip
uberon_nodes = {u["uberon"]: t for t, n in nodes.items() for u in n["uberon_xref"]}
bgee_stats = collections.Counter()
for sp, org in (("Danio_rerio", ZF), ("Oryzias_latipes", {"name": "Oryzias latipes (medaka)", "taxon": "NCBITaxon:8090"})):
    with gzip.open(os.path.join(RAW, f"{sp}_expr_advanced.tsv.gz"), "rt", encoding="utf8") as f:
        rd = csv.reader(f, delimiter="\t"); hdr = next(rd); ix = {h.strip('"'): i for i, h in enumerate(hdr)}
        for r in rd:
            ent = r[ix["Anatomical entity ID"]]
            if ent not in uberon_nodes: continue
            bgee_stats[f"{org['name']} rows at fin-subtree Uberon terms"] += 1
            if r[ix["Expression"]] != "present" or r[ix["Including observed data"]] != "yes": continue
            DT = ["Affymetrix", "EST", "in situ hybridization", "RNA-Seq", "single-cell RNA-Seq"]
            types = [d for d in DT if r[ix[f"Including {d} observed data"]] == "yes" and r[ix[f"{d} expression"]] == "present"]
            kind = "single-cell expression" if "single-cell RNA-Seq" in types else "in situ hybridisation" if "in situ hybridization" in types else "bulk expression"
            bgee_stats[f"{org['name']} present links"] += 1
            gid, sym = r[ix["Gene ID"]], r[ix["Gene name"]].strip('"')
            links.append({"blueprint_node": uberon_nodes[ent], "gene": zgene_from_ens(gid, sym) if sp == "Danio_rerio" else "MD:" + gid, "symbol": sym, "organism": org, "link_type": "expressed in", "evidence_kind": kind, "derived": False,
                          "stage": {"bgee": "all stages merged (anatomy-only call file)"}, "source": {"database": "Bgee 15.2 (ftp/current)", "call": "bgee_expr_advanced_" + sp},
                          "evidence": {"ensembl": gid, "uberon": ent, "data_types_observed": types, "call_quality": r[ix["Call quality"]]}})

# ------------------------------------------------------------------ layers, coverage, wing genes
all_nodes = {**nodes, **cell_nodes}
LAYERS = ["organ", "part", "subpart", "cell", "precursor", "precursor part"]
by_node = collections.defaultdict(lambda: collections.defaultdict(set))
for l in links: by_node[l["blueprint_node"]][l["link_type"]].add(l["gene"])
layers = {}
for L in LAYERS:
    rows = []
    for t, n in all_nodes.items():
        if n["level"] != L: continue
        d = by_node.get(t, {})
        rows.append({**n, "direct": bool(d), "derived_only": False, "direct_expressed_in_genes": len(d.get("expressed in", ())), "direct_required_for_genes": len(d.get("required for", ())),
                     "direct_sufficient_for_genes": len(d.get("sufficient for", ())), "derived_expressed_in_genes": 0, "derived_required_for_genes": 0})
    rows.sort(key=lambda x: x["label"])
    layers[L] = {"coverage": {"denominator": len(rows), "denominator_source": "ZFA part_of closure of 'pectoral fin' (and 'pectoral fin bud'), plus post-composed cell nodes seen in ZFIN rows",
                              "nodes_with_direct_record": sum(r["direct"] for r in rows), "nodes_with_none": sum(not r["direct"] for r in rows),
                              "nodes_with_uberon_xref": sum(bool(r.get("uberon_xref")) for r in rows), "zebrafish_only_nodes": sum(r.get("zebrafish_only", False) for r in rows),
                              "absence_note": "A node with no record is unstudied in these sources, not gene-free. Nothing is propagated down; derived counts are 0 by construction."},
                 "nodes": rows, "links": [l for l in links if l["blueprint_node"] in {r["term"] for r in rows}], "derived_links": []}

WING = {"kcnk5b": "ZDB-GENE-040426-1297", "kcnh2a": None, "slc43a2a": "ZDB-GENE-040426-964"}
def wing_report(sym):
    ls = [l for l in links if l["symbol"] == sym]
    nodes_hit = sorted({(all_nodes[l["blueprint_node"]]["level"], all_nodes[l["blueprint_node"]]["label"], l["link_type"], l["stage"].get("period", "merged")) for l in ls})
    # every ZFIN row for the gene anywhere, so the generic-'fin' rows are visible too
    anywhere = collections.Counter()
    for r in tsv("phenoGeneCleanData_fish.txt"):
        if len(r) >= 25 and r[1] == sym: anywhere[f'phenotype @ {names.get(r[3], r[3]) or "-"}{(" / " + names.get(r[7], r[7])) if r[7] else ""} [{r[19].replace("<sup>", "[").replace("</sup>", "]")}]'] += 1
    for r in tsv("wildtype-expression_fish.txt"):
        if len(r) >= 12 and r[1] == sym: anywhere[f'expression @ {names.get(r[3], r[3])}{(" / " + r[6]) if r[6] else ""} ({r[9]})'] += 1
    deepest = max((all_nodes[l["blueprint_node"]].get("depth_below_pectoral_fin") if all_nodes[l["blueprint_node"]]["level"] != "cell" else 99) for l in ls) if ls else None
    return {"links_in_fin_subtree": len(ls), "nodes_level_type_stage": [list(x) for x in nodes_hit], "deepest_level_reached": ("cell" if deepest == 99 else {0: "organ (whole pectoral fin)", 1: "part", None: "none"}.get(deepest, "subpart")),
            "all_zfin_rows_for_this_gene": dict(anywhere.most_common(40))}
wing = {s: wing_report(s) for s in WING}
wing["_honest_summary"] = ("All three wing genes' ZFIN evidence sits at the ORGAN level or above: kcnk5b at 'pectoral fin' (gain-of-function alleles, heterozygous rows, adult) and at generic 'fin', "
                           "'lepidotrichium' and 'caudal fin actinotrichium' terms that are not pectoral-specific; slc43a2a at 'pectoral fin' (one adult RT-PCR expression row and heterozygous dmh26 phenotype rows, which fail the homozygosity rule, from the Daane paper) with homozygous rows on the caudal fin; "
                           "kcnh2a only as RT-PCR expression in generic 'fin' and 'regenerating fin', no phenotype row in any single-gene fish. No row for any of the three names a fin tissue or a cell type. 'Required for' is never pushed down.")

geo = json.load(open(os.path.join(CACHE, "geo_fin_single_cell.json")))
FINWORD = re.compile(r"\bfin\b|fin regeneration|fins", re.I)
leads = [{"accession": s["accession"], "title": s["title"], "pubdate": s["pubdate"], "n_samples": s["n_samples"], "pubmed": s["pubmed"], "fin_in_title": bool(FINWORD.search(s["title"] or "")),
          "summary_head": (s["summary"] or "")[:300]} for s in geo["series"].values()]
leads.sort(key=lambda x: (not x["fin_in_title"], x["pubdate"] or ""))

out = {
 "title": "Fin-focused extension of the flying-fish blueprint: the zebrafish pectoral fin and its parts, with proxy-fish gene links re-attached to the structure each record names",
 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/build_fin_subtree.py", "vetted": True,
 "constraint": ("Every node below the pectoral fin is a zebrafish anatomy (ZFA) term, and every gene link is a zebrafish or medaka record. None of it is a "
                "flying-fish measurement. Note what that does and does not mean: an annotated draft genome of a flying fish exists (Hirundichthys speculiger, "
                "23,611 predicted protein-coding genes; see map.vetted.json flying_fish_genome), so the gap is not missing genes but missing expression and "
                "phenotype records, which exist only for zebrafish and medaka. A flying fish's wing is an enlarged pectoral fin."),
 "causation_warning": "'expressed in' is detection, not causation. 'required for' is a loss-of-function phenotype at exactly the structure ZFIN names, never pushed down to parts or cells. 'sufficient for' is a verified gain-of-function allele that changes the structure's size, not one that makes it.",
 "link_types": {"expressed in": "expression data", "required for": "a loss-of-function phenotype", "sufficient for": "a gain-of-function result"},
 "propagation_rules": {"expressed in": "not propagated in this file (each link sits on the structure the record names)", "required for": "never propagates down; not propagated up in this file either", "sideways": "never"},
 "queries": {"zfa_closure": "ZFIN anatomy_relationship.txt rows with relationship 'part of', closed transitively from ZFA:0001161 'pectoral fin' and from the 'pectoral fin bud' term; develops_from rows between terms of that set kept as precursor edges",
             "uberon_xrefs": {"endpoint": ux["endpoint"], "sparql": ux["query"], "retrieved": ux["retrieved"], "rows": len(ux["result"]["results"]["bindings"])},
             "mfo_xrefs": {"endpoint": mx["endpoint"], "sparql": mx["query"], "retrieved": mx["retrieved"], "rows": len(mx["result"]["results"]["bindings"])},
             "cl_xrefs": f"zfa.obo {zfa_version} 'xref: CL:' lines on ZFA cell terms", "geo": geo["queries"]},
 "sources": {k: src(k, d) for k, d in (("zfin_wildtype-expression_fish", "ZFIN"), ("zfin_phenoGeneCleanData_fish", "ZFIN"), ("zfin_anatomy_relationship", "ZFIN"), ("zfin_anatomy_item", "ZFIN"), ("zfa_obo", "ZFA"),
                                        ("bgee_expr_advanced_Danio_rerio", "Bgee 15.2"), ("bgee_expr_advanced_Oryzias_latipes", "Bgee 15.2"))},
 "summary": {"zfa_terms": len(nodes), "zfa_terms_with_uberon_xref": sum(1 for n in nodes.values() if n["uberon_xref"]), "zebrafish_only_terms": sum(1 for n in nodes.values() if n["zebrafish_only"]),
             "mfo_xrefs_found": sum(1 for n in nodes.values() if n["mfo_xref"]), "cell_nodes_post_composed": len(cell_nodes), "cell_nodes_with_cl_xref": sum(1 for c in cell_nodes.values() if c["cl_xref"]),
             "links": len(links), "links_by_type": dict(collections.Counter(l["link_type"] for l in links)), "links_by_level": dict(collections.Counter(all_nodes[l["blueprint_node"]]["level"] for l in links)),
             "zfin_expression_rows": dict(expr_stats), "bgee_gene_key_rules": dict(gene_key_rule), "zfin_phenotype_rows": {**dict(pheno_stats), "rejected": dict(rejected)}, "bgee": dict(bgee_stats),
             "proxy_organisms": [ZF, {"name": "Oryzias latipes (medaka)", "taxon": "NCBITaxon:8090"}]},
 "blueprint_join": {"pectoral_fin_zfa": PF, "pectoral_fin_uberon": "UBERON:0000151", "note": "The organ node of this file is the blueprint's pectoral fin; everything below it is new and zebrafish-defined. 'mesenchyme pectoral fin' (ZFA:0001000) is the blueprint's one fin tissue."},
 "wing_genes": wing, "single_cell_leads": {"note": "GEO series from the logged searches in queries.geo; leads only, nothing integrated. 'fin_in_title' is a word match on the title, not a judgement.", "series": leads},
 "edges": edges, "layers": layers,
}
full = os.path.join(HERE, "fin-subtree.full.json")
json.dump(out, open(full, "w", encoding="utf8"), separators=(",", ":"))
CAP = 40
def rank(kind): return 0 if re.search(r"single|in situ|immunost", kind or "", re.I) else 2 if re.search(r"bulk|RNA Seq", kind or "", re.I) else 1
omitted = {}
for L, D in out["layers"].items():
    keep = []
    for t in {l["blueprint_node"] for l in D["links"]}:
        ls = [l for l in D["links"] if l["blueprint_node"] == t]
        for typ in ("sufficient for", "required for", "expressed in"):
            grp = sorted((l for l in ls if l["link_type"] == typ), key=lambda l: (rank(l.get("evidence_kind")), str(l.get("symbol"))))
            seen, rows = set(), []
            for l in grp:
                k = f'{l.get("symbol")}|{l["organism"]["name"]}|{l.get("evidence_kind")}'
                if k in seen: continue
                seen.add(k); rows.append(l)
            if len(rows) > CAP: omitted.setdefault(t, {})[typ] = len(rows) - CAP
            keep += rows[:CAP]
    D["links"] = keep
out["slimming"] = {"of": "genotype/fin-subtree.full.json (local; every link)", "full_file_sha256": hashlib.sha256(open(full, "rb").read()).hexdigest(),
                   "rule": f"one row per gene symbol, organism and evidence kind, at most {CAP} per link type per node (the rule of genotype/slim.py and dashboard/build-graph.mjs); per-node counts in nodes are complete", "links_omitted_by_node_and_type": omitted}
dst = os.path.join(HERE, "fin-subtree.json")
json.dump(out, open(dst, "w", encoding="utf8"), separators=(",", ":"))
print("fin-subtree.full.json KB", round(os.path.getsize(full) / 1e3))
print(json.dumps(out["summary"], indent=1)); print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "all_zfin_rows_for_this_gene"} for k, v in wing.items() if k != "_honest_summary"}, indent=1))
for L in LAYERS: print(L, layers[L]["coverage"]["nodes_with_direct_record"], "/", layers[L]["coverage"]["denominator"])
print("fin-subtree.json KB", round(os.path.getsize(dst) / 1e3))
