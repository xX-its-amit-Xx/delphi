"""Thermally-thick ignition law vs FSRI cone data. See prereg.md.
Usage: python analyze.py dev|final [data_dir]
 dev   : reads cone outcomes of development materials only.
 final : also reads held-out materials (single final evaluation) and writes results_final.json."""
import csv, glob, hashlib, json, math, os, random, re, statistics as st, sys

MODE = sys.argv[1] if len(sys.argv) > 1 else "dev"
ROOT = (sys.argv[2] if len(sys.argv) > 2 else "C:/Temp/delphi-sprint/cs-fire-ignition/raw/files") + "/01_Data"
HERE = os.path.dirname(os.path.abspath(__file__))
T0, TFLOOR = 20.0, 250.0


def held(m):
    return int(hashlib.sha256(m.encode()).hexdigest(), 16) % 4 == 0


def text(p):
    b = open(p, "rb").read()
    return b.decode("utf-16", "replace") if b[:2] in (b"\xff\xfe", b"\xfe\xff") else b.decode("latin1")


def props(m):
    ks, cs = [], []
    for p in glob.glob(f"{ROOT}/{m}/HFM/*.tst"):
        b = os.path.basename(p).lower()
        if "_wet_" not in b:
            continue
        t = text(p)
        if "conduc" in b:
            ks += [float(x) for x in re.findall(r"Results (?:Upper|Lower):\s+([\d.]+)\s+W/mK", t)]
        elif "heatcapacity" in b:
            cs += [float(x) for x in re.findall(r"Specific Heat\s*:\s*([\d.]+)\s*J/", t)]
    ks = [k for k in ks if k > 0]
    cs = [c for c in cs if c > 0]
    if not ks or not cs:
        return None
    return st.mean(ks), st.mean(cs)


def cone(m):
    out = []
    for p in sorted(glob.glob(f"{ROOT}/{m}/Cone/*Scalar*.csv")):
        d = {}
        for row in csv.reader(open(p, encoding="latin1")):
            if len(row) >= 2 and row[0] not in d:
                d[row[0].strip()] = row[1].strip()
        try:
            q, t = float(d["HEAT FLUX"]), float(d["TIME TO IGN"])
        except (KeyError, ValueError):
            continue
        out.append((os.path.basename(p), q, t))
    return out


mats = sorted(os.listdir(ROOT))
P = {m: props(m) for m in mats}
elig = [m for m in mats if P[m] and glob.glob(f"{ROOT}/{m}/Cone/*Scalar*.csv")]
dev = [m for m in elig if not held(m)]
hold = [m for m in elig if held(m)]
print(f"materials in db {len(mats)}; with cone {sum(bool(glob.glob(f'{ROOT}/{m}/Cone/*Scalar*.csv')) for m in mats)}; "
      f"eligible (props+cone) {len(elig)}; dev {len(dev)}; held-out {len(hold)}")


def records(ms):
    R, noign = [], 0
    for m in ms:
        k, rc = P[m]
        for f, q, t in cone(m):
            if t > 0:
                R.append(dict(m=m, f=f, q=q, t=t, kpc=k * rc))
            else:
                noign += 1
    return R, noign


def base(r, kpc=None):  # log10 of (pi/4) kpc / q^2  with q in W/m2
    return math.log10(math.pi / 4 * (kpc or r["kpc"]) / (r["q"] * 1000) ** 2)


def rmse(e):
    return math.sqrt(sum(x * x for x in e) / len(e))


def implied_T(r):
    return T0 + r["q"] * 1000 * math.sqrt(4 * r["t"] / (math.pi * r["kpc"]))


def t1(R):
    viol = [r for r in R if r["t"] < 10 ** (base(r) + 2 * math.log10(TFLOOR - T0))]
    Ti = sorted(implied_T(r) for r in R)
    return dict(n=len(R), violations=len(viol), frac=round(len(viol) / len(R), 3),
                violating_materials=sorted({r["m"] for r in viol}),
                impliedTig_C_q10_q50_q90=[round(Ti[int(len(Ti) * f)]) for f in (0.1, 0.5, 0.9)],
                impliedTig_min_max=[round(Ti[0]), round(Ti[-1])])


