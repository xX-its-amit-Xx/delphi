"""Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-testing-metrology.json from the facts gathered in this run.
Run: python build_result.py   (then python -c "import json;json.load(open(r'..\\..\\bm-testing-metrology.json'))" to check it parses)
"""
import json, os

D = "D:/Users/ashenoy00000/delphi-work/data/bm-testing-metrology/"
S = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-testing-metrology/"
ISO62 = "https://law.resource.org/pub/us/cfr/ibr/inc/iso/iso.0062.2008.pdf"
KRUG = "https://pmc.ncbi.nlm.nih.gov/articles/PMC8544213/ (doi 10.3390/biomimetics6040058)"
FLEX = "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf"
CLEAR = "https://formlabs-media.formlabs.com/filer_public/dd/7f/dd7f3de9-55ae-4c82-ac52-408a4b5df64d/clear_resin_v5_tds___formlabs.pdf"
SOLV = "https://formlabs.com/support/solvent-compatibility/"
TOL = "https://formlabs.com/support/Design-specifications-for-3D-models-Form-4-generation/"
IDIC = "https://idics.org/guide/DICGoodPracticesGuide_ElectronicVersion-V5g-181022.pdf"
GRN = "https://nvlpubs.nist.gov/nistpubs/jres/81A/jresv81An1p89_A1b.pdf"
PA66 = "https://pmc.ncbi.nlm.nih.gov/articles/PMC10459301/ (doi 10.3390/polym15163387)"
CALC = S + "calc.py (output calc_out.json)"

r = {}
r["label"] = "bm-testing-metrology"
r["topic"] = "How to measure it properly: a reproducible test protocol (free-coupon swelling strain, mass uptake, wet/dry modulus, bilayer curvature)"

r["summary"] = (
 "PROTOCOL IN ONE PARAGRAPH. Print flat 40 x 10 mm coupons (0.4 and ~1.0 mm thick, n=5 per material and thickness, plus ISO 62 60 x 60 x 1 mm plates, n>=3) with two 0.5 mm backlit fiducial holes about 36 mm apart; "
 "dry to constant mass at 50 C (ISO 62 Method 1, 0.1 mg readability, 1-10 days); photograph each coupon edge-flat on a fixed backlit jig with a calibrated camera to get the dry length L0; "
 "expose to distilled water at 23.0 +/- 1.0 C (weigh at 2, 6, 24, 48, 96, 192 h, each within 1 min of removal, ISO 62 Method 1) and to saturated-salt jars at 23 C (LiCl 11 %, MgCl2 33 %, Mg(NO3)2 53 %, NaCl 75 %, KCl 84 %, K2SO4 97 %; ASTM E104 / ISO 483); "
 "re-dry at the end to catch extracted material (ISO 62 Method 3); image the same coupon at the same time points; strain = L1/L0 - 1 on the SAME coupon; fit Fick's law (ISO 62 clause 7.2) for D and saturation uptake; "
 "measure wet and dry modulus by dead-weight 3-point bend (camera) and by DMA/tensile on companion bars tested within minutes of removal with mass recorded before and after; then bond active and passive strips, stand them on their long edge, photograph, fit a circle to the sub-pixel edge, and compare kappa with f(m,n)*d_eps/h using the independently measured d_eps, n and h. "
 "THE NUMBERS THAT DECIDE THE EQUIPMENT. 0.2 % of 40 mm is 80 um. To tell the Timoshenko law from a 20 % error at 3 sigma the strain must be known to 6.7 %, i.e. a length-change uncertainty of 5.3 um (3.8 um per reading). A caliper (resolution 10 um, accuracy +/-0.001 in = 25.4 um on the Travers page) has an accuracy equal to 32 % of the signal and cannot do it unless its errors cancel; a calibrated phone image (60 mm over 4000 px = 15 um/px, 0.1 px edge = 1.5 um) gives about 0.005 % strain noise on paper, but I did not measure a real phone, so that is arithmetic not a result. "
 "Formlabs' own Form 4 tolerance is +/-0.2 % (floor 0.06 mm) for 31-80 mm features, i.e. the printing scatter equals the whole signal, so only paired before/after measurements on the same coupon are meaningful. "
 "Mass: a 40 x 10 x 1 mm coupon weighs about 0.48 g and 1 % uptake is 4.8 mg; a 0.1 mg balance resolves a 1 % uptake to 0.8 % (1 sigma, relative), a 1 mg balance to 8 %, and a kitchen scale (0.1 g or 1 g) cannot see it at all. A 10 um water film left after blotting weighs 9 mg = 1.9 % of the coupon, larger than the signal, so blotting technique is the real mass-measurement error. "
 "WHAT I CONTRADICT. The brief (and spec-resin-chemistry) says stock Formlabs resins gain under 1 % in 24 h. That is true on Formlabs' 1 cm cube table, but the Flexible 80A V2 data sheet reports +8 % mass and +3 % volume after 1 day in deionized water (ASTM D471 slab). Both are verbatim from Formlabs; they differ in specimen, method and (probably) resin version, and I could not reconcile them. Flexible 80A V2 should therefore be in the first experiment as the discriminating specimen. "
 "WHAT I CONFIRM. Rigid 10K <0.1 % water and <0.1 % IPA, Elastic 50A V2 39.2 % IPA and 0.7 % water (163.9 % is xylene) all reproduce from the Formlabs page; the Grey V5 one-week row (mass 103.23 %, modulus 65.29 %) is now confirmed by text position, not by row order."
)

r["lay_summary"] = (
 "Before building a clever plastic that bends when the air gets damp, we must measure how much the plastic swells and how stiff it gets when wet. "
 "The swelling we are hunting for is tiny: about two parts in a thousand, which on a 40 millimetre strip is less than a tenth of a millimetre, roughly the thickness of a human hair. "
 "A hardware-store caliper is not precise enough, but a careful photograph taken from the same spot before and after, with a ruler in the picture, can be. "
 "Weighing the water the plastic drinks is harder than it sounds, because a thin film of water left on the surface can weigh more than the water that soaked in, so we need a lab balance and a fixed wiping routine. "
 "A phone and a kitchen scale can show whether a strip curls and by roughly how much, but they cannot give numbers good enough to prove or disprove the design rule. "
 "The full set of proper equipment costs a few thousand dollars, and a credible cheaper set costs about one to two thousand."
)

