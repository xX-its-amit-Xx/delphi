#!/usr/bin/env python3
"""The three flight figures, drawn only from dashboard/figures/cache/*.json.

Every number on these figures came out of a public API call that fetch_sources.py made and
recorded with its URL and retrieval time. Nothing is filled in from memory: if the cache has
no value for a cell, the cell says so and the figure keeps the gap visible.

What is measured and what is drawn for orientation is stated on each figure.

    python dashboard/figures/make_flight_figures.py           # all three
    python dashboard/figures/make_flight_figures.py tree      # one
Writes dashboard/public/deck/fig/*.png and appends to fig/manifest.json.
"""
from __future__ import annotations

import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = HERE / "cache"
OUT = ROOT / "dashboard/public/deck/fig"
OUT.mkdir(parents=True, exist_ok=True)

# validated categorical palette (dataviz skill); text wears ink tokens, never series colour
S1, S2, S3, S4 = "#2a78d6", "#eb6834", "#1baf7a", "#6250d6"
INK, MUTE, GRID, SURFACE = "#14201f", "#5a6b69", "#e2e6e4", "#fcfcfb"

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "font.family": "DejaVu Sans", "font.size": 11,
    "axes.edgecolor": GRID, "axes.labelcolor": INK, "text.color": INK,
    "xtick.color": MUTE, "ytick.color": MUTE,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
})

manifest: list[dict] = []


def load(name: str):
    return json.loads((CACHE / name).read_text(encoding="utf8"))


