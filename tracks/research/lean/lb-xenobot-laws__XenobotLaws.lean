import Mathlib

/-!
# Elimination certificates for xenobots / cell-aggregate biobots

Four small laws a designer can use to rule a design OUT before building it. Every physical
assumption is a named hypothesis; nothing here is derived from first-principles fluid mechanics or
reaction-diffusion theory inside Lean. What Lean checks is that the stated bound really follows
from the stated hypotheses.

Run: `bash tracks/lean/check.sh <this file>`
-/

namespace XenobotLaws

open Real

/-! ## 1. Energy budget (no feeding) -/

/-- **Lifetime ceiling.** If the body spends at least `Pmin > 0` per unit time for its whole life
`T` (hypothesis `hspent : Pmin * T ≤ spent`) and cannot spend more than its store
(`hstore : spent ≤ Estore`, i.e. no feeding), then `T ≤ Estore / Pmin`.

Shows: pure bookkeeping from the two named inequalities.
Does NOT show: that a real xenobot has a constant minimum power, that yolk is its only store, or
what `Estore` and `Pmin` are. Those are measurements. -/
theorem lifetime_le (Estore Pmin T spent : ℝ) (hP : 0 < Pmin)
    (hspent : Pmin * T ≤ spent) (hstore : spent ≤ Estore) :
    T ≤ Estore / Pmin := by
  rw [le_div_iff₀ hP]
  have : T * Pmin = Pmin * T := mul_comm _ _
  linarith

/-- **Mission elimination.** A mission of duration `Treq` strictly longer than `Estore / Pmin`
cannot be completed without feeding: there is no amount `spent` that is both at least
`Pmin * Treq` and at most `Estore`.

Does NOT show that missions shorter than the ceiling succeed (the ceiling is necessary, not
sufficient). -/
theorem mission_eliminated (Estore Pmin Treq : ℝ) (hP : 0 < Pmin)
    (hlong : Estore / Pmin < Treq) :
    ¬ ∃ spent : ℝ, Pmin * Treq ≤ spent ∧ spent ≤ Estore := by
  rintro ⟨spent, h1, h2⟩
  have := lifetime_le Estore Pmin Treq spent hP h1 h2
  linarith

/-! ## 2. Low-Reynolds locomotion -/

/-- **Stokes speed ceiling.** Named hypotheses: the body moves at the Stokes-drag balance speed of
a sphere, `v = F / (6 π μ R)` (`hv`), and the total propulsive force is at most `n * fmax`
(`hF`: `n` cilia, each at most `fmax`). Then `v ≤ n * fmax / (6 π μ R)`.

Shows: the algebraic consequence only.
Does NOT show: that Stokes drag holds for a ciliated, non-spherical, near-wall body (xenobots
move along a dish floor, which adds drag, so the true speed is lower still), nor that all cilia
push in the same direction. -/
theorem stokes_speed_le (F n fmax μ R v : ℝ) (hμ : 0 < μ) (hR : 0 < R)
    (hv : v = F / (6 * π * μ * R)) (hF : F ≤ n * fmax) :
    v ≤ n * fmax / (6 * π * μ * R) := by
  have hd : 0 < 6 * π * μ * R := by positivity
  rw [hv, div_le_div_iff_of_pos_right hd]
  exact hF

/-- **Speed elimination.** Under the same hypotheses, a required speed `vreq` strictly above the
ceiling is not reached: `v < vreq`. Same caveats as `stokes_speed_le`. -/
theorem speed_eliminated (F n fmax μ R v vreq : ℝ) (hμ : 0 < μ) (hR : 0 < R)
    (hv : v = F / (6 * π * μ * R)) (hF : F ≤ n * fmax)
    (hreq : n * fmax / (6 * π * μ * R) < vreq) :
    v < vreq :=
  lt_of_le_of_lt (stokes_speed_le F n fmax μ R v hμ hR hv hF) hreq

/-- **Reynolds consistency.** If the speed is at most `vmax` and the Reynolds number computed at
`vmax` is below one, then the Reynolds number at the actual speed `v` is below one, so using the
Stokes law was self-consistent.