r["glossary"] = [
 {"term": "swelling strain", "plain": "How much longer something gets, as a fraction of its length (0.2 % means 2 mm per metre)."},
 {"term": "mass uptake", "plain": "How much heavier the plastic gets from absorbed water, as a percentage of its dry weight."},
 {"term": "modulus", "plain": "Stiffness: how hard you must pull or bend to stretch the material a little."},
 {"term": "bilayer", "plain": "Two layers stuck together; if one swells and the other does not, the strip curls."},
 {"term": "curvature", "plain": "How tightly a strip is curled; one divided by the radius of the circle it follows."},
 {"term": "saturated-salt solution", "plain": "Salt stirred into water until no more dissolves; the air above it settles at a known, steady humidity."},
 {"term": "relative humidity (RH)", "plain": "How full of water vapour the air is, as a percentage of the most it can hold."},
 {"term": "DMA", "plain": "Dynamic mechanical analysis: a machine that gently wiggles a sample to measure its stiffness."},
 {"term": "DIC", "plain": "Digital image correlation: software that tracks a speckle pattern between photos to map stretching."},
 {"term": "sub-pixel", "plain": "Locating an edge in a photo more finely than one pixel by looking at how the brightness fades across it."},
 {"term": "Fick's law", "plain": "The standard rule for how a dissolved substance such as water creeps into a solid over time."},
 {"term": "diffusion coefficient (D)", "plain": "A number saying how fast water moves through the material."},
 {"term": "ISO 62 / ASTM D570", "plain": "Two near-identical standard recipes for measuring how much water a plastic absorbs."},
 {"term": "desiccator", "plain": "A sealed jar with a drying agent, used to cool dry samples without them re-absorbing moisture."},
 {"term": "SLA / SLS", "plain": "Two 3D-printing methods: curing liquid resin with light, or fusing powder with a laser."},
 {"term": "readability", "plain": "The smallest step a balance's display shows."},
 {"term": "fiducial", "plain": "A marked reference point put on a sample so it can be measured in photos."},
]

F = []
def add(claim, source, conf, quote="", value=""):
    d = {"claim": claim, "source": source, "confidence": conf}
    if value: d["value"] = value
    d["evidence_quote"] = quote
    F.append(d)

# ---------------- standards ----------------
add("ISO 62:2008 Method 1: dry at 50 C, weigh to 0.1 mg to constant mass, immerse in distilled water at 23.0 C +/- 1.0 C for 24 h, wipe, reweigh to 0.1 mg within 1 min, then continue at 24, 48, 96, 192 h for saturation.",
    ISO62, "high", "Reweigh the test specimens to the nearest 0,1 mg within 1 min of removing them from the water (mass m2).",
    "0.1 mg; 50 C; 23.0 C; <=1 min")
add("ISO 62 says drying takes 1 to 10 days at 50 C depending on thickness, so the dry reference state is days of work, not hours.",
    ISO62, "high", "At 50 C, for instance, a drying period of between one and ten days will be necessary, the exact duration depending on the thickness of the specimens.")
add("ISO 62 Method 3 corrects for extracted material: re-dry after immersion; if the re-dried mass m3 is below the starting dry mass m1, the loss is water-soluble matter and is added to the absorption.",
    ISO62, "high", "If this reconditioned mass m3 is less than the conditioned mass m1, the difference shall be considered as the water-soluble matter lost during the immersion test.")
add("ISO 62 Method 4 is the humid-air version (50 % RH only), with the same drying, weighing and time schedule. Other RH values need salt jars (ASTM E104 / ISO 483).",
    ISO62, "high", "The equilibrium moisture content is measured by repeating the exposure of the test specimens to 50 % relative humidity")
add("ISO 62 specimen: 1.0 +/- 0.1 mm squares (ISO 294-3), at least three per material; 8 mL water per cm2 and not less than 300 mL per specimen; the standard warns that 1 mm may not give meaningful results for some materials.",
    ISO62, "high", "For each material evaluated, test at least three test specimens.")
add("ISO 62 measures MASS in the through-thickness direction; it does not measure dimensional change although its introduction lists swelling as an effect of water. It excludes cellular plastics and powders, so porous SLS nylon needs extra care.",
    ISO62, "high", "The results obtained using the methods described in this International Standard are applicable to most plastics but are not applicable to cellular plastics, granulates or powders, which can show additional absorption and capillary effects.")
add("ISO 62 clause 7.2 fits Fick's law for sheets to get saturation content and D without waiting for constant mass; typical D 1e-6 mm2/s gives t70 about 1 day for 1 mm and the fit need not exceed one week. I reproduced the standard's c/cs table with the Crank series (agreement within 0.005).",
    ISO62 + " ; " + CALC, "high",
    "Typical values of D for plastics at 23 C are 10-6 mm2/s, which gives a t70 of 105 s (approximately 1 day) with the 1 mm test specimen.",
    "x=D*pi^2*t/d^2: c/cs 0.70 at x=1.0; 0.95 at x=2.79")
add("ASTM D570-22 covers relative rate of water absorption by immersion for sheets >=0.13 mm thick and is technically equivalent to ISO 62 when the 6.2 specimen is used. The standard costs USD 64 on the ASTM store page (D570-22).",
    "https://store.astm.org/d0570-22.html", "high",
    "This test method and ISO 62 are technically equivalent when the test specimen described in 6.2 is used.", "USD 64")
add("ASTM D638 tensile test: dumbbell specimens up to 14 mm thick; films under 1.0 mm should use D882; D638 and ISO 527-1 cover the same subject but differ in technical content. Store price USD 80 (D638-22), USD 96 (D638-14).",
    "https://store.astm.org/d0638-22.html ; https://store.astm.org/d0638-14.html", "high",
    "This standard and ISO 527-1 address the same subject matter, but differ in technical content.", "USD 80 / 96")
add("ISO 527 modulus is taken between 0.05 % and 0.25 % strain and the extension must be measured to +/-1 % or about +/-1 um. That window is as small as our 0.2 % swelling signal, so a tensile frame needs an extensometer or DIC; a phone image is not enough for ISO 527 modulus. (Vendor page, not the standard itself.)",
    "https://www.zwickroell.com/industries/plastics/thermoplastics-and-thermosetting-molding-materials/tensile-test-iso-527-1-2", "medium",
    "The tensile modulus is determined in the linear portion of the stress-strain curve, between 0.05% and 0.25% elongation.")
add("ASTM D5229 gives procedures to condition coupons to a moisture-free state, to laboratory equilibrium or to an arbitrary environment, and to get through-thickness diffusivity; written for composites but applicable to single-phase Fickian solids. USD 80.",
    "https://store.astm.org/d5229_d5229m-20.html", "high",
    "Also covered are procedures for conditioning test coupons prior to use in other test methods; either to an essentially moisture-free state, to equilibrium in a standard laboratory atmosphere environment, or to equilibrium in a non-laboratory environment.", "USD 80")
add("ASTM D4065 (DMA practice) is valid for materials from 0.5 MPa to 100 GPa and 0.01-1000 Hz, which spans Flexible 80A (about 6 MPa) to Rigid 10K (10 GPa); ASTM D5418 is the dual-cantilever DMA test. Prices USD 72 and 77.",
    "https://store.astm.org/d4065-20.html ; https://store.astm.org/d5418-15.html", "high",
    "This practice is intended for materials that have an elastic modulus in the range from 0.5 MPa to 100 GPa", "USD 72 / 77")
add("Humidity-controlled DMA (DMA-RH) exists as a commercial technique: isothermal RH ramps and steps on polymer films were reported with sorption and modulus recorded together. I found no price for the accessory.",
    "https://doi.org/10.3390/polym7010091", "medium",
    "A new technology, humidity-controlled dynamic mechanical analysis (DMA-RH) was explored to characterize CaCas/Gly films during isohume temperature (T) ramps and steps, and isothermal RH ramps and steps")
