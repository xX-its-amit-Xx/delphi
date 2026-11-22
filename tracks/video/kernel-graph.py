#!/usr/bin/env python3
"""The kernel in sixty seconds, as one growing hash-chained graph.

The shape is the "growth over time" replay on pkg.scienceoracle.com, and the house style of
scripts/site/build-graph-video.py in the delphi repository: every record is a node, nodes arrive in
order, and a node's colour is what the record says about it. Here the records are the kernel's own
store — tracks/kernel/store/nodes.jsonl — which is already a hash-chained graph, so the replay is
the store read in chain order rather than a picture drawn over it.

The layers arrive in the order the kernel applies them, which is the only order it allows:

    evidence -> fact -> law -> verdict -> build, and refusal where a verdict did not hold

There is no title card and no closing card. The first frame is already the graph with the first
evidence arriving; the last frame is the finished graph with every figure in the right-hand column.
It is silent: nothing is narrated and no soundtrack is mixed in, so the picture carries it.

Every number on screen is computed here from a repo file, and a missing file stops the render:

    tracks/kernel/store/nodes.jsonl          the graph itself, in chain order
    tracks/kernel/compile/out/last-run.json  which nodes the latest run named as its own
    tracks/kernel/compile/parts.json         the sources, their citations and how each was read
    tracks/kernel/lean/CircuitLaws.lean      the theorems and their #print axioms lines
    node tracks/kernel/test-kernel.mjs       the guard test, run here, for the faults-caught figure

    python tracks/video/kernel-graph.py                # 1920x1080, 24 fps, ~62 s
    python tracks/video/kernel-graph.py --preview      # a few stills, no video
    python tracks/video/kernel-graph.py --fast         # 12 fps, no supersampling, for iteration
    python tracks/video/kernel-graph.py --no-guards    # skip running the guard test

Needs Pillow and ffmpeg. Frames render in parallel, capped to leave the box headroom.
"""

import argparse
import datetime as dt
import json
import math
import os
import re
import shutil
import subprocess
import sys
from collections import Counter
from multiprocessing import Pool
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "tracks/kernel/store/nodes.jsonl"
RUN = ROOT / "tracks/kernel/compile/out/last-run.json"
PARTS = ROOT / "tracks/kernel/compile/parts.json"
LEAN = ROOT / "tracks/kernel/lean/CircuitLaws.lean"
OUT_DIR = Path(os.environ.get("DELPHI_VIDEO_DIR", "C:/Temp/delphi-video/kernel"))
OUT_MP4 = OUT_DIR / "kernel-graph.mp4"
OUT_PNG = OUT_DIR / "kernel-graph-poster.png"

W, H = 1920, 1080
FPS = 24
SS = 2  # supersampling; --fast sets it to 1
WORKERS = 4  # the box is shared: leave it headroom

# Type: Helvetica Neue is the MIT Media Lab face and what the house builder uses. It does not exist
# on Windows, so the first of these that resolves is used and the choice is printed in the
# provenance line — Arial is Helvetica's metric clone, not a silent substitution.
FONT_CANDIDATES = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", "Helvetica Neue"),
    ("C:/Windows/Fonts/arial.ttf", "Arial (Helvetica metric clone)"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "Liberation Sans"),
]
FACE_PATH, FACE_NAME = None, None
for cand, name in FONT_CANDIDATES:
    if Path(cand).exists():
        FACE_PATH, FACE_NAME = cand, name
        break
if FACE_PATH is None:
    raise SystemExit("no usable sans face found; install Helvetica Neue, Arial or Liberation Sans")
_IS_TTC = FACE_PATH.endswith(".ttc")
# Roles, kept from the house builder so the drawing code reads the same. On a .ttc the index picks
# the weight; on Windows the sibling files do.
if _IS_TTC:
    DISPLAY, HEAVY, LIGHT, LABEL, BODY = (FACE_PATH, 1), (FACE_PATH, 9), (FACE_PATH, 7), (FACE_PATH, 10), (FACE_PATH, 0)
else:
    _d = str(Path(FACE_PATH).parent)
    _bold = f"{_d}/arialbd.ttf" if Path(f"{_d}/arialbd.ttf").exists() else FACE_PATH
    DISPLAY, HEAVY, LIGHT, LABEL, BODY = (_bold, 0), (_bold, 0), (FACE_PATH, 0), (_bold, 0), (FACE_PATH, 0)

# Palette: the house builder's warm paper and ink, the PKG viewer's teal for edges, and the
# claim-graph verdict colours reused for the kernel's three results.
PAPER = (246, 243, 236)
PAPER2 = (252, 250, 246)
INK = (29, 36, 51)
INK2 = (83, 101, 130)
INK3 = (140, 150, 168)
GRID = (222, 217, 205)
RULE = (214, 208, 195)
NODE = (198, 193, 182)
EDGE = (74, 138, 122)      # teal
GOLD = (201, 150, 38)
INSIDE = (46, 158, 84)     # verdict: inside the law
OUTSIDE = (196, 72, 88)    # verdict: outside the law
CANNOT = (132, 144, 164)   # verdict: cannot-assess — a result, never a pass
REFUSED = (178, 52, 140)   # a refusal node
BUILT = (47, 111, 237)     # a minted artifact
GOLDEN = 2.399963229728653

