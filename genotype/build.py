"""Build genotype/map.json (layered genotype-phenotype map) from what genotype/fetch.py downloaded.
No network access. Usage: python -I genotype/build.py [--raw DIR]

Rules this script implements (see genotype/README.md):
- Every link is typed as exactly one of "expressed in", "required for", "sufficient for", and carries
  layer, evidence_kind, organism, source, crosswalk (the ontology xref that attached it) and stage.
- ZFIN records attach to the blueprint only through ontology cross-references (Uberon xref ZFA, read
  from Ubergraph; ZFA xref CL, read from zfa.obo). Never by name. Unattached records are counted.
- "expressed in" and "required for" propagate UP the blueprint part_of graph only, marked derived with
  the path; derived "required for" is an inference. Nothing propagates down or sideways.
- Stages are kept apart: a link key includes its ZFIN stage span; embryonic and adult never merge.
- Zebrafish paralogs stay separate; any flying-fish correspondence is an orthology assumption.
"""
import collections, csv, gzip, hashlib, json, os, re, statistics, sys, time
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
RAW = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else "C:/Temp/genotype/raw"
CACHE = os.path.join(HERE, "cache")
CALLS = {c["name"]: c for c in json.load(open(os.path.join(CACHE, "calls.json")))["calls"]}


def src(name, database):
    c = CALLS[name]
    return {"database": database, "call": name, "url": c["url"], "retrieved": c["retrieved"], "sha256": c["sha256"]}


def tsv(fn):
    with open(os.path.join(RAW, fn), encoding="utf8", newline="") as f:
        for line in f:
            yield line.rstrip("\r\n").split("\t")


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


OBO = "http://purl.obolibrary.org/obo/"
def curie(iri): return iri.replace(OBO, "").replace("_", ":", 1)

# ------------------------------------------------------------------ blueprint
BP_PATH = os.path.join(ROOT, "organism-design", "examples", "a-flying-fish.json")
bp = json.load(open(BP_PATH))
LAYERS = ["body", "organ_system", "organ", "tissue", "cell"]
level, label, parents = {}, {}, collections.defaultdict(set)
for n in bp["nodes"]:
    t = curie(n["iri"]); level[t] = n["level"]; label[t] = n["label"]
    if n["parent"]: parents[t].add(curie(n["parent"]))
children = collections.defaultdict(set)
for c, ps in parents.items():
    for p in ps: children[p].add(c)
by_layer = {L: sorted(t for t, l in level.items() if l == L) for L in LAYERS}
for L in LAYERS:
    assert len(by_layer[L]) == bp["counts_distinct"][L], L
BODY = by_layer["body"][0]


def up_paths(t):
    """All ancestors of t with one shortest part_of path each (blueprint graph; acyclic per the lean thread)."""
    out, todo = {}, [(t, [t])]
    while todo:
        x, path = todo.pop(0)
        for p in sorted(parents.get(x, ())):
            if p not in out:
                out[p] = path + [p]; todo.append((p, path + [p]))
    return out


ANC = {t: up_paths(t) for t in level}
DESC = collections.defaultdict(set)
for t, a in ANC.items():
    for p in a: DESC[p].add(t)

# ------------------------------------------------------------------ crosswalks
u2z = collections.defaultdict(set)
for b in json.load(open(os.path.join(CACHE, "ubergraph_uberon_zfa_xrefs.json")))["result"]["results"]["bindings"]:
    u2z[curie(b["u"]["value"])].add(b["x"]["value"])
z2cl, zname, cur = collections.defaultdict(set), {}, None
for line in open(os.path.join(RAW, "zfa.obo"), encoding="utf8"):
    line = line.strip()
    if line == "[Term]": cur = None
    elif line.startswith("id: "): cur = line[4:]
    elif line.startswith("name: ") and cur: zname[cur] = line[6:]
    elif line.startswith("xref: CL:") and cur: z2cl[cur].add(line[6:].split()[0])
zfa_version = next(l.split(": ", 1)[1].strip() for l in open(os.path.join(RAW, "zfa.obo"), encoding="utf8") if l.startswith("data-version"))
zfa2bp = collections.defaultdict(dict)   # ZFA term -> {blueprint term: xref statement}
for u, zs in u2z.items():
    for z in zs: zfa2bp[z][u] = f"{u} hasDbXref {z} (Uberon, via Ubergraph)"
for z, cs in z2cl.items():
    for c in cs:
        if c in level: zfa2bp[z][c] = f"{z} xref {c} (ZFA {zfa_version}; ZFA declares CL xrefs as 'CL part_of NCBITaxon:7955')"

# ZFA part_of closure, used only to describe what the blueprint lacks under the pectoral fin
kids = collections.defaultdict(set)
for parent, child, rel in tsv("anatomy_relationship.txt"):
    if rel in ("part of", "is_a"): kids[parent].add(child)
def zclosure(t):
    seen, todo = {t}, [t]
    while todo:
        for k in kids[todo.pop()]:
            if k not in seen: seen.add(k); todo.append(k)
    return seen

# ------------------------------------------------------------------ stages
stage_name = {r[0]: r[2] for r in tsv("stage_ontology.txt") if len(r) >= 3}
stage_zfs = {r[0]: r[1] for r in tsv("stage_ontology.txt") if len(r) >= 3}
zfs_by_name = {r[2]: r[1] for r in tsv("stage_ontology.txt") if len(r) >= 3}
EMB = {"Zygote", "Cleavage", "Blastula", "Gastrula", "Segmentation", "Pharyngula", "Hatching"}
def period(name):
    p = (name or "Unknown").split(":")[0]
    return "embryo" if p in EMB else {"Larval": "larva", "Juvenile": "juvenile", "Adult": "adult"}.get(p, "unknown")
def stage_key(a, b): return f"{period(a)}..{period(b)}"

# ------------------------------------------------------------------ genes
zdb2ens = {r[0]: r[3] for r in tsv("ensembl_1_to_1.txt") if len(r) >= 4}
ens2zdb = collections.defaultdict(set)
for z, e in zdb2ens.items(): ens2zdb[e].add(z)
pub2pmid = {r[0]: r[1] for r in tsv("pub_to_pubmed_id_translation.txt") if len(r) >= 2 and r[1]}
def pubref(p): return {"zfin": p, **({"pmid": pub2pmid[p]} if p in pub2pmid else {})}
ZF = {"name": "Danio rerio (zebrafish)", "taxon": "NCBITaxon:7955"}
MD = {"name": "Oryzias latipes (medaka)", "taxon": "NCBITaxon:8090"}
NOTFISH = {"name": "not organism-specific (Cell Ontology curator assertion; not fish data)", "taxon": None}
gene_sym = {}
# ZFIN symbol -> ZDB gene id, from ZFIN's own files (used only when Bgee's Ensembl id is absent from ZFIN's
# 1:1 table: Bgee 15.2 and ZFIN's table rest on different Ensembl releases, so e.g. fgf10a is
# ENSDARG00000116867 in Bgee and ENSDARG00000030932 in ZFIN's table). Vetting fix, Genotype session 2026-10-31.
zsym2zdb = collections.defaultdict(set)
for r in tsv("ensembl_1_to_1.txt"):
    if len(r) >= 4: zsym2zdb[r[2]].add(r[0])
