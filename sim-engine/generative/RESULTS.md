# Generative backends: results (2026-11-01)

The numbers come from `body/model/metrics.json` (written by `body/train.py`) and `body/model/metrics-tail.json`
(written by `body/eval_tail.py`). Neither file was edited by hand.

**What is real and evaluated:** the BODY level only. The other levels generate nothing here; §5 gives the reason for
each.

## 1. Setup

**Data.** FishShapes v1 (Zenodo 6642650, CC0), 16 123 specimens after screening.

**Split.** By species, stratified by family. 20 % of species are held out: 3 258 test specimens from 1 213 species,
none of them seen in training, against 12 865 training specimens.

- The held-out flying fish are 16 specimens from **6 Exocoetidae species**: *Cheilopogon cyanopterus*, *C.
  dorsomacula*, *C. furcatus*, *Cypselurus callopterus*, *Hirundichthys speculiger* and *Parexocoetus brachypterus*.
- 29 test specimens belong to families with no training species. They are scored with the NULL ("any teleost")
  condition, and with the global Gaussian in the family baseline.

**Space.** All results are in the 7-D log-feature space (README). NLL is in nats per specimen in that space, and every
model is scored in the same space.

**Models.**

- **FM:** conditional rectified flow.
- **DDPM:** VP-SDE, ε-prediction.
- **Architecture:** identical MLP for both (3 × 128, SiLU), 30 000 steps each, CPU.
- **Baselines** fitted on the same training rows:
  - a **global Gaussian**: full covariance;
  - a **family Gaussian**: family mean shrunk toward the global mean with k = 5, and the pooled within-family
    covariance. This is the honest competitor. It already knows the family and the linear covariance.

**Production weights** (`fm.json`, `ddpm.json`) were retrained on all rows with the identical recipe. The metrics below
are for the split weights (`fm-split.json`, `ddpm-split.json`), which are the ones evaluated.

## 2. Held-out likelihood (species never seen in training)

Mean NLL (± SE) on held-out species. **Lower is better.**

| model | all 3 258 | Exocoetidae (16) | Cyprinidae (253) | median (all) | p99 (all) | worst specimen |
|---|---|---|---|---|---|---|
| global Gaussian | 2.896 ± 0.068 | 1.248 ± 0.181 | 1.367 ± 0.087 | | | |
| family Gaussian | −0.354 ± 0.106 | −3.382 ± 0.096 | −0.725 ± 0.211 | −1.898 | 23.2 | 122.6 |
| **FM, family-conditioned** | **−1.713 ± 0.065** | **−4.964 ± 0.336** | **−1.547 ± 0.188** | **−2.427** | **11.0** | 58.9 |
| DDPM, family-conditioned | 2.132 ± 3.685 | −4.727 ± 0.411 | −1.434 ± 0.199 | −2.254 | 11.2 | 12 002 |
| FM, unconditional | 1.577 ± 0.050 | 0.908 ± 0.254 | −0.144 ± 0.111 | | | |

**FM vs the family Gaussian.** Paired over the same 3 258 specimens, the FM is better by **1.36 ± 0.08 nats per
specimen**. The median paired difference is 0.92 nats, and FM wins on 75.4 % of specimens. The test suite checks this
claim (`metrics-claim`): it requires the gap to exceed 3 SE.

**The FM's tails are lighter.** 5 test specimens have NLL above 20 nats under the FM, against 43 under the family
Gaussian.

**The DDPM's mean is not usable as a summary.** One specimen (*Melichthys indicus*) gets 12 002 nats. That is a
blow-up in the probability-flow ODE likelihood near t_min, not a real density. On the median (−2.25), the trimmed
mean (−1.81) and the per-family means, the DDPM is close to the FM and better than the family Gaussian; it wins on
72.5 % of specimens. **FM is the default.** The DDPM is available as `conditions.model: 'ddpm'` and was evaluated the
same way.

**The family condition carries most of the information.** The unconditional FM (1.58) is far worse than the
family-conditioned one (−1.71), but still better than the global Gaussian (2.90). The network also learns non-linear
structure that a single Gaussian misses.

