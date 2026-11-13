# -*- coding: utf-8 -*-
"""Part 2: key claims, table, citations, narrative, glossary, reproduce, gaps. Run build_report.py to assemble."""
from report_part1 import Q, URL, findings, FAILS

key_claims = [
    {'claim': 'Measured: stuffed Cypselurus hiraii models in a 12 m/s wind tunnel (Re about 2e4) reach a lift-to-drag ratio of at most 4.37 and a lift coefficient of at most 0.78; this polar is the only direct force measurement on flying-fish bodies and underlies every range bound below.',
     'source': URL['PC'], 'evidence_quote': Q('PC', '10.7 4.37 (0) 0.78 (35)')},
    {'claim': 'Assumed, not found: the Deng 2019 CFD headline (45.4 m glide, 13.2 m apex) rests on a take-off speed fixed at 20 m/s, uses coefficients computed at 10 m/s, and pairs a distance from the 0-degree run with an apex from the 10-degree run (whose best distance is 41.5 m).',
     'source': URL['DENG'], 'evidence_quote': Q('DENG', 'The take-off speed is fixed at 20 m')},
    {'claim': 'Measured then derived: in an aquarium, Cypselurus heterurus doederleini leaped at an estimated 3.9-5.2 m/s, well below the 9.85 m/s stall speed I derive for the L3 body; the quoted field values (leap 10 m/s, glide 50 m, air speed 15-20 m/s) are second-hand from older film work.',
     'source': URL['MAK'], 'evidence_quote': Q('MAK', 'leap from the water surface at speeds of 3.9 to 5.2 m s')},
    {'claim': 'Derived (lift equals weight assumed): a single level lifting glide of 50 m at L/D 4.37 needs launch airspeed of at least 17.9 m/s (17.0 with a 14 percent ground-effect drag cut) once the stall floor is respected; the bound is a theorem for lift = weight only, so lofted ballistic phases and repeated taxiing fall outside it.',
     'source': URL['CALC'], 'evidence_quote': Q('PC', '10.7 4.37 (0) 0.78 (35)')},
]

