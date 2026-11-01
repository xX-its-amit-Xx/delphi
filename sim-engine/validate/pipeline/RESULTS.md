# `validate_generation` — the unifying validator, and what it says when it is run for real

Built 2026-11-01. Code: `sim-engine/validate/pipeline/`. CLI: `sim-engine/validate-cli.mjs`.
MCP: `sim-engine/tools/pipeline-tools.mjs` (registration patch in `sim-engine/tools/PIPELINE-REGISTER.md`;
`server.mjs` was not edited).

Amit's signature, verbatim (2026-11-01):

> the text input to the model should also be provided to the validator; so input is generated genomic sequence +
> base genomic sequence & desired phenotype. Processor identifies functional analogue and fetches that genotype,
> and then analyzes functional annotations at every biological scale, verifies LeanBio, and checks physics.

```
validateGeneration({ generated, base, desired_phenotype, opts })
```

```bash
node sim-engine/validate-cli.mjs "a zebrafish that glides at least 5 m from a 1 m launch and survives 10-30 C as an adult" \
     --base zebrafish-adult --generated winged-zebrafish
```

This module **orchestrates**; it computes nothing another thread owns. The scorer owns the similarity results and
the Lean check (`validate/score.mjs`), the functional thread owns the ledger (`validate/functional/`), the physics
thread owns the physics (`validate/physics/`), the editplan thread owns the GRCz11 coordinate mapping
(`validate/editplan/`), the spec thread owns the text parser (`lib/parse-text.mjs`), and the five omics layers own
every annotation. What is new here is the **order**, the fact that the **desired phenotype is carried into every
step** (the components had been running without it), the **multi-scale annotation sweep**, and the honesty
accounting: what was given, what was not parsed, what no scale could answer.

---

## Read this before the results: there are no generated genomes

Amit's signature asks for a generated genomic sequence and a base genomic sequence. **This project has neither,
for any design.** A DELPHI design is a parent parameter set plus deltas. So the report states which of three cases
it is on **every** call, and `loci_covered` is emitted even when it is 0:

| `sequence_basis` | when | `loci_covered` |
|---|---|---|
| `supplied` | real sequence handed in for both sides (FASTA, plain, per-locus or whole-gene) | records compared |
| `reconstructed-at-edited-loci` | a document with gene-level edits; sequence exists **only** at those loci, mapped through the editplan thread's Ensembl GRCz11 coordinates (`resolveGenomic`, not duplicated here) | loci resolved |
| `document-only` | a document with no gene-level edit — **the case for every design in this repository** | `0` |

**All seven repository organisms carry `edits: []`.** They are parameter sets, not base-plus-edit documents. So in
every run below, `sequence_basis = document-only`, `loci_covered = 0`, `genome_fraction_assessed = 0`, and
`genotype_similarity` is **`cannot-assess`** — not a pass. The report says it in words:

> NO SEQUENCE WAS ASSESSED. Both sides were given as documents/design ids, and the generated document carries no
> gene-level edit, so there is no locus at which a generated sequence differs from the base and nothing to
> reconstruct. The differences between these two organisms are morphological parameter deltas, not alleles.
> loci_covered = 0; no part of the genome was compared.

A validator that implied whole-genome coverage from a parameter document would be the dishonest failure mode here,
and test 2 below exists to stop it.

---

## The headline verdict sentence

Base `zebrafish-adult`, generated `winged-zebrafish`, desired *"a zebrafish that glides at least 5 m from a 1 m
launch and survives 10-30 C as an adult"*:

> Desired phenotype: "a zebrafish that glides at least 5 m from a 1 m launch and survives 10-30 C as an adult"
> parsed into 3 criterion/criteria. Generated input was given as design-id ("winged-zebrafish") and base as
> design-id ("zebrafish-adult"); sequence basis document-only covering 0 locus/loci. Functional analogue(s),
> chosen from the desired function rather than relatedness: flying fishes (Exocoetidae) for leaves the water and
> glides on enlarged pectoral (and in four-wingers, pelvic) fins; zebrafish (Danio rerio) for survives and
> performs across a eurythermal window as an adult ectotherm. **PASSED: phenotype similarity. FAILED: the physics
> check** — FAIL: the design does not do what was asked. 1 hard criterion(s) not met:
> glide/glide_range_total_m — adult: cannot glide: the reachable launch speed 0.67 m/s is below v_min 8.64 m/s,
> so lift cannot carry the weight [achieved in 0.0 % of 200 draws over the stated input distributions; median
> 0 m, 5–95 % 0 to 0]. Standing physical checks failed: reaches_minimum_flight_speed@adult — reachable launch
> speed 0.67 m/s is 7.97 m/s below v_min 8.64 m/s; lifting_area_supports_mass@adult — the lifting area is 166.37×
> too small: 1.91 cm² against 317.76 cm² needed to carry 0.007 N at 0.67 m/s. **COULD NOT BE ASSESSED:** genotype
> similarity — no gene-level edit, so there is no edited sequence state to compare; this is not a pass. The Lean
> check — no Lean law could be evaluated on this design (22 cannot-evaluate, 8 out of scope). The
> functional-analogue ledger — `validate/functional/` has not landed. **SCALES NOT ASSESSED: cell, tissue,
> organ_system.** The word "validated" is **WITHHELD**: 1 gate failed; 3 gates could not be assessed; 3
> biological scales could not be assessed; no sequence was compared at any locus.

The scorer's own composite for this design is **0.878, "plausible"**. It is carried through under
`composite_score_from_the_scorer` and is **not** this report's verdict. A design the frozen scorer calls plausible
is the same design the physics module says cannot leave the water. That gap is the reason the five results are
reported side by side and never summed.

> ### Note added 2026-11-01 (re-verified): 0.878 is reproducible, and it is not the only number this design has
>
> The hub measured three different composites for `winged-zebrafish` and suspected 0.878 was stale. **It is not.**
> Every figure in this file was re-run on this tree and all five reproduce exactly: 0.8780, 0.4089, 0.8449, 0.9330,
> 0.4676. Nothing here needed a correction of its digits. What *was* missing is the condition under which 0.878
> holds, and it matters more than the number:
>
> | path | spec | `S` | composite |
> |---|---|---|---|
> | `design_score({organism:'winged-zebrafish'})` — no spec | none | did not run | **0.9217** |
> | this file: *"glides ≥ 5 m … **and survives 10–30 C as an adult**"* | 3 criteria, 1 failed 2 met | 0.6667 | **0.8780** |
> | `dashboard/public/validate-show/` walkthrough: *"…can glide over the water after leaping…"* | 1 criterion, failed | 0 → floor 0.01 | **0.4676** |
>
> All three are correct outputs of **scorer v1.0.0** on a **byte-identical input trait vector**. They differ only
> because the `S` (spec) component enters the weighted geometric mean when, and only when, a spec is passed — and
> `S` is computed from the criteria parsed out of the desired-phenotype **prose**.
>
> **So:** the headline 0.878 is higher than the walkthrough's 0.4676 for the same design *because this file's
> prose also mentioned a temperature range*. Asking additionally for something the design does trivially — any
> zebrafish survives 10–30 °C — moved the composite of a fish that cannot leave the water from 0.4676
> ("implausible") to 0.878 ("plausible"). A number that can be raised by asking for more things the design already
> does is not a measure of whether the design works. The composite was never this report's verdict; this is a
> second, independent reason it must not become one.
>
> **This number was repeated upward.** 0.878 has been quoted to the user and to other agents, and into
> `sim-engine/AGENT-GUIDE.md`, `sim-engine/skill/delphi-studio/SKILL.md`,
> `sim-engine/tools/PIPELINE-REGISTER.md`, `dashboard/public/studio-api/` and `dashboard/public/start/`, in each
> case without the spec condition and without the fact below. Both are now attached to the number in code
> (`score.evaluation`, `score.components_that_ran`).
>
> **And the fact that was never attached to it at all:** scorer v1.0.0's composite **FAILED** the blind held-out
> evaluation — 168 held-out families, family-out, independent evaluator, all three primary endpoints failed
> (`sim-engine/validate/evaluation/SCORER-EVALUATION.md`). So does every other released version's composite,
> v1.3.0 included. `0.878 "plausible"` is a reading from an instrument that has never passed its own
> pre-registered test. See `sim-engine/validate/SCORER-VERSION.md`.

---

## Per-scale coverage (headline run)

Ten scales. "Assessable" at a molecular scale means a swept gene had at least one record; at an anatomical scale
it means a term was reached by the difference set **and** at least one gene is annotated against it. Naming a term
is not assessing it.

