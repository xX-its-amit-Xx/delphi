import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import random, statistics
random.seed(20261112)
d = load('Eco1C1G1T1.UCF.json'); gs = gates(d)
ns = {g['name']: g['par']['n'] for g in gs}
print('n values (shipped), 20 gates:', sorted(ns.values()))
fam = collections.defaultdict(list)
for g in gs: fam[g['group']].append(g)
print('families:', {k: len(v) for k, v in fam.items()})
# between-family pairs (different regulator) = "n unrelated to RBS-only" reference
cross = [rel(a['par']['n'], b['par']['n']) for a, b in itertools.combinations(gs, 2) if a['group'] != b['group']]
within_all = [rel(a['par']['n'], b['par']['n']) for a, b in itertools.combinations(gs, 2) if a['group'] == b['group']]
print('cross-family pairs: %d, median dn %.3f, frac<=0.25: %.3f, frac<=0.1587: %.3f, frac>0.40: %.3f' % (
    len(cross), statistics.median(cross), sum(x <= .25 for x in cross) / len(cross), sum(x <= .1587 for x in cross) / len(cross), sum(x > .4 for x in cross) / len(cross)))
print('within-family pairs (all, any cassette):', len(within_all), 'max %.4f' % max(within_all))
# strict calibration + seen libs
cal = [p['dn'] for p in pairs(gs)]
seen = [p['dn'] for fn in ('Eco2C1G5T1.UCF.json', 'SC1C1G1T1.UCF.json') for p in pairs(gates(load(fn)))]
print('calibration strict dn (n=%d):' % len(cal), sorted(round(x, 4) for x in cal))
print('seen strict dn (n=%d):' % len(seen), sorted(round(x, 4) for x in seen))
def refuted(dns):  # P1 rule
    return sum(x > .25 for x in dns) >= 2 or any(x > .40 for x in dns)
def sim(pool, m, N=100000):
    return sum(refuted([random.choice(pool) for _ in range(m)]) for _ in range(N)) / N
for m in (3, 4, 6, 8, 12):
    print('m=%2d pairs: P(P1 refutes) | null(cross-family n)=%.3f | calibration-bootstrap=%.3f | calib+seen=%.3f' % (
        m, sim(cross, m), sim(cal, m), sim(cal + seen, m)))
# P2 pass: S>=6 & kf>=2
def S_of(p): return p['S']
allp = pairs(gs) + [p for fn in ('Eco2C1G5T1.UCF.json', 'SC1C1G1T1.UCF.json') for p in pairs(gates(load(fn)))]
# P2 vs P1 equivalence region: S>=6 <=> dn <= log2(kf)/6
for kf in (2.0, 2.5, 2.83, 4, 8):
    print('kf=%.2f: P2 requires dn <= %.4f (P1 requires <=0.25)' % (kf, math.log2(kf) / 6))
# cross-family null for S: random pair of gates from different repressors with kf>=2
crossS = []
for a, b in itertools.combinations(gs, 2):
    if a['group'] == b['group']: continue
    dn = rel(a['par']['n'], b['par']['n']); kf = max(a['par']['K'], b['par']['K']) / min(a['par']['K'], b['par']['K'])
    if kf >= 2: crossS.append(math.log2(kf) / dn if dn > 0 else float('inf'))
print('cross-family S (kf>=2): n=%d, median %.2f, frac S>=6: %.3f' % (len(crossS), statistics.median(crossS), sum(s >= 6 for s in crossS) / len(crossS)))
# Rounding floor on dn from 2 s.f. quantisation
def dn_range(n1, n2, h=0.05):
    lo = rel(n1 + (h if n1 < n2 else -h), n2 + (-h if n1 < n2 else h)) if n1 != n2 else 0
    hi = rel(n1 + (-h if n1 < n2 else h), n2 + (h if n1 < n2 else -h))
    return max(lo, 0), hi
print('rounding interval (+-0.05 on n) for calibration pairs:')
for p in pairs(gs): print('  %s/%s dn=%.4f range=[%.4f, %.4f]' % (p['a'], p['b'], p['dn'], *dn_range(p['na'], p['nb'])))
# leave-one-family-out bound: what bound would each LOFO give
fams = sorted(set(p['fam'] for p in pairs(gs)))
for f in fams:
    rest = [p['dn'] for p in pairs(gs) if p['fam'] != f]; mine = [p['dn'] for p in pairs(gs) if p['fam'] == f]
    print('LOFO %s: max dn in other families %.4f vs max dn in held-out family %.4f' % (f, max(rest), max(mine)))
