"""Fetch the Vasquez et al. 2021 Source Data zip and write a sha256 manifest.
Usage: python 01_fetch.py [DATA_DIR]
Default DATA_DIR = D:/Users/ashenoy00000/delphi-work/data/t3-vasquez
Needs only the Python standard library. Re-running skips the download if the file is present and the hash matches.
"""
import hashlib, os, sys, urllib.request, zipfile, json, datetime

URL = ("https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-021-25050-3/"
       "MediaObjects/41467_2021_25050_MOESM6_ESM.zip")
EXPECT_ZIP_SHA = "67b77eb57499ac2f805f9c6dc76c78cb08820e9e0fe02152111fea36df19e9fe"
D = sys.argv[1] if len(sys.argv) > 1 else "D:/Users/ashenoy00000/delphi-work/data/t3-vasquez"
os.makedirs(D + "/raw", exist_ok=True)
zp = D + "/raw/moesm6.zip"


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


if not (os.path.exists(zp) and sha(zp) == EXPECT_ZIP_SHA):
    req = urllib.request.Request(URL, headers={"User-Agent": "delphi-research/0.1"})
    with urllib.request.urlopen(req, timeout=120) as r, open(zp, "wb") as f:
        f.write(r.read())
    fetched = datetime.datetime.now(datetime.timezone.utc).isoformat()
else:
    fetched = "already present"
z = zipfile.ZipFile(zp)
man = {"url": URL, "fetched_utc": fetched, "files": {}}
man["files"]["moesm6.zip"] = {"bytes": os.path.getsize(zp), "sha256": sha(zp)}
assert man["files"]["moesm6.zip"]["sha256"] == EXPECT_ZIP_SHA, "zip hash differs from the one recorded on 2026-11-12"
for i in z.infolist():
    n = i.filename
    # keep only real workbooks; skip macOS resource forks and the Excel lock file
    if n.endswith(".xlsx") and "__MACOSX" not in n and "~$" not in n:
        out = D + "/raw/" + os.path.basename(n)
        with open(out, "wb") as f:
            f.write(z.read(n))
        man["files"][os.path.basename(n)] = {"bytes": os.path.getsize(out), "sha256": sha(out)}
json.dump(man, open(D + "/MANIFEST.json", "w"), indent=1)
for k, v in man["files"].items():
    print(v["sha256"], v["bytes"], k)
