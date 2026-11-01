# Patch note: LeanBio tools on the delphisci MCP server (for the hub to apply)

`mcp/` is versioned (root `package.json` `version`, `VERSION` in `mcp/server.mjs`, `mcp/CHANGELOG.md`). This note is the
change; it was not applied to the server files by the LeanBio work.

Handlers: `pipeline/leanbio/tools.mjs` (`LEANBIO_TOOLS`). Same handlers as the sim-engine registration
(`sim-engine/tools/LEANBIO-REGISTER.md`).

## 1. mcp/server.mjs

```diff
@@
 import { LEAN_TOOLS } from "../sim-engine/tools/lean-tools.mjs";
+import { LEANBIO_TOOLS } from "../pipeline/leanbio/tools.mjs";
@@
-export const VERSION = "0.4.0";
+export const VERSION = "0.5.0";
@@
 if (!HOSTED) leanTool("lean_propose", {
   ...
 });
+
+// LeanBio: the formalization queue, grounding, and per-claim records (pipeline/leanbio/). Read-only; leanbio_ground
+// calls Gilda / MyGene.info / OLS4 on a cache miss unless offline is set. In hosted mode it is forced offline so the
+// public server makes no outbound calls on behalf of anonymous clients and never writes the cache.
+const lb = Object.fromEntries(LEANBIO_TOOLS.map(t => [t.name, t]));
+tool("leanbio_queue", lb.leanbio_queue.description, {
+  limit: z.number().int().min(1).max(500).default(20),
+  min_belief: z.number().min(0).max(1).optional().describe("Only items at or above this belief"),
+  relation: z.string().optional().describe("Relation type, e.g. ScalingLaw, Bound, Equality, Dynamics, Inhibition"),
+  origin: z.enum(["claim", "draft"]).optional(),
+}, args => lb.leanbio_queue.handler(args));
+tool("leanbio_ground", lb.leanbio_ground.description, {
+  text: z.string().optional().describe("Free text to annotate"),
+  entity: z.string().optional().describe("One entity name or identifier, instead of text"),
+  kind: z.enum(["any", "gene", "taxon"]).default("any"),
+  context: z.string().optional().describe("Context for an entity, e.g. \"zebrafish\""),
+  offline: z.boolean().default(false).describe("Answer from the cache only"),
+}, args => lb.leanbio_ground.handler({ ...args, offline: HOSTED ? true : args.offline }));
+tool("leanbio_claim", lb.leanbio_claim.description, {
+  id: z.string().describe("Claim id (docs/claims.json), e.g. \"maynardsmith-hitchhiking\", or \"draft:<repo path>\""),
+  draft: z.boolean().default(true).describe("Include the unsigned nanopub draft (TriG)"),
+}, args => lb.leanbio_claim.handler(args));
```

(`tool(name, description, shape, fn)` is the existing helper that pushes onto `TOOLS`; use it as the `lean_*` tools do.)

## 2. mcp/cli.mjs (optional, for parity with the lean_* subcommands)

```diff
+  case "leanbio-queue": out(await lb.leanbio_queue.handler({ limit: Number(arg(1) || 20) })); break;
+  case "leanbio-ground": out(await lb.leanbio_ground.handler({ text: args.slice(1).join(" ") })); break;
+  case "leanbio-claim": out(await lb.leanbio_claim.handler({ id: arg(1) })); break;
```

Until then the same answers come from `node pipeline/leanbio/ground.mjs`, `out/queue.json` and `draft.mjs`.

## 3. Packaging (hosted image and `npx github:` installs)

Add to `package.json` `files` and, with a leading `!`, to `.dockerignore`:

```
pipeline/leanbio/*.mjs
pipeline/leanbio/*.json
pipeline/leanbio/out/queue.json
pipeline/leanbio/out/records.json
pipeline/leanbio/cache/*.json
holdout/exam.json
holdout/split.json
organisms/merged/taxa.json
```

`holdout/exam.json` and `split.json` are needed because the held-out guard reads the roster at run time (it names no
organism itself) and `leanbio_ground` refuses to send held-out text anywhere. They hold names and identifiers, no
measurements (`holdout/README.md`). `organisms/merged/taxa.json` is the taxon inventory used for grounding.
Add the same paths to `deploy-mcp.yml`'s redeploy triggers.

## 4. CHANGELOG entry

```
## 0.5.0 (2026-11-01)

- Added the LeanBio tools: `leanbio_queue` (formalization candidates ordered by belief), `leanbio_ground` (text or
  entity -> ontology groundings via Gilda, MyGene.info, OLS4 and the repo inventory; forced offline/cache-only in hosted
  mode), `leanbio_claim` (groundings, INDRA-style statement, belief breakdown, linked laws and an unsigned nanopub draft
  for one claim). Handlers in `pipeline/leanbio/tools.mjs`; the pipeline is documented in `pipeline/leanbio/README.md`.
```

## 5. Check after applying

```bash
node pipeline/leanbio/test.mjs
node lean/registry/check-exposed.mjs
DELPHI_HTTP_PORT= node mcp/server.mjs   # stdio: tools/list shows leanbio_queue, leanbio_ground, leanbio_claim
```
