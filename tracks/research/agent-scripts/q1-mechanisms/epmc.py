import sys; sys.stdout.reconfigure(encoding="utf-8")
import sys,json,urllib.request,urllib.parse
# usage: epmc.py "query" [n]  -> prints id, doi, year, title (Europe PMC)
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else "5"
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":q,"format":"json","pageSize":n,"resultType":"lite"})
r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"})))
for x in r["resultList"]["result"]:
    print(x.get("source"),x.get("id"),x.get("doi"),x.get("pubYear"),x.get("title")[:110],"|",x.get("journalTitle"))
