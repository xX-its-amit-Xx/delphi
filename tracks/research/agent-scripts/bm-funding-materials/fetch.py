"""Fetch URLs, save raw + text under data/bm-funding, log url/date/bytes/sha256 to manifest.tsv.
usage: python -I fetch.py name=url [name=url ...]"""
import sys, os, re, hashlib, datetime, urllib.request, html, ssl
OUT = r"D:/Users/ashenoy00000/delphi-work/data/bm-funding"
os.makedirs(OUT, exist_ok=True)
def txt(h):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    h = html.unescape(h)
    return re.sub(r"\s+", " ", h)
for a in sys.argv[1:]:
    name, url = a.split("=", 1)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
        with urllib.request.urlopen(req, timeout=40) as r:
            b = r.read(); ct = r.headers.get("Content-Type", ""); code = r.status
    except Exception as e:
        print("FAIL", name, url, e); continue
    ext = "pdf" if b[:4] == b"%PDF" else "html"
    p = f"{OUT}/{name}.{ext}"
    open(p, "wb").write(b)
    if ext == "html":
        open(f"{OUT}/{name}.txt", "w", encoding="utf-8").write(txt(b.decode("utf-8", "replace")))
    sha = hashlib.sha256(b).hexdigest()
    with open(f"{OUT}/manifest.tsv", "a") as m:
        m.write(f"{name}\t{url}\t{datetime.date.today()}\t{len(b)}\t{sha}\n")
    print("OK", name, code, len(b), ext)
