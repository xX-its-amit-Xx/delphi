/-
# Allometry, climb, glide range and the aerobic power bound

Fills the gaps the flying-fish audit (`lean/AUDIT-FLYING-FISH.md`) and the physics thread's coupled simulator
need: a general power law so measured exponents (Davenport 1992: mass ∝ SL^2.981, fin area ∝ SL^1.834) can
be composed instead of assumed isometric; the climb rate as excess power over weight; the range of a steady
glide; and an upper bound on sustained aerobic mechanical power from oxygen delivery (Fick) and efficiency,
composed with the power required for flight (R5) and a crossover theorem that replaces Thompson's bare
muscle premise (R6) by whatever exponent the physiology supplies.

## What is proved

* `PowerLaw f a b` (`f L = a L^b`, real exponent): `powerLaw_ratio`, `powerLaw_log` (exponent `b`),
  `powerLaw_div` (a quotient of power laws is a power law with exponent `b₁ - b₂`), `cubeLaw_powerLaw`
  (the cube law is `PowerLaw` with `b = 3`), `vmin_powerLaw_log` (under mass and area power laws with constant
  `ρ`, `C_L,max`, the `v_min` exponent is `(b_W - b_S)/2`).
* `climbRate_le`: from a mechanical power balance `P_avail = P_req + W c + loss` with `loss ≥ 0`,
  `c ≤ (P_avail - P_req)/W`; `climb_nonneg_iff`.
* `glide_range_le`: a steady glide with no thrust, lift equal to weight, `L/D ≤ (L/D)_max`, from height `h`,
  covers at most `h (L/D)_max` horizontally (energy: `W h = D x + loss`, `loss ≥ 0`).
* `aerobicPower η E Q Ca Cv = η E Q (Ca - Cv)` (Fick's principle times the oxycaloric equivalent times
  efficiency): `aerobic_le_Ca`, `aerobic_le_metabolic` (`η ≤ 1`), `sustained_le` (a sustained mechanical
  power bounded by the aerobic supply is at most `η E Q Ca`), `sustained_flight_requires` (sustained flight
  at `v_min` needs `η E Q Ca ≥ P_req`), `climb_le_aerobic`.
* `powerLaw_crossover`: if supply and demand are power laws and the supply exponent is smaller, there is a
  size above which supply falls short. With demand `∝ L^{7/2}` (R5) this is Thompson's size limit for any
  supply exponent below `7/2`, the muscle premise no longer assumed.

## What is assumed, not proved

Every law is a named hypothesis on functions of one linear dimension or on positive reals: that oxygen
delivery is `Q (Ca - Cv)` (Fick), that mechanical power is at most `η` times the metabolic power from that
oxygen, `0 ≤ Cv ≤ Ca`, `0 ≤ η ≤ 1`, that sustained power is aerobic (anaerobic bursts are outside), the
power balance for climb with non-negative losses, steady gliding with lift equal to weight and no thrust
(ground effect, updraft and taxiing thrust are outside, which is why the field glide distances exceed the
bound), and the power-law forms with their exponents. No number from `physics/` appears in a statement.
-/
import Mathlib
import Delphi.Scaling

open Real

namespace Delphi

/-! ### General power laws -/

/-- `f L = a L^b` for `L > 0`, with a real exponent. -/
def PowerLaw (f : ℝ → ℝ) (a b : ℝ) : Prop := 0 < a ∧ ∀ L, 0 < L → f L = a * L ^ b

lemma powerLaw_pos {f : ℝ → ℝ} {a b : ℝ} (h : PowerLaw f a b) {L : ℝ} (hL : 0 < L) : 0 < f L := by
  rw [h.2 L hL]; exact mul_pos h.1 (Real.rpow_pos_of_pos hL b)

