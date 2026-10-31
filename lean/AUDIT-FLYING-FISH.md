# Every theorem against the flying fish (Exocoetidae)

Generated 2026-10-31T20:34:28.498Z by `lean/flying-fish/audit.mjs` from `lean.json` (built 2026-10-31T19:29:27.259Z) and the data files named below. One row per theorem the compiler accepted: whether it applies to Exocoetidae, which inputs are measured for flying fish, which are proxies, which are missing, and the verdict when instantiated. "Holds" and "violated" are about the model's hypotheses meeting the data; a theorem is never falsified by data, its hypotheses are.

## Summary

Of 92 theorems, 19 hold when instantiated on the flying fish (the blueprint certificate's 11 structural theorems, the exact minimum-speed bound on the Park and Choi specimen, the cube law approximately on Davenport's exponent, and 4 bookkeeping lemmas), 6 have their isometry hypotheses violated by Davenport's within-species exponents (fin area 1.834 vs 2, wing loading 1.236 vs 1), and 67 cannot be evaluated because an input is missing: a neutral substitution rate or fixation probability for the family, fitness variance at any locus, an asexual lineage (none known), material strength and section data for fin rays and bone, muscle fraction and power, and v_min or L/D at a second body size.

| Verdict | Theorems |
|---|---|
| holds | 19 |
| cannot-evaluate | 67 |
| violated | 6 |

| Applies to Exocoetidae | Theorems |
|---|---|
| yes | 22 |
| yes-under-named-hypotheses | 64 |
| no | 6 |

## Measured facts used (each with its file)

| Fact | Value | Status | Source |
|---|---|---|---|
| v_min for specimen L3 | 9.85 m/s | computed from measured | physics/glide-data.csv (Park and Choi 2010 Table 1 model L3 and Table 2; field summaries citing Hertel 1966, Fish 1990, Davenport 1994) |
| field glide airspeed | 10 to 20 m/s | secondary (field summary) | physics/glide-data.csv (Park and Choi 2010 Table 1 model L3 and Table 2; field summaries citing Hertel 1966, Fish 1990, Davenport 1994) |
| mass vs standard length exponent | 2.981 | measured (one species, abstract, no CI) | physics/allometry.json (Davenport 1992 abstract, Exocoetus obtusirostris, log-log slopes on standard length; no CI in the abstract) |
| lateral fin area vs standard length exponent | 1.834 | measured (one species, abstract, no CI) | physics/allometry.json (Davenport 1992 abstract, Exocoetus obtusirostris, log-log slopes on standard length; no CI in the abstract) |
| wing loading vs standard length exponent | 1.236 | measured (one species, abstract, no CI) | physics/allometry.json (Davenport 1992 abstract, Exocoetus obtusirostris, log-log slopes on standard length; no CI in the abstract) |
| mass vs fork length OLS exponent, 13 fish | 0.98 | computed from measured (narrow length range 0.257-0.340 m; not a test of the law) | physics/glide-data.csv (Makiguchi et al. 2013 Table 1, 13 Cheilopogon heterurus doederleini, fork length and mass) |
| pectoral fin length / standard length | 0.687 | measured (median of 49 preserved specimens; length only) | genotype/cache/daane2021_fin_ratios.json (Daane et al. 2021 Data S1A, 49 flying-fish museum specimens) |
| mutation rate per site per generation | 1.10e-9 to 4.83e-9 | proxy (herring and stickleback pedigrees; no Exocoetidae estimate) | lean/bound/parameters.json and lean/bound/result.json |
| generations since the oldest fossil | 4.81e+7 to 9.33e+7 | computed: PBDB first appearance (measured, two records from one paper) over a FishBase generation time for one species (proxy) | lean/bound/parameters.json and lean/bound/result.json |
| gene copies M = 2N | 2.00e+9 (from Ne > 1e9) | proxy (E. volitans mitochondrial Ne, Lewallen 2016; the only Ne for the family) | lean/bound/parameters.json and lean/bound/result.json |
| neutral substitution budget per site | 0.053 to 0.451 | computed from the above | lean/bound/parameters.json and lean/bound/result.json |
| blueprint certificate | 536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows | ontology-derived (Uberon, Cell Ontology via Ubergraph), not a measurement | lean/blueprint/certificates/a-flying-fish.json and lean/blueprint/data/a-flying-fish.taxon.json |
| L/D max for specimen L3 | 4.37 | measured (wind tunnel, one specimen) | physics/glide-data.csv (Park and Choi 2010 Table 1 model L3 and Table 2; field summaries citing Hertel 1966, Fish 1990, Davenport 1994) |

