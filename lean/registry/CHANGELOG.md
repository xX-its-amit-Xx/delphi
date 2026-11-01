# Law-set changelog

Newest first. Each release is an immutable file `lawsets/lawset-<version>.json` pinning every law's version,
content hash, status and kind. `lawsets/current.json` names the current one. Laws are never deleted: a retired
or contested law keeps its file, so a verdict computed against an older law set can be reproduced exactly.

## 1.8.1 (2026-11-01)

Retires test-loop-only-density-sanity. It was a LOOP TEST authored only to demonstrate that a law entering the registry reaches all eight surfaces without a code edit (lean/registry/LIVE-LOOP-DEMO.md), it was never a scientific claim, and it is retired now that the demonstration is captured. Law set 1.8.0 keeps pinning it as candidate, because law sets are immutable and the captured demonstration must stay reproducible; from 1.8.1 on lean_check excludes it and no surface evaluates it. Nothing else changes: the four genuine discovery candidates (turing-ddi, kimura-heterozygosity, maynardsmith-hawk-dove, fisher-kpp-speed) stay candidate and stay non-binding.

It also carries one law that landed while this release was being cut: `development-growth-asymptote` 1.0.0
(candidate, Exocoetidae, von Bertalanffy length-at-age from `development/growth.json`). It arrived with
`constraints: []` and no `browser_check` block, so **it evaluates nothing and binds nothing yet** -- it is in
the law set, served by every tool, and judges no design. That is not a defect of the release; it is the state
`check-exposed` now reports as a note for a candidate and would FAIL for an accepted law (`bind:accepted`). It
needs a `browser_check` block with a `lookups` entry reading Linf out of `development/growth.json` keyed by
taxon, because Linf is in no engine state; the mechanism for that is documented under "Declarative browser
check" in `lean/registry/README.md` and needs no code edit.

### Added
- added `development-growth-asymptote` 1.0.0 (biological, candidate)

### Status
- `test-loop-only-density-sanity` candidate -> retired

## 1.8.0 (2026-11-01)

First release in which a new law BINDS without a code edit. Five laws enter the set carrying a declarative `browser_check` block (lean/registry/README.md "Declarative browser check"): the LeanBio discovery agent's four survivors fisher-kpp-speed 1.1.0 (KPP1), kimura-heterozygosity 1.1.0 (HET1), maynardsmith-hawk-dove 1.1.0 (HAWKDOVE1) and turing-ddi 1.1.0 (TURING1), plus test-loop-only-density-sanity 1.0.0 (TL1), which is a LOOP TEST and not a scientific claim and is retired in 1.8.1. ALL FIVE ARE candidate, SO NONE OF THEM IS BINDING: a candidate violation is advisory everywhere (binding:false), candidate is the automatic ceiling, and nothing here can reject a design on its own. What is new is that they evaluate at all -- before this release a law whose constraint id had no hand-written formula in lean/eliminate/build-browser-check.mjs produced no row and bound nothing, on any surface, silently. This release also carries five SCOPE-ONLY registry versions sitting unreleased in lean/registry/laws/: thompson1917-ch03-07 1.1.0, scaling-area-law 1.1.0, scaling-strength-law 1.1.0, thompson1917-ch02-10 1.1.0 and E2 1.1.0, all the same near-singular implied-exponent exclusion (|ln(L/L_ref)| < 0.1, i.e. a length ratio inside [0.905, 1.105]) that fixes the third wild-type false positive. No Lean statement, hypothesis or number changed in any of the five and the old versions are archived, so the narrowing only greys rows that were WRONGLY red: nothing previously ruled out becomes allowed. The reasoning for that narrowing belongs to the registry thread and is written up under the 1.9.0 entry. Also carried: aerobic-power-bound 1.1.0 and fick-principle 1.3.0, which move C14 and C14b to aerobic-power-bound and leave fick-principle owning no constraint, because aerobic-power-bound is the law whose theorem rules a design out while fick-principle is the named hypothesis it rests on -- until now both laws listed C14 and the generated checker broke the tie alphabetically, so a violation of the aerobic ceiling was reported under fick-principle for no better reason than the letter f.

### Added
- added `fisher-kpp-speed` 1.1.0 (biological, candidate)
- added `kimura-heterozygosity` 1.1.0 (biological, candidate)
- added `maynardsmith-hawk-dove` 1.1.0 (biological, candidate)
- added `test-loop-only-density-sanity` 1.0.0 (physical, candidate)
- added `turing-ddi` 1.1.0 (biological, candidate)

