import urllib.request,json,re
H={"User-Agent":"delphi-research/0.1"}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60).read().decode('utf8','replace')
dois=["10.1038/s41586-022-04877-w","10.1016/j.molcel.2022.04.009","10.1038/s41586-019-1210-7","10.1038/nature13994",
"10.1038/nbt.3739","10.7554/elife.91994","10.1038/s41586-022-04570-y","10.1038/s41580-024-00710-6","10.15252/embj.2023113519",
"10.1101/2024.12.08.627402","10.1101/2025.04.21.649048","10.64898/2026.10.23.761042","10.15252/msb.20209816","10.1038/s41586-024-08430-9"]
for d in dois:
    try:
        j=json.loads(get("https://api.crossref.org/works/"+d))['message']
        print("OK ",d,"|",j['title'][0][:80],"|",j.get('issued',{}).get('date-parts'))
    except Exception as e:
        try:
            j=json.loads(get("https://api.datacite.org/dois/"+d))['data']['attributes']
            print("OKdc",d,"|",j['titles'][0]['title'][:80])
        except Exception as e2: print("FAIL",d,e,e2)
for g in ["GSE184426","GSE186265","GSE240586","GSE116197","GSE126221","GSE40739","GSE57876"]:
    t=get(f"https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={g}&targ=self&form=text&view=brief")
    m=re.search(r'!Series_title = (.*)',t); print(g,m.group(1)[:110] if m else "NOTFOUND")
print("Zabidi 8144/11364 =",8144/11364)
print("Martinez-Ara 139/233 =",139/233)
print("Bergman 1-0.82 =",1-0.82)
