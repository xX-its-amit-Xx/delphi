#!/usr/bin/env python
"""Fetch a list of URLs to D:/.../data/formlabs-printing, convert to text, record sha256/size/date.
Usage: python fetch.py name=url [name=url ...]
Output: <name>.html|.pdf, <name>.txt, and appends to MANIFEST.tsv
"""
import sys, os, re, hashlib, subprocess, datetime, html, urllib.request
OUT = "D:/Users/ashenoy00000/delphi-work/data/formlabs-printing"
os.makedirs(OUT, exist_ok=True)
UA = "delphi-research/0.1"

def strip_html(s):
    s = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h\d|section|table)>", "\n", s)
    s = re.sub(r"(?i)</t[dh]>", " | ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t\xa0]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s

for arg in sys.argv[1:]:
    name, url = arg.split("=", 1)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        r = urllib.request.urlopen(req, timeout=60)
        data = r.read(); ctype = r.headers.get("Content-Type", ""); code = r.status
    except Exception as e:
        print(name, "FAIL", e); continue
    ext = "pdf" if ("pdf" in ctype or url.lower().endswith(".pdf")) else "html"
    p = os.path.join(OUT, f"{name}.{ext}")
    open(p, "wb").write(data)
    if ext == "pdf":
        subprocess.run(["pdftotext", "-layout", p, os.path.join(OUT, name + ".txt")])
    else:
        open(os.path.join(OUT, name + ".txt"), "w", encoding="utf-8").write(strip_html(data.decode("utf-8", "replace")))
    sha = hashlib.sha256(data).hexdigest()
    line = f"{name}\t{url}\t{datetime.date.today()}\t{len(data)}\t{sha}\n"
    open(os.path.join(OUT, "MANIFEST.tsv"), "a", encoding="utf-8").write(line)
    print(name, code, len(data), sha[:12])
