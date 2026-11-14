"""Noise ceiling vs trivial baselines with whole targets held out (see prereg.md).
Usage: python analyze.py <raw_dir> --stage dev     (development targets only; refuses held-out files)
       python analyze.py <raw_dir> --stage final   (single final held-out evaluation)
Writes dev_results.json / final_results.json next to this script.
"""
import json, sys, os, math, itertools, collections, hashlib
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from targets import TARGETS, is_heldout
from rdkit import Chem, RDLogger
from rdkit.Chem import rdFingerprintGenerator
RDLogger.DisableLog("rdApp.*")
RAW, STAGE = sys.argv[1], sys.argv[sys.argv.index("--stage") + 1]
K = 5

def load(targets):
    """-> pairs[(target, mol)] = {doc: mean pchembl}, smiles[mol], meta[target]"""
    by = collections.defaultdict(lambda: collections.defaultdict(list)); smi = {}; meta = {}
    for t in targets:
        if STAGE == "dev" and is_heldout(t): raise SystemExit("dev stage must not read held-out target " + t)
        p = os.path.join(RAW, t + ".json")
        if not os.path.exists(p): meta[t] = "missing"; continue
        d = json.load(open(p, encoding="utf-8")); meta[t] = {"rows": len(d["rows"]), "total_count": d["total_count"]}
        for a in d["rows"]:
            if not a.get("canonical_smiles") or a.get("pchembl_value") is None: continue
            by[(t, a["molecule_chembl_id"])][a["document_chembl_id"]].append(float(a["pchembl_value"]))
            smi[a["molecule_chembl_id"]] = a["canonical_smiles"]
    pairs = {k: {doc: float(np.mean(v)) for doc, v in docs.items()} for k, docs in by.items()}
    return pairs, smi, meta

def noise(pairs):
    d = np.array([x - y for docs in pairs.values() for x, y in itertools.combinations(docs.values(), 2)])
    nz = d[np.abs(d) >= 0.005]
    s = lambda v: float(math.sqrt(np.mean(v ** 2) / 2)) if len(v) else float("nan")
    return {"n_pairs_all": int(len(d)), "s_all": s(d), "n_pairs_primary": int(len(nz)), "s_primary": s(nz),
            "s_robust_primary": float(1.4826 * np.median(np.abs(nz)) / math.sqrt(2)) if len(nz) else float("nan"),
            "frac_identical": float(np.mean(np.abs(d) < 0.005)) if len(d) else float("nan"),
            "frac_gt_1log_primary": float(np.mean(np.abs(nz) > 1)) if len(nz) else float("nan")}

def table(pairs):
    keys = sorted(pairs); t = np.array([k[0] for k in keys]); m = np.array([k[1] for k in keys])
    y = np.array([np.mean(list(pairs[k].values())) for k in keys]); nd = np.array([len(pairs[k]) for k in keys])
    return t, m, y, nd

def fps(mols, smi):
    gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)
    X = np.zeros((len(mols), 2048), dtype=np.float32); ok = np.zeros(len(mols), bool)
    for i, m in enumerate(mols):
        mol = Chem.MolFromSmiles(smi[m])
        if mol is None: continue
        X[i, list(gen.GetFingerprint(mol).GetOnBits())] = 1; ok[i] = True
    return X, ok

def knn(Xq, Xt, yt, k=K, exclude_self=None, chunk=1500):
    """mean label of k most Tanimoto-similar training rows; returns prediction and top-1 similarity"""
    ct = Xt.sum(1); pred = np.zeros(len(Xq)); top = np.zeros(len(Xq))
    for s in range(0, len(Xq), chunk):
        q = Xq[s:s + chunk]; inter = q @ Xt.T
        sim = inter / np.maximum(q.sum(1)[:, None] + ct[None, :] - inter, 1)
        kk = min(k, Xt.shape[0])
        idx = np.argpartition(-sim, kk - 1, axis=1)[:, :kk]
        pred[s:s + chunk] = yt[idx].mean(1); top[s:s + chunk] = sim.max(1)
    return pred, top

def pear(a, b):
    if len(a) < 3 or np.std(a) == 0 or np.std(b) == 0: return float("nan")
    return float(np.corrcoef(a, b)[0, 1])

