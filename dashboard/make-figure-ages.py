#!/usr/bin/env python3
"""Replaces the Thompson scatter with the figure that actually shows the finding.

Three lines on a log-log scatter over a narrow stature range are visually identical, so that
chart could not support its own caption. The exponent by age window can, and it is the thing
the two swarms actually disagreed about.

    python dashboard/make-figure-ages.py
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dashboard/public/deck/fig"
CC = ROOT / "claim-tests/thompson-growth-form/thompson1917-ch03-07/derived/cross_check.json"

S1, S2, S3, S4 = "#2a78d6", "#eb6834", "#1baf7a", "#6250d6"
INK, MUTE, GRID, SURFACE = "#14201f", "#5a6b69", "#e2e6e4", "#fcfcfb"
plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "font.family": "DejaVu Sans", "font.size": 11,
    "axes.edgecolor": GRID, "axes.labelcolor": INK, "text.color": INK,
    "xtick.color": MUTE, "ytick.color": MUTE,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "axes.grid.axis": "x", "grid.color": GRID, "grid.linewidth": 0.8,
})

d = json.loads(CC.read_text(encoding="utf8"))
w = d["theirs"]["slope_by_age_window"]
pooled = d["theirs"]["pooled_0_19_individuals"]
ours = d["ours_individual_level"]["pooled"]

# label, exponent, ci, n, colour, whose
rows = [
    ("infants only, 0–2 yr", w["0-2yr"]["ols_slope"], w["0-2yr"]["ols_slope_ci95"], w["0-2yr"]["n"], S3),
    ("children, 2–10 yr", w["2-10yr"]["ols_slope"], w["2-10yr"]["ols_slope_ci95"], w["2-10yr"]["n"], S3),
    ("adolescents, 10–20 yr", w["10-20yr"]["ols_slope"], w["10-20yr"]["ols_slope_ci95"], w["10-20yr"]["n"], S3),
    ("all ages pooled, 0–20 yr\n(their pre-registered scope)", pooled["ols_slope"], pooled["ols_slope_ci95"], pooled["n_individuals"] if "n_individuals" in pooled else 23540, S4),
    ("ages 2–19\n(our pre-registered scope)", ours["ols_exponent"], ours["ci95"], ours["n_individuals"], S2),
]

fig, ax = plt.subplots(figsize=(9.0, 5.2))
ys = list(range(len(rows)))[::-1]
for y, (lab, b, ci, n, col) in zip(ys, rows):
    ax.errorbar(b, y, xerr=[[b - ci[0]], [ci[1] - b]], fmt="o", color=col,
                markersize=9, capsize=4, lw=2.2, zorder=4)
    ax.annotate(f"{b:.2f}", xy=(b, y), xytext=(0, 13), textcoords="offset points",
                ha="center", color=col, fontweight="bold", fontsize=11)
    ax.annotate(f"n={n:,}", xy=(b, y), xytext=(0, -20), textcoords="offset points",
                ha="center", color=MUTE, fontsize=9)

ax.axvline(3.0, color=MUTE, lw=1.8, ls=(0, (6, 4)), zorder=2)
ax.annotate("Thompson's cube law\nexponent 3", xy=(3.0, ys[0] + 0.42), xytext=(8, 0),
            textcoords="offset points", ha="left", va="center", color=MUTE,
            fontweight="bold", fontsize=10)
ax.axvspan(2.5, 3.5, color=S2, alpha=0.06, zorder=1)
ax.annotate("our pre-registered\nacceptance band", xy=(2.5, ys[-1] - 0.45), xytext=(2, -2),
            textcoords="offset points", ha="left", va="top", color=S2, fontsize=9)

ax.set_yticks(ys)
ax.set_yticklabels([r[0] for r in rows], fontsize=10)
ax.set_xlabel("exponent of body mass on stature (log-log slope, 95% CI)")
ax.set_xlim(1.9, 3.6)
ax.set_ylim(-0.9, len(rows) - 0.3)
ax.set_title("The exponent depends on which ages you include.\nTwo swarms picked different windows, and got different verdicts.",
             fontsize=12, fontweight="bold", loc="left", pad=10)
fig.tight_layout()

p = OUT / "thompson_age_windows.png"
fig.savefig(p, dpi=170)
plt.close(fig)

b = p.read_bytes()
entry = {
    "file": "fig/" + p.name,
    "shows": "Body-mass-on-stature exponent by age window, with 95% confidence intervals: infants 2.10, children 2.36, adolescents 3.10, all ages pooled 2.41, our window 2.76",
    "provenance": "our claim test thompson1917-ch03-07, derived/cross_check.json; the windowed and pooled figures are the collaborator swarm's own published numbers, recomputed from origin/main",
    "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b),
    "kind": "figure generated from this project's own analysis output",
}
mp = OUT / "manifest.json"
existing = json.loads(mp.read_text(encoding="utf8")) if mp.exists() else []
by = {m["file"]: m for m in existing}
by[entry["file"]] = entry
by.pop("fig/thompson_cube_law.png", None)
mp.write_text(json.dumps(list(by.values()), indent=1), encoding="utf8")
(OUT / "thompson_cube_law.png").unlink(missing_ok=True)
print(f"{p.name}: {len(b)//1024} KB | manifest {len(by)} figures (replaced the scatter)")
