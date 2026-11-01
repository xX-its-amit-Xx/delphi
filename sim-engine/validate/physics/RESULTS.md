# physics_simulation: controls and what they rest on

Generated 2026-11-01T05:35:14.777Z by `node sim-engine/validate/physics/controls.mjs`. Ensemble: **400 draws**, seed `delphi-v1`. Machine-readable: `physics-results.json`.

**5 of 5 controls came out the right way round.**

## Controls

| id | organism | function | expected | got | verdict |
|---|---|---|---|---|---|
| C1 | `flying-fish` | glide/feasible, glide/glide_range_total_m | pass | **pass** | correct |
| C2 | `zebrafish-adult` | glide/feasible, glide/glide_range_total_m | fail | **fail** | correct |
| C3 | `wingless-flying-fish` | glide/feasible, glide/glide_range_total_m | fail | **fail** | correct |
| C4 | `tff` | glide/powered_flight_margin | fail | **fail** | correct |
| C5 | `zebrafish-adult` | current/feasible | pass | **pass** | correct |
| X1 (observation) | `winged-zebrafish` | glide/feasible, glide/glide_range_total_m | fail | **fail** | correct |

## Per criterion, with the ensemble

| id | criterion | measured | threshold | status | ensemble: achieved / median / 5-95 % | model_confidence |
|---|---|---|---|---|---|---|
| C1 | `glide/feasible` @ adult | true | feasible true | **met** | 100.0 % of 400 / n/a / n/a-n/a | circular, weakest assumed |
| C1 | `glide/glide_range_total_m` @ adult | 36.487 m | >= 10 | **met** | 100.0 % of 400 / 53.7942 / 37.5539-72.9011 | circular, weakest assumed |
| C2 | `glide/feasible` @ adult | false | feasible true | **not met** | 0.0 % of 400 / n/a / n/a-n/a (launch speed NOT drawn) | circular, weakest assumed |
| C2 | `glide/glide_range_total_m` @ adult | 0 m | >= 10 | **not met** | 0.0 % of 400 / 0 / 0-0 (launch speed NOT drawn) | circular, weakest assumed |
| C3 | `glide/feasible` @ adult | false | feasible true | **not met** | 0.0 % of 400 / n/a / n/a-n/a | circular, weakest assumed |
| C3 | `glide/glide_range_total_m` @ adult | 0 m | >= 10 | **not met** | 0.0 % of 400 / 0 / 0-0 | circular, weakest assumed |
| C4 | `glide/powered_flight_margin` @ adult | 0.0477 1 | >= 1 | **not met** | 0.0 % of 400 / 0.0476 / 0.0377-0.0584 | circular, weakest assumed |
| C5 | `current/feasible` @ adult | true | feasible true | **met** | 100.0 % of 400 / n/a / n/a-n/a (launch speed NOT drawn) | circular-in-part, weakest assumed |
| X1 | `glide/feasible` @ adult | false | feasible true | **not met** | 0.0 % of 400 / n/a / n/a-n/a (launch speed NOT drawn) | circular, weakest assumed |
| X1 | `glide/glide_range_total_m` @ adult | 0 m | >= 10 | **not met** | 0.0 % of 400 / 0 / 0-0 (launch speed NOT drawn) | circular, weakest assumed |

### C1 `flying-fish` -- the real adult flying fish glides; if this fails the check is broken, not the animal

Gate: `pass`, physics_gate_failed = `false`.

Every hard criterion is met (glide/feasible, glide/glide_range_total_m). This is a model result, not a demonstration: 2 of 2 criteria rest on a model the independent harness calls circular.

| standing check | stage | measured | threshold | status | model_confidence |
|---|---|---|---|---|---|
| `reaches_minimum_flight_speed` | adult | 15 m/s | 8.9891 | met | circular |
| `lifting_area_supports_mass` | adult | 0.0152 m2 | 0.0055 | met | circular |
| `sustained_swimming_aerobic_ceiling` | adult | 3.899e-4 W | 0.5815 | met | circular-in-part |
| `organ_volume_fits_body` | adult | 1 fraction of the requested volume | 0.95 | met | unvalidated |
| `static_pitch_margin` | adult | n/a | n/a | no model | no model |

**Rests on a circular model:**

- criterion glide-feasible (glide/feasible)
- criterion glide-range (glide/glide_range_total_m)
- standing check reaches_minimum_flight_speed@adult
- standing check lifting_area_supports_mass@adult
- standing check sustained_swimming_aerobic_ceiling@adult

### C2 `zebrafish-adult` -- a zebrafish cannot glide: its burst speed is an order of magnitude below its own v_min

Gate: `fail`, physics_gate_failed = `true`.

