import Mathlib

/-!
NEGATIVE CONTROL. This file MUST FAIL `check.sh`. It states the false claim that a thicker coating
RAISES the steady back-face temperature (the opposite of `backRise_antitone_thickness`). The proof
attempt cannot succeed because the statement is false (counterexample: ΔT=1, k=1, Rs=0, Ra=1, d=0 vs d=1:
rise 1/2 vs 1/3).
-/
namespace FireCoatingNeg

noncomputable def backRise (ΔT d k Rs Ra : ℝ) : ℝ := ΔT * Ra / (d / k + Rs + Ra)

theorem thicker_raises_rise (ΔT d₁ d₂ k Rs Ra : ℝ) (hΔ : 0 < ΔT) (hd₁ : 0 ≤ d₁)
    (h12 : d₁ < d₂) (hk : 0 < k) (hRs : 0 ≤ Rs) (hRa : 0 < Ra) :
    backRise ΔT d₁ k Rs Ra < backRise ΔT d₂ k Rs Ra := by
  unfold backRise
  have h1 : 0 < d₁ / k + Rs + Ra := by have := div_nonneg hd₁ hk.le; linarith
  have h2 : 0 < d₂ / k + Rs + Ra := by have := div_nonneg (hd₁.trans h12.le) hk.le; linarith
  rw [div_lt_div_iff₀ h1 h2]
  have : d₁ / k < d₂ / k := div_lt_div_of_pos_right h12 hk
  nlinarith [mul_pos hΔ hRa]

end FireCoatingNeg

#print axioms FireCoatingNeg.thicker_raises_rise
