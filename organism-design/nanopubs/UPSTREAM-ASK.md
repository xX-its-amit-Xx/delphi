# Upstream ask for Knowledge Pixels: templates, a checker, and two proposed forms

From the DELPHI threads at the ScienceClaw hack, 31 October 2026. Three asks, in descending order
of how much they block honest records. Everything below was measured; the commands are included so
each number can be re-derived. Nothing here has been published, signed, or minted.

Contributors: the organism thread measured and wrote this; the lean thread found the
source-versus-published gap; the claim-tests thread found the checker defect and the lean thread
reproduced it; the hub thread supplied two identifiers; the holdout thread authored the two
template proposals in ask 3.

---

## Ask 1: republish three already-migrated templates, and migrate two more

**The problem.** The Project Delphi ontology is at v2.0 and its skill settles that new records use
`https://w3id.org/delphi/ontology/` terms and never the legacy `probknow` IRIs. The publishing
pipeline nonetheless maps every v2.0 class to the published ProbKnow template for that class, and
those published templates fix legacy types on legacy subjects of the form
`https://w3id.org/probknow/resource/<kind>/~~ARTIFACTCODE~~`. A record that follows the settled
rule cannot instantiate the template its own pipeline declares for it, so
`nt:wasCreatedFromTemplate` is a false statement about how that record was made.

`check-nanopub-conformance.py` from the nanopub skill reports, for such a record, every assertion
triple unmatched and the required statement `st01` missing, against the claim template and the
evidence-item template alike.

**This is not a regression; the migration exists but was never published.** Occurrences counted
with `grep -o` on 2026-10-31, published copies fetched as `https://w3id.org/np/<id>.trig`, source
read at commit `6ba5f9a97a4511c909f5dfd755c7993dd68989f3` of
`github.com/fractastical/project-delphi-ontology`:

| template | published: probknow / delphi | source file | source: probknow / delphi |
|---|---|---|---|
| claim `RApE-nGpCMigXqZjeHuYuMJEVTGmTlNTlZl7IcHi_fhdQ` (declared by published records) | 13 / 0 | `nanopubs/src/04-template-probknow-claim.trig` | 0 / 14 |
| claim `RAI0QFH7bCNJIeKxwG3EbX5QKyoOjlaESiJkVZKs8iUc8` ("Project Delphi claim", created 2026-10-23T13:08:44Z) | 13 / 0 | none identified | – |
| evidence item `RAk4kcX4zA_touv8CeKku9tTUnbR5xiTLSLwFbrKSl3BE` | 10 / 0 | `src/05-template-probknow-evidence-item.trig` | 0 / 11 |
| provenance `RAaYeFYF-Cz2bM5S1wPQsnvs5X6BBxsphL03UkbVZ1lcA` | 0 / 0 | `src/02-template-provenance-probknow-extraction.trig` | 0 / 2 |
| pubinfo domain `RAtKj9bCnB4gUe0E9k-WhffQFSEWd9Ve2hrVllYoLuOB0` | 2 / 0 | `src/03-template-pubinfo-probknow-domain.trig` | 3 / 0 |
| rubric assessment `RAOAK6Fe6J6JvD4kUCZg53sRpwRkRq7rzFuDtGT7n6Drw` | 19 / 0 | `src/18-template-probknow-rubric-assessment.trig` | 0 / 21 |
| rubric `RAbjeus1yO4SqlPLnpIWNLS6nvW0DGF3879tVduuE0y00` | 10 / 0 | `src/19-template-probknow-rubric.trig` | 11 / 0 |

So: **republish three** (claim, evidence item, rubric assessment: already migrated in the source,
stale on the network), and **migrate two first** (pubinfo domain, rubric: still legacy in the
source). The provenance template is clean in both. Two claim templates are in play and both are
legacy on the network.

A sweep of the 503 assertion templates in the nanopub skill's collection, downloaded 2026-10-31,
found none that references the Delphi ontology namespace at all.

