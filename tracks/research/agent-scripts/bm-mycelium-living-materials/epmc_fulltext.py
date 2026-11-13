"""Usage: python -I epmc_fulltext.py PMCID outdir -- saves fullTextXML and plain text; prints byte size and sha256."""
import sys, os, re, html, hashlib, urllib.request
pm, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
u=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pm}/fullTextXML"
b=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=120).read()
open(os.path.join(out,pm+".xml"),"wb").write(b)
t=b.decode("utf-8","ignore")
t=re.sub(r"<xref[^>]*>.*?</xref>","",t,flags=re.S)
t=html.unescape(re.sub(r"<[^>]+>"," ",t)); t=re.sub(r"\s+"," ",t)
open(os.path.join(out,pm+".txt"),"w",encoding="utf-8").write(t)
print(pm,u,len(b),hashlib.sha256(b).hexdigest(),len(t))
