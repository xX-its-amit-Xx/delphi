# Run log for the flying-fish simulator (version 1)

Every run of `dashboard/public/t/physics/sim/` since the pre-registration (`PREREG.md`, sha256 in `PREREG.sha256`,
written 2026-10-31T20:34Z before run 1). Runs are headless (Chrome, `?autorun=1`, 60 s of model time or until the
sequence stops); numbers are read from the page's own validation table. **Tests 1 to 3 are POST-HOC (exploratory) from
run 2 on**, because the model was changed after run 1's result was seen; the hub ruled so and this file says so on every
later run. **Test 4 (the real fish cannot power-fly) is confirmatory and untouched**: no parameter that affects power
availability was added or moved in any run (the physiology stub still returns zero power), and it has not been run.

| run | time (UTC) | what changed before it (and why) | take-off m/s | taxi m | longest glide m / s / height m | sequence | tests 1-3 status |
|---|---|---|---|---|---|---|---|
| 1 | 20:37 | nothing: pre-registered defaults | 10.7 | 0.3 | 12.4 / 1.42 / 1.41 | 16 m in 1.9 s, 1 glide, stop | pre-registered; glide too slow and short against 15-20 m/s and 50 m |
| 2 | 20:40 | added `taxi_pitch_deg` (assumed 5°): the body was held at the measured 20° leap pitch during the taxi and lifted off at once | 10.7 | 0.3 | 12.0 / 1.34 / 1.21 | 15 m in 1.8 s | post-hoc; no effect: the fish was leaving by momentum, not lift |
| 3 | 20:43 | replaced the fixed taxi pitch by a trim law (hold tail in water, bounded [-10°, stall]); added `approach_angle_deg` (assumed 10°, the measured 20° is a body angle) and `takeoff_speed_target_m_s` (assumed 17.5); thrust along the path | 11.5 | 0.5 | 12.5 / 1.24 / 0.80 | 19 m in 2.0 s | post-hoc; still popped out: 1.7 m/s of upward momentum through a 5 cm band |
| 4 | 20:46 | `breach_model`: vertical velocity set to zero at the surface on exit (shallow leap, no planing model, assumed); Lean pure-glide bound row added to the table | 14.1 | 1.6 | 23.1 / 2.02 / 1.24 | 31 m in 2.8 s, stop at re-entry | post-hoc; first sequence of the right shape; stopped because re-entry dived the body through the band |
| 5 | 20:49 | the same zeroing on re-entry; taxi factor 0.35 -> 0.07 to aim at the 9 m taxi | none | taxied 442 m | none | 60 s of taxi | post-hoc; thrust too small to beat the assumed lobe drag at speed |
| 5a-d sweep | 20:52 | taxi factor 0.15, 0.2, 0.25, 0.3 (URL override) | 9.1 to 10.2 | 2.0 to 6.3 | 1.2 to 3.2 m hops | 11 to 43 m | post-hoc; the undamped trim let the body creep out at about v_min: hops, not glides |
| 6a-d sweep | 20:55 | damping term added to the trim (gain 2 s/m, assumed control); taxi factor 0.35, 0.45, 0.55, 0.7 | 0.35, 0.45, 0.55: taxied the full 600 m or hopped once (never reached lift-off speed); 0.7: 16.5 | 0.7: 14.9 | 0.7: 36.1 / 3.11 / 3.11 | 0.7: 288 m in 23.4 s, 6 glides | post-hoc |
| 6 | 20:57 | default taxi factor set to 0.7 (tuned) | 12.9 first, then 16.5 | 14.9 | 36.1 / 3.11 / 3.11 | 288 m in 23.4 s, 6 glides | post-hoc; the confirmation run of the run-6 parameters; the Lean pure-glide row reads 36.1 m against 35 m (see below) |

## What the final parameters mean

- Physical picture at run 6: swim to 10 m/s (secondary field value, tuned thrust); breach with the vertical velocity
  zeroed (assumed); taxi with the tail in the water while the trim holds the body down, until even -10° of attack gives
  more lift than weight at about 16 m/s (this follows from the measured polar with the assumed C_L at 0° of 0.40); lift off,
  glide at 5° (assumed) for about 36 m and 3 s, reaching 3 m; re-enter with the tail, taxi again, repeat. Six glides and
  288 m in 23 s, against the field picture of up to 50 m per glide at 15 to 20 m/s and 400 m in 30 s.
