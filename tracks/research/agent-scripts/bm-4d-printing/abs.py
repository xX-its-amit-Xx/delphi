"""Print EPMC title+abstract for DOIs (verifies the DOI resolves in EPMC). Usage: python -I abs.py doi1 doi2 ..."""
import sys, json, urllib.request, urllib.parse, re, html
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
for doi in sys.argv[1:]:
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode({"query": f'DOI:"{doi}"', "format": "json", "resultType": "core"})
    d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"}), timeout=60))
    for r in d["resultList"]["result"][:1]:
        a = html.unescape(re.sub(r"<[^>]+>", "", r.get("abstractText", "")))
        print("##", doi, "|", r.get("pmcid"), "|", r.get("pubYear"), "|", r.get("journalTitle"), "|", r.get("title")); print(a, "\n")
    if not d["resultList"]["result"]: print("##", doi, "NOT FOUND in EPMC\n")
