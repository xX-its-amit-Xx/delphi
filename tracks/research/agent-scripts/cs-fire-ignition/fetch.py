"""Fetch FSRI materials database cone scalar + HFM files (small text files only).
Usage: python fetch.py [data_dir]   (default C:/Temp/delphi-sprint/cs-fire-ignition/raw/files)
Skip-if-done: files already on disk are not re-downloaded."""
import json, os, sys, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

REPO = "ulfsri/fsri_materials_database"
OUT = sys.argv[1] if len(sys.argv) > 1 else "C:/Temp/delphi-sprint/cs-fire-ignition/raw/files"
RAW = f"https://raw.githubusercontent.com/{REPO}/main/"
os.makedirs(OUT, exist_ok=True)
tree_path = os.path.join(os.path.dirname(OUT.rstrip("/")), "tree.json")
if not os.path.exists(tree_path):
    urllib.request.urlretrieve(f"https://api.github.com/repos/{REPO}/git/trees/main?recursive=1", tree_path)
tree = json.load(open(tree_path))["tree"]


def want(p):
    if not p.startswith("01_Data/"):
        return False
    b = p.split("/")[-1]
    if "/Cone/" in p and "Scalar" in b and b.endswith(".csv"):
        return True
    if "/HFM/" in p and (b.endswith(".tst") or b.endswith(".csv")):
        return True
    return False


paths = [x["path"] for x in tree if x["type"] == "blob" and want(x["path"])]


def get(p):
    dst = os.path.join(OUT, p.replace("/", os.sep))
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(RAW + urllib.parse.quote(p), timeout=60).read()
            open(dst, "wb").write(data)
            return 1
        except Exception as e:
            err = e
    print("FAILED", p, err)
    return -1


with ThreadPoolExecutor(16) as ex:
    res = list(ex.map(get, paths))
print("wanted", len(paths), "downloaded", res.count(1), "cached", res.count(0), "failed", res.count(-1))
