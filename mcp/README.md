# delphisci MCP server

Query this repo's claims — their statements, their math, how assessors ranked them, and the claim
graph's model truth scores — from any agent, without writing SPARQL. Available as an MCP server
(`server.mjs`) and as a CLI (`cli.mjs`) with the same queries.

## Run a generated design through the validation framework — start here

One call. Give it the **generated** organism, the **base** organism and the **desired phenotype as a
sentence** (the same prompt the generator was given), and `validate_generation` returns the five named
results side by side, each with its own gate, plus the per-scale coverage and a verdict sentence.

```bash
# hosted, no install                       (https://delphisci-mcp.fly.dev/mcp, tool: validate_generation)
# from a clone or an unpacked npm package:
node mcp/cli.mjs tool validate_generation --json '{
  "desired_phenotype": "a zebrafish that can glide above the water for at least 20 metres after launching, like a flying fish",
  "generated": "winged-zebrafish",
  "base": "zebrafish-adult"
}'
```

`generated` and `base` each take **a design id**, **an inline organism document**, **a path to an
organism-document JSON**, or **a FASTA / plain sequence**. Everything else is optional.

### What comes back (real output, run from an unpacked `npm pack` tarball, 2026-11-01)

```
contract_version 0.8.0        weakest_input measured-secondhand
sequence_basis   document-only   loci_covered 0
analogue (by FUNCTION, not relatedness)  Exocoetidae — flying fishes

result.results
  genotype_similarity    cannot-assess   (gate_set_by pipeline)
  phenotype_similarity   pass            (gate_set_by pipeline)
  lean_check             cannot-assess   (gate_set_by scorer)
  functional_resolution  fail            (gate_set_by functional)
  physics_check          fail            (gate_set_by physics)   ← design_score calls this one physics_simulation

result.per_scale_coverage   assessable: sequence_genomic transcriptomic proteomic ptm pathway organ body
                            NOT assessable: cell tissue organ_system

result.composite_score_from_the_scorer
  {"value": 0.4676, "plausible": false, "version": "1.0.0",
   "note": "the scorer thread's own frozen number, carried through for reference.
            It is NOT this report's verdict, and no gate above feeds it."}

result.verdict.word_validated_withheld  true
result.verdict.withheld_because
  2 gate(s) failed | 2 gate(s) could not be assessed | 3 biological scale(s) could not be assessed
  | 1 clause(s) of the desired phenotype were not parsed, so they were never checked
  | no sequence was compared at any locus
```

and the verdict **sentence** itself, verbatim from that run:

> Desired phenotype: "a zebrafish that can glide above the water for at least 20 metres after launching,
> like a flying fish" parsed into 1 criterion/criteria, with 1 clause(s) NOT parsed and therefore NOT
> checked. Generated input was given as design-id ("winged-zebrafish") and base as design-id
> ("zebrafish-adult"); sequence basis document-only covering 0 locus/loci. Functional analogue(s), chosen
> from the desired function rather than relatedness: flying fishes (Exocoetidae) for leaves the water and
> glides on enlarged pectoral (and in four-wingers, pelvic) fins. **PASSED:** phenotype similarity.
> **FAILED:** the functional-analogue ledger — 19 difference(s) from the closest functional analogue are
> UNRESOLVED; the design is not functionally accounted for, whatever the similarity scores. The physics
> check — the design does not do what was asked. 1 hard criterion(s) not met:
> glide/glide_range_total_m — adult: cannot glide: the reachable launch speed 0.67 m/s is below v_min
> 8.64 m/s, so lift cannot carry the weight [achieved in 0.0 % of 200 draws over the stated input
> distributions; median 0 m, 5–95 % 0 to 0]. **COULD NOT BE ASSESSED:** genotype similarity, the Lean
> check. **SCALES NOT ASSESSED:** cell, tissue, organ_system. The word "validated" is WITHHELD. This
> report says what was checked and what was not; it is not a validity claim.

### The limits, which are part of the recipe and not a footnote

Read these before you render any of it, because each one is a way the report gets misread.

1. **There are no generated genomes, so on a parameter-delta design the sequence basis is
   `document-only`.** A DELPHI design is a parent parameter set plus deltas. On the run above
   `loci_covered` is `0`, `genome_fraction_assessed` is `0`, and `genotype_similarity` is
   **`cannot-assess`** — which is deliberately **not a pass**. Every organism in the repository bundle is
   this case (all seven carry `edits: []`). Do not render a genotype panel as green on a `document-only`
   run. The other two bases are `reconstructed-at-edited-loci` (a document with gene-level edits; sequence
   exists only at those loci) and `supplied` (real sequence handed in for both sides).

