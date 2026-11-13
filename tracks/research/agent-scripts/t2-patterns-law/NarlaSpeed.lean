import Mathlib

/-
  Track 2 (microbial range-expansion front), candidate law `chemotactic-front-speed-scaling`.

  Source relation (Narla, Cremer, Hwa 2021, PNAS, doi:10.1073/pnas.2105138118, Eq. 21, as transcribed
  in delphi-work/agents/design-patterns.json):
      c = X * sqrt( r * A / (X + Da) ),   X = chi0 - D_rho,  A = a0 / a_m,
  squared here so that no square root enters the statement:
      c ^ 2 * (X + Da) = X ^ 2 * r * A.
  X (net chemotactic minus cell diffusivity), Da (attractant diffusivity), A (attractant ratio) and
  the growth rate r are positive reals; c > 0 is the front speed.

  NAMED HYPOTHESIS (not proved here, not an axiom): `NarlaHyp X Da A r c`.

  PROVED from the hypothesis:
    * ratio law: two conditions with the same X, Da, A and growth rates r1, r2 satisfy
      c2 ^ 2 * r1 = c1 ^ 2 * r2, i.e. speed goes as the SQUARE ROOT of growth rate;
    * strict monotonicity in r; quadrupling r doubles c;
    * the log-log slope of speed on growth rate is exactly 1/2;
    * an elimination lemma: a committed speed ratio and growth ratio with (speed ratio)^2 > growth
      ratio are inconsistent, with a numeric instance;
    * c ^ 2 < X * r * A (the fast-attractant-diffusion limit is never exceeded) and a faster
      attractant diffusivity gives a strictly slower front;
    * existence: for any positive X, Da, A, r some c satisfies the hypothesis, and one witness uses
      the numbers fitted in delphi-work/agents/design-patterns.json.

  NOT established: that the Narla closed form describes any real colony; that X, Da, A are
  independent of r (the design file reports measured speed-vs-growth exponents near 0.9 to 1.1
  inside a titration series, which is exactly what the elimination lemma would refute under
  constant X); that a travelling wave exists; nothing about the nonlinear model.
-/

namespace Delphi.Track2.ChemotaxisFront

/-- Named hypothesis: Narla closed form, squared. -/
structure NarlaHyp (X Da A r c : ℝ) : Prop where
  X_pos : 0 < X
  Da_pos : 0 < Da
  A_pos : 0 < A
  r_pos : 0 < r
  c_pos : 0 < c
  speed : c ^ 2 * (X + Da) = X ^ 2 * r * A

/-- Ratio law: at fixed X, Da, A the squared speed is proportional to the growth rate. -/
theorem ratio_law {X Da A r1 r2 c1 c2 : ℝ}
    (h1 : NarlaHyp X Da A r1 c1) (h2 : NarlaHyp X Da A r2 c2) :
    c2 ^ 2 * r1 = c1 ^ 2 * r2 := by
  have hs : 0 < X + Da := add_pos h1.X_pos h1.Da_pos
  have e1 := h1.speed
  have e2 := h2.speed
  have key : (c2 ^ 2 * r1 - c1 ^ 2 * r2) * (X + Da) = 0 := by
    linear_combination r1 * e2 - r2 * e1
  rcases mul_eq_zero.1 key with h | h
  · linarith
  · exact absurd h hs.ne'

/-- Speed rises strictly with growth rate at fixed X, Da, A. -/
theorem speed_strictMono {X Da A r1 r2 c1 c2 : ℝ}
    (h1 : NarlaHyp X Da A r1 c1) (h2 : NarlaHyp X Da A r2 c2) (hr : r1 < r2) :
    c1 < c2 := by
  have hX := h1.X_pos
  have hA := h1.A_pos
  have hs : 0 < X + Da := add_pos h1.X_pos h1.Da_pos
  have e1 := h1.speed
  have e2 := h2.speed
  have hc1 := h1.c_pos
  have hc2 := h2.c_pos
  have hsq : c1 ^ 2 < c2 ^ 2 := by
    have : (c2 ^ 2 - c1 ^ 2) * (X + Da) = X ^ 2 * A * (r2 - r1) := by
      linear_combination e2 - e1
    have hp : 0 < X ^ 2 * A * (r2 - r1) := by
      have : 0 < r2 - r1 := by linarith
      positivity
    by_contra hn
    push_neg at hn
    nlinarith [mul_nonneg (sub_nonneg.2 hn) hs.le]
  nlinarith

/-- Quadrupling the growth rate exactly doubles the front speed. -/
theorem quadruple_doubles {X Da A r c1 c2 : ℝ}
    (h1 : NarlaHyp X Da A r c1) (h2 : NarlaHyp X Da A (4 * r) c2) :
    c2 = 2 * c1 := by
  have hr := h1.r_pos
  have hc1 := h1.c_pos
  have hc2 := h2.c_pos
  have e := ratio_law h1 h2
  have : (c2 - 2 * c1) * (c2 + 2 * c1) * r = 0 := by
    linear_combination e
  rcases mul_eq_zero.1 this with h | h
  · rcases mul_eq_zero.1 h with h | h
    · linarith
    · exfalso; linarith
  · exfalso; linarith

