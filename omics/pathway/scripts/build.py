"""Offline build of the omics PATHWAY layer.

Reads the raw downloads in C:/Temp/omics-cache/pathway/raw (made by scripts/fetch.py, every call logged in
omics/pathway/calls.json) and omics/genes.json (the gene universe), and writes:
  omics/pathway/annotations.jsonl.gz   rows in the omics/SCHEMA.md format
  omics/pathway/pathway-crosswalk.json key-pathway concordance + cross-source pathway alignment (name + Jaccard)
  omics/pathway/MANIFEST.json
SOURCES.md is written by hand from the numbers this prints / puts in MANIFEST.json and the crosswalk.

Relation to genotype/pathways.json: that file (genotype thread) holds GO BP from the ZFIN GAF, Reactome lowest
level and KEGG dre for the vetted genotype map. This layer re-downloads those sources (same URLs), adds GO MF/CC,
UniProt-GOA, Reactome all levels, WikiPathways and Pathway Commons (PID/PANTHER/NetPath/INOH, human, borrowed),
and the concordance view. It does not modify genotype/.
Usage: python -I omics/pathway/scripts/build.py
"""
import collections, datetime, gzip, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # omics/pathway
OMICS = os.path.dirname(HERE)
RAW = "C:/Temp/omics-cache/pathway/raw"
NOW = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
calls = json.load(open(os.path.join(HERE, "calls.json")))
CALL = {}
for c in calls:
    if c.get("status") == 200: CALL.setdefault(c["call"], c)


def zopen(fn): return gzip.open(os.path.join(RAW, fn), "rt", encoding="utf-8", errors="replace")


def tsv(fn, skip="#"):
    for line in zopen(fn):
        if not line.strip() or (skip and line.startswith(skip)): continue
        yield line.rstrip("\n").split("\t")


def day(name):
    c = CALL.get(name); return c["retrieved"][:10] if c else None


# ---------------------------------------------------------------- gene universe + ID maps
G = json.load(open(os.path.join(OMICS, "genes.json")))
UNI = {g["zfin_id"]: g for g in G["genes"]}
def gene_obj(z):
    g = UNI[z]; return {"symbol": g["symbol"], "zfin_id": z, "ensembl_gene": g.get("ensembl_gene"), "uniprot": g.get("uniprot")}

ncbi2z, ens2z, up2z, zsym = collections.defaultdict(set), collections.defaultdict(set), collections.defaultdict(set), {}
for r in tsv("zfin_gene.txt.gz"):
    if r[0].startswith("ZDB-GENE"): ncbi2z[r[3]].add(r[0]); zsym[r[0]] = r[2]
for r in tsv("zfin_ensembl_1_to_1.txt.gz"):
    if r[0].startswith("ZDB-GENE"): ens2z[r[3]].add(r[0]); zsym.setdefault(r[0], r[2])
for r in tsv("zfin_uniprot.txt.gz"):
    if r[0].startswith("ZDB-GENE"): up2z[r[3]].add(r[0])
# human symbol -> zebrafish genes (all ZFIN-curated orthology pairs; paralogs both receive the human annotation)
hs2z = collections.defaultdict(set)
for r in tsv("zfin_human_orthos.txt.gz"):
    if r[0].startswith("ZDB-GENE"): hs2z[r[3]].add(r[0])

rows = []
def add(z, feature, value, src, kind, evidence, species="Danio rerio", **extra):
    r = {"gene": gene_obj(z), "species": species, "layer": "pathway", "feature": feature, "value": value, "unit": None,
         "context": {"anatomy": None, "stage": None, "cell_type": None, "condition": None},
         "source": src, "kind": kind, "evidence": evidence, "concordance": None}
    r.update(extra); rows.append(r)

LIC = {
 "GO": "CC BY 4.0 (Gene Ontology Consortium; annotations by ZFIN)",
 "GOA": "CC BY 4.0 (EMBL-EBI UniProt-GOA)",
 "Reactome": "CC0 (Reactome licence section 1c: all data in the Reactome database and files derived from it)",
 "KEGG": "KEGG REST API: free for academic use only; not open; redistribution and commercial use need a licence from Kanehisa Laboratories / Pathway Solutions",
 "WikiPathways": "CC0 (WikiPathways)",
 "PC": "Pathway Commons v14 aggregate; licence is the original datasource's (PID: public domain US-government work; PANTHER: free academic/commercial use with citation; NetPath: CC BY 2.5; INOH: CC BY 2.1 JP). Check per datasource before redistribution",
}

# ---------------------------------------------------------------- Gene Ontology
EXP = {"EXP", "IDA", "IPI", "IMP", "IGI", "IEP"}
HTP = {"HTP", "HDA", "HMP", "HGI", "HEP"}
ORTHO = {"ISO", "ISS", "ISA", "ISM", "IBA", "IBD", "IKR", "IRD", "RCA"}
STMT = {"TAS", "NAS", "IC"}
def go_class(ev):
    if ev in EXP: return "experimental", "curated"
    if ev in HTP: return "experimental-high-throughput", "curated"
    if ev == "IEA": return "electronic", "inferred-electronic"
    if ev in ORTHO: return ("phylogenetic" if ev in {"IBA", "IBD", "IKR", "IRD"} else "orthology/sequence-similarity"), "borrowed-ortholog"
    if ev in STMT: return "author/curator statement", "curated"
    return None, None   # ND and anything unknown: dropped