### Changed
- `E2` 1.0.0 -> 1.1.0
- `aerobic-power-bound` 1.0.0 -> 1.1.0
- `fick-principle` 1.2.0 -> 1.3.0
- `scaling-area-law` 1.0.0 -> 1.1.0
- `scaling-strength-law` 1.0.0 -> 1.1.0
- `thompson1917-ch02-10` 1.0.0 -> 1.1.0
- `thompson1917-ch03-07` 1.0.0 -> 1.1.0

## 1.7.0 (2026-11-01)

E3 2.0.0 -> 2.1.0 and fick-principle 1.1.0 -> 1.2.0, WORDING ONLY: scope.applies_to and scope.excludes now say the aerobic bound is on sustained aerobic power DEMAND (powered level or climbing flight, sustained swimming) and does NOT apply to unpowered descent or glide, where the work comes from potential and kinetic energy rather than metabolism, nor to burst effort on white-muscle stores. No Lean statement, hypothesis or number changed (statement hashes identical); v2.0.0 and v1.1.0 are archived in law-versions/ and stay pinned by law sets up to 1.6.0. Prompted by E3 and C14 firing red on real Park and Choi flying fish making ordinary glide claims: the checker now returns out-of-scope for a declared unpowered glide, and a standing registry test asserts no accepted law is violated by a real organism making a realistic claim.

### Changed
- `E3` 2.0.0 -> 2.1.0
- `fick-principle` 1.1.0 -> 1.2.0

## 1.6.0 (2026-11-01)

E3 1.0.0 -> 2.0.0: the Fick aerobic envelope widened after a measured zebrafish broke it (Palstra et al. 2010, PMC3013094: MO2max at Ucrit 2630 mg O2 kg^-1 h^-1, about 2x the per-kg delivery v1 allowed). v2 bounds eta <= 0.23 (Gladman and Askew 2024) and O2 delivery Q*Ca <= 0.0187 ml O2/s at 0.06 kg (1600 mg O2 kg^-1 h^-1), ceiling 0.0458 -> 0.0833 W, wording rescoped from every teleost to its sources; v1 stays compiled and pinned by law sets 1.0.0-1.5.0, and v2 is proved a weakening of v1 (TeleostAerobic.toV2). Flying-fish powered-flight shortfall: 16x on the new envelope, about 10 to 29x (central about 20x) across corrected inputs, 38x with the original snapper proxies; still ruled out by an order of magnitude. perturb-current 1.1.0 adds a P2b scope assumption (aerobic only below about 0.8 Ucrit; taxon-appropriate ceiling); fick-principle 1.1.0 adds a scope note (taxon-appropriate MO2max or Q). The three new versions carry approval role carried-forward-pending-review: no person has reviewed them yet. Report: physics/FICK-CEILING-CHECK.md.

### Added
- added `maynardsmith-hitchhiking` 1.0.0 (biological, candidate)

### Changed
- `E3` 1.0.0 -> 2.0.0
- `fick-principle` 1.0.0 -> 1.1.0
- `perturb-current` 1.0.0 -> 1.1.0

## Checker note (2026-11-01, no law set change)

Floating-point tolerance in lean/eliminate/browser-check.mjs (generator and fragments), not a law change: no law
version, hash or status changed, and law set 1.5.0 stands. A correct unpowered glide in a 3 m/s headwind was red
on P4b because the distance and the bound, the same formula in a different operation order, differed by one ulp
(3.1678027110201326 vs 3.167802711020132). Every comparison of a design value against a COMPUTED bound now uses
a relative tolerance of 1e-9 of the larger magnitude (`leTol`, `geTol`, exported `REL_TOL`; sign-safe for
negative bounds such as a climb bound). That covers C9, C15, C16, C14, C8c, the scaling bands (C7b, C2a, C8e,
C9c), P1b, P2b, P3, P4, P4b, P5, E2, E3, E4, G4 and G5. Comparisons of raw inputs with fixed constants (P1
window, P2 U_crit, P3b depth cap, E5) and integer comparisons (G1, G3, E7) stay exact. A design 0.1 percent over
a bound is still red.

## 1.5.0 (2026-11-01)

Five perturbation laws promoted from candidate to accepted by human approval (approved_by_role human:project-lead, 2026-11-01: approved by the project lead in the hub session after review of sources and mutation results): perturb-thermal (P1, P1b), perturb-current (P2, P2b), perturb-isa-vmin (P4), perturb-wind-glide (P4b), perturb-energy-balance (P5). Their violations are now red. Not approved and unchanged: perturb-pressure 2.0.0 (candidate) and perturb-depth-cap (contested).

