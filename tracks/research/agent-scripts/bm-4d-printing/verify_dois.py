"""Resolve DOIs against Europe PMC core records; writes scratch/doi_verify.json (title, authors, year, journal). Run: python -I verify_dois.py"""
import json, urllib.request, urllib.parse, time, sys, datetime
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DOIS = ["10.1038/srep31110","10.1126/sciadv.1602890","10.1038/srep13616","10.1038/srep24224","10.1038/s41467-026-68370-y","10.3390/gels12050382","10.1039/d6mh00947f","10.1002/smll.202306387","10.1038/s41467-024-54808-8","10.1371/journal.pone.0120718","10.1126/sciadv.aax1311","10.3390/biomimetics6040058","10.1089/3dp.2022.0061","10.1038/srep07422","10.3390/ma19183869","10.1002/marc.70307","10.3390/biomimetics10100711"]
out = {}
for d in DOIS:
    u = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode({"query": f'DOI:"{d}"', "format": "json", "resultType": "core"})
    r = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "delphi-research/0.1"}), timeout=60))["resultList"]["result"]
    if r:
        r = r[0]; out[d] = {"title": r.get("title"), "authors": r.get("authorString"), "year": r.get("pubYear"), "journal": (r.get("journalInfo") or {}).get("journal", {}).get("title") or r.get("journalTitle"), "pmcid": r.get("pmcid")}
    else: out[d] = None
    print(d, "OK" if out[d] else "NOT FOUND", (out[d] or {}).get("year"), ((out[d] or {}).get("authors") or "")[:40], "|", ((out[d] or {}).get("title") or "")[:70])
    time.sleep(0.5)
out["_date"] = datetime.date.today().isoformat()
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-4d-printing/doi_verify.json", "w", encoding="utf-8"), indent=1)
