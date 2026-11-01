#!/usr/bin/env python3
"""Build the PowerPoint from the same deck/data.json the HTML deck reads.

One source of numbers, two renderings: run build-deck.mjs first, then this.
Anticipated slides come out greyed with a hatched placeholder, exactly as on the web deck,
so a slide can never show a result that does not exist yet.

    python dashboard/make-pptx.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_AUTO_SIZE, PP_ALIGN
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
    # the box is created a sliver tall and grows to its text, so the border hugs the note
    box.text_frame.auto_size = MSO_AUTO_SIZE.SHAPE_TO_FIT_TEXT
    p = box.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = text
    r.font.size = Pt(11)
    r.font.color.rgb = INK
    r.font.name = "Segoe UI"
    return box



DECK = ROOT / "public/deck"
FACTS = N.get("facts") or {}
NEG = {n["id"]: n for n in (N.get("negatives") or [])}
SHOTS = {p["file"].replace("fig/page_", "").replace(".png", ""): p for p in (N.get("pageShots") or [])}


def picture(s, rel, x, y, w=None, h=None):
    """Place a real image (screenshot or render) if it exists; returns the shape or None."""
    f = DECK / rel
    if not f.exists():
        return None
    return s.shapes.add_picture(str(f), x, y, width=w, height=h)


def pageshot(s, key, x, y, w, lead=None, maxh=None):
    """A screenshot of one of our own pages, with where it came from written under it.
    No shot means no picture: the slide says so rather than showing a drawing."""
    p = SHOTS.get(key)
    if not p or not (DECK / p["file"]).exists():
        ghostbox(s, x, y, w, Inches(2.4), "No screenshot",
                 "the page did not render in the headless check, so nothing is shown here")
        return None
    pic = s.shapes.add_picture(str(DECK / p["file"]), x, y, width=w)
    room = maxh if maxh is not None else (H - y - Inches(1.25))
    if pic.height > room:  # keep the aspect ratio; the caption has to fit under it too
        pic.width = Emu(int(pic.width * room / pic.height))
        pic.height = Emu(int(room))
    tbox(s, x, y + pic.height + Inches(0.05), w, Inches(0.6),
         (lead or p["shows"]) + "  —  " + p["provenance"], 8, False, MUTE, spacing=1.08)
    return pic


def srcline(s, items):
    """The provenance rail: every slide that states a number says where to find it."""
    txt = "Read from " + "  ·  ".join([i for i in items if i])
    tbox(s, M, H - Inches(0.62), W - 2 * M, Inches(0.42), txt, 8, False, MUTE, spacing=1.05)


def tiles(s, pairs, y=Inches(2.25), col=SERIOUS):
    """A negative result's figures: four tiles of one finding, all in one tone."""
    x = M
    wide = Inches(2.95)
    for val, label in pairs:
        tbox(s, x, y, wide, Inches(0.95), val, 36, True, col)
        tbox(s, x, y + Inches(0.78), wide - Inches(0.25), Inches(0.9), label, 10, False, MUTE, spacing=1.12)
        x += wide + Inches(0.25)
    return y + Inches(1.7)



# Two-column geometry, stated once. A picture column and a text column that cannot overlap:
# M + PICW <= COLX, and COLX + COLW == W - M.
PICW = Inches(6.25)
COLX = Inches(7.35)
COLW = Inches(5.2)


def col(s, y, head, val, nt, vcol=S1, hw=Inches(3.9)):
    """One label / number / note row inside the right-hand text column."""
    tbox(s, COLX, y, hw, Inches(0.3), head, 12, True, INK)
    tbox(s, COLX + COLW - Inches(1.25), y, Inches(1.25), Inches(0.3), val, 13, True, vcol, align=PP_ALIGN.RIGHT)
    tbox(s, COLX, y + Inches(0.26), COLW, Inches(0.5), nt, 9, False, MUTE, spacing=1.1)
    return y + Inches(0.82)

# ═════════════════════════════════════════════════════════════════════ slides
# LeanBio Forum: the deliverable this deck pitches. The repository still calls it DELPHI; the two
# names refer to the same system (README.md, "The two names"). Twelve beats, in argument order.
EB = "LeanBio Forum · ScienceClaw 2026"

# ───────────────────────────────────────────────────────── 1-4 · the fire
s = new("Biology has never built the thing\nyou check a design against.", "live", EB)
tbox(s, M, Inches(2.5), Inches(8.8), Inches(1.2),
     "Mathematics has mathlib. Biology has papers, protocols and the people who know how to make them "
     "work. We are building the missing object: biological laws that hold in Lean, survive agent debate "
     "on the evidence, and then constrain what a design model is allowed to propose.",
     14, False, MUTE, spacing=1.2)
route_row(s, ["claim", "nanopub", "debate", "Lean", "axiom", "design", "validate"], Inches(4.25))
caption(s, "Everything in this deck runs. Where a result does not exist, the slide is greyed instead of "
           "guessed — including on our own headline claim, which fails.")

