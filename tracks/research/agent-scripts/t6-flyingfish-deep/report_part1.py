# -*- coding: utf-8 -*-
"""Part 1 of the t6-flyingfish-deep builder: source texts, quote checker, findings and key claims."""
import json, re, unicodedata
S = 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t6-flyingfish-deep/'

def norm(s):
    s = unicodedata.normalize('NFKC', s)
    s = s.replace('\u2010', '-').replace('\u2011', '-').replace('\u2212', '-').replace('\u2013', '-')
    s = re.sub(r'-\s*\n\s*', '', s)
    return re.sub(r'\s+', ' ', s).strip().lower()

def rd(f):
    return norm(open(S + f, encoding='utf8', errors='ignore').read())

XR = json.load(open(S + 'crossref_abstracts.json', encoding='utf8'))
TXT = {
    'PC': rd('pc_raw.txt'), 'DENG': rd('deng_raw.txt'), 'MAK': rd('mak_raw.txt'),
    'DAANE': rd('pmc9172250.txt'), 'LEWEPMC': rd('lewallen_epmc.txt'), 'DAV94': rd('davenport1994_abstract.txt'),
    'CYT': rd('cytogenet2026-PMC13282621.txt'), 'PAL': rd('palstra.txt'),
    'BIOL': rd('biolopen2023-PMC10445725.txt'),
}
for k, v in XR.items():
    TXT['X:' + k] = norm(v.get('abstract', ''))

FAILS = []
def Q(src, quote):
    """Return quote if found verbatim (normalised whitespace/dashes) in source text, else '' and log."""
    if not quote:
        return ''
    if norm(quote) in TXT[src]:
        return quote
    FAILS.append((src, quote))
    return ''

URL = {
    'PC': 'https://doi.org/10.1242/jeb.046052',
    'DENG': 'https://doi.org/10.1088/1748-3190/ab23e6',
    'TAXI': 'https://doi.org/10.1101/765560',
    'MAK': 'https://doi.org/10.3354/ab00494',
    'DAV94': 'https://doi.org/10.1007/bf00044128',
    'DAV92': 'https://doi.org/10.1017/s0025315400048761',
    'DAV03': 'https://doi.org/10.1046/j.1095-8649.2003.00041.x',
    'FISH90': 'https://doi.org/10.1111/j.1469-7998.1990.tb04009.x',
    'DAANE': 'https://doi.org/10.1016/j.cub.2021.08.054',
    'XU13': 'https://doi.org/10.1098/rspb.2012.2261',
    'XU15': 'https://doi.org/10.1098/rsbl.2014.0960',
    'LEW': 'https://doi.org/10.1111/j.1095-8312.2010.01550.x',
    'SARO': 'https://doi.org/10.1093/icb/icac101',
    'CHEN23': 'https://doi.org/10.1088/1748-3190/acce86',
    'CHENHU': 'https://doi.org/10.1063/5.0347662',
    'PAL': 'https://doi.org/10.1371/journal.pone.0014483',
    'CYT': 'https://doi.org/10.3897/compcytogen.20.190559',
    'LOF': 'https://doi.org/10.1242/dev.199384',
    'BIOL': 'https://doi.org/10.1242/bio.059973',
    'REPO': 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/CHANGELOG.md',
    'CALC': 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-deep/analysis.py',
}

def F(claim, srckey, conf, value='', quote='', qsrc=None, label='', extra_source=''):
    """Finding row. label in {measured, derived, assumed, contested, reported-second-hand}."""
    q = Q(qsrc, quote) if qsrc else ''
    src = URL.get(srckey, srckey) + (' | ' + extra_source if extra_source else '')
    return {'claim': ('[' + label + '] ' if label else '') + claim, 'source': src, 'confidence': conf,
            'value': value, 'evidence_quote': q}

findings = []
A = findings.append

# ---------------- measured aerodynamics (wind tunnel) ----------------
A(F('Wind-tunnel force measurements on stuffed Cypselurus hiraii (a four-winged flying fish) give a best lift-to-drag ratio of 4.37, reached at an angle of attack near 0 degrees, for the best model (L3).',
    'PC', 'high', 'L/Dmax = 4.37 at 0 deg', '10.7 4.37 (0) 0.78 (35)', 'PC', 'measured'))
