# Holdout: the exam nobody studied for

DELPHI's goal is laws that hold across organisms. A law fitted to the organisms it was built on
proves nothing about the rest, so before anything was built we set aside one whole clade as the
exam. Builders (claim tests, organism design, the swarm) work on the other organisms. When
building stops, an assessor who built nothing re-scores every supported law on the held-out
organisms with the same pre-registered pass and fail criteria. A law that passes there
generalizes; one that fails did not.

**Held-out clade: class Aves (birds), confirmed by Amit on 2026-10-31** ("Sure do AVes", relayed by
the hub). It was provisional from the first freeze at 05:52:44 UTC until the confirmation; the re-freeze
at 14:38:42 UTC cleared the flag and wrote the decision and its cost into `split.json`, `exam.json` and
`CHECKSUMS.json` (`decision`, `first_frozen_at`, `previous_freeze` with `roster_unchanged: true`). The hub
(session `scienceclaw-03`) had proposed it over Mammalia because birds are a clean monophyletic class,
carry fewer domestic-breed identifier tangles than dogs, cattle and horses, and AVONET gives a
full-coverage trait table for the exam. **The cost, chosen knowingly:** the held-out bird counts fall
below the builders' own minimum sample sizes (13 against 50 for Kimura heterozygosity, 8 against 15 for
Hamilton senescence), so both examined tests read inconclusive; Mammalia would have made 1 of 2 decisive
but would have made 3 already-built tests post hoc, including `thompson1917-ch16-13`, which is mammals-only.
A clean blind that cannot yet decide was taken over a decisive-looking test on a contaminated design. The
finding is about the data: the public trait and demographic tables cannot support a blind clade exam at the
builders' own minimum n for these laws. Mammalia stays available for building; the alternative is sized in
`alt/`, and switching would still be one line in `make-split.mjs` (`DEFAULT_CLADE`).

## Files

| file | what it is |
|---|---|
| `make-split.mjs` | The rule, as code. Reads four repo files and writes everything below. `--verify` recomputes and fails if anything moved. |
| `split.json` | Every inventory taxon with its assignment (`holdout`, `train`, `excluded`), the reason, identifiers, genome status and which trait tables cover it. |
| `exam.json` | The roster of held-out species, the rules for builders, the higher bird taxa also held out, and the claims whose organisms are birds. No trait values. |
| `holdout-taxa.csv` | The held-out taxa as a flat table. |
| `CHECKSUMS.json` | SHA-256 and size of the four inputs and three outputs, and the freeze time. |
| `alt/Mammalia/` | The same four files for the alternative clade, for comparison only. |

Inputs, read only: `organisms/merged/taxa.json`, `organisms/merged/datasets.json`,
`dashboard/genomes.cache.json`, `docs/claims.json`.

## The rule

1. An organism is held out when the inventory's lineage puts it in class Aves, at any rank
   (species, genus, family, order, or the class itself).
2. The rule is the class, not the list. A bird species that is not in the inventory is held out
   too.
3. A taxon above class rank that contains birds (Vertebrata, Dinosauria, and the other names in
   `CLADES.Aves.containers`) is excluded from both sides, because its data mixes them.
4. Everything else is available for building.
5. Genome-ready means the best NCBI assembly is chromosome-level or a complete genome. NCBI's
   "reference genome" flag is not enough: it also marks scaffold-level and contig-level
   assemblies, and 8 held-out species carry the flag without a chromosome-level assembly.

## Rules for builders

- Do not fit, tune, select or sanity-check anything on bird data: no Aves rows from trait
  tables (AVONET, AnAge, EltonTraits, the Amniote database), no bird genomes, occurrence counts
  or fossils, and no claim whose only organisms are birds.
- A claim test may name a shared table in `planned_datasets` only with class Aves filtered out,
  and the filter must be in the committed analysis script.
- Reading `exam.json` is allowed. It names organisms and identifiers; it holds no measurements.
- The exam runs once, after building stops. Check the roster has not moved first:

```
node holdout/make-split.mjs --verify
```

## Sizes (computed by `make-split.mjs`; the authoritative numbers are in `split.json` → `summary`)

| | Aves (held out) | Mammalia (alternative) |
|---|---|---|
| taxa in inventory | 88 | 105 |
| species or subspecies (the exam roster) | 48 | 43 |
| roster with any NCBI assembly | 43 | 38 |
| roster genome-ready (chromosome-level or complete) | 35 | 31 |
| roster with at least one trait table | 48 | 40 |
| roster genome-ready and with a trait table | 35 | 29 |
| claims whose organisms are only in the clade | 12 | 25 |
| claims mixing clade and training organisms | 13 | 15 |

Rows for Mammalia come from `alt/Mammalia/split.json`. Claim counts cover the 98 claims that
the inventory links to an organism; the other 782 claims name no organism.

## Fixes made to `organisms/` on the way (2026-10-31, holdout thread)

`node organisms/merge.mjs` listed 11 conflicts. All are resolved; it now lists 0.

