/-! Core-Lean-only (no Mathlib) statements for the Q1 enhancer-promoter question.
  Model class S ("one latent strength + promoter-specific saturating response"):
    out p e = g p (s e), where s : enhancer -> strength and each g p is monotone (non-decreasing).
  Theorem 1: in class S, if enhancer e is strictly stronger than e' on promoter p, then e' is NEVER
             strictly stronger than e on any promoter q: saturation can create ties, never reversals.
  Theorem 2: class S with strictly increasing g also preserves strict order (no ties either).
  Theorem 3: a model with two latent strengths (x on promoter p, y on promoter q) reverses the order,
             so a reversal is a witness that S is false. -/
namespace Q1

theorem no_reversal {E P : Type} (s : E → Nat) (g : P → Nat → Nat)
    (hg : ∀ p a b, a ≤ b → g p a ≤ g p b) (p q : P) (e e' : E)
    (h : g p (s e') < g p (s e)) : ¬ (g q (s e) < g q (s e')) := by
  intro h2
  have hlt : s e' < s e := by
    apply Nat.lt_of_not_le
    intro hc
    have := hg p _ _ hc
    omega
  have := hg q _ _ (Nat.le_of_lt hlt)
  omega

theorem strict_preserved {E P : Type} (s : E → Nat) (g : P → Nat → Nat)
    (hg : ∀ p a b, a < b → g p a < g p b) (p q : P) (e e' : E)
    (h : g p (s e') < g p (s e)) : g q (s e') < g q (s e) := by
  have hlt : s e' < s e := by
    apply Nat.lt_of_not_le
    intro hc'
    rcases Nat.lt_or_eq_of_le hc' with h1 | h1
    · have := hg p _ _ h1; omega
    · rw [h1] at h; omega
  exact hg q _ _ hlt

/-- two enhancers with latent pairs (x,y); promoter p reads x, promoter q reads y. -/
def outP (v : Nat × Nat) : Nat := v.1
def outQ (v : Nat × Nat) : Nat := v.2

theorem two_latent_reverses :
    ∃ e e' : Nat × Nat, outP e' < outP e ∧ outQ e < outQ e' :=
  ⟨(2, 1), (1, 2), by decide, by decide⟩

#print axioms no_reversal
#print axioms strict_preserved
#print axioms two_latent_reverses

end Q1