add("ASTM E104-20 describes saturated-salt solutions in small closed containers giving constant RH from dry to near saturation between 0 and 50 C, and warns that saturated salt solutions are corrosive. Price USD 86.",
    "https://store.astm.org/e0104-20.html", "high",
    "This practice is applicable for obtaining constant relative humidities ranging from dryness to near saturation at temperatures spanning from 0 to 50C.", "USD 86")
add("ISO 483:2005 covers enclosures under 200 dm3 using saturated salt, glycerol or sulfuric acid solutions to hold RH for conditioning plastics; confirmed current in 2023 per a search summary of the ISO page; I could not fetch the ISO page (HTTP 403).",
    "https://www.iso.org/standard/4525.html (search-result summary only)", "low", "")
# ---------------- salts ----------------
add("Greenspan (NBS 1977) evaluated humidity fixed points for 28 saturated salt solutions from about 3 to 98 % RH with uncertainties, from 21 investigations and 1106 measurements.",
    GRN, "high", "an evaluated compilation of equilibrium relative humidities in air versus temperature ... is presented for 28 binary saturated aqueous solutions. The relative humidities of the solutions range from about 3 to 98 percent.")
add("Greenspan Table 2 at 25 C (read from OCR text of the scan): LiCl 11.30 +/- 0.27, MgCl2 32.78 +/- 0.16, K2CO3 43.16 +/- 0.39, Mg(NO3)2 52.89 +/- 0.22, NaCl 75.29 +/- 0.12 %RH. KCl and K2SO4 rows were not legible in the scan OCR; Table 3 gives K2SO4 98.18 (10 C), 97.59 (20 C), 97.00 (30 C), so about 97.3 at 25 C by interpolation.",
    GRN + " ; text at " + D + "greenspan.txt", "medium",
    "25 32. 78 + 0.16 38.17 + 0.50 43.16 + 0.39 52.89 + 0.22 57.057 + 0 .40 64 .92 + 3.5 68.86 + 0.24 70.85 + 0.04 74.25 + 0.32 75.29 + 0.12",
    "LiCl 11.30; MgCl2 32.78; Mg(NO3)2 52.89; NaCl 75.29 %RH at 25 C")
add("Temperature sensitivity of the salts (own calculation from Greenspan Table 2, 20 to 30 C): Mg(NO3)2 -0.298 %RH/K, MgCl2 -0.063, NaCl -0.038, LiCl -0.003. Hold the jar to +/-1 K; Mg(NO3)2 is the most temperature sensitive, so +/-1 K is +/-0.3 %RH.",
    CALC, "high", "", "-0.298 %RH/K for Mg(NO3)2")
add("A humidity error of 1 %RH changes swelling strain by about 0.003 percentage points if total swelling is 0.3 % over 0-100 %RH (linear assumption) or 0.01 points if 1 %; the Sensirion SHT45 sensor is typically +/-1.0 %RH, enough to log the jars.",
    CALC + " ; " + D + "sht45.pdf", "medium", "SHT45 RH accuracy1 typ. 1.0 %RH")
# ---------------- templates ----------------
add("A published template for exactly this experiment exists (Krueger, Tahouni, Sachse 2021, 4D-printed hygroscopic bilayers): monolayer coupons 75 x 20 x 0.8 mm are measured in water, 80 % RH and 30 % RH at 23 C, two days each; swelling strain from caliper length/width/thickness and weight; Young's modulus from deflection under self-weight; bilayer curvature from photos.",
    KRUG, "high",
    "at 23 C in water submersion for wet, in 80% ambient humidity for humid and in 30% ambient humidity for dry state over two days to reach equilibrium.")
add("Krueger et al. instruments: caliper accuracy 0.02 mm and a scale quoted as 0.001 mg (almost certainly a typo for 0.001 g, since 0.001 mg is below any lab balance). A 0.02 mm caliper on a 75 mm coupon is 0.027 % strain error, fine for their large wood-filament swelling, but 0.05 % on 40 mm, a quarter of our 0.2 % signal.",
    KRUG + " ; " + CALC, "high",
    "using a digital caliper with an accuracy of 0.02 mm and a scale with an accuracy of 0.001 mg.", "0.02/40 = 0.05 %")
add("Krueger et al. curvature method: strips stood on a flat surface parallel to their strong axis to avoid self-weight bending, imaged from above, and radius from a three-point circumcircle in ImageJ; samples measured with passive side up and down and averaged to cancel initial curvature. A least-squares circle fit to many sub-pixel edge points is an improvement I propose (not in the paper).",
    KRUG, "high",
    "Samples were positioned on a flat surface, standing parallel to their strong axis to avoid additional bending due to self-weight. Images were taken from above and analyzed with a script in ImageJ")
add("Krueger et al. found modulus ratio n of 25 to 60 and a roughly 10-fold wet-to-dry modulus change for their active material, showing the modulus has to be measured in the wet and the dry state, not once.",
    KRUG, "high", "For Laywood, an approximately 10-fold increase from wet to dry state can be observed")
add("Measurement set of a recent polyamide 6.6 moisture study: dried at 50 C per ISO 62, balance Mettler AE200 +/-0.1 mg, outside micrometer +/-1 um, density by buoyancy, DIC (GOM ARAMIS 3D) for tensile tests; strain defined as L1/L0 - 1 from the dry state; CME 1.814e-4 (x), 1.823e-4 (y), 3.681e-4 (z) m3/kg. Use a PA6.6 or PA6 plate as the method-validation reference.",
    PA66, "high",
    "the length, width and thickness of the samples was recorded using a digital outside micrometer (Mitutoyo Digimatic, +/-1 um). Secondly, the density and the volume of the samples were measured with the buoyancy method")
# ---------------- DIC / camera ----------------
add("iDIC Good Practices Guide: speckle/feature size should be 3-5 pixels; 2D-DIC assumes the piece stays planar and perpendicular to the optical axis, so it is invalid for a curling bilayer; do a noise-floor analysis on static images before the test. The guide gives no single strain-resolution number.",
    IDIC, "high",
    "For 2D-DIC, the test piece is assumed to be planar, to remain planar throughout the test, to be perpendicular to the camera optical axis, and to maintain constant SOD throughout the test.")
add("iDIC noise-floor rule I apply to every optical measurement here: image the unexposed coupon repeatedly and treat any length change smaller than that scatter as noise.",
    IDIC, "high",
    "Any of those QOIs measured in the actual mechanical test that are smaller than the QOIs measured from the static images are indistinguishable from the noise.")
add("Printed-part tolerance: Formlabs Form 4 XY tolerance (Grey V5, 100 um layers, three printers) is +/-0.15 % for 1-30 mm (floor 0.02 mm), +/-0.2 % for 31-80 mm (floor 0.06 mm), +/-0.3 % for 81-150 mm. A 40 mm strip therefore varies by +/-0.2 % = 80 um between prints, equal to the entire swelling signal, so strain must be a paired before/after measurement on the same coupon.",
    TOL, "high",
    "1-30 mm features: +/-0.15% (lower limit: +/-0.02 mm) 31-80 mm features: +/-0.2% (lower limit: +/-0.06 mm) 81-150 mm features: +/-0.3% (lower limit: +/-0.15 mm)",
    "+/-0.2 % x 40 mm = +/-80 um")
