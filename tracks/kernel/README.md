# The DELPHI kernel

A small trusted core, and a biological compiler built on top of it.

The recurring failure in this repo was never a wrong number. It was a **true claim nobody could
check**: a theorem with no axiom audit, a curvature prediction whose swelling input had been inferred
rather than read, a verdict that quietly became a pass because an input was missing. Those are one
bug — an artifact that outlived its justification. The kernel makes the justification the only route
to the artifact.

```
                       evidence ──► fact ──┐
                                           ├──► verdict ──► build ──► files
   Lean file ──(kernel checks it)──► law ──┘        │
                                                    └──► refusal (and no files)
```

## Five primitives, and what each one refuses

| call | refuses when |
|---|---|
| `evidence()` | no quote, no locator, no reference, or the record is quoting somebody else's measurement |
| `fact()` | no evidence, no unit, a value that is not a finite number, or no measurement conditions |
| `law()` | the Lean file asks for no `#print axioms`, the Lean kernel rejects it, or a proof rests on an axiom outside `propext`, `Classical.choice`, `Quot.sound` |
| `verdict()` | never refuses — it returns `inside`, `outside` or `cannot-assess`. A missing input or inputs from incompatible conditions give `cannot-assess`, which is **not** a pass |
| `build()` | any verdict it rests on is `outside` or `cannot-assess`. It then mints a `refusal` naming what was missing, and writes no files |

The store is `store/nodes.jsonl`: append-only, each node named by the sha256 of its own content and
chained to the line before it. Editing a number after the fact changes its name; removing a line
breaks the chain. `cli.mjs verify` recomputes both.

Timestamps are stored but not hashed, so re-running the same work does not mint a second node saying
the same thing, and a law whose Lean file is byte-identical is not re-checked.

## Run it

```bash
node tracks/kernel/test-kernel.mjs              # 28 injected faults, all must be caught
node tracks/kernel/test-kernel.mjs --with-lean  # the same, plus the real Lean toolchain
bash  tracks/lean/check.sh tracks/kernel/lean/CircuitLaws.lean
node tracks/kernel/compile/compile.mjs tracks/kernel/compile/designs/and2.v
node tracks/kernel/cli.mjs summary
node tracks/kernel/cli.mjs why "predictive model"   # a refusal, traced back to the quotes
node tracks/kernel/audit-lean.mjs <file.lean|url>   # audit anyone's Lean file, including ours
```

## The compiler

`compile/` takes behaviour in a small Verilog subset and emits DNA, protocols and a model — through
the kernel, so what comes out is bounded by what the records support.

| stage | file | note |
|---|---|---|
| behaviour → gates | `compile/hdl.mjs` | `~` `&` `|`; `~(x|y)` lowers to **one** NOR, because that is one repressor in the cell; `x & y` lowers by de Morgan to three |
| parts and numbers | `compile/parts.json` | every value quoted from the paper that measured it, with where it is printed |
| laws | `lean/CircuitLaws.lean` | 6 theorems, each with its own axiom audit |
| DNA | `compile/emit.mjs` | GenBank; a slot with no sequence from a primary record becomes a real `assembly_gap`, not a guess |
| model | `compile/emit.mjs` | SBML, Hill function per gate — refused unless all four parameters per gate exist |
| assembly | `compile/emit.mjs` | Opentrons Python and Autoprotocol JSON for Golden Gate. **Never run on hardware.** |
| write-back | `compile/emit.mjs` | one **unsigned** nanopublication draft per missing measurement |
| justification | `compile/emit.mjs` | JSON-LD: every slot, number and verdict back to its record |

### What the AND circuit run actually says

```
3 gates [NOT NOT NOR], 3 repressors, 2 cascades
mapping  PhlF, LmrA, ButR  (no repressor reused, no reported cross-reacting pair)
verdicts 2 inside, 2 outside, 2 cannot-assess
```

- **cannot-assess, twice.** The PhlF and LmrA output levels were measured in *E. coli* DH5α in LB;
  the ButR threshold was measured in DH10B in M9 + glucose. The kernel will not put them in one
  inequality. The Lean theorem is fine; the data cannot be combined.
