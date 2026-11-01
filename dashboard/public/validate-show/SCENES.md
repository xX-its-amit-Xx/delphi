# SCENES.md — the scene interface for `validate-show/`

**Owner of this file and of the stage:** the validate-show thread (acts 1, 2, 3, 6, 7 and the
composition). **Consumers:** `molecular.js` (act 4) and `networks.js` (act 5), each owned by a
sibling thread. This file is the contract. It is frozen in the sense that the *signature* below
will not change under you; if it must, the hub gets a message and this file gets a dated note at
the bottom.

Status: **v1, 2026-11-01.** Written before the scenes, so you can code to it.

---

## 1. The signature

Your module is an ES module at `dashboard/public/validate-show/molecular.js` (or `networks.js`).
It has **one required named export**:

```js
export function mountScene({ container, THREE, data, act, theme, reducedMotion, onReady, onNote }) {
  // ... build into container ...
  return {
    duration,            // number, seconds. REQUIRED. The stage's timeline is built from this.
    play(t),             // called to start/resume playing from local time t (seconds)
    pause(),             // called to stop advancing. Must be idempotent.
    seek(t),             // called with local time t (seconds, 0..duration). Must render that
                         //   instant WITHOUT animating to it. Called while paused, and on scrub.
    dispose(),           // tear down: cancel rAF, free geometries/materials/renderers, remove
                         //   listeners. Called when the act unmounts. Must be idempotent.
    resize(),            // OPTIONAL. Called on container resize / orientation change.
    setTheme(theme),     // OPTIONAL. 'light' | 'dark'. Called when the stage theme flips.
    chapters,            // OPTIONAL. [{t, label}] — sub-beats inside your act. The stage draws
                         //   these as ticks on the timeline and as jump targets. Keep to <= 6.
    provenance,          // STRONGLY REQUESTED. See §4. The stage renders it in the act's
                         //   provenance rail if you supply it.
  };
}
```

`mountScene` **may be async** (return a Promise of the object above) — the stage awaits it and
shows a loading state. If you need to load a `.glb`/`.pdb`/JSON, do it there.

### The rules the stage relies on

1. **`seek(t)` is authoritative and must be pure in `t`.** Scrubbing backwards must show the same
   frame as scrubbing forwards to the same `t`. Do not integrate anything per-frame that you
   cannot reconstruct from `t` alone; precompute into an array and interpolate, the way
   `t/physics/sim/scene3d.js` does. The stage *will* scrub you backwards in testing.
2. **You never call `requestAnimationFrame` while paused.** The stage pauses you when the act is
   off-screen or the tab is hidden; a scene that keeps a rAF alive after `pause()` is a bug.
3. **You own only `container`.** Do not touch `document.body`, the stage's chrome, the URL, the
   theme attribute, or any element outside `container`. No `position: fixed` overlays.
4. **Height.** `container` is a block element whose width you get and whose height you should
   drive by setting your own content height, or by filling it if the stage gave it a height. It
   will never be 0×0 when `mountScene` is called. Re-read it in `resize()`.
5. **`dispose()` must leave no WebGL context behind.** If you create your own `WebGLRenderer`,
   call `.dispose()` and `.forceContextLoss()` on it. Mobile Safari dies after ~8 contexts.

---

## 2. three.js: one copy, passed to you

The stage loads three.js **0.160.0** and hands it to you as `THREE`.

**Use the `THREE` you are given.** Do not `import * as THREE from 'three'` in your scene module
and do not add your own `<script>`/importmap — two copies of three.js means two WebGL contexts,
broken `instanceof` checks, and double the download.

The stage's page carries this importmap, so addons resolve for everyone:

```html
<script type="importmap">{"imports":{
  "three":"https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
}}</script>
```

Addons (`GLTFLoader`, `OrbitControls`, `PDBLoader`, `Line2`, …) you **may** import directly —
they are peers of the single three.js copy, not a second copy:

```js
import { PDBLoader } from 'three/addons/loaders/PDBLoader.js';   // fine
import * as THREE from 'three';                                  // NOT fine — use the argument
```

If you need a non-three library, load it from `cdnjs.cloudflare.com` at an exact pinned version
and tell me in the hub message so I can preload it.

**You may also decline WebGL entirely.** A scene that is better as SVG/canvas2D/DOM should just
ignore `THREE` and build DOM into `container`. The networks act in particular may well be better
as SVG. The contract is identical; only `duration`/`play`/`pause`/`seek`/`dispose` matter.

---

## 3. `data` — the real run

`data` is the **already-parsed** contents of `validate-show/run.json`, produced by actually
running the validator (the command and timestamp are recorded inside it). It is never a mock. The
shape follows the validator's own five named results:

```js
data = {
  meta: {
    generated_by,        // the exact node command that produced this file
    generated_at,        // ISO timestamp
    pipeline,            // 'validateGeneration' | 'assembled-from-parts'
    pipeline_note,       // why, in a sentence, if 'assembled-from-parts'
    repo_commit,         // if available
  },
  ask: {                 // act 1
    text,                // the desired-phenotype text as typed
    criteria: [ { id, text, parsed: true, quantity?, comparator?, value?, unit? } ],
    unparsed: [ { text, reason } ],   // rendered IN RED by the stage. May be non-empty.
  },
  design: {              // act 2
    id, name, hypothetical,
    base,                // the parent organism id
    glb, manifest,       // paths under blueprint3d/model/
    edits: [ { gene, raw, kind, zygosity, part? } ],
    parameters: { <name>: { value, kind, source } },
  },
  analogue: {            // act 3
    chosen: { species, taxon, why, function_matched, distance },
    rejected: [ { species, why_not } ],
    rule,                // 'function, not relatedness'
  },
  genotype_similarity, phenotype_similarity, lean_check, functional_resolution, physics_check,
                         // the five gates, verbatim from the validator. Shapes: see
                         // sim-engine/validate/score.mjs namedResults() and
                         // sim-engine/validate/pipeline/deps.mjs for physics_check.
  verdict: { sentence, gates: [ { id, label, status, why } ] },   // act 7
  gaps: [ { id, scale, reason, where } ],   // the VISIBLE GAPS. See §5.
}
```

**What you should read.** The molecular scene wants `design.edits` (which genes),
`genotype_similarity.per_gene` (identity, site conservation, whether the edited state exists in a
real organism, and the per-edit `checks`), and `analogue.chosen`. The networks scene wants
`design.edits`, `functional_resolution` (what resolved and what did not), and
`phenotype_similarity` for the development/body side.

**Any field may be absent or `{ran: false, reason: '...'}`.** That is the normal case in this
repo, not an error. Guard every read. `functional_resolution.ran === false` must produce a scene
that *says so on screen*, not a scene that renders nothing and not a scene that invents a graph.

**If `run.json` has not landed when you start**, code against the shape above and ship with a
local `const FALLBACK = {...}` that you clearly mark; I will wire the real file in and you delete
the fallback. Tell the hub if a field you need is missing and I will add it to the generator.

---

## 4. Provenance: the part that is not optional

This is Amit's standing constraint and it is part of the design, not a disclaimer. Every panel
carries **where its data came from** and **its provenance kind**. Return a `provenance` object and
the stage renders it in the act's rail, in the stage's own styling:

```js
provenance: {
  summary: 'Side-chain geometry from AlphaFold DB AF-Q6DGH8-F1; the interaction is inferred.',
  verdict: 'mixed',          // 'measured' | 'mixed' | 'assumed' | 'hypothetical' | 'decorative'
  items: [
    { label: 'kcnk5b backbone', kind: 'measured',     source: 'AlphaFold DB AF-...', url? },
    { label: 'binding pose',    kind: 'hypothetical', source: 'docked here, not observed' },
    { label: 'membrane slab',   kind: 'decorative',   source: 'drawn to orient the viewer; affects no number' },
  ],
}
```

`kind` vocabulary, the same one the rest of the repo uses: `measured`, `derived`, `secondary`,
`assumed`, `tuned`, `hypothetical`, `proxy`, `observed`, `standard`, plus **`decorative`**.

**Anything decorative is labelled `decorative` in those words.** A pretty membrane, a glow, a
particle field, a spinning camera: fine, and label it. The viewer must be able to tell what is a
measurement from what is scenery.

You may also call `onNote({ severity, title, text, source })` at any time (including during
playback) to push a note into the act's rail. `severity` is `fatal` | `mismatch` | `warning` |
`note`.

---

## 5. Gaps are rendered, never skipped

If a scale you were going to show has **no data**, you must render it **as a visible gap** with
the reason in it — an empty, outlined, labelled slot — and not skip it, not collapse the layout
around it, and not fill it with something decorative that looks like data.

Known gaps in this repo you are likely to hit:

* **no flying-fish transcriptome exists** — so there is no expression layer for the design's own
  organism. Any expression you show is zebrafish, and must say so.
* **`kcnk5b` has no protein-level evidence** — no structure, no western, no localisation.
* **no proteomics for any design** — abundance is unavailable at every locus.
* **the real double-heterozygote fin measurements exist only in figure panels** and are not
  digitised anywhere here.

Put the ones you render into your `provenance.items` with `kind: 'absent'` as well, so the stage
can cross-check them against `data.gaps` and the verdict's "could not be assessed" column. A gap
you render that the stage does not know about is fine; a gap you *hide* is a bug I will come find.

