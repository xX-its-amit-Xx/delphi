# Part 4: table rows, glossary, recommendations, could_not_find, reproduce (exec'd by build.py).
DOI = 'https://doi.org/'
TABLE = []
# --- clusters (my keyword clustering of the 493 track-5 works; counts from t5_clusters.json)
for k, v in sorted(CL['clusters'].items(), key=lambda kv: -kv[1]['n']):
    TABLE.append(dict(name='CLUSTER: ' + k,
                      fields='n_papers=%d; mean_relevance_score=%.2f (scale 1-5); n_score_4_or_5=%d' % (v['n'], v['mean_rel'], v['n_rel4plus']),
                      source='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/buehler-corpus.json (clustered by D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/cluster.py)'))
# --- the deep-dive papers
P = [
 ('Liu 2019, spider silk torsional actuator driven by humidity (Sci. Adv.)', '10.1126/sciadv.aau9183',
  'design_rule=humidity-gated twist, no motion below threshold RH ~68-70 %; number=>300 deg/mm, 255 deg/mm one-way for N. pilipes; fibre_diameter=3.1 and 6.7 um; reversibility=partial (N. pilipes keeps twist); fabricated=no, natural fibre tested; constrains=sets a threshold-and-hysteresis test protocol (RH 40-100-40 % x5), not a recipe; formlabs_transfer=concept only'),
 ('Masic 2015, osmotic pressure induced tensile forces in tendon collagen (Nat. Commun.)', '10.1038/ncomms6942',
  'design_rule=removing water shortens collagen and generates stress; number=several to ~100 MPa vs 0.3 MPa muscle; 106+/-16 pN/molecule at 5 % RH; stimulus_law=Pi=RT/vm ln(RH); fabricated=no, natural tendon; constrains=gives RH->pressure conversion for stimulus design; formlabs_transfer=concept only'),
 ('Giesa 2017, molecular requirements for silk supercontraction (ACS Nano)', '10.1021/acsnano.7b01532',
  'design_rule=polar/charged residues set humidity shrinkage, point mutations suppress or reverse it; number=axial shrinkage up to 50 %; fabricated=no (MD + in situ test of fibre); formlabs_transfer=none (sequence-level)'),
 ('Ling 2018, in-silico design + biomimetic assembly of dynamic responsive bio-nanomaterials (Adv. Mater.)', '10.1002/adma.201802306',
  'design_rule=gradient structure + water-sensitive components give a water-driven grab-and-release actuator; number=281+/-14 MPa, 22+/-2 MJ/m3, modulus 4.4-9.1 GPa across ratios; actuator_value=not read; fabricated=yes, ~10 um cast films; formlabs_transfer=low (nanofibril casting) but nearest analogue to a designed hygromorph'),
 ('Sen & Buehler 2011, structural hierarchies in one brittle material (Sci. Rep.)', '10.1038/srep00035',
  'design_rule=more hierarchy levels raise defect tolerance exponentially, trade for lower strength; number=up to 4 levels, tolerance to ~100 um; scale=27x70 um model; fabricated=no (simulation); formlabs_transfer=low as a number (um scale), moderate as a principle (soft phase made by porosity in same material)'),
 ('Dimas 2013 + Dimas & Buehler 2014 + Dimas thesis, printed bio-inspired composites (Adv. Funct. Mater.; Soft Matter)', '10.1002/adfm.201300215',
  'design_rule=soft/stiff topology and stiffness ratio govern toughness; number=toughness modulus 8x, >80 % of stiffest modulus (simulation), nominal ratio ~1500, effective 45-60; fabricated=yes, Objet Connex500 single-print two-material; formlabs_transfer=principle yes, fabrication route no'),
 ('Mirzaeifar 2015, defect-tolerant hierarchical composites (ACS Biomater. Sci. Eng.)', '10.1021/ab500120f',
  'design_rule=more hierarchical levels retain more strength with cracks or many small defects; number=none in abstract; fabricated=yes, multimaterial 3D printing; formlabs_transfer=principle only'),
 ('Gu 2017, hierarchically enhanced impact resistance, conch shell (Adv. Mater.)', '10.1002/adma.201700060',
  'design_rule=second cross-lamellar level creates crack-deviation paths; number=+70 % vs one level, +85 % vs stiff constituent (thesis: +85 % vs +10 %); fabricated=yes, printed prototype, drop tower; formlabs_transfer=principle; needs two materials'),
 ('Gu 2018, ML design of hierarchical composites + Gu thesis ch.7 (Mater. Horiz.)', '10.1039/c8mh00653a',
  'design_rule=neural network ranks candidates, FEM and print decide; number=printed ML design ~25x tougher than stiff, ~40x than soft, ~4x best training design; search_space=100,000 random candidates; surrogate_accuracy=CNN >98 %, linear 96 %/95 % (ch.6); modulus_E=2187 and 0.53 MPa (Vero/Tango); fabricated=yes; formlabs_transfer=method yes, materials no'),
 ('Qin 2015, structural optimization of 3D-printed spider webs (Nat. Commun.)', '10.1038/ncomms8038',
  'design_rule=load type sets optimal thread-material distribution; number=3.2 N/g peak at d_s/d_r=1.26; PDMS 6.8 MPa, 355 % failure strain; fabricated=yes, direct ink writing PDMS, cured 160 C 30 min; formlabs_transfer=geometry/net idea yes for an architecture tensile net, process no'),
 ('Brommer 2015, categorical prototyping (Nanotechnology)', '10.1088/0957-4484/27/2/024002',
  'design_rule=use category theory to preserve a chosen relation from model to print, prototype = reduction; number=none in abstract; fabricated=yes, large multi-material print of 2D-carbon modulus scaling plus a twist test beyond the model; formlabs_transfer=method yes'),
 ('Luu 2025, generative AI extracts structure-function relations from plants (arXiv)', '10.48550/arxiv.2508.06591',
  'design_rule=coatings (chitosan, petroleum jelly, paraffin wax) freeze humidity response of pollen paper; number=60 -> 20 % RH test, no response after wax; shear_strength=not given as a number; fabricated=yes (lab), qualitative; formlabs_transfer=coating trick yes (to make one face passive)'),
 ('Lew 2023, misorientation toughening in corals and seashells (Adv. Mater.)', '10.1002/adma.202300373',
  'design_rule=slight crystal misorientation toughens; number=1-40 deg observed, MD maxima 10/20/30 deg (aragonite/vaterite/calcite); fabricated=no (indentation of natural and synthetic spherulites); formlabs_transfer=none'),
 ('Shen 2024, robust myco-composites (Mater. Horiz.)', '10.1039/d3mh01277h',
  'design_rule=hierarchical design + printed scaffold + indirect inoculation; number=160 MPa modulus, 0.72 MPa tensile strength; fabricated=yes (additive manufacturing + mycelium growth); formlabs_transfer=none for resin/SLS, relevant as a living-material alternative'),
 ('Grezzana 2020, bone lamellar patterns, collagen mapping and 3D printing (Adv. Eng. Mater.)', '10.1002/adem.202000387',
  'design_rule=vertical osteon layout best in tension, twisted in compression; number=none in abstract; fabricated=yes, printed osteon-inspired samples; formlabs_transfer=principle (fibre layout per load type)'),
]
for n, d, f in P:
    TABLE.append(dict(name=n, fields=f, source=DOI + d))
