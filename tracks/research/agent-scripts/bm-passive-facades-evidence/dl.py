# usage: dl.py <url> <outname> ; fetches, saves raw + text (pdf via pdftotext if available / pypdf), logs manifest
import sys, urllib.request, hashlib, os, re, datetime, subprocess
D="D:/Users/ashenoy00000/delphi-work/data/passive-facades"
u,name=sys.argv[1],sys.argv[2]
req=urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1","Accept":"*/*"})
b=urllib.request.urlopen(req,timeout=90).read()
fn=os.path.join(D,name); open(fn,"wb").write(b)
txt=None
if b[:4]==b"%PDF":
    try:
        import pypdf, io
        r=pypdf.PdfReader(io.BytesIO(b)); txt=" ".join((p.extract_text() or "") for p in r.pages)
    except Exception as e: print("pdf err",e)
else:
    txt=re.sub(r"<(script|style)[^>]*>.*?</\1>"," ",b.decode("utf8","ignore"),flags=re.S); txt=re.sub(r"<[^>]+>"," ",txt)
if txt:
    import html; txt=html.unescape(re.sub(r"\s+"," ",txt)); open(os.path.splitext(fn)[0]+".txt","w",encoding="utf8").write(txt)
line="%s\t%s\t%s\t%d\t%s\n"%(u,datetime.date.today(),name,len(b),hashlib.sha256(b).hexdigest())
open(os.path.join(D,"MANIFEST.tsv"),"a").write(line); print(line.strip(), len(txt or ""))
