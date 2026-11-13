"""Findings part 3: calculations, contradictions with earlier agents, applicability (PoC vs product)."""
from quotes import Q
from content1 import F, FRTDS
from content2 import TDS_T1500, TDS_T1000, TDS_T2000

CALC = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-building-physics-standards/bm_calc.py"

FINDINGS_CALC = [
    F("Project-record check (bm_calc.py, grid 0.05-20 in m and n): the Timoshenko coefficient f(m,n) never exceeds 1.5 and equals 1.500000000000 at m^2 n = 1 for m = 0.5, 1, 2, 3.7. This agrees with the Lean-checked ceiling; it is a numerical re-check, not a new proof.",
      None, CALC, "high", "max f = 1.5 at m^2 n = 1"),
    F("Formlabs TDS coefficients of thermal expansion (0-150 C, ASTM E831) are large and differ widely: Rigid 10K about 41-48, Tough 1500 V2 99-116, Tough 2000 V2 134-143, Tough 1000 162-168 (the TDS text shows the unit as 'm/m/C'; the micro sign was lost in extraction, and the BioMed Durable TDS prints 'um/m/C'). Which column is green or post-cured is not read.",
      "cte_t1000", TDS_T1000, "medium", "Rigid 10K 41-48; Tough 1000 162-168 (um/m/C, units inferred)"),
    F("Rigid 10K CTE row.", "cte_r10k", "https://media.formlabs.com/m/522eb50e6c8ac0e3/original/-ENUS-Rigid-10K-TDS.pdf", "medium"),
    F("Tough 1500 V2 CTE row.", "cte_t1500", TDS_T1500, "medium"),
    F("CALCULATION: a Rigid 10K / Tough 1000 bilayer, the low-water-uptake pair the earlier agents proposed as passive layer plus stiff control, has a differential CTE of 113.6-127.2 um/m/C. Over a 40 K swing (20 to 60 C, my assumed range) that is a differential thermal strain of 0.45-0.51 %, which is 2.3-2.5 times the 0.2 % hygroscopic differential strain the earlier agent ESTIMATED for 24 h in stock resins. At the Lean-checked optimum (kappa = 1.5 d_eps / h) and h = 1 mm that is a curvature of 0.0068-0.0076 per mm (radius 131-147 mm) from temperature alone. Because the CTE was averaged over 0-150 C, across the glass transition, it probably overstates the glassy-range value; the ratio is an order-of-magnitude warning, not a prediction.",
      None, CALC, "medium", "0.454-0.509 % at 40 K vs 0.2 % (earlier estimate)"),
    F("Implication for evaluation (INFERENCE): any humidity test of a printed bilayer must hold temperature constant and report it, and a thermal-only control (dry, ramped temperature) is needed, because thermal bimorph bending can match or exceed the hygroscopic signal. Cheng 2024 already shows a strong temperature effect on humidity-driven curvature.",
      None, CALC, "medium"),
]

FINDINGS_VS_EARLIER = [
    F("VS EARLIER (spec-formlabs-materials.json, 18 SLA resins): that table omits Formlabs' Flame Retardant Resin, which is on formlabs.com in the Form 4 family list. It is UL 94 V-0 at 3 mm, HDT 83 C (1.8 MPa), Tg 144 C (post-cured 80 C/120 min), tensile modulus 3.1 GPa. So the catalogue was not complete for the fire question. Its CTE (20-80 C, ASTM E831/E813 as printed) is 98.6 and 68.1 um/m/C (two columns, state mapping not read).",
      "fr_cte", FRTDS, "medium"),
    F("VS EARLIER (spec-architecture-gaps.json): that file notes 'UL 94 HB' for Nylon 11 Pro. HB at 3 mm is not special to that powder: it is the Formlabs rating for Rigid 10K, Tough 1000/1500/2000 (post-cured) and all Nylon 12 variants read here. Only Flame Retardant Resin is better, and only at 3 mm.",
      "ul_n12", "https://media.formlabs.com/m/2a02034348060e54/original/-ENUS-Nylon-12-TDS.pdf", "high"),
    F("VS EARLIER (spec-resin-chemistry.json: 'I did not retrieve a quantitative UV-ageing study for Formlabs resins'): true for resins' numbers, but Formlabs does publish ageing curves in resin TDS files (Tough 1500 V2 outdoor/indoor/heat; Flexible 80A V2 indoor/heat) and a numeric 1000 h D4329 study for two nylon powders. The resin values are in graphs I could not read, so the gap on numbers stays open.",
      "t1500_out", TDS_T1500, "high"),
    F("VS EARLIER: the earlier materials were chosen for low water uptake (Rigid 10K, Tough 1000, Silicone 40A as passive layers). Water uptake is the wrong single screen for a façade element; creep at temperature, CTE mismatch (above) and UV are each the same size or larger problems and are not in the earlier selection logic.",
      None, CALC, "medium"),
]

FINDINGS_APPLIC = [
    F("RECOMMENDATION (my synthesis, not from a source): a desk-scale printed demonstrator legitimately escapes the Building Regulations, the Construction Products Regulation (no DoP/CE/UKCA), Euroclass SBI testing, wind and impact categories, and a stated design working life. It does not escape honest statements: it should say 'not fire classified; UL 94 HB (or V-0 if FR resin, 3 mm only); not weather-tested beyond what is reported'.",
      None, CALC, "medium"),
    F("RECOMMENDATION (proof of concept, small coupons, all within a desk lab): (1) EN ISO 62 water uptake and diffusion in immersion and in humid air, at fixed temperature; (2) ISO 483 salt-solution RH chambers; (3) cyclic RH like Cheng 2024 (90/30 % RH, 6 h cycle, 170+ cycles) at 3 temperatures plus a dry thermal-only control; (4) EN ISO 4892-3 or -2 exposure of at least 96 h (the published floor) up to 1000 h (the Formlabs powder precedent), then re-measure curvature and modulus; (5) ISO 899-1/-2 creep at 22 C and a hot temperature near the DMA inflection; (6) ISO 1182 cylinders and ISO 1716 for non-combustibility/PCS screening, labelled as screening.",
      None, CALC, "medium"),
    F("RECOMMENDATION (installation, e.g. a pavilion shown by the architecture practice): the relevant gates are Regulation 7 and ADB if attached to a building; Schedule 2 temporary-building exemption (28 days) if freestanding and short-lived; the venue's fire risk assessment (Regulatory Reform (Fire Safety) Order 2005, NOT researched here); and wind and fixing design to EN 1991-1-4. An early conversation with building control and a fire engineer is the only way to settle which applies. NOT CONFIRMED.",
      None, CALC, "low"),
    F("RECOMMENDATION (product): a facade element would need (a) a declared reaction-to-fire class from EN 13501-1 testing of the element as mounted (SBI wings, 3 specimens); if on a relevant building at 18 m or more and above 4.5 m, A2-s1,d0, which in all likelihood needs a mineral-filled or inorganic design (INFERENCE); (b) a durability programme like the ETA list (hygrothermal cycles, freeze-thaw, 500 h water, 2500 h heat, UV-and-water, retention above 75 %); (c) impact category; (d) wind to EN 1991-1-4; (e) a stated design working life; (f) the UK conformity route (UKCA/BBA), which I did not research.",
      None, CALC, "low"),
    F("UNVERIFIED BACKGROUND (not load-bearing): organic printable polymers such as PA12 and acrylate resins typically have heats of combustion of tens of MJ/kg, far above the 3.0 MJ/kg A2 limit. I could not fetch a primary table (FAA server returned 503), so I do not use this number anywhere above.",
      None, "", "low"),
]
