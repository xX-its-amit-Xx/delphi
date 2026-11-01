# Fick ceiling check: zebrafish station-holding against the project's own aerobic bound

Date 2026-11-01, before the 12:00 freeze. Analysis only. Nothing in `lean/`, the law registry, `physics/results.json`,
`sim-engine/scenarios/` or the deck was edited. Proposed changes are in section 6. No Aves data was used.

## 1. Headline

- **The Fick ceiling as instantiated is not an upper bound for a zebrafish.** It allows an O2 uptake of **950 mg O2 kg^-1 h^-1**.
  Wild-type adult zebrafish were **measured at 2630 mg O2 kg^-1 h^-1 at Ucrit** (Palstra et al. 2010, 82.18 ± 6.50 umol g^-1 h^-1,
  28 °C, Ucrit 0.548 m/s). That is **2.8x the ceiling**. Even their standard metabolic rate, 1401 mg kg^-1 h^-1, is 1.5x the ceiling.
  This test uses no drag model and no efficiency. It compares an O2 uptake that was measured with the O2 delivery that the model
  says is the maximum.
- **The input that is wrong is cardiac output Q.** The model borrows Qmax from schoolmaster snapper (58.48 ml min^-1 kg^-1).
  The blood O2 capacity is already generous (0.206 ml/ml calibrated, 2.6x the trout value the chain measured). So the product Q·Ca
  is in effect "1.39x snapper MO2max" (snapper MO2max is 684.57 mg kg^-1 h^-1), and a 0.4 to 0.7 g cyprinid simply has a much
  higher mass-specific aerobic capacity than a snapper. For the measured uptake to fit under Fick with the model's own Ca and full
  extraction, Q must be at least **162 ml min^-1 kg^-1**. With a teleost-typical Ca (0.08 to 0.12 ml/ml) and about 80 % extraction,
  Q must be roughly **320 to 480 ml min^-1 kg^-1**. No exercising zebrafish Q measurement was found to confirm this directly.
- **The efficiency handling is consistent between the two models.** Both sides are mechanical power. Drag power is useful
  mechanical power with propulsive efficiency 1, which favours the fish. The Fick side multiplies O2 power by η = 0.15, which turns
  it into mechanical power. So the contradiction is not a bookkeeping error. η = 0.15 is a heart-muscle value. Fetched
  skeletal-muscle figures support roughly 0.16 to 0.23, which is the same or up to 1.5x higher (section 4).
- **Anaerobic power near Ucrit helps but cannot be the main explanation.** The measured *aerobic* uptake alone already breaks the
  bound. With the measured uptake (corrected for mass and temperature) and η = 0.15, the aerobic drag-bound speed is 0.63 m/s,
  which is above the scenario's Ucrit of 0.58 m/s. The model then agrees with itself.
- **Flying-fish headline: the 29 to 38x shortfall is overstated. A defensible range is about 10 to 29x, with a central value of
  about 20x.** The conclusion that sustained aerobic flight is impossible survives by an order of magnitude. The number does not,
  and the E3 claim that "no teleost has a ceiling above 0.0458 W" is contradicted per kilogram by zebrafish (section 5).

## 2. Reproduction

CLI: `node sim-engine/cli.mjs scenario run --organism zebrafish-adult --scenario current --param current_m_s=<U>`.
State values: Danio rerio, SL 0.0388 m, mass 0.6943 g, S_wet 7.473e-4 m^2, 25 °C, cardiac_output_max_ml_s 6.767e-4
(= 58.48 ml min^-1 kg^-1 x mass), water pO2 20.5 kPa.

| U (m/s) | flat-plate drag power (W) | aerobic_ceiling_W | P2b (perturb-current) |
|---|---|---|---|
| 0.45 | 3.23e-4 | 3.722e-4 | holds |
| 0.50 | 4.20e-4 | 3.722e-4 | **violated, 1.13x** |
| 0.55 | 5.33e-4 | 3.722e-4 | **violated, 1.43x** (severity red, baseline_violated true) |
| 0.58 | 6.09e-4 | 3.722e-4 | **violated, 1.64x** |

