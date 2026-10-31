# Pre-registration: how close is the DESIGNED organism to the REAL flying fish?

Design-validation thread, written 2026-10-31, **before any metric was computed**. Follows the form of
`physics/sim/PREREG.md`. The SHA-256 of this file is in `design-validation/PREREG.sha256`, written in the same
minute this file was finished and before the first number was produced. Every later deviation goes in
`design-validation/RUNS.md` against the run it followed, with its reason. No threshold in this file may be
changed after a number has been seen; a changed threshold is a deviation and is named as one.

## What was read before this file was hashed, and what was not

Read before hashing (schemas and provenance only, to make the formulas below precise):
- `physics/sim/PREREG.md`, `physics/sim/RUNS.md` (the form to follow).
- `genotype/compare-2x2.json` in full, which is the design specification itself, and which states the design's
  phenotype as `null` with `value_status: "FIGURE PANELS ONLY"` on every axis. **This is the specification, not a
  result**: the design was already known to carry no numeric phenotype before this pre-registration was written, and
  the rules below are written in that knowledge. It is stated here so no reader thinks the "cannot score" verdicts
  in Part 1 were discovered and then accommodated.
- `genotype/cache/daane2021_fin_ratios.json` (the reference group summary: flying fish n=49, pectoral/SL median
  0.687, range 0.406-0.823), `anatomy-model/zebrafish/manifest-adult.json`,
  `development/zebrafish/trajectory.mjs` (confirming `finLength_SL: null`), `physics/length-weight.csv`,
  `physics/glide-data.csv`, `lean/AUDIT-FLYING-FISH.md`.
- `lean/eliminate/browser-check.mjs` exports, `lean/eliminate/browser-check.test.mjs`, and the output of
  `check({})` on an EMPTY design: the 21 constraint ids and the input name each one needs. No design and no real
  fish was passed through `check` before this file was hashed.
- The SHEET NAMES and the first three rows (header area) of `genotype/cache/daane2021_data_s1_mmc2.xlsx`, to name
  the columns the Part 2 formulas use.

Not read before hashing: **no data row of sheets G, I, J, K or M**, so no count in Part 2 was known. No row of
`check()` on the design or on the real fish. No gene-set file of Xu et al. 2021.

## The three organisms, fixed

| role | organism | source of its values |
|---|---|---|
| REFERENCE (target) | flying fishes, Exocoetidae | `genotype/cache/daane2021_fin_ratios.json` (Daane et al. 2021 Data S1A, 49 museum specimens); `physics/glide-data.csv` (Park and Choi 2010 Table 1 L3, Table 2); `physics/length-weight.csv`; `physics/allometry.json`; `lean/AUDIT-FLYING-FISH.md` |
| BASELINE | zebrafish, *Danio rerio* | `anatomy-model/zebrafish/manifest-adult.json`; `development/zebrafish/trajectory.mjs` |
| DESIGN | the "winged zebrafish" | `genotype/compare-2x2.json` panel B: germline trans-heterozygote `lat4a nr21/+` (ZFIN `slc43a2a`, allele `dmh26`, T200K) with `kcnh2a lof/+` (the longfin `dt2` chromosome-2 inversion). Its real experimental counterpart is Daane et al. 2021's own double heterozygote. |

The design's measurements exist only in figure panels (Daane 2021 Figure 4B, 4C, S2A, S2B). **Nothing is digitised
from a plot.** Where a value exists only in a figure, the parameter is scored "cannot score (figure-only)". This
rule is fixed now and is not a reaction to a result.

## PART 1 — phenotypic distance

### The axes, named now

Every morphological axis this project holds a flying-fish value for is listed here, before scoring. The list may
not be extended later to add an axis that happens to score well.

