"""Pull every agent result out of a workflow journal into one JSON file per agent.

    python tracks/scripts/extract-journal.py <journal.jsonl> <out_dir>

Why: a workflow's agents return structured results, but a file an agent writes itself can be a stub
("full result returned via StructuredOutput"). The journal holds the real return value, so this is the
copy that counts. Files are named by the agent's own `label`.
"""
import json, pathlib, sys

journal, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
n = 0
for line in journal.read_text(encoding="utf-8").splitlines():
    r = json.loads(line)
    if r.get("type") != "result":
        continue
    res = r["result"]
    if isinstance(res, str):
        try:
            res = json.loads(res)
        except ValueError:
            continue
    if not isinstance(res, dict) or "label" not in res:
        continue
    (out / f"{res['label']}.json").write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8", newline="\n")
    n += 1
print(n, "results written to", out)
