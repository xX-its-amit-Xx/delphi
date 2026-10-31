# How close is our designed organism to a real flying fish?

Pre-registered in `design-validation/PREREG.md`, sha256 `ea6f99eb25b48cdba85d2766b20bc4d8797dfa243c7c6dc784ef2815b72aaa76`,
hashed 2026-10-31T22:00:34Z **before the first number was produced**. Deviations are in `RUNS.md`. Machine-readable
results in `scorecard.json`; every source read is logged in `calls.json`.

---

## The one honest sentence

**On the axis the whole design is about we cannot say how close it is, because the measurement exists only inside a
figure we refused to digitise; the one morphological axis that can be scored puts the design exactly on the
zebrafish and none of the way to the flying fish; and genetically the design reproduces 1 of the 74 loci known to
differ in flying fishes (1.4 %), that one being a real convergent hit on `lat4a`/`slc43a2a` while the other half of
the design is a gene with no flying-fish evidence at all.**

The second honest sentence, which matters as much: **the design is not ours.** It is Daane et al. 2021's own
germline double heterozygote, which those authors had already built, scored, and described as phenocopying "this
key innovation and organismal bauplan of flying fishes". Every phenotypic claim being validated here is a result
about their experiment.

**Joint result, as a pair, never merged: `(NOT CLOSE / largely UNSHOWN, Lean gate FAILS)`.**

---

## PART 1 - Phenotypic distance, per parameter

`f = (D - Z)/(F - Z)` is the design's position on the path from zebrafish `Z` to the flying-fish median `F`.
`f = 0` is the untouched zebrafish, `f = 1` is the flying-fish median. Residual `r = F - D`.

| # | parameter | zebrafish `Z` | flying fish `F` | design `D` | `f` | residual `r` | in measured range? | verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | **pectoral fin length / SL** | **none** | **0.687** (range 0.406-0.823, n=49) | **figure-only** (Fig 4B) | - | - | - | **CANNOT SCORE** |
| 2 | caudal fin length / SL | none | none | figure-only (Fig 4C) | - | - | - | CANNOT SCORE |
| 3 | median (dorsal/anal) fin length / SL | none | none | qualitative: "wild-type-sized" | - | - | - | CANNOT SCORE |
| 4 | lower caudal lobe / SL (hypocercality) | none | none | qualitative: "hypocercal, elongated ventral lobe" | - | - | - | CANNOT SCORE |
| 5 | lepidotrichial segment length | 290.7 +/- 32.7 um (n=10, **caudal** rays) | none | figure-only (Figs S2A, S2B) | - | - | - | CANNOT SCORE |
| 6 | pectoral fin ray count | 10 | none | not stated | - | - | - | CANNOT SCORE |
| 7 | **body mass vs SL exponent `b`** | **3.22** (Beaudouin 2015) | **2.981** (Davenport 1992); fitted field range 2.208-3.011 | **3.22** (specification: no body-growth change) | **0.00** | **-0.239** (-8.0 %) | **OUTSIDE** | **FAIL** |
| 8 | lateral fin area vs SL exponent | none | 1.834 (Davenport 1992) | none | - | - | - | CANNOT SCORE |
| 9 | wing loading vs SL exponent | none | 1.236 (Davenport 1992) | none | - | - | - | CANNOT SCORE |
| 10 | maximum body depth / SL | 0.2865 (jiang2026) | none | 0.2865 (unchanged) | - | - | - | CANNOT SCORE |

**Scored: 1 of 10. Could not score: 9 of 10.** The count of unscoreable parameters is the headline finding of this
part, exactly as pre-registered.

Why each of the nine failed, by side (an axis can fail on more than one side):

| reason | axes |
|---|---|
| the design's value exists only in a figure, and we do not digitise figures | 1, 2, 5 |
| the design's value is a word, not a number | 3, 4 |
| no flying-fish (reference) value exists in any fetched source | 2, 3, 4, 5, 6, 10 |
| no zebrafish (baseline) value exists in any fetched source | 1, 2, 3, 4, 8, 9 |

Axis 1 is the important one and it fails on **both** sides at once. The project's established hard limit holds: no
fetched source gives an adult zebrafish pectoral fin length / SL, and `development/zebrafish/trajectory.mjs`
returns `finLength_SL: null`. **No value was invented for it, and nothing was interpolated from relatives.** The
design side is Daane Figure 4B, which was not digitised. So the single number that would settle "is the winged
zebrafish's fin as long, in proportion, as a flying fish's?" is unavailable at both ends of the comparison.