# GO ontology: names, namespace, parents via is_a, part_of, (positively_/negatively_)regulates
goname, gons, par_struct, par_reg, obsolete = {}, {}, collections.defaultdict(set), collections.defaultdict(set), set()
cur = None
for line in zopen("go-basic.obo.gz"):
    line = line.rstrip("\n")
    if line == "[Term]": cur = {}; continue
    if line.startswith("[") : cur = None; continue
    if cur is None or ":" not in line: continue
    k, v = line.split(": ", 1) if ": " in line else (line, "")
    if k == "id": cur["id"] = v
    elif k == "name": goname[cur["id"]] = v
    elif k == "namespace": gons[cur["id"]] = v
    elif k == "is_obsolete" and v == "true": obsolete.add(cur["id"])
    elif k == "is_a": par_struct[cur["id"]].add(v.split()[0])
    elif k == "relationship":
        rel, tgt = v.split()[:2]
        if rel == "part_of": par_struct[cur["id"]].add(tgt)
        elif rel in ("regulates", "positively_regulates", "negatively_regulates"): par_reg[cur["id"]].add(tgt)
ANC = {}
def ancestors(t):
    """is_a/part_of/regulates closure (regulation of X counts as X's pathway, as KEGG/Reactome include regulators)."""
    if t in ANC: return ANC[t]
    seen, stack = {t}, [t]
    while stack:
        x = stack.pop()
        for p in par_struct.get(x, set()) | par_reg.get(x, set()):
            if p not in seen: seen.add(p); stack.append(p)
    ANC[t] = seen; return seen

ASPECT = {"P": "go_process", "F": "go_function", "C": "go_component"}
go_counts = {"ZFIN": collections.Counter(), "UniProt-GOA": collections.Counter()}
go_dropped = collections.Counter()
go_ann = collections.defaultdict(list)    # zfin -> [(go, ev, cls, db)] all genes (for crosswalk sets)
seen_zfin = set()

def read_gaf(fn, db, idmap):
    agg = collections.OrderedDict()
    for r in tsv(fn, skip="!"):
        if len(r) < 15: continue
        qual, go, ref, ev, aspect = r[3], r[4], r[5], r[6], r[8]
        if "NOT" in qual.split("|"): go_dropped[f"{db}: NOT-qualified"] += 1; continue
        cls, kind = go_class(ev)
        if not cls: go_dropped[f"{db}: evidence {ev}"] += 1; continue
        if r[12] != "taxon:7955" and not r[12].startswith("taxon:7955|"): go_dropped[f"{db}: other taxon"] += 1; continue
        zs = idmap(r)
        if not zs: go_dropped[f"{db}: product not mapped to a ZFIN gene"] += 1; continue
        for z in zs:
            key = (z, go, ev)
            if db == "UniProt-GOA" and key in seen_zfin: go_dropped["UniProt-GOA: same gene+term+evidence already in ZFIN GAF"] += 1; continue
            if db == "UniProt-GOA" and r[14] == "ZFIN": go_dropped["UniProt-GOA: assigned_by ZFIN but not in ZFIN GAF (different release)"] += 1; continue
            go_ann[z].append((go, ev, cls, db, aspect))
            if z not in UNI: continue
            a = agg.setdefault(key, {"z": z, "go": go, "ev": ev, "cls": cls, "kind": kind, "aspect": aspect, "qual": qual, "refs": [], "by": set(), "acc": r[1]})
            if ref not in a["refs"]: a["refs"].append(ref)
            a["by"].add(r[14])
    if db == "ZFIN": seen_zfin.update(agg.keys())
    for (z, go, ev), a in agg.items():
        go_counts[db][a["cls"]] += 1
        src = {"db": db, "release_or_date": day("zfin_gaf" if db == "ZFIN" else "goa_zebrafish_gaf"),
               "url": CALL["zfin_gaf" if db == "ZFIN" else "goa_zebrafish_gaf"]["url"], "accession": go,
               "licence": LIC["GO" if db == "ZFIN" else "GOA"]}
        add(z, ASPECT[a["aspect"]], goname.get(go, go), src, a["kind"], ev, go_id=go, evidence_class=a["cls"],
            qualifier=a["qual"], assigned_by=sorted(a["by"]), references=a["refs"][:8], n_references=len(a["refs"]),
            **({"gaf_object": "UniProtKB:" + a["acc"]} if db != "ZFIN" else {}))

read_gaf("zfin.gaf.gz", "ZFIN", lambda r: {r[1]} if r[0] == "ZFIN" and r[1].startswith("ZDB-GENE") else set())
read_gaf("goa_zebrafish.gaf.gz", "UniProt-GOA", lambda r: up2z.get(r[1].split("-")[0], set()) if r[0] == "UniProtKB" else set())

