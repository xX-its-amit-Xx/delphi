# crispr-ontarget — does the score we rank guides with predict anything?

The validation system designs CRISPR edits. Nothing had ever checked whether the number it ranks
candidate guides by has any relationship to whether a guide works in the organism it is designing for.

This benchmark checks it, against **307 sgRNAs with activity measured in injected zebrafish embryos**.

```
node benchmarks/crispr-ontarget/test.mjs [--fail-once]      # no network, no genome
node benchmarks/crispr-ontarget/run.mjs --data <extracted.json>
```

The ground truth is not in this repository — see `SOURCES.md` for how to rebuild it in three `curl`s.

## The result

Spearman correlation against measured mutagenesis, 307 guides, 95 % intervals from a seeded bootstrap:

| score | what it is | ρ | 95 % CI | excludes zero |
|---|---|---:|---|---|
| **CRISPRscan** | fitted **on zebrafish injections** | **0.269** | [0.165, 0.364] | yes |
| **Doench 2014 Rule Set 1** | fitted on human and mouse cell lines — **what `editplan` uses** | **−0.037** | [−0.149, 0.073] | **no** |
| **our heuristic** | weights we chose, fitted to nothing | **0.082** | [−0.024, 0.196] | **no** |

**The score this project ranks guides by is statistically indistinguishable from no information**, on the
organism the whole design program targets. Our own heuristic is no better. Both intervals straddle zero;
Doench's point estimate is slightly negative.

This is not a criticism of Doench 2014, which never claimed to transfer. `doench2014.mjs` says so in its
own text — *"fitted on sgRNAs tiling mouse and human genes in cell lines … Using it here is a TRANSFER
ACROSS SPECIES AND ASSAY"*. The finding is that the transfer does not survive contact with the target
organism, which is a fact about **this project's ranking**, not about the original model.

### The caveat that decides how to read the table

**CRISPRscan is being scored on data from the study that fitted it.** The 499 guides and the 92
coefficients come from the same paper, so 0.269 is an upper bound on its advantage, not an estimate of it.
Doench and the heuristic have never seen this data, so their numbers *are* honest held-out estimates.

Read it that way and the finding is sharper, not weaker: the model with home advantage reaches 0.27, and
the two being used reach zero. A fair comparison for CRISPRscan needs an independent zebrafish dataset,
and that is the obvious next piece of work.

## Why this needed a genome

The supplementary tables give the oligo, not the genomic context, and both context-dependent models need
the flanks. So every guide is located in **GRCz11** by exact match using the index
`sim-engine/validate/editplan/grcz11-local.mjs` already builds for off-target scanning — a full scan of
the 26 chromosomes, 1,345 Mbp.

Guides are queried with their **3′-most 20 nt**, because a T7 oligo's added 5′ G's are not genomic. The
protospacer is then defined as the 20 nt immediately 5′ of the PAM, which lets an 18-mer and a 22-mer
oligo both be scored on the same genomic site.

**307 of 499 located uniquely; 1 was multi-hit and 191 did not match.** Those 191 are a selection, not a
random sample, so the headline is a statement about the 307.

## The reimplementation, and how it was verified

CRISPRscan did not exist in this codebase. Its 92 coefficients are published, so it is reimplemented here
the same way `doench2014.mjs` reimplements Rule Set 1 — with one advantage: the paper also publishes **25
scored sgRNAs**, so the implementation can be checked against the authors' own outputs rather than only
against their coefficient table.

**The coordinate system was derived rather than assumed.** The feature names (`A04`, `T21`, `AG34`) give a
position in 1..35 but not what position 1 is. Every offset from 0 to 12 was scored against those 25
guides:

```
offset  6 :  ρ = 1.0000,  max |difference| = 0.0000     <- the layout
every other offset 0..12 :  |ρ| ≤ 0.43,  max |difference| ≥ 0.32
```

So the 35-mer is 6 nt upstream + 20 nt protospacer + 3 nt PAM + 6 nt downstream, and that is a
measurement. `selfTest()` re-runs it against the committed fixture.

**It failed the first time, for a reason worth keeping.** The genomic windows were built from the scan's
`start`/`end` coordinates — correct on the plus strand and wrong on the minus strand, because
reverse-complementing a window flips its flanks too. Only **5 of 25** protospacers sat where the
arithmetic said they would, and the offset sweep then showed a best fit of ρ = 0.75 at the *wrong* offset:
a plausible-looking number that was entirely an artefact of misalignment. Anchoring on
`indexOf(spacer)` has no coordinate convention to get wrong; all 25 then matched and the true offset
reproduced the scores exactly.

## What this does and does not establish

**Does**: that the on-target ranking in `editplan` carries no measurable signal about editing efficiency
in zebrafish, and that a published model which does carry some is available and now implemented.

**Does not**: that a high-scoring guide produces a phenotype. The bench package's central finding is that
in the fin-size program *the knockouts are phenotypically normal*, so cutting well and mattering are
different claims, and this benchmark only measures the first. `controls.mjs` already records the
companion finding from the other direction — Lin et al. 2025 measured that cutting efficiency does not
correlate with phenotype penetrance.

Nor does it say anything about off-targets, about HDR, or about any geometry other than SpCas9 with an
NGG PAM.

## The files

| file | what |
|---|---|
| `crisprscan.mjs` | the model, its 92 published coefficients, the derived 35-mer layout, and `selfTest()` |
| `stats.mjs` | Spearman with averaged tie ranks, and a **deterministic** seeded bootstrap |
| `run.mjs` | locate → build context → score three ways → correlate |
| `fixtures/published-scores.json` | the 25 verification rows |
| `results.json` | the derived numbers, committed |
| `SOURCES.md` | how to rebuild the ground truth, and what may not be redistributed |

The bootstrap is seeded on purpose: an interval that comes out different on every run cannot be
distinguished from a real change by anyone reading two reports.
