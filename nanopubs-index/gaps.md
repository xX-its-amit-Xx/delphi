# Gaps

Two lists. **A**: things the dashboard claims that no nanopublication draft records. **B**: drafts that
carry no external source. Snapshot 2026-10-31 22:15 UTC, against `dashboard/public/data.json`
(`built` field) and the 157 drafts in `index.json`.

The standing order in `AGENTS.md` is that *every* micro-discovery becomes a record — "a test result, a
refutation, a measured null, a methodological gotcha, a documented refusal". Each row in list A is
something another team could cite, or be misled by, that currently exists only as dashboard prose.

---

## A. Dashboard claims with no draft

### A1. Two whole threads have zero records

The dashboard shows nine threads. Seven have nanopub folders. **Two do not**, and both have stated
findings on the dashboard right now:

| thread | what the dashboard claims | records |
|---|---|---|
| **MCP testing and proof-checking simulation** | "The hosted MCP server matched origin/main on all 100 test calls and passed 93 of them, and seeded simulations agreed with all three Lean results tested (neutral fixation i/M, fixation at least i/M for s ≥ 0, twofold cost of sex). **On Windows, the local MCP server and CLI fail on every TriG query.**" | **none** |
| **Visualisations** | The Design Studio checks each edit with the Lean thread's `browser-check.mjs`; "the C9 stand-in is gone"; rows show holds / violated / cannot-evaluate with the missing input named; the reference is Park & Choi's L3 specimen (SL 0.203 m, 0.06 kg), so the measured fish holds C9 at 10 m/s | **none** |

Highest priority in this file: **the Windows TriG failure is a methodological gotcha of exactly the kind
the standing order names**, and it is the one finding here that another team will rediscover by losing an
afternoon. The 93-of-100 MCP agreement is a measured comparison with a denominator — a publishable
evidence item as it stands. (`memory` records that the viz thread never commits, so its absence is
expected; the finding is still unrecorded.)

### A2. The sim-engine pre-registered test that FAILED

The dashboard's organism-design thread leads with this:

> "Its first pre-registered test FAILED and that is the result worth reporting: a single-morphogen
> threshold model predicts the **WRONG AXIS** for the hhip fin phenotype. Measured is dorsoventral +50
> percent with anteroposterior unchanged; the model puts all its growth on the anteroposterior axis,
> because a ZPA drawn as a posterior strip spanning the bud height leaves no room to grow dorsoventrally.
> Nothing was tuned afterwards."

**No draft records it.** `grep -ril 'sim-engine|single-morphogen|wrong axis'` over all 157 drafts returns
nothing. This is a refuted pre-registered test with a pre-registration, a measured comparison, a named
mechanism for the failure and an explicit "nothing was tuned afterwards" — five of five items the standing
order asks for, already written, in prose, on a web page. It is also the most interesting negative result
the project has, because it is a model failing in a *diagnosable* way. **Write it.**

### A3. Genotype headline numbers with no record

The genotype thread's dashboard headline states four quantities that no draft carries:

| claim | nearest draft | status |
|---|---|---|
| "The best single lever to a bigger fin, **hhip loss of function at +65% area**, enlarges the pectoral fin by disorganising the rest of…" | `finding-convergent-site-panel-is-not-a-dose-response.trig` mentions hhip in passing | **no record of the hhip result itself** — and it is the thread's own headline answer to "what makes a bigger fin" |
| "Of **92** experimentally shown interventions on fin and body shape, only **12** carry a true effect magnitude together with the stage it was measured at, and pectoral fin **LENGTH has no calibrated route at all**" | none | **no record.** This is a measured null about the project's own evidence base and bears directly on every fin-size claim |
| "Of **42** gene-to-phenotype chains, **29** have a weakest link of necessity or better and **38** hold at least one mechanism-grade link" | the 3 `chain-*` drafts record 3 of the 42 | **39 of 42 chains unrecorded**; the aggregate has no record |
| "An annotated flying-fish genome exists (**23,611** predicted genes)" | `correction-flying-fish-genome-exists.trig` | **covered** (written during this session) |