1. pectoral fin length / SL
2. caudal fin length / SL
3. median (dorsal and anal) fin length / SL
4. lower caudal lobe / SL (hypocercality)
5. lepidotrichial segment length
6. pectoral fin ray count
7. body mass vs length exponent *b*
8. lateral fin area vs SL exponent
9. wing loading vs SL exponent
10. maximum body depth / SL

### Formulas

For an axis where all three organisms have a number, with `Z` = zebrafish, `F` = flying-fish **median**,
`D` = design:

- **Path fraction** `f = (D - Z) / (F - Z)`. `f = 0` is the untouched zebrafish, `f = 1` is the flying-fish median.
  Undefined, and reported as such, if `F = Z`.
- **Residual** `r = F - D`, in the axis's own units, with its sign, and `r_rel = r / F`.
- **Inside the measured range**: `INSIDE` iff `min(F_obs) <= D <= max(F_obs)` over the 49 flying-fish specimens,
  else `OUTSIDE`, with the range printed beside it.

### Per-axis thresholds, fixed

| verdict | condition |
|---|---|
| PASS | `0.8 <= f <= 1.2` **and** INSIDE the measured flying-fish range |
| PARTIAL | `0.5 <= f < 0.8`, or (`f >= 0.8` but OUTSIDE the range) |
| FAIL | `f < 0.5`, or `f > 1.5` |
| CANNOT SCORE | any of `Z`, `F`, `D` has no number, with the reason named and the organism that is missing it named |

### The scoreability count, which is a result in its own right

`n_scored` and `n_cannot_score` out of the 10 axes, each "cannot score" carrying its reason. **If
`n_scored = 0` the phenotypic part of this validation returns NO RESULT, and the report says the design's
phenotype is unmeasured rather than that it is close.** A headline single score is forbidden; per-axis only.

### What counts as the design FAILING Part 1

Any one of:
- `n_scored >= 3` and the median `f` over scored axes is `< 0.5`;
- the pectoral fin ratio axis specifically scores FAIL;
- `n_scored = 0`, which is not "far" but "unshown", and which the report must state as a failure of the
  validation to be possible, not as a pass.

### A known hard limit, carried as a gap, not filled

No fetched source gives an adult wild-type zebrafish pectoral fin length / SL;
`development/zebrafish/trajectory.mjs` returns `finLength_SL: null` with the note "no numeric wild-type pectoral
fin length/SL found (Daane 2018 plots it only)". **No value will be invented, interpolated from relatives, or
digitised for this axis.** It is carried as a gap on the BASELINE side, which is one of the two reasons axis 1 can
fail to score; the other is the design's figure-only measurement.

## PART 2 — genetic distance (the deciding part)

### Sources

- LOCAL: `genotype/cache/daane2021_data_s1_mmc2.xlsx`, sheets **G** (convergent amino-acid substitutions),
  **I** (glider relative-evolutionary-rate genes), **K** and **M** (accelerated conserved non-coding elements),
  **J** (phyloP).
- The real flying-fish gene set, for context on the denominator only: Xu et al. 2021,
  doi `10.3389/fgene.2021.695700`, PMC8294118, *Hirundichthys speculiger*, 23,611 predicted genes, BioProject
  PRJNA714815, annotation at figshare doi `10.6084/m9.figshare.14600634.v1`.

### (a) loci known to differ in flying fishes — the denominator

`A_loci` = the number of DISTINCT gene-level loci in the union of:
- the genes carrying convergent amino-acid substitutions in sheet G;
- the genes with a glider relative-evolutionary-rate signal in sheet I;
- the genes associated with an accelerated conserved non-coding element in sheets K and M, where the sheet
  provides an associated or nearest gene.

Reported beside it, never merged into it: the raw ROW counts of each sheet separately (substitutions, RER genes,
accelerated elements in K, in M), because an element count and a locus count are different things. Sheet J
(phyloP) is reported as supporting evidence for the elements of K and M and is **not** added to `A_loci`, to avoid
counting the same elements twice.