### Status
- `perturb-current` candidate -> accepted
- `perturb-energy-balance` candidate -> accepted
- `perturb-isa-vmin` candidate -> accepted
- `perturb-thermal` candidate -> accepted
- `perturb-wind-glide` candidate -> accepted

## 1.4.0 (2026-11-01)

perturb-pressure 1.0.0 -> 2.0.0: Boyle's law for a closed swim bladder now takes pressure from the water column, P(d) = p0 + rho g d, with p0, rho and g as named hypotheses (Delphi.Hydro.WaterColumn, lean/Delphi/Hydrostatics.lean). Version 1.0.0 fixed the gradient at 1 atm per 10 m; in sea water (1025 kg/m^3) the real gradient is 10053 Pa/m, below 10132.5, so v1 called a correct Boyle volume violated by 0.5 to 1 percent. The v1 case is the instance oneAtmPer10m. v1 is superseded, not deleted: law-versions/perturb-pressure@1.0.0.json, and its Lean statement stays compiled. Constraint P3 now uses Delphi.Hydro.closed_bladder_rules_out; 4 new statement mutants are rejected (61/61 overall, 19/19 controls).

### Changed
- `perturb-pressure` 1.0.0 -> 2.0.0

## 1.3.0 (2026-11-01)

perturb-depth-cap stays contested, now with the contradiction compiled in Lean (lean/registry/lean/P3bContested.lean: OsmolyteDepthCap applied to a teleost at 8336 m proves False, standard axioms only; the same statement at 8100 m is rejected) and the observation's PMID 41822858 and primary DOI 10.1016/j.dsr.2023.104132 recorded. The law and the observation are both kept. No law version or hash changed.

No law changes.

## 1.2.0 (2026-11-01)

perturb-depth-cap contested: a teleost (Pseudoliparis sp., Liparidae) recorded at 8336 m in the Izu-Ogasawara Trench (Jamieson et al. 2026, BDJ 14:e182172, citing Jamieson et al. 2023b) lies below the law's 8200 m teleost cap, inside the law's own scope (Teleostei). P3b rows now give 'contested' (amber), never red. The law and the observation are both kept.

### Status
- `perturb-depth-cap` candidate -> contested

## 1.1.0 (2026-11-01)

Adds the seven perturbation laws of lean/Delphi/Perturb.lean (candidate), three machine-discovered regularities that passed propose.mjs (candidate), one machine-discovered regularity that contradicts E1 and E2 (contested). Scopes (including the per-constraint scopes of the reference-relative checks C7b, C2a, C8e, C9c, C8c) are as in 1.0.0.

### Added
- added `disc-flying-fish-fin-ratio-gap` 1.0.0 (biological, candidate)
- added `disc-heterurus-mass-exponent` 1.0.0 (biological, contested)
- added `disc-measured-wing-loading-band` 1.0.0 (biological, candidate)
- added `disc-pectoral-length-allometry` 1.0.0 (biological, candidate)
- added `perturb-current` 1.0.0 (biological, candidate)
- added `perturb-depth-cap` 1.0.0 (biological, candidate)
- added `perturb-energy-balance` 1.0.0 (biological, candidate)
- added `perturb-isa-vmin` 1.0.0 (physical, candidate)
- added `perturb-pressure` 1.0.0 (physical, candidate)
- added `perturb-thermal` 1.0.0 (biological, candidate)
- added `perturb-wind-glide` 1.0.0 (physical, candidate)

## 1.0.0 (2026-10-31)

Bootstrap from lean/laws.json, lean/constraints.json, lean/empirical.json and the Lean modules (commit
f66dfeb9). 41 laws: 31 accepted (20 biological, 11 physical), 1 contested (`haldane-cost-of-selection`:
Haldane's cost accounting, contested in the literature since 1957; lean/laws.json already carried it as a
named hypothesis never proved), 2 retired (`muscle-power-premise`, superseded by `aerobic-power-bound` for
the Studio; `E8`, a restatement of the proved theorem `genotype-developmental-ordering`), 7 proposed (the
"not formalised" gaps: they enter no law set's red verdicts until formalised and run through propose.mjs).
Accepted laws carry `approval.approved_by_role: "bootstrap-grandfathered"`: they were in force before the
registry existed and no per-law human review is recorded here.
