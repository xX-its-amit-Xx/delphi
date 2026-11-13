"""Fetch PMC full text via NCBI E-utilities efetch (fallback when Europe PMC fullTextXML fails).
Usage: python -I pmc_efetch.py PMCID  -> saves data/bm-4d-printing/<PMCID>.txt, logs sha256 in manifest.jsonl"""
import sys, re, html, hashlib, datetime, json, urllib.request
pmc = sys.argv[1]; D = "D:/Users/ashenoy00000/delphi-work/data/bm-4d-printing"
url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id={pmc}&rettype=xml"
b = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"}), timeout=120).read()
t = re.sub(r"<[^>]+>", " ", b.decode("utf-8", "replace")); t = html.unescape(re.sub(r"\s+", " ", t))
open(f"{D}/{pmc}.txt", "w", encoding="utf-8").write(t)
open(f"{D}/manifest.jsonl", "a").write(json.dumps({"url": url, "file": f"{D}/{pmc}.txt", "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), "date": datetime.date.today().isoformat()}) + "\n")
print(pmc, len(t))
