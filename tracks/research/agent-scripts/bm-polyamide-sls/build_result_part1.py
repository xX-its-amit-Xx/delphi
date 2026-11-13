# Part 1 of the result builder: findings. Imported by build_result.py
F = []


def add(claim, source, confidence, value="", quote=""):
    d = {"claim": claim, "source": source, "confidence": confidence}
    if value:
        d["value"] = value
    if quote:
        d["evidence_quote"] = quote
    F.append(d)


# ---- sorption equilibria ----
add("Laser-sintered PA12 (EOS PA 2200 data sheet) takes up 0.52 wt% water at 23 C / 50 % RH, 1.33 wt% at 23 C / 96 % RH and 1.93 wt% when saturated in water at 100 C (DIN 53495 / ISO 62). This is a three-point sorption isotherm for a sintered part. The PDF text layer splits the labels from the numbers; the order of conditions and values is the order printed (monotonic).",
    "https://www.sculpteo.com/media/imagecontent/PA2200_Product_information_03-10_en.pdf ; https://www.amf.uzh.ch/dam/jcr:59a8b14a-c212-4693-8443-d5e543aeabe2/Material-Data-PA2200-ENGLISH.pdf",
    "high", "0.52 % (50 % RH); 1.33 % (96 % RH); 1.93 % (water, 100 C)",
    "Water absorption 100°C, saturation in water 1,93 | 23°C, 96% RF 1,33 | 23°C, 50% RF 0,52 (pdftotext of EOS 2007/2010 product information; labels and numbers in separate columns)")
add("Dense moulded PA12 (Arkema Rilsamid AESNO MED) absorbs 1.6 % water at equilibrium by immersion at 23 C (ISO 62); density 1.01 g/cm3; tensile modulus 1500 MPa dry (DAM) and 1440 MPa conditioned, i.e. -4 % (conditioning protocol not stated in the sheet).",
    "https://hpp.arkema.com/assets/arkema/TDS_RILSAMID%C2%AE%20AESNO%20MED_en_WW.pdf",
    "high", "1.6 % immersion; 1.01 g/cm3; E 1500 -> 1440 MPa",
    "Tensile modulus, 23°C (73°F) 1500 / 1440 MPa ISO 527-1/-2 ... Water absorption, at equilibrium at 23°C (73°F) / Immersion 1.6 % ISO 62 ... * DRY / COND")
add("Dense moulded PA11 (Arkema Rilsan BMNO TLD) absorbs 0.8 % at 23 C / 50 % RH and 1.9 % by immersion at equilibrium (ISO 62); density 1.03 g/cm3; conditioned tensile modulus 1250 MPa (dry value not given).",
    "https://hpp.arkema.com/assets/arkema/TDS_RILSAN%C2%AE%20BMNO%20TLD_en_WW.pdf",
    "high", "0.8 % (50 % RH); 1.9 % immersion",
    "Water absorption, at equilibrium at 23°C (73°F) / 50%RH 0.8 % ISO 62 ... Water absorption, at equilibrium at 23°C (73°F) / Immersion 1.9 % ISO 62")
add("Hot-pressed PA11 and PA12 sheets (20 x 20 x 4 mm) reached the same saturation after about two months: 1.5 wt% in water and 0.8 wt% at 50 % RH. The authors report no dimension change (qualitative, no number).",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC8537549/ (doi 10.3390/polym13203553)",
    "high", "1.5 % water; 0.8 % at 50 % RH; l = 4 mm; ~2 months to saturation",
    "After around two months, both PAs had the same saturation level for water and moisture absorption, i.e., 1.5% and 0.8%, respectively.")
add("Protolabs PA12 laser-sintered (supplier data attributed to EOS PA 2200 Balance): 0.5 +/- 0.2 % water at 20 C / 50 % RH and 2.0 +/- 0.3 % after 24 h in boiling water, DIN EN ISO 62.",
    "https://protolabs.com/media/ytzjjomn/pa12-vapour-smooth-white-en-24_10.pdf", "high",
    "0.5 +/- 0.2 % (50 % RH); 2.0 +/- 0.3 % (boiling 24 h)",
    "Water absorption, 20 °C, 50% Relative Humidity DIN EN ISO 62 0.5 ± 0.2% Water absorption, 24 hrs. in boiling water 2.0 ± 0.3%")
