# Part 3: corpus-level findings, extra sources, and own-calculation findings. exec'd by build.py after p1.
import re as _re, json as _json
# --- extra source: Formlabs solvent-compatibility page re-fetched this run (HTML table rows flattened to text)
_h = open(FL + 'solvent.html', encoding='utf8', errors='ignore').read()
_h = _re.sub(r'<script.*?</script>|<style.*?</style>', '', _h, flags=_re.S)
_rows = []
for _r in _re.findall(r'<tr[^>]*>(.*?)</tr>', _h, flags=_re.S):
    _c = [_re.sub(r'\s+', ' ', _re.sub(r'<[^>]+>', ' ', x)).strip() for x in _re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', _r, flags=_re.S)]
    _rows.append(' '.join(_c).replace('&lt;', '<'))
add('solvent_page', '\n'.join(_rows), 'https://formlabs.com/support/solvent-compatibility/ (fetched 2026-11-12)', FL + 'solvent.html')
# --- extra source: my own script outputs
CS = _json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/corpus_stats.json', encoding='utf8'))
CL = _json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/t5_clusters.json', encoding='utf8'))
CALC = _json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/calc_out.json', encoding='utf8'))

FC = [
 ('corpus_json',
  'The corpus file lists 544 relevant Buehler works, 493 of them assigned to track 5 (materials design rules); 795 of the 892 works OpenAlex lists were fetched.',
  '544 relevant; 493 in track 5; 795/892 fetched', 'high',
  '"5": 493'),
 ('corpus_json',
  'Relevance scores within track 5 (my count from the file): score 5 = 46 works, score 4 = 92, score 3 = 139, score 2 = 194, score 1 = 22; so 138 works score 4 or 5.',
  '46 / 92 / 139 / 194 / 22', 'high',
  ''),
 ('corpus_json',
  'ABSTRACT-LEVEL NEGATIVE RESULT (my script corpus_stats.py): of the 795 fetched works, none has an abstract mentioning stereolithography, SLA, DLP, vat photopolymer, selective laser sintering, SLS, powder bed, digital light or Formlabs. Only 319 of the 493 track-5 works have an abstract, so full-text mentions are not excluded.',
  '0 of 795 abstracts (319 of 493 track-5 have an abstract)', 'medium',
  ''),
 ('corpus_json',
  'Of the 795 abstracts, 36 mention 3D printing or additive manufacturing (at most 4 per year, 2013-2025) and 5 mention multi-material or material-jetting printing (Defect-tolerant composites 2015, Categorical prototyping 2015, Optimization of composite fracture 2016, Bone-inspired materials by design 2016, a 2025 dual-extruder biotic printer).',
  '36 printing; 5 multi-material', 'medium',
  ''),
 ('corpus_json',
  'Only 16 of the 795 abstracts mention humidity, moisture, hygro, swelling, osmotic pressure or supercontraction; just one of those also mentions 3D printing (the 2024 degradability study, an end-of-life test). No Buehler abstract reports a hygroscopic expansion coefficient or water diffusivity for a printed polymer.',
  '16 humidity-type; 1 overlaps with printing', 'medium',
  ''),
 ('corpus_json',
  'My keyword clustering of the 493 track-5 papers (cluster.py; rules on the corpus theme string first, then the title): silk/spider/keratin/amyloid/filaments 118, collagen/bone/biomineral 74, printed or ML-designed hierarchical composites and architected lattices 70, hierarchy/flaw tolerance/size effects/H-bond limits 69, fracture 35, metal-coordination/adhesion 34, hygromorph/stimulus-response/wood 29, AI agents/knowledge graphs/category theory 21, carbon/2D 19, unclassified 13, cement/asphalt 6, editorial 5. The printed-composite cluster has the highest mean relevance score (3.83) and 46 works scoring 4 or 5.',
  '12 clusters; largest 118 (silk)', 'medium',
  ''),
 ('solvent_page',
  'RE-CHECK of earlier claim (spec-resin-chemistry.json): the Formlabs solvent table lists Elastic 50A Resin V2 at 39.2 % isopropanol and Rigid 10K at under 0.1 %, and both Elastic 50A V2 and Flexible 80A Resin at 0.7 % water. Confirmed by parsing the page I re-fetched; the column order was read from the page header row (Water is the 18th solvent column, IPA the 10th).',
  'Elastic 50A V2: IPA 39.2 %, water 0.7 %; Rigid 10K: IPA <0.1 %', 'high',
  'Elastic 50A Resin V2 1.5 43.4 0.6 133.1 7.9 31.4 3.9 0.9 15.6 39.2'),
 ('solvent_page',
  'Rigid 10K row of the same page (the passive layer candidate): all solvent columns are 0.6 or below, including IPA and water.',
  'Rigid 10K IPA <0.1 %, water <0.1 %', 'high',
  'Rigid 10K Resin <0.1 <0.1 0.1 0.1 0.1 0.4 0.2 <0.1 0 <0.1'),
 # ---- own calculations (no quotable source sentence; script and arithmetic stated)
 ('corpus_json',
  'OWN CALCULATION (calc.py): the Timoshenko coefficient f(m,n) is invariant under (m,n) -> (1/m,1/n) (max difference 2e-16 over a test grid) and a 400 x 301 log-grid search finds maximum f = 1.5000000000000002, so the 3/2 ceiling in the project record is reproduced numerically.',
  'f max = 1.5; symmetry diff 2e-16', 'high',
  ''),
 ('corpus_json',
  'OWN CALCULATION: with the Buehler-style stiff/soft contrast an equal-thickness bilayer is nearly useless. f(1,n) = 0.0058 for n = 4126 (VeroMagenta/TangoBlackPlus, Gu thesis moduli), 0.0138 and 0.0126 for n = 1724 and 1897 (Rigid 10K / Flexible 80A V2 with the project\'s 5.8 MPa secant estimate), i.e. 0.4 % to 0.9 % of the 1.5 ceiling; at n = 50 (Dimas effective ratio) it is 0.375 (25 %), at n = 10 it is 0.996 (66 %, matching the earlier "34 % loss").',
  'f(1,n) = 0.0058 / 0.0138 / 0.0126 / 0.375 / 0.996', 'high',
  ''),
 ('corpus_json',
  'OWN CALCULATION: reaching the ceiling at such contrast needs m = n^(-1/2), a thickness ratio of 64 (n = 4126), 41.5-43.5 (n = 1724-1897), 7.1 (n = 50) or 3.2 (n = 10). With a 0.2 mm thin layer (Form 4 minimum wall in the project record) the thick layer would be 12.9, 8.3-8.7, 1.41 or 0.63 mm. The modulus ratio drops out of the curvature at the optimum, but it sets how thick the part must be. Timoshenko assumes small linear strain; the earlier agents note it over-predicts soft printed bilayers, so these are upper bounds.',
  'optimum thickness ratio 64 / 41.5-43.5 / 7.1 / 3.2', 'high',
  ''),
 ('corpus_json',
  'OWN CALCULATION: osmotic pressure Pi = -(R T / v_m) ln(RH) at 25 C with v_m = 18.0 cm3/mol (water molar volume; unverified background constant): 166 MPa at 30 % RH, 95 MPa at 50 %, 49 MPa at 70 %, 14.5 MPa at 90 %, 7.1 MPa at 95 %, 1.4 MPa at 99 %, 0.41 MPa at 99.7 %. The thermodynamic driving pressure at room humidity is far above the roughly 0.3 to 100 MPa stresses Masic reports, so the limit on a printed layer is its sorption isotherm and stiffness, not the pressure.',
  '49 MPa at 70 % RH; 0.4 MPa at 99.7 % RH', 'medium',
  ''),
]
