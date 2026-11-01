# Turning a user's request into a DesignSpec (guide for LLM agents)

The user says what a living thing must DO. You turn that into a **DesignSpec**; the engine checks it,
designs against it and says, criterion by criterion and stage by stage, whether the design meets it.

Division of labour:

- **You** do the language understanding: what the user means, which scenario models it, what
  number they intend, which life stages, what is a hard requirement and what is a preference.
- **The tools** do validation and computation: `design_from_spec` rejects any scenario, metric, unit,
  part or parameter the engine does not have, maps aliases to the real keys (and says so in
  `warnings`), and refuses birds and Lean waivers.
- `parse_design_text` is a deterministic rule-based parser, not a language model. Use it as a
  cross-check of your reading, or as a fallback. Everything it cannot read comes back in `unparsed`.

## The shape

```
{ start_from:  [{ organism, weight }],                          weights sum to 1
  base_edits:  [{ target:{level,id}, param, op, value }]         optional, applied before optimising
  criteria:    [{ scenario, params, metric, op, value, unit, stages, weight, hard }]
  editable:    [{ target:{level,id}, param, min, max }]          what the optimiser may change
  constraints: { lean: 'must-hold' } }                           always; cannot be waived
```

- `op`: `>=`, `<=`, `survives`, `maximize`, `minimize`. Thresholds and `survives` default to **hard**;
  `maximize`/`minimize` are always soft.
- `stages`: `'all'`, a list of `embryo` / `larva` / `juvenile` / `adult`, or `{ageDays:{min,max}}` in
  **days after hatching** (zebrafish hatch at about 2 dpf: 30 dpf is 28 days after hatching). A stage
  name visits every age in the design's own stage table whose label starts with it (two larval ages,
  two evaluations). `embryo` maps to the hatching-period stage, the earliest the tracks hold.
- Organisms: `zebrafish-adult` (the zebrafish reference; its track runs hatching to adult),
  `zebrafish-larva`, `flying-fish`, `tff`, `winged-zebrafish`, `wingless-flying-fish`, `ff-zf-chimera`.
- Scenarios, their params and metrics: call `scenario_list`. Targets and editable params: call
  `organism_list_parts` on the starting organism. Use those keys; do not invent new ones.

## Procedure

1. **Read the request into criteria.** One requirement, one criterion. A range ("4 to 32 °C")
   is two `survives` criteria, one at each end. "Outswims a 0.3 m/s current" is `current`,
   `survives`, `params:{current_m_s:0.3}`. "Swims at least 10 BL/s" is a threshold on `ucrit_bl_s`.
2. **Decide hard or soft** from the user's words: "must", "survive", "at least" are hard;
   "ideally", "if possible", "as far as possible" are soft.
3. **Stages**: use what the user said. If they said nothing, the default is adult; tell them so.
4. **Never fill a gap with a guess.** No number ("survives cold water"), an unknown unit, a
   scenario the engine does not have, a fish the bundle does not have: ask the user. Do not map
   "salmon" to zebrafish or "cold" to 4 °C.
5. **Editable**: the parts and params the user allows to change, with ranges. No editable
   params means `design_from_spec` evaluates the starting design only.
6. Call `design_from_spec`. If `status` is `invalid`, fix each `validation.errors` item (they name the
   field and what the engine accepts) and call again. Read `warnings`: they report alias mapping and
   unit conversion done for you.
7. **Report honestly.** Quote `summary`. "Meets the spec" only when `meets` is true. For each
   criterion give the verdict per stage, the `limiting` factor and the `weakest_provenance`. A
   `no-model` verdict is not met; say what model is missing (`scope` says why). The optimiser is a
   local search over one metric; say so if the result is "no design meets the spec".

## Two refusals that are not negotiable

- **Birds.** Aves are a frozen holdout. Do not copy a bird, use a bird number, or name a bird as a
  parent or target, even "just for comparison". Restate the function instead (example 4).
- **Lean.** `constraints.lean` is always `must-hold`. A request to ignore the laws is refused.

---

## Worked example 1: the headline request

> "a zebrafish that glides at least 30 m from 1 m height, survives 4 °C to 32 °C, outswims a 0.3 m/s
> current as a larva and adult, keep the Lean laws"

```json
{ "start_from": [{ "organism": "zebrafish-adult", "weight": 1 }],
  "criteria": [
    { "scenario": "glide", "metric": "glide_range_total_m", "op": ">=", "value": 30, "unit": "m", "params": { "launch_height_m": 1 }, "stages": ["adult"] },
    { "scenario": "temperature", "op": "survives", "params": { "water_temperature_C": 4 }, "stages": ["adult"] },
    { "scenario": "temperature", "op": "survives", "params": { "water_temperature_C": 32 }, "stages": ["adult"] },
    { "scenario": "current", "op": "survives", "params": { "current_m_s": 0.3 }, "stages": ["larva", "adult"] } ],
  "editable": [],
  "constraints": { "lean": "must-hold" } }
```

Tell the user that glide and temperature were not given a stage, so adult was assumed. With no
editable parameters this is an evaluation of the plain zebrafish (when checked on 2026-10-31 it failed: cannot reach glide speed, below
CTmin at 4 °C, swept downstream as a larva). Offer editable parts next.

## Worked example 2: a blend, an objective and a range

