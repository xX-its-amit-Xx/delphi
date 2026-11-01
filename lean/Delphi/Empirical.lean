/-
# Empirical hypotheses: observations the checker may use, and NOT axioms

Direction from the hub (Amit, 2026-10-31): add the observations the project has measured as constraints.
This module adds them WITHOUT a single `axiom` declaration, and that is deliberate.

## Why no `axiom`

`#print axioms` on every theorem of this development names only `propext`, `Classical.choice` and
`Quot.sound` (lean/Delphi/Audit.lean prints the list, lean/report.mjs checks it). An `axiom` carrying an
observation would appear in that list for every downstream theorem, and worse, it would be a licence to
derive anything at all if the observation were wrong: a measurement is not a mathematical truth, and
measurements are revised. So every observation here is a FIELD of a structure, with the inequality it
encodes as a proof obligation on that field. A theorem that needs an observation takes the structure as an
argument, exactly as the earlier modules take `AreaLaw`, `CubeLaw` and `MusclePowerLaw`. The force is the
same in practice (nothing is derived without the observation), the kind is honest (the observation is a
hypothesis, visible in the statement), and the axiom list stays clean.

A reader who rejects an observation rejects the structure and loses its theorems; nothing else breaks.

## What each entry is, and where the numbers come from

* **E1 `WithinSpeciesAllometry`** - isometry fails within a species: fin area grows as `SL^1.834` and wing
  loading as `SL^1.236` (Davenport 1992 on *Exocoetus obtusirostris*, physics/allometry.json; mass 2.981).
  The three fits are separate regressions and are NOT mutually consistent (1.236 against 2.981 - 1.834 =
  1.147), which is why C13 needs intervals and why nine audit rows read "violated".
* **E2 `MassExponentBand`** - the fitted mass exponent lies in [2.90, 3.02] over the six fitted field rows
  of five species in physics/length-weight.csv (3.011, 2.971, 2.908, 2.985, 3.010, 2.910), EXCLUDING the
  *Hirundichthys affinis* male row at 2.208, which is named and left out. Consequence proved here: a scaled
  design's weight ratio must lie between `r^2.90` and `r^3.02`.
