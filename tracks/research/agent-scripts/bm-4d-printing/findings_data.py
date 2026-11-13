# -*- coding: utf-8 -*-
"""Findings for bm-4d-printing-review. Each: claim, source (URL), confidence, value, evidence_quote, file (local text copy under
D:/Users/ashenoy00000/delphi-work/data/bm-4d-printing/ used to verify the quote). build_result.py checks every quote against its file."""

PMC = "https://pmc.ncbi.nlm.nih.gov/articles/"
F = []
def add(claim, source, conf, value, quote, file):
    F.append(dict(claim=claim, source=source, confidence=conf, value=value, evidence_quote=quote, file=file))

# ---------- A. Shape-memory polymers (thermal, multimaterial) ----------
add("SMP 4D printing (multimaterial, PolyJet-type photopolymer jetting): SMPs are stiffer and faster than hydrogels, response in seconds to minutes depending on actuation temperature.",
    PMC + "PMC4976324/", "high", "response = seconds to minutes; E = MPa to GPa",
    "faster response rates (in the scale of seconds to minutes depending on actuation temperature)", "PMC4976324.txt")
add("Tunable methacrylate SMP networks span rubbery modulus up to about 100 MPa, glass transition about -50 to 180 C and failure strain up to about 300 percent (Ge 2016).",
    PMC + "PMC4976324/", "high", "E_rubbery=~MPa-~100 MPa; Tg=-50..180 C; failure strain<=~300%",
    "rubbery modulus (from ∼MPa to ∼100 MPa), glass transition temperature (from ∼−50 °C to ∼180 °C), and the failure strain (up to ∼300%)", "PMC4976324.txt")
add("Direct-4D-printed SMP/elastomer bilayer (Ding 2017): glassy SMP about 1 GPa laminated to elastomer about 1 MPa; samples complete the shape change in about 20 s in hot water; this is a programmed bilayer (curvature set by built-in compressive strain), one-way but reprogrammable.",
    PMC + "PMC5389747/", "high", "E_SMP=~1 GPa; E_elastomer=~1 MPa; t=~20 s at 62 C; layer 30 um; bilayer 60x5x(0.3-1.2) mm",
    "At room temperature, the SMP is glassy with a modulus of ~1 GPa, which is two to three orders of magnitude stiffer than the elastomer ( E ~ 1 MPa)", "PMC5389747.txt")
add("Ding 2017 timing: the bilayers finished transforming about 20 s after immersion at the set temperature.",
    PMC + "PMC5389747/", "high", "t_transform=~20 s", "After ~20 s, the samples had completed the transformation", "PMC5389747.txt")
add("Review-level SMP recovery times: about 35 s (magnetic), 75 s (electric current), 160 s (light) for printed SMP composites. Secondary source, not re-checked against the primary papers.",
    PMC + "PMC13608067/", "medium", "t_recovery=35 s (magnetic), 75 s (electric), 160 s (light)",
    "The printed snowflake model demonstrated rapid shape recovery from a temporary form to the original shape within 35 s under a magnetic field.", "PMC13608067.txt")
add("Vat-photopolymer (DLP, 405 nm) two-stage LCE (Jiang 2026): programmed at 80 percent strain, reversible actuation strain close to that target for the best formulations, 11 cycles without degradation, saturation after more than 30 min at 80 C (DMA, 1 C/min). Thermal stimulus, not humidity.",
    PMC + "PMC12910083/", "high", "programming strain=80%; cycles shown=11; saturation >30 min at 80 C",
    "AE_3–AE_18 samples achieved actuation strains close to the target programming strain.", "PMC12910083.txt")
add("Same LCE paper: sample AE_18 repeated 11 consecutive cycles without noticeable degradation.",
    PMC + "PMC12910083/", "high", "n_cycles=11", "AE_18 was subjected to 11 consecutive cycles and exhibited consistent strain evolution without noticeable degradation", "PMC12910083.txt")
add("Review table of printed LCE filaments (representative literature values): actuation strain 28 to 110 percent, stress 0.15 to 0.55 MPa, cycles to 50 percent decay 100 to more than 1000. Secondary table whose references were not checked.",
    PMC + "PMC13435120/", "low", "strain=28-110%; stress=0.15-0.55 MPa; cycles_to_50%_decay=100->1000",
    "RM82‐TATATO 42 ± 3 0.35 >1000", "PMC13435120.txt")

