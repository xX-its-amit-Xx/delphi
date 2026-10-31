# nanopubs-index — the curated index of this repo's nanopublication drafts

Snapshot **2026-10-31, 21:50–22:15 UTC**. Written by the curation session; **nothing here is signed or
published, and nothing in any thread's own folder was edited**. Signing is the ORCID key owner's decision
and is still open.

| file | what it is |
|---|---|
| `index.json` | one record per draft: path, thread, title, assertion, status, entities, ontology terms, sources, verbatim-quote flag, declared ontology version, `np check` result, grounding verdict |
| `catalogue.md` | the same corpus as one line per draft, grouped by theme |
| `gaps.md` | dashboard claims with no draft, and drafts with no source |
| `calls.json` | every `orx` / Europe PMC call: time, exact command, result, hits, raw file, verdict, plus the logged failures |
| raw outputs | `C:\Temp\npcurate\raw\` (not in the repo) |

---

## Lead with this: five things that would change what we claim

**1. A declared null is contradicted by findable literature.**
`genotype/nanopubs/unsigned/gap-no-ray-to-interray-signalling.trig` says *"No signalling arrow between a
fin ray and the inter-ray tissue could be sourced in any fin of any fish."* One short PubMed query
(`orx discover pubmed "fin ray interray signaling"`, plan id `h18`) returns, on the first page:

- **PMID 12482711** / `10.1006/dbio.2002.0848` — *Ray-interray interactions during fin regeneration of
  Danio rerio.* Grafting experiments: "the interray blastema is necessary for a proper bifurcation of
  each ray", "the interray tissue and surrounding epidermis can modulate the length of the ray", and
  **bmp4** named as the candidate signal, with msxA/msxD in the ray and interray epidermis under
  ray-blastema control.
- **PMID 26253402** / `10.1242/dev.120212` — *Retinoic acid signaling spatially restricts osteoblasts and
  controls ray-interray organization.* A Cyp26a1 retinoic-acid-degrading niche maintains the ray-interray
  boundary; disrupting it makes preosteoblasts invade the neighbouring interray.
- **PMID 29441573** / `10.1111/joa.12785` — *Widening control of fin inter-rays in zebrafish.* Associates
  **kcnk5b, fibroblast growth factor receptor 1 and the sonic hedgehog pathway** with inter-ray cell
  function, under **ray-dependent regulation**.

The record's own narrow criterion — "a ligand in one compartment and a receptor in the other", adult
pectoral fin — is arguably still unmet by the letter. But the record's **headline sentence** is the one
that travels to the dashboard, and it is wrong. Worse: the third paper is **already cited by this same
thread** (`fin-size-bioelectric-leads.trig` cites `10.1111/joa.12785`), and the gap record itself says it
read that paper **"title only"**. The null rests on not having read the abstract of a paper the thread
already had. **Recommendation: narrow the record to its real criterion and its real scope, or withdraw it.
Do not present it as a measured null about fish fins.**

**2. Two "different" organism blueprints are byte-identical.**
`claim-blueprint-cattle.trig` and `claim-blueprint-a-domestic-dog.trig` both report 13 organ systems, 65
organs, 219 tissues, 265 cell types — and their evidence records cite **exactly the same 83 UBERON terms
and the same 266 CL terms, with zero difference**. The generic
`claim-blueprint-a-mammal-with-a-four-chambered-heart-and-lungs.trig` differs from cattle by **0 UBERON
terms and 8 CL terms**. The tool is not resolving mammalian anatomy below roughly class level on these
inputs. The drafts honestly say Uberon's taxon constraints are sparse, but they are nonetheless presented
as per-species blueprints, and ten blueprints are counted on the dashboard as ten results.

**3. The kcnk5b contradiction is real, but its source set is incomplete — and one uncited paper reframes
the step.** `chain-kcnk5b-fin-size.trig` states that *three* papers disagree on whether the
growth-driving change is a hyperpolarization or a depolarization. It cites four works. The thread's own
`fin-size-bioelectric-leads.trig` cites two more that the chain record does not:
**PMID 33830014** (`10.7554/eLife.60691`, *A calcineurin-mediated scaling mechanism that controls a
K+-leak channel to regulate morphogen and growth factor transcription*) and **PMID 31472116**
(`10.1016/j.ydbio.2019.08.016`, *Integrated K+ channel and K+Cl− cotransporter functions…*). The first
shows Kcnk5b activation driving developmental-gene **transcription** cell-autonomously, regulated by
calcineurin phosphorylation at Ser345 — which suggests the operative step may not be a net
membrane-potential sign at all. The second shows a K+-Cl− cotransporter **loss** of function producing
the same overgrowth, which matches Daane 2018's decreased-conductance result. The contradiction should be
restated over six sources, not three, and the "which sign?" framing may be the wrong question.

**4. Several of the six zebrafish refutations have published precedent that the drafts do not cite.**
Per `AGENTS.md` A2 this is the point of the check, not a failure — but it changes the novelty framing:
- `refutation-4` (Shh does not drive fin-ray proliferation) cites only Braunstein 2021. **PMID 28351866**
  / `10.1242/dev.143792` (2017) already concluded "Shha/Smo is functionally dedicated to ray branching
  during fin regeneration", explicitly against the pro-outgrowth reading.
- `refutation-3` (the ZPA is not the sole source of AP information) does not cite **PMID 18811955** /
  `10.1186/1471-213X-8-91`, which reports that in zebrafish *shh* mutants "proliferation in the pectoral
  fin buds is initially normal".
- `refutation-6` (HGF/MET not conserved across gnathostomes) does not cite **PMID 30644548** /
  `10.1111/dgd.12591`, the catshark paper that states Hgf is expressed in pectoral fin buds while c-Met is
  rapidly downregulated — the primary source for the draft's own shark sentence.

Also, only **four** of the six declare status `refuted`; two declare "not established in zebrafish".
"Six refutations of textbook limb signalling" overstates two of them.

**5. The flying-fish aerobic-flight elimination survives the check — and that is the strongest result in
the corpus.** No query in this run returned prior work that eliminates sustained aerobic powered flight in
a flying fish. The adjacent literature is engineering (**PMID 24615533**, AquaMAV water-exit launch) and
scaling (**PMID 14562101**, Strouhal-number cruise), not a physiological elimination. The wind-tunnel
source the envelope rests on (**PMID 20833919**, Park & Choi) **is** cited, by DOI, in every physics
draft. Two directly relevant works are missing: **PMID 35771996** / `10.1093/icb/icac101` (*An Adaptable
Flying Fish Robotic Model for Aero- and Hydrodynamic Experimentation*, 2022) and, for the altitude claim
in `hypothesis-tff-v2-codesign-map.trig` and the new `law-altitude-coupling.trig`, **PMID 24501268**
(*Surpassing Mt. Everest: extreme flight performance of alpine bumble-bees*) and **PMID 37622957**
(high-altitude flapping flight power). Cite them and the elimination gets stronger, not weaker.

---

## Counts

**157 unsigned drafts**, not the 139 this task was briefed with. The lean and genotype threads wrote 18
more while this index was being built (16 lean `law-`/`scope-` pairs for Haldane's cost of selection, the
law of Laplace, Q10, the genetic code, pleiotropy closure, developmental ordering, substitution time and
altitude coupling; 2 genotype records). Everything below covers all 157.

| thread | drafts |
|---|---|
| `lean/nanopubs/unsigned` | 55 |
| `organism-design/nanopubs/unsigned` | 35 |
| `genotype/nanopubs/unsigned` | 21 |
| `claim-tests/nanopubs/unsigned` | 15 |
| `physics/nanopubs/unsigned` | 13 |
| `holdout/nanopubs/unsigned` | 9 |
| `swarm/nanopubs/unsigned` | 9 |
| **total** | **157** |

Status, as each file declares it:

| status | n | | status | n |
|---|---|---|---|---|
| (none declared) | 44 | | gotcha | 4 |
| formal statement (Lean law / proof scope / rubric) | 49 | | partially supported | 3 |
| supported | 21 | | not established in zebrafish | 2 |
| inconclusive | 13 | | burned (holdout item retired) | 2 |
| refuted | 10 | | mixed within one reading | 1 |
| established by enumeration | 4 | | measured null | 1 |
| | | | documented refusal | 1 |
| | | | hypothesis | 1 |
| | | | observed | 1 |

**The 44 with no declared status are the largest rule gap in the corpus.** 34 of them are every
`claim-blueprint-*` and `evidence-blueprint-*` record plus the ESMFold, cytochrome-c and template records
in `organism-design`: none carries a `delphi:hasVerdict`, a `schema:PropertyValue "status"`, or a
"Status:" sentence anywhere. The standing order in `AGENTS.md` lists status as item 2 of the five a record
needs. The other 10 are evidence companions whose paired claim does declare one (acceptable) and
`prereg-organism-design-aves.trig`, whose status is its pre-registration.

### The 247 signed nanopubs, and how they differ

`darwin-origin/nanopubs/signed/` holds 247 **signed, published** records — a different kind of object:

- **Trusty URIs.** `https://w3id.org/np/RAWt2GFAX0dk-…`, not the `http://purl.org/nanopub/temp/np1/`
  placeholder all 157 drafts use. `np check` reports them *"trusty with signature"*; the drafts report
  *"Valid (but not trusty)"* plus *"no signature element"*.
