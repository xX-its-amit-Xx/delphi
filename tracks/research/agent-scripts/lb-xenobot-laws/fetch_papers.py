"""Download open full text (Europe PMC) of the xenobot papers and print sentences with numbers.
Run:  python -I fetch_papers.py
Raw XML goes to C:/Temp/delphi-sprint/lb-xenobot-laws/ ; matched sentences to sentences.txt here.
"""
import os, re, sys, urllib.request, html

DATA = "C:/Temp/delphi-sprint/lb-xenobot-laws"
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(DATA, exist_ok=True)
PAPERS = {
    "Kriegman2020_PNAS_PMC6994979": "PMC6994979",
    "Kriegman2021_PNAS_PMC8670470": "PMC8670470",
}
KEYS = re.compile(
    r"(days|weeks|lifespan|survive|yolk|nutrient|feed|µm|μm|micron|mm/s|speed|velocity|"
    r"diameter|generation|round|cells|cilia|cell layers|smaller|shrink)", re.I)
NUM = re.compile(r"\d")

def get(pmcid):
    path = f"{DATA}/{pmcid}.xml"
    if not os.path.exists(path) or os.path.getsize(path) < 1000:
        url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
        req = urllib.request.Request(url, headers={"User-Agent": "research-script/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return open(path, encoding="utf-8", errors="replace").read()

out = []
for name, pmcid in PAPERS.items():
    try:
        xml = get(pmcid)
    except Exception as e:  # report, do not hide
        out.append(f"## {name}: DOWNLOAD FAILED: {e}")
        continue
    # body only, drop reference list
    body = re.split(r"<ref-list", xml)[0]
    text = html.unescape(re.sub(r"<[^>]+>", " ", body))
    text = re.sub(r"\s+", " ", text)
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z(])", text)
    out.append(f"## {name}: {len(xml)} bytes, {len(sents)} sentences")
    for s in sents:
        if KEYS.search(s) and NUM.search(s) and len(s) < 700:
            out.append("- " + s.strip())
with open(os.path.join(HERE, "sentences.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")
print("\n".join(out[:1]), "... written sentences.txt,", len(out), "lines")
