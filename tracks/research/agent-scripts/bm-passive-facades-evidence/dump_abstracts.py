# Saves the Crossref/Europe PMC abstracts that findings quote into data/passive-facades/abstracts.txt (+manifest line)
import json,urllib.request,urllib.parse,re,html,hashlib,datetime,time
D="D:/Users/ashenoy00000/delphi-work/data/passive-facades/"
UA={"User-Agent":"delphi-research/0.1"}
out=[]
for doi in ["10.3390/en13246669","10.1007/s00226-023-01464-8"]:
    time.sleep(1.5)
    m=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+doi,headers=UA)))["message"]
    out.append("[%s via api.crossref.org/works/%s] %s"%(doi,doi,html.unescape(re.sub(r"<[^>]+>"," ",m.get("abstract","")))))
for doi in ["10.1007/s11356-021-16684-3","10.3390/ma16155211","10.1038/s41467-025-65071-w","10.3390/biomimetics10100711"]:
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query="+urllib.parse.quote('DOI:"%s"'%doi)
    r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA)))["resultList"]["result"][0]
    out.append("[%s via Europe PMC search DOI]%s"%(doi,html.unescape(re.sub(r"<[^>]+>"," ",r.get("abstractText","")))))
t=re.sub(r"\s+"," "," \n".join(out)); b=t.encode()
open(D+"abstracts.txt","w",encoding="utf8").write(t)
open(D+"MANIFEST.tsv","a").write("api.crossref.org + ebi.ac.uk europepmc (abstract text)\t%s\tabstracts.txt\t%d\t%s\n"%(datetime.date.today(),len(b),hashlib.sha256(b).hexdigest()))
print(len(t))
