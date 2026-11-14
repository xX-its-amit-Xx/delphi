"""Fetch open-access full text from Europe PMC and print the sentences that carry numbers
for genipin-crosslinked chitosan (modulus, swelling). Re-runnable from a clean folder:

    python -I fetch_evidence.py

Downloads go to C:/Temp/delphi-sprint/lb-crosslinker-laws/epmc (never into the deliverable folder).
Output: evidence_snippets.txt in the same download folder (kept out of the deliverable folder).
"""
import io
import os
import re
import sys
import urllib.request

DATA = "C:/Temp/delphi-sprint/lb-crosslinker-laws/epmc"
HERE = os.path.dirname(os.path.abspath(__file__))
IDS = sys.argv[1:] or ["PMC7285115", "PMC4699241"]
PAT = re.compile(r"(MPa|kPa|swelling (ratio|degree|index)|cross-?link(ing)? density|Flory|"
                 r"Young|tensile|storage modulus|compressive modulus)", re.I)

os.makedirs(DATA, exist_ok=True)
out = io.open(os.path.join(DATA, "evidence_snippets.txt"), "w", encoding="utf-8")
for pid in IDS:
    path = os.path.join(DATA, pid + ".xml")
    if not os.path.exists(path):
        url = "https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML" % pid
        with urllib.request.urlopen(url, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    raw = io.open(path, encoding="utf-8").read()
    body = raw.split("<ref-list")[0]
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body))
    out.write("===== %s (%d chars of body text)\n" % (pid, len(text)))
    last = -1000
    for m in PAT.finditer(text):
        if m.start() - last < 250:
            continue
        last = m.start()
        out.write("@%d ... %s ...\n\n" % (m.start(), text[max(0, m.start() - 220): m.end() + 260]))
out.close()
print("wrote evidence_snippets.txt")
