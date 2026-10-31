#!/usr/bin/env python
"""HYPOTHETICAL designed flier: a flying fish that could climb and sustain flapping flight. Design study, not a measurement.

Starts from the real specimen (Park and Choi 2010 model L3) and changes ONLY morphology and physiology parameters:
lifting area (wing loading), aspect ratio, flight-muscle fraction, and the physiology targets (O2 delivery). The
equations are those of the simulator and of physics/FORMAL-STATEMENTS.md; nothing is changed in them. Every input
below carries its source and kind. NO BIRD VALUE is used: powered-flight values come from bats and insects (and
pterosaur wing form); where a value exists only for birds it is marked unavailable (holdout).

Writes physics/flier/spec.json (the parameter diff, derived requirements, power budget, O2 demand), and
physics/flier/lean-candidate.json (illustrative candidate for lean/eliminate, sent through the hub).
"""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); PHYS = os.path.dirname(HERE); REPO = os.path.dirname(PHYS)
res = json.load(open(os.path.join(PHYS, 'results.json'), encoding='utf-8'))
B = res['interpretation_B']
g, rho = 9.81, 1.225

# ---------------- sourced inputs (non-bird)
src = {
 'real_fish': {'mass_kg': 0.06, 'ref_area_m2': B['reference_area_m2'], 'span_m': 0.261, 'AR': 10.7, 'CL_max': 0.78, 'LD_max': 4.37, 'CD_min': 0.055,
               'kind': 'measured', 'source': 'park-choi-2010 Tables 1 and 2 (model L3)'},
 'bat_flight_muscle_fraction': {'mean': 0.0913, 'min': 0.078, 'kind': 'secondary', 'source': 'PMC10966098 (Onychonycteris paper, 10.1038/s42003-024-06032-9) citing Bullen and McKenzie 2004: flight muscle on average 9.13 % of body mass in extant bats, minimum 7.8 %'},
 'bat_mech_power_W': {'mean': 0.092, 'max': 0.140, 'min': 0.046, 'body_mass_kg': 0.0076, 'kind': 'measured', 'source': 'PMC10154928 (10.1098/rspb.2023.0045): Pipistrellus nathusii, 7.6 +- 0.8 g, estimated mechanical power 0.046 to 0.140 W, mean 0.092 W, from aerodynamic measurement'},
 'bat_conversion_efficiency': {'low': 0.070, 'high': 0.104, 'kind': 'measured', 'source': 'PMC10154928: conversion efficiency 7.0 to 10.4 % increasing with speed in P. nathusii'},
 'bat_metabolic_power_per_weight_W_per_N': {'min': 7.1, 'max': 18.7, 'kind': 'measured', 'source': 'PMC10154928: weight-specific metabolic power 7.1 to 18.7 W per N'},
 'bat_inertial_power_W_per_kg': {'value': 8, 'kind': 'secondary', 'source': 'PMC9490335 (10.1098/rsif.2022.0315): inertial power about 8 W/kg, roughly independent of speed (Cynopterus brachyotis model); 6 to 7 W/kg in Plecotus and Glossophaga per Norberg'},
 'bat_wing_loading_N_m2': {'low': 6.5, 'high': 14.25, 'kind': 'secondary-compilation', 'source': 'physics/comparison-data.csv (span-efficiency compilation): Plecotus auritus 6.5, Glossophaga soricina 11.05, Leptonycteris yerbabuenae 14.25 N/m2'},
 'pterosaur_hatchling': {'wing_loading_N_m2': [15.83, 17.88], 'AR': [6.1, 6.5], 'kind': 'modelled', 'source': 'PMC8298463 (10.1038/s41598-021-92499-z): hatchling pterosaur wing loading 15.83 to 17.88 N/m2, aspect ratio 6.1 to 6.5 (modelled from fossils); Draco 22.7 to 24.2 N/m2 quoted there'},
 'bumblebee_hover_metabolic_W_per_kg': {'value': 559, 'efficiency': [0.073, 0.147], 'kind': 'measured', 'source': 'PMC12606204 (10.1098/rsbl.2025.0325): hovering metabolic power 559 W/kg body; overall efficiency 7.3 to 14.7 %'},
 'oxycaloric_J_per_ml_O2': {'value': 20.1, 'kind': 'standard', 'source': 'oxycaloric equivalent for mixed substrate; the bumblebee paper uses 21.1 J per ml CO2 for carbohydrate'},
 'bird_values': {'kind': 'unavailable (holdout)', 'source': 'class Aves is the frozen holdout; no bird parameter, comparison or figure is used'},
}
# ---------------- derived: bat muscle mass-specific mechanical power (derived, not measured by anyone as such)
mm_bat = src['bat_mech_power_W']['body_mass_kg'] * src['bat_flight_muscle_fraction']['mean']
p_mean = src['bat_mech_power_W']['mean'] / mm_bat; p_max = src['bat_mech_power_W']['max'] / mm_bat
# ---------------- the design (HYPOTHETICAL). Mass and body unchanged; fins enlarged; muscle fraction raised.
m = src['real_fish']['mass_kg']; W = m * g
design = {
 'label': 'HYPOTHETICAL truly-flying fish F1 (design study)',
 'hypothetical': True,
 'mass_kg': {'value': m, 'changed': False, 'reason': 'same body; the question is what fins and muscle a 60 g fish would need'},
 'wing_loading_N_m2': {'value': 12.0, 'changed': True, 'from': W / src['real_fish']['ref_area_m2'], 'reason': 'inside the bat range 6.5 to 14.25 N/m2 and below the pterosaur hatchling 15.8 to 17.9; chosen, not optimised'},
 'lifting_area_m2': {'value': W / 12.0, 'changed': True, 'from': src['real_fish']['ref_area_m2']},
 'aspect_ratio': {'value': 9.0, 'changed': False, 'from': src['real_fish']['AR'], 'reason': 'kept at the fish value (9.0 to 10.7 in Park and Choi), which already lies in the powered-flier range the pterosaur paper quotes (6.1 to 6.5 for hatchlings; "avian 5 to 12" is a bird figure and is NOT used)'},
 'span_m': {'value': math.sqrt(9.0 * W / 12.0), 'changed': True, 'from': src['real_fish']['span_m']},
 'CL_max': {'value': src['real_fish']['CL_max'], 'changed': False, 'reason': 'same fin section; measured'},
 'LD_max': {'value': src['real_fish']['LD_max'], 'changed': False, 'reason': 'same measured polar (conservative: bats are not assumed better)'},
 'flight_muscle_fraction': {'value': 0.16, 'changed': True, 'from': 'not reported for flying fish (Davenport 1992: red axial muscle no more than mackerel)', 'reason': 'see power budget: 0.16 is the smallest fraction that covers a 1 m/s climb at the bat-derived MAX specific power (0.15 falls 0.05 W short); it is ABOVE the bat mean (9.1 %) and minimum (7.8 %); the bat maximum is not in the fetched sources; at the bat MEAN specific power even 0.16 only just fails level flight'},
 'muscle_specific_mech_power_W_per_kg': {'value': p_max, 'range': [p_mean, p_max], 'changed': 'new', 'kind': 'derived', 'reason': 'P. nathusii mechanical power 0.140 W (max) over its flight muscle 7.6 g x 9.13 % = 0.69 g: ' + f'{p_max:.0f} W/kg muscle (mean {p_mean:.0f}); a derived figure from two sourced numbers, and the chain may replace it'},
 'conversion_efficiency': {'value': 0.10, 'range': src['bat_conversion_efficiency'], 'changed': 'new', 'reason': 'top of the bat-measured range; bumblebee 7 to 15 %'},
}
S = design['lifting_area_m2']['value']; CLmax = design['CL_max']['value']; LD = design['LD_max']['value']
vmin = math.sqrt(2 * W / (rho * S * CLmax))
# power required for level flight at speed v with the fish polar (CD = CDmin + k CL^2, k from CL0 = 0.40 assumed in the sim)
CL0, CDmin = 0.40, src['real_fish']['CD_min']; k = (CL0 / LD - CDmin) / CL0 ** 2
def preq(v, climb=0.0):
    q = 0.5 * rho * v * v * S; CL = W / q
    if CL > CLmax: return None
    CD = CDmin + k * CL * CL
    return q * CD * v + W * climb + src['bat_inertial_power_W_per_kg']['value'] * m
