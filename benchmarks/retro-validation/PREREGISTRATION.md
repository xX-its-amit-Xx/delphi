# Pre-registration — retro-validation of DELPHI's organism × function designs

**Written 2026-11-07, BEFORE the ground-truth data modules existed in this repo.**
This file is committed on its own, in a commit that precedes the commit adding
`data/myoglobin.mjs`, `data/opsin.mjs` and `data/ttx.mjs`. The git history is the timestamp:
if these predictions were edited after the results were known, `git log --follow` on this file
will show it. Nothing below may be edited after the result commit lands — a correction goes in
`RESULTS.md` as a correction, with this file left standing as written.

---

## Why pre-register at all

Everything else in this project is scored against ground truth we assembled ourselves. That is the
weakest possible footing: when the benchmark author also authors the answer key, a system that looks
good may only be well-matched to its own test. Two of this project's three levels have already come
out **at chance** against external ground truth, and one of the reasons we know that is that the
controls were built before the scores were read.

So these three cases are chosen for one property: **the answer already exists, in the published
literature, measured by people who have never heard of this project.** No wet lab, no approvals, no
reagents. The system emits a number; a paper from 1996–2019 says what the number is. We can be wrong
today.

A retro-validation is a weaker test than a prospective experiment in one specific way, and it is
worth naming up front: the published measurements are *findable*, so an honest claim that we did not
look requires exactly this file. It is also stronger in one way — the measurements were not made for
us, so they cannot have been shaped to suit us.

---

## Case 1 — Myoglobin net surface charge predicts maximum dive duration (mammals)

**The published claim.** Mirceta et al. 2013, *Science* (DOI `10.1126/science.1234192`) report that
myoglobin net surface charge (Z<sub>Mb</sub>) tracks maximum dive duration across diving mammals, the
proposed mechanism being that like charges resist self-association at the very high myoglobin
concentrations in diving muscle.

**What our system will emit.** Net charge computed from the myoglobin amino-acid sequence alone, at
pH 7.4, with no structure. This is deliberately a *weaker* quantity than the paper's: Z<sub>Mb</sub>
as published is a **surface** charge, and surface means structure. We do not have per-species
myoglobin structures, so the predictor is sequence-only and the gap is the interesting part.

**Predictions, in order of how much they would cost me to be wrong about:**

1. **Direction**: positive. Higher net charge ↔ longer maximum dive duration.
   *Refuted if* the point estimate of Spearman ρ is negative.
2. **Strength**: Spearman ρ between sequence-only net charge and log₁₀(maximum dive duration) will
   fall in **0.50 – 0.85**, with a two-sided permutation p < 0.05 at n ≥ 12.
   *Refuted if* ρ < 0.40, or if p ≥ 0.05.
3. **Spearman will exceed Pearson on raw minutes.** Maximum dive durations are heavy-tailed (elephant
   seals and beaked whales sit far out), so a rank statistic should hold up where a linear one does not.
   *Refuted if* Pearson(charge, raw minutes) ≥ Spearman(charge, log minutes).
4. **The terrestrial anchors will not separate.** Human, mouse, horse and cow myoglobins will span a
   charge range smaller than the range among divers alone, and will sit at the low-charge end.
   *Refuted if* any strictly terrestrial mammal's myoglobin charge exceeds the median diver's.
5. **Sequence-only loses something real.** I expect the sequence-only ρ to be *lower* than the
   relationship as published, because excluding buried residues is part of the published convention
   and we cannot do it. I will not be able to quantify by how much without the paper's own per-species
   values, so this prediction is **directional only** and is recorded as such rather than dressed up
   with a threshold it does not have.

**What a pass would and would not mean.** A pass means a published, externally measured physiological
relationship is recoverable from sequence by code in this repo. It would **not** mean the design
pipeline works: nothing here designs anything. It is a test of whether our sequence→phenotype
machinery can reproduce a known fact, which is the floor, not the ceiling.

---

## Case 2 — Rod opsin λ<sub>max</sub> predicted from tuning sites

