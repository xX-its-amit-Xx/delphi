import sys, json, urllib.request, urllib.parse, re, os
UA={"User-Agent":"delphi-research/0.1"}
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40))
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","scratch","t6-flyingfish-alt","abstracts.json")
res={}
for doi in sys.argv[1:]:
    rec={}
    try:
        m=get("https://api.crossref.org/works/"+urllib.parse.quote(doi))["message"]
        rec["cr_title"]=(m.get("title") or [""])[0]; rec["cr_year"]=m.get("issued",{}).get("date-parts",[[None]])[0][0]
        rec["cr_journal"]=(m.get("container-title") or [""])[0]
        rec["cr_authors"]=[a.get("family") for a in m.get("author",[])][:4]
        rec["cr_abstract"]=re.sub("<[^>]+>","",m.get("abstract","") or "")
        rec["crossref_ok"]=True
    except Exception as e: rec["crossref_ok"]=str(e)
    try:
        r=get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query="+urllib.parse.quote('DOI:"%s"'%doi))["resultList"]["result"]
        if r: rec["epmc_abstract"]=re.sub("<[^>]+>","",r[0].get("abstractText","") or ""); rec["epmc_ok"]=True
        else: rec["epmc_ok"]=False
    except Exception as e: rec["epmc_ok"]=str(e)
    res[doi]=rec
    print("==",doi,rec.get("cr_title"),rec.get("cr_year"),rec.get("cr_authors"))
    print((rec.get("epmc_abstract") or rec.get("cr_abstract") or "NO ABSTRACT")[:1800]);print()
json.dump(res,open(out,"w"),indent=1)
