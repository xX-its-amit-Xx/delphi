"""Derive the plain-text copies used by check_quotes.py from the raw downloads. Run: python -I make_texts.py"""
import re, html, os
ROOT = "D:/Users/ashenoy00000/delphi-work/data/bm-bps"
def strip(t, drop_scripts=False):
    if drop_scripts:
        t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t))).strip()
jobs = [("papers/PMC11604995.xml", "papers/cheng.txt", False),
        ("papers/PMC4383548.xml", "papers/PMC4383548.txt", False),
        ("papers/PMC9227374.xml", "papers/PMC9227374.txt", False),
        ("eurlex364.html", "eurlex364.txt", True),
        ("cpr305.html", "cpr305.txt", True)]
for src, dst, d in jobs:
    t = open(os.path.join(ROOT, src), encoding="utf8", errors="ignore").read()
    open(os.path.join(ROOT, dst), "w", encoding="utf8").write(strip(t, d))
    print("wrote", dst)
