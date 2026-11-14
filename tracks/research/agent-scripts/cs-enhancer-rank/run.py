"""cs-enhancer-rank: multiplicative enhancer x promoter model + rank-flip test on Bergman 2022 ExP STARR-seq.
Usage: python run.py all   (stages: fetch, aggregate, dev, final)
Data dir: env CS_DATA (default C:/Temp/delphi-sprint/cs-enhancer-rank). Outputs next to this script.
"""
import sys, os, json, hashlib, gzip, urllib.request
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("CS_DATA", "C:/Temp/delphi-sprint/cs-enhancer-rank")
RAW = os.path.join(DATA, "raw", "GSE184426_ExP_1Kx1K_counts.txt.gz")
URL = "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE184nnn/GSE184426/suppl/GSE184426_ExP_1Kx1K_counts.txt.gz"
REPS = ["reads_rep1", "reads_rep2", "reads_rep3", "reads_rep4"]
SEED = 20261114


def h5(s):
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16) % 5


def fetch():
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    if not os.path.exists(RAW):
        urllib.request.urlretrieve(URL, RAW)
    print("raw bytes", os.path.getsize(RAW))


def aggregate():
    df = pd.read_csv(RAW, sep="\t", usecols=["BC", "promoter", "enhancer", "DNA_input"] + REPS)
    df["n_bc"] = 1
    hA = df.BC.str[-1].isin(["A", "C"]).to_numpy()
    rs = df[REPS].sum(1).to_numpy()
    df["A_dna"] = np.where(hA, df.DNA_input, 0); df["B_dna"] = np.where(hA, 0, df.DNA_input)
    df["A_rna"] = np.where(hA, rs, 0); df["B_rna"] = np.where(hA, 0, rs)
    df = df.drop(columns=["BC"])
    g = df.groupby(["promoter", "enhancer"], sort=False).sum().reset_index()
    eh = {e: h5(e) for e in g.enhancer.unique()}
    g["enh_held"] = g.enhancer.map(eh) == 0
    g["cell_h"] = [h5(p + "|" + e) for p, e in zip(g.promoter, g.enhancer)]
    g["part"] = np.where(g.enh_held, "H_enh", np.where(g.cell_h == 0, "H_cell", "dev"))
    g[g.part == "dev"].to_csv(os.path.join(DATA, "cells_dev.csv"), index=False)
    g[g.part != "dev"].to_csv(os.path.join(DATA, "cells_held.csv"), index=False)
    sizes = g.part.value_counts().to_dict()
    sizes["n_enh_held"] = int(sum(v == 0 for v in eh.values())); sizes["n_enh"] = len(eh)
    sizes["n_prom"] = int(g.promoter.nunique()); sizes["barcode_rows"] = int(len(df))
    json.dump(sizes, open(os.path.join(HERE, "split_sizes.json"), "w"), indent=1)
    print(sizes)


def logact(c, fz):
    """per-replicate log2 activity matrix (n,4), mean, total RNA."""
    rna = c[REPS].to_numpy(float)
    y = np.log2((rna + fz["pc"]) / c.DNA_input.to_numpy(float)[:, None]) - np.array(fz["libnorm"])[None, :]
    return y, y.mean(1), rna.sum(1)


def fit_additive(pi, ei, y, nP, nE, iters=40):
    mu = y.mean(); a = np.zeros(nE); b = np.zeros(nP)
    cntE = np.maximum(np.bincount(ei, minlength=nE), 1); cntP = np.maximum(np.bincount(pi, minlength=nP), 1)
    for _ in range(iters):
        b = np.bincount(pi, y - mu - a[ei], minlength=nP) / cntP
        a = np.bincount(ei, y - mu - b[pi], minlength=nE) / cntE
    return mu, a, b


def r2(y, pred, ref):
    return 1 - ((y - pred) ** 2).sum() / ((y - ref) ** 2).sum()


def noise_sd(tot, fz):
    """returns 2 x SE of the cell mean (callers divide by 2): max of replicate SD and 2 x barcode-half SE."""
    k = np.searchsorted(np.array(fz["dec_edges"]), tot, side="right")
    return np.maximum(np.array(fz["dec_sd"])[k], 2 * np.array(fz["dec_se_bc"])[k])


def flips(M, SE, zt, rng=None, perm=False):
    """M,SE: (P,E) with NaN. Returns flips, doubly-significant quads, raw discordant, raw comparable."""
    P, E = M.shape
    iu, ju = np.triu_indices(E, 1)
    D = M[:, iu] - M[:, ju]
    Z = D / np.sqrt(SE[:, iu] ** 2 + SE[:, ju] ** 2)
    nf = ns = nd = nc = 0
    for p in range(P):
        for q in range(p + 1, P):
            ok = ~np.isnan(Z[p]) & ~np.isnan(Z[q])
            zp, zq = Z[p][ok], Z[q][ok]
            nc += ok.sum(); nd += (zp * zq < 0).sum()
            sig = (np.abs(zp) > zt) & (np.abs(zq) > zt)
            ns += sig.sum(); nf += (sig & (zp * zq < 0)).sum()
    return int(nf), int(ns), int(nd), int(nc)


