#!/usr/bin/env python3
"""Build the PowerPoint from the same deck/data.json the HTML deck reads.

One source of numbers, two renderings: run build-deck.mjs first, then this.
Anticipated slides come out greyed with a hatched placeholder, exactly as on the web deck,
so a slide can never show a result that does not exist yet.

    python dashboard/make-pptx.py
"""
from __future__ import annotations

import json
from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "public/deck/data.json").read_text(encoding="utf8"))
OUT = ROOT / "public/deck/delphi-pitch.pptx"

N = DATA["numbers"]
STATE = {s["id"]: s for s in DATA["slides"]}

# the validated categorical palette (see dataviz skill); UI teal is never a series colour
S1, S2, S3, S4 = RGBColor(0x2A, 0x78, 0xD6), RGBColor(0xEB, 0x68, 0x34), RGBColor(0x1B, 0xAF, 0x7A), RGBColor(0x62, 0x50, 0xD6)
INK, MUTE, GHOST = RGBColor(0x14, 0x20, 0x1F), RGBColor(0x5A, 0x6B, 0x69), RGBColor(0x9A, 0xA6, 0xA3)
ACCENT, PAPER = RGBColor(0x0E, 0x7C, 0x86), RGBColor(0xFF, 0xFF, 0xFF)
GOOD, SERIOUS = RGBColor(0x1B, 0xAF, 0x7A), RGBColor(0xEB, 0x68, 0x34)

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[6]
W, H = prs.slide_width, prs.slide_height
M = Inches(0.78)



FIGS = {}
try:
    for f in json.loads((ROOT / "public/deck/fig/manifest.json").read_text(encoding="utf8")):
        FIGS[f["file"].split("/")[-1]] = f
except Exception:
    pass


def realfig(slide, name, x, y, w, lead=None):
    """Place a real plot with its provenance beneath it. PNG only; pptx cannot embed SVG."""
    f = FIGS.get(name)
    if not f or not (ROOT / "public/deck" / f["file"]).exists() or not name.lower().endswith(".png"):
        return None
    pic = slide.shapes.add_picture(str(ROOT / "public/deck" / f["file"]), x, y, width=w)
    tbox(slide, x, y + pic.height + Inches(0.06), w, Inches(0.5),
         (lead or f["shows"]) + "  —  " + f["provenance"], 8, False, MUTE, spacing=1.1)
    return pic


def splice(text, fallback=""):
    """Fold a sentence read from a data file into the middle of one of ours: lower-case lead, no trailing stop."""
    t = (text or fallback).strip().rstrip(".")
    return (t[:1].lower() + t[1:]) if t[:2].isupper() is False else t


def fmt(v, dash="—"):
    return f"{v:,}" if isinstance(v, (int, float)) else dash


def tbox(slide, x, y, w, h, text, size=18, bold=False, color=INK, align=PP_ALIGN.LEFT, spacing=1.0):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, line in enumerate(str(text).split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        r.font.name = "Segoe UI"
    return box


def new(title, state="live", eyebrow="DELPHI · ScienceClaw 2026"):
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = PAPER
    tbox(s, M, Inches(0.42), Inches(8), Inches(0.3), eyebrow, 10, True, MUTE)
    lab, col = {
        "live": ("EVIDENCE IN HAND", GOOD),
        "partial": ("PARTLY EVIDENCED", SERIOUS),
        "anticipated": ("ANTICIPATED — NO DATA YET", GHOST),
    }[state]
    chip = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, W - M - Inches(2.9), Inches(0.36), Inches(2.9), Inches(0.34))
    chip.fill.solid()
    chip.fill.fore_color.rgb = PAPER
    chip.line.color.rgb = col
    chip.line.width = Pt(1)
    chip.shadow.inherit = False
    p = chip.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = lab
    r.font.size = Pt(9)
    r.font.bold = True
    r.font.color.rgb = col
    tbox(s, M, Inches(0.95), W - 2 * M, Inches(1.5), title, 40, True,
         GHOST if state == "anticipated" else INK, spacing=0.92)
    return s


def caption(s, text, y=None):
    tbox(s, M, y or (H - Inches(1.35)), W - 2 * M, Inches(1.0), text, 12, False, MUTE, spacing=1.15)


def hero(s, items, y=Inches(2.5)):
    """Big numbers. The form heuristic says a single headline figure is not a chart."""
    x = M
    for val, label, col in items:
        tbox(s, x, y, Inches(3.1), Inches(1.4), val, 54, True, col)
        tbox(s, x, y + Inches(1.25), Inches(3.1), Inches(1.1), label, 11, False, MUTE, spacing=1.12)
        x += Inches(3.5)


def barchart(s, cats, series, y=Inches(2.35), height=Inches(3.6), colors=None, legend=None):
    """Horizontal bars for magnitude, one axis, direct value labels on every bar."""
    cd = CategoryChartData()
    cd.categories = cats
    for name, vals in series:
        cd.add_series(name, vals)
    gf = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, M, y, W - 2 * M - Inches(0.3), height, cd)
    ch = gf.chart
    ch.font.size = Pt(12)
    ch.font.color.rgb = MUTE
    ch.font.name = "Segoe UI"
    if legend and len(series) > 1:
        ch.has_legend = True
        ch.legend.position = XL_LEGEND_POSITION.BOTTOM
        ch.legend.include_in_layout = False
    else:
        ch.has_legend = False
    plot = ch.plots[0]
    plot.gap_width = 60
    plot.has_data_labels = True
    dl = plot.data_labels
    dl.font.size = Pt(12)
    dl.font.bold = True
    dl.font.color.rgb = INK
    for i, ser in enumerate(plot.series):
        ser.format.fill.solid()
        ser.format.fill.fore_color.rgb = (colors or [S1, S4, S2, S3])[i % 4]
    va = ch.value_axis
    va.has_major_gridlines = True
    va.major_gridlines.format.line.color.rgb = RGBColor(0xE2, 0xE6, 0xE4)
    va.has_title = False
    ch.category_axis.has_title = False
    return ch


