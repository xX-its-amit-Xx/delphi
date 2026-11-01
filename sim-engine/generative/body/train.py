"""Body-level generative models on FishShapes v1: conditional flow matching (rectified flow) and a DDPM (VP-SDE) variant.

    python -I train.py                 # split run (evaluate) + production run (all data), writes model/*.json
    python -I train.py --quick         # few steps, for the test suite's smoke check
    python -I train.py --only fm       # skip the DDPM

Data: data/fishshapes-derived.csv (prepare.py). Features (7, natural logs, see data/fishshapes-manifest.json):
  log SL, log depth/SL, log width/SL, log peduncle depth frac, log peduncle width frac, log Fulton K, log head depth/depth.
Condition: family embedding (learned; a NULL token stands for "any teleost") + a partial-observation block: any subset of
the 7 features can be given as a value with a mask bit, so the model generates the REST conditional on them. Text
attributes ("deeper body") become such observed values (generative/lib/text-conditions.mjs).

Evaluation (species-level split; a test specimen's species was never trained on):
  - held-out negative log-likelihood (nats/specimen, in the 7-D log-feature space) by the instantaneous change of
    variables with the exact divergence, against two Gaussian baselines fitted on the same training rows;
  - energy-distance two-sample permutation test and a kNN classifier two-sample test (C2ST), generated vs real;
  - conditional imputation: given SL + depth + family, predict the other features; RMSE and 90 % interval coverage.
Weights are written as base64 float32 so generative/lib/flow.mjs can sample in pure JS (no Python at runtime).
"""
import argparse, base64, csv, json, math, os, sys, time
import numpy as np
import torch
import torch.nn as nn

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data', 'fishshapes-derived.csv')
MODEL_DIR = os.path.join(HERE, 'model')
FEATURES = ['log_SL_mm', 'log_depth_over_SL', 'log_width_over_SL', 'log_peduncle_depth_frac',
            'log_peduncle_width_frac', 'log_fulton_K', 'log_head_depth_over_depth']
D = len(FEATURES)
EMB = 16
HID = 128
NFREQ = 4
TDIM = 1 + 2 * NFREQ
VP_BMIN, VP_BMAX = 0.1, 20.0


def load():
    rows = list(csv.DictReader(open(DATA, encoding='utf-8')))
    X = []
    for r in rows:
        f = {k: float(r[k]) for k in ('SL_mm', 'weight_g', 'depth_mm', 'width_mm', 'head_depth_mm', 'ped_depth_mm', 'ped_width_mm')}
        X.append([math.log(f['SL_mm']), math.log(f['depth_mm'] / f['SL_mm']), math.log(f['width_mm'] / f['SL_mm']),
                  math.log(f['ped_depth_mm'] / f['depth_mm']), math.log(f['ped_width_mm'] / f['width_mm']),
                  math.log(1e5 * f['weight_g'] / f['SL_mm'] ** 3), math.log(f['head_depth_mm'] / f['depth_mm'])])
    return rows, np.array(X, dtype=np.float64)


def tfeat(t):
    k = torch.arange(1, NFREQ + 1, dtype=t.dtype)
    a = 2 * math.pi * t[:, None] * k[None, :]
    return torch.cat([t[:, None], torch.sin(a), torch.cos(a)], 1)


class Net(nn.Module):
    """v(x_t, t, c): MLP, SiLU. c = [family embedding, observed values * mask, mask]. Same layout as lib/flow.mjs."""
    def __init__(self, nfam):
        super().__init__()
        self.emb = nn.Embedding(nfam + 1, EMB)  # index nfam = NULL ("any teleost")
        self.l1 = nn.Linear(D + TDIM + EMB + 2 * D, HID)
        self.l2 = nn.Linear(HID, HID)
        self.l3 = nn.Linear(HID, HID)
        self.l4 = nn.Linear(HID, D)
        self.act = nn.SiLU()

    def forward(self, x, t, fam, obs, mask):
        h = torch.cat([x, tfeat(t), self.emb(fam), obs * mask, mask], 1)
        h = self.act(self.l1(h)); h = self.act(self.l2(h)); h = self.act(self.l3(h))
        return self.l4(h)


