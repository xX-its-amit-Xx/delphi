#!/usr/bin/env python
"""Deck figure: the flying fish's minimum lift-supported speed band against every speed in the glide table.

Reads physics/results.json (v_min, band) and physics/glide-data.csv (every row with an airspeed or launch speed).
Writes physics/fig/vmin-band.svg and a copy beside the sub-dashboard. Every bar carries its source, locator,
retrieval time and value kind in a <title>, so hovering shows where the number came from. No bird appears.
"""
import csv, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
res = json.load(open(os.path.join(HERE, 'results.json'), encoding='utf-8'))
rows = list(csv.DictReader(open(os.path.join(HERE, 'glide-data.csv'), encoding='utf-8')))
B = res['interpretation_B']
def rng(x):
    m = re.match(r'^\s*([\d.]+)\s*(?:to|-)\s*([\d.]+)', x or '')
    if m: return float(m.group(1)), float(m.group(2))
    try: v = float(x); return v, v
    except: return None
bars = []
for r in rows:
    for col, what in (('airspeed_m_s', 'glide airspeed'), ('launch_speed_m_s', 'launch speed')):
        rg = rng(r[col])
        if not rg: continue
        kind = r['value_kind'].split(' ')[0] if not r['value_kind'].startswith('measured (length') else 'estimated'
        bars.append({'lo': rg[0], 'hi': rg[1], 'what': what, 'species': r['species'], 'kind': kind,
                     'src': r['source_id'], 'loc': r['source_locator'], 'ret': r['retrieved_at'], 'method': r['method'], 'notes': r['notes']})
# the wind-tunnel test speed is a method condition, shown for reference
bars.append({'lo': 12, 'hi': 12, 'what': 'wind-tunnel free stream', 'species': 'Cypselurus hiraii model', 'kind': 'measured', 'src': 'park-choi-2010',
             'loc': 'Materials and methods: free-stream velocity 12 m/s', 'ret': '2026-10-31T18:18:51Z', 'method': 'wind tunnel', 'notes': 'the speed at which lift and drag were measured; not a flight speed'})
order = {'measured': 0, 'estimated': 1, 'secondary': 2, 'theory-secondary': 3}
bars.sort(key=lambda b: (order.get(b['kind'], 9), b['lo']))
col = {'measured': '#2a78d6', 'estimated': '#1baf7a', 'secondary': '#eb6834', 'theory-secondary': '#8a8a85'}
W, H = 880, 150 + 26 * len(bars); ml, mr, mt, mb = 340, 24, 70, 78
vmax = 25.0
X = lambda v: ml + v / vmax * (W - ml - mr)
s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="system-ui,sans-serif" font-size="12">',
     '<style>text{fill:currentColor}.grid{stroke:currentColor;stroke-opacity:.12}</style>',
     f'<text x="{ml}" y="22" font-size="15" font-weight="700">How fast must a flying fish go to stay up, and how fast does it go?</text>',
     f'<text x="{ml}" y="40" opacity=".7">Minimum lift-supported speed from one measured specimen; each bar is a published speed, source on hover. No bird data.</text>']
