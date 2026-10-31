# Rubric `lean-faithfulness/0.1.0`

You are assessing whether a Lean 4 theorem statement faithfully formalises a stated law of
biology. Judge the **statement** (the hypotheses and the conclusion), not the proof. Answer with
the JSON object described at the end and nothing else.

## The law as the source states it

- Claim id: maynardsmith-twofold-cost
- Label: Twofold cost of sex
- Statement: An asexual mutant female in a sexual population with equal sex ratio produces twice as many grandchildren as a sexual female, so sex needs a compensating advantage of up to twofold to persist.
- Notation: with equal fecundity and a 1:1 sex ratio, the odds of asexual to sexual females double each generation: \frac{q_{t+1}}{1-q_{t+1}} = 2\frac{q_t}{1-q_t}
- Context given with the claim: Assumptions: anisogamy with males contributing no resources, equal fecundity and viability of sexual and asexual females, a 1:1 sex ratio. Formal status: proved as a population-dynamic identity under these assumptions. Its biological force depends on how often those assumptions hold.
- Source: The Evolution of Sex (1978)

## The Lean statement

```lean
/-- **Twofold cost of sex.** With equal fecundity and a `1 : 1` sex ratio, the odds of asexual to
sexual females double every generation. Fecundity cancels. -/
theorem twofold_cost_of_sex {q f : ℝ} (hq0 : 0 < q) (hq1 : q < 1) (hf : 0 < f) :
    odds (asexualNext q f) = 2 * odds q
```

Definitions it uses (verbatim from the module):

```lean
/-- Fraction of asexual females in the next generation, given fraction `q` now and fecundity
`f` for every female. Asexual females have `f` daughters; sexual females have `f / 2` daughters
and `f / 2` sons. -/
noncomputable def asexualNext (q f : ℝ) : ℝ := q * f / (q * f + (1 - q) * f / 2)

/-- Odds of a fraction `q`: `q / (1 - q)`. -/
noncomputable def odds (q : ℝ) : ℝ := q / (1 - q)
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
