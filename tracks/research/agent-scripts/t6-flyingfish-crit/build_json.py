import json, os
R = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/"
CSV = R + "physics/glide-data.csv"
S = "D:/Users/ashenoy00000/delphi-work/agents2/scratch/t6-flyingfish-crit/"


def f(claim, source, conf, val="", q=""):
    return dict(claim=claim, source=source, confidence=conf, value=val, evidence_quote=q)


findings = [
    f("Design arithmetic for model L3 is correct: S=0.012688 m2, W=0.5886 N, W/S=46.39 N/m2, vmin^2=97.10, vmin=9.854 m/s.",
      S + "recompute.out (script recompute.py)", "high", "vmin=9.854 m/s",
      "Table 1 model L3; Table 2 ... CL_max 0.78 at 35 deg attack; LD_max 4.37 at 0 deg; CD_min 0.055 at -10 deg; coefficients use reference area A1+A2+A3"),
    f("Level-launch bounds recompute exactly: 0.65 m (10 m/s), 28.49 m (15), 67.47 (20); with delta 0.14: 0.75, 33.12, 78.45; 50 m needs 17.03 m/s (delta 0.14) or 17.93 (delta 0). All design figures are right.",
      S + "recompute.out", "high", "0.65/28.49/67.47 m"),
    f("P1 threshold 16.09 m/s = sqrt(2 g 13.2) is arithmetically right, but assumes zero speed at the apex. A gliding trajectory at apex must still fly at >= vmin; adding that term gives 17.8-18.2 m/s (W/S 37.0-46.4 N/m2, CLmax 1.03).",
      S + "recompute.out", "high", "17.82-18.23 m/s"),
    f("P2 is logically implied by P1 for the headline trajectory: ratio=45.4/(4.7 v0^2/2g) is 0.731 at v0=16.1 and falls as v0 rises; ratio>1 needs v0<13.77, which contradicts P1 (v0>=16.1). The lower floor 0.30 equals v0=25.1 m/s, above every speed in the project data (field 15-20 m/s).",
      S + "recompute.out", "high", "ratio 0.731 at 16.1; 0.30 at 25.13 m/s"),
    f("P2 denominator (4.7 v0^2/2g) drops both h0 and the stall floor, so P2 does not test the wrapper M3 that P4 and P5 rely on.",
      "design-flyingfish.json frozen_predictions P2 vs model M3", "high"),
    f("The stall-floor bound M3 is violated by lofted flight in a point-mass model using the L3 polar (parabolic fit CD=0.055+0.238 CL^2, CLmax 0.78): fish L3 from 10 m/s, h0=0, best flight 12.7 m versus M3 bound 0.65 m (19.7x); from 15 m/s 37.5 m vs 28.5 m (1.32x).",
      S + "lofted.out (lofted_sim.py, random-search control, seed 3)", "medium", "1.32x at 15 m/s; 19.7x at 10 m/s"),
    f("For the 30 g printed-glider placeholder (h0=1 m, vmin 6.96 m/s) best simulated flights exceed M3 by 58% at 7.5 m/s, 44% at 8, 25% at 10, 13% at 12. P5 1.10 allowance would fail at every speed for an optimal pitch-up launch.",
      S + "lofted.out", "medium", "ratio 1.58/1.44/1.25/1.13"),
    f("Even constant-CL launches (no control) exceed M3 at low speed: ratio 1.43 at 7.5 m/s, 1.26 at 8, 0.95 at 10, 0.81 at 12. The P5 outcome therefore depends on the three launch speeds, which P5 does not state.",
      S + "fixed_trim.out (fixed_trim_sim.py)", "medium", "1.43/1.26/0.95/0.81"),
    f("The plain energy bound without stall floor, (L/D)max (h0+v0^2/2g), was not exceeded in any simulated case (ratios 0.57-0.80), so it is the defensible P5 upper bound.",
      S + "lofted.out", "medium", "0.57-0.80 of no-floor bound"),
    f("The registry scope for flight-climb-glide-law already says the lemma covers a single steady glide with no thrust and lift equal to weight. A P2/P5 failure on lofted launches would therefore not narrow the law, contrary to the design paper claim; it would show misapplication.",
      R + "lean/registry/laws/flight-climb-glide-law.json (scope.assumed)", "high", "",
      "A single steady glide with no thrust and lift equal to weight; taxiing, repeated touch-and-go, wind and updrafts are outside the model."),
    f("Minimum launch speed for a 50 m flight, h0=0, no ground effect: design formula 17.93 m/s; point-mass search about 17.2 m/s (49.2 m at 17, 53.7 at 17.9); no-floor energy bound 14.98 m/s. The 17.0 m/s requirement is a model statement with about +-1 m/s spread.",
      S + "min50.out (min_launch_50m.py); recompute.out", "medium", "about 17.2 m/s"),
    f("P4 verdict (e) 0.65 m from 10 m/s consistent is hypersensitive: v0^2-vmin^2 = 2.9 m2/s2 (3% of v0^2). CLmax 0.80 gives 1.19 m, 0.90 gives 3.53 m, 1.03 gives 5.89 m. Verdicts (a),(b) stay eliminated for CLmax up to 2.0 (15 m/s bound 48.5 m at CLmax 2.0).",
      S + "recompute.out", "high", "0.65 -> 5.89 m"),
    f("P4 is a pipeline/arithmetic unit test: (c) and (e) are consistent with any claim below the bound, (d) is cannot-rule, (f) is a mutant. None can fail on nature; the design says so itself (a failure is a bug report).",
      "design-flyingfish.json P4", "high"),
    f("P3 threshold 0.50 s is arithmetically correct (T=0.500 s at 5.15 m/s, 23.3 deg, f=0.170, vmin 12.50 m/s) but only 20% above the no-lift ballistic time (0.415 s). At 30 deg (field value cited in takeoff-data.csv) T=0.632 s; at 45 deg 0.894 s. It fails on launch-angle error, not on gliding.",
      S + "recompute.out; " + R + "physics/takeoff-data.csv", "high", "0.500/0.632/0.894 s",
      "pitch angle at leaping (captive),20.0 +- 3.3,degrees ... previous field studies cited there give about 30 deg"),
    f("P3 rule no leap > 0.50 s over n=10 leaps (13 fish, repeated measures): Monte Carlo under a pure-ballistic null gives refutation probability 26% (path angle = pitch), 47% (+3 deg extra sd), 96% (path angle 5 deg above pitch), 100% (+10 deg, sd 5). At a 1.0 s threshold it is 0% in all four scenarios; at 0.80 s, 8.5% in the worst.",
      S + "recompute.out (seed 1, 40000 draws)", "medium", "26%/47%/96%/100%"),
    f("Body pitch (20.0 +- 3.3 deg, accelerometer) is not the flight-path angle, and leap speed 3.87-5.15 m/s is itself an estimate from tail-beat 21.2 Hz by Wardle formula, not a measurement.",
      R + "physics/glide-data.csv row Cheilopogon heterurus doederleini", "high", "",
      "captive aquarium with 3-axis accelerometer; leap speed estimated from tail-beat frequency 21.2 Hz by Wardle's formula"),
    f("P5 launch-speed gate error alone is as large as the allowance: a 0.5 m gate at 240 fps is 10-16 frames; +-0.5 frame timing at each edge gives speed sd 2.6-4.1% and bound sd 9.6-10.5%, about one sd equal to the 10% allowance, before vmin and L/D fit errors.",
      S + "p5.out (p5_power.py)", "medium", "bound sd 9.6-10.5%"),
    f("P5 refutation rule (>=2 of 30 above 1.10 bound) has power 0.23 at a true per-flight exceedance of 3%, 0.45 at 5%, 0.82 at 10% if flights were independent; they are not, since one calibration (10 drop glides) sets the bound for all 30.",
      S + "p5.out", "high", "0.227/0.446/0.816"),
    f("P6 cannot fail on its 1.8.1 arm: the 1.7.0 fix was wording-only, the checker returns out-of-scope for a candidate declaring flight_mode glide, and a standing registry test asserts no accepted law is violated by a real organism. The 1.6.0 arm is doubtful: the out-of-scope rule for E3 is in checker code (browser-check.mjs lines 1827-1828), not in the law-set file, so the current checker run with lawset 1.6.0 would probably not turn red.",
      R + "lean/registry/CHANGELOG.md 1.7.0; lean/eliminate/browser-check.mjs lines 1827-1828, 939-953", "medium", "",
      "the checker now returns out-of-scope for a declared unpowered glide, and a standing registry test asserts no accepted law is violated by a real organism making a realistic claim."),
    f("Law-set difference for this track is nil: flight-climb-glide-law is 1.0.0 accepted in both 1.6.0 and 1.8.1; perturb-wind-glide 1.0.0 both. thompson1917-ch02-10 (vmin) is 1.1.0 in 1.8.1 with scope text unchanged from 1.0.0. Only E3 (2.0.0 to 2.1.0), fick-principle (1.1.0 to 1.3.0), scaling-area-law and scaling-strength-law (1.0.0 to 1.1.0) changed.",
      R + "lean/registry/lawsets/lawset-1.6.0.json and lawset-1.8.1.json (my listing)", "high"),
    f("Deng 2019 simulated height 13.2 m exceeds the 8 m maximum recorded field flight height in the project data by 1.65x; Deng morphology mimics Park and Choi model L3, so P1/P2 are not independent of the calibration polar and test a simulation, not a fish.",
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1088/1748-3190/ab23e6&resultType=core&format=json ; " + CSV, "high", "13.2/8 = 1.65",
      "The results show that the flying fish can achieve a distance up to 45.4 m, and reach a height of 13.2 m"),
    f("Ground-effect delta 0.14 was measured only for h/b <= 0.97 with b the half pectoral span (0.1305 m for L3, so h <= 0.127 m); applying it to the whole 50 m path is generous, and the design correctly uses delta 0 for P5 (rail 1.0 m).",
      R + "physics/ground-effect.json; recompute", "high", "h <= 0.127 m"),
]

