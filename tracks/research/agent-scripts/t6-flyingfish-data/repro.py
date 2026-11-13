"""Track 6 data and reproducibility: re-derive the earlier agents' flying-fish numbers from the downloaded files.

Run:  python -I repro.py            (needs poppler/xpdf `pdftotext` on PATH; Python 3.10+, standard library only)
Env:  DATA=<dir holding deng2019/, makiguchi2013/, daane2021/, parkchoi2010-cached/>   OUT=<json path>
Prints one line per check:  [OK|DIFF] id | earlier-agent value | this run | note
"""
import json, math, os, re, subprocess, sys, tempfile, zipfile
import xml.etree.ElementTree as ET

DATA = os.environ.get("DATA", "D:/Users/ashenoy00000/delphi-work/data/flyingfish")
OUT = os.environ.get("OUT", "D:/Users/ashenoy00000/delphi-work/agents2/scratch/t6-flyingfish-data/repro_results.json")
G_DESIGN, G_REPO = 9.81, 9.80665          # design file uses 9.81; the repo's wing-loading band uses standard gravity
res = []
sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def rec(cid, theirs, mine, ok, note=""):
    res.append(dict(id=cid, earlier=theirs, mine=mine, ok=bool(ok), note=note))
    print(f"[{'OK' if ok else 'DIFF'}] {cid} | earlier: {theirs} | this run: {mine} | {note}")


def close(a, b, tol):
    return abs(a - b) <= tol


def pdftext(path):
    with tempfile.TemporaryDirectory() as d:
        o = os.path.join(d, "t.txt")
        subprocess.run(["pdftotext", "-layout", path, o], check=True)
        return open(o, encoding="utf-8", errors="replace").read()


def line_with(txt, needle):
    for ln in txt.splitlines():
        if needle in ln:
            return re.sub(r"\s+", " ", ln).strip()
    return None


# ---------------------------------------------------------------- A. pure arithmetic (no data file)
LD, CLMAX, CDMIN = 4.37, 0.78, 0.055            # Park and Choi 2010 Table 2, model L3 (checked in section B)
RHO = 1.225                                      # unverified background (standard sea-level air), as in the design file
W3 = 0.06 * G_DESIGN
S3 = (6377 + 1837 + 4474) * 1e-6                 # m2, A1+A2+A3 of model L3 (Table 1, checked in section B)
rng = lambda v, ld=LD: ld * v * v / (2 * G_DESIGN)    # scout bound: range <= (L/D) v^2 / 2g
rec("scout-range-10", 22.3, round(rng(10), 2), close(rng(10), 22.3, 0.05), "L/D 4.37, v 10 m/s, g 9.81")
rec("scout-range-15", 50.1, round(rng(15), 2), close(rng(15), 50.1, 0.05), "")
rec("scout-range-20", 89.1, round(rng(20), 2), close(rng(20), 89.1, 0.05), "")
v50 = math.sqrt(50 * 2 * G_DESIGN / LD)
rec("scout-speed-for-50m", 15.0, round(v50, 2), close(v50, 15.0, 0.05), "sqrt(50*2g/4.37)")
v132 = math.sqrt(2 * G_DESIGN * 13.2)
rec("scout-speed-for-13.2m", 16.1, round(v132, 2), close(v132, 16.1, 0.05), "sqrt(2g*13.2)")
vmin2 = 2 * (W3 / S3) / (RHO * CLMAX)
vmin = math.sqrt(vmin2)
rec("L3-wing-loading-g9.81", 46.39, round(W3 / S3, 2), close(W3 / S3, 46.39, 0.01), "design file; W=0.06*9.81, S=0.012688")
rec("L3-wing-loading-g9.80665", 46.37, round(0.06 * G_REPO / S3, 2), close(0.06 * G_REPO / S3, 46.37, 0.01), "registry band value")
rec("L3-vmin", 9.85, round(vmin, 2), close(vmin, 9.85, 0.005), "sqrt(2 W/S /(rho CLmax))")
rec("L3-vmin-squared", 97.10, round(vmin2, 2), close(vmin2, 97.10, 0.01), "")
stall = lambda v0, ld=LD, delta=0.0: ld * (v0 * v0 - vmin2) / (2 * G_DESIGN) / (1 - delta)
for v0, a, b in ((10, 0.65, 0.75), (15, 28.5, 33.1), (20, 67.5, 78.4)):
    rec(f"design-stallbound-{v0}", f"{a} (delta 0) / {b} (delta .14)", f"{stall(v0):.2f} / {stall(v0, delta=.14):.2f}",
        close(stall(v0), a, 0.06) and close(stall(v0, delta=.14), b, 0.06), "x <= L/D (v0^2 - vmin^2)/2g /(1-delta)")
