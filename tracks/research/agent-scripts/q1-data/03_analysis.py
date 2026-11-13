"""Enhancer x promoter rank-order and rank-structure analysis for GSE186265 (Martinez-Ara 2022).
usage: python -I 03_analysis.py [pseudocount=0.01] [z=2] [B=1000] [tag=main]
Input: scratch/q1-data/matrix.npz made by 02_build_matrix.py. Output: scratch/q1-data/{summary,panel_pairs,allpairs}_<tag>.*"""
import sys; sys.path.append(r'D:\Users\ashenoy00000\AppData\Roaming\Python\Python314\site-packages')
import numpy as np, json, csv
from scipy.stats import spearmanr, kendalltau
c = float(sys.argv[1]) if len(sys.argv) > 1 else 0.01
Z = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
B = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
tag = sys.argv[4] if len(sys.argv) > 4 else 'main'
S = r'D:\Users\ashenoy00000\delphi-work\agents2\scratch\q1-data'
d = np.load(S + r'\matrix.npz'); A = d['A']; Elist = list(d['E']); Plist = list(d['P'])
rng = np.random.default_rng(20261112)
L = np.log2(A + c)                       # E x P x 3 replicates, log2 scale
M = L.mean(2)
ok = np.isfinite(M)

# ---- noise model: pooled replicate variance within deciles of the cell mean
v = L.var(2, ddof=1); mm = M[ok]; vv = v[ok]
edges = np.quantile(mm, np.linspace(0, 1, 11)); edges[-1] += 1e-9
def binof(x): return np.clip(np.searchsorted(edges, x, side='right') - 1, 0, 9)
binvar = np.array([vv[binof(mm) == k].mean() for k in range(10)])
SE = np.sqrt(binvar[binof(np.nan_to_num(M))] / 3.0); SE[~ok] = np.nan
print('pooled replicate SD (log2) per decile of cell mean:', np.round(np.sqrt(binvar), 3).tolist())

# ---- panel: greedy largest complete sub-block (deterministic)
def greedy(Mk):
    rows = np.arange(Mk.shape[0]); cols = np.arange(Mk.shape[1]); T = Mk.copy()
    while not T.all():
        rm = T.shape[0] - T.sum(0); cm = T.shape[1] - T.sum(1); i = cm.argmax(); j = rm.argmax()
        if cm[i] / T.shape[1] >= rm[j] / T.shape[0] and T.shape[0] > 1:
            T = np.delete(T, i, 0); rows = np.delete(rows, i)
        else:
            T = np.delete(T, j, 1); cols = np.delete(cols, j)
    return rows, cols
pr, pc = greedy(ok)
Lp = L[np.ix_(pr, pc)]; Mp = M[np.ix_(pr, pc)]; SEp = SE[np.ix_(pr, pc)]; Ap = A[np.ix_(pr, pc)]
nE, nP = Mp.shape; print('panel', nE, 'enhancers x', nP, 'promoters')
ti, tj = np.triu_indices(nE, 1)
iu = np.triu_indices(nP, 1)

def metrics(m, se):
    """all promoter-pair metrics for matrix m (enhancers x promoters) with per-cell SE se"""
    D = m[ti] - m[tj]; SEd = np.sqrt(se[ti] ** 2 + se[tj] ** 2); Zs = D / SEd
    Sg = np.sign(D); Pos = (Zs > Z).astype(float); Neg = (Zs < -Z).astype(float); Sig = Pos + Neg
    both = Sig.T @ Sig; rev = Pos.T @ Neg + Neg.T @ Pos
    ab = np.abs(Sg).sum(0); tau = (Sg.T @ Sg) / np.sqrt(np.outer(ab, ab))   # Kendall tau-b
    R = np.argsort(np.argsort(m, 0), 0).astype(float); rho = np.corrcoef(R.T)  # Spearman (ties negligible in continuous logs)
    AD = np.abs(D); size = np.zeros((m.shape[1],) * 2)
    for a in range(m.shape[1]):
        r = (Pos[:, [a]] * Neg + Neg[:, [a]] * Pos) > 0
        size[a] = (np.minimum(AD[:, [a]], AD) * r).sum(0) / np.maximum(r.sum(0), 1)   # mean over reversed pairs of min(|d_a|,|d_b|), log2
    return dict(rho=rho, tau=tau, both=both, rev=rev, size=size)

def ci(x): return [float(np.percentile(x, 2.5)), float(np.percentile(x, 97.5))]
pt = metrics(Mp, SEp)

