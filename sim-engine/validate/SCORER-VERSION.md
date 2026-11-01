# Which scorer version should be the default?

Written 2026-11-01, before the data freeze, after three different composites were measured for the same design
(`winged-zebrafish`) and `version: '1.3.0'` was found to throw through the shipped tool. Everything below was
re-measured on this tree; nothing is quoted from an earlier document.

- **Current default:** `DEFAULT_VERSION = '1.0.0'` (`sim-engine/validate/score.mjs`).
- **Recommendation:** **do not move the default to 1.3.0 before the freeze.** Label instead. Reasons in
  §3; the numbers it would change are in §2.
- **Nothing about the default was changed by this document.** The labelling in §4 *was* applied.

---

## 0. The thing to settle first: no released version's composite has ever passed

It is tempting to read "v1.3.0 is the version that went through the blind evaluation and passed" and conclude that
the default is pointing at an untested scorer while a tested one sits unused. That is not what the blind run says.
From `sim-engine/validate/evaluation/SCORER-EVALUATION.md` (168 held-out families, family-out, independent
evaluator), verdicts per `benchmark/BENCHMARK-PREREGISTRATION.md`:

| version | blind-evaluated? | verdict on the composite `score` | verdict on `rank_score` |
|---|---|---|---|
| **1.0.0** (the default) | **yes** (`2026-11-01T04-37-49Z_w1.0.0`) | **FAIL** — P1, P2, P3 all fail; P1 AUC 0.690 against 0.843 for the nearest-neighbour distance it is built from | not emitted |
| 1.1.0 | yes (`…04-58-15Z_w1.1.0`) | **FAIL** — all three fail; P1 0.688 | not emitted |
| **1.1.1** | **no** | — | — |
| 1.2.0 | yes (`…04-58-08Z_w1.2.0`) | **FAIL** — only P2 passes; P1 0.683 | **FAIL** (P3 fails) |
| 1.3.0 | yes (`…05-12-45Z_w1.3.0`) | **FAIL** — only P2 passes; P1 0.736 | **PASS** (P1 0.875, P2 99.7 %, P3 0.836 > 0.691) |

Three facts follow, and they are the whole basis of the recommendation.

1. **The current default WAS blind-evaluated.** v1.0.0 went through the full held-out run. The claim that today's
   numbers come from a version that was never blind-tested is false.
2. **The composite fails in every released version, 1.3.0 included.** There is no version of this scorer whose
   composite passed the pre-registered endpoints. Moving the default does not buy a passing composite, because
   none exists.
3. **What passed in v1.3.0 is `rank_score`, which is a different output with a different rule** (raw P parts as a
   geometric mean, no `min(1, p/alpha)` cap, mean rather than weakest evidence). And the evaluator's own note is
   that v1.3.0's `rank_score` does not beat its joint Mahalanobis term used alone (P1 0.883 vs 0.875): "on the
   primary ranking, the v1.3.0 composite is one term wearing a costume."

The honest summary is not "the default is the wrong version". It is **"the composite is not a validated
instrument in any version, and the project's headline number is a composite."** That is a labelling problem
before it is a version problem.

---

## 2. What moving the default 1.0.0 → 1.3.0 would do

Measured through the shipped tool path (`designScoreTool`, i.e. `design_score`), on this tree, on the four
committed designs plus the real-flying-fish control. `spec` is the headline desired phenotype
*"a zebrafish that glides at least 5 m from a 1 m launch and survives 10-30 C as an adult"*; `flying-fish` is
scored with `reference_set_excluding: ['organism:flying-fish']` so it is not scored against itself.
`P` = plausible, `i` = implausible.

### Without a spec (what `design_score` returns by default)

| design | v1.0.0 (today) | v1.3.0 | change | v1.3.0 `rank_score` |
|---|---|---|---|---|
| `winged-zebrafish` | 0.9217 P | 0.9217 P | **none** | 0.7867 |
| `wingless-flying-fish` | 0.9217 P | 0.9217 P | **none** | 0.8049 |
| `tff` | 0.3492 i | 0.1384 i | −0.2108, verdict unchanged | 0.1979 |
| `ff-zf-chimera` | 0.8201 P | 0.2685 **i** | **−0.5516, VERDICT FLIPS** | 0.6076 |
| `flying-fish` (control) | 0.9217 P | 0.9217 P | **none** | 0.6945 |

