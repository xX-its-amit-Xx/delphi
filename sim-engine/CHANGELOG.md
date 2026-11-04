# sim-engine contract changelog

The contract is the tool names, their JSON Schemas (`contract.json`), the envelope, the STATE fields and
the scenario interface. Its version is `CONTRACT_VERSION` in `lib/envelope.mjs`. Every envelope carries it
as `contract_version`, and `contract.json` states it. The rule: anything may change, provided it is
versioned here. While the major version is 0, a minor bump may break callers; each entry says what breaks.

## 0.11.0, unreleased addition: illustration meshes for the scale theatre (2026-11-03)

**No tool schema changed, so `CONTRACT_VERSION` stays 0.11.0.** What changed is a build output and a page.

- **`sim-engine/scales/mesh/`**: Blender ILLUSTRATION meshes, one sculptor per frame (insect, tetrapod,
  prokaryote, construct), one GLB per spec with a root per declared life-stage form, Draco-compressed, with a
  manifest beside it. Every GLB and manifest carries `geometry_basis: "schematic-illustration"` and
  `THIS_IS_NOT_MORPHOMETRY`. Shapes are sculpted from textbook body plans; none is measured. `spec.mjs` keys
  stage forms by keyword on the declared stage label; the GLB is named `<frame>-<hash>`, the hash covering
  frame + stage keys + drivers + generator version, and the generator version includes a digest of
  `build_mesh.py`, `lib.py` and the frame's sculptor. So generations that declare the same stages share a mesh,
  a sculptor's edit rebuilds only its frame, and a cached GLB costs nothing.
- **Every ladder gains `ladder.mesh`** (`glb`, `manifest`, `hash`, `frame`, `stages`, `stage_labels`,
  `stage_of_point`, `generator_version`, `status` = cached | built | no-blender | failed | not-requested,
  `exists`, `blender`, `why`). `scales/build.mjs` builds meshes only with `--meshes` or `DELPHI_MESH=1`; without
  it nothing launches Blender and nothing is pruned. With it, unreferenced generated meshes are pruned **only
  for the frames that invocation built or reused**, against every bundle on disk after its own were written, so
  `--run <one run> --meshes` can no longer delete a GLB another run's bundle still needs.
- **Runs build their mesh, headless too.** `tools/theatre.mjs` passes `--meshes` on a launch unless
  `DELPHI_MESH=0`. `runs/_lib/studio-run.mjs` and `runs/flying-mouse/run.mjs` default `DELPHI_MESH=1` and, after
  every generation, rebuild the ladder with `--meshes` even when `DELPHI_OPEN=0` (which now only stops the
  browser); the rebuild timeout is 600 s (it was 180 s in `flying-mouse/run.mjs`).
- **The theatre page** loads three 0.160.0 as ES modules (GLTFLoader, DRACOLoader, RoomEnvironment) with a shim
  that keeps `window.THREE` for the classic scripts and the "three.js did not load" fallback. Illustrated mode
  (the default when a GLB loads) styles every slot node from the ladder: **present** (solid), **ghost** (only
  the literature chain names it: violet, labelled), **body** (an envelope region with no part of its own:
  neutral, a click opens the body), **cells-only** (only cells or tissue land in an organ slot: an outline
  labelled with the cell, never a solid organ) and **absent** (hidden; a toggle outlines and labels what the
  blueprint lacks). It opens on the LAST declared stage point, keeps tissue/cell beads off until asked and places
  them relative to their slot's node in the current stage form. `window.THEATRE` gains `mode()`, `meshState()`,
  `stage()`, `absent()`, `pick()`, `fit()`, `nodeScreen()`, `view()`.
- **`extras.requires`: pieces that depict one specific part** (`scales/mesh/depicts.mjs`, copied verbatim into
  `theatre.js`). Such a piece follows that part's state, not its parent slot's: ontology ids first, label
  regexes only when no id is in the ladder at all, body-level parts never count. The xenobot's cilia and
  multiciliated cells (`CL_0005012`, only in the chain) are now violet ghosts instead of solid; the fly's ocelli
  and pupal spiracles are hidden and its larval salivary glands present; the mouse's gallbladder, parathyroid,
  aorta, great veins, adrenal (split out of the ureter piece, same geometry) and eyelids are hidden because its
  blueprint has none of them, and its ureter (by id) and trachea (by label only) are present.
- **Illustration notes reach the page.** Sculptors recorded drawing choices under different keys
  (`illustration_note`, `note`, `schematic`, `shape_basis`, `beat`, `cells_drawn`); `build_mesh.py` folds them
  into `extras.illustration_note` and the manifest's node (and stage) records, and the part card shows the
  clicked piece's note under "about this drawing".
