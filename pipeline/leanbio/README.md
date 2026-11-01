# LeanBio pipeline: literature to grounded nanopub to belief to Lean candidate

Product 0 is a living repo that serves **LeanBio claims**: claims distilled from the literature, recorded as nanopubs,
grounded to ontology identifiers, ordered by a belief score, and, when a correct statement exists, formalized in Lean 4
as a candidate law. This folder makes that chain explicit, runnable and checkable. The public criteria for proposing a
law are in [`CONTRIBUTING-LEANBIO.md`](../../CONTRIBUTING-LEANBIO.md).

```
literature ──(1) distill──> claims (docs/claims.json) + nanopub drafts (*/nanopubs/unsigned/*.trig)
           ──(2) guard────> records touching the held-out exam clade are withheld before any processing
           ──(3) ground───> entity mentions -> ontology ids (Gilda; MyGene, OLS4, repo inventory as fallbacks)
           ──(4) type─────> INDRA-style statement: subject, relation (fixed vocabulary), object
           ──(5) draft────> unsigned nanopub draft carrying groundings, statement and belief
           ──(6) belief───> two-sided INDRA SimpleScorer over independent evidence
           ──(7) queue────> formalization candidates, ordered by formalizability then belief
           ──(8) propose──> Lean statement via lean/registry/propose.mjs -> 'candidate' (a person accepts, never this code)
```

## Run it

```bash
node pipeline/leanbio/run.mjs            # stages 2-4, 6, 7 over every claim and draft; network only for cache misses
node pipeline/leanbio/run.mjs --check    # offline: fails if any record lacks grounding or belief, or outputs are stale
node pipeline/leanbio/draft.mjs --top 5 --write          # stage 5 for the queue head -> nanopubs/unsigned/
node pipeline/leanbio/ground.mjs "BMP4 restricts osteoblasts in the zebrafish fin"   # text -> groundings
node pipeline/leanbio/ground.mjs --entity kcnk5b --kind gene                         # one entity
node pipeline/leanbio/harvest.mjs --count                # read-only: Delphi claims on the public nanopub network
node pipeline/leanbio/check.mjs          # what CI runs (plus lean/registry/check-exposed.mjs)
node pipeline/leanbio/test.mjs           # tests; each check also fails once on broken input
```

Outputs: `out/records.json` (one record per claim or draft: groundings, statement, evidence items, belief, queue verdict),
`out/queue.json`, `out/coverage.json`, `out/summary.json`, and `dashboard/public/leanbio/data.json` for the page at
`/leanbio/`. Every number on that page comes from these files.

## 1. Distillation (reused, not rebuilt)

Claims already come out of the literature through existing, documented extractions:

| source | extraction | output |
|---|---|---|
| Darwin, *Origin* (1859) | `darwin-origin/extraction/INSTRUCTIONS.md`, one JSON per chapter range, `excluded.json` | `darwin-origin/claims.json` |
| Thompson, *On Growth and Form* (1917) | `thompson-growth-form/extraction/` (same protocol) | `thompson-growth-form/claims.json` |
| Wolfram, *NKS* (2002) | `wolfram-nks/` (same protocol) | extraction drafts |
| key theorems of mathematical biology | hand-curated with DOIs | `math-bio-theorems/claims/key-claims.json` |
| thread findings (tests, genotype, physics, Lean, organism design, swarm) | each thread's builder | `*/nanopubs/unsigned/*.trig` |

`docs/load-claims.mjs` merges the claim files into one shape, `docs/build-claim-graph.mjs` writes `docs/claims.json` and
adds the elicited truth scores from `truth/raw/` (`truth/INSTRUCTIONS.md`: blind assessors, `p_true` per claim). This
pipeline reads `docs/claims.json` and the draft folders listed in `lib.mjs` `DRAFT_DIRS`. A draft that links a claim IRI
(`https://w3id.org/delphi/resource/claim/<id>`) becomes evidence for that claim; any other draft is its own record.
New literature enters the same way: an extraction (or a harvested nanopub, `harvest.mjs`) becomes a claim or draft in
the repo, and the next `run.mjs` grounds and scores it.

