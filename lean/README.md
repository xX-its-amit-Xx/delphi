# Lean 4 formalization of candidate laws of biology

This folder is a [Lake](https://github.com/leanprover/lean4/tree/master/src/lake) project that
machine-checks theorems from `math-bio-theorems/claims/key-claims.json`, following the
formal-verification convention in `BEST_PRACTICES.md` section 9: the Lean statement must encode
the stated law with its physical assumptions as explicit hypotheses, no `sorry`, no added axioms.

| module | claim | main theorem | status |
|---|---|---|---|
| `Delphi/Kimura.lean` | `kimura-substitution-rate` (Kimura 1968, doi:10.1038/217624a0) | `Delphi.neutral_substitution_rate` | compiles, 0 sorry, standard axioms only |
| `Delphi/Kimura.lean` | `kimura-fixation-probability`, neutral case | `Delphi.NeutralChain.fixedBy_tendsto` | compiles, 0 sorry, standard axioms only |
| `Delphi/Fisher.lean` | `fisher-ftns` (Fisher 1930, partial-change form; haploid locus) | `Delphi.fisher_fundamental_theorem` | compiles, 0 sorry, standard axioms only |
| `Delphi/MaynardSmith.lean` | `maynardsmith-twofold-cost` (Maynard Smith 1978) | `Delphi.twofold_cost_of_sex` | compiles, 0 sorry, standard axioms only |

Each module's header comment states exactly which assumptions are inside the kernel and which
are left outside. Read that before citing the theorem.

## Reproduce from a clean checkout

```sh
# 1. Lean toolchain manager (one-time). On Windows download elan-init from
#    https://github.com/leanprover/elan/releases and run: elan-init.exe -y --default-toolchain none
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh -s -- -y --default-toolchain none

# 2. Fetch Mathlib (pinned in lake-manifest.json) and its prebuilt cache (several GB; needs ~8 GB disk).
cd lean
lake exe cache get

# 3. Build and audit. Exit code is non-zero if anything fails, has a sorry, or uses a non-standard axiom.
lake build
lake env lean Delphi/Audit.lean

# 4. Regenerate the sub-dashboard's data file (runs steps 3 and parses the output).
cd .. && node lean/report.mjs
```

The toolchain version is pinned in `lean-toolchain`; elan installs it automatically on the first
`lake` call. On the hackathon box the toolchain lives in `C:\Temp\elan` and `lean/.lake` is a
directory junction to `C:\Temp\delphi-lean-lake`, because the D: drive was nearly full; neither
location matters for reproduction.

## Layout

- `Delphi/Kimura.lean`: neutral absorbing Markov chains, the neutral fixation probability with an
  explicit geometric error bound, the Wright-Fisher instance (binomial sampling, proved via
  Mathlib's Bernstein polynomials), and the substitution-rate theorem.
- `Delphi/Fisher.lean`: Fisher's fundamental theorem for a haploid locus with fitnesses held
  fixed: the one-generation change in mean fitness equals the variance in fitness over the mean.
- `Delphi/Audit.lean`: `#print axioms` for every headline theorem.
- `report.mjs`: builds, audits, and writes `dashboard/public/t/lean/lean.json`.

## Rules followed

- The theorems are about the model. Whether organisms satisfy the model's assumptions is an
  empirical question, handled by claim tests, not here.
- Nothing here is published as a nanopub. When it is, the law gets a `delphi:Concept`
  nanopub carrying the Lean source and a commit-pinned link to this module, and
  `delphi:leanVerified true` only because `report.mjs` reports zero sorry and standard axioms.
- Whether the Lean statement faithfully renders the paper's claim is for an assessor from a
  different provider than the one that wrote the Lean (this module was written by Claude).

## Mutation evidence and nanopub records

- `node lean/mutate.mjs` writes `lean/mutations.json`: six deliberate changes to theorem statements
  (or to a hypothesis of the model) in copies of the modules, each of which the compiler must reject,
  plus a control run of each unmodified module through the same command. `report.mjs` folds the
  result into `lean.json`, and the sub-dashboard shows it under "Try to break it".
- `node lean/nanopubs/build.mjs [--commit <hash>]` writes unsigned Delphi nanopub drafts to
  `lean/nanopubs/unsigned/` (law concept with evidence item, proof scope, rubric, one assessment per
  claim per assessor). See `lean/nanopubs/README.md` for the checks and the publishing holds.
- Why the mutants change the **statement**, not the proof: deleting a tactic only shows the proof
  script is load-bearing. Changing the constant in the conclusion (k = 2 mu, 1/(M+1), 3x odds,
  no division by mean fitness) or deleting a model hypothesis (the chain's escape condition) tests
  whether the theorem is about the law or merely about its names; a proof that survived such a
  change would be arithmetic dressed in the law's vocabulary. All six were rejected at the changed
  line, and the unmodified modules passed through the same command. Details in
  `lean/nanopubs/README.md`.

## Flying-fish budget: where Lean stops

`Delphi/Favored.lean` extends the Kimura module for one question from the hub: did the flying-fish lineage
have time for Darwin's "perfectly winged animals" (Origin, ch. VI)? The honest answer is **inconclusive**, and
the files are arranged so that the reason is visible.

**Kernel-checked** (`#print axioms`: standard only; three statement mutants rejected): in any absorbing chain
on `0..M` copies whose expected copy number never decreases (neutral, or selection for the mutant), a lineage of
`i` copies fixes with probability at least `i/M` (`FavoredChain.fixationProbability_ge`); Wright-Fisher sampling
with relative fitness `1+s`, `s >= 0`, is such a chain (`wrightFisherSelection`); and for the defined expected
count `M mu u T` the bounds `mu T <= M mu u T <= M mu T` hold. The neutral count is `mu T` for every `M`.

**Not kernel-checked**: that the expected count is the right quantity (it is Kimura's 1968 definition, so
independence of mutant fates, constant `M`, `mu`, `s` and non-overlapping generations are assumed by it); and
every number. `lean/bound/parameters.json` names a source for each parameter (PBDB first appearance
48.07-56 Ma; FishBase generation time 0.6-1.0 y for one species; herring and stickleback pedigree
mutation rates 1.1e-9 to 4.83e-9; a 1.04 Gb draft genome; one mtDNA Ne estimate above 1e9 for *Exocoetus
volitans*). `lean/bound/compute.mjs` applies the theorems' formulas and writes `lean/bound/result.json`,
folded into `lean.json` as `bound`.

**Result**: 4.81e+07-9.33e+07 generations; neutral budget 0.053-0.451 substitutions per site
(5.50e+07-4.69e+08 genome-wide), independent of `N` by the theorem; adaptive floor `mu_f T` with `mu_f`
undefined; ceiling `2 N mu T` vacuous. The denominator, "substitutions a wing requires", is not a defined
quantity, and no figure is invented. Kimura's selected-fixation formula `u ~ 2s` is **not** formalised; the
module proves only that selection for a mutant cannot make fixation rarer than drift does.

The record `lean/nanopubs/unsigned/bound-exocoetidae-substitution-budget.trig` (a `delphi:Hypothesis`, since
no source states it) cites the three law records, the PBDB dataset record, the literature DOIs, and the
organism thread's blueprint record via `skos:related`, with a comment saying the two are independent
statements about the same taxon. `lean/bound/links.json` holds that link; the lean thread owns it.
