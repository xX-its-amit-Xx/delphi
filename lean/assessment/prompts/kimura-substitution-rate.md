# Rubric `lean-faithfulness/0.1.0`

You are assessing whether a Lean 4 theorem statement faithfully formalises a stated law of
biology. Judge the **statement** (the hypotheses and the conclusion), not the proof. Answer with
the JSON object described at the end and nothing else.

## The law as the source states it

- Claim id: kimura-substitution-rate
- Label: Neutral substitution rate equals the mutation rate
- Statement: For neutral mutations the long-run rate of molecular substitution equals the mutation rate per generation, independent of population size, which yields a molecular clock.
- Notation: k = 2N\mu \cdot \frac{1}{2N} = \mu
- Context given with the claim: Assumptions: strictly neutral mutations, mutation rate constant per generation, steady state. Formal status: an exact consequence of the neutral fixation probability. Variation in generation time and weak selection on nearly neutral sites cause departures from strict clock-like rates.
- Source: Evolutionary Rate at the Molecular Level (1968), doi:10.1038/217624a0

## The Lean statement

```lean
/-- **Kimura (1968).** Under neutral Wright–Fisher evolution, the substitution rate equals
the mutation rate, for every population size `M`. -/
theorem neutral_substitution_rate (M : ℕ) (hM : 0 < M) (μ : ℝ) :
    substitutionRate M μ ((wrightFisher M hM).fixationProbability (oneCopy M hM)) = μ
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

/-- The fixation probability of a lineage starting from `i` copies: the limit of `fixedBy`. -/
noncomputable def fixationProbability (i : Fin (M + 1)) : ℝ :=
  limUnder atTop (fun t => C.fixedBy t i)

/-- Wright–Fisher sampling: with `i` mutant copies among `M`, the next generation has `j`
mutant copies with probability `C(M, j) (i/M)^j (1 - i/M)^(M-j)`. -/
noncomputable def wfKernel (M : ℕ) : Matrix (Fin (M + 1)) (Fin (M + 1)) ℝ :=
  fun i j => (Nat.choose M j : ℝ) * (((i : ℕ) : ℝ) / M) ^ (j : ℕ) * (1 - ((i : ℕ) : ℝ) / M) ^ (M - j)

/-- The neutral Wright–Fisher chain on `M` gene copies. -/
noncomputable def wrightFisher (M : ℕ) (hM : 0 < M) : NeutralChain M where
  P := wfKernel M
  -- remaining fields: the proofs that wfKernel satisfies the NeutralChain axioms (omitted)

/-- A single new mutant: one copy among `M`. -/
def oneCopy (M : ℕ) (hM : 0 < M) : Fin (M + 1) := ⟨1, by omega⟩

/-- Kimura's substitution rate: `M μ` new mutants arise per generation (mutation rate `μ`
per copy), and each is fixed with probability `u`. The rate of substitution is their product.
This is the definition in Kimura (1968), eq. for `k`; it assumes mutants' fates are
independent. -/
def substitutionRate (M : ℕ) (μ u : ℝ) : ℝ := (M : ℝ) * μ * u
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