# ---------------------------------------------------------------- VP-SDE (DDPM in continuous time, Song et al. 2021)
def vp_logab(t):  # log alpha_bar(t) for linear beta(t) = bmin + t (bmax - bmin)
    return -(VP_BMIN * t + 0.5 * (VP_BMAX - VP_BMIN) * t ** 2)


def vp_beta(t):
    return VP_BMIN + t * (VP_BMAX - VP_BMIN)


def sample_cond(n, fam_idx, nfam, gen, p_null=0.25, p_none=0.5, p_obs=0.3):
    fam = fam_idx.clone()
    fam[torch.rand(n, generator=gen) < p_null] = nfam
    m = (torch.rand(n, D, generator=gen) < p_obs).double()
    m[torch.rand(n, generator=gen) < p_none] = 0
    return fam, m


def train(kind, Z, fam_idx, nfam, steps, seed, log_every=2000):
    torch.manual_seed(seed)
    gen = torch.Generator().manual_seed(seed)
    net = Net(nfam).double()
    opt = torch.optim.AdamW(net.parameters(), lr=2e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, steps)
    Zt = torch.tensor(Z); F = torch.tensor(fam_idx)
    n = len(Zt); bs = 512
    for it in range(steps):
        idx = torch.randint(0, n, (bs,), generator=gen)
        x1 = Zt[idx]; fam, m = sample_cond(bs, F[idx], nfam, gen)
        x0 = torch.randn(bs, D, generator=gen, dtype=torch.float64)
        t = torch.rand(bs, generator=gen, dtype=torch.float64)
        if kind == 'fm':  # rectified flow: straight path noise -> data, regress the constant velocity
            xt = (1 - t[:, None]) * x0 + t[:, None] * x1
            loss = ((net(xt, t, fam, x1, m) - (x1 - x0)) ** 2).mean()
        else:  # VP diffusion, epsilon prediction; t ~ U(1e-3, 1)
            t = 1e-3 + (1 - 1e-3) * t
            lab = vp_logab(t)
            xt = torch.exp(0.5 * lab)[:, None] * x1 + torch.sqrt(1 - torch.exp(lab))[:, None] * x0
            loss = ((net(xt, t, fam, x1, m) - x0) ** 2).mean()
        opt.zero_grad(); loss.backward(); opt.step(); sched.step()
        if log_every and (it % log_every == 0 or it == steps - 1):
            print(f'  {kind} step {it:6d} loss {loss.item():.4f}', flush=True)
    return net.eval()


# ---------------------------------------------------------------- ODEs
def drift(net, kind, x, t, fam, obs, m):
    tt = torch.full((len(x),), float(t), dtype=x.dtype)
    if kind == 'fm':
        return net(x, tt, fam, obs, m)
    # probability-flow ODE of the VP-SDE: dx/dt = -1/2 beta(t) (x - eps / sigma(t))
    sig = math.sqrt(1 - math.exp(vp_logab(float(t))))
    return -0.5 * vp_beta(float(t)) * (x - net(x, tt, fam, obs, m) / sig)


def times(kind, steps, forward=True):
    # FM: data at t = 1, noise at t = 0. VP: data at t = 1e-3, noise at t = 1. "forward" = noise -> data.
    if kind == 'fm':
        ts = np.linspace(0.0, 1.0, steps + 1)
    else:
        ts = np.linspace(1.0, 1e-3, steps + 1)
    return ts if forward else ts[::-1]


@torch.no_grad()
def sample(net, kind, fam, obs, m, steps=64, gen=None):
    x = torch.randn(len(fam), D, generator=gen, dtype=torch.float64)
    ts = times(kind, steps)
    for a, b in zip(ts[:-1], ts[1:]):
        h = b - a
        k1 = drift(net, kind, x, a, fam, obs, m)
        k2 = drift(net, kind, x + 0.5 * h * k1, a + 0.5 * h, fam, obs, m)
        k3 = drift(net, kind, x + 0.5 * h * k2, a + 0.5 * h, fam, obs, m)
        k4 = drift(net, kind, x + h * k3, b, fam, obs, m)
        x = x + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return x


def div_drift(net, kind, x, t, fam, obs, m):
    x = x.detach().requires_grad_(True)
    f = drift(net, kind, x, t, fam, obs, m)
    div = torch.zeros(len(x), dtype=x.dtype)
    for i in range(D):
        div = div + torch.autograd.grad(f[:, i].sum(), x, retain_graph=True)[0][:, i]
    return f.detach(), div.detach()


