# Holdout thread: nanopublication records (drafts)

Standing order from Amit (relayed by the hub, 2026-10-31): every finding is recorded as a Project Delphi
nanopublication with its evidence attached, negative and inconclusive findings included. This folder holds
the holdout thread's records as **unsigned drafts**. Nothing here is signed or published.

## Publishing boundary

- `AGENTS.md`: nothing is published unless the key owner explicitly asks; test registry first; production
  signs with the operator's ORCID key and cannot be undone.
- The hub has asked Amit who signs. Until that answer arrives these files stay unsigned, their labels start
  with `Draft:` and their pubinfo carries a comment saying so.
- Provenance points at two copies of `holdout/`: the live sub-dashboard data file
  `https://delphi-mission-control.ashenoy000.workers.dev/t/holdout/data.json`, and the commit-pinned tree on
  the pushed branch (PR #36 against fractastical/delphi; `manifest.json` names the commit). That commit holds
  the provisional freeze the exams ran against, which the exam records cite by SHA-256; the confirmed
  re-freeze of 2026-10-31 14:38 UTC (decision recorded, roster unchanged) reaches the pinned copy at the next
  push, after which the records are rebuilt with `--commit <sha>`. Every file the records rest on is named
  with its SHA-256 either way. Before signing: `--final --creator <ORCID> --commit <sha>`, `check.mjs`, lint.

## Records (one per nanopub)

| file | record | status it states |
|---|---|---|
| `exam-kimura-heterozygosity-aves.trig` | held-out exam of the Kimura heterozygosity test on 13 bird species | inconclusive (underpowered: the builder's minimum is 50) |
| `exam-hamilton-senescence-aves.trig` | held-out exam of the Hamilton senescence test on 8 bird species | inconclusive (underpowered: the builder's minimum is 15) |
| `prereg-organism-design-aves.trig` | the pre-registered hypothesis and scoring rule for the organism-design exam | pre-registered (written before the prediction file existed) |
| `exam-organism-design-aves.trig` | held-out exam of the organism-design blueprint tool on the 48-species roster | inconclusive (the panel lacks both pre-registered structures) |
| `clade-analysis.trig` | the public tables cannot support a blind clade exam at the builders' own minimum n (13 vs 50, 8 vs 15); Aves confirmed by Amit on 2026-10-31 knowing this, over a Mammalia holdout that would make 1 of 2 exams decisive but 3 built tests post hoc | established by enumeration of project files; decision and cost recorded |
| `leak-check.trig` | method and result of the leak check over the whole tree (every top-level folder except the exam and its inputs, including every thread's nanopub drafts and Lean modules; held-out names, identifiers and bird-only claim ids) | observed at the stated time (0 hits outside the reasoned allowlist) |
| `triage-coverage.trig` | 14 of 16 completed tests contain no bird rows | established by inspection |
| `burned-darwin1859-ch01-10.trig` | pigeon claim retired as a blind exam item | burned |
| `burned-thompson1917-ch15-01.trig` | egg-shape claim retired as a blind exam item | burned |
| `ruling-formal-statements-of-bird-linked-claims.trig` | a Lean 4 theorem of Thompson's flight-scaling law (`thompson1917-ch02-06`, `-07`) and the physics thread's flying-fish test of it are not a leak and do not burn the exam; the checker's blind spot that let the hub's curator, not the checker, find it, and how it was closed | eligible (ruled 2026-10-31; from `holdout/rulings.json`) |

Each record carries, as the hub asked: the claim in one plain sentence (`rdfs:label`), its status in words
(`delphi:hasVerdict` or the first words of `dct:description`), the evidence item linked with
`delphi:hasEvidence` naming the frozen exam and split by SHA-256 and carrying the numbers as structured
`schema:PropertyValue` counts, the pre-registration (frozen-exam timestamp; the builder's verbatim criteria
on a `prov:Plan` node; `PREREG.md` for the organism exam), and a sentence on what the record does not
establish.

## Build and check

```
node holdout/nanopubs/build-nanopubs.mjs                       # drafts -> holdout/nanopubs/unsigned/, manifest.json
java -jar nanopub-1.95.0-jar-with-dependencies.jar check holdout/nanopubs/unsigned/*.trig
cd <project-delphi-ontology>/pipeline && npx tsx lint-holdout.mts <repo>/holdout/nanopubs   # Delphi lint
```

`node holdout/nanopubs/check.mjs` runs `np check -v` once per file and reads the transcript structurally: the
verdict comes only from the lines before the block's first section marker and the issues only from the
**last** `ISSUES:` marker up to the Summary line, because the validator prints each record's own description at
column 0: a record quoting "RDF ERROR:" or "Summary:" would fool a pattern scan, and a description with
newlines can forge a whole `ISSUES:` section that shadows the real one if the first marker is taken (both found
by the organism thread; record content is only ever printed before the validator's own sections, so nothing a
record contains can appear after the real section). `--selftest` runs three fixtures: a real record with those
strings baited into its description must pass; a truncated record must fail (the validator itself exits 0 on
parse errors); and a record whose description forges an `ISSUES:` section with entries mimicking the expected
ones must yield exactly the genuine issues and none of the fake ones (measured: forged marker at line 8 of the
block, real one at line 17). Exit 1 on any file not valid or any issue beyond the unsigned-draft ones and the
"no assertion template" taken by decision.

`np check` reports each file as `valid (not trusty)`: unsigned, as intended. The Delphi lint
(`project-delphi-ontology/pipeline/lint.ts`, commit 6ba5f9a) runs clean with three recorded exemptions
(`manifest.json`, `lint_exemptions`): the clade, leak-check and triage claims have no empirical dataset
because they are statements about this project's own files, which the records carry by checksum and count.

## Modelling choices

See `DECISIONS.md`. In line with the team decisions of 2026-10-31 (claim-tests/nanopubs/DECISIONS.md): no
human ORCID in the drafts (creator and attribution are the assessor software agent; the key holder's ORCID is
added at signing with `--creator`), no `nt:wasCreatedFromTemplate` (the published Delphi assertion templates
still carry the legacy probknow namespace), and the status of each evidence item as a structured
`schema:PropertyValue "status"`. Declared, after fetching and finding no legacy IRI: the provenance template
"Attributed to myself/others" and the ecosystem's Creator and License pubinfo templates. A scripted held-out
exam is typed `delphi:Assessment` with `delphi:assessmentType "held-out-clade-exam"`, since the published
assessment templates describe LLM rubric scoring and Bayesian assessment, neither of which this is.