# ---------- B. Hydrogels ----------
add("Hydrogel actuators are slow because they rely on diffusion of water (review, Chau and Amstad 2026).",
    PMC + "PMC13463021/", "high", "qualitative",
    "Untethered soft actuators typically are slow because they rely on the diffusion of water.", "PMC13463021.txt")
add("Hydrogel actuator force: swelling and contraction forces for most hydrogel actuators are below 1 N, although the osmotic pressure can reach megapascals.",
    PMC + "PMC13463021/", "high", "F<1 N", "the swelling and contraction forces for most hydrogel actuators are less than 1 N", "PMC13463021.txt")
add("Table in the same review: typical hydrogel actuators give about 2 kPa actuation (blocking) stress against 100 to 350 kPa for mammalian skeletal muscle; toughness 1-10 kJ/m3 for typical hydrogels.",
    PMC + "PMC13463021/", "medium", "sigma_block=2 kPa (hydrogel) vs 100-350 kPa (muscle); toughness=1-10 kJ/m3",
    "Actuation stress ( i.e. blocking stress) 2 kPa — 100–350 kPa", "PMC13463021.txt")
add("Vat-photopolymerised GelMA (Guida 2026): per-layer exposure time sets crosslink density and therefore swelling: 30 s exposure gives the highest linear swelling, 7.7 percent, 70 s only 1 percent (24 h, DMEM, 37 C).",
    PMC + "PMC13205297/", "high", "LS=7.7% (30 s) vs 1% (70 s) at 24 h; E_swollen=14.5-20.2 kPa",
    "the sample printed with a 30 s exposure exhibited the highest swelling ratio at 7.7%, whereas the sample printed with a 70 s exposure showed only 1% linear expansion", "PMC13205297.txt")
add("Guida 2026 bilayers (20 x 2 x 1 mm, 65 s lower layer and 35 s upper layer, thickness split varied in 100 um steps) bent to radii of curvature of 11 to 20 mm after 24 h in culture medium; Figure 5a with the per-geometry values could not be read.",
    PMC + "PMC13205297/", "high", "R=11-20 mm; h=1 mm; t=24 h",
    "enabling controlled bending of the printed structures upon immersion in aqueous media, with radii of curvature between 11 and 20 mm depending on the geometry.", "PMC13205297.txt")
add("Guida 2026 modelled the bilayer by finite elements using a thermal-expansion analogy (swelling strain entered as expansion coefficient); the paper does not use or cite Timoshenko's formula (0 occurrences of 'Timoshenko' in the full text).",
    PMC + "PMC13205297/", "high", "FEM, no Timoshenko",
    "Swelling-induced deformation was simulated through thermal expansion, by assigning the experimentally determined linear swelling ratios as the materials’ coefficients of thermal expansion.", "PMC13205297.txt")
add("Guida 2026 table of swollen GelMA after 24 h, by exposure time: E (kPa) and linear swelling LS (percent): 30 s 14.48 / 7.83; 40 s 15.30 / 7.11; 50 s 17.07 / 5.52; 60 s 18.64 / 2.02; 70 s 20.23 / 0.70.",
    PMC + "PMC13205297/", "high", "see claim", "30 14.48 70.43 7.83 10.34 5.81 43.9 40 15.30 72.48 7.11 10.34 6.10 45.6 50 17.07 76.11 5.52", "PMC13205297.txt")
add("Anisotropic-fibre patterned hydrogel (Gladman 2016): composite hydrogel with cellulose-fibril alignment along printed paths, shape change on immersion in water. Swelling strains, curvatures and times are in the paywalled full text and were NOT read.",
    "https://www.nature.com/articles/nmat4544", "high (abstract) / not read (numbers)", "numbers not read",
    "we printed composite hydrogel architectures that are encoded with localized, anisotropic swelling behaviour controlled by the alignment of cellulose fibrils along prescribed four-dimensional printing pathways.", "nmat4544_page.txt")

