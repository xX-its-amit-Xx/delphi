/-
# Laws a genetic logic circuit has to obey, and two instances taken from printed measurements

These are the laws the DELPHI kernel applies when it compiles a behavioural description into DNA.
They are deliberately dull: each one is an inequality that a design either satisfies or does not, with
no fitted parameter and no simulation in the way. That is the point — a design is ruled out by
arithmetic on numbers a paper printed, not by a model's opinion.

## The one that matters: noise margin in a cascade

A transcriptional NOT gate takes an input promoter activity and produces an output promoter activity.
Stack two of them and the upstream gate's two output levels have to sit on opposite sides of the
downstream gate's threshold, or the second gate cannot tell the states apart and the circuit's logic
is not realised in the cell. Writing `off` and `on` for the upstream gate's two output levels and `k`
for the downstream gate's half-maximal input:

    low margin  = k - off      must be positive
    high margin = on - k       must be positive

`margins_pos` is that statement. `no_margin_of_le` is the other half, and it is the useful one: when
the upstream OFF level reaches the downstream threshold, the low margin is not positive and the
cascade is ruled out whatever else is true of it.

## Two instances, from numbers printed in one paper

Stanton, Nielsen, Tamsir, Clancy, Peterson and Voigt, *Genomic mining of prokaryotic repressors for
orthogonal logic gates*, Nature Chemical Biology 10:99-105 (2014), doi:10.1038/nchembio.1411, open
access at PMC4165527. All four numbers below are printed in that paper's own text, in relative
expression units (REU) against its stated reference standard, and were measured in the same work:

  - the PhlF NOT gate's two output levels, 16 and 0.1 REU  ("yielding outputs of 16 and 0.1 REU")
  - the ButR gate's threshold, 1.3 REU                     ("a range of 0.1 (TarA) to 1.3 REU (ButR)")
  - the TarA gate's threshold, 0.1 REU                     (same sentence)

`phlF_to_butR` says PhlF driving ButR has margin on both sides. `phlF_to_tarA_no_margin` says PhlF
driving TarA has none: the upstream OFF level, 0.1 REU, is exactly the downstream threshold. The
second is the more valuable statement, because it rules a wiring out before anyone clones it.

A note on what these instances do NOT say. The thresholds are the extremes of a range the paper
prints for its whole gate set; the paper gives each gate's own fitted threshold in a figure and a
supplementary table, which this file does not use. So `phlF_to_butR` is a statement about 1.3 REU as
a threshold, and it transfers to the real ButR gate only to the extent that 1.3 REU is that gate's
threshold. The kernel records that limit alongside the verdict rather than hiding it here.

## Checked

`bash tracks/lean/check.sh tracks/kernel/lean/CircuitLaws.lean` — every theorem below carries its own
`#print axioms` line, so the kernel has to say out loud what each proof rests on. Nothing here is
believed because a file says "0 sorry": a file can say that and be wrong, and a `sorry` only warns.
-/
import Mathlib

namespace Delphi.Circuit

/-- How much room the downstream threshold has above the upstream gate's OFF level. -/
def lowMargin (k off : ℝ) : ℝ := k - off

/-- How much room the upstream gate's ON level has above the downstream threshold. -/
def highMargin (on k : ℝ) : ℝ := on - k

/-- A cascade whose upstream levels straddle the downstream threshold has margin on both sides. -/
theorem margins_pos (off k on : ℝ) (hoff : off < k) (hon : k < on) :
    0 < lowMargin k off ∧ 0 < highMargin on k := by
  refine ⟨?_, ?_⟩
  · unfold lowMargin; linarith
  · unfold highMargin; linarith

/-- The elimination half: an OFF level at or above the threshold leaves no low margin. -/
theorem no_margin_of_le (off k : ℝ) (h : k ≤ off) : lowMargin k off ≤ 0 := by
  unfold lowMargin; linarith

/-- PhlF (OFF 0.1, ON 16 REU) driving a gate of threshold 1.3 REU: margin on both sides. -/
theorem phlF_to_butR : 0 < lowMargin 1.3 0.1 ∧ 0 < highMargin 16 1.3 := by
  refine ⟨?_, ?_⟩
  · norm_num [lowMargin]
  · norm_num [highMargin]

