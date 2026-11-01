# Design Studio: independent validation results

Generated 2026-11-01T03:02:07.484Z by `sim-engine/validation/studio-harness.mjs` against the tests fixed in
`STUDIO-PREREGISTRATION.md` (sha256 `f2523da8529b998eea8ef9b9f165851f60d078a7ac5151a0dafa7bb4d324a66d`, integrity check: **hash matches**).
Machine-readable: `studio-results.json`. Narrative and worst defects: `STUDIO-FINDINGS.md`. Post-results amendment: `STUDIO-AMENDMENTS.md`. Rows X* are observations added after results and are not counted. A pass that rests on a calibrated value is reported as `circular`, never as a pass.

Harness self-test (each check made to fail on a planted bad input): **all 20 behave as designed**.

Fixture run (deliberately wrong scenario modules under C:/Temp/studio-validation-fixtures/bad, 2026-11-01T02:35:44.230Z): 12 of 18 evaluable checks flagged the planted defect: W2 circular, W3 fail, W4 fail, W5 pass, W6 fail, W7 fail, W9 pass, N1 fail, N2 fail, N3 fail, N4 fail, N5 fail, N7-temperature pass, N7-pressure pass, N7-altitude pass, N7-wind fail, N7-grip fail, N7-sleep pass. (W5, the N7 rows whose fixture honoured the contract, and W9 whose fixture speed is random, can pass by design.)

## Scoreboard

| status | pre-registered rule | after amendments A1–A3 (post-results, see STUDIO-AMENDMENTS.md) |
|---|---|---|
| circular | 6 | 8 |
| fail | 2 | 0 |
| no-target | 1 | 1 |
| pass | 20 | 22 |
| pass-rests-on-assumed | 2 | 0 |

Modules found: organism `lib/organism.mjs`, state `lib/state.mjs`, data `lib/data-node.mjs`, spec `lib/spec.mjs`, parse `lib/parse-text.mjs`, optimizer —; scenarios: temperature, current, pressure, altitude, wind, predator, grip, sleep, daynight, digestion, glide.

## Per test

