# bench — from a cassette to an order form

`sim-engine/validate/editplan/` answers *what would it take to make this edit*. This module answers the
two questions a PI asks next: **is this experiment worth a bench-month**, and **what do I order**.

```
node sim-engine/validate/bench/cli.mjs --list
node sim-engine/validate/bench/cli.mjs --case kcnk5b-f0-finbud
node sim-engine/validate/bench/cli.mjs --case kcnk5b-f0-finbud --out C:/Temp/order
node sim-engine/validate/bench/test.mjs [--fail-once]
```

Nothing here is a protocol, a quote, or permission to start. Institutional animal-care approval comes
first and this module cannot grant it. Danio rerio only, matching editplan's species refusal.

## What it found, which was not what we expected

**In the fin-size program the winged-zebrafish design edits, the knockouts are phenotypically normal.**
Verified against the primary papers in this run:

| gene | the null allele | source |
|---|---|---|
| `kcnk5b` | "A revertant of alf^dty86d (j131x8) shows wild type-sized fins." | Perathoner 2014, doi 10.1371/journal.pgen.1004080 |
| `kcnh2a` | "homozygous loss of kcnh2a has no overt effects on zebrafish development to adulthood, including fin length" | Stewart 2021, doi 10.1242/dev.199384 |
| `lat4a` | "Zebrafish with homozygous loss-of-function mutations in lat4a are phenotypically normal and viable" | Daane 2021, doi 10.1016/j.cub.2021.08.054 (preprint wording) |

So the cheap edit — a frameshift knockout, no donor, readable in injected embryos — **tests nothing here**.
Every informative edit in this program is a precise gain-of-function point change: 1–4 % error-free HDR,
screening for a rare event, and a generation before anything can be scored. That commitment is invisible in
the edit plan, which is why `cases.mjs` states it before any of the money.

Three corrections to the edit plan fell out of the same reading, in `cases.mjs` `ALLELE_CORRECTIONS`:
`p.W169L` and `p.F241Y` are **two separate alleles**, not one genotype; the `alf` alleles are **dominant**,
so a heterozygous F1 suffices and an intercross is not needed; and the `kcnh2a` fin allele is a
**chromosome-2 inversion driving ectopic expression**, which no guide-and-donor edit of the coding sequence
reproduces.

## The files

| file | what it holds |
|---|---|
| `cases.mjs` | candidate experiments, each with a PUBLISHED expected answer or an explicit statement that it has none. Ranked by readable-in-injected-generation, then has-numbers, then generations-to-answer. |
| `controls.mjs` | positive controls, and `GUIDE_PLACEMENT` — the finding that criticises our own planner. |
| `conditions.mjs` | the condition matrix, the `TRAPS` list, and the published stop rules. |
| `sop.mjs` | the staged plan: a published method cited per stage, and a gate saying what must hold before the next one. |
| `catalog.mjs` | real catalogue numbers and public list prices, each with a read date. |
| `quantities.mjs` | the arithmetic, dependency-free and tested against hand-computed examples. |
| `order.mjs` | the two export artefacts and why there must be two. |
| `power.mjs` | how many animals, and a refusal naming the one missing quantity where that cannot be computed. |
| `return.mjs` | the data-return contract: what a partner lab must send back for a result to be evidence. |
| `bench.mjs` | assembles all of it. |

## The audit, 2026-11-06: four corrections to this package and one route it was missing

This package was audited against its own primary sources before being shown to a prospective partner lab.
Everything below is a correction to what is written above, not a new feature.

**1. The route that produces the direction the design wants was not in the file at all.** Every case here
was an *edit*. The published experiment that enlarges fins **in the injected generation, with no cross and
no point change**, is overexpression of the **wild-type** gene from an injected Tol2 plasmid: `ef1a:kcnk5b`
with `ef1a:DsRed` in cis, co-injected with transposase mRNA into the one-cell zygote. Control plasmid
**0/240**; overgrowth in **about 40 %** of injected fish *showing DsRed-positive fin cells*; association
with DsRed-positive mesenchyme **89.2 %, N = 37**; a conductance-dead GFG→AAA variant **no overgrowth,
n = 32**; and independently, transplanted mutant cells gave overgrowth in **29 of 120 chimeras**. The
paper's own words: overexpression "is sufficient to induce fin outgrowth". `Tol2` appeared **zero times**
in this repository before the audit.

It is now `kcnk5b-overexpression-f0` and it takes **rank 1** — under the *unchanged* ranking rule, because
it is scorable in the injected generation *and* has published numbers, which the 48 hpf case does not.
`RANKING_CHANGED` records that, and the trade the ranking does not capture: rank 1 answers in about four
months (raise injected fish to adulthood) where rank 2 answers in two days. Its marginal reagent cost is
**$168.60** against $753.40 for the knockout route — and it is **the first emitted package whose total
declares itself a lower bound**, because the construct is in no repository and cannot be priced. The
lower-bound mechanism had existed and been unit-tested since the start without any real package ever
triggering it.

**2. The one quantitative expectation was for the wrong fin.** The allometric coefficient (wild type
k = 1.29, *alf*/+ k near 2) is measured on **caudal** fins; the design's claim is about **pectoral** fins;
and the `assay` field said only "fin length". Recorded now as `measurement_mismatch`, status UNRESOLVED,
with what would resolve it — a wild-type pectoral allometry, which a partner lab could measure from
existing adults with calipers and no injection at all.

**3. An n was attached to a measurement that has none.** "n = 4 per group, error bars SD" belongs to
Fig. 1C — segment length and segment *number* in the longest ray of the **dorsal** fin. Fig. 1D, the
allometric regression this case uses, states no n: it is a regression across development. The record had
merged two panels. Both errors are kept in
`published_expectation.a_correction_to_our_own_first_version` rather than quietly fixed.

