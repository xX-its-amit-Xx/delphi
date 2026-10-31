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

## Blueprint certificates and a morphological law

**Blueprint well-formedness** (`Delphi/Blueprint.lean`, certificates in `Delphi/Certificates/`, tooling and
the full account in `lean/blueprint/README.md`). For the organism thread's generated anatomies: a generic
theory that a decidable checker implies acyclicity of `part_of`, transitivity of its closure, reachability of
every term from the body root, and that the pinned taxon statements exclude nothing; then, per emitted
blueprint, Lean literals and `decide +kernel`. The flying-fish certificate pins 536 terms, 674 edges, 1390
`never_in_taxon` and 5435 `in_taxon` statements, and fixes the distinct counts per level (13 / 67 / 198 / 257).
Structural only: it does not say the fish is real, the anatomy correct, or the ontology right.

**Thompson's cube law** (`Delphi/Thompson.lean`, claim `thompson1917-ch03-07`): an exact cube law
`W = k L^3` has log-log exponent exactly 3 and weight ratio `(L2/L1)^3`; a measured exponent other than 3
refutes the exact law on that interval (`not_cubeLaw_of_exponent_ne_three`). The claims thread measured
2.74 (males) and 2.86 (females) on NHANES age-bin means, 2.76 on pooled individuals, and an earlier run
found 2.10 at 0-2 years, 3.10 at 10-20 years and 2.41 pooled 0-19; `report.mjs` reads those from
`claim-tests/thompson-growth-form/thompson1917-ch03-07` and the page shows them against 3. Thompson's
"mainly (though not wholly)" and the test's tolerance band are outside the theorem.

## Constraints and the candidate ledger: what the theorems can rule out

A theorem does not settle an open problem; it eliminates **candidates**, proposed answers or designs that
commit to quantities the theorem forbids. `lean/eliminate/build-constraints.mjs` writes
`lean/constraints.json`: ten constraints from the seven formalised entries, each with the theorem, the
lemma that performs the elimination (`Delphi/Constraints.lean`), its axioms, the property constrained, the
relation with every symbol named and its unit, the inputs a candidate must commit to, the model assumptions
it must accept, the two-column proof scope and the assessor's faithfulness verdict. `lean/eliminate/eliminate.mjs
<candidates.json>` checks candidates with exact rational arithmetic and returns, per constraint, **eliminated**
(the violated relation with the numbers), **consistent** (not ruled out; never "feasible") or **cannot rule**
(the missing input or assumption). For every elimination it generates a theorem in
`Delphi/Certificates/Eliminations.lean` instantiating the lemma with the candidate's numbers and discharging the
arithmetic by `norm_num`, compiles it, and records whether the kernel accepted it. See `lean/eliminate/README.md`
for the schema and the limits (Galileo's square-cube argument is covered on the mass side only; strength scaling
as `L^2` is not formalised).

## Scaling laws from the physics thread (R2-R8): strength, flight, Froude

`Delphi/Scaling.lean` formalises the statements in `physics/FORMAL-STATEMENTS.md`, every law a **named
hypothesis** on functions of one linear dimension (`CubeLaw` for mass and weight, `AreaLaw` for lifting area
and load-bearing section, `MusclePowerLaw` for Thompson's muscle premise) and `σ`, `ρ`, `C_L,max`, `L/D`, `Fr`
as constants "the same for every member of the family". Proved: the area law and wing loading `∝ L` (R2, R3);
**strength `∝ L^2`** with `F_break = σ A`, the safety factor `F_break/W = σ k3/(k1 L)` and the size `L_max =
σ k3/(k1 n)` above which a member cannot carry `n` body weights (R7: the missing half of Galileo's square-cube
argument, now an elimination lemma C8c); the exact minimum-speed bound `v ≥ sqrt(2W/(ρ S C_L,max))` for
lift-supported flight and its `√L` scaling (R4); power required at `v_min ∝ L^3.5` (R5); power available
`∝ L^3` **only under** the muscle premise, which is carried as a hypothesis and never asserted (R6); the
existence of a size above which power required exceeds power available, with no value supplied (Thompson
ch. II, "a bird as large as a man could not fly"); and Froude's `√L` (R8). Nine statement mutants (exponents
changed, the `C_L ≤ C_L,max` hypothesis dropped, the safety factor made constant) must all be rejected.

Honesty notes, stated in each record: isometry is measured to fail within one flying-fish species (Davenport
1992); `C_L,max`, `L/D` and `p` are assumed constant; the physics thread found one specimen inside its own
`v_min` envelope but could not test the `√(W/S)` scaling, so these are statements about the model, not
confirmed facts; no number from `physics/results.json` appears in any theorem. R9 adds bending via the section modulus
(`bendingStress = F l / Z`): stress `~ L` with a size limit under a body-like load, size-independent with no limit
under a sheet-like load, the load family being the empirical fork a candidate must commit to. The walking (pendulum)
route of `thompson1917-ch02-10`, elastic similarity and dynamic loads are not formalised.
