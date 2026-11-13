import Mathlib

open Finset

namespace Q2

/-- A finite probability space: weights `w` are nonnegative and sum to 1. -/
structure Prob (Ω : Type) [Fintype Ω] where
  w : Ω → ℝ
  nonneg : ∀ ω, 0 ≤ w ω
  sum_one : ∑ ω, w ω = 1

variable {Ω : Type} [Fintype Ω] (P : Prob Ω)

/-- expectation -/
def E (f : Ω → ℝ) : ℝ := ∑ ω, P.w ω * f ω
/-- covariance, written in centred form -/
def cov (f g : Ω → ℝ) : ℝ := ∑ ω, P.w ω * ((f ω - E P f) * (g ω - E P g))
/-- variance -/
def var (f : Ω → ℝ) : ℝ := cov P f f

lemma E_add (f g : Ω → ℝ) : E P (fun ω => f ω + g ω) = E P f + E P g := by
  simp [E, mul_add, sum_add_distrib]

lemma E_const (c : ℝ) : E P (fun _ => c) = c := by
  simp [E, ← sum_mul, P.sum_one]

lemma cov_comm (f g : Ω → ℝ) : cov P f g = cov P g f := by
  unfold cov; exact sum_congr rfl (fun ω _ => by ring)

lemma var_nonneg (f : Ω → ℝ) : 0 ≤ var P f := by
  unfold var cov
  exact sum_nonneg (fun ω _ => mul_nonneg (P.nonneg ω) (mul_self_nonneg _))

/-- Cauchy-Schwarz for the covariance form. -/
theorem cov_sq_le (f g : Ω → ℝ) : (cov P f g) ^ 2 ≤ var P f * var P g := by
  have h := Finset.sum_mul_sq_le_sq_mul_sq (univ : Finset Ω)
    (fun ω => Real.sqrt (P.w ω) * (f ω - E P f))
    (fun ω => Real.sqrt (P.w ω) * (g ω - E P g))
  have e1 : ∀ ω, Real.sqrt (P.w ω) * (f ω - E P f) * (Real.sqrt (P.w ω) * (g ω - E P g))
      = P.w ω * ((f ω - E P f) * (g ω - E P g)) := by
    intro ω
    have := Real.mul_self_sqrt (P.nonneg ω)
    calc _ = (Real.sqrt (P.w ω) * Real.sqrt (P.w ω)) * ((f ω - E P f) * (g ω - E P g)) := by ring
      _ = _ := by rw [this]
  have e2 : ∀ (u : Ω → ℝ), ∀ ω, (Real.sqrt (P.w ω) * (u ω - E P u)) ^ 2
      = P.w ω * ((u ω - E P u) * (u ω - E P u)) := by
    intro u ω
    have := Real.mul_self_sqrt (P.nonneg ω)
    calc _ = (Real.sqrt (P.w ω) * Real.sqrt (P.w ω)) * ((u ω - E P u) * (u ω - E P u)) := by ring
      _ = _ := by rw [this]
  simp only [e1, e2] at h
  exact h

lemma cov_add_right (p y e : Ω → ℝ) :
    cov P p (fun ω => y ω + e ω) = cov P p y + cov P p e := by
  unfold cov
  rw [E_add, ← sum_add_distrib]
  exact sum_congr rfl (fun ω _ => by ring)

lemma var_add (y e : Ω → ℝ) :
    var P (fun ω => y ω + e ω) = var P y + var P e + 2 * cov P y e := by
  unfold var
  rw [cov_add_right]
  have h1 : cov P (fun ω => y ω + e ω) y = cov P y y + cov P e y := by
    unfold cov
    rw [E_add, ← sum_add_distrib]
    exact sum_congr rfl (fun ω _ => by ring)
  have h2 : cov P (fun ω => y ω + e ω) e = cov P y e + cov P e e := by
    unfold cov
    rw [E_add, ← sum_add_distrib]
    exact sum_congr rfl (fun ω _ => by ring)
  rw [h1, h2, cov_comm P e y]
  ring

