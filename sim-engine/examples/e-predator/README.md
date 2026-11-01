# Example (e): escape from a predator by air

**Question.** A predator strikes (the McKee & McHenry 2020 approach model with its default parameters: approach-speed ratio K = 1.5, visual threshold 14°, latency 0.76 s).
Which organisms can leave the water and glide out of reach?
`scenario_run` predator on each organism at its reference age.

**Headline.** **Can escape by air: flying-fish, tff.** Cannot: zebrafish-adult, winged-zebrafish, wingless-flying-fish. No verdict (no model): zebrafish-larva, ff-zf-chimera.
- flying-fish: glide v_min 8.989 m/s (derived), aerial escape distance 8.645 m (derived).
- tff: glide v_min 5.012 m/s (derived), aerial escape distance 21.05 m (derived).
- zebrafish-adult cannot: glide v_min 13.03 m/s (derived), launch 0.6698 m/s (calibrated).
- winged-zebrafish cannot: glide v_min 8.64 m/s (derived), launch 0.6698 m/s (calibrated).
- wingless-flying-fish cannot: glide v_min 21.75 m/s (derived), launch 10 m/s (borrowed).
- zebrafish-larva: no verdict (assumed). The larval branch of the model is an escape-probability lookup (P = 0.7, labelled calibrated) with no aerial step.
- ff-zf-chimera: no verdict (assumed). A blend has no measured leap speed, and none is invented.

The brief said "the five organisms". The bundle holds seven (three references and four designs), so all seven are shown.

## Every organism

| organism | aerial escape available | aerial escape distance | glide v_min | peak escape speed (water) | critical predator speed ratio | P(escape) per strike | survives the strike (water) | limiting |
|---|---|---|---|---|---|---|---|---|
| zebrafish-adult | false (derived) | 0 m (derived) | 13.03 m/s (derived) | 0.951 m/s (derived) | 2.145 (derived) | null (assumed) | true | predator closest approach 0.044 m stays outside strike reach 0.022 m (escape works while K < 2.145) |
| zebrafish-larva | null (assumed) | null (assumed) | null (assumed) | 0.192 m/s (measured-secondhand) | null (assumed) | 0.7 (calibrated) | null | per-strike escape probability 0.7 (measured lookup, adult zebrafish predator); the outcome is probabilistic, so survives is null |
| flying-fish | true (derived) | 8.645 m (derived) | 8.989 m/s (derived) | 2.854 m/s (derived) | 2.145 (derived) | null (assumed) | true | predator closest approach 0.228 m stays outside strike reach 0.114 m (escape works while K < 2.145) |
| tff | true (derived) | 21.05 m (derived) | 5.012 m/s (derived) | 2.854 m/s (derived) | 2.145 (derived) | null (assumed) | true | predator closest approach 0.228 m stays outside strike reach 0.114 m (escape works while K < 2.145) |
| winged-zebrafish | false (derived) | 0 m (derived) | 8.64 m/s (derived) | 0.951 m/s (derived) | 2.145 (derived) | null (assumed) | true | predator closest approach 0.044 m stays outside strike reach 0.022 m (escape works while K < 2.145) |
| wingless-flying-fish | false (derived) | 0 m (derived) | 21.75 m/s (derived) | 2.854 m/s (derived) | 2.145 (derived) | null (assumed) | true | predator closest approach 0.228 m stays outside strike reach 0.114 m (escape works while K < 2.145) |
| ff-zf-chimera | null (assumed) | null (assumed) | 15.96 m/s (derived) | 2.964 m/s (derived) | 2.145 (derived) | null (assumed) | true | predator closest approach 0.136 m stays outside strike reach 0.068 m (escape works while K < 2.145) |

How to read it:
- `survives` is the in-water C-start escape. Every adult escapes the default strike while the predator is slower than the critical speed ratio. The larva's outcome is probabilistic (`escape_probability`; its kind is in the table), so `survives` is null.
- `aerial_escape_available` asks whether the fish can leave the water at its own sourced launch speed and stay airborne (launch speed >= glide v_min). The aerial distance uses the glide model, which includes the level kinetic phase (outside the Lean glide theorem; see example a).
- The winged zebrafish's larger fin lowers v_min (compare zebrafish-adult), but nowhere near its own burst speed, so the wing does not buy an aerial escape.

## Scope (from the tool, zebrafish-adult run)

survives = the fish evades the predator (null when the outcome is probabilistic or rests on an unmeasured aerial escape); feasible = an aerial escape is physically available (takeoff check). A kinematic encounter model, not a survival rate. It does not model predator strike kinematics, suction flow, escape direction choice, habituation, schooling, turbidity or light; the larval probability is a measured lookup for one predator (adult zebrafish). Adult zebrafish peak speed is a single-lab mean of 5 fish, applied per SL; other post-larval species borrow it. The aerial distance is the glide.mjs still-air range bound (with ground effect, no taxiing thrust) and says nothing about what the predator does next. Out-of-validity results are reported under out_of_validity and are NOT law violations. STATE comes from the parametric body plan (anatomy-model/parametric), the project growth trajectories (development/) and physiology/ constants. Many inputs are assumed or borrowed from other species; check weakest_input on each field. MORPHOLOGICAL interpolation, not genetic hybridisation (anatomy-model/parametric/design-schema.json): a blended or edited parameter set is a shape, not an organism; it says nothing about whether such an animal could be bred, is viable, or is developmentally reachable.

## Checks this script enforces (exit code 1 if any fails)

| check | last run |
|---|---|
| predator ran for all seven organisms | pass |
| TFF can escape by air | pass |
| reference flying fish can escape by air (its own ~10 m/s leap exceeds v_min) | pass |
| no zebrafish (adult, larva, winged) can escape by air | pass |
| wingless flying fish cannot escape by air | pass |
| blend (ff-zf-chimera) gets no aerial verdict (no launch speed for a blend is invented) | pass |
| an aerial escape always comes with a positive glide distance | pass |
| aerial verdict follows v_min: a lower v_min never loses an escape a higher one has (among fish with the same launch speed) | pass |

---
Generated by `node sim-engine/examples/e-predator/run.mjs` on 2026-11-01T03:07:14.642Z from `output.json` in this folder. Numbers are rounded to 4 significant figures; full precision and every provenance record are in output.json. Provenance kinds: measured, measured-secondhand, borrowed, derived, calibrated (tuned to reproduce one observation: never a result), assumed (a placeholder). Lean verdicts are floating-point evaluations of Lean-backed formulas, not kernel proofs. No Aves data used.
