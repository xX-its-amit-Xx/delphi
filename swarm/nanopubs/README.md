# Nanopub drafts for the swarm comparison

**Status: unsigned drafts. Nothing here is signed or published, to the test registry or anywhere else.** Each
file says so in its publication info. They become publications only when the key owner decides who signs and
under which identity, and asks for it. Decisions taken so far are in [`DECISIONS.md`](DECISIONS.md).

## What is here

Nine nanopubs built by `build.mjs` from `swarm/compare/results.json`, `results2.json` and the files under
`evidence/`; no number is typed in. One record per nanopub, Delphi ontology v2.0 terms.

| record | kind | claim or concept in one sentence | status |
|---|---|---|---|
| `delphisci-swarm-01-led-swarm-beats-single-agent` | claim + evidence | A centrally led swarm of LLM agents produced more verified-dataset test plans than one agent on the same 20 claims, with zero fabricated identifiers, in two pre-registered experiments (19 vs 13, then 18 vs 12). | supported (pre-registered rule met twice; replicate agrees) |
| `delphisci-swarm-02-single-agent-shortfall-is-mostly-blank-plans` | claim + evidence | Where the single agent fell short, it was mostly blank plans, not datasets that failed verification (8 of 8 in experiment 2; 3 blank and 4 named-but-unverified of 7 in experiment 1). | supported for experiment 2, mixed for experiment 1; post-hoc breakdown |
| `delphisci-swarm-03-led-swarm-advantage-is-spread-over-distinct-claims` | claim + evidence | The advantage is spread over 6 (experiment 1) and 7 (experiment 2) distinct claims the single agent missed, against 0 and 1 the other way. | supported; post-hoc breakdown |
| `delphisci-swarm-04-published-delphi-templates-use-legacy-probknow-iris` | claim + evidence | The published Project Delphi claim and evidence-item templates (2026-10-23) use legacy probknow IRIs, against the delphi skill's rule, so records written to the skill fail template conformance. | supported (direct observation); method gotcha |
| `delphisci-swarm-05-concept-four-arm-agent-comparison-harness` | concept | The four-arm comparison harness (pre-registered task, mechanical verifier, hard cost cap) as a reusable method, pointing at the code. | method, not a finding |

Every claim record carries: the sentence (`rdfs:label`), a longer statement with the numbers (`dct:description`),
the conditions (`delphi:context`), its status and the pre-registration timing (`skos:note`), and what it does not
establish (`skos:scopeNote`), including that the arms are LLM agents with a context limit, that a sister project's
enzyme benchmark with deterministic members found no collective advantage, and that `DEVIATIONS.md` records where
this thread's own prediction was wrong. Every evidence record names the run directories and result files, states
the decision rule (`delphi:statisticalTest`: a pre-registered rule, not an inferential test), and carries each
computed number as a `schema:QuantitativeValue` with the live file it comes from (`dct:source`).

Attribution: `dct:creator` and `prov:wasAttributedTo` are the thread's agent identity; the human owner is a marked
placeholder until the key owner approves (see `DECISIONS.md`).

## Pre-registration timing

`swarm/PREREG.md` was written at **2026-10-31T05:52:04Z** (session transcript, tool-call timestamp), before the first
primary run started at 05:57:46Z. Its header says "06:25 UTC"; that is a typo, disclosed in
`swarm/compare/DEVIATIONS.md` and stated inside every record. The file was not edited because the pre-registration
says it is not changed after the runs start. The experiment-2 section was appended at 06:27:23Z, before the first
experiment-2 run at 06:28:12Z. **No git commit of the file exists yet** because the hub holds all commits until Amit
approves a branch; the commit hash goes into the records before signing.

## Method note: the published Delphi templates contradict the delphi skill

Anyone writing Project Delphi records this weekend will hit this. The served templates

- `https://w3id.org/np/RAI0QFH7bCNJIeKxwG3EbX5QKyoOjlaESiJkVZKs8iUc8` (Project Delphi claim, 2026-10-23) and
- `https://w3id.org/np/RAG7UB06LpEpmDKX8VFoIbeTwyRg5m9vnadwKwTuahwes` (Project Delphi evidence item, 2026-10-23)

declare `@prefix pk: <https://w3id.org/probknow/ontology/>` and state every statement with `pk:` terms (11 and 13
uses, zero `delphi:` IRIs; copies under `evidence/`). The governing `delphi` skill
(`knowledgepixels/project-delphi-nanopubs`, `skills/delphi/SKILL.md`, commit 6c543f46) says terms come from Delphi
ontology v2.0 (`delphi:`) and "the legacy `https://w3id.org/probknow/...` IRIs are never used in new records." So a
record that follows the skill fails `check-nanopub-conformance.py` against the template it must reference
("unmatched" for every `delphi:` triple, "required statement st01 not instantiated"), and a record that passes the
checker breaks the skill. Worse, `nt:wasCreatedFromTemplate` asserts that the record was made by filling that
template, which a `delphi:` record cannot have been, so declaring it is a false provenance statement, not a mere
non-conformance. This repository follows the skill (decision 2026-10-31, `DECISIONS.md`), declares no assertion
template, names the would-be template and its `pk:` count in each record's pubinfo, keeps only the clean provenance
and creator/licence pubinfo templates (0 `pk:` uses each), and records the contradiction itself as `delphisci-swarm-04`. The
templates are signed by ORCID 0000-0002-1267-0234 (Knowledge Pixels); the fix belongs upstream, either a template
version on `delphi:` terms or a skill that allows the legacy IRIs.

## Checks run

- `node swarm/nanopubs/check.mjs --selftest` wraps `nanopub-java check` (1.95.0) because the CLI exits 0 even on
  unparsable input (see `DECISIONS.md`). It runs one file per call, ignores the exit code, requires an anchored
  `^Valid (but not trusty): <uri>` line and `^Summary: 1 valid` with no `errors`, allows only the four issues
  expected of an unsigned draft, and first proves on four broken inputs that it can fail. Result: 9 of 9 pass;
  details in `check-report.json`.
- Template conformance (`check-nanopub-conformance.py` from the nanopub skill): the records declare no assertion
  template, so there is nothing for it to check against; run against the would-be templates it reports every
  `delphi:` triple as unmatched, for the reason above.

## Before anyone signs

See `blockers_before_signing` in `manifest.json`: signer identity and human owner, PREREG and code commit hashes,
the minted domain slug `delphisci-swarm-methods`, a re-check for newer template versions, and removing the UNSIGNED
DRAFT comment. Then follow `BEST_PRACTICES.md` section 3: sign, `np check` the signed files, publish to the **test**
registry only, record the trusty URIs in `manifest.json`. Production needs the key owner's explicit approval per
publication.

## Rebuild

```bash
node swarm/nanopubs/build.mjs
node swarm/nanopubs/check.mjs --selftest     # needs java and nanopub-java (--jar <path> or NANOPUB_JAR)
```