Not measured for Exocoetidae at all: mutation rate (proxy from herring and stickleback); effective population size for the family (one mitochondrial Ne for E. volitans); any neutral substitution rate; fitness variance at any locus; breaking stress and cross-sections of fin rays or bone; muscle mass fraction and mass-specific power; v_min, L/D or C_L,max at more than one body size; confidence intervals on the Davenport 1992 exponents (abstract only).

## lean/Delphi/Blueprint.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `Blueprint.Graph.transGen_trans` | yes: to the emitted blueprint graph of Exocoetidae (536 ontology terms), as structure | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | generic theorem instantiated by the certificate; structural, not biological |
| `Blueprint.Graph.partOfStar_of_edge` | yes (structural) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | as transGen_trans |
| `Blueprint.Graph.transGen_level_lt` | yes (structural) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | every edge of the emitted graph goes strictly down in level (checked by the kernel) |
| `Blueprint.Graph.acyclic_of_levelsDown` | yes (structural) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | no term of the flying-fish blueprint is transitively part of itself (aFlyingFish_wellFormed) |
| `Blueprint.Graph.rooted_of` | yes (structural) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | every term reaches the body root (aFlyingFish_wellFormed) |
| `Blueprint.Graph.levelsDown_of_check` | yes (checker soundness) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | the checker accepted the data |
| `Blueprint.Graph.closed_of_check` | yes (checker soundness) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | as above |
| `Blueprint.Graph.hasParent_of_check` | yes (checker soundness) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | as above |
| `Blueprint.Graph.rooted_of_check` | yes (checker soundness) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | as above |
| `Blueprint.TaxonData.ok_of_check` | yes: the pinned never_in_taxon and in_taxon statements for the 536 terms against the 32 taxa containing Exocoetidae | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | no kept term is excluded from Exocoetidae by Uberon or the Cell Ontology as served by Ubergraph; this is the one place a theorem touches the family's taxonomy, and it rests on the ontologies being right |
| `Blueprint.wellFormed_of_check` | yes (structural) | blueprint certificate: **ontology-derived** (536 terms, 674 edges, 1390 never_in_taxon and 5435 in_taxon rows) | **holds** | aFlyingFish_wellFormed; says the emitted anatomy is coherent under its rules, not that it is correct or complete |

