# Pre-registered scoring rule: organism-design predictions on the Aves roster

Written 2026-10-31 by the holdout thread (scienceclaw-93) **before** `organism-design/exam/aves-predictions.json`
exists and before any bird trait row was opened by this thread. The organism thread (scienceclaw-32) will emit,
for each of the 48 roster species, a list of `{structure_iri, label, predicted: present|absent, reason}` from
ontology reasoning and identifiers only. This file fixes how that output is scored. It is not edited after the
predictions land; a change is a new file with a new date and a stated reason.

## Ground truth sources (public, named in the inventory, read only at scoring time)

| test | structure asked of the tool | ground truth | source |
|---|---|---|---|
| A. keel | `carina of sternum` (UBERON:0010292 or the tool's nearest Uberon term for the sternal keel) predicted present or absent | absent for palaeognath ratites, present otherwise. Ratite = NCBI Taxonomy lineage contains Struthioniformes, Rheiformes, Casuariiformes or Apterygiformes; every other roster species is scored present. | NCBI Taxonomy lineage for the roster taxid (`https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/<taxid>`) |
| B. foot webbing | `interdigital webbing` or `webbed foot` (the tool's Uberon term) predicted present or absent | present if AVONET `Primary.Lifestyle` is `Aquatic`, absent if `Terrestrial`, `Insessorial` or `Aerial`; species with `Generalist` are not scored. | AVONET supplementary dataset 1, figshare DOI 10.6084/m9.figshare.16586228, the file already recorded in `organisms/merged/datasets.json` (sha256 there) |
| C. no conflicts | the blueprint for the species has an empty `reading.conflicts` | self-consistency only; not a trait test | the prediction file itself |

Species whose prediction file lacks the structure (neither present nor absent) count as `not predicted` and are
excluded from the denominator of that test, and their count is reported.

## Pass and fail criteria

- **Pass**: for tests A and B each, accuracy ≥ 0.80 with at least 10 scored species, and test C holds for at
  least 40 of 48 species.
- **Fail**: accuracy < 0.60 on either A or B with at least 10 scored species.
- **Inconclusive** (`underpowered`): fewer than 10 scored species on A or B.
- Anything between 0.60 and 0.80 is `mixed`.

Chance level for A is high (only a few ratites are on the roster), so the report also gives recall on the
absent class for A: how many of the ratites the tool got right, out of how many it predicted.

## Preconditions (see `holdout/EXAM.md`)

1. `node holdout/make-split.mjs --verify` passes.
2. The prediction file carries the `exam.json` SHA-256 from `holdout/CHECKSUMS.json` and it matches.
3. `node holdout/check-leaks.mjs organism-design` exits 0 (the deleted pigeon example stays deleted; the
   prediction file itself will name roster species, so `organism-design/exam/` is allowlisted for that reason).

## Output

`holdout/exam-results/organism-design/result.json` in the shape given in `holdout/EXAM.md`, with `exam_measured`
holding the accuracy, n scored and n not-predicted for A and B, and the conflict-free count for C, all computed by
`holdout/exam-results/organism-design/score.mjs`, which is committed beside it.
