#!/usr/bin/env python
"""Bridge between Level 2 (fin proportion) and the envelope: Daane et al. 2021 fin-length ratios against the Park and Choi specimens.

Reads (read-only) genotype/cache/daane2021_data_s1A_fin_measurements.csv, the Genotype thread's per-specimen extraction of
Daane et al. 2021 Data S1A (doi 10.1016/j.cub.2021.08.054), and physics/glide-data.csv. Recounts the group and species
statistics independently (a recount, not a re-quote), compares them with genotype/cache/daane2021_fin_ratios.json, and
places the five Park and Choi 2010 specimens on the same axis as an UPPER BOUND:
    pectoral fin length  =  (half span - half body width) / cos(dihedral)  <=  half span / cos(dihedral)
because body width >= 0. Dihedral angles are the paper's stated values for L1, L2, L3 (22, 12, 7 deg); for model M the
angle is not legible in the table, so the largest stated angle (22 deg) is used, which gives the loosest bound.
No length-to-area conversion is made: no sourced shape factor exists, so none is assumed.
Writes physics/bridge.json, physics/fig/bridge.svg, and copies beside the sub-dashboard.
"""
import csv, json, math, os, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
src = os.path.join(REPO, 'genotype', 'cache', 'daane2021_data_s1A_fin_measurements.csv')
rows = list(csv.DictReader(open(src, encoding='utf-8')))
for r in rows:
    r['SL'] = float(r['SL_cm']); r['pec'] = float(r['pectoral_cm']); r['ratio'] = r['pec'] / r['SL']
def summ(rs):
    v = sorted(x['ratio'] for x in rs)
    return {'n': len(v), 'median': st.median(v), 'min': v[0], 'max': v[-1], 'mean': sum(v) / len(v),
            'SL_min': min(x['SL'] for x in rs), 'SL_max': max(x['SL'] for x in rs)}
groups = {}
for g in ['flying fish', 'flying halfbeak', 'halfbeak', 'needlefish']:
    groups[g] = summ([r for r in rows if r['group'] == g])
species = {}
for s in sorted({r['species'] for r in rows}):
    rs = [r for r in rows if r['species'] == s]; species[s] = {'group': rs[0]['group'], **summ(rs)}
ff = [r for r in rows if r['group'] == 'flying fish']
by_size = {'under_5cm': summ([r for r in ff if r['SL'] < 5]), 'at_or_over_5cm': summ([r for r in ff if r['SL'] >= 5])}
# recount against the Genotype thread's summary
geno = json.load(open(os.path.join(REPO, 'genotype', 'cache', 'daane2021_fin_ratios.json'), encoding='utf-8'))
recount = {}
for g, v in groups.items():
    gv = geno['groups'].get(g, {})
    recount[g] = {'genotype_median': gv.get('pectoral_over_SL_median'), 'our_median': round(v['median'], 3),
                  'genotype_n': gv.get('n_specimens'), 'our_n': v['n'],
                  'agree': (gv.get('n_specimens') == v['n']) and (abs((gv.get('pectoral_over_SL_median') or 0) - v['median']) < 0.0015)}
# Park and Choi specimens
glide = list(csv.DictReader(open(os.path.join(HERE, 'glide-data.csv'), encoding='utf-8')))
dihedral = {'L1': 22.0, 'L2': 12.0, 'L3': 7.0, 'M': None}
pc = []
for r in glide:
    if r['source_id'] != 'park-choi-2010' or r['row_kind'] != 'specimen' or not r['pectoral_fin_span_m']: continue
    model = r['source_locator'].split('model ')[1].split(';')[0].strip()
    SL = float(r['body_length_m']) * 100; span = float(r['pectoral_fin_span_m']) * 100
    d = dihedral.get(model); assumed = d is None
    d_used = 22.0 if assumed else d
    bound = (span / 2) / math.cos(math.radians(d_used)) / SL
    pc.append({'model': model, 'species': 'Cypselurus hiraii', 'SL_cm': SL, 'span_cm': span, 'dihedral_deg': d_used,
               'dihedral_assumed': assumed, 'pectoral_over_SL_upper_bound': bound, 'mass_kg': float(r['body_mass_kg']),
               'note': 'upper bound: true ratio = bound - (body width / 2) / (cos(dihedral) * SL); body width not reported'})
in_table = any('hiraii' in s.lower() or 'cypselurus' in s.lower() for s in species)
out = {'source': {'daane_2021': '10.1016/j.cub.2021.08.054', 'file': 'genotype/cache/daane2021_data_s1A_fin_measurements.csv (Genotype thread extraction of Data S1A; preserved MCZ specimens, lengths only)',
                  'park_choi_2010': '10.1242/jeb.046052', 'rows_read': len(rows)},
       'groups': groups, 'species': species, 'flying_fish_by_size': by_size, 'recount_vs_genotype_thread': recount,
       'park_choi_specimens_upper_bound': pc,
       'park_choi_species_in_daane_table': in_table,
       'note_on_species': 'Cypselurus hiraii (Park and Choi 2010) is not in the Daane table. The table has Cheilopogon furcatus, Exocoetus volitans and Hirundichthys rondeleti; no synonymy is claimed here.',
       'what_this_establishes': 'The Park and Choi wind-tunnel specimens (SL about 20 cm) have pectoral-length-to-body ratios at most about 0.64 to 0.66, which lies inside the measured flying-fish range (0.41 to 0.82) and at or below its median (0.687); so the specimens whose wing loading set v_min are proportioned like real flying fish, not like halfbeaks or needlefish. It does not establish fin area, mass or glide performance for any Daane specimen, and no length-to-area conversion is made.'}
