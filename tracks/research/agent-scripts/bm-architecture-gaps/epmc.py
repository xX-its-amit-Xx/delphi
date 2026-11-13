"""Europe PMC helper. Usage:
  python -I epmc.py search "<query>" [n]      -> id, doi, year, title, journal (open access flag)
  python -I epmc.py abstract <PMCID|DOI>      -> abstract
  python -I epmc.py grep <PMCID> <regex> [ctx]-> verbatim sentences from full text XML (text only)
  python -I epmc.py doi <doi>                 -> Crossref check (title, year)
"""
import sys, json, re, urllib.request, urllib.parse, html
sys.stdout.reconfigure(encoding="utf-8")
UA={"User-Agent":"delphi-research/0.1"}
def get(u):
    r=urllib.request.Request(u,headers=UA)
    return urllib.request.urlopen(r,timeout=60).read().decode('utf-8','replace')
def search(q,n=10):
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":q,"format":"json","pageSize":n,"resultType":"lite"})
    for r in json.loads(get(u))["resultList"]["result"]:
        print(r.get("pmcid") or r.get("id"),"|",r.get("doi"),"|",r.get("pubYear"),"|",r.get("title","")[:110],"|",r.get("journalTitle"),"| OA" if r.get("isOpenAccess")=="Y" else "")
def abstract(x):
    q=("DOI:"+x) if x.startswith("10.") else ("PMCID:"+x)
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":q,"format":"json","resultType":"core"})
    for r in json.loads(get(u))["resultList"]["result"]:
        print(r.get("title"),r.get("pubYear"),r.get("doi"));print(re.sub('<[^>]+>','',r.get("abstractText","")))
def fulltext(p):
    x=get(f"https://www.ebi.ac.uk/europepmc/webservices/rest/{p}/fullTextXML")
    x=re.sub(r'<xref[^>]*>.*?</xref>','',x)
    x=re.sub(r'<[^>]+>',' ',x); x=html.unescape(x); return re.sub(r'\s+',' ',x)
def grep(p,rx,ctx=200):
    t=fulltext(p)
    for m in list(re.finditer(rx,t,re.I))[:12]:
        print("...",t[max(0,m.start()-ctx):m.end()+ctx],"...\n")
if __name__=="__main__":
    c=sys.argv[1]
    if c=="search": search(sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 10)
    elif c=="abstract": abstract(sys.argv[2])
    elif c=="grep": grep(sys.argv[2],sys.argv[3],int(sys.argv[4]) if len(sys.argv)>4 else 200)
    elif c=="doi":
        j=json.loads(get("https://api.crossref.org/works/"+sys.argv[2]))["message"]
        print(j["title"][0],"|",j.get("issued",{}).get("date-parts"),"|",j.get("container-title"))