/-- The log-log slope of speed on growth rate is exactly 1/2. -/
theorem loglog_slope_half {X Da A r1 r2 c1 c2 : ℝ}
    (h1 : NarlaHyp X Da A r1 c1) (h2 : NarlaHyp X Da A r2 c2) :
    Real.log c2 - Real.log c1 = (Real.log r2 - Real.log r1) / 2 := by
  have e := ratio_law h1 h2
  have hc1 := h1.c_pos
  have hc2 := h2.c_pos
  have hr1 := h1.r_pos
  have hr2 := h2.r_pos
  have hl := congrArg Real.log e
  rw [Real.log_mul (by positivity) hr1.ne', Real.log_mul (by positivity) hr2.ne',
    Real.log_pow, Real.log_pow] at hl
  push_cast at hl
  linarith

/-- Elimination lemma: a speed ratio of at least `ρ` together with a growth ratio of at most `σ`
is inconsistent when `ρ ^ 2 > σ`. -/
theorem superlinear_rules_out {X Da A r1 r2 c1 c2 ρ σ : ℝ}
    (h1 : NarlaHyp X Da A r1 c1) (h2 : NarlaHyp X Da A r2 c2)
    (hρ : 0 < ρ) (hspeed : ρ * c1 ≤ c2) (hgrowth : r2 ≤ σ * r1) (hgap : σ < ρ ^ 2) :
    False := by
  have e := ratio_law h1 h2
  have hc1 := h1.c_pos
  have hr1 := h1.r_pos
  have hsq : ρ ^ 2 * c1 ^ 2 ≤ c2 ^ 2 := by nlinarith [mul_pos hρ hc1]
  have hp : 0 < c1 ^ 2 * r1 := by positivity
  have h3 : ρ ^ 2 * (c1 ^ 2 * r1) ≤ c2 ^ 2 * r1 := by nlinarith [hsq, hr1]
  have h4 : c2 ^ 2 * r1 = c1 ^ 2 * r2 := e
  have h5 : c1 ^ 2 * r2 ≤ c1 ^ 2 * (σ * r1) :=
    mul_le_mul_of_nonneg_left hgrowth (by positivity)
  nlinarith [h3, h4, h5, hp, hgap]

/-- Numeric instance: a 1.5-fold faster front cannot come from a growth rate at most 2-fold higher
(1.5 ^ 2 = 2.25 > 2) with X, Da, A held fixed. -/
theorem one_point_five_vs_two {X Da A r1 r2 c1 c2 : ℝ}
    (h1 : NarlaHyp X Da A r1 c1) (h2 : NarlaHyp X Da A r2 c2)
    (hspeed : (3 / 2 : ℝ) * c1 ≤ c2) (hgrowth : r2 ≤ 2 * r1) : False :=
  superlinear_rules_out h1 h2 (by norm_num) hspeed hgrowth (by norm_num)

/-- The squared speed never reaches the fast-attractant-diffusion value `X * r * A`. -/
theorem speed_sq_lt {X Da A r c : ℝ} (h : NarlaHyp X Da A r c) : c ^ 2 < X * r * A := by
  have hX := h.X_pos
  have hD := h.Da_pos
  have hA := h.A_pos
  have hr := h.r_pos
  have hc := h.c_pos
  have e := h.speed
  have hp : 0 < X * r * A := by positivity
  nlinarith [mul_pos hp hD, mul_pos hp hX, sq_nonneg X, mul_pos hX hc]

/-- A faster attractant diffusivity gives a strictly slower front. -/
theorem speed_decreasing_in_Da {X Da1 Da2 A r c1 c2 : ℝ}
    (h1 : NarlaHyp X Da1 A r c1) (h2 : NarlaHyp X Da2 A r c2) (hd : Da1 < Da2) :
    c2 < c1 := by
  have hX := h1.X_pos
  have hA := h1.A_pos
  have hr := h1.r_pos
  have hc1 := h1.c_pos
  have hc2 := h2.c_pos
  have hD1 := h1.Da_pos
  have e1 := h1.speed
  have e2 := h2.speed
  have hp : 0 < X ^ 2 * r * A := by positivity
  have hsq : c2 ^ 2 < c1 ^ 2 := by
    by_contra hn
    push_neg at hn
    nlinarith [mul_nonneg (sub_nonneg.2 hn) (add_pos hX hD1).le, mul_pos hc2 hc2]
  nlinarith

/-- Existence: every positive parameter set has a front speed satisfying the hypothesis. -/
theorem exists_speed {X Da A r : ℝ} (hX : 0 < X) (hD : 0 < Da) (hA : 0 < A) (hr : 0 < r) :
    ∃ c, NarlaHyp X Da A r c := by
  have hs : 0 < X + Da := add_pos hX hD
  have hv : 0 < X ^ 2 * r * A / (X + Da) := by positivity
  refine ⟨Real.sqrt (X ^ 2 * r * A / (X + Da)), hX, hD, hA, hr, Real.sqrt_pos.2 hv, ?_⟩
  rw [Real.sq_sqrt hv.le]
  field_simp

/-- Non-vacuity at the fitted numbers of the design file (mm^2/h, mm^2/h, dimensionless, 1/h):
X = 0.7874, Da = 2.88, A = 100, r = 0.9985. -/
theorem witness : ∃ c : ℝ, NarlaHyp (3937 / 5000) (72 / 25) 100 (1997 / 2000) c :=
  exists_speed (by norm_num) (by norm_num) (by norm_num) (by norm_num)

#print axioms ratio_law
#print axioms speed_strictMono
#print axioms quadruple_doubles
#print axioms loglog_slope_half
#print axioms superlinear_rules_out
#print axioms one_point_five_vs_two
#print axioms speed_sq_lt
#print axioms speed_decreasing_in_Da
#print axioms exists_speed
#print axioms witness

end Delphi.Track2.ChemotaxisFront