add("Formlabs printed-part water absorption (ASTM D570, immersion time not stated): Nylon 12 Powder 0.66 %, Nylon 11 Powder 0.07 % (2021 TDS), TPU 90A Powder 0.89 %. Parts were conditioned at 50 % RH and 23 C for 7 days before tests. Nylon 12 tensile modulus 1850 MPa. I could not re-fetch the 0.4 % Nylon 11 figure the earlier agent saw on the current product page, so the two-value disagreement is neither confirmed nor refuted here; the 0.07 % in the 2021 TDS is confirmed.",
    "https://media.formlabs.com/m/2a02034348060e54/original/-ENUS-Nylon-12-TDS.pdf ; https://media.formlabs.com/m/151bd67a83b2334f/original/-ENUS-Nylon-11-TDS.pdf ; https://epfl.ch/schools/sti/ateliers/wp-content/uploads/2024/09/TPU_90A-SLS-EN.pdf",
    "high", "N12 0.66 %; N11 0.07 %; TPU 0.89 %",
    "Water Absorption (printed part) 0.66% 0.66% ASTM D570 (Nylon 12); Water Absorption (printed part) 0.07% ASTM D570 (Nylon 11); Water Absorption (Printed Part) 0.89% ASTM D570 (TPU 90A)")

# ---- diffusion ----
add("Measured bulk water diffusivity of injection-moulded PA11 at 23 C by immersion: D = 4.95e-13 m2/s (= 1.78e-3 mm2/h), equilibrium uptake 1.43 %; at 40 C D = 22.0e-13 m2/s and uptake 1.58 %. D from the initial-slope Fick formula; the sample thickness L is the ASTM D638 Type I tensile bar (3.2 mm in the standard, not stated in the extracted text: unverified background).",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC6404017/ (Table 3; doi 10.3390/polym10070717)", "medium-high",
    "D(23 C)=4.95e-13 m2/s; D(40 C)=22.0e-13 m2/s; Minf 1.43 % / 1.58 %",
    "D (10−13 m2·s−1) column: 23 0 1.43 ± 0.02 0.305 ± 0.045 0.088 ± 0.023 4.95 ± 0.02 | 40 0 1.58 ± 0.03 0.272 ± 0.007 0.155 ± 0.007 22.00 ± 1.65")
add("No primary measured water diffusivity for PA12 at 23 C was found in open sources. Two own bounds from published kinetics: (a) Grilamid L25 injection-moulded bars took up 0.91 % in 40 days at 23 C; if the full extra capacity above the ambient state is 1.6 % (Arkema saturation) D = 3.0e-13 m2/s, if only 1.0 % D = 1.0e-12, and if the 0.91 % were itself saturation D >= 4.2e-12 (thickness 4 mm assumed from ISO 527-2 1A, cross-section ~40 mm2); (b) Bahrami's 4 mm hot-pressed PA12/PA11 sheets saturated in about 2 months, giving D = 6.5e-13 (90 %) to 1.4e-12 m2/s (99 %). A secondary aggregator page quotes 1-3e-13 m2/s for nylon 12 (unverified, no primary source). Working range for PA12: 3e-13 to 1.4e-12 m2/s, central about 5e-13 (the measured PA11 value).",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/calc.py (output D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-polyamide-sls/calc_stdout.txt); inputs https://pmc.ncbi.nlm.nih.gov/articles/PMC8549196/ and https://pmc.ncbi.nlm.nih.gov/articles/PMC8537549/",
    "low-medium", "3e-13 to 1.4e-12 m2/s (own calculation)",
    "The water uptake of the specimens immersed in water was around 0.91% (interquartile range (IQR) = 0.15).")
add("Laser-sintered PA12 immersed in water reaches saturation in 2 days at 10.49 % weight gain with a diffusion coefficient one order of magnitude greater than the base material, which the authors attribute to porosity. The number itself is not in the abstract (paywalled); I used 10 x the PA11 value (5e-12 m2/s) only as an optimistic bound.",
    "https://link.springer.com/article/10.1007/s40964-024-00826-3", "medium",
    "10.49 % at saturation; t_sat ~ 2 d; D ~ 10 x base",
    "Water absorption reaches saturation after 2 days of immersion with a weight variation of around 10.49% and a resulting diffusion coefficient one order of magnitude greater than the value of the base material, due to the porosity of the samples.")
add("TPU diffusivity (FDM filament TPUs 60A-98A, 2 mm plates, 0.9 % NaCl, 22 C): D from 1.40e-13 to 3.40e-12 m2/s from the 1-6 h initial slope; 96 h uptake 1.18-1.80 %; volume change after 96 h from about 0.6 % (92A) to about 8 % (89A) with no correlation to uptake. This is FDM material in saline, not SLS TPU in humid air.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC13258891/ (doi 10.3390/polym18111392)", "medium",
    "D 1.4e-13 to 3.4e-12 m2/s; uptake 1.18-1.80 %; dV 0.6-8 %",
    "Diffusion coefficients ranged from 1.40 × 10−13 to 3.40 × 10−12 m2 s−1, with no monotonic dependence on hardness.")

