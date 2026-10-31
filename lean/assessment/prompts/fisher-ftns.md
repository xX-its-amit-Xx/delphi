# Rubric `lean-faithfulness/0.1.0`

You are assessing whether a Lean 4 theorem statement faithfully formalises a stated law of
biology. Judge the **statement** (the hypotheses and the conclusion), not the proof. Answer with
the JSON object described at the end and nothing else.

## The law as the source states it

- Claim id: fisher-ftns
- Label: Fisher's fundamental theorem of natural selection (partial-change form)
- Statement: The rate of increase in mean fitness of a population due to natural selection equals its additive genetic variance in fitness at that time.
- Notation: \Delta_{NS}\bar{w} = V_A(w)/\bar{w} (discrete generations); \left.\frac{d\bar{m}}{dt}\right|_{NS} = V_A(m) for Malthusian fitness m
- Context given with the claim: Assumptions: the 'partial change' holds average effects of alleles and the environment fixed (Price 1972, Ewens 1989); V_A is the additive genetic variance in fitness. Formal status: proved in this partial-change reading. Read as a claim about the total change in mean fitness it is false under dominance, epistasis, frequency dependence or a changing environment.
- Source: The Genetical Theory of Natural Selection (1930)

## The Lean statement

```lean
/-- **Fisher's fundamental theorem of natural selection** (haploid locus, partial change).
The change in mean fitness over one generation of selection, with fitnesses held fixed, equals
the variance in fitness divided by the mean fitness. -/
theorem fisher_fundamental_theorem {p w : ι → ℝ} (hp : IsFreq p)
    (hmean : 0 < meanFitness p w) :
    meanFitness (select p w) w - meanFitness p w = variance p w / meanFitness p w
```

Definitions it uses (verbatim from the module):

```lean
/-- Mean fitness `w̄ = ∑ p i * w i`. -/
def meanFitness (p w : ι → ℝ) : ℝ := ∑ i, p i * w i

/-- Variance in fitness `∑ p i * (w i - w̄)^2`. For a haploid locus this is the additive genetic
variance in fitness, since each type breeds true. -/
def variance (p w : ι → ℝ) : ℝ := ∑ i, p i * (w i - meanFitness p w) ^ 2

/-- One generation of selection with fixed fitnesses: `p' i = p i * w i / w̄`. -/
noncomputable def select (p w : ι → ℝ) : ι → ℝ := fun i => p i * w i / meanFitness p w

/-- A frequency vector: nonnegative and summing to one. -/
structure IsFreq (p : ι → ℝ) : Prop where
  nonneg : ∀ i, 0 ≤ p i
  sum_one : ∑ i, p i = 1
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
