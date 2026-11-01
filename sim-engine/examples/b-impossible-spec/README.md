# Example (b): an impossible spec

**Request:** "a zebrafish-derived fish that glides at least 1000 m from a 1 m launch and survives 10–45 °C as an adult". This is example (a) with the glide raised from 5 m to 1000 m and the temperature range widened to 45 °C.
The same labelled what-if launch speed (10 m/s, *assumed*) is kept, so that the glide is limited by the glide law and not only by the zebrafish's launch speed.

**Headline. no design meets the spec.** 57 of 57 candidates were rejected. Two laws rule the request out:

1. **Glide range** — law `flight-climb-glide-law` v1.0.0 (accepted; Lean theorem `Delphi.glide_range_le`, module `lean/Delphi/Flight.lean`):
   "If available mechanical power is spent on level flight, on raising the weight at vertical speed c, and on non-negative losses, then c ≤ (P_avail − P_req)/W. A steady glide with no thrust, lift equal to weight and L/D ≤ (L/D)max from height h covers at most h (L/D)max horizontally; with drag reduced by a fraction δ near the surface and lift unaffected, at most h (L/D)max/(1 − δ)."
   With h = 1 m and the model's (L/D)max = 4.37 (borrowed: Park H, Choi H (2010). Aerodynamic characteristics of flying fish in gliding flight. J Exp Biol 213:3269-3279, Table 2 (stuffed C. hiraii in a wind tunnel); borrowed: this animal's own polar is not measured), a steady unpowered glide covers at most 4.37 m.
   `lean_check` on the claim "1000 m from 1 m" returns **C15 violated**.
2. **Thermal window** — law `perturb-thermal` v1.0.0 (accepted, not yet accepted, so it is advisory; theorem `Delphi.Perturb.thermal_rules_out`):
   "Under the thermal-performance hypothesis (sustained power zero outside [CTmin, CTmax], and at most P_ref Q10^((T - T_ref)/10) inside), no positive sustained power is possible outside the thermal window, and sustained power never exceeds the Q10 bound."
   The temperature scenario gives the adult zebrafish CTmax 40.45 °C (calibrated) and CTmin 8.4 °C (calibrated). 45 °C is outside that window.
   `lean_check` returns **P1 violated**. (The CT values are interpolations of the same paper the validation thread scored them against, so the validation thread rates them circular: see validation/STUDIO-FINDINGS.md D4.)

## The optimizer's rejections (`design_from_spec`, seed 1, budget 60)

A candidate is rejected at its first broken hard constraint, and the glide constraint is checked first, so every rejection names the glide.

| first broken constraint (sample of 8) | count |
|---|---|
| glide.glide_range_total_m >= 1000 | 8 |

The longest glide any sampled candidate reached was 17.61 m (`glide_range_total_m`, derived; it includes the level kinetic phase, which lies outside the Lean theorem). That is 56.8 times short of the target.

## Starting design, per criterion

| id | criterion | stage | verdict | value | weakest provenance | limiting |
|---|---|---|---|---|---|---|
| c1 | a zebrafish-derived fish that glides at least 1000 m from a 1 m launch | adult | failed | 0 m | assumed | cannot glide: the reachable launch speed 10.00 m/s is below v_min 13.03 m/s, so lift cannot carry the weight |
| c2 | survives 10–45 °C as an adult | adult | met | true | assumed |  |
| c3 | survives 10–45 °C as an adult | adult | failed | false | assumed | above CTmax (40.5 degC): loss of equilibrium in an acute ramp |

## What the lean_check was given

| field | value | where it came from |
|---|---|---|
| glideHeight_m, glideDistance_m | 1, 1000 | the request |
| LD_max | 4.37 | glide scenario provenance, kind borrowed |
| groundEffect | 0 | away from the surface (the bound with the measured 14 % drag reduction is only h (L/D)max / 0.86) |
| water_temperature_C | 45 | the request |
| ct_min_C, ct_max_C | 8.4, 40.45 | temperature scenario, kinds calibrated, calibrated |
| sustained_power_W | 1e-6 | "survives and keeps swimming" written as any positive sustained power (a stand-in for the claim, not a measurement) |

The lean_check verdicts are floating-point evaluations of the formulas the Lean lemmas encode (`Delphi.Constraints.glide_range_rules_out`, `Delphi.Perturb.thermal_rules_out`), not kernel proofs of this case.

## Scope (from the tool)

A local, seeded search (the optimize tool) over the editable parameters, climbing one metric; every other criterion is re-checked on the result at every requested stage. Not a global optimum. Verdicts are only as good as the scenario models and the STATE inputs they rest on; each criterion row carries the weakest provenance kind behind it and the model's limiting factor. Lean verdicts are floating-point evaluations of the Lean-backed formulas, not kernel checks; by default only NEW binding violations (absent from the unedited parents) fail a design. A "no-model" criterion is not met. A designed parameter set is a shape, not a viable organism: MORPHOLOGICAL interpolation, not genetic hybridisation.

## Checks this script enforces (exit code 1 if any fails)

| check | last run |
|---|---|
| parser returns a valid spec | pass |
| parser keeps the impossible 1000 m target (does not clip it) | pass |
| parser keeps 45 °C | pass |
| design_from_spec: no design meets the spec | pass |
| every optimizer candidate rejected | pass |
| 45 °C criterion fails on the starting design | pass |
| 45 °C is above the zebrafish CTmax | pass |
| flight-climb-glide-law is accepted, theorem glide_range_le | pass |
| lean_check: C15 (glide range) violated by a 1000 m glide from 1 m | pass |
| lean_check: P1 (thermal window) violated at 45 °C | pass |
| the best glide any sampled candidate reached is far below 1000 m | pass |
| every sampled rejection names the glide constraint | pass |

---
Generated by `node sim-engine/examples/b-impossible-spec/run.mjs` on 2026-11-01T04:39:02.195Z from `output.json` in this folder. Numbers are rounded to 4 significant figures; full precision and every provenance record are in output.json. Provenance kinds: measured, measured-secondhand, borrowed, derived, calibrated (tuned to reproduce one observation: never a result), assumed (a placeholder). Lean verdicts are floating-point evaluations of Lean-backed formulas, not kernel proofs. No Aves data used.
