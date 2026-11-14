"""Helpers: search Europe PMC (open access) and fetch full-text XML; list table captions.
usage: python epmc.py search "<query>" [n]   |   python epmc.py tabs PMCID [PMCID...]   |  python epmc.py show PMCID
"""
import sys, os, re, json, urllib.request, urllib.parse
D = "C:/Temp/delphi-sprint/cs-crosslink-swelling/xml"; os.makedirs(D, exist_ok=True)
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "research-script"}), timeout=60).read().decode("utf8", "replace")
def xml(p):
    f = f"{D}/{p}.xml"
    if not os.path.exists(f):
        open(f, "w", encoding="utf8").write(get(f"https://www.ebi.ac.uk/europepmc/webservices/rest/{p}/fullTextXML"))
    return open(f, encoding="utf8").read()
def strip(s): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()
def tables(x):
    out = []
    for m in re.finditer(r"<table-wrap[ >].*?</table-wrap>", x, re.S):
        t = m.group(0); cap = strip((re.search(r"<caption>.*?</caption>", t, re.S) or [""])[0] if re.search(r"<caption>.*?</caption>", t, re.S) else "")
        rows = [[strip(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)] for r in re.findall(r"<tr[ >].*?</tr>", t, re.S)]
        out.append((cap, rows))
    return out
if __name__ == "__main__":
    c = sys.argv[1]
    if c == "search":
        q = sys.argv[2] + " AND OPEN_ACCESS:y AND HAS_FT:y"; n = sys.argv[3] if len(sys.argv) > 3 else "15"
        r = json.loads(get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode({"query": q, "format": "json", "pageSize": n})))
        for h in r["resultList"]["result"]: print(h.get("pmcid"), h.get("pubYear"), h.get("doi"), h.get("title", "")[:120])
    elif c == "tabs":
        for p in sys.argv[2:]:
            try: x = xml(p)
            except Exception as e: print(p, "ERR", e); continue
            print("##", p, strip((re.search(r"<article-title>.*?</article-title>", x, re.S) or [""])[0])[:100])
            for cap, rows in tables(x):
                if re.search(r"swell|modul|water uptake|mechanic|stiff|G'|rheolog", cap + " " + " ".join(rows[0] if rows else []), re.I): print("   T:", cap[:150], "|", rows[0][:8] if rows else "")
    elif c == "show":
        for cap, rows in tables(xml(sys.argv[2])):
            print("T:", cap[:200])
            for r in rows: print("   ", " | ".join(r))
    elif c == "grep":
        t = strip(xml(sys.argv[2]))
        for m in re.finditer(sys.argv[3], t, re.I): print("...", t[max(0, m.start()-250):m.end()+350], "\n")
