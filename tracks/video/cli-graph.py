#!/usr/bin/env python3
"""The embeddable toolset in about a minute: what happens to a real repository that adopts the method.

Same house style as tracks/video/kernel-graph.py and scripts/site/build-graph-video.py in the delphi
repository: the pkg.scienceoracle.com growth replay, warm paper, teal edges, the verdict colours, a
counting ledger down the right-hand side. No title card and no closing card. It is silent by design,
so nothing is asserted that the picture does not show.

What the film replays is a recorded run, not an illustration. tracks/kernel/embed/cookbook.mjs drove
the real command line in a checkout of a public repository and committed every command, what it
printed, and the store it made. The film draws that store, in the order it was minted, with the
command that minted each node typed underneath it. A law the kernel refused leaves no node, so it is
drawn as an empty ring where the law would have been.

Every figure comes from a repo file or from a command run here:

    tracks/kernel/embed/cookbook/run.json     the commands, their exit codes and what each printed
    tracks/kernel/embed/cookbook/nodes.jsonl  the store that run minted: the graph itself
    tracks/kernel/embed/cookbook/graph.json   its edges, every one a field in a record
    tracks/kernel/embed/best-practices.mjs    the rules it enforces and the habits it cannot
    tracks/kernel/embed/test-embed.mjs        run here, for the faults-injected and survivors figures

    python tracks/video/cli-graph.py                # 1920x1080, 24 fps, ~68 s
    python tracks/video/cli-graph.py --preview      # a few stills, no video
    python tracks/video/cli-graph.py --fast         # 12 fps, no supersampling, for iteration
    python tracks/video/cli-graph.py --check        # resolve every figure, place every node, no render
    python tracks/video/cli-graph.py --no-guards    # skip running the fault suite

Needs Pillow and ffmpeg. Frames render in parallel, capped to leave this shared box headroom.
"""

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "tracks/kernel/embed/delphi.mjs"
BEST = ROOT / "tracks/kernel/embed/best-practices.mjs"
TESTS = ROOT / "tracks/kernel/embed/test-embed.mjs"
OUT_DIR = Path(os.environ.get("DELPHI_VIDEO_DIR", "C:/Temp/delphi-video/kernel"))
OUT_MP4 = OUT_DIR / "cli-graph.mp4"
OUT_PNG = OUT_DIR / "cli-graph-poster.png"

W, H = 1920, 1080
FPS = 24
SS = 2
WORKERS = 4

FONT_CANDIDATES = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", "Helvetica Neue"),
    ("C:/Windows/Fonts/arial.ttf", "Arial (Helvetica metric clone)"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "Liberation Sans"),
]
FACE_PATH, FACE_NAME = None, None
for _cand, _name in FONT_CANDIDATES:
    if Path(_cand).exists():
        FACE_PATH, FACE_NAME = _cand, _name
        break
if FACE_PATH is None:
    raise SystemExit("no usable sans face found; install Helvetica Neue, Arial or Liberation Sans")
_IS_TTC = FACE_PATH.endswith(".ttc")
if _IS_TTC:
    DISPLAY, HEAVY, LIGHT, LABEL, BODY = (FACE_PATH, 1), (FACE_PATH, 9), (FACE_PATH, 7), (FACE_PATH, 10), (FACE_PATH, 0)
else:
    _d = str(Path(FACE_PATH).parent)
    _bold = f"{_d}/arialbd.ttf" if Path(f"{_d}/arialbd.ttf").exists() else FACE_PATH
    DISPLAY, HEAVY, LIGHT, LABEL, BODY = (_bold, 0), (_bold, 0), (FACE_PATH, 0), (_bold, 0), (FACE_PATH, 0)
# A monospace face for the command strip. The command is the one thing on screen that is typed by a
# person, so it is set in a typewriter face; if none resolves, the body face is used and said so.
MONO_CANDIDATES = [
    ("C:/Windows/Fonts/consola.ttf", "Consolas"),
    ("/System/Library/Fonts/Menlo.ttc", "Menlo"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "DejaVu Sans Mono"),
]
MONO, MONO_NAME = (FACE_PATH, 0), f"{FACE_NAME}, no monospace face found"
for _cand, _name in MONO_CANDIDATES:
    if Path(_cand).exists():
        MONO, MONO_NAME = (_cand, 0), _name
        break

