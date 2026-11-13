"""Findings part 2: UV, moisture, creep, impact, shading standards, humidity-responsive evaluation, calculations."""
from quotes import Q
from content1 import F, EVS, ETA, FRTDS

TDS_T1500 = "https://formlabs-media.formlabs.com/datasheets/25011041-TDS-ENUS-0.pdf"
TDS_T2000 = "https://formlabs-media.formlabs.com/datasheets/251013-MS-TDS-Tough_2000_V2.pdf"
TDS_T1000 = "https://formlabs-media.formlabs.com/datasheets/25011071-TDS-ENUS-0.pdf"
TDS_F80 = "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf"
FLUV = "https://formlabs.com/white-papers/fuse-sls-powders-uv-resistance-aging-study/"
FLSUN = "https://formlabs.com/it/support/What-happens-to-prints-that-are-left-out-in-the-sun/"
CHENG = "https://doi.org/10.1038/s41467-024-54808-8"
RUG = "https://doi.org/10.1371/journal.pone.0120718"
PIL = "https://doi.org/10.3390/polym14122355"
EURAC = "https://www.eurac.edu/en/news/institute-for-renewable-energy/characterization-of-adaptive-opaque-facades"

FINDINGS_UV = [
    F("Standard: EN ISO 4892-2 exposes plastics to xenon-arc light with moisture to reproduce daylight (or daylight through window glass) weathering; EN ISO 4892-3 does the same with fluorescent UV lamps, heat and water. Neither sets pass/fail limits; 'specimen preparation and evaluation of the results are covered in other standards'.",
      "evs_4892_2", EVS + "evs-en-iso-4892-2-2013", "high"),
    F("EN ISO 4892-3 (fluorescent UV) scope.", "evs_4892_3", EVS + "evs-en-iso-4892-3-2016", "high"),
    F("ISO/TS 24110:2026, published 2026-04-21, describes exposing specimens to artificial UV radiation in combination with a creep load, using ISO 899-1 for the creep test. It is the first standard I found that couples UV and sustained load, which is the real condition of a hanging shading fin. Technical Specification, not a full standard; full text paywalled and unread.",
      "tn24110", "https://www.technickenormy.cz/en/iso-ts-24110-2026-plastics-method-of-exposure-to-combined-uv-radiation-and-creep-load/", "medium"),
    F("Cheng et al. 2024 (4D-printed cellulose-composite/ASA shading bilayers) exposed bilayers 'according to the DIN EN ISO 4892-2/-3 UV standard' for only 96 h at 60 C dry heat (4 days), then compared curvature at 30 % and 90 % RH with an unexposed control.",
      "cheng_uv2", CHENG, "high", "96 h, 60 C"),
    F("The restricting layer in that work, ASA, was chosen 'for its UV-resistant properties': the passive layer was picked for UV resistance, not only for stiffness.",
      "cheng_asa", CHENG, "high"),
    F("Formlabs published an accelerated-weathering study of Nylon 12 Powder and Nylon 12 Tough Powder: ASTM D4329-21 Cycle A, 1000 h, run by an independent lab, tensile bars printed on Fuse. The page is undated.",
      "fl_uv_std", FLUV, "high", "1000 h"),
    F("Result after 1000 h: Nylon 12 UTS 50.8 -> 48.9 MPa (-3.7 %), modulus 1832 -> 1764 MPa (-3.7 %), elongation 9.78 -> 8.13 % (-16.9 %); colour change dE00 0.60.",
      "fl_uv_n12", FLUV, "high", "-3.7 % / -3.7 % / -16.9 %"),
    F("Nylon 12 Tough after 1000 h: UTS 40.5 -> 38 MPa (-6.1 %), modulus 1399 -> 1402 MPa (+0.2 %), elongation 19.2 -> 16.4 % (-14.7 %); dE00 0.63.",
      "fl_uv_n12t", FLUV, "high"),
    F("Formlabs states its own pass rule: 'less than 10% change in modulus and strength, and less than 20% change in elongation', and admits 'there is no single universal standard' for acceptable property change. The 10/20 % rule is an industry habit, not a building-standard requirement.",
      "fl_uv_10", FLUV, "high"),
    F("DISAGREEMENT between sources on PA12 UV ageing. Formlabs (above): modulus -3.7 %, elongation -16.9 % after 1000 h D4329 with condensation cycles. Pilipovic et al. 2022 (EOS PA 2200 on an EOS Formiga P100, ISO 4892 solar box, 550 W/m2 300-800 nm, 65 C, no wetting, 1000 h): strain at break down 70-90 % in two orientations, and after natural weathering modulus 'reduced by almost half'. Different powder, machine, exposure and orientation; I cannot say which is right for a Fuse-printed part, and neither tested humidity-driven bending.",
      "pil_mod", PIL, "medium", "Formlabs -3.7 % modulus vs Pilipovic ~ -50 % modulus (natural weathering, 120 d)"),
    F("Pilipovic 2022 also says '1 h of laboratory testing in a UV chamber corresponds to 24 h of natural exposure' and so 1000 h = 2.8 years. Formlabs makes no such equivalence and its resin TDS warns that accelerated testing 'cannot fully represent all aging conditions'. The conversion factor is therefore contested and not a standard.",
      "pil_accel", PIL, "medium", "1 h = 24 h (Pilipovic) vs none (Formlabs)"),
    F("Earlier agent's line 'weathering lowered tensile modulus from 1.8 GPa to 1.2 GPa' (spec-resin-chemistry.json) is, in the Pilipovic text, the figure for the 50:50 MIXED original/recycled powder; for the 100 % original powder the paper says modulus fell by almost half only in two orientations after natural weathering. Correction of attribution, not of the direction of the effect.",
      "pil_mixed", PIL, "high"),
    F("Formlabs Tough 1500 Resin V2 TDS publishes outdoor ageing (ASTM D4329 Cycle A, to 1000 h), indoor ageing (ASTM D4459, xenon-arc through-glass) and heat ageing (ASTM D3045, 50 C, up to 6 weeks) as graphs of percent-of-initial elongation, modulus and strength. I could not read values off the graphs.",
      "t1500_out", TDS_T1500, "high"),
    F("The same TDS states: 'accelerated weathering testing cannot fully represent all aging conditions' and recommends additional outdoor testing for the specific application.",
      "t1500_cannot", TDS_T1500, "high"),
    F("A Formlabs staff reply (forum, 2026-07-23) says Tough 1500 V2 has indoor and outdoor ageing data in its TDS but that Tough 1000 has no ageing data. Of the three candidate resins in the earlier design, only Flexible 80A V2 has an indoor-ageing test; none of the resin TDS files I scanned has the Nylon-style numeric outdoor study.",
      "fl_forum2", "https://forum.formlabs.com/t/uv-stability-of-tough-1000-1500/46661", "medium"),
    F("Flexible 80A V2 (the swelling layer in the earlier bilayer design) has a TDS indoor-ageing test (ASTM D4459 Sec 7.2.2) and a heat-ageing test; it states 6 weeks at 50 C 'can be interpreted as approximately 1 year at ambient temperature'. I found no outdoor (D4329) test in that TDS.",
      "f80_heat", TDS_F80, "medium", "6 weeks at 50 C ~ 1 year (ASTM D3045 rule as quoted)"),
    F("Formlabs support page (Italian text, my translation): SLA parts 'become more brittle and change colour' from 405 nm light and the heat of sunlight, and parts for functional or load-bearing use 'must not be exposed to direct UV light for long periods'. This is the vendor's own caution for stock resins.",
      "fl_sun_it", FLSUN, "high"),
    F("UNRESOLVED: Formlabs describes ASTM D4329 Cycle A as 'Xenon arc' (powder white paper) but its resin TDS says samples were removed from 'QUV' (a fluorescent-UV chamber brand), and the parameters quoted (0.89 W/(m2.nm) at 340 nm, 8 h UV at 60 C black panel, 4 h condensation at 50 C) look like a fluorescent-UV cycle. I could not read the ASTM text (blocked), so which lamp type was used is NOT CONFIRMED.",
      "fl_uv_cycle", FLUV, "low"),
    F("Calculation (bm_calc.py): 1000 h of accelerated exposure is 83 twelve-hour cycles and is 0.23 % of a 50-year life counted in raw hours; the 96 h UV test in Cheng 2024 is 0.02 %. Any extrapolation to years needs an acceleration factor that no source here agrees on.",
      None, "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/bm_calc.py", "high", "1000/438000 h = 0.23 %"),
]

