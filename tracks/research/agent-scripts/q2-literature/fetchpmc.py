import sys,urllib.request,hashlib,os,datetime,re,html
D="D:/Users/ashenoy00000/delphi-work/data/q2-literature"; os.makedirs(D,exist_ok=True)
for pmc in sys.argv[1:]:
    u=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmc}/fullTextXML"
    b=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60).read()
    p=f"{D}/{pmc}.xml"; open(p,"wb").write(b)
    t=html.unescape(re.sub(r"\s+"," ",re.sub("<[^>]+>"," ",b.decode())))
    open(f"{D}/{pmc}.txt","w",encoding="utf8").write(t)
    print(u,datetime.date.today(),len(b),hashlib.sha256(b).hexdigest())