2. **`functional_resolution` coverage is ~30 %, and the analogue has no functional data.** On that run:
   `assessable_fraction` **0.3014** — 22 of 73 requirements are assessable, 51 are not (49 unassessable on
   the *analogue* side). Of the 22: 2 demonstrated, 1 hypothesised, 19 unresolved. And the analogue itself
   is data-poor — there is a draft genome for exactly one flying fish (*Hirundichthys speculiger*, Xu 2021,
   GCA_018398805.1) and **no flying-fish transcriptome, proteome or functional assay at any locus**. The
   counts are therefore a **floor**: a difference that was never classified is in none of them.

3. **Glide-based physics checks grade `circular`.** `physics_check.model_honesty.circular_checks` names
   them. On that run the glide criterion is circular: the model was scored against take-off speeds drawn
   from the same body of observations it is being compared with. A `circular` grade is not evidence,
   however green it looks — never show "function achieved" without the `model_confidence` beside it.

4. **Nothing is summed, and `cannot-assess` is not `pass`.** The five results each keep their own gate;
   `composite_score_from_the_scorer` is carried alongside and is **not** the verdict. They genuinely
   disagree, in both directions. Measured on the same packed copy, 2026-11-01:
   `validate_generation {generated: "tff", base: "flying-fish"}` returns composite **0.4089 "not
   plausible"** while `functional_resolution` and `physics_check` both **pass** and
   `phenotype_similarity` **fails**. (`sim-engine/validate/pipeline/RESULTS.md` records the opposite
   case — a composite of 0.878 "plausible" against a failing physics gate. The frozen scorer has moved
   since that was written and this run did not reproduce that number, so take the recorded figure from
   that file rather than from here.) Honour `verdict.word_validated_withheld`.

5. **`gate_status: "incomplete"` is not a pass.** It means a hard requirement had no model and was never
   checked; `unchecked_requirements` lists which.

### Calling one component instead

While iterating, each named result is also its own tool, same arguments, same envelope:
`functional_resolution`, `physics_check`, `closest_relative_phenotype`, `closest_relative_genotype`,
`lean_by_component`, `sanity_check_design`, `design_score`; `validate_design` is the composite report and
`validate_swarm_tasks` emits the six validation sub-tasks as JSON for a collaborator swarm to claim. Build
the `spec` that `physics_check` takes from a sentence with `parse_design_text`.

## Setup

**Hosted (nothing to install)**: point any MCP client that supports Streamable HTTP at
`https://delphisci-mcp.fly.dev/mcp`. No auth; 120 requests per minute per IP. It serves `main` as
of the last deploy (see `https://delphisci-mcp.fly.dev/healthz`), so unpushed drafts aren't there.

```json
{ "mcpServers": { "delphisci": { "url": "https://delphisci-mcp.fly.dev/mcp" } } }
```

Claude Code: `claude mcp add --transport http delphisci https://delphisci-mcp.fly.dev/mcp`. In
claude.ai or ChatGPT, add it as a custom connector with that URL.

It runs on Fly.io (`fly.toml`, `Dockerfile`) and redeploys from
[`.github/workflows/deploy-mcp.yml`](../.github/workflows/deploy-mcp.yml) whenever `main` changes
the server, `docs/claims.json`, any nanopubs, or the Lean laws (`lean/registry/`, `lean/laws.json`,
`lean/constraints.json`, `lean/Delphi/`). To run the HTTP mode locally:
`DELPHI_HTTP_PORT=8080 node mcp/server.mjs`.

**Without cloning**: any MCP client can run it straight from GitHub. npm fetches the repo at the
given ref and installs only the server, `docs/claims.json`, the unsigned TriG files and the Lean law sources the
`lean_*` tools read (~2 MB packed),
so `local` means "the repo as of that commit".

```json
{
  "mcpServers": {
    "delphisci": { "command": "npx", "args": ["-y", "github:fractastical/delphi"] }
  }
}
```

Pin a tag or commit (`github:fractastical/delphi#v0.3.0`) for reproducible answers; `npx` caches
the package, so pass `--prefer-online` or clear `~/.npm/_npx` to pick up newer data. Claude Code:
`claude mcp add delphisci -- npx -y github:fractastical/delphi`.

**From a clone** (sees your unpushed drafts, reloads when files change):

```bash
npm install
```

