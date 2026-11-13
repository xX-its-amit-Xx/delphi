"""Part 3: resin data (water, IPA), wash/cure, features, orientation, warping, green bonding."""
from build_part1 import F, K

# ---------- D. water and IPA uptake of the candidate resins ----------
F("Formlabs solvent-compatibility method: printed 1 cm cubes (washed and post-cured per the resin's standard settings) weighed before and after 24 h immersion; results are % weight gain at 24 h.",
  "solvent", "high", "1 cm cube, 24 h",
  "Results are reported as weight gain percentage after 24 hours of exposure to solvent.")
F("CONFIRMS earlier agents: Elastic 50A Resin V2 (now sold as Flexible 50A; the BioMed Elastic 50A row is identical) takes up 39.2 % mass in IPA and 0.7 % in water in 24 h; Rigid 10K takes up <0.1 % in both. Header-aware parse of the HTML table (script solvent_table.py): IPA is the 10th data column, Water the 18th.",
  "solvent", "high", "Elastic 50A V2: IPA 39.2 %, water 0.7 %, xylene 163.9 % | Rigid 10K: IPA <0.1 %, water <0.1 %",
  "15.6 | 39.2 | 0.4 | 0.7 | 0.6 | 41.2 | 0.7 | 45.6 | 43.6 | 0.7 | 163.9 |")
K("Elastic/Flexible 50A takes up 39.2 % mass in isopropanol in 24 h (1 cm cube) against <0.1 % for Rigid 10K, so wash solvent is a far stronger swelling stimulus than humidity for the elastomers.",
  "solvent", "Elastic 50A Resin V2 | 1.5 | 43.4 | 0.6 | 133.1 | 7.9 | 31.4 | 3.9 | 0.9 | 15.6 | 39.2 |")
F("NEW: Tough 1000 takes up 6.9 % mass in IPA (24 h cube) although only 0.0 % in water; so even the 'stiff' passive layer swells in the wash solvent. Silicone 40A: IPA 5.9 %, water <0.1 %, but n-butyl acetate 92.3 % (its alternative wash solvent is 80/20 IPA/n-butyl acetate).",
  "solvent", "high", "Tough 1000: IPA 6.9 %, water 0 % | Silicone 40A: IPA 5.9 %, butyl acetate 92.3 %",
  "Tough 1000 Resin | 0.2 | 30.4 | 0 | 38.9 | 0.7 | 6.9 | 0.1 | 0.2 | 39.8 | 6.9 |")
F("The solvent table row 'Flexible 80A Resin' has no version label and no Flexible 80A V2 row exists on the page; it gives 0.7 % water and 11.7 % IPA.",
  "solvent", "high", "Flexible 80A (unlabelled version): water 0.7 %, IPA 11.7 %",
  "Flexible 80A Resin | 0.9 | 37.4 | 0.6 | 51.4 | 2.3 | 19.3 | 1 | 0.7 | 1.6 | 11.7 |")
F("CONTRADICTS the blanket reading in spec-resin-chemistry.json ('every current SLA resin gains under 1 % mass in water at 24 h', citing Flexible 80A 0.7 %): the Flexible 80A V2 data sheet (ASTM D471 slabs, wiped dry, no conditioning) reports DI water +8 % mass, +3 % volume, -26 Shore A after 1 day and +9 % mass, +7 % volume after 1 week. The 0.7 % cube figure is for an unversioned/older Flexible 80A row, and the two methods differ (cube vs slab). spec-formlabs-materials.json already carried the 8 % figure; I confirm that one. Row-to-label mapping was done by vertical position (flex80_d471.py); the plain-text table is scrambled.",
  "flex80_tds", "medium", "DI water: 1 day -26 pts, +8 % mass, +3 % vol; 1 week -27 pts, +9 %, +7 %",
  "Test specimens are fully immersed for intervals of 1 day and 1 week.", src2=["project"])
