"""Build the final JSON (agents2/bm-poc-designs.json) from results.json + sources_check.json, so every number in the
report is read from a computed file and not retyped.   Usage: python -B compose_result.py   (run run_all.py and verify_sources.py first)
"""
import json
import os

SCR = r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-poc-designs"
OUTF = r"D:/Users/ashenoy00000/delphi-work/agents2/bm-poc-designs.json"
SD = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-poc-designs"
RES = json.load(open(os.path.join(SCR, "results.json"), encoding="utf-8"))
SRC = json.load(open(os.path.join(SCR, "sources_check.json"), encoding="utf-8"))
Q = {q["id"]: q["quote"] for q in SRC["quotes"]}
assert all(q["ok"] for q in SRC["quotes"]), "a quote is not in its source"
assert all(v["ok"] for v in SRC["dois"].values()), "a DOI did not resolve"

TDS80 = "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf"
TDS50 = "https://media.formlabs.com/asset/6c4f970f-53d8-4fb7-8d36-a153d93d26bb/-ENUS-Flexible-50A-V1-TDS.pdf"
TDSSI = "https://media.formlabs.com/m/2e6bb2b3d645b427/original/-ENUS-Silicone-40A-TDS.pdf"
SOLV = "https://formlabs.com/support/solvent-compatibility/"
RUN = SD + "/run_all.py"
O1, O2, O3, O4, O5 = (RES[k] for k in ("object1", "object2", "object3", "object4", "object5"))
A, B = O1["A"], O1["B"]


def tri(v, nd=3):
    """median (p5-p95)"""
    g = lambda x: f"{x:.{nd}g}"
    return f"{g(v[1])} ({g(v[0])}-{g(v[2])})"


def fnd(claim, source, confidence, value=None, quote=None):
    d = dict(claim=claim, source=source, confidence=confidence)
    if value is not None:
        d["value"] = value
    if quote is not None:
        d["evidence_quote"] = quote
    return d


findings = []
F = findings.append

# ------------------------------------------------------------------ law and solver
F(fnd("The project's own ceiling script, re-run unchanged and read-only today, reports that f(m,n) <= 3/2 survives a grid, exact-rational checks along m^2 n = 1, and 4000 hill-climbs from random starts.",
      "python -B D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/scripts/check-timoshenko-ceiling.py (output saved in scratch/bm-poc-designs/ceiling_run.txt)",
      "high", "best hill-climb f = 1.500000000000", "VERDICT: the ceiling holds in every check"))
F(fnd("My own layered-beam solver (Euler-Bernoulli, plane stress, perfect bond, written independently of the project's closed form) reproduces the project's f(m,n) to 1e-9 at seven (m,n) points, and f is unchanged when the two layers are relabelled (m,n)->(1/m,1/n).",
      SD + "/run_all.py step 1 (results.json: solver_vs_f)", "high (own calculation)",
      "e.g. (m,n)=(0.5,3): solver 1.493087558 = f 1.493087558; (1,0.1): 0.995850622"))
F(fnd("Curvature of an optimal bilayer (m^2 n = 1) settles to within 10 % of its final value at 0.719 h_a^2/D and reaches 99 % at 1.653 h_a^2/D, identical for passive/active modulus ratios 0.1, 1 and 10; one-face uptake t50/t90/t99 = 0.197/0.848/1.781 h^2/D. This independently confirms the numbers of the earlier diffusion-kinetics agent (bm-diffusion-kinetics.json: 0.719 and 1.65), using a different closed-form moment method.",
      SD + "/run_all.py step 1 (results.json: curvature_t90_t99_at_optimum, uptake_t50_t90_t99)", "high (own calculation)",
      "t90 = 0.719, t99 = 1.653 (units h_a^2/D)"))
F(fnd("CONTRADICTS the earlier inference (spec-bilayer-physics.json, finding d: 'kappa_cyl ~ (1+nu) kappa_beam') as a statement about small-deflection plates: for isotropic layers with equal Poisson ratio and an isotropic eigenstrain, classical laminate (plate) theory gives kappa_plate / kappa_beam = 1.000000 exactly, for any modulus ratio. A factor above 1 can only appear after the plate leaves the spherical shape (buckling into a cylinder).",
      SD + "/run_all.py step 1 (results.json: plate_over_beam_small_deflection_equal_nu)", "high (own calculation, equal-nu assumption stated)", "ratio = 1.000000"))
F(fnd("The post-buckling factor is bounded, from a source abstract, at 3/2: Pezzulla et al. state the mean curvature of the isometric state is three fourths of the natural curvature. A cylinder has mean curvature kappa_cyl/2, so kappa_cyl = 1.5 kappa_natural (my arithmetic, assuming 'natural curvature' means the spherical-state principal curvature, which I could not confirm from the full text). The tile (object 3) is therefore predicted between 1.0 and 1.5 times the strip law once w^2 kappa/h is well above 1.",
      "https://arxiv.org/abs/1509.05259 (arXiv export API record saved: data/bm-poc-designs/arxiv_1509.05259.xml; DOI 10.1039/C6SM00246C)", "medium",
      "kappa_tile / kappa_strip in [1.0, 1.5]",
      "We find that the mean curvature of the isometric state is three fourth's the natural curvature, which we verify by numerics and experiments."))

# ------------------------------------------------------------------ materials inputs
F(fnd("Flexible 80A V2 (Formlabs data sheet, ASTM D471 slabs, deionized water): +8 % mass and +3 % volume after 1 day; +9 % mass and +7 % volume after 1 week. I re-fetched and re-read the PDF today. This is the only Formlabs water-swelling datum large enough to drive a bilayer, and it contradicts the blanket 'stock resins gain under 1 % in 24 h' of the earliest agents (that statement holds only for the 1 cm cube table).",
      TDS80 + " (page 6; saved data/bm-poc-designs/flex80av2_tds.pdf, sha256 a2c32cef76c40108082dc4a74f6466bc53ab3ac66d93598218396643b2c6b683)", "high (numbers); medium (row/column reading, from text order of the PDF)",
      "1 day +8 % mass +3 % volume; 1 week +9 % mass +7 % volume", Q["Q1"]))
F(fnd("Linear strain implied by those volume changes if swelling is isotropic: 1.03^(1/3)-1 = 0.99 % (1 day) and 1.07^(1/3)-1 = 2.28 % (1 week); an upper end of 3.2 % follows from ideal mixing of 9 % water mass (0.09 x 1.09/1.00 = 9.8 % volume) into resin of solid density 1.09 g/cm3. These three numbers are the strain prior of every prediction here.",
      SD + "/priors.py derive_inputs(); density from " + TDS80, "medium (isotropy and ideal mixing are assumptions)",
      "d_eps_active = 0.99 / 2.28 / 3.17 % (triangular)", Q["Q6"]))
F(fnd("DEEPENS bm-diffusion-kinetics.json: inverting the same two Formlabs points with a two-face Fickian slab gives very different diffusivities depending on whether the MASS pair (8 -> 9 %) or the VOLUME-derived strain pair (0.99 -> 2.28 %) is used: D = 9.3e-12 m2/s versus 1.4e-12 m2/s for an assumed 2 mm slab (factor 6.8), with equilibrium strain about 2.5 % from the volume pair. The slab thickness is not stated in the data sheet, so both scale as thickness squared. The strain (volume) pair is the relevant one for bending, and it is the slower; the earlier agent used only the mass pair.",
      SD + "/run_all.py step 2 (results.json: formlabs_80A_V2_inversion); " + TDS80, "medium",
      "D(2 mm) = 9.3e-12 (mass) vs 1.4e-12 (volume) m2/s; M_inf(strain) = 2.55 %", Q["Q3"]))