* **E3 `TeleostAerobic`** - efficiency, cardiac output and arterial O2 content lie inside the measured
  teleost ranges the physiology chain cites: `eta <= 0.15` (gamperl2021 via physiology/muscle.js),
  `Q <= 0.075 ml/s` for a 0.06 kg fish (75 ml/min/kg, the maximum of gerry2014's range via cardiac.js),
  `Ca <= 0.21 ml/ml` (the warm capacity 0.2063 ml/ml of haemoglobin.js at full saturation, rounded up) and
  `E <= 19.35 J/ml` (13.54 J/mg over 0.7 ml/mg, muscle.js). Consequence proved here: the aerobic ceiling of
  ANY animal inside those ranges is at most 0.0458 W, so C14's eliminations are not arbitrary - they hold
  for every teleost the measured record allows, not just for one choice of proxies.
  **Superseded (law set 1.6.0) by E3 v2 `TeleostAerobicV2`**: measured zebrafish (Palstra 2010, 2630 mg O2
  kg^-1 h^-1) exceed v1's delivery envelope about 2x per kg, so "every teleost" was wrong. v2 bounds O2
  delivery Q*Ca <= 0.0187 ml/s at 0.06 kg (1600 mg O2 kg^-1 h^-1) and eta <= 0.23, giving <= 0.0833 W,
  scoped to its sources. v1 stays compiled so older law sets reproduce.
* **E4 `NoAerialUptake`** - gills do not ventilate in air: uptake is zero while airborne (physiology/index.js
  and its self-test, where the store drains). Consequence proved here: over a flight of duration `t` the mean
  aerobic power is at most `E S / t` for an O2 store `S`, so airborne aerobic power is time-limited.
* **E5 `measuredFinRatio`** - pectoral/SL of 49 flying-fish specimens lies in [0.406, 0.823], median 0.687
  (Daane 2021 Data S1, genotype/cache/daane2021_fin_ratios.json). This is a PROVENANCE statement, not an
  impossibility: a design outside the range is outside everything measured, which is weaker than "cannot be".
* **E6 `requiredForNotPropagatedB`** - a PROJECT CONVENTION, not an observation: a "required for" link is
  never propagated down `part_of`. Recorded here so the map's derived links can be checked against it.
* **E7 `CanScore`** - an intervention whose source reports death at or before the stage at which a phenotype
  is scored cannot produce that phenotype (genotype/interventions.json). Instantiated only where the
  genotype thread states both times in hours: *ezh2* dies at 48 hpf, the same stage its fin absence is
  scored, and *wls* dies by 12 dpf while the ray parameters exist only from 45 dpf.
* **E8** is deliberately NOT here. "A part cannot appear before its precursor" is already proved as a
  theorem about the data (`Delphi.Genotype.devOrdered_of_check`, certified on the fin subtree), so restating
  it as an empirical hypothesis would weaken a theorem into an assumption.

## Non-vacuity

An inconsistent set of observations would let the checker "eliminate" everything, and that failure would
look exactly like success. `measured` instantiates every structure above with the real numbers and its
proofs are the arithmetic; `empirical_nonvacuous : Nonempty Record` is the witness. If two entries
contradicted each other, `measured` would not type-check. lean/mutate.mjs includes a mutant that moves one
band so the measured value falls outside it: the witness must then fail.
-/
import Mathlib
import Delphi.Flight

open Real

namespace Delphi
namespace Empirical

/-! ### E1: isometry fails within a species (Davenport 1992) -/

/-- Fitted within-species exponents on standard length: fin area below the isometric 2, wing loading above
the isometric 1. The fields are the observation; the inequalities are what it says. -/
structure WithinSpeciesAllometry where
  areaExponent : ℝ
  wingLoadingExponent : ℝ
  massExponent : ℝ
  /-- Fin area grows more slowly than the square of length. -/
  area_lt_isometric : areaExponent < 2
  /-- Wing loading grows faster than length. -/
  loading_gt_isometric : 1 < wingLoadingExponent
  /-- Mass grows roughly as the cube. -/
  mass_near_cube : (2.9 : ℝ) ≤ massExponent ∧ massExponent ≤ 3.02

/-- **The area law fails** under this observation: the exponent is not 2, so `AreaLaw` cannot hold with it. -/
theorem not_isometric_area (A : WithinSpeciesAllometry) : A.areaExponent ≠ 2 := by
  have := A.area_lt_isometric; intro h; rw [h] at this; exact absurd this (lt_irrefl 2)

/-- **Wing loading rises with size** under this observation: a bigger member of the family is more loaded,
which is the content of the measured 1.236 rather than the isometric 1. -/
theorem loading_rises (A : WithinSpeciesAllometry) {S : ℝ → ℝ} {a L₁ L₂ : ℝ}
    (hS : PowerLaw S a A.wingLoadingExponent) (h₁ : 0 < L₁) (h₂ : 0 < L₂) (hr : 1 < L₂ / L₁) :
    L₂ / L₁ < S L₂ / S L₁ := by
  rw [powerLaw_ratio hS h₁ h₂]
  calc L₂ / L₁ = (L₂ / L₁) ^ (1 : ℝ) := by rw [Real.rpow_one]
    _ < (L₂ / L₁) ^ A.wingLoadingExponent :=
        Real.rpow_lt_rpow_of_exponent_lt hr A.loading_gt_isometric

/-! ### E2: the fitted mass exponent band -/

/-- The mass exponent of a fitted field study of a flying fish, inside the band the project's own fits span
(the *H. affinis* male outlier at 2.208 is excluded and named in the module header). -/
structure MassExponentBand where
  b : ℝ
  lo : (2.9 : ℝ) ≤ b
  hi : b ≤ (3.02 : ℝ)

/-- **A scaled design's weight ratio must lie in the measured band.** For a weight that follows one power
law over the range, the ratio between two lengths is between `r^2.90` and `r^3.02`. -/
theorem weight_ratio_band (M : MassExponentBand) {W : ℝ → ℝ} {a L₁ L₂ : ℝ}
    (hW : PowerLaw W a M.b) (h₁ : 0 < L₁) (h₂ : 0 < L₂) (hr : 1 ≤ L₂ / L₁) :
    (L₂ / L₁) ^ (2.9 : ℝ) ≤ W L₂ / W L₁ ∧ W L₂ / W L₁ ≤ (L₂ / L₁) ^ (3.02 : ℝ) := by
  rw [powerLaw_ratio hW h₁ h₂]
  exact ⟨Real.rpow_le_rpow_of_exponent_le hr M.lo, Real.rpow_le_rpow_of_exponent_le hr M.hi⟩

/-- A design committing a weight ratio outside the band, under one power law, is ruled out. -/
theorem weight_ratio_rules_out (M : MassExponentBand) {W : ℝ → ℝ} {a L₁ L₂ r : ℝ}
    (hW : PowerLaw W a M.b) (h₁ : 0 < L₁) (h₂ : 0 < L₂) (hr : 1 ≤ L₂ / L₁)
    (hclaim : W L₂ / W L₁ = r) (hout : r < (L₂ / L₁) ^ (2.9 : ℝ) ∨ (L₂ / L₁) ^ (3.02 : ℝ) < r) : False := by
  obtain ⟨hlo, hhi⟩ := weight_ratio_band M hW h₁ h₂ hr
  rw [hclaim] at hlo hhi
  rcases hout with h | h <;> linarith

/-! ### E3: the measured teleost aerobic ranges -/

/-- Efficiency, oxycaloric equivalent, cardiac output (ml blood/s) and arterial O2 content (ml O2/ml blood)
inside the ranges the physiology chain cites, for a fish of the measured mass. -/
structure TeleostAerobic where
  eta : ℝ
  oxycaloric : ℝ
  cardiacOutput : ℝ
  arterialO2 : ℝ
  eta_nonneg : 0 ≤ eta
  eta_le : eta ≤ 0.15
  oxy_nonneg : 0 ≤ oxycaloric
  oxy_le : oxycaloric ≤ 19.35
  q_nonneg : 0 ≤ cardiacOutput
  q_le : cardiacOutput ≤ 0.075
  ca_nonneg : 0 ≤ arterialO2
  ca_le : arterialO2 ≤ 0.21

/-- **The aerobic ceiling of anything inside the measured ranges is at most 0.0458 W.** This is what makes
the C14 eliminations binding rather than a choice of proxies: no teleost the measured record allows, at this
mass, has a larger sustained aerobic ceiling. -/
theorem aerobicCeiling_le (T : TeleostAerobic) :
    T.eta * T.oxycaloric * T.cardiacOutput * T.arterialO2 ≤ 0.0458 := by
  have hA : T.eta * T.oxycaloric ≤ 0.15 * 19.35 :=
    mul_le_mul T.eta_le T.oxy_le T.oxy_nonneg (by norm_num)
  have hB : T.cardiacOutput * T.arterialO2 ≤ 0.075 * 0.21 :=
    mul_le_mul T.q_le T.ca_le T.ca_nonneg (by norm_num)
  have hBnn : 0 ≤ T.cardiacOutput * T.arterialO2 := mul_nonneg T.q_nonneg T.ca_nonneg
  have := mul_le_mul hA hB hBnn (by norm_num : (0:ℝ) ≤ 0.15 * 19.35)
  calc T.eta * T.oxycaloric * T.cardiacOutput * T.arterialO2
      = T.eta * T.oxycaloric * (T.cardiacOutput * T.arterialO2) := by ring
    _ ≤ 0.15 * 19.35 * (0.075 * 0.21) := this
    _ ≤ 0.0458 := by norm_num

/-- **No teleost inside the measured ranges can fly aerobically above that ceiling.** Composed with the Fick
bound of lean/Delphi/Flight.lean: a sustained flight needing more than 0.0458 W is ruled out for every
animal the measured record allows, not only for one set of proxies. -/
theorem no_aerobic_flight_above_ceiling (T : TeleostAerobic) {W v LD P Cv : ℝ} (hCv : 0 ≤ Cv)
    (hsus : P ≤ aerobicPower T.eta T.oxycaloric T.cardiacOutput T.arterialO2 Cv)
    (hflight : powerRequired W v LD ≤ P) (hbig : 0.0458 < powerRequired W v LD) : False := by
  have h := sustained_flight_requires T.eta_nonneg T.oxy_nonneg T.q_nonneg hCv hsus hflight
  have := aerobicCeiling_le T
  linarith

/-! ### E3 version 2.0.0 (law set 1.6.0): widened after a measured zebrafish broke version 1

Version 1 (`TeleostAerobic`, above, kept compiled so law sets 1.0.0 to 1.5.0 stay reproducible) bounded cardiac
output by a trout range (75 ml/min/kg) and arterial O2 by a calibrated capacity. Their product allows at most
1350 mg O2 kg⁻¹ h⁻¹, and wild-type adult zebrafish were measured at 2630 mg O2 kg⁻¹ h⁻¹ at Ucrit (Palstra et al.
2010, PLoS One 5:e14483, PMC3013094), so "no teleost above 0.0458 W" does not hold per kilogram
(physics/FICK-CEILING-CHECK.md). Version 2 bounds the O2 delivery `Q·Ca` directly, in ml O2/s for a 0.06 kg fish:
at most 0.0187 ml/s, i.e. 1600 mg O2 kg⁻¹ h⁻¹ (Palstra's zebrafish value scaled to 60 g with a mass-specific
exponent of -0.10 to -0.13), and efficiency by the skeletal-muscle upper value 0.23 (Gladman and Askew 2024,
PMC11583979: contractile 0.37 × oxidative recovery 0.61). It is scoped to those sources, not to every teleost. -/
structure TeleostAerobicV2 where
  eta : ℝ
  oxycaloric : ℝ
  o2Delivery : ℝ
  eta_nonneg : 0 ≤ eta
  eta_le : eta ≤ 0.23
  oxy_nonneg : 0 ≤ oxycaloric
  oxy_le : oxycaloric ≤ 19.35
  del_nonneg : 0 ≤ o2Delivery
  del_le : o2Delivery ≤ 0.0187

/-- **v2 is a weakening of v1**: every animal inside the v1 ranges is inside the v2 ranges (0.15 ≤ 0.23 and
0.075 × 0.21 = 0.01575 ≤ 0.0187). So nothing v1 admitted is excluded by v2; v2 only admits more. -/
def TeleostAerobic.toV2 (T : TeleostAerobic) : TeleostAerobicV2 where
  eta := T.eta
  oxycaloric := T.oxycaloric
  o2Delivery := T.cardiacOutput * T.arterialO2
  eta_nonneg := T.eta_nonneg
  eta_le := le_trans T.eta_le (by norm_num)
  oxy_nonneg := T.oxy_nonneg
  oxy_le := T.oxy_le
  del_nonneg := mul_nonneg T.q_nonneg T.ca_nonneg
  del_le := le_trans (mul_le_mul T.q_le T.ca_le T.ca_nonneg (by norm_num)) (by norm_num)

/-- **E3 v2: the aerobic ceiling inside the widened ranges is at most 0.0833 W** (0.23 × 19.35 × 0.0187 =
0.08322). -/
theorem aerobicCeilingV2_le (T : TeleostAerobicV2) :
    T.eta * T.oxycaloric * T.o2Delivery ≤ 0.0833 := by
  have hA : T.eta * T.oxycaloric ≤ 0.23 * 19.35 :=
    mul_le_mul T.eta_le T.oxy_le T.oxy_nonneg (by norm_num)
  have := mul_le_mul hA T.del_le T.del_nonneg (by norm_num : (0:ℝ) ≤ 0.23 * 19.35)
  calc T.eta * T.oxycaloric * T.o2Delivery ≤ 0.23 * 19.35 * 0.0187 := this
    _ ≤ 0.0833 := by norm_num

/-- **E3 v2 composed with the Fick bound**: a sustained flight needing more than 0.0833 W is ruled out for any
animal whose O2 delivery `Q·Ca` and efficiency lie inside the widened ranges. -/
theorem no_aerobic_flight_above_ceiling_v2 (T : TeleostAerobicV2) {W v LD P Q Ca Cv : ℝ} (hQ : 0 ≤ Q)
    (hCv : 0 ≤ Cv) (hdel : Q * Ca ≤ T.o2Delivery)
    (hsus : P ≤ aerobicPower T.eta T.oxycaloric Q Ca Cv)
    (hflight : powerRequired W v LD ≤ P) (hbig : 0.0833 < powerRequired W v LD) : False := by
  have h := sustained_flight_requires T.eta_nonneg T.oxy_nonneg hQ hCv hsus hflight
  have hAnn : 0 ≤ T.eta * T.oxycaloric := mul_nonneg T.eta_nonneg T.oxy_nonneg
  have h2 : T.eta * T.oxycaloric * (Q * Ca) ≤ T.eta * T.oxycaloric * T.o2Delivery :=
    mul_le_mul_of_nonneg_left hdel hAnn
  have h3 := aerobicCeilingV2_le T
  have e : T.eta * T.oxycaloric * Q * Ca = T.eta * T.oxycaloric * (Q * Ca) := by ring
  linarith

/-- **E3 v2 is non-vacuous**: the physiology chain's own values (η 0.15, 19.342857 J/ml, Q·Ca =
0.06564129 × 0.18723338 ml/s) lie inside the widened ranges. -/
theorem teleostAerobicV2_nonvacuous : Nonempty TeleostAerobicV2 :=
  ⟨{ eta := 0.15, oxycaloric := 19.342857, o2Delivery := 0.06564129 * 0.18723338
     eta_nonneg := by norm_num, eta_le := by norm_num
     oxy_nonneg := by norm_num, oxy_le := by norm_num
     del_nonneg := by norm_num, del_le := by norm_num }⟩