F("NEW: the same Flexible 80A V2 data sheet reports IPA +45 % mass, +113 % volume, -32 Shore A, tensile strength 90 % of baseline after 1 day (week: +48 %, +119 %, -33, 68 %). The volume figure is about 1.9 times what simple additivity of the mass gain predicts (own calculation, calc.py section G), so treat the volume column with caution; the direction (very large IPA swelling) is not in doubt.",
  "flex80_tds", "medium", "IPA 1 day: +45 % mass, +113 % vol; 1 week: +48 %, +119 %",
  "Chemical compatibility is evaluated by measuring the change in physical properties following full immersion in various chemicals")
F("Flexible 80A V2 data sheet footnote: samples for the post-cured properties were washed in a Form Wash for 10 minutes in 99 % IPA and post-cured at room temperature for 5 minutes in water and at 80 C for 5 minutes in air in a Form Cure V2 L. Data sheet date reads 'Prepared 12/05/2026' (format ambiguous).",
  "flex80_tds", "high", "wash 10 min IPA; cure 5 min in water + 5 min 80 C",
  "for 10 minutes in 99% Isopropyl Alcohol, and post-cured at room")
F("Flexible 80A V2 product page: compatible with Form 4, 4B, 4L, 4BL and Form Studio 1; 10 MPa ultimate tensile strength, 230 % elongation at break. No minimum layer thickness is listed on the page.",
  "flex80_page", "high", "UTS 10 MPa; EAB 230 %",
  "Compatible Printer Form 4, Form 4B, Form 4L, Form 4BL, Form Studio 1")
F("Tough 1000 product page: tensile modulus 932 MPa, ultimate tensile strength 26.3 MPa, elongation 180 %; Form 4 / 4B / 4L / 4BL / Form Studio 1; data taken on Form 4 at 100 um, post-cured 12 min at 70 C in a Form Cure V2.",
  "tough1000_page", "high", "E = 932 MPa; 100 um settings",
  "Tensile Modulus 932.0 MPa")
F("Flexible 50A product page: minimum layer thickness 100 um; Shore 55.0 A listed; compatible with Form 4 series and Form 3 series.",
  "flex50_page", "high", "min layer 100 um",
  "Minimum Layer Thickness 100 micron")
F("Rigid 10K product page: minimum layer thickness 50 um; compatible with Form 4 series.",
  "rigid10k_page", "high", "min layer 50 um",
  "Minimum Layer Thickness 50 micron")

# ---------- E. wash and post-cure ----------
F("Wash times (Form Wash support table): Flexible 50A 20 min or until clean; Flexible 80A V2 two cycles of 5 min with fresh solvent for the second; Tough 1000 10 + 10 min; Rigid 10K V1/V1.1 10 + 10 min; Silicone 40A 20 min in IPA sonication wash or 80/20 IPA/n-butyl acetate (not IPA alone).",
  "wash", "high", "see claim",
  "Wash parts for 20 minutes or until clean.")
F("DISAGREEMENT between Formlabs sources on Flexible 80A V2 washing: the support table says 5 min + 5 min; the data sheet footnote says 10 min in 99 % IPA. Both are Formlabs documents; I do not know which is current (the data sheet is the newer-dated copy I fetched).",
  "wash", "high", "5+5 min (table) vs 10 min (TDS)",
  "Wash parts printed in Flexible 80 A Resin V2 in two cycles, preferably using fresh solvent for the second wash.", src2=["flex80_tds"])
F("Tough 1000: Formlabs recommends air-drying at least 30 minutes before handling or post-curing for best surface finish.",
  "wash", "high", "dry >= 30 min",
  "For best surface finish, Formlabs recommends allowing parts printed in Tough 1000 Resin to air dry for at least 30 minutes prior to handling or post-curing.")
F("Form Cure V2 settings: Tough 1000 default 12 min at 70 C, or a 'Low warp' option 12 min with no heat; Flexible 80A V2 default is two cycles (cycle 1 5 min with no heat, cycle 2 5 min at 80 C); Flexible 50A full post-cure 7 min at 70 C; Silicone 40A 10 min at 60 C; Rigid 10K 3 min preheat + 7 min at 80 C; Grey V5 default 1 min no heat, 'full cure' 5 min at 60 C.",
  "cure2", "high", "Tough 1000 'Low warp' 12 min no heat",
  "Tough 1000 Resin | Default | 12 min | 70 °C | Low warp | 12 min | No heat |")