for fn, si, gi in (("phenoGeneCleanData_fish.txt", 1, 2), ("wildtype-expression_fish.txt", 1, 0), ("features-affected-genes.txt", 3, 4)):
    for r in tsv(fn):
        if len(r) > max(si, gi) and r[gi].startswith("ZDB-GENE-") and r[si]: zsym2zdb[r[si]].add(r[gi])
gene_merges = {}      # Bgee Ensembl id -> ZDB id merged on exact symbol
gene_key_rule = collections.Counter()
def zgene(zdb=None, ens=None, sym=None):
    if zdb is None and ens:
        if len(ens2zdb.get(ens, ())) == 1:
            zdb = next(iter(ens2zdb[ens])); gene_key_rule["ZFIN ensembl_1_to_1 table"] += 1
        elif sym and len(zsym2zdb.get(sym, ())) == 1:
            zdb = next(iter(zsym2zdb[sym])); gene_key_rule["exact symbol match (Ensembl id absent from ZFIN's 1:1 table)"] += 1
            gene_merges[ens] = {"zdb": zdb, "symbol": sym}
        else:
            gene_key_rule["kept as Ensembl id (no 1:1 row, no unique ZFIN symbol)"] += 1
    key = "ZF:" + (zdb or ens)
    gene_sym.setdefault(key, sym)
    return key

# ------------------------------------------------------------------ verified gain-of-function alleles
# Each entry was checked against the PubMed abstract stored in genotype/cache/pubmed_abstracts.xml and
# against ZFIN rows that cite the same publication with this allele. Nothing here is from memory.
GOF = {
    "ZDB-ALT-980203-1093": {"gene": "kcnk5b", "allele": "ty86d", "pmid": "24453984", "zfin_pub": "ZDB-PUB-140321-22",
                            "quote": "alf mutants carry gain-of-function mutations in kcnk5b"},
    "ZDB-ALT-150923-2": {"gene": "kcnk5b", "allele": "dt30mh", "pmid": "24453984", "zfin_pub": "ZDB-PUB-140321-22",
                         "quote": "alf mutants carry gain-of-function mutations in kcnk5b"},
}

# ------------------------------------------------------------------ collect direct records
links = []
def link(node, gkey, organism, typ, kind, source, crosswalk, stage, evidence):
    links.append({"layer": level[node], "blueprint_node": node, "blueprint_label": label[node],
                  "gene": gkey, "symbol": gene_sym.get(gkey), "organism": organism, "link_type": typ,
                  "evidence_kind": kind, "derived": False, "source": source, "crosswalk": crosswalk,
                  "stage": stage, "evidence": evidence})

# Bgee (zebrafish, medaka): present calls that include data observed in that very structure.
bgee_stats = {}
DT = ["Affymetrix", "EST", "in situ hybridization", "RNA-Seq", "single-cell RNA-Seq"]
for sp, org, pre in (("Danio_rerio", ZF, "ZF:"), ("Oryzias_latipes", MD, "MD:")):
    st = collections.Counter()
    with gzip.open(os.path.join(RAW, f"{sp}_expr_advanced.tsv.gz"), "rt", encoding="utf8") as f:
        rd = csv.reader(f, delimiter="\t"); hdr = next(rd); ix = {h.strip('"'): i for i, h in enumerate(hdr)}
        for r in rd:
            ent = r[ix["Anatomical entity ID"]]
            if ent not in level: continue
            st["rows_at_blueprint_terms"] += 1
            if r[ix["Expression"]] != "present": st["absent_calls"] += 1; continue
            if r[ix["Including observed data"]] != "yes": st["present_but_only_propagated_by_bgee"] += 1; continue
            types = [d for d in DT if r[ix[f"Including {d} observed data"]] == "yes" and r[ix[f"{d} expression"]] == "present"]
            kind = ("single-cell expression" if "single-cell RNA-Seq" in types else
                    "in situ hybridisation" if "in situ hybridization" in types else "bulk expression")
            gid, sym = r[ix["Gene ID"]], r[ix["Gene name"]].strip('"')
            gkey = zgene(ens=gid, sym=sym) if pre == "ZF:" else ("MD:" + gid)
            gene_sym.setdefault(gkey, sym)
            st["direct_present_links"] += 1
            link(ent, gkey, org, "expressed in", kind, src("bgee_expr_advanced_" + sp, "Bgee 15.2 (ftp/current)"),
                 "Bgee annotates to Uberon and CL itself; no xref step by this thread",
                 {"bgee": "all stages merged (anatomy-only call file); not stage-resolved"},
                 {"ensembl": gid, "call_quality": r[ix["Call quality"]], "expression_score": r[ix["Expression score"]],
                  "data_types_observed": types, "self_observation_count": r[ix["Self observation count"]]})
    bgee_stats[org["name"]] = dict(st)

# ZFIN wild-type expression
zfin_expr = {"rows": 0, "rows_attached": 0, "rows_not_attached": 0, "zfa_terms_not_attached": set()}
agg = collections.defaultdict(lambda: {"assays": set(), "pubs": set(), "stages": set(), "zfa": set(), "xref": set()})
for r in tsv("wildtype-expression_fish.txt"):
    if len(r) < 12: continue
    gid, sym, fish, sup, supn, sub, subn, st0, st1, assay, mmo, pub = r[:12]
    zfin_expr["rows"] += 1
    hits = {}
    for z in (sup, sub):
        for t, x in zfa2bp.get(z, {}).items(): hits[t] = (z, x)
    if not hits:
        zfin_expr["rows_not_attached"] += 1; zfin_expr["zfa_terms_not_attached"].add(sub or sup); continue
    zfin_expr["rows_attached"] += 1
    kind = "in situ hybridisation" if "in situ" in assay else "immunostaining" if "immuno" in assay.lower() else f"other assay: {assay}"
    gkey = zgene(zdb=gid, sym=sym)
    for t, (z, x) in hits.items():
        a = agg[(t, gkey, kind, stage_key(st0, st1))]
        a["assays"].add(assay); a["pubs"].add(pub); a["stages"].add(f"{st0} to {st1}"); a["zfa"].add(f"{z} {zname.get(z, '')}"); a["xref"].add(x)
for (t, gkey, kind, sk), a in agg.items():
    link(t, gkey, ZF, "expressed in", kind, src("zfin_wildtype-expression_fish", "ZFIN"), sorted(a["xref"]),
         {"period": sk, "zfin_stages": sorted(a["stages"])},
         {"zfin_gene": gkey[3:], "zfa_terms": sorted(a["zfa"]), "assays": sorted(a["assays"]), "publications": [pubref(p) for p in sorted(a["pubs"])]})

# ZFIN phenotypes
comps = collections.defaultdict(list)
for r in tsv("fish_components_fish.txt"):
    if len(r) >= 8: comps[r[0]].append(r)
ftype = {r[0]: r[4] for r in tsv("features.txt") if len(r) >= 5}
KD = ("ZDB-MRPHLNO-", "ZDB-CRISPR-", "ZDB-TALEN-")

# --- vetting additions (Genotype session, 2026-10-31) -------------------------------------------------
# (a) Experimental condition. The clean phenotype file carries a ZDB-GENOX id but not the condition. ZFIN's
#     phenotype_fish.txt carries the ZDB-EXP id for the same annotation, and pheno_environment_fish.txt gives
#     each experiment's ZECO condition. A row is kept only when every experiment it can be matched to is
#     'standard conditions' (ZECO:0000103); chemical treatment, heat shock, etc. are dropped.
env_of = collections.defaultdict(list)
for r in tsv("pheno_environment_fish.txt"):
    if len(r) >= 3: env_of[r[0]].append((r[2], r[1]))
