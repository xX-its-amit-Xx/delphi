"""Prose blocks for t4-glide-deep. Tags: [M]=measured (a source reports it, or I re-read it from a data file), [D]=derived (calculation, script named), [A]=assumed (a model choice or an input nobody measured)."""

SUMMARY = """
SCOPE. System: 3D-printed double-winged autorotating fruits (Fauli, Rabault, Carlson, Oslo) plus their blade-element model. Question: does a body or fin constraint (here: fixed wing mass and length, only curvature free) set how slowly a passive body can sink, and can a published model say how before anything is built? Note the limit: a spinning fruit is a SINK-RATE surrogate, not a forward glide. For forward glide the closest model is the quasi-steady plate glider (Li 2022; Pomerenk and Ristroph 2025), covered in section 6.

1. THE SCIENCE FROM THE GROUND UP
1.1 A body falling through air or water speeds up until drag and lift on it balance its weight; then it moves at a steady terminal speed. [A: definition]
1.2 Most of the weight a surface can hold up comes from how much fluid it pushes down. A big light wing falls slowly. The simple rule: speed U goes as the square root of (weight / swept area), called wing loading. [D: momentum argument stated in Fauli 2019 and Rabault 2019; M: wild fruits follow it as groups]
1.3 A wing that spins (autorotates) keeps moving through the fluid even while the body drops slowly, so its wing tips meet fast flow and give lift. Near the axis the lift tilts forward and pushes the spin; near the tip drag brakes it. Spin settles where these torques cancel. [D: blade-element argument, PRE section 'Blade element model']
1.4 Why a spinning wing lifts more than a flat plate: a stable vortex sits on its leading edge and adds lift (the leading-edge vortex, LEV). [M: robotic-model flow measurements, Lentink 2009 abstract]
1.5 Two dimensionless numbers describe the motion. Reynolds number Re = U L / nu compares inertia to viscosity; Strouhal number St = f L / U compares spin speed to sink speed. A water tank can imitate air if Re and St match. Fruits: Re about 2400-14000, St 0.35-0.82. [M: PRE Table I; D: I recomputed Re and found one table entry (14000) does not follow from its own speed range (12000)]
1.6 The blade-element model cuts each wing into thin strips. Each strip sees a wind made from the sink speed and the spin speed, at an angle of attack; lift and drag coefficients from earlier robot-wing work give the force. Setting total vertical force = weight and total spin torque = 0 gives U and f. Because the coefficients do not depend on Re in this model, torque balance fixes St from geometry alone, and U goes as the square root of weight. [D: PRE; M: measured St is constant per geometry within about 5 percent (PRE); an earlier agent reported U-squared linear in lead mass with R-squared 0.992-0.997 in 10 of 11 series, which I did not recheck]
1.7 The geometry knob is the fold angle KL (wing length times curvature, radians). Too flat: wing tips lie at a steep angle and make little lift. Too curled: the lifting part moves toward the axis where the wind is slow. In between is a minimum sink speed. [D/M: PRE, PRL] The base angle psi (wing root tilt from vertical) moves the optimum: larger psi, smaller best KL. [M: tank optimum about 2.3 at psi=0, about 1.2 at psi=35]

2. WHAT IS ESTABLISHED WITH NUMBERS
- Tank optimum fold angle about 2.3 (psi=0) and about 1.2 (psi=35) [M, PRE]. Re-read from the public data file at the 2.16 g lead key: psi=35 speed 0.0676 (KL 1.20), 0.0674 (1.33), 0.0693 (1.50), 0.0710 (1.71), 0.126 m/s (KL 0.06); psi=0: 0.1011 m/s at KL 2.31 against 0.1137 (1.71), 0.1258 (3.00), 0.1678 (0.92) [M, own script analyze_repo.py].
- Model optimum: KL 2.05 (psi=0), 1.80 (psi=15), 1.31 (psi=35); minimum Re 4709, 4352, 3900 [M: stored model files]. The psi=15 case has never been run in a tank, as far as I found.
- Wild whirling fruits have mean fold angle 1.8 with 10 percent image error, n=27 [M, PRL], i.e. equal to the model optimum for psi=15 (1.80) and above the one for psi=35 (1.31); the paper does not report each fruit's base angle, so the match is not tested per fruit.
- Maple-type samaras: printed copies match natural descent within one standard deviation (1.28 vs 1.10 m/s), descent factor DF about 3 [M, Nave 2021]; my recomputation gives DF 2.82 (natural) and 3.17 (printed) at assumed air density 1.225 kg/m3 [D].
- Plate glider: maximum glide ratio 3.8 at centre of equilibrium about 0.22 chord [M: model output reported by Pomerenk and Ristroph; this is a model number, not an experiment]; arctan(1/3.8) = 14.7 deg [D].
- Field dispersal of 13 dipterocarp species from a 30 m tower: median 4 m, 90 percent within 10.5 m [M, Smith 2015].

3. KEY EXPERIMENTS AND MODELS IN ORDER
1973 Norberg: momentum theorem plus blade-element analysis of single-winged fruits; flat-plate tests at Re about 2000 show pitch stability for centre of mass 27-35 percent of chord behind the leading edge [M, abstract only]. 1986 Augspurger: terminal velocities of wind-dispersed fruits of neotropical trees (the dataset the dipterocarp work leans on; not read). 1987 Azuma and Okuno: Alsomitra seed flight (not read; its 0.3-0.7 m/s glide descent rate is quoted second-hand). 1997 Yasuda and Azuma: autorotation boundary (not read). 1999 Dickinson, Lehmann, Sane: three unsteady mechanisms of insect wings (delayed stall, rotational circulation, wake capture). 2004 Wang, Birch, Dickinson: 2D computation versus robotic-wing forces, the source of the CL, CD fits the fruit model reuses. 2009 Lentink et al.: LEV on dynamically scaled maple and hornbeam seeds. 2010 Ulrich et al.: robotic samara. 2014 Looy and Stevenson: autorotating seeds in Permian conifers. 2015 Smith et al.: field dispersal of dipterocarps. 2015 Sunada et al.: lift-drag ratio controls descent factor. 2019 Fauli et al. and Rabault et al.: the system studied here. 2021 Nave et al.: printed maple samaras. 2022 Li et al.: plate with moving centre of mass flutters, tumbles, glides, dives. 2023 Jung and Rezgui: blade-element-momentum model of samaras with LEV lift models. 2024-2025: origami fruits with folding and flexibility (Cai et al., not read), number of wings (Liu et al.), linden stalk (Cazaubiel and Carlson), falling bent plates (Loo and Alben), plate equilibria and stability (Pomerenk and Ristroph).

4. WHAT IS CONTESTED OR UNRESOLVED (both sides stated)
(a) Lift law. The Letter (PRL) says CL = 2 sin(alpha) adjusted for intermediate Re; the long paper (PRE) and the code use a hovering-wing fit CL = 0.225 + 1.58 sin(2.13 alpha - 7.2 deg). The code's own comment says the formula in the source paper may have a sign error. A stall-type parametrization in the PRE supplement gives reasonable Re but worse St. [M]
(b) The model is partly tuned. The authors halve the published drag to match experiment (PRE), and the 'mass loading' of 1.2 g in the model is not the lead key in the data (2.16 g), so absolute speed is not independently predicted. [M]
(c) Between-angle offset. Model best-speed ratio psi=0 over psi=35 is 4709/3900 = 1.21; tank data give 0.1011/0.0676 = 1.50 [D]. An earlier agent found the same disagreement with a different method (design-glide.json: 1.22 vs 1.40-1.50).
(d) Lab range. Table I says Re up to 14000; its own speed range gives 12000 [D]. Unknown which is right.
(e) Error bars in the paper are 5 standard deviations and n is 3 at psi=35; the minimum is flat over KL 1.2-1.5 so the optimum location is uncertain by at least 0.2-0.3 [D from the data file].
(f) Is slowest descent what selection favours? Smith 2015 finds dispersal distance depends on wing loading and wind, but the simple drift model (wind x height / sink speed) over-predicts the fitted-model distances by 4.1-8.0 times (median 6.9) [D from Smith Table 3; the tabulated drift model uses regression descent speeds from Augspurger 1986 and a constant wind]. Fold angle has not been linked to field dispersal.
(g) LEV lift model for rotating wings: normal-force versus Polhamus forms are both used (Jung and Rezgui 2023, abstract only).

5. OPEN PROBLEMS
Blade-element model with induced inflow (no public version tested); full 3D numerical flow for double-winged fruit at Re 2000-14000; psi=15 and psi=55 and pitch variations (the PRE-fixed pitch 15 deg and camber 2.5 deg are 'inspired by' wild fruits but could not be measured, they dry and curl); flexibility (Cai 2024, not read); stalk and centre-of-mass control of the onset of autorotation (Cazaubiel and Carlson 2025, preprint); relation of fold angle to field dispersal; stability of the autorotating state at large psi (coning, tumbling).

6. FORWARD-GLIDE LINK (the body/fin constraint proper)
For a surrogate that must glide forward, the best-supported model is the 2D quasi-steady plate glider of Li 2022 / Pomerenk and Ristroph 2025: centre of equilibrium about 0.1-0.3 chord glides, beyond about 0.3 dives, max glide ratio 3.8 [M model output]; it is 2D and tested for slenderness 0.001-0.1 [M]. Engineered Javan-cucumber-inspired gliders reached 9.5-13.6 deg glide angles = glide ratios 4.1-6.0 [D from Wiesemuller Table 2]. I found no raw public trajectories for either.

7. LAW LIBRARY (set 1.8.1, read only)
flight-climb-glide-law (glide range <= h x (L/D)max; hash identical to 1.6.0), perturb-wind-glide (needs horizontal airspeed > 0), [claim id withheld] (vmin_le), flight-allometry-law, scaling laws. None covers autorotation. vmin_le applied naively to a samara with the model's peak CL 1.805 is violated (1.37 vs 1.10 m/s) because an autorotating wing is not in steady freestream flight: the law must not be used as a cut here without an effective CL,max near the descent factor 2.8-3.2 [D]. Law E1 is flying-fish only and internally inconsistent (2.981 - 1.834 = 1.147 vs 1.236). A wind-drift identity range = w h / s survives (22 m for h=30, w=1.72, s=2.35) but is loose by about 5.7x for the species tested [D].

8. WHAT THIS ADDS TO THE EARLIER SCOUT, DESIGNER AND LAW-MAPPER
Newer literature (2024-2025); field-ecology anchor (Smith 2015) with a computed bound-looseness; the 14000 vs 12000 Re discrepancy; the CL-law disagreement between the two papers; samara descent factor recomputed; law set 1.8.1 check (flight laws unchanged from 1.6.0) and the vmin_le scope failure; E1 inconsistency; independent re-reading of the public data.
"""