/-- PhlF driving a gate of threshold 0.1 REU: the OFF level is the threshold, so no low margin. -/
theorem phlF_to_tarA_no_margin : lowMargin 0.1 0.1 ≤ 0 := by
  unfold lowMargin; norm_num

/-- Total metabolic load of a circuit: the loads of its parts, added. -/
def totalLoad (xs : List ℝ) : ℝ := xs.sum

/-- A circuit of `n` parts each under `c` cannot load the host by more than `n * c`. This is the
bound the compiler uses when a part's own load was never measured: it is weaker than a sum of
measured loads, and it is honest about being weaker. -/
theorem load_bound (xs : List ℝ) (c : ℝ) (h : ∀ x ∈ xs, x ≤ c) :
    totalLoad xs ≤ xs.length * c := by
  unfold totalLoad
  induction xs with
  | nil => simp
  | cons a t ih =>
    have ha : a ≤ c := h a (by simp)
    have ht : ∀ x ∈ t, x ≤ c := fun x hx => h x (by simp [hx])
    have hsum : t.sum ≤ (t.length : ℝ) * c := ih ht
    have hexp : ((t.length : ℝ) + 1) * c = (t.length : ℝ) * c + c := by ring
    rw [List.sum_cons, List.length_cons]
    push_cast
    linarith [hsum, ha, hexp]

/-- A load that exceeds the budget rules the circuit out. -/
theorem load_rules_out (xs : List ℝ) (budget : ℝ) (h : budget < totalLoad xs) :
    ¬ totalLoad xs ≤ budget := by
  linarith

/-! ## Orthogonality

A circuit's gates are realised by repressor proteins. Two positions in the wiring diagram are two
different proteins in the cell, and a protein that represses another gate's promoter connects two
wires the diagram shows as separate. `groups` is the record's list of sets reported to cross-react.
A choice is orthogonal when no repressor is used twice and no reported group is represented more
than once. -/
def Orthogonal (groups : List (List String)) (chosen : List String) : Prop :=
  chosen.Nodup ∧ ∀ g ∈ groups, (g.filter (· ∈ chosen)).length ≤ 1

/-- A list of length at most one cannot hold two different things. The whole of the orthogonality
elimination rests on this, so it is proved rather than assumed. -/
theorem eq_of_mem_of_length_le_one {α : Type} {l : List α} (h : l.length ≤ 1) {a b : α}
    (ha : a ∈ l) (hb : b ∈ l) : a = b := by
  match l with
  | [] => simp at ha
  | [x] =>
    simp only [List.mem_singleton] at ha hb
    exact ha.trans hb.symm
  | (x :: y :: t) => simp [List.length_cons] at h

/-- Using one repressor for two gates is not orthogonal. The reused protein cannot hold two
positions at once, whatever the diagram says. -/
theorem not_orthogonal_of_reuse (groups : List (List String)) (chosen : List String)
    (h : ¬ chosen.Nodup) : ¬ Orthogonal groups chosen := fun ho => h ho.1

/-- Choosing two members of one reported cross-reacting group is not orthogonal. This is the rule
the compiler applies when it rejects a technology mapping. -/
theorem not_orthogonal_of_crossreact (groups : List (List String)) (chosen : List String)
    (g : List String) (hg : g ∈ groups) (a b : String) (hab : a ≠ b)
    (hag : a ∈ g) (hbg : b ∈ g) (hac : a ∈ chosen) (hbc : b ∈ chosen) :
    ¬ Orthogonal groups chosen := by
  intro ho
  have hlen := ho.2 g hg
  have ha : a ∈ g.filter (· ∈ chosen) := by simp [List.mem_filter, hag, hac]
  have hb : b ∈ g.filter (· ∈ chosen) := by simp [List.mem_filter, hbg, hbc]
  exact hab (eq_of_mem_of_length_le_one hlen ha hb)

/-! ## A model needs its parameters

The compiler will not emit a predictive model with a guessed number in it. Written formally: the
Hill response is a function of four quantities, and the evaluator takes a *proof* that all four were
measured. There is no way to call it without one, which is the property the kernel needs. -/

