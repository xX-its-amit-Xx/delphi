# ONTOGENY: how the simulation state changes with age

`ontogeny.json` gives, for zebrafish (*Danio rerio*) and flying fish (Exocoetidae), one row per developmental
stage. Each row holds the state fields that `lib/state.mjs` needs, as `{value, unit, kind, source{id, cite,
doi_or_url, locator}, note}`. A missing value is `null`, with a `reason` that says what was searched. Validator:
`node test/ontogeny.mjs` (237 checks). It was run once against a deliberately broken fixture under `C:\Temp` and
failed six checks there: wrong unit, a value with no source, falling SL, a broken mass-SL slope, a null with no
reason, and a bird term.

- **Stages** are the keys of `anatomy-model/parametric/stages.json` (`age_days` = days after hatching). SL, mass
  and fin ratios are read from that file, so the two cannot disagree. Zebrafish: 0, 3, 10, 25, 60, 180 d
  (dpf = d + 2). Flying fish: 0, 3, 10, 30, 90, 365 d.
- **Nothing that is already sourced elsewhere is repeated here.** Growth laws stay in `development/growth.json`,
  `development/zebrafish/growth.json` and the allometry files, and this file points to them. What is new here:
  density, swim bladder, O2-uptake site, Hb dependence, metabolic rate, Ucrit, frontal and caudal area, adult
  muscle, gill and Hb proxies, size and age thresholds, anchors, and conflicts.
- **Kinds:** M measured · M2 measured-secondhand · B borrowed (another species, stage or condition, named in the
  note) · D derived (rule in the note) · A assumed · C calibrated (none used).
- **Temperature.** Every zebrafish physiology source was run at 28–28.5 °C. The project baseline is 25 °C, and
  nothing here is corrected for temperature.
- **No bird data.** The validator checks for this.

## Coverage (field × stage; **null** = gap)

### Zebrafish

| field | 0 d (2 dpf) | 3 d (5 dpf) | 10 d (12 dpf) | 25 d (27 dpf) | 60 d (62 dpf) | 180 d (182 dpf) |
|---|---|---|---|---|---|---|
| SL_m | M2 | D | D | D | D | D |
| mass_kg | D | D | D | D | D | D |
| body_density_kg_m3 | B | M | M | B | B | M |
| wetted_area_m2 | **null** | **null** | **null** | **null** | **null** | **null** |
| frontal_area_m2 | **null** | **null** | **null** | **null** | **null** | D |
| pectoral_area_both_m2 | A | A | A | A | A | A |
| pectoral_span_m | A | A | A | A | A | A |
| caudal_area_m2 | **null** | **null** | **null** | **null** | **null** | D |
| red_muscle_fraction | **null** | **null** | **null** | **null** | **null** | B |
| white_muscle_fraction | **null** | **null** | **null** | **null** | **null** | **null** |
| gill_area_m2 | **null** | **null** | **null** | **null** | **null** | **null** |
| o2_uptake_site | B | M | D | M | B | B |
| hb_needed_for_routine_O2 | M | M | M | M | **null** | **null** |
| hb_P50_kPa | **null** | **null** | **null** | **null** | **null** | **null** |
| has_swimbladder | M | M | M | M | M | M |
| routine_metabolic_rate | M | D | D | D | **null** | M |
| standard_metabolic_rate | **null** | **null** | **null** | **null** | **null** | M |
| Ucrit_m_s | **null** | **null** | **null** | **null** | **null** | M |

108 cells: 52 null, 19 M, 1 M2, 17 D, 7 B, 12 A.

### Flying fish

| field | 0 d | 3 d | 10 d | 30 d | 90 d | 365 d |
|---|---|---|---|---|---|---|
| SL_m | A | A | A | D | D | D |
| mass_kg | A | A | A | D | D | D |
| body_density_kg_m3 | **null** | **null** | **null** | **null** | **null** | **null** |
| wetted_area_m2 | **null** | **null** | **null** | **null** | **null** | **null** |
| frontal_area_m2 | **null** | **null** | **null** | **null** | **null** | **null** |
| pectoral_area_both_m2 | A | A | A | D | D | M |
| pectoral_span_m | A | A | A | D | D | M |
| pelvic_len_over_SL | D | D | D | M | M | M |
| caudal_area_m2 | **null** | **null** | **null** | **null** | **null** | **null** |
| red_muscle_fraction | **null** | **null** | **null** | **null** | **null** | B |
| white_muscle_fraction | **null** | **null** | **null** | **null** | **null** | **null** |
| gill_area_m2 | **null** | **null** | **null** | **null** | **null** | B |
| hb_P50_kPa | **null** | **null** | **null** | **null** | **null** | B |
| has_swimbladder | **null** | **null** | **null** | **null** | **null** | **null** |
| routine_metabolic_rate | **null** | **null** | **null** | **null** | **null** | **null** |
| standard_metabolic_rate | **null** | **null** | **null** | **null** | **null** | **null** |
| Ucrit_m_s | **null** | **null** | **null** | **null** | **null** | **null** |
| body_planform_area_m2 | | | | | | M |

