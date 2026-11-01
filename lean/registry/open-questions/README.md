# Open questions and failed theorems: what this project holds UNSETTLED

A law set says what this project holds **proved**. This folder says what it holds **unsettled**, and what it
tried and could not establish. Both are first-class, versioned registry objects, read through one loader and
exposed on every surface, exactly as the laws are.

Amit's ask, in his words:

> failed theorems should live in the LeanBio repo as well, so theorems that have highly conflicting evidence, or
> the ability to be formalized in Lean with both for and against arguments or in different proportions, should
> remain in the repo as open questions that require more evidence to settle.

**Nothing here is ever deleted.** An open question is settled or abandoned, with the reason and the evidence,
and its file stays. That is the same rule the laws follow.

## The point of the folder: the guard

Without enforcement, "we hold this question open" is a note in a file that nothing checks, and the next clean
proposal settles by automation a question the evidence has not settled. So:

**`openQuestionGuard()` in `openq-lib.mjs` refuses a law that asserts one arm of an OPEN question**, and it is
called from `lean/registry/propose.mjs` (at proposal time: the outcome is `contested`, never `candidate`) and
from `lean/registry/check-exposed.mjs` (over every accepted and candidate law, catching one that was already in
the registry when a question was opened, or hand-edited past propose.mjs).

Three detectors, in decreasing certainty:

| detector | how | certainty |
|---|---|---|
| `lean_ref` | the law points at the very declaration that states an arm | certain |
| `declared` | the law carries `open_question_arm: {question_id, arm_id}` | the proposer said so |
| `signature` | the law's text contains every token of `guard.arm_signatures[arm].all_of` and none of its `none_of` | conservative: the token sets are hand-written in a reviewed file, so a false positive is a fixable error, not a guess |

The refusal names the question, lists every arm, prints the computed belief proportion, and says what would
settle it — so a proposer learns what to do, not merely that it was stopped.

**The only two ways past the guard:**

1. **Settle the question** — set `status: "settled"` with the surviving `arm_id`, the evidence that settled it,
   and an approving **role**. The validator refuses a settle with no evidence, a settle naming an arm that does
   not exist, and an `approved_by_role` that looks like a personal name or e-mail.
2. **A scoped exemption**, which needs a **two-sided handshake**: the question's `guard.scoped_exemptions` must
   list the `law_id` with the narrowing and an approving role, **and** the law file must carry
   `open_question_scoped` naming the same question. Either side alone is refused, so **no law can exempt
   itself.** The one real exemption today is `perturb-depth-cap`, which states its cap explicitly *under* a named
   hypothesis and carries status `contested` with the contradicting observation — it is a conditional, not an
   assertion, and its own module says "THE HYPOTHESIS IS CONTRADICTED BY OBSERVATION."

Ask before you write the Lean, not after: `lean_open_question_guard` (MCP) or
`node lean/registry/open-questions/cli.mjs guard --statement "<text>"`, which exits 1 if the statement would be
refused.

## Layout

| path | what |
|---|---|
| `open-questions.schema.json` | JSON Schema for all four record types |
| `questions/<question_id>.json` | one open question (`oq-*`) |
| `failed/<failure_id>.json` | one failed theorem (`ft-*`) |
| `requirements/<requirement_id>.json` | one `candidate-with-requirements` record (`cr-*`): sound, but nothing can check it yet |
| `requests/<request_id>.json` | one `promotion-request` (`pr-*`), queued for a human |
| `lean/*.lean` | the arms, formalised. **Not a law module:** nothing here is in any law set |
| `openq-lib.mjs` | the loader, the computed proportion, the guard, the validator. CLI: `list\|get\|failed\|recompute\|guard\|check` |
| `openq-tools.mjs` | the MCP tools (`lean_open_questions`, `lean_open_question`, `lean_open_question_guard`) |
| `cli.mjs` | the CLI, over the same handlers as the tools |
| `ingest.mjs` | polls the debate and discovery agents' rulings into this schema |
| `test.mjs` | the tests. Every one was made to fail once first |

The four record types are fixed by `pipeline/leanbio/debate/CRITERIA.md` ("Record types emitted"), so a debate
ruling always has a home here and a rejection is a result rather than a bin.

## The proportion is COMPUTED, never asserted

Each arm's `belief` comes from its own evidence through `pipeline/leanbio/belief.mjs` — the same INDRA
SimpleScorer form the LeanBio formalization queue uses — and `proportion.shares` is each arm's share of the
total. `node openq-lib.mjs recompute --write` regenerates it, and a test fails if what is on disk cannot be
reproduced from the evidence.

