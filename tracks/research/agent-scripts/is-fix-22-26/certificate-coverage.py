#!/usr/bin/env python3
"""Issue #22: list, per track, the elimination certificates (theorems named *rules_out* / *eliminate*)
and the law set the repo is on. Exit 1 if any track t1..t6 has none.
Proposed repo path: tracks/scripts/certificate-coverage.py
Usage: python tracks/scripts/certificate-coverage.py [repo_root]
"""
import json, re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
pat = re.compile(r"^\s*theorem\s+(\S*(?:rules_out|eliminate)\S*)", re.M)
found = {}
for f in sorted(list((root / "tracks/research/lean").glob("*.lean")) + list((root / "tracks/lean").glob("*.lean"))):
    names = pat.findall(f.read_text(encoding="utf-8", errors="replace"))
    m = re.match(r"(t\d|q\d)-", f.name)
    key = m.group(1) if m else ("t5" if "Hygromorph" in f.name else f.stem)
    found.setdefault(key, []).extend(f"{f.name}::{n}" for n in names)
sets = sorted((root / "lean/registry/lawsets").glob("lawset-*.json"),
              key=lambda p: [int(x) for x in re.findall(r"\d+", p.name)])
print("current law set file:", sets[-1].name if sets else "none")
bad = 0
for t in ["t1", "t2", "t3", "t4", "t5", "t6"]:
    c = sorted(set(found.get(t, [])))
    print(f"{t}: {len(c)} certificate(s)", *c, sep="\n    ")
    bad += not c
for k in sorted(set(found) - {"t1", "t2", "t3", "t4", "t5", "t6"}):
    print(f"{k}: {len(found[k])}")
sys.exit(1 if bad else 0)
