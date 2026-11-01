# Leak resolution, 2026-11-01

`node holdout/check-leaks.mjs` reported **74 possible leaks** at the start of this pass (73 when first relayed; one more
file had landed by the time it was re-run). After this pass it reports **0** (`no held-out organism named`). No real
leak was found: no bird row, value, identifier or orthologue is present in any flagged file. Every flag was one of
three things (5 + 16 + 53 = 74): a number that collides with a bird taxid, filter code that names birds in order to drop them, or the id
of the flight-scaling law that the 2026-10-31 ruling already covers. Each is resolved below, file by file, with an
entry in `leak-allowlist.json` that says why. Nothing outside `holdout/` was edited, nothing was rebuilt, and nothing
was committed or deployed.

## 1. Numbers that look like bird taxids (omics): no leak, nothing to rebuild

`omics/genes.json` tripped five taxid signals (Charadriiformes 8906, *Cuculus canorus* 55661, Paradisaeidae 9149,
*Serinus canaria* 9135, Strigiformes 30458). The checker's taxid pattern is `(taxid|taxon|ncbi)` followed within 20
characters by the number, and the file is a single JSON line full of `"ncbi":` and `"ncbi_gene":` fields. All five
numbers are **NCBI Gene ids**, not taxonomy ids. Checked against NCBI `esummary.fcgi?db=gene` on 2026-11-01:

| id | gene | organism | where in genes.json |
|---|---|---|---|
| 8906 | AP1G2 | Homo sapiens | `human_ortholog.ncbi` of zebrafish ap1g2 |
| 55661 | DDX27 | Homo sapiens | `human_ortholog.ncbi` of zebrafish ddx27 |
| 9149 | DYRK1B | Homo sapiens | `human_ortholog.ncbi` of zebrafish dyrk1b |
| 9135 | RABEP1 | Homo sapiens | `human_ortholog.ncbi` of zebrafish rabep1 |
| 30458 | gata3 | Danio rerio | `ncbi_gene` of zebrafish gata3 |

`omics/scripts/build-genes.mjs` takes only ZFIN, ZFIN-human orthology, Ensembl 1:1 and UniProt (zebrafish and human)
sources, plus 9 flying-fish ids; it has no bird orthologue source to drop. So there is nothing to change at the source.

The same five numbers, and nothing else, are the strong hits in the omics index and the browser bundle (the checker
does not scan `.gz` or `dashboard/` outside `t/`, so these were scanned separately with the checker's own signals,
every `.gz` gunzipped; 7,725 files):

- `omics/index/genes/{ap1g2,ddx27,dyrk1b,gata3,rabep1}.json.gz`: 8 hits, all the gene ids above.
- `dashboard/public/blueprint3d/omics/genes/{ap1g2,ddx27,dyrk1b,gata3,rabep1}.json.gz`: 8 hits, same.
- `index.json`, `parts.json`, `INDEX.json`, `search.json.gz`: no strong hit. No `Gallus`, `Taeniopygia` or `Columba`
  anywhere in either tree.