# ---------------------------------------------------------------- Reactome (Danio rerio = inferred from human)
r_name, r_parent = {}, collections.defaultdict(set)
for r in tsv("ReactomePathways_dre.txt.gz"): r_name[r[0]] = r[1]
for r in tsv("ReactomePathwaysRelation_dre.txt.gz"): r_parent[r[1]].add(r[0])
children = set(r_parent)
r_top = {p for p in r_name if p not in children}
lowest = collections.defaultdict(set)
for r in tsv("Ensembl2Reactome_dre.txt.gz"): lowest[r[0]].add(r[1])
R_SETS = collections.defaultdict(set)   # pathway -> zfin genes (whole genome)
r_rows = 0; r_unmapped = set()
r_gene_pw = collections.defaultdict(dict)
for r in tsv("Ensembl2Reactome_All_Levels_dre.txt.gz"):
    ens, pid, name, ev = r[0], r[1], r[3], r[4]
    r_name.setdefault(pid, name)
    zs = ens2z.get(ens)
    if not zs: r_unmapped.add(ens); continue
    for z in zs:
        R_SETS[pid].add(z)
        if z in UNI: r_gene_pw[z][pid] = (ev, pid in lowest.get(ens, ()))
for z, pws in r_gene_pw.items():
    for pid, (ev, low) in pws.items():
        r_rows += 1
        add(z, "pathway_member", r_name[pid], {"db": "Reactome", "release_or_date": "Reactome v" + zopen("reactome_version.txt.gz").read().strip() + " (" + day("reactome_ensembl2reactome_all_levels") + ")",
            "url": CALL["reactome_ensembl2reactome_all_levels"]["url"], "accession": pid, "licence": LIC["Reactome"]},
            "borrowed-ortholog", ev, pathway_id=pid, lowest_level=low, top_level=pid in r_top,
            note="Danio rerio Reactome events are inferred electronically from curated human reactions via PANTHER orthology")

# ---------------------------------------------------------------- KEGG dre
k_name = {}
for r in tsv("kegg_list_pathway_dre.txt.gz"):
    k_name[r[0].replace("path:", "")] = re.sub(r" - Danio rerio \(zebrafish\)$", "", r[1])
K_SETS = collections.defaultdict(set); k_unmapped = set()
for r in tsv("kegg_link_pathway_dre.txt.gz"):
    gid, pid = r[0].replace("dre:", ""), r[1].replace("path:", "")
    zs = ncbi2z.get(gid)
    if not zs: k_unmapped.add(gid); continue
    for z in zs: K_SETS[pid].add(z)
kegg_rel = " ".join(l.strip() for l in zopen("kegg_info_dre.txt.gz").read().splitlines()[:3])
for pid, zs in K_SETS.items():
    for z in zs & UNI.keys():
        add(z, "pathway_member", k_name.get(pid, pid), {"db": "KEGG", "release_or_date": day("kegg_link_pathway_dre"),
            "url": CALL["kegg_link_pathway_dre"]["url"], "accession": pid, "licence": LIC["KEGG"]},
            "borrowed-ortholog", "KO assignment", pathway_id=pid,
            note="KEGG places dre genes on reference pathway maps through KEGG Orthology (KO) assignment; the reference maps are drawn mostly from non-fish literature")

# ---------------------------------------------------------------- WikiPathways Danio rerio
W_SETS, w_name, w_prov = collections.defaultdict(set), {}, {}
w_unmapped = set()
for r in tsv("wikipathways_Danio_rerio.gmt.gz", skip=None):
    nm, _, wp, _ = r[0].split("%")
    w_name[wp] = nm.strip()
    for gid in r[2:]:
        zs = ncbi2z.get(gid)
        if not zs: w_unmapped.add(gid); continue
        W_SETS[wp].update(zs)
    try:
        gp = gzip.open(os.path.join(RAW, "wikipathways_gpml", wp + ".gpml.gz"), "rt", encoding="utf-8").read()
        m = re.search(r'<Comment Source="HomologyConvert">(.*?)</Comment>', gp, re.S)
        lm = re.search(r'Last-Modified="(\d+)"', gp)
        w_prov[wp] = {"homology_converted": bool(m), "comment": m.group(1)[:300] if m else None, "last_modified": lm.group(1) if lm else None}
    except FileNotFoundError:
        w_prov[wp] = {"homology_converted": None, "comment": "GPML not fetched", "last_modified": None}
for wp, zs in W_SETS.items():
    hc = w_prov[wp]["homology_converted"]
    for z in zs & UNI.keys():
        add(z, "pathway_member", w_name[wp], {"db": "WikiPathways", "release_or_date": "20261010",
            "url": CALL["wikipathways_gmt_danio_rerio"]["url"], "accession": wp, "licence": LIC["WikiPathways"]},
            "borrowed-ortholog" if hc else "curated", "HomologyConvert" if hc else "community curation",
            pathway_id=wp, homology_converted=hc,
            note=("Pathway was converted from a human WikiPathways pathway by homology mapping (GPML HomologyConvert comment): " + (w_prov[wp]["comment"] or "")[:160]) if hc else "Community-curated zebrafish pathway (no HomologyConvert comment in the GPML)")

