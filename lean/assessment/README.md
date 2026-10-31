# Faithfulness assessment of the Lean statements (to be run by a non-Anthropic model)

`BEST_PRACTICES.md` section 9: whether a Lean statement is a faithful rendering of the stated law
is an assessment question for an assessor from a **different provider** than the one that wrote
the Lean. All modules in `lean/Delphi/` were written by Claude (Anthropic), so Claude must not
score them. Nothing in `lean.json` or the sub-dashboard claims faithfulness; the label there is
"kernel-checked".

## How to run

For each row of `inputs.json`, send the assessor **only** the blinded prompt in `prompt.md` with
the row's fields filled in (claim statement, notation, context, paper, and the Lean statement with
its docstring). Do not send the module header's own explanation of assumptions, the proof, or any
other assessor's output. Record the answer as `results/<claim_id>.<provider>.json`:

```json
{ "claim_id": "fisher-ftns", "theorem": "Delphi.fisher_fundamental_theorem",
  "assessor": { "provider": "openai|google|...", "model": "<model id>", "date": "2026-10-31" },
  "scores": { "same_quantities": 0.0, "assumptions_match": 0.0, "scope_stated": 0.0, "not_trivial": 0.0 },
  "verdict": "faithful | faithful-with-narrower-scope | unfaithful",
  "rationale": "two to five sentences" }
```

Scores are in [0, 1] per the rubric in `prompt.md` (rubric version `lean-faithfulness/0.1.0`; a
changed question is a new version). Two assessors from two providers are required before a
`delphi:Concept` nanopub for the law can carry `delphi:leanVerified true` with an attached
faithfulness assessment. `report.mjs` will pick up files in `results/` once any exist.
