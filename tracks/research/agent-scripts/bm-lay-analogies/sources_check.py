"""Load fetched sources as normalised text and verify that every evidence_quote appears verbatim. Imported by build_result.py."""
import re, html, json, os
D = "D:/Users/ashenoy00000/delphi-work/data/bm-lay/"
SC = "D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-lay-analogies/"
def norm(s):
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"\s+", " ", s).strip()
def strip_html(h):
    h = re.sub(r"(?s)<(script|style)[^>]*>.*?</\1>", " ", h)
    return norm(html.unescape(re.sub(r"<[^>]+>", " ", h)))
def load():
    S = {}
    r = strip_html(open(D + "reyssat_pmc.html", encoding="utf8", errors="ignore").read())
    S["reyssat"] = r
    # the PDF text carries manuscript line numbers (e.g. "366 Plotting"); drop 3-digit tokens between words
    S["holstov"] = re.sub(r" \d{3} (?=[A-Za-z(])", " ", norm(open(D + "holstov2015.txt", encoding="utf8").read()))
    S["formlabs"] = strip_html(open(D + "formlabs_solvent.html", encoding="utf8", errors="ignore").read())
    wb = json.load(open(D + "wiki_bimetal_full.json"))["query"]["pages"]
    S["wikibimetal_text"] = norm(" ".join(v["extract"] for v in wb.values()))
    hh = open(D + "wiki_bimetallic.html", encoding="utf8").read()
    S["wikiformula"] = norm(" ".join(json.loads(html.unescape(m))["body"]["extsrc"] for m in re.findall(r"data-mw='(\{\"name\":\"math\".*?\})'", hh)))
    S["wikitherm"] = strip_html(open(D + "wiki_thermal_diffusivity.html", encoding="utf8").read())
    wd = json.load(open(D + "wiki_drop_unit.json"))["query"]["pages"]
    S["wikidrop"] = norm(" ".join(v["extract"] for v in wd.values()))
    S["lean"] = strip_html(open(D + "lean_tpil_intro.html", encoding="utf8").read())
    import pypdf
    S["f80v2"] = norm(" ".join(p.extract_text() for p in pypdf.PdfReader(D + "f80v2_tds.pdf").pages))
    S["clearv5"] = norm(" ".join(p.extract_text() for p in pypdf.PdfReader(D + "clear_v5_tds.pdf").pages))
    S["pmc12986659"] = strip_html(open(D + "pmc12986659.html", encoding="utf8", errors="ignore").read())
    S["leanfile"] = norm(open("D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean", encoding="utf8").read())
    S["leancheckout"] = norm(open(SC + "lean_check_out.txt", encoding="utf8").read())
    return S
