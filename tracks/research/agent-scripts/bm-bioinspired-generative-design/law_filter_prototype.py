"""Prototype pre-print law filter (PYTHON, NOT LEAN-CHECKED). Run: python -I law_filter_prototype.py

Purpose: show that the three verified laws can act as a cheap gate on a list of candidate designs
BEFORE printing, and exercise the same three-state vocabulary as lean/eliminate/eliminate.mjs
(eliminated / consistent / cannot-rule). The laws are re-implemented here from the statements in
  - D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean  (Timoshenko, ceiling 3/(2h))
  - lean/ThompsonLaws/HollowTube.lean as summarised in D:/Users/ashenoy00000/delphi-work/agents/laws-biomaterial.json
  - lean/ThompsonLaws/MurrayCubic.lean (same file)
The candidates below are SYNTHETIC TEST INPUTS, not measurements, except where marked.
Writes: D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-bioinspired-generative-design/filter_ledger.json
"""
import json, math, os, sys
from fractions import Fraction as F

OUT = 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-bioinspired-generative-design'
os.makedirs(OUT, exist_ok=True)

# ---------------- law 1: Timoshenko bilayer (exact rational arithmetic) ----------------
def tim_coeff_times_h(m, n):
    """h * timoshenkoCoefficient h m n  =  6(1+m)^2 / (3(1+m)^2 + (1+mn)(m^2 + 1/(mn)))"""
    m, n = F(m), F(n)
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))

def bilayer_kappa(h1, h2, E1, E2, deps):
    h = F(h1) + F(h2); m = F(h1) / F(h2); n = F(E1) / F(E2)
    return tim_coeff_times_h(m, n) * F(deps) / h

def bilayer_ceiling(h1, h2, deps):
    return F(3, 2) * abs(F(deps)) / (F(h1) + F(h2))

def check_bilayer(c, tol):
    h1, h2, E1, E2, deps, claim = (c[k] for k in ('h1_mm', 'h2_mm', 'E1_MPa', 'E2_MPa', 'deps', 'claimed_kappa_per_mm'))
    ceil_ = bilayer_ceiling(h1, h2, deps)
    fwd = bilayer_kappa(h1, h2, E1, E2, deps)
    claim = F(str(claim))
    out = {'ceiling_per_mm': float(ceil_), 'forward_map_per_mm': float(fwd), 'claimed_per_mm': float(claim)}
    # ceiling holds for every m, n > 0 (Lean: timoshenkoCoefficient_le); tol is relative slack for input uncertainty
    if claim > ceil_ * (1 + F(str(tol))):
        return 'eliminated', 'claimed curvature exceeds 3/(2h)*|deps| by more than tol=%s' % tol, out
    if claim > ceil_:
        return 'cannot-rule', 'claim exceeds the ceiling by less than the input tolerance %s' % tol, out
    if abs(claim - fwd) > F(str(tol)) * abs(fwd):
        return 'eliminated', 'claim differs from the Timoshenko forward map by more than tol (law is an equality under its assumptions)', out
    return 'consistent', 'not ruled out by Timoshenko (not shown feasible)', out

# ---------------- law 2: hollow tube, mass at fixed bending stiffness ----------------
def mu(k, q):
    k, q = float(k), float(q)
    return (1 - k * k + q * k * k) / math.sqrt(1 - k ** 4)

def check_tube(c, tol):
    q = c['core_density_ratio_q']; R = c['R_outer_mm']; k = c['k_inner_over_outer']
    wall_floor_mm = c.get('wall_floor_mm', 0.2)          # Form 4 supported wall, spec-formlabs-materials.json
    k_max = 1 - wall_floor_mm / R                        # t/R >= lambda  ->  k <= 1 - lambda
    if k > k_max + 1e-12:
        return 'eliminated', 'wall %.3f mm below printer floor %.3f mm' % ((1 - k) * R, wall_floor_mm), {'k_max': k_max}
    kstar = math.sqrt(1 - q) if 0 < q < 1 else (0.0 if q >= 1 else k_max)
    k_adm = min(kstar, k_max)
    mu_min = mu(k_adm, q)
    claim = c['claimed_mass_factor_vs_solid']
    out = {'k_star_admissible': k_adm, 'mass_factor_min': mu_min, 'mass_factor_at_k': mu(k, q), 'claimed': claim}
    if claim < mu_min * (1 - tol):
        return 'eliminated', 'claimed mass factor below the proven minimum mu(k*) at equal stiffness', out
    if abs(claim - mu(k, q)) > tol * mu(k, q):
        return 'eliminated', 'claimed mass factor differs from mu(k) of the stated geometry', out
    return 'consistent', 'not ruled out by HollowTube (not shown feasible)', out

# ---------------- law 3: Murray junction r0^a = r1^a + r2^a ----------------
def check_murray(c, tol):
    a = c.get('alpha', 3)
    r0, r1, r2 = c['r0_mm'], c['r1_mm'], c['r2_mm']
    if c.get('regime') not in ('laminar_volume_cost',):
        return 'cannot-rule', 'candidate does not commit to the laminar, volume-cost model (alpha=3 only holds there)', {}
    lhs, rhs = r0 ** a, r1 ** a + r2 ** a
    rel = abs(lhs - rhs) / rhs
    out = {'alpha': a, 'lhs': lhs, 'rhs': rhs, 'rel_dev': rel}
    if rel > tol:
        return 'eliminated', 'junction violates r0^%s = r1^%s + r2^%s by %.1f%% (> tol)' % (a, a, a, rel * 100), out
    return 'consistent', 'junction consistent with Murray (not shown feasible)', out