ONT_ID = re.compile(r"^(ZFA|GO|CL|PATO|BSPO|MPATH|UBERON|CHEBI|ZFS):\d+")
exp_index = collections.defaultdict(set)   # (fish, stage0, stage1, pub, ontology ids, tag) -> ZDB-EXP ids
for r in tsv("phenotype_fish.txt"):
    if len(r) < 23: continue
    tag = [x for x in r if x in ("abnormal", "normal")]
    exp_index[(r[0], r[2], r[4], r[21], frozenset(x for x in r if ONT_ID.match(x)), tag[0] if tag else "")].add(r[22])
STD = "ZECO:0000103"
def conditions(r):
    exps = exp_index.get((r[18], r[20], r[21], r[23], frozenset(x for x in r if ONT_ID.match(x)), r[11]), set())
    conds = sorted({c for e in exps for c in env_of.get(e, [("?", "no environment row")])})
    return exps, conds, bool(exps) and all(z == STD for z, _ in conds)
# (b) Loss-of-function evidence per allele: ZFIN's transcript consequence (features-affected-genes.txt), and
#     whether the allele also has an abnormal phenotype when heterozygous (then recessive loss of function is
#     not established: a dominant allele can be gain of function, as the kcnk5b 'alf' alleles are).
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
    if any(TRUNC.search(x) for x in c): return "truncating or splice-site consequence"
    if any(("missense" in x or "nonsynonymous" in x or "inframe" in x) for x in c): return "missense or in-frame consequence only"
    if c: return "other consequence: " + ", ".join(sorted(c))
    return "consequence not recorded in ZFIN"

def classify(fish, fish_name, gene):
    """Returns (link type, perturbation list, rejection reason, loss-of-function evidence)."""
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
            lof.append(("dominant" if aff in het_alleles else "recessive") + " | " + lof_class(aff))
            continue
        return None, None, "unrecognised affector " + aff, None
    if gof: return "sufficient for", kinds, None, "verified gain-of-function allele (hand-checked table GOF)"
    only_alleles = not any(k == "knockdown" for k in lof)
    if only_alleles and not hom:
        return None, None, "allele not homozygous (dominant or heterozygous phenotype: loss of function not established)", None
    if only_alleles and any(x.startswith("dominant") for x in lof) and not any("truncating" in x for x in lof):
        return None, None, "homozygous allele that also has a heterozygous phenotype (dominant) and no truncating consequence: loss of function not established (could be gain of function)", None
    if not only_alleles:
        ev = "knockdown reagent (morpholino, CRISPR or TALEN): loss of function by design; off-target effects are possible"
    elif any("truncating" in x for x in lof):
        ev = "homozygous allele with a truncating or splice-site consequence (ZFIN features-affected-genes): loss of function established"
    else:
        ev = "homozygous allele, recessive (no heterozygous phenotype recorded), consequence " + "; ".join(sorted({x.split(" | ")[1] for x in lof})) + ": loss of function presumed from recessive inheritance, not shown molecularly"
    return "required for", kinds, None, ev
pheno = {"rows_abnormal": 0, "rows_attached": 0, "rows_not_attached": 0, "zfa_terms_not_attached": set(), "rejected": collections.Counter(),
         "lof_evidence_of_kept_rows": collections.Counter(), "conditions_of_rejected_rows": collections.Counter()}
agg = collections.defaultdict(lambda: {"rows": [], "xref": set(), "lof": set()})
for r in tsv("phenoGeneCleanData_fish.txt"):
    if len(r) < 25 or r[11] != "abnormal": continue
    pheno["rows_abnormal"] += 1
    hits = {}
    for z in (r[3], r[7], r[12], r[16]):
        for t, x in zfa2bp.get(z, {}).items(): hits[t] = (z, x)
    if not hits:
        pheno["rows_not_attached"] += 1; pheno["zfa_terms_not_attached"].add(r[7] or r[3]); continue
    pheno["rows_attached"] += 1
    fish_name = re.sub("<[^>]+>", "", r[19]).replace("<sup>", "")
    raw_name = r[19].replace("<sup>", "").replace("</sup>", "")
    typ, kinds, why, lof_ev = classify(r[18], raw_name, r[2])
    if why: pheno["rejected"][why] += 1; continue
    exps, conds, standard = conditions(r)
    if not standard:
        pheno["rejected"]["experimental condition not 'standard conditions' (ZECO:0000103), or ambiguous"] += 1
        for z, n in conds: pheno["conditions_of_rejected_rows"][f"{z} {n}"] += 1
        continue
    pheno["lof_evidence_of_kept_rows"][lof_ev] += 1
    gkey = zgene(zdb=r[2], sym=r[1])
    s0, s1 = stage_name.get(r[20], r[20]), stage_name.get(r[21], r[21])
    for t, (z, x) in hits.items():
        a = agg[(t, gkey, typ, stage_key(s0, s1))]
        a["xref"].add(x); a["lof"].add(lof_ev)
        a["rows"].append({"eq": " ".join(v for v in (r[4], r[6], r[8]) if v) + (" / " + " ".join(v for v in (r[13], r[15], r[17]) if v) if r[16] or r[12] else ""),
                          "quality": f"{r[9]} {r[10]}", "fish": r[18], "fish_name": raw_name, "perturbation": kinds,
                          "stage": f"{s0} to {s1}", "zfs": [stage_zfs.get(r[20]), stage_zfs.get(r[21])],
                          "environment": {"genox": r[22], "experiments": sorted(exps), "conditions": [n for z, n in conds]},
                          **pubref(r[23]), "figure": r[24],
                          **({"gain_of_function": [GOF[k] for k in GOF if any(GOF[k]["allele"] in p for p in kinds)]} if typ == "sufficient for" else {})})
for (t, gkey, typ, sk), a in agg.items():
    body_kind = level[t] == "body"
    link(t, gkey, ZF, typ,
         ("whole-organism phenotype (ZFIN EQ annotation, the parts ZP terms are built from)" if body_kind else
          "gain-of-function allele phenotype (ZFIN EQ annotation)" if typ == "sufficient for" else
          "mutant or knockdown phenotype (ZFIN EQ annotation)"),
         src("zfin_phenoGeneCleanData_fish", "ZFIN"), sorted(a["xref"]), {"period": sk},
         {"zfin_gene": gkey[3:], "loss_of_function_evidence": sorted(a["lof"]), "conditions": "standard conditions (ZECO:0000103) only",
          "phenotypes": a["rows"][:25], "phenotype_rows": len(a["rows"]),
          "publications": [pubref(p) for p in sorted({x["zfin"] for x in a["rows"]})]})

# GO biological process (IMP/IGI only: the GO evidence codes that rest on a mutant phenotype / genetic interaction)
go_sys = collections.defaultdict(set)
for b in json.load(open(os.path.join(CACHE, "ubergraph_go_system_development.json")))["result"]["results"]["bindings"]:
    s = curie(b["s"]["value"])
    if s in level: go_sys[curie(b["go"]["value"])].add(s)
