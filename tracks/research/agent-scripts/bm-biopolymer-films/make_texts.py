#!/usr/bin/env python3
"""Create plain-text copies (scratch/*.txt) of the XML full texts and abstracts used as evidence sources, plus table-row text for Formlabs."""
import re,json,html,subprocess,urllib.request
S=r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films"
for pm in ("PMC6397028","PMC13042369","PMC11478314"):
    t=open(f"{S}/{pm}.xml",encoding="utf8").read(); t=html.unescape(re.sub(r"<[^>]+>"," ",t)); open(f"{S}/{pm}.txt","w",encoding="utf8").write(re.sub(r"\s+"," ",t))
ab={}
for doi in ("10.1038/nnano.2013.290","10.1021/acs.biomac.7b00026","10.1039/c9tb01841g"):
    import urllib.parse
    u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+urllib.parse.urlencode({"query":"DOI:"+doi,"format":"json","resultType":"core","pageSize":1})
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=40))
    ab[doi]=html.unescape(re.sub(r"<[^>]+>","",d["resultList"]["result"][0].get("abstractText","")))
open(f"{S}/abstracts.txt","w",encoding="utf8").write("\n".join(f"[{k}] {v}" for k,v in ab.items()))
# crossref abstracts
cr=[json.loads(l) for l in open(f"{S}/crossref_verified.jsonl",encoding="utf8")]
open(f"{S}/crossref_abstracts.txt","w",encoding="utf8").write("\n".join(f"[{r['doi']}] {r.get('title','')} :: {re.sub(chr(32)+'+',' ',r.get('abstract',''))}" for r in cr if r.get('ok')))
# formlabs solvent rows
raw=open(f"{S}/formlabs_solvent.html",encoding="utf8").read()
tab=re.findall(r"<table.*?</table>",raw,flags=re.S)[0]
rows=[[re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",c))).strip() for c in re.findall(r"<t[hd].*?</t[hd]>",r,flags=re.S)] for r in re.findall(r"<tr.*?</tr>",tab,flags=re.S)]
hdr=rows[0]; out=[]
for r in rows[1:]:
    out.append(r[0]+" :: "+"; ".join(f"{h} {v}" for h,v in zip(hdr[1:],r[1:])))
open(f"{S}/formlabs_solvent_rows.txt","w",encoding="utf8").write("\n".join(out))
open(f"{S}/flex80a_rows.txt","w",encoding="utf8").write("Flexible 80A Resin V2 TDS ASTM D471, label Deionized Water spans these two rows (y=396 and y=405): 1 day -26 +8% +3% 94% 89% ; 1 week -27 +9% +7% 101% 88%")
print("ok")
