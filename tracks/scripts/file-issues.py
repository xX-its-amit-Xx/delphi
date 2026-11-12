"""File the drafted issues on a GitHub repository. Idempotent, dry-run by default.

    python tracks/scripts/file-issues.py --repo OWNER/NAME            show what WOULD be filed
    python tracks/scripts/file-issues.py --repo OWNER/NAME --post     file them

Nothing is posted without --post, because filing issues on a repository is publishing: it notifies
people and cannot be fully taken back. Dry-run prints each title, its labels, and whether an issue
with that exact title already exists, so a re-run never duplicates one.

Labels that do not exist on the repository are skipped rather than created (creating labels is a
change to the repository's settings). The issue still goes up with its labels named in the first line
of the body so the information is not lost.

The token comes from the git credential helper at run time. It is never printed or written.
"""
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request

PATH = "tracks/issues/ISSUES.md"


def token():
    p = subprocess.run(["git", "credential", "fill"], input="protocol=https\nhost=github.com\n\n", capture_output=True, text=True)
    m = re.search(r"^password=(.*)$", p.stdout, re.M)
    if not m:
        raise SystemExit("no GitHub credential available from the git credential helper")
    return m.group(1)


def parse():
    text = open(PATH, encoding="utf-8").read()
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    out = []
    for block in re.split(r"^## ", text, flags=re.M)[1:]:
        title, _, rest = block.partition("\n")
        lm = re.match(r"\s*labels:\s*(.*)\n", rest)
        labels = [x.strip() for x in lm.group(1).split(",")] if lm else []
        body = rest[lm.end():].strip() if lm else rest.strip()
        out.append({"title": title.strip(), "labels": labels, "body": body})
    return out


def call(tok, method, url, data=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(data).encode() if data else None,
                                 headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json",
                                          "User-Agent": "delphi-tracks/0.1", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    repo = sys.argv[sys.argv.index("--repo") + 1]
    post = "--post" in sys.argv
    tok = token()
    meta = call(tok, "GET", f"https://api.github.com/repos/{repo}")
    if not meta.get("has_issues"):
        raise SystemExit(f"{repo} has issues disabled; enabling them is a repository setting and is not done here")
    existing = set()
    page = 1
    while True:
        batch = call(tok, "GET", f"https://api.github.com/repos/{repo}/issues?state=all&per_page=100&page={page}")
        existing |= {i["title"] for i in batch if "pull_request" not in i}
        if len(batch) < 100:
            break
        page += 1
    have_labels = {l["name"] for l in call(tok, "GET", f"https://api.github.com/repos/{repo}/labels?per_page=100")}
    issues = parse()
    print(f"{len(issues)} drafts; target {repo} ({'PUBLIC' if not meta.get('private') else 'private'}); {'POSTING' if post else 'dry run'}")
    n = 0
    for i in issues:
        dup = i["title"] in existing
        use = [l for l in i["labels"] if l in have_labels]
        skipped = [l for l in i["labels"] if l not in have_labels]
        print(f"  {'EXISTS ' if dup else 'new    '} {i['title'][:96]}  labels={use}{' (not on repo: ' + ','.join(skipped) + ')' if skipped else ''}")
        if post and not dup:
            body = i["body"] + (f"\n\n_Labels: {', '.join(i['labels'])}_" if skipped else "")
            r = call(tok, "POST", f"https://api.github.com/repos/{repo}/issues", {"title": i["title"], "body": body, "labels": use})
            print(f"           -> #{r['number']} {r['html_url']}")
            n += 1
    print(f"filed {n}" if post else "nothing posted (add --post)")


if __name__ == "__main__":
    main()
