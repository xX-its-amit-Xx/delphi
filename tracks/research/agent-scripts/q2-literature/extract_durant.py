import re
x=open("D:/Users/ashenoy00000/delphi-work/data/q2-literature/PMC11821266.xml",encoding="utf8").read()
for m in re.finditer(r"<table-wrap.*?</table-wrap>",x,re.S):
    t=m.group(0)
    if "Table 1" in t[:300]:
        for r in re.findall(r"<tr.*?</tr>",t,re.S): print(" | ".join(re.sub(r"<[^>]+>","",c).strip() for c in re.findall(r"<t[hd].*?</t[hd]>",r,re.S)))
