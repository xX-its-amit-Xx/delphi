"""Re-fetch and check every source this label's numbers rest on.

Usage: python -B verify_sources.py [--refetch]
  * with --refetch it downloads the Formlabs files again into data/bm-poc-designs (about 5 MB), otherwise it uses the saved copies;
  * extracts text (PyMuPDF for PDFs, tag-stripping for HTML) and confirms each evidence quote below appears verbatim
    (whitespace-normalised);
  * asks Crossref (generic User-Agent, no account, no personal data) to resolve each DOI used as a citation.
Prints sha256 + size for every kept file and writes sources_check.json into the scratch folder.
"""
import hashlib
import html
import json
import os
import re
import sys
import urllib.request

import pymupdf

DATA = r"D:/Users/ashenoy00000/delphi-work/data/bm-poc-designs"
OUT = r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-poc-designs/sources_check.json"
UA = {"User-Agent": "delphi-research/0.1"}

FILES = {
    "flex80av2_tds.pdf": "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf",
    "silicone40a_tds.pdf": "https://media.formlabs.com/m/2e6bb2b3d645b427/original/-ENUS-Silicone-40A-TDS.pdf",
    "flex50a_tds.pdf": "https://media.formlabs.com/asset/6c4f970f-53d8-4fb7-8d36-a153d93d26bb/-ENUS-Flexible-50A-V1-TDS.pdf",
    "solvent.html": "https://formlabs.com/support/solvent-compatibility/",
    "sls.html": "https://formlabs.com/3d-printers/sls/",
    "resin_specs.html": "https://formlabs.com/3d-printers/resin/tech-specs/",
    "silicone-40a-resin.html": "https://formlabs.com/products/silicone-40a-resin/",
    "flexible-50a-resin.html": "https://formlabs.com/products/flexible-50a-resin/",
}

# (id, file, verbatim quote after whitespace normalisation)
QUOTES = [
    ("Q1", "flex80av2_tds.pdf", "Deionized Water 1 day -26 +8% +3% 94% 89% 1 week -27 +9% +7% 101% 88%"),
    ("Q2", "flex80av2_tds.pdf", "IPA 1 day -32 +45% +113% 95% 90% 1 week -33 +48% +119% 92% 68%"),
    ("Q3", "flex80av2_tds.pdf", "Rectangular slabs, used for hardness, mass, and volume change, are evaluated immediately after wiping dry without a conditioning period."),
    ("Q4", "flex80av2_tds.pdf", "Stress at 50% Elongation 1.5 MPa 2.9 MPa"),
    ("Q5", "flex80av2_tds.pdf", "Shore A Hardness 68 83"),
    ("Q6", "flex80av2_tds.pdf", "Solid Density 1.09 g/cm3"),
    ("Q7", "silicone40a_tds.pdf", "Stress at 50% elongation 0.4 MPa"),
    ("Q8", "silicone40a_tds.pdf", "Stress at 100% elongation 1 MPa"),
    ("Q9", "flex50a_tds.pdf", "Stress at 50% Elongation 0.5 MPa 0.9 MPa"),
    ("Q10", "flex50a_tds.pdf", "Stress at 100% Elongation 0.9 MPa 1.7 MPa"),
    ("Q11", "flex50a_tds.pdf", "Isopropyl Alcohol 39.2"),
    ("Q12", "solvent.html", "Silicone 40A Resin <0.1 11.5 <0.1 92.3 32.9 2.5 10 <0.1 69.8 5.9 1.6 2 <0.1 23.2 <0.1 0.4 Not tested <0.1 Not tested"),
    ("Q13", "solvent.html", "Rigid 10K Resin <0.1 <0.1 0.1 0.1 0.1 0.4 0.2 <0.1 0 <0.1 <0.1 0.2 0.1 0.6 0.1 0.2 0.4 <0.1 <0.1"),
    ("Q14", "sls.html", "165 x 165 x 300 mm"),
    ("Q15", "resin_specs.html", "20.0 × 12.5 × 21.0 cm"),
    ("Q16", "flex80av2_tds.pdf", "Data for post-cured samples were printed on a Form 4 printer with 100 μm Flexible 80A Resin V2 settings"),
    ("Q17", "silicone40a_tds.pdf", "Shore Hardness 40A"),
    ("Q18", "silicone40a_tds.pdf", "washed in a Form Wash for 20 minutes in 80% Isopropyl Alcohol / 20% Butyl Acetate"),
    ("Q19", "silicone-40a-resin.html", "Compatible Printer Form 4, Form 4B, Form 3, Form 3B, Form Studio 1 Print Technology SLA Biocompatibility Skin Contact Minimum Layer Thickness 100 micron"),
    ("Q20", "flexible-50a-resin.html", "Minimum Layer Thickness 100 micron"),
]