def ghostbox(s, x, y, w, h, title, note):
    """A result we do not have: dashed, grey, labelled. Never a rendering that could pass for data."""
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    box.fill.solid()
    box.fill.fore_color.rgb = RGBColor(0xF2, 0xF4, 0xF3)
    box.line.color.rgb = GHOST
    box.line.width = Pt(1.5)
    box.line.dash_style = 4  # dashed
    box.shadow.inherit = False
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = title
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = GHOST
    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run()
    r2.text = note
    r2.font.size = Pt(10)
    r2.font.color.rgb = GHOST


def route_row(s, nodes, y, weakest=None, broken=False):
    n = len(nodes)
    bw, gap = Inches(1.18), Inches(0.42)
    total = n * bw + (n - 1) * gap
    x = Emu(int((W - total) / 2))
    for i, nd in enumerate(nodes):
        b = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, bw, Inches(0.62))
        b.fill.solid()
        b.fill.fore_color.rgb = PAPER
        b.line.color.rgb = S1 if i == 0 else S4 if i == n - 1 else RGBColor(0xD9, 0xDF, 0xDB)
        b.line.width = Pt(1.75)
        b.shadow.inherit = False
        p = b.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = nd
        r.font.size = Pt(15)
        r.font.bold = True
        r.font.color.rgb = INK
        r.font.name = "Consolas"
        if i < n - 1:
            bad = broken and weakest is not None and i == weakest
            ln = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, x + bw, y + Inches(0.28), gap, Pt(3))
            ln.fill.solid()
            ln.fill.fore_color.rgb = SERIOUS if bad else GOOD
            ln.line.fill.background()
            ln.shadow.inherit = False
        x = Emu(int(x + bw + gap))


# ----------------------------------------------------------------- slides
# 1 title
s = new("Which experiment would\njustify the next step?", "live")
tbox(s, M, Inches(2.45), Inches(8.6), Inches(0.9),
     "We turn claims about how life works into experiments a machine can check —\nand say plainly when the evidence is not there yet.", 15, False, MUTE, spacing=1.2)
if N.get("route"):
    route_row(s, N["route"]["nodes"], Inches(4.1))
caption(s, "A real route through a real enzyme: every step measured, every step uphill, the whole thing machine-checked.")

# 2 the backlog
s = new("Science has a backlog.", STATE["question"]["state"])
hero(s, [(fmt(N["claims"]), "claims pulled out of Darwin, Thompson, Turing, Wolfram and others", S1),
         (fmt(N["claimTests"]), "of them tested against real data this weekend", S2)])
caption(s, "The gap is the opportunity, not an embarrassment. Most of these claims have never had a dataset pointed at them, "
           "because nobody had a cheap way to ask which dataset would settle which claim.")

# 3 the funnel
s = new("So we built the asking machine.", STATE["gap"]["state"])
barchart(s, ["Extracted", "Tested on data", "Proved in Lean"],
         [("claims", (N["claims"], N["claimTests"], N.get("leanProved") or 0))],
         y=Inches(2.3), height=Inches(3.2), colors=[S1])
caption(s, "Each stage is narrower than the last, on purpose. A claim only advances when a named dataset can settle it "
           "and two independent assessors agree it can.")

# 4 pipeline
s = new("Ten specialists, one chain.", "live")
stages = [("A1", "say it plainly"), ("A2", "find the sources"), ("A3", "name the species"), ("A4", "find the data"),
          ("A5", "inventory"), ("A6", "all scales?"), ("A7", "write the maths"), ("A8", "run the test"),
          ("A9", "is it faithful?"), ("A10", "publish it")]
x, y = M, Inches(2.6)
for i, (k, v) in enumerate(stages):
    if i == 5:
        x, y = M, y + Inches(1.05)
    b = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(2.3), Inches(0.82))
    b.fill.solid()
    b.fill.fore_color.rgb = PAPER
    b.line.color.rgb = ACCENT if i in (7, 8) else RGBColor(0xD9, 0xDF, 0xDB)
    b.shadow.inherit = False
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = k
    r.font.size = Pt(9)
    r.font.bold = True
    r.font.color.rgb = MUTE
    p2 = tf.add_paragraph()
    r2 = p2.add_run()
    r2.text = v
    r2.font.size = Pt(12)
    r2.font.color.rgb = INK
    x += Inches(2.46)
caption(s, "Two rules carry most of the weight. Nothing scores its own work, so the agent that runs a test never judges it. "
           "And every test is written down before the data is opened, so a disappointing answer stays the answer.")