table = [
    {'name': 'Park and Choi 2010, model L3 aerodynamic polar', 'fields': 'L/Dmax=4.37 (at ~0 deg); CLmax=0.78 (at 35 deg); CDmin=0.055; AR=10.7; Re=2.0e4; tunnel speed=12 m/s; SL~203 mm; mass~0.06 kg', 'source': URL['PC']},
    {'name': 'Park and Choi 2010, ground effect (model L3)', 'fields': 'drag cut=14% over water at h/half-span 0.33; drag cut=9% over solid at 0.21; body-only cut=7% (water), 4% (solid)', 'source': URL['PC']},
    {'name': 'Park and Choi 2010, pelvic fins', 'fields': 'lift gain at 0 deg vs pectoral-only model M=>20%; drag change=about -10% for model M', 'source': URL['PC']},
    {'name': 'Deng 2019 CFD polar', 'fields': 'CLmax=1.03; L/Dmax=4.7; coefficient speed=10 m/s; Re=2.6e4', 'source': URL['DENG']},
    {'name': 'Deng 2019 3-DOF trajectories (launch fixed 20 m/s)', 'fields': 'best distance alpha0=0:45.4 m (3.5 s); best distance alpha0=10:41.5 m (3.47 s); max height alpha0=0:12.5 m; max height alpha0=10:13.2 m', 'source': URL['DENG']},
    {'name': 'Makiguchi 2013 aquarium leaps', 'fields': 'estimated leap speed=3.9-5.2 m/s; predicted from stroke frequency=3.87-5.15 m/s; share of earlier max swim speed=38.7-51.5%', 'source': URL['MAK']},
    {'name': 'Field values quoted second-hand (Makiguchi, Park and Choi, Deng)', 'fields': 'leap speed=~10 m/s; glide=up to 50 m; air speed=15-20 m/s; total with taxiing=up to 400 m in 30 s; max recorded height=8 m; Hertel 48 m at 20 m/s with 10 m/s head wind', 'source': URL['MAK']},
    {'name': 'Kawachi, Inada and Azuma 1993 (via Deng)', 'fields': 'assumed L/Dmax=15.7; fish mass=0.226 kg; wing area=0.0225 m2; max distance=80 m', 'source': URL['DENG']},
    {'name': 'Davenport 1992, Exocoetus obtusirostris exponents', 'fields': 'mass exponent=2.981; lateral fin area exponent=1.834; wing-loading exponent=1.236 (implied 1.147); fin length limit=78-79% SL', 'source': URL['DAV92']},
    {'name': 'Davenport 2003 geometric limits', 'fields': 'leading edge=24% SL from snout; max wing length=76% SL', 'source': URL['DAV03']},
    {'name': 'Davenport 1994 review values', 'fields': 'adult length=150-500 mm; tail beat<=50 /s; approach<30 BL/s; pelvic area=20-35% of lateral fin area; ground effect below 0.5 m for 0.3 m SL; min water temp for flight=20-23 C; first flight at ~50 mm', 'source': URL['DAV94']},
    {'name': 'Daane 2021 pectoral/SL, flying fish (n=49, 3 species)', 'fields': 'min=0.406; median=0.687; max=0.823; log-log slope=1.058 [1.017,1.099]; r2=0.983', 'source': URL['DAANE'] + ' | recomputed by ' + URL['CALC']},
    {'name': 'Daane 2021 pectoral/SL, flying halfbeak (n=19)', 'fields': 'min=0.175; median=0.274; max=0.388', 'source': URL['DAANE'] + ' | recomputed by ' + URL['CALC']},
    {'name': 'Daane 2021 pectoral/SL, halfbeak (n=22)', 'fields': 'min=0.115; median=0.140; max=0.177', 'source': URL['DAANE'] + ' | recomputed by ' + URL['CALC']},
    {'name': 'Daane 2021 pectoral/SL, needlefish (n=19)', 'fields': 'min=0.071; median=0.088; max=0.106', 'source': URL['DAANE'] + ' | recomputed by ' + URL['CALC']},
    {'name': 'Daane 2021 genomics', 'fields': 'species=35; loci>300,000; gliding-only convergent substitutions=44 vs controls 14-28; genes lat4a (T200K), kcnh2a', 'source': URL['DAANE']},
    {'name': 'Taxi CFD preprint (Deng, Wang, Zhang, Mao)', 'fields': 'fish=0.25 m, 0.191 kg; swim power at 10 m/s=350 W; taxi power at 10 m/s=36 W; speed at 350 W taxiing=16.5 m/s', 'source': URL['TAXI']},
    {'name': 'Chen and Hu 2026 taxiing CFD', 'fields': 'tail thrust coeff taxi=1.22; deep swim=-3.79; lift coeff taxi=2.15; glide=0.57; caudal lift share in taxi>60%; pectoral lift share in glide=85%', 'source': URL['CHENHU']},
    {'name': 'Robot models', 'fields': 'Saro-Cortes Re=30,000; Chen 2023 exit speed=1.55 m/s (5.9 BL/s); crossing time=0.233 s; morphing gain in glide=+7.2%', 'source': URL['SARO'] + ' | ' + URL['CHEN23']},
    {'name': 'Fossil thoracopterids', 'fields': 'Wushaichthys/Peripeltopleurus age=Ladinian 235-242 Ma; extant Exocoetidae fossils no older than Eocene; extant species=~50 (Xu 2013) or 80 (2026 cytogenetics)', 'source': URL['XU15'] + ' | ' + URL['XU13'] + ' | ' + URL['CYT']},
    {'name': 'My derivation, L3 stall speed', 'fields': 'W=0.5886 N; S=0.012688 m2; wing loading=46.4 N/m2; vmin=9.85 m/s (8.58 with CLmax 1.03)', 'source': URL['CALC']},
    {'name': 'My derivation, energy-height range bound (L/D 4.37, no stall floor)', 'fields': 'v=10:22.3 m; v=15:50.1 m; v=20:89.1 m; speed for 50 m=14.98 m/s; speed to reach 13.2 m apex=16.1 m/s', 'source': URL['CALC']},
    {'name': 'My derivation, range bound with stall floor', 'fields': 'v=15:28.5 m; v=20:67.5 m; launch needed for 50 m=17.9 m/s (17.0 with 14% ground effect)', 'source': URL['CALC']},
    {'name': 'My derivation, Deng trajectories vs bound', 'fields': 'energy height=20.4 m; bound at L/D 4.7=95.8 m; 45.4 m ratio=0.47; 41.5 m ratio=0.43; apex 13.2 m ratio=0.65', 'source': URL['CALC']},
    {'name': 'My derivation, aquarium leaps vs ballistic', 'fields': 'ballistic apex at 3.87-5.15 m/s=0.76-1.35 m; max range at 45 deg=1.5-2.7 m; speed/vmin=0.39-0.52', 'source': URL['CALC']},
    {'name': 'My derivation, powered flight vs registry E3 v2', 'fields': 'level power at vmin=1.33 W; at 15 m/s=2.02 W; ceiling=0.0833 W; ratios=16x and 24x', 'source': URL['CALC']},
    {'name': 'My derivation, taxi power per kg', 'fields': 'CFD=188 W/kg; E3 ceiling=1.39 W/kg; ratio=136', 'source': URL['CALC']},
    {'name': 'Palstra 2010 zebrafish unit check', 'fields': 'MO2max at Ucrit=82.18 umol/g/h = 2629.6 mg O2/kg/h; fish 3.05 cm, 0.43 g; Ucrit=0.548 m/s', 'source': URL['PAL']},
    {'name': 'Registry law set 1.8.1 (application repo)', 'fields': 'E3 2.1.0 aerobic ceiling=0.0833 W at 0.06 kg; flight-climb-glide-law 1.0.0 (glide_range_le); perturb-wind-glide 1.0.0; Constraints.lean has vmin/aerobic/glide/climb rules_out lemmas', 'source': URL['REPO']},
]

