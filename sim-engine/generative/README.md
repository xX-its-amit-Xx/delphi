# sim-engine/generative: what each backend really is

One interface, `generate({level, base, text, conditions, n, seed})` (`index.mjs`), over six levels. Only two can
generate anything, and only one of those works without a key. This file says which, on what data, and what each
cannot do. Numbers are in `RESULTS.md`.

| level | backend | status on this box (2026-11-01) | what it really is |
|---|---|---|---|
| **body** | local, `backends/body.mjs` | **ok, no credentials** | Conditional flow matching (rectified flow), plus a DDPM (VP-SDE) variant, trained on **FishShapes v1** (16 123 real teleost specimens) over 7 body-shape features. Sampling is pure JS. |
| **protein** | NVIDIA NIM, `backends/protein.mjs` | **not configured** (no `nvapi-` key) | With a key: ProteinMPNN inverse folding on the AlphaFold DB backbone, each design re-folded by the ESMFold NIM; RFdiffusion backbones; Evo2 DNA continuation. Without one: **no generation**, and a public structure fallback for the base (AlphaFold DB, or ESMFold at api.esmatlas.com). |
| organ, system | none, `backends/no-data.mjs` | **no training data** | Nothing is trained. No per-specimen organ table exists for zebrafish or flying fish (see the search below). |
| tissue | none | **no training data** | Same. |
| cell | none | **not configured** | No hosted cell-state generative endpoint is reachable with a key we hold. |
| text assist | Nebius AI Studio or Vertex AI, `backends/providers.mjs` | **not configured** | Optional (`conditions.llm_assist`). An LLM restates the request in the body lexicon, then the rule-based parser decides. The LLM never sets a number. |

Run `node sim-engine/gen-cli.mjs status` for the live answer. The MCP tool `generative_backends_status` returns the same.

## Body level: the real model

**Data.** FishShapes v1 (Price et al. 2022, *Ecology* 103:e3829), Zenodo record 6642650, licence **CC0** (read from the
Zenodo record metadata).

- **Raw file.** 16 522 rows of museum specimens: 6 112 species, 404 families, all actinopterygian orders. It is not
  stored in the repo; `body/data/fishshapes-manifest.json` keeps its URL and sha256.
- **What is stored.** `body/prepare.py` writes `body/data/fishshapes-derived.csv`, which keeps the measured columns
  only. 400 rows were screened out: 214 had a missing value and 186 had an implausible ratio (rule stated in
  prepare.py).
- **No birds.** Every Order is a fish order. The check is in prepare.py and is repeated in the tests.

**Features.** There are 7, all natural logs, defined as `anatomy-model/parametric/params.py` defines them:

- standard length
- body depth / SL → `body_depth_over_SL`
- body width / SL → `body_width_over_SL`
- minimum peduncle depth / maximum depth → `peduncle_depth_frac`
- minimum peduncle width / maximum width → `peduncle_width_frac`
- Fulton K = 10⁵ · W(g) / SL(mm)³ → `body_mass_kg`
- head depth / depth (auxiliary: the builder has no head-depth parameter)

**Model.** An MLP with 3 hidden layers of 128 units and SiLU activations. Its inputs are:

- x_t and t (Fourier features)
- a learned **family embedding**, with a NULL token meaning "any teleost"
- a **partial-observation block**: any subset of the 7 features, given as value × mask plus the mask

Training randomises the condition: the family is dropped 25 % of the time, half the rows observe nothing, and the
other half observe each feature with probability 0.3. One network therefore does three jobs:

- unconditional sampling
- family-conditioned sampling
- conditional generation: "given this size and this depth, generate the rest"

The two training objectives:

- **FM:** straight-path conditional flow matching. Regress v(x_t, t, c) onto x₁ − x₀, where x_t = (1 − t) x₀ + t x₁.
- **DDPM:** ε-prediction on a linear-β VP-SDE (β 0.1 → 20). It samples with the probability-flow ODE, which is
  also how its likelihood is computed.