Ucrit in the same run is 0.5824 m/s (Plaut 2000 15.5 SL/s x SL x 0.968 for 25 °C). Drag power equals the ceiling at **0.476 m/s**
(`speedBound`). So the unedited wild type is flagged red over the top 18 % of the station-holding range it was measured to sustain.
At 0.55 m/s: Re 2.39e4, C_D 0.00860 (laminar plate), CdA 6.43e-6 m^2.

Fick decomposition (`sim-engine/scenarios/glide.mjs` FICK, `fickPower`):
P = η · E · Q · Ca = 0.15 x 19.34 J/ml x 6.767e-4 ml/s x 0.1896 ml/ml = **3.72e-4 W (mechanical)**.
The underlying O2 delivery is Q·Ca = 1.283e-4 ml/s, which is 950 mg O2 kg^-1 h^-1, or **2.48 mW of metabolic power**.

| Input | Value | Kind in repo | Comparison | Verdict |
|---|---|---|---|---|
| η | 0.15 | borrowed (salmon *ventricle*, gamperl2021) | skeletal muscle 0.16 to 0.23 (section 4) | low end, possibly up to 1.5x low |
| E_O2 | 19.34 J/ml (13.54 J/mg) | measured-secondhand | Chandrapalan 2025 uses 14.1 J/mg | fine (±4 %). The source text says "0.7 mg O2 per ml"; it should say 0.7 ml per mg (1.429 mg/ml). The number is right |
| Q | 58.48 ml min^-1 kg^-1 | borrowed (snapper, durnford2026 Table 1) | needs ≥162, probably 320 to 480, for zebrafish | **wrong, at least 2.8x low** |
| Hb O2 capacity | 0.206 ml/ml | calibrated (fitted to snapper extraction) | trout measured 0.0806 (rummer2015, physiology/haemoglobin.js) | generous (about 2.6x trout). It does not explain the gap; if anything it hides how low Q is |
| PaO2 = water PO2, Cv = 0 | | upper-bound assumptions | | generous |

Minor finding: the zebrafish-adult state carries `ambient.salinity_psu 35` and a density of 1023 kg/m^3. Zebrafish are freshwater
animals. `current.mjs` uses NIST pure water (997 kg/m^3) for drag, so this does not affect the numbers above. The salinity line is
still wrong for this organism.

## 3. Measured zebrafish values (primary sources, fetched 2026-11-01 via Europe PMC)

1. **Palstra AP, Tudorache C, Rovira M, et al. (2010).** Establishing zebrafish as a novel exercise model. *PLoS One* 5:e14483.
   doi:10.1371/journal.pone.0014483, PMC3013094. Results, "Swimming economy":
   - "maximal oxygen consumption at U crit of 82.18±6.50 µmol g−1 h−1" = **2630 mg O2 kg^-1 h^-1**.
   - "U crit of 0.548±0.007 m s−1 or 18.0±0.2 BL s−1"; "SMR was calculated at 43.79±3.39 µmol g−1 h−1" (1401 mg kg^-1 h^-1).
     RMR 38.13 umol g^-1 h^-1.
   - Methods: n = 10, "3.05±0.04 cm BL ... 0.43±0.03 g BW", 28 °C, individual Blazka respirometers.
   - Discussion: zebrafish O2 consumption is "among the highest measured in similarly sized fish at similar temperatures" (citing
     Lucas & Priede 1992, J Fish Biol 41:175, not fetched).
   - This Ucrit (0.548 m/s) is essentially the speed at which the studio raised the flag (0.55 m/s).