json.dump(out, open(os.path.join(HERE, 'bridge.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
json.dump(out, open(os.path.join(REPO, 'dashboard', 'public', 't', 'physics', 'bridge.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

# ---- figure: pectoral/SL against SL (log), by group, Park and Choi bounds overlaid
col = {'flying fish': '#2a78d6', 'flying halfbeak': '#eb6834', 'halfbeak': '#1baf7a', 'needlefish': '#8a8a85'}
W, H = 900, 470; ml, mr, mt, mb = 64, 24, 80, 56
xs = [math.log10(r['SL']) for r in rows] + [math.log10(p['SL_cm']) for p in pc]
x0, x1 = 0.0, 1.8; y0, y1 = 0.0, 0.9
X = lambda v: ml + (math.log10(v) - x0) / (x1 - x0) * (W - ml - mr)
Y = lambda v: H - mb - (v - y0) / (y1 - y0) * (H - mt - mb)
s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="system-ui,sans-serif" font-size="12">',
     '<style>text{fill:currentColor}.grid{stroke:currentColor;stroke-opacity:.12}</style>',
     f'<text x="{ml}" y="20" font-size="15" font-weight="700">Fin enlargement for gliding: pectoral fin length over body length, 109 museum specimens</text>',
     f'<text x="{ml}" y="38" opacity=".7">Daane et al. 2021 Data S1A (MCZ specimens, lengths only). Hollow diamonds: Park and Choi specimens, upper bounds. No bird.</text>']
for v in (1, 2, 5, 10, 20, 50):
    s.append(f'<line class="grid" x1="{X(v):.1f}" y1="{mt}" x2="{X(v):.1f}" y2="{H-mb}"/><text x="{X(v):.1f}" y="{H-mb+16}" text-anchor="middle">{v}</text>')
for v in (0, 0.2, 0.4, 0.6, 0.8):
    s.append(f'<line class="grid" x1="{ml}" y1="{Y(v):.1f}" x2="{W-mr}" y2="{Y(v):.1f}"/><text x="{ml-8}" y="{Y(v)+4:.1f}" text-anchor="end">{v:g}</text>')
s.append(f'<text x="{(ml+W-mr)/2:.0f}" y="{H-12}" text-anchor="middle">standard length (cm, log scale)</text>')
s.append(f'<text transform="translate(14 {(mt+H-mb)/2:.0f}) rotate(-90)" text-anchor="middle">pectoral fin length / standard length</text>')
for r in rows:
    c = col[r['group']]
    t = f"{r['species']} ({r['group']}), MCZ {r['mcz_catalog_no']}: SL {r['SL']:g} cm, pectoral {r['pec']:g} cm, ratio {r['ratio']:.3f}. Daane et al. 2021 Data S1A via genotype/cache."
    s.append(f'<circle cx="{X(r["SL"]):.1f}" cy="{Y(r["ratio"]):.1f}" r="5" fill="{c}" fill-opacity=".85" stroke="var(--panel,#fff)" stroke-width="1.5"><title>{t}</title></circle>')
for p in pc:
    x, y = X(p['SL_cm']), Y(p['pectoral_over_SL_upper_bound'])
    t = f"Park and Choi 2010 model {p['model']} (Cypselurus hiraii): SL {p['SL_cm']:.1f} cm, span {p['span_cm']:.1f} cm, dihedral {p['dihedral_deg']:g} deg{' (assumed, not legible)' if p['dihedral_assumed'] else ''}: pectoral/SL at most {p['pectoral_over_SL_upper_bound']:.3f}. {p['note']}"
    s.append(f'<polygon points="{x:.1f},{y-8:.1f} {x+8:.1f},{y:.1f} {x:.1f},{y+8:.1f} {x-8:.1f},{y:.1f}" fill="var(--panel,#fff)" stroke="currentColor" stroke-width="2"><title>{t}</title></polygon>')
    s.append(f'<line x1="{x:.1f}" y1="{y+8:.1f}" x2="{x:.1f}" y2="{y+18:.1f}" stroke="currentColor" stroke-width="1.5"/>')
s.append(f'<text x="{X(20.5):.1f}" y="{Y(0.63)+30:.1f}" text-anchor="middle">Park and Choi specimens</text><text x="{X(20.5):.1f}" y="{Y(0.63)+44:.1f}" text-anchor="middle" opacity=".7">(upper bounds on fin length / SL)</text>')
# group medians as short ticks at the right edge
for i, g in enumerate(['flying fish', 'flying halfbeak', 'halfbeak', 'needlefish']):
    lx = ml + (i % 2) * 400; ly = mt - 28 + (i // 2) * 18
    s.append(f'<circle cx="{lx+6}" cy="{ly-4}" r="5" fill="{col[g]}"/><text x="{lx+16}" y="{ly}">{g}: n {groups[g]["n"]}, median {groups[g]["median"]:.2f}, range {groups[g]["min"]:.2f} to {groups[g]["max"]:.2f}</text>')
s.append('</svg>')
svg = '\n'.join(s)
open(os.path.join(HERE, 'fig', 'bridge.svg'), 'w', encoding='utf-8').write(svg)
open(os.path.join(REPO, 'dashboard', 'public', 't', 'physics', 'bridge.svg'), 'w', encoding='utf-8').write(svg)
print(json.dumps({'groups': {g: (v['n'], round(v['median'], 3)) for g, v in groups.items()}, 'recount_agree': {g: v['agree'] for g, v in recount.items()},
                  'park_choi_bounds': [(p['model'], round(p['pectoral_over_SL_upper_bound'], 3)) for p in pc], 'in_table': in_table, 'by_size': {k: (v['n'], round(v['median'], 3)) for k, v in by_size.items()}}, indent=1))