def loglik(net, kind, z, fam, obs, m, steps=64):
    """log p(z) in standardized space: integrate data -> noise, accumulating the divergence (RK4, exact trace)."""
    x = torch.tensor(z); lp = torch.zeros(len(x), dtype=torch.float64)
    ts = times(kind, steps, forward=False)
    for a, b in zip(ts[:-1], ts[1:]):
        h = b - a
        k1, d1 = div_drift(net, kind, x, a, fam, obs, m)
        k2, d2 = div_drift(net, kind, x + 0.5 * h * k1, a + 0.5 * h, fam, obs, m)
        k3, d3 = div_drift(net, kind, x + 0.5 * h * k2, a + 0.5 * h, fam, obs, m)
        k4, d4 = div_drift(net, kind, x + h * k3, b, fam, obs, m)
        x = x + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        lp = lp + h / 6 * (d1 + 2 * d2 + 2 * d3 + d4)
    # going data->noise, d log p / dt = -div f along the forward-in-time flow; integrating backwards in t flips the sign
    base = -0.5 * (x ** 2).sum(1) - 0.5 * D * math.log(2 * math.pi)
    return (base + lp).numpy() if kind == 'fm' else (base + lp).numpy()


# ---------------------------------------------------------------- baselines
def gauss_logpdf(X, mu, S):
    L = np.linalg.cholesky(S); d = np.linalg.solve(L, (X - mu).T)
    return -0.5 * (d ** 2).sum(0) - np.log(np.diag(L)).sum() - 0.5 * X.shape[1] * math.log(2 * math.pi)


def fit_family_gauss(Z, fams, k=5.0):
    mu0 = Z.mean(0); S0 = np.cov(Z.T)
    means = {}; resid = []
    for f in set(fams):
        zf = Z[fams == f]; n = len(zf)
        means[f] = (n * zf.mean(0) + k * mu0) / (n + k)  # shrunk toward the global mean
        resid.append(zf - zf.mean(0))
    R = np.concatenate(resid); Sw = R.T @ R / (len(R) - len(means))
    return dict(mu0=mu0, S0=S0, means=means, Sw=Sw)


def fam_gauss_logpdf(G, Z, fams):
    out = np.empty(len(Z))
    for i, (z, f) in enumerate(zip(Z, fams)):
        if f in G['means']:
            out[i] = gauss_logpdf(z[None], G['means'][f], G['Sw'])[0]
        else:
            out[i] = gauss_logpdf(z[None], G['mu0'], G['S0'])[0]
    return out


def cond_gauss(mu, S, z, obs_idx):
    """Mean and covariance of the unobserved dims given observed dims, multivariate normal."""
    u = [i for i in range(D) if i not in obs_idx]
    Suo = S[np.ix_(u, obs_idx)]; Soo = S[np.ix_(obs_idx, obs_idx)]
    m = mu[u] + Suo @ np.linalg.solve(Soo, z[obs_idx] - mu[obs_idx])
    C = S[np.ix_(u, u)] - Suo @ np.linalg.solve(Soo, Suo.T)
    return u, m, C


# ---------------------------------------------------------------- two-sample tests
def energy_stat(A, B):
    def md(P, Q): return torch.cdist(P, Q).mean()
    return (2 * md(A, B) - md(A, A) - md(B, B)).item()


def energy_test(A, B, perms=200, seed=0, cap=1000):
    g = np.random.default_rng(seed)
    if len(A) > cap: A = A[g.choice(len(A), cap, replace=False)]
    if len(B) > cap: B = B[g.choice(len(B), cap, replace=False)]
    A = torch.tensor(A); B = torch.tensor(B); obs = energy_stat(A, B)
    P = torch.cat([A, B]); na = len(A); ge = 0
    for _ in range(perms):
        idx = torch.tensor(g.permutation(len(P)))
        ge += energy_stat(P[idx[:na]], P[idx[na:]]) >= obs
    return dict(energy_distance=obs, p_value=(ge + 1) / (perms + 1), n_generated=na, n_real=len(B), permutations=perms)


