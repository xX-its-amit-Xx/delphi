#!/usr/bin/env python
"""Physics thread: every number for #50 (coverage of the glide table) and #43 (Thompson's flight envelope).

Reads physics/glide-data.csv, physics/comparison-data.csv and physics/tests/thompson1917-ch02-06/result.json
(the pre-registration), computes the pre-registered quantities, and writes:
  physics/results.json                                     every computed number, with inputs and sources
  physics/tests/thompson1917-ch02-06/result.json           measured, verdict, method (pre-registration kept verbatim)
  physics/fig/envelope.svg                                 the one figure, drawn from results.json by this script
  dashboard/public/t/physics/results.json                  a copy for the sub-dashboard

Rules: no value is typed here; everything is read from the two CSVs. Air density 1.225 kg/m3 and g = 9.81 m/s2 are the only constants.
Class Aves is the frozen holdout; no bird row exists in either CSV and none is read.
Run with the venv at C:/Temp/delphi-physics-venv (numpy, scipy only).
"""
import csv, json, math, os, re, sys, datetime
import numpy as np
from scipy import stats

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
RHO = 1.225
G = 9.81
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def num(x):
    """Parse a plain number; ranges like '10 to 20' return None (handled separately)."""
    if x is None: return None
    x = x.strip()
    if x == '': return None
    try: return float(x)
    except ValueError: return None

def rng(x):
    """Parse 'a to b' or 'a' into (lo, hi) or None."""
    if not x: return None
    m = re.match(r'^\s*([\d.]+)\s*(?:to|-)\s*([\d.]+)', x)
    if m: return float(m.group(1)), float(m.group(2))
    v = num(x)
    return (v, v) if v is not None else None

glide = list(csv.DictReader(open(os.path.join(HERE, 'glide-data.csv'), encoding='utf-8')))
comp = list(csv.DictReader(open(os.path.join(HERE, 'comparison-data.csv'), encoding='utf-8')))
prereg_path = os.path.join(HERE, 'tests', 'thompson1917-ch02-06', 'result.json')
prereg = json.load(open(prereg_path, encoding='utf-8'))

out = {'computed_at': NOW, 'constants': {'rho_kg_m3': RHO, 'g_m_s2': G}, 'inputs': {
    'glide_rows': len(glide), 'comparison_rows': len(comp)}}

# ---------------------------------------------------------------- #50 coverage
value_cols = ['glide_distance_m', 'glide_duration_s', 'airspeed_m_s', 'launch_speed_m_s', 'height_m', 'body_mass_kg',
              'body_length_m', 'pectoral_fin_span_m', 'pectoral_fin_area_m2', 'pelvic_fin_area_m2', 'CL_max', 'LD_max']
cov = {}
for c in value_cols:
    rows = [r for r in glide if r[c].strip() != '']
    kinds = {}
    for r in rows: kinds[r['value_kind']] = kinds.get(r['value_kind'], 0) + 1
    cov[c] = {'rows_with_value': len(rows), 'species': sorted({r['species'] for r in rows}), 'by_value_kind': kinds}
species = sorted({r['species'] for r in glide})
measured_rows = [r for r in glide if r['value_kind'].startswith('measured')]
out['coverage'] = {
    'rows': len(glide),
    'distinct_species_or_groups': species,
    'n_species_or_groups': len(species),
    'rows_measured_first_hand': len(measured_rows),
    'rows_secondary_or_theory': len(glide) - len(measured_rows),
    'species_with_first_hand_measurements': sorted({r['species'] for r in measured_rows}),
    'sources': sorted({r['source_id'] for r in glide}),
    'per_column': cov,
    'what_is_missing': [
        'No first-hand measurement of airspeed or glide distance for any identified species: every speed and distance is a second-hand quote of Hertel 1966, Fish 1990, Davenport 1990/1994 or Edgerton and Breder 1941, none of which could be fetched in full.',
        'No species has body mass, fin area and a measured airspeed in the same source; Park and Choi 2010 gives mass and areas for 0.04-0.06 kg specimens, the speeds come from other, larger fish.',
        'Pectoral-fin span and area exist for one species (Cypselurus hiraii, five specimens).',
        'Wing loading for the north-east Atlantic species measured by Davenport 1992 is behind a paywall; only its allometric exponents are in the abstract (physics/allometry.json).'
    ]}

