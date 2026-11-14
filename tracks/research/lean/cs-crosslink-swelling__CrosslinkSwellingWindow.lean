import Mathlib

/-!
# Crosslink density, modulus and swelling: the trade-off window

Named hypotheses (NOT derived here; Mathlib has no polymer-network vocabulary):
* affine rubber elasticity: shear modulus `G = ν * kT` (ν = elastically active strands per volume);
* Flory-Rehner in the high-swelling limit: `Q^(5/3) * G = K` for a constant `K > 0` fixed by the
  polymer-solvent pair, i.e. `Q = (K / G)^(3/5)`.

What IS proved, from those two formulas only:
1. modulus strictly increases with crosslink density;
2. equilibrium swelling strictly decreases with modulus;
3. on log-log axes the slope of swelling against modulus is exactly `-3/5`;
4. the product `Q^(5/3) * G` is invariant, so a stiffness floor and a swelling floor can be met
   together only if `Gmin * Qmin^(5/3) ≤ K` (the trade-off window can be empty).
-/

namespace CrosslinkSwelling

/-- Affine rubber-elasticity modulus. -/
noncomputable def modulus (ν kT : ℝ) : ℝ := ν * kT

/-- High-swelling Flory-Rehner equilibrium swelling ratio. -/
noncomputable def swelling (K G : ℝ) : ℝ := (K / G) ^ ((3 : ℝ) / 5)

theorem modulus_strictMono {kT ν₁ ν₂ : ℝ} (hkT : 0 < kT) (h : ν₁ < ν₂) :
    modulus ν₁ kT < modulus ν₂ kT := by
  unfold modulus
  exact mul_lt_mul_of_pos_right h hkT

theorem swelling_strictAnti {K G₁ G₂ : ℝ} (hK : 0 < K) (hG₁ : 0 < G₁) (h : G₁ < G₂) :
    swelling K G₂ < swelling K G₁ := by
  unfold swelling
  have hG₂ : 0 < G₂ := lt_trans hG₁ h
  have h1 : K / G₂ < K / G₁ := by
    rw [div_lt_div_iff₀ hG₂ hG₁]
    exact mul_lt_mul_of_pos_left h hK
  exact Real.rpow_lt_rpow (le_of_lt (div_pos hK hG₂)) h1 (by norm_num)

theorem log_swelling_slope {K G : ℝ} (hK : 0 < K) (hG : 0 < G) :
    Real.log (swelling K G) = (3 / 5 : ℝ) * (Real.log K - Real.log G) := by
  unfold swelling
  rw [Real.log_rpow (div_pos hK hG), Real.log_div (ne_of_gt hK) (ne_of_gt hG)]

theorem invariant {K G : ℝ} (hK : 0 < K) (hG : 0 < G) :
    swelling K G ^ ((5 : ℝ) / 3) * G = K := by
  unfold swelling
  rw [← Real.rpow_mul (le_of_lt (div_pos hK hG))]
  norm_num
  field_simp

/-- The trade-off: if the required stiffness and swelling floors are jointly too ambitious,
no crosslink density meets both. -/
theorem window_empty {K Gmin Qmin : ℝ} (hK : 0 < K) (hGmin : 0 < Gmin) (hQmin : 0 < Qmin)
    (hbad : K < Gmin * Qmin ^ ((5 : ℝ) / 3)) :
    ¬ ∃ G, Gmin ≤ G ∧ Qmin ≤ swelling K G := by
  rintro ⟨G, hG, hQ⟩
  have hGpos : 0 < G := lt_of_lt_of_le hGmin hG
  have hinv := invariant hK hGpos
  have hpow : Qmin ^ ((5 : ℝ) / 3) ≤ swelling K G ^ ((5 : ℝ) / 3) :=
    Real.rpow_le_rpow (le_of_lt hQmin) hQ (by norm_num)
  have hpos : 0 ≤ Qmin ^ ((5 : ℝ) / 3) := Real.rpow_nonneg (le_of_lt hQmin) _
  have : Gmin * Qmin ^ ((5 : ℝ) / 3) ≤ swelling K G ^ ((5 : ℝ) / 3) * G := by
    calc Gmin * Qmin ^ ((5 : ℝ) / 3) ≤ G * Qmin ^ ((5 : ℝ) / 3) :=
          mul_le_mul_of_nonneg_right hG hpos
      _ ≤ G * swelling K G ^ ((5 : ℝ) / 3) := mul_le_mul_of_nonneg_left hpow (le_of_lt hGpos)
      _ = swelling K G ^ ((5 : ℝ) / 3) * G := mul_comm _ _
  linarith

end CrosslinkSwelling

#print axioms CrosslinkSwelling.modulus_strictMono
#print axioms CrosslinkSwelling.swelling_strictAnti
#print axioms CrosslinkSwelling.log_swelling_slope
#print axioms CrosslinkSwelling.invariant
#print axioms CrosslinkSwelling.window_empty
