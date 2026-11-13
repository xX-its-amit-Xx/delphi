#!/usr/bin/env python3
"""Print words of the D471 page of the Flexible 80A V2 TDS grouped by y (line) with x positions, to map solvent labels to rows."""
import pymupdf
doc=pymupdf.open(r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films/flex80a_v2_tds.pdf")
page=[p for p in doc if "ASTM D471" in p.get_text()][0]
w=page.get_text("words")
rows={}
for x0,y0,x1,y1,t,*_ in w:
    if 330<y0<760: rows.setdefault(round(y0/3),[]).append((round(x0),t))
for k in sorted(rows): print(k*3, " ".join(f"{t}@{x}" for x,t in sorted(rows[k])))
