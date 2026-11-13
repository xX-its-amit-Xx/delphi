"""Fetch a PMC article HTML page, strip tags, save as <PMCID>.txt in data dir. Usage: python -I pmc_html.py PMCID"""
import sys, re, html, hashlib, datetime, json, urllib.request
pmc = sys.argv[1]; D = "D:/Users/ashenoy00000/delphi-work/data/bm-4d-printing"
url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmc}/"
b = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"}), timeout=90).read()
t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", b.decode("utf-8", "replace"), flags=re.S)
t = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)))
open(f"{D}/{pmc}.txt", "w", encoding="utf-8").write(t)
open(f"{D}/manifest.jsonl", "a").write(json.dumps({"url": url, "file": f"{D}/{pmc}.txt", "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), "date": datetime.date.today().isoformat()}) + "\n")
print(pmc, len(t))
