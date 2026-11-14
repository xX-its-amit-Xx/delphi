"""Check every evidence quote is verbatim in the saved page text.
Usage: python -I verify.py [--fail-once]   (run fetch.py first; run_all.sh does both)
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PRMM_DATA", "C:/Temp/delphi-sprint/pr-mamou-mani-fit/raw")
norm = lambda s: re.sub(r"\s+", " ", s.replace("\u00a0", " ")).strip()
Q = json.load(open(os.path.join(HERE, "quotes.json"), encoding="utf-8"))
if "--fail-once" in sys.argv: Q = Q + [["mm_tate", "this sentence is not on the page zzz"]]
ok = bad = 0; lines = []
for key, q in Q:
    p = os.path.join(OUT, key + ".txt")
    t = norm(open(p, encoding="utf-8").read()) if os.path.exists(p) else ""
    hit = norm(q) in t
    ok += hit; bad += (not hit)
    lines.append(("PASS" if hit else "FAIL") + "\t" + key + "\t" + q)
open(os.path.join(HERE, "quote_check.tsv"), "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
for l in lines:
    if l.startswith("FAIL"): print(l)
print("quotes verbatim: %d of %d" % (ok, ok + bad))
sys.exit(1 if bad else 0)
