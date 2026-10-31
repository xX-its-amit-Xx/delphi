# physiology/: circulation, gill counter-current exchange, heart, haemoglobin, muscle

This is the data layer for the flying-fish viewer (blood circulation, breathing through the gills) and for the Physics simulator's O2-to-power chain:
water O2 -> gills -> blood -> heart -> muscle -> mechanical power.

**Almost nothing here is flying-fish data.** I searched Europe PMC and Crossref for Exocoetidae gill area, metabolism, heart rate, haemoglobin and ventilation mode and found no physiology papers. The obvious review (Davenport 1994) has no abstract online and was not read. The only flying-fish number the modules use is the mass that the simulator passes in (0.06 kg, from Park & Choi 2010, Physics' source). Everything else is a labelled proxy from another teleost, or an assumption with a stated reason. No bird data are used anywhere. Retrieval date for every source: 2026-10-31.

## Files

| file | what it is |
|---|---|
| `circulation.json` | Single-circuit directed graph: sinus venosus -> atrium -> ventricle -> bulbus -> ventral aorta -> afferent branchial -> lamellae -> efferent branchial -> dorsal aorta -> organs -> hepatic portal / renal portal / cardinal veins -> sinus venosus. It has 28 nodes and 38 edges. Nodes carry `object` (the manifest name), `term_id` (from data.json, or null) and `o2`. Edges carry `share`, the fraction of cardiac output. |
| `gills.json` | `params {Pw_in, Pb_in, k, ratio, N}` for the viewer, the physical trout reference, the flying-fish defaults, lamellar geometry, a table of gill area per gram, and the ventilation question. |
| `countercurrent.js` | `solve(params, counter)` returns `{water[], blood[], extraction, utilisation, bloodOut, waterOut, uptake, x[]}`. Also exports `analytic(k, R, counter)` and `tuneD()`. |
| `haemoglobin.js` | Hill curve: `saturation`, `content`, `pressureFromContent`, `bohrP50`, `effectiveCapacitance`, plus `HB_PARAMS`. |
| `cardiac.js` | `state(intensity)` gives HR, SV and Q. `simulate({mass_kg, intensity, beats})` runs a two-element Windkessel and returns the time series. |
| `muscle.js` | Hill force-velocity, `steadyPower`, `cyclicPower(f)`, `powerCurve`, `aerobicPowerFromVO2`, `maxVO2`, `availablePower`, plus `MUSCLE_PARAMS`. |
| `index.js` | `createPhysiology(spec, env)`, matching the contract in `dashboard/public/t/physics/sim/physiology-stub.js`. Also exports `calibrateGills`, `o2sat_mg_l`, `BASELINE_ENV`, `GILL_PARAMS`. |
| `test.mjs` | Run `node physiology/test.mjs` (takes about 0.6 s). |
| `sources.json`, `calllog.txt` | The 25 sources and what was taken from each, plus every HTTP request made. |

## Equations (plain text)

**Counter-current exchange (countercurrent.js).** The lamella is split into N segments. Water flows from x=0 to x=1. In counter-current mode blood flows from x=1 to x=0; in co-current mode it flows from x=0 to x=1.

- Flux in segment i: J_i = (D/N)(Pw_i - Pb_i), where Pw_i and Pb_i are the segment-mean PO2 values.
- Water side: Pw_out = Pw_in - J/Gw, with Gw = Vw * beta_w (water O2 capacitance rate).
- Blood side, linear mode: Pb_out = Pb_in + J/Gb, with Gb = Q * beta_b.
- Blood side, haemoglobin mode: C_out = C_in + J/Q, and Pb = C^-1(C) from the Hill curve.
- Dimensionless form: k = D/Gw and ratio = Gw/Gb.
- Solution method: each segment is solved implicitly. Co-current is a single forward march. Counter-current uses shooting: bisect on the blood outlet value until the marched blood inlet matches.
- extraction = (Pw_in - Pw_out)/(Pw_in - Pb_in). This is the exchanger effectiveness.
- utilisation = (Pw_in - Pw_out)/Pw_in.
- Analytic check (linear mode):
  - counter-current: E = (1 - e^{-k(1-R)})/(1 - R e^{-k(1-R)}), and E = k/(1+k) when R = 1
  - co-current: E = (1 - e^{-k(1+R)})/(1+R)

  test.mjs checks the numerical solution against these to 1e-3.

**Haemoglobin.**
- S = P^n/(P^n + P50^n)
- C = cap*S + alpha*P
- Bohr shift: P50' = P50 * 10^(phi * dpH)
- cap = 4 * [Hb4] * 22.4 ml/mmol

**Heart.**
- Q = HR * SV. HR and SV are interpolated linearly between rest and max with intensity x.
- Inflow is a half-sine during systole (systole = 40% of the cycle, assumed).
- Windkessel: C dP_VA/dt = Qin(t) - (P_VA - P_cv)/R, with R = R_gill + R_sys.
- P_DA = P_VA - Q_out * R_gill.
- R_sys comes from mean P_DA / Q. The time constant tau = RC = 1 s is assumed.

**Muscle.**
- Aerobic power: P_aero = VO2 * Eox * eta, with VO2 <= Q (Ca - Cv_min). Eox = 13.54 J per mg O2 = 19.34 J per ml O2.
- Hill force-velocity: F/F0 = (1-v)/(1+v/kappa).
  - Power is greatest at v_opt = sqrt(kappa(1+kappa)) - kappa.
  - kappa = 0.527 is tuned so that v_opt = 0.37, the V/Vmax at maximum power reported by Rome 1992.
- Steady power: P/m = sigma0 * Vmax * v(1-v)/(1+v/kappa)/rho.
- Cyclic power at frequency f:
  - V = 4 eps f
  - P/m = 0.5 sigma0 V F(V)/F0 / rho * 1/(1+(f/fc)^2)
  - fc is tuned so that red muscle at 25 degC peaks at 5 Hz, the skipjack value.
- Temperature: X(T) = X(Tref) Q10^((T-Tref)/10).

**Coupled model (index.js).**
- **In water:**
  - Ca = counter-current(Pw_in, Pv = P(C_pool), D = D_per_m2 * gill area, Gw = (Vw/Q) Q beta_w, Q).
  - Pw_in = airO2 * (101.325 - pH2O(T)).
  - Water O2 = air-saturated sea water from the Garcia & Gordon 1992 fit (TEOS-10 GSW-C). At the baseline of 25 degC and 35 psu this is 206.8 umol/kg, or 6.76 mg/l.
- **In air (phase taxi / glide / flight / air):** no gill uptake, and Ca = C_pool.
- O2 use: VO2 = SMR + P_aero/(Eox eta), capped at Q (Ca - C_floor).
- Blood store: V_b dC_pool/dt = Q (Ca - C_pool) - VO2.
- C_floor = content at venous PO2 8.6 torr (1.15 kPa), the trout fatigue value.
- storeFraction = (C_pool - C_floor)/(C_pool,rest - C_floor).
- Any work demand above the aerobic supply comes from the burst store. The burst store equals EPOC energy times eta. It recovers in water with tau = 240 min.

## What happens to O2 supply in air (for Physics' flier)

When the gills stop ventilating, the only O2 left is what is already in the blood. In the default 0.06 kg fish at 25 degC:

- **Usable blood store:** about 0.099 ml O2. This is the blood volume (30 ml/kg, assumed) times the drop from resting venous content down to the 8.6 torr floor.
- **How long it lasts:** resting metabolism alone (SMR 2.6e-3 ml/s, snapper proxy) takes the store to 50% in about 44 s and to 10% in about 145 s.
- **How the drain behaves:** in this one-pool model, delivery falls as the pool empties, so the drain slows down over time.
- **Aerobic power for work in air:** essentially zero. Even with the store full, Q_max x (C_pool - C_floor) barely exceeds SMR, so `powerAvailable` reports aerobic around 0 W and `limitedBy: 'store'` in air.
- **What powers work in air:** the burst store. That is 307 W/kg of white muscle, from a store of about 159 J mechanical for 0.06 kg (EPOC-based, so treat it as an upper bound). Because it drains at the demand rate, a 0.05 W glide uses about 1% of it in 30 s.
- **Aerobic power in water:** small. VO2max_water is 5.6e-3 ml/s, so aerobic work above SMR is about 0.0086 W for a 0.06 kg fish. It is O2-limited, not muscle-limited: the red-muscle cap is 0.28 W.

The conclusion is model-level, not measured: sustained flapping flight could not be powered aerobically through gills out of water. It would depend on the anaerobic store, which lasts seconds to minutes depending on demand.

## Basis: flying-fish data vs proxy vs assumed

**Flying fish:** none, apart from the mass the simulator passes in.

**Proxies (with species):**

| quantity | value | species | source |
|---|---|---|---|
| Hb P50, n, Bohr, O2 capacity | 3.31 kPa, 1.34, -0.91, 0.0806 ml/ml | rainbow trout | rummer2015 |
| resting arterial PO2 (calibration target) | 15.8 kPa | rainbow trout | mcarley2022 |
| venous PO2 floor | 8.6 torr | rainbow trout | steffensen1998 |
| cardiac output, HR, SV, MO2, EO2 (warm set) | see cardiac.js | schoolmaster snapper, 28 degC (tropical reef, not pelagic) | durnford2026 |
| cardiac output, SV, P_DA (cold set) | 26.3 ml/min/kg, 0.44, 2.03 kPa | rainbow trout (sea water) | sundell2018 |
| organ blood-flow fractions | Table 1 | rainbow trout | gerry2014 |
| gill area per gram (default) | 1158 mm2/g | Atlantic mackerel | bigman2021 dataset (Gray 1954) |
| gill area, other rows | see gills.json | chub mackerel, skipjack, yellowfin, dolphinfish, menhaden, trout | bigman2021 dataset |
| lamellar geometry | width 13.1 um, epithelium 2.5 um, interlamellar 30 um | rainbow trout | lahn2024 |
| red muscle Vmax, stress, Pmax, Q10 | 5.55 L/s, 183 kPa, 134 W/kg | scup | rome1992 |
| fast muscle Vmax | ~12 L/s at 10 degC (range 5-18) | rainbow smelt | woytanowski2013 |
| burst power | 307 W/kg | short-horn sculpin | james1998 |
| red-muscle strain and power peak frequency (**fast pelagic**) | +/-5.5%, 5 Hz; yellowfin 3-4 Hz | skipjack tuna, yellowfin tuna | syme2002, shadwick2008 |
| muscular efficiency | 0.15 | salmon *ventricle* (cardiac muscle) | gamperl2021 |
| burst energy store | EPOC 1307 mg O2/kg -> 17.7 kJ/kg | mahi-mahi (pelagic) | heuer2026 |
| oxycaloric equivalent, slow fibres 5% of myotome, coronary 1% of CO | 13.54 J/mg; 0.05; 0.01 | trout (secondary) | gerry2014 |
| anatomy: renal portal, hepatic portal, coeliacomesenteric artery | n/a | teleosts / trout | bjorgen2021, brijs2015 |

**Tuned:** each of these is chosen to reproduce a named sourced value.
- Gill D per m2: tuned so the trout reference gives PaO2 15.8 kPa.
- Flying-fish Vw/Q (22.9): tuned so the resting fish reaches the same PaO2.
- Warm-water Hb capacity (0.206 ml/ml): tuned so the snapper's measured maximum EO2 fits the trout Hill curve. Trout blood (0.081 ml/ml) cannot meet snapper MO2 at snapper Q.
- Hill curvature kappa: tuned to v_opt 0.37.
- Cyclic cutoff fc: tuned to the skipjack 5 Hz peak.

**Assumed:**

| assumption | value |
|---|---|
| Vw/Q in the trout reference | 10 |
| blood volume | 30 ml/kg |
| gill share of vascular resistance | 25%, so ventral aortic pressure is not sourced |
| Windkessel tau and systole fraction | 1 s, 0.4 |
| central venous pressure | 0 |
| plasma O2 solubility | assumed |
| muscle density | 1060 kg/m3 |
| sea-water density | 1.0234 kg/l |
| white-muscle stress | equal to red |
| left/right symmetry, no gill shunts, cardinal-vein routes | as stated |
| body temperature | equal to water temperature |
| axial muscle fraction (if the sim does not pass one) | 0.5 |
| gills in air | not ventilated |
| per-m2 gill barrier | same as trout |

**Ram ventilation vs buccal-opercular pumping in flying fish: unknown.** No fetched source addresses it. Scombrids are ram ventilators (wegner2010, fast pelagic). A small tropical pelagic, the scaled sardine, shifts progressively from opercular-buccal pumping to ram ventilation as it swims faster (gamperl2025). The model treats both modes identically, through Vw.

**Environment:** the defaults are the project baseline (`conditions/baseline.json`): 25 degC, 35 psu, air O2 0.209, air-saturated water. Water O2 is computed with the Garcia & Gordon 1992 solubility fit.

## Self-test output (`node physiology/test.mjs`, 2026-10-31)

```
== 1. Counter-current vs co-current, dimensionless (gills.json params)
k=1.268 ratio=1.195 Pw_in=20.97 kPa Pb_in=2.50 kPa
counter-current: extraction=0.529 utilisation=0.466 waterOut=11.20 bloodOut=14.18 kPa (iter 40)
co-current:      extraction=0.427 utilisation=0.376 waterOut=13.08 bloodOut=11.93 kPa (iter 0)
PASS counter matches analytic
PASS co matches analytic
PASS counter beats co
PASS co-current blood cannot exceed water outlet

== 2. Counter-current with haemoglobin (trout reference, physical units per kg)
D=0.00209 ml O2 s-1 kPa-1 kg-1, Gw=0.00165, Q=0.4383 ml/s/kg; tuned PaO2 -> counter 15.80 kPa, co 10.51 kPa
counter: extraction=0.602 uptake=1.103 ml O2/min/kg | co: extraction=0.509 uptake=0.932 ml O2/min/kg
Ca=0.0754 Cv=0.0334 ml/ml; SaO2=0.891, SvO2=0.408
PASS Hb inverse round-trip

== 3. Cardiac Windkessel (warm proxy, 0.06 kg)
intensity 0: HR 96.4 bpm, SV 0.306 ml/kg, Q 29.5 ml/min/kg; P_VA 2.19-3.26 (mean 2.71) kPa; P_DA mean 2.03 kPa
intensity 1: HR 153.0 bpm, SV 0.429 ml/kg, Q 65.6 ml/min/kg; P_VA 2.38-3.05 (mean 2.71) kPa; P_DA mean 2.03 kPa

== 4. Muscle
Hill steady max power: red 20 degC 131.2 W/kg (rome1992 measured 134), white 10 degC 283.6 W/kg (sculpin burst measured 307)
fc tuned = 7.73 Hz; red cyclic power at 25 degC: 1 Hz 17.8, 3 Hz 39.8, 5 Hz 45.7, 8 Hz 39.4, 12 Hz 26.0, 15 Hz 18.1 W/kg
aerobic power per ml O2/s: 2.90 W (Eox 19.34 J/ml x eta 0.15)

== 5. createPhysiology, 0.06 kg fish
axial: aerobic 0.0086 W, burst 8.749 W, total 8.758 W, limitedBy o2
flight: aerobic 0.0086 W, burst 1.750 W, total 1.758 W, limitedBy o2
o2 (rest, water): {"deliveredRate_mlO2_per_s":0.0026,"arterialSat":0.8906,"venousSat":0.4589,"storeFraction":1,"burstStoreFraction":1,"inWater":true}
o2 after 30 s glide at 0.05 W demand: {"deliveredRate_mlO2_per_s":0.001,"arterialSat":0.3563,"venousSat":0.3561,"storeFraction":0.6102,"burstStoreFraction":0.9898,"inWater":false}
axial after glide: {"aerobic_W":0,"burst_W":8.7495,"total_W":8.7495,"limitedBy":"store","aerobicMuscleCap_W":0.2756,"aerobicO2Cap_W":0}
o2 after 120 s rest in water: {"deliveredRate_mlO2_per_s":0.0026,"arterialSat":0.8409,"venousSat":0.3899,"storeFraction":0.7382,"burstStoreFraction":0.9899,"inWater":true}
describe(): 29 rows; kinds: {"measured":1,"assumed":5,"derived":6,"secondary":3,"tuned":3,"proxy":11}
PASS blood O2 store drains in air
o2 after 600 s in air at zero work: {"deliveredRate_mlO2_per_s":0,"arterialSat":0.1948,"venousSat":0.1948,"storeFraction":0.0001,"burstStoreFraction":0.9731,"inWater":false}
PASS store reaches the venous floor in air

all checks passed
```

Reading the output:

- **The two extraction efficiencies the viewer shows.** With the dimensionless gills.json set (k = 1.27, ratio = 1.20), counter-current extracts 0.529 and co-current 0.427.
- **With the real Hill curve.** Using the same trout gill, counter-current extracts 0.602 and co-current 0.509. Arterial PO2 is 15.8 kPa counter-current versus 10.5 kPa co-current.
- **Why the linear set is lower.** The linear set uses one average blood capacitance, so its numbers are lower than the Hill-curve run.
- **Cardiac output check.** Q at rest prints 29.5 rather than 28.54 because HR x SV is computed from the means.
- **Mean pressure is fixed.** The Windkessel holds mean P_DA at the measured resting value at every intensity, so R falls as Q rises. kiceniuk1977 reports +20% dorsal and +60% ventral aortic pressure at Ucrit; that rise is not modelled.

## Notes for Viz

- **Animating the gills.** Draw `solve(gills.params, true)` and `solve(gills.params, false)` side by side. `x[i]`, `water[i]` and `blood[i]` are segment means at the same positions; blood enters at x=1 in counter mode and at x=0 in co mode. The key visual: in co-current the blood can never exceed the water outlet PO2; in counter-current it can.
- **The k and ratio sliders.** If you let viewers drag them, `analytic()` gives instant values.
- **Circulation colours.** Colour by node `o2`. Nodes with `object: null` (aortas, veins, coeliacomesenteric artery, stomach) carry a `position_hint` instead.
- **Edge widths.** Use `share` x cardiac output (28.54 ml/min/kg at rest). Edges with `share: null` are unsourced.
- **Organ flow during swimming.** `share_at_0p9Umax` gives the visceral shares at 0.9 Umax, showing the gut losing flow when the fish swims hard.
- **Heartbeat.** `simulate()` returns `t`, `Qin_ml_s`, `P_VA_kPa` and `P_DA_kPa` for 5 beats; loop them.
- **Gill geometry.** The interlamellar spacing to epithelium ratio is about 30 um to 2.5 um. Lamella length is printed as "239 mm" in the source, which is almost certainly um.
