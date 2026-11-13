"""Assemble D:/Users/ashenoy00000/delphi-work/agents2/bm-safety-lca.json from data_a/b/c.py, sds_table.json and the text blocks below.
Run order: sds_extract.py, calc.py, verify_quotes.py (must print FAILS 0), build_result.py"""
import json, os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_a import FIND_A
from data_b import FIND_B
from data_c import FIND_C

R = 'D:/Users/ashenoy00000/delphi-work/'
OUT = R + 'agents2/bm-safety-lca.json'
sds = json.load(open(R + 'agents2/scratch/bm-safety-lca/sds_table.json', encoding='utf8'))
url = {}
for line in open(R + 'data/formlabs-tds/MANIFEST.tsv', encoding='utf8', errors='replace'):
    p = line.rstrip('\n').split('\t')
    if len(p) > 1 and '/sds/' in p[1]:
        url[os.path.basename(p[1])] = p[0]

# findings -------------------------------------------------------------
findings = []
for claim, val, src, path, quote, conf in FIND_A + FIND_B + FIND_C:
    findings.append({'claim': claim, 'value': val, 'source': src, 'local_file': path.replace(R, ''),
                     'evidence_quote': quote, 'confidence': conf})

# table ----------------------------------------------------------------
table = []
for r in sds:
    f = r['file']
    is_powder = f.startswith(('nylon', 'tpu'))
    h = ','.join(r['H']) if r['H'] else ('none (combustible dust)' if f.startswith('nylon') else 'none (not classified hazardous)')
    fields = (f"GHS_hazard_statements={h}; classification={r['classification'][:170] or 'n/a'}; "
              f"flash_point={'n/a (solid powder)' if is_powder else r['flash_point'].replace(chr(0xfffd), ' ').replace('°', ' ')}; "
              f"named_photoinitiator={'; '.join(r['named_photoinitiator']) or ('n/a' if is_powder else 'trade secret (not named)')}; sds_revision={r['rev']}")
    table.append({'name': 'SDS ' + r['product'] + (' (EU CLP sheet)' if 'ENEU' in f else ' (US HazCom sheet)' if 'ENUS' in f else ''),
                  'fields': fields, 'source': url.get(f, '')})

WT = 'https://formlabs.com/support/Form-Wash-Time-Settings/'
for name, fields in [
    ('Wash Rigid 10K', 'wash_time=10 min + 10 min fresh solvent; own bucket (glass particles); solvent=IPA or TPM'),
    ('Wash Flexible 80A V2', 'wash_time=5 min + 5 min fresh solvent; Resin Washing Solution not recommended'),
    ('Wash Flexible 50A (ex Elastic 50A V2)', 'wash_time=20 min; do not exceed 20 min (part degrades); IPA_uptake_24h=39.2 % (project record); Resin Washing Solution not recommended'),
    ('Wash Silicone 40A', 'wash_time=20 min; solvent=80/20 IPA:n-butyl acetate in a dedicated Form Wash bucket, or IPA sonication procedure; never plain IPA otherwise'),
    ('Wash High Temp V2', 'wash_time=5 min; max 6 min total in solvent'),
    ('Wash Durable V2', 'wash_time=20 min; max 20 min total in solvent'),
    ('Wash Tough 1500 V1 for skin contact', 'wash=>=99 % IPA in Form Wash 20 min (standard 10+10 min); longer dry time if IPA pools'),
    ('Wash Tough 1500 V2', 'wash_time=10 min; Resin Washing Solution not recommended'),
    ('Wash Tough 2000 V2', 'wash_time=15 min'),
    ('Wash Clear/Grey V5', 'wash_time=5 min'),
    ('Wash bath maintenance', 'replace_IPA_at=10 % dissolved resin; TPM at 30-32 %; Form Wash V1 8.6 L, V2 15 L, Form Wash L 42 L'),
]:
    table.append({'name': name, 'fields': fields, 'source': WT if 'maintenance' not in name else 'https://formlabs.com/support/Replacing-IPA/'})

