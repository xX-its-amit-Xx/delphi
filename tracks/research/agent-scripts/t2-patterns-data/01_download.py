"""Step 1: download Cremer 2019 source-data files and code, write manifest with URL/date/bytes/sha256.
Usage: python -I 01_download.py [DATA_DIR]
Seen files go to DATA_DIR/seen, quarantined (never parsed by these scripts) to DATA_DIR/quarantined.
"""
import hashlib, json, os, sys, time, urllib.request, datetime

DATA = sys.argv[1] if len(sys.argv) > 1 else r"D:/Users/ashenoy00000/delphi-work/data/cremer2019"
BASE = "https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-019-1733-y/MediaObjects/41586_2019_1733_MOESM{n}_ESM.{ext}"
SEEN = {3: "txt", 11: "xlsx", 22: "xlsx"}
QUAR = {n: "xlsx" for n in (12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24)}
CODE = {
    "gp_chemotaxis.py": "https://raw.githubusercontent.com/jonascremer/chemotaxis_simulation/master/gp_chemotaxis.py",
    "LICENSE": "https://raw.githubusercontent.com/jonascremer/chemotaxis_simulation/master/LICENSE",
}
MAXMB = 150

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

rows = []
def save(url, path, group):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        b = get(url)
    except Exception as e:
        rows.append({"url": url, "group": group, "error": repr(e)}); print("FAIL", url, e); return
    open(path, "wb").write(b)
    rows.append({"file": os.path.relpath(path, DATA).replace("\\", "/"), "group": group, "url": url,
                 "date_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
                 "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()})
    print("ok", rows[-1]["file"], len(b), rows[-1]["sha256"][:12])
    time.sleep(0.5)

for n, ext in SEEN.items():
    save(BASE.format(n=n, ext=ext), f"{DATA}/seen/MOESM{n}.{ext}", "seen")
for n, ext in QUAR.items():
    save(BASE.format(n=n, ext=ext), f"{DATA}/quarantined/MOESM{n}.{ext}", "quarantined-not-parsed")
for name, url in CODE.items():
    save(url, f"{DATA}/code/{name}", "code")
# figshare listing only (confocal archive exceeds the size limit; not downloaded)
try:
    b = get("https://api.figshare.com/v2/articles/9639209")
    j = json.loads(b)
    rows.append({"group": "figshare-listing-only", "url": "https://api.figshare.com/v2/articles/9639209",
                 "files": [{"name": f["name"], "size": f["size"], "md5": f.get("computed_md5"), "download_url": f["download_url"]} for f in j["files"]],
                 "license": j.get("license", {}).get("name")})
    print("figshare", rows[-1]["files"], rows[-1]["license"])
except Exception as e:
    rows.append({"group": "figshare-listing-only", "error": repr(e)}); print("figshare FAIL", e)
json.dump(rows, open(f"{DATA}/MANIFEST.json", "w"), indent=1)
print("manifest written", f"{DATA}/MANIFEST.json")