/-- (a) Attenuation bound, variance form.
`y_obs = y + e`; the noise is uncorrelated with the truth (implied by independence plus mean zero)
and with the predictor `p` (the predictor never saw the noise).  Then
`cov(p, y_obs)^2 <= var p * var y_obs * (var y / (var y + s2))`, where `s2 = var e`. -/
theorem attenuation (p y e : Ω → ℝ)
    (hye : cov P y e = 0) (hpe : cov P p e = 0) :
    (cov P p (fun ω => y ω + e ω)) ^ 2 * (var P y + var P e)
      ≤ var P p * var P (fun ω => y ω + e ω) * var P y := by
  have hv : var P (fun ω => y ω + e ω) = var P y + var P e := by
    rw [var_add, hye]; ring
  rw [cov_add_right, hpe, add_zero, hv]
  have := cov_sq_le P p y
  have hs : 0 ≤ var P y + var P e := add_nonneg (var_nonneg P y) (var_nonneg P e)
  calc (cov P p y) ^ 2 * (var P y + var P e) ≤ (var P p * var P y) * (var P y + var P e) :=
        mul_le_mul_of_nonneg_right this hs
    _ = _ := by ring

/-- Pearson correlation. -/
noncomputable def pearson (f g : Ω → ℝ) : ℝ :=
  cov P f g / (Real.sqrt (var P f) * Real.sqrt (var P g))

/-- (a, correlation form) `r^2 <= var y / (var y + s2)`  (the reliability), and so
`|r| <= sqrt(var y / (var y + s2))`. -/
theorem pearson_attenuation (p y e : Ω → ℝ)
    (hye : cov P y e = 0) (hpe : cov P p e = 0) (hp : 0 < var P p)
    (hobs : 0 < var P y + var P e) :
    (pearson P p (fun ω => y ω + e ω)) ^ 2 ≤ var P y / (var P y + var P e) ∧
    |pearson P p (fun ω => y ω + e ω)| ≤ Real.sqrt (var P y / (var P y + var P e)) := by
  have hv : var P (fun ω => y ω + e ω) = var P y + var P e := by
    rw [var_add, hye]; ring
  have key := attenuation P p y e hye hpe
  rw [hv] at key
  have hsq : (pearson P p (fun ω => y ω + e ω)) ^ 2
      = (cov P p (fun ω => y ω + e ω)) ^ 2 / (var P p * (var P y + var P e)) := by
    unfold pearson
    rw [hv, div_pow, mul_pow, Real.sq_sqrt hp.le, Real.sq_sqrt hobs.le]
  have h1 : (pearson P p (fun ω => y ω + e ω)) ^ 2 ≤ var P y / (var P y + var P e) := by
    rw [hsq, div_le_div_iff₀ (mul_pos hp hobs) hobs]
    nlinarith [key]
  refine ⟨h1, ?_⟩
  rw [← Real.sqrt_sq_eq_abs]
  exact Real.sqrt_le_sqrt h1

/-- Tightness: the noise-free truth as predictor reaches the bound exactly. -/
theorem attenuation_tight (y e : Ω → ℝ) (hye : cov P y e = 0)
    (hy : 0 < var P y) (hobs : 0 < var P y + var P e) :
    (pearson P y (fun ω => y ω + e ω)) ^ 2 = var P y / (var P y + var P e) := by
  have hv : var P (fun ω => y ω + e ω) = var P y + var P e := by
    rw [var_add, hye]; ring
  have hc : cov P y (fun ω => y ω + e ω) = var P y := by
    rw [cov_add_right, hye, add_zero]; rfl
  unfold pearson
  rw [hv, hc, div_pow, mul_pow, Real.sq_sqrt hy.le, Real.sq_sqrt hobs.le]
  field_simp