# ---------------------------------------------------------------- Pathway Commons v14 (human; borrowed)
PC_KEEP = {"pid": "PID", "panther": "PANTHER", "netpath": "NetPath", "inoh": "INOH"}   # Reactome/KEGG already counted; humancyc/pathbank are metabolic
P_SETS, p_name, p_db = collections.defaultdict(set), {}, {}
p_hs = collections.defaultdict(set)
for r in tsv("pc-hgnc.gmt.gz", skip=None):
    m = re.search(r"name: (.*?); datasource: (\w+)", r[1])
    if not m or m.group(2) not in PC_KEEP: continue
    pid = r[0].replace("http://bioregistry.io/", "").replace("https://identifiers.org/", "")
    p_name[pid], p_db[pid] = m.group(1).strip().rstrip("."), PC_KEEP[m.group(2)]
    for s in r[2:]:
        p_hs[pid].add(s)
        P_SETS[pid].update(hs2z.get(s, ()))
for pid, zs in P_SETS.items():
    for z in zs & UNI.keys():
        hs = sorted(s for s in p_hs[pid] if z in hs2z.get(s, ()))
        add(z, "pathway_member", p_name[pid], {"db": p_db[pid] + " (via Pathway Commons v14)", "release_or_date": "PC v14 (2024-05-21)",
            "url": CALL["pathwaycommons_v14_gmt"]["url"], "accession": pid, "licence": LIC["PC"]},
            "borrowed-ortholog", "human pathway via ZFIN orthology", species="Homo sapiens", pathway_id=pid, human_genes=hs,
            note="Human pathway; transferred to this zebrafish gene through ZFIN-curated human orthology (paralogs each receive it)")

# ---------------------------------------------------------------- key developmental signalling pathways
GO_BP_SETS = collections.defaultdict(set); GO_BP_EXP = collections.defaultdict(set)
for z, anns in go_ann.items():
    for go, ev, cls, db, aspect in anns:
        if aspect != "P" or go in obsolete: continue
        for a in ancestors(go):
            GO_BP_SETS[a].add(z)
            if cls.startswith("experimental"): GO_BP_EXP[a].add(z)

KEY = [  # name, GO roots, KEGG regex, Reactome regex (names), WikiPathways regex, PC regex
 ("Wnt", ["GO:0016055"], r"^Wnt signaling", r"^Signaling by WNT$", r"wnt", r"\bwnt"),
 ("Fgf", ["GO:0008543"], None, r"^Signaling by FGFR$", r"\bfgf|fibroblast growth factor", r"\bfgf|fibroblast growth factor"),
 ("Hedgehog (Shh)", ["GO:0007224"], r"^Hedgehog signaling", r"^Signaling by Hedgehog$", r"hedgehog", r"hedgehog|\bshh\b"),
 ("Bmp / TGF-beta", ["GO:0030509"], r"^TGF-beta signaling", r"^Signaling by BMP$", r"\bbmp", r"\bbmp|bone morphogenetic"),
 ("Notch", ["GO:0007219"], r"^Notch signaling", r"^Signaling by NOTCH$", r"notch", r"notch"),
 ("Retinoic acid", ["GO:0048384", "GO:0042573"], r"^Retinol metabolism", r"^Signaling by Retinoic Acid$|^RA biosynthesis pathway$", r"retino", r"retino"),
 ("Bioelectric / K+ channel (kcnk5b)", ["GO:0042391", "GO:0071805"], None, r"^Potassium Channels$", r"potassium channel|membrane potential", r"potassium channel"),
 ("Calcineurin-NFAT", ["GO:0033173", "GO:0097720"], None, r"^Calcineurin activates NFAT$", r"calcineurin|nfat", r"calcineurin|nfat"),
]
def pick(names, rx):
    return sorted(p for p, n in names.items() if rx and re.search(rx, n, re.I))
KEYSETS = {}
for name, gos, kx, rx, wx, px in KEY:
    sel = {"GO": [g for g in gos], "KEGG": pick(k_name, kx), "Reactome": pick(r_name, rx), "WikiPathways": pick(w_name, wx), "PathwayCommons": pick(p_name, px)}
    sets = {"GO": set().union(*[GO_BP_SETS.get(g, set()) for g in gos]),
            "GO_experimental": set().union(*[GO_BP_EXP.get(g, set()) for g in gos]),
            "KEGG": set().union(*[K_SETS[p] for p in sel["KEGG"]]) if sel["KEGG"] else set(),
            "Reactome": set().union(*[R_SETS[p] for p in sel["Reactome"]]) if sel["Reactome"] else set(),
            "WikiPathways": set().union(*[W_SETS[p] for p in sel["WikiPathways"]]) if sel["WikiPathways"] else set(),
            "PathwayCommons": set().union(*[P_SETS[p] for p in sel["PathwayCommons"]]) if sel["PathwayCommons"] else set()}
    KEYSETS[name] = (sel, sets)

