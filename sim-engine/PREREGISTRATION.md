# Pre-registration: can morphogen diffusion plus a stated growth rule predict the hhip fin phenotype?

**Written 2026-10-31, before the model was run.** The code in `validation/hhip-fin-area.mjs` did not
exist when the criteria below were fixed, and the parameters in `params/zebrafish-morphogens.json`
were fetched before the criteria were written. Nothing in this file may be edited after the first
run; a failed prediction gets a new section at the bottom, not a revised criterion.

Author: the organism thread's software agent. No human is named.

---

## 1. The target, taken from the repository and not from the model

`genotype/interventions.json`, records `hhip-uki-loss-fin-area`,
`hhip-uki-loss-fin-dorsoventral` and `hhip-uki-loss-fin-anteroposterior-no-change`. All three come
from one primary source, read in full text by whoever built that file:

> Koudijs et al. 2005, *The zebrafish mutants dre, uki, and lep encode negative regulators of the
> hedgehog signaling pathway*, PLoS Genetics. PMID 16121254, DOI 10.1371/journal.pgen.0010019.
> "Dorsoventrally the fins have approximately increased in size by 50% (0.01 < p < 0.02, n = 6), the
> area has increased by 65% (p < 0.001, n = 3)"; "(I) The anterior/posterior size is not
> significantly affected".

| measurement | value | n | statistic |
|---|---|---|---|
| pectoral fin **area** | **+65 %** of wild type | 3 | p < 0.001 |
| pectoral fin **dorsoventral** extent | +50 % | 6 | 0.01 < p < 0.02 |
| pectoral fin **anteroposterior** extent | no significant change | 3 | reported n.s. |

Genotype: `uki^hu418B` (Y295STOP) and `uki^hu540A` (Y285STOP), nonsense alleles of *hhip*, homozygous.
Stage: 72 hpf (ZFS:0000035); ZFIN annotates the call to Larval:Protruding-mouth, 72–96 hpf.

### 1a. The target contains its own inconsistency, and that sets a precision ceiling

If area = D/V × A/P and A/P is unchanged, then +50 % D/V implies **+50 % area**. The paper reports
**+65 %**. The two routes to the same quantity disagree by about 15 percentage points, measured on
n = 3 to 6 animals by two different instruments (a micrometer for the extents, pixel counting of a
scanned photograph for the area).

**Therefore: no criterion below demands better than ±15 percentage points of agreement.** Any model
claiming to hit 65 % rather than 50 % would be claiming precision the measurement does not have. A
reviewer should reject a tighter criterion as overfitting to noise.

## 2. The directional premise, and why it is not assumed

The test requires that *hhip* loss of function means **more** Hedgehog signalling. Three independent
strands, all from sources rather than from the model:

1. The title of the source paper itself: *hhip*/*uki* is a **negative regulator** of the pathway.
2. The record's assayed regulatory target is **Ptc1** by in situ hybridisation. *ptc1* is a direct
   transcriptional target of Hh, so it reads pathway output.
3. The record states that **cyclopamine at 25 µM fully rescues the uki eye phenotype**. Cyclopamine
   inhibits Smoothened. A phenotype rescued by inhibiting the pathway is a phenotype caused by too
   much of it. This is the decisive strand, and it is logical rather than merely citational.

Mechanism, fetched externally on 2026-10-31 and consistent with the above: Hhip is a secreted
inhibitor that sequesters the Hedgehog ligand, binding SHH directly with high nanomolar affinity,
and is itself induced by Hh signalling as negative feedback
(<https://pmc.ncbi.nlm.nih.gov/articles/PMC4163939>, <https://www.ebi.ac.uk/pdbsum/2WG4>).

**So in the model, removing Hhip removes a ligand sink: it lowers the clearance rate k.** That is
the only change permitted between the wild-type and mutant runs. No other parameter may differ.

## 3. The model, fixed in advance

Steady-state reaction–diffusion on a 2D fin-bud domain, solved by finite differences:

    dC/dt = D ∇²C − k C + S(x,y),    run to steady state

- `D` from `params/zebrafish-morphogens.json` → `fgf8a-D-fast-endogenous` = 56 µm²/s, **measured**
  (FCS, endogenous tagged protein). Borrowed for a Hedgehog source, because no measured zebrafish
  Shh coefficient was found; that borrowing is this test's largest single assumption and is recorded
  as `kind: assumed` in the parameter file under `shh-D-finbud`.
- `k` from `fgf8-residence-time` = 9 min half-life → k = ln2 / 540 s = 1.283 × 10⁻³ s⁻¹,
  **measured-secondhand**.
- Gradient length λ = √(D/k) ≈ 209 µm. Independent check: the reported Fgf8 gradient length is
  ~200 µm. The agreement to about 5 % is why these two fetched numbers are trusted enough to use.
- Source region `S`: a strip along the posterior margin, standing for the ZPA. Its geometry is
  **assumed**; no measurement of zebrafish fin-bud ZPA dimensions at 72 hpf was fetched.
- Domain: a 2D rectangle standing for the fin bud. Dimensions **assumed**, flagged as such.

### The growth rule, stated before running

> **The fin occupies the region where morphogen concentration exceeds a threshold θ.** Fin area is
> the area of that supra-threshold region. Nothing else couples morphogen to size.

This is deliberately the simplest rule that could work. It is not claimed to be how fins grow.

### What "not fitted to the result" means here, precisely

**Exactly one calibration is permitted, and it is to the wild type only:** θ is chosen so that the
wild-type supra-threshold area equals the wild-type fin area. That fixes the scale.

**Zero parameters may be tuned to the mutant.** The mutant run changes only k, by a factor (1 − f)
where f is the fraction of total ligand clearance attributable to Hhip. f is **not measured and not
fitted**: the test reports the predicted area ratio across the whole pre-declared band f ∈ [0.25,
0.75] and asks whether the measurement lands inside the band the model spans. Choosing a single f to
land on 65 % is forbidden and would void this pre-registration.

## 4. Predictions and pass/fail criteria, fixed before running

**P1 — Sign (parameter-free).** Predicted: mutant fin area **increases**.
*Pass* if the model gives a ratio > 1 for every f in the band. *Fail* if any f gives ≤ 1.
This one is near-certain a priori — lowering clearance cannot shrink a supra-threshold region — so
passing it is weak evidence and is recorded as such. Failing it would mean the implementation is
broken, which is exactly what makes it worth stating.

**P2 — Anisotropy (the discriminating prediction).** Predicted: the D/V increase **exceeds** the
A/P increase, because the source is a posterior strip, so expansion is mostly perpendicular to it.
*Pass* if predicted ΔD/V > ΔA/P across the whole band, and the predicted A/P change is small enough
to be consistent with "not significant" at n = 3 — taken here as **< 20 %**.
*Fail* if the model predicts isotropic growth or A/P ≥ D/V.
**This is the criterion that carries the evidential weight**, because nothing in the setup was
arranged to produce it and the measured anisotropy is three separate numbers in the source.

**P3 — Magnitude.** Predicted: the measured +65 % area lies within the range the model spans over
f ∈ [0.25, 0.75].
*Pass* if 1.65 ∈ [ratio(f=0.25), ratio(f=0.75)], **or** if 1.50 ∈ that range (the D/V-implied area,
which is as defensible a reading of the same experiment — see §1a).
*Fail* if the whole band misses both, or if reaching either would need f > 0.95, which would say
Hhip is essentially the only clearance mechanism — implausible when Ptch1 also sequesters ligand.

**Declared in advance:** P1 passing alone is **not** a success. The headline result is P2 and P3.
If P1 passes and P2 fails, the honest report is "the model gets the sign right for a reason too
trivial to count, and gets the shape wrong".

## 4a. Amendment, 2026-10-31, written during implementation and BEFORE the first run

Implementing §3 exposed an under-specification in §3 that I did not see when writing it. Recording it
here, before any result exists, rather than discovering it afterwards and appearing to have planned
for it.

**The gap.** §3 says θ is calibrated so that "the wild-type supra-threshold area equals the wild-type
fin area". But the source measured fin area in *pixels of a scanned photograph*, so there is no
wild-type fin area in absolute units, and no fetched fin-bud dimensions to give the domain absolute
units either. Only the *ratio* of mutant to wild type is measurable. So the calibration cannot fix θ
on its own: what it fixes is the **wild-type occupancy fraction**

    φ = (wild-type supra-threshold area) / (domain area)

and φ is unmeasured. The predicted area ratio depends on it, because a field already filling most of
the domain cannot expand much.

**A second thing implementation revealed, which matters more.** With the fetched parameters,
λ = 209 µm exceeds any plausible fin-bud dimension, so the modelled gradient is shallow: across a
150 µm domain the concentration falls only to **79 %** of its peak. A nearly flat field means the
supra-threshold region is set mostly by where θ sits inside a narrow band of concentrations, which
makes the predicted ratio *more* sensitive to φ, not less. This is a property of the fetched
numbers, not a choice, and it was not foreseen in §3.

**How this is handled, decided now.** The test reports the predicted area ratio over the full grid
f ∈ [0.25, 0.75] × φ ∈ [0.2, 0.8], and asks whether the measurement lies inside the region the model
spans. Picking one (f, φ) that lands on 1.65 is forbidden and would void this pre-registration.

**Cost to the test, stated plainly.** A two-parameter family spanning a target is weaker evidence
than a point prediction hitting it. P3 is therefore demoted: it can now only *fail* informatively.
If the measurement lies outside the whole grid, that is a real refutation; if inside, it shows only
consistency, and the report must say "consistent with" and never "predicted". **P2, the anisotropy
prediction, is unaffected by φ** — a ratio of two extents cancels the overall scale — so P2 now
carries essentially all of the evidential weight. That was already the intent in §4; it is now a
necessity.

## 5. What a pass would, and would not, establish

Would: that a source-sink diffusion model with one wild-type calibration and no tuning to the
perturbation reproduces the direction and rough size of a measured genetic effect.

Would **not**: that this is how the fin actually grows; that Hedgehog transport in a fin bud has the
diffusion coefficient of Fgf8 in a gastrula (it is borrowed, and the stage is wrong by ~60 hours);
that θ corresponds to anything molecular; that the model could predict an effect it had not been
shown. One agreement on one perturbation is one data point. The model has not been tried on a
perturbation that should make the fin *smaller*, and until it is, a sign agreement here is partly a
coin landing the way it was pushed.

## 5a. RESULT, run 2026-10-31. The model FAILED, and so did part of this document.

Added after the run, as §0 requires. No criterion above was edited.

```
P1 sign          PASS   area ratio 1.250 to 5.000 over the grid
P2 anisotropy    FAIL   D/V > A/P at every point: false. Largest A/P ratio 5.000 (limit 1.2)
P3 magnitude     PASS   model spans 1.250-5.000; both 1.65 and 1.50 fall inside
```

**The headline is FAIL**, because §4 declared P2 the criterion that carries the weight.

### What actually happened, which is worse than "isotropic"

All 49 grid points **saturate the domain**: the mutant field rises above θ everywhere, so the
supra-threshold region becomes the whole rectangle. In every row the **D/V ratio is exactly 1.000**
and all expansion appears on the **A/P** axis.

The measurement is the other way round: **D/V +50 %, A/P not significant.** The model does not merely
miss the anisotropy, it predicts the **wrong axis**.

The mechanism is geometric and obvious in hindsight. The ZPA is modelled as a posterior strip that
spans the bud's full dorsoventral height, so the supra-threshold region already occupies the entire
D/V extent in the wild type. There is nowhere for it to grow in D/V. The only free direction is
anterior. A single morphogen from a strip source, with a threshold rule, **cannot** produce
dorsoventral growth on this geometry, for any f and any φ.

### P3's pass is worthless, and the test says so by construction

The area ratios are exactly 1/φ at 42 of 49 points: once the field saturates, the ratio is
domain ÷ (φ × domain) and nothing else. The "range the model spans" is therefore an artifact of the
arbitrary φ band, carrying no physics at all. Amendment §4a predicted this failure mode in the
abstract ("a two-parameter family spanning a target is weaker evidence than a point prediction") and
it turned out to be the entire content of the P3 pass. **P3 should be read as uninformative, not as
support.** P1 likewise passed for the trivial reason declared in advance.

### An error in this pre-registration, not only in the model

§4 stated P2 as "the D/V increase exceeds the A/P increase" and justified it as "the source is a
posterior strip, so expansion is mostly perpendicular to it". **Perpendicular to a posterior strip is
the A/P axis.** The stated reason implies A/P expansion, which is what the model did; the stated
prediction said the opposite. The rationale and the prediction contradicted each other and I did not
notice when writing them.

So P2 is a real failure of the model against the *measurement*, and separately this document
contained a reasoning error that a careful reader should have caught before the run. Both are
recorded rather than quietly fixed. Had the prediction been written to match its own rationale, the
model would have "passed" a criterion that the data refute — which is a good illustration of why the
measurement, not the pre-registered guess, is what the model is scored against.

### What this licenses, and what it does not

It does **not** license tuning f, φ, θ, the domain, or the source geometry until the axis comes out
right. Any changed model is a new pre-registration with its own criteria written before its own run.

It does identify what a next model needs, stated now so it cannot be presented later as a prediction:
a mechanism that distinguishes the two axes other than the source strip's orientation. Candidates
already in this repository's causal chains are a second signal from the AER along the orthogonal
axis, and a growth rule keyed to something other than a concentration threshold. The
`fin_bud_development` tool requested after this test is the natural place for that, and this result
is the reason it is needed rather than an optional extra.

## 6. Registered falsifier

If the same model, with the same θ calibrated the same way, is run on a Hedgehog **pathway-reducing**
perturbation and still predicts a larger fin, this model is wrong and this pre-registration should be
treated as refuted regardless of how the hhip result came out. Candidates present in
`genotype/interventions.json`: `ptch1-lep-loss-fin-size`, `disp1-con-loss-fin-size`. Both are
qualitative, so this is recorded as the next test to set up, not as one this run can settle.
