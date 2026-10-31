"""Extract Data S1 of Daane et al. 2021 (doi 10.1016/j.cub.2021.08.054; genotype/cache/daane2021_data_s1_mmc2.xlsx,
fetched by genotype/fetch_fin_ratios.py) into plain files for the Physics thread (#50):
  genotype/cache/daane2021_data_s1A_fin_measurements.csv   one row per museum specimen (sheet A, verbatim cells)
  genotype/cache/daane2021_fin_ratios.json                 per-species and per-group summaries computed from sheet A,
                                                           plus sheet G (convergent amino-acid substitutions) verbatim
No external library: the xlsx is read as the zip of XML it is. Offline. Usage: python -I genotype/fin_ratios_table.py
"""
import csv, hashlib, json, os, re, statistics, zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, "cache")
SRC = os.path.join(CACHE, "daane2021_data_s1_mmc2.xlsx")
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"; R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
z = zipfile.ZipFile(SRC)
ss = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")]
wb = ET.fromstring(z.read("xl/workbook.xml")); rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
sheets = {}
for sh in wb.find(M + "sheets"):
    t = rels[sh.get(R + "id")]; root = ET.fromstring(z.read("xl/" + t if not t.startswith("/") else t[1:]))
    rows = []
    for row in root.iter(M + "row"):
        cells = {}
        for c in row.findall(M + "c"):
            v = c.find(M + "v"); val = None
            if v is not None: val = ss[int(v.text)] if c.get("t") == "s" else v.text
            elif c.find(M + "is") is not None: val = "".join(x.text or "" for x in c.find(M + "is").iter(M + "t"))
            if val is not None: cells[re.match(r"[A-Z]+", c.get("r")).group(0)] = val
        if cells: rows.append(cells)
    sheets[sh.get("name")] = rows

A = sheets["A - fin measurement"]
hdr = A[0]; cols = list(hdr.keys())
assert hdr["B"] == "species" and hdr["E"].startswith("SL") and hdr["F"].startswith("pectoral") and hdr["H"] == "pectoral/SL", hdr
spec = []
for r in A[1:]:
    def num(x):
        try: return float(x)
        except (TypeError, ValueError): return None
    spec.append({"fish_no": r.get("A"), "species": (r.get("B") or "").strip(), "group": (r.get("C") or "").strip(), "mcz_catalog_no": r.get("D"),
                 "SL_cm": num(r.get("E")), "pectoral_cm": num(r.get("F")), "pelvic_cm": num(r.get("G")), "pectoral_over_SL_sheet": num(r.get("H")), "pelvic_over_SL_sheet": num(r.get("I"))})
with open(os.path.join(CACHE, "daane2021_data_s1A_fin_measurements.csv"), "w", newline="", encoding="utf8") as f:
    w = csv.DictWriter(f, fieldnames=list(spec[0].keys())); w.writeheader(); w.writerows(spec)

def summary(rows):
    r = [x for x in rows if x["SL_cm"] and x["pectoral_cm"]]
    ratios = [x["pectoral_cm"] / x["SL_cm"] for x in r]
    return {"n_specimens": len(r), "SL_cm_min": min(x["SL_cm"] for x in r), "SL_cm_max": max(x["SL_cm"] for x in r),
            "pectoral_over_SL_min": round(min(ratios), 3), "pectoral_over_SL_median": round(statistics.median(ratios), 3), "pectoral_over_SL_max": round(max(ratios), 3),
            "pectoral_over_SL_mean": round(statistics.fmean(ratios), 3)} if r else {"n_specimens": 0}
groups = sorted({x["group"] for x in spec}); species = sorted({(x["group"], x["species"]) for x in spec})
out = {"source": {"paper": "Daane JM et al. 2021, Modulation of bioelectric cues in the evolution of flying fishes, Curr Biol, doi 10.1016/j.cub.2021.08.054, PMID 34534441",
                  "file": "genotype/cache/daane2021_data_s1_mmc2.xlsx (publisher Data S1, sheet 'A - fin measurement')", "sha256": hashlib.sha256(open(SRC, "rb").read()).hexdigest(),
                  "what_was_measured": "paired fin and standard fish lengths of beloniform specimens in the Harvard Museum of Comparative Zoology (paper's STAR Methods); columns: SL (cm), pectoral (cm), pelvic (cm), pectoral/SL, pelvic/SL",
                  "caveats": ["lengths of preserved museum specimens, not live fish; no mass, no fin area, no aspect ratio, no glide data", "pectoral/SL recomputed here from the length columns; the sheet's own ratio column is kept beside it",
                              "one specimen row (fish 1) has a pelvic/SL cell of ~2.4e-16 in the sheet, an apparent spreadsheet artefact; the recomputed value is used", "species names as typed in the sheet"]},
       "sheet_header": hdr, "n_rows": len(spec), "groups": {g: summary([x for x in spec if x["group"] == g]) for g in groups},
       "species": [{"group": g, "species": s, **summary([x for x in spec if x["species"] == s and x["group"] == g])} for g, s in species],
       "sheet_G_convergent_substitutions": {"header": sheets["G - conv. aa subst."][0], "rows": sheets["G - conv. aa subst."][1:]},
       "other_sheets": {k: len(v) for k, v in sheets.items()}}
json.dump(out, open(os.path.join(CACHE, "daane2021_fin_ratios.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)
print(json.dumps({"n_rows": len(spec), "groups": out["groups"]}, indent=1))
for s in out["species"]: print(f'{s["group"]:28s} {s["species"]:32s} n={s["n_specimens"]:3d} SL {s.get("SL_cm_min")}-{s.get("SL_cm_max")} cm  pectoral/SL {s.get("pectoral_over_SL_min")}-{s.get("pectoral_over_SL_max")} (median {s.get("pectoral_over_SL_median")})')
G = out["sheet_G_convergent_substitutions"]
print("sheet G header:", G["header"]); [print("  ", r) for r in G["rows"][:50]]
