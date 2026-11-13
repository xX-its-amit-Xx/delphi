"""Builds q1-mechanisms.json by running build_part1..3 in one namespace; each evidence_quote is verified verbatim."""
import os
d=os.path.dirname(os.path.abspath(__file__)); g={}
for p in ("build_part1.py","build_part2.py","build_part3.py"): exec(compile(open(os.path.join(d,p),encoding="utf-8").read(),p,"exec"),g)
