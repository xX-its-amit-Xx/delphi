# Findings part A: skin, hazard classes, VOC, leaching. Each tuple:
# (claim, value, source_url, local_file, evidence_quote, confidence)
R = 'D:/Users/ashenoy00000/delphi-work/'
S = R + 'agents2/scratch/bm-safety-lca/sdstxt/'
T = R + 'agents2/scratch/bm-safety-lca/tdstxt/'
D = R + 'data/safety-lca/'
AB = R + 'data/safety-lca/abstracts/'
PMC = R + 'data/safety-lca/pmc/'

U_RIGID10K_SDS = 'https://media.formlabs.com/m/3cc2feae0929233/original/-ENUS-Safety-Data-Sheet-Rigid-10K-Resin.pdf'
U_SIL_SDS = 'https://media.formlabs.com/m/32e7870f5d5cb04a/original/-ENUS-Safety-Data-Sheet-Silicone-40A-Resin.pdf'
U_F80V2_SDS = 'https://media.formlabs.com/asset/f2f45c46-fcda-43f9-a290-3d2a8c0af980/-ENUS-Safety-Data-Sheet-Flexible-80A-Resin-V2.pdf'
U_HT_SDS = 'https://media.formlabs.com/m/451f0db671a9ee49/original/-ENUS-Safety-Data-Sheet-High-Temp-Resin-V2.pdf'
U_DUR_SDS = 'https://media.formlabs.com/asset/d7bd17ac-00b5-451d-ba33-1e38d96f9635/-ENUS-Safety-Data-Sheet-Durable-V2-Resin.pdf'
U_F50_EU = 'https://media.formlabs.com/asset/c1b8bf8a-82c9-410d-86e9-0cbd3c29ddf8/-ENEU-Safety-Data-Sheet-Flexible-50A-Resin.pdf'
U_F50_US = 'https://media.formlabs.com/asset/dcb104c0-468f-4ffc-8af7-62640c449e54/-ENUS-Safety-Data-Sheet-Flexible-80A-Resin-V2.pdf'
U_N11_SDS = 'https://media.formlabs.com/asset/8caf1f04-1949-455c-9f06-5bae23b0b305/-ENUS-Safety-Data-Sheet-Nylon-11.pdf'
U_N12_SDS = 'https://media.formlabs.com/m/1b8fc1cd03b00332/original/-ENUS-Safety-Data-Sheet-Nylon-12.pdf'
U_TPU_SDS = 'https://media.formlabs.com/m/5645752b50954762/original/-ENUS-Safety-Data-Sheet-TPU-90A-Powder.pdf'
U_FAQ = 'https://formlabs.com/blog/resin-safety-resin-terms-faq/'
U_SAFE_SLA = 'https://formlabs.com/support/Safety-Formlabs-SLA-printers/'
U_SAFE_SLS = 'https://formlabs.com/support/Safety-with-Formlabs-SLS-products/'

