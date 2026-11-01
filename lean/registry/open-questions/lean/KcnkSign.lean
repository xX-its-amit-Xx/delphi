/-
# Open question oq-kcnk5b-vm-sign: BOTH ARMS, formalised, NEITHER accepted

This module is **not a law module**. It is the Lean half of one open question in
`lean/registry/open-questions/`: the sign of the membrane-potential change caused by the zebrafish
`alf` gain-of-function alleles of `kcnk5b`. Two primary papers report opposite signs, in different
preparations, and the repo's own causal chain (`genotype/causal-chains.json`, `genotype/CAUSAL.md`
row `kcnk5b`) records the disagreement rather than picking a side.

Amit's ask, in his words: "theorems that have highly conflicting evidence, or the ability to be
formalized in Lean with both for and against arguments or in different proportions, should remain
in the repo as open questions that require more evidence to settle." So BOTH arms are written here
as named hypotheses, each proved internally consistent, and **neither is in any law set**. The
registry guard (`openQuestionGuard` in `lean/registry/open-questions/openq-lib.mjs`, called from
`propose.mjs` and `check-exposed.mjs`) refuses to accept a law that asserts either arm while
`oq-kcnk5b-vm-sign` is open.

House style is the same as `lean/Delphi/Perturb.lean`: every empirical ingredient is a NAMED
HYPOTHESIS (a structure whose fields carry the observation), there is no `axiom`, `#print axioms`
on every theorem below names only `propext`, `Classical.choice` and `Quot.sound`, and every arm has
a non-vacuity witness built from the numbers the sources actually support. A reader who rejects an
arm rejects its structure and loses only that arm's theorems.

## The three arms, and why there are three rather than two

* **Arm `hyperpolarising`** (Perathoner et al. 2014, PLoS Genet, PMID 24453984, Figure 5B/5D;
  *Xenopus* oocytes). The `alf` mutant channels carry about twice the wild-type K+ conductance, and
  across that conductance range the membrane potential is MORE NEGATIVE: "the higher the conductance
  for K+ measured at 50 mV, the more negative the membrane potential of the oocyte."
* **Arm `depolarising`** (Jiang et al. 2024, PLoS Biol, PMID 38527087; zebrafish pectoral-fin-bud
  cells). "We also found that Kcnk5b enhanced depolarization in fin bud cells via Na+ channels and
  that this enhanced depolarization was required for Kcnk5b-enhanced growth."