FINDINGS_MOISTURE = [
    F("EN ISO 62 gives procedures for water absorbed by plastic specimens 'when immersed in water or when subjected to humid air', and the through-thickness moisture diffusion coefficient 'can be determined' assuming Fickian diffusion (valid for homogeneous materials below Tg). This is the ready-made standard method for the diffusivity that earlier agents could not find for any Formlabs resin; nobody I found has run it on one.",
      "evs_62", EVS + "evs-en-iso-62-2008", "high"),
    F("EN ISO 62 also covers humid-air exposure, which is what a façade sees; the earlier agents' immersion-cube numbers (Formlabs 24 h, under 1 % mass) are not the humid-air quantity.",
      "evs_62b", EVS + "evs-en-iso-62-2008", "high"),
    F("ISO 483 describes small enclosures (under 200 dm3) holding constant relative humidity with saturated salt, glycerol/water or sulfuric acid solutions for conditioning and testing plastics: a desk-scale way to hold a coupon at a known RH without a climate chamber.",
      "evs_483", EVS + "evs-en-iso-483-2005", "high"),
    F("EN ISO 12571 gives hygroscopic sorption methods (desiccator reference method; climatic chamber) for 'porous building materials and products'; dense printed polymers are not porous, so fit is NOT CONFIRMED.",
      "evs_12571", EVS + "evs-en-iso-12571-2013", "medium"),
    F("EN ISO 12572 gives the cup test for water-vapour permeance/permeability of building products.",
      "evs_12572", EVS + "evs-en-iso-12572-2016", "high"),
    F("EN ISO 15148 gives the short-term liquid water absorption coefficient by partial immersion, to assess capillary uptake from rain on site.",
      "evs_15148", EVS + "evs-en-iso-15148-2003", "high"),
    F("EN ISO 10456's temperature and moisture conversion coefficients are valid for mean temperatures 0-30 C and design ambient temperatures -30 to +60 C (scope text), so it does not cover a dark façade element that can exceed 60 C (INFERENCE).",
      "evs_10456", EVS + "evs-en-iso-10456-2008", "medium"),
    F("EN ISO 13788 (condensation risk) is a simplified method that does not take account of 'the variation of material properties with moisture content', so it cannot model a material whose function is to change with moisture.",
      "evs_13788", EVS + "evs-en-iso-13788-2012", "high"),
    F("EN ISO 175 (chemical immersion of plastics) 'only considers testing by immersion of the entire surface' and says it may not suit partial or infrequent wetting.",
      "evs_175", EVS + "evs-en-iso-175-2010", "medium"),
    F("A real cladding assessment (ETA 20/0062 under EAD 090062-00-0404, a bonded aluminium-faced panel kit) lists these ageing tests: hygrothermal cycles, boiling water 6 h at 90 C, water immersion 500 h at 20 C, freeze-thaw cycles, 2500 h hot dry air at 80 C, UVB-and-water, humidity, salt spray, with pass rule delamination resistance above 75 % of initial value. The hygrothermal cycle parameters are not given in the ETA and I could not fetch the EAD text.",
      "eta_hyg", ETA, "high"),
    F("ETA 20/0062 durability programme includes freeze-thaw cycles.", "eta_ft", ETA, "high"),
    F("ETA acceptance criterion quoted for the aged panels.", "eta_75", ETA, "medium"),
]

