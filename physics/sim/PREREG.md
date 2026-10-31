# Pre-registration: ground-truth validation of the coupled flying-fish simulator

Physics thread, written 2026-10-31T20:34Z, **before the simulator was run for the first time** (the page at
`dashboard/public/t/physics/sim/` had been authored but not opened; no output had been seen). SHA-256 of this file at
the time of the first run is recorded in `physics/sim/PREREG.sha256` by the run script.

## What is being validated

A 2D side-view point-mass model of the darkedged-wing flying fish specimen L3 of Park and Choi 2010 (mass 0.06 kg,
reference area 0.012688 m², span 0.261 m, C_L,max 0.78, (L/D)max 4.37, C_D,min 0.055, ground effect as measured), moving
through swim, taxi, glide and re-entry phases under gravity, lift, drag, thrust and water drag, integrated with RK4 at
1 ms. Parameters and their kinds (measured, secondary, assumed, tuned) are in `sim/params.json`. The physiology chain
(gill exchange, haemoglobin, cardiac output, muscle power) is being written by another agent as `physiology/`; until it
lands, the organism level uses the stub interface in `sim/physiology-stub.js` with its outputs labelled "stub".

## Tests, tolerances, and what each would mean

| # | test | pass if | fail if | source of the target |
|---|---|---|---|---|
| 1 | Glide speed and v_min | peak glide airspeed in 10 to 22 m/s AND the simulated v_min (from the parameters) is within 2 % of 9.85 m/s AND no glide segment longer than 0.2 s runs below 0.95 v_min while gaining height | any of the three fails | 10 to 20 m/s field range (Makiguchi 2013, Deng 2019, both second-hand); v_min from results.json (constraint C9) |
| 2 | Glide distance and duration | longest glide 5 to 50 m; with the default parameters at least one glide lasts 1 to 6 s | longest glide > 60 m or < 3 m, or no glide completes | up to 50 m (Makiguchi 2013 citing Edgerton and Breder 1941, Davenport 1990); durations are not published, so 1 to 6 s is derived from 50 m at 10 to 20 m/s and is a weak target |
| 3 | Take-off and taxi | take-off speed 7 to 13 m/s; mean taxi length 3 to 18 m; swim phase reaches 8 to 11 m/s before breaching | outside | about 10 m/s (Makiguchi citing Davenport 1994); 9 m average taxi (Deng 2019 citing its ref 11); approach under 30 body lengths/s (Davenport 1994) |
| 4 | **No powered flight for the real fish** | with the real fish's muscle power (from the physiology chain, or the stub's sourced non-bird upper bound), the power available to the pectoral fins is below the power required for level flight at every speed from v_min to 25 m/s, so the model cannot make the real fish climb or hold altitude under power; the glide-only run loses total mechanical energy monotonically once airborne | the model lets the real fish gain net mechanical energy while airborne, or P_avail ≥ P_req anywhere in that speed range | the observed behaviour: flying fish glide and do not flap (Davenport 1994 abstract, point 6); P_req = W v/(L/D) at each speed from the measured polar; P_avail sourced from bats and insects only (Aves held out) |

Rules fixed now:
- The parameters in `params.json` marked `assumed` or `tuned` may be moved within their stated slider ranges to pass tests 1 to 3,
  and every such move is recorded in `sim/RUNS.md` with the value before and after. Moving a `measured` or `secondary`
  value, changing an equation, or widening a tolerance after seeing a result is a deviation and is recorded as such.
- Test 4 is not tunable: no parameter may be moved to pass or fail it. If it fails, the model is wrong and the page says so.
- The designed flier (part C) is run only after tests 1 to 4 are reported. It changes only the listed morphology and
  physiology parameters, never an equation, and must satisfy every Lean constraint in `lean/constraints.json` as an
  illustrative candidate; its power budget waits for the O2-to-power bound the Lean thread is being asked for.
- No bird value enters any parameter, target or comparison (class Aves is the frozen holdout). If a needed value exists
  only for birds, the page says "unavailable (holdout)".
- Development (genome to morphology) and molecular dynamics are not simulated; the page says so.

## What a pass does not establish

That the parameters are right (several are assumed or tuned to the very figures used as targets, which is stated beside
each), that the second-hand field figures are accurate, or that the model generalises beyond one 60 g specimen.
