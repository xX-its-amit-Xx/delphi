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

end Delphi.Circuit

#print axioms Delphi.Circuit.margins_pos
#print axioms Delphi.Circuit.no_margin_of_le
#print axioms Delphi.Circuit.phlF_to_butR
#print axioms Delphi.Circuit.phlF_to_tarA_no_margin
#print axioms Delphi.Circuit.load_bound
#print axioms Delphi.Circuit.load_rules_out