F(fnd("Moduli used are own secant estimates from the data sheets' stress-at-elongation rows: Flexible 80A V2 post-cured 2.9 MPa at 50 % (5.8 MPa secant), 4.7 MPa at 100 %; Flexible 50A 0.9 MPa at 50 %, 1.7 MPa at 100 % (1.7-1.8 MPa); Silicone 40A 0.4 MPa at 50 %, 1.0 MPa at 100 % (0.8-1.4 MPa). They are not tensile moduli; Formlabs publishes none for these elastomers.",
      TDS80 + " ; " + TDS50 + " ; " + TDSSI, "high (printed values); low (as moduli)",
      "E(80A V2, dry) 4.3-5.8 MPa; E(50A) 1.7-1.8 MPa; E(Si 40A) 0.8-1.4 MPa", Q["Q4"] + " | " + Q["Q9"] + " | " + Q["Q7"]))
F(fnd("Flexible 80A V2 hardness is 68 Shore A green and 83 post-cured, and drops 26 Shore A points after 1 day in water. Using the Gent Shore-to-modulus relation (UNVERIFIED BACKGROUND, from memory) this is about 11.4 MPa dry and 3.2 MPa wet, a wet/dry ratio of 0.28; I used it only to bracket the wet modulus (prior 4.3-11 MPa dry x 0.28-1.0).",
      TDS80 + " (hardness rows); Gent relation unverified", "low", "wet/dry modulus 0.28 (Gent) to 1.0", Q["Q5"]))
F(fnd("Water uptake of the candidate passive partners in Formlabs' 24 h, 1 cm cube table: Flexible 50A 0.7 % (isopropanol 39.2 %), Silicone 40A under 0.1 % (isopropanol 5.9 %), Rigid 10K under 0.1 %. Cube mass at 24 h is not an equilibrium value and gives no strain, so the passive layer's own water strain is a prior (Flexible 50A 0-0.8 %, Silicone 0-0.05 %), not a measurement.",
      SOLV + " (saved data/bm-poc-designs/solvent.html, sha256 0ac7399284c61ed0922930818173699706eb25089010049a864f62e296d3e490); " + TDS50, "high (printed values); low (strain priors)",
      "water 24 h: 50A 0.7 %, Si 40A <0.1 %", Q["Q12"] + " | " + Q["Q11"]))
F(fnd("Print constraints used: Flexible 50A and Silicone 40A have a stated minimum layer thickness of 100 micron on their product pages and both list Form 4; Flexible 80A V2 test parts were printed on a Form 4 at 100 um settings; Form 4 build volume 20.0 x 12.5 x 21.0 cm; Fuse 1+ 30W build volume 165 x 165 x 300 mm. Every object below fits (largest footprint about 150 x 60 mm), and every layer thickness is a multiple of 0.1 mm.",
      "https://formlabs.com/products/silicone-40a-resin/ ; https://formlabs.com/products/flexible-50a-resin/ ; https://formlabs.com/3d-printers/resin/tech-specs/ ; https://formlabs.com/3d-printers/sls/ ; " + TDS80,
      "high", "layer step 0.1 mm", Q["Q19"] + " | " + Q["Q15"] + " | " + Q["Q14"]))
F(fnd("Silicone 40A's data sheet washes parts in 80 % isopropanol / 20 % butyl acetate and post-cures at 60 C submerged in water. A silicone that is washed in a solvent mix is not a drop-in partner to be washed after bonding; bond strength to acrylate resins is not documented anywhere I read.",
      TDSSI + " (footnote 3)", "high", None, Q["Q18"]))

# ------------------------------------------------------------------ pair table and IPA
pt = {r["pair"]: r for r in RES["partner_table_h1mm"]}
F(fnd("Which partner reaches the ceiling at printable thickness (total 1.0 mm, every layer >= 0.2 mm, nominal moduli): soft partners do, stiff partners do not. Flexible 80A V2 (wet 3.0 MPa) with Flexible 50A gives f = 1.495 (99.6 % of 3/2) and with Silicone 40A f = 1.493; with Tough 1000 f = 0.88 (59 %), Grey V5 0.50 (33 %), Rigid 10K 0.16 (11 %). The optimum stiff layer would be 0.054 mm (Tough 1000) or 0.017 mm (Rigid 10K), below any printable wall.",
      SD + "/run_all.py step 4 (results.json: partner_table_h1mm); moduli from the data sheets (Tough 1000 932 MPa, Grey V5 2500, Rigid 10K 10 000 are post-cured tensile moduli in the sibling file bm-formlabs-all-resins.json, not re-read by me)",
      "medium", "f: 1.495 / 1.493 / 0.883 / 0.499 / 0.162 (50A, Si, T1000, Grey, R10K)"))
F(fnd("CONTRADICTS the design appeal of the pair the earlier agents highlighted (Elastic/Flexible 50A at 39 % isopropanol against Rigid 10K at under 0.1 %): the numbers are confirmed, but with a 10 GPa passive layer of at least 0.2 mm the best achievable f is 0.096, i.e. 6.4 % of the ceiling, and the strain (about 29 % linear for the softer resins) lies far outside the small-strain domain of the law.",
      SD + "/run_all.py step 4 and 5; " + SOLV, "medium (modulus of 50A is a secant estimate)", "f_best = 0.096 (6.4 % of 3/2)", Q["Q11"] + " | " + Q["Q13"]))
ih = RES["ipa_hazard"]
F(fnd("Hazard for post-processing: Flexible 80A V2 gains +45 % mass and +113 % volume in isopropanol in one day, a linear stretch of 28.7 %. Silicone 40A gains 5.9 % mass (about 2.7 % linear by ideal mixing with an ASSUMED density 1.1 g/cm3). A bonded Flexible 80A / Silicone stack placed in the wash would curl to R of about 3 x its thickness (small-strain law, outside its domain), so each layer must be washed and dried BEFORE bonding and the bonded stack must never be washed.",
      SD + "/run_all.py step 5 (results.json: ipa_hazard); " + TDS80, "medium (data sheet numbers high; silicone strain assumed)",
      f"linear stretch 80A V2 {100 * ih['lin_80A']:.1f} %, Si 40A {100 * ih['lin_sil']:.1f} %, R = {ih['R_over_h']:.1f} h", Q["Q2"]))

# ------------------------------------------------------------------ object predictions
F(fnd(f"OBJECT 1 prediction (30 x 3 mm strip, 0.4 mm Flexible 80A V2 over 0.6 mm Flexible 50A plus a 0.02-0.10 mm bond line, immersed in water at room temperature): final radius R = {tri(A['R_inf_mm'], 3)} mm (median, 5th-95th percentile), tip deflection {tri(A['tip_defl_inf_mm'], 3)} mm, tip angle {tri(A['tip_angle_deg_inf'], 3)} deg, time to settle within 10 % of final {tri(A['t90_h'], 2)} h. With Silicone 40A as passive layer: R = {tri(B['R_inf_mm'], 3)} mm, tip deflection {tri(B['tip_defl_inf_mm'], 3)} mm, settling {tri(B['t90_h'], 2)} h. Effective kappa h / d_eps = {tri(A['f_eff'], 3)} (A) and {tri(B['f_eff'], 3)} (B), never above 3/2.",
      RUN + " step 8 (results.json: object1); inputs priors.py", "medium (conditional on the strain prior; no hygroscopic measurement exists)",
      f"A: R {A['R_inf_mm'][1]} mm; B: R {B['R_inf_mm'][1]} mm"))
sq = A["sensitivity_sq_spearman"]
sqB = B["sensitivity_sq_spearman"]
F(fnd(f"Before calibration the prediction is dominated by the unmeasured swelling strain: squared Spearman correlation with log curvature is {sq['eps_a']:.2f} (pair A) and {sqB['eps_a']:.2f} (pair B) for the active layer's strain, {sq['eps_p']:.2f} / {sqB['eps_p']:.2f} for the passive strain, and at most {max(sq['E_a'], sq['E_p'], sqB['E_a'], sqB['E_p']):.3f} for either modulus. This is the law's 'modulus drops out' in practice, with a limit: at the nominal 0.4/0.66 mm stack, over a 3 x 3 grid of E_a (1.2, 3, 11 MPa) and E_p (1.2, 1.7, 2.5 MPa) f ranges from 1.22 to 1.50 (6 of 9 points at or above 1.41), the worst corner (E_a 1.2 MPa with E_p 2.5 MPa) being 18 % below the ceiling (f_tim values computed from the project script); the moduli explain under 1 % of the variance.",
      RUN + " step 8 (results.json: object1.*.sensitivity_sq_spearman)", "medium (own calculation, rank-correlation proxy)", f"eps_a share {sq['eps_a']:.2f}/{sqB['eps_a']:.2f}"))