**The published claim.** RH1 absorption maximum is substantially predictable from a small number of
amino-acid sites (bovine numbering 83, 122, 207, 261, 292 among them), with per-substitution shifts in
nm reported across Yokoyama's body of work; deep-sea fishes are blue-shifted.

**What our system will emit.** A predicted λ<sub>max</sub> in nm: align the species opsin to bovine
RH1 (P02699), read the residue at each tuned site, sum the published shifts for substitutions present.

**Predictions:**

1. **Mean absolute error will be between 8 and 25 nm** against measured λ<sub>max</sub>.
   *Refuted if* MAE < 8 nm (site rules transfer better than I expect) **or** MAE > 25 nm (they barely
   transfer at all). I am predicting the unglamorous middle: useful, not trustworthy.
2. **The error will be biased, not symmetric**: the predictor will **under-predict the blue shift** in
   deep-sea fishes — predicted λ<sub>max</sub> higher (longer-wavelength) than measured — because the
   tabulated site set was not derived to explain the full extent of deep-sea tuning.
   *Refuted if* the mean signed error on deep-sea rows is ≤ 0, or if its sign matches the shallow rows'.
3. **Some sites will be unreadable.** At least one row will have a tuned site falling in an alignment
   gap or an ambiguous column. The predictor must report that rather than silently summing fewer shifts.
   *Refuted if* every site is cleanly readable on every row — which would be a pleasant surprise about
   opsin alignability, not about our code.
4. **Rank order will survive better than absolute value.** Spearman ρ between predicted and measured
   λ<sub>max</sub> > 0.6 even while MAE stays above 8 nm.
   *Refuted if* ρ ≤ 0.6.

**The confound I am naming before I see the result.** The site-shift values and the measured
λ<sub>max</sub> values come partly from overlapping sets of species. If a species in our test set was
used to fit the shift it is being scored on, that row is not a test; it is a fit. I expect at least
one such row and I will mark them, and report MAE both with and without them. **If the MAE prediction
only holds on the contaminated set, the prediction counts as refuted.**

---

## Case 3 — Tetrodotoxin resistance from Na<sup>+</sup>-channel P-loop substitutions

**Prediction, and it is a prediction that the case will fail to be retro-validatable at all.**

I predict we will **not** be able to assemble six or more TTX IC₅₀ fold-shift values that are mutually
comparable — same numbering convention, same channel, same class of expression system — from the
published record. Fold-shifts come from different labs, different heterologous systems and different
channel backgrounds, and the quantity that would be comparable across them is mostly not reported.

*Refuted if* ≥ 6 mutually comparable values can be assembled, in which case a quantitative
substitution → fold-shift prediction becomes a fourth retro-validation and I was wrong to doubt it.

So Case 3 is predicted to land at tier **VALIDATABLE_IN_A_LAB**, not **RETRO_VALIDATABLE_NOW**, and
its value to the project is as a *convergence* case for the analogy module rather than as a regression:
TTX resistance arose independently in squamates, amphibians and fishes, which makes those substitutions
functional analogues with little or no orthology at the site level — exactly the class that an
orthology-only pipeline cannot see.

---

## Case 4 — The design space itself

**Prediction: fewer than 40% of host × function combinations will be admissible.** Most of what one
can *ask for* is not a thing this kind of pipeline can do, and a space whose refusals are rare would
mean the refusal rules are too weak rather than that the space is rich.

*Refuted if* the admissible fraction is ≥ 40%.

---

## Standing conditions

- Every ground-truth number must carry a retrieved DOI or PMID. A number without one is not ground
  truth, it is a memory, and it is to be refused rather than written.
- UniProt accessions are to be resolved live and the organism read back before a sequence is used. An
  accession that resolves to the wrong organism is a silent catastrophe in a comparative analysis.
- The predictors must not touch the network, so that the prediction cannot be contaminated by a lookup.
- **Scope**: mammals and fishes, with amphibians and squamates in Case 3. This is the repo's standing
  comparative scope and the published datasets are subset to it.
- If a result comes out in our favour and I find a bug in the predictor afterwards, the result is
  withdrawn, not patched and re-reported.
