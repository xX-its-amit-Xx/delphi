# Pre-registration: wild-type sanity, negative and optimizer controls for the Design Studio

**Written 2026-10-31 (about 22:30 UTC), by the independent validation thread, before any studio scenario,
organism doc, optimizer or parser output was read or run.** At the time of writing `sim-engine/scenarios/`
did not exist and `sim-engine/lib/` held only `provenance.mjs`, `envelope.mjs` and `data-node.mjs`, none of
which was opened for this file except the provenance kind list. No threshold below may be changed after a
result exists. A failed test is reported as failed; a criterion found to be badly posed gets a dated
amendment at the bottom, labelled as written after results, and the original stays.

The SHA-256 of every byte of this file **before its last line** is recorded on the last line. To verify:
strip the last line (including the newline that precedes it), hash the rest.

Author: a software agent acting as the skeptic. It did not build any studio module. No human is named.

---

## 0. What a "pass" is allowed to mean

| status | meaning |
|---|---|
| `pass` | Predicted value inside the pre-declared band, and the weakest provenance kind behind the reported metric is `measured`, `measured-secondhand`, `derived` or `borrowed`. The weakest kind is printed beside it. |
| `pass-rests-on-assumed` | Inside the band, but the weakest kind is `assumed`. Reported, not counted as evidence. |
| `circular` | Inside the band, but the metric is `calibrated`, **or** any input the module reports for it is `calibrated`, **or** the predicted value equals (within 1 %) a constant in the module that is sourced to the same DOI/PMID as this test's target ("echo": the model read the answer). Counted as neither pass nor fail. A calibrated quantity can never be cited as a result. |
| `fail` | Outside the band, or a negative control violated. |
| `not-available` | The module the test needs has not landed. Re-run later. |
| `not-evaluable` | The module exists but does not expose the quantity (no such metric, interface mismatch). Named with the reason. This is a finding against the module's coverage, not a pass. |
| `no-target` | This thread found no fetched measurement to test against. The studio's number for this quantity is unvalidated, and is reported as such. |

Weakest-kind order (from `sim-engine/lib/provenance.mjs`, weakest first): assumed < borrowed <
measured-secondhand < calibrated < derived < measured. `calibrated` is special-cased to `circular` above,
whatever its position in the order.

Every check is made to fail once on a deliberately wrong input (a fake scenario module that returns a
value outside the band, a calibrated metric, an echoed constant, an optimizer that labels a best effort as
meeting the spec) before its verdict on the real modules is trusted. The harness records those
self-tests in `studio-results.json` under `selftest`.

## 1. Targets, all fetched on 2026-10-31 (Europe PMC REST, Crossref, Wayback copy of JEB)

