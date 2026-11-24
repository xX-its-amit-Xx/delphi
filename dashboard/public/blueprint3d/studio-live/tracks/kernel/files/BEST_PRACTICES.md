# Embedding the DELPHI method

This document is generated. Every rule in the first table names the guard in the kernel that
enforces it, and `best-practices.mjs --check` fails if that guard is removed, so this file cannot
quietly become a description of a rule nobody enforces any more.

## The one idea

The recurring failure in research code is not a wrong number. It is a **true claim nobody can
check** — a theorem with no axiom audit, a figure whose input was inferred rather than read, a
check that quietly became a pass because an input was missing. Those are one bug: an artifact that
outlived its justification.

The method is to make the justification the only route to the artifact. Five calls, in order:

```
  evidence ──► fact ──┐
                      ├──► verdict ──► build ──► your files
  law ────────────────┘        │
                               └──► refusal (and no files)
```

Nothing else is trusted. The kernel does not search literature, fit a model or render a page; it
refuses those. your project keeps doing all of that — it just cannot emit a result without passing
through the five calls above.

## The rules the kernel enforces

| at | rule | why |
|---|---|---|
| `evidence` | Record the words the source itself prints, and where they are printed. | A number retyped from memory, or from another paper quoting the first, is the failure that is hardest to find later: it looks identical to a good one. The quote and the locator are what let a reader check it in ten seconds. |
| `evidence` | Cite the record that measured it, never a record that quotes the measurement. | A review's restatement of someone else's number drops the conditions and sometimes the meaning. This is a rule the paper watcher in this repo learned by getting it wrong. |
| `fact` | A measurement is a finite number with a unit. | "about sixteen" reached a verdict as NaN here once, and NaN compares false against everything, so the check silently passed. |
| `fact` | State the conditions the number was measured in, or state that they are unknown. | Conditions are what decide whether two numbers may appear in the same inequality. A number without them cannot be filtered for compatibility later, which is the whole reason for keeping provenance at all. |
| `fact` | No fact without evidence under it. | This is the link that makes every later number traceable to a page in a paper. |
| `law` | A formal claim must ask for its own axioms to be printed. | "Machine-checked, 0 sorry" is not checkable from a file that never asks the prover to print what it depended on. Three different things can be true of such a file, and one of them is a hand-written axiom that passes every grep for `sorry`. |
| `law` | The proof must rest on the standard axioms only. | An `axiom` line assumes the result. It is the quietest way to have a theorem that says nothing. |
| `law` | Write the law in a sentence a person can read before writing it in a prover. | A law nobody can state in plain words cannot be applied honestly, and cannot be argued with by the person who knows the subject. |
| `verdict` | A missing input is `cannot-assess`, never a pass. | This is the bug the whole kernel exists for. A check whose input is absent returns true in almost every codebase written without thinking about it. |
| `verdict` | Numbers measured under different conditions are not put in one inequality. | Two correct numbers and one correct theorem still give a wrong answer if the numbers come from different hosts or standards. |
| `build` | No artifact unless every verdict under it is `inside`. The refusal is itself a record. | The refusal is usually the useful output: it is the shortest list of things that would have to be measured for the artifact to be honest. |
| `store` | Append only, and name every record by the hash of its own content. | A number edited after the fact changes its name; a line removed breaks the chain. Both are then findable by a command instead of by luck. |

## The habits it cannot enforce

These are not checked by anything. They are here because every one of them was learned by getting
it wrong, and a reader of this file should know which half is machinery and which half is care.

- **Say how you read the source.** Full text, named sections, the abstract, or a figure read by eye. A finding about one paper can never be stronger than the read of that paper. A settled fact resting on an abstract wants a better citation, not a weaker claim.
- **A negative result needs its measure named.** "0 of 950 by scaffold match" is a finding. "No prior work exists" is usually an artifact of the one measure you tried. Test a second way that could have found it.
- **Your own reports are not sources.** Citing your own brief turns one early mistake into a consensus and hides it from correction. Open the record the brief cites and cite that.
- **Make the check fail once.** A guard that refuses everything passes every "must refuse" test. Inject one deliberate fault at a time and confirm each is caught alone, with everything else left valid.
- **A law that is kernel-valid can still say nothing.** Contradictory hypotheses prove anything, and no script catches that. A formal statement matching the biology it is named after needs a reader.

## Working in it

```bash
delphi evidence --kind doi --ref 10.1038/nchembio.1411 \
    --quote "yielding outputs of 16 and 0.1 REU" \
    --where "Results, modelling the NAND circuit"

delphi fact --statement "PhlF ON level" --quantity output_on_REU --value 16 --unit REU \
    --condition host="E. coli" --condition strain=DH5alpha --evidence k1a2b3c4d

delphi law --name noise_margin --informal "the upstream OFF must sit below the downstream threshold" \
    --lean laws/Margins.lean --decl Delphi.margins_pos

delphi verdict --law kaaa --fact kbbb --fact kccc \
    --requires output_off_REU --requires threshold_REU \
    --expr "threshold_REU - output_off_REU > 0" --label "PhlF -> ButR"

delphi build --artifact "the construct" --verdict kddd --file out/design.gb

delphi verify        # recompute every id and every chain link
delphi why construct # the artifact, or the refusal, traced back to the quotes
delphi graph         # the whole store as a knowledge graph you can open
delphi doctor        # is this project's setup still sound
```

## Three things worth doing on day one

1. **Put `delphi verify` and `delphi doctor` in CI.** They are fast and they catch an edited store,
   a missing source file and a law whose proof no longer checks.
2. **Make your refusals visible.** The list of things the kernel would not build is the most useful
   page you can publish: it is the shortest set of measurements that would unblock the work.
3. **Keep the store in version control.** It is append-only text, one JSON object per line, and a
   diff on it reads as a history of what was decided and on what grounds.