# band
vmin, v3 = B['v_min_m_s'], B['three_v_min_m_s']
s.append(f'<rect x="{X(vmin):.1f}" y="{mt-6}" width="{X(min(v3, vmax))-X(vmin):.1f}" height="{H-mt-mb+6}" fill="#2a78d6" fill-opacity=".10"><title>Pre-registered band [v_min, 3 v_min] = [{vmin:.2f}, {v3:.2f}] m/s. v_min = sqrt(2W/(rho S C_Lmax)) with W {B["W_N"]:.4f} N, S {B["reference_area_m2"]:.5f} m2, C_Lmax {B["C_Lmax"]} (Park and Choi 2010, Table 1 model L3 and Table 2, retrieved 2026-10-31T18:18:51Z), rho 1.225 kg/m3. Computed by physics/analysis.py.</title></rect>')
s.append(f'<line x1="{X(vmin):.1f}" y1="{mt-6}" x2="{X(vmin):.1f}" y2="{H-mb}" stroke="#2a78d6" stroke-width="2.5"/>')
s.append(f'<text x="{X(vmin)+5:.1f}" y="{mt+4}" fill="#2a78d6" font-weight="700">v_min {vmin:.1f} m/s</text>')
v2 = B['second_specimen']['v_min_with_Park_Choi_CLmax_m_s']
s.append(f'<line x1="{X(v2):.1f}" y1="{mt-6}" x2="{X(v2):.1f}" y2="{H-mb}" stroke="#2a78d6" stroke-width="1.5" stroke-dasharray="5 4"><title>Descriptive only: v_min {v2:.1f} m/s for a 0.226 kg Cheilopogon heterurus doederleini over 0.0225 m2 (Kawachi et al. 1993 as quoted by Deng et al. 2019) with the C_Lmax borrowed from Park and Choi 2010.</title></line>')
s.append(f'<text x="{X(v2)+5:.1f}" y="{mt+22}" fill="#2a78d6" opacity=".8">0.23 kg fish, borrowed C_L: {v2:.1f} m/s</text>')
for i in range(0, 26, 5):
    s.append(f'<line class="grid" x1="{X(i):.1f}" y1="{mt}" x2="{X(i):.1f}" y2="{H-mb}"/><text x="{X(i):.1f}" y="{H-mb+16}" text-anchor="middle">{i}</text>')
s.append(f'<text x="{(ml+W-mr)/2:.0f}" y="{H-mb+34}" text-anchor="middle">speed (m/s)</text>')
y = mt + 30
for b in bars:
    c = col[b['kind']]
    lab = f"{b['what']}: {b['species']}"
    s.append(f'<text x="{ml-10}" y="{y+4}" text-anchor="end">{lab[:54]}</text>')
    t = f"{b['lo']:g}{'' if b['lo']==b['hi'] else ' to '+format(b['hi'],'g')} m/s. {b['kind']}. Source: {b['src']} ({b['loc']}), retrieved {b['ret']}. Method: {b['method']}. {b['notes']}".replace('<', '&lt;').replace('&', '&amp;')
    if b['lo'] == b['hi']:
        s.append(f'<circle cx="{X(b["lo"]):.1f}" cy="{y}" r="6" fill="{c}" stroke="var(--panel,#fff)" stroke-width="2"><title>{t}</title></circle>')
    else:
        s.append(f'<rect x="{X(b["lo"]):.1f}" y="{y-6}" width="{X(min(b["hi"],vmax))-X(b["lo"]):.1f}" height="12" rx="4" fill="{c}" stroke="var(--panel,#fff)" stroke-width="2"><title>{t}</title></rect>')
    s.append(f'<text x="{X(min(b["hi"],vmax))+8:.1f}" y="{y+4}" opacity=".75">{b["src"]}</text>')
    y += 26
lx = ml - 300
for k, name in (('measured', 'measured by the source'), ('estimated', 'estimated by the source'), ('secondary', 'quoted second-hand'), ('theory-secondary', 'a model, not an observation')):
    s.append(f'<rect x="{lx}" y="{H-mb+52}" width="12" height="12" rx="3" fill="{col[k]}"/><text x="{lx+16}" y="{H-mb+62}">{name}</text>')
    lx += 16 + 6.6 * len(name) + 22
s.append('</svg>')
svg = '\n'.join(s)
os.makedirs(os.path.join(HERE, 'fig'), exist_ok=True)
open(os.path.join(HERE, 'fig', 'vmin-band.svg'), 'w', encoding='utf-8').write(svg)
open(os.path.join(REPO, 'dashboard', 'public', 't', 'physics', 'vmin-band.svg'), 'w', encoding='utf-8').write(svg)
print('bars', len(bars), 'height', H)