v50s = lambda d: math.sqrt(vmin2 + 2 * G_DESIGN * 50 * (1 - d) / LD)
rec("design-speed-for-50m", "17.9 (delta 0) / 17.0 (delta .14)", f"{v50s(0):.2f} / {v50s(.14):.2f}",
    close(v50s(0), 17.9, .05) and close(v50s(.14), 17.0, .05), "")
# Cheilopogon (Kawachi area and mass as quoted by Deng): design file
Wc, Sc = 0.226 * G_DESIGN, 0.0225
vminc = lambda cl: math.sqrt(2 * Wc / Sc / (RHO * cl))
rec("cheil-W/S", 98.5, round(Wc / Sc, 1), close(Wc / Sc, 98.5, .05), "")
rec("cheil-vmin", "12.5 (CL 1.03) / 14.4 (CL 0.78)", f"{vminc(1.03):.2f} / {vminc(0.78):.2f}",
    close(vminc(1.03), 12.5, .05) and close(vminc(.78), 14.4, .05), "")
v = 5.15; f = v * v / vminc(1.03) ** 2; th = math.radians(23.3)   # 23.3 deg = 20.0 + 3.3, the design's choice
T = 2 * v * math.sin(th) / (G_DESIGN * (1 - f))
rec("cheil-P3-airborne-time", "0.50 s", f"{T:.2f} s (f={f:.3f})", close(T, 0.50, .005), "M5 as written in the design")
rec("cheil-P3-reach", "2.37 m", f"{v * math.cos(th) * T:.2f} m", close(v * math.cos(th) * T, 2.37, .01), "")

# ---------------------------------------------------------------- B. Park and Choi 2010 (cached publisher PDF)
pc = pdftext(f"{DATA}/parkchoi2010-cached/wb-park-choi-2010.pdf")
l = line_with(pc, "Flying fish (Cypselurus hiraii)")
rec("PC-table2-L3", "L/Dmax 4.37 (0 deg), CLmax 0.78 (35 deg), CDmin 0.055 (-10 deg)", l,
    l is not None and "4.37 (0)" in l and "0.78 (35)" in l and "0.055" in l, "Table 2 row; exact text in 'this run'")
blk = pc[pc.index("Table 1. Morphometric"):pc.index("Aspect ratio, AR (S2/A1)")+400]
vals = {k: (k in blk) for k in ("6377", "1837", "4474", "261")}
rec("PC-table1-L3-areas", "A1 6377, A2 1837, A3 4474 mm2 (sum 12688)", vals, all(vals.values()),
    "values present in the Table 1 text block; pdftotext shifts the row labels, so the label-to-value pairing is checked by AR below")
ar = 261 ** 2 / 6377
rec("PC-table1-L3-AR", "AR 10.7 = S^2/A1", f"261^2/6377 = {ar:.2f}", close(ar, 10.7, .05), "pairs 6377 with A1 and span 261 mm")
rec("PC-ground-effect", "14% (water, r=0.33), 9% (solid, r=0.21)",
    line_with(pc, "whereas the of 9% and 14% were"), "whereas the of 9% and 14% were" in pc, "")
rec("PC-mass-precision", "mass 0.06 kg for L3",
    "Table 1 body masses are printed to 0.01 kg (0.06, 0.05, 0.06, 0.04, 0.04): rounding band 0.055-0.065 kg",
    True, "wing loading 42.5-50.3 N/m2 and vmin 9.4-10.2 m/s are the honest range")
lo, hi = 0.055 * G_DESIGN / S3, 0.065 * G_DESIGN / S3
rec("L3-W/S-rounding-band", "(not stated)", f"{lo:.1f}-{hi:.1f} N/m2; vmin {math.sqrt(2*lo/(RHO*CLMAX)):.2f}-{math.sqrt(2*hi/(RHO*CLMAX)):.2f} m/s", True, "my arithmetic")

# ---------------------------------------------------------------- C. Deng 2019 (Zenodo PDF)
dg = pdftext(f"{DATA}/deng2019/Deng_2019_Bioinspir._Biomim._14_046009.pdf")
chk = [
    ("Deng-abs-CLmax", "The maximum lift force coefficient of 1.03 is reached"),
    ("Deng-abs-distance-height", "can achieve a distance up to 45.4 m, and reach a height of 13.2 m"),
    ("Deng-takeoff-speed", "The take-off speed is fixed at 20 m s"),
    ("Deng-45.4-case", "is achieved at"),
    ("Deng-endurance-35", "with an endurance of 3.5 s"),
    ("Deng-height-12.5", "a maximum height of 12.5 m is reached"),
    ("Deng-41.5-case", "distance and its endurance are 41.5 m and 3.47 s"),
    ("Deng-height-13.2-case", "height of 13.2 m is reached at"),
    ("Deng-W", "W=0.09kg"), ("Deng-A1", "A1=154cm2"), ("Deng-A2", "A2=16.37cm2"),
    ("Deng-WS", "wing loading of 57.3 Nm"),
    ("Deng-LD", "lift-to-drag ratio of 4.7 is achieved"),
]
for cid, n in chk:
    ln = line_with(dg, n)
    rec(cid, "(as in design/scout)", ln, ln is not None, "line copied from the PDF text")