/-- (d) Elimination certificate.  If a claimed Pearson `r` satisfies
`r^2 * (vy + s2) > vy`, no noise-blind predictor on any finite probability space with these
variances (noise uncorrelated with the truth) attains it. -/
theorem eliminate (vy s2 r : ℝ) (hvy : 0 < vy) (hs : 0 ≤ s2)
    (hclaim : vy < r ^ 2 * (vy + s2)) :
    ¬ ∃ (Ω : Type) (_ : Fintype Ω) (P : Prob Ω) (p y e : Ω → ℝ),
        var P y = vy ∧ var P e = s2 ∧ cov P y e = 0 ∧ cov P p e = 0 ∧ 0 < var P p ∧
        pearson P p (fun ω => y ω + e ω) = r := by
  rintro ⟨Ω, _, P, p, y, e, hy, he, hye, hpe, hp, hr⟩
  have hobs : 0 < var P y + var P e := by rw [hy, he]; linarith
  have h := (pearson_attenuation P p y e hye hpe hp hobs).1
  rw [hr, hy, he] at h
  rw [le_div_iff₀ (by linarith)] at h
  linarith


/-! ## (b) Law of total variance on a pooled dataset; a target-only predictor -/

section TotalVariance
variable {T : Type} [Fintype T] [DecidableEq T] (g : Ω → T)

/-- the rows belonging to target `t` -/
def fiber (t : T) : Finset Ω := univ.filter (fun ω => g ω = t)

/-- weight of target `t` -/
def Wt (t : T) : ℝ := ∑ ω ∈ fiber g t, P.w ω

lemma sum_fibers (F : Ω → ℝ) : ∑ ω, F ω = ∑ t, ∑ ω ∈ fiber g t, F ω := by
  unfold fiber
  exact (Finset.sum_fiberwise univ g F).symm

variable (y : Ω → ℝ) (m : T → ℝ)

/-- `m t` is the weighted mean of `y` over target `t` (stated without division). -/
def IsGroupMean : Prop := ∀ t, Wt P g t * m t = ∑ ω ∈ fiber g t, P.w ω * y ω

variable {P g y m}

lemma fiber_resid (hm : IsGroupMean P g y m) (t : T) :
    ∑ ω ∈ fiber g t, P.w ω * (y ω - m t) = 0 := by
  have := hm t
  simp only [mul_sub, sum_sub_distrib]
  rw [← sum_mul]
  unfold Wt at this
  linarith

lemma E_group (hm : IsGroupMean P g y m) : E P (fun ω => m (g ω)) = E P y := by
  unfold E
  rw [sum_fibers g (fun ω => P.w ω * m (g ω)), sum_fibers g (fun ω => P.w ω * y ω)]
  refine sum_congr rfl (fun t _ => ?_)
  have h1 : ∑ ω ∈ fiber g t, P.w ω * m (g ω) = ∑ ω ∈ fiber g t, P.w ω * m t := by
    refine sum_congr rfl (fun ω hω => ?_)
    have : g ω = t := by simpa [fiber] using hω
    rw [this]
  rw [h1, ← sum_mul, ← hm t]
  unfold Wt; ring

/-- Mean-square error of any target-only predictor `f ∘ g`: within-target part plus a squared
distance of `f` from the group means, weighted by target weight. -/
theorem mse_decomp (hm : IsGroupMean P g y m) (f : T → ℝ) :
    ∑ ω, P.w ω * (y ω - f (g ω)) ^ 2
      = ∑ t, ∑ ω ∈ fiber g t, P.w ω * (y ω - m t) ^ 2 + ∑ t, Wt P g t * (m t - f t) ^ 2 := by
  rw [sum_fibers g, ← sum_add_distrib]
  refine sum_congr rfl (fun t _ => ?_)
  have hfib : ∀ ω ∈ fiber g t, P.w ω * (y ω - f (g ω)) ^ 2
      = P.w ω * (y ω - m t) ^ 2 + 2 * (m t - f t) * (P.w ω * (y ω - m t))
        + P.w ω * (m t - f t) ^ 2 := by
    intro ω hω
    have : g ω = t := by simpa [fiber] using hω
    rw [this]; ring
  rw [sum_congr rfl hfib, sum_add_distrib, sum_add_distrib, ← mul_sum, fiber_resid hm t, ← sum_mul]
  unfold Wt; ring

/-- Within-target variance (of the truth, around its target mean) -/
def within (P : Prob Ω) (g : Ω → T) (y : Ω → ℝ) (m : T → ℝ) : ℝ :=
  ∑ t, ∑ ω ∈ fiber g t, P.w ω * (y ω - m t) ^ 2