2. **Plaut I, Gordon MS (1994).** Swimming metabolism of wild-type and cloned zebrafish. *J Exp Biol* 194:209. PMID 9317659
   (Europe PMC abstract).
   - "Standard metabolic rates were 0.60–1.54 ... ml O2 g-1 h-1 for WT" = **857 to 2200 mg kg^-1 h^-1**. Most of that range is
     already above our *maximum* of 950.
   - Fish swam "up to ... 13 BL s-1 for extended periods (at least 2 h)".
   - "Whole-body lactate concentrations ... were not significantly different ... between rested and exercised fishes". So swimming
     up to about 13 BL/s is aerobic.
3. **Plaut I (2000).** *J Exp Biol* 203:813, PMID 10648223 (abstract). Wild-type Ucrit 56.0 ± 4.8 cm/s, 15.5 SL/s, 28 °C, N = 21.
   This is the scenario's Ucrit source.
4. **Chandrapalan T, Walia S, Kwong RWM (2025).** *Front Physiol* 16:1693900, PMC12571662. Adult zebrafish at 28 °C, SL about
   3.2 cm, mass 0.54 to 0.69 g (Table 3), oxycaloric value 14.1 J/mg. Its MMR values are only in Fig. 4 and Fig. 7, so no number is
   used from it here.
5. **Cardiac output and Hb:** Manchester EA, Gillis TE (2025), *J Exp Biol* jeb.251606, PMC12669836, measured zebrafish Q
   (ultrasound, anaesthetised, at rest) and haematocrit, but reports them only in figures. No measurement of zebrafish cardiac output
   *during exercise* was found. The Q requirement in section 1 is therefore inferred through Fick, not measured.

**Adjusting Palstra to the scenario fish** (0.694 g, 25 °C rather than 0.43 g, 28 °C): mass-specific exponent -0.1 to -0.2 and
Q10 2 to 2.5 give a factor of 0.69 to 0.77, so about **1815 to 2036 mg kg^-1 h^-1**. That is still **1.9 to 2.1x the ceiling**.

## 4. Efficiency and anaerobic contribution

Which side carries efficiency:
- `current.mjs` drag power ½ρC_D S U^3 is *useful* mechanical power. It omits propulsive efficiency (η_prop = 1), which
  understates what the muscles must produce. The real requirement is drag power / η_prop, so this side is a lower bound twice over:
  flat plate, and η_prop = 1.
- The Fick side, ηE·Q·Ca, turns O2 power into *muscle* mechanical power with η = 0.15.
- So the comparison is muscle work (Fick) against useful work (drag). It is a consistent mechanical-against-mechanical comparison
  that favours the fish. Adding η_prop would make the contradiction *worse*. Efficiency bookkeeping does not explain it.

Fetched values for η:
- Gladman NW, Askew GN (2024), *J Exp Biol* 227, PMC11583979.
  - Contractile efficiency of cuttlefish mantle muscle is 0.37 at its operating frequency.
  - Their Discussion re-derives **0.27 for dogfish muscle** (Curtin & Woledge, sinusoidal work).
  - Efficiency of oxidative recovery is "approximately 0.61". So aerobic chemical-to-work efficiency is 0.27 x 0.61 = **0.16** to
    0.37 x 0.61 = **0.23**.
  - Whole-animal overall swimming efficiency (including η_prop about 0.75) is 0.17.
- West, Curtin & Woledge (2023), PMC10542727, give catshark red muscle "high power at high efficiency" at its routine stride
  frequency. The number is in a figure only.
- η = 0.15 (salmon ventricle) is therefore at the low end of the skeletal range. A fair upper bound for a ceiling is η ≤ 0.23,
  up to 1.5x higher.

Check against the measured uptake (0.694 g fish):
- Total aerobic metabolic power at Ucrit is 6.87 mW (Palstra per-kg value as measured) or about 4.9 mW (adjusted).
- Drag power at 0.55 m/s is 0.533 mW. The overall efficiency needed is 0.08 (total) or 0.11 (adjusted), or 0.17 if SMR is first
  subtracted (net 3.21 mW). Measured whole-animal overall efficiency is about 0.11 to 0.17 (η 0.16 to 0.23 x η_prop about 0.75).
