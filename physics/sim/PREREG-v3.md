# Pre-registration, simulator version 3: is the v2 non-reachability a drag problem or a power problem?

Physics thread, written 2026-10-31T21:12Z, **before any v3 run**; SHA-256 in `PREREG-v3.sha256`. v1 and v2 records stand.

## Hypothesis (approved by the hub, 2026-10-31)

**H3:** the v2 non-reachability (the chain-driven real fish never reaches lift-off speed) is caused by the **assumed water
drag areas and coefficients** (body frontal area 7 cm² at C_d 0.1 in the swim phase; lobe at 20 % of that area times the
immersed fraction in the taxi), **not by the chain's power**.

**Refuting outcome:** if the chain-driven fish still cannot reach lift-off speed with the assumed drag removed entirely
(the most favourable case for H3), then drag was not what stopped it and H3 is refuted; the chain's burst power, its burst
store, or the thrust model moves up as the cause.

## Condition 1 (hub): every drag value from a fetched source, fixed here, or the arm is untestable

Logged searches `epmc-v2-fish-drag`, `epmc-v3-hydrofoil-drag`, `epmc-v3-taxi-posture` (`physics/SEARCHES.md`) returned **no
fetched source giving a drag coefficient or a submerged fraction** for a flying fish body or caudal lobe, or a planing or
surface-piercing foil drag applicable to it. The one directly relevant source found, Deng, Wang, Zhang and Mao (2019),
"Why does a flying fish taxi on sea surface before take-off? A hydrodynamic interpretation", bioRxiv 10.1101/765560
(**preprint, not peer reviewed**; Crossref shows no `is-preprint-of` relation, so no published version was found by that
route), gives CFD **power requirements**, not coefficients, for a 0.25 m, 0.191 kg fish: 36 W to taxi at 10 m/s (deflection
15°, 50 Hz), 350 W to swim submerged at 10 m/s, and 16.5 m/s taxi speed at 350 W; it also states that the lower lobes are
beaten semi-submerged at 50 to 70 strokes per second (citing Franzisket 1965, not fetched). These are simulation results from
a non-peer-reviewed source for a fish three times the mass of ours; they are **not** used as parameters.

**Therefore the "sourced drag" arm of H3 cannot be run.** No drag value is picked. What can be run, and is fixed below, is the
bound that does not need a coefficient: drag set to zero.

## Arms (real fish, run-6 aerodynamics, v2 launch from the chain's axial power only, physiology copy byte-identical, 90 s)

- **A (zero-drag bound):** flags `v2=1&fmf=0&taxidrag=0&cdw=0.0001`: lobe drag off and body water drag negligible. The chain's
  power is the only limit. **H3 survives** if the fish reaches lift-off speed (about 16 m/s under the run-6 trim law and polar)
  and becomes airborne; **H3 is refuted** if it does not.
- **B (thrust-side arm, the hub's item 2):** no run; a calculation fixed here and reported with its inputs. The taxi is
  described as about 30 strokes over about 9 m at up to 50 strokes per second (Deng 2019 citing its refs 10 and 11, second-hand;
  Davenport 1994 abstract: up to 50 beats per second; the preprint: 50 to 70 per second, preprint). Thirty strokes at 50 Hz is
  0.6 s; covering 9 m in 0.6 s is a mean speed of 15 m/s, consistent with a taxi from the 10 m/s leap to about 16 m/s at lift-off.
  The kinetic energy gained is ½ m (16² − 10²) = 4.7 J for 0.06 kg, so the taxi needs at least 4.7 J / 0.6 s = 7.8 W of net
  thrust power **before any drag**. The chain's axial burst power is 8.75 W. So: with zero drag the chain is marginally
  sufficient (which is what arm A tests dynamically); with the assumed lobe drag (about 0.6 N at 13 m/s, 5 J of work over 9 m)
  it needs about 16 W and is not. The per-stroke impulse is 4.7 J / 30 strokes / 13 m/s ≈ 0.012 N s per stroke, net of drag.
- **C (aerobic flight, carried over):** `v2=1&fmf=0.0913&flapsrc=aerobic&taxidrag=0&cdw=0.0001`: if arm A gets the fish
  airborne, this arm re-asks test 4 v2 (sustained = aerobic-only net gain held 10 s) in the one configuration where the real body
  can fly at all. Pass/fail as in PREREG-v2 §4.

## What v3 decides and does not

- A airborne: H3 not refuted (drag is decisive but unquantified; it stays untestable until a drag source exists).
  A not airborne: H3 refuted; the chain's power or burst-store proxy is the cause.
- Nothing about which drag coefficient is right. Nothing tuned. No bird value.
