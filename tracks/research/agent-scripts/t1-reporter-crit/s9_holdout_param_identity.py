# Reports ONLY counts of exact parameter equality between same-named gates in Eco1C1G1T1 and Eco1C2G2T2; prints no parameter values.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
a = {g['name']: g for g in gates(load('Eco1C1G1T1.UCF.json'))}; b = {g['name']: g for g in gates(load('Eco1C2G2T2.UCF.json'))}
same = [k for k in a if k in b]
keys = ('n', 'K', 'ymax', 'ymin')
eq_all = [k for k in same if all(a[k]['par'].get(x) == b[k]['par'].get(x) for x in keys)]
eq_n = [k for k in same if a[k]['par'].get('n') == b[k]['par'].get('n')]
print('same-named gates:', len(same), '| all four params exactly equal:', len(eq_all), '| n exactly equal:', len(eq_n))
print('gates with exactly equal params:', eq_all)
