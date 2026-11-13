import json, os
A = 'D:/Users/ashenoy00000/delphi-work/agents/'
R = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/'
CL = R + 'registry/CHANGELOG.md'
ELIM = R + 'eliminate/README.md'
LED = R + 'eliminate/ledger*.json (script ledgers.py)'
CALC = 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-lay/calc.py'
PC = 'https://doi.org/10.1242/jeb.046052'
MK = 'https://www.int-res.com/articles/ab2013/18/b018p105.pdf'
DV = 'https://api.crossref.org/works/10.1017/s0025315400048761'
DG = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1088/1748-3190/ab23e6&format=json&resultType=core'


def F(c, s, conf, q='', v=''):
    return dict(claim=c, source=s, confidence=conf, evidence_quote=q, value=v)


findings = [
    F("The law library used is law set 1.8.1, which pins 59 laws.", R + 'registry/lawsets/lawset-1.8.1.json', 'high', '', 'version 1.8.1; 59 laws (count of the laws list)'),
    F("Law set 1.8.1 retired a loop-test law and changed nothing else of substance.", CL, 'high', "Retires test-loop-only-density-sanity. It was a LOOP TEST authored only to demonstrate that a law entering the registry reaches all eight surfaces without a code edit"),
    F("The older law set 1.6.0 flagged real flying fish gliding normally as breaking aerobic-power laws; law set 1.7.0 changed the wording of the scope to fix this.", CL, 'high', "Prompted by E3 and C14 firing red on real Park and Choi flying fish making ordinary glide claims"),
    F("Law set 1.8.0 narrowed five scopes to fix a third false alarm on wild animals.", CL, 'high', "the same near-singular implied-exponent exclusion (|ln(L/L_ref)| < 0.1, i.e. a length ratio inside [0.905, 1.105]) that fixes the third wild-type false positive"),
    F("An elimination test can return three answers: eliminated, consistent, or cannot rule.", ELIM, 'high', "* **eliminated**: the violated relation with the numbers, the constraint's lemma, and the certificate theorem the kernel accepted"),
    F("'Consistent' is explicitly not a claim that a design is possible.", ELIM, 'high', "* **consistent**: not ruled out by this constraint. It is not a claim that the candidate is possible."),
    F("A test with a missing input says 'cannot rule' instead of passing.", ELIM, 'high', "This is the honest state for an omission; the checker never lets an omission pass."),
    F("Arithmetic in the checker is exact (no rounding).", ELIM, 'high', "Arithmetic is exact (BigInt rationals); nothing is rounded."),
    F("The example list has 18 candidates: 13 eliminated, 4 consistent, 1 unconstrained.", LED, 'high', '', 'candidates=18 eliminated=13 consistent=4 unconstrained=1'),
    F("The flier ledger has 3 candidates: 1 eliminated (a claimed 4 m/s steady flight), 2 consistent.", LED, 'high', '', 'candidates=3 eliminated=1 consistent=2'),
    F("The physiology ledger has 3 of 3 candidates eliminated (powered aerobic flight by a real flying fish or the designed flier).", LED, 'high', '', 'candidates=3 eliminated=3'),
    F("The open-problems ledger has 44 candidates: only 2 eliminated, 19 consistent, 23 unconstrained.", LED, 'high', '', 'candidates=44 eliminated=2 consistent=19 unconstrained=23'),
    F("Eliminations in the ledgers were checked by the Lean kernel in most ledgers (flier 1 of 1, physiology 3 of 3, tff 2 of 2, examples 13 of 13, open-problems 2 of 2); the genotype ledger reports 6 kernel-checked for 5 eliminated.", LED, 'medium', '', 'see ledgers.py output'),
    F("The model fish L3 (mass 0.06 kg, total area 0.012688 m2, C_Lmax 0.78) has a minimum flying speed of 9.85 m/s.", CALC + ' with inputs from physics/glide-data.csv in the application repo; air density 1.225 kg/m3 is unverified background', 'medium', '', 'vmin=9.854 m/s; W/S=46.39 N/m2'),
    F("Published wind-tunnel numbers for that model: C_Lmax 0.78 at about 35 degrees, L/D max 4.37 near 0 degrees, tunnel 12 m/s.", 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/physics/glide-data.csv (project reading of Park and Choi 2010; full text not re-fetched)', 'medium', "CL_max 0.78 at 35 deg attack; LD_max 4.37 at 0 deg; CD_min 0.055 at -10 deg; coefficients use reference area A1+A2+A3; Re 2.0e4 on chord"),
    F("In the proposed model, a 10 m/s launch of that fish buys about 0.65 m of level glide, 15 m/s about 28 m (33 m with 14% ground effect), 20 m/s about 67 m (78 m).", CALC, 'medium', '', '0.646 m; 28.5 m / 33.1 m; 67.5 m / 78.4 m. A calculation inside the proposed model, not a measurement.'),
    F("Under that model, a single 50 m glide needs a launch speed of at least about 17.0 m/s.", CALC, 'medium', '', '17.03 m/s'),
    F("If the fins lifted better (C_Lmax 1.03) the stall speed would drop to about 8.6 m/s.", CALC, 'medium', '', '8.575 m/s'),
    F("A compiled certificate in the repo already rules out 50 m of glide from an 8 m height at L/D 4.37.", R + 'Delphi/Certificates/Eliminations.lean (theorem elim_pure_glide_field_distance_C15)', 'high', "theorem elim_pure_glide_field_distance_C15 : ∀ (W D loss Lift : ℝ), 0 < W → 0 < D → Lift = W → Lift / D ≤ (437 / 100 : ℝ) → W * (8 : ℝ) = (1 - (0 : ℝ)) * D * (50 : ℝ) + loss"),
    F("Aquarium leaps of flying fish were estimated at 3.9 to 5.2 m/s.", MK, 'high', "the flying fish were estimated to leap from the water surface at speeds of 3.9 to 5.2 m s-1 in our study"),
    F("The same paper quotes older field work: leap about 10 m/s, glide up to 50 m (second-hand).", MK, 'medium', "about 10 m s-1 and glide for up to 50 m using their"),
    F("In one flying-fish species, body mass grows slower than the cube of length and fin area slower than the square, so wing loading rises with size (exponents 2.981, 1.834, 1.236).", DV, 'high', "Exocoetus obtusirostris shows negatively allometric growth in relation to standard length in terms of body mass (b=2·981), and lateral fin area (b=1·834). In consequence, wing-loading rises in positive allometric fashion with standard length (b=l·236)."),
    F("Wind-tunnel work on flying-fish models found that the pelvic (rear) fins add lift.", PC, 'high', "The role of the pelvic fins was found to increase the lift force and lift-to-drag ratio"),
    F("A computer simulation of a flying fish model gave max L/D 4.7 and a glide up to 45.4 m reaching 13.2 m height.", DG, 'high', "The results show that the flying fish can achieve a distance up to 45.4 m, and reach a height of 13.2 m"),
    F("The simulation authors say their numbers agree with earlier experiments.", DG, 'high', "Our numerical simulations are consistent with previous experimental results and theoretical prediction"),
    F("A machine-found pattern: every measured flying fish has pectoral fin length / body length of at least 0.406, other measured beloniform fish at most 0.389 (n=49 vs 60).", R + 'registry/discovered/index.json', 'high', "Every measured flying fish has pectoral/SL at least 0.406, and every measured non-flying-fish beloniform (…) at most 0.389: the groups do not overlap (n = 49 flying fish, 60 others)."),
    F("That fin-ratio pattern is a candidate law, not an accepted one.", R + 'registry/discovered/index.json', 'high', '', 'fate.status=candidate'),
    F("Pectoral fin length grows as body length to the power 1.058 (95% CI 1.017 to 1.099, n=49).", R + 'registry/discovered/index.json', 'high', "pectoral fin length scales with standard length as SL^b with the exponent inside its 95% CI [1.017, 1.099] (OLS on log-log, n = 49, b = 1.058, r^2 = 0.983)"),
    F("The mass-exponent pattern for one flying-fish subspecies is very wide (0.478 to 1.484, n=14).", R + 'registry/discovered/index.json', 'medium', "body mass scales with body length as L^b with b inside its 95% CI [0.478, 1.484] (OLS on log-log, n = 14 specimens, b = 0.981, r^2 = 0.601)"),
    F("In the older upstream copy (1.6.0) three of seven certificate files call lemmas that are not defined there, so they would not compile as shipped.", A + 'scout-flyingfish.json (earlier scout); I did not re-run it', 'low'),
    F("The earlier scout's figure of 22.3 m at 10 m/s counted launch speed as free height; the design corrects it to about 0.65 m using the stall floor.", A + 'design-flyingfish.json; 0.65 m reproduced in calc.py', 'medium', '', '22.3 m (scout) vs 0.65 m (design)'),
    F("No result for the new glide test exists yet: the design is a plan with predictions fixed in advance.", A + 'design-flyingfish.json; no flying-fish results folder found under tracks/', 'medium'),
    F("The earlier scout found no public raw dataset of flying-fish glide tracks; every field distance and speed is second-hand.", A + 'scout-flyingfish.json (could_not_find)', 'medium'),
]
steps = [
    "1. Pick a claim to test, such as 'a flying fish can glide 50 metres'. Think of a referee who says: show me the numbers first. [framework: " + ELIM + "]",
    "2. Write down a few simple physical rules that cannot be broken, like 'you cannot get more glide distance than the energy you start with'. It is like knowing you cannot bake more cookies than your dough allows. Each rule is written in a proof language called Lean so a computer can check it. [" + ELIM + "]",
    "3. Measure the animal. Researchers put a model fish in a wind tunnel and measured its lift and drag. We use those measurements for the weight, wing area, and best glide ratio of 4.37. [Park and Choi 2010; physics/glide-data.csv]",
    "4. Add the stall floor. Like a bicycle that tips over below a certain speed, a wing cannot hold up the weight below a minimum speed. For the model fish that speed works out to about 9.85 m/s. [calc.py]",
    "5. Write the claim down as exact numbers, with a range if unsure. The program does not guess. If a needed number is missing, it says 'cannot rule' rather than 'fine'. [" + ELIM + "]",
    "6. Let the computer look for a contradiction. If the claim and the rules cannot both be true, Lean checks the proof and the answer is 'eliminated'. If none is found the answer is only 'consistent', meaning 'not ruled out', like an alibi that has not been broken, which is not proof of innocence. [" + ELIM + "]",
    "7. Fix the predictions in writing before looking at new data, like a bet placed before the race. The plan has six predictions, for example that a simulated glide with a 13.2 m peak starts no slower than 16.1 m/s. [design-flyingfish.json]",
    "8. Check against real or simulated results: the simulation paper's tracks, the aquarium leaps of live fish, and later a 3D-printed glider thrown at measured speeds. [design-flyingfish.json; Deng 2019; Makiguchi 2013]",
    "9. Check the checker. Run it on real animals that are known to behave normally. If it flags one, the rules are too strict, as happened with law set 1.6.0, and the rules get fixed in a new version. [CHANGELOG 1.7.0 and 1.8.0]",
    "10. Publish all results, including failures, and reuse the same kit for the other five tracks. [design-flyingfish.json step 10]",
]
wrong = [
    "The idea that the energy limit holds even for launches that fly up and arc is wrong if any simulated or measured flight goes farther than the limit (ratio above 1.00). Then the rule is narrowed to level glides only. [design P2]",
    "Wrong if a simulated glide with a 13.2 m peak turns out to start slower than 16.1 m/s, or if any peak exceeds the speed-based limit by more than 2%. [design P1]",
    "Wrong if any aquarium leap is in the air longer than 0.5 s, because the plan says these slow leaps are short hops, not glides. If the paper does not list times, the answer is 'cannot test'. [design P3]",
    "Wrong if more than 1 of 30 thrown printed gliders lands farther than 1.10 times the limit, or if the best flight at every speed reaches under half the limit (true but useless). [design P5]",
    "The pipeline itself is wrong if a certificate fails to compile or a verdict differs from the six listed in advance. That is a bug report, not a fact about fish. [design P4]",
    "The rules are wrong if they flag a healthy, normally gliding flying fish as impossible. [design P6; CHANGELOG 1.7.0]",
]
could = [
    "Repairs may be needed: in the older upstream copy (1.6.0) some certificate files call lemmas that are not defined there. I did not run a Lean build. [scout]",
    "The model fish is one preserved specimen in a tunnel at 12 m/s; a live fish with flexible fins may lift better. At C_Lmax 1.03 the stall speed falls from 9.85 to about 8.6 m/s, so the 0.65 m figure would be about 6 m. [calc.py; design risks]",
    "Field distances and speeds (50 m, 10 m/s, 15 to 20 m/s) are quoted second-hand and no public raw trajectory data was found. [scout]",
    "The energy-limit lemma is proved only for steady glides where lift equals weight. A launch with a nearly weightless arc might beat it, which is exactly what prediction P2 tests. [design M3]",
    "Two law-set versions (1.6.0 upstream, 1.8.1 here) give different verdicts on some real fish, so results must say which was used. [CHANGELOG]",
    "A proof holds only under its stated assumptions. 'Eliminated' means 'inconsistent with these rules', not 'impossible in nature'. [ELIM README limits]",
    "A printed resin glider is heavy and brittle; if its stall speed is above about 8 m/s the test needs a long hall and may be underpowered. [design risks]",
    "Many answers are 'cannot rule': 23 of 44 open-problem candidates were untouched by any theorem. [ledger.open-problems.json]",
]
glossary = [
    ("Lean", "A computer language in which a mathematical proof is written and checked line by line, with no room for hand-waving."),
    ("Theorem", "A statement that has been proved from stated assumptions."),
    ("Law (in this project)", "A rule from biology or physics written precisely enough to be tested; each has a status such as accepted, candidate or contested."),
    ("Law set", "A numbered, frozen bundle of laws, like a software release; the project uses 1.8.1."),
    ("Elimination certificate", "A computer-checked proof that a specific claim contradicts the rules."),
    ("Consistent", "Not ruled out by the rules; it does not mean the claim is true or possible."),
    ("Cannot rule", "The honest answer when a needed number is missing."),
    ("Lift-to-drag ratio (L/D)", "How many metres a glider moves forward for each metre it sinks; 4.37 means about 4.4 m."),
    ("Stall speed (minimum speed)", "The slowest speed at which wings can still hold up the animal's weight."),
    ("Wing loading", "Weight divided by wing area, in newtons per square metre."),
    ("Ground effect", "Extra lift and less drag when flying very close to a surface such as the sea."),
    ("Pre-registration", "Writing down predictions and how you would count them as wrong before seeing the data."),
    ("False positive", "A flag that says something is wrong when it is actually fine."),
]
qa = [
    ("Why a flying fish and not something more useful?", "It is a test case with real measurements (wind tunnel, simulation, live-fish leaps) and a clear physical limit, so the method can be checked before it is used on harder problems such as new materials. The same kit is meant to be reused for the other tracks. [design-flyingfish.json step 10; tracks/BRIEF-2026-11-12.md]"),
    ("Does the computer prove that flying fish fly?", "No. Everyone knows they glide. What the work does is check whether specific numbers people claim, such as distance or power, fit the physical rules. Powered, aerobic flight is ruled out in all 3 ledger cases, while a normal glide is not. 'Not ruled out' is never 'proved'. [ledger.physiology.json; ELIM README; CHANGELOG 1.7.0]"),
    ("Has this already been tested and passed?", "Not the new glide test. The framework exists and its examples are checked by Lean (13 of 18 sample claims eliminated). The new energy-based glide test is a written plan with predictions fixed in advance, and has no result yet. Also, the data on real glides is mostly second-hand. [design-flyingfish.json; scout could_not_find]"),
]
table = [
    dict(name="Law set in use", fields="version=1.8.1; laws=59; created=2026-11-01", source=R + 'registry/lawsets/lawset-1.8.1.json'),
    dict(name="Model fish L3 (Cypselurus hiraii)", fields="mass=0.06 kg; wing_area=0.012688 m2; C_Lmax=0.78; L/D_max=4.37; tunnel_speed=12 m/s", source="physics/glide-data.csv; " + PC),
    dict(name="Stall speed of L3", fields="v_min=9.85 m/s; wing_loading=46.39 N/m2; air_density=1.225 kg/m3 (unverified background)", source=CALC),
    dict(name="Level glide bound, L3", fields="10 m/s=0.65 m; 15 m/s=28.5 m (33.1 with ground effect 14%); 20 m/s=67.5 m (78.4)", source=CALC),
    dict(name="Live-fish aquarium leap", fields="speed=3.9-5.2 m/s; pitch=20.0 +/- 3.3 deg", source=MK),
    dict(name="CFD flying fish model", fields="C_Lmax=1.03; L/D_max=4.7; distance=45.4 m; height=13.2 m", source=DG),
    dict(name="Ledger: examples", fields="candidates=18; eliminated=13; consistent=4; unconstrained=1", source=R + 'eliminate/ledger.json'),
    dict(name="Ledger: flier", fields="candidates=3; eliminated=1; consistent=2", source=R + 'eliminate/ledger.flier.json'),
    dict(name="Ledger: physiology", fields="candidates=3; eliminated=3", source=R + 'eliminate/ledger.physiology.json'),
    dict(name="Ledger: open problems", fields="candidates=44; eliminated=2; consistent=19; unconstrained=23", source=R + 'eliminate/ledger.open-problems.json'),
    dict(name="Fin-ratio gap", fields="flying_fish_min=0.406 (n=49); other_beloniform_max=0.389 (n=60); status=candidate", source=R + 'registry/discovered/index.json'),
]
lay_summary = ("We are testing a way to check animal and design claims with computer-checked math. Think of a referee who will not accept 'the fish glided 50 metres' until the numbers fit physical rules, like not getting more cookies than the dough allows. The test case is the flying fish, because its wings have been measured in a wind tunnel and in simulations. The checker says 'ruled out', 'not ruled out', or 'cannot tell', and it never says 'proved'. The framework works and is checked by a proof program, but the newest glide test is still a plan with predictions written down in advance, so it has no result yet.")
what = ("What we are doing and why: we are building a referee for biological and engineering claims. Each claim is written as exact numbers and compared with physical rules that a proof-checking program (Lean) has verified. We use the flying fish as the practice case because its wings were measured in a wind tunnel, simulated on computers, and its leaps recorded in an aquarium. The aim is a reusable kit that can say 'this claim breaks a rule', 'this claim is not ruled out', or 'we cannot tell', and that is honest about the difference between the last two. The kit is then to be reused for the project's other five tracks. The next step, still a plan, adds the energy a fish carries when it leaves the water, plus the minimum speed a wing needs, and states predictions before looking at new data.")
out = dict(
    label='t6-flyingfish-lay', topic='Track 6 plain-language explanation material',
    summary=what + "\n\nSTEPS:\n" + "\n".join(steps) + "\n\nWHAT WOULD COUNT AS WRONG:\n- " + "\n- ".join(wrong) + "\n\nWHAT COULD GO WRONG:\n- " + "\n- ".join(could) + "\n\nQUESTIONS A LAYPERSON WOULD ASK:\n" + "\n".join("Q: %s\nA: %s" % x for x in qa),
    lay_summary=lay_summary, findings=findings,
    key_claims=[
        dict(claim="An elimination answer is one of three, and 'consistent' never means 'possible'.", source=ELIM, evidence_quote="* **consistent**: not ruled out by this constraint. It is not a claim that the candidate is possible."),
        dict(claim="The older law set 1.6.0 wrongly flagged real gliding flying fish; the current set 1.8.1 fixes it by rescoping.", source=CL, evidence_quote="Prompted by E3 and C14 firing red on real Park and Choi flying fish making ordinary glide claims"),
        dict(claim="With the measured model fish (mass 0.06 kg, area 0.012688 m2, C_Lmax 0.78) the stall speed is 9.85 m/s, so a 10 m/s launch buys under 1 m of level glide in the proposed model; this is a plan, not a result.", source=CALC + ' with physics/glide-data.csv', evidence_quote=''),
        dict(claim="Live-fish aquarium leaps were estimated at 3.9 to 5.2 m/s.", source=MK, evidence_quote="the flying fish were estimated to leap from the water surface at speeds of 3.9 to 5.2 m s-1 in our study")],
    reproduce=[
        dict(what="Ledger counts", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-lay/ledgers.py", expected="examples 18/13/4; flier 3/1/2; physiology 3/3/0; open-problems 44/2/19; lawset 1.8.1 with 59 laws (Python 3)"),
        dict(what="Stall speed and glide bounds", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-lay/calc.py", expected="vmin 9.854; 10 m/s 0.646 m; 15 m/s 28.49/33.12; 20 m/s 67.47/78.45; 50 m needs 17.03 m/s"),
        dict(what="Verify DOIs resolve", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-lay/crossref.py 10.1242/jeb.046052 10.3354/ab00494 10.1017/s0025315400048761 10.1007/bf00044128 10.1088/1748-3190/ab23e6", expected="OK lines with titles; Crossref may answer HTTP 429 when rate-limited, retry after a few seconds"),
        dict(what="Live-fish leap speed", command_or_url=MK + " (abstract)", expected="3.9 to 5.2 m s-1; my copy: 212919 bytes, sha256 f0bc4054c091d9661ba2123c539c1095498f8fcdb8d88a71b587ca86b7313f3b, fetched 2026-11-12, at D:/Users/ashenoy00000/delphi-work/agents2/scratch/t6-flyingfish-lay/mak.pdf"),
        dict(what="CFD abstract", command_or_url=DG, expected="abstractText containing 'distance up to 45.4 m' and 'height of 13.2 m'"),
        dict(what="Changelog", command_or_url="read " + CL + " sections 1.7.0, 1.8.0, 1.8.1", expected="text as quoted"),
        dict(what="Rebuild this report", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-lay/build.py", expected="prints ok and rewrites agents2/t6-flyingfish-lay.json")],
    citations=[
        dict(authors="Park H, Choi H", year=2010, title="Aerodynamic characteristics of flying fish in gliding flight", doi_or_arxiv="10.1242/jeb.046052", venue="J Exp Biol", verified=True, how_verified="Crossref works API record (after one HTTP 429 retry) and Europe PMC abstract fetched 2026-11-12", used_for="wind-tunnel model data; pelvic fins add lift"),
        dict(authors="Deng J, Zhang L, Liu Z, Mao X", year=2019, title="Numerical prediction of aerodynamic performance for a flying fish during gliding flight", doi_or_arxiv="10.1088/1748-3190/ab23e6", venue="Bioinspiration & Biomimetics", verified=True, how_verified="Crossref record and Europe PMC abstract fetched 2026-11-12", used_for="L/D 4.7, 45.4 m and 13.2 m simulation"),
        dict(authors="Makiguchi Y, Kuramochi K, Iwane S, Kojima T, Naito Y", year=2013, title="Take-off performance of flying fish Cypselurus heterurus doederleini measured with miniature acceleration data loggers", doi_or_arxiv="10.3354/ab00494", venue="Aquatic Biology", verified=True, how_verified="Crossref record fetched and open PDF downloaded, text read 2026-11-12", used_for="live-fish leap speeds"),
        dict(authors="Davenport J", year=1992, title="Wing-loading, stability and morphometric relationships in flying fish (Exocoetidae) from the North-eastern Atlantic", doi_or_arxiv="10.1017/s0025315400048761", venue="J Mar Biol Assoc UK", verified=True, how_verified="Crossref record with abstract fetched 2026-11-12", used_for="size scaling of fins and wing loading"),
        dict(authors="Davenport J", year=1994, title="How and why do flying fish fly?", doi_or_arxiv="10.1007/bf00044128", venue="Rev Fish Biol Fisheries", verified=True, how_verified="Crossref record fetched 2026-11-12 (no abstract returned)", used_for="background only; not used for a number"),
        dict(authors="Daane JM et al. (author list not checked)", year=2021, title="Novel regulators of growth identified in the evolution of fin proportion in flying fish (preprint)", doi_or_arxiv="10.1101/2021.03.05.434157", venue="bioRxiv", verified=True, how_verified="appeared in a Crossref bibliographic search result 2026-11-12 with this title and date; abstract not read", used_for="source named for the fin-ratio measurements; title only")],
    could_not_find=[
        "Any public raw dataset of flying-fish glide tracks: all field distances and speeds are second-hand (earlier scout, not re-searched).",
        "A Lean build was not run; compile claims rest on the earlier reports and on reading the ledgers.",
        "Full text of Park and Choi 2010 and Deng 2019 was not re-read; wind-tunnel numbers come from the project's own cached reading in physics/glide-data.csv.",
        "The design's predictions P1 to P6 are a plan; I found no folder with results for them.",
        "I did not re-verify the upstream 14 vs 33 lemma comparison; it is quoted from the earlier scout (low confidence).",
        "Genotype ledger: 6 kernel-checked but 5 eliminated; I did not investigate the difference.",
        "Resources: D: had about 9.3 GB free; I downloaded one 213 KB PDF only."],
    glossary=[dict(term=a, plain=b) for a, b in glossary],
    recommendations=["Stamp results with both law set versions (1.6.0 and 1.8.1) until a human chooses.", "Write predictions down before opening the Deng and Makiguchi data.", "Say 'not ruled out' rather than 'passes' in any public text."],
    table=table, scripts_written=['crossref.py', 'calc.py', 'ledgers.py', 'build.py'])
os.makedirs('D:/Users/ashenoy00000/delphi-work/agents2', exist_ok=True)
json.dump(out, open('D:/Users/ashenoy00000/delphi-work/agents2/t6-flyingfish-lay.json', 'w', encoding='utf8'), indent=1, ensure_ascii=False)
print('ok', len(findings))
