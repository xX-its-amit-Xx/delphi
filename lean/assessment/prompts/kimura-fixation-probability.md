# Rubric `lean-faithfulness/0.1.0`

You are assessing whether a Lean 4 theorem statement faithfully formalises a stated law of
biology. Judge the **statement** (the hypotheses and the conclusion), not the proof. Answer with
the JSON object described at the end and nothing else.

## The law as the source states it

- Claim id: kimura-fixation-probability
- Label: Kimura fixation probability of a mutant allele
- Statement: The probability that a mutant allele eventually fixes in a finite population depends on its initial frequency, its selective advantage and the effective population size, and equals its initial frequency when it is neutral.
- Notation: u(p) = \frac{1-e^{-4N_e s p}}{1-e^{-4N_e s}}; neutral limit u(p) = p, so a new mutant fixes with probability 1/(2N)
- Context given with the claim: Assumptions: diffusion approximation to the Wright-Fisher model, genic (additive) selection with coefficient s, constant effective size N_e, no linkage to other selected sites. Formal status: proved within the diffusion limit.
- Source: On the probability of fixation of mutant genes in a population (1962), doi:10.1093/genetics/47.6.713

## The Lean statement

```lean
/-- **Neutral fixation probability (Kimura 1962, neutral case).** A neutral lineage that
starts with `i` of `M` copies is eventually fixed with probability `i / M`. -/
theorem fixedBy_tendsto (hM : 0 < M) (i : Fin (M + 1)) :
    Tendsto (fun t => C.fixedBy t i) atTop (𝓝 (((i : ℕ) : ℝ) / M))
```

Definitions it uses (verbatim from the module):

```lean
/-- A neutral, absorbing Markov chain on `Fin (M+1)`: the number of mutant gene copies
among `M`. `P i j` is the probability of going from `i` copies to `j` copies in one
generation. -/
structure NeutralChain (M : ℕ) where
  /-- One-generation transition matrix. -/
  P : Matrix (Fin (M + 1)) (Fin (M + 1)) ℝ
  /-- Probabilities are nonnegative. -/
  nonneg : ∀ i j, 0 ≤ P i j
  /-- Each row is a probability distribution. -/
  rowSum : ∀ i, ∑ j, P i j = 1
  /-- Neutrality: the expected copy number is conserved, `E[X_{t+1} | X_t = i] = i`. -/
  neutral : ∀ i, ∑ j, P i j * ((j : ℕ) : ℝ) = ((i : ℕ) : ℝ)
  /-- Loss (`0` copies) is absorbing. -/
  absorb_zero : ∀ j, P 0 j = if j = 0 then 1 else 0
  /-- Fixation (`M` copies) is absorbing. -/
  absorb_last : ∀ j, P (Fin.last M) j = if j = Fin.last M then 1 else 0
  /-- From any intermediate state, absorption in one step has positive probability. -/
  escape : ∀ i : Fin (M + 1), i ≠ 0 → i ≠ Fin.last M → 0 < P i 0 + P i (Fin.last M)

/-- Probability that a lineage starting from `i` copies is fixed (all `M` copies) by
generation `t`. -/
def fixedBy (t : ℕ) (i : Fin (M + 1)) : ℝ := (C.P ^ t) i (Fin.last M)
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