# 5 the route
r = N.get("route")
s = new("Four changes. No usable shortcut.", STATE["route"]["state"])
if r:
    route_row(s, r["nodes"], Inches(2.45), r.get("weakest"), broken=False)
    route_row(s, r["nodes"], Inches(3.75), r.get("weakest"), broken=True)
    tbox(s, M, Inches(2.2), Inches(5), Inches(0.3), f"at κ = {N['kappaUsed']}, the setting used for the result", 10, False, MUTE)
    tbox(s, M, Inches(3.5), Inches(5), Inches(0.3), f"at κ = {r['breaksAt']}, one step stops being defensible", 10, False, SERIOUS)
    caption(s, f"Going straight needs {len(r['nodes']) - 1} changes; every direct ordering drops downhill somewhere, so the usable path is a "
               f"{len(r['nodes']) - 1}-step detour. Demand a little more margin and the route breaks. That is the product: it tells you which measurement would settle it.")
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.6), "No certified route yet", STATE["route"].get("needs", ""))

# 6 scoreboard
P = sorted(N.get("policies") or [], key=lambda p: -p["certified"])
s = new("Asking beats guessing.", STATE["scoreboard"]["state"])
if P:
    if realfig(s, "cert_vs_assays.png", M, Inches(2.0), W - 2 * M) is None:
        labels = {"q2c_nomodel": "Ask to settle, no model", "q2c": "Ask to settle, with model",
                  "collective_shared": "Five agents, sharing", "collective_isolated": "Five agents, isolated",
                  "directed": "Head toward the target", "greedy": "Always climb highest"}
        barchart(s, [labels.get(p["key"], p["key"]) for p in P],
                 [("of 100 runs settled correctly", tuple(p["certified"] for p in P))],
                 y=Inches(2.2), height=Inches(3.5), colors=[S3])
caption(s, "Same budget, same starting data, 100 runs each. Picking experiments to settle the question beats chasing the "
           "best-looking variant — and nobody issued a single false certificate.")

# 7 the twist
pn = N.get("panel")
s = new("Then we tried to break our own best result.", STATE["twist"]["state"])
if pn:
    hero(s, [(fmt(pn["theirLazyOnly"]), f"extra wins on their panel, over {fmt(pn['theirEpisodes'])} runs", S2),
             (fmt(pn["separatingPairs"]), f"pair separating the top two on our {pn['pairs']} fresh pairs", S3),
             (fmt(pn["theirVfvsEpisodes"]), f"of their {fmt(pn['theirEpisodes'])} runs start from the same genotype", GHOST)],
         y=Inches(2.45))
    caption(s, "The ranking held; the margin did not. We pre-registered the panel before running it. A gap of "
               f"{pn['theirLazyOnly']} collapsed to {pn['separatingPairs']} once the pairs were not chosen by the people being measured. "
               "The benchmark was partly measuring its own composition.")
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.6), "No independent panel yet", STATE["twist"].get("needs", ""))

# 8 swarm
A = N.get("swarmArms") or []
s = new("A group beats one agent — when attention is the bottleneck.", STATE["swarm"]["state"])
if A:
    names = {"centralized": "Swarm, led", "decentralized": "Swarm, peer-to-peer",
             "isolated": "Workers, isolated", "single": "One agent alone"}
    barchart(s, [names.get(a["key"], a["key"]) for a in A],
             [("run 1, from memory", tuple(a["exp1"] for a in A)),
              ("run 2, must fetch the page", tuple(a["exp2"] for a in A))],
             y=Inches(2.2), height=Inches(3.4), colors=[S1, S4], legend=True)
caption(s, "Two pre-registered runs, same model and budget, out of 20 each. The single agent lost mostly by running out of room "
           "and leaving answers blank, not by reasoning worse. The same contest on the enzyme benchmark found no advantage at all, "
           "because there the members are deterministic code. Collaboration pays when the limit is attention.")

# 8b two swarms
C = N.get("crosscheck")
if C:
    s = new("Two independent swarms. Same claims. Six of eight agree.", "live")
    hero(s, [(fmt(C["agreements"]), f"of {C['overlapping']} claims where both swarms reached the same verdict, working separately", S3),
             (fmt(C["disagreements"]), "where they differ — both differences methodological, not factual", S2),
             (f"{fmt(C['theirTests'])}+{fmt(C['ourTests'])}", "claim tests across the two swarms", INK)],
         y=Inches(2.3))
    y = Inches(4.35)
    for d in C["differing"]:
        why = ("same data, same method, different pre-registered age range: %.2f for ages 2-19 vs %.2f once infants are pooled in"
               % (d["ourValue"], d["theirValue"])) if d["kind"] == "same-data-different-analysis" and d.get("ourValue") and d.get("theirValue")             else "different operationalisation of the same sentence"
        tbox(s, M, y, W - 2 * M, Inches(0.42),
             f"{d['claim'].split('/')[-1]}:  ours {d['ours']}  ·  theirs {d['theirs']}  —  {why}", 11, False, INK)
        y += Inches(0.44)
    caption(s, "Nobody coordinated these; the overlap was accidental. Then we chased the disagreements down. On Thompson's cube law "
               "the two swarms reproduce each other exactly once the age range matches: their own 2-20 year window gives 2.74, ours "
               "2.76. The whole gap is infants, who scale near 2.1 and drag the pooled exponent to 2.41. The verdict turns on one "
               "pre-registered choice, not on anyone's method. Neither number is 3.")

# 9 proof
pr = N.get("proofs")
s = new("We broke the proofs on purpose.", STATE["proof"]["state"])
if pr:
    hero(s, [(f"{pr['rejected']}/{pr['mutations']}", "deliberate breakages correctly rejected", S3),
             ("clean" if pr["buildExit"] == 0 else f"exit {pr['buildExit']}", "rebuild from source, on our own copy", INK),
             (fmt(N.get("leanProved")), "of our own laws machine-checked, zero gaps", S1)])
    caption(s, "Reversing an inequality, weakening a wall, deleting a check, moving one measured number — each must stop the proof "
               "compiling, and each did. The theorems are general, not arithmetic about fixed constants. "
               + ("Found by checking rather than trusting: one receipt in the partner project credits a proof module that does not exist in its repository. "
                  "The proofs are sound; the paperwork overstated the coverage." if pr.get("discrepancy") else ""))