| id | quantity | measured value | source (as read) | kind of the target |
|---|---|---|---|---|
| T-ucrit-a | adult wild-type zebrafish Ucrit | 56.0 ± 4.8 cm/s = **15.5 SL/s** (mean ± s.d., N = 21, 28 °C, Brett tunnel) | Plaut I 2000, J Exp Biol 203:813. PMID 10648223, doi:10.1242/jeb.203.4.813 (abstract, Europe PMC) | measured |
| T-ucrit-b | adult zebrafish Ucrit | 0.548 ± 0.007 m/s = **18.0 BL/s** (n = 10) | Palstra AP et al. 2010, PLoS One 5:e14483. PMID 21217817, doi:10.1371/journal.pone.0014483 (abstract) | measured |
| T-ctmax | wild-type zebrafish CTmax | **39.2 ± 0.34 °C** (acclimated 20 °C), **41.7 ± 0.35 °C** (acclimated 30 °C) | Cortemeglia C, Beitinger TL 2005, Trans Am Fish Soc 134:1431. doi:10.1577/T04-197.1 (abstract via Crossref) | measured |
| T-ctmax-b | zebrafish CTmax, first trial | **40.97 ± 0.10 °C** (ramp 0.3 °C/min) | Morgan R, Finnøen MH, Jutfelt F 2018, Sci Rep 8:7099. PMID 29740113, doi:10.1038/s41598-018-25593-4, PMC5940882 (full text) | measured |
| T-ctmin | wild-type zebrafish CTmin | **6.2 ± 0.28 °C** (acclimated 20 °C), **10.6 ± 0.53 °C** (acclimated 30 °C) | Cortemeglia and Beitinger 2005, as above | measured |
| T-sleep-adult | adult zebrafish sleep, 14:10 LD | **5.1 ± 1.3 %** of daytime, **58.1 ± 3.3 %** of night | Yokogawa T et al. 2007, PLoS Biol 5:e277. PMID 17941721, PMC2020497 (full text, Fig. 1 legend) | measured |
| T-sleep-onto | night sleep fraction by age | **6–10 dpf larvae 58.17 ± 4.25 %**; 4–6 weeks 54.25 ± 5.02 %; **4–6 months 33.37 ± 4.40 %**; 12 months+ 33.06 ± 6.44 % (mean ± SE) | Sorribes A et al. 2013, Front Neural Circuits 7:178. PMID 24312015, doi:10.3389/fncir.2013.00178, PMC3826060 (Table 1) | measured |
| T-cstart | adult zebrafish C-start peak centre-of-mass speed | Mean maximum Reynolds number 27,800 ± 2,140 (s.e.m.) in 1 mPa s water, fish TL 33.0 ± 1.3 mm, 5 fish. **U = Re·ν/L = 27,800 × 1.0×10⁻⁶ m²/s / 0.033 m ≈ 0.84 m/s (≈ 25 TL/s)** | Danos N, Lauder GV 2012, J Exp Biol 215:1854. PMID 22573764, doi:10.1242/jeb.068957 (full text, Wayback copy 2019-08-18). The velocity table is in a figure; the speed here is **derived** from the stated Re and length, assuming ν = 1.0×10⁻⁶ m²/s for 1 mPa s water | derived |
| T-glide | flying fish single glide | glide **up to 50 m** at **15–20 m/s** airspeed; leap at about 10 m/s; total over a taxi-and-glide sequence 400 m in 30 s | `physics/glide-data.csv` rows citing Makiguchi 2013 (doi:10.3354/ab00494) and Park and Choi 2010 (doi:10.1242/jeb.046052) introductions, quoting Edgerton and Breder 1941, Davenport 1990, Hertel 1966 | measured-secondhand |
| T-LD | flying fish L/D max | **4.37** (Cypselurus hiraii model L3, wind tunnel 12 m/s) | Park and Choi 2010 Table 2, via `physics/glide-data.csv` | measured |
| T-depth | deepest fish | "No fish have been found in the deepest 25 % of the ocean (**8,400–11,000 m**)"; teleost isosmotic limit predicted at **8,200 m** | Yancey PH et al. 2014, PNAS 111:4461. PMID 24591588, doi:10.1073/pnas.1322003111 (abstract) | measured (absence) + derived (limit) |
| T-gut | zebrafish gut passage time | **none adequate.** Field et al. 2009 (PMID 19140958) and Cocchiaro/protocol papers (PMID 30417875, 28727940) describe larval assays; no abstract or open full text fetched gives a wild-type passage time as a number | — | no-target |

No Aves data is used anywhere in this file.

## 2. Wild-type sanity tests (organism: wild-type adult zebrafish unless stated)

Conditions are the scenario defaults unless stated. Where a scenario does not report a threshold directly,
the harness locates it itself by bisection on `survives` over the scenario's own parameter (0.25 °C
resolution for temperature, 0.01 m/s for current), and the located threshold is what is scored; the
weakest kind is then the weakest kind among the metrics of the runs that bracket the threshold.

| id | test | band (pass rule) | scenario |
|---|---|---|---|
| W1 | adult Ucrit | predicted Ucrit in **[12.4, 21.6] BL/s** (15.5 × 0.8 to 18.0 × 1.2), or, if only m/s is given, in **[0.44, 0.66] m/s** (0.548 × 0.8 to 0.56 × 1.18). Either form passing counts. | current |
| W2 | CTmax | predicted CTmax in **[38.7, 42.2] °C** (the 20–30 °C acclimation span 39.2–41.7, ± 0.5 °C) | temperature |
| W3 | CTmin | predicted CTmin in **[5.2, 11.6] °C** (6.2–10.6, ± 1.0 °C) | temperature |
| W4 | thermal survival sign | survives at 25 °C and 28 °C; does **not** survive at 45 °C or at 2 °C | temperature |
| W5 | adult night sleep | adult night sleep fraction in **[24.6, 64.7] %** (33.37 − 2 SE to 58.1 + 2 SD; the two adult sources disagree and the band spans both) | sleep or daynight |
| W6 | adult day sleep | adult daytime sleep fraction **≤ 7.7 %** (5.1 + 2 × 1.3) and strictly below night | sleep or daynight |
| W7 | larval vs adult sleep | larval (6–10 dpf) night sleep fraction **>** adult night sleep fraction, and larval value in **[49.7, 66.7] %** | sleep |
| W8 | C-start peak speed | adult peak escape speed in **[0.42, 1.68] m/s** (0.84 / 2 to 0.84 × 2: the target is derived and the factor of 2 is its tolerance) | predator |
| W9 | flying fish glide | for the flying-fish organism doc (Exocoetidae / Cypselurus), single-glide distance in **[5, 75] m** and glide speed in **[7.5, 25] m/s** | wind (or any scenario reporting glide) |
| W10 | gut passage | no target: the studio's value is reported as **unvalidated** whatever it is | digestion |
| W11 | sustained current sign | zebrafish survives sustained current of **0.20 m/s** (half of the measured Uopt 0.396 m/s, Palstra 2010) and does **not** survive **1.10 m/s** (2 × Ucrit) | current |