## lean/Delphi/Constraints.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `Constraints.ne_of_lt_intervals` | yes (arithmetic) | none | **holds** | no empirical content |
| `Constraints.kimura_rate_rules_out` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | no measured (k, μ) pair for the family |
| `Constraints.kimura_rate_ratio_rules_out` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | substitution rates of two Exocoetidae lineages with equal mutation rate: **missing** | **cannot-evaluate** | no lineage comparison |
| `Constraints.neutral_fixation_rules_out` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | no committed probability |
| `Constraints.favored_fixation_rules_out` | yes-under-named-hypotheses (s ≥ 0) | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | no committed probability |
| `Constraints.supply_rules_out` | yes-under-named-hypotheses (independent fates) | mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); generations since the oldest fossil: **computed:** (4.81e+7 to 9.33e+7); gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)) | **cannot-evaluate** | no committed expected count for a wing (undefined) |
| `Constraints.supply_rules_out'` | yes-under-named-hypotheses (as supply_rules_out) | mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); generations since the oldest fossil: **computed:** (4.81e+7 to 9.33e+7); gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)) | **cannot-evaluate** | as above |
| `Constraints.fisher_rules_out` | yes-under-named-hypotheses (one locus, fixed fitnesses) | Δ, w̄, V for any locus: **missing** | **cannot-evaluate** | no fitness data |
| `Constraints.fisher_decline_rules_out` | yes-under-named-hypotheses (as fisher_rules_out) | Δ: **missing** | **cannot-evaluate** | no fitness data |
| `Constraints.fisher_zero_variance_rules_out` | yes-under-named-hypotheses (as fisher_rules_out) | V, Δ: **missing** | **cannot-evaluate** | no fitness data |
| `Constraints.twofold_factor_rules_out` | no (no asexual Exocoetidae known to the project) | none | **cannot-evaluate** | premise absent |
| `Constraints.twofold_rules_out` | no (as above) | none | **cannot-evaluate** | premise absent |
| `Constraints.cubeLaw_rules_out` | yes-under-named-hypotheses (isometry, constant density) | mass vs standard length exponent: **measured** (2.981) | **cannot-evaluate** | needs point ratios; the measured exponent is handled by exponent_rules_out |
| `Constraints.cubeLaw_rules_out'` | yes-under-named-hypotheses (as cubeLaw_rules_out) | mass vs standard length exponent: **measured** (2.981) | **cannot-evaluate** | as above |
| `Constraints.exponent_rules_out` | yes: a candidate "isometric E. obtusirostris at constant density" committing the measured exponent | mass vs standard length exponent: **measured** (2.981) | **cannot-evaluate** | the lemma fires only on an interval excluding 3; the abstract gives the point 2.981 with no CI, so no honest interval can be committed (missing: CI) |
| `Constraints.axial_strength_rules_out` | yes (dimensional) | σ, A, W, n for any member: **missing** | **cannot-evaluate** | no material or section data |
| `Constraints.strength_ratio_rules_out` | yes-under-named-hypotheses | breaking-load ratio: **missing** | **cannot-evaluate** | no data |
| `Constraints.giant_rules_out` | yes-under-named-hypotheses | reference safety factor: **missing** | **cannot-evaluate** | no safety factor measured; a scaled-up flying fish cannot be ruled on without it |
| `Constraints.stress_ratio_rules_out` | yes-under-named-hypotheses | stress ratio at two sizes: **missing** | **cannot-evaluate** | no data |
| `Constraints.area_ratio_rules_out` | yes-under-named-hypotheses | fin-area ratio at two sizes (Davenport gives an exponent, not a pair): **missing** | **cannot-evaluate** | point ratios not available |
| `Constraints.area_exponent_rules_out` | yes: a candidate asserting fin-area isometry for E. obtusirostris | lateral fin area vs standard length exponent: **measured** (1.834) | **violated** | fires if the measured 1.834 is committed as an interval excluding 2: fin-area isometry is eliminated for E. obtusirostris, as Davenport's own abstract says; without a CI the interval is the candidate's commitment, not a measurement |
| `Constraints.stress_exponent_rules_out` | yes: a candidate asserting isometric wing loading (W/S ∝ L) | wing loading vs standard length exponent: **measured** (1.236) | **violated** | fires if the measured 1.236 is committed as an interval excluding 1: isometric wing loading is eliminated for E. obtusirostris (positive allometry); CI caveat as above |
| `Constraints.vmin_exponent_rules_out` | yes-under-named-hypotheses | v_min exponent across sizes: **missing** | **cannot-evaluate** | no multi-size v_min |
| `Constraints.vmin_rules_out` | yes (exact, dimensional): a claim of lift-supported flight at a stated speed | v_min for specimen L3: **computed** (9.85 m/s); field glide airspeed: **secondary** (10 to 20 m/s) | **holds** | the measured specimen L3 at the field speeds (10-20 m/s) is NOT ruled out (v ≥ v_min = 9.85); the illustrative claim of 5 m/s is ruled out (lean/eliminate/examples.json) |
| `Constraints.vmin_scaling_rules_out` | yes-under-named-hypotheses | v_min ratio across sizes: **missing** | **cannot-evaluate** | no multi-size v_min |
| `Constraints.powerRequired_exponent_rules_out` | yes-under-named-hypotheses | P_req exponent: **missing** | **cannot-evaluate** | no power data |
| `Constraints.bending_exponent_rules_out` | yes-under-named-hypotheses (R9a) | bending-stress exponent of fin rays: **missing** | **cannot-evaluate** | no data |
| `Constraints.bending_ratio_rules_out` | yes-under-named-hypotheses (R9a) | bending-stress ratio: **missing** | **cannot-evaluate** | no data |
| `Constraints.bending_exponent_sheet_rules_out` | yes-under-named-hypotheses (R9b, the natural reading for a fin under aerodynamic load) | bending-stress exponent of fin rays: **missing** | **cannot-evaluate** | no data |
| `Constraints.froude_rules_out` | yes-under-named-hypotheses (swimming phase) | speed ratio at two sizes: **missing** | **cannot-evaluate** | one size class |