go_body = {"GO:0009952"} | {curie(b["go"]["value"]) for b in json.load(open(os.path.join(CACHE, "ubergraph_go_ap_patterning.json")))["result"]["results"]["bindings"]}
go_label = {curie(b["go"]["value"]): b["l"]["value"] for f in ("ubergraph_go_system_development", "ubergraph_go_ap_patterning")
            for b in json.load(open(os.path.join(CACHE, f + ".json")))["result"]["results"]["bindings"]}
go_label.setdefault("GO:0009952", "anterior/posterior pattern specification")
for t in go_body: go_sys[t].add(BODY)
gaf_date = None
agg = collections.defaultdict(lambda: {"terms": set(), "refs": set(), "codes": set()})
with gzip.open(os.path.join(RAW, "zfin.gaf.gz"), "rt", encoding="utf8") as f:
    for line in f:
        if line.startswith("!date-generated"): gaf_date = line.split(":", 1)[1].strip()
        if line.startswith("!"): continue
        r = line.rstrip("\n").split("\t")
        # GAF 2.2 columns: 1 object id, 2 symbol, 3 qualifier, 4 GO id, 5 reference, 6 evidence code
        if len(r) < 15 or r[4] not in go_sys or r[6] not in ("IMP", "IGI") or "NOT" in r[3]: continue
        gkey = zgene(zdb=r[1], sym=r[2])
        for t in go_sys[r[4]]:
            a = agg[(t, gkey)]; a["terms"].add(f"{r[4]} {go_label.get(r[4], '')}"); a["refs"].add(r[5]); a["codes"].add(r[6])
for (t, gkey), a in agg.items():
    link(t, gkey, ZF, "required for",
         "body-plan patterning: GO biological process annotation (IMP/IGI), developmental-programme membership; the weakest kind" if t == BODY else
         "developmental programme: GO biological process annotation (IMP/IGI), the weakest kind",
         src("go_zfin_gaf", "Gene Ontology (ZFIN annotations)"),
         "GO term 'results in development of' (RO:0002296) the Uberon system, via Ubergraph" if t != BODY else
         "GO:0009952 anterior/posterior pattern specification or a subclass, via Ubergraph",
         {"go": "not stage-resolved"},
         {"go_terms": sorted(a["terms"]), "evidence_codes": sorted(a["codes"]), "references": sorted(a["refs"]),
          "meaning": "GO says this gene is involved in the process, inferred from a mutant phenotype (IMP) or genetic interaction (IGI). Process membership, not a structural requirement."})

# Cell Ontology marker relations (not fish data)
for b in json.load(open(os.path.join(CACHE, "ubergraph_cl_expresses.json")))["result"]["results"]["bindings"]:
    c = curie(b["c"]["value"]); g = curie(b["g"]["value"]); gene_sym["PR:" + g] = b.get("gl", {}).get("value")
    link(c, "PR:" + g, NOTFISH, "expressed in", "Cell Ontology 'expresses' (RO:0002292) marker relation",
         src("ubergraph_cl_expresses", "Cell Ontology via Ubergraph"), "none needed (CL term in the blueprint)",
         {"cl": "not stage-specific"}, {"gene_product": g, "label": b.get("gl", {}).get("value")})

FISH = {ZF["name"], MD["name"]}
direct = [l for l in links]

# ------------------------------------------------------------------ propagation (UP only)
direct_by_node = collections.defaultdict(lambda: collections.defaultdict(set))   # node -> type -> genes (fish only)
for l in direct:
    if l["organism"]["name"] in FISH: direct_by_node[l["blueprint_node"]][l["link_type"]].add(l["gene"])
derived_by_node = collections.defaultdict(lambda: collections.defaultdict(set))
for node, d in list(direct_by_node.items()):
    for typ in ("expressed in", "required for"):
        for anc in ANC[node]:
            derived_by_node[anc][typ] |= d[typ]

# ------------------------------------------------------------------ coverage per layer
coverage = {}
for L in LAYERS:
    rows = []
    for t in by_layer[L]:
        d, dv = direct_by_node.get(t, {}), derived_by_node.get(t, {})
        has_direct = any(d.get(k) for k in ("expressed in", "required for", "sufficient for"))
        has_derived = any(dv.get(k) for k in ("expressed in", "required for"))
        rows.append({"term": t, "label": label[t], "direct": has_direct, "derived_only": (not has_direct) and has_derived,
                     **{f"direct_{k.replace(' ', '_')}_genes": len(d.get(k, ())) for k in ("expressed in", "required for", "sufficient for")},
                     "derived_expressed_in_genes": len(dv.get("expressed in", ())), "derived_required_for_genes": len(dv.get("required for", ()))})
    n = len(rows)
    c = {"denominator": n, "denominator_source": "blueprint counts_distinct",
         "nodes_with_direct_record": sum(r["direct"] for r in rows),
         "nodes_with_only_derived_records": sum(r["derived_only"] for r in rows),
         "nodes_with_none": sum(not r["direct"] and not r["derived_only"] for r in rows),
         "by_type_direct": {k: sum(r[f"direct_{k.replace(' ', '_')}_genes"] > 0 for r in rows) for k in ("expressed in", "required for", "sufficient for")}}
    c["fraction_direct"] = round(c["nodes_with_direct_record"] / n, 4)
    c["absence_note"] = "A node with no record is unstudied in these sources, not gene-free."
    if L == "cell":
        cm = {l["blueprint_node"] for l in direct if l["organism"] is NOTFISH}
        c["cell_ontology_marker_cells"] = len(cm)
        c["cell_ontology_marker_note"] = "Cells with a Cell Ontology 'expresses' marker relation. Not fish data, so not counted as a direct fish record above."
        c["cells_with_zfa_equivalent"] = sum(1 for t in by_layer[L] if any(t in m for m in zfa2bp.values()))
    else:
        c["nodes_with_zfa_xref"] = sum(1 for t in by_layer[L] if u2z.get(t))
    c["rows"] = rows
    coverage[L] = c

# ------------------------------------------------------------------ breadth (pleiotropy)
breadth = collections.defaultdict(lambda: collections.defaultdict(set))
for l in direct:
    if l["organism"]["name"] in FISH: breadth[l["gene"]][l["link_type"]].add(l["blueprint_node"])
def gene_breadth(g):
    b = breadth.get(g, {})
    allnodes = set().union(*b.values()) if b else set()
    return {"blueprint_nodes_direct": len(allnodes), **{k: len(v) for k, v in b.items()},
            "layers": dict(collections.Counter(level[t] for t in allnodes))}

# ------------------------------------------------------------------ focus genes, paralogs kept apart
PF = "UBERON:0000151"
FOCUS = [("Tbx5", ["tbx5a", "tbx5b"]), ("Fgf10", ["fgf10a", "fgf10b"]), ("Shh", ["shha", "shhb"]), ("Hoxd13", ["hoxd13a"])]
sym2keys = collections.defaultdict(set)
for k, s in gene_sym.items():
    if s and k.startswith(("ZF:", "MD:")): sym2keys[s].add(k)
focus = []
for fam, syms in FOCUS:
    for s in syms:
        for k in sorted(sym2keys.get(s, ())):
            ls = [l for l in direct if l["gene"] == k]
            pf = [l for l in ls if l["blueprint_node"] in ({PF} | DESC[PF])]
            focus.append({"family_in_DATA_md": fam, "symbol": s, "gene": k, "organism": (ZF if k.startswith("ZF:") else MD)["name"],
                          "flying_fish_correspondence": "assumed: orthology to a flying-fish gene is not established here; after the teleost genome duplication the two paralogs may have split functions differently in different lineages",
                          "breadth": gene_breadth(k),
                          "pectoral_fin_links": [{"node": l["blueprint_node"], "type": l["link_type"], "kind": l["evidence_kind"], "stage": l["stage"],
                                                  "database": l["source"]["database"],
                                                  "publications": l["evidence"].get("publications", [])} for l in pf]})
