#!/usr/bin/env python
"""cs-allometry-fins: Strouhal band (A) and Bainbridge linearity (B) with whole-species holdout.

One command, from a clean folder:
    python -P -E run.py --stage all
Stages: dev (development species only), final (single held-out evaluation), all (dev then final).
Data are downloaded to DATA (default C:/Temp/delphi-sprint/cs-allometry-fins/raw) if missing.
Needs: python 3, openpyxl, internet. No credentials.
"""
import argparse, csv, hashlib, io, json, math, os, random, statistics, sys, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = {
    # Di Santo et al. 2021 PNAS, data deposit (Zenodo mirror of Dryad 10.5061/dryad.bg79cnp9x)
    "disanto/Megakine.csv": "https://zenodo.org/api/records/5646507/files/Megakine.csv/content",
    # Sanchez-Rodriguez et al. 2023 Nat Commun, supplementary files via Europe PMC (PMC10492801)
    "PMC10492801.zip": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10492801/supplementaryFiles",
}
SANCHEZ_XLSX = "41467_2023_41368_MOESM3_ESM.xlsx"
# Allow-list of clade labels kept from the Sanchez-Rodriguez table (pre-registered classes).
# Every label not listed here is dropped without being read further.
ALLOW = {"Ray-finned fishes": "fish", "Cartilaginous fishes": "fish", "Lampreys": "fish",
         "Placentals": "mammal", "Frogs": "amphibian", "Crocodilians": "reptile", "Snakes": "reptile"}
BAND = (0.2, 0.4)


