import sys,re
sys.stdout.reconfigure(encoding="utf-8")
# usage: grep_ft.py file.xml regex [maxhits]  -> sentences from full text matching regex
t=open(sys.argv[1],encoding="utf-8").read()
t=re.sub(r"<xref[^>]*>.*?</xref>","",t); t=re.sub(r"<[^>]+>"," ",t); t=re.sub(r"\s+"," ",t)
n=0
for s in re.split(r"(?<=[.!?]) (?=[A-Z])",t):
    if re.search(sys.argv[2],s,re.I):
        print("-",s[:600]); n+=1
        if n>=int(sys.argv[3] if len(sys.argv)>3 else 12): break