# ---------- C. Vat-photopolymer humidity actuator (contradicts earlier gap) ----------
add("A humidity-driven vat-photopolymer actuator DOES exist in the literature: Goodarzi Hosseinabadi et al. (Small 2024) printed a PEG-polyurethane diacrylate ink by SLA (400 nm, 2 mW/cm2) and by a custom DLP printer (380 nm, 700 mW/cm2); films fold in humid air. This contradicts spec-hygromorph-4d, which listed 'any SLA/DLP bilayer actuated by ambient relative humidity' as not found.",
    PMC + "PMC10922657/", "high", "printer: SLA 400 nm 2 mW/cm2; custom DLP 380 nm 700 mW/cm2",
    "a custom-built DLP printer which allowed ink printing at a very high intensity light (700 mW/cm 2 at 380 nm wavelength)", "PMC10922657.txt")
add("Small 2024 film response to skin humidity: folds in under 1 s, reversibly, 'apparently unlimited' cycles claimed (not counted).",
    PMC + "PMC10922657/", "high", "t_fold<1 s", "Like a cantilever beam, the film rapidly initiated folding in less than 1s.", "PMC10922657.txt")
add("Small 2024 thickness scaling: a 50 um film folded over 5 times faster than a film of about 150 um (3x thinner gives over 5x faster, i.e. between linear (3x) and diffusive quadratic (9x) scaling; the authors fitted no exponent).",
    PMC + "PMC10922657/", "high", "t(150 um)/t(50 um)>5", "A film having 50 μm thickness folded over 5 times faster compared to a film of around 150 μm thickness", "PMC10922657.txt")
add("Small 2024 force: a 6 x 18 x 0.1 mm film carried about 50 mg (5 times its own weight) in humid air at RH about 90 percent.",
    PMC + "PMC10922657/", "high", "load=50 mg (5x film weight); film 6x18x0.1 mm; RH~90%", "The gripper could load an object (about 50 mg, 5 times the film weight)", "PMC10922657.txt")
add("Small 2024 material: the PEG-PU network swells to a degree of about 600 percent in water, far beyond any stock Formlabs resin; swelling falls with longer exposure per layer. It is not a Formlabs resin, and no curvature numbers or Timoshenko analysis were found in the text.",
    PMC + "PMC10922657/", "high", "swelling degree ~600% (water)", "swollen in MilliQ water with a swelling degree of approximately 600%", "PMC10922657.txt")

# ---------- D. Hygroscopic wood, cellulose-filled filament, bilayers ----------
add("Cellulose-filled FFF bilayers (Cheng 2024, livMatS): full transformation between 30 and 90 percent RH within 30 min.",
    PMC + "PMC11604995/", "high", "t=30 min (30<->90% RH)", "The bilayers reach a full transformation between two RH extremes of 30% and 90% within 30 minutes", "PMC11604995.txt")
add("Cheng 2024: at 80 percent RH all bilayers had mean curvature 0.0155 mm^-1 (radius 64.5 mm, own arithmetic 1/0.0155).",
    PMC + "PMC11604995/", "high", "kappa=0.0155 mm^-1; R=64.5 mm", "At 80% RH, all bilayers are observed with an average curvature of 0.0155 mm −1", "PMC11604995.txt")
add("Cheng 2024 reversibility: 170 humidity cycles, consistent curvature at 30 percent RH.",
    PMC + "PMC11604995/", "high", "n_cycles=170", "For all 170 tested actuation cycles, the bilayers display consistent curvatures at the low RH of 30%.", "PMC11604995.txt")
add("Cheng 2024 does not use Timoshenko's formula anywhere in its text (0 occurrences); Tahouni 2023 mentions the modified Timoshenko model only as future work (1 occurrence).",
    PMC + "PMC9963502/", "high", "Timoshenko hits: Cheng 2024 = 0; Tahouni 2023 = 1",
    "the modified Timoshenko model 5 , 38 can be utilized to explore other bilayer layups", "PMC9963502.txt")
add("Wood bilayers (Rueggeberg and Burgert 2015): moisture content falls from about 18 to about 10 percent in 24 h; confirms earlier agent.",
    PMC + "PMC4383548/", "high", "dMC=~8 points in 24 h", "A decrease of the wood moisture content from around 18% to around 10% within 24 hours was observed", "PMC4383548.txt")
