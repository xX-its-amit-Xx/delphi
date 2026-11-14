#!/usr/bin/env python3
"""cs-somite-morphogen. One command, re-runnable from a clean folder:  python run.py
Downloads the one open data file needed (Zhang 2022 source data) into
C:/Temp/delphi-sprint/cs-somite-morphogen/raw (or $CS_DATA), then runs
split -> fit on development -> single held-out evaluation -> shuffled-label control.
Writes results.json next to this script."""
import hashlib, json, math, os, random, re, sys, urllib.request, zipfile, statistics as st
sys.stdout.reconfigure(encoding='utf8')
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('CS_DATA', 'C:/Temp/delphi-sprint/cs-somite-morphogen/raw')
os.makedirs(DATA, exist_ok=True)
XLSX = os.path.join(DATA, 'zhang2022_sourcedata.xlsx')
URL = ('https://static-content.springer.com/esm/art%3A10.1038%2Fs42003-022-03053-0/'
       'MediaObjects/42003_2022_3053_MOESM4_ESM.xlsx')
if not os.path.exists(XLSX):
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    open(XLSX, 'wb').write(urllib.request.urlopen(req, timeout=120).read())


def held(i):
    return int(hashlib.sha256(i.encode()).hexdigest()[:8], 16) % 3 == 0


def split(ids):
    h = [i for i in ids if held(i)]
    if not h:
        h = [min(ids, key=lambda i: hashlib.sha256(i.encode()).hexdigest())]
    return [i for i in ids if i not in h], h


def male(p, m):
    return st.mean(abs(math.log10(a / b)) for a, b in zip(p, m))


def mape(p, m):
    return 100 * st.mean(abs(a - b) / b for a, b in zip(p, m))


def shuffled(p, m, n=1000, seed=20261114):
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        mm = m[:]
        rng.shuffle(mm)
        if mm != m:
            out.append(male(p, mm))
    return (st.mean(out), len(out)) if out else (None, 0)


# ---------------- Statement A: S = v * T ----------------
z = zipfile.ZipFile(XLSX)
wb = z.read('xl/workbook.xml').decode('utf8')
rl = z.read('xl/_rels/workbook.xml.rels').decode('utf8')
rels = {}
for m in re.finditer(r'<Relationship ([^>]+)/>', rl):
    a = dict(re.findall(r'(\w+)="([^"]+)"', m.group(1)))
    rels[a['Id']] = a['Target']
rid = [r for n, r in re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb)
       if n.strip() == 'WT-growth'][0]
x = z.read('xl/' + rels[rid].split('xl/')[-1]).decode('utf8')
tail = {}  # embryo column -> {somite stage: cumulative tail growth, um}
for r in re.findall(r'<row [^>]*>(.*?)</row>', x, re.S):
    cells = {c: v for c, v in re.findall(r'<c r="([A-Z]+)\d+"[^>]*?><v>(.*?)</v>', r)}
    try:
        stage = int(float(cells.get('A', 'x')))
    except ValueError:
        continue
    if 8 <= stage <= 20:
        for col in 'BCDEFGHI':
            if col in cells:
                tail.setdefault(col, {})[stage] = float(cells[col])
Tc, beta, a_tau, T = 14.4, 4.79, 5.32, 27.0   # published fits quoted in Zhang 2022 text
v = beta * (T - Tc)        # tail growth speed, um/h
tau = a_tau / (T - Tc)     # segmentation period, h (fit to Schroter 2008 data)
S_law = v * tau
idsA = ['zhang2022|WT-growth|tail|' + c for c in sorted(tail)]
devA, heldA = split(idsA)


def rows(ids):
    return [(i[-1], n, tail[i[-1]][n]) for i in ids for n in sorted(tail[i[-1]])]


dv, ho = rows(devA), rows(heldA)
slope = sum((n - 7) * L for _, n, L in dv) / sum((n - 7) ** 2 for _, n, L in dv)  # dev only
base = st.mean(L for _, _, L in dv)
mH = [L for _, _, L in ho]
predA = {'law_v_times_tau_no_fit': [(n - 7) * S_law for _, n, _ in ho],
         'fixed_slope_fit_on_dev': [(n - 7) * slope for _, n, _ in ho],
         'baseline_dev_mean': [base for _ in ho]}
A = {'T_C': T, 'v_um_per_h': v, 'tau_h': tau, 'S_law_um': S_law,
     'dev_slope_um_per_somite': slope, 'dev_ids': devA, 'held_ids': heldA,
     'n_dev_points': len(dv), 'n_held_points': len(ho),
     'validation_dev_MALE_law': male([(n - 7) * S_law for _, n, _ in dv], [L for _, _, L in dv]),
     'validation_dev_MAPE_law': mape([(n - 7) * S_law for _, n, _ in dv], [L for _, _, L in dv]),
     'held': {k: {'MALE': male(p, mH), 'MAPE_pct': mape(p, mH)} for k, p in predA.items()}}