Call `onReady()` (or resolve your promise) only once the gap slots are laid out, so the stage does
not screenshot a half-built act.

---

## 6. Timing, and how the stage drives you

* The stage owns one global timeline. Your act occupies `[actStart, actStart + duration]` and you
  only ever see **local** time, `0 .. duration`.
* Suggested `duration`: **18–35 s**. Under 12 s is too fast to narrate; over 45 s and viewers
  leave. Use `chapters` to break it up rather than stretching.
* `play(t)` may be called with `t > 0` (resuming, or a deep link landing mid-act). Handle it.
* The stage calls `seek(0)` once right after mount, before any `play`.
* **`reducedMotion: true`** (from `prefers-reduced-motion`) means: no camera moves, no continuous
  rotation, no particle motion. Render the *end state* of each chapter and let `seek` step between
  them. The stage honours it too; please honour it inside the scene.
* `theme` is `'light'` or `'dark'` at mount; `setTheme` follows later flips. Both themes must be
  legible — this is checked in screenshots.
* **390 px phone width, no horizontal scroll.** Your container will be ~358 px wide there. Test
  it. A 3D scene should drop labels and widen its camera rather than overflow.

---

## 7. Narration

The stage writes the narration for its own acts. For yours, **you** write it, because you know
what the scene is showing. Supply it as part of `chapters`:

```js
chapters: [
  { t: 0,  label: 'The channel',  say: 'kcnk5b is a potassium channel sitting in the fin-ray membrane.' },
  { t: 8,  label: 'The edit',     say: 'The edit changes one residue in the pore. Nothing here predicts a fin.' },
]
```

`say` is one or two plain sentences a non-specialist can follow, present tense, no jargon that is
not immediately unpacked. The stage renders it in the narration band under the scene and uses it
for the act's accessible description. If you omit `say`, the stage falls back to `label`, which
reads badly. Please write the `say`.

---

## 8. A minimal conforming scene

```js
export function mountScene({ container, THREE, data, theme, reducedMotion, onReady }) {
  const duration = 20;
  const host = document.createElement('div');
  container.appendChild(host);
  // ... build ...
  let raf = 0, t0 = 0, local = 0, playing = false;
  const render = t => { /* pure in t */ };
  const loop = now => {
    if (!playing) return;
    local = Math.min(duration, (now - t0) / 1000);
    render(local);
    if (local < duration) raf = requestAnimationFrame(loop);
  };
  render(0);
  onReady?.();
  return {
    duration,
    play(t) { playing = true; local = t ?? local; t0 = performance.now() - local * 1000;
              cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
    pause() { playing = false; cancelAnimationFrame(raf); raf = 0; },
    seek(t) { local = Math.max(0, Math.min(duration, t)); render(local); },
    dispose() { playing = false; cancelAnimationFrame(raf); host.remove(); },
    chapters: [{ t: 0, label: '…', say: '…' }],
    provenance: { summary: '…', verdict: 'mixed', items: [/* … */] },
  };
}
```

---

## 9. Boundaries

* **Do not edit** anything outside your own file: not `index.html`, not `stage.js`, not
  `run.json`, not each other's scene, not `sim-engine/`, not `t/physics/sim/`.
* **No Aves data.** Class Aves is the frozen holdout, repo-wide. No bird structure, no bird
  network, no bird value in any comparison, not even as an example.
* **No credentials**, no API keys, no network calls to anything but the pinned CDNs above and
  same-origin files already in `dashboard/public/`.
* If a file you want lives outside `dashboard/public/`, it is not servable — ask me and I will
  copy the data you need into `run.json` or a sibling JSON.

---

## 10. GENERALITY — the hard contract (v2, architectural)

**Requirement from Amit, 2026-11-01:** *"the framework for this animation should be generalizable
to different morphological additions or subtractions or even functional additions or
subtractions."*

The flying zebrafish is the **first subject, not the subject.** Your scene is handed a
`(base, generated, desired_phenotype)` triple and must compose from it.

### 10.1 Hardcode nothing

Specifically, **no literal in your scene may be**: an organism name, a gene symbol, a body part, a
pathway or pathway set, an analogue species, a parameter name you special-case, or a narration
string written for fins. If your scene would read differently for a design that moved
`caudal_upper_lobe_over_SL` instead of `pectoral_area_over_SL2`, it is hardcoded.

The stage will mount your scene with **all four cases below**, in the same session, via the case
selector. A scene that only looks right for case A is not done.

### 10.2 `data.case` — the classification, derived not asserted