add("Same paper: curvature up to 8.7e-3 mm^-1 for passive spruce up to 1 mm, and 1.5e-3 mm^-1 for 4 mm spruce after 24 h.",
    PMC + "PMC4383548/", "high", "kappa=8.7e-3 and 1.5e-3 mm^-1 at 24 h", "curvatures up to 8.7*10 -3 mm -1 were reached, whereas bilayers with a spruce layer of 4mm thickness reached a curvature of 1.5*10 -3 mm -1 after 24 hours only.", "PMC4383548.txt")
add("Thick mass-timber bilayers (Groenquist 2019, 15-45 mm): moisture equilibrates after about 400 h; the 45 mm series had not equilibrated after 900 h. Across this and the other wood/FFF sources the response time climbs steeply with thickness (30 min sub-mm FFF, 24 h at 4-8 mm, about 400 h at 15-30 mm); no exponent is claimed because materials and end-point criteria differ.",
    PMC + "PMC6744262/", "high", "t_eq=~400 h (15-30 mm); >900 h (45 mm)", "WMCs were approximately equilibrated after 400 hours in the dry target climate, except for the bilayer series with a thickness of 45 mm, for which an equilibration is not visible after 900 hours.", "PMC6744262.txt")
add("Material-jetting bilayers (Raviv 2014, Stratasys): hydrophilic UV-curable polymer absorbs water to up to 200 percent of its original volume.",
    PMC + "PMC4270353/", "high", "dV/V=up to 200%", "creates a hydrogel with up to 200% of the original volume", "PMC4270353.txt")
add("Fused-filament bilayers have a published Timoshenko comparison: Krueger 2021 adapts Timoshenko's model for unequal effective widths and validates it on a 4D-printed bilayer system.",
    PMC + "PMC8544213/", "high", "published Timoshenko comparison exists for FFF",
    "Timoshenko’s model [ 23 ] is adapted to account for unequal effective widths of the active and passive layer.", "PMC8544213.txt")
add("A 2026 FFF hygromorph with Timoshenko-based prediction (Marom, Tibbits, Zardini, Buehler, arXiv 2604.26367): PA6-GF active / PA612-CF passive bilayer; baseline hygroscopic bending predicted 36.4 deg vs measured 35.3 +/- 3.1 deg (3.0 percent error, n=3); all four cases within one standard deviation.",
    "https://arxiv.org/abs/2604.26367", "high (preprint, n=3)", "pred 36.4 deg; meas 35.3+/-3.1 deg; err 3.0%",
    "All four predictions agree with the measured mean to within one standard deviation.", "arxiv_2604.26367.txt")
add("The same preprint calls its pipeline 'verified' in a category-theoretic and type-level sense; its full text contains no mention of Lean, Coq, Isabelle, 'proof assistant', 'machine-check' or 'kernel' (my count: 0 each), so it is NOT a machine-checked law in the project's sense.",
    "https://arxiv.org/abs/2604.26367", "high", "counts of Lean/Coq/Isabelle/proof assistant/kernel = 0",
    "Here we present a category theoretic compositional framework for verified nature-derived design.", "arxiv_2604.26367.txt")
add("The preprint's Timoshenko step: the Timoshenko bilayer formula gives the curvature from the geometric coefficient times the strain mismatch; it is applied inside the category-theoretic pipeline.",
    "https://arxiv.org/abs/2604.26367", "high", "uses Timoshenko coefficient",
    "the Timoshenko bilayer formula [ 33 ] gives the intrinsic curvature as", "arxiv_2604.26367.txt")

# ---------- E. Formlabs materials: confirm / contradict ----------
add("CONFIRMED: Formlabs solvent page 24 h 1 cm cube: Elastic 50A Resin V2 takes up 39.2 percent isopropyl alcohol; Rigid 10K under 0.1 percent; water 0.7 percent for Elastic 50A V2 and under 0.1 percent for Rigid 10K. Columns: IPA is the 10th data column, water the 18th.",
    "https://formlabs.com/support/solvent-compatibility/", "high", "IPA: 39.2% vs <0.1%; water: 0.7% vs <0.1%",
    "Elastic 50A Resin V2 1.5 43.4 0.6 133.1 7.9 31.4 3.9 0.9 15.6 39.2 0.4 0.7 0.6 41.2 0.7 45.6 43.6 0.7 163.9", "formlabs_solvent_rows.txt")