TA = FACTS.get("tacit") or {}
s = new("The knowledge that makes biology work\nis not written down.", STATE["tacit"]["state"], EB)
if TA.get("verified"):
    tbox(s, M, Inches(2.4), W - 2 * M, Inches(0.7), TA["sentence"], 15, False, INK, spacing=1.2)
    y = Inches(3.2)
    for lit in TA.get("literature", []):
        tbox(s, M, y, W - 2 * M, Inches(0.3), lit["cite"], 13, True, INK)
        tbox(s, M, y + Inches(0.27), W - 2 * M - Inches(0.6), Inches(0.42), lit["what"], 10, False, MUTE, spacing=1.1)
        y += Inches(0.76)
    note(s, y + Inches(0.1), TA["caveat"], SERIOUS)
    caption(s, "A claim about biology's own literature, not about agents. The gap is not that agents are "
               "weak at biology. It is that biology has never produced the formal artefact that would let "
               "anything — human or agent — check a design.")
    srcline(s, [TA.get("locator")])
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.4), "Not evidenced yet", STATE["tacit"].get("needs", ""))

s = new("So an agent has nothing to check against.", "live", EB)
rows(s, [
    ("In mathematics: a kernel proof",
     "An agent writes a statement, a proof assistant accepts or rejects it, and the verdict needs no "
     "referee. Agents are extremely good at this.", "verifiable", GOOD),
    ("In biology: a reviewer",
     "An agent proposes a design. Nothing can say whether it is consistent with what is already known, "
     "at any scale, because what is already known has no machine-checkable form.", "unverifiable", SERIOUS),
], y=Inches(2.3), gap=Inches(1.1))
note(s, Inches(4.6),
     "What is missing, precisely:  a statement of a biological law a machine can evaluate on a candidate "
     "design;  a way to tell a law that BINDS from one that merely sounds true;  a record of what each law "
     "rests on, so a later correction reaches every result built on it.", ACCENT)
caption(s, "A design model can generate a sequence all day. Without a formal object to check it against, "
           "every proposal is as good as every other, and the only filter left is an experiment that costs a year.")

ML, BF = FACTS.get("mathlib") or {}, FACTS.get("biologyFormal") or {}
FP = FACTS.get("formalisationPapers") or {}
greyed = not BF.get("verified")
s = new("The asymmetry, in one line.", "partial" if greyed else "live", EB)
hero(s, [
    (fmt(ML.get("theorems")) if ML.get("verified") else "—",
     f"theorems in mathlib, over {fmt(ML.get('definitions'))} definitions, from {fmt(ML.get('contributors'))} "
     f"contributors — {ML.get('asOf', '')}", S1),
    (fmt(FP.get("value")) if FP.get("verified") else "—",
     f"papers this year whose abstract talks about formalising maths in Lean; {FP.get('october')} in October "
     "alone. We counted these ourselves.", S4),
    ("?" if greyed else f"{BF.get('value')} of {BF.get('of')}",
     BF.get("claimWithoutANumber", "Nothing comparable exists for biology."), SERIOUS),
], y=Inches(2.15))
if greyed:
    note(s, Inches(4.2), "We will not put a number here.  " + BF.get("whyNoNumber", ""), SERIOUS)
else:
    tbox(s, M, Inches(4.15), W - 2 * M, Inches(0.5), BF.get("sentence", ""), 13, False, INK, spacing=1.18)
    nb = note(s, Inches(4.85), "What we are NOT claiming: " + BF.get("counterexamples", ""), SERIOUS, w=Inches(5.75))
    nb2 = note(s, Inches(4.85), "The narrow sense in which this is new: " + BF.get("narrowFirst", ""), ACCENT, w=Inches(5.75))
    nb2.left = M + Inches(6.0)
caption(s, "A bald “zero biology theorems” would be false, and the newest counterexample is six days old. "
           "The zero we can defend is a zero OF SOMETHING: zero of mathlib's 34 subject areas. You can check "
           "it from the stage.")
srcline(s, [ML.get("locator"), FP.get("locator"), BF.get("locator")])

AT = FACTS.get("attrition") or {}
s = new("That is why this is expensive.", "live" if AT.get("verified") else "anticipated", EB)
if AT.get("verified"):
    hero(s, [("9 in 10", "drug programmes that enter clinical trials never reach approval", S2)], y=Inches(2.2))
    tbox(s, M, Inches(3.9), Inches(8.6), Inches(1.0),
         "If almost everything that reaches a trial fails, the leverage is not in running more trials. It is "
         "in theoretical biology: knowing which experiment would change what you believe, before the "
         "experiment is paid for.", 14, False, INK, spacing=1.2)
    note(s, Inches(5.0), "Say it exactly this way.  " + AT.get("trap", ""), SERIOUS)
    if AT.get("corrigendum"):
        tbox(s, M, H - Inches(1.9), W - 2 * M, Inches(0.5), "Corrigendum: " + AT["corrigendum"], 9, False, MUTE, spacing=1.1)
    srcline(s, AT.get("sources", []) + [AT.get("range", "")])
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.4), "Not evidenced yet", STATE["attrition"].get("needs", ""))

