"""Fetch a URL to a file under the scratch dir and record url/date/bytes/sha256 in manifest.
Usage: python -I fetch.py <url> <outfile> """
import sys, hashlib, datetime, json, urllib.request, os
url, out = sys.argv[1], sys.argv[2]
req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
b = urllib.request.urlopen(req, timeout=90).read()
open(out, "wb").write(b)
rec = {"url": url, "file": out, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(),
       "date": datetime.date.today().isoformat()}
open(os.path.join(os.path.dirname(os.path.abspath(out)), "manifest.jsonl"), "a").write(json.dumps(rec) + "\n")
print(rec)
