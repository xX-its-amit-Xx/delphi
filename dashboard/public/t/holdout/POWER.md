# The public tables cannot support a blind clade exam at the builders' own minimum n

**Finding.** For the two laws whose tests draw on cross-species public tables, holding out one whole class
leaves fewer species than the builders' own pre-registered minimum sample sizes, so a blind exam on that class
cannot reach a verdict. With birds held out: 13 species against a minimum of 50 for kimura-heterozygosity; 8 species against a minimum of 15 for hamilton-senescence.
With mammals held out instead: 40 against 50 for kimura-heterozygosity (inconclusive); 20 against 15 for hamilton-senescence (mixed).
Of the 16 completed claim tests in this project, only these 2 contain bird rows at all; 14 draw on
humans, insects, fish, molluscs, extinct cephalopods, plants, mammals only, or non-biological series.

This is a result about the state of the data, not about the thread that measured it. It is stated here so that the
next team does not repeat the attempt expecting a decisive blind result from these tables at these minimums.

## The numbers

| test | held out | held-out species with usable values | builder's minimum n | verdict on held-out species | measured on held-out species | training set left (verdict) |
|---|---|---:|---:|---|---|---|
| `kimura-heterozygosity` | Aves (frozen) | 13 | 50 | inconclusive | 0.069 OLS slope of log10(pi) on log10(census N) among held-out species only | n = 160 (refutes) |
| `kimura-heterozygosity` | Mammalia (what-if) | 40 | 50 | inconclusive | 0.058 OLS slope of log10(pi) on log10(census N) among held-out species only | n = 133 (refutes) |
| `hamilton-senescence` | Aves (frozen) | 8 | 15 | inconclusive | 0.625 fraction of held-out species with Spearman rho(age, adult mortality) > | n = 35 (mixed) |
| `hamilton-senescence` | Mammalia (what-if) | 20 | 15 | mixed (decisive) | 0.750 fraction of held-out species with Spearman rho(age, adult mortality) > | n = 23 (refutes) |

Decisive exams by clade: Aves 0 of 2, Mammalia 1 of 2.

| clade | inventory taxa held out | roster species | genome-ready (chromosome or complete) | with a trait table | claims whose organisms are only in the clade |
|---|---:|---:|---:|---:|---:|
| Aves | 88 | 48 | 35 | 48 | 12 |
| Mammalia | 105 | 43 | 31 | 40 | 25 |

## Where the minimums come from

The minimums are the builders' own, pre-registered before the data were downloaded, and the exam applies them
unchanged (holdout/EXAM.md). Verbatim:

- **kimura-heterozygosity**: Pre-registered. REFUTES if the 95% confidence interval of the slope lies entirely below 0.25 (diversity rises less than a quarter as fast as census size on a log scale, so the law with N as the proxy for Ne is quantitatively wrong by orders of magnitude across the range of N: the Lewontin's-paradox pattern) OR rho <= 0. MIXED otherwise. INCONCLUSIVE (underpowered) if fewer than 50 species qualify; INCONCLUSIVE (data-unavailable) if the file cannot be downloaded.
- **hamilton-senescence**: Pre-registered. REFUTES if fewer than 50% of qualifying species show rising adult mortality. MIXED otherwise (50% to 80%, or >= 80% with mean rho <= 0.3). INCONCLUSIVE (underpowered) if fewer than 15 species qualify; INCONCLUSIVE (data-unavailable) if the file cannot be downloaded or read.

Data behind the two tests: Buffalo (2021) 'Why do species get a thin slice of pi?' combined species table (doi:10.7554/eLife.67509); COMADRE Animal Matrix Database v4.26.4.0 (3548 matrix population models, 445 species) (doi:10.1111/1365-2656.12482).

## What was decided, and what it cost

Class Aves was confirmed as the held-out clade on 2026-10-31 by Amit Shenoy, project lead, in his own words to the hub: "Sure do AVes", after being provisional from
the first freeze at 2026-10-31T05:52:44.982Z; the re-freeze (2026-10-31T14:38:42.937Z) left the roster unchanged.
The choice was made knowing the table above. Mammalia would have made 1 of 2 exams decisive, but the
2 examined tests had already fitted on mammal rows and `thompson1917-ch16-13` uses mammals only, so a
switch would have made 3 already-built tests post hoc. A clean blind that cannot yet decide was taken over a
decisive-looking test on a contaminated design.

## What this does and does not establish

- It establishes that, at the builders' own minimums, these public tables leave a blind bird exam underpowered for
  both laws, and a blind mammal exam underpowered for one of them.
- It does not establish that either law holds or fails in birds; the measured values above are reported for the
  record and no verdict rests on them.
- It does not establish that a blind clade exam is impossible in general: a larger cross-species table, a lower
  pre-registered minimum justified in advance, or a test designed around a clade-rich dataset would change it.
- It says nothing about operationalisation: the exam applies each builder's own rule, and the collaborator
  cross-check (dashboard/public/crosscheck.json) is where verdicts are compared across operationalisations.

## Reproduce

```
node holdout/make-split.mjs --verify          # the frozen roster (exam.json SHA-256 f59b7b8ca2bdee21960f6a773de60967bc5c2933ffc75ee9da64e089228f5c7e)
node holdout/power-analysis.mjs               # re-runs each test's analysis.py --exam with the class filter swapped, on scratch copies
node holdout/power-finding.mjs                # this file
```

Generated 2026-10-31T14:46:42Z from `holdout/power-analysis.json` (2026-10-31T14:41:43.541Z), `holdout/exam-results/not-applicable.json`,
`holdout/split.json` and `holdout/CHECKSUMS.json`.
