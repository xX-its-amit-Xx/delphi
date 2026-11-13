"""Resolve DOIs via Crossref (DataCite fallback) and arXiv ids via the arXiv export API; print title/year/container.
usage: python verify_dois.py doi1 doi2 ... [arxiv:2406.08326]. Sleeps between calls (Crossref 429s otherwise)."""
import sys, json, time, urllib.request, urllib.parse, re
H={"User-Agent":"delphi-research/0.1"}
for a in sys.argv[1:]:
    time.sleep(1.5)
    try:
        if a.startswith("arxiv:"):
            x=urllib.request.urlopen(urllib.request.Request("http://export.arxiv.org/api/query?id_list="+a[6:],headers=H),timeout=40).read().decode()
            print(a,"| ARXIV |",re.findall(r"<title>(.*?)</title>",x,flags=re.S)[-1].strip()[:110],"|",re.findall(r"<published>(.*?)</published>",x)[:1])
        else:
            m=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/"+urllib.parse.quote(a,safe="/()"),headers=H),timeout=40))["message"]
            print(a,"| CROSSREF OK |",m["issued"]["date-parts"][0][0],"|",m.get("container-title",[""])[0][:40],"|",m["title"][0][:100])
    except Exception as e: print(a,"| FAIL",e)
