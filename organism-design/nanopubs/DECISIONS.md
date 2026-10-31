# Nanopub decisions for the organism thread

The delphi skill asks that agreed choices be recorded here and followed afterwards. These are the
choices this thread made, with the reason, so the key owner can audit them before anything is signed.

## Boundary

- **Nothing here is signed and nothing is published.** There is no key on this machine
  (`~/.nanopub` does not exist), and no key was created. Signing and any registry, including the
  test registry, need the ORCID key owner's decision.
- **No human is named anywhere in these drafts.** There is no ORCID IRI in any of the 33 records:
  creation is attributed to the software agent that built the record, `prov:actedOnBehalfOf` is
  omitted, and each record's publication info says the owner is unset. The key owner passes
  `--owner <orcid IRI>` at signing time and that single value populates both. Consistency with the
  older record sets in this repository, which do name an ORCID, is not consent to name that person
  again.
- Order if the key owner approves: test registry first, inspect, only then consider production.
  Production records are immutable, so a mistake there costs a supersede that stays on the network.

## Terms

- Project Delphi ontology **v2.0** only (`https://w3id.org/delphi/ontology/`), individuals under
  `https://w3id.org/delphi/resource/`. No legacy `probknow` IRIs. Deprecated terms
  (`delphi:Paper`, `delphi:Model`, `delphi:assessedBy`, `delphi:derivedFromPaper`) are not used.
- **A blueprint is a proposal, not an observation.** v2.0 has no Proposal class, and the skill says
  to propose rather than invent a term, so each blueprint is a `delphi:Claim` carrying
  `delphi:hypothesisType "ontology-derived design proposal"`, and its description and
  `rdfs:comment` say in words that nothing was observed or measured. If the ontology later gains a
  proposal class these records should be superseded with it.
- **One record per nanopub**, and every evidence item is its own nanopub, which the publishing
  guide asks for: claims point at the evidence item's IRI with `delphi:hasEvidence`.
- **Statement kinds stay in separate records.** The three predicted structures are model outputs;
  the pairwise comparison over them is a derived claim; the endpoint's refusal is a method
  observation; the holdout thread's scoring is a `delphi:Assessment` attributed to that thread's
  script, not to this one. A blueprint proposal never shares a record with any of them.
- **ESMFold** is named through `delphi:usesModel` as a `delphi:LanguageModel` labelled "a protein
  language model with a structure head". That is the closest honest fit in v2.0; the version string
  is the one the service reports in each prediction's PDB TITLE record.
- Every number carries where it was read from: the file, its SHA-256, and for pLDDT the column and
  scale. External identifiers (UniProt, Uberon, Cell Ontology, NCBI Taxon) are used unchanged.

## Structure

- Records are built with the upstream pipeline's `buildEntityNanopub`
  (`project-delphi-ontology/pipeline/probknow-builders.ts`), so the triples and the pubinfo are the
  upstream's own, not this thread's invention. The one departure is the template statement, which a
  check showed to be false and which is therefore dropped; see "Checks that ran".
- The TriG serialiser in `build.mjs` reimplements `pipeline/seal.ts`'s `triplesToTrig` because
  `seal.ts` imports `@nanopub/nanopub-js` and `n3`, which are not installed here. Signing will need
  those, and the key owner's environment is where that belongs.

## Checks that ran

Three checks, all reproducible.

**`node organism-design/nanopubs/check.mjs`: 33 of 33 valid (not trusty), check passed.** The
issues listed are the ones every unsigned record on the temp base lists, and they clear on signing:
no signature element, the four `http://purl.org/nanopub/temp/np1/...` graph URIs, and no declared
template.

The script exists because **nanopub-java's `check` exits 0 even when a file fails to parse**. The
claim-tests thread found this, the lean thread reproduced it, and it was reproduced here a third
time: a file of garbage and a truncated copy of a real record each print `RDF ERROR` and
`Summary: 1 errors;`, and each exits 0. So no validity statement in this folder rests on an exit
code. `check.mjs` reads the output instead, requires one `Valid (but not trusty)` line per file,
rejects any unexpected issue, and runs a negative self-test first: a truncated record must be
judged failing, or the script refuses to report on the real ones.

The self-tests earned their place twice, and the second time changed the design.

First, an unanchored match: the first run failed all 33 records because the method record quotes
`Summary: 1 errors;` while documenting this very defect, and the verbose output prints record
descriptions. Anchoring the matches to the start of a line fixed that run.

Then a positive fixture, a copy of a real record carrying a comment that quotes both `RDF ERROR:`
and an error summary, showed that **anchoring is not enough either**. The verbose output prints a
record's description starting at column 0, so quoted text lands at the start of a line and is
indistinguishable from the tool's own error lines by any regular expression over the whole
transcript. The fixture failed, correctly.

So the checker no longer searches the transcript. It splits it into one block per file at the
`Reading file:` lines, reads each block's verdict only from the lines before that block's first
section marker, which is where the tool speaks and record content cannot reach, and reads issues
only after the `ISSUES:` marker. A file that fails to parse produces no usable block, so a count
mismatch is itself a failure.