**4. The source's own explanation for the null phenotype was missing.** Perathoner 2014 attributes it to
paralog redundancy: *kcnk5b* has a close paralog *kcnk5a* expressed in similar tissues. Without that
sentence, "the knockout is normal" reads as evidence the gene does not control fin size, when the paper
reads it as redundancy. A *kcnk5a/kcnk5b* double knockout is therefore a different, unplanned experiment
with no published expected answer.

## How many animals — and the four refusals

Every route's plan ends on the gate *"the comparison was powered before the embryos were injected"*. Until
the audit, nothing in the package could satisfy it: `power` appeared only as a gate and as a cost driver,
and no case computed a sample size. A gate nothing can pass is decoration.

`power.mjs` now computes N where the literature supplies what a computation needs — **which is exactly one
case**. For `kcnk5b-overexpression-f0` both comparison arms have published rates, so:

- against the marker-only control: **16 per arm**;
- against the conductance-dead control: **30 per arm** — the binding one, so **30**.
- The 0/240 control enters as its **rule-of-three upper bound, 1.25 %**, never as zero: using 0 would make
  the comparison look easier than the data supports.
- The smallest expected cell count is 0.2, so the output tells you to use **Fisher's exact test** and that
  it will want slightly *more* animals than the normal approximation says, not fewer.
- And **N counts scorable adults carrying fin-expressing clones, not injected embryos.** Two unpublished
  fractions sit between the two numbers — survival to adulthood on this mix, and the fraction of adults
  expressing in the fin, which the published 40 % is itself conditioned on. A first session measures both,
  and that measurement is publishable in its own right.

The other four cases **refuse**, each naming one missing quantity and where it would come from. Three of
the four are **data requests, not experiments** — most importantly the 48 hpf case, which needs the
per-comparison values from Jiang et al. 2024's S4 Data and would then become the cheapest informative
experiment in the set. The refusals state in words that a conventional effect size will not be substituted:
a sample size derived from convention rather than from this system's own numbers would look identical to a
real one inside the plan, and would be the most dangerous number in it.

## What comes back from a lab

`return.mjs` is the contract for a returned result, and it did not exist before: the repo had no ingest
format for an external measurement anywhere. Every field is required or absent — no "optional but
recommended", because the fields a tired person skips are the ones that decide interpretability. A result
that cannot fill a required field is **not rejected**; it is accepted with `usable_as_a_label: false` and
the reason, which keeps it out of any calibration set without throwing it away.

Two fields earn their place on their own: **per-animal values, not a summary** (a mean and an SD cannot be
re-analysed, pooled or checked), and **`what_went_wrong`, required and non-empty** — "nothing" is an
acceptable answer but has to be typed. `source.doi_or_url` is explicitly nullable, the one change from the
`ontogeny.json` record shape, because an unpublished lab result has no DOI and must not borrow one.

## Three things worth knowing before reading a number

**Reagent cost scales with the number of CONDITIONS, not the number of embryos.** A condition needs a few
microlitres of mix; the embryos consume about one per cent of it. Doubling embryos per arm is free; adding
an arm costs a whole mix. `quantities.injectionMix()` returns both volumes so the package can say this
rather than imply the opposite.

**Two totals, and quoting the wrong one is wrong by about 3×.** For the cheapest case: **$753** is what the
experiment adds in a lab that already runs injections — nuclease, guides, primers, sequencing. **$3,143** is
the whole list, including about $2,390 of bulk salts, consumables and general kits that such a lab already
owns. Neither number includes husbandry, labour, facility or capital, and every price is a **list** price.

**There is no universal ordering-portal format.** Only some portals have an end-user bulk upload at all, and
several of the importers that exist can only be run by a buyer. For punchout suppliers a buyer-authored file
is structurally impossible, because the vendor owns the part-number keyspace and sets the price per session.
So `order.mjs` emits a portable requisition CSV *and* a per-vendor quick-order file, and documents the
workflow that actually works: punch out, paste the vendor file inside that session, return the cart — which
is also what replaces these list prices with the institution's contract prices.

## The criticism of our own edit planner

`controls.GUIDE_PLACEMENT`. The planner ranks knockout guides by on-target **cutting** efficiency and filters
to cuts in an early coding exon. Lin et al. 2025 (doi 10.1093/nar/gkaf180) measured both choices, and both
quotes were read from the paper in this run:

- "However, no significant correlation was observed with Lindel score and editing efficiency."
- "Contrary to common strategies, targeting early coding exons to induce PTCs was not effective in achieving
  high phenotype penetrance."

The planner is not *wrong* — it labels its score honestly as a cutting score and never calls it a phenotype
score. The gap is that nothing downstream converts cutting into the probability of seeing anything, so a high
on-target score reads as "likely to work" when the published evidence does not support that. The suggested
change is a domain-position term reported as a **separate order**, the way editplan already reports several
orders that disagree. Note that Lin and Kroll give **opposite** advice on exon strategy and both are
peer-reviewed; that is recorded as an open disagreement, not resolved here.

## Honesty rules enforced in code, not comments

- A price with no read date and no `sourced` flag cannot be in the catalogue (test 8).
- A total containing an unpriced line declares itself a **lower bound** (test 3).
- A line with no catalogue number is marked in the CSV as one that will become free text (test 9).
- Nothing is marked `verified_in_this_run` without the quote it was verified against (test 6).
- Every case has a published expectation or is labelled as having none (test 5).
- Priced rows lacking a direct product URL are counted and named rather than passing unnoticed (test 8).

`node sim-engine/validate/bench/test.mjs` — **17 pass, 0 fail**. `--fail-once` injects a fault into each
test's subject: **17 FAIL, 0 PASS**, so every assertion dies when its subject is broken.