## lean/Delphi/Favored.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `FavoredChain.fixedBy_tendsto` | yes-under-named-hypotheses: selection not opposing the mutant (s ≥ 0), constant M | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | no measured fixation probability |
| `FavoredChain.fixationProbability_ge` | yes-under-named-hypotheses: s ≥ 0 | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | the floor 1/M ≈ 5e-10 with the proxy M; no measured fixation probability |
| `FavoredChain.fixationProbability_le_one` | yes (a probability is at most 1) | none | **holds** | trivially; carries no information about the fish |
| `wrightFisherSelection_fixation_one_ge` | yes-under-named-hypotheses: Wright-Fisher with relative fitness 1+s, s ≥ 0 | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing**; selection coefficient s of any flying-fish mutation: **missing** | **cannot-evaluate** | no s and no fixation probability measured |
| `wrightFisher_toFavored_fixedBy` | yes (definitional: the neutral chain viewed as a favored chain) | none | **holds** | bookkeeping identity; no empirical content |
| `neutral_expectedSubstitutions` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); generations since the oldest fossil: **computed:** (4.81e+7 to 9.33e+7); neutral substitution budget per site: **computed** (0.053 to 0.451) | **cannot-evaluate** | instantiated in lean/bound: μT = 0.053 to 0.451 substitutions per site over the family's duration, independent of M; this is a computation from proxies, and no measured genome-wide neutral divergence for Exocoetidae exists to compare (missing: measured divergence) |
| `favored_expectedSubstitutions_ge` | yes-under-named-hypotheses: s ≥ 0 and independent fates | mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); generations since the oldest fossil: **computed:** (4.81e+7 to 9.33e+7); the rate of mutations selection does not oppose: **missing** | **cannot-evaluate** | the floor is μ_f T with μ_f undefined |
| `expectedSubstitutions_le` | yes-under-named-hypotheses: independent fates | mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); generations since the oldest fossil: **computed:** (4.81e+7 to 9.33e+7); gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)) | **cannot-evaluate** | the ceiling 2N μ T is vacuous with N ≈ 1e9 (9.02e+8 per site); nothing measured to compare |
| `wrightFisherSelection_substitutions_bounds` | yes-under-named-hypotheses | mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); generations since the oldest fossil: **computed:** (4.81e+7 to 9.33e+7); gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)) | **cannot-evaluate** | the two bounds above together; the quantity bounded (expected adaptive substitutions) is not measured and the requirement for a wing is undefined |

