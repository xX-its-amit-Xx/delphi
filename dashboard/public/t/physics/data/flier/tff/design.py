#!/usr/bin/env python
"""TFF v2: HYPOTHETICAL truly-flying fish as a CO-DESIGN MAP, not a point. Design study; nothing here is an organism.

Binding constraints (Lean, 2026-10-31): sustained aerobic flight is eliminated for the real fish and the v1 flier (C14,
aerobic ceiling eta E Q C_a = 0.0357 W against about 1 W required); gills do not ventilate in air. So the TFF must state
an air-breathing surface (as a required O2 uptake rate in air), the aerobic capacity eta Q C_a E it needs, its wing loading,
muscle type and fraction, and mass, and its ceiling as a function of those.

Sources (all fetched, see physics/SEARCHES.md): NASA GRC metric atmosphere model (troposphere: T = 15.04 - 0.00649 h,
p = 101.29 ((T+273.1)/288.08)^5.256 kPa, rho = p / (0.2869 (T+273.1))); air O2 fraction 0.209 (conditions/baseline.json);
haemoglobin Hill curve from physiology/haemoglobin.js (trout, Rummer and Brauner 2015: P50 3.31 kPa, n 1.34) with the chain's
warm-water capacity (tuned so snapper's maximal extraction fits; 0.206 ml/ml); eta 0.15 and E 19.34 J/ml from the chain;
real-fish Q 0.0656 ml/s (snapper Q_max per kg at 0.06 kg, chain cardiac.js) as used by Lean's C14 certificate; fin polar of the
real fish (Park and Choi 2010); inertial flapping power 8 W/kg body (PMC9490335, bat model); bat altitude: Tadarida
brasiliensis forages at altitudes of over 1 km above ground (PMC5180116). No bird value anywhere (Aves is the frozen holdout).

Writes physics/flier/tff/tff.json (map, ceiling function, spec, comparisons) and physics/flier/tff/map.svg.
"""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); PHYS = os.path.dirname(os.path.dirname(HERE)); REPO = os.path.dirname(PHYS)

# ---- atmosphere (NASA GRC fit, troposphere only; valid to 11 km)
def atm(h):
    T = 15.04 - 0.00649 * h
    p = 101.29 * ((T + 273.1) / 288.08) ** 5.256
    rho = p / (0.2869 * (T + 273.1))
    return {'T_C': T, 'p_kPa': p, 'rho': rho, 'PO2_kPa': 0.209 * p}
# ---- haemoglobin (chain values)
P50, nH = 24.8 / 7.50062, 1.34
def sat(P): return P ** nH / (P ** nH + P50 ** nH) if P > 0 else 0.0
cap = 0.1435 / (sat(15.8) - sat(8.6 / 7.50062))        # chain's warmHbCapacity: 0.206 ml O2 per ml
def Ca(h, gap_kPa=0.0):                                  # arterial content at altitude; PaO2 = PiO2 - gap (gap assumed)
    return cap * sat(max(0.0, atm(h)['PO2_kPa'] - gap_kPa))
eta, E = 0.15, 19.34                                     # chain: muscle efficiency (proxy), J per ml O2
g = 9.81
# ---- aerodynamics (real fish polar, kept)
CLmax, LD, Pinert_per_kg = 0.78, 4.37, 8.0
def A_req(h, Q, m):                                      # aerobic power needed for level flight at v_min at altitude h
    rho = atm(h)['rho']; W = m * g
    vmin = math.sqrt(2 * Q / (rho * CLmax))
    return W * vmin / LD + Pinert_per_kg * m, vmin
def A_avail(h, Qc):                                      # aerobic capacity with cardiac output Qc (ml/s) at altitude h
    return eta * E * Qc * Ca(h)