Both are trained for 30 000 steps (AdamW, batch 512) on CPU, in a few minutes each. No GPU was used, and the cluster
was not touched.

**Text → conditions** (`lib/text-conditions.mjs`):

- **Base organism.** It comes from the spec thread's `parseDesignText`, so "70% zebrafish 30% flying fish" means the
  same here as in `design_from_spec`, and birds are refused in one place.
- **Mapping bases to families.**
  - `flying-fish` → Exocoetidae (79 specimens, 29 species).
  - `zebrafish-adult` → **Cyprinidae** (1 268 specimens; *Danio rerio* is 3 of them). The zebrafish condition is
    therefore "a cyprinid at zebrafish size", not "a zebrafish".
  - `zebrafish-larva` is **refused**: FishShapes is adults.
- **Blends.** Candidates are split across the parents by weight (largest remainder). Every candidate is a sample from
  ONE family, never an average of two.
- **Attributes.** "deeper body", "more slender", "wider", "narrower", "deeper caudal peduncle", "heavier", "lighter",
  "larger fish" and "smaller fish" each become an observed value for one feature:
  - target = (base family mean, or the base SL for size) + k × the pooled within-family SD, plus a 0.25 SD jitter
    per candidate
  - k = ±1, ±2 with "much", ±0.5 with "slightly"
  - the model generates the other features conditional on it
  - "deeper body" therefore also changes mass and peduncle shape, as they co-vary in real fish
- **Shape family.** "tuna-like" switches the family condition to Scombridae, at the base's size.
- **Size.** By default the base's SL is observed (`keep_size`), and the output carries it.
- **Extrapolation.** A condition outside the values measured for the family (for example a 38.8 mm "tuna-like" fish, when Scombridae run 137–1 330 mm) is flagged in `notes` and in `conditioned_on.extrapolated`.
- **Not generated.** Fin words, head or jaw words and organ words are returned under `not_generated` with the reason.

**Output.** Each candidate has:

- `params`
- an **organism document**: base parents plus body-level `set` edits for mass, depth, width and the peduncle
  fractions. `organism_get`, `scenario_run` and `optimize` accept it unchanged.
- diagnostics:
  - each value's percentile among real specimens of its family
  - the nearest real specimen and its distance in SD units
  - how far the model drifted from the features it was told to hold

Generated values are provenance kind **`assumed`**: a sample is not a measurement. The training data appear as
`measured`.

**Meshes.** Blender is not installed on this box, so no GLB is built here. The organism document is what the
parametric builder and the browser engine consume. `anatomy-model/parametric/build.py` builds a mesh from the
resolved parameters on a machine with Blender.

### What the training set can and cannot represent

- **Can:** adult and sub-adult teleost body proportions and mass at a given size, across 395 families, with their
  real covariances.
- **Cannot:**
  - **Fins of any kind.** FishShapes has no fin measurements. "Larger pectoral fins", the defining trait of a flying
    fish, is **outside this model**: fins stay at the base's values, and the text says so.
  - Head length.
  - Body cross-section shape.
  - Organs.
  - Larvae or development (about 3 adults per species).
  - Anything that is not a ray-finned fish.
- **Flying fish are well sampled for a family (79), but only 79.** Family conditioning borrows strength from the
  other 16 044 fish through the shared network. That is what makes held-out species work, and it is also a pull
  toward the teleost average.
- **"Plus our parametric organisms".** They were NOT added as training rows, because their body depth, width and
  peduncle values are mostly `assumed` (schematic). Training on them would be training on invented data. They are
  compared against the real distribution instead (RESULTS.md §4).

## Protein level

`backends/providers.mjs` reads `NVIDIA_API_KEY` at call time only. The health check folds an 8-residue peptide on the
ESMFold NIM and returns one of four results:

- `ok`
- `auth failed` (401/403)
- `unreachable`
- `not configured` (no key)