# ───────────────────────────────────────────────────────── 5-7 · the Forum
LR = N.get("lawreg")
s = new("LeanBio Forum: a theorem becomes an axiom\nonly if it survives both gates.",
        STATE["forum"]["state"], EB)
x = M
for k, v in [("upload", "a nanopub-backed theorem"), ("debate", "agents argue it on the evidence"),
             ("Lean", "the kernel checks it follows"), ("axiom", "it may now constrain a design"),
             ("or", "rejected, contested or retired — kept, with its reason")]:
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(2.45), Inches(2.3), Inches(0.95))
    box.fill.solid()
    box.fill.fore_color.rgb = PAPER
    box.line.color.rgb = ACCENT if k in ("debate", "Lean") else RGBColor(0xD9, 0xDF, 0xDB)
    box.shadow.inherit = False
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = k.upper()
    r.font.size, r.font.bold, r.font.color.rgb = Pt(9), True, MUTE
    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run()
    r2.text = v
    r2.font.size, r2.font.color.rgb = Pt(10), INK
    x += Inches(2.42)
if LR:
    statuses = LR.get("inLawset", [])
    barchart(s, [r["status"] for r in statuses],
             [("laws in lawset " + LR["lawset"], tuple(r["n"] for r in statuses))],
             y=Inches(3.7), height=Inches(2.6), colors=[S3])
tbox(s, M, H - Inches(1.5), W - 2 * M, Inches(0.9),
     "Both gates, or neither. A statement that compiles but loses the debate is not a law; one that wins the "
     "debate but does not follow from its premises is not a law either. Neither failure is deleted: it is "
     "recorded with its reason, so nobody proposes it again.", 11, False, MUTE, spacing=1.15)
srcline(s, ["lean/registry/lawsets/current.json", "lean/registry/laws/*.json"] if LR else [])

s = new("Today's theorems came out of four books.", STATE["provenance"]["state"], EB)
y = Inches(2.3)
for head, nt, val, vcol in [
        ("Darwin — On the Origin of Species, 1859", "Sentences read from the source text itself", "primary", S1),
        ("Thompson — On Growth and Form, 1917", "Scaling and growth claims, taken verbatim and then operationalised", "primary", S1),
        ("Turing — reaction–diffusion", "Reached through the mathematical-biology literature that formalised it", "secondary", S4),
        ("Wolfram — A New Kind of Science", "Computation-in-biology claims, the least dataset-shaped of the four", "tertiary", GHOST)]:
    tbox(s, M, y, Inches(4.6), Inches(0.3), head, 12, True, INK)
    tbox(s, M + Inches(4.7), y, Inches(1.3), Inches(0.3), val, 11, True, vcol)
    tbox(s, M, y + Inches(0.26), PICW, Inches(0.5), nt, 9, False, MUTE, spacing=1.1)
    y += Inches(0.86)
pageshot(s, "graph", COLX, Inches(2.25), COLW,
         "The claim graph as served: each claim linked to the tests that checked it and the theorem that formalised it")
LT = N.get("leanTruth") or {}
if LT:
    note(s, Inches(6.05),
         f"And then almost none of it was proved. Of the {fmt(LT.get('claimsExtracted'))} claims we extracted "
         "from these books, FOUR are proved in the built Lean library — all four Thompson's, none Darwin's, "
         "none Wolfram's. " + LT.get("avesNote", "") + " So two of the four are not on any slide here.", SERIOUS)
caption(s, "Decentralised agent swarms distilled the assertions into nanopublications and argued the evidence "
           "sources BEFORE anything was formalised. Formalising first would have produced beautiful proofs of "
           "sentences nobody had checked anyone actually wrote.", y=H - Inches(1.05))
srcline(s, ["docs/claims.json", "darwin-origin/", "thompson-growth-form/", "wolfram-nks/", "math-bio-theorems/"])

