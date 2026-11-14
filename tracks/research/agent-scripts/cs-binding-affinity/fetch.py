"""Fetch ChEMBL Ki rows for the roster. Usage: python -I fetch.py <raw_dir>   (skip-if-done, resumable)"""
import json, sys, os, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from targets import TARGETS
RAW = sys.argv[1]; os.makedirs(RAW, exist_ok=True)
BASE = "https://www.ebi.ac.uk/chembl/api/data/activity.json"
ONLY = "molecule_chembl_id,canonical_smiles,pchembl_value,assay_chembl_id,document_chembl_id,target_chembl_id"
MAXPAGES = 4
def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "research-script"}), timeout=120) as r:
                return json.load(r)
        except Exception as e:
            err = e; time.sleep(3 * (i + 1))
    raise err
def one(t):
    out = os.path.join(RAW, t + ".json")
    if os.path.exists(out): return t, "cached"
    rows, total = [], None
    for p in range(MAXPAGES):
        q = urllib.parse.urlencode({"target_chembl_id": t, "standard_type": "Ki", "standard_relation": "=",
            "pchembl_value__isnull": "false", "assay_type": "B", "limit": 1000, "offset": p * 1000, "only": ONLY})
        d = get(BASE + "?" + q); total = d["page_meta"]["total_count"]; rows += d["activities"]
        if (p + 1) * 1000 >= total: break
    json.dump({"target": t, "total_count": total, "fetched_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "rows": rows}, open(out + ".tmp", "w"))
    os.replace(out + ".tmp", out)
    return t, f"{len(rows)} of {total}"
with ThreadPoolExecutor(6) as ex:
    for t, s in ex.map(lambda t: (lambda: one(t))() if True else None, TARGETS): print(t, s, flush=True)
