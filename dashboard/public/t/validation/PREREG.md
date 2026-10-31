# Pre-registration: simulations that check three Lean results

Written 2026-10-31, about 18:25 UTC, by the `validation` thread, before any simulation code was written or run. The
simulation script (`validation/sim/run.py`) records the SHA-256 of this file in its output. If this file changes after
the run, the hash will not match.

**Scope.** These are simulations of idealised mathematical models. They check that the theorems behave as stated on
the models they describe. They say nothing about real organisms.

## The three results under test

These are taken from `lean/constraints.json` and the Lean sources.

| id | Lean | statement under test |
|---|---|---|
| T1 | `Delphi.Kimura` (`fixationProbability_eq`, `wrightFisher_fixation_one`) | Neutral Wright-Fisher on `M` gene copies: a lineage starting at `i` copies fixes with probability exactly `i/M`. |
| T2 | `Delphi.Favored` (`fixationProbability_ge`, `wrightFisherSelection_fixation_one_ge`) | Wright-Fisher with the mutant at relative fitness `1+s`, `s >= 0`: the next-generation count is `Binomial(M, (1+s) i / (M + s i))`, and fixation from `i` copies has probability at least `i/M`. |
| T3 | `Delphi.MaynardSmith` (`twofold_cost_of_sex`, `_n`) | Equal fecundity `f`, 1:1 sex ratio in sexual broods, males contribute nothing, discrete generations: the odds of asexual to sexual females double each generation, so the per-capita daughter output of asexual females is twice that of sexual females, and `f` cancels. |

## Design

Seeding:

- Master seed `20261031`. Each cell gets its own stream from `numpy.random.SeedSequence(20261031).spawn(...)`, in the
  order the cells are listed below.
- The script writes every cell's spawn key, the parameters, the counts and the verdict to
  `validation/sim/results.json`.
- To reproduce: `python validation/sim/run.py`, using numpy and scipy, with 2 threads (`OMP_NUM_THREADS=2`).

Compute is capped at about 30 CPU-minutes.

### A. Neutral Wright-Fisher (tests T1)

The grid has 15 cells:

- `M` in {10, 50, 200, 1000}.
- `i` in {1, M/10, M/2, M-1}. When `M/10 = 1` (that is, `M = 10`), that value is dropped, leaving 3 values for that `M`.

Each cell runs `R = 40,000` independent replicates. Every generation, the copy number is redrawn as
`X' ~ Binomial(M, X/M)`, until it reaches 0 or `M`. Each replicate is capped at `200 M` generations. A replicate that
has not resolved by then counts as not fixed, and the number of such replicates is reported.

**Pass criterion A.** The value `i/M` must lie inside the two-sided Clopper-Pearson interval for the fixation fraction,
at confidence `1 - 0.01/15`. That is a family-wise alpha of 0.01, Bonferroni-corrected over the 15 cells. T1 passes if
every cell passes.

### B. Wright-Fisher with selection `s >= 0` (tests T2)

The grid has 21 cells:

- `s` in {0.001, 0.01, 0.1}.
- `M` in {10, 50, 200, 1000}.
- `i` in {1, M/10}. When `M/10 = 1`, that value is dropped.

Each cell runs `R = 40,000` replicates, with `X' ~ Binomial(M, (1+s) X / (M + s X))` and the same cap as in A.

**Pass criterion B.** The one-sided upper Clopper-Pearson bound on the fixation fraction, at confidence `1 - 0.01/21`,
must be at least `i/M`. In other words, there must be no significant evidence that fixation falls below `i/M`. T2
passes if every cell passes.

**Negative controls (power check), not part of T2.** Two cells where the theorem's assumption fails (`s < 0`):

- `s = -0.01`, `M = 200`, `i = 20`
- `s = -0.001`, `M = 200`, `i = 20`

Same `R` and test. The expectation is that both fall significantly below `i/M`, which shows the test can detect a
violation. If they do not, criterion B is too weak to mean anything, and the report will say so.

### S. Simulator check (applies to A, B and the controls)

