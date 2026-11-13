"""Fetch a URL into D:/Users/ashenoy00000/delphi-work/data/natural-benchmarks, record url/date/bytes/sha256 in MANIFEST.json,
write a plain-text sibling (.txt) for html/xml. usage: python nb_fetch.py URL filename"""
import sys, os, re, json, html, hashlib, datetime, urllib.request
D="D:/Users/ashenoy00000/delphi-work/data/natural-benchmarks"
def fetch(url, name):
    os.makedirs(D, exist_ok=True)
    req=urllib.request.Request(url, headers={"User-Agent":"delphi-research/0.1"})
    b=urllib.request.urlopen(req, timeout=90).read()
    p=os.path.join(D,name); open(p,"wb").write(b)
    mf=os.path.join(D,"MANIFEST.json")
    m=json.load(open(mf)) if os.path.exists(mf) else {}
    m[name]=dict(url=url, fetched=datetime.date.today().isoformat(), bytes=len(b), sha256=hashlib.sha256(b).hexdigest())
    if name.endswith((".xml",".html",".htm")):
        t=b.decode("utf8","ignore")
        t=re.sub(r'<(script|style)[^>]*>.*?</\1>',' ',t,flags=re.S)
        t=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',t)))
        open(p+".txt","w",encoding="utf8").write(t)
    json.dump(m, open(mf,"w"), indent=1)
    return len(b)
if __name__=="__main__":
    print(fetch(sys.argv[1], sys.argv[2]), "bytes ->", sys.argv[2])
