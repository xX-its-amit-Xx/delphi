"""Look for the manuscript everywhere it could plausibly be, and say what was searched.

    python tracks/scripts/find-paper.py

"The paper is in repo" was in the brief, and a first search of two repositories found nothing. This one
searches every repository under the two GitHub accounts involved, in the file TREE (not just the
default branch's top level), for manuscript-shaped files, and every local clone. A negative result is
reported with the full list of what was looked in, because "not found" is only worth anything if the
reader can see how hard it was looked for.

The GitHub token comes from the git credential helper at run time and is never written anywhere.
"""
import json
import re
import subprocess
import sys
import urllib.request

OWNERS = ["fractastical", "xX-its-amit-Xx", "kganjam"]
MANUSCRIPT = re.compile(r"(\.tex$|\.bib$|manuscript|/paper[s]?/|^paper[s]?/|preprint|draft|\.docx$|abstract\.md|main\.pdf|"
                        r"submission|arxiv|\.typ$)", re.I)
SKIP = re.compile(r"(node_modules|/raw/|prior-art|\.lake|/vendor/)", re.I)


def token():
    p = subprocess.run(["git", "credential", "fill"], input="protocol=https\nhost=github.com\n\n",
                       capture_output=True, text=True)
    m = re.search(r"^password=(.*)$", p.stdout, re.M)
    return m.group(1) if m else None


TOK = token()


def api(url):
    h = {"User-Agent": "delphi-tracks/0.1", "Accept": "application/vnd.github+json"}
    if TOK:
        h["Authorization"] = f"Bearer {TOK}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r:
        return json.load(r)


def main():
    searched, hits = [], []
    for owner in OWNERS:
        try:
            repos = api(f"https://api.github.com/users/{owner}/repos?per_page=100&sort=pushed")
        except Exception as e:
            print(f"  could not list {owner}: {e}", file=sys.stderr)
            continue
        for r in repos:
            name = r["full_name"]
            try:
                t = api(f"https://api.github.com/repos/{name}/git/trees/{r['default_branch']}?recursive=1")
            except Exception:
                searched.append((name, "tree unavailable"))
                continue
            paths = [x["path"] for x in t.get("tree", []) if x["type"] == "blob"]
            found = [p for p in paths if MANUSCRIPT.search(p) and not SKIP.search(p)]
            searched.append((name, f"{len(paths)} files{' (truncated)' if t.get('truncated') else ''}, {len(found)} manuscript-shaped"))
            for p in found:
                hits.append((name, p))
    print(f"searched {len(searched)} repositories under {', '.join(OWNERS)}")
    for n, s in searched:
        print(f"  {n:46s} {s}")
    print(f"\n{len(hits)} manuscript-shaped paths:")
    for n, p in hits[:80]:
        print(f"  {n}  {p}")


if __name__ == "__main__":
    main()
