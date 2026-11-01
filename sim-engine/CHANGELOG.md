# sim-engine contract changelog

The contract is the tool names, their JSON Schemas (`contract.json`), the envelope, the STATE fields and
the scenario interface. Its version is `CONTRACT_VERSION` in `lib/envelope.mjs`. Every envelope carries it
as `contract_version`, and `contract.json` states it. The rule: anything may change, provided it is
versioned here. While the major version is 0, a minor bump may break callers; each entry says what breaks.

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