* **Arm `biphasic`** (Jiang et al. 2024's own reconciliation, same paper). "We propose that the
  increased K+-channel activity first hyperpolarizes the membrane potential, and this increase in
  membrane potential immediately activates Na+ channels to depolarize the cells."

The third arm is the reason this question must NOT be forced into a two-sided contradiction. The two
measurements were made in different preparations (a heterologous oocyte with no fin-bud Na+ channel
complement, versus a fin-bud cell) and, under arm `biphasic`, at different times in the same cell.
Accordingly:

* `arms_exclusive_same_preparation` PROVES the two arms contradict **once you add the premise that
  the two readings are of the same cell at the same steady state** (`SamePreparation`). That premise
  is the empirical claim nobody has established, and it is carried explicitly as a hypothesis rather
  than smuggled in.
* `biphasic_supplies_both_readings` PROVES arm `biphasic` reproduces an arm-`hyperpolarising`
  reading early and an arm-`depolarising` reading late, so neither arm's evidence refutes it. Arm
  `biphasic` is therefore consistent with BOTH published observations.
* `arms_not_exclusive_without_same_preparation` shows, as a proved existence statement, that an
  arm-`hyperpolarising` instance and an arm-`depolarising` instance are inhabited at once when the
  readings are allowed to come from different preparations. **The two papers are not formally
  contradictory. They are empirically unresolved in the tissue that matters** (a zebrafish fin-bud
  cell), where no steady-state membrane-potential measurement of an `alf` mutant exists in any
  source this repo has fetched.

## What would settle it, in Lean terms

A single measurement that inhabits `SamePreparation` -- resting potential of wild-type and `alf`
fin-bud cells, same stage, same recording method, steady state -- collapses the three arms to one:
`arms_exclusive_same_preparation` then eliminates whichever of the first two arms has the wrong sign,
and the sign of `vmMut - vmWt` in that measurement decides between the survivor and `biphasic`.
Until then the accepted law set must contain none of the three. That is recorded, machine-readably,
in `lean/registry/open-questions/questions/oq-kcnk5b-vm-sign.json` under `what_would_settle_it`.
-/
import Mathlib

namespace Delphi
namespace OpenQuestion
namespace KcnkSign

/-! ### Arm `hyperpolarising` (Perathoner et al. 2014, oocytes) -/

/-- A reading in which raising the `kcnk5b` K+ leak conductance makes the membrane potential MORE
NEGATIVE. `gkWt`/`gkMut` are K+ conductances (arbitrary units, as plotted at a constant +50 mV),
`vmWt`/`vmMut` the corresponding membrane potentials in mV. Perathoner et al. 2014 Figure 5B gives
the conductance gain and Figure 5D the sign of the potential change. -/
structure HyperpolarisingLeak where
  gkWt : ℝ
  gkMut : ℝ
  vmWt : ℝ
  vmMut : ℝ
  /-- the `alf` alleles are gain of function: "an almost two-fold increase in K+ conductance". -/
  gainOfFunction : gkWt < gkMut
  /-- "the higher the conductance for K+ ..., the more negative the membrane potential". -/
  moreConductanceMoreNegative : vmMut < vmWt

/-- Arm `hyperpolarising`, as a signed statement: the potential change is negative. -/
theorem hyperpolarising_sign (H : HyperpolarisingLeak) : H.vmMut - H.vmWt < 0 := by
  have h := H.moreConductanceMoreNegative
  linarith

/-! ### Arm `depolarising` (Jiang et al. 2024, fin-bud cells) -/

/-- A reading in which raising the `kcnk5b` K+ leak conductance makes the membrane potential MORE
POSITIVE, because the resulting potential change recruits Na+ channels whose inward current
dominates the steady state. Jiang et al. 2024: "Kcnk5b enhanced depolarization in fin bud cells via
Na+ channels". -/
structure DepolarisingLeak where
  gkWt : ℝ
  gkMut : ℝ
  vmWt : ℝ
  vmMut : ℝ
  /-- the same gain-of-function premise as arm `hyperpolarising`: the arms differ only in the sign. -/
  gainOfFunction : gkWt < gkMut
  /-- the Na+-channel-dependent net depolarisation. -/
  netDepolarised : vmWt < vmMut

/-- Arm `depolarising`, as a signed statement: the potential change is positive. -/
theorem depolarising_sign (D : DepolarisingLeak) : 0 < D.vmMut - D.vmWt := by
  have h := D.netDepolarised
  linarith

/-! ### Arm `biphasic` (Jiang et al. 2024's own reconciliation) -/

/-- One cell, three times: resting, early (hyperpolarised by the raised K+ leak) and late
(depolarised after Na+ channels activate). Jiang et al. 2024: "the increased K+-channel activity
first hyperpolarizes the membrane potential, and this increase in membrane potential immediately
activates Na+ channels to depolarize the cells." -/
structure BiphasicResponse where
  vmRest : ℝ
  vmEarly : ℝ
  vmLate : ℝ
  /-- the transient: more negative than rest. -/
  earlyHyperpolarised : vmEarly < vmRest
  /-- the steady state after Na+ recruitment: more positive than rest. -/
  lateDepolarised : vmRest < vmLate

/-- Arm `biphasic`, as a signed statement: the two phases have OPPOSITE signs relative to rest, so
the sign of "the" membrane-potential change is not a property of the genotype alone. -/
theorem biphasic_signs (B : BiphasicResponse) :
    B.vmEarly - B.vmRest < 0 ∧ 0 < B.vmLate - B.vmRest := by
  refine ⟨?_, ?_⟩
  · have h := B.earlyHyperpolarised
    linarith
  · have h := B.lateDepolarised
    linarith

/-! ### The bridging premise nobody has established -/

/-- The empirical claim needed to turn the disagreement into a contradiction: the two readings are of
the SAME preparation at the SAME steady state, so they are two reports of one pair of numbers.
Nothing in the fetched sources inhabits this: Perathoner et al. recorded *Xenopus* oocytes and Jiang
et al. recorded zebrafish fin-bud cells, and no source gives a steady-state resting potential of a
wild-type and an `alf` fin-bud cell measured the same way. -/
structure SamePreparation (H : HyperpolarisingLeak) (D : DepolarisingLeak) where
  sameWildType : H.vmWt = D.vmWt
  sameMutant : H.vmMut = D.vmMut

/-- **Mutual exclusivity, PROVED, under the stated premise.** If the two arms are reports of one
preparation at one steady state, they contradict: the same number cannot be both less than and
greater than another. This is why the accepted law set may contain at most one of them, and -- since
nothing inhabits `SamePreparation` -- why it currently contains neither. -/
theorem arms_exclusive_same_preparation
    (H : HyperpolarisingLeak) (D : DepolarisingLeak) (S : SamePreparation H D) : False := by
  have h1 := H.moreConductanceMoreNegative
  have h2 := D.netDepolarised
  rw [S.sameWildType, S.sameMutant] at h1
  linarith

/-- **Non-exclusivity without that premise, PROVED.** Both arms are inhabited at once by readings
from different preparations, so the two papers are NOT formally contradictory. The numbers carry the
sign and the conductance doubling the sources state, and nothing more: Perathoner et al. 2014
Fig. 5D is a correlation rather than a pair of reported potentials, and Jiang et al. 2024 report the
direction of the fin-bud change rather than a value. -/
theorem arms_not_exclusive_without_same_preparation :
    ∃ (H : HyperpolarisingLeak) (D : DepolarisingLeak), H.gkMut = D.gkMut := by
  refine ⟨{ gkWt := 1, gkMut := 2, vmWt := -40, vmMut := -60,
            gainOfFunction := by norm_num, moreConductanceMoreNegative := by norm_num },
          { gkWt := 1, gkMut := 2, vmWt := -40, vmMut := -25,
            gainOfFunction := by norm_num, netDepolarised := by norm_num }, rfl⟩

/-- **Arm `biphasic` is refuted by neither arm's evidence, PROVED.** A biphasic cell supplies an
arm-`hyperpolarising` reading when sampled early and an arm-`depolarising` reading when sampled late,
from the one cell. So the published observations do not between them exclude the third arm, and a
law asserting either of the first two would assert more than the evidence settles. -/
theorem biphasic_supplies_both_readings (B : BiphasicResponse)
    (gkWt gkMut : ℝ) (hg : gkWt < gkMut) :
    (∃ H : HyperpolarisingLeak, H.vmWt = B.vmRest ∧ H.vmMut = B.vmEarly) ∧
    (∃ D : DepolarisingLeak, D.vmWt = B.vmRest ∧ D.vmMut = B.vmLate) := by
  refine ⟨⟨{ gkWt := gkWt, gkMut := gkMut, vmWt := B.vmRest, vmMut := B.vmEarly,
             gainOfFunction := hg, moreConductanceMoreNegative := B.earlyHyperpolarised },
           rfl, rfl⟩,
          ⟨{ gkWt := gkWt, gkMut := gkMut, vmWt := B.vmRest, vmMut := B.vmLate,
             gainOfFunction := hg, netDepolarised := B.lateDepolarised },
           rfl, rfl⟩⟩

/-! ### Non-vacuity witnesses: each arm is internally consistent -/

/-- Arm `hyperpolarising` is inhabited: an oocyte with doubled K+ conductance and a more negative
potential. -/
theorem hyperpolarising_nonvacuous : Nonempty HyperpolarisingLeak :=
  ⟨{ gkWt := 1, gkMut := 2, vmWt := -40, vmMut := -60,
     gainOfFunction := by norm_num, moreConductanceMoreNegative := by norm_num }⟩

/-- Arm `depolarising` is inhabited: a fin-bud cell with doubled K+ conductance and a more positive
potential. -/
theorem depolarising_nonvacuous : Nonempty DepolarisingLeak :=
  ⟨{ gkWt := 1, gkMut := 2, vmWt := -40, vmMut := -25,
     gainOfFunction := by norm_num, netDepolarised := by norm_num }⟩

/-- Arm `biphasic` is inhabited: one cell, hyperpolarised early and depolarised late. -/
theorem biphasic_nonvacuous : Nonempty BiphasicResponse :=
  ⟨{ vmRest := -40, vmEarly := -60, vmLate := -25,
     earlyHyperpolarised := by norm_num, lateDepolarised := by norm_num }⟩

/-- The three arms are jointly inhabited as STRUCTURES -- that is exactly the problem. Being able to
build all three is why no proof settles the question and why more evidence is required: the
formalisation is sound for each arm and silent on which arm is true of a zebrafish fin-bud cell. -/
theorem all_three_arms_inhabited :
    Nonempty HyperpolarisingLeak ∧ Nonempty DepolarisingLeak ∧ Nonempty BiphasicResponse :=
  ⟨hyperpolarising_nonvacuous, depolarising_nonvacuous, biphasic_nonvacuous⟩

end KcnkSign
end OpenQuestion
end Delphi

#print axioms Delphi.OpenQuestion.KcnkSign.hyperpolarising_sign
#print axioms Delphi.OpenQuestion.KcnkSign.depolarising_sign
#print axioms Delphi.OpenQuestion.KcnkSign.biphasic_signs
#print axioms Delphi.OpenQuestion.KcnkSign.arms_exclusive_same_preparation
#print axioms Delphi.OpenQuestion.KcnkSign.arms_not_exclusive_without_same_preparation
#print axioms Delphi.OpenQuestion.KcnkSign.biphasic_supplies_both_readings
#print axioms Delphi.OpenQuestion.KcnkSign.hyperpolarising_nonvacuous
#print axioms Delphi.OpenQuestion.KcnkSign.depolarising_nonvacuous
#print axioms Delphi.OpenQuestion.KcnkSign.biphasic_nonvacuous
#print axioms Delphi.OpenQuestion.KcnkSign.all_three_arms_inhabited