F("Flexible 50A and Flexible 80A V2 are post-cured with the dry parts submerged in room-temperature water in a UV-transparent container (footnote 5), i.e. oxygen is excluded and the part is wet-cured; this matters for any later water-uptake test and for bonding.",
  "cure2", "high", "cure in water (cycle 1)",
  "Place dry parts in a glass beaker (or other UV-transparent container) and completely submerge the parts in room temperature water.")
F("Formlabs on green state: printing cures resin to a 'green' state in which some polymer connections are not yet reacted; post-curing raises strength and stiffness and 'causes minor shrinkage'; settings are designed to account for the expected shrinkage. No shrinkage percentage is given.",
  "postcure", "high", "post-cure shrinkage: qualitative only",
  "Therefore, post-curing also causes minor shrinkage, and each material's print settings are designed to account for the expected shrinkage during printing and post-curing.")
F("Formlabs: long washes let the part absorb solvent so the outer edges expand and warp it; heat and light shrink the part in post-cure; if one side cures and not the other, or the part is under-supported, it warps. Symptom listed: 'Unexpected curvature on parts'.",
  "warp", "high", "wash and cure both bend parts",
  "While washing parts, long wash times allow the printed part to absorb solvent, causing the outer edges to expand and warp the part.")
F("Formlabs: thin walls may absorb IPA during washing and deform, so minimise immersion time; thin wires are 'weakened by IPA'.",
  "design", "high", "limit IPA time",
  "Spending an extended duration in a washing solution can cause deformation of the part, so minimize how long the part is immersed in IPA to limit this effect.")
F("Formlabs: leave parts on supports while post-curing; heavy or soft parts sag in the cure chamber ('longer cure times and softer materials are more prone to this defect').",
  "orient", "high", "support parts during cure",
  "Longer cure times and softer materials are more prone to this defect.")

# ---------- F. feature sizes, tolerances, layer thickness ----------
F("Form 4 (Grey Resin V5, 50 um layers): recommended minimum supported wall 0.2 mm and unsupported wall 0.2 mm; measured printed values 0.17 mm and 0.18 mm for 0.2 mm CAD; walls of 0.2 mm or less 'may warp' (supported) or 'may warp or detach' (unsupported).",
  "design", "high", "wall 0.2 mm (printed 0.17 / 0.18)",
  "A supported wall with a thickness of 0.2 mm or less may warp due to the peel forces exerted on the part during the peel process.")
F("Form 4 other limits (Grey V5): max unsupported overhang 5.0 mm; max horizontal span 29 mm for a 5 x 3 mm beam; vertical wire 0.3 mm diameter up to 7 mm tall and 0.6 mm up to 30 mm tall; embossed 0.1 mm; engraved 0.15 mm; clearance 0.4 mm; hole 0.5 mm; drain hole 0.75 mm.",
  "design", "high", "see claim",
  "Recommended for a 30 mm-tall wire: 0.6 mm/600 micron diameter")
F("Form 4 XY tolerance (Grey V5, 100 um layers, post-cured 5 min at room temperature): 1-30 mm features +/-0.15 % (floor +/-0.02 mm); 31-80 mm +/-0.2 % (floor +/-0.06 mm); 81-150 mm +/-0.3 % (floor +/-0.15 mm). No Z tolerance and no elastomer tolerance published.",
  "design", "high", "+/-0.15 % (>= 0.02 mm) for 1-30 mm",
  "1–30 mm features: ±0.15% (lower limit: ±0.02 mm)")