# --- verdict rows
TABLE += [
 dict(name='TRANSFERABLE 1: stiffness ratio and soft/stiff topology as governing variables',
      fields='evidence=Dimas 2014, Dimas thesis, Gu thesis; my_calc=at n~1700-4100 equal-thickness bilayer gives 0.4-0.9 % of the 3/2 ceiling and optimum needs thickness ratio 41-64; action=choose n and m jointly, prefer soft/soft pairs or porosity contrast in one resin; caveat=Formlabs prints one material per job (project record)',
      source='https://doi.org/10.1039/c3sm52890a ; own calculation D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/calc.py'),
 dict(name='TRANSFERABLE 2: computational filter, then print and test',
      fields='evidence=Gu 2018 and thesis ch.6-7; numbers=100,000 candidates screened, ~25x toughness on printed ML-opt, 1820 configs for a 16-cell brute force; action=Lean law as hard filter, FEM/surrogate ranking, 3-5 printed coupons',
      source='https://doi.org/10.1039/c8mh00653a ; https://dspace.mit.edu/handle/1721.1/119343'),
 dict(name='TRANSFERABLE 3: formal reduction before printing, with a test beyond the model',
      fields='evidence=Brommer 2015 (category theory, printed 2D-carbon model, twist test); project_record=Marom et al. JMPS 2026 (cited, not re-read); gap=no Buehler paper uses a proof assistant',
      source='https://doi.org/10.1088/0957-4484/27/2/024002'),
 dict(name='TRANSFERABLE 4: humidity as a gated, hysteretic stimulus with a coating switch',
      fields='evidence=Liu 2019 (threshold 68-70 % RH, 5 cycles, partial reversal), Masic 2015 (Pi=RT/vm ln RH; 49 MPa at 70 % RH by my calc), Luu 2025 (wax freezes response); action=RH step sweep and 5+ cycles on coupons, one-face coating to make a passive layer',
      source='https://doi.org/10.1126/sciadv.aau9183 ; https://doi.org/10.1038/ncomms6942 ; https://arxiv.org/abs/2508.06591'),
 dict(name='NOT TRANSFERABLE: nanometre and molecular rules',
      fields='examples=H-bond cluster size, silica nano-honeycomb ductility at angstrom scale, hierarchical Bell model, Sen & Buehler exponential law at 27x70 um; reason=length scales 2-6 orders below Form 4 / Fuse 1+ features (0.2 mm wall)',
      source='https://doi.org/10.1038/srep00035'),
 dict(name='NOT TRANSFERABLE: crystallography and protein-sequence mechanisms',
      fields='examples=misorientation toughening (Lew 2023), proline-driven silk twist (Liu 2019), supercontraction mutations (Giesa 2017); reason=needs self-assembling crystals or specific protein sequences',
      source='https://doi.org/10.1002/adma.202300373'),
 dict(name='NOT TRANSFERABLE: the fabrication routes of the printed papers',
      fields='examples=Objet Connex500/Connex3 two-material jetting (Dimas, Gu), PDMS direct ink writing at 160 C (Qin), nanofibril casting (Ling), mycelium growth (Shen); reason=none runs on Form 4 SLA or Fuse 1+ SLS',
      source='https://dspace.mit.edu/handle/1721.1/79497 ; https://dspace.mit.edu/handle/1721.1/119343'),
]

