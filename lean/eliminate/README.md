# Eliminating candidates with the formalised theorems

A Lean proof does not eliminate an open problem: a problem is open precisely when no known theorem
settles it. What a proof can do is eliminate a **candidate**, a specific proposed answer or design that
commits to quantities the theorem forbids. Galileo's giant is the model: a body scaled without change of
shape or density must weigh `(L2/L1)^3` times more, so a giant "only 100 times heavier" at 100 times the
length is ruled out. With ten constraints from seven formalised entries, most candidates survive only
because nothing we proved touches them. That reads **"unconstrained by our theorems"**, never "feasible".

## Files

| File | What it is |
|---|---|
| `lean/Delphi/Constraints.lean` | One lemma per constraint, concluding `False` from the law plus a candidate's commitment; the last hypothesis is a decidable fact about the committed numbers. |
| `build-constraints.mjs` → `lean/constraints.json` | The constraints, joined with `lean.json` so theorem names, axioms, proof scope and faithfulness verdicts are never retyped. |
| `eliminate.mjs <candidates.json>` → `ledger.json`, `lean/Delphi/Certificates/Eliminations.lean` | The checker and the certificates. |
| `examples.json` | Twelve illustrative candidates written by this thread to exercise the three states. They are not the open-problems enumerator's candidates and contain no measurement. |

## Candidate schema

```json
{ "candidates": [ { "id": "giant-insect-mass", "problem": "…", "description": "…", "source": "…",
    "accepts": ["isometric_constant_density"],
    "commits": { "length_ratio": 100, "weight_ratio": { "low": "90", "high": "110" } } } ] }
```

`commits` holds quantities named in `constraints.json` (`quantities`): a number, an exact decimal or
fraction string (`"1e-9"`, `"4/103"`), or `{low, high}`; a point value is the interval `[v, v]`.
`accepts` lists the model assumptions the candidate commits to (`constraints.json`, `assumptions`); a
theorem about a model can only rule on a candidate that accepts the model. Arithmetic is exact (BigInt
rationals); nothing is rounded.

## The three states

* **eliminated**: the violated relation with the numbers, the constraint's lemma, and the certificate
  theorem the kernel accepted (`kernelChecked: true`), or "plain computation" where no certificate exists
  (C6 on rejection: the checker's completeness is not proved).
* **consistent**: not ruled out by this constraint. It is not a claim that the candidate is possible.
* **cannot rule**: a required input is missing, or the candidate did not commit to the model assumption.
  This is the honest state for an omission; the checker never lets an omission pass.

A candidate's verdict is "eliminated" if any constraint eliminates it, "consistent (not ruled out by
these theorems; not shown feasible)" if some constraint ruled and none eliminated, and "unconstrained by
our theorems" if no constraint could rule at all.

## Limits, stated so they are not mistaken for strength

* An elimination holds only under the law's assumptions. Three of the four original statements were judged
  by the assessor to be narrower in scope than their claims (`faithfulness` per constraint); a candidate
  eliminated by a narrower statement is eliminated only under that statement's assumptions, and the ledger
  row says which.
* The cube law covers the **mass side** of the square–cube argument only. Strength scaling as `L^2` is not
  formalised, so a giant that weighs the right `10^6` times more and is claimed to stand up is *consistent*
  with C7, not shown possible (`giant-insect-strength` in the examples).
* C3b bounds an **expectation**; a realised count can exceed its expectation, so a candidate committing to a
  realised count cannot be ruled on.
* C4 and C5 need exact point values; C1, C2, C3, C3b, C4b, C7 and C7b accept intervals and eliminate only
  when the intervals are disjoint from what the theorem allows.
* C6 (blueprint well-formedness) is structural: it says nothing biological, and on rejection it reports the
  checker's failing condition as plain computation.

## The open-problems candidates (2026-10-31)

Another agent enumerated 215 problems from named sources and 80 candidates into `open-problems/`; 44 carry a
constraint tag. `translations.json` is this thread's reading of each of the 44 into the schema, and
`translate.mjs` joins it with the originals into `open-problems/candidates.formal.json`, keeping the original
English commitment beside the formal one and a one-sentence reading. Policy: no number is invented; a candidate
that adopts a theorem as its premise and commits no value is **untranslatable**; a candidate whose real claim
rests on strength, cross-section or exchange-area scaling gets a per-constraint **not-formalised** reason; a
candidate that denies the model's own premise (no males; unequal fecundity) is **premise-rejected**; one that adds
a term the model lacks (a fitness advantage, parasites) is **outside-model**; a homology or part-of claim stated in
words rather than emitted as a graph is **no-graph**. `ledger.open-problems.json` is the result, with every row
carrying provenance (published, proposed-here, illustrative values) and, on an elimination, the caveat that a
proposed-here candidate's elimination eliminates the enumerator's construction, not a published hypothesis.
Rank nothing by elimination count.

