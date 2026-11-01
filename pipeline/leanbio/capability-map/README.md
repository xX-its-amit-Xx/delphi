# LeanBio capability map

Who could use Lean for Bio, what they could ask it, which of the grand questions of biology it could settle any
part of, and which tools do not exist yet. Four enumerations as versioned JSON with one JSON Schema, served over
MCP, a CLI and the static API, and checked by tests that each fail once on broken input.

**The JSON is the deliverable.** This file says how to read it and how to change it; it restates none of it.

| file | what |
|---|---|
| `capability-map.schema.json` | JSON Schema (draft 2020-12) for all five documents; `kind` selects the branch |
| `personas.json` | 14 personas: who they are, what they do today, what they would ask, the tools they need |
| `use-cases.json` | 32 jobs: the question, the tool sequence today, what is missing, a worked example, the honest limit |
| `grand-questions.json` | 14 grand questions, each split into the formalisable core and the empirical remainder |
| `tool-gap.json` | 27 gaps, deduplicated, plus the things deliberately absent |
| `citations.json` | 58 citations, every one fetched from Europe PMC or Crossref |
| `lib.mjs` | loading, the real-tool universe, and every derived field |
| `tools.mjs` | the four MCP tools (`LEANBIO_CAPABILITY_TOOLS` is `CAPABILITY_TOOLS`) |
| `cli.mjs` | the same handlers as a CLI; `--table` for the human view |
| `build.mjs` | validate, then write `out/`, the page data and the static-mirror files |
| `test.mjs` | the tests; every check also fails once on deliberately broken input |

```bash
node pipeline/leanbio/capability-map/build.mjs              # validate, then write the derived outputs
node pipeline/leanbio/capability-map/build.mjs --check       # validate only; non-zero if anything is stale
node pipeline/leanbio/capability-map/test.mjs                # the tests
node pipeline/leanbio/capability-map/cli.mjs overview --table
node pipeline/leanbio/capability-map/cli.mjs grand-questions --id gq-hamiltons-rule --table
node pipeline/leanbio/capability-map/cli.mjs tool-gap --kind lean-module --table
```

## The line the whole document depends on

Lean proves that a conclusion follows from stated premises. It does not adjudicate reality. So a grand question
has a **formalisable core** exactly to the extent that part of the disagreement about it is a disagreement about
what follows from what, and an **empirical remainder** exactly to the extent that it is a disagreement about what
the world is like. Most of these questions are mostly remainder, and `grand-questions.json` says so per question,
item by item, with why no proof reaches each one. A map that let the first kind of progress be read as the second
would be worse than no map. `cli.mjs line` prints the full statement.

## What is hand-written and what is derived

Hand-written, because it is judgement: the personas, the use-case routes, the formalisable/empirical split, the
PARTIAL notes, the effort estimates and the risk notes. **Derived by `build.mjs`, and never hand-edited:**

- the **tool universe** the `EXISTS` and `PARTIAL` marks are checked against, read from `sim-engine/contract.json`,
  `mcp/server.mjs` and this folder's own tool export. A tool name cannot be invented, and a name marked `MISSING`
  that turns out to exist is a test failure;
- `answerable_today` on each use case, from its step statuses. The atomic judgement is per step
  (`load_bearing` on a `MISSING` step: without it the route cannot be walked at all), so the row-level verdict is
  a check on the steps rather than a separate assertion;
- `unblocks` and `rank` on each gap, counted from all three enumerations: one point per distinct persona, use case
  and grand question that names it, plus one more for each use case that cannot be answered at all without it,
  ties broken by effort, cheaper first. **A gap cannot promote itself**, and a test tampers with a stored rank to
  prove it.

## Changing it

1. Edit the JSON. Keep the status vocabulary: `EXISTS` (real and sufficient), `PARTIAL` (real, and `note` says what
   it does NOT do), `MISSING` (a proposal, with `gap_id`, and the name must be a gap's `name`).
2. `node pipeline/leanbio/capability-map/build.mjs` — it refuses to write if anything fails.
3. `node pipeline/leanbio/capability-map/test.mjs` and `node dashboard/build-lean-api.mjs`.

What the tests enforce, beyond the schema: every use-case step names a real tool or is explicitly `MISSING`; every
grand question states both halves, or states that it has none and why; no persona has an empty tool list, and no
persona is unreachable from any use case; every Lean declaration claimed as `proved-here` is really declared in
the module it names; every gap carries a signature, what it would read, its buildability and a risk note; a gap
nothing asks for is refused; and a citation claiming verification with no identifier is refused.

A citation is only added after being **fetched**. `verified_via` says how, `quotable` is text actually seen in the
fetched record, and six entries are books verified through monograph or reprint DOIs and flagged `is_book`.

## Served

MCP (`tools.mjs`), read-only, no network call, each returning `{result, provenance, scope}`:
`leanbio_personas`, `leanbio_use_cases`, `leanbio_grand_questions`, `leanbio_tool_gap`.
Registration is a patch for the hub to apply, as the rest of this pipeline's tools were:
[`sim-engine/tools/CAPABILITY-REGISTER.md`](../../../sim-engine/tools/CAPABILITY-REGISTER.md) and
[`mcp/CAPABILITY-PATCH.md`](../../../mcp/CAPABILITY-PATCH.md). **No server file was edited here.** Until the hub
applies them, `cli.mjs` and the static mirror serve the same answers from the same handlers.

Static API, built by `dashboard/build-lean-api.mjs` (optional import, so the mirror still builds without this
folder): `/api/lean/capability/{index,personas,use-cases,grand-questions,tool-gap,citations,schema}.json` and
`/api/lean/capability/grand-questions/<id>.json`.

Page: [`/leanbio/capability.html`](../../../dashboard/public/leanbio/capability.html), reading
`dashboard/public/leanbio/capability.json`. Every number on the page comes from that file, and a test fails if it
is stale.

## Where this joins the rest of the repo

- `lean/registry/` is what the project holds **proved**; `lean/registry/open-questions/` (another thread) is what
  it holds **unsettled**, as 7 first-class questions with Lean-formalised arms; this map is **who could use either,
  for what, and what is missing**. They are three different documents and the gap list says so: the
  `open-questions-list` gap is about the 215-problem literature enumeration in `open-problems/`, which no tool
  serves, and not about the open-questions registry, which `lean_open_questions` serves well.
- `pipeline/leanbio/` supplies the claims, groundings and belief scores the use cases route through.
- `open-problems/problems.json` supplies the `open_problem_ids` join on each grand question. Several grand
  questions have **no** counterpart there, which is a gap in that enumeration and not evidence the question is
  settled.

## What this document is not

A self-assessment, not a measurement. Nobody in the persona list has been interviewed. Only the rows with a
`worked_example` have been run; the rest are routes. The `EXISTS` marks say a tool of that name is callable and
relevant, never that it answers the question well. Nothing here is costed, scheduled or assigned, and nothing
about the held-out exam clade appears anywhere in it.