A(F('Same table: maximum lift coefficient 0.78 at 35 degrees; minimum drag coefficient 0.055 (the sign of the angle is lost in text extraction; the project reads -10 deg). Coefficients use the sum of pectoral, pelvic and body planform area as reference area.',
    'PC', 'high', 'CLmax = 0.78; CDmin = 0.055', '10.7 4.37 (0) 0.78 (35)', 'PC', 'measured'))
A(F('Lift is largest near 30-35 degrees, which matches the angle at which flying fish are seen to leave the sea; the lift curve stays high after stall (thin-airfoil stall).',
    'PC', 'high', 'peak CL at 30-35 deg', 'the lift coefficient is largest at attack angles around', 'PC', 'measured'))
A(F('Enlarged pelvic fins raise lift (by more than 20 percent at 0 degrees compared with the pectoral-only model M) and improve pitch stability; the paper explains this by a jet-like accelerated flow between pectoral and pelvic fins (smoke-wire flow visualisation).',
    'PC', 'high', '>20% lift gain at 0 deg', 'The role of the pelvic fins was found to increase the lift force and lift-to-drag ratio', 'PC', 'measured'))
A(F('Tunnel speed 12 m/s, chord Reynolds number about 2e4 (Table 2 gives 2.0e4 for the flying-fish row), measured on models with SL about 200 mm; 150-500 mm is the quoted adult size range.',
    'PC', 'high', 'u = 12 m/s; Re ~ 2e4; SL ~ 200 mm', 'the standard lengths (SL) of the present models are about 200mm', 'PC', 'measured'))
A(F('Caveat on the polar: the models were dead fish, stuffed within a day, with fins spread and fixed, a thin nylon cloth glued on the upper fin surface, and the dihedral angle of three models deliberately set to 22, 12 and 7 degrees; model mass and wind-tunnel lift agreed well for two of three models (about 30 percent off for model L2), so the shapes did not shrink much.',
    'PC', 'high', 'dihedral 22/12/7 deg', 'Five fish of similar sizes were selected and stuffed in the appropriate gliding positions', 'PC', 'measured'))
A(F('Induced drag from strong wing-tip vortices is judged one of the dominant drag components at this Reynolds number (an inference from flow visualisation and from aircraft practice, not a measured drag split).',
    'PC', 'medium', '', 'induced drag is one of the dominant drag', 'PC', 'derived'))
A(F('Ground effect: flying close to water cut drag by up to 14 percent (at height/half-span 0.33) and by 9 percent over a solid surface (at 0.21) for the full model; the body alone gave 7 and 4 percent. The authors note the tunnel water surface did not move with the airflow, so the true gain should be larger.',
    'PC', 'high', '14% (water, r=0.33); 9% (solid, r=0.21)', 'maximum reduction of the drag by 14% was obtained at', 'PC', 'measured'))
A(F('The paper itself says the reason flying fish fly is still unclear: escape from underwater predators or saving transport cost are the two suggestions it lists.',
    'PC', 'high', '', 'the exact reason is still not clear', 'PC', 'contested'))

# ---------------- CFD ----------------
A(F('CFD on a flying-fish model built to mimic the Park and Choi pectoral fins gives maximum lift coefficient 1.03 and maximum lift-to-drag 4.7 (against 0.78 and 4.37 measured). My arithmetic: 4.7/4.37 = 1.075 and 1.03/0.78 = 1.32, so CFD is 7 percent higher on L/D and 32 percent higher on CLmax. The Deng fins are flat 1 mm plates and model A has no pelvic fins, so it is not the same body as the stuffed fish.',
    'DENG', 'high', 'CLmax 1.03; L/D 4.7', 'The maximum lift force coefficient of 1.03 is reached at the angle of attack', 'DENG', 'derived'))
A(F('The 3-degree-of-freedom trajectory model fixes the take-off speed at 20 m/s for all runs. This is an input assumption, not a result.',
    'DENG', 'high', 'v0 = 20 m/s (assumed)', 'The take-off speed is fixed at 20 m', 'DENG', 'assumed'))
