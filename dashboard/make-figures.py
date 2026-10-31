#!/usr/bin/env python3
"""Generate figures from this project's own analysis outputs.

Every point is read from a derived file that a pre-registered test wrote. Nothing is simulated
for the picture. Each figure shows what the law predicts against what the data does, because
that contrast is the finding.

    python dashboard/make-figures.py
Writes dashboard/public/deck/fig/*.png and appends to fig/manifest.json.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
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

manifest = []


def record(path: Path, shows: str, provenance: str):
    b = path.read_bytes()
    manifest.append({
        "file": "fig/" + path.name, "shows": shows, "provenance": provenance,
        "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b),
        "kind": "figure generated from this project's own analysis output",
    })
    print(f"  {path.name}: {len(b)//1024} KB")


def ols(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx
    return b, my - b * mx


# ---------------------------------------------------------------- Lewontin's paradox
src = ROOT / "claim-tests/math-bio-theorems/kimura-heterozygosity/derived/species_table.csv"
if src.exists():
    xs, ys, held = [], [], []
    with src.open(encoding="utf8") as f:
        for r in csv.DictReader(f):
            try:
                d = float(r["diversity"]); p = float(r["log10_popsize"])
            except (ValueError, KeyError, TypeError):
                continue
            if d <= 0:
                continue
            xs.append(p); ys.append(math.log10(d))
            held.append(str(r.get("held_out", "")).lower() == "true")

    b, a = ols(xs, ys)
    fig, ax = plt.subplots(figsize=(8.6, 5.0))
    ax.scatter([x for x, h in zip(xs, held) if not h], [y for y, h in zip(ys, held) if not h],
               s=26, c=S1, alpha=0.65, linewidths=0, label=f"{sum(1 for h in held if not h)} species")
    if any(held):
        ax.scatter([x for x, h in zip(xs, held) if h], [y for y, h in zip(ys, held) if h],
                   s=30, facecolors="none", edgecolors=S4, linewidths=1.2,
                   label=f"{sum(held)} held out")

    lo, hi = min(xs), max(xs)
    mid_x, mid_y = sum(xs) / len(xs), sum(ys) / len(ys)
    ax.plot([lo, hi], [a + b * lo, a + b * hi], color=S2, lw=2.4, zorder=5)
    ax.plot([lo, hi], [mid_y + 1.0 * (lo - mid_x), mid_y + 1.0 * (hi - mid_x)],
            color=MUTE, lw=2, ls=(0, (6, 4)), zorder=4)

    ax.annotate(f"what the data does\nslope {b:.3f}", xy=(hi, a + b * hi), xytext=(-8, 18),
                textcoords="offset points", ha="right", color=S2, fontweight="bold", fontsize=11)
    ax.annotate("what the law predicts\nslope 1", xy=(hi, mid_y + 1.0 * (hi - mid_x)),
                xytext=(-8, -4), textcoords="offset points", ha="right", va="top",
                color=MUTE, fontweight="bold", fontsize=11)

    ax.set_xlabel("log₁₀ census population size")
    ax.set_ylabel("log₁₀ genetic diversity (π)")
    ax.set_title("Neutral theory predicts diversity rises with population size.\nAcross animals, it barely does.",
                 fontsize=12.5, fontweight="bold", loc="left", pad=10)
    ax.legend(frameon=False, loc="lower right", fontsize=10)
    fig.tight_layout()
    p = OUT / "lewontin_paradox.png"
    fig.savefig(p, dpi=170); plt.close(fig)
    record(p, f"Genetic diversity against population size for {len(xs)} animal species: observed slope {b:.3f} against the predicted 1",
           "our own claim test kimura-heterozygosity, from derived/species_table.csv (Buffalo 2021 compilation; Corbett-Detig and Romiguier sources)")

# ---------------------------------------------------------------- Thompson's cube law
src2 = ROOT / "claim-tests/thompson-growth-form/thompson1917-ch03-07/derived/age_bins.csv"
if src2.exists():
    rows = list(csv.DictReader(src2.open(encoding="utf8")))
    cols = rows[0].keys() if rows else []
    hcol = next((c for c in cols if "height" in c.lower() or "stature" in c.lower()), None)
    wcol = next((c for c in cols if "weight" in c.lower() or "mass" in c.lower()), None)
    acol = next((c for c in cols if "age" in c.lower()), None)
    scol = next((c for c in cols if "sex" in c.lower()), None)

    if hcol and wcol:
        fig, ax = plt.subplots(figsize=(8.6, 5.0))
        series = {}
        for r in rows:
            try:
                h, w = float(r[hcol]), float(r[wcol])
            except (ValueError, TypeError):
                continue
            if h <= 0 or w <= 0:
                continue
            series.setdefault(r.get(scol, "all") if scol else "all", []).append(
                (math.log10(h), math.log10(w), float(r[acol]) if acol and r.get(acol) else None))

        colours = [S1, S4, S3]
        allx, ally = [], []
        for i, (k, pts) in enumerate(sorted(series.items())):
            X = [p[0] for p in pts]; Y = [p[1] for p in pts]
            allx += X; ally += Y
            ax.scatter(X, Y, s=48, c=colours[i % 3], alpha=0.85, linewidths=0, label=str(k), zorder=3)

        b, a = ols(allx, ally)
        lo, hi = min(allx), max(allx)
        mx, my = sum(allx) / len(allx), sum(ally) / len(ally)
        ax.plot([lo, hi], [a + b * lo, a + b * hi], color=S2, lw=2.4, zorder=5)
        for exp, col, lab, dy in ((3.0, MUTE, "Thompson's cube law\nexponent 3", 14),
                                  (2.41, S3, "with infants pooled in\nexponent 2.41", -26)):
            ax.plot([lo, hi], [my + exp * (lo - mx), my + exp * (hi - mx)],
                    color=col, lw=1.8, ls=(0, (6, 4)), zorder=4)
            ax.annotate(lab, xy=(lo, my + exp * (lo - mx)), xytext=(6, dy),
                        textcoords="offset points", ha="left", color=col, fontweight="bold", fontsize=10)
        ax.annotate(f"ages 2–19\nexponent {b:.2f}", xy=(hi, a + b * hi), xytext=(-6, 10),
                    textcoords="offset points", ha="right", color=S2, fontweight="bold", fontsize=11)

        ax.set_xlabel("log₁₀ mean stature (cm)")
        ax.set_ylabel("log₁₀ mean body mass (kg)")
        ax.set_title("Two swarms, one survey, two answers.\nThe whole gap is infants.",
                     fontsize=12.5, fontweight="bold", loc="left", pad=10)
        ax.legend(frameon=False, loc="upper left", fontsize=10)
        fig.tight_layout()
        p2 = OUT / "thompson_cube_law.png"
        fig.savefig(p2, dpi=170); plt.close(fig)
        record(p2, f"Body mass against stature on NHANES age-group means: our exponent {b:.2f} for ages 2-19, against the cube law's 3 and the collaborator's 2.41 once infants are pooled in",
               "our own claim test thompson1917-ch03-07, from derived/age_bins.csv (NHANES 2013-2018); the 2.41 line is the collaborator swarm's published result")

# ---------------------------------------------------------------- merge into the manifest
mp = OUT / "manifest.json"
existing = json.loads(mp.read_text(encoding="utf8")) if mp.exists() else []
by = {m["file"]: m for m in existing}
for m in manifest:
    by[m["file"]] = m
mp.write_text(json.dumps(list(by.values()), indent=1), encoding="utf8")
print(f"manifest: {len(by)} figures")
