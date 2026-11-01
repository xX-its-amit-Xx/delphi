# Contributing to LeanBio: harvest nanopubs, propose laws

> ### The two names
>
> **LeanBio Forum** and **DELPHI** are the same system. `DELPHI` is the name used throughout
> this repository — every path, module, URL and record id uses it, and none of that is being
> renamed. **LeanBio Forum** is the name the project is presented under: the pitch deck at
> `dashboard/public/deck/`, and the public pages under `/leanbio/`. If you see one name in a file
> and the other on a slide, they refer to the same thing.

DELPHI serves **LeanBio claims**: biology claims distilled from the literature, recorded as nanopublications, grounded
to ontology identifiers, ordered by a belief score, and, where a correct statement exists, formalized as Lean 4 laws.
Anyone can add claims and propose laws. This page says what a proposal must meet and how to get there. The machinery
is in [`pipeline/leanbio/`](pipeline/leanbio/README.md); the law registry is in [`lean/registry/`](lean/registry/README.md).

Two hard rules before anything else:

- **Nothing is published from a pull request.** Contributions are unsigned drafts. Signing and publishing a nanopub is
  irreversible and is done only by the key owner, with explicit approval, test registry first. Never put a human ORCID,
  an e-mail address or a key in a draft or a law file.
- **The held-out exam is off limits.** One clade is frozen as a blind exam (see `holdout/README.md`). Do not add
  claims, data, groundings or laws about it. The pipeline withholds anything that touches it, and CI fails if an
  output names it.

## Criteria for proposing a LeanBio law

A proposal is a PR that adds a law to `lean/registry/` through `propose.mjs`. It is reviewable when **all** of these hold.
CI checks the ones marked (CI); a reviewer checks the rest.

1. **A sourced nanopub.** The claim exists in the repo as a claim in `docs/claims.json` or as an unsigned draft in a
   `*/nanopubs/unsigned/` folder, with its source (DOI, PMID, dataset identifier or repo file) and, for literature, the
   quoted sentence it came from. Identifiers must resolve; a fabricated citation is the worst failure this repo has.
2. **Grounded entities (CI).** `node pipeline/leanbio/run.mjs` has grounded the record: at least one entity mapped to an
   ontology identifier (HGNC, ZFIN, UniProt, UBERON, CL, GO, CHEBI, MESH, NCBITaxon, ...). Ambiguous groundings are
   listed, not hidden. Commit the updated `pipeline/leanbio/cache/` so CI can re-run offline.
3. **Belief at or above the threshold, for a law that asserts an empirical regularity (CI).** The record's belief
   (`pipeline/leanbio/belief-params.json`, currently `queue.min_belief` = 0.5) is computed and committed. Belief is an
   ordering heuristic over independent evidence, not a probability; do not add duplicate evidence to raise it (CI
   deduplicates by source anyway).
   **This gate applies only when the law's `class` is `empirical-observation` or `named-hypothesis`** — a law that
   asserts organisms do something. A `theorem` or `theorem-from-hypothesis` law asserts only that its conclusion
   follows from its named hypotheses, so claim-level belief is evidence neither for nor against it; *a refuted
   empirical claim does not refute a model theorem derived from it*, which is the converse of the rule in
   `pipeline/leanbio/README.md` §6 that a Lean proof is not evidence. A model theorem is judged instead on soundness
   (criteria 5-7), scope (criterion 8), and whether it binds anything (criterion 10 and its `browser_check` block).
   Nothing is exempted silently: `check.mjs` prints a criteria note for every ungated score with its class and its
   contradicting evidence, and `test.mjs` tests the gate both ways. House rule, 2026-11-01; see
   `pipeline/leanbio/DISCOVERY-ROUND-2.md` §4a for the two laws that forced it.
4. **The law id is the record id (CI).** Use the claim id (e.g. `maynardsmith-hitchhiking`) so the law, the claim and its
   nanopubs link without a lookup table. A draft-derived law uses `draft:<path>`. A law distilled from the repo's own
   measured data rather than from a claim or a draft has origin **`data:<path>`**, and its lineage check is that the
   source file resolves in the tree; criteria 2 and 3 do not apply to it, since it has no grounded record and no
   claim-level belief. Rejecting such a law while accepting an aphorism-derived one is backwards (2026-11-01).
5. **A Lean statement in the registry's form.** Empirical premises are **named hypotheses** (a `structure` or `Prop`
   structure, each with its source in `meta.json` `hypotheses[].source`), never `axiom`. No `sorry`, `admit`, `axiom`,
   `unsafe` or `native_decide`; `#print axioms` shows only `propext`, `Classical.choice`, `Quot.sound`.