- **A human ORCID** (`0009-0007-4948-9192`) as creator and signer. The drafts deliberately carry none:
  the creator is the software agent until the key owner approves (team decision of 2026-10-31,
  `claim-tests/nanopubs/DECISIONS.md`).
- **They are source attestations, not findings.** One claim extracted from *On the Origin of Species*
  with its chapter and quoted sentence. No test result, no measured number, no pre-registration, no
  `delphi:EvidenceItem` of the kind the 2026-10-31 standing order requires.
- **They predate the v2.0 term set and the one-record-per-finding order**, so they are not comparable and
  are counted separately everywhere here.
- **They are irreversible.** Corrections need a `supersede`, withdrawals a `retract`, both signed by the
  same identity. Nothing in this index touches them.

`darwin-origin/nanopubs/unsigned/` holds the same 247 filenames — the pre-signing copies, not new records.

### Scoping note: the repo holds 4,898 `.trig` files, not 157

The 157 are the hand-authored micro-discovery corpus. Also present, and **not** indexed here:

| corpus | files | what |
|---|---|---|
| `darwin-origin/nanopubs/` | 991 | 247 signed + 247 pre-signing copies + 494 LLM assessment records + 3 |
| `thompson-growth-form/nanopubs/` | 1,748 | 291 signed + 291 unsigned + 582 + 582 assessments + 2 rubrics |
| `wolfram-nks/nanopubs/` | 1,926 | 321 signed + 321 unsigned + 642 + 642 assessments |
| `math-bio-theorems/nanopubs/` | 42 | 21 signed-test + 21 unsigned |
| `dashboard/public/t/physics/data/nanopubs/` | 13 | **mirror copies of the 13 physics drafts** |
| `dashboard/public/t/swarm/nanopubs/` | 15 | mirror copies of swarm drafts and fetched templates |