| scale | assessable | coverage |
|---|---|---|
| `sequence_genomic` | yes | 9/9 swept genes have a record; 9/9 corroborated by ≥2 independent sources |
| `transcriptomic` | yes | 9/9 have a record; 7/9 corroborated |
| `proteomic` | yes | 9/9 have a record; 6/9 corroborated |
| `ptm` | yes | 8/9 have a record; 6/9 corroborated |
| `pathway` | yes | 9/9 have a record; 7/9 corroborated |
| `cell` | **NO** | no cell-scale object exists in any design (see below) |
| `tissue` | **NO** | 4 tissue objects exist; none is driven by any changed parameter (see below) |
| `organ` | yes | 2/2 terms reached have a swept gene (pectoral fin, pectoral fin lepidotrichium) |
| `organ_system` | **NO** | 1 term reached (musculoskeletal system, UBERON:0002204) and **0 genes** in the omics universe are annotated against it |
| `body` | yes | 1/1 (multicellular organism, UBERON:0000468) — always in scope, because the function asked for is a whole-body property |

**The gene-set coverage number, which is the one that matters most here:** the sweep read **8 of the 3,478 genes
annotated at the anatomy this design touches**. The other 3,470 were counted, not read. The swept set is the focal
panel from `sequences/genes.json` — the only genes with a called flying-fish orthologue — plus any gene carrying an
edit. That is a focal panel, not a survey of the fin.

What the five molecular scales actually hold for those nine genes:

- **sequence/genomic** — every gene has a locus and ≥2 sources. Allele phenotypes **at the pectoral fin
  specifically**: `tbx5a` 11, `shha` 6, `hhip` 4, `prdm1a` 3, `fgf10a` 2, `kcnk5b` 1, `slc43a2a` 1, `gja1b` 0 of 25
  recorded elsewhere, `kcnh2a` 0 of 0. Conservation is **whole-protein identity to the called flying-fish
  orthologue**, 54.2–89.4 %, and **2 of the 9 calls (`kcnh2a`, `shha`) are tblastn projections on the unannotated
  assembly rather than reciprocal best hits** — weaker evidence than the rest, and the report labels them.
- **transcriptomic** — 8 of 9 genes have exactly **one** `expressed_in` record at the pectoral fin out of ~25
  anatomy records each; `kcnh2a` has none. No quantitative level at the fin for any of them.
- **proteomic** — **zero** rows from any fin anatomy, for any gene, in the whole layer. Mass-spec evidence exists
  for 8 of 9 genes (1–7 records each) and **`kcnk5b` has none at all**.
- **ptm** — 75 sites across the nine genes, of which **73 are borrowed from a human or mouse orthologue** and were
  never observed on the zebrafish protein; 35 carry a "conserved" call. `fgf10a` has no PTM record of any kind.
- **pathway** — 113 of 276 pathway/GO records across the nine genes rest on an experimental evidence code;
  `kcnh2a` has **0 of 13**. No pathway record is conditioned on anatomy or stage.

### Two gaps that are gaps in the design, not only in the data

**The cell scale does not exist.** All six `blueprint3d` manifests declare their levels as
`"body / organ system / organ / tissue"`, and across all six every object is level `organ` (96–108) or `tissue` (4)
— **zero cell-level objects**. There is no cell-type geometry, no cell-type parameter and no cell count in any
design. `omics/index/parts.json` holds 8 `CL:` terms but none is linked to a design object. The cell scale of every
DELPHI design is therefore entirely unassessed, and this report says so rather than leaving it blank.

**The winged zebrafish grew the wing without changing the muscle.** The tissue scale is unassessable on the
headline case for a specific reason the report spells out:

> the design DOES carry 4 object(s) at the tissue scale — muscle_L (driven by myomere_count, body_depth_over_SL,
> body_width_over_SL); muscle_R (same); pectoral_muscle_L (driven by flight_muscle_fraction, body_mass_kg,
> standard_length_m); pectoral_muscle_R (same) — and NONE of them is driven by any of the changed parameter(s)
> pectoral_len_over_SL, pectoral_span_over_SL, pectoral_area_over_SL2. The design therefore changes the scale
> above without changing these, which is a gap in the design, not only in the data.

