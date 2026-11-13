"""grep a saved text. Usage: python -I g.py PMCID regex [ctx=150] [max=8]"""
import sys, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
p, pat = sys.argv[1], sys.argv[2]; ctx = int(sys.argv[3]) if len(sys.argv) > 3 else 150; mx = int(sys.argv[4]) if len(sys.argv) > 4 else 8
t = open(f"D:/Users/ashenoy00000/delphi-work/data/bm-4d-printing/{p}.txt", encoding="utf-8").read()
ms = list(re.finditer(pat, t, re.I)); print(len(ms), "hits")
for m in ms[:mx]:
    print(">>", t[max(0, m.start()-ctx): m.end()+ctx], "\n")