- So the measured aerobic power can pay the flat-plate drag at 0.55 m/s. Real undulatory drag is higher (Li et al. 2021), so the
  margin is small, which is what you would expect at 95 % of Ucrit.
- That residual gap near Ucrit is where **anaerobic (white-muscle) power** comes in. It is normal for the last Ucrit increments, but
  it is second-order here. Plaut & Gordon saw no lactate rise up to 13 BL/s.
- The P2b hypothesis "sustained swimming is aerobic" should not be applied right up to Ucrit (section 6).

Aerobic drag-bound speed (`speedBound`, same state):

| Ceiling used | Ceiling (W) | U where drag = ceiling (m/s) |
|---|---|---|
| current Fick (snapper Q) | 3.72e-4 | 0.476 |
| η 0.15 x Palstra, net of SMR | 4.81e-4 | 0.528 |
| η 0.15 x Palstra adjusted (1941 mg kg^-1 h^-1) | 7.60e-4 | **0.634** |
| η 0.15 x Palstra as measured | 1.03e-3 | 0.716 |
| η 0.20 x Palstra adjusted | 1.01e-3 | 0.711 |
| whole red-muscle power (current.mjs) | 3.19e-3 | 1.125 |

With the corrected ceiling the bound speed (0.63 to 0.72 m/s) lies above the measured Ucrit (0.58 m/s), so the model agrees with
itself.

## 5. Consequence for the flying-fish shortfall (C14 / E3, deck)

Current numbers:
- `lean/flying-fish-audit.json`: ceiling 0.0357 W for 0.06 kg. Inputs are Q 0.06564 ml/s (65.6 ml min^-1 kg^-1, snapper chain)
  and Ca 0.1872 ml/ml. Required power is 1.346 W at 10 m/s, giving **38x**.
- E3 envelope (`lean/empirical.json`): 0.0458 W, with 1.327 W at v_min, giving **29x**.
- The chain's ceiling corresponds to an O2 uptake of **1053 mg kg^-1 h^-1**. E3's envelope (Q ≤ 75 ml min^-1 kg^-1, Ca ≤ 0.21)
  corresponds to ≤ 1350 mg kg^-1 h^-1.

Corrections the evidence supports:
- **O2 supply, factor 1.3 to 2.5.**
  - Zebrafish 2630 mg kg^-1 h^-1 at 0.43 g, scaled to 60 g with a mass-specific MMR exponent of -0.10 to -0.13, gives about
    1390 to 1600 mg kg^-1 h^-1. That is **1.3 to 1.5x the chain** and 1.03 to 1.2x the E3 envelope.
  - The upper end (2.5x) assumes the flying fish is as aerobic per kg as a sub-gram zebrafish. This is an extreme but not absurd
    assumption for an active epipelagic swimmer.
  - Values for high-performance pelagic teleosts would be the natural next check. They were not fetched, so none is cited.
- **η, factor 1.0 to 1.5** (0.15 to 0.23, section 4).

| Case | Ceiling (W) | Shortfall at 1.346 W |
|---|---|---|
| current chain | 0.0357 | 38x |
| E3 envelope | 0.0458 | 29x |
| O2 x1.4 (allometric zebrafish), η 0.15 | 0.050 | 27x |
| O2 x1.4, η 0.19 (mid) | 0.063 | **21x** |
| O2 x1.4, η 0.23 | 0.077 | 18x |
| O2 x2.5 (zebrafish per kg, unscaled), η 0.23 | 0.137 | **10x** |