GLOSSARY = [
 dict(term='hygromorph', plain='A material or part that changes shape when the air gets more or less humid.'),
 dict(term='relative humidity (RH)', plain='How full of water vapour the air is, as a percentage of the most it can hold at that temperature.'),
 dict(term='stiffness ratio', plain='How many times stiffer one material is than another; 1000 means one is a thousand times harder to bend.'),
 dict(term='bilayer', plain='Two thin layers stuck together; if one swells more than the other the pair curls, like the metal strip in an old thermostat.'),
 dict(term='Timoshenko ceiling', plain='A proven upper limit on how tightly a two-layer strip can curl for a given swelling difference; the project checked it by computer.'),
 dict(term='hierarchy (in materials)', plain='Structure built in levels, like fibres twisted into threads twisted into rope.'),
 dict(term='defect tolerance', plain='How well a material keeps its strength when it has cracks or flaws.'),
 dict(term='toughness', plain='How much energy a material soaks up before it breaks.'),
 dict(term='multi-material jetting (PolyJet / Objet)', plain='A printer that sprays two different plastics in the same print; the Formlabs printers named here use one material per print.'),
 dict(term='machine learning surrogate', plain='A fast statistical stand-in for a slow computer simulation, used to rank many designs.'),
 dict(term='category theory', plain='A branch of mathematics about how structures map to one another while keeping chosen features.'),
 dict(term='osmotic pressure', plain='The pull a material exerts on water; drier air means a stronger pull.'),
 dict(term='SLA / SLS', plain='Two 3D-printing methods: light-cured liquid resin (SLA) and laser-fused powder (SLS).'),
 dict(term='DIC (digital image correlation)', plain='Measuring how a surface stretches by comparing photos before and during a test.'),
 dict(term='MD (molecular dynamics)', plain='Computer simulation that follows individual atoms.'),
]