def flip_block(c, fz, tag, top_prom, nsim=10):
    """c: filtered cells of the enhancers to test. Returns dict of flip stats + null + broken control."""
    rng = np.random.default_rng(SEED)
    c = c[c.promoter.isin(top_prom)]
    y, m, tot = logact(c, fz)
    se = noise_sd(tot, fz) / 2.0
    ps = {p: i for i, p in enumerate(top_prom)}; es = {e: i for i, e in enumerate(sorted(c.enhancer.unique()))}
    pi = c.promoter.map(ps).to_numpy(); ei = c.enhancer.map(es).to_numpy()
    M = np.full((len(ps), len(es)), np.nan); SE = M.copy()
    M[pi, ei] = m; SE[pi, ei] = se
    zt = fz["z_thresh"]
    nf, ns, nd, nc = flips(M, SE, zt)
    mu, a, b = fit_additive(pi, ei, m, len(ps), len(es))
    resid_sd = float(np.std(m - (mu + a[ei] + b[pi])))
    null = []
    for _ in range(nsim):
        Ms = np.full_like(M, np.nan); Ms[pi, ei] = mu + a[ei] + b[pi] + rng.normal(0, se)
        null.append(flips(Ms, SE, zt))
    null = np.array(null, float)
    # broken input: permute enhancer labels independently within each promoter
    Mb = M.copy(); SEb = SE.copy()
    for p in range(M.shape[0]):
        idx = np.where(~np.isnan(M[p]))[0]; pr = rng.permutation(idx)
        Mb[p, idx] = M[p, pr]; SEb[p, idx] = SE[p, pr]
    bf, bs, bd, bc = flips(Mb, SEb, zt)
    # promoter-pair Spearman on shared enhancers
    R = pd.DataFrame(M.T).rank().corr(min_periods=20).to_numpy()
    sp = R[np.triu_indices(R.shape[0], 1)]; sp = sp[~np.isnan(sp)]
    return {
        "tag": tag, "n_promoters": len(ps), "n_enhancers": len(es), "n_cells": int(len(c)),
        "z_thresh": zt, "sig_quads": ns, "sig_flips": nf, "flip_frac_sig": nf / max(ns, 1),
        "raw_quads": nc, "raw_discordant_frac": nd / max(nc, 1),
        "null_flip_frac_sig_mean": float((null[:, 0] / np.maximum(null[:, 1], 1)).mean()),
        "null_flip_frac_sig_max": float((null[:, 0] / np.maximum(null[:, 1], 1)).max()),
        "null_sig_flips_mean": float(null[:, 0].mean()), "null_sig_quads_mean": float(null[:, 1].mean()),
        "null_raw_discordant_frac": float((null[:, 2] / null[:, 3]).mean()),
        "excess_fold_sig_flips": nf / max(float(null[:, 0].mean()), 0.1),
        "broken_perm_flip_frac_sig": bf / max(bs, 1), "broken_perm_sig_quads": bs,
        "broken_perm_raw_discordant_frac": bd / max(bc, 1),
        "spearman_promoter_pairs_median": float(np.median(sp)), "spearman_min": float(sp.min()),
        "additive_resid_sd_log2": resid_sd, "median_se_log2": float(np.median(se)),
        "lean_allowed_true_flips": 0,
    }


