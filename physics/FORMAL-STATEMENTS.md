# Formal statements for the Lean thread: Thompson's flight scaling and the strength law

Physics thread, 2026-10-31. Route: this file goes to the hub, the hub hands it to the Lean thread. Nothing here is
in `lean/`; the physics thread does not write there.

Every statement below is a consequence of stated definitions and assumptions, not an empirical claim. Each gives the
symbols with units, the hypotheses the proof needs, the conclusion, the assumption it rests on that is **not** mathematics,
a statement-mutant that must fail to compile (the Lean thread's convention), and the source line in Thompson.
Statement R1 already exists in `lean/Delphi/Thompson.lean` (claim `thompson1917-ch03-07`); it is restated so the others
can refer to it. **R7 (strength as L^2) is the one the open-problems ledger needs**: 17 candidates currently come back
`cannot-rule` for lack of it (`lean/eliminate/ledger.open-problems.json`, `candidatesWithNotFormalisedClaims`).

Thompson's own derivation is at `thompson-growth-form/inputs/pg55264.txt` lines 1716-1790 (chapter II). His symbols:
`l` a linear dimension, `w` weight, `V` speed, `m` mass of air displaced, `W` work per unit time.

## Symbols and units (shared)

| symbol | meaning | unit |
|---|---|---|
| L | one linear dimension of the body, the same one for every member of the family | m |
| M | body mass | kg |
| W = M g | weight | N |
| S | lifting (wing or fin) planform area | m² |
| ρ | air density | kg m⁻³ |
| C_L | lift coefficient, dimensionless, defined by Lift = ½ ρ v² S C_L | – |
| C_L,max | the largest C_L the wing attains | – |
| v | airspeed relative to the air | m s⁻¹ |
| v_min | the smallest v at which lift can equal weight | m s⁻¹ |
| (L/D) | lift-to-drag ratio in steady flight | – |
| P_req | mechanical power to sustain level flight | W |
| P_avail | mechanical power the muscles can deliver | W |
| f | muscle mass as a fraction of body mass | – |
| p | mass-specific muscle power | W kg⁻¹ |
| A_cs | load-bearing cross-sectional area of a supporting member | m² |
| σ | breaking stress of the material | N m⁻² |
| F_break | load at which the member breaks | N |

"Isometry" (Thompson: "all its proportions remaining the same") means: there are constants k₁, k₂, k₃ > 0 such that for
every member of the family M = k₁ L³ (with constant density), S = k₂ L², A_cs = k₃ L². Formally a family is a set of bodies
each carrying (L, M, S, A_cs, …) and isometry is the hypothesis that these three equalities hold on the set.

## R1 — Cube law (exists: `thompson1917-ch03-07`)

- **Hypotheses:** isometry with constant density.
- **Conclusion:** W(L₂)/W(L₁) = (L₂/L₁)³; d log W / d log L = 3.
- **Not mathematics:** that real bodies in the family are isometric and of equal density. The claims thread measured 2.74 to
  2.86 on human growth data, so the law is an idealisation even where it is "supported".
- **Mutant that must fail:** exponent 2 or 4 in the conclusion.

## R2 — Area law

- **Hypotheses:** isometry.
- **Conclusion:** S(L₂)/S(L₁) = (L₂/L₁)²; A_cs(L₂)/A_cs(L₁) = (L₂/L₁)².
- **Not mathematics:** same as R1, applied to areas. Davenport 1992 (abstract) measured fin area ∝ L^1.834 within one flying-fish
  species, below 2, so the law fails as a within-species statement for flying fish; see `physics/allometry.json`.
- **Mutant:** exponent 3 in the conclusion.

## R3 — Wing loading grows linearly with size

- **Hypotheses:** R1 and R2.
- **Conclusion:** (W/S)(L₂)/(W/S)(L₁) = L₂/L₁.
- **Not mathematics:** inherits R1 and R2. Davenport 1992 measured W/S ∝ L^1.236 within Exocoetus obtusirostris (positive allometry).
- **Mutant:** exponent 2 or 0.

## R4 — Minimum speed law (the first half of `thompson1917-ch02-06`; also `thompson1917-ch02-10` for flight)

- **Definition:** Lift(v) = ½ ρ v² S C_L. Steady lift-supported flight means Lift(v) = W.
- **Hypotheses (for the dimensional statement, no isometry needed):** ρ > 0, S > 0, 0 < C_L ≤ C_L,max.
- **Conclusion 1 (exact):** if Lift(v) = W with C_L ≤ C_L,max then v ≥ v_min := sqrt(2 W / (ρ S C_L,max)). Equivalently
  v_min = sqrt(2 (W/S) / (ρ C_L,max)).
- **Hypotheses (for the scaling statement):** add R3 and that ρ and C_L,max are the same for every member of the family.
- **Conclusion 2:** v_min(L₂)/v_min(L₁) = (L₂/L₁)^½; d log v_min / d log L = ½; d log v_min / d log (W/S) = ½.
- **Not mathematics:** constant C_L,max across sizes (Reynolds-number effects change it), constant ρ, and that the animal
  actually flies near v_min. Thompson's own words: "its speed must be proportional to the square root of its linear
  dimensions" (line 1732-1733) — the "must" is Conclusion 1, the "proportional" is Conclusion 2.
- **Mutant:** exponent 1 or ⅓ on L in Conclusion 2; or dropping the hypothesis C_L ≤ C_L,max in Conclusion 1 (then nothing bounds v below).
- **Measured check (physics thread, not a proof):** Cypselurus hiraii specimen L3, W = 0.5886 N, S = 0.012688 m², C_L,max = 0.78
  (Park and Choi 2010) gives v_min = 9.85 m s⁻¹; quoted field glide speeds are 10 to 20 m s⁻¹. See `physics/results.json`.

## R5 — Power required scales as L^3.5 (second half of `thompson1917-ch02-06`)

- **Definition:** in steady level flight thrust equals drag, so P_req = D v = W v / (L/D).
- **Hypotheses:** R1, R4 Conclusion 2, and (L/D) the same for every member of the family (Thompson's "any given slope of wing").
- **Conclusion:** P_req evaluated at v_min scales as W v_min ∝ L³ · L^½ = L^3.5; d log P_req / d log L = 3.5. Per unit mass:
  P_req/M ∝ L^½, so "flight becomes harder as birds get larger" — Thompson's ratio per doubling 2^3.5/2^3 = √2 ≈ 1.41 (line 1774-1775, "1 : 1·4").
- **Not mathematics:** constant (L/D) across sizes; flight at v_min rather than at a faster, more efficient speed; Thompson's
  momentum-flux derivation (m ∝ l²V, W ∝ mV²) is a dimensional argument equivalent to the lift equation, not a separate physical law.
- **Mutant:** exponent 3 (would make flight no harder with size) or 4.

## R6 — Power available scales as L^3 (Thompson's premise, to be formalised **as an assumption**)

- **Hypotheses:** R1, muscle mass = f M with f constant, mass-specific power p constant.
- **Conclusion:** P_avail = f p M ∝ L³.
- **Not mathematics, and contested:** p constant is Thompson's assumption ("the work of which the bird is capable depends on
  the mass of its muscles", line 1769-1770). Muscle power per unit mass depends on contraction frequency, which falls with size,
  so the modern expectation is an exponent below 3. **The Lean thread should carry this as a named hypothesis, never as a fact.**
- **Corollary (R5 with R6):** P_req/P_avail ∝ L^½, so there is a size L* above which P_req > P_avail (claim `thompson1917-ch02-07`,
  "a bird as large as a man could not fly"). The existence of L* follows; its value does not — it needs f, p, (L/D), ρ, C_L,max,
  none of which the proof supplies. The physics thread could not source f or p for a flying fish (`results.json`, interpretation C).
- **Mutant:** exponent 3.5 for P_avail (then the ratio is constant and no L* exists).

## R7 — Strength scales as L^2 (the missing half of Galileo's square-cube argument; **most valuable**)

- **Definition:** a supporting member of cross-sectional area A_cs made of material with breaking stress σ fails under axial load
  F_break = σ A_cs (compressive or tensile; bending has the same L² dependence of section modulus per unit length but a different constant, so
  state the axial case first).
- **Hypotheses:** R2 (A_cs ∝ L²), σ the same for every member of the family (same material).
- **Conclusion 1:** F_break(L₂)/F_break(L₁) = (L₂/L₁)²; d log F_break / d log L = 2.
- **Conclusion 2 (with R1):** the static safety factor F_break/W ∝ L⁻¹; so for any family with fixed k₁, k₃, σ there is a size L_max =
  σ k₃ / (g k₁ · n) above which the member cannot carry n body weights. For n = 1 this is the size at which the body cannot stand.
- **Not mathematics:** isometry of the load-bearing sections (real animals thicken bones with size: elastic similarity gives
  A_cs ∝ L^2.5 under a different hypothesis), constant σ, axial loading. Statement this way lets the elimination checker say
  **which** of these a candidate must violate to escape the bound.
- **Mutant:** exponent 3 in Conclusion 1 (then the safety factor is constant and no L_max exists); or dropping "σ constant".
- **How the ledger uses it:** a candidate that commits to a body of linear size L and a support of cross-section ∝ L² of a named material
  with a stated σ commits to F_break/W; if it also commits to carrying n body weights with n > F_break/W it is eliminated. A candidate that
  does not commit to σ or to isometric sections stays `cannot-rule`, correctly.

## R8 — Froude speed law (`thompson1917-ch02-10`, swimming and walking)

- **Hypotheses:** dynamic similarity at equal Froude number Fr = v²/(g L).
- **Conclusion:** v ∝ (g L)^½; d log v / d log L = ½.
- **Not mathematics:** that the compared animals move at equal Froude number. Not tested by the physics thread.
- **Mutant:** exponent 1.

## What the physics thread asks of the Lean thread

1. R4 Conclusion 1 and 2, R5, R6-as-hypothesis and R7 as four modules or one, in the `constraints.json` three-state form.
2. R7 first: it unblocks the 17 `cannot-rule` candidates, and it needs only R2 plus one new hypothesis (σ constant).
3. Keep "constant C_L,max", "constant (L/D)", "constant p" and "constant σ" as **named hypotheses** so the scope notes can say
   "Assumed, not proved" exactly as the existing records do.
4. No number from `physics/results.json` belongs in a theorem statement; the numbers are for the checker's candidate inputs.