### With the spec (what `validate_generation` carries)

| design | v1.0.0 (today) | v1.3.0 | change | v1.3.0 `rank_score` |
|---|---|---|---|---|
| `winged-zebrafish` | 0.8780 P | 0.8780 P | **none** | 0.7674 |
| `wingless-flying-fish` | 0.4676 i | 0.4676 i | none | 0.2089 |
| `tff` | 0.4089 i | 0.1862 i | −0.2227, verdict unchanged | 0.2524 |
| `ff-zf-chimera` | 0.8449 P | 0.3270 **i** | **−0.5179, VERDICT FLIPS** | 0.6547 |
| `flying-fish` (control) | 0.9330 P | 0.9330 P | **none** | 0.7335 |

### What actually causes each change

- **`ff-zf-chimera`, the one verdict flip.** Not the joint model. It is v1.2.0's defect fix 5: a *failed* phenotype
  sanity check now feeds `P` at `sanity_failed_value = 0.05`. The chimera fails
  `organ_fit:flight_muscle` — only 75.3 % of the requested flight-muscle volume fits inside the skin. Under
  v1.0.0/v1.1.0 that entered `P` only as the soft fraction 0.7531; from v1.2.0 it *also* enters as a hard 0.05,
  and `P` is a minimum, so `P` drops 0.7531 → 0.0500. This is the intended v1.2.0 behaviour and it is the more
  defensible of the two: a design whose organ does not fit should not read "plausible".
- **`tff`.** The drop happens at **v1.1.0**, not at 1.3.0: v1.1 adds `p_state_envelope`, which `tff` fails at
  0.0002. v1.2.0 and v1.3.0 leave it where v1.1.0 put it.
- **v1.3.0's joint term changes none of the five.** `p_joint` returns 1 for every one of them (`p` 0.090 for
  `winged-zebrafish`, through `min(1, p/0.05)`). The single feature that distinguishes v1.3.0, and the only reason
  its `rank_score` passes the blind endpoints, is **inert on this project's own designs**. It earns its keep on the
  benchmark's shuffled decoys, which these designs are not.
- **Every composite above is dominated by `E`, not by biology.** For `winged-zebrafish` the components are
  P = 1, L = 1, G = 1, E = 0.5 — the number 0.9217 is `exp(0.10 · ln 0.5 / 0.85)` and nothing else. The score is
  low only because the inputs are `assumed`. The evaluator found the same thing on the benchmark: "four of the five
  components do no ranking work."

---

## 3. Recommendation

**Keep `DEFAULT_VERSION = '1.0.0'` through the freeze. Do not bump it now.**

1. **A bump does not buy a validated composite.** The composite fails the pre-registered endpoints in 1.3.0 too
   (§0). The only blind PASS in the repository belongs to `rank_score`, and a bump would not make `rank_score` the
   headline — it would keep emitting a failed composite, from a different version.
2. **Every published number would move, hours before a freeze.** `ff-zf-chimera` flips plausible → implausible.
   `0.878`, `0.9217`, `0.4676`, `0.933` and `0.8449` appear in `pipeline/RESULTS.md`, `AGENT-GUIDE.md`,
   `skill/delphi-studio/SKILL.md`, `tools/PIPELINE-REGISTER.md`, `dashboard/public/studio-api/`,
   `dashboard/public/start/` and the four generated `dashboard/public/validate-show/run-*.json` files. A silent bump
   invalidates all of them at once with no re-run.
3. **v1.3.0 was blind-evaluated on the `{params, lean_spec, doc}` input, and `design_score` feeds it an organism
   document.** The two agree in shape today, but the evaluator explicitly flags input asymmetry as a live
   confound. Changing the default and the input semantics in one move, unmeasured, is the kind of change that
   produces a number nobody can trace.
4. **The v1.2.0 sanity-failure rule is the genuinely better behaviour and should land — on its own merits, with
   the chimera's flip announced, not smuggled in under a version bump.** That is a post-freeze change with a
   re-run of every published figure, not a one-line edit to `DEFAULT_VERSION`.

