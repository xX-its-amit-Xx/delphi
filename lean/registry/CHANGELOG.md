# Law-set changelog

Newest first. Each release is an immutable file `lawsets/lawset-<version>.json` pinning every law's version,
content hash, status and kind. `lawsets/current.json` names the current one. Laws are never deleted: a retired
or contested law keeps its file, so a verdict computed against an older law set can be reproduced exactly.

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
