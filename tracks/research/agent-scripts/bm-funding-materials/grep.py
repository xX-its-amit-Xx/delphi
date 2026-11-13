"""usage: python -I grep.py file.txt 'regex' [width=200] [max=10]  (searches text saved by fetch.py)"""
import sys; sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import re, sys
f, pat = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 200
mx = int(sys.argv[4]) if len(sys.argv) > 4 else 10
t = open(r"D:/Users/ashenoy00000/delphi-work/data/bm-funding/" + f, encoding="utf-8").read()
for i, m in enumerate(re.finditer(pat, t, re.I)):
    if i >= mx: break
    print("..." + t[max(0, m.start()-w): m.end()+w] + "...\n")
