# sim-engine contract changelog

The contract is the tool names, their JSON Schemas (`contract.json`), the envelope, the STATE fields and
the scenario interface. Its version is `CONTRACT_VERSION` in `lib/envelope.mjs`. Every envelope carries it
as `contract_version`, and `contract.json` states it. The rule: anything may change, provided it is
versioned here. While the major version is 0, a minor bump may break callers; each entry says what breaks.

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
