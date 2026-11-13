"""Assemble the final result JSON for label bm-formlabs-all-resins.
Run (needs PyMuPDF for the old-PDF quote check):  python -E -P build_final.py
Every evidence_quote is checked to occur verbatim (whitespace-normalised) in the named saved source; the script fails otherwise.
Writes D:/Users/ashenoy00000/delphi-work/agents2/bm-formlabs-all-resins.json  (see OUT below) and prints a summary."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from corpora import Q, SC

OUT = 'D:/Users/ashenoy00000/delphi-work/agents2/bm-formlabs-all-resins.json'
DATE = '2026-11-12'
pairs = json.load(open(SC + '/pairs.json', encoding='utf8'))
rows = json.load(open(SC + '/table_rows.json', encoding='utf8'))
geo = {g['passive']: g for g in pairs['geometry']}
for r in rows:  # fetch date on every row
    r['fields'] += f'; fetched={DATE} (UTC, TDS/product pages 22:15Z, solvent page 22:14Z)'

TDS = 'https://media.formlabs.com/'
SOLV = 'https://formlabs.com/support/solvent-compatibility/'
F80 = 'https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf'
R10K = 'https://media.formlabs.com/m/522eb50e6c8ac0e3/original/-ENUS-Rigid-10K-TDS.pdf'
S40 = 'https://media.formlabs.com/m/2e6bb2b3d645b427/original/-ENUS-Silicone-40A-TDS.pdf'
OLD = 'https://formlabs-media.formlabs.com/filer_public/dd/7f/dd7f3de9-55ae-4c82-ac52-408a4b5df64d/clear_resin_v5_tds___formlabs.pdf'

findings = []


def F(claim, source, conf, value='', corpus=None, quote=''):
    q = Q(corpus, quote) if corpus and quote else ''
    findings.append(dict(claim=claim, source=source, confidence=conf, value=value, evidence_quote=q))
    return findings[-1]


# ---------------- catalogue scope ----------------
F('Formlabs catalogue (materials page filter counts): 64 SLA and 8 SLS materials; per printer, Form 4=32, Form 4B=46, Form 4L=24, Form 4BL=37 materials; Fuse 1+ 30W=8, Fuse X1=1, Fuse 1=4. '
  'This differs from the earlier agent (Form 4 validated with 23 materials, 4B with 38, read through a page summariser); I could not reconcile the two, the filter may count materials differently.',
  'https://formlabs.com/products/materials/', 'medium', 'SLA=64; SLS=8; Form 4=32; Form 4B=46; Form 4L=24; Form 4BL=37',
  'catalogue', 'Print Technology SLA 64 SLS 8')
F('Same page, printer filter counts.', 'https://formlabs.com/products/materials/', 'medium', 'Form 4=32 Form 4B=46 Form 4L=24 Form 4BL=37; Fuse X1=1 Fuse 1+ 30W=8 Fuse 1=4',
  'catalogue', 'Form 4 32 Form 4B 46 Form 4L 24 Form 4BL 37')
F('Form 4 layer thickness range 25-200 um (printer page); confirms the lower bound used for minimum printable layers. Fuse 110 um layer figure carried from the earlier agent, not re-fetched (Fuse product URLs I tried returned 404).',
  'https://formlabs.com/products/form-4/', 'high', '25-200 um', 'page:products_form-4', 'Layer Thickness⁸ 25–200 µm')
F('Polypropylene Powder has a TDS and a row in the solvent table, but no product page (HTTP 404 at /products/polypropylene-powder/) and the catalogue counts only 8 SLS materials, so it is not a currently sold Fuse powder. The earlier agent counted 9 powders including it. (The 404 is a fetch result, no page text to quote.)',
  'https://formlabs.com/products/materials/ ; https://formlabs.com/products/polypropylene-powder/', 'medium', 'SLS count 8 without PP; 8 = Nylon 12, 12 White, 12 Tough, 12 GF, 11, 11 CF, 11 Pro, TPU 90A')
F('Alpha resins (Alpha Black/Clear/Fast/Grey/Model/White) are Form Studio 1 resins; the product pages mark Form 4 as Incompatible (use Black Resin V5 instead) so they need Open Material Mode on a Form 4. Post-cured tensile modulus: Black 2240, Clear 2500, Fast 2540, Grey 2430, Model 2200, White 2190 MPa (max-strength post-cure); Shore D 65-74. The earlier agent noted them but did not tabulate them.',
  'https://formlabs.com/materials/tds/alpha-black-resin/ (and the five sibling TDS pages)', 'high', 'Black 2020/2240 MPa default/max-strength cure; Shore 72D',
  'page:alpha-black-resin__3859', 'Form 4 Form 4 Incompatible Use Black Resin V5')
F('Nylon 11 Pro Powder (TDS revision 1 Oct 2026): Fuse 1+ 30W only (nitrogen required); Fuse 1 incompatible; Fuse X1 available Q1/2027. Tensile modulus 1580 MPa, UTS 46 MPa, water absorption 0.4% (ASTM D570), density 1.03 g/cm3, Shore 75D.',
  'https://formlabs.com/materials/tds/nylon-11-pro-powder/', 'high', 'E=1580 MPa; water 0.4%; 75D',
  'page:nylon-11-pro__3868', 'Fuse 1 Fuse 1 Incompatible N/A Fuse 1+ 30W Supported Yes Fuse X1 Fuse X1 Supported (Available in Q1/2027) Yes')
F('Nylon 11 Pro water absorption on the TDS page is 0.4% by ASTM D570, against 0.07% for Nylon 11 Powder (older 2021 TDS); the two documents disagree about six-fold and neither states why (earlier agent saw the same).',
  'https://formlabs.com/materials/tds/nylon-11-pro-powder/ ; ' + TDS + 'm/151bd67a83b2334f/original/-ENUS-Nylon-11-TDS.pdf', 'high', '0.4% vs 0.07%',
  'page:nylon-11-pro__3868', 'Water Absorption (printed part) 0.4% ASTM D570')

# ---------------- water / swelling ----------------
F('CONFIRMS and DEEPENS earlier finding: Flexible 80A Resin V2 gains +8% mass and +3% volume after 1 day in deionized water (-26 Shore A points) and +9% mass / +7% volume after 1 week (ASTM D471 slabs wiped dry). '
  'The TDS does not state the slab thickness. This is the only current Formlabs resin with swelling large enough for a hygromorph.',
  F80, 'high', '1 day: hardness -26, mass +8%, volume +3%, elongation 94%; 1 week: -27, +9%, +7%, elongation 101%, strength 88% (rendered page 6 read visually, same numbers)',
  'tbl:flexible-80a-resin-v2__3462', 'Deionized Water 1 day -26 +8% +3% 94%')
F('Same table, 1 week row for deionized water.', F80, 'high', 'hardness -27; mass +9%; volume +7%; elongation 101%; tensile strength 88%',
  'tbl:flexible-80a-resin-v2__3462', 'Deionized Water 1 week -27 +9% +7% 101% 88%')
F('Method note: the Flexible 80A V2 test uses rectangular slabs evaluated immediately after wiping dry, a different method from the 1 cm cube used in the solvent table, so the two cannot be compared directly.',
  F80, 'high', 'ASTM D471 slabs vs 1 cm cube 24 h',
  'raw:flexible-80a-resin-v2__3462', 'Rectangular slabs, used for hardness, mass, and volume change, are evaluated immediately after wiping dry without a conditioning period.')
F('CONTRADICTS (in part) the claim, in the task brief and in spec-resin-chemistry.json, that stock Formlabs resins gain under 1% mass in 24 h in water. True for the 1 cm cube test (all current resins 0.0-0.9%), '
  'but Flexible 80A V2 gains +8% by the TDS slab test. spec-resin-chemistry.json also lists "Flexible 80A 0.7%" with IPA 11.7%: that is the older V1 row of the cube table (IPA 11.7 matches the V1 TDS), not V2. For V2 the TDS gives +45% mass in IPA after 1 day.',
  SOLV + ' ; ' + F80, 'high', 'cube row Flexible 80A Resin (V1): water 0.7, IPA 11.7; V2 slab: water +8%, IPA +45%',
  'solvent', 'Flexible 80A Resin 0.9 37.4 0.6 51.4 2.3 19.3 1 0.7 1.6 11.7 <0.1 0.1 0.5 10.7 0.6 28.6 13.6 0.7 64.1')
F('Formlabs 24 h / 1 cm cube water uptake (column Water) for current Form 4 SLA resins ranges 0 to 0.9%: Tough 1000 0; Rigid 10K <0.1; Silicone 40A <0.1; Tough 2000 V2 0.19; Tough 1500 V2 0.21; Rigid 4000 0.7; Elastic/Flexible 50A V2 0.7; Grey V5 0.8; Clear V5 0.9. Only the legacy Elastic 50A V1 is higher (2.3%). Cube table columns: water is the 18th value of each row.',
  SOLV, 'high', 'Clear V5 water=0.9; Tough 1000 water=0; Rigid 10K water=<0.1',
  'solvent', 'Clear Resin V5 0.9 5.1 0.7 0.3 0.1 1.1 0.1 0.9 <0.1 0.3 0.2 0.2 0.8 0.7 0.8 0.5 0.5 0.9 <0.1')
F('Tough 1000 row: water 0 (18th value), IPA 6.9 (10th value).', SOLV, 'high', 'water=0; IPA=6.9',
  'solvent', 'Tough 1000 Resin 0.2 30.4 0 38.9 0.7 6.9 0.1 0.2 39.8 6.9 0.1 0 0.2 5 0.2 7.3 7 0 62.7')
F('CONFIRMS earlier finding: Elastic 50A V2 takes 39.2% IPA (10th value), 43.4% acetone, 163.9% xylene (last value) and 0.7% water in 24 h; Rigid 10K takes <0.1% IPA and <0.1% water. IPA contrast 39.1 percentage points.',
  SOLV, 'high', 'Elastic 50A V2 IPA=39.2 water=0.7; Rigid 10K IPA=<0.1',
  'solvent', 'Elastic 50A Resin V2 1.5 43.4 0.6 133.1 7.9 31.4 3.9 0.9 15.6 39.2 0.4 0.7 0.6 41.2 0.7 45.6 43.6 0.7 163.9')
F('Rigid 10K cube row (all <=0.6%).', SOLV, 'high', 'water <0.1; IPA <0.1; salt water 0.1',
  'solvent', 'Rigid 10K Resin <0.1 <0.1 0.1 0.1 0.1 0.4 0.2 <0.1 0 <0.1 <0.1 0.2 0.1 0.6 0.1 0.2 0.4 <0.1 <0.1')
F('Naming: Formlabs now sells Flexible 50A Resin; its product page links data-sheet id elastic50av2, its image alt text reads "Flexible 50A Resin V2", the TDS file is named Flexible-50A-V1-TDS, and the solvent page still calls the same numbers "Elastic 50A Resin V2". Treat Flexible 50A = Elastic 50A V2.',
  'https://formlabs.com/products/flexible-50a-resin/', 'medium', 'Shore 44A green / 55A post-cured; UTS 3.4 MPa',
  'pagehtml:flexible-50a-resin', 'product=elastic50av2')
F('CONFIRMS and UPGRADES earlier low-confidence finding: Grey V5 Type IV tensile bars in deionized water: 1 day mass 101.38%, modulus 88.63%, strength 89.21%, elongation 105.36% of unexposed; 1 week mass 103.23%, modulus 65.29%, strength 67.62%, elongation 83.53%. '
  'The earlier agent could only read this from a scrambled column order; in the older 13-page staging TDS (not the current 2-page Clear V5 TDS) the cells are clean and labelled "DI Water".',
  OLD, 'high', '1 week DI water: +3.23% mass, modulus 65.29%', 'oldpdf', 'DI Water 65.29% 67.62% 83.53% 103.23%')
F('1-day DI water row of the same table; the document states results are from Grey V5.', OLD, 'high', 'mass 101.38%; modulus 88.63%',
  'oldpdf', 'DI Water 88.63% 89.21% 105.36% 101.38%')
F('Water uptake of SLS powders, ASTM D570 on printed parts (duration not stated): Nylon 12 White 1.40%, TPU 90A 0.89%, Nylon 12 0.66%, Nylon 11 Pro 0.4%, Nylon 12 Tough 0.30%, Polypropylene 0.25%, Nylon 12 GF 0.24%, Nylon 11 0.07%. On the 1 cm cube 24 h test the same Nylon 12 White gains 0.1% (column Water, 18th value), so the D570 figure is 14 times the cube figure for the same powder.',
  TDS + 'm/7643d18452021a4d/original/-ENUS-Nylon-12-White-TDS.pdf ; ' + SOLV, 'high', 'Nylon 12 White: D570 1.40% vs cube 0.1%',
  'tbl:nylon12white__2978', 'Water Absorption (printed part) 1.40%')
F('Nylon 12 White cube row (water 0.1).', SOLV, 'high', 'water=0.1',
  'solvent', 'Nylon 12 White 0.2 0.2 0.2 0.2 1.3 1 1.7 0.1 0.3 0.2 2.2 2 0.1 1.9 0.1 4.8 1.1 0.1 0.2')
F('Wash-step hazard and strong-stimulus option: Flexible 50A swells 39.2% in IPA in 24 h and Flexible 80A V2 +45% mass / +113% volume in IPA after 1 day (slab). Any elastomer bilayer will curl during an IPA wash; IPA or ethanol is a far stronger actuator than humidity, but also a wash/process hazard.',
  SOLV + ' ; ' + F80, 'high', 'Flexible 80A V2 IPA 1 day: mass +45%, volume +113%',
  'tbl:flexible-80a-resin-v2__3462', 'IPA 1 day -32 +45% +113% 95%')

# ---------------- mechanical ----------------
F('CONFIRMS: Rigid 10K tensile modulus 7.5 GPa green, 10 GPa after 70 C 60 min post-cure, 11 GPa for the media-blasted state (ASTM D638-14). The blank cell under the 70+90 C state is a merged cell (rendered page checked): the 10 GPa value and the 1% elongation span the 70 C and 70+90 C columns, so the earlier agent was right to read 10 GPa for both. '
  'Product page lists 11 GPa and elongation 0.7%; the TDS says 1.7% for the 88 MPa state (earlier agent flagged this).',
  R10K, 'high', 'E: 7.5 / 10 / (10) / 11 GPa; UTS 55/65/53/88 MPa', 'tbl:rigid10k__910', 'Tensile Modulus 7.5 GPa 10 GPa 11 GPa')
F('Silicone 40A publishes no tensile modulus; post-cured stress at 50% elongation 0.4 MPa, 100% 1 MPa, UTS 5 MPa, elongation 230%, Shore 40A, resilience 34%. Own estimate: secant modulus 0.4/0.5 = 0.8 MPa (a lower bound: for an ideal neo-Hookean rubber the secant at 50% strain is (1.5-1/1.5^2)/(3x0.5)=0.704 of the small-strain modulus, so about 1.1 MPa).',
  S40, 'medium', 'stress@50%=0.4 MPa; secant 0.8 MPa; neo-Hookean-corrected about 1.1 MPa (own calculation)',
  'tbl:silicone40a__2083', 'Stress at 50% elongation 0.4 MPa 58 psi')
F('Disagreement: Silicone 40A glass transition -107 C in the TDS vs -110 C on the product page.', S40 + ' ; https://formlabs.com/products/silicone-40a-resin/', 'high', '-107 C (TDS) vs -110 C (page)',
  'tbl:silicone40a__2083', 'Glass Transition Temperature -107 °C')
F('Product-page side of the Tg disagreement.', 'https://formlabs.com/products/silicone-40a-resin/', 'high', '-110 C', 'head:silicone-40a-resin', 'Glass Transition Temperature (Tg) -110 °C')
F('Alumina 4N Resin: the printed green part has flexural modulus 24.5 MPa; after furnace sintering Young modulus is 390 GPa (TDS) - a 16,000-fold change (390000/24.5). The product page text says 380 GPa; the TDS says 390 GPa.',
  TDS + 'm/35a40632d8faa55d/original/-ENUS-Alumina-4N-TDS.pdf', 'high', 'green 24.5 MPa; sintered 390 GPa (page text 380 GPa)',
  'tbl:alumina4n__2096', "Young's Modulus 4, 5 390 GPa")
F('Product-page text for Alumina 4N modulus.', 'https://formlabs.com/products/ceramic-alumina-4n-resin/', 'high', '380 GPa', 'head:ceramic-alumina-4n-resin', 'modulus of 380 GPa')
F('Shore hardness: Tough 1000 56D green / 68D post-cured; Flexible 50A 44 green / 55 post-cured (A scale); Flexible 80A V2 68A / 83A (TDS row garbled in text extraction, product page "83A 80A*").',
  TDS + ' (TDS) ; https://formlabs.com/products/flexible-80a-resin/', 'high', 'Tough 1000 56D/68D; Flexible 50A 44/55 A',
  'tbl:tough1000__3298', 'Shore D Hardness 56D 68D')
F('Flexible 80A V2 product-page Shore A entry.', 'https://formlabs.com/products/flexible-80a-resin/', 'medium', '83A (80A*)', 'head:flexible-80a-resin', 'Hardness (Shore A) 83A 80A*')
F('Nylon 12 tensile modulus: TDS 1850 MPa; the product page headline says 1900 MPa (spec-resin-chemistry.json used 1900, spec-formlabs-materials.json 1850). Both are Formlabs numbers; I use the TDS value.',
  TDS + 'm/2a02034348060e54/original/-ENUS-Nylon-12-TDS.pdf', 'high', '1850 vs 1900 MPa', 'tbl:nylon12__1351', 'Tensile Modulus 1850 MPa')
F('Product-page side of the Nylon 12 modulus disagreement.', 'https://formlabs.com/products/nylon-12-powder-10/', 'high', '1900 MPa', 'head:nylon-12-powder-10', 'Tensile Modulus 1900.0 MPa')

# ---------------- recipes / test conditions ----------------
F('Post-cure recipes are printed in TDS footnotes, not on product pages (which only link to Form Cure settings). Tough 1000 and Tough 2000 V2: Form 4, 100 um, wash 10+10 / 10+5 min in >=99% IPA in Form Wash V2, post-cure 70 C 12 min in Form Cure V2.',
  TDS + ' (Tough 1000 TDS https://formlabs-media.formlabs.com/datasheets/25011071-TDS-ENUS-0.pdf)', 'high', '70 C, 12 min, Form Cure V2', 'raw:tough1000__3298', 'post-cured at 70 C for 12 minutes in a Form Cure V2')
F('Silicone 40A is post-cured at 60 C for 30 min submerged in water.', S40, 'high', '60 C 30 min under water', 'raw:silicone40a__2083',
  'post-cured at 60C for 30 minutes submerged in water in a Form Cure')
F('Flexible 80A V2 post-cure: room temperature 5 min in water then 80 C 5 min in air in a Form Cure V2 L.', F80, 'high', 'RT 5 min in water + 80 C 5 min in air', 'raw:flexible-80a-resin-v2__3462',
  'post-cured at room temperature for 5 minutes in water and 80C for 5 minutes in air in a Form Cure V2 L')
F('Rigid 4000 post-cure: Form Cure 15 min at 80 C. Rigid 10K: 60 min at 70 C (+ optional 125 min at 90 C thermal). Clear/Grey/Black/White V5: 5 min room temperature or 15 min at 60 C. High Temp: 60 min 60 C, or 120 min 80 C plus 180 min 160 C oven.',
  TDS + 'm/4f8db0ba395cd2de/original/-ENUS-Rigid-4000-TDS.pdf', 'high', 'Rigid 4000: 80 C 15 min', 'raw:rigid4000__56', 'post-cured with a Form Cure for 15 minutes at 80 C')
F('Several "current Form 4" resins have TDS numbers measured on older printers: Rigid 10K and Rigid 4000 (Form 3), Durable and High Temp (Form 2); Tough 1000, Tough 2000 V2, Clear/Grey V5 were measured on a Form 4.',
  R10K, 'high', 'Rigid 10K test printer: Form 3', 'raw:rigid10k__910', 'A ll testing specimens were printed using Form 3.')

# ---------------- chemistry / adhesion ----------------
F('SDS section 3 shows the Form 4 SLA resins are all (meth)acrylate photopolymers: Flexible 80A V2 methacrylate monomers 25-40% plus aliphatic polyurethane; Rigid 10K urethane dimethacrylate 15-25%; Tough 1000, Tough 1500 V2, Clear/Grey V5, Rigid 4000, Durable, ESD, Flexible 50A likewise methacrylate / urethane dimethacrylate. '
  'Same radical chain-growth chemistry, so these can co-cure. Silicone 40A is different: polysiloxane crosslinker 5-10% plus a TPO-L type photoinitiator.',
  'SDS PDFs listed in D:/Users/ashenoy00000/delphi-work/data/formlabs-tds/MANIFEST.tsv (sds/ folder), e.g. ' + TDS + 'asset/f2f45c46-fcda-43f9-a290-3d2a8c0af980/-ENUS-Safety-Data-Sheet-Flexible-80A-Resin-V2.pdf', 'high',
  'Flexible 80A V2: methacrylate monomer(s) 25-40%', 'sds:flexible80av2__3497', 'Methacrylate monomer(s) 25-40')
F('Silicone 40A SDS composition (polysiloxane crosslinker).', TDS + 'm/32e7870f5d5cb04a/original/-ENUS-Safety-Data-Sheet-Silicone-40A-Resin.pdf', 'high', 'polysiloxane crosslinker 5-10%',
  'sds:silicone40a__2097', 'Polysiloxane crosslinker 5-10')
F('Rigid 10K SDS composition (urethane dimethacrylate).', TDS + 'm/3cc2feae0929233/original/-ENUS-Safety-Data-Sheet-Rigid-10K-Resin.pdf', 'high', 'urethane dimethacrylate 15-25%',
  'sds:rigid10k__1693', 'Urethane Dimethacrylate 15-25')
F('Adhesion evidence is thin. Formlabs itself says its resins can be used as glue (405 nm laser pen) - this supports resin-on-resin bonding within the acrylate family.',
  'https://formlabs.com/blog/advanced-3dp-techniques/', 'medium', 'official Formlabs blog statement, no strength data',
  'page:formlabs.com_blog_advanced-3dp-techniques_', 'Formlabs resins can behave like glue when exposed to UV light.')
F('Community forum (anecdotal, 2021): a user who printed Durable and Elastic 50A parts reports that silicone glue did not work and planned to bond with Elastic resin instead. This is the only adhesion evidence found for a flexible/rigid acrylate pair, and it says nothing about Silicone 40A resin on acrylate resin: no source found for that pair.',
  'https://forum.formlabs.com/t/gluing-elastic-50a-and-durable-resins-together-two-different-resins-in-general/31779', 'low', 'anecdote, no test data',
  'page:forum.formlabs.com_t_gluing-elastic-50a-and-durable-resins-t', 'I tried gluing them with goop (silicone glue) - doesn’t work.')
