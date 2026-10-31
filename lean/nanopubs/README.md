# Nanopublication records for the Lean thread

Unsigned drafts only. Nothing in this directory is signed or published. An unsigned draft is not a
publication (AGENTS.md). Signing uses the operator's key, which this thread does not hold; the test
registry comes first, and production needs the ORCID key owner's explicit approval every time.

## Records (one per nanopub, Delphi ontology v2.0)

| File | Record | Kind of statement |
|---|---|---|
| `unsigned/law-<claim_id>.trig` | The machine-checked law as a `delphi:Concept` (`delphir:math-law/<claim_id>`) under the formal-verification convention: `skos:notation`, the Lean statement as `skos:definition ^^delphi:lean4`, `delphi:leanDeclaration`, `delphi:leanTheorem` (every name taken from the `#print axioms` audit), `delphi:leanVerified true`, links to the module and the build report. The published claim gets `dct:conformsTo <law>` and `delphi:hasEvidence` to a `delphi:EvidenceItem` holding the build receipt (Lean and Mathlib versions, exit code, sorry count, axioms) and the rejected mutants. | Model assertion + build evidence |
| `unsigned/scope-<claim_id>.trig` | Proof scope: `skos:scopeNote` statements on the law, each prefixed `Kernel-checked:` or `Assumed, not proved:`, copied from `proofScope` in `lean.json`. | Assumptions kept apart from derived claims |
| `unsigned/bound-exocoetidae-substitution-budget.trig` | The flying-fish substitution budget as a `delphi:Hypothesis` (no source states it): plain claim with the numbers, `delphi:context` naming every parameter source, `prov:used` the three law records and the PBDB dataset record, `prov:wasDerivedFrom` the literature DOIs, `skos:scopeNote` kernel-checked vs assumed, verdict `inconclusive` in `rdfs:comment`, `skos:related` the organism thread's blueprint claim (a citation, not support), and an evidence item with the computation. Built from `lean.json`'s `bound` block and `lean/bound/links.json`. | Derived bound, with its undefined denominator stated |
| `unsigned/certificate-blueprint-<name>.trig` | One per certified blueprint: a `delphi:Hypothesis` ("the emitted structure is well-formed under its own rules") with the kernel-checked certificate as its `delphi:EvidenceItem` (theorem names, axioms, blueprint and taxon-data hashes, Ubergraph queries, rejected mutants), `prov:used` the well-formedness law record, `skos:related` the organism thread's own blueprint claim as a citation only. Built from `lean.json`'s `blueprintCertificates` block. | Structural certificate, biology explicitly excluded |
| `unsigned/rubric-lean-faithfulness-0.1.0.trig` | The faithfulness rubric as a `delphi:Concept` with four dimensions (`skos:narrower`), text from `lean/assessment/prompt.md`. | Rubric |
| `unsigned/assessment-<claim_id>--<provider>.trig` | One blind assessment: `delphi:LLMClaimAssessment` with `delphi:hasVerdict` exactly as the assessor returned it (`faithful-with-narrower-scope` stays literal), one sub-assessment per dimension with `delphi:hasScore`, the assessor as a `prov:SoftwareAgent` that `delphi:usesModel` a named `delphi:LanguageModel`, the prompt file as the plan. Carries an `rdfs:comment` saying how many providers have run. | Assessor opinion about a translation |

Every record carries, in words, what it does not establish: the theorem is conditional on the stated
assumptions and proves nothing about organisms; kernel-checked is not expert-validated; and the
faithfulness verdicts come from one assessor provider so far.

## Build and check

```
node lean/report.mjs                  # lean.json from the compiler (build + #print axioms)
node lean/mutate.mjs                  # lean/mutations.json: every mutant must be rejected
node lean/nanopubs/build.mjs          # drafts; add --commit <hash> once lean/ is committed
node lean/nanopubs/check.mjs          # strict TriG parse + nanopub-java check -v -> check.json
npx tsx lint.ts lean/nanopubs/unsigned --extracted      # from project-delphi-ontology/pipeline
```

`check.mjs` never trusts nanopub-java's exit code: `check` returns 0 even when a file fails to parse
(observed on 1.95.0: an RDFParseException prints `Summary: 1 errors;` and exits 0; the claims thread
found this first). Anchoring matches to line starts is not enough either: `check -v` prints a record's descriptions
and comments on their own lines at column 0 under `DESCRIPTION:`, so a record that quotes
`RDF ERROR:` or `Summary: 1 errors;` in a description is indistinguishable from the tool's own
lines by any pattern over the whole transcript (Organism found this with a fixture; labels are safe
only because they are printed behind a `LABEL: ` prefix). So the checker reads the verdict only from
the header region of the file's block, the lines after `Reading file:` and before the first section
marker (`LABEL`, `TYPES`, `DESCRIPTION`, `AUTHORS`, `AUTHOR LIST`, `CREATORS`, `ISSUES`, `URI`,
`SIGNER`, `PUBKEY`, `SUPERSEDES`), and reads issues only between `ISSUES:` and the next marker.
Record content cannot reach either region. A file passes only if its header has a `Valid (but not
trusty):` or `Valid and trusty:` line and no `RDF ERROR:` line, and the n3 parser accepts it.

