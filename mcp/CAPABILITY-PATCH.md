# Patch note: capability-map tools on the delphisci MCP server (for the hub to apply)

`mcp/` is versioned (root `package.json` `version`, `VERSION` in `mcp/server.mjs`, `mcp/CHANGELOG.md`). This note is
the change; it was **not** applied to the server files by the capability-map work, the same way
`mcp/LEANBIO-PATCH.md` was left for the hub.

Handlers: `pipeline/leanbio/capability-map/tools.mjs` (`CAPABILITY_TOOLS`). Same handlers as the sim-engine
registration (`sim-engine/tools/CAPABILITY-REGISTER.md`), so the two servers cannot answer differently.

The four tools are read-only, make **no outbound call**, write nothing, and need no Lean build, so unlike
`leanbio_ground` they need no hosted-mode override and unlike `lean_propose` they are safe on the public server.

## 1. mcp/server.mjs

```diff
@@
 import { LEANBIO_TOOLS } from "../pipeline/leanbio/tools.mjs";
+import { CAPABILITY_TOOLS } from "../pipeline/leanbio/capability-map/tools.mjs";
@@
-export const VERSION = "0.6.0";
+export const VERSION = "0.7.0";
@@
 tool("leanbio_claim", lb.leanbio_claim.description, {
   ...
 });
+
+// The LeanBio capability map (pipeline/leanbio/capability-map/): who could use Lean for Bio, the concrete jobs
+// they would bring, the grand questions split into what a proof can settle and what only measurement can, and the
+// tools that do not exist yet. Read-only, no network, no writes, so these are served in hosted mode unchanged.
+const cap = Object.fromEntries(CAPABILITY_TOOLS.map(t => [t.name, t]));
+tool("leanbio_personas", cap.leanbio_personas.description, {
+  id: z.string().optional().describe("One persona by id, e.g. \"reviewer-editor\""),
+  text: z.string().optional().describe("Only personas whose name, who, today or would_ask mention this text"),
+  needs_tool: z.string().optional().describe("Only personas who need this tool name (real or proposed)"),
+  status: z.enum(["EXISTS", "PARTIAL", "MISSING"]).optional(),
+  brief: z.boolean().default(false).describe("Name, who and tool statuses only"),
+}, args => cap.leanbio_personas.handler(args));
+tool("leanbio_use_cases", cap.leanbio_use_cases.description, {
+  id: z.string().optional(),
+  persona: z.string().optional().describe("Only use cases for this persona id"),
+  answerable: z.enum(["yes", "partly", "no"]).optional(),
+  tool: z.string().optional().describe("Only use cases whose sequence names this tool"),
+  uses_gap: z.string().optional().describe("Only use cases waiting on this tool-gap id"),
+  uncomfortable: z.boolean().optional(),
+  worked_only: z.boolean().default(false),
+  text: z.string().optional(),
+  limit: z.number().int().min(1).max(200).default(50),
+}, args => cap.leanbio_use_cases.handler(args));
+tool("leanbio_grand_questions", cap.leanbio_grand_questions.description, {
+  id: z.string().optional().describe("One question by id, e.g. \"gq-hamiltons-rule\""),
+  disputed: z.boolean().optional().describe("Only the questions the literature actively disagrees about"),
+  has_repo_asset: z.boolean().optional(),
+  core_strength: z.enum(["strong", "moderate", "narrow"]).optional(),
+  section: z.enum(["core", "remainder", "in_repo", "tools", "all"]).default("all"),
+  with_citations: z.boolean().default(true),
+}, args => cap.leanbio_grand_questions.handler(args));
+tool("leanbio_tool_gap", cap.leanbio_tool_gap.description, {
+  id: z.string().optional(),
+  kind: z.enum(["tool", "lean-module", "data", "integration"]).optional(),
+  effort: z.enum(["small", "medium", "large", "research"]).optional(),
+  buildable_now: z.boolean().optional(),
+  unblocks_persona: z.string().optional(),
+  unblocks_question: z.string().optional(),
+  limit: z.number().int().min(1).max(100).default(30),
+  include_not_gaps: z.boolean().default(true),
+}, args => cap.leanbio_tool_gap.handler(args));
```

(`tool(name, description, shape, fn)` is the existing helper that pushes onto `TOOLS`; use it as the `leanbio_*`
tools do.)

## 2. mcp/cli.mjs (optional, for parity)

```diff
+  case "capability": out(await cap.leanbio_personas.handler({ brief: true })); break;
+  case "personas": out(await cap.leanbio_personas.handler({ id: arg(1) })); break;
+  case "use-cases": out(await cap.leanbio_use_cases.handler({ id: arg(1) })); break;
+  case "grand-questions": out(await cap.leanbio_grand_questions.handler({ id: arg(1) })); break;
+  case "tool-gap": out(await cap.leanbio_tool_gap.handler({ limit: Number(arg(1) || 30) })); break;
+  case "leanbio-grand-questions": out(await cap.leanbio_grand_questions.handler({ id: arg(1) })); break;
+  case "leanbio-tool-gap": out(await cap.leanbio_tool_gap.handler({ limit: Number(arg(1) || 30) })); break;
```

Until then the same answers come from `node pipeline/leanbio/capability-map/cli.mjs`, which calls the identical
handlers and adds `--table`.

## 3. Packaging (hosted image and `npx github:` installs)

The hosted server reads the map's JSON from disk, so the files have to be in the package. Add to `package.json`
`files` and, with a leading `!`, to `.dockerignore`:

```
pipeline/leanbio/capability-map/*.json
pipeline/leanbio/capability-map/*.mjs
```

Roughly 400 KB, no dependency beyond `ajv` (already present, and used only by `build.mjs`, not by `tools.mjs`).
`tools.mjs` imports only `node:fs`, `node:path`, `node:url` and the folder's own `lib.mjs`, so the tools load in a
minimal install even if `build.mjs` cannot.

## 4. What changes for callers

Nothing existing. Four names are added; no tool is renamed or removed, and no envelope changes shape. The map's own
test resolves tool names from `sim-engine/contract.json`, `mcp/server.mjs` and the map's own export, so it keeps
passing before and after this patch; after it lands, re-run
`node pipeline/leanbio/capability-map/build.mjs`, because the number of real tools is one of the figures the map
reports about itself.

## 5. A caveat worth carrying into the server's own docs

`leanbio_grand_questions` is the one tool here that could be badly misread. Its whole point is the split between
what a proof settles and what only measurement can, and every record carries it: `formalisable_core` is about
premises, `empirical_remainder` is about the world, and `the_line` at the top of every response says so. A client
that renders only the core half would turn a map of what is formalisable into a claim about what is known. The
`scope` string on the envelope states this; keep it visible.