A(F('The two headline numbers in the Deng abstract come from different runs: 45.4 m (endurance 3.5 s) is the best distance with initial angle of attack 0 degrees; the 13.2 m apex is reached in the run with initial angle of attack 10 degrees, whose best distance is 41.5 m. The abstract states them together as "a distance up to 45.4 m, and reach a height of 13.2 m".',
    'DENG', 'high', '45.4 m (alpha0=0); 41.5 m and 13.2 m (alpha0=10)', 'distance and its endurance are 41.5 m and 3.47 s', 'DENG', 'measured+derived'))
A(F('Deng computes the aerodynamic coefficients at 10 m/s (Re = 2.6e4) but launches the trajectory at 20 m/s; the authors call their model a preliminary approximation and say a free-flight model would be more suitable.',
    'DENG', 'high', 'coeffs at 10 m/s; launch 20 m/s', 'Clearly, a fixed velocity of 10 m s', 'DENG', 'contested'))
A(F('With launch at 20 m/s the energy height v0^2/2g is 20.4 m; the loose bound 4.7 x 20.4 = 95.8 m is about twice the 45.4 m simulated (ratio 0.47), and the 13.2 m apex is 0.65 of the energy height. So Deng\'s trajectories do not violate an energy-height range bound; they sit inside it by a factor of about two.',
    'CALC', 'medium', 'bound 95.8 m; ratios 0.47 and 0.65', '', None, 'derived'))
A(F('Deng cites Hertel for a four-winged fish of 0.38 kg that could reach 48 m given 20 m/s free flight and 10 m/s head wind, and a maximum recorded flight height of 8 m; and Kawachi, Inada and Azuma for a model of a 0.226 kg fish with maximum lift-to-drag around 15.7 giving a maximum distance of 80 m. I could read neither original.',
    'DENG', 'medium', '48 m; 8 m; 80 m at L/D 15.7', 'They reported a maximum distance of 80 m', 'DENG', 'reported-second-hand'))
A(F('Kawachi\'s assumed maximum L/D of 15.7 is 3.6 times the measured 4.37 and 3.3 times Deng\'s CFD 4.7 (my arithmetic). Whether the real fish\'s lift-to-drag is nearer 4.4 or far higher is therefore a live disagreement between a 1993 analytical model and the 2010 and 2019 data; the wind-tunnel models were dead and fixed, so neither side is a live-fish measurement.',
    'CALC', 'medium', '15.7/4.37 = 3.59; 15.7/4.7 = 3.34', '', None, 'contested'))

# ---------------- field and take-off ----------------
A(F('Makiguchi and colleagues put miniature 3-axis accelerometers on Cypselurus heterurus doederleini in a controlled aquarium and estimated leap speeds of 3.9 to 5.2 m/s, which they say is 38.7 to 51.5 percent of earlier reported maximum swimming speeds.',
    'MAK', 'high', '3.9-5.2 m/s; 38.7-51.5%', 'leap from the water surface at speeds of 3.9 to 5.2 m s', 'MAK', 'measured'))
A(F('The leap speed is not measured directly: it is predicted from stroke-cycle frequency by a swimming-speed relationship (3.87 to 5.15 m/s), and the authors speculate that the fish were not performing maximally because the aquarium was small.',
    'MAK', 'high', '3.87-5.15 m/s (predicted)', 'maximum swimming speed would have been predicted to reach 3.87 to 5.15 m s', 'MAK', 'derived'))
A(F('Typical field numbers are quoted second-hand in Makiguchi: leap speed about 10 m/s, glides up to 50 m, air speed 15-20 m/s, from older stroboscopic film work; the primary film papers (Edgerton and Breder 1941; Davenport 1990) were not read by me.',
    'MAK', 'medium', '10 m/s; 50 m; 15-20 m/s', 'flying fish leap from the water surface at a speed of about 10 m s', 'MAK', 'reported-second-hand'))
A(F('Park and Choi quote glides totalling as much as 400 m in 30 s through repeated taxiing, with maximum flight speed 10-20 m/s (Hertel; Fish; Davenport).',
    'PC', 'medium', '400 m in 30 s; 10-20 m/s', 'The flying fish glides over a total distance of as much as 400m in 30s', 'PC', 'reported-second-hand'))