# ---------------- Formlabs data ----------------
add("Formlabs cube method: washed, post-cured 1 cm cubes, weight gain after 24 h. Same table, 24 h water: Flexible 80A Resin 0.7 %, Elastic 50A V2 0.7 %, Rigid 10K <0.1 %; IPA: Elastic 50A V2 39.2 %, Rigid 10K <0.1 %; xylene: Elastic 50A V2 163.9 %. CONFIRMS the earlier agents (and the brief's 39 % vs <0.1 %).",
    SOLV + " (parsed: " + D + "solvent.html)", "high",
    "Results are reported as weight gain percentage after 24 hours of exposure to solvent.", "Elastic 50A V2 IPA 39.2 %; Rigid 10K IPA <0.1 %")
add("CONTRADICTION with 'every stock resin gains under 1 % in 24 h' (spec-resin-chemistry, repeated in the brief): the Flexible 80A V2 data sheet reports deionized water 1 day: hardness -26 Shore A, mass +8 %, volume +3 %; 1 week: -27, +9 %, +7 % (ASTM D471 slabs wiped dry, no conditioning). The row was rebuilt from text coordinates because the PDF text is scrambled. It agrees with spec-formlabs-materials and conflicts with the 0.7 % cube value for 'Flexible 80A Resin'. Cause unresolved: slab vs cube, thickness, wipe method, or V1 vs V2 chemistry.",
    FLEX + " ; " + S + "pdf_rows.py flex80v2.pdf 6", "medium",
    "Rectangular slabs, used for hardness, mass, and volume change, are evaluated immediately after wiping dry without a conditioning period.",
    "1 d: +8 % mass, +3 % vol; 1 wk: +9 %, +7 %")
add("Mass gain is not volume-additive for Flexible 80A V2: if +8 % mass were all water entering as extra volume, volume should rise by 0.08 x 1.09/1.0 = 8.7 %, but Formlabs reports +3 % (ratio 0.34 at 1 day; 0.07/0.098 = 0.71 at 1 week). Isotropic linear strain at 1 day would be 1.03^(1/3) - 1 = 0.99 %. So the earlier assumption that strain follows mass through volume additivity with an efficiency of 0.54-0.73 is untested and, here, looks too high at 1 day. Measuring this ratio is a stated aim of the protocol.",
    CALC, "medium", "", "efficiency 0.34 (1 d), 0.71 (1 wk)")
add("Grey V5 Type IV tensile bars in DI water (ASTM D543): 1 day mass 101.38 %, modulus 88.63 %, strength 89.21 %; 1 week mass 103.23 %, modulus 65.29 %, strength 67.62 %. I confirmed the earlier agent's row assignment (it called it low confidence) by text position: the unlabeled DI row sits at y=8815 between the 'DI' and 'Water' labels at y=8803 and 8827 on the 1-day page.",
    CLEAR + " ; " + S + "pdf_rows.py clearv5.pdf 9 / 10", "high",
    "88.63% | 89.21% | 105.36% | 101.38%  (1 day, DI Water);  65.29% | 67.62% | 83.53% | 103.23%  (1 week, DI Water)",
    "mass +1.38 %/+3.23 %; modulus x0.886/x0.653")
add("Formlabs' wet-modulus test conditions bars for 24 h in air after removal from the liquid before pulling them. Thin bars lose water in that time, so the published 'wet' modulus is likely an overestimate of true wet stiffness. Test wet specimens within minutes and weigh them before and after the pull.",
    CLEAR, "high",
    "After removal, exposed samples were washed and conditioned for 24 hours at 22 C before mechanical testing.")
add("Own fit of Fick's law (ISO 62 clause 7.2 form, Crank series) to the three Formlabs Grey V5 water points (bar 1 d 1.38 %, bar 7 d 3.23 %, 1 cm cube 24 h 0.8 %): D = 5.4e-13 m2/s (bar as 3.2 x 6 x 33 mm box, fit residual <=0.02 points) to 1.9e-12 m2/s (faces only, residual 0.29), saturation 4.3-5.9 %. Time to 95 % of saturation: 0.4 mm 6.6-23 h; 0.8 mm 26-93 h; 1.0 mm 41-145 h; 2.0 mm 165-582 h. Assumed geometry (Type IV nominal) makes this order-of-magnitude only; it is the first water diffusion estimate for a Formlabs resin and lies inside the filament range 2.8e-13 to 4.2e-12 m2/s quoted by the earlier agent.",
    CALC, "low", "", "D 0.5-1.9e-12 m2/s; t95(0.8 mm) 26-93 h")
# ---------------- resolution arithmetic ----------------
add("Strain resolution arithmetic: 0.2 % x 40 mm = 80 um. For a 10 % (1 sigma) strain measurement sigma(dL) = 8 um. To distinguish the Timoshenko law from a 20 % error at 3 sigma the strain needs <=6.7 % relative uncertainty = 5.3 um on the length change = 3.8 um per length reading (two readings). This agrees with the earlier agent's '4 um on 40 mm'.",
    CALC, "high", "", "80 um signal; 5.3 um budget")
add("Caliper: resolution 0.01 mm, accuracy +/-0.001 in (25.4 um) on the Travers page for a Mitutoyo 6 in digital caliper (listed there as 500-196-32), USD 190 catalogue. Accuracy is 32 % of the 80 um signal. Pure quantisation of a difference of two readings is 4.1 um (0.010 % strain), so a caliper could work only if its systematic error cancels between dry and wet readings and jaw force on soft wet resin is constant, which is doubtful.",
    "https://www.travers.com/6-absolute-digimatic-caliper/p/57-016-342/ ; " + CALC, "medium",
    "Accuracy +/-.001\"", "25.4 um; USD 190")
add("Camera arithmetic (assumed 12 MP, 4000 px across, which is unverified background): 60 mm field gives 15 um/px; edge localisation 0.1 px = 1.5 um; two edges 2.1 um = 0.005 % strain; at a pessimistic 0.5 px, 0.027 %. Camera tilt of 1 degree foreshortens length by 0.015 %, 2 degrees 0.061 %, 5 degrees 0.38 %, so the jig must hold the coupon flat to <1 degree and the same camera pose for both images. A 1200 dpi flatbed scanner gives 21 um/px.",
    CALC, "medium", "", "15 um/px; 0.005-0.027 % strain noise; 1 degree tilt = 0.015 %")
add("Lens distortion cancels to first order only if the coupon is photographed at the same pixel position; calibrate the lens with a planar target (Zhang 2000) and keep a printed or etched scale bar in the coupon plane.",
    "https://doi.org/10.1109/34.888718 (title/metadata only, paper not read)", "low", "")