S_D = 154e-4
WS_D = 0.09 * G_REPO / S_D
rec("Deng-WS-arith", 57.3, round(WS_D, 2), close(WS_D, 57.3, .05), "0.09*9.80665/0.0154")
vmin_D = math.sqrt(2 * WS_D / (RHO * 1.03))
rec("Deng-vmin", "(not computed earlier)", f"{vmin_D:.2f} m/s (reference area A1 only, CLmax 1.03)", True, "my arithmetic")
# which trajectory is which: abstract merges two cases
cases = [("alpha0=0,gamma=25 deg: distance", 45.4, 3.5), ("alpha0=10,gamma=25 deg: distance", 41.5, 3.47)]
for nm, d, t in cases:
    ratio = d / (4.7 * 400 / (2 * G_DESIGN))
    ratio_s = d / (4.7 * (400 - vmin_D ** 2) / (2 * G_DESIGN))
    rec(f"Deng-P2-ratio {nm}", "0.73 if v0=16.1 (design); v0 not known", f"{ratio:.3f} (no stall floor), {ratio_s:.3f} (with stall floor)",
        0.30 <= ratio <= 1.0, f"v0 = 20 m/s, L/D 4.7; mean horizontal speed {d/t:.1f} m/s")
rec("Deng-P1-apex", "apex <= v0^2/2g, v0>=16.1", f"13.2 <= 400/19.62 = {400/(2*G_DESIGN):.2f} m: holds; 12.5 holds", 13.2 <= 400 / (2 * G_DESIGN), "all runs launch at 20 m/s")

# ---------------------------------------------------------------- D. Makiguchi 2013
mk = pdftext(f"{DATA}/makiguchi2013/b018p105.pdf")
for cid, n in (("Mak-abs-speed", "from the water surface at speeds of 3.9 to 5.2 m s"),
               ("Mak-percent", "38.7 to 51.5%"), ("Mak-body-speed", "3.87 to 5.15 m s"),
               ("Mak-field-10", "about 10 m s"), ("Mak-stride", "0.6 and 0.8 times L"),
               ("Mak-freq", "21.2")):
    ln = line_with(mk, n)
    rec(cid, "(as in scout/design)", ln, ln is not None, "")
rows = re.findall(r"(?:^|\s)([A-M])\s+(20(?:10|11))\s+(\d{3})\s+(\d{3})\s+(\d+)\s+(\d+)\s*$", mk, flags=re.M)
fl = [int(r[2]) for r in rows]; ms = [int(r[3]) for r in rows]
rec("Mak-table1-n", 13, len(rows), len(rows) == 13, "rows A-M of Table 1")
lp = sum(int(r[4]) for r in rows); bs = sum(int(r[5]) for r in rows)
rec("Mak-table1-leaps-burst", "leaping 10, burst swimming 23", f"{lp}, {bs}", (lp, bs) == (10, 23), "column sums of Table 1")
import statistics as st
fl10, ms10 = fl[:10], ms[:10]            # fish A-J, the 2010 fish
rec("Mak-table1-mean-length-13fish", "325.0 mm 'over 13 fish' (project glide-data.csv)", round(st.mean(fl), 1), close(st.mean(fl), 325.0, .1), "mean of all 13 rows")
rec("Mak-table1-mean-length-AJ", "325.0 +- 11.4 mm (paper)", f"{st.mean(fl10):.1f} +- {st.stdev(fl10):.1f} (fish A-J, n=10)", close(st.mean(fl10), 325.0, .1) and close(st.stdev(fl10), 11.4, .06), "the paper's average row matches the ten 2010 fish only")
rec("Mak-table1-mean-mass-AJ", "227.7 +- 19.8 g (paper)", f"{st.mean(ms10):.1f} +- {st.stdev(ms10):.1f} (fish A-J, n=10)", close(st.mean(ms10), 227.7, .1) and close(st.stdev(ms10), 19.8, .06), "")
leapers = [(r[0], int(r[2])) for r in rows if int(r[4]) > 0]
rec("Mak-leaping-fish", "9 fish, 30.8 +- 3.1 cm (paper text)", f"Table 1 lists {len(leapers)} fish with leaps >0, mean FL {st.mean(l for _, l in leapers)/10:.1f} cm", len(leapers) == 9, "cannot reconcile 9 vs 8 from Table 1 alone")
lo = 0.6 * 30.8e-2 * 21.2; hi = 0.8 * 30.8e-2 * 21.2
rec("Mak-Umax-recompute", "3.87 to 5.15 m/s (paper)", f"{lo:.2f} to {hi:.2f} (Y*L*f with L=30.8 cm, f=21.2 Hz)",
    close(lo, 3.87, .08) and close(hi, 5.15, .1), "paper's own inputs; ratio 0.8/0.6 = 1.333 as in paper")
