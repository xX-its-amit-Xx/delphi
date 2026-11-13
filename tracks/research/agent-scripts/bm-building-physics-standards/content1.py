"""Findings part 1: law and fire. Tags in the claim text: REQUIREMENT / GUIDANCE / INFERENCE / NOT CONFIRMED."""
from quotes import Q

REG7 = "https://www.legislation.gov.uk/uksi/2010/2214/regulation/7"
SCHED2 = "https://www.legislation.gov.uk/uksi/2010/2214/schedule/2"
ADB = "https://assets.publishing.service.gov.uk/media/6aa3bb7492e72b8ac437f145/AD_B2_2026.pdf"
AD7 = "https://assets.publishing.service.gov.uk/media/5cf8d74fe5274a5f115e8778/AD_Regulation_7.pdf"
ADC = "https://assets.publishing.service.gov.uk/media/5a8192a0e5274a2e8ab54b5f/BR_PDF_AD_C_2013.pdf"
EU364 = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0364"
CPR = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32011R0305"
SBI = "https://efectis.com/app/uploads/2026/06/SBI_test_13823_2020A1_2022.pdf"
I1182 = "https://efectis.com/app/uploads/2021/06/Non_combustibility_ISO_1182_2020.pdf"
E13501 = "https://efectis.com/app/uploads/2020/10/Folder_13501_1_2018.pdf"
ETA = "https://itecons.uc.pt/attachments/117"
FRPAGE = "https://formlabs.com/store/materials/flame-retardant-resin/"
FRTDS = "https://formlabs-media.formlabs.com/datasheets/2301750-TDS-ENUS-0_1.pdf"
EVS = "https://www.evs.ee/en/"


def F(claim, qname=None, url="", conf="high", value=None):
    d = {"claim": claim, "source": url, "confidence": conf}
    if qname:
        d["evidence_quote"] = Q[qname][1]
    else:
        d["evidence_quote"] = ""
    if value is not None:
        d["value"] = value
    return d


FINDINGS_LAW = [
    F("REQUIREMENT (England): building work must use 'adequate and proper materials' appropriate for the circumstances of use. This is the only durability-type duty that applies to every building element regardless of height; it names no test.",
      "reg7_1", REG7, "high"),
    F("REQUIREMENT (England): in a 'relevant building' every material that becomes part of an external wall or a specified attachment must be Euroclass A2-s1,d0 or A1.",
      "reg7_2", REG7, "high", "A2-s1,d0 or A1"),
    F("REQUIREMENT (England): a 'relevant building' has a storey at least 18 m above ground level and contains dwellings, an institution or a room for residential purposes.",
      "reg7_4", REG7, "high", "18 m"),
    F("REQUIREMENT (England): the Regulation 7(3)(ha) exemption for solar-shading components explicitly excludes the parts whose job is to give shade, so slats and fins of a shading device are NOT exempt from the A2-s1,d0 rule.",
      "reg7_3ha", REG7, "high"),
    F("GUIDANCE (Approved Document B vol 2): in a relevant building the curtain and/or slats of a solar shading device must achieve class A1 or A2-s1,d0.",
      "adb_12_19", ADB, "high"),
    F("GUIDANCE (Approved Document B vol 2): solar shading devices installed up to 4.5 m above ground level are not required to meet Regulation 7(2). So a low shading element on a tall residential building is outside the A2-s1,d0 rule, but is not thereby outside all fire guidance.",
      "adb_12_20", ADB, "high", "4.5 m"),
    F("GUIDANCE: ADB says the 'specified attachment' definition includes solar shading.",
      "adb_12_16", ADB, "high"),
    F("GUIDANCE (ADB Table 12.1): for relevant buildings the external-surface class is A2-s1,d0 or better at any distance from the boundary; for other residential buildings over 11 m it is also A2-s1,d0 or better. Other building types get B-s3,d2 or C-s3,d2 depending on height and boundary distance. I could not confirm from the text whether Table 12.1 (written for 'external surfaces of external walls') is meant to apply to a free-standing shading device on a building under 18 m.",
      "adb_t121_res", ADB, "medium"),
    F("GUIDANCE: for buildings that are not relevant buildings, ADB offers a second route: meet BRE report BR 135 using full-scale BS 8414-1/-2 test data. I did not read BR 135 or BS 8414.",
      "adb_12_3b", ADB, "high"),
    F("GUIDANCE: ADB no longer uses national classes (the 2025 amendments removed them), and says a product cannot assume a European class unless it has been tested accordingly.",
      "adb_nat", ADB, "high"),
    F("GUIDANCE (Approved Document 7): 'materials that are susceptible to changes in their properties' are allowed if the residual properties can be estimated at the time of incorporation and are shown adequate for the expected life of the building. This is the closest England-wide wording to a humidity-responsive material, and it demands a predicted end-of-life property estimate.",
      "ad7_127", AD7, "high"),
    F("GUIDANCE (Approved Document 7): the second condition is that residual properties are shown adequate for the building to perform its function for the expected life of the building.",
      "ad7_127b", AD7, "high"),
    F("GUIDANCE (Approved Document 7): a short-lived material that can be inspected and replaced may be acceptable if failure would not seriously endanger people. This is the legitimate route for a replaceable, low-consequence shading element.",
      "ad7_123", AD7, "high"),
    F("GUIDANCE (Approved Document 7): where no harmonised European standard exists, tests, calculations or other means may demonstrate fitness, and past experience in an existing building may also show it. Test labs accredited by UKAS or equivalent are the stated way to make tests reliable.",
      "ad7_117", AD7, "high"),
    F("REQUIREMENT (England, Part C, C2): walls must protect the building and its users from harmful effects of precipitation including wind-driven spray, and interstitial and surface condensation. ADB-C paragraph 5.7 allows an 'impervious or weather-resisting cladding' as one way to do it. A shading fin hung outside a weatherproof wall is not itself the rain barrier (my inference); a cladding panel is.",
      "adc_c2b", ADC, "high"),
    F("GUIDANCE/EXEMPTION (England): Schedule 2 of the Building Regulations 2010 lists 'Temporary buildings', buildings not intended to remain where erected for more than 28 days, as an exempt class. Whether a shading attachment to an existing building counts as a temporary building is NOT CONFIRMED.",
      "sched2_c4", SCHED2, "medium"),
    F("INFERENCE: Approved Document 7 defines 'building work' as erection or extension of a building, provision of a controlled service or fitting, or material alteration. A desk-scale printed demonstrator that is not installed on a building is not building work and so sits outside the Building Regulations altogether.",
      "ad7_3", AD7, "medium"),
    F("INFERENCE: the Construction Products Regulation defines a construction product as one placed on the market for incorporation in a permanent manner in construction works. A desk-scale object that is never sold for installation is outside it; a product offered to an architecture practice for a façade would be inside it. I read the EU text; the retained UK version (and UKCA marking) was NOT read.",
      "cpr_a2_1", CPR, "medium"),
    F("REQUIREMENT (EU CPR Art 5(a)): where a product is covered by a harmonised standard, the manufacturer may skip the declaration of performance for a one-off, custom-made, non-series product installed in a single identified work, but the manufacturer stays responsible for safe incorporation under national rules. This does not remove national requirements such as Regulation 7.",
      "cpr_a5a", CPR, "high"),
    F("REQUIREMENT (EU CPR Annex I): construction works must meet the basic requirements, which include limiting the generation and spread of fire and smoke, 'for an economically reasonable working life', subject to normal maintenance. The Regulation does not give a number of years.",
      "cpr_annex1", CPR, "high"),
]

