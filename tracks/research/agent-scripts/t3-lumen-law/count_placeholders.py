import json
R = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/"
d = json.load(open(R + "lawsets/lawset-1.8.1.json", encoding="utf8"))
ph = []
for l in d["laws"]:
    j = json.load(open(R + "laws/" + l["law_id"] + ".json", encoding="utf8"))
    r = j.get("lean_ref") or {}
    if not r.get("theorem"):
        ph.append(l["law_id"])
print(len(d["laws"]), "laws;", len(ph), "placeholders:", ph)
