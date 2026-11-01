# The second Lean round in `validate_design` — hook note for the scorer thread

**What Amit asked for:** "the validation tool ... should do a second round of checks using Lean". Today
`validate_design` checks once, against whatever law set happens to be current, and says nothing about whether
that is the law set the design was judged under when it was made. A design that was valid last week and is not
valid today is the entire point of a living law base, and it must be visible.

**I did not edit `score.mjs`, `score-weights*.json`, `evaluation/` or `benchmark/`.** The logic is in a new
module of its own, `sim-engine/validate/lean-rounds.mjs`, and it is called from the `validate_design` entry in
`sim-engine/tools/validate-tools.mjs` — the tool layer, not the scorer. **Scores are unchanged by
construction:** the scorer's L component still reads `assess()`'s single Lean pass, which uses the current law
set, and round 2 uses the current law set too, so they agree. Nothing in `lean-rounds.mjs` writes to or reads
from the scorer.

## The shape

`leanRounds({ organism | design, ageDays, conditions, from, to, extraSpec })` returns:

```
{
  rounds_identical: false,
  round1: { round, lawset_version, requested_lawset, ran_at, lawset_basis, lawset_basis_detail,
            summary, verdicts[], violations[], excluded[], laws_without_browser_evaluation[] },
  round2: { ...the same fields, against the law set in force now },
  law_base_moved: { from, to, releases_between[{version,date,summary,added[],status[]}],
                    admitted[], changed[], withdrawn[] },
  newly_violated_since: [ { law_id, law_version, constraint, status, binding, inputs, message,
                            law_base_change: {kind:'admitted'|'changed', ...}, why } ],
  newly_binding_since:  [ ...violations the design ALREADY had, now binding because the law was raised to
                            accepted: grey in the Studio last week, red today ],
  newly_violated_without_a_law_change: [ ...a CALLER bug, kept apart so it cannot be read as a law change ],
  no_longer_violated_since: [ ...a law was loosened, retired, re-scoped or superseded ],
  newly_unjudged_since: [ ...rows round 1 judged and round 2 does not: a loss of coverage, never a pass ],
  binding_newly_violated_since: [...],
  verdict_changed: true,
  summary: "Round 1 judged this design against law set 1.0.0 (...); round 2 against 1.7.0. 12 law(s) admitted
            ... The design now breaks 1 law(s) it did not break when it was made (perturb-thermal), of which 1
            are binding.",
  note: "...NOT kernel checks..."
}
```

`validate_design` puts that under `result.lean_rounds`, copies `summary` to `result.lean_rounds_headline`, adds
two provenance rows (the round-1 and round-2 law sets) and appends one sentence to `scope`. Two new inputs:
`made_under_lawset` (round 1, when the design records none) and `second_round: false` (opt out).

## Where round 1's law set comes from

In order, and `round1.lawset_basis` always says which was used:

| basis | source |
|---|---|
| `explicit` | the caller passed `from` / `made_under_lawset` |
| `document-edit` | the newest `lawset_version` stamped on the document's edits — `organism.mjs appendEdit` records it on **every** edit, so this genuinely is the law set in force when the design was last changed |
| `document-field` | `doc.lawset_version` |
| `unknown` | nothing on the design records one. Round 1 then uses the **current** set and says so, so the two rounds are identical **by construction rather than by luck** — that must never read as "nothing has changed since". |

Because law sets are immutable and pin each law at a version (`lean/registry/lawsets/lawset-*.json`), round 1
genuinely reproduces the verdict the design was given at the time; it is not an approximation of it.

## Why `newly_violated_since` is split three ways

A row that violates in round 2 and not in round 1 has exactly three possible causes, and conflating them would
make the field useless:

1. the law was **admitted or changed** since → `newly_violated_since`, with `law_base_change` naming the release;
2. the law was already there and already violated, but only **status** rose to accepted → `newly_binding_since`;
3. the law is **pinned identically in both sets** → then the two rounds were not given the same numbers, which
   is a bug in whatever called `leanRounds`, not a law change → `newly_violated_without_a_law_change`.

`no_longer_violated_since` and `newly_unjudged_since` exist for the same reason in the other direction: a law
base that only ever tightens is not being reported honestly, and a row that stopped being judged is a loss of
coverage, not a design improvement.

## What it does for the score — nothing, and that is deliberate

Round 2 == the current law set == what `assess()` already used, so no score, weight, benchmark number or
pre-registration is affected. If the scorer thread ever wants to score "has this design's standing decayed",
the field to read is `binding_newly_violated_since.length` and the right place for it is a NEW component with
its own pre-registration, not a change to the frozen weights. I have not proposed one.

## If you want it inside `assess()` instead

I would rather it stayed in the tool layer, but if the scorer thread prefers it in `score.mjs`, the whole patch
is two lines inside `assess()` and nothing in `validate-tools.mjs`:

```diff
+import { leanRounds } from './lean-rounds.mjs';
@@ in assess(), after r.lean is computed
+  r.lean_rounds = args.organism ? await leanRounds({ organism: args.organism, ageDays: args.ageDays,
+    conditions: args.conditions || {}, from: args.made_under_lawset || null }) : null;
```

and then remove the wrapper in `validate-tools.mjs`'s `validate_design` handler. Say the word and I will do it;
I have not, because it is your file.

## Verified

```
node sim-engine/validate/lean-rounds.test.mjs
node lean/registry/law-surfaces.mjs <law_id>        # hop h is this module
```

Real-history checks that pass today (no synthetic law set):

- `from 1.0.0` to current, thermal design outside its own CTmax window → `newly_violated_since:
  perturb-thermal/P1`, binding, `law_base_change.kind: "admitted"`.
- `from 1.4.0` to `1.5.0`, same design → `newly_binding_since: perturb-thermal/P1`, because 1.5.0 raised
  `perturb-thermal` from candidate to accepted. The violation did not appear; it started counting.