For every cell, compute the exact fixation probability of the same finite Markov chain. This is done by solving
`(I - Q) h = r` on the transient states, with binomial transition probabilities from `scipy.stats.binom`.

- **Pass criterion S.** The exact value lies inside the two-sided Clopper-Pearson interval at confidence `1 - 0.01/38`,
  where 38 is the total number of cells (15 + 21 + 2).
- **Exact check of T1.** For the A cells, the report also gives `|exact - i/M|`. It is expected to be below `1e-9`.
- **Descriptive comparison.** For the B cells, Kimura's diffusion approximation `(1 - e^{-2 s i}) / (1 - e^{-2 s M})`
  is reported alongside, with no pass criterion.

### C. Sexual versus asexual lineages at equal fecundity (tests T3)

The model is individual-based, with females only counted as parents.

- Each generation, every female produces offspring. The number is either fixed at `f`, or drawn as `Poisson(f)`.
- An asexual female's offspring are all daughters.
- A sexual female's offspring are each a daughter with probability 1/2, which gives a 1:1 primary sex ratio.
- Males contribute nothing.
- Population regulation: the next generation's `K` females are drawn uniformly without replacement from all daughters
  (or all of them if there are fewer than `K`). This is equal viability for both types.

The grid has 12 cells:

- `K` in {1,000 (with `q0 = 0.1`), 100,000 (with `q0 = 0.01`)}.
- `f` in {2, 4, 10}.
- Fecundity mode in {fixed, Poisson}.

Each cell runs 200 replicates of up to 8 generations. A replicate stops early if the asexual fraction leaves (0, 0.95).

Primary metric, `G`:

- `G` is the pooled per-capita daughter ratio,
  `(sum of asexual daughters / sum of asexual mothers) / (sum of sexual daughters / sum of sexual mothers)`, pooled over
  every generation and replicate in a cell.
- Its standard error comes from 2,000 bootstrap resamples over replicates.

**Pass criterion C1.** The value 2 must lie inside `G ± z * SE`, where `z` is the two-sided normal quantile at
`1 - 0.01/12`.

Secondary metric (only for the `K = 100,000` cells):

- Fit a per-replicate least-squares slope of `ln(odds of asexual females)` against generation, using the regulated adult
  females.
- Take the mean slope across replicates, with SE equal to sd divided by √(replicates).

**Pass criterion C2.** The value `ln 2` must lie inside `mean ± z * SE`, at confidence `1 - 0.01/6`. The `K = 1,000`
cells are reported descriptively, because the logit of a sampled fraction is biased at small `K`.

**Variants (expected to differ from 2).** These show that the simulation responds to the theorem's assumptions and
definitions. Each runs at `K = 100,000`, `q0 = 0.01`, `f = 4`, Poisson fecundity, 200 replicates. Pass means the expected
value lies inside the C1-style interval at `1 - 0.01/3`.

| variant | what changes | expected `G` |
|---|---|---|
| V1, definition | Count all offspring, sons included, not daughters. | 1 |
| V2, assumption | Males double the sexual female's fecundity (`f_sex = 2f`). | 1 |
| V3, assumption | Sexual broods are 2/3 daughters. | 1.5 |

## What counts as a disagreement, and how it will be diagnosed

A disagreement is any A, B, C1 or C2 cell that fails, any S failure, a negative control that is not detected, or a
variant that misses its expected value.

Each one gets one of three diagnoses:

1. **The simulation is wrong.** The simulation disagrees with the exact chain value (an S failure), or with an
   analytic expectation the code should meet. In that case, look for a bug and report it. The rerun with the fix is
   reported next to the original, and the original is not deleted.
2. **The theorem's assumptions do not match the simulation.** For example, the parameters fall outside `s >= 0`, the
   generation cap truncates runs, or the population size is finite where the theorem assumes an infinite population.
3. **A definition differs.** The quantity simulated is not the quantity the Lean statement is about. For example,
   offspring versus daughters, or fixation by time `t` versus eventual fixation.

The pass criteria above are fixed. If the run shows a criterion was badly chosen, the report says so, and the criterion
is not changed after the fact.