Axis 7, the only scored axis, deserves its caveat stated plainly: `D = 3.22` is a **specification statement, not a
measurement**. The design alters fins, not body growth, and the authors report that the mutant "does not have a
statistically decreased body size". So `f = 0.00` is a true statement about what the design changes rather than a
digitised result - and it is unfavourable to the design, so it is not a metric chosen to flatter.

---

## PART 2 - Genetic distance. This is the part that decides it.

| count | value | how it was obtained |
|---|---|---|
| **(a) loci known to differ in flying fishes** | **74** | distinct Ensembl loci in sheet **G** (convergent amino-acid substitutions, 44 rows -> 42 loci; one unnamed row excluded) **union** sheet **I** (glider RER genes, 32 rows -> 32 loci). Zero overlap between the two sheets. |
| **(b) of those, loci the design changes** | **1** | `lat4a` = `slc43a2a` = `ENSORLG00000009715` |
| **(c) the fraction reproduced** | **1 / 74 = 0.0135 (1.4 %)** | (b)/(a) |
| **(d) loci the design changes that are NOT known to differ** | **1** | `kcnh2a` |

### (a) in detail, including what the sheets could not give

| sheet | what it is | contributes to (a) |
|---|---|---|
| **G** - conv. aa subst. | 44 convergent amino-acid substitutions, every one ticked for Exocoetidae -> **42 distinct loci** | 42 |
| **I** - Glider RER genes | 32 relative-evolutionary-rate genes -> **32 distinct loci** | 32 |
| **K** - accel CNEs Exocoet. | **455 GO terms**, columns `GO ID / GO Name / # CNEs / q-value`. **No gene column and no element list.** | **0 - GAP** |
| **M** - accel CNEs halfbeak | **582 GO terms**, same shape. Also halfbeak, not Exocoetidae. | **0 - GAP** |
| **J** - Exocoeidae phyloP | 76 rows -> 74 loci, 38 accelerated / 38 conserved | 0 (pre-registered as supporting only) |

The accelerated-non-coding-element axis is a **named gap, not a zero**. Sheets K and M are GO-term enrichment
tables, so the accelerated elements themselves are never listed and no gene is named. Their `# CNEs` columns sum to
131,425 and 126,463, but a CNE is counted once per GO term it maps to, so those sums are **neither element counts
nor locus counts**, and they are not used anywhere. Per-GO-term counts run 5-2,464 (K) and 5-2,312 (M). So (a) = 74
is a count of **coding** loci only, and the true number of loci that differ in flying fishes is larger than 74 by
an amount these sheets cannot tell us.

For scale: 74 loci against the **23,611 predicted protein-coding genes** of the *Hirundichthys speculiger*
assembly (Xu et al. 2021, doi 10.3389/fgene.2021.695700, PMC8294118, fetched in this thread; BioProject
PRJNA714815) is 0.31 % of the gene set.

### (b) the intersection, exactly

**`lat4a` IS in sheet G - a genuine overlap.** Sheet G row 2:

> `ENSORLG00000009715 | lat4a | F326L | [tick] E.viridis | [tick] O. micropterus | [tick] Exocoetidae | [tick] fin screens`

The same Ensembl ID appears in sheet J as `slc43a2a` (accelerated, phyloP p = 8.37e-3), which confirms that Daane's
`lat4a` and ZFIN's `slc43a2a` are one locus. So the design's first edited gene is a locus with a convergent
amino-acid substitution in flying fishes, ticked for Exocoetidae, and flagged in the paper's own fin screens.
**This is the design's real win, and it was pre-registered as the claim the design could honestly make.**

**`kcnh2a` is NOT among them.** All fourteen sheets of Data S1 were searched for `kcnh2`, `lat4`, `slc43a2`,
`prrx1`, `longfin`, `dt2` and `nr21`. The only `kcnh2` hit anywhere in the workbook is **`kcnh2b`**
(`ENSORLG00000004137`) in sheet **H** "fin and limb genes" - a candidate list, not one of the sheets that record
what differs in flying fishes. By the pre-registered rule a paralogue is a NEAR MISS and does not count.

Two further near misses, both recorded because they cut against the design:

- **`slc43a2b` / `lat4b`** (`ENSORLG00000005019`) is the gene carrying the glider RER signal (sheet I) and the
  *strongest* phyloP acceleration in sheet J (p = 1e-5). The non-coding and rate evidence sits on the **b
  paralogue**, not on the **a** copy the design edits.
- The convergent flying-fish substitution in `lat4a` is **F326L**. The zebrafish allele the design uses is
  **T200K**. Same gene, **different residue**. The design does not reproduce the flying fish's substitution; it
  changes a different position in the same transporter.

### (c) = 0.0135, and what that means

By the pre-registered bands this is **TOKEN** (0.01 <= C < 0.10): a real overlap at one locus, negligible as a
fraction. It is not the pre-registered FAIL band (C < 0.01) and it is not substantial. Stated plainly:

> **The design reproduces 1.4 % of the loci known to differ in flying fishes. It changes two genes; one of them is
> a genuine convergent flying-fish locus, at a different residue, and the other has no flying-fish evidence at
> all.**

This is the expected shape of a trait-targeted design, and it is what Part 2 was built to expose: a design can
match the target trait while differing everywhere else. `B >= 1` is true, so the narrow claim ("we targeted a locus
the flying fish also changed") holds. The broad claim ("the design reproduces the flying fish genetically") does
not.

POST-HOC (exploratory), labelled as such and excluded from the headline: adding sheet J to the denominator gives
(a) = 131, (b) = 1, **(c) = 0.0076**, which crosses into the pre-registered "negligible" band. The pre-registered
answer stands at 0.0135; the sensitivity is reported because the choice of denominator changes the band.

---

## PART 3 - The Lean constraint GATE

Gate rule, pre-registered: **PASSES** = nothing violated and nothing cannot-evaluate; **FAILS** = anything
violated; **UNDECIDED** = nothing violated but something cannot-evaluate. **UNDECIDED IS NOT A PASS.**

| arm | gate verdict | holds | violated | cannot-evaluate |
|---|---|---|---|---|
| REAL flying fish (Park and Choi L3, full measured inputs) | **FAILS** | 2 | 1 | 18 |
| DESIGN (winged zebrafish, everything its spec supplies) | **FAILS** | 1 | 2 | 18 |
| *control, POST-HOC:* real fish given only the design's inputs | *UNDECIDED* | *1* | *0* | *20* |

### Per-constraint, side by side

| id | band | REAL | DESIGN | classification | theorem |
|---|---|---|---|---|---|
| C9 | proved | **holds** | cannot-evaluate | undecided-where-real-decided | `Constraints.vmin_rules_out` |
| C7b | proved | cannot-evaluate | **violated** | **design-only** | `Constraints.exponent_rules_out` |
| C2a | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.area_exponent_rules_out` |
| C8e | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.stress_exponent_rules_out` |
| C9c | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.vmin_exponent_rules_out` |
| C8c | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.giant_rules_out` |
| C15 | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.glide_range_rules_out` |
| C16 | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.climb_rules_out` |
| C14 | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.aerobic_flight_rules_out` |
| C13 | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.allometry_consistency_rules_out` |
| C10 | proved | cannot-evaluate | cannot-evaluate | - | `Constraints.powerRequired_exponent_rules_out` |
| G1 | proved | cannot-evaluate | **holds** | - | `Genotype.claimed_substitutions_rules_out` |
| G2 | proved | cannot-evaluate | cannot-evaluate | - | `Genotype.closure_violated` |
| G3 | proved | cannot-evaluate | cannot-evaluate | - | `Genotype.devOrdered_of_check` |
| G4 | proved | cannot-evaluate | cannot-evaluate | - | `Genotype.too_little_time_rules_out` |
| G5 | proved | cannot-evaluate | cannot-evaluate | - | `Genotype.haldane_rules_out` |
| E2 | empirical | cannot-evaluate | **violated** | **design-only** | `Empirical.weight_ratio_rules_out` |
| E3 | empirical | **violated** | cannot-evaluate | undecided-where-real-decided | `Empirical.no_aerobic_flight_above_ceiling` |
| E4 | empirical | cannot-evaluate | cannot-evaluate | - | `Empirical.stored_power_le` |
| E5 | empirical | **holds** (provenance) | cannot-evaluate | undecided-where-real-decided | fin-ratio record row |
| E7 | empirical | cannot-evaluate | cannot-evaluate | - | `Empirical.cannot_score_of_lethal_before` |

**`shared-with-real` violations: none. `design-only` violations: C7b and E2. `passes-what-real-fails`: none** - the
suspicious category the lead asked to have flagged in advance is empty, which is the reassuring outcome.

### The design's two violations, with numbers

| id | needed | available | what it actually says |
|---|---|---|---|
| **C7b** | implied mass exponent within 3 +/- 0.1 against the reference specimen | **2.651** (length ratio 0.218) | the design is not an isometric scaling of the reference flying fish |
| **E2** | exponent in [2.90, 3.02] | **2.651** | the same fact, in the empirical band |

**These two rows are one fact, not two failures**, and that fact is a **body-size mismatch**: a 4.4 cm, 1.06 g
adult zebrafish measured against a 20.3 cm, 60 g flying-fish specimen. The honest qualification, which the
pre-registration required: the real fish is `cannot-evaluate` on both rows **only because it IS the reference
specimen** (length ratio exactly 1), so these rows cannot test the animal they are calibrated on. The POST-HOC
control confirms it - given only the design's inputs, the real fish comes back UNDECIDED, not FAILS. So the
`design-only` label is correct by the pre-registered rule but weak in substance.

### The real fish's violation, which the pre-registration anticipated

| id | needed | available | shortfall |
|---|---|---|---|
| **E3** | 1.3465 W for level flight at 10 m/s | 0.0458 W aerobic ceiling | **x29.4** |

The real flying fish fails the gate. This is the expected and already-audited result
(`lean/AUDIT-FLYING-FISH.md`: 22 hold, 11 violated, 78 cannot-evaluate over 111 theorems), and it is why "the
design FAILS" does not distinguish the design from its target. **A FAILS verdict shared with the real animal is a
statement about our constraints.**

### Where the design is undecided and the real fish was decided

- **C9** (`vmin_rules_out`) - the minimum-speed bound, the single most relevant constraint for anything that
  glides. Real fish: **holds**. Design: cannot-evaluate, missing `finArea_m2`, `CLmax`, `airspeed_m_s`.
- **E3** - real fish: violated. Design: cannot-evaluate, missing airspeed and L/D.
- **E5** - the fin-ratio provenance row. Real fish: holds (0.687 sits inside 0.406-0.823). Design:
  cannot-evaluate, missing `fin_length_over_SL`. The design cannot even be placed against the measured record, let
  alone ruled out by it. Note this row is **provenance**: it may say a design is outside everything measured; it
  may never say a design is ruled out.

### How much of the design is Lean actually testing?

Pre-registered one-at-a-time ablation over the inputs the design specification supplies:

| input dropped | rows whose verdict moves |
|---|---|
| `SL_m` | C7b, E2 |
| `mass_kg` | C7b, E2 |
| `genotype_edits` | G1 |

**THE GATE IS WEAK, and the report says so as pre-registered.** All three supplied inputs do move a verdict, so
none is inert - but only **3 of 21 rows are decided at all**, and the two body inputs move the same single pair of
rows, which is one fact. What Lean is testing about this design amounts to: its body size against one reference
specimen, and whether Thr to Lys is reachable in one nucleotide substitution (`G1` holds: `ACA -> AAA`, minimum 1,
claimed 1). It is testing **nothing aerodynamic, nothing developmental, and nothing about the fins** - which is the
entire point of the design.

Two further findings from the gate worth recording:

- **`G2` cannot be evaluated** because the design specification never states which anatomical nodes its edits
  change. Our own gene map (`GENE_NODES`) links `slc43a2a` to exactly **one** node, `ZFA:0001161` (pectoral fin).
- **`kcnh2a` is not in our gene map at all.** Half of the design is a gene the project's own genotype map does not
  contain, so the closure check cannot see it even in principle.

---

## PART 4 - What the real experiment shows, kept separate from our model

Daane et al. 2021 (PMID 34534441, doi 10.1016/j.cub.2021.08.054), in the authors' own words:

> "Interestingly, double mutants between kcnh2alof/+ and lat4anr21/+ are viable and show specific, non-additive
> variation in proportion among fins: while all fins of kcnh2alof/+ are overgrown and all fins of lat4anr21/+ are
> shortened, the lat4anr21/+;kcnh2alof/+ fish show wild-type-sized medial fins, while the paired fins are overgrown
> (Figure 4)."

> "Surprisingly, the caudal fin of kcnh2alof/+;lat4anr21/+, while generally wild type in size, is hypocercal, with
> an elongated ventral lobe."

> "The nr21 mutant, however, does not have a statistically decreased body size (Figure 3B)."

> "The overall fin phenotype of the kcnh2alof;lat4anr21 fish is thus remarkably similar to that of flying fishes,
> suggesting the interaction between these two genes is sufficient to phenocopy this key innovation and organismal
> bauplan of flying fishes (Figure 4)."

What it achieved: **fin-type specificity** - paired fins overgrown while median fins stay wild-type-sized, which is
the non-additive result and the thing that resembles a flying fish; **regular segmentation maintained**, unlike the
`kcnk5b` overgrowth mutant; **no statistically decreased body size**, so the change is allometric rather than a
change in overall growth; and viability.

Its own limits: **every number is figure-only** (Figure 4B pectoral length, 4C caudal length, S2A/S2B segments);
no numeric value appears in the text, the legends, or any of the fourteen sheets of Data S1. The flying-fish
genetic overlap is at `lat4a` only, at a **different residue** (F326L in flying fishes, T200K in the allele). And
the non-coding and rate evidence sits on the paralogue `slc43a2b`.

**Does the real experiment already achieve what our design claims? Yes, entirely.** The design *is* Daane's double
heterozygote. The animal was built, scored and published in 2021, and its authors had already claimed the
flying-fish phenocopy. **That is a result about their experiment, not about us.** Our contribution in this
directory is the validation arithmetic - the 74, the 1, the 1.4 %, and the nine axes that cannot be scored - not
the organism.

---

## What could not be scored, and why

| part | could not be scored | reason |
|---|---|---|
| Part 1 | **9 of 10 morphological axes** | 3 figure-only on the design side; 2 qualitative on the design side; 6 with no flying-fish value; 5 with no zebrafish value (axes overlap) |
| Part 1, axis 1 | **pectoral fin length / SL**, the axis the design is about | no adult zebrafish value in any fetched source, **and** the design value exists only in Daane Figure 4B. Fails on both sides. |
| Part 2 | **accelerated non-coding elements** | sheets K and M are GO-term enrichment tables with no gene column and no element list. (a) = 74 is therefore coding-only, and the true number of differing loci exceeds it by an unknown amount. |
| Part 3 | **18 of 21 constraints on the design** | the design has no fin area, no lift coefficient, no airspeed, no L/D, no glide height or distance, no physiology, no fin ratio, no developmental claims and no substitution budget |
| Part 3 | **`G2` closure** | the design specification never says which anatomical nodes its edits change; and `kcnh2a` is absent from the project's gene map entirely |

---

## The joint result, and what follows

**Pair: `(NOT CLOSE / largely UNSHOWN, FAILS)`** - the pre-registered "far AND fails" cell, whose pre-registered
consequence is rule 1, drop the claim outright.

That reading overstates what this gate can support, and the pre-registration requires saying so rather than
reaching for the harshest available label:

1. The design's two violations are **one fact** - body size against a single reference specimen - and the real
   animal is untestable on those rows by construction.
2. **The real flying fish also FAILS the gate**, by a factor of 29 on E3. "FAILS" does not separate the design from
   the target.
3. **18 of 21 rows are cannot-evaluate** on the design. The gate is weak, and a weak gate's FAILS carries little
   information in either direction.
4. Part 1 is more accurately **unshown** than far: the number that would settle it sits in a figure we chose not to
   digitise.

So the honest position is **PREREG rule 2: drop the claim as UNSUPPORTED**, not disproved. There is no measured
phenotypic agreement on the defining axis, there is 1.4 % genetic agreement, and what remains is a constraint gate
that the design and the real animal both fail for unrelated reasons.

And the finding that should outlast this report: **the design's phenotypic claim was never ours to validate.** It
is Daane et al.'s published double heterozygote, and the single measurement that would let anyone score it - the
pectoral fin length of that fish - has never been published as a number.

## What a pass would not have established

That the design would develop; that a trans-heterozygote of two dominant alleles in a cyprinid is a flying fish;
that figure-only agreement is agreement; or that constraints which 78 of 111 theorems cannot even evaluate on the
real animal are a meaningful test of anything.