/-! ### E4: gills do not ventilate in air -/

/-- O2 uptake while airborne. The observation is that it is zero, so airborne aerobic work is paid for out
of the store carried into the air. -/
structure NoAerialUptake where
  uptakeInAir : ℝ
  zero_in_air : uptakeInAir = 0

/-- **Airborne aerobic power is time-limited.** With no uptake, a flight of duration `t > 0` can spend at
most the store `S` (ml O2) at `E` J/ml, so the mean mechanical power is at most `E S / t`. Nothing here
bounds anaerobic (burst) power, which is what a flying fish is understood to use. -/
theorem stored_power_le (_U : NoAerialUptake) {Eo2 S t P : ℝ} (ht : 0 < t)
    (hspend : P * t ≤ Eo2 * S) : P ≤ Eo2 * S / t := by
  rw [le_div_iff₀ ht]; exact hspend

/-! ### E5: the observed fin-ratio range (provenance, not impossibility) -/

/-- Pectoral fin length over standard length, inside the range of the 49 measured flying-fish specimens. -/
def measuredFinRatio (r : ℝ) : Prop := 0.406 ≤ r ∧ r ≤ 0.823

/-- A ratio outside the measured range is above or below it: a statement about the record, not about what is
possible. No theorem here says such a fish cannot exist. -/
theorem finRatio_outside {r : ℝ} (h : ¬ measuredFinRatio r) : r < 0.406 ∨ 0.823 < r := by
  unfold measuredFinRatio at h
  rcases lt_or_ge r 0.406 with hlt | hge
  · exact Or.inl hlt
  · exact Or.inr (by by_contra hc; exact h ⟨hge, not_lt.mp hc⟩)