F("Layer thickness: current Formlabs tech-specs page gives 25-200 um for the Form 4 column; the 2024 Form 4 manual gives 25-300 microns. Availability varies by material (footnote). This corrects the 25-200 vs manual difference not noted in spec-formlabs-materials.json.",
  "techspecs", "medium", "25-200 um (web 2026) vs 25-300 um (manual 2024)",
  "Layer thickness availability varies by material.", src2=["manual"])
F("Form 4 pixel size is 50 um with pre-tuned anti-aliasing (manual); the thin dimension of a strip printed on edge is set by XY pixels, not by layers.",
  "manual", "medium", "50 um pixel",
  "50 micron pixel size with pretuned anti-aliasing")
F("Fuse (Nylon 12 Powder, 110 um): minimum wall 0.6 mm vertical / 0.3 mm horizontal, supported or unsupported; minimum hole 1.0 mm. Thin flat SLS parts should sit mid-height in the build (top/bottom placement curls edges).",
  "fuse_design", "high", "0.3 mm horizontal wall",
  "Horizontal walls: 0.3 mm/300 microns")
F("Fuse orientation: thin, flat features belong at the centre of the vertical build height, not at top or bottom; thin features at top and bottom curl at the edges.",
  "fuse_orient", "high", "mid-height placement",
  "To prevent warping, thin, flat features should be placed towards the center of the vertical height of the build rather than at the top or bottom.")

# ---------- G. orientation, supports, thin strip warping ----------
F("NEW and decisive for 0.2-1 mm strips: parts printed directly on the build platform (no raft) come out about 0.1 mm shorter than designed along Z, because the first layers are compressed for adhesion. For a 0.2 mm layer that is a 50 % thickness error, for 1.0 mm 10 % (own arithmetic, calc.py section E).",
  "direct", "high", "-0.1 mm in Z; 50 % of a 0.2 mm layer",
  "expect each model to be approximately 0.1 mm shorter than designed along the Z-axis in the model's first layers.")
K("A strip printed flat on the build platform loses about 0.1 mm of thickness to first-layer compression (Formlabs), which is half of a 0.2 mm layer; thin-layer thickness must therefore be measured, not trusted from CAD.",
  "direct", "expect each model to be approximately 0.1 mm shorter than designed along the Z-axis in the model's first layers.")
F("PreForm 'early layer merging' rewrites the first 0.75 mm of any on-build-platform print (perimeter and fill of those layers are combined) to guarantee adhesion; a strip thinner than 0.75 mm printed flat lies wholly inside this zone.",
  "direct", "high", "first 0.75 mm merged",
  "PreForm automatically revises the first 0.75 mm of all on-build-platform prints to increase adhesion.")
F("Formlabs orientation guidance: printing directly on the build platform generally gives the least warpage and shrinkage and fewer supports; but the platform constrains shrinkage so bottom layers are often oversized in XY.",
  "orient", "high", "on-platform: least warp, XY oversize",
  "Parts printed directly to the build platform will generally have the least amount of warpage and shrinkage, in addition to using fewer supports.")
F("Formlabs orientation guidance (Form 4/4L): to stop curling of edges and large surfaces, reorient so the part sits at 45 degrees to the horizontal; parts parallel to the platform on supports are more likely to warp; faces at a shallow angle can 'bat-wing' unless support density is raised.",
  "orient", "high", "45 deg to horizontal",
  "Reorient the model so it is oriented at 45° to the horizontal, minimizing the shrinkage.")
F("CONFLICT inside Formlabs guidance for a flat thin strip: 'print directly on the platform' (least warp, but -0.1 mm Z loss and merged first 0.75 mm) versus '45 degrees on supports' (less curl, but support marks and thickness set by the layer stack). Neither page treats strips under 1 mm; the choice is a guess to be settled by the pilot print.",
  "warp", "medium", "unresolved",
  "Some orientations, such as printing a part parallel to the build platform on supports, are more likely to cause warping during printing.", src2=["orient", "direct"])
