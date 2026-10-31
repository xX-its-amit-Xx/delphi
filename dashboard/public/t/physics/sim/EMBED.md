# EMBED.md — driving the flight simulator from the 3D viewer

How to launch `dashboard/public/t/physics/sim/` with a design and get its results back, without
reading its code. Written by the physics-simulator thread for the viewer agent.

The page is a plain `<iframe>` target. It accepts parameters two ways (URL query, `postMessage`)
and sends its results back one way (`postMessage` to `window.parent`, and to `window.opener` if it
was opened in a tab). Everything is JSON-serialisable; nothing is shared except messages.

```
<iframe id="sim" src="../t/physics/sim/?theme=dark" title="Flying fish simulator"></iframe>
```

---

## 1. Parameter names

The simulator speaks the **parametric schema**'s names exactly
(`anatomy-model/parametric/design-schema.json`). Five parameters are accepted:

| name | unit | what it is |
|---|---|---|
| `standard_length_m` | m | standard length |
| `body_mass_kg` | kg | wet mass |
| `pectoral_area_over_SL2` | – | membrane area of the pectoral fins / SL² |
| `pectoral_span_over_SL` | – | pectoral tip-to-tip span / SL |
| `flight_muscle_fraction` | – | pectoral/girdle muscle mass / body mass |

Three more are **derived and must never be sent as inputs** — the schema says so and the simulator
recomputes them:

| name | how the simulator computes it |
|---|---|
| `lifting_area_m2` | `pectoral_area_over_SL2 × standard_length_m² × 1.9896503` |
| `wing_loading_N_m2` | `body_mass_kg × 9.81 / lifting_area_m2` |
| `pectoral_aspect_ratio` | `pectoral_span_over_SL² / pectoral_area_over_SL2`, i.e. span² / the area of both pectorals, the same arithmetic as `anatomy-model/parametric/build.py` |

**The one exception, and the reason for it.** The schema carries the *pectoral* area; the simulator's
aerodynamic reference area is the *total lifting* area (pectoral + pelvic + caudal). The only bridge
between them here is the ratio `0.012688 / 0.006377 = 1.9896503`, measured on the one Park & Choi
specimen. Applying it to any other body is an **assumed transfer**, and the page labels it so. If your
design knows its own lifting area — a built mesh does, in
`<model>-manifest.json` `derived_from_the_mesh.lifting_area_m2` — send it as
`derived.lifting_area_m2` and the ratio is not used:

```json
"derived": { "lifting_area_m2": { "value": 0.04905, "kind": "hypothetical", "source": "tff.json spec" } }
```

Note that a *parameter* aspect ratio and a *mesh* aspect ratio differ for the reference organisms,
deliberately: the reference meshes do not meet their own span and area parameters
(`parameter_vs_mesh_check` in each manifest). The simulator reports the parameter one.

### What else moves, and what the simulator refuses to invent

* `pectoral_span_over_SL` sets the span used for ground effect (`b = span/2`).
* If `standard_length_m` differs from the base entry's, the tail-lobe length and the body frontal
  area are rescaled (`0.2463 × SL`, `0.016985 × SL²` — the ratios the committed `params.json`
  entries already use) and both are labelled `assumed`. Nothing else is rescaled.
* Everything the parametric schema does not carry — the fin polar (C_L,max, (L/D)max, C_D,min,
  stall), the trim law, the breach rule, the re-entry speed, the thrust model — comes from a **base
  entry** in `params.json`. Pick it with `base`; the default is whichever entry is selected.
  Base ids: `cypselurus-hiraii-L3` (the real fish), `flier-F1-hypothetical`, `tff-v2-hypothetical`,
  `zebrafish-winged-hypothetical`.
* Whether the animal flaps is **not** inferred from `flight_muscle_fraction`. Send `powered: true`
  if the design is meant to flap; otherwise the base entry decides.

### Kinds travel with values

Every parameter may be `{"value": …, "kind": …, "source": "…"}` instead of a bare number.
`kind` is one of the schema's: `measured`, `derived`, `assumed`, `hypothetical`, `secondary`
(`tuned`, `observed`, `proxy`, `standard` are also understood). The simulator shows the kind beside
every value, carries it into the derived quantities (the worst kind wins) and into a provenance
summary, so a run made of assumptions looks different from one made of measurements. **A value sent
without a kind is labelled "supplied, no kind or source given" and counts as the weakest sort.**
Send the kinds; they are the point.

---

## 2. Launching by URL

```
../t/physics/sim/?preset=tff&autorun=1
../t/physics/sim/?standard_length_m=0.203&body_mass_kg=0.06&pectoral_area_over_SL2=0.5982&pectoral_span_over_SL=3.273&flight_muscle_fraction=0.16&base=tff-v2-hypothetical&powered=1&id=my-design
../t/physics/sim/?design=%7B%22id%22%3A%22d1%22%2C%22parameters%22%3A%7B%22body_mass_kg%22%3A%7B%22value%22%3A0.06%2C%22kind%22%3A%22measured%22%7D%7D%7D
```