m = 0.06; W = m * g
real = {'Q': W / 0.012688, 'Qc_ml_s': 0.0656, 'A0': A_avail(0, 0.0656)}
# ---- the map: boundary A_req(h, Q) for several altitudes; and A_avail(h) lines for the real fish and the TFF
hs = [0, 1000, 2000, 3000, 5000]
Qs = [5 * 10 ** (i / 20) for i in range(0, 27)]          # 5 .. 100 N/m2
boundary = {str(h): [{'Q': Q, 'A_req': A_req(h, Q, m)[0], 'v_min': A_req(h, Q, m)[1]} for Q in Qs] for h in hs}
# ---- TFF design point: wing loading 12 N/m2 (as v1 flier); target altitude 1000 m (bat reference); margin 10 %
target_h = 1000; Q_tff = 12.0
A_need_target = A_req(target_h, Q_tff, m)[0]
A_tff = 1.1 * A_need_target
Qc_tff = A_tff / (eta * E * Ca(0))                       # cardiac output (ml/s) that delivers A_tff at sea level
def ceiling(Q, Qc, m=m):                                 # highest h at which A_avail(h, Qc) >= A_req(h, Q)
    lo, hi = 0.0, 11000.0
    if A_avail(0, Qc) < A_req(0, Q, m)[0]: return None
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if A_avail(mid, Qc) >= A_req(mid, Q, m)[0]: lo = mid
        else: hi = mid
    return lo