## lean/Delphi/Fisher.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `select_isFreq` | yes (bookkeeping: selection maps a frequency vector to a frequency vector) | none | **holds** | no empirical content |
| `fisher_fundamental_theorem` | yes-under-named-hypotheses: one haploid or clonal locus, fixed fitnesses, infinite population; Exocoetidae are diploid, so the formalised (haploid) form is narrower than the biology (faithfulness: narrower scope) | variance in fitness at any Exocoetidae locus: **missing**; mean fitness: **missing** | **cannot-evaluate** | no fitness variance or mean fitness measured |
| `fisher_fundamental_theorem'` | yes-under-named-hypotheses (as fisher_fundamental_theorem) | variance in fitness: **missing**; mean fitness: **missing** | **cannot-evaluate** | as above |
| `mean_fitness_nondecreasing` | yes-under-named-hypotheses (as fisher_fundamental_theorem) | mean fitness in two consecutive generations under fixed fitnesses: **missing** | **cannot-evaluate** | no time series of mean fitness |

## lean/Delphi/Kimura.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `NeutralChain.fixedBy_sub_le` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)) | **cannot-evaluate** | the geometric error bound needs the chain (M and the kernel); with the proxy M ≈ 2e9 the bound is a statement about the model, and nothing measured on flying fish is a fixation probability at finite time |
| `NeutralChain.fixedBy_tendsto` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | instantiated with the proxy M the theorem gives u = 1/M ≈ 5e-10 for one new neutral copy; no measured fixation probability exists to compare |
| `NeutralChain.fixationProbability_eq` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | as fixedBy_tendsto |
| `wrightFisher_fixation_one` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | u = 1/M ≈ 5e-10 with the proxy M; unmeasured |
| `neutral_substitution_rate` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | k = μ needs a measured neutral substitution rate k for Exocoetidae; μ itself is a proxy from other teleosts (missing: k) |
| `neutral_substitution_rate_diploid` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | as neutral_substitution_rate; the diploid form is the one that applies to a teleost |
| `neutral_substitution_rate_tendsto` | yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family | gene copies M = 2N: **proxy** (2.00e+9 (from Ne > 1e9)); mutation rate per site per generation: **proxy** (1.10e-9 to 4.83e-9); a measured neutral substitution rate or fixation probability for any Exocoetidae locus: **missing** | **cannot-evaluate** | as neutral_substitution_rate |

## lean/Delphi/MaynardSmith.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `twofold_cost_of_sex` | no: the theorem compares an asexual lineage with sexual females at equal fecundity; no asexual lineage of Exocoetidae is recorded in any source this project fetched, so the premise has no instance in the family | fraction of asexual females: **missing** | **cannot-evaluate** | premise absent; the theorem says nothing about an all-sexual family |
| `asexualNext_mem` | no (as twofold_cost_of_sex; bookkeeping lemma) | none | **cannot-evaluate** | premise absent |
| `asexualAfter_mem` | no (as twofold_cost_of_sex; bookkeeping lemma) | none | **cannot-evaluate** | premise absent |
| `twofold_cost_of_sex_n` | no (as twofold_cost_of_sex) | fraction of asexual females over n generations: **missing** | **cannot-evaluate** | premise absent |

