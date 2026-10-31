# Blueprint certificates: is the generated organism well-formed?

The organism thread's tool (`organism-design/blueprint.mjs`) turns a text description into a graph of
ontology terms: body, organ systems, organs, tissues, cell types, each placed under a whole by a `part_of`
statement that Ubergraph served, after taxon constraints removed what the ontology says the taxon cannot
have. This directory makes that structure machine-checked, in the only sense that is honest: the emitted
graph is internally coherent under its own stated rules. Nothing here says the organism is real.

## Two layers

**Generic theory, proved once** (`lean/Delphi/Blueprint.lean`, any node type with decidable equality):

| Theorem | What it says |
|---|---|
| `Graph.transGen_trans`, `Graph.transGen_level_lt` | The transitive closure of the stated `part_of` edges is transitive and strictly decreases the level. |
| `Graph.acyclic_of_levelsDown` | If every edge goes strictly down in level, no term is transitively part of itself. |
| `Graph.rooted_of` | If every edge joins two nodes and every non-root node has a whole, every node reaches the body root (strong induction on level). |
| `TaxonData.ok_of_check` | The pinned `never_in_taxon` statements name no taxon containing the blueprint's taxon; every `in_taxon` and `stated_in_taxon` statement names a containing taxon. |
| `wellFormed_of_check` | The Boolean checker `check g D = true` implies all of the above. |

**A certificate per emitted blueprint, regenerated with it** (`lean/Delphi/Certificates/<Name>.lean`):
the graph and the taxon statements as Lean literals, and `<name>_check : check g D = true := by decide +kernel`,
so the kernel itself evaluates the checker on the data. `<name>_wellFormed` follows by the generic theorem,
`<name>_counts` fixes the number of distinct terms per level, `<name>_size` the node and edge counts.

## Regenerate whenever a blueprint is rebuilt

```
node lean/blueprint/fetch-taxon.mjs organism-design/examples/a-flying-fish.json   # pin taxon statements from Ubergraph
node lean/blueprint/certify.mjs     organism-design/examples/a-flying-fish.json   # write + compile the certificate
node lean/report.mjs                                                              # fold into lean.json (audit, hashes)
```

`certify.mjs` refuses to run if the pinned taxon data was fetched for a different blueprint file (sha256
mismatch), and `report.mjs` marks a certificate `current: false` if the blueprint file has changed since
the certificate was generated. The sub-dashboard shows both.

The taxon data is fetched in batches of 40 terms with three one-hop queries each (`never_in_taxon` on the
term, on a `rdfs:subClassOf` ancestor, on a `part_of` whole: the three places the tool's own SPARQL filter
looks) plus `in_taxon`, and the `rdfs:subClassOf` closure of the taxon. One query over all terms was cut
off by the server mid-stream (an error message spliced into the JSON body), hence the batches. Every
query's text and retrieval time is kept in `data/<name>.taxon.json`.

## What the flying-fish certificate pins (2026-10-31)

536 distinct terms, 674 distinct `part_of` edges (674 placements in the file at that build), levels
body 1, organ system 13, organ 67, tissue 198, cell 257 as distinct terms. These are the numbers the
organism thread's label reports after it fixed a placement-versus-term count; a certificate like this one
is what catches that class of error. 32 taxa containing Exocoetidae; 1390 `never_in_taxon` statements
reachable from kept terms, none naming a containing taxon; 5435 `in_taxon` and 64 `stated_in_taxon`
statements, all naming containing taxa. Kernel time about 85 s.

## Diamonds are not cycles

114 of the 536 terms sit under more than one whole (the liver is an organ of both the digestive and the
exocrine system), so paths converge. A naive walk that treats a re-visited ancestor as a back-edge reports
such terms as "on a cycle"; the organism thread's first independent check did exactly that (106 false
positives) before redoing it with a proper depth-first search and finding zero. The certificate cannot make
that mistake: acyclicity is proved from the level function alone (every edge strictly decreases the level,
so no path returns to its start), and converging paths never enter into it.

## Why the mutants sabotage the data, not the proof

Two of the mutants in `lean/mutate.mjs` edit the certificate's literals: one adds an upward edge that
makes the body root part of a node, the other adds a `never_in_taxon` row saying a kept term is never in
Vertebrata. In both cases `decide +kernel` must fail, which shows the checker is evaluating the data rather
than accepting anything. A third mutant flips the direction of the level inequality in the generic closure
lemma, which the proof of acyclicity rests on.

## What this does not establish

That Exocoetidae or any organism has these structures; that the anatomy is correct or complete; that
Uberon, the Cell Ontology or Ubergraph are right (their statements are data, pinned by hash and query);
that any part was measured; or anything about a transition between forms. The levels are the tool's own
classification, and the theorems use only that edges strictly decrease them.
