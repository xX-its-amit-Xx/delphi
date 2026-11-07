# Results — retro-validation, scored against PREREGISTRATION.md

**Pre-registration:** commit `a67a0ff15`, written before any data module existed.
**Scored:** 2026-11-07, same day.
**Reproduce:** `node benchmarks/retro-validation/run-myoglobin.mjs`, plus `retroValidate()` in
`data/opsin.mjs` and `retroValidationVerdict()` in `data/ttx.mjs`.

---

## The headline

**Eleven pre-registered predictions. Two came out right.**

| | prediction | verdict |
|---|---|---|
| 1 | myoglobin charge/duration relationship is positive | **REFUTED** |
| 2 | Spearman ρ 0.50–0.85 at n ≥ 12 | **COULD NOT BE TESTED** — n = 9 is the most the record yields |
| 3 | rank statistic beats the linear one | **REFUTED** |
| 4 | terrestrial anchors sit low, with a narrower spread | **SUPPORTED** |
| 5 | sequence-only charge loses something real | **MIS-SPECIFIED** — the premise was wrong |
| 6 | opsin λmax MAE between 8 and 25 nm | **REFUTED** — 2.9 nm |
| 7 | deep-sea blue shift will be *under*-predicted | **REFUTED** — over-predicted |
| 8 | at least one tuned site unreadable | **REFUTED as written** — the concern reappeared in another form |
| 9 | predicted/measured rank correlation > 0.6 | **SUPPORTED** — 0.91 |
| 10 | fewer than six mutually comparable TTX values exist | **REFUTED** — eighteen exist |
| 11 | fewer than 40% of host × capability cells admissible | **REFUTED** — 40.2% |

Being wrong nine times out of eleven is the result. It is also the only reason the two hits mean
anything: a benchmark whose author scores well on their own predictions has usually tuned the test.

---

## Case 1 — Myoglobin net charge and maximum dive duration

26 mammalian myoglobins, every UniProt accession resolved live with the organism read back, every
structure's residue sequence matching its UniProt sequence, 9 species carrying a dive duration that is
a *species maximum* from a retrieved source.

### The finding that was not predicted: the sign depends on the pH

| charge convention | Spearman ρ vs log₁₀ duration | 95% CI | perm *p* (on ρ) | Pearson(log) | perm *p* |
|---|---|---|---|---|---|
| **pH 6.5, all ionisable groups** — the published convention | **+0.43** | −0.33 to 0.85 | 0.248 | **+0.68** | **0.045** |
| pH 7.4, all ionisable groups — what I pre-registered | **−0.63** | −0.91 to 0.06 | 0.071 | −0.58 | 0.100 |
| integer (K+R) − (D+E) | **−0.78** | −0.95 to −0.24 | **0.037** | −0.76 | **0.025** |
| exposed residues only, from structures | −0.66 | −0.92 to 0.01 | 0.059 | −0.65 | 0.052 |

Same nine species, same nine sequences, same nine durations. **The direction of the relationship
reverses depending on the pH at which the charge is summed.**

### Why, measured rather than asserted

- **Pearson(histidine count, Z₆.₅ − Z₇.₄) = 1.000.** The entire difference between the two conventions
  *is* the histidine count. Between pH 6.5 and 7.4 a histidine with a model pKa near 6.0 goes from
  about a quarter protonated to a few per cent, so each histidine is worth roughly a fifth of a charge
  unit at 6.5 and almost nothing at 7.4.
- **Spearman(histidine count, log₁₀ duration) = 0.701.** Histidine count tracks dive duration. Myoglobin
  is histidine-rich and the count is not flat across clades: 8 to 14 in the regression set, 7 to 14
  across all 26.
- **Spearman(Z₆.₅, Z₇.₄) across species = −0.008.** The two conventions are not two estimates of one
  quantity. They are two different quantities that share a name and are, in this set, orthogonal.

So the published relationship *is* recoverable from sequence — at the published pH, in the published
direction (Pearson 0.68, p = 0.045) — and it rides on histidine protonation. Mirceta and the
subsequent literature use **site-specific** ionisation constants modelled onto the tertiary structure;
this reproduction uses a uniform model pKa set. That difference is not a quibble: it is precisely the
quantity the sign of the result turns on, which makes their careful treatment of it load-bearing
rather than decorative.

**What this does not establish.** Nothing here contradicts the published finding. n = 9, every
confidence interval is wide, and one convention's nominal significance rests on a Pearson *p* at n = 9.
What it establishes is narrower and still worth having: *"myoglobin net charge"* does not name one
number, and a pipeline that computes "net charge" without stating a pH and a pKa set can produce
either sign of this relationship without any bug.

