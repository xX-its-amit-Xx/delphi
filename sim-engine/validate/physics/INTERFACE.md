# `physics_simulation`: the fifth named result

**For the scorer agent.** Wire this in exactly the way `functional_resolution` is wired in. It is **NOT
folded into the composite score**; it sits beside it as a gate, like the Lean gate.

Nothing in `validate/score*.mjs`, `functional-interface.mjs`, `benchmark/`, `evaluation/`, the scenarios
or `dashboard/public/t/physics/sim/` was touched by this thread.

---

## The distinction that must survive the wiring

| named result | what it says |
|---|---|
| `lean_check` | the design **breaks no law**. Necessary, never sufficient. A brick breaks no law of flight; it just does not fly. |
| `physics_simulation` | the design **actually does the thing**: the real scenario modules are run through the engine at every requested life stage and the criterion is measured, with the spread of its inputs carried through. |

A design can pass `lean_check` and fail here, and that is the normal case. Please keep both sentences in
any UI label: "no law broken" and "does the thing" are different claims.

---

## The export

```js
import { physicsCheck } from './physics/index.mjs';

const physics_simulation = await physicsCheck(design, opts);
```

```
physicsCheck(design, opts) -> Promise<Result>     // never throws for a missing model; it says `no model`
```

- **`design`** — an organism id (`'tff'`), an inline organism document, or `{specimen}`. A specimen is a
  shape measurement with no STATE, so it comes back `{ran: false, reason}`; nothing is assumed in its place.
  This is the same argument `functionalResolutionFor` receives, so
  `args.design_for_functional ?? (args.specimen ? {specimen: args.specimen} : args.organism)` works unchanged.
- **`opts`**
  | key | meaning |
  |---|---|
  | `spec` | **a `DesignSpec` (`lib/spec.mjs`). AUTHORITATIVE when present: that IS the desired function.** The unifying validator (`validate/pipeline/`) parses the desired-phenotype prompt with `parse-text.mjs` and passes the spec here. With no spec a default is inferred from the design's declared intent and every criterion is marked `inferred: true`. |
  | `ageDays` | pin every criterion to one age instead of its declared stages |
  | `conditions` | passed straight to `resolveState` (depth, temperature, headwind, …) |
  | `draws` | ensemble draws per criterion per stage (default 200; `0` or `ensemble: false` switches it off) |
  | `seed` | ensemble seed (default `'delphi-v1'`); the same seed gives the same ensemble |
  | `launch_height_m` | launch height for the standing flight checks (default 1 m) |

### Suggested call site in `score.mjs`, beside the existing fourth result

```js
// The FIFTH named result. Built in validate/physics/; a gate, never part of the score.
out.physics = await physicsCheck(
  args.design_for_functional ?? (args.specimen ? { specimen: args.specimen } : args.organism),
  args,                                    // args.spec is picked up if the caller supplied one
);
```

and in `namedResults` / `validateDesign`:

```js
physics_simulation: out.physics,
physics_gate_failed: !!(out.physics.ran && out.physics.physics_gate_failed),
```

`physics_gate_failed` is **true when a hard criterion is not met**. It is deliberately *not* raised by a
hard criterion that has **no model**: that case sets `gate_status: 'incomplete'` and is listed in
`unchecked_requirements`, because "we could not check it" is not "it failed". `function_achieved` is the
field to show a user: it is `true` only when every hard criterion is `met` and none is `no model`.

---

## The return shape

```js
{
  ran: true,                    // false + `reason` when the design cannot be resolved or has no STATE
  version: '1.0.0',

  design: { id, parents: [{organism, weight}], n_edits, species },

  target_function: {
    source: 'spec' | 'inferred',
    statement: string,          // says plainly whether it was given or chosen
    // source === 'spec':
    spec_ok, spec_errors[], spec_warnings[], n_criteria,
    // source === 'inferred':
    inferred_function: 'powered-flight' | 'glide' | 'swim',
    why: string, inferred_from: string,      // the words the inference read
  },

  criteria: [{
    id, scenario, metric, op, value, unit, stages, hard, weight,
    inferred: boolean, source_text, params,
    status: 'met' | 'not met' | 'met in part' | 'no model' | 'no threshold',
    stages_met, stages_total, limiting_factor,
    model_confidence: ModelConfidence,
    per_stage: [{
      stage, ageDays, stage_label, SL_m, mass_kg,
      status: 'met' | 'not met' | 'no model' | 'no threshold',
      measured, metric, metric_kind, unit, threshold, op,
      limiting_factor,            // WHY it is not met, in words, naming the binding quantity
      out_of_validity,            // the scenario's own validity note when the organism is outside it
      dropped_params,             // params the scenario does not declare (they would refuse the run)
      ensemble: Ensemble | null,
      model_confidence: ModelConfidence,
      statement,                  // "met (model_confidence=circular (weakest input assumed))"
    }],
  }],

  standing_checks: [{            // run whether or not the spec asked; NEVER summed into one number
    id: 'reaches_minimum_flight_speed' | 'lifting_area_supports_mass'
      | 'sustained_swimming_aerobic_ceiling' | 'organ_volume_fits_body' | 'static_pitch_margin',
    label, stage, ageDays,
    status: 'met' | 'not met' | 'no model',
    measured, unit, threshold, op, limiting_factor, detail, gating: false,
    model_confidence: ModelConfidence,
  }],

  unchecked_requirements: [{ criterion, scenario, metric, hard, stage?, why }],
                                // every requirement no scenario could model. NEVER dropped, never met.

  function_achieved: boolean,     // every hard criterion met AND none unchecked
  physics_gate_failed: boolean,   // a hard criterion is NOT MET
  gate_status: 'pass' | 'fail' | 'incomplete' | 'nothing checked',
  gate: string,                   // one paragraph: incompleteness first, then failures, then standing checks

  summary: { hard_criteria, met, not_met, no_model, standing_checks, standing_failed, standing_no_model },

  model_honesty: {
    circular_checks: [{ where, why: string[] }],
    rests_on_assumed: string[],
    independent_harness: string,  // which studio-results.json run was read
    statement: string,
  },

  scenario_errors: string[],      // scenario modules that failed to load, so a silent gap is visible
  scope: string, ms: number,
}
```