103 cells: 69 null, 6 M, 13 D, 3 B, 12 A. No physiological measurement on any flying-fish life stage was found,
in Europe PMC (all 71 records with a flying-fish name in the title, plus targeted queries) or in the Bigman 2021
dataset. The adult values marked B are the trout and mackerel proxies already used in `physiology/`.

## What was sourced this session (zebrafish)

| quantity | value | source (fetched) |
|---|---|---|
| density, post-inflation larvae | 0.996–1.000 g/cm³, within 1.7% of neutral | Lindsey et al. 2010, abstract |
| density, adult | 1.01 ± 0.09 g/cm³ whole; 1.05 ± 0.04 without swim bladder; bladder is 5.1% of volume | Robertson et al. 2008, abstract |
| swim bladder inflation | about 5 dpf (28 °C); pSB at 3.5 mm SL, aSB at 6.0 mm SL | Rombough & Drader 2009; Parichy 2009 via repo |
| O2 uptake site | skin is enough at 3 and 7 dpf; gills are required by 14 dpf; fully gill-dependent at 21 dpf | Rombough 2002, full text |
| Hb needed in normoxia? | no, at 36–96 hpf and at 5–42 dpf (it only lowers residual PO2: 6.7 vs 11.2 torr) | Pelster & Burggren 1996, abstract; Rombough & Drader 2009 |
| routine MO2, larvae | rMO2 = 46.1 M^0.825 nmol/h (M in mg, Bouin-fixed), 5–42 dpf, R² 0.909, N 109 | Rombough & Drader 2009, Eq. 1 |
| MO2, embryo / early larva | 85–90 µmol g⁻¹ h⁻¹ | Pelster & Burggren 1996, abstract |
| SMR ≈ RMR, adult | 0.60–1.54 ml O2 g⁻¹ h⁻¹ (= 26.8–68.7 µmol g⁻¹ h⁻¹), 28 °C | Plaut & Gordon 1994, full text |
| Ucrit, adult | 56.0 ± 4.8 cm/s wild-type, independent of SL within adults; 43.7 cm/s long-fin | Plaut 2000, full text |
| Ucrit, adult (other protocol) | 23.8 ± 0.7 cm/s long-fin, 28 °C | Wakamatsu et al. 2019, full text |
| adult frontal and caudal area | derived from Table 1 height × width, and CFH² / aspect ratio | Plaut 2000 |
| larval mass checks | live wet mass at stated lengths (Table 1) | Bagatto et al. 2001, full text |

Each JEB PDF was fetched from a Wayback snapshot, because journals.biologists.com sits behind a Cloudflare
challenge. The snapshot URLs are in `sources[*].access`. Author, volume and page for every cited DOI were checked
against Europe PMC metadata.

## Weakest fields

1. **Every flying-fish physiological field** (density, swim bladder, metabolic rate, Ucrit, gills, Hb, muscle) is
   null below the adult, and the adult values are borrowed from trout and mackerel. Flying-fish SL, mass and fin
   size for the first 10 days are assumed: there is no hatch length, and no fin data below 1.68 cm SL.
2. **Zebrafish gill area, wetted area, Hb P50 and muscle fractions** were not found for any stage. Rombough &
   Drader 2009 state that larval zebrafish Hb O2 affinity "has not been determined".
3. **Zebrafish pectoral fin.** The anatomy model assumes the proportions. No numeric pectoral area or length was
   found.
4. **The juvenile gap (≈42 dpf to adult).** No metabolic rate, Ucrit, frontal area or density was measured
   between 3.5 mg and 0.27 g. The 60 d row is mostly null or borrowed.
5. **Larval Ucrit** exists only as a figure (Fiaz 2012, Fig. 6B), and its authors say it is an overestimate.

## Conflicts between sources

- **Larval mass.** Live masses (Bagatto 2001) are 25–50% below the Beaudouin 2015 law that the repo uses at the
  same length. Bouin-fixed masses (Rombough & Drader 2009) are about 4–5× below it at ~12 mm. So larval
  `mass_kg` is an upper bound, and the Rombough metabolic law, which is fitted on fixed mass, also gives upper
  bounds when evaluated at live mass.