### The pre-registered predictions, one at a time

1. **Direction — REFUTED.** At the pre-registered pH 7.4, ρ = −0.63. The pre-registration committed to
   a pH and that pH gives the wrong sign. Scoring against pH 6.5 instead would be moving the
   goalposts, so it is reported above as the corrected analysis and not as the pre-registered result.
2. **Strength — COULD NOT BE TESTED AS WRITTEN.** "n ≥ 12" is unreachable: 9 species have a
   species-maximum duration, 11 have any sourced duration at all. Two rows were excluded by the data
   module's own rule — a single-study observed maximum is not a species maximum — and that rule was
   written before any correlation was computed. The underpowered result is shown, not scored.
3. **Rank beats linear — REFUTED.** Spearman(log) = −0.63 against Pearson(raw minutes) = −0.59. The
   heavy tail did not punish the linear statistic the way I expected, because at n = 9 the two
   statistics are reading nearly the same thing.
4. **Anchors — SUPPORTED.** Human, mouse, horse and cattle span 0.36 to 1.12 at pH 7.4; the divers span
   −0.07 to 4.12 with a median of 3.24. No terrestrial anchor exceeds the diver median, and the anchor
   spread is narrower. This is the only part of the claim that comes out cleanly, and it is the
   easiest part: a group contrast, not a graded relationship.
5. **Sequence-only loses something — MIS-SPECIFIED, and this is the most instructive failure.** The
   pre-registration reasons at length that Z_Mb is a *surface* charge, that surface means structure,
   and that a sequence-only charge must therefore be a weaker proxy. The methods text says otherwise:
   Z_Mb is "the sum of the charge of all ionizable groups in myoglobin at pH = 6.5" — **not** a
   solvent-exposed subset. I mis-specified a pre-registered prediction from the name of the quantity
   rather than its definition, and an agent retrieving the methods section caught it.
   The exposed-subset calculation was done anyway, and it answers a different question: restricting to
   solvent-exposed residues gives ρ = −0.66 against −0.63 for the full sum, 88.4% of ionisable residues
   in these myoglobins are exposed at a 0.20 relative-accessibility cut (range 86.0–92.6% per protein),
   and restricting the sum costs a mean of exactly 1.00 charge unit. So the restriction changes little —
   but Pearson(sequence integer charge, exposed-only charge) is 0.78, not 1.0, so it does reshuffle
   the ranking.

### The outlier that was not real

The first version of this analysis preferred *reviewed* UniProt entries, and one diving mammal came
out with more than double the myoglobin charge of any other — the most eye-catching number in the
table, and exactly what a diving-physiology story would want. That reviewed entry is a protein-level
record carrying **eleven X residues**, which bound its charge to an interval 22 units wide, several
times the entire biological range. The complete, **unreviewed**, genome-derived entry for the same
species puts it in the middle of the divers.

It was not caught by the charge code, which had no way to notice. It was caught because a structure
predictor refused the sequence and the structure-derived sequence came back short. The data module's
agent hit the same trap independently and documented it on the row.

`sequenceIsUsable()` now refuses any sequence whose charge interval is wider than the caller states it
can tolerate, defaulting to zero tolerance. **"Prefer reviewed" is the wrong default when the reviewed
entry predates genome sequencing: reviewed means curated, not complete.**

### Independent cross-check

Two independent fetches of these myoglobins — one by me, one by the data module's agent — share 21
species. **All 21 sequences agree byte for byte.** One species was represented by two different
accessions whose sequences are identical. Two harbour-seal/grey-seal myoglobins are identical to each
other, which is why the charge column has ties.

---

## Case 2 — Rod opsin λmax from tuning sites

12 measured rows (11 fishes plus the bovine reference), λmax 479–526 nm, every accession resolved live.

- **MAE — REFUTED.** 2.92 nm to the nearest band edge; 4.67 nm against the band midpoint as a point
  prediction. I predicted 8–25 nm. **The site rules transfer considerably better than I expected.**
- **Rank order — SUPPORTED.** Spearman(predicted, measured) = **0.911**, Pearson 0.839, against a
  pre-registered floor of 0.6.
- **Direction of bias — REFUTED.** I predicted deep-sea rows would be *under*-predicted for blue shift
  (predicted redder than measured). Deep and mesopelagic rows average **−2.13 nm** and the other rows
  **−2.75 nm**: the same sign, and the deep rows are predicted slightly *bluer* than measured, not
  redder. The prediction was wrong twice — in sign, and in expecting the two groups to differ.
