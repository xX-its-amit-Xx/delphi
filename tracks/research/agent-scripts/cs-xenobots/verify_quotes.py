import sys; sys.stdout.reconfigure(encoding="utf-8")
import sys, os, re
RAW = sys.argv[1]; rd = lambda p: re.sub(r'\s+', ' ', open(os.path.join(RAW, p + '.txt'), encoding='utf-8').read())
checks = {'PMC6994979': ['width of 100 µm or greater (12% of total body length)', 'days or weeks without additional nutrients'],
 'PMC8670470': ['aged 5 to 6 d at 14 °C', 'middle of their lifespan', 'composed of ∼3,000 cells', '(1, 1, 1, 1, and 2 g)', '(2, 3, and 4 g)'],
 'PMC10811512': ['diameters ranging from 30 to 500 microns', 'speeds ranging from 5–50 microns s −1', 'living for 45–60 days', 'At the end of their 4–6 weeks life span']}
bad = 0
for p, qs in checks.items():
    t = rd(p)
    for q in qs:
        ok = q in t; bad += not ok; print('FOUND ' if ok else 'MISSING', p, '|', q)
sys.exit(1 if bad else 0)