- The taxi thrust factor 0.7 (2.5 N, about four body weights) is not a measurement. It is what the assumed lobe drag
  (20 % of an assumed frontal area, assumed C_d 0.1) requires to reach lift-off speed within about 15 m. Any pair of lobe
  drag and thrust with the same difference gives the same run. No thrust or lobe drag has been measured for a flying fish.
- The Lean pure-glide bound (range at most h_max (L/D)max = 8 m x 4.37 = 35 m for a glide that only trades height) is
  exceeded by about 1 m in run 6 (36.1 m) because the fish also trades the speed it gained in the taxi: 16.5 to 9.85 m/s is
  (16.5² - 9.85²)/(2g) = 8.9 m of equivalent height. That is consistent with the bound's reading; it is not a contradiction,
  and it shows why long field flights need the taxi: one glide from 8 m of height alone cannot reach 50 m.

## Deviations from the pre-registration, listed

1. Model changes after seeing results (runs 2, 3, 4, 5, 6a): taxi trim law with damping, approach angle, take-off speed
   target, breach and re-entry zeroing. Each is labelled `assumed` in `params.json` with the run it was added after.
2. Slider range of the taxi thrust factor widened downward (run 5), then the factor tuned upward to 0.7 (run 6).
3. Test 3's "take-off 7 to 13 m/s" conflated the leap speed (about 10 m/s, when the body leaves the water) with the lift-off
   speed (when the fins carry the weight, 16.5 m/s here). The page's validation row keeps the pre-registered wording and
   reports the FIRST lift-off, 12.9 m/s (within 7 to 13); the later lift-offs are 16.5 m/s and would be outside it. The literature's 15 to 20 m/s free-flight airspeed is the better target for lift-off, and
   the leap is the 10 m/s breach, which the model reproduces by construction (tuned swim thrust).
4. The validation row "glide speed stays above v_min" on the page was rewritten after run 2 to match the pre-registered
   test-1 wording (no climbing segment longer than 0.2 s below 0.95 v_min); the earlier row was stricter than PREREG.md.
No `measured` or `secondary` value was moved. No tolerance was widened. No power-related parameter exists yet.

## Test 4 (confirmatory): written BEFORE the run, 2026-10-31 ~22:25 UTC

The hub confirmed the physiology chain (`physiology/`, committed as the reference version; `node physiology/test.mjs` passes,
including "blood O2 store drains in air") and gave the go. Procedure, fixed now:

- Two arms, both on the real fish (Park and Choi L3), run-6 parameters, physiology chain ON, environment from
  `conditions/baseline.json`:
  - (a) chain default: flight-muscle fraction 0 (the observed behaviour: flying fish do not flap; Davenport 1994).
  - (b) upper bound: flight-muscle fraction 0.0913, the mean of extant bats (PMC10966098 citing Bullen and McKenzie 2004),
    the most generous non-bird value with a source, passed as `?fmf=0.0913`. This is the "sourced non-bird upper bound"
    PREREG.md names.
- Pass only if the real fish cannot gain net mechanical energy while airborne under (b) as well as (a): the TEST 4 row on the
  page reports the maximum net gain of mechanical energy per unit mass after lift-off (must stay at or below 0.5 J/kg, the
  pre-registered "no net gain" with integration slack) and the maximum available flight power against the minimum level-flight
  power over v_min to 25 m/s (must be below).
- Nothing else changed: no parameter moved, no equation touched, the physiology modules used as published. The copy beside the
  page is byte-identical to `physiology/` at the hub's commit.
- Both outcomes are reported whatever they are. If the real fish gains net energy under (b), the model fails its key test and
  that is the result.
- Afterwards, the hypothetical flier is re-run with the chain ON and its climb duration and limiter (blood O2 store or burst
  store) reported; that run is a design-study readout, not a test.

### Test 4 results, 2026-10-31 ~22:45 UTC (physiology copy byte-identical to `physiology/` at the hub's commit)