ceil_tff = ceiling(Q_tff, Qc_tff)
ceil_table = [{'Q': Q, 'Qc_ml_s': Qc, 'ceiling_m': ceiling(Q, Qc)} for Q in (8, 12, 20, 46.4) for Qc in (0.0656, 0.5, 1.0, 2.0, 4.0)]
O2_uptake_air_ml_s = A_tff / (eta * E)
spec = {
 'label': 'HYPOTHETICAL truly-flying fish, TFF v2 (co-design map)', 'hypothetical': True,
 'mass_kg': {'value': m, 'kind': 'measured (real specimen)', 'note': 'kept; the map is for this body'},
 'wing_loading_N_m2': {'value': Q_tff, 'kind': 'hypothetical', 'note': 'inside bat range 6.5-14.25 (comparison-data.csv); lifting area ' + f'{W/Q_tff:.4f}' + ' m2, 3.9x the real reference area'},
 'muscle': {'type': 'aerobic (red) flight muscle', 'fraction': 0.16, 'kind': 'hypothetical', 'note': 'as v1; muscle power is not the binding constraint once O2 delivery is set (chain red muscle 134 W/kg at 20 C, scup): 0.16 x 0.06 kg x 184 W/kg at 25 C = 1.8 W > A_tff'},
 'aerobic_capacity_W': {'value': A_tff, 'kind': 'hypothetical', 'note': 'eta E Qc C_a(0); 1.1 x the requirement at the target altitude'},
 'required_eta_Qc_Ca_product_W': {'value': A_tff / E, 'unit': 'ml O2 per s times eta', 'note': 'eta Q C_a = A / E'},
 'cardiac_output_ml_s_at_fish_Ca': {'value': Qc_tff, 'per_kg_ml_min': Qc_tff * 60 / m, 'kind': 'hypothetical', 'note': 'what delivers A_tff with the chain eta 0.15 and trout-curve C_a; compare the chain fish maximum 65.6 ml/min/kg (snapper) and the real-fish value used by Lean, 0.0656 ml/s'},
 'air_breathing_surface': {'required_O2_uptake_ml_s_in_air': O2_uptake_air_ml_s, 'required_O2_uptake_ml_min_kg': O2_uptake_air_ml_s * 60 / m, 'surface_area_m2': None, 'kind': 'hypothetical', 'note': 'gills do not ventilate in air (chain); a surface area needs a diffusing capacity per m2; the logged search epmc-lung-diffusing returned no fetched value for an air-breathing fish or a bat lung, so the area is NOT computable and is stated as a required uptake rate only'},
 'target_altitude_m': {'value': target_h, 'kind': 'chosen', 'justification': 'Tadarida brasiliensis forages at altitudes of over 1 km above ground (PMC5180116, 10.1098/rsos.160398), the one non-bird altitude reference fetched; no bird altitude is used'},
 'ceiling_m': {'value': ceil_tff, 'kind': 'derived', 'note': 'highest altitude at which eta E Qc C_a(h) >= A_req(h, Q) with PaO2 = PiO2 (assumed, upper bound) and the troposphere fit'},
}
outside = []
outside.append({'parameter': 'cardiac output per kg', 'tff': Qc_tff * 60 / m, 'unit': 'ml/min/kg', 'measured_range_sourced': 'fish: snapper maximum 65.6 ml/min/kg (physiology/cardiac.js, chain); no bat or insect cardiac output was fetched', 'verdict': f'{Qc_tff*60/m/65.6:.0f}x the sourced fish maximum: no fish has it; no non-bird vertebrate value fetched to compare'})
outside.append({'parameter': 'aerobic capacity eta E Qc C_a', 'tff': A_tff, 'unit': 'W', 'measured_range_sourced': 'real fish 0.0357 W (Lean C14, chain numbers); bat P. nathusii mechanical flight power 0.046-0.140 W for 7.6 g (PMC10154928), i.e. about 0.36-1.1 W scaled linearly to 60 g (scaling assumed)', 'verdict': f'{A_tff/0.0357:.0f}x the real fish; at or above the top of a linear bat scaling'})
outside.append({'parameter': 'respiratory surface in air', 'tff': O2_uptake_air_ml_s * 60 / m, 'unit': 'ml O2/min/kg in air', 'measured_range_sourced': 'none fetched', 'verdict': 'no fish has an air-breathing surface of this capacity in the fetched sources; area not computable'})
outside.append({'parameter': 'wing loading', 'tff': Q_tff, 'unit': 'N/m2', 'measured_range_sourced': 'bats 6.5-14.25 (compilation); pterosaur hatchlings 15.8-17.9 (modelled)', 'verdict': 'inside the bat range'})
outside.append({'parameter': 'flight muscle fraction', 'tff': 0.16, 'unit': '-', 'measured_range_sourced': 'bats mean 0.0913, min 0.078 (PMC10966098); maximum not fetched', 'verdict': 'above the bat mean; no fish value exists'})
out = {'note': 'HYPOTHETICAL design study as a co-design map. Equations and the real fin polar unchanged; no bird value.',
       'atmosphere': {'model': 'NASA GRC metric troposphere fit (fetched 2026-10-31T21:13:00Z, physics/prior-art/raw/nasa-atmosphere-model.html)', 'samples': {str(h): atm(h) for h in hs}},
       'haemoglobin': {'P50_kPa': P50, 'n': nH, 'cap_ml_per_ml': cap, 'Ca_at_altitude': {str(h): Ca(h) for h in hs}, 'assumption': 'arterial PO2 = inspired PO2 (no alveolar-arterial gap): an upper bound on C_a'},
       'constants': {'eta': eta, 'E_J_per_ml': E, 'CLmax': CLmax, 'LD': LD, 'inertial_W_per_kg': Pinert_per_kg, 'mass_kg': m},
       'boundary_A_req': boundary, 'real_fish': real, 'tff': spec, 'ceiling_table': ceil_table,
       'A_avail_lines': {'real_fish': {str(h): A_avail(h, 0.0656) for h in hs}, 'tff': {str(h): A_avail(h, Qc_tff) for h in hs}},
       'parameters_vs_measured_ranges': outside,
       'reading': ['The feasible region (A >= A_req) shrinks with altitude on both axes: rho falls so v_min and A_req rise for every wing loading, and PO2 falls so C_a and the achievable A fall for every cardiac output.',
                   'Lower wing loading buys lower A_req (A_req ~ sqrt(W/S)), so bigger wings trade against O2 capacity along the boundary; the trade is a square root, so halving the required O2 capacity needs a quarter of the wing loading.',
                   'The real fish (W/S 46.4 N/m2, A 0.0357 W) is below the boundary at every altitude by more than 30x; no wing enlargement alone reaches it at the fish\'s O2 capacity.',
                   'The TFF point reaches its target only with a cardiac output no sourced fish has and an air-breathing surface no fetched source sizes; that is the finding.']}
