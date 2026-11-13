"""Write fetch_all.sh (curl commands) from MANIFEST.json so every kept file can be re-downloaded."""
import json
m = json.load(open("D:/Users/ashenoy00000/delphi-work/data/bm-bps/MANIFEST.json", encoding="utf8"))
lines = ["#!/usr/bin/env bash", "# Re-download every file listed in MANIFEST.json (run from D:/Users/ashenoy00000/delphi-work/data/bm-bps)",
         "UA='delphi-research/0.1'", "mkdir -p web papers fltds"]
for r in m["files"]:
    lines.append("curl -sL -m 90 -A \"$UA\" -o '%s' '%s'  # sha256 %s" % (r["file"], r["url"], r["sha256"][:16]))
lines.append("# then: python -I make_texts.py ; python -I check_quotes.py")
open("D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/fetch_all.sh", "w", newline="\n", encoding="utf8").write("\n".join(lines) + "\n")
print(len(m["files"]), "commands")
