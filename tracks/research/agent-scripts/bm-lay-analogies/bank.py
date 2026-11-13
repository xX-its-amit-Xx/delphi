# The explanation bank (plain-language entries). Imported by build_result.py.
# Numbers marked [calc] come from calc.py / calc_out.json; [rec] = project record (earlier agent files).
BANK = [
 {
  "id": "E1-pine-cone",
  "topic": "Why a pine cone opens when it dries",
  "explanation": (
   "Each scale of a pine cone is two layers stuck together. The outer layer is made of long, thick-walled cells that get longer when they take up moisture and shorter when they dry. The inner layer hardly changes size. When the air dries, the outer layer shrinks and the inner one does not, so the scale is forced to curve outward and the cone opens. When the cone gets wet, the outer layer lengthens again and the scales close. Fallen cones are dead wood, so no living cell is doing the work: it is purely swelling and shrinking of dry material."),
  "everyday_comparison": "A strip of plastic tape stuck along one side of a sheet of paper: the paper takes up and loses moisture, the tape does not, and the sheet curls.",
  "where_it_breaks": (
   "The paper-and-plastic version was built by the cone researchers as a copy (it curls on drying and straightens on wetting), so it is a fair model of the mechanism. It breaks on size and speed: the cone's cells change length by about 10 percent between dry and saturated air (0.001 per percent of relative humidity x 100 [calc]), far more than a stock printed resin manages (a few tenths of a percent), and the cone opens more slowly than it closes (drying time 96 h_a^1.5 min against wetting 29 h_a^1.3 min, h_a in mm)."),
  "common_wrong_idea": "Wrong: the cone is alive and opens on purpose when it senses rain or warmth. Right: it opens when DRY and closes when WET, and it does so even when dead.",
  "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/ (Reyssat and Mahadevan 2009, doi 10.1098/rsif.2009.0184)",
 },
 {
  "id": "E2-bilayer-bimetal",
  "topic": "Why two layers that swell unequally bend, like a bimetal strip",
  "explanation": (
   "A bimetal strip is two metals bonded face to face that expand by different amounts when heated. The layer that wants to grow longer cannot slide past its partner, so the whole strip bends, with the longer-growing layer on the outside of the curve. A water-driven bilayer works the same way, except moisture instead of heat makes one layer change size. Only a difference in change is needed, so the second layer can simply stay put, as the inner layer of a pine-cone scale does. The bend is much larger than the tiny stretch that causes it, because a long thin strip turns a small length difference into a large sideways swing. The same equation, worked out by Timoshenko in 1925 for thermostats, is used for both."),
  "everyday_comparison": "Two runners on a curved running track: the runner in the outer lane has a longer path, so if two lanes are tied together the longer one must sit on the outside of the bend. A thermostat or dial thermometer is the real-world example.",
  "where_it_breaks": (
   "The track picture gives the direction of the bend but not how much. The big break is speed: heat spreads through 1 mm of steel in about 0.05 s (thermal diffusivity 18.8 mm2/s [calc]), but water creeping into a dense resin (D about 1e-12 m2/s) needs about 10 days for the same 1 mm, roughly 19 million times slower [calc]. Also, in a thermostat both metals expand; in a hygromorph usually one layer does the swelling and the other is a passive partner."),
  "common_wrong_idea": "Wrong: one layer must grow while the other shrinks. Right: only a difference in change is needed; one layer can stay the same size.",
  "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/ ; https://en.wikipedia.org/wiki/Bimetallic_strip ; doi 10.1364/JOSA.11.000233",
 },
 {
  "id": "E3-lean-law",
  "topic": "What a 'law' in Lean is",
  "explanation": (
   "Lean is a computer program that checks mathematical proofs. A 'law' in this project is a statement typed into Lean, for example: for any two layers of any thickness and any stiffness, the curl per unit of swelling mismatch can never exceed 3/2 divided by the total thickness. Lean accepts the statement only if there is a chain of steps in which every step follows from earlier results, down to a few basic rules. If one step is missing, Lean refuses, and our check script also fails if a placeholder called 'sorry' was left in. On 12 Nov 2026 we ran the project's file: five theorems, no errors, no placeholders [calc: lean_check_out.txt]."),
  "everyday_comparison": "A strict referee who redoes every line of your arithmetic and will not accept 'it is obvious'.",
  "where_it_breaks": (
   "A referee of the sums does not know whether you wrote down the right problem. Lean checks the mathematics of the formula we typed in; it cannot check that the formula describes a real printed strip. The Lean file's formula was matched by us to two independent published forms (Reyssat 2009 and the 1863 form on Wikipedia, identical to 1e-15 over 200,000 random cases [calc]), but that match is a human check, not a Lean check."),
  "common_wrong_idea": "Wrong: 'checked by Lean' means the physical strip is guaranteed to behave that way. Right: it guarantees the maths of the model; the real strip must also meet the model's assumptions (thin, elastic, small bend, well-bonded layers).",
  "source": "https://lean-lang.org/theorem_proving_in_lean4/introduction.html ; D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean ; doi 10.1007/978-3-030-79876-5_37",
 },
 {
  "id": "E4-proof-vs-simulation",
  "topic": "Why a proof differs from a simulation",
  "explanation": (
   "A simulation tries particular cases and reports what happened. A proof shows something is true for every case at once, including ones nobody tried. We sampled 2 million random layer combinations and the largest curl coefficient found was 1.49999999997, never above 1.5 [calc]. That is strong evidence, but it is not a guarantee. The Lean proof reduces to the fact that a squared number is never negative, so no combination can beat 1.5. Tests can pass for a long time and then fail: the formula n x n + n + 41 gives a prime number for every n from 0 to 39 and fails at n = 40, where it gives 1681 = 41 x 41 [calc]."),
  "everyday_comparison": "Trying a million keys in a lock versus showing from the lock's design that no key of this shape can open it.",
  "where_it_breaks": (
   "A proof only speaks about the model; a simulation or a real print can reveal that the model itself is wrong, which no proof can. For the strip, the published bilayer data are consistent with the proved ceiling (six beech bilayers peak at 1.50-1.53 against 1.5 [rec]) and the 1.53 slightly above the bound shows measurement uncertainty, not a broken proof."),
  "common_wrong_idea": "Wrong: a plot or simulation that never crosses the limit has proved the limit. Right: Holstov et al. (2015) plotted the maximum as 1.5 for many stiffness ratios; the Lean proof is what turns the observation into a certainty.",
  "source": "Holstov 2015 (doi 10.1016/j.conbuildmat.2015.08.136; open copy https://doi.org/10.25405/ncl.34238076) ; own calculation calc.py ; HygromorphCeilingCheck.lean",
 },
 {
  "id": "E5-ceiling-rules-out",
  "topic": "Why a ceiling on curl lets a design be ruled out before printing",
  "explanation": (
   "The proven ceiling says the curl of a two-layer strip, measured as 1/radius, can never exceed 1.5 times the swelling mismatch divided by the total thickness, however the layers are chosen. So if you know how much your materials can swell, you can work out the tightest possible curl before printing anything. A 0.8 mm strip whose layers differ in swelling by 0.2 percent can never curl tighter than a circle of radius 267 mm, a circle about half a metre wide [calc]. To curl to a 50 mm radius the same strip needs at least 1.07 percent mismatch [calc]. A design asking for more is ruled out on paper, which saves a print, a cure and a week of soaking."),
  "everyday_comparison": "A fuel tank and the best possible mileage: no engine can drive farther than tank size times the best mileage physics allows, so you can rule out a 2,000 km trip on 10 litres before building the car.",
  "where_it_breaks": (
   "The ceiling is an upper bound for an idealised two-layer strip, not a promise: real strips reach less (the six beech bilayers scored 0.91 to 1.53 of the 1.5 limit [rec]; a cellulose-acetate film reached 65 percent of it [rec]). It does not cover other structures such as lattices, gradients, or wide plates that curve in two directions, and it rests on the swelling mismatch being known, which for Formlabs resins nobody has measured."),
  "common_wrong_idea": "Wrong: you must print and test to learn whether a shape is possible, or that the 3/2 ceiling is a new discovery. Right: with a known swelling mismatch, a lower limit on the radius is arithmetic; the ceiling itself was already seen in 2015 and its closed form follows from a 1863 formula.",
  "source": "HygromorphCeilingCheck.lean (bilayer_rules_out) ; https://doi.org/10.25405/ncl.34238076 ; https://en.wikipedia.org/wiki/Bimetallic_strip",
 },
 {
  "id": "E6-water-uptake-0.7pct",
  "topic": "What a water uptake of 0.7 percent means",
  "explanation": (
   "Water uptake of 0.7 percent means 100 g of plastic gained 0.7 g of water. A 1 cm cube of printed resin weighs about 1.2 g, so it takes in roughly 8 mg, less than a fifth of a drop [calc]. The water squeezes in between the plastic's molecules and makes the part slightly bigger, by our estimate 0.09 to 0.28 percent in length, about 0.04 to 0.11 mm along a 40 mm strip [calc]. Alone that is invisible, but a thin bilayer magnifies it about 37 times: the tip of a 40 mm long, 0.8 mm thick strip could move 1.3 to 4.2 mm at best [calc]. And 0.7 percent is Formlabs' 24-hour cube test, not the final amount, and it describes one resin: the Flexible 80A V2 data sheet reports +8 percent mass in one day."),
  "everyday_comparison": "A sixth of a drop of water inside a 1.2 g cube; or, scaled up, half a kilogram of water gained by a 70 kg person.",
  "where_it_breaks": (
   "The drop sits on a surface in the picture, but the real water is inside the plastic. A 'drop' is not a fixed volume (about 0.05 mL by convention). Mass percent is not length percent: the conversion is 0.12 to 0.40 percent of length per percent of mass [calc], and we have no measured value for any Formlabs resin in humid air."),
  "common_wrong_idea": "Wrong: 0.7 percent is nothing, so the plastic cannot change shape (or is waterproof). Right: small swelling matters once a thin bilayer amplifies it, but it is also small: a 0.2 percent mismatch caps a 0.8 mm strip at a 267 mm radius.",
  "source": "https://formlabs.com/support/solvent-compatibility/ ; Flexible 80A V2 data sheet https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf ; https://en.wikipedia.org/wiki/Drop_(unit)",
 },
 {
  "id": "E7-thin-is-faster",
  "topic": "Why a thin strip is faster than a thick one",
  "explanation": (
   "Water spreads into plastic slowly, like ink spreading through still water, and the time it takes grows with the square of the distance it must travel. Make the layer twice as thick and, in the ideal case, it takes four times as long; make it half as thick and it takes a quarter. For a dense resin with a water diffusivity of about 1e-12 m2/s, a 0.2 mm layer reaches 90 percent of its final water in about 9 hours, 0.4 mm in about 38 hours, 0.8 mm in about 6 days, and 1.6 mm in about 25 days [calc]. A porous pine-cone layer is about a thousand times quicker (D near 1e-9 m2/s), so a 1 mm layer needs minutes to a couple of hours. The price of being thin is strength: the force a strip can push with falls roughly as the thickness squared [rec]."),
  "everyday_comparison": "Thin fries cook through much sooner than thick wedges, because heat also spreads by the same square-law.",
  "where_it_breaks": (
   "Real objects are not ideal: for pine-cone scales Reyssat and Mahadevan measured exponents of 1.5 for drying and 1.3 for wetting, not 2, so doubling thickness slows the cone by 2.5 to 2.8 times, not 4 [calc]. Cooking adds surface effects and evaporation, so the fries comparison is only the same family of mathematics, and was not tested here. The 1e-12 diffusivity is an order of magnitude from printed dental resin (0.85e-12 m2/s); no value for a Formlabs resin has been measured, so the times could be 3 times longer or shorter."),
  "common_wrong_idea": "Wrong: half as thick means twice as fast. Right: between 2.5 and 4 times as fast, because the time grows faster than the thickness.",
  "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC12986659/ ; own calculation calc.py (Crank series)",
 },
 {
  "id": "E8-stiffer-is-not-better",
  "topic": "Why a stiffer partner layer does not bend the strip more (the modulus ratio drops out)",
  "explanation": (
   "You might expect a much stiffer passive layer to push the strip into a tighter curl. It does not. The best possible curl is the same, 1.5 times the mismatch divided by the thickness, whatever the stiffness ratio, provided you adjust the thicknesses. The recipe is that the stiffer layer is made thinner, by the square root of the stiffness ratio; equivalently stiffness x thickness squared is equal in both layers. If you ignore the recipe you lose curl: with a 10 times stiffness gap and equal thicknesses you get only 66 percent of the maximum [calc]. Make one layer infinitely stiffer than the other and the strip does not bend at all."),
  "everyday_comparison": "A seesaw: a heavy child sits closer to the pivot so that weight times distance balances.",
  "where_it_breaks": (
   "The seesaw is our own gloss on the rule 'stiffness x thickness squared equal': the rule comes from algebra (m squared x n = 1), not from the seesaw. When the layers are about equally thick, stiffness hardly matters (Reyssat: f changes by under 10 percent for stiffness ratios 0.3 to 3.5; we get 0.9 percent at equal thickness [calc])."),
  "common_wrong_idea": "Wrong: stiffer partner, more bend. Right: the match between thickness and stiffness sets the bend, and the ceiling does not depend on the stiffness ratio.",
  "source": "HygromorphCeilingCheck.lean (timoshenkoCoefficient_eq_of_optimal) ; https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/ ; https://doi.org/10.25405/ncl.34238076",
 },
 {
  "id": "E9-liquid-matters",
  "topic": "Why Elastic 50A drinks 39 percent isopropanol but under 1 percent water",
  "explanation": (
   "How much a plastic swells depends on the liquid as much as the plastic. In Formlabs' 24-hour soak test, Elastic 50A V2 gained 39.2 percent of its weight in isopropyl alcohol but only 0.7 percent in water, while Rigid 10K gained under 0.1 percent in both. The stiff resin has little room for any liquid, and the soft rubbery one lets some liquids in and others hardly at all. The practical lesson is that a water-driven design must be checked against every liquid the part meets, including a cleaning bath. The older Elastic 50A V1 took up 25.6 percent isopropanol and 2.3 percent water in the same test."),
  "everyday_comparison": "Salt dissolves in water but not in cooking oil: whether something gets in depends on the pairing.",
  "where_it_breaks": (
   "The resin does not dissolve; the cured network swells and holds the liquid, so 'dissolving' is the wrong picture. The reason one liquid gets in and another does not is general chemistry, not shown in the sources I fetched."),
  "common_wrong_idea": "Wrong: if it ignores water it ignores every liquid. Right: water uptake and alcohol uptake are separate numbers.",
  "source": "https://formlabs.com/support/solvent-compatibility/",
 },
]