add("Same page, Rigid 10K row.",
    "https://formlabs.com/support/solvent-compatibility/", "high", "all columns <=0.6%", "Rigid 10K Resin <0.1 <0.1 0.1 0.1 0.1 0.4 0.2 <0.1 0 <0.1 <0.1 0.2 0.1 0.6 0.1 0.2 0.4 <0.1 <0.1", "formlabs_solvent_rows.txt")
add("CONTRADICTION (method-dependent): the claim 'stock Formlabs resins gain under 1 percent in 24 h in water' holds on the 1 cm cube table but NOT for Flexible 80A Resin V2 on its datasheet: ASTM D471 slab, deionized water, 1 day: +8 percent mass, +3 percent volume, -26 Shore A points; 1 week: +9 percent mass, +7 percent volume. I read the page as an image to resolve a garbled text layer. The older Flexible 80A (V1) cube row gives 0.7 percent.",
    "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf", "high", "water 1 day: dm=+8%, dV=+3%, dHardness=-26; 1 week: +9%, +7%, -27",
    "1 day -26 +8% +3% 94% 89%", "f80av2_rows.txt")
add("Flexible 80A V2 1-week row.",
    "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf", "high", "+9% mass, +7% volume at 1 week", "1 week -27 +9% +7% 101% 88%", "f80av2_rows.txt")
add("Flexible 80A Resin (V1) cube row on the solvent page: water 0.7 percent, IPA 11.7 percent. So the 'under 1 percent' statement of the earlier agent is true for V1 and for the cube method, not for V2 under D471.",
    "https://formlabs.com/support/solvent-compatibility/", "high", "V1 cube: water 0.7%, IPA 11.7%", "Flexible 80A Resin 0.9 37.4 0.6 51.4 2.3 19.3 1 0.7 1.6 11.7 <0.1 0.1 0.5 10.7 0.6 28.6 13.6 0.7 64.1", "formlabs_solvent_rows.txt")
add("Flexible 80A V2 mass gain (8 percent) exceeds what the volume gain (3 percent) allows for water (water volume would be about 8 x 1.09 = 8.7 percent of the part volume by my arithmetic using the TDS density 1.09 g/cm3 from the earlier agent file), so the two numbers are not mutually consistent as swelling; extraction, porosity or the wipe-dry step may play a role. Flagged, not resolved.",
    "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf", "low", "own arithmetic 0.08*1.09=0.087", "", "f80av2_rows.txt")
add("Third-party measurement on a Formlabs resin: Dental LT Clear V2 printed on a Form 3B+ (low force stereolithography) took up 29.53 ug/mm3 of water in one week, the highest of the printed aligner resins tested.",
    PMC + "PMC13637378/", "high", "water sorption 1 week=29.53 ug/mm3 (mean)", "Dental LT Clear V2 displayed the highest sorption (mean 29.53 µg/mm³)", "PMC13637378.txt")
add("Same study confirms the printer and resin: 'Dental LT Clear V2 (LT) (Formlabs Inc., Somerville, MA, USA) Form 3B+'.",
    PMC + "PMC13637378/", "high", "Form 3B+ / LFS", "Dental LT Clear V2 (LT) (Formlabs Inc., Somerville, MA, USA) Form 3B+ (Formlabs Inc., Somerville, MA, USA) Low force stereolithography (LFS)", "PMC13637378.txt")
