# lean-mutation — does the formal layer reject what is false?

A proof assistant that accepts everything you give it is not a proof assistant. *"61 laws registered, 73
Lean-checked theorems"* measures productivity, not soundness — so this benchmark asks the other question:
change a law into something false, and see what happens.

```
node benchmarks/lean-mutation/run.mjs        # needs the Lean toolchain and a built Delphi library
```

Nothing under `lean/` is written. Mutants go to a scratch directory and are compiled with
`lake env lean` from the project.

## Why a kill rate would be worthless

The obvious benchmark — mutate a theorem, check Lean rejects it, count the kills — reports close to 100 %
on almost any formal library, and the number means nothing. Changing a **statement** breaks its **proof**,
and Lean then rejects the mutant for a reason that has nothing to do with whether the mutant is true.
*"The proof script no longer typechecks"* is not *"the claim is false"*.

So every mutant is classified three ways, and only the first is evidence:

| outcome | meaning |
|---|---|
| **REFUTED** | the mutant's **negation is provable** — definitively false, and rejecting it was right for the right reason |
| **UNPROVEN** | nothing settled it either way. Consistent with the mutant being false, **not evidence of it** |
| **SURVIVED** | the mutant **is provable** — the mutation did not change what the statement claims |

A SURVIVED mutant is not a Lean failure. Lean behaves correctly in every case. It is a failure of the
**statement** to say what its author believed it said — the only interesting bug in a formalisation, and
the one no amount of proof checking can catch.

## The result

```
sanity (the ORIGINAL statement, by its own theorem): compiles

finRatio_outside / lower-bound-STRENGTHENED   -> REFUTED           (negation proved)
finRatio_outside / both-bounds-widened        -> control_survived  (tailored proof)
weight_ratio_band / band-narrowed             -> UNPROVEN

{ "REFUTED": 1, "control_survived": 1, "UNPROVEN": 1 }
```

No non-control mutant survived. Two targets, three mutants — **a method and a first result, not a
coverage figure** over the 48 laws that carry a Lean theorem.

The sanity check matters as much as the mutants: the original statement is compiled first, via its own
theorem, so that a failing mutant cannot be a failing build.

## Two mistakes this benchmark made, both caught by the control

The control is a deliberately **weakened** mutant that must survive. A benchmark where every mutant dies
is not measuring the library, it is measuring whether mutants compile.

**1. The mutation ran the wrong way.** The first mutant moved a bound from 0.406 to 0.5 and expected a
refutation. But that bound sits in a disjunct — `r < 0.406 ∨ 0.823 < r` — so widening it *weakens* the
conclusion and the mutant stays true. Lean said so precisely: the attempted counterexample, 0.45, is
**inside** the measured band, and the goal came back `0.406 ≤ 0.45 ⊢ False`. Tightening the bound to 0.3
is the mutation that can be false, and 0.35 refutes it.

**2. The harness was too weak to tell "false" from "I could not prove it."** The control came back
UNPROVEN, because a generic tactic list cannot prove a disjunction over the reals. Without it, three
UNPROVENs would have been reported as a clean sweep. Mutants may now carry their own proof attempt.

Both mistakes were in the benchmark, not the library — which is the ordinary case and the reason a
control is not optional.

## What was measured separately, and passed

Before mutating anything: **all 48 laws that carry a Lean module and theorem also carry a non-vacuity
witness**, and all 35 accepted ones do. A theorem with unsatisfiable hypotheses is vacuously true and
proves nothing, so this is the first thing to check in any law registry.

The witnesses are not prose. `lean/registry/lean/Witnesses.lean` holds them as Lean theorems —
`cubeLaw_witness`, `areaLaw_witness`, `fick_witness` and the rest — and they compile, each depending only
on `propext`, `Classical.choice` and `Quot.sound`. No `sorry`, no project-specific axiom.

That is a clean pass, and worth saying plainly: the formal layer is doing the hard thing properly.

## What this does not cover

- **Three mutants.** The 48 theorems are not mutated; the two targets were chosen because their
  statements carry numeric literals with a measured origin.
- **Mutation of definitions and structures**, not just theorem statements. A mutated `structure` field
  would test far more.
- **Whether the statement means what the English says.** `statement_en` sits beside every law in the
  registry and nothing checks that the Lean matches it. That gap is not mutation-shaped and is probably
  the larger risk.
- **Whether the laws are the right laws.** Soundness is not relevance.
