# design-hard-negatives — how much of the design scorer's accuracy is the decoy generator?

The design scorer's reported AUC is not a property of the scorer. It is a property of the scorer **and
the negatives it was tested against**, and nobody had separated the two.

```
node benchmarks/design-hard-negatives/run.mjs
node benchmarks/design-hard-negatives/test.mjs [--fail-once]
```

## The result

| negatives | keeps | n | AUC | 95% CI |
|---|---|---:|---:|---|
| extreme-corner | nothing — independent extreme percentiles | 2 | 0.9999 | [1.000, 1.000] |
| **shuffle-all** *(what the benchmark uses)* | the marginals; correlation destroyed | 2,701 | **0.8915** | [0.884, 0.899] |
| independent-marginal | fitted marginals; correlation exactly zero | 2,000 | 0.9302 | [0.923, 0.937] |
| gaussian-typical | marginals **and** correlation, exactly | 2,000 | 0.6627 | [0.649, 0.676] |
| **jitter-real** | a real fish nudged ¼ sd | 2,000 | **0.5363** | [0.521, 0.552] |

**Shuffled negatives give 0.891. Real fish moved a quarter of a standard deviation give 0.536, which is
chance.** And **12,152 of the 12,606 held-out negatives are shuffles** — a shuffle keeps each trait's
marginal and destroys the correlation between traits, which is precisely and only what a Mahalanobis
distance detects. The headline number is largely a statement about the decoy generator.

Scored against 4,673 held-out positives, using the frozen `joint-model.v1.3.0` whose own `source` field
records that `heldout/` was never read. `extreme-corner` is listed for completeness and is unusable: only
2 of its 100 items are complete on these ten traits.

## The prediction this benchmark got wrong

It predicted in writing, before running, that `gaussian-typical` would come out at **~0.5 by
construction** — a model cannot separate samples from its own distribution. It came out at **0.663**, and
the reason is a better finding than the tautology:

```
E[q] for any d-dimensional Gaussian          1.000   (exactly, since q = D²/d)
samples from the fitted model                0.996   <- the reconstruction is faithful
REAL held-out specimens                      0.876

inside q < 1:   77.1 % of real fish    vs    56.5 % of the model's own samples
```

**The fitted Gaussian is overdispersed relative to real fish.** A covariance pooled over 311 families
absorbs between-family variation, so it comes out wider and flatter than the real cloud. The scorer can
therefore separate real fish from *its own typical samples* — it is detecting that its model is
misspecified, not that a decoy is implausible.

The consequence is concrete: **a design placed at the mode of the fitted model scores as less typical
than an ordinary fish**, and a design placed where real fish actually sit is indistinguishable from one.

## What this bounds

A statistically typical trait vector passes this scorer whether or not it is an animal that can exist.
**The scorer is a plausibility model, not a viability model**, and no amount of tuning changes that —
only a different kind of evidence can. That is not a defect to be fixed; it is the ceiling of what a
distance-to-real-fish can mean, and it should be stated wherever the score is shown.

## Method

`joint.mjs` reconstructs the frozen model from its own per-family sufficient statistics — `n`, the vector
of sums, and the packed upper triangle of sums of products — and reproduces `q = D²/d` in log10 space.
Pooled `n` and family count match the model's own declared values exactly. Nothing reimplements the
scorer's calibration, verdicts or thresholds: this is the Mahalanobis geometry alone, which the
project's own evaluation found **is** the scorer (the joint term reaches 0.8833 of the full score's
discrimination, *"one term wearing a costume"*).

A missing or non-positive trait returns `null`, not a number. An incomplete design is not typical and not
atypical — it is unscoreable, and imputing a mean would make it look average.

Family hold-out is supported (`pooled(block, [family])`) because a design's nearest real relatives are
usually its own family. The headline numbers are pooled, which is the model's best case.

42 tests pass; 42 fail under `--fail-once`; **0 survive their own fault.**

## The hard negative that has to be constructed

Everything above *draws* negatives. A worst case is not a sample — it has to be searched for. So:
**what is the most typical anatomically impossible animal the model allows?** Minimise `q` subject to
breaking a constraint no real animal breaks.

The constraint has to be chosen by checking, not by intuition. Four that sound obviously true were
rejected because **real fish break them**:

| holds on real fish | constraint | verdict |
|---:|---|---|
| **100.00 %** | `preorbital + eye_diameter ≤ head_length` | **kept** — the eye lies in the head, behind the snout |
| 99.98 % | every along-body distance ≤ 1 SL | near-strict, not used |
| 99.91 % | `prepelvic ≤ preanal` | near-strict, not used |
| 97.58 % | `predorsal ≤ preanal` | rejected — a tendency |
| 69.66 % | `prepectoral ≤ prepelvic` | rejected |
| **60.62 %** | `head_length ≤ prepectoral` | rejected — *"the pectoral fin sits behind the head"* is **false for 39 % of real fish** |

Had that last one gone in unchecked, every hard negative built on it would have been a real fish
mislabelled impossible, and this benchmark would have reported the scorer failing to detect animals that
exist. **The check against real specimens is the control, and it is not optional.** What survives holds
on 4,673 of 4,673 — while the benchmark's own `organ_containment` class, the right idea, has **three
items**.

### The result

`margin` is by how much the snout plus the eye overhang the back of the head, in standard lengths.

| margin | min q | called typical? | real fish *less* typical than it |
|---:|---:|:--:|---:|
| 0.001 | 0.800 | **yes** | 36.0 % (1,681/4,673) |
| 0.01 | 0.857 | **yes** | 31.5 % (1,471/4,673) |
| **0.02** | **0.918** | **yes** | **27.4 % (1,279/4,673)** |
| 0.05 | 1.091 | no | 19.1 % (890/4,673) |
| 0.10 | 1.351 | no | 12.0 % (560/4,673) |

**An animal whose snout and eye overhang the back of its head by 2 % of its body length — leaving no room
for braincase, jaw, gills or operculum — is called typical by the scorer, and ranks as more plausible than
1,279 of 4,673 real fish.**

**Sampling cannot find this.** 20,000 draws from the fitted model produced 88 violations and **not one**
inside the typical radius `q < 1`. The search finds one immediately. The benchmark drew 12,606 negatives
and never found it.

This does not show the scorer is wrong. It measures distance to real fish and does that correctly. It
shows that **distance to real fish does not bound anatomical possibility** — a design can be ordinary by
this measure and still be an animal that cannot be built. The fix is not tuning: a containment check is a
few lines of exact arithmetic, and it belongs *in front of* the scorer as a gate, not inside it as a term.

## What is not built

- **Constraints from the law layer.** Only one geometric constraint is used. The registry holds 48 Lean
  theorems that could supply mechanical and developmental ones, which is where this benchmark and the
  Lean work meet.
- **Family-held-out ladder numbers.** The machinery is there; only the pooled run is reported.
- **The other block.** `fishshapes` (9 traits, 10,694 specimens) is untouched.
- **The full scorer.** This measures the term that carries 0.88 of it, not the remaining components.
