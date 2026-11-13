"""Verify DOIs against Crossref; print title, year, container, first author, abstract snippet. Usage: python crossref_doi.py doi [doi ...]"""
import sys, json, time, urllib.request, re, html
for doi in sys.argv[1:]:
    for attempt in range(4):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/" + doi, headers={"User-Agent": "delphi-research/0.1"}), timeout=60))["message"]
            ab = re.sub(r"<[^>]+>", " ", html.unescape(d.get("abstract", "")))
            print(doi, "|", d.get("issued", {}).get("date-parts", [[None]])[0][0], "|", (d.get("title") or [""])[0], "|", (d.get("container-title") or [""])[0], "|", ", ".join(a.get("family", "") for a in d.get("author", [])[:3]))
            if ab.strip(): print("   ABSTRACT:", re.sub(r"\s+", " ", ab)[:1800])
            break
        except Exception as e:
            print(doi, "retry", e); time.sleep(5 * (attempt + 1))
    time.sleep(2)
