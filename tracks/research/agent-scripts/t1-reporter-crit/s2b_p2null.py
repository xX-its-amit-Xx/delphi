import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import random, statistics
random.seed(7)
d = load('Eco1C1G1T1.UCF.json'); gs = gates(d)
crossS = []
for a, b in itertools.combinations(gs, 2):
    if a['group'] == b['group']: continue
    dn = rel(a['par']['n'], b['par']['n']); kf = max(a['par']['K'], b['par']['K']) / min(a['par']['K'], b['par']['K'])
    if kf >= 2: crossS.append(math.log2(kf) / dn if dn > 0 else float('inf'))
cal = [p for p in pairs(gs) if p['kf'] >= 2]
seen = [p for fn in ('Eco2C1G5T1.UCF.json', 'SC1C1G1T1.UCF.json') for p in pairs(gates(load(fn))) if p['kf'] >= 2]
def ref(Ss): return statistics.median(Ss) < 6 or sum(s < 6 for s in Ss) / len(Ss) > 1 / 3
def sim(pool, m, N=50000): return sum(ref([random.choice(pool) for _ in range(m)]) for _ in range(N)) / N
poolc = [p['S'] for p in cal]; pools = poolc + [p['S'] for p in seen]
print('kf>=2 pairs: calib %d (min S %.2f), seen %d, S<6 among all: %d' % (len(cal), min(poolc), len(seen), sum(s < 6 for s in pools)))
for m in (3, 4, 6, 8):
    print('m=%d P(P2 refutes): null=%.3f calib=%.3f calib+seen=%.3f' % (m, sim(crossS, m), sim(poolc, m), sim(pools, m)))
# kf distribution (in-scope fraction)
print('kf>=2 fraction of strict pairs: calib %d/%d' % (len(cal), len(pairs(gs))))