# ZFIN records for the focus genes that do NOT attach to the blueprint (e.g. pectoral fin bud)
focus_unattached = collections.defaultdict(lambda: collections.Counter())
fset = {s for _, ss in FOCUS for s in ss}
for r in tsv("wildtype-expression_fish.txt"):
    if len(r) >= 12 and r[1] in fset:
        if not (zfa2bp.get(r[3]) or zfa2bp.get(r[5])): focus_unattached[r[1]][f"{r[5] or r[3]} {zname.get(r[5] or r[3], '')}"] += 1
for f_ in focus:
    f_["zfin_expression_not_attached_to_blueprint"] = dict(focus_unattached[f_["symbol"]].most_common(8)) if f_["gene"].startswith("ZF:") else {}

# ------------------------------------------------------------------ fin size
FIN = "ZFA:0000108"  # ZFA 'fin'; checked below against zfa.obo
assert zname.get(FIN) == "fin", zname.get(FIN)
fin_terms = zclosure(FIN)
SIZEQ = re.compile(r"(increased|decreased) (length|size|width|height)|^(length|size)$")
fs = collections.defaultdict(lambda: {"rows": 0, "qualities": collections.Counter(), "pubs": set(), "zygosity": collections.Counter()})
for r in tsv("phenoGeneCleanData_fish.txt"):
    if len(r) < 25 or r[11] != "abnormal": continue
    if not any(z in fin_terms for z in (r[3], r[7])) or not SIZEQ.search(r[10]): continue
    d = fs[(r[2], r[1])]; d["rows"] += 1; d["qualities"][f"{r[8]} {r[10]}"] += 1; d["pubs"].add(r[23])
    d["zygosity"]["heterozygous" if "/+" in r[19] else "homozygous" if re.search(r"<sup>([^/<]+)/\1</sup>", r[19]) else "other or unspecified"] += 1
pm = json.load(open(os.path.join(CACHE, "pubmed.json")))
abstracts = {}
for a in ET.parse(os.path.join(CACHE, "pubmed_abstracts.xml")).getroot().iter("PubmedArticle"):
    abstracts[a.find(".//PMID").text] = " ".join("".join(x.itertext()) for x in a.findall(".//AbstractText"))
def cite(pmid, quote):
    s = pm["summaries"][pmid]
    assert quote in abstracts[pmid], (pmid, quote)
    return {"pmid": pmid, "doi": s["doi"], "first_author": s["first_author"], "year": s["pubdate"][:4], "journal": s["source"], "title": s["title"],
            "quote_from_abstract": quote}
fin_size = {
 "why": "Fin presence is generic to fish; what is distinctive in flying fish is the size and proportion of the paired fins. Fin size is an organ-level proportion, which connects to Thompson's scaling claims; no scaling is computed here.",
 "verified_leads": [
  {"gene": "kcnk5b", "organism": ZF["name"], "zfin_alleles": ["ty86d (ZDB-ALT-980203-1093)", "dt30mh (ZDB-ALT-150923-2)"],
   "finding": "Gain-of-function mutations in the potassium channel kcnk5b (the 'another longfin' mutant) give proportionally enlarged fins in zebrafish.",
   "link_type": "sufficient for (an increase in fin size, not for making a fin)",
   "citations": [cite("24453984", "alf mutants carry gain-of-function mutations in kcnk5b"),
                 cite("38527087", "overexpression of K+-leak channels in vivo coordinately increased bud proportions")]},
  {"gene": "kcnh2a", "organism": ZF["name"],
   "finding": "The classic longfin (t2) mutant is a regulatory kcnh2a allele that overexpresses this potassium channel and elongates the fins.",
   "link_type": "sufficient for (fin overgrowth); not attached to a blueprint node because ZFIN does not record the longfin phenotype under a single-gene kcnh2a fish",
   "citations": [cite("34061172", "longfint2 chromosome 2 overexpresses the ether-a-go-go-related voltage-gated potassium channel kcnh2a")]},
  {"gene": "kcnh2a and lat4a (ZFIN symbol slc43a2a)", "organism": "35 flying-fish and related species (phylogenomics) plus zebrafish (genetics)",
   "finding": "A phylogenomic study of flying fishes found signatures of convergent paired-fin enlargement and, intersected with zebrafish fin-size mutants, implicated lat4a and kcnh2a.",
   "link_type": "association (comparative genomics), plus zebrafish genetics; not a measurement in a flying-fish fin",
   "citations": [cite("34534441", "we identify a surprising role for an L-type amino acid transporter, lat4a, and the potassium channel, kcnh2a, in the regulation of fin proportion")],
   "symbol_check": "lat4a is the symbol used in the paper. ZFIN lists no alias 'lat4a' for slc43a2a (see aliases_check). The identification rests on two independent records: (1) nomenclature: human SLC43A2 is aliased LAT4, 'L-type amino acid transporter 4' (NCBI Gene 124935), and zebrafish slc43a2a is the 'a' paralog of slc43a2 (NCBI Gene 393221; genotype/cache/ncbi_gene_slc43a2.json); (2) ZFIN curated PMID 34534441 itself to slc43a2a: see zfin_rows_citing_this_paper. Settled by the Genotype session on 2026-10-31."},
  {"gene": "kcnk5b", "organism": ZF["name"],
   "finding": "kcnk5b integrates calcineurin's effect on fin allometry.",
   "citations": [cite("29991812", "we identify the potassium channel kcnk5b as a key player in integrating calcineurin's growth effects")]}],
 "pubmed_queries": pm["queries"],
 "zfin_fin_size_genes": {"definition": "zebrafish genes with an abnormal ZFIN phenotype whose structure is a fin or part of one (ZFA 'fin' part_of/is_a closure) and whose quality is a size or length (PATO increased/decreased length, size, width or height). Any allele type, any zygosity; GOF and LOF are not separated here.",
                         "count": len(fs),
                         "genes": [{"zfin": g, "symbol": s, "rows": d["rows"], "qualities": dict(d["qualities"].most_common(5)),
                                    "zygosity_of_rows": dict(d["zygosity"]), "publications": [pubref(p) for p in sorted(d["pubs"])]}
                                   for (g, s), d in sorted(fs.items(), key=lambda kv: -kv[1]["rows"])]},
}
# aliases.txt columns: id, name, symbol, alias, SO id (the handover's version read the name column by mistake)
al = [r for r in tsv("aliases.txt") if len(r) >= 4 and r[0].startswith("ZDB-GENE-") and r[2] == "slc43a2a"]
fin_size["aliases_check"] = {"source": src("zfin_aliases", "ZFIN"), "zfin_gene": sorted({r[0] for r in al}), "aliases_of_slc43a2a": sorted({r[3] for r in al}),
                             "lat4a_listed": any("lat4a" in r[3].lower() for r in al)}