## 3. Two-sample tests: generated vs real held-out specimens

For each real test specimen, we drew one generated specimen with the same family condition.

| test | FM | DDPM | family Gaussian (same test) |
|---|---|---|---|
| kNN classifier two-sample test, accuracy (0.5 = indistinguishable), n = 1 500 each, 5-fold | **0.511** (z = 1.17) | **0.499** (z = −0.07) | 0.583 (z = 9.1) |
| energy distance, permutation p-value (1 000 vs 1 000, 200 perms) | 0.0117, **p = 0.045** | 0.0122, p = 0.035 | 0.0155, p = 0.010 |
| Exocoetidae, held-out species only: energy distance, p (400 generated vs 16 real, 500 perms) | 0.103, p = 0.10 | 0.104, p = 0.10 | 0.153, p = 0.13 |

**How to read these:**

- A kNN classifier cannot tell FM or DDPM samples from real held-out fish. It does tell the family Gaussian's
  samples apart.
- The energy test, however, **does detect a small difference** for both generative models, at p ≈ 0.04. They are
  close but not identical to the real distribution. The family Gaussian is rejected more strongly.
- With only 16 held-out flying fish, the Exocoetidae test has little power. Its non-rejection is weak evidence, and
  the Gaussian is not rejected either.

## 4. Conditional generation: the mechanism behind "deeper body"

Given SL, depth and family, we predicted the other five features of each held-out specimen, using 20 draws per
specimen. RMSE is in natural-log units, so 0.1 ≈ 10 %.

| feature | RMSE FM | RMSE DDPM | RMSE family Gaussian | 90 % interval coverage FM | DDPM | family Gaussian |
|---|---|---|---|---|---|---|
| width/SL | 0.160 | 0.164 | 0.172 | 0.80 | 0.82 | 0.87 |
| peduncle depth fraction | 0.229 | 0.242 | 0.257 | 0.78 | 0.79 | 0.91 |
| peduncle width fraction | 0.343 | 0.346 | 0.343 | 0.79 | 0.81 | 0.90 |
| Fulton K | 0.221 | 0.229 | 0.231 | 0.77 | 0.80 | 0.90 |
| head depth / depth | 0.132 | 0.138 | 0.139 | 0.80 | 0.81 | 0.89 |

**What this shows:**

- **Point predictions improve, slightly.** The FM is a little more accurate than the conditional Gaussian on 4 of the
  5 features and ties on peduncle width.
- **The intervals are too narrow.** The FM's 90 % intervals cover only 77–80 % of held-out values: its conditional
  distributions are **overconfident**. The Gaussian is close to nominal at 87–91 %. Candidates generated under a
  condition therefore show **less spread than real fish would**. Read the spread of n candidates as a lower bound
  on the real variation.

## 5. What the models produce, and where the parametric organisms sit

`node sim-engine/gen-cli.mjs generate --text "<text>" --n 4 --seed 1` (FM, production weights):

| request | depth/SL of the 4 candidates | mass at SL 203 mm | notes |
|---|---|---|---|
| "a flying fish" | 0.173–0.205 | 97–130 g | Real Exocoetidae: median 0.188 (0.144–0.235); K 0.98–2.27 |
| "…with a much deeper body and larger pectoral fins" | 0.272–0.301 | 161–193 g | Depth is +2 pooled within-family SD, beyond every measured flying fish (max 0.235). Mass rose with depth, a learned covariance. "larger pectoral fins" was returned as **not generated**. |
| "a tuna-like zebrafish" | 0.218–0.319 | 0.6–1.6 g at 38.8 mm | Flagged as **extrapolation**: Scombridae specimens are 137–1 330 mm, and a 38.8 mm tuna shape is outside the data. |
| "70% zebrafish 30% flying fish, slightly more slender" | 3 Cyprinidae + 1 Exocoetidae | 8–11 g at 88.1 mm | Blend split by weight; each candidate comes from one family. |

**Parametric reference organisms against the real distribution** (`node sim-engine/generative/body/compare-parametric.mjs`).
These sets were not used for training. The percentile is the share of real specimens of the family at or below the
value.

