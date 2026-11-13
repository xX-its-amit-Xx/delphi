"""Assemble D:/Users/ashenoy00000/delphi-work/agents2/bm-building-physics-standards.json
Run: python -I build_result.py   (re-checks every evidence quote against the saved sources first)
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf8")
from quotes import Q
from srcs import check
from content1 import FINDINGS_LAW, FINDINGS_FIRE, F, REG7, ADB, AD7, ADC, EU364, CPR, SBI, I1182, E13501, ETA, FRPAGE, FRTDS, EVS, SCHED2
from content2 import (FINDINGS_UV, FINDINGS_MOISTURE, FINDINGS_CREEP_IMPACT, FINDINGS_SHADING, FINDINGS_HUMID,
                      TDS_T1500, CHENG, RUG, PIL, EURAC, FLUV, FLSUN)
from content3 import FINDINGS_CALC, FINDINGS_VS_EARLIER, FINDINGS_APPLIC

OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-building-physics-standards.json"

# ---- 1. quote verification
bad = []
for name, (key, text) in Q.items():
    r = check(key, text)
    if r not in ("exact", "ligature") or len(text.split()) > 40:
        bad.append((name, r, len(text.split())))
if bad:
    print("QUOTE PROBLEMS", bad)
    sys.exit(1)

findings = (FINDINGS_LAW + FINDINGS_FIRE + FINDINGS_UV + FINDINGS_MOISTURE + FINDINGS_CREEP_IMPACT
            + FINDINGS_SHADING + FINDINGS_HUMID + FINDINGS_CALC + FINDINGS_VS_EARLIER + FINDINGS_APPLIC)
for f in findings:
    if f["evidence_quote"] and len(f["evidence_quote"].split()) > 40:
        raise SystemExit("long quote: " + f["claim"][:60])


def kc(claim, qname, source):
    return {"claim": claim, "source": source, "evidence_quote": Q[qname][1]}


key_claims = [
    kc("In England a 'relevant building' (a storey at least 18 m up, with dwellings, an institution or residential rooms) must use only Euroclass A2-s1,d0 or A1 materials in external walls and specified attachments, and the slats of a solar shading device are not exempt (only non-shading components are); shading devices up to 4.5 m above ground are outside the rule. This is the single hardest legal gate for a polymer shading element.",
       "reg7_3ha", REG7),
    kc("Euroclass classification (EN 13501-1) is made on the product in end use with large specimens (SBI: wings 495 x 1500 mm and (1000+t) x 1500 mm, at least 3 specimens), so a desk-scale print cannot be classified; Formlabs publishes only UL 94 (HB at 3 mm where a rating is given, which is 9 of 25 data sheets scanned; V-0 at 3 mm, V-1 at 2.5 mm, HB at 1.5 mm for Flame Retardant Resin), and UL 94 does not occur in Approved Document B.",
       "sbi_wing", SBI),
    kc("No standard exists for evaluating humidity-responsive façade elements; the published practice is a bespoke chamber protocol (Cheng 2024: 170 cycles of 90/30 % RH at 6 h per cycle, 96 h of ISO 4892 UV at 60 C, 10/20/30 C RH matrix). The nearest England-wide wording is Approved Document 7 para 1.27: residual properties of property-changing materials must be estimatable and adequate for the expected life.",
       "ad7_127", AD7),
    kc("For the earlier stock-Formlabs bilayer design, temperature is as large a driver as humidity: Formlabs-published CTEs differ by 114-127 um/m/C between Rigid 10K and Tough 1000, giving 0.45-0.51 % differential strain over 40 K versus the earlier agent's estimated 0.2 % hygroscopic strain (own calculation, bm_calc.py). Creep and ageing data from Formlabs exist only at 22 C or as unreadable graphs, while the DMA storage modulus of Tough 1500 V2 starts to fall at 60.8 C.",
       "t1500_dma", TDS_T1500),
]

# ---- table rows: name, fields, source
T = lambda name, fields, source: {"name": name, "fields": fields, "source": source}
table = [
    T("Building Regulations 2010 reg 7(1) materials and workmanship (England)", "status=REQUIREMENT; scope=all building work; test_named=none; wording=adequate and proper materials appropriate for circumstances", REG7),
    T("Building Regulations 2010 reg 7(2),(4) combustibility of external walls (England)", "status=REQUIREMENT; threshold_height=18 m storey; building_use=dwellings or institution or residential room; class=A2-s1,d0 or A1; applies_to=external wall and specified attachments", REG7),
    T("Reg 7(3)(ha) solar shading exemption", "status=REQUIREMENT; exempt=components associated with shading device; NOT_exempt=components whose primary function is to provide shade or deflect sunlight (curtain, slats)", REG7),
    T("Approved Document B vol 2 paras 12.15-12.20, Table 12.1", "status=GUIDANCE; shading_in_relevant_building=A1 or A2-s1,d0; shading_up_to_4.5 m=exempt; residential_over_11 m=A2-s1,d0 or better; other_route=BR 135 with BS 8414; national_classes=removed 2025", ADB),
    T("Approved Document 7 paras 1.17-1.27 (England)", "status=GUIDANCE; short_lived_materials=ok if inspectable, replaceable and low consequence; property-changing_materials=residual properties estimated at incorporation and adequate for expected life; tests=where no harmonised standard, UKAS-type accredited labs", AD7),
    T("Approved Document C requirement C2 (England)", "status=REQUIREMENT; protects_against=precipitation incl wind-driven spray, interstitial and surface condensation; cladding_route=impervious or weather-resisting cladding (para 5.7)", ADC),
    T("Building Regulations 2010 Schedule 2 Class 4 temporary buildings", "status=EXEMPTION; condition=not intended to remain over 28 days; applicability_to_shading_attachment=NOT CONFIRMED", SCHED2),
    T("EU Construction Products Regulation 305/2011 Arts 2, 4, 5 and Annex I", "status=EU LAW (UK retained version not read); product_definition=placed on market for permanent incorporation; DoP_derogation=one-off custom product in single identified work; working_life=economically reasonable, unspecified", CPR),
    T("Commission Delegated Regulation (EU) 2016/364 (Euroclass table)", "A2=PCS<=3.0 MJ/kg or ISO 1182 dT<=50 C dm<=50 % tf<=20 s plus SBI; B=FIGRA<=120 W/s THR600s<=7.5 MJ plus 30 s small flame; E=15 s small flame Fs<=150 mm in 20 s; s1=SMOGRA<=30 m2/s2 TSP<=50 m2; d0=no flaming droplets in SBI", EU364),
    T("EN 13823 SBI (as described by Efectis)", "wings=495x1500 and (1000+t)x1500 mm; specimens>=3; burner=30 kW; lab_turnaround=3-4 weeks; specimen=representative of end use", SBI),
    T("EN ISO 1182 non-combustibility (as described by Efectis)", "specimen=cylinder 45 mm dia x 50 mm; tests=5; furnace=about 750 C; A1 limits=dT<=30 C, no sustained flame, mass loss<=50 %", I1182),
    T("EN ISO 1716 gross heat of combustion", "specimen=small solid sample, bomb calorimeter; used_for=A1/A2 criterion PCS; desk_scale_possible=yes", EVS + "evs-en-iso-1716-2018"),
    T("EN ISO 11925-2 small flame ignitability", "scope=vertical specimen, direct small flame, zero irradiance; used_for=classes B-E; specimen_dimensions=not read", EVS + "evs-en-iso-11925-2-2020"),
    T("EN 13501-1 reaction to fire (Efectis leaflet)", "classes=A1,A2,B,C,D,E,F; E_only_needs=EN ISO 11925-2; classification_basis=product as placed on market or in end use", E13501),
    T("UL 94 Formlabs ratings (TDS)", "Rigid_10K=HB (3 mm); Tough_1000/1500/2000=HB post-cured; Nylon_12/11/12GF/12Tough/12White=HB (3 mm); Flame_Retardant=V-0 3 mm, V-1 2.5 mm, HB 1.5 mm; in_ADB=no", FRTDS),
    T("ETA 20/0062 (EAD 090062-00-0404) fire entries", "kit_class=worst component; facade_fire_performance=No performance determined; reference_fire_scenario=none laid down for facades", ETA),
    T("EN ISO 4892-1/-2/-3 laboratory weathering of plastics", "-2=xenon arc with moisture; -3=fluorescent UV, heat, water; pass_fail=none in standard; used_by=Cheng 2024 (96 h, 60 C dry)", EVS + "evs-en-iso-4892-2-2013"),
    T("ISO/TS 24110:2026 UV plus creep load", "published=2026-04-21; method=UV exposure with ISO 899-1 tensile creep; UV_source=ISO 4892-3 fluorescent lamps or UVC; status=technical specification", "https://www.technickenormy.cz/en/iso-ts-24110-2026-plastics-method-of-exposure-to-combined-uv-radiation-and-creep-load/"),
    T("Formlabs Nylon 12 / Nylon 12 Tough 1000 h ASTM D4329-21 Cycle A", "N12 UTS=-3.7 %; N12 modulus=-3.7 %; N12 elongation=-16.9 %; N12T UTS=-6.1 %; N12T modulus=+0.2 %; N12T elongation=-14.7 %; dE00=0.60/0.63; dimension=within +/-0.5 %", FLUV),
    T("Pilipovic 2022 PA 2200 SLS ageing", "exposure=1000 h solar box 550 W/m2 65 C no wetting; strain_at_break=-70 to -90 % (Lxy,Pxy); modulus=about -50 % after natural weathering 120 d; mixed 50:50 powder modulus=1.8 to 1.2 GPa", PIL),
    T("Formlabs Tough 1500 V2 TDS ageing, creep, DMA", "outdoor=ASTM D4329 Cycle A to 1000 h (graph); indoor=ASTM D4459 (graph); heat=ASTM D3045 50 C to 6 weeks (graph); creep=22 C 4.0 MPa 14 d (graph); Tg=109.6 C; storage_modulus_inflection=60.8 C; CTE_0-150C=116/99 um/m/C", TDS_T1500),
    T("Formlabs creep and DMA other materials", "Tough_2000_V2 creep=22 C 4.0 MPa 14 d; DMA inflection=76.96 C; Tg=112.2 C | Tough_1000 creep=22 C 2.0 MPa 14 d; Tg=106.6 C | Flame_Retardant creep=65 C 1.8 MPa (ASTM D2990-17)", "https://formlabs-media.formlabs.com/datasheets/251013-MS-TDS-Tough_2000_V2.pdf"),
    T("EN ISO 62 water absorption of plastics", "immersion=yes; humid_air=yes; diffusion_coefficient=yes (Fickian, through thickness); formlabs_resin_result=none found", EVS + "evs-en-iso-62-2008"),
    T("ISO 483 constant-RH enclosures", "volume<200 dm3; solutions=saturated salts, glycerol/water, sulfuric acid/water; use=conditioning and testing plastics", EVS + "evs-en-iso-483-2005"),
    T("EN ISO 12571 / 12572 / 15148 / 10456 / 13788 hygrothermal set", "12571=sorption of porous building materials; 12572=vapour cup test; 15148=liquid water partial immersion; 10456=design values valid -30 to +60 C ambient; 13788=condensation, ignores property change with moisture", EVS + "evs-en-iso-12572-2016"),
    T("EN ISO 899-1 tensile creep / 899-2:2024 flexural creep", "899-1=dumb-bell, extensometer for design data, broad stress-time-environment range; 899-2=three-point load; Formlabs name for its test=ISO 6602 (status not confirmed)", EVS + "evs-en-iso-899-1-2017"),
    T("Impact: ISO 179-1, EN 14019, EN 13830, ETA hard/soft body", "ISO 179-1=Charpy material strength; EN 14019=curtain walling soft body; ETA hard=1/3/10 J (0.5/1.0/3.0 kg); ETA soft=10/60/300/400 J (3/50 kg); category I=ground-level public zone", ETA),
    T("Shading and wind: EN 13561, 13659, 14501, 1991-1-4, 1990", "13561=covers brise-soleil but not their wind resistance; 1991-1-4=wind on cladding units and fixings; 14501=comfort classification; 1990=durability principles, working-life categories only in secondary source", EVS + "evs-en-13561-2015"),
    T("Cheng 2024 humidity-response test protocol", "RH_matrix=15-95 % in 10 % steps, 2 h each, at 10/20/30 C; cycle=90 % RH 120 min then 30 % RH 240 min; cycles=170 (1020 h); UV=ISO 4892-2/-3, 96 h, 60 C dry; creep=bottom- vs top-supported", CHENG),
    T("Rueggeberg and Burgert 2015 wood bilayer field test", "field_test=9 months from July 2013; tip_loads=100 g and 150 g; curvature_loss_calculated<3 %; permanent_deflection=yes", RUG),
    T("Own calculation: thermal vs hygroscopic differential strain", "pair=Rigid 10K / Tough 1000; delta_CTE=113.6-127.2 um/m/C; dT=40 K (assumed); thermal_strain=0.454-0.509 %; earlier_hygro_estimate=0.2 % (24 h); kappa_opt_h1mm=0.0068-0.0076 /mm", "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/bm_calc.py"),
    T("APPLICABILITY desk-scale demonstrator", "escapes=Building Regs, CPR/DoP, SBI classification, wind and impact categories, working life; still_do=small-coupon tests, state UL 94 and untested items; status=RECOMMENDATION", "see findings"),
    T("APPLICABILITY installation or pavilion", "gates=reg 7 if attached to a building, Schedule 2 28-day exemption, venue fire risk assessment, EN 1991-1-4 wind; status=NOT CONFIRMED", "see findings"),
    T("APPLICABILITY product", "needs=EN 13501-1 class on mounted element, durability programme like ETA (>75 % retention), impact category, wind design, declared working life, UK conformity route; status=RECOMMENDATION", "see findings"),
]

summary = (
    "What a polymer shading or cladding element has to pass, and what a desk-scale proof of concept can skip, in England. "
    "Law: Regulation 7(1) needs 'adequate and proper materials'; for buildings with a storey at 18 m or more containing dwellings, institutions or residential rooms, "
    "Regulation 7(2) needs Euroclass A2-s1,d0 or A1 for everything in external walls and attachments, and Approved Document B applies that to shading slats above 4.5 m. "
    "Approved Document 7 para 1.27 is the nearest wording for a humidity-responsive material: residual properties must be estimable and adequate for the expected life. "
    "Fire: Euroclass needs large end-use specimens (SBI wings 1.5 m tall, 3 specimens); a desk print cannot be classified. Formlabs publishes only UL 94 (HB at 3 mm for the 9 of 25 data sheets scanned that give a rating; V-0 at 3 mm only for Flame Retardant Resin, falling to HB at 1.5 mm), and UL 94 is not in Approved Document B. "
    "Ageing: no standard sets pass marks; the practice is ISO 4892 xenon or UV exposure (Cheng 2024: 96 h; Formlabs nylon: 1000 h, within 4-6 % in strength, elongation down 15-17 %), with one conflicting source (Pilipovic 2022: modulus roughly halved on PA 2200). "
    "Humidity-responsive elements have no standard; the literature uses climate-chamber RH cycling (170 cycles in 1020 h) across several temperatures. "
    "New beyond earlier agents: Formlabs does publish ageing and creep graphs for some resins (values unreadable); EN ISO 62 is the method for the missing water diffusivity; and the CTE gap between Rigid 10K and Tough 1000 gives a thermal differential strain (0.45-0.51 % over 40 K) larger than the estimated 0.2 % hygroscopic strain. "
    "Requirement, recommendation and unknown are tagged in each finding. Scotland, Northern Ireland, UKCA marking, BS 8414 and the fire safety order were not researched."
)

lay_summary = (
    "A building part has to survive fire, sun, rain, heat and years of use, and the rules are strict mostly for tall homes. "
    "In England, on a building 18 metres or higher where people sleep, shading slats must be close to non-burning, which ordinary printed plastic is very unlikely to be. "
    "A small printed model on a desk is not a building part, so those rules do not apply to it, but it still should not claim to be fire-safe or weatherproof. "
    "Nobody has written a test standard for a panel that bends when the air gets damp; researchers invent their own, such as 170 damp-and-dry cycles in a chamber. "
    "We also found a trap: warming the same two-plastic strip can bend it more than the damp air does, like a metal-and-brass thermostat strip. "
    "So the first honest experiment is to measure damp and heat effects separately."
)

glossary = [
    {"term": "Euroclass", "plain": "The European A1 to F grade for how much a building product helps a fire grow; A1 is best."},
    {"term": "A2-s1,d0", "plain": "Almost non-burning (A2), very little smoke (s1) and no burning drips (d0)."},
    {"term": "SBI test", "plain": "A fire test where a two-wall corner of the product, about 1.5 m tall, is burned and the heat and smoke are measured."},
    {"term": "UL 94", "plain": "A small-flame plastics test (HB, V-2, V-1, V-0) from the electronics world; it is not a building grade."},
    {"term": "Approved Document", "plain": "UK government guidance on how to meet the Building Regulations; following it is accepted as compliance but is not the only way."},
    {"term": "relevant building", "plain": "In England, a building with a storey at least 18 m up that contains homes, an institution or residential rooms."},
    {"term": "specified attachment", "plain": "A part fixed to an outer wall, such as a balcony, solar panel or shading device, that follows the same fire rule as the wall."},
    {"term": "hygromorph", "plain": "A material that changes shape when the air humidity changes, like a pine cone scale."},
    {"term": "bilayer", "plain": "Two layers stuck together that expand by different amounts, so the strip bends."},
    {"term": "relative humidity (RH)", "plain": "How damp the air is, as a percentage of the most water it could hold at that temperature."},
    {"term": "creep", "plain": "Slow sagging of a plastic under a steady load."},
    {"term": "glass transition (Tg), DMA", "plain": "The temperature range where a hard plastic turns rubbery; DMA is the test that shows it."},
    {"term": "CTE", "plain": "Coefficient of thermal expansion: how much a material grows per degree of warming."},
    {"term": "ISO 4892", "plain": "A family of lab methods that age plastics with lamps, heat and water spray to imitate sunlight and rain."},
    {"term": "diffusion coefficient", "plain": "How fast water soaks into a material."},
    {"term": "TDS", "plain": "Technical data sheet: the maker's own table of test results."},
    {"term": "ETA / EAD", "plain": "European Technical Assessment and the assessment document it follows; a route to approve a product that has no standard."},
    {"term": "UKCA / CE marking", "plain": "Labels showing a product meets the legal route for being sold for building use in the UK or EU."},
]

recommendations = [
    "State the fire position on every PoC label: not Euroclass tested; UL 94 HB at 3 mm for stock resins and nylon, V-0 only for Flame Retardant Resin at 3 mm and not at flap thickness.",
    "Run EN ISO 62 on the chosen layer resins in immersion and humid air, at one fixed temperature, to get the water diffusion coefficient no earlier agent found.",
    "Add a dry thermal-only control (ramp 20 to 60 C) to the humidity test of any stock-resin bilayer; use the measured differential CTE, not water uptake alone, to choose the passive layer.",
    "Use the Cheng 2024 protocol as a floor (90/30 % RH, 6 h cycle, 170 cycles, three temperatures, 96 h ISO 4892 UV) and report curvature drift per cycle; extend to 1000 h UV (Formlabs precedent) before claiming outdoor use.",
    "Test creep of the actual bilayer under its own weight at 22 C and at a temperature near the DMA inflection (about 60 C for Tough 1500 V2); do not rely on the 22 C Formlabs curves.",
    "Screen small printed cylinders with ISO 1182 and ISO 1716 if a non-combustible claim is ever considered, labelled as screening. If the aim is a building product, plan for a mineral-filled or inorganic design or limit use to heights up to 4.5 m or non-relevant buildings, and confirm with building control.",
    "Before any installation, ask building control and a fire engineer which gate applies (Regulation 7, Schedule 2 28-day exemption, venue fire risk assessment); this report cannot settle it.",
    "Get the paywalled texts (ISO 7892, ASTM D4329/D4459/D3045/D2990, EAD 090062-01-0404, BR 135, BS 8414) before quoting them to the partner.",
]

reproduce = [
    {"what": "Re-download every source file (73+ files, about 42 MB) into D:/Users/ashenoy00000/delphi-work/data/bm-bps",
     "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/fetch_all.sh   (curl, generic User-Agent 'delphi-research/0.1'; ISO.org, ASTM.org and ANSI return 403 and are not used)",
     "expected": "HTTP 200 for each; sha256 prefixes in the script comments match unless a live web page has changed. Ignore EAD pdf (not downloadable)."},
    {"what": "Derive the plain-text copies used for quote checking",
     "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/make_texts.py   (Python 3.14; poppler-style pdftotext 4.00 on PATH)",
     "expected": "writes cheng.txt, PMC4383548.txt, PMC9227374.txt, eurlex364.txt, cpr305.txt"},
    {"what": "Check every evidence_quote against the saved sources",
     "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/check_quotes.py",
     "expected": "'checked 137 problems 4'; the 4 are 'ligature' matches where PDF extraction drops the fi/fl ligature (fire, defined, flash-over), not real mismatches"},
    {"what": "Recompute the ceiling check, thermal vs hygroscopic strain and test-duration arithmetic",
     "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/bm_calc.py",
     "expected": "grid max f = 1.5 at m^2 n = 1; delta CTE 113.6 to 127.2 um/m/C; thermal strain 0.454 % to 0.509 % at dT = 40 K; Cheng 170 cycles = 1020 h = 42.5 days; 1000 h = 0.23 % of 50 years"},
    {"what": "Confirm the absence claim for UL 94 in Approved Document B volume 2",
     "command_or_url": "pdftotext D:/Users/ashenoy00000/delphi-work/data/bm-bps/ADB2.pdf - | grep -c -i 'UL 94'",
     "expected": "0"},
    {"what": "Read the legal text directly",
     "command_or_url": "https://www.legislation.gov.uk/uksi/2010/2214/regulation/7 (look for paragraph (3)(ha)); ADB vol 2 paras 12.15-12.20 at https://assets.publishing.service.gov.uk/media/6aa3bb7492e72b8ac437f145/AD_B2_2026.pdf",
     "expected": "(ha) text and 4.5 m exemption as quoted"},
    {"what": "Rebuild this JSON",
     "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/build_result.py",
     "expected": "writes D:/Users/ashenoy00000/delphi-work/agents2/bm-building-physics-standards.json"},
    {"what": "Verify the three literature DOIs",
     "command_or_url": "https://api.crossref.org/works/10.1038/s41467-024-54808-8 ; /10.1371/journal.pone.0120718 ; /10.3390/polym14122355 ; /10.1016/j.buildenv.2023.111123",
     "expected": "each returns the title given in citations (Crossref may rate-limit with HTTP 429; retry later)"},
]

citations = [
    {"authors": "Cheng T, Tahouni Y, Sahin ES, Ulrich K, Lajewski S, Bonten C, Wood D, Ruhe J, Speck T, Menges A", "year": 2024,
     "title": "Weather-responsive adaptive shading through biobased and bioinspired hygromorphic 4D-printing", "venue": "Nature Communications",
     "doi_or_arxiv": "10.1038/s41467-024-54808-8", "verified": True,
     "how_verified": "https://api.crossref.org/works/10.1038/s41467-024-54808-8 returned the record on 2026-11-12; full text read via Europe PMC PMC11604995",
     "used_for": "Test protocol for humidity-responsive elements: RH matrix, 170 cycles, UV per ISO 4892-2/-3, creep clamping"},
    {"authors": "Rueggeberg M, Burgert I", "year": 2015, "title": "Bio-inspired wooden actuators for large scale applications", "venue": "PLOS ONE",
     "doi_or_arxiv": "10.1371/journal.pone.0120718", "verified": True,
     "how_verified": "https://api.crossref.org/works/10.1371/journal.pone.0120718 returned the record on 2026-11-12; full text read via Europe PMC PMC4383548",
     "used_for": "Field test and creep under tip load for wooden humidity bilayers"},
    {"authors": "Pilipovic A, Ilincic P, Bakic A, Kodvanj J", "year": 2022,
     "title": "Influence of Atmospheric Conditions on Mechanical Properties of Polyamide with Different Content of Recycled Material in Selective Laser Sintering",
     "venue": "Polymers", "doi_or_arxiv": "10.3390/polym14122355", "verified": True,
     "how_verified": "https://api.crossref.org/works/10.3390/polym14122355 returned the record on 2026-11-12; full text read via Europe PMC PMC9227374",
     "used_for": "Conflicting PA12 UV and weathering numbers versus the Formlabs powder study"},
    {"authors": "Juaristi M et al.", "year": 2024,
     "title": "Review of adaptive opaque facades and laboratory tests for the dynamic thermal performance characterization", "venue": "Building and Environment",
     "doi_or_arxiv": "10.1016/j.buildenv.2023.111123", "verified": True,
     "how_verified": "https://api.crossref.org/works/10.1016/j.buildenv.2023.111123 returned the record on 2026-11-12. Only the Eurac Research news summary of this paper was read, not the paper",
     "used_for": "Statement that few laboratory protocols exist for adaptive opaque facades (thermal performance)"},
]

could_not_find = [
    "ISO.org, ASTM.org and ANSI webstore returned HTTP 403 to every fetch: the text of ISO 7892, ASTM D4329, D4459, D3045, D2990, D256, G154, G155 and the ISO 4892 clauses was not read. Scope statements came from the Estonian standards body (evs.ee), a Czech reseller, Efectis and Formlabs documents.",
    "EAD 090062-00-0404 / 090062-01-0404 text (kits for external wall claddings): connection reset on the only copy found. Hygrothermal-cycle parameters (temperatures, humidity, number of cycles) and the exact impact test procedure are therefore not stated; only the list of tests and acceptance wording from one ETA.",
    "BR 135, BS 8414-1/-2, ISO 7892 numbers, EN 13823 clause text and EN ISO 11925-2 specimen size: paywalled or not fetched.",
    "UK conformity route for products (Construction Products Regulations 2013 as retained, UKCA marking, BBA): not read. Scotland, Wales (Welsh Regulation 7 differs) and Northern Ireland rules not researched; the Regulatory Reform (Fire Safety) Order 2005 and event/venue fire safety not researched.",
    "EN 1990 Table 2.1 design working life values from a primary source: only a secondary web summary was seen (low confidence); the UK National Annex was not read.",
    "Any EN 13501-1 class for any Formlabs resin or powder, for the architecture practice's PLA modules, or for any printed hygromorph.",
    "A primary polymer heat-of-combustion table (FAA report server returned 503, rosap returned 403), so no number to compare against the 3.0 MJ/kg A2 limit; the statement that organic printable polymers cannot reach A2 is reasoning, not a measured result.",
    "Values from the Formlabs ageing, creep and DMA graphs (percent-of-initial curves, creep strain after 14 days) are figures; I could not read numbers off them.",
    "Formlabs CTE units and which column is green or post-cured; the micro sign was lost in text extraction.",
    "Whether Formlabs' ASTM D4329 test used xenon-arc or fluorescent UV (their documents disagree); the date of the Formlabs nylon weathering white paper.",
    "ISO 6602 (the standard Formlabs names for its flexural creep test): status not confirmed; ISO 899-2:2024 is the current flexural creep standard per the Estonian standards board listing.",
    "Surface temperatures reached by dark polymer façade elements in UK sun (no sourced figure); the 60 C and 40 K ranges in calculations are assumptions.",
    "Juaristi et al. 2024 full text and the 'Structural characterisation of adaptive facades in Europe, Part II' paper: only secondary summaries were seen. No cycle-count or pass-fail standard for actuated or humidity-responsive façade elements was found, which is an absence in my search, not proof none exists.",
    "A humid-air water uptake or hygroscopic expansion measurement for any Formlabs resin or powder, still absent after this run (as in earlier agents).",
]

scripts_written = [
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/bm_calc.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/srcs.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/quotes.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/check_quotes.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/content1.py (and content2.py, content3.py)",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/build_result.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/make_texts.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/make_manifest.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/make_fetch_script.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/fetch_all.sh",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/evs_scope.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/crossref_search.py",
    "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/epmc_search.py",
    "Data manifest (url, date, bytes, sha256 for every kept file): D:/Users/ashenoy00000/delphi-work/data/bm-bps/MANIFEST.json",
]

result = {
    "label": "bm-building-physics-standards",
    "topic": "What a building element must pass: moisture, fire, durability, tests (polymer shading or cladding, England-focused)",
    "summary": summary,
    "lay_summary": lay_summary,
    "findings": findings,
    "key_claims": key_claims,
    "reproduce": reproduce,
    "citations": citations,
    "could_not_find": could_not_find,
    "table": table,
    "glossary": glossary,
    "recommendations": recommendations,
    "scripts_written": scripts_written,
}
json.dump(result, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
back = json.load(open(OUT, encoding="utf8"))
print("wrote", OUT, len(back["findings"]), "findings", len(back["table"]), "table rows", os.path.getsize(OUT), "bytes")