ncbi = json.load(open(os.path.join(CACHE, "ncbi_gene_slc43a2.json")))["genes"]
fin_size["aliases_check"]["ncbi_gene"] = {k: {kk: v[kk] for kk in ("gene_id", "name", "otheraliases", "otherdesignations", "retrieved")} for k, v in ncbi.items()}
daane_rows = [r for r in tsv("phenoGeneCleanData_fish.txt") if len(r) >= 25 and r[23] == "ZDB-PUB-210918-31"]
fin_size["verified_leads"][2]["zfin_rows_citing_this_paper"] = {
    "zfin_pub": "ZDB-PUB-210918-31", "pmid": pub2pmid.get("ZDB-PUB-210918-31"),
    "genes": sorted({f"{r[1]} ({r[2]})" for r in daane_rows}),
    "rows": [{"gene": r[1], "fish_name": r[19].replace("<sup>", "").replace("</sup>", ""), "structure": f"{r[3]} {r[4]}", "quality": f"{r[9]} {r[10]}", "tag": r[11]} for r in daane_rows],
    "note": "ZFIN's curators attached this paper's fin-length phenotypes to slc43a2a (allele dmh26), which is how ZFIN records the paper's lat4a. The homozygous dmh26 rows enter the map as 'required for' links only if they pass the same rules as every other row."}
# The paper's own supplementary data (Data S1, sheet G) as a further confirmation of the lat4a identity, and its
# measured fin proportions (Data S1, sheet A). Both read from genotype/cache/daane2021_fin_ratios.json and
# genotype/cache/fin_ratios.json, written by genotype/fetch_fin_ratios.py and genotype/fin_ratios_table.py.
fr = json.load(open(os.path.join(CACHE, "daane2021_fin_ratios.json"), encoding="utf8"))
frx = json.load(open(os.path.join(CACHE, "fin_ratios.json"), encoding="utf8"))
G = fr["sheet_G_convergent_substitutions"]
fin_size["verified_leads"][2]["convergent_substitution_in_the_papers_own_data"] = {
    "source": "Daane 2021 Data S1, sheet 'G - conv. aa subst.' (publisher supplement mmc2.xlsx, sha256 " + fr["source"]["sha256"] + "); the paper's own data, not a new result",
    "column_key": G["header"], "footnotes": [r["A"] for r in G["rows"] if len(r) == 1],
    "lat4a_rows": [r for r in G["rows"] if r.get("B") == "lat4a"],
    "ensembl_lookup": frx.get("ensembl_lookup_ENSORLG00000009715"),
    "reading": "The paper's convergence table lists lat4a under medaka Ensembl id ENSORLG00000009715 with a convergent amino-acid substitution F326L present in the gliding halfbeaks E. viridis and O. micropterus and in at least 7 of 9 sequenced flying-fish species, and flags it in the fin screens. Ensembl names ENSORLG00000009715 SLC43A2 (solute carrier family 43 member 2). So the paper's lat4a is the medaka SLC43A2 gene, which is the human LAT4 ortholog family and ZFIN's slc43a2a: a second confirmation of the identity beside ZFIN's curation of the paper."}
fin_size["measured_fin_proportions"] = {"source": fr["source"], "n_specimens": fr["n_rows"], "pectoral_over_SL_by_group": fr["groups"],
                                        "note": "Pectoral fin length / standard length of beloniform museum specimens (Daane 2021 Data S1A), the only flying-fish measurement in this thread. Lengths of preserved specimens only: no mass, fin area, aspect ratio or glide data. Per-specimen rows: genotype/cache/daane2021_data_s1A_fin_measurements.csv."}

# ------------------------------------------------------------------ what gets stored
PFSUB = {PF} | DESC[PF]
keep_genes = {f_["gene"] for f_ in focus} | {k for s in ("kcnk5b", "kcnh2a", "slc43a2a") for k in sym2keys.get(s, ())}
stored = [l for l in direct if l["link_type"] != "expressed in" or l["blueprint_node"] in PFSUB or l["gene"] in keep_genes or l["organism"] is NOTFISH]
derived = []
for l in stored:
    if l["organism"] is NOTFISH or l["link_type"] == "sufficient for": continue
    if not (l["blueprint_node"] in PFSUB or l["gene"] in keep_genes): continue
    for anc, path in ANC[l["blueprint_node"]].items():
        derived.append({**{k: l[k] for k in ("gene", "symbol", "organism", "link_type", "source", "stage")},
                        "layer": level[anc], "blueprint_node": anc, "blueprint_label": label[anc], "derived": True,
                        "evidence_kind": l["evidence_kind"] + (" (derived upward; an inference, never observed at this node)" if l["link_type"] == "required for" else " (derived upward along part_of)"),
                        "path": path, "from_node": l["blueprint_node"]})
genes_tbl = {g: {"symbol": gene_sym.get(g), "breadth": gene_breadth(g)} for g in {l["gene"] for l in stored} if not g.startswith("PR:")}
# breadth summary over every fish gene with any direct record
allb = [len(set().union(*b.values())) for g, b in breadth.items()]

layers_out = {}
for L in LAYERS:
    cov = dict(coverage[L])
    layers_out[L] = {"coverage": {k: v for k, v in cov.items() if k != "rows"}, "nodes": cov["rows"],
                     "links": [l for l in stored if l["layer"] == L], "derived_links": [l for l in derived if l["layer"] == L]}

# compact index of all direct expression links not stored in full
idx = collections.defaultdict(list)
for l in direct:
    if l not in stored and l["link_type"] == "expressed in":
        idx[l["blueprint_node"]].append([l["gene"], l["symbol"], l["organism"]["taxon"], l["evidence_kind"], l["stage"].get("period", "all stages")])
with gzip.open(os.path.join(HERE, "expression_index.json.gz"), "wt", encoding="utf8") as f:
    json.dump({"note": "Every direct 'expressed in' link not stored in full in map.json: node -> [gene, symbol, taxon, evidence_kind, stage period]. Sources and crosswalks as in map.json.", "index": idx}, f)

by_type = collections.Counter(l["link_type"] for l in direct)
by_layer_type = {L: dict(collections.Counter(l["link_type"] for l in direct if l["layer"] == L)) for L in LAYERS}
by_kind = dict(collections.Counter(f'{l["layer"]} | {l["evidence_kind"]} | {l["organism"]["name"]}' for l in direct))
genes_by_org = collections.defaultdict(set)
for l in direct: genes_by_org[l["organism"]["name"]].add(l["gene"])