Anyone counting `.trig` files repo-wide will double-count the physics and swarm drafts and will mix
machine-generated assessment records into a finding count. Say which corpus a number refers to.

---

## Validation

**157 of 157 pass.** Checker: `nanopub-java 1.95.0` (`nanopub-1.95.0-jar-with-dependencies.jar`),
one `check -v` run per file, 157 runs.

The project's recorded trap is real and was handled. `np check` **exits 0 on an RDF parse error**, so the
exit code is worthless. Verified in this run: a deliberately truncated draft printed `RDF ERROR:` and
`Summary: 1 errors;` and still **exited 0**. The parser used here therefore reads the transcript
structurally — verdict only from the lines before the validator's first section marker, issues only from
the **last** `ISSUES:` marker up to `Summary:`, since a record's own description is printed at column 0
and could otherwise forge either. Self-test: the truncated file fails, a real draft passes.

A "pass" means: `Valid (but not trusty)`, no `RDF ERROR`, and `Summary: 1 valid (not trusty)`.

Issues reported, and whether each is expected:

| issue | files | expected? |
|---|---|---|
| `Nanopub has no signature element.` | 157 | **Yes.** Every record is an unsigned draft by design. |
| `Nanopub has no assertion template.` | 157 | **Yes, by recorded decision.** The published Delphi claim and evidence-item templates still use legacy `probknow` IRIs, so a v2.0 record cannot instantiate them — see finding 4 below and `swarm/nanopubs/DECISIONS.md`. |
| `Unexpected graph uri: …/temp/npN/…` | 157 | **Yes.** `purl.org/nanopub/temp/` placeholders are replaced by trusty URIs at signing. |
| `Nanopub has no provenance template.` | 124 | **Yes** for these; the other 33 do declare one (below). |
| `Nanopub creation time is older than one hour.` | 68 | Cosmetic; these were built earlier in the day. |

