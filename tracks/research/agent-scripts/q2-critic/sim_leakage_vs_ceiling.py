#!/usr/bin/env python
"""Q2 critic: noise ceiling vs. data leakage in a synthetic binding-affinity world.

Data-generating process (all stated, seeded):
  * 400 ligand series (congeneric clusters), ~12 ligands each; ligand descriptor
    x = series centre + small jitter (dim 12).
  * 60 proteins in 12 families; descriptor z = family centre + jitter (dim 6).
  * true pAffinity = 6 + A*g[series] + B*h[protein] + C*(x^T W z) + member_jitter
      g,h : series-level / protein-level offsets (MEMORISABLE, do not transfer
            to unseen series / proteins)
      x^T W z : bilinear interaction (TRANSFERABLE physics-like signal)
  * each ligand measured against K=5 random proteins; observed y = true + N(0, s^2).
Model: random forest on [x, z] (a stand-in for "simple ML"), also a ligand-only RF.
Splits: random pair split (leaky: same series in train and test), series-held-out,
        protein-family-held-out, both held out (strict).
Metrics: Pearson r of prediction vs NOISY test labels (what a benchmark reports),
         vs TRUE test values (what the model actually achieved), and the
         analytic ceiling  r_max = sqrt(var_true / (var_true + s^2)).
Run:  python sim_leakage_vs_ceiling.py  [outdir]
"""
import sys, json, os
import numpy as np
from sklearn.ensemble import RandomForestRegressor

SEEDS = [0, 1, 2, 3, 4]
SIGMAS = [0.0, 0.4, 0.8]          # log-unit label noise SD per measurement
A, B, C = 1.0, 0.8, 1.0           # weights: series offset, protein offset, interaction
NSER, PER, NPROT, NFAM, K = 400, 12, 60, 12, 5
DX, DZ = 12, 6


def make_world(seed):
    r = np.random.default_rng(seed)
    s_cent = r.normal(0, 1, (NSER, DX))
    g = r.normal(0, 1, NSER)
    f_cent = r.normal(0, 1, (NFAM, DZ))
    fam = np.arange(NPROT) % NFAM
    z = f_cent[fam] + 0.3 * r.normal(0, 1, (NPROT, DZ))
    h = r.normal(0, 1, NPROT)
    W = r.normal(0, 1, (DX, DZ)) / np.sqrt(DX * DZ) * 2.0
    rows = []
    for s in range(NSER):
        for _ in range(PER):
            x = s_cent[s] + 0.25 * r.normal(0, 1, DX)
            m = 0.2 * r.normal()
            for p in r.choice(NPROT, K, replace=False):
                t = 6 + A * g[s] + B * h[p] + C * (x @ W @ z[p]) + m
                rows.append((s, p, fam[p], x, z[p], t))
    ser = np.array([q[0] for q in rows]); prot = np.array([q[1] for q in rows])
    famv = np.array([q[2] for q in rows])
    X = np.array([np.concatenate([q[3], q[4]]) for q in rows])
    Xl = np.array([q[3] for q in rows])
    t = np.array([q[5] for q in rows])
    return ser, prot, famv, X, Xl, t


def split(kind, ser, prot, fam, r):
    n = len(ser)
    if kind == "random_pairs":
        te = r.random(n) < 0.2
        return ~te, te
    if kind == "series_heldout":
        te_s = r.random(NSER) < 0.2
        te = te_s[ser]
        return ~te, te
    if kind == "family_heldout":
        te_f = r.permutation(NFAM)[:NFAM // 5 or 1]
        te = np.isin(fam, te_f)
        return ~te, te
    if kind == "both_heldout":
        te_s = r.random(NSER) < 0.25
        te_f = r.permutation(NFAM)[:3]
        te = te_s[ser] & np.isin(fam, te_f)
        tr = (~te_s[ser]) & (~np.isin(fam, te_f))
        return tr, te
    raise ValueError(kind)


def rf():
    return RandomForestRegressor(n_estimators=120, min_samples_leaf=2, n_jobs=2, random_state=0)


def main(out):
    os.makedirs(out, exist_ok=True)
    kinds = ["random_pairs", "series_heldout", "family_heldout", "both_heldout"]
    res = []
    for seed in SEEDS:
        ser, prot, fam, X, Xl, t = make_world(seed)
        r = np.random.default_rng(100 + seed)
        noise = r.normal(0, 1, len(t))
        for kind in kinds:
            tr, te = split(kind, ser, prot, fam, np.random.default_rng(200 + seed))
            for s in SIGMAS:
                y = t + s * noise
                for mname, F in (("RF_ligand+protein", X), ("RF_ligand_only", Xl)):
                    m = rf().fit(F[tr], y[tr])
                    p = m.predict(F[te])
                    r_noisy = np.corrcoef(p, y[te])[0, 1]
                    r_true = np.corrcoef(p, t[te])[0, 1]
                    vt = t[te].var()
                    ceil = np.sqrt(vt / (vt + s * s))
                    res.append(dict(seed=seed, split=kind, sigma=s, model=mname,
                                    ntr=int(tr.sum()), nte=int(te.sum()),
                                    r_noisy=r_noisy, r_true=r_true, ceiling=ceil))
    json.dump(res, open(os.path.join(out, "sim_raw.json"), "w"))
    # aggregate
    lines = ["| split | model | noise SD | r vs noisy labels (reported) | r vs true values | analytic ceiling | reported/ceiling |",
             "|---|---|---|---|---|---|---|"]
    agg = []
    for mname in ("RF_ligand+protein", "RF_ligand_only"):
        for kind in kinds:
            for s in SIGMAS:
                q = [x for x in res if x["split"] == kind and x["sigma"] == s and x["model"] == mname]
                a = {k: float(np.mean([x[k] for x in q])) for k in ("r_noisy", "r_true", "ceiling")}
                sd = float(np.std([x["r_noisy"] for x in q]))
                a.update(split=kind, sigma=s, model=mname, sd_r_noisy=sd,
                         nte=int(np.mean([x["nte"] for x in q])))
                agg.append(a)
                lines.append(f"| {kind} | {mname} | {s} | {a['r_noisy']:.3f} (sd {sd:.3f}) | {a['r_true']:.3f} | {a['ceiling']:.3f} | {a['r_noisy']/a['ceiling']:.2f} |")
    # variance of true signal for context
    ser, prot, fam, X, Xl, t = make_world(0)
    lines.append(f"\nTrue-value SD in world seed 0 = {t.std():.3f}; n pairs = {len(t)}; seeds = {SEEDS}")
    open(os.path.join(out, "sim_table.md"), "w").write("\n".join(lines))
    json.dump(agg, open(os.path.join(out, "sim_agg.json"), "w"), indent=1)
    print("\n".join(lines))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "D:/Users/ashenoy00000/delphi-work/agents2/scratch/q2-critic")
