import Mathlib

/-
  Agent hv-morph-turing. Finite-domain complements to the registry law `turing-wavelength`
  (which is about the onset wavenumber on an unbounded domain and explicitly does NOT cover
  mode quantisation on a finite tissue).

  All biology enters as NAMED HYPOTHESES; nothing here says any tissue is a Turing system.

  * `no_mode_below_critical_size`: with no-flux boundaries on a domain of length L the admissible
    wavenumbers are k_n = n*pi/L (n = 1,2,...). If the unstable band ends at khi and L*khi < pi,
    every admissible mode lies above the band: no pattern on a too-small domain.
  * `count_mono_in_size`: at fixed pattern wavelength lam, the number of whole wavelengths that
    fit (n*lam <= L < (n+1)*lam) cannot decrease when the domain grows (stripe insertion; more
    digits on a wider handplate).
  * `count_mono_in_wavelength`: on a fixed domain, shortening the wavelength cannot decrease the
    count (the Sheth et al. 2012 reading: lower distal Hox dose -> shorter wavelength -> more
    digits, doi:10.1126/science.1226804).
-/

namespace Delphi.Agents4.TuringFiniteDomain

/-- No admissible no-flux mode `n*pi/L` (stated division-free as `khi*L < n*pi`) lies inside an
unstable band ending at `khi` when `L*khi < pi`. -/
theorem no_mode_below_critical_size {L khi : ℝ} (hsmall : L * khi < Real.pi)
    (n : ℕ) (hn : 1 ≤ n) : khi * L < n * Real.pi := by
  have h1 : (1:ℝ) ≤ (n:ℝ) := by exact_mod_cast hn
  have h2 : (1:ℝ) * Real.pi ≤ (n:ℝ) * Real.pi :=
    mul_le_mul_of_nonneg_right h1 Real.pi_pos.le
  linarith

/-- At fixed wavelength, the count of whole wavelengths is monotone in domain size. -/
theorem count_mono_in_size {lam L L' : ℝ} {n m : ℕ} (hlam : 0 < lam)
    (hn : (n:ℝ) * lam ≤ L) (hm : L' < ((m:ℝ) + 1) * lam) (hLL : L ≤ L') : n ≤ m := by
  by_contra h
  have h1 : m + 1 ≤ n := Nat.succ_le_of_lt (not_le.mp h)
  have h2 : ((m:ℝ) + 1) ≤ (n:ℝ) := by exact_mod_cast h1
  have h3 : ((m:ℝ) + 1) * lam ≤ (n:ℝ) * lam := mul_le_mul_of_nonneg_right h2 hlam.le
  linarith

/-- On a fixed domain, a shorter wavelength never gives fewer whole wavelengths. -/
theorem count_mono_in_wavelength {lam lam' L : ℝ} {n m : ℕ}
    (hlam : 0 < lam) (hle : lam' ≤ lam)
    (hn : (n:ℝ) * lam ≤ L) (hm : L < ((m:ℝ) + 1) * lam') : n ≤ m := by
  by_contra h
  have h1 : m + 1 ≤ n := Nat.succ_le_of_lt (not_le.mp h)
  have h2 : ((m:ℝ) + 1) ≤ (n:ℝ) := by exact_mod_cast h1
  have hpos : (0:ℝ) ≤ (m:ℝ) + 1 := by positivity
  have h3 : ((m:ℝ) + 1) * lam' ≤ ((m:ℝ) + 1) * lam := mul_le_mul_of_nonneg_left hle hpos
  have h4 : ((m:ℝ) + 1) * lam ≤ (n:ℝ) * lam := mul_le_mul_of_nonneg_right h2 hlam.le
  linarith

end Delphi.Agents4.TuringFiniteDomain

#print axioms Delphi.Agents4.TuringFiniteDomain.no_mode_below_critical_size
#print axioms Delphi.Agents4.TuringFiniteDomain.count_mono_in_size
#print axioms Delphi.Agents4.TuringFiniteDomain.count_mono_in_wavelength