KEY_DB = {"GO": ("Gene Ontology (ZFIN + UniProt-GOA)", CALL["zfin_gaf"]["url"], LIC["GO"]),
          "KEGG": ("KEGG", CALL["kegg_link_pathway_dre"]["url"], LIC["KEGG"]),
          "Reactome": ("Reactome", CALL["reactome_ensembl2reactome_all_levels"]["url"], LIC["Reactome"]),
          "WikiPathways": ("WikiPathways", CALL["wikipathways_gmt_danio_rerio"]["url"], LIC["WikiPathways"]),
          "PathwayCommons": ("PID/PANTHER/NetPath/INOH (via Pathway Commons v14)", CALL["pathwaycommons_v14_gmt"]["url"], LIC["PC"])}
SRC4 = ["GO", "Reactome", "KEGG", "WikiPathways"]
SRC3 = ["GO", "Reactome", "WikiPathways"]   # public (no KEGG: licence)
concord = {}
for name, (sel, sets) in KEYSETS.items():
    members = collections.defaultdict(set)
    for s in SRC4 + ["PathwayCommons"]:
        for z in sets[s] & UNI.keys(): members[z].add(s)
    for z, ss in members.items():
        for s in ss:
            via = sel[s]
            if s == "GO":
                via = sorted({go for go, ev, cls, db, asp in go_ann[z] if asp == "P" and go not in obsolete and ancestors(go) & set(sel["GO"])})
                kinds = sorted({go_class(ev)[1] for go, ev, cls, db, asp in go_ann[z] if go in via})
                ev = "experimental GO evidence" if z in sets["GO_experimental"] else "non-experimental GO evidence only"
                kind = "curated" if z in sets["GO_experimental"] else ("borrowed-ortholog" if "borrowed-ortholog" in kinds else "inferred-electronic")
            elif s == "WikiPathways":
                via = [p for p in sel[s] if z in W_SETS[p]]
                kind = "curated" if any(not w_prov[p]["homology_converted"] for p in via) else "borrowed-ortholog"; ev = "pathway membership"
            else:
                SETS = {"KEGG": K_SETS, "Reactome": R_SETS, "PathwayCommons": P_SETS}[s]
                via = [p for p in sel[s] if z in SETS[p]]; kind = "borrowed-ortholog"; ev = "pathway membership"
            db, url, lic = KEY_DB[s]
            n4 = len(ss & set(SRC4)); n3 = len(ss & set(SRC3))
            add(z, "key_pathway_member", name + " signalling" if not name.startswith("Bioelectric") and not name.startswith("Retinoic") else name,
                {"db": db, "release_or_date": NOW[:10], "url": url, "accession": ",".join(via[:20]) or None, "licence": lic},
                kind, ev, species="Homo sapiens" if s == "PathwayCommons" else "Danio rerio", via=via[:40],
                **({"n_core_sources_with_kegg": n4, "core_sources_with_kegg": sorted(ss & set(SRC4))} if s == "KEGG" else {}),
                n_public_core_sources=n3, public_core_sources=sorted(ss & set(SRC3)),
                concordance_note="public_core_sources = GO, Reactome, WikiPathways. KEGG membership is kept in the local-only file kegg.local.jsonl.gz (licence)")
    hist = collections.Counter(len(ss & set(SRC4)) for ss in members.values())
    hist3 = collections.Counter(len(ss & set(SRC3)) for ss in members.values())
    concord[name] = (members, hist, hist3)

# ---------------------------------------------------------------- signalling edges (Pathway Commons SIF, human, borrowed)
KEYGENES = set()
for name, (members, hist, hist3) in concord.items(): KEYGENES |= set(members)
EDGE_T = {"controls-state-change-of", "controls-expression-of", "controls-phosphorylation-of", "in-complex-with"}
z2hs = collections.defaultdict(set)
for s, zs in hs2z.items():
    for z in zs: z2hs[z].add(s)
key_hs = set().union(*[z2hs[z] for z in KEYGENES])
edges = collections.defaultdict(set)
n_edge_rows = 0
for line in zopen("pc-hgnc.sif.gz"):
    a, t, b = line.rstrip("\n").split("\t")[:3]
    if t not in EDGE_T or a not in key_hs or b not in key_hs or a == b: continue
    edges[(a, t)].add(b)
for (a, t), bs in edges.items():
    for z in hs2z.get(a, set()) & KEYGENES:
        partners = sorted(bs)
        partner_z = sorted({zsym.get(x, x) for b in partners for x in hs2z.get(b, ()) if x in KEYGENES})
        add(z, "signalling_edge", {"type": t, "human_source": a, "human_targets": partners[:60], "n_targets": len(partners),
                                   "zebrafish_target_symbols": partner_z[:60]},
            {"db": "Pathway Commons v14 (SIF)", "release_or_date": "PC v14 (2024-05-21)", "url": CALL["pathwaycommons_v14_sif"]["url"],
             "accession": None, "licence": LIC["PC"]}, "borrowed-ortholog", "SIF " + t, species="Homo sapiens",
            note="Human interaction from Pathway Commons, restricted to genes in the key signalling pathways; transferred through ZFIN orthology")
        n_edge_rows += 1