| query key | meaning |
|---|---|
| `preset=<id>` | load one of the presets (§4) |
| any of the five schema names | that parameter, as a number |
| `kind.<name>=`, `source.<name>=` | the kind and source of that parameter |
| `lifting_area_m2=` | override the derived lifting area (same as `derived.lifting_area_m2`) |
| `base=<id>` | the `params.json` entry to build on |
| `powered=1` | the design flaps |
| `id=`, `name=`, `hypothetical=1` | labels for the design panel |
| `design=<url-encoded JSON>` | the whole design object of §3 in one parameter |
| `autorun=1`, `tmax=<s>` | run to completion headlessly, then emit `results` |
| `theme=dark\|light` | force the theme (the viewer already passes this) |
| `fish=<0..3>`, `phys=1` | the page's older selectors: base entry by index, physiology chain on |

URL and `postMessage` go through the same code path, so anything below can also be sent as a URL.

---

## 3. Messages

Every message, in both directions, carries `delphi: "physics-sim"` and `v: 1`. The simulator ignores
messages without them, and you should too. It posts with target origin `*`; check `event.origin`
yourself if you serve the two pages from different origins.

### 3.1 In: parent → simulator

**Load a design**

```js
sim.contentWindow.postMessage({
  delphi: "physics-sim", v: 1, type: "design", requestId: "r1",
  design: {
    id: "tff", name: "TFF v2", hypothetical: true,
    base: "tff-v2-hypothetical",          // optional
    powered: true,                        // optional
    parameters: {
      standard_length_m:      { value: 0.203, kind: "measured",     source: "Park & Choi 2010 L3" },
      body_mass_kg:           { value: 0.06,  kind: "measured",     source: "Park & Choi 2010 L3" },
      pectoral_area_over_SL2: { value: 0.5982414486, kind: "hypothetical", source: "delta ×3.865857" },
      pectoral_span_over_SL:  { value: 3.2729685594, kind: "hypothetical", source: "delta ×2.545670" },
      flight_muscle_fraction: { value: 0.16,  kind: "hypothetical", source: "tff.json muscle.fraction" }
    },
    derived: { lifting_area_m2: { value: 0.04905, kind: "hypothetical", source: "spec" } },
    notes: [ { severity: "fatal", title: "…", text: "…", source: "…" } ],
    rests_on_text: "one sentence shown under the design's name",
    autorun: true                         // or { tmax: 60 }
  }
}, "*");
```

* Omitted parameters keep the base entry's value (shown as "from base entry").
* `notes[].severity` is `fatal`, `mismatch`, `warning` or `note`; they are rendered in that order of
  loudness in the design panel. Send the design's known problems — that is what the panel is for.
* Unknown parameter names are ignored and listed back in `accepted.ignored`.

**Other inbound types**

| message | effect |
|---|---|
| `{type:"hello"}` | the simulator replies with `ready` (use it if you loaded the iframe before listening) |
| `{type:"preset", preset:"tff", autorun?}` | load a preset (§4) |
| `{type:"control", action:"run"\|"pause"\|"reset"\|"step"\|"autorun"\|"results"\|"speed"\|"physiology", seconds?, tmax?, speed?, on?}` | drive the run |
| `{type:"theme", theme:"dark"}` | follow the parent's theme |
| `{type:"get-results", requestId?}` | same as `control` + `results` |

### 3.2 Out: simulator → parent

`ready` — sent once at load, and on `hello`:

```js
{ delphi:"physics-sim", v:1, type:"ready",
  presets:[{id,label,hypothetical,rests_on,base,organism}],
  base_entries:[{id,label,hypothetical}],
  accepts:{parameters:[…5 names…], derived_in:["lifting_area_m2"], derived_out:[…3 names…]},
  contract:"sim/EMBED.md" }
```

`accepted` — after any design, preset or base-entry change. Its body is the **summary block**:

```js
{ type:"accepted", requestId, ignored:["…"],
  design:{ id, name, hypothetical, base, origin, notes },
  parameters:{ standard_length_m:{value,kind,source,from:"design"|"base",applied}, … },
  derived:{ lifting_area_m2, wing_loading_N_m2, pectoral_aspect_ratio,
            pectoral_area_both_m2, span_m, v_min_m_s },
  validation:{ mode:"committed"|"reproduced"|"exploratory", pre_registered:bool, statement:"…",
               differs_from_committed:[{parameter,committed,now,negligible}],
               url_flags:[…], sliders_moved:[…], prereg:"…/PREREG.md", runs:"…/RUNS.md" },
  provenance:{ counts:{measured,secondary,derived,assumed,tuned,hypothetical,other},
               total, verdict:"measured"|"mixed"|"assumed"|"hypothetical", text, weak_share,
               per_parameter:[{parameter,kind,bucket}] },
  physiology_chain:"on"|"off" }
```

`state` — while running, at most four a second, and once when the run stops:

```js
{ type:"state", t_s, phase:"swim"|"taxi"|"glide"|"stopped", x_m, z_m, speed_m_s, glides, running, done }
```