# ---------------- mass arithmetic ----------------
add("Mass arithmetic: 40 x 10 x 1 mm = 0.4 cm3 = 0.484 g (density 1.21, Clear V5) or 0.436 g (1.09, Flexible 80A V2). 1 % uptake = 4.84 mg; 0.1 % = 0.48 mg; 8 % = 38.7 mg. Relative 1-sigma error of an uptake from two quantised readings (readability/sqrt(12) x sqrt(2)): 0.1 mg balance 8.4 % at 0.1 % uptake, 0.8 % at 1 %; 1 mg balance 84 % and 8.4 %; 10 mg scale 843 % and 84 %; 100 mg kitchen scale 8435 % and 843 %. Stacking 40 coupons on a 10 mg scale gives 2.1 % at 1 % uptake and 0.3 % at 8 %; on a 100 mg scale 21 % and 2.6 %.",
    CALC, "high", "", "0.1 mg: 0.8 % at 1 % uptake")
add("Surface water: a coupon of 9 cm2 surface carries 0.9 mg per 1 um of residual water film and 9 mg per 10 um, i.e. 0.19 % and 1.9 % of its mass. This blotting error exceeds the 0.1-1 % uptake of rigid resins, so blot with one fixed routine, weigh within 1 min (ISO 62), run a blotted dummy of an inert reference, and cross-check with loss on drying.",
    CALC, "high", "", "10 um film = 9 mg = 1.9 %")
add("Water loss during the 60 s weighing is small for slow materials (1.75 % of the absorbed content for D = 1e-6 mm2/s at 1 mm) but 5.5 % for D = 1e-5 mm2/s, so use a weighing bottle for sub-mm or fast-diffusing specimens (ISO 62 says so for boiling-water tests of thin specimens).",
    CALC + " ; " + ISO62, "medium", "", "1.75 % / 5.5 %")
# ---------------- modulus + curvature ----------------
add("Self-weight deflection is a poor modulus gauge for rigid resin: a 40 mm x 0.8 mm cantilever sags only 0.026 mm (Clear V5 dry, E=2750 MPa) or 0.040 mm (E x 0.653), under 3 pixels, but 11 mm for Flexible 80A V2 (E about 5.8 MPa secant, from the project record). Rigid strips are therefore measured by dead-weight bending, and soft strips lying flat will sag far more than they curl, so measure them on edge (Krueger) or floating in water.",
    CALC, "high", "", "26 um (rigid) vs 11 mm (soft)")
add("Dead-weight three-point bend (span 30 mm, width 10 mm, thickness 1 mm) deflects Clear V5 by 0.25 mm at 1 N (dry) and 0.38 mm (wet), readable to about 1 % with a 15 um/px image. Error budget of E: deflection 1 %, thickness 1 % (10 um, needs a micrometer, enters as cube), span 0.3 %, force 1 % gives 3.4 %; with a 25 um caliper thickness error (2.5 %) it is 7.7 %. Linear beam theory fails for soft elastomers at these loads, so test Flexible 80A in tension with printed fiducials and small weights.",
    CALC, "medium", "", "E +/-3.4 % with micrometer; +/-7.7 % with caliper")
add("How exact must the modulus ratio be? Using the project-record f(m,n) with the thickness ratio chosen as m = n_est^(-1/2), a modulus ratio mis-estimated by a factor 2 (either way) costs at most 3.0 % of the 3/2 ceiling (n=2: 3.0 % if n_est is half the truth, 2.7 % if double; n=10: 2.6 % and 1.8 %; n=50: 1.7 % and 1.0 %); a 30 % error costs under 1 %. So modulus needs only +/-30-50 %, and the binding inputs are the free strain d_eps and the thickness h, which enter kappa one-for-one.",
    S + "sens_n.py (output sens_n_out.json)", "high", "", "factor-2 error in n costs <=3.0 % of curvature")
add("Bilayer readout needs: for optimum h=0.8 mm and strain 0.2 %, kappa = 1.5 x 0.002/0.8 mm = 3.75 /m (R = 267 mm), sagitta over a 40 mm chord = 0.75 mm = 50 px at 15 um/px; a 1.5 um edge error is 0.2 % of the sagitta. At 1 % strain: R=53 mm, sagitta 3.75 mm. Converting back, d_eps = kappa h/1.5 has relative error sqrt(dk^2 + dh^2): 2.4 % with 2 % curvature and 10 um thickness error, 3.7 % with a 25 um error.",
    CALC, "high", "", "R=267 mm; sagitta 0.75 mm")
add("The earlier agent's bilayer resolution statement (spec-bilayer-physics: thickness to 3 %, free strain to 5 %, i.e. 4 um on 40 mm at 0.2 %) is confirmed by my arithmetic (4 um = 5 % of 80 um); I add that Form 4's own +/-80 um tolerance forces a paired design and that gravity sag of soft strips swamps the signal unless they are measured on edge or floating.",
    CALC + " ; " + "D:/Users/ashenoy00000/delphi-work/agents/spec-bilayer-physics.json", "medium", "")
# ---------------- prices ----------------
add("Prices read from fetched pages: Ohaus Pioneer PX124 analytical balance (120 g x 0.1 mg, internal calibration) USD 2,261.11 at Scientific Labs; the PX124/E external-calibration unit AUD 2,219 incl. GST at Wiltronics; Mitutoyo-type 6 in digital caliper USD 190 at Travers.",
    "https://scientificlabs.com/en/product/-nocategory-/BAL1302 ; https://www.wiltronics.com.au/product/90397/ohaus-pioneer-analytical-balance/ ; https://www.travers.com/6-absolute-digimatic-caliper/p/57-016-342/", "medium",
    "Capacity, g 120 Dims, w x d x h, mm 209 x 321 x 309 Pan Dims, mm Pan 90 Readability, mg 0.1", "USD 2,261.11")
add("Prices from search-result summaries only (pages not fetched, so low confidence): Ohaus SPX123 (120 g x 0.001 g) about USD 485 to 1,036 across dealers; a sub-USD 15 kitchen scale of 2000 g x 0.1 g was mentioned by a reviewer.",
    "web search summaries, 2026-11-12", "low", "")
add("Phone/kitchen-scale limits (own arithmetic, section above): a phone + tripod + backlit jig can measure strain to the order of 0.01-0.03 % and bilayer curvature (R 53-530 mm) well; it cannot give 0.1-1 % mass uptake (needs <=1 mg readability), cannot give rigid-resin modulus better than about 10 % without a thickness gauge good to ~10 um, and cannot do DMA or ISO 527 modulus.",
    CALC, "medium", "")

r["findings"] = F