ARMS = N.get("swarmArms") or []
s = new("The distillation was done by a swarm,\nand we measured whether that mattered.", STATE["swarm"]["state"], EB)
if ARMS:
    label = {"centralized": "Swarm, led", "decentralized": "Swarm, peer-to-peer",
             "isolated": "Workers, isolated", "single": "One agent alone"}
    barchart(s, [label.get(a["key"], a["key"]) for a in ARMS],
             [("run 1, verified of 20", tuple(a.get("exp1") or 0 for a in ARMS)),
              ("run 2, verified of 20", tuple(a.get("exp2") or 0 for a in ARMS))],
             y=Inches(2.4), height=Inches(3.3), colors=[S1, S4], legend=True)
    caption(s, "Each arm wrote 20 pre-registered test plans, each naming one real public dataset. Both numbers "
               "are plans whose dataset URL and DOI a script could actually fetch — same model, same prompt, "
               "same schema, same budget. "
               + ("No arm fabricated a single identifier: every URL was fetched once by script, and a 404 counts "
                  "as fabrication, not bad luck." if N.get("swarmFabricated") == 0 else ""))
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.6), "Not evidenced yet", STATE["swarm"].get("needs", ""))
srcline(s, ["swarm/PREREG.md", "swarm/compare/results.json", "swarm/compare/verify.mjs"])

# The one slide that is deliberately empty until an experiment that is running right now reports.
s = new("Single agent vs decentralised swarm vs\ncentralised swarm, across four levels.", "anticipated", EB)
ghostbox(s, M, Inches(2.5), Inches(6.0), Inches(2.4), "Running now",
         "Ground truth is frozen (swarm/benchmark/fixtures/gt-l4-t1…t3). No arm has reported. "
         "This slide fills in or stays grey.")
note2 = s.shapes.add_textbox(W - M - Inches(5.6), Inches(2.5), Inches(5.6), Inches(2.4))
note2.text_frame.word_wrap = True
for i, ln in enumerate([
        "What it will and will not settle",
        "— Four task levels of increasing difficulty, the same three organisations on each.",
        "— Ground truth was written and frozen BEFORE any arm ran, so a late result cannot be fitted to it.",
        "— It compares organisations on one task family. It is not a claim about swarms in general."]):
    p = note2.text_frame.paragraphs[0] if i == 0 else note2.text_frame.add_paragraph()
    p.line_spacing = 1.15
    r = p.add_run()
    r.text = ln
    r.font.size = Pt(11 if i else 10)
    r.font.bold = i == 0
    r.font.color.rgb = MUTE if i else GHOST
    r.font.name = "Segoe UI"
caption(s, "The deck reads the same whether or not this fills. We would rather hand you a grey slide than a "
           "number we chose after seeing it.")
srcline(s, ["swarm/benchmark/fixtures/", "swarm/PREREG.md"])

s = new("Served as an MCP server,\nso an agent can ask it things.", STATE["mcp"]["state"], EB)
pageshot(s, "capability", M, Inches(2.4), PICW,
         "The capability map, live: who would use this, what they would ask, and every tool that is missing")
y = Inches(2.4)
for head, val, nt in [
        ("Personas", "14", "One per person or agent with a reason to open a formalised law registry over biology"),
        ("Use cases", "32", "One row per job, with the tool sequence that answers it today; 9 answerable now, 8 not"),
        ("Grand questions", "14", "Each split into the formalisable core and the empirical remainder"),
        ("Ranked tool gaps", "27", "Ranked at build time; a test tampers with a stored rank to prove no gap can assert its own importance")]:
    y = col(s, y, head, val, nt)
note2 = note(s, y + Inches(0.1),
             "And what it cannot do: most of these questions are mostly empirical remainder. A capability map "
             "that let progress on the formal part be read as progress on the empirical part would be worse "
             "than no map.", SERIOUS, w=COLW)
note2.left = COLX
srcline(s, ["/leanbio/capability.html", "pipeline/leanbio/capability-map/build.mjs"])

# ───────────────────────────────────────── 8-9 · what the theorems constrain
AN = N.get("anatomy")
s = new("Those theorems constrain\na text-to-organism model.", STATE["constrain"]["state"], EB)
pageshot(s, "blueprint", M, Inches(2.4), PICW,
         "The blueprint the studio writes into: a morphological change on a base organism, resolved down every layer")
tbox(s, COLX, Inches(2.4), COLW, Inches(1.1),
     "You type a phenotype. The model has to say which genetic change produces it, at every layer and at "
     "every developmental stage — and every layer it touches is an existing ontology term, so a law can be "
     "evaluated on it.", 12, False, INK, spacing=1.18)
if AN:
    y = Inches(3.7)
    for head, val, nt in [
            ("Named pieces across the models", str(AN["pieces"]), "flying fish, adult zebrafish, larval zebrafish"),
            ("Mapped to an ontology term", str(AN["mapped"]), f"{AN['unmapped']} are not, and are shown as unmapped rather than quietly dropped"),
            ("Values that are a real measurement", str(AN["sourcedValues"]), "everything else in the flying-fish model is schematic, and the page says so")]:
        y = col(s, y, head, val, nt)
    nb = note(s, y, "One measured proportion carries the flying-fish model: pectoral fin length 0.687 of "
                    "standard length, n = 49 museum specimens. Body depth, fin spread, organ shapes and every "
                    "count are illustrative.", SERIOUS, w=COLW)
    nb.left = COLX
