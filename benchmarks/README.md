# benchmarks — the state of the system as measured, not as described

DELPHI has three systems: a **Lean** layer that proves things, a **design** layer that scores organisms,
and a **validation** layer that turns a design into an experiment. Each had internal metrics. None had
been compared to anything outside itself.

That distinction is the whole point of this directory. *"61 laws registered, 73 Lean-checked theorems"*
and *"AUC 0.89"* are productivity figures. They measure how much was built, and they cannot come out
badly. A benchmark has to be able to come out badly, which means the answer has to come from somewhere
the system does not control.

## Results

| system | benchmark | result |
|---|---|---|
| **validation** | [`crispr-ontarget/`](crispr-ontarget/) — the guide score against 307 measured zebrafish sgRNAs | the score we rank by: **ρ = −0.037**, CI [−0.149, 0.073] — **includes zero** |
| **Lean** | [`lean-mutation/`](lean-mutation/) — non-vacuity, and mutation testing | **48/48 witnesses machine-checked**; 1 mutant refuted, control behaves. **A pass.** |
| **design** | [`design-hard-negatives/`](design-hard-negatives/) — AUC vs decoy difficulty | **0.891** on shuffles → **0.536** on real fish nudged ¼ sd — chance |
| **design** | [`design-hard-negatives/`](design-hard-negatives/) — the *constructed* negative | an **anatomically impossible** animal at **q = 0.918**, which the scorer calls typical |

**Two of the three levels come out at chance against external ground truth. One passes.**

### What each one actually says

**The guide score is not informative on zebrafish.** `editplan` ranks guides by Doench 2014 Rule Set 1,
which the module's own text calls *"a TRANSFER ACROSS SPECIES AND ASSAY"*. Against measured activity it
scores ρ = −0.037. Our own heuristic reaches 0.082, also straddling zero. CRISPRscan — fitted *on*
zebrafish — reaches 0.269, and that is an **upper bound rather than an estimate**, because it is being
scored on the data that fitted it. The model with home advantage reaches 0.27 and the two in use reach
zero.

**The formal layer is doing the hard thing properly.** Every law carrying a Lean theorem also carries a
non-vacuity witness, and the witnesses are compiled Lean theorems depending only on `propext`,
`Classical.choice` and `Quot.sound` — no `sorry`, no project-specific axiom. A theorem with unsatisfiable
hypotheses is vacuously true and proves nothing; this is the first thing to check in a law registry and
the check most registries have no field for.

**The design scorer's accuracy is mostly a property of its decoys.** 12,152 of the 12,606 held-out
negatives are shuffles, and a shuffle keeps each trait's marginal while destroying the correlation
between traits — precisely and only what a Mahalanobis distance detects. Against negatives that keep the
correlation, the AUC falls to chance.

**And distance to real fish does not bound anatomical possibility.** An animal whose snout and eye
overhang the back of its head by 2 % of its body length — no room for braincase, jaw, gills or operculum
— is called typical and ranks more plausible than 1,279 of 4,673 real fish. 20,000 draws from the fitted
model never found it; a search finds it at once. The scorer is a **plausibility model, not a viability
model**, and that is a ceiling rather than a defect. The gate built in response lives at
[`../sim-engine/validate/gate/`](../sim-engine/validate/gate/).

## The four properties, and the fifth that was missing

A benchmark here must:

1. **take its answer from outside the system** — published measurements, a reimplemented published model,
   a geometric fact;
2. **be able to fail** — and these did, three times out of four;
3. **state its own scope** — 307 of 499 guides located is a statement about the 307;
4. **be reproducible** — seeded bootstraps, derived rather than assumed coordinate conventions, no RNG in
   the adversarial search.

The fifth was learned the hard way, twice in one day: **a benchmark needs a control.**

- In `lean-mutation`, the control is a deliberately *weakened* mutant that must survive. It came back
  UNPROVEN, which revealed the harness could not tell *"false"* from *"I could not prove it"* — without
  it, three UNPROVENs would have been reported as a clean sweep.
- In `design-hard-negatives`, the control is checking each constraint against real specimens. It rejected
  four that sound obviously true: **"the pectoral fin sits behind the head" is false for 39 % of real
  fish.** Used as a hard negative, it would have reported the scorer failing to detect animals that exist.

Both failures were in the benchmark, not the system. That is the ordinary case, and it is why a control
is not optional.

## Two predictions in writing that came out wrong

Kept because a benchmark that only records its successes is a brochure.

- `design-hard-negatives` predicted correlation-preserving decoys would score **~0.5 by construction** —
  a model cannot separate samples from its own distribution. They scored **0.663**, because the fitted
  Gaussian is **overdispersed** relative to real fish: a covariance pooled over 311 families is wider and
  flatter than the real cloud. **A design placed at the mode of the model scores as less typical than an
  ordinary fish.** The wrong prediction was more informative than the right one would have been.
- `lean-mutation`'s first mutant moved a bound the wrong way. Widening a disjunct *weakens* a conclusion,
  so the mutant stayed true, and Lean said so exactly: the attempted counterexample sat **inside** the
  measured band.

## Running them

```
node benchmarks/crispr-ontarget/run.mjs        # needs the ground truth; see its SOURCES.md
node benchmarks/lean-mutation/run.mjs          # needs the Lean toolchain and a built Delphi library
node benchmarks/design-hard-negatives/run.mjs
```

Every directory has a `test.mjs` taking `--fail-once`, which injects one fault per assertion. **An
assertion that survives its own fault is reported as a failure**, because it was not testing anything.
Current totals: 19 + 3 + 42 across the three, with **0 survivors**.

## What is not measured

- **Whether a high-scoring guide produces a phenotype.** The CRISPR benchmark measures cutting, and in
  the programme it was built for the knockouts are phenotypically normal. Cutting well and mattering are
  different claims.
- **Whether the Lean matches the English.** `statement_en` sits beside every law and nothing checks the
  correspondence. A sound proof of the wrong statement passes every check in this repository, and that
  gap is not mutation-shaped.
- **Whether the laws are the right laws.** Soundness is not relevance.
- **The simulation layer at all.** There is no benchmark here for the multiscale engine.