def c2st_knn(A, B, k=10, folds=5, seed=0, cap=1500):
    """Classifier two-sample test: leave-fold-out kNN accuracy at telling generated from real. 0.5 = indistinguishable."""
    g = np.random.default_rng(seed)
    n = min(len(A), len(B), cap)
    A = A[g.choice(len(A), n, replace=False)]; B = B[g.choice(len(B), n, replace=False)]
    X = np.concatenate([A, B]); y = np.r_[np.zeros(n), np.ones(n)]
    perm = g.permutation(len(X)); X = X[perm]; y = y[perm]
    correct = 0
    for f in range(folds):
        te = np.arange(len(X)) % folds == f
        d = torch.cdist(torch.tensor(X[te]), torch.tensor(X[~te]))
        nn_idx = d.topk(k, largest=False).indices.numpy()
        pred = (y[~te][nn_idx].mean(1) > 0.5).astype(float)
        correct += (pred == y[te]).sum()
    acc = correct / len(X)
    se = math.sqrt(0.25 / len(X))
    return dict(accuracy=float(acc), chance=0.5, se_under_null=se, z=(acc - 0.5) / se, n_each=n, k=k, folds=folds)


# ---------------------------------------------------------------- export
def b64(t):
    return base64.b64encode(t.detach().cpu().float().numpy().astype('<f4').tobytes()).decode()