FINDINGS_CREEP_IMPACT = [
    F("EN ISO 899-1 tensile creep: standard test specimens under set pretreatment, temperature and humidity; for engineering-design data the materials are 'intended to be tested over a broad range of stresses, times and environmental conditions' and extensometers are needed.",
      "evs_899_1b", EVS + "evs-en-iso-899-1-2017", "high"),
    F("EN ISO 899-2:2024 is the three-point flexural creep method; it is for rigid and semi-rigid plastics and may be unsuitable for some fibre-reinforced materials.",
      "evs_899_2", EVS + "evs-en-iso-899-2-2024", "high"),
    F("Formlabs creep data exist for three resins as graphs only: Tough 1500 V2 and Tough 2000 V2 at 22 C under 4.0 MPa, Tough 1000 at 22 C under 2.0 MPa, each over 14 days ('ISO 6602' as named by Formlabs; I could not confirm that standard's status). Creep strain values are in the graphs and I could not read them.",
      "t1500_creep", TDS_T1500, "high", "22 C, 4.0 MPa, 14 d"),
    F("Tough 1000 creep condition.", "t1000_creep", TDS_T1000, "high"),
    F("Flame Retardant Resin TDS reports tensile creep (ASTM D2990-17) at 65 C and 1.8 MPa, the only Formlabs creep test I found above room temperature; again a graph.",
      "fr_creep", FRTDS, "high", "65 C, 1.8 MPa"),
    F("DMA: Tough 1500 V2 has a storage-modulus inflection at 60.8 C and Tg 109.6 C; Tough 2000 V2 inflection 76.96 C, Tg 112.2 C. A sun-heated dark façade element can reach this range (INFERENCE; surface temperatures were not sourced), so 22 C creep data do not cover it.",
      "t1500_dma", TDS_T1500, "high", "60.8 C / 76.96 C inflection"),
    F("Tough 2000 V2 DMA.", "t2000_dma", TDS_T2000, "high"),
    F("Rueggeberg and Burgert 2015 loaded wooden humidity bilayers with 100 g and 150 g tip loads in a 9-month field test: 'creep with plastic deformation has been induced by this permanent mechanical loading' yet actuation amplitude hardly fell (calculated curvature loss under 3 %). The only sustained-load check on a humidity-responsive element I found.",
      "rug_creep2", RUG, "high"),
    F("Cheng 2024 clamped bilayers from the bottom and the top 'to evaluate the effect of self-weight on long-term actuation and potential creep' during 170 cycles; curvature stayed consistent after a slight loss in the first ten cycles.",
      "cheng_creepq", CHENG, "high"),
    F("Impact (material level): ISO 179-1 gives the Charpy impact strength of plastics, a comparison number, not a façade pass criterion.",
      "evs_179", EVS + "evs-en-iso-179-1-2010", "high"),
    F("Impact (element level): EN 14019 sets soft-body impact performance of curtain walling (tested to EN 13049) for areas facing human activity; EN 13830 is the curtain-walling product standard. Neither is written for fixed shading fins; applicability NOT CONFIRMED.",
      "evs_14019", EVS + "evs-en-14019-2016", "medium"),
    F("In the worked ETA, hard-body impacts are tested with 0.5, 1.0 and 3.0 kg balls at 1, 3 and 10 J and soft-body impacts at 10 J (3 kg bag) and 60, 300, 400 J (50 kg bag), and the result is expressed as a use category, e.g. category I 'a zone readily accessible at ground level to the public'. Table read from a layout-extracted PDF, so the energy-to-mass pairing is medium confidence.",
      "eta_hard", ETA, "medium", "hard 1/3/10 J; soft 10/60/300/400 J"),
    F("Use category I wording in the ETA.", "eta_use", ETA, "high"),
]

