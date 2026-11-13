"""Europe PMC search. Usage: python epmc_search.py "query" [n]. Prints id, doi, year, title, journal."""
import sys, json, urllib.request, urllib.parse
q = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
u = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode({"query": q, "format": "json", "pageSize": n, "resultType": "lite"})
d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "delphi-research/0.1"}), timeout=60))
for r in d["resultList"]["result"]:
    print(r.get("source"), r.get("id"), "|", r.get("doi"), "|", r.get("pubYear"), "|", (r.get("title") or "")[:120], "|", r.get("journalTitle"), "| OA:", r.get("isOpenAccess"))
