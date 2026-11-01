# Behaviour and physiology scenarios

Five scenario modules: `predator`, `grip`, `sleep`, `daynight` and `digestion`. They are pure ESM files; the only import is `predator.mjs` importing the sibling `glide.mjs`, so the browser engine runs the same code. Each one codes to the interface in `index.mjs` and exports a static `metrics` list. Each also exports a `needs` list of the STATE fields it reads beyond `requires`.

Tests: `node sim-engine/test/scenarios-behaviour.mjs` (102 checks). Every check gets one input it must accept and one deliberately wrong input it must reject. That means each check fails on every run, not just once by hand.

Where the sources come from:

- Every constant came from a fetched page: Europe PMC full text, the PMC article page, an abstract, or the physics thread's OA copy of Makiguchi 2013. "Abstract read" or "secondhand" is noted where that applies.
- JEB (journals.biologists.com) returned 403, so Domenici & Blake 1997, Maie et al. 2012 and Müller & van Leeuwen 2004 could not be read for numbers. None of their numbers are used.
- No bird data is used anywhere.

How to read `kind`:

- `measured`: read in a source that measured it in that organism.
- `measured-secondhand`: a number quoted by a citing paper.
- `borrowed`: a real measurement used for another species or stage.
- `derived`: arithmetic on the above.
- `calibrated`: a lookup value read straight back from its source (harness amendment A1), for example a sleep fraction or the 8 ms latency. It is shown, but it is not a prediction and never counts as a validation.
- `assumed`: a placeholder. It appears only for null metrics, the fixed 26 °C speed reference and what-if overrides.

**Parameter kinds.** A parameter's `kind` describes its default. Slider limits and on/off switches are design choices, so a parameter that is really a choice (K, the visual-angle and latency sliders, the lateral-line, hcrt and hcrtr switches, light hours, surface roughness) is labelled `assumed`, with its source string giving the measured value or range it sits in. The adhesion ceiling of 101.3 kPa is physics: one atmosphere.

**`survives` and `feasible`.** `survives` means one thing in every scenario here: the organism survives the perturbation. `predator` sets it from the evasion geometry, and it is null when the outcome is probabilistic or rests on an unmeasured aerial escape. `digestion` sets it from the energy balance. `grip`, `sleep` and `daynight` leave it null, because they are not survival tests. Whether a behaviour works goes in `feasible`: an aerial escape is available (`predator`), the disc holds the body weight (`grip`), the animal can feed at all (`digestion`).

Zebrafish ages: STATE `ageDays` counts days post-hatching, and zebrafish hatch at 2 dpf (`development/zebrafish/trajectory.mjs`). The scenarios use dpf = ageDays + 2.

---

## predator — addition of a predator

**Model.** The scenario runs five steps.