RECS = [
 'Treat the Buehler corpus as a source of design logic and test protocol, not of numbers: it contains no resin-moisture data, no hygroscopic expansion coefficient, no diffusivity, and (abstract-level) no vat or powder-bed printing. The coupon measurements the earlier agents asked for are still needed.',
 'Use the corpus precedent to frame the proof of concept: Dimas, Gu and Brommer each close the loop model -> print -> test, and Brommer adds a test beyond the model. Our novelty is the machine-checked bound as the first filter, which no paper in this corpus has (abstract-level).',
 'Choose the bilayer stiffness ratio on purpose. At n of about 1700-4100 (Buehler-style hard/soft jetting contrast) the optimum thickness ratio is 41-64 and an equal-thickness strip loses over 99 % of the curvature ceiling; prefer a soft/soft pair or measure wet moduli first, then fix m = n^(-1/2) within the 0.2 mm minimum wall.',
 'Copy the Liu 2019 test protocol: sweep RH in steps, look for a threshold, cycle at least five times and record hysteresis; add a one-face wax or sealant coating coupon (Luu 2025) to confirm the passive layer.',
 'Test the porosity-as-soft-phase idea (my inference from Sen & Buehler: soft nanoporous inclusions in the same silica) on a single material: SLS PA12 or SLA rigid coupons with lattice-density gradients, compared against the Timoshenko-type prediction. Not reported by any Buehler paper on Formlabs hardware.',
 'Obtain the full text of Ling 2018 supplementary information and the Dimas 2014 / Gu 2018 papers through the library before any number from them is used in a claim; this report relied on abstracts plus the two MIT theses for those.',
]

COULD_NOT_FIND = [
 'Full text of the non-open-access papers (Dimas 2013 Adv. Funct. Mater., Dimas & Buehler 2014 Soft Matter, Mirzaeifar 2015, Gu 2017 Adv. Mater., Gu 2018 Mater. Horiz., Brommer 2015, Lew 2023, Giesa 2017, Shen 2024, Grezzana 2020): only abstracts were read for the published versions. For Dimas and Gu the MIT PhD theses (hdl 1721.1/79497 and 1721.1/119343) were read in full text; thesis chapters may differ from the journal versions (the Gu thesis marks chapter 7 as under review).',
 'Any numeric actuation value (curvature, angle, RH, time, cycles) for the grab-and-release actuator in Ling 2018: the main text I could read gives strength, toughness and modulus but the actuator result seems to sit in a figure or supplement that I did not read.',
 'A numeric adhesive shear strength in Luu 2025: the paper text says only that 2 % w/v pollen was strongest.',
 'The elongation row of Gu thesis Table 2.1: the PDF text interleaves the columns, so which elongation belongs to which material cannot be read; the moduli and strengths were read.',
 'Any Buehler abstract with SLA, DLP, SLS, vat or Formlabs terms, and any hygroscopic expansion coefficient or water diffusivity for a printed polymer. The negative result is abstract-level only: 174 of the 493 track-5 works have no abstract in the corpus file, and I did not search full texts.',
 'Whether the Objet/Connex photopolymers (VeroWhitePlus, TangoBlackPlus, VeroMagenta) absorb water: no Buehler paper reports it. So the Buehler printed-composite stiffness numbers cannot be transferred to humid conditions.',
 'The JMPS 2026 category-theory paper was not re-read; its description (FFF bilayer strips, four angle comparisons) rests on the project record spec-marom-buehler-deep.json. I only confirmed via Crossref and the arXiv API that the DOI and arXiv entry exist.',
 'A full read of the remaining roughly 120 track-5 papers that score 4 or 5: they were screened from the corpus "why" notes (and abstracts where present), not fetched, so the claim that the papers examined hold the most transferable ideas is a judgement, not an exhaustive test.',
 'Independent confirmation of the Formlabs one-material-per-print limit: I rely on the project record (spec-formlabs-materials.json); I did not re-fetch a Formlabs statement on it.',
]