| arm | configuration | airborne? | max net mechanical energy gain | max P_avail(flight) vs min P_req(level) | TEST 4 row |
|---|---|---|---|---|---|
| (a) | chain default, flight muscle 0; swim and taxi thrust capped by the chain's axial power | **no**: 60 s of taxi at 3.5 m/s, burst store 0 %, axial power 0 W | 0.0 J/kg | 0.00 W vs 1.44 W | within (trivially) |
| (b) | as (a) with flight muscle 0.0913 (bat mean) | **no**, same as (a) | 0.0 J/kg | 0.00 W vs 1.44 W | within (trivially: the flight muscle was never airborne) |
| (b') | added after seeing (a) and (b): launch thrust NOT capped (the tuned run-6 launch), flapping thrust allowed from the 0.0913 flight muscle | yes: lifts off at 12.9 then 16.5 m/s | **54.0 J/kg** | **1.60 W vs 1.44 W** | **OUTSIDE: FAIL** |

**Plainly: the model fails its key test under (b').** With a bat's mean flight-muscle fraction, the chain's burst (anaerobic)
power lets the real fish's body sustain powered flight for about 26 s per bout (glides of 337 m lasting 26 s at 16.5 m/s to
6.9 m, limited by the burst store, which reads 0 % at the end; blood O2 store 38 %). This is a result, as the hub asked:
either the non-bird upper bound is too generous for a fish (a flying fish has no such muscle, Davenport 1992), or the chain's
white-muscle burst power (307 W/kg) applied to a 9 % flight muscle overstates what fin muscle can deliver, or both. Under the
observed muscle fraction (a) the real fish cannot power-fly.

**A second finding from (a) and (b):** with the chain capping the launch, the real fish never leaves the water: the chain's
axial burst power (8.75 W) cannot drive the tuned swim and taxi thrust, which demand about 36 to 40 W (3.59 N at 10 m/s,
2.5 N at 16 m/s). So the hydrodynamic thrust tuned in runs 5 and 6 (post-hoc, against assumed water drag and lobe drag) is
unphysical for a 60 g fish, and tests 1 to 3 as "within" rest on it. The assumed water drag (C_d 0.1 on an assumed 7 cm²
frontal area) is the likeliest culprit; nothing has been retuned.

**Deviation (recorded):** arm (b') was added after seeing that (b) never exercised the flight muscle. It is more generous to
powered flight than (b) (uncapped launch, flapping allowed), so a pass under it would have been stricter; it failed instead.
No measured or secondary value was moved; the flags `launchcap=0`, `flap=1`, `tmax` were added to the page for this run.

### Hypothetical flier with the chain ON (design-study readout, not a test)

Lifts off at 7.7 m/s, climbs at about 2.8 m/s to **179 m at t = 66 s**, where the flight power falls below 0.5 W:
**limited by the burst store (0 %)**, with the blood O₂ store still at 35 % (aerobic power in air is small because the gills do
not ventilate, so the blood store is barely drawn). It then glides down, reaching 900 m horizontal at 54 m height at 156 s.
So the designed flier's climb is a burst of about a minute on anaerobic stores, not sustained aerobic flight; sustained flight
needs an air-breathing respiratory surface, as reported to Genotype.

## v2 (launch from the physiology chain only), pre-registered in `PREREG-v2.md` (sha256 2dde1f61..., written 21:03 UTC before any v2 run)

Runs at 21:05 to 21:15 UTC, real fish, run-6 aerodynamics, flags as pre-registered, 90 s each.

| arm | flags | airborne? | max speed reached | aerobic flight power max | burst bouts | TEST 4 v2 row |
|---|---|---|---|---|---|---|
| (a) | v2=1, fmf=0, C_d 0.1 | **no** | 10.0 m/s | 0 W | 0 | within (sustained flight impossible without being airborne) |
| (b) | v2=1, fmf=0.0913, flapsrc=total | **no** | 10.0 m/s | 0.009 W | 0 | describes: no bout, never airborne |
| (c) | v2=1, fmf=0.0913, flapsrc=aerobic | **no** | 10.0 m/s | 0.009 W (vs 1.44 W required) | 0 | within |
| sweep | (a) with C_d 0.03 | **no** | 13.7 m/s | 0 W | 0 | within |
| sweep | (a) with C_d 0.3 | **no** | 7.3 m/s | 0 W | 0 | within |

**Outcome, as pre-registered in §5: test 4 v2 is NOT REACHABLE under these drag assumptions.** Driven by the chain's axial power
alone (aerobic plus burst, 8.75 W at best, the burst store empty within the attempt), the 60 g fish cannot reach the speed at
which its fins lift it (about 16 m/s under the run-6 trim law and polar), at any water drag in the sweep. It is neither
passed nor failed. Two numbers do stand regardless of reachability: the chain's aerobic flight power for a bat-sized 9.1 %
flight muscle is 0.009 W, against 1.44 W needed for level flight, so **sustained (aerobic) powered flight is out by more than
two orders of magnitude for a fish-muscle flier of this size**, and the field airspeeds of 15 to 20 m/s are not reproduced by
the chain's power with these drag assumptions either, which points at the drag (assumed, no fetched coefficient), the taxi
thrust model (assumed), or the chain's burst store (mahi-mahi proxy), in that order of suspicion. Nothing was tuned.

Flier with the chain on is unchanged from the v1 readout (burst of about a minute, 179 m); it was not re-run under v2's
launch since its design question is powered flight after take-off, which v2 cannot reach for the real body.

## v3 (drag or power?), pre-registered in `PREREG-v3.md` (sha256 b2a21d85..., written 21:12 UTC before any v3 run)

Hypothesis H3: the v2 non-reachability is caused by the assumed drag, not the chain's power. No fetched source gives a drag
coefficient or submerged fraction (searches `epmc-v2-fish-drag`, `epmc-v3-hydrofoil-drag`, `epmc-v3-taxi-posture`), so the
"sourced drag" arm is untestable and no value was picked; the zero-drag bound was run instead. The bioRxiv preprint
10.1101/765560 (Deng, Wang, Zhang, Mao 2019; **preprint, not peer reviewed**, no published version via Crossref relation) gives
CFD powers for a 0.191 kg fish (36 W to taxi at 10 m/s, 350 W to swim at 10 m/s, 16.5 m/s at 350 W) and is cited as context only.

| arm | flags | airborne? | lift-off | glides | stores at end | TEST 4 v2 row (sustained aerobic) | outcome |
|---|---|---|---|---|---|---|---|
| A, zero-drag bound | v2=1, fmf=0, taxidrag=0, cdw=0.0001 | **yes** | 13.9 then 16.5 m/s | six of 36.0 m, 3.1 s, 3.05 m; 354 m in 28 s | burst 69 %, blood O2 64 % | within (no flight muscle) | **H3 survives**: with the assumed drag removed, the chain's power alone reproduces the run-6 sequence |
| C, aerobic flight at the bound | v2=1, fmf=0.0913, flapsrc=aerobic, taxidrag=0, cdw=0.0001 | yes (same launch) | same | same | same | aerobic-only gain held 0.0 s; aerobic flight power 0.009 W vs 1.44 W required: **within, PASS** | sustained aerobic flight does not occur even where the body can fly |
| B, thrust-side calculation | none (PREREG-v3) | | | | | | 30 strokes at 50 Hz over 9 m needs at least 7.8 W net of drag (4.7 J in 0.6 s); the chain's 8.75 W is marginally enough with no drag, not with the assumed lobe drag (about 16 W) |

**Reading.** v2 failed on drag, not power: the chain's 8.75 W axial burst power is enough to launch the real body when nothing
is charged for water drag, and not enough with the assumed body and lobe drag. Which drag is right is unknown: no fetched
source gives it. So the launch model's status is: the chain's power is sufficient for the observed sequence only if the real
hydrodynamic losses during the approach and taxi are far below the assumed ones. That is a sourcing task, not a tuning task.

**Note on the v1-style row** ("max net gain" since first airborne): it reads 78 J/kg in both arms. That row compares the
current mechanical energy with the lowest seen since the first lift-off, across six taxi-glide cycles, so it counts the energy
the tail adds in the water between glides. It is not evidence of airborne power; the pre-registered v2 row (aerobic-only gain
held 10 s) is the one that decides, and it reads 0.0 s. In arm C the "burst bouts" column lists windows where total flight
power exceeded 0.5 W (availability), while the thrust applied was aerobic only; no burst thrust was used in C.

**Lean, independently:** sustained aerobic flight is eliminated with kernel-accepted certificates
(`lean/Delphi/Certificates/EliminationsPhysiology.lean`, constraint C14) for the real fish at 10 m/s, at v_min and for the
flier at 7 m/s, from the chain's own numbers: aerobic ceiling eta E Q C_a = 0.0357 W against 1.35, 1.33 and 0.94 W required,
short by 38, 37 and 26 times. The certificates do not bound burst flight or gliding. The sim's arm C and the certificate agree.

### Derived bound (not a test): how much drag the chain's power can carry to lift-off

Sweep at the hub's request (2026-10-31 ~21:25 UTC), v2 launch, real fish, fmf 0, 40 s, body water drag coefficient `cdw` on the
assumed 7 cm² frontal area and a separate lobe coefficient `lobecd` on 20 % of that area times the immersed fraction; nothing
else moved. "Airborne" is the sim's definition (tail clear of the water, glide phase entered).

| body C_d | lobe C_d | airborne | max speed m/s |
|---|---|---|---|
| 0.003 | 0.03 / 0.1 / 0.3 | yes / yes / no | 13.7 / 12.7 / 12.7 |
| 0.01 | 0.03 / 0.1 / 0.15 / 0.2 / 0.3 | yes / yes / no / no / no | 13.7 / 11.5 / 11.5 / 11.5 / 11.5 |
| 0.015 | 0.1 | no | 10.8 |
| 0.02 | 0.1 | no | 10.1 |
| 0.03 | 0.03 / 0.1 / 0.3 | no / no / no | 13.7 / 10.0 / 9.2 |

**Launch is reachable on chain power (8.75 W axial burst) if body C_d ≤ 0.01 and lobe C_d ≤ 0.1**, on these areas; it fails
at body 0.015 or lobe 0.15. As drag areas: body C_d·A ≤ 7 × 10⁻⁶ m², lobe C_d·A ≤ 1.4 × 10⁻⁵ m² (times immersion). The v1
assumption (C_d 0.1 on the body) is ten times the body threshold. Any future fetched drag value decides H3 directly against
this bound. Even where airborne, the maximum speed reached is 11.5 to 13.7 m/s, below the field 15 to 20 m/s, so the chain's
power reproduces lift-off but not the field airspeed at any drag in the sweep.

## TFF v2 and the winged zebrafish (design-study readouts, not tests), 2026-10-31 ~21:40 UTC

**TFF v2 (fish 2, HYPOTHETICAL; physics/flier/tff/tff.json).** Altitude-dependent air density and O2 partial pressure from the
NASA GRC troposphere fit; flapping power = the co-design aerobic capacity 1.31 W scaled by C_a(h)/C_a(0) on the trout Hill curve
(air-breathing assumed; the chain is not used because it has no air-breathing path), minus 0.48 W inertial. First run at the
v1 flier's 8 deg angle of attack: no climb (the fish flew at 6.3 m/s and the 10 percent margin went to drag); the TFF's angle
was then set to 30 deg so it flies near the minimum speed where the map evaluates the requirement (assumed, recorded in
params.json). Final run, 600 s: lifts off at 11.6 m/s, climbs at 0.15 m/s at 5.2 m/s airspeed to 91 m, with 3.1 km covered;
the map's ceiling for this point is 2741 m (arterial PO2 = inspired PO2, an upper bound), which at this margin would take
about five hours of flight. Consistent with the map; nothing else moved.

**Winged zebrafish (fish 3, HYPOTHETICAL).** 3.0 cm standard length, 0.51 g (FishBase Danio rerio length-weight, an
unverified estimate row), flying-fish fin proportions by isometric scaling of the Park and Choi fins: wing loading 18 N/m2,
v_min 6.1 m/s = 205 body lengths per second. Run on the chain-driven launch (v2=1, phys=1): never airborne; peak 7.3 m/s,
then the burst store empties and it taxis at 2 m/s for the rest of the 60 s. Run on the tuned flying-fish launch (no chain;
unphysical for this body, kept only to answer "could it glide if launched"): six glides of 12 to 17 m lasting 1.6 to 2.5 s to
0.7 to 3.3 m at 9.6 to 12.2 m/s. So: fins of flying-fish proportion would let a zebrafish body glide if something launched it
above 6 m/s; its own modelled muscles do not. One panel of the 2x2; the other three are Genotype's.