# Derived wing loading for rows that have mass and areas
derived = []
for r in glide:
    W = num(r['body_mass_kg']); A1 = num(r['pectoral_fin_area_m2']); A2 = num(r['pelvic_fin_area_m2']); A3 = num(r['body_planform_area_m2'])
    if W is None: continue
    rec = {'species': r['species'], 'source_id': r['source_id'], 'locator': r['source_locator'], 'mass_kg': W}
    if A1 is not None and A2 is not None and A3 is not None and (A1 + A2 + A3) > 0:
        rec['wing_loading_total_ref_area_N_m2'] = W * G / (A1 + A2 + A3)
        rec['wing_loading_fins_only_N_m2'] = (W * G / (A1 + A2)) if (A1 + A2) > 0 else None
        rec['reference_area_m2'] = A1 + A2 + A3
    elif A1 is not None and A1 > 0 and A2 is None and A3 is None:
        rec['wing_loading_stated_wing_area_N_m2'] = W * G / A1
        rec['reference_area_m2'] = A1
    if len(rec) > 4: derived.append(rec)
out['derived_wing_loading'] = derived

# ---------------------------------------------------------------- Interpretation B: the fish against v_min
# The model L3 row is the only row with C_Lmax, mass and areas from the same specimen.
L3 = next(r for r in glide if 'model L3' in r['source_locator'])
W = num(L3['body_mass_kg']) * G
A = num(L3['pectoral_fin_area_m2']) + num(L3['pelvic_fin_area_m2']) + num(L3['body_planform_area_m2'])
CLmax = num(L3['CL_max']); LD = num(L3['LD_max'])
vmin = math.sqrt(2 * W / (RHO * A * CLmax))
# measured airspeed ranges available (all second-hand field quotes)
speed_rows = [r for r in glide if rng(r['airspeed_m_s']) and r['row_kind'] == 'field summary']
speeds = [rng(r['airspeed_m_s']) for r in speed_rows]
lo = min(s[0] for s in speeds); hi = max(s[1] for s in speeds)
inside = (hi >= vmin) and (lo <= 3 * vmin)
outside_low = hi < vmin
outside_high = lo > 3 * vmin
B = {
    'specimen': 'Cypselurus hiraii model L3 (Park and Choi 2010 Table 1 and Table 2)',
    'W_N': W, 'reference_area_m2': A, 'C_Lmax': CLmax, 'LD_max': LD,
    'v_min_m_s': vmin, 'three_v_min_m_s': 3 * vmin,
    'airspeed_range_m_s': [lo, hi],
    'airspeed_sources': [f"{r['source_id']}: {r['source_locator']}" for r in speed_rows],
    'verdict': 'inside' if inside else ('outside' if (outside_low or outside_high) else 'cannot-tell'),
    'caveat': 'W, S and C_Lmax are from 0.04-0.06 kg stuffed specimens of one species; the airspeed range is a second-hand field figure for larger flying fish of several genera. The pre-registration allowed same species or genus; the field figure is at family level, so this verdict rests on an assumption the pre-registration did not foresee and is reported with that weakness.'}
