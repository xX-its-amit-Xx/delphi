# Axiom audit of three Lean files

Repository https://github.com/fractastical/morpholib, commit `befd35cd32908d818bdc325aac89108817933ab9` (2026-11-22).

| file | declarations | audit lines as published | as published | with audit lines added | axioms |
|---|---|---|---|---|---|
| `morphoeval/lean/MathOfBiology.lean` | 76 | 0 | refused: nothing to audit | CHECKED | Classical.choice, Quot.sound, propext |
| `morphoeval/lean/Ruliobiology.lean` | 31 | 0 | refused: nothing to audit | CHECKED | Classical.choice, Quot.sound, propext |
| `morphoeval/lean/LinearResource.lean` | 8 | 0 | refused: nothing to audit | CHECKED | Quot.sound, propext |

The claims are true. They were not checkable from the files as published, because no file asks Lean to
print the axioms its theorems depend on. One `#print axioms` line per theorem makes each file checkable.

This says nothing about whether the theorems are the right theorems, or match the biology they are named
after. That needs a reader.