The fin planform went up 4.45× in area; the pectoral muscle that would have to move it was not touched. The physics
failure (lifting area 166× too small at the reachable launch speed) and this tissue gap are the same fact seen at
two scales.

---

## The control: the real flying fish as 'generated'

The brief predicted that the real flying fish, run as `generated` against the zebrafish base with the same desired
phenotype, "should pass the physics and resolve far more of the ledger — if it doesn't, something upstream is wrong
and you should say so."

**On the discriminating requirement it does exactly that.** The glide criterion `glide_range_total_m >= 5 m`:

| generated | glide criterion | why |
|---|---|---|
| `flying-fish` (the real animal) | **met** | — |
| `winged-zebrafish` | **not met** | reachable launch speed 0.67 m/s against v_min 8.64 m/s |
| `wingless-flying-fish` | **not met** | the wings are gone |
| `ff-zf-chimera` | **no model** | "blended species: no measured leap or burst speed exists for a blend, and none is invented" |
| `tff` | **met** | but a standing check fails: only 26.6 % of the requested flight-muscle volume fits inside the skin |

So the physics module separates the real glider from the design that merely has bigger fins, which is the thing a
control is for. Nothing upstream is wrong in that respect.

**But the control's overall physics gate is `cannot-assess`, not `pass`, and the reason is worth naming.** Of the
three parsed criteria, two are the thermal ones, and for the real flying fish they come back `no model`:

> the scenario reports survives = null: it does not model survival of this condition

`sim-engine/scenarios/temperature.mjs` holds CT limits only for zebrafish (Andreassen 2022) and **refuses to
substitute them** for another species: *"no thermal tolerance, Ucrit-temperature or Q10 measurement was found for
flying fish (searched Europe PMC 2026-10-31; flying fish: none). Zebrafish values are not substituted."* That is
the right behaviour, and it means **"survives 10–30 °C" is unanswerable for the real flying fish from the data on
hand**. The `ff-zf-chimera`, whose species string contains zebrafish, *does* get an answer — by borrowing the
zebrafish numbers, labelled `borrowed`. Two organisms, the same question, one answerable only through a borrowed
constant: that asymmetry is a data gap in the thermal layer, not a property of the designs.

**The requirement ledger is a different story, and here the brief's prediction could not be tested.** The
functional thread's `validate/functional/index.mjs` has not landed, so `functional_resolution` is
`cannot-assess` on all five runs and **no ledger resolution was computed for any design, control included**. What
this pipeline could supply itself is a 5-entry requirement set read from repo data files
(`physics/glide-data.csv`, `physics/takeoff-data.csv`, `physics/results.json`, the `perturb-thermal` law), and all
5 entries are nominally checkable at a reachable scale for every design — which is a statement about scale
reachability, not about resolution. **The claim that the control "resolves far more of the ledger" is therefore
untested, and I am not going to report it as confirmed.**

---

## Every run

Desired phenotype identical in all five: *"a zebrafish that glides at least 5 m from a 1 m launch and survives
10-30 C as an adult"*. Five named results, never summed; `document-only` / `loci_covered: 0` in all five.

| case | generated | base | geno | pheno | lean | functional | physics | scorer's composite |
|---|---|---|---|---|---|---|---|---|
| headline | `winged-zebrafish` | `zebrafish-adult` | cannot-assess | **pass** | cannot-assess | cannot-assess | **FAIL** | 0.878 |
| TFF | `tff` | `zebrafish-adult` | cannot-assess | **FAIL** | cannot-assess | cannot-assess | cannot-assess | 0.409 |
| chimera | `ff-zf-chimera` | `zebrafish-adult` | cannot-assess | **pass** | cannot-assess | cannot-assess | cannot-assess | 0.845 |
| **control** | `flying-fish` | `zebrafish-adult` | cannot-assess | **pass** | cannot-assess | cannot-assess | cannot-assess | 0.933 |
| subtraction | `wingless-flying-fish` | `flying-fish` | cannot-assess | **pass** | cannot-assess | cannot-assess | **FAIL** | 0.468 |

The word "validated" is withheld in all five.