srcline(s, ["anatomy-model/manifest.json", "Daane et al. 2021, doi 10.1016/j.cub.2021.08.054"])

RF = N.get("lawRowFacts") or {}
s = new("A law that binds nothing\nis worse than no law.", STATE["lawreg"]["state"], EB)
if LR:
    rows(s, [
        (f"Laws in lawset {LR['lawset']}", "versioned, pinned to a commit, and mirrored into the MCP server",
         str(LR["inLawsetTotal"]), INK),
        ("Accepted", "may rule a design out", str(RF.get("accepted", "—")), GOOD),
        ("… of which produce NO design row",
         "each with a written reason and what would make it bind; the check fails if an entry stops being true",
         str(RF.get("noDesignRow", "—")), SERIOUS),
        ("Retired, never deleted", "so an older lawset still reproduces",
         str(next((r["n"] for r in LR.get("inLawset", []) if r["status"] == "retired"), 0)), MUTE),
    ], y=Inches(2.35), gap=Inches(0.8), vw=Inches(1.6))
    tbox(s, M, Inches(5.6), W - 2 * M, Inches(1.3),
         "Three of the fifteen reasons, verbatim:\n"
         "kimura-fixation-probability — fixation probability of an allele in a population; a design commits no population size or selection coefficient.\n"
         "scaling-bending-law — the section modulus needs a cross-section; the resolved state carries none, so no design can be judged.\n"
         "fick-principle — it is the named hypothesis the aerobic bound rests on, not the law that rules anything out, so it owns no constraint.",
         9, False, MUTE, spacing=1.2)
srcline(s, ["lean/registry/check-exposed.mjs", "lean/registry/lawsets/current.json", "mcp/server.mjs"])

STU = N.get("studio")
s = new("Design Studio: type the phenotype,\nget the criteria.", STATE["studio"]["state"], EB)
if STU and STU.get("shot"):
    sh = STU["shot"]
    pic = picture(s, sh["file"], M, Inches(2.4), w=PICW)
    if pic:
        tbox(s, M, Inches(2.4) + pic.height + Inches(0.05), PICW, Inches(0.6),
             f"Typed into the live studio, not a mock-up: “{sh['typed']}” — {sh.get('criteria')} criteria parsed, "
             + ("valid against the engine." if sh.get("valid") else "NOT valid against the engine."),
             8, False, MUTE, spacing=1.08)
    tbox(s, COLX, Inches(2.4), COLW, Inches(1.4),
         "The studio turns a sentence into criteria the engine can actually run. A clause it cannot parse is "
         "shown in red and is NOT checked by anything downstream, rather than being silently dropped.",
         12, False, INK, spacing=1.18)
    tbox(s, COLX, Inches(3.9), COLW, Inches(1.4),
         f"{len(STU.get('scenarios', []))} scenarios the engine runs:\n" + ", ".join(STU.get("scenarios", [])),
         10, False, MUTE, spacing=1.15)
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.6), "Not evidenced yet", STATE["studio"].get("needs", ""))
srcline(s, STU.get("sources", []) if STU else [])

s = new("Then physics, flow and development\nstress-test it.", STATE["sim"]["state"], EB)
pageshot(s, "physics", M, Inches(2.4), PICW,
         "The flying-fish simulator: the solver computes the trajectory and the anatomy meshes fly it, sample by sample")
y = Inches(2.4)
for head, val, nt, col__ in [
        ("Physics simulation", "runs", "A glide solver over the design's own mesh and mass, with ground effect, headwind, altitude and depth as parameters", GOOD),
        ("Developmental simulation", "runs", "The same design resolved at each stage, so a criterion can be demanded at adult and failed at larva", GOOD),
        ("Flow matching", "not here yet", "The generative half of the design model; nothing in this deck rests on it", SERIOUS)]:
    col_ = col__
    y = col(s, y, head, val, nt, vcol=col_)
nb = note(s, y, "The simulator page carries its own banner: NOT A VALIDATED RESULT. Tests 1 to 3 are post-hoc, "
                "and under the pre-registered upper bound the model lets a real fish gain net energy — which "
                "shows the tuned launch thrust to be unphysical. Both outcomes are in the run log; nothing was "
                "retuned.", SERIOUS, w=COLW)
nb.left = COLX
srcline(s, ["/t/physics/sim/", "physics/sim/RUNS.md", "physics/PREREG.md"])

# ───────────────────────────── 10 · the harness, and then what it said
s = new("The validation harness, in four moves.", STATE["harness"]["state"], EB)
x = M
for k, v in [("step 1", "take the predicted sequence and the desired function"),
             ("step 2", "find the closest FUNCTIONAL analogue, not the closest relative"),
             ("step 3", "annotate every functional difference, interpretably"),
             ("step 4", "score formally in LeanBio, then run physics on the mesh")]:
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(2.35), Inches(2.95), Inches(1.0))
    box.fill.solid()
    box.fill.fore_color.rgb = PAPER
    box.line.color.rgb = ACCENT
    box.shadow.inherit = False
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = k.upper()
    r.font.size, r.font.bold, r.font.color.rgb = Pt(9), True, MUTE
    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run()
    r2.text = v
    r2.font.size, r2.font.color.rgb = Pt(10), INK
    x += Inches(3.07)
