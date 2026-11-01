"""Per-specimen held-out NLL for the evaluated split models: medians and tails, written to model/metrics-tail.json.

    python eval_tail.py

metrics.json reports MEANS; the DDPM mean is dominated by a few specimens (SE 3.7 nats), so this reports the median, the
95th/99th percentiles and the worst specimens for the flow, the DDPM and the family Gaussian on the same test rows.
Loads the exported split weights (model/*-split.json), so it evaluates exactly the shipped evaluated models.
"""
import base64, json, os
import numpy as np
import torch
import train as T

HERE = os.path.dirname(os.path.abspath(__file__))


def load_net(path):
    j = json.load(open(path))
    net = T.Net(len(j['families'])).double()
    sd = {k: torch.tensor(np.frombuffer(base64.b64decode(v['f32_b64']), dtype='<f4').reshape(v['shape']).astype(np.float64)) for k, v in j['weights'].items()}
    net.load_state_dict(sd); return net.eval(), j


def main():
    rows, X = T.load()
    split = np.array([r['split'] for r in rows]); fams = np.array([r['family'] for r in rows]); species = np.array([r['species'] for r in rows])
    tr = split == 'train'; te = ~tr
    out = {}
    nets = {k: load_net(os.path.join(HERE, 'model', f'{k}-split.json')) for k in ('fm', 'ddpm')}
    _, j = nets['fm']
    mu = np.array(j['mu']); sd = np.array(j['sd']); fidx = {f: i for i, f in enumerate(j['families'])}; nfam = len(j['families'])
    Z = (X - mu) / sd; logdet = float(np.log(sd).sum())
    G = T.fit_family_gauss(Z[tr], fams[tr])
    ll = {'gaussian_family': T.fam_gauss_logpdf(G, Z[te], fams[te]) - logdet}
    ft = torch.tensor([fidx.get(f, nfam) for f in fams[te]]); zero = torch.zeros(int(te.sum()), T.D, dtype=torch.float64)
    for k, (net, _) in nets.items():
        ll[k] = T.loglik(net, k, Z[te], ft, zero, zero, steps=64) - logdet
    for k, v in ll.items():
        nll = -v
        worst = np.argsort(nll)[-5:][::-1]
        out[k] = {'mean': float(nll.mean()), 'median': float(np.median(nll)), 'p95': float(np.quantile(nll, 0.95)), 'p99': float(np.quantile(nll, 0.99)),
                  'max': float(nll.max()), 'n_over_20_nats': int((nll > 20).sum()),
                  'trimmed_mean_1pct': float(np.sort(nll)[: int(0.99 * len(nll))].mean()),
                  'worst': [{'species': str(species[te][i]), 'family': str(fams[te][i]), 'nll': float(nll[i])} for i in worst]}
    d = -ll['fm'] + ll['gaussian_family']
    out['fm_minus_gaussian_family'] = {'median': float(np.median(d)), 'fraction_fm_better': float((d < 0).mean())}
    d2 = -ll['ddpm'] + ll['gaussian_family']
    out['ddpm_minus_gaussian_family'] = {'median': float(np.median(d2)), 'fraction_ddpm_better': float((d2 < 0).mean())}
    json.dump(out, open(os.path.join(HERE, 'model', 'metrics-tail.json'), 'w'), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