| organism, parameter | value (kind) | real family: percentile, median (range) |
|---|---|---|
| flying-fish `body_depth_over_SL` | 0.170 (assumed) | Exocoetidae: 0.19, 0.188 (0.144–0.235) |
| flying-fish `body_width_over_SL` | 0.136 (assumed) | 0.28, 0.143 (0.116–0.175) |
| flying-fish `peduncle_depth_frac` | 0.30 (assumed) | 0.025, 0.387 (0.295–0.465) |
| flying-fish `peduncle_width_frac` | 0.35 (assumed) | **1.00, 0.180 (0.120–0.241): above every measured flying fish** |
| flying-fish Fulton K (60 g at 203 mm) | 0.72 (measured, one specimen) | **0.00, 1.43 (0.98–2.27): below every measured flying fish** |
| zebrafish-adult `body_depth_over_SL` | 0.2535 (measured) | *Danio rerio* (n = 3): 0.235–0.280; Cyprinidae median 0.253 |
| zebrafish-adult `peduncle_width_frac` | 0.40 (assumed) | **1.00 in both *D. rerio* (0.085–0.137) and Cyprinidae (max 0.349)** |
| zebrafish-adult Fulton K | 1.19 (derived) | ***D. rerio* 0.00 (1.63–2.14)**; Cyprinidae 0.10 |

**Three findings for the owners of `anatomy-model/parametric`** (reported to them, not changed here):

1. The schematic `peduncle_width_frac` (0.35 and 0.40) is wider than in any measured specimen of either family. This
   holds if FishShapes' minimum peduncle width over maximum width is the same quantity as the builder's parameter;
   check the definition.
2. The flying-fish base mass, the Park & Choi specimen at K 0.72, is lighter than all 79 FishShapes exocoetids. This
   was already noted in `params/FLYINGFISH-ADDITIONS.md`.
3. The zebrafish-adult mass is lighter than all three museum *D. rerio*.

**It matters downstream.** We ran the existing `glide` scenario at 365 d on two unconditioned FM flying-fish
candidates. Both had real-family mass at 203 mm (110 g and 128 g):

- wing loading rises from 38.6 to 70.8 and 82.4 N/m²
- v_min rises above the 10 m/s launch speed
- `glide_range_total_m` falls from 8.6 m to **0**

The base glides only because its mass is the light specimen. This comes from the existing scenario, not a new model.
It is the kind of question generated candidates are for. `gen-cli.mjs seed-optimize` (generate → score → `optimize`
from the best) runs end to end. On "slightly more slender" with `pectoral_area_over_SL2` ∈ [0.05, 0.25], the
optimizer pushed the area to its upper bound.

## 6. Other levels: status, not results

| level | result | why |
|---|---|---|
| protein | `not configured (NVIDIA NIM: not configured)`, 0 candidates; the public fallback works (P69905 on AlphaFold DB: mean pLDDT 98.06; a 33-aa peptide on ESM Atlas: 90.42) | No `nvapi-` key. Probe: an unauthenticated POST to the ESMFold NIM gives HTTP 401, and a bogus key reads as `auth failed` (test `auth-failed`, run with `--network`). NIM payloads are untested against a live key. |
| organ, system, tissue | `no training data`, 0 candidates | The only per-specimen organ tables found are for a pipefish (n = 60) and a pumpkinseed (n = 756). Neither is a studio organism, so we did not train on them (README). |
| cell | `not configured` | No reachable hosted cell-state generative model. |
| Nebius, Vertex | `not configured` | No keys in the environment. Both Nebius hosts answer 401 unauthenticated. |

## 7. Tests

`node sim-engine/generative/test/generative.mjs` gives **16 passed, 0 failed**. With `--network` it gives **18 passed,
0 failed**.

Each check was run once with `MUTATE=<name>`, and every one FAILED as intended:

- manifest
- parity-fm and parity-ddpm (the JS sampler against torch, max |diff| < 1e-3)
- determinism
- conditioning
- keep-size
- fins
- doc-valid
- larva
- bird
- organ
- cell
- not-configured
- no-key-leak
- metrics-claim
- envelope
- auth-failed
- fallback
