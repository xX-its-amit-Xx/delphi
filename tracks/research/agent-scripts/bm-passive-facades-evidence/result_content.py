"""Content of the bm-passive-facades-evidence result (imported by build_result.py)."""
import json

CHENG = "https://doi.org/10.1038/s41467-024-54808-8"
AIVC = "https://www.aivc.org/sites/default/files/22_0.pdf"
BOSS = "https://web.ornl.gov/sci/buildings/conf-archive/2007%20B10%20papers/195_Bossche.pdf"
ARX = "https://arxiv.org/abs/2308.01530"
PDH = "https://doi.org/10.1038/s41467-025-65071-w"
BIO = "https://doi.org/10.3390/biomimetics10100711"
SD = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-passive-facades-evidence/"
RH = json.load(open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-passive-facades-evidence/rh_vs_shade_need.json"))
OWN_SRC = ("own calculation: " + SD + "rh_vs_shade_need.py ; data https://archive-api.open-meteo.com/v1/archive (2023, hourly T2m, RH2m, "
           "shortwave; reanalysis-based, not station data); proxies: shade-wanted = T>=24 C and GHI>=300 W/m2, gain-wanted = T<=10 C and "
           "GHI>=200 W/m2; RH-to-state map linear 30-90 % RH; first-order lag for thick elements")


def f(claim, source, conf, quote="", qk=None, value=""):
    d = {"claim": claim, "source": source, "confidence": conf, "evidence_quote": quote, "value": value}
    d["_qk"] = qk
    return d


def g(c, t, k):
    return RH[c][t][k]


findings = [
    # ---- humidity-driven SHADING
    f("The best-documented humidity-responsive passive facade shading (Freiburg livMatS, 4D-printed cellulose bilayers) has no measured indoor-climate, energy or comfort result; the authors measured only shade coverage and defer the building benefit to future work.",
      CHENG, "high", "it will be important to quantify the improvement of indoor climate regulation in future work", "cheng",
      "energy/comfort number: none reported"),
    f("The 13-month outdoor monitoring in that study (June 2022 to July 2023, RH 10-91 %) was done on a tessellated mock-up of the facade system; the 424 final modules were deployed on the building afterwards. This refines an earlier agent's wording that the 424 modules themselves ran outdoors for more than a year.",
      CHENG, "high", "installed in a mock-up of the facade system and evaluated for 13 months under the full range of daily and seasonal weather effects", "cheng",
      "13 months, mock-up"),
    f("Measured shade coverage in summer: nearly 90 % on hot, sunny, low-RH days (RH about 25 %) and 50 % at night and early morning; in winter the modules stay open and close only from 50 % to 65 % on warmer, drier days.",
      CHENG, "high", "During hot and sunny days, the RH is typically low at around 25%, and the 4D-printed modules reach nearly 90% shade coverage", "cheng",
      "50-90 % summer; 50-65 % winter"),
    f("The control logic works because, in Freiburg's dry hot summers and humid cold winters, relative humidity is an indirect proxy for the need for shade.",
      CHENG, "high", "creating an indirect but reliable link between the need for shading and the behavior of hygromorphic materials in response to RH", "cheng"),
    f("The authors list hot-humid tropical and cold-dry climates as untested.",
      CHENG, "high", "exploring applications in different building systems and climate zones, such as hot and humid tropical or cold and dry tundra climates", "cheng"),
    f("Durability evidence for the cellulose bilayer is short relative to a building: 170 lab actuation cycles at RH 30-90 %, a UV chamber test with small curvature loss, and the 13-month mock-up. The authors state the cycle count is small against a building's lifetime.",
      CHENG, "high", "The number of cycles tested is still small compared to the entire lifetime of a building", "cheng", "170 cycles"),
    f("Actuation speed of the printed cellulose bilayer: full transformation between 30 % and 90 % RH within 30 minutes, fast enough to follow diurnal humidity swings.",
      CHENG, "high", "The bilayers reach a full transformation between two RH extremes of 30% and 90% within 30 minutes", "cheng", "30 min"),
    f("At 80 % RH the printed cellulose bilayers average a curvature of 0.0155 1/mm (15.5 1/m) regardless of temperature.",
      CHENG, "high", "At 80% RH, all bilayers are observed with an average curvature of 0.0155 mm", "cheng", "0.0155 1/mm"),
    f("Manufacturing yield at facade scale: 30 of 424 modules reprinted at print stage (7 %), 6 more replaced after cycle testing (1.4 %).",
      CHENG, "high", "after which only six modules were re-printed and replaced (1.4% failure rate)", "cheng", "7 % then 1.4 %"),
    f("A 2023 systematic review of hygroscopic adaptive facades (El-Dabaa and Abdelmohsen) concludes that most studied papers focus on the material's response and facade implementation, not on measured building performance.",
      "https://doi.org/10.1007/s00226-023-01464-8", "high",
      "most of the studied papers focus on the response behaviour of programmable materials to variation in moisture content and the implementation of hygroscopic design in adaptive", "abs"),
    f("The 2013 review of climate adaptive building shells (Loonen et al.) concluded the concept is not yet mature.",
      "https://ideas.repec.org/a/eee/rensus/v25y2013icp483-493.html", "high",
      "it was found that the concept of CABS cannot yet be considered mature", "loonen"),
    f("A 2025 shading study states the trade-off of passive actuation: simpler and more sustainable, but often less responsive to dynamic conditions than motorised systems.",
      BIO, "high", "offering simpler and more sustainable operation, but often lack responsiveness to dynamic conditions", "abs"),
    # ---- failures of active facades
    f("Motorised adaptive facades have failed in service: the Institut du Monde Arabe's 240 motor-controlled apertures became non-functional within six years because of maintenance demand (as reported by a 2025 review citing its ref 12; the primary source was not read).",
      BIO, "medium", "it gradually failed, becoming non-functional within six years", "bio25", "6 years to failure"),
    f("The same review reports that GSW Headquarters (1999) blinds still operate after 25 years but need more maintenance than conventional buildings.",
      BIO, "medium", "which, while still operational after 25 years, requires more maintenance than conventional buildings", "bio25", "25 years"),
    # ---- ventilation
    f("Field monitoring of humidity-controlled ventilation in occupied Paris-area dwellings (heating season 2007-2008, mechanical exhaust with humidity-sensitive inlets and grilles) measured an average 30 % cut in airflow-for-energy versus the French constant-airflow reference (55 % if extrapolated to statistical average occupancy). The authors work for the manufacturer (Aereco), so this is not independent.",
      AIVC, "medium", "The measured savings on the airflow for this project have been evaluated at 30% in average (55% if extrapolating to the statistical average occupancy in France).", "aivc",
      "30 % airflow; 55 % extrapolated"),
    f("Same monitoring: fan electricity cut by 35-50 % versus the constant-flow reference.",
      AIVC, "medium", "the energy consumption of the fan has been reduced between 35% to 50% in comparison with the French reference for a constant airflow ventilation system", "aivc", "35-50 % fan energy"),
    f("The humidity-sensitive grille behaves seasonally: mostly closed in the cold season, wider open in the hot season. That saves heating losses; my inference (not measured there) is that it admits more outdoor air in warm humid weather, which would not help cooling or latent load.",
      AIVC, "medium", "the grille is mainly closed in cold season; in hot season the grille aperture opens wider", "aivc"),
    f("Internal inconsistency in the manufacturer paper: its abstract says more than 4.5 million dwellings are equipped with humidity-controlled ventilation, its introduction says more than 7 million. Both are unverified manufacturer claims.",
      AIVC, "medium", "more than 7 million dwellings are already equipped today only considering humidity controlled ventilation", "aivc", "4.5 vs 7 million"),
    f("Independent-group simulation (Belgian universities, CONTAM, detached house, self-regulating inlets): the humidity-controlled system increases heating-energy savings up to 27 % for very airtight buildings and 14 % for average airtightness, relative to the constant-flow system; adding moisture buffering changed energy demand by only 0.75 %.",
      BOSS, "medium", "System C+ increases the energy savings up to 27% for very airtight buildings and 14% for buildings with an", "boss", "27 % / 14 %"),
    f("Simulation in Warsaw (Dfb climate): humidity-sensitive demand-controlled ventilation in an eight-floor block saved up to 11.64 kWh/m2 of primary energy, but operation on the higher floors was ineffective and needed supplementary fans; savings depend on the electricity source (1.07 vs 5.18 kWh/m2).",
      "https://doi.org/10.3390/en13246669", "high", "However, the operation of the system on higher floors was found to be ineffective.", "abs", "11.64 kWh/m2 primary max"),
    # ---- humidity buffering
    f("Simulation of five interior finishes in 15 Chinese cities: moisture-buffering materials cut HVAC load by under 3 kWh/m2 in most cases; benefit is clear in mild climates and weak in humid areas, and the effect can worsen indoor humidity.",
      "https://doi.org/10.1007/s11356-021-16684-3", "high", "the reduction is limited, within 3 kWh/m 2 , in most simulated cases", "abs", "<3 kWh/m2"),
    f("A simulated gypsum-based humidity-control material gave a maximum energy-saving rate of 19.31 % in Beijing, strongest where day-night temperature and RH differences are large. Simulation only.",
      "https://doi.org/10.3390/ma16155211", "high", "The maximum potential energy-saving rate in Beijing can reach up to 19.31%.", "abs", "19.31 % max (Beijing)"),
    f("Binder-jet 3D-printed superhygroscopic geopolymer tiles in a simulated 15-person library room improved annual hygrometric comfort by up to 85 % (a comfort metric, not energy), moisture buffering value above 14 g m-2 %RH-1. Dynamic hygrothermal simulation, not a measured building.",
      "https://doi.org/10.1038/s41467-024-54944-1", "high",
      "The use of 3D-printed, geopolymer tiles for surface finishing in a library hosting 15 people was shown to improve annual indoor hygrometric comfort by up to 85%", "tiles", "85 % comfort"),
    # ---- temperature-responsive
    f("Measured outdoor test of a passive wax-motor louver tile in insulated boxes (Santa Barbara, July and September): 3.1x less daytime heat input than a fixed black tile and 2.6x less night heat loss than a fixed white tile. A small tile, a short test, numbers read from the arXiv version of the Device 2024 paper.",
      ARX, "high", "our device reduced the energetic cost of cooling by 3.1x and heating by 2.6x compared to non -switching devices", "arx", "3.1x cooling, 2.6x heating"),
    f("Actuator hysteresis is a design-critical number: a prior two-way shape-memory-polymer radiative switch had a high switching band and large hysteresis, which the arXiv authors call impractical for regulating daily temperature fluctuations.",
      ARX, "high", "This makes it impractical for use in regulating daily temperature fluctuations", "arx"),
    f("Thermochromic PNIPAm hydrogel window coating, two-day outdoor test in a self-built insulated test box (Wuhan, ambient about 41 C, 718 W/m2): average daytime indoor temperature 6.95 C below ordinary glass (43.15 vs 51.44 C), 384 kJ/m2 per day estimated saving. Short test, one site.",
      PDH, "high", "The PHPF group exhibited an average temperature reduction of 6.95", "pdh", "6.95 C; 384 kJ/m2/day"),
    f("Same hydrogel window: dehydration forces a PVDC encapsulation, and even so the service life is extended only to 264 hours.",
      PDH, "high", "extending its service life to 264 hours without compromising optical functionality", "pdh", "264 h"),
]

# ---- own calculations
for c, v in [
    ("Own calculation on 2023 hourly weather for nine cities: if a passive shade is fully closed at RH 30 % and fully open at RH 90 % (the range tested by Cheng 2024) and responds within an hour, it is, averaged over hours with T>=24 C and sun >=300 W/m2, 0.95 closed in Madrid and 0.98 closed in Phoenix.",
     "Madrid %.2f, Phoenix %.2f" % (g("Madrid ES (Csa/BSk)", "tau1h", "mean_shade_state_when_shade_wanted"), g("Phoenix US (BWh)", "tau1h", "mean_shade_state_when_shade_wanted"))),
    ("Own calculation: in Singapore the same element is mostly OPEN in 98 % of the hours when shade is wanted; in Houston 38 %, Mumbai 43 %, Sydney 50 % (1 h response). RH is the wrong signal in humid tropical and humid subtropical climates.",
     "share of shade-wanted hours mostly open: Singapore %.2f, Houston %.2f, Mumbai %.2f, Sydney %.2f" % tuple(g(c, "tau1h", "frac_shade_wanted_hours_element_mostly_open") for c in ("Singapore (Af)", "Houston US (Cfa)", "Mumbai IN (Am)", "Sydney AU (Cfa)"))),
    ("Own calculation: slow response (a thick element) erases much of the benefit even where the sign is right. Mean shade state in shade-wanted hours for 1 h / 6 h / 24 h time constants: Dubai 0.78 / 0.61 / 0.54, Freiburg 0.74 / 0.54 / 0.47, London 0.69 / 0.43 / 0.33.",
     "Dubai %.2f/%.2f/%.2f; Freiburg %.2f/%.2f/%.2f" % tuple([g("Dubai AE (BWh)", t, "mean_shade_state_when_shade_wanted") for t in ("tau1h", "tau6h", "tau24h")] + [g("Freiburg DE (Cfb)", t, "mean_shade_state_when_shade_wanted") for t in ("tau1h", "tau6h", "tau24h")])),
    ("Own calculation: selectivity (mean shade state in shade-wanted hours minus in winter-gain hours) at 1 h / 6 h lag is Phoenix 0.46 / 0.62, Madrid 0.42 / 0.54, Freiburg 0.30 / 0.26, London 0.37 / 0.28, Houston 0.11 / -0.02, Sydney 0.27 / 0.21; Singapore, Dubai and Mumbai have no winter-gain hours (T<=10 C) at all.",
     "see scratch/rh_vs_shade_need.json"),
]:
    findings.append({"claim": c, "source": OWN_SRC, "confidence": "medium (proxy for building demand, one year, reanalysis RH)", "evidence_quote": "", "value": v, "_qk": None})

findings.append({"claim": "Own calculation linking the project's Lean-checked ceiling (kappa = 1.5*d_eps/h) to Cheng's measured curvature of 15.5 1/m: reaching it needs differential strain 0.31 % at h=0.3 mm, 0.52 % at 0.5 mm, 1.03 % at 1 mm, 2.07 % at 2 mm. Using the earlier agent's estimated stock-Formlabs differential strain (Clear/Grey V5 vs Rigid 10K: 0.20-0.26 % at 24 h and 0.70-0.95 % at 1 week, from water immersion not RH), the largest total thickness that reaches that curvature is 0.19-0.25 mm (24 h) or 0.68-0.92 mm (1 week). Uptake at 30-90 % RH is expected to be lower than immersion uptake (unverified), so these are optimistic upper bounds.",
                 "source": "own calculation " + SD + "thickness_budget.py ; inputs D:/Users/ashenoy00000/delphi-work/agents/spec-resin-chemistry.json (earlier agent's estimates), " + CHENG + " (15.5 1/m), project record HygromorphCeilingCheck.lean",
                 "confidence": "medium-low (depends on earlier agent's strain estimates and on immersion standing in for RH)", "evidence_quote": "", "value": "h_max 0.19-0.25 mm (24 h), 0.68-0.92 mm (1 wk)", "_qk": None})
findings.append({"claim": "Scaling argument, not a measured number: diffusion time in a slab goes as thickness squared, while curvature at fixed strain goes as 1/thickness. Doubling thickness halves curvature and quadruples response time. No water diffusivity for any Formlabs resin has been found by earlier agents, so absolute times cannot be given.",
                 "source": "own scaling argument; ratios printed by " + SD + "thickness_budget.py", "confidence": "high for the scaling, none for absolute times", "evidence_quote": "", "value": "time ratio vs 0.5 mm: 1 mm x4, 2 mm x16", "_qk": None})
findings.append({"claim": "Not found: any measured annual energy, comfort or daylight number for a humidity-driven passive shading or cladding element on a real or test building. I also could not locate the primary paper behind the earlier agent's news-reported shape-memory-alloy facade savings of 9.1-17 %.",
                 "source": "search record: Europe PMC, Crossref and web searches in this run (see could_not_find)", "confidence": "medium (absence in a limited search)", "evidence_quote": "", "value": "", "_qk": None})

key_claims_src = [
    {"claim": "No measured energy, comfort or daylight benefit exists for humidity-driven passive facade shading; the flagship Freiburg study measured shade coverage only (50-90 % in summer) and defers the indoor benefit to future work.",
     "source": CHENG, "evidence_quote": "it will be important to quantify the improvement of indoor climate regulation in future work", "_qk": "cheng"},
    {"claim": "Relative humidity is only an indirect proxy for the need for shade. It works in dry-summer climates and the authors leave humid tropics untested; my calculation shows it points the wrong way in Singapore (element mostly open in 98 % of shade-wanted hours) and is weak in Houston, Mumbai and Sydney.",
     "source": CHENG + " ; own calculation " + SD + "rh_vs_shade_need.py", "evidence_quote": "creating an indirect but reliable link between the need for shading and the behavior of hygromorphic materials in response to RH", "_qk": "cheng"},
    {"claim": "The only passive humidity-responsive building element with in-service numbers is humidity-controlled ventilation: 30 % airflow-for-energy cut in occupied Paris dwellings against a constant-flow reference, reported by the manufacturer; independent evidence is simulation (14-27 % heating saving) and it fails on upper floors of tall blocks without fans.",
     "source": AIVC + " ; " + BOSS + " ; https://doi.org/10.3390/en13246669", "evidence_quote": "The measured savings on the airflow for this project have been evaluated at 30% in average (55% if extrapolating to the statistical average occupancy in France).", "_qk": "aivc"},
    {"claim": "Durability evidence for any passive responsive facade element is short: 170 lab cycles and 13 months (cellulose bilayer), days (wax tile), 264 hours (hydrogel window). None approaches building lifetime.",
     "source": CHENG + " ; " + ARX + " ; " + PDH, "evidence_quote": "The number of cycles tested is still small compared to the entire lifetime of a building", "_qk": "cheng"},
]


def build():
    table = [
        {"name": "Freiburg livMatS cellulose 4D-printed shading (Cheng 2024)", "fields": "type=humidity+temperature shading; scale=424 modules on research building, 13-month mock-up; climate=Cfb Freiburg; summer shade coverage=50-90 %; winter=50-65 %; actuation=30 min for 30-90 % RH; cycles tested=170; energy/comfort=not measured", "source": CHENG},
        {"name": "Humidity-controlled ventilation, field monitoring (Savin et al., Aereco authors)", "fields": "type=humidity-sensitive inlets/grilles; scale=about 30 occupied dwellings, Paris area; airflow-for-energy cut=30 % (55 % extrapolated); fan energy cut=35-50 %; reference=French constant flow; independence=no (manufacturer)", "source": AIVC},
        {"name": "Humidity-controlled ventilation, simulation (Van Den Bossche et al. 2007)", "fields": "type=self-regulating inlets, CONTAM, detached house; heating saving=14 % (average airtightness) to 27 % (very airtight); moisture-buffering effect on energy=0.75 %", "source": BOSS},
        {"name": "Humidity-sensitive DCV Warsaw (Sowa 2020)", "fields": "type=CONTAM simulation, 8-floor block; climate=Dfb; primary energy saving=up to 11.64 kWh/m2; upper floors=ineffective without fans; electricity-mix range=1.07 to 5.18 kWh/m2", "source": "https://doi.org/10.3390/en13246669"},
        {"name": "Moisture-buffering finishes, 15 Chinese cities (Fang 2022)", "fields": "type=simulation; HVAC load cut=under 3 kWh/m2 in most cases; benefit=clear in mild, weak in humid; can worsen humidity", "source": "https://doi.org/10.1007/s11356-021-16684-3"},
        {"name": "Gypsum humidity-control material (Li 2023)", "fields": "type=simulation; max energy saving=19.31 % Beijing; best where day-night T and RH swings are large", "source": "https://doi.org/10.3390/ma16155211"},
        {"name": "3D-printed superhygroscopic geopolymer tiles (Posani 2025)", "fields": "type=simulation, 15-person library room; comfort gain=up to 85 % (not energy); MBV=above 14 g/m2/%RH; printer=binder jet", "source": "https://doi.org/10.1038/s41467-024-54944-1"},
        {"name": "Wax-motor radiative switch tile (Xiao, Liao, Hawkes)", "fields": "type=temperature-driven passive louver; scale=tile in insulated box; site=Santa Barbara; result=3.1x less daytime heat input, 2.6x less night heat loss; test length=days", "source": ARX},
        {"name": "PNIPAm hydrogel smart window (Yang 2025)", "fields": "type=temperature-driven, thermochromic; scale=test box roof window, 2 days, Wuhan; indoor temperature=6.95 C below ordinary glass; saving=384 kJ/m2/day; service life=264 h with PVDC encapsulation", "source": PDH},
        {"name": "Motorised facade failure, Institut du Monde Arabe (contrast case)", "fields": "type=active; 240 apertures; non-functional within 6 years (secondary source)", "source": BIO},
    ]
    for c, r in RH.items():
        def v(t, k):
            x = r[t][k]
            return "n/a" if x is None else x
        table.append({"name": "RH-driven shade vs need, " + c,
                      "fields": "shade-wanted hours=%d; gain-wanted hours=%d; mean RH=%s %%; mean shade state in shade-wanted hours (1h/6h/24h lag)=%s/%s/%s; share of shade-wanted hours element mostly open (1h)=%s; selectivity (1h/6h)=%s/%s [own calculation, proxies]" % (
                          r["shade_wanted_h"], r["gain_wanted_h"], r["mean_RH_pct"], v("tau1h", "mean_shade_state_when_shade_wanted"), v("tau6h", "mean_shade_state_when_shade_wanted"),
                          v("tau24h", "mean_shade_state_when_shade_wanted"), v("tau1h", "frac_shade_wanted_hours_element_mostly_open"), v("tau1h", "selectivity"), v("tau6h", "selectivity")),
                      "source": "own calculation " + SD + "rh_vs_shade_need.py using https://archive-api.open-meteo.com/v1/archive 2023"})

    summary = (
        "Short answer: there is a real but narrow performance case, and humidity-driven shape-changing shading has no measured building benefit yet. "
        "(1) Humidity-driven SHADING: the best example (Freiburg, 424 printed cellulose modules, 13-month mock-up) measured only shade coverage (about 90 % on hot dry summer days, 50 % at night); the authors call the indoor-climate benefit future work. No energy, comfort or daylight number was found for any humidity-driven shading or cladding element. "
        "(2) The sign logic depends on climate. My own calculation on 2023 hourly weather for nine cities shows relative humidity tracks the need for shade in dry-summer climates (Madrid, Phoenix: element mostly closed, 0.95-0.98, in overheating sunny hours if it responds within an hour) and fails in humid ones (Singapore: mostly open in 98 % of those hours; Houston, Mumbai, Sydney 38-50 %). Slow, thick elements lose much of the benefit (Dubai 0.78 falls to 0.54 when the lag goes from 1 h to 24 h). "
        "(3) The only passive humidity-responsive building element with in-service numbers is humidity-controlled ventilation: 30 % cut in airflow-for-energy and 35-50 % fan energy in about 30 occupied dwellings (manufacturer-authored), 14-27 % heating savings in independent simulation, up to 11.6 kWh/m2 primary energy in a Warsaw simulation, but ineffective on upper floors without fans, and always relative to a constant-flow reference. "
        "(4) Passive humidity-BUFFERING materials give small energy effects (under 3 kWh/m2 in most of 15 Chinese cities; up to 19 % in a Beijing simulation) and larger comfort effects (up to 85 % in a simulated library with printed tiles). "
        "(5) Passive TEMPERATURE-responsive elements have the best short measured numbers (wax-louver tile 3.1x and 2.6x; hydrogel window -6.95 C) but only days of testing, and a 264-hour hydrogel life. "
        "(6) The strongest argument for passive devices is that motorised facades fail from maintenance (Institut du Monde Arabe non-functional within six years, secondary source). "
        "Design implication from the project record: curvature = 1.5 x strain / thickness and response time grows with thickness squared; with the earlier agent's estimated 0.2-0.95 % differential strain for stock Formlabs resins, only bilayers about 0.2-0.9 mm thick (total) could reach the curvature Freiburg measured, so a thick architectural-scale SLA or SLS part would be too slow and too weak for humidity actuation. "
        "Missing: annual simulation or test-cell comparison with measured actuation, hot-humid tests, multi-year weathering, cost and maintenance data, and any independent field test of hygromorphic shading.")
    lay = ("A building shade that opens and closes by itself when the air turns damp or dry sounds clever, because it needs no motor. But nobody has yet measured whether such a shade really lowers a building's energy bill or makes rooms more comfortable. "
           "The best real example, in Freiburg, Germany, closed about 90 percent on hot dry afternoons, and the team said the indoor benefit still has to be measured. "
           "My own weather check suggests the trick works where hot days are dry, like Madrid or Phoenix, and backfires where hot days are also damp, like Singapore, because the shade would stay open. "
           "Think of a curtain that closes when the air is dry: fine in a desert, useless in a rainforest. "
           "The one damp-sensing part with real in-home data is a ventilation vent that opens wider when a bathroom gets humid; its saving looks real, but the measurements came mostly from the maker. "
           "So the honest answer is a narrow case, for dry-summer climates and thin parts, not yet proven by tests.")
    glossary = [
        ("Passive", "works on its own from the weather, with no motor, sensor or electricity"),
        ("Relative humidity (RH)", "how full of water vapour the air is, as a percentage of the most it can hold at that temperature"),
        ("Hygromorph", "a material that bends or curls when it takes up or loses moisture"),
        ("Bilayer", "two stuck-together layers that swell by different amounts, so the pair bends like a bimetal strip"),
        ("Curvature", "how sharply a strip bends; one divided by the bend radius"),
        ("Differential strain", "the difference in how much the two layers stretch or swell"),
        ("Demand-controlled ventilation", "ventilation that moves more air only when the room needs it"),
        ("Moisture buffering", "a wall or ceiling finish soaking up damp air and giving it back later, smoothing humidity swings"),
        ("Hysteresis", "the gap between the temperature at which a device switches one way and the one at which it switches back"),
        ("Time constant (lag)", "roughly how long a thing takes to follow a change in its surroundings"),
        ("Reanalysis weather data", "a computer reconstruction of past weather on a grid, used where station records are missing"),
        ("Primary energy", "energy counted at the fuel source, including losses in making electricity"),
        ("Koppen code (Cfb, BWh, Af, Dfb)", "a letter label for a climate type: temperate, hot desert, tropical rainforest, cold continental"),
        ("CONTAM", "free NIST software that simulates air flow and pollutants in buildings"),
        ("MBV (moisture buffering value)", "grams of water a surface takes up per square metre for each percent change in humidity"),
        ("Mock-up", "a partial full-size copy of a facade built for testing"),
    ]
    rec = [
        "Do not claim an energy or comfort benefit for a humidity-driven shape-changing element in the proposal; claim a demonstrated, measured shape change and a test plan. The literature has no such number to borrow.",
        "Pitch it for climates where hot hours are dry (Mediterranean, arid, continental summers). Avoid hot-humid claims. In temperate-humid London (mean RH 79.7 % in the 2023 calculation) a pure-RH shade is weak (selectivity 0.37 at 1 h lag, 0.28 at 6 h); a temperature-coupled design, as Freiburg's has, helps.",
        "Design for thickness: keep total bilayer thickness well under 1 mm if resin differential strain is 0.2-1 %, or pick a much higher-swelling pair (hydrogel-resin pairs in earlier files) and accept durability risk (a hydrogel window lasted 264 h even when encapsulated).",
        "A credible proof of concept is two matched boxes or a small test cell (static vs responsive) logging indoor temperature and illuminance for months, plus a humidity-buffering or humidity-vent element as a second, lower-risk demonstration that has published building numbers.",
        "Treat humidity-sensitive ventilation and moisture-buffering tiles as the evidence-backed neighbours of the idea; the printed-tile Nature Communications study shows printed passive humidity elements are publishable.",
    ]
    repro = [
        {"what": "Environment", "command_or_url": "Windows, Python 3.14 with pypdf; urllib only for fetching; User-Agent 'delphi-research/0.1'; scripts in " + SD, "expected": "scripts run as saved"},
        {"what": "Fetch open-access full texts via Europe PMC", "command_or_url": "python fetch_epmc.py 10.1038/s41467-024-54808-8 10.3390/biomimetics10100711 10.3390/ma16155211 10.1038/s41467-024-54944-1 10.1038/s41467-025-65071-w", "expected": "XML and .txt in D:/Users/ashenoy00000/delphi-work/data/passive-facades/ plus a sha256 line per file in MANIFEST.tsv (Cheng: 105723 bytes, sha256 3cf8cc8a...)"},
        {"what": "Fetch non-PMC sources and abstracts", "command_or_url": "python dl.py https://www.aivc.org/sites/default/files/22_0.pdf aivc22.pdf ; python dl.py 'https://web.ornl.gov/sci/buildings/conf-archive/2007%20B10%20papers/195_Bossche.pdf' bossche2007.pdf ; python dl.py https://arxiv.org/pdf/2308.01530 arxiv_2308.01530.pdf ; python dl.py https://ideas.repec.org/a/eee/rensus/v25y2013icp483-493.html loonen_ideas.html ; python dump_abstracts.py", "expected": "texts containing the quoted sentences (aivc22: '30% in average (55% if extrapolating'; bossche2007: 'up to 27% ... 14%'; arXiv: '3.1x ... 2.6x')"},
        {"what": "Climate / RH calculation", "command_or_url": "python rh_vs_shade_need.py", "expected": "9 JSON lines; e.g. Singapore tau1h frac_shade_wanted_hours_element_mostly_open 0.98, Phoenix mean_shade_state_when_shade_wanted 0.98, Madrid 0.95, Houston frac 0.38 (provider may revise reanalysis slightly)"},
        {"what": "Thickness budget", "command_or_url": "python thickness_budget.py", "expected": "d_eps 0.31/0.52/1.03/2.07 % for h 0.3/0.5/1/2 mm; h_max 0.19-0.25 mm (24 h), 0.68-0.92 mm (1 wk)"},
        {"what": "Confirm DOIs resolve", "command_or_url": "python crossref_meta.py <doi> ... ; python arxiv_meta.py 2308.01530", "expected": "title, authors and year for every DOI in citations"},
        {"what": "Verify all quotes against saved sources and write the result JSON", "command_or_url": "python build_result.py", "expected": "'QUOTES OK n=...' and D:/Users/ashenoy00000/delphi-work/agents2/bm-passive-facades-evidence.json"},
    ]

    def cit(a, y, t, d, used, venue, how):
        return {"authors": a, "year": y, "title": t, "doi_or_arxiv": d, "verified": True, "used_for": used, "venue": venue, "how_verified": how}
    cites = [
        cit("Cheng, Tahouni, Sahin, Ulrich et al.", 2024, "Weather-responsive adaptive shading through biobased and bioinspired hygromorphic 4D-printing", "10.1038/s41467-024-54808-8", "Freiburg shading: shade coverage, 13-month mock-up, 170 cycles, climate logic, no indoor-benefit number", "Nature Communications", "Crossref works API returned title/authors/year; full text fetched from Europe PMC (PMC11604995)"),
        cit("Imani, Le Guen, Bedggood, Betteridge et al.", 2025, "Biomimetic Shading Systems: Integrating Motorised and Moisture-Responsive Actuation for Adaptive Facades", "10.3390/biomimetics10100711", "Institut du Monde Arabe and GSW maintenance history; passive responsiveness trade-off", "Biomimetics", "Crossref works API and Europe PMC full text (PMC12564348)"),
        cit("El-Dabaa, Abdelmohsen", 2023, "Hygroscopy and adaptive architectural facades: an overview", "10.1007/s00226-023-01464-8", "review conclusion: most work studies material response, not building performance", "Wood Science and Technology", "Crossref works API returned metadata and abstract"),
        cit("Loonen, Trcka, Costola, Hensen", 2013, "Climate adaptive building shells: State-of-the-art and future challenges", "10.1016/j.rser.2013.04.016", "statement that the concept is not yet mature", "Renewable and Sustainable Energy Reviews", "Crossref works API; abstract text read on ideas.repec.org"),
        cit("Sowa, Mijakowski", 2020, "Humidity-Sensitive, Demand-Controlled Ventilation Applied to Multiunit Residential Building: Performance and Energy Consumption in Dfb Continental Climate", "10.3390/en13246669", "Warsaw simulation: 11.64 kWh/m2, upper floors ineffective", "Energies", "Crossref works API returned metadata and abstract (publisher page returned HTTP 403; full text not read)"),
        cit("Fang, Zhang, Ren, He et al.", 2022, "Influence of climates and materials on the moisture buffering in office buildings: a comprehensive numerical study in China", "10.1007/s11356-021-16684-3", "moisture-buffering HVAC saving under 3 kWh/m2", "Environmental Science and Pollution Research", "Crossref works API and Europe PMC abstract (PMID 34601684)"),
        cit("Li, Ran", 2023, "Gypsum-Based Humidity-Control Material: Preparation, Performance and Its Impact on Building Energy Consumption", "10.3390/ma16155211", "19.31 % simulated saving in Beijing", "Materials", "Crossref works API; Europe PMC abstract and full text (PMC10419816)"),
        cit("Posani, Voney, Odaglia, Du et al.", 2025, "Low-carbon indoor humidity regulation via 3D-printed superhygroscopic building components", "10.1038/s41467-024-54944-1", "printed passive humidity-buffering tiles, 85 % simulated comfort gain", "Nature Communications", "Crossref works API; Europe PMC full text (PMC11724049)"),
        cit("Xiao, Liao, Hawkes", 2024, "Passively adaptive radiative switch for thermoregulation in buildings", "10.1016/j.device.2023.100186", "published record of the wax-motor louver tile (numbers read from the arXiv preprint)", "Device", "Crossref works API returned the Device record"),
        cit("Xiao, Liao, Hawkes", 2023, "Passively Adaptive Radiative Switch for Thermoregulation in Buildings", "arXiv:2308.01530", "source of the 3.1x / 2.6x numbers and the SMP hysteresis statement", "arXiv", "arXiv export API returned title, date and authors; PDF downloaded and quoted"),
        cit("Yang, Zhou, Lv, Wang et al.", 2025, "Thermochromic hydrogels for synergistic mechano-optical properties and global energy saving potential", "10.1038/s41467-025-65071-w", "two-day outdoor test, -6.95 C, 264 h service life", "Nature Communications", "Crossref works API; Europe PMC full text (PMC12627514)"),
        cit("Woloszyn, Kalamees, Abadie, Steeman, Kalagasidis", 2009, "The effect of combining a relative-humidity-sensitive ventilation system with the moisture-buffering capacity of materials on indoor climate and energy efficiency of buildings", "10.1016/j.buildenv.2008.04.017", "existence only: independent multi-tool simulation of RH-sensitive ventilation; abstract and numbers NOT read", "Building and Environment", "Crossref works API returned title, authors, year (no abstract in record)"),
        cit("Vailati, Bachtiar, Hass, Burgert", 2018, "An autonomous shading system based on coupled wood bilayer elements", "10.1016/j.enbuild.2017.10.042", "existence only: earlier wood-bilayer shading study in Energy and Buildings; content NOT read (publisher 403)", "Energy and Buildings", "Crossref works API returned title, authors, year (no abstract); TU Dresden portal page lists it"),
    ]
    cnf = [
        "Any measured annual energy, comfort or daylight result for humidity-driven passive shading or cladding on a real or test building (searched Europe PMC, Crossref, web). The Freiburg authors state it is future work.",
        "Bimetal shading 15-20 % cooling and heating load cut (Kim, Mays, Im, ARCC 2015) appeared only in a web-search summary; the PDF URL returned HTTP 404 and the host certificate did not match, so I did not verify or use it.",
        "Primary source for the news-reported power-free shape-memory-alloy facade savings of 9.1-17 % that an earlier agent could not trace; I could not find it either.",
        "Abstract or numbers of Vailati 2018 (wood-bilayer autonomous shading) and Woloszyn 2009 (RH-sensitive ventilation simulation): publisher pages returned HTTP 403 and the Crossref records have no abstract.",
        "Full text of Sowa 2020 (publisher HTTP 403): only the abstract was read.",
        "Independent (non-manufacturer) in-situ measurement of humidity-controlled ventilation energy savings; the field data found is by Aereco authors, and its baseline is a regulatory constant-flow reference, not a matched control home.",
        "Field failure or maintenance data for any PASSIVE responsive facade (wood, bimetal, SMA, hygromorph). The failure evidence found is for motorised facades (secondary-source review); passive failure modes beyond Cheng's UV and cycling tests are undocumented.",
        "Thermobimetal, shape-memory-polymer (Yoon and Bae 2020) and heat-responsive double-skin-facade (tropical) papers were located by search but their numbers were not read or verified.",
        "Cost, installation or maintenance figures for hygromorph facades; I found no commercially listed humidity-driven shading product.",
        "Open-Meteo values are reanalysis, 2023 only, nine cities; other years, station data, building-simulation demand and the RH-to-actuation mapping (30-90 %, taken from Cheng's test range) are untested assumptions.",
        "Thickness of the Cheng bilayers was not extracted from the text, so the implied differential strain behind 15.5 1/m was not computed; the budget calculation uses thickness as a variable.",
        "OpenAlex was not used, as instructed.",
    ]
    return {"label": "bm-passive-facades-evidence", "topic": "Does passive humidity response actually help a building?",
            "summary": summary, "lay_summary": lay, "glossary": [{"term": a, "plain": b} for a, b in glossary],
            "findings": findings, "key_claims": key_claims_src, "table": table, "recommendations": rec,
            "reproduce": repro, "citations": cites, "could_not_find": cnf}
