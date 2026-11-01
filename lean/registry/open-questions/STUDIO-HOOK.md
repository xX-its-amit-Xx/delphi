# Hook note for the scorer and studio threads: verdicts that rest on an unsettled question

**This is a note, not a patch to your files.** Nothing in `sim-engine/validate/score*.mjs`, the scenarios or the
Studio pages has been edited. Everything below is already available through a read-only API; the decision about
your own files is yours.

## The problem

A design can pass or fail a row for a reason this project has not settled. Today that verdict comes out green or
red with no indication, which is the one outcome that is certainly wrong: it reports a settled judgement where
the project holds an open question. **Neither red nor green — "this rests on an unsettled question."**

Concretely, from the seven questions now recorded:

| if a verdict depends on | the unsettled thing is | question |
|---|---|---|
| `U_crit` for an adult zebrafish | 0.56 m/s or 0.24 m/s — a ~2x protocol effect, same temperature. The repo already carries the interval `[0.24, 0.56]` rather than a point | `oq-zebrafish-adult-ucrit` |
| flying-fish `adult_mass`, wing loading or `v_min` | 0.060 kg (the aerodynamic specimen) or 0.100–0.132 kg (population fits). With 0.1316 kg, wing loading goes 46.4 → 101.7 N/m² and `v_min` 9.85 → 14.6 m/s | `oq-flying-fish-adult-mass` |
| a sleep fraction | 58.2% or 83.9% for the same larval stage, depending on the movement criterion | `oq-larval-sleep-definition` |
| maximum operating depth near 8 km (constraint `P3b`, law `perturb-depth-cap`) | the 8200 m cap is **refuted** by a real fish at 8336 m; what is open is whether the mechanism sets a deeper ceiling or none | `oq-teleost-depth-cap` |
| a kcnk5b genotype edit's bioelectric mechanism | the SIGN of the membrane-potential change in the tissue that matters | `oq-kcnk5b-vm-sign` |
| pathway membership of an edited gene | four curated sources agree at Jaccard 0.12–0.28 even for Wnt | `oq-pathway-membership` |
| the `lat4a`/`slc43a2a` edit's identity | which paralogue carries the flying-fish signal (the zebrafish allele IS settled onto `slc43a2a`) | `oq-lat4a-paralogue` |

Note the useful ones are mostly **not** scientific disputes. Three of them need a **convention** — which referent
a claim is making — not more data. So the flag is not "we don't know"; it is "this number depends on a choice
nobody has recorded".

## What to read, and from where

Everything is served from the existing static mirror and needs no new dependency:

```
/api/lean/open-questions.json              summary: every question, its arms, its computed proportion, its `touches`
/api/lean/open-questions/<question_id>.json  one full record: arms, evidence quotes, what_would_settle_it
```

In Node, or if you would rather not hard-code paths:

```js
const openq = await import('../../lean/registry/open-questions/openq-lib.mjs');
const open = openq.openQuestions();                 // status === 'open' only
// which open questions bear on a row, by the law/constraint/property it used:
const hits = open.filter(q => [...(q.touches.law_ids || []), ...(q.touches.constraints || []),
                               ...(q.touches.design_properties || []), ...(q.touches.scenario_keys || [])]
                               .includes(key));
```

`touches` is the join key, and it carries `law_ids`, `constraints`, `design_properties` and `scenario_keys`
precisely so you can match on whichever of those your row already knows.

Via MCP or CLI, without importing anything:

```bash
node lean/registry/open-questions/cli.mjs questions --touches perturb-depth-cap
node lean/registry/open-questions/cli.mjs questions --touches adult_mass
```

## Suggested row shape

This mirrors the existing `display`/`verdict` convention in `lean/registry/README.md`, where only
`display: 'red'` means "violates a law", and `contested` and `out-of-scope` already do not match `/^viol/`:

```js
{
  verdict: 'rests-on-open-question',   // not 'holds', not 'violated'
  display: 'amber',                    // a page mapping /^viol/ to red keeps working unchanged
  computed_verdict: <what the formula said>,
  open_questions: [{
    question_id, statement_en,
    arms: [{ arm_id, position, statement_en, belief }],
    proportion,                        // the computed shares
    what_would_settle_it,              // observation, how, why_decisive, feasible_today
    which_arm_this_verdict_assumes,    // the honest part: say which arm the number used
  }],
}
```

The field that earns the flag is **`which_arm_this_verdict_assumes`**. "This rests on an unsettled question" is
only useful if the reader can see which side the row silently took. For the examples above that is
mechanical: a row computed with `U_crit = 0.56` assumed `plaut-high`; a row computed with 0.060 kg assumed
`specimen-mass`.

Two things worth doing in the UI, if you take this up:

- Show the **arms and what would settle it**, not just a warning colour. `what_would_settle_it` has
  `feasible_today` on every entry, so a reader can tell "nobody has measured this yet" from "this cannot be
  measured".
- Say when a question needs a **convention rather than data**. `exclusivity.kind === 'not-contradictory'` marks
  exactly those, and for them the fix is a recorded choice, not an experiment.

## What NOT to do

- **Do not turn an open question into a red.** An unsettled question is not a violation, and a design is not
  worse for touching one.
- **Do not pick the highest-belief arm and proceed.** The proportion ORDERS the arms; it is not a probability.
  `belief-params.json` says its parameters are hand-set and unfitted, and the leading arm of `oq-kcnk5b-vm-sign`
  leads on one paper because nothing contradicts it, not because the positive evidence is strong — that record's
  `known_gaps` says so in those words.
- **Do not flag an arm a wild type has refuted as still open.** `arm.wild_type_contradicted` marks those, and
  such an arm is dead as stated. For `oq-teleost-depth-cap`, the 8200 m hard cap is refuted; only the two live
  arms are in question. Filter on `wild_type_contradicted` being absent or `within_scope === false`.
- **Do not copy any of this into a page.** Same rule as the laws: fetch it.

## Questions back to you

1. Does your row already know which law or constraint produced it? If so, `touches.law_ids` and
   `touches.constraints` are the join and nothing else is needed.
2. Would you rather the open-questions side expose a direct `openQuestionsFor(key)` helper than have each caller
   filter `touches`? Say so and it will be added to `openq-lib.mjs` — that is a one-line export on this side and
   avoids the matching logic being written twice.
3. Is `rests-on-open-question` / `display: 'amber'` compatible with the existing verdict enum, or would you
   prefer it reuse `contested`? `contested` already means something specific (a law with a proved conflict), so a
   distinct value seems right, but the enum is yours.

Reach me through the hub.
