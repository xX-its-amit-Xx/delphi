# Group 1 (academic): "Engineering zebrafish under machine-checked laws" — outline v0, 2026-11-13

Sources actually opened (local): tracks/BRIEF-2026-11-12.md, tracks/synthesis.json,
tracks/research/agents/pp-broad-fish-biologists.json (all under
D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci).
NOT opened in this run: any venue scope page, any external URL. Venue rows below are candidates
only, with no verified scope statement.

## Framing problem (state it in the cover letter, not hidden)
Tracks 1-4 and 6 as they stand use MDCK cysts, E. coli soft agar, Cello gate libraries and
autorotating plant fruits — none of them zebrafish. A zebrafish paper is therefore a
*re-instantiation* of the validated pipeline in a new organism, and the honest sell is the
method (Lean law + pre-registered prediction + nanopublication + reproduction gate), with
zebrafish supplying the first in-vivo test. The already-in-hand findings (track 3 reproduction
failure, track 4 base-angle failure) are the proof the pipeline bites; they are not fish data.

## Claims (C1-C5), each with the supplying track

| # | Claim | Level | Supplied by |
|---|---|---|---|
| C1 | Lumen shape of a zebrafish epithelial tube (gut or intrahepatic biliary duct) is set by regulated apical surface length per cell x cell number, not by lumen pressure. | morphological | Track 3 (claim, pipeline, pilot code; Laplace already machine-checked as `physiology-laplace`) |
| C2 | The published vertex-model sweep does not reproduce wild-type lumen shape (solidity RMSE 0.229 vs 0.124 for the median baseline) — so a model that fails its own reproduction gate cannot be used as the fish prior. | methodological | Track 3 pilot (already in hand) |
| C3 | Changing only the ribosome-binding-site-equivalent (translational efficiency) in front of a transgenic repressor translates a reporter's dose-response along the log-input axis without changing its Hill coefficient — threshold and steepness are separable design axes in vivo. | molecular | Track 1 (frozen calibration bound 0.25, calibration max 0.1587) |
| C4 | Stripe/spot spacing in a pigment or reporter pattern follows the diffusion-driven-instability wavelength relation, with a measured validity domain. | morphological | Track 2 (laws `turing-ddi`, `fisher-kpp-speed` already pinned in law set 1.8.1) |
| C5 | A fin/body geometric constraint predicts passive glide or coast performance; the constraint is necessary but not sufficient, and we say which term is missing. | organism | Tracks 4 and 6 (ported blade-element model; glide evaluation framework; printed surrogate) |

Law-set caveat to put in Methods: 14 of 59 pinned laws have no Lean theorem
(`lean_ref.module = null`), including `gene-regulatory-dynamics`, `fin-length-ratio`,
`aspect-ratio-induced-drag`, `elastic-similarity` — i.e. exactly the laws C3 and C5 lean on.
Closing those is part of the paper's contribution, not an assumption.

## Figures
- F1 Pipeline diagram: Lean statement -> pre-registered prediction -> frozen bound -> fish assay -> nanopublication (morphological + molecular). (Track 6 framework)
- F2 Reproduction-gate failure of the published lumen sweep, RMSE vs median baseline. (Track 3; exists)
- F3 Zebrafish lumen geometry vs apical-length x cell-number prediction, with the pressure model as the competing curve. (new data, C1)
- F4 Reporter dose-response families: translation-rate series, threshold shift vs Hill coefficient. (C3)
- F5 Pattern spacing vs predicted instability wavelength, with validity domain shaded. (C4)
- F6 Fin/body constraint: measured vs predicted, plus the printed passive surrogate comparison. (Tracks 4+6; the surrogate half exists)
- F7 Law-set audit table: which of the 59 pinned laws are machine-checked, which are placeholders.

## Minimal lab-in-the-loop experiment per claim
Cost class: A = under $2k consumables, B = $2-10k, C = over $10k / needs core facility.