A(F('Davenport\'s review describes the flight sequence: swim to the surface at very high speed (under 30 body lengths per second) with fins furled, leap at a shallow angle, accelerate by taxiing with the tail beating at up to 50 beats per second, then free flight that may be prolonged by more taxiing.',
    'DAV94', 'high', 'up to 50 tail beats/s; <30 BL/s', 'accelerate to take-off speed by taxiing with the lateral fins expanded and the tail beating in the water at up to 50 beats', 'DAV94', 'reported-second-hand'))
A(F('Davenport judges flying fish "probably fly mainly to escape from predators, particularly dolphin-fishes (Coryphaena hippurus) and ommastrephid squid" and explicitly rejects the energy-conservation alternative; Park and Choi list both as unresolved.',
    'DAV94', 'high', '', 'Flying fish probably fly mainly to escape from predators, particularly dolphin-fishes', 'DAV94', 'contested'))
A(F('Davenport: for a 0.3 m standard-length fish, significant drag reduction by ground effect occurs below about 0.5 m height; fish start to show flight at about 50 mm length; and flight is unlikely below 20-23 C water because of muscle limits.',
    'DAV94', 'high', '0.5 m; 50 mm; 20-23 C', 'For a flying fish of 0.3 m standard length, significant reduction of drag by ground effect will take place at heights below about 0.5 m', 'DAV94', 'reported-second-hand'))
A(F('Davenport on pelvic fins in four-winged species: they act as stabilising tailplane, with area 20-35 percent of total lateral fin area, not as extra lifting area. Park and Choi (wind tunnel) found the pelvic fins do add lift; both can hold at once (the Saro-Cortes robot paper finds a lift-stability trade-off).',
    'DAV94', 'high', '20-35% of lateral fin area', 'The expanded, flat pelvic fins of four-wingers have evolved, not to increase wing area, but to function as', 'DAV94', 'contested'))

# ---------------- scaling ----------------
A(F('Davenport 1992 (Exocoetus obtusirostris): body mass exponent 2.981 and lateral fin area exponent 1.834 against standard length; wing loading rises with exponent 1.236; pectoral fin length cannot exceed 78-79 percent of standard length.',
    'DAV92', 'high', 'b_mass 2.981; b_area 1.834; b_loading 1.236; fin <= 78-79% SL', 'wing-loading rises in positive allometric fashion with standard length', 'X:10.1017/s0025315400048761', 'reported-second-hand'))
A(F('Internal check: mass exponent minus area exponent is 2.981 - 1.834 = 1.147, not the reported 1.236. The abstract does not say how the 1.236 was fitted (probably a direct regression on specimen loadings); I could not read the tables to resolve the 0.089 gap.',
    'CALC', 'medium', '1.147 vs 1.236', '', None, 'contested'))
A(F('Davenport 2003: pectoral leading edge fixed at 24 percent of standard length from the snout, wing length cannot exceed 76 percent of SL, heavier fish need faster flight and better L/D, so larger fish have their centre of mass further behind the centre of wing pressure; this limits the size of two-winged species and the pelvic fins of four-winged species act as stabilising tailplane.',
    'DAV03', 'high', '24% SL; 76% SL', 'the leading edge of the pectoral fin', 'X:10.1046/j.1095-8649.2003.00041.x', 'reported-second-hand'))
A(F('Davenport 2003 also argues the traditional model of flight evolution (by extension of ballistic leaps) is flawed and proposes lift-supported surface taxiing in halfbeaks with enlarged pectoral fins as an essential preliminary.',
    'DAV03', 'high', '', 'the accepted model of evolution of flight in flying fishes (by extension of ballistic leaps) is flawed', 'X:10.1046/j.1095-8649.2003.00041.x', 'contested'))
A(F('Davenport 1992: the flightless flying halfbeak Oxyporhamphus micropterus cannot fly mainly because its centre of gravity is so far behind the pectoral fins that stalling on take-off would be inevitable; and acceleration to take-off speed "probably" needs anaerobic white muscle.',
    'DAV92', 'high', '', 'acceleration to take-off speed in flying fish requires use of anaerobic white muscles', 'X:10.1017/s0025315400048761', 'reported-second-hand'))
A(F('Fish 1990 (six genera): fin area and span rise with body mass, the pectoral share of wing area and the hypocaudal-lobe share of caudal area stay constant, and the flight is a high-speed glide with a relatively flat trajectory. The abstract gives no numbers.',
    'FISH90', 'medium', '', 'The flight performance of flying fish is a high', 'X:10.1111/j.1469-7998.1990.tb04009.x', 'reported-second-hand'))

