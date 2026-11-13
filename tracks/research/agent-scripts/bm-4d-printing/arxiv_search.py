"""arXiv export API search. Usage: python -I arxiv_search.py '<search_query>' [n]   e.g. 'all:hygromorph AND all:Lean'"""
import sys, urllib.request, urllib.parse, re, html
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
q = sys.argv[1]; n = sys.argv[2] if len(sys.argv) > 2 else "10"
u = "http://export.arxiv.org/api/query?" + urllib.parse.urlencode({"search_query": q, "max_results": n})
t = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "delphi-research/0.1"}), timeout=60).read().decode()
print("total", re.search(r"<opensearch:totalResults[^>]*>(\d+)", t).group(1))
for e in re.findall(r"<entry>(.*?)</entry>", t, flags=re.S):
    print(re.search(r"<id>(.*?)</id>", e).group(1), "|", html.unescape(re.sub(r"\s+", " ", re.search(r"<title>(.*?)</title>", e, flags=re.S).group(1))))
