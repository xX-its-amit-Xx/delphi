"""Write a manifest (url, retrieval date, bytes, sha256) of every file kept under data/bm-bps.
Run: python -I make_manifest.py
The URL for each file is in URLS below; Formlabs TDS URLs come from the earlier agent's table.
"""
import hashlib, json, os, datetime

ROOT = "D:/Users/ashenoy00000/delphi-work/data/bm-bps"
TDS_TABLE = "D:/Users/ashenoy00000/delphi-work/data/bm-bps/fltds/l2.tsv"
URLS = {
    "reg7.html": "https://www.legislation.gov.uk/uksi/2010/2214/regulation/7",
    "sched2.html": "https://www.legislation.gov.uk/uksi/2010/2214/schedule/2",
    "ADB2.pdf": "https://assets.publishing.service.gov.uk/media/6aa3bb7492e72b8ac437f145/AD_B2_2026.pdf",
    "AD7.pdf": "https://assets.publishing.service.gov.uk/media/5cf8d74fe5274a5f115e8778/AD_Regulation_7.pdf",
    "ADC.pdf": "https://assets.publishing.service.gov.uk/media/5a8192a0e5274a2e8ab54b5f/BR_PDF_AD_C_2013.pdf",
    "eurlex364.html": "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0364",
    "cpr305.html": "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32011R0305",
    "efectis_sbi.pdf": "https://efectis.com/app/uploads/2026/06/SBI_test_13823_2020A1_2022.pdf",
    "efectis_1182.pdf": "https://efectis.com/app/uploads/2021/06/Non_combustibility_ISO_1182_2020.pdf",
    "efectis_13501.pdf": "https://efectis.com/app/uploads/2020/10/Folder_13501_1_2018.pdf",
    "itecons117.pdf": "https://itecons.uc.pt/attachments/117",
    "inca.pdf": "https://www.inca-ltd.org.uk/wp-content/uploads/2017/07/INCA-Technical-Guide-02-Impact-Resistance-of-EWI-Systems.pdf",
    "fr.html": "https://formlabs.com/store/materials/flame-retardant-resin/",
    "web/fl_uv.html": "https://formlabs.com/white-papers/fuse-sls-powders-uv-resistance-aging-study/",
    "web/fl_sun.html": "https://formlabs.com/it/support/What-happens-to-prints-that-are-left-out-in-the-sun/",
    "web/fl_forum.html": "https://forum.formlabs.com/t/uv-stability-of-tough-1000-1500/46661",
    "web/t1500v2.pdf": "https://formlabs-media.formlabs.com/datasheets/25011041-TDS-ENUS-0.pdf",
    "web/buildup.html": "https://build-up.ec.europa.eu/en/resources-and-tools/publications/reviewing-test-protocols-opaque-adaptive-facades",
    "web/eurac.html": "https://www.eurac.edu/en/news/institute-for-renewable-energy/characterization-of-adaptive-opaque-facades",
    "web/tn24110.html": "https://www.technickenormy.cz/en/iso-ts-24110-2026-plastics-method-of-exposure-to-combined-uv-radiation-and-creep-load/",
    "web/evs_evs-en-iso-62-2008.html": "https://www.evs.ee/en/evs-en-iso-62-2008",
    "web/evs_evs-en-13561-2015.html": "https://www.evs.ee/en/evs-en-13561-2015",
    "web/evs_evs-en-iso-899-1-2017.html": "https://www.evs.ee/en/evs-en-iso-899-1-2017",
    "papers/PMC11604995.xml": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11604995/fullTextXML",
    "papers/PMC4383548.xml": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4383548/fullTextXML",
    "papers/PMC9227374.xml": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9227374/fullTextXML",
    "papers/PMC6279784.xml": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6279784/fullTextXML",
}
# Formlabs TDS PDFs t1..t25 (order of l2.tsv) plus x.pdf (Flame Retardant TDS)
if os.path.exists(TDS_TABLE):
    for i, line in enumerate(open(TDS_TABLE, encoding="utf8"), 1):
        parts = line.rstrip("\n").split("\t")
        URLS["fltds/t%d.pdf" % i] = parts[1]
URLS["fltds/x.pdf"] = "https://formlabs-media.formlabs.com/datasheets/2301750-TDS-ENUS-0_1.pdf"


import glob
for f in glob.glob(ROOT + "/web/evs_*.html"):
    rel = "web/" + os.path.basename(f)
    slug = os.path.basename(f)[4:-5]
    URLS.setdefault(rel, "https://www.evs.ee/en/" + slug)

rows = []
for rel, url in URLS.items():
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        continue
    b = open(p, "rb").read()
    rows.append({"file": rel, "url": url, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(),
                 "retrieved": "2026-11-12"})
total = sum(r["bytes"] for r in rows)
json.dump({"retrieved_utc_date": "2026-11-12", "total_bytes": total, "files": rows},
          open(os.path.join(ROOT, "MANIFEST.json"), "w", encoding="utf8"), indent=1)
print(len(rows), "files,", round(total / 1e6, 1), "MB")