def record(path: Path, shows: str, provenance: str, kind: str) -> None:
    b = path.read_bytes()
    manifest.append({"file": "fig/" + path.name, "shows": shows, "provenance": provenance,
                     "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b), "kind": kind})
    print("  %s: %d KB" % (path.name, len(b) // 1024))


# Flight mode is the one label on these figures that no API returns. It is a literature-level
# category (powered flapping flight / gliding on a membrane or fin / neither) and every figure
# says so where it is used.
MODE = {"diptera": "powered", "arachnida": "none", "exocoetidae": "gliding",
        "belonidae": "none", "aves": "powered", "crocodylia": "none",
        "chiroptera": "powered", "felidae": "none", "pteromyini": "gliding",
        "sciurini": "none", "cynocephalidae": "gliding", "hominidae": "none"}
MODE_COLOUR = {"powered": S2, "gliding": S3, "none": MUTE}
MODE_LABEL = {"powered": "powered flight", "gliding": "gliding", "none": "neither"}

LABEL = {"diptera": "Diptera", "arachnida": "Arachnida", "exocoetidae": "Exocoetidae",
         "belonidae": "Belonidae", "aves": "Aves", "crocodylia": "Crocodylia",
         "chiroptera": "Chiroptera", "felidae": "Felidae", "pteromyini": "Pteromyini",
         "sciurini": "Sciurini", "cynocephalidae": "Cynocephalidae", "hominidae": "Hominidae"}
COMMON = {"diptera": "flies", "arachnida": "spiders, mites", "exocoetidae": "flying fishes",
          "belonidae": "needlefishes", "aves": "birds", "crocodylia": "crocodilians",
          "chiroptera": "bats", "felidae": "cats", "pteromyini": "flying squirrels",
          "sciurini": "tree squirrels", "cynocephalidae": "colugos",
          "hominidae": "great apes"}


def build_tree():
    """The nesting NCBI Taxonomy puts these taxa in: each tip's own lineage, pruned to the
    nodes that actually branch among our tips. Nothing about it is estimated by us."""
    tx = load("ncbi_taxonomy.json")
    names = load("ncbi_lineage_names.json")
    tips = [k for k in tx if tx[k].get("lineage")]
    paths = {k: list(tx[k]["lineage"]) + [tx[k]["taxid"]] for k in tips}

    depth, below = {}, defaultdict(set)
    for k, lin in paths.items():
        for d, i in enumerate(lin):
            depth[i] = max(depth.get(i, 0), d)
            below[i].add(k)

    # one node per distinct set of tips below it: the deepest such node, i.e. the MRCA
    mrca = {}
    for i, s in below.items():
        if len(s) < 2:
            continue
        fs = frozenset(s)
        if fs not in mrca or depth[i] > depth[mrca[fs]]:
            mrca[fs] = i
    internal = sorted(mrca.values(), key=lambda i: depth[i])

    def parent_of(node_tips: frozenset, self_id=None):
        best, bd = None, -1
        for fs, i in mrca.items():
            if i == self_id or not node_tips < fs:
                continue
            if depth[i] > bd:
                best, bd = i, depth[i]
        return best

    children = defaultdict(list)
    root = internal[0]
    for i in internal[1:]:
        children[parent_of(frozenset(below[i]), i)].append(i)
    for k in tips:
        children[parent_of(frozenset([k]))].append(k)

    # level = steps from the root, used as the cladogram's x axis (topology only)
    level = {root: 0}
    order: list[str] = []

    def dfs(n):
        kids = children.get(n, [])
        if not kids:
            order.append(n)
            return
        # tips first, then larger subclades: keeps sister pairs adjacent and branches uncrossed
        for c in sorted(kids, key=lambda c: (c in internal, len(below[c]) if c in internal else 0)):
            level[c] = level[n] + 1
            dfs(c)

    dfs(root)
    nm = {i: (names.get(str(i), {}).get("name") or str(i)) for i in internal}
    rk = {i: (names.get(str(i), {}).get("rank") or "") for i in internal}
    return {"root": root, "children": children, "internal": internal, "level": level,
            "tip_order": order, "name": nm, "rank": rk, "below": below, "n_tips": len(tips)}


def ma_range(p: dict) -> str:
    hi, lo = p.get("firstapp_max_ma"), p.get("firstapp_min_ma")
    if hi is None or lo is None:
        return "not established"
    return "%g–%g" % (hi, lo)


# ===================================================================== 1. the cladogram
def fig_tree() -> None:
    t = build_tree()
    gen = load("ncbi_genomes.json")
    pbdb = load("pbdb_appearances.json")
    tips = t["tip_order"]
    y = {k: len(tips) - 1 - i for i, k in enumerate(tips)}

    maxlev = max(t["level"][i] for i in t["internal"])
    X0, X1 = 1.0, 30.0
    xi = {i: X0 + (X1 - X0) * t["level"][i] / (maxlev + 1) for i in t["internal"]}
    XTIP = X1

    fig, ax = plt.subplots(figsize=(13.2, 7.6))
    ax.set_xlim(0, 100)
    ax.set_ylim(-1.9, len(tips) + 1.45)
    ax.axis("off")

    def ynode(n):
        if n in y:
            return y[n]
        kids = t["children"][n]
        return sum(ynode(c) for c in kids) / len(kids)

    # branches: horizontal stem per node, vertical connector spanning its children
    for i in t["internal"]:
        kids = t["children"][i]
        ys = [ynode(c) for c in kids]
        ax.plot([xi[i], xi[i]], [min(ys), max(ys)], color="#b9c2bf", lw=1.6,
                solid_capstyle="round", zorder=2)
        for c in kids:
            xc = xi[c] if c in xi else XTIP
            cl = MODE_COLOUR[MODE[c]] if c in MODE else "#b9c2bf"
            lw = 2.6 if (c in MODE and MODE[c] != "none") else 1.6
            ax.plot([xi[i], xc], [ynode(c), ynode(c)], color=cl, lw=lw,
                    solid_capstyle="round", zorder=3 if lw > 2 else 2)
        if i != t["root"]:
            ax.plot([xi[i] - 0.0, xi[i]], [ynode(i), ynode(i)], color="#b9c2bf", lw=1.6)
    # root stub
    ax.plot([X0 - 1.0, X0], [ynode(t["root"])] * 2, color="#b9c2bf", lw=1.6)

    # Internal node names go in the blank half-rows between tips, never on a branch line.
    # Two labels that would collide in the same band are pushed down a band; the bands are
    # blank by construction, so this cannot put a label on a branch either.
    PT_PER_UNIT = (13.2 * 0.983) * 72 / 100.0   # axes width in points, per x unit
    placed: list[tuple[float, float, float]] = []   # (band, x0, x1)
    for i in sorted(t["internal"], key=lambda n: -max(y[k] for k in t["below"][n])):
        name = t["name"][i]
        x0 = xi[i] + 0.35
        x1 = x0 + len(name) * 5.05 / PT_PER_UNIT
        band = max(y[k] for k in t["below"][i]) + 0.5
        while any(abs(b - band) < 1e-6 and x0 < px1 + 0.6 and px0 < x1 + 0.6
                  for b, px0, px1 in placed):
            band -= 1.0
        placed.append((band, x0, x1))
        ax.text(x0, band, name, fontsize=8.4, color=MUTE, ha="left", va="center", zorder=6)

    # the mark that carries the message: one dot per flying or gliding lineage
    for k in tips:
        if MODE[k] == "none":
            continue
        ax.plot([XTIP], [y[k]], marker="o", ms=10, mfc=MODE_COLOUR[MODE[k]],
                mec=SURFACE, mew=1.6, zorder=7, ls="none")

    # ---- columns to the right of the tree
    CX = {"name": 32.0, "mode": 54.0, "asm": 82.0, "fossil": 99.0}
    for k in tips:
        yy = y[k]
        bold = MODE[k] != "none"
        ax.text(CX["name"], yy, LABEL[k], fontsize=10.5, va="center", ha="left",
                color=INK, fontweight="bold" if bold else "normal")
        ax.text(CX["name"] + 0.3, yy - 0.42, COMMON[k], fontsize=8.6, va="center",
                ha="left", color=MUTE, style="italic")
        ax.text(CX["mode"], yy, MODE_LABEL[MODE[k]], fontsize=9.6, va="center", ha="left",
                color=MODE_COLOUR[MODE[k]], fontweight="bold" if bold else "normal")
        a = gen[k]["assemblies"]["total_count"]
        ax.text(CX["asm"], yy, "{:,}".format(a) if a is not None else "not retrieved",
                fontsize=9.8, va="center", ha="right", color=INK if bold else MUTE,
                fontweight="bold" if bold else "normal")
        ax.text(CX["fossil"], yy, ma_range(pbdb[k]), fontsize=9.8, va="center", ha="right",
                color=INK if bold else MUTE)

    # column headers, with the measured/orientation split spelled out
    hy = len(tips) + 0.78
    ax.text(X0 - 1.0, hy, "NCBI Taxonomy nesting  — orientation", fontsize=9,
            color=MUTE, ha="left", va="bottom", fontweight="bold")
    ax.text(CX["name"], hy, "lineage", fontsize=9, color=MUTE, ha="left", va="bottom",
            fontweight="bold")
    ax.text(CX["mode"], hy, "moves through air", fontsize=9, color=MUTE, ha="left",
            va="bottom", fontweight="bold")
    ax.text(CX["asm"], hy, "genome assemblies", fontsize=9, color=MUTE, ha="right",
            va="bottom", fontweight="bold")
    ax.text(CX["fossil"], hy, "oldest fossil, Ma", fontsize=9, color=MUTE, ha="right",
            va="bottom", fontweight="bold")
    ax.plot([X0 - 1.0, 99.5], [hy - 0.22] * 2, color=GRID, lw=1.1, zorder=1)

    n_pow = sum(1 for k in tips if MODE[k] == "powered")
    n_gl = sum(1 for k in tips if MODE[k] == "gliding")
    ax.legend(handles=[
        Line2D([], [], marker="o", ms=9, mfc=S2, mec=SURFACE, ls="none",
               label="powered flapping flight (%d lineages here)" % n_pow),
        Line2D([], [], marker="o", ms=9, mfc=S3, mec=SURFACE, ls="none",
               label="gliding on a membrane or fin (%d)" % n_gl),
        Line2D([], [], color="#b9c2bf", lw=1.6, label="branch of the NCBI nesting"),
    ], frameon=False, fontsize=9.4, loc="lower left",
        bbox_to_anchor=(0.01, -0.005), ncol=3, handletextpad=0.6, columnspacing=2.2)

    fig.suptitle("Flight and gliding sit on six separate branches, each with a non-flying "
                 "sister group beside it.",
                 fontsize=14, fontweight="bold", ha="left", x=0.045, y=0.975)
    fig.text(0.045, 0.932,
             "Nowhere on this tree do the six group together. Each one's nearest relative "
             "here does not fly — so a wing in one lineage is not the wing in another.",
             fontsize=10.6, color=MUTE, ha="left")
    fig.text(0.045, 0.028,
             "MEASURED: assembly counts, NCBI Datasets v2 genome/taxon dataset_report, "
             "retrieved %s. Oldest fossil occurrence, Paleobiology Database data1.2 "
             "taxa/single show=app, same day.\n"
             "DRAWN FOR ORIENTATION: the topology is NCBI Taxonomy's nested classification, "
             "not a dated phylogeny — no branch lengths, no divergence times, and the\n"
             "horizontal axis means nothing. “Moves through air” is a literature category, "
             "not an API value. Every URL and retrieval time is in dashboard/figures/DATA.md."
             % _ret(gen["aves"]["assemblies"]),
             fontsize=8.4, color=MUTE, ha="left", va="bottom", linespacing=1.5)

    fig.subplots_adjust(left=0.012, right=0.995, top=0.895, bottom=0.155)
    p = OUT / "flight_cladogram.png"
    fig.savefig(p, dpi=170)
    plt.close(fig)
    record(p, "Cladogram of 12 taxa in NCBI Taxonomy's nesting, with the six flying or "
              "gliding lineages marked and their genome-assembly counts and oldest PBDB "
              "fossil occurrence beside them",
           "NCBI Datasets v2 taxonomy/taxon (topology and taxids) and genome/taxon "
           "dataset_report (assembly counts); Paleobiology Database data1.2 taxa/single "
           "show=app (first appearance). All calls logged in dashboard/figures/DATA.md and "
           "cached under dashboard/figures/cache/",
           "cladogram: topology drawn from NCBI Taxonomy for orientation, annotations measured")


def _ret(d: dict) -> str:
    return (d.get("retrieved") or "")[:10]


# ===================================================================== 2. the data gaps
def fig_gaps() -> None:
    gen = load("ncbi_genomes.json")
    cov = load("orthodb_coverage.json")
    t = build_tree()
    tips = t["tip_order"]

    rows = []
    for k in tips:
        a = gen[k]["assemblies"]["total_count"]
        r = gen[k]["reference_genomes"]["total_count"]
        if a is None:
            continue
        rows.append((k, a, r))
    rows.sort(key=lambda r: r[1])

    fig, ax = plt.subplots(figsize=(12.4, 7.2))
    ys = list(range(len(rows)))
    for yy, (k, a, r) in zip(ys, rows):
        c = MODE_COLOUR[MODE[k]]
        ax.plot([0.75, a], [yy, yy], color=c, lw=2.0, alpha=0.30, solid_capstyle="round",
                zorder=2)
        ax.plot([a], [yy], marker="o", ms=11, mfc=c, mec=SURFACE, mew=1.5, ls="none",
                zorder=5)
        if r is not None:
            ax.plot([r], [yy], marker="|", ms=13, mec=INK, mew=1.9, ls="none", zorder=6)

    ax.set_yticks(ys)
    ax.set_yticklabels(["%s  (%s)" % (LABEL[k], COMMON[k]) for k, _a, _r in rows],
                       fontsize=10.2)
    for lab, (k, _a, _r) in zip(ax.get_yticklabels(), rows):
        lab.set_color(INK if MODE[k] != "none" else MUTE)
        if MODE[k] != "none":
            lab.set_fontweight("bold")
    ax.set_xscale("log")
    ax.set_xlim(0.6, 20000)
    ax.set_ylim(-0.9, len(rows) - 0.25)
    ax.set_xlabel("genome assemblies in NCBI under the taxon (log scale)")
    ax.grid(axis="y", visible=False)
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0)

    # direct labels on the marks, placed away from the axis edge
    for yy, (k, a, r) in zip(ys, rows):
        txt = "{:,}".format(a)
        if a < 400:
            ax.annotate(txt, xy=(a, yy), xytext=(11, 0), textcoords="offset points",
                        fontsize=9.8, va="center", ha="left", color=INK,
                        fontweight="bold" if MODE[k] != "none" else "normal")
        else:
            ax.annotate(txt, xy=(a, yy), xytext=(-11, 0), textcoords="offset points",
                        fontsize=9.8, va="center", ha="right", color=INK,
                        fontweight="bold" if MODE[k] != "none" else "normal")

    # Callouts go in the empty right-hand half of the three lowest rows, so that no box ever
    # covers a mark or a row label.
    exo = gen["exocoetidae"].get("example_assembly") or {}
    y_exo = [yy for yy, (k, _a, _r) in zip(ys, rows) if k == "exocoetidae"][0]
    ax.annotate("the only flying-fish assembly:\n%s, %s\n%s level, scaffold N50 %s"
                % (exo.get("organism", "?"), exo.get("accession", "?"),
                   exo.get("level", "?"),
                   "{:,}".format(int(exo["scaffold_n50"])) if exo.get("scaffold_n50")
                   else "not retrieved"),
                xy=(1, y_exo), xytext=(22, y_exo + 0.72), textcoords="data",
                fontsize=9.2, color=INK, ha="left", va="center",
                bbox=dict(boxstyle="round,pad=0.45", fc="#f2f5f3", ec=GRID, lw=1.0),
                arrowprops=dict(arrowstyle="-", color=MUTE, lw=1.0,
                                connectionstyle="angle3,angleA=0,angleB=70"))

    bel = cov["clades"]["belonoidei"]
    av = cov["clades"]["aves"]
    ax.annotate("annotated genomes in OrthoDB:\n%d species of birds, %d for the whole\n"
                "suborder Belonoidei that the flying\nfishes belong to"
                % (av["n_orthodb_species"], bel["n_orthodb_species"]),
                xy=(0.985, 0.40), xycoords="axes fraction", fontsize=9.4, color=INK,
                ha="right", va="center",
                bbox=dict(boxstyle="round,pad=0.5", fc="#f2f5f3", ec=GRID, lw=1.0))

    # legend above the plot: inside it there is no band wide enough to hold it cleanly
    ax.legend(handles=[
        Line2D([], [], marker="o", ms=10, mfc=S2, mec=SURFACE, ls="none",
               label="powered flight"),
        Line2D([], [], marker="o", ms=10, mfc=S3, mec=SURFACE, ls="none", label="gliding"),
        Line2D([], [], marker="o", ms=10, mfc=MUTE, mec=SURFACE, ls="none", label="neither"),
        Line2D([], [], marker="|", ms=12, mec=INK, mew=1.9, ls="none",
               label="of which NCBI flags reference_only"),
    ], frameon=False, fontsize=9.4, loc="lower left", bbox_to_anchor=(-0.005, 1.005), ncol=4,
        handletextpad=0.5, columnspacing=2.4)

    fig.suptitle("Birds have %s genome assemblies. The flying fishes have one, and it is a "
                 "scaffold." % "{:,}".format(gen["aves"]["assemblies"]["total_count"]),
                 fontsize=14, fontweight="bold", ha="left", x=0.055, y=0.983)
    fig.text(0.055, 0.925,
             "The clade Darwin's claim is actually about is the worst sampled on this chart "
             "by three orders of magnitude.",
             fontsize=10.6, color=MUTE, ha="left")
    fig.text(0.055, 0.022,
             "MEASURED: every count is one NCBI Datasets v2 genome/taxon dataset_report call "
             "— total_count, and the same call with filters.reference_only=true — retrieved "
             "%s.\nThe OrthoDB species counts are the union of /orthologs responses "
             "restricted to each clade. All URLs and retrieval times in "
             "dashboard/figures/DATA.md.\nAn assembly count is sampling effort, not "
             "diversity: these taxa hold very different numbers of species."
             % _ret(gen["aves"]["assemblies"]),
             fontsize=8.4, color=MUTE, ha="left", va="bottom", linespacing=1.5)

    fig.subplots_adjust(left=0.215, right=0.985, top=0.845, bottom=0.175)
    p = OUT / "flight_assembly_gap.png"
    fig.savefig(p, dpi=170)
    plt.close(fig)
    record(p, "Genome assemblies per taxon on a log scale for the 12 flight figure taxa: "
              "Aves %s against Exocoetidae 1 (scaffold level), with the reference_only "
              "subset marked"
           % "{:,}".format(gen["aves"]["assemblies"]["total_count"]),
           "NCBI Datasets v2 genome/taxon dataset_report, total_count and "
           "filters.reference_only=true, per taxid; OrthoDB /orthologs per clade for the "
           "annotated-genome counts. Logged in dashboard/figures/DATA.md",
           "plot from measured data")


# ===================================================================== 3. the gene matrix
def fig_genes() -> None:
    odb = load("orthodb_groups.json")
    up = load("uniprot_presence.json")
    cov = load("orthodb_coverage.json")
    spec = odb["_meta"]["species"]
    genes = [g for g in odb["genes"].values() if g.get("orthogroup")]
    dropped = [g for g in odb["genes"].values() if not g.get("orthogroup")]
    if not genes:
        print("  no orthogroup resolved cleanly: figure 3 skipped")
        return

    ncol, nrow = len(spec), len(genes)
    fig, ax = plt.subplots(figsize=(14.2, 8.2))
    ax.set_xlim(-0.5, ncol - 0.5)
    ax.set_ylim(nrow + 0.95, -1.95)        # inverted: room above for headers, below for a note
    ax.axis("off")

    def fam_colour(g):
        return S1 if g["gene_class"].startswith("vertebrate") else S4

    for yy, g in enumerate(genes):
        base = fam_colour(g)
        for xx, s in enumerate(spec):
            hit = (g.get("per_taxid") or {}).get(str(s["taxid"]))
            n = hit["n_genes"] if hit else 0
            fc = base if n else "#f1f4f2"
            ax.add_patch(plt.Rectangle((xx - 0.46, yy - 0.40), 0.92, 0.80, fc=fc,
                                       ec=SURFACE, lw=1.6, alpha=0.92 if n else 1.0,
                                       zorder=2))
            ax.text(xx, yy, str(n), ha="center", va="center", fontsize=11.5,
                    color="white" if n else "#aab4b1", fontweight="bold", zorder=3)

    # the flying-fish column is empty because OrthoDB has no genome for it; say so, on it
    fx = next(i for i, s in enumerate(spec) if s["key"] == "hirundichthys")
    ax.add_patch(plt.Rectangle((fx - 0.49, -0.46), 0.98, nrow - 0.08, fc="none", ec=S2,
                               lw=2.0, ls=(0, (4, 2.5)), zorder=4))

    # ---- row labels: gene, then the InterPro domain OrthoDB counts most often in the group
    for yy, g in enumerate(genes):
        base = fam_colour(g)
        ipr = (g.get("top_interpro") or {}).get("description") or (g.get("group_name") or "")
        if len(ipr) > 46:
            ipr = ipr[:45].rstrip(" ,") + "…"
        ax.text(-0.62, yy - 0.16, g["gene"], ha="right", va="center", fontsize=12.5,
                color=INK, fontweight="bold")
        ax.text(-0.62, yy + 0.22, ipr, ha="right", va="center", fontsize=8.0, color=base)

    # ---- column headers: species, the clade it stands for, how that clade moves
    for xx, s in enumerate(spec):
        parts = s["name"].split()
        short = parts[0][0] + ". " + " ".join(parts[1:]) if len(parts) > 1 else s["name"]
        clade, _, mode_txt = s["role"].partition(" - ")
        mode = ("powered" if "powered" in mode_txt else
                "gliding" if "gliding" in mode_txt else "none")
        flying = mode != "none"
        ax.text(xx, -0.70, short, ha="center", va="bottom", fontsize=9.9, color=INK,
                style="italic", fontweight="bold" if flying else "normal")
        ax.text(xx, -1.10, clade, ha="center", va="bottom", fontsize=8.6, color=MUTE)
        ax.text(xx, -1.48, MODE_LABEL[mode] if flying else "no flight", ha="center",
                va="bottom", fontsize=8.8, color=MODE_COLOUR[mode],
                fontweight="bold" if flying else "normal")

    bel = cov["clades"]["belonoidei"]
    assert bel["n_orthodb_species"] == 0, "Belonoidei now has an OrthoDB genome: redo this note"
    ax.annotate("OrthoDB has no annotated genome for any flying fish — nor for any "
                "species of Belonoidei, the suborder it belongs to.\nThe column is empty for "
                "that reason, not because the genes are absent from flying fishes.",
                xy=(fx, nrow - 0.44), xytext=(fx, nrow + 0.30), textcoords="data",
                ha="center", va="center", fontsize=9.2, color=INK, linespacing=1.5,
                bbox=dict(boxstyle="round,pad=0.5", fc="#fdf1ea", ec=S2, lw=1.2),
                arrowprops=dict(arrowstyle="-", color=S2, lw=1.2))

    fig.legend(handles=[
        Line2D([], [], marker="s", ms=11, mfc=S1, mec=SURFACE, ls="none",
               label="vertebrate limb / axial gene family"),
        Line2D([], [], marker="s", ms=11, mfc=S4, mec=SURFACE, ls="none",
               label="insect wing gene family"),
        Line2D([], [], marker="s", ms=11, mfc="#f1f4f2", mec="#dde3e0", ls="none",
               label="no gene of that species in the group"),
    ], frameon=False, fontsize=9.6, loc="lower left", bbox_to_anchor=(0.052, 0.845),
        ncol=3, handletextpad=0.5, columnspacing=2.4)

    fig.suptitle("Every one of these gene families is shared across flying and non-flying "
                 "animals alike.",
                 fontsize=14, fontweight="bold", ha="left", x=0.052, y=0.982)
    def fly_n(g):
        hit = (g.get("per_taxid") or {}).get("7227")
        return hit["n_genes"] if hit else 0

    vert = [g for g in genes if g["gene_class"].startswith("vertebrate")]
    ins = [g for g in genes if g["gene_class"].startswith("insect")]
    n_ins_with_vert = sum(
        1 for g in ins
        if any(((g.get("per_taxid") or {}).get(str(s["taxid"])) or {}).get("n_genes")
               for s in spec if s["key"] in ("human", "gallus", "myotis", "danio")))
    n_vert_no_fly = sum(1 for g in vert if fly_n(g) == 0)

    fig.text(0.052, 0.952,
             "Cells count the genes each species puts into the OrthoDB Metazoa orthogroup "
             "that the named protein belongs to. All %d of the fly's wing genes have "
             "vertebrate\nrelatives; %d of the %d limb and axial genes have no fly relative "
             "in their own family. A wing is not a gene set, and a fin is not a missing one."
             % (n_ins_with_vert, n_vert_no_fly, len(vert)),
             fontsize=10.4, color=MUTE, ha="left", va="top", linespacing=1.55)

    half = (len(genes) + 1) // 2
    seeds = ["; ".join("%s %s→%s" % (g["gene"], g["seed_uniprot"], g["orthogroup"])
                       for g in genes[i:i + half]) for i in (0, half)]
    note = ("MEASURED: seed accessions from UniProtKB REST, reviewed entries only; the "
            "orthogroup from OrthoDB /search on that accession at level Metazoa (33208); "
            "cell values from OrthoDB /orthologs for that group, retrieved %s.\n"
            "Row subtitles are the InterPro domain OrthoDB counts most often in the group.  "
            "Seed → orthogroup:  %s;\n    %s.\n"
            "WHAT THIS IS NOT: an OrthoDB Metazoa-level group is a gene family, not a set of "
            "one-to-one orthologs, and a 0 means no gene of that species in that group "
            "— not that the species lacks a homologue anywhere."
            % (_ret(odb["_meta"]), seeds[0], seeds[1]))
    if dropped:
        note += ("\nDROPPED: " + "; ".join(
            "%s — %s" % (d["gene"], d.get("note", "no single orthogroup"))
            for d in dropped))
    fig.text(0.052, 0.018, note, fontsize=8.0, color=MUTE, ha="left", va="bottom",
             linespacing=1.5)

    fig.subplots_adjust(left=0.262, right=0.99, top=0.815, bottom=0.195)
    p = OUT / "flight_gene_families.png"
    fig.savefig(p, dpi=170)
    plt.close(fig)

    n_up = sum(1 for c in up["cells"].values() if c.get("n_hits"))
    record(p, "Genes per species in the OrthoDB Metazoa orthogroup of %d seed proteins "
              "across %d species: every family, insect wing genes included, has members in "
              "both flying and non-flying animals, and the flying-fish column is empty "
              "because OrthoDB has no annotated Exocoetidae genome" % (len(genes), len(spec)),
           "UniProtKB REST search (reviewed) for the seed accessions (%d of 64 gene x species "
           "queries returned a reviewed entry); OrthoDB /search, /group and /orthologs at "
           "level Metazoa 33208. Logged in dashboard/figures/DATA.md" % n_up,
           "matrix of OrthoDB orthogroup membership: measured counts, not a one-to-one "
           "orthology claim")

# ===================================================================== manifest
def merge_manifest() -> None:
    mp = OUT / "manifest.json"
    existing = json.loads(mp.read_text(encoding="utf8")) if mp.exists() else []
    by = {m["file"]: m for m in existing}
    for m in manifest:
        by[m["file"]] = m
    mp.write_text(json.dumps(list(by.values()), indent=1), encoding="utf8")
    print("manifest: %d figures" % len(by))


if __name__ == "__main__":
    steps = {"tree": fig_tree, "gaps": fig_gaps, "genes": fig_genes}
    for s in (sys.argv[1:] or list(steps)):
        print("[" + s + "]")
        steps[s]()
    merge_manifest()
