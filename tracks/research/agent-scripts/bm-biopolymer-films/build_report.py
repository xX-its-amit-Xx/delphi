#!/usr/bin/env python3
"""Assemble agents2/bm-biopolymer-films.json from findings_a.py, findings_b.py and the static sections below.
Run validate_quotes.py first; this script refuses to write if any quote fails."""
import json, sys, subprocess, os
D = r"D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-biopolymer-films"
sys.path.insert(0, D)
if subprocess.run([sys.executable, "-X", "utf8", "-I", f"{D}/validate_quotes.py"], capture_output=True).returncode:
    sys.exit("quote validation failed")
from findings_a import FA
from findings_b import FB

findings = [dict(claim=f["claim"], source=f["source"], value=f["value"], confidence=f["confidence"], evidence_quote=f["quote"]) for f in FA + FB]

T = lambda n, fl, s: dict(name=n, fields=fl, source=s)
table = [
 T("Regenerated silk fibroin (RSF) freestanding film, methanol-treated", "strain_10to90RH=5.02 % (0% PEO) to 7.29 % (60% PEO porogen); film=3x10 mm freestanding; processing=LiBr dissolve, cast, MeOH 10 min", "https://par.nsf.gov/servlets/purl/10422709"),
 T("RSF (8 um) on polyimide (25 um) bilayer, Jung 2023", "h_total=33 um; RH=10<->90 %; bend_time=13-44 s; straighten=22-40 s; energy_density=3.1 MJ/m3 (porous optimum), 1.6 MJ/m3 (plain)", "https://par.nsf.gov/servlets/purl/10422709"),
 T("RSF tyrosine-sulfonated (8 um) on polyimide (25 um), Khan 2025", "delta_kappa=13 -> 21 cm^-1; energy_density=1.6 -> 3.5 MJ/m3; RH=10<->90 % in 10 min steps; cycles=not stated", "https://par.nsf.gov/servlets/purl/10616826"),
 T("B. subtilis cortex peptidoglycan (nanofilm)", "thickness_change=+50.1 % (5->90 %RH); volume=+65.2 %; layer=70.6 nm; tau=0.38 s dry / 0.24 s wet; energy=59.9 MJ/m3 (measured, AFM)", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9130901/fullTextXML"),
 T("B. subtilis cell-wall peptidoglycan (nanofilm)", "thickness_change=+27.2 %; volume=+45.8 %; layer=153 nm; tau=0.19 s / 0.11 s; E=4.91 GPa (5% RH) -> 1.77 GPa (90% RH); water=21 wt%", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9130901/fullTextXML"),
 T("Peptidoglycan + craft glue composite on Mylar/PDMS", "E=1.33 -> 0.47 GPa; response=~3 s (tau 2.34 s / 2.12 s); cycles=180000; degradation=5.17e-5 %/cycle; RH=5<->90 %; coating=11.6 um on glass fibre", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9130901/fullTextXML"),
 T("Bacillus spore monolayer on elastomer / cantilever", "energy_density=>10 MJ/m3; monolayer=submicrometre; strain/curvature=not in abstract", "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1038/nnano.2013.290&resultType=core&format=json"),
 T("Nanofibrillated cellulose (NFC) film, gradient bend", "h=8 um; kappa=0.3->0.75 cm^-1 (dRH 10->40 %); t_steady=tens of s; swelling=0.06 % (8 um), 0.09 % (48 um); h=38 um: 0.2 cm^-1", "https://users.aalto.fi/~rras/publications/62.pdf"),
 T("CNC film, self-organised (isotropic)", "CHS=0.040 %strain/%C; RH=0-97 %; method=polarised-light DIC", "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1021/acs.biomac.7b00026&resultType=core&format=json"),
 T("CNC film, shear-oriented", "CHS=0.02 %/%C parallel; 0.30 %/%C perpendicular to alignment (wood beech: 0.32 %/%MC from project record)", "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1021/acs.biomac.7b00026&resultType=core&format=json"),
 T("CNC (70 um, glucose) / polyurethane-AgNP (70 um) bilayer", "angle=70.5 deg in 60 s (horizontal); 144.2 deg in 14 s (vertical); revert=80 s / 71 s; cycles=5000; force=299.4 Pa", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8373155/fullTextXML"),
 T("Chitosan (DD 82.7 %) / 50 wt% MWCNT film", "t=20-40 um; strip=25x4 mm; cycles=100 (no obvious fatigue); curvature/strain=not given in main text; process=cast from 1 % acetic acid, dry 50 C", "https://eprints.whiterose.ac.uk/158026/1/d0nr00932f%20%281%29.pdf"),
 T("Chitosan film on CNT/PDMS", "kappa=3.91 cm^-1 (humidity), 3.84 cm^-1 (NIR light); thickness, RH step, cycles=not retrieved (abstract only)", "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1039/c9tb01841g&resultType=core&format=json"),
 T("Carboxymethyl chitosan / MXene gradient film", "angle=>140 deg in 3 s; dRH=40 %; cycles=>1000 (self-oscillation, >1 Hz); tensile=39.9 MPa", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13042369/fullTextXML"),
 T("Spider dragline silk fibre (torsion)", "twist=255 deg/mm (N. pilipes), 127 deg/mm (A. versicolor); RH=40->100 %; fibre d=3.1 / 6.7 um; supercontraction=up to 50 % length (quoted background)", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6397028/fullTextXML"),
 T("Gelatin film actuators (Kumar 2024)", "numbers=NOT RETRIEVED (publisher blocked fetch); title only", "https://api.crossref.org/works/10.1039/D4MA00015C"),
 T("Formlabs Flexible 80A Resin V2 (stock, comparison)", "D471 1 day DI water: +8 % mass, +3 % volume (~1.0 % linear, own calc), -26 Shore A; 1 week +9 % / +7 % (~2.3 % linear); E_secant~5.8 MPa (earlier agent estimate)", "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf"),
 T("Formlabs Rigid 10K / Elastic 50A V2 (stock, comparison)", "24 h cube: water <0.1 % / 0.7 %; IPA <0.1 % / 39.2 %; acetone <0.1 % / 43.4 %; acetic acid 5 %: <0.1 / 1.5", "https://formlabs.com/support/solvent-compatibility/"),
]

key_claims = [
 dict(claim="Cast silk fibroin films strain 5.0 to 7.3 percent in length between 10 and 90 percent RH, far above the 0.2 to 1 percent of stock resins (and above the roughly 1 percent linear equivalent of the best soft resin, Flexible 80A V2).",
      source="https://par.nsf.gov/servlets/purl/10422709 (doi 10.1039/d2sm01601j)",
      evidence_quote="5.02% (Æ1.05) for 0% PEO, 5.02% (Æ0.51) for 10% PEO, 5.74% (Æ1.01) for 20% PEO, 5.93% (Æ0.93) for 40% PEO, and 7.29% (Æ0.83) for 60% PEO"),
 dict(claim="A silk-on-backing bilayer works with a thin silk layer: 8 um silk on 25 um polyimide gives a 13 to 21 cm^-1 curvature change and bends in 13 to 44 s. The only backing tested is polyimide; no printed resin or nylon backing has been tested.",
      source="https://par.nsf.gov/servlets/purl/10616826 (doi 10.1039/d5sm00040h) and https://par.nsf.gov/servlets/purl/10422709",
      evidence_quote="This difference increased from 13 cm-1 to 21 cm-1 (Figure 1c,d), and raised WR energy density from 1.6 MJ m-3 to 3.5 MJ m-3"),
 dict(claim="Cellulose by itself is not a large-strain material: nanofibril film swelling is about 0.06 to 0.09 percent and the CNC isotropic coefficient 0.040 percent per percent moisture; only shear-aligned CNC across the alignment (0.30) approaches wood-like values.",
      source="https://users.aalto.fi/~rras/publications/62.pdf ; Shrestha 2017 doi 10.1021/acs.biomac.7b00026",
      evidence_quote="the swelling ratio of the 8-µm NFC film is estimated to be only about 0.06%; whereas for the 48-µm film, the swelling ratio is about 0.09%"),
 dict(claim="The statement that stock Formlabs resins gain under 1 percent in water holds for the 1 cm cube table but not for Flexible 80A Resin V2 on its own data sheet (ASTM D471: +8 percent mass, +3 percent volume in 1 day).",
      source="https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf",
      evidence_quote="Flexible 80A Resin V2 TDS ASTM D471, label Deionized Water spans these two rows (y=396 and y=405): 1 day -26 +8% +3% 94% 89% ; 1 week -27 +9% +7% 101% 88%"),
]

def C(authors, year, title, doi, used, venue, how="Crossref https://api.crossref.org/works/%s returned the record (title/year/journal match) on 2026-11-12; logged in scratch/bm-biopolymer-films/crossref_verified.jsonl"):
    return dict(authors=authors, year=year, title=title, doi_or_arxiv=doi, verified=True, used_for=used, venue=venue, how_verified=how % doi)

citations = [
 C("Jung, Khan, Podbevsek, Sudhakar, Tu, Chen", 2023, "Enhanced water-responsive actuation of porous Bombyx mori silk", "10.1039/d2sm01601j", "silk strain 5.0-7.3 %, bilayer times, processing", "Soft Matter"),
 C("Khan, Athiyarath, Podbevsek, Jung, et al.", 2025, "Modulating water-responsive actuation energy of regenerated silk fibroin via tyrosine modification", "10.1039/d5sm00040h", "silk bilayer curvature 13 -> 21 cm^-1, 8 um on 25 um", "Soft Matter"),
 C("Wang, Liu, Lao, Zhang, et al.", 2022, "High Energy and Power Density Peptidoglycan Muscles through Super-Viscous Nanoconfined Water", "10.1002/advs.202104697", "peptidoglycan strain, modulus, composite, cycles", "Advanced Science"),
 C("Chen, Mahadevan, Driks, Sahin", 2014, "Bacillus spores as building blocks for stimuli-responsive materials and nanogenerators", "10.1038/nnano.2013.290", "spore energy density >10 MJ/m3", "Nature Nanotechnology"),
 C("Wang, Tian, Ras, Ikkala", 2015, "Sensitive Humidity-Driven Reversible and Bidirectional Bending of Nanocellulose Thin Films as Bio-Inspired Actuation", "10.1002/admi.201500080", "NFC film curvature and 0.06 % swelling", "Advanced Materials Interfaces"),
 C("Shrestha, Diaz, Ghanbari, Youngblood", 2017, "Hygroscopic Swelling Determination of Cellulose Nanocrystal (CNC) Films by Polarized Light Microscopy Digital Image Correlation", "10.1021/acs.biomac.7b00026", "CNC hygroscopic swelling coefficients", "Biomacromolecules"),
 C("Li, Liu, Li, Huang, et al.", 2021, "Bioinspired Multi-Stimuli Responsive Actuators with Synergistic Color- and Morphing-Change Abilities", "10.1002/advs.202101295", "CNC/polyurethane bilayer angles, times, cycles", "Advanced Science"),
 C("Chen, Ge, Ye, Zhu, et al.", 2020, "Water transport facilitated by carbon nanotubes enables a hygroresponsive actuator with negative hydrotaxis", "10.1039/d0nr00932f", "chitosan/CNT film thickness and cycles", "Nanoscale"),
 C("Xu, Xu, Xu, Dai, et al.", 2019, "An ultra-large deformation bidirectional actuator based on a carbon nanotube/PDMS composite and a chitosan film", "10.1039/c9tb01841g", "chitosan humidity curvature 3.91 cm^-1", "Journal of Materials Chemistry B"),
 C("Xu, Ling, Li, Xu, et al.", 2025, "MXene/Carboxymethyl Chitosan Moisture Responsive Soft Actuator with Diode-Like Actuation for Versatile Applications Driven by Human Metabolism", "10.1002/advs.202507845", "carboxymethyl chitosan film >140 deg in 3 s", "Advanced Science"),
 C("Liu, Tarakanova, Hsu, Yu, et al.", 2019, "Spider dragline silk as torsional actuator driven by humidity", "10.1126/sciadv.aau9183", "silk fibre torsion and supercontraction background", "Science Advances"),
 C("Kumar, Siraj, Satapathy", 2024, "Vapor selective and controlled actuation of gelatin-based soft actuators", "10.1039/D4MA00015C", "only gelatin hygromorph paper located; title and one-line abstract only", "Materials Advances"),
 C("Zhang, Ding, Zhou, Ju", 2024, "Research Progress on Moisture-Sorption Actuators Materials", "10.3390/nano14191544", "review used as a pointer to silk origami films; no numbers taken", "Nanomaterials"),
]

lay_summary = ("Some natural materials swell when the air gets humid, and a thin strip with a swelling layer glued to a non-swelling layer curls like a drying leaf. "
 "The plastics Formlabs sells swell by only about a fifth of a percent to one percent, so they curl very little. "
 "Silk protein cast as a thin film swells by 5 to 7 percent while staying a hard solid, and an 8-micrometre silk coat on a plastic strip (thinner than a hair) curled to a radius under a millimetre in under a minute. "
 "Cellulose and chitosan films swell less or have been measured less well, and for gelatin I could not read the numbers. "
 "The catch is speed: the thicker the swelling layer, the slower it moves, so silk works as a thin coating on a printed backing and nobody has yet tested that backing with a Formlabs part. "
 "The first step would be a cheap bench test, a silk coating on a printed strip, before anything is shown to an architect.")

glossary = [
 dict(term="Hygromorph", plain="A material or shape that changes shape when the air gets more or less humid."),
 dict(term="Bilayer", plain="Two layers stuck together, one that swells and one that does not, so the pair bends."),
 dict(term="Silk fibroin", plain="The structural protein of silkworm silk, which can be dissolved and cast into films."),
 dict(term="Chitosan", plain="A plastic-like sugar polymer made from the shells of crabs and shrimp (from chitin)."),
 dict(term="Cellulose nanocrystals (CNC)", plain="Tiny rod-shaped crystals of plant cellulose that can be dried into a film."),
 dict(term="Peptidoglycan", plain="The sugar-and-protein mesh that forms the wall of bacteria."),
 dict(term="Curvature", plain="How tightly something bends: one divided by its radius of bend."),
 dict(term="Relative humidity (RH)", plain="How full of water vapour the air is, from 0 to 100 percent."),
 dict(term="Strain", plain="How much a length grows, as a percentage of the original length."),
 dict(term="Energy density", plain="How much work a material can do per cubic metre when it swells."),
 dict(term="Resin (Formlabs SLA)", plain="A liquid plastic that a laser or light hardens layer by layer."),
 dict(term="SLS powder", plain="Plastic powder melted into shape by a laser, such as nylon."),
 dict(term="Timoshenko ceiling", plain="A proven upper limit: a two-layer strip cannot curve more than 1.5 times the strain difference divided by its thickness."),
 dict(term="Methanol treatment", plain="A short alcohol bath that makes silk film stop dissolving in water."),
 dict(term="Dialysis", plain="Cleaning a solution by letting small salts pass out through a membrane."),
]

reproduce = [
 dict(what="Tools and versions", command_or_url="Python 3.14.2 (run with -X utf8 -I), poppler pdftotext 4.00, PyMuPDF 1.28.2 (for flex80a_table.py and flex80a_words.py only; run without -I), Windows Git Bash", expected="All scripts in D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-biopolymer-films/"),
 dict(what="Silk strain and bilayer times (Jung 2023)", command_or_url="python -X utf8 -I fetch_doc.py nsf_10422709 https://par.nsf.gov/servlets/purl/10422709 'WR strain' ; python -X utf8 -I show.py nsf_10422709 -g '7\\.29%'", expected="5.02/5.02/5.74/5.93/7.29 % WR strain; 'bend within 13-44 seconds and straighten within 22-40 seconds'"),
 dict(what="Silk bilayer curvature (Khan 2025)", command_or_url="python -X utf8 -I fetch_doc.py nsf_10616826 https://par.nsf.gov/servlets/purl/10616826 'cm-1' ; python -X utf8 -I show.py nsf_10616826 -g '13 cm-1'", expected="'13 cm-1 to 21 cm-1'; '8 um thick layer of RSF onto 3x4x0.025 mm polyimide'"),
 dict(what="Peptidoglycan", command_or_url="python -X utf8 -I epmc_text.py PMC9130901 'height change of,Young.s modulus,180'", expected="height +50.1 % (cortex), +27.2 % (cell wall); 4.91 -> 1.77 GPa; 180,000 cycles"),
 dict(what="Cellulose", command_or_url="python -X utf8 -I fetch_doc.py aalto_nfc https://users.aalto.fi/~rras/publications/62.pdf 'swelling ratio' ; python -X utf8 -I epmc_abs.py 'DOI:10.1021/acs.biomac.7b00026'", expected="0.06 % (8 um) and 0.09 % (48 um); CHS ~0.040, ~0.02 and ~0.30 %strain/%C"),
 dict(what="Chitosan and CNC/PU", command_or_url="python -X utf8 -I epmc_text.py PMC13042369 'bending angle' ; python -X utf8 -I epmc_text.py PMC8373155 'bending angle,cycles' ; python -X utf8 -I epmc_abs.py 'DOI:10.1039/c9tb01841g'", expected=">140 deg within 3 s; 70.5 deg in 60 s and 5000 cycles; 3.91 cm-1"),
 dict(what="Formlabs cube table", command_or_url="python -X utf8 -I fetch_doc.py formlabs_solvent https://formlabs.com/support/solvent-compatibility/ '' ; python -X utf8 -I parse_solvent.py", expected="Rigid 10K row mostly <0.1; Elastic 50A V2 IPA 39.2, water 0.7; Flexible 80A Resin water 0.7"),
 dict(what="Flexible 80A V2 D471 water row", command_or_url="python -X utf8 -I fetch_doc.py flex80a_v2_tds https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf '' ; python -X utf8 flex80a_words.py", expected="label 'Deionized Water' at y~402 between rows '1 day -26 +8% +3%' and '1 week -27 +9% +7%'. The PDF text layer scrambles row labels, so rows are matched by y position."),
 dict(what="Own arithmetic", command_or_url="python -X utf8 -I calcs.py", expected="f ceiling 1.5; silk bilayer needs >=2.9 % / 4.6 % strain; ceiling 22.8 cm^-1; Flexible 80A V2 ~1.0 % linear"),
 dict(what="Quote check and report", command_or_url="python -X utf8 -I make_texts.py ; python -X utf8 -I validate_quotes.py ; python -X utf8 -I build_report.py", expected="every quote reports OK; writes agents2/bm-biopolymer-films.json"),
 dict(what="Citation check", command_or_url="python -X utf8 -I crossref.py 10.1039/d2sm01601j 10.1039/d5sm00040h 10.1002/advs.202104697 10.1038/nnano.2013.290 10.1002/admi.201500080 10.1021/acs.biomac.7b00026 10.1002/advs.202101295 10.1039/d0nr00932f 10.1039/c9tb01841g 10.1002/advs.202507845 10.1126/sciadv.aau9183 10.1039/D4MA00015C 10.3390/nano14191544", expected="ok:true for each"),
 dict(what="Not reproducible", command_or_url="Search-engine summaries (WebSearch) that pointed me to papers", expected="Search results vary by day; every number in the report was re-read from the fetched file named in its source field. The silk modulus 7.2 GPa and the gelatin 7 mN/25x figures appear only in search summaries and are not used as findings."),
]

could_not_find = [
 "Gelatin: no curvature, strain, thickness, response time or cycle numbers. The only gelatin hygromorph paper found (Kumar 2024, doi 10.1039/D4MA00015C) is on rsc.org, which returned HTTP 403 to every automated fetch, and Europe PMC does not hold it.",
 "Chitin: no humidity-actuated film from chitin or chitin nanofibres turned up; chitosan is the only chitin-derived polymer with actuators found, and the chitosan papers fetched give no hygroscopic strain or curvature at a stated RH step (except 3.91 cm^-1 for chitosan on CNT/PDMS, abstract only).",
 "Humidity strain in percent for CNC films: Shrestha 2017 gives a coefficient per percent moisture content, and I did not retrieve the moisture-content change, so CNC strain at a stated RH step is not known (the 0.4 and 3 percent figures use an assumed 10 wt percent and are labelled as such).",
 "Young's modulus of cast silk film at dry and humid conditions. A search-engine summary quoted 7.2 GPa (methanol-treated silk) and 2.5 GPa for polyimide from Jung 2021 (doi 10.1039/D1SM00794G); rsc.org blocked the fetch, so those numbers are unverified and only used to bracket the modulus ratio n in a sensitivity table.",
 "Any silk, chitosan, CNC or gelatin layer cast on a cured Formlabs resin or a sintered nylon surface. All silk bilayers found use plasma-treated polyimide. Adhesion, wetting of printed resin by aqueous silk, and survival of the printed part in the methanol or acetic acid step are untested in the literature I found; my statements on Rigid 10K vs Elastic 50A in these solvents are inferences from the Formlabs IPA, acetone and acetic-acid columns, since methanol is not tested by Formlabs.",
 "Cycle life above 100 cycles for chitosan, above 5000 for CNC, and any cycle count for silk bilayers (neither silk paper states one). Peptidoglycan/glue composite is the only system with a six-figure count (180,000 cycles).",
 "Humidity step magnitude in the CNC/polyurethane paper (main text does not give the RH values; supplementary data not read) and in the chitosan/CNT paper (nitrogen at nominal 100 and 0 percent RH).",
 "Peptidoglycan strains are through-thickness AFM values on 70 to 150 nm layers; an in-plane strain of a printed or cast PG-glue layer was not given, and PG cannot presently be sourced in bulk for a building.",
 "Paywalled or blocked, not read in full: Kumar 2024 (RSC), Jung 2021 (RSC), Chen 2014 Nat Nanotechnol full text, Xu 2019 J Mater Chem B full text. The Nat Nanotechnol and J Mater Chem B entries rest on their abstracts.",
 "Headroom: free C: was 514 MB (below the 1 GB limit), so I ran no heavy local command; all downloads were under 3.5 MB and went to D:. One request to the Unpaywall service used that service's own public example address in its URL (not a personal address) and returned nothing useful.",
 "Disagreement kept, not smoothed: muscle energy density is 8 kJ/m3 in Jung 2023 but 0.8 kJ/m3 in Khan 2025; peptidoglycan headline 72.6 MJ/m3 vs 59.9 MJ/m3 cortex measurement inside the same paper; Flexible 80A uptake 0.7 percent (cube table, older Flexible 80A Resin row) vs 8 percent (V2 data sheet, D471).",
]

recommendations = [
 "Run one bench coupon before any design work: cast regenerated silk fibroin (target 10 to 50 um) on a post-cured Rigid 10K strip 0.2 to 0.4 mm thick (IPA-wipe, optionally plasma), methanol-stabilise, and measure curvature at 30, 60, 90 percent RH. Compare with the 3/2 ceiling: for a 0.3 mm total thickness and 5 percent strain it is about 250 m^-1 (radius 4 mm).",
 "Keep the active layer thin. Time grows roughly as thickness to the power 1.3 to 2, so 8 um bends in under a minute but a 1 mm silk layer would take hours to days (own scaling estimate). Design the printed part as the stiff, thin backing, not as the swelling layer.",
 "Do not put Elastic 50A or Silicone 40A through the methanol step: Elastic 50A takes up 39 percent IPA and Silicone 40A 5.9 percent, against under 0.1 percent for Rigid 10K (Formlabs table), and methanol is untested. Rigid 10K is the safest backing; chitosan (cast from 1 percent acetic acid) is gentler, since 5 percent acetic acid costs Rigid 10K under 0.1 percent.",
 "Measure, do not borrow, the silk modulus and free strain on your own films, and check whether the 21 cm^-1 sulfonated silk is near the 1.5 d_eps / h ceiling; this gives a second, independent test of the Lean-checked bound on a real biopolymer.",
 "Treat cellulose as a stiffening or anisotropy tool, not as the motor: NFC and isotropic CNC swell 0.04 to 0.09 percent; only aligned CNC across the alignment (0.30 percent per percent moisture) approaches wood.",
 "Obtain the gelatin paper (Kumar 2024) through a library or by contacting the authors before claiming anything about gelatin.",
]

summary = ("Survey of humidity-driven films from silk, chitosan, cellulose nanocrystals, gelatin and similar. The largest in-plane humidity strain in a cast, stiff, bulk-scale biopolymer film is regenerated silk fibroin at 5.0 to 7.3 percent (10 to 90 percent RH), against roughly 0.2 to 1 percent for stock Formlabs resins (about 1.0 percent linear for Flexible 80A V2 by my conversion of its data-sheet 3 percent volume gain). "
 "An 8 um silk layer on 25 um polyimide changes curvature by 13 to 21 cm^-1 and bends in 13 to 44 s, but silk has only been bonded to polyimide, not to printed resin or nylon. "
 "Bacterial peptidoglycan swells 27 to 50 percent in thickness with GPa modulus and a glue composite survived 180,000 cycles in about 3 s, but those strains are through-thickness AFM values on nanometre films. "
 "Cellulose films swell little (NFC 0.06 to 0.09 percent; CNC 0.04 percent per percent moisture, 0.30 across aligned CNC) and bend only when very thin; chitosan composites bend (3.91 cm^-1; more than 140 degrees in 3 s for a carboxymethyl chitosan/MXene film) without a published strain; for gelatin I could not read any numbers. "
 "Two earlier claims: I confirm the Formlabs cube table (Rigid 10K under 0.1 percent water and IPA, Elastic 50A V2 39.2 percent IPA) and I confirm, by reading the data-sheet table by coordinates, that Flexible 80A Resin V2 gains 8 percent mass and 3 percent volume in 1 day in water, which contradicts a blanket reading of 'every SLA resin under 1 percent'. "
 "A consistency check against the project's 3/2 curvature ceiling: no measured silk curvature exceeds it, and the sulfonated-silk value would be 92 percent of it if its free strain were about 5 percent.")

out = dict(label="bm-biopolymer-films", topic="Chitin, silk fibroin, cellulose nanocrystals and other biopolymer actuators: hygromorphic films, measured strain and curvature, and combination with a printed backing",
           summary=summary, lay_summary=lay_summary, findings=findings, key_claims=key_claims, table=table, recommendations=recommendations,
           glossary=glossary, reproduce=reproduce, citations=citations, could_not_find=could_not_find,
           scripts_written=sorted(f"D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-biopolymer-films/{n}" for n in os.listdir(D) if n.endswith(".py")))
dst = r"D:/Users/ashenoy00000/delphi-work/agents2/bm-biopolymer-films.json"
json.dump(out, open(dst, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wrote", dst, len(findings), "findings", len(table), "table rows", len(citations), "citations")