- Weak hits only: the word *avian* in zebrafish gene names inherited from viral oncogenes ("v-myb avian
  myeloblastosis viral oncogene homolog", v-crk, v-rel, v-ski, egfra) and in the human disease term "avian influenza"
  (DOID:4492) attached to human ACE2 and PTGS2 orthologues; and *Aves* in the "No Aves data (frozen holdout)" note.
  None is bird data.

The omics layer files (`omics/*/annotations.jsonl.gz`) were scanned too. Their `species` fields hold only Danio rerio,
Homo sapiens, Mus musculus, Oryzias latipes, Xenopus tropicalis, Astyanax mexicanus and three flying-fish species.
`omics/genomic/annotations.jsonl.gz` has the same five gene-id collisions; `omics/pathway/annotations.jsonl.gz` has 223
matches for the ratite genus *Rhea*, all of them the RHEA reaction database in GO `assigned_by` fields (homonym).

**Rebuild needed: none.** `omics/index/` and the bundle are clean as they stand; `node omics/build-index.mjs` does not
need to be rerun for the holdout. `build-index.mjs` and the bundle were not touched.

Allowlist: one entry for `omics/genes.json`, scoped to those five taxa only (the file is one line, so a `pattern` cannot
narrow it; any other held-out name in the file is still a leak).

## 2. Filter code that names birds to drop them: allowlisted, one entry per file

Each file below names bird taxa only inside a regex, list or test whose job is to exclude them, which is what the
builder rules ask for ("the filter must be in the committed analysis script"). Entries are scoped to the matched taxa
and, where one line holds them all, to a `pattern` on that line.

| file | matched | what the code does |
|---|---|---|
| `omics/proteomic/scripts/build.py` | Aquila, Falco (l. 8) | `AVES` regex; `scrub()` drops matching sentences, organism and location loops skip matching records (l. 41, 98, 352) |
| `omics/validate.mjs` | Aquila, Falco (l. 15), Gallus gallus (l. 82) | rejects any row whose species, gene or ortholog names a bird (l. 52); l. 82 is the self-test fixture that must fail |
| `sim-engine/generative/body/prepare.py` | Accipitriformes, Galliformes, Charadriiformes, Strigiformes (l. 27-28) | aborts if a non-fish order appears among FishShapes orders (l. 51) |
| `sim-engine/generative/test/generative.mjs` | Accipitridae (l. 46) | test fails if the derived table contains a bird taxon string |
| `sim-engine/validate/phenotype.mjs` | Accipitriformes, Galliformes, Strigiformes, Gallus gallus (l. 45) | `AVES_RE` drops bird references (l. 105) and, via genotype.mjs, bird sequences and BLAST hits |
| `sim-engine/validate/test/validate.mjs` | Gallus gallus (l. 38) | `no-aves-in-references` test string |
| `sim-engine/validate/benchmark/build/build.py` | Accipitriformes, Galliformes, Charadriiformes, Procellariiformes, Strigiformes (l. 32-33) | `AVES_ORDERS` / `is_bird()` drop FishShapes and FishBase rows (l. 88, 158), assert no bird taxon (l. 565) |

One more, a homonym rather than filter code: `sim-engine/validate/scorer-results.run1-aves-filter-bug.json` line 1611,
**Cirrhitichthys falco** (dwarf hawkfish), matched the falcon genus *Falco*. The file is the scorer run whose bird
filter over-matched fish names; it holds fish results only. Entry scoped to Falco with pattern `Cirrhitichthys falco`.

## 3. Held-out claim id thompson1917-ch02-06 in law registries and simulation outputs

**Flagged:** 53 hits for `thompson1917-ch02-06` in `sim-engine/` (examples a-text-to-design, b-impossible-spec,
codesign-demo (output, mcp-log, transcript), e-predator, and `validate/results.json`). Each is a `law_id` in a lawset
verdict: the engine checks a design against Lean law `thompson1917-ch02-06` v1.0.0 (constraint C9/C10) under lawset 1.5.0.
All designs are fish (Danio rerio, Exocoetidae, Hemiramphidae and other teleost references); most verdicts are
`cannot-evaluate` for want of fin area, CLmax or airspeed.

**Question:** may a law formalised from a held-out claim exist in the public registry at all?

**Answer: yes, under the existing ruling.** `rulings.json` → `formal-statements-of-bird-linked-claims` (2026-10-31)
ruled that the Lean statements of `thompson1917-ch02-06` and `-07` are not a leak and do not burn the exam: a theorem
of a model carries no measurement and predicts no number bird data could score; the law is about any flier of fixed
proportions, and only Thompson's example is avian. The rule for builders applies "to data and to organism-specific
claims, not to a scaling law tested on non-birds or stated formally". The registry entry agrees with that reading: its
`scope.taxa` is `["any"]`, its hypotheses are aerodynamic and muscle-power premises, and its only empirical note is a
flying-fish specimen. Evaluating that theorem on a fish design is the same act as the physics thread's flying-fish test,
which the ruling tolerates. So the sim-engine references are tolerated under a `sim-engine/` allowlist entry scoped to
the two claim ids, citing the ruling. A sim-engine file that reads a bird row would still be a leak.

**Recommendation to the registry owner: do not retire the law.** Retiring it would discard a valid, bird-free
constraint and would not protect the exam, since nothing in it can be scored on birds. What the ruling did ask for,
and what is still open, is wording: the registry entries describe the bird claim, not the theorem. Recommended,
versioned, never deleted:

1. `thompson1917-ch02-06` v1.0.0 → new version (e.g. 1.0.1, wording only; `supersedes: 1.0.0`). `statement_en` begins
   "A bird of fixed proportions must fly at a minimum speed…". Restate it as "A flier of fixed proportions…", matching
   `scope.taxa: ["any"]` and the kernel-checked items. Keep the source quote where it is (claim text).
2. `thompson1917-ch02-07` v1.0.0 → new version. `statement_en` currently reads "The ostrich probably, and the moa
   certainly, reached a size at which flight … became physiologically impossible, and a bird as large as a man could
   not fly", with `status: accepted`. Under that label a reader takes the bird claim as proved, when the Lean content
   (`exists_size_limit`) proves only that a size limit exists under the premises. Restate it as the theorem ("under the
   cube law, the area law and the muscle-power premise there is a size above which power required exceeds power
   available"), and say in `scope.note` that nothing places the ostrich, the moa or a man-sized bird above it. This is
   the ruling's own instruction to the lean thread ("Label the theorem, not the claim").
3. Pin the reworded versions in the next lawset (1.7.0). Leave lawsets 1.0.0 to 1.6.0 as published (they pin v1.0.0);
   old results stay reproducible.

Files that carry these laws (the registry owner's, listed so the change can be checked; none edited here):

- `lean/registry/laws/thompson1917-ch02-06.json`, `lean/registry/laws/thompson1917-ch02-07.json`
- `lean/registry/lawsets/lawset-1.0.0.json` … `lawset-1.6.0.json` (all seven include both)
- published copies: `dashboard/public/api/lean/laws/thompson1917-ch02-0{6,7}.json`,
  `dashboard/public/api/lean/lawsets/1.0.0.json` … `1.6.0.json`, `dashboard/public/api/lean/{index,current,changes}.json`,
  `dashboard/public/t/lean/{laws,lean}.json`
- generators: `lean/registry/build-registry.mjs`, `lean/laws/build-laws.mjs`, `lean/laws.json`, `lean/LAWS.md`
- consumers whose outputs pin v1.0.0 under lawset 1.5.0: `sim-engine/examples/{a-text-to-design,b-impossible-spec,
  codesign-demo,e-predator}/`, `sim-engine/validate/results.json`, `sim-engine/validate/benchmark/{dev,heldout}/`.
  These need no change; they would pick up the new wording on their next run against lawset 1.7.0.

If the hub or Amit instead decides that a law formalised from a held-out claim must leave the public registry, the
mechanism is `status: "retired"` with a `retired_reason` (as `build-registry.mjs` already does for
`muscle-power-premise` and `E8`) in a new lawset, and the `sim-engine/` allowlist entry should then be removed so the
checker flags any output that still pins the law. That would reverse the 2026-10-31 ruling and should be recorded in
`rulings.json` first.

## 4. Gaps in the checker (proposal; check-leaks.mjs not edited)

`check-leaks.mjs` belongs to the holdout thread, so these are proposals, not changes:

1. **Scan `.gz`.** The browser bundle and the omics index are almost all `.json.gz`, and the omics layer files are
   `.jsonl.gz`; none is scanned today. Proposed: accept `\.(json|jsonl|csv|tsv|txt)\.gz$` in `EXT`, read with
   `zlib.gunzipSync`, and skip files over a decompressed size cap (the human 1000 Genomes VCF under
   `claim-tests/math-bio-theorems/maynardsmith-hitchhiking/data/` is over 512 MB decompressed and cannot be read into
   one string). Matching inside a decompressed single-line JSON gives line 1 for everything, so report a byte offset too.
2. **Scan the omics browser bundle.** Add `dashboard/public/blueprint3d/omics` to the default targets next to
   `dashboard/public/t` (and preferably all of `dashboard/public/blueprint3d/` and `dashboard/public/api/`, which hold
   published copies of thread data). `omics/index/` is already inside the scanned `omics/` root once `.gz` is read.
3. **Tighten the taxid signal.** `(taxid|taxon|ncbi)[^\n]{0,20}\b<id>\b` fires on NCBI *Gene* ids (`"ncbi":"8906"`,
   `"ncbi_gene":"30458"`, `ncbi.nlm.nih.gov/gene/30458`). Proposed: exclude `ncbi_gene`, `/gene/` and `"ncbi":` inside
   a gene object, or require `taxid`, `taxon`, `tax_id` or `/Taxonomy/` before the number.
4. **Homonyms to expect** once 1 and 2 land, each needing a scoped allowlist entry: the five gene ids above in
   `omics/genomic/annotations.jsonl.gz`, `omics/index/genes/*.json.gz` and the bundle's `genes/*.json.gz`; and *Rhea*
   (ratite genus) vs the RHEA reaction database in `omics/pathway/annotations.jsonl.gz` (223 matches, all
   `assigned_by`). Proposed entries: `{prefix, taxa: [the five], reason}` for the gene ids and
   `{file: "omics/pathway/annotations.jsonl.gz", taxa: ["Rhea"], pattern: "\"RHEA\"", reason}` for the database.

## Counts

| | before | after |
|---|---|---|
| hits (`check-leaks.mjs`, default scope) | 74 | 0 |
| allowlist entries | 26 | 36 |
| strong hits in `omics/index/` + `dashboard/public/blueprint3d/omics/` (gunzipped, separate scan) | 16 (all gene-id collisions) | 16 (unchanged; not bird data, not in checker scope) |

Added entries: `omics/genes.json`, `omics/proteomic/scripts/build.py`, `omics/validate.mjs`,
`sim-engine/generative/body/prepare.py`, `sim-engine/generative/test/generative.mjs`,
`sim-engine/validate/phenotype.mjs`, `sim-engine/validate/test/validate.mjs`,
`sim-engine/validate/scorer-results.run1-aves-filter-bug.json`, `sim-engine/validate/benchmark/build/build.py`, and
the `sim-engine/` claim-scoped entry for thompson1917-ch02-06/07.