out = {
 "title": "Genotype-phenotype map for the flying-fish blueprint, from proxy fish, at every layer",
 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/build.py",
 # Corrected 2026-10-31 after Amit caught that the earlier wording understated the flying-fish genome. The paper was
 # then read from its own full text (genotype/cache/calls_flyingfish_genome.json) rather than from the relay.
 "constraint": ("A draft genome of a flying fish EXISTS and is annotated, so the limit here is not missing genes. Xu et al. 2021 (Front Genet 12:695700, "
                "doi 10.3389/fgene.2021.695700) assembled the mirrorwing flyingfish Hirundichthys speculiger and predicted 23,611 protein-coding genes, of "
                "which 23,492 (99.5%) carry at least one database hit; that assembly is the one catalogued as GCA_018398805.1. What the flying fish lacks is "
                "PHENOTYPE and EXPRESSION records: that paper reports no RNA-seq and no transcriptome at all, no mutant, no kinetics and no regulatory "
                "network, and ZFIN-style expression and mutant-phenotype data exist only for zebrafish and, through Bgee, medaka. Every gene link in this map "
                "is therefore a PROXY-species record, zebrafish (Danio rerio) or medaka (Oryzias latipes, the same order Beloniformes as flying fish), and it "
                "is a proxy for that reason rather than because flying-fish genes are unknown. None of these links is a flying-fish measurement."),
 "flying_fish_genome": {
   "exists": True, "species": "Hirundichthys speculiger (mirrorwing flyingfish)", "family": "Exocoetidae",
   "paper": {"authors": "Xu et al.", "year": 2021, "journal": "Frontiers in Genetics 12:695700", "doi": "10.3389/fgene.2021.695700", "pmcid": "PMC8294118", "pmid": "34306036"},
   "assembly": {"size_gb": 1.04, "scaffolds": 3052, "contig_n50_kb": 992.83, "scaffold_n50_kb": 1152.47, "ncbi_accession": "GCA_018398805.1", "bioproject": "PRJNA714815"},
   "busco": {"genome_percent": 94.2, "gene_set_percent": 95.7, "lineage": "actinopterygii_odb9", "tool": "BUSCO v3"},
   "gene_set": {"protein_coding_genes": 23611, "functionally_annotated": 23492, "percent": 99.5,
                "hits_by_database": {"KEGG": 20692, "SwissProt": 21453, "TrEMBL": 23477, "InterPro": 21888},
                "annotation_download": "figshare doi 10.6084/m9.figshare.14600634.v1"},
   "what_functionally_annotated_means_here": ("at least one sequence-similarity or domain hit in one of four databases, and nothing more. TrEMBL alone accounts for "
                                              "23,477 of the hits, and TrEMBL is automatically generated and unreviewed, so 99.5% is a measure of database "
                                              "coverage rather than of understood function."),
   "what_the_paper_does_not_contain": ["no RNA-seq and no transcriptome: the words do not appear anywhere in its text",
                                       "no expression data of any kind, so no gene can be placed in a flying-fish tissue",
                                       "no mutant, no knockdown and no functional assay", "no kinetics and no regulatory network",
                                       "no measurement of the pectoral fin beyond the species' taxonomy"],
   "why_proxies_are_still_needed": ("Sequence is available; phenotype and expression are not. A gene list cannot say where a gene is expressed, what happens when it is "
                                    "lost, or at which stage it acts, and those are what this map is built from."),
   "species_caveat": ("H. speculiger is not one of the species in the fin measurements this thread uses (Cheilopogon furcatus, Exocoetus volitans, Hirundichthys "
                      "rondeleti), so any use of its sequence alongside those measurements is cross-species within Exocoetidae and must be labelled so."),
   "verified": "read from the paper's own full text via Europe PMC on 2026-10-31; every figure above was checked against it (genotype/cache/calls_flyingfish_genome.json)"},
 "causation_warning": "Most links are 'expressed in': the gene's RNA or protein was detected in the structure. That is not causation. 'required for' means a single-gene loss-of-function zebrafish has an abnormal phenotype there (or, for GO-based links, that GO places the gene in the structure's developmental process on mutant evidence). 'sufficient for' here means a verified gain-of-function allele changes the structure (e.g. enlarges it); it does not mean the gene makes the structure. No gene 'makes' a fin.",
 "link_types": {"expressed in": "expression data", "required for": "a loss-of-function phenotype", "sufficient for": "a gain-of-function result"},
 "propagation_rules": {
   "expressed in": "propagates UP part_of: expression in a part implies some expression in what contains it. Marked derived with the path.",
   "required for": "never propagates DOWN. Propagation UP is an inference, marked derived, never presented as observed.",
   "sideways": "never between siblings.",
   "graph": "the blueprint's own part_of placements (organism-design/examples/a-flying-fish.json), which the lean thread kernel-certified as acyclic and rooted, so propagation is well defined and terminates. Bgee's own propagation is excluded: only Bgee calls that include data observed in that very structure are used."},
 "blueprint": {"file": "organism-design/examples/a-flying-fish.json", "sha256": sha(BP_PATH), "taxon": bp["reading"]["taxon"]["term"],
               "counts_distinct": bp["counts_distinct"],
               "pectoral_fin_subtree": [{"term": t, "label": label[t], "level": level[t]} for t in sorted(PFSUB)],
               "pectoral_fin_note": f"In the blueprint the pectoral fin has one tissue beneath it (mesenchyme pectoral fin) and no cell types. ZFA has {len(zclosure('ZFA:0001161')) - 1} terms that are parts of the zebrafish pectoral fin; the blueprint has a node for none of them except the mesenchyme, so ZFIN records on those parts do not attach."},
 "crosswalk": {"uberon_to_zfa": src("ubergraph_uberon_zfa_xrefs", "Uberon via Ubergraph"), "zfa": {**src("zfa_obo", "ZFA"), "version": zfa_version},
               "rule": "ZFIN records attach only through Uberon hasDbXref ZFA or ZFA xref CL. Never by name. Medaka data comes only from Bgee, which annotates medaka samples to Uberon itself; no MFO term was mapped by this thread."},
 "summary": {
   "direct_links": len(direct), "direct_links_by_type": {k: by_type.get(k, 0) for k in ("expressed in", "required for", "sufficient for")},
   "direct_links_by_layer_and_type": by_layer_type, "direct_links_by_layer_kind_organism": dict(sorted(by_kind.items())),
   "derived_links_stored": len(derived), "genes_by_organism": {k: len(v) for k, v in genes_by_org.items()},
   "proxy_organisms": [ZF, MD],
   "coverage": {L: {k: v for k, v in coverage[L].items() if k != "rows"} for L in LAYERS},
   "bgee": bgee_stats,
   "zfin_expression": {k: (len(v) if isinstance(v, set) else v) for k, v in zfin_expr.items()},
   "zfin_phenotype": {k: (len(v) if isinstance(v, set) else dict(v) if isinstance(v, collections.Counter) else v) for k, v in pheno.items()},
   "gene_breadth_all_fish_genes": {"genes": len(allb), "median_blueprint_nodes": statistics.median(allb) if allb else 0, "max": max(allb) if allb else 0,
                                    "note": "how many blueprint nodes each gene touches by direct record; a gene in many nodes is pleiotropic, not a fin gene"},
   "go_gaf_date": gaf_date,
   "gene_id_rules": {"bgee_zebrafish_gene_keys_by_rule": dict(gene_key_rule), "genes_merged_by_symbol": len(gene_merges),
                     "examples": dict(list(gene_merges.items())[:5]),
                     "note": "Bgee 15.2 and ZFIN's ensembl_1_to_1 table use different Ensembl releases. A Bgee gene whose Ensembl id is absent from ZFIN's table is merged onto the ZFIN gene with exactly the same symbol; otherwise it keeps its Ensembl id as its key. Medaka genes keep Ensembl ids (no ZFIN)."},
   "storage": "map.json stores in full: every 'required for' and 'sufficient for' link, every link in the pectoral-fin subtree, every link of the focus and fin-size genes, and the Cell Ontology marker links. All other direct 'expressed in' links are in genotype/expression_index.json.gz."},
 "focus_genes": {"note": "Zebrafish and medaka genes in the families of dashboard/figures/DATA.md (Tbx5, Fgf10, Shh, Hoxd13). Paralogs kept separate. Symbols matched exactly in the source files.", "genes": focus},
 "fin_size": fin_size,
 "genes": genes_tbl,
 "not_sourced": [
   "Any flying-fish (Exocoetidae) expression or phenotype record: none exists in Bgee or ZFIN.",
   "Medaka phenotypes: no medaka phenotype database was queried; medaka links are Bgee expression only.",
   "Bgee SPARQL endpoint: refused (HTTP 403, a Cloudflare challenge page); Bgee bulk call files were used instead.",
   "Bgee REST expr_calls page: HTTP 200 with no expression calls for the parameters tried.",
   "Stage for Bgee links: the anatomy-only call files merge stages; Bgee links carry no stage.",
   "ZP term identifiers: ZFIN's EQ annotations (ZFA + PATO) were used; they were not converted to ZP IDs."],
 "vetting": {
   "by": "Genotype session, 2026-10-31, after genotype/HANDOVER.md",
   "fixes": [
     "Gene keys: Bgee Ensembl ids absent from ZFIN's 1:1 table are merged onto the ZFIN gene with the identical symbol (summary.gene_id_rules); fgf10a and shha no longer appear twice.",
     "Experimental condition: phenotype rows are kept only under ZFIN 'standard conditions' (ZECO:0000103), matched through phenotype_fish.txt and pheno_environment_fish.txt. The clean file turned out to be almost entirely standard conditions already; what is rejected is mostly annotations that ZFIN also recorded under a treatment experiment and that the join cannot tell apart (ambiguous), plus a few uniquely non-standard rows (summary.zfin_phenotype.rejected, conditions_of_rejected_rows, which lists every condition among the candidate experiments of rejected rows, standard conditions included).",
     "Loss of function: every 'required for' phenotype link carries loss_of_function_evidence; homozygous alleles that also have a heterozygous phenotype and no truncating consequence are rejected as 'loss of function not established' instead of being typed 'required for'.",
     "lat4a = slc43a2a settled on two records (fin_size.verified_leads[2].symbol_check); the aliases check now reads the symbol column."],
   "still_open": [
     "ZFIN records attach only where the blueprint has a node with an ontology cross-reference; 16 of 257 cell types have a ZFA equivalent, so the cell layer is capped by the crosswalk.",
     "Bgee links carry no stage (anatomy-only call file). Body-level Bgee links are whole-organism samples, real but not body-plan evidence.",
     "GO system mapping misses musculoskeletal, integumental and other systems (no GO term 'results in development of' their Uberon term).",
     "No ZP identifiers; ZFIN EQ annotations stand in. No medaka phenotype source."]},
 "layers": layers_out,
}
json.dump(out, open(os.path.join(HERE, "map.json"), "w"), indent=1)

