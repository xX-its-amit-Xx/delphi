#!/usr/bin/env python3
"""Build the molecular data pack served by validate-show/molecular.js.

Reads ONLY repo data (omics/, structures/, genotype/) plus AlphaFold DB coordinate
files cached under C:/Temp/molecular-cache/af. Writes per-gene cards and CA-only
coordinate arrays into this directory and nowhere else. Run from the repo root:

    python dashboard/public/validate-show/structures/build_pack.py [--no-fetch] [--limit N]

Decimation: coordinates are CA-only (one atom per residue) with x/y/z rounded to
0.1 A and pLDDT rounded to 0.1. No side chains, no hydrogens, no waters, no
ligands except the HETATM centroids recorded as `ligands`. Full models stay at
the AlphaFold DB / RCSB URLs recorded in every card.

No Aves (bird) data: every row whose `species` matches /Aves|bird/i is dropped,
and the only species present in the pack are zebrafish, plus human/mouse
reference proteins for the experimental structures, plus the flying-fish residue
states from omics/ptm/flying_fish_flags.json.
"""
import argparse
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.request
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))
CACHE = "C:/Temp/molecular-cache"
AF_CACHE = os.path.join(CACHE, "af")
os.makedirs(AF_CACHE, exist_ok=True)
os.makedirs(os.path.join(CACHE, "work"), exist_ok=True)

AVES_RE = re.compile(r"\bAves\b|\bbird", re.I)
BUILT = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def rj(*p):
    with open(os.path.join(ROOT, *p), encoding="utf-8") as f:
        return json.load(f)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- gene universe
def gene_universe():
    genes = rj("omics", "genes.json")
    if isinstance(genes, dict):
        genes = genes.get("genes", genes)
    by_zfin = {g["zfin_id"]: g for g in genes if g.get("zfin_id")}
    by_sym = {g["symbol"]: g for g in genes}

    wanted, reasons = {}, defaultdict(set)

    for g in rj("genotype", "causal-chains.json")["genes"]:
        s = g["symbol"]
        if s in by_sym:
            wanted[s] = by_sym[s]
            reasons[s].add("on a sourced causal chain to a fin phenotype (genotype/causal-chains.json)")

    for x in rj("genotype", "interventions.json")["interventions"]:
        for tok in re.split(r"[^A-Za-z0-9]+", x.get("gene") or ""):
            if tok and tok == tok.lower() and tok in by_sym:
                wanted[tok] = by_sym[tok]
                reasons[tok].add("named by a sourced intervention (genotype/interventions.json)")

    fs = rj("genotype", "fin-subtree.full.json")
    parts = {}
    for level, layer in fs["layers"].items():
        for n in layer.get("nodes", []):
            parts[n["term"]] = {"term": n["term"], "label": n["label"], "level": level,
                                "uberon": [u["uberon"] for u in n.get("uberon_xref") or []],
                                "genes": []}
        for lk in layer.get("links", []):
            lt = lk.get("link_type")
            if lt not in ("required for", "sufficient for"):
                continue
            sym = lk.get("symbol")
            node = parts.get(lk.get("blueprint_node"))
            if not sym or sym not in by_sym or node is None:
                continue
            wanted[sym] = by_sym[sym]
            reasons[sym].add(f"{lt} {node['label']} (genotype/fin-subtree.full.json, {lk.get('source', {}).get('database', '?')})")
            node["genes"].append({"symbol": sym, "link_type": lt,
                                  "evidence_kind": lk.get("evidence_kind"),
                                  "database": (lk.get("source") or {}).get("database")})
    parts = {k: v for k, v in parts.items() if v["genes"]}
    return wanted, {k: sorted(v) for k, v in reasons.items()}, parts


# -------------------------------------------------------- omics row extraction
PROT_KEEP = {
    "predicted_structure", "experimental_structure", "domain", "protein_family",
    "homologous_superfamily", "region", "motif", "site", "repeat", "zinc_finger",
    "coiled_coil", "disordered", "interacts_with", "interaction_partner_count",
    "protein_detected", "protein_abundance", "protein_length", "protein_existence",
    "subcellular_location", "protein_function", "membrane_topology",
    "uniprot_entry_status",
}
POSITIONAL = {"domain", "protein_family", "homologous_superfamily", "region", "motif",
              "site", "repeat", "zinc_finger", "coiled_coil", "disordered"}


