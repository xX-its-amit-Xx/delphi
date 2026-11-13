"""Fetch title, year, abstract from Europe PMC for each DOI. Usage: python -I epmc_abstracts.py OUT.json DOI..."""
import json, sys, urllib.request, urllib.parse, re
out = {}
for doi in sys.argv[2:]:
    u = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=" + urllib.parse.quote('DOI:"%s"' % doi)
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "delphi-research/0.1"}), timeout=40))
        r = d["resultList"]["result"]
        out[doi] = {"title": r[0].get("title"), "year": r[0].get("pubYear"), "journal": r[0].get("journalTitle"), "abstract": re.sub("<[^>]+>", "", r[0].get("abstractText", "")), "pmid": r[0].get("pmid")} if r else None
    except Exception as e:
        out[doi] = {"error": str(e)}
json.dump(out, open(sys.argv[1], "w"), indent=1)
for k, v in out.items(): print(k, "|", (v or {}).get("title"), "|", ((v or {}).get("abstract") or "")[:60].replace("\n", " "), "| len", len((v or {}).get("abstract") or ""))