for name, fields, src in [
    ('Disposal liquid resin', 'route=chemical waste stream; else cure small amounts 1-10 days in sunlight then household waste; never drain; may be hazardous waste regionally', 'https://formlabs.com/support/Disposing-of-resin/'),
    ('Disposal cured resin and parts', 'route=household waste; recyclable=no (Formlabs statement)', 'https://formlabs.com/support/Disposing-of-resin/'),
    ('Disposal used IPA/TPM with resin', 'route=hazardous-waste service; tell them: methacrylated monomers/oligomers + trace photoinitiator; never drain', 'https://formlabs.com/support/How-can-I-dispose-of-resin-and-used-solvent/'),
    ('Disposal unsintered powder', 'route=local plastic-waste rules; vacuum bags and filters count as powder waste; recyclable=no', 'https://formlabs.com/support/Powder-care-storage-and-disposal/'),
    ('Disposal sintered powder and parts', 'route=household waste; recyclable=no (Formlabs statement)', 'https://formlabs.com/support/Powder-care-storage-and-disposal/'),
    ('Powder refresh Nylon 11', 'refresh=30 % (nitrogen) or 50 % (air); reused powder per build=70 % or 50 %', 'https://formlabs.com/eu/support/Using-Nylon-11/'),
    ('Powder refresh TPU 90A', 'refresh=20 %; reused powder per build=80 %', 'https://formlabs.com/products/tpu-90a-powder/'),
    ('Powder refresh Nylon 12', 'refresh=30 % on product page wording "up to 70% recycled powder"', 'https://formlabs.com/products/nylon-12-powder-10/'),
    ('Emission study Zhang 2022 (SLA + wash + cure)', 'TVOC_rate=over 4 mg/h; compounds=30 to over 100 per phase; exceeds OEHHA indoor levels for formaldehyde and naphthalene', 'https://doi.org/10.1021/acs.chas.2c00002'),
    ('Emission study Vaisanen 2021 (cured parts outgassing)', 'emission_day0=3000-14000 ug/m2/h; emission_day28=100-1000 ug/m2/h; reduction=84-96 %; at 37 C = 1.4-2.9x room temperature', 'https://doi.org/10.1080/15287394.2021.1998814'),
    ('Emission study Miller-Schulze 2025 (vat lid)', 'idle_emission_reduction_with_lid=70-97 %; Eco resin < Standard resin', 'https://doi.org/10.1021/acs.chas.4c00087'),
    ('Leachate Walpitagama 2019 (SLA plastic in water)', 'photoinitiator_1-HCHPK_leached=up to 200 mg/L in 24 h; extract LC50=22.25 % v/v (zebrafish embryo)', 'https://doi.org/10.1016/j.aquatox.2019.105227'),
    ('Isopropanol', 'flash_point=12 C closed cup; GHS=H225,H319,H336; occupational limit quoted=400 ppmV TWA (HSE, OSHA)', 'https://pubchem.ncbi.nlm.nih.gov/compound/Isopropyl-alcohol'),
    ('Bio-based content Arkema PA11 INVENT NAT (not Formlabs)', 'bio_based_carbon=100 % (ASTM D6866); feedstock=castor oil; refresh typically 50 %', 'https://hpp.arkema.com/assets/arkema/TDS_RILSAN%C2%AE%20PA11%20INVENT%20NAT_en_WW.pdf'),
    ('Bio-based content Formlabs Nylon 11', 'bio_based_percent=NOT STATED; supplier=not stated; SDS composition=polyundecanamide <100 %', 'https://media.formlabs.com/m/151bd67a83b2334f/original/-ENUS-Nylon-11-TDS.pdf'),
]:
    table.append({'name': name, 'fields': fields, 'source': src})

