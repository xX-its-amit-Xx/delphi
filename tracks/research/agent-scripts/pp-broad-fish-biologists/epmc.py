import sys,json,urllib.request,urllib.parse
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else "10"
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":q,"format":"json","pageSize":n,"sort":"P_PDATE_D desc","resultType":"core"})
r=json.load(urllib.request.Request and urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"})))
for x in r["resultList"]["result"]:
    print(x.get("doi"),"|",x.get("pubYear"),"|",x.get("journalTitle"),"|",x.get("title","")[:90],"|",(x.get("authorString") or "")[-50:])