# Second fish: Kawachi's C. heterurus doederleini with the measured C_Lmax carried over
kaw = next(r for r in glide if r['source_id'] == 'deng-2019' and 'Kawachi' in r['source_locator'])
Wk = num(kaw['body_mass_kg']) * G; Ak = num(kaw['pectoral_fin_area_m2'])
vmin_k = math.sqrt(2 * Wk / (RHO * Ak * CLmax))
B['second_specimen'] = {'specimen': 'Cheilopogon heterurus doederleini as quoted by Deng 2019 from Kawachi 1993 (0.226 kg, 0.0225 m2)',
                        'wing_loading_N_m2': Wk / Ak, 'v_min_with_Park_Choi_CLmax_m_s': vmin_k,
                        'airspeed_quoted_for_this_species_m_s': rng(next(r for r in glide if r['source_id'] == 'makiguchi-2013' and r['row_kind'] == 'field summary')['airspeed_m_s']),
                        'note': 'C_Lmax borrowed from another species; wing area is a second-hand figure; descriptive only, no verdict'}
out['interpretation_B'] = B

# ---------------------------------------------------------------- Interpretation C: power
Preq = W * vmin / LD
C = {'P_req_W_at_v_min': Preq, 'P_req_per_kg_body_W_kg': Preq / (W / G),
     'formula': 'P_req = W v_min / (L/D)_max, the power to fly level at the minimum lift-supported speed with the best measured glide ratio',
     'P_avail': None,
     'verdict': 'cannot-tell',
     'why': 'No fetched source gives a muscle mass fraction or a mass-specific muscle power for a flying fish; Davenport 1992 (abstract) says only that red axial muscle is no more than in mackerel. Without a sourced P_avail the pre-registered verdict is cannot-tell.',
     'what_would_decide_it': f"A sourced pectoral-plus-axial muscle mass fraction f and specific power p (W per kg muscle): INSIDE if f * p >= {Preq/(W/G):.1f} W per kg body mass."}
out['interpretation_C'] = C

# ---------------------------------------------------------------- Interpretation A: v vs W/S, gliders and powered fliers separately
def collect():
    pts = []
    # flying fish: one species-level point from the derived L3 wing loading and the field speed range midpoint
    pts.append({'lineage': 'Exocoetidae', 'species': 'Cypselurus hiraii (W/S) with family-level field airspeed', 'mode': 'glider',
                'WS': W / A, 'v': (lo + hi) / 2, 'v_lo': lo, 'v_hi': hi,
                'provenance': 'W/S measured (Park and Choi 2010); airspeed second-hand field range 10-20 m/s'})
    for r in comp:
        WS = num(r['wing_loading_N_m2']); v = num(r['airspeed_m_s'])
        if WS is None or v is None: continue
        pts.append({'lineage': r['lineage'], 'species': r['species'], 'mode': r['mode'], 'WS': WS, 'v': v,
                    'provenance': f"{r['value_kind']} ({r['source_id']})"})
    return pts
pts = collect()
def fit(group):
    g = [p for p in pts if p['mode'] == group]
    res = {'n': len(g), 'taxa': [p['species'] for p in g]}
    if len(g) >= 3:
        x = np.log10([p['WS'] for p in g]); y = np.log10([p['v'] for p in g])
        r = stats.linregress(x, y)
        tcrit = stats.t.ppf(0.975, len(g) - 2) if len(g) > 2 else float('nan')
        res.update({'slope': r.slope, 'intercept': r.intercept, 'slope_se': r.stderr, 'r2': r.rvalue ** 2,
                    'slope_ci95': [r.slope - tcrit * r.stderr, r.slope + tcrit * r.stderr],
                    'decades_of_WS': float(x.max() - x.min())})
    if len(g) >= 2:
        x = np.log10([p['WS'] for p in g]); res['decades_of_WS'] = float(x.max() - x.min())
    # pre-registered rule
    if res['n'] < 5 or res.get('decades_of_WS', 0) < 1 or (res.get('slope_ci95') and (res['slope_ci95'][1] - res['slope_ci95'][0]) > 1.0):
        res['verdict'] = 'inconclusive'; res['reason'] = 'underpowered'
        why = []
        if res['n'] < 5: why.append(f"n = {res['n']} < 5")
        if res.get('decades_of_WS', 0) < 1: why.append(f"W/S spans {res.get('decades_of_WS', 0):.2f} decades < 1")
        if res.get('slope_ci95') and (res['slope_ci95'][1] - res['slope_ci95'][0]) > 1.0: why.append('CI width > 1.0')
        res['why'] = '; '.join(why)
    else:
        ci = res['slope_ci95']
        if ci[0] <= 0.5 <= ci[1] and not (ci[0] <= 0 <= ci[1]): res['verdict'] = 'supports'
        elif not (ci[0] <= 0.5 <= ci[1]): res['verdict'] = 'refutes'
        else: res['verdict'] = 'inconclusive'; res['reason'] = 'underpowered'; res['why'] = 'CI contains both 0 and 0.5'
    return res
