# Decisions for the holdout thread's nanopub records

The Delphi skill settles the namespace, the claim and evidence-item templates, external identifiers and the
publishing boundary, and asks that anything else be proposed and recorded. These are the choices made for
the records in this folder, all open to revision by the hub or Amit before anything is signed.

1. **A scripted held-out exam is a `delphi:Assessment`** with `delphi:assessmentType "held-out-clade-exam"`,
   `delphi:hasVerdict` in the words of `holdout/EXAM.md` (`supports`, `refutes`, `mixed`, `inconclusive`),
   linked to the claim with `delphi:hasAssessment` / `delphi:evaluatesHypothesis`. The two published
   assessment templates (LLM rubric scoring, Bayesian assessment) do not describe it, so no assessment
   template is linked; the evidence-item template is linked for the evidence item inside the record.
2. **One exam, one nanopub.** The assessment and its evidence item travel together, as the Thompson thread's
   assessment records do. The pre-registered organism-design hypothesis is its own nanopub
   (`delphi:TestableHypothesis`), because it existed before the exam and is cited by it.
3. **Numbers are structured** as `schema:PropertyValue` nodes with `schema:propertyID`, `schema:value` and
   `schema:description`, the shape the Delphi dataset builder uses for counts, so the Delphi lint can match
   them against the prose. Doubles (slopes, correlations, fractions) use the same shape with `xsd:double`.
4. **Files are `prov:Entity` nodes with SPDX SHA-256 checksums** (`spdx:checksum`, `spdx:checksumAlgorithm_sha256`),
   again the Delphi dataset shape. The frozen `exam.json` and `split.json` appear in every record that rests on
   them, with `prov:generatedAtTime` set to the freeze.
5. **The builders' pre-registered criteria are quoted verbatim** on a `prov:Plan` node (`prov:value`) rather
   than paraphrased in the description, so the lint's count check does not read the builder's thresholds
   as this record's sample sizes.
6. **Findings about the project's own files** (clade analysis, leak check, triage coverage) are `delphi:Claim`s
   whose `dct:description` opens with their status in plain words (`established by enumeration`,
   `observed at <time>`). They cite no `delphir:dataset/` because they have none; the exemption and its reason
   are in `manifest.json`.
7. **A burned exam item is an assessment of eligibility**, not of truth: `delphi:assessmentType
   "held-out-exam-eligibility"`, `delphi:hasVerdict "burned"`, with the disclosure quoted in provenance.
8. **Domain.** The two claim exams carry the claims' own domain
   (`delphir:domain/math-population-genetics-and-evolutionary-theory`); the method records carry a new slug
   `delphir:domain/held-out-clade-exam`, labelled with the slug as the Thompson thread did for its domain.
9. **Attribution, aligned with the team decision of 2026-10-31 (claim-tests/nanopubs/DECISIONS.md): no human
   ORCID in drafts.** `prov:wasAttributedTo` and `dct:creator` are the assessor agent
   `delphir:agent/delphisci-holdout-assessor-claude-fable-5-1` (a `prov:SoftwareAgent` that
   `delphi:usesModel` `delphir:model/claude-fable-5-1`), which built none of the work it examines; there is no
   `prov:actedOnBehalfOf`. The key holder's ORCID is added only when that person approves and signs
   (`--creator <ORCID IRI>` on the `--final` build). Each pubinfo says so.
9a. **Templates. The principle, adopted by the hub for all threads on 2026-10-31: declare a template if and
   only if the record genuinely instantiates it AND that template is clean (carries no legacy IRI).** Not
   "drop all declarations". Applied here: no `nt:wasCreatedFromTemplate`: the published Delphi
   assertion templates still carry the legacy probknow namespace and these records were not created from them.
   Declared, after fetching each on 2026-10-31 and finding no legacy IRI: the provenance template
   `RA7lSq6MuK_TIC6JMSHvLtee3lpLoZDOqLJCLXevnrPoU` ("Attributed to myself/others", which is exactly this
   provenance; the claims thread declares the ProbKnow extraction template `RAaYeFYF…` instead because its
   records derive from papers) and the ecosystem's Creator and License pubinfo templates. ProbKnow's Domain
   pubinfo template `RAtKj9bC…` carries 2 legacy IRIs and is not declared.
9b. **Status on evidence items** is a `schema:PropertyValue` with `propertyID "status"`, as the claims thread
   does, since `delphi:hasVerdict` has domain `delphi:Assessment`; the assessments keep `delphi:hasVerdict`.
10. **No record links an assertion template** (see 9a), so `np check -v` reports "no assertion template" on
    every file and nothing else beyond the unsigned state. Once 2.0 versions of the Delphi claim, evidence-item
    and hypothesis templates are published, the records that fit them can be rebuilt with the links; the exam
    and burned-item assessments would still need a template of their own ("held-out clade exam", "held-out exam
    eligibility"), which is a proposal for the hub, not something minted here.
11. **Drafts say so.** Until the key owner decides, labels start with `Draft:` and pubinfo carries an
    `rdfs:comment` stating the files are unsigned and unpublished. `--final` removes both for a signing run.