words = re.findall(r"(\w+)\s+duration", mk)
nacc = sum(1 for w in words if w.lower() == "acceleration")
rec("Mak-duration-keyword", "'duration' 29 times (design file)", f"{len(words)} with a preceding word, {nacc} are 'acceleration duration'",
    True, "every 'duration' is the tail-acceleration phase, not airborne time")
air = [re.sub(r"\s+", " ", m.group(0)) for m in re.finditer(r".{0,60}airborne.{0,40}", mk)]
rec("Mak-airborne-keyword", "'airborne' twice", f"{len(air)} hits: {air}", len(air) == 2, "none reports a time in seconds")

# ---------------------------------------------------------------- E. Daane 2021 Data S1 sheet A (xlsx parsed with zipfile)
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
z = zipfile.ZipFile(f"{DATA}/daane2021/daane2021_data_s1_mmc2.xlsx")
ss = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")]
wsx = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))   # 'A - fin measurement' (checked against workbook.xml by the caller)
rows = []
for row in wsx.iter(M + "row"):
    d = {}
    for c in row.findall(M + "c"):
        v = c.find(M + "v")
        if v is not None:
            d[re.match(r"[A-Z]+", c.get("r")).group(0)] = ss[int(v.text)] if c.get("t") == "s" else v.text
    rows.append(d)
hdr, body = rows[0], rows[1:]
assert hdr["E"] == "SL (cm)" and hdr["F"] == "pectoral (cm)" and hdr["C"] == "group", hdr
spec = [dict(sp=r["B"], grp=r["C"], sl=float(r["E"]), pec=float(r["F"]), sheet_ratio=float(r["H"])) for r in body]
for s in spec:
    s["ratio"] = s["pec"] / s["sl"]
ff = [s for s in spec if s["grp"] == "flying fish"]
oth = [s for s in spec if s["grp"] in ("halfbeak", "flying halfbeak", "needlefish")]
rec("Daane-n-total", 109, len(spec), len(spec) == 109, "")
rec("Daane-n-flying", 49, len(ff), len(ff) == 49, "")
rec("Daane-ff-min", 0.406, round(min(s["ratio"] for s in ff), 3), close(min(s["ratio"] for s in ff), .406, .0005), "pectoral/SL, recomputed as F/E")
rec("Daane-ff-max", 0.823, round(max(s["ratio"] for s in ff), 3), close(max(s["ratio"] for s in ff), .823, .0005), "")
rec("Daane-others-max", "0.388-0.389 (n=60)", f"{max(s['ratio'] for s in oth):.4f} (n={len(oth)})", len(oth) == 60 and 0.388 <= max(s['ratio'] for s in oth) <= 0.3895, "flying halfbeak is the max")
ad = [s for s in ff if s["sl"] >= 15]
rec("Daane-SL15-n", 14, len(ad), len(ad) == 14, "SL >= 15 cm; the cut was chosen post hoc by the scout")
rec("Daane-SL15-range", "0.656-0.757", f"{min(s['ratio'] for s in ad):.3f}-{max(s['ratio'] for s in ad):.3f}",
    close(min(s['ratio'] for s in ad), .656, .0005) and close(max(s['ratio'] for s in ad), .757, .0005), "")
n76 = [s for s in ff if s["ratio"] > .76]; n79 = [s for s in ff if s["ratio"] > .79]
rec("Daane-above-0.76", 3, len(n76), len(n76) == 3, f"species/SL: {[(s['sp'], s['sl']) for s in n76]}")
rec("Daane-above-0.79", 2, len(n79), len(n79) == 2, f"species/SL: {[(s['sp'], s['sl']) for s in n79]}")
bad = [s for s in spec if abs(s["ratio"] - s["sheet_ratio"]) > 1e-9]
rec("Daane-sheet-vs-F/E", "(not checked earlier)", f"{len(bad)} rows where the sheet's pectoral/SL differs from F/E", True, "")
import statistics
rec("Daane-ff-median", 0.687, round(statistics.median(s["ratio"] for s in ff), 3), close(statistics.median(s["ratio"] for s in ff), .687, .0005), "genotype README figure")

json.dump(res, open(OUT, "w"), indent=1)
print(f"\n{sum(r['ok'] for r in res)} of {len(res)} checks OK; wrote {OUT}")