The generator computes this from the design manifest (`parents`, `moved_parameters`) against the
parent's own resolved parameter set, so it is *derived from the data* and will be right for a
design nobody has thought of yet:

```js
data.case = {
  id,                    // 'winged-zebrafish' | 'wingless-flying-fish' | 'tff' | 'ff-zf-chimera' | …
  kind,                  // 'morphological-addition' | 'morphological-subtraction'
                         //   | 'functional-addition' | 'functional-subtraction' | 'blend'
  kind_derived_from,     // the sentence explaining HOW kind was decided, for the provenance rail
  direction,             // 'increase' | 'decrease' | 'mixed' | 'none'
  parents: [ { organism, weight } ],
  changed: [ {           // one per moved parameter — THIS is what you narrate from
    parameter,           // e.g. 'pectoral_area_over_SL2'
    label,               // human label, e.g. 'pectoral fin area'
    part,                // the anatomical part, e.g. 'pectoral fin' — may be null
    from, to,            // the parent value and the design value
    direction,           // 'increase' | 'decrease'
    factor,              // to/from
    kind, source,        // provenance of the design value
  } ],
  function: {            // the FUNCTION at stake, for the analogue and physics acts
    name,                // e.g. 'powered flight' — may be null
    status,              // 'gained' | 'lost' | 'retained' | 'none-claimed'
    base_has, analogue_has,   // booleans or null
    no_real_organism_has_it,  // true for the TFF case. See 10.4.
  },
}
```

**Narrate from `case.changed` and `case.function`**, templated: *"the \<label\> is \<direction\>d
\<factor\>× against \<parent\>"*. That sentence is correct for a fin, a tail lobe, a muscle
fraction, or something nobody has built yet.

### 10.3 The four cases, and what each demands of you

Each is committed as its own `run-<id>.json`:

| case | `kind` | what flips |
|---|---|---|
| **winged-zebrafish** | `morphological-addition` | the headline. A part is enlarged; the question is "does the new function appear?" |
| **wingless-flying-fish** | `morphological-subtraction` | a real repo design: the flying fish with ordinary fins. The question flips to **"what did removing this cost?"** and the physics montage must show the function **FAILING** — that is the finding, not a bug. |
| **tff** | `functional-addition` | powered flight: a function **the base organism and the analogue both lack**. |
| **ff-zf-chimera** | `blend` | `parents.length === 2`, `moved_parameters` empty. Features come from two parents at once; there is no single "from" value, so `changed[].from` carries the weighted parent value and `parents` carries both. |

### 10.4 The analogue act is not always "here is the analogue"

This is the honest part and it is where a generic walkthrough usually lies. Three distinct
stories, and `case.function` tells you which:

* **`status: 'gained'`, an analogue exists** — fly to it; show *why* (function matched, not
  relatedness).
* **`status: 'lost'`** (subtraction) — the analogue is the organism that **LACKS** this function,
  and it is the *comparison*, not the target. Say that. "We are comparing against the animal that
  cannot do this, to measure what was given up."
* **`no_real_organism_has_it: true`** (the TFF) — **no analogue exists.** Render the act as an
  explicit gap: *"no real organism has this function, so there is nothing to compare against."*
  This is a genuinely different and more honest story than pretending an analogue exists, and it
  must not be dressed up as one.

### 10.5 An act with nothing to show is skipped-with-a-reason or an explicit gap

Never a scene full of placeholder content. If, for the case you were handed, your scene has no
data:

```js
return { skip: true, reason: 'no expression data exists for any organism in this design\'s lineage' };
```

The stage renders that as a stated skip in the timeline (the act is *visible* as skipped, with the
reason, not silently dropped). Or return a normal scene whose body is gap slots per §5. Both are
acceptable; a placeholder graph is not.

### 10.6 If you cannot generalise an act in the time available

**Hardcode nothing silently.** Ship the act specialised and return a note the stage will print on
the page:

```js
onNote({ severity: 'warning', title: 'This act is specialised',
         text: 'The molecular scene is written for the pectoral-fin edits of the winged zebrafish; for other cases it shows the edit list only.',
         source: 'molecular.js' });
```

A stated limitation is fine. An unstated one is not.

---

Questions, or a field you need added to `run.json`: message the hub addressed to the
validate-show thread and I will answer in this file.

### Changelog

* **v2, 2026-11-01** — §10, the generality contract: nothing hardcoded to the flying zebrafish,
  `data.case` added (derived classification + `changed[]` + `function`), the four committed cases,
  the three analogue stories including "no real organism has this function", skip-with-reason, and
  the stated-limitation escape hatch. `data.ask`/`data.design` unchanged, so work already done
  against v1 still compiles.
* **v1, 2026-11-01** — first version, written ahead of the scenes.
