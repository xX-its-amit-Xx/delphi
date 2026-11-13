"""Builds D:/Users/ashenoy00000/delphi-work/agents2/t4-glide-deep.json; verifies every evidence quote against the stored source text first.
Run: python build.py   (needs fetch_all.sh, cr_fetch.py and epmc_abs.py to have been run so the scratch caches exist)"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import verify, cr, ep
from findings_a import A
from findings_b import B
from text_blocks import SUMMARY, LAY, GLOSSARY

OUT = 'D:/Users/ashenoy00000/delphi-work/agents2/t4-glide-deep.json'
AX = 'https://arxiv.org/abs/'

findings = []
for (i, claim, source, conf, value, qkey, quote) in A + B:
    if qkey and quote:
        assert verify(qkey, quote), ('quote not found', i)
        assert len(quote.split()) <= 40, ('quote too long', i)
    findings.append({'id': i, 'claim': claim, 'source': source, 'confidence': conf, 'value': value, 'evidence_quote': quote})

key_claims = [
 {'claim': 'In 3D-printed double-winged fruits dropped in water, terminal descent speed has a minimum at an intermediate fold angle KL: about 2.3 at base angle 0 and about 1.2 at base angle 35 deg (shipped data re-read: 0.1011 m/s at KL 2.31 for psi=0; 0.0674-0.0676 m/s at KL 1.2-1.33 for psi=35).',
  'source': AX + '1811.12221 ; data: github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds (analyze_repo.py)',
  'evidence_quote': 'we notice that the optimal fold angle has decreased, with a minimum terminal descent velocity obtained near KL  1.2.'},
 {'claim': 'The blade-element model is partly tuned, not parameter-free: the published drag is halved to match tank data, and the model loading (1.2 g) differs from the data key (2.16 g); the model also gives a psi=0/psi=35 best-speed ratio of 1.21 where the data give 1.50.',
  'source': AX + '1811.12221 ; derived.py block B',
  'evidence_quote': 'we reduce the value of the drag coefficient to obtain good agreement with our experiments'},
 {'claim': 'Wild whirling fruits have mean fold angle 1.8 (10 percent image error, 27 fruits), at the model optimum for base angle 15 deg; the base angle of each fruit is not reported.',
  'source': AX + '1902.08038',
  'evidence_quote': 'which is illustrated by the errorbar from mean(KL) = 1.8'},
 {'claim': 'A simple wind-drift bound (distance = wind x height / sink speed) is respected but loose for real dipterocarp fruits: 4.1-8.0 times (median 6.9) above the fitted field distances, so slow descent alone does not set dispersal distance.',
  'source': 'https://doi.org/10.1002/ece3.1469 (PMC4485961 Table 3); derived.py block F',
  'evidence_quote': 'Dipterocarpus humeratus 9.29 (± 0.27) 326.37 4.25 21.93'},
]
for k in key_claims:
    assert verify('PRE' if '1811' in k['source'] else 'PRL' if '1902' in k['source'] else 'SMITH', k['evidence_quote']), k['claim'][:40]

table = [
 {'name': 'Fruit tank experiment, psi=35, 2.16 g key, n=3', 'fields': 'KL=0.06 U=0.1257 m/s; KL=0.60 U=0.0888; KL=0.92 U=0.0737; KL=1.20 U=0.0676; KL=1.33 U=0.0674; KL=1.50 U=0.0693; KL=1.71 U=0.0710; St at KL 1.20 = 0.54', 'source': 'https://github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds model/all_results_experiments.pkl (MIT)'},
 {'name': 'Fruit tank experiment, psi=0, 2.16 g key, n=10', 'fields': 'KL=0.92 U=0.1678 m/s; KL=1.71 U=0.1137; KL=2.31 U=0.1011; KL=3.00 U=0.1258; St at KL 2.31 = 0.83', 'source': 'https://github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds model/all_results_experiments.pkl'},
 {'name': 'Blade-element model minima (1.2 g model loading)', 'fields': 'psi=0: Re_min=4709 at KL=2.05 (U=0.0785 m/s); psi=15: Re_min=4352 at KL=1.80 (U=0.0725 m/s, no tank test); psi=35: Re_min=3900 at KL=1.31 (U=0.0650 m/s); U=Re*1e-6/0.06', 'source': 'repo model/model_data_psi_0.pkl, model_data_camber_psi_15.0.pkl, model_data_psi_35.pkl; analyze_repo.py'},
 {'name': 'Lab versus wild regime (Fauli Table I)', 'fields': 'lab f=0.4-2.4 Hz L=0.06 m U=0.04-0.2 m/s nu=1e-6 m2/s St=0.35-0.82 Re=2400-14000 (recomputed top 12000); S. argentifolia L=0.035 m U=1.2 m/s Re=2800; S. johorensis L=0.05 m U=1.7 m/s Re=5700; S. mecistopterix L=0.08 m U=2.4 m/s Re=12700', 'source': AX + '1811.12221'},
 {'name': 'Maple samara, natural vs 3D-printed Norway maple (Nave Table 1)', 'fields': 'mass 102.4+/-30.8 vs 183.6+/-2.3 mg; length 5.65 vs 5.00 cm; CoM 28.5 vs 27.7 percent; W/S 2.09 vs 3.18 N/m2; lab descent 1.10 vs 1.28 m/s; field descent 1.03 vs 1.29 m/s; windage 0.87 vs 0.78; DF(recomputed) 2.82 vs 3.17', 'source': AX + '2010.12553'},
 {'name': 'Plate glider (Li 2022 model, Pomerenk 2025)', 'fields': 'max glide ratio=3.8 at centre-of-equilibrium offset 0.22 chord; angle=14.7 deg; dive at offset >=0.3; slenderness tested 0.001-0.1', 'source': AX + '2408.08864'},
 {'name': 'Seed-inspired engineered gliders (Wiesemuller 2022 Table 2)', 'fields': 'experiment angle D1=9.49 D2=10.32 D3=13.58 D4=12.53 deg; glide ratio=6.0, 5.5, 4.1, 4.5; mass 1.25-1.75 g', 'source': 'https://doi.org/10.3389/frobt.2022.1011793 (PMC9659746)'},
 {'name': 'Dipterocarp field release, 30 m tower (Smith 2015)', 'fields': 'D. humeratus IWL=9.29 cm2/g median=3.84 m 90th=7.94 m ballistic=21.93 m fitted=4.25 m; S. argentifolia IWL=44.60 median=8.20 m ballistic=54.53 m fitted=7.90 m; pooled 50 percent <4 m, 90 percent <10.5 m, wind 1.72 m/s', 'source': 'https://doi.org/10.1002/ece3.1469 Tables 1 and 3'},
 {'name': 'Ballistic over-prediction, 12 species', 'fields': 'ratio ballistic/fitted min=4.1 median=6.9 max=8.0 (derived)', 'source': 'derived.py block F'},
 {'name': 'Linden stalk preprint (Cazaubiel and Carlson 2025)', 'fields': 'natural stalk=3.75 cm; stalk needed >= about 0.5 x wing span; autorotation halves descent speed; Re about 4000', 'source': AX + '2508.05106'},
 {'name': 'Registry laws touching the track (set 1.8.1)', 'fields': 'flight-climb-glide-law v1.0.0 accepted hash 6ac1beea70e5 (C15,C16); perturb-wind-glide v1.0.0 (P4b); [claim id withheld] v1.0.0 (C9,C10); E1 Exocoetidae only; no autorotation law', 'source': 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/lawset-1.8.1.json'},
]

def cit(authors, year, title, ident, verified, used, how, venue=''):
    return {'authors': authors, 'year': year, 'title': title, 'doi_or_arxiv': ident, 'verified': verified, 'used_for': used, 'how_verified': how, 'venue': venue}

CR = 'Crossref API https://api.crossref.org/works/<doi> fetched this run (cr_fetch.py), title and authors matched'
citations = [
 cit('Fauli RA, Rabault J, Carlson A', 2019, 'Effect of wing fold angles on the terminal descent velocity of double-winged autorotating seeds, fruits, and other diaspores', '10.1103/physreve.100.013108 ; arXiv:1811.12221', True, 'main system; full text read', CR + '; arXiv PDF downloaded and read in full (sha256 695a8264...)', 'Phys Rev E 100, 013108'),
 cit('Rabault J, Fauli RA, Carlson A', 2019, 'Curving to Fly: Synthetic Adaptation Unveils Optimal Flight Performance of Whirling Fruits', '10.1103/physrevlett.122.024501 ; arXiv:1902.08038', True, 'wild fold angle, constraint, lift law; full text read', CR + '; arXiv PDF read in full (sha256 5c4c086f...)', 'Phys Rev Lett 122, 024501'),
 cit('Pomerenk O, Ristroph L', 2025, 'Aerodynamic equilibria and flight stability of plates at intermediate Reynolds numbers', '10.1017/jfm.2025.10275 ; arXiv:2408.08864', True, 'plate glider glide ratio 3.8 at 0.22 chord; model limits; large parts read', CR + '; arXiv PDF read (sha256 e04a215b...)', 'J Fluid Mech 1014'),
 cit('Li H, Goodwill T, Wang ZJ, Ristroph L', 2022, 'Centre of mass location, flight modes, stability and dynamic modelling of gliders', '10.1017/jfm.2022.89', True, 'plate model origin; abstract read only', CR + ' (abstract included)', 'J Fluid Mech 937'),
 cit('Nave GK Jr, Hall N, Somers K, Davis B, Gruszewski H, Powers C, Collver M, Schmale DG III, Ross SD', 2021, 'Wind Dispersal of Natural and Biomimetic Maple Samaras', '10.3390/biomimetics6020023 ; arXiv:2010.12553', True, 'printed vs natural samaras, descent factor; full text read', CR + '; arXiv PDF read (sha256 54426f54...)', 'Biomimetics 6(2), 23'),
 cit('Smith, Bagchi, Ellens, Kettle, Burslem, Maycock et al. (8 authors; first six family names from Crossref)', 2015, 'Predicting dispersal of auto-gyrating fruit in tropical trees: a case study from the Dipterocarpaceae', '10.1002/ece3.1469', True, 'field dispersal numbers; full text read (PMC XML)', CR + '; Europe PMC full-text XML PMC4485961 fetched (sha256 506cfbbb...).', 'Ecology and Evolution 5'),
 cit('Cazaubiel A, Carlson A', 2025, 'The seed-carrying stalk of the linden diaspore ensures autorotating flight', 'arXiv:2508.05106', True, 'stalk and centre-of-mass control of autorotation (preprint); full text read', 'arXiv export API search returned the id and title; PDF read (sha256 6dbcc5e2...). No DOI found (Crossref search returned none).', 'arXiv physics.bio-ph'),
 cit('Loo YJ, Alben S', 2025, 'Falling plates with leading-edge vortex shedding', 'arXiv:2503.22606', True, 'bent plates stabilise fluttering or autorotation (preprint); abstract and introduction read', 'arXiv export API search returned the id and title; PDF downloaded (sha256 2c650e18...)', 'arXiv physics.flu-dyn'),
 cit('Wiesemuller F, Meng Z, Hu Y, Farinha A, Govdeli Y, Nguyen PH, Nystrom G, Kovac M', 2022, 'Transient bio-inspired gliders with embodied humidity responsive actuators for environmental sensing', '10.3389/frobt.2022.1011793', True, 'seed-inspired glider angles; Alsomitra rate (secondary); excerpts read', CR + '; Europe PMC full text PMC9659746 fetched (sha256 3caf3a37...)', 'Front Robot AI'),
 cit('Lentink D, Dickson WB, van Leeuwen JL, Dickinson MH', 2009, 'Leading-Edge Vortices Elevate Lift of Autorotating Plant Seeds', '10.1126/science.1174196', True, 'LEV mechanism; abstract read only', CR + '; Europe PMC abstract fetched (epmc_abs.py)', 'Science 324, 1438'),
 cit('Norberg RA', 1973, 'Autorotation, self-stability, and structure of single-winged fruits and seeds (samaras) with comparative remarks on animal flight', '10.1111/j.1469-185x.1973.tb01569.x', True, 'classic blade-element and stability theory; abstract read only', CR + ' (abstract included)', 'Biological Reviews 48, 561'),
 cit('Wang ZJ, Birch JM, Dickinson MH', 2004, 'Unsteady forces and flows in low Reynolds number hovering flight: two-dimensional computations vs robotic wing experiments', '10.1242/jeb.00739', True, 'source of CL, CD fits in the fruit model; abstract read only', CR + '; Europe PMC abstract fetched', 'J Exp Biol 207, 449'),
 cit('Dickinson MH, Lehmann F-O, Sane SP', 1999, 'Wing Rotation and the Aerodynamic Basis of Insect Flight', '10.1126/science.284.5422.1954', True, 'delayed stall, rotational circulation, wake capture; abstract read only', CR + ' (abstract included)', 'Science 284, 1954'),
 cit('Sunada S, Ide A, Hoshino Y, Okamoto M', 2015, 'A study of autorotating plant seeds', '10.1016/j.jtbi.2015.08.027', True, 'lift-drag ratio controls descent factor; abstract read only', CR + '; Europe PMC abstract fetched', 'J Theor Biol 386, 55'),
 cit('Jung BK, Rezgui D', 2023, 'Sectional Leading Edge Vortex Lift and Drag Coefficients of Autorotating Samaras', '10.3390/aerospace10050414', True, 'BEM-momentum samara model; abstract read only (publisher page returned access denied)', CR + ' (abstract included)', 'Aerospace 10(5), 414'),
 cit('Liu C, Zeng L-F, Li J, Shao X', 2025, 'Effects of wings number on the flight performance of autorotating seeds', '10.1063/5.0244050', True, 'wing number effect; abstract read only', CR + ' (abstract included)', 'Physics of Fluids'),
 cit('Lentink D, Dickinson MH', 2009, 'Biofluiddynamic scaling of flapping, spinning and translating fins and wings', '10.1242/jeb.022251', True, 'dimensionless numbers for spinning wings (angular, centripetal, Rossby); abstract read only', CR + '; Europe PMC abstract fetched', 'J Exp Biol 212, 2691'),
 cit('Ulrich ER, Pines DJ, Humbert JS', 2010, 'From falling to flying: the path to powered flight of a robotic samara nano air vehicle', '10.1088/1748-3182/5/4/045009', True, 'robotic samara prior art; abstract read only', CR + '; Europe PMC abstract fetched', 'Bioinspir Biomim 5, 045009'),
 cit('Azuma A, Okuno Y', 1987, 'Flight of a samara, Alsomitra macrocarpa', '10.1016/s0022-5193(87)80001-2', True, 'pointer only; NOT read (number quoted second-hand via Wiesemuller)', CR, 'J Theor Biol 129, 263'),
 cit('Yasuda K, Azuma A', 1997, 'The Autorotation Boundary in the Flight of Samaras', '10.1006/jtbi.1996.0299', True, 'pointer only; NOT read', CR, 'J Theor Biol 185'),
 cit('Varshney K, Chang S, Wang ZJ', 2011, 'The kinematics of falling maple seeds and the initial transition to a helical motion', '10.1088/0951-7715/25/1/c1', True, 'pointer only; NOT read (Crossref year 2011 is online date; the print volume is 2012)', CR, 'Nonlinearity 25, C1'),
 cit('Lee SJ, Lee EJ, Sohn MH', 2014, 'Mechanism of autorotation flight of maple samaras (Acer palmatum)', '10.1007/s00348-014-1718-4', True, 'pointer only; NOT read', CR, 'Exp Fluids 55, 1718'),
 cit('Viola IM, Nakayama N', 2022, 'Flying seeds', '10.1016/j.cub.2022.02.029', True, 'review pointer only; NOT read (Crossref has no abstract)', CR, 'Current Biology'),
 cit('Cai J-F et al.', 2024, 'Folding angle and wing flexibility influence the flight performance of origami winged fruits', '10.1007/s11071-024-09618-4', True, 'pointer only; NOT read (no abstract available)', CR, 'Nonlinear Dynamics'),
 cit('Smith JR et al.', 2016, 'Predicting the terminal velocity of dipterocarp fruit', '10.1111/btp.12316', True, 'pointer only; NOT read', CR, 'Biotropica 48, 154'),
 cit('Augspurger CK', 1986, 'Morphology and dispersal potential of wind-dispersed diaspores of neotropical trees', '10.1002/j.1537-2197.1986.tb12048.x', True, 'pointer only; NOT read', CR, 'Am J Bot 73, 353'),
 cit('Looy CV, Stevenson R', 2014, 'Earliest Occurrence of Autorotating Seeds in Conifers: The Permian (Kungurian-Roadian) Manifestation', '10.1086/676973', True, 'pointer only; NOT read; title tail as returned by Crossref', CR, 'Int J Plant Sci'),
 cit('Patnaik S, Kanishk', 2021, 'Design optimization of monoblade autorotating pods to exhibit an unconventional descent technique using Glauert\'s modeling', 'arXiv:2107.00738', True, 'BEM-theory design of a single-wing pod; abstract read only', 'arXiv export API search returned the id; PDF downloaded', 'IMECE2021-69936'),
]

could_not_find = [
 'Full text of the older primary papers (Norberg 1973, Azuma and Okuno 1987, Yasuda and Azuma 1997, Lentink 2009, Wang 2004, Dickinson 1999, Li 2022, Lee 2014, Varshney 2011): paywalled or blocked to a scripted client (publisher pages returned 403/404; MDPI returned Access Denied, not worked around). Only abstracts were read for these, so their numbers are not used as load-bearing.',
 'Honest count against the brief (12 primary sources read for real): full or near-full text read for 7 (Fauli 2019, Rabault 2019, Pomerenk and Ristroph 2025, Nave 2021, Smith 2015, Cazaubiel and Carlson 2025, Wiesemuller 2022 excerpts) plus the repository code and data; abstract-level only for 11 more. The 12-full-text target was NOT met.',
 'Fresh air-density and lead-density values: 1.225 kg/m3 used in derived.py is unverified background; nothing load-bearing rests on it except DF 2.82/3.17 and the vmin_le scope test.',
 'The letter (PRL) Supplemental Material with per-species fold angles; so the base angle of each wild fruit and any fold-versus-base-angle relation could not be tested.',
 'Any tank or field test at base angle 15 deg, base angle 55 deg or other wing pitch; none found in the 2024-2025 literature I could read (Cai 2024 origami fruits was not readable).',
 'Raw trajectories of plate gliders (Li 2022) or Alsomitra (Azuma and Okuno); the 3.8 glide ratio is model output, not a measurement.',
 'Which lead-mass key in the data matches the model 1.2 g loading; the model code is Python 2.7 and was not re-run (this run re-read stored model outputs only).',
 'Crossref search was rate-limited (429) for several queries, so some candidate papers were not looked up (e.g. other samara CFD papers).',
 'Headroom: RAM 34.8 percent free, C: 5.5 GB, D: 9.4 GB at start; downloads 54 MB total in data/t4-glide-*; no Lean process was run (not needed: law files were read as text).',
]

recommendations = [
 'Build the psi=15 and psi=55 fruits only after freezing both the blade-element prediction and the disk-area rival (see design-glide.json); this report shows the model already misses the psi=0 to psi=35 offset (1.21 versus 1.50), so a psi=15 test is a real discrimination, not a rubber stamp.',
 'Weigh each fruit immersed and record lead mass, so the unresolved 1.2 g versus 2.16 g loading question is removed before analysis.',
 'Do not use vmin_le as an elimination rule on any autorotating body without declaring an effective CL,max near the descent factor (about 3); treat law hits there as scope warnings.',
 'Anchor any ecology claim to Smith 2015: slow descent is necessary but the field bound is loose by about 7x, so claim descent speed, not dispersal distance.',
 'Check law E1 before reusing its exponents: its own text says they are not mutually consistent (1.147 vs 1.236), and it is fish-only.',
 'Re-fetch the 2024-2025 papers (Cai, Liu, Cazaubiel) when a licence-clean full text exists; the stalk result may add a second knob (centre of mass) worth a test.',
]

reproduce = [
 {'what': 'Download every external file with URL, size and sha256 (skips existing)', 'command_or_url': 'bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/fetch_all.sh', 'expected': 'table of 10 files; repo.zip 3065098 bytes sha256 c9c2d6617b12...551b; smith2015.xml 96868 bytes sha256 506cfbbb6587...cff; 1811.12221.pdf 3146306 bytes sha256 695a826495a6...caf (GitHub zip is a branch snapshot, so its hash can change if the repo is pushed to)'},
 {'what': 'Re-read tank data and stored model minima (Python 3.14, numpy 2.5.3; restricted unpickler)', 'command_or_url': 'python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/analyze_repo.py', 'expected': 'psi=0 KL=2.31 U=0.1011 f=1.398; psi=35 KL=1.20 U=0.0676, KL=1.33 U=0.0674; model min Re 4709 (KL 2.05), 4352 (1.80), 3900 (1.31)'},
 {'what': 'All own calculations (Re check, ratio 1.21 vs 1.50, descent factor, glide angles, dispersal bound ratios, CL peak, vmin_le scope test)', 'command_or_url': 'python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/derived.py', 'expected': 'lab high 12000 (table 14000); 1.50 vs 1.21; DF 2.82 and 3.17; ballistic/fitted 4.1-8.0 median 6.9; max CL 1.805; vmin 1.37 vs 1.10 m/s'},
 {'what': 'Verify DOIs on Crossref and fetch Europe PMC abstracts', 'command_or_url': 'python cr_fetch.py <doi ...> ; python epmc_abs.py <doi ...>   (in the scripts folder; generic User-Agent)', 'expected': 'OK lines with title and year; cache in agents2/scratch/t4-glide-deep/crossref.json and epmc.json'},
 {'what': 'Rebuild the report and re-check every evidence quote against the stored source text', 'command_or_url': 'python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/build.py', 'expected': 'writes agents2/t4-glide-deep.json; fails loudly if any quote is not found verbatim'},
 {'what': 'Check the law claims', 'command_or_url': 'read D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/{flight-climb-glide-law,perturb-wind-glide,[claim id withheld],E1}.json and lean/Delphi/Perturb.lean (glide_ground_range), and grep -il -E "autorot|samara" lean/registry/laws', 'expected': 'content hash 6ac1beea70e5 for flight-climb-glide-law (same in upstream leanbio 1.6.0); no grep hit for autorotation'},
 {'what': 'Not reproducible here', 'command_or_url': 'blade-element model re-run (Python 2.7 code) and all tank experiments', 'expected': 'not re-run; stored model outputs were re-read instead. Original tank drops need a Formlabs printer and a 1.2 m tank.'},
]

scripts_written = [
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/fetch_all.sh',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/analyze_repo.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/derived.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/cr_fetch.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/cr_search.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/epmc_abs.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/arxiv_q.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/sources.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/findings_a.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/findings_b.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/text_blocks.py',
 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-deep/build.py',
]

result = {
 'label': 't4-glide-deep',
 'topic': 'Track 4 deep literature: passive-glide surrogate, 3D-printed double-winged autorotating fruits and the published blade-element model',
 'summary': SUMMARY.strip(),
 'lay_summary': LAY,
 'findings': findings,
 'key_claims': key_claims,
 'table': table,
 'recommendations': recommendations,
 'reproduce': reproduce,
 'citations': citations,
 'could_not_find': could_not_find,
 'glossary': [{'term': t, 'plain': p} for t, p in GLOSSARY],
 'scripts_written': scripts_written,
}
blob = json.dumps(result, ensure_ascii=False, indent=1)
bad = re.findall(r'\b([held-out clade]|[held-out clade]|[held-out clade]|feather|feathers|beak|beaks|hummingbird|swift|swifts)\b', blob, flags=re.I)
assert not bad, ('holdout words present', bad[:5])
for c in citations:
    doi = c['doi_or_arxiv'].split(' ;')[0]
    if doi.startswith('10.'):
        assert doi.lower() in {k.lower() for k in cr}, ('DOI not in crossref cache', doi)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(result, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('wrote', OUT, os.path.getsize(OUT), 'bytes;', len(findings), 'findings;', len(citations), 'citations')