# claims matrix rows: what may and may not be said
CLAIMS = [
 ('CLAIM MAY: Nylon 11 powder is marketed by Formlabs as bio-based', 'Say exactly "Formlabs describes its Nylon 11 Powder as bio-based". Add: the percentage is not stated by Formlabs; the 100 % bio-based carbon (ASTM D6866) figure is Arkema\'s for its own PA11 grade.', 'https://formlabs.com/products/nylon-11-powder/'),
 ('CLAIM MAY: unsintered powder is partly reused', 'Say "30 % refresh with nitrogen, 50 % in air, so 70 % or 50 % of each build is reused unsintered powder" (Formlabs).', 'https://formlabs.com/eu/support/Using-Nylon-11/'),
 ('CLAIM MAY: printed with a documented skin-contact workflow', 'Only for Silicone 40A or Tough 1500 V2 (ISO 10993-5/-10/-23 pass) and only if the Formlabs wash/dry/cure recipe was followed.', 'https://media.formlabs.com/m/2e6bb2b3d645b427/original/-ENUS-Silicone-40A-TDS.pdf'),
 ('CLAIM MUST NOT: "recyclable" for resin or powder parts', 'Formlabs says cleaned parts and cured resin, and sintered powder and parts, cannot be recycled.', 'https://formlabs.com/support/Disposing-of-resin/'),
 ('CLAIM MUST NOT: "bio-based", "biodegradable", "compostable", "eco-friendly", "sustainable" as a bare adjective for any printed part', 'Generic environmental claims need recognised excellent environmental performance under Directive (EU) 2024/825 (applies from 2026-09-27); in the UK the CMA says broad claims are likely to mislead. Nylon 11 degradability is "no data" in the SDS. No resin is bio-based.', 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024L0825'),
 ('CLAIM MUST NOT: "non-toxic", "safe", "food-safe" or "skin-safe" for Rigid 10K, Flexible 80A V2, Flexible 50A, Durable V2, High Temp V2', 'These resins are skin sensitisers as liquids, no biocompatibility data for most, and two are Repr. 1B (H360). Even cured, outgassing and leaching are documented for photopolymers.', 'https://doi.org/10.1080/15287394.2021.1998814'),
 ('CLAIM MUST NOT: "low-VOC" or "GREENGUARD" for Form 4 parts', 'The UL GREENGUARD Gold certification is for Alpha resins on Form Studio 1 with the VOC Extractor, a printing-process certification.', 'https://formlabs.com/safety'),
 ('CLAIM MUST NOT: "lower carbon than conventional" for the Formlabs parts', 'No Formlabs life-cycle assessment exists in the sources found; published PA12 recycling LCA swings from -26 % to +68 % with allocation choice.', 'https://doi.org/10.1111/jiec.13277'),
 ('CLAIM MUST NOT: "TPO-free" or "photoinitiator-free"', 'Most SDS list photoinitiator as trade secret; only some name BAPO or TPO-L. TPO is Repr. 1B in the EU since 2025-09-01.', 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/tpo-nail-products-questions-answers_en'),
]
for n, f, s in CLAIMS: table.append({'name': n, 'fields': f, 'source': s})

key_claims = [
 {'claim': 'Every Formlabs SLA resin SDS read (14 products) classifies the liquid resin as a skin sensitiser (H317); Rigid 10K and Silicone 40A have H317 alone, while Durable V2 and High Temp V2 are also reproductive toxicants category 1B (H360) and Flexible 80A V2 and High Temp V2 cause serious eye damage (H318). Gloves, goggles and a sensitiser-aware workflow are therefore non-negotiable in lab and studio, and the two H360 resins should be excluded from a public-facing proof of concept.',
  'source': 'https://media.formlabs.com/m/3cc2feae0929233/original/-ENUS-Safety-Data-Sheet-Rigid-10K-Resin.pdf (and the 17 other SDS PDFs in the table)',
  'evidence_quote': 'H317 May cause an allergic skin reaction'},
 {'claim': 'Formlabs states that cleaned parts and cured resin cannot be recycled, that sintered powder and parts cannot be recycled, and that liquid resin and resin-laden IPA are potential hazardous waste. So nothing printed on a Formlabs machine may be called recyclable by the practice.',
  'source': 'https://formlabs.com/support/Disposing-of-resin/ ; https://formlabs.com/support/Powder-care-storage-and-disposal/',
  'evidence_quote': 'Cleaned parts and cured resin cannot be recycled.'},
 {'claim': "Formlabs calls Nylon 11 Powder 'bio-based' without any percentage or supplier; the only 100 % bio-based carbon (ASTM D6866, castor oil) figure found is on Arkema's own Rilsan PA11 INVENT NAT sheet and cannot be transferred. Bio-based carbon also says nothing about biodegradability or footprint.",
  'source': 'https://formlabs.com/products/nylon-11-powder/ ; https://hpp.arkema.com/assets/arkema/TDS_RILSAN%C2%AE%20PA11%20INVENT%20NAT_en_WW.pdf',
  'evidence_quote': 'Nylon 11 Powder is our legacy strong, highly ductile bio-based material.'},
 {'claim': "Under EU Directive 2024/825 (applies from 27 September 2026) 'biobased' and 'biodegradable' are named examples of generic environmental claims that are prohibited unless recognised excellent environmental performance can be shown; UK guidance is similar in spirit. An architecture client should be given specific, sourced statements only.",
  'source': 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024L0825',
  'evidence_quote': '‘biodegradable’, ‘biobased’ or similar statements that suggest or create the impression of excellent environmental performance.'},
]

summary = (
 "SAFETY. All 14 Formlabs SLA resins whose safety data sheets I read (18 sheets, 15 resin files) are skin sensitisers as liquids (H317). Rigid 10K and Silicone 40A carry only that class. Flexible 80A V2 and High Temp V2 cause serious eye damage (H318), and Durable V2 and High Temp V2 are classified reproductive toxicants 1B (H360), ingredient not disclosed. Flexible 50A's EU sheet adds H411 (aquatic) that its US sheet omits. The resins are not flammable (flash point above 93.5 C); the wash solvent isopropanol is (flash point 12 C, H225). Formlabs prescribes nitrile or neoprene gloves, glasses, three air changes per hour, and resin-specific wash times (Flexible 50A at most 20 min since longer 'may degrade parts', and it takes up 39 % IPA in 24 h; Silicone 40A needs an 80/20 IPA to n-butyl acetate bath in a dedicated bucket). Independent chamber studies find SLA printing, washing and curing emit 30 to over 100 VOCs (over 4 mg/h), idle open vats emit as much as printing (a lid cuts it 70-97 %), and cured parts keep outgassing, falling 84-96 % over 28 days. An SLA plastic leached photoinitiator at up to 200 mg/L into water in 24 h and the extract killed zebrafish embryos, which matters for any water-cycled hygromorph. Nylon powders are only combustible dust; SLS needs a grounded vacuum, humidity under 50 %, and an oxygen alarm if nitrogen is used. "
 "DISPOSAL. Liquid resin goes to a chemical waste stream (or is cured in sunlight 1-10 days), used IPA to a waste service, cured parts to household waste. "
 "RECYCLING AND LCA. Formlabs says cured resin, sintered powder and parts cannot be recycled; 30-50 % refresh means 50-70 % of the unfused Nylon 11 is reused in the next build, which is reuse, not recycling. No Formlabs life-cycle assessment was found; a PA12 recycling LCA ranges from 26 % lower to 68 % higher global warming potential than PA66 depending on allocation. "
 "BIO-BASED. Formlabs calls Nylon 11 'bio-based' with no percentage; 100 % bio-based carbon is Arkema's figure for its own grade. No resin is bio-based. EU Directive 2024/825 names 'biobased' as a generic claim to be avoided from 27 Sept 2026. "
 "VERSUS EARLIER AGENTS: confirms the Nylon 11 bio-based finding and the 39 % IPA uptake; deepens them. No earlier claim contradicted. Two data-hygiene flags: MANIFEST maps flexible50a_ENUS__2379.pdf to a URL that says Flexible-80A-Resin-V2 though the file is Flexible 50A, and 'Elastic 50A V2' is now named Flexible 50A."
)

lay = ("Printing liquid resin is a bit like handling a very strong glue: touching it again and again can give you a lasting allergy, so you wear nitrile gloves and goggles. "
       "The cleaning bath of isopropyl alcohol is the part that can catch fire, so it must be kept away from sparks. "
       "Once the plastic is washed and baked hard, it is much safer, but studies show it still gives off tiny amounts of fumes for about four weeks, and unreacted chemicals can wash out into water. "
       "Formlabs itself says the hardened parts and the used powder cannot be recycled, so they go in the bin. "
       "The nylon 11 powder is described as bio-based, but nobody has published how much, so an architect should never say it is green, recyclable or biodegradable. "
       "The honest sentence is narrow and sourced, like: made from a powder the maker calls bio-based, with the percentage unknown.")

glossary = [
 {'term': 'resin', 'plain': 'the liquid plastic that hardens under light in the printer'},
 {'term': 'photopolymer', 'plain': 'a plastic that turns from liquid to solid when light hits it'},
 {'term': 'skin sensitiser (H317)', 'plain': 'a chemical that can make the immune system react, so later contact causes rash, and the allergy can last'},
 {'term': 'SDS (safety data sheet)', 'plain': 'the legal safety sheet the maker must supply for each chemical product'},
 {'term': 'isopropyl alcohol (IPA)', 'plain': 'the rubbing-alcohol type liquid used to wash uncured resin off parts; it burns easily'},
 {'term': 'VOC (volatile organic compound)', 'plain': 'a chemical that evaporates into room air'},
 {'term': 'outgassing', 'plain': 'slow release of fumes from a finished, hardened part'},
 {'term': 'leaching', 'plain': 'unreacted chemicals washing out of a finished part into water'},
 {'term': 'bio-based', 'plain': 'made from plant or animal sources instead of oil; says nothing about whether it rots or is low-carbon'},
 {'term': 'PA11 / Nylon 11', 'plain': 'a nylon made from castor-oil chemistry, used as a laser-sintering powder'},
 {'term': 'ASTM D6866', 'plain': 'a radiocarbon test that tells what share of the carbon in a material came from recent plants'},
 {'term': 'refresh rate', 'plain': 'the share of fresh powder you must mix into the old powder for each new print'},
 {'term': 'recyclable', 'plain': 'able to be collected and made into new material of similar value'},
 {'term': 'life-cycle assessment (LCA)', 'plain': 'a method to add up the environmental impact of a product from raw material to disposal'},
 {'term': 'H360', 'plain': 'hazard code: may damage fertility or the unborn child'},
 {'term': 'reproductive toxicant 1B', 'plain': 'presumed to harm reproduction, based mainly on animal evidence'},
 {'term': 'combustible dust', 'plain': 'fine powder that can burn or explode if stirred into the air near a spark'},
 {'term': 'hygromorph', 'plain': 'a material that bends when it takes up moisture'},
]

recommendations = [
 "Use Rigid 10K (passive layer) and Silicone 40A or Flexible 80A V2 (active layer) only with nitrile or neoprene gloves, splash goggles (Flexible 80A V2 is H318), long sleeves, and a room with at least 3 air changes per hour; keep the vat lid closed when not printing and store finished parts 4 weeks in a ventilated place before they go near visitors.",
 "Exclude Durable V2 and High Temp V2 (H360, reproductive toxicity 1B) from a public-facing proof of concept and ask staff who are or may become pregnant not to handle them; ask Formlabs (sds@formlabs.com) which ingredient triggers H360 and whether TPO is present in any resin we use.",
 "Fix the wash recipe per resin before printing: Flexible 50A at most 20 min (swells about 39 % in IPA), Silicone 40A in a dedicated 80/20 IPA to n-butyl acetate bucket, High Temp at most 6 min; dry parts at least 30 min before post-cure; keep IPA in sealed labelled containers away from ignition sources.",
 "Plan disposal on day one: a chemical-waste contract (or the sunlight-cure route for small amounts), used IPA to a waste service, cured parts and powder cake to general waste; do not promise take-back or recycling.",
 "Water-cycling hygromorph parts should be extracted or tested before outdoor exposure: run a leachate test (soak 24 h in water, analyse for photoinitiator) and consider a barrier coating; the zebrafish work shows the hazard class, not our resin's number.",
 "Publish only narrow, sourced environmental statements. Allowed: 'made from Nylon 11 powder which the maker describes as bio-based (percentage not stated)'; '30-50 % of unfused powder is reused'. Not allowed: recyclable, biodegradable, compostable, eco-friendly, sustainable, low-VOC, GREENGUARD, non-toxic, skin-safe (except Silicone 40A/Tough 1500 V2 within the documented workflow), carbon-negative or any percentage saving without an LCA.",
 "If a bio-based percentage is wanted, request from Formlabs the supplier and a D6866 certificate for its Nylon 11 lot, or run our own radiocarbon test; if a real LCA is wanted, commission one (ISO 14040/44) with stated allocation, because published PA12 results swing from -26 % to +68 %.",
]

reproduce = [
 {'what': 'Download state check: the SDS PDFs used (18) already sit in data/formlabs-tds/sds; recompute hashes', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/sds_extract.py  (needs poppler pdftotext on PATH; writes scratch/bm-safety-lca/sds_table.json and sds_sha256.tsv)', 'expected': '18 SDS parsed'},
 {'what': 'Tallies of H-codes, Rigid 10K unlisted mass, IPA ratio, outgassing ratios', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/calc.py', 'expected': 'H317 14/14; H318 2/14; H360 2/14; H411 3/14; Rigid 10K unlisted 64.5-78 %; IPA 0.14 % of TWA'},
 {'what': 'Fetch the Formlabs support pages and regulation pages (curl, generic User-Agent) into data/safety-lca and log sha256', 'command_or_url': "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/fetch.sh  < urls.txt  (urls used: formlabs.com/support/{Disposing-of-resin,How-can-I-dispose-of-resin-and-used-solvent,Powder-care-storage-and-disposal,Replacing-IPA,Form-Wash-Time-Settings,Safety-Formlabs-SLA-printers,Safety-with-Formlabs-SLS-products}/, formlabs.com/eu/support/Using-Nylon-11/, formlabs.com/safety, formlabs.com/blog/resin-safety-resin-terms-faq/, eur-lex.europa.eu CELEX:32024L0825, single-market-economy.ec.europa.eu/sectors/cosmetics/tpo-nail-products-questions-answers_en, hpp.arkema.com TDS_RILSAN PA11 INVENT NAT)", 'expected': 'files plus data/safety-lca/MANIFEST.tsv (url, name, bytes, sha256, UTC time)'},
 {'what': 'Strip tags to searchable text', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/html2txt.py', 'expected': 'one *.html.txt per page'},
 {'what': 'Cache abstracts for cited DOIs (Europe PMC, Crossref fallback)', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/fetch_abstracts.py', 'expected': '14 abstracts saved (Crossref may return HTTP 429 if run too fast; rerun)'},
 {'what': 'Fetch PMC full text and grep (Baguley VOC review)', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/pmcgrep.py PMC12795753 "isopropanol emissions were 560"', 'expected': 'sentence with 560 ppbV vs 400 ppmV'},
 {'what': 'Scan 64 saved Formlabs product pages for bio-based/recyclable claims', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/claims_scan.py', 'expected': '64 pages scanned; pages with hits: 6 (only Nylon 11 Powder says bio-based)'},
 {'what': 'Verify every evidence quote against its saved source', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/verify_quotes.py', 'expected': 'findings 90 quotes checked 89 empty quotes 1 FAILS 0'},
 {'what': 'Rebuild this result file', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/build_result.py', 'expected': 'writes agents2/bm-safety-lca.json'},
 {'what': 'Citation checks', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/cr.py doi 10.1016/j.aquatox.2019.105227 10.1038/s41370-025-00778-y 10.1021/acs.chas.2c00002 10.1021/acs.chas.5c00076 10.1021/acs.chas.4c00087 10.1080/15287394.2021.1998814 10.1080/15298669291359375 10.1111/jiec.13277 10.1021/polymscitech.5c00144 10.1021/prechem.6c00065 10.3390/polym18182208 10.1021/accountsmr.5c00354 10.1016/j.isci.2025.113185 10.3390/ijms262311245', 'expected': 'each DOI resolves with matching title (Crossref returns HTTP 429 when called fast; wait and retry)'},
 {'what': 'Tools and versions', 'command_or_url': 'Python 3.14, poppler pdftotext (Git-for-Windows mingw64), curl; no third-party Python packages', 'expected': 'n/a'},
]

crossref = lambda d, extra='': f'Fetched https://api.crossref.org/works/{d} on 2026-11-12; title, journal, authors match. {extra}'.strip()
citations = [
 {'authors': 'Walpitagama M, Carve M, Douek A, Trestrail C, et al.', 'year': 2019, 'title': 'Additives migrating from 3D-printed plastic induce developmental toxicity and neuro-behavioural alterations in early life zebrafish (Danio rerio)', 'venue': 'Aquatic Toxicology', 'doi_or_arxiv': '10.1016/j.aquatox.2019.105227', 'verified': True, 'how_verified': crossref('10.1016/j.aquatox.2019.105227', 'Abstract read from Europe PMC (PMID 31226596).'), 'used_for': 'photoinitiator leaching 200 mg/L, LC50 22.25 % v/v'},
 {'authors': 'Baguley D, Evans G, Bard D, Monks P, et al.', 'year': 2025, 'title': 'Review of volatile organic compound (VOC) emissions from desktop 3D printers and associated health implications', 'venue': 'J Expo Sci Environ Epidemiol', 'doi_or_arxiv': '10.1038/s41370-025-00778-y', 'verified': True, 'how_verified': crossref('10.1038/s41370-025-00778-y', 'Full text read from Europe PMC PMC12795753.'), 'used_for': 'resin printer VOC types, IPA 560 ppbV, Form 2 data'},
 {'authors': 'Zhang Q, Davis A, Black M, et al.', 'year': 2022, 'title': 'Emissions and Chemical Exposure Potentials from Stereolithography Vat Polymerization 3D Printing and Post-processing Units', 'venue': 'ACS Chemical Health & Safety', 'doi_or_arxiv': '10.1021/acs.chas.2c00002', 'verified': True, 'how_verified': crossref('10.1021/acs.chas.2c00002', 'Abstract taken from the Crossref record.'), 'used_for': 'SLA TVOC over 4 mg/h; formaldehyde and naphthalene above OEHHA levels'},
 {'authors': 'Stefaniak A, Brusak E, Robinson S, Bowers L, et al.', 'year': 2025, 'title': 'Influence of Resin Color and Printer Brand on Emissions from Stereolithography (SLA) 3-D Printers', 'venue': 'ACS Chemical Health & Safety', 'doi_or_arxiv': '10.1021/acs.chas.5c00076', 'verified': True, 'how_verified': crossref('10.1021/acs.chas.5c00076', 'Abstract from the Crossref record.'), 'used_for': 'printer design dominates emissions'},
 {'authors': 'Miller-Schulze J, Williams N', 'year': 2025, 'title': 'Volatile Organic Chemical Emissions from Standard and "Eco" Resins for Vat Photopolymerization Additive Manufacturing ("3D") Printers', 'venue': 'ACS Chemical Health & Safety', 'doi_or_arxiv': '10.1021/acs.chas.4c00087', 'verified': True, 'how_verified': crossref('10.1021/acs.chas.4c00087', 'Abstract from the Crossref record.'), 'used_for': 'vat lid cuts idle VOC 70-97 %; Eco resin still near thresholds'},
 {'authors': 'Väisänen A, Alonen L, Ylönen S, Hyttinen M', 'year': 2021, 'title': 'Organic compound and particle emissions of additive manufacturing with photopolymer resins and chemical outgassing of manufactured resin products', 'venue': 'J Toxicol Environ Health A', 'doi_or_arxiv': '10.1080/15287394.2021.1998814', 'verified': True, 'how_verified': crossref('10.1080/15287394.2021.1998814', 'Abstract read from Europe PMC (PMID 34763622).'), 'used_for': 'cured-part outgassing falls 84-96 % in 28 days'},
 {'authors': 'Renard E, Goydan R, Stolki T, et al.', 'year': 1992, 'title': 'Permeation of multifunctional acrylates through selected protective glove materials', 'venue': 'Am Ind Hyg Assoc J', 'doi_or_arxiv': '10.1080/15298669291359375', 'verified': True, 'how_verified': crossref('10.1080/15298669291359375', 'Abstract read from Europe PMC (PMID 1543127).'), 'used_for': 'nitrile vs natural rubber for multifunctional acrylates'},
 {'authors': 'He D, Kim HC, De Kleine R, Soo VK, Kiziltas A, Compston P, Doolan M', 'year': 2022, 'title': 'Life cycle energy and greenhouse gas emissions implications of polyamide 12 recycling from selective laser sintering for an injection-molded automotive component', 'venue': 'J Ind Ecol', 'doi_or_arxiv': '10.1111/jiec.13277', 'verified': True, 'how_verified': crossref('10.1111/jiec.13277', 'Abstract read from Crossref and from the IDEAS/RePEc record.'), 'used_for': 'allocation-dependent GWP of recycled PA12'},
 {'authors': 'Wu Q, Sun Y, Wu S, et al.', 'year': 2026, 'title': 'Recyclable Photopolymers for Sustainable 3D Printing', 'venue': 'Polymer Science & Technology', 'doi_or_arxiv': '10.1021/polymscitech.5c00144', 'verified': True, 'how_verified': crossref('10.1021/polymscitech.5c00144', 'Abstract read from Europe PMC (PMID 42368474).'), 'used_for': 'conventional photopolymers are crosslinked and resist recycling'},
 {'authors': 'Jašek V, Přikryl R', 'year': 2026, 'title': '3D Printing Resins Involving Exclusively Bio-Based Compounds - Can Precursors for Commercial Vat Photopolymerization Comprise Only Biobased Molecules?', 'venue': 'Precision Chemistry', 'doi_or_arxiv': '10.1021/prechem.6c00065', 'verified': True, 'how_verified': crossref('10.1021/prechem.6c00065', 'Abstract read from Europe PMC (PMID 42953347).'), 'used_for': 'fully bio-based vat resins are still research; BAPO/TPO hazards'},
 {'authors': 'Bairapudi A, Kishore M, Reddy B, Sastry C, et al.', 'year': 2026, 'title': 'Sustainable Polymer Additive Manufacturing Across Scales: A Critical Review of Pallet-Scale Structural Opportunities and Membrane Feed Spacers', 'venue': 'Polymers', 'doi_or_arxiv': '10.3390/polym18182208', 'verified': True, 'how_verified': crossref('10.3390/polym18182208', 'Abstract read from Europe PMC (PMID 42797117).'), 'used_for': 'SLA process energy range; bio-based/recycled content not inherently sustainable'},
 {'authors': 'Brandolese A, Machado T, Dove A', 'year': 2026, 'title': 'Shaping a Circular Future with Bio-derived Resins in Additive Manufacturing', 'venue': 'Accounts of Materials Research', 'doi_or_arxiv': '10.1021/accountsmr.5c00354', 'verified': True, 'how_verified': crossref('10.1021/accountsmr.5c00354', 'Abstract read from Europe PMC (PMID 42687872).'), 'used_for': 'closed-loop and bio-derived photopolymers are research aims'},
 {'authors': 'Alijagic A, Suljevic D, Engwall M, Särndahl E, et al.', 'year': 2025, 'title': '3D printing: Balancing innovation for sustainability with emerging environmental and health risks', 'venue': 'iScience', 'doi_or_arxiv': '10.1016/j.isci.2025.113185', 'verified': True, 'how_verified': crossref('10.1016/j.isci.2025.113185', 'Abstract read from Europe PMC (PMID 40809003).'), 'used_for': 'plastic pollution and emissions risk framing'},
 {'authors': 'Łosiewicz B, Kamaszewski M, et al.', 'year': 2025, 'title': 'Preliminary Assessment of the Possible Environmental Risks of Photopolymerizing Resin Particles Produced by Finishing Stereolithography 3D-Printed Objects, Employing Toxicity Test on Tropical House Crickets (Gryllodes sigillatus)', 'venue': 'Int J Mol Sci', 'doi_or_arxiv': '10.3390/ijms262311245', 'verified': True, 'how_verified': crossref('10.3390/ijms262311245', 'Full text read from Europe PMC PMC12691734.'), 'used_for': 'sanding dust of cured SLA resin: no significant mortality difference'},
]

could_not_find = [
 "The identity of the ingredient causing H360 in Durable V2 and High Temp V2: the SDS name only 'Acrylated Monomer(s)' etc. as trade secret. Needs a request to Formlabs.",
 "Which photoinitiator (TPO, TPO-L, BAPO, other) is in Rigid 10K, Flexible 80A V2 (BAPO is named), Clear V5, Durable, High Temp and others: most SDS say only 'Photoinitiator(s)'. TPO status of any Formlabs resin unknown.",
 "Any leachate or extractables data (water, sweat, rain) for a named Formlabs resin: the zebrafish and other work uses unnamed SLA plastic. No measured photoinitiator release from Flexible 80A V2, Rigid 10K or Silicone 40A.",
 "Measured VOC emission rates for the Form 4 (LED, 405 nm) with any Form 4 resin: published chambers studies used Form 2 or other brands; Formlabs' own GREENGUARD data is for Alpha resins on Form Studio 1.",
 "A glove breakthrough time for nitrile against the actual Formlabs resin mixtures or for monofunctional methacrylates; only a 1992 study on multifunctional acrylates was found.",
 "Any life-cycle assessment or carbon footprint for a Formlabs resin, powder or printer; Fraunhofer IPA's PA11/PA12 project page gives no numbers.",
 "The supplier and bio-based carbon percentage of Formlabs Nylon 11 Powder; no ASTM D6866 certificate; and no biodegradation data for PA11 (SDS: no data available).",
 "A single authoritative waste code (EU List of Waste, UK) for cured and uncured Formlabs resin and for IPA-resin mixtures; Formlabs defers to local rules. I did not look up national codes.",
 "Whether Directive 2024/825 has been transposed in the UK or in the EU states relevant to a given client, and whether a B2B architectural claim is caught; I read only the Directive text and the UK CMA Green Claims Code guidance, not national laws.",
 "ISO 16620 or EN 16785 bio-based content certification for any Formlabs product: not found.",
 "The Oskui 2016 Environ Sci Technol Lett paper (10.1021/acs.estlett.5b00249; DOI resolves on Crossref) was not read: no abstract in Crossref or PubMed, so it is not used. Zhu et al. (seven resins, algae and fish mortality) was seen only second-hand in a citing paper and is not used.",
 "The PDF text of the Rigid 10K and Silicone 40A TDS ISO/biocompatibility and wash tables is extracted with pdftotext; column order can scramble, so numbers from the Arkema table (the 100 % value sits under the wrong label in the raw text) were cross-checked against the sheet's own intro sentence and a search snippet only.",
 "Heavy local commands were not needed: C: free space was about 0.3 GB (below the 1 GB limit), so nothing was written on C:; all downloads (about 3 MB) went to D:.",
]

result = {
 'label': 'bm-safety-lca',
 'topic': 'Safety, toxicology and sustainability of the printed resins (Formlabs Form 4 SLA resins and Fuse 1+ SLS powders): skin contact, VOC, leaching, handling, IPA washing, disposal, recyclability, life cycle, honest bio-based and sustainability claims',
 'summary': summary, 'lay_summary': lay,
 'findings': findings, 'key_claims': key_claims, 'table': table,
 'recommendations': recommendations, 'reproduce': reproduce, 'citations': citations,
 'could_not_find': could_not_find, 'glossary': glossary,
 'scripts_written': sorted('D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-safety-lca/' + f for f in os.listdir(os.path.dirname(os.path.abspath(__file__))) if f.endswith(('.py', '.sh'))),
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(result, open(OUT, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
chk = json.load(open(OUT, encoding='utf8'))
print('written', OUT, os.path.getsize(OUT), 'bytes;', len(chk['findings']), 'findings;', len(chk['table']), 'table rows;', len(chk['citations']), 'citations')