- **Unreadable sites — REFUTED as written.** No row failed to align at a tuned site. But two rows carry
  a substitution at a tuned site whose shift value could not be retrieved, so their bands are narrow
  for the wrong reason — the module says so itself rather than letting a narrow band read as confidence.
- **The worst miss is the most interesting row.** *Aristostomias scintillans*, a deep-sea dragonfish,
  misses by **22 nm** — and misses because it is red-shifted where the site rules expect blue. The
  single largest failure is in the habitat the rules were built to explain.

**The contamination caveat stands.** Site-shift values and measured λmax values come partly from
overlapping species sets, so a row scored on a shift fitted to its own species is a fit and not a test.
The module's own note is blunter than anything I would have written: *read the misses, not the hits*,
because the bands are wide by construction.

---

## Case 3 — TTX resistance from Naᵥ channel P-loop substitutions

**REFUTED, decisively.** I predicted fewer than six mutually comparable fold-shift values existed in
the published record. There is a group of **eighteen**: rat Naᵥ1.4, *Xenopus* oocytes under
two-electrode voltage clamp, site-directed mutants, TTX-IC₅₀, at the channel level, with a wild-type
reference in the same group. The data module assembled 44 rows, 40 with a measured number, across 12
species and 5 numbering conventions.

**But the concern behind the prediction survives in a sharper form.** Those eighteen are a mutational
scan of a *sensitive mammalian* channel — not measurements of the convergent natural variants. The
comparable set for the question a design pipeline would actually ask ("what does this lineage's own
substitution do?") is **three**: the native cloned *Thamnophis sirtalis* Naᵥ1.4 alleles, where TTX K_d
goes from 50 ± 5.2 nM to 13,000 ± 1,800 nM, a 260-fold shift the source states explicitly.

Two further facts from the module that matter more than my prediction did:
- Two labs disagree by **1.35×** about the TTX sensitivity of the *same unmutated rat channel*. Many
  individual substitution effects are 1.5–2×, i.e. the same size as the inter-lab disagreement.
- At the same locus in a congener, Naᵥ1.4 genotype explains **23%** of whole-animal resistance
  variation. Channel-level fold-shifts do not sum to animal-level resistance, and the module refuses to
  let a channel measurement be reported as a whole-animal one.

So Case 3's tier is **VALIDATABLE_IN_A_LAB** after all — as predicted — but for a different and better
reason than the one I gave.

---

## Case 4 — The design space

**REFUTED by 0.2 percentage points.** 14 hosts × 16 capabilities = 224 cells, **90 admissible (40.2%)**
against my predicted ceiling of 40%.

And the module objects to the prediction, correctly: the refusal fraction is a property of *which*
hosts and capabilities were written down, both lists chosen partly to cover every mechanism class and
every verdict class. Reading it as a base rate is reading a table of contents as a finding. **The
prediction was ill-posed, and being refuted by 0.2 points is the least interesting thing about it.**

What the space is actually for: the most-requested design in the set — make the cow emit less methane —
is refused as `REFUSED_WRONG_GENOME`, while the module records that the host-genetic share of dairy-cow
methane variation is **21%** against **13%** for all measured rumen bacteria and archaea combined, and
that the two are largely independent. The refusal is right about the mechanism and wrong about the
opportunity, and the file says both.

---

## What this exercise bought

1. **A falsifiable claim about an external published relationship, obtained with no wet lab:** the
   myoglobin charge/dive relationship, as reproducible from sequence, inverts with the assumed pH, and
   histidine protonation carries the whole effect.
2. **A sequence quality gate** that has already deleted one spurious headline outlier, with the
   failure mode written down.
3. **Honest coverage numbers:** 9 species is the most the sourced record yields for the myoglobin
   regression, not the 12 I assumed. Several pre-registered thresholds were unreachable, and saying so
   is the point of having written them down first.
4. **Nine refutations of my own predictions**, each traceable to a specific wrong assumption: reading a
   quantity from its name, assuming a heavy tail would punish a linear statistic at n = 9, assuming
   site rules transfer badly, assuming the literature is less commensurable than it is.

## What it did not buy

Nothing here validates the *design* pipeline. No organism was designed, no edit was proposed, and no
phenotype was predicted for an organism that does not exist. These are tests of whether this repo's
sequence→phenotype machinery can recover facts that are already known. That is the floor. The two
levels of this system that scored at chance against external ground truth still score at chance.
