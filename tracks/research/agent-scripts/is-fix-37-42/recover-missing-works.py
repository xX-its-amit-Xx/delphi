"""Issue #38: find the works OpenAlex lists for the author that the local corpus lacks.
Target repo path: tracks/scripts/recover-missing-works.py
    python tracks/scripts/recover-missing-works.py [corpus.json] [out.json]
Sends no personal identifier (no mailto). Routes tried, each reported separately:
  A. cursor paging of the author filter      B. group_by publication_year (count check, 1 call)
  C. authorships.author.id filter alias      D. ORCID filter (public researcher id of the author)
Read-only against the corpus: writes the recovered records to a separate file to merge by hand."""
import json, sys, time, urllib.request
UA = {"User-Agent": "delphi-tracks/0.1 (literature survey)"}
API = "https://api.openalex.org"; AID = "A5011504360"; ORCID = "0000-0002-4173-9659"
SEL = "id,doi,title,publication_year,type"
corpus = sys.argv[1] if len(sys.argv) > 1 else "tracks/research/corpus/buehler.json"
out = sys.argv[2] if len(sys.argv) > 2 else "tracks/research/corpus/buehler-missing.json"
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            return json.load(r)
    except Exception as e:
        return {"error": str(e)}
def ids_in(o, acc):
    if isinstance(o, dict):
        for v in o.values(): ids_in(v, acc)
    elif isinstance(o, list):
        for v in o: ids_in(v, acc)
    elif isinstance(o, str):
        s = o.rsplit("/", 1)[-1]
        if s[:1] == "W" and s[1:].isdigit(): acc.add(s)
have = set(); ids_in(json.load(open(corpus, encoding="utf-8")), have)
report = {"have": len(have), "routes": {}}; seen = {}
def walk(name, flt):
    cur, n, err = "*", 0, None
    for _ in range(12):                      # stop condition: 12 pages max
        r = get(f"{API}/works?filter={flt}&per-page=200&cursor={cur}&select={SEL}")
        if "error" in r: err = r["error"]; break
        res = r.get("results", [])
        for w in res: seen.setdefault(w["id"].rsplit("/", 1)[-1], w)
        n += len(res); cur = r.get("meta", {}).get("next_cursor")
        report["routes"].setdefault(name, {})["listed"] = r.get("meta", {}).get("count")
        if not res or not cur: break
        time.sleep(0.3)
    report["routes"].setdefault(name, {}).update(returned=n, error=err)
walk("A_cursor_author.id", f"author.id:{AID}")
walk("C_authorships.author.id", f"authorships.author.id:{AID}")
walk("D_orcid", f"author.orcid:{ORCID}")
g = get(f"{API}/works?filter=author.id:{AID}&group_by=publication_year")
report["routes"]["B_group_by_year"] = {"sum": sum(x["count"] for x in g.get("group_by", [])), "error": g.get("error")}
missing = [w for k, w in seen.items() if k not in have]
report.update(seen_total=len(seen), recovered_not_in_corpus=len(missing), corpus_not_in_listing=len(have - set(seen)))
json.dump({"report": report, "works": missing}, open(out, "w", encoding="utf-8"), indent=1)
print(json.dumps(report, indent=1))