- **Blender messages name the cause.** A `DELPHI_BLENDER` that points at a missing file (or a folder) now says
  so, with the path, instead of "set DELPHI_BLENDER"; the page badge says the same.
- **Contract tightened**: every deco hangs under a slot node of its own slot (no free `deco:body:*`); construct
  and prokaryote stage roots are sculpted at their frame's slot radii, not normalised to x about [-1.6, 1.6], and
  the test asserts what is true instead (each stage's extent contains its slot positions x 2).
- **Corrected wording about Blender.** Earlier text said Blender is not installed on this machine. It is
  (`C:/Temp/tools/blender/blender-4.2.23-windows-x64/`); the earlier generations had no surface mesh because
  `anatomy-model/parametric` is a teleost-only builder. Corrected at the source in
  `dashboard/public/blueprint3d/studio-live/gen.mjs`, `runs/README.md`, `runs/_lib/shoot.mjs` and
  `runs/flying-mouse/run.mjs` (header and gen 0's `mesh.why`). Not yet corrected: `runs/carbon-eating-bacterium/run.mjs`
  and `runs/long-lived-fruit-fly/run.mjs` still say "Blender is absent here", and the outputs those sources wrote
  earlier (`runs/*/gen/*.json`, `journal.jsonl`, `fig/shots.json`, `studio-live/<run>.json`) keep the old words
  until they are regenerated, because they are records of what a run said at the time.
- Tests: `scales/test/mesh.mjs` (47), beside `scales/test/scales.mjs` (43).

## 0.11.0 (2026-11-03)


**Added** (1 tool; 62 -> 63. Two schema fields, one STATE capability. Nothing removed, nothing renamed.)

- **`studio_theatre`** (`tools/studio.mjs`, `tools/theatre.mjs`, `scales/`). Builds a run's scale ladder,
  serves `dashboard/public` and returns the url of the 3D scale theatre: every part of the organism on a
  schematic body plan, the Lean laws that reach each part (each chip opens the theorem's source, its pin,
  and the unsigned nanopub draft its claim sits in), the checks that looked at it, and the graded literature
  chain from a protein up to it. Opens a browser unless `open: false`. stdio only.
- **`session_open` takes `run` and `open_theatre`**, and its result carries a `theatre` block. Opening a
  session now launches the theatre when `DELPHI_OPEN` is set to anything but `"0"`; the run harness and the
  interactive CLI set it, the test suite does not. With it unset there are no side effects at all -- no
  build, no server, no process left behind. Never fails the session.
- **A life stage may declare its own `parameters`** (`lib/state.mjs`). This is what makes a growth track
  expressible: the engine resolves a different STATE at each declared age. Values are never interpolated
  between stages, because an interpolated mass would be a third kind of number -- neither measured nor
  declared. With one stage, or none declaring parameters, resolution is unchanged.

**Found, and reported rather than hidden.** For *Drosophila melanogaster* the blueprint contains bone
marrow, hyaline cartilage, a penis and a uropygial gland, and no brain, gut, muscle or fat body.
`scales/audit-taxon.mjs` shows why: 2 of 131 parts carry an `in_taxon` restriction specific enough to place
them in a fly. The run that called that generation "all correct" was wrong; its README is corrected.

## 0.10.0 (2026-11-03)

**Added** (1 tool; 61 -> 62. Two schema fields. Nothing removed, nothing renamed.)

The four runs under `runs/` had each ended on a refusal that was CORRECT and USELESS: the thing being asked
for was not expressible, so no check could take it, so the request reached nothing. Three of those refusals
were about capability rather than about any organism, and this closes them.

- **`performance_check`** (`tools/performance-tools.mjs`, `validate/performance/`). What the design
  ACCOMPLISHES, as distinct from its shape or its gait. Three kinds, each resting on something that cannot
  be argued with rather than on a declared outcome. `lifespan`: expected lifetime under a constant two-term
  hazard, E[T] = 1/(h_int + h_ext) -- exact arithmetic, and it carries the life-history point that when
  extrinsic mortality dominates, extending intrinsic lifespan buys almost nothing, with the number saying
  how little. `manipulation`: declared thrust against Stokes drag, F = 6*pi*mu*a*v. `mass_balance`: carbon
  uptake against biomass plus respiration, so a design claiming more biomass carbon than it takes in is
  reported IMPOSSIBLE rather than optimistic. You may declare an uptake rate or a thrust; you may not
  declare that the organism works. Served hosted.
- **`declared` on a taxon base** (`organism_create`, `organism_from_blueprint`; schema widened). Quantities
  the designer states, each with a source, which enter STATE with kind `assumed`. Before this a taxon base
  resolved NO STATE AT ALL, so `organism_get` refused outright and everything built on a STATE -- every
  scenario, every standing check, the whole of `physics_check` -- was unreachable for any organism outside
  the bundle. That was a capability gap reported as if it were a fact about the organism. A field nobody
  declares stays null with its reason and the checks needing it still refuse; an unknown field name is an
  error rather than a silently ignored key. `physics_check` now runs on a mouse and each standing check
  that cannot answer names the STATE field it wanted.
- **`made_from` on a taxon base** (same two tools; schema widened). A CONSTRUCT: built from a taxon, not an
  instance of it. `base.taxon` still carries the DONOR, because the cells are that taxon and the genome is
  unedited, so sequence questions stay answerable; `closest_relative_phenotype` now refuses a construct as a
  construct and names what IS answerable, instead of reporting the nearest real body to a frog.

**Changed** (behaviour, no schema)

- `parse_design_text` reads three requirement families it had no words for -- lifespan, a task, a substrate
  -- into `spec.performance_criteria`, and returns a `routing` block saying which tool takes each
  requirement and, for everything unread, whether a layer exists for it at all. "I do not understand these
  words" and "I understand them and nothing here answers them" are different facts and were indistinguishable
  before. The new families take a verb only WITH its object, because a bare verb robs the other families:
  the first version read `transport` in "minimize cost of transport" and `digests` in "digests a meal within
  12 hours", breaking both.
- `lift-coefficients.json` gains `inapplicable`: clades where a steady maximum lift coefficient is the WRONG
  QUANTITY rather than a missing measurement. Insecta is the first, with Dickinson, Lehmann and Sane 1999
  (doi 10.1126/science.284.5422.1954) behind it -- an insect's lift comes substantially from rotational
  circulation and wake capture, which exist only because the wing reverses, and a steady coefficient
  represents neither. The refusal says what a right check would need. A caller acting on "nobody measured
  one" and on "this is the wrong model" would do different things, so they are different answers.

## 0.9.0 (2026-11-03)

**Added** (2 tools; 59 -> 61. Two new validation layers. Nothing removed, no existing schema changed.)

Until now every check in this engine asked the same shape of question: take a design, and say something
about it at an instant. A part list is a statement about an instant. So is a lift coefficient, a law verdict
and a phenotype distance. Two kinds of question were not expressible at all, and both of them came up the
moment anyone asked for something other than a fish.

- **`locomotion_check`** (`tools/locomotion-tools.mjs`, `validate/locomotion/`). HOW the organism moves, as
  distinct from what it is made of: an organism asked to swim, walk or fly is being asked for a CYCLE,
  repeated, and two designs with identical part lists can differ in whether they go anywhere. Three kinds of
  result, kept apart because they are different kinds of claim. THEOREM: Purcell's scallop theorem (Am J
  Phys 45(1):3-11, doi 10.1119/1.10903), which returns `impossible` for a time-reversible stroke at low
  Reynolds number -- not slow, not inefficient: zero net displacement per cycle, at any beat frequency, for
  any organism. ARITHMETIC: cycle frequency times net distance per cycle against the declared speed.
  REGIME: Reynolds and Froude numbers, REPORTED AND NEVER FAILING A DESIGN, because equal Froude number is
  necessary and not sufficient for dynamic similarity and the quoted 0.5 transition is a human number.
  Flight delegates to `flight_support_check` so there is one lift-coefficient policy and not two. Served
  hosted: pure arithmetic, no network, no writes.
- **`ecology_check`** (`tools/ecology-tools.mjs`, `validate/ecology/`). Whether the WORLD permits the
  organism, as distinct from whether biology does. Assembles four things from real records -- where GBIF
  records the clade, what else GBIF records in a stated box (scoped to the design's own class), what GloBI
  records as eating or interacting with it, and the intersection of the last two -- and refuses to predict
  competitive exclusion from any of it, because neither database contains a single population parameter.
  Occurrence counts are presence and sampling effort, never abundance; an interaction record is an
  observation somebody reported, not a rate. A competitive outcome is produced ONLY from growth rates,
  carrying capacities and competition coefficients the caller declares with sources, through Lotka-Volterra
  mutual invasibility -- two species, no space, no environmental variation, no evolution, and the result
  says the outcome is a property of those four numbers. Every result is filtered by the frozen holdout clade
  before anything is written or cached. LOCAL ONLY: it calls two public APIs and writes a cache, and the
  hosted server does neither on an anonymous caller's behalf.

**Changed** (behaviour, no schema)

- `parse_design_text` no longer reads the name of an animal as a verb. `familyGlide` matches the
  free-standing word `fly`, `fruit fly` contains one, and "I want a fruit fly that lives longer" came back
  with a GLIDE criterion -- a requirement nobody asked for, attached to a request about lifespan, which the
  design would then have been judged against. Two-word insect names ending in "fly" are organism names and
  are taken out of the clause before the criterion families read it.
- The clade table (`lib/lean-taxonomy.mjs`) reaches outside the animals: 310 -> 339 taxa, with Bacteria,
  Archaea, Fungi and Viridiplantae anchors. It ran from Metazoa downward, so every prokaryote, fungus and
  plant was unplaceable -- and unplaceable propagates: no clade scope can be decided, no reference set can
  say whether it is covered, and the lift-coefficient table could not even refuse one properly. Verdict
  counts for every existing design are unchanged (`lean_by_component` for winged-zebrafish is identical).

## 0.8.1 (2026-11-03)

**Added** (1 tool; 58 -> 59, plus the 13 Design Studio tools now registered on the MCP server. One schema
widened; nothing removed, nothing renamed, no existing field changed meaning.)

- **`flight_support_check`** (`tools/physics-tools.mjs`, `validate/physics/flight-support.mjs`). The one
  aerodynamic question -- does lift at a stated airspeed carry a stated weight -- for ANY clade, from inputs
  the caller declares with their sources. It exists because `physics_check` runs scenario modules over a
  resolved STATE and the engine holds body-plan parameters for its own teleosts only, so for any other
  animal it stops before reaching aerodynamics, which is the part that is not clade-specific. Every quantity
  must arrive as `{value, source}` or `{min, max, source}`; a bare number is refused by name, a range is
  swept and the verdict covers it. Asked about POWERED flight it refuses and says what a power answer would
  need. Served hosted: no network, no writes.
- **The Design Studio over MCP.** `organism_create`, `organism_from_blueprint`, `organism_get`,
  `organism_list_parts`, `organism_edit`, `scenario_list`, `scenario_run`, `scenario_timecourse`,
  `optimize`, `session_open`, `session_post`, `session_decide`, `session_read` are registered on the stdio
  server. They write under `sim-engine/sessions/`, so they are LOCAL ONLY and absent from the hosted tool
  list, under the standing rule. Before this an agent with only this server could parse a request into a
  spec, place its organism in a clade and check the laws, and then had no way to build the document those
  answers were about.
- **`session_post` gains `kind: "finding"`** (schema widened; existing kinds unchanged). A finding records
  ONE tool run: `tool`, `verdict` in the tool's own vocabulary, `generation`, and `detail` carrying the
  numbers verbatim. It needs no human role and carries no edits, because it changes nothing -- it is
  evidence. The only way to record a validation result in a session used to be a comment, and a log of prose
  cannot be read back as a sequence: you could not ask it which gates failed at generation 2.
  `session_read` now returns `findings.generations`, the findings grouped by the design they were measured
  on. **Breaking for a caller that enumerates `kind`**: nothing else.

**Changed** (behaviour, no schema)

- `physics_check`'s `lifting_area_supports_mass` no longer defaults its maximum lift coefficient. It was
  `const CLmax = 0.78` -- a stuffed *Cypselurus hiraii* measured in a wind tunnel -- applied to whatever
  design it was handed, with a comment in the source saying that using it for any other body is borrowed and
  nothing enforcing that comment. Coefficients now come by clade from
  `validate/physics/lift-coefficients.json` with their sources, through the generated clade table, and a
  clade with no entry gets `no model` naming what is missing. The teleost designs are unchanged: the
  Exocoetidae entry declares `borrowable_to: Teleostei` with its reason, so `winged-zebrafish`, `tff`,
  `flying-fish` and `ff-zf-chimera` return the same statuses, areas and thresholds as before, now labelled
  as a declared borrow. A design with no taxon of its own takes its dominant parent's, and says so.
- `parse_design_text` no longer discards the criteria in a clause that names an organism the engine has no
  parameters for. "a mouse that ... supports its flight" returned `criteria: []`; the same sentence with
  "zebrafish" returned a glide criterion.

## 0.8.0 (2026-11-01)

**Added** (18 tools; 40 -> 58. Nothing removed, no schema changed.)

Every outstanding registration note under `tools/` is applied, so the stdio MCP server, the HTTP bridge, the
CLI and `contract.json` now all list the same tools. Before this, ten of them existed only as `POST
/tool/<name>` on the HTTP bridge's `tools/` discovery and four had no tool name at all, so a collaborator
could not run a design through the validation framework over MCP.

- **`validate_generation`** (`tools/pipeline-tools.mjs`, PIPELINE-REGISTER.md). The entry point: generated
  organism + base organism + the desired phenotype **as text** -> the five named results side by side, each
  with its own gate, never summed, plus per-scale coverage and a verdict sentence. Recipe and real output:
  `mcp/README.md`, first section.
- **`functional_resolution`** (new `tools/functional-tools.mjs`). The fourth named result as a tool of its
  own. Registration only: a JSON Schema and an envelope over `validate/functional-interface.mjs`
  `functionalResolutionFor`, which is the entry point that file already stated. Nothing in
  `validate/functional/` was touched.
- **`physics_check`** (`tools/physics-tools.mjs`, PHYSICS-REGISTER.md). The fifth named result. A gate; it
  never moves the composite score.
- **The six remaining design-validation tools** (`tools/validate-tools.mjs`, VALIDATE-REGISTER.md):
  `closest_relative_phenotype`, `closest_relative_genotype`, `sanity_check_design`, `lean_by_component`,
  `validate_design`, `validate_swarm_tasks`. `design_score` was already registered; the `.filter()` that
  held the other six back is gone.
- **`edit_plan`, `edit_plan_methods`** (`tools/editplan-tools.mjs`, EDITPLAN-REGISTER.md). Zebrafish only;
  a proposal, never a protocol.
- **`lean_open_questions`, `lean_open_question`, `lean_open_question_guard`**
  (`lean/registry/open-questions/openq-tools.mjs`, OPENQ-REGISTER.md). What the project holds UNSETTLED and
  what it tried and could not establish. The guard refuses a statement that asserts one arm of an open
  question, so automation cannot settle what the evidence has not.
- **`leanbio_personas`, `leanbio_use_cases`, `leanbio_grand_questions`, `leanbio_tool_gap`**
  (`pipeline/leanbio/capability-map/tools.mjs`, CAPABILITY-REGISTER.md). Read-only, no network, no writes.
  `leanbio_grand_questions` must keep its `formalisable_core` / `empirical_remainder` split visible: a client
  that renders only the core half turns a map of what is formalisable into a claim about what is known.

**Fixed**

- `validate_generation` broke the envelope contract and so **could not be called over HTTP at all**: the
  report carries `scope` but no `provenance` array, and `http.mjs envelopeProblem` therefore answered
  `502 contract violation by validate_generation: envelope has no provenance array. Output withheld.` This
  was a live 502 on the one tool the whole validation entry point rests on, while PIPELINE-REGISTER.md said
  the bridge already served it. The envelope is now built in `tools/pipeline-tools.mjs` (the registration
  surface) rather than in `validate/pipeline/index.mjs`, which belongs to another thread; the whole report
  is unchanged under `result`.
- `server.mjs` threw on import when `process.argv[1]` was undefined (`node -e`, `node --eval`), so
  `await import('./sim-engine/server.mjs')` to read `TOOLS` crashed. Guarded, as `http.mjs` already was.

**Also**

- `sim-engine/cli.mjs` gains `tools` and `tool <name> [--json '<args>']`: a generic passthrough to every
  registered tool, so a tool added to `server.mjs` is reachable from the shell with no change to the CLI.
  The studio verbs are unchanged.

## 0.7.1 (2026-11-01)

**Fixed** (correctness: an accepted law marked a real wild type as violating)

- A glide claim no longer reaches the sustained-power laws. `scenario_run` now commits `flight_mode` in the spec:
  `glide` for the unpowered-descent scenarios (glide, wind, altitude), `powered` when the caller claims level or
  climbing flight. Since lawset 1.6.0 the evaluator scopes E3, C14, C16 and E4 out for a glide, so a real adult
  flying fish making a realistic 40 m glide at 15 m/s now violates NO accepted law, while a claim of sustained
  powered level flight still turns E3 red.
  - The defect: browser-check derives P_req = W·v/(L/D) from any airspeed plus an L/D, and that is the cost of
    LEVEL POWERED flight. A glide is paid for out of height and launch kinetic energy, so it is not a metabolic
    demand for the aerobic ceiling to bound. Feeding it there scored Park & Choi specimens 0.258, level with
    deliberate law-breakers. Same class of error as feeding C15 the kinetic-phase total (fixed in 0.3.1).
- New claim `glide_total_distance_m`: the whole glide, launch kinetic phase included. No theorem covers the sum, so
  it is reported under `lean_inputs.not_covered` and never fed to a law. `ground_distance_m` and `glideDistance_m`
  remain the steady descent, which P4b and C15 do bound.
- `scenario_run` returns `lean_inputs.flight_mode`, `lean_inputs.notes` and `lean_inputs.not_covered`.
- Regression tests, each made to fail once: the real flying fish's 40 m glide violates no accepted law; a sustained
  powered claim still turns E3 red; the TFF powered claim still fires; and no real wild type violates an accepted
  law in any flight scenario.

## 0.7.0 (2026-11-01)

**Added** (one tool)

- `design_score` (`tools/validate-tools.mjs`; scorer v1.0.0 with frozen weights in `validate/score-weights.json`,
  pre-registered in `validate/SCORER-PREREGISTRATION.md`). It is registered from the module's exports ahead of
  VALIDATE-REGISTER.md because the weights are frozen; the other validate tools wait for that file. The hosted
  delphisci MCP (`mcp/` 0.6.0) carries it too, with `network` and `blast` forced off.

## 0.6.0 (2026-11-01)

**Added** (three tools, nothing removed)

- The multi-omics tools (`tools/omics-tools.mjs`, `tools/OMICS-REGISTER.md`): `omics_gene`, `omics_part`,
  `omics_search`. They read `omics/index/`, or fall back to the browser bundle. Kind `borrowed` (proxy species).
  They are registered on the sim-engine server only, not yet on the hosted MCP: that would need the 31 MB index in
  the Docker image (a deployment decision).

## 0.5.0 (2026-11-01)

**Added** (three tools, nothing removed)

- The LeanBio tools (`pipeline/leanbio/tools.mjs`, `tools/LEANBIO-REGISTER.md`): `leanbio_queue`, `leanbio_ground`,
  `leanbio_claim`. They are read-only apart from the grounding cache. The hosted delphisci MCP server (`mcp/`, now
  0.5.0) carries them too, with `leanbio_ground` forced offline there.

## 0.4.0 (2026-11-01)

**Added** (seven tools, nothing removed)

- The swarm task board (`swarm/board.mjs`, `tools/SWARM-REGISTER.md`): `swarm_post_task`, `swarm_claim`,
  `swarm_submit`, `swarm_status`, `swarm_try_edits`. Results land in codesign sessions as proposals or comments;
  humans still decide with `session_decide`.
- The generative backends (`tools/generative-tools.mjs`, `tools/GENERATIVE-REGISTER.md`): `generate_candidates`,
  `generative_backends_status`. A candidate's `organism` is an organism document, so `optimize` accepts it
  unchanged.

**Changed**

- P2b takes its area from the current scenario's `lean_inputs.drag_reference_area_m2`, the area Cd refers to, with
  no division. CdA / Cd is kept only as a fallback for a module without that field. A studio test fails if P2b
  stops being fed for an unedited zebrafish in the current scenario.

## 0.3.4 (2026-11-01)

**Added** (no breaking change): LeanBio self-update (lean/registry/SELF-UPDATE.md).

- Two new tools: `lean_source_status` and `lean_changes`.
  - `lean_source_status {refresh?}` says where the laws come from: local files, the `/api/lean/` mirror, or raw
    `lean/registry/` on a git ref. It also reports freshness, the TTL, ETag/304 counts, integrity, and the last
    error or rejected fetch.
  - `lean_changes {since_version?}` lists lawset releases newer than a version. Each entry has the CHANGELOG
    prose and a diff of the lawset pins.
- **Every `lean_*` envelope gains four top-level fields:** `source` (`local` | `local-fallback` | `remote:mirror` |
  `remote:github`), `lawset_version` (the current lawset of that source), `fetched_at`, and `source_detail`
  (URL, ref, `checked_at`, integrity, `remote_error`). The fields `contract_version`, `result`, `provenance`,
  `scope`, `weakest_input` and `counts` are unchanged.
- With `LEANBIO_REMOTE=mirror|github`, the loader re-checks the remote at most once per `LEANBIO_TTL_S` (default
  600 s) before a `lean_*` call. It verifies every pinned law against its lawset's `content_hash` and keeps the
  last good set on any failure. The default is `off`, which keeps the current behaviour.

## 0.3.3 (2026-11-01)

**Added** (no breaking change)

- **P4** (minimum airspeed at altitude) is fed from the altitude scenario: its `altitude_m`, `launch_airspeed_m_s`,
  C_Lmax and lifting area.
  - C_Lmax is parsed from its provenance string `"0.78 / 4.37"` with a strict pattern; the owner has been asked
    for a number.
  - The lifting area is evaluated in a second pass that is used **only** for P4 and C9 (the design against
    itself). The reference-specimen rows (C2a, C8e, C9c) never see it, because their area convention differs
    from STATE's mesh area.
- **P4b** (glide ground range) is fed from the glide scenario in still air: its `glide_airspeed_m_s`, (L/D)max,
  launch height, and the Lean-covered descent distance (never the total).
- **P5** (energy balance) is fed from the digestion scenario:
  - `energy_intake_J_day` and `routine_cost_J_day`;
  - assimilation = 1 − `faecal_loss_fraction` and `sda_coefficient`, both scenario params;
  - activity cost 0, because routine metabolic rate already includes spontaneous activity;
  - `mass_change` = the sign of the scenario's own net energy.
- `scenario_run` gains `claims`: designer assertions that the laws check, labelled `CLAIM` in `lean_inputs.sources`.
  Unknown keys are refused. Tested: a claimed 10 m glide from 1 m turns P4b red; a mass-gain claim on a ration
  below maintenance turns P5 red.
- **Not fed yet; the module owners must add these output fields** (prose is never parsed and nothing is
  defaulted):
  - `current.mjs` (P2b): `drag_coefficient` (number, the Cd it uses at the current), `drag_area_m2` (the reference
    area that Cd multiplies), `aerobic_ceiling_W` (the Fick or red-muscle sustained ceiling it compares against).
  - `temperature.mjs` (P1b): `q10` as a number (which one: SMR 1.56 or MMR 1.34), `reference_temperature_C`,
    `reference_sustained_power_W`, `sustained_power_W` at the test temperature.
  - `wind.mjs` (P4b with wind): `descent_airspeed_m_s` (the horizontal airspeed during the h·L/D descent) and
    `descent_ground_distance_m` (the descent-phase ground distance with the wind applied, excluding the kinetic
    phase).
  - `altitude.mjs` (P4): `CLmax` and `LD_max` as numbers rather than inside the provenance string.

## 0.3.2 (2026-11-01)

**Changed** (no schema change)

- P3 (perturb-pressure v2.0.0, lawset 1.4.0 and later) is fed the pressure scenario's own `water_density_kg_m3`
  and `surface_pressure_Pa` (from its provenance), and `g` (recovered exactly from its own `pressure_kPa = P0 + rho g z`).
  The bladder volumes come from STATE. A correct Boyle volume now holds at 100 m and 1000 m (tested).
- Violation severity follows the law's registry status, read on every call: from lawset 1.5.0, P1, P2, P4 and P5
  are accepted, so a zebrafish at 45 °C shows P1 in red.
- `params/ontogeny-flyingfish-additions.json` is merged into the bundle's ontogeny as a second layer (`lib/data-node.mjs`
  `mergeOntogenyAdditions`; ontogeny.json and its builder are untouched). Each proposal tag maps to one rule:
  - `replace`, `new field` or upgrade source: the addition is used.
  - `fill null`: used only where the base is null.
  - `bound only`, `corroborates` or `keep ...`: the base is kept and the addition attached.
  - `stays null`: the reason is updated.

  Every merged field carries `merged_from`, and `ontogeny.merge_log` lists each decision. Effects on STATE for
  flying fish:
  - adult `red_muscle_fraction` is 0.1055, derived from flying-fish dark-muscle data, replacing the trout 0.05,
    which is kept as the `alternative`;
  - `has_swimbladder` is sourced at 30, 90 and 365 d;
  - adult and 90 d `frontal_area_m2` come from measured depth and width.
- The adult flying-fish mass used by STATE is unchanged at 0.060 kg, the Park & Choi aerodynamic specimen. Its
  flags now state both roles. The H. affinis population value, 0.1316 kg, stays in ontogeny.json for stage
  targets (physics-thread decision).
- `test/ontogeny.mjs` EXTRA_UNITS gains `pectoral_len_over_SL: 'fraction of SL'`.

## 0.3.1 (2026-11-01)

**Added** (no breaking change)

- The Lean perturbation laws (P1–P5, lawset 1.2.0) are now fed. `lib/perturb-map.mjs` maps STATE, the
  scenario's params and its own computed metrics onto the exact names `checkPerturb` reads. `scenario_run`
  returns them, with where each came from, as `lean_inputs: {spec, sources}`. `optimize` passes them for every
  candidate.
  - P1: the temperature param, the scenario's `ctmax_C`/`ctmin_C`, and routine metabolic power as sustained power.
  - P2: the current param, and the scenario's `ucrit_m_s` (else STATE `ucrit_m_s`).
  - P3b: the depth param and `teleost`.
  - Not fed, and so cannot-evaluate:
    - P1b, P2b, P4, P4b and P5: no committed Q10 reference, Cd and A, CLmax, L/D or assimilation efficiency.
    - P3: the pressure scenario's real-hydrostatics Boyle volume exceeds the law's "1 atm per 10 m" bound by
      about 0.5–1 % at every depth. That is a convention mismatch, not a violation.
- C15 (`glide_range_le`) is fed by the glide and altitude scenarios with ONLY `glide_range_lean_bound_m`, the
  h·(L/D) steady descent, and only when the glide is feasible. `glide_range_total_m` adds a level kinetic phase
  that the theorem's hypotheses do not cover, so it is never passed. C15 is therefore a consistency check of the
  scenario's bound against the theorem, not an independent test.
- Citations in `lib/state.mjs` fixed (constants audit). The standard-atmosphere constants now cite U.S. Standard
  Atmosphere, 1976 (NASA-TM-X-74335, https://ntrs.nasa.gov/citations/19770009539; identical to ICAO/ISO 2533
  below 11 km), with the equation; they were never in conditions/baseline.json. The swim-bladder 0.037–0.065 is
  now labelled `mean_pm_sd` (Robertson 2008, mean ± 1 SD), not a range. Values unchanged.
- Violation `severity` gains `candidate`: a law with status candidate, which the UI draws dashed. It sits
  alongside `red` (accepted) and `amber` (contested).

**Fixed**

- `leanSpec` passed STATE `lifting_area_m2` as `finArea_m2`, which contradicts the documented convention (mesh
  pectoral + pelvic + caudal, not the Lean reference's pectoral + pelvic + body planform). It is no longer
  passed.

## 0.3.0 (2026-11-01)

**Breaking**

- `session_post` with `kind: 'edit'` is now refused unless the author role starts with `human`. Agents post a
  `proposal` instead. A proposal is `edits[]` plus a `rationale` and `evidence`; it is validated, not applied,
  and gets a `proposal_id`.
- `optimize` now scores the start design first and has three statuses: `ok`, `no improvement` (the start
  design is returned unchanged; a flat objective always gives this) and `no design meets the spec`. The
  result key `feasible`, a count of feasible candidates, is renamed `feasible_candidates`. `tools/spec-tools.mjs`
  still reads `o.feasible`, so it reports 0 there until it switches.
- Bundle manifests (`lib/data-node.mjs`, `engine/data/bundle.json`) changed from arrays of parts to the
  manifest's own shape, `{file, organism, objects:[{object, ...}], parameters, units_and_axes, derived_from_the_mesh}`.
  This is the one shape node and the browser both read, and the one `partedit.js` reads.

**Added**

- `session_decide {session, proposal_id, decision, decided_by_role, reason}`: a human role approves (edits
  are applied atomically, each with `approved_by` and `proposal_id`) or rejects. Both record `lawset_version`
  and the violations.
- Scenario result field `feasible` (true, false or null): whether the behaviour asked about is possible.
  `survives` stays: whether the organism survives the perturbation. A module without `feasible` gets null and a
  warning. `optimize` hard constraints accept `{scenario, feasible}`. `scenario_timecourse` rows carry
  `survives`, `feasible`, `feasibility_note` and `limiting`.
- `contract_version` in every envelope and in `contract.json`.
- Optional STATE fields: `lifting_area_m2` (mesh-derived), `cardiac_output_max_ml_s` (borrowed), and
  `myotomal_muscle_fraction`, `swimbladder_volume_fraction`, `pcrit_kPa` (null with a reason where nothing is
  sourced). Also `routine_metabolic_rate_umol_g_h`, `standard_metabolic_rate_umol_g_h`, `ucrit_m_s`,
  `o2_uptake_site` and `hb_needed_for_routine_O2`, all from ontogeny.json.
- `params/ontogeny.json` is consumed by `resolveState` per `params/ONTOGENY.md`. Fields record which source won
  and why (`source_choice`, `alternative`).
- Part targets and geometric params come from `dashboard/public/blueprint3d/partedit.js`, through
  `lib/partedit-link.mjs`. Bilateral base names and ontology ids are accepted, and partedit's bounds and modes
  are enforced. `organism_get` and `scenario_run` accept `measured` (from partedit `measurePart`).
- Lean checks receive `taxon` and `life_stage`, so the registry's scope rules apply (clade-scoped laws are
  `out-of-scope`, not red).
- `scenario_list` reads the scenarios directory at call time and re-imports changed files.
- Registered `parse_design_text` and `design_from_spec` (`tools/SPEC-REGISTER.md`).

## 0.2.0 (2026-10-31)

**Breaking**

- `lean_check` changed from v1 (browser-check's raw row array) to v2 (`tools/lean-tools.mjs`). The v2 result is
  `{lawset, kernel, summary, verdicts, violations, excluded, ...}`, with each row tagged
  `{law_id, version, kind, status, binding}`.

**Added**

- The Lean law registry tools: `lean_laws_list`, `lean_law_get`, `lean_lawset_get`, `lean_propose`,
  `lean_verify`.
- The Design Studio tools: `organism_create`, `organism_get`, `organism_list_parts`, `organism_edit`,
  `scenario_list`, `scenario_run`, `scenario_timecourse`, `optimize`, `session_open`, `session_post`,
  `session_read`.
- The STATE object, the scenario interface (`scenarios/index.mjs`) and the browser engine copy.

## 0.1.0 (2026-10-31)

- v1: `morphogen_diffusion`, `protein_structure`, `physiology_chain`, `growth_trajectory`, `lean_check` (v1).