**Every composite in this column is scorer v1.0.0 WITH the spec above, and is comparable only with another
composite computed the same way** (re-verified 2026-11-01: 0.8780, 0.4089, 0.8449, 0.9330, 0.4676). With no spec
the same five designs return 0.9217, 0.3492, 0.8201, 0.9217, 0.9217 — the subtraction case moves from
"implausible" to "plausible" purely by not being asked for anything. v1.0.0's composite failed the blind held-out
evaluation, as did every released version's; the grid and the per-version numbers are in
`sim-engine/validate/SCORER-VERSION.md`.

- **TFF** — 22 parameter differences; the only case where phenotype similarity fails: OOD flag set, with
  `pectoral_area_SL2`, `pectoral_span_SL`, `caudal_upper_SL` and `caudal_lower_SL` outside the envelope. Its glide
  criterion is *met*, but a standing check reports that only 26.6 % of the requested flight-muscle volume fits
  inside the skin, so "any power claim that charges the full muscle mass is unphysical". **Six** of its 22
  differences move **away** from the flying fish, and they are the ones that matter —
  `pectoral_span_over_SL`, `pectoral_area_over_SL2`, `pelvic_len_over_SL`, `caudal_upper_lobe_over_SL`,
  `caudal_lower_lobe_over_SL` and `flight_muscle_fraction`: it is not an exaggerated flying fish, it is
  somewhere else.
- **chimera** — 21 differences, every one toward the flying fish. Glide: `no model`, because no measured leap or
  burst speed exists for a blend. Its thermal criteria are the only ones in the set that come back *met*, and only
  by borrowing the zebrafish constants.
- **subtraction (`wingless-flying-fish` vs `flying-fish`)** — the direction field is what makes this case read
  correctly. All three pectoral parameters *decrease*, and the report marks each as moving **AWAY from the
  analogue** (and toward the zebrafish). A loss of function is reported as a move away, not as an absent gain.
  Physics fails, as it must.
- **Lean is `cannot-assess` on all five.** Across the runs: 0 laws hold, 0 violated, 4–10 out of scope, 20–26
  cannot-evaluate. The scorer's own gate sentence ("no accepted-law violation found") is true and is carried
  through unchanged, but this pipeline will not report "no violation found" as a pass when **no law could be
  evaluated at all**. That distinction is the whole reason the third status exists.

---

## Three gates on the honesty of this report, each failed once on purpose

`node sim-engine/validate/pipeline/test.mjs` — **21 passed, 0 failed.**

Every property test runs twice: once against the real report, and once against a report broken in exactly the way
the test exists to catch. The broken run **must** fail. A check that has never failed is not known to check
anything, so the negative controls are part of the suite rather than something done by hand once and forgotten.

1. **Unparsed desired-phenotype text must appear in the report.** Run with *"…echolocates at 40 kilohertz, and has
   a prehensile tail rated to 12 blorks"*; the test asserts each unparsed clause is a **verbatim substring** of the
   input, carries a reason, appears in `verdict.unparsed_desired_phenotype`, and is named among the reasons the
   word "validated" was withheld. Negative controls: a report that drops the unparsed list, and one that
   *paraphrases* it to "some unusual requirements" — both correctly rejected. An unparsed requirement is an
   unchecked requirement.
2. **A document-only input must not claim sequence coverage.** Asserts `document-only`, `loci_covered === 0`,
   `genome_fraction_assessed === 0`, the "NO SEQUENCE WAS ASSESSED" wording, and
   `genotype_similarity.status === 'cannot-assess'`. Negative controls: a report mutated to claim 9 loci and
   `supplied`, and one mutated to pass the genotype gate with no edits — both correctly rejected.
3. **A failing gate must prevent the word "validated".** One failing gate, one unassessable gate, and one
   unassessable *scale* each withhold the word. A separate check scans every human-facing sentence (verdict, each
   gate, the sequence statement, the scope) for "validated" used as a positive claim — permitted only after a
   denial, inside quotes, or in the withholding itself. Negative control: a verdict mutated to say "The design is
   validated" with a gate failing — correctly rejected.

Plus: the report shape holds for all four designs the walkthrough animation calls with (addition, subtraction,
functional addition with no real counterpart, two-parent blend); an unknown design id is reported as `unknown-id`
with the list of ids that do exist rather than matched to a near neighbour; and an empty desired phenotype is
reported as such, with nothing checked.

---

## What I could not assess, and why