> "Start from 70% zebrafish and 30% flying fish. Glide as far as possible from 1 m. The adult must
> survive 18 to 30 °C. You may change the pectoral fin area between 0.016 and 0.2 of SL squared."

```json
{ "start_from": [{ "organism": "zebrafish-adult", "weight": 0.7 }, { "organism": "flying-fish", "weight": 0.3 }],
  "criteria": [
    { "scenario": "glide", "metric": "glide_range_total_m", "op": "maximize", "params": { "launch_height_m": 1 }, "stages": ["adult"], "hard": false },
    { "scenario": "temperature", "op": "survives", "params": { "water_temperature_C": 18 }, "stages": ["adult"] },
    { "scenario": "temperature", "op": "survives", "params": { "water_temperature_C": 30 }, "stages": ["adult"] } ],
  "editable": [{ "target": { "level": "organ", "id": "UBERON_0000151" }, "param": "pectoral_area_over_SL2", "min": 0.016, "max": 0.2 }],
  "constraints": { "lean": "must-hold" } }
```

The range comes from the parents (zebrafish 0.016, flying fish 0.155) with headroom; say where you got
it. The optimiser climbs `glide_range_total_m`; the temperature criteria are its hard constraints.

## Worked example 3: vague words, so ask first

> "I want a fish that can handle a fast river when it's young."

Do not call the tool yet. "Fast" has no number and "young" could be larva or juvenile. Ask:
"How fast is the river (m/s or km/h), and do you mean larva (first ~2 weeks) or juvenile?" If the
user answers "about 1 m/s, juvenile", the criterion is:

```json
{ "start_from": [{ "organism": "zebrafish-adult", "weight": 1 }],
  "criteria": [{ "scenario": "current", "op": "survives", "params": { "current_m_s": 1 }, "stages": ["juvenile"] }],
  "editable": [{ "target": { "level": "body", "id": "body" }, "param": "red_muscle_fraction", "min": 0.02, "max": 0.3 }],
  "constraints": { "lean": "must-hold" } }
```

`parse_design_text` would return the first sentence in `unparsed` ("current without a speed"), which
is the same signal: missing information is asked for, not invented. The editable range is a proposal;
state it to the user as one.

## Worked example 4: a bird request

> "Make the flying fish fly like a swallow."

Refuse the bird: "Birds are a frozen holdout in DELPHI, so I can't copy a swallow or use swallow
data." Then restate the function and confirm it with the user, e.g. "a flying fish whose adult
glides at least 50 m from 1 m with a take-off speed no higher than 12 m/s":

```json
{ "start_from": [{ "organism": "flying-fish", "weight": 1 }],
  "criteria": [
    { "scenario": "glide", "metric": "glide_range_total_m", "op": ">=", "value": 50, "unit": "m", "params": { "launch_height_m": 1 }, "stages": ["adult"] },
    { "scenario": "glide", "metric": "v_min_m_s", "op": "<=", "value": 12, "unit": "m/s", "params": { "launch_height_m": 1 }, "stages": ["adult"] } ],
  "editable": [
    { "target": { "level": "organ", "id": "UBERON_0000151" }, "param": "pectoral_span_over_SL", "min": 1.0, "max": 1.6 },
    { "target": { "level": "body", "id": "body" }, "param": "flight_muscle_fraction", "min": 0.04, "max": 0.15 } ],
  "constraints": { "lean": "must-hold" } }
```

The numbers are the user's, not a bird's. `flight_muscle_fraction` is an assumed placeholder in both
parents; the explanation will show `weakest_provenance: assumed` for any verdict resting on it.
Report that.

## Worked example 5: depth, an age in dpf, and a behaviour

> "It has to survive 100 m down at 30 dpf and as an adult, and sleep at least 6 hours a day."

```json
{ "start_from": [{ "organism": "zebrafish-adult", "weight": 1 }],
  "criteria": [
    { "scenario": "pressure", "op": "survives", "params": { "depth_m": 100 }, "stages": { "ageDays": { "min": 28, "max": 28 } } },
    { "scenario": "pressure", "op": "survives", "params": { "depth_m": 100 }, "stages": ["adult"] },
    { "scenario": "sleep", "metric": "sleep_hours_per_day", "op": ">=", "value": 6, "unit": "h", "stages": ["adult"] } ],
  "editable": [],
  "constraints": { "lean": "must-hold" } }
```

30 dpf is 28 days after hatching. Two criteria, because a stage list and an age range cannot be mixed
in one. The user said "100 m down" with no water type; the pressure scenario takes depth directly,
so nothing was assumed. (Had they said "10 atm", validation converts it to depth as seawater and says
so in `warnings`.) If the pressure scenario returns no survival verdict, the criterion is
`no-model` and the design does **not** meet the spec; say which number is missing.

---

## Reading the answer

```
result.status        'invalid' | 'evaluated-only' | 'meets the spec' | 'best found does not meet the spec'
                     | 'no design meets the spec' | 'optimizer-error' | 'needs clarification'
result.meets         true only if every hard criterion is met at every stage AND no Lean law fails
result.summary       one honest line; quote it
result.design / result.starting_design
  .explanation.criteria[i].stages[j]  { stage, verdict: met|failed|no-model, value, unit, limiting,
                                        weakest_provenance, why, scope, age_days }
result.optimizer     objective climbed, hard constraints passed, evaluations, rejection reasons
```
