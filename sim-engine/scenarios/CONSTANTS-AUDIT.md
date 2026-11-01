# Constants audit of the studio scenario modules

Generated 2026-11-01T03:05:07.553Z by re-parsing the module versions on disk at that time (owners were landing fixes; line numbers drift, match on file + name + value). Machine-readable sidecar: `CONSTANTS-AUDIT.json` (one record per constant). Sidecar only: no scenario module was edited.

## Corrections (wrong values): 6

Substantive = off by more than 5 %; rounding = the module value is a rounded version of the source value (fix, low priority).

| severity | file:line | constant | in module | source says | source, locator | quote |
|---|---|---|---|---|---|---|
| substantive | scenarios/current.mjs:9 | UCRIT_ADULT_RANGE | 10.3 | **13.7** | Widrick JJ et al. (2018). An open source microcontroller based flume for evaluating swimming performance of larval, juvenile, and adult zebrafish. PLoS One 13:e0199712 https://doi.org/10.1371/journal.pone.0199712, Table 2 | Table 2 cells: "Plaut [10] \| 28 \| 65 \| _ \| 15.5 \| _"; "Fiaz et al. [12] \| 28 \| 99 \| 10.3 \| _ \| _"; "Seebacher and Walter [16] \| 25 \| 17 \| _ \| 13.7 \| _"; header "temperature \| duration \| 14 dpf \| adult \| old" |
| substantive | scenarios/temperature.mjs:26 | Q10.SMR | 1.39 | **1.56** | Correction to Ripley et al. 2022: J Exp Biol (2023) 226(2):jeb245488 https://doi.org/10.1242/jeb.245488, Correction notice text | Correction notice: "Original Q 10 values: AS Q 10 =0.98, SMR Q 10 =1.39, MMR Q 10 =1.15; corrected Q 10 values: AS Q 10 =1.17, SMR Q 10 =1.56, MMR Q 10 =1.34." |
| substantive | scenarios/temperature.mjs:26 | Q10.MMR | 1.15 | **1.34** | Correction to Ripley et al. 2022: J Exp Biol (2023) 226(2):jeb245488 https://doi.org/10.1242/jeb.245488, Correction notice text | Correction notice: "Original Q 10 values: AS Q 10 =0.98, SMR Q 10 =1.39, MMR Q 10 =1.15; corrected Q 10 values: AS Q 10 =1.17, SMR Q 10 =1.56, MMR Q 10 =1.34." |
| rounding | scenarios/altitude.mjs:16 | O2_FRACTION | 0.209 | **0.2095** | Wikipedia, Atmosphere of Earth (dry-air composition; O2 row 20.946%) https://en.wikipedia.org/wiki/Atmosphere_of_Earth, lead paragraph and composition table | By mole fraction (i.e., by quantity of molecules), dry air contains 78.08% nitrogen, 20.95% oxygen, 0.93% argon, 0.04% carbon dioxide |
| rounding | scenarios/glide.mjs:112 | f.value | 0.209 | **0.2095** | Wikipedia, Atmosphere of Earth (dry-air composition; O2 row 20.946%) https://en.wikipedia.org/wiki/Atmosphere_of_Earth, lead paragraph and composition table | By mole fraction (i.e., by quantity of molecules), dry air contains 78.08% nitrogen, 20.95% oxygen, 0.93% argon, 0.04% carbon dioxide |
| rounding | scenarios/glide.mjs:245 | Re | 0.000015 | **0.0000146** | International Standard Atmosphere sea-level kinematic viscosity (Wikipedia, International Standard Atmosphere) https://en.wikipedia.org/wiki/International_Standard_Atmosphere, sea-level properties table, kinematic viscosity row | \|1.4607 × 10−5 m2 s−1 |

## Other source problems (value right, citation or label wrong)

These do not change a number but would mislead a reader who follows the citation.