### A4. Lean results with no record

24 `law-` drafts exactly match the dashboard's `claimsVerified: 8` + `extensionsVerified: 16`. Good. But
four other Lean numbers on the dashboard have no draft:

| claim | records |
|---|---|
| **13 kernel-checked eliminations** of 18 candidates checked (`candidatesEliminated: 13`, `kernelCheckedEliminations: 13`) — the machinery behind the flying-fish elimination | none of their own. C14 is *mentioned* inside two physics drafts (`finding-sim-v3-drag-not-power`, `hypothesis-tff-v2-codesign-map`), but the 13 eliminations are not a record |
| **the flying-fish audit**: 152 theorems against the design, 35 holds / 14 **violated** / 103 cannot-evaluate | none. "14 violated" is a finding about the project's own design and nothing records it |
| **44 open-problem candidates checked**, 2 eliminated, 19 consistent, 23 cannot-rule, 13 not formalised | none |
| **mutation testing of the Lean statements**: "26 of 26 statement or data mutants rejected, 11/11 controls" | none. This is the evidence that the Lean statements are not vacuous — the single most load-bearing piece of validation the lean thread has, and it is unrecorded |

**Also a rule gap, not a record gap:** the four `assessment-*--openai.trig` faithfulness assessments all
carry `delphi:usesModel …/gpt-5-2025-08-07` and the dashboard confirms `assessorProviders: ["openai"]`.
`AGENTS.md` requires **at least two assessor providers**. The thread's own dashboard entry says the A9
package is "ready for 7 headline tests (needs the OpenAI key; issue #40)", so this is known and in flight
— recorded here so it is not forgotten at signing.

### A5. Two of sixteen claim tests have no evidence record

`dashboard/public/data.json` carries 16 tests and `claim-tests/` holds 16 `result.json` files. 15 drafts
exist, covering 14 distinct tests (`darwin1859-ch09-03` is correctly split into `--numeric` and
`--qualitative`). The two with no record:

| test | reason, as the thread records it |
|---|---|
| `math-bio-theorems/hamilton-lmc` | **Dryad blocks scripted downloads** — declared in `SKIPPED` in `claim-tests/nanopubs/build.py` and in that thread's README |
| `math-bio-theorems/maynardsmith-war-of-attrition` | same |

These are **honestly declared**, not hidden, and `AGENTS.md` A4 says a blocked test is "honest and
reusable". But the standing order counts a documented refusal as a micro-discovery, and the genotype
thread published exactly such a record for its own Bgee 403 (`refusal-bgee-sparql.trig`). Two
`refusal-dryad-*` records would close this and would make the blocked state citable instead of a footnote.

### A6. Counting mismatches a reader will trip on

- **The swarm thread's dashboard entry says "Three findings drafted as Project Delphi nanopubs"**;
  `swarm/nanopubs/unsigned/` holds **five** claims (+4 evidence companions = 9 files). The entry
  undercounts its own records — `swarm-04` (legacy probknow templates) and `swarm-05` (the harness
  concept) are not in the three.
- **`stats.byStatus` on the dashboard reads `refuted: 2`** across 880 claims; this index counts **10**
  drafts with status `refuted`. Different objects — the dashboard figure is the status field in
  `docs/claims.json`, the index figure is finding records — but the two numbers sit on the same site.
- **The organism-design entry says "ten blueprints, 35 unsigned records"**, which matches the files. See
  `README.md` finding 2: two of the ten blueprints are byte-identical in content and a third differs by 8
  terms, so ten files are not ten results.

---

## B. Drafts with no external source

**15 of 157.** "No external source" means: no PMID, no DOI, no database accession, and no external URL
other than this repo's own GitHub blobs and the project's own dashboard. A record that cites only the repo
that produced it cannot be checked by anyone outside the repo.