# ---------------- taxiing ----------------
A(F('CFD preprint (not peer reviewed in the record I have): a 0.25 m, 0.191 kg fish needs 350 W to swim underwater at 10 m/s but only 36 W to taxi at 10 m/s; with 350 W of flapping power it reaches 16.5 m/s. The ratio is 350/36 = 9.7 (my arithmetic).',
    'TAXI', 'medium', '36 W vs 350 W; 16.5 m/s at 350 W', 'the minimum power required for a stead-state locomotion at 10 m s', 'X:10.1101/765560', 'derived'))
A(F('A 2026 CFD study of a four-winged fish finds that during free-surface taxiing the caudal fin yields thrust (mean coefficient about 1.22) where deep-water swimming gives -3.79, that the caudal fin supplies over 60 percent of lift while taxiing, and that the pectoral fins supply 85 percent of lift in aerial glide; whole-body lift coefficient is about 2.15 taxiing against 0.57 gliding.',
    'CHENHU', 'medium', 'CT 1.22 vs -3.79; CL 2.15 vs 0.57', 'the caudal fin yields substantial thrust', 'X:10.1063/5.0347662', 'derived'))
A(F('Taxiing power per kilogram from the CFD preprint is 36/0.191 = 188 W/kg; the registry aerobic ceiling E3 v2 is 0.0833/0.06 = 1.39 W/kg; the ratio is 136 (my arithmetic). If the CFD is right, taxiing cannot be aerobic, which agrees with Davenport\'s anaerobic white-muscle suggestion and with the registry 1.7.0 rescoping of E3 (burst effort on white-muscle stores is out of scope).',
    'CALC', 'low', '188 vs 1.39 W/kg', '', None, 'derived'))
A(F('Mass-scaling caveat on the ratio above: the CFD fish (0.191 kg) and the registry reference fish (0.06 kg) differ by a factor of 3.2; I compared per kilogram, which assumes power scales linearly with mass.',
    'CALC', 'low', '', '', None, 'assumed'))

# ---------------- genetics, phylogeny, fossils ----------------
A(F('Daane 2021 sequenced targeted regions (over 300,000 loci) pooled from 35 beloniform species and measured fin length against standard length across the clade; the pectoral fin allometry was identical across two- and four-winged flying fishes, and the two gliding halfbeak genera are intermediate.',
    'DAANE', 'high', '35 species; >300,000 loci', 'The allometric relationship between body size and pectoral fin length was identical across the two- and four-wing flying fishes', 'DAANE', 'measured'))
A(F('Convergent evolution: 44 amino-acid substitutions present only within all three gliding lineages, against 14-28 in control comparisons; accelerated sequence evolution in gliding branches for fin development, semicircular canal, vestibular, muscle-hypertrophy and fear-circuit gene groups.',
    'DAANE', 'high', '44 vs 14-28', 'Compared with 14', 'DAANE', 'measured'))
A(F('Zebrafish genetics: the dominant mutation nr21 is a T200K change in the amino-acid transporter lat4a (small fins; gain of function), and the classic longfin mutant is an inversion that raises kcnh2a expression in the fin; combining alleles in zebrafish closely phenocopies flying-fish fin proportions.',
    'DAANE', 'high', 'lat4a T200K; kcnh2a up-regulation', 'interaction between these genetic loci in zebrafish closely phenocopies the observed fin proportions of flying fishes', 'DAANE', 'measured'))
A(F('Caveat: lat4a and kcnh2a are candidate regulators supported by convergence signals plus zebrafish phenocopy; no flying-fish gene was edited and the paper reports no flying-fish functional test. This is an inference, and the grounded part is the zebrafish result.',
    'DAANE', 'medium', '', '', None, 'contested'))
A(F('Independent confirmation that kcnh2a controls fin size: in the longfin zebrafish, ectopic kcnh2a expression acts autonomously in the fin intra-ray mesenchyme and tunes the outgrowth period rather than positional information.',
    'LOF', 'high', '', 'ion signaling within the growth-determining mesenchyme lineage controls fin size by tuning outgrowth periods', 'X:10.1242/dev.199384', 'measured'))