PAPER = (246, 243, 236)
PAPER2 = (252, 250, 246)
INK = (29, 36, 51)
INK2 = (83, 101, 130)
INK3 = (140, 150, 168)
GRID = (222, 217, 205)
RULE = (214, 208, 195)
NODE = (198, 193, 182)
EDGE = (74, 138, 122)
GOLD = (201, 150, 38)
INSIDE = (46, 158, 84)
OUTSIDE = (196, 72, 88)
CANNOT = (132, 144, 164)
REFUSED = (178, 52, 140)
BUILT = (47, 111, 237)

# Timeline, seconds. One chapter per thing the toolset does, in the order a project meets them.
T_INIT, T_IN0, T_IN1 = 0.2, 0.5, 10.0
T_REC, T_RE0, T_RE1 = 10.8, 11.4, 22.0
T_LAW, T_LA0, T_LA1 = 22.8, 23.4, 32.5
T_VERD, T_VE0, T_VE1 = 33.3, 33.9, 44.0
T_BUILD, T_BU0, T_BU1 = 44.8, 45.4, 54.5
T_GUARD, T_GU0, T_GU1 = 55.3, 55.9, 66.5
DURATION = 68.0

GX0, GX1, GY0, GY1 = 40, 1452, 150, 902
COL_X, COL_W = 1496, 384
CMD_Y = 936   # the command strip sits under the graph
FOOT_Y = 1040


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


_FONTS = {}


def font(face, size):
    path, index = face
    key = (path, index, int(size * SS))
    f = _FONTS.get(key)
    if f is None:
        f = ImageFont.truetype(path, int(size * SS), index=index)
        _FONTS[key] = f
    return f


def fit(text, f, width):
    text = re.sub(r"\s+", " ", text or "").strip()
    if f.getlength(text) / SS <= width:
        return text
    while text and f.getlength(text + "…") / SS > width:
        text = text[:-1]
    return text.rstrip(" ,;") + "…"


def need(path):
    if not path.exists():
        raise SystemExit(f"missing input: {path.relative_to(ROOT)} — every figure on screen comes from a repo file")
    return path


