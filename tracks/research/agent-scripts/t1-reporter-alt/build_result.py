"""Writes agents2/t1-reporter-alt.json from the dict in result_body.json (kept next to this script)."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
body = json.load(open(os.path.join(here, "result_body.json"), encoding="utf-8"))
out = os.path.join(here, "..", "..", "t1-reporter-alt.json")
json.dump(body, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
json.load(open(out, encoding="utf-8"))
print("wrote", os.path.abspath(out), os.path.getsize(out))
