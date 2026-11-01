# Registering the omics tools in sim-engine/server.mjs (patch for the hub)

`sim-engine/tools/omics-tools.mjs` exports `OMICS_TOOLS`: three tools in the same `{name, title, description,
inputSchema, handler}` shape as `TOOLS` in `server.mjs`. The omics agent does not edit `server.mjs`; apply this.

| tool | input | returns |
|---|---|---|
| `omics_gene` | `{symbol | id, layers?, features?}`: ZFIN symbol, ZDB-GENE id, or human orthologue symbol | the per-gene card: xrefs, per-layer features with entries `{v, n_sources, sources, kind, anatomy, stages, evidence, acc, url}`, per-layer concordance, `conflicts` |
| `omics_part` | `{part_id, layer?, limit?}`: UBERON/CL id (underscore form accepted) | genes with a row anchored at that part, the layers placing them there, per-feature counts, per-layer row totals |
| `omics_search` | `{term, feature?, layer?, limit?}` | matching terms (anatomy labels, GO/Reactome/KEGG/InterPro/DOID ids and labels, phenotype phrases) with layers, features and genes |

Every answer is a provenance envelope (`lib/envelope.mjs`), kind `borrowed` (proxy-species data), with a scope
stating: proxy species, no Aves, absence is not-recorded, concordance is agreement between curations.

Data: `omics/index/` (built by `node omics/build-index.mjs`); if that folder is not deployed, the tools fall back to the
browser bundle `dashboard/public/blueprint3d/omics/` (fewer entries per feature; `omics_search` then unavailable).
Override with `DELPHI_OMICS_INDEX=<dir>`.

Until this is applied, `sim-engine/http.mjs` already serves them as `POST /tool/omics_*` through its `tools/` discovery.

## Patch

```diff
--- a/sim-engine/server.mjs
+++ b/sim-engine/server.mjs
@@
 import { STUDIO_TOOLS } from './tools/studio.mjs';
+import { OMICS_TOOLS } from './tools/omics-tools.mjs';
@@
   ...STUDIO_TOOLS,
+  // Multi-omics: omics_gene, omics_part, omics_search over omics/index (tools/omics-tools.mjs).
+  ...OMICS_TOOLS,
 ];
```

Hosted MCP (`mcp/server.mjs`), if wanted, the same way it imports `LEAN_TOOLS`:

```js
import { OMICS_TOOLS } from "../sim-engine/tools/omics-tools.mjs";
// ...register each { name, title, description, inputSchema, handler } like the lean tools
```

Then regenerate the contract:

```bash
node sim-engine/server.mjs --dump-contract > sim-engine/contract.json
```

Deployment note: the Dockerfile must copy `omics/index/` (31 MB, gzip) or at least
`dashboard/public/blueprint3d/omics/` (15 MB) for the tools to answer.

## Smoke test (run 2026-11-01)

```bash
node -e 'import("./sim-engine/tools/omics-tools.mjs").then(async m=>{console.log((await m.omicsGene({symbol:"KCNK5"})).result.symbol);console.log((await m.omicsPart({part_id:"UBERON_0000151"})).result.n_genes)})'
# kcnk5b
# 3478
```