A(F('Phylogeny: a cytochrome b and RAG2 tree supports the progressive transition from two-wing to four-wing gliding, and shows the largest genus Cheilopogon is not monophyletic.',
    'LEW', 'high', 'cytb 1137 bp; RAG2 882 bp', 'The results support the progressive transition from two', 'LEWEPMC', 'measured'))
A(F('Species count disagrees across sources: Xu 2013 says "some 50 species of extant flying fishes" and a 2026 cytogenetics paper says four subfamilies, seven genera and 80 species (citing Fricke et al.). Counting depends on the taxonomy used; I did not resolve it.',
    'XU13', 'medium', '~50 vs 80', 'Some 50 species of extant flying fishes are classified in the Exocoetidae', 'X:10.1098/rspb.2012.2261', 'contested', extra_source=URL['CYT']))
A(F('Fossils: the Triassic thoracopterids convergently evolved over-water gliding; the earliest evidence reported in 2013 was Middle Triassic of China, and Wushaichthys and Peripeltopleurus (Ladinian, 235-242 Ma) are described as the oldest and most primitive thoracopterids, with a gradual four-stage sequence cranial specialisation, asymmetrical caudal fin, enlarged paired fins, scale reduction.',
    'XU15', 'high', 'Ladinian 235-242 Ma', 'the evolution of overwater gliding of thoracopterids was gradual in nature', 'X:10.1098/rsbl.2014.0960', 'measured'))
A(F('Extant Exocoetidae have a fossil record no older than the Eocene (Xu 2013), so Triassic and modern flying fish are convergent, not ancestral.',
    'XU13', 'high', 'Eocene', 'which have a fossil record no older than the Eocene', 'X:10.1098/rspb.2012.2261', 'measured'))
A(F('A 2026 cytogenetic study of three Atlantic species reports all share 2n = 48 chromosomes, with structural karyotype divergence between populations, genera and congeners.',
    'CYT', 'medium', '2n = 48', 'All the flying fish species and populations analyzed share 2n = 48 chromosomes', 'CYT', 'measured'))

# ---------------- robots ----------------
A(F('Robot flying fish studies: Saro-Cortes 2022 ran a modular robot model in a wind tunnel at Reynolds number 30,000 and found a trade-off between lift and pitch stability for the pelvic fins; Chen 2023 built a robot that exits water at 1.55 m/s (5.9 body lengths/s) in 0.233 s and a reinforcement-learning fin-morphing controller that lengthened simulated glide by 7.2 percent.',
    'SARO', 'high', 'Re 30,000; 1.55 m/s; +7.2%', 'there is a clear a trade-off between stability and lift generation', 'X:10.1093/icb/icac101', 'measured', extra_source=URL['CHEN23']))

# ---------------- energy / framework ----------------
A(F('Stall floor: with the Park and Choi L3 numbers (mass 0.06 kg, reference area 0.012688 m2 from the project\'s reading of Table 1, CLmax 0.78, air density 1.225) v_min = sqrt(2W/(rho S CLmax)) = 9.85 m/s. A lift-equals-weight glide cannot go slower; with Deng\'s CLmax 1.03 it is 8.58 m/s.',
    'CALC', 'medium', '9.85 m/s (8.58 with CLmax 1.03)', '', None, 'derived'))
A(F('Energy-height range bound, level lifting glide: x <= (L/D) (v0^2 - v_min^2)/(2g) / (1 - delta). For 50 m with L/D 4.37 the launch airspeed must be at least 17.9 m/s (no ground effect) or 17.0 m/s (14 percent drag cut). At 15 m/s the bound is 28.5 m, at 20 m/s it is 67.5 m (no ground effect).',
    'CALC', 'medium', '17.9 / 17.0 m/s; 28.5 m; 67.5 m', '', None, 'derived'))
A(F('Scope of that bound: it is a theorem only while lift equals weight. A lofted ballistic arc has unloaded wings, and at 10 m/s the parasitic drag (about 0.043 N with CDmin 0.055) is 14 times smaller than the weight (0.589 N), a ratio above 4.37; so field flights with a ballistic phase can legitimately beat it, and the bound is a modelling claim for them.',
    'CALC', 'medium', 'weight/drag = 13.8 at 10 m/s', '', None, 'assumed'))