/-- Between-target variance (target means around the pooled mean) -/
def between (P : Prob Ω) (g : Ω → T) (y : Ω → ℝ) (m : T → ℝ) : ℝ :=
  ∑ t, Wt P g t * (m t - E P y) ^ 2

/-- (b1) Law of total variance for a pooled dataset. -/
theorem total_variance (hm : IsGroupMean P g y m) :
    var P y = between P g y m + within P g y m := by
  have h := mse_decomp hm (fun _ => E P y)
  have hv : var P y = ∑ ω, P.w ω * (y ω - E P y) ^ 2 := by
    unfold var cov; exact sum_congr rfl (fun ω _ => by ring)
  rw [hv, h]; unfold between within; ring

/-- (b2) The variance of the group-mean predictor is exactly the between-target variance. -/
theorem var_group_pred (hm : IsGroupMean P g y m) :
    var P (fun ω => m (g ω)) = between P g y m := by
  have hE := E_group hm
  unfold var cov between
  rw [hE, sum_fibers g]
  refine sum_congr rfl (fun t _ => ?_)
  have : ∀ ω ∈ fiber g t, P.w ω * ((m (g ω) - E P y) * (m (g ω) - E P y))
      = P.w ω * (m t - E P y) ^ 2 := by
    intro ω hω
    have : g ω = t := by simpa [fiber] using hω
    rw [this]; ring
  rw [sum_congr rfl this, ← sum_mul]; unfold Wt; ring

/-- (b3) The group-mean predictor has covariance with the truth equal to its own variance. -/
theorem cov_group_pred (hm : IsGroupMean P g y m) :
    cov P (fun ω => m (g ω)) y = between P g y m := by
  have hE := E_group hm
  unfold cov between
  rw [hE, sum_fibers g]
  refine sum_congr rfl (fun t _ => ?_)
  have h1 : ∀ ω ∈ fiber g t, P.w ω * ((m (g ω) - E P y) * (y ω - E P y))
      = (m t - E P y) * (P.w ω * y ω) - (m t - E P y) * E P y * P.w ω := by
    intro ω hω
    have : g ω = t := by simpa [fiber] using hω
    rw [this]; ring
  rw [sum_congr rfl h1, sum_sub_distrib, ← mul_sum, ← mul_sum, ← hm t]
  unfold Wt; ring

/-- (b4) Explained share of variance of the target-only predictor: `r^2 = between / total`. -/
theorem r2_target_only (hm : IsGroupMean P g y m)
    (hb : 0 < between P g y m) (hv : 0 < var P y) :
    (cov P (fun ω => m (g ω)) y) ^ 2 / (var P (fun ω => m (g ω)) * var P y)
      = between P g y m / var P y := by
  rw [cov_group_pred hm, var_group_pred hm]
  field_simp

/-- (b5) No target-only predictor beats the group means; the unexplained part is exactly the
within-target variance: for every `f`, MSE(f ∘ g) >= within, with equality at `f = m`. -/
theorem target_only_floor (hm : IsGroupMean P g y m) (f : T → ℝ) :
    within P g y m ≤ ∑ ω, P.w ω * (y ω - f (g ω)) ^ 2 ∧
    ∑ ω, P.w ω * (y ω - m (g ω)) ^ 2 = within P g y m := by
  have h := mse_decomp hm f
  have h0 := mse_decomp hm m
  refine ⟨?_, ?_⟩
  · rw [h]
    have : 0 ≤ ∑ t, Wt P g t * (m t - f t) ^ 2 :=
      sum_nonneg (fun t _ => mul_nonneg (sum_nonneg (fun ω _ => P.nonneg ω)) (sq_nonneg _))
    unfold within; linarith
  · rw [h0]; simp [within]

