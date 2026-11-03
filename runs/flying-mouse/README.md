# Can a mouse grow wings that actually support its flight?

One question put through the whole suite — MCP, the Design Studio, Lean, the validation harness — four
times, changing the design between attempts on what the previous attempt refused.

```
node runs/flying-mouse/run.mjs                         # the four generations, logging everything
node runs/flying-mouse/test.mjs                        # what this run changed, pinned
node dashboard/public/blueprint3d/studio-live/gen.mjs  # bake the replay the live page reads
node runs/flying-mouse/shoot.mjs                       # screenshots, one per generation
```

Watch it: **`dashboard/public/blueprint3d/studio-live.html`**. It polls a running studio
(`node sim-engine/http.mjs`, `POST /tool/session_read`) and shows the session as it fills; with no studio
running it replays this one and says in the badge which it is doing.

## The answer

**No, and the system says no four different ways before it says anything else.**

| gen | asked | what the system said |
|----|----|----|
| 0 | a mouse with wings that can support its flight | Uberon: `wing` is **never_in_taxon Glires**. Every harness tool refuses for want of a parameter set. |
| 1 | a mouse with a patagium and a styliform cartilage | the strut is allowed, **the membrane is not** — `patagium` is `never_in_taxon Glires` too. Lift reaches **0.39×** the weight at the best corner. |
| 2 | the same animal, entering flight from a 4 m drop | lift reaches weight — **but only in part of the stated range**, 0.50× to 3.42×, at an airspeed only a fall supplies |
| 3 | powered flight, as asked | **refused**: an area check cannot answer a power question, and it names what one would need |

The honest summary: a mouse can be given the skeleton of a gliding membrane, cannot be given the membrane,
and at 70 cm² of wing and a jump launch is short of flight by a factor of 2.6. Letting it fall from 4 m
closes the inequality — for part of its own mass range — using a lift coefficient measured on animals that
were **themselves losing height**.

## The thing the ontology said that nobody asked it

Uberon asserts `patagium never_in_taxon Glires`, and `wing never_in_taxon Glires`. Glires is every rodent
and every rabbit. The NCBI taxonomy, in the same graph, puts **Pteromyini** inside Glires — and this
repository's own species inventory (`organisms/merged/taxa.json`) writes that tribe's common name as
**"flying squirrels"**.

The blueprint tool now finds that by itself: it reads the common names with the same lexicon it read the
request with, and reports the counterexample beside the refusal (`reading.conflict_counterexamples`). It
does **not** overrule the axiom. The structure stays out of the blueprint and what happens to a possible
ontology defect is a decision for a person.

## What is real here, and what is not

**Real** — the taxon and its clade placement, the Uberon/CL hierarchy (13 systems, 67 organs, 218 tissues,
269 cell types), the taxon-constraint refusals and their counterexamples, the Lean law verdicts (17
cannot-evaluate, 18 out-of-scope, each naming the real lineage), the lift coefficient and its citation, and
the arithmetic of lift against weight.

**Declared** — the mass (15–30 g, swept), the membrane area (70 cm²) and the airspeed. These are design
inputs. Each carries a source string beginning `DESIGN INPUT`. Nobody has measured a winged mouse.

**Absent** — a surface mesh. `anatomy-model/parametric` is a parametric *teleost* builder and Blender is not
installed on the machine this ran on, so **no `.glb` exists for any generation of this animal**. The 3D view
on the live page draws the ontology hierarchy, which is structure without shape: it cannot be flown, measured
for area, or printed. Every generation record carries `mesh.glb: null` with that reason, and a test asserts
none of them claims otherwise.

## Where the numbers came from

The only mammal lift coefficient in this repository is **C_Lmax 1.48 ± 0.18**, measured by Bishop on live
*Petaurus breviceps* in free glides at a mean angle of attack of 44°
([10.1242/jeb.002071](https://doi.org/10.1242/jeb.002071), via PubMed). It is a **stalled-membrane glide**
coefficient and the source is explicit that it was not enough: in those same glides the animals accelerated
downward at 1.0 ± 0.5 m/s², and Bishop states that body weight was not fully supported by aerodynamic force.
Bishop's earlier *Glaucomys volans* study ([10.1242/jeb.02062](https://doi.org/10.1242/jeb.02062)) reports
the same — glides at 35–53° angle of attack, wings stalled, losing height — from the 4 m launch height
generation 2 borrows. Applying 1.48 to a mouse is a borrow across Theria and
`sim-engine/validate/physics/lift-coefficients.json` says so; the caveat travels with every verdict built
on it.

## Files

```
run.mjs          the four generations; every call goes through the MCP registrations in mcp/server.mjs
test.mjs         23 assertions on what this run changed and corrected
shoot.mjs        screenshots of the live page, one per generation
summary.json     the question, the generations, the gates, the verdict
journal.jsonl    every call, script, thought and finding in order
session.txt      the Design Studio session id (sim-engine/sessions/<id>.jsonl)
log/             40 files: the arguments and the FULL result of every call, nothing elided
gen/genN.json    per generation: phenotype, genotype, declared inputs, gates, diff from the previous
gen/*.blueprint.json  the full blueprints, with their SPARQL queries and responses
fig/             gen-N.png per generation, page.png, generations.png, shots.json
```

## What broke, and what was fixed

Eight defects, each found by running this and none by reading the code:

1. **`parse_design_text` dropped every criterion in a clause naming an unknown organism.** "a mouse that …
   supports its flight" returned `criteria: []`; the same sentence with "zebrafish" returned a glide
   criterion. A spec that asks for nothing is satisfied by anything.
2. **`physics_check` defaulted its lift coefficient.** `const CLmax = 0.78`, a stuffed flying fish, applied
   to any design handed to it — with a comment in the source admitting the borrow and nothing enforcing it.
3. **A refused structure was silently substituted.** `wing` was refused and the blueprint still contained a
   styliform cartilage and a styliform element, promoted from the word "flight". *I read that hierarchy as
   "no flight structure" and was wrong.* The tool now says it in the result.
4. **A taxon-constraint refusal named neither the axiom nor its clade**, so it could not be checked.
5. **The tool recommended structures it could not read back.** It answered "the ontology allows the
   styliform cartilage" and then could not parse "a mouse with a styliform cartilage".
6. **The Design Studio was not on the MCP surface at all** — thirteen tools, including the one that builds
   a document from a blueprint.
7. **A session could record a verdict only as prose**, so a log could not be read back as a sequence.
8. **Stale log files survived a re-run**, making the folder read as though calls happened twice.

Contract `0.8.1` (`sim-engine/CHANGELOG.md`) covers the tool and schema changes. The teleost designs'
published physics verdicts are byte-identical before and after.