CHECKS = {'bilayer': check_bilayer, 'tube': check_tube, 'junction': check_murray}

CANDS = [  # SYNTHETIC test inputs unless noted
    {'id': 'bilayer-optimal-n10', 'type': 'bilayer', 'h1_mm': 0.25, 'h2_mm': 0.79, 'E1_MPa': 10, 'E2_MPa': 1, 'deps': '0.01',
     'claimed_kappa_per_mm': 0.0144, 'note': 'm=h1/h2~n^-1/2: near the optimum'},
    {'id': 'bilayer-too-curly', 'type': 'bilayer', 'h1_mm': 0.4, 'h2_mm': 0.4, 'E1_MPa': 10, 'E2_MPa': 1, 'deps': '0.01',
     'claimed_kappa_per_mm': 0.03, 'note': 'claims > 1.5*deps/h = 0.01875/mm'},
    {'id': 'bilayer-beech-1.53', 'type': 'bilayer', 'h1_mm': 1.0, 'h2_mm': 4.1, 'E1_MPa': 1, 'E2_MPa': 1, 'deps': '0.01',
     'claimed_kappa_per_mm': 0.0, 'note': 'placeholder: see beech row below'},
    {'id': 'tube-lighter-than-possible', 'type': 'tube', 'core_density_ratio_q': 0.3, 'R_outer_mm': 5.0, 'k_inner_over_outer': 0.8,
     'claimed_mass_factor_vs_solid': 0.5},
    {'id': 'tube-wall-too-thin', 'type': 'tube', 'core_density_ratio_q': 0.0, 'R_outer_mm': 1.0, 'k_inner_over_outer': 0.9,
     'claimed_mass_factor_vs_solid': 0.4},
    {'id': 'tube-sound', 'type': 'tube', 'core_density_ratio_q': 0.3, 'R_outer_mm': 5.0, 'k_inner_over_outer': 0.7,
     'claimed_mass_factor_vs_solid': mu(0.7, 0.3)},
    {'id': 'junction-equal-radii', 'type': 'junction', 'regime': 'laminar_volume_cost', 'r0_mm': 1.0, 'r1_mm': 0.8, 'r2_mm': 0.8,
     'note': '1^3=1 vs 2*0.512=1.024'},
    {'id': 'junction-area-preserving', 'type': 'junction', 'regime': 'laminar_volume_cost', 'r0_mm': 1.0, 'r1_mm': 0.7071, 'r2_mm': 0.7071,
     'note': 'area-preserving (alpha=2) junction, violates alpha=3'},
    {'id': 'junction-no-model', 'type': 'junction', 'r0_mm': 1.0, 'r1_mm': 0.7, 'r2_mm': 0.7},
]
# Replace the placeholder with the measured-style row from scratch/scout-biomaterial (kappa*h/d_eps = 1.53 at h=4.7 mm total... normalised only):
# normalised 1.53 means kappa = 1.53*deps/h; use h1+h2 = 5.1 mm, deps=0.01 -> 0.00300 /mm; ceiling 0.00294 /mm
for c in CANDS:
    if c['id'] == 'bilayer-beech-1.53':
        c['claimed_kappa_per_mm'] = 1.53 * 0.01 / 5.1
        c['note'] = 'normalised kappa*h/deps = 1.53 (retro_beech.py of scout-biomaterial); deps uncertain 10 percent'

def sweep_ceiling():
    """Own numerical check of f(m,n) <= 3/2 and equality at m^2 n = 1 over a log grid (floats) plus exact points (Fractions)."""
    worst = 0.0; arg = None
    for i in range(-60, 61):
        for j in range(-60, 61):
            m = 10 ** (i / 20); n = 10 ** (j / 20)
            v = float(tim_coeff_times_h(F(m), F(n)))
            if v > worst: worst, arg = v, (m, n)
    exact = [tim_coeff_times_h(F(1, k), F(k * k)) for k in (1, 2, 3, 5, 10)]  # m=1/k, n=k^2 -> m^2 n = 1
    equal10 = float(tim_coeff_times_h(1, 10))
    return {'max_f_over_grid': worst, 'argmax_(m,n)': arg, 'exact_f_at_m2n_eq_1': [str(x) for x in exact],
            'f_equal_layers_n10': equal10, 'loss_vs_optimum_pct': 100 * (1 - equal10 / 1.5)}

if __name__ == '__main__':
    tol = 0.10
    ledger = {'tolerance': tol, 'sweep': sweep_ceiling(), 'rows': []}
    for c in CANDS:
        st, why, det = CHECKS[c['type']](c, tol)
        ledger['rows'].append({'id': c['id'], 'type': c['type'], 'verdict': st, 'why': why, 'detail': det})
    json.dump(ledger, open(OUT + '/filter_ledger.json', 'w'), indent=1)
    print(json.dumps(ledger['sweep'], indent=1))
    for r in ledger['rows']:
        print('%-28s %-12s %s' % (r['id'], r['verdict'], r['why']))
    # non-zero exit if the sweep ever exceeds 3/2 (would contradict the project record)
    sys.exit(0 if ledger['sweep']['max_f_over_grid'] <= 1.5 + 1e-12 else 1)