# ---------------------------------------------------------------- crosswalk: name + Jaccard across sources
def toks(s):
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("signalling", "signaling"))
    return {t for t in s.split() if t not in {"of", "the", "and", "by", "in", "pathway", "signaling", "to", "a", "via", "danio", "rerio", "zebrafish"}}
ALL = {"KEGG": (K_SETS, k_name), "Reactome": (R_SETS, r_name), "WikiPathways": (W_SETS, w_name), "PathwayCommons": (P_SETS, p_name)}
GOSETS = {g: s for g, s in GO_BP_SETS.items() if gons.get(g) == "biological_process" and 5 <= len(s) <= 1500 and g not in obsolete}
ALL["GO"] = (GOSETS, goname)
inv = {src: collections.defaultdict(list) for src in ALL}
for src, (S, _) in ALL.items():
    for p, zs in S.items():
        if len(zs) < 3: continue
        for z in zs: inv[src][z].append(p)
def best(src_from, p, k=3):
    S, N = ALL[src_from]; a = S[p]; out = {}
    for tgt, (T, TN) in ALL.items():
        if tgt == src_from: continue
        cnt = collections.Counter()
        for z in a:
            for q in inv[tgt].get(z, ()): cnt[q] += 1
        sc = []
        for q, i in cnt.items():
            j = i / (len(a) + len(T[q]) - i)
            nt = toks(N.get(p, p)); qt = toks(TN.get(q, q))
            nj = len(nt & qt) / len(nt | qt) if nt | qt else 0
            sc.append((j, nj, q, i))
        sc.sort(key=lambda x: (-x[0], -x[1]))
        out[tgt] = [{"id": q, "name": TN.get(q, q), "jaccard": round(j, 3), "name_overlap": round(nj, 2), "shared_genes": i, "size": len(T[q])} for j, nj, q, i in sc[:k] if j >= 0.05]
    return out

key_table = []
for name, (sel, sets) in KEYSETS.items():
    members, hist, hist3 = concord[name]
    prim = {}
    for s in ["GO", "KEGG", "Reactome", "WikiPathways", "PathwayCommons"]:
        ids = sel[s]
        prim[s] = [{"id": i, "name": ALL[s][1].get(i, goname.get(i, i)), "genome_genes": len((GO_BP_SETS if s == "GO" else ALL[s][0]).get(i, ())),
                    "universe_genes": len((GO_BP_SETS if s == "GO" else ALL[s][0]).get(i, set()) & UNI.keys())} for i in ids[:25]]
    pair = {}
    srcs = ["GO", "KEGG", "Reactome", "WikiPathways", "PathwayCommons"]
    for i, a in enumerate(srcs):
        for b in srcs[i + 1:]:
            A, B = sets[a], sets[b]
            if A and B: pair[f"{a}~{b}"] = {"jaccard_genome": round(len(A & B) / len(A | B), 3), "shared_genome": len(A & B), "jaccard_universe": round(len(A & B & UNI.keys()) / max(1, len((A | B) & UNI.keys())), 3)}
    sym = lambda zs: sorted(UNI[z]["symbol"] for z in zs)
    in_all4 = [z for z, ss in members.items() if len(ss & set(SRC4)) == 4]
    key_table.append({"pathway": name, "selected": prim, "genome_set_sizes": {s: len(sets[s]) for s in sets},
                      "universe_set_sizes": {s: len(sets[s] & UNI.keys()) for s in sets},
                      "universe_genes_by_number_of_core_sources_with_kegg": {str(k): hist.get(k, 0) for k in range(5)},
                      "universe_genes_by_number_of_core_sources_without_kegg": {str(k): hist3.get(k, 0) for k in range(4)},
                      "core_sources": SRC4,
                      "n_genes_in_all_4_with_kegg": len(in_all4),
                      "genes_in_all_3_without_kegg": sym([z for z, ss in members.items() if len(ss & set(SRC3)) == 3]),
                      "genes_only_in_1_by_source_with_kegg": {s: len([z for z, ss in members.items() if ss & set(SRC4) == {s}]) for s in SRC4},
                      "genes_only_in_1_by_source_without_kegg": {s: len([z for z, ss in members.items() if ss & set(SRC3) == {s}]) for s in SRC3},
                      "pairwise_jaccard": pair,
                      "go_experimental_members_in_universe": len(sets["GO_experimental"] & UNI.keys())})

xw = []
for src in ["KEGG", "WikiPathways"]:
    for p in sorted(ALL[src][0]):
        if len(ALL[src][0][p]) < 3: continue
        xw.append({"source": src, "id": p, "name": ALL[src][1].get(p, p), "size": len(ALL[src][0][p]), "best_matches": best(src, p)})
r_x = [p for p in r_top] + [p for p in r_name if p not in r_top and 10 <= len(R_SETS.get(p, ())) and any(q in r_top for q in r_parent.get(p, ()))]
for p in sorted(set(r_x)):
    if len(R_SETS.get(p, ())) < 3: continue
    xw.append({"source": "Reactome", "id": p, "name": r_name[p], "size": len(R_SETS[p]), "top_level": p in r_top, "best_matches": best("Reactome", p)})