FAIL: the design does not do what was asked. 2 hard criterion(s) not met: glide/feasible -- adult: cannot glide: the reachable launch speed 0.67 m/s is below v_min 13.03 m/s, so lift cannot carry the weight [achieved in 0.0 % of 400 draws over the stated input distributions; median null, 5-95 % null to null] | glide/glide_range_total_m -- adult: cannot glide: the reachable launch speed 0.67 m/s is below v_min 13.03 m/s, so lift cannot carry the weight [achieved in 0.0 % of 400 draws over the stated input distributions; median 0 m, 5-95 % 0 to 0] Standing physical checks failed (reported beside the gate, not folded into it): reaches_minimum_flight_speed@adult -- reachable launch speed 0.67 m/s is 12.36 m/s below v_min 13.03 m/s: lift cannot carry the weight | lifting_area_supports_mass@adult -- the lifting area is 378.29x too small: 0.84 cm2 against 317.76 cm2 needed to carry 0.007 N at 0.67 m/s

| standing check | stage | measured | threshold | status | model_confidence |
|---|---|---|---|---|---|
| `reaches_minimum_flight_speed` | adult | 0.6698 m/s | 13.0277 | not met | circular |
| `lifting_area_supports_mass` | adult | 8.400e-5 m2 | 0.0318 | not met | circular |
| `sustained_swimming_aerobic_ceiling` | adult | 4.251e-5 W | 0.0032 | met | circular-in-part |
| `organ_volume_fits_body` | adult | 1 fraction of the requested volume | 0.95 | met | unvalidated |
| `static_pitch_margin` | adult | n/a | n/a | no model | no model |

**Rests on a circular model:**

- criterion glide-feasible (glide/feasible)
- criterion glide-range (glide/glide_range_total_m)
- standing check reaches_minimum_flight_speed@adult
- standing check lifting_area_supports_mass@adult
- standing check sustained_swimming_aerobic_ceiling@adult

### C3 `wingless-flying-fish` -- take the wings off a flying fish and it cannot glide, at the same launch speed

Gate: `fail`, physics_gate_failed = `true`.

FAIL: the design does not do what was asked. 2 hard criterion(s) not met: glide/feasible -- adult: cannot glide: the reachable launch speed 15.00 m/s is below v_min 21.75 m/s, so lift cannot carry the weight [achieved in 0.0 % of 400 draws over the stated input distributions; median null, 5-95 % null to null] | glide/glide_range_total_m -- adult: cannot glide: the reachable launch speed 15.00 m/s is below v_min 21.75 m/s, so lift cannot carry the weight [achieved in 0.0 % of 400 draws over the stated input distributions; median 0 m, 5-95 % 0 to 0] Standing physical checks failed (reported beside the gate, not folded into it): reaches_minimum_flight_speed@adult -- reachable launch speed 15.00 m/s is 6.75 m/s below v_min 21.75 m/s: lift cannot carry the weight | lifting_area_supports_mass@adult -- the lifting area is 2.10x too small: 26.04 cm2 against 54.76 cm2 needed to carry 0.589 N at 15.00 m/s

| standing check | stage | measured | threshold | status | model_confidence |
|---|---|---|---|---|---|
| `reaches_minimum_flight_speed` | adult | 15 m/s | 21.7515 | not met | circular |
| `lifting_area_supports_mass` | adult | 0.0026 m2 | 0.0055 | not met | circular |
| `sustained_swimming_aerobic_ceiling` | adult | 3.899e-4 W | 0.5815 | met | circular-in-part |
| `organ_volume_fits_body` | adult | 1 fraction of the requested volume | 0.95 | met | unvalidated |
| `static_pitch_margin` | adult | n/a | n/a | no model | no model |

**Rests on a circular model:**

- criterion glide-feasible (glide/feasible)
- criterion glide-range (glide/glide_range_total_m)
- standing check reaches_minimum_flight_speed@adult
- standing check lifting_area_supports_mass@adult
- standing check sustained_swimming_aerobic_ceiling@adult

### C4 `tff` -- THE HEADLINE RESULT: the hypothetical truly flying fish cannot pay for powered flight. This control must survive

Gate: `fail`, physics_gate_failed = `true`.

FAIL: the design does not do what was asked. 1 hard criterion(s) not met: glide/powered_flight_margin -- adult: glide only: the aerobic O2 supply cannot pay for level powered flight (Fick bound; about 5-16x short with corrected O2 supply and efficiency, central 12x; 21x on the snapper-Q fallback) [achieved in 0.0 % of 400 draws over the stated input distributions; median 0.0476 1, 5-95 % 0.0377 to 0.0584] Standing physical checks failed (reported beside the gate, not folded into it): organ_volume_fits_body@adult -- only 26.6 % of the requested flight-muscle volume fits inside the skin (analytic capacity transfer (validate/sanity.mjs)); the remaining 73.4 % has nowhere to go, so any power claim that charges the full muscle mass is unphysical

| standing check | stage | measured | threshold | status | model_confidence |
|---|---|---|---|---|---|
| `reaches_minimum_flight_speed` | adult | 15 m/s | 5.0118 | met | circular |
| `lifting_area_supports_mass` | adult | 0.0491 m2 | 0.0055 | met | circular |
| `sustained_swimming_aerobic_ceiling` | adult | 3.899e-4 W | 0.5815 | met | circular-in-part |
| `organ_volume_fits_body` | adult | 0.2657 fraction of the requested volume | 0.95 | not met | unvalidated |
| `static_pitch_margin` | adult | n/a | n/a | no model | no model |