speeds = [vmin, 6, 7, 8, 10, 12]
table = []
for v in speeds:
    p0 = preq(v); p1 = preq(v, 1.0)
    table.append({'v_m_s': v, 'P_req_level_W': p0, 'P_req_climb_1_m_s_W': p1})
Pmin_level = min(t['P_req_level_W'] for t in table if t['P_req_level_W'])
Pmin_climb = min(t['P_req_climb_1_m_s_W'] for t in table if t['P_req_climb_1_m_s_W'])
f = design['flight_muscle_fraction']['value']
P_avail_max = f * m * p_max; P_avail_mean = f * m * p_mean
# what fraction would a bat-like fish have
P_avail_batmean = src['bat_flight_muscle_fraction']['mean'] * m * p_max
# aerobic demand
eta = design['conversion_efficiency']['value']
P_met = Pmin_climb / eta; mo2_ml_s = P_met / src['oxycaloric_J_per_ml_O2']['value']
budget = {
 'v_min_m_s': vmin,
 'P_req_table': table,
 'P_req_min_level_W': Pmin_level, 'P_req_min_climb_1_m_s_W': Pmin_climb,
 'P_avail_W_at_design_fraction': {'max_specific': P_avail_max, 'mean_specific': P_avail_mean},
 'P_avail_W_at_bat_mean_fraction': P_avail_batmean,
 'verdict_mechanical': ('design fraction 0.16 covers level flight and a 1 m/s climb at the bat-derived MAX specific power' if P_avail_max >= Pmin_climb else 'design fraction does not cover the climb'),
 'verdict_bat_like': ('a 60 g fish with the bat MEAN muscle fraction (9.1 %) ' + ('could' if P_avail_batmean >= Pmin_level else 'could NOT') + ' fly level at the bat-derived max specific power, and ' + ('could' if P_avail_batmean >= Pmin_climb else 'could NOT') + ' climb at 1 m/s'),
 'metabolic_power_W_for_climb': P_met, 'metabolic_W_per_kg_body': P_met / m,
 'compare': {'bat_metabolic_W_per_kg_body_range': [src['bat_metabolic_power_per_weight_W_per_N']['min'] * g, src['bat_metabolic_power_per_weight_W_per_N']['max'] * g], 'bumblebee_hover_W_per_kg': 559},
 'O2_demand_ml_per_s': mo2_ml_s, 'O2_demand_ml_per_min_per_kg': mo2_ml_s * 60 / m,
 'physiology_note': 'The O2 demand is what the gill, haemoglobin and cardiac modules must supply for SUSTAINED flight; whether any gill can is for the physiology chain and the Lean O2-to-power bound. Burst (anaerobic) flight for seconds is a separate question. The real fish, per Davenport 1992, has no more red axial muscle than a mackerel.',
}
spec = {'note': 'HYPOTHETICAL design study. Changes parameters only; the simulator equations and the measured polar are unchanged. No bird value anywhere.',
        'sources': src, 'bat_muscle_specific_power_derived_W_per_kg': {'mean': p_mean, 'max': p_max},
        'design': design, 'power_budget': budget,
        'parameter_diff_real_to_flier': {
            'lifting_area_m2': [src['real_fish']['ref_area_m2'], S], 'wing_loading_N_m2': [W / src['real_fish']['ref_area_m2'], 12.0],
            'span_m': [src['real_fish']['span_m'], design['span_m']['value']], 'aspect_ratio': [src['real_fish']['AR'], 9.0],
            'flight_muscle_fraction': ['unknown (small)', 0.16], 'muscle_specific_mech_power_W_per_kg': ['unknown', p_max],
            'conversion_efficiency': ['unknown', 0.10], 'O2_delivery_ml_per_min_per_kg_required': ['unknown', mo2_ml_s * 60 / m],
            'mass_kg': [m, m], 'CL_max': [CLmax, CLmax], 'LD_max': [LD, LD]},
        'what_this_does_not_establish': ['that such a fish could develop (development is not simulated)', 'that fins of 4x area at the same section keep the measured polar', 'that any gill can deliver the O2 (physiology chain pending)', 'anything about birds (holdout)']}