table = [
    dict(name="P1 Deng apex launch speed", fields="design_threshold=16.09 m/s; corrected_threshold=17.8-18.2 m/s (apex speed >= vmin); can_fail=only if sim has thrust/wind or misread; verdict=keep, revise threshold", source="https://doi.org/10.1088/1748-3190/ab23e6"),
    dict(name="P2 Deng lofted ratio", fields="design_range=0.30-1.00; ratio_at_16.1=0.731; 0.30 equals v0=25.13 m/s; >1.00 needs v0<13.77 m/s (contradicts P1); verdict=drop (implied by P1)", source=S + "recompute.out"),
    dict(name="P3 Makiguchi airborne time", fields="design_threshold=0.50 s; ballistic_5.15ms_23.3deg=0.415 s; at 30deg=0.632 s; at 45deg=0.894 s; MC_false_refute=26-100%; proposed_threshold=1.0 s per-leap with measured angle; verdict=revise, or cannot-test if per-leap durations absent", source="https://doi.org/10.3354/ab00494"),
    dict(name="P4 six certificate verdicts", fields="arithmetic=6/6 reproduced; bounds=0.75,33.12,78.45 m; min_v0_50m=17.03 m/s; can_fail_on_nature=no; verdict=relabel as pipeline test; (e) hypersensitive to CLmax", source=S + "recompute.out"),
    dict(name="P5 printed glider", fields="design_allowance=1.10; speed_gate_bound_sd=9.6-10.5%; sim_ratio_to_M3=0.81-1.43 (fixed trim) and 1.13-1.58 (optimal); speeds=unfrozen; verdict=rewrite with no-floor bound and frozen speeds", source=S + "lofted.out"),
    dict(name="P6 wild-type audit", fields="1.8.1_arm=true by construction (checker scope rule); 1.6.0_arm=doubtful (rule in checker code, not law set); verdict=drop as prediction, keep as regression test", source=R + "lean/registry/CHANGELOG.md"),
]