# mutual best (KEGG <-> Reactome, KEGG <-> WP, Reactome <-> WP) on Jaccard
mutual = []
bestmap = {(e["source"], e["id"]): e["best_matches"] for e in xw}
for e in xw:
    for tgt, ms in e["best_matches"].items():
        if not ms or tgt not in ("KEGG", "Reactome", "WikiPathways"): continue
        q = ms[0]["id"]; back = bestmap.get((tgt, q))
        if back and back.get(e["source"]) and back[e["source"]][0]["id"] == e["id"] and (e["source"], e["id"]) < (tgt, q):
            mutual.append({"a": f"{e['source']}:{e['id']} {e['name']}", "b": f"{tgt}:{q} {ms[0]['name']}", "jaccard": ms[0]["jaccard"], "name_overlap": ms[0]["name_overlap"]})
mutual.sort(key=lambda m: -m["jaccard"])

# ---------------------------------------------------------------- write
if any(re.search(r"\b(aves|gallus|chicken|bird)\b", json.dumps(r["gene"]) + r["species"], re.I) for r in rows): sys.exit("bird data found")
# KEGG rows: academic-use-only data, not redistributable -> local-only file (gitignored: omics/**/*.local.jsonl.gz)
kegg_rows = [r for r in rows if r["source"]["db"] == "KEGG"]
rows = [r for r in rows if r["source"]["db"] != "KEGG"]
for fn, rs in (("annotations.jsonl.gz", rows), ("kegg.local.jsonl.gz", kegg_rows)):
    with gzip.open(os.path.join(HERE, fn), "wt", encoding="utf-8", compresslevel=9) as f:
        for r in rs: f.write(json.dumps(r, separators=(",", ":"), ensure_ascii=False) + "\n")
kegg_genes = {r["gene"]["zfin_id"] for r in kegg_rows if r["feature"] == "pathway_member"}
by_source = collections.defaultdict(lambda: {"rows": 0, "genes": set()}); by_feature = collections.Counter(); by_kind = collections.Counter()
genes_any = set()
for r in rows:
    b = by_source[r["source"]["db"]]; b["rows"] += 1; b["genes"].add(r["gene"]["zfin_id"]); by_feature[r["feature"]] += 1; by_kind[r["kind"]] += 1
    genes_any.add(r["gene"]["zfin_id"])
pw_genes = collections.defaultdict(set)
for r in rows:
    if r["feature"] == "pathway_member": pw_genes[r["source"]["db"].split(" (via")[0] if "via Pathway Commons" not in r["source"]["db"] else "Pathway Commons"].add(r["gene"]["zfin_id"])
gocov = {a: len({r["gene"]["zfin_id"] for r in rows if r["feature"] == a}) for a in ASPECT.values()}
n_pw_sources = collections.Counter()
n_pw_sources3 = collections.Counter()
go_bp_genes = {r["gene"]["zfin_id"] for r in rows if r["feature"] == "go_process"}
for z in UNI:
    n_pw_sources[len({k for k in ("Reactome", "WikiPathways") if z in pw_genes[k]}) + (z in go_bp_genes) + (z in kegg_genes)] += 1
    n_pw_sources3[len({k for k in ("Reactome", "WikiPathways") if z in pw_genes[k]}) + (z in go_bp_genes)] += 1

cross = {"title": "Pathway crosswalk and concordance for the DELPHI zebrafish gene universe",
         "built": NOW, "tool": "omics/pathway/scripts/build.py",
         "gene_universe": {"file": "omics/genes.json", "genes": len(UNI),
                           "caveat": "The universe was drawn from genes that already had a pathway in genotype/pathways.json (GO BP, Reactome or KEGG), so pathway coverage of it is high by construction."},
         "method": {"key_pathways": "Per source, a gene is a member if it is in any selected pathway (Reactome: all-levels file, so members of sub-pathways count; GO: annotated, NOT dropped, to the root term or any descendant via is_a, part_of or (positively/negatively) regulates). Core sources: GO, Reactome, KEGG, WikiPathways. Pathway Commons (PID/PANTHER/NetPath/INOH, human, through ZFIN orthology) is a fifth, borrowed, source reported separately.",
                    "crosswalk": "Gene sets over all ZFIN genes (not just the universe). For each KEGG, WikiPathways and Reactome (top-level and their direct children with >=10 genes) pathway, the top 3 matches in every other source by Jaccard (ties broken by name-token overlap), J >= 0.05. 'mutual_best' lists pairs that are each other's best Jaccard match.",
                    "independence_caveat": "These sources are not independent. Reactome dre is wholly inferred from human; KEGG assigns genes to reference maps by orthology; 43 of 55 zebrafish WikiPathways are HomologyConvert-ed from human; GO IBA rows are phylogenetic transfers. Agreement among orthology-derived sources partly reflects shared human ancestry of the annotation, not separate zebrafish evidence. GO experimental membership is given separately."},
         "wikipathways_provenance": w_prov,
         "key_pathways": key_table,
         "mutual_best": mutual,
         "crosswalk": xw,
         "kegg_note": "KEGG appears here only as pathway IDs, names and gene counts / Jaccard overlaps. KEGG gene-level rows are local-only (kegg.local.jsonl.gz) because KEGG data are academic-use only and not redistributable."}
