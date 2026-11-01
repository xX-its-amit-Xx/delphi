# Law-set changelog

Newest first. Each release is an immutable file `lawsets/lawset-<version>.json` pinning every law's version,
content hash, status and kind. `lawsets/current.json` names the current one. Laws are never deleted: a retired
or contested law keeps its file, so a verdict computed against an older law set can be reproduced exactly.

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