def export(net, kind, meta, path):
    W = {}
    for name, p in net.state_dict().items():
        W[name] = {'shape': list(p.shape), 'f32_b64': b64(p)}
    out = dict(meta, kind=kind, arch={'D': D, 'EMB': EMB, 'HID': HID, 'NFREQ': NFREQ, 'act': 'silu',
                                      'input': '[x(D), t, sin(2 pi k t) k=1..NFREQ, cos(2 pi k t) k=1..NFREQ, emb(fam), obs*mask, mask]',
                                      'vp': {'beta_min': VP_BMIN, 'beta_max': VP_BMAX, 't_min': 1e-3} if kind == 'ddpm' else None},
               weights=W)
    json.dump(out, open(path, 'w'), separators=(',', ':'))


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quick', action='store_true')
    ap.add_argument('--only', choices=['fm', 'ddpm'])
    ap.add_argument('--steps', type=int, default=30000)
    ap.add_argument('--no-production', action='store_true')
    a = ap.parse_args()
    steps = 300 if a.quick else a.steps
    kinds = [a.only] if a.only else ['fm', 'ddpm']
    rows, X = load()
    split = np.array([r['split'] for r in rows]); fams_all = np.array([r['family'] for r in rows])
    tr = split == 'train'; te = ~tr
    out = {'data': {'specimens': len(X), 'train': int(tr.sum()), 'test': int(te.sum()), 'features': FEATURES}, 'runs': {}}

    # ---------- split run
    families = sorted(set(fams_all[tr]))
    fidx = {f: i for i, f in enumerate(families)}; nfam = len(families)
    mu = X[tr].mean(0); sd = X[tr].std(0)
    Z = (X - mu) / sd
    logdet = float(np.log(sd).sum())  # nats: p(x) = p(z) / prod(sd)
    F = np.array([fidx.get(f, nfam) for f in fams_all])
    t0 = time.time()
    G = fit_family_gauss(Z[tr], fams_all[tr])
    ll_g0 = gauss_logpdf(Z[te], G['mu0'], G['S0']) - logdet
    ll_gf = fam_gauss_logpdf(G, Z[te], fams_all[te]) - logdet
    exo_te = te & (fams_all == 'Exocoetidae'); cyp_te = te & (fams_all == 'Cyprinidae')
    seen_te = te & np.array([f in fidx for f in fams_all])
    def summ(ll, mask=None):
        v = ll if mask is None else ll[mask[te]]
        return {'mean_nll': float(-v.mean()), 'se': float(v.std() / math.sqrt(len(v))), 'n': int(len(v))}
    base = {'gaussian_global': {'all': summ(ll_g0), 'Exocoetidae': summ(ll_g0, exo_te), 'Cyprinidae': summ(ll_g0, cyp_te)},
            'gaussian_family': {'all': summ(ll_gf), 'Exocoetidae': summ(ll_gf, exo_te), 'Cyprinidae': summ(ll_gf, cyp_te),
                                'seen_family': summ(ll_gf, seen_te)}}
    out['baselines'] = base
    out['data']['test_specimens_in_families_unseen_in_training'] = int((te & ~np.array([f in fidx for f in fams_all])).sum())
    print('baselines', json.dumps({k: v['all'] for k, v in base.items()}))
    rng = np.random.default_rng(1)
    for kind in kinds:
        print(f'[split] training {kind}', flush=True)
        net = train(kind, Z[tr], F[tr], nfam, steps, seed=7)
        ft = torch.tensor(F[te]); nte = int(te.sum())
        zero = torch.zeros(nte, D, dtype=torch.float64)
        nullf = torch.full((nte,), nfam, dtype=torch.long)
        ll_cond = loglik(net, kind, Z[te], ft, zero, zero) - logdet
        ll_unc = loglik(net, kind, Z[te], nullf, zero, zero) - logdet
        res = {'nll_family_conditioned': {'all': summ(ll_cond), 'Exocoetidae': summ(ll_cond, exo_te), 'Cyprinidae': summ(ll_cond, cyp_te),
                                          'seen_family': summ(ll_cond, seen_te)},
               'nll_unconditional': {'all': summ(ll_unc), 'Exocoetidae': summ(ll_unc, exo_te), 'Cyprinidae': summ(ll_unc, cyp_te)},
               'paired_vs_gaussian_family': {'mean_diff_nll': float((-ll_cond + ll_gf).mean()),
                                             'se': float((-ll_cond + ll_gf).std() / math.sqrt(nte)),
                                             'note': 'negative = flow better than the family Gaussian; paired over the same test specimens'}}
        # two-sample: one generated specimen per real test specimen, same family condition
        gen = torch.Generator().manual_seed(11)
        S = sample(net, kind, ft, zero, zero, gen=gen).numpy()
        res['two_sample_all'] = {'energy': energy_test(S, Z[te]), 'c2st_knn': c2st_knn(S, Z[te])}
        # family-Gaussian samples get the same tests: shows what the tests can detect
        Sg = np.array([rng.multivariate_normal(G['means'].get(f, G['mu0']), G['Sw'] if f in G['means'] else G['S0']) for f in fams_all[te]])
        res['two_sample_all_gaussian_family_for_comparison'] = {'energy': energy_test(Sg, Z[te]), 'c2st_knn': c2st_knn(Sg, Z[te])}
        # Exocoetidae: 16 held-out specimens (6 species never trained on); 400 generated
        ne = 400
        fe = torch.full((ne,), fidx['Exocoetidae'], dtype=torch.long); z0 = torch.zeros(ne, D, dtype=torch.float64)
        Se = sample(net, kind, fe, z0, z0, gen=gen).numpy()
        res['two_sample_Exocoetidae_heldout_species'] = {'energy': energy_test(Se, Z[exo_te], perms=500),
                                                        'note': '16 real specimens: low power; a non-rejection is weak evidence'}
        Seg = rng.multivariate_normal(G['means']['Exocoetidae'], G['Sw'], ne)
        res['two_sample_Exocoetidae_gaussian_family_for_comparison'] = {'energy': energy_test(Seg, Z[exo_te], perms=500)}
        # conditional imputation: observe SL + depth (+ family), predict the other five features
        obs_idx = [0, 1]; u = [i for i in range(D) if i not in obs_idx]
        mk = torch.zeros(nte, D, dtype=torch.float64); mk[:, obs_idx] = 1
        zt = torch.tensor(Z[te])
        draws = np.stack([sample(net, kind, ft, zt, mk, steps=32, gen=gen).numpy() for _ in range(20)])  # (20, n, D)
        pm = draws.mean(0)[:, u]; lo = np.quantile(draws, 0.05, 0)[:, u]; hi = np.quantile(draws, 0.95, 0)[:, u]
        truth = Z[te][:, u]
        rmse_f = np.sqrt(((pm - truth) ** 2).mean(0)) * sd[u]
        cov_f = ((truth >= lo) & (truth <= hi)).mean(0)
        gm = np.empty_like(truth); gcov = np.empty_like(truth)
        for i, (z, f) in enumerate(zip(Z[te], fams_all[te])):
            mu_f, S_f = (G['means'][f], G['Sw']) if f in G['means'] else (G['mu0'], G['S0'])
            _, m_, C_ = cond_gauss(mu_f, S_f, z, obs_idx)
            gm[i] = m_; s_ = np.sqrt(np.diag(C_)); gcov[i] = np.abs(z[u] - m_) <= 1.6449 * s_
        rmse_g = np.sqrt(((gm - truth) ** 2).mean(0)) * sd[u]
        res['conditional_imputation_given_SL_depth_family'] = {
            'features': [FEATURES[i] for i in u], 'rmse_log_units_flow': rmse_f.round(4).tolist(),
            'rmse_log_units_gaussian_family': rmse_g.round(4).tolist(),
            'coverage90_flow': cov_f.round(3).tolist(), 'coverage90_gaussian_family': gcov.mean(0).round(3).tolist(),
            'note': '20 conditional draws per specimen; RMSE of the draw mean, in natural-log units of each ratio (0.1 ~ 10 %)'}
        out['runs'][kind] = res
        print(json.dumps({kind: {k: res[k] for k in ('nll_family_conditioned', 'paired_vs_gaussian_family')}}, indent=0), flush=True)
        if not a.quick:
            export(net, kind, {'role': 'split-evaluated', 'families': families, 'mu': mu.tolist(), 'sd': sd.tolist(),
                               'features': FEATURES, 'train_rows': int(tr.sum())}, os.path.join(MODEL_DIR, f'{kind}-split.json'))
    out['seconds_split'] = round(time.time() - t0, 1)

    # ---------- production run: identical recipe, all rows
    if not a.quick and not a.no_production:
        families = sorted(set(fams_all)); fidx = {f: i for i, f in enumerate(families)}; nfam = len(families)
        mu = X.mean(0); sd = X.std(0); Z = (X - mu) / sd
        F = np.array([fidx[f] for f in fams_all])
        # family statistics the text layer uses (log-feature means and counts; pooled within-family SD)
        stats = {}
        for f in families:
            xf = X[fams_all == f]; stats[f] = {'n': int(len(xf)), 'mean': xf.mean(0).round(5).tolist()}
        R = np.concatenate([X[fams_all == f] - X[fams_all == f].mean(0) for f in families])
        sd_within = np.sqrt((R ** 2).sum(0) / (len(R) - nfam))
        for kind in kinds:
            print(f'[production] training {kind}', flush=True)
            net = train(kind, Z, F, nfam, steps, seed=7)
            export(net, kind, {'role': 'production (all FishShapes rows, same recipe as the evaluated split run)', 'families': families,
                               'mu': mu.tolist(), 'sd': sd.tolist(), 'features': FEATURES, 'train_rows': int(len(X)),
                               'family_stats': stats, 'sd_within_family': sd_within.round(5).tolist(),
                               'global_mean': X.mean(0).round(5).tolist()}, os.path.join(MODEL_DIR, f'{kind}.json'))
            # a JS cross-check fixture: velocities at fixed inputs, so lib/flow.mjs can be checked against torch
            g = torch.Generator().manual_seed(3)
            x = torch.randn(4, D, generator=g, dtype=torch.float64); t = torch.tensor([0.1, 0.4, 0.7, 0.95], dtype=torch.float64)
            fam = torch.tensor([fidx['Exocoetidae'], fidx['Cyprinidae'], nfam, 0]); obs = torch.randn(4, D, generator=g, dtype=torch.float64)
            m = torch.tensor([[0] * D, [1, 1, 0, 0, 0, 0, 0], [0] * D, [1] * D], dtype=torch.float64)
            with torch.no_grad():
                v = net.float()(x.float(), t.float(), fam, obs.float(), m.float()).double(); net.double()
            json.dump({'x': x.tolist(), 't': t.tolist(), 'fam': fam.tolist(), 'obs': obs.tolist(), 'mask': m.tolist(), 'out': v.tolist()},
                      open(os.path.join(MODEL_DIR, f'{kind}-fixture.json'), 'w'))
    if not a.quick:
        json.dump(out, open(os.path.join(MODEL_DIR, 'metrics.json'), 'w'), indent=1)
    else:
        print(json.dumps({'quick': True, 'fm_nll': out['runs'].get('fm', {}).get('nll_family_conditioned', {}).get('all')}))


if __name__ == '__main__':
    main()
