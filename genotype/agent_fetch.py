"""Shared logged fetcher for the genotype thread's subagents (pathways, causal chains, interactions).

Every subagent fetches through this script so that each call lands in its own log with the URL, UTC time,
HTTP status, byte count and SHA-256 of the body. Nothing is fetched twice unless --force is given: a cached
body is reused and the log records the reuse. No personal identifier is ever sent.

  python -I genotype/agent_fetch.py --log <logfile.json> --out <bodyfile> <name> <url>
  python -I genotype/agent_fetch.py --log <logfile.json> --out <bodyfile> --post <urlencoded body> <name> <url>
  python -I genotype/agent_fetch.py --log <logfile.json> --print <name> <url>       # body to stdout, still logged

Exit status is 0 when the HTTP status was 200, else 1, so a shell can tell a refusal from a success.
"""
import hashlib, json, os, sys, time, urllib.request, urllib.error

UA = {"User-Agent": "delphisci-genotype-thread/0.2 (ScienceClaw hackathon; research use)"}
a = sys.argv[1:]
def opt(flag, default=None):
    return a[a.index(flag) + 1] if flag in a else default
log_path = opt("--log"); out = opt("--out"); post = opt("--post"); accept = opt("--accept")
to_stdout = "--print" in a; force = "--force" in a
rest = [x for i, x in enumerate(a) if not (x.startswith("--") or (i > 0 and a[i - 1] in ("--log", "--out", "--post", "--accept")))]
if len(rest) < 2 or not log_path:
    sys.exit("usage: --log FILE [--out FILE | --print] [--post BODY] [--accept TYPE] NAME URL")
name, url = rest[0], rest[1]
log = json.load(open(log_path)) if os.path.exists(log_path) else {"note": "Calls made by a genotype-thread subagent through genotype/agent_fetch.py.", "calls": []}
prev = next((c for c in log["calls"] if c["name"] == name and c["url"] == url and c.get("status") == 200 and c.get("saved_to")), None)
if prev and not force and os.path.exists(prev["saved_to"]):
    prev.setdefault("reused", 0); prev["reused"] += 1
    json.dump(log, open(log_path, "w"), indent=1)
    if to_stdout: sys.stdout.write(open(prev["saved_to"], encoding="utf8", errors="replace").read())
    print(f"[cached] {prev['saved_to']}", file=sys.stderr); sys.exit(0)
h = dict(UA)
if accept: h["Accept"] = accept
if post: h["Content-Type"] = "application/x-www-form-urlencoded"
rec = {"name": name, "url": url, "method": "POST" if post else "GET", "retrieved": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
if post: rec["body"] = post
try:
    with urllib.request.urlopen(urllib.request.Request(url, data=post.encode() if post else None, headers=h), timeout=300) as r:
        body = r.read(); rec["status"] = r.status; rec["content_type"] = r.headers.get("Content-Type")
except urllib.error.HTTPError as e:
    body = e.read(); rec["status"] = e.code; rec["error"] = str(e)
except Exception as e:
    body = b""; rec["status"] = None; rec["error"] = repr(e)
rec["bytes"] = len(body); rec["sha256"] = hashlib.sha256(body).hexdigest()
if rec["status"] != 200: rec["body_head"] = body[:300].decode("utf8", "replace")
if out and rec["status"] == 200:
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "wb").write(body); rec["saved_to"] = out.replace("\\", "/")
log["calls"].append(rec)
json.dump(log, open(log_path, "w"), indent=1)
if to_stdout and body: sys.stdout.write(body.decode("utf8", "replace"))
print(f"{rec['status']} {rec['bytes']} {name}" + (f" -> {out}" if out and rec["status"] == 200 else ""), file=sys.stderr)
sys.exit(0 if rec["status"] == 200 else 1)