def scan_jsonl(path, symbols, keep=None):
    out = defaultdict(list)
    dropped_aves = 0
    with gzip.open(os.path.join(ROOT, path), "rt", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            if (r.get("gene") or {}).get("symbol") not in symbols:
                continue
            if keep and r.get("feature") not in keep:
                continue
            if AVES_RE.search(r.get("species") or ""):
                dropped_aves += 1
                continue
            out[r["gene"]["symbol"]].append(r)
    return out, dropped_aves


# ------------------------------------------------------------- AlphaFold fetch
def af_pdb(acc, version, no_fetch=False):
    tried = []
    for v in ([version] if version else []) + [v for v in (6, 5, 4) if v != version]:
        name = f"AF-{acc}-F1-model_v{v}.pdb"
        fp = os.path.join(AF_CACHE, name)
        if os.path.exists(fp) and os.path.getsize(fp) > 400:
            return open(fp, encoding="utf-8").read(), v, tried
        if no_fetch:
            tried.append(f"v{v}: not cached and --no-fetch")
            continue
        url = f"https://alphafold.ebi.ac.uk/files/{name}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DELPHI-validate-show/1.0"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                txt = resp.read().decode("utf-8", "replace")
            open(fp, "w", encoding="utf-8").write(txt)
            time.sleep(0.1)
            return txt, v, tried
        except Exception as e:  # noqa: BLE001
            tried.append(f"v{v}: {type(e).__name__} {e}")
    return None, None, tried


AA3 = {"ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C", "GLN": "Q",
       "GLU": "E", "GLY": "G", "HIS": "H", "ILE": "I", "LEU": "L", "LYS": "K",
       "MET": "M", "PHE": "F", "PRO": "P", "SER": "S", "THR": "T", "TRP": "W",
       "TYR": "Y", "VAL": "V", "SEC": "U", "PYL": "O", "MSE": "M"}


def parse_ca(text, chains=None):
    """CA-only parse. -> ({chain: {res, xyz, b, seq}}, [hetatm ligand records])."""
    out, seen, het = {}, set(), defaultdict(lambda: {"xyz": [], "name": None, "chain": None})
    for line in text.splitlines():
        if line.startswith("ENDMDL"):
            break
        if line.startswith("HETATM"):
            resn = line[17:20].strip().upper()
            if resn in ("HOH", "DOD"):
                continue
            key = (line[21], line[22:27].strip(), resn)
            try:
                xyz = (float(line[30:38]), float(line[38:46]), float(line[46:54]))
            except ValueError:
                continue
            h = het[key]
            h["xyz"].append(xyz)
            h["name"], h["chain"] = resn, line[21]
            continue
        if not line.startswith("ATOM") or line[12:16].strip() != "CA":
            continue
        ch = line[21]
        if chains and ch not in chains:
            continue
        aa = AA3.get(line[17:20].strip().upper())
        if aa is None:
            continue
        key = (ch, line[22:27])
        if key in seen:
            continue
        try:
            x, y, z = float(line[30:38]), float(line[38:46]), float(line[46:54])
            b = float(line[60:66]) if line[60:66].strip() else 0.0
            resi = int(line[22:26])
        except ValueError:
            continue
        seen.add(key)
        d = out.setdefault(ch, {"res": [], "xyz": [], "b": [], "seq": ""})
        d["res"].append(resi)
        d["xyz"] += [round(x, 1), round(y, 1), round(z, 1)]
        d["b"].append(round(b, 1))
        d["seq"] += aa
    ligs = []
    for (_, _, resn), h in het.items():
        if not h["xyz"]:
            continue
        n = len(h["xyz"])
        ligs.append({"name": resn, "chain": h["chain"], "n_atoms": n,
                     "centroid": [round(sum(p[i] for p in h["xyz"]) / n, 1) for i in range(3)]})
    return out, ligs


def wgz(relpath, obj):
    fp = os.path.join(OUT, relpath)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    raw = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as z:
        z.write(raw)
    open(fp, "wb").write(buf.getvalue())
    return len(buf.getvalue())


# ------------------------------------------------------------------- the build
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-fetch", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    universe, reasons, parts = gene_universe()
    if args.limit:
        keep = sorted(universe)[: args.limit]
        universe = {k: universe[k] for k in keep}
    symbols = set(universe)
    log(f"gene universe: {len(symbols)} genes, {len(parts)} anatomical parts with required/sufficient genes")

    prot, drop_p = scan_jsonl("omics/proteomic/annotations.jsonl.gz", symbols, PROT_KEEP)
    log(f"proteomic rows: {sum(len(v) for v in prot.values())} ({drop_p} Aves rows dropped)")
    ptm, drop_t = scan_jsonl("omics/ptm/annotations.jsonl.gz", symbols)
    log(f"ptm rows: {sum(len(v) for v in ptm.values())} ({drop_t} Aves rows dropped)")

    ff = rj("omics", "ptm", "flying_fish_flags.json")
    ff_by_gene = defaultdict(list)
    for s in ff["sites"]:
        ff_by_gene[s["gene"]].append(s)

    models = rj("structures", "models.json")
    zf_models = models["matrix"].get("zebrafish (Danio rerio)", {})
    variants = rj("structures", "variants", "variants.json")
    var_by_gene = defaultdict(list)
    for v in variants["variants"]:
        var_by_gene[v["protein_key"]].append(v)
    imap = rj("structures", "interface-mapping.json")
    binding = rj("structures", "binding.json")
    chains_man = rj("structures", "chains", "MANIFEST.json")
    conv = rj("structures", "convergence-test.json")

    # ---- which experimental chain file belongs to which gene, from binding.json
    bind_targets = binding.get("targets") or binding.get("interfaces") or {}
    if isinstance(bind_targets, list):
        bind_targets = {t.get("target") or t.get("id"): t for t in bind_targets}

    chain_files = {}
    for cf in chains_man["files"]:
        chain_files[cf["target"]] = cf


    # ---- the convergence test, joined to a gene by its own variant notation (no gene named here)
    conv_struct = conv.get("the_structure") or {}
    conv_sub = conv.get("the_substitution") or {}
    conv_site = conv.get("the_substrate_site") or {}
    conv_ans = conv.get("the_answer") or {}
    conv_sum = conv.get("summary") or {}
    conv_gene = None
    for sym_, vs in var_by_gene.items():
        for v in vs:
            if v.get("notation") and v["notation"].lower() in str(conv_sub.get("id", "")).lower():
                conv_gene = sym_
                break
        if conv_gene:
            break

    index = {"built": BUILT, "n_genes": 0, "genes": {}, "parts": {}, "experimental": {},
             "global": {}, "sources": [], "decimation": "CA-only, xyz rounded to 0.1 A, pLDDT to 0.1"}

    # --------------------------------------------------- experimental chain pack
    exp_written = {}
    for target, cf in chain_files.items():
        text = gzip.open(os.path.join(ROOT, "structures", cf["file"]), "rt", encoding="utf-8").read()
        ch, ligs = parse_ca(text, set(cf["chains_kept"]))
        if not ch:
            continue
        obj = {"pdb_id": cf["pdb_id"], "title": cf["title"], "method": cf["method"],
               "resolution_A": cf.get("resolution_A"), "url": cf["url"], "target": target,
               "what": cf["what"], "note": cf["note"],
               "repo_source": "structures/" + cf["file"],
               "chains": {k: {"res": v["res"], "xyz": v["xyz"], "seq": v["seq"], "n": len(v["res"])}
                          for k, v in ch.items()},
               "ligands": ligs,
               "decimation": "CA-only from the repo's already-trimmed chain file; side chains, waters and hydrogens were removed upstream"}
        n = wgz(f"exp/{cf['pdb_id']}.json.gz", obj)
        exp_written[cf["pdb_id"]] = {"file": f"exp/{cf['pdb_id']}.json.gz", "bytes": n, "target": target,
                                     "pdb_id": cf["pdb_id"], "title": cf["title"],
                                     "resolution_A": cf.get("resolution_A"), "method": cf["method"],
                                     "url": cf["url"], "what": cf["what"],
                                     "n_chains": len(ch),
                                     "n_ca": sum(len(v["res"]) for v in ch.values()),
                                     "n_ligands": len(ligs)}
        log(f"  exp {cf['pdb_id']}: {len(ch)} chains, {sum(len(v['res']) for v in ch.values())} CA, {len(ligs)} ligands, {n} bytes")
    index["experimental"] = exp_written

    # ---- map gene -> experimental entries our own structural work used
    gene_exp = defaultdict(list)
    for v in variants["variants"]:
        es = v.get("experimental_structure") or {}
        if es.get("pdb_id"):
            for pid, meta in exp_written.items():
                if pid == es["pdb_id"]:
                    gene_exp[v["protein_key"]].append({"pdb_id": pid, "role": "the structure our own variant placement was measured on",
                                                       "identity_to_zebrafish": es.get("identity_zebrafish_vs_structure_protein")})
    for k in gene_exp:
        seen = set()
        uniq = []
        for e in gene_exp[k]:
            if e["pdb_id"] in seen:
                continue
            seen.add(e["pdb_id"])
            uniq.append(e)
        gene_exp[k] = uniq

    # --------------------------------------------------------------- per gene
    totals = defaultdict(int)
    iclass_tot = defaultdict(int)
    for sym in sorted(symbols):
        g = universe[sym]
        rows = prot.get(sym, [])
        by_feat = defaultdict(list)
        for r in rows:
            by_feat[r["feature"]].append(r)

        card = {
            "symbol": sym, "zfin_id": g.get("zfin_id"),
            "xrefs": {"uniprot": g.get("uniprot"), "uniprot_status": g.get("uniprot_status"),
                      "ensembl_gene": g.get("ensembl_gene"),
                      "human_ortholog": g.get("human_ortholog"), "flying_fish": g.get("flying_fish")},
            "why_in_pack": reasons.get(sym, []),
            "built": BUILT, "gaps": [],
        }

        # ---- protein basics
        def one(feat, key="value"):
            rs = by_feat.get(feat) or []
            return rs[0] if rs else None

        pl = one("protein_length")
        pe = one("protein_existence")
        pf = one("protein_function")
        es_row = one("uniprot_entry_status")
        mt = one("membrane_topology")
        card["protein"] = {
            "length": int(pl["value"]) if pl else None,
            "length_source": pl["source"] if pl else None,
            "existence": pe["value"] if pe else None,
            "existence_evidence": pe.get("evidence") if pe else None,
            "entry_status": es_row["value"] if es_row else None,
            "function": pf["value"] if pf else None,
            "function_source": pf["source"] if pf else None,
            "membrane_topology": mt["value"] if mt else None,
            "locations": sorted({r["value"] for r in by_feat.get("subcellular_location", [])}),
        }
        if not card["protein"]["length"]:
            card["gaps"].append({"id": "no-uniprot-protein", "what": "protein sequence",
                                 "reason": "no UniProt entry for this gene in the 2026_03 zebrafish download",
                                 "source": "omics/proteomic/SOURCES.md"})

        # ---- structure accession: three sources, disagreement recorded
        af_row = one("predicted_structure")
        af_omics = None
        if af_row:
            v = af_row["value"] if isinstance(af_row["value"], dict) else json.loads(af_row["value"])
            af_omics = {"accession": (af_row.get("protein_accession") or (af_row.get("source") or {}).get("accession", "").replace("AF-", "").replace("-F1", "")),
                        "model": v.get("model"), "mean_plddt": v.get("mean_plddt"),
                        "fraction_plddt_gt70": v.get("fraction_plddt_gt70"),
                        "fraction_plddt_gt90": v.get("fraction_plddt_gt90"),
                        "fraction_plddt_lt50": v.get("fraction_plddt_lt50"),
                        "version": v.get("version"), "url": af_row["source"]["url"],
                        "from": "omics/proteomic (AlphaFold DB API)"}
            m = re.match(r"AF-([A-Z0-9]+)-F1", af_omics["model"] or "")
            if m:
                af_omics["accession"] = m.group(1)

        af_struct = None
        zm = zf_models.get(sym)
        if zm and zm.get("status") == "model" and zm.get("alphafold"):
            a = zm["alphafold"]
            af_struct = {"accession": a["uniprot_accession"], "model": a["entry_id"],
                         "mean_plddt": a.get("global_metric_value"), "version": a.get("model_version"),
                         "length": a.get("sequence_length"), "url": zm.get("alphafold_url"),
                         "uniprot_protein_name": (zm.get("uniprot") or {}).get("protein_name"),
                         "uniprot_gene_names": (zm.get("uniprot") or {}).get("gene_names"),
                         "matched_how": zm.get("matched_how"), "confidence": zm.get("confidence"),
                         "from": "structures/models.json (this project's own structural layer)"}

        af_var = None
        for v in var_by_gene.get(sym, []):
            if v.get("alphafold_entry"):
                af_var = {"accession": v["uniprot"], "model": v["alphafold_entry"],
                          "mean_plddt": v.get("alphafold_mean_plddt"),
                          "version": v.get("alphafold_version"), "length": v.get("sequence_length"),
                          "from": "structures/variants/variants.json (the entry our own variant placement used)"}
                break

        chosen = af_var or af_struct or af_omics
        disagreement = None
        cands = [c for c in (af_var, af_struct, af_omics) if c]
        accs = {c["accession"] for c in cands if c.get("accession")}
        if len(accs) > 1:
            disagreement = {
                "what": "this project's own layers picked different UniProt entries for the same gene, so they are modelling different proteins",
                "candidates": [{"accession": c["accession"], "model": c.get("model"),
                                "length": c.get("length"), "mean_plddt": c.get("mean_plddt"),
                                "from": c["from"]} for c in cands],
                "chosen": chosen["accession"],
                "why": "the entry our own structural work used wins, because every residue number in sites/ is numbered against it",
            }

        if chosen:
            text, ver, tried = af_pdb(chosen["accession"], chosen.get("version"), args.no_fetch)
            if text:
                ch, ligs = parse_ca(text)
                k = next(iter(ch))
                d = ch[k]
                card["structure"] = {
                    "kind": "alphafold-prediction",
                    "accession": chosen["accession"], "model": chosen.get("model"),
                    "model_version_served": ver, "mean_plddt": chosen.get("mean_plddt"),
                    "source_choice": {"chosen_from": chosen["from"], "disagreement": disagreement},
                    "url": f"https://alphafold.ebi.ac.uk/entry/{chosen['accession']}",
                    "pdb_url": f"https://alphafold.ebi.ac.uk/files/AF-{chosen['accession']}-F1-model_v{ver}.pdb",
                    "licence": "CC BY 4.0",
                    "n_ca": len(d["res"]), "res": d["res"], "xyz": d["xyz"],
                    "plddt": d["b"], "seq": d["seq"],
                    "confidence_bands": {
                        "very_high_gt90": sum(1 for x in d["b"] if x > 90),
                        "confident_70_90": sum(1 for x in d["b"] if 70 < x <= 90),
                        "low_50_70": sum(1 for x in d["b"] if 50 <= x <= 70),
                        "very_low_lt50": sum(1 for x in d["b"] if x < 50),
                    },
                    "fractions_from_omics": {kk: af_omics[kk] for kk in
                                             ("fraction_plddt_gt70", "fraction_plddt_gt90", "fraction_plddt_lt50")} if af_omics else None,
                    "note": "pLDDT is AlphaFold's confidence in its own prediction, 0-100, read from the B-factor column of the deposited PDB. It is not a measurement of the protein.",
                }
                totals["with_structure"] += 1
            else:
                card["structure"] = {"absent": True,
                                     "reason": "AlphaFold DB has an entry for this accession but no model file was served",
                                     "accession": chosen["accession"], "attempts": tried}
                card["gaps"].append({"id": "no-structure-file", "what": "3D structure",
                                     "reason": card["structure"]["reason"], "source": "AlphaFold DB"})
        else:
            where = ["structures/variants/variants.json", "structures/models.json", "omics/proteomic (AlphaFold DB API)"]
            card["structure"] = {"absent": True,
                                 "reason": "no AlphaFold DB model for any UniProt entry of this gene",
                                 "where_checked": where}
            card["gaps"].append({"id": "no-structure", "what": "3D structure",
                                 "reason": "no AlphaFold DB model for any UniProt entry of this gene; nothing to draw",
                                 "source": "omics/proteomic/MANIFEST.json + structures/models.json"})
            totals["no_structure"] += 1

        # ---- the functional site and the convergence test, when this gene is the one
        if conv_gene == sym:
            card["functional_site"] = {
                "label": conv_site.get("definition"),
                "pdb_id": conv_struct.get("pdb_id"), "title": conv_struct.get("title"),
                "method": conv_struct.get("method"), "resolution_A": conv_struct.get("resolution_A"),
                "ligand": conv_struct.get("ligand"), "url": conv_struct.get("url"),
                "identity_to_zebrafish": conv_struct.get("identity_to_zebrafish_slc43a2a")
                                         or conv_struct.get("identity_to_zebrafish"),
                "reference_uniprot": conv_struct.get("reference_uniprot"),
                "positions": conv_site.get("positions"),
                "residues": conv_site.get("residues"),
                "why_this_structure": conv_struct.get("why_this_is_the_right_structure"),
            }
            card["convergence"] = {
                "substitution": conv_sub.get("id"), "numbering": conv_sub.get("numbering"),
                "what": conv_sub.get("what"), "source": conv_sub.get("source"),
                "position_on_the_structure": conv_ans.get("convergent_site_in_human_LAT4_numbering")
                                             or conv_ans.get("convergent_site_position"),
                "residue_there": conv_ans.get("residue_there"),
                "is_a_functional_site_residue": conv_ans.get("is_it_a_substrate_site_residue"),
                "distance_to_the_functional_site_A": conv_ans.get("min_distance_from_the_convergent_site_to_the_bound_substrate_A"),
                "nearest_transmembrane_segment": conv_ans.get("nearest_transmembrane_segment"),
                "geometry": conv_ans.get("geometry_of_every_position_examined"),
                "headline": conv_sum.get("headline"),
                "functional_site_invariant": conv_sum.get("substrate_site_is_invariant_between_gliders_and_nongliders"),
                "positions_that_separate_gliders": conv_sum.get("substrate_site_positions_that_separate_gliders"),
                "caveat": conv_sum.get("caveat"),
                "residue_in_each_group": conv_sub.get("residue_in_each_group"),
                "source_file": "structures/convergence-test.json",
            }
            card["gaps"].append({
                "id": "no-functional-assay",
                "what": "any measurement of what this substitution does",
                "reason": conv_sum.get("caveat") or "no functional assay exists for this substitution in any species",
                "source": "structures/convergence-test.json"})

        # ---- experimental structures
        exp_rows = by_feat.get("experimental_structure", [])
        card["experimental"] = {
            "zebrafish_entries": [{"pdb": e["pdb"], "method": e["method"], "resolution_A": e.get("resolution_A"),
                                   "uniprot": e.get("uniprot")}
                                  for r in exp_rows for e in (r.get("entries") or [])],
            "our_structures": gene_exp.get(sym, []),
        }
        if not card["experimental"]["zebrafish_entries"]:
            card["experimental"]["absent_reason"] = (
                "no experimental structure of the zebrafish protein exists. Every structure in this "
                "project's structural layer is a human or mouse protein used as a proxy, at the "
                "identity stated on it.")

        # ---- domains with positions
        doms, no_pos = [], 0
        for feat in POSITIONAL:
            for r in by_feat.get(feat, []):
                pos = r.get("positions") or []
                if not pos:
                    no_pos += 1
                doms.append({"feature": feat, "name": r["value"] if isinstance(r["value"], str) else json.dumps(r["value"]),
                             "db": r["source"]["db"], "acc": r["source"].get("accession"),
                             "url": r["source"].get("url"), "type": r.get("interpro_type"),
                             "kind": r.get("kind"), "evidence": r.get("evidence"),
                             "positions": [{"start": p.get("start"), "end": p.get("end")} for p in pos],
                             "note": r.get("note")})
        doms.sort(key=lambda d: (d["positions"][0]["start"] if d["positions"] else 10 ** 9))
        card["domains"] = doms
        if no_pos:
            card["gaps"].append({
                "id": "domains-without-positions", "what": f"{no_pos} of {len(doms)} domain annotations",
                "reason": "the InterPro API returned HTTP 204 (no match set) for this accession, so these come "
                          "from the UniProt cross-reference and carry no residue positions: they cannot be placed on the structure",
                "source": "omics/proteomic/SOURCES.md, caveat 'InterPro'"})
        if not doms:
            card["gaps"].append({"id": "no-domains", "what": "domain architecture",
                                 "reason": "no InterPro or Pfam signature matches this protein",
                                 "source": "InterPro 110.0"})

        # ---- our own residue-level sites
        sites = []
        for v in var_by_gene.get(sym, []):
            es = v.get("experimental_structure") or {}
            pc = v.get("position_check") or {}
            wp = v.get("wild_type_alphafold_plddt") or {}
            sites.append({
                "notation": v.get("notation"), "position": v.get("position"),
                "wild_type_aa": v.get("wild_type_aa"), "variant_aa": v.get("variant_aa"),
                "numbered_against": v.get("uniprot"),
                "position_check": {"ok": pc.get("ok"), "found": pc.get("uniprot_residue_at_position"),
                                   "expected": pc.get("expected"), "note": pc.get("note")},
                "plddt_at_site": wp.get("at_site"), "plddt_window_mean": wp.get("window_mean"),
                "plddt_per_residue": wp.get("per_residue"),
                "on_experimental_structure": {
                    "pdb_id": es.get("pdb_id"), "resolution_A": es.get("resolution_A"),
                    "identity_to_zebrafish": es.get("identity_zebrafish_vs_structure_protein"),
                    "mapped_position": es.get("mapped_position"),
                    "residue_in_structure": es.get("residue_in_structure"),
                    "is_an_interface_residue": es.get("is_an_interface_residue"),
                    "measured": es.get("measured"), "note": es.get("note"),
                } if es else None,
                "source": v.get("source"),
                "esmfold": v.get("esmfold"),
                "label": "STRUCTURE PREDICTION / GEOMETRY, NOT FUNCTION",
            })
        card["sites"] = sites
        if sites:
            totals["with_sites"] += 1

        # ---- PTM
        psites, borrowed, measured = [], 0, 0
        for r in ptm.get(sym, []):
            v = r.get("value")
            if not isinstance(v, dict):
                continue
            k = r.get("kind")
            if k == "borrowed-ortholog":
                borrowed += 1
            elif k in ("measured", "curated"):
                measured += 1
            psites.append({"position": v.get("zf_position") or (v.get("position") if k not in ("borrowed-ortholog",) else None),
                           "source_position": v.get("position"), "residue": v.get("zf_residue") or v.get("residue"),
                           "modification": v.get("modification"), "conservation": v.get("conservation"),
                           "kind": k, "species": r.get("species"),
                           "source_species": v.get("source_species"), "source_protein": v.get("source_protein"),
                           "db": r["source"]["db"], "url": r["source"].get("url"),
                           "evidence": r.get("evidence"), "feature": r.get("feature")})
        card["ptm"] = {"sites": psites, "n_borrowed": borrowed, "n_zebrafish": measured,
                       "flying_fish_differences": ff_by_gene.get(sym, []),
                       "flying_fish_rule": ff.get("rule"), "flying_fish_caveat": ff.get("caveat")}
        if not psites:
            card["gaps"].append({"id": "no-ptm", "what": "post-translational modification sites",
                                 "reason": "no modification site is recorded for this protein or for its human/mouse orthologue",
                                 "source": "omics/ptm (UniProt + iPTMnet)"})
        elif measured == 0:
            card["gaps"].append({"id": "ptm-all-borrowed", "what": f"all {len(psites)} modification sites",
                                 "reason": "every site here is the human or mouse orthologue's site carried over by alignment; "
                                           "no modification has been measured on the zebrafish protein",
                                 "source": "omics/ptm, kind = borrowed-ortholog"})

        # ---- interactions
        parts_i = {"experimental_zebrafish": [], "experimental_transferred": [],
                   "curated_pathway_database": [], "predicted": [], "curated_zebrafish": []}
        for r in by_feat.get("interacts_with", []):
            ic = r.get("interaction_class") or ""
            bucket = ("curated_zebrafish" if "curated" in ic and "zebrafish proteins" in ic else
                      "experimental_zebrafish" if ic.startswith("experimental (zebrafish") else
                      "experimental_transferred" if "transferred" in ic else
                      "curated_pathway_database" if "curated pathway" in ic else "predicted")
            parts_i[bucket].append({
                "partner": r["value"], "score": r.get("score"), "class": ic,
                "channels": r.get("channels"), "db": r["source"]["db"],
                "url": r["source"].get("url"), "kind": r.get("kind"),
                "evidence": r.get("evidence"), "pmid": r.get("pmid"),
                "interaction_type": r.get("interaction_type"),
                "partner_in_universe": (r.get("partner") or {}).get("in_universe"),
            })
        for b in parts_i.values():
            b.sort(key=lambda p: -(p.get("score") or 0))
        npc = one("interaction_partner_count")
        card["interactions"] = {
            "by_class": parts_i,
            "counts": {k: len(v) for k, v in parts_i.items()},
            "string_partner_count_at_0_7": (npc or {}).get("value"),
            "channel_note": "STRING channel scores are x1000 integers. '_transferred' channels are evidence from another "
                            "species carried over by orthology, not zebrafish evidence.",
            "honesty": "Only 52 of the 3,860 genes in this project have any partner whose zebrafish experiments channel "
                       "reaches 0.4. Most high-confidence STRING links here are transferred from other species or "
                       "text-mined. IntAct has only 508 zebrafish records in total, so no row means 'not curated', "
                       "never 'does not interact'.",
            "source": "omics/proteomic (STRING v12.0, IntAct via PSICQUIC 2026-11-01)",
        }
        for k, v in parts_i.items():
            iclass_tot[k] += len(v)
        if not any(parts_i.values()):
            card["gaps"].append({"id": "no-interactions", "what": "protein-protein interactions",
                                 "reason": "no STRING link at combined score >= 0.700 and no curated IntAct record for this protein",
                                 "source": "STRING v12.0 + IntAct"})
            totals["no_interactions"] += 1
        if not parts_i["experimental_zebrafish"] and not parts_i["curated_zebrafish"]:
            card["gaps"].append({"id": "no-zebrafish-experimental-interaction",
                                 "what": "experimental interaction evidence in zebrafish",
                                 "reason": "every partner shown is transferred from another species, text-mined or "
                                           "database-curated; none was measured on the zebrafish proteins",
                                 "source": "STRING v12.0 interaction_class + IntAct"})

        # ---- detection
        det = by_feat.get("protein_detected", [])
        ab = by_feat.get("protein_abundance", [])
        card["detection"] = {
            "detected": bool(det),
            "routes": sorted({r["source"]["db"] for r in det}),
            "datasets": [{"tissue": ((r.get("context") or {}).get("anatomy") or {}).get("label"),
                          "anatomy_id": ((r.get("context") or {}).get("anatomy") or {}).get("id"),
                          "ppm": r["value"], "dataset": r.get("dataset"),
                          "evidence": r.get("evidence"), "url": r["source"].get("url")} for r in ab],
            "n_datasets": len(ab),
            "caveat": "None of the 35 PaxDb zebrafish datasets is fin tissue (they are whole organism, embryo, brain, "
                      "heart, liver, muscle, gonads, eye, kidney, pancreas, spleen and one fibroblast line). "
                      "'Detected' therefore means the protein exists somewhere in the fish, never that it is in the fin.",
            "source": "omics/proteomic (PaxDb v6.1, PeptideAtlas via UniProt 2026_03)",
        }
        if not det:
            card["gaps"].append({"id": "no-protein-detection", "what": "mass-spec detection",
                                 "reason": "this protein has never been detected by mass spectrometry in any zebrafish "
                                           "PaxDb dataset and has no PeptideAtlas cross-reference",
                                 "source": "PaxDb v6.1 + PeptideAtlas"})
        has_pe1 = card["protein"]["existence_evidence"] == "PE1"
        has_intact = bool(parts_i["curated_zebrafish"])
        if not (det or has_pe1 or has_intact):
            card["gaps"].append({
                "id": "no-protein-level-evidence", "what": "any protein-level evidence at all",
                "reason": "no mass-spec detection, no UniProt PE1 'evidence at protein level', and no curated IntAct "
                          "experiment. The protein is inferred from the gene; it has never been seen.",
                "source": "omics/proteomic/SOURCES.md, detection-coverage table"})
            totals["no_protein_evidence"] += 1

        card["flying_fish_proteome"] = {
            "absent": True,
            "reason": "UniProt has no proteome for any flying fish (Exocoetidae, taxon 76072): 25 entries in the whole "
                      "family, mostly cytochrome b barcoding fragments. The Hirundichthys speculiger annotation "
                      "(Xu et al. 2021, GCA_018398805.1) is not in UniProtKB. So there is no flying-fish protein "
                      "structure, no flying-fish interaction and no flying-fish modification anywhere in this pack.",
            "what_stands_in": card["xrefs"]["flying_fish"],
            "source": "omics/proteomic/SOURCES.md + structures/models.json",
        }

        n = wgz(f"g/{sym}.json.gz", card)
        index["genes"][sym] = {
            "file": f"g/{sym}.json.gz", "bytes": n, "zfin_id": g.get("zfin_id"),
            "uniprot": g.get("uniprot"),
            "accession": card["structure"].get("accession"),
            "has_structure": "absent" not in card["structure"],
            "n_ca": card["structure"].get("n_ca", 0),
            "mean_plddt": card["structure"].get("mean_plddt"),
            "n_domains": len(doms), "n_sites": len(sites), "n_ptm": len(psites),
            "n_partners": sum(len(v) for v in parts_i.values()),
            "n_experimental_zf_partners": len(parts_i["experimental_zebrafish"]) + len(parts_i["curated_zebrafish"]),
            "detected": bool(det), "n_gaps": len(card["gaps"]),
            "gap_ids": [x["id"] for x in card["gaps"]],
            "why_in_pack": reasons.get(sym, []),
            "our_structures": [e["pdb_id"] for e in gene_exp.get(sym, [])],
            "accession_disagreement": bool(disagreement),
            "has_functional_site": "functional_site" in card,
            "has_convergence": "convergence" in card,
        }
        totals["genes"] += 1

    index["n_genes"] = totals["genes"]
    index["parts"] = {v["label"]: {"term": v["term"], "level": v["level"], "uberon": v["uberon"],
                                   "genes": v["genes"]} for v in parts.values()}
    index["global"] = {
        "counts": dict(totals), "interaction_class_totals": dict(iclass_tot),
        "interaction_honesty": "Across this project's 3,860 genes only 52 have a partner whose zebrafish experiments "
                               "channel reaches 0.4. Experimental, transferred and predicted edges must be drawn "
                               "differently or the network is a lie.",
        "fin_tissue_proteomics": "No PaxDb zebrafish dataset is fin tissue, so no abundance number in this pack is a "
                                 "fin measurement.",
        "flying_fish": "UniProt has no flying-fish proteome (25 entries in Exocoetidae, mostly barcoding fragments); "
                       "AlphaFold DB has no model for any protein of any gliding mammal in this project's panel. "
                       "A structural comparison across gliders cannot be done today.",
        "aves": "Class Aves is this project's frozen holdout. No bird sequence, structure, interaction or annotation "
                "is in this pack; rows whose species matched /Aves|bird/i were dropped at build time.",
        "convergence_headline": conv.get("headline") or conv.get("result") or None,
    }
    index["sources"] = [
        {"what": "per-gene proteomic annotations (UniProt, InterPro, Pfam, AlphaFold DB, PDB, PaxDb, PeptideAtlas, STRING v12.0, IntAct)",
         "from": "omics/proteomic/annotations.jsonl.gz", "see": "omics/proteomic/SOURCES.md"},
        {"what": "modification sites and their conservation", "from": "omics/ptm/annotations.jsonl.gz",
         "see": "omics/ptm/SOURCES.md"},
        {"what": "flying-fish residue states at modification sites", "from": "omics/ptm/flying_fish_flags.json"},
        {"what": "AlphaFold model choice, variant placements, measured distances",
         "from": "structures/models.json, structures/variants/variants.json, structures/interface-mapping.json"},
        {"what": "experimental complex coordinates", "from": "structures/chains/*.pdb.gz (already trimmed upstream)"},
        {"what": "which genes are required for or sufficient for which fin part",
         "from": "genotype/fin-subtree.full.json"},
        {"what": "coordinates", "from": "AlphaFold DB https://alphafold.ebi.ac.uk/files/AF-<ACC>-F1-model_v<N>.pdb (CC BY 4.0), cached in C:/Temp/molecular-cache/af"},
    ]
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"), ensure_ascii=False)
    log(json.dumps(index["global"]["counts"], indent=1))
    log(json.dumps(index["global"]["interaction_class_totals"], indent=1))
    log(f"index.json {os.path.getsize(os.path.join(OUT, 'index.json'))} bytes")


if __name__ == "__main__":
    main()
