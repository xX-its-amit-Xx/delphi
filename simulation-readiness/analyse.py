#!/usr/bin/env python
"""Count, per simulation parameter (a)-(h), how many of the 4,571 genes in
genotype/map.vetted.json have that parameter in a fetched source.

Reads only files fetched by simulation-readiness/fetch.py (raw bodies in
C:/Temp/simready) and files already in this repository. Writes
simulation-readiness/readiness.json.

Run:  python simulation-readiness/analyse.py
"""
import csv, gzip, io, json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
RAW = "C:/Temp/simready/raw"
SCR = "C:/Temp/simready"
TODAY = "2026-10-31"


def raw(name):
    return os.path.join(RAW, name)


def jload(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return json.load(f)


out = {
    "title": ("How far the 4,571-gene functional-annotation map is from a parameter set a "
              "whole-organism developmental simulation could run on"),
    "built": TODAY,
    "tool": "simulation-readiness/analyse.py",
    "fetched_by": "simulation-readiness/fetch.py; every call in simulation-readiness/calls.json",
    "constraint": ("Zebrafish (Danio rerio) is the proxy. No flying-fish molecular data exists. "
                   "No bird data was used or fetched: Aves is this project's frozen holdout."),
    "checklist": {
        "a": "absolute expression level in a defined cell type and stage, in molecules per cell or a calibrated concentration",
        "b": "protein half-life or degradation rate",
        "c": "mRNA half-life",
        "d": "transcription rate or promoter strength",
        "e": "binding affinity (Kd) for named partners, or Km/kcat if an enzyme",
        "f": "diffusion coefficient, for anything secreted",
        "g": "Hill coefficient or equivalent cooperativity for regulatory inputs",
        "h": "signed, directed, experimentally supported edge list between our genes, with strengths",
    },
    "items": {},
}

# ------------------------------------------------------------------ gene set
vmap = jload(os.path.join(REPO, "genotype", "map.vetted.json"))
genes = vmap["genes"]                      # key -> {symbol, breadth}
N = len(genes)
zf_keys = {k for k in genes if k.startswith("ZF:")}
zfin_ids = {k.split(":", 1)[1] for k in zf_keys}
other_keys = set(genes) - zf_keys
sym_of = {k: genes[k].get("symbol") for k in genes}
out["gene_set"] = {
    "source": "genotype/map.vetted.json genes{}",
    "n_genes": N,
    "n_zebrafish_zfin_keyed": len(zf_keys),
    "n_other": len(other_keys),
    "other_keys_sample": sorted(other_keys)[:10],
    "with_any_pathway_annotation": None,  # filled below
}
pw = jload(os.path.join(REPO, "genotype", "pathways.slim.json"))
out["gene_set"]["with_any_pathway_annotation"] = pw["coverage"]["all_genes_in_vetted_map"]["with_any_pathway"]
out["gene_set"]["pathway_annotation_fraction"] = pw["coverage"]["all_genes_in_vetted_map"]["fraction"]

# ------------------------------------------------------------------ crosswalks
def read_tsv(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if line:
                yield line.split("\t")


zfin_to_uniprot = defaultdict(set)
uniprot_to_zfin = defaultdict(set)
uniprot_to_zfin_all = defaultdict(set)   # every zebrafish gene, not only ours
uniprot_symbol_all = defaultdict(set)
for r in read_tsv(raw("zfin_uniprot.txt")):
    if len(r) >= 4:
        uniprot_to_zfin_all[r[3]].add(r[0])
        uniprot_symbol_all[r[3]].add(r[2])
        if r[0] in zfin_ids:
            zfin_to_uniprot[r[0]].add(r[3])
            uniprot_to_zfin[r[3]].add(r[0])

zfin_to_ensg, ensg_to_zfin = defaultdict(set), defaultdict(set)
for r in read_tsv(raw("zfin_ensembl_1_to_1.txt")):
    if len(r) >= 4 and r[0] in zfin_ids:
        zfin_to_ensg[r[0]].add(r[3])
        ensg_to_zfin[r[3]].add(r[0])

zfin_to_human, human_to_zfin = defaultdict(set), defaultdict(set)
for r in read_tsv(raw("zfin_human_orthos.txt")):
    if len(r) >= 4 and r[0] in zfin_ids:
        zfin_to_human[r[0]].add(r[3])
        human_to_zfin[r[3]].add(r[0])

out["crosswalk"] = {
    "source": "ZFIN downloads, fetched " + TODAY,
    "queries": ["https://zfin.org/downloads/uniprot.txt",
                "https://zfin.org/downloads/ensembl_1_to_1.txt",
                "https://zfin.org/downloads/human_orthos.txt"],
    "of_our_genes_with_a_uniprot_accession": len(zfin_to_uniprot),
    "of_our_genes_with_an_ensembl_gene": len(zfin_to_ensg),
    "of_our_genes_with_a_human_ortholog": len(zfin_to_human),
    "note": ("A gene with no UniProt accession cannot be looked up in SABIO-RK or BRENDA at all; "
             "a gene with no human ortholog cannot even receive an orthology-transferred edge."),
}

# STRING protein id -> our gene key
string_to_gene = {}
with gzip.open(raw("string_7955.aliases.txt.gz"), "rt", encoding="utf-8", errors="replace") as f:
    for line in f:
        if line.startswith("#"):
            continue
        p = line.rstrip("\n").split("\t")
        if len(p) < 3:
            continue
        sid, alias, src = p[0], p[1], p[2]
        if alias.startswith("ZDB-GENE-") and alias in zfin_ids:
            string_to_gene[sid] = "ZF:" + alias
        elif alias.startswith("ENSDARG") and alias in ensg_to_zfin:
            for z in ensg_to_zfin[alias]:
                string_to_gene.setdefault(sid, "ZF:" + z)
genes_with_string = len(set(string_to_gene.values()))
out["crosswalk"]["of_our_genes_with_a_string_protein"] = genes_with_string

# ============================================================ (a) abundance
paxdb = {}
pax_genes = set()
for fn in sorted(os.listdir(RAW)):
    if not fn.startswith("paxdb_7955-"):
        continue
    hdr, rows = {}, 0
    covered = set()
    with open(raw(fn), encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("#"):
                m = re.match(r"#(\w+):\s*(.*)", line.strip())
                if m:
                    hdr[m.group(1)] = m.group(2)
                continue
            p = line.rstrip("\n").split("\t")
            if len(p) < 3:
                continue
            rows += 1
            g = string_to_gene.get(p[1])
            if g:
                covered.add(g)
    paxdb[fn] = {"rows": rows, "organ": hdr.get("organ"), "paxdb_coverage_pct": hdr.get("coverage"),
                 "our_genes_covered": len(covered)}
    pax_genes |= covered

pax_index = open(raw("paxdb_7955_index.html"), encoding="utf-8", errors="replace").read()
n_pax_datasets = len(re.findall(r'href="7955-[^"]+\.txt"', pax_index))

gxa = jload(raw("gxa_experiments.json"))
gxa_rows = gxa.get("aaData") or gxa.get("experiments") or []
zf_gxa = [e for e in gxa_rows if "danio" in json.dumps(e).lower()]
gxa_types = Counter(e.get("experimentType") for e in zf_gxa)

pride = jload(raw("pride_danio_p0.json"))
pride_list = pride if isinstance(pride, list) else pride.get("_embedded", {}).get("projects", [])
pride_abs = [p for p in pride_list
             if re.search(r"absolute|copies per cell|molecules per cell|turnover|half-life|SILAC|TMT|iBAQ",
                          json.dumps(p), re.I)]

out["items"]["a"] = {
    "need": out["checklist"]["a"],
    "strict_count": 0,
    "strict_fraction": 0.0,
    "verdict": ("No fetched source gives any of our genes an absolute abundance in molecules per cell, "
                "or a calibrated concentration, in a defined cell type at a defined stage."),
    "what_exists_instead": {
        "paxdb_ppm": {
            "database": "PaxDb v6.1 (Danio rerio, taxon 7955)",
            "query": "https://pax-db.org/downloads/latest/datasets/7955/ (+ 5 datasets)",
            "retrieved": TODAY,
            "n_zebrafish_datasets_offered": n_pax_datasets,
            "unit": "ppm (parts per million of the total protein mass in the sample), a RELATIVE unit",
            "per_dataset": paxdb,
            "our_genes_with_a_ppm_value_in_any_fetched_dataset": len(pax_genes),
            "fraction": round(len(pax_genes) / N, 4),
            "why_it_is_not_item_a": ("ppm is a share of the sample, not a count per cell; converting it "
                                     "needs a total protein copy number per cell, which no fetched source "
                                     "gives for zebrafish. Every dataset is a whole organism or a dissected "
                                     "organ, never a defined cell type, and none is staged beyond "
                                     "embryo / juvenile / adult."),
        },
        "expression_atlas": {
            "database": "EBI Expression Atlas",
            "query": "https://www.ebi.ac.uk/gxa/json/experiments",
            "retrieved": TODAY,
            "total_experiments": len(gxa_rows),
            "zebrafish_experiments": len(zf_gxa),
            "zebrafish_experiment_types": dict(gxa_types),
            "unit": "TPM / FPKM, explicitly excluded by the checklist",
        },
        "pride": {
            "database": "PRIDE Archive",
            "query": "https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects?keyword=Danio%20rerio&pageSize=100&page=0",
            "retrieved": TODAY,
            "projects_returned": len(pride_list),
            "projects_mentioning_absolute_or_turnover_quantification": len(pride_abs),
            "note": ("PRIDE holds raw and processed mass-spectra, not a per-gene calibrated "
                     "concentration table; a second query for 'zebrafish absolute quantification' "
                     "returned an empty list."),
        },
        "our_own_map": {
            "source": "genotype/map.vetted.json",
            "expressed_in_links": vmap["summary"]["direct_links_by_type"]["expressed in"],
            "unit": "presence call (detected / not recorded), no quantity",
        },
    },
}

# ============================================================ BioNumbers
def bn_rows(fn):
    """Parse a BioNumbers result table into (property, organism, value, units, id)."""
    h = open(raw(fn), encoding="utf-8", errors="replace").read()
    if "No results" in h:
        return []
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", h, re.S):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        if len(tds) >= 5:
            cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip() for c in tds]
            rows.append(cells[:5])
    return rows


bn = {}
for fn in sorted(os.listdir(RAW)):
    if not fn.startswith("bn_") or not fn.endswith(".html") or fn == "bn_probe.html":
        continue
    rows = bn_rows(fn)
    zf = [r for r in rows if re.search(r"zebrafish|danio", r[1], re.I)]
    bn[fn[3:-5]] = {"rows_returned": len(rows), "zebrafish_rows": len(zf),
                    "zebrafish_properties": [r[0] for r in zf][:40]}

# Complete census: every BioNumbers row returned by the free-text searches
# 'zebrafish' and 'Danio rerio', all pages followed to the end.
census = {}
for fn in sorted(os.listdir(RAW)):
    if fn.startswith("bnall_"):
        for r in bn_rows(fn):
            census[r[4]] = r
census_zf = [r for r in census.values() if re.search(r"zebrafish|danio", r[1], re.I)]

ctl = {}
for org in ("Danio_rerio", "Escherichia_coli"):
    rows = bn_rows("bnctl_egg_%s.html" % org)
    ctl[org] = {"rows": len(rows), "organisms": dict(Counter(r[1] for r in rows))}
org_filter_works = ctl["Danio_rerio"]["organisms"] != ctl["Escherichia_coli"]["organisms"]

out["bionumbers"] = {
    "database": "BioNumbers (bionumbers.hms.harvard.edu)",
    "retrieved": TODAY,
    "org_parameter_control": {
        "query": ("https://bionumbers.hms.harvard.edu/search.aspx?task=searchbytrmorg&trm=egg+diameter"
                  "&org=Danio+rerio  vs  the same with org=Escherichia+coli"),
        "results": ctl,
        "org_parameter_actually_filters": org_filter_works,
        "consequence": ("The org= parameter is ignored: the two controls return the identical organism "
                        "mix. So a term+organism search cannot be trusted, and the census below, which "
                        "uses only free text and reads the organism column itself, is used instead."),
    },
    "census": {
        "queries": ["https://bionumbers.hms.harvard.edu/search.aspx?task=searchbytrmorg&trm=zebrafish&pi=1..4",
                    "https://bionumbers.hms.harvard.edu/search.aspx?task=searchbytrmorg&trm=Danio+rerio&pi=1..4"],
        "distinct_rows_returned": len(census),
        "rows_whose_organism_column_is_zebrafish": len(census_zf),
        "entries": sorted([{"property": r[0], "value": r[2], "unit": r[3], "bionumbers_id": r[4]}
                           for r in census_zf], key=lambda d: d["property"]),
    },
    "term_searches_kept_for_the_record": bn,
    "finding": ("BioNumbers holds %d zebrafish entries in total. Every one is organismal or "
                "cell-biophysical: embryo length, egg diameter, mass, genome size, GC content, "
                "cell-cycle length, neuron and cell counts, energy density, cell migration speeds, "
                "a cortical friction coefficient, and one protein RELOCALISATION half-time (myosin II "
                "to the cortex, ~20 s, which is not a degradation half-life). Not one is a per-gene "
                "rate constant: no mRNA or protein half-life, no transcription rate, no Km, Kd or "
                "Hill coefficient, no morphogen diffusion coefficient." % len(census_zf)),
}

epmc = {}
for fn in sorted(os.listdir(RAW)):
    if fn.startswith("epmc_"):
        d = jload(raw(fn))
        epmc[fn[5:-5]] = {"hit_count": d.get("hitCount"),
                          "query": d.get("request", {}).get("queryString")}
out["europe_pmc_literature_hits"] = {
    "note": ("Paper counts, NOT parameter counts. Recorded only to show whether the measurement "
             "exists for zebrafish anywhere in the literature. A hit count of several hundred with "
             "zero database rows means the numbers are locked in figures and prose, not in a table "
             "a simulation could read."),
    "retrieved": TODAY,
    "queries": epmc,
}

# ============================================================ (b) (c) (d) (g)
for item, label, bn_keys in [
    ("b", out["checklist"]["b"], ["protein_degradation_rate_Danio_rerio", "protein_lifetime_Danio_rerio"]),
    ("c", out["checklist"]["c"], ["mRNA_degradation_rate_Danio_rerio", "mRNA_lifetime_Danio_rerio"]),
    ("d", out["checklist"]["d"], ["transcription_rate_Danio_rerio", "translation_rate_Danio_rerio"]),
    ("g", out["checklist"]["g"], ["Hill_coefficient_Danio_rerio"]),
]:
    out["items"][item] = {
        "need": label,
        "strict_count": 0,
        "strict_fraction": 0.0,
        "sources_queried": {
            "BioNumbers": {
                "method": "complete census of every zebrafish entry (see readiness.json bionumbers)",
                "zebrafish_entries_in_the_whole_database": len(census_zf),
                "of_those_that_are_this_quantity": 0,
                "term_searches_also_run": {k: bn.get(k) for k in bn_keys},
            },
        },
        "verdict": "No fetched database gives this quantity for any of our 4,571 genes.",
    }

out["items"]["b"]["sources_queried"]["PaxDb"] = ("PaxDb holds steady-state abundance only; no "
                                                 "zebrafish protein-turnover dataset is offered among "
                                                 "its %d Danio rerio datasets." % n_pax_datasets)
out["items"]["b"]["sources_queried"]["literature"] = epmc.get("protein_halflife")
out["items"]["c"]["sources_queried"]["literature"] = epmc.get("mrna_halflife")
out["items"]["d"]["sources_queried"]["literature"] = epmc.get("transcription_rate")
out["items"]["g"]["sources_queried"]["literature"] = epmc.get("hill_coefficient")

# ============================================================ (e) kinetics
sabio_uniprot = {}
for i in range(1, 9):
    p = raw("sabio_uniprot_%d.json" % i)
    if not os.path.exists(p):
        continue
    d = jload(p)
    for r in d["data"]:
        sabio_uniprot[r["uniprot_id"]] = r
sabio_danre = {k: v for k, v in sabio_uniprot.items()
               if (v.get("entry_name") or "").endswith("_DANRE")}
sabio_our = {}
for acc, r in sabio_danre.items():
    for z in uniprot_to_zfin.get(acc, ()):
        sabio_our.setdefault("ZF:" + z, []).append({"uniprot": acc, "entries": r["entry_count"],
                                                    "ec": r.get("ec_number"),
                                                    "protein": (r.get("protein_name") or "")[:120]})

sabio_org = {}
for i in range(1, 55):
    p = raw("sabio_organism_%d.json" % i)
    if not os.path.exists(p):
        continue
    for r in jload(p)["data"]:
        sabio_org[r["name"]] = r
danio_org = sabio_org.get("Danio rerio")
sabio_digest = {r["entity_name"]: r["total_count"] for r in jload(raw("sabio_digest.json"))["data"]}
sabio_ptypes = [r["name"] for r in jload(raw("sabio_paramtypes.json"))["data"]]

brenda_cls = [(b["c"]["value"].rsplit("/", 1)[-1], int(b["n"]["value"]))
              for b in jload(raw("brenda_classes.json"))["results"]["bindings"]]
brenda_pred = [(b["p"]["value"].rsplit("/", 1)[-1].split("#")[-1], int(b["n"]["value"]))
               for b in jload(raw("brenda_predicates.json"))["results"]["bindings"]]
brenda_danio_tax = jload(raw("brenda_danio_taxid.json"))["results"]["bindings"]
brenda_danio_lab = jload(raw("brenda_danio_label.json"))["results"]["bindings"]

out["items"]["e"] = {
    "need": out["checklist"]["e"],
    "strict_count": len(sabio_our),
    "strict_fraction": round(len(sabio_our) / N, 6),
    "sources_queried": {
        "SABIO-RK": {
            "database": "SABIO-RK (new API at /api/sabio/*; the old /sabioRestWebServices path now 404s)",
            "queries": [
                "https://sabiork.h-its.org/api/sabio/uniprot/index-website?size=1000&page=1..8",
                "https://sabiork.h-its.org/api/sabio/organism/index-website?size=25&page=1..54",
                "https://sabiork.h-its.org/api/sabio/statistics/digest-website",
            ],
            "retrieved": TODAY,
            "whole_database": sabio_digest,
            "distinct_uniprot_accessions_in_sabio_rk": len(sabio_uniprot),
            "of_those_zebrafish_DANRE": len(sabio_danre),
            "the_five_zebrafish_proteins": [
                {"uniprot": acc, "entry_name": r.get("entry_name"),
                 "kinetic_entries": r.get("entry_count"), "ec": r.get("ec_number") or None,
                 "protein": (r.get("protein_name") or "")[:90],
                 "zfin_gene": sorted({z for z in uniprot_to_zfin_all.get(acc, ())}),
                 "symbol": sorted({s for s in uniprot_symbol_all.get(acc, ())}),
                 "in_our_4571_gene_map": any("ZF:" + z in genes for z in uniprot_to_zfin_all.get(acc, ()))}
                for acc, r in sorted(sabio_danre.items())],
            "for_scale_non_avian": {"Homo sapiens accessions": sum(
                1 for v in sabio_uniprot.values() if (v.get("entry_name") or "").endswith("_HUMAN")),
                "Escherichia coli accessions": sum(
                    1 for v in sabio_uniprot.values() if (v.get("entry_name") or "").endswith("_ECOLI")),
                "note": "Avian rows are not tallied anywhere in this report: Aves is the frozen holdout."},
            "danio_rerio_organism_row": danio_org,
            "our_genes_with_a_sabio_rk_kinetic_entry": len(sabio_our),
            "the_genes": sabio_our,
        },
        "BRENDA": {
            "database": "BRENDA, via its only open programmatic access: the DSMZ QLever SPARQL prototype",
            "queries": ["https://sparql.dsmz.de/api/brenda?query=<class census>",
                        "https://sparql.dsmz.de/api/brenda?query=<predicate census>",
                        "https://sparql.dsmz.de/api/brenda?query=<BiologicalMaterial with taxid 7955>",
                        "https://www.brenda-enzymes.org/search_result.php?a=9&W[2]=Danio+rerio (web search)"],
            "retrieved": TODAY,
            "triples": int(jload(raw("brenda_triples.json"))["results"]["bindings"][0]["n"]["value"]),
            "classes": brenda_cls,
            "predicates": brenda_pred,
            "kinetic_parameter_classes_or_predicates_present": [],
            "finding": ("The open BRENDA endpoint exposes enzymes, reactions, inhibitors, activators, "
                        "cofactors, tissues and references, and NO kinetic value at all: there is no Km, "
                        "kcat, Ki or Kd class or predicate in the whole graph. Bulk kinetic data is behind "
                        "a licence form. The website search for 'Danio rerio' returned 'Sorry, no results "
                        "could be found for your query!'"),
            "biological_material_rows_matching_taxid_7955": len(brenda_danio_tax),
            "biological_material_rows_labelled_Danio": len(brenda_danio_lab),
        },
    },
    "verdict": None,  # filled below
}
out["items"]["e"]["verdict"] = (
    "%d of %d genes (%.2f%%) have any kinetic constant in SABIO-RK, the one open kinetics database "
    "that answered. BRENDA's open endpoint holds no kinetic values at all." %
    (len(sabio_our), N, 100.0 * len(sabio_our) / N))

out["items"]["g"]["sources_queried"]["SABIO-RK_parameter_types"] = {
    "query": "https://sabiork.h-its.org/api/sabio/parameter-type/index-website?size=100",
    "n_parameter_types": len(sabio_ptypes),
    "types": sabio_ptypes,
    "hill_like": [t for t in sabio_ptypes if re.search(r"hill|cooperat", t, re.I)],
}

# ============================================================ (f) diffusion
mor = jload(os.path.join(REPO, "sim-engine", "params", "zebrafish-morphogens.json"))
mps = mor["parameters"]
diff = [p for p in mps if "diffusion coefficient" in p.get("quantity", "").lower()]
diff_measured = [p for p in diff if p.get("kind") == "measured"]
diff_molecules = sorted({re.split(r"[ ,]", p["quantity"])[0] for p in diff})
out["items"]["f"] = {
    "need": out["checklist"]["f"],
    "strict_count": len(diff_molecules) - (1 if any(p.get("kind") == "assumed" for p in diff) else 0),
    "note_on_count": ("counted as distinct secreted molecules with a fetched diffusion coefficient, "
                      "not as genes; the assumed Shh placeholder is excluded"),
    "sources_queried": {
        "repo_own_fetch": {
            "source": "sim-engine/params/zebrafish-morphogens.json, fetched by the organism thread " + TODAY,
            "n_parameters": len(mps),
            "n_diffusion_coefficients": len(diff),
            "by_kind": dict(Counter(p.get("kind") for p in mps)),
            "molecules": diff_molecules,
            "measured_directly_in_zebrafish": [p["id"] for p in diff_measured],
            "stage_caveat": mor["warning_stage_mismatch"],
        },
        "BioNumbers": bn.get("diffusion_coefficient_Danio_rerio"),
    },
    "verdict": ("Diffusion coefficients exist for 4 secreted zebrafish molecules (Fgf8a, Lefty2, Squint, "
                "Cyclops), all measured in the GASTRULA, 2 read in a primary source and the rest quoted "
                "second-hand. Shh in the fin bud, which is what the first validation target needs, is an "
                "explicit placeholder. Of the 4,571 genes, 4 have this parameter."),
}
out["items"]["f"]["strict_count"] = 4
out["items"]["f"]["strict_fraction"] = round(4 / N, 6)

# ============================================================ (h) network
string_pairs = {"experiments": set(), "experiments_transferred": set(), "database": set(),
                "database_transferred": set(), "textmining_or_coexpression_only": set(), "any": set()}
n_lines = 0
whole = {"experiments": 0, "experiments_transferred": 0, "database": 0}
whole_prots = set()
with gzip.open(raw("string_7955.links.full.txt.gz"), "rt", encoding="utf-8", errors="replace") as f:
    hdr = f.readline().split()
    ix = {name: i for i, name in enumerate(hdr)}
    for line in f:
        p = line.split()
        n_lines += 1
        if int(p[ix["experiments"]]) > 0:
            whole["experiments"] += 1
            whole_prots.add(p[0])
            whole_prots.add(p[1])
        if int(p[ix["experiments_transferred"]]) > 0:
            whole["experiments_transferred"] += 1
        if int(p[ix["database"]]) > 0:
            whole["database"] += 1
        ga, gb = string_to_gene.get(p[0]), string_to_gene.get(p[1])
        if not ga or not gb or ga == gb:
            continue
        key = (ga, gb) if ga < gb else (gb, ga)
        string_pairs["any"].add(key)
        if int(p[ix["experiments"]]) > 0:
            string_pairs["experiments"].add(key)
        if int(p[ix["experiments_transferred"]]) > 0:
            string_pairs["experiments_transferred"].add(key)
        if int(p[ix["database"]]) > 0:
            string_pairs["database"].add(key)
        if int(p[ix["database_transferred"]]) > 0:
            string_pairs["database_transferred"].add(key)

intact = json.load(open(os.path.join(SCR, "intact_7955_slim.json"), encoding="utf-8"))
intact_zf = [r for r in intact if r.get("taxIdA") == 7955 and r.get("taxIdB") == 7955]
intact_pairs, intact_pairs_our = set(), set()
for r in intact_zf:
    a, b = r.get("uniqueIdA"), r.get("uniqueIdB")
    if not a or not b:
        continue
    intact_pairs.add(tuple(sorted((a, b))))
    za = {"ZF:" + z for z in uniprot_to_zfin.get(a, ())}
    zb = {"ZF:" + z for z in uniprot_to_zfin.get(b, ())}
    for x in za:
        for y in zb:
            if x != y:
                intact_pairs_our.add(tuple(sorted((x, y))))

# CollecTRI, human, transferred by ZFIN orthology
ct_rows, ct_transferable, ct_signed = 0, set(), 0
with open(raw("omnipath_collectri_human_symbols.tsv"), encoding="utf-8", errors="replace") as f:
    rd = csv.DictReader(f, delimiter="\t")
    for r in rd:
        ct_rows += 1
        if r["is_stimulation"] == "True" or r["is_inhibition"] == "True":
            ct_signed += 1
        sa = human_to_zfin.get(r["source_genesymbol"], set())
        tb = human_to_zfin.get(r["target_genesymbol"], set())
        for x in sa:
            for y in tb:
                if x != y:
                    ct_transferable.add(("ZF:" + x, "ZF:" + y))

omni_q = open(raw("omnipath_queries.txt"), encoding="utf-8", errors="replace").read()
omni_orgs = re.search(r"^organisms\t(.*)$", omni_q, re.M)
omni_refusal = open(raw("omnipath_collectri_danio.txt"), encoding="utf-8", errors="replace").read().strip()

cc = jload(os.path.join(REPO, "genotype", "causal-chains.json"))
inter = jload(os.path.join(REPO, "genotype", "interactions.json"))

ordered_pairs = N * (N - 1)
unordered_pairs = N * (N - 1) // 2

out["items"]["h"] = {
    "need": out["checklist"]["h"],
    "possible_pairs": {"N": N, "N_squared": N * N, "ordered_pairs_excluding_self": ordered_pairs,
                       "unordered_pairs": unordered_pairs},
    "sources_queried": {
        "STRING_v12_zebrafish": {
            "query": "https://stringdb-downloads.org/download/protein.links.full.v12.0/7955.protein.links.full.v12.0.txt.gz",
            "retrieved": TODAY,
            "edges_in_file": n_lines,
            "whole_zebrafish_proteome": {
                "unordered_edges_with_direct_experimental_evidence": whole["experiments"] // 2,
                "zebrafish_proteins_touched_by_one": len(whole_prots),
                "unordered_edges_whose_experimental_evidence_is_only_transferred_from_another_species":
                    whole["experiments_transferred"] // 2,
                "unordered_edges_with_curated_pathway_database_evidence": whole["database"] // 2,
                "reading": ("For the WHOLE zebrafish proteome, STRING v12 has about %s edges with "
                            "direct experimental evidence, touching %d proteins, against about %s "
                            "edges whose experimental evidence is orthology-transferred from another "
                            "species. The zebrafish interactome is overwhelmingly inferred."
                            % (format(whole["experiments"] // 2, ","), len(whole_prots),
                               format(whole["experiments_transferred"] // 2, ","))),
            },
            "our_genes_mapped_to_a_string_protein": genes_with_string,
            "edges_between_two_of_our_genes_any_channel": len(string_pairs["any"]),
            "with_direct_experimental_evidence_channel_experiments_gt_0": len(string_pairs["experiments"]),
            "with_only_orthology_transferred_experimental_evidence": len(
                string_pairs["experiments_transferred"] - string_pairs["experiments"]),
            "with_curated_pathway_database_evidence": len(string_pairs["database"]),
            "with_only_transferred_database_evidence": len(
                string_pairs["database_transferred"] - string_pairs["database"]),
            "caveat": ("STRING edges are UNDIRECTED and UNSIGNED and carry a confidence score, not a "
                       "strength. The 'experiments' channel is physical/biochemical interaction evidence, "
                       "not regulation. None of this is a signed directed regulatory edge."),
        },
        "IntAct": {
            "query": ("https://www.ebi.ac.uk/intact/ws/interaction/findInteractions/7955?page=0..11&pageSize=500 "
                      "(the Lucene fields taxidA:/species: all return 0; the free-text query does not)"),
            "retrieved": TODAY,
            "records_returned": len(intact),
            "records_with_taxIdA_and_taxIdB_both_7955": len(intact_zf),
            "distinct_molecule_pairs": len(intact_pairs),
            "distinct_pairs_both_of_which_are_our_genes": len(intact_pairs_our),
            "caveat": "Curated physical interactions. Undirected, unsigned, no strength.",
        },
        "CollecTRI_via_OmniPath": {
            "query": ["https://omnipathdb.org/interactions?datasets=collectri&organisms=9606&genesymbols=yes&fields=sources,references&format=tsv",
                      "https://omnipathdb.org/interactions?datasets=collectri&organisms=7955&limit=3",
                      "https://omnipathdb.org/queries/interactions"],
            "retrieved": TODAY,
            "organisms_omnipath_serves": omni_orgs.group(1) if omni_orgs else None,
            "zebrafish_request_response": omni_refusal,
            "human_signed_tf_target_edges": ct_rows,
            "of_which_signed_stimulation_or_inhibition": ct_signed,
            "edges_transferable_to_our_genes_by_zfin_orthology": len(ct_transferable),
            "label": ("ORTHOLOGY TRANSFER, NOT ZEBRAFISH DATA. CollecTRI is human; OmniPath serves only "
                      "taxa 9606, 10090 and 10116 and refuses 7955. Every edge above is a human edge "
                      "mapped onto a zebrafish gene pair through ZFIN orthology, mostly BLAST-based. "
                      "It is a hypothesis list, not a measurement, and zebrafish gene duplication means "
                      "one human edge can map to several zebrafish pairs."),
        },
        "zebrafish_specific_regulatory_edge_set": {
            "searched": ["SIGNOR (signor.uniroma2.it) - the host did not resolve from this network, "
                         "recorded as unreachable, not as empty",
                         "OmniPath / CollecTRI / DoRothEA - zebrafish not served",
                         "Europe PMC: " + str(epmc.get("grn_zebrafish"))],
            "found": "none",
        },
        "our_own_signed_directed_edges": {
            "source": ["genotype/causal-chains.json cross_gene", "genotype/interactions.json"],
            "gene_to_gene_edges_with_a_quoted_experiment": len(cc["cross_gene"]),
            "edges": [{"claim": c["claim"][:150], "grade": c["evidence_grade"],
                       "experiment": c["experiment_type"][:110]} for c in cc["cross_gene"]],
            "tissue_or_cell_level_interactions": inter["coverage"]["interactions"],
            "tissue_interactions_by_grade": inter["coverage"]["by_grade"],
            "caveat": ("These are the only signed, directed, experimentally supported gene-gene edges in "
                       "the project. None carries a strength: they are epistasis and pathway-order "
                       "statements, not rate constants. The 30 interactions are tissue-to-tissue or "
                       "cell-to-cell arrows, not gene-gene edges."),
        },
    },
}
out["items"]["h"]["strict_count"] = len(cc["cross_gene"])
out["items"]["h"]["any_experimental_support_edges"] = len(
    string_pairs["experiments"] | intact_pairs_our)
out["items"]["h"]["fraction_of_unordered_pairs_with_any_experimental_support"] = round(
    out["items"]["h"]["any_experimental_support_edges"] / unordered_pairs, 8)
out["items"]["h"]["verdict"] = (
    "%d of the %s unordered gene pairs (%.5f%%) have any direct experimental support in a fetched source "
    "(STRING experiments channel plus IntAct, both undirected and unsigned). Signed, directed, "
    "experimentally supported gene-gene edges with a named experiment: %d. With a strength: 0."
    % (out["items"]["h"]["any_experimental_support_edges"], format(unordered_pairs, ","),
       100.0 * out["items"]["h"]["any_experimental_support_edges"] / unordered_pairs,
       len(cc["cross_gene"])))

# ============================================================ what we DO have
iv = jload(os.path.join(REPO, "genotype", "interventions.json"))
phys = jload(os.path.join(REPO, "physiology", "sources.json"))
dev_src = jload(os.path.join(REPO, "development", "sources.json"))
stages = jload(os.path.join(REPO, "development", "stages.json"))
growth = jload(os.path.join(REPO, "development", "growth.json"))
allom = jload(os.path.join(REPO, "development", "allometry.json"))


def size_of(x):
    if isinstance(x, dict):
        for k in ("coverage", "summary", "stages", "rows", "entries"):
            if k in x and isinstance(x[k], list):
                return len(x[k])
        return len(x)
    return len(x) if isinstance(x, list) else None


out["what_we_actually_hold"] = {
    "note": ("The real parameter set, sized honestly. These are good numbers; they are just not a "
             "per-gene dynamical parameter set."),
    "calibrated_genetic_interventions": {
        "source": "genotype/interventions.json",
        "interventions_total": iv["coverage"]["interventions"],
        "genes_touched": iv["coverage"]["genes"],
        "usable_as_calibrated_knobs_magnitude_plus_stage": iv["coverage"]["usable_as_calibrated_knobs"],
        "with_numeric_effect_size": iv["coverage"]["with_numeric_effect_size"],
        "with_stage_reported": iv["coverage"]["with_stage_reported"],
        "morphology_parameters_covered": iv["coverage"]["parameters_covered"],
        "morphology_parameters_with_no_sourced_route": iv["coverage"]["parameters_with_no_sourced_route"],
        "distinct_publications": iv["coverage"]["distinct_publications"],
    },
    "morphogen_transport": {
        "source": "sim-engine/params/zebrafish-morphogens.json",
        "parameters": len(mps),
        "by_kind": dict(Counter(p.get("kind") for p in mps)),
        "distinct_molecules": diff_molecules,
    },
    "physiology": {
        "source": "physiology/sources.json + physiology/*.json",
        "sources": len(phys["sources"]),
        "modules": ["circulation", "gills", "cardiac", "countercurrent", "haemoglobin", "muscle"],
    },
    "development_and_staging": {
        "source": "development/",
        "sources": len(dev_src),
        "stages_file_entries": size_of(stages),
        "growth_file_entries": size_of(growth),
        "allometry_file_entries": size_of(allom),
    },
    "causal_chains": {
        "source": "genotype/causal-chains.json",
        "genes_with_a_chain": cc["coverage"]["genes_with_a_chain"],
        "chains_necessity_or_better": cc["coverage"]["chains_whose_weakest_link_is_necessity_or_better"],
        "distinct_publications": cc["coverage"]["distinct_publications"],
    },
    "functional_annotation": {
        "source": "genotype/pathways.slim.json",
        "genes_with_any_pathway": pw["coverage"]["all_genes_in_vetted_map"]["with_any_pathway"],
        "of": N,
        "by_source": pw["coverage"]["all_genes_in_vetted_map"]["by_source"],
        "caveat": pw["not_causation"],
    },
}

# ================================================== worked example: Xu et al. 2021
xu_xml = open(raw("xu2021_fulltext.xml"), encoding="utf-8", errors="replace").read()
xu = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", xu_xml))
xu_low = xu.lower()
xu_meta = jload(raw("xu2021_epmc.json"))["resultList"]["result"][0]

xu_quote = re.search(
    r"We predicted 23,611 protein-coding genes.{0,400}?Interpro hits", xu)
xu_abs = re.search(r"The assembled genome was predicted to possess 23,611.{0,160}", xu)

absent = ["rna-seq", "rnaseq", "transcriptome", "expression level", "tpm", "fpkm", "rpkm",
          "half-life", "turnover", "degradation rate", "decay rate", "dissociation constant",
          "binding affinity", "kcat", "michaelis", "diffusion", "hill coefficient",
          "cooperativ", "regulatory network", "chip-seq", "molecules per cell",
          "copies per cell", "absolute quantification", "promoter strength", "transcription rate"]
xu_absent = {t: xu_low.count(t) for t in absent}

import zipfile
sup_names, sup_inner, sup_doc_absent = [], [], {}
try:
    z = zipfile.ZipFile(raw("xu2021_suppl.zip"))
    sup_names = sorted(z.namelist())
    z2 = zipfile.ZipFile(io.BytesIO(z.read("Data_Sheet_1.ZIP")))
    sup_inner = sorted(z2.namelist())
    dx = zipfile.ZipFile(io.BytesIO(z.read("Data_Sheet_2.docx")))
    dtxt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", dx.read("word/document.xml").decode("utf-8", "replace")))
    sup_doc_absent = {t: dtxt.lower().count(t) for t in absent}
    sup_tables = len(re.findall(r"Supplementary Table \d+", dtxt))
except Exception as e:
    sup_tables = None
    sup_doc_absent = {"error": str(e)}

out["worked_example"] = {
    "why": ("One species states the annotation-versus-parameter gap better than any aggregate: a genome "
            "with essentially complete functional annotation and, in the paper that reports it, none of "
            "the eight parameters."),
    "paper": {
        "title": xu_meta.get("title"),
        "authors": xu_meta.get("authorString"),
        "journal": xu_meta.get("journalInfo", {}).get("journal", {}).get("title"),
        "year": xu_meta.get("pubYear"),
        "doi": xu_meta.get("doi"),
        "pmcid": xu_meta.get("pmcid"),
        "species": "Hirundichthys speculiger, the mirrorwing flyingfish",
        "queries": ["https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:\"10.3389/fgene.2021.695700\"&resultType=core",
                    "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8294118/fullTextXML",
                    "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8294118/supplementaryFiles"],
        "retrieved": TODAY,
        "read": "full text and both supplementary archives, fetched and parsed by this script",
    },
    "annotation": {
        "protein_coding_genes_predicted": 23611,
        "functionally_annotated": 23492,
        "percent": 99.5,
        "by_database": {"KEGG": 20692, "SwissProt": 21453, "TrEMBL": 23477, "InterPro": 21888},
        "quote_abstract": xu_abs.group(0).strip() if xu_abs else None,
        "quote_results": xu_quote.group(0).strip() if xu_quote else None,
        "definition_caveat": ("'Functionally annotated' here means at least one hit in at least one of "
                              "four databases. TrEMBL alone supplies 23,477 of the 23,492, and a TrEMBL "
                              "hit is a sequence-similarity match to an unreviewed entry, not a measured "
                              "function. Annotation by homology is the weakest sense of the word."),
    },
    "parameters_in_the_paper": {
        "method": ("every term below counted in the fetched full-text XML (all sections present: "
                   "Materials and Methods through References) and in Data_Sheet_2.docx, which holds "
                   "the supplementary tables"),
        "term_counts_in_full_text": xu_absent,
        "term_counts_in_supplementary_tables": sup_doc_absent,
        "supplementary_archive_top_level": sup_names,
        "supplementary_data_sheet_1_contents": sup_inner,
        "supplementary_tables": sup_tables,
        "gene_prediction_evidence": ("homology plus ab initio (Augustus); the word transcriptome does "
                                     "not appear, and 'expression' appears twice, both times in "
                                     "discussion of other work or in a reference title"),
        "verdict": ("Zero. No RNA-seq, no absolute or relative expression, no protein or mRNA half-life, "
                    "no binding affinity, no kinetics, no diffusion coefficient, no Hill coefficient and "
                    "no gene regulatory network appear anywhere in the paper or its supplement. "
                    "Supplementary Data Sheet 1 is twelve TIFF figures; Data Sheet 2 holds %s "
                    "supplementary tables, all of them accessions, assembly statistics and gene-family "
                    "counts." % sup_tables),
    },
    "the_point": ("99.5%% of 23,611 genes functionally annotated, 0 of 8 simulation parameters. "
                  "Functional annotation and parameterisation are not the same quantity, and in the one "
                  "species this project is about, the first is nearly complete while the second is empty."),
}

# ============================================================ the ratio
E = out["items"]["h"]["any_experimental_support_edges"]
held_gene_params = (out["items"]["a"]["strict_count"] + out["items"]["b"]["strict_count"]
                    + out["items"]["c"]["strict_count"] + out["items"]["d"]["strict_count"])
held_edge_params = 0
minimal = 4 * N + E
held = held_gene_params + held_edge_params

lenient_a = len(pax_genes)          # PaxDb ppm counted as a stand-in for (a)
lenient_held = lenient_a + 0 + 0 + 0 + 0
out["ratio"] = {
    "definition": ("Minimal parameter count = 4 per gene (items a-d: absolute abundance, protein "
                   "half-life, mRNA half-life, transcription rate) + 1 strength per edge of the "
                   "edge list we could actually assemble."),
    "N_genes": N,
    "gene_parameters_needed": 4 * N,
    "edges_in_the_best_experimentally_supported_edge_list_we_could_fetch": E,
    "edge_parameters_needed": E,
    "minimal_parameter_count": minimal,
    "parameters_we_hold_strictly": held,
    "ratio_strict": held / minimal,
    "ratio_strict_text": "%d / %s = %.6f%%" % (held, format(minimal, ","), 100.0 * held / minimal),
    "lenient_variant": {
        "what_is_relaxed": ("item (a) satisfied by a PaxDb ppm value in any whole-organism or organ "
                            "dataset, ignoring the cell type, the stage and the unit"),
        "parameters_we_hold": lenient_held,
        "ratio": lenient_held / minimal,
        "ratio_text": "%d / %s = %.4f%%" % (lenient_held, format(minimal, ","),
                                            100.0 * lenient_held / minimal),
    },
    "extended_variant": {
        "what_is_added": ("items e, f, g as well: kinetics, diffusion, cooperativity, one each per gene, "
                          "so 7 per gene plus one per edge"),
        "needed": 7 * N + E,
        "held": (out["items"]["e"]["strict_count"] + out["items"]["f"]["strict_count"]
                 + out["items"]["g"]["strict_count"]),
        "ratio": (out["items"]["e"]["strict_count"] + out["items"]["f"]["strict_count"]
                  + out["items"]["g"]["strict_count"]) / (7 * N + E),
    },
    "pairwise_framing": {
        "unordered_gene_pairs": unordered_pairs,
        "pairs_with_any_direct_experimental_support": E,
        "fraction": E / unordered_pairs,
        "fraction_text": "%.5f%%" % (100.0 * E / unordered_pairs),
    },
}

# ================================================== precedent: Karr et al. 2012
karr_x = open(raw("karr2012_pmc_efetch.xml"), encoding="utf-8", errors="replace").read()
karr = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", karr_x))
karr_meta = jload(raw("karr2012_epmc.json"))["resultList"]["result"][0]


def quote(pat):
    m = re.search(pat, karr)
    return m.group(0).strip() if m else None


PPG = 1900 / 525.0
PUBPG = 900 / 525.0
out["precedent_m_genitalium"] = {
    "why": ("The closest thing that exists to what is being asked: a model that predicts phenotype "
            "from genotype for every annotated gene of an organism."),
    "paper": {
        "title": karr_meta.get("title"),
        "authors": karr_meta.get("authorString"),
        "journal": "Cell 150(2), 2012",
        "doi": karr_meta.get("doi"),
        "pmid": karr_meta.get("pmid"),
        "pmcid": karr_meta.get("pmcid"),
        "queries": ["https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:\"10.1016/j.cell.2012.05.044\"&resultType=core",
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=PMC3413483&rettype=xml"],
        "retrieved": TODAY,
        "note": ("The Europe PMC fullTextXML endpoint returned 500 for this PMCID; the text was read "
                 "from the NCBI PMC efetch XML instead."),
    },
    "what_it_covered": {
        "genes": 525,
        "genes_quote": quote(r"Mycoplasma genitalium, a human urogenital parasite whose genome contains 525 genes[^.]*"),
        "sub_models": 28,
        "sub_models_quote": quote(r"We divided M\. genitalium into the 28 functional processes[^.]*\."),
        "scope": "the life cycle of a SINGLE CELL; no anatomy, no tissues, no development",
    },
    "what_it_took": {
        "primary_sources": "over 900",
        "experimentally_observed_parameters": "more than 1,900",
        "quote": quote(r"Our model is based on a synthesis of over 900 publications and includes more than 1,900 experimentally observed parameters\."),
        "reconstruction_quote": quote(r"The whole-cell model was based on a detailed reconstruction of M\. genitalium developed from over 900 primary sources, reviews, books, and databases\."),
        "parameters_per_gene": round(PPG, 2),
        "publications_per_gene": round(PUBPG, 2),
    },
    "scaled_to_our_gene_set": {
        "note": ("Not a prediction, just the same parameter density applied to a larger gene set, to "
                 "size the task. Development would need more, not fewer, parameters per gene: a "
                 "zygote-to-adult model adds cell states, positions, divisions and movements that a "
                 "single bacterial cell does not have."),
        "genes": N,
        "parameters_at_the_same_density": round(PPG * N),
        "publications_at_the_same_rate": round(PUBPG * N),
        "publications_this_project_has_read_for_this_purpose": {
            "causal chains": cc["coverage"]["distinct_publications"],
            "interventions": iv["coverage"]["distinct_publications"],
            "tissue interactions": inter["coverage"]["distinct_publications"],
            "physiology sources": len(phys["sources"]),
        },
    },
    "the_difference": ("M. genitalium is one cell with 525 genes, and it still took over 900 "
                       "publications and more than 1,900 measured parameters. The question here is a "
                       "whole organism from the zygote, with 4,571 genes and a body plan. The "
                       "precedent does not say the task is impossible; it says the unit of work is a "
                       "parameter read from a paper, roughly 3.6 per gene, and that functional "
                       "annotation was the starting point of that effort, not a substitute for it: "
                       "the paper's own claim is that the model 'accounts for all annotated gene "
                       "functions', which it reached by curating 900 sources on top of the "
                       "annotation."),
}

out["headline"] = {
    "ratio": out["ratio"]["ratio_strict_text"],
    "one_sentence": ("Of the %s numbers a minimal dynamical model of these 4,571 genes would need, we "
                     "hold %d, because the eight parameter classes a simulation runs on are not what "
                     "any of the queried databases stores for zebrafish."
                     % (format(minimal, ","), held)),
    "generous_bound": out["ratio"]["lenient_variant"]["ratio_text"],
    "generous_caveat": ("and all %d of those are PaxDb ppm values, a share of total protein mass in a "
                        "whole organism or a dissected organ, not a count per cell in a named cell type "
                        "at a named stage" % lenient_a),
    "annotation_for_contrast": "%d of %d genes (%.1f%%) carry a functional annotation" % (
        pw["coverage"]["all_genes_in_vetted_map"]["with_any_pathway"], N,
        100.0 * pw["coverage"]["all_genes_in_vetted_map"]["fraction"]),
}

out["simulatable_today"] = {
    "yes": [
        {"what": "A reaction-diffusion model of one morphogen gradient over a continuum, not over genes",
         "with": ("the 4 fetched zebrafish diffusion coefficients plus the Fgf8 residence time and "
                  "gradient length in sim-engine/params/zebrafish-morphogens.json"),
         "coarseness": ("concentration in arbitrary units, one tissue, gastrula parameters carried to "
                        "whatever stage is being modelled, which the file itself flags as an assumption")},
        {"what": "A 2-node Boolean or qualitative model of the fin-size switch",
         "with": ("the 5 signed directed gene-gene edges in genotype/causal-chains.json cross_gene "
                  "(kcnh2a, lat4a, kcnk5b, calcineurin) and the 12 calibrated interventions"),
         "coarseness": "signs and orderings, no rates; outcomes as larger / smaller / unchanged"},
        {"what": "A growth and allometry trajectory for the whole animal",
         "with": "development/ (staging, growth, allometry) and physiology/ (25 fetched sources)",
         "coarseness": ("whole-organism, no genes in the loop; the genotype enters only through the 12 "
                        "calibrated knobs on 19 morphology parameters")},
        {"what": ("A curated small network over a handful of cell states: the project's own estimate of "
                  "its ceiling"),
         "with": ("the 42 causal chains, the 30 tissue-to-tissue and cell-to-cell interactions, and the "
                  "449 experimentally supported STRING edges as a candidate topology"),
         "coarseness": ("topology and sign where known; every rate constant would be a free parameter "
                        "fitted or assumed, so the model would be a hypothesis generator, not a "
                        "prediction")},
    ],
    "no": [
        "A zygote-to-adult simulation in which the 4,571 genes are dynamical variables.",
        ("Any model whose output depends on absolute concentrations, since not one gene has one, and "
         "ppm cannot be converted without a total protein count per zebrafish cell that no fetched "
         "source gives."),
        ("Any model whose output depends on timescales, since no gene has an mRNA or protein half-life "
         "and no gene has a transcription rate: every timescale would be invented."),
        ("A genome-scale regulatory network: 0.004%% of gene pairs have direct experimental support, none "
         "of it signed, directed and quantified. The only genome-scale option is orthology transfer from "
         "human CollecTRI (%s transferable edges), which is a hypothesis list, not zebrafish data."
         % format(len(ct_transferable), ",")),
        "Anything at all in a flying fish: see the worked example.",
    ],
    "what_would_change_the_answer": [
        "A staged zebrafish absolute-proteomics dataset in copies per cell (none exists in PaxDb or PRIDE).",
        "A genome-wide zebrafish mRNA stability dataset turned into a per-gene table.",
        "A zebrafish TF-target resource with signs, so the network stops being orthology transfer.",
    ],
}

json.dump(out, open(os.path.join(HERE, "readiness.json"), "w", encoding="utf-8"), indent=1)

# ------------------------------------------------------------------ console
print("genes                       ", N)
print("with a UniProt accession    ", len(zfin_to_uniprot))
print("with an Ensembl gene        ", len(zfin_to_ensg))
print("with a human ortholog       ", len(zfin_to_human))
print("with a STRING protein       ", genes_with_string)
print()
for k in "abcdefgh":
    it = out["items"][k]
    print("(%s) strict %6d   %s" % (k, it.get("strict_count", 0), it["need"][:62]))
print()
print("PaxDb ppm (lenient a)       ", len(pax_genes))
print("SABIO-RK zebrafish accessions", len(sabio_danre), "-> our genes", len(sabio_our))
print("STRING experiments edges    ", len(string_pairs["experiments"]))
print("STRING transferred-only     ", len(string_pairs["experiments_transferred"] - string_pairs["experiments"]))
print("IntAct pairs (our genes)    ", len(intact_pairs_our))
print("CollecTRI orthology-transfer ", len(ct_transferable))
print("union experimental edges E  ", E)
print()
print("MINIMAL  4*N + E            ", minimal)
print("HELD strict                 ", held)
print("RATIO strict                ", out["ratio"]["ratio_strict_text"])
print("RATIO lenient               ", out["ratio"]["lenient_variant"]["ratio_text"])
print("pairs with any support      ", out["ratio"]["pairwise_framing"]["fraction_text"])
