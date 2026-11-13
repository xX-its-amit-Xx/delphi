import Mathlib

/-!
# Enhancer-promoter specificity: which model classes can change the rank order of enhancers?

`f p e` is the measured (true, noise-free) effect of enhancer `e` on promoter `p`.
A *rank reversal* between promoters `p` and `q` is a pair of enhancers `e, e'` that `p`
orders one way and `q` orders strictly the other way.

Classes:
 (a) `Mult`            f p e = a e * b p, b p > 0
 (b) `SingleIndexMono` f p e = h p (a e), every h p monotone   (`SingleIndexStrict`: strictly monotone)
 (c) `LogAdd`          log f p e = a e + b p                   (f = exp (a e + b p))
 (d) `Thermo`          f p e = V p * a e / (K p + a e), a e >= 0, V p, K p > 0  (promoter-specific saturation)
 (e) `TwoFactor`/`General` interaction: f p e = a e * b p + c p e  (c unconstrained) or a two-feature model
-/

namespace EPSpec

variable {E P : Type*}

/-- Strict rank reversal between promoters `p` and `q` on enhancers `e`, `e'`. -/
def RankReversal (f : P → E → ℝ) (p q : P) (e e' : E) : Prop :=
  f p e < f p e' ∧ f q e' < f q e

def HasReversal (f : P → E → ℝ) : Prop := ∃ p q e e', RankReversal f p q e e'

/-- Weak (tie-resolving) reversal: `p` has `e <= e'` (possibly tied) but `q` has `e' < e`. -/
def WeakReversal (f : P → E → ℝ) (p q : P) (e e' : E) : Prop :=
  f p e ≤ f p e' ∧ f q e' < f q e

/-! ## The model classes -/

def Mult (f : P → E → ℝ) : Prop :=
  ∃ (a : E → ℝ) (b : P → ℝ), (∀ p, 0 < b p) ∧ ∀ p e, f p e = a e * b p

def SingleIndexMono (f : P → E → ℝ) : Prop :=
  ∃ (a : E → ℝ) (h : P → ℝ → ℝ), (∀ p, Monotone (h p)) ∧ ∀ p e, f p e = h p (a e)

def SingleIndexStrict (f : P → E → ℝ) : Prop :=
  ∃ (a : E → ℝ) (h : P → ℝ → ℝ), (∀ p, StrictMono (h p)) ∧ ∀ p e, f p e = h p (a e)

def LogAdd (f : P → E → ℝ) : Prop :=
  ∃ (a : E → ℝ) (b : P → ℝ), ∀ p e, f p e = Real.exp (a e + b p)

def Thermo (f : P → E → ℝ) : Prop :=
  ∃ (a : E → ℝ) (V K : P → ℝ), (∀ e, 0 ≤ a e) ∧ (∀ p, 0 < V p) ∧ (∀ p, 0 < K p) ∧
    ∀ p e, f p e = V p * (a e / (K p + a e))

/-- General interaction model: multiplicative part plus an unconstrained interaction term. -/
def General (f : P → E → ℝ) : Prop :=
  ∃ (a : E → ℝ) (b : P → ℝ) (c : P → E → ℝ), ∀ p e, f p e = a e * b p + c p e

/-- Two independent enhancer features read with promoter-specific weights. -/
def TwoFactor (f : P → E → ℝ) : Prop :=
  ∃ (u v : E → ℝ) (w : P → ℝ), ∀ p e, f p e = w p * u e + (1 - w p) * v e

/-! ## Core lemma: monotone single-index models never reverse -/

theorem no_reversal_of_monotoneOn {f : P → E → ℝ} {a : E → ℝ} {h : P → ℝ → ℝ} {S : Set ℝ}
    (ha : ∀ e, a e ∈ S) (hm : ∀ p, MonotoneOn (h p) S)
    (hf : ∀ p e, f p e = h p (a e)) : ¬ HasReversal f := by
  rintro ⟨p, q, e, e', h1, h2⟩
  rw [hf, hf] at h1 h2
  have hlt : a e < a e' := by
    by_contra hc
    push_neg at hc
    have := hm p (ha e') (ha e) hc
    linarith
  have := hm q (ha e) (ha e') hlt.le
  linarith

theorem no_reversal_of_monotone {f : P → E → ℝ} (hf : SingleIndexMono f) : ¬ HasReversal f := by
  obtain ⟨a, h, hm, hf⟩ := hf
  exact no_reversal_of_monotoneOn (S := Set.univ) (fun _ => Set.mem_univ _)
    (fun p => (hm p).monotoneOn _) hf

/-! ## Inclusions between classes -/

theorem strict_le_mono {f : P → E → ℝ} (hf : SingleIndexStrict f) : SingleIndexMono f := by
  obtain ⟨a, h, hm, hf⟩ := hf
  exact ⟨a, h, fun p => (hm p).monotone, hf⟩

theorem mult_le_strict {f : P → E → ℝ} (hf : Mult f) : SingleIndexStrict f := by
  obtain ⟨a, b, hb, hf⟩ := hf
  refine ⟨a, fun p x => x * b p, fun p x y hxy => ?_, fun p e => hf p e⟩
  exact mul_lt_mul_of_pos_right hxy (hb p)

theorem logAdd_le_strict {f : P → E → ℝ} (hf : LogAdd f) : SingleIndexStrict f := by
  obtain ⟨a, b, hf⟩ := hf
  refine ⟨a, fun p x => Real.exp (x + b p), fun p x y hxy => ?_, fun p e => hf p e⟩
  exact Real.exp_lt_exp.mpr (by linarith)

theorem logAdd_le_mult {f : P → E → ℝ} (hf : LogAdd f) : Mult f := by
  obtain ⟨a, b, hf⟩ := hf
  refine ⟨fun e => Real.exp (a e), fun p => Real.exp (b p), fun p => Real.exp_pos _, fun p e => ?_⟩
  rw [hf, Real.exp_add]

theorem thermo_monotoneOn (V K : ℝ) (hV : 0 < V) (hK : 0 < K) :
    MonotoneOn (fun x : ℝ => V * (x / (K + x))) (Set.Ici 0) := by
  intro x hx y hy hxy
  simp only [Set.mem_Ici] at hx hy
  have h1 : x / (K + x) ≤ y / (K + y) := by
    rw [div_le_div_iff₀ (by linarith) (by linarith)]
    nlinarith
  exact mul_le_mul_of_nonneg_left h1 hV.le

theorem thermo_no_reversal {f : P → E → ℝ} (hf : Thermo f) : ¬ HasReversal f := by
  obtain ⟨a, V, K, ha, hV, hK, hf⟩ := hf
  exact no_reversal_of_monotoneOn (S := Set.Ici 0) (h := fun p x => V p * (x / (K p + x)))
    (fun e => ha e) (fun p => thermo_monotoneOn (V p) (K p) (hV p) (hK p)) hf

/-! ## Elimination certificates -/

/-- Certificate for the whole monotone single-index class (b): any strict rank reversal rules it out,
whatever the latent `a` and whatever the monotone promoter response `h p`. -/
theorem certificate_singleIndex {f : P → E → ℝ} {p q : P} {e e' : E}
    (hr : RankReversal f p q e e') : ¬ SingleIndexMono f :=
  fun hf => no_reversal_of_monotone hf ⟨p, q, e, e', hr⟩

theorem certificate_strict {f : P → E → ℝ} {p q : P} {e e' : E}
    (hr : RankReversal f p q e e') : ¬ SingleIndexStrict f :=
  fun hf => certificate_singleIndex hr (strict_le_mono hf)

theorem certificate_mult {f : P → E → ℝ} {p q : P} {e e' : E}
    (hr : RankReversal f p q e e') : ¬ Mult f :=
  fun hf => certificate_strict hr (mult_le_strict hf)

theorem certificate_logAdd {f : P → E → ℝ} {p q : P} {e e' : E}
    (hr : RankReversal f p q e e') : ¬ LogAdd f :=
  fun hf => certificate_strict hr (logAdd_le_strict hf)

theorem certificate_thermo {f : P → E → ℝ} {p q : P} {e e' : E}
    (hr : RankReversal f p q e e') : ¬ Thermo f :=
  fun hf => thermo_no_reversal hf ⟨p, q, e, e', hr⟩

/-- One reversal eliminates classes (a), (b), (c), (d) simultaneously. -/
theorem certificate_all {f : P → E → ℝ} {p q : P} {e e' : E}
    (hr : RankReversal f p q e e') :
    ¬ Mult f ∧ ¬ SingleIndexMono f ∧ ¬ SingleIndexStrict f ∧ ¬ LogAdd f ∧ ¬ Thermo f :=
  ⟨certificate_mult hr, certificate_singleIndex hr, certificate_strict hr,
   certificate_logAdd hr, certificate_thermo hr⟩

/-- Pair-restricted form: for two named promoters `p q`, no latent `a` and no monotone responses
`hp hq` reproduce the pair of orderings. -/
theorem certificate_pair {f : P → E → ℝ} {p q : P} {e e' : E}
    (hr : RankReversal f p q e e') (a : E → ℝ) (hp hq : ℝ → ℝ)
    (mp : Monotone hp) (mq : Monotone hq) :
    ¬ ((∀ x, f p x = hp (a x)) ∧ (∀ x, f q x = hq (a x))) := by
  rintro ⟨h1, h2⟩
  obtain ⟨r1, r2⟩ := hr
  rw [h1, h1] at r1
  rw [h2, h2] at r2
  have hlt : a e < a e' := by
    by_contra hc
    push_neg at hc
    have := mp hc
    linarith
  have := mq hlt.le
  linarith

/-- Noise-robust certificate: if observations `y` are within `ε` of the truth `f`, a reversal in `y`
with a margin of `2ε` on both promoters is a reversal in the truth. -/
theorem noisy_certificate {f y : P → E → ℝ} {ε : ℝ} (hn : ∀ p e, |y p e - f p e| ≤ ε)
    {p q : P} {e e' : E} (h1 : y p e + 2 * ε < y p e') (h2 : y q e' + 2 * ε < y q e) :
    RankReversal f p q e e' := by
  have a1 := abs_le.mp (hn p e)
  have a2 := abs_le.mp (hn p e')
  have a3 := abs_le.mp (hn q e)
  have a4 := abs_le.mp (hn q e')
  constructor <;> linarith [a1.1, a1.2, a2.1, a2.2, a3.1, a3.2, a4.1, a4.2]

/-! ## Exact characterisation: what "no reversal" means for a pair of promoters -/

/-- Two profiles `g`, `k` over enhancers are related by a monotone map on the range of `g`
iff `g` never orders a pair weakly one way while `k` orders it strictly the other. -/
theorem order_preserving_iff_monotone_map (g k : E → ℝ) :
    (∀ e e', g e ≤ g e' → k e ≤ k e') ↔
      ∃ h : ℝ → ℝ, MonotoneOn h (Set.range g) ∧ ∀ e, k e = h (g e) := by
  classical
  constructor
  · intro H
    let h : ℝ → ℝ := fun x => if hx : x ∈ Set.range g then k (Classical.choose hx) else 0
    have hh : ∀ e, h (g e) = k e := by
      intro e
      have hx : g e ∈ Set.range g := ⟨e, rfl⟩
      have hs : g (Classical.choose hx) = g e := Classical.choose_spec hx
      simp only [h, dif_pos hx]
      exact le_antisymm (H _ _ hs.le) (H _ _ hs.ge)
    refine ⟨h, ?_, fun e => (hh e).symm⟩
    rintro _ ⟨e1, rfl⟩ _ ⟨e2, rfl⟩ hxy
    rw [hh, hh]
    exact H e1 e2 hxy
  · rintro ⟨h, hm, hk⟩ e e' hle
    rw [hk, hk]
    exact hm ⟨e, rfl⟩ ⟨e', rfl⟩ hle

/-- For two promoters: `q` is a monotone transform of `p` on the measured enhancers iff there is
no weak reversal. A strict reversal is the special case that also breaks ties nowhere. -/
theorem pair_monotone_iff_no_weak_reversal (f : P → E → ℝ) (p q : P) :
    (¬ ∃ e e', WeakReversal f p q e e') ↔
      ∃ h : ℝ → ℝ, MonotoneOn h (Set.range (f p)) ∧ ∀ e, f q e = h (f p e) := by
  rw [← order_preserving_iff_monotone_map]
  constructor
  · intro H e e' hle
    by_contra hc
    exact H ⟨e, e', hle, not_le.mp hc⟩
  · rintro H ⟨e, e', h1, h2⟩
    exact absurd (H e e' h1) (not_le.mpr h2)

theorem strict_to_weak {f : P → E → ℝ} {p q : P} {e e' : E} (hr : RankReversal f p q e e') :
    WeakReversal f p q e e' := ⟨hr.1.le, hr.2⟩

/-! ## What the classes CAN do: concrete witnesses (all numbers checked by the kernel) -/

/-- Saturation with promoter-specific `K` changes the fold change between two enhancers
(0.5 -> 0.75 is x1.5 for K=1; 0.1 -> 0.25 is x2.5 for K=9) without changing the order. -/
theorem thermo_changes_fold_change_not_rank :
    (1 : ℝ) * (3 / (1 + 3)) / (1 * (1 / (1 + 1))) = 3 / 2 ∧
    (1 : ℝ) * (3 / (9 + 3)) / (1 * (1 / (9 + 1))) = 5 / 2 ∧
    (1 : ℝ) * (1 / (1 + 1)) < 1 * (3 / (1 + 3)) ∧
    (1 : ℝ) * (1 / (9 + 1)) < 1 * (3 / (9 + 3)) := by
  norm_num

/-- A multiplicative model with a NEGATIVE promoter factor reverses ranks, so `0 < b p` is needed. -/
theorem mult_needs_positive_b :
    let f : Bool → Bool → ℝ := fun p e => (if e then 2 else 1) * (if p then 1 else -1)
    RankReversal f true false false true := by
  intro f
  simp [RankReversal, f]

/-- A single index with a NON-monotone promoter response reverses ranks. So a reversal does not by
itself prove two independent enhancer features: a biphasic response h(x) = x (4 - x) also does it. -/
theorem nonmonotone_single_index_reverses :
    let a : Bool → ℝ := fun e => if e then 4 else 1
    let h : Bool → ℝ → ℝ := fun p x => if p then x else x * (4 - x)
    let f : Bool → Bool → ℝ := fun p e => h p (a e)
    RankReversal f true false false true := by
  intro a h f
  simp [RankReversal, f, h, a]

/-- A two-feature model with promoter-specific weights reverses ranks. -/
theorem twoFactor_reverses :
    ∃ f : Bool → Bool → ℝ, TwoFactor f ∧ RankReversal f true false false true := by
  refine ⟨fun p e => (if p then 1 else 0) * (if e then 1 else 0) +
      (1 - (if p then 1 else 0)) * (if e then 0 else 1), ⟨fun e => if e then 1 else 0,
      fun e => if e then 0 else 1, fun p => if p then 1 else 0, fun p e => rfl⟩, ?_⟩
  simp [RankReversal]

/-- The general interaction class is vacuous: every effect matrix is in it. So an interaction term
explains any reversal and, by itself, predicts nothing. -/
theorem general_is_vacuous (f : P → E → ℝ) : General f :=
  ⟨fun _ => 0, fun _ => 0, f, fun p e => by simp⟩

/-- Reversals exist inside the general class (instance of the above plus a witness). -/
theorem general_can_reverse :
    ∃ f : Bool → Bool → ℝ, General f ∧ HasReversal f := by
  obtain ⟨f, hf, hr⟩ := twoFactor_reverses
  exact ⟨f, general_is_vacuous f, _, _, _, _, hr⟩

/-- A computable example on integer data: the 2x2 matrix [[1,2],[2,1]] (rows promoters,
columns enhancers) has a reversal, decided by the kernel. -/
theorem int_matrix_reversal :
    let m : Fin 2 → Fin 2 → ℤ := ![![1, 2], ![2, 1]]
    ∃ p q e e' : Fin 2, m p e < m p e' ∧ m q e' < m q e := by
  intro m
  decide

#print axioms no_reversal_of_monotone
#print axioms thermo_no_reversal
#print axioms certificate_all
#print axioms certificate_pair
#print axioms noisy_certificate
#print axioms order_preserving_iff_monotone_map
#print axioms pair_monotone_iff_no_weak_reversal
#print axioms thermo_changes_fold_change_not_rank
#print axioms mult_needs_positive_b
#print axioms nonmonotone_single_index_reverses
#print axioms twoFactor_reverses
#print axioms general_is_vacuous
#print axioms general_can_reverse
#print axioms int_matrix_reversal

end EPSpec