| Claim | Zebrafish line | Readout | n | Timeline (dpf) | Cost |
|---|---|---|---|---|---|
| C1 | `Tg(ELAM:GFP)`-style apical/junction marker + membrane label (e.g. ZO-1 or Cdh1 reporter); wild-type AB first | Confocal z-stacks of gut/biliary lumen; segment solidity, apical length per cell, cell count | 20 larvae per condition, 3 clutches | image 3, 4, 5, 6 dpf | B (confocal time) |
| C1 (perturbation) | osmotic/pressure perturbation (hypotonic bath) vs apical-constriction drug (blebbistatin or Rock inhibitor) | same morphometrics | 15 per arm x 4 arms | dose 2-3 dpf, image 4 and 6 dpf | A-B |
| C2 | none (in silico) | rerun published sweep end to end; RMSE vs median baseline | 1 sweep, fixed seeds | n/a | A |
| C3 | heat-shock or Gal4/UAS driver with a 3-5 member translational-efficiency series on the repressor, fluorescent output | plate-reader or per-larva fluorescence dose-response; fit threshold + Hill | 12 larvae per dose x 6 doses x 4 constructs | inject 0 dpf, assay 2-4 dpf | B-C (transgenesis) |
| C4 | pigment-pattern or reporter stripe line; wild-type first | stripe spacing and width from lateral images | 25 larvae/juveniles | 5, 10, 20 dpf | A |
| C5 | wild-type AB plus a fin-size mutant or fin-clipped controls | high-speed video coast/glide decay; body + fin morphometrics; printed rigid surrogate in a water column | 15 fish per group; 21 printed surrogates | 30+ dpf (adult-ish) | B |

Sequencing: C2 this week (no lab). C1 wild-type pilot next. C3 last — transgenesis is the slow,
expensive arm and should be gated on C1 reproducing.

## What a fish biologist must sign off (before freeze, in writing)
1. That the chosen tube (gut vs intrahepatic biliary duct) actually has a measurable lumen at the stated dpf, and which stage window is comparable across clutches.
2. Line identity and availability, and whether the apical marker reports what we claim.
3. That the morphometric definition (solidity, apical length per cell) is extractable from our imaging modality, and the segmentation is not circular with the model.
4. Dose and toxicity limits for every drug arm, plus the confound list (developmental delay, oedema, swim-bladder failure) and how we exclude affected larvae.
5. Animal-protocol scope and stage limits (institutional review; feeding-stage larvae and adults are regulated differently).
6. n and clutch structure: that clutch is the replication unit, not the larva.
7. That the "pressure" arm is a fair test of pressure and not just an osmotic artefact.
8. For C5: that fin clipping/mutant comparison is a legitimate control for the geometric term.

Candidate sign-off reviewers from the Broad-fish scout (HYPOTHESES, no contact, no willingness
implied): zebrafish liver/biliary and craniofacial cartilage group (Goessling, MGH/BWH per the
Broad associate-member directory) is the closest fit to C1; a zebrafish embryo spatial-atlas
group (Schier, now Biozentrum Basel; Broad tie probably lapsed) fits C4; a zebrafish
vascular-mechanics group (Zon, Boston Children's) fits C5's mechanics. Nobody is to be contacted
by an agent.

## Target venues (candidates; scope statements NOT opened in this run)
- Development (The Company of Biologists) — zebrafish morphogenesis, C1/C4.
- eLife — method-plus-in-vivo-test shape, Reviewed Preprint model fits pre-registration.
- PLOS Computational Biology — if C2 and the law audit lead.
- Journal of the Royal Society Interface — C5 mechanics plus printed surrogate.
- Nature Methods / Nature Protocols — only if the pipeline, not the fish, is the product.
- bioRxiv first, with the freeze timestamp and nanopublication IDs in the abstract.
Action: open each scope page and paste the verbatim scope sentence before any submission choice.

## Three weakest points a reviewer will attack
1. **No zebrafish data exists yet, and none of tracks 1-4 is a fish system.** The paper currently
   claims a fish result while every in-hand finding comes from dog-kidney cysts, bacteria in agar,
   plasmid gate libraries and plant fruits. A reviewer will call the fish framing a graft.
2. **The formal layer is thinner than advertised.** 14 of 59 pinned laws have no Lean theorem,
   including `gene-regulatory-dynamics`, `fin-length-ratio` and `aspect-ratio-induced-drag` — the
   ones C3 and C5 need. "Machine-checked law" will be read as overclaiming unless the audit table
   (F7) is in the main text and the paper names which claims are checked and which are registry
   placeholders.
3. **The negative results may be reproduction errors, not model failures.** C2 (RMSE 0.229 vs
   0.124) and the track-4 base-angle miss (1.50 vs 1.22) both rest on our own re-implementations.
   A reviewer will demand the original authors' code, seeds and loading assumptions, and will
   note that an "effective loading" choice could explain the track-4 gap. Pre-register the
   reproduction criterion and publish the diff against the original implementation.