- **current.mjs** `UCRIT_ADULT_SL_S` 15.5: the value is right, but Widrick 2018 Table 2 is titled "maximal swimming speed (Umax)", so calling Plaut's 15.5 a Ucrit is a label mismatch worth a sentence.
- **current.mjs** `cdPlate` / `bound` Re 5e5 laminar-turbulent switch: not in Li 2021 (full text searched). It is the textbook flat-plate transition value; cite a fluid-mechanics text or label it design-choice. (2 records `unsourceable`.)
- **current.mjs** `NIST_URL` returns HTTP 400 as written. With the unit parameters added, all 7 rows (viscosity and density) match the NIST WebBook exactly.
- **current.mjs** 28 / 14 dpf thresholds come from Widrick 2018, not growth.json. **temperature.mjs** 20/30 in `ctKind` are Cortemeglia & Beitinger, not Wakamatsu; the 5 dpf youngest CTmax is Andreassen 2022, not stages.json.
- **pressure.mjs** `SEAWATER` 1025 kg/m3: params.json gives no source and the Lauridsen DOI next to it does not contain it. It is a nominal surface value (1020-1029); cite TEOS-10 or label it design-choice.
- **glide.mjs** validity note says the polar is at Re "~1e5"; Park & Choi give Re 1.9-2.2 x 10^4. Specimen L3 at v_min computes to ~3.2e4, right at the module's 3e4 cutoff.
- **glide.mjs** `CL_at_zero_deg` 0.4 stays `unverified` (Fig. 5 not in any text copy). Park & Choi's text says lift at 0 deg is about the body weight for L3, which implies C_L(0) ~ 0.53 (0.49-0.57).
- **glide.mjs** Hill n 1.34 is in Rummer 2015's Results text; Table 1 shows 1.3 +/- 0.1 (locator fix).
- **glide.mjs / altitude.mjs** Magnus coefficients 0.61094 / 17.625 / 243.04 are Alduchov & Eskridge 1996 (primary PDF 403; confirmed through two Europe PMC full texts that quote it), not Rogers 2016.
- **lib/state.mjs** ISA constants 2.25577e-5, 101.325, 5.25588, 11000 m are not in conditions/baseline.json (which the comment points to); they are the ISA troposphere constants (2.25577e-5 = 0.0065/288.15). 4.2559 = 5.25588 - 1 (density exponent). 1.6075 is Thomsen's ellipsoid-area exponent and is used for exactly that.
- **lib/state.mjs** swim-bladder 0.037-0.065 is Robertson's mean +/- 1 SD, not a min-max range.
- **predator.mjs** module text says escape data were taken at 20-31 degC; the sources show 23-27 degC (Burgess & Granato) and fish held at 27 degC (McKee & McHenry); Danos & Lauder give no temperature. The 4 mm larval length (0.004 m) has no source (`unsourceable`; Parichy 2009 PMC3030279 is a likely one, full text not served).
- **predator.mjs** Burgess & Granato 2007 adult "modal latency to startle being 8 ms (Fig. 5F, inset)" is now **confirmed** (plain GET of https://pmc.ncbi.nlm.nih.gov/articles/PMC6672105/ serves the full text). This closes the harness's D8. The pike 11 BL/s bound (D3) is gone: line ~109 now uses Danos & Lauder 2012 (Re 27,800 at TL 33.0 mm, about 0.84 m/s, 25.5 TL/s), confirmed from the Wayback copy.
- **sleep.mjs** 0.051 comes from Yokogawa 2007, not Sorribes.
- **digestion.mjs** applies Q10 2.5 up to day 100; Barrionuevo reports 2-3 only for days 10-60 and 4-5 at day 100. The 0.228 faecal loss is Sumule 2003 (not Licitra), the SDA coefficient 0.1014 is McLeod & Clark 2016, 224.92 is Durnford 2026, and 0.0775 is Bernreuther 2009. The DOI next to the 5 dpf (Van Noord 2013) supports the copepod-diet note, not the 5; re-sourced to Zada 2022.
- **grip.mjs** 101.325 is standard sea-level pressure, not Ditsche & Summers.


## Kind labels to fix: 46

Design choices must never carry kind `measured`; empirical values must not overstate provenance.

- scenarios/current.mjs:53 `u14` = 5: kind 'calibrated' on a linear interpolation between a second-hand 5 dpf figure and a Umax-derived 14 dpf value: the shape is assumed; 'calibrated' fits only if A1 read-back logic is intended here
- scenarios/daynight.mjs:38 `param light_hours.min` = 1: design-choice slider bound under a param whose kind is "measured"
- scenarios/daynight.mjs:38 `param light_hours.max` = 23: design-choice slider bound under a param whose kind is "measured"
- scenarios/digestion.mjs:54 `ref` = 23: parser kind "borrowed" on a validity bound; it is a design choice
- scenarios/digestion.mjs:64 `param ration_pct_bw_day.min` = 0: design-choice slider bound under a param whose kind is "measured-secondhand"
- scenarios/digestion.mjs:64 `param ration_pct_bw_day.max` = 400: design-choice slider bound under a param whose kind is "measured-secondhand"
- scenarios/digestion.mjs:65 `param diet_energy_kJ_g.min` = 1: design-choice slider bound under a param whose kind is "measured-secondhand"
- scenarios/digestion.mjs:65 `param diet_energy_kJ_g.max` = 30: design-choice slider bound under a param whose kind is "measured-secondhand"
- scenarios/digestion.mjs:66 `param faecal_loss_fraction.min` = 0: design-choice slider bound under a param whose kind is "borrowed"
- scenarios/digestion.mjs:66 `param faecal_loss_fraction.max` = 0.9: design-choice slider bound under a param whose kind is "borrowed"
- scenarios/digestion.mjs:67 `param sda_coefficient.min` = 0: design-choice slider bound under a param whose kind is "borrowed"
- scenarios/digestion.mjs:67 `param sda_coefficient.max` = 0.5: design-choice slider bound under a param whose kind is "borrowed"
- scenarios/glide.mjs:27 `FICK` = 0.7: unit conversion carried under kind measured-secondhand (shared with 13.54); should be standard/derived
- scenarios/glide.mjs:30 `FICK` = 7.50062: unit conversion carried under kind borrowed (shared with 24.8); should be standard
- scenarios/glide.mjs:200 `param ground_effect.default` = 1: design-choice labelled measured; should be assumed (only the drag curve it switches on is measured)
- scenarios/glide.mjs:200 `param ground_effect.min` = 0: design-choice labelled measured; should be assumed (only the drag curve it switches on is measured)
- scenarios/glide.mjs:200 `param ground_effect.max` = 1: design-choice labelled measured; should be assumed (only the drag curve it switches on is measured)
- scenarios/grip.mjs:41 `param adhesive_stress_kPa.min` = 0.1: design-choice slider bound under a param whose kind is "borrowed"
- scenarios/grip.mjs:41 `param adhesive_stress_kPa.max` = 101.3: param kind "borrowed"; bound is physics (1 atm), not borrowed data
- scenarios/grip.mjs:42 `param surface_Ra_um.default` = 15: param kind "measured": default is a tested condition, but it is a validity input, not a measurement of the design
- scenarios/grip.mjs:42 `param surface_Ra_um.min` = 0: design-choice slider bound under a param whose kind is "measured"
- scenarios/grip.mjs:42 `param surface_Ra_um.max` = 2000: design-choice slider bound under a param whose kind is "measured"
- scenarios/predator.mjs:55 `param predator_speed_ratio.default` = 1.5: kind "measured-secondhand" overstates: K=1.5 is a modelled scenario -> "assumed"
- scenarios/predator.mjs:58 `param theta_thresh_deg.default` = 14: 14 deg is McKee’s modelling value within the measured range; "measured" is generous ("calibrated"/"measured-secondhand")
- scenarios/predator.mjs:58 `param theta_thresh_deg.min` = 1: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/predator.mjs:58 `param theta_thresh_deg.max` = 90: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/predator.mjs:59 `param visual_latency_s.min` = 0: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/predator.mjs:59 `param visual_latency_s.max` = 3: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/predator.mjs:60 `param lateral_line_intact.default` = 1: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/predator.mjs:60 `param lateral_line_intact.min` = 0: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/predator.mjs:60 `param lateral_line_intact.max` = 1: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/predator.mjs:102 `BLs` = 0.004: larval BL/s labelled "measured-secondhand" but it is 200 mm/s divided by an assumed 4 mm length -> "derived"
- scenarios/pressure.mjs:8 `Y.osm0` = 350: provenance kind 'measured' for osmolality 350 ("typically ... shallow species") and 1100 (sea water) overstates provenance: summary/second-hand values -> 'measured-secondhand' (only 991 is this paper's measurement)
- scenarios/pressure.mjs:8 `Y.osmSea` = 1100: provenance kind 'measured' for osmolality 350 ("typically ... shallow species") and 1100 (sea water) overstates provenance: summary/second-hand values -> 'measured-secondhand' (only 991 is this paper's measurement)
- scenarios/sleep.mjs:45 `param light_hours.default` = 14: protocol condition, not a measurement; "measured" only loosely apt
- scenarios/sleep.mjs:45 `param light_hours.min` = 0: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:45 `param light_hours.max` = 24: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:46 `param hcrt_overexpression.default` = 0: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:46 `param hcrt_overexpression.min` = 0: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:46 `param hcrt_overexpression.max` = 1: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:47 `param hcrtr_loss.default` = 0: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:47 `param hcrtr_loss.min` = 0: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:47 `param hcrtr_loss.max` = 1: kind "measured" on a slider bound/switch: design choice, not a measurement
- scenarios/sleep.mjs:97 `rd` = 6: sleep_criterion_s metric kind "measured": a criterion is a definition (calibrated read-back)

## Counts

**Before (harness, per line):** 159 constant-bearing lines in the scenario modules: 25 with a URL/DOI, 89 author-year or repo file only, 45 nothing.

**This parse (per constant, 388 records incl. lib/state.mjs and every param default/min/max):** status as found: url 113, repo-file 36, none 122, author-year 117.

**After this pass (verdicts):** confirmed 258, corrected 6, design-choice 120, unsourceable 3, unverified 1.

Records that now have a fetchable primary URL/DOI proposed: 276 of 388. Design choices are labelled with a one-line rationale instead of a source, which is legitimate as long as they are shown as assumed.

| file | records | confirmed | corrected | design-choice | unverified | unsourceable | unreviewed |
|---|---|---|---|---|---|---|---|
| scenarios/altitude.mjs | 19 | 13 | 1 | 5 | 0 | 0 | 0 |
| scenarios/current.mjs | 54 | 39 | 1 | 12 | 0 | 2 | 0 |
| scenarios/daynight.mjs | 23 | 21 | 0 | 2 | 0 | 0 | 0 |
| scenarios/digestion.mjs | 42 | 31 | 0 | 11 | 0 | 0 | 0 |
| scenarios/glide.mjs | 48 | 31 | 2 | 14 | 1 | 0 | 0 |
| scenarios/grip.mjs | 14 | 9 | 0 | 5 | 0 | 0 | 0 |
| scenarios/predator.mjs | 46 | 19 | 0 | 26 | 0 | 1 | 0 |
| scenarios/pressure.mjs | 19 | 10 | 0 | 9 | 0 | 0 | 0 |
| scenarios/sleep.mjs | 39 | 30 | 0 | 9 | 0 | 0 | 0 |
| scenarios/temperature.mjs | 46 | 32 | 2 | 12 | 0 | 0 | 0 |
| scenarios/wind.mjs | 9 | 0 | 0 | 9 | 0 | 0 | 0 |
| scenarios/_example.mjs | 3 | 0 | 0 | 3 | 0 | 0 | 0 |
| lib/state.mjs | 26 | 23 | 0 | 3 | 0 | 0 | 0 |

## Unverified (real citation, full text not fetchable): 1

- scenarios/glide.mjs:17 `PARK_CHOI.CL_at_zero_deg` = 0.4: Assumed in params.json; Fig. 5 not readable from text. Text implies lift(0 deg) ~ weight for L3 => C_L(0) ~ 0.06*9.81/(0.5*1.225*12^2*0.012688) = 0.53 (0.49-0.57 given mass rounded to 0.01 kg), above the 0.4 assumed; read Fig. 5 to settle

## Unsourceable (empirical, no source found): 3

- scenarios/current.mjs:20 `cdPlate` = 500000: Laminar/turbulent switch at Re 5e5 is not in the cited Li 2021; textbook convention needing its own citation, or label it a modelling choice.
- scenarios/current.mjs:123 `bound` = 500000: Laminar/turbulent switch at Re 5e5 is not in the cited Li 2021; textbook convention needing its own citation, or label it a modelling choice.
- scenarios/predator.mjs:102 `BLs` = 0.004: 4 mm representative larval length has no source in the module; candidate Parichy 2009 full text not served by Europe PMC

## How to apply

1. Corrections first (table above): change the value and attach the quoted source.
2. For each `confirmed` record whose module carries only an author-year or repo file, add `proposed.doi_or_url` and the locator next to the constant.
3. For each `design-choice` record, label the parameter kind `assumed` (never `measured`) and paste the rationale into its `source`.
4. Re-run `node <scratch>/tool/merge.mjs` (parser + merge) to refresh this file against the edited modules.