DOIS = {
    "10.1364/JOSA.11.000233": "Timoshenko 1925 bi-metal thermostats",
    "10.1016/j.conbuildmat.2015.08.136": "Holstov 2015 hygromorphic materials",
    "10.1098/rsif.2009.0184": "Reyssat and Mahadevan 2009 hygromorphs",
    "10.3390/polym15122600": "Aniskevich 2023 filament moisture sorption",
    "10.1126/science.1203874": "Armon 2011 chiral seed pods",
    "10.1039/C6SM00246C": "Pezzulla 2016 thin growing bilayers",
    "10.1038/s41467-024-54808-8": "Cheng 2024 weather-responsive hygromorphic shading",
    "10.1016/j.dental.2011.06.007": "Sideridou 2011 dimethacrylate sorption",
    "10.3390/ma17235953": "Pino 2024 water absorption of AM underwater products",
    "10.1089/3dp.2015.0022": "Correa 2015 3D-printed wood",
}


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def text_of(path):
    if path.endswith(".pdf"):
        d = pymupdf.open(path)
        return norm(" ".join(p.get_text() for p in d))
    t = open(path, encoding="utf-8", errors="ignore").read()
    t = t.replace('\\"', '"').replace("\\u003c", "<").replace("\\u003e", ">").replace("\\\\u00d7", "×").replace("\\u00d7", "×")
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return norm(t)


def fetch(url, path):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        open(path, "wb").write(r.read())


def main():
    res = {"files": {}, "quotes": [], "dois": {}}
    for name, url in FILES.items():
        p = os.path.join(DATA, name)
        if "--refetch" in sys.argv or not os.path.exists(p):
            fetch(url, p)
        b = open(p, "rb").read()
        res["files"][name] = dict(url=url, bytes=len(b), sha256=hashlib.sha256(b).hexdigest())
        print(f"{name:22s} {len(b):9d} B  sha256 {hashlib.sha256(b).hexdigest()}")
    texts = {n: text_of(os.path.join(DATA, n)) for n in FILES}
    for qid, f, q in QUOTES:
        ok = norm(q) in texts[f]
        res["quotes"].append(dict(id=qid, file=f, ok=ok, quote=q))
        print(("OK   " if ok else "MISS ") + qid, f, "|", q[:90])
    for doi, label in DOIS.items():
        try:
            req = urllib.request.Request("https://api.crossref.org/works/" + doi, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                m = json.load(r)["message"]
            title = (m.get("title") or [""])[0]
            yr = (m.get("issued", {}).get("date-parts") or [[None]])[0][0]
            res["dois"][doi] = dict(ok=True, title=title, year=yr, container=(m.get("container-title") or [""])[0])
            print("DOI ok ", doi, yr, title[:80])
        except Exception as e:  # noqa: BLE001
            res["dois"][doi] = dict(ok=False, error=str(e))
            print("DOI FAIL", doi, e)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(res, open(OUT, "w", encoding="utf-8"), indent=1)
    bad = [q for q in res["quotes"] if not q["ok"]]
    print("\nquotes missing:", [q["id"] for q in bad], " DOIs failed:", [d for d, v in res["dois"].items() if not v["ok"]])


if __name__ == "__main__":
    main()
