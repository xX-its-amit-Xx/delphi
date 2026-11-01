# Wiring the multi-omics card into Perturb mode (patch for the hub; the omics agent did not edit perturb.js)

Module: `dashboard/public/blueprint3d/omics-card.js` (no dependencies, injects its own scoped CSS using the page's
`--line --panel --soft --mute --accent --ok --warn --bad` variables, so light and dark themes both work).

```js
export async function renderOmics(el, symbolOrZfinIdOrHumanSymbol)  // five collapsible layers + conflicts
export async function omicsGenesAt(partId)                           // [{symbol, layers}] for a UBERON/CL part
```

It fetches `blueprint3d/omics/index.json` once, then `omics/genes/<file>.json.gz` per gene (cached). The `.gz` files are
gunzipped in the browser with `DecompressionStream`. If the server sends them with `Content-Encoding: gzip`, the bytes
arrive already decoded and are parsed as-is. Either way works, and the bytes are checked for the gzip magic number.
Tested in headless Chrome 2026-11-01 (kcnk5b card, an unknown symbol, and `omicsGenesAt('UBERON_0000151')`).

## Patch to `dashboard/public/blueprint3d/perturb.js`

1. Import (next to the other imports, around line 17):

```diff
 import { normaliseChains, ladderHtml as chainLadderHtml, gradeChip, GRADE_ORDER } from './chains.js';
+import { renderOmics } from './omics-card.js';
```

2. In `geneCard(sym, node)`, add a slot just before the house-rule / gene-level-edit block (the line that starts
   `const mine = ((S.doc && S.doc.edits) || []).filter(e => engLevel(e.target.level) === 'gene' ...`):

```diff
+    // multi-omics (omics-card.js fills it after innerHTML is set; see renderGeno)
+    h += `<div id="ptOmics" data-omics-sym="${esc(sym)}"></div>`;
     // gene-level edits: recorded in the organism document, never propagated
     const mine = ((S.doc && S.doc.edits) || []).filter(e => engLevel(e.target.level) === 'gene' && e.target.id === sym);
```

3. In `renderGeno()`, right after `el.innerHTML = h;`:

```diff
     el.innerHTML = h;
+    const om = $('ptOmics'); if (om) renderOmics(om, om.dataset.omicsSym);
```

That's all that's needed. Optional: add a per-part badge listing the genes that omics records at the selected part, without
waiting for the vetted map:

```js
import { omicsGenesAt } from './omics-card.js';
const list = await omicsGenesAt(node);   // node = UBERON:… / CL:… (underscore form accepted)
```

`parts.json` covers the 70 blueprint parts that have at least one omics row anchored directly on them (no propagation
from sub-parts). Each part lists up to 400 genes, ordered by how many layers place the gene there.

## What the card shows

- Header: ZFIN / Ensembl / NCBI / UniProt (reviewed or not) / human orthologue / flying-fish protein (8 focal genes only).
- One `<details>` per layer (genomic, transcriptomic, proteomic, pathway, PTM). Each has its row count, sources, and
  "k of n facts stated by ≥2 sources". Inside, one `<details>` per feature. Designer-relevant features come first:
  allele_phenotype, disease_model, expressed_in…
- Each entry has: the value, its anatomy (● = a blueprint part, with the UBERON id), stages, a kind badge
  (M measured · C curated · E electronic · P predicted · B borrowed from the human orthologue), `n×` = the number of
  independent databases agreeing, and a source link.
- A conflicts box: single-valued features that disagree, expressed vs not-expressed at one anatomy, and human
  orthologues called by only one of ZFIN and Alliance.
- The bundle holds 6 entries per feature. The full card (25 per feature) is served by the `omics_gene` MCP tool.
