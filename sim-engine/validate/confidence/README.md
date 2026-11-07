# confidence — a pLDDT analogue that refuses to be a probability

[Issue #7](https://github.com/fractastical/delphi/issues/7) asks for two things that are really one: a
per-design self-confidence number, and a loop that feeds lab results back so the modelling framework
updates itself. A confidence number is only worth printing if something can falsify it, and the only
thing that can is an outcome.

**This repository has zero outcomes.** So this layer does the four things that are possible without them,
and refuses the one that is not.

```
node sim-engine/validate/confidence/test.mjs [--fail-once]
node -e "import('./sim-engine/validate/confidence/promote.mjs').then(p=>console.log(p.audit().the_finding))"
```

| file | what it does |
|---|---|
| `target.mjs` | the pre-registration: **what** a confidence score predicts the error of, chosen before anything was fitted, hashed |
| `conformal.mjs` | split-conformal INSIDE/OUTSIDE calls over the frozen calibration tables, and `probability()` which exists only to refuse |
| `register.mjs` | the prediction register — content-hash ids, pre-registered criteria, an empty slot for a lab result, and a refusal below 22 labels |
| `promote.mjs` | the promotion gate for a self-updating scorer. **On its first run it finds that the shipped default would not pass it.** |

Nothing here refits anything. It reads two frozen artefacts belonging to the scorer thread — the
leave-one-family-out calibration table and the evaluation results — strictly read-only. The layer adds
*statements*, not fits.

## What makes pLDDT possible, and what we have instead

pLDDT is a regression head supervised against **experimental structures**: the PDB with a maximum release
date of 2018-04-30, a window containing **139,403 entries, 122,770 protein-only** (counted from the RCSB
search API, because neither AlphaFold paper states a training-structure count — the widely repeated
~170,000 is not in them). Its published calibration is `lDDT-Cα = 0.997 × pLDDT − 1.17, r = 0.76` over
n = 10,795 chains.

Our benchmark's labels are *"is this trait vector a real animal or a shuffled decoy"* — 10,749 positives
against 12,606 **synthetic** negatives. That is a strictly easier question than "will this design work",
and no row in it is a lab result on a designed organism.

**And the number that decides what may be claimed.** On **614 experimentally characterised de novo
designed monomers** (269 successful, 43 %), pLDDT-class metrics separate success from failure at
**ROC AUC 0.60–0.72** — AlphaFold3 pLDDT *worst* at 0.60 — with no transferable threshold, because the
distributions are topology-dependent ([10.1002/pro.70453](https://doi.org/10.1002/pro.70453)). That is
the best-supervised confidence score in structural biology, asked the question a design pipeline actually
asks. Any number this project publishes should be read against **0.60–0.72**, not against pLDDT's r = 0.76
on a different question.

So the single most likely way this work misleads a partner lab is quoting the internal best (AUC 0.8833
separating real specimens from shuffles) as though it were the external one.

## The target quantity, chosen and frozen

Three candidates, in `target.mjs`, and the chosen one is the only one computable today:

- **morphometric residual** — rejected: it is what the existing scorer already computes, so adopting it
  would make the confidence score a restatement of the thing being evaluated.
- **phenotype appeared in F0** — the *right* target, and unavailable. Recorded as the one the register is
  built to collect, so the first 22 observations land in a calibration set rather than an inbox.
- **inside the real envelope** — **chosen.** For a design and a miscoverage rate α, an INSIDE/OUTSIDE call
  against the distribution of `q = D²/d` over real animals, at the empirical (1−α) quantile computed with
  each real animal's own family held out.

It is chosen because the guarantee is about a quantity that genuinely exists — the fraction of real
animals whose score falls below a threshold — and because it cannot be mistaken for a success probability
if it is always reported as a coverage statement.

`hash()` freezes the file. Editing it after a calibration number exists would be the one failure that
makes everything downstream worthless, which is the same rule `score-weights.json` already carries.

## What the conformal wrapper actually returns

At `fishshapes`, d = 5, α = 0.05 over **n = 10,694** calibration points:

```
conformal level  0.950159      ->  96th percentile  ->  threshold q = 3.4516204
coverage bound   1-α ≤ P(a real animal is INSIDE) ≤ 1-α + 1/(n+1)   i.e. 95.00 % … 95.0094 %
```

The quantile index is **rounded up**, and the output says so: rounding up makes the region larger and the
guarantee conservative, while rounding down would break it silently and in the flattering direction.
Because the table stores whole percentiles, the finest α it can serve honestly is 0.01 — stated rather
than quietly saturating.

An OUTSIDE call says what it does *not* mean: *"roughly 5 % of real animals also score worse than this,
so OUTSIDE is not 'impossible' — it is 'unusual among measured animals'."*

**`probability()` exists only to refuse**, and the refusal is a number rather than an opinion: read as a
probability, the shipped score is measured at held-out **ECE 0.4765, Brier 0.4648**, with 20,989 of 23,355
items in the top bin.

### The caveat that does not go away with more data

Split conformal needs **exchangeability**: loosely, that the design could have been one of the real
animals. A designed organism is constructed to sit where no real animal sits — that is the point of
designing it. So the one assumption the guarantee rests on is violated by the act of using it.

What survives intact is the threshold: *"95 % of real fish have q below 3.45 at d = 5"* is a measured fact
about real fish. What does not survive is reading the design's side as a probability. Weighted conformal
handles a *known* covariate shift; this shift is the design intent, which differs for every design.

Conditional coverage is also **impossible in general**, so an INSIDE call for one design says nothing
about the next one of its kind.

## The register, and the number 22

A returned measurement becomes a *label* only if three things were fixed before it arrived: which
prediction it tests, what would count as right, and which code produced it. So a prediction id is the
**SHA-256 of the prediction's own content** — identical predictions share an id, and changing any field
produces a different id rather than silently overwriting a record.

Four refusals earn their place:

- **a criterion nothing can fail is refused.** `"it should look right"` states no comparison.
- **an observation may not overwrite an observation.** A second result gets its own id as a replication.
- **an observation that failed its own gates cannot grade a prediction** — unblinded, or with no control
  in the same session, per `bench/return.mjs`.
- **a non-numeric criterion is not graded mechanically.** It asks for a person, and for that person to be
  named.

And the one that matters most: **`calibrationSet()` refuses below 22 labels** — the Angelopoulos & Bates
Table 1 figure for a 0.1 coverage slack at α = 0.1 ([arXiv:2107.07511](https://arxiv.org/abs/2107.07511);
102 labels buy 0.05). Below that it returns the count, the shortfall and nothing resembling a calibration,
because a curve through four points looks exactly like one through four hundred. Individual pass/fail
results are reportable; a calibration is not.

## The loop, and the property it would destroy

The request is for a system that tunes its own parameters until lab results are reproducible. That is in
direct conflict with the discipline that makes the existing numbers trustworthy — `score-weights.json`
carries a never-edit-in-place rule and a pre-registration hash, and the evaluation deliberately keeps
failed runs.

The resolution is not to refuse the loop but to make every iteration a **version**:

```
propose → freeze (weights + pre-registration, both hashed) → re-run the blind evaluation
        → promote ONLY IF it passes its own pre-registered endpoints → keep the failures
```

Tuning against a held-out set turns it into a training set at roughly one bit per decision. So the loop
must **count its iterations and publish the count**: a score promoted on the first blind evaluation and
one promoted on the fortieth are not the same claim, even at the same AUC.

### What the gate found on its first run

| version | primary endpoints | authoritative run |
|---|---|---|
| 1.0.0 **(shipped default)** | 0/3 — fails P1, P2, P3 | `…_w1.0.0_reanalysed.json` |
| 1.1.0 | 0/3 | `…_w1.1.0_reanalysed.json` |
| 1.2.0 | 1/3 — fails P1, P3 | `…_w1.2.0_reanalysed.json` |
| 1.3.0 | 1/3 — fails P1, P3 | `…_w1.3.0_reanalysed.json` |

**No released version is promotable, and the one shipped as default is blocked by the endpoints it
declared in advance.** That is not a complaint about the scorer thread, which documented the situation
itself in `SCORER-VERSION.md` — it is the gate working on its first run, which is the only way to know it
works at all. A gate that passes everything on the day it is written is not evidence of anything.

The report frames a failure correctly: *not* that a version is bad, but that it has not earned the right
to be the default. Shipping it anyway and mentioning the failure in a document is the same as not having a
gate.

One nuance the gate reports rather than resolves: the newest version's separate `rank_score` output *does*
pass the primary endpoints while its composite `score` does not. Promoting one output of a version and not
another is legitimate and needs its own pre-registration naming which output is the default.

### A bug worth recording

The first version of this gate reported *"0/6 primary endpoints pass; failing: P1, P2, P3, P1, P2, P3"* —
it counted endpoints once per file, and every run is stored twice (raw and reanalysed). The double count
hid that P2 actually passes. It also picked a `-specimen` split variant as a version's main run because
that file's timestamp was later. `authoritativeRun()` now prefers the main reanalysed file per version,
and two tests exist for exactly these two mistakes.

## What this layer still cannot do

Everything that needs outcomes. There is no hard-negative benchmark (the evaluation already predicts the
current joint term would pass correlation-preserving decoys, and measures AUC 0.574/0.635 when it tries),
no per-prediction uncertainty propagation from input provenance to an interval on the output, and no
confidence signal over anything beyond the 14 morphometric parameters the scorer can read — eye, head,
jaw, mouth, fin shape, airspeed, CLmax, glide claims, organ volumes and the entire `lean_spec` are
invisible to it.

**34 assertions pass; 34 fail under `--fail-once`; 0 survive their own fault.**