The key we were given is a Brev key (`bak-…`). NIM keys start `nvapi-`, and NIM answers HTTP 401 without a valid one
(checked: unauthenticated POST to the ESMFold NIM → 401). `status` reports the key's *format*, never the key.

The NIM payloads follow the build.nvidia.com model cards and **have not been exercised against a live key**. The first
call with a real key is the test.

**Public fallback, which works now and needs no key:**

- AlphaFold DB (accession → model + mean pLDDT)
- Meta ESMFold at api.esmatlas.com (sequence ≤ 400 aa → PDB + mean pLDDT)

Both are *prediction of a given sequence*, so the result has `candidates: []` and says so.

## Nebius and Vertex

- **Nebius AI Studio.** `NEBIUS_API_KEY`, OpenAI-compatible, with `NEBIUS_BASE_URL` defaulting to
  `https://api.studio.nebius.com/v1`. Health is `GET /models`. Unauthenticated, both api.studio.nebius.com and
  api.tokenfactory.nebius.com answer 401, so both hosts are live.
- **Vertex AI.** `GOOGLE_APPLICATION_CREDENTIALS` (a service-account or authorized-user JSON) and `GCP_PROJECT`.
  The token is minted with node's crypto, with no SDK. Health is `GET …/endpoints`.

Either can serve as the text assist. **Neither hosts a model we use for generation.** We found no flow-matching or
diffusion model for organisms on either service, and we did not pretend otherwise.

## Organ level: the search (2026-11-01)

The zebrafish and medaka micro-CT atlases publish images or segmentations, not organ tables:

- Ding et al. 2019 *eLife*: 25 GB of volumes from five larvae.
- Weinhardt et al. 2018 *Sci Rep*: data "on request".

Two real per-specimen organ tables do exist, both for other species (details in `backends/no-data.mjs`):

- *Syngnathus schlegeli*, a pipefish: n = 60, 7 organs, CC0.
- *Lepomis gibbosus*, the pumpkinseed: n = 756, 3 organs, CC BY 4.0.

A model trained on either would present pipefish or sunfish organ proportions as a zebrafish's, so none was trained.
The organ backend returns `no training data` and names both datasets.

## Files

```
index.mjs                 generate(), backendsStatus(), envelope wrappers
backends/body.mjs         body generation (FM / DDPM), candidate -> organism document
backends/protein.mjs      NIM generation; AlphaFold DB / ESM Atlas fallback
backends/providers.mjs    NIM, Nebius, Vertex health + calls; public endpoint health; LLM text assist
backends/no-data.mjs      organ/system/tissue/cell: honest status, candidate datasets named
lib/flow.mjs              pure-JS MLP + RK4 samplers (FM and VP probability-flow ODE)
lib/text-conditions.mjs   text -> attribute conditions, not-generated traits, shape family
body/prepare.py           FishShapes raw -> derived table + manifest (stdlib)
body/train.py             training + evaluation (torch); writes body/model/*.json and metrics.json
body/model/fm.json, ddpm.json            production weights (all rows)
body/model/fm-split.json, ddpm-split.json  the evaluated weights (training species only)
body/model/*-fixture.json                torch outputs at fixed inputs, for the JS parity test
test/generative.mjs       tests (MUTATE=<name> makes one fail)
../gen-cli.mjs            CLI: status | generate | seed-optimize
../tools/generative-tools.mjs, ../tools/GENERATIVE-REGISTER.md   MCP tools + the hub's patch
```

Reproduce from scratch:

```
curl -L -o <dir>/FishShapes_specimensv1.csv https://zenodo.org/api/records/6642650/files/FishShapes_specimensv1.csv/content
python sim-engine/generative/body/prepare.py <dir>/FishShapes_specimensv1.csv     # sha256 must match the manifest
python sim-engine/generative/body/train.py                                         # ~25 min on CPU, both models, both runs
node sim-engine/generative/test/generative.mjs
```