/-- The four quantities a gate's response needs, each present or absent. -/
structure GateParams where
  ymin : Option ℝ
  ymax : Option ℝ
  halfMax : Option ℝ
  coop : Option ℝ

/-- All four measured. -/
def Complete (p : GateParams) : Prop :=
  p.ymin.isSome ∧ p.ymax.isSome ∧ p.halfMax.isSome ∧ p.coop.isSome

/-- The response at cooperativity one: the shape the compiler emits as an SBML assignment rule. -/
noncomputable def hill (ymin ymax halfMax x : ℝ) : ℝ := ymin + (ymax - ymin) * (x / (halfMax + x))

/-- Evaluation demands the completeness proof. A gate missing a number has no response to evaluate,
and that is a type error here rather than a silent default. -/
noncomputable def evalGate (p : GateParams) (hp : Complete p) (x : ℝ) : ℝ :=
  hill (p.ymin.get hp.1) (p.ymax.get hp.2.1) (p.halfMax.get hp.2.2.1) x

/-- One absent number is enough to make a gate unmodelable. -/
theorem not_complete_of_halfMax_none (p : GateParams) (h : p.halfMax = none) : ¬ Complete p := by
  intro hc
  simp [Complete, h] at hc

/-- A circuit is modelable only if every one of its gates is. -/
def Modelable (gs : List GateParams) : Prop := ∀ p ∈ gs, Complete p

/-- One incomplete gate rules out the whole circuit's model. This is why a single missing
cooperativity refuses the SBML for an entire design. -/
theorem not_modelable_of_one_missing (gs : List GateParams) (p : GateParams)
    (hp : p ∈ gs) (h : ¬ Complete p) : ¬ Modelable gs := fun hm => h (hm p hp)

/-- The response is strictly increasing in its input, so "the threshold" names one input level and
the margin law above is about a well-defined quantity. Without this the cascade law would be
comparing against a number that need not separate the states. -/
theorem hill_strict_mono (ymin ymax halfMax : ℝ) (hy : ymin < ymax) (hK : 0 < halfMax)
    {x₁ x₂ : ℝ} (hx₁ : 0 ≤ x₁) (hlt : x₁ < x₂) :
    hill ymin ymax halfMax x₁ < hill ymin ymax halfMax x₂ := by
  have h1 : 0 < halfMax + x₁ := by linarith
  have h2 : 0 < halfMax + x₂ := by linarith
  have h1' : halfMax + x₁ ≠ 0 := ne_of_gt h1
  have h2' : halfMax + x₂ ≠ 0 := ne_of_gt h2
  have e1 : x₁ / (halfMax + x₁) = 1 - halfMax / (halfMax + x₁) := by
    rw [eq_sub_iff_add_eq, ← add_div, div_eq_one_iff_eq h1']; ring
  have e2 : x₂ / (halfMax + x₂) = 1 - halfMax / (halfMax + x₂) := by
    rw [eq_sub_iff_add_eq, ← add_div, div_eq_one_iff_eq h2']; ring
  have hfrac : halfMax / (halfMax + x₂) < halfMax / (halfMax + x₁) :=
    div_lt_div_of_pos_left hK h1 (by linarith)
  have key : x₁ / (halfMax + x₁) < x₂ / (halfMax + x₂) := by rw [e1, e2]; linarith
  unfold hill
  nlinarith [sub_pos.mpr hy, sub_pos.mpr key]

end Delphi.Circuit

#print axioms Delphi.Circuit.margins_pos
#print axioms Delphi.Circuit.no_margin_of_le
#print axioms Delphi.Circuit.phlF_to_butR
#print axioms Delphi.Circuit.phlF_to_tarA_no_margin
#print axioms Delphi.Circuit.load_bound
#print axioms Delphi.Circuit.load_rules_out
#print axioms Delphi.Circuit.eq_of_mem_of_length_le_one
#print axioms Delphi.Circuit.not_orthogonal_of_reuse
#print axioms Delphi.Circuit.not_orthogonal_of_crossreact
#print axioms Delphi.Circuit.not_complete_of_halfMax_none
#print axioms Delphi.Circuit.not_modelable_of_one_missing
#print axioms Delphi.Circuit.hill_strict_mono
