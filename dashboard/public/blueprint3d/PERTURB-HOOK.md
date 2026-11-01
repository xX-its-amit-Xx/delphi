# Perturb mode: the hook into explode.html

`perturb.js` is a self-contained module. explode.html needs **seven small edits** to offer it as a mode. They are
written as exact find / replace pairs (string anchors, not line numbers, because explode.html is still being edited).
Each `find` string occurs exactly once in explode.html as of 2026-10-31 23:00. The pairs were applied to a copy of
explode.html and tested headless (selection, edits, red glow, timecourse, optimiser, no console errors). The real
file was not touched.

Files the mode uses (all in `dashboard/public/blueprint3d/`):

| file | role |
|---|---|
| `perturb.js` | the mode: `mountPerturb(host)` plus pure helpers (no top-level DOM access) |
| `perturb-worker.js` | the optimiser, a module Web Worker that imports `perturb.js` |
| `engine/` | sim-engine, copied by `node dashboard/build-engine.mjs` (organism.mjs, state.mjs, scenarios/, data/bundle.json) |
| `lean-client.js` → `/api/lean/` | law metadata, lawset versions and statuses, and `checkState` |
| `browser-check.mjs` | fallback verdicts only, used when the law API is unavailable (the panel says so) |
| `partedit.js` | geometry edits written into the vertices, with the containment check |
| `spec-box.js` | "type the functional criteria" box at the top of the panel (optional: skipped if absent) |
| `design.js` | `piecesFor` (Lean grounding → parts), `AIRSPEED`: the Design Studio's own rules |
| `perturb.html` | standalone harness (one GLB, the real engine, or `?engine=mock`) |

## The edits

**1. The module import**: after the genotype import.

```
find:    import * as GB from './genotype.js';
replace: import * as GB from './genotype.js';
import { mountPerturb } from './perturb.js';
```

**2. The mode option**: last entry of `#modeSel`.

```
find:    <option value="growth">Growth</option></select>
replace: <option value="growth">Growth</option><option value="perturb" title="Select a part, edit it, perturb it, read every stage, optimise">Perturb &amp; optimise</option></select>
```

**3. Module state**: on the line that declares `design`.

```
find:    let design=null,baseDesign=null,
replace: let perturb=null;const perturbSel=new Set();
let design=null,baseDesign=null,
```

**4. Selection**: while Perturb is open, a click selects the part and tells the module. It does not open the
anatomy panel.

```
find:    function selectObj(name){const o=objs.find(x=>x.name===name);if(!o)return;state.obj=name;
replace: function selectObj(name){const o=objs.find(x=>x.name===name);if(!o)return;state.obj=name;if(state.mode==='perturb'&&perturb){applyState();for(const f of perturbSel)f(o);return;}
```

**5. setMode**: unmount when leaving, mount when entering.

```
find:    function setMode(m){state.mode=m;$('#modeSel').value=m;
replace: function setMode(m){state.mode=m;$('#modeSel').value=m;if(perturb&&m!=='perturb'){perturb.unmount();perturb=null;}
```

```
find:    if(m==='genotype'){openGenotype();crumbs();return;}
replace: if(m==='perturb'){openPerturb();crumbs();return;}
  if(m==='genotype'){openGenotype();crumbs();return;}
function openPerturb(){if(perturb)perturb.unmount();
  perturb=mountPerturb({THREE,scene,camera,renderer,root,meshes:()=>objs,get manifest(){return MF;},get species(){return modelKey;},
    panelEl:$('#panel'),esc,data:D,getSelection:()=>state.obj?objs.find(o=>o.name===state.obj)||null:null,
    onSelect:cb=>{perturbSel.add(cb);return()=>perturbSel.delete(cb);},codesignUrl:params.get('codesign')||null});}
```

(`openPerturb` is a function declaration placed inside `setMode` after the `return`. It is hoisted within
`setMode`, and only `setMode` calls it. If the hub prefers it at top level, move the three `function openPerturb`
lines next to `openGrowth`; nothing else changes.)

**6. Deep link**: allow `?mode=perturb`.

```
find:    ['physiology','tissue','cell','physics','design','growth','compare','sequences','genotype'].includes(mode)
replace: ['physiology','tissue','cell','physics','design','growth','compare','sequences','genotype','perturb'].includes(mode)
```

**7. Breadcrumb label**:

```
find:    growth:'growth',genotype:'genotype browser'}
replace: growth:'growth',genotype:'genotype browser',perturb:'perturb & optimise'}
```

Model switching needs no extra edit. `switchModel` calls `setMode(state.mode)`, which remounts the module on the new
model. The module reads `MF` and `modelKey` through the getters above.

