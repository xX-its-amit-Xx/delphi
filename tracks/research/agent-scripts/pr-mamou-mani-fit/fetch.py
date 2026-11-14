"""Fetch the public pages used by pr-mamou-mani-fit and save raw bytes + plain text.
Usage: python -I fetch.py   (data dir: C:/Temp/delphi-sprint/pr-mamou-mani-fit/raw)
"""
import urllib.request, hashlib, re, html, os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PRMM_DATA", "C:/Temp/delphi-sprint/pr-mamou-mani-fit/raw")
os.makedirs(OUT, exist_ok=True)
URLS = json.load(open(os.path.join(HERE, "urls.json"), encoding="utf-8"))
def text_of(b, url):
    if url.lower().endswith(".pdf") or b[:4] == b"%PDF":
        # needs the poppler tool `pdftotext` on PATH (Git for Windows ships it)
        tmp = os.path.join(OUT, "_tmp.pdf"); open(tmp, "wb").write(b)
        try:
            t = subprocess.run(["pdftotext", "-layout", tmp, "-"], capture_output=True).stdout.decode("utf-8", "replace")
            return re.sub(r"\s+", " ", t)
        except Exception as e:
            return "PDF_TEXT_FAILED " + repr(e)
        finally:
            os.remove(tmp)
    s = b.decode("utf-8", "replace")
    s = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s)
rows = []
for key, url in URLS.items():
    raw = os.path.join(OUT, key + ".raw"); txt = os.path.join(OUT, key + ".txt")
    if not (os.path.exists(raw) and os.path.getsize(raw) > 500):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (research-fetch)"})
            b = urllib.request.urlopen(req, timeout=40).read()
            open(raw, "wb").write(b)
        except Exception as e:
            rows.append((key, url, "FAILED " + repr(e)[:80], 0)); continue
    b = open(raw, "rb").read()
    open(txt, "w", encoding="utf-8").write(text_of(b, url))
    rows.append((key, url, hashlib.sha256(b).hexdigest()[:16], len(b)))
with open(os.path.join(HERE, "manifest.tsv"), "w", encoding="utf-8", newline="\n") as f:
    f.write("key\turl\tsha256_16\tbytes\n")
    for r in rows: f.write("\t".join(map(str, r)) + "\n")
for r in rows: print(r[0], r[2], r[3])