FINDINGS_SHADING = [
    F("EN 13561 (external blinds and awnings) lists 'brise-soleil' among covered products but states it 'does not cover the wind resistance of non-retractable products, e.g. Dutch awnings and brise-soleil'. So the product standard that names fixed louvres leaves their wind resistance to the structural route.",
      "evs_13561", EVS + "evs-en-13561-2015", "high"),
    F("EN 1991-1-4 (wind actions) covers 'elements attached to the structure, e.g. components, cladding units and their fixings'; this is the Eurocode route for wind loads on a shading fin and its fixings. UK National Annex not read.",
      "evs_1991", EVS + "evs-en-1991-1-4-2005", "high"),
    F("EN 1990 'establishes principles and requirements for the safety, serviceability and durability of structures'. Its design-working-life categories (10, 10-25, 15-30, 50, 100 years) appear only in a secondary web summary I read (Designing Buildings wiki), not in the standard; treat the numbers as unverified.",
      "evs_1990", EVS + "evs-en-1990-2002", "low"),
    F("EN 14501 classifies solar protection devices by thermal comfort (solar factor, secondary heat transfer, direct solar transmittance) and visual comfort; it is a performance label, not a durability test.",
      "evs_14501", EVS + "evs-en-14501-2021", "high"),
    F("EN 13659 covers shutters and external venetian blinds fitted to buildings.",
      "evs_13659", EVS + "evs-en-13659-2015", "medium"),
]

FINDINGS_HUMID = [
    F("NO STANDARD FOUND for humidity-responsive (hygromorphic) façade elements. A 2024 review of laboratory tests for adaptive opaque façades reports 'few laboratory tests' and 'notable differences in the set-up configurations and protocols'. That review concerns thermal performance; I read only the research centre's news summary, not the paper.",
      "eurac", EURAC, "medium"),
    F("How the published humidity-responsive work is evaluated (Cheng 2024): climate chamber at 10, 20 and 30 C with RH in 10 % steps from 15 to 95 %, 2 h per step, curvature from time-lapse images; a cyclic test 90 % RH for 120 min then 30 % RH for 240 min.",
      "cheng_matrix", CHENG, "high"),
    F("Same paper, cycle definition.", "cheng_cyc", CHENG, "high"),
    F("Calculation: 170 cycles of 6 h = 1020 h = 42.5 days; one RH cycle per day for 25 years is 9125 cycles, so 170 is 1.9 % of that (bm_calc.py). The authors report 170 cycles with consistent curvature at 30 % RH after a slight loss in the first ten at 90 % RH.",
      "cheng_170", CHENG, "high", "170 cycles = 1.9 % of 9125"),
    F("Temperature matters as much as humidity for the evaluation: at 30 C the bilayers had almost no curvature at the lowest RH while at 10 C they kept 0.011 /mm, so a humidity test at one temperature does not characterise the element.",
      "cheng_T", CHENG, "high"),
    F("Field evidence for wood bilayers: a 9-month outdoor test at ETH Zurich started July 2013.",
      "rug_field", RUG, "high"),
    F("Rueggeberg and Burgert note that mechanical load 'may cause creep in the viscoelastic wood elements with severe impact on the actuation capability', listing creep as a failure mode to test.",
      "rug_creep", RUG, "high"),
]