# ---- TPU isotherm ----
add("Sorption isotherm of a polyether TPU (Lubrizol Estane 58887, Shore 87A, 1 mm hot-pressed strips), equilibrium water mass fraction versus RH: 0.25 wt% at 20 % RH, 0.53 at 40 %, 0.91 at 60 %, 1.35 at 80 %. Values are quoted from the DVS study of Pichler et al. (Polymer Testing 2023) as tabulated in the follow-up open paper; I could not read the original (publisher 403). Slope through origin 0.0157 wt% per %RH, slightly convex.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC10534667/ (Table 1; doi 10.3390/polym15183770); original doi 10.1016/j.polymertesting.2023.107962 (Crossref-verified, content not read)",
    "medium", "0.25/0.53/0.91/1.35 wt% at 20/40/60/80 % RH",
    "Sample Enclosing Humidity h (%) Water Content (–) 0 0 20 0.0025 40 0.0053 60 0.0091 80 0.0135")
add("Formlabs TPU 90A Powder publishes no tensile modulus; stress at 50 % elongation is 6.1 MPa (X/Y) and at 100 % 7.2 MPa, so the secant modulus is 12.2 MPa at 50 % strain (own calculation 6.1/0.5), about 150 times softer than Nylon 12 (1850 MPa). No wet/dry modulus for any TPU was found.",
    "https://epfl.ch/schools/sti/ateliers/wp-content/uploads/2024/09/TPU_90A-SLS-EN.pdf", "high (data) / low (small-strain modulus)",
    "secant 12.2 MPa at 50 % strain",
    "Stress @ 50% Elongation (X/Y) 6.1 MPa 889 PSI ASTM D412-16, Method A")

# ---- pore filling ----
add("EOS gives the density of sintered PA2200 parts as 0.90-0.95 g/cm3; dense PA12 is 1.01 g/cm3 (Arkema). The void volume fraction is therefore 6-11 %, and if every void filled with water the part would gain 6.3-12.1 % mass on top of about 1.6 % held in the polymer (total 7.9-13.7 %). Villani's 10.49 % equals complete void filling at density 0.93 (own calc: 8.5 % + 1.6 % = 10.1 %); Zheng's 5.47 % corresponds to about 3.6 % of the volume filled (own calc). So the measured immersion uptakes of sintered PA12 are mostly pore-filling water.",
    "own calculation D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/calc.py ; inputs https://www.amf.uzh.ch/dam/jcr:59a8b14a-c212-4693-8443-d5e543aeabe2/Material-Data-PA2200-ENGLISH.pdf (density) and the Arkema Rilsamid sheet",
    "medium", "void 5.9-10.9 %; capacity 7.9-13.7 % mass",
    "Density g/cm3 0,90 – 0,95 (EOS PA 2200 sintered parts)")
add("Zheng 2022: SLS PA12 cylinders 8 x 8 mm in distilled water at room temperature saturate at 5.47 % (CF/PA12 4.6 %), reached after roughly 36 h of fast uptake. Filling the same powder family with carbon fibre cut saturation uptake only by about 16 % (4.6/5.47).",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC9320715/ (doi 10.3390/mi13071041)", "high",
    "5.47 % PA12; 4.6 % CF/PA12",
    "Δm of PA12 sample increases sharply in the first 36 h as the samples were immersed into water. With further prolonged immersed time, the Δm increases slowly and reaches a saturation state with Δm of 5.47%.")
add("Closed porosity of laser-sintered PA12 sheets measured by micro-CT is only 0.31-1.04 %, and all sheets except the thinnest quenched 2-layer one (4 to 8 layers of 100 um, and the standard 2-layer sheet) show solution-diffusion transport of O2 and He as in a dense coherent polymer, with no flow through continuous pores. Earlier work by the same group found water-vapour permeation coefficients of 700-2000 um LS sheets in the range of extruded PA12 film. So in sintered strips of the thickness of interest the vapour path is through polymer, not through open channels.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC7921953/ (doi 10.3390/polym13040603); doi 10.1108/rpj-05-2020-0101", "high (O2/He, porosity) / medium (water vapour, abstract-level)",
    "porosity 0.31-1.04 %",
    "Despite the porous material structure, even the thinnest LS sheets investigated showed a solution–diffusion behavior as typically observed for a dense, coherent polymeric material.")
add("Capillary condensation argument (own calculation, Kelvin equation, 25 C, perfect wetting): the largest pore that can fill from vapour is 1.5 nm at 50 % RH, 4.7 nm at 80 %, 26 nm at 96 % and 104 nm at 99 %. Sintered voids are micrometres to tens of micrometres (the CT detection limit alone is a 1.9e-7 mm3 pore, an equivalent-sphere radius of 3.6 um, own arithmetic), so they cannot fill from humid air; they fill only on liquid contact. This agrees with the EOS 96 % RH value (1.33 %) being close to dense polymer values and far below the 5-10 % seen on immersion.",
    "own calculation D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/calc.py", "medium (theory; no direct vapour-vs-liquid test on one sintered part found)",
    "r_K = 1.046 nm / ln(1/RH)")