# 10 nulls
g = N.get("gpu") or {}
s = new("Two things that did not work.", STATE["nulls"]["state"])
hero(s, [("0", f"benefit from a protein language model, across {g.get('sizes', 5)} sizes and {fmt(g.get('variants'))} variants on an H100", GHOST),
         ("0", "saving from reusing a claim, over an ordinary cache, within one context", GHOST)],
     y=Inches(2.15))
caption(s, "A deliberately shuffled model scored as well as the real one. We lead with this because a null you can reproduce is "
           "worth more than a result you cannot — and because most teams will not show you theirs.", y=Inches(3.95))
realfig(s, "ablation.png", M, Inches(4.5), Inches(6.2), "Remove the learned model and the curves do not move")

# ----------------------------------------------------------------- the shape of the output
# Every number below comes from DATA["numbers"], which build-deck.mjs read out of the repository.
def rows(s, items, y=Inches(2.3), gap=Inches(0.62), vw=Inches(3.2)):
    """One line per result: what it is on the left, its number on the right, a note beneath."""
    for head, note, val, col in items:
        tbox(s, M, y, W - 2 * M - vw - Inches(0.3), Inches(0.34), head, 14, True, INK)
        tbox(s, W - M - vw, y, vw, Inches(0.34), val, 14, True, col, align=PP_ALIGN.RIGHT)
        if note:
            tbox(s, M, y + Inches(0.3), W - 2 * M - Inches(0.4), gap - Inches(0.26), note, 10, False, MUTE, spacing=1.12)
        y += gap
    return y


def note(s, y, text, col=GHOST, w=None):
    """A bordered aside: what a result rests on, or what it does not cover."""
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, M, y, w or (W - 2 * M), Inches(0.1))
    box.fill.solid()
    box.fill.fore_color.rgb = PAPER
    box.line.color.rgb = col
    box.shadow.inherit = False
    box.text_frame.word_wrap = True
    p = box.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = text
    r.font.size = Pt(11)
    r.font.color.rgb = INK
    r.font.name = "Segoe UI"
    return box


SH = N.get("shape")
if SH:
    s = new("More of this is negative than positive.\nThat is the result.", STATE["shape"]["state"])
    # one composition bar, 2px gaps between segments, direct labels beneath
    xs, total_w, y0 = M, W - 2 * M, Inches(2.25)
    segs = [(SH["negative"], S2, "negative or self-limiting"),
            (SH["methodological"], S1, "methodological, found by accident"),
            (SH["supported"], S3, "supported")]
    x = xs
    for n_, col, lab in segs:
        w = Emu(int(total_w * n_ / SH["total"])) - Emu(19050)
        b = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y0, w, Inches(0.34))
        b.fill.solid()
        b.fill.fore_color.rgb = col
        b.line.fill.background()
        b.shadow.inherit = False
        tbox(s, x, y0 + Inches(0.4), w, Inches(0.6), f"{n_}  {lab}", 10, False, MUTE, spacing=1.1)
        x = Emu(int(x + total_w * n_ / SH["total"]))
    barchart(s, [r["label"] for r in SH["rows"]],
             [("records", tuple(r["n"] for r in SH["rows"]))],
             y=Inches(3.25), height=Inches(2.5), colors=[S2])
    CR = N.get("corrections")
    if CR:
        note(s, Inches(5.95),
             f"{CR['total']} claims corrected in one day — {CR['ours']} found by our own checks, {CR['collaborator']} by a "
             "collaborator's independent cross-check: "
             + "; ".join(x["title"].rstrip(".") + f" (caught by {x['who']})" for x in CR["items"])
             + ". Every one is a record or a log entry, never a silent edit to history.", SERIOUS)
    caption(s, f"This is an argument about method, not an apology. {SH['notAPlainWin']} of {SH['total']} records are not a win for "
               f"the hypothesis we set out to test: {SH['negative']} are negative or self-limiting and {SH['methodological']} are "
               "methodological findings we only have because something broke. A pipeline that mostly produces negatives, corrects "
               "itself in public and refuses statistics its sample cannot support is making a stronger claim about its method than "
               "one that reports only wins — because only the first kind can be wrong out loud.")

