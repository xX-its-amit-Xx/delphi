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
| `bench.mjs` | assembles all of it. |

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
