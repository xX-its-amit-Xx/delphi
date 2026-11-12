"""Pull an author's complete bibliography from OpenAlex, with abstracts, to a JSON file.

    python tracks/scripts/fetch-bibliography.py "Markus J. Buehler" tracks/research/corpus/buehler.json
    python tracks/scripts/fetch-bibliography.py "Lee Marom" tracks/research/corpus/marom.json --hint MIT

The work-list for the literature agents is computed here rather than recalled by them: an agent asked
to "find Buehler's papers" returns the famous ones and invents the rest, whereas a paginated API walk
returns all of them with identifiers attached.

No contact address is sent. OpenAlex asks polite clients for one, and this box's rule is that personal
identifiers do not go to outside services, so the client is named and nothing else.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "delphi-tracks/0.1 (literature survey)"}
API = "https://api.openalex.org"


def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:  # 429s and transient failures: back off and retry, bounded
            wait = 2 ** i
            print(f"  retry {i + 1}/{tries} after {wait}s: {str(e)[:80]}", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit(f"gave up on {url}")


def abstract_of(inv):
    """OpenAlex ships abstracts as an inverted index; rebuild the text."""
    if not inv:
        return None
    words = sorted(((p, w) for w, ps in inv.items() for p in ps))
    return " ".join(w for _, w in words)


def pick_author(name, hint):
    d = get(f"{API}/authors?search={urllib.parse.quote(name)}&per-page=10")
    cands = d.get("results", [])
    if not cands:
        raise SystemExit(f"no OpenAlex author for {name!r}")
    for c in cands:
        inst = " ".join(i.get("display_name", "") for i in (c.get("last_known_institutions") or []))
        print(f"  candidate {c['id'].rsplit('/', 1)[-1]}  {c['display_name']!r}  works={c['works_count']}  inst={inst[:60]!r}",
              file=sys.stderr)
    if hint:
        for c in cands:
            inst = " ".join(i.get("display_name", "") for i in (c.get("last_known_institutions") or []))
            if hint.lower() in inst.lower():
                return c
    return cands[0]  # OpenAlex orders by relevance; the candidates are printed so the choice is auditable


def main():
    name, out = sys.argv[1], sys.argv[2]
    hint = sys.argv[sys.argv.index("--hint") + 1] if "--hint" in sys.argv else None
    a = pick_author(name, hint)
    aid = a["id"].rsplit("/", 1)[-1]
    print(f"chosen {aid} {a['display_name']} with {a['works_count']} works", file=sys.stderr)

    # Paged BY YEAR, not by cursor. OpenAlex answers the first cursor page and then returns 401 for the
    # next without an API key, so a cursor walk silently stops at 200 of 892. A year filter needs no
    # cursor, and no single year of one author comes near the 200-per-page limit - which is asserted.
    works, seen = [], set()
    first = a.get("counts_by_year") or []
    years = list(range(1990, int(time.strftime("%Y")) + 1))
    SELECT = ("id,doi,title,publication_year,type,cited_by_count,primary_location,authorships,"
              "abstract_inverted_index,concepts,open_access")
    for y in years + [None]:
        flt = f"author.id:{aid},publication_year:{y}" if y else f"author.id:{aid},publication_year:<1990"
        page = 1
        while True:
            d = get(f"{API}/works?filter={flt}&per-page=200&page={page}&select={SELECT}")
            res = d.get("results", [])
            for w in res:
                if w["id"] in seen:
                    continue
                seen.add(w["id"])
                loc = w.get("primary_location") or {}
                src = (loc.get("source") or {})
                works.append({
                    "openalex": w["id"].rsplit("/", 1)[-1],
                    "doi": (w.get("doi") or "").replace("https://doi.org/", "") or None,
                    "title": w.get("title"),
                    "year": w.get("publication_year"),
                    "type": w.get("type"),
                    "cited_by": w.get("cited_by_count"),
                    "venue": src.get("display_name"),
                    "authors": [x["author"]["display_name"] for x in (w.get("authorships") or [])][:12],
                    "n_authors": len(w.get("authorships") or []),
                    "abstract": abstract_of(w.get("abstract_inverted_index")),
                    "concepts": [c["display_name"] for c in (w.get("concepts") or []) if c.get("score", 0) > 0.4][:8],
                    "oa_url": (w.get("open_access") or {}).get("oa_url"),
                })
            total = (d.get("meta") or {}).get("count", 0)
            if page * 200 >= total or not res:
                break
            page += 1
        time.sleep(0.25)
    print(f"  {len(works)} works across {len(years)} years", file=sys.stderr)
    if len(works) < 0.9 * a["works_count"]:
        print(f"WARNING: fetched {len(works)} of {a['works_count']} listed works", file=sys.stderr)

    works.sort(key=lambda w: (-(w["year"] or 0), -(w["cited_by"] or 0)))
    json.dump({
        "author": {"name": a["display_name"], "openalex": aid, "works_count": a["works_count"],
                   "cited_by_count": a.get("cited_by_count"), "orcid": a.get("orcid")},
        "source": "OpenAlex, paginated author.id filter",
        "retrieved": time.strftime("%Y-%m-%d"),
        "n": len(works),
        "with_doi": sum(1 for w in works if w["doi"]),
        "with_abstract": sum(1 for w in works if w["abstract"]),
        "works": works,
    }, open(out, "w", encoding="utf-8"), indent=1)
    print(f"wrote {out}: {len(works)} works, {sum(1 for w in works if w['doi'])} with DOI, "
          f"{sum(1 for w in works if w['abstract'])} with abstract")


if __name__ == "__main__":
    main()