FINDINGS_FIRE = [
    F("REQUIREMENT (EU classification regulation 2016/364): reaction to fire is classified A1, A2, B, C, D, E, F, with smoke s1-s3 and droplets d0-d2 added. Class A2 needs either a non-combustibility result (ISO 1182: furnace temperature rise at most 50 C, mass loss at most 50 %, flaming at most 20 s) or a gross heat of combustion (ISO 1716) of at most 3.0 MJ/kg for the product, AND an SBI test.",
      "eu364_a2", EU364, "high", "PCS <= 3.0 MJ/kg (homogeneous product or substantial component; 4.0 MJ/m2 for non-substantial layers)"),
    F("Class B needs an SBI result with FIGRA at most 120 W/s and total heat release (600 s) at most 7.5 MJ, plus a small-flame test.",
      "eu364_b", EU364, "high"),
    F("Class E needs only the small-flame test EN ISO 11925-2 (15 s exposure, flame spread at most 150 mm within 20 s).",
      "eu364_e", EU364, "high"),
    F("Smoke classes: s1 = SMOGRA at most 30 m2/s2 and TSP600s at most 50 m2; s2 = at most 180 and 200; s3 = otherwise.",
      "eu364_smoke", EU364, "high"),
    F("Droplet classes: d0 = no flaming droplets/particles in the SBI within 600 s; d1 = none persisting over 10 s; d2 = otherwise. Ignition of the paper in the small-flame test gives d2.",
      "eu364_drop", EU364, "high"),
    F("EN 13501-1 is the classification procedure for all construction products, 'considered in relation to their end use application'.",
      "evs_13501", EVS + "evs-en-13501-1-2019", "high"),
    F("Test-house description of class E: such products 'may quickly lead to a flash-over situation, possibly within the first two minutes' of the reference scenario.",
      "e13501_e", E13501, "high"),
    F("The SBI (EN 13823) test needs a corner of two wings: long wing 495 mm x 1500 mm and a short wing of (1000 + product thickness) mm x 1500 mm, and at least 3 specimens, under a 30 kW burner. A desk-scale printed object cannot be classified with it.",
      "sbi_wing", SBI, "high", "495 x 1500 mm and (1000+t) x 1500 mm; >= 3 specimens"),
    F("The SBI specimens 'shall be representative of the product as placed in the market or in its end-use application, including both vertical and horizontal joints'.",
      "sbi_rep", SBI, "high"),
    F("At one accredited lab the SBI report takes about 3-4 weeks after the specimens arrive. This is a lab statement, not a standard.",
      "sbi_wk", SBI, "medium"),
    F("ISO 1182 non-combustibility uses small cylinders 45 mm diameter x 50 mm high, five parallel tests. These fit inside a Form 4 build, so a printed coupon CAN legitimately be screened for A1/A2 non-combustibility at desk scale (RECOMMENDATION; the result would not be a classification).",
      "i1182_dim", I1182, "high", "45 mm x 50 mm cylinder; 5 tests"),
    F("ISO 1716 (bomb calorimeter, gross heat of combustion) is 'intended to be applied to solid products' and needs only a small sample, so it is the other desk-scale fire screen. I could not fetch a verified polymer value to compare with the 3.0 MJ/kg A2 limit (FAA report server returned 503).",
      None, EVS + "evs-en-iso-1716-2018", "medium"),
    F("A European façade reference fire scenario does not exist; in a worked European Technical Assessment (ETA 20/0062, EAD 090062-00-0404) 'Façade fire performance' is 'No performance determined' and the kit is classed by its worst component. National façade fire tests (for England, BS 8414/BR 135) sit on top of component classes.",
      "eta_scen", ETA, "high"),
    F("In that ETA the reaction to fire of the kit is assessed from the components of the kit.",
      "eta_fire", ETA, "high"),
    F("ABSENCE (verified by search of the saved file): the string 'UL 94' / 'UL94' does not occur in the Approved Document B volume 2 text I downloaded (0 matches). UL 94 is the only flammability rating Formlabs publishes, so Formlabs flammability data cannot be translated into an ADB class.",
      None, ADB, "high", "0 matches in ADB2.pdf"),
    F("Formlabs TDS flammability rating is UL 94 HB at 3 mm for Rigid 10K (post-cured) and for Nylon 12, Nylon 11, Nylon 12 GF, Nylon 12 Tough and Nylon 12 White; Tough 1000, 1500 V2 and 2000 V2 read 'Not Tested' (green) and 'HB' (post-cured). Of the 25 Formlabs TDS files scanned only these 9 report any UL 94 rating; the other 16 (Rigid 4000, Durable, Flexible, Silicone, Clear, Grey, High Temp, ESD, BioMed, Nylon 11 CF, TPU 90A) state none.",
      "ul_n12", "https://media.formlabs.com/m/2a02034348060e54/original/-ENUS-Nylon-12-TDS.pdf", "high"),
    F("The same HB-at-3-mm statement for Rigid 10K is in its TDS (Rigid 10K also lists ASTM E662 smoke density).",
      "ul_rigid10k", "https://media.formlabs.com/m/522eb50e6c8ac0e3/original/-ENUS-Rigid-10K-TDS.pdf", "high"),
    F("Formlabs Flame Retardant Resin (Form 4 family compatible) is rated UL 94 V-0 at 3 mm, V-1 at 2.5 mm and only HB at 1.5 mm, so the rating is thickness dependent and a thin hygromorph flap (0.2-2 mm) would not carry V-0.",
      "fr_ul_thick", FRTDS, "high", "V-0 (3 mm); V-1 (2.5 mm); HB (1.5 mm)"),
    F("Flame Retardant Resin: HDT 83 C at 1.8 MPa when post-cured at 80 C/120 min; Formlabs says parts suit 'indoor and industrial environments'. It makes no outdoor or UV claim on the page read.",
      "fr_indoor", FRPAGE, "high"),
    F("The Flame Retardant Resin also lists FAR 25.853 Appendix F Part I (12 s vertical burn, pass at 2.5 mm). That is an aircraft-interior test, not a building test.",
      "fr_far", FRTDS, "high"),
    F("NOT CONFIRMED: I found no EN 13501-1 class for any Formlabs resin or powder, for printed PLA modules by the architecture practice, or for any printed hygromorph. The practice states only that interior PLA is 'compounded with fireproof materials' (project record: spec-partner-architecture.json).",
      None, "D:/Users/ashenoy00000/delphi-work/agents/spec-partner-architecture.json", "medium"),
    F("ABSENCE (grep of full texts): the words 'fire' and 'flame' do not occur in the full text of the two principal humidity-responsive-façade papers (Cheng 2024; Rueggeberg and Burgert 2015) read in this run. Fire behaviour of these elements is untested in the literature I could access.",
      None, "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11604995/fullTextXML", "medium", "0 matches in each"),
]
