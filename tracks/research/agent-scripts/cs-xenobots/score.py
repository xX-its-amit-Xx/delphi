"""cs-xenobots scorer. One command: python -I score.py   (reads the csv/json next to it; no network)."""
import csv, json, math, os, sys, statistics as st
sys.stdout.reconfigure(encoding="utf-8")
H = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(H, 'frozen_constants.json'), encoding='utf-8'))
def rows(n): return list(csv.DictReader(open(os.path.join(H, n), encoding='utf-8')))
dev, held = rows('records_dev.csv'), rows('records_heldout.csv')
R_MAX = math.sqrt(6 * C['Dox'] * C['C0'] / C['Q'])           # S3 radius limit, m
def typical_d(recs):
    d = [float(r['value_si']) for r in recs if r['quantity'] == 'diameter']
    return max(d) if d else None
def physics_bound(q, v, dmax):
    """Upper bound for quantity q. Speed bound uses the largest body in the same paper (most restrictive)."""
    if q == 'diameter':   return 2 * R_MAX, 'S3'
    if q == 'speed':      return (C['mu'] / (C['rho'] * dmax) if dmax else None), 'S1'
    if q == 'lifespan':   return C['T_max_s'], 'S2'
    if q == 'generations':return C['G_max'], 'S4'
    return None, None
def baseline_bound(q): return C['dev_max'].get(q), 'devmax'
def score(recs, labels=None, which='physics'):
    dmax = typical_d(recs); out = []
    for i, r in enumerate(recs):
        q = labels[i] if labels else r['quantity']; v = float(r['value_si'])
        b, name = physics_bound(q, v, dmax) if which == 'physics' else baseline_bound(q)
        if b is None: out.append((r['id'], q, name, v, None, None, None)); continue
        out.append((r['id'], q, name, v, b, v <= b, math.log10(b / v)))
    scored = [o for o in out if o[4] is not None]
    cov = sum(o[5] for o in scored) / len(scored) if scored else float('nan')
    slack = st.median(o[6] for o in scored) if scored else float('nan')
    return out, len(scored), sum(o[5] for o in scored), cov, slack
def show(title, res):
    out, n, k, cov, slack = res
    print(f'\n## {title}: {k}/{n} satisfied (coverage {cov:.3f}), median log10 slack {slack:.2f}, unscorable {len(out)-n}')
    for o in out:
        print('  %-15s %-11s %-6s obs=%.4g bound=%s ok=%s slack=%s' % (o[0], o[1], o[2], o[3],
              '%.4g' % o[4] if o[4] is not None else 'NA', o[5], '%.2f' % o[6] if o[6] is not None else 'NA'))
    return dict(n=n, satisfied=k, coverage=cov, median_log10_slack=slack, unscorable=len(out) - n)
print('R_max (S3) = %.4g m ; diameter limit = %.4g m' % (R_MAX, 2 * R_MAX))
res = {}
res['dev_physics'] = show('VALIDATION development papers, physics bounds', score(dev))
res['held_physics'] = show('FINAL held-out paper, physics bounds', score(held))
res['held_baseline'] = show('BASELINE held-out, bound = development maximum', score(held, which='baseline'))
# broken-input control: rotate quantity labels by 2 (deterministic "shuffle": diameters<->speeds<->lifespans)
labs = [r['quantity'] for r in held]; rot = labs[2:] + labs[:2]
res['held_broken'] = show('BROKEN-INPUT control (labels rotated by 2)', score(held, labels=rot))
# Reynolds numbers for the record
dm = typical_d(held)
for r in held:
    if r['quantity'] == 'speed':
        print('Re(%s, D=%.3g m) = %.3g' % (r['id'], dm, C['rho'] * float(r['value_si']) * dm / C['mu']))
json.dump(res, open(os.path.join(H, 'results.json'), 'w'), indent=1)
