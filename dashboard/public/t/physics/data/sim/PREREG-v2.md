# Pre-registration, simulator version 2: launch from physiology, and "sustained" defined before running

Physics thread, written 2026-10-31T21:03Z, **before any version-2 run**. SHA-256 at the time of the first v2 run is in
`PREREG-v2.sha256`. Version 1's record (`PREREG.md`, `RUNS.md`) stands unchanged: under its pre-registered arms test 4 passed,
its post-hoc arm (b') failed, and its launch was unphysical. Nothing in v1 is relabelled.

## What changes in v2 (the hub's ruling of 2026-10-31)

1. **Launch from the chain only.** Swim and taxi thrust are no longer tuned numbers. At every step the thrust along the path
   is T = P_axial / v, where P_axial is the physiology chain's available axial power (aerobic plus burst, as it reports it) and
   v the speed (floor 0.5 m/s), capped at 4 body weights (a cap on force, assumed, to keep the integrator sane at low speed).
   Water drag and lobe drag stay as **named assumptions**, because a logged search (`physics/SEARCHES.md`, tag
   `epmc-v2-fish-drag`, 2026-10-31T21:02Z) returned no fetched drag coefficient for a swimming fish body: frontal area 7 cm²,
   C_d 0.1 submerged; lobe drag 20 % of that area when taxiing. A sensitivity sweep over C_d 0.03 to 0.3 is reported beside
   the main run. **If the 60 g fish cannot reach lift-off speed, that is a finding about these assumptions and the chain's
   power, not something to tune away.**
2. **"Sustained powered flight" defined now:** net gain of mechanical energy per unit mass while airborne, produced by
   **aerobic** flight power alone (the chain's `aerobic_W` for the flight group; burst stores excluded), held for at least
   **10 s** of continuous airborne time. **"Burst flight"** is any airborne bout in which flapping thrust comes from the chain's
   total flight power (aerobic plus burst); it is reported separately with its duration and what ended it (burst store, blood
   O₂ store, or re-entry). This distinction is physical (aerobic versus anaerobic) and is the question Thompson's claim is
   about; v1's FAIL under (b') stays on record.
3. **Arms**, all on the real fish (Park and Choi L3), run-6 aerodynamics, environment from `conditions/baseline.json`,
   physiology copy byte-identical to the committed `physiology/`:
   - (a) flight-muscle fraction 0 (the observed animal).
   - (b) flight-muscle fraction 0.0913 (bat mean, PMC10966098), flapping from **total** flight power: measures **burst flight**
     bouts and their durations. This arm cannot pass or fail test 4; it describes.
   - (c) flight-muscle fraction 0.0913, flapping from **aerobic** flight power only. The chain's aerobic power for a group is
     its red-fibre mass (5 % of the group, gerry2014) times the scup red-muscle maximal power (134 W/kg at 20 °C, rome1992,
     Q10 1.88 to the baseline 25 °C) further limited by O₂ delivery, which in air is the blood store only. This is the hub's
     "red muscle specific power applied to a flight muscle a fish does not have".
4. **Test 4, v2:** PASS if in (a) and (c) there is **no sustained powered flight** as defined above (aerobic-only net gain
   never held for 10 s) and in (c) the maximum aerobic flight power is below the minimum level-flight power over v_min to
   25 m/s. FAIL if either arm shows sustained aerobic flight. Burst bouts in (b) do not decide the test; their durations are
   reported.
5. **If the fish never becomes airborne in v2** (launch from the chain too weak), the test is reported as
   **not reachable under these drag assumptions**, with the maximum speed reached and the sensitivity sweep, and is neither
   passed nor failed.

## Fixed now, so they cannot move after a result

Flags on the page: `v2=1` (launch from the chain), `flapsrc=aerobic|total`, `fmf`, `cdw` (water drag coefficient for the
sweep), `tmax`. No measured, secondary or assumed value other than `cdw` in its stated sweep is moved. The aerodynamic model,
the trim law, the breach rule and the ground effect are v1's. Every v2 run is appended to `RUNS.md` under a "v2" heading
with its flags.

## What a pass would not establish

That the chain's muscle, O₂ and store values are right for a flying fish (they are proxies from trout, scup, sculpin, mahi-mahi
and snapper, each labelled in the chain); that the drag assumptions are right; anything about birds.