**No file produced an issue beyond this expected set.** No parse error, no missing graph, no malformed
literal, no file holding more than one nanopub (checked: exactly one `np:Nanopublication` per file in all
157).

### Project rules

| rule | result |
|---|---|
| **No human ORCID** | **Clean.** 0 of 157 use an ORCID IRI as `dct:creator` or in `prov:wasAttributedTo`. Two files contain an ORCID IRI (`0000-0002-1267-0234`) in the two `delphisci-swarm-04-…probknow-iris` records — it is cited as **external data**: the creator of the published template being described. That is a citation, not an attribution, and is correct. |
| **No template declaration unless genuinely instantiated** | **Clean.** 124 files declare none. 15 (`claim-tests`) declare only `nt:wasCreatedFromProvenanceTemplate`; 18 (`holdout`, `swarm`) declare that plus `nt:wasCreatedFromPubinfoTemplate`. Spot-checked: the provenance graphs do carry `prov:wasAttributedTo` and the pubinfo graphs do carry `dct:creator` and `dct:license`, so the placeholders are genuinely filled. **No file declares the assertion template it cannot fill** — the defect the corpus itself documents. |
| **Delphi ontology v2.0** | **157 of 157** resolve `delphi:` to `https://w3id.org/delphi/ontology/`. No `probknow` IRI is asserted anywhere (the two swarm records quote the namespace as the thing they are reporting). 93 of 157 also state "ontology v2.0" in prose; the other 64 declare the version only through the namespace, which is the operative fact. There is **no machine-readable version predicate** on any record — `owl:versionInfo`, `dct:hasVersion` and the like are absent corpus-wide. Worth adding before signing. |
| **Verbatim quote** | 47 of 157 carry an escaped verbatim quotation; 110 do not. Most of the 110 are Lean `law-`/`scope-` records (which quote a theorem, not a sentence) and evidence companions, so this is not a violation of the A1/A2 quote rule as written — but `claim-tests` and `physics` records that rest on a paper's wording should carry one. |

### Defect found in `organism-design`: a malformed domain IRI in all 35 records

Every `organism-design` draft asserts its domain as

```
<https://w3id.org/delphi/resource/domain/https://w3id.org/delphi/resource/domain/organism-anatomy-blueprints-from-ontologies>
```

— the prefix is applied twice. It parses (so `np check` passes) but the IRI is wrong and will not join to
the domain node any other thread uses. A one-line builder fix; **reported, not fixed, because
`organism-design/nanopubs/` belongs to another session.** 35 of 35 files affected.

---

## Contradictions and duplicates

### The two cases this task asked us to verify rather than assume

**`gja5a` — RETRACTED, and the retraction holds.** `grep -ri gja5a` over all 157 drafts returns **zero
hits**. No draft asserts the `gja5a` link in any form. `genotype/nanopubs/DECISIONS.md` records why it was
dropped (the fin-length connexin in zebrafish is `gja1b`/cx43, `gja5a` has no ZFIN fin expression or
phenotype record, and Daane 2021 puts cx43 under *constrained* evolution on the flying-fish branch).
**Verified clean.**

**`kcnk5b` electrical sign — carried as one record, as intended.** Exactly one record states the
conflict: `chain-kcnk5b-fin-size.trig`, status *"mixed within one reading"*, with the supported and
unsupported components stated separately and the disagreement counted as its own metric
(`papers_disagreeing_on_the_sign` = 3). There is **no second record** asserting either sign. The other
four drafts mentioning `kcnk5b` make different claims and do not assert a sign:
`fin-size-bioelectric-leads` (gain of function enlarges fins), `finding-segmentation-favours-kcnh2a-mechanism`
(segmentation argues against kcnk5b as the *flying-fish* mechanism), `pectoral-fin-gene-links` (kcnk5b is
the one verified gain-of-function gene), `gotcha-clean-phenotype-file-includes-treatments`.
**Verified as designed** — see finding 3 above for the one problem, which is source coverage, not
duplication.