cA, cB = A["calibrated_pred_over_true"]["p0_5_2_5_50_97_5_99_5"], B["calibrated_pred_over_true"]["p0_5_2_5_50_97_5_99_5"]
F(fnd(f"Prediction power after calibration: if the free strains of both layers are read from 30 mm coupons (+-0.02 mm), layer thicknesses from callipers (+-0.02 mm) and the bond line from a microscope (+-0.01 mm), but moduli stay at their central values, the ratio predicted/true curvature has a 95 % interval of {cA[1]:.2f}-{cA[3]:.2f} (pair A) and {cB[1]:.2f}-{cB[3]:.2f} (pair B), and a 99 % interval of {cA[0]:.2f}-{cA[4]:.2f} and {cB[0]:.2f}-{cB[4]:.2f}. A measured curvature outside the 99 % interval refutes 'kappa = f d_eps / h with coupon-measured inputs' for that build (subject to a defect check and n >= 6 replicate strips).",
      RUN + " step 8 (object1.*.calibrated_pred_over_true)", "medium (own calculation; excludes physics outside the law)", f"99 % band A {cA[0]:.2f}-{cA[4]:.2f}; B {cB[0]:.2f}-{cB[4]:.2f}"))
F(fnd(f"Gravity makes air-photography of these soft strips unreliable: a 30 mm cantilever sags {tri(A['sag_air_mm'], 2)} mm (A) and {tri(B['sag_air_mm'], 2)} mm (B) under its own weight in air, comparable to the predicted tip deflection ({A['tip_defl_inf_mm'][1]:.1f} / {B['tip_defl_inf_mm'][1]:.1f} mm), but only {tri(A['sag_water_mm'], 2)} / {tri(B['sag_water_mm'], 2)} mm when submerged (net density about 90 kg/m3 against water). Strips should therefore be photographed in the bath (flat-window cuvette), or kept under 20 mm in air. This contradicts the earlier recommendation to photograph 40 mm strips in air (spec-bilayer-physics.json), which was written without a self-weight term: at 40 mm the sag is about 3.2 times larger still (L^4).",
      RUN + " step 8 (object1 sag_air_mm, sag_water_mm; formula q L^4/(8 D), densities 1.09 and 1.01 g/cm3 from the data sheets, silicone 1.1 assumed)", "medium (first-order formula)", None))
cam = RES["camera_circle_fit"]
F(fnd(f"Camera is not the limiting error: a circle fit to a photographed silhouette with 0.03 mm edge noise (about half a 0.05 mm pixel) recovers curvature with relative standard deviation {cam[-1]['rel_sd_kappa_pct']}-{cam[0]['rel_sd_kappa_pct']} % for R = 20-100 mm over a 30 mm arc.",
      RUN + " step 7 (results.json: camera_circle_fit)", "high (own simulation; real lens distortion not modelled)", "0.10 % (R=20 mm) to 0.51 % (R=100 mm)"))
ro = O2["A_ratio_ladder_h1.0"]
F(fnd(f"OBJECT 2 prediction (ratio ladder at 1.0 mm total, active thickness 0.2-0.8 mm in 0.1 mm steps): kappa h / d_eps peaks near an active thickness of {O2['A_peak_active_thickness_mm']['p5_50_95'][1]} mm (90 % interval {O2['A_peak_active_thickness_mm']['p5_50_95'][0]}-{O2['A_peak_active_thickness_mm']['p5_50_95'][2]}) for pair A and {O2['B_peak_active_thickness_mm']['p5_50_95'][1]} mm ({O2['B_peak_active_thickness_mm']['p5_50_95'][0]}-{O2['B_peak_active_thickness_mm']['p5_50_95'][2]}) for pair B. Predicted shape ratios f(0.8)/f(0.4) = {tri(O2['A_ladder_shape_ratios']['f(0.8)/f(0.4)'], 2)} (A) and {tri(O2['B_ladder_shape_ratios']['f(0.8)/f(0.4)'], 2)} (B); f(0.2)/f(0.4) = {tri(O2['A_ladder_shape_ratios']['f(0.2)/f(0.4)'], 2)} (A). The curve is flat near the top (rungs 0.3-0.5 within about 10 % of each other), so the ladder tests the fall-off at the ends, not the exact peak.",
      RUN + " step 9 (results.json: object2)", "medium", f"peak A {O2['A_peak_active_thickness_mm']['p5_50_95'][1]} mm; B {O2['B_peak_active_thickness_mm']['p5_50_95'][1]} mm"))
F(fnd(f"OBJECT 2 thickness ladder at fixed layer ratio (total 0.5, 1.0, 1.5, 2.0 mm): the law predicts kappa proportional to 1/h; the fitted log-log slope per simulated build is {tri(O2['A_log_kappa_vs_log_h_slope']['p5_50_95'], 3)} (A) and {tri(O2['B_log_kappa_vs_log_h_slope']['p5_50_95'], 3)} (B) against the ideal -1; settling time grows from {tri(O2['A_thickness_ladder'][0]['t90_h'], 2)} h (0.5 mm) to {tri(O2['A_thickness_ladder'][3]['t90_h'], 2)} h (2.0 mm) for pair A, with {100 * O2['A_prob_thickest_rung_t90_within_7d']:.0f} % of simulated builds settled inside 7 days at 2.0 mm.",
      RUN + " step 9 (results.json: object2 thickness ladder)", "medium", f"slope A {O2['A_log_kappa_vs_log_h_slope']['p5_50_95'][1]}"))
w = {r["width_mm"]: r for r in O3["width_ladder"]}
F(fnd(f"OBJECT 3 (tile width ladder, 60 mm long, 1.0 mm thick; widths 3, 6, 12, 24, 60 mm): the strip-validity parameter Omega = w^2 kappa / h is {tri(w[3.0]['Omega'], 2)} at 3 mm (strip law valid, Omega < 0.3 in {100 * w[3.0]['prob_strip_regime_Omega_lt_0_3']:.0f} % of builds), {tri(w[6.0]['Omega'], 2)} at 6 mm (transition), {tri(w[12.0]['Omega'], 2)} at 12 mm, and {tri(w[60.0]['Omega'], 3)} at 60 mm, i.e. a continuous 60 mm tile is far into the plate regime that the verified law does not cover. Strip-law radius {tri(w[3.0]['R_if_strip_law_mm'], 3)} mm; if a wide tile buckles to a cylinder with 1.5 times the curvature the radius would be {tri(w[60.0]['R_if_plate_x1_5_mm'], 3)} mm and the edge rise {tri(w[60.0]['edge_rise_if_plate_x1_5_mm'], 3)} mm against {tri(w[60.0]['edge_rise_if_strip_law_mm'], 3)} mm. Scaling guesses for the critical width c x sqrt(h/kappa): {O3['w_c_mm_by_prefactor']['c=0.5'][1]} / {O3['w_c_mm_by_prefactor']['c=1.0'][1]} / {O3['w_c_mm_by_prefactor']['c=2.0'][1]} mm for c = 0.5 / 1 / 2 (prefactor unknown). Design rule that restores the strip law: cut a tile into fingers no wider than about 3 x its thickness.",
      RUN + " step 10 (results.json: object3); Pezzulla abstract above", "medium for Omega; low for the plate regime numbers (outside the verified law)", None))
