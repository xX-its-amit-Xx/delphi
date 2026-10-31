# Rubric `lean-faithfulness/0.1.0`

You are assessing whether a Lean 4 theorem statement faithfully formalises a stated law of
biology. Judge the **statement** (the hypotheses and the conclusion), not the proof. Answer with
the JSON object described at the end and nothing else.

## The law as the source states it

- Claim id: {{claim_id}}
- Label: {{label}}
- Statement: {{statement}}
- Notation: {{notation}}
- Context given with the claim: {{context}}
- Source: {{paper_title}} ({{paper_year}}){{paper_doi}}

## The Lean statement

```lean
{{lean_docstring_and_statement}}
```

Definitions it uses (verbatim from the module):

```lean
{{lean_definitions}}
```

## Questions (score each 0, 0.25, 0.5, 0.75 or 1)

1. `same_quantities`: Do the Lean quantities (the definitions above) correspond to the quantities
   named in the law (e.g. substitution rate, mutation rate, fixation probability, mean fitness,
   additive genetic variance)? 1 = each named quantity has a matching definition with the same
   meaning; 0 = the theorem is about different quantities.
2. `assumptions_match`: Are the hypotheses of the Lean theorem the law's stated assumptions, no
   more and no less? Score down for hidden extra assumptions that make the theorem easier, or for
   missing assumptions that the law needs.
3. `scope_stated`: If the Lean theorem covers a special case (e.g. neutral only, haploid only),
   is that narrowing explicit in the docstring, and is it the case the law actually needs?
4. `not_trivial`: Is the theorem's content the law, rather than generic arithmetic dressed in the
   law's names? (A theorem whose hypotheses already contain the conclusion, or whose conclusion
   follows by rearranging a definition, scores 0.)

## Answer format

```json
{ "scores": { "same_quantities": _, "assumptions_match": _, "scope_stated": _, "not_trivial": _ },
  "verdict": "faithful | faithful-with-narrower-scope | unfaithful",
  "rationale": "two to five sentences, citing the specific hypothesis or definition that decided it" }
```