FIND_A = [
 # ---- skin and eye hazards (SDS) ----
 ("Every one of the 14 distinct Formlabs SLA resin products whose safety data sheet (SDS) I read is classified as a skin sensitiser (H317, may cause an allergic skin reaction). Own tally over 15 SDS files (Flexible 50A has two) in sds_table.json, script sds_extract.py + calc.py.",
  "14 of 14 resins carry H317", U_RIGID10K_SDS, S + 'rigid10k__1693.txt', "H317 May cause an allergic skin reaction", "high"),
 ("Rigid 10K and Silicone 40A are the only two of the 14 resins whose SDS classification is H317 alone (no skin-irritation, eye-irritation or respiratory-irritation class). All other resins also carry H315 and/or H319 and/or H335, and two carry H318 or H360.",
  "H317 only: Rigid 10K, Silicone 40A", U_SIL_SDS, S + 'silicone40a__2097.txt', "H317 May cause an allergic skin reaction", "high"),
 ("Flexible 80A V2 is classified 'Serious eye damage, category 1' (H318), the strongest eye class among the SLA resins read (shared only with High Temp V2). Eye protection (goggles) is therefore not optional when pouring or wiping this resin, which is the proposed swelling layer in the project.",
  "H318 on Flexible 80A V2 and High Temp V2", U_F80V2_SDS, S + 'flexible80av2__3497.txt', "Serious eye damage, category 1", "high"),
 ("High Temp V2 resin is classified reproductive toxicity category 1B (H360, may impair fertility and the fetus), signal word Danger. The SDS does not name which ingredient causes it (section 3 lists 'Acrylated Monomer(s)' etc. as Trade Secret).",
  "H360 (Repr. 1B), ingredient not named", U_HT_SDS, S + 'hightemp__622.txt', "H360 May impair fertility. May impair fetus.", "high"),
 ("Durable V2/V2.1 resin is likewise classified Repr. 1B (H360, may damage fertility or the unborn child), plus H411 (toxic to aquatic life with long-lasting effects). Ingredient not named in the SDS.",
  "H360 + H411 on Durable V2", U_DUR_SDS, S + 'durable__19.txt', "H360 May damage fertility or the unborn child.", "high"),
 ("The EU (CLP) SDS for Flexible 50A, dated 2026-05-29, carries H411 (chronic aquatic hazard category 2); the US (HazCom) SDS of the same product and date does not. Same product, different regional label: a European client or studio must use the EU sheet. The US file is named flexible50a_ENUS in the earlier MANIFEST but its URL says Flexible-80A-Resin-V2; its content is Flexible 50A.",
  "EU: H411 present; US: absent", U_F50_EU, S + 'flexible50a_ENEU__2380.txt', "H411 Toxic to aquatic life with long lasting effects", "high"),
 ("Flexible 50A US SDS lists 'Methacrylate Ester Monomer' at 70-90 % by weight and a photoinitiator that the EU SDS identifies as BAPO (<2 %, Skin Sens. 1A, Aquatic Chronic 4). So the soft, high-swelling resin is mostly a single monomer class.",
  "70-90 % methacrylate ester monomer; BAPO <2 %", U_F50_US, S + 'flexible50a_ENUS__2379.txt', "Methacrylate Ester Monomer", "medium"),
 ("As supplied, the resins are not flammable by SDS (flash point above 93.5 C), so the fire risk in a resin room comes from the wash solvent, not the resin. Rigid 10K SDS section 9.",
  "flash point >93.5 C", U_RIGID10K_SDS, S + 'rigid10k__1693.txt', "Flammability Not Flammable", "high"),
 ("Acute oral and dermal toxicity of the Rigid 10K ingredients is low (rat oral LD50 >5000 mg/kg and dermal >2000 mg/kg for urethane dimethacrylate), so the dominant risk is allergy, not poisoning.",
  "UDMA oral LD50 >5000 mg/kg; dermal >2000 mg/kg", U_RIGID10K_SDS, S + 'rigid10k__1693.txt', "Urethane Dimethacrylate oral LD50 Rat: >5000 mg/kg", "high"),
 ("Rigid 10K is described by Formlabs as 'highly glass-filled' but its SDS section 3 itemises only urethane dimethacrylate 15-25 %, methacrylate monomer 7-10 % and photoinitiator <0.5 %. By my arithmetic 64.5 to 78 % of the mass is not itemised (probably the glass; that attribution is my inference). Sanding or machining cured Rigid 10K therefore makes glass-filled dust that the SDS does not describe.",
  "64.5-78 % of mass unlisted in SDS (calc.py)", 'https://media.formlabs.com/m/522eb50e6c8ac0e3/original/-ENUS-Rigid-10K-TDS.pdf', T + 'rigid10k__910.txt', "This highly glass-filled resin is the stiffest material in our engineering portfolio.", "medium"),
 ("Formlabs says sensitisation is cumulative and lasting, which is why a 'non-irritant' label does not remove the need for gloves.",
  "sensitisation irreversible once established", U_FAQ, D + 'formlabs-resin-safety-faq.html.txt', "irritation is dose-dependent and reversible, while sensitization is cumulative and, once established, lasting.", "high"),
 ("Formlabs recommends nitrile or neoprene gloves for liquid resin and wash solvent, safety glasses, and respiratory protection only if exposure limits are exceeded or ventilation is poor.",
  "nitrile or neoprene gloves", U_SAFE_SLA, D + 'safety-sla.html.txt', "Always wear non-reactive nitrile or neoprene gloves to prevent skin contact with liquid resin and wash solvents.", "high"),
 ("An independent 1992 glove study found no permeation of two multifunctional acrylates (HDDA, TMPTA) and two HDDA/EHA mixtures through nitrile or butyl rubber at 20 C, but permeation of HDDA through natural rubber with breakthrough in 30-60 min. It did not test the actual Formlabs mixtures or monofunctional methacrylates, so it supports 'nitrile, not natural rubber' but not a breakthrough time for Formlabs resin.",
  "nitrile: no permeation of tested acrylates; natural rubber: 30-60 min", 'https://doi.org/10.1080/15298669291359375', AB + '10.1080_15298669291359375.txt', "None of the acrylate compounds nor mixtures was found to permeate the butyl or nitrile rubber under the test conditions.", "medium"),
 ("Formlabs states its resins do not require a respirator, yet 8 of the 14 SDS carry H335 (may cause respiratory irritation). Both statements come from Formlabs; they are reconcilable only because the SDS asks for ventilation and a respirator 'if engineering controls do not maintain airborne concentrations below limits'.",
  "H335 on 8 of 14; FAQ says no respirator needed", U_FAQ, D + 'formlabs-resin-safety-faq.html.txt', "Formlabs resins do not require a respirator.", "medium"),
 ("Formlabs asserts that its resins contain no ACMO (N-acryloylmorpholine), a monomer it flags as a serious eye and organ hazard. The SDS compositions are mostly 'Trade Secret', so this cannot be independently confirmed from public documents.",
  "ACMO-free (vendor claim)", U_FAQ, D + 'formlabs-resin-safety-faq.html.txt', "Alpha Resins and other Formlabs resins do not contain ACMO.", "medium"),
 ("Formlabs says acrylic monomers are 'inert once fully polymerized' and that an incompletely cured part can still cause a reaction. Independent work (next findings) shows cured parts still outgas for weeks and can leach unreacted photoinitiator, so 'inert' is an overstatement and 'safe to handle' depends on the wash and cure workflow.",
  "vendor: cured = inert", U_FAQ, D + 'formlabs-resin-safety-faq.html.txt', "acrylic monomers are contact allergens in liquid form but inert once fully polymerized, so an incompletely cured part can still cause a reaction.", "high"),
 # ---- skin-contact certification ----
 ("Silicone 40A is the only elastomer resin read with a published skin-contact test: evaluated as a skin contacting device under ISO 10993-1, not cytotoxic (-5), not an irritant (-23), not a sensitizer (-10), tested at NAMSA. Tough 1500 V2 has the same three results, but only for parts washed 10 min, dried at least 30 min and post-cured at 70 C for 12 min.",
  "ISO 10993-5/-10/-23 pass (Silicone 40A; Tough 1500 V2)", 'https://media.formlabs.com/m/2e6bb2b3d645b427/original/-ENUS-Silicone-40A-TDS.pdf', T + 'silicone40a__2083.txt', "Silicone 40A Resin has been evaluated as a skin contacting device in accordance with ISO 10993-1, and passed the requirements", "high"),
 ("The Tough 1500 V2 skin-contact result applies to a defined workflow: 'washed in a Form Wash for 10 minutes' then dried and 'post-cured at 70 C for 12 minutes in a Form Cure'. A different wash, sanding, water cycling or a different cure is outside what was tested.",
  "result valid for stated workflow only", 'https://formlabs-media.formlabs.com/datasheets/25011041-TDS-ENUS-0.pdf', T + 'tough1500v2__3173.txt', "washed in a Form Wash for 10 minutes (5 min", "medium"),
 ("The technical data sheets for Rigid 10K, Flexible 80A V2 and Flexible 50A (versions read) contain no ISO 10993 or biocompatibility statement. I found no skin-contact claim for them; absence confirmed by grep of the saved TDS text, not by a quote.",
  "no biocompatibility claim for Rigid 10K, Flexible 80A V2, Flexible 50A", 'https://media.formlabs.com/m/522eb50e6c8ac0e3/original/-ENUS-Rigid-10K-TDS.pdf', T + 'rigid10k__910.txt', "", "medium"),
 # ---- VOC and particles ----
 ("A 2025 scoping review (J Expo Sci Environ Epidemiol) finds resin-printer VOCs reported mostly as carbonyl compounds or methacrylate monomers, that specific VOCs measured fell below British workplace limits, but warns the methods differ from regulatory ones and that total VOC, long print times, several printers and poor ventilation raise exposure.",
  "VOCs mostly carbonyls and methacrylates; below WELs; caution", 'https://doi.org/10.1038/s41370-025-00778-y', AB + '10.1038_s41370-025-00778-y.txt', "VOC emissions from resin 3D printers have been reported mostly as carbonyl compounds or methacrylate monomers.", "high"),
 ("In one study cited by that review, a resin printer released isopropanol at 560 ppbV; against the 400 ppmV limit quoted there that is 0.14 % (own calculation: 560e-9/400e-6 = 0.0014). Measured single-compound levels are low; the open question is the mixture and the sensitising monomers.",
  "IPA 560 ppbV = 0.14 % of 400 ppmV (calc.py)", 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12795753/', PMC + 'PMC12795753.xml', "The isopropanol emissions were 560 ppbV (0.560 ppmV) compared to the occupational TWA exposure limit of 400 ppmV", "high"),
 ("The same review reports a chamber study on a Formlabs Form 2 with clear and castable-wax resin: clear resin emitted 2-hydroxypropyl methacrylate, ethyl methacrylate and methyl methacrylate at about 4-6 ug/m3, ingredients listed in the SDS only as 'unspecified methacrylate monomers'. Form 2 is an older printer than the Form 4.",
  "~4-6 ug/m3 methacrylates (Form 2, clear)", 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12795753/', PMC + 'PMC12795753.xml', "The most abundant VOCs for the clear resin were 2-hydroxypropyl methacrylate (6 µg/m 3 ), ethyl methacrylate (4 µg/m 3 ) and methyl methacrylate (6 µg/m 3 )", "high"),
 ("A 2022 chamber study of SLA printing plus wash and cure units found 30 to over 100 VOCs per phase, total VOC above typical filament-printer levels (over 4 mg/h), and estimated personal exposure to formaldehyde and naphthalene above California OEHHA recommended indoor levels. This disagrees in emphasis with the 'below workplace limits' reading of the scoping review: both are true because one compares to workplace limits and the other to stricter indoor-air guidelines.",
  "TVOC >4 mg/h; formaldehyde, naphthalene above OEHHA levels", 'https://doi.org/10.1021/acs.chas.2c00002', AB + '10.1021_acs.chas.2c00002.txt', "The total VOC emissions from SLA processes were higher than typical levels from material extrusion 3D printing, and the emission rate could be over 4 mg/h.", "high"),
 ("A 2025 chamber study of two SLA printer brands found printer brand strongly influences SLA emissions (a built-in resin heater was part of the explanation), while resin colour mattered little. Emission numbers from one printer or the older Form 2 do not transfer to a Form 4.",
  "printer design dominates emissions", 'https://doi.org/10.1021/acs.chas.5c00076', AB + '10.1021_acs.chas.5c00076.txt', "Printer brand strongly influenced the emission yields.", "high"),
 ("A 2025 study found idle printers with an uncovered vat emitted as much as or more than active printing, and a fitted lid cut idle emissions by 70-97 %; a so-called 'Eco' resin emitted less than the standard one but both approached exposure thresholds. Practical rule: keep the vat covered, remove the resin tank only when needed.",
  "lid cuts idle VOC by 70-97 %", 'https://doi.org/10.1021/acs.chas.4c00087', AB + '10.1021_acs.chas.4c00087.txt', "idle printer emissions were reduced drastically (by 70–97%) using a fabricated vat lid", "high"),
 ("Cured resin parts keep emitting. A 2021 study measured outgassing of cured parts for 84 days: total emissions fell by 84-96 % over 28 days, from 3000-14000 to 100-1000 ug/m2/h, parts warmed to 37 C emitted 1.4-2.9 times more, and the authors suggest storing parts for 4 weeks before consumer use. Directly relevant to a pavilion or interior installation.",
  "outgassing falls 84-96 % in 28 d; 37 C = 1.4-2.9x", 'https://doi.org/10.1080/15287394.2021.1998814', AB + '10.1080_15287394.2021.1998814.txt', "Manufactured resin products are suggested to be stored for 4 weeks after their production to reduce potential consumer VOC hazards.", "high"),
 ("The same study identified sensitising acrylates and carcinogenic formaldehyde among emitted compounds, and average VOC concentration at the printer of only 41-87 ug/m3: low, but not zero hazard.",
  "VOC 41-87 ug/m3; acrylates + formaldehyde present", 'https://doi.org/10.1080/15287394.2021.1998814', AB + '10.1080_15287394.2021.1998814.txt', "The identified compounds included hazardous species included sensitizing acrylates and carcinogenic formaldehyde.", "high"),
 ("Formlabs' air-quality position: all its facilities remain below OSHA limits, but 'air quality results are specific to Formlabs facilities and are not transferable to other locations'. A studio needs its own assessment; Formlabs recommends rooms with at least three full air exchanges per hour.",
  ">=3 air changes per hour; results not transferable", U_SAFE_SLA, D + 'safety-sla.html.txt', "Air quality results are specific to Formlabs facilities and are not transferable to other locations.", "high"),
 ("Formlabs recommends SLA products be used in a room with at least three full air exchanges per hour (HVAC), not in closets or small unventilated storage rooms.",
  "3 air changes per hour", U_SAFE_SLA, D + 'safety-sla.html.txt', "Formlabs recommends using its SLA products in room equipped with HVAC systems providing at least three full air exchanges per hour.", "high"),
 ("Formlabs' UL GREENGUARD Gold certification applies only to its Alpha resins printed on Form Studio 1 with the VOC Extractor, and Formlabs itself says it is for the printing process, not just the final part. It must not be quoted for Form 4 resins, Flexible, Rigid or Silicone, or for finished parts.",
  "GREENGUARD Gold: Alpha resins on Form Studio 1 only", 'https://formlabs.com/safety', D + 'formlabs-safety.html.txt', "This certification is for the printing process - not just for a final part.", "high"),
 ("Sanding cured parts: Formlabs advises respiratory protection (N95 or better) and wet sanding to limit dust.",
  "wet sand + respirator", U_SAFE_SLA, D + 'safety-sla.html.txt', "You may also want to wear respiratory protection when sanding your printed parts. You can also wet sand to minimize dust.", "medium"),
 ("A 2025 feeding study with sanded SLA resin particles in house crickets found changed enzyme activities (digestive, antioxidative) but no statistically significant difference in mortality between dose groups, so the ecotoxicity of cured-resin sanding dust is unsettled; I rate it weak evidence either way.",
  "no significant mortality difference (Kruskal-Wallis p>0.05)", 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12691734/', PMC + 'PMC12691734.xml', "There were no statistically significant differences between the groups in terms of mortality rate, according to the Kruskal–Wallis test, p > 0.05.", "medium"),
 # ---- leaching ----
 ("An SLA-printed plastic leached unreacted photoinitiator 1-hydroxycyclohexyl phenyl ketone into water at up to 200 mg/L in the first 24 h; the extract killed zebrafish embryos (LC50 22.25 % v/v). The abstract names an SLA process, not a Formlabs resin, so it shows the mechanism, not a Formlabs-specific number. Any water-cycling hygromorph facade will extract from its resin the same way.",
  "up to 200 mg/L in 24 h; LC50 22.25 % v/v", 'https://doi.org/10.1016/j.aquatox.2019.105227', AB + '10.1016_j.aquatox.2019.105227.txt', "Migration of unpolymerized photoinitiator, 1-hydroxycyclohexyl phenyl ketone (1-HCHPK) from a plastic solid phase to aqueous media at up to 200 mg/L in the first 24 h was detected", "high"),
 ("Formlabs' own solvent-compatibility table shows some resins lose mass in some liquids (negative 24 h weight change), which means extraction can outweigh uptake. This is the earlier project record (spec-resin-chemistry.json) and I did not re-fetch the table.",
  "-0.1 % IPA (V4.1), -3 % TPM (PU Rigid 650)", 'https://formlabs.com/support/solvent-compatibility/', R + 'agents/spec-resin-chemistry.json', "Risk, leaching visible in Formlabs' own data: several resins show negative 24 h weight change in some liquids", "medium"),
]