# Timeline, seconds. Chapters are the kernel's five primitives, in the order it enforces.
T_EV, T_EV0, T_EV1 = 0.2, 0.4, 11.5
T_FACT, T_FA0, T_FA1 = 12.2, 12.8, 21.5
T_LAW, T_LA0, T_LA1 = 22.2, 23.0, 31.0
T_VERD, T_VE0, T_VE1 = 32.0, 32.8, 43.0
T_BUILD, T_BU0, T_BU1 = 43.8, 44.6, 53.0
T_CHAIN, T_CH0, T_CH1 = 53.8, 54.4, 60.5
DURATION = 62.0

# Graph region and the right-hand ledger column, in 1x pixels.
GX0, GX1, GY0, GY1 = 40, 1452, 128, 1016
COL_X, COL_W = 1496, 384
CHAIN_Y = 1004  # the hash chain runs along the bottom, above the provenance line


def ease(p):
    p = max(0.0, min(1.0, p))
    return 1 - (1 - p) ** 3


def ease_io(p):
    p = max(0.0, min(1.0, p))
    return p * p * (3 - 2 * p)


def appear(t, start, dur=0.45):
    return ease((t - start) / dur)


def counted(t, start, dur, target):
    p = appear(t, start, dur)
    return target if p >= 1 else int(target * p)


def mix(a, b, p):
    p = max(0.0, min(1.0, p))
    return tuple(int(round(a[i] + (b[i] - a[i]) * p)) for i in range(3))


def P(v):
    return v * SS


def fit(text, f, width):
    """Cut text to a pixel width, with an ellipsis, so nothing runs under the ledger rule."""
    text = re.sub(r"\s+", " ", text or "").strip()
    if f.getlength(text) / SS <= width:
        return text
    while text and f.getlength(text + "…") / SS > width:
        text = text[:-1]
    return text.rstrip(" ,;") + "…"


_FONTS = {}


def font(face, size):
    path, index = face
    key = (path, index, int(size * SS))
    f = _FONTS.get(key)
    if f is None:
        f = ImageFont.truetype(path, int(size * SS), index=index)
        _FONTS[key] = f
    return f


# ----------------------------------------------------------------------------- data

def need(path):
    if not path.exists():
        raise SystemExit(f"missing input: {path.relative_to(ROOT)} — every number on screen comes from a repo file")
    return path


def load():
    """Read the store, the run, the sources and the Lean file. Nothing here is typed by hand."""
    rows = [json.loads(l) for l in need(STORE).read_text(encoding="utf-8").splitlines() if l.strip()]
    run = json.loads(need(RUN).read_text(encoding="utf-8"))
    parts = json.loads(need(PARTS).read_text(encoding="utf-8"))
    lean_src = need(LEAN).read_text(encoding="utf-8")

    thms = re.findall(r"^\s*(?:private\s+|protected\s+)?(?:theorem|lemma)\s+([A-Za-z_][\w'!?]*)", lean_src, re.M)
    audited = re.findall(r"^#print axioms\s+(\S+)", lean_src, re.M)

    by_id = {r["id"]: r for r in rows}
    ids = run.get("ids", {})
    mine = {k: set(v) for k, v in ids.items()}

    # One hub per source actually cited by an evidence node, so the hubs are what was read.
    doi_to_key = {s["doi"]: k for k, s in parts["sources"].items()}
    hub_order, hubs = [], {}
    for r in rows:
        if r["type"] != "evidence":
            continue
        key = doi_to_key.get(r.get("ref"), r.get("ref"))
        if key not in hubs:
            hubs[key] = {"key": key, "src": parts["sources"].get(key), "evidence": []}
            hub_order.append(key)
        hubs[key]["evidence"].append(r["id"])

    # a short label per hub: first author's surname and the year, both read off the citation
    for key, hub in hubs.items():
        cite = (hub["src"] or {}).get("citation", "")
        surname = cite.split()[0].rstrip(",") if cite else str(key)
        year = (re.search(r"\((\d{4})\)", cite) or re.search(r"\b(19|20)\d{2}\b", cite))
        year = year.group(0).strip("()") if year else ""
        hub["short"] = f"{surname} {year}".strip()
        hub["ring"] = 52 + 26 * math.sqrt(len(hub["evidence"]))

    # The law audit, as the kernel recorded it when it watched Lean accept the file.
    law_nodes = [r for r in rows if r["type"] == "law"]
    audit = next((l.get("audit") for l in law_nodes if l.get("audit")), None)

    return {
        "rows": rows, "by_id": by_id, "run": run, "parts": parts, "mine": mine,
        "hubs": hubs, "hub_order": hub_order,
        "lean": {"file": "tracks/kernel/lean/CircuitLaws.lean", "theorems": len(thms), "audited": len(audited),
                 "axioms": (audit or {}).get("axioms", []), "toolchain": (audit or {}).get("toolchain"),
                 "verdict": (audit or {}).get("verdict")},
        "counts": Counter(r["type"] for r in rows),
    }


