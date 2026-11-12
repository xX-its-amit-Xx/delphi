<!--
Issue drafts, one per `## ` heading. Parsed by tracks/scripts/file-issues.py.
Format of each block:
  ## <title>
  labels: a, b, c
  <markdown body>
Everything here is written to be safe on a PUBLIC tracker: no credentials, no personal addresses, no private
terms. Statements are sourced to files in this repo (tracks/...) so a reader can check them.
Posting is a separate, explicit step; nothing here has been posted.
-->

## Track 1 (reporter response): freeze and test RBS-swap separability on the Cello gate libraries
labels: track-1, paper, circuit

**What.** Swapping only the ribosome binding site in front of a repressor should translate the dose-response along the log-input axis: the threshold K moves several-fold while the Hill coefficient n stays put, so threshold and steepness are separable design axes.

**Why it matters.** `gene-regulatory-dynamics` is pinned in law set 1.8.1 with no Lean theorem behind it (`lean_ref.module = null`). A verified invariance with a measured validity domain would be the first registry law about a *designed* circuit.

**State.** Designed with frozen predictions in `tracks/synthesis.json` (track 1). Calibration on Eco1C1G1T1 gave a maximum relative steepness drift of 0.1587; the frozen bound for the untouched library Eco1C2G2T2 is 0.25.

**Next.**
- [ ] Download the Cello UCF libraries (URL, bytes, sha256 recorded)
- [ ] Commit the pre-registration alone, before any scoring module exists
- [ ] Score Eco1C2G2T2 and report every prediction, including failures

**Definition of done.** A scoreboard like `benchmarks/retro-validation/RESULTS.md`, with the Lean statement checked by `tracks/lean/check.sh`.

## Track 2 (spatial patterns): freeze F1 to F5 for chemotactic range expansion
labels: track-2, paper, patterns

**What.** Front speed and radial density profile of expanding *E. coli* in soft agar (Cremer 2019 data, Narla 2021 travelling-wave law). Two zero-free-parameter predictions: the back-of-front e-fold length is u/r, and bulge density scales as 1/uptake.

