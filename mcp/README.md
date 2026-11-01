# delphisci MCP server

Query this repo's claims — their statements, their math, how assessors ranked them, and the claim
graph's model truth scores — from any agent, without writing SPARQL. Available as an MCP server
(`server.mjs`) and as a CLI (`cli.mjs`) with the same queries.

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
| `lean_check` | Evaluate a design (SI units) against a lawset: per-law verdicts and violations `{law_id, version, kind, status, inputs, message, binding}`. Floating point, **not a kernel check**. |
| `lean_verify` | Re-hash pinned Lean statements; report drift, missing theorems and a stale `/api/lean/` mirror. |
| `lean_propose` | **stdio only, never on the hosted server** (runs a Lean build): hand a new statement to `lean/registry/propose.mjs`; returns candidate / contested / rejected, never accepted. |

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
