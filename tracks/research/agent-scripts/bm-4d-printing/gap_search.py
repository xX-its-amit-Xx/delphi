"""Reproducible gap searches in Europe PMC; writes results to scratch/gap_search.json. Run: python -I gap_search.py"""
import json, urllib.request, urllib.parse, datetime, time, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
H = '(humidity OR "relative humidity" OR hygroscopic OR hygromorph* OR "moisture-responsive" OR "moisture-driven" OR "humidity-responsive" OR "humidity-driven")'
Q = {
 "G1_vat_humidity_4D": f'TITLE_ABS:({H}) AND TITLE_ABS:("4D print*" OR "shape-morphing" OR "self-shaping" OR "self-folding" OR "bilayer actuator") AND TITLE_ABS:(stereolithography OR "vat photopolymerization" OR "digital light processing" OR "photocurable resin" OR "photopolymer resin" OR "liquid crystal display" OR "LCD printer")',
 "G2_sls_humidity_4D": f'TITLE_ABS:({H}) AND TITLE_ABS:("4D print*" OR "shape-morphing" OR "self-shaping" OR "bilayer actuator") AND TITLE_ABS:("selective laser sintering" OR "powder bed fusion" OR "multi jet fusion" OR "laser sintered" OR "laser-sintered")',
 "G3_formal_hygromorph": f'TITLE_ABS:({H}) AND TITLE_ABS:("proof assistant" OR "formal verification" OR "formally verified" OR "machine-checked" OR "Lean 4" OR "Coq proof" OR "Isabelle/HOL")',
 "G4_formal_bilayer_4D": 'TITLE_ABS:("4D print*" OR bilayer OR bimorph OR "bimetal*") AND TITLE_ABS:("proof assistant" OR "formal verification" OR "formally verified" OR "machine-checked" OR "Lean 4" OR "Coq proof" OR "Isabelle/HOL")',
 "G5_timoshenko_hygro_fulltext": f'"Timoshenko" AND {H} AND ("4D print*") AND (stereolithography OR "digital light processing" OR "vat photopolymerization" OR "selective laser sintering")',
 "C1_timoshenko_in_4D_title_abs": f'TITLE_ABS:(Timoshenko) AND TITLE_ABS:({H}) AND TITLE_ABS:("4D print*" OR "3D print*" OR "3D-print*" OR "additive manufactur*")',
}
out = {"date": datetime.date.today().isoformat(), "engine": "Europe PMC REST search", "queries": {}}
for k, q in Q.items():
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode({"query": q, "format": "json", "pageSize": 25, "resultType": "lite"})
    d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"}), timeout=60))
    out["queries"][k] = {"query": q, "hitCount": d["hitCount"], "hits": [{"doi": r.get("doi"), "pmcid": r.get("pmcid"), "year": r.get("pubYear"), "title": r.get("title")} for r in d["resultList"]["result"]]}
    print(k, d["hitCount"])
    for r in out["queries"][k]["hits"][:25]: print("   ", r["year"], r["doi"], "|", (r["title"] or "")[:100])
    time.sleep(1)
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-4d-printing/gap_search.json", "w", encoding="utf-8"), indent=1)