REPRODUCE = [
 dict(what='Check disk and RAM headroom before the large downloads (D: free GB, RAM free %)', command_or_url='df -h /d ; powershell -Command "(Get-CimInstance Win32_OperatingSystem | % { [math]::Round($_.FreePhysicalMemory/$_.TotalVisibleMemorySize*100,1) })"', expected='D: about 10 GB free and RAM free about 27 % at run time (limits: 3 GB and 15 %)'),
 dict(what='Cluster the 493 track-5 papers and list score 4-5 works', command_or_url='python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/cluster.py', expected='12 clusters; silk 118, collagen/bone 74, printed/ML composites 70 (mean relevance 3.83, 46 at score 4-5); writes scratch/t5_clusters.json and t5_listing.txt'),
 dict(what='Corpus-level abstract counts (printing, humidity, vat/powder terms)', command_or_url='python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/corpus_stats.py', expected='t5_total 493, t5_with_abstract 319; vat_or_powder_printing 0; any_3d_printing 36; polyjet_or_multimaterial_printing 5; humidity_or_water_stimulus 16'),
 dict(what='Fetch Crossref and Europe PMC records for the selected DOIs (saves raw JSON with sha256 manifest)', command_or_url='python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/fetch_meta.py', expected='Crossref OK for every non-arXiv DOI (arXiv DOIs return 404 there); Europe PMC PMCIDs PMC6397028, PMC4354200, PMC3216522, PMC4479035, PMC7189256'),
 dict(what='Fetch open-access full texts and arXiv papers', command_or_url='python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/fetch_fulltext.py ; then curl -L -A delphi-research/0.1 -o D:/Users/ashenoy00000/delphi-work/data/buehler-papers/pmc7189256.html https://pmc.ncbi.nlm.nih.gov/articles/PMC7189256/', expected='four Europe PMC XML files of 79-95 KB, two arXiv PDFs (5.1 MB, 8.4 MB); Europe PMC XML for PMC7189256 returns HTTP 500, hence the PMC page'),
 dict(what='Download the two MIT theses (DSpace REST: find item by handle, ORIGINAL bundle, bitstream content)', command_or_url='https://dspace.mit.edu/server/api/discover/search/objects?query=handle:1721.1/79497 and handle:1721.1/119343; bitstreams 46fe020b-f556-412b-b547-bcd6b39cafbf and 955b9d04-a990-49a0-bf70-c8da0e4f3774 (/content)', expected='16,437,095-byte and 26,017,024-byte PDFs; sha256 b7275ae4...3e18 and 005b80ea...6c8b; convert with pdftotext -enc UTF-8 -layout (xpdf 4.00)'),
 dict(what='Re-fetch Formlabs data sheets and solvent page; read the D471 table in table mode', command_or_url='https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf ; https://media.formlabs.com/m/442fcd13220df367/original/-ENUS-Flexible-80A-TDS.pdf ; https://formlabs.com/support/solvent-compatibility/ ; then pdftotext -enc UTF-8 -table f80v2.pdf - | grep -A1 "Deionized Water"', expected='V2 sha256 a2c32cef...b683 (1,159,678 bytes); row "Deionized Water 1 day -26 +8% +3% 94% 89%"; V1 sha256 bb707e74...dcb57 shows Water 0.7; solvent page 331,600 bytes lists Flexible 80A Resin (not V2)'),
 dict(what='Own arithmetic: Timoshenko f(m,n), thickness ratios, osmotic pressure, C(16,4)', command_or_url='python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/calc.py', expected='grid_max_f 1.5000000000000002; f(1,4126.4)=0.0058; m_opt thick:thin 64.2, 41.5, 43.5, 7.1, 3.2; C(16,4)=1820; osmotic 49.12 MPa at RH 0.7; RH 0.9971 at 0.4 MPa'),
 dict(what='Verify every evidence quote against its source and assemble the JSON', command_or_url='python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/build.py', expected='"quotes checked: N, failed: 0" and writes D:/Users/ashenoy00000/delphi-work/agents2/bm-buehler-materials-corpus.json'),
]