r["key_claims"] = [
 {"claim": "ISO 62 (technically equivalent to ASTM D570) is a MASS method: dry at 50 C to constant mass, weigh to 0.1 mg within 1 min of removal, 23.0 +/- 1.0 C water, time series to saturation, re-dry to catch extracted material, and fit Fick's law for D and saturation content. It does not measure swelling strain, so strain, modulus and curvature need add-on methods.",
  "source": ISO62 + " ; https://store.astm.org/d0570-22.html",
  "evidence_quote": "Reweigh the test specimens to the nearest 0,1 mg within 1 min of removing them from the water (mass m2)."},
 {"claim": "A 0.2 % strain on a 40 mm strip is 80 um, and distinguishing the bilayer law from a 20 % error at 3 sigma needs the length change known to about 5 um. A caliper (25.4 um accuracy) fails that; a calibrated, fixed-pose photograph (15 um/px, sub-pixel edges) can meet it on paper, and a micrometer (+/-1 um, used on the PA6.6 study) or DIC would be the reference.",
  "source": CALC + " ; https://www.travers.com/6-absolute-digimatic-caliper/p/57-016-342/ ; " + PA66,
  "evidence_quote": "Accuracy +/-.001\""},
 {"claim": "Formlabs' Form 4 prints 31-80 mm features to only +/-0.2 % (floor +/-0.06 mm), the same size as the swelling signal, so strain must be measured on the same coupon before and after exposure, never against nominal size or against a different print.",
  "source": TOL,
  "evidence_quote": "31-80 mm features: +/-0.2% (lower limit: +/-0.06 mm)"},
 {"claim": "The brief's 'stock Formlabs resins gain under 1 % in 24 h' holds for the cube table but not for Flexible 80A V2, whose data sheet gives +8 % mass and +3 % volume in deionized water after 1 day (ASTM D471 slab). This resin belongs in the first experiment and is the only catalogue material read so far with a swelling large enough to matter.",
  "source": FLEX,
  "evidence_quote": "Rectangular slabs, used for hardness, mass, and volume change, are evaluated immediately after wiping dry without a conditioning period."},
]

r["table"] = [
 {"name": "Step 1 dry reference", "fields": "oven=50 +/-2 C; time=1-10 d to constant mass +/-0.1 mg; cool=desiccator; balance=0.1 mg; image L0, w0, t0 on same coupon", "source": ISO62},
 {"name": "Step 2 immersion series", "fields": "water=distilled 23.0 +/-1.0 C; >=8 mL/cm2 and >=300 mL per specimen; weigh at 2,6,24,48,96,192 h; each weighing <=1 min after blotting; n>=3 (use 5)", "source": ISO62},
 {"name": "Step 3 humid series", "fields": "jars at 23 +/-1 C; LiCl 11.30, MgCl2 32.78, Mg(NO3)2 52.89, NaCl 75.29 %RH (25 C values; 20 C: 11.31, 33.07, 54.38, 75.47); log RH with SHT45 (+/-1 %RH typ.); equilibrate ~2 d (Kruger) to 6 d (t95 for 1 mm, own fit)", "source": GRN + " ; " + KRUG},
 {"name": "Step 4 re-dry", "fields": "re-dry at 50 C to constant mass m3; soluble loss = m1 - m3 added to uptake", "source": ISO62},
 {"name": "Step 5 swelling strain", "fields": "eps = L1/L0 - 1 on same coupon; budget <=5.3 um on 40 mm (3.8 um per reading); fiducial holes 0.5 mm (Form 4 minimum hole) ~36 mm apart, backlit; camera fixed pose, tilt <1 degree (0.015 %)", "source": CALC + " ; " + TOL},
 {"name": "Step 6 modulus", "fields": "dry and wet: 3-point bend by dead weights (span 30 mm: 1 N gives 0.25 mm dry, 0.38 mm wet on Clear V5), plus DMA (ASTM D4065/D5418, 0.5 MPa-100 GPa) or tensile (ASTM D638 / ISO 527: 0.05-0.25 % window, +/-1 um extensometer); test within minutes of removal, weigh before and after", "source": CALC + " ; https://store.astm.org/d4065-20.html"},
 {"name": "Step 7 bilayer curvature", "fields": "strip 40 x 5 mm bonded; stand on long edge; photograph; least-squares circle fit to sub-pixel edge; flip and average to cancel initial curvature; compare with f(m,n)*d_eps/h (d_eps from Step 5, n from Step 6, h by micrometer +/-10 um)", "source": KRUG + " ; project record Lean-checked ceiling 3/2"},
 {"name": "Controls", "fields": "PA6/PA6.6 plate (CME 1.81e-4 m3/kg in-plane, 0.21 % linear per 1 wt % water by own conversion); sealed or Rigid 10K dummy; blotted inert dummy; static-image noise floor (iDIC); temperature log (+/-0.5 K)", "source": PA66 + " ; " + IDIC},
 {"name": "Balance: 0.1 mg analytical (Ohaus PX124)", "fields": "readability=0.1 mg; rel 1-sigma error at 1 % uptake=0.8 %; price=USD 2,261.11 (also AUD 2,219); meets ISO 62", "source": "https://scientificlabs.com/en/product/-nocategory-/BAL1302"},
 {"name": "Balance: 1 mg precision (Ohaus SPX123 class)", "fields": "readability=1 mg; rel error at 1 % uptake=8.4 %, at 8 %=1.1 %; price=USD 485-1,036 (search summaries, low confidence); adequate for Flexible 80A, marginal for rigid resin", "source": "web search summaries 2026-11-12"},
 {"name": "Scale: 0.01 g pocket or 0.1 g kitchen", "fields": "readability=10 or 100 mg; one coupon cannot be used (843 % / 8435 % error at 1 %); 40 coupons stacked: 2.1 % / 21 % at 1 %, 0.3 % / 2.6 % at 8 %; price=under USD 15-30 (unverified background)", "source": CALC},
 {"name": "Length: caliper 0.01 mm", "fields": "accuracy=25.4 um (32 % of 80 um signal); quantisation noise of a difference=4.1 um; price=USD 190; jaw force deforms wet soft resin", "source": "https://www.travers.com/6-absolute-digimatic-caliper/p/57-016-342/"},
 {"name": "Length: outside micrometer +/-1 um", "fields": "accuracy=1 um (used on PA6.6 study); needed for thickness (cube sensitivity in E); price ~USD 100-200 (unverified background)", "source": PA66},
 {"name": "Length: phone camera 12 MP (assumed)", "fields": "15 um/px at 60 mm field; 0.1 px edge=1.5 um; strain noise 0.005 % (0.1 px) to 0.027 % (0.5 px); needs tripod, backlit jig, lens calibration; cost ~USD 0-60 beyond the phone (unverified)", "source": CALC},
 {"name": "Humidity logger: Sensirion SHT45", "fields": "RH accuracy typ. +/-1.0 %RH; T +/-0.1 C; price ~USD 15 breakout board (unverified background)", "source": D + "sht45.pdf"},
 {"name": "Cost tier 0: phone + pocket scale", "fields": "approx USD 110 (tripod/LED panel/glass 40 + scale 15 + salts and tubs 40 + SHT45 15; all unverified background); can do: curl direction and size, strain 0.01-0.03 %, soft-resin mass uptake with stacks; cannot do: rigid-resin uptake, modulus, ISO claims", "source": "own estimate"},
 {"name": "Cost tier 1: credible", "fields": "approx USD 940-1,840 (1 mg balance 485-1,036 + micrometer 100-200 + food dehydrator/oven 50-300 + SHT45 15 + salts 40 + camera rig 60 + caliper 190); can do: strain, uptake >=0.5 %, E to ~5-8 %, bilayer curvature", "source": "own estimate from rows above"},
 {"name": "Cost tier 2: ISO-conformant", "fields": "approx USD 3,600 plus chamber and DMA (PX124 2,261 + caliper 190 + micrometer 150 + oven ~1,000 = 3,601); Binder-class climate chamber price and DMA/tensile core-facility fees NOT FOUND; standards to buy: D570 64 + D638 80 + E104 86 + D5229 80 + D4065 72 = USD 382 (ISO 62 text was free from law.resource.org)", "source": "https://store.astm.org/ ; own sum"},
]