Shows: monotonicity of `ρ v L / μ` in `v`. Does NOT show that `Re < 1` is small enough for Stokes
drag to be accurate (in practice one wants `Re ≪ 1`). -/
theorem reynolds_lt_one (ρ v L μ vmax : ℝ) (hρ : 0 < ρ) (hL : 0 < L) (hμ : 0 < μ)
    (hv : v ≤ vmax) (hRe : ρ * vmax * L / μ < 1) :
    ρ * v * L / μ < 1 := by
  rw [div_lt_one hμ] at hRe ⊢
  have h1 : ρ * v * L ≤ ρ * vmax * L := by
    have := mul_le_mul_of_nonneg_left hv (mul_pos hρ hL).le
    calc ρ * v * L = ρ * L * v := by ring
      _ ≤ ρ * L * vmax := this
      _ = ρ * vmax * L := by ring
  linarith

/-! ## 3. Diffusion limit on the size of a solid aggregate -/

/-- Steady-state oxygen concentration at distance `x` from the centre of a solid sphere of radius
`R` that consumes oxygen at a constant rate `q` per volume everywhere, with diffusivity `D` and
surface concentration `c0`. This closed form is the textbook solution of
`D (c'' + (2/x) c') = q`, `c(R) = c0`; `profile_satisfies_ode` checks that algebraically from the
stated derivative formulas, it is not derived inside Lean. -/
noncomputable def oxygenProfile (D c0 q R x : ℝ) : ℝ := c0 - q * (R ^ 2 - x ^ 2) / (6 * D)

/-- The profile equals `c0` at the surface. -/
theorem profile_surface (D c0 q R : ℝ) : oxygenProfile D c0 q R R = c0 := by
  unfold oxygenProfile
  simp

/-- With first derivative `c' = q x / (3 D)` and second derivative `c'' = q / (3 D)` (the formal
derivatives of `oxygenProfile` in `x`; stated here as formulas, NOT proved to be derivatives in
Lean), the spherical steady-state balance `D (c'' + (2/x) c') = q` holds for `x ≠ 0`. -/
theorem profile_satisfies_ode (D q x : ℝ) (hD : D ≠ 0) (hx : x ≠ 0) :
    D * (q / (3 * D) + 2 / x * (q * x / (3 * D))) = q := by
  field_simp
  ring

/-- **Anoxic-core certificate (iff).** For `D > 0`, `q > 0`, the centre value of the
constant-consumption profile is negative exactly when `R² > 6 D c0 / q`.

Shows: if the radius exceeds `sqrt (6 D c0 / q)`, the model in which EVERY cell keeps consuming at
rate `q` has no non-negative solution, so some central region must be starved (anoxic or
metabolically shut down). Conversely below that radius the centre is supplied.
Does NOT show: that real cells consume at a constant rate regardless of concentration
(Michaelis-Menten uptake softens the edge), that the body is solid (a cavity relaxes the limit), or
what happens to the starved cells. -/
theorem anoxic_core_iff (D c0 q R : ℝ) (hD : 0 < D) (hq : 0 < q) :
    oxygenProfile D c0 q R 0 < 0 ↔ 6 * D * c0 / q < R ^ 2 := by
  unfold oxygenProfile
  have h6 : 0 < 6 * D := by positivity
  rw [div_lt_iff₀ hq]
  have hkey : c0 - q * (R ^ 2 - 0 ^ 2) / (6 * D) = (6 * D * c0 - R ^ 2 * q) / (6 * D) := by
    field_simp
    ring
  rw [hkey, div_neg_iff]
  constructor
  · rintro (⟨_, h⟩ | ⟨h, _⟩)
    · linarith
    · linarith
  · intro h
    right
    exact ⟨by linarith, h6⟩

/-- **Size elimination.** Any solid, uniformly consuming aggregate with `R² > 6 D c0 / q` is
eliminated as a fully oxygenated design. Same caveats as `anoxic_core_iff`. -/
theorem radius_eliminated (D c0 q R : ℝ) (hD : 0 < D) (hq : 0 < q)
    (hbig : 6 * D * c0 / q < R ^ 2) :
    oxygenProfile D c0 q R 0 < 0 :=
  (anoxic_core_iff D c0 q R hD hq).mpr hbig

/-! ## 4. Kinematic self-replication with shrinking offspring -/

/-- **Geometric shrinkage.** If each generation's diameter is at most `r` times its parent's
(`hstep`, with `0 ≤ r`), then generation `n` has diameter at most `d 0 * r ^ n`.