## lean/Delphi/Scaling.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `areaLaw_ratio` | yes-under-named-hypotheses: isometry of the lifting area | lateral fin area vs standard length exponent: **measured** (1.834) | **violated** (the HYPOTHESIS (fin-area isometry) fails within E. obtusirostris: measured exponent 1.834 vs 2 (fins grow relatively smaller); the theorem itself is a conditional and is untouched) | Davenport 1992 |
| `wingLoading_ratio` | yes-under-named-hypotheses: R1 and R2 | wing loading vs standard length exponent: **measured** (1.236); mass vs standard length exponent: **measured** (2.981); lateral fin area vs standard length exponent: **measured** (1.834) | **violated** (the hypotheses fail within E. obtusirostris: measured wing loading ∝ SL^1.236 vs the isometric 1 (positive allometry); note the three abstract exponents are not mutually exact (2.981 - 1.834 = 1.147 vs 1.236), as separate fits) | Davenport 1992 |
| `areaLaw_log` | yes-under-named-hypotheses (as areaLaw_ratio) | lateral fin area vs standard length exponent: **measured** (1.834) | **violated** (1.834 vs 2) | as areaLaw_ratio |
| `wingLoading_log` | yes-under-named-hypotheses (as wingLoading_ratio) | wing loading vs standard length exponent: **measured** (1.236) | **violated** (1.236 vs 1) | as wingLoading_ratio |
| `breakLoad_ratio` | yes-under-named-hypotheses: isometric load-bearing sections (fin rays, girdle, vertebrae) and one material | breaking stress σ of fin-ray or bone material in Exocoetidae: **missing**; load-bearing cross-sections at two sizes: **missing** | **cannot-evaluate** | no material or section data |
| `safetyFactor_eq` | yes-under-named-hypotheses (as breakLoad_ratio, with R1) | σ, k₃ (section constant): **missing**; mass vs standard length exponent: **measured** (2.981) | **cannot-evaluate** | σ and the section constant missing |
| `stress_ratio` | yes-under-named-hypotheses (as breakLoad_ratio) | cross-section of a load-bearing member at two sizes: **missing** | **cannot-evaluate** | no section data; the wing-loading form of the same lemma is evaluated under wingLoading_ratio |
| `safetyFactor_scaled` | yes-under-named-hypotheses (as breakLoad_ratio) | reference safety factor of any flying-fish member: **missing** | **cannot-evaluate** | no safety factor measured |
| `cannot_carry` | yes-under-named-hypotheses (as breakLoad_ratio) | σ, k₁, k₃: **missing** | **cannot-evaluate** | the size limit L_max needs σ and the shape constants; adult Exocoetidae reach 0.15-0.50 m (Davenport 1994 review) but no σ places that against a limit |
| `vmin_le` | yes: exact, no isometry; steady lift-supported flight with C_L ≤ C_L,max | v_min for specimen L3: **computed** (9.85 m/s); field glide airspeed: **secondary** (10 to 20 m/s); C_L,max: **measured** (0.78); air density ρ: **assumed** (1.225) | **holds** (v_min = 9.85 m/s for specimen L3 is below the quoted field airspeeds 10 to 20 m/s, so the fish is inside its own envelope (the physics thread's interpretation B); caveat: W, S, C_L,max from 0.04-0.06 kg stuffed specimens of one species, field speeds a family-level secondary figure) | measured specimen against field speeds |
| `vmin_ratio` | yes-under-named-hypotheses: R1, R2, constant ρ and C_L,max | v_min (or W, S, C_L,max) at two body sizes of one species: **missing**; wing loading vs standard length exponent: **measured** (1.236) | **cannot-evaluate** (with Davenport's wing loading ∝ SL^1.236 the hypotheses R1-R2 already fail, and the physics thread's v ∝ (W/S)^½ test was underpowered) | no multi-size v_min |
| `vmin_log` | yes-under-named-hypotheses (as vmin_ratio) | v_min at two sizes: **missing** | **cannot-evaluate** | as vmin_ratio |
| `powerRequired_ratio` | yes-under-named-hypotheses: R1, R2, constant ρ, C_L,max and L/D, flight at v_min | L/D max for specimen L3: **measured** (4.37); L/D at a second size: **missing** | **cannot-evaluate** | L/D measured for one specimen only (4.37); the scaling needs two sizes |
| `powerRequired_log` | yes-under-named-hypotheses (as powerRequired_ratio) | L/D max for specimen L3: **measured** (4.37) | **cannot-evaluate** | as powerRequired_ratio |
| `powerAvailable_ratio` | yes-under-named-hypotheses: Thompson's muscle premise (MusclePowerLaw), contested; and a gliding fish does not fly under muscle power in the air, so the premise applies to the taxiing and launch phase if at all | muscle mass fraction f and mass-specific power p for Exocoetidae: **missing** | **cannot-evaluate** | f and p missing |
| `powerRatio_eq` | yes-under-named-hypotheses (as powerAvailable_ratio) | f, p, L/D, ρ, C_L,max together: **missing** | **cannot-evaluate** | the constant c needs f and p |
| `exists_size_limit` | yes-under-named-hypotheses (as powerAvailable_ratio) | f and p: **missing** | **cannot-evaluate** | the size exists in the model; whether a 0.5 m flying fish is above or below it needs f, p and the aerodynamic constants (missing: f, p) |
| `bendingStress_ratio_body` | yes-under-named-hypotheses: fin rays and the vertebral column as slender linear-elastic beams with similar sections; for a fin under aerodynamic load the load is sheet-like (∝ area at fixed speed and C_L), so R9b rather than R9a is the natural reading for the pectoral fin | section modulus of fin rays at two sizes: **missing**; the load family (body-like or sheet-like) for the member in question: **missing** | **cannot-evaluate** | no section or load data |
| `bendingStress_log_body` | yes-under-named-hypotheses (as bendingStress_ratio_body) | bending stress at two sizes: **missing** | **cannot-evaluate** | as above |
| `bendingSafety_eq` | yes-under-named-hypotheses (as bendingStress_ratio_body) | σ_max of fin-ray material: **missing** | **cannot-evaluate** | σ_max missing |
| `bending_cannot_carry` | yes-under-named-hypotheses (as bendingStress_ratio_body) | σ_max, k_F, k_ℓ, k_Z: **missing** | **cannot-evaluate** | constants missing |
| `bendingStress_ratio_sheet` | yes-under-named-hypotheses: a sheet-like load (aerodynamic load on a fin ∝ fin area at fixed speed and C_L) with similar ray sections; no size limit follows | fin-ray section modulus at two sizes: **missing**; lateral fin area vs standard length exponent: **measured** (1.834) | **cannot-evaluate** (note that with fin area ∝ SL^1.834 (not 2) and unknown ray sections the hypotheses are not met as stated) | no section data |
| `bendingStress_log_sheet` | yes-under-named-hypotheses (as bendingStress_ratio_sheet) | none | **cannot-evaluate** | as above |
| `froude_ratio` | yes-under-named-hypotheses for the swimming and taxiing phase only (equal Froude number); not for the glide | launch speed: **estimated,** (3.87 to 5.15 m/s (estimated), 13 fish of one size class); speed at a second body size at equal Froude number: **missing** | **cannot-evaluate** | one size class |

## lean/Delphi/Thompson.lean

| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |
|---|---|---|---|---|
| `cubeLaw_ratio` | yes-under-named-hypotheses: isometric growth at constant density (the family scaled without change of shape) | mass vs standard length exponent: **measured** (2.981); mass vs fork length OLS exponent, 13 fish: **computed** (0.98) | **holds** (approximately: Davenport 1992 measured mass ∝ SL^2.981 within Exocoetus obtusirostris, within 0.02 of the exact 3; the abstract gives no CI, so exactness is untested. The 13 Makiguchi fish give an OLS slope of 0.98 over a length range too narrow to test anything) | mass grows almost exactly as the cube of standard length in the one species measured |
| `cubeLaw_loglog_exponent` | yes-under-named-hypotheses (as cubeLaw_ratio) | mass vs standard length exponent: **measured** (2.981) | **holds** (approximately (2.981 vs 3, no CI)) | as cubeLaw_ratio |
| `not_cubeLaw_of_exponent_ne_three` | yes: the contrapositive, which the data can fire | mass vs standard length exponent: **measured** (2.981) | **cannot-evaluate** (taken literally 2.981 ≠ 3 refutes the EXACT cube law for E. obtusirostris; without a CI the departure of 0.019 cannot be distinguished from estimation error, so the exact law is neither confirmed nor refuted) | no confidence interval in the abstract |