def cit(authors, year, title, doi, how, used, venue, verified=True):
    return {'authors': authors, 'year': year, 'title': title, 'doi_or_arxiv': doi, 'verified': verified,
            'how_verified': how, 'used_for': used, 'venue': venue}

CR = 'Crossref works API https://api.crossref.org/works/<doi> fetched 2026-11-12 (title, year, authors, volume matched)'
citations = [
    cit('Park H, Choi H', 2010, 'Aerodynamic characteristics of flying fish in gliding flight', '10.1242/jeb.046052',
        CR + '; Europe PMC core record fetched; full text read from the project cached PDF (physics/prior-art/raw/wb-park-choi-2010.pdf, re-extracted with pdftotext)', 'wind-tunnel polar, ground effect, pelvic fins', 'J Exp Biol 213:3269-3279'),
    cit('Deng J, Zhang L, Liu Z, Mao X', 2019, 'Numerical prediction of aerodynamic performance for a flying fish during gliding flight', '10.1088/1748-3190/ab23e6',
        CR + '; Europe PMC abstract fetched; full text read from project cached PDF (pdf2-deng-2019.pdf)', 'CFD polar, 20 m/s launch assumption, trajectories', 'Bioinspir Biomim 14:046009'),
    cit('Deng J, Wang S, Zhang L, Mao X', 2019, 'Why does a flying fish taxi on sea surface before take-off? A hydrodynamic interpretation', '10.1101/765560',
        CR + '; Europe PMC preprint record fetched (abstract only; the bioRxiv PDF in the project cache is a Cloudflare error page)', 'taxi versus swim power (preprint, abstract only)', 'bioRxiv preprint'),
    cit('Makiguchi Y, Kuramochi K, Iwane S, Kojima T, Naito Y', 2013, 'Take-off performance of flying fish Cypselurus heterurus doederleini measured with miniature acceleration data loggers', '10.3354/ab00494',
        CR + '; open PDF downloaded from int-res.com and read (sha256 f0bc4054...)', 'aquarium leap speeds; quoted field values', 'Aquat Biol 18:105-111'),
    cit('Davenport J', 1994, 'How and why do flying fish fly?', '10.1007/bf00044128',
        CR + '; Springer landing page downloaded and the 13-point abstract read in full (sha256 77b5a089...)', 'main review: flight sequence, hypotheses, ground effect, temperature', 'Rev Fish Biol Fisheries 4:184-214'),
    cit('Davenport J', 1992, 'Wing-loading, stability and morphometric relationships in flying fish (Exocoetidae) from the North-eastern Atlantic', '10.1017/s0025315400048761',
        CR + ' (abstract in the Crossref record read; tables not read)', 'growth exponents, 78-79% fin limit, anaerobic take-off', 'J Mar Biol Assoc UK 72:25-39'),
    cit('Davenport J', 2003, 'Allometric constraints on stability and maximum size in flying fishes: implications for their evolution', '10.1046/j.1095-8649.2003.00041.x',
        CR + ' (abstract read; full text paywalled)', '24% and 76% SL geometric limits; challenge to ballistic-leap origin', 'J Fish Biol 62:455-463'),
    cit('Fish FE', 1990, 'Wing design and scaling of flying fish with regard to flight performance', '10.1111/j.1469-7998.1990.tb04009.x',
        CR + ' (abstract read; no numbers in it)', 'six-genus fin scaling (qualitative)', 'J Zool 221:391-403'),
    cit('Daane JM, Blum N, Lanni J, Boldt H, Iovine MK, Higdon CW, Johnson SL, Lovejoy NR, Harris MP', 2021, 'Modulation of bioelectric cues in the evolution of flying fishes', '10.1016/j.cub.2021.08.054',
        CR + '; Europe PMC record fetched; full text (PMC9172250) downloaded via NCBI efetch and read (sha256 a478d83a...)', 'fin allometry, convergent genomics, lat4a and kcnh2a', 'Curr Biol 31:5052-5061.e8'),
    cit('Stewart S, Le Bleu HK, Yette GA, Henner AL, Robbins AE, Braunstein JA, Stankunas K', 2021, 'longfin causes cis-ectopic expression of the kcnh2a ether-a-go-go K+ channel to autonomously prolong fin outgrowth', '10.1242/dev.199384',
        CR + '; PMC8217709 abstract read (author list from Crossref: first author Stewart S, 7 authors; other names not transcribed here)', 'independent test of kcnh2a and fin size', 'Development 148:dev199384'),
    cit('Xu G-H, Zhao L-J, Gao K-Q, Wu F-X', 2013, 'A new stem-neopterygian fish from the Middle Triassic of China shows the earliest over-water gliding strategy of the vertebrates', '10.1098/rspb.2012.2261',
        CR + '; PMC3574442 abstract read (full text not in the PMC record fetched)', 'Triassic gliding; species count; Eocene record', 'Proc R Soc B 280:20122261'),
    cit('Xu G-H, Zhao L-J, Shen C-C', 2015, 'A Middle Triassic thoracopterid from China highlights the evolutionary origin of overwater gliding in early ray-finned fishes', '10.1098/rsbl.2014.0960',
        CR + '; PMC4321159 abstract read', 'Ladinian ages; four-stage sequence', 'Biol Lett 11:20140960'),
    cit('Lewallen EA, Pitman RL, Kjartanson SL, Lovejoy NR', 2010, 'Molecular systematics of flyingfishes (Teleostei: Exocoetidae): evolution in the epipelagic zone', '10.1111/j.1095-8312.2010.01550.x',
        CR + '; Europe PMC abstract read (Europe PMC lists year 2011, Crossref 2010)', 'two-wing to four-wing progression; Cheilopogon polyphyly', 'Biol J Linn Soc 102:161-174'),
    cit('Saro-Cortes V, Cui Y, Dufficy T, Boctor A, Flammang BE, Wissa AW', 2022, 'An Adaptable Flying Fish Robotic Model for Aero- and Hydrodynamic Experimentation', '10.1093/icb/icac101',
        CR + ' (abstract read)', 'pelvic fin lift-stability trade-off', 'Integr Comp Biol'),
    cit('Chen D, Wu Z, Dong H, Meng Y, Yu J', 2023, 'Platform development and gliding optimization of a robotic flying fish with morphing pectoral fins', '10.1088/1748-3190/acce86',
        CR + ' (abstract read)', 'robot exit speed and morphing gain', 'Bioinspir Biomim 18:036010'),
    cit('Chen X, Hu (full author list not transcribed)', 2026, 'Flow mechanisms of flying fish during free-surface taxiing', '10.1063/5.0347662',
        CR + ' (abstract read; Crossref lists 2 authors, first Chen Xinyang)', 'taxiing lift and thrust coefficients', 'Phys Fluids 38:111902'),
    cit('Palstra AP, Tudorache C, Rovira M, Brittijn SA, Burgerhout E, van den Thillart GEEJM, Planas JV', 2010, 'Establishing Zebrafish as a Novel Exercise Model: Swimming Economy, Swimming-Enhanced Growth and Muscle Growth Marker Gene Expression', '10.1371/journal.pone.0014483',
        CR + '; PMC3013094 full text downloaded and the oxygen-uptake sentence read (sha256 7993efc1...)', 'provenance of the aerobic input behind registry law E3 v2', 'PLoS ONE 5:e14483'),
    cit('Costa GWWF da et al. (6 authors; first author per Crossref)', 2026, 'Flying fish as useful model for evolutionary investigations in epipelagic zones. A cytogenomic and chromosomal analysis', '10.3897/compcytogen.20.190559',
        CR + '; PMC13282621 full text downloaded and read (title shortened to what Crossref returned)', 'species-count disagreement; karyotype 2n=48', 'Comp Cytogenet 20:141-155'),
    cit('Khandelwal PC, Zakaria M, Socha JJ', 2023, 'A Year at the Forefront of Gliding Locomotion', '10.1242/bio.059973',
        CR + '; PMC10445725 full text downloaded and read', 'review context: flying fish gliding in the wild is understudied', 'Biol Open 12:bio059973'),
    cit('Socha JJ, Jafari F, Munk Y, Byrnes G', 2015, 'How animals glide: from trajectory to morphology', '10.1139/cjz-2014-0013',
        CR + ' (record only; full text not read)', 'best general review of gliding mechanics (pointer, not used for numbers)', 'Can J Zool 93:901-924'),
    cit('Kawachi K, Inada Y, Azuma A', 1993, 'Optimal Flight Path of Flying Fish', '10.1006/jtbi.1993.1113',
        CR + ' (title record only; ScienceDirect page returned no abstract; contents known only through Deng 2019)', 'second-hand source of L/D 15.7 and 80 m', 'J Theor Biol 163:145-159'),
]