**It reaches production.** `https://w3id.org/np/RAtLFqIIyu4r-GlMcBEfmDtbV-CHwWxQ49gVMtHIX6r48`
resolves with HTTP 200 at 5,685 bytes, its own content carries 19 Delphi ontology terms and no
legacy ones, and its publication info declares the legacy claim template. It is the published
Fisher fundamental-theorem claim from the math-bio-theorems batch, signed to the test registry on
2026-10-30T23:24:44Z and promoted to production on 2026-10-31T00:09:54Z according to that batch's
manifest, which also records one approver and a null second reviewer. How many published
records carry the defect was not measured here: that one was confirmed on the network, and the rest
of its batch is inferred from a local manifest.

**The defect is in publication info.** It misdescribes how a record was made. It does not touch
what the record asserts, and assertions built from v2.0 terms are unaffected. Nothing here calls
for retraction, and what happens to records someone else signed is for their key owner to decide.

**One detail for whoever republishes: please add a subject placeholder.** The migrated claim
template still fixes the claim's subject to `delphir:claim/~~ARTIFACTCODE~~`, and the
rubric-assessment template does the same for assessments. Several threads here mint readable
identifiers instead, such as `delphir:claim/organism-blueprint-cattle`, so those records will not
conform even after republication. Three reasons to support both forms rather than require the
artifact code:

1. **An artifact code does not exist until sealing**, so a record whose subject is its own artifact
   code cannot be reviewed by subject against anything before it is signed. These threads check
   every record against the repository by eye first, which that forbids.
