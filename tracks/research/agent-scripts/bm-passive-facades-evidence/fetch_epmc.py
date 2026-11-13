# usage: fetch_epmc.py <doi> ... ; saves JATS full text to data dir + logs url,date,size,sha256, writes plain text next to it
import sys, json, urllib.request, urllib.parse, hashlib, os, re, datetime
UA={"User-Agent":"delphi-research/0.1"}
D="D:/Users/ashenoy00000/delphi-work/data/passive-facades"
os.makedirs(D,exist_ok=True)
def g(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
for doi in sys.argv[1:]:
    d=json.loads(g("https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=lite&query=DOI:%s"%urllib.parse.quote('"'+doi+'"')))
    r=d["resultList"]["result"]
    if not r or not r[0].get("pmcid"): print(doi,"NO PMCID"); continue
    pm=r[0]["pmcid"]; u="https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML"%pm
    b=g(u); fn=os.path.join(D,doi.replace("/","_")+".xml"); open(fn,"wb").write(b)
    t=re.sub(r"<[^>]+>"," ",b.decode("utf8","ignore")); t=re.sub(r"\s+"," ",t)
    open(fn.replace(".xml",".txt"),"w",encoding="utf8").write(t)
    line="%s\t%s\t%s\t%d\t%s\n"%(u,datetime.date.today(),doi,len(b),hashlib.sha256(b).hexdigest())
    open(os.path.join(D,"MANIFEST.tsv"),"a").write(line); print(line.strip())