add("My conversion: 29.53 ug/mm3 = 29.53 mg/cm3 = 0.02953 g water per cm3; if the resin density were 1.1 g/cm3 (assumed, not stated in the source) that is about 2.7 percent by mass, and an upper bound of about 1.0 percent isotropic linear strain if water volume simply adds (1.02953^(1/3)-1). So a Formlabs-printed resin takes up about 3 percent water in a week, three to four times the 24 h cube figures for the stock resins, consistent with the earlier agent's Grey V5 week figure (3.2 percent).",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-4d-printing/calc.py", "medium", "mass gain ~2.7% (assumed rho=1.1); linear strain <=~1.0%", "", "")

# ---------- F. Own calculations ----------
add("Own check of the project's ceiling: a log-grid scan of f(m,n)=6(1+m)^2/[3(1+m)^2+(1+mn)(m^2+1/(mn))] over m,n in 0.01-100 never exceeded 1.5 (maximum 1.5000000000000002 on the grid) and equals 1.5 at m^2 n = 1 for m = 0.2, 0.5, 1, 2, 5; f is symmetric under swapping the layers (f(2,0.4) = f(0.5,2.5) = 1.4815). This is a numerical sanity check; the proof is the Lean file in the project record.",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-4d-printing/calc.py", "high", "max f=1.5; f(2,0.4)=1.4815", "", "")
add("Own test of the ceiling on a new vat-printed bilayer (Guida 2026): from the table, delta-epsilon between the 35 s layer (mean of 30 s and 40 s rows: 7.47 percent) and the 65 s layer (mean of 60 s and 70 s rows: 1.36 percent, my assumption) is 6.11 percent; with h = 1 mm the ceiling gives a smallest possible radius R = h/(1.5 d_eps) = 10.9 mm. The paper's tightest measured radius is 11 mm. With moduli 14.89 and 19.44 kPa (n = 1.305) Timoshenko predicts R = 11.0 mm at a 1:1 split and 11.0-12.3 mm for 40-70 percent active layer, 19.2 mm at 20 percent, 36 mm at 10 percent. Consistent with the 11-20 mm range, but the per-geometry data (Figure 5a) could not be read, so this is a plausibility check, not a validation.",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-4d-printing/calc.py", "low", "R_min,ceiling=10.9 mm vs measured 11 mm; sweep R=11.0-36 mm", "", "")
add("Own energy-density bounds (0.5*E*d_eps^2, fully blocked uniform layer; an upper bound, not a measurement): GelMA swollen 14.9 kPa at 6.1 percent = 28 J/m3; beech E=0.65 GPa at d_eps 2.5 percent = 203 kJ/m3; PA12-like E=1.5 GPa at 0.35 percent (earlier agent's estimate) = 9.2 kJ/m3. Printed LCE filament sigma x strain = 88-165 kJ/m3 from the review table (upper bound). So moisture-driven polymer actuators span roughly four decades in work density, wood and LCE high, hydrogels lowest.",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-4d-printing/calc.py", "medium", "28 J/m3 (GelMA); 9.2 kJ/m3 (PA12-like); 88-165 kJ/m3 (LCE); 203 kJ/m3 (beech)", "", "")

# ---------- G. Gaps (search results) ----------
add("GAP: Europe PMC title/abstract searches for humidity/moisture/hygroscopic terms with 4D-printing terms and (powder bed fusion / selective laser sintering / multi jet fusion) returned 0 records; no SLS or powder-bed hygromorph actuator was found (query in scratch/gap_search.json, G2).",
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search", "medium", "hitCount=0", "", "")
add("GAP: Europe PMC title/abstract search for humidity terms with 4D/bilayer terms and a vat-photopolymerisation term returned exactly 1 record, the Small 2024 PEG-PU paper above (G1). Other vat hydrogel work (Guida 2026, Zhao 2017/2018 per earlier agent) is actuated by liquid immersion.",
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search", "medium", "hitCount=1", "", "")
add("GAP: searches of Europe PMC (hygromorph or bilayer or 4D printing together with proof assistant, formal verification, Lean 4, Coq proof, Isabelle/HOL, machine-checked) returned 0 records, and arXiv returned 0 for hygromorph/bilayer/4D with Lean or proof assistant terms. No hygromorph with a machine-checked design law was found; the closest is the category-theoretic 'verified' pipeline above.",
    "http://export.arxiv.org/api/query", "medium", "hitCount=0 (EPMC G3,G4; arXiv x3)", "", "")
add("GAP: no paper in Europe PMC title/abstract with Timoshenko plus humidity plus 3D/4D printing returned a record for vat-photopolymer or SLS parts (queries G5, C1 returned 0); the Timoshenko comparisons found are for wood, paper, FFF filaments and the Marom 2026 FFF polyamide bilayer.",
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search", "medium", "hitCount=0", "", "")