## 2. Held-out guard

The held-out clade is defined in `holdout/`. `lib.mjs` reads the roster at run time (this folder names no held-out
organism) and withholds every claim or draft whose text, claim id or taxon id touches it, before any service call.
Service responses are screened too: a candidate that names a held-out taxon (a homonymous genus, for example) is
dropped before it reaches the cache. Only the count of withheld records is reported.

## 3. Grounding

`ground.mjs`, in cascade order. Every response is cached in `cache/` (committed), so reruns and CI are offline and
reproducible; a cache miss offline is reported as `not-run`, never guessed.

1. **Gilda** (INDRA's grounder), public REST API `https://grounding.indra.bio`: `/annotate` does named-entity recognition
   plus grounding over the claim text; `/ground` grounds one string. Namespaces seen: MESH, GO, NCBITaxon, EFO, HP,
   CHEBI, HGNC, FPLX.
2. **MyGene.info** (species 7955) for zebrafish gene symbols, which Gilda's public index does not carry, to ZFIN ids.
   Tried for gene-shaped tokens only when the text has fish context, and for genes a draft declares.
3. **The repo inventory** `organisms/merged/taxa.json` (NCBI taxids resolved by roles A3/A5), then an OLS4 exact-label
   search in NCBITaxon (rank-tagged homonyms such as "X &lt;genus&gt;" resolve to the genus).
4. **OLS4 verification** of identifiers a draft declares itself (UBERON, CL, GO, ZFA, NCBITaxon; ZFIN and Ensembl gene
   ids via MyGene). A declared id that does not resolve is reported as `declared-unresolvable`.

**Acceptance rule.** score >= 0.70: accepted. 0.50 <= score < 0.70: accepted only if the matched entry shares a word stem
with the mention, otherwise `low-confidence` (this removes Gilda synonym hits such as "mass" -> FBN1 or "velocity" -> a
herbicide). A second, different entry within 0.05 of the best: `ambiguous`, kept and flagged, never auto-resolved.
Many accepted groundings are generic MeSH concepts ("Population", "Animals"); they are real identifiers but carry little
meaning, and the coverage report counts them by namespace so a reader can discount them.

## 4. Statement typing (INDRA-style)

`relations.mjs` + `relations.json` (versioned vocabulary). Two families:

- **indra**: `Phosphorylation`, `Complex`, `Inhibition`, `Activation`, `IncreaseAmount`, `DecreaseAmount`, copied from
  INDRA's statement types. They fire only when a grounded gene, protein or chemical sits on both sides of the trigger.
- **law** (ours, for what biology-law sources assert): `ScalingLaw`, `Bound`, `Equality`, `Dynamics`, `Comparative`
  (formalizable as a theorem over quantities), `Causation`, `Correlation`, `Unclassified` (a named hypothesis at most),
  `Absence`, `WellFormedness`, and `Meta` for assessment and concept records (not formalizable).

Typing is regex rules, first match wins, with the rule recorded on every statement. Its precision has not been measured;
the most common error is a hedge firing a law type ("at least in part" read as `Bound`). A reviewer overrules it in
`proposals.json`.

## 5. Nanopub draft

`draft.mjs` writes the repo's existing unsigned format (temp `np1` namespace, Delphi v2.0 prefixes, software-agent
creator, no human ORCID, an `UNSIGNED DRAFT` statement). The assertion introduces a `schema:Claim` LeanBio statement that
`schema:isBasedOn` the Delphi claim IRI, is `schema:about` each grounded entity (OBO PURLs, otherwise bioregistry IRIs),
and carries the relation, subject, object and belief as `schema:PropertyValue`s. Ambiguous groundings are named in a
comment, not asserted. `np check` (nanopub-java 1.95.0) reads the generated drafts as valid, not trusty (unsigned).
Nothing here signs or publishes.

## 6. Belief score

`belief.mjs` + `belief-params.json` (version `leanbio-belief/0.1.0`). INDRA's SimpleScorer form, applied separately to
supporting and contradicting evidence:

```
P_wrong(s) = min(1, syst_s + rand_s ^ n_s)        n_s = independent items of source class s
E = 1 - PROD_s P_wrong(s)   over supporting items
R = 1 - PROD_s P_wrong(s)   over contradicting items
belief = E * (1 - R)
```

| class | rand | syst | what counts as one item |
|---|---|---|---|
| preregistered-test | 0.10 | 0.05 | a `claim-tests/**/result.json` verdict (supports / refutes; mixed counts once on each side; inconclusive counts nowhere) |
| repo-evidence | 0.25 | 0.10 | a thread draft (not built from a claim test) with status supported / established / observed, or refuted / not-established |
| literature | 0.30 | 0.10 | a DOI or PMID cited by a supporting non-test draft |
| model-elicitation | 0.45 | 0.25 | one language model's `p_true` (>= 0.5 supports, < 0.5 contradicts) |
| lean-conflict | 0.20 | 0.10 | a linked law that is contested or has open conflicts (contradiction only) |

**Independence.** Items are deduplicated by source key: a DOI counts once however many drafts cite it, a model once, a
claim test once. A draft built from a claim test is the same experiment as the test, so neither it nor the datasets it
cites count again.

**Worked example** (`maynardsmith-hitchhiking`): one supporting pre-registered test and two supporting model scores.
E = 1 - (0.05 + 0.10^1)(0.25 + 0.45^2) = 1 - 0.15 x 0.4525 = 0.932; R = 0; belief 0.932.
Two model votes alone give 1 - 0.4525 = 0.548, which is why many claims share that value: most claims have no evidence
but two elicited opinions.

**Not used**: a Lean proof (it proves a model's consequence, not that organisms obey the model; formalized claims leave
the queue instead), testability (ease of testing is not evidence of truth; a queue tie-break only), and prior work that
searches found but no draft cites. **Calibration**: the parameters are hand-set, not fitted; INDRA fits them to curated
corpora and we have none yet. Belief orders the queue. It is not a probability.

## 7. Queue

A record is queued when belief >= 0.5, its relation is formalizable (`theorem` or `named-hypothesis`), it is linked to
no registry law in status accepted / candidate / proposed / contested, a reviewer has not declined it
(`proposals.json`), and, for drafts, it has at least one grounded entity. Order: theorem-shaped relations first, then
belief, then the number of supporting pre-registered tests, then testability, then id.

## 8. Proposal

A queued item becomes a law only through `lean/registry/propose.mjs` (build, no `sorry`/`axiom`, standard axioms only,
non-vacuity witness, joint consistency with the current lawset, statement mutants rejected) and `check-exposed.mjs`.
propose.mjs stops at `candidate`. Acceptance is a person setting `approval.approved_by_role` and cutting a lawset with
`release.mjs`. Decisions on queue items, including the ones not proposed, are logged in `proposals.json`.

## First run (2026-11-01, snapshot; the live numbers are in `out/summary.json` and `out/coverage.json`)

- 941 records (850 claims, 91 drafts; 24 more drafts attached as evidence to claims); 69 withheld by the held-out guard.
- 789 of 941 records (83.8%) have at least one grounded entity. Text mentions: 2,272 grounded, 16 ambiguous,
  693 rejected as low-confidence, 1 ungroundable. Declared entities: 185 of 194 grounded; not grounded: Ammonoidea,
  Meganisoptera, Pterosauria, Pisces (fossil or obsolete taxon names), Reptilia (low-confidence), lat4a (a former gene
  symbol; the genotype thread settled it as slc43a2a).
- Queue head: rank 1 `darwin1859-ch11-13` (belief 0.932) was reviewed and declined, because the glacial-simultaneity claim
  has no quantity to formalize. Rank 2 `maynardsmith-hitchhiking` (0.932) was proposed: `lean/Hitchhiking.lean`,
  propose.mjs status `candidate` (builds, standard axioms, witness, 3 of 3 mutants rejected), check-exposed green.