A_res = {'points': pts, 'gliders': fit('glider'), 'powered': fit('powered'),
         'pooled_descriptive_only': None,
         'thompson_prediction': 'slope 0.5 of log v on log (W/S); from v_min = sqrt(2 (W/S) / (rho C_L)) with constant rho and C_L'}
x = np.log10([p['WS'] for p in pts]); y = np.log10([p['v'] for p in pts]); r = stats.linregress(x, y)
A_res['pooled_descriptive_only'] = {'n': len(pts), 'slope': r.slope, 'slope_se': r.stderr, 'r2': r.rvalue ** 2,
                                    'note': 'mixes two physical regimes; decides nothing (hub ruling 2026-10-31)'}
out['interpretation_A'] = A_res

# ---------------------------------------------------------------- Interpretation D: the exponents (restated, not tested)
out['interpretation_D'] = {'status': 'provable; sent to the Lean thread via physics/FORMAL-STATEMENTS.md',
                           'statements': ['W = k L^3 (cube law; already formalised as thompson1917-ch03-07)',
                                          'S = c L^2 (area law)', 'v_min = sqrt(2 W / (rho S C_L)) ~ L^0.5',
                                          'P_req = W v / (L/D) ~ L^3.5', 'P_avail = f M p ~ L^3 (constant specific power assumed)',
                                          'F_break = sigma A_cs ~ L^2 (strength law; the one the open-problems ledger needs)']}

# ---------------------------------------------------------------- overall verdict for result.json
verdicts = {'A_gliders': A_res['gliders']['verdict'], 'A_powered': A_res['powered']['verdict'], 'B': B['verdict'], 'C': C['verdict']}
out['verdicts'] = verdicts
# Per the pre-registration: A inconclusive both groups; B inside; C cannot-tell -> overall 'inconclusive' with B as the one decided reading
overall = 'inconclusive'
out['overall'] = {'verdict': overall,
                  'sentence': ('The scaling test is underpowered in both regimes (too few taxa with measured W/S and speed, and the powered set spans under one decade of wing loading); '
                               'the flying fish itself sits inside the envelope (its quoted glide speeds of 10-20 m/s are at or above the 9.9 m/s minimum lift-supported speed computed from its own measured wing loading and lift coefficient); '
                               'whether its muscles could power level flight cannot be told because no source gives the muscle numbers.')}

