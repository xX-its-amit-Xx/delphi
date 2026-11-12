"""Resolve every citation the track and specialist agents returned, independently of the agents.

    python tracks/scripts/verify-dois.py [agents_dir]

An agent's `verified: true` is a claim about what it fetched. This script is the check on that claim:
it takes each DOI or arXiv id, asks Crossref or arXiv for the record, and compares the returned title
with the title the agent attached. A citation passes only if the identifier resolves AND the titles
agree. That second condition matters more than the first - a real DOI stapled to the wrong paper
resolves perfectly.

Results are cached in tracks/research/doi-resolution.json and finished ids are skipped on a re-run, so
an interrupted pass loses nothing. Rate-limited or unreachable ids are recorded as `unreachable`, not
as failures: "we could not ask" and "the registry said no" are different results.
"""
import glob
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

AGENTS = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DELPHI_AGENTS_DIR", "D:/Users/ashenoy00000/delphi-work/agents")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "research", "doi-resolution.json")
UA = {"User-Agent": "delphi-tracks/0.1 (citation check)"}


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", re.sub(r"<[^>]+>", " ", str(s or "").lower())).strip()


def key_of(raw):
    """One identifier per citation. Where an agent packed two into one field ("10.x/y ; arxiv:1234.5678")
    the DOI is taken, since it names the version of record."""
    v = re.sub(r"^https?://(dx\.)?doi\.org/", "", str(raw or "").strip().lower())
    m = re.search(r"10\.\d{4,9}/[^\s;,]+", v)
    return m.group(0).rstrip(".") if m else v


def titles_agree(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    wa, wb = set(a.split()), set(b.split())
    return len(wa & wb) / max(1, min(len(wa), len(wb))) >= 0.75


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return r.read().decode("utf-8", "replace")


def resolve(raw, title):
    k = key_of(raw)
    ax = re.search(r"(\d{4}\.\d{4,5})(v\d+)?", k) if "arxiv" in k or re.fullmatch(r"\d{4}\.\d{4,5}(v\d+)?", k) else None
    try:
        if ax:
            xml = fetch(f"https://export.arxiv.org/api/query?id_list={ax.group(1)}")
            m = re.search(r"<entry>.*?<title>(.*?)</title>", xml, re.S)
            if not m:
                return {"ok": False, "why": "arXiv returned no entry", "registry": "arXiv"}
            got = " ".join(m.group(1).split())
            ok = titles_agree(title, got)
            return {"ok": ok, "registry": "arXiv", "registry_title": got[:200],
                    "why": None if ok else "identifier resolves but to a different title"}
        if k.startswith("10."):
            # CROSSREF IS NOT THE ONLY REGISTRY. The first version asked Crossref about every DOI and
            # recorded a 404 as "no such identifier". Five of its ten failures were dataset DOIs minted
            # by DataCite (Zenodo, figshare, an ETH research collection), which Crossref has never
            # heard of. The registry said no because it was the wrong registry. DataCite is asked next,
            # and only a miss in BOTH is a failure.
            got, year, registry = None, None, None
            try:
                d = json.loads(fetch("https://api.crossref.org/works/" + urllib.parse.quote(k, safe="/")))
                got = " ".join((d["message"].get("title") or [""])[0].split())
                year = (d["message"].get("issued", {}).get("date-parts") or [[None]])[0][0]
                registry = "Crossref"
            except urllib.error.HTTPError as e:
                if e.code != 404:
                    raise
                d = json.loads(fetch("https://api.datacite.org/dois/" + urllib.parse.quote(k, safe="/")))
                at = d["data"]["attributes"]
                got = " ".join(((at.get("titles") or [{}])[0].get("title") or "").split())
                year = at.get("publicationYear")
                registry = "DataCite"
            if not norm(title):
                # no title was attached, so there is nothing to compare. The identifier is real; whether
                # it is the paper the agent meant cannot be said, and that is its own status.
                return {"ok": None, "resolves_untitled": True, "registry": registry, "registry_title": got[:200],
                        "year": year, "why": "resolves, but the agent attached no title to compare against"}
            ok = titles_agree(title, got)
            return {"ok": ok, "registry": registry, "registry_title": got[:200], "year": year,
                    "why": None if ok else "identifier resolves but to a different title"}
        return {"ok": False, "why": "not a DOI or an arXiv id", "registry": None}
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"ok": False, "why": "registry returned 404: no such identifier", "registry": "Crossref" if not ax else "arXiv"}
        return {"ok": None, "unreachable": True, "why": f"HTTP {e.code}"}
    except Exception as e:  # network trouble is not a verdict on the citation
        return {"ok": None, "unreachable": True, "why": str(e)[:120]}


def main():
    cache = {}
    if os.path.exists(OUT):
        cache = json.load(open(OUT, encoding="utf-8")).get("results", {})
    cites = []
    for f in sorted(glob.glob(os.path.join(AGENTS, "*.json"))):
        if os.path.basename(f).startswith("corpus-"):
            continue  # the corpus is checked against its own source by tracks/build.mjs
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for c in d.get("citations", []) or []:
            cites.append((os.path.basename(f), c))
    todo = [(f, c) for f, c in cites if key_of(c.get("doi_or_arxiv")) and
            (key_of(c.get("doi_or_arxiv")) not in cache or cache[key_of(c.get("doi_or_arxiv"))].get("unreachable")
             or cache[key_of(c.get("doi_or_arxiv"))].get("ok") is False)]
    print(f"{len(cites)} citations in {AGENTS}; {len(todo)} to resolve, {len(cites) - len(todo)} cached or blank")
    for i, (f, c) in enumerate(todo):
        k = key_of(c["doi_or_arxiv"])
        r = resolve(k, c.get("title"))
        r["agent_title"] = (c.get("title") or "")[:200]
        r["agent_said_verified"] = bool(c.get("verified"))
        r["from"] = f
        cache[k] = r
        if (i + 1) % 20 == 0:
            json.dump({"results": cache}, open(OUT, "w", encoding="utf-8"), indent=1)
            print(f"  {i + 1}/{len(todo)}")
        time.sleep(0.35)
    vals = list(cache.values())
    summary = {
        "checked": len(vals),
        "resolved_with_matching_title": sum(1 for v in vals if v.get("ok") is True),
        "failed": sum(1 for v in vals if v.get("ok") is False),
        "unreachable": sum(1 for v in vals if v.get("unreachable")),
        "resolves_but_no_title_to_compare": sum(1 for v in vals if v.get("resolves_untitled")),
        "agent_said_verified_but_failed": sum(1 for v in vals if v.get("ok") is False and v.get("agent_said_verified")),
    }
    json.dump({"rule": "resolved AND the registry title agrees with the title the agent attached",
               "retrieved": time.strftime("%Y-%m-%d"), "summary": summary, "results": cache},
              open(OUT, "w", encoding="utf-8"), indent=1)
    print(json.dumps(summary, indent=1))
    for k, v in cache.items():
        if v.get("ok") is False:
            print(f"  FAILED {k}  [{v['from']}]  {v['why']}\n         agent: {v['agent_title'][:80]}\n         registry: {str(v.get('registry_title'))[:80]}")


if __name__ == "__main__":
    main()
