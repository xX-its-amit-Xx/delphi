"""Read-only checks on the law library (set 1.8.1) and the public code repo.
Run: python -I -X utf8 03_lawset_and_github.py"""
import json, os, re, urllib.request, hashlib, datetime
R = r"D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean"
cur = json.load(open(R + "/registry/lawsets/current.json"))
ls = json.load(open(R + "/registry/lawsets/" + cur["file"]))
print("current law set:", cur["version"], "laws pinned:", len(ls["laws"]))
byid = {l["law_id"]: l for l in ls["laws"]}
print("physiology-laplace:", byid["physiology-laplace"])
# does any registry law file, or any Lean file under Delphi/, mention lumen / cyst / epithelium?
hits = []
for base in ("registry/laws", "Delphi", "registry/proposals", "registry/discovered"):
    for dp, _, fs in os.walk(os.path.join(R, base)):
        for f in fs:
            p = os.path.join(dp, f)
            try: t = open(p, encoding="utf8", errors="ignore").read().lower()
            except Exception: continue
            if re.search(r"\blumen\b|\blumina\b|\bcyst\b|epitheli", t): hits.append(p.replace(R, ""))
print("files mentioning lumen/cyst/epitheli:", hits)
lap = json.load(open(R + "/registry/laws/physiology-laplace.json"))
print("laplace statement_en:", lap["statement_en"])
print("laplace assumed:", lap["scope"]["assumed"])
print("laplace sha of json file:", hashlib.sha256(open(R + "/registry/laws/physiology-laplace.json", "rb").read()).hexdigest())
# Lean statement lines
for i, line in enumerate(open(R + "/Delphi/Physiology.lean", encoding="utf8"), 1):
    if "sphereWallStress" in line and ("def " in line or "theorem" in line) or "theorem laplace_pressure_limit" in line:
        print("Physiology.lean:%d: %s" % (i, line.rstrip()))
# GitHub repo metadata (public API, no login)
u = "https://api.github.com/repos/AlexDunnLab/lumen-shape"
b = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "delphi-research/0.1"}), timeout=60).read()
open(r"D:/Users/ashenoy00000/delphi-work/data/lumen-lay/github_lumen_shape.json", "wb").write(b)
g = json.loads(b)
print("github:", g["full_name"], "license:", (g.get("license") or {}).get("spdx_id"), "pushed_at:", g["pushed_at"], "size_kb:", g["size"], "fetched", datetime.date.today(), "sha256", hashlib.sha256(b).hexdigest())