`results` — when a run finishes, on `autorun`, and on request. The summary block plus:

```js
{ type:"results", requestId,
  run:{ t_s, done, phase, distance_m, height_m, speed_m_s, glides, takeoff_speed_m_s,
        max_height_m, mean_taxi_m,
        per_glide:[{takeoff_speed_m_s,distance_m,duration_s,max_height_m,peak_speed_m_s}],
        physiology:{blood_O2_store,burst_store,axial_W,flight_W}|null },
  comparison_rows:[{quantity, published_second_hand, this_run, status:"within"|"outside"|"pending"}],
  comparison_caveat:"…" }
```

`error` — `{type:"error", requestId, message}`. Unknown base, unknown preset, bad JSON in `design=`,
unknown message type.

### 3.3 The one thing an embedder must not do

**Do not print `comparison_rows` as test results.** Read `validation.mode` first:

* `committed` — the parameters are the committed `params.json` ones; the page's pre-registration
  statement applies (PREREG.md, run 6; tests 1–3 post-hoc; test 4 as recorded in RUNS.md).
* `reproduced` — they arrived through the intake but every value the integrator reads matches the
  committed entry, so it is the same configuration.
* `exploratory` — **anything supplied at run time.** A pre-registered test applies to the
  pre-registered parameters, not to whatever someone sends. Show `validation.statement`, not a pass
  or a fail. The simulator already says this in red on its own page; do not drop it on the way out.

Likewise, show `provenance.verdict` and `provenance.text` next to any number you take from a run: a
run made of assumptions must not look like a measurement in the viewer either.

---

## 4. Presets

`sim/presets.json`, also listed in the `ready` message. Each loads the real parameters of an organism
or design DELPHI holds, from `anatomy-model/parametric/resolved/`.

| id | what it is | what it rests on |
|---|---|---|
| `flying-fish` | the real darkedged-wing flying fish, Park & Choi 2010 specimen L3 | **measured** morphology and a measured wind-tunnel fin polar. Reproduces the committed run-6 geometry exactly, so `validation.mode` is `reproduced`. Its flight-muscle fraction (0.04) is shown but **not applied**: no flying fish's pectoral-muscle fraction has ever been measured, and the pre-registered arms are defined at 0 and 0.0913. |
| `tff` | the HYPOTHETICAL truly flying fish, TFF v2 | **nothing measured**: a spec. Surfaces all four mismatches from `SPEC-MISMATCHES.md`, loudest first — **at 16 % of 60 g only 29.5 % of the required flight muscle fits inside the animal**, while the simulator still charges the full 16 % to the power budget. |
| `winged-zebrafish` | zebrafish with the pectoral fin moved toward the flying fish | **hypothetical**: the fin value 0.35 is a *chosen* point, not the paper's number. The closest real experiment's paired-fin measurements exist only in figure panels (Fig. 4B) and are not digitised anywhere here. Its polar is the flying fish's, an assumed transfer. |
| `zebrafish` | the zebrafish itself, ordinary fins | **assumed**: body size measured, fins schematic textbook placeholders, polar borrowed from the flying fish. The control: v_min comes out at 17.25 m/s, about 440 body lengths per second, and it never leaves the water. |

A preset parameter may carry `"apply": false` with a `not_applied_reason`: it is displayed with full
provenance and kept out of the run. The message contract has no such field — every parameter in a
`design` message is applied.

---

## 5. A complete embedder

```js
const sim = document.getElementById('sim');
addEventListener('message', ev => {
  const m = ev.data;
  if (!m || m.delphi !== 'physics-sim' || m.v !== 1) return;
  if (m.type === 'ready')    sendDesign();                 // or postMessage a preset
  if (m.type === 'accepted') showStatus(m.validation, m.provenance, m.derived);
  if (m.type === 'state')    showPhase(m.phase, m.t_s, m.glides);
  if (m.type === 'results')  showResults(m.run, m.comparison_rows, m.validation);
  if (m.type === 'error')    console.warn('sim:', m.message);
});
function sendDesign() {
  sim.contentWindow.postMessage({ delphi:'physics-sim', v:1, type:'design', requestId:'1',
    design: { id:'tff', name:'TFF v2', hypothetical:true, base:'tff-v2-hypothetical', powered:true,
              parameters: paramsFromManifest(), autorun:{tmax:60} } }, '*');
}
```

If you load the iframe and listen afterwards you may miss `ready`; send `{type:"hello"}` on
`iframe.onload` and it will be sent again.

---

## 6. Rules the simulator keeps, so you can rely on them

* No equation, constant or pre-registered threshold changes when a design is loaded. A design moves
  parameters, nothing else.
* The pre-registration banner is never rewritten or softened. When the parameters are not the
  pre-registered ones, a second, louder banner says the run is exploratory; the first one stays as the
  record of the pre-registered runs.
* Every parameter keeps its kind and source on screen, and the provenance summary says in one line
  how much of the run rests on assumptions.
* No bird value enters any parameter, target or comparison: class Aves is the frozen holdout.
