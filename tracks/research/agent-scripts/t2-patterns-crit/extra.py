"""Extra referee checks: KPP1 lower-bound (registry fisher-kpp-speed@1.1.0) on all 25 seen rows; cAA rows; M1 vs ED8k sim point."""
import sys
sys.path.insert(0, 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-crit/pylib')
import openpyxl
from math import sqrt
base = 'D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-patterns/dl/cremer/'
ws = openpyxl.load_workbook(base + 'MOESM11.xlsx', data_only=True).worksheets[0]
rows = [r for r in ws.iter_rows(min_row=3, values_only=True) if isinstance(r[8], (int, float))]
c = 3600e-6; Dr = 50.2 * c; Da = 800 * c
ratios = []
for r in rows:
    cF = 2 * sqrt(Dr * r[11]); ratios.append(r[8] / cF)
print('u / (2 sqrt(Drho r)) over 25 rows: min %.2f max %.2f; rows violating c^2 >= 4 s D: %d' % (min(ratios), max(ratios), sum(x < 1 for x in ratios)))
for r in rows:
    if r[5] == 'cAA':
        print('cAA row', r[2], 'u', round(r[8], 3), 'r', round(r[11], 3), 'u^2/r', round(r[8] ** 2 / r[11], 1), 'attractant.conc column value', r[6], '(units as printed in sheet header: uM; 0.05 is not 100)')
A = 100.0
for rr, label in ((0.69, 'mainsimulation lambda_1 = 0.00019166 /s *3600'), (0.00019166 * 3600, 'exact')):
    X = (315 - 50.2) * c
    print('M1 zero-fit at r=%.4f (%s): c = %.3f mm/h' % (rr, label, X * sqrt(rr * A / (X + Da))))
print('ED8k sim u at chi=315 (interpolated, recompute_out.txt): 3.407 mm/h -> M1/sim =', round(4.045 / 3.407, 3))