### Others found

**A. One finding, two threads, four records.** `organism-design/.../claim-delphi-v2-template-declarations-are-false.trig`
(+ its `evidence-delphi-v2-template-counts.trig`) and `swarm/.../delphisci-swarm-04-published-delphi-templates-use-legacy-probknow-iris.trig`
(+ its `--evidence`) assert the **same** finding — that the published Delphi claim and evidence-item
templates use legacy `probknow` IRIs, so a v2.0 record cannot instantiate the template its pipeline
declares. Both are status *supported*, both checked the same templates on the same date, and they were
drafted independently. This is a genuine duplicate: one record with both threads as contributors, or one
record superseding the other. The swarm record carries the per-template `pk:` occurrence counts (11 and
13) and the ORCID of the template creator; the organism-design record carries the migration state of the
ontology source. Merge, do not publish both.

**B. Two "different" blueprints with identical content** — finding 2 above. `cattle` and
`a-domestic-dog` are the same 83 UBERON + 266 CL terms. `a-mammal-with-a-four-chambered-heart-and-lungs`
differs from both by 8 CL terms and nothing else. Three records, one result.
`a-flying-fish` and `a-teleost-fish…` both report exactly 257 cell types.

**C. A label-level conflict inside the physics thread that the bodies resolve.**
`finding-sim-v2-launch-not-reachable.trig` says the fish "cannot reach lift-off speed in the coupled
model, **and its aerobic power is two orders of magnitude short of powered flight**".
`finding-sim-v3-drag-not-power.trig` says the model "failed to launch the real flying fish **because of
its assumed water drag, not its modelled muscle power**". Read as labels — which is how a dashboard reads
them — those conflict on the cause of the launch failure. Read in full they do not: v2 attributes
non-reachability to the drag sweep and separately reports the aerobic shortfall; v3 pre-registered H3,
removed the assumed drag, and launched the fish while the aerobic shortfall persisted unchanged (0.009 W
against 1.44 W in both). **Not a contradiction, but v2's label needs the word "assumed drag" in it, or v2
should be superseded by v3.**

**D. A new record refutes a reading the older records invite.** The genotype thread's
`finding-convergent-site-panel-is-not-a-dose-response.trig` (written during this session) finds that
gliding halfbeaks carry a mean of **24 of 38** derived states at a pectoral-fin-to-body ratio of **0.274**,
while flying fishes carry **21.4** at a ratio of **0.687** — the group with the much smaller fin carries
slightly *more* derived residues. That removes the dose-response reading of the convergent-substitution
panel that `fin-size-bioelectric-leads.trig` and `daane-2021-fin-length-ratios.trig` set up by sitting
beside each other. The three records are individually consistent; the sequence is misleading unless the
new one travels with them. **Make the new record the one the dashboard surfaces.**

**E. A self-correction, correctly done.** `correction-flying-fish-genome-exists.trig` corrects a claim
this project published: an annotated flying-fish genome **does** exist (23,611 predicted protein-coding
genes, 23,492 with a database hit), so what flying fish lack is expression and phenotype data, not genes.
Checked: **no surviving draft asserts the superseded statement.** The four remaining "no flying-fish …"
phrasings all read "no flying-fish *experiment* exists", which is true and different. Clean.

**F. Four `--numeric` / `--qualitative` siblings are a split, not a duplicate.**
`darwin1859-ch09-03--numeric` (refuted) and `--qualitative` (not tested, no pre-registered criterion) are
the one-record-per-reading pattern `AGENTS.md` asks for. Correct as built.