A(F('The earlier (prior-agent) pure-glide certificate eliminate 50 m from 8 m at L/D 4.37 treats the 8 m height as the only energy; it is a compiled certificate (elim_pure_glide_field_distance_C15 in lean/Delphi/Certificates/Eliminations.lean, read not built by me). Once launch kinetic energy is counted (20 m/s launch gives 67.5 m of bound) the 50 m field glide is not eliminated, so that certificate removes a candidate that the physics does not forbid.',
    'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Certificates/Eliminations.lean', 'medium', '8 x 4.37 = 35.0 m < 50 m', '', None, 'derived'))
A(F('Powered aerobic level flight at L/D 4.37 needs W v / (L/D) = 1.33 W at 9.85 m/s (2.02 W at 15 m/s) for the 0.06 kg reference fish, 16 times (24 times) the registry E3 v2 aerobic ceiling of 0.0833 W; so a sustained powered flight is ruled out and flight must be unpowered or burst-powered, as the project\'s earlier 16x figure also says.',
    'CALC', 'medium', '1.33 W; 16x; 24x at 15 m/s', '', None, 'derived'))
A(F('Provenance check on the E3 v2 input: Palstra 2010 reports maximal oxygen consumption at Ucrit of 82.18 +/- 6.50 micromol O2 per g per hour for zebrafish; times 31.998 g/mol this is 2629.6 mg O2 per kg per hour, matching the 2630 quoted in the registry changelog. The fish measured were about 3 cm and 0.43 g, so using them to bound a 60 g flying fish is an extrapolation across body size and clade.',
    'PAL', 'high', '82.18 umol/g/h = 2629.6 mg/kg/h', 'a maximal oxygen consumption at Ucrit of 82.18', 'PAL', 'derived'))
A(F('Registry state read from the application repo changelog: law set 1.7.0 rescoped E3 and fick-principle so they no longer fire on unpowered glide, 1.8.0 narrowed five scopes for a third wild-type false positive and moved C14 to aerobic-power-bound, and 1.8.1 retired a loop-test law; current set is 1.8.1.',
    'REPO', 'high', 'law set 1.8.1', 'E3 2.0.0 -> 2.1.0 and fick-principle 1.1.0 -> 1.2.0, WORDING ONLY', None, 'measured'))
A(F('The application repo Constraints.lean defines vmin_rules_out, aerobic_flight_rules_out, glide_range_rules_out and climb_rules_out (grep). The earlier law-mapper reported them missing because it read the 1.6.0 upstream copy; they are present at 1.8.1. I did not compile.',
    'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Constraints.lean', 'medium', 'lines 243, 316, 324, 331', '', None, 'measured'))
A(F('Fin-ratio gap check, from the project\'s cached CSV of Daane Data S1A: pectoral/SL for 49 flying fish ranges 0.406-0.823 (median 0.687); 19 flying halfbeaks 0.175-0.388; 22 halfbeaks 0.115-0.177; 19 needlefish 0.071-0.106. The ">= 0.406 vs <= 0.389" gap holds in this file, but the flying-fish group has only three species (Cheilopogon furcatus, Exocoetus volitans, Hirundichthys rondeleti) and the CSV carries a spreadsheet float artifact (a pelvic ratio of 2.4e-16), so the gap is a three-species museum observation, not a clade law.',
    'CALC', 'medium', 'n=49/19/22/19; gap 0.406 vs 0.388', '', None, 'derived'))
A(F('Pectoral length versus standard length, log-log fit over the 49 flying-fish rows: exponent 1.058, 95 percent interval 1.017-1.099, r2 0.983 (my recomputation, matches the registry). An exponent above 1 means pectoral fins grow slightly faster than the body, i.e. positive allometry.',
    'CALC', 'medium', 'b = 1.058 [1.017, 1.099]; r2 = 0.983', '', None, 'derived'))

# ---------------- state of review literature ----------------
A(F('The 2023 Biology Open review of gliding locomotion (covering 2022 work) concludes gliding is a sophisticated behaviour resulting from interdependent morphology, sensing, environment and selective pressure; it says new techniques should make it possible to study flying fish gliding in open water, which it calls understudied (the paucity of studies).',
    'BIOL', 'high', '', 'addressing the paucity of studies in each system', 'BIOL', 'contested'))
