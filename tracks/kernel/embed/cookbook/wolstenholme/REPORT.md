# The repository's own audit, re-run and recorded

Repository https://github.com/fahad-96/wolstenholme-zolotarev, commit `bec02d3023b5ebb2e6c1aaed75c5c72a2e594a90` (2026-10-16).

| claim in README.md | checked by | result | detail |
|---|---|---|---|
| Every proof is complete, on standard axioms | Lean, on `Checks.lean` as published (leanprover/lean4:v4.35.0) | CHECKED | 14 theorem(s) audited; axioms Classical.choice, Quot.sound, propext |
| No sorry, admit, native_decide, set_option or new axiom | a count over the Lean sources | inside | 10 Lean file(s): 0 sorry, 0 admit, 0 native_decide, 0 set_option, 0 axiom against 0 claimed |
| Neither result is in Mathlib yet | nothing: no search of Mathlib was recorded | cannot-assess | not decidable from this repository alone |

Nothing had to be added to check the first claim: the repository asks Lean to print its axioms itself.

This says nothing about whether the Lean statements are the classical theorems they are named after.
That needs a reader, and the repository restates each one in `Checks.lean` so a reader can.