s, k_ = shuffled(predA['law_v_times_tau_no_fit'], mH)
A['shuffled_label_MALE_law'] = s
A['shuffle_n'] = k_
A['held_per_somite_measured_um'] = {i[-1]: tail[i[-1]][20] / 13 for i in heldA}
# Illustration only (NOT a held-out result): what the two published fits imply across temperature.
A['S_law_by_temperature_um'] = {t: beta * (t - Tc) * a_tau / (t - Tc) for t in (20, 24, 28, 32)}
A['naive_fixed_v_from_27C_um'] = {t: v * a_tau / (t - Tc) for t in (20, 24, 28, 32)}

# ---------------- Statement B: lambda = sqrt(D/k) ----------------
R = [  # id, family, D (um^2/s), k (1/s; None = not measured), measured lambda (um)
    ('squint|muller2012+wang2016', 'nodal', 3.2, 1.00e-4, 29.5),
    ('cyclops|muller2012+wang2016', 'nodal', 0.7, 1.22e-4, 19.7),
    ('fgf8-wt|gupta2025', 'fgf8', 45.0, None, 202.0),
    ('fgf8-gpc4ex|gupta2025', 'fgf8', 33.0, None, 178.0),
    ('fgf8-sdc2ex|gupta2025', 'fgf8', 24.0, None, 179.0)]
raw = {r[0]: math.sqrt(r[2] / (r[3] or 1.0)) for r in R}
devB, heldB = split([r[0] for r in R])
fam = {r[0]: r[1] for r in R}
lam = {r[0]: r[4] for r in R}


def gm(xs):
    return math.exp(st.mean(math.log(q) for q in xs))


c, basef = {}, {}
for f in ('nodal', 'fgf8'):
    d = [i for i in devB if fam[i] == f]
    if d:
        c[f] = gm([lam[i] / raw[i] for i in d])
        basef[f] = gm([lam[i] for i in d])
allbase = gm([lam[i] for i in devB])
ev = [i for i in heldB if fam[i] in c]
B = {'dev_ids': devB, 'held_ids': heldB, 'not_evaluable': [i for i in heldB if i not in ev],
     'c_family_dev': c,
     'pure_law_nodal_all_records_disclosed': {
         i: {'pred_um': raw[i], 'measured_um': lam[i], 'fold': raw[i] / lam[i]}
         for i in raw if fam[i] == 'nodal'},
     'held_rows': [{'id': i, 'pred_um': c[fam[i]] * raw[i],
                    'baseline_um': basef.get(fam[i], allbase), 'measured_um': lam[i],
                    'pure_law_c1_um': raw[i] if fam[i] == 'nodal' else None} for i in ev]}
if ev:
    p = [c[fam[i]] * raw[i] for i in ev]
    b = [basef.get(fam[i], allbase) for i in ev]
    m = [lam[i] for i in ev]
    B['held'] = {'n': len(ev), 'model_MALE': male(p, m), 'model_MAPE_pct': mape(p, m),
                 'baseline_MALE': male(b, m), 'baseline_MAPE_pct': mape(b, m)}
    s, k_ = shuffled(p, m)
    B['shuffled_label_MALE'] = s
    B['shuffle_n'] = k_
# All held-out records together: pure law (c=1) where k was measured, c_family model otherwise.
pa = [raw[i] if fam[i] == 'nodal' else c[fam[i]] * raw[i] for i in heldB if fam[i] == 'nodal' or fam[i] in c]
ia = [i for i in heldB if fam[i] == 'nodal' or fam[i] in c]
ma = [lam[i] for i in ia]
ba = [basef.get(fam[i], allbase) for i in ia]
s, k_ = shuffled(pa, ma)
B['held_all'] = {'n': len(ia), 'ids': ia, 'pred_um': pa, 'measured_um': ma, 'baseline_um': ba,
                 'model_MALE': male(pa, ma), 'baseline_MALE': male(ba, ma),
                 'shuffled_label_MALE': s, 'shuffle_n': k_}
nod = [i for i in ia if fam[i] == 'nodal']
if nod:
    B['held_nodal_pure_law'] = {'n': len(nod), 'MALE': male([raw[i] for i in nod], [lam[i] for i in nod]),
                                'baseline_MALE': male([allbase] * len(nod), [lam[i] for i in nod]),
                                'rank_order_correct': (raw[nod[0]] > raw[nod[1]]) == (lam[nod[0]] > lam[nod[1]]) if len(nod) == 2 else None}
json.dump({'A': A, 'B': B}, open(os.path.join(HERE, 'results.json'), 'w'), indent=1)
print(json.dumps({'A': A, 'B': B}, indent=1))