# ----------------------------------------------------------------- the design validation
V = N.get("designval")
if V:
    s = new("We pre-registered a test of a designed organism.\nIt failed.", STATE["designval"]["state"])
    note(s, Inches(2.2),
         "SAY THIS FIRST: the design is not ours. It is Daane et al. 2021's own germline double heterozygote — built, scored and "
         "published by them, with their own claim that it phenocopies flying-fish fin proportions. Our contribution is the "
         "validation arithmetic, not the organism. We did not design a flying fish.", SERIOUS)
    rows(s, [
        (f"Morphological axes that could be scored at all",
         f"The axis the design is about, {V['definingAxis']}, cannot be scored on either side: no published adult zebrafish value "
         "exists, and the design's value exists only inside a figure we refused to digitise.",
         f"{V['scored']} of {V['axes']}", SERIOUS),
        ("Loci known to differ in flying fishes that the design TOUCHES — a near miss, not a hit",
         "Same gene, different variant. lat4a/slc43a2a is genuinely in Daane's convergent-substitution sheet, so the design touches "
         "the right gene — but "
         + splice((N.get("corrections") or {}).get("variantMismatch"),
                   "the design's allele is T200K and the convergent substitution is F326L: different sites, different species, "
                   "not the same variant")
         + ". The design changes a different position in the same transporter, not the change flying fishes carry. The other half "
           "of the design, kcnh2a, appears nowhere in that workbook.",
         f"{V['lociReproduced']} of {V['lociKnownToDiffer']}  ·  {V['fraction'] * 100:.1f}%", SERIOUS),
        ("The Lean constraint gate",
         f"It fails for the design ({V['gateTallies']['DESIGN']['violated']} violated) and for the real flying fish "
         f"({V['gateTallies']['REAL']['violated']} violated), so failing does not separate the design from its target. The gate is "
         f"weak: only {V['rowsDecided']} of {V['gateRows']} rows are decided by a single design, and it tests nothing aerodynamic, "
         "nothing developmental and nothing about fins.",
         "FAILS, both arms", SERIOUS),
    ], y=Inches(3.3), gap=Inches(1.08))
    caption(s, "Dropped as unsupported, not disproved, under the pre-registration's own rule. The honest framing is also the "
               "stronger one: we built the apparatus to ask whether a designed organism matches a real one, wrote the test down "
               "first, ran it, and it failed — which is why we can now say what designing an organism would require. "
               + ("At a single scored axis none of the pre-registered FAIL triggers could fire, so the letter of the rule would "
                  "have awarded \"close\" by default; the agent refused that and logged it as a deviation against the design's own "
                  "interest. " if V.get("refusedTheDefault") else "")
               + f"Pre-registration hashed before the first number, sha256 {V['preregSha'][:16]}…"
               + (" (verified unaltered)." if V.get("preregVerified") else "."))

# ----------------------------------------------------------------- the correction
G = N.get("genomeGap")
if G:
    s = new("We said there was no genome. There is.", STATE["annotation"]["state"])
    hero(s, [(fmt(G["genes"]), "protein-coding genes predicted in the flying-fish assembly", S1),
             (f"{G['percent']}%", f"of them carry at least one database hit ({fmt(G['annotated'])} genes)", S3),
             (str(G["rnaseqMentions"]), 'occurrences of "RNA-seq" or "transcriptome" in that paper, counted', SERIOUS)],
         y=Inches(2.3))
    note(s, Inches(4.25),
         f"What we said, and what changed: until this weekend our own files, our brief to ten subagents and the public dashboard "
         f"all said that almost no molecular data exists for flying fish. That was wrong, and it was load-bearing — it was "
         f"repeated on every number in the map. {G['filesCorrected']} files were rewritten and the error recorded as its own "
         f"citable correction.   And the caveat on our own headline: \"functionally annotated\" means one sequence-similarity or "
         f"domain hit. TrEMBL alone supplies {fmt(G['trembl'])} of the hits and is automatically generated and unreviewed, so "
         f"{G['percent']}% measures database coverage, not understood function.", SERIOUS)
    caption(s, "This is the cleanest statement of the gap we face. The genes are known; what is missing is measurement. That paper "
               "reports no expression data, no mutant, no kinetics and no regulatory network, and the zero is established by "
               "counting strings in the full text rather than by inference. "
               f"{G['citation']}, doi {G['doi']}.")

# ----------------------------------------------------------------- annotation is not measurement
RD = N.get("readiness")
if RD:
    s = new(f"{RD['annotatedPct']}% annotated. 0% parameterised.", STATE["readiness"]["state"])
    hero(s, [("0", f"of the {fmt(RD['needed'])} numbers a minimal dynamical model of our {fmt(RD['genes'])} genes would need", SERIOUS),
             (f"{RD['annotatedPct']}%", f"of the same genes carry a functional annotation ({fmt(RD['annotated'])} of {fmt(RD['genes'])})", S3),
             (fmt(RD["edges"]), f"of {fmt(RD['pairs'])} gene pairs with any direct experimental support ({RD['pairsPct']})", GHOST)],
         y=Inches(2.25))
    barchart(s, [i["label"] for i in RD["items"]],
             [(f"of {fmt(RD['genes'])} genes", tuple(i["n"] for i in RD["items"]))],
             y=Inches(4.2), height=Inches(1.9), colors=[S2])
    caption(s, "This is not a complaint about missing data; it is a measurement nobody had made. Annotation says this gene is "
               "involved in this process. A simulation needs this many molecules, decaying this fast, binding this tightly — and "
               "the first does not constrain the second. Relaxed as far as honesty allows, accepting a relative abundance figure "
               f"in place of an absolute one, it is {fmt(RD['lenientHeld'])} of {fmt(RD['needed'])} ({RD['lenientPct']}%), and every "
               f"one of those is that same single substitute."
               + (f" For scale: the whole-cell model that predicts phenotype from genotype used {RD['precedent']['genes']} genes and "
                  f"{RD['precedent']['sources']} primary sources, for a single cell with no anatomy and no development "
                  f"(Karr 2012, {RD['precedent']['doi']})." if RD.get("precedent") else ""))

