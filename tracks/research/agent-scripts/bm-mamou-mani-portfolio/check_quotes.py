"""Check that every evidence quote in findings_a.py / findings_b.py appears verbatim (after normalising case,
punctuation and whitespace) in the saved page text under data/mamou-mani/. Run: python -I check_quotes.py"""
import re, sys, os
sys.stdout.reconfigure(encoding="utf8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from findings_a import A
from findings_b import B
D = r"D:\Users\ashenoy00000\delphi-work\data\mamou-mani"
def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
bad = 0
for (i, claim, val, key, quote, conf) in A + B:
    t = norm(open(os.path.join(D, key + ".txt"), encoding="utf8").read())
    ok = norm(quote) in t
    words = len(quote.split())
    if not ok or words > 40:
        bad += 1
        print("FAIL", i, key, "words=%d" % words, "|", quote[:90])
print("checked", len(A + B), "failures", bad)