def t3(R):
    out = []
    for m in sorted({r["m"] for r in R}):
        by = {}
        for r in R:
            if r["m"] == m:
                by.setdefault(r["q"], []).append(r["t"])
        if not {25.0, 50.0, 75.0} <= set(by):
            continue
        t = {q: st.mean(by[q]) for q in (25.0, 50.0, 75.0)}

        def r2(y):
            x = [25, 50, 75]; mx, my = 50, st.mean(y)
            b = sum((a - mx) * (c - my) for a, c in zip(x, y)) / 1250
            a0 = my - b * mx
            ss = sum((c - my) ** 2 for c in y)
            return (1 - sum((c - a0 - b * a) ** 2 for a, c in zip(x, y)) / ss if ss else float("nan")), (-a0 / b if b else float("nan"))
        r2k, qcr = r2([t[q] ** -0.5 for q in t])
        r2n, _ = r2([t[q] ** -1 for q in t])
        slope = (math.log(t[75.0]) - math.log(t[25.0])) / math.log(3)
        pk = ((t[25.0] ** -0.5 + t[75.0] ** -0.5) / 2) ** -2
        pn = ((t[25.0] ** -1 + t[75.0] ** -1) / 2) ** -1
        pg = math.sqrt(t[25.0] * t[75.0])
        # broken control: swapping the 25 and 75 labels leaves a midpoint interpolation unchanged,
        # so the control instead predicts t(25) by extrapolating from (50,75) with labels swapped
        out.append(dict(m=m, t25=t[25.0], t50=t[50.0], t75=t[75.0], r2_thick=r2k, r2_thin=r2n, q_cr_thick=qcr,
                        slope=slope, e_thick=abs(math.log10(pk / t[50.0])), e_thin=abs(math.log10(pn / t[50.0])),
                        e_geo=abs(math.log10(pg / t[50.0]))))
    if not out:
        return dict(n=0)
    med = lambda k: round(st.median(o[k] for o in out), 3)
    return dict(n=len(out), median_r2_thick=med("r2_thick"), median_r2_thin=med("r2_thin"),
                frac_r2_thick_ge_0p95=round(sum(o["r2_thick"] >= 0.95 for o in out) / len(out), 3),
                frac_r2_thin_ge_0p95=round(sum(o["r2_thin"] >= 0.95 for o in out) / len(out), 3),
                median_loglog_slope=med("slope"),
                slope_q25_q75=[round(sorted(o["slope"] for o in out)[int(len(out) * f)], 2) for f in (0.25, 0.75)],
                mid_abs_log10_err_mean=dict(thick=round(st.mean(o["e_thick"] for o in out), 3),
                                            thin=round(st.mean(o["e_thin"] for o in out), 3),
                                            geomean_baseline=round(st.mean(o["e_geo"] for o in out), 3)),
                thick_beats_thin=sum(o["e_thick"] < o["e_thin"] for o in out), rows=out)


Rd, noign_d = records(dev)
res = dict(mode=MODE, n_dev_materials=len(dev), n_holdout_materials=len(hold), dev_records=len(Rd),
           dev_no_ignition_records=noign_d)
# calibration on dev
resid = [math.log10(r["t"]) - base(r) for r in Rd]
two_log_dT = st.median(resid)
dT = 10 ** (two_log_dT / 2)
b0 = {q: st.mean(math.log10(r["t"]) for r in Rd if r["q"] == q) for q in {r["q"] for r in Rd}}
a1 = st.mean(math.log10(r["t"]) + 2 * math.log10(r["q"]) for r in Rd)
allmean = st.mean(math.log10(r["t"]) for r in Rd)


def score(R, perm=None):
    e_m = [math.log10(r["t"]) - (base(r, perm[r["m"]] if perm else None) + two_log_dT) for r in R]
    e0 = [math.log10(r["t"]) - b0.get(r["q"], allmean) for r in R]
    e1 = [math.log10(r["t"]) - (a1 - 2 * math.log10(r["q"])) for r in R]
    return rmse(e_m), rmse(e0), rmse(e1)


