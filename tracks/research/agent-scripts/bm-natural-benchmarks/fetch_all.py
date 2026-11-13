"""Re-fetch every source used by bm-natural-benchmarks and compare with the sha256 recorded in
D:/Users/ashenoy00000/delphi-work/data/natural-benchmarks/MANIFEST.json.
  python fetch_all.py --check   fetch to scratch dir, print MATCH / DIFFERENT per file (does not touch the data dir)
  python fetch_all.py           fetch into the data dir (overwrites) and rewrite MANIFEST.json + .txt siblings
Needs: Python 3 standard library; `pdftotext` (poppler) only for the arXiv PDF text sibling.
Pages that are generated dynamically (PMC html) may differ byte-for-byte while the text is unchanged: check with quotes.py."""
import sys, os, json, time, hashlib, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nb_fetch

D = nb_fetch.D
EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML"
SRC = {}
for p in ["PMC9284161", "PMC12219170", "PMC10037692", "PMC9353449", "PMC9478607", "PMC13210226", "PMC12304133",
          "PMC5056167", "PMC6164363", "PMC4733047", "PMC9623100", "PMC7805895", "PMC8252473", "PMC11468358", "PMC8664382"]:
    SRC[p + ".xml"] = EPMC % p
SRC["PMC2838359.html"] = "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/"
SRC["PMC3284132.html"] = "https://pmc.ncbi.nlm.nih.gov/articles/PMC3284132/"
SRC["arxiv_1110.0714.pdf"] = "https://arxiv.org/pdf/1110.0714v1"
SRC["arxiv_1110.0714_api.xml"] = "https://export.arxiv.org/api/query?id_list=1110.0714"
SRC["dawson_crossref.json"] = "https://api.crossref.org/works/10.1038/37745"
SRC["ulrich2024_epmc.json"] = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1088/1748-3190/ad475b&resultType=core&format=json"
for pmid in ("17495170", "21940888", "15674293"):
    SRC["pubmed_%s.xml" % pmid] = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=" + pmid

check = "--check" in sys.argv
man = json.load(open(os.path.join(D, "MANIFEST.json")))
for name, url in SRC.items():
    try:
        if check:
            b = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"}), timeout=90).read()
            h = hashlib.sha256(b).hexdigest()
            rec = man.get(name, {})
            print(("MATCH     " if rec.get("sha256") == h else "DIFFERENT ") + name, len(b), "bytes")
        else:
            print(nb_fetch.fetch(url, name), "bytes ->", name)
    except Exception as e:
        print("ERROR", name, e)
    time.sleep(1.2)  # NCBI allows ~3 requests/s without a key
if not check:
    os.system('pdftotext -layout "%s" "%s"' % (os.path.join(D, "arxiv_1110.0714.pdf"), os.path.join(D, "arxiv_1110.0714.pdf.txt")))