F("Formlabs forum report (Form 1 era, 2016) of 100 x 10 mm strips 0.1-2 mm thick in several resins: strips began to warp while printing and warped more during cure and cooling; reply: orient a thin flat plane at 45 degrees in X and Y and post-cure on supports. User report, not a measurement.",
  "f_distort", "low", "warp starts in print, grows in cure",
  "A thin flat plane should be oriented at 45 degree angles in the X and Y to evenly distribute internal forces.")
F("Peer-reviewed: for mask-image-projection stereolithography, polymerisation shrinkage and thermal cooling are the two major causes of curl distortion; temperature rise of a cured layer depends mainly on layer thickness; lower photocuring temperature (grayscale or mask-pattern exposure) reduces curl at the cost of build time. Not a Formlabs machine; no strip-curvature numbers in the abstract.",
  "xu2016", "high", "doi 10.1115/1.4034305 (Xu & Chen, J Manuf Sci Eng 2016)",
  "Polymerization shrinkage and thermal cooling effect have been identified as two major factors that lead to the curl distortion in the stereolithography apparatus (SLA) process.")

# ---------- H. bonding, green state ----------
F("Formlabs-documented bonding routes: epoxy (large parts), cyanoacrylate (small/medium parts), or liquid resin cured with a 405 nm UV laser light pen (small parts); resin joints are listed as low impact strength. Nothing is said about bonding green parts.",
  "faq", "high", "resin bond: small area, low impact strength",
  "Apply a small amount of liquid resin to the surface to be bonded using a dropper or syringe, then cure with a 405 nm UV laser light pen.")
F("Formlabs blog: resin bonding with a 5 mW 405 nm light pen 'will create a chemical bond, just as if the part was printed' but only suits small bonding surfaces because the low-power pen cannot penetrate the model deeply enough. A 40 x 4 mm interface (160 mm2) is arguably not 'small'; a flood cure (Form Cure) is the alternative.",
  "blog_large", "high", "5 mW pen; small areas",
  "This method will create a chemical bond, just as if the part was printed on your SLA 3D printer, but is only applicable to small bonding surfaces")
F("Formlabs forum users (anecdotal): a thin coat of uncured resin between mating faces cured with UV gives a joint 'as strong as if the parts had been printed monolithically', and epoxy / cyanoacrylate joints crack because their mechanics differ from the printed resin; one user wipes excess with IPA-damp towel, clamps, then cures, but notes surfaces sometimes warp. Another notes uncured resin is slick so parts slide when clamped.",
  "f_bond", "low", "anecdotal",
  "This yields a bond that (done correctly) is as strong as if the parts had been printed monolithically.")
F("No Formlabs or peer-reviewed source read gives a measured bond strength between a green first layer and a second layer of a DIFFERENT resin. The nearest evidence: (a) Formlabs says green parts still hold unreacted polymer connections; (b) a DLP study found each printed layer interface of ONE resin is a weak zone (about 11 um thick, 22 % of a 50 um layer, local stiffness down up to 30 %), attributed to oxygen inhibition and molecular diffusion across the interface; (c) a dental-composite study states the oxygen-inhibited surface layer is a layer of unreacted monomer and that reports on whether it raises bond strength are inconsistent. So green-state bonding is plausible chemically but is an untested assumption here.",
  "gojzewski", "medium", "interface 11 um, 22 % of 50 um layer, stiffness -30 %",
  "The thickness values of the interfacial layers were approximately 11 μm, which corresponds to ∼22% of the total layer thickness (50 μm).", src2=["oil", "postcure"])
F("Dental composite study (not a printing study): 'Reports on how this oxygen-inhibited layer affects the bond strength have been inconsistent.'",
  "oil", "medium", "inconsistent literature",
  "Reports on how this oxygen-inhibited layer affects the bond strength have been inconsistent.")
F("Formlabs forum (2017): users report joining separate SLA parts with resin then curing under UV works; resin cures slowly so holding the parts is the challenge; one user says resin-to-resin bonds were stronger than cyanoacrylate. Anecdotal.",
  "f_glue", "low", "anecdotal; clamping is the problem",
  "There is no more of an effective bond than one created by joining resin with resin.")