json.dump(spec, open(os.path.join(HERE, 'spec.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
# Lean candidate (illustrative): commits to C9 at cruise and at v_min
cand = {'candidates': [
  {'id': 'flier-F1-cruise', 'problem': 'Could a 60 g flying fish with enlarged fins sustain lift-supported flight at 7 m/s?', 'description': 'HYPOTHETICAL designed flier F1: weight 0.5886 N, lifting area ' + f'{S:.4f}' + ' m2 (wing loading 12 N/m2), C_L,max 0.78 (measured on the real fins), sea-level air, cruising at 7 m/s.',
   'source': 'physics/flier/spec.json (physics thread design study, 2026-10-31); C_L,max from Park and Choi 2010', 'accepts': ['lift_supported_flight'],
   'commits': {'airspeed_m_s': 7, 'weight_N': '0.5886', 'lifting_area_m2': f'{S:.5f}', 'air_density_kg_m3': '1.225', 'max_lift_coefficient': '0.78'}},
  {'id': 'flier-F1-too-slow', 'problem': 'The same flier claimed to hold level flight at 4 m/s', 'description': 'Control candidate that should be ELIMINATED by C9: v_min is ' + f'{vmin:.2f}' + ' m/s for this wing loading and C_L,max.',
   'source': 'physics/flier/spec.json', 'accepts': ['lift_supported_flight'],
   'commits': {'airspeed_m_s': 4, 'weight_N': '0.5886', 'lifting_area_m2': f'{S:.5f}', 'air_density_kg_m3': '1.225', 'max_lift_coefficient': '0.78'}},
  {'id': 'real-fish-L3-glide', 'problem': 'The real specimen gliding at 15 m/s (field value)', 'description': 'Real fish, measured W, S, C_L,max; quoted field glide speed 15 m/s. Should be CONSISTENT with C9.',
   'source': 'physics/results.json interpretation_B', 'accepts': ['lift_supported_flight'],
   'commits': {'airspeed_m_s': 15, 'weight_N': '0.5886', 'lifting_area_m2': '0.012688', 'air_density_kg_m3': '1.225', 'max_lift_coefficient': '0.78'}}]}
json.dump(cand, open(os.path.join(HERE, 'lean-candidate.json'), 'w', encoding='utf-8'), indent=2)
print(json.dumps({'S': S, 'span': design['span_m']['value'], 'vmin': vmin, 'p_mean': p_mean, 'p_max': p_max, 'Preq_level_min': Pmin_level, 'Preq_climb_min': Pmin_climb,
                  'Pavail_design': [P_avail_mean, P_avail_max], 'Pavail_batmean': P_avail_batmean, 'Pmet': P_met, 'W_per_kg': P_met / m, 'O2_ml_min_kg': mo2_ml_s * 60 / m, 'table': table}, indent=1))