**Rests on a circular model:**

- criterion powered-margin (glide/powered_flight_margin)
- standing check reaches_minimum_flight_speed@adult
- standing check lifting_area_supports_mass@adult
- standing check sustained_swimming_aerobic_ceiling@adult

### C5 `zebrafish-adult` -- an unedited zebrafish asked only to swim does what it does

Gate: `pass`, physics_gate_failed = `false`.

Every hard criterion is met (current/feasible). This is a model result, not a demonstration: 1 of 1 criteria rest on a model the independent harness calls circular. Standing physical checks failed (reported beside the gate, not folded into it): reaches_minimum_flight_speed@adult -- reachable launch speed 0.67 m/s is 12.36 m/s below v_min 13.03 m/s: lift cannot carry the weight | lifting_area_supports_mass@adult -- the lifting area is 378.29x too small: 0.84 cm2 against 317.76 cm2 needed to carry 0.007 N at 0.67 m/s

| standing check | stage | measured | threshold | status | model_confidence |
|---|---|---|---|---|---|
| `reaches_minimum_flight_speed` | adult | 0.6698 m/s | 13.0277 | not met | circular |
| `lifting_area_supports_mass` | adult | 8.400e-5 m2 | 0.0318 | not met | circular |
| `sustained_swimming_aerobic_ceiling` | adult | 4.251e-5 W | 0.0032 | met | circular-in-part |
| `organ_volume_fits_body` | adult | 1 fraction of the requested volume | 0.95 | met | unvalidated |
| `static_pitch_margin` | adult | n/a | n/a | no model | no model |

**Rests on a circular model:**

- criterion hold-station (current/feasible)
- standing check reaches_minimum_flight_speed@adult
- standing check lifting_area_supports_mass@adult
- standing check sustained_swimming_aerobic_ceiling@adult

### X1 `winged-zebrafish` -- the winged zebrafish: fins moved toward the flying fish, still far below its own v_min

Gate: `fail`, physics_gate_failed = `true`.

FAIL: the design does not do what was asked. 2 hard criterion(s) not met: glide/feasible -- adult: cannot glide: the reachable launch speed 0.67 m/s is below v_min 8.64 m/s, so lift cannot carry the weight [achieved in 0.0 % of 400 draws over the stated input distributions; median null, 5-95 % null to null] | glide/glide_range_total_m -- adult: cannot glide: the reachable launch speed 0.67 m/s is below v_min 8.64 m/s, so lift cannot carry the weight [achieved in 0.0 % of 400 draws over the stated input distributions; median 0 m, 5-95 % 0 to 0] Standing physical checks failed (reported beside the gate, not folded into it): reaches_minimum_flight_speed@adult -- reachable launch speed 0.67 m/s is 7.97 m/s below v_min 8.64 m/s: lift cannot carry the weight | lifting_area_supports_mass@adult -- the lifting area is 166.37x too small: 1.91 cm2 against 317.76 cm2 needed to carry 0.007 N at 0.67 m/s

| standing check | stage | measured | threshold | status | model_confidence |
|---|---|---|---|---|---|
| `reaches_minimum_flight_speed` | adult | 0.6698 m/s | 8.6395 | not met | circular |
| `lifting_area_supports_mass` | adult | 1.910e-4 m2 | 0.0318 | not met | circular |
| `sustained_swimming_aerobic_ceiling` | adult | 4.251e-5 W | 0.0032 | met | circular-in-part |
| `organ_volume_fits_body` | adult | 1 fraction of the requested volume | 0.95 | met | unvalidated |
| `static_pitch_margin` | adult | n/a | n/a | no model | no model |

**Rests on a circular model:**

- criterion glide-feasible (glide/feasible)
- criterion glide-range (glide/glide_range_total_m)
- standing check reaches_minimum_flight_speed@adult
- standing check lifting_area_supports_mass@adult
- standing check sustained_swimming_aerobic_ceiling@adult

## What these controls do and do not establish

The four negative controls (C2, C3, C4 and X1) are the part of this result that is **not** circular: each turns on an inequality between two independently sourced quantities -- a burst or taxi speed from one body of field observations against a v_min computed from a wind-tunnel polar and a measured mass and area -- rather than on a number fitted to the comparison. C1, the positive control, is `rests-on-assumed` at best and `circular` in part: the independent harness records (STUDIO-RESULTS W9) that the 36.5 m it predicts at 15 m/s is in band, but the 15 m/s launch speed and the 50 m field glide come from the same body of second-hand observations (Davenport 1994 / Edgerton & Breder 1941 via Makiguchi 2013 and Deng 2019). glide.mjs's own modelCard says so: "PARTLY CIRCULAR ... Not independent evidence."

Nothing here models control, flapping, unsteady aerodynamics, take-off power or whole-body stability. The static-margin check reports `no model` on purpose: see the header of `standing.mjs`.