/-- (b6) Nothing within target: the residual of the group-mean predictor has zero covariance with
every target-only predictor `f ∘ g`. -/
theorem no_within_signal (hm : IsGroupMean P g y m) (f : T → ℝ) :
    cov P (fun ω => f (g ω)) (fun ω => y ω - m (g ω)) = 0 := by
  have hE : E P (fun ω => y ω - m (g ω)) = 0 := by
    have : E P (fun ω => y ω - m (g ω)) = E P y - E P (fun ω => m (g ω)) := by
      unfold E; simp [mul_sub, sum_sub_distrib]
    rw [this, E_group hm]; ring
  unfold cov
  rw [hE, sum_fibers g]
  refine sum_eq_zero (fun t _ => ?_)
  have : ∀ ω ∈ fiber g t, P.w ω * ((f (g ω) - E P (fun ω => f (g ω))) * (y ω - m (g ω) - 0))
      = (f t - E P (fun ω => f (g ω))) * (P.w ω * (y ω - m t)) := by
    intro ω hω
    have : g ω = t := by simpa [fiber] using hω
    rw [this]; ring
  rw [sum_congr rfl this, ← mul_sum, fiber_resid hm t, mul_zero]

end TotalVariance

/-! ## (c) Thermodynamic-cycle consistency -/

section Cycle
variable {X : Type}

/-- Sum of predicted edge values around the closed walk `v 0, v 1, ..., v n = v 0`. -/
def cycleSum (d : X → X → ℝ) (v : ℕ → X) (n : ℕ) : ℝ := ∑ i ∈ range n, d (v i) (v (i + 1))

/-- (c1) A state-function predictor `d a b = f b - f a` sums to zero around every closed walk. -/
theorem cycle_zero_of_potential (f : X → ℝ) (d : X → X → ℝ) (hd : ∀ a b, d a b = f b - f a)
    (v : ℕ → X) (n : ℕ) (hclosed : v n = v 0) : cycleSum d v n = 0 := by
  unfold cycleSum
  simp only [hd]
  rw [Finset.sum_range_sub (fun i => f (v i)) n, hclosed]; ring

/-- Path additivity: `d a c = d a b + d b c`. -/
def PathAdditive (d : X → X → ℝ) : Prop := ∀ a b c, d a c = d a b + d b c

/-- (c2) A path-additive predictor is a difference of a potential (anchored at any base point). -/
theorem potential_of_additive (d : X → X → ℝ) (hd : PathAdditive d) (x0 : X) :
    ∀ a b, d a b = d x0 b - d x0 a := by
  intro a b
  have := hd x0 a b
  linarith

/-- (c3) A predictor additive over transformations sums to zero around every closed cycle. -/
theorem cycle_zero_of_additive (d : X → X → ℝ) (hd : PathAdditive d)
    (v : ℕ → X) (n : ℕ) (hclosed : v n = v 0) : cycleSum d v n = 0 :=
  cycle_zero_of_potential (fun x => d (v 0) x) d (potential_of_additive d hd (v 0)) v n hclosed

/-- (c4) If truth `t` and prediction `d` are both additive, the per-edge errors `d - t` sum to
zero around every closed cycle. -/
theorem residual_cycle_zero (d t : X → X → ℝ) (hd : PathAdditive d) (ht : PathAdditive t)
    (v : ℕ → X) (n : ℕ) (hclosed : v n = v 0) :
    cycleSum (fun a b => d a b - t a b) v n = 0 := by
  have h1 := cycle_zero_of_additive d hd v n hclosed
  have h2 := cycle_zero_of_additive t ht v n hclosed
  unfold cycleSum at *
  rw [sum_sub_distrib, h1, h2]; ring

lemma E_sq_sum {n : ℕ} (ε : Fin n → Ω → ℝ) :
    E P (fun ω => (∑ i, ε i ω) * (∑ j, ε j ω))
      = ∑ i, ∑ j, E P (fun ω => ε i ω * ε j ω) := by
  unfold E
  calc ∑ ω, P.w ω * ((∑ i, ε i ω) * (∑ j, ε j ω))
      = ∑ ω, ∑ i, ∑ j, P.w ω * (ε i ω * ε j ω) := by
        refine sum_congr rfl (fun ω _ => ?_)
        rw [sum_mul_sum, mul_sum]
        exact sum_congr rfl (fun i _ => by rw [mul_sum])
    _ = ∑ i, ∑ j, ∑ ω, P.w ω * (ε i ω * ε j ω) := by
        rw [sum_comm]
        exact sum_congr rfl (fun i _ => sum_comm)

