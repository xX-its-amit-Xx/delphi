"""Fetch the web sources used by t3-lumen-lay and record URL, date, bytes, sha256.
Run: python 01_fetch_sources.py   (needs only the Python standard library)
Writes into D:/Users/ashenoy00000/delphi-work/data/lumen-lay/ and a manifest json."""
import urllib.request, hashlib, json, os, datetime
OUT = r"D:/Users/ashenoy00000/delphi-work/data/lumen-lay"
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "delphi-research/0.1"}
SRC = {
 "vasquez_fulltext.xml": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8460836/fullTextXML",
 "crossref_vasquez.json": "https://api.crossref.org/works/10.1038/s41467-021-25050-3",
 "crossref_mukenhirn.json": "https://api.crossref.org/works/10.1016/j.devcel.2024.07.016",
 "crossref_lu.json": "https://api.crossref.org/works/10.1038/s41467-025-60780-8",
 "arxiv_guharay.xml": "https://export.arxiv.org/api/query?id_list=2509.04316",
 "datacite_zenodo.json": "https://api.datacite.org/dois/10.5281/zenodo.17055495",
 "crossref_guharay_prx.json": "https://api.crossref.org/works/10.1103/2y72-hnp2",
 "europepmc_mukenhirn.json": "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1016/j.devcel.2024.07.016&resultType=core&format=json",
}
man = []
for name, url in SRC.items():
    try:
        b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
        open(os.path.join(OUT, name), "wb").write(b)
        man.append(dict(file=name, url=url, date=datetime.date.today().isoformat(), bytes=len(b), sha256=hashlib.sha256(b).hexdigest(), ok=True))
    except Exception as e:
        man.append(dict(file=name, url=url, ok=False, error=str(e)))
json.dump(man, open(os.path.join(OUT, "manifest_web.json"), "w"), indent=1)
for m in man: print(m)