def score(t, y, pred):
    """pooled Pearson r, mean within-target r, RMSE, target-bootstrap CI of pooled r"""
    ut = sorted(set(t)); within = [pear(y[t == u], pred[t == u]) if (t == u).sum() >= 30 else float("nan") for u in ut]
    rng = np.random.default_rng(0); boots = []
    idx = {u: np.where(t == u)[0] for u in ut}
    for _ in range(1000):
        sel = np.concatenate([idx[u] for u in rng.choice(ut, len(ut))]); boots.append(pear(y[sel], pred[sel]))
    return {"n": int(len(y)), "pooled_r": pear(y, pred), "pooled_r_ci95_target_bootstrap": [float(np.nanpercentile(boots, 2.5)), float(np.nanpercentile(boots, 97.5))],
            "mean_within_target_r": float(np.nanmean(within)), "rmse": float(np.sqrt(np.mean((y - pred) ** 2))),
            "within_target_r": {u: w for u, w in zip(ut, within)}}

def ceilings(t, y, nd, s):
    """attenuation ceilings sqrt(1 - s^2/var_obs); 'eff' uses the label noise actually present (s^2/n_docs averaged)"""
    out = {"var_obs_pooled": float(np.var(y)), "sd_obs_pooled": float(np.std(y))}
    s2eff = float(np.mean(s * s / nd))
    out["pooled_ceiling_r"] = float(math.sqrt(max(0, 1 - s * s / np.var(y))))
    out["pooled_ceiling_r_eff_noise"] = float(math.sqrt(max(0, 1 - s2eff / np.var(y))))
    per = {}
    for u in sorted(set(t)):
        if (t == u).sum() < 30: continue  # too few pairs for a within-target variance (deviation from prereg, see results)
        v = float(np.var(y[t == u])); per[u] = {"n": int((t == u).sum()), "sd_obs": math.sqrt(v), "ceiling_r": math.sqrt(max(0, 1 - s * s / v))}
    out["per_target"] = per
    out["mean_within_target_ceiling_r"] = float(np.mean([p["ceiling_r"] for p in per.values()]))
    out["min_within_target_ceiling_r"] = float(np.min([p["ceiling_r"] for p in per.values()]))
    # between-target share and the leave-one-out target-mean predictor (knows the target only)
    g = np.mean(y); between = sum((t == u).sum() * (np.mean(y[t == u]) - g) ** 2 for u in set(t)) / len(y)
    out["between_target_share"] = float(between / np.var(y)); out["sqrt_between_share"] = float(math.sqrt(between / np.var(y)))
    return out

def loo_target_mean(t, y):
    pred = np.zeros(len(y))
    for u in set(t):
        m = t == u; n = m.sum(); pred[m] = (y[m].sum() - y[m]) / max(n - 1, 1)
    return pred

def mol_labels(t, m, y):
    acc = collections.defaultdict(list)
    for mm, yy in zip(m, y): acc[mm].append(yy)
    mols = sorted(acc); return mols, np.array([np.mean(acc[x]) for x in mols])

def within_target_cv(t, m, y, X_by_mol, seed=0):
    """leaky protocol: random 5-fold split of compounds inside each target, 5-NN from the same target"""
    pred = np.zeros(len(y)); rng = np.random.default_rng(seed)
    for u in sorted(set(t)):
        ix = np.where(t == u)[0]; X = np.stack([X_by_mol[x] for x in m[ix]]); fold = rng.integers(0, 5, len(ix))
        for f in range(5):
            te, tr = fold == f, fold != f
            if te.sum() and tr.sum(): pred[ix[te]] = knn(X[te], X[tr], y[ix[tr]])[0]
    return pred