| | why |
|---|---|
| **Any sequence, at any locus** | no generated genome exists; every repository design carries `edits: []`, so there is no edited locus. The reconstruction path (`editplan resolveGenomic`, GRCz11) is wired and will run the moment a design carries a gene-level edit, but it has never had one to run on. |
| **`functional_resolution`, on every case** | `sim-engine/validate/functional/index.mjs` has not landed (the directory holds only `scripts/fetch-orthologues.mjs`). The interface is coded to `functionalResolution(design, opts)` through the scorer thread's `functional-interface.mjs`, which validates the shape and recomputes the counts. Nothing was assumed in its place, and the brief's prediction about the control resolving more of the ledger stays untested. |
| **The Lean gate, on every case** | 20–26 laws cannot evaluate from STATE and 4–10 are out of scope; 0 evaluated either way. Reported as `cannot-assess`, never as a pass. |
| **The thermal criterion, for every flying-fish-species organism** | `scenarios/temperature.mjs` holds CT limits for zebrafish only and refuses to substitute them. No flying-fish thermal measurement exists (Europe PMC searched 2026-10-31). |
| **The cell scale, on every design** | no design has a cell-level object. Structural, not incidental. |
| **The tissue scale, on the headline and subtraction cases** | the tissue objects that exist are not driven by the parameters that changed. |
| **The `organ_system` scale** | the one term reached (musculoskeletal system, UBERON:0002204) has 0 genes annotated against it in the omics universe. |
| **3,470 of the 3,478 genes annotated at the touched anatomy** | the sweep reads the focal panel plus edited genes. The rest are counted and named as unread. |
| **Any flying-fish expression, protein or PTM state** | measured, not assumed: `scan-gaps.mjs` counts **0** *Hirundichthys speculiger* rows in all five omics layers (185,526 + 380,449 + 199,149 + 97,470 + 51,327 rows). The proteomic layer holds 3 Exocoetidae rows in total, from two other genera. Xu et al. 2021 report no RNA-seq for the species at all. |

### A stated gap that did not survive checking

The brief carried a known gap as "four fin genes have no protein evidence at all". Measured against the current
index, **one** of the nine focal genes (`kcnk5b`) has zero mass-spec records; the other eight have 1–7. The
figure is stale, and the sweep computes it rather than quoting it. Two stated gaps **did** hold exactly:
no flying-fish transcriptome or proteome (0 rows, every layer), and no protein dataset from fin tissue (0 of
199,149 proteomic rows carry any fin anatomy). Aves rows: **0** in every layer — the holdout is intact.

`coverage-gaps.json` in this folder holds those counts, with the date they were measured, and
`node sim-engine/validate/pipeline/scan-gaps.mjs` (~4 s) regenerates it when a layer is rebuilt. Every "what is
unknown" line in the sweep that quotes a figure quotes it from there, and says "figure not measured" rather than
inventing one if the file is absent.

---

## Files

| file | what |
|---|---|
| `index.mjs` | `validateGeneration()` — the entry point and the orchestration |
| `inputs.mjs` | input resolution (design id / document / FASTA / raw sequence), the sequence-basis statement, reconstruction at edited loci through editplan |
| `analogue.mjs` | the functional analogue chosen from the desired function, its genotype, the requirement set |
| `scales.mjs` | the ten-scale annotation sweep and the per-scale coverage numbers |
| `gates.mjs` | one gate per named result, three statuses, and the verdict sentence |
| `deps.mjs` | loaders for the other threads' modules; "did not run", with the reason, when one is absent |
| `scan-gaps.mjs` → `coverage-gaps.json` | measured coverage gaps, so the sweep quotes figures rather than memories |
| `test.mjs` | 21 checks, each property also run against a deliberately broken report |
| `../../validate-cli.mjs` | the CLI; exit 0 all passed, 1 a gate failed, 2 nothing failed but something could not be assessed |
| `../../tools/pipeline-tools.mjs` | the `validate_generation` MCP tool |
| `../../tools/PIPELINE-REGISTER.md` | the `server.mjs` patch (not applied here) |

Not edited, by instruction: `score*.mjs`, `functional-interface.mjs`, `functional/`, `physics/`, `editplan/`,
`benchmark/`, `evaluation/`, `scenarios/`, `omics/build-index.mjs`, `server.mjs`. Nothing committed or deployed.
No credentials. No Aves data anywhere, and the holdout was verified empty by count, not assumed.
