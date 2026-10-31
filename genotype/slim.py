"""Write genotype/map.vetted.slim.json from genotype/map.vetted.json: the file the repo commits and the 3D view
reads first. Same top-level keys as map.vetted.json; each layer carries only coverage, nodes and links.
Links are deduplicated and capped exactly as dashboard/build-graph.mjs does (one row per gene symbol, organism
and evidence kind; at most CAP per link type per node; sufficient and required first, then expressed in by
evidence kind: single-cell, in situ and immunostaining before bulk), so the view draws the same rows from
either file. Per-node gene counts in `nodes` are complete and untouched. Omitted rows are counted per node.
No genes dictionary, no focus-gene evidence blobs, no PubMed abstracts.
Usage: python -I genotype/slim.py
"""
import collections, hashlib, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "map.vetted.json")
M = json.load(open(SRC, encoding="utf8"))
CAP = 40
def rank(kind): return 0 if re.search(r"single|in situ|immunost", kind or "", re.I) else 2 if re.search(r"bulk|RNA Seq", kind or "", re.I) else 1
def short_org(o): return "zebrafish" if "Danio" in (o or {}).get("name", "") else "medaka" if "Oryzias" in (o or {}).get("name", "") else "not fish data"

def slim_link(l):
    e = l.get("evidence") or {}
    s = {"blueprint_node": l["blueprint_node"], "gene": l["gene"], "symbol": l.get("symbol"), "organism": l["organism"], "link_type": l["link_type"],
         "evidence_kind": l["evidence_kind"], "derived": False, "stage": l.get("stage"), "source": l.get("source")}
    if "phenotypes" in e:
        p0 = e["phenotypes"][0]
        s["finding"] = f'{p0["eq"]} {p0["quality"]}'
        s["evidence"] = {"loss_of_function_evidence": e.get("loss_of_function_evidence"), "phenotype_rows": e["phenotype_rows"], **({"pmid": p0["pmid"]} if p0.get("pmid") else {})}
        if l["link_type"] == "sufficient for" and e.get("gain_of_function"):
            g = e["gain_of_function"][0]
            s["finding"] = f'{p0["eq"]} {p0["quality"]} in a verified gain-of-function allele ({g["allele"]}; "{g["quote"]}", PMID {g["pmid"]}); sufficient to change fin size, not to make a fin'
    elif "go_terms" in e:
        s["evidence"] = {"go_terms": e["go_terms"][:2], "evidence_codes": e.get("evidence_codes")}
    elif "assays" in e:
        s["evidence"] = {"assays": e["assays"]}
    elif "ensembl" in e:
        s["evidence"] = {"data_types_observed": e.get("data_types_observed")}
    else:
        s["evidence"] = {k: v for k, v in e.items() if k in ("gene_product", "label")}
    return s

layers, omitted = {}, {}
for L, D in M["layers"].items():
    by_node = collections.defaultdict(list)
    for l in D["links"]:
        if not l.get("derived"): by_node[l["blueprint_node"]].append(l)
    keep = []
    for node, ls in by_node.items():
        for typ in ("sufficient for", "required for", "expressed in"):
            grp = sorted((l for l in ls if l["link_type"] == typ), key=lambda l: (rank(l.get("evidence_kind")), str(l.get("symbol"))))
            seen, rows = set(), []
            for l in grp:
                k = f'{l.get("symbol")}|{short_org(l.get("organism"))}|{l.get("evidence_kind")}'
                if k in seen: continue
                seen.add(k); rows.append(l)
            if len(rows) > CAP: omitted.setdefault(node, {})[typ] = len(rows) - CAP
            keep += [slim_link(l) for l in rows[:CAP]]
    layers[L] = {"coverage": D["coverage"], "nodes": D["nodes"], "links": keep}

fs = M["fin_size"]
out = {k: M[k] for k in ("title", "built", "tool", "constraint", "causation_warning", "link_types", "propagation_rules", "blueprint", "crosswalk")}
out["summary"] = {k: v for k, v in M["summary"].items() if k != "direct_links_by_layer_kind_organism"}
out["focus_genes"] = {"note": M["focus_genes"]["note"] + " Evidence blobs are in map.vetted.json.",
                      "genes": [{k: g[k] for k in ("family_in_DATA_md", "symbol", "gene", "organism", "flying_fish_correspondence", "breadth")} | {"pectoral_fin_links": len(g["pectoral_fin_links"])} for g in M["focus_genes"]["genes"]]}
out["fin_size"] = {"why": fs["why"],
                   "verified_leads": [{k: v for k, v in lead.items() if k != "zfin_rows_citing_this_paper"} | ({"zfin_rows_citing_this_paper": {"zfin_pub": lead["zfin_rows_citing_this_paper"]["zfin_pub"], "pmid": lead["zfin_rows_citing_this_paper"]["pmid"], "genes": lead["zfin_rows_citing_this_paper"]["genes"], "rows": len(lead["zfin_rows_citing_this_paper"]["rows"])}} if "zfin_rows_citing_this_paper" in lead else {}) for lead in fs["verified_leads"]],
                   "pubmed_queries": [{"term": q["term"], "count": q["count"], "retrieved": q["retrieved"]} for q in fs["pubmed_queries"]],
                   "zfin_fin_size_genes": {"definition": fs["zfin_fin_size_genes"]["definition"], "count": fs["zfin_fin_size_genes"]["count"],
                                           "top_10_by_rows": [{"symbol": g["symbol"], "zfin": g["zfin"], "rows": g["rows"]} for g in fs["zfin_fin_size_genes"]["genes"][:10]]},
                   "aliases_check": fs["aliases_check"],
                   **({"measured_fin_proportions": fs["measured_fin_proportions"]} if "measured_fin_proportions" in fs else {})}
out["genes"] = {"note": "The per-gene breadth table is in map.vetted.json (not in this slim file)."}
out["not_sourced"] = M["not_sourced"]; out["vetting"] = M["vetting"]; out["vetted"] = True
out["slimming"] = {"of": "genotype/map.vetted.json", "full_file_sha256": hashlib.sha256(open(SRC, "rb").read()).hexdigest(),
                   "rule": f"direct links only, one row per gene symbol, organism and evidence kind, at most {CAP} per link type per node (sufficient, required, then expressed in by evidence kind), the same rule as dashboard/build-graph.mjs; per-node counts in nodes are complete",
                   "links_omitted_by_node_and_type": omitted}
out["layers"] = layers
DST = os.path.join(HERE, "map.vetted.slim.json")
json.dump(out, open(DST, "w", encoding="utf8"), separators=(",", ":"))
n = sum(len(l["links"]) for l in layers.values())
print(f"map.vetted.slim.json: {os.path.getsize(DST) / 1e3:.0f} KB, {n} links, omitted rows on {len(omitted)} nodes")