def dev():
    c = pd.read_csv(os.path.join(DATA, "cells_dev.csv"))
    rna_tot = c[REPS].to_numpy(float).sum(0); dna_tot = float(c.DNA_input.sum())
    fz = {"pc": 1.0, "libnorm": list(np.log2(rna_tot / dna_tot)), "z_thresh": 3.0}
    grid = []
    for dmin in [50, 100, 200, 400, 800]:
        s = c[(c.DNA_input >= dmin) & (c.n_bc >= 2)]
        y, m, tot = logact(s, fz)
        rel = float(np.corrcoef(y[:, :2].mean(1), y[:, 2:].mean(1))[0, 1])
        pcod, ecod = pd.factorize(s.promoter)[0], pd.factorize(s.enhancer)[0]
        inner = (s.cell_h == 1).to_numpy()
        mu, a, b = fit_additive(pcod[~inner], ecod[~inner], m[~inner], pcod.max() + 1, ecod.max() + 1)
        grid.append({"dna_min": dmin, "n_cells": int(len(s)), "splithalf_r": rel,
                     "inner_cv_r2": float(r2(m[inner], mu + a[ecod[inner]] + b[pcod[inner]], mu))})
        print(grid[-1])
    ok = [g for g in grid if g["splithalf_r"] >= 0.8]
    fz["dna_min"] = ok[0]["dna_min"] if ok else grid[-1]["dna_min"]
    fz["rule"] = "smallest DNA_input minimum in {50,100,200,400,800} with dev split-half r >= 0.8, else 800; n_bc >= 2"
    s = c[(c.DNA_input >= fz["dna_min"]) & (c.n_bc >= 2)]
    y, m, tot = logact(s, fz)
    edges = np.quantile(tot, np.arange(0.1, 1.0, 0.1))
    k = np.searchsorted(edges, tot, side="right")
    fz["dec_edges"] = list(map(float, edges))
    fz["dec_sd"] = [float(np.sqrt(y[k == i].var(1, ddof=1).mean())) for i in range(10)]
    okh = ((s.A_dna >= fz["dna_min"] / 4) & (s.B_dna >= fz["dna_min"] / 4)).to_numpy()
    d = np.log2((s.A_rna + 1) / s.A_dna.clip(lower=1)) - np.log2((s.B_rna + 1) / s.B_dna.clip(lower=1))
    d = d.to_numpy()
    fz["dec_se_bc"] = [float(np.std(d[okh & (k == i)]) / 2) for i in range(10)]
    fz["bc_half_cells"] = int(okh.sum())
    top = c.groupby("promoter").DNA_input.sum().sort_values(ascending=False).index[:50].tolist()
    fz["top_promoters"] = top
    json.dump(fz, open(os.path.join(HERE, "frozen.json"), "w"), indent=1)
    # development-only rank-flip rehearsal on a hash-defined subset of dev enhancers (hash bucket 1)
    sub = s[s.enhancer.map(lambda e: h5(e) == 1)]
    fb = flip_block(sub, fz, "dev_enhancers_bucket1", top)
    json.dump({"grid": grid, "dna_min": fz["dna_min"], "dec_sd": fz["dec_sd"], "dec_se_bc": fz["dec_se_bc"], "flip_rehearsal": fb},
              open(os.path.join(HERE, "dev_results.json"), "w"), indent=1)
    print(json.dumps(fb, indent=1))


def final():
    fz = json.load(open(os.path.join(HERE, "frozen.json")))
    flag = os.path.join(HERE, "final_results.json")
    filt = lambda d: d[(d.DNA_input >= fz["dna_min"]) & (d.n_bc >= 2)]
    cd = filt(pd.read_csv(os.path.join(DATA, "cells_dev.csv")))
    ch = filt(pd.read_csv(os.path.join(DATA, "cells_held.csv")))
    hc = ch[ch.part == "H_cell"]; he = ch[ch.part == "H_enh"]
    pcat = {p: i for i, p in enumerate(sorted(cd.promoter.unique()))}
    ecat = {e: i for i, e in enumerate(sorted(cd.enhancer.unique()))}
    yd, md, _ = logact(cd, fz)
    pi = cd.promoter.map(pcat).to_numpy(); ei = cd.enhancer.map(ecat).to_numpy()
    mu, a, b = fit_additive(pi, ei, md, len(pcat), len(ecat))
    hc = hc[hc.promoter.isin(pcat) & hc.enhancer.isin(ecat)]
    yh, mh, toth = logact(hc, fz)
    hp = hc.promoter.map(pcat).to_numpy(); hx = hc.enhancer.map(ecat).to_numpy()
    rng = np.random.default_rng(SEED)
    eis = rng.permutation(ei)
    mu2, a2, b2 = fit_additive(pi, eis, md, len(pcat), len(ecat))
    half = float(np.corrcoef(yh[:, :2].mean(1), yh[:, 2:].mean(1))[0, 1])
    pred = mu + a[hx] + b[hp]
    out = {"R2": {
        "n_heldout_cells": int(len(hc)), "n_dev_cells": int(len(cd)),
        "n_promoters": len(pcat), "n_dev_enhancers": len(ecat),
        "multiplicative_r2": float(r2(mh, pred, mu)),
        "pearson_r": float(np.corrcoef(mh, pred)[0, 1]),
        "baseline_grand_mean_r2": 0.0,
        "baseline_promoter_only_r2": float(r2(mh, mu + b[hp], mu)),
        "baseline_enhancer_only_r2": float(r2(mh, mu + a[hx], mu)),
        "broken_shuffled_enhancer_labels_r2": float(r2(mh, mu2 + a2[hx] + b2[hp], mu2)),
        "heldout_replicate_half_r": half,
        "heldout_reliability_spearman_brown": 2 * half / (1 + half),
        "rmse_log2": float(np.sqrt(((mh - pred) ** 2).mean())),
        "noise_se_log2_median": float(np.median(noise_sd(toth, fz) / 2)),
        "published_r2_bergman": 0.82,
    }}
    # R2 restricted to well-measured held-out cells (top half by total RNA) - reported, secondary
    hi = toth >= np.median(toth)
    out["R2"]["multiplicative_r2_top_half_rna"] = float(r2(mh[hi], pred[hi], mu))
    out["flips"] = flip_block(he, fz, "H_enh", fz["top_promoters"])
    json.dump(out, open(flag, "w"), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    st = sys.argv[1] if len(sys.argv) > 1 else "all"
    for name, fn in [("fetch", fetch), ("aggregate", aggregate), ("dev", dev), ("final", final)]:
        if st in ("all", name):
            print("==", name); fn()
