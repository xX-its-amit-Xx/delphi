# sim-engine contract changelog

The contract is the tool names, their JSON Schemas (`contract.json`), the envelope, the STATE fields and
the scenario interface. Its version is `CONTRACT_VERSION` in `lib/envelope.mjs`. Every envelope carries it
as `contract_version`, and `contract.json` states it. The rule: anything may change, provided it is
versioned here. While the major version is 0, a minor bump may break callers; each entry says what breaks.

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
