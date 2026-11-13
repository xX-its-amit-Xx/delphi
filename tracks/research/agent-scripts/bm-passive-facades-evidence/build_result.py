"""Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-passive-facades-evidence.json and checks that every
evidence_quote appears (whitespace-insensitive) in the saved source text under data/passive-facades/.
Run: python build_result.py   (content lives in result_content.py)"""
import json, re, sys
sys.path.insert(0, "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-passive-facades-evidence")
import result_content as C

DD = "D:/Users/ashenoy00000/delphi-work/data/passive-facades/"
F = {"cheng": "10.1038_s41467-024-54808-8.txt", "bio25": "10.3390_biomimetics10100711.txt", "abs": "abstracts.txt",
     "aivc": "aivc22.txt", "boss": "bossche2007.txt", "arx": "arxiv_2308.01530.txt", "loonen": "loonen_ideas.txt",
     "tiles": "10.1038_s41467-024-54944-1.txt", "pdh": "10.1038_s41467-025-65071-w.txt"}


def norm(s):
    return re.sub(r"\s+", "", s.replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"'))


T = {k: norm(open(DD + v, encoding="utf8").read()) for k, v in F.items()}
bad = []
n = 0
for item in C.findings + C.key_claims_src:
    k, q = item.pop("_qk", None), item.get("evidence_quote", "")
    if q:
        n += 1
        if k is None or norm(q) not in T[k]:
            bad.append((k, q))
        if len(q.split()) > 40:
            bad.append(("LEN", q))
if bad:
    print("QUOTE PROBLEMS:")
    for b in bad:
        print("  ", b)
    sys.exit(1)
res = C.build()
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-passive-facades-evidence.json"
json.dump(res, open(OUT, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("QUOTES OK n=%d findings=%d table=%d -> %s" % (n, len(res["findings"]), len(res["table"]), OUT))