**G. `thompson1917-ch03-07` exists in two threads with different force.** The Lean record
`law-thompson1917-ch03-07.trig` machine-checks "weight tends to vary as the cube of linear dimensions".
The test record `claim-tests/.../thompson1917-ch03-07.trig` measures the exponent at **2.74 (CI 2.59–2.89)
for males and 2.86 for females** and calls it *supported* against a pre-registered 2.5–3.5 band. Both are
right in their own terms — a proof about what follows from isometry, and a measurement that is not 3. They
are not a contradiction, but a reader who sees "cube law: proved" and "cube law: supported" side by side
will conclude the exponent is 3. The same pairing exists for `kimura-fixation-probability`,
`kimura-substitution-rate`, `fisher-ftns` and `maynardsmith-twofold-cost`. Keep the two statuses visibly
separate, as `content.js` already says ("a proof is not evidence").

**H. Bird content in the lean thread, for the holdout warden.**
`lean/nanopubs/unsigned/law-thompson1917-ch02-07.trig` — *"Ostrich and moa have passed the size at which
muscular flight is possible"* — is a machine-checked statement about Aves while Aves is the frozen
holdout. It is a formalization of Thompson's 1917 sentence, not a use of bird data, and the two bird items
the holdout thread retired are `darwin1859-ch01-10` (pigeons) and `thompson1917-ch15-01` (egg shape), not
this one. Flagging it for the warden to rule on rather than assuming it is fine. **No bird data was
fetched in this run**, and this record was deliberately left ungrounded for that reason.

---

## Literature grounding (the OpenResearch / A2 requirement)

**145 logged calls**, all in `calls.json` with time, exact command, result, hits and raw-file path.
Tool: `orx 0.2.23`, `--no-telemetry` on every call, query passed positionally.

| source | calls | note |
|---|---|---|
| `orx discover pubmed` | 127 | the workhorse |
| `orx discover openalex` | 3 | **all three refused: HTTP 429** |
| `orx discover biorxiv` | 2 | **both refused: 429** (biorxiv routes through OpenAlex) |
| `orx discover keyword` / `embedding` (alphaXiv) | 3 | used for the agent-swarm and Lean-formalization claims |
| Europe PMC REST (curl) | 10 | the logged fallback for OpenAlex; all HTTP 200 |

**`run_identifier` is `null` for every call.** `orx discover` prints a JSON array of hits and issues no
run or experiment identifier — the same finding `research/prior-art/SEARCHES.md` already records. None was
invented.

### Logged failures and corrections, not hidden

- **OpenAlex 429.** First attempt 21:55 UTC: `exit 1`, *"OpenAlex is rate-limiting requests (429 Too Many
  Requests); retry in 7178s"*. **Retried at 22:03:58 UTC** as the task asked: `exit 1`, *"retry in
  6962s"*. OpenAlex was never reached in this run; nothing was substituted for it from memory. Europe PMC
  carried the affected queries (plan ids `e01`–`e10`).
- **A zero-hit batch of 46 calls, kept in the log.** The first 46 queries (`g01`–`g46`) were written as
  6–12-term questions and all but five returned 0 hits. Cause: `orx discover pubmed` hands the string to
  NCBI E-utilities, which **ANDs every term**. Superseded by the short-query batch `h01`–`h50`. No citation
  in this index comes from a `g`-series call. Logged rather than deleted.
- **A false rate-limit flag.** `h40` and `m10` were flagged rate-limited by a loose substring test; the
  match was the page number `p429` inside an abstract. Both calls succeeded. Corrected in `calls.json`.
- **A self-correction that changed the numbers.** The first cross-check of "is this hit already cited by
  the draft?" compared PMIDs only. `orx`'s PubMed output carries **no DOI field**, and several threads —
  physics above all — cite only by DOI. That check wrongly reported cited works as uncited: Park & Choi
  (PMID 20833919) is cited by every physics draft as `doi:10.1242/jeb.046052`. All **669** distinct PMIDs
  returned in this run were therefore resolved to DOIs through Europe PMC (23 batched GETs, all HTTP 200,
  **651 of 669** resolved; 18 have no DOI there) and the cross-check was re-run on PMID **or** DOI. The
  corrected numbers are the ones reported here.
- **Privacy.** `NCBI_EMAIL` was removed from the environment passed to every `orx` call. No call carried an
  email, name, ORCID or account id. Every Europe PMC request was a plain `curl` GET with no `email=` or
  `tool=` parameter.
