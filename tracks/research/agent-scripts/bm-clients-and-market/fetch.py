"""Fetch URLs raw, save under data/bm-clients-market, append manifest.tsv (url, date, status, bytes, sha256, file).
Usage: python -I fetch.py URL [URL ...]   Generic UA, no credentials. Max 5 MB per page."""
import sys, hashlib, re, os, datetime, urllib.request, urllib.error
D = r"D:/Users/ashenoy00000/delphi-work/data/bm-clients-market"
os.makedirs(D, exist_ok=True)
def slug(u):
    return re.sub(r'[^A-Za-z0-9]+', '_', re.sub(r'^https?://', '', u))[:120]
for u in sys.argv[1:]:
    st = 0; body = b''
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "delphi-research/0.1", "Accept": "text/html,*/*"})
        with urllib.request.urlopen(req, timeout=40) as r:
            st = r.status; body = r.read(5_000_000)
    except urllib.error.HTTPError as e:
        st = e.code
    except Exception as e:
        st = -1; print("ERR", u, e)
    fn = slug(u) + ".html"
    if body:
        open(os.path.join(D, fn), "wb").write(body)
    h = hashlib.sha256(body).hexdigest() if body else ""
    with open(os.path.join(D, "manifest.tsv"), "a", encoding="utf-8") as m:
        m.write(f"{u}\t{datetime.date.today()}\t{st}\t{len(body)}\t{h}\t{fn if body else ''}\n")
    print(st, len(body), u)