A third fixture, whose shape came from the holdout thread, then found a hole in that design. A
description can contain a whole forged issues section, because a literal may carry newlines: a
line reading `ISSUES:` followed by lines starting with `- `, all printed at column 0, before the
validator prints the real section. The first version took the first `ISSUES:` marker, so it would
have tallied the planted list and stopped before the genuine one. The failure direction matters:
a planted list that happens to match the allowlist would hide real issues silently. The reader now
takes the **last** marker in each block, which is sound because record content is printed in the
description, always before the validator's own sections.

Three fixtures now run before any real record is reported on, and all three pass: a truncated
record is rejected, a record quoting the error strings is accepted, and a record carrying a planted
issues section is accepted with a tally identical to the same record unbaited. That last assertion
is set equality against the clean record rather than a search for the word "fake", because the
case that hides a real issue is a planted line copying a genuine one, and only equality rules that
out. The holdout thread, whose bait shape found the hole, asserts the same equality.

One trap for anyone rebuilding these fixtures, hit here and independently by the lean thread: the
planted newlines must be the two-character escape inside the TriG literal. A real newline in a
quoted literal makes the file unparseable, so the transcript has no sections at all, and a careless
probe then reports no column-0 markers and concludes the bait does not bite. The first attempt here
failed exactly that way.

**`check-nanopub-conformance.py` (nanopub-skill) against the templates the pipeline maps.** This
changed the records. The pipeline's `TEMPLATES` map sends every Delphi v2.0 class to the published
ProbKnow template for that class, and those templates fix legacy `pk:` types on
`probknow:resource/<kind>/~~ARTIFACTCODE~~` subjects. A record built from v2.0 terms, as the skill
requires, cannot instantiate them: the checker reported every assertion triple unmatched and the
required `st01` missing, for the claim template and the evidence-item template alike. So
`nt:wasCreatedFromTemplate` would have been a false statement in the publication info of every
record. These records drop it and say in publication info why it is absent, and the checker now
reports `NO nt:wasCreatedFromTemplate DECLARED`, which is accurate.

**Namespace counts, published templates against the ontology source, 2026-10-31.** Occurrences
counted with `grep -o`, published copies fetched as `https://w3id.org/np/<id>.trig`, source read at
commit `6ba5f9a97a4511c909f5dfd755c7993dd68989f3`:

| template | published: probknow / delphi | source file | source: probknow / delphi |
|---|---|---|---|
| claim `RApE-nGp…`, declared by published records | 13 / 0 | `nanopubs/src/04-…-claim.trig` | 0 / 14 |
| claim `RAI0QFH7…`, "Project Delphi claim", 2026-10-23 | 13 / 0 | no source file identified | – |
| evidence item `RAk4kcX…` | 10 / 0 | `src/05-…-evidence-item.trig` | 0 / 11 |
| provenance `RAaYeFYF…` | 0 / 0 | `src/02-…-provenance-…trig` | 0 / 2 |
| pubinfo domain `RAtKj9b…` | 2 / 0 | `src/03-…-domain.trig` | 3 / 0 |
| rubric assessment `RAOAK6Fe…` | 19 / 0 | `src/18-…-rubric-assessment.trig` | 0 / 21 |
| rubric `RAbjeus1…` | 10 / 0 | `src/19-…-rubric.trig` | 11 / 0 |

There are two claim templates in play and both are legacy on the network: published records
declare the first, while the current template listing shows the second. The hub thread supplied the
second IRI; both were fetched and counted here.

**The defect is live on the public network, not only in drafts.** The published record
`https://w3id.org/np/RAtLFqIIyu4r-GlMcBEfmDtbV-CHwWxQ49gVMtHIX6r48` resolves with HTTP 200 at 5,685
bytes, its own content uses 19 Delphi ontology terms and no legacy ones, and its publication info
declares the legacy claim template. The hub thread pointed at it; it was fetched and counted here.
How many published records carry the defect was not measured: one was confirmed, and the rest of
that batch is inferred from a local manifest rather than from the network. That manifest also
records one approver and a null second reviewer for the promotion to production.

So this is not a regression in one template version. The claim, evidence-item and rubric-assessment
templates are **already migrated in the source and were never republished**; the network still
serves the legacy copies. The provenance template is clean in both. The pubinfo-domain and rubric
templates are still legacy in the source itself. The source-versus-published observation came from
the lean thread for five of these templates; it was re-measured here, and the claim template was
added to it. Separately, the nanopub-skill assertion-template collection downloaded on 2026-10-31
holds 503 templates, none of which references the Delphi ontology namespace.

The finding is recorded as a nanopub of its own
(`claim-delphi-v2-template-declarations-are-false.trig`) with the counts as its evidence item and
the remediation paths written as options for the key owner, not as a recommendation from this
thread. One of those options matters for this folder: even the migrated claim template fixes the
claim's subject to the artifact-code IRI, while these records mint readable identifiers such as
`delphir:claim/organism-blueprint-cattle`, so they would still not conform. Readable identifiers
were kept deliberately, because they can be checked against the repository by eye before signing.