- **Growth rate depends on rearing.** At ~26 dpf the fish were 6.4 mm in Bagatto 2001 but 11.0 mm on the repo
  curve. Parichy's group-reared rates would reach 11 mm at 16–19 dpf.
- **Adult mass.** Fish of 34–36 mm SL weighed 0.84–0.90 g (Plaut & Gordon 1994; Plaut 2000). The extrapolated
  Beaudouin law gives 0.54 g at 36 mm.
- **Adult Ucrit.** 0.56 m/s (Plaut 2000, 5-min steps) against 0.24 m/s (Wakamatsu 2019, 1-min steps), both at
  28 °C. The difference is the protocol, about 2×.
- **Metabolic scaling.** The larval law extrapolated to 0.84 g gives ~14 µmol g⁻¹ h⁻¹. That is below Plaut &
  Gordon's adult 26.8–68.7, but near Lucas & Priede 1992 (17.4 at 24 °C, as quoted by Plaut & Gordon).
- **Flying-fish species mix.** The rows combine growth from *H. affinis*, fin lengths from Daane 2021 (three
  species), exponents from *E. obtusirostris* and the *C. hiraii* adult. Mass at a given SL differs about 2×
  between these sources. Davenport's exponents are internally inconsistent: 2.981 − 1.834 ≠ 1.236.

## Interpolation rule (for `resolveState(organismDoc, ageDays)`)

Interpolate **by size, not by age**. Age only selects the size.

1. **Age → SL.** Take SL from the species growth curve, `development/zebrafish/trajectory.mjs` or
   `development/trajectory.mjs`, the same curves that produced the stage rows. If the organism document gives a
   measured SL or mass, use that instead. Do not interpolate SL log-linearly in age between rows: growth is
   linear in the larva and von Bertalanffy afterwards, and rearing changes the rate by up to 1.7× (see conflicts).
2. **Continuous fields: piecewise power law in SL.** Let rows i and i+1 bracket the SL. Then
   `y = y_i · (SL / SL_i)^b_i`, where `b_i = ln(y_{i+1} / y_i) / ln(SL_{i+1} / SL_i)`. This is linear
   interpolation of ln y against ln SL. Use it for mass, areas, span, gill area and metabolic rate. Almost every
   sourced relation here is a power law of size, so this rule reproduces each of them exactly between rows.
   - Where a row value is a range `[lo, hi]`, interpolate lo and hi separately and carry both. Return the
     midpoint only if the caller needs a scalar, and tag it `derived`.
   - **Prefer the equation to the rows** when one exists in `allometries` and the state's mass or SL lies inside
     its `valid` range. Example: zebrafish rMO2 = 46.1 M^0.825 for 5–42 dpf. Evaluate that equation directly.
   - **Density, fractions and Ucrit:** interpolate linearly in SL, not in log. Adult Ucrit in m/s does not depend
     on SL (Plaut 2000), so hold it constant across adult sizes.
3. **Booleans and categories** (`has_swimbladder`, `o2_uptake_site`, `hb_needed_for_routine_O2`) are step
   functions. Use the thresholds in `size_thresholds_SL_m` (zebrafish pSB 3.5 mm, aSB 6.0 mm SL) and
   `age_thresholds_dpf` (gills required for O2 between 7 and 14 dpf; take the step at 14 dpf if one value is
   needed). Between two rows that disagree and have no threshold, use the value of the lower row.
4. **Nulls stay null.** If either bracketing row is null, return `{value: null, reason}` with the nearer row's
   reason. Do not bridge a gap: for example, zebrafish routine MR between 27 dpf and adult. Below the first row or
   above the last row, also return null, except that SL and mass may follow the growth curve.
5. **Provenance.** The interpolated field takes the **weakest** kind of its two rows, using the order in
   `lib/envelope.mjs`, from weakest to strongest: assumed, borrowed, measured-secondhand, calibrated, derived,
   measured. Keep both source ids. If the result came from an allometric equation, its
   kind is `derived` and its source is the equation's source.
6. **Temperature** is not handled in this file. Zebrafish rows are at 28 °C. Apply Q10 corrections in the
   perturbation layer and label them there.

## Rebuilding

`node sim-engine/params/build-ontogeny.mjs sim-engine/params/ontogeny.json` (moved into the repo by the hub; a rebuild on 2026-11-01 reproduced the committed file exactly except the `built` timestamp).