/-- (c5) Random per-edge errors `ε i` that sum to zero at every outcome (closure of the cycle)
cannot be pairwise uncorrelated with positive second moment: if `E[ε_i ε_j] = 0` for `i ≠ j`
then every `E[ε_i^2] = 0`. -/
theorem deviations_not_independent {n : ℕ} (ε : Fin n → Ω → ℝ)
    (hsum : ∀ ω, ∑ i, ε i ω = 0)
    (hind : ∀ i j, i ≠ j → E P (fun ω => ε i ω * ε j ω) = 0) :
    ∀ i, E P (fun ω => ε i ω * ε i ω) = 0 := by
  have h0 : E P (fun ω => (∑ i, ε i ω) * (∑ j, ε j ω)) = 0 := by
    simp [E, hsum]
  have hdiag : ∑ i, ∑ j, E P (fun ω => ε i ω * ε j ω)
      = ∑ i, E P (fun ω => ε i ω * ε i ω) := by
    refine sum_congr rfl (fun i _ => ?_)
    rw [sum_eq_single i]
    · intro j _ hj; exact hind i j (Ne.symm hj)
    · simp
  have hnn : ∀ i, 0 ≤ E P (fun ω => ε i ω * ε i ω) :=
    fun i => sum_nonneg (fun ω _ => mul_nonneg (P.nonneg ω) (mul_self_nonneg _))
  rw [E_sq_sum, hdiag] at h0
  intro i
  exact (sum_eq_zero_iff_of_nonneg (fun i _ => hnn i)).1 h0 i (mem_univ i)

/-- (c6) Exchangeable errors on an `n`-cycle: with common second moment `s` and common
cross-moment `c`, closure forces `s + (n-1) c = 0`, i.e. error correlation `-1/(n-1)`. -/
theorem exchangeable_cycle_deviations {n : ℕ} (hn : 0 < n) (ε : Fin n → Ω → ℝ)
    (hsum : ∀ ω, ∑ i, ε i ω = 0) (s c : ℝ)
    (hs : ∀ i, E P (fun ω => ε i ω * ε i ω) = s)
    (hc : ∀ i j, i ≠ j → E P (fun ω => ε i ω * ε j ω) = c) :
    s + ((n : ℝ) - 1) * c = 0 := by
  have h0 : E P (fun ω => (∑ i, ε i ω) * (∑ j, ε j ω)) = 0 := by
    simp [E, hsum]
  have hrow : ∀ i : Fin n, ∑ j, E P (fun ω => ε i ω * ε j ω) = s + ((n : ℝ) - 1) * c := by
    intro i
    rw [← add_sum_erase univ _ (mem_univ i), hs i]
    have : ∀ j ∈ univ.erase i, E P (fun ω => ε i ω * ε j ω) = c :=
      fun j hj => hc i j (Ne.symm (ne_of_mem_erase hj))
    rw [sum_congr rfl this, sum_const, card_erase_of_mem (mem_univ i), card_univ,
      Fintype.card_fin, nsmul_eq_mul, Nat.cast_sub hn]
    simp
  rw [E_sq_sum] at h0
  simp only [hrow, sum_const, card_univ, Fintype.card_fin, nsmul_eq_mul] at h0
  have hn' : (n : ℝ) ≠ 0 := by exact_mod_cast hn.ne'
  rcases mul_eq_zero.1 h0 with h | h
  · exact absurd h hn'
  · exact h

end Cycle

end Q2

#print axioms Q2.cov_sq_le
#print axioms Q2.attenuation
#print axioms Q2.pearson_attenuation
#print axioms Q2.attenuation_tight
#print axioms Q2.eliminate
#print axioms Q2.total_variance
#print axioms Q2.var_group_pred
#print axioms Q2.cov_group_pred
#print axioms Q2.r2_target_only
#print axioms Q2.target_only_floor
#print axioms Q2.no_within_signal
#print axioms Q2.cycle_zero_of_potential
#print axioms Q2.cycle_zero_of_additive
#print axioms Q2.residual_cycle_zero
#print axioms Q2.deviations_not_independent
#print axioms Q2.exchangeable_cycle_deviations