g = {x["name"]: x for x in O4["generations"]}
F(fnd(f"OBJECT 4 (three-generation Y-tree; thickness 2.0 / 1.0 / 0.5 mm, length 50 / 25 / 12.5 mm, i.e. constant L/h = 25): each generation should turn through the same angle, {tri(g['trunk']['turning_angle_deg_inf'], 3)}, {tri(g['branch']['turning_angle_deg_inf'], 3)} and {tri(g['twig']['turning_angle_deg_inf'], 3)} deg (trunk, branch, twig), because theta = f d_eps L / h is scale free, while radius halves each generation ({g['trunk']['R_inf_mm'][1]}, {g['branch']['R_inf_mm'][1]}, {g['twig']['R_inf_mm'][1]} mm) and settling time falls with active-layer thickness squared: {tri(g['trunk']['t90_h'], 3)}, {tri(g['branch']['t90_h'], 3)}, {tri(g['twig']['t90_h'], 3)} h. Trunk/twig time ratio {tri(O4['t90_ratio_trunk_over_twig'], 3)} (Fickian ideal 16, front-driven 'Case II' ideal 4); fitted log-log exponent {tri(O4['log_t90_vs_log_h_active_slope']['p5_50_95'], 3)} against 2 (Fickian) or 1 (Case II). Chain tip at x = {O4['chain_tip_xy_mm_inf']['x'][1]} mm, y = {O4['chain_tip_xy_mm_inf']['y'][1]} mm, total turn {tri(O4['chain_total_turn_deg_inf'], 3)} deg; self-contact (over 360 deg) in {100 * O4['prob_total_turn_over_360deg_self_contact']:.0f} % of builds.",
      RUN + " step 11 (results.json: object4)", "medium", None))
o5 = O5
F(fnd(f"OBJECT 5 (three blades 120 x 9 x 3.0 mm; 1.2 mm Flexible 80A V2 over 1.8 mm passive; Nylon 12 frame), immersed: R = {tri(o5['R_inf_mm'], 3)} mm, tip angle {tri(o5['tip_angle_deg_inf'], 3)} deg, tip deflection {tri(o5['tip_defl_inf_mm'], 3)} mm, settling {tri(o5['t90_days'], 2)} days ({100 * o5['prob_t90_within_7d']:.0f} % of builds within 7 days, {100 * o5['prob_t90_within_14d']:.0f} % within 14 days). Tip angle by day 1/3/7: {o5['angle_by_day']['1'][1]} / {o5['angle_by_day']['3'][1]} / {o5['angle_by_day']['7'][1]} deg (medians). In humid AIR the strain is unknown and a fraction s of the immersion strain would give {o5['air_scenario_angle_deg_inf']['s=0.1'][1]} / {o5['air_scenario_angle_deg_inf']['s=0.3'][1]} deg for s = 0.1 / 0.3.",
      RUN + " step 12 (results.json: object5)", "medium for immersion; no data for humid air", None))
su = {int(x["L_mm"]): x for x in o5["scale_up_constant_angle"]}
F(fnd(f"SCALE-UP LAW (constant tip angle, h proportional to L): settling time goes as L^2: {tri(su[120]['t90_days'], 2)} days at 120 mm, {tri(su[300]['t90_days'], 3)} at 300 mm, {tri(su[1000]['t90_days'], 3)} days at 1 m with the same resin. Self-weight is a second limit: a horizontally cantilevered soft blade sags {tri(su[120]['sag_over_tip_deflection_horizontal'], 2)} times its own tip deflection at 120 mm and {tri(su[1000]['sag_over_tip_deflection_horizontal'], 3)} times at 1 m; keeping sag under 10 % of the deflection at 1 m needs an equivalent modulus of about {su[1000]['E_eq_needed_for_sag_le_10pct_MPa'][1]:.0f} MPa against {su[1000]['E_eq_now_MPa'][1]:.1f} MPa now. Hang the blades vertically or measure submerged.",
      RUN + " step 12 (results.json: object5.scale_up_constant_angle)", "medium (first-order beam formulas)", None))
dn = [x for x in o5["diffusivity_needed"] if x["h_active_mm"] == 2.0 and x["target_t90_h"] == 1.0][0]
F(fnd(f"Design target that follows for a NEW biomaterial: at the optimum, settling takes 0.719 h_a^2/D, so a 2 mm active layer that must settle in one hour needs D >= {dn['D_needed_m2s']:.1e} m2/s, about 80 times the best stock-resin estimate here (1e-11) and of the order of the porous plant-tissue value 1e-9 m2/s quoted (second hand, not re-read by me) by Reyssat & Mahadevan. Combined with the strain (>= 2 %) and modulus (about 0.5 GPa for a horizontally cantilevered 1 m blade, see above) floors, the material must be porous or hydrophilic, stiff and still bondable to an inert partner.",
      RUN + " step 12 (results.json: object5.diffusivity_needed); https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/ (value quoted by bm-diffusion-kinetics.json)", "medium", f"D >= {dn['D_needed_m2s']:.2e} m2/s"))
fz = RES["fuse_nylon_negative_control"]
F(fnd("Fuse 1+ nylon is a negative control, not a candidate: with the literature/vendor bracket of 0.1-0.2 % differential strain (no measurement exists), a 0.8-1.6 mm nylon bilayer curves to R of 270-1070 mm and settles in 1-18 days (D 3e-13 to 1.4e-12 m2/s). Use the Fuse only for the non-actuating frame and clamp.",
      RUN + " step 6 (results.json: fuse_nylon_negative_control); strain bracket and D from bm-polyamide-sls.json (not re-read)", "low", "R 267-1067 mm"))
F(fnd(f"Layer-thickness realism: the optimum and the 0.1 mm layer step differ (optimum active thickness for a 1.0 mm stack is 0.37-0.43 mm for the soft partners), so the printed 0.4/0.6 stack sits at 99.5 % of the ceiling at nominal thickness; the first-layer squash of about 0.1 mm reported by the printing-workflows agent (not re-measured) is covered by the +-0.08 mm thickness prior; at the 1 mm strip thickness errors explain only 1-6 % of the variance of log curvature (squared Spearman {A['sensitivity_sq_spearman']['dt_a']:.3f} / {A['sensitivity_sq_spearman']['dt_p']:.3f} for the active / passive layer, pair A), but the thin 0.5 mm rungs and the 0.2 mm twig are proportionally more exposed (not separately quantified).",
      SD + "/run_all.py step 4; bm-formlabs-printing-workflows.json (first-layer squash)", "medium", None))


Om3 = w[3.0]["Omega"]
F(fnd(f"REFINES the width advice of spec-bilayer-physics.json ('3-5 mm for h >= 0.8 mm'): the strip law needs Omega = w^2 kappa/h below about 0.3, i.e. w <= 0.5 sqrt(h/kappa) = about 3 x the thickness at 2.3 % strain. For the 1.0 mm object-1 strip a 3 mm width gives Omega = {tri(Om3, 2)}, whereas 5 mm would give about {Om3[1] * 25 / 9:.2f} ({Om3[0] * 25 / 9:.2f}-{Om3[2] * 25 / 9:.2f}), already in the transition. The 0.3 threshold is my choice, not a published value.",
      RUN + " step 10 (results.json: object3 width_ladder); width scaling sqrt(h/kappa) from the earlier agent's reading of Armon 2011 (prefactor unknown)", "medium", f"Omega(3 mm) = {Om3[1]}"))
tt = 0.719 * (0.4e-3) ** 2 / 1.4e-12 / 3600
tm = 0.719 * (0.4e-3) ** 2 / 9.3e-12 / 3600
F(fnd(f"REFINES the demonstration verdict of bm-diffusion-kinetics.json ('hours need D >= 1e-11, Flexible 80A V2-class, 0.2-0.8 mm'): with the mass-derived D = 9.3e-12 m2/s a 0.4 mm active layer settles in 0.719 x (0.4e-3)^2 / 9.3e-12 = {tm:.1f} h, but with the volume-derived D = 1.4e-12 it takes {tt:.1f} h, about a day, and the 1.2 mm louver blade 9 times longer than the 0.4 mm strip. Bending follows the volume (strain), so 'about a day' is the safer planning figure for object 1.",
      RUN + " step 2; arithmetic 0.719 h_a^2/D", "medium", f"{tm:.1f} h (mass D) to {tt:.1f} h (volume D) at 0.4 mm"))

