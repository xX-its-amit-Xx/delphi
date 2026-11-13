"""Download the Vasquez 2021 Source Data (Europe PMC supplementary bundle, ~15 MB), extract the xlsx files,
and compute ONLY: row counts per condition (covariates), the size of the vertex-model sweep, and
WILD-TYPE solidity (the calibration group). It deliberately does NOT read outcome columns of the
Rab11a-GFP or claudin-knockout rows (those are held out in the design-lumen test).
Run: python 02_data_counts.py   (needs pandas + openpyxl)"""
import urllib.request, zipfile, io, os, hashlib, json, datetime, statistics as st
import pandas as pd
D = r"D:/Users/ashenoy00000/delphi-work/data/lumen-lay"
URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8460836/supplementaryFiles"
UA = {"User-Agent": "delphi-research/0.1"}
zpath = os.path.join(D, "vasquez_supp_bundle.zip")
if not os.path.exists(zpath):
    open(zpath, "wb").write(urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=300).read())
b = open(zpath, "rb").read()
out = {"url": URL, "date": datetime.date.today().isoformat(), "bundle_bytes": len(b), "bundle_sha256": hashlib.sha256(b).hexdigest()}
z = zipfile.ZipFile(zpath)
inner = [n for n in z.namelist() if n.endswith("MOESM6_ESM.zip")][0]
iz = zipfile.ZipFile(io.BytesIO(z.read(inner)))
xl = {}
for n in iz.namelist():
    if n.endswith(".xlsx") and "~$" not in n and not os.path.basename(n).startswith("._") and "__MACOSX" not in n:
        raw = iz.read(n); base = os.path.basename(n)
        open(os.path.join(D, base), "wb").write(raw)
        xl[base] = pd.ExcelFile(io.BytesIO(raw))
        out.setdefault("files", {})[base] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), sheets=xl[base].sheet_names)
f6 = xl["lumen_manuscript_figure6.xlsx"].parse("Nondimensionalized_data")
out["fig6_rows_per_condition"] = f6["condition"].value_counts().to_dict()
sw = xl["lumen_manuscript_figure5_SF5.xlsx"]
s = sw.parse(sw.sheet_names[0]); out["sweep_rows"] = int(len(s)); out["sweep_columns"] = list(s.columns)
# WT solidity from Fig 2 cldn-qKO sheet, WT rows only
f2 = xl["lumen_manuscript_figure2_SF2.xlsx"].parse("cldn-qKO")
wt = f2[f2["condition"] == "WT"]["solidity"].dropna().tolist()
q = st.quantiles(wt, n=4)
out["WT_solidity"] = dict(n=len(wt), median=round(st.median(wt), 3), q1=round(q[0], 3), q3=round(q[2], 3), min=round(min(wt), 3), max=round(max(wt), 3))
# WT lumens per cell count (Fig 6 num_cell_CS), WT only
w6 = f6[f6["condition"] == "WT"]["num_cell_CS"].dropna()
out["WT_cells_per_cross_section"] = dict(n=int(len(w6)), min=int(w6.min()), max=int(w6.max()), median=float(w6.median()))
json.dump(out, open(os.path.join(D, "counts.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