| id | test | status | predicted | measured / band | weakest kind | why |
|---|---|---|---|---|---|---|
| W1 | adult zebrafish Ucrit | **pass-rests-on-assumed** → A1: **circular** | 15.0 BL/s | 15.5 SL/s (Plaut 2000); 18.0 BL/s (Palstra 2010) band [12.4, 21.6] | assumed | in band; weakest input is assumed; AMENDMENT A1: the metric is an interpolation/fit of the target paper itself, so the pre-registered pass is not independent evidence |
| W2 | zebrafish CTmax | **circular** | 40.5 °C | 39.2 (20 °C accl.) – 41.7 (30 °C) °C; 40.97 °C (Morgan 2018) band [38.7, 42.2] | calibrated | in band, but rests on a calibrated quantity |
| W3 | zebrafish CTmin | **circular** | 8.40 °C | 6.2 (20 °C accl.) – 10.6 (30 °C) °C band [5.2, 11.6] | calibrated | in band, but rests on a calibrated quantity |
| W4 | thermal survival sign (25, 28 survive; 45, 2 do not) | **pass** | {"2":false,"25":true,"28":true,"45":false} | CTmax 39–42 °C, CTmin 6–11 °C | n/a (sign test) | signs correct |
| W5 | adult night sleep fraction | **circular** | 33.4 % | 58.1 % (Yokogawa 2007); 33.37 % (Sorribes 2013, 4–6 mo) band [24.6, 64.7] | calibrated | in band, but rests on a calibrated quantity |
| W6 | adult day sleep fraction ≤ 7.7 % and below night | **circular** | 5.10 % | 5.1 ± 1.3 % (Yokogawa 2007) band [0, 7.7] | calibrated | in band, but rests on a calibrated quantity |
| W7 | larval night sleep > adult, larval in [49.7, 66.7] % | **circular** | 58.2 (adult 33.4) | 58.17 % larva vs 33.37 % adult (Sorribes 2013) band [49.7, 66.7] | calibrated | in band, but rests on a calibrated quantity |
| W8 | adult C-start peak speed | **pass-rests-on-assumed** → A1: **circular** | 0.951 m/s | ≈0.84 m/s derived from Re 27,800, TL 33 mm (Danos & Lauder 2012) band [0.42, 1.68] | assumed | in band; weakest input is assumed; AMENDMENT A1: the metric is an interpolation/fit of the target paper itself, so the pre-registered pass is not independent evidence |
| W9 | flying fish glide distance and speed | **circular** | 8.65 m at 10.0 m/s (from glide) | up to 50 m at 15–20 m/s (secondhand) band 5,75 m; 7.5,25 m/s | assumed | distance: in band; weakest input is assumed; speed: in band, but the predicted value equals a constant in the module sourced to the target paper (echo) |
| W10 | gut passage time | **no-target** | no passage metric | none fetched | n/a | no fetched wild-type gut passage time; the studio value is UNVALIDATED |
| W11 | sustained current sign (pre-registered: 0.20 m/s survive, 1.10 m/s not; A2 reads feasible) | **fail** → A2: **pass** | survives: 0.20 m/s → null, 1.10 m/s → null; feasible: 0.20 → true, 1.10 → false (param current_m_s) | Uopt 0.396, Ucrit 0.548 m/s | n/a (sign test) | pre-registered reading (survives): not met, survives is null/null; A2 reading (feasible = can hold station): signs correct |
| N1 | real zebrafish must not glide (< 1 m) | **pass** | 0.00 m (from glide, metric glide_range_total_m, survives=null, feasible=false) | ballistic leap ≈ 0.07 m | assumed | below 1 m or flagged not surviving |
| N2 | no fish survives at 9,000 or 10,000 m | **pass** | all 14 runs survive=false | no fish below 8,400 m (Yancey 2014) | n/a (negative control) | all fish die |
| N3 | no grip force without a gripping organ (zebrafish) | **pass** | has_gripping_structure = false bool (derived); validity {"inRange":true,"notes":"nothing to model"} | zebrafish has no gripping organ | derived | no positive grip force |
| N4 | flyable heights downward closed (Lean Altitude.feasible_downward_closed) | **pass** | flying-fish:111000; zebrafish-adult:000000; zebrafish-larva:000000; ff-zf-chimera:111110; tff:111110; winged-zebrafish:000000; wingless-flying-fish:000000 | proved: feasible at h ⇒ feasible below h | n/a (law control) | monotone for every organism |
| N5 | glide range ≤ h·L/D/(1−δ) (Lean glide_range_le) | **fail** → A3: **pass** | A3: Lean-covered metric only: flying-fish: 4.37 ≤ 4.37? true; zebrafish-adult: 0.00 ≤ 4.37? true; zebrafish-larva: 0.00 ≤ 4.37? true; tff: 4.37 ≤ 4.37? true; winged-zebrafish: 0.00 ≤ 4.37? true; wingless-flying-fish: 0.00 ≤ 4.37? true; every total above the bound is labelled NOT covered by the theorem \|\| pre-registered (every reported distance): flying-fish: d=8.65 ≤ h·L/D/(1−δ) = 1.00·4.37/(1−0.00) = 4.37? false; zebrafish-adult: d=0.00 ≤ h·L/D/(1−δ) = 1.00·4.37/(1−0.00) = 4.37? true; zebrafish-larva: d=0.00 ≤ h·L/D/(1−δ) = 1.00·4.37/(1−0.00) = 4.37? true; tff: d=21.0 ≤ h·L/D/(1−δ) = 1.00·4.37/(1−0.00) = 4.37? false; winged-zebrafish: d=0.00 ≤ h·L/D/(1−δ) = 1.00·4.37/(1−0.00) = 4.37? true; wingless-flying-fish: d=0.00 ≤ h·L/D/(1−δ) = 1.00·4.37/(1−0.00) = 4.37? true |  | n/a (law control) | bound violated for flying-fish, tff |
| O1 | already-maximal objective is not improved | **pass** | ctmax_C: start 40.5, run 1 best 40.5, re-run on own output best 40.5 (gain 0.00 %); returned design carries 0 edits ("start") although the objective is flat in them |  | n/a | idempotent and not worse than start |
| O2 | impossible glide spec → no design meets the spec | **pass** | status "no design meets the spec", evaluations 57, rejections {"hard constraint":57} (launch height not a declared metric/param; the 1 m launch height of the pre-registered spec could not be imposed) |  | n/a | explicitly reports no design meets the spec |
| O3 | impossible depth spec → no design meets the spec | **pass** | status "no design meets the spec", evaluations 57, rejections {"hard constraint":57} |  | n/a | explicitly reports no design meets the spec |
| P1 | parser keeps impossible targets (1000 m glide, 10,000 m depth) | **pass** | glide → {"spec":{"start_from":[{"organism":"zebrafish-adult","weight":1}],"criteria":[{"scenario":"glide","metric":"glide_range_total_m","op":">=","value":1000,"unit":"m","params":{},"hard":true,"weight":1,"s \| depth → {"spec":{"start_from":[],"criteria":[{"scenario":"pressure","params":{"depth_m":10000,"water":"sea"},"op":"survives","hard":true,"weight":1,"source_text":"a fish at 10,000 m depth","stages":["adult"], |  | n/a | both targets kept |
| X1 | zebrafish LARVA glide (N1 covers only the adult) | **observation** | 0.00 m, survives=null, inRange=false (from glide) |  |  | ok |
| X2 | altitude: survives vs limiting consistency (zebrafish adult, defaults) | **observation** | survives=true; feasible=false; feasibility_note="cannot glide at 2000 m: reachable launch speed 0.67 m/s is below v_min 14.37 m/s" |  |  | consistent |
| N7-temperature | contract + determinism: temperature | **pass** | 6 metrics {"calibrated":5,"borrowed":1}; validatedAgainst: [{"organism":"Danio rerio adults, 28 °C acclimation, 0.3 °C/min ramp","observation":"CTmax, first trial","predicted":"41.2 °C","measured":"40.97 ± 0.10 °C (n = 40)","source":"Morgan et al. 2018 Result |  | borrowed | contract holds |
| N7-current | contract + determinism: current | **pass** | 10 metrics {"calibrated":5,"derived":5}; validatedAgainst: [{"organism":"Danio rerio adults (literature summary)","observation":"Ucrit 40-55 cm/s in adults (Widrick 2018 Introduction, citing refs 10-13)","predicted":"46.5 cm/s for SL 30 mm at 28 °C","measured; note: survives=null |  | calibrated | contract holds |
| N7-pressure | contract + determinism: pressure | **pass** | 7 metrics {"derived":7}; validatedAgainst: [{"organism":"Notoliparis kermadecensis (hadal snailfish), 7,000 m","observation":"muscle TMAO","predicted":"359 mmol/kg (line fitted only to 0-4,850 m teleost data, extrapolated 2,150 m)","measured":; note: survives=null |  | derived | contract holds |
| N7-altitude | contract + determinism: altitude | **pass** | 15 metrics {"derived":13,"borrowed":2}; validatedAgainst: [{"organism":"none (atmosphere check)","observation":"barometric pressure measured on Mt. Everest at 5,400 / 6,300 / 8,050 / 8,848 m: 400.4 / 351.0 / 283.6 / 253.0 Torr","predicted":"51.29 / 45.36 / 3 |  | borrowed | contract holds |
| N7-wind | contract + determinism: wind | **pass** | 10 metrics {"derived":9,"borrowed":1}; validatedAgainst: [{"organism":"any flying fish","observation":"glide distance measured with a known wind","predicted":"n/a","measured":"none found: no fetched source reports a glide distance together with the wind spe; note: survives=null |  | borrowed | contract holds |
| N7-predator | contract + determinism: predator | **pass** | 11 metrics {"calibrated":1,"derived":8,"assumed":2}; validatedAgainst: [{"organism":"Danio rerio adult","observation":"McKee & McHenry 2020: escape fails at all angles when the predator approaches at more than about twice the escape speed (w = 2.5 cm)","predicted":"criti |  | assumed | contract holds |
| N7-grip | contract + determinism: grip | **pass** | 5 metrics {"derived":1,"assumed":4}; validatedAgainst: [{"organism":"Gobiesox maeandricus (northern clingfish)","observation":"adhesive force as multiples of body weight","predicted":"60-242 body weights from 20-50 kPa x 3.9-12.3 cm^2 over 8.2-42 g (extre; note: survives=null |  | assumed | contract holds |
| N7-sleep | contract + determinism: sleep | **pass** | 7 metrics {"calibrated":4,"derived":1,"assumed":1,"measured":1}; validatedAgainst: [{"organism":"Danio rerio adult","observation":"night sleep with the SAME 6 s criterion in two labs","predicted":"33.4% (Sorribes, primary series)","measured":"58.1 ± 3.3% (Yokogawa 2007)","source":"d; note: survives=null, validity.inRange=false at defaults |  | assumed | contract holds |
| N7-daynight | contract + determinism: daynight | **pass** | 6 metrics {"measured":1,"assumed":2,"derived":2,"calibrated":1}; validatedAgainst: [{"organism":"Danio rerio (all lookups)","observation":"activity per minute, adult shares at 20/26 C and both periods are read back from their sources","predicted":"the source values","measured":"the ; note: survives=null |  | assumed | contract holds |
| N7-digestion | contract + determinism: digestion | **pass** | 7 metrics {"derived":6,"assumed":1}; validatedAgainst: [{"organism":"Danio rerio adult","observation":"maintenance feed intake (Licitra 2024, citing Fronte, unpublished): \"a maintenance FI of ~2% of BW\"","predicted":"about 0.6% BW/day at 28.5 C","measur |  | assumed | contract holds |
| N7-glide | contract + determinism: glide | **pass** | 13 metrics {"derived":10,"borrowed":1,"assumed":1,"measured":1}; validatedAgainst: [{"organism":"Cypselurus hiraii (Park & Choi model L3)","observation":"code regression against physics/results.json at rho 1.225","predicted":"v_min 9.854 m/s, P_req 1.327 W","measured":"physics/resul; note: survives=null |  | assumed | contract holds |

## Audit of scenario constants

Code literals only (strings and comments stripped; unit conversions and years ignored). A line is *sourced* if a URL/DOI/PMID/PMC id is within 3 lines, *named-only* if only an author-year or repository-file reference is, else *unsourced*. Named-only is not a defect by itself, but it cannot be fetched without guessing.

| module | lines with constants | sourced | named-only | unsourced |
|---|---|---|---|---|
| scenarios/temperature.mjs | 17 | 6 | 5 | **6** |
| scenarios/current.mjs | 22 | 6 | 8 | **8** |
| scenarios/pressure.mjs | 12 | 5 | 1 | **6** |
| scenarios/altitude.mjs | 13 | 5 | 1 | **7** |
| scenarios/wind.mjs | 2 | 0 | 0 | **2** |
| scenarios/predator.mjs | 18 | 1 | 13 | **4** |
| scenarios/grip.mjs | 8 | 0 | 8 | **0** |
| scenarios/sleep.mjs | 16 | 0 | 14 | **2** |
| scenarios/daynight.mjs | 10 | 0 | 10 | **0** |
| scenarios/digestion.mjs | 18 | 0 | 17 | **1** |
| scenarios/glide.mjs | 26 | 6 | 13 | **7** |

<details><summary>scenarios/temperature.mjs: 6 unsourced lines</summary>

- line 62: `const T = params.water_temperature_C ?? 25;`
- line 63: `const Ta = params.acclimation_temperature_C ?? 25;`
- line 94: `if (Math.abs(Ta - 28) > 1) notes.push('The Ucrit curve was measured in 28 degC-reared fish; at another acclimation temperature it is borrowe`
- line 95: `const smrOk = T >= Q10.range[0] - 0.01 && T <= Q10.range[1] + 0.01 && Math.abs(Ta - 28) <= 3;`
- line 97: `if (T < 0 \|\| T > 45) inRange = false;`
- line 114: `metric('ucrit_relative', METRICS[3].label, ur.value, '1', 'higher', zkind === 'measured' && Math.abs(Ta - 28) <= 1 ? 'calibrated' : 'borrowe`

</details>

<details><summary>scenarios/current.mjs: 8 unsourced lines</summary>

- line 47: `/** Zebrafish Ucrit at 28 degC by age (days post-fertilisation) and SL. Returns {value m/s, kind, source} or value null. */`
- line 51: `if (dpf < 14) {`
- line 52: `const u14 = (UMAX_14DPF_SL_S / UMAX_OVER_UCRIT) * SL_MM(14) / 1000;`
- line 68: `for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (pd(mid) < P_W) lo = mid; else hi = mid; }`
- line 92: `{ key: 'current_m_s', label: 'Current speed', unit: 'm/s', default: 0.2, min: 0, max: 3, kind: 'assumed', source: 'design input' },`
- line 98: `const U = params.current_m_s ?? 0.2;`
- line 101: `const T = val(state, 'temperature_C') ?? 25;`
- line 123: `if (Re != null && Re > 5e5) notes.push('Re above 5e5: turbulent plate coefficient used.');`

</details>

<details><summary>scenarios/pressure.mjs: 6 unsourced lines</summary>

- line 45: `{ key: 'depth_m', label: 'Depth below the surface', unit: 'm', default: 10, min: 0, max: 11000, kind: 'assumed', source: 'design input; 11,0`
- line 53: `const sal = amb.salinity_psu && amb.salinity_psu.value != null ? amb.salinity_psu.value : 35;`
- line 55: `const rhoW = amb.water_density_kg_m3 && amb.water_density_kg_m3.value != null ? amb.water_density_kg_m3.value : amb.water_density && amb.wat`
- line 56: `const P0 = 101.325;`
- line 88: `if (z > 7000) { inRange = false; notes.push('Below 7,000 m the TMAO and osmolality trends are extrapolated past the deepest measurement.'); `
- line 93: `if (sink != null && sink > 0.02) feasibilityNote = 'not a survival limit: swim-bladder gas compressed to ${(ratio * 100).toFixed(0)}% of its`

</details>

<details><summary>scenarios/altitude.mjs: 7 unsourced lines</summary>

- line 43: `{ key: 'altitude_m', label: 'Altitude above sea level', unit: 'm', default: 2000, min: 0, max: 11000, kind: 'assumed', source: 'design input`
- line 57: `const Tw = val(state, 'temperature_C') ?? 25;`
- line 68: `let inRange = h >= 0 && h <= 11000;`
- line 117: `metric('power_required_W', METRICS[11].label, Preq, 'W', 'lower', 'derived', 'W v_min(h)/(L/D)max'),`
- line 118: `metric('aerobic_power_available_W', METRICS[12].label, fk.P_W, 'W', 'higher', 'derived', 'eta E Q Ca(PO2 ${pO2air.toFixed(1)} kPa)'),`
- line 119: `metric('powered_flight_margin', METRICS[13].label, fk.P_W / Preq, '1', 'higher', 'derived', 'aerobic available / required'),`
- line 120: `metric('arterial_O2_content_ratio', METRICS[14].label, fk.Ca_ml_ml / fk0.Ca_ml_ml, '1', 'higher', 'derived', 'Hill curve P50 ${P50.toFixed(2`

</details>

<details><summary>scenarios/wind.mjs: 2 unsourced lines</summary>

- line 27: `{ key: 'headwind_m_s', label: 'Steady headwind (negative = tailwind)', unit: 'm/s', default: 5, min: -20, max: 20, kind: 'assumed', source: `
- line 69: `if (m < 0.02 \|\| m > 0.4) { inRange = false; notes.push('Mass ${m} kg is outside the 0.02-0.4 kg range of the glide polar (extrapolated).'); `

</details>

<details><summary>scenarios/predator.mjs: 4 unsourced lines</summary>

- line 79: `const larva = stage === 'hatching' \|\| stage === 'larva' \|\| (stage === '' && SL < 0.01);`
- line 83: `const Q10 = 1.5, Tref = 26;`
- line 135: `const th = params.theta_thresh_deg * Math.PI / 180, tl = params.visual_latency_s;`
- line 188: `validity: { inRange: inRange && SL > 0.002 && SL < 0.5, notes: notes.join(' ') \|\| 'within the ranges of the sources' },`

</details>

<details><summary>scenarios/sleep.mjs: 2 unsourced lines</summary>

- line 65: `if (T != null && Math.abs(T - 28.5) > 3 && !larva) inRange = false;`
- line 84: `const tc = Math.min(28, Math.max(24, T));`

</details>

<details><summary>scenarios/digestion.mjs: 1 unsourced lines</summary>

- line 22: `const MG_PER_UMOL = 0.032, J_PER_MG = 13.54;`

</details>

<details><summary>scenarios/glide.mjs: 7 unsourced lines</summary>

- line 41: `if (r >= 0.97) return 1;`
- line 42: `if (r <= 0.33) return 0.86;`
- line 43: `return 0.86 + ((1 - 0.86) * (r - 0.33)) / (0.97 - 0.33);`
- line 143: `const T = val(state, 'temperature_C') ?? 25;`
- line 157: `export const LAUNCH_OVERRIDE_PARAM = { key: 'launch_airspeed_override_m_s', label: "What-if launch airspeed (0 = the organism's own sourced `
- line 246: `if (m < 0.02 \|\| m > 0.4) { inRange = false; notes.push('Mass ${m} kg is outside 0.02-0.4 kg (polar specimens 0.04-0.06 kg; field fliers to ~`
- line 247: `if (Re != null && (Re < 3e4 \|\| Re > 1e6)) { inRange = false; notes.push('Chord Reynolds number ~${Re.toExponential(1)} is far from the polar`

</details>

### Spot checks (real GET of the cited paper for the quoted phrase)

| module | claim in the module | fetched via | phrases found | result |
|---|---|---|---|---|
| current | Plaut 2000 Ucrit 15.5 SL/s, compiled in Widrick 2018 | Europe PMC full text (PMC6019105) | {"15.5":true} | **confirmed** |
| current | Umax exceeds Ucrit by ~15 % (Widrick 2018) | Europe PMC full text (PMC6019105) | {"15%":true} | **confirmed** |
| predator | theta_thresh 10.3-15.8 deg (McKee & McHenry 2020) | Europe PMC full text (PMC7750966) | {"10.3°":true,"15.8°":true} | **confirmed** |
| predator | visual latency 740-780 ms (McKee & McHenry 2020) | Europe PMC full text (PMC7750966) | {"740 ms":true,"780 ms":true} | **confirmed** |
| predator | adult startle "modal latency to startle being 8 ms" (Burgess & Granato 2007, a paper titled "Sensorimotor gating in LARVAL zebrafish") | Europe PMC abstract (full text PMC6672105 not served) | {"modal latency":false,"8 ms":false} | **unverifiable (abstract only; full text not served)** |
| predator | pike C-start below 11 BL/s, archerfish 24 BL/s (Schuster 2023) | Europe PMC full text (PMC10465633) | {"11 body lengths":true,"24 BL":true} | **confirmed** |
| sleep | larval sleep 19.6 % day, 83.9 % night (Choudhary 2026) | Europe PMC full text (PMC13144723) | {"19.6":true,"83.9":true} | **confirmed** |
| temperature | Q10 SMR 1.39, MMR 1.15 (Ripley 2022) | Europe PMC full text (PMC9845742) | {"1.39":true,"1.15":true} | **confirmed** |
| pressure | TMAO 40 to 261 mmol/kg, osmolality 350 / 991 / 1,100 mOsm/kg, isosmotic 8,200 m (Yancey 2014) | Europe PMC abstract (full text PMC3970477 not served) | {"261":true,"991":true,"8,200":true} | **confirmed** |
| pressure | swim bladder up to 5 % of body volume; tissue 5 % denser than sea water (Lauridsen 2022) | Europe PMC full text (PMC9389698) | {"5% of total body volume":true,"5% denser":true} | **confirmed** |
| glide | snapper max cardiac output 58.48 ml/min/kg (Durnford 2026) | Europe PMC full text (PMC13245903) | {"58.48":true} | **confirmed** |
| glide | Edgerton & Breder: glide up to 50 m at 15-20 m/s (Makiguchi 2013 Introduction) | not in Europe PMC | {"50 m":false} | **fetch-failed** |