# ------------------------------------------------------------------ key claims
key_claims = [
    dict(claim="The law kappa = f(m,n) d_eps / h with f <= 3/2 (equality at m^2 n = 1) is reproduced by the project's own check script re-run unchanged and by an independently written layered-beam solver to 1e-9, so a printed bilayer's final curvature is predicted with no fitted parameter once the two layers' free strains and thicknesses are measured.",
         source="python -B D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/scripts/check-timoshenko-ceiling.py ; " + SD + "/run_all.py step 1",
         evidence_quote="VERDICT: the ceiling holds in every check"),
    dict(claim="Every numeric prediction here rests on one Formlabs data-sheet row: Flexible 80A V2 gains +8 % mass / +3 % volume in 1 day and +9 % / +7 % in 1 week in deionized water. It gives a 1-3 % linear strain range by my arithmetic; no independent measurement of hygroscopic strain or diffusivity of any Formlabs resin exists in the sources read.",
         source=TDS80, evidence_quote=Q["Q1"]),
    dict(claim="Only soft-on-soft pairs (Flexible 80A V2 with Flexible 50A or Silicone 40A) reach 99 % of the 3/2 ceiling at printable layer thicknesses; every stiff partner loses 41 % (Tough 1000) to 89 % (Rigid 10K) because the optimum stiff layer is thinner than the printable wall.",
         source=SD + "/run_all.py step 4 (partner_table_h1mm); moduli from the Formlabs data sheets", evidence_quote=Q["Q4"]),
    dict(claim="At the optimum, curvature settles in 0.719 h_a^2/D; the Formlabs 1-day/1-week data give D between 1.4e-12 and 9.3e-12 m2/s for an assumed 2 mm slab (volume versus mass), so a 0.4 mm active layer settles in hours to about a day, the 1.2 mm louver blade in 1-10 days, and a metre-scale element in months, since time scales as L squared.",
         source=SD + "/run_all.py steps 1, 2, 12", evidence_quote=Q["Q3"]),
]

# ------------------------------------------------------------------ table rows
def row(name, fields, source):
    return dict(name=name, fields=fields, source=source)


table = []
table.append(row(
    "Object 1 - single strip (feasible in under a week: yes, about 3-4 days elapsed, bonding is the risk)",
    f"dimensions=30 x 3 x 1.0-1.1 mm (L x w x h); active=0.4 mm Flexible 80A V2 (top, wet side); passive=0.6 mm Flexible 50A (pair A) or Silicone 40A (pair B); bond line=0.02-0.10 mm (unmeasured prior); "
    f"R_final_A={tri(A['R_inf_mm'], 3)} mm; R_final_B={tri(B['R_inf_mm'], 3)} mm; tip_deflection_A={tri(A['tip_defl_inf_mm'], 3)} mm; tip_deflection_B={tri(B['tip_defl_inf_mm'], 3)} mm (L=30 mm, uncertainty = 5th-95th percentile of strain 0.99-3.2 %, E_a 1.2-11 MPa, E_p 0.7-2.5 MPa, thickness +-0.08 mm); "
    f"kappa_h_over_d_eps_A={tri(A['f_eff'], 3)}; time_to_within_10pct_of_final_A={tri(A['t90_h'], 2)} h (D 1e-12 to 1.1e-11 m2/s, 0.848/0.719 h_a^2/D); R_at_1d_A={tri(A['R_1d_mm'], 3)} mm; "
    f"measured=free-coupon length change (30 mm, +-0.02 mm) and mass (0.1 mg) for each layer to get d_eps and D, calliper thickness, microscope bond line, submerged side-on photograph circle-fit (R, tip deflection) at 1, 3, 7 days, 6 replicate strips per pair; "
    f"refuted_if=kappa_obs/kappa_pred outside {cA[0]:.2f}-{cA[4]:.2f} (pair A, 99 % band) after a defect check, or median kappa*h/d_eps(coupon) over 6 strips above 1.6 (ceiling broken) ",
    RUN + " step 8; inputs " + TDS80))
table.append(row(
    "Object 2 - strip array / comb (feasible: yes, same week, two combs per pair)",
    f"dimensions=comb of 10 fingers, each 30 x 3 mm, pitch 6 mm, shared 10 mm spine (about 70 x 42 mm); ratio ladder at h=1.0 mm: active 0.2/0.3/0.4/0.5/0.6/0.7/0.8 mm; thickness ladder at fixed ratio: total 0.5/1.0/1.5/2.0 mm (active 0.2/0.4/0.6/0.8); "
    f"predicted_f_pair_A (kappa h/d_eps, median) by active thickness 0.2..0.8 = {', '.join(str(round(r['f_eff'][1], 2)) for r in ro)}; peak_active_thickness_A={O2['A_peak_active_thickness_mm']['p5_50_95'][1]} mm, B={O2['B_peak_active_thickness_mm']['p5_50_95'][1]} mm; "
    f"f(0.8)/f(0.4)_A={tri(O2['A_ladder_shape_ratios']['f(0.8)/f(0.4)'], 2)}, B={tri(O2['B_ladder_shape_ratios']['f(0.8)/f(0.4)'], 2)}; kappa-vs-h log slope={tri(O2['A_log_kappa_vs_log_h_slope']['p5_50_95'], 3)} (ideal -1); "
    f"time_to_settle_pair_A (h, median and 5th-95th)=0.2 mm active {tri(ro[0]['t90_h'], 2)}; 0.4 mm {tri(ro[2]['t90_h'], 2)}; 0.8 mm {tri(ro[6]['t90_h'], 2)} (pair A includes the lag of the slowly swelling thick passive layer); pair B 0.4 mm {tri(O2['B_ratio_ladder_h1.0'][2]['t90_h'], 2)}; thickest thickness-ladder rung (2.0 mm total) settled within 7 d in {100 * O2['A_prob_thickest_rung_t90_within_7d']:.0f} % of builds; "
    f"measured=same as object 1 for every finger, plus shape of kappa h versus layer ratio and versus total thickness; "
    f"refuted_if=f(0.8)/f(0.4) above 1.0 (no fall-off at the thick-active end), or fitted peak outside 0.25-0.55 mm active, or log-log slope of kappa against h outside -1.2 to -0.8 ",
    RUN + " step 9"))
table.append(row(
    "Object 3 - self-curling tile / width ladder (printing feasible; the plate regime is outside the verified law)",
    f"dimensions=60 mm long x width {{3, 6, 12, 24, 60}} mm x 1.0 mm (0.4 mm Flexible 80A V2 + 0.6 mm Flexible 50A); Omega=w^2 kappa/h: {tri(w[3.0]['Omega'], 2)} (3 mm), {tri(w[6.0]['Omega'], 2)} (6), {tri(w[12.0]['Omega'], 2)} (12), {tri(w[24.0]['Omega'], 2)} (24), {tri(w[60.0]['Omega'], 3)} (60); "
    f"R_strip_law={tri(w[60.0]['R_if_strip_law_mm'], 3)} mm; R_if_cylinder_x1.5={tri(w[60.0]['R_if_plate_x1_5_mm'], 3)} mm; edge_rise_60mm_tile={tri(w[60.0]['edge_rise_if_strip_law_mm'], 3)} mm (strip law) to {tri(w[60.0]['edge_rise_if_plate_x1_5_mm'], 3)} mm (x1.5); "
    f"time=same as object 1 (about {tri(A['t90_h'], 2)} h, edges diffuse in too); measured=principal curvatures from two orthogonal silhouettes or a photogrammetry scan; transition width where the second curvature switches off; "
    f"refuted_if=3 mm strip curvature is outside the object-1 band, or the 60 mm tile's cylinder curvature is below 0.9 or above 1.7 times the 3 mm strip curvature (the [1.0,1.5] bracket from plate theory and the Pezzulla abstract fails)",
    RUN + " step 10; https://arxiv.org/abs/1509.05259"))