# ------------------------------------------------------------------ map.vetted.json: the slim copy for the repo and the 3D view
# Same top-level keys and the same per-layer shape (coverage, nodes, links, derived_links). Evidence blobs are
# trimmed and 'expressed in' links are kept only for the pectoral-fin subtree, the focus genes and the fin-size
# genes, capped per node; per-node counts in `nodes` are complete and unchanged.
CAP_EXPR = 150
LOF_SHORT = [("knockdown reagent", "knockdown"), ("truncating or splice-site", "truncating allele: loss of function established"),
             ("verified gain-of-function", "verified gain of function"), ("consequence not recorded", "recessive allele, consequence not recorded: loss of function presumed"),
             ("missense or in-frame", "recessive allele, missense or in-frame: loss of function presumed"), ("", "recessive allele, other consequence: loss of function presumed")]
def lof_short(s): return next(short for key, short in LOF_SHORT if key in s)
def slim_link(l):
    e = l["evidence"]; s = {k: l[k] for k in ("layer", "blueprint_node", "blueprint_label", "gene", "symbol", "link_type", "evidence_kind", "derived", "stage")}
    s["organism"] = {"name": l["organism"]["name"], "taxon": l["organism"]["taxon"]}
    s["source"] = {"database": l["source"]["database"], "call": l["source"]["call"]}
    if l["link_type"] in ("required for", "sufficient for") and "phenotypes" in e:
        p0 = e["phenotypes"][0]
        s["evidence"] = {"loss_of_function_evidence": sorted({lof_short(x) for x in e.get("loss_of_function_evidence", [])}), "phenotype_rows": e["phenotype_rows"],
                         "phenotypes": [{"eq": p0["eq"], "quality": p0["quality"], "fish_name": p0["fish_name"], "stage": p0["stage"], **({"pmid": p0["pmid"]} if "pmid" in p0 else {})}],
                         "publications": e["publications"][:3], "n_publications": len(e["publications"]),
                         **({"gain_of_function": p0.get("gain_of_function")} if l["link_type"] == "sufficient for" else {})}
    elif "go_terms" in e:
        s["evidence"] = {"go_terms": e["go_terms"][:5], "evidence_codes": e["evidence_codes"], "n_references": len(e["references"])}
    elif "assays" in e:
        s["evidence"] = {"assays": e["assays"], "zfa_terms": e["zfa_terms"][:4], "n_publications": len(e["publications"]), "publications": e["publications"][:3]}
    elif "ensembl" in e:
        s["evidence"] = {"ensembl": e["ensembl"], "call_quality": e["call_quality"], "data_types_observed": e["data_types_observed"]}
    else:
        s["evidence"] = e
    return s
vet_layers, omitted = {}, {}
for L in LAYERS:
    keep, per_node = [], collections.Counter()
    for l in layers_out[L]["links"]:
        if l["link_type"] == "expressed in":
            if per_node[l["blueprint_node"]] >= CAP_EXPR:
                omitted[l["blueprint_node"]] = omitted.get(l["blueprint_node"], 0) + 1; continue
            per_node[l["blueprint_node"]] += 1
        keep.append(slim_link(l))
    vet_layers[L] = {"coverage": layers_out[L]["coverage"], "nodes": layers_out[L]["nodes"], "links": keep,
                     "derived_links": [], "derived_links_note": f"{len(layers_out[L]['derived_links'])} derived links are in map.json only; the per-node derived counts in `nodes` are complete."}
vetted = {k: out[k] for k in ("title", "built", "tool", "constraint", "flying_fish_genome", "causation_warning", "link_types", "propagation_rules", "blueprint", "crosswalk", "summary", "focus_genes", "fin_size", "genes", "not_sourced", "vetting")}
vetted["vetted"] = True
vetted["slimming"] = {"of": "genotype/map.json", "rule": f"evidence trimmed; 'expressed in' links capped at {CAP_EXPR} per node; derived links dropped (counts kept in nodes)",
                      "expressed_in_links_omitted_by_node": omitted, "full_file_sha256": sha(os.path.join(HERE, "map.json"))}
vetted["layers"] = vet_layers
json.dump(vetted, open(os.path.join(HERE, "map.vetted.json"), "w"), separators=(",", ":"))
print("map.vetted.json MB", os.path.getsize(os.path.join(HERE, "map.vetted.json")) / 1e6)
s = out["summary"]
print(json.dumps({k: s[k] for k in ("direct_links", "direct_links_by_type", "direct_links_by_layer_and_type", "genes_by_organism", "bgee", "zfin_expression", "zfin_phenotype", "gene_breadth_all_fish_genes")}, indent=1))
for L in LAYERS: print(L, {k: v for k, v in coverage[L].items() if k not in ("rows",)})
print("stored", len(stored), "derived", len(derived), "size MB", os.path.getsize(os.path.join(HERE, "map.json")) / 1e6)