nhc = sum(1 for v in w_prov.values() if v["homology_converted"])
cross["method"]["independence_caveat"] = cross["method"]["independence_caveat"].replace("43 of 55", f"{nhc} of {len(w_prov)}")
json.dump(cross, open(os.path.join(HERE, "pathway-crosswalk.json"), "w"), indent=1)

def fh(p): b = open(p, "rb").read(); return {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
man = {"layer": "pathway", "built": NOW, "rows": len(rows), "genes_covered": len(genes_any & UNI.keys()), "universe": len(UNI),
       "by_source": {k: {"rows": v["rows"], "genes": len(v["genes"])} for k, v in sorted(by_source.items())},
       "by_feature": dict(by_feature), "by_kind": dict(by_kind),
       "coverage": {"go_process": gocov["go_process"], "go_function": gocov["go_function"], "go_component": gocov["go_component"],
                    "pathway_member_by_source": {k: len(v) for k, v in pw_genes.items()},
                    "universe_genes_by_number_of_core_sources_any_pathway_with_kegg": {str(k): n_pw_sources.get(k, 0) for k in range(5)},
                    "universe_genes_by_number_of_core_sources_any_pathway_without_kegg": {str(k): n_pw_sources3.get(k, 0) for k in range(4)},
                    "go_rows_by_evidence_class": {db: dict(c) for db, c in go_counts.items()},
                    "go_rows_dropped": dict(go_dropped),
                    "unmapped_source_genes": {"Reactome ENSDARG without ZFIN 1:1": len(r_unmapped), "KEGG NCBI GeneID without ZFIN gene": len(k_unmapped), "WikiPathways NCBI GeneID without ZFIN gene": len(w_unmapped)},
                    "signalling_edge_rows": n_edge_rows},
       "key_pathway_concordance_with_kegg": {k["pathway"]: k["universe_genes_by_number_of_core_sources_with_kegg"] for k in key_table},
       "key_pathway_concordance_without_kegg": {k["pathway"]: k["universe_genes_by_number_of_core_sources_without_kegg"] for k in key_table},
       "kegg_local_only": {"file": "omics/pathway/kegg.local.jsonl.gz", "rows": len(kegg_rows), "genes": len({r["gene"]["zfin_id"] for r in kegg_rows}),
                           "pathway_member_genes": len(kegg_genes), "key_pathway_member_rows": sum(1 for r in kegg_rows if r["feature"] == "key_pathway_member"),
                           "pathways_referenced": {p: k_name.get(p, p) for p in sorted(K_SETS)},
                           "note": "KEGG gene-to-pathway data are free for academic use only and not redistributable, so the KEGG rows are kept out of the public annotations.jsonl.gz and the deployed bundle (gitignored: omics/**/*.local.jsonl.gz). Rebuild them locally with scripts/fetch.py + scripts/build.py. Only counts and KEGG pathway IDs/names are published.",
                           "sha256": hashlib.sha256(open(os.path.join(HERE, "kegg.local.jsonl.gz"), "rb").read()).hexdigest()},
       "files": {n: fh(os.path.join(HERE, n)) for n in ["annotations.jsonl.gz", "pathway-crosswalk.json", "SOURCES.md", "calls.json", "scripts/fetch.py", "scripts/build.py"] if os.path.exists(os.path.join(HERE, n))},
       "retrievals": [{"url": c["url"], "date": c["retrieved"], "sha256": c.get("sha256"), "call": c["call"]} for c in calls if c.get("status") == 200 and c["call"] != "wikipathways_gpml"]
                     + [{"url": "https://www.wikipathways.org/wikipathways-assets/pathways/{WP}/{WP}.gpml", "date": min(c["retrieved"] for c in calls if c["call"] == "wikipathways_gpml"), "n_calls": sum(1 for c in calls if c["call"] == "wikipathways_gpml"), "call": "wikipathways_gpml (sha256 per call in calls.json)"}],
       "call_log": "omics/pathway/calls.json",
       "status": "done"}
json.dump(man, open(os.path.join(HERE, "MANIFEST.json"), "w"), indent=1)
print(json.dumps({k: man[k] for k in ["rows", "genes_covered", "by_source", "by_feature", "by_kind", "coverage", "key_pathway_concordance_with_kegg", "key_pathway_concordance_without_kegg"]}, indent=1))
print("annotations bytes", man["files"]["annotations.jsonl.gz"]["bytes"])
for k in key_table: print(k["pathway"], {s: [x["id"] for x in v] for s, v in k["selected"].items()}, k["universe_set_sizes"], k["pairwise_jaccard"])
print("mutual best top:", json.dumps(mutual[:30], indent=0))
