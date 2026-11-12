"""Add or remove this session's row in the shared registry-claims file.

    python tracks/scripts/registry-claim.py add "<resource>" "<notes>"
    python tracks/scripts/registry-claim.py remove "<resource substring>"

A script rather than a shell one-liner because the rows contain backticks and backslashes, and quoting
those inline in bash has already failed once.
"""
import sys
import time

PATH = "C:/Temp/claude-mailbox/registry-claims.md"
OWNER = "ScienceClaw DELPHI atlas+tracks (antigravity session b0ad0789)"

op = sys.argv[1]
text = open(PATH, encoding="utf-8").read()
if op == "add":
    resource, notes = sys.argv[2], sys.argv[3]
    row = f"| {resource} | {OWNER} | {time.strftime('%Y-%m-%d')} | {notes} |\n"
    if resource in text:
        print("already claimed")
    else:
        open(PATH, "a", encoding="utf-8").write(("" if text.endswith("\n") else "\n") + row)
        print("added:", row.strip()[:110])
elif op == "remove":
    needle = sys.argv[2]
    kept = [l for l in text.splitlines(keepends=True) if not (needle in l and OWNER in l)]
    open(PATH, "w", encoding="utf-8").write("".join(kept))
    print(f"removed {len(text.splitlines()) - len(kept)} row(s)")
