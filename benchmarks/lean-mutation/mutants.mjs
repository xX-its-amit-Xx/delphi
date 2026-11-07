// THE MUTANTS, and the one distinction that makes a proof-assistant mutation test worth running.
//
// ============================== WHY NAIVE MUTATION TESTING IS WORTHLESS HERE ==============================
// The obvious benchmark is: change a theorem, check Lean rejects it, count the kills. It reports a 100 %
// kill rate on almost any formal library, and the number means nothing - because changing a STATEMENT
// breaks its PROOF, and Lean then rejects the mutant for a reason that has nothing to do with whether
// the mutant is true. "The proof script no longer typechecks" is not "the claim is false".
//
// So every mutant here is classified three ways, and only the first is evidence:
//
//   REFUTED    the mutant's NEGATION is provable -> the mutant is definitively false, and a prover that
//              rejected it was right for the right reason
//   UNPROVEN   neither the mutant nor its negation could be proved with the proofs tried -> consistent
//              with the mutant being false, and NOT evidence of it
//   SURVIVED   the mutant IS provable -> the mutation did not change what the statement claims. Either
//              the constant is doing no work, or the theorem is weaker than it reads. This is the finding
//              the benchmark exists to produce.
//
// A SURVIVED mutant is not a Lean failure. Lean behaves correctly in every case. It is a failure of the
// STATEMENT to say what its author believed it said - the only interesting bug in a formalisation, and
// the one no amount of proof checking can catch.
//
// ============================== WHAT IS MUTATED ==============================
// Numeric literals in statements, because that is where a formalisation carries its empirical content and
// where a transcription slip is invisible. `0.406` is not arbitrary: it is the smallest pectoral/SL ratio
// among 49 measured specimens. A theorem that survives changing it is not about those specimens.
//
// ============================== TWO MISTAKES THIS FILE MADE FIRST ==============================
// Both were caught by the control, which is exactly what a control is for.
//
// 1. DIRECTION. The first mutant moved a bound from 0.406 to 0.5 and expected a refutation. But the
//    bound sits in a disjunct - `r < 0.406 ∨ 0.823 < r` - so widening it WEAKENS the conclusion and the
//    mutant stays true. The counterexample attempt then failed, correctly, and the failure said so:
//    the witness 0.45 is INSIDE the measured band. Tightening to 0.3 is the mutation that can be false.
// 2. HARNESS STRENGTH. The control - a deliberately weakened statement that must survive - came back
//    UNPROVEN, because a generic tactic list cannot prove a disjunction over the reals. Had the control
//    been absent, three UNPROVENs would have been reported as a clean sweep, when the harness could not
//    tell "false" from "I could not prove it". Mutants may now carry their own proof attempt.

export const WHAT_THIS_IS =
  'Mutation testing for a Lean law registry, with the distinction that makes it meaningful: a mutant ' +
  'whose negation is provable was killed for the right reason; one that merely fails to compile was not.';

export const TARGETS = [
  {
    id: 'finRatio_outside',
    law: 'empirical-E5 measuredFinRatio',
    module: 'Delphi.Empirical',
    what_it_says: 'a ratio outside the measured band [0.406, 0.823] is below 0.406 or above 0.823',
    where_the_constants_come_from: 'the smallest and largest pectoral/SL ratio among 49 flying-fish specimens (Daane 2021 Data S1)',
    mutants: [
      {
        id: 'lower-bound-STRENGTHENED',
        what: 'the lower disjunct is tightened from 0.406 to 0.3, which STRENGTHENS the claim',
        why_this_direction:
          'widening a disjunct weakens the conclusion and cannot produce a false mutant. Tightening it can: ' +
          'a ratio of 0.35 is outside the measured band and is not below 0.3.',
        statement: 'theorem m (r : ℝ) (h : ¬ Delphi.Empirical.measuredFinRatio r) : r < 0.3 ∨ 0.823 < r',
        expect: 'REFUTED',
        negation: 'theorem m : ¬ (∀ r : ℝ, ¬ Delphi.Empirical.measuredFinRatio r → r < 0.3 ∨ 0.823 < r)',
        negation_proof: `by
  intro h
  have hx : ¬ Delphi.Empirical.measuredFinRatio (0.35 : ℝ) := by
    unfold Delphi.Empirical.measuredFinRatio
    intro hc
    have h1 := hc.1
    norm_num at h1
  rcases h 0.35 hx with h1 | h1 <;> norm_num at h1`,
      },
      {
        id: 'both-bounds-widened',
        what: 'both disjuncts are widened, which WEAKENS the conclusion and so must still be true',
        statement: 'theorem m (r : ℝ) (h : ¬ Delphi.Empirical.measuredFinRatio r) : r < 0.9 ∨ 0.2 < r',
        expect: 'control_survived',
        is_control: true,
        proof_attempts: [`by
  rcases lt_or_ge r 0.9 with h1 | h1
  · exact Or.inl h1
  · exact Or.inr (by linarith)`],
        why_a_control:
          'a benchmark in which every mutant dies is not measuring the library, it is measuring whether ' +
          'mutants compile. This one MUST survive, and the run where it did not is what showed the ' +
          'harness could not tell "false" from "I could not prove it".',
      },
    ],
  },
  {
    id: 'weight_ratio_band',
    law: 'empirical-E2 MassExponentBand',
    module: 'Delphi.Empirical',
    what_it_says: 'under one power law, the weight ratio between two lengths lies between r^2.9 and r^3.02',
    where_the_constants_come_from: 'the measured within-species mass-exponent band, carried as the structure fields lo and hi',
    mutants: [
      {
        id: 'band-narrowed',
        what: 'the claimed band is narrowed to [2.95, 3.00], tighter than the structure guarantees',
        statement: `theorem m (M : Delphi.Empirical.MassExponentBand) {W : ℝ → ℝ} {a L₁ L₂ : ℝ}
    (hW : Delphi.PowerLaw W a M.b) (h₁ : 0 < L₁) (h₂ : 0 < L₂) (hr : 1 ≤ L₂ / L₁) :
    (L₂ / L₁) ^ (2.95 : ℝ) ≤ W L₂ / W L₁ ∧ W L₂ / W L₁ ≤ (L₂ / L₁) ^ (3.00 : ℝ)`,
        expect: 'UNPROVEN',
        why_unproven_is_the_right_expectation:
          'the structure guarantees only 2.9 <= b <= 3.02, so a narrower band does not follow - but it is ' +
          'also not refutable without constructing a band instance and a power law that violate it, which ' +
          'is more work than this first pass does. UNPROVEN here is an honest "not settled", and saying ' +
          'so is the point of having the category.',
      },
    ],
  },
];

/** Generic automation tried on every mutant, after any proof the mutant supplies itself. */
export const TACTICS = ['by norm_num', 'by linarith', 'by simp', 'by decide', 'by aesop'];

export const HOW_TO_READ_A_RESULT = Object.freeze({
  refuted: 'the strongest outcome. The mutant is provably false, so rejecting it is correct for the right reason.',
  unproven: 'the weakest useful outcome. Nothing settled it either way. Consistent with the mutant being false; not evidence of it, and never to be counted as a kill without saying so.',
  survived: 'the finding. The mutant is provable, so the mutation did not change what the statement claims.',
  control_survived: 'expected. A deliberately WEAKENED mutant must survive; if it does not, the harness is broken rather than the library.',
  a_kill_rate_alone_is_meaningless: 'because a mutant that merely fails to compile is counted as killed by every naive harness, and statement mutations break proofs by construction.',
});