# ----------------------------------------------------------------- powered flight eliminated
PH = N.get("physiology")
if PH:
    s = new("Sustained powered flight is eliminated,\nwith a certificate.", STATE["flight"]["state"])
    ld = next((c for c in PH["cases"] if c["speed"] == 10), PH["cases"][0])
    hero(s, [(f"{PH['ceilingW']} W", "aerobic mechanical ceiling the oxygen budget can pay for", S3),
             (f"{ld['requiredW']} W", f"needed for level flight at {ld['speed']} m/s at the measured L/D of {ld['ld']}", S2),
             (f"{ld['shortBy']}x", "short — and the gap is checked by the Lean kernel, not by us", SERIOUS)],
         y=Inches(2.3))
    y = Inches(4.3)
    for c in PH["cases"]:
        tag = "  [illustrative numbers]" if c["illustrative"] else ""
        tbox(s, M, y, Inches(7.4), Inches(0.3), f"{c['what']}, {c['speed']} m/s{tag}", 11, False, INK)
        tbox(s, W - M - Inches(4.2), y, Inches(4.2), Inches(0.3),
             f"{c['requiredW']} W needed  ·  {c['shortBy']}x short", 11, True, SERIOUS, align=PP_ALIGN.RIGHT)
        y += Inches(0.34)
    FL = N.get("flier")
    if FL and FL.get("musclePctThatFits"):
        note(s, Inches(5.55),
             f"WHAT A FISH THAT REALLY FLEW WOULD NEED, AND NO ANIMAL HAS: a flight muscle that does not fit in the animal. At "
             f"{FL['muscleFraction'] * 100:.0f}% of a 60 g body and ordinary muscle density that is {FL['muscleVolumeM3']} m³ of "
             f"muscle, and only {FL['musclePctThatFits']}% of it fits inside the body at the pectoral girdle — a geometric "
             f"consequence of the specification, not an opinion. Beside it: a cardiac output of "
             f"{FL['needs'][0]['value']:,.0f} {FL['needs'][0]['unit']}, {FL['cardiacVerdict'].split(':')[0]}. Building the design "
             "as real geometry was itself a test, and it caught something three rounds of equations did not. The flier is "
             "hypothetical throughout and now carries a requirement nothing can satisfy; it is not a validated design.", SERIOUS)
    caption(s, "What it rests on: Fick's principle, aerobic power rather than burst power, and teleost proxy values for cardiac "
               "output, arterial oxygen and efficiency — no flying-fish physiology exists, so the proxies are what the elimination "
               "rests on. What it does NOT bound: gliding (a flying fish is a glider), and short burst flight. "
               f"{PH['kernelChecked']} of {PH['candidates']} candidates eliminated, each by a theorem the compiler accepted; on the "
               f"same candidates {PH['cannotRule']} other constraints could not be fired at all for want of an input. This is a "
               "proof about a model instantiated with proxy numbers and it carries that scope — it is not a fact about a fish.")

# ----------------------------------------------------------------- one glide is not enough
GL = N.get("glide")
if GL:
    s = new("One glide cannot explain the long flights.", STATE["glide"]["state"])
    cats = [f"From {GL['heightM']} m at the measured L/D {GL['ldMeasured']}",
            f"… with the measured {GL['deltaGroundEffect'] * 100:.0f}% ground effect",
            "Field flight, reported as one glide"]
    vals = [GL["reachM"], GL["reachWithGroundEffectM"], GL["fieldSingleGlideM"]]
    if GL.get("ldTheoretical"):
        cats.append(f"… at the theoretical L/D {GL['ldTheoretical']}, for comparison")
        vals.append(GL["reachTheoreticalM"])
    barchart(s, cats, [("metres", tuple(vals))], y=Inches(2.3), height=Inches(3.1), colors=[S2])
    caption(s, "A steady glide can only trade height for distance, so its range is at most height times lift-to-drag. At the "
               f"measured ratio that is {GL['reachM']} m from the greatest recorded flight height, or {GL['reachWithGroundEffectM']} m "
               f"once the measured ground effect is allowed — and the field reports {GL['fieldSingleGlideM']} m. So the single-glide "
               "reading is eliminated, and taxiing re-launches or wind must account for the rest. The field figures are quoted "
               f"second-hand and labelled secondary; the {GL['fieldSequenceM']} m one is already described by its own source as a "
               "sequence of taxiing and glides, not one glide."
               + (f" Our simulator reproduces that shape: {GL['sim']['glides']} glides and {GL['sim']['metres']} m in "
                  f"{GL['sim']['seconds']} s, from a model changed after seeing results, so that run is exploratory and labelled so."
                  if GL.get("sim") else ""))