res["dev"] = dict(dT_eff_K=round(dT, 1), Tig_eff_C=round(dT + T0, 1), resid_sd_log10=round(st.pstdev(resid), 3),
                  rmse_model_B0_B1_in_sample=[round(x, 3) for x in score(Rd)], T1=t1(Rd),
                  T3={k: v for k, v in t3(Rd).items() if k != "rows"})
# leave-one-material-out on dev (honest dev estimate)
errs = []
for m in dev:
    tr = [math.log10(r["t"]) - base(r) for r in Rd if r["m"] != m]
    c = st.median(tr)
    errs += [math.log10(r["t"]) - base(r) - c for r in Rd if r["m"] == m]
res["dev"]["rmse_model_leave_one_material_out"] = round(rmse(errs), 3)
# per-material bias on dev: does the residual track kpc? (law says no)
xs = [math.log10(r["kpc"]) for r in Rd]
mx, my = st.mean(xs), st.mean(resid)
res["dev"]["slope_resid_vs_log10kpc"] = round(sum((x - mx) * (y - my) for x, y in zip(xs, resid)) / sum((x - mx) ** 2 for x in xs), 3)
res["dev"]["slope_log10t_vs_log10kpc_at_fixed_flux(law=1)"] = {}
for q in sorted(b0):
    S = [(math.log10(r["kpc"]), math.log10(r["t"])) for r in Rd if r["q"] == q]
    if len(S) > 5:
        ax, ay = st.mean(s[0] for s in S), st.mean(s[1] for s in S)
        res["dev"]["slope_log10t_vs_log10kpc_at_fixed_flux(law=1)"][str(q)] = round(
            sum((x - ax) * (y - ay) for x, y in S) / sum((x - ax) ** 2 for x, _ in S), 3)

if MODE == "final":
    Rh, noign_h = records(hold)
    m_, e0, e1 = score(Rh)
    rng = random.Random(20261113)
    hm = sorted({r["m"] for r in Rh})
    kp = {m: P[m][0] * P[m][1] for m in hm}
    perm_rmse = []
    for _ in range(200):
        v = [kp[m] for m in hm]
        rng.shuffle(v)
        perm_rmse.append(score(Rh, dict(zip(hm, v)))[0])
    T3h = t3(Rh)
    res["final"] = dict(n_records=len(Rh), n_materials=len(hm), no_ignition_records=noign_h,
                        rmse_log10_model=round(m_, 3), rmse_log10_B0_flux_mean=round(e0, 3),
                        rmse_log10_B1_flux_scaling=round(e1, 3),
                        shuffled_kpc_rmse_mean=round(st.mean(perm_rmse), 3),
                        shuffled_kpc_frac_worse_than_real=round(sum(p > m_ for p in perm_rmse) / 200, 3),
                        T1=t1(Rh), T3={k: v for k, v in T3h.items() if k != "rows"})
    with open(os.path.join(HERE, "holdout_t3_rows.csv"), "w", newline="") as f:
        if T3h.get("rows"):
            w = csv.DictWriter(f, fieldnames=list(T3h["rows"][0])); w.writeheader(); w.writerows(T3h["rows"])
    with open(os.path.join(HERE, "holdout_records.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["material", "file", "flux_kW_m2", "t_ig_s", "kpc_SI", "t_noloss_floor250C_s", "implied_Tig_C"])
        for r in Rh:
            w.writerow([r["m"], r["f"], r["q"], r["t"], round(r["kpc"]), round(10 ** (base(r) + 2 * math.log10(TFLOOR - T0)), 2), round(implied_T(r))])
with open(os.path.join(HERE, "dev_materials.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["material", "k_W_mK", "rho_c_J_m3K", "kpc", "split"])
    for m in elig:
        w.writerow([m, round(P[m][0], 4), round(P[m][1]), round(P[m][0] * P[m][1]), "holdout" if held(m) else "dev"])
json.dump(res, open(os.path.join(HERE, f"results_{MODE}.json"), "w"), indent=1)
print(json.dumps(res, indent=1))