- **outside, once.** Taking the ranges the paper prints for its whole gate set — OFF up to 2.1 REU,
  thresholds down to 0.1 REU — the worst pair has a **low margin of −2.0 REU**. Some cascades in the
  published set provably cannot work. The authors say this in prose ("the OFF states are similar in
  magnitude to the thresholds, this can be problematic when connecting gates"); the law turns the
  sentence into arithmetic.
- **inside, twice.** The best pair in the set has margin on both sides, and the chosen repressors are
  distinct and not in a reported crosstalk group.
- **3 of 14 slots filled.** Only the ribosome binding sites have a sequence printed in a paper that
  was read. The iGEM Registry returns HTTP 403 to automated requests and the SynBioHub mirror sits
  behind a bot check, which this work does not attempt to pass, so the promoter sequences are open
  slots. The repressor coding sequences are open on purpose: the measured gates used codon-optimised
  synthetic genes from a supplementary file, and a wild-type gene from GenBank would be a different
  sequence from the one the numbers belong to.
- **7 missing parameters → 7 unsigned nanopublication drafts.** That list is the shortest set of
  measurements that would make this circuit simulable, which makes it the right thing to ask an
  author for.

## Auditing a "0 sorry" claim

`audit-lean.mjs` exists because "machine-checked, 0 sorry" is not checkable from a file that never
asks Lean to print its axioms. Three different things can be true of such a file: the proofs are fine
and nobody can tell; a `sorry` is in there and Lean only warned; or a result is assumed with a
hand-written `axiom`, which passes every "no sorry" grep. So the tool appends one `#print axioms`
line per theorem to a **copy** and runs the strict checker over both.

Run against `fractastical/morpholib`'s `morphoeval/lean/MathOfBiology.lean` at commit `a2201fd3`
(2026-11-19):

```
as published     REJECTED  no-axiom-audit (76 of 76 theorems have no #print axioms line)
with audit added CHECKED   axioms [Classical.choice, Quot.sound, propext]
```

The claim is **true** — all 76 theorems hold on the three standard axioms — and was **not checkable**
from the published file. 76 added lines make it checkable. That is a contribution to make upstream,
not a criticism.

It reports counts, hashes, verdicts and failed declaration names only: no prose or identifier from
the audited file is reproduced, and failed names are screened against the held-out roster, because
third-party corpora name species this repo is blind to on purpose.

## What the kernel does not do

- It does not say a theorem is the **right** theorem. A kernel-valid statement can say nothing:
  contradictory hypotheses prove anything, and no script catches that
  (`tracks/lean/probes/ProbeVacuous.lean` exists to make the point). That needs a reader.
- It does not check that a formal statement matches the biology it is named after.
- It does not make a design work. Every artifact here is a design, built by nobody, sequenced by
  nobody, and the protocols have never been on a robot.
- The orthogonality and parameter-completeness laws are checked by **script, not by the Lean kernel**,
  and each law node says so.

## Scope limit on the part registry

Transcriptional logic and fluorescent reporters in laboratory *E. coli* only. The registry contains
no toxin, virulence, host-range, immune-evasion or resistance-transfer part, and the compiler refuses
any identifier that is not in `parts.json`.

## Sources

Both are open access and were read as full text, not as abstracts.

- Stanton BC, Nielsen AAK, Tamsir A, Clancy K, Peterson T, Voigt CA. *Genomic mining of prokaryotic
  repressors for orthogonal logic gates.* Nature Chemical Biology 10:99-105 (2014).
  [doi:10.1038/nchembio.1411](https://doi.org/10.1038/nchembio.1411), PMC4165527. Retrieved via
  Europe PMC and PubMed, 2026-11-19.
- Kelly JR, Rubin AJ, Davis JH, Ajo-Franklin CM, Cumbers J, Czar MJ, de Mora K, Glieberman AL,
  Monie DD, Endy D. *Measuring the activity of BioBrick promoters using an in vivo reference
  standard.* Journal of Biological Engineering 3:4 (2009).
  [doi:10.1186/1754-1611-3-4](https://doi.org/10.1186/1754-1611-3-4), PMC2683166. Retrieved via
  Europe PMC, 2026-11-19.

`parts.json` records two defects in these sources that change what can be used: Stanton's text names
20 repressors in a sentence that says 16, and Kelly's multi-laboratory sentence prints `BBa_J23150`
twice, so one of its two activity ranges cannot be attributed and is not used.