# ---- bootstraps: 'rep' = per-cell resample of the 3 replicates; 'enh+rep' = also resample enhancers
keys = ['rho', 'tau', 'both', 'rev', 'size']
res = {}
for mode in ['rep', 'enh+rep']:
    store = {k: np.zeros((B, len(iu[0]))) for k in keys}
    for b in range(B):
        rows = rng.integers(0, nE, nE) if mode == 'enh+rep' else np.arange(nE)
        idx = rng.integers(0, 3, (nE, nP, 3))
        Lb = np.take_along_axis(Lp, idx, 2).mean(2)[rows]
        mt = metrics(Lb, SEp[rows])
        for k in keys: store[k][b] = mt[k][iu]
    res[mode] = store

# ---- single-replicate Spearman, and per-promoter reliability (one replicate vs mean of other two)
rep_rho = []
for r_ in range(3):
    R = np.argsort(np.argsort(Lp[:, :, r_], 0), 0).astype(float); rep_rho.append(np.corrcoef(R.T)[iu])
rep_rho = np.array(rep_rho)
rel = []
for j in range(nP):
    rs = []
    for k in range(3):
        o = [x for x in range(3) if x != k]
        rs.append(spearmanr(Lp[:, j, k], Lp[:, j, o].mean(1))[0])
    rel.append(float(np.mean(rs)))
rel = np.array(rel)

# ---- null: purely multiplicative model (additive in log2) + replicate noise at the estimated SE
row = Mp.mean(1, keepdims=True); col = Mp.mean(0, keepdims=True); add = row + col - Mp.mean()
NB = min(B, 500); nl = {k: [] for k in ['rho', 'tau', 'rev', 'both']}
for b in range(NB):
    mt = metrics(add + rng.normal(size=Mp.shape) * SEp, SEp)
    for k in nl: nl[k].append(mt[k][iu])
nl = {k: np.array(v) for k, v in nl.items()}

# ---- singular value analysis
def spec(X): return np.linalg.svd(X, compute_uv=False)
def frac(X): s = spec(X); return s ** 2 / (s ** 2).sum()
def svd_stats(Lm, Am):
    g = Lm.mean(); Xc = Lm - g; rowm = Lm.mean(1, keepdims=True); colm = Lm.mean(0, keepdims=True)
    I = Lm - rowm - colm + g
    tot = (Xc ** 2).sum(); sa = ((rowm - g) ** 2).sum() * Lm.shape[1] + ((colm - g) ** 2).sum() * Lm.shape[0]
    fi = frac(I)
    return dict(lin_rank1=float(frac(Am)[0]), log_uncentered_rank1=float(frac(Lm)[0]),
                log_gm_centered_rank1=float(frac(Xc)[0]), additive_share_of_variance=float(sa / tot),
                interaction_share_of_variance=float((I ** 2).sum() / tot),
                interaction_rank1_share_of_interaction=float(fi[0]),
                additive_plus_rank1_interaction_share=float((sa + fi[0] * (I ** 2).sum()) / tot),
                sv_lin=spec(Am).tolist(), sv_log_uncentered=spec(Lm).tolist(),
                sv_log_interaction=spec(I).tolist(), sv_log_gm_centered=spec(Xc).tolist(),
                I_ss=float((I ** 2).sum()), tot_ss=float(tot))
sv = svd_stats(Mp, Ap.mean(2))
noise_ss = float((SEp ** 2).mean() * (nE - 1) * (nP - 1))   # expected interaction SS from replicate noise alone
sv['expected_interaction_ss_from_noise'] = noise_ss
sv['interaction_ss_over_noise'] = sv['I_ss'] / noise_ss
sv['interaction_share_after_noise_subtraction'] = max(sv['I_ss'] - noise_ss, 0) / (sv['tot_ss'] - noise_ss)
sk = ['lin_rank1', 'log_uncentered_rank1', 'log_gm_centered_rank1', 'additive_share_of_variance', 'interaction_share_of_variance',
      'interaction_rank1_share_of_interaction', 'additive_plus_rank1_interaction_share', 'interaction_ss_over_noise']
def svboot(enh):
    out = {k: [] for k in sk}
    for b in range(B):
        idx = rng.integers(0, 3, (nE, nP, 3)); Lb = np.take_along_axis(Lp, idx, 2).mean(2); Ab = np.take_along_axis(Ap, idx, 2).mean(2)
        if enh:
            rr = rng.integers(0, nE, nE); Lb = Lb[rr]; Ab = Ab[rr]
        s = svd_stats(Lb, Ab); s['interaction_ss_over_noise'] = s['I_ss'] / noise_ss
        for k in sk: out[k].append(s[k])
    return {k: ci(v) for k, v in out.items()}
svci = svboot(False); svci_enh = svboot(True)