pageshot(s, "validate", M, Inches(3.6), PICW,
         "The harness on the headline design, at the physics act: five named results, each with its own gate",
         maxh=Inches(3.0))
tbox(s, COLX, Inches(3.6), COLW, Inches(1.5),
     "Five named results, side by side, each with its own gate. They are never summed. Where the evidence "
     "does not exist the page leaves a marked gap instead of drawing something pretty — nine gaps on this run.",
     12, False, INK, spacing=1.18)
nb = note(s, Inches(5.2), "On the run shown: 1 pass · 2 fail · 2 not assessed. The next three slides are what "
                          "the two failures and the gaps actually say.", SERIOUS, w=COLW)
nb.left = COLX
srcline(s, ["sim-engine/validate/pipeline/index.mjs", "dashboard/public/validate-show/run-winged-zebrafish.json"])

PG = NEG.get("physicsgate")
s = new("Our headline design does not fly.", "live" if PG else "anticipated", EB)
if PG:
    y = tiles(s, PG["figures"])
    tbox(s, M, y, W - 2 * M - Inches(1.5), Inches(1.0), PG["detail"], 14, False, INK, spacing=1.2)
    note(s, y + Inches(1.1),
         "This is the design the whole deck is built around, and the gate it fails is the one that matters. A "
         "deck that claimed a working flying fish would lose to one honest question; this is the answer to that "
         "question, put on a slide before anyone has to ask it.", SERIOUS)
    srcline(s, [PG["locator"]])
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.6), "Not evidenced yet", STATE["physicsgate"].get("needs", ""))

FR = NEG.get("funcledger")
s = new("And the negative control scores\nexactly as well.", "live" if FR else "anticipated", EB)
if FR:
    y = tiles(s, FR["figures"], y=Inches(2.35))
    tbox(s, M, y, W - 2 * M - Inches(1.5), Inches(1.0), FR["detail"], 13, False, INK, spacing=1.2)
    note(s, Inches(5.5),
         "Why that is the sharpest result we have: on this ledger the designed fish is exactly as far from the "
         "flying fish's known requirement set as an unedited zebrafish is. The control was pre-registered, and "
         "it behaved as it must.   ·   What the ledger is not: every requirement is a SEQUENCE STATE of the "
         "analogue, never a measured function of it. Zero of the loci have functional data of any kind.", SERIOUS)
    srcline(s, [FR["locator"]])
else:
    ghostbox(s, M, Inches(2.4), W - 2 * M, Inches(2.6), "Not evidenced yet", STATE["funcledger"].get("needs", ""))

WANT = ("compensation", "edges", "deadlaws", "noapproval", "nevertried")
GOT = [NEG[i] for i in WANT if i in NEG]
_count = ["No", "One", "Two", "Three", "Four", "Five", "Six"][len(GOT)] if len(GOT) < 7 else str(len(GOT))
s = new(f"{_count} more results that go against us.", "live" if len(GOT) == len(WANT) else "partial", EB)
y = Inches(2.25)
for n in GOT:
    tbox(s, M, y, W - 2 * M - Inches(2.2), Inches(0.3), n["headline"], 14, True, INK)
    tbox(s, W - M - Inches(2.0), y, Inches(2.0), Inches(0.3), n.get("keyFigure", ""), 14, True, SERIOUS, align=PP_ALIGN.RIGHT)
    tbox(s, M, y + Inches(0.26), W - 2 * M - Inches(2.4), Inches(0.64), n["detail"], 9, False, MUTE, spacing=1.1)
    y += Inches(0.96)
if len(GOT) < len(WANT):
    note(s, y, f"{len(WANT) - len(GOT)} further result(s) are not shown: their source file no longer says what "
               "this deck claimed, so the claim was dropped rather than reprinted.", SERIOUS)
caption(s, "Each one is read back out of its own source file at build time. If a number drifts, the row "
           "disappears from this slide rather than quietly going stale.")
srcline(s, [n["locator"] for n in GOT])

s = new("We are not going to give you one number.", "live", EB)
tbox(s, M, Inches(2.3), Inches(6.0), Inches(1.0),
     "Three different composite values for this same design are under investigation right now. Until that is "
     "settled, no composite score goes on any slide, in any deck, or into any record. You get the gates.",
     13, False, INK, spacing=1.2)
