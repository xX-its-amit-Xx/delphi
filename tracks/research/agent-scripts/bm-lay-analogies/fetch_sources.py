"""Fetch the public pages used by bm-lay-analogies into data/bm-lay and write MANIFEST.json
(url, UTC date, bytes, sha256). Generic User-Agent; no login. Run: python fetch_sources.py"""
import urllib.request, hashlib, json, os, datetime, sys
OUT = "D:/Users/ashenoy00000/delphi-work/data/bm-lay"
os.makedirs(OUT, exist_ok=True)
SRC = {
 "formlabs_solvent.html": "https://formlabs.com/support/solvent-compatibility/",
 "reyssat_pmc.html": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/",
 "dawson1997_crossref.json": "https://api.crossref.org/works/10.1038/37745",
#"dawson1997_epmc.json": "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1038/37745&resultType=core&format=json",
#"elbaum2007_epmc.json": "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=%22hygroscopic%20movement%20of%20pine%20cone%20scales%22&resultType=core&format=json",
 "wiki_bimetallic_strip.json": "https://en.wikipedia.org/api/rest_v1/page/summary/Bimetallic_strip",
 "wiki_drop_unit.json": "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Drop_(unit)&format=json",
 "wiki_thermal_diffusivity.json": "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Thermal_diffusivity&format=json",
 "wiki_bimetal_full.json": "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Bimetallic_strip&format=json",
 "lean_tpil_intro.html": "https://lean-lang.org/theorem_proving_in_lean4/introduction.html",
 "wiki_thermal_diffusivity.html": "https://en.wikipedia.org/api/rest_v1/page/html/Thermal_diffusivity",
 "wiki_bimetallic.html": "https://en.wikipedia.org/api/rest_v1/page/html/Bimetallic_strip",
 "clear_v5_tds.pdf": "https://formlabs-media.formlabs.com/filer_public/dd/7f/dd7f3de9-55ae-4c82-ac52-408a4b5df64d/clear_resin_v5_tds___formlabs.pdf",
 "holstov2015.pdf": "https://ndownloader.figshare.com/files/69786426",
 "f80v2_tds.pdf": "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf",
}
extra = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
SRC.update(extra)
man_path = os.path.join(OUT, "MANIFEST.json")
man = json.load(open(man_path)) if os.path.exists(man_path) else {}
for name, url in SRC.items():
    p = os.path.join(OUT, name)
    if os.path.exists(p) and name in man:
        continue
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
        b = urllib.request.urlopen(req, timeout=60).read()
        open(p, "wb").write(b)
        man[name] = {"url": url, "fetched_utc": datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).isoformat() + "Z",
                     "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
        print("ok", name, len(b))
    except Exception as e:
        print("FAIL", name, e)
json.dump(man, open(man_path, "w"), indent=1)