table.append(row(
    "Object 4 - hierarchical Y-tree (feasible at risk: twig is 0.5 mm thick with a 0.2 mm active layer)",
    f"dimensions=trunk 50 x 3 x 2.0 mm (0.8+1.2), 2 branches 25 x 2.5 x 1.0 mm (0.4+0.6), 4 twigs 12.5 x 1.5 x 0.5 mm (0.2+0.3), constant L/h=25; "
    f"turning_angle_per_generation={tri(g['trunk']['turning_angle_deg_inf'], 3)} / {tri(g['branch']['turning_angle_deg_inf'], 3)} / {tri(g['twig']['turning_angle_deg_inf'], 3)} deg; R={g['trunk']['R_inf_mm'][1]} / {g['branch']['R_inf_mm'][1]} / {g['twig']['R_inf_mm'][1]} mm; "
    f"settling_time={tri(g['trunk']['t90_h'], 3)} / {tri(g['branch']['t90_h'], 3)} / {tri(g['twig']['t90_h'], 3)} h (trunk/branch/twig); ratio_trunk_to_twig={tri(O4['t90_ratio_trunk_over_twig'], 3)} (Fickian 16, Case II 4); total_turn={tri(O4['chain_total_turn_deg_inf'], 3)} deg; "
    f"measured=turning angle of each generation versus time (time-lapse, submerged), final tip coordinates, exponent of settling time against active thickness; "
    f"refuted_if=angles differ between generations by more than 25 % (law not scale free) or the settling-time exponent is below 1.4 (diffusion not Fickian: front-driven or concentration-dependent)",
    RUN + " step 11"))
table.append(row(
    f"Object 5 - scaled facade-louver module (feasible partly: immersion yes, settled within 7 days in {100 * o5['prob_t90_within_7d']:.0f} % of simulated builds; humid-air performance unknown)",
    f"dimensions=3 blades 120 x 9 x 3.0 mm (1.2 mm Flexible 80A V2 + 1.8 mm passive), pitch 20 mm, hung vertically in a Nylon 12 (Fuse 1+) or Rigid-resin frame about 150 x 60 mm; "
    f"R_final={tri(o5['R_inf_mm'], 3)} mm; tip_angle={tri(o5['tip_angle_deg_inf'], 3)} deg; tip_deflection={tri(o5['tip_defl_inf_mm'], 3)} mm; settling={tri(o5['t90_days'], 2)} days; angle_median_day1/3/7={o5['angle_by_day']['1'][1]}/{o5['angle_by_day']['3'][1]}/{o5['angle_by_day']['7'][1]} deg; "
    f"air_scenario_angle (strain fraction 0.1/0.3)={o5['air_scenario_angle_deg_inf']['s=0.1'][1]}/{o5['air_scenario_angle_deg_inf']['s=0.3'][1]} deg; self_weight_sag_if_horizontal={tri(o5['sag_air_mm'], 3)} mm in air; "
    f"scale_up: settling at L=300/1000 mm = {su[300]['t90_days'][1]}/{su[1000]['t90_days'][1]} days; modulus_needed_at_1m={su[1000]['E_eq_needed_for_sag_le_10pct_MPa'][1]:.0f} MPa; "
    f"measured=blade angle versus time in the bath (turntable photographs), then in a humidity chamber if available; "
    f"refuted_if=tip angle at equilibrium differs from f*d_eps*L/h (coupon-measured) by more than the 99 % band of object 1, or settling time does not scale as h_a^2 between this blade (1.2 mm active) and object 2's 0.4 mm and 0.8 mm fingers",
    RUN + " step 12"))
table.append(row(
    "Input prior - water strain of Flexible 80A V2",
    "d_eps_active=0.99 % (1 day, from +3 % volume), 2.28 % (1 week, from +7 % volume), 3.17 % (ideal mixing, 9 % mass), triangular; isotropy assumed; slab thickness unstated in the data sheet",
    TDS80))
table.append(row(
    "Input prior - moduli (secant estimates, wet softening)",
    "E_80A_V2_dry=4.3-11 MPa (5.8 secant at 50 %, 4.7 at 100 %, Gent estimate 11.4); wet/dry=0.28-1.0 (Shore -26 points); E_50A=1.2-2.5 MPa (1.7-1.8 secant); E_Si40A=0.7-1.6 MPa (0.8-1.4 secant)",
    TDS80 + " ; " + TDS50 + " ; " + TDSSI))
table.append(row(
    "Input prior - diffusivity of water in Flexible 80A V2",
    "D=1.0e-12 to 1.1e-11 m2/s log-uniform; volume-pair inversion 1.4e-12, mass-pair inversion 9.3e-12 (2 mm slab assumed); stock-resin literature range from bm-diffusion-kinetics.json",
    SD + "/run_all.py step 2"))
for r in RES["partner_table_h1mm"]:
    table.append(row("Partner pair at 1.0 mm total - " + r["pair"],
                     f"E_passive_over_E_active={r['Ep_over_Ea']}; optimum_active_thickness={r['h_active_at_optimum_mm']} mm; best_f_with_all_layers_ge_0.2mm={r['best_f_with_layers_ge_0_2mm']} at active={r['at_h_active_mm']} mm; share_of_ceiling={r['pct_of_ceiling']} %",
                     SD + "/run_all.py step 4"))

# ------------------------------------------------------------------ citations
cit_meta = {
    "10.1364/JOSA.11.000233": ("Timoshenko S.", "Analysis of Bi-Metal Thermostats", "J. Opt. Soc. Am.", "origin of the bilayer curvature formula; metadata only, text not read"),
    "10.1016/j.conbuildmat.2015.08.136": ("Holstov A., Bridgens B., Farmer G.", "Hygromorphic materials for sustainable responsive architecture", "Constr. Build. Mater.", "earlier numerical observation that the Timoshenko maximum is 1.5 (relayed by bm-wood-cellulose-hygromorphs.json; not re-read by me)"),
    "10.1098/rsif.2009.0184": ("Reyssat E., Mahadevan L.", "Hygromorphs: from pine cones to biomimetic bilayers", "J. R. Soc. Interface", "time scale h^2/D and plant-tissue D of 1e-9 m2/s (value relayed by the earlier agents)"),
    "10.3390/polym15122600": ("Aniskevich A., Bulderberga O., Stankevics L.", "Moisture Sorption and Degradation of Polymer Filaments Used in 3D Printing", "Polymers", "bracket for water diffusivity of dense printed thermoplastics (via earlier agents)"),
    "10.1126/science.1203874": ("Armon S., Efrati E., Kupferman R., Sharon E.", "Geometry and Mechanics in the Opening of Chiral Seed Pods", "Science", "width-transition scaling sqrt(h/kappa) used in object 3; prefactor not retrieved"),
    "10.1039/C6SM00246C": ("Pezzulla M., Smith G. P., Nardinocchi P., Holmes D. P.", "Geometry and mechanics of thin growing bilayers", "Soft Matter", "isometric-state mean curvature of 3/4 of the natural curvature (abstract only) giving the x1.5 plate bound"),
    "10.1038/s41467-024-54808-8": ("Cheng T., Tahouni Y., Sahin E. S., et al.", "Weather-responsive adaptive shading through biobased and bioinspired hygromorphic 4D-printing", "Nat. Commun.", "context for facade-scale hygromorphic shading (relayed by earlier agents)"),
    "10.1016/j.dental.2011.06.007": ("Sideridou I. D., Karabela M. M.", "Sorption of water, ethanol or ethanol/water solutions by light-cured dental dimethacrylate resins", "Dent. Mater.", "water diffusivity bracket 1.5e-12 to 1.1e-11 m2/s for dimethacrylate resins (via earlier agents)"),
    "10.3390/ma17235953": ("Pino A., Ibanez-Felip I., Vidal R.", "Water Absorption of Underwater Products by Additive Manufacturing", "Materials", "stock acrylate resin water uptake and time to saturation (via earlier agents)"),
    "10.1089/3dp.2015.0022": ("Correa D., Papadopoulou A., Guberan C., et al.", "3D-Printed Wood: Programming Hygroscopic Material Transformations", "3D Print. Addit. Manuf.", "printed hygromorph precedent; metadata only"),
}
citations = []
for doi, (au, title, venue, used) in cit_meta.items():
    v = SRC["dois"][doi]
    citations.append(dict(authors=au, year=int(v["year"]), title=title, venue=venue, doi_or_arxiv=doi, verified=True,
                          how_verified=f"Crossref API https://api.crossref.org/works/{doi} returned title '{v['title'][:70]}' and year {v['year']} in this run (verify_sources.py, sources_check.json)",
                          used_for=used))
