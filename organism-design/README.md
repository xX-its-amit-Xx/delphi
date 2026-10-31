# organism-design: text-to-blueprint, honestly scoped

The team's idea is "describe an organism, get a multi-scale blueprint and a genome". The credible
first version, built here, returns the blueprint from existing ontologies and treats anything
genome-related as a labelled sketch.

Sub-dashboard: `dashboard/public/t/organism/` (live at `/t/organism/`). Thread: `organism`
(session `scienceclaw-32`).

## What is here

| file | what it does |
|---|---|
| `blueprint.mjs` | `node organism-design/blueprint.mjs "a teleost fish that swims with fins"` writes `examples/<slug>.json`: a body > organ system > organ > tissue > cell tree of Uberon and Cell Ontology terms for the taxon the description names, with every query stored. |
| `lexicon.json` | Hand-written word lists (taxon words, anatomy words, function stems, habitat words). Each entry points at an ontology term that the tool verifies live. Reading aids, not biology. |
| `cache/` | Every SPARQL response, keyed by the SHA-256 of the query. A clean checkout reproduces every example offline (`--offline`). |
| `examples/` | Worked examples. A description that resolves inside the held-out clade is refused and leaves no file or cache entry. |
| `exam/predict.mjs` | Blind predictions for the holdout exam: present or absent for every roster species and every Uberon core term that carries a taxon constraint. Reads `holdout/exam.json` identifiers only. Output `exam/aves-predictions.json`. |
| `esmfold/smoke-test.mjs` | Calls a hosted ESMFold service on one checksummed UniProt sequence: the BioNeMo NIM (`--host nvidia`, key from `NVIDIA_API_KEY` only, never stored; records `not-run` without it) or Meta's public ESM Atlas (`--host esmatlas`, no key, up to 400 aa). Writes `esmfold/runs/<acc>[-host]/result.json` and `predicted.pdb`; pLDDT reported on 0 to 100. |
| `esmfold/compare.mjs` | Global alignment plus Kabsch superposition of CA atoms for a set of runs: substitutions and RMSD per pair. Pure Node. |
| `esmfold/attach.mjs`, `esmfold/attach-clock.mjs` | File runs against one claim as plain JSON with the provenance a future nanopub needs: albumin against `thompson1917-ch09-06`, the cytochrome c trio (cattle, tuna, yeast) against `kimura-substitution-rate`. Not nanopubs; nothing is published. |
| `nanopubs/UPSTREAM-ASK.md` | What to send Knowledge Pixels: republish three migrated templates and migrate two more, make the checker exit non-zero on a parse failure, and two assessment templates proposed by the holdout thread and carried here unminted. Every number has the command that produced it. |
| `nanopubs/check.mjs` | Validates every record with nanopub-java and reports a verdict that can be trusted: the jar exits 0 even on a parse failure, so the exit code is ignored, the output is parsed instead, and a negative self-test on a truncated record runs first. |
| `nanopubs/build.mjs` | Emits one unsigned Project Delphi nanopub per record of this thread (33: 16 claims, 16 evidence items, one assessment, the last pair being a method record about a template defect found while drafting the others) with the upstream pipeline's builders, Delphi ontology v2.0 terms, and every number carrying the file and checksum it was read from. Output `nanopubs/unsigned/` plus `manifest.json`; choices and the checks that ran are in `nanopubs/DECISIONS.md`. Nothing is signed and nothing is published. |
| `build.mjs` | Copies examples, the exam predictions and the ESMFold result into `dashboard/public/t/organism/data/` and writes `index.json`, which is the only place the page reads numbers from. |

## How the blueprint is built

1. **Read the description.** Taxon words are matched against the team's species inventory
   (`organisms/merged/taxa.json`, common and scientific names) and then the lexicon; the most
   specific taxon (checked live: a subclass of the others) wins. Anatomy words and function stems
   come from the lexicon. Habitat words are recorded but not used for filtering.
2. **Holdout guard.** If the taxon is inside the held-out clade in `holdout/exam.json`, the tool
   refuses and writes the reason.
3. **Taxon filter.** A structure is dropped if Uberon or CL says `never_in_taxon` on the term, a
   superclass or a whole it is part of, for a taxon containing ours; or if it says `in_taxon` for a
   taxon unrelated to ours. For non-vertebrates, terms in Uberon's `vertebrate_core` subset are
   dropped as well. Absence of a constraint is not presence: every organ carries `taxon_evidence`
   (stated for X / weak / none).
4. **Hierarchy.** Organ systems are subclasses of "anatomical system" in Uberon's core subsets, most
   general kept. Organs are parts of a system in `major_organ`, `organ_slim`, `efo_slim` or
   `vertebrate_core`, ranked major organs first then by how many cell types CL records for them.
   Structures named in the description are always kept. Tissues and cells are `part_of` each organ.
5. **Genome sketch.** Marker gene products (Protein Ontology terms) that CL records as expressed by
   the chosen cell types, most specific per cell. Labelled SKETCH. Not a genome.

## Rules followed

- Every node is an existing identifier; nothing is invented. Every edge has the query that produced it.
- The builder is blind to the held-out clade (`holdout/exam.json`): no bird species, genomes or
  trait rows were used; `node holdout/check-leaks.mjs` shows no hit in this folder.
- No API keys, credit links or model outputs presented as measurements. The ESMFold record says what
  it does and does not show.
- The nanopub records are drafts: unsigned, unpublished, and separated by kind so that a design proposal,
  a model output, a derived claim and another thread's scoring never share a record. Signing and any
  registry, the test one included, are the ORCID key owner's decision; the test registry comes first.

## Known limits

- Uberon's taxon constraints are sparse, so for taxa far from vertebrates the tree can still include
  structures the organism lacks; the `taxon_evidence` field makes this visible rather than hiding it.
- Function-to-structure links come from the ontology where it has them (`capable_of`) and otherwise
  from the hand-written lexicon, marked as curated.
- Nothing here is measured and no function is predicted: a blueprint names the structures an ontology records
  for a taxon. The team enzyme page (/evolve/) is the measured counterpart at the smallest scale; its authors
  state that organism and tissue predictions remain absent, and that span is open, not bridged by either page.
- Ubergraph is a live service; the cache pins what was retrieved and when.
- The holdout thread scored `exam/aves-predictions.json` under its pre-registered rule: inconclusive, because the
  rule's structures (sternal keel, foot webbing) are not among Uberon's constrained terms. See
  `holdout/exam-results/organism-design/`.