glossary = [
    {'term': 'glide', 'plain': 'moving through air with no engine or wing-flapping, trading height and speed for distance'},
    {'term': 'lift-to-drag ratio (L/D)', 'plain': 'how many metres forward a glider travels for each metre it sinks; higher is better'},
    {'term': 'wing loading', 'plain': 'body weight divided by wing area; a high number means the animal must fly faster to stay up'},
    {'term': 'stall speed', 'plain': 'the slowest speed at which the wings can still hold the body up'},
    {'term': 'taxiing', 'plain': 'skimming along the water surface with the tail flicking in the water to gain speed before and between glides'},
    {'term': 'ground effect', 'plain': 'extra efficiency a wing gets when it flies very close to a surface such as the sea'},
    {'term': 'wind tunnel', 'plain': 'a tube with moving air used to measure the forces on a model held still'},
    {'term': 'CFD (computational fluid dynamics)', 'plain': 'a computer simulation of how air or water flows around an object'},
    {'term': 'Reynolds number', 'plain': 'a number comparing speed, size and air stickiness that tells you whether two flows behave alike'},
    {'term': 'aerobic', 'plain': 'powered by muscle that burns oxygen continuously, as in steady cruising'},
    {'term': 'anaerobic / white muscle', 'plain': 'muscle that gives short bursts of power from stored fuel without needing oxygen at that moment'},
    {'term': 'allometry', 'plain': 'how a body part grows relative to the whole body as the animal gets bigger'},
    {'term': 'elimination certificate', 'plain': 'a computer-checked proof that a stated design or claim breaks a stated law and so cannot be true'},
    {'term': 'energy height', 'plain': 'the height you would need to start from, with no speed, to have the same total energy as a given height and speed'},
    {'term': 'convergent evolution', 'plain': 'unrelated groups independently evolving the same trait'},
    {'term': 'two-winger / four-winger', 'plain': 'flying fish with only enlarged chest fins versus those with enlarged chest and belly fins'},
]

lay_summary = ('Flying fish do not fly like insects. They launch themselves out of the sea and glide, rather like a paper plane that can swim. '
 'The best force measurements we have come from dead, stuffed fish held in a wind tunnel, and they say a fish can travel about four metres forward for every metre it drops. '
 'That is far better than a plain body but nowhere near a sailplane. '
 'Reported glides of 50 metres therefore need a very fast start, which the fish gets by skimming the water and beating its tail up to 50 times a second. '
 'Nobody has yet filmed and measured a wild glide end to end with modern tools, so the speeds and distances people quote are second-hand. '
 'Our contribution is to turn those few measurements into simple limits that a computer can check, and to show where those limits are loose, wrong, or silent.')