def fetch(data):
    os.makedirs(os.path.join(data, "disanto"), exist_ok=True)
    for rel, url in SRC.items():
        p = os.path.join(data, rel)
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            req = urllib.request.Request(url, headers={"User-Agent": "research-script/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r, open(p, "wb") as f:
                f.write(r.read())


def species_key(name):
    s = " ".join(str(name).replace("_", " ").lower().split())
    return " ".join(s.split(" ")[:2])


def held_out(key):
    return int(hashlib.sha256(key.encode("utf-8")).hexdigest(), 16) % 5 == 0


def load(data):
    recs = []
    with open(os.path.join(data, "disanto/Megakine.csv"), encoding="utf-8", errors="replace") as f:
        for i, r in enumerate(csv.DictReader(f)):
            try:
                tbf, ubl, st = float(r["TBF"]), float(r["UsBL"]), float(r["St"])
                amp_m, u = float(r["tailAmp.m"]), float(r["U"])
                tl = float(r["TL"])
            except (ValueError, KeyError):
                continue
            if not all(map(math.isfinite, (tbf, ubl, st, amp_m, u))) or ubl <= 0:
                continue
            recs.append(dict(src="disanto", id="disanto:%s" % r["clip_id"], sp=species_key(r["species"]),
                             group="fish", f=tbf, ubl=ubl, St=st, A=amp_m, U=u, L=tl / 100.0,
                             mode=r["Swimmingmode"], Re=float(r["Re"])))
    import openpyxl
    z = zipfile.ZipFile(os.path.join(data, "PMC10492801.zip"))
    wb = openpyxl.load_workbook(io.BytesIO(z.read(SANCHEZ_XLSX)), read_only=True)
    dropped = 0
    for i, r in enumerate(wb["L f U"].iter_rows(min_row=2, values_only=True)):
        clade = str(r[0])
        if clade not in ALLOW:
            dropped += 1
            continue
        try:
            L, f_, U = float(r[2]), float(r[3]), float(r[4])
        except (TypeError, ValueError):
            dropped += 1
            continue
        if L <= 0 or U <= 0 or f_ <= 0:
            dropped += 1
            continue
        recs.append(dict(src="sanchez", id="sanchez:%d" % (i + 2), sp=species_key(r[1]), group=ALLOW[clade],
                         f=f_, ubl=U / L, U=U, L=L))
    for r in recs:
        r["held"] = held_out(r["sp"])
    return recs, dropped


def ols(x, y):
    n = len(x); mx = sum(x) / n; my = sum(y) / n
    sxx = sum((a - mx) ** 2 for a in x); sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    b = sxy / sxx; a = my - b * mx
    sse = sum((yy - a - b * xx) ** 2 for xx, yy in zip(x, y)); sst = sum((yy - my) ** 2 for yy in y)
    return a, b, 1 - sse / sst


def rmse(pred, y):
    return math.sqrt(sum((p - t) ** 2 for p, t in zip(pred, y)) / len(y))


def wilson(k, n, z=1.96):
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (round(c - h, 3), round(c + h, 3))


def cover(sts, band):
    return sum(1 for s in sts if band[0] <= s <= band[1])


def sp_means(rows, key):
    d = {}
    for r in rows:
        d.setdefault(r["sp"], []).append(r[key])
    return {k: sum(v) / len(v) for k, v in d.items()}


def stage_dev(recs):
    dev = [r for r in recs if not r["held"]]
    out = {"stage": "dev"}
    out["counts"] = {
        "records_total": len(recs), "species_total": len({r["sp"] for r in recs}),
        "dev_records": len(dev), "dev_species": len({r["sp"] for r in dev}),
        "heldout_records": len(recs) - len(dev), "heldout_species": len({r["sp"] for r in recs if r["held"]}),
        "heldout_records_with_St": sum(1 for r in recs if r["held"] and "St" in r),
        "heldout_species_with_St": len({r["sp"] for r in recs if r["held"] and "St" in r}),
    }
    # --- A on dev
    a = [r for r in dev if "St" in r]
    sts = [r["St"] for r in a]
    recomputed = max(abs(r["f"] * r["A"] / r["U"] - r["St"]) for r in a)
    med = statistics.median(sts)
    w = math.sqrt(BAND[1] / BAND[0])  # same log-width as 0.2-0.4 (ratio 2)
    devband = (med / w, med * w)
    spm = sp_means(a, "St")
    by_mode = {}
    for r in a:
        by_mode.setdefault(r["mode"], []).append(r["St"])
    out["A_dev"] = {
        "n_records": len(a), "n_species": len(spm), "St_recompute_max_abs_diff": recomputed,
        "inside_0.2_0.4": cover(sts, BAND), "frac_inside": round(cover(sts, BAND) / len(a), 3),
        "frac_below_0.2": round(sum(s < 0.2 for s in sts) / len(a), 3),
        "frac_above_0.4": round(sum(s > 0.4 for s in sts) / len(a), 3),
        "median_St": round(med, 3), "quartiles": [round(q, 3) for q in statistics.quantiles(sts, n=4)],
        "min": round(min(sts), 3), "max": round(max(sts), 3),
        "dev_tuned_band": [round(devband[0], 3), round(devband[1], 3)],
        "frac_inside_dev_tuned_band": round(cover(sts, devband) / len(a), 3),
        "species_means_inside": cover(spm.values(), BAND), "species_means_frac": round(cover(spm.values(), BAND) / len(spm), 3),
        "by_mode": {m: {"n": len(v), "median": round(statistics.median(v), 3), "frac_inside": round(cover(v, BAND) / len(v), 3)} for m, v in by_mode.items()},
        "zebrafish_adult_rows_in_dev": [dict(St=round(r["St"], 3), Re=round(r["Re"]), L_m=r["L"]) for r in a if r["sp"] == "danio rerio"],
        "spearman_St_vs_ubl": round(spearman([r["ubl"] for r in a], sts), 3),
    }
    # --- B on dev
    x = [r["ubl"] for r in dev]; y = [r["f"] for r in dev]
    a0, b0, r2 = ols(x, y)
    fish = [r for r in dev if r["group"] == "fish"]
    af, bf, r2f = ols([r["ubl"] for r in fish], [r["f"] for r in fish])
    bain = [4 / 3 + (4 / 3) * xx for xx in x]
    out["B_dev"] = {
        "n_records": len(dev), "n_species": len({r["sp"] for r in dev}),
        "fit_all": {"intercept_Hz": round(a0, 4), "slope_Hz_per_BLs": round(b0, 4), "R2": round(r2, 3)},
        "fit_fish_only": {"n": len(fish), "intercept_Hz": round(af, 4), "slope_Hz_per_BLs": round(bf, 4), "R2": round(r2f, 3)},
        "implied_U_over_L_per_Hz": round(1 / b0, 3),
        "bainbridge_line": "f = 4/3 + (4/3)*U/L (i.e. U/L = 0.75*(f - 4/3))",
        "rmse_dev_fit": round(rmse([a0 + b0 * xx for xx in x], y), 3),
        "rmse_dev_mean": round(rmse([sum(y) / len(y)] * len(y), y), 3),
        "rmse_dev_bainbridge": round(rmse(bain, y), 3),
        "f_range": [round(min(y), 3), round(max(y), 3)], "ubl_range": [round(min(x), 3), round(max(x), 3)],
        "spearman_f_vs_ubl": round(spearman(x, y), 3),
    }
    out["model"] = {"a": a0, "b": b0, "mean_f": sum(y) / len(y), "devband": devband}
    return out


def rank(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0] * len(v); i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
            j += 1
        for k in range(i, j + 1):
            r[o[k]] = (i + j) / 2.0
        i = j + 1
    return r


def spearman(x, y):
    rx, ry = rank(x), rank(y); n = len(x); mx = sum(rx) / n; my = sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den


def stage_final(recs, model):
    ho = [r for r in recs if r["held"]]
    out = {"stage": "final", "heldout_species": sorted({r["sp"] for r in ho})}
    rng = random.Random(20261114)
    # --- A
    a = [r for r in ho if "St" in r]
    sts = [r["St"] for r in a]; n = len(a)
    k = cover(sts, BAND); kb = cover(sts, model["devband"])
    perm = []
    for _ in range(2000):
        fs = [r["f"] for r in a]; rng.shuffle(fs)
        perm.append(cover([f * r["A"] / r["U"] for f, r in zip(fs, a)], BAND) / n)
    spm = sp_means(a, "St")
    out["A_final"] = {
        "metric": "fraction of held-out records with 0.2 <= St <= 0.4", "n_records": n, "n_species": len(spm),
        "inside": k, "frac_inside": round(k / n, 3), "wilson95": wilson(k, n),
        "frac_below_0.2": round(sum(s < 0.2 for s in sts) / n, 3), "frac_above_0.4": round(sum(s > 0.4 for s in sts) / n, 3),
        "median_St": round(statistics.median(sts), 3), "min": round(min(sts), 3), "max": round(max(sts), 3),
        "baseline_dev_tuned_band": [round(model["devband"][0], 3), round(model["devband"][1], 3)],
        "baseline_frac_inside": round(kb / n, 3),
        "shuffled_f_frac_inside_mean": round(sum(perm) / len(perm), 3),
        "shuffled_f_share_of_perms_at_or_above_real": round(sum(p >= k / n for p in perm) / len(perm), 4),
        "species_means": {s: round(v, 3) for s, v in sorted(spm.items())},
        "species_means_inside": cover(spm.values(), BAND),
        "zebrafish_adult_rows_in_heldout": [dict(St=round(r["St"], 3), Re=round(r["Re"]), L_m=r["L"]) for r in a if r["sp"] == "danio rerio"],
    }
    # --- B
    def bscore(rows, tag):
        x = [r["ubl"] for r in rows]; y = [r["f"] for r in rows]
        fit = [model["a"] + model["b"] * xx for xx in x]
        pr = []
        for _ in range(2000):
            ys = y[:]; rng.shuffle(ys); pr.append(rmse(fit, ys))
        return {"subset": tag, "n_records": len(rows), "n_species": len({r["sp"] for r in rows}),
                "rmse_dev_fitted_line_Hz": round(rmse(fit, y), 3),
                "rmse_baseline_dev_mean_Hz": round(rmse([model["mean_f"]] * len(y), y), 3),
                "rmse_baseline_bainbridge_Hz": round(rmse([4 / 3 + 4 / 3 * xx for xx in x], y), 3),
                "rmse_shuffled_f_mean_Hz": round(sum(pr) / len(pr), 3),
                "shuffled_share_at_or_below_real": round(sum(p <= rmse(fit, y) for p in pr) / len(pr), 4),
                "heldout_own_R2_of_f_on_ubl": round(ols(x, y)[2], 3),
                "spearman_f_vs_ubl": round(spearman(x, y), 3)}
    out["B_final"] = bscore(ho, "all held-out records (primary)")
    out["B_final_fish_only"] = bscore([r for r in ho if r["group"] == "fish"], "held-out fishes only (secondary)")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", choices=["dev", "final", "all"], default="all")
    ap.add_argument("--data", default="C:/Temp/delphi-sprint/cs-allometry-fins/raw")
    a = ap.parse_args()
    fetch(a.data)
    recs, dropped = load(a.data)
    dev = stage_dev(recs)
    dev["rows_dropped_not_on_allow_list_or_incomplete"] = dropped
    with open(os.path.join(HERE, "results_dev.json"), "w") as f:
        json.dump({k: v for k, v in dev.items()}, f, indent=1)
    print(json.dumps({k: v for k, v in dev.items() if k != "model"}, indent=1))
    if a.stage in ("final", "all"):
        fin = stage_final(recs, dev["model"])
        with open(os.path.join(HERE, "results_final.json"), "w") as f:
            json.dump(fin, f, indent=1)
        print(json.dumps(fin, indent=1))


if __name__ == "__main__":
    main()
