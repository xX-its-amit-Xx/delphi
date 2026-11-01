#!/usr/bin/env python3
"""Build the molecular data pack served by validate-show/molecular.js.

Reads ONLY repo data (omics/, structures/, genotype/) plus AlphaFold DB / RCSB
coordinate files cached under C:/Temp/molecular-cache. Writes per-gene cards and
CA-only coordinate arrays into this directory. Nothing outside this directory is
written. Run from the repo root:

    python dashboard/public/validate-show/structures/build_pack.py [--no-fetch]

Stage 1 (this file, step "genes") resolves the gene universe and the structure
accession for each gene, and records disagreements between sources instead of
picking a winner silently.
"""
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

AVES_RE = re.compile(r"\bAves\b|\bbird", re.I)


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
    by_zfin, by_sym = {}, {}
    for g in genes:
        if g.get("zfin_id"):
            by_zfin[g["zfin_id"]] = g
        by_sym[g["symbol"]] = g

    wanted = {}
    reasons = defaultdict(set)

    cc = rj("genotype", "causal-chains.json")
    for g in cc["genes"]:
        s = g["symbol"]
        if s in by_sym:
            wanted[s] = by_sym[s]
            reasons[s].add("causal-chain gene (genotype/causal-chains.json)")

    iv = rj("genotype", "interventions.json")
    for x in iv["interventions"]:
        for tok in re.split(r"[^A-Za-z0-9]+", x.get("gene") or ""):
            if tok and tok == tok.lower() and tok in by_sym:
                wanted[tok] = by_sym[tok]
                reasons[tok].add("intervention gene (genotype/interventions.json)")

    fs = rj("genotype", "fin-subtree.full.json")
    hits = set()

    def walk(o):
        if isinstance(o, dict):
            lt = o.get("link_type") or o.get("rel") or o.get("relation")
            gg = o.get("gene") or o.get("gene_symbol")
            if gg and lt in ("required for", "sufficient for"):
                hits.add((gg, lt))
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(fs["layers"])
    for gg, lt in hits:
        zid = gg.split(":", 1)[1] if gg.startswith("ZF:") else None
        rec = by_zfin.get(zid) if zid else by_sym.get(gg)
        if rec:
            wanted[rec["symbol"]] = rec
            reasons[rec["symbol"]].add(f"{lt} a fin structure (genotype/fin-subtree.full.json)")

    return wanted, {k: sorted(v) for k, v in reasons.items()}


# -------------------------------------------------------- omics row extraction
PROT_KEEP = {
    "predicted_structure", "experimental_structure", "domain", "protein_family",
    "homologous_superfamily", "region", "motif", "site", "repeat", "zinc_finger",
    "coiled_coil", "disordered", "interacts_with", "interaction_partner_count",
    "protein_detected", "protein_abundance", "protein_length", "protein_existence",
    "subcellular_location", "protein_function", "membrane_topology",
    "uniprot_entry_status",
}


def scan_jsonl(path, symbols, keep=None):
    out = defaultdict(list)
    with gzip.open(os.path.join(ROOT, path), "rt", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            sym = (r.get("gene") or {}).get("symbol")
            if sym not in symbols:
                continue
            if keep and r.get("feature") not in keep:
                continue
            if AVES_RE.search(r.get("species") or ""):
                continue
            out[sym].append(r)
    return out


# ------------------------------------------------------------ AlphaFold fetch
def af_pdb(acc, version, no_fetch=False):
    """Return the text of the AlphaFold PDB for acc, trying model versions."""
    versions = [version] if version else []
    versions += [v for v in (6, 5, 4) if v not in versions]
    for v in versions:
        name = f"AF-{acc}-F1-model_v{v}.pdb"
        fp = os.path.join(AF_CACHE, name)
        if os.path.exists(fp) and os.path.getsize(fp) > 0:
            with open(fp, encoding="utf-8") as f:
                return f.read(), v
        if no_fetch:
            continue
        url = f"https://alphafold.ebi.ac.uk/files/{name}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DELPHI-validate-show/1.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                txt = resp.read().decode("utf-8", "replace")
            with open(fp, "w", encoding="utf-8") as f:
                f.write(txt)
            log(f"  fetched {name} ({len(txt)} bytes)")
            time.sleep(0.15)
            return txt, v
        except Exception as e:  # noqa: BLE001
            log(f"  miss {name}: {e}")
    return None, None


AA3 = {
    "ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C", "GLN": "Q",
    "GLU": "E", "GLY": "G", "HIS": "H", "ILE": "I", "LEU": "L", "LYS": "K",
    "MET": "M", "PHE": "F", "PRO": "P", "SER": "S", "THR": "T", "TRP": "W",
    "TYR": "Y", "VAL": "V", "SEC": "U", "PYL": "O", "MSE": "M",
}


def parse_ca(text, chains=None):
    """CA-only parse of a PDB. Returns {chain: {'res':[...], 'xyz':[...], 'b':[...], 'seq':str}}."""
    out = {}
    seen = set()
    for line in text.splitlines():
        if line.startswith("ENDMDL"):
            break
        if not line.startswith(("ATOM", "HETATM")):
            continue
        if line[12:16].strip() != "CA":
            continue
        ch = line[21]
        if chains and ch not in chains:
            continue
        resn = line[17:20].strip().upper()
        aa = AA3.get(resn)
        if aa is None:
            continue
        key = (ch, line[22:27])
        if key in seen:
            continue
        seen.add(key)
        d = out.setdefault(ch, {"res": [], "xyz": [], "b": [], "seq": ""})
        try:
            d["res"].append(int(line[22:26]))
            d["xyz"] += [round(float(line[30:38]), 1), round(float(line[38:46]), 1), round(float(line[46:54]), 1)]
            d["b"].append(round(float(line[60:66]), 1))
        except ValueError:
            d["res"].pop() if len(d["res"]) > len(d["b"]) else None
            continue
        d["seq"] += aa
    return out


def wgz(relpath, obj):
    fp = os.path.join(OUT, relpath)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    raw = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as z:
        z.write(raw)
    data = buf.getvalue()
    with open(fp, "wb") as f:
        f.write(data)
    return len(data)


if __name__ == "__main__":
    u, reasons = gene_universe()
    log(f"gene universe: {len(u)} genes")
    json.dump({"n": len(u), "genes": sorted(u), "reasons": reasons},
              open(os.path.join(CACHE, "work", "universe.json"), "w", encoding="utf-8"), indent=1)
    log("wrote", os.path.join(CACHE, "work", "universe.json"))