r["recommendations"] = [
 "Run Experiment 1 in this order: (1) dry and weigh all coupons; (2) photograph dry; (3) immerse and weigh/photograph on the ISO 62 schedule; (4) humid jars; (5) re-dry; (6) wet/dry modulus on companion bars; (7) bond and image bilayers. Expect about four weeks (1-10 d drying, 8 d immersion, 4 jars x ~6 d).",
 "Specimens: Flexible 80A V2 (the +8 % candidate), Grey or Clear V5 and Rigid 10K (stock pair), Tough 2000 V2 optional, plus a PA6.6/PA6 plate as method reference; each at 0.4 and ~1.0 mm; n=5 strips plus n>=3 ISO plates. Print all in one job orientation and record washing and post-cure settings (swelling depends on cure state); pre-extract in water and re-dry once before the baseline so extractables do not masquerade as negative swelling.",
 "Never use the caliper for the strain number. Use fixed-pose calibrated photographs of backlit fiducial holes (or DIC with a 3-5 px speckle if the coupon is flat), reference the same coupon dry vs wet, and run a static-image noise floor first; require noise <=2 um per reading before trusting 0.2 % strain.",
 "Weigh with a 0.1 mg balance (ISO 62), or a 1 mg balance for Flexible 80A only; fix the blotting routine, weigh within 60 s, and check with a re-dry. Do not use kitchen scales for mass uptake of rigid resins.",
 "Report for every material: m(t), eps(t) on one plot, saturation uptake, D from the Fick fit, swelling efficiency (volume change per volume of water taken up), E_dry, E_wet at the same water content, and kappa measured vs kappa predicted = f(m,n) d_eps/h with its uncertainty. The pass criterion for the Lean-checked law is agreement within the combined uncertainty, not a fixed 20 % band.",
 "Resolve the Flexible 80A discrepancy first: print one 1 cm cube and one 40 x 10 x 1 mm slab of the same lot, run both 24 h in distilled water by the Formlabs cube method and the ISO 62 method; if they differ, thickness/wiping is the cause, if not, the cube-table row is a different resin version.",
 "Buy before the first run: 0.1 mg or 1 mg balance, micrometer, SHT45 logger, six salts and sealed tubs. Defer: climate chamber, DMA (use a university core facility).",
]

r["reproduce"] = [
 {"what": "All arithmetic (Fickian fit, resolution, mass, sag, bend, curvature, salts)", "command_or_url": "cd D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-testing-metrology && python calc.py   (Python 3.14, numpy+scipy)", "expected": "writes calc_out.json; strain.signal_um=80, sigma_dL_for_6.7pct_um=5.33; grey_v5_fit box D=5.39e-7 mm2/s, t95_d0.8mm_h=93.07; coupon_mass 0.484 g; wet_film 10 um = 9 mg = 1.86 %; iso62_table_check agrees within 0.005"},
 {"what": "Sensitivity of curvature to a wrong modulus ratio", "command_or_url": "python sens_n.py", "expected": "n_true=10, n_est=2x -> f=1.4725 (1.83 % loss); n_true=2, n_est=0.5x -> 3.03 % loss"},
 {"what": "ISO 62 text", "command_or_url": "curl -L -A delphi-research/0.1 -o iso62.pdf https://law.resource.org/pub/us/cfr/ibr/inc/iso/iso.0062.2008.pdf ; pdftotext -layout iso62.pdf iso62.txt ; grep -a 'nearest 0,1 mg' iso62.txt  (pdftotext 4.00)", "expected": "HTTP 200, 487230 bytes, sha256 3883aa70...5b; lines 'Reweigh ... to the nearest 0,1 mg within 1 min'"},
 {"what": "Flexible 80A V2 deionized-water row", "command_or_url": "curl -L -o flex80v2.pdf https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf ; python pdf_rows.py flex80v2.pdf 6 | grep -A1 Deionized  (pypdf 6.19.0)", "expected": "'Deionized Water' with rows '1 day -26 +8% +3% 94% 89%' and '1 week -27 +9% +7% 101% 88%'"},
 {"what": "Grey V5 DI-water rows", "command_or_url": "python pdf_rows.py clearv5.pdf 9 ; python pdf_rows.py clearv5.pdf 10  (file from the Clear V5 TDS URL in sources)", "expected": "1 day 88.63% | 89.21% | 105.36% | 101.38% between the DI and Water labels; 1 week 65.29% | 67.62% | 83.53% | 103.23%"},
 {"what": "Formlabs cube table (water, IPA, xylene columns)", "command_or_url": "curl -L -o solvent.html https://formlabs.com/support/solvent-compatibility/ and parse <tr> rows (header order: ... Isopropyl Alcohol, ..., Water, Xylene)", "expected": "Elastic 50A Resin V2: IPA 39.2, Water 0.7, Xylene 163.9; Rigid 10K: IPA <0.1, Water <0.1; Flexible 80A Resin: Water 0.7"},
 {"what": "Form 4 tolerances", "command_or_url": "https://formlabs.com/support/Design-specifications-for-3D-models-Form-4-generation/ (section 'Typical dimensional tolerances')", "expected": "31-80 mm features: +/-0.2% (lower limit: +/-0.06 mm)"},
 {"what": "ASTM scopes and prices", "command_or_url": "python astm_scope.py d0570-22 d0638-22 e0104-20 d5229_d5229m-20 d4065-20 d5418-15", "expected": "scope text and 'price $ 64 / 80 / 86 / 80 / 72 / 77' (prices change)"},
 {"what": "Citation resolution", "command_or_url": "python crossref_check.py 10.6028/jres.081A.011 10.3390/biomimetics6040058 10.3390/polym15163387 10.32720/idics/gpg.ed1/print.format 10.1109/34.888718 10.1177/002199837601000101 10.1364/JOSA.11.000233 10.3390/polym7010091 10.1016/j.polymertesting.2010.11.012", "expected": "nine lines starting OK with matching titles"},
 {"what": "File hashes of everything downloaded", "command_or_url": "python make_manifest.py -> D:/Users/ashenoy00000/delphi-work/data/bm-testing-metrology/MANIFEST.tsv", "expected": "size and sha256 per file, 26 MB total"},
 {"what": "Not reproducible", "command_or_url": "Search-snippet claims (ISO 483 scope, balance price ranges, Sensirion/ZwickRoell search summaries, Ohaus SPX123 range)", "expected": "re-run the searches; pages for these were not fetched or were blocked (HTTP 403)"},
]