# ----------------------------------------------------------------- the sequence layer
Q = N.get("sequences")
if Q:
    cv, la, dr, en = Q["convergence"], Q["lat4a"], Q["doseResponse"], Q["engineered"]
    s = new("Four sequence results. Three of them say no.", STATE["sequence"]["state"])
    rows(s, [
        ("Gliders do not converge",
         f"Across {cv['genes']} fin genes, {cv['gliderColumns']} alignment columns show a residue shared by independent gliders and "
         f"absent from each lineage's non-gliding relative — against {cv['baselineColumns']} for the same count with the roles "
         "swapped. Similarity follows ancestry, not gliding. The genes were picked from fin biology, so this says nothing about "
         "the rest of the genome.",
         f"{cv['gliderColumns']} vs {cv['baselineColumns']}", SERIOUS),
        ("The lat4a substitution tracks gliding inside the fishes only",
         f"L in {la['flyingFishL']} of {la['flyingFishN']} flying fishes and in both gliding halfbeaks, against {la['nonGliderF']} of "
         f"{la['nonGliderSpecies']} non-gliding relatives carrying F. But all three bats, both colugos, the sugar glider, mouse, "
         "human and every outgroup scored carry F too, so this is not convergence with gliding mammals. Tracking is not causing.",
         f"{la['flyingFishL']}/{la['flyingFishN']}  ·  {la['nonGliderF']}/{la['nonGliderSpecies']}", GOOD),
        ("The derived-site panel is not a dose-response",
         f"Gliding halfbeaks carry a mean {dr['glidingHalfbeak']['derived']} of {dr['sites']} derived states at a fin-to-body ratio of "
         f"{dr['glidingHalfbeak']['ratio']}; flying fishes carry {dr['flyingFish']['derived']} at {dr['flyingFish']['ratio']}. The group "
         "with the far smaller fin carries slightly more derived residues. The non-gliders' zero is circular by construction and is "
         "not shown as a finding; four groups is a ladder to read, not a statistical test.",
         f"{dr['glidingHalfbeak']['derived']} at {dr['glidingHalfbeak']['ratio']}  ·  {dr['flyingFish']['derived']} at {dr['flyingFish']['ratio']}", SERIOUS),
        ("An \"engineered\" genome is a handful of edits",
         f"{en['editedLoci']} edited loci change {en['aminoAcidsChanged']} amino acid; the other edit is regulatory and changes none. "
         f"In just {en['proteins']} of our causal-chain proteins, zebrafish and medaka differ by {fmt(en['naturalSubstitutions'])} "
         f"amino-acid substitutions ({fmt(en['naturalDifferences'])} positions counting indels). Coding only, in a tiny gene sample.",
         f"{en['aminoAcidsChanged']} vs {fmt(en['naturalSubstitutions'])}", SERIOUS),
    ], y=Inches(2.2), gap=Inches(1.04))
    caption(s, "All four are about fin enlargement for gliding, the trait Daane et al. 2021 measured (10.1016/j.cub.2021.08.054); "
               "the fin ratios, the convergent-substitution panel and the captured exons are theirs. Three of these close a door we "
               "would have liked open, and the one that holds, holds only inside the Beloniformes. No bird sequence, assembly or "
               "annotation was fetched: Aves is this project's frozen holdout.")

# ----------------------------------------------------------------- the 3D organism
AN = N.get("anatomy")
if AN:
    s = new(f"{fmt(AN['pieces'])} named pieces. One measured proportion.", STATE["organism3d"]["state"])
    barchart(s, [m["name"] for m in AN["models"]],
             [("pieces", tuple(m["pieces"] for m in AN["models"])),
              ("with an ontology term", tuple(m["mapped"] for m in AN["models"]))],
             y=Inches(2.2), height=Inches(2.3), colors=[S1, S3], legend=True)
    note(s, Inches(4.7),
         f"Evidence-backed: exactly one proportion — pectoral fin length at {AN['evidenceBacked']['ratio']} of standard length, the "
         f"median of {AN['evidenceBacked']['n']} museum specimens, read from the measurement file rather than typed in "
         f"({AN['evidenceBacked']['caveat']}).   Schematic, and labelled so per piece: everything else, including every count.   "
         f"Where the ontology ran out: {AN['unmapped']} of the flying fish's pieces have no ontology term at all; the manifest "
         "records a null and the nearest ancestor it could find instead of inventing one.", ACCENT)
    caption(s, "The one novelty claim we make, worded as narrowly as the search supports: we did not find prior use of a proof "
               "assistant on an ontology-derived anatomy hierarchy. Ten logged searches turned up no Lean, Coq or Isabelle proofs "
               "about a hierarchy built from Uberon and the Cell Ontology. That is \"not found\", not \"does not exist\", and it is "
               "not a claim to a first. Built on Uberon (10.1186/gb-2012-13-1-r5), the Cell Ontology (10.1186/2041-1480-5-21) via "
               "Ubergraph, Phenoscape (10.1093/molbev/msv223, 10.1093/sysbio/syv031) and Daane 2021 "
               "(10.1016/j.cub.2021.08.054). The anatomy terms are theirs; only the hierarchy check is ours.")

# 11 the wing: anticipated, deliberately empty
s = new("Where this goes next.", "anticipated")
tbox(s, M, Inches(2.1), Inches(9), Inches(0.5),
     "The same question at the scale of a whole organism: which genes drive fin enlargement for gliding, and by how much?", 15, False, MUTE)
bw = Inches(3.72)
ghostbox(s, M, Inches(2.85), bw, Inches(2.2), "Printed flying-fish pectoral fin", "no specimen, no scan, no print exists")
ghostbox(s, M + bw + Inches(0.2), Inches(2.85), bw, Inches(2.2), "Fruit-fly wing, scaled to match", "no matched control exists")
ghostbox(s, M + 2 * (bw + Inches(0.2)), Inches(2.85), bw, Inches(2.2), "Which genes move which feature", "no measurement, no model")
caption(s, "This slide stays grey until there is something real behind it. An insect wing and a fish fin solve the same problem with "
           "unrelated parts, which makes the comparison worth running — and makes a pretty rendering easy to mistake for a result.")