## Host interface (`mountPerturb(host)`)

| field | explode.html value | used for |
|---|---|---|
| `THREE` | the page's `three` import | colours for the glow |
| `scene`, `camera`, `renderer` | the page's own | passed through; the module adds nothing to the scene |
| `root` | `root` (the model group) | `partedit.applyEdits(root, …)`; stage scaling for GLBs without morph targets |
| `meshes()` | `objs` (`{name, mesh, m, group, side}`) | part lookup, glow, morph targets |
| `manifest` | `MF` (raw manifest) | parameters, `morph_targets`, `parents`, partedit |
| `species` | `modelKey` | engine organism id, law-scope taxon |
| `getSelection()` / `onSelect(cb)` | `state.obj`, the `perturbSel` set | the selected part |
| `panelEl` | `#panel` | everything renders here |
| `esc` | the page's escaper | |
| `data` | `D` (data.json) | tissues, cells, genes, Lean grounding |
| `codesignUrl` | `?codesign=` | the MCP server's co-design session export (opt-in) |
| `engineUrls` | (omit) | overrides discovery of `./engine/`; the harness uses it for its mock |
| `lawClientUrl`, `checkerUrl` | (omit) | override `./lean-client.js` and `./browser-check.mjs` |

The return value is `{ unmount(), refresh(), select(obj), doc, state }`. `unmount()` stops the glow loop, terminates
the worker, restores partedit vertices (`resetEdits`), clears morph influences and resets `root.scale`.

## What the mode shows, and the colour rules

- **Selection**: breadcrumb body › organ system › organ › tissue › cell (tissue and cell from data.json), and the
  genes recorded at the node. Editable parameters come from the engine (`organism.mjs editableParams`), each with its
  kind badge and effect: `parameter`, `state`, `geometry` or `recorded only`. Every edit needs a reason. The author
  is a role label (`human`, `agent:optimiser`, `agent:spec-box`). Edits are listed with author and reason, with undo.
- **Perturbation**: scenarios grouped environment / behaviour / physiology. Each parameter is a slider with its unit
  and a source tooltip. A model-card drawer lists equations, sources, validated-against and validity.
- **Results**: every metric carries a kind badge. `assumed` is dashed and striped. A null value reads "no value".
  `validity.inRange === false` greys the whole result and shows its note; that is grey, not red. `survives === false`
  is red.
- **Laws**: "judged against law set vX.Y.Z", with a picker when the API lists more than one set. Red means an
  **accepted** law that the design newly violates. A muted red outline tagged "inherited from base" means the unedited
  base organism breaks the law too, at the same age and conditions; these do not glow. Amber means contested.
  Dashed means candidate or proposed. Grey, in a collapsed list, means cannot evaluate or out of scope. Each
  violation names its constraint, theorem, module, whether it is a physical law (Lean) or a biological law (Lean bio),
  and the numbers that broke it. Its law entry (statement, version, sources) comes from `lean-client.getLaw`. Without
  the API the panel says "Law API unavailable" and shows verdicts only.
- **Mesh glow**: the Design Studio's scheme (`--bad` red pulse, `--warn` amber). A violation glows the parts it
  depends on: the record's `parts`, else the Lean grounding (`design.js piecesFor`), else the engine's `INPUT_PARTS`,
  else the edited parts. When none of these map, the whole body glows. A partedit containment refusal glows its part
  red and is listed as a physical (geometry) violation.
- **Development**: the chosen metric at every stage (`state.stageAges`), with survive/fail bands, red triangles where
  a law is newly violated, a crosshair tooltip, small multiples of every metric and a table view. The stage
  scrubber sets the GLB's morph target (`stage_XXXd`), or scales `root` when the GLB has no morph targets.
- **Optimise**: an objective metric (direction from `better`) and the edited parameters that may vary, with bounds.
  A seeded search runs in `perturb-worker.js`. The panel shows the trace (best so far, feasible dots, red crosses for
  rejects), the best design with "apply best as edits", and the rejected candidates with the law each broke. By
  default only a new violation of an accepted law rejects a candidate; "strict" also rejects inherited ones. A
  candidate the engine refuses (for example a factor outside partedit's bounds) is listed as refused.
- **Spec box**: `spec-box.js` mounts at the top. "Use this spec" picks the first soft criterion's scenario and metric
  and turns `editable` entries into varied edits with their bounds. It lists every other criterion as not enforced
  by the in-browser search.
- **Co-design log**: posts from the session export (`{session, posts:[{role, label, kind, text, at}]}`). Role labels
  only; anything shaped like an e-mail address is stripped. Humans can post. Posts are kept in localStorage (wrapped
  in try/catch) and included in "download session JSON".