/-! ### E6: a project convention about the map -/

/-- Rows of the genotype map as (link type, derived by propagating down `part_of`). The convention is that
no "required for" link is ever derived that way. -/
def requiredForNotPropagatedB (rows : List (String × Bool)) : Bool :=
  rows.all fun r => !(r.1 == "required for" && r.2)

/-- Soundness of the check: if it passes, no "required for" row was derived by downward propagation. -/
theorem requiredFor_not_propagated_of_check {rows : List (String × Bool)}
    (h : requiredForNotPropagatedB rows = true) :
    ∀ r ∈ rows, r.1 = "required for" → r.2 = false := by
  intro r hr htype
  have hall := List.all_eq_true.mp h r hr
  simp only [htype, beq_self_eq_true, Bool.true_and, Bool.not_eq_true'] at hall
  exact hall

/-- A row that breaks the convention makes the check fail. -/
theorem requiredFor_propagated_violates {rows : List (String × Bool)} {r : String × Bool}
    (hr : r ∈ rows) (htype : r.1 = "required for") (hd : r.2 = true) :
    requiredForNotPropagatedB rows = false := by
  by_contra h
  have := requiredFor_not_propagated_of_check (Bool.of_not_eq_false h) r hr htype
  rw [hd] at this
  exact Bool.noConfusion this

/-! ### E7: lethality before the stage a phenotype is scored -/

/-- A phenotype can be scored only if the animal is still alive at that stage (stages in hours). -/
def CanScore (deathHpf scoredHpf : ℕ) : Prop := scoredHpf < deathHpf

/-- **An intervention lethal at or before the scoring stage cannot produce the scored phenotype.** -/
theorem cannot_score_of_lethal_before {d s : ℕ} (h : d ≤ s) : ¬ CanScore d s := by
  unfold CanScore; omega

/-! ### Non-vacuity: the measured record is a witness -/

/-- Every entry above, bundled. An instance of this is a proof that the observations are jointly
satisfiable; without one, "eliminated by the empirical layer" would be worthless. -/
structure Record where
  allometry : WithinSpeciesAllometry
  massBand : MassExponentBand
  aerobic : TeleostAerobic
  airUptake : NoAerialUptake
  finRatio : { r : ℝ // measuredFinRatio r }
  lethal : { p : ℕ × ℕ // p.1 ≤ p.2 }
  mapRows : { rows : List (String × Bool) // requiredForNotPropagatedB rows = true }

/-- The project's own measured numbers. Davenport 1992 (1.834, 1.236, 2.981); the *C. unicolor* fitted row
(2.971, n = 1640); the physiology chain's proxies for a 0.06 kg fish (0.15, 19.342857, 0.06564129,
0.18723338); zero uptake in air; the median measured fin ratio 0.687; *ezh2* death and scoring both at
48 hpf; and two map rows, an "expressed in" row derived downward and a "required for" row that is not. -/
def measured : Record where
  allometry :=
    { areaExponent := 1.834, wingLoadingExponent := 1.236, massExponent := 2.981
      area_lt_isometric := by norm_num
      loading_gt_isometric := by norm_num
      mass_near_cube := by norm_num }
  massBand := { b := 2.971, lo := by norm_num, hi := by norm_num }
  aerobic :=
    { eta := 0.15, oxycaloric := 19.342857, cardiacOutput := 0.06564129, arterialO2 := 0.18723338
      eta_nonneg := by norm_num, eta_le := by norm_num
      oxy_nonneg := by norm_num, oxy_le := by norm_num
      q_nonneg := by norm_num, q_le := by norm_num
      ca_nonneg := by norm_num, ca_le := by norm_num }
  airUptake := { uptakeInAir := 0, zero_in_air := rfl }
  finRatio := ⟨0.687, by unfold measuredFinRatio; norm_num⟩
  lethal := ⟨(48, 48), by norm_num⟩
  mapRows := ⟨[("expressed in", true), ("required for", false)], by decide⟩

/-- **The empirical layer is non-vacuous**: the measured numbers satisfy every entry at once. -/
theorem empirical_nonvacuous : Nonempty Record := ⟨measured⟩

/-- The measured aerobic proxies are inside the measured ranges, so the ceiling theorem applies to them: the
chain's own ceiling is at most 0.0458 W. -/
theorem measured_ceiling_le :
    measured.aerobic.eta * measured.aerobic.oxycaloric * measured.aerobic.cardiacOutput *
      measured.aerobic.arterialO2 ≤ 0.0458 := aerobicCeiling_le measured.aerobic

/-- The two lethal levers the genotype thread states in hours: *ezh2* (death 48 hpf, fin absence scored at
48 hpf) and *wls* (death by 12 dpf = 288 hpf, ray parameters from 45 dpf = 1080 hpf). Neither phenotype can
be scored in a living animal. -/
theorem ezh2_cannot_be_scored : ¬ CanScore 48 48 := cannot_score_of_lethal_before (by norm_num)

theorem wls_rays_cannot_be_scored : ¬ CanScore 288 1080 := cannot_score_of_lethal_before (by norm_num)

end Empirical
end Delphi