# ---- all-pair point estimates over all 31 promoters (pairwise-complete enhancers, n>=20)
allp = []
for a in range(M.shape[1]):
    for b in range(a + 1, M.shape[1]):
        cm = ok[:, a] & ok[:, b]; n = int(cm.sum())
        if n < 20: continue
        ma = M[cm][:, [a, b]]; se = SE[cm][:, [a, b]]
        t = np.triu_indices(n, 1); D = ma[t[0]] - ma[t[1]]; sd = np.sqrt(se[t[0]] ** 2 + se[t[1]] ** 2); zz = D / sd
        bothm = (np.abs(zz[:, 0]) > Z) & (np.abs(zz[:, 1]) > Z); revm = bothm & (np.sign(D[:, 0]) != np.sign(D[:, 1]))
        sz = np.minimum(np.abs(D[:, 0]), np.abs(D[:, 1]))[revm]
        allp.append(dict(pa=Plist[a], pb=Plist[b], n=n, spearman=float(spearmanr(ma[:, 0], ma[:, 1])[0]),
                         kendall=float(kendalltau(ma[:, 0], ma[:, 1])[0]), n_pairs=int(len(D)), n_sig_both=int(bothm.sum()),
                         n_rev=int(revm.sum()), rev_frac=float(revm.sum() / max(bothm.sum(), 1)),
                         rev_size_median_log2=float(np.median(sz)) if len(sz) else 0.0,
                         rev_size_max_log2=float(sz.max()) if len(sz) else 0.0))
with open(S + rf'\allpairs_{tag}.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(allp[0])); w.writeheader(); w.writerows(allp)

# ---- panel pair table with CIs
rows = []
for k, (a, b) in enumerate(zip(*iu)):
    r = dict(pa=Plist[pc[a]], pb=Plist[pc[b]], spearman=float(pt['rho'][a, b]), kendall=float(pt['tau'][a, b]),
             n_sig_both=int(pt['both'][a, b]), n_rev=int(pt['rev'][a, b]), rev_frac=float(pt['rev'][a, b] / max(pt['both'][a, b], 1)),
             rev_size_mean_log2=float(pt['size'][a, b]), rep_rho_min=float(rep_rho[:, k].min()), rep_rho_max=float(rep_rho[:, k].max()),
             null_rev_mean=float(nl['rev'][:, k].mean()), null_rho_mean=float(nl['rho'][:, k].mean()),
             null_rho_ci=ci(nl['rho'][:, k]), null_rev_ci=ci(nl['rev'][:, k]))
    for mode in res:
        r[f'rho_ci_{mode}'] = ci(res[mode]['rho'][:, k]); r[f'tau_ci_{mode}'] = ci(res[mode]['tau'][:, k])
        r[f'rev_ci_{mode}'] = ci(res[mode]['rev'][:, k])
        r[f'revfrac_ci_{mode}'] = ci(res[mode]['rev'][:, k] / np.maximum(res[mode]['both'][:, k], 1))
    rows.append(r)
json.dump(rows, open(S + rf'\panel_pairs_{tag}.json', 'w'), indent=1)
rf = np.array([x['rev_frac'] for x in rows])
summ = dict(params=dict(pseudocount=c, z=Z, B=B, panel_enhancers=nE, panel_promoters=nP, panel_E=[Elist[i] for i in pr], panel_P=[Plist[j] for j in pc]),
            noise_sd_log2_by_decile=np.sqrt(binvar).tolist(), panel_pairs=len(rows),
            spearman_median=float(np.median([x['spearman'] for x in rows])),
            spearman_range=[min(x['spearman'] for x in rows), max(x['spearman'] for x in rows)],
            kendall_median=float(np.median([x['kendall'] for x in rows])),
            kendall_range=[min(x['kendall'] for x in rows), max(x['kendall'] for x in rows)],
            rev_frac_median=float(np.median(rf)), rev_frac_range=[float(rf.min()), float(rf.max())],
            n_rev_total=int(sum(x['n_rev'] for x in rows)), n_sigboth_total=int(sum(x['n_sig_both'] for x in rows)),
            null_rev_total_mean=float(nl['rev'].sum(1).mean()), null_rev_total_ci=ci(nl['rev'].sum(1)),
            null_rho_median_of_pairs=float(np.median(nl['rho'].mean(0))),
            promoter_reliability_spearman=dict(zip([Plist[j] for j in pc], rel.tolist())),
            svd=sv, svd_ci_rep=svci, svd_ci_enh_rep=svci_enh,
            allpairs_n=len(allp), allpairs_spearman_median=float(np.median([x['spearman'] for x in allp])),
            allpairs_spearman_min=float(min(x['spearman'] for x in allp)), allpairs_spearman_max=float(max(x['spearman'] for x in allp)),
            allpairs_rev_frac_median=float(np.median([x['rev_frac'] for x in allp])),
            allpairs_rev_frac_max=float(max(x['rev_frac'] for x in allp)))
json.dump(summ, open(S + rf'\summary_{tag}.json', 'w'), indent=1)
print(json.dumps({k: v for k, v in summ.items() if k not in ('params', 'svd')}, indent=1)[:7000])
print('SVD', {k: round(v, 4) for k, v in sv.items() if not isinstance(v, list)})