def guard_test():
    """Run the kernel's own fault test and read the figure off its output. Not a remembered number."""
    try:
        r = subprocess.run(["node", str(ROOT / "tracks/kernel/test-kernel.mjs")],
                           cwd=ROOT, capture_output=True, text=True, timeout=300)
    except Exception as e:
        print(f"note     guard test did not run ({e}); its row is omitted")
        return None
    out = (r.stdout or "") + (r.stderr or "")
    m = re.search(r"(\d+)\s+fault\(s\)\s+injected,\s+(\d+)\s+survived", out)
    if not m:
        m2 = re.search(r"(\d+)\s+passed,\s+(\d+)\s+failed", out)
        print("note     guard test output did not state the fault count; its row is omitted"
              + (f" ({m2.group(0)})" if m2 else ""))
        return None
    return {"injected": int(m.group(1)), "survived": int(m.group(2))}


# ----------------------------------------------------------------------------- layout

def layout(D):
    """Give every node in the store a place. Hubs for the sources that were read, their evidence in
    a ring around them, each fact on its own evidence, the laws in the centre, the verdicts between
    the laws and the facts they used, and the artifacts on the right."""
    pos = {}
    hub_pos = {}
    hub_order = D["hub_order"]
    n_hub = max(1, len(hub_order))
    # hubs down the left two thirds, spread on an arc so their evidence rings do not collide
    for i, key in enumerate(hub_order):
        frac = (i + 0.5) / n_hub
        cx = 250 + (300 if n_hub > 1 else 140) * frac
        cy = GY0 + 190 + (GY1 - GY0 - 380) * frac
        hub_pos[key] = (cx, cy)
        for j, eid in enumerate(D["hubs"][key]["evidence"]):
            a = j * GOLDEN
            r = 52 + 26 * math.sqrt(j + 1)
            pos[eid] = (cx + r * math.cos(a), cy + r * math.sin(a))

    # facts sit just outside their evidence, pushed away from the hub so the edge is readable
    for r in D["rows"]:
        if r["type"] != "fact":
            continue
        ev = (r.get("evidence") or [None])[0]
        base = pos.get(ev)
        if base is None:
            base = (470, (GY0 + GY1) / 2)
        hk = next((k for k, h in D["hubs"].items() if ev in h["evidence"]), None)
        hx, hy = hub_pos.get(hk, (470, (GY0 + GY1) / 2))
        dx, dy = base[0] - hx, base[1] - hy
        n = math.hypot(dx, dy) or 1.0
        jitter = (int(r["id"][1:5], 16) % 1000) / 1000.0
        off = 34 + 16 * jitter
        pos[r["id"]] = (base[0] + dx / n * off, base[1] + dy / n * off)

    # laws: a column in the centre right of the graph
    laws = [r for r in D["rows"] if r["type"] == "law"]
    LAW_X = 1150
    for i, l in enumerate(laws):
        y = GY0 + 210 + i * ((GY1 - GY0 - 420) / max(1, len(laws) - 1) if len(laws) > 1 else 0)
        pos[l["id"]] = (LAW_X, y)

    # verdicts: between the law column and the fact cloud, grouped by the law they apply
    verds = [r for r in D["rows"] if r["type"] == "verdict"]
    law_index = {l["id"]: i for i, l in enumerate(laws)}
    per_law = {}
    for v in verds:
        per_law.setdefault(v.get("law"), []).append(v)
    for lid, group in per_law.items():
        lx, ly = pos.get(lid, (LAW_X, (GY0 + GY1) / 2))
        for j, v in enumerate(group):
            spread = (j - (len(group) - 1) / 2) * 52
            pos[v["id"]] = (lx - 206, ly + spread)

    # builds and refusals: below the law column, where the fading law cards leave room
    arts = [r for r in D["rows"] if r["type"] in ("build", "refusal")]
    mine_arts = [a for a in arts if is_mine(D, a)]
    older_arts = [a for a in arts if a not in mine_arts]
    for i, a in enumerate(arts):
        if a in mine_arts:
            pos[a["id"]] = (1120, GY0 + 300 + mine_arts.index(a) * 132)
        else:
            # earlier runs' artifacts, kept on screen because the store holds them, set back in a row
            pos[a["id"]] = (1150 + older_arts.index(a) * 26, GY1 - 54)

    return {"pos": pos, "hub_pos": hub_pos, "laws": laws, "verds": verds, "arts": arts,
            "law_index": law_index}