def run_holdout(train_pairs, test_pairs, smi, tag):
    tt, tm, ty, _ = table(train_pairs); qt, qm, qy, qnd = table(test_pairs)
    mols_tr, ytr = mol_labels(tt, tm, ty); Xtr, oktr = fps(mols_tr, smi); Xtr, ytr = Xtr[oktr], ytr[oktr]
    umols = sorted(set(qm)); Xq, okq = fps(umols, smi)
    pm, top = knn(Xq, Xtr, ytr); pos = {x: i for i, x in enumerate(umols)}
    keep = np.array([okq[pos[x]] for x in qm]); qt, qm, qy, qnd = qt[keep], qm[keep], qy[keep], qnd[keep]
    qi = np.array([pos[x] for x in qm]); pred = pm[qi]
    rng = np.random.default_rng(0); ysh = rng.permutation(ytr); psh = knn(Xq, Xtr, ysh)[0][qi]
    trset = set(mols_tr)
    res = {"n_train_compounds": int(len(ytr)), "n_test_pairs": int(len(qy)), "n_test_targets": int(len(set(qt))),
           "frac_test_pairs_compound_also_in_train": float(np.mean([x in trset for x in qm])),
           "median_top1_tanimoto": float(np.median(top[qi])),
           "knn5_ligand_only_target_heldout": score(qt, qy, pred),
           "knn5_SHUFFLED_train_labels_control": score(qt, qy, psh),
           "constant_train_grand_mean": {"value": float(np.mean(ty)), "rmse": float(np.sqrt(np.mean((qy - np.mean(ty)) ** 2))), "pooled_r": "undefined (constant)"},
           "loo_target_mean_knows_target": score(qt, qy, loo_target_mean(qt, qy))}
    # similarity-stratified r: far from training chemistry vs close
    far = top[qi] < 0.4
    res["knn5_by_similarity"] = {"top1_lt_0.4": {"n": int(far.sum()), "pooled_r": pear(qy[far], pred[far])}, "top1_ge_0.4": {"n": int((~far).sum()), "pooled_r": pear(qy[~far], pred[~far])}}
    Xby = {x: Xq[pos[x]] for x in umols}
    pl = within_target_cv(qt, qm, qy, Xby); res["knn5_LEAKY_random_split_within_target"] = score(qt, qy, pl)
    return res, (qt, qm, qy, qnd)

dev_targets = [t for t in TARGETS if not is_heldout(t)]; ho_targets = [t for t in TARGETS if is_heldout(t)]
dev_pairs, dev_smi, dev_meta = load(dev_targets)
out = {"stage": STAGE, "dev_meta": dev_meta, "dev_noise": noise(dev_pairs)}
s_dev = out["dev_noise"]["s_primary"]
if STAGE == "dev":
    t, m, y, nd = table(dev_pairs)
    out["dev_n_pairs"] = int(len(y)); out["dev_ceilings"] = ceilings(t, y, nd, s_dev)
    # split-half stability of s across development targets (is the +/-25% band of P1 reasonable?)
    h = lambda x: int(hashlib.sha256(x.encode()).hexdigest(), 16)
    A = {k: v for k, v in dev_pairs.items() if h(k[0]) % 2 == 0}; B = {k: v for k, v in dev_pairs.items() if h(k[0]) % 2 == 1}
    out["dev_split_half_noise"] = {"A": noise(A), "B": noise(B)}
    # pipeline rehearsal inside development: targets with sha256 mod 5 == 1 play the held-out role
    inner_te = {k: v for k, v in dev_pairs.items() if h(k[0]) % 5 == 1}; inner_tr = {k: v for k, v in dev_pairs.items() if h(k[0]) % 5 != 1}
    out["dev_inner_rehearsal"], _ = run_holdout(inner_tr, inner_te, dev_smi, "inner")
    json.dump(out, open(os.path.join(HERE, "dev_results.json"), "w"), indent=1)
else:
    ho_pairs, ho_smi, ho_meta = load(ho_targets); smi = {**dev_smi, **ho_smi}
    out["heldout_meta"] = ho_meta; out["heldout_noise"] = noise(ho_pairs)
    res, (qt, qm, qy, qnd) = run_holdout(dev_pairs, ho_pairs, smi, "final")
    out["heldout_models"] = res; out["heldout_ceilings_using_s_dev"] = ceilings(qt, qy, qnd, s_dev)
    out["P1_ratio_heldout_s_over_dev_s"] = out["heldout_noise"]["s_primary"] / s_dev
    # empirical replicate correlation on held-out targets: one document's value vs another's (order randomised)
    rng = np.random.default_rng(0); a, b = [], []
    for docs in ho_pairs.values():
        v = list(docs.values())
        if len(v) >= 2:
            i, j = rng.choice(len(v), 2, replace=False); a.append(v[i]); b.append(v[j])
    a, b = np.array(a), np.array(b)
    out["heldout_replicate_check"] = {"n_pairs": int(len(a)), "r_doc_vs_doc": pear(a, b), "implied_perfect_model_ceiling_sqrt_r": float(math.sqrt(max(pear(a, b), 0))),
                                      "sd_replicated_subset": float(np.std(np.concatenate([a, b])))}
    json.dump(out, open(os.path.join(HERE, "final_results.json"), "w"), indent=1)
def brief(o, d=0):
    for k, v in o.items():
        if k in ("within_target_r", "per_target", "dev_meta", "heldout_meta"): continue
        if isinstance(v, dict): print("  " * d + k + ":"); brief(v, d + 1)
        else: print("  " * d + f"{k}: {round(v, 4) if isinstance(v, float) else v}")
brief(out)