1. **Startle latency.**
   - Larva: 5.3 ms (Burgess & Granato 2007).
   - Adult: 8 ms. This is a real adult measurement, made inside a paper whose title is about larvae. The Results section says: "Using a vibrational stimulus, we found similar results, with modal latency to startle being 8 ms (Fig. 5F, inset)". It was read on the PMC article page (https://pmc.ncbi.nlm.nih.gov/articles/PMC6672105/), because Europe PMC does not serve that full text.
   - Both values are labelled calibrated, because they are read back from the source. Every other species borrows them.
2. **Peak escape speed.**
   - Larva: an absolute 0.2 m/s peak and 20 m/s² peak acceleration, quoted by Turrini 2023 from Kim 2017 (secondhand). The citing text gives no larval length, so BL/s is computed from the state's own SL. No larval length is assumed.
   - Adult zebrafish: 25.5 body lengths/s, from Danos & Lauder 2012 (read from the Wayback copy of JEB 215:1854). The paper reports a mean maximum Reynolds number of 27,800 for fish of 33 mm total length, which works out to U = 0.842 m/s. The value is applied per SL, which understates it by the SL/TL ratio. It replaces the borrowed pike bound of 11 BL/s, which was half the measured value. Other non-flier species borrow it.
   - Flying fish: 14.6 BL/s, Makiguchi's 3.87–5.15 m/s. That figure is a tail-beat estimate made with Wardle's formula, not a measured speed.
   - Speeds scale with a borrowed muscle Vmax Q10 of 1.5 (smelt, via `physiology/`) around 26 °C. The valid range is 23–28 °C: the escape data come from 23–27 °C (Burgess & Granato) and fish held at 27 °C (McKee & McHenry); Danos & Lauder give no temperature.
3. **Larval outcome.** For larvae the outcome is a measured lookup: P(escape) = 0.70 per strike from an adult zebrafish, or 0.05 with the lateral line ablated (Stewart et al. 2013). survives is null because the outcome is probabilistic.
4. **Post-larval geometry.** This is McKee & McHenry's (2020) looming-stimulus model, built on Weihs & Webb 1984 and Soto et al. 2015.
   - The prey reacts when the predator subtends θ = 14°, after a 0.76 s latency.
   - It flees at its measured mean escape speed, 3.7 cm/s for a 3.6 cm fish, about 1 BL/s.
   - The predator approaches at K times that speed. The closest approach at the optimal escape angle is `d_resp/K`.
   - The fish survives if the closest approach stays outside a strike reach of 2 cm, about 0.56 SL.
   - The critical predator speed ratio is `K* = d_thr/(s + v t_lat)`.
5. **Aerial escape.** This is the **same computation as `glide.mjs`**. The scenario imports its `launchSpeed`, `glidePath` and `glideParts`, uses the same 1 m launch height, and has ground effect on. `aerial_escape_distance_m` is therefore identical to glide's `glide_range_total_m`, and the tests check this at 0, 10, 15 and 20 m/s.
   - **Launch speed.** Taken from glide's `launchSpeed`, and follows any change made there. At writing it is 15 m/s for adult flying fish, the sourced taxi-end airspeed (measured-secondhand: the lower end of the 15–20 m/s range, Davenport 1994 as quoted). Below adult size it is min(10 m/s, 30 BL/s). for zebrafish it is Umax from `current.mjs`. The `launch_speed_m_s` parameter is a what-if override.
   - **Takeoff check.** `aerial_escape_available = launch speed ≥ v_min`, which also sets `feasible`.
   - **On the real organisms.** The adult flying fish and the TFF can escape by air. The wingless flying fish and the winged zebrafish cannot.
   - **If evasion under water fails** but an aerial escape is available, survives becomes null. Leaving the water is the leading hypothesis for gliding (Davenport 1994; Makiguchi 2013 saw flying fish leap when blacktip sharks pursued them), but its effect on survival has never been measured.

**Validations.**

| Organism | Prediction | Observation | Verdict |
|---|---|---|---|
| Adult zebrafish | K* = 2.11 at 26 °C | "more than twice" (McKee & McHenry 2020) | Agrees, but it is **not independent**: same model and same inputs, so it only checks the implementation |
| Flying fish (*C. hiraii*, 60 g) | U_min = 9.85 m/s | Field launch "about 10 m/s" (secondhand) | **Consistent.** The captive 3.9–5.2 m/s estimates would not be enough to glide |
| Flying fish | 32.9–71.8 m for a 15–20 m/s launch, 32.9 m at glide's 15 m/s adult default, 5.0 m for a 10 m/s leap with no taxi (identical to `glide.mjs`) | Glides "up to 50 m" at 15–20 m/s (secondhand) | **Inside the 15–20 m/s band, but partly circular.** The airspeed comes from the same observation, and real fish reach it by taxiing, which is not modelled. The earlier energy-height version (22 m) was replaced so the studio gives one number |
| Adult zebrafish | C-start speed 0.84 m/s at 33 mm | Re 27,800 (Danos & Lauder 2012) | Read-back (A1), not a validation |
| Larval zebrafish | Peak speed 0.2 m/s (input) | ~63 mm/s with DanioVision (van de Pol 2021) | A 3× spread between two measurements, set by frame rate; not a test |

**What it cannot tell you.**

- Survival rates. No predator strike kinematics, suction flow, escape-direction choice, schooling, habituation, light or turbidity.
- A post-larval acceleration. It is null for every post-larval fish. The adult speed is one lab's mean of 5 fish.
- Anything about predators faster than a cichlid-like suction feeder.
- What a dolphinfish does after the prey leaves the water.

**Weaker than it looks.**

- The default K = 1.5 is an example value from the model paper, not a measured predator.
- The 3.7 cm/s escape speed is a mean over the escape. Its normalisation length comes from a different study.

---

## grip — climbing and grip strength

**Model.** The scenario only models a structure the design carries: a part whose id matches sucker, suction, adhesive or disc, or an `adhesive_disc_area_m2`, or the `disc_area_m2` parameter.

- `F = min(σ, p_ambient)·A`.
- The safety factor is `F/(mg)`, using full weight, which is conservative.
- The ceiling is ambient pressure times area. Suction cannot exceed ambient, and cavitation sets a limit near 100 kPa at sea level.
- The default σ of 30 kPa is the clingfish whole-disc stress: 20–50 kPa (Wainwright 2013) and 30–40 kPa (Ditsche & Summers 2019).
- Climbing-goby pelvic suction is only 0.63–1.5 kPa (Schoenfuss 2026). Set `adhesive_stress_kPa` to 1.5 for a goby-type sucker.
- Net climbing speed is 0.10 BL/s, borrowed from gobies (Blob 2019), and is given only when the safety factor is at least 1.

**Without a structure** the scenario returns `has_gripping_structure = false`, null forces, `feasible = false` and `survives = null`, with the reason stated. Pelvic suction cups evolved only in clingfishes, snailfishes/lumpsuckers and rock-climbing gobies (McFarland 2026). That zebrafish and flying fish have none is an inference by absence, not a measured null. A larval cement gland is reported in the related giant danio.

**If a disc is present but its area is unknown**, every number is null and `feasible` is null. No area is invented.

**Validations.**

- **Clingfish.** Wainwright's extreme stress, area and mass combinations give 60–242 body weights, against the measured 80–230. This is close to an identity, because the paper computed stress from the same forces and areas. It checks the arithmetic only.
- **Gobies.** No validation was possible: no disc area or mass paired with a suction value was found.

**What it cannot tell you.**

- Peel or shear failure, flow loading, fatigue, or the cost of reattaching.
- Effects of mucus or biofilm. Biofilm cuts clingfish tenacity by up to about 25%.
- Fin friction or wriggling. "No grip" means no modelled mechanism.

---

## sleep — sleep amount

**Model.** A lookup on measurements, by stage. **Two sleep definitions are reported side by side and never mixed.**

**Primary series (`sleep_fraction_night`, `sleep_fraction_day`): the 6-second criterion.**

- Night values come from Sorribes et al. 2013, the one study that applied the same criterion at every age. Sleep is "after six or more consecutive 1-s bins of non-movement", at 28.5 °C and 14:10 LD.
- Night sleep is 58.17% for larvae (6–10 dpf), 54.25% for juveniles (4–6 weeks) and 33.37% for adults (4–6 months).
- Daytime sleep with this criterion exists only for adults: 5.1% (Yokogawa 2007, a different lab). For larvae and juveniles the day value is null, with that reason given.
- This is the series to use when comparing ages.

**Alternative series (`alt_def_sleep_fraction_*`): each stage's own most-cited definition, with day and night from one paper.**

- **Larvae.** Choudhary 2026 (speed < 0.5 mm/s for ≥ 1 min): 19.6% of the day and 83.9% of the night. Temperature uses the same paper's 24 °C vs 28 °C runs, clamped to 24–28 °C.
- **Adults.** Yokogawa 2007 (inactivity < 6 pixels/s for ≥ 6 s): 5.1% of the day and 58.1% of the night.
- `sleep_hours_per_day` uses this series.

**Why the two disagree.** A speed threshold counts slow drifting as sleep and a pixel threshold does not, so the larval night comes out at 83.9% under one definition and 58.2% under the other. This is the W7 mismatch. Even with the same nominal 6 s criterion, two labs give adults 33.4% and 58.1%.

**Other rules.**

- **Hypocretin.** hcrt overexpression in larvae raises night sleep latency from 13 to 77 min (Prober 2006); it gives no night fraction, so the night fractions are null. hcrtr loss in adults multiplies night sleep by 0.75 in both series (Yokogawa 2007: −20 to −30%).
- **Before 5 dpf** there are no numbers. **Other species** borrow the zebrafish values and are flagged out of range; no flying fish sleep data were found. `genotype/` does not carry hcrt or hcrtr.
- All lookups are labelled **calibrated** (A1).

**Validations.**

- **Adult night, same 6 s criterion, two labs: disagree 1.7×.** Sorribes gives 33.4% and Yokogawa 58.1%. Both are shown; neither is a prediction.
- **Larval night under two definitions: 58.2% vs 83.9%.** This is a difference of definition, not a test.
- **Larval 24 h, alternative series: fails, 1.5× high.** Predicted 46%; Prober reports about 30% "inactive".
- **Larva > adult (58.2% vs 33.4%):** a read-back of Sorribes, so it is circular for harness W5 and W7.

**What it cannot tell you.** Homeostatic sleep pressure, deprivation, light pulses (light suppresses adult sleep by 90%), melatonin, or social context. Sleep does not affect survival here.

---

## daynight — day/night activity and clock

**Model.**

- **Larva.** 7 s/min moving in the light and 0.5 s/min in the dark, a ratio of 14 (Prober 2006: 4–10 and 0–1 s/min).
- **Adult.** The share of activity in the light at 12:12 LD falls linearly from 0.87 at 20 °C to 0.77 at 26 °C (López-Olmeda 2006). It is converted to a per-hour ratio and re-weighted for other photoperiods.
- **Free-running period.** 25.08 h for larvae in DD (Chaigne 2024) and 23.25 h for adults in dim LL (López-Olmeda 2006: 22.9–23.6 h).
- **Temperature compensation.** The period is held constant over 18–28.5 °C (Hurd 1998, whole animal). The cell-line Q10 of 0.9 (Lahiri 2005) is recorded but not applied to the fish.
- **Before 5 dpf** the rhythm is not expressed (Prober 2006; Hurd & Cahill 2002).

**Validations.**

- **Larval period: consistent.** Predicted 25.08 h, against 24.93 ± 1.87 h measured in LL in the same paper.
- **Adult diurnality: right sign only.** Predicted 0.79 of activity in the light at 25 °C. Hurd 1998 reports "86% of fish most active in light". These are different quantities.
- **Larval light/dark contrast: disagrees by about 3×.** Prober's movement ratio is 14. The wake ratio from Choudhary's sleep fractions is 5.0.

**What it cannot tell you.** Entrainment dynamics, phase response, light intensity, masking, temperature or feeding zeitgebers. No flying fish data exist in what was searched.

---

## digestion — feeding and digestion

**Model.**

- **Routine metabolism.**
  - Adult zebrafish: SMR of 228.5 mg O₂ kg⁻¹ h⁻¹ at 26 °C (Hejlesen 2024: 119 µmol min⁻¹ kg⁻¹) with Q10 1.39 (Ripley 2022).
  - Larvae and juveniles: log-linear in age from 40 µmol g⁻¹ h⁻¹ at day 10 to 4.5 at day 100, at 28 °C, with Q10 2.5 (Barrionuevo & Burggren 1999).
  - Flying fish: borrowed from snapper, 224.9 mg kg⁻¹ h⁻¹ at 28 °C (via `physiology/`), with mass scaling ignored.
  - Energy: 13.54 J per mg O₂.
- **Intake.** The ration is the husbandry recommendation: 9.5%, 7% and 5% of body mass per day for larvae, juveniles and adults (Licitra 2024), on a 20 kJ/g dry diet.
- **Losses.** Faecal loss is 22.8%, borrowed from flounder larvae. The SDA coefficient is 10.1%, borrowed from larval clownfish; no zebrafish or cyprinid coefficient was found.
- **Balance.** `net = intake(1 − f_F − c_SDA) − routine`; survives if net ≥ 0. The maintenance ration follows from the same equation.
- **Intestine.** A part scale of 0 means zero intake, survives = false and feasible = false.
- **Gut passage time.** Only for zebrafish larvae: 16 h at 28 °C, when 75% of guts are empty (Zada 2022). It is scaled with a sprat evacuation exponent of e^(−0.0775 (T−28)) (Bernreuther 2009). For adults and flying fish it is null, because no measurement was found.

**Validations.**

- **Adult maintenance ration: fails, about 3× low.** The model predicts 0.6% of body mass per day at 28.5 °C. The reported value is ~2% (Licitra 2024, citing unpublished data). SMR leaves out spontaneous activity, and the borrowed fractions are untested.
- **Two measured MO₂ sources disagree by 1.6× or more** near 100 dpf. The model jumps where it switches source.
- **SDA time course: neither refuted nor confirmed.** A 10% coefficient implies a ~33 h response if the peak is +78% of SMR. Ferreira 2019 reports a response still elevated at 10 h.

**What it cannot tell you.** Growth rate, locomotion costs, feeding behaviour, meal timing, food type (flying fish eat copepods), or how SDA depends on meal size. For flying fish every input is borrowed.

---

## Everything weaker than it looks

- **Adult zebrafish escape speed** is one lab's mean of 5 fish, applied per SL. Flying fish speed is a tail-beat estimate.
- **The predator's survives** is a geometric threshold whose defaults come from one lab's modelled example.
- **The aerial escape** is glide.mjs's model. It relies on the assumed 1.98965 lift-area bridge, aerodynamics from stuffed specimens and glide's launch-speed rule (15 m/s taxi-end for adults, 30 BL/s capped at 10 m/s below adult size). With the default 15 m/s, the 32.9 m glide lies inside the band defined by the very observation it is compared with, so that comparison is circular.
- **Sleep and day/night** are lookup tables. Their only independent cross-checks disagree by 1.5–3×, because labs define sleep and activity differently.
- **Digestion** uses a husbandry ration, not a measured intake, and borrows SDA and faecal loss from marine larvae. Its one real validation fails by 3×.
- **Grip's only validation** is arithmetic. With no structure, the result is an anatomical inference.
- **Flying fish behaviour, sleep, metabolism and gut transit** were not found at all. Every flying fish value outside the aerial and leap numbers is borrowed from zebrafish or snapper and is flagged out of range.
