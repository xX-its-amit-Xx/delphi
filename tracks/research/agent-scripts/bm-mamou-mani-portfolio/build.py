"""Assemble D:/Users/ashenoy00000/delphi-work/agents2/bm-mamou-mani-portfolio.json from findings_a/b + table below.
Run (after fetch_pages.py): python -I check_quotes.py && python -I build.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from findings_a import A
from findings_b import B
D = r"D:\Users\ashenoy00000\delphi-work\data\mamou-mani"
OUT = r"D:\Users\ashenoy00000\delphi-work\agents2\bm-mamou-mani-portfolio.json"

URL = {}
HASH = {}
for line in open(os.path.join(D, "manifest.tsv"), encoding="utf8"):
    p = line.rstrip("\n").split("\t")
    if len(p) >= 5:
        URL[p[0]] = p[1]; HASH[p[0]] = (p[2], p[3], p[4])

CONF = {"high": "high", "medium": "medium", "low": "low"}
findings = []
for (i, claim, val, key, quote, conf) in A + B:
    findings.append({"id": i, "claim": claim, "value": val, "source": URL[key], "evidence_quote": quote, "confidence": conf})

# projects table: (name, fields, source key)
P = [
("Food Ink 3D-printed restaurant stools", "year=2016; place=London; material=PLA (Excelfil per 2018 interview); mass=1 kg PLA per Smoke Stool; method=Silkworm G-code from Grasshopper, high-speed hot printing with custom infill; award=3DPC Finalist 2017; partners=byFlow, Food Ink, Fab Pub", "foodink"),
("Cloud Capsule", "year=2014; place=London; height=2 m micro-pavilions; method=Delta Tower 3D printer; software=Radiance + Silkworm; client=STO Werkstatt; mass=not stated", "cloudcapsule"),
("Wooden Waves (BuroHappold)", "year=2015; place=London; material=untreated certified plywood; method=laser-cut lattice hinge; prototypes=100+; partners=BuroHappold, Fab Pub; performance_number=none", "woodenwaves"),
("Temple Galaxia (Burning Man 2018)", "year=2018; place=Black Rock City; span=60 m; height=20 m; trusses=20; screws=18000; screw_capacity=1.8 kN; volunteers=200; material=off-the-shelf 2x4 and 4x4 timber + printed PLA mandala; end_of_life=burned; engineer=FORMAT; scaffolding=DHC Charles Engineering", "galaxia"),
("Conifera (COS, Milan Design Week)", "year=2019; place=Palazzo Isimbardi, Milan; modules=700; material=wood-and-bioplastic then translucent bioplastic; method=distributed 3D printing (London, Milan, Venice, Macerata); mass=not on practice page (3.5 t press figure not re-verified); partners=COS, Format Engineers, WASP, Superforma, FabLab Venice, Design for Craft, Plantura", "conifera"),
("Sandwaves (Diriyah Season)", "year=2019 per practice page, reported 2020-01-20 by Dezeen; place=Riyadh/Diriyah; elements=58; mass_each=160 kg (calc total 9280 kg); material=sand + furan resin; method=binder-jet sand printing (ExOne per page); partners=Studio Precht, Design Lab Experience, Format Engineering; limit=sand weak so thick members", "sandwaves"),
("Aurora (Design Museum, Dassault Systemes)", "year=2021; place=London; material=bio-sourced PLA modules on steel tubes; method=printed at Fab.Pub, broken down and reprinted; LCA_PLA=2333.89 kgCO2; LCA_ABS=8890.42 kgCO2; saving=73.7 % (calc); software=3DEXPERIENCE", "aurora"),
("Tower of Gaia (competition, shortlisted)", "year=2020; place=Silicon Valley; material=digitally generated timber; claims=1 t CO2 per m3 stored, up to 75 % emission cut; status=unbuilt", "towergaia"),
("Circular House", "year=2022; place=South London; materials=clay, wood, London brick, sugar-derived bioplastics; staircase by Fab.Pub; planning=Southwark Council", "circularhouse"),
("Falling in Love stage", "year=2022 page, premiered Oct 2023; place=Berlin Friedrichstadt-Palast; role=stage architecture debut; collaborator=Jean Paul Gaultier", "falling"),
("Whale Shark (FIFA World Cup 2022 tribute)", "year=2022; place=Lusail, Qatar; length=30 m; panels=66; skin=400 m2; material=recyclable steel mesh + marine-grade stainless strips; method=augmented-reality-guided fabrication; schedule=4 months; partners=Balich Wonder Studio, Fab.Pub, Format Engineers", "whaleshark"),
("Altostrata (Therme pavilion)", "year=2023; places=Sibiu, Singapore, Dubai; modules=12; length=30 m; module_height=2.7 m; material=sugar-based PLA; method=one robot arm in shipping container, 3 weeks; test=500 kg.m2 (invalid unit); partners=Therme, Arup, Fab.Pub; thanks=AI Build, CNC Robotics", "altostrata"),
("The Wavery (Fortnum & Mason)", "year=2023; place=London; material=PLA bioplastic; scope=bar, ceiling elements, stools; modules=not stated", "wavery"),
("The Roe restaurant", "year=2023-01 to 2024-02; place=Canary Wharf; tree=6.4 m x 4.0 m; modules=30; mass_each=20 kg; print_time_each=15-20 h; bar=42 m; material=PLA compounded with fireproof materials + plywood core + glazed clay; mass_total=600 kg (calc)", "roe"),
("WOW!House mandalas", "year=2024 page (participating since 2022); place=Chelsea Harbour, London; material=parametric PLA mandalas; reuse=3 years without change (founder, qualitative)", "wowhouse"),
("IWAN pavilion", "year=2024; place=Dubai Design Week; material=folded aluminium; role=knowledge partner; partners=Ithra, Abywat; award=Tanween Foldable Pavilion Challenge 2023", "iwan"),
("Catharsis (Burning Man)", "year=2022 per project page (portfolio grid says 2020); status=ongoing; modules=60 timber with metal hinges; symmetry=7-fold; partners=Therme Art Program, One Hat One Hand, Format Engineers, Drone Stories", "catharsis"),
("THK Tower", "year=2021-2024; place=Nuanu, Bali; material=96 t reclaimed ulin + 5.6 t rattan, copper sulfate treatment, cooking-oil bio-epoxy; claim=up to 44 t CO2 avoided; permanent", "thk"),
("Hermes Sanlitun facade", "year=2024-2026; place=Beijing; with=RDAI; material=ceramic tiles + metal; method=modular removable panels, 3D-printed positives for moulds", "hermes"),
("Flying Whales airship factory", "year=2022-present; place=Nouvelle-Aquitaine; hall=240 x 80 x 60 m; method=genetic-algorithm volume study; steel_saving=50 % claimed; JV=GAAMMA with Goudchaux Architecte", "flyingwhales"),
("Concordia (Photoclimat)", "year=2025; place=Place de la Concorde, Paris; material=reclaimed tree trunks, timber frame, looped rattan; engineer=Format Engineers; fabricator=Fab.Pub", "concordia"),
("Harmonic Tides (Clerkenwell Design Week)", "year=2025; place=St John's Gate, London; material=sugar-based PLA; reused Altostrata modules; outdoors", "fp_harmonic"),
("RIVA (King's Cross)", "year=2025; place=Pancras Square, London; interior=3 m x 1.9 m single print in PLA + non-toxic fire retardant (largest single print); exterior=folded aluminium lattice hinge", "riva"),
("Tate Modern Turbine Hall (Hyundai Commission, Tarek Atoui)", "year=2025-2026, open to 2027-04-11; horns=9 up to 8 m; platforms=36; towers=6; table_bases=16; rings=2; material=bamboo-filled PLA (horns, rings) and bamboo-filled PETG (platforms, towers); tests=suspension and load tests with Webb Yates Engineers", "tate"),
("Neko Health Monolith Wall (Fab.Pub)", "year=2025; place=Spitalfields, London; size=12 m x 7.5 m; panels=260 recycled PETG; print_time=>800 h; LEDs=78 strips; schedule=3 months", "fp_monolith"),
("AZ Factory Retail Corners", "year=2021 concept (grid says 2026); status=concept only; large-scale 3D printing", "azfactory"),
("Fab.Pub material library", "blends=Fab.Pure Clear PLA, Fab.Grain, Fab.Shield (flame retardant), Fab.Stone, Fab.Zen, Fab.Lava (in development), Fab.Roast; base polymers=PLA, PETG; clay=terracotta, stoneware", "fp_materialinnov"),
]
table = [{"name": n, "fields": f, "source": URL[k]} for (n, f, k) in P]
table.append({"name": "Software and hardware pipeline", "fields": "design=Rhino + Grasshopper; toolpath=Silkworm (Mamou-Mani, Holloway, Kjelstrup-Johnson, Jipa); render=Maxwell/Keyshot/V-Ray (2018); structural=FORMAT Engineers, Arup; platform=Dassault 3DEXPERIENCE (Aurora); optimisation=genetic algorithms (Flying Whales); printers=WASP4070, WASP3MT (2018), large robot arm, Mobile Factory (smaller robot arm in shipping container), byFlow, Delta Tower; PLA filament=Excelfil (Voltivo)", "source": URL["p3dind"] + " ; " + URL["tate"] + " ; " + URL["aurora"]})
table.append({"name": "Public collaborations and partners", "fields": "JV=Therme Group (Fab.Pub, 2021); engineers=Format Engineers (James Solly, Stephen Melville), Arup, Webb Yates, BuroHappold, Ramboll (testimonial), Terrel Group; clients=COS, Fortnum & Mason, Dassault Systemes, Hermes/RDAI, Orange, Neko Health, Hyundai/Tate, Roe/Studio Gossamer, Photoclimat, Ithra/Abywat, Balich Wonder Studio; fabrication partners=WASP, Superforma, FabLab Venice, Design for Craft, Plantura, byFlow, Acrylicize, Xylotek; academia=University of Westminster, IAAC, PAACADEMY; initiative=Circularity in Practice signatory", "source": URL["about"] + " ; " + URL["conifera"] + " ; " + URL["wallpaper"]})
table.append({"name": "Stated material limits, by topic", "fields": "moisture=only end-of-life sentence (humidity speeds composting); fire=additive compounding (Roe, RIVA, Fab.Shield), no class published; durability=qualitative (Conifera outdoors, WOW!House 3 yr unchanged, Altostrata 'resist weathering'); recyclability=take-back crush-pelletise-reprint, conditional; industrial compost 60 C/100 % humidity/1 month; scale=Altostrata 2.7 m modules, Roe 20 kg modules, RIVA 3 x 1.9 m single print, Monolith 12 x 7.5 m; cost=PLA more expensive than petroleum plastic, Galaxia 'every penny' fundraised, min Fab.Pub order GBP 250 / 2 weeks; strength=sand weak (Sandwaves), PLA under-researched, one invalid pull-test unit", "source": URL["altostrata"] + " ; " + URL["frederic"] + " ; " + URL["therme_interview"] + " ; " + URL["riva"]})

KEY = [
("F05", "altostrata"), ("F16", "wallpaper"), ("F12", "riva"), ("F03", "altostrata"),
]
fd = {f["id"]: f for f in findings}
key_claims = [
 {"claim": "The practice itself states the central design contradiction: durable use versus biodegradability. PLA is chosen as a 'middle ground' that only composts industrially (founder, Frederic 2024, Dezeen 2019; Altostrata page 2023).", "source": fd["F05"]["source"] + " ; " + fd["F20"]["source"], "evidence_quote": fd["F20"]["evidence_quote"]},
 {"claim": "No quantitative moisture, UV, creep or weathering data are published by Mamou-Mani or Fab.Pub. Durability evidence is qualitative: Conifera modules left outdoors, WOW!House reused 3 years 'hasn't changed', Altostrata 'engineered to ... resist weathering'. The only moisture sentence concerns composting.", "source": fd["F16"]["source"] + " ; " + fd["F19"]["source"], "evidence_quote": fd["F16"]["evidence_quote"]},
 {"claim": "Fire is handled by additives per project (Roe 'compounded with fireproof materials', RIVA 'non-toxic fire retardant', Fab.Shield blend) and no fire class or test result is published.", "source": fd["F12"]["source"] + " ; " + fd["F10"]["source"] + " ; " + fd["F13"]["source"], "evidence_quote": fd["F12"]["evidence_quote"]},
 {"claim": "The only structural test on any practice page is one in-house pull test reported in an invalid unit (500 kg.m2); the founder concedes PLA is 'not very well researched'. A machine-checked, unit-correct property envelope would be new to them.", "source": fd["F03"]["source"], "evidence_quote": fd["F03"]["evidence_quote"]},
]

summary = (
"Fetched about 30 pages of the practice's own site, 19 Fab.Pub pages and 7 press pieces on 2026-11-12 as raw HTML (sha256 in data/mamou-mani/manifest.tsv) and extracted 77 verbatim-checked findings. "
"The portfolio is larger and more varied than the earlier spec-partner-architecture record: about 30 listed projects from Cloud Capsule (2014) to Tate Modern (2025-26), in four material families: (a) PLA bioplastic printed on robot arms (Conifera 700 modules, Altostrata 12 modules, The Roe 30 x 20 kg modules, RIVA 3 x 1.9 m single print, Harmonic Tides, WOW!House); (b) timber and rattan (Galaxia 60 m x 20 m, 18,000 screws at 1.8 kN each; THK Tower 96 t ulin; Concordia; Catharsis); (c) sheet metal and ceramics (Smile, IWAN, Hermes facade, RIVA exterior); (d) sand (Sandwaves, 58 x ~160 kg). Fab.Pub has moved beyond PLA: recycled PETG (Neko Health Monolith Wall, 260 panels, 12 x 7.5 m, >800 robot-hours) and bamboo-filled PLA/PETG compounds (Tate), plus a named flame-retardant blend Fab.Shield. "
"Philosophy in their words: designs 'emerge from the constraints of reality rather than through ego-led geometry'; the architect as 'a gardener'; circularity 'begins before a material is selected'. Pipeline: Rhino/Grasshopper, the open-source Silkworm G-code plugin (four co-authors), Dassault 3DEXPERIENCE, genetic algorithms, WASP printers (2018), robot arms and a shipping-container Mobile Factory. "
"Material limits they state: PLA composts only industrially (60 C, 100% humidity, about a month), PLA is costlier than petroleum plastic and 'not very well researched', sand is weak, budget and time dominate temporary work. Moisture is almost unaddressed; fire is solved by additives with no published class; durability evidence is anecdotal (Conifera outdoors, WOW!House 3 years). "
"Their sustainability numbers disagree: PLA carbon saving 68% (Dezeen 2019), 80% (several), 73.7% (computed from Aurora LCA), 75.5-83.7% (computed from the Altostrata per-kg figures); toxicity 30x vs 50x. "
"Contradictions with earlier files are listed in findings F04, F13, F38, F39 and in recommendations. Not found: any item called Triumphant Fantasia, any Mamou-Mani project called Spiral (Galaxia is the spiral Burning Man temple), any measured water uptake, expansion or diffusivity, any fire class."
)

lay = ("Mamou-Mani is a London architecture studio that designs shapes with computer code and then has them made, often by 3D printing in plant-based plastic. "
"Think of a giant Lego-like canopy of 700 printed bricks, or a 60-metre timber temple built from ordinary planks and 18,000 screws and then burned on purpose. "
"The studio says openly that its plastic has a built-in tension: it should last, yet it should also be able to rot away when you want it to. "
"It publishes almost no hard numbers on water, sun or fire resistance, and one strength test is quoted in a unit that makes no physical sense. "
"That gap is where a new, carefully measured material could be useful to them.")

glossary = [
{"term":"PLA","plain":"A plastic made from fermented plant sugar that can be melted and printed."},
{"term":"PETG","plain":"A common clear, tough plastic, here used in recycled form."},
{"term":"Parametric design","plain":"Designing with rules and numbers so that changing one number reshapes the whole design."},
{"term":"G-code","plain":"The line-by-line instructions that tell a 3D printer where to move."},
{"term":"Silkworm","plain":"A free add-on that turns shapes drawn in Rhino and Grasshopper into printer instructions."},
{"term":"Lattice hinge","plain":"Cutting thin slits in a stiff sheet so it can bend."},
{"term":"Industrial composting","plain":"Breaking plastic down in a hot, humid, managed plant rather than a garden heap."},
{"term":"Take-back scheme","plain":"The maker collects used products to crush and reprint them."},
{"term":"LCA","plain":"Life-cycle assessment: adding up the climate cost of a product from raw material to disposal."},
{"term":"Flame retardant","plain":"An additive that makes a material harder to set alight."},
{"term":"Truss","plain":"A frame of straight pieces arranged in triangles to carry load."},
{"term":"Fab.Pub","plain":"The studio's sister company that runs its printers and workshop."},
{"term":"Hygromorph","plain":"A material that bends or changes shape as it takes up or loses moisture."},
]

recs = [
"Lead with their own sentence: 'there is a contradiction between the idea of sustainable or durable and biodegradable' (Frederic 2024; also the Altostrata page). Propose a material whose stability and decay are both specified and measured.",
"Offer what they lack: a unit-correct datasheet (modulus, strength, water uptake, expansion per % moisture, softening temperature) with test methods. Their only structural number is '500 kg.m2' and they say PLA is 'not very well researched'.",
"Moisture is the open ground: the practice has never published uptake or movement of its PLA blends, and their wood-, bamboo- and paper-filled blends (Fab.Grain, Fab.Zen, Paper PLA) are exactly the class known to be hygroscopic. Ask whether they treat that movement as a defect. A bilayer with the proved 3/2 curvature ceiling is a deliberate use of it.",
"Design the proof of concept to match their module culture: interlocking modules, reversible joints (cable ties, slotted shells, male/female connections), translucent or filled finish for backlighting, lattice infill tuned for weight, stiffness and light (as they did for the Tate platforms). Deliver the Grasshopper definition.",
"Match the process gap honestly: they print on robot arms with pellets and filament (PLA, PETG, filled blends), not resin or powder. Formlabs prints prove geometry and mechanism; a second step on Fab.Pub's extruder is needed to show their loop (crush, pelletise, reprint). Their stated minimum is GBP 250 and 2 weeks.",
"Do not quote their carbon percentages as fact; cite the Aurora LCA figures with the computed 73.7% and note the three other values.",
"Questions to ask them directly: fire classification of Roe/RIVA modules; the meaning of '500 kg.m2'; what Conifera modules did after outdoor exposure; whether Fab.Shield has a test report.",
]

could = [
"Any item called 'Triumphant Fantasia' by Mamou-Mani: absent from every saved page (grep), and two web searches returned unrelated music results.",
"A Mamou-Mani project called 'Spiral' or 'Spira': none found; Galaxia (2018) is the spiral Burning Man temple; Wallpaper* and 3D Printing Industry do not name an earlier one.",
"Any measured water uptake, hygroscopic expansion, diffusivity, UV, creep or fire-class result for their PLA, PETG or filled blends, on any practice, Fab.Pub or press page read.",
"Conifera total mass (3.5 t) from 3dprinting.com: that page returned HTTP 403 in this run, so earlier agent's figure is unverified here; the practice's own page gives no mass.",
"karamba3d.com Galaxia page returned HTTP 403, so a structural-analysis-software claim could not be checked; Karamba is not claimed.",
"Smile/Orange HQ, Miami Waves and Sandwaves-Dezeen details beyond what is cited: Smile and Miami Waves are carried over from the earlier record and were not re-fetched.",
"Per-year ordering: the /projects/ grid years are not reliable (Catharsis 2020 on the grid vs 2022 on its page; Galaxia 2019 vs 2018; AZ Factory 2026 vs 2021). I used the year printed on each project page.",
"Machine models for the Roe/Altostrata robot printers, nozzle sizes and build envelopes: not stated; only WASP4070 and WASP3MT (2018 mandala) are named.",
"Altostrata structural test report, Aurora module count, The Wavery module count.",
]

reproduce = [
{"what":"Download all pages (raw HTML, sha256, text) used here","command_or_url":"python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mamou-mani-portfolio/fetch_pages.py","expected":"One line per page: key, URL, date, byte size, sha256; files land in D:/Users/ashenoy00000/delphi-work/data/mamou-mani/ (about 8 MB total). Pages change over time, so hashes may differ later. Python 3.14 stdlib only."},
{"what":"Check every evidence quote appears verbatim in the saved page","command_or_url":"python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mamou-mani-portfolio/check_quotes.py","expected":"'checked 77 failures 0'"},
{"what":"Recompute the carbon, mass and hours figures","command_or_url":"python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mamou-mani-portfolio/calc.py","expected":"Aurora saving 6556.53 kg (0.7375); Altostrata 0.755 and 0.8367; Roe 600 kg and 450-600 h; Sandwaves 9280 kg; Monolith 3.08 h/panel"},
{"what":"Verify the citation DOIs resolve on Crossref","command_or_url":"python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mamou-mani-portfolio/verify_dois.py","expected":"Five lines with matching titles, e.g. 10.1002/ad.1912 'Entrepreneur Makers: Digitally Crafted, Crowdfunded Pavilions' (2015)"},
{"what":"Find any quote in context","command_or_url":"python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mamou-mani-portfolio/ctx.py altostrata \"500 kg\" 200","expected":"The sentence 'Our in-house tests with ARUP and Fab Pub have proven a resistance to pull forces of 500 kg.m2.'"},
{"what":"Rebuild this JSON","command_or_url":"python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mamou-mani-portfolio/build.py","expected":"Writes D:/Users/ashenoy00000/delphi-work/agents2/bm-mamou-mani-portfolio.json"},
]

citations = [
{"authors":"Mamou-Mani A, Burgess T","year":2015,"title":"Entrepreneur Makers: Digitally Crafted, Crowdfunded Pavilions","venue":"Architectural Design","doi_or_arxiv":"10.1002/ad.1912","verified":True,"how_verified":"Fetched https://api.crossref.org/works/10.1002/ad.1912 on 2026-11-12 (verify_dois.py); title, author and abstract returned","used_for":"Peer-reviewed record of the practice's digital self-build ethos"},
{"authors":"Slavkovic V, Hanzelic B, Plesec V, Milenkovic S, Harih G","year":2024,"title":"Thermo-Mechanical Behavior and Strain Rate Sensitivity of 3D-Printed Polylactic Acid (PLA) below Glass Transition Temperature (Tg)","venue":"Polymers","doi_or_arxiv":"10.3390/polym16111526","verified":True,"how_verified":"Fetched Crossref record this run; abstract states Tg of 65 C and modulus 1045.7 MPa glassy vs 1.2 MPa rubbery","used_for":"Independent heat limit of the PLA the practice uses outdoors in Singapore/Dubai"},
{"authors":"Algarni M","year":2021,"title":"The Influence of Raster Angle and Moisture Content on the Mechanical Properties of PLA Parts Produced by Fused Deposition Modeling","venue":"Polymers","doi_or_arxiv":"10.3390/polym13020237","verified":True,"how_verified":"Fetched Crossref record this run (abstract read; no number relied on)","used_for":"Independent evidence that moisture content changes printed PLA properties, the property the practice never reports"},
{"authors":"Cheng T, Tahouni Y, Sahin ES, et al.","year":2024,"title":"Weather-responsive adaptive shading through biobased and bioinspired hygromorphic 4D-printing","venue":"Nature Communications","doi_or_arxiv":"10.1038/s41467-024-54808-8","verified":True,"how_verified":"Fetched Crossref record this run; abstract read","used_for":"Precedent: printed cellulosic humidity-responsive facade shading, not present in any Mamou-Mani page"},
{"authors":"Correa D, Papadopoulou A, Guberan C, et al.","year":2015,"title":"3D-Printed Wood: Programming Hygroscopic Material Transformations","venue":"3D Printing and Additive Manufacturing","doi_or_arxiv":"10.1089/3dp.2015.0022","verified":True,"how_verified":"Fetched Crossref record this run; abstract read","used_for":"Precedent for wood-filled printed composites that move with humidity (relevant to Fab.Grain-type blends)"},
]

out = {
 "label": "bm-mamou-mani-portfolio",
 "topic": "Mamou-Mani Architects: what they build and how",
 "summary": summary,
 "lay_summary": lay,
 "glossary": glossary,
 "findings": findings,
 "key_claims": key_claims,
 "table": table,
 "recommendations": recs,
 "reproduce": reproduce,
 "citations": citations,
 "could_not_find": could,
 "scripts_written": [r"D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mamou-mani-portfolio/" + f for f in ["fetch_pages.py","ctx.py","body.py","check_quotes.py","calc.py","verify_dois.py","findings_a.py","findings_b.py","build.py"]],
}
json.dump(out, open(OUT, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wrote", OUT, len(findings), "findings", len(table), "table rows")
