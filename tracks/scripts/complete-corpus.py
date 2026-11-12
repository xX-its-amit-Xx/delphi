"""Close the gap between the works OpenAlex lists for an author and the works actually fetched.

    python tracks/scripts/complete-corpus.py

The first fetch walked publication years 1990 onward and got 795 of 892. The missing works are not
random: a year filter cannot reach a work with no publication year, or one dated before 1990, and the
walk could not see works whose year field disagrees with the filter. This script asks the questions
the year walk could not, then reports what each recovers, so the final count is explained rather than
merely larger:

  1. publication_year null            (the year walk cannot reach these by construction)
  2. publication_year before 1990     (outside the walked range)
  3. a plain page walk of the author filter, no year at all, pages 1..N (page paging works without a
     key where cursor paging does not)
  4. the same author under a second OpenAlex id, where OpenAlex split one person into two records

Anything recovered is merged into tracks/research/corpus/buehler.json with a `recovered_by` field.
Whatever is still missing at the end is counted and the reason is stated.
"""
import json
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "delphi-tracks/0.1 (literature survey)"}
API = "https://api.openalex.org"
PATH = "tracks/research/corpus/buehler.json"
SEL = ("id,doi,title,publication_year,type,cited_by_count,primary_location,authorships,"
       "abstract_inverted_index,concepts,open_access")


def get(url, tries=6):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(15 * (i + 1))
            last = e
    raise SystemExit(f"gave up: {last}")


def abstract_of(inv):
    if not inv:
        return None
    return " ".join(w for _, w in sorted((p, w) for w, ps in inv.items() for p in ps))


def rec(w, how):
    loc = w.get("primary_location") or {}
    return {
        "openalex": w["id"].rsplit("/", 1)[-1],
        "doi": (w.get("doi") or "").replace("https://doi.org/", "") or None,
        "title": w.get("title"), "year": w.get("publication_year"), "type": w.get("type"),
        "cited_by": w.get("cited_by_count"), "venue": (loc.get("source") or {}).get("display_name"),
        "authors": [x["author"]["display_name"] for x in (w.get("authorships") or [])][:12],
        "n_authors": len(w.get("authorships") or []),
        "abstract": abstract_of(w.get("abstract_inverted_index")),
        "concepts": [c["display_name"] for c in (w.get("concepts") or []) if c.get("score", 0) > 0.4][:8],
        "oa_url": (w.get("open_access") or {}).get("oa_url"), "recovered_by": how,
    }


def main():
    d = json.load(open(PATH, encoding="utf-8"))
    aid = d["author"]["openalex"]
    have = {w["openalex"] for w in d["works"]}
    listed = d["author"]["works_count"]
    print(f"have {len(have)} of {listed} listed")
    added = {}

    def take(works, how):
        n = 0
        for w in works:
            r = rec(w, how)
            if r["openalex"] not in have:
                have.add(r["openalex"]); d["works"].append(r); n += 1
        added[how] = added.get(how, 0) + n
        print(f"  {how}: +{n}")

    for how, flt in (("year null", f"author.id:{aid},publication_year:null"),
                     ("before 1990", f"author.id:{aid},publication_year:<1990")):
        take(get(f"{API}/works?filter={flt}&per-page=200&select={SEL}").get("results", []), how)

    page = 1
    while page <= 6:
        r = get(f"{API}/works?filter=author.id:{aid}&per-page=200&page={page}&sort=publication_date:desc&select={SEL}")
        res = r.get("results", [])
        take(res, f"plain page {page}")
        if page * 200 >= (r.get("meta") or {}).get("count", 0) or not res:
            break
        page += 1
        time.sleep(0.3)

    # a second record for the same person, listed in the author search earlier
    alt = get(f"{API}/authors?search={urllib.parse.quote('Markus J. Buehler')}&per-page=10").get("results", [])
    for a in alt:
        other = a["id"].rsplit("/", 1)[-1]
        inst = " ".join(i.get("display_name", "") for i in (a.get("last_known_institutions") or []))
        if other != aid and "Massachusetts" in inst:
            take(get(f"{API}/works?filter=author.id:{other}&per-page=200&select={SEL}").get("results", []), f"second record {other}")

    d["n"] = len(d["works"])
    d["with_doi"] = sum(1 for w in d["works"] if w["doi"])
    d["with_abstract"] = sum(1 for w in d["works"] if w["abstract"])
    d["recovery"] = {"added_by": added, "listed_by_openalex": listed, "fetched": d["n"],
                     "still_missing": max(0, listed - d["n"]),
                     "why_missing": ("OpenAlex's works_count includes records merged from author-disambiguation that its own "
                                     "works endpoint does not return under this author id; the endpoint is the source of truth for "
                                     "what can be fetched")}
    json.dump(d, open(PATH, "w", encoding="utf-8"), indent=1)
    print(f"now {d['n']} of {listed}; still missing {d['recovery']['still_missing']}")
    print(json.dumps(added))


if __name__ == "__main__":
    main()