If a sheet has no gene-symbol column, it contributes its element count only, it does not contribute to `A_loci`,
and that is recorded as a named gap rather than dropped.

### (b) loci the design actually changes, intersected with (a)

The design edits exactly **2** genes: `lat4a` (= ZFIN `slc43a2a`) and `kcnh2a`. `B = |{design genes} ∩ A_loci|`.

Matching is case-insensitive on gene symbol with this synonym table, fixed now:
`lat4a ≡ slc43a2a ≡ slc43a2 ≡ LAT4A ≡ SLC43A2`; `kcnh2a ≡ kcnh2 ≡ KCNH2`; also matched as a substring only when
the surrounding characters are not alphanumeric, and every claimed match is confirmed by quoting its row. A
near-miss (a paralogue, or the same family but a different member) is reported as a NEAR MISS and does **not**
count toward `B`.

### (c) the fraction reproduced

`C = B / A_loci`, reported plainly to three significant figures whatever it is, with its two inputs beside it.

| reading | condition | fixed now |
|---|---|---|
| substantial | `C >= 0.10` | the design reproduces a tenth or more of the known flying-fish-specific change |
| token | `0.01 <= C < 0.10` | real overlap at one or two loci, negligible as a fraction |
| negligible | `C < 0.01` | **the headline sentence of the report must say the design reproduces essentially none of the known flying-fish-specific genetic change** |

A separate, weaker statement is also pre-registered because it is the one the design could honestly win: whether
`B >= 1`, i.e. whether at least one edited gene is a genuine, named overlap with the convergent flying-fish
evidence. `B >= 1` with `C < 0.01` is the expected shape of a trait-targeted design and is to be reported as
exactly that: a hit on the right locus and a miss on the genome.

### (d) the converse

`D_off = 2 - B`: the number of edited genes NOT known to differ in flying fishes, each named.

### What counts as the design FAILING Part 2

`C < 0.01`. This is pre-registered as a FAIL of the claim "the design reproduces the flying fish genetically",
and simultaneously NOT a fail of the claim "the design targets a locus the flying fish also changed", which is
what `B >= 1` measures. Both are reported.

## PART 3 — the Lean constraint GATE (scored independently of Parts 1 and 2)

Added at the project lead's instruction before any computation, while this file was still unhashed.
`lean/eliminate/browser-check.mjs` `check(design)` returns 21 rows (ids fixed by the empty-design probe, recorded
here before any design was run): `C9 C7b C2a C8e C9c C8c C15 C16 C14 C13 C10 G1 G2 G3 G4 G5 E2 E3 E4 E5 E7`.

### Gate classification, fixed

| verdict | condition |
|---|---|
| **PASSES** | no row returns `violated` **and** no row returns `cannot-evaluate` |
| **FAILS** | at least one row returns `violated`. Every one is named with its `needed` vs `available` numbers, its theorem and its module |
| **UNDECIDED** | no row `violated`, but one or more return `cannot-evaluate`. Every one is named with its missing input |

**UNDECIDED IS NOT A PASS.** A design that cannot be evaluated has not been shown to hold. This is pre-registered
so that a wall of missing inputs can never be read as a clean sheet.

Rows whose `verdictKind` is `provenance` (E5, the fin-ratio record row) can say a design is outside everything
measured; they may never be read as ruling it out, and the report states which rows are provenance.

### The same gate on the real flying fish, and the trap it closes

`check()` is run on the REAL flying fish (the Park and Choi 2010 Table 1 model L3 specimen, which is
`REFERENCE` in the module) under identical options, and the two verdicts are printed side by side, row by row.
This is pre-registered because the real animal is already known NOT to pass everything:
`lean/AUDIT-FLYING-FISH.md` records 22 hold, 11 violated, 78 cannot-evaluate over the 111 theorems, the violations
coming from isometry hypotheses that Davenport's within-species exponents break (fin area 1.834 vs 2, wing loading
1.236 vs 1). Therefore, fixed now:

- A row the DESIGN fails that the REAL FISH also fails is a **limitation of the constraint**, labelled
  `shared-with-real`, and is not counted against the design.
- A row the DESIGN fails that the REAL FISH passes is a **design-specific failure**, labelled `design-only`, and
  is the only kind of violation that counts against the design.
- A row the DESIGN **passes that the real fish fails** is **SUSPICIOUS**, labelled `passes-what-real-fails`, and
  is to be flagged and explained, never celebrated: the most likely explanation is that the design was handed
  fewer or softer inputs than the real specimen, not that it is a better flying fish.

### How much of the design Lean actually tests

Pre-registered method, run once: a one-at-a-time ablation. For each input key supplied to `check` for the design,
re-run `check` with that key removed and record which row ids change verdict. An input that changes no verdict is
reported as **not tested by Lean**. The report states the count of design parameters the gate actually depends on
out of the number supplied, and **if the gate depends on two or fewer, the report must say the gate is weak.**

## The joint result: a PAIR, never one score

The result is reported as `(phenotypic closeness, Lean verdict)` and never merged. All four readings are written
out here in advance so none of them can be presented as the expected one:

| reading | meaning, fixed now |
|---|---|
| close AND passes | the strong result: the design matches the target shape and breaks no constraint |
| close AND fails | the design copies the shape but breaks a physical constraint: shape-matching is **not sufficient**, and our method is the thing indicted |
| far AND passes | **Lean is too permissive here**: the constraints do not pin down a flying fish, and the gate's passing is weak evidence about the design |
| far AND fails | the design is simply wrong |

"Close" means Part 1 did not FAIL by its own criterion above; a Part 1 of `n_scored = 0` is neither close nor far
and is reported as **unshown**, which cannot be paired into "close".

### Which outcome makes us drop the claim that we can design an organism

Fixed now, before any number:

1. **far AND fails** — drop the claim outright.
2. **Part 2 `C < 0.01` together with a Part 1 that is `unshown` (`n_scored = 0`)** — drop the claim as
   *unsupported*: there would then be no measured phenotypic agreement at all and essentially no genetic
   agreement, and what remains is a constraint gate that the design shares with the real animal.
3. **close AND fails with at least one `design-only` violation** — drop the stronger claim that shape-matching
   designs a viable organism; keep only the narrower claim about the trait.
4. A gate of UNDECIDED never rescues any of the above, and never by itself establishes the claim.

## PART 4 — what the real experiment shows, kept separate

Reported from the authors' own words in `genotype/compare-2x2.json` panel B and its quoted sources (Daane et al.
2021, PMID 34534441), with no model of ours in it: fin-type specificity (paired fins overgrown, medial fins
wild-type-sized), caudal generally wild type in size but hypocercal, regular segmentation maintained, no
statistically decreased body size, and that the numbers are figure-only. Fixed now: **if the real double
heterozygote already achieves what our design claims, the report says so, and says it is a result about Daane's
experiment and not about us.**

## Rules that hold throughout

- Cite only what was fetched in this thread or read locally. Every call is logged in
  `design-validation/calls.json`. No personal identifiers in any request.
- **No bird data.** Class Aves is this project's frozen holdout. If a needed value exists only for birds, the
  report says "unavailable (holdout)".
- Nothing is digitised from a figure.
- No favourable metric invented after seeing a result. Any metric not in this file that appears in the report must
  be labelled `POST-HOC (exploratory)` in both `RUNS.md` and the report, and may not appear in the headline.
- Writes are confined to `design-validation/` and `C:\Temp\dval\`. Nothing is committed.

## What a pass would not establish

That the design would develop, that a trans-heterozygote of two dominant alleles in a cyprinid is a flying fish,
that figure-only agreement is agreement, or that constraints which 78 of 111 theorems cannot even evaluate on the
real animal are a meaningful test of anything.
