import Mathlib

/-!
Quantitative gene-expression identities (agent hv-mol-central-dogma).
All biology enters as named hypotheses; the theorems are the algebra that follows.
-/

namespace CentralDogma

/-- Steady state of dp/dt = k - d*p : protein level = synthesis / degradation. -/
theorem steady_state_protein (k d p : ℝ) (hd : d ≠ 0) (h : k - d * p = 0) :
    p = k / d := by
  rw [eq_div_iff hd]
  linear_combination (-1 : ℝ) * h

/-- Two-stage model (mRNA then protein) at steady state:
    p = km*kp/(dm*dp). -/
theorem two_stage_mean (km dm kp dp m p : ℝ) (hdm : dm ≠ 0) (hdp : dp ≠ 0)
    (hm : km - dm * m = 0) (hp : kp * m - dp * p = 0) :
    p = km * kp / (dm * dp) := by
  rw [eq_div_iff (mul_ne_zero hdm hdp)]
  linear_combination (-kp) * hm + (-dm) * hp

/-- Poisson (constitutive) expression: variance = mean gives Fano factor 1. -/
theorem poisson_fano (mean var : ℝ) (hm : mean ≠ 0) (h : var = mean) :
    var / mean = 1 := by
  rw [h]; exact div_self hm

/-- Bursty expression (Thattai-van Oudenaarden form): var = mean*(1+b), b > 0
    gives Fano = 1 + b, strictly above the Poisson value 1. -/
theorem bursty_fano (mean var b : ℝ) (hm : 0 < mean) (hb : 0 < b)
    (h : var = mean * (1 + b)) :
    var / mean = 1 + b ∧ 1 < var / mean := by
  have e : var / mean = 1 + b := by
    rw [h, div_eq_iff hm.ne']; ring
  exact ⟨e, by rw [e]; linarith⟩

/-- Gamma-distributed protein number with shape a (bursts per cell cycle) and
    scale b (mean burst size): mean = a*b, var = a*b^2 give CV^2 = 1/a, Fano = b. -/
theorem gamma_cv2_fano (a b mean var : ℝ) (ha : 0 < a) (hb : 0 < b)
    (hmean : mean = a * b) (hvar : var = a * b ^ 2) :
    var / mean ^ 2 = 1 / a ∧ var / mean = b := by
  subst hmean hvar
  have ha' := ha.ne'
  have hb' := hb.ne'
  constructor
  · rw [div_eq_div_iff (pow_ne_zero 2 (mul_ne_zero ha' hb')) ha']; ring
  · rw [div_eq_iff (mul_ne_zero ha' hb')]; ring

/-- Variance proportional to mean (Bar-Even scaling) is the same as
    CV^2 = B / mean. -/
theorem cv2_inverse_mean (mean var B : ℝ) (hm : mean ≠ 0) (h : var = B * mean) :
    var / mean ^ 2 = B / mean := by
  rw [h, div_eq_div_iff (pow_ne_zero 2 hm) hm]; ring

end CentralDogma

#print axioms CentralDogma.steady_state_protein
#print axioms CentralDogma.two_stage_mean
#print axioms CentralDogma.poisson_fano
#print axioms CentralDogma.bursty_fano
#print axioms CentralDogma.gamma_cv2_fano
#print axioms CentralDogma.cv2_inverse_mean
