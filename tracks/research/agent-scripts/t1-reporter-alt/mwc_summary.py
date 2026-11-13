"""Summarise mwc_hill_refit.json: per operator, EC50 fold-range, relative n spread, CI-overlap. Usage: python mwc_summary.py IN.json"""
import json, sys, itertools, math
d = json.load(open(sys.argv[1]))
for op in ('O1', 'O2', 'O3'):
    c = [x for x in d if x['operator'] == op]
    ns = [x['hill_n'] for x in c]; ec = [x['EC50_uM'] for x in c]
    print(op, 'EC50 range %.1f-%.1f uM, fold %.2f (log2 %.2f)' % (min(ec), max(ec), max(ec)/min(ec), math.log2(max(ec)/min(ec))),
          '| n range %.2f-%.2f, (max-min)/mean = %.3f' % (min(ns), max(ns), (max-min if False else (max(ns)-min(ns)))/(sum(ns)/len(ns))))
    # pairs: relative difference and CI overlap
    worst = 0; nonover = 0
    for a, b in itertools.combinations(c, 2):
        dn = abs(a['hill_n']-b['hill_n'])/((a['hill_n']+b['hill_n'])/2); worst = max(worst, dn)
        if a['hill_n_ci'][1] < b['hill_n_ci'][0] or b['hill_n_ci'][1] < a['hill_n_ci'][0]: nonover += 1
    print('   max pairwise dn = %.3f ; pairs with non-overlapping 95%% CIs on n: %d of %d' % (worst, nonover, len(c)*(len(c)-1)//2))