**Cursor** picks it up from [`.cursor/mcp.json`](../.cursor/mcp.json) in the repo root. Enable
`delphisci` under Settings → MCP if it isn't already. Other clients: register a stdio server that
runs `node /path/to/delphisci/mcp/server.mjs`, e.g.

```bash
claude mcp add delphisci -- node "$PWD/mcp/server.mjs"
```

**No MCP**: use the CLI from the repo root; it prints JSON.

```bash
node mcp/cli.mjs overview
node mcp/cli.mjs search fixation --math-only
node mcp/cli.mjs claim fisher-kpp-speed
node mcp/cli.mjs rank dataset-resolvability/0.1.0 --limit 10
node mcp/cli.mjs graph --thinker darwin --sort disagreement --limit 5
node mcp/cli.mjs graph --group-by thinker
node mcp/cli.mjs sparql 'SELECT ?c ?m WHERE { GRAPH ?g { ?c skos:notation ?m } }' --source network
```

## Two sources

Every tool except `delphi_graph` takes `source`:

- `local` (default): every TriG file in `*/nanopubs/unsigned/` and `*/nanopubs/*-unsigned/`,
  loaded into an in-memory SPARQL store. Includes drafts and assessments that are not published
  yet. Reloaded automatically when files change. Nanopub IRIs come back as repo file paths.
- `network`: what is actually published, via the Knowledge Pixels query service
  (`https://query.knowledgepixels.com/repo/full`, override with `DELPHI_SPARQL_ENDPOINT`).
  Nanopub IRIs are trusty URIs (`https://w3id.org/np/RA...`).

Use `local` while building; use `network` when citing something or checking what others can see.

## Tools