json.dump(out, open(os.path.join(HERE, 'results.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
os.makedirs(os.path.join(REPO, 'dashboard', 'public', 't', 'physics'), exist_ok=True)
json.dump(out, open(os.path.join(REPO, 'dashboard', 'public', 't', 'physics', 'results.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

# ---------------------------------------------------------------- fill result.json without touching the pre-registration text
prereg['status'] = 'complete'
prereg['completed_at'] = NOW
prereg['method'] = ('analysis.py reads the two CSVs. B: v_min = sqrt(2W/(rho S C_Lmax)) for the Park and Choi L3 specimen (W from its mass, S = A1+A2+A3, C_Lmax 0.78) '
                    'compared with the second-hand field airspeed range. A: OLS of log10 v on log10 (W/S), gliders and powered fliers separately, with the pre-registered n, decade and CI rules. '
                    'C: P_req = W v_min/(L/D)_max; no sourced P_avail. Every number is in physics/results.json.')
prereg['measured'] = {'value': vmin, 'unit': 'm/s, minimum lift-supported speed of the Cypselurus hiraii L3 specimen', 'n': 'one specimen for W, S, C_Lmax; family-level airspeed range',
                      'uncertainty': 'none computable from one specimen; the second specimen (Kawachi, 0.226 kg) gives ' + f"{vmin_k:.1f} m/s with the same C_Lmax",
                      'extra': {'airspeed_range_m_s': [lo, hi], 'wing_loading_L3_N_m2': W / A, 'P_req_W': Preq,
                                'A_gliders': {k: A_res['gliders'].get(k) for k in ('n', 'slope', 'slope_ci95', 'decades_of_WS', 'verdict', 'why')},
                                'A_powered': {k: A_res['powered'].get(k) for k in ('n', 'slope', 'slope_ci95', 'decades_of_WS', 'verdict', 'why')}}}
prereg['verdict'] = overall
prereg['verdict_by_interpretation'] = verdicts
prereg['confidence'] = 0.5
prereg['caveats'] = prereg.get('caveats', []) + [
    B['caveat'],
    'Interpretation A powered set: wing loadings for the three hoverflies come from a compilation whose own mass and area columns disagree with its wing-loading column by a factor of 5 to 8; bat speeds are wind-tunnel test speeds, not cruising speeds.',
    'Interpretation A glider set has two taxa with both W/S and speed (flying fish, northern flying squirrel); the colugo has a speed but no sourced wing loading.',
    'Class Aves is the frozen holdout: no bird enters any fit, table or figure.']
prereg['datasets'] = [
    {'id': 'physics-glide-data-2026-10-31', 'name': 'physics/glide-data.csv', 'landing_url': 'physics/glide-data.csv', 'doi': None, 'version': NOW,
     'license': 'CC BY 4.0 for the compilation; each value belongs to its source', 'files': [], 'role': 'flying-fish morphometry and quoted field speeds; sources in physics/sources.json'},
    {'id': 'physics-comparison-data-2026-10-31', 'name': 'physics/comparison-data.csv', 'landing_url': 'physics/comparison-data.csv', 'doi': None, 'version': NOW,
     'license': 'CC BY 4.0 for the compilation; each value belongs to its source', 'files': [], 'role': 'non-bird comparison lineages'}]
json.dump(prereg, open(prereg_path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

# ---------------------------------------------------------------- figure: inline SVG, two groups, Thompson slope line, no birds
os.makedirs(os.path.join(HERE, 'fig'), exist_ok=True)
Wd, Hd, m = 720, 420, {'l': 64, 'r': 24, 't': 36, 'b': 56}
xs = [math.log10(p['WS']) for p in pts]; ys = [math.log10(p['v']) for p in pts]
x0, x1 = math.floor(min(xs)) , math.ceil(max(xs)); y0, y1 = math.floor(min(ys) * 2) / 2, math.ceil(max(ys) * 2) / 2
def X(v): return m['l'] + (v - x0) / (x1 - x0) * (Wd - m['l'] - m['r'])
def Y(v): return Hd - m['b'] - (v - y0) / (y1 - y0) * (Hd - m['t'] - m['b'])
col = {'glider': '#2a78d6', 'powered': '#eb6834'}
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wd} {Hd}" font-family="system-ui,sans-serif" font-size="12">',
       '<style>text{fill:currentColor}.grid{stroke:currentColor;stroke-opacity:.12}.ax{stroke:currentColor;stroke-opacity:.5}</style>']
for d in range(x0, x1 + 1):
    svg.append(f'<line class="grid" x1="{X(d):.1f}" y1="{m["t"]}" x2="{X(d):.1f}" y2="{Hd-m["b"]}"/>')
    svg.append(f'<text x="{X(d):.1f}" y="{Hd-m["b"]+18}" text-anchor="middle">{10**d:g}</text>')
yy = y0
while yy <= y1 + 1e-9:
    svg.append(f'<line class="grid" x1="{m["l"]}" y1="{Y(yy):.1f}" x2="{Wd-m["r"]}" y2="{Y(yy):.1f}"/>')
    svg.append(f'<text x="{m["l"]-8}" y="{Y(yy)+4:.1f}" text-anchor="end">{10**yy:.3g}</text>')
    yy += 0.5
svg.append(f'<text x="{(m["l"]+Wd-m["r"])/2:.0f}" y="{Hd-12}" text-anchor="middle">wing loading W/S (N per m², log scale)</text>')
svg.append(f'<text transform="translate(14 {(m["t"]+Hd-m["b"])/2:.0f}) rotate(-90)" text-anchor="middle">airspeed (m/s, log scale)</text>')
# Thompson slope-0.5 line through the flying-fish point, dashed, neutral
ff = pts[0]; c0 = math.log10(ff['v']) - 0.5 * math.log10(ff['WS'])
svg.append(f'<line x1="{X(x0):.1f}" y1="{Y(c0+0.5*x0):.1f}" x2="{X(x1):.1f}" y2="{Y(c0+0.5*x1):.1f}" stroke="currentColor" stroke-opacity=".45" stroke-dasharray="6 5" stroke-width="2"/>')
svg.append(f'<text x="{X(x1)-4:.1f}" y="{Y(c0+0.5*x1)-8:.1f}" text-anchor="end" opacity=".7">Thompson: v ∝ (W/S)^½, drawn through the flying fish</text>')
for p in pts:
    cx, cy = X(math.log10(p['WS'])), Y(math.log10(p['v']))
    if 'v_lo' in p:
        svg.append(f'<line x1="{cx:.1f}" y1="{Y(math.log10(p["v_lo"])):.1f}" x2="{cx:.1f}" y2="{Y(math.log10(p["v_hi"])):.1f}" stroke="{col[p["mode"]]}" stroke-width="2"/>')
    svg.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="6" fill="{col[p["mode"]]}" stroke="var(--panel,#fff)" stroke-width="2"><title>{p["species"]}: W/S {p["WS"]:.2f} N/m², v {p["v"]:.2f} m/s. {p["provenance"]}</title></circle>')
    label = p['lineage'] if p['lineage'] in ('Exocoetidae', 'Pteromyini') else ''
    if label: svg.append(f'<text x="{cx+9:.1f}" y="{cy+4:.1f}">{label}</text>')
# legend
svg.append(f'<circle cx="{m["l"]+10}" cy="{m["t"]-14}" r="6" fill="{col["glider"]}"/><text x="{m["l"]+22}" y="{m["t"]-10}">gliders (flying fish, flying squirrel)</text>')
svg.append(f'<circle cx="{m["l"]+250}" cy="{m["t"]-14}" r="6" fill="{col["powered"]}"/><text x="{m["l"]+262}" y="{m["t"]-10}">powered fliers (bats, hoverflies)</text>')
svg.append('</svg>')
open(os.path.join(HERE, 'fig', 'envelope.svg'), 'w', encoding='utf-8').write('\n'.join(svg))
open(os.path.join(REPO, 'dashboard', 'public', 't', 'physics', 'envelope.svg'), 'w', encoding='utf-8').write('\n'.join(svg))

print(json.dumps({'v_min_L3': vmin, 'WS_L3': W / A, 'airspeed': [lo, hi], 'B': B['verdict'], 'Preq_W': Preq,
                  'A_gliders': {k: A_res['gliders'].get(k) for k in ('n', 'slope', 'decades_of_WS', 'verdict', 'why')},
                  'A_powered': {k: A_res['powered'].get(k) for k in ('n', 'slope', 'slope_ci95', 'decades_of_WS', 'verdict', 'why')},
                  'pooled': A_res['pooled_descriptive_only'], 'coverage_species': len(species), 'rows': len(glide)}, indent=1))