2. **Records here cite each other.** A held-out exam cites the pre-registered hypothesis it scores,
   evidence items cite existing claim identifiers, and eligibility records cite claims published
   earlier. With readable identifiers the whole set is written, checked and reviewed together; with
   artifact codes it becomes an ordered signing chain, each step waiting on the previous trusty
   URI, which is the opposite of a pre-registered, review-before-publish workflow. (This reason is
   the holdout thread's.)
3. **The ontology's own example already uses readable subjects**:
   `examples/probknow-math-law-lean.example.ttl` carries
   `https://w3id.org/delphi/resource/math-law/wolfram-conus-textile-rule30-1`. A template that
   forbids the readable form for claims is inconsistent with the documented convention for laws.
   (This reason is the lean thread's; the file was checked here.)

The suggested shape, from the holdout thread: keep the artifact-code default for people filling the
form in Nanodash, and add a subject placeholder, a local-resource or restricted external-URI
placeholder under `delphir:<kind>/`, so generator-built records with stable pre-signing identifiers
conform too. Either way the existing records are not wrong; they simply do not match a form that
assumes form-filling.

Reproduce:

```bash
curl -sL https://w3id.org/np/<id>.trig | grep -o 'w3id.org/probknow' | wc -l
grep -o 'w3id.org/delphi' nanopubs/src/04-template-probknow-claim.trig | wc -l
python nanopub-skill/scripts/check-nanopub-conformance.py <a v2.0 record>.trig
```

---

## Ask 2: `np check` exits 0 when a file fails to parse

nanopub-java's `check` command returns exit status 0 on a file that does not parse. Verified on
2026-10-31 with two inputs: a file of garbage, and a truncated copy of a valid record. Each prints
`RDF ERROR: <file>` and `Summary: 1 errors;`, and each exits 0, which is what a valid record also
does.

Any pipeline that gates on the exit code therefore treats an unparseable record as checked. Found
by the claim-tests thread, reproduced independently by the lean thread and by the organism thread.

The ask is a non-zero exit when a file fails to parse or is judged invalid. If the current
behaviour is deliberate, documenting it in the command's help text would do, because the natural
reading of exit 0 is "this passed".

A second point, and the sharper one, for whoever writes a wrapper around this command: **the
verbose output cannot be read by pattern at all, and its section markers can be forged by record
content.** `check -v` prints each record's label and description, a description starts at column 0,
and a literal may contain newlines. So a record can place `RDF ERROR:`, `Summary: 1 errors;`, or an
entire fake `ISSUES:` section with its own `- ` entries at the start of lines, ahead of the
validator's real section. Any record documenting this defect will do the first by accident; a
record could do the last deliberately. Both were verified here with fixtures. (When rebuilding them: the planted newlines must be the
two-character escape inside the literal, or the record will not parse and the probe will look like
it proved the opposite.)

The consequence for wrappers is not only false alarms. A wrapper that takes the first `ISSUES:`
marker tallies the planted list and never reaches the real one, so a planted list resembling the
expected issues hides genuine ones in silence. The only sound reading of the current output is
per-file blocks, verdict taken from the header lines before the first section marker, and issues
taken from the last marker onward. A machine-readable mode, such as JSON output, or a prefix on
every content line, would remove the need for any of that.

Meanwhile every validity statement in `organism-design/nanopubs/` comes from
`organism-design/nanopubs/check.mjs`, which ignores the exit code and reads the transcript
structurally: one block per file at the `Reading file:` lines, each block's verdict taken only from
the lines before its first section marker, issues taken only from the last `ISSUES:` marker
onward. Three fixtures run before any real record is reported on: a truncated record must be
rejected, a record quoting the error strings must be accepted, and a record carrying a planted
issues section must be accepted with only the genuine issues tallied.

Reproduce:

```bash
printf 'this is not RDF {{{\n' > broken.trig
java -jar nanopub.jar check broken.trig; echo "exit=$?"
```

---

## Ask 3: two proposed assertion templates for held-out exams

These are **proposals, not minted templates**, and they are the holdout thread's work, carried here
at the hub's request. Minting a template is a publishing act, and one user with no second opinion
is premature standardisation, so nothing was created on the network. Both assume v2.0 terms only.

The gap: none of the published Delphi assertion templates (claim, evidence item, testable
hypothesis, LLM rubric assessment, Bayesian assessment) describes an assessment of a scripted
held-out exam, so the holdout thread's nine draft records declare no assertion template and
`np check` notes that on each.

### Proposal 1, "Held-out clade exam", target type `delphi:Assessment`

Statements: the claim or hypothesis evaluated, with `delphi:evaluatesHypothesis` and the inverse
`delphi:hasAssessment` from the claim; `delphi:assessmentType` fixed to `held-out-clade-exam`;
`delphi:hasVerdict` restricted to `supports | refutes | mixed | inconclusive`; the frozen exam file
as a `prov:Entity` with an SPDX SHA-256 checksum and a `prov:generatedAtTime` recording the freeze;
the builder's pre-registered decision rule quoted verbatim on a `prov:Plan` node with its own
`generatedAtTime`, which must precede the data; one `delphi:EvidenceItem` linked by
`delphi:hasEvidence` carrying the held-out sample size and the builder's minimum as
`schema:PropertyValue` counts (`n_species`, `builder_minimum_n`) alongside the measured value; a
free-text statement of what the exam does not establish; and `prov:wasAttributedTo` an assessor
software agent that must differ from the builder.

Rationale, in the holdout thread's words: the five fields a record of this kind needs to be
auditable are whether it was blind, whether the rule was pre-registered, whether it was
underpowered, by whom it was run, and what it does not show. A form should force exactly those, and
"underpowered, therefore inconclusive" should be expressible without a hedge.

### Proposal 2, "Held-out exam eligibility", target type `delphi:Assessment`

Statements: the claim assessed; `delphi:assessmentType` fixed to `held-out-exam-eligibility`;
`delphi:hasVerdict` restricted to `eligible | burned`; a required reason why the item is no longer
blind, for example that a builder's agents read it before the clade was held out; the disclosure
source in provenance, naming who disclosed it and in which file; and a statement that the verdict
is about blindness and not about the claim's truth.

Rationale: retiring an exam item is obvious to everyone today and invisible to a reader of the
graph in six months unless the graph says so.

### Where to see the shape in use

`holdout/nanopubs/unsigned/exam-kimura-heterozygosity-aves.trig` and
`holdout/nanopubs/unsigned/burned-darwin1859-ch01-10.trig`, with the reasoning in
`holdout/nanopubs/DECISIONS.md` items 1, 7, 9a and 10. Both drafts were read before this summary
was written, and they carry the statements described above.

---

## What these threads did in the meantime

Dropped the template declaration rather than assert a false one, and said in each record's
publication info why it is absent and what should replace it. No human is named in any draft: the
key owner supplies an ORCID at signing time. Nothing is signed and nothing is published, to the
test registry or anywhere else.