| Tool | Use it to |
|---|---|
| `delphi_overview` | See what exists: claims per domain, how many have math, which assessment types can be ranked. Call this first. |
| `delphi_search_claims` | Find claims by text (title, statement or LaTeX), domain substring (`math`, `turing`, `darwin`), `mathOnly`. |
| `delphi_get_claim` | Get one claim by short id or IRI: all fields (math, assumptions, proposed test, sources) and every assessment with per-dimension scores. |
| `delphi_rank_claims` | Rank claims by one assessment type. Omit `type` to list the types. |
| `delphi_graph` | The claim graph ([`docs/claim-graph.html`](../docs/claim-graph.html)): filter by thinker, work, year, status, kind, truth; sort by `truth`, `truth-asc`, `disagreement` (max − min p_true across models), `testability` or `year`; or `groupBy` thinker/work/decade/status/kind for counts and means. |
| `delphi_sparql` | Anything else. Read-only `SELECT`; common prefixes are added if the query has none. |
| `lean_laws_list` | The project's versioned Lean laws (physical and biological): `law_id`, version, kind, status, theorem, constraint ids. Filter by `kind`, `status`, `scope`, `lawset`, `text`. |
| `lean_law_get` | One law in full: statement, the Lean source of its theorem and named hypotheses, constraint lemmas, version history, sources, non-vacuity witness, pinned commit and statement hash with a live drift flag. |
| `lean_lawset_get` | A lawset release (`law_id`, version, content hash, pinned status), or `current`. |
| `lean_check` | Evaluate a design (SI units) against a lawset: per-law verdicts (`holds`, `violated`, `cannot-evaluate`, `out-of-scope`, `unknown-lawset`) and violations `{law_id, version, kind, status, inputs, message, binding}`. Floating point, **not a kernel check**. |
| `lean_verify` | Re-hash pinned Lean statements; report drift, missing theorems and a stale `/api/lean/` mirror. |
| `lean_source_status` | Where the laws come from (`local`, `remote:mirror`, `remote:github`; env `LEANBIO_REMOTE`), the current lawset, when it was fetched and last checked, the TTL, 304 counts, integrity, and the last error or rejected (tampered) fetch. `refresh: true` checks now. |
| `lean_changes` | Lawset releases newer than `since_version`, newest first: CHANGELOG prose plus a diff of the pins (laws added or removed, version and status changes). Same feed at `/api/lean/changes.json` and `changes.xml` (Atom). |
| `lean_propose` | **stdio only, never on the hosted server** (runs a Lean build): hand a new statement to `lean/registry/propose.mjs`; returns candidate / contested / rejected, never accepted. |
| `validate_generation` | **The entry point.** Generated organism + base organism + the desired phenotype as text → the five named results, each with its own gate, never summed, plus per-scale coverage and a verdict sentence. See the recipe at the top of this file. |
| `functional_resolution` | The fourth named result on its own: the functional-analogue ledger. Closest analogue chosen by FUNCTION, then every difference classified on the six-rung ladder (SAME → ALLELIC → PARALOGUE → ANALOGOUS_SET → COMPENSATORY → UNRESOLVED). Demonstrated and hypothesised resolutions are never summed. A gate. |
| `physics_check` | The fifth named result on its own: does the design actually DO the thing? Runs the engine's scenarios at every life stage against the desired function; met / not met / **no model** per criterion, the standing physical checks as named checks, a seeded ensemble, and a `model_confidence` on every one. A gate; `draws` is capped at 500 on the hosted server. |
| `validate_design` | The composite report: closest relatives, sanity checks, Lean by component and the score. `swarm: true` adds the sub-tasks. |
| `closest_relative_phenotype` | Nearest real specimens and organisms in a 6-feature body space (FishShapes v1), with an OOD flag whose threshold is calibrated on held-out real specimens. Distance is similarity of shape, never relatedness. |
| `closest_relative_genotype` | Each gene-level edit's edited protein against real orthologues: % identity, closest species, whether the edited state exists in any real organism. A residue is a STATE, not a phenotype. BLAST is forced off here. |
| `sanity_check_design` | Genotype and phenotype sanity checks, each reported as passed / failed / flagged / could-not-run. |
| `lean_by_component` | Lean verdicts grouped by system, part and gene, with accepted-law violations kept apart from candidate and contested ones. |
| `validate_swarm_tasks` | The six validation sub-tasks as JSON `{id, kind, title, tool, args, depends_on, acceptance}`, for a collaborator swarm to claim. |
| `parse_design_text` | A desired-phenotype sentence → the DesignSpec that `physics_check` and `functional_resolution` take as `spec`. Whatever it cannot parse comes back verbatim, because an unparsed requirement is an unchecked requirement. |
| `edit_plan_methods` | How `edit_plan` computes every number and what each number is **not** (on-target scores are a labelled heuristic, off-target counts a floor, HDR rates other papers' loci). Read it before quoting any `edit_plan` number. `edit_plan` itself is stdio-only — see below. |
| `lean_open_questions` | Everything this project holds UNSETTLED, each question with its arms and a computed belief proportion, plus everything it tried and could not establish. |
| `lean_open_question` | One open question, failed theorem or requirement record in full: arms, Lean references, verbatim evidence quotes, what would settle it, and what in the project rests on the answer. |
| `lean_open_question_guard` | Would this statement be refused for asserting one arm of an open question? Ask before writing the Lean, not after. Nothing is written. |
| `edit_plan` | **stdio only, never on the hosted server** — see the reasoning below. |

### What is on the hosted server, and why — decided per tool

The hosted server answers **anonymous** callers, so two rules hold for every tool on it and are enforced
in `mcp/server.mjs`, not merely documented:

- **`network: false` and `blast: false` are forced** whatever the caller sends. The public server makes no
  outbound call on an anonymous caller's behalf and starts no minutes-long NCBI BLAST job. It answers from
  the data shipped in the image/package and the committed caches. A local stdio caller can still turn both
  on.
- **Nothing that runs a Lean build or writes a file is registered at all.** Not hidden behind a flag —
  absent from `tools/list`, so it cannot be called.

That leaves per-tool judgement, which is this:

| Tool | Hosted? | Why |
|---|---|---|
| `validate_generation`, `functional_resolution`, `physics_check`, `validate_design`, `closest_relative_phenotype`, `closest_relative_genotype`, `sanity_check_design`, `lean_by_component`, `validate_swarm_tasks`, `design_score`, `parse_design_text` | **yes** | Read-only, and every file each one touches at run time is shipped (traced, then proved by running the server from an unpacked tarball). The whole point of the exercise: a collaborator with no clone can run a design through the framework. |
| `edit_plan_methods` | **yes** | Static text — the scoring rules, the off-target method, the citations, the falsifier list. No network, no writes. It is also what a caller must read before quoting any `edit_plan` number, so it belongs where the callers are even though `edit_plan` is not. |
| `lean_open_questions`, `lean_open_question`, `lean_open_question_guard` | **yes** | Read-only over `lean/registry/open-questions/`. The guard is what stops a collaborator's automation promoting a statement that settles a question the evidence has not settled, so it has to be reachable by the automation. |
| `edit_plan` | **no — stdio only** | Every call fetches Ensembl REST, Kazusa and the NCBI BLAST URL API on a cache miss, and **writes** a cache (`C:/Temp/editplan-cache`). Nothing is committed, so there is no shipped cache to answer from: with `network: false` forced it would refuse nearly every call, and with network on it would make outbound calls and minutes-long BLAST jobs for anonymous callers. Both outcomes are worse than its absence. Use it from a clone; read `edit_plan_methods` on the hosted server. |
| `lean_propose` | **no — stdio only** | Runs a Lean build on submitted source. |
| `organism_create`, `organism_edit`, `session_open`, `session_post`, `session_decide`, `swarm_post_task`, `swarm_claim`, `swarm_submit`, `swarm_try_edits` | **no** | They write files (organism documents, co-design sessions, the swarm board). The hosted server is read-only. |
| `generate_candidates`, `generative_backends_status` | **no** | They need backend credentials and outbound calls. |
| `design_from_spec`, `optimize` | **no** | They can run the seeded optimiser with a caller-set budget — unbounded CPU for an anonymous caller on a shared host. |
| `leanbio_personas`, `leanbio_use_cases`, `leanbio_grand_questions`, `leanbio_tool_gap` | **could not be exposed** | The four capability-map tools are **named** in `pipeline/leanbio/capability-map/lib.mjs` (`CAPABILITY_TOOL_NAMES`) but no handler module exists for them, and `sim-engine/tools/CAPABILITY-REGISTER.md` / `mcp/CAPABILITY-PATCH.md` never landed. There is nothing to register. Their owning thread has to export a tool table first. |

Counts after this change: **54** tools on the sim-engine server (`sim-engine/contract.json`, contract
`0.8.0`), **34** on the hosted server and **35** over local stdio (`lean_propose` is the difference).

### Lean laws

The `lean_*` tools are the same handlers as our sim-engine MCP server
([`sim-engine/tools/lean-tools.mjs`](../sim-engine/tools/lean-tools.mjs)), reading every law through one
loader, [`lib/lean-source.mjs`](../lib/lean-source.mjs): the registry in `lean/registry/` (one file per
law, lawsets in `lean/registry/lawsets/`), falling back to `lean/laws.json` + `lean/constraints.json`
if the registry is absent. Every result is the provenance envelope `{result, provenance, scope}`; read
`scope` before using a verdict. CLI: `node mcp/cli.mjs laws --kind biological --status accepted`,
`law <law_id>`, `lawset current`, `check design.json --lawset 1.0.0`, `verify`, `propose Law.lean --meta meta.json`
(the same subcommands as `node sim-engine/lean-cli.mjs`). Browsers and anything without a server: the
static mirror `GET /api/lean/{index,current}.json`, `/api/lean/laws/<law_id>.json`,
`/api/lean/lawsets/<version>.json` on the dashboard site.

A new law must be reachable through all of these; `node lean/registry/check-exposed.mjs` fails otherwise
(pre-commit hook in `.githooks/`, CI in `.github/workflows/lean-exposed.yml`). A change under `lean/`
redeploys the hosted server.

**Self-update (0.4.0).** The hosted server reads laws from the published `/api/lean/` mirror by default
(`LEANBIO_REMOTE=mirror`; `github` follows raw `lean/registry/` on `LEANBIO_REF`; `off` uses the files in
the image, which is the default for local stdio use). It re-checks the source every `LEANBIO_TTL_S` (600 s)
with ETag caching, accepts a new lawset only when every law file matches the content hash its lawset pins, and
otherwise keeps the last good set. Every `lean_*` envelope carries `source`, `lawset_version` and
`fetched_at`, and `/healthz` shows them too. The mirror republishes on every `lean/**` change on main
(`.github/workflows/leanbio-publish.yml`; it needs the `CLOUDFLARE_API_TOKEN` repo secret). Details and a recorded
demo: [`lean/registry/SELF-UPDATE.md`](../lean/registry/SELF-UPDATE.md).

### How ranking works

`delphi_rank_claims` takes every top-level assessment of the given type (one with no
`dct:isPartOf`), keeps one overall `delphi:hasScore` per assessor, and returns per claim:

- `score`: mean across assessors;
- `assessors`: how many scored it — use `minAssessors` to drop thinly assessed claims;
- `spread`: highest minus lowest score. A large spread means the assessors disagree, so treat
  the rank as uncertain;
- `verdicts`: count of each `delphi:hasVerdict`.

The rank is computed at query time, never stored, so it stays correct as claims and assessors are
added. Scores are graded judgements in [0, 1], not probabilities.

## Where the data lives

| Kind | Files | Key properties |
|---|---|---|
| Claim | `*/nanopubs/unsigned/*.trig` | `rdfs:label`, `dct:description` (statement), `skos:notation` (LaTeX), `delphi:context` (assumptions, formal status), `delphi:proposedTest` |
| Assessment | `*/nanopubs/assessments-unsigned/*.trig` | `delphi:assessmentType`, `delphi:hasScore`, `delphi:hasVerdict`, `delphi:hasConfidence`, `prov:wasAttributedTo`; dimension scores are child assessments linked by `dct:isPartOf` |
| Rubric | `*/nanopubs/rubric-unsigned/*.trig` | Dimension definitions and anchors |

Each nanopub's domain is `delphi:domain` in its pubinfo graph.

`delphi_graph` reads [`docs/claims.json`](../docs/claims.json), written by
`node docs/build-claim-graph.mjs` from the claim files and `truth/raw/<model>/*.json`. Rebuild it
after adding claims or truth scores; `built` in every response says when it was made.

## What the package must carry

A tool that answers from the working tree and 404s from the package is the failure mode here, and it is
silent: `sim-engine/validate/functional/index.mjs` deliberately never throws, so a missing data file comes
back as `{ran: false, reason}` → a `cannot-assess` gate → an HTTP 200. The first pass of this work shipped
exactly that bug (`omics/genes.json` was not in `files`, so `functional_resolution` returned 2.4 KB from the
package against 130 KB from the tree) and "it answered" did not catch it.

So the check is: trace every file the tools read, add them to `package.json` `files`, `.dockerignore` and the
`deploy-mcp.yml` path filters, then run the server **from an unpacked `npm pack` tarball** and assert on the
*content* of each answer, not on the absence of an exception. The byte sizes from the package must match the
working tree.

One trap the tracing itself sets: an `existsSync` miss looks identical to a read. `getDoc` probes
`sim-engine/sessions/organisms/<id>.json` (a gitignored runtime directory, empty here) before falling
through to the repository bundle, so the trace listed files that are never read and do not exist. Design ids
such as `winged-zebrafish` and `tff` resolve from `anatomy-model/parametric/resolved/*.json`, which was
already shipped. Check a traced path exists before adding it.

```bash
npm pack                                 # 36.1 MB packed, 78.0 MB unpacked, 6 977 files
tar xzf delphisci-mcp-0.7.0.tgz -C /tmp/empty && cd /tmp/empty/package && npm i --omit=dev
node mcp/test-packaged.mjs                 # the whole check, from this copy
```

`node mcp/test-packaged.mjs [dir]` runs every validation tool under the hosted policy and asserts on the
*content* of each answer. Run it in the working tree and then in the unpacked package: the byte counts it
prints must match.

Under ~50 MB packed, so the heavy data (`sim-engine/validate/data/fishshapes-features.json`,
`omics/index/**`, `structures/` is **not** read by any of these tools) stays in the npm package as well as
the Docker image; there was no need to split it and no npx fallback to the static site.

Files added for the validation framework, all traced rather than guessed: `sim-engine/validate/pipeline/**`,
`validate/physics/*.mjs`, `validate/functional/**` (including `data/` and `compensation/`),
`validate/editplan/*.mjs`, the five new `sim-engine/tools/*-tools.mjs`,
`dashboard/public/t/physics/sim/creatures.js` (the physics thread's ensemble distributions),
`sim-engine/validation/studio-results.json` (the independent harness the `model_confidence` is read from),
`physics/glide-data.csv`, `genotype/cache/daane2021_fin_ratios.json`, `sequences/genes.json`, `omics/genes.json`,
`omics/*/MANIFEST.json`, and `lean/registry/open-questions/**`.

## Current gaps

- Truth scores are not nanopubs, so `delphi_graph` has no `network` source and they can't be
  ranked with `delphi_rank_claims`.

- The math-biology claims (`math-bio-theorems/`) have math but no per-claim assessments yet, so
  `delphi_rank_claims` can't rank them. The theorem-readiness top-5 lists in
  `math-bio-theorems/assessments/` rank thinkers, not claims, and aren't nanopubs.
- No assessments are published to the network yet; ranking only works with `source: "local"`.
- Math is one LaTeX string per claim, sometimes mixed with prose, and assumptions are prose
  inside `delphi:context`. Text search works on them; structured filtering doesn't.
- Retracted or superseded nanopubs are not filtered out on the network.