theorem powerLaw_ratio {f : ℝ → ℝ} {a b : ℝ} (h : PowerLaw f a b) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    f L₂ / f L₁ = (L₂ / L₁) ^ b := by
  rw [h.2 L₁ h₁, h.2 L₂ h₂, mul_div_mul_left _ _ h.1.ne', Real.div_rpow h₂.le h₁.le]

theorem powerLaw_log {f : ℝ → ℝ} {a b : ℝ} (h : PowerLaw f a b) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    Real.log (f L₂ / f L₁) = b * Real.log (L₂ / L₁) := by
  rw [powerLaw_ratio h h₁ h₂, Real.log_rpow (by positivity)]

/-- A quotient of power laws is a power law with the difference of the exponents. -/
theorem powerLaw_div {f g : ℝ → ℝ} {a₁ b₁ a₂ b₂ : ℝ} (hf : PowerLaw f a₁ b₁) (hg : PowerLaw g a₂ b₂) :
    PowerLaw (fun L => f L / g L) (a₁ / a₂) (b₁ - b₂) := by
  refine ⟨div_pos hf.1 hg.1, fun L hL => ?_⟩
  simp only
  rw [hf.2 L hL, hg.2 L hL, Real.rpow_sub hL]
  field_simp

/-- The cube law is the power law with exponent `3`. -/
theorem cubeLaw_powerLaw {W : ℝ → ℝ} {k : ℝ} (h : CubeLaw W k) : PowerLaw W k 3 :=
  ⟨h.1, fun L hL => by rw [h.2 L hL, show (3 : ℝ) = ((3 : ℕ) : ℝ) by norm_num, Real.rpow_natCast]⟩

/-- Under power laws for weight and lifting area with constant `ρ`, `C_L,max`, the minimum-speed exponent is
`(b_W - b_S)/2`. With Davenport's exponents this is `(2.981 - 1.834)/2`, not the isometric `1/2`. -/
theorem vmin_powerLaw_log {W S : ℝ → ℝ} {aW bW aS bS ρ Cmax : ℝ} (hW : PowerLaw W aW bW) (hS : PowerLaw S aS bS)
    (hρ : 0 < ρ) (hCmax : 0 < Cmax) {L₁ L₂ : ℝ} (h₁ : 0 < L₁) (h₂ : 0 < L₂) :
    Real.log (vmin ρ Cmax (W L₂) (S L₂) / vmin ρ Cmax (W L₁) (S L₁)) = (bW - bS) / 2 * Real.log (L₂ / L₁) := by
  have hW₁ := powerLaw_pos hW h₁; have hW₂ := powerLaw_pos hW h₂
  have hS₁ := powerLaw_pos hS h₁; have hS₂ := powerLaw_pos hS h₂
  have hq := powerLaw_div hW hS
  have hr : vmin ρ Cmax (W L₂) (S L₂) / vmin ρ Cmax (W L₁) (S L₁) = Real.sqrt ((W L₂ / S L₂) / (W L₁ / S L₁)) := by
    unfold vmin
    rw [← Real.sqrt_div' _ (by positivity)]
    congr 1
    field_simp
  rw [hr, Real.log_sqrt (by positivity)]
  have := powerLaw_log hq h₁ h₂
  rw [this]
  ring

/-! ### Climb -/

/-- Rate of climb from excess power: `(P_avail - P_req) / W`. -/
noncomputable def climbRate (W Pavail Preq : ℝ) : ℝ := (Pavail - Preq) / W

/-- **Climb bound.** If the available mechanical power is spent on level flight, on raising the weight at
vertical speed `c`, and on non-negative losses, then `c ≤ (P_avail - P_req)/W`. -/
theorem climbRate_le {W Pavail Preq c loss : ℝ} (hW : 0 < W) (hbal : Pavail = Preq + W * c + loss)
    (hloss : 0 ≤ loss) : c ≤ climbRate W Pavail Preq := by
  unfold climbRate
  rw [le_div_iff₀ hW]
  linarith

theorem climb_nonneg_iff {W Pavail Preq : ℝ} (hW : 0 < W) : 0 ≤ climbRate W Pavail Preq ↔ Preq ≤ Pavail := by
  unfold climbRate
  rw [div_nonneg_iff]
  constructor
  · rintro (⟨h, _⟩ | ⟨_, h⟩) <;> linarith
  · intro h; left; exact ⟨by linarith, hW.le⟩

/-! ### Glide range -/

/-- **Steady-glide range.** With no thrust, lift equal to weight, `L/D ≤ (L/D)_max` and the potential energy
`W h` spent on drag work `D x` plus non-negative losses, the horizontal distance is at most `h (L/D)_max`. -/
theorem glide_range_le {W h D x LDmax loss Lift : ℝ} (_hW : 0 < W) (hD : 0 < D) (hh : 0 ≤ h)
    (hlift : Lift = W) (hLD : Lift / D ≤ LDmax) (henergy : W * h = D * x + loss) (hloss : 0 ≤ loss) :
    x ≤ h * LDmax := by
  rw [hlift, div_le_iff₀ hD] at hLD
  have hx : D * x ≤ W * h := by linarith
  have : x ≤ W * h / D := by rw [le_div_iff₀ hD]; linarith
  calc x ≤ W * h / D := this
    _ ≤ LDmax * D * h / D := by apply div_le_div_of_nonneg_right _ hD.le; nlinarith
    _ = h * LDmax := by field_simp

/-- **Ground effect.** If flying near the surface reduces drag by a fraction `δ` (`D_ge = (1 - δ) D`,
`0 ≤ δ < 1`) and leaves lift unaffected, the range bound becomes `h (L/D)_max / (1 - δ)`. Park and Choi
(2010) measured `δ` of 0.09 to 0.14 for a flying-fish model; the number enters only as a candidate input. -/
theorem glide_range_le_groundEffect {W h D x LDmax loss Lift δ : ℝ} (hW : 0 < W) (hD : 0 < D) (hh : 0 ≤ h)
    (_hδ0 : 0 ≤ δ) (hδ1 : δ < 1) (hlift : Lift = W) (hLD : Lift / D ≤ LDmax)
    (henergy : W * h = (1 - δ) * D * x + loss) (hloss : 0 ≤ loss) : x ≤ h * LDmax / (1 - δ) := by
  have h1δ : 0 < 1 - δ := by linarith
  have hLD' : Lift / ((1 - δ) * D) ≤ LDmax / (1 - δ) := by
    rw [div_le_div_iff₀ (by positivity) h1δ]
    rw [div_le_iff₀ hD] at hLD
    nlinarith
  have := glide_range_le hW (by positivity) hh hlift hLD' henergy hloss
  rw [mul_div_assoc]
  exact this

/-! ### Aerobic power bound -/

/-- Mechanical power available from aerobic metabolism: efficiency `η`, oxycaloric equivalent `E` (J per unit
O₂), cardiac output `Q`, arterial and venous O₂ contents `Ca`, `Cv` (Fick: O₂ delivered = `Q (Ca - Cv)`). -/
def aerobicPower (η E Q Ca Cv : ℝ) : ℝ := η * E * Q * (Ca - Cv)

theorem aerobic_le_Ca {η E Q Ca Cv : ℝ} (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv) :
    aerobicPower η E Q Ca Cv ≤ η * E * Q * Ca := by
  unfold aerobicPower
  have : 0 ≤ η * E * Q := by positivity
  nlinarith

theorem aerobic_le_metabolic {η E Q Ca Cv : ℝ} (hη : 0 ≤ η) (hη1 : η ≤ 1) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv)
    (hCa : 0 ≤ Ca) : aerobicPower η E Q Ca Cv ≤ E * Q * Ca := by
  have h1 := aerobic_le_Ca hη hE hQ hCv (Ca := Ca)
  have h2 : η * E * Q * Ca ≤ E * Q * Ca := by
    have : 0 ≤ E * Q * Ca := by positivity
    nlinarith
  linarith

/-- **Sustained power bound.** A sustained mechanical power supplied aerobically is at most `η E Q Ca`. -/
theorem sustained_le {P η E Q Ca Cv : ℝ} (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv)
    (hsus : P ≤ aerobicPower η E Q Ca Cv) : P ≤ η * E * Q * Ca :=
  le_trans hsus (aerobic_le_Ca hη hE hQ hCv)

/-- **Sustained flight needs enough oxygen.** If flight at speed `v` needs `P_req = W v / (L/D)` and the
sustained power is aerobic, then `P_req ≤ η E Q Ca`. -/
theorem sustained_flight_requires {W v LD P η E Q Ca Cv : ℝ} (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv)
    (hsus : P ≤ aerobicPower η E Q Ca Cv) (hflight : powerRequired W v LD ≤ P) :
    powerRequired W v LD ≤ η * E * Q * Ca :=
  le_trans hflight (sustained_le hη hE hQ hCv hsus)

/-- **Climb under an aerobic supply.** `c ≤ (η E Q Ca - P_req) / W`. -/
theorem climb_le_aerobic {W Preq c loss P η E Q Ca Cv : ℝ} (hW : 0 < W) (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q)
    (hCv : 0 ≤ Cv) (hsus : P ≤ aerobicPower η E Q Ca Cv) (hbal : P = Preq + W * c + loss) (hloss : 0 ≤ loss) :
    c ≤ (η * E * Q * Ca - Preq) / W := by
  have h1 := sustained_le hη hE hQ hCv hsus
  rw [le_div_iff₀ hW]
  linarith

/-! ### Crossover: a size limit for any supply exponent below the demand exponent -/

/-- **Crossover.** If demand `D L = a₁ L^{b₁}` and supply `S L = a₂ L^{b₂}` with `b₂ < b₁`, there is a size
above which supply falls short of demand. With `b₁ = 7/2` (R5) this is Thompson's size limit for flight under
any physiological supply exponent below `7/2`; the muscle premise (`b₂ = 3`) is one instance. -/
theorem powerLaw_crossover {D S : ℝ → ℝ} {a₁ b₁ a₂ b₂ : ℝ} (hD : PowerLaw D a₁ b₁) (hS : PowerLaw S a₂ b₂)
    (hb : b₂ < b₁) : ∃ Ls : ℝ, 0 < Ls ∧ ∀ L, Ls < L → S L < D L := by
  have ha₁ := hD.1; have ha₂ := hS.1
  have hdiff : 0 < b₁ - b₂ := by linarith
  set Ls := max 1 ((a₂ / a₁) ^ (b₁ - b₂)⁻¹) with hLs
  refine ⟨Ls, lt_of_lt_of_le one_pos (le_max_left _ _), fun L hL => ?_⟩
  have hL1 : 1 < L := lt_of_le_of_lt (le_max_left _ _) hL
  have hLpos : 0 < L := by linarith
  have hgt : (a₂ / a₁) ^ (b₁ - b₂)⁻¹ < L := lt_of_le_of_lt (le_max_right _ _) hL
  have hpow : a₂ / a₁ < L ^ (b₁ - b₂) := by
    have := Real.rpow_lt_rpow (by positivity) hgt hdiff
    rwa [Real.rpow_inv_rpow (by positivity) hdiff.ne'] at this
  rw [hD.2 L hLpos, hS.2 L hLpos]
  have hsplit : L ^ b₁ = L ^ b₂ * L ^ (b₁ - b₂) := by
    rw [← Real.rpow_add hLpos]; congr 1; ring
  rw [hsplit]
  have hb2 : 0 < L ^ b₂ := Real.rpow_pos_of_pos hLpos b₂
  have : a₂ < a₁ * L ^ (b₁ - b₂) := by rwa [div_lt_iff₀ ha₁, mul_comm] at hpow
  nlinarith [mul_lt_mul_of_pos_left this hb2]

end Delphi
