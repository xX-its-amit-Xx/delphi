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