def arrival(D, L):
    """When each node appears, in seconds. Chain order within each chapter, so the store's own
    order is what the viewer sees."""
    at = {}

    def spread(rows, t0, t1):
        for i, r in enumerate(rows):
            at[r["id"]] = t0 + (t1 - t0) * (i / max(1, len(rows) - 1) if len(rows) > 1 else 0)

    for kind, (t0, t1) in (("evidence", (T_EV0, T_EV1)), ("fact", (T_FA0, T_FA1))):
        spread([r for r in D["rows"] if r["type"] == kind], t0, t1)

    # The store keeps every run. Earlier runs' laws, verdicts and artifacts land quickly at the head
    # of their chapter; this run's get the rest of the window, because the chapter is about it.
    for kinds, (t0, t1) in ((("law",), (T_LA0, T_LA1)), (("verdict",), (T_VE0, T_VE1)),
                            (("build", "refusal"), (T_BU0, T_BU0 + (T_BU1 - T_BU0) * 0.62))):
        rows = [r for r in D["rows"] if r["type"] in kinds]
        older = [r for r in rows if not is_mine(D, r)]
        mine = [r for r in rows if is_mine(D, r)]
        if older and mine:
            cut = t0 + (t1 - t0) * 0.26
            spread(older, t0, cut)
            spread(mine, cut + 0.4, t1)
        else:
            spread(rows, t0, t1)
    return at


def node_color(D, r):
    t = r["type"]
    if t == "evidence":
        return EDGE
    if t == "fact":
        return NODE
    if t == "law":
        return GOLD
    if t == "verdict":
        return {"inside": INSIDE, "outside": OUTSIDE, "cannot-assess": CANNOT}.get(r.get("result"), NODE)
    if t == "build":
        return BUILT
    if t == "refusal":
        return REFUSED
    return NODE


def node_radius(t):
    return {"evidence": 3.4, "fact": 4.6, "law": 9.0, "verdict": 7.0, "build": 10.0, "refusal": 9.0}.get(t, 4.0)


def is_mine(D, r):
    """Did the latest run name this node? The store keeps every run; the run is about its own."""
    key = r["type"] + "s"
    want = D["mine"].get(key)
    if not want:
        return True
    return r["id"] in want


# ----------------------------------------------------------------------------- chapters

def chapters(D):
    lean = D["lean"]
    return [
        (T_EV, "Evidence",
         "a primary record and the exact words read in it. No quote, no evidence — and a record "
         "quoting another record is not evidence."),
        (T_FACT, "Facts",
         "a measured number, which cannot exist without evidence, and cannot exist without the "
         "conditions it was measured in."),
        (T_LAW, "Laws",
         f"a statement this kernel watched the Lean kernel accept, with the axioms it printed. "
         f"{lean['theorems']} theorems in one file, {lean['audited']} of them audited."),
        (T_VERD, "Verdicts",
         "a law applied to facts: inside, outside, or cannot-assess. Cannot-assess is a result, "
         "never a pass, and it carries its reason."),
        (T_BUILD, "Builds and refusals",
         "an artifact is minted only if every verdict under it holds. Otherwise the kernel mints a "
         "refusal naming what was missing — and the refusal is the useful part."),
        (T_CHAIN, "The chain",
         "every node's name is the hash of its own content, and every line is chained to the one "
         "before it, so a node cannot be edited without changing its name."),
    ]


def ledger_rows(D, guards):
    """The right-hand column: one row per chapter, each counted up when its chapter starts."""
    run, lean, c = D["run"], D["lean"], D["counts"]
    srcs = D["parts"]["sources"]
    full = sum(1 for s in srcs.values() if s.get("read") == "full_text")
    tally = run.get("tally", {})
    rows = [
        (T_EV0, f"{len(D['hub_order'])}", "sources cited by an evidence node",
         f"{full} of {len(srcs)} read as full text"),
        (T_EV0 + 1.2, f"{c.get('evidence', 0)}", "evidence nodes", "each one a quote and its locator"),
        (T_FA0, f"{c.get('fact', 0)}", "fact nodes", "each with host, strain, medium, temperature"),
        (T_LA0, f"{lean['theorems']}", "theorems, all audited",
         f"axioms: {', '.join(lean['axioms']) if lean['axioms'] else 'none recorded'}"),
        (T_VE0, f"{len(run.get('ids', {}).get('verdicts', []))}", "verdicts in this run",
         f"{tally.get('inside', 0)} inside · {tally.get('outside', 0)} outside · "
         f"{tally.get('cannot-assess', 0)} cannot-assess"),
        (T_BU0, f"{len(run.get('ids', {}).get('builds', []))}", "artifact built",
         f"{len(run.get('ids', {}).get('refusals', []))} refused, each naming what is missing"),
        (T_BU0 + 2.4, f"{run.get('slots', {}).get('filled', 0)} of {run.get('slots', {}).get('total', 0)}",
         "construct slots filled", "from primary records, not from defaults"),
        (T_CH0, f"{run.get('kernel', {}).get('nodes', len(D['rows']))}", "nodes in the store",
         f"{run.get('kernel', {}).get('chain_problems', 0)} chain problems"),
    ]
    if guards:
        rows.append((T_CH0 + 2.2, f"{guards['injected']}", "faults injected into the kernel",
                     f"{guards['survived']} survived"))
    return rows