Read a share as an **ordering of the arms, not a probability that an arm is true**. `belief-params.json` states
plainly that its `rand`/`syst` values are hand-set and have not been fitted.

Three rules the validator enforces about what may feed a belief:

- **A Lean proof is never supporting evidence** (`belief-params.json` `not_used[0]`: it proves a model's
  consequence, not that organisms obey the model). A proof that an arm is *consistent* is not evidence that it is
  *true*. Lean facts about the arms go in `exclusivity`, which is not an input to the proportion.
- **An absence of contradicting evidence is never supporting evidence.** `belief = E * (1 - R)`, so an arm with
  nothing against it is already credited once through `R = 0`; counting the absence again double counts.
- **The `lean-conflict` class is for contradiction only**, as `belief-params.json` defines it.

All three were added because the kcnk5b record broke them. Its biphasic arm cited its own Lean theorem as
support, which inflated its share; see that record's `history` at 1.1.0 and 1.2.0, including a prediction about
the resulting number that turned out to be wrong and is recorded rather than quietly edited.

## The asymmetry: what settles a statement and what does not

From `CRITERIA.md` 1.2.0, and the most load-bearing distinction in this folder:

- **A wild-type organism contradicting a statement inside its own scope SETTLES it against the statement.** A law
  five real animals contradict is wrong, not disputed. That is a `failed-theorem` with
  `contradicted_by: "wild-type-organism"`, and the record must name the organisms.
- **Two measurements of the same system contradicting EACH OTHER settles nothing**, because no organism
  contradicts either. That is an `open-question` with an arm per measurement. A `failed-theorem` with
  `contradicted_by: "another-measurement-of-the-same-system"` is **refused** unless `reason_detail` says why it
  is nevertheless settled.

On an open question, `arm.wild_type_contradicted` marks an arm a wild type refutes. Such an arm is not a live
position, must say `refuted_as_stated`, and can never be the surviving arm of a settle. If **every** arm is so
refuted the validator refuses the record: there is no question left, and it belongs in `failed/`.

**Belief is deliberately BLIND to this check.** An arm five real animals contradict can still carry a high
literature belief — which is exactly why the wild-type check must *outrank* belief rather than be another
evidence class feeding it.

This rule cost this folder its cleanest two-arm question, which is the best evidence it is a real rule rather
than a convenient one. The teleost depth cap had two tidy arms until the rule was applied; the hard cap turned
out to be refuted by an unedited snailfish inside its own declared scope, which left **one** live arm — and one
live arm is an unsupported claim wearing a question's clothes, so the validator refused the record. The honest
repair was to state the weaker surviving version of the refuted arm as its own arm
(`mechanism-with-a-wrong-constant`: the osmolyte mechanism does set a ceiling, the 8200 m constant is wrong, and
136 m is about 1.6% of the depth, inside the uncertainty of an extrapolated line). A validator that only ever
vindicates its author's existing records is not a validator.

## Exclusivity: do the arms actually contradict?

Forcing a contradiction where there is none misrepresents the sources, so `exclusivity.kind` is explicit:

| kind | meaning |
|---|---|
| `proved-unconditionally` | one of them is false, proved with no added premise |
| `proved-under-premise` | the contradiction needs an extra empirical premise **that nobody has established**, carried in `premise` |
| `not-contradictory` | both can be true; the question is live because the CHOICE changes a conclusion |
| `stated-not-proved` | opposed in substance, no formal contradiction available |

Four of the seven questions are `not-contradictory` or need a premise. That is a finding, not a weakness: three
of them (`oq-flying-fish-adult-mass`, `oq-zebrafish-adult-ucrit`, `oq-larval-sleep-definition`) turn out to need
a **convention or a definition**, not more data, and the sleep question is one where no new measurement of the
headline quantity can settle the headline disagreement.

## Formalising both arms