## Strength is now formalised (R7), and what it changed

With `lean/Delphi/Scaling.lean` (2026-10-31, from the physics thread's R2-R8) the constraints grew from 13 to 25:
area exponent and ratio (C2a, C2b), axial strength (C8), breaking-load ratio (C8b), **Galileo's giant** (C8c:
reference safety factor divided by the length ratio against the claimed load), stress ratio and exponent (C8d,
C8e), the exact minimum-speed bound (C9), minimum-speed ratio and exponent (C9b, C9c), the power-required
exponent (C10) and Froude (C11). Rerunning the open-problems ledger moved all 13 translatable square-cube rows
from cannot-rule to **consistent**: they assert the exponents R2 and R7 give, so nothing was eliminated, and
the only strength claim still marked not formalised is petiole **bending** (WP-077), which R7's axial case does
not cover. The illustrative giant claimed to stand (reference safety factor 10, illustrative) is eliminated by
C8c, and a glider below its own minimum speed by C9. Power available is not a constraint: its `L^3` rests on
Thompson's muscle premise, carried as a named hypothesis.

## Bending (R9) and the WP-077 fork

R9 (`bendingStress = F l / Z`, similar sections `Z ~ L^3`, lever arm `~ L`) splits on the load: body-like
(`F ~ L^3`, R9a) gives bending stress `~ L` and a size limit `sigma_max k_Z/(k_F k_l n)`; sheet-like (a lamina of
constant thickness, `F ~ L^2`, R9b) gives size-independent stress and **no** limit. The candidate must commit
to one fork (`body_like_load` or `sheet_like_load`). WP-077/C1 commits to thickness scaling with size, so its
"bending stress ~ k" is R9a's own conclusion and the row is **consistent**; the illustrative constant-thickness
leaf that still claims a rising stress is eliminated by C12c. Three mutants: `Z ~ d^2`, a sheet-like load kept
with the body-like conclusion, and the size limit stated without `sigma_max`.

## Flight: allometry, climb, glide range, the aerobic bound (C13-C16)

`lean/Delphi/Flight.lean` adds general power laws (so measured exponents compose: wing loading `bW − bS`, `v_min`
exponent `(bW − bS)/2`), the climb corollary `c ≤ (P_avail − P_req)/W`, the steady-glide range `x ≤ h (L/D)max/(1 − δ)`
with the ground-effect fraction `δ` as an input, and the aerobic bound `P ≤ η E_O2 Q (Ca − Cv) ≤ η E_O2 Q Ca` composed
with the power required (sustained flight needs `η E_O2 Q Ca ≥ P_req`) and a crossover theorem (a size limit for any
supply exponent below `7/2`), which replaces Thompson's muscle premise. On the real fish the glide bound fires:
one unpowered glide from 8 m with the stuffed-model (L/D)max 4.37 reaches at most 35 m (40.7 m with the measured 14%
ground effect) against field glides of 50 m, so the single-glide reading is eliminated and taxiing thrust, repeated
touch-and-go or a higher L/D (the theoretical 15.7 passes) must enter the model; the three illustrative glide
candidates show the fork. Six mutants: venous term dropped the wrong way, efficiency above one, crossover exponent
reversed, glide bound halved, climb bound reversed, quotient exponent summed.

## The most valuable next constraints

Gill O2 uptake as a function of water O2 and gill area (the first link of the simulator chain, so that `Ca` is
derived rather than committed), taxiing thrust from the caudal fin, aspect ratio and induced drag, elastic similarity, the walking (pendulum) route, and any quantitative muscle-power
law; without the last, "a bird as large as a man could not fly" has an existence proof and no number.

## Mutants

`lean/mutate.mjs` rewrites the giant-insect certificate to claim that a weight ratio of exactly `10^6`
at length ratio 100 is ruled out (it is not: `10^6 = 100^3`) and flips the sign in the Fisher lemma to
rule out a rise in mean fitness. Both must be rejected by the compiler.
