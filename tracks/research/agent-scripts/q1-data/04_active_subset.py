"""Sensitivity: repeat panel Spearman/Kendall using only enhancers in the top half / top quartile of panel row-mean log2 activity.
Uses the panel (E, P lists) written by 03_analysis.py (summary_main.json). Output printed + scratch/q1-data/active_subset.json"""
import sys; sys.path.append(r'D:\Users\ashenoy00000\AppData\Roaming\Python\Python314\site-packages')
import numpy as np, json
from scipy.stats import spearmanr, kendalltau
S = r'D:\Users\ashenoy00000\delphi-work\agents2\scratch\q1-data'
d = np.load(S + r'\matrix.npz'); A = d['A']; E = list(d['E']); P = list(d['P'])
pan = json.load(open(S + r'\summary_main.json'))['params']
ei = [E.index(e) for e in pan['panel_E']]; pj = [P.index(p) for p in pan['panel_P']]
M = np.log2(A[np.ix_(ei, pj)] + 0.01).mean(2)
rm = M.mean(1); out = {}
for name, q in [('all', 0.0), ('top50pct_rowmean', 0.5), ('top25pct_rowmean', 0.75)]:
    keep = rm >= np.quantile(rm, q); X = M[keep]
    rho = [spearmanr(X[:, a], X[:, b])[0] for a in range(X.shape[1]) for b in range(a + 1, X.shape[1])]
    tau = [kendalltau(X[:, a], X[:, b])[0] for a in range(X.shape[1]) for b in range(a + 1, X.shape[1])]
    out[name] = dict(n_enh=int(keep.sum()), spearman_median=float(np.median(rho)), spearman_min=float(min(rho)), spearman_max=float(max(rho)),
                     kendall_median=float(np.median(tau)))
    print(name, out[name])
json.dump(out, open(S + r'\active_subset.json', 'w'), indent=1)
