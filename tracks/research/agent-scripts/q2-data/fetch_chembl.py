"""Download ChEMBL Ki/IC50 activities (pchembl, '=' relation) for a fixed target list via the public REST API.
Resumable: skips targets already saved. Output: D:/.../data/chembl-q2/<type>_<target>.json (compact rows)."""
import json, os, sys, time, urllib.request, hashlib
OUT = "D:/Users/ashenoy00000/delphi-work/data/chembl-q2"
TARGETS = ["CHEMBL203","CHEMBL204","CHEMBL205","CHEMBL206","CHEMBL210","CHEMBL213","CHEMBL214","CHEMBL217","CHEMBL218","CHEMBL220","CHEMBL222","CHEMBL224","CHEMBL228","CHEMBL229","CHEMBL230","CHEMBL233","CHEMBL234","CHEMBL236","CHEMBL237","CHEMBL238","CHEMBL240","CHEMBL244","CHEMBL251","CHEMBL253","CHEMBL259","CHEMBL264","CHEMBL279","CHEMBL301","CHEMBL325","CHEMBL344","CHEMBL1824","CHEMBL1827","CHEMBL2095","CHEMBL3594","CHEMBL4005","CHEMBL3979","CHEMBL1862","CHEMBL3038","CHEMBL2034","CHEMBL1075138"]
TYPES = ["Ki","IC50"]
ONLY = "activity_id,molecule_chembl_id,target_chembl_id,target_pref_name,target_organism,assay_chembl_id,document_chembl_id,pchembl_value,standard_type,standard_relation,assay_type,data_validity_comment,potential_duplicate"
def get(url):
    for i in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent":"delphi-research/0.1"})
            return json.load(urllib.request.urlopen(req, timeout=60))
        except Exception as e:
            time.sleep(2*(i+1))
    raise RuntimeError(url)
MAXROWS = 12000
for t in TARGETS:
    for ty in TYPES:
        fn = f"{OUT}/{ty}_{t}.json"
        if os.path.exists(fn): continue
        url = (f"https://www.ebi.ac.uk/chembl/api/data/activity.json?limit=1000&standard_type={ty}"
               f"&pchembl_value__isnull=false&standard_relation=%3D&assay_type=B&target_chembl_id={t}&only={ONLY}")
        rows = []
        while url and len(rows) < MAXROWS:
            d = get(url); rows += d["activities"]
            n = d["page_meta"]["next"]; url = ("https://www.ebi.ac.uk"+n) if n else None
        json.dump(rows, open(fn,"w"), separators=(",",":"))
        print(ty, t, len(rows), flush=True)
