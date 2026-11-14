"""Fixed target roster and untunable split rule (imported by fetch.py and analyze.py)."""
import hashlib
# Roster inherited unchanged from the earlier q2-data agent (fetch_chembl.py), fixed before this run.
TARGETS = ["CHEMBL203","CHEMBL204","CHEMBL205","CHEMBL206","CHEMBL210","CHEMBL213","CHEMBL214","CHEMBL217","CHEMBL218","CHEMBL220","CHEMBL222","CHEMBL224","CHEMBL228","CHEMBL229","CHEMBL230","CHEMBL233","CHEMBL234","CHEMBL236","CHEMBL237","CHEMBL238","CHEMBL240","CHEMBL244","CHEMBL251","CHEMBL253","CHEMBL259","CHEMBL264","CHEMBL279","CHEMBL301","CHEMBL325","CHEMBL344","CHEMBL1824","CHEMBL1827","CHEMBL2095","CHEMBL3594","CHEMBL4005","CHEMBL3979","CHEMBL1862","CHEMBL3038","CHEMBL2034","CHEMBL1075138"]
def is_heldout(tid):
    return int(hashlib.sha256(tid.encode()).hexdigest(), 16) % 4 == 0
if __name__ == "__main__":
    h = [t for t in TARGETS if is_heldout(t)]
    print("heldout", len(h), h); print("dev", len(TARGETS) - len(h))