- **Four identifier conflicts.** The dog record (GBIF 6164210, *Canis lupus familiaris*) carried
  two Wikidata items and two ITIS numbers across slices; the elephant record (GBIF 9427,
  *Elephantidae*) carried two Wikidata items. Checked against the Wikidata and ITIS APIs:
  Q26972265 is the *Canis lupus familiaris* item (P846 = 6164210, P815 = 726821) and Q20717272
  is the species-rank *Canis familiaris* item; ITIS 726821 is *Canis lupus familiaris* (marked
  invalid by ITIS, accepted TSN 183815 *Canis familiaris*); Q2372824 is the *Elephantidae* taxon
  item and Q7378 is the common-name item "elephant" with no GBIF, NCBI or ITIS link. Slice files
  now agree, and each edited file says why in `notes`.
- **Seven count conflicts.** Three agents counted the same files differently. Re-downloaded
  (same SHA-256 as recorded): EltonTraits `BirdFuncDat.txt` has 10203 rows with a SpecID, 10011
  with a scientific name and 9993 with a diet record (the paper's species count), which explains
  10203, 10011 and 10205 (the last counted two blank tab-only lines); `MamFuncDat.txt` has 5400
  species rows and three blank tab-only lines (5403); AnAge `anage_data.txt` has 4645 data rows
  and one blank line (4646). Two slices had counted GBIF occurrences for the dog under the synonym
  key 5219200 (99879) instead of the accepted key 6164210 (124431); both now record the accepted
  key, re-queried, and keep the synonym count under its own property.

## Leak check: scope and rulings (widened 2026-10-31)

`node holdout/check-leaks.mjs` scans every top-level folder except the exam itself and its inputs (`holdout/`,
`organisms/`, `docs/`, `dashboard/` other than the per-thread data copies under `dashboard/public/t`, `node_modules/`,
`assets/`), including every thread's nanopub drafts (`.trig`), Lean modules and JSONL logs. Until 2026-10-31 it scanned
only `claim-tests/`, `organism-design/` and `swarm/`, and skipped `.trig` and `.lean`; the hub's curation pass, not the
checker, caught a bird-titled draft in `lean/nanopubs/`, which is what prompted the widening. Three signals: the
scientific name, slug, NCBI taxid or GBIF key of a held-out taxon (hit); the id of a claim whose inventory organisms
are all held out, 12 ids from `exam.json` (hit); class-level words and the 13 mixed-organism claim ids (warning).
Common names are not matched, which is why the claim-id signal exists. Every tolerated hit is an entry in
`leak-allowlist.json` with a reason; entries can be scoped to named taxa or claim ids, and the pre-freeze extraction
folders (`darwin-origin/`, `thompson-growth-form/`, `truth/`) are tolerated only for files whose first git commit
predates the first freeze, checked with `git log`.

Rulings on questions other threads raise are in `rulings.json` and cited from the allowlist. The first: a Lean 4
theorem of Thompson's flight-scaling law (`thompson1917-ch02-06`, `-07`, claims whose inventory organisms are birds)
is not a leak and does not burn the exam, because a theorem of a model carries no measurement and predicts no number
that bird data could score; the physics thread's test of the same law on flying fish, with Aves dropped at parse
time, is tolerated on the same reasoning. The ruling also tells the lean thread that a label reading "Ostrich and
moa have passed the size ... (Lean 4, kernel-checked)" names the bird claim as the thing proved, when only the
existence of a size limit was.

## Power: which clade lets the exam reach a verdict? (added 2026-10-31)

`node holdout/power-analysis.mjs` re-runs each completed claim test on a scratch copy with Aves held out and
then with Mammalia held out, and applies the builder's own rule, including its minimum sample size, to the
held-out species alone. Output: `holdout/power-analysis.json`, shown on the sub-dashboard. The frozen Aves split
does not move. First run: Kimura heterozygosity is underpowered for either clade (13 bird or 40 mammal species
against a minimum of 50); Hamilton senescence is underpowered for birds (8 against 15) and decisive for mammals
(20 against 15). A switch to Mammalia now would be post hoc for tests already built with mammal rows.

The power table as a standalone finding, written for the next team so the attempt is not repeated, is
`holdout/POWER.md` (generated from the same files by `node holdout/power-finding.mjs`; a copy ships with the
sub-dashboard at `/t/holdout/POWER.md`).

Triage of all 16 completed claim tests (2026-10-31, 13:30 UTC): 2 were examined on birds (Kimura heterozygosity,
Hamilton senescence; both inconclusive under the builders' own minimum n), and 14 contain no bird rows at all, so no
exam applies; they are listed with reasons in `holdout/exam-results/not-applicable.json`. One of those 14 matters
for the clade decision: `thompson1917-ch16-13` (carnivoran and cetacean vertebrae) uses mammals only, so under a
Mammalia holdout that whole test would already be built on held-out data. The post hoc count for a switch to
Mammalia is therefore three built tests, not two.