# 12 the ladder
s = new("The honest state of the ladder.", "partial")
x = M
for k, ok in [("molecule", True), ("tissue", False), ("organ", False), ("whole organism", False), ("population", True)]:
    b = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(2.7), Inches(2.3), Inches(1.0))
    b.fill.solid()
    b.fill.fore_color.rgb = PAPER
    b.line.color.rgb = ACCENT if ok else GHOST
    if not ok:
        b.line.dash_style = 4
    b.shadow.inherit = False
    tf = b.text_frame
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "evidenced" if ok else "thin"
    r.font.size = Pt(9)
    r.font.bold = True
    r.font.color.rgb = ACCENT if ok else GHOST
    p2 = tf.add_paragraph()
    r2 = p2.add_run()
    r2.text = k
    r2.font.size = Pt(13)
    r2.font.color.rgb = INK if ok else GHOST
    x += Inches(2.46)
caption(s, "We can go from a sequence to a measured growth rate, and from a claim to a population-level test. The middle of the "
           "ladder is where the data thins out, and we are not going to pretend otherwise: the species with a complete record at "
           "every scale is a short list, and we publish its length rather than loosening the definition.")

# 12b records
R = N.get("records") or {}
if R.get("drafts"):
    s = new("Every finding, made citable.", STATE.get("records", {}).get("state", "partial"))
    names = {"lean": "Proofs + assessments", "organism": "Blueprints, predictions, a refusal",
             "swarm": "Swarm experiments", "claims": "Claim tests, incl. refutations"}
    barchart(s, [names.get(x["thread"], x["thread"]) for x in R["sets"]],
             [("records drafted", tuple(x["drafts"] for x in R["sets"]))],
             y=Inches(2.15), height=Inches(2.5), colors=[S3])
    tbox(s, M, Inches(4.8), Inches(5.6), Inches(0.9),
         f"{R['drafts']} records drafted and validated", 26, True, S3)
    tbox(s, M + Inches(6.0), Inches(4.8), Inches(5.6), Inches(0.9),
         f"{R['signed']} signed — publishing is irreversible", 26, True, GHOST)
    caption(s, "Each record carries the claim in one sentence, its status including refuted and inconclusive, the dataset with its "
               "identifier, the commit proving the test predated the data, and what it does not establish. Refutations are published "
               "too; publishing only successes builds a victory log. While drafting we found the published templates use a retired "
               "vocabulary, so declaring one would have asserted something false about how every record was made — dropped, "
               "measured across five templates, and reported upstream.")

# 13 limits
s = new("What we are not claiming.", "live")
rc = N.get("recount") or {}
lines = [
    "No wet lab. Nothing here was measured at a bench by us; no new organism, protein or variant was made.",
    f"No proof about biology. The machine checked the reasoning from measurements to a safe route. That the measurements bracket the truth is assumed, and two replicates cannot justify it across {fmt(N['enzymeMeasured'])} variants.",
    '"Blocked" is not "impossible." It means unreachable in the measured four-position graph, never in biology.',
    "The publications are unsigned drafts. Valid, unpublished, and described as drafts.",
    f"{rc.get('confirmed', '—')} of {rc.get('total', '—')} outside numbers reproduced exactly; the one we could not check, we said so rather than fill in.",
]
if N.get("corrections"):
    cr = N["corrections"]
    lines.append(f"{cr['total']} of our own claims were corrected in one day — {cr['ours']} found by our own checks, "
                 f"{cr['collaborator']} by a collaborator's independent cross-check. Each was withdrawn or narrowed in public, as "
                 "a record or a log entry, never as a silent edit.")
if N.get("designval"):
    lines.append("We did not design an organism. The \"designed\" fish is Daane et al. 2021's published double heterozygote, and "
                 "our pre-registered test of it came back unsupported. The apparatus is ours; the animal is not.")
if N.get("examLine"):
    ex = N["examLine"]
    lines.append(f"Validation on unseen data ran, and returned nothing. A clade was frozen as a holdout before the tests were "
                 f"built; {ex['examined']} completed results were examined against it and {ex['inconclusive']} came back "
                 "inconclusive"
                 + (f". The {ex['withReason']} that state a reason were stopped by the builders' own pre-registered minimum "
                    "sample size, not by a verdict we disliked" if ex.get("underpowered") and ex.get("withReason") else "")
                 + ". An exam that cannot reach a verdict is reported as one that cannot.")
y = Inches(2.35)
for ln in lines:
    tbox(s, M, y, W - 2 * M, Inches(0.8), "—  " + ln, 13, False, INK, spacing=1.15)
    y += Inches(0.82)
caption(s, "Every one of these is on the public dashboard too, next to the result it limits.")

# 14 ask
s = new("What we want.", "live")
asks = [
    ("One historical campaign from one lab.", "Give us a finished enzyme-engineering campaign and we will replay it at matched budget and show, in assays and days, where the decision could have been reached sooner."),
    ("A second assessor, from a different company.", "One is not enough for a verdict to travel with a publication, and we will not let the model that wrote a proof grade it."),
    ("A harder panel.", "Our own check showed a benchmark can measure its own composition. Send pairs we did not pick."),
]
y = Inches(2.4)
for head, body in asks:
    tbox(s, M, y, W - 2 * M, Inches(0.4), head, 17, True, INK)
    tbox(s, M, y + Inches(0.38), W - 2 * M - Inches(1), Inches(0.7), body, 12, False, MUTE, spacing=1.12)
    y += Inches(1.28)
tbox(s, M, H - Inches(1.1), W - 2 * M, Inches(0.5),
     "delphi-mission-control.ashenoy000.workers.dev/start/", 14, True, ACCENT)

prs.save(OUT)
print(f"{OUT.name}: {len(prs.slides.__iter__.__self__._sldIdLst)} slides, "
      f"{DATA['progress']['live']} live / {DATA['progress']['partial']} partial / {DATA['progress']['anticipated']} anticipated")
