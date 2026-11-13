"""Part 2 of the assembly: pair rankings, ten best materials, narrative fields; writes the output JSON.
Run: python -E -P build_final_b.py"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from build_final import *  # noqa: F401,F403  (runs part 1: corpora checks, findings, rows)
from corpora import Q, SC

P = pairs['pairs']
R = pairs['rows']
sla = lambda p: R[p['a']]['process'] == 'SLA' and R[p['b']]['process'] == 'SLA'


def top(key, rev, n, filt=lambda p: True):
    return sorted([p for p in P if filt(p)], key=lambda p: (-p[key] if rev else p[key]))[:n]


def fmtp(p):
    return f"{p['a']} + {p['b']} (E ratio {p['modulus_ratio']:g}, water gap {p['dWater_pp']:g} pp, IPA gap {p['dIPA_pp']:g} pp, adhesion class {p['adhesion_class']})"


METHOD = ('Method (script pairs.py, saved): 19 materials = 12 Form 4-family SLA resins with full TDS plus 7 Fuse powders, 171 unordered pairs. '
          '(a) modulus contrast = ratio of post-cured tensile moduli; elastomers have no published modulus, so secant = stress at 50% elongation / 0.5 (own estimate: Flexible 80A V2 5.8, Flexible 50A 1.8, Silicone 40A 0.8, TPU 90A 12.2 MPa). '
          '(b) swelling contrast = absolute difference of 24 h water mass gain in percentage points (1 cm cube table; Flexible 80A V2 uses its +8% slab value; "<x" read as x). '
          '(c) adhesion class 3 = both resins are (meth)acrylate photopolymers on the same Form 4 (SDS), 1 = polysiloxane vs acrylate, SLA vs SLS, or two powders (no co-print). '
          'Combined = sum of the three tie-averaged ranks (lower is better).')
F('RANKING (a) modulus contrast, SLA pairs, top 6. ' + METHOD, 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-formlabs-all-resins/pairs.py (output pairs.json)', 'medium',
  ' | '.join(fmtp(p) for p in top('modulus_ratio', True, 6, sla)))
F('RANKING (a) modulus contrast using only published moduli (no elastomers): Rigid 10K 10000 MPa vs Tough 1000 932 MPa = 10.7x; vs Durable 1000 MPa = 10x; vs Tough 2000 V2 1800 MPa = 5.6x; Nylon 11 CF X-direction 5300 MPa vs Nylon 12 Tough 1450 MPa = 3.7x (powders).',
  'D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-formlabs-all-resins/pairs.py', 'high', '10000/932=10.73; 10000/1000=10; 10000/1800=5.56; 5300/1450=3.66')
F('RANKING (b) swelling contrast (water, 24 h), top 6 pairs, all involve Flexible 80A V2 (+8%) against a resin with <=0.7% cube uptake. Indicative only: slab and cube tests differ and a thick cube is still diffusion-limited at 24 h.',
  'pairs.py', 'low', ' | '.join(fmtp(p) for p in top('dWater_pp', True, 6)))
F('RANKING (b) swelling contrast with IPA as stimulus, SLA, top 5: all pair Flexible/Elastic 50A (+39.2%) with a rigid resin (<=0.4% IPA).', 'pairs.py', 'medium',
  ' | '.join(fmtp(p) for p in top('dIPA_pp', True, 5, sla)))
F('RANKING (c) adhesion compatibility: all 55 pairs among the 11 acrylate SLA resins are class 3 (shared (meth)acrylate chemistry on one printer). Every Silicone 40A pair, every SLA+SLS pair and every powder pair is class 1: no co-print, and no bonding evidence found. Evidence for class 3 is chemistry (SDS) plus a Formlabs blog statement, not a peel or shear test.',
  'pairs.py + SDS texts', 'low', 'class 3 = 55 pairs among the 11 acrylate SLA resins; no measured bond strength exists in any source read')
top_all = top('rank_sum', False, 10)
F('COMBINED RANKING of bilayer pairs (sum of ranks a+b+c, top 10): ' + ' || '.join(f'{i+1}. {fmtp(p)}' for i, p in enumerate(top_all)),
  'pairs.py', 'low', 'best pair: Rigid 10K + Flexible 80A V2 (rank-sum 49.5); next: Rigid 4000, Tough 2000 V2, Grey V5, Clear V5, Tough 1000 each with Flexible 80A V2. Silicone 40A pairs rank low only because adhesion is unknown.')

g = geo
F('BILAYER GEOMETRY (own calculation, scripts pairs.py): using the project-record law kappa = f(m,n) d_eps / h with ceiling 1.5 at m=n^(-1/2) (re-checked numerically: max f over a grid = 1.5), Flexible 80A V2 as swelling layer '
  '(d_eps = 1.03^(1/3)-1 = 0.0099 at 1 day, 1.07^(1/3)-1 = 0.0228 at 1 week, assuming isotropic swelling and an inert partner) and the 0.2 mm minimum wall for the thinner layer: '
  f"partner Tough 1000: optimum thickness ratio {g['Tough 1000']['m_opt']}, h={g['Tough 1000']['h_mm']} mm, kappa={g['Tough 1000']['kappa_opt_per_m']} /m (1 d), {g['Tough 1000']['kappa_opt_1week_per_m']} /m (1 wk); "
  f"Rigid 10K: ratio {g['Rigid 10K']['m_opt']}, h={g['Rigid 10K']['h_mm']} mm, kappa={g['Rigid 10K']['kappa_opt_per_m']} /m; "
  f"Flexible 50A: ratio {g['Flexible 50A']['m_opt']}, h={g['Flexible 50A']['h_mm']} mm, kappa={g['Flexible 50A']['kappa_opt_per_m']} /m (1 d), {g['Flexible 50A']['kappa_opt_1week_per_m']} /m (1 wk); "
  f"Silicone 40A: ratio {g['Silicone 40A']['m_opt']}, h={g['Silicone 40A']['h_mm']} mm, kappa={g['Silicone 40A']['kappa_opt_per_m']} /m (1 d), {g['Silicone 40A']['kappa_opt_1week_per_m']} /m (1 wk). "
  'Consequence: with a very stiff partner the optimum needs an active layer 8 mm thick (Rigid 10K), so the practical pairs are the soft ones. Caveats: modulus of Flexible 80A V2 falls as it swells (-26 Shore A), the slab thickness behind the 1-day figure is unstated, Flexible 50A and Silicone 40A uptake in the slab test is unknown (only cube values), thick layers swell slower.',
  'pairs.py', 'low', 'kappa at optimum: Silicone 40A 20.1, Flexible 50A 26.6, Tough 1000 5.4, Rigid 10K 1.75 per metre (1 day)')

TEN = [
    ('Flexible 80A Resin V2', 'swelling (active) layer: +8% mass / +3% volume in water in 1 day, 83A, elongation 230%, tear 28 kN/m; same acrylate family as everything rigid on Form 4; weakness: slab test only, softens 26 Shore A points'),
    ('Rigid 10K Resin', 'stiffest passive layer: 10-11 GPa, water <0.1%, HDT 238 C at 0.45 MPa, min layer 50 um; brittle (1-1.7%) and the Lean optimum then needs a very thick soft layer'),
    ('Tough 1000 Resin', 'best general passive layer: E 932 MPa, 180% elongation, water 0.0% (cube), measured on a Form 4, 70 C 12 min cure; best honest E contrast (160x secant) to Flexible 80A V2'),
    ('Flexible 50A Resin (ex Elastic 50A V2)', 'soft partner in the same chemistry: 55A, water 0.7%, but IPA 39.2%; E contrast only about 3x to Flexible 80A V2, which gives the best printable curvature (kappa 26.6 /m at optimum) if its slab swelling is low'),
    ('Silicone 40A Resin', 'inert soft layer: water <0.1%, ISO 10993-5/-10/-23 listed, Tg -107 C; but polysiloxane chemistry, Form 4/4B only, 100 um minimum layer, and no bonding evidence to acrylates'),
    ('Tough 2000 Resin V2', 'stiffer tough passive layer: 1800 MPa, water 0.19%, Form 4 data, same cure as Tough 1000'),
    ('Clear Resin V5 (Grey V5 equivalent)', 'only rigid resin with a measured slow water uptake: +3.23% mass and modulus down to 65% after 1 week (Grey V5); 25 um layers; transparent, useful as a visible active layer or window'),
    ('Durable Resin', 'hinge-class resin: 1.0 GPa, 55% elongation, IPA 5.1%, water <1% (coarse), 50 um layers; cheap compliant partner'),
    ('Nylon 11 Powder (Fuse)', 'only material with a bio-based claim (no percentage given); E 1.6 GPa, 40% elongation, D570 water 0.07% (older TDS) vs 0.4% (Pro TDS); the natural SLS structural partner; no co-print with resins'),
    ('TPU 90A Powder (Fuse)', 'soft SLS partner: 90A, 310% elongation, water 0.89%; flexible hinge or skin in powder; runner-up Nylon 12 Powder (1850 MPa, most data)'),
]
F('THE TEN BEST USABLE MATERIALS for a bilayer proof of concept (Form 4 non-medical resins first, two Fuse powders last): ' + ' || '.join(f'{i+1}. {n}: {w}' for i, (n, w) in enumerate(TEN)) +
  '. Runners-up: Rigid 4000 (4.1 GPa, 0.7% water), Grey V5, Tough 1500 V2, High Temp (HDT 238 C after 160 C cure), Nylon 12 Powder. Not recommended for the build: BioMed line (Form 4B/4BL only, medical), Alpha resins (Form Studio 1 only), Alumina 4N (needs a furnace, brittle ceramic).',
  'all TDS and product pages in the table rows', 'medium', 'selection is my judgement from the stated criteria: Form 4 availability, published full data, contrast, shared chemistry, biocompatibility')

F('CONFIRMS earlier finding: Nylon 11 Powder carries a bio-based claim in its TDS (no percentage or feedstock stated); the product page also calls it "our legacy" bio-based material. No bio-based claim was found in any other TDS text or product page read in this run (text search of all 54 TDS texts and 57 product pages).',
  'https://formlabs.com/products/nylon-11-powder/ ; ' + TDS + 'm/151bd67a83b2334f/original/-ENUS-Nylon-11-TDS.pdf', 'high', 'bio-based, percentage not given',
  'raw:nylon11__1115', 'Nylon 11 Powder is a high performance, bio-based nylon material')
F('Product-page wording for Nylon 11 Powder.', 'https://formlabs.com/products/nylon-11-powder/', 'high', 'legacy; bio-based',
  'page:nylon-11-powder', 'Nylon 11 Powder is our legacy strong, highly ductile bio-based material')

findings[:] = [f for f in findings if f]

KEY = [
    ('Flexible 80A Resin V2 gains +8% mass and +3% volume in 1 day in deionized water and +9% / +7% in 1 week (ASTM D471 slabs); it is the only current Formlabs resin with swelling large enough to drive a hygromorph, and it contradicts a blanket "under 1% in 24 h" for stock resins.',
     F80, Q('tbl:flexible-80a-resin-v2__3462', 'Deionized Water 1 day -26 +8% +3% 94%')),
    ('Every other Form 4-family resin gains 0.0-0.9% mass in water in Formlabs own 24 h 1 cm cube test (Clear V5 0.9, Tough 1000 0.0, Rigid 10K <0.1); no humid-air swelling or diffusivity exists for any of them.',
     SOLV, Q('solvent', 'Clear Resin V5 0.9 5.1 0.7 0.3 0.1 1.1 0.1 0.9 <0.1 0.3 0.2 0.2 0.8 0.7 0.8 0.5 0.5 0.9 <0.1')),
    ('Elastic/Flexible 50A takes 39.2% IPA in 24 h against under 0.1% for Rigid 10K (earlier finding confirmed): the largest solvent-swelling contrast between two Form 4 resins of the same chemistry.',
     SOLV, Q('solvent', 'Elastic 50A Resin V2 1.5 43.4 0.6 133.1 7.9 31.4 3.9 0.9 15.6 39.2 0.4 0.7 0.6 41.2 0.7 45.6 43.6 0.7 163.9')),
    ('All Form 4 SLA resins except Silicone 40A are (meth)acrylate photopolymers per their SDS (co-curable, so bilayer bonding is plausible); Silicone 40A is polysiloxane and no source supports its bonding to acrylates. No measured bond strength between any two Formlabs materials exists in the sources read.',
     'Safety Data Sheets (sds/ folder in MANIFEST.tsv)', Q('sds:flexible80av2__3497', 'Methacrylate monomer(s) 25-40')),
]

SUMMARY = (
    f'Fetched {DATE} (UTC): the Formlabs materials catalogue, the solvent-compatibility table, the data-sheet index, 57 product pages, 54 English technical data sheets (TDS, PDF; 7 more are web-format TDS pages) and 18 safety data sheets (all saved with URL, date, byte size and sha256 in data/formlabs-tds/MANIFEST.tsv). '
    f'The table has {len(rows)} rows: 23 current Form 4-family SLA resins (including casting, ceramic and colour bases), 7 Form 4B medical resins, 10 legacy or Form 3-only resins, and 8 powders (Nylon 12, 12 White, 12 Tough, 12 GF, 11, 11 CF, TPU 90A, and Polypropylene, which is no longer on the catalogue); Nylon 11 Pro and the six Alpha resins are in findings (web-format TDS). '
    'Per material: tensile and flexural modulus, UTS, elongation, Shore, HDT, density where published, 24 h cube water and IPA uptake, biocompatibility standards, minimum layer thickness, printers and the post-cure recipe from the TDS footnotes, state by state (green and post-cured). '
    'Main results. (1) Earlier agents are confirmed on the cube table (all current resins 0.0-0.9% water in 24 h; Elastic 50A V2 39.2% IPA vs Rigid 10K <0.1%) but one claim must be narrowed: Flexible 80A Resin V2 gains +8% mass and +3% volume in 1 day in water (+9%/+7% in 1 week) in its own TDS slab test, so "stock resins gain under 1%" is false for that resin, and the 0.7% quoted for Flexible 80A in the cube table is the V1 row. '
    '(2) The Grey V5 one-week water figures (+3.23% mass, modulus to 65%) are now read cleanly and confirmed. (3) Flexible 50A is the renamed Elastic 50A V2. (4) Chemistry: all Form 4 resins except Silicone 40A are methacrylate/urethane-methacrylate (SDS), so acrylate pairs can co-cure; Silicone 40A is polysiloxane with no bonding evidence. (5) Ranking: the best pairs are Flexible 80A V2 (active) with Rigid 10K, Rigid 4000, Tough 2000 V2, Grey/Clear V5 or Tough 1000 (passive); '
    'applying the project 3/2 law with the 0.2 mm wall limit, the printable curvature is best with soft partners (Flexible 50A 26.6 /m, Silicone 40A 20.1 /m at 1 day) because the optimum thickness ratio n^(-1/2) is impractical for stiff partners (8.3 mm of Flexible 80A V2 over 0.2 mm of Rigid 10K). (6) Gaps: no humid-air swelling, no diffusivity, no elastomer moduli, no measured adhesion, slab thickness of the 80A V2 test unstated. '
    'All swelling-based curvature numbers are own calculations with stated assumptions and should be replaced by coupon measurements.'
)
LAY = ('Formlabs sells about sixty liquid resins and a handful of nylon powders for its 3D printers. We downloaded the official data sheets for all of them and lined up how stiff each one is and how much water or alcohol it soaks up. '
       'Almost all of them barely drink water, less than one percent of their weight in a day, so they would hardly change shape in humid air. One soft resin is the exception: it swells about three percent in volume after a day in water, which is enough to make a thin strip bend. '
       'Think of a strip of wet paper stuck to a strip of plastic: the paper swells, the plastic does not, and the pair curls. The best pairs are that soft resin glued to a stiff one from the same chemical family. '
       'Nobody has published how strongly two Formlabs materials stick to each other, or how fast humid air gets into them, so the next step is a small printed test strip, not more reading.')
GLOSS = [
    ('SLA / resin printer', 'a printer that hardens liquid resin layer by layer with a violet light'),
    ('SLS / Fuse powder', 'a printer that fuses nylon or rubber powder layer by layer with a laser'),
    ('TDS / SDS', 'the maker\'s technical data sheet (properties) and safety data sheet (ingredients)'),
    ('Modulus (Young modulus)', 'how stiff a material is: the force needed to stretch or bend it a little; bigger means stiffer'),
    ('Secant modulus', 'a rough stiffness taken as stress at a fixed stretch divided by that stretch; used here where no modulus is published'),
    ('Shore A / Shore D', 'hardness scales from pressing a pin in; A for rubbers, D for hard plastics'),
    ('HDT', 'heat deflection temperature: the temperature at which a loaded bar starts to sag'),
    ('Green / post-cured', 'freshly printed and washed, versus after extra light and heat that finishes hardening it'),
    ('Swelling / mass gain', 'taking up water or solvent so the part gets heavier and bigger'),
    ('IPA', 'isopropyl alcohol, the liquid used to wash printed resin parts'),
    ('Bilayer', 'two thin layers of different materials bonded together; if one swells it bends the pair'),
    ('Curvature (kappa)', 'how tightly a strip bends, in 1/metre; 20 per metre means a circle of radius 5 cm'),
    ('Methacrylate / polysiloxane', 'the two chemical families here: plastic-like acrylics that cure together, versus silicone, which sticks poorly to other things'),
    ('Open Material Mode', 'a paid Formlabs setting that lets the printer run non-Formlabs resin or powder'),
    ('Neo-Hookean', 'a simple model of how rubber stretches, used to correct the rough stiffness estimate'),
]
RECS = [
    'Print a coupon set before any design work: Flexible 80A V2 strips (0.2, 0.5, 1 mm) bonded or co-printed to Tough 1000, Flexible 50A, Silicone 40A and Rigid 10K, soaked in water at 23 C and in 60/90% RH air; weigh and measure length and curvature at 1, 6, 24, 168 h. This replaces every estimated number in this report.',
    'Ask Formlabs (or test) the slab thickness behind the +8%/+3% result and run the same slab test on Flexible 50A, Tough 1000 and Rigid 10K so that swelling contrast is measured on one method.',
    'Treat Silicone 40A as a high-risk partner: run a peel test of Flexible 80A V2 or Tough 1000 cured against cured Silicone 40A before committing.',
    'Fuse route: no co-printing; if a powder bilayer is wanted, bond Nylon 11 and TPU 90A with an adhesive and test it; Nylon 11 is the only bio-based claim, ask Formlabs for the percentage.',
    'Beyond stock resins (Open Material Mode): the earlier agent found PEG-acrylate hydrogel resins swell 3.5-74% linearly (Maennel 2020, DLP printer, not Formlabs); that is the route to a much larger curvature; not re-examined here.',
    'Keep the IPA wash step in mind: elastomer bilayers will curl in it; design the wash time and fixture accordingly.',
]
REPRO = [
    ('Fetch index pages, one old TDS and the bonding pages', 'bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-formlabs-all-resins/fetch_pages.sh', 'materials.html ~1.55 MB, solvent.html ~0.33 MB, datasheets.html ~1.12 MB in scratch/bm-formlabs-all-resins (sizes drift if Formlabs edits pages; fetched 2026-11-12)'),
    ('Parse the solvent-compatibility table', 'python -I parse_solvent.py <scratch>/solvent.html <scratch>/solvent.json', '48 rows; Tough 1000 water=0, Elastic 50A Resin V2 IPA=39.2, Rigid 10K IPA=<0.1'),
    ('Build the data-sheet index', 'python -I build_index.py <scratch>/datasheets.html <scratch>/ds_index.json', '3580 records, 84 products'),
    ('Download product pages and English TDS (re-runnable, skips existing)', 'python -I fetch_all.py', '57 pages; 118 new files, about 41 MB in data/formlabs-tds; MANIFEST.tsv holds URL, size, sha256, time'),
    ('Safety data sheets for 18 key materials', 'python -I fetch_sds.py ; python -I sds_comp.py', 'Section 3 lists: Flexible 80A V2 methacrylate monomer(s) 25-40; Silicone 40A polysiloxane crosslinker 5-10'),
    ('PDF to text and table reconstruction (poppler pdftotext; PyMuPDF 1.28.2 via the legacy fitz import)', 'bash convert_pdfs.sh ; python -E -P tds_dump.py ; python -I build_materials.py ; python -I parse_all.py', '54 table dumps; materials.json and products.json'),
    ('Rank pairs and compute geometry', 'python -I pairs.py', 'prints max f = 1.5; top pair Rigid 10K + Flexible 80A V2 (rank-sum 49.5); kappa_opt 20.11 /m for Flexible 80A V2 + Silicone 40A'),
    ('Build table and final JSON (checks every quote verbatim against the saved sources)', 'python -I build_table.py ; python -E -P build_final_b.py', 'writes agents2/bm-formlabs-all-resins.json; fails if any evidence_quote is not found'),
    ('Spot-check by eye', 'render page 2 of rigid10k__910.pdf and page 6 of flexible-80a-resin-v2__3462.pdf (PyMuPDF get_pixmap)', 'Rigid 10K: 10 GPa and 1% cells span two columns; Flexible 80A V2 deionized water 1 day: -26, +8%, +3%'),
    ('Tools and versions', 'Python 3.14, PyMuPDF 1.28.2, poppler pdftotext, curl; user-agent delphi-research/0.1', 'no login, no email or account sent to any service'),
]
CITES = [
    dict(authors='Timoshenko, S.', year=1925, title='Analysis of Bi-Metal Thermostats', doi_or_arxiv='10.1364/josa.11.000233', verified=True, venue='Journal of the Optical Society of America 11',
         used_for='origin of the bilayer-curvature formula whose Lean-checked form (ceiling 3/2 at m^2 n = 1) is applied in the geometry calculation; the formula itself is taken from the project record, not re-derived here',
         how_verified='Crossref https://api.crossref.org/works/10.1364/JOSA.11.000233 returned title, year 1925 and author Timoshenko in this run'),
    dict(authors='Maennel, M. J.; Fischer, C.; Thiele, J.', year=2020, title='A Non-Cytotoxic Resin for Micro-Stereolithography for Cell Cultures of HUVECs', doi_or_arxiv='10.3390/mi11030246', verified=True, venue='Micromachines (PMC7143370)',
         used_for='pointer only: source of the PEG-acrylate swelling figures quoted by the earlier agent (not re-read in this run)',
         how_verified='Europe PMC REST search PMCID:PMC7143370 returned this DOI, title, authors and year in this run'),
]
CNF = [
    'Any humid-air (relative humidity) swelling strain or water diffusion coefficient for any Formlabs resin or powder: none in any TDS, product page or the solvent table.',
    'Slab thickness of the Flexible 80A V2 ASTM D471 test, and the same slab test (mass and volume) for any other resin; the cube table reports mass only, never volume.',
    'A published tensile modulus for Flexible 80A V2, Flexible 50A, Silicone 40A, TPU 90A or the BioMed flex resins: all secant values here are my estimates from stress at 50% elongation.',
    'Any measured adhesion (peel or shear) between two Formlabs materials, or Formlabs guidance on printing a second resin onto a cured part; only a blog statement that resins act as glue and anecdotal forum posts. Nothing for Silicone 40A against acrylates. I did not re-search for a Formlabs multi-material statement; the earlier agent found none.',
    'Minimum layer thickness on the product page for Tough 1000, Tough 1500 V2, Tough 2000 V2, Grey/Black/White V5, Flexible 80A V2, Color Base, BioMed Clear-less cases and the Alpha resins (TDS data at 100 um only; Form 4 range 25-200 um confirmed). Fuse 110 um layer not re-fetched; Fuse printer product URLs returned 404.',
    'Density for most resins (published only for Flexible 80A V2 1.09, ESD 1.116, Tough 1000/1500 V2/2000 V2 1.07-1.12, Clear V5 1.21 in the older TDS, TPU 90A 1.14, Nylon 11 Pro 1.03, Polypropylene 0.89 sintered); Shore D missing for Rigid 10K, Rigid 4000, Durable, V5 resins and High Temp in current TDS.',
    'Mass-change tables of the Tough 1000 / Tough 1500 V2 / Tough 2000 V2 ASTM D543 pages: only relative modulus/strength columns exist and their text extraction is scrambled; I did not use them.',
    'Dental resins (Dental LT, denture, surgical guide etc.) were deliberately not tabulated; Castable Wax 40, Ceramic Resin and True Cast have almost no mechanical data in their TDS.',
    'The Fuse 1+ and Form 4 pages give counts of materials that I could not reconcile with the earlier agent (23 vs 32 for Form 4).',
    'A bio-based percentage for Nylon 11; biocompatibility outcomes beyond the standard names listed on the TDS; the TDS for Nylon 11 Pro lists no biocompatibility standard in the page text I read.',
    'The older 13-page Clear V5 TDS I used for the Grey V5 immersion table is a staging PDF; the current TDS is 2 pages without it, so I cannot say whether Formlabs still stands behind those numbers.',
]
SCRIPTS = ['fetch_pages.sh', 'parse_solvent.py', 'build_index.py', 'fetch_all.py', 'fetch_sds.py', 'sds_comp.py', 'convert_pdfs.sh', 'tds_tables.py', 'tds_dump.py', 'build_materials.py',
           'parse_product.py', 'parse_all.py', 'show_materials.py', 'pairs.py', 'build_table.py', 'corpora.py', 'build_final.py', 'build_final_b.py']
SCRIPTS = ['D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-formlabs-all-resins/' + s for s in SCRIPTS]

result = dict(
    label='bm-formlabs-all-resins',
    topic='Every Formlabs resin and powder, as a design space',
    summary=SUMMARY, lay_summary=LAY, glossary=[dict(term=a, plain=b) for a, b in GLOSS],
    table=rows, findings=findings,
    key_claims=[dict(claim=c, source=s, evidence_quote=q) for c, s, q in KEY],
    recommendations=RECS,
    reproduce=[dict(what=a, command_or_url=b, expected=c) for a, b, c in REPRO],
    citations=CITES, could_not_find=CNF, scripts_written=SCRIPTS,
)
json.dump(result, open(OUT, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
print('wrote', OUT, 'rows', len(rows), 'findings', len(findings))
