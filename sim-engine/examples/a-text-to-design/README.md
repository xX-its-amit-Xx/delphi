# Example (a): text to design

**Request (plain English):** "a zebrafish-derived fish that glides at least 5 m from a 1 m launch and survives 10–30 °C as an adult"

**Headline.** As written, **no design meets the spec**. The glide criterion fails: cannot glide: the reachable launch speed 0.67 m/s is below v_min 13.03 m/s, so lift cannot carry the weight (`scenario_run` glide on the plain zebrafish; launch speed 0.6698 m/s (calibrated), v_min 13.03 m/s (derived)).
With a labelled **what-if** that gives the fish a flying fish's ~10 m/s leap speed (an *assumed* input for a zebrafish), the optimizer finds a
design that **meets the spec**: `body:body.pectoral_area_over_SL2` = 0.1547, `body:body.pectoral_span_over_SL` = 0.6163, gliding 18.26 m from 1 m. Only 4.37 m of that is covered by the proved Lean bound; the rest is the level kinetic phase, which lies outside the theorem. That design rests on the assumption. It is not evidence that a zebrafish-derived fish could glide.

## Step 1. Text to spec (`parse_design_text`: rule-based, no LLM)

The parser produced 3 criteria:

| id | scenario | op | value | params | stages |
|---|---|---|---|---|---|
| c1 | glide | >= | 5 | {"launch_height_m":1} | ["adult"] |
| c2 | temperature | survives |  | {"water_temperature_C":10} | ["adult"] |
| c3 | temperature | survives |  | {"water_temperature_C":30} | ["adult"] |

- Text it could not read (returned verbatim, not guessed): none.
- Defaults it applied: "no stage stated for 1 criterion: adult assumed (say "as a larva", "at all stages" or "at 30 dpf")"; "no editable parameters stated: the optimizer has nothing to vary (say e.g. "vary the pectoral fin area from 0.02 to 0.08")"; "Lean constraints not mentioned: they hold anyway (constraints.lean is always "must-hold")".
- Validation warnings: none.

