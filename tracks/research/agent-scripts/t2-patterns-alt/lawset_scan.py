import json,re
R="D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/"
ls=json.load(open(R+"lawsets/lawset-1.8.1.json",encoding="utf8"))
print("lawset",ls["version"],"n laws",len(ls["laws"]))
for l in ls["laws"]:
    if re.search(r"fisher|turing|kpp|chemo|keller|front|wave|wrinkl|sector|kimura-fix|logistic",l["law_id"],re.I): print(" pinned:",l["law_id"],l["version"],l["status"],l["kind"])
import glob
hits=[]
for f in glob.glob(R+"laws/*.json"):
    s=open(f,encoding="utf8").read()
    if re.search(r"chemotax|Keller|Segel|bacteri|colony|range expansion",s,re.I): hits.append(f.split("/")[-1])
print("laws mentioning chemotaxis/Keller-Segel/bacteria/colony/range expansion:",hits)