## 3. Negative controls (any violation is a `fail`, regardless of provenance)

| id | control | pass rule |
|---|---|---|
| N1 | the real zebrafish must not glide 30 m | wild-type zebrafish glide/airborne distance **< 1 m**, or the scenario reports glide as not applicable / survives = false / no glide metric. A ballistic leap at the C-start speed above gives v²/g ≈ 0.07 m. Any value ≥ 30 m is a fail; 1–30 m is a fail too, reported as "not as absurd, still unsupported". |
| N2 | no fish below teleost depth limits | any fish organism doc (zebrafish, flying fish, any other fish the studio ships) at **9,000 m and 10,000 m** (≈ 90 and 100 MPa) must report survives = false. Also: a text spec "a fish that lives at 10,000 m" through the parser and optimizer must not return a design labelled as meeting it. |
| N3 | no grip without a gripping organ | an organism doc with no gripping organ (zebrafish) must not report a grip force > 0. Pass if the grip scenario returns no grip-force metric, a null/0 value, or validity flagging non-applicability. |
| N4 | flyable heights are an interval from the ground up (Lean `Altitude.feasible_downward_closed`, proved) | for every organism, `survives` (or flight feasibility) over altitudes 0, 500, 1000, 2000, 4000, 8000 m must be non-increasing in height; an organism that cannot fly at 0 m must not fly at any height. |
| N5 | glide range bound (Lean `glide_range_le`, proved) | whenever a scenario reports a glide distance d together with a launch height h and an L/D, d ≤ h × L/D / (1 − δ) with δ the ground-effect drag reduction it reports (δ = 0 if not reported). |
| N6 | determinism | two identical calls to a scenario return identical metric values. |
| N7 | contract | every metric has `kind` in the six allowed kinds and a non-empty `source`; every scenario exports `modelCard.validatedAgainst`. A metric without a kind is a fail of the module, not of the organism. |

## 4. Optimizer and parser controls

| id | control | pass rule |
|---|---|---|
| O1 | an objective the start already maximises is not "improved" | Objective: maximise `survives` (boolean, max = true) for wild-type zebrafish at the temperature-scenario defaults, where the start design already survives. The optimizer must report zero improvement (or return the start design unchanged). Reporting an improvement in a quantity already at its maximum is a fail. Second form: running the optimizer on its own returned design must not report a further improvement larger than 1 % of the first. |
| O2 | an impossible spec returns "no design meets the spec" | Spec: a single unpowered glide of **1,000 m** from a launch height of **1 m**. By `glide_range_le`, d ≤ h·L/D/(1 − δ); even with the largest L/D anywhere in the repository (15.7, an assumed model value, Kawachi 1993 via Deng 2019) and δ = 0.9, d ≤ 157 m. The optimizer must return an explicit no-design / infeasible result. Returning a best-effort design, even one honestly short of 1,000 m, **labelled as meeting the spec** is a fail. Returning a best effort clearly labelled as NOT meeting the spec is a pass. |
| O3 | impossible depth | Spec: a fish that survives at 10,000 m. Same rule as O2. |
| O4 | claims re-verify | any design the optimizer returns as meeting a spec is re-run through the scenarios by this harness; every claimed metric must match the re-run within 1 % relative, and the re-run must meet the spec. |
| P1 | parser does not invent | the text "a zebrafish that glides 1000 m" must parse to a spec whose target glide is 1000 m (not silently clipped to something feasible); the text "a fish at 10,000 m depth" must parse to a depth (or pressure) target equivalent to 10,000 m. |

## 5. Audit of scenario constants (part 3 of the brief)

For each scenario module that lands: every numeric literal other than 0, 1, 2, −1, unit conversions
(9.81, 1000, 60, 3600, 273.15, 101325) and loop/array indices must sit in a record carrying a source URL or
DOI. Unsourced constants are listed. A sample (at least 3 per module, or all if fewer) of the cited sources
is fetched with a real GET (Europe PMC REST for DOIs and PMIDs, the URL itself otherwise), and the fetched
text is checked to mention the quantity (the value, or the quantity's key word). Each result is reported as
`confirmed`, `mentions-quantity-not-value`, `does-not-mention`, or `fetch-failed`. HEAD requests are not used.

## 6. What this file does not cover

It does not test the studio's genotype side, the morphogen tool (`validation/hhip-fin-area.mjs` owns that),
or any number about birds. It does not grade the UI. A module that passes every test here is
sanity-checked, not validated: the bands are wide on purpose, because the targets themselves disagree
(two adult sleep sources differ by 25 points; two Ucrit sources by 2.5 BL/s).

sha256 (all bytes above this line, file written 2026-11-01T02:30:37Z): f2523da8529b998eea8ef9b9f165851f60d078a7ac5151a0dafa7bb4d324a66d
