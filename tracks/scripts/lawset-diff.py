"""Compare two law sets and say what moved between them.

    python tracks/scripts/lawset-diff.py 1.6.0 1.8.1

Written because the law-mapping agents were pointed at the split-out library (1.6.0) while this
application repo carries 1.8.1, so their "existing laws" lists may be short by whatever landed in
between. This prints exactly that gap instead of guessing at it.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, "..", "..", "lean", "registry", "lawsets")


def load(v):
    p = os.path.join(DIR, f"lawset-{v}.json")
    d = json.load(open(p, encoding="utf-8"))
    laws = d.get("laws") or d.get("entries") or []
    if isinstance(laws, dict):
        laws = list(laws.values())
    out = {}
    for l in laws:
        if isinstance(l, str):
            out[l] = {"law_id": l}
        else:
            key = l.get("law_id") or l.get("id") or l.get("law") or l.get("name")
            out[str(key)] = l
    return d, out


a_raw, A = load(sys.argv[1])
b_raw, B = load(sys.argv[2])
print(f"{sys.argv[1]}: {len(A)} laws   {sys.argv[2]}: {len(B)} laws")
for k in ("created", "created_at", "date", "commit", "pinned_commit"):
    if k in a_raw or k in b_raw:
        print(f"  {k}: {a_raw.get(k)} -> {b_raw.get(k)}")

added = [k for k in B if k not in A]
removed = [k for k in A if k not in B]
print(f"\nADDED in {sys.argv[2]} ({len(added)}):")
for k in sorted(added):
    e = B[k]
    # the pinned entry carries only an id, a hash and a status; the prose lives in laws/<id>.json
    det = {}
    dp = os.path.join(HERE, "..", "..", "lean", "registry", "laws", f"{k}.json")
    if os.path.exists(dp):
        det = json.load(open(dp, encoding="utf-8"))
    ref = det.get("lean_ref") or {}
    print(f"  {k}  [{e.get('status', '?')}/{e.get('kind', '?')}]  {str(det.get('statement') or det.get('title') or det.get('summary') or '')[:92]}")
    if ref:
        print(f"      {ref.get('module')} :: {ref.get('theorem')}")
print(f"\nREMOVED ({len(removed)}): {', '.join(sorted(removed)) or 'none'}")

changed = []
for k in B:
    if k in A and A[k].get("status") != B[k].get("status"):
        changed.append((k, A[k].get("status"), B[k].get("status")))
print(f"\nSTATUS CHANGES ({len(changed)}):")
for k, x, y in sorted(changed):
    print(f"  {k}: {x} -> {y}")

# A pinned entry carries only law_id, version, content_hash, status and kind. The lean_ref lives in
# lean/registry/laws/<id>.json. Reading it off the pinned entry reports every law as theorem-less,
# which is how the first version of this line came to claim 59 of 59.
LAWS_DIR = os.path.join(HERE, "..", "..", "lean", "registry", "laws")


def detail(law_id):
    p = os.path.join(LAWS_DIR, f"{law_id}.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


gaps = [k for k in B if not ((detail(k).get("lean_ref") or {}).get("theorem"))]
print(f"\nPINNED BUT WITH NO LEAN THEOREM ({len(gaps)} of {len(B)}): {', '.join(sorted(gaps))}")
by_status = {}
for k in B:
    by_status[B[k].get("status", "?")] = by_status.get(B[k].get("status", "?"), 0) + 1
print(f"STATUS COUNTS: {by_status}")
files = sorted(f[:-5] for f in os.listdir(LAWS_DIR) if f.endswith(".json"))
unpinned = [x for x in files if x not in B]
print(f"LAW FILES NOT PINNED BY {sys.argv[2]} ({len(unpinned)}): {', '.join(unpinned) or 'none'}")