### `ModelConfidence` — the part that stops this becoming theatre

Every check carries one. **Never report "function achieved" without it.**

```js
{
  validated: 'independent' | 'rests-on-assumed' | 'circular-in-part' | 'circular' | 'unvalidated' | 'no model',
  scenario, model,              // which module stands behind the check
  equations[], sources[],       // the scenario's own modelCard
  weakest_input_kind,           // 'measured' … 'assumed' (CONTRACT.md kinds)
  circular: boolean,
  circular_inputs: string[],    // WHICH input makes it circular, quoted
  studio_tests: [{ id, name, status, amended_status, effective, why }],
  validated_against: [...],     // the scenario's own modelCard.validatedAgainst, verbatim
  independent_harness: string,
  statement: string,            // one paragraph a human can read
}
```

The grades mean:

| grade | meaning |
|---|---|
| `independent` | the modelCard shows a prediction compared with a measurement that did **not** set any of its inputs. |
| `rests-on-assumed` | it lands where it should, but the weakest input is `assumed` or `borrowed`. |
| `circular-in-part` | some comparisons are independent, at least one is not. |
| `circular` | the number it is scored against was read back from, fitted to, or calibrated against the paper it is compared with. **Not evidence, however green it looks.** |
| `unvalidated` | the scenario declares no `validatedAgainst` and the independent harness has no row for it. |
| `no model` | there is no model. Never a pass. |

Nothing in that grading is hard-coded per scenario: it is read at call time from the scenario's own
`modelCard` and from `sim-engine/validation/studio-results.json`, so it moves when they move.

### `Ensemble` — never a bare yes/no when the inputs have a spread

```js
{
  source: 'creatures.js' | 'own', file, fell_back_because?,
  seed, draws,
  fraction_achieved,            // THE HEADLINE: share of draws in which the criterion holds
  draws_achieved,
  median, p5, p95, min, max, n_numeric, unit,
  species_gate: { is_flier, note },
  not_drawn: string[],          // quantities deliberately NOT drawn, and the reason is in `species_gate.note`
  sea_state, distributions: [{ key, label, unit, shape, band, sd, cv, band_kind, shape_kind, applies, source }],
  note,                         // the "uncertainty illustration, not a measured distribution" note
  rule, disagrees_with_point_estimate?,
}
```

**The rule, applied and documented:** `fraction_achieved` decides. A design that meets a criterion in the
single deterministic run but in fewer than half the draws is reported **`not met`**, and the limiting
factor names the fraction. *A design that achieves its function in 8 % of draws has not achieved it.*

The ensemble **consumes** `dashboard/public/t/physics/sim/creatures.js` (`makeRng`, `perturbRun`,
`DISTRIBUTIONS`, `summarise`, `isFlier`) when it is present — it is, and `source` says `creatures.js`. If
it ever disappears, `ensemble.mjs`'s own `OWN_DISTRIBUTIONS` implements the same stated distributions from
the same sources and `source` says `own` with `fell_back_because`. The draws are pushed through the
**engine's own scenario modules**, not creatures.js's solver, so the physics stays the engine's and only
the inputs move; the drawn area and span are applied as **factors** on STATE because the draw is in Park &
Choi's reference-area convention while STATE's `lifting_area_m2` is pectoral + pelvic + caudal.

`band_kind` (provenance of the **spread**) is kept apart from `shape_kind` (provenance of the **shape**),
which is almost always `assumed`. Do not collapse them in a UI.

---

## Controls

`node sim-engine/validate/physics/controls.mjs` writes `physics-results.json` and `RESULTS.md` and exits
non-zero if any control comes out the wrong way round. Current run: **5 of 5 correct.**

| id | organism | function | expected | got |
|---|---|---|---|---|
| C1 | `flying-fish` | realistic glide (feasible, ≥ 10 m from 1 m) | pass | pass |
| C2 | `zebrafish-adult` | the same glide | fail | fail |
| C3 | `wingless-flying-fish` | the same glide | fail | fail |
| C4 | `tff` | powered flight (aerobic margin ≥ 1) | fail | fail |
| C5 | `zebrafish-adult` | swim only (hold station at 0.2 m/s) | pass | pass |

## Tests

`node sim-engine/validate/physics/test/physics.mjs` — **121 checks, all passing.** `MUTATE=<name>` plants a
defect so each check can be seen to work; `--selftest` plants every mutation in turn and confirms each is
caught (all six are). The two the brief asked for by name:

- a design that cannot reach `v_min` must never report its function achieved (§2, three organisms);
- a scenario with no model must report `no model` rather than a pass (§3, three ways: an absent scenario,
  a metric not computable on this STATE, and a stage the organism's staging table does not have).

§9b guards a defect found while building this and worth knowing about downstream: `creatures.js`'s
`isFlier` reads the **species** text only — it was written for the adult simulator — so without a stage
gate a flying-fish **larva** is handed the adult 15–20 m/s taxi band and "glides". That is the independent
validation thread's defect **D1** coming back through the ensemble. `ensemble.mjs` therefore draws the band
only when the engine's own launch speed for that STATE is already a taxi speed, and reports
`species_gate.launch_speed_drawn: false` with the reason otherwise. Anyone else consuming
`creatures.js`'s `perturbRun` across developmental stages needs the same gate.
