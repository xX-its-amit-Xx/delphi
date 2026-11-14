/-
XenobotBounds.lean  (cs-xenobots; core Lean 4 only, no Mathlib, natural-number units)
Four bounds for cilia-driven cell spheroids. Each theorem is CONDITIONAL on named hypotheses;
the numbers are certificates for published ranges, in integer units:
  speed um/s, length um, time days, kinematic viscosity 1e6 um^2/s (water), oxygen limit 3e5 um^2
  (= 6*Dox*C0/Q with Dox=2e-9 m^2/s, C0=0.25 mol/m^3, Q=1e-2 mol/m^3/s).
-/
namespace XenobotBounds

/-- S1 low-Reynolds: Re <= 1 iff v*D <= nu. Monotone in both speed and size. -/
theorem lowRe_of_le {v D vmax Dmax nu : Nat}
    (hv : v ≤ vmax) (hD : D ≤ Dmax) (h : vmax * Dmax ≤ nu) : v * D ≤ nu :=
  Nat.le_trans (Nat.mul_le_mul hv hD) h

/-- Certificate: the fastest (50 um/s), largest (500 um) human-cell biobot has Re <= 1 in water. -/
theorem anthrobot_lowRe : 50 * 500 ≤ 1000000 := by decide

/-- S3 oxygen: a sphere with zero-order uptake keeps oxygen at its centre iff R^2 <= 6*D*C0/Q =: L. -/
theorem oxygen_of_le {R Rmax L : Nat} (hR : R ≤ Rmax) (h : Rmax * Rmax ≤ L) : R * R ≤ L :=
  Nat.le_trans (Nat.mul_le_mul hR hR) h

/-- Certificates: radius 250 um (held-out max) and 417 um (development, derived) are inside L = 3e5 um^2. -/
theorem anthrobot_oxygen : 250 * 250 ≤ 300000 := by decide
theorem xenobot_oxygen : 417 * 417 ≤ 300000 := by decide

/-- S2 energy store: NAMED HYPOTHESES closed store `E`, draw at least `P` per day, never refilled.
    `used t` is energy spent by day t. If the body is alive at day T then T*P <= E. -/
theorem lifetime_bound (used : Nat → Nat) (E P T : Nat)
    (h0 : used 0 = 0) (hdraw : ∀ t, used t + P ≤ used (t + 1)) (halive : used T ≤ E) : T * P ≤ E := by
  have key : ∀ t, t * P ≤ used t := by
    intro t
    induction t with
    | zero => simp
    | succ n ih =>
      have := hdraw n
      rw [Nat.succ_mul]
      omega
  exact Nat.le_trans (key T) halive

/-- The calibrated instance (T_max = 24 d from frog-cell papers) is REFUTED by the held-out
    human-cell paper (45 d stated): recorded as a checked fact, not hidden. -/
theorem calibrated_lifetime_refuted : ¬ (45 ≤ 24) := by decide

/-- S4 replication: NAMED HYPOTHESES each generation's best pile is at least `d` cells smaller than
    its parent, and a pile needs at least `p` cells to mature. Then G generations need G*d + p <= s 0. -/
theorem generation_bound (s : Nat → Nat) (d p G : Nat)
    (hshrink : ∀ g, s (g + 1) + d ≤ s g) (hviable : p ≤ s G) : G * d + p ≤ s 0 := by
  have key : ∀ g, s g + g * d ≤ s 0 := by
    intro g
    induction g with
    | zero => simp
    | succ n ih =>
      have := hshrink n
      rw [Nat.succ_mul]
      omega
  have := key G
  omega

/-- Certificate: observed maximum of 4 generations is within the calibrated ceiling of 8. -/
theorem generations_within : 4 ≤ 8 := by decide

end XenobotBounds

#print axioms XenobotBounds.lowRe_of_le
#print axioms XenobotBounds.oxygen_of_le
#print axioms XenobotBounds.lifetime_bound
#print axioms XenobotBounds.generation_bound
#print axioms XenobotBounds.anthrobot_lowRe
#print axioms XenobotBounds.calibrated_lifetime_refuted
