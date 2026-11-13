"""Europe PMC search. Usage: python -I epmc_search.py "<query>" [n]
Prints: pmcid | doi | oa | year | title. UA is generic."""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, urllib.request, urllib.parse
q = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 15
url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode(
    {"query": q, "format": "json", "pageSize": n, "resultType": "lite"})
req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
d = json.load(urllib.request.urlopen(req, timeout=60))
print("hitCount", d["hitCount"])
for r in d["resultList"]["result"]:
    print(r.get("pmcid", "-"), "|", r.get("doi", "-"), "|", r.get("isOpenAccess"), "|", r.get("pubYear"), "|", r.get("title", "")[:110])