Shows: induction on the per-generation inequality. Does NOT show that real offspring shrink by a
fixed factor; that is the named hypothesis. -/
theorem diameter_le_geometric (d : ℕ → ℝ) (r : ℝ) (hr : 0 ≤ r)
    (hstep : ∀ k, d (k + 1) ≤ r * d k) (n : ℕ) :
    d n ≤ d 0 * r ^ n := by
  induction n with
  | zero => simp
  | succ k ih =>
    calc d (k + 1) ≤ r * d k := hstep k
      _ ≤ r * (d 0 * r ^ k) := mul_le_mul_of_nonneg_left ih hr
      _ = d 0 * r ^ (k + 1) := by ring

/-- **Replication stops.** Under geometric shrinkage, if `d 0 * r ^ n < dmin` then generation `n`
is below the minimum viable diameter `dmin`.

Does NOT show that generations above `dmin` do replicate (the bound is necessary, not
sufficient), nor that `dmin` exists for a given organism; both are empirical. -/
theorem replication_stops (d : ℕ → ℝ) (r dmin : ℝ) (hr : 0 ≤ r)
    (hstep : ∀ k, d (k + 1) ≤ r * d k) (n : ℕ) (hn : d 0 * r ^ n < dmin) :
    d n < dmin :=
  lt_of_le_of_lt (diameter_le_geometric d r hr hstep n) hn

/-- **Logarithmic form.** For `0 < r < 1`, `0 < d0`, `0 < dmin`: any generation index `n` larger
than `log (d0 / dmin) / log (1 / r)` satisfies `d0 * r ^ n < dmin`. -/
theorem log_bound_implies_small (d0 dmin r : ℝ) (n : ℕ) (hd0 : 0 < d0) (hdm : 0 < dmin)
    (hr0 : 0 < r) (hr1 : r < 1)
    (hn : Real.log (d0 / dmin) / Real.log (1 / r) < n) :
    d0 * r ^ n < dmin := by
  have hlr : Real.log r < 0 := Real.log_neg hr0 hr1
  have hl1 : Real.log (1 / r) = - Real.log r := by rw [one_div, Real.log_inv]
  have hpos : 0 < Real.log (1 / r) := by rw [hl1]; linarith
  rw [div_lt_iff₀ hpos, hl1, Real.log_div hd0.ne' hdm.ne'] at hn
  have hrn : 0 < r ^ n := pow_pos hr0 n
  have hlog : Real.log (d0 * r ^ n) < Real.log dmin := by
    rw [Real.log_mul hd0.ne' hrn.ne', Real.log_pow]
    linarith
  exact (Real.log_lt_log_iff (mul_pos hd0 hrn) hdm).mp hlog

/-- **Generation-count ceiling.** Under geometric shrinkage with `0 < r < 1`, every viable
generation `n` (one with `dmin ≤ d n`) satisfies `n ≤ log (d 0 / dmin) / log (1 / r)`.

Shows: the number of self-replication rounds is bounded by a logarithm of the size ratio.
Does NOT show: that this many rounds are achieved, or that shrinkage is the mechanism that stops
real xenobot replication; it is an upper bound under the named hypotheses only. -/
theorem generations_le (d : ℕ → ℝ) (r dmin : ℝ) (hd0 : 0 < d 0) (hdm : 0 < dmin)
    (hr0 : 0 < r) (hr1 : r < 1) (hstep : ∀ k, d (k + 1) ≤ r * d k)
    (n : ℕ) (hviable : dmin ≤ d n) :
    (n : ℝ) ≤ Real.log (d 0 / dmin) / Real.log (1 / r) := by
  by_contra hcon
  rw [not_le] at hcon
  have h1 := log_bound_implies_small (d 0) dmin r n hd0 hdm hr0 hr1 hcon
  have h2 := replication_stops d r dmin hr0.le hstep n h1
  linarith

end XenobotLaws

#print axioms XenobotLaws.lifetime_le
#print axioms XenobotLaws.mission_eliminated
#print axioms XenobotLaws.stokes_speed_le
#print axioms XenobotLaws.speed_eliminated
#print axioms XenobotLaws.reynolds_lt_one
#print axioms XenobotLaws.profile_surface
#print axioms XenobotLaws.profile_satisfies_ode
#print axioms XenobotLaws.anoxic_core_iff
#print axioms XenobotLaws.radius_eliminated
#print axioms XenobotLaws.diameter_le_geometric
#print axioms XenobotLaws.replication_stops
#print axioms XenobotLaws.log_bound_implies_small
#print axioms XenobotLaws.generations_le