y = Inches(3.5)
for head, val, nt, col in [
        ("Physics gate", "FAIL", "the design does not do what was asked", SERIOUS),
        ("Functional-analogue ledger", "FAIL", "19 differences unresolved; the unedited control scores the same", SERIOUS),
        ("Phenotype similarity", "PASS", "the one gate it clears", GOOD),
        ("Genotype similarity", "CANNOT ASSESS", "no gene-level edit, so no sequence was compared. This is not a pass.", GHOST),
        ("Lean law check", "CANNOT ASSESS", "25 cannot-evaluate, 10 out of scope", GHOST)]:
    tbox(s, M, y, Inches(4.2), Inches(0.3), head, 13, True, INK)
    tbox(s, M + Inches(4.3), y, Inches(2.2), Inches(0.3), val, 13, True, col)
    tbox(s, M + Inches(6.6), y, Inches(5.0), Inches(0.42), nt, 10, False, MUTE, spacing=1.1)
    y += Inches(0.62)
note(s, y + Inches(0.1),
     "Why a single score is the dangerous output: a composite hides which gate failed and lets “cannot assess” "
     "average against “pass”. Two of the five results above are not verdicts at all. Summing them would turn an "
     "absence of evidence into a middling grade, which is the one thing this system exists to prevent.", SERIOUS)
srcline(s, ["run-winged-zebrafish.json → verdict", "sim-engine/validate/SCORER-RESULTS.md"])

# ───────────────────────── 11-12 · the second server, and the round trip
SV = N.get("studioval")
s = new("Design studio and harness,\nserved as a second MCP server.", STATE["secondmcp"]["state"], EB)
tbox(s, M, Inches(2.4), Inches(6.2), Inches(1.0),
     "Two servers, two jobs. The first answers questions about the law registry. The second takes a phenotype, "
     "returns a design, and validates it — so an agent can run the whole loop without a human in it.",
     13, False, INK, spacing=1.2)
if SV:
    t = SV.get("tally", {})
    rows(s, [
        ("Rows scored by the harness", "against a pre-registration hashed before the first number was produced",
         str(SV.get("scored", "—")), INK),
        ("Pass", "the prediction matched a target taken from the literature", str(t.get("pass", "—")), GOOD),
        ("Circular", "the engine was asked to reproduce a number it was given. Counted, named, never scored as a pass.",
         str(t.get("circular", "—")), SERIOUS),
        ("Fail", "the prediction missed its target", str(t.get("fail", "—")), SERIOUS),
        ("Self-test", "every assertion was checked to be capable of failing before it was trusted",
         f"{(SV.get('selftest') or {}).get('ok', '—')} of {(SV.get('selftest') or {}).get('total', '—')}", GOOD),
    ], y=Inches(3.6), gap=Inches(0.62), vw=Inches(1.6))
    note(s, H - Inches(1.6),
         "The circular rows are the point: five of the scored rows reproduced a value that had been fed into "
         "the engine. A harness that counted those as passes would report a working validator. Ours labels them "
         "and keeps them visible on the scorecard.", SERIOUS)
srcline(s, ["mcp/server.mjs", "sim-engine/validate/SCORER-RESULTS.md", "sim-engine/contract.json"])

s = new("The round trip.", "anticipated", EB)
route_row(s, ["phenotype", "design", "sequence", "fresh session", "design", "phenotype?"], Inches(2.45))
ghostbox(s, M, Inches(3.5), Inches(5.9), Inches(1.9), "Not run", STATE["roundtrip"].get("needs", ""))
rt = s.shapes.add_textbox(W - M - Inches(5.9), Inches(3.5), Inches(5.9), Inches(1.9))
rt.text_frame.word_wrap = True
for i, ln in enumerate([
        "Why it is the test that matters",
        "Feed the predicted sequence back into Design Studio in a session that has never seen the original ask, "
        "and see whether the phenotype comes back. It is the one check the system cannot pass by remembering, and "
        "the only one that would show the mapping is a mapping rather than a lookup."]):
    p = rt.text_frame.paragraphs[0] if i == 0 else rt.text_frame.add_paragraph()
    p.line_spacing = 1.18
    r = p.add_run()
    r.text = ln
    r.font.size = Pt(11 if i == 0 else 10)
    r.font.bold = i == 0
    r.font.color.rgb = MUTE if i == 0 else INK
    r.font.name = "Segoe UI"
caption(s, "Both halves exist and both are served. Nothing has been run end to end and back, so this slide "
           "stays grey.")

CR, RC = N.get("corrections"), N.get("records") or {}
s = new("What we are not claiming.", "live", EB)
lines = [
    "No wet lab. Nothing here was measured at a bench by us; no organism, protein or variant was made.",
    "No proof about biology. Every theorem says a conclusion follows from premises. That any organism "
    "satisfies those premises is assumed, and a kernel proof is silent on it.",
    "We did not design an organism. The “designed” fish is Daane et al. 2021's published double "
    "heterozygote, and our pre-registered test of it came back unsupported. The apparatus is ours; the animal is not.",
]
if CR:
    lines.append(f"{CR['total']} of our own claims were corrected in one day — {CR['ours']} by our own checks, "
                 f"{CR['collaborator']} by a collaborator's independent cross-check. Each was withdrawn or "
                 "narrowed in public, never as a silent edit.")