LAY = ("Some tree fruits have two curved wings and spin like a helicopter blade as they fall, which slows their fall so wind can carry them away. "
       "Researchers in Oslo 3D-printed copies of such fruits and dropped them in a tall tank of water, where the flow behaves like fast air. "
       "They found that the wings fall slowest when they are curved by a particular amount, and that real tropical fruits are curved by about that amount. "
       "A simple computer model that cuts each wing into thin strips predicts this best curve fairly well, but it is partly tuned and it misses the size of the change when the wing root is tilted. "
       "Think of a sycamore seed: too flat and it plummets, too curled and its lifting part sits near the middle where the air is slow. "
       "This is a test of how slowly something can sink, not how far it can glide sideways, and the field data show real fruits land much closer to the tree than a simple wind-drift sum predicts.")

GLOSSARY = [
 ('autorotation', 'spinning of a falling wing driven only by the air or water flowing past it, like a sycamore seed'),
 ('terminal velocity / terminal descent speed', 'the steady speed a falling body reaches when drag and lift balance its weight'),
 ('wing loading', 'weight divided by wing (or swept) area; low means floaty'),
 ('swept area / disk area', 'the area of the circle the spinning wing tips trace'),
 ('fold angle KL', 'wing length times its curvature, in radians; how much the wing curls from root to tip'),
 ('base angle psi', 'tilt of the wing root away from vertical'),
 ('blade-element model', 'a calculation that cuts a wing into thin strips, finds the force on each, and adds them up'),
 ('lift and drag coefficients', 'numbers saying how much sideways (lift) and backward (drag) force a wing strip makes at a given angle'),
 ('angle of attack', 'angle between the wing strip and the oncoming flow'),
 ('Reynolds number (Re)', 'a ratio showing whether inertia or stickiness (viscosity) dominates the flow'),
 ('Strouhal number (St)', 'spin rate times wing length divided by sink speed; how far the wing turns per unit of fall'),
 ('leading-edge vortex (LEV)', 'a small whirl of air stuck to the front top edge of a wing that adds lift'),
 ('diaspore / seed dispersal unit', 'a seed or fruit together with whatever wings or hairs help it travel'),
 ('descent factor DF', 'a dimensionless measure of how well a seed holds itself up; here equal to 2 x wing loading / (air density x speed squared)'),
 ('glide ratio (L/D)', 'distance travelled forward per unit height lost'),
 ('centre of mass / centre of equilibrium', 'the balance point of the weight (corrected for buoyancy in water)'),
 ('quasi-steady model', 'a force model that uses only the body\'s current position and speed, not the history of the flow'),
 ('dynamic similarity', 'matching Re and St so a water test imitates an air flight'),
 ('stereolithography (SLA)', 'printing by curing liquid resin with light'),
 ('IWL (inverse wing loading)', 'wing area divided by mass'),
 ('ballistic drift model', 'distance = wind speed x drop height / sink speed'),
 ('measured / derived / assumed', 'measured: a source reports it or I re-read it from a data file; derived: my arithmetic, script named; assumed: an input nobody measured'),
 ('Lean law set', 'the project\'s library of machine-checked statements used to rule out impossible designs'),
 ('sha256', 'a fingerprint of a file; any change to the file changes it'),
 ('dipterocarp', 'a family of tall tropical forest trees with two- to five-winged fruits'),
 ('preprint', 'a paper posted before peer review'),
]