json.dump(out, open(os.path.join(HERE, 'tff.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

# ---- Lean candidates: C9 at the target altitude (rho(h)), C14-style aerobic at altitude for the real fish and TFF
cands = {'candidates': [
  {'id': 'tff-v2-cruise-at-1000m', 'problem': 'Can the TFF hold level lift-supported flight at its target altitude?', 'description': f'HYPOTHETICAL TFF v2 at 1000 m: W 0.5886 N, S {W/Q_tff:.5f} m2, C_Lmax 0.78, rho(1000 m) {atm(1000)["rho"]:.4f} kg/m3, cruising at 6 m/s (v_min {A_req(1000,Q_tff,m)[1]:.2f} m/s).', 'source': 'physics/flier/tff/tff.json', 'accepts': ['lift_supported_flight'], 'commits': {'airspeed_m_s': 6, 'weight_N': '0.5886', 'lifting_area_m2': f'{W/Q_tff:.5f}', 'air_density_kg_m3': f'{atm(1000)["rho"]:.4f}', 'max_lift_coefficient': '0.78'}},
  {'id': 'tff-v2-too-slow-at-1000m', 'problem': 'Control: the TFF claimed at 4 m/s at 1000 m', 'description': 'Should be ELIMINATED by C9.', 'source': 'physics/flier/tff/tff.json', 'accepts': ['lift_supported_flight'], 'commits': {'airspeed_m_s': 4, 'weight_N': '0.5886', 'lifting_area_m2': f'{W/Q_tff:.5f}', 'air_density_kg_m3': f'{atm(1000)["rho"]:.4f}', 'max_lift_coefficient': '0.78'}},
  {'id': 'real-fish-aerobic-at-1000m', 'problem': 'The real fish sustaining aerobic flight at 1000 m with its chain numbers', 'description': f'Real fish, Q 0.0656 ml/s, C_a(1000 m) {Ca(1000):.4f} ml/ml, eta 0.15, E 19.34 J/ml: aerobic ceiling {A_avail(1000,0.0656):.4f} W against {A_req(1000,real["Q"],m)[0]:.3f} W required at v_min. Should be ELIMINATED by C14 (altitude form).', 'source': 'physics/flier/tff/tff.json', 'accepts': ['lift_supported_flight'], 'commits': {'aerobic_ceiling_W': f'{A_avail(1000,0.0656):.5f}', 'power_required_W': f'{A_req(1000,real["Q"],m)[0]:.4f}'}}]}
json.dump(cands, open(os.path.join(HERE, 'lean-candidates-tff.json'), 'w', encoding='utf-8'), indent=2)

# ---- figure: log-log map, boundaries per altitude, real fish and TFF points, A_avail(h) markers
Wd, Hd, ml, mr, mt, mb = 860, 520, 70, 24, 70, 56
x0, x1, y0, y1 = math.log10(5), 2.0, -2.0, 1.0
X = lambda q: ml + (math.log10(q) - x0) / (x1 - x0) * (Wd - ml - mr)
Y = lambda a: Hd - mb - (math.log10(a) - y0) / (y1 - y0) * (Hd - mt - mb)
cols = {0: '#2a78d6', 1000: '#1baf7a', 2000: '#8a8a85', 3000: '#eb6834', 5000: '#6250d6'}
s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wd} {Hd}" font-family="system-ui,sans-serif" font-size="12"><style>text{{fill:currentColor}}.grid{{stroke:currentColor;stroke-opacity:.12}}</style>',
     f'<text x="{ml}" y="20" font-size="15" font-weight="700">Co-design map (HYPOTHETICAL): wing loading against aerobic O2 capacity, by altitude</text>',
     f'<text x="{ml}" y="38" opacity=".7">Feasible for sustained level flight above each curve: η E Q C_a(h) ≥ W v_min(h)/(L/D) + inertial. Real fin polar; standard atmosphere; trout Hb curve; no bird data.</text>']
for q in (5, 10, 20, 50, 100): s.append(f'<line class="grid" x1="{X(q):.1f}" y1="{mt}" x2="{X(q):.1f}" y2="{Hd-mb}"/><text x="{X(q):.1f}" y="{Hd-mb+16}" text-anchor="middle">{q}</text>')
for a in (0.01, 0.1, 1, 10): s.append(f'<line class="grid" x1="{ml}" y1="{Y(a):.1f}" x2="{Wd-mr}" y2="{Y(a):.1f}"/><text x="{ml-8}" y="{Y(a)+4:.1f}" text-anchor="end">{a:g}</text>')
s.append(f'<text x="{(ml+Wd-mr)/2:.0f}" y="{Hd-12}" text-anchor="middle">wing loading W/S (N/m², log)</text><text transform="translate(16 {(mt+Hd-mb)/2:.0f}) rotate(-90)" text-anchor="middle">aerobic capacity η·E·Q·C_a (W, log)</text>')
for h in hs:
    pts = ' '.join(f'{X(b["Q"]):.1f},{Y(b["A_req"]):.1f}' for b in boundary[str(h)])
    s.append(f'<polyline points="{pts}" fill="none" stroke="{cols[h]}" stroke-width="2"><title>Boundary at {h} m: A_req = W v_min/(L/D) + 8 W/kg x m; rho {atm(h)["rho"]:.3f} kg/m3, PO2 {atm(h)["PO2_kPa"]:.1f} kPa, C_a {Ca(h):.3f} ml/ml</title></polyline>')
    b = boundary[str(h)][-1]; s.append(f'<text x="{X(b["Q"])+4:.1f}" y="{Y(b["A_req"])+4:.1f}" fill="{cols[h]}">{h} m</text>')
s.append(f'<circle cx="{X(real["Q"]):.1f}" cy="{Y(real["A0"]):.1f}" r="7" fill="#14201f" stroke="#fff" stroke-width="2"><title>Real flying fish: W/S {real["Q"]:.1f} N/m2 (Park and Choi 2010), aerobic capacity 0.0357 W (Lean C14 from the chain). Below every boundary.</title></circle><text x="{X(real["Q"])+10:.1f}" y="{Y(real["A0"])+4:.1f}">real flying fish</text>')
s.append(f'<polygon points="{X(Q_tff):.1f},{Y(A_tff)-9:.1f} {X(Q_tff)+9:.1f},{Y(A_tff):.1f} {X(Q_tff):.1f},{Y(A_tff)+9:.1f} {X(Q_tff)-9:.1f},{Y(A_tff):.1f}" fill="#fff" stroke="#b3392f" stroke-width="2.5"><title>TFF v2 design (HYPOTHETICAL): W/S {Q_tff} N/m2, A {A_tff:.2f} W at sea level (cardiac output {Qc_tff*60/m:.0f} ml/min/kg at fish C_a: no sourced fish has it); ceiling {ceil_tff:.0f} m with PaO2 = PiO2.</title></polygon><text x="{X(Q_tff)+12:.1f}" y="{Y(A_tff)+4:.1f}" fill="#b3392f">TFF v2 (hypothetical)</text>')
for h in (1000, 3000, 5000):
    a = A_avail(h, Qc_tff); s.append(f'<circle cx="{X(Q_tff):.1f}" cy="{Y(a):.1f}" r="4" fill="{cols[h]}"><title>TFF aerobic capacity at {h} m: C_a falls with PO2, A = {a:.2f} W</title></circle>')
s.append('</svg>')
open(os.path.join(HERE, 'map.svg'), 'w', encoding='utf-8').write('\n'.join(s))
print(json.dumps({'A_need_1000m': A_need_target, 'A_tff': A_tff, 'Qc_tff_ml_min_kg': Qc_tff * 60 / m, 'ceiling_m': ceil_tff, 'O2_air_ml_min_kg': O2_uptake_air_ml_s * 60 / m, 'Ca': {h: round(Ca(h), 4) for h in hs}, 'rho': {h: round(atm(h)['rho'], 4) for h in hs}, 'real_A0': real['A0'], 'ceil_table_sample': ceil_table[:6]}, indent=1))
