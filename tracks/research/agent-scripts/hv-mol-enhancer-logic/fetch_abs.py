import json,urllib.request,urllib.parse,sys
dois=["10.1038/s41588-019-0538-0","10.1038/s41586-022-04570-y","10.1038/s41586-022-04877-w","10.1038/s41586-021-03446-x","10.1016/j.cell.2018.11.029","10.1038/s41588-022-01223-8","10.1016/j.molcel.2022.04.009","10.1038/s41594-022-00787-7","10.7554/eLife.64320","10.1101/2023.11.09.563812","10.1016/j.gde.2005.02.007"]
out={}
for d in dois:
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="+urllib.parse.quote('DOI:"%s"'%d)+"&resultType=core&format=json"
    try:
        r=json.load(urllib.request.urlopen(u,timeout=25))
        res=r["resultList"]["result"]
        if not res: out[d]=None; print("NONE",d); continue
        x=res[0]
        out[d]={k:x.get(k) for k in["title","authorString","journalTitle","pubYear","pmid","pmcid","abstractText","doi"]}
        print("==",d,x.get("pubYear"),x.get("title"),"|",(x.get("authorString") or "")[:60]);print(x.get("abstractText"))
    except Exception as e: print("ERR",d,e)
json.dump(out,open("abstracts.json","w"),indent=1)
