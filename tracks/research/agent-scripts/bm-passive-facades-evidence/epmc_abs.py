# usage: epmc_abs.py "<query>" [n]  -> prints doi, title, abstract (core record)
import sys, json, urllib.request, urllib.parse, re, html
q=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 5
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=%d&resultType=core&query=%s"%(n,urllib.parse.quote(q))
d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=40))
for r in d["resultList"]["result"]:
    ab=html.unescape(re.sub(r"<[^>]+>"," ",r.get("abstractText","")))
    print("##",r.get("doi"),"|",r.get("pubYear"),"|",r.get("title"),"|",r.get("journalTitle"))
    print(ab[:1500]);print()
