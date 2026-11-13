#!/usr/bin/env python3
"""Check every evidence_quote in findings_a/b appears verbatim (NFKC, whitespace-collapsed) in its scratch source text. Exit 1 on any miss."""
import sys,re,unicodedata
sys.path.insert(0,r"D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-biopolymer-films")
from findings_a import FA
from findings_b import FB
S=r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films"
def norm(x): x=unicodedata.normalize("NFKC",x); x=x.replace("’","'").replace("−","-").replace("–","-").replace("\u2010","-").replace("\u2011","-"); return re.sub(r"\s+","",x)
bad=0
for i,f in enumerate(FA+FB):
    q=f["quote"]
    if not q: print(i,"NO QUOTE (calc/gap):",f["claim"][:60]); continue
    if len(q.split())>40: print(i,"QUOTE >40 words"); bad+=1
    t=norm(open(f"{S}/{f['file']}.txt",encoding="utf8",errors="ignore").read())
    ok=norm(q) in t
    print(i,"OK " if ok else "MISS",f["file"],"|",q[:70])
    bad+= (not ok)
sys.exit(1 if bad else 0)
