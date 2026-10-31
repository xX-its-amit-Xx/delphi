"""Does the fin-proportion literature hold measured fin-to-body ratios that the Physics thread could use (#50)?
Looks up the three fin-size papers in Europe PMC (open-access status, PMCID), fetches the full-text XML where it
is open, and writes genotype/cache/fin_ratios.json with every sentence or table cell mentioning a fin length,
ratio or proportion. Appends every call to genotype/cache/calls.json. No personal identifier is sent.
Usage: python -I genotype/fetch_fin_ratios.py
"""
import hashlib, json, os, re, time, urllib.parse, urllib.request, urllib.error
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, "cache"); LOG = os.path.join(CACHE, "calls.json")
UA = {"User-Agent": "delphisci-genotype-thread/0.2 (ScienceClaw hackathon; research use)"}
log = json.load(open(LOG)); calls = log["calls"]
def now(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
def call(name, url, dest=None):
    rec = {"name": name, "url": url, "method": "GET", "retrieved": now(), "by": "genotype/fetch_fin_ratios.py"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r: body = r.read(); rec["status"] = r.status
    except urllib.error.HTTPError as e: body = e.read(); rec["status"] = e.code; rec["error"] = str(e)
    except Exception as e: body = b""; rec["status"] = None; rec["error"] = repr(e)
    rec["bytes"] = len(body); rec["sha256"] = hashlib.sha256(body).hexdigest()
    if rec["status"] != 200: rec["body_head"] = body[:300].decode("utf8", "replace")
    if dest and rec["status"] == 200:
        open(dest, "wb").write(body); rec["saved_to"] = dest.replace("\\", "/")
    calls[:] = [c for c in calls if c["name"] != name] + [rec]; print(rec["status"], rec["bytes"], name, flush=True); return rec, body

PAPERS = {"24453984": "Perathoner 2014 kcnk5b (PLoS Genet)", "34061172": "Stewart 2021 longfin kcnh2a (Development)", "34534441": "Daane 2021 flying fishes lat4a kcnh2a (Curr Biol)"}
EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/"
KEY = re.compile(r"(fin|pectoral|wing)[^.]{0,120}(length|ratio|proportion|standard length|SL\b|body length|%|percent|mm\b)|(length|ratio|proportion)[^.]{0,80}(fin|pectoral)", re.I)
out = {"note": "Fin length / ratio / proportion mentions in the open full texts of the fin-size papers, for the Physics thread (#50). Sentences are quoted verbatim from the publisher XML via Europe PMC.", "papers": {}}
for pmid, label in PAPERS.items():
    rec, b = call(f"epmc_search_pmid_{pmid}", EPMC + "search?" + urllib.parse.urlencode({"query": f"EXT_ID:{pmid} AND SRC:MED", "format": "json", "resultType": "core"}))
    info = {"label": label, "pmid": pmid}
    try:
        r = json.loads(b)["resultList"]["result"][0]
        info.update({"pmcid": r.get("pmcid"), "doi": r.get("doi"), "isOpenAccess": r.get("isOpenAccess"), "hasSuppl": r.get("hasSuppl"), "title": r.get("title"), "journal": r.get("journalInfo", {}).get("journal", {}).get("title"), "year": r.get("pubYear")})
    except Exception as e:
        info["error"] = repr(e)[:200]
    time.sleep(0.4)
    if info.get("pmcid"):
        dest = os.path.join(CACHE, f"epmc_fulltext_{info['pmcid']}.xml")
        rec, b = call(f"epmc_fulltext_{info['pmcid']}", EPMC + f"{info['pmcid']}/fullTextXML", dest=dest)
        if rec["status"] != 200:
            # fallback: NCBI PMC efetch (author manuscripts come back in full; publisher-restricted ones as a stub)
            dest = os.path.join(CACHE, f"pmc_efetch_{info['pmcid']}.xml")
            rec, b = call(f"pmc_efetch_{info['pmcid']}", "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + urllib.parse.urlencode({"db": "pmc", "id": info["pmcid"], "retmode": "xml"}), dest=dest)
            if b and b"does not allow downloading of the full text" in b:
                info["fulltext"] = "publisher does not allow full-text XML download from PMC (stub only)"; rec["note"] = info["fulltext"]; b = b""
        if rec["status"] == 200 and b:
            try:
                root = ET.fromstring(b)
                text = " ".join(root.itertext())
                sents = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text))
                info["fin_sentences"] = [s.strip() for s in sents if KEY.search(s) and re.search(r"\d", s)][:80]
                tables = []
                for tw in root.iter("table-wrap"):
                    lab = (tw.findtext("label") or "") + " " + " ".join((tw.find("caption") or ET.Element("x")).itertext())
                    cells = [" | ".join(" ".join(td.itertext()).strip() for td in tr) for tr in tw.iter("tr")]
                    tables.append({"label": lab.strip(), "rows": cells[:40]})
                info["tables"] = tables
                info["supplementary"] = [{"label": (s.findtext("label") or ""), "href": s.get("{http://www.w3.org/1999/xlink}href") or next((m.get("{http://www.w3.org/1999/xlink}href") for m in s.iter("media")), None), "caption": " ".join((s.find("caption") or ET.Element("x")).itertext()).strip()[:300]}
                                         for s in root.iter("supplementary-material")]
                info["n_words"] = len(text.split())
            except ET.ParseError as e:
                info["parse_error"] = str(e)
        else:
            info["fulltext"] = f"not retrieved (HTTP {rec['status']})"
        time.sleep(0.4)
    # Data S1 of Daane 2021 (paired-fin and standard lengths of beloniform museum specimens). PMC's bin/ URL for
    # the author-manuscript copy answers with a reCAPTCHA page to this client (recorded on 2026-10-31), so the
    # publisher's own supplement file is fetched from the Elsevier CDN (PII S0960982221011908, mmc2.xlsx).
    if pmid == "34534441":
        dest = os.path.join(CACHE, "daane2021_data_s1_mmc2.xlsx")
        rec, b = call("elsevier_cdn_daane2021_mmc2_data_s1", "https://ars.els-cdn.com/content/image/1-s2.0-S0960982221011908-mmc2.xlsx", dest=dest)
        info["data_s1"] = {"file": "genotype/cache/daane2021_data_s1_mmc2.xlsx", "status": rec["status"], "bytes": rec["bytes"], "sha256": rec["sha256"], "retrieved": rec["retrieved"],
                           "is_xlsx": b[:2] == b"PK", "licence_note": "publisher supplementary data file of doi 10.1016/j.cub.2021.08.054; Crossref lists the Elsevier TDM user licence for the article; used for research, numbers quoted with attribution"}
        if not info["data_s1"]["is_xlsx"] and os.path.exists(dest): os.remove(dest); info["data_s1"]["note"] = "body was not a spreadsheet; file removed"
    out["papers"][pmid] = info
json.dump(out, open(os.path.join(CACHE, "fin_ratios.json"), "w"), indent=1)
log["calls"] = calls; json.dump(log, open(LOG, "w"), indent=1)
for pmid, i in out["papers"].items():
    print("==", i["label"], i.get("pmcid"), "OA", i.get("isOpenAccess"), "suppl", i.get("hasSuppl"), "words", i.get("n_words"), "tables", len(i.get("tables", [])), "suppl files", len(i.get("supplementary", [])))
    for s in i.get("fin_sentences", [])[:25]: print("  -", s[:300])
    for t in i.get("tables", []): print("  TABLE", t["label"][:150]); [print("     ", r[:200]) for r in t["rows"][:6]]
    for s in i.get("supplementary", []): print("  SUPPL", s["label"], s["href"], s["caption"][:150])
