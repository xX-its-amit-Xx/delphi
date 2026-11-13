#!/usr/bin/env python3
"""Download URL (html or pdf) to scratch, convert to text, log url/date/bytes/sha256 to manifest.tsv, print keyword snippets.
usage: fetch_doc.py NAME URL [kw1,kw2,...] [width] ; text saved as scratch/NAME.txt"""
import sys, re, hashlib, datetime, subprocess, urllib.request, os
name,url=sys.argv[1],sys.argv[2]; kws=sys.argv[3].split(",") if len(sys.argv)>3 and sys.argv[3] else []; w=int(sys.argv[4]) if len(sys.argv)>4 else 200
out=r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films"
r=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 delphi-research/0.1"})
b=urllib.request.urlopen(r,timeout=90).read()
if len(b)>20_000_000: sys.exit("too big")
ispdf=b[:5]==b"%PDF-"
raw=f"{out}/{name}.{'pdf' if ispdf else 'html'}"; open(raw,"wb").write(b)
if ispdf:
    subprocess.run(["pdftotext","-enc","UTF-8",raw,f"{out}/{name}.txt"],check=False)
    t=open(f"{out}/{name}.txt",encoding="utf8",errors="ignore").read()
else:
    t=re.sub(r"<(script|style)[^>]*>.*?</\1>"," ",b.decode("utf8","ignore"),flags=re.S); t=re.sub(r"<[^>]+>"," ",t)
    import html; t=html.unescape(t); open(f"{out}/{name}.txt","w",encoding="utf8").write(t)
t=re.sub(r"\s+"," ",t)
open(f"{out}/manifest.tsv","a").write(f"{name}\t{url}\t{datetime.date.today()}\t{len(b)}\t{hashlib.sha256(b).hexdigest()}\n")
print("bytes",len(b),"pdf" if ispdf else "html","chars",len(t)); print(t[:300])
for k in kws:
    print("== ",k)
    for m in list(re.finditer(k,t,re.I))[:6]:
        s=max(0,m.start()-w); print("  ..."+t[s:m.end()+w]+"...")