def node(cmd, cwd=None, timeout=240):
    r = subprocess.run([shutil.which("node") or "node", *cmd], cwd=cwd or ROOT,
                       capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


# ----------------------------------------------------------------------------- data
#
# The graph is the store a real run produced: tracks/kernel/embed/cookbook.mjs drove the command line
# in a checkout of a public repository and committed what came back. The commands are kept beside the
# nodes they minted, because the command is the thing this film is about.

RUN = ROOT / "tracks/kernel/embed/cookbook/run.json"
RUN_STORE = ROOT / "tracks/kernel/embed/cookbook/nodes.jsonl"
RUN_GRAPH = ROOT / "tracks/kernel/embed/cookbook/graph.json"


def mint():
    """Load the recorded run: every command, what it said, and the node it minted."""
    need(CLI)
    run = json.loads(need(RUN).read_text(encoding="utf8"))
    rows = [json.loads(l) for l in need(RUN_STORE).read_text(encoding="utf8").splitlines() if l.strip()]
    graph = json.loads(need(RUN_GRAPH).read_text(encoding="utf8"))
    ids = {r["id"] for r in rows}
    steps, per_node = [], {}
    for s in run["steps"]:
        lines = [l for l in s["out"].splitlines() if l.strip()]
        minted = [s["id"]] if s.get("id") in ids and s["id"] not in per_node else []
        if s["exit"] != 0:
            why = [l.strip()[2:] for l in lines if l.strip().startswith("- ")]
            said = "refused: " + (why[0] if why else "see the record")
        elif s["recipe"] == "audit" and not minted:
            said = lines[1].strip() if len(lines) > 1 else lines[0]
        elif s["recipe"] == "ci":
            said = lines[-1].strip()
        elif s["recipe"] == "read":
            said = next((l.strip() for l in lines if l.startswith("nodes")), lines[0].strip())
        elif s["recipe"] == "adopt":
            said = "wrote the store, the method document and the private graph; changed nothing else"
        else:
            said = "minted 1 node" if minted else lines[0].strip()
        steps.append({"step": s["recipe"], "cmd": s["shown"], "minted": minted, "exit": s["exit"], "said": said})
        for m in minted:
            per_node[m] = len(steps) - 1
    orphans = ids - set(per_node)
    if orphans:
        raise SystemExit(f"{len(orphans)} node(s) in the recorded store were minted by no recorded command: {sorted(orphans)}")
    return {"run": run, "rows": rows, "steps": steps, "chapter_of": per_node, "graph": graph}

def best_practices():
    """The rules the toolset enforces and the habits it cannot, read out of the module itself."""
    need(BEST)
    code, out = node(["--input-type=module", "-e",
                      "import {RULES,HABITS} from " + json.dumps(BEST.as_uri()) +
                      "; console.log(JSON.stringify({rules:RULES.map(r=>({primitive:r.primitive,rule:r.rule})),habits:HABITS.map(h=>h[0])}))"])
    if code != 0:
        raise SystemExit(f"could not read the rule list out of best-practices.mjs:\n{out}")
    data = json.loads(out.strip().splitlines()[-1])
    ok, chk = node([str(BEST), "--check"])
    if ok != 0:
        raise SystemExit(f"the best-practice doc states a rule with no guard behind it, so the film would be wrong:\n{chk}")
    return data


def fault_suite(run_it=True):
    """Run the fault suite and read its own report. Nothing here is remembered from a previous run."""
    need(TESTS)
    names = [m.group(1) for m in re.finditer(r"^\s*\['([^']+)',", TESTS.read_text(encoding="utf8"), re.M)]
    if not run_it:
        return {"ran": False, "injected": None, "survived": None, "names": names}
    code, out = node([str(TESTS), "--fail-once"], timeout=900)
    m = re.search(r"(\d+)\s+fault\(s\)\s+injected,\s+(\d+)\s+survived", out)
    if not m:
        raise SystemExit(f"the fault suite did not report its own tally, so the figure cannot be put on screen:\n{out[-2000:]}")
    return {"ran": True, "injected": int(m.group(1)), "survived": int(m.group(2)),
            "passed": code == 0, "names": names}


def lean_audit(rows):
    """What the Lean kernel accepted in the recorded run: declarations audited, and on what axioms."""
    laws = [r for r in rows if r.get("type") == "law" and r.get("lean_file")]
    audited = sum((l.get("audit") or {}).get("audited") or 0 for l in laws)
    axioms = sorted({a for l in laws for a in ((l.get("audit") or {}).get("axioms") or [])})
    return {"laws": len(laws), "audited": audited, "axioms": axioms}


def load(run_guards=True):
    D = mint()
    D["best"] = best_practices()
    D["faults"] = fault_suite(run_guards)
    D["lean"] = lean_audit(D["rows"])
    if D["lean"]["audited"] != D["run"]["declarations_audited"]:
        raise SystemExit("the recorded run and its store disagree about how many declarations were audited")
    return D

# ----------------------------------------------------------------------------- layout

# One column per primitive, in the order the method runs. A node's place is its own type and its
# position in the chain, so the same store always draws the same picture.
COLUMNS = [("evidence", 168), ("fact", 468), ("law", 772), ("verdict", 1072), ("build", 1344)]
CHAPTER_OF_STEP = {
    "adopt": 0, "record": 1, "as-published": 2, "audit": 2, "verdict": 3, "build": 4, "read": 5, "ci": 5,
}
WINDOW = [(T_IN0, T_IN1), (T_RE0, T_RE1), (T_LA0, T_LA1), (T_VE0, T_VE1), (T_BU0, T_BU1), (T_GU0, T_GU1)]


def col_of(row):
    return "build" if row["type"] in ("build", "refusal") else row["type"]


def layout(D):
    L = {}
    for name, x in COLUMNS:
        rows = [r for r in D["rows"] if col_of(r) == name]
        for i, r in enumerate(rows):
            y = GY0 + 112 + (GY1 - GY0 - 206) * ((i + 0.5) / max(1, len(rows)))
            L[r["id"]] = (x, y)
    return L


def arrival(D):
    """When each node lands: inside its own chapter's window, in the order the commands ran."""
    at = {}
    order = [r["id"] for r in D["rows"]]
    for ci, (t0, t1) in enumerate(WINDOW):
        ids = [nid for nid, step_i in D["chapter_of"].items()
               if CHAPTER_OF_STEP.get(D["steps"][step_i]["step"]) == ci]
        ids.sort(key=order.index)
        span = (t1 - t0) * 0.74      # the rest of the window is left to sit and be read
        for i, nid in enumerate(ids):
            at[nid] = t0 + 0.7 + span * (i / max(1, len(ids)))
    return at


def node_color(row):
    if row["type"] == "verdict":
        return {"inside": INSIDE, "outside": OUTSIDE, "cannot-assess": CANNOT}.get(row["result"], INK2)
    return {"refusal": REFUSED, "build": BUILT, "law": INK, "fact": EDGE}.get(row["type"], INK2)


def chapters(D):
    run, lean = D["run"], D["lean"]
    repo = run["repo"].replace("https://", "")
    refused = sum(1 for s in D["steps"] if s["step"] == "as-published" and s["exit"] != 0)
    return [
        (T_INIT, "A public repository, and one command",
         f"{repo} at commit {run['commit'][:8]}. Three of its Lean files each say they contain no sorry. "
         f"delphi init adds a store, a method document and a private graph, and changes nothing else."),
        (T_REC, "First, the claim in the project's own words",
         "evidence is a source and the exact line read in it; a fact is the number in that line, filed "
         "under it with the file and commit it belongs to. Neither can be recorded without the other."),
        (T_LAW, "As published, the claim cannot be checked",
         f"{refused} refusals: no file asks Lean to print its axioms, so nothing in it can be audited. "
         f"A copy with one audit line per theorem can be: {lean['audited']} declarations, all accepted."),
        (T_VERD, "A law applied to a fact",
         "inside, outside, or cannot-assess. The zero-sorry claims hold. The claim of a sub-second check "
         "was never timed, so it is cannot-assess: a result, never a pass."),
        (T_BUILD, "The refusal is the useful output",
         "an artifact appears only if every verdict under it holds. The badge resting on the untimed claim "
         "is refused, and the refusal recorded; the audit report is minted and its file hashed."),
        (T_GUARD, "And the guards that hold it up",
         "the same command line is driven in a throwaway project with one deliberate fault injected at a "
         "time, and none may survive. Then two commands for CI: verify, and doctor."),
    ]


def ledger_rows(D):
    b, f, lean, run = D["best"], D["faults"], D["lean"], D["run"]
    cmds = len(set(re.findall(r"^//\s+delphi ([a-z-]+)", CLI.read_text(encoding="utf8"), re.M)))
    verdicts = [r for r in D["rows"] if r["type"] == "verdict"]
    tally = {k: sum(1 for r in verdicts if r["result"] == k) for k in ("inside", "outside", "cannot-assess")}
    refused = sum(1 for s in D["steps"] if s["step"] == "as-published" and s["exit"] != 0)
    rows = [
        (T_IN0 + 0.6, f"{len(run['steps'])}", "commands run on the repository",
         f"out of a toolset of {cmds}; every one shown as it ran"),
        (T_RE0 + 0.4, f"{len(b['rules'])}", "rules the kernel enforces",
         "each names the guard behind it, and the doc fails if that guard goes"),
        (T_RE0 + 3.0, f"{len(b['habits'])}", "habits it cannot enforce",
         "listed apart, so nobody reads them as guarantees"),
        (T_LA0 + 0.4, f"{refused}", "files refused as published",
         "none asks for its axioms to be printed"),
        (T_LA0 + 4.6, f"{lean['audited']}", "declarations audited, all accepted",
         f"within {', '.join(lean['axioms']) if lean['axioms'] else 'no recorded axioms'}"),
        (T_VE0 + 0.4, f"{len(verdicts)}", "verdicts",
         f"{tally['inside']} inside · {tally['outside']} outside · {tally['cannot-assess']} cannot-assess"),
        (T_BU0 + 0.4, f"{sum(1 for r in D['rows'] if r['type'] == 'build')}", "artifact minted",
         f"{sum(1 for r in D['rows'] if r['type'] == 'refusal')} refused, naming what was missing"),
        (T_BU0 + 3.0, f"{len(D['rows'])}", "nodes in the project's graph",
         f"{len(D['graph']['edges'])} edges, every one a field in a record"),
    ]
    if f["ran"]:
        rows.append((T_GU0 + 0.4, f"{f['injected']}", "faults injected into the toolset",
                     f"{f['survived']} survived"))
    return rows

# ----------------------------------------------------------------------------- painting

def paint(t, D, L, at):
    img = Image.new("RGB", (P(W), P(H)), PAPER)
    d = ImageDraw.Draw(img)

    for x in range(GX0, GX1 + 1, 64):
        d.line([(P(x), P(GY0 - 8)), (P(x), P(GY1 + 8))], fill=GRID, width=max(1, SS // 2))
    for y in range(GY0, GY1 + 1, 64):
        d.line([(P(GX0 - 8), P(y)), (P(GX1 + 8), P(y))], fill=GRID, width=max(1, SS // 2))

    paint_chapter(d, t, D)
    paint_columns(d, t, D, L, at)
    paint_graph(d, t, D, L, at)
    paint_refused(d, t, D, L, at)
    paint_detail(d, t, D, L, at)
    paint_faults(d, t, D)
    paint_command(d, t, D)
    paint_ledger(d, t, D, ledger_rows(D))
    paint_footer(d, t, D)

    if SS != 1:
        img = img.resize((W, H), Image.LANCZOS)
    return img


def wrap(text, f, width, limit=2):
    words, line, lines = str(text).split(), "", []
    for w in words:
        trial = (line + " " + w).strip()
        if f.getlength(trial) / SS > width and line:
            lines.append(line)
            line = w
        else:
            line = trial
    lines.append(line)
    return lines[:limit]


def paint_chapter(d, t, D):
    ch = chapters(D)
    for i, (t0, title, body) in enumerate(ch):
        a = appear(t, t0, 0.7)
        if a <= 0.01:
            continue
        out = 1.0 if i + 1 >= len(ch) else 1.0 - ease_io((t - (ch[i + 1][0] - 0.7)) / 0.7)
        k = max(0.0, min(a, out))
        if k <= 0.01:
            continue
        d.text((P(48), P(40)), title, font=font(DISPLAY, 29), fill=mix(PAPER, INK, k))
        fb = font(BODY, 15)
        for j, ln in enumerate(wrap(body, fb, 1330)):
            d.text((P(48), P(82 + 21 * j)), ln, font=fb, fill=mix(PAPER, INK2, k))


def paint_columns(d, t, D, L, at):
    for name, x in COLUMNS:
        rows = [r for r in D["rows"] if col_of(r) == name]
        if not rows:
            continue
        a = min(1.0, max(appear(t, at[r["id"]] - 0.6, 0.6) for r in rows))
        if a <= 0.01:
            continue
        label = "build / refusal" if name == "build" else name
        f = font(LABEL, 13)
        d.text((P(x - f.getlength(label) / SS / 2), P(GY0 + 72)), label, font=f, fill=mix(PAPER, INK3, a))


def paint_graph(d, t, D, L, at):
    for e in D["graph"]["edges"]:
        if e["from"] not in L or e["to"] not in L:
            continue
        a = appear(t, max(at[e["from"]], at[e["to"]]) + 0.12, 0.5)
        if a <= 0.01:
            continue
        (x0, y0), (x1, y1) = L[e["from"]], L[e["to"]]
        mx = (x0 + x1) / 2
        d.line([(P(x0), P(y0)), (P(mx), P(y0)), (P(mx), P(y1)), (P(x1), P(y1))],
               fill=mix(PAPER, EDGE, 0.40 * a), width=max(1, SS), joint="curve")

    for r in D["rows"]:
        a = appear(t, at[r["id"]], 0.5)
        if a <= 0.01:
            continue
        x, y = L[r["id"]]
        rad = 9 + 5 * (1 - ease_io(min(1.0, (t - at[r["id"]]) / 0.9)))
        d.ellipse([P(x - rad), P(y - rad), P(x + rad), P(y + rad)], fill=mix(PAPER, node_color(r), a))
        lab = {"build": r.get("artifact"), "refusal": r.get("what"),
               "verdict": r.get("label") or r.get("law_name"), "law": r.get("name")}.get(r["type"])
        if lab:
            f = font(LABEL, 13)
            lab = fit(str(lab), f, 250)
            d.text((P(x - f.getlength(lab) / SS / 2), P(y - rad - 23)), lab, font=f, fill=mix(PAPER, INK, a))
        f2 = font(BODY, 10)
        d.text((P(x - f2.getlength(r["id"]) / SS / 2), P(y + rad + 7)), r["id"],
               font=f2, fill=mix(PAPER, INK3, a * 0.9))


def paint_detail(d, t, D, L, at):
    """What the record carries, beside the node that carries it: a quote, conditions, a reason."""
    for r in D["rows"]:
        if r["type"] == "evidence":
            lines = ['"' + r["quote"] + '"', f'{r["kind"]}:{r["ref"]} — {r["where"]}']
        elif r["type"] == "fact":
            c = r.get("conditions") or {}
            lines = [f'{r["quantity"]} = {r["value"]} {r["unit"]}',
                     ", ".join(f"{k} {v}" for k, v in c.items())]
        elif r["type"] == "law":
            lines = [r["informal"],
                     f'checked by a script, not a prover: {r.get("script")}'
                     if r.get("script") and not r.get("lean_file") else str(r.get("lean_file"))]
        elif r["type"] == "verdict":
            lines = [r["result"].upper(), str(r.get("detail") or "")]
        elif r["type"] == "refusal":
            lines = ["refused, and the refusal recorded", (r.get("because") or [""])[0]]
        elif r["type"] == "build":
            em = (r.get("emitted") or [{}])[0]
            lines = ["minted, and the file hashed into the record",
                     f'{em.get("path", "")}  sha256 {em.get("sha256", "")}']
        else:
            continue

        a = appear(t, at[r["id"]] + 0.35, 0.6)
        ci = CHAPTER_OF_STEP.get(D["steps"][D["chapter_of"][r["id"]]]["step"], 0)
        k = max(0.0, min(a, 1.0 - ease_io((t - (WINDOW[ci][1] + 0.4)) / 0.8)))
        if k <= 0.01:
            continue
        x, y = L[r["id"]]
        fh, fb = font(LABEL, 13), font(BODY, 12)
        l0, l1 = fit(lines[0], fh, 300), fit(lines[1], fb, 300)
        w = max(fh.getlength(l0), fb.getlength(l1)) / SS + 20
        x0 = min(x + 22, GX1 - w - 6)
        d.rectangle([P(x0), P(y + 30), P(x0 + w), P(y + 76)], fill=mix(PAPER, PAPER2, k))
        d.line([(P(x0), P(y + 30)), (P(x0), P(y + 76))], fill=mix(PAPER, EDGE, k * 0.7), width=max(1, SS))
        d.text((P(x0 + 10), P(y + 36)), l0, font=fh, fill=mix(PAPER, INK, k))
        d.text((P(x0 + 10), P(y + 56)), l1, font=fb, fill=mix(PAPER, INK2, k * 0.95))


def cmd_times(D):
    """When each command is typed: in its own chapter, one after another, sharing the window evenly."""
    per = {}
    for s in D["steps"]:
        ci = CHAPTER_OF_STEP.get(s["step"], 0)
        per[ci] = per.get(ci, 0) + 1
    out, seen = [], {}
    for s in D["steps"]:
        ci = CHAPTER_OF_STEP.get(s["step"], 0)
        n = seen.get(ci, 0)
        seen[ci] = n + 1
        t0, t1 = WINDOW[ci]
        # the guards chapter keeps its first stretch for the fault count before the CI commands appear
        lead = (t1 - t0) * 0.42 if ci == 5 else 0.1
        slot = ((t1 - t0) * 0.92 - lead) / per[ci]
        out.append((t0 + lead + slot * n, slot, s))
    return out


def paint_command(d, t, D):
    """The command that minted what is on screen, typed out as it was actually run."""
    cur = [(t0, slot, s) for t0, slot, s in cmd_times(D) if t >= t0]
    if not cur:
        return
    t0, slot, s = cur[-1]
    d.line([(P(48), P(CMD_Y - 18)), (P(GX1), P(CMD_Y - 18))], fill=RULE, width=max(1, SS))
    fm = font(MONO, 15)
    text = fit(s["cmd"], fm, 1330)
    n = max(1, int(len(text) * min(1.0, (t - t0) / min(1.2, slot * 0.55))))
    d.text((P(48), P(CMD_Y + 2)), text[:n], font=fm, fill=INK)
    if n < len(text) and int(t * 3) % 2 == 0:
        cx = 48 + fm.getlength(text[:n]) / SS
        d.rectangle([P(cx), P(CMD_Y + 2), P(cx + 7), P(CMD_Y + 20)], fill=mix(PAPER, INK, 0.7))
    if n >= len(text):
        fb = font(BODY, 12)
        col = REFUSED if s["exit"] != 0 else INK3
        d.text((P(48), P(CMD_Y + 26)), fit(s["said"], fb, 1330), font=fb, fill=col)


def paint_refused(d, t, D, L, at):
    """A law the kernel would not accept leaves no node. It is drawn as an empty ring where the law
    would have been, until the audited copy is accepted and a node lands there."""
    laws = [r for r in D["rows"] if r["type"] == "law"]
    tries = [(t0, s) for t0, slot, s in cmd_times(D) if s["step"] == "as-published" and s["exit"] != 0]
    for (t0, s), law in zip(tries, laws):
        a = appear(t, t0 + 0.3, 0.4)
        k = max(0.0, min(a, 1.0 - appear(t, at[law["id"]], 0.4)))
        if k <= 0.01:
            continue
        x, y = L[law["id"]]
        d.ellipse([P(x - 11), P(y - 11), P(x + 11), P(y + 11)], outline=mix(PAPER, REFUSED, k), width=max(2, SS * 2))
        f = font(LABEL, 13)
        lab = "as published: refused"
        d.text((P(x - f.getlength(lab) / SS / 2), P(y - 34)), lab, font=f, fill=mix(PAPER, REFUSED, k))

def paint_faults(d, t, D):
    """The last chapter: one deliberate fault at a time, each one stopped short of the chain."""
    f = D["faults"]
    if not f["ran"]:
        return
    a = appear(t, T_GU0, 0.8)
    if a <= 0.01:
        return
    total, names = f["injected"], f["names"]
    span = (T_GU1 - T_GU0) * 0.70
    shown = counted(t, T_GU0 + 0.6, span, total)
    cx, cy = (GX0 + GX1) / 2, (GY0 + GY1) / 2 + 24
    for i in range(total):
        ang = 2.399963229728653 * i
        t_i = T_GU0 + 0.6 + span * (i / max(1, total))
        p = ease(min(1.0, max(0.0, (t - t_i) / 0.8)))
        if p <= 0.01:
            continue
        rad = 560 + (190 - 560) * p
        x, y = cx + rad * math.cos(ang) * 1.12, cy + rad * math.sin(ang) * 0.58
        d.ellipse([P(x - 4), P(y - 4), P(x + 4), P(y + 4)], fill=mix(PAPER, OUTSIDE, 0.85 * p))
        if p >= 0.999:
            d.line([(P(x - 7), P(y - 7)), (P(x + 7), P(y + 7))], fill=mix(PAPER, INK3, 0.85), width=max(1, SS))
            d.line([(P(x - 7), P(y + 7)), (P(x + 7), P(y - 7))], fill=mix(PAPER, INK3, 0.85), width=max(1, SS))
    big = font(DISPLAY, 58)
    lab = str(shown)
    pad = font(BODY, 12)
    d.rectangle([P(cx - 210), P(cy - 46), P(cx + 210), P(cy + 76)], fill=PAPER)
    d.text((P(cx - big.getlength(lab) / SS / 2), P(cy - 42)), lab, font=big, fill=mix(PAPER, INK, a))
    fh = font(LABEL, 15)
    sub = f"faults injected, {f['survived']} survived"
    d.text((P(cx - fh.getlength(sub) / SS / 2), P(cy + 26)), sub, font=fh, fill=mix(PAPER, INK2, a))
    if names:
        k = min(len(names) - 1, max(0, int((t - T_GU0 - 0.6) / 0.44)))
        nm = fit(names[k], pad, 400)
        d.text((P(cx - pad.getlength(nm) / SS / 2), P(cy + 52)), nm, font=pad, fill=mix(PAPER, INK3, a))


def paint_ledger(d, t, D, rows):
    d.line([(P(COL_X - 28), P(GY0 - 8)), (P(COL_X - 28), P(GY1 + 8))], fill=RULE, width=max(1, SS))
    pitch = min(96, int((GY1 - GY0 - 16) / max(1, len(rows))))
    for i, (t0, figure, what, note) in enumerate(rows):
        a = appear(t, t0, 0.8)
        if a <= 0.01:
            continue
        y = GY0 + 2 + i * pitch
        m = re.fullmatch(r"(\d+)", figure)
        shown = str(counted(t, t0, 0.9, int(m.group(1)))) if m else figure
        d.text((P(COL_X), P(y)), shown, font=font(DISPLAY, 32), fill=mix(PAPER, INK, a))
        d.text((P(COL_X), P(y + 37)), fit(what, font(LABEL, 13), COL_W),
               font=font(LABEL, 13), fill=mix(PAPER, INK2, a))
        d.text((P(COL_X), P(y + 55)), fit(note, font(BODY, 11), COL_W),
               font=font(BODY, 11), fill=mix(PAPER, INK3, a * 0.95))


def paint_footer(d, t, D):
    a = appear(t, T_GU0 + 1.0, 1.2)
    if a <= 0.01:
        return
    lines = [
        f"Built by tracks/video/cli-graph.py from tracks/kernel/embed/cookbook/: the commands shown are the ones "
        f"cookbook.mjs ran on {D['run']['repo'].replace('https://', '')} at {D['run']['commit'][:8]}, and the graph is the store they made.",
        f"Rule and habit counts read from best-practices.mjs; the fault figures measured by running "
        f"test-embed.mjs here; the audit figures are what Lean printed in that run. Type: {FACE_NAME}, "
        f"commands in {MONO_NAME}. Silent by design.",
    ]
    for j, line in enumerate(lines):
        d.text((P(48), P(FOOT_Y + 15 * j)), line, font=font(BODY, 10), fill=mix(PAPER, INK3, a * 0.9))


# ----------------------------------------------------------------------------- render

_G = {}


def _init(D, L, at):
    _G.update({"D": D, "L": L, "at": at})


def _frame(job):
    i, t, outdir = job
    paint(t, _G["D"], _G["L"], _G["at"]).save(os.path.join(outdir, f"f{i:05d}.png"))
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
    ap.add_argument("--check", action="store_true", help="resolve every figure and place every node, render nothing")
    ap.add_argument("--preview", action="store_true", help="a few stills, no video")
    ap.add_argument("--fast", action="store_true", help="12 fps, no supersampling")
    ap.add_argument("--no-guards", action="store_true", help="do not run the fault suite")
    ap.add_argument("--workers", type=int, default=WORKERS)
    args = ap.parse_args()
    if args.fast:
        SS, FPS = 1, 12

    D = load(run_guards=not args.no_guards)
    L = layout(D)
    at = arrival(D)
    rows = ledger_rows(D)

    print(f"run      {len(D['rows'])} node(s) minted on {D['run']['repo']} at {D['run']['commit'][:8]}, read from the recorded run")
    print(f"steps    {len(D['steps'])} command(s), {sum(1 for s in D['steps'] if s['exit'] != 0)} of them refusals")
    print(f"rules    {len(D['best']['rules'])} enforced, {len(D['best']['habits'])} habit(s) not enforced")
    print(f"lean     {D['lean']['audited']} declaration(s) audited, axioms {', '.join(D['lean']['axioms'])}")
    if D["faults"]["ran"]:
        print(f"faults   {D['faults']['injected']} injected, {D['faults']['survived']} survived")
    print(f"type     {FACE_NAME}; commands in {MONO_NAME}")

    missing = [r["id"] for r in D["rows"] if r["id"] not in L or r["id"] not in at]
    if missing:
        raise SystemExit(f"{len(missing)} node(s) have no place or no time: {missing}")
    if args.check:
        print(f"check    {len(D['rows'])} node(s) placed and timed, {len(rows)} ledger figure(s) resolved, "
              f"{len(chapters(D))} chapters, every figure traced to a file")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if args.preview:
        for i, t in enumerate([3.0, 9.0, 15.0, 20.0, 28.0, 38.0, 42.0, 50.0, 53.0, 60.0, 66.0]):
            p = OUT_DIR / f"cli-preview-{i}.png"
            paint(t, D, L, at).save(p)
            print(f"preview  {p}")
        return

    frames = int(DURATION * FPS)
    tmp = OUT_DIR / "frames-cli"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    jobs = [(i, i / FPS, str(tmp)) for i in range(frames)]
    workers = max(1, min(args.workers, os.cpu_count() or 1))
    with Pool(workers, initializer=_init, initargs=(D, L, at)) as pool:
        for n, _ in enumerate(pool.imap_unordered(_frame, jobs, chunksize=4), 1):
            if n % 120 == 0 or n == frames:
                print(f"frames   {n}/{frames}", flush=True)
    paint(DURATION * 0.62, D, L, at).save(OUT_PNG)
    subprocess.run([ffmpeg_bin(), "-y", "-loglevel", "error", "-framerate", str(FPS),
                    "-i", str(tmp / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-crf", "20", "-movflags", "+faststart", str(OUT_MP4)], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"wrote    {OUT_MP4}  ({OUT_MP4.stat().st_size} bytes, {DURATION:.0f}s, silent)")
    print(f"wrote    {OUT_PNG}")


if __name__ == "__main__":
    main()