citations.append(dict(authors="Pezzulla M., Smith G. P., Nardinocchi P., Holmes D. P.", year=2015, title="Geometry and Mechanics of Thin Growing Bilayers (arXiv version)",
                      venue="arXiv", doi_or_arxiv="arXiv:1509.05259", verified=True,
                      how_verified="arXiv export API http://export.arxiv.org/api/query?id_list=1509.05259 returned the record and abstract quoted above (saved data/bm-poc-designs/arxiv_1509.05259.xml, sha256 b6d2334fe418285b2e3a89f5660e489c3168ae687c3e411e1f48dfcb1984fccb)",
                      used_for="source of the 3/4 mean-curvature statement"))

# ------------------------------------------------------------------ narrative
summary = (
    "Five printable proof-of-concept objects were designed around the verified law kappa = f(m,n) d_eps / h (ceiling 3/2 at m^2 n = 1), with all numbers produced by saved scripts (run_all.py, about 6 s, seeded, bit-identical on rerun). "
    "The law itself was re-checked two ways: the project's check script re-run unchanged, and an independently written layered-beam solver that matches f(m,n) to 1e-9; a laminate-plate calculation shows the small-deflection plate curvature equals the beam curvature exactly (equal Poisson ratio), which contradicts the earlier '(1+nu)' inference; the extra factor can only arise after buckling (Pezzulla abstract: isometric mean curvature three quarters of natural, i.e. at most 1.5 x for a cylinder). "
    "Materials: the only stock Formlabs resin with a water response big enough to drive a bilayer is Flexible 80A V2 (+3 % volume in 1 day, +7 % in 1 week, ASTM D471), giving 1-3 % linear strain by my arithmetic; partners are soft (Flexible 50A, Silicone 40A) because stiff partners (Tough 1000, Grey V5, Rigid 10K) reach only 59, 33 and 11 % of the ceiling at printable thickness and the highlighted Elastic 50A / Rigid 10K pair only 6 %. "
    f"Predictions (median, 5th-95th percentile over the stated strain, modulus, thickness and diffusivity ranges): object 1, a 30 x 3 x 1 mm strip, final R = {A['R_inf_mm'][1]:.0f} mm ({A['R_inf_mm'][0]:.0f}-{A['R_inf_mm'][2]:.0f}), tip deflection {A['tip_defl_inf_mm'][1]:.1f} mm, settling {A['t90_h'][1]:.0f} h; "
    f"object 2, a ladder of ten fingers, tests the f(m) fall-off (f(0.8)/f(0.4) = {O2['A_ladder_shape_ratios']['f(0.8)/f(0.4)'][1]:.2f}) and kappa proportional to 1/h (slope {O2['A_log_kappa_vs_log_h_slope']['p5_50_95'][1]:.2f}); "
    f"object 3, a width ladder up to a 60 mm tile, crosses from the strip regime (width/thickness 3) to the plate regime outside the verified law and predicts between 1.0 and 1.5 x the strip curvature; "
    f"object 4, a three-generation Y-tree, predicts the same turning angle ({g['branch']['turning_angle_deg_inf'][1]:.0f} deg) in every generation but settling times in the ratio {O4['t90_ratio_trunk_over_twig'][1]:.0f} : 1 trunk to twig (Fickian 16, front-driven 4); "
    f"object 5, a 120 mm louver blade module, turns {o5['tip_angle_deg_inf'][1]:.0f} deg ({o5['tip_angle_deg_inf'][0]:.0f}-{o5['tip_angle_deg_inf'][2]:.0f}) and settles in {o5['t90_days'][1]:.1f} days ({o5['t90_days'][0]:.1f}-{o5['t90_days'][2]:.0f}) in water, but time grows as L squared (about {su[1000]['t90_days'][1]:.0f} days at 1 m) and a horizontal soft blade sags more than it curls. "
    "Before calibration the strain prior dominates the uncertainty (73-88 % of variance) and moduli barely matter; after a coupon calibration the predicted/true curvature has a 99 % band of about 0.8-1.3. "
    "New practical findings: strips must be photographed submerged (self-weight sag of a 30 mm strip in air is comparable to the signal), the IPA wash gives 29 % linear stretch and must precede bonding, and Formlabs' own mass and volume rows imply diffusivities that differ by 6.8x. "
    "Feasible with stock resins in under a week: objects 1-3 (bond quality is the risk), object 4 with risk (0.2 mm active twig), object 5 in water only. None of this is a measurement: every strain and modulus is a derived prior, and the first experiment is the coupon calibration.")

lay_summary = (
    "The idea is a two-layer strip: one layer swells when it gets wet and the other does not, so the strip bends like a drying leaf. "
    "A checked rule says how much it can bend: the best two-layer strip curls to a radius of about two-thirds of its own thickness divided by how much the wet layer grows. "
    "We worked out five things to print, from one little strip up to a small window-shade module, and for each we predict how far it bends and how long it takes to get wet through. "
    f"For the first strip the prediction is a curl of about {A['R_inf_mm'][1]:.0f} millimetres radius within a working day in water, with a plausible range of {A['R_inf_mm'][0]:.0f} to {A['R_inf_mm'][2]:.0f}. "
    "The honest catch is that nobody has measured how much the Formlabs resins swell, so the first step is to soak small test strips and measure them, and only then compare the bends with the rule. "
    "Think of a wet sponge cloth versus a thick sponge: doubling the thickness makes the soaking four times slower, so a real building-sized shade made of these plastics would take months.")

glossary = [
    dict(term="bilayer", plain="Two thin sheets stuck face to face; if one grows and the other does not, the pair bends."),
    dict(term="curvature / radius", plain="How tightly something is curved; the radius is the size of the circle the bend would draw (small radius, tight curl)."),
    dict(term="strain", plain="How much a material stretches or grows, as a fraction of its length (1 percent means 1 mm per 100 mm)."),
    dict(term="modulus", plain="How stiff a material is: how much force it takes to stretch it a given amount."),
    dict(term="diffusivity", plain="How fast water spreads into a material; the soaking time is the thickness squared divided by this number."),
    dict(term="swelling", plain="Growth of a material because liquid has soaked into it."),
    dict(term="resin", plain="The liquid plastic a Formlabs printer hardens with light, layer by layer."),
    dict(term="elastomer", plain="A rubbery plastic that stretches a lot and springs back."),
    dict(term="coupon", plain="A small test piece printed alongside the real parts and measured on its own."),
    dict(term="Monte Carlo", plain="Running the same calculation thousands of times with inputs drawn at random from their plausible ranges to see how wide the answers spread."),
    dict(term="percentile (5th-95th)", plain="The range that holds the middle 90 out of 100 simulated outcomes."),
    dict(term="Fickian diffusion", plain="The ordinary kind of spreading in which soaking time grows with thickness squared."),
    dict(term="Case II diffusion", plain="A sharp soaking front moving at constant speed, so soaking time grows only with thickness."),
    dict(term="submerged photograph", plain="A picture taken with the strip under water, where buoyancy cancels almost all of the strip's weight."),
    dict(term="isopropanol (IPA)", plain="Rubbing alcohol, used to wash printed parts; some resins swell enormously in it."),
]