`lean/KcnkSign.lean` is the worked example: both sides of the kcnk5b membrane-potential sign dispute as named
hypotheses, in the house style of `lean/Delphi/Perturb.lean` — every empirical ingredient a named hypothesis
structure, no `axiom`, 0 `sorry`, `#print axioms` naming only `propext`, `Classical.choice` and `Quot.sound`, and
a non-vacuity witness per arm built from the numbers the sources support. Three statement mutants (flipping each
arm's sign field) are all rejected by the compiler, and all three also break the exclusivity theorem, so that
theorem genuinely depends on both signs rather than being provable anyway.

What it proves, and the shape worth copying:

- `hyperpolarising_sign`, `depolarising_sign`, `biphasic_signs` — each arm as a signed statement.
- `arms_exclusive_same_preparation` — the two sign arms contradict, **but only under the added premise
  `SamePreparation`** (same cell, same steady state). That premise is the empirical claim nobody has
  established, and it is carried as an explicit hypothesis rather than smuggled into the proof.
- `arms_not_exclusive_without_same_preparation` — without it, both arms are inhabited at once. **The two papers
  are not formally contradictory.**
- `biphasic_supplies_both_readings` — one biphasic cell yields an arm-A reading early and an arm-B reading late,
  so neither paper's evidence excludes the third arm.
- `all_three_arms_inhabited` — all three arms are buildable, which is exactly why no proof settles the question.

**Formalising the dispute is what found an error in our own description of it.** The repo had recorded the
kcnk5b case as "the papers disagree on sign". Writing both arms precisely forced a check of which paper asserts
which sign, and the sentence proposing that both signs occur sequentially turned out to be **Jiang 2024's own** —
so Jiang reconciles Perathoner rather than contradicting him, the question has three arms rather than two, and
"the papers disagree" put a disagreement in a cited author's mouth. That is a concrete argument for
formalisation as a method, and it is recorded in the question's `found_by` field so it travels with the object.

## Ingesting other threads' rulings

`node ingest.mjs [--write]` **polls** two producers rather than giving them write access, so this folder owns its
schema and a producer cannot write a record that fails validation:

- `pipeline/leanbio/debate/out/records/<law_id>.json` (`leanbio-debate-record/1.0.0`). It deliberately supplies
  raw `belief_inputs` and **no score**, so the proportion is computed here and stays reproducible.
- `pipeline/leanbio/out/round2-open-questions.json` — the discovery agent's *provable but not checkable* list,
  which becomes `candidate-with-requirements` records. **These are not failures:** the proof is sound and no
  design property can be fed to it, so the fix is to declare the quantities a design would have to carry.

Every ingested record keeps its ruling's `criteria_version`, `criteria_sha256`, per-criterion verdicts, and a
**provenance bound** where the round has one. The round that produced today's rulings is recorded as: the
debate's critic and evidence-checker made **zero** web tool calls despite having them, so no counterexample came
from the literature and every rejection was caught by a mechanical check against data already in the repository.
"Debated" therefore means "survived the repo's own gates", not "survived a literature search for
counterexamples".

## Surfaces

Get open questions from the API, never from a list you copied — the same rule the laws follow.

```bash
node lean/registry/open-questions/cli.mjs questions [--status open] [--formalised] [--touches <id>] [--text <s>]
node lean/registry/open-questions/cli.mjs question oq-kcnk5b-vm-sign [--recompute]
node lean/registry/open-questions/cli.mjs guard --statement "<a law statement>"   # exit 1 if it would be refused
node lean/registry/open-questions/cli.mjs check                                   # validate + guard the registry
```

MCP: `lean_open_questions`, `lean_open_question(id)`, `lean_open_question_guard`
(registration patch: `sim-engine/tools/OPENQ-REGISTER.md`; the handlers are in `openq-tools.mjs`, so the CLI and
the tools cannot disagree). Static mirror: `/api/lean/open-questions.json`,
`/api/lean/open-questions/<question_id>.json`, `/api/lean/failed-theorems/<failure_id>.json`, written by
`dashboard/build-lean-api.mjs` and covered by its `--check`. Page:
`dashboard/public/leanbio/open-questions.html`, which fetches the mirror and holds no copy of its own.

A design whose verdict depends on an open question must be flagged as resting on an unsettled question — neither
red nor green. The hook note for the scorer and studio threads is `STUDIO-HOOK.md` in this folder.

## Tests

`node test.mjs` — 135 assertions. Every test was made to **fail once** before it was trusted, and the negative
cases are run every time rather than described: a one-armed question is rejected; a law asserting an open arm is
refused by each of the three detectors independently; a law exempting itself is still refused; the depth cap
*would* be refused without its recorded exemption, so the exemption is doing real work; a settle with no
evidence, no real arm, or a personal name instead of a role is rejected; a question cannot be settled in favour
of an arm real animals refute; and a failure resting only on a disagreeing measurement is refused as a failure.

Breaking the signature detector fails 9 assertions; breaking the arm-count invariant fails 1. Both were checked
by actually breaking them.