NP = N.get("nanopubTruth") or {}
if NP:
    lines.append(f"Published, and that cuts both ways. {fmt(NP['onProduction'])} of our records are live on the "
                 f"public production nanopub registry ({fmt(NP['darwinOnProduction'])} Darwin claims, "
                 f"{NP['mathBioOnProduction']} classical math-biology theorems, {NP['approverNote']}); "
                 f"{fmt(NP['signed'])} are signed in all. But {fmt(NP['withNoApprovalField'])} of the "
                 f"{fmt(NP['onProduction'])} carry no approval field at all. A further "
                 f"{NP['unsignedThreadDrafts']} thread drafts are written and deliberately unsigned, and "
                 f"{NP['avesDraftsExcluded']} Aves-holdout drafts are excluded from every count here.")
lines.append("No bird data anywhere. Class Aves is a frozen holdout, excluded at build time from every layer, "
             "figure and record in this deck.")
y = Inches(2.3)
for ln in lines:
    tbox(s, M, y, W - 2 * M, Inches(0.8), "—  " + ln, 12, False, INK, spacing=1.15)
    y += Inches(0.78)
caption(s, "All of this is on the public dashboard too, next to the result it limits.")

s = new("What we want.", "live", EB)
y = Inches(2.4)
for head, body in [
        ("Laws, from people who own them.",
         "Upload a theorem with its nanopub. If it holds in Lean and survives the debate, it becomes an axiom "
         "that constrains every design after it — and it keeps your name on it."),
        ("One functional assay on a non-model organism.",
         "Zero of the 73 requirements in our ledger have functional data of any kind. One real assay would move "
         "more rows than another year of sequence."),
        ("A second kernel, and a second debate.",
         "We will not let the system that wrote a proof grade it. Run the registry against your own checker and "
         "tell us where it disagrees.")]:
    tbox(s, M, y, W - 2 * M, Inches(0.4), head, 17, True, INK)
    tbox(s, M, y + Inches(0.38), W - 2 * M - Inches(1), Inches(0.7), body, 12, False, MUTE, spacing=1.12)
    y += Inches(1.3)
tbox(s, M, H - Inches(1.5), W - 2 * M, Inches(0.4),
     "LeanBio Forum — the system this repository still calls DELPHI.", 14, True, INK)
tbox(s, M, H - Inches(1.05), W - 2 * M, Inches(0.4),
     "delphi-mission-control.ashenoy000.workers.dev", 13, True, ACCENT)

# ---------------------------------------------------------------- geometry check
# PowerPoint is laid out blind: nothing here renders, so a column that runs off the slide or a
# picture that sits on top of a paragraph is invisible until someone opens the file in front of an
# audience. This fails the build instead.
def _box(sh):
    return (sh.left or 0, sh.top or 0, (sh.left or 0) + (sh.width or 0), (sh.top or 0) + (sh.height or 0))


def _overlap(a, b):
    return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))


SLIDE_IDS = [x["id"] for x in DATA["slides"]]
faults = []
SLACK = Emu(int(Inches(0.04)))
for i, sl in enumerate(prs.slides):
    sid = SLIDE_IDS[i] if i < len(SLIDE_IDS) else f"#{i}"
    pics, texts = [], []
    for sh in sl.shapes:
        b = _box(sh)
        if b[2] > W + SLACK or b[3] > H + SLACK or b[0] < -SLACK or b[1] < -SLACK:
            faults.append(f"{sid}: a shape runs off the slide ({b[0]/914400:.2f},{b[1]/914400:.2f} to {b[2]/914400:.2f},{b[3]/914400:.2f} in)")
        if sh.shape_type == 13:
            pics.append((sh, b))
        elif sh.has_text_frame and sh.text_frame.text.strip():
            texts.append((sh, b))
    # a picture covering a paragraph is the fault that actually happens, and only on two-column slides
    for _, pb in pics:
        for sh, tb in texts:
            ov = _overlap(pb, tb)
            if ov > 0 and ov > 0.25 * max(1, (tb[2] - tb[0]) * (tb[3] - tb[1])):
                faults.append(f"{sid}: a picture covers the text \"{sh.text_frame.text.strip()[:44]}…\"")
if faults:
    print(f"\n{len(faults)} LAYOUT FAULT(S):")
    for f in faults:
        print("  - " + f)
    raise SystemExit(1)

prs.save(OUT)
print(f"{OUT.name}: {len(prs.slides.__iter__.__self__._sldIdLst)} slides, "
      f"{DATA['progress']['live']} live / {DATA['progress']['partial']} partial / "
      f"{DATA['progress']['anticipated']} anticipated")
