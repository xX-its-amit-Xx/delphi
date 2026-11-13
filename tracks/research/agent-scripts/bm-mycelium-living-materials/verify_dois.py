"""Resolve each DOI at Crossref; write verified_dois.json (title, authors, journal, year). Usage: python -I verify_dois.py"""
import json,urllib.request,os,sys
sys.stdout.reconfigure(encoding="utf-8")
dois="""10.1039/d3mh01277h 10.1038/s41467-026-76623-z 10.1126/sciadv.1601984 10.3390/jof11080549 10.3390/ma19204277 10.1038/s41467-025-61369-x 10.1089/3dp.2023.0342 10.1186/s40694-025-00205-9 10.1038/s41467-026-76430-6 10.1126/sciadv.aed6937 10.1016/j.isci.2021.102083 10.3389/fsysb.2026.1943876 10.1002/gch2.202300197 10.3390/biomimetics7020044 10.3390/biomimetics9090549 10.1371/journal.pone.0213954 10.1007/s11274-025-04582-6 10.1007/s10482-025-02133-5 10.1038/srep41292 10.1038/s41598-018-36032-9 10.1038/s41563-022-01429-5 10.1002/adma.202418464""".split()
import time
fp=os.path.join(os.path.dirname(os.path.abspath(__file__)),"verified_dois.json")
out=json.load(open(fp)) if os.path.exists(fp) else {}
for d in dois:
    if out.get(d,{}).get("ok"): continue
    time.sleep(2)
    try:
        m=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+d,headers={"User-Agent":"delphi-research/0.1"}),timeout=60))["message"]
        au=[a.get("family","?") for a in m.get("author",[])]
        yr=(m.get("issued",{}).get("date-parts") or [[None]])[0][0]
        out[d]=dict(title=m["title"][0],authors=au[:6],n_authors=len(au),journal=(m.get("container-title") or [""])[0],year=yr,ok=True)
        print(d,yr,au[:3],m["title"][0][:80])
    except Exception as e:
        out[d]=dict(ok=False,err=str(e)); print(d,"FAIL",e)
json.dump(out,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"verified_dois.json"),"w"),indent=1)