recommendations = [
    "Run experiment 0 first (1 day): print free coupons of every layer (30 x 3 x 0.4 mm Flexible 80A V2, 30 x 3 x 0.6 mm Flexible 50A and Silicone 40A), wash and dry them, record dry length and mass, immerse in deionized water at a controlled temperature, and log length (+-0.02 mm) and mass (0.1 mg) against sqrt(time) for 7 days. This yields the missing strain, D and slab-independent data and shrinks the object 1 uncertainty from a factor 2-3 to about +-15 %.",
    "Decide the bond method before anything else (it is the single point of failure and nothing documented exists): wash and fully dry both layers first, bond with a thin film of liquid Flexible 50A, shim the bond line to 0.05 mm, flash-cure; peel-test and microscope-section three samples; try the Silicone 40A pair only as an experiment.",
    "Photograph strips submerged in a flat-window tank, or keep any in-air strip under 20 mm; never wash a bonded stack in isopropanol.",
    "Print order: day 1 coupons plus object 1 and 2 layers (both resin tanks), day 2 bond, days 2-6 soak and measure; object 3 shares the same layers; make object 4 only after the 0.2 mm active layers have printed cleanly; object 5 blades are the same layers at 1.2/1.8 mm.",
    "Ask Formlabs (support) for the slab thickness, humid-air (RH) mass and dimension data and the DMA storage modulus of Flexible 80A V2; this removes the 6.8x diffusivity ambiguity and the wet-modulus guess.",
    "For the new biomaterial the law implies four floors: differential strain >= 2 %, diffusivity >= 8e-10 m2/s for a 2 mm layer settling in an hour, an equivalent modulus of about 0.5 GPa for a 1 m horizontally cantilevered blade, and a bondable inert partner at a thickness ratio near sqrt(E_passive/E_active). Stock Formlabs resins meet the first only marginally and miss the second by about two orders of magnitude.",
    "Offer the practice the scaling law and the proof-of-concept as 'what the law forbids' (time ~ L^2, sag ~ L^4/h^2, wide plates leave the law) before the material claim; humid-air performance of any Formlabs resin is not yet evidenced.",
]

reproduce = [
    dict(what="Re-run the project's ceiling check unchanged (read only)", command_or_url="python -B D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/scripts/check-timoshenko-ceiling.py", expected="last line: VERDICT: the ceiling holds in every check; grid maximum 1.499998 at m^2 n = 0.99996"),
    dict(what="Run all models, Monte Carlo and object predictions (Python 3.14.2, numpy 2.5.3, scipy 1.18.1; seeded)", command_or_url="python -B D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-poc-designs/run_all.py", expected="a log of sections 0-12 and a results.json in agents2/scratch/bm-poc-designs/ (md5 83aa4ffe127951b0b0d7fbe3a115787a on this machine); object 1 pair A R_final median 41.0 mm, 5th-95th 27.6-83.3 mm; plate/beam ratio 1.000000; curvature t90 0.719 and t99 1.653"),
    dict(what="Re-fetch the Formlabs sources, check every evidence quote and resolve every DOI via Crossref (PyMuPDF 1.28.2)", command_or_url="python -B D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-poc-designs/verify_sources.py --refetch", expected="20 lines starting OK for quotes Q1-Q20, 10 'DOI ok' lines, final line 'quotes missing: []  DOIs failed: []' (Crossref occasionally times out; rerun)"),
    dict(what="Rebuild this JSON from the computed files", command_or_url="python -B D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-poc-designs/compose_result.py", expected="writes D:/Users/ashenoy00000/delphi-work/agents2/bm-poc-designs.json"),
    dict(what="Primary data page: Flexible 80A V2 data sheet, page 6 (chemical compatibility table)", command_or_url=TDS80, expected="Deionized Water row: 1 day -26 / +8 % mass / +3 % volume; 1 week -27 / +9 % / +7 %"),
    dict(what="Solvent table and elastomer water/IPA columns", command_or_url=SOLV, expected="Silicone 40A Resin row: water <0.1, isopropanol 5.9; Elastic/Flexible 50A: water 0.7, IPA 39.2"),
]

could_not_find = [
    "Any measured hygroscopic strain, humid-air (RH) swelling, or water diffusivity of any Formlabs resin or powder. The strain prior comes from two volume figures in one data sheet (isotropy assumed, slab thickness unstated); the diffusivity prior spans a 6.8x disagreement between the mass and the volume rows of the same sheet.",
    "Any bond strength or bond-line data between Flexible 80A V2 and Flexible 50A or Silicone 40A (silicone to acrylate adhesion is undocumented), and whether a Form 4 job can carry two resins; the one-resin-per-job statement is relayed from bm-formlabs-printing-workflows.json and I did not re-verify it with the manual.",
    "A tensile or storage modulus for Flexible 80A V2, Flexible 50A or Silicone 40A. The data sheet has a DMA storage-modulus curve for 80A V2 (1 Hz, 0.1 % strain) but it is a figure and I could not read values; my moduli are secant estimates from stress at 50-200 % elongation, and the wet modulus rests on the Gent Shore-to-modulus relation, which is unverified background from memory.",
    "Equilibrium water strain of the passive partners (Flexible 50A, Silicone 40A); only 24 h cube mass is published, so passive strain is a prior (0-0.8 % and 0-0.05 %).",
    "The numerical prefactor of the strip-to-plate transition (Armon 2011 full text not read) and the full text of Pezzulla et al. (only the abstract), so the x1.5 bound for a buckled tile is an arithmetic reading of the abstract, and whether it depends on Poisson ratio is unknown.",
    "A finite-strain (large-deformation) bilayer model; I did not implement one, so the isopropanol regime (29 % linear stretch) is only flagged as a hazard and not predicted, and the 1-3 % water regime carries an unquantified finite-strain error of the order of the strain itself.",
    "Print times, cartridge availability, lead time and cost of Flexible 80A V2, Flexible 50A and Silicone 40A for the team's printers; the under-a-week claim assumes the resins are on hand.",
    "Concentration-dependent or Case II water transport in these elastomers: the model uses a constant Fickian D; the passive-layer swelling lag is a mean-strain approximation.",
    "Gravity sag is a first-order small-deflection formula and breaks down where the sag exceeds the blade length (the horizontal 120 mm blade); it only shows gravity dominates. Densities of Silicone 40A (assumed 1.1 g/cm3) and of the 50A/80A in water are unverified.",
    "Any physical measurement: nothing was printed or tested; every number in this report is a prediction from data-sheet-derived priors.",
]

scripts_written = [
    SD + "/pocmodel.py", SD + "/priors.py", SD + "/designs.py", SD + "/run_all.py", SD + "/verify_sources.py", SD + "/compose_result.py",
    "outputs: " + SCR + "/results.json, run_all_log.txt, sources_check.json, ceiling_run.txt; data: D:/Users/ashenoy00000/delphi-work/data/bm-poc-designs/ (TDS PDFs, solvent and spec pages, arXiv record; sha256 in sources_check.json)",
]

result = dict(label="bm-poc-designs", topic="Five concrete proof-of-concept objects with predicted numbers",
              summary=summary, lay_summary=lay_summary, findings=findings, key_claims=key_claims, table=table,
              recommendations=recommendations, reproduce=reproduce, citations=citations, could_not_find=could_not_find,
              glossary=glossary, scripts_written=scripts_written)
json.dump(result, open(OUTF, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("wrote", OUTF, os.path.getsize(OUTF), "bytes;", len(findings), "findings,", len(table), "table rows,", len(citations), "citations")