Acting as the agent, the script
does what AGENT-GUIDE-SPEC.md says. It keeps the parser's `zebrafish-adult` start (which is what "zebrafish-derived" means here) and
adds the editable parts the user left open. The ranges run from the zebrafish value to the flying-fish value, read with `organism_get` (each value's kind is in output.json under `ranges_from`):

| target | param | min (zebrafish-adult) | max (flying-fish) |
|---|---|---|---|
| body:body | pectoral_area_over_SL2 | 0.016 | 0.1547 |
| body:body | pectoral_span_over_SL | 0.42 | 1.286 |

## Step 2. Design against the spec as written (`design_from_spec`, seed 1, budget 60)

Status: **no design meets the spec**. The optimizer made 57 evaluations and rejected 57.
Rejection reasons (first 8 are in output.json): glide.glide_range_total_m >= 5.

The starting design (plain adult zebrafish), per criterion and stage:

| id | criterion | target | stage | verdict | value | weakest provenance | limiting |
|---|---|---|---|---|---|---|---|
| c1 | a zebrafish-derived fish that glides at least 5 m from a 1 m launch | >= 5 m | adult | failed | 0 m | assumed | cannot glide: the reachable launch speed 0.67 m/s is below v_min 13.03 m/s, so lift cannot carry the weight |
| c2 | survives 10–30 °C as an adult | survives | adult | met | true | assumed |  |
| c3 | survives 10–30 °C as an adult | survives | adult | met | true | borrowed |  |

In the glide model, the zebrafish's launch speed is its own maximum swimming speed. It is *calibrated*: 1.15 x Ucrit, read back from Plaut 2000 (current.mjs).
No pectoral fin inside the range lowers v_min to that speed, so the glide constraint rejects every candidate.

## Step 3. Labelled what-if: grant a 10 m/s launch (`launch_airspeed_override_m_s`, kind *assumed*)

Status: **meets the spec**. Meets the spec: all 3 hard criteria hold at every requested stage and the Lean verdicts hold. Soft score 1.000.
The optimizer made 57 evaluations (including the start design), climbing `glide.glide_range_total_m` (maximize).
Winning edits: `body:body.pectoral_area_over_SL2` = 0.1547, `body:body.pectoral_span_over_SL` = 0.6163.

| id | criterion | target | stage | verdict | value | weakest provenance (as reported) | limiting |
|---|---|---|---|---|---|---|---|
| c1 | a zebrafish-derived fish that glides at least 5 m from a 1 m launch | >= 5 m | adult | met | 18.26 m | assumed | glide only: the aerobic O2 supply cannot pay for level powered flight (ceiling from measured MO2max; 12.3x short) |
| c2 | survives 10–30 °C as an adult | survives | adult | met | true | assumed |  |
| c3 | survives 10–30 °C as an adult | survives | adult | met | true | borrowed |  |

Lean verdicts on the winning design: no violation reported (a floating-point check of the Lean-backed formulas, not a kernel proof).

**What the 18.26 m is made of** (the winning design re-run through `scenario_run` glide, with the same parameters):

| metric | value | kind |
|---|---|---|
| launch_airspeed_m_s | 10 m/s | assumed |
| v_min_m_s | 6.134 m/s | derived |
| glide_range_lean_bound_m | 4.37 m | derived |
| kinetic_phase_m | 13.89 m | derived |
| glide_range_total_m | 18.26 m | derived |
| wing_loading_N_m2 | 17.98 N/m2 | derived |

Only `glide_range_lean_bound_m` (4.37 m (derived)) is covered by the Lean theorem `glide_range_le`. The level
kinetic-energy phase (13.89 m (derived)) lies outside the theorem's hypotheses, and the assumed launch speed drives it.

## Studio defects seen in this run

none

## Scope (from the tool)

A local, seeded search (the optimize tool) over the editable parameters, climbing one metric; every other criterion is re-checked on the result at every requested stage. Not a global optimum. Verdicts are only as good as the scenario models and the STATE inputs they rest on; each criterion row carries the weakest provenance kind behind it and the model's limiting factor. Lean verdicts are floating-point evaluations of the Lean-backed formulas, not kernel checks; by default only NEW binding violations (absent from the unedited parents) fail a design. A "no-model" criterion is not met. A designed parameter set is a shape, not a viable organism: MORPHOLOGICAL interpolation, not genetic hybridisation.

## Checks this script enforces (exit code 1 if any fails)

| check | last run |
|---|---|
| parser returns a valid spec | pass |
| parser reads a glide criterion >= 5 m from 1 m | pass |
| parser reads 10-30 °C as two survives criteria | pass |
| parser starts from zebrafish-adult | pass |
| as written: no design meets the spec | pass |
| as written: zebrafish glide infeasible, launch speed below v_min (scenario_run) | pass |
| as written: zebrafish launch speed is labelled calibrated | pass |
| design_from_spec explanation carries the limiting factor of the failed glide | pass |
| as written: temperature criteria met at 10 and 30 °C | pass |
| what-if: meets the spec | pass |
| what-if: glide >= 5 m at adult | pass |
| what-if: no Lean law violated by the winning design | pass |
| re-run of winning design: launch speed labelled assumed (the what-if) | pass |
| re-run reproduces the design_from_spec glide value | pass |
| what-if glide verdict carries the assumed launch speed as its weakest provenance | pass |
| optimizer summary counts feasible candidates (> 0 when a design was found) | pass |
| parser reads the whole sentence (nothing unparsed) | pass |

---
Generated by `node sim-engine/examples/a-text-to-design/run.mjs` on 2026-11-01T04:46:13.217Z from `output.json` in this folder. Numbers are rounded to 4 significant figures; full precision and every provenance record are in output.json. Provenance kinds: measured, measured-secondhand, borrowed, derived, calibrated (tuned to reproduce one observation: never a result), assumed (a placeholder). Lean verdicts are floating-point evaluations of Lean-backed formulas, not kernel proofs. No Aves data used.
