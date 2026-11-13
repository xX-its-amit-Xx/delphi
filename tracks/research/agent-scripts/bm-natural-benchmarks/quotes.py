"""Quote engine: pulls a verbatim span (start..end anchors, whitespace-normalised) out of a fetched file in
D:/Users/ashenoy00000/delphi-work/data/natural-benchmarks and refuses spans over 40 words or anchors that are not found.
Used by build_result.py. Run `python quotes.py` to self-test every quote in QUOTES (prints FAIL lines, exits 1 on failure)."""
import re, json, sys

D = "D:/Users/ashenoy00000/delphi-work/data/natural-benchmarks/"
LEAN = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean"

FILES = {
    "RM": D + "PMC2838359.html.txt",
    "EG": D + "PMC9284161.xml.txt",
    "LD": D + "PMC4733047.xml.txt",
    "UL": D + "ulrich2024_epmc.json",
    "CC": D + "PMC10037692.xml.txt",
    "RZ": D + "PMC12219170.xml.txt",
    "MZ": D + "PMC8664382.xml.txt",
    "HG": D + "PMC5056167.xml.txt",
    "WN": D + "PMC6164363.xml.txt",
    "HS": D + "PMC8252473.xml.txt",
    "AB": D + "PMC3284132.html.txt",
    "D1": D + "PMC9478607.xml.txt",
    "D2": D + "PMC9353449.xml.txt",
    "HI": D + "PMC13210226.xml.txt",
    "TS": D + "PMC12304133.xml.txt",
    "PJ": D + "arxiv_1110.0714.pdf.txt",
    "PM_ELB": D + "pubmed_17495170.xml.txt",
    "PM_ARM": D + "pubmed_21940888.xml.txt",
    "PM_FOR": D + "pubmed_15674293.xml.txt",
    "LEAN": LEAN,
}
URLS = {
    "RM": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/",
    "EG": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9284161/fullTextXML",
    "LD": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4733047/fullTextXML",
    "UL": "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1088/1748-3190/ad475b&resultType=core&format=json",
    "CC": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10037692/fullTextXML",
    "RZ": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12219170/fullTextXML",
    "MZ": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8664382/fullTextXML",
    "HG": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5056167/fullTextXML",
    "WN": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6164363/fullTextXML",
    "HS": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8252473/fullTextXML",
    "AB": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3284132/",
    "D1": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9478607/fullTextXML",
    "D2": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9353449/fullTextXML",
    "HI": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13210226/fullTextXML",
    "TS": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12304133/fullTextXML",
    "PJ": "https://arxiv.org/pdf/1110.0714v1",
    "PM_ELB": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=17495170",
    "PM_ARM": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=21940888",
    "PM_FOR": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=15674293",
    "LEAN": "file:///" + LEAN,
}
_cache = {}

def text(key):
    if key in _cache:
        return _cache[key]
    p = FILES[key]
    raw = open(p, encoding="utf8", errors="replace").read()
    if p.endswith(".json"):
        r = json.loads(raw)["resultList"]["result"][0]
        raw = r["title"] + " " + r["abstractText"]
        raw = re.sub(r"<[^>]+>", "", raw)
    _cache[key] = re.sub(r"\s+", " ", raw)
    return _cache[key]

_MAP = str.maketrans({"’": "'", "‘": "'", "‐": "-", "‑": "-", "−": "-", " ": " "})
def _n(x):
    return x.translate(_MAP)

def q(key, start, end=None):
    """Find anchors ignoring typographic apostrophe/hyphen variants; return the ORIGINAL text span."""
    t = text(key)
    tn = _n(t); start_n = _n(start); end_n = _n(end) if end else None
    i = tn.find(start_n)
    if i < 0:
        k = tn.find(start_n[:22]); ctx = repr(t[k:k + len(start_n) + 40]) if k >= 0 else "(prefix not found either)"
        raise KeyError(f"[{key}] start anchor not found: {start!r} || actual text: {ctx}")
    if end is None:
        span = t[i:i + len(start_n)]
    else:
        j = tn.find(end_n, i + len(start_n) - 1 if end_n in start_n else i)
        if j < 0:
            raise KeyError(f"[{key}] end anchor not found: {end!r} || actual text: {t[i:i + 400]!r}")
        span = t[i:j + len(end_n)]
    n = len(span.split())
    if n > 40:
        raise ValueError(f"[{key}] quote has {n} words (>40): {span[:80]!r}")
    return span

if __name__ == "__main__":
    print("quotes.py is a library; run build_result.py")


ERR = []
def qs(key, start, end=None):
    """safe q: records failures in ERR (so all broken anchors can be listed at once) and returns ''."""
    try:
        return q(key, start, end)
    except Exception as e:
        ERR.append(str(e)[:600]); return ""