# ---- mechanical ----
add("Injection-moulded PA12 (Grilamid L25, ISO 527-2 type 1A bars) at 23 C: Young's modulus 1553 MPa when stored at ambient 23 C / 50 % RH ('dry') and 882 MPa after 40 days in water (uptake 0.91 % over the ambient mass), i.e. -43 % at 50 mm/min and -52 % at 1 mm/min (1506 -> 728 MPa). The loss shrinks with temperature (-3 % at 100 C). This is a far bigger water softening than Arkema's -4 % dry-to-conditioned or Zheng's 'negligible'.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC8549196/ (doi 10.1186/s12938-021-00947-8, Table 2 and Table 5)", "high (as reported); cause of the difference from other sources not resolved",
    "E 1553.5 -> 882.0 MPa (50 mm/min); 1506.5 -> 728.0 (1 mm/min)",
    "23 Dry 1506.5 (51.4) 1553.5 (233.1) 45.5 (0.4) ... Cond 728.0 (161.3) 882.0 (341.5) 36.2 (0.4)")
add("Three disagreeing sources on PA12 wet/dry modulus, reported side by side: Arkema dense PA12 1500 -> 1440 MPa (-4 %); Zheng sintered PA12 'negligible' modulus change but -15 % compressive yield strength; Villani sintered PA12 about 1 -> 0.8 GPa after only 2 h in water, yield 20 -> 14 MPa; Amstutz moulded PA12 -43 to -52 %. Differences in grade, conditioning, test mode and what 'dry' means are not resolved by these papers.",
    "Arkema TDS; https://pmc.ncbi.nlm.nih.gov/articles/PMC9320715/ ; https://link.springer.com/article/10.1007/s40964-024-00826-3 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC8549196/", "medium",
    "-4 %, ~0 %, -20 %, -43 to -52 %",
    "It is found that in the elastic deformation stage, the influence of water immersion on the elasticity modulus is negligible. (Zheng 2022)")
add("Sintered PA 2200 (EOS) exposed to weathering and 100 % humid atmosphere for 28 days had its lowest flexural strength and modulus after the 28-day water-absorption step; tensile modulus fell from 1.7 to 1.1 GPa under the different weathering conditions (UV, humidity, ageing mixed together).",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC9227374/ (doi 10.3390/polym14122355)", "medium",
    "1.7 -> 1.1 GPa (mixed weathering)",
    "The tensile modulus under the influence of different weathering conditions was reduced from the initial 1.7 GPa to 1.1 GPa")

# ---- expansion ----
add("No peer-reviewed measured coefficient of hygroscopic (moisture) expansion was found for PA11, PA12, sintered PA12 or TPU. What exists: SLS nylon-12 parts change size with ambient RH, mostly in the directions parallel to the sintered layers, with high correlation to RH (Park 2016); humidity changes can violate dimensional specs (Kwon 2017); neither abstract gives a number.",
    "https://pure.skku.edu/en/publications/hygroscopic-swelling-behavior-of-3d-printed-parts-due-to-changes-/ ; https://link.springer.com/article/10.1007/s12541-017-0150-0", "high",
    "no coefficient published in abstracts",
    "The results showed that the deformation was mostly occurred to the dimensions parallel to the sintering layers. Also, changes in these dimensions were found to have a high correlation with the relative humidity regardless of temperature conditions.")
add("One vendor page for cast PA12 states that a maximum absorption of 1.4 % corresponds to a dimensional change of 0.2 %, i.e. about 0.14 % linear strain per wt% water (own division); the same page gives PA6 9 % -> 2 % and PA6.6 7 % -> 3.5 %. This is a vendor statement without method, the only PA12 number I found.",
    "https://www.intechpower.com/material-information/effects-of-moisture-absorption", "low",
    "0.2 % / 1.4 % = 0.143 %/wt%",
    "PowerCore, with a maximum absorption of 1.4%, has a corresponding dimensional change of 0.2%.")
add("Water saturation can shrink rather than swell polyamide pipes: PA11/PA12/PA6.12 pipe segments saturated in water at 80 C lost 1.1-4.3 % volume with 8-19 % higher melting enthalpy (recrystallisation), at maximum water contents of 1.5-2.4 wt%. Warm water exposure therefore confounds a swelling measurement with crystallinity change.",
    "https://www.kiwa.com/495f61/globalassets/netherlands/kiwa-technology/downloads/scholten_kiwa_paper_polyamide_pipes_vancouver_2010.pdf (conference paper, no DOI)", "medium",
    "dV -1.1 to -4.3 %",
    "Table 3 confirms that volume reduction and density increase of the PA pipe segments noted before [1] is explained by an increase in crystallinity of the PA pipes that were water-saturated at 80 °C.")
