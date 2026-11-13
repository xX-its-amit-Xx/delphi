# -*- coding: utf-8 -*-
"""Assemble agents2/bm-4d-printing-review.json. Verifies every evidence_quote against the saved source text first.
Run: python -I build_result.py   (needs findings_data.py and result_text.py in the same folder; sys.path is set below)"""
import json, os, re, sys, hashlib, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import findings_data as FD
import result_text as RT
DATA = "D:/Users/ashenoy00000/delphi-work/data/bm-4d-printing"
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-4d-printing-review.json"

def norm(s): return re.sub(r"\s+", " ", s).strip()
bad = []
findings = []
for f in FD.F:
    q = f["evidence_quote"]; fn = f.pop("file")
    if q:
        txt = norm(open(os.path.join(DATA, fn), encoding="utf-8").read())
        if norm(q) not in txt:
            bad.append((fn, q[:80]))
        if len(q.split()) > 40:
            bad.append(("TOO LONG", q[:60]))
    findings.append(f)
print("findings", len(findings), "quote problems", bad)
if bad: sys.exit(1)

# manifest of kept files
man = []
for line in open(os.path.join(DATA, "manifest.jsonl"), encoding="utf-8"):
    man.append(json.loads(line))
files = {}
for fn in sorted(os.listdir(DATA)):
    p = os.path.join(DATA, fn)
    if fn.endswith(".jsonl"): continue
    files[fn] = {"bytes": os.path.getsize(p), "sha256": hashlib.sha256(open(p, "rb").read()).hexdigest()}
total = sum(v["bytes"] for v in files.values())
print("data files", len(files), "total bytes", total)

res = dict(label="bm-4d-printing-review", topic="4D printing and shape-morphing: state of the art with numbers", summary=RT.SUMMARY, lay_summary=RT.LAY,
           findings=findings, table=RT.TABLE, key_claims=RT.KEY_CLAIMS, recommendations=RT.RECS, reproduce=RT.REPRO, citations=RT.CITES,
           could_not_find=RT.CNF, glossary=RT.GLOSSARY, scripts_written=RT.SCRIPTS,
           data_files_kept={"dir": DATA, "total_bytes": total, "files": files, "download_log": "manifest.jsonl in the same folder (url, date, bytes, sha256 per fetched file)"},
           generated=datetime.date.today().isoformat())
json.dump(res, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
chk = json.load(open(OUT, encoding="utf-8")); print("written", OUT, len(json.dumps(chk)), "chars; keys", list(chk)[:6])
