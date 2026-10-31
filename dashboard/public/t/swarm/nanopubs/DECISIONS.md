# Decisions for the swarm thread's nanopub records

Agreed choices, per the `delphi` skill's rule that anything not settled is proposed and then recorded here.

## 2026-10-31. Delphi v2.0 terms, not the templates' legacy IRIs

**Decision (DELPHI hub, 2026-10-31, revised the same day):** new records use Delphi ontology v2.0 terms (`delphi:` =
`https://w3id.org/delphi/ontology/`) as the `delphi` skill requires. The drafts are not rewritten to `pk:`. They do
**not** declare `nt:wasCreatedFromTemplate` for the Project Delphi claim or evidence-item template, because that
triple asserts the record was created by filling that template, and these records cannot have been: the templates'
required statements need probknow-typed subjects. (The first version of this decision kept the declaration with a
caveat in pubinfo; the hub superseded that after the organism thread pointed out that a caveat beside a false
provenance statement explains it rather than fixing it.) Each record instead carries an `rdfs:comment` naming the
template that would otherwise apply, its `pk:` term count and the date checked. The provenance template
(`RAaYeFYF…`, 0 `pk:` uses) and the creator and licence pubinfo templates (`RAukAcWH…`, `RACJ58Gv…`, 0 each) are
clean and match the records' shape, so those declarations stay. The label/domain pubinfo template (`RAtKj9bC…`,
2 `pk:` uses, domain field on a probknow resource prefix) is dropped and named in the same comment.

**What was checked.** On 2026-10-31 both templates were fetched from w3id.org with `Accept: application/trig`
(copies under `evidence/`):

| template | nanopub | created | legacy `pk:` term uses | `delphi:` IRIs |
|---|---|---|---|---|
| Project Delphi claim | `https://w3id.org/np/RAI0QFH7bCNJIeKxwG3EbX5QKyoOjlaESiJkVZKs8iUc8` | 2026-10-23T13:08:44Z | 11 (`Claim`, `context`, `derivedFromPaper`, `hasAssessment`, `weightOfEvidence`) | 0 |
| Project Delphi evidence item | `https://w3id.org/np/RAG7UB06LpEpmDKX8VFoIbeTwyRg5m9vnadwKwTuahwes` | 2026-10-23T13:08:44Z | 13 (`EvidenceItem`, `derivedFromPaper`, `pValue`, `statisticalTest`, `vovkSellkeMaxPRatio`, `weightOfEvidence`) | 0 |

Both declare `@prefix pk: <https://w3id.org/probknow/ontology/>` and are signed by ORCID 0000-0002-1267-0234.
The `delphi` skill (knowledgepixels/project-delphi-nanopubs, commit 6c543f46, 2026-10-26, `skills/delphi/SKILL.md`
line 26) says: "The legacy `https://w3id.org/probknow/...` IRIs are never used in new records." The two sources
contradict each other for every claim and evidence record.

Counts measured here on 2026-10-31 (`pk:` term tokens in the served TriG; copies under `evidence/`): claim 11,
evidence item 13, provenance 0, pubinfo creator 0, pubinfo licence 0, pubinfo label/domain 2. The lean thread's
count for the claim template was 13; the difference is counting method (this one excludes the `@prefix` line and
counts `pk:Name` tokens), not substance.

**How it is applied.** Each affected record carries, in its publication info, an `rdfs:comment` naming the template
that would otherwise apply, its count, the date checked, and this file; no assertion-template declaration. The
contradiction itself is recorded as `delphisci-swarm-04` (claim plus evidence) so other teams find it. The hub is
telling the claims and lean threads the same decision. The same defect sits in records already live on the
production registry, published by the repo operator on 2026-10-30 before these threads started; whether to
supersede those is the key owner's call, not ours.

**Re-check before publishing:** resolve the governed heads (`dct:isVersionOf …/claimKind`, `…/evidenceKind`); a
later template version may have moved to `delphi:` terms, in which case the comments come out and conformance is
re-run.

## 2026-10-31. Validation reads the output, not the exit code

`nanopub-java check` (1.95.0) exits 0 whether or not the file is a nanopub. Reproduced here on 2026-10-31: a
garbage file prints `Summary: 1 errors;` and exits 0; a truncated record prints the same and exits 0; a record with
its head-to-provenance link deleted prints `Summary: 1 invalid nanopubs;` and exits 0; an empty file likewise. The
organism and lean threads found the same. So an exit-code gate proves nothing, and an unanchored text match is not
enough either (the organism thread's own method record quotes the string `Summary: 1 errors;` while documenting
this, and an unanchored match failed all its records on that quote).

**Decision:** validation goes through `check.mjs`, which runs the CLI one file at a time, ignores the exit code, and
passes a file only if its output has a line matching `^Valid (but not trusty): <uri>`, a line matching
`^Summary: 1 valid` with no `errors` component, no parser exception, and no issue beyond the four expected for an
unsigned draft (no signature, temporary graph URIs, creation time older than one hour, no assertion template).
`--selftest` first feeds four deliberately broken inputs and one good one and refuses to continue unless the broken
ones fail and the good one passes. Result on the nine drafts, with the self-test: 9 of 9 pass
(`check-report.json`). The earlier "np check valid on all" statements in this folder were read from the per-file
`Valid` lines, not from the exit code, so they happen to have been right; they are now backed by a check that would
have caught the alternative. Same class of problem as the stale templates: the tooling reports success in a way
that does not mean success. Belongs in the organism thread's method record.

## 2026-10-31. Attribution

`dct:creator` and `prov:wasAttributedTo` are the thread's agent identity
`https://w3id.org/delphi/resource/agent/delphisci-swarm-thread-claude-fable-5-1`. The human owner is a marked
placeholder (`sub:owner`, labelled as such) until the key owner approves; the operator ORCID used by this
repository's earlier drafts is not copied in, because consistency with past records is not consent for new ones
(hub, 2026-10-31). Set `NANOPUB_ORCID` and rebuild when approved.

## 2026-10-31. Concept record without a template

No Project Delphi template exists for a `delphi:Concept` (checked 2026-10-31 in the published assertion-template
list). The harness record `delphisci-swarm-05` is hand-authored with `delphi:Concept`, SKOS and schema.org terms and
carries no `nt:wasCreatedFromTemplate`; its publication info says so.

## 2026-10-31. Domain

`https://w3id.org/delphi/resource/domain/delphisci-swarm-methods` is minted for these records, following the
repository's per-project domain slugs. To be confirmed or replaced by the key owner.

## 2026-10-31. Pre-registration timing stated inside the records

The header of `swarm/PREREG.md` carries a wrong time (06:25 UTC). The correction (written 05:52:04Z before the
05:57:46Z first run; experiment-2 section 06:27:23Z before 06:28:12Z; from the session transcript) is stated inside
every claim's `skos:note`, every evidence item's `dct:description` and the provenance plan comment, not only in
`DEVIATIONS.md`, because a reader of a nanopub never sees `DEVIATIONS.md`. The pre-registration file is not edited.