r["citations"] = [
 {"authors": "Greenspan L.", "year": 1977, "title": "Humidity fixed points of binary saturated aqueous solutions", "venue": "J. Res. Natl. Bur. Stand. A 81A(1):89", "doi_or_arxiv": "10.6028/jres.081A.011", "verified": True, "how_verified": "Crossref API resolved; PDF downloaded from nvlpubs.nist.gov and Table 2 read", "used_for": "RH of saturated salts, uncertainties, temperature slopes"},
 {"authors": "Krueger F., Thierer R., Tahouni Y., Sachse R. et al.", "year": 2021, "title": "Development of a Material Design Space for 4D-Printed Bio-Inspired Hygroscopically Actuated Bilayer Structures with Unequal Effective Layer Widths", "venue": "Biomimetics 6(4):58", "doi_or_arxiv": "10.3390/biomimetics6040058", "verified": True, "how_verified": "Crossref API resolved; full text fetched from Europe PMC (PMC8544213) and methods read", "used_for": "template for coupon, humidity-state, caliper/scale and photo-curvature methods"},
 {"authors": "Wetzel D., Sambale A., Uhlig K., Stommel M.", "year": 2023, "title": "Hygromechanical Behavior of Polyamide 6.6: Experiments and Modeling", "venue": "Polymers 15(16):3387", "doi_or_arxiv": "10.3390/polym15163387", "verified": True, "how_verified": "Crossref API resolved; full text fetched from Europe PMC (PMC10459301)", "used_for": "balance and micrometer precision, ISO 62 drying, CME, reference material"},
 {"authors": "Bigger R., Blaysat B., Boo C., Grewer M. et al. (iDICs)", "year": 2018, "title": "A Good Practices Guide for Digital Image Correlation", "venue": "International Digital Image Correlation Society", "doi_or_arxiv": "10.32720/idics/gpg.ed1/print.format", "verified": True, "how_verified": "Crossref API resolved; PDF downloaded from idics.org and text searched", "used_for": "3-5 px feature size, 2D-DIC planarity caution, noise-floor analysis"},
 {"authors": "Zhang Z.", "year": 2000, "title": "A flexible new technique for camera calibration", "venue": "IEEE TPAMI", "doi_or_arxiv": "10.1109/34.888718", "verified": True, "how_verified": "Crossref API resolved; paper not read (metadata only)", "used_for": "camera and lens calibration with a planar target"},
 {"authors": "Bonnaillie L.M., Tomasula P.M.", "year": 2015, "title": "Application of Humidity-Controlled Dynamic Mechanical Analysis (DMA-RH) to Moisture-Sensitive Edible Casein Films for Use in Food Packaging", "venue": "Polymers 7(1):91", "doi_or_arxiv": "10.3390/polym7010091", "verified": True, "how_verified": "Crossref API resolved and abstract read", "used_for": "existence and use of humidity-controlled DMA"},
 {"authors": "Shen C.-H., Springer G.S.", "year": 1976, "title": "Moisture Absorption and Desorption of Composite Materials", "venue": "J. Compos. Mater. 10(1)", "doi_or_arxiv": "10.1177/002199837601000101", "verified": True, "how_verified": "Crossref API resolved; metadata only, not read", "used_for": "background for the Fick fit that ISO 62 clause 7.2 uses (not used for any number)"},
 {"authors": "van den Berg J.H., Barink M., Giesen P., Meinders E.R.", "year": 2011, "title": "Hygroscopic and thermal micro deformations of plastic substrates for flexible electronics using digital image correlation", "venue": "Polymer Testing", "doi_or_arxiv": "10.1016/j.polymertesting.2010.11.012", "verified": True, "how_verified": "Crossref API resolved; abstract and content NOT read (publisher page blocked)", "used_for": "pointer that DIC has been used for hygroscopic strain of polymer films; no number taken"},
 {"authors": "Timoshenko S.", "year": 1925, "title": "Analysis of Bi-Metal Thermostats", "venue": "J. Opt. Soc. Am. 11:233", "doi_or_arxiv": "10.1364/JOSA.11.000233", "verified": True, "how_verified": "Crossref API resolved; metadata only", "used_for": "origin of the bilayer coefficient f(m,n) that the protocol tests (project record has the formula)"},
]

r["could_not_find"] = [
 "Full text of ASTM D570-22, ASTM D638, ASTM E104, ASTM D5229, ISO 527-1/-2 and ISO 483 (paywalled or HTTP 403). Only ASTM store scope text and a vendor page were read, so ISO 527 test speed/modulus window rest on a vendor page and the D570-22 drying options were not verified (a search snippet said D570-22 may allow 1 h at 105-110 C for some materials). ISO 62:2008 itself was read in full from law.resource.org.",
 "Any published hygroscopic expansion coefficient or humid-air swelling measurement for a Formlabs resin: a targeted search (3D printed photopolymer resin, humidity chamber, bilayer) returned none, so the earlier agents' gap stands and this protocol is how to fill it.",
 "Greenspan KCl and K2SO4 25 C values: the table block is not legible in the scan OCR (K2SO4 interpolated from Table 3; KCl not read; NaBr 57.57 is ambiguous). A secondary search summary gave KCl 84.34 and K2SO4 97.30 but that page was not fetched.",
 "A numeric strain-resolution figure in the iDIC guide (it gives method, not a number) and the content of van den Berg 2011 (blocked).",
 "A standard for photographic edge-on curvature fitting: none found; I used Krueger et al. (ImageJ circumcircle) and propose a least-squares sub-pixel circle fit as my own refinement.",
 "Prices of a Binder-class climate chamber, DMA with humidity accessory, university core-facility fees, micrometer, lab oven and cheap scales: not found (marked unverified background). Phone sensor size (12 MP assumed) and thermal expansion coefficient of the resins (matters at about 1 K = 0.01 % if 100 ppm/K, unverified background) were not sourced.",
 "The cause of the Flexible 80A discrepancy (cube 0.7 % vs slab +8 %), the reason the mass-to-volume ratio is below additivity, and any Formlabs statement of the resin version behind the cube-table row 'Flexible 80A Resin'.",
 "The 'scale accuracy 0.001 mg' in Krueger et al. is probably a typo for 0.001 g; I could not check with the authors.",
 "Headroom: free C: was 452 MB (<1 GB) during this run, so no heavy local command was run; everything stayed on D: (26 MB of downloads) with light scripts.",
]

r["scripts_written"] = [
 S + "calc.py", S + "sens_n.py", S + "pdf_rows.py", S + "astm_scope.py", S + "crossref_check.py",
 S + "crossref_search.py", S + "crossref_abs.py", S + "make_manifest.py", S + "build_result.py",
]

out = "D:/Users/ashenoy00000/delphi-work/agents2/bm-testing-metrology.json"
json.dump(r, open(out, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wrote", out, os.path.getsize(out), "bytes;", len(F), "findings")
