#!/usr/bin/env python3
"""Fetch Europe PMC full text XML for a PMCID, save to scratch, print keyword snippets.
usage: epmc_text.py PMCID kw1,kw2,... [width]"""
import sys, re, urllib.request, os, hashlib
pm=sys.argv[1]; kws=sys.argv[2].split(",") if len(sys.argv)>2 else []; w=int(sys.argv[3]) if len(sys.argv)>3 else 220
out=r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films"
u=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pm}/fullTextXML"
r=urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"})
b=urllib.request.urlopen(r,timeout=60).read()
open(f"{out}/{pm}.xml","wb").write(b)
print("bytes",len(b),"sha256",hashlib.sha256(b).hexdigest()[:16])
t=re.sub(r"<[^>]+>"," ",b.decode("utf8","ignore")); t=re.sub(r"\s+"," ",t)
print(t[:400])
for k in kws:
    print("== ",k)
    for m in list(re.finditer(k,t,re.I))[:6]:
        s=max(0,m.start()-w); print("  ..."+t[s:m.end()+w]+"...")