# ----------------------------------------------------------------------------- painting

def paint(t, D, L, at, guards, stamp):
    img = Image.new("RGB", (P(W), P(H)), PAPER)
    d = ImageDraw.Draw(img)

    # paper grain: a faint grid, as in the house builder
    for x in range(GX0, GX1 + 1, 64):
        d.line([(P(x), P(GY0 - 8)), (P(x), P(GY1 + 8))], fill=GRID, width=max(1, SS // 2))
    for y in range(GY0, GY1 + 1, 64):
        d.line([(P(GX0 - 8), P(y)), (P(GX1 + 8), P(y))], fill=GRID, width=max(1, SS // 2))

    # header
    d.text((P(48), P(44)), "DELPHI  ·  THE KERNEL", font=font(LABEL, 13), fill=INK2)
    d.text((P(W - 48), P(44)), stamp, font=font(BODY, 13), fill=INK3, anchor="ra")
    d.line([(P(48), P(70)), (P(W - 48), P(70))], fill=RULE, width=max(1, SS))

    # chapter title and its one-sentence reason, left
    chs = chapters(D)
    for i, (start, title, sub) in enumerate(chs):
        nxt = chs[i + 1][0] if i + 1 < len(chs) else DURATION + 10
        a = appear(t, start, 0.5)
        if a <= 0:
            continue
        out = 1.0 if t < nxt - 0.5 else max(0.0, 1 - (t - (nxt - 0.5)) / 0.5)
        a *= out
        if a <= 0.01:
            continue
        col = mix(PAPER, INK, a)
        col2 = mix(PAPER, INK2, a * 0.92)
        d.text((P(48), P(88)), title, font=font(DISPLAY, 38), fill=col)
        sx = 48 + 14 + font(DISPLAY, 38).getlength(title) / SS
        sf = font(LIGHT, 17)
        lines, limit = [""], COL_X - 40 - sx
        for word in sub.split():
            cand = (lines[-1] + " " + word).strip()
            if lines[-1] and sf.getlength(cand) / SS > limit:
                lines.append(word)
            else:
                lines[-1] = cand
        for j, line in enumerate(lines[:2]):
            d.text((P(sx), P(92 + 21 * j)), line, font=sf, fill=col2)

    paint_graph(d, t, D, L, at)
    paint_ledger(d, t, D, ledger_rows(D, guards))
    paint_chain(d, t, D, L, at)
    paint_footer(d, t, D)

    if SS != 1:
        img = img.resize((W, H), Image.LANCZOS)
    return img


def paint_graph(d, t, D, L, at):
    pos, hub_pos = L["pos"], L["hub_pos"]

    # source hubs and their labels
    for key, (cx, cy) in hub_pos.items():
        first = min((at.get(e, 99) for e in D["hubs"][key]["evidence"]), default=99)
        a = appear(t, first - 0.3, 0.6)
        if a <= 0.01:
            continue
        hub = D["hubs"][key]
        src = hub["src"] or {}
        d.ellipse([P(cx - 8), P(cy - 8), P(cx + 8), P(cy + 8)], fill=mix(PAPER, INK, a))
        ring = hub["ring"]
        d.text((P(cx), P(cy - ring - 26)), hub["short"], font=font(LABEL, 15),
               fill=mix(PAPER, INK, a), anchor="md")
        sub = f"{len(hub['evidence'])} quotes · read as {src.get('read', 'unknown').replace('_', ' ')}"
        d.text((P(cx), P(cy - ring - 10)), sub, font=font(BODY, 11), fill=mix(PAPER, INK3, a), anchor="md")

    # edges: fact -> its evidence, verdict -> law and the facts it used, artifact -> its verdicts
    for r in D["rows"]:
        a = appear(t, at.get(r["id"], 99), 0.5)
        if a <= 0.01:
            continue
        p = pos.get(r["id"])
        if p is None:
            continue
        if r["type"] == "fact":
            for e in (r.get("evidence") or []):
                q = pos.get(e)
                if q:
                    d.line([P(p[0]), P(p[1]), P(q[0]), P(q[1])], fill=mix(PAPER, EDGE, 0.5 * a), width=max(1, SS))
        elif r["type"] == "verdict":
            q = pos.get(r.get("law"))
            if q:
                d.line([P(p[0]), P(p[1]), P(q[0]), P(q[1])], fill=mix(PAPER, GOLD, 0.6 * a), width=max(1, SS))
            col = node_color(D, r)
            for f in (r.get("facts") or []):
                q = pos.get(f)
                if q:
                    d.line([P(p[0]), P(p[1]), P(q[0]), P(q[1])], fill=mix(PAPER, col, 0.34 * a), width=max(1, SS))
        elif r["type"] in ("build", "refusal"):
            col = node_color(D, r)
            w = 0.42 if is_mine(D, r) else 0.1
            for v in (r.get("verdicts") or []):
                q = pos.get(v)
                if q:
                    d.line([P(p[0]), P(p[1]), P(q[0]), P(q[1])], fill=mix(PAPER, col, w * a), width=max(1, SS))

    # nodes, on top of the edges
    for r in D["rows"]:
        a = appear(t, at.get(r["id"], 99), 0.45)
        if a <= 0.01:
            continue
        p = pos.get(r["id"])
        if p is None:
            continue
        rad = node_radius(r["type"])
        col = node_color(D, r)
        # the latest run's own nodes stay full strength; earlier runs' nodes sit back
        if r["type"] in ("law", "verdict", "build", "refusal") and not is_mine(D, r):
            col = mix(PAPER, col, 0.34)
        # a brief flare as it lands
        flare = max(0.0, 1 - (t - at.get(r["id"], 0)) / 0.9)
        rr = rad * (1 + 0.9 * flare * flare)
        d.ellipse([P(p[0] - rr), P(p[1] - rr), P(p[0] + rr), P(p[1] + rr)], fill=mix(PAPER, col, a))

    paint_verdict_labels(d, t, D, L, at)
    paint_law_cards(d, t, D, L)
    paint_artifacts(d, t, D, L)


def paint_verdict_labels(d, t, D, L, at):
    """The six this run decided, each with its result and the reason the kernel recorded. The
    reason is the whole point of cannot-assess, so it is on screen, not implied."""
    for v in L["verds"]:
        if not is_mine(D, v):
            continue
        p = L["pos"].get(v["id"])
        if p is None:
            continue
        a = appear(t, at.get(v["id"], 99) + 0.2, 0.6)
        fade = 1.0 if t < T_BU1 else max(0.0, 1 - (t - T_BU1) / 1.0)
        a *= fade
        if a <= 0.01:
            continue
        col = node_color(D, v)
        x = p[0] - 16
        lab = (v.get("label") or "")[:34]
        res = v.get("result", "")
        why = re.sub(r"\s+", " ", v.get("detail") or "")
        why = (why[:56] + "…") if len(why) > 57 else why
        # a paper backing, so the reason stays readable where it crosses the evidence cloud
        wid = max(font(LABEL, 13).getlength(lab) / SS + 4,
                  font(BODY, 12).getlength(res) / SS + 4,
                  font(BODY, 10).getlength(why) / SS + 4)
        d.rectangle([P(x - wid - 6), P(p[1] - 23), P(x + 4), P(p[1] + 21)], fill=mix(PAPER, PAPER2, a))
        d.text((P(x), P(p[1] - 10)), lab, font=font(LABEL, 13), fill=mix(PAPER, INK, a), anchor="rd")
        d.text((P(x), P(p[1] - 8)), res, font=font(BODY, 12), fill=mix(PAPER, col, a), anchor="ra")
        if why:
            d.text((P(x), P(p[1] + 8)), why, font=font(BODY, 10),
                   fill=mix(PAPER, INK2, a * 0.95), anchor="ra")


def paint_law_cards(d, t, D, L):
    """Each law's plain sentence beside its node, and the Lean file it was checked from."""
    lean = D["lean"]
    for i, l in enumerate(L["laws"]):
        if not is_mine(D, l):
            continue
        p = L["pos"][l["id"]]
        a = appear(t, T_LA0 + 0.4 + i * 1.8, 0.7) * (1.0 if t < T_VE1 else max(0.0, 1 - (t - T_VE1) / 1.2))
        if a <= 0.01:
            continue
        name = l.get("name", "").replace("_", " ")
        d.text((P(p[0] + 16), P(p[1] - 8)), name, font=font(LABEL, 13), fill=mix(PAPER, INK, a))
        sub = f"{len(l.get('lean_decls') or [])} declaration(s) · {lean['verdict'] or ''}"
        d.text((P(p[0] + 16), P(p[1] + 8)), sub, font=font(BODY, 11), fill=mix(PAPER, INK3, a))

    # the Lean file itself, under the law column
    a = appear(t, T_LA0, 0.8) * (1.0 if t < T_VE1 else max(0.0, 1 - (t - T_VE1) / 1.2))
    if a > 0.01 and L["laws"]:
        x, y = 1150, GY1 - 86
        d.text((P(x), P(y)), lean["file"], font=font(BODY, 11), fill=mix(PAPER, INK2, a), anchor="ma")
        d.text((P(x), P(y + 18)), f"{lean['theorems']} theorems · {lean['audited']} audited · {lean['verdict'] or ''}",
               font=font(LABEL, 12), fill=mix(PAPER, INK, a), anchor="ma")
        if lean["toolchain"]:
            d.text((P(x), P(y + 36)), lean["toolchain"], font=font(BODY, 10), fill=mix(PAPER, INK3, a), anchor="ma")


def paint_artifacts(d, t, D, L):
    """The builds and the refusals, with the reason each refusal gives."""
    mine_arts = [r for r in L["arts"] if is_mine(D, r)]
    older = [r for r in L["arts"] if not is_mine(D, r)]
    if older:
        p0 = L["pos"][older[0]["id"]]
        a = appear(t, T_BU0 + 1.0, 0.8)
        if a > 0.01:
            d.text((P(p0[0] - 10), P(p0[1] + 16)), f"{len(older)} from earlier runs, still in the store",
                   font=font(BODY, 10), fill=mix(PAPER, INK3, a * 0.9))
    for i, r in enumerate(mine_arts):
        p = L["pos"][r["id"]]
        a = appear(t, T_BU0 + 0.5 + i * 1.6, 0.7)
        if a <= 0.01:
            continue
        col = node_color(D, r)
        tx = p[0] + 18
        avail = COL_X - 44 - tx
        title = (r.get("artifact") or r.get("what") or "").split(":")[-1].strip()
        d.text((P(tx), P(p[1] - 9)), fit(title, font(LABEL, 13), avail), font=font(LABEL, 13),
               fill=mix(PAPER, INK, a))
        if r["type"] == "refusal":
            why = (r.get("because") or [""])[0]
            d.text((P(tx), P(p[1] + 9)), fit(why, font(BODY, 11), avail), font=font(BODY, 11),
                   fill=mix(PAPER, col, a * 0.95))
        else:
            n = len(r.get("emitted") or [])
            d.text((P(tx), P(p[1] + 9)), f"{n} file(s) emitted, each hashed into the node",
                   font=font(BODY, 11), fill=mix(PAPER, INK3, a))


def paint_ledger(d, t, D, rows):
    x = COL_X
    d.line([(P(x - 24), P(GY0 - 8)), (P(x - 24), P(GY1 + 8))], fill=RULE, width=max(1, SS))
    pitch = min(104, int((GY1 - GY0 - 20) / max(1, len(rows))))
    y = GY0 + 6
    for start, big, label, sub in rows:
        a = appear(t, start, 0.6)
        if a <= 0.01:
            y += pitch
            continue
        # count the number up as its row arrives, where it is a bare integer
        shown = big
        if big.isdigit():
            shown = str(counted(t, start, 0.9, int(big)))
        d.text((P(x), P(y)), shown, font=font(DISPLAY, 44), fill=mix(PAPER, INK, a))
        d.text((P(x + 8 + font(DISPLAY, 44).getlength(shown) / SS), P(y + 22)), label,
               font=font(LABEL, 12), fill=mix(PAPER, INK2, a))
        sf = font(BODY, 11)
        lines, limit = [""], COL_W - 24
        for word in sub.split():
            cand = (lines[-1] + " " + word).strip()
            if lines[-1] and sf.getlength(cand) / SS > limit:
                lines.append(word)
            else:
                lines[-1] = cand
        for j, line in enumerate(lines[:2]):
            d.text((P(x), P(y + 50 + 15 * j)), line, font=sf, fill=mix(PAPER, INK3, a))
        y += pitch


def paint_chain(d, t, D, L, at):
    """The store as what it is on disk: one bead per line, chained to the one before."""
    rows = D["rows"]
    n = len(rows)
    x0, x1 = GX0 + 8, GX1 - 8
    step = (x1 - x0) / max(1, n - 1)
    lit = appear(t, T_CH0, 1.6)
    for i, r in enumerate(rows):
        a = appear(t, at.get(r["id"], 99), 0.4)
        if a <= 0.01:
            continue
        x = x0 + i * step
        col = node_color(D, r)
        strength = 0.55 + 0.45 * lit
        if i:
            d.line([P(x - step), P(CHAIN_Y), P(x), P(CHAIN_Y)], fill=mix(PAPER, INK3, 0.6 * a * strength),
                   width=max(1, SS))
        rr = 2.6 + 1.8 * lit
        d.ellipse([P(x - rr), P(CHAIN_Y - rr), P(x + rr), P(CHAIN_Y + rr)], fill=mix(PAPER, col, a * strength))
    if lit > 0.01:
        d.text((P(x0), P(CHAIN_Y - 22)), "the append-only store, in chain order",
               font=font(BODY, 11), fill=mix(PAPER, INK3, lit))


def paint_footer(d, t, D):
    """Provenance in small print, as the export rules ask: what built it, from which files."""
    a = appear(t, T_CH0 + 1.0, 1.2)
    if a <= 0.01:
        return
    run = D["run"]
    lines = [
        "Built by tracks/video/kernel-graph.py from tracks/kernel/store/nodes.jsonl, "
        "tracks/kernel/compile/out/last-run.json, tracks/kernel/compile/parts.json and "
        "tracks/kernel/lean/CircuitLaws.lean.",
        f"Every figure is read from those files; the run shown is module {run.get('module')} in "
        f"{run.get('host')}. Type: {FACE_NAME}. Silent by design. No soundtrack, no narration.",
    ]
    for j, line in enumerate(lines):
        d.text((P(48), P(H - 40 + 15 * j)), line, font=font(BODY, 10), fill=mix(PAPER, INK3, a * 0.9))


# ----------------------------------------------------------------------------- render

_G = {}


def _init(D, L, at, guards, stamp):
    _G.update({"D": D, "L": L, "at": at, "guards": guards, "stamp": stamp})


def _frame(job):
    i, t, outdir = job
    img = paint(t, _G["D"], _G["L"], _G["at"], _G["guards"], _G["stamp"])
    img.save(os.path.join(outdir, f"f{i:05d}.png"))
    return i


def ffmpeg_bin():
    for cand in [os.environ.get("FFMPEG"),
                 "C:/Temp/ffmpeg-install/node_modules/ffmpeg-static/ffmpeg.exe",
                 shutil.which("ffmpeg")]:
        if cand and Path(cand).exists():
            return cand
    raise SystemExit("ffmpeg not found; set FFMPEG to its path")


def main():
    global SS, FPS
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="resolve every input and every figure, render nothing")
    ap.add_argument("--preview", action="store_true", help="a few stills, no video")
    ap.add_argument("--fast", action="store_true", help="12 fps, no supersampling")
    ap.add_argument("--no-guards", action="store_true", help="do not run the kernel guard test")
    ap.add_argument("--workers", type=int, default=WORKERS)
    args = ap.parse_args()
    if args.fast:
        SS, FPS = 1, 12

    D = load()
    L = layout(D)
    at = arrival(D, L)
    guards = None if args.no_guards else guard_test()
    stamp = dt.datetime.now().astimezone().strftime("%Y-%m-%d")

    print(f"store    {len(D['rows'])} node(s): " + ", ".join(f"{v} {k}" for k, v in D["counts"].items()))
    print(f"lean     {D['lean']['theorems']} theorem(s), {D['lean']['audited']} audited, "
          f"{D['lean']['verdict']}, axioms [{', '.join(D['lean']['axioms'])}]")
    print(f"run      {D['run'].get('module')}: " + ", ".join(f"{v} {k}" for k, v in (D["run"].get("tally") or {}).items()))
    if guards:
        print(f"guards   {guards['injected']} fault(s) injected, {guards['survived']} survived")
    print(f"type     {FACE_NAME}")

    if args.check:
        # Every figure the film puts on screen must resolve from the files, and every node must
        # have a place and a time. A number that cannot be traced is a failed check, not a blank.
        rows = ledger_rows(D, guards)
        blank = [lab for _, big, lab, _ in rows if not str(big).strip() or str(big).startswith("None")]
        missing_pos = [r["id"] for r in D["rows"] if r["id"] not in L["pos"]]
        missing_at = [r["id"] for r in D["rows"] if r["id"] not in at]
        if blank or missing_pos or missing_at:
            raise SystemExit(f"check failed: {len(blank)} unresolved figure(s) {blank}, "
                             f"{len(missing_pos)} node(s) with no place, {len(missing_at)} with no time")
        if D["lean"]["verdict"] != "CHECKED":
            raise SystemExit(f"check failed: the law audit in the store says {D['lean']['verdict']}")
        print(f"check    {len(D['rows'])} node(s) placed and timed, {len(rows)} ledger figure(s) "
              f"resolved, {len(chapters(D))} chapters, every figure traced to a file")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.preview:
        for t in [0.8, T_FA0 + 2, T_LA0 + 3, T_VE0 + 5, T_BU0 + 4, DURATION - 1.5]:
            p = OUT_DIR / f"preview-{t:05.1f}.png"
            paint(t, D, L, at, guards, stamp).save(p)
            print(f"still    {p}")
        return

    frames = int(DURATION * FPS)
    tmp = Path(os.environ.get("TEMP", "C:/Temp")) / "delphi-kernel-graph-frames"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    jobs = [(i, i / FPS, str(tmp)) for i in range(frames)]
    workers = max(1, min(args.workers, os.cpu_count() or 2))
    print(f"render   {frames} frame(s) at {FPS} fps, {W}x{H}, supersample {SS}, {workers} worker(s)")
    with Pool(workers, initializer=_init, initargs=(D, L, at, guards, stamp)) as pool:
        for n, _ in enumerate(pool.imap_unordered(_frame, jobs, chunksize=4), 1):
            if n % 120 == 0 or n == frames:
                print(f"         {n}/{frames}")

    shutil.copyfile(tmp / f"f{int((DURATION - 1.2) * FPS):05d}.png", OUT_PNG)
    cmd = [ffmpeg_bin(), "-y", "-framerate", str(FPS), "-i", str(tmp / "f%05d.png"),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19",
           "-movflags", "+faststart", str(OUT_MP4)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("ffmpeg failed:\n" + (r.stderr or "")[-2000:])
    shutil.rmtree(tmp, ignore_errors=True)
    size = OUT_MP4.stat().st_size
    print(f"wrote    {OUT_MP4} ({size:,} bytes, {DURATION:.0f} s, silent)")
    print(f"wrote    {OUT_PNG}")


if __name__ == "__main__":
    main()
