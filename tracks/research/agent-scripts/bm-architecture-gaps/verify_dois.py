"""Verify every DOI cited in bm-architecture-gaps against Crossref (retry on 429). Writes scratch/verify_dois.json. Run: python -I verify_dois.py"""
import json,urllib.request,time,sys
sys.stdout.reconfigure(encoding="utf-8")
DOIS="""10.3390/polym18131652
10.1038/s41467-026-71025-7
10.3390/ma13122849
10.3390/polym18060721
10.3390/polym17131862
10.1038/s44296-026-00099-7
10.3390/biomimetics11040225
10.1038/s41598-026-42461-8
10.1186/s40643-025-00908-2
10.1038/s41467-024-54808-8
10.3390/polym13203553
10.3389/fmicb.2026.1928040
10.3390/biomimetics9090549
10.4028/p-hok3ij
10.1038/s41598-025-98326-z
10.15376/biores.14.4.7790-7804
10.1038/s41598-018-26985-2
10.3390/jof11080549
10.1126/sciadv.aax1311
10.3390/polym12122962
10.3992/jgb.16.2.173""".split()
res={}
for d in DOIS:
    for i in range(6):
        try:
            m=json.loads(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+d,headers={"User-Agent":"delphi-research/0.1"}),timeout=60).read())["message"]
            res[d]={"title":m["title"][0],"year":(m.get("issued",{}).get("date-parts") or [[None]])[0][0],"venue":(m.get("container-title") or [""])[0],"authors":", ".join((a.get("family","") for a in m.get("author",[])[:3]))}
            break
        except Exception as e:
            res[d]={"error":str(e)}; time.sleep(4*(i+1))
    print(d,res[d]); time.sleep(1.2)
json.dump(res,open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-architecture-gaps/verify_dois.json","w",encoding="utf-8"),indent=1,ensure_ascii=False)
