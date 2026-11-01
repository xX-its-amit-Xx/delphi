# Registering the open-question tools (patch for the hub)

`lean/registry/open-questions/openq-tools.mjs` exports `OPENQ_TOOLS`: three tools in the same
`{name, title, description, inputSchema, handler}` shape as `TOOLS` in `sim-engine/server.mjs` and `LEAN_TOOLS`
in `tools/lean-tools.mjs`. The open-questions work does not edit `server.mjs`, `http.mjs` or `mcp/server.mjs`;
apply the patches below.

| tool | what it returns | network |
|---|---|---|
| `lean_open_questions` | every open question with its arms and its COMPUTED belief proportion, plus the failed theorems and the `candidate-with-requirements` records. Filter by `status`, `formalised`, `touches` (a law_id, constraint, design property or scenario key) or `text` | none |
| `lean_open_question` | one full record: every arm's evidence with VERBATIM quotes and locators, its Lean reference where formalised, its belief and the breakdown behind it, whether the arms actually contradict, what would settle the question and whether that is feasible today, and what in the project rests on the answer. `recompute: true` returns a freshly computed proportion alongside the stored one, so a caller can VERIFY the number rather than trust it | none |
| `lean_open_question_guard` | would a proposed law be refused for asserting an open arm? Returns the arms it would be found to assert and the full refusal text. **Ask this before writing the Lean, not after** | none |

All three are read-only (nothing is written) and return the provenance envelope `{result, provenance, scope}`.

## Why these belong next to `lean_laws_list`

An agent that can only ask what is PROVED will treat silence as the absence of a problem. A law set says what
this project holds proved; these tools say what it holds unsettled, and what it tried and could not establish.
The same rule applies to both: get them from the API, never from a list you copied.

## Patch: sim-engine/server.mjs

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { LEAN_TOOLS } from './tools/lean-tools.mjs';
+import { OPENQ_TOOLS } from '../lean/registry/open-questions/openq-tools.mjs';
 import { STUDIO_TOOLS } from './tools/studio.mjs';

 export const TOOLS = [
@@
   ...LEAN_TOOLS,
+  // Open questions, failed theorems and requirement records: what the project holds UNSETTLED, and what it
+  // tried and could not establish (lean/registry/open-questions/openq-tools.mjs).
+  ...OPENQ_TOOLS,
   // Design Studio: organism documents, STATE, scenarios, optimisation, co-design sessions (tools/studio.mjs).
   ...STUDIO_TOOLS,
 ];
```

Then regenerate the contract (tool names changed) and re-run the checks:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
node lean/registry/check-exposed.mjs
node lean/registry/open-questions/test.mjs
```

and bump `contract_version` (minor: tools added) with a `sim-engine/CHANGELOG.md` entry.

`sim-engine/http.mjs` serves whatever `TOOLS` holds as `POST /tool/<name>`, so the three tools are on the HTTP
bridge once `server.mjs` carries them. They are deliberately NOT placed in `sim-engine/tools/`, so http.mjs's
directory discovery does not serve them before the hub decides to.

## Patch: the two shared CLIs (optional; a working CLI already exists)

`lean/registry/open-questions/cli.mjs` is complete and runs over the same handlers, so nothing is blocked on
these. Add the subcommands to the shared CLIs when convenient:

```diff
--- a/mcp/cli.mjs
+++ b/mcp/cli.mjs
@@
+  // open questions: what the project holds unsettled
+  if (cmd === 'open-questions') return out(await (await import('../lean/registry/open-questions/openq-tools.mjs')).openQuestionsList(flags));
+  if (cmd === 'open-question') return out(await (await import('../lean/registry/open-questions/openq-tools.mjs')).openQuestionGet({ id: args[0], recompute: flags.recompute }));
```

```diff
--- a/sim-engine/lean-cli.mjs
+++ b/sim-engine/lean-cli.mjs
@@
+  if (cmd === 'open-questions') return show(await (await import('../lean/registry/open-questions/openq-tools.mjs')).openQuestionsList(args));
+  if (cmd === 'open-question') return show(await (await import('../lean/registry/open-questions/openq-tools.mjs')).openQuestionGet({ id: args._[0] }));
```

## Patch: mcp/server.mjs (hosted delphisci server)

The hosted image needs the zod shapes plus `lean/registry/open-questions/**` in the `package.json` `files` list
and un-ignored in `.dockerignore` (the records are JSON data the tools read at runtime, so the folder must ship):

```diff
+ "lean/registry/open-questions/**",
```

```diff
+ !lean/registry/open-questions
+ !lean/registry/open-questions/**
```

Zod shapes, mirroring the `inputSchema`s in `openq-tools.mjs`:

```js
lean_open_questions: {
  status: z.union([z.enum(['open', 'settled', 'abandoned']), z.array(z.enum(['open', 'settled', 'abandoned']))]).optional(),
  formalised: z.boolean().optional(),
  touches: z.string().optional(),
  text: z.string().optional(),
  include_failed: z.boolean().optional(),
},
lean_open_question: { id: z.string(), recompute: z.boolean().optional() },
lean_open_question_guard: {
  law_id: z.string().optional(),
  statement_en: z.string(),
  lean_theorem: z.string().optional(),
  lean_structure: z.string().optional(),
  hypotheses: z.array(z.object({}).passthrough()).optional(),
  atoms: z.array(z.string()).optional(),
  taxa: z.array(z.string()).optional(),
},
```

Bump the hosted server's version with its own changelog entry.

## Already done here, so the hub does not have to

- `dashboard/build-lean-api.mjs` writes the static mirror (`/api/lean/open-questions.json`,
  `open-questions/<id>.json`, `failed-theorems/<id>.json`, `requirements/<id>.json`) and its `--check` covers it.
- `lean/registry/check-exposed.mjs` runs the guard over every accepted and candidate law, validates every
  record, checks for drift against `pipeline/leanbio/debate/open-disputes.json` and against the pinned Lean
  statements, and fails if the mirror is missing a question. Verified to fail on a planted law that asserts an
  open arm, then to pass once it was removed.
- `lean/registry/propose.mjs` applies the same guard at proposal time (step `g`): a proposal asserting an open
  arm comes out `contested`, never `candidate`, with the question id and the arms recorded on the law.

## Not done here, on purpose

- No edit to `server.mjs`, `http.mjs`, `mcp/server.mjs`, `package.json`, `.dockerignore`, `mcp/cli.mjs` or
  `sim-engine/lean-cli.mjs`: those are applied by the hub or their owning thread.
- No contract regeneration: `contract.json` changes only when the patch lands.
