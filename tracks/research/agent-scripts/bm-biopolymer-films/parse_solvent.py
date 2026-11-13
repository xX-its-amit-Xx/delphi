#!/usr/bin/env python3
"""Parse Formlabs solvent-compatibility HTML table(s) from scratch/formlabs_solvent.html with a plain HTML parser; print header + rows for chosen resins."""
import re,html,sys
raw=open(r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films/formlabs_solvent.html",encoding="utf8").read()
tabs=re.findall(r"<table.*?</table>",raw,flags=re.S)
print("tables",len(tabs))
want=[w.lower() for w in sys.argv[1:]] or ["rigid 10k","elastic 50a","flexible 80a","silicone 40a","clear","tough 2000","grey"]
for ti,t in enumerate(tabs):
    rows=re.findall(r"<tr.*?</tr>",t,flags=re.S)
    cells=[[re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",c))).strip() for c in re.findall(r"<t[hd].*?</t[hd]>",r,flags=re.S)] for r in rows]
    print("--- table",ti,"rows",len(cells)); 
    for r in cells[:2]: print(r)
    for r in cells[2:]:
        if r and any(w in r[0].lower() for w in want): print(r)