### After the freeze, in this order

1. Decide whether the **headline output** is `score` or `rank_score`. The blind evidence supports `rank_score`
   (v1.3.0) and refutes `score` (all versions). This decision is upstream of the version decision and is currently
   unmade; `design_score` emits `score` as its headline and `rank_score` as a secondary field.
2. If `score` stays the headline, say in every place it appears that **no version of it has passed a blind
   evaluation**, which §4 now does automatically.
3. Then bump the default to 1.3.0, re-run `pipeline/RESULTS.md`, `validate-show/gen.mjs` and the three documents,
   and record the chimera flip as a result rather than a correction.
4. Retire **v1.1.1** or evaluate it. It is callable, it is the only released version that was never in the blind
   run, and nothing in the repository uses it.

---

## 4. Labelling — applied now

Every composite this repository emits now carries, on the number itself, which version produced it and whether
that version's composite was ever blind-evaluated:

- `sim-engine/validate/score.mjs` exports `RELEASED_VERSIONS`, `BLIND_EVALUATION` and `evaluationLabel(version)`.
  `BLIND_EVALUATION` is transcribed from `evaluation/SCORER-EVALUATION.md` and carries each version's blind
  verdict on `score` *and* on `rank_score`.
- `assess()` puts `score.evaluation = evaluationLabel(version)` on the result, so `design_score`,
  `validate_design` and anything reading `r.score` get the label without asking. For the default it reads:
  *"scorer v1.0.0: blind-evaluated (…, 168 held-out families, family-out). The blind verdict on this composite is
  FAIL — P1, P2 and P3 all fail …"*
- `designScore(design, {version: '1.2.0' | '1.3.0'})` attaches `score_evaluation` the same way.
- `score.evaluation.warning` is `true` whenever the composite's blind verdict is not PASS, which today is **every
  released version**.
- `score.components_that_ran` and `score.comparability` are emitted beside the number, because two composites for
  the same design at the same version are *not* comparable unless the same components ran (§5).
- `sim-engine/validate/pipeline/index.mjs` carries the same label through
  `composite_score_from_the_scorer`, with the spec-dependence warning.

A version that is released but has no `BLIND_EVALUATION` entry now fails
`sim-engine/validate/test/validate.mjs` (`every-version-has-an-evaluation-label`).

---

## 5. Why the same design at the same version returns different composites

This is not a version problem and it is not a bug. `S` (spec performance) enters the weighted geometric mean
**only when a spec is passed**, so the composite changes identity with its component set. Same design
(`winged-zebrafish`), same scorer (v1.0.0), byte-identical input trait vector:

| path | spec passed | `S` | composite |
|---|---|---|---|
| `design_score({organism:'winged-zebrafish'})` | none | did not run | **0.9217** |
| `validate_generation(… "glides ≥ 5 m from a 1 m launch **and survives 10–30 C as an adult**")` | 3 criteria: 1 failed, 2 met | 0.6667 | **0.8780** |
| `validate_generation(… "glides ≥ 5 m from a 1 m launch")` | 1 criterion: failed | 0 → floor 0.01 | **0.4676** |

The third row is what `dashboard/public/validate-show/gen.mjs` runs (its prose asks only about gliding), which is
why the walkthrough shows 0.4676 for the design that `RESULTS.md` headlines at 0.878.

**The sharp edge:** adding a spec criterion the design meets *trivially* — surviving 10–30 °C, which any zebrafish
does — raises the composite of a design that cannot leave the water from **0.4676 ("implausible")** to
**0.878 ("plausible")**. The failed glide criterion is diluted by two unrelated passes. A composite that can be
raised by asking for more things the design already does is not a measure of whether the design works. This is the
same conclusion the five named results and the physics gate exist to enforce, arriving from a different direction:
**the composite is never the verdict.**

---

## Hard rules this document does not break

The five named results are never summed. `cannot-assess` is never a pass. A composite is never the verdict. No
bird (Aves) data appears in any reference set or benchmark split; Aves is a frozen holdout.
