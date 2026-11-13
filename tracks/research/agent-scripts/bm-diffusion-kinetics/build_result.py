#!/usr/bin/env python
"""Assemble agents2/bm-diffusion-kinetics.json from results.json (run diffusion_kinetics.py first).
Run: python -P build_result.py   -> writes ../../bm-diffusion-kinetics.json and prints it as one line to stdout too."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(HERE, "results.json")))
SC, INV, BL = R["slab_constants"], R["inversions"], R["bilayer"]
OUTFILE = os.path.normpath(os.path.join(HERE, "..", "..", "bm-diffusion-kinetics.json"))

# ------------------------------------------------------------------ table
table = []
for r in R["material_table"]:
    f = (f"D={r['D_lo']:.2e}" + (f" to {r['D_hi']:.2e}" if r['D_hi'] != r['D_lo'] else "") + " m2/s; "
         + "; ".join(f"one-face t90 at h={h} mm = {r[f'one_face_t90_h{h}']}" for h in (0.2, 0.4, 0.8, 1.6)) + "; "
         + "both-faces t90 at h=0.2/0.4/0.8/1.6 mm = " + " / ".join(r[f"both_faces_t90_h{h}"] for h in (0.2, 0.4, 0.8, 1.6)))
    table.append({"name": r["material"], "fields": f, "source": r["source"]})
for D in (1.4e-13, 3e-13, 1e-12, 3e-12, 1e-11, 3e-11, 1e-10, 1e-9):
    fields = []
    for h in (0.2, 0.4, 0.6, 0.8, 1.6):
        rr = [x for x in R["equilibration_table"] if x["D_m2s"] == D and x["h_mm"] == h and x["exposure"].startswith("one")][0]
        fields.append(f"h={h} mm: t50 {rr['t50']}, t90 {rr['t90']}, t99 {rr['t99']}")
    table.append({"name": f"GRID one-face exposed layer, D = {D:.1e} m2/s", "fields": " | ".join(fields),
                  "source": "own calculation: D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-diffusion-kinetics/diffusion_kinetics.py (equilibration_table.csv has both exposures)"})

SCRIPT = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-diffusion-kinetics/diffusion_kinetics.py"
FL80 = "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf"
FLV5 = "https://formlabs-media.formlabs.com/filer_public/dd/7f/dd7f3de9-55ae-4c82-ac52-408a4b5df64d/clear_resin_v5_tds___formlabs.pdf"
FLSOL = "https://formlabs.com/support/solvent-compatibility/"
EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/{}/fullTextXML"

def F(claim, source, conf, quote="", value=""):
    d = {"claim": claim, "source": source, "confidence": conf}
    if value: d["value"] = value
    d["evidence_quote"] = quote
    return d

findings = [
 F("Fickian slab: the fractional uptake of a plane sheet of thickness l with both faces held at the bath concentration depends only on x = D t / l^2. The half-time is x50 = 0.04918, the 90 % time x90 = 0.2120, the 95 % time x95 = 0.2823 and the 99 % time x99 = 0.4453. Short-time law M_t/M_inf = 4 sqrt(D t/(pi l^2)). Single slowest-mode time constant tau = l^2/(pi^2 D).",
   SCRIPT + " (series of Crank eq. 4.14, reproduced by an independent finite-volume solve that gives x50 = 0.04918 as well)", "high",
   "D was calculated at low times of immersion, when M t / M ∞ ≤ 0.5, as: (3) M t M ∞ = 4 L · ( D π ) 1 2 · t 1 2",
   "x50=0.04918; x90=0.2120; x99=0.4453"),
 F("Thickness scaling: for a layer exposed on both faces the half-time is t50 = 0.0492 h^2/D; for an active layer exposed on ONE face only (the other face bonded to an impermeable passive layer, the bilayer case) the effective sheet thickness is 2h, so t50 = 0.197 h^2/D, t90 = 0.848 h^2/D, t99 = 1.78 h^2/D. Doubling h quadruples every time.",
   SCRIPT, "high", "", "one-face: t50 0.197, t90 0.848, t99 1.78 (units h^2/D)"),
 F("Measured thickness exponents in a porous hygromorph are below 2: wetting time varies as h^1.3 and drying time as h^1.5 in pine-cone scales, against the Fickian h^2 estimate (tau = h_a^2/D ~ 1000 s for D ~ 1e-9 m2/s and h_a ~ 1 mm).",
   "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/ (10.1098/rsif.2009.0184)", "high",
   "the shrinking (drying) time varies as τ d = 96 h a 1.5 min and the swelling (wetting) time varies as τ d = 29 h a 1.3 min (where h a is in mm)", "exponents 1.3 (wet), 1.5 (dry)"),
 F("Hydrogel swelling time is proportional to thickness squared; the cooperative diffusion coefficient follows from tau = h^2/(pi^2 D) with D = (K_os + 4 mu/3)/f (osmotic and shear moduli over network-solvent friction).",
   "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9457170/fullTextXML (10.1073/pnas.2207422119)", "high",
   "Our previous study confirmed that τ is proportional to the square of the sample thickness, following cooperative diffusion ( 27 ). We estimated the cooperative diffusion coefficients, D , from the relation τ = h ∞ 2 π 2 D"),
 F("Water D in 12 FFF filaments (97 % RH and lower, room temperature, cylinders of 1.75 or 2.8 mm diameter): Nylon 0.001, Antero 0.00245, CPE 0.00247, PET-G 0.00335, Ultem 0.00399, PC 0.00472, PLA Lava 0.00782 up to PLA T-W 0.0151 mm2/h, i.e. 2.8e-13 to 4.2e-12 m2/s. Confirms the earlier agent's range.",
   EPMC.format("PMC10304609") + " (10.3390/polym15122600), Table 3; 1 mm2/h = 2.778e-10 m2/s (own conversion)", "high",
   "Antero 0.00245 0.00011 181 CPE 0.00247 0.00003 165 Koltron −0.0048 0.0033 0.3044 −0.0170 0.0001 550 Nylon 0.001 0.00060 360 PC 0.00472 0.00038 92", "2.8e-13 to 4.2e-12 m2/s"),
 F("In those filaments the moisture swelling strain is small (0.15-0.25 % for most), and the Nylon filament shrank by 2.43 % in humid air, so a polyamide filament is not a safe stand-in for a swelling layer.",
   EPMC.format("PMC10304609"), "high",
   "Most materials had a maximal swelling ability of 0.15−0.25%, which was not dependent on their structure and composition."),
 F("Concentration dependence of D, filaments: D was independent of humidity for six of twelve filaments, fell about four-fold with moisture for four and rose 2-3-fold for PLA Lava and PET-G.",
   EPMC.format("PMC10304609"), "high",
   "For the other six materials, the diffusion coefficient changed with the moisture concentration in the atmosphere. The dependence significantly (four times) decreased for four materials, including ABS White"),
 F("Concentration dependence of D, polyamide 6 in water: the FE-model input table gives D = 2.58e-9 at zero water, 7.34e-9 at 30 000 ppm, 2.42e-8 at 65 000 ppm and 5.51e-8 at 89 000 ppm, a factor 21.4 between dry and near-saturated (own division). The unit printed in the table header is garbled ('[m/s 2]'), so only the unit-free ratio is used.",
   EPMC.format("PMC8124584") + " (10.3390/polym13091480), Table 2", "medium",
   "0 2.58 × 10 − 9 1100 0 0 0 30,000 7.34 × 10 − 9 400 1.06 × 10 − 7 0.86 × 10 − 7 2.78 × 10 − 7 65,000 2.42 × 10 − 8 350", "ratio 21.4 (D at 89 000 ppm / D at 0)"),
 F("Consequence of a D that rises with water content (own finite-volume simulation, D = D0 exp(beta c), D ratio 21.4): the half-time for wetting is 0.114 times the constant-D0 value and the half-time for drying 0.279 times, so drying takes 2.46 times longer than wetting; for a ratio of 100 drying is 4.05 times slower. A wet/dry cycling demonstration is therefore limited by the drying half-cycle and a single D from the wetting curve under-predicts it.",
   SCRIPT + " section 7 (results.json concentration_dependent_D)", "medium",
   "", "desorption/sorption half-time = 2.46 (ratio 21.4); 4.05 (ratio 100)"),
 F("Dimethacrylate photopolymers (the chemistry class of SLA resins): water diffusion coefficient 1.52e-8 cm2/s (TEGDMA) up to 11.01e-8 cm2/s (Bis-GMA), i.e. 1.5e-12 to 1.1e-11 m2/s (own unit conversion, x1e-4). The abstract says D was highest in water, so these are read as the water values; the disc thickness is not in the abstract.",
   "https://pubmed.ncbi.nlm.nih.gov/21783239/ (10.1016/j.dental.2011.06.007), abstract via Europe PMC search API", "medium",
   "The diffusion coefficient for all resins was higher in water than in ethanol/water solution or ethanol. Bis-GMA-resin showed the highest diffusion coefficient (11.01 × 10⁻⁸cm² s⁻¹)", "1.52e-12 to 1.10e-11 m2/s"),
 F("In dimethacrylate resins the volume increase depends linearly on the amount of water or ethanol absorbed, so swelling strain equilibrates on the same clock as mass uptake.",
   "https://pubmed.ncbi.nlm.nih.gov/18321567/ (10.1016/j.dental.2007.12.009), abstract via Europe PMC", "high",
   "The volume increase was found to depend linearly on the amount of water or ethanol absorbed."),
 F("Flexible TPU (60A-98A, FDM, immersed in 0.9 % NaCl up to 96 h): Fickian D from the initial uptake 1.40e-13 to 3.40e-12 m2/s, equilibrium uptake up to ~1.8 %; the authors flag the lowest value (TPU 98A) as possibly an artefact of very low initial absorption.",
   EPMC.format("PMC13258891") + " (10.3390/polym18111392)", "high",
   "Diffusion coefficients ranged from 1.40 × 10 −13 to 3.40 × 10 −12 m 2 s −1 , with no monotonic dependence on hardness.", "1.4e-13 to 3.4e-12 m2/s"),
 F("Neat PA11 (hot-pressed, immersed in water): D = 4.95e-13 m2/s at 23 C and 22.0e-13 m2/s at 40 C, M_inf 1.43 % and 1.58 %; the n exponent is 0.305 and 0.272, below the Fickian 0.5 ('pseudo-Fickian').",
   EPMC.format("PMC6404017") + " (10.3390/polym10070717), Table 3", "high",
   "23 0 1.43 ± 0.02 0.305 ± 0.045 0.088 ± 0.023 4.95 ± 0.02", "4.95e-13 (23 C); 2.20e-12 (40 C) m2/s"),
 F("Temperature: from the two PA11 points the apparent activation energy is 67.7 kJ/mol (own Arrhenius calculation) and D rises 4.44-fold from 23 to 40 C; extrapolating the same line to 50 C gives a ten-fold speed-up (extrapolation beyond the data, treat as indicative). A warm bath is therefore a 4-10x accelerator for a polyamide demonstration, at the cost of a different strain/modulus state.",
   SCRIPT + " section 6", "medium", "", "Ea 67.7 kJ/mol; x4.44 (23->40 C); x9.9 (->50 C, extrapolated)"),
 F("Water in PDMS elastomer: D about 6-8e-10 m2/s (value quoted second-hand in a Sylgard-184 chip paper, which says the pervaporation time scales as H^2/D); the older figure D ~ 1e-9 m2/s comes from a web-search snippet of Randall & Doyle 2005 that I did not open. PDMS equilibrates in minutes at 1 mm but takes up very little water.",
   "https://arxiv.org/pdf/2401.05139 (arXiv:2401.05139), text saved at D:/Users/ashenoy00000/delphi-work/data/bm-diffusion-kinetics/arxiv_2401.05139.txt", "medium",
   "τp ∼ H2/Dwp , Dwp ≃ 6–8 × 10-10 m2 s-1 being the diffusion coefficient of water in PDMS", "6e-10 to 8e-10 m2/s"),
 F("Polyampholyte hydrogel (45 wt% water, 1.1-1.3 mm thick): cooperative swelling diffusivity 8.8e-11 to 1.7e-10 m2/s, roughly 10-100x faster than dense photopolymer resins.",
   EPMC.format("PMC9457170") + " (10.1073/pnas.2207422119)", "high",
   "The cooperative diffusion coefficient of swelling, D sw , increases slightly from 8.8 × 10 −11 to 1.7 × 10 −10 m 2 /s by increasing C MBAA from 0 to 5.0 mol%", "8.8e-11 to 1.7e-10 m2/s"),
 F("Printed PEG-acrylate type gels (PEGDA-700/PEGMEMA, 2 mm dry slabs photocured in glass moulds) swell to equilibrium in hours: exponential time constant tau of about 61 min or less for 5-40 mol% PEGDA, about 120 min for 1 mol% PEGDA-700 and about 190 min for 10k-PEGDA; curves reach their plateau by ~3-6 h. Own D = l^2/(pi^2 tau) with l = 2 mm gives 3.6e-11 to 1.1e-10 m2/s (lower bound; swollen thickness is larger, 3 mm gives up to 2.5e-10).",
   "https://arxiv.org/pdf/2406.15224 (arXiv:2406.15224), p. 13 and Fig. 2 (value symbols checked on the rendered page image); sample size p. 7", "high",
   "When PEGDA-700 is employed, the 1:99 formulation experiences a much larger time to reach equilibrium (τ ≃120 minutes) than the formulations with higher PEGDA-700 content (all τ ≤61 minutes).", "tau <=61 / ~120 / ~190 min"),
 F("Stock photopolymer: low-cost acrylate LCD resins as 60 x 60 x 1 mm plates in seawater: R3 +12.37 % in 2.5 d then 13.49 %; R2 (4.3 %) stable within 4 d; R1 (3.4 %) not saturated until after 8 d. Own inversion with x95/x99 for both-face exposure: D about 4e-13 to 2e-12 m2/s (R1 4.1e-13 to 6.4e-13, R2 8.2e-13 to 1.3e-12, R3 1.3e-12 to 2.1e-12).",
   EPMC.format("PMC11643832") + " (10.3390/ma17235953)", "medium",
   "While resin R2 stabilized within four days, resin R1 did not reach saturation until after eight days.", "D 4e-13 to 2e-12 m2/s (derived)"),
 F("Formlabs Grey V5 tensile bars (ASTM D638 Type 4, DI water): mass 101.38 % after 1 day and 103.23 % after 1 week, modulus 88.63 % and 65.29 %. This resolves the earlier agent's 'scrambled table' doubt: the values sit in the MASS column and the DI Water row by word coordinates (pdf read with PyMuPDF).",
   FLV5 + " (TDS pages 9-10, downloaded 2026-11-12)", "high",
   "DI 88.63% 89.21% 105.36% 101.38% ... 65.29% 67.62% 83.53% 103.23%", "+1.38 % (1 d), +3.23 % (1 wk)"),
 F("First kinetic parameters for a Formlabs resin: a two-point Fickian inversion of the Grey V5 bars (ratio 3.23/1.38 = 2.34, below sqrt7 = 2.65, so the curve is bending to a plateau) gives x = D t/l^2 = 0.0279 at 1 d, equilibrium uptake M_inf about 3.7 % (the bars would be 38 % saturated at 1 d and 88 % at 1 wk) and D = 3.3e-12 m2/s for an ASSUMED 3.2 mm bar (1.3e-12 at 2 mm, 5.2e-12 at 4 mm; the TDS does not state bar thickness). Cross-check: the same D and M_inf predict 1.17 % for a 10 mm cube at 24 h against Formlabs' 0.8 % (Grey V5) and 0.9 % (Clear V5).",
   SCRIPT + " (inputs from the Formlabs TDS above and " + FLSOL + ")", "medium",
   "", "D~3.3e-12 m2/s (assumed 3.2 mm); M_inf~3.7 %"),
 F("Formlabs Flexible 80A V2 slabs (ASTM D471) in DI water: +8 % mass and +3 % volume at 1 day, +9 % mass and +7 % volume at 1 week (confirmed by word coordinates: the 'Deionized Water' label sits between the 1-day and 1-week lines). Because 8 to 9 % is close to a plateau, a Fickian inversion gives D = 9.3e-12 m2/s, and D >= 6.3e-12 m2/s allowing for the integer rounding of the percentages, for an ASSUMED 2 mm slab (thickness not stated in the TDS); D scales with thickness squared (2.3e-12 if the slab were 1 mm).",
   FL80 + " (page 6, downloaded 2026-11-12); inversion in " + SCRIPT, "medium",
   "Deionized Water 1 day -26 +8% +3% 94% 89% ; 1 week -27 +9% +7% 101% 88%", "D~9.3e-12 m2/s (>=6.3e-12), assumed 2 mm"),
 F("The two Formlabs numbers for 'Flexible 80A' water uptake cannot be reconciled by kinetics: with D >= 6.3e-12 m2/s a 1 cm cube should reach 42 % of its plateau in 24 h, i.e. about 3.8 % mass for a 9 % plateau, against 0.7 % reported in the cube table. So the 'Flexible 80A Resin' row and 'Flexible 80A V2' are most likely different formulations (the earlier agents left V1 versus V2 open); this supports reading V2 as the swelling material only if the V2 cube value is measured.",
   SCRIPT + " section 5h; cube value from " + FLSOL, "medium",
   "Flexible 80A Resin | 0.9 | 37.4 | 0.6 | 51.4 | 2.3 | 19.3 | 1 | 0.7 | 1.6 | 11.7 | <0.1 | 0.1 | 0.5 | 10.7"),
 F("Confirmed: Elastic 50A V2 gains 39.2 % mass in isopropanol in 24 h (acetone 43.4 %, TPM 45.6 %, water 0.7 %) while Rigid 10K gains <0.1 % in isopropanol and water (1 cm cubes). Interpreting the cube as 3-D Fickian with a 43-50 % plateau, D of isopropanol in Elastic 50A is about 3.6e-11 to 6.7e-11 m2/s (own estimate), so a 0.4 mm layer is within 90 % in about 34-62 min on one face: a rubbery elastomer takes up its solvent roughly 10-60x faster than stock glassy resins take up water (solvent and water differ, so indicative only).",
   FLSOL + " (HTML table parsed, saved at D:/Users/ashenoy00000/delphi-work/data/bm-diffusion-kinetics/solvent.html); inversion in " + SCRIPT, "medium",
   "Elastic 50A Resin V2 | 1.5 | 43.4 | 0.6 | 133.1 | 7.9 | 31.4 | 3.9 | 0.9 | 15.6 | 39.2 | 0.4 | 0.7", "IPA 39.2 % at 24 h"),
 F("Why '<1 % in 24 h' is not an equilibrium number: a 10 mm cube reaches only 7 % (D=1.4e-13), 19 % (1e-12), 51 % (1e-11) and 96 % (1e-10 m2/s) of its equilibrium uptake in 24 h; a 3 mm cube 23 %, 53 %, 97 % and 100 %. For Grey V5 the fitted equilibrium is about 3.7 %, four times the 24 h cube value. Earlier records state the 24 h figure is short-time; this puts numbers on how short.",
   SCRIPT + " section 4", "high", "", "10 mm cube, 24 h: 19 % of plateau at D=1e-12"),
 F("Sintered PA12 (SLS) saturates fast compared with dense PA12: 8 x 8 mm cylinders gained mass 'sharply in the first 36 h' and reached 5.47 % (CF/PA12: 4.6 % after 24 h). Own apparent-D bracket 1.3e-11 to 3.0e-11 m2/s if 90-99 % was reached at 36-72 h (the curve could not be read numerically). This is mostly open pores filling, not polymer-matrix diffusion, and the 5.5 % is 3-4x the dense PA12 saturation (1.6 %) in the earlier record.",
   EPMC.format("PMC9320715") + " (10.3390/mi13071041)", "low",
   "Δ m of PA12 sample increases sharply in the first 36 h as the samples were immersed into water. With further prolonged immersed time, the Δ m increases slowly and reaches a saturation state with Δ m of 5.47%.", "apparent D 1.3e-11 to 3e-11 m2/s (assumed fractions)"),
 F("Hot-pressed PA11 and PA12 (dense) took 'around two months' to reach water saturation (1.5 % in water, 0.8 % in humid air); specimen thickness for the durability series is not stated (sheets 1 mm, bulk 4 mm), so no D is derived.",
   EPMC.format("PMC8537549") + " (10.3390/polym13203553)", "medium",
   "After around two months, both PAs had the same saturation level for water and moisture absorption, i.e., 1.5% and 0.8%, respectively."),
 F("Epoxy-based stereolithography parts show anomalous (non-Fickian) water uptake that looks pseudo-Fickian, fitted by dual-sorption, diffusion-relaxation and dual-Fickian models. Quoted from a web-search extract of the Loughborough repository page; the page itself returned 403/anti-bot, and Crossref gives no abstract, so I did not read the paper or any D value.",
   "https://repository.lboro.ac.uk/articles/journal_contribution/Environmental_ageing_of_epoxy-based_stereolithography_parts_Part_1_moisture_transport/9564056 (10.1179/1743289811y.0000000024); not fetched directly", "low",
   "Moisture transport in three different epoxy-based stereolithography materials has been investigated using mass uptake experiments. The results show that anomalous (non-Fickian) diffusion occurs to varying degrees in all three materials, the characteristic uptake appearing to be pseudo-Fickian."),
 F("Fickian (Case I) uptake is linear in the square root of time; the exponent n in M_t/M_inf = K t^n is 0.5 for Fick, 1 for Case II, in between for anomalous transport. Fickian behaviour needs polymer relaxation much faster than diffusion (rubbery state); Case II needs diffusion much faster than relaxation, typical of glassy polymers with strongly plasticising penetrants; anomalous when the two rates are comparable.",
   "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7023388/fullTextXML (10.3390/polym12010138) and PMC11359223 (10.3390/polym16162265); classical sources Alfrey-Gurnee-Lloyd 1966, Thomas-Windle 1982 and Ritger-Peppas 1987 are DOI-verified only, not read", "medium",
   "(1) Case I (Fick’s diffusion, n = 0.5). Polymer relaxation is much faster than water diffusion, and the diffusion is followed by an instantaneous response of the system, resulting in Fick’s behavior."),
 F("Which polymers: rubbery polymers are typically Fickian, many glassy polymers are Fickian at low solubility, Case II appears in glassy polymers with highly absorbent liquids when the absorbed liquid plasticises the polymer.",
   EPMC.format("PMC11359223") + " (10.3390/polym16162265)", "medium",
   "Rubbery polymers typically demonstrate Fickian diffusion due to their rapid response to environmental changes. Additionally, many glassy polymers also display Fickian diffusion under conditions where liquid solubility levels are relatively low."),
 F("Case II is a moving front: the dissolution/swelling front propagates as a wave into the undissolved glassy polymer, so the penetration time scales with distance (t ~ h / v, front speed v) rather than distance squared. A crossover length h* = D/v separates the two regimes (own scaling, no measured v for any Formlabs resin exists in what I found).",
   "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12574211/fullTextXML (10.1021/acs.macromol.5c02222); scaling is own", "medium",
   "this frontal dissolution process in glassy miscible polymer films closely resembles the phenomenology of Case II non-Fickian diffusion commonly observed in the dissolution of glassy polymers by solvents"),
 F("Water also plasticises the glassy resins, which couples D to the state of the network: Grey V5 bars keep only about 65 % of dry modulus after one week in water, PA6.6 falls to about 21 %. A swollen layer is softer, so the bilayer's n changes during the experiment, but the optimum curvature (3/2) does not depend on n.",
   FLV5 + " (modulus column); earlier agent spec-resin-chemistry.json for PA6.6", "medium",
   "65.29% 67.62% 83.53% 103.23%"),
 F("Bilayer curvature kinetics, own laminate calculation (active layer on one face, Fickian eigenstrain profile, bonded passive layer impermeable): at the optimum m^2 n = 1 the curvature reaches 50 %, 90 % and 99 % of its final value at 0.091, 0.719 and 1.65 h_a^2/D, identical for modulus ratios n = 1, 0.1, 0.01. Uptake itself needs 0.197, 0.849 and 1.78 h_a^2/D. Curvature leads mass uptake early (bending is dominated by the outer, wettest fibre) but equilibrium time is within 8 % of the uptake time. Away from the optimum the thickness ratio m shifts these (m = 2: 0.036, 0.528, 1.46; m = 0.5: 0.142, 0.789, 1.72).",
   SCRIPT + " section 8", "high", "", "curvature t99 = 1.65 h_a^2/D at m^2 n = 1"),
 F("Independent numerical check of the project record's 3/2 ceiling: the same laminate code run with uniform eigenstrain returns kappa h/d_eps = 1.500000 at (m,n) = (1,1), (3.162, 0.1), (10, 0.01) and (0.316, 10), all with m^2 n = 1, and equals the Timoshenko formula f(m,n) at (1, 0.1) = 0.99585 and (0.5, 3) = 1.49309. This confirms the formula numerically; it is not the Lean proof.",
   SCRIPT + " section 8 (saturation_check in results.json)", "high", "", "f = 1.5 at m^2 n = 1"),
 F("Verdict for a demonstration (one-face exposed active layer, t90): D ~ 1e-10 to 1e-9 m2/s (hydrogel, PEG-acrylate, porous or PDMS) finishes in minutes to hours at every thickness 0.2-1.6 mm (1.6 mm: 6 h at 1e-10). D ~ 1e-11 (Flexible 80A V2 class, Bis-GMA) gives 57 min (0.2 mm), 3.8 h (0.4), 15 h (0.8) and 2.5 d (1.6). D ~ 1e-12 (stock rigid acrylate resins, PET-G, PC) gives 9 h, 38 h, 6.3 d and 25 d. D ~ 3e-13 (PA11/PA12-class, nylon, TPU) gives 1.3 d, 5.2 d, 21 d and 12 weeks.",
   SCRIPT + " (equilibration_table.csv)", "high", "", "hours: D>=1e-11 and h<=0.8 mm; days: D~1e-12 and h<=0.8 mm; weeks: D<=5e-13 and h>=0.8 mm"),
 F("Printable thickness floors from the project record: 0.2 mm on Form 4 (Grey V5) and 0.3-0.6 mm on Fuse. At those floors one-face t90 is 1.8 d for 0.3 mm and 7.1 d for 0.6 mm of dense PA11 (D = 4.95e-13; 0.848 x h^2/D, e.g. 0.848 x (0.6e-3)^2 / 4.95e-13 = 6.2e5 s), and 9.4 h for 0.2 mm of a stock rigid resin at D = 1e-12.",
   "D:/Users/ashenoy00000/delphi-work/agents/spec-formlabs-materials.json (floors); own arithmetic in " + SCRIPT, "medium", ""),
]

key_claims = [
 {"claim": "Time to equilibrium scales as h^2/D with fixed constants: for an active layer exposed on one face (bilayer) t50 = 0.197, t90 = 0.848, t99 = 1.78 h^2/D; for both faces exposed multiply by 1/4. The curvature of an optimal bilayer reaches 99 % at 1.65 h_a^2/D regardless of modulus ratio.",
  "evidence_quote": "", "source": SCRIPT + " (finite-volume check x50 = 0.04918 equals the Crank series; bilayer laminate reproduces the 3/2 ceiling)"},
 {"claim": "Measured water diffusivities span about four decades: dense polyamide, TPU and filament thermoplastics 1.4e-13 to 5e-12 m2/s, methacrylate/acrylate resins 1.5e-12 to 1.1e-11, hydrogels and PEG-acrylates 4e-11 to 2e-10, PDMS and porous media 6e-10 to 1e-9.",
  "evidence_quote": "Diffusion coefficients ranged from 1.40 × 10 −13 to 3.40 × 10 −12 m 2 s −1 , with no monotonic dependence on hardness.",
  "source": "10.3390/polym18111392; 10.3390/polym15122600; 10.3390/polym10070717; 10.1016/j.dental.2011.06.007; 10.1073/pnas.2207422119; arXiv:2401.05139"},
 {"claim": "Formlabs' own 1 day / 1 week mass data imply the first D for Formlabs resins: about 3e-12 m2/s for Grey V5 (equilibrium ~3.7 %, assumed 3.2 mm bars) and >= 6e-12 m2/s for Flexible 80A V2 (assumed 2 mm slabs); the '<1 % in 24 h' cube numbers are therefore far from equilibrium (a 10 mm cube at D=1e-12 reaches ~19 % of plateau).",
  "evidence_quote": "DI 88.63% 89.21% 105.36% 101.38% ... 65.29% 67.62% 83.53% 103.23%", "source": FLV5 + " ; " + FL80 + " ; own inversion in script"},
 {"claim": "A demonstration that finishes in hours needs D >= 1e-11 m2/s (elastomer such as Flexible 80A V2, or a PEG-acrylate/hydrogel layer) with an active layer of 0.2-0.8 mm; stock rigid resins (D~1e-12) at 0.2-0.4 mm give 9-38 h; 0.8 mm or more, or dense nylon/TPU, takes days to weeks.",
  "evidence_quote": "", "source": SCRIPT + " equilibration_table.csv"},
]

reproduce = [
 {"what": "Check Python and libraries", "command_or_url": "python --version ; python -c \"import numpy, scipy; print(numpy.__version__, scipy.__version__)\"", "expected": "Python 3.14.2, numpy 2.5.3, scipy 1.18.1 were used (any Python >= 3.10 with numpy/scipy should work)"},
 {"what": "Run the calculation (about 40 s, writes results.json, equilibration_table.csv; prints all tables)", "command_or_url": "cd D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-diffusion-kinetics && python -P diffusion_kinetics.py", "expected": "half-time 0.04918 (finite-volume check 0.04918); one-face t90 = 0.848 h^2/D; Grey V5 D = 3.30e-12 (3.2 mm), M_inf 3.66 %; Flexible 80A V2 D 9.32e-12 (2 mm); desorption/sorption half-time 2.46 at D ratio 21.4; bilayer curvature t99 1.652 h^2/D; f = 1.5 at m^2 n = 1"},
 {"what": "Rebuild the report JSON from results.json", "command_or_url": "python -P build_result.py", "expected": "writes D:/Users/ashenoy00000/delphi-work/agents2/bm-diffusion-kinetics.json"},
 {"what": "Re-read the Formlabs Flexible 80A V2 data (PDF page 6; read by word position, e.g. PyMuPDF get_text('words'))", "command_or_url": FL80, "expected": "Deionized Water 1 day -26 / +8 % / +3 %; 1 week -27 / +9 % / +7 %"},
 {"what": "Re-read the Grey V5 immersion tables (pages 9 and 10)", "command_or_url": FLV5, "expected": "DI Water row, MASS column: 101.38 % at 1 day, 103.23 % at 1 week"},
 {"what": "Re-read the Formlabs solvent table (water = 18th data column, isopropyl alcohol = 10th)", "command_or_url": FLSOL, "expected": "Elastic 50A Resin V2: IPA 39.2, water 0.7; Rigid 10K: IPA <0.1, water <0.1"},
 {"what": "Re-fetch open-access source texts", "command_or_url": "curl -s -A delphi-research/0.1 https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10304609/fullTextXML (also PMC13258891, PMC6404017, PMC9457170, PMC11643832, PMC8124584, PMC11359223, PMC7023388, PMC9320715) ; https://arxiv.org/pdf/2406.15224 ; https://arxiv.org/pdf/2401.05139 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/", "expected": "Table values as quoted in findings; copies and sha256 listed in D:/Users/ashenoy00000/delphi-work/data/bm-diffusion-kinetics/MANIFEST.tsv"},
 {"what": "Verify citations", "command_or_url": "https://api.crossref.org/works/<doi> for each DOI in citations; https://export.arxiv.org/api/query?id_list=2406.15224 and 2401.05139", "expected": "titles as listed; all resolved on 2026-11-12"},
]

def C(authors, year, title, doi, used, how="Crossref API https://api.crossref.org/works/<doi> returned this title, year and authors on 2026-11-12", venue=""):
    return {"authors": authors, "year": year, "title": title, "doi_or_arxiv": doi, "verified": True, "how_verified": how, "used_for": used, "venue": venue}

citations = [
 C("Aniskevich A., Bulderberga O., Stankevics L.", 2023, "Moisture Sorption and Degradation of Polymer Filaments Used in 3D Printing", "10.3390/polym15122600", "D of 12 filaments; humidity dependence; swelling strain; Nylon shrinkage (full text read via Europe PMC PMC10304609)", venue="Polymers 15, 2600"),
 C("Oliver-Ortega H., Mendez J.A., Espinach F.X. et al.", 2018, "Impact Strength and Water Uptake Behaviors of Fully Bio-Based PA11-SGW Composites", "10.3390/polym10070717", "neat PA11 D at 23 and 40 C; n exponents (Europe PMC PMC6404017)", venue="Polymers 10, 717"),
 C("Simunic L., Kostadin T., Hoster (first three authors per Crossref) et al.", 2026, "Hygroscopic Behaviour and Diffusion Characteristics of Flexible TPU Materials Fabricated by FDM for Potential Biomedical Applications", "10.3390/polym18111392", "TPU D range (Europe PMC PMC13258891; author list as returned by Crossref: first author Simunic)", venue="Polymers 18, 1392"),
 C("Sideridou I.D., Karabela M.M.", 2011, "Sorption of water, ethanol or ethanol/water solutions by light-cured dental dimethacrylate resins", "10.1016/j.dental.2011.06.007", "D of water in dimethacrylate resins (abstract only; Europe PMC search API and PubMed 21783239)", venue="Dental Materials"),
 C("Sideridou I.D., Karabela M.M., Vouvoudi E.C.", 2008, "Volumetric dimensional changes of dental light-cured dimethacrylate resins after sorption of water or ethanol", "10.1016/j.dental.2007.12.009", "linear relation of volume change to sorbed amount (abstract only)", venue="Dental Materials"),
 C("Cui, Yu, Ye et al. (first three authors per Crossref)", 2022, "Mechanism of temperature-induced asymmetric swelling and shrinking kinetics in self-healing hydrogels", "10.1073/pnas.2207422119", "tau ~ h^2, D_sw of hydrogels, D = (K+4mu/3)/f (Europe PMC PMC9457170)", venue="PNAS"),
 C("VanZanten A., Chen S.-Y., Driscoll M.M., Szczepanski C.R.", 2024, "Unconstrained dynamic gel swelling generates transient surface deformations", "arXiv:2406.15224", "PEGDA-700/PEGMEMA swelling time constants, 2 mm slabs (PDF read; values checked on page image)", how="arXiv export API https://export.arxiv.org/api/query?id_list=2406.15224 returned this title, published 2024-06-21", venue="arXiv cond-mat.soft preprint, not peer reviewed"),
 C("authors not recorded in this run", 2024, "Directional drying of a colloidal dispersion: quantitative description with water potential measurements using water clusters in a poly(dimethylsiloxane) microfluidic chip", "arXiv:2401.05139", "second-hand D of water in PDMS, 6-8e-10 m2/s", how="arXiv export API https://export.arxiv.org/api/query?id_list=2401.05139 returned this title, published 2024-01-10", venue="arXiv preprint"),
 C("Pino A., Ibanez-Felip I., Vidal R.", 2024, "Water Absorption of Underwater Products by Additive Manufacturing", "10.3390/ma17235953", "saturation times of 1 mm LCD-resin plates (Europe PMC PMC11643832)", venue="Materials 17, 5953"),
 C("Reyssat E., Mahadevan L.", 2009, "Hygromorphs: from pine cones to biomimetic bilayers", "10.1098/rsif.2009.0184", "tau ~ h^2/D, D ~ 1e-9, measured exponents 1.3 and 1.5 (PMC2838359 page read)", venue="J. R. Soc. Interface 6"),
 C("Sambale A.K., Stanko M., Emde J., Stommel M.", 2021, "Characterisation and FE Modelling of the Sorption and Swelling Behaviour of Polyamide 6 in Water", "10.3390/polym13091480", "concentration-dependent D of PA6; Case I = square-root-of-time (Europe PMC PMC8124584)", venue="Polymers 13, 1480"),
 C("Hassanpour B., Karbhari V.M.", 2024, "Characteristics and Models of Moisture Uptake in Fiber-Reinforced Composites: A Topical Review", "10.3390/polym16162265", "definitions of Fickian, Case II, anomalous diffusion (Europe PMC PMC11359223)", venue="Polymers 16, 2265"),
 C("Yang Y., Xing Y., Li Y. et al.", 2020, "A Comprehensive Review on Water Diffusion in Polymers Focusing on the Polymer-Metal Interface Combination", "10.3390/polym12010138", "n = 0.5 / 1 exponents for Case I / Case II (Europe PMC PMC7023388)", venue="Polymers 12, 138"),
 C("Yuan, Satija, Murray et al.", 2025, "A Neutron Reflection Study of the Dissolution of Miscible Glassy Polymer Films over a Range of Temperature", "10.1021/acs.macromol.5c02222", "Case II as a propagating front in glassy polymers (Europe PMC PMC12574211)", venue="Macromolecules"),
 C("Zheng X., Meng J., Liu Y.", 2022, "Strain Rate Dependence of Compressive Mechanical Properties of Polyamide and Its Composite Fabricated Using Selective Laser Sintering under Saturated-Water Conditions", "10.3390/mi13071041", "sintered PA12 saturates in about 36 h and 5.47 % (Europe PMC PMC9320715)", venue="Micromachines 13, 1041"),
 C("Bahrami M., Abenojar J. et al.", 2021, "Comparative Characterization of Hot-Pressed Polyamide 11 and 12: Mechanical, Thermal and Durability Properties", "10.3390/polym13203553", "dense PA11/PA12 saturate after about two months (Europe PMC PMC8537549; DOI is the one printed in the full text, resolved there, not separately in Crossref)", how="DOI read from the Europe PMC full-text XML of PMC8537549 on 2026-11-12; Crossref lookup not run for this one", venue="Polymers 13, 3553"),
 C("Altaf K., Ashcroft I.A., Saleh Y.", 2012, "Environmental aging of epoxy based stereolithography parts Part 1 - Moisture transport", "10.1179/1743289811y.0000000024", "anomalous uptake in epoxy SLA (abstract seen only as a web-search extract; paper not read)", venue="Plastics, Rubber and Composites"),
 C("Alfrey T., Gurnee E.F., Lloyd W.G.", 1966, "Diffusion in glassy polymers", "10.1002/polc.5070120119", "classical definition of Case II (DOI resolves; paper NOT read)", venue="J. Polym. Sci. C 12"),
 C("Thomas N.L., Windle A.H.", 1982, "A theory of case II diffusion", "10.1016/0032-3861(82)90093-3", "classical Case II theory (DOI resolves; paper NOT read)", venue="Polymer 23"),
 C("Ritger P.L., Peppas N.A.", 1987, "A simple equation for description of solute release II. Fickian and anomalous release from swellable devices", "10.1016/0168-3659(87)90035-6", "origin of the K t^n exponent classification (DOI resolves; paper NOT read)", venue="J. Controlled Release 5"),
 C("Tanaka T., Fillmore D.J.", 1979, "Kinetics of swelling of gels", "10.1063/1.437602", "origin of the cooperative-diffusion swelling theory (DOI resolves; paper NOT read)", venue="J. Chem. Phys. 70"),
]
# the Bahrami DOI was not Crossref-checked in this run; mark honestly
for c in citations:
    if c["doi_or_arxiv"] == "10.3390/polym13203553":
        c["verified"] = False
    if c["authors"].startswith("Hassanpour"):
        c["how_verified"] = "Crossref API returned title, year, first authors on 2026-11-12 (Hassanpour, Karbhari); full text read via Europe PMC"

could_not_find = [
 "A directly measured water diffusion coefficient for any Formlabs resin or powder. The values here are my own inversions of Formlabs' 1 day and 1 week mass gains and depend on an assumed specimen thickness (3.2 mm bars for Grey V5, 2 mm slabs for Flexible 80A V2); neither thickness is stated in the TDS. If the true thickness differs, D scales with its square.",
 "Water D for Formlabs Nylon 11/12, TPU 90A (SLS). PA11 (hot-pressed), TPU (FDM) and sintered PA12 data are used as analogues; laser-sintered parts differ in porosity and crystallinity. The 2024 Villani paper on sintered PA12 (10.1007/s40964-024-00826-3) was behind an access redirect, so the earlier agent's snippet D = 4.34e-11 vs 4.17e-12 m2/s is still unconfirmed.",
 "Any measured Case II front speed or anomalous-diffusion exponent n for water in a Formlabs resin or a printed SLA photopolymer. Ashcroft/Altaf 2012 (epoxy SLA) reports anomalous uptake but I could not read the paper (repository 403/anti-bot page) and have no D values from it.",
 "Primary reading of the classical Case II and swelling-kinetics papers (Alfrey 1966, Thomas-Windle 1982, Ritger-Peppas 1987, Tanaka-Fillmore 1979, Crank's book): DOIs resolve in Crossref but the texts are paywalled; the n = 0.5 and 1 definitions are taken from open-access reviews, and the Crank slab constants are reproduced by my own numerics.",
 "The diffusion coefficient in the PDMS paper is quoted second-hand (arXiv:2401.05139 citing its ref. 33) and the Randall & Doyle 2005 figure (~1e-9 m2/s) came from a search-tool snippet that I did not open; both are medium confidence.",
 "Sideridou 2011 specimen thickness and test temperature (abstract only), so the dimethacrylate D range cannot be tied to a thickness; I also could not confirm from the abstract which medium each listed D belongs to beyond the statement that D was highest in water.",
 "Thickness of the PA11/PA12 durability specimens in Bahrami 2021 (1 mm sheet or 4 mm bulk), so no D from the 'two months' saturation; the Zheng 2022 sintered-PA12 uptake curve was a figure whose values I could not read, so its apparent D is a bracket from an assumed 90-99 % at 36-72 h.",
 "Swollen thickness and exact equilibrium swelling of the PEGDA/PEGMEMA gels; D from tau used the dry 2 mm thickness (lower bound) and 3 mm (upper), not a measurement.",
 "Whether the Formlabs Flexible 80A (cube table) and Flexible 80A V2 (TDS) are different resin versions; kinetics alone cannot explain the factor of about 5-10 between 0.7 % and 8 %, so this remains open (the earlier agents left it open too).",
 "Humid-air (not immersion) diffusivities of any stock Formlabs resin; all Formlabs data are full-immersion, and Aniskevich shows D itself shifts 2-4x with humidity level for half of the filaments.",
 "Crossref check of the Bahrami 2021 DOI (10.3390/polym13203553) was not run in this session; it is marked verified=false although it was printed in the Europe PMC XML that I read.",
]

summary = ("Equilibration time of a polymer layer is t = c h^2/D with fixed constants: for a one-face-exposed active layer (the bilayer case) t50 = 0.197, t90 = 0.848 and t99 = 1.78 h^2/D; for two exposed faces divide by 4. My own laminate calculation shows an optimal hygromorph bilayer reaches 99 % of its final curvature at 1.65 h_a^2/D whatever the modulus ratio, and reproduces the project's 3/2 ceiling numerically. "
           "Measured water D spans four decades: 1.4e-13 to 5e-12 m2/s for dense polyamide, TPU and filament thermoplastics (Aniskevich 2023, PA11 Oliver-Ortega 2018, TPU 2026), 1.5e-12 to 1.1e-11 for dimethacrylate resins (Sideridou 2011), 4e-11 to 2e-10 for hydrogels and PEG-acrylates (PNAS 2022; arXiv 2406.15224), 6e-10 to 1e-9 for PDMS and porous tissue. "
           "No D has been published for a Formlabs resin, but Formlabs' own 1 day / 1 week mass gains imply D about 3e-12 (Grey V5, M_inf about 3.7 %, assumed 3.2 mm bars) and at least 6e-12 m2/s (Flexible 80A V2, assumed 2 mm slabs); the earlier '<1 % in 24 h' cube numbers are therefore far from equilibrium (a 10 mm cube at D = 1e-12 reaches 19 % of plateau in 24 h). "
           "D is not constant: it varies 2-4x with humidity in half the filaments and 21x with water content in PA6, which makes drying about 2.5x slower than wetting. Case II (front moving at constant speed, t ~ h) needs relaxation slower than diffusion in a glassy polymer plasticised by a strong penetrant; I found no measured Case II water data for any Formlabs material, only pseudo-Fickian or sub-Fickian reports (PA11 n = 0.27-0.31; epoxy SLA anomalous). "
           "Demonstration verdict (one face, t90): hours need D >= 1e-11 (Flexible 80A V2-class, hydrogel or PEG-acrylate layer, 0.2-0.8 mm; 0.2 mm Flexible 80A about 1 h); stock rigid resins at 0.2-0.4 mm need 9-38 h, at 0.8-1.6 mm 6-25 d; dense nylon or TPU at 0.8 mm or more need 3 weeks to many months.")

lay = ("A thin plastic strip that curls when it gets wet cannot curl faster than water can soak into it. The soaking time grows with the square of the thickness: a strip twice as thick takes four times as long, like a thick sponge versus a thin cloth. "
       "Stiff 3D-printed plastics and nylon soak up water very slowly, so a half-millimetre strip can take days or weeks to finish moving, while a soft rubbery print or a jelly-like layer finishes in an hour or a few hours. "
       "Formlabs' own one-day test numbers look small mostly because one day is too short for a thick block to fill up, not because the plastic cannot absorb more. "
       "So a demonstration that finishes in an afternoon needs a thin layer, 0.2 to 0.8 millimetres, of a soft or water-loving material, and a stiff nylon or resin strip is a week-long experiment.")

glossary = [
 {"term": "diffusion coefficient (D)", "plain": "How quickly water spreads through a material; larger means faster, in square metres per second."},
 {"term": "Fickian diffusion", "plain": "The ordinary slow spreading of water in which the soaking time grows with thickness squared."},
 {"term": "Case II diffusion", "plain": "A sharp wet front that moves into a glassy plastic at a steady speed, so time grows with thickness, not thickness squared."},
 {"term": "glassy / rubbery polymer", "plain": "A plastic that is hard and stiff (glassy) or soft and stretchy (rubbery) at the temperature of use."},
 {"term": "half-time (t50), t90, t99", "plain": "The time for the layer to fill to 50, 90 or 99 percent of its final water content."},
 {"term": "one-face exposure", "plain": "Water can enter only through one side because the other side is glued to a layer that water does not enter."},
 {"term": "plasticise", "plain": "Soften a plastic by letting a small molecule such as water get between the chains."},
 {"term": "hygromorph bilayer", "plain": "Two bonded layers, one of which swells in water, so the strip bends like a bimetal strip."},
 {"term": "equilibrium (saturation)", "plain": "The point where the material has taken up all the water it will take at those conditions."},
 {"term": "poroelastic", "plain": "A sponge-like material whose swelling speed is set by water flowing through its pores while the network deforms."},
 {"term": "Arrhenius / activation energy", "plain": "A rule that diffusion speeds up by a fixed factor for each rise in temperature; the activation energy sets the factor."},
 {"term": "TDS", "plain": "Technical data sheet published by the manufacturer."},
]

recommendations = [
 "Demonstration thickness: print the swelling layer at 0.2-0.4 mm and choose a high-D material (Flexible 80A V2 or a PEG-acrylate/hydrogel resin in Open Material Mode); expect 1-4 h for 0.2-0.4 mm Flexible 80A V2 at D about 1e-11 and minutes to an hour for PEG-acrylates. A stock rigid-resin or nylon active layer is a week-scale experiment.",
 "Make the first measurement the one that is missing: immerse thickness-matched coupons (0.2, 0.4, 0.8, 1.6 mm, both faces open) and weigh at 1, 4, 24, 72 h and 7 d; fit D from the sqrt(t) slope and the plateau. This replaces my assumed-thickness inversions and also gives n, which decides Fickian versus relaxation-limited.",
 "Report the exposure geometry and use h_eff = 2 h for a one-face bilayer; treat the time to read curvature as 1.65 h_a^2/D (99 %), not h^2/D.",
 "If time is the constraint, warm the bath: PA11 data imply about 4x per 17 C (extrapolated about 10x at 50 C), but check the strain and modulus at that temperature separately.",
 "Plan for drying being 2-4x slower than wetting if D rises with water content; time the dry half-cycle separately.",
 "Do not read the Formlabs 24 h cube percentages as saturation values; use the 1 week figure or your own plateau.",
]

result = {
 "label": "bm-diffusion-kinetics",
 "topic": "Time to equilibrate: diffusion, poroelasticity and thickness scaling",
 "summary": summary, "lay_summary": lay, "glossary": glossary,
 "findings": findings, "key_claims": key_claims, "table": table,
 "recommendations": recommendations, "reproduce": reproduce, "citations": citations, "could_not_find": could_not_find,
 "scripts_written": [SCRIPT, "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-diffusion-kinetics/build_result.py",
                     "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-diffusion-kinetics/results.json (output)",
                     "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-diffusion-kinetics/equilibration_table.csv (output)",
                     "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-diffusion-kinetics/run_output.txt (captured stdout)"],
 "earlier_work_checked": {
   "confirmed": ["Flexible 80A V2 +8 %/+9 % mass and +3 %/+7 % volume in DI water (spec-formlabs-materials.json), now by word coordinates",
                 "Grey V5 bars +1.38 % (1 d), +3.23 % (1 wk) with modulus 88.63 % and 65.29 % (spec-resin-chemistry.json): the 'scrambled table' mapping is correct",
                 "Elastic 50A V2 39.2 % in isopropanol vs <0.1 % for Rigid 10K (24 h, 1 cm cubes)",
                 "Aniskevich filament D 0.001-0.0151 mm2/h and swelling 0.15-0.25 % (spec-bilayer-physics.json)",
                 "Low-cost acrylate resins take 2.5 to >8 days to saturate (1 mm plates; spec-resin-chemistry.json)"],
   "deepened": ["No D for any Formlabs resin was found: still no direct measurement, but two derived estimates now exist (Grey V5 about 3e-12, Flexible 80A V2 >= 6e-12 m2/s, thickness assumed)",
                "'Under 1 % in 24 h': the number is right but is a kinetic snapshot; equilibrium for Grey V5 is about 3.7 % (4x higher)",
                "spec-bilayer-physics.json used tau = h^2/D: for a one-face layer this is within 18 % of t90 (0.848 h^2/D) but overstates both-face t90 by 4.7x; exact constants are now given"],
   "contradicted_or_qualified": ["design-biomaterial.json 'D about 1e-11 m2/s, 90 % in 4 h for a 0.8 mm layer' is a both-faces-open number (t90 = 0.212 l^2/D = 3.8 h); for a one-face bilayer layer it is 15.1 h. The D itself is consistent with my Flexible 80A V2 estimate (9e-12, >= 6e-12), but it rests on an unverified 2 mm slab.",
                                 "The earlier note that Flexible 80A uptake differs ten-fold between cube table (0.7 %) and TDS (8 %) cannot be explained by diffusion kinetics (predicted cube value >= 3.8 %), which favours a resin-version difference."]},
}
json.dump(result, open(OUTFILE, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("wrote", OUTFILE, os.path.getsize(OUTFILE), "bytes;", len(findings), "findings;", len(table), "table rows;", len(citations), "citations")