- **Holdout.** No query targeted bird data. The 9 holdout drafts and `law-thompson1917-ch02-07.trig` are
  indexed but deliberately **not** grounded. Bird titles that surfaced incidentally in flying-fish result
  sets (PMID 15875570, 35154643) were not opened as data and are not cited anywhere here.

### Per-draft verdicts

| verdict | drafts |
|---|---|
| **prior work found** (at least one logged query returned relevant published work) | **117** |
| **no prior work found** | **0** |
| not grounded — formal record (Lean law, proof scope, rubric): no empirical claim | 17 |
| not grounded — by holdout policy (Aves) | 10 |
| not grounded — record of a model's own elicited judgement | 5 |
| not grounded — no query assigned in this run | 7 |
| not grounded — record states no pass/fail criterion was pre-registered | 1 |

**Read "prior work found = 117, none found = 0" with care, and do not quote it as a novelty score.**
Every query that ran returned something topically adjacent, because a 3–5-term PubMed query on any of
these subjects does. What matters is whether the returned work is *on the specific claim*, and that was
hand-adjudicated only for the headline claims. The honest summary:

- **116 of the 117 queried drafts** have at least one returned work they do not cite. For **1**
  (`fin-size-bioelectric-leads.trig`) every returned work was already cited — the best-grounded record in
  the corpus.
- **Hand-adjudicated as directly on the claim and not cited:** the three ray-interray papers (finding 1),
  the two kcnk5b papers missing from the chain record (finding 3), the three refutation precedents
  (finding 4), the flying-fish robotic model and the two high-altitude-flight papers (finding 5), and for
  the brand-new `law-haldane-cost-of-selection.trig`, **four** works on Haldane's cost of selection
  including *"Sex solves Haldane's dilemma"* (PMID 31437405) and a 2026 historical reassessment
  (PMID 42572908) — a formalized "law" whose standing is actively disputed, cited by nothing in the draft.
- **Confirmed by prior work and correctly cited:** the `lat4a`/`kcnh2a` identity (PMID 34534441 /
  `10.1016/j.cub.2021.08.054`, *Modulation of bioelectric cues in the evolution of flying fishes*, cited by
  `daane-2021-fin-length-ratios` and `fin-size-bioelectric-leads`); the `kcnh2a`/longfin segmentation chain
  (all returned hits already cited); the flying-fish genome correction (PMID 34306036 cited); the
  wind-tunnel envelope (PMID 20833919 cited).
- **The two data gotchas asked about are safe.** For the Ubergraph typed-literal gotcha (`h21`, `e06`) and
  the Bgee/ZFIN Ensembl-release mismatch (`h19`, `h20`), the searches returned only the databases' own
  resource papers (Bgee 2024, ZFIN updates, Uberon) and unrelated ontology work. **No prior published
  report of either pitfall was found.** Both records are the kind of finding the standing order exists for,
  and they appear to be genuinely new contributions. They should cite the resource papers they are about
  (`10.1093/nar/gkae1118`, `10.1093/nar/gkaa793`, ZFIN PMID 39903545 / 36864549) — currently they cite
  none of them.
- **One unexpected find worth a citation:** PMID 23118437 / `10.1098/rspb.2012.2261`, *"A new
  stem-neopterygian fish from the Middle Triassic of China shows the earliest over-water gliding"* — prior
  work on the origin of over-water gliding in fishes, uncited by `daane-2021-fin-length-ratios.trig` and
  relevant to the whole flying-fish arc.

---

## How to redo this

```
# validate (157 runs; parses the transcript, does not trust the exit code)
python C:\Temp\npcurate\validate.py

# inventory
python C:\Temp\npcurate\inventory.py

# literature grounding (one plan file per round; raw output under C:\Temp\npcurate\raw)
python C:\Temp\npcurate\ground.py        # edit the plan file name at the top
python C:\Temp\npcurate\epmc.py          # Europe PMC fallback
python C:\Temp\npcurate\pmid2doi.py      # so "already cited" is checked on DOI too
python C:\Temp\npcurate\build_outputs.py # -> index.json, calls.json
python C:\Temp\npcurate\build_md.py      # -> catalogue.md
```

The corpus moved by 18 drafts during a 25-minute window. Re-run before quoting any count.