6. **A non-vacuity witness.** A declaration showing the hypotheses can be satisfied (e.g. `Nonempty Instance` with the
   observed or a plausible value). A law nothing can satisfy is refused.
7. **A mutation test.** `propose.mjs` flips each relation in the statement; every mutant must fail to compile. A proof
   nobody tried to break is not evidence.
8. **A scope.** `scope.taxa`, `life_stages`, `ranges` and a `basis` sentence from the sources. A law outside its scope
   says nothing.
9. **Joint consistency.** If the law constrains shared quantities, its `shared_scope` atoms are checked against the
   accepted laws of the current lawset; a proved contradiction makes it `contested`, not accepted.
10. **Exposed everywhere (CI).** `node dashboard/build-lean-api.mjs`, then `node lean/registry/check-exposed.mjs` passes:
    the law is in the registry, the MCP tools, both CLIs and the static API mirror.
11. **Human acceptance.** `propose.mjs` stops at `candidate`. A person (never the proposer's agent) reviews the
    statement against the English claim, sets `approval: {approved_by_role, date, basis}` with a **role**, not a name,
    and cuts a lawset with `release.mjs`. Only then is the law `accepted`.

Also say, in the PR, what the law does **not** establish. A Lean theorem proves a consequence of the named hypotheses;
it never proves that organisms obey them.

## How to propose, step by step

```bash
npm install
node pipeline/leanbio/run.mjs                      # ground and score (needs network the first time for new text)
node pipeline/leanbio/run.mjs --check              # must print OK
# pick a queue item: out/queue.json, the /leanbio/ page, or the leanbio_queue MCP tool
# write my-law.lean (named hypotheses, theorem, witness) and my-law.meta.json (see lean/registry/propose.mjs header)
node lean/registry/propose.mjs my-law.lean --meta my-law.meta.json          # dry run: read the steps
node lean/registry/propose.mjs my-law.lean --meta my-law.meta.json --write  # status 'candidate' if every step passed
node dashboard/build-lean-api.mjs && node lean/registry/check-exposed.mjs
node pipeline/leanbio/run.mjs && node pipeline/leanbio/check.mjs && node pipeline/leanbio/test.mjs
```

Record your decision in `pipeline/leanbio/proposals.json`, including when you looked at a queue item and found no
correct statement. That is a result too: it takes the item off the queue with the reason. A worked example is
`maynardsmith-hitchhiking` (`pipeline/leanbio/lean/Hitchhiking.lean`).

Open the PR with the LeanBio template: `?template=leanbio.md` (`.github/PULL_REQUEST_TEMPLATE/leanbio.md`).

## Harvesting nanopubs

New claims can come from the public nanopub network. Knowledge Pixels runs a read-only SPARQL query service:

- Endpoint: `https://query.knowledgepixels.com/repo/full` (RDF4J, **no inference**: query exact type IRIs and every
  spelling of a term, `BEST_PRACTICES.md` section 10). Published query templates live under
  `https://query.knowledgepixels.com/api/<artifact-code>/<query-name>`; browse records in
  [Nanodash](https://nanodash.knowledgepixels.com/).
- Script: `node pipeline/leanbio/harvest.mjs` lists recent nanopubs of a type (default `delphi:Claim`);
  `--count`, `--type <IRI>`, `--since <date>`, `--limit N`, `--out <file>`. It sends SELECT queries over HTTP GET only.
  Checked 2026-11-01 04:10 UTC: 888 distinct nanopubs typed `https://w3id.org/delphi/ontology/Claim` on the network.
- The same endpoint backs the `delphisci` MCP tools with `source: "network"`.

A harvested nanopub is a **candidate**, not a record. To bring it in, add it to the repo as a claim or an unsigned draft
that cites the harvested nanopub's IRI in `prov:wasDerivedFrom`, then run the pipeline. Do not copy another group's
assertion as your own, and do not re-publish it: cite it.

## Contributing groundings and evidence without a law

Useful PRs that need no Lean at all:

- a grounding fix (an ambiguous or ungroundable entity in `pipeline/leanbio/out/coverage.json`, resolved against an
  outside authority, with the source);
- a pre-registered claim test (`claim-tests/<project>/<id>/result.json` committed **before** the data is opened);
- a supporting or contradicting draft with its evidence. Contradictions count: belief is two-sided.

## What CI runs

`.github/workflows/leanbio-proposal.yml`, on PRs that touch nanopub folders, `pipeline/leanbio/` or `lean/registry/`:
`node pipeline/leanbio/check.mjs` (grounding present, belief computed and current, registry schema and content hashes,
LeanBio criteria, drafts unsigned with no ORCID, no held-out leak), `node pipeline/leanbio/test.mjs`, and
`node lean/registry/check-exposed.mjs`. Node only; the Lean build itself runs in `propose.mjs` on your machine.