The issues section is taken from the **last** `ISSUES:` marker, not the first: a literal may contain
newlines, so a description can carry a forged `ISSUES:` line followed by `- ` entries, all printed at
column 0 before the validator's real section. Probed on a real record: the forged section produced a
second marker at column 0, and a first-marker reader tallied the two planted entries and skipped the
seven genuine ones, which is the dangerous direction (a genuine unexpected issue vanishes). Taking
the last marker is sound because record content is printed only under `LABEL` and `DESCRIPTION`,
which precede the validator's own sections (Organism, via the holdout thread's fixture shape).

Before reporting, the script runs three fixtures built from a real record and refuses to report
anything unless all behave: a 1500-byte truncated copy must be rejected by both checks; a copy
whose `dct:description` quotes both error strings with `Summary: 1 errors;` on a line of its own
(verified to print at column 0) must be judged valid; and a copy whose description carries a forged
`ISSUES:` section with two `- fake` entries must be judged valid with exactly the genuine issues
tallied and nothing matching `fake`. All three results are recorded in `check.json`.
`report.mjs` folds `check.json` into `lean.json`, so the sub-dashboard shows per-file check results.

Identifiers are readable (`delphir:math-law/<claim_id>`, `delphir:assessment/lean-faithfulness--<claim_id>--<provider>`)
rather than artifact codes, on purpose: they can be checked against the repository by eye before
signing. The published rubric-assessment template fixes its subject to `assessment/~~ARTIFACTCODE~~`,
so those records would not conform to it even after that template is republished; the law and scope
records follow the formal-verification convention, which has no template.

`build.mjs` refuses to run if `lean.json` reports a failed build, a sorry, or a non-standard axiom,
or if any mutant was accepted.

## Attribution: no human is named until the key owner says so

The drafts name no person. The assertion and `dct:creator` are attributed to the bot agent that built
the record (`delphir:agent/delphisci-lean-thread-builder`, running `claude-fable-5-1`), which is
accurate; the assessment records are attributed to the assessor agent running the named OpenAI model.
`prov:actedOnBehalfOf` is omitted, and each pubinfo carries a comment saying the owner is not yet set.
Consistency with earlier records signed by a particular ORCID is not that person's consent to new ones,
least of all to an assessment of work they did not commission.

The owner enters in exactly one place, at signing time: `node lean/nanopubs/build.mjs --owner
https://orcid.org/XXXX-XXXX-XXXX-XXXX` populates `prov:actedOnBehalfOf` on both agents and records
`ownerSet: true` in `manifest.json`. The intended signer is a bot identity with its own key pair and
its own introduction nanopub, owner linked by ORCID (nanopub skill): that gives a retract path that
does not need the human's key. Creating that identity is itself a publishing act with an owner
attached, so it waits for the same approval. Use nanopub-java 1.92.0 or later so the signer sub-IRI
resolves, and never delete the key files.

## Why the mutants change the statement, not the proof

Most "formally verified" claims are tested, if at all, by breaking the proof: delete a tactic, watch
the build fail. That shows the proof script is load-bearing, nothing more. The thirteen mutants in
`lean/mutate.mjs` instead change the **statement** of the headline theorem (k = 2μ, 1/(M+1), i/(M+1),
3× odds, no division by mean fitness, fixation ≥ (i+1)/M, budget ≥ 2μT, cube-law exponent 2, closure level inequality flipped) or sabotage the certified data (an upward edge through the body root; a never_in_taxon row for Vertebrata) or delete a hypothesis of the model (the chain's escape
condition; the favored chain's non-decreasing drift). If the proof still went through, the theorem would be about the names, not the law:
either the conclusion would follow from the definitions regardless of the constant, or the deleted
hypothesis was never used. Each mutant was rejected with a concrete unsolved goal or type mismatch
at the line of the changed statement, and the unmodified modules passed through the same command.
That is what the evidence item in each law record carries, and it is the part a reader who has seen
many formalisation claims should look at first.

Checks on 2026-10-31 (latest run): 16 drafts parse as TriG; `np check` reports each as valid (not trusty, as
expected for unsigned drafts; the law and scope records have no assertion template because the
formal-verification convention has none); the Delphi lint reports 0 findings; a dry run that sealed
all 13 of the first set with a throwaway key in scratch space produced 13 trusty nanopubs with valid signatures. The
dry-run outputs were not kept.

## Holds

- `commitPinned: false` in `manifest.json` until the hub commits `lean/` and the drafts are rebuilt
  with `--commit <hash>`. Repository links until then point at the branch, not a commit.
- Assessment records are held as drafts while only one assessor provider (OpenAI) has run. The
  project requires two providers, none the builder's, before a verdict travels with a nanopub.
  `manifest.json` records `claimsWithTwoProviders` and marks each assessment record `hold`.