**Honest state.** One published square-root dependence is already refuted on the *seen* data (measured slope 0.30 against the model's 0.5). The design records this as declared-not-blind.

**Lean.** `turing-ddi` and `fisher-kpp-speed` are in law set 1.8.1 as candidates. The first track map listed them as missing only because it read the older split-out library. Re-map before freezing.

**Next.**
- [ ] Re-run the law map against 1.8.1
- [ ] Freeze F1 to F5 in one commit before adding data modules for the quarantined sheets
- [ ] Download the 168 MB confocal deposit, record checksums

## Track 3 (lumen geometry): confirm that the published vertex-model sweep fails its own reproduction gate
labels: track-3, paper, tissue

**What.** An agent's wild-type-only pilot found solidity RMSE 0.229 for the published vertex-model sweep against 0.124 for simply predicting the median. If true, the published model does not reproduce wild type, and that is the paper's first figure obtained from public data.

**Status.** Reported by an agent, **not yet reproduced by us.** A data-and-reproducibility agent has been asked to re-derive it from the deposited tables (`tracks/research/agents/`).

**Next.**
- [ ] Reproduce the pilot from the raw tables, with commands
- [ ] If it holds, freeze the two held-out genotypes (Rab11a-GFP, Cldn-qKO) before touching them
- [ ] Compare against the size-only null, not just a sphere

## Track 4 (glide surrogate): print three control fruits and run prediction G1
labels: track-4, paper, build

**What.** Autorotating double-winged fruits, printed on a Formlabs SLA machine. An agent ported the published blade-element model, reproduced the authors' five stored model files to within 0.17 %, and found the published per-trial data already breaks the base-angle prediction (1.50 measured against 1.22).

**The decisive first measurement (G1).** Weigh three control fruits immersed and drop each ten times: it decides whether the published agreement depended on an effective loading rather than the stated one.

**Caveat recorded in the design.** Autorotation has no forward travel, so this tests sink-rate laws, not glide-ratio laws. It is a surrogate for the *fruit*, and the bridge to fish is argued, not shown.

## Track 5 (biomaterial): measure coupons first, then print the optimal bilayer
labels: track-5, contract, biomaterial

**Law.** At thickness ratio m with m²n = 1 the Timoshenko coefficient reaches its ceiling of 3/2, so R = h / (1.5 Δε) and the modulus ratio drops out. Checked by the Lean kernel: `tracks/lean/HygromorphCeilingCheck.lean`, run with `bash tracks/lean/check.sh`.

**Problem.** Stock Formlabs resins gain under 1 % mass in 24 h in water; nobody has published a hygroscopic expansion coefficient or a water diffusivity for any of them. An 0.8 mm strip at Δε = 0.2 % bends to R ≈ 267 mm, about 3 mm of tip deflection over 40 mm, after one to two weeks.

**Plan.**
- [ ] Coupons of Clear V5, Elastic 50A V2, Flexible 80A, Rigid 10K: mass and length at 0, 1, 3, 7, 14 days in water, and at 50 % and 90 % RH
- [ ] Freeze the predictions in a commit before any bilayer exists
- [ ] Print the bilayer at the law's optimal thickness ratio
- [ ] A solvent-swollen version (Elastic 50A in isopropanol, about 400x contrast) as the display object, **labelled as solvent swelling**

## Track 6 (flying fish): bring the evaluation framework up to law set 1.8.1 and reuse it
labels: track-6, framework, lean

The elimination-certificate pattern (a theorem `*_rules_out` showing a design violates a law under stated parameters) is what makes the four paper tracks one method rather than four experiments. Law set 1.8.1 adds four discovery candidates (`turing-ddi`, `fisher-kpp-speed`, `kimura-heterozygosity`, `maynardsmith-hawk-dove`); the first track maps used 1.6.0.

- [ ] One `*_rules_out` certificate per track (the hygromorph one is checked)
- [ ] Keep the framework on the current law set automatically (`python tracks/scripts/lawset-diff.py A B`)

## Land the checked Timoshenko ceiling in lean/ThompsonLaws
labels: lean, hygromorph, needs-owner

`tracks/lean/HygromorphCeilingCheck.lean` is accepted by the Lean kernel (v4.35.0 with the project's Mathlib): no errors, and all five theorems depend only on `propext`, `Classical.choice` and `Quot.sound`. The first attempt did **not** check; the kernel found three real errors, and a later tidy-up that removed one tactic silently turned the headline theorem into a placeholder (`sorryAx`), caught only by the axiom audit. `tracks/lean/check.sh` fails on any of those.

`tracks/lean/HygromorphCeiling.lean` is the paste-ready form for `lean/ThompsonLaws/Hygromorphs.lean`. `lean/` belongs to the Lean owner, so this needs their decision.

## 14 of 59 pinned laws have no Lean theorem
labels: lean, registry

In law set 1.8.1, 14 pinned laws are registry placeholders (`lean_ref.module = null`): `aspect-ratio-induced-drag`, `disc-flying-fish-fin-ratio-gap`, `disc-heterurus-mass-exponent`, `disc-measured-wing-loading-band`, `disc-pectoral-length-allometry`, `elastic-similarity`, `fick-principle`, `fin-length-ratio`, `gene-regulatory-dynamics`, `gill-o2-uptake`, `muscle-power-premise`, `taxiing-thrust`, `test-loop-only-density-sanity` (retired), `walking-pendulum-speed`. Reproduce: `python tracks/scripts/lawset-diff.py 1.6.0 1.8.1`.

Which of these should the Lean token grant prove first? Proposal: the ones the six tracks need (`gene-regulatory-dynamics`, `fin-length-ratio`, `aspect-ratio-induced-drag`, `elastic-similarity`).

## Law set drift: the split-out leanbio library is at 1.6.0, the application repo at 1.8.1
labels: lean, infrastructure

`fractastical/leanbio` pins 53 laws (1.6.0); the application repo pins 59 (1.8.1). Three law files exist but are pinned by neither: `fisher-sex-ratio`, `hamilton-rule`, `turing-wavelength`. Anyone reading the public library sees a stale law set. Is `leanbio` meant to track the application repo, and who cuts its law sets?

## Lean for Bio, question 1: how promoter-specific are enhancer effects, and what does a rank reversal prove?
labels: lean-for-bio, question, genomics

**Question.** When the same enhancers are measured on different promoters, when does the *order* of their strengths change, and what does that say about mechanism?

**Formal angle.** If activity = h_p(a(e)) with h_p strictly increasing (promoter strength plus any monotone saturation), the enhancer ranking cannot change between promoters. So an observed rank reversal beyond measurement noise *rules out* that whole model class: an elimination certificate, in the project's house style.

**Needed.** The null rate of apparent reversals produced by noise alone in a truly multiplicative world (simulation), then the observed rate in public MPRA/STARR-seq data.

Status and results: `tracks/research/` (Lean-for-Bio section). Reproduction commands are in each agent's `reproduce` field.

## Lean for Bio, question 2: why don't binding-affinity prediction models work well?
labels: lean-for-bio, question, drug-discovery

**Formal angles.**
1. *Attenuation bound:* with measurement noise of variance s², no predictor can correlate with observed affinity better than sqrt(var_true / (var_true + s²)).
2. *Variance decomposition:* in a pooled dataset a predictor that knows only the target already explains the between-target share and nothing within-target.
3. *Cycle consistency:* an additive free-energy predictor must sum to zero around a closed cycle, so its errors cannot be independent.

**Needed.** Estimate the noise floor and the variance split on public data (ChEMBL / BindingDB), compare with reported model performance on leakage-controlled splits, and state which failures are a ceiling and which are leakage.

## Mamou-Mani: confirm the partner and plan the first engagement
labels: partner, contract

The brief reads "Mamu Mani" / "Mamou Mani" / "Mobile Money". This work assumes the London practice Mamou-Mani Architects. **Please confirm.** Sourced portfolio, materials and stated limits are in `tracks/research/` (partner section). The pitch in one line: the law names the thinnest strip that can reach a given curvature, and no choice of materials beats it.

## Formlabs: the ten usable materials and the missing swelling data
labels: partner, materials

Which ten Formlabs materials should the programme treat as the usable set? Candidates and data sheets are tabulated in `tracks/research/`. The blocking gap is independent of the choice: no published hygroscopic expansion coefficient or water diffusivity for any Formlabs resin.

## Anthropic Lean grant: what to formalise with 3 million tokens
labels: lean, funding, decision

Options: (a) the 14 pinned laws with no theorem; (b) the 17 laws the biomaterial track needs; (c) the two Lean-for-Bio questions. Recommendation: (a), because they are laws the project already claims to have.

## .life format: genome to locomotion, light sensors, and a validation toolchain
labels: format, organism-design

Goal from the notes: describe an organism "from genome to locomotion", where light sensors trigger movements, and validate it computationally. Open: what `organism-format/` can already express, what it lacks for sensor-triggered movement, and which toolchain validates a `.life` file end to end. A decoding of the relevant fragments with file references is in `tracks/research/` (decoder section).

## Financing, and "license your patent": what patent, and what could be claimed?
labels: finance, ip

The notes say "we want to finance this" and "license your patent". Open: is there a filed patent, or is this a plan? A preliminary prior-art scan (not legal advice, not freedom-to-operate) is in `tracks/research/` (IP section), including what kind of subject matter could plausibly be claimed: a composition, a geometry, a design-and-verification method, or a certified design-file format.

## Bioelectricity nonprofit and the Levin line: an optogenetic, hands-off xenobot variant
labels: collab, bioelectricity

Notes: "Non profit Bioelectricity"; "Michael Levin (500 papers on math for biology)"; "optogenetic version of xenobots (no imaging or direct interaction)". Questions: which nonprofit; what a computational-validation-only first step looks like; what published optogenetic control of ciliated or contractile tissue already exists. Sourced survey in `tracks/research/` (bioelectricity section).

## Broad Institute fish biologists: hypotheses for collaboration
labels: collab, broad

Candidates identified from institutional pages and publications, each with the track it could connect to. **Every suggestion is a hypothesis to test, not a claim that anyone is willing.** See `tracks/research/` (people section). Needs a decision on who makes first contact and with what offer.

## Funding opportunities for the paper and the contract
labels: funding

Programmes, award sizes, eligibility and the next deadline *as read on the date fetched* are tabulated in `tracks/research/` (funding sections). Deadlines go stale; re-verify before acting.

## Sentry: identify the agent-communication platform and connect to it
labels: infrastructure, blocked

The brief says "Sentry is a platform for communicating with other agents; we have used it before." Searched without result: this repo, the shared mailbox, memory, installed skills and tools, and 100+ prior session transcripts (`python tracks/scripts/find-in-transcripts.py sentry --need "agent|message"`). There is no tool, credential or config for it on this machine. Needed: where it lives, how access is granted, and who the collaborating agents are.

## Locate the paper manuscript
labels: infrastructure, blocked

"The paper is in repo": not found. Searched 214 repositories under three GitHub accounts by file tree (`python tracks/scripts/find-paper.py`). The upstream README points at `claim-sources/plant-hygromorph-mechanics/`, which is absent from the public repo and from this one, so it is presumably in a private application repo. Which repository and path?

## OpenAlex free budget exhausted; 97 of Buehler's listed works not yet fetched
labels: infrastructure, data

795 of the 892 works OpenAlex lists were fetched. The free daily budget shared by this network is spent (resets 00:00 UTC), and the only offered workaround is emailing an address to OpenAlex, which would send a personal identifier to an outside service. `tracks/scripts/complete-corpus-when-ready.sh` waits for the reset and recovers the remainder. Reproduce: `python tracks/scripts/complete-corpus.py`.

## Dashboard: plain-language dropdowns and a reproduce button on every track
labels: dashboard, documentation

Every track page should explain, for a non-scientist and in dropdowns: what we are doing, why, how step by step, what would prove us wrong, what could go wrong, the words used, and how to check it yourself. Reading level is measured by script (not asserted), every factual sentence is tied to a source, and every number has a reproduce command. See `dashboard/public/blueprint3d/studio-live/tracks/`.

## AI SaaS (travel planning) and the woolly mammoth connection: clarify
labels: partner, unclear

The note reads "AI SaaS -- travel planning / woolly mammoth connection". No reading is established. Candidate readings and the question that distinguishes them are in `tracks/research/` (decoder section). Which is meant?

## Embryo graphics: Google Flow was not used, and cell motion is measured, not simulated
labels: dashboard, graphics

The embryo is now drawn as shaded nuclei at measured radii. Google Flow was named in the request and not used. Cell motion in the embryo level is the measured tracked positions (not interpolated); molecular motion in the crowd level is a Brownian walk at a speed labelled an upper bound. Decision: is a Flow-generated rendering wanted, and if so as a still, a loop, or a replacement for the live view?