**Plain statement:** with corrected inputs the aerobic shortfall for powered flight is about **10 to 29x, central about 20x**,
not 29 to 38x. Sustained aerobic powered flight is still ruled out by an order of magnitude. Every case keeps
propulsive/aerodynamic efficiency at 1 and the most generous L/D, so the real shortfall is larger than each line. Any text that
quotes "29 to 38x" as the measured-teleost envelope, and E3's sentence "No teleost in the ranges the physiology chain cites has a
sustained aerobic ceiling above 0.0458 W", should be revised. The per-kg delivery envelope E3 uses (≤ 1350 mg kg^-1 h^-1) is
exceeded about 2x by measured zebrafish. At 60 g, the allometric zebrafish value still exceeds it slightly. E3's "every teleost"
reading was built from a trout Q range and does not survive contact with cyprinid respirometry.

## 6. Proposed changes (for owners, not applied)

1. **`sim-engine/scenarios/glide.mjs` FICK / `current.mjs` lean_inputs.aerobic_ceiling_W.** For zebrafish, compute the ceiling from
   measured O2 uptake instead of snapper Q x calibrated Ca:
   `aerobic_ceiling_W = η · 13.54 J/mg · MO2max`, with MO2max = 2630 mg kg^-1 h^-1 (Palstra 2010, 28 °C), kind measured.
   Optionally scale to state mass and temperature (exponent -0.15, Q10 2), giving 1941 mg kg^-1 h^-1 for the fixture.
   The fixture ceiling becomes 7.6e-4 W (1.03e-3 W unscaled). Alternatively set zebrafish-adult `cardiac_output_max_ml_s` to
   **1.87e-3 ml/s** (162 ml min^-1 kg^-1, kind *calibrated to Palstra MO2max*, not measured Q). Keep snapper Q as a labelled
   fallback only for species with no MO2max.
2. **P2b (`lean/constraints.json`, perturb-current).** Add to `proofScope.assumed`: "aerobic only below about 0.8 Ucrit; the final
   Ucrit increments include anaerobic power". Until (1) lands, mark P2b's baseline violation for the unedited zebrafish as
   *input-limited (ceiling not an upper bound for this taxon)* rather than red.
3. **E3 (`lean/empirical.json`)**
   - Widen the bounds to Q·Ca ≤ 1600 mg O2 kg^-1 h^-1 (allometric zebrafish at 60 g) and η ≤ 0.23 (Gladman & Askew 2024: 0.37 x
     0.61). The ceiling becomes ≤ 0.0357 x 1.52 x 1.53, about **0.083 W**, so the shortfall becomes **about 16x**. A deliberately
     extreme envelope (2630 per kg, η 0.23) gives about 0.137 W, about **10x**.
   - Replace "No teleost ... above 0.0458 W" with a statement scoped to the sources actually used.
   - Re-run the E3 certificate. 1.346 W still exceeds the widened ceiling, so the C14 elimination survives.
4. **`fick-principle` registry entry.** The law itself is fine. Add `scope.note`: "instantiations must use a taxon-appropriate
   MO2max or Q; snapper Q underestimates small cyprinids about 3x (Palstra 2010)". Also fix the E_O2 source wording in
   `physiology/muscle.js` / FICK ("0.7 mg O2 per ml" should read "0.7 ml O2 per mg").
5. **Deck and `physics/` text.** Change "29 to 38x short" to "about 10 to 30x short (central about 20x); 38x with the original
   snapper-based proxies". Keep the conclusion.
6. **zebrafish-adult state:** salinity 35 psu should be 0 (freshwater).

## 7. Limits of this check

- No measurement of zebrafish cardiac output during exercise and no blood O2 capacity value was available as text, so which part
  of Q·Ca is wrong is inferred through Fick. The product is what the measured MO2 constrains.
- The adjustments for mass and temperature use assumed exponents (stated).
- Lucas & Priede 1992 and the tuna/pelagic MO2max literature were not fetched.
- No flying-fish (Exocoetidae) respirometry exists in the project. The flying-fish correction is a cross-taxon transfer, like the
  original proxies.
