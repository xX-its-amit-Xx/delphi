# Findings part B: IPA and washing, disposal, powder (SLS) handling.
from data_a import R, S, T, D, AB, PMC, U_SAFE_SLA, U_SAFE_SLS, U_N11_SDS, U_N12_SDS, U_TPU_SDS

U_REPL_IPA = 'https://formlabs.com/support/Replacing-IPA/'
U_WASHT = 'https://formlabs.com/support/Form-Wash-Time-Settings/'
U_DISP = 'https://formlabs.com/support/Disposing-of-resin/'
U_DISPS = 'https://formlabs.com/support/How-can-I-dispose-of-resin-and-used-solvent/'
U_POWDER = 'https://formlabs.com/support/Powder-care-storage-and-disposal/'

FIND_B = [
 # ---- IPA ----
 ("IPA is the flammable item in a resin studio: Formlabs labels it 'Danger' and says use and store it away from ignition sources; PubChem lists a closed-cup flash point of 12 C (53 F) and GHS H225 (highly flammable liquid and vapour) for isopropanol, against >93.5 C for the resins themselves.",
  "IPA flash point 12 C closed cup; H225", 'https://pubchem.ncbi.nlm.nih.gov/compound/Isopropyl-alcohol', D + 'pubchem/ipa_Flash+Point.json', "12 °C, 53 °F (Closed cup)", "high"),
 ("GHS classification of isopropanol on PubChem: H225 flammable, H319 eye irritation, H336 drowsiness or dizziness (narcotic effects). These apply to the wash bath, not the resin.",
  "H225, H319, H336", 'https://pubchem.ncbi.nlm.nih.gov/compound/Isopropyl-alcohol', D + 'pubchem/ghs.json', "H225: Highly Flammable liquid and vapor [Danger Flammable liquids]", "high"),
 ("Formlabs wash bath maintenance: replace IPA when dissolved resin reaches 10 %; Form Wash V1 holds 8.6 L, V2 15 L and Form Wash L 42 L of solvent. Those volumes set the size of the flammable-liquid inventory and of the waste stream.",
  "replace at 10 % resin; 8.6 / 15 / 42 L", U_REPL_IPA, D + 'replacing-ipa.html.txt', "The Form Wash V1 holds 8.6 L of solvent. The Form Wash V2 holds 15 L of solvent. The Form Wash L holds 42 L of solvent.", "high"),
 ("Formlabs' danger notice on IPA: consult the supplier SDS first and keep IPA away from ignition sources.",
  "IPA flammable (Formlabs notice)", U_REPL_IPA, D + 'replacing-ipa.html.txt', "IPA is flammable and should be used and stored away from ignition sources.", "high"),
 ("Wash time is resin-specific and too long is harmful to the part. Flexible 50A (formerly Elastic 50A V2): 20 min and 'avoid washing Elastic 50 A Resin for longer than 20 minutes, as this may degrade parts'. This ties to the project record that Elastic 50A V2 takes up 39.2 % IPA by mass in 24 h: the same bath that cleans the part swells it, extracts residues and leaves flammable solvent inside it.",
  "Flexible/Elastic 50A max 20 min; IPA uptake 39.2 % in 24 h", U_WASHT, D + 'wash-time.html.txt', "Avoid washing Elastic 50 A Resin for longer than 20 minutes, as this may degrade parts.", "high"),
 ("High Temp V2: wash 5 min, never more than 6 min total in solvent. Durable V2: 20 min and not longer than 20 min total. Both are the two H360 (reproductive toxicity 1B) resins, so short, controlled wash times also limit operator exposure.",
  "High Temp 5 (max 6) min; Durable 20 min max", U_WASHT, D + 'wash-time.html.txt', "Do not leave High Temp Resin in solvent for longer than 6 minutes total, as excessive solvent exposure affects the quality of the final part.", "high"),
 ("Rigid 10K is washed 10 + 10 min (second bath fresh) in its own bucket because it contains glass particles that otherwise stick to other resins' parts; Flexible 80A V2 is washed 5 + 5 min in two cycles with fresh solvent for the second.",
  "Rigid 10K 10+10 min; Flexible 80A V2 5+5 min", U_WASHT, D + 'wash-time.html.txt', "Rigid 10K Resin contains glass particles, which strengthens printed parts. Maintain separate wash buckets to prevent glass particles adhering to parts printed with other resins.", "high"),
 ("Silicone 40A cannot be washed in plain IPA: Formlabs specifies an 80/20 IPA to n-butyl acetate mixture in a dedicated Form Wash bucket, or an IPA sonication procedure. n-Butyl acetate is a second flammable solvent and a different waste stream; plan for it before choosing Silicone 40A.",
  "80/20 IPA : n-butyl acetate, dedicated bucket", U_WASHT, D + 'wash-time.html.txt', "Do not wash with IPA alone unless following the instructions in the Silicone 40 A Resin IPA sonication wash guide .", "high"),
 ("Formlabs' non-flammable Resin Washing Solution is NOT recommended for Flexible 50A, Flexible 80A (V1, V2), Elastic 50A or Tough 1000, so the safer solvent is not available for the soft layers this project needs.",
  "Resin Washing Solution excluded for the elastomer resins", U_WASHT, D + 'wash-time.html.txt', "Formlabs does not recommend using Resin Washing Solution to wash parts printed in this resin.", "high"),
 ("Dry before handling or curing: Formlabs recommends letting Tough 1000 parts air dry at least 30 minutes before handling or post-curing, and (castable resins) ensuring all solvent has evaporated before curing. Solvent-swollen elastomer parts should be dried at least as long.",
  "dry >=30 min (Tough 1000)", U_WASHT, D + 'wash-time.html.txt', "Formlabs recommends allowing parts printed in Tough 1000 Resin to air dry for at least 30 minutes prior to handling or post-curing.", "high"),
 ("Ventilate wash and dry areas: Formlabs says handle solvents with gloves in a well-ventilated area away from heat, sparks and flames, because IPA vapours are flammable.",
  "ventilate; no ignition sources", U_SAFE_SLA, D + 'safety-sla.html.txt', "Solvents such as isopropyl alcohol evaporate rapidly, and their vapors are flammable, so keep bottles closed whenever possible.", "high"),
 # ---- disposal ----
 ("Liquid or partly cured resin may be hazardous waste: put it in the chemical waste stream; without one, Formlabs' fallback is to cure a small amount in a labelled container in sunlight for 1-10 days (405 nm light plus heat is faster), then bin the cured solid as household waste. Never down a drain.",
  "chemical waste stream, or cure 1-10 days in sunlight", U_DISP, D + 'dispose-resin.html.txt', "Leave the container exposed to sunlight to cure for 1–10 days.", "high"),
 ("Regulatory status of liquid resin as waste depends on the region: Formlabs writes that liquid resin 'may be classified as hazardous waste in your region and shall be disposed of with care'. A UK or EU practice must check its local waste code; I did not find a single authoritative code.",
  "region-dependent hazardous waste", U_DISP, D + 'dispose-resin.html.txt', "Liquid resin (whether pure liquid, dissolved in solvent, or partially cured) may be classified as hazardous waste in your region and shall be disposed of with care.", "high"),
 ("Used IPA or TPM that contains dissolved resin must never go down a drain or into household waste; use a waste-disposal service and tell them it contains methacrylated monomers, oligomers and trace photoinitiator.",
  "used solvent = hazardous waste service", U_DISPS, D + 'dispose-resin-solvent.html.txt', "Never pour solvent that contains dissolved resin into drains or dispose of it with household waste.", "high"),
 ("Disposal instruction for contaminated paper towels and gloves: expose to sunlight or UV to cure the liquid resin, then household waste (Formlabs).",
  "cure then bin", U_DISP, D + 'dispose-resin.html.txt', "To dispose of paper towels or other supplies that have come into contact with liquid resin, expose them to sunlight or UV light to cure the liquid resin and then dispose of them with household waste.", "high"),
 ("Cured resin and cleaned parts cannot be recycled according to Formlabs, which tells users to discard them as household waste. This is the manufacturer's statement for its own resins.",
  "cured resin: not recyclable", U_DISP, D + 'dispose-resin.html.txt', "Cleaned parts and cured resin cannot be recycled.", "high"),
 ("As supplied, the Nylon 11 powder is not RCRA hazardous waste per its SDS; the SDS section 12 says 'No data available' for persistence and degradability, so no biodegradability claim is supported.",
  "not hazardous waste; degradability: no data", U_N11_SDS, S + 'nylon11__1125.txt', "As supplied, this material is not considered a hazardous waste under RCRA.", "high"),
 ("Unsintered used powder must be disposed of according to local ordinances for plastic waste; vacuum bags and filters count as unsintered powder waste; sintered powder and cleaned parts go to household waste and 'cannot be recycled'; empty powder cartridges and build chambers cannot be recycled.",
  "powder and parts: not recyclable (Formlabs)", U_POWDER, D + 'powder-care.html.txt', "Cleaned parts and sintered powder cannot be recycled.", "high"),
 ("Unsintered powder disposal: 'Unsintered used powder must be disposed of in accordance with your local ordinances and environmental regulations for plastic waste.'",
  "unsintered powder: local plastic-waste rules", U_POWDER, D + 'powder-care.html.txt', "Unsintered used powder must be disposed of in accordance with your local ordinances and environmental regulations for plastic waste.", "high"),
 ("Resin packaging: Formlabs reports its Form 4 cartridge uses 66 % less plastic than earlier designs; that is a packaging statement from the company, not an LCA of the resin.",
  "cartridge 66 % less plastic (vendor)", 'https://formlabs.com/blog/3d-print-sustainability/', D + 'formlabs-sustainability.html.txt', "The next-generation resin cartridge for Form 4 Series 3D printers uses 66% less plastic than precious designs while still delivering one full liter of material.", "medium"),
 # ---- powder handling ----
 ("Pulverised nylon powder is a combustion risk: Formlabs requires a grounded, bonded Class II Division 2 vacuum for cleaning, no ignition sources, care to avoid dust plumes. The Nylon 11 and 12 SDS classify the powder 'Combustible Dust' (signal word Warning).",
  "Combustible Dust; grounded vacuum", U_POWDER, D + 'powder-care.html.txt', "Pulverized plastic powder (e.g., nylon PA12) poses a combustion risk if not properly handled.", "high"),
 ("SDS classification of the Formlabs nylon powders: Nylon 11 and Nylon 12 are 'Combustible Dust' only; TPU 90A states no hazardous substances. Nylon 12 contains carbon black at 0.1-0.999 % (CAS 1333-86-4).",
  "Nylon 11/12: combustible dust only; Nylon 12: carbon black <1 %", U_N12_SDS, S + 'nylon12__994.txt', "Combustible Dust", "high"),
 ("TPU 90A powder SDS: 'There are no substances or mixtures present which are classified as hazardous.'",
  "TPU 90A: not classified hazardous", U_TPU_SDS, S + 'tpu90a__1885.txt', "There are no substances or mixtures present which are classified as hazardous.", "high"),
 ("Two Formlabs documents differ in tone on powder PPE. A Formlabs-commissioned study at its own Somerville SLS lab found airborne powder below 2 % of the OSHA limit and says no special PPE, respirators or goggles are required there. The support article for customers recommends a NIOSH respirator if local exhaust does not keep particulates below the ACGIH limit or irritation occurs, plus nitrile gloves and glasses. A studio should follow the stricter one.",
  "<2 % of OSHA PEL at Formlabs lab (vendor study)", 'https://formlabs.com/white-papers/safety-with-formlabs-sls-products-air-quality-and-dust-hazard-analysis/', D + 'formlabs-sls-airquality.html.txt', "no special personal protective equipment, respirators, or goggles are required at Formlabs facilities for operating the Fuse ecosystem.", "high"),
 ("Customer-facing powder guidance: wear a fitted NIOSH respirator if local exhaust does not hold particulate below the ACGIH TLV or if irritation occurs.",
  "respirator if exhaust inadequate", U_POWDER, D + 'powder-care.html.txt', "Wear a properly fitted respirator approved by NIOSH if local exhaust does not keep the particulate concentration below ACGIH Threshold Limit Value or irritation occurs.", "high"),
 ("Fuse 1+ 30W with nitrogen: if nitrogen escapes and displaces room oxygen it becomes a hazard (OSHA: below 19.5 % oxygen is immediately dangerous to life or health); Formlabs says install an oxygen monitor with alarm in the room. Relevant because Formlabs strongly recommends inert printing for Nylon 11.",
  "O2 monitor needed with nitrogen; <19.5 % O2 dangerous", U_SAFE_SLS, D + 'safety-sls.html.txt', "If nitrogen gas is released into the room containing the Fuse 1+ 30W and displaces the existing oxygen content there (roughly 21%), it may create a significant hazardous situation.", "high"),
 ("Keep humidity at or below 50 % RH around the Fuse, Fuse Sift and powder storage; unsintered powder has no defined shelf life when stored sealed, cool and dry.",
  "<=50 % RH", U_POWDER, D + 'powder-care.html.txt', "keep the relative humidity of the environment around the printer, the Fuse Sift and other post-processing tools, and anywhere unsintered powder is stored to 50% or less at all times", "high"),
 ("Skin-contact use changes the wash recipe: for Tough 1500 V1/V1.1, Formlabs says parts for skin contact 'must be washed with >=99 % IPA in a Form Wash/Form Wash L for 20 minutes' (the standard recipe is 10 + 10 min), and thick walls may need longer drying before post-cure because of IPA pooling. A visitor-touchable part needs the documented skin-contact workflow, not the quick one.",
  "skin-contact wash: >=99 % IPA, 20 min (Tough 1500 V1)", U_WASHT, D + 'wash-time.html.txt', "parts must be washed with ≥99% IPA in a Form Wash/Form Wash L for 20 minutes", "high"),
 ("Silicone 40A solvent hazard to the equipment: a Form Wash bucket used with n-butyl acetate must not be switched back to pure IPA because it 'risks compromising the integrity of the bucket plastic'; cracking or crazing means stop use and call Formlabs.",
  "dedicated n-butyl acetate bucket; crazing risk", U_WASHT, D + 'wash-time.html.txt', "Once a Form Wash bucket has been used with n-Butyl Acetate, do not switch to pure IPA.", "high"),
]
