# Environment scenarios: model cards

Six modules in `sim-engine/scenarios/`: `temperature`, `current`, `pressure`, `altitude`, `wind`, and `glide`
(added at the hub's request; `altitude` and `wind` reuse its functions). Each follows the scenario contract in
`index.mjs` and declares a static `metrics` list whose keys are exactly what `run()` returns, with the unit in the
`unit` field. Metric keys follow the spec validator's alias list in `lib/spec.mjs` (`glide_range_m`, `v_min_m_s`,
`wing_loading_N_m2`, `ucrit_m_s`), so some keys also end in a unit.

Every constant was fetched on 2026-10-31 (Europe PMC REST full text or abstract, Crossref, NCBI, NIST, NASA), or
reused from a sourced repository module (`physics/`, `physiology/`). Nothing comes from memory. No bird data.
Tests: `node sim-engine/test/scenarios-environment.mjs` (185 checks; hand-built fixtures inside the test file for an
adult zebrafish, a zebrafish larva, a winged zebrafish and an adult flying fish (Park & Choi L3)).

## Revision after the validation harness (STUDIO-FINDINGS.md, 2026-11-01)

1. **Launch speed comes from the organism, never a global default** (D1). The sources are:
   - Flying-fish adult: ~10 m/s leap speed, "20 to 30 body length s-1" (Makiguchi 2013 citing Davenport 1994). This was read in the fetched PDF. It is labelled `borrowed` for a 20 cm adult, because 20-30 BL/s implies fish of 33-50 cm.
   - Other flying-fish stages: 30 BL/s × SL, capped at 10 m/s.
   - Zebrafish: Umax = 1.15 × Ucrit (`calibrated`).
   - Blends and other species: no launch speed, so the glide metrics are null and `feasible` is null.

   A what-if override (`launch_airspeed_override_m_s`, default 0 = the organism's own speed) is labelled `assumed`. If the reachable speed is below v_min, every glide distance is 0 and `feasible` is false ("cannot glide"). The zebrafish larva, adult and winged zebrafish now all get 0.
2. **The range is split the way the Lean law requires** (D2). The split applies in glide, wind and altitude. Wind reports no other key containing "glide range".
   - `glide_range_lean_bound_m` = h·(L/D)max is the only part covered by `glide_range_le`.
   - `kinetic_phase_m` lies outside the theorem, and its assumption is stated in its source string.
   - `glide_range_total_m` (glide) or `ground_distance_total_m` (wind) is their sum and is labelled as not covered.
3. **`survives` means only that the organism survives the perturbation** (D6). Whether a behaviour is possible goes in `feasible`, with the reason in `feasibility_note`. `limiting` explains `survives` only.

   | scenario | survives | feasible |
   |---|---|---|
   | temperature | CTmin < T < CTmax | null |
   | pressure | false below the marine ceiling, else null | null |
   | altitude | water pO2 vs Pcrit | can glide at its own speed at that altitude |
   | current | null (being swept is not modelled as lethal) | can hold station |
   | glide, wind | null | can glide (wind: and no stall in a gust lull) |
4. **Read-backs are labelled `calibrated`** (amendment A1). This covers CTmax, CTmin, the thermal margin, the Ucrit(T) curve, the Q10 factors and every zebrafish Ucrit-derived metric. These are not independent predictions. The independent checks are the out-of-sample ones in each model card: Morgan 2018, Andreassen 2022, and the Wakamatsu PET-strain failure.
5. **Constants audit (CONSTANTS-AUDIT.md), applied:**
   - Q10 corrected to SMR 1.56 / MMR 1.34 (the correction is cited, not the original).
   - The adult Ucrit range is now 13.7-17.9 SL/s, with a note that Table 2 is Umax.
   - The dry-air O2 fraction is 0.2095 and the air kinematic viscosity 1.46e-5 m²/s.
   - C_L(0°) is 0.53 (derived), and the Re validity window is corrected to 5e3-1e5.
   - The ground-effect toggle is labelled assumed. Osmolality 350/1100 is measured-secondhand (only 991 is measured).
   - The sea-water density of 1025 kg/m³ and the Re 5e5 transition are stated as modelling choices.
   - The NIST URL now carries its unit parameters, and the Magnus coefficients are credited to Alduchov & Eskridge.
   - `design-choice` is not one of the six kinds that `lib/envelope.mjs` accepts, so those items are labelled `assumed`.
6. **Taxi phase (adult flying fish), after the population-mass positive-control failure.** The adult launch airspeed is
   now the taxi end speed: 15 m/s, the lower end of the 15-20 m/s range, never above 20. It is labelled measured-secondhand
   (family-level, second-hand). The sources, all fetched:
   - The leap at ~10 m/s (Makiguchi 2013 citing Davenport 1994).
   - "taxiing ... can probably accelerate the flying fish to a speed up to 15 - 20 m s-1 (Davenport 1994)" (Deng et al. 2019 bioRxiv, doi:10.1101/765560).
   - Glides "at an air speed of 15 to 20 m s-1" (Makiguchi 2013 citing Edgerton & Breder 1941).
   - Park & Choi: taxiing is used "to gain additional speed".

   Juveniles get no taxi credit. Not modelled: the taxi distance (~9 m, second-hand) is not added to the range, and the
   taxi power (burst; a CFD figure of 350 W to reach 16.5 m/s is a model result) is not checked against the animal's
   muscle. The 50 m glide validation is now inside the predicted range (~33 m from 1 m, ~64 m from 8 m) but is **partly
   circular**, because the 15 m/s comes from the same observations.

   New positive controls at population mass (0.12 kg, matching the H. affinis female length-weight relation at TL ~26 cm) must glide, both
   isometrically scaled (v_min 11.1 m/s) and on the 60 g fins (v_min 13.9 m/s). Both would fail at the old 10 m/s.
7. **Smaller fixes** (D9): g is labelled `measured-secondhand`; the ground-effect breakpoints and the 998.2 kg/m³ freshwater density are sourced in place.

**Harness after the revision** (`node sim-engine/validation/studio-harness.mjs`): N1, N2, N4 and N5 pass. N5 checks the Lean-covered part. X1 and X2 are consistent. W2, W3 and W1 are circular, as expected.
- **W9 fails** with an honest number: at the organism's own 10 m/s leap speed from 1 m, the Lean-covered distance is 4.37 m. That is below the 5-75 m band, because the taxiing that real flying fish use to reach 15-20 m/s is not modelled.
- **W11 now reads `null`**, because current's station-holding moved from `survives` to `feasible`. The harness must read `feasible` for W11 (and for the W1 bisection fallback).

**How each test was made to fail once.** `ENV_TEST_SABOTAGE=1` inverts every assertion, and all 185 fail, so none
is vacuous. The table below records the first round (159 checks); after the revision, the same mutations fail 9, 7, 3,
9 and 14 checks respectively. `ENV_TEST_MUTATE=<x>` changes one fixture input, and the checks that depend on it fail:

| mutation | checks that failed |
|---|---|
| `mass` (x2) | glide v_min, P_req and wing loading regressions (3) |
| `sl` (zebrafish SL x2) | current: Ucrit literature range, Reynolds number (2) |
| `fresh` (flying fish in fresh water) | pressure: 10 m pressure, Boyle half-volume, marine ceiling verdict (3) |
| `air` (air density 1.0) | glide v_min and P_req, altitude rho(5000 m) (3) |
| `species` (`Danio aesculapii`, a congener) | 12 temperature and current checks. **On its first run this mutation found a real bug:** the zebrafish match was `/danio/`, so a congener received zebrafish data. It is now `/danio rerio|zebrafish/`. |

---

## glide (`glide.mjs`)

**Model.** The physics thread's model, unchanged: W = m g; v_min = sqrt(2W/(ρ S C_Lmax)); P_req = W v_min/(L/D)max.
The launch speed is the organism's own (see the revision above). The range has two separately reported parts: the
Lean-covered h·(L/D)max, and the kinetic phase, which is outside the theorem. In the level phase at the launch height, airspeed falls from
v0 to v_min at the constant rate g/(L/D)_eff, with the measured ground-effect drag factor (1 at r ≥ 0.97, falling to
0.86 at r ≤ 0.33, where r = h/half-span). The descent phase from h adds h·(L/D)max. Powered flight is judged only by the
Fick aerobic bound η E Q C_a(PO2): η 0.15, E 19.34 J/ml, snapper Q_max 58.48 ml/min/kg, Hb capacity 0.206 ml/ml
(a calibrated value), trout Hill curve.

**Sources.** Park & Choi 2010 (C_Lmax 0.78, (L/D)max 4.37), doi:10.1242/jeb.046052. Ground effect from
physics/ground-effect.json. The physiology chain: Durnford 2026, Rummer & Brauner 2015, Gerry & Ellerby 2014. Field
speeds from Makiguchi 2013 (doi:10.3354/ab00494, second-hand).

**Validation.**
- It reproduces physics/results.json exactly (v_min 9.854 m/s, P_req 1.327 W, W/S 46.39 N/m²). That is a code check, not a test against nature.
- Edgerton & Breder 1941, quoted second-hand: "glide up to 50 m at 15-20 m/s". **Not reproduced** at the organism's own 10 m/s: the result is 4.37 m from 1 m, or 35 m from the 8 m maximum height, plus a kinetic phase of under 1 m. The first version's "pass" set the launch speed to 15-20 m/s, taken from the same observation, so it was circular and has been withdrawn. The gap is the unmodelled taxiing.
- The leap speed of ~10 m/s (Makiguchi, estimated from tail beat) is just at v_min. This is consistent with the need to taxi; it is not a test.
- The aerobic margin for L3 is 0.024: the bound is 41 times short of the requirement, the same direction as Lean C14.

**What it cannot tell you.** It says nothing about takeoff, control, flapping or burst power. The range is an upper
bound. The polar comes from stuffed specimens at one wind speed (12 m/s; Park & Choi: Re ~10⁴). The validity window is mean-chord Re 5e3-1e5. A zebrafish-sized animal is far outside it and is flagged
inRange = false. The lifting area is pectoral × 1.98965 (one specimen's ratio, assumed) unless the state carries
`lifting_area_m2`. The TFF muscle-fit problem (NOTES-FOR-HUB item 2) does not enter, because no muscle power is used.
Any muscle-based claim about the TFF must still account for it.

## temperature (`temperature.mjs`)

**Model.** CTmax and CTmin are linear in acclimation temperature between the two measured points:
- CTmax = 39.2 + 0.25 (Ta − 20)
- CTmin = 6.2 + 0.44 (Ta − 20)

survives = CTmin < T < CTmax. Swimming capacity is the measured Ucrit(T)/Ucrit(28 °C) curve. Metabolic rate scales
with Q10: SMR 1.56, MMR 1.34. These are the **corrected** values from the published correction (J Exp Biol 226:jeb245488, doi:10.1242/jeb.245488); the original paper gave 1.39 and 1.15.

**Sources.**
- Cortemeglia & Beitinger 2005, wild type acclimated at 20 and 30 °C (abstract), doi:10.1577/T04-197.1.
- Wakamatsu et al. 2019, Ucrit at 12-38 °C, doi:10.1038/s41598-019-52592-w.
- Ripley et al. 2022 as corrected in 2023: Q10, doi:10.1242/jeb.245488 (correction to doi:10.1242/jeb.243774).

**Validation.**
- Adults acclimated at 28 °C. Predicted CTmax 41.2 °C. Measured 40.97 ± 0.10 °C (Morgan et al. 2018, doi:10.1038/s41598-018-25593-4) and 41.0 ± 0.1 °C (Andreassen et al. 2022, doi:10.1073/pnas.2207052119). **Pass** (+0.2 °C).
- Larvae at 5 dpf: measured 41.4 ± 0.1 °C. **Pass** (−0.2 °C), although the endpoint differs (loss of response).
- **Fail, recorded on purpose.** An alternative model, Ucrit ∝ (red-muscle power)^1/3 with Q10 1.88, predicts Ucrit(16)/Ucrit(28) = 0.78 and Ucrit(12)/Ucrit(28) = 0.71. Wakamatsu measured 0.92 and 0.49. It fails in both directions, which is why the module uses the measured curve.

**What it cannot tell you.** CT limits are acute ramp endpoints. They are not chronic or lethal limits. There are
**no data for flying fish**: every metric is null, with a reason. Edits to fins or wings do not change the result.
Larvae borrow the adult acclimation slope, and larval CTmin is unmeasured.

## current (`current.mjs`)

**Model.** Zebrafish Ucrit = k(age) × SL × r(T). The coefficient k is:
- 15.5 SL/s for fish of 28 dpf and older (Plaut 2000, via the Widrick 2018 compilation; the other adult entries give 13.7-17.9 SL/s; Fiaz's 10.3 is the 14 dpf column. Widrick's Table 2 is titled Umax. Plaut's 15.5 is used as Ucrit because Plaut used a 65-min incremental (Ucrit-type) protocol; that is this module's reading, not the table's label);
- 10.5 SL/s at 14 dpf (Widrick's measured Umax of 12.1 SL/s, divided by 1.15);
- interpolated between those two ages;
- below 14 dpf, the absolute speed is interpolated from ~3 cm/s at 5 dpf.

r(T) is the Wakamatsu temperature curve. Umax = 1.15 Ucrit. Ucrit is `calibrated` (a read-back of Plaut 2000). feasible = current ≤ Ucrit; survives = null. For any species, the
module also gives a physical **upper bound** on sustained speed: rigid flat-plate drag on the wetted area
(C_D = 1.33 Re^−0.5 laminar, 0.072 Re^−0.2 turbulent, as in Li et al. 2021, who show undulating fish have much higher
drag) set equal to the whole red-muscle power. Red-muscle power is 134 W/kg at 20 °C with Q10 1.88 (scup, rome1992).
The myotomal fraction is 0.5 (assumed). Water viscosity and density come from the NIST WebBook (pure water).

**Validation.**
- Adult wild type, SL 30 mm, 28 °C: predicted 46.5 cm/s; literature range 40-55 cm/s (Widrick, second-hand). **Pass, partly circular**: Plaut is one of the cited studies.
- Long-finned pet-store strain (Wakamatsu 2019): measured 22-24 cm/s, against a predicted ~46 cm/s for a 30 mm wild type. **Fail by about 2×.** Fin length and genetic background lower Ucrit, and the paper did not give SL in the text. Designs with long fins will be over-predicted.
- Consistency: in the fixture, the measured Ucrit (0.465 m/s) is below the physical bound (1.26 m/s).

**What it cannot tell you.** There is **no measured Ucrit for flying fish**, so it is null; only drag and the bound are
given. Zebrafish Ucrit is not extrapolated beyond L∞ (45.1 mm SL). Blended designs that are larger than this get null
rather than an SL-scaled zebrafish speed: on its first run on the real `ff-zf-chimera`, the module gave 1.8 m/s, and
it was capped for that reason. Turbulence, schooling, hypoxia and endurance beyond a Ucrit protocol are not modelled.

## pressure (`pressure.mjs`)

**Model.**
- Hydrostatic pressure: P = P0 + ρ g z.
- Boyle's law for swim-bladder gas: V/V0 = P0/P, isothermal, with no secretion.
- The bladder is sized for neutral buoyancy at the surface, with tissue 5% denser than sea water (Lauridsen 2022, second-hand). That gives the body density at depth and the sinking force as a fraction of body weight.
- Marine-teleost trends from Yancey et al. 2014 (doi:10.1073/pnas.1322003111), with osmolality pinned by the snailfish point at 7,000 m: TMAO = 40 + 0.0456 z mmol/kg; osmolality = 350 + 0.0916 z mOsm/kg.
- The ceiling is where osmolality reaches sea water (1,100 mOsm/kg): **8,190 m**. Yancey states ~8,200 m.

**Validation.**
- TMAO at 7,000 m, extrapolated from a line through the 0 and 4,850 m points: predicted 359, measured 386 ± 18 mmol/kg. **Pass** within 1.5 SD.
- Deepest recorded fish: 8,336 m (Pseudoliparis, Jamieson et al. 2026, doi:10.3897/BDJ.14.e182172, quoting Jamieson 2023b). **Fail as a hard limit** by 146 m (1.8%), but consistent as an approximate ceiling.

**What it cannot tell you.** It gives no depth tolerance for zebrafish or flying fish (none found), and survives is
never true. The ceiling is for marine fish, so a freshwater zebrafish gets null. Re-inflation over time is not
modelled. The state's body density is null in the core, so the module uses the neutral-buoyancy assumption.

## altitude (`altitude.mjs`)

**Model.** The atmosphere is the NASA Glenn troposphere fit (https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html),
the same fit used by physics/flier/tff/design.py and lean/Delphi/Altitude.lean. The module scales it to the state's
sea-level density, so altitude 0 reproduces glide exactly.
- PO2 of dry air = 0.209 p.
- PO2 of surface water = 0.209 (p − pH2O(T)).
- v_min(h) = v_min(0) sqrt(ρ0/ρ).
- Fick bound at PO2(h).
- For a fish living in water, survives compares water PO2 with Pcrit. Pcrit is the cross-species database mean of 5.15 ± 2.21 kPa (Rogers et al. 2016, doi:10.1093/conphys/cow012) and is borrowed. survives is null within one SD of it.

**Validation.** Barometric pressure measured on Everest (West et al. 1983, doi:10.1152/jappl.1983.54.5.1188):

| altitude (m) | predicted (kPa) | measured (kPa) | error |
|---|---|---|---|
| 5,400 | 51.29 | 53.38 | −3.9% |
| 6,300 | 45.36 | 46.80 | −3.1% |
| 8,050 | 35.43 | 37.81 | −6.3% |
| 8,848 | 31.53 | 33.73 | −6.5% |

**Pass** within 10%, but **systematically low**. The paper attributes this to latitude. There is no organism-level
validation: no fish flies at altitude.

**What it cannot tell you.** Acclimatisation is not modelled, and neither is cold water in high lakes (air
temperature is reported, not applied). The glide range from a given height does not change with altitude; only the
kinetic phase shrinks.

## wind (`wind.mjs`)

**Model.** Uniform wind u (headwind positive). Ground distance = air distance − u × time in each glide phase.
Takeoff water speed = v_min − u. A horizontal gust of amplitude g gives a stall margin V − g − v_min (V = the lower of
the launch airspeed and the best-L/D airspeed) and a quasi-steady load factor (1 + g/V)².

**Validation.** **None possible.** No fetched source gives a glide distance together with the wind. Hertel 1966's 48 m
trajectory at 20 m/s into a 10 m/s headwind (quoted by Deng 2019) is a theoretical model, and it needs a wing area
the sources do not give, so it was not compared.

**What it cannot tell you.** Wind shear over waves, updrafts and unsteady gust aerodynamics are not modelled. The
descent airspeed uses C_L(0°) = 0.53, derived from Park & Choi's statement that lift at 0° about equals the weight for L3
(range 0.49-0.57; Fig. 5 itself not read). It replaces the 0.4 assumed in the simulator's params.json. The gust stall margin is computed at the slower of the launch speed and that best-L/D speed, so slow, low-v_min
designs such as the TFF (v_LD 6.1 m/s, v_min 5.0 m/s) fail even the default 2 m/s gust.

---

## Weaker than it looks

- **The core's ambient keys.** `lib/state.mjs` uses `water_density_kg_m3`, `air_density_kg_m3`, `pressure_kPa` and `pO2_kPa`, not the brief's `pressure_Pa`. The modules read both spellings.
- **Fields in `needs`.** `lifting_area_m2`, `cardiac_output_max_ml_s`, `myotomal_muscle_fraction`, `swimbladder_volume_fraction` and `pcrit_kPa`. Each has a labelled fallback.
- **Cardiac output.** The Fick Q is the snapper value (58.48 ml/min/kg). Lean C14 uses 65.6 ml/min/kg, so this module's aerobic bound is 11% lower than Lean's. Both say "more than 30× short".
- **Borrowed or second-hand inputs.** The Ucrit 15.5 SL/s, the Umax/Ucrit 1.15, the 5 dpf larval speed, tissue density, the depth record and every flying-fish field speed are second-hand. The polar is borrowed for every animal except C. hiraii.
- **Calibrated input.** The Hb capacity of 0.206 ml/ml is calibrated, so the aerobic power is not an independent prediction.