### B1. The fourteen `organism-design` records (14 of 15)

| drafts | what they cite instead |
|---|---|
| all 10 `claim-blueprint-*.trig` | the claim records cite no identifier at all; the UBERON and CL term IRIs live only in the paired `evidence-blueprint-*` records, and the Ubergraph endpoint is named in prose ("Retrieved from Ubergraph on 2026-10-31T15:42:53.199Z; the cache pins the bytes") but **never as a resolvable URL or a DOI** |
| `claim-aves-blind-predictions.trig` | the frozen roster, by checksum, in this repo |
| `assessment-aves-holdout-scoring.trig` | the holdout thread's own files |
| `claim-cytochrome-c-predicted-divergence.trig` | UniProt accessions appear in the paired evidence record; the claim record carries none |
| `claim-delphi-v2-template-declarations-are-false.trig` | the template IRIs are in the evidence record; the claim record cites nothing external |

This is mostly a **claim/evidence split**, not fabrication: the identifiers are in the evidence partner
and the evidence partner is linked with `delphi:hasEvidence`. A reader who opens one record in isolation,
which is what a nanopub is for, sees an unsourced assertion. Two fixes, either is enough: put the
Ubergraph query endpoint and the Uberon/CL release IRIs on the claim record too, or state in the claim
record that every identifier is in the named evidence record.

**What is genuinely missing from all 20 blueprint records, though:** the **Uberon and Cell Ontology
release versions**. Every blueprint is a statement about what two ontologies record on a given date. The
records pin a retrieval timestamp and a cache checksum but never the ontology releases, so the claims
cannot be reproduced against a specific Uberon or CL version. Add the release IRIs.

### B2. `genotype/nanopubs/unsigned/gap-no-ray-to-interray-signalling.trig` (1 of 15)

A measured null with **no external source** — which is partly inherent to a null, and partly the problem.
The record names "Jiang 2024" and "Lanni 2019, title only" in prose without attaching either identifier.
See `README.md` finding 1: that second paper is **PMID 29441573 / `10.1111/joa.12785`**, it is already
cited elsewhere in the same thread, and its abstract names a receptor (Fgfr1) and a ligand pathway (Shh)
in ray-dependent inter-ray regulation. **A null record must carry the identifiers of what it searched and
what it found**, or it cannot be audited — which is the whole reason this one survived until a literature
check.

### B3. Near-misses, for completeness

These do carry an external source but are thin enough to flag:

- `physics/nanopubs/unsigned/finding-fishbase-length-weight-coverage.trig` — **no PMID or DOI**; the claim
  is about FishBase as served on 2026-10-31 and cites FishBase URLs only. Defensible (it is a statement
  about a database's contents) but FishBase has a citable DOI and should carry it.
- `gotcha-ubergraph-typed-literals.trig`, `gotcha-bgee-zfin-ensembl-release-mismatch.trig`,
  `gotcha-clean-phenotype-file-includes-treatments.trig` — each cites the endpoint or file it is about but
  **none cites the resource paper of the database it is reporting on**. The literature check turned up
  those papers (`10.1093/nar/gkae1118` Bgee 2024, `10.1093/nar/gkaa793` the Bgee suite, ZFIN
  PMID 39903545 and 36864549). Adding them costs nothing and makes each gotcha locatable by anyone
  searching the database's own literature — which is exactly how another team would hit the same wall.

### B4. One corpus-wide omission

**No record in any of the 157 carries a machine-readable ontology version.** `delphi:` resolves to
`https://w3id.org/delphi/ontology/` in all 157, and 93 state "ontology v2.0" in prose, but there is no
`owl:versionInfo`, `dct:hasVersion` or equivalent predicate anywhere in the corpus. The namespace is the
operative fact and the records are consistent, so nothing is wrong — but a consumer cannot filter by
ontology version without parsing English. Add the predicate before signing, while the records are still
mutable.
