import re,sys
sys.stdout.reconfigure(encoding="utf8",errors="replace")
# usage: xml_text.py file.xml [regex] -> abstract, then (if regex) every sentence matching regex (verbatim, tags stripped)
x=open(sys.argv[1],encoding='utf8').read()
t=re.sub(r"<xref[^>]*>.*?</xref>","",x); t=re.sub(r"<[^>]+>"," ",t); t=re.sub(r"\s+"," ",t)
t=re.sub(r"\s+([,.;)])",r"\1",t); t=re.sub(r"\(\s+","(",t)
m=re.search(r"<abstract.*?</abstract>",x,re.S)
if m:
    a=re.sub(r"<[^>]+>"," ",m.group(0)); print("ABSTRACT:",re.sub(r"\s+"," ",a)[:2500])
if len(sys.argv)>2:
    for s in re.split(r"(?<=[.?!])\s+(?=[A-Z])",t):
        if re.search(sys.argv[2],s,re.I): print(" *",s[:400])