d = dict(
    label="t6-flyingfish-crit",
    topic="Track 6 adversarial critique of the frozen flying-fish glide-energy design (design-flyingfish.json)",
    summary=("Referee verdict on P1-P6. Arithmetic is right: every number I could recompute from the cited equations matches (vmin 9.854 m/s, bounds 0.65/28.49/67.47 m, 17.03 m/s for 50 m, Cheilopogon T=0.500 s, reach 2.37 m). The scientific problems are elsewhere. "
             "(1) The headline novelty, the stall floor in M3, is false outside steady lift=W glide: in a point-mass simulation with the same L3 polar, pitch-up launches beat the floor bound by 13-58% for the printed glider (and 19.7x at 10 m/s for the fish), while the plain no-floor energy bound held (ratios 0.57-0.80). P5's 1.10 allowance would fail at low launch speeds, and P5 never freezes its three speeds. "
             "(2) P2 is implied by P1 and cannot fail independently; its 0.30 floor equals an unreachable 25 m/s launch. "
             "(3) P1's threshold ignores apex speed (should be 17.8-18.2, not 16.1 m/s). "
             "(4) P3's 0.50 s threshold is only 20% above pure ballistic time, so a 5-10 degree angle error refutes it 96-100% of the time under the ballistic null; use about 1.0 s with per-leap measured angle. "
             "(5) P4 and P6 test software and a checker scope rule, not nature; P6's 1.8.1 arm passes by construction and its 1.6.0 arm likely will not reproduce. "
             "(6) P5 speed-gate error (about 10% on the bound) equals its allowance, and the 30 flights share one calibration. "
             "Law set 1.6.0 versus 1.8.1 makes no difference to the laws this track uses. Recommend: drop P2 and P6 as predictions; relabel P4; rewrite P1, P3, P5 as in recommendations."),
    lay_summary=("The earlier plan predicted how far a flying fish, or a 3D-printed model of one, can glide from a given launch speed. I rechecked the sums and they are correct. "
                 "The trouble is that the main distance limit only holds for a smooth, level glide, and a glider thrown upward in an arc can beat it, as my simple computer model shows. "
                 "Think of throwing a paper plane up and then letting it float: it travels further than a rule that assumed it never climbed. "
                 "Several of the planned tests also could not really fail, or would fail for a trivial reason such as a slightly wrong launch angle. "
                 "I suggest dropping two tests, relabelling one as a software check, and rewriting three with sturdier thresholds."),
    glossary=[
        dict(term="stall floor / vmin", plain="The slowest speed at which the wings can still hold the weight up."),
        dict(term="L/D (lift-to-drag)", plain="How many metres a glider can travel forward per metre of height it loses, in still air."),
        dict(term="energy bound", plain="A ceiling on distance set by how much height and speed energy the glider starts with."),
        dict(term="lofted launch", plain="A launch angled upward so the body climbs before gliding down."),
        dict(term="ballistic", plain="Flying like a thrown stone, with almost no help from wings."),
        dict(term="apex", plain="The highest point of a flight path."),
        dict(term="polar", plain="The table linking a wing's lift to its drag at each angle."),
        dict(term="Monte Carlo", plain="Running a made-up experiment many times on a computer to see how often a rule would fail by chance."),
        dict(term="power (of a test)", plain="The chance that a test catches a real effect of a given size."),
        dict(term="law set", plain="A numbered, frozen list of checked rules that a design is judged against."),
        dict(term="point-mass model", plain="A computer model that treats the whole animal or glider as a single dot with weight, lift and drag."),
    ],
    findings=findings,
    key_claims=[
        dict(claim="The stall-floor energy bound M3 is not valid for lofted or pitch-up launches: with the L3 polar, simulated flights exceed it by 13-58% (printed glider, 7.5-12 m/s) and the P5 1.10 allowance cannot absorb that; the no-floor bound (L/D)max(h0+v0^2/2g) held in every case.",
             source=S + "lofted.out and fixed_trim.out; " + R + "lean/registry/laws/flight-climb-glide-law.json",
             evidence_quote="A single steady glide with no thrust and lift equal to weight; taxiing, repeated touch-and-go, wind and updrafts are outside the model."),
        dict(claim="P2 cannot fail independently of P1: ratio>1 needs v0<13.77 m/s, P1 demands v0>=16.09, and the 0.30 floor corresponds to v0=25.13 m/s.",
             source=S + "recompute.out; Europe PMC abstract of 10.1088/1748-3190/ab23e6",
             evidence_quote="The results show that the flying fish can achieve a distance up to 45.4 m, and reach a height of 13.2 m"),
        dict(claim="P3's 0.50 s threshold is only 20% above the ballistic time in its extreme case and is exceeded by angle error alone (0.632 s at 30 deg, the field angle cited in the project data).",
             source=R + "physics/takeoff-data.csv",
             evidence_quote="previous field studies cited there give about 30 deg"),
        dict(claim="P6 cannot fail on 1.8.1: the 1.7.0 fix made the checker return out-of-scope for declared glides and added a standing test.",
             source=R + "lean/registry/CHANGELOG.md",
             evidence_quote="the checker now returns out-of-scope for a declared unpowered glide, and a standing registry test asserts no accepted law is violated by a real organism making a realistic claim."),
    ],
    table=table,
    recommendations=[
        "DROP P2 (implied by P1; thresholds 0.30/1.00 map to v0 of 25.1 and 13.8 m/s, neither reachable if P1 holds). Keep only the Deng row as an input-reading check.",
        "DROP P6 as a prediction. Keep it as a regression test and run the 1.6.0 arm with a checker build from before the 1.7.0 commit, or state that the arm is not reproducible with the current checker.",
        "RELABEL P4 as a pipeline unit test, not a prediction. Replace verdict (e) 10 m/s by 12 m/s, since the 10 m/s result swings 0.65 to 5.89 m as CLmax goes 0.78 to 1.03. Report bounds as a range over CLmax 0.78-1.03 and state wind w=0.",
        "REVISE P1: v0 >= sqrt(2 g 13.2 + vmin^2) = 17.8-18.2 m/s (vmin from Deng's own W/S and CLmax 1.03, falling back to L3 W/S 37.0-46.4); refuted if any reported launch speed is below that minus 2%. State the number of trajectories n in advance (unknown to me).",
        "REVISE P3: per-leap rule T_obs <= 1.0 s, or T_obs <= T_M5(v_i, theta_i + 10 deg) + 0.1 s using that leap's own measured pitch. The threshold must exceed the 45 deg ballistic-with-lift time at 5.15 m/s (0.894 s) so only genuine gliding (above about 1.5 s) refutes. If per-leap airborne durations are not tabulated, record cannot-test before opening results.",
        "REWRITE P5: freeze the three launch speeds (suggest 9, 11, 13 m/s so v0^2 - vmin^2 is at least 30 m2/s2 and gate error stays near 10% of the bound); use the no-floor bound (L/D)max_measured (h0 + v0^2/2g) as the upper bound; pre-register the integrator band 0.55-0.80 of it as a two-sided prediction for the best flight per speed; refute at 1.15 x bound with more than 1 of 30 above; use the floor bound M3 only for steady drop glides. Pre-register the integrator parameters and seed before building.",
        "Do not claim a law is narrowed by a P2/P5 failure: the registered scope of flight-climb-glide-law already restricts it to steady lift=W glide. State the claim as the stall-floor wrapper is rejected for lofted launches, which my simulation already predicts.",
        "Stamp verdicts with the law set, but note it makes no difference here: flight-climb-glide-law 1.0.0 and perturb-wind-glide 1.0.0 are identical in 1.6.0 and 1.8.1.",
        "Treat shared calibration explicitly: report the 30 flights as a clustered sample under one bound, and give the bound's own uncertainty from the 10 drop glides before FREEZE 2.",
    ],
    reproduce=[
        dict(what="Recompute every design number and the P3 Monte Carlo", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-crit/recompute.py", expected="vmin=9.854, bounds 0.65/28.49/67.47, v0 for 50 m 17.03, P2 ratio 0.731, P3 T=0.500/0.632/0.894 s, MC 0.263/0.473/0.957/1.000 (Python 3, stdlib only)"),
        dict(what="Lofted-launch simulation vs M3", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-crit/lofted_sim.py", expected="x/M3 of 19.70, 1.32, 1.58, 1.44, 1.25, 1.13 (seed 3; about 8 s)"),
        dict(what="Fixed-trim launches", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-crit/fixed_trim_sim.py", expected="ratios 1.43, 1.26, 0.95, 0.81"),
        dict(what="Minimum 50 m launch speed", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-crit/min_launch_50m.py", expected="best x 31.1, 37.5, 43.7, 49.2, 53.7 m at 14, 15, 16, 17, 17.9 m/s"),
        dict(what="P5 gate error and refutation power", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-crit/p5_power.py", expected="bound sd 9.6-10.5%; P(refute) 0.036/0.227/0.446/0.816/0.989"),
        dict(what="Deng abstract", command_or_url="curl -s 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1088/1748-3190/ab23e6&resultType=core&format=json'", expected="abstract containing distance up to 45.4 m, and reach a height of 13.2 m"),
        dict(what="Crossref DOI checks", command_or_url="curl -s https://api.crossref.org/works/10.1242/jeb.046052 (also 10.1088/1748-3190/ab23e6, 10.3354/ab00494)", expected="matching titles"),
    ],
    citations=[
        dict(authors="Park H, Choi H", year=2010, title="Aerodynamic characteristics of flying fish in gliding flight", doi_or_arxiv="10.1242/jeb.046052", verified=True, how_verified="Crossref api.crossref.org/works/10.1242/jeb.046052 returned matching title, first author Park, 2010, in this run", used_for="L3 polar, CLmax 0.78, L/D 4.37, ground effect", venue="J Exp Biol"),
        dict(authors="Deng J, Zhang L, Liu Z, Mao X", year=2019, title="Numerical prediction of aerodynamic performance for a flying fish during gliding flight", doi_or_arxiv="10.1088/1748-3190/ab23e6", verified=True, how_verified="Crossref returned matching title; Europe PMC search returned the abstract quoted, in this run", used_for="45.4 m, 13.2 m, CLmax 1.03, L/D 4.7", venue="Bioinspiration & Biomimetics"),
        dict(authors="Makiguchi Y, Kuramochi K, Iwane S, Kojima T, Naito Y", year=2013, title="Take-off performance of flying fish Cypselurus heterurus doederleini measured with miniature acceleration data loggers", doi_or_arxiv="10.3354/ab00494", verified=True, how_verified="Crossref returned matching title, first author Makiguchi, 2013, in this run", used_for="leap speed and pitch, via project data file only", venue="Aquatic Biology"),
    ],
    could_not_find=[
        "I deliberately did not open Deng's trajectory section (pdf2-deng-2019.txt) or Makiguchi's per-leap results, so blind-test integrity of P1-P3 is preserved; my verdicts on them concern thresholds and logic, not outcomes.",
        "Whether Makiguchi tabulates per-leap airborne time: not checked, so P3 testability is unconfirmed.",
        "Deng's mass, wing area and launch angle: unknown to me, so the P1 correction uses L3 W/S as a proxy (17.8-18.2 m/s).",
        "My point-mass simulation uses a parabolic polar fitted to three L3 numbers (CDmin 0.055, L/D 4.37, CLmax 0.78); the measured polar at intermediate CL was not read, and 6-DOF stability, tail trim and fin flexibility are absent. The 13-58% exceedances are model results, not measurements.",
        "Park and Choi values come from the project glide-data.csv, not re-read from the paper in this run.",
        "I did not run Lean; provability of the wrapper was not examined beyond reading glide_range_le_groundEffect in Flight.lean.",
        "The pre-1.7.0 checker build needed to test P6's 1.6.0 arm is not in the repo; I read the checker code but did not execute it.",
    ],
)
os.makedirs("D:/Users/ashenoy00000/delphi-work/agents2", exist_ok=True)
json.dump(d, open("D:/Users/ashenoy00000/delphi-work/agents2/t6-flyingfish-crit.json", "w"), indent=1)
print("ok")
