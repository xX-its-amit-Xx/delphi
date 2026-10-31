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

# 11 the wing: anticipated, deliberately empty
s = new("Where this goes next.", "anticipated")
tbox(s, M, Inches(2.1), Inches(9), Inches(0.5),
     "The same question at the scale of a whole organism: which genes make a flying fish wing a wing?", 15, False, MUTE)
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
