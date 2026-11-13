"""Fetch Europe PMC full-text XML, strip to plain text, save, and grep.
Usage: python -I epmc_text.py PMCID [regex] [ctx_chars]
Saves to D:/Users/ashenoy00000/delphi-work/data/bm-4d-printing/<PMCID>.txt (+ manifest)."""
import sys, io, re, hashlib, datetime, json, urllib.request, os, html
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
pmc = sys.argv[1]; pat = sys.argv[2] if len(sys.argv) > 2 else None; ctx = int(sys.argv[3]) if len(sys.argv) > 3 else 200
D = "D:/Users/ashenoy00000/delphi-work/data/bm-4d-printing"
f = f"{D}/{pmc}.txt"
url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmc}/fullTextXML"
if not os.path.exists(f):
    req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
    b = urllib.request.urlopen(req, timeout=90).read()
    t = re.sub(r"<[^>]+>", " ", b.decode("utf-8", "replace")); t = html.unescape(re.sub(r"\s+", " ", t))
    open(f, "w", encoding="utf-8").write(t)
    open(f"{D}/manifest.jsonl", "a").write(json.dumps({"url": url, "file": f, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), "date": datetime.date.today().isoformat()}) + "\n")
t = open(f, encoding="utf-8").read()
print(pmc, "chars", len(t)); print(t[:300])
if pat:
    for m in list(re.finditer(pat, t, re.I))[:25]:
        s = max(0, m.start() - ctx); print("...", t[s:m.end() + ctx], "...\n")
