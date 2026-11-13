# Builds D:/Users/ashenoy00000/delphi-work/agents2/t2-patterns-deep.json. Run: python -X utf8 build.py  (after crossref_check*.py, epmc_fetch.py, abstracts.py, calc.py)
import json, re, sys
sys.path.insert(0, r'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep')
from build_part1 import findings, SRC, U

OUT = r'D:/Users/ashenoy00000/delphi-work/agents2/t2-patterns-deep.json'
CALC = json.load(open(r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/calc_out.json'))


def norm(s):
    return re.sub(r'\s+', '', s)


for f in findings:  # machine check: every quote must be in its source text
    if f['evidence_quote']:
        assert norm(f['evidence_quote']) in norm(SRC[f['_k']]), f['evidence_quote']
    f.pop('_k')

summary = """STATE OF THE ART, Track 2 (chemotactic range-expansion front of E. coli in soft agar). Each step is tagged MEASURED (seen in an experiment I read), DERIVED (follows by mathematics from stated assumptions) or ASSUMED.

1. What the system is. [MEASURED] Motile E. coli placed at the centre of a 0.25 percent agar plate with a plentiful carbon source and a little amino-acid attractant (aspartate or serine, 100 uM) grow, and a visible ring moves outward at a steady speed. Classic papers saw this: Adler 1966 (bands made by cells that create their own gradient), Wolfe and Berg 1989 (soft agar also lets non-chemotactic, tumbling cells swarm), Croze 2011 (speed is weakly dependent on agar below 0.25 percent and drops sharply above).
2. The baseline with no steering. [DERIVED] A population that only grows and diffuses advances as a Fisher-KPP wave at c_F = 2 sqrt(D r), D the cell diffusivity, r the growth rate (Fisher 1937; Aronson-Weinberger 1978 is the rigorous source cited by the law library). [MEASURED] Non-chemotactic E. coli follow this wave with no adjustable parameters (Cremer 2019). [ASSUMED] In the law library the diffusivity is taken from run-and-tumble motion: D about 50 um^2/s in agar.
3. Why chemotaxis speeds it up. [MEASURED] Cells eat the attractant, which makes a gradient that points outward; cells at the front drift up it ('pioneers'), cells behind mostly grow ('settlers'). With an abundant carbon source plus 100 uM attractant the front moved about 3 to 4.3 mm/h in minimal media (source data, own table below). [MEASURED, own arithmetic] That is 4.4 to 5.4 times the Fisher speed computed with D = 50.2 um^2/s and the measured growth rate for the six wild-type carbon sources.
4. The model. [ASSUMED] Growth-Expansion (GE) model: logistic growth plus diffusion plus drift velocity chi0 grad(a)/(a + a_m), with attractant consumed by Michaelis-Menten uptake. It is the Keller-Segel (1971) model plus growth, the 'Patlak-Keller-Segel with growth' family. Keller-Segel alone needs a_m = 0 to be stable (Narla 2021).
5. Closed form. [DERIVED] Narla, Cremer, Hwa 2021: c = (chi0 - D) sqrt( r (a0/a_m) / (chi0 - D + D_a) ), valid when a0/a_m >> 1 + D_a/(chi0 - D). So c grows as sqrt(r) and sqrt(a0/a_m), does not depend on the uptake rate, and equals more than the Fisher speed; the Fisher speed is the lower bound. The derivation is a heuristic ansatz checked against numerical solutions, not a theorem.
6. How well it fits. [MEASURED + own calc] With Cremer's published parameters (chi0 = 315, D = 50.2, D_a = 800 um^2/s, a0/a_m = 100) the closed form is 7 to 32 percent above the six wild-type speeds (ratios 1.07 to 1.32). A single-coefficient square-root law u^2 = k r fitted on those six rows (k = 16.9 mm^2/h) misses titrated-uptake strains by 10 to 64 percent. Inside an uptake-titration series the log-log slope of u on r is 1.12 (0.89 without the zero-inducer point), not 0.5, so the sqrt(r) law is a statement about varying r with other parameters fixed; Cremer 2019 says the observed trend needs growth-rate-dependent parameters in the full model.
7. Dependence on attractant. [MEASURED] Speed rises with attractant concentration then falls: on glucose it peaks at 1000 uM (4.65 mm/h) and drops to 2.10 mm/h at 10 mM; on glycerol it peaks at 100 uM (3.67) and drops to 1.32 at 10 mM. The log-log slope over 10 to 100 uM is 0.30 (glucose) and 0.28 (glycerol), not 0.5. [DERIVED] The sqrt(a0) law cannot make a peak by itself. A peak needs an extra ingredient: the published simulation parameter file has an upper sensing limit of 30 uM (weber_offsetmax_1, read from the file), and Narla 2021 has a carrying-capacity correction (Eq 24 to 25) that I did not read myself, only through the earlier design report.
8. Contested and unsettled. (a) The Patlak-Keller-Segel form itself: Phan 2024 measured the attractant directly in a microchannel and found it fails at high cell density (consumption and chemotaxis both suppressed); the soft-agar GE model has not been tested that way. (b) Whether cell motility depends on growth rate: Cremer found flat swimming speed and diffusion in exponential growth; Ni 2020 found motility gene expression rising linearly as growth rate falls. (c) Pushed versus pulled front: Bai 2021 argues the band is a pushed wave because drift velocities fall from back to front. (d) Cell-to-cell variability: Fu 2018, Salek 2019, Keegstra 2017 show large clonal differences yet the band holds together, which a single chi0 ignores. (e) The 1971 Keller-Segel instability and finite-time blow-up of some variants (Hillen and Painter 2009).
9. Beyond the single ring. [MEASURED] Other microbial patterns on the same medium: Budrene-Berg spots and stripes from excreted attractant (1991); stripes from engineered density-dependent motility (Liu 2011); density-dependent motility with logistic growth gives spots without chemotaxis (Cates 2010); sectors from genetic drift at the edge (Hallatschek 2007). [DERIVED] The Turing law in the library (linear instability of a stationary mode) does not describe the travelling front.
10. Evolutionary reading. [MEASURED] Liu 2019: after 50 cycles (about 600 generations) the optimal expansion speed depends on habitat size, with a stable strategy of speed = growth rate x habitat size.
11. Law library (set 1.8.1, 2026-11-01). Only fisher-kpp-speed 1.1.0 (candidate, non-binding; constraint KPP1: c^2 >= 4 s D) and turing-ddi 1.1.0 (candidate) are pinned; turing-wavelength 1.1.0 is a candidate not yet pinned. The earlier law-mapper looked at 1.6.0 and found only the Turing law. There is no law for Keller-Segel or chemotactic fronts. Over the 23 aspartate/serine rows of the source data, speed over Fisher speed is between 2.49 and 7.09, so KPP1 holds in every row (own calculation, Fisher speed computed with the single D = 50.2 um^2/s for every strain, which is an approximation for the engineered strains).
OPEN PROBLEMS. (i) A direct measurement of the attractant field and density in agar to test whether the PKS closure holds at the colony density, as Phan did in a channel. (ii) A reconciled growth-rate story: how chi0, D and uptake change with r, and whether the 0.5 exponent or about 1 is right across a titration. (iii) Unifying the sensing-limit ceiling (Cremer code, 30 uM upper limit in my reading of the published parameter file) with the closed form. (iv) Prediction in new conditions (mixtures of attractants, other strains, other gel stiffnesses) from single-cell parameters alone. (v) 2D and 3D front stability, finite-time blow-up and cell-density effects beyond the 1D wave. (vi) A Lean statement that fits the actual claim: only the arithmetic of c^2 >= 4 s D is proved; the chemotactic closed form is not."""

lay = ("Imagine dropping bacteria in the middle of a dish of soft jelly with food. As they eat, they use up a little amino acid, which leaves a slope of less amino acid near them; the bacteria then swim up that slope, so a ring of cells races outward. "
       "Plain spreading by growing and wandering would move that ring only about one millimetre an hour, but the measured ring moves three to four and a half millimetres an hour. "
       "A short equation from the 1970s was improved in 2019 and 2021 to explain this, and it says the speed grows with the square root of how fast the cells divide. "
       "That rule fits roughly but not exactly, and a 2024 study shows the old equation fails when cells are very crowded. "
       "So the main picture is well supported, but the exact rule for how fast the ring moves is still being argued about.")

glossary = [
    dict(term='chemotaxis', plain='Swimming up (or down) a chemical slope by changing how often the cell tumbles.'),
    dict(term='attractant', plain='A chemical, such as an amino acid, that cells swim towards.'),
    dict(term='soft agar', plain='A very watery jelly (0.25 percent agar) that cells can swim through.'),
    dict(term='range expansion', plain='A population spreading into empty territory.'),
    dict(term='front / band / ring', plain='The moving edge of the population, seen as a ring on a plate.'),
    dict(term='growth rate (r)', plain='How fast the cells multiply, in doublings-per-time units (here per hour).'),
    dict(term='diffusivity (D)', plain='How quickly random motion spreads cells out, in square micrometres per second.'),
    dict(term='Fisher-KPP wave', plain='The speed of a front driven only by growth plus random spreading: 2 times the square root of D times r.'),
    dict(term='Keller-Segel model', plain='Equations that describe cells following a chemical slope that they themselves make.'),
    dict(term='Growth-Expansion (GE) model', plain='The Keller-Segel model plus cell growth, used by Cremer and Narla.'),
    dict(term='travelling wave', plain='A shape that moves at constant speed without changing form.'),
    dict(term='chi0 (chemotactic coefficient)', plain='How strongly the slope of attractant pushes cells.'),
    dict(term='a_m', plain='The attractant level below which cells hardly sense a slope, about 1 micromolar for aspartate.'),
    dict(term='pioneers and settlers', plain='Cells at the front that move forward, and cells behind that stay and grow.'),
    dict(term='Turing pattern', plain='A stationary spotty or stripy pattern that arises from two spreading chemicals; different from the travelling ring.'),
    dict(term='pushed versus pulled front', plain='A pulled front is led by the few cells at its tip; a pushed one is driven by the bulk behind.'),
    dict(term='Lean law, candidate', plain='A formally checked statement in the project library that is listed but not yet binding.'),
    dict(term='OD600', plain='Cloudiness of a culture at 600 nanometres, used as a stand-in for cell density.'),
]

T = lambda name, fields, source: dict(name=name, fields=fields, source=source)
SRC_M11 = 'https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-019-1733-y/MediaObjects/41586_2019_1733_MOESM11_ESM.xlsx'
SRC_M22 = 'https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-019-1733-y/MediaObjects/41586_2019_1733_MOESM22_ESM.xlsx'
SRC_M3 = 'https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-019-1733-y/MediaObjects/41586_2019_1733_MOESM3_ESM.txt'
table = [
    T('WT HE206, 60 mM acetate, 100 uM Asp, 0.25% agar', 'speed_mm_per_h=2.959; growth_rate_per_h=0.542; n_speed=2; fisher_cF_mm_per_h=0.626 (own calc, D=50.2 um2/s); u_over_cF=4.73', SRC_M11),
    T('WT HE206, 20 mM glucose-6-phosphate, 100 uM Asp', 'speed_mm_per_h=3.926; growth_rate_per_h=1.1253; n_speed=2; fisher_cF=0.902; u_over_cF=4.35', SRC_M11),
    T('WT HE206, 20 mM galactose, 100 uM Asp', 'speed_mm_per_h=3.768; growth_rate_per_h=0.686; n_speed=2; fisher_cF=0.704; u_over_cF=5.35', SRC_M11),
    T('WT HE206, 20 mM glucose, 100 uM Asp', 'speed_mm_per_h=4.335; sd=0.442; n=5; growth_rate_per_h=0.9985; fisher_cF=0.850; u_over_cF=5.10; narla_eq21_pred_mm_per_h=4.87 (ratio 1.12)', SRC_M11),
    T('WT HE206, 40 mM glycerol, 100 uM Asp', 'speed_mm_per_h=3.675; sd=0.318; n=9; growth_rate_per_h=0.7735; fisher_cF=0.748; u_over_cF=4.91; narla_eq21_pred=4.28 (ratio 1.17)', SRC_M11),
    T('WT HE206, 11 mM mannose, 100 uM Asp', 'speed_mm_per_h=3.034; sd=0.182; n=3; growth_rate_per_h=0.5152; fisher_cF=0.610; u_over_cF=4.97; narla_eq21_pred=3.49 (ratio 1.15)', SRC_M11),
    T('Pu-glpFK uptake titration on glycerol + 100 uM Asp (0, 10, 25, 50, 800 uM inducer)', 'speed_mm_per_h=0.999,2.009,2.362,2.769,4.171; growth_rate_per_h=0.222,0.3275,0.4198,0.5273,0.7382; loglog_slope_all=1.12; loglog_slope_without_zero_inducer=0.89 (own calc)', SRC_M11),
    T('Held-out strains vs fitted u=sqrt(k r), k=16.90 mm2/h', 'Pu-ptsG1 +11%,+15%; Pu-ptsG2 +64%,+34%,+10%; glpK22 -17% (own calc; predicted minus measured over measured)', SRC_M11),
    T('Same growth rate, different speed', 'glpK22 glycerol r=0.9956/h u=4.95 mm/h vs WT glucose r=0.9985/h u=4.33 mm/h; speed_ratio=1.14 (own calc)', SRC_M11),
    T('Serine as attractant, WT, 100 uM', 'glucose u=4.922 mm/h (r=0.917/h); glycerol u=4.203 mm/h (r=0.7695/h); both 1.14 x the aspartate speed (own calc)', SRC_M11),
    T('Casamino acids (0.05 as listed), WT', 'glycerol+cAA u=7.632 mm/h r=1.397/h; glucose+cAA u=7.358 mm/h r=1.505/h; u_over_cF=7.59,7.05 (own calc)', SRC_M11),
    T('Aspartate dose series, WT on 20 mM glucose (10..10000 uM)', 'speed_mm_per_h=2.204,3.040,3.711,4.335,4.519,4.615,4.650,3.379,2.728,2.104 at 10,30,50,100,300,500,1000,3000,5000,10000 uM; peak=1000 uM; slope_10_to_100uM=0.30', SRC_M22),
    T('Aspartate dose series, WT on 40 mM glycerol', 'speed_mm_per_h=1.919,2.582,2.995,3.675,3.208,2.856,2.776,2.572,1.771,1.537,1.317 at 10,30,50,100,200,300,500,1000,3000,5000,10000 uM; peak=100 uM; slope_10_to_100uM=0.28', SRC_M22),
    T('Cremer 2019 published simulation parameters (mainsimulation block)', 'D_chemotaxis_1=50.2e-12 m2/s (=50.2 um2/s=0.1807 mm2/h); D_nutrients=8.0e-10 m2/s (=800 um2/s=2.88 mm2/h); xhi_1=0.315e-9 m2/s (=315 um2/s); weber_offset_1=0.001 mM (=1 uM); weber_offsetmax_1=0.03 mM (=30 uM); lambda_1=0.00019166 /s (=0.69 /h)', SRC_M3),
    T('Narla 2021 closed form, validity', 'validity_threshold_a0_over_am >> 1+Da/(chi0-D) = 4.02 with the published parameters; a0/am=100 for 100 uM aspartate (own calc)', 'https://doi.org/10.1073/pnas.2105138118'),
    T('Narla 2021 parameter ranges', 'D_rho_agar~50 um2/s; D_rho_liquid=300-1000 um2/s; phi=(chi0-D_rho)/D_rho=2-8; a_m~a_k~1 uM (aspartate)', 'https://doi.org/10.1073/pnas.2105138118'),
    T('Cremer 2019 reference confocal run', 'front_speed~3.2 mm/h (glycerol+aspartate); source-data table says 3.675 mm/h', 'https://doi.org/10.1038/s41586-019-1733-y'),
    T('Liu 2019 experimental evolution', 'ancestor_speed~6 mm/h (0.25% TB agar); cycles=50 (~600 generations); neutral selection radius=15 mm; seeded cells per transfer~7.4e6; two-strain simulation c_slow=652 um2/s u=4.95 mm/h, c_fast=727 um2/s u=5.17 mm/h', 'https://doi.org/10.1038/s41586-019-1734-x'),
    T('Phan 2024 low-density fit (microchannel)', 'peak_OD=0.6; growth_rate=0.38+/-0.02 /h; gamma=0.51+/-0.05; A_h=7.6+/-3.7 uM; D_B=400+/-100; chi=3300+/-230; wave_speed=4.4+/-0.1 (um/s, symbol printed as uM; =15.8 mm/h)', 'https://doi.org/10.1073/pnas.2309251121'),
    T('Law fisher-kpp-speed 1.1.0 (candidate, lawset 1.8.1)', 'statement=c^2>=4*s*D bound (KPP1); inputs=spread_speed, selection_coefficient, dispersal_D; consistency_over_23_rows=min 2.49, max 7.09 for u/cF', 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/fisher-kpp-speed.json'),
    T('Law turing-ddi 1.1.0 (candidate, lawset 1.8.1)', 'statement=two-species linear instability needs unequal diffusivities; not applicable to travelling chemotactic front', 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/turing-ddi.json'),
]

# citations (every DOI resolved on Crossref in this run, title matched; depth says how much was read)
C = lambda au, yr, ti, doi, how, use, ven='': dict(authors=au, year=yr, title=ti, doi_or_arxiv=doi, verified=True, how_verified=how, used_for=use, venue=ven)
CR = 'Crossref API https://api.crossref.org/works/<doi> returned this title on 2026-11-12'
citations = [
    C('Cremer J, Honda T, Tang Y, Wong-Ng J, Vergassola M, Hwa T', 2019, 'Chemotaxis as a navigation strategy to boost range expansion', '10.1038/s41586-019-1733-y', CR + '; full text read via Europe PMC PMC6883170', 'chosen system, data, GE model', 'Nature'),
    C('Narla AV, Cremer J, Hwa T', 2021, 'A traveling-wave solution for bacterial chemotaxis with growth', '10.1073/pnas.2105138118', CR + '; full text read via Europe PMC PMC8640786', 'closed-form speed law', 'PNAS'),
    C('Liu W, Cremer J, Li D, Hwa T, Liu C', 2019, 'An evolutionarily stable strategy to colonize spatially extended habitats', '10.1038/s41586-019-1734-x', CR + '; full text read via PMC6883132', 'evolution of expansion speed', 'Nature'),
    C('Phan TV, Mattingly HH, Vo L, Marvin JS, Looger LL, Emonet T', 2024, 'Direct measurement of dynamic attractant gradients reveals breakdown of the Patlak-Keller-Segel chemotaxis model', '10.1073/pnas.2309251121', CR + '; full text read via PMC10801886', 'contested PKS closure', 'PNAS'),
    C('Fu X, Kato S, Long J, Mattingly HH, He C, Vural DC, Zucker SW, Emonet T', 2018, 'Spatial self-organization resolves conflicts between individuality and collective migration', '10.1038/s41467-018-04539-4', CR + '; text read via PMC5988668 (abstract, introduction, first results)', 'heterogeneity in bands', 'Nat Commun'),
    C('Bhattacharjee T, Amchin DB, Alert R, Ott JA, Datta SS', 2022, 'Chemotactic smoothing of collective migration', '10.7554/eLife.71226', CR + '; abstract and methods read via PMC8903832', 'front stability in porous media', 'eLife'),
    C('Ni B, Colin R, Link H, Endres RG, Sourjik V', 2020, 'Growth-rate dependent resource investment in bacterial motile behavior quantitatively follows potential benefit of chemotaxis', '10.1073/pnas.1910849117', CR + ' (Crossref year 2019 online, published 2020); full text read via PMC6955288', 'growth-rate dependence of motility', 'PNAS'),
    C('Bai Y, He C, Chu P, Long J, Li X, Fu X', 2021, 'Spatial modulation of individual behaviors enables an ordered structure of diverse phenotypes during bacterial group migration', '10.7554/eLife.67316', CR + '; abstract read via PMC8563000', 'pushed wave front', 'eLife'),
    C('Salek MM, Carrara F, Fernandez V, Guasto JS, Stocker R', 2019, 'Bacterial chemotaxis in a microfluidic T-maze reveals strong phenotypic heterogeneity in chemotactic sensitivity', '10.1038/s41467-019-09521-2', CR + '; abstract read via PMC6478840', 'clonal heterogeneity', 'Nat Commun'),
    C('Keegstra JM, Kamino K, Anquez F, Lazova MD, Emonet T, Shimizu TS', 2017, 'Phenotypic diversity and temporal variability in a bacterial signaling network revealed by single-cell FRET', '10.7554/eLife.27455', CR + '; abstract read via PMC5809149', 'signalling variability', 'eLife'),
    C('Adler J', 1966, 'Chemotaxis in Bacteria', '10.1126/science.153.3737.708', CR + '; abstract read via Europe PMC', 'origin of the bands', 'Science'),
    C('Wolfe AJ, Berg HC', 1989, 'Migration of bacteria in semisolid agar', '10.1073/pnas.86.18.6973', CR + '; abstract read via Europe PMC', 'swarming in agar needs tumbling', 'PNAS'),
    C('Croze OA, Ferguson GP, Cates ME, Poon WCK', 2011, 'Migration of Chemotactic Bacteria in Soft Agar: Role of Gel Concentration', '10.1016/j.bpj.2011.06.023', CR + '; abstract read via Europe PMC', 'agar concentration dependence', 'Biophys J'),
    C('Saragosti J, Calvez V, Bournaveas N, Perthame B, Buguin A, Silberzan P', 2011, 'Directional persistence of chemotactic bacteria in a traveling concentration wave', '10.1073/pnas.1101996108', CR + '; abstract read via Europe PMC', 'single-cell behaviour in a wave', 'PNAS'),
    C('Budrene EO, Berg HC', 1991, 'Complex patterns formed by motile cells of Escherichia coli', '10.1038/349630a0', CR + '; abstract read via Europe PMC', 'spots and stripes', 'Nature'),
    C('Budrene EO, Berg HC', 1995, 'Dynamics of formation of symmetrical patterns by chemotactic bacteria', '10.1038/376049a0', CR + '; not read (metadata only)', 'companion paper, not used for a number', 'Nature'),
    C('Cates ME, Marenduzzo D, Pagonabarraga I, Tailleur J', 2010, 'Arrested phase separation in reproducing bacteria creates a generic route to pattern formation', '10.1073/pnas.1001994107', CR + '; abstract read via Europe PMC', 'pattern without chemotaxis', 'PNAS'),
    C('Liu C, Fu X, Liu L, Ren X, et al.', 2011, 'Sequential Establishment of Stripe Patterns in an Expanding Cell Population', '10.1126/science.1209042', CR + '; abstract read via Europe PMC', 'engineered stripes', 'Science'),
    C('Hallatschek O, Hersen P, Ramanathan S, Nelson DR', 2007, 'Genetic drift at expanding frontiers promotes gene segregation', '10.1073/pnas.0710150104', CR + '; abstract read via Europe PMC', 'sectoring at the edge', 'PNAS'),
    C('Mattingly HH, Kamino K, Machta BB, Emonet T', 2021, 'Escherichia coli chemotaxis is information limited', '10.1038/s41567-021-01380-3', CR + '; abstract read via Europe PMC', 'upper bound on gradient climbing', 'Nat Phys'),
    C('Hillen T, Painter KJ', 2009, "A user's guide to PDE models for chemotaxis", '10.1007/s00285-008-0201-3', 'Crossref returned title (issued 2008 online); abstract read via Europe PMC', 'review of Keller-Segel variants', 'J Math Biol'),
    C('Wadhams GH, Armitage JP', 2004, 'Making sense of it all: bacterial chemotaxis', '10.1038/nrm1524', CR + '; abstract read via Europe PMC', 'molecular review', 'Nat Rev Mol Cell Biol'),
    C('Keller EF, Segel LA', 1970, 'Initiation of slime mold aggregation viewed as an instability', '10.1016/0022-5193(70)90092-5', CR + '; not read (paywalled)', 'origin of the model family, cited via Hillen and Painter', 'J Theor Biol'),
    C('Fisher RA', 1937, 'The wave of advance of advantageous genes', '10.1111/j.1469-1809.1937.tb02153.x', CR + '; not read, cited by the law record', 'Fisher wave', 'Ann Eugenics'),
    C('Aronson DG, Weinberger HF', 1978, 'Multidimensional nonlinear diffusion arising in population genetics', '10.1016/0001-8708(78)90130-5', CR + '; not read, cited by the law record', 'rigorous spreading speed', 'Adv Math'),
]
# Keller & Segel 1971 (10.1016/0022-5193(71)90051-8) and Berg & Brown 1972 (10.1038/239500a0) resolved on Crossref but have no abstract; listed as not read
citations.append(C('Keller EF, Segel LA', 1971, 'Traveling bands of chemotactic bacteria: A theoretical analysis', '10.1016/0022-5193(71)90051-8', CR + '; not read (paywalled, no abstract)', 'the original travelling-band model; content taken from Narla 2021', 'J Theor Biol'))
citations.append(C('Berg HC, Brown DA', 1972, 'Chemotaxis in Escherichia coli analysed by Three-dimensional Tracking', '10.1038/239500a0', CR + '; not read', 'run-and-tumble background, no number used', 'Nature'))

key_claims = [
    dict(claim='Chemotaxis along a self-made gradient of a low-dose attractant, with an abundant carbon source, makes the E. coli front in soft agar faster than the Fisher-Kolmogorov front; speed rises with growth rate.',
         source=U['cremer2019'], evidence_quote='This navigated range expansion process spreads faster and yields larger population gains than unguided expansion following the canonical Fisher-Kolmogorov dynamics'),
    dict(claim='Narla 2021 gives a closed-form speed for the Growth-Expansion model: proportional to sqrt(r) and sqrt(a0/a_m), independent of uptake rate; at chi0 = 0 it is the Fisher-KPP wave.',
         source=U['narla2021'], evidence_quote='The expansion speed is further increased by the square root of the relative background attractant concentration'),
    dict(claim='The Patlak-Keller-Segel closure underneath the model is not directly verified in agar and fails at high cell density in a channel; the dependence of the front on growth rate beyond sqrt(r) is therefore the main open point.',
         source=U['phan2024'], evidence_quote='While the model agreed well with our data at low cell densities, it diverged at high cell densities.'),
    dict(claim='The law library (set 1.8.1) has no chemotactic-front law; fisher-kpp-speed (candidate, non-binding) gives only the lower bound c^2 >= 4 s D, and turing-ddi is not the right mechanism for a travelling front.',
         source=U['law_kpp'], evidence_quote='it does not establish that a travelling wave exists, that compactly supported initial data converge to it, or that any population disperses diffusively.'),
]

reproduce = [
    dict(what='Resolve DOIs and title queries on Crossref (metadata check)', command_or_url='python -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/crossref_check.py ; then crossref_check2.py (Python 3.14; may hit HTTP 429 on rapid reruns, the scripts retry)', expected='Titles match: e.g. 10.1038/s41586-019-1733-y -> Chemotaxis as a navigation strategy to boost range expansion; 10.1073/pnas.2309251121 -> Direct measurement of dynamic attractant gradients reveals breakdown of the Patlak-Keller-Segel chemotaxis model. Three DOIs I first guessed from memory (Croze, Saragosti, Brenner) were wrong and are NOT used.'),
    dict(what='Fetch full text of open-access papers via Europe PMC', command_or_url='cd D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep ; python -I epmc_fetch.py "<exact title>" <slug>  (titles in the report; slugs cremer2019, narla2021, fu2018, liu2019, phan2024, bhatt2022, ni2020, bai2021, salek2019, keegstra2017). Endpoint: https://www.ebi.ac.uk/europepmc/webservices/rest/<PMCID>/fullTextXML', expected='Text files in D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/ (cremer2019.txt about 94 kB, narla2021.txt about 80 kB)'),
    dict(what='Fetch abstracts of the paywalled papers', command_or_url='python -X utf8 abstracts.py (Europe PMC search, resultType=core, by DOI)', expected='abstracts.json with non-empty abstracts for all except 10.1016/0022-5193(71)90051-8 and 10.1038/239500a0'),
    dict(what='Download Cremer 2019 source data (3 files, 29 kB)', command_or_url=SRC_M11 + ' ; ' + SRC_M22 + ' ; ' + SRC_M3 + ' (curl -A delphi-research/0.1 into D:/Users/ashenoy00000/delphi-work/data/t2-patterns-deep/)', expected='Downloaded 2026-11-12. MOESM11.xlsx 11512 bytes sha256 685b5e376f51345e26b8f307a0403a0dff45088a9a075325a1507ed623d9cb42; MOESM22.xlsx 11707 bytes sha256 7f758405641324bc28c5740cf004be42c8d9160528aa42c7b53ee6f0ef778b68; MOESM3.txt 5908 bytes sha256 40072304946f8e5ff32ec7dfcbcd5efba11b97bdb54dda0dd0a6214df0f78d38'),
    dict(what='Own calculations (Fisher speed ratios, exponents, Narla Eq 21 vs data, dose peaks, KPP1 check)', command_or_url='python -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/calc.py (needs numpy, openpyxl)', expected='k=16.90 mm2/h; WT u/cF 4.35 to 5.35; Narla/measured 1.07 to 1.32; Pu-glpFK slope 1.12 (0.89 without zero point); dose-series slopes 0.30 and 0.28; peaks 1000 uM (glucose) and 100 uM (glycerol); KPP1 u/cF min 2.49 max 7.09 over 23 rows'),
    dict(what='Check the law library state', command_or_url='python -c "import json;d=json.load(open(r\'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/lawset-1.8.1.json\'));print([l for l in d[\'laws\'] if l[\'law_id\'] in (\'fisher-kpp-speed\',\'turing-ddi\')])"  (read-only)', expected='both listed with status candidate; fisher-kpp-speed.json sha256 635cebac6fa37af67e6649a6d984a460d7f8a4bac7d3f72d6195252320c85812, turing-ddi.json sha256 270076b69392386a5d2ed3dca9800786cbfb96b3480f701043f956af326cf299'),
    dict(what='Rebuild and quote-check this report', command_or_url='python -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/build.py', expected='Writes D:/Users/ashenoy00000/delphi-work/agents2/t2-patterns-deep.json; aborts if any evidence_quote is not found in its saved source text (all 51 quoted findings passed)'),
]

could_not_find = [
    'Original Keller and Segel 1971 paper (10.1016/0022-5193(71)90051-8): paywalled, no abstract in Europe PMC; its content is reported only as described by Narla 2021 and Hillen and Painter 2009.',
    'Berg and Brown 1972 and Budrene and Berg 1995: metadata only, not read; no number depends on them.',
    'Extended Data figures of Cremer 2019 (growth-rate and diffusion plots, uptake, review of earlier models in ED Fig 6) are figures; I could not read their values from the XML. I deliberately did NOT open the other Cremer source-data sheets (MOESM12 to 21, 23, 24) or the 168 MB confocal archive, because the design agent quarantined them for blind predictions; I used only MOESM11, MOESM22 and MOESM3 which that agent had already seen.',
    'Narla 2021 SI Appendix (Table S1 defaults, section S6 for the carrying-capacity factor gamma) was not fetched; Eq 24 and 25 (the dose-curve peak) were not read by me in this run, only noted from the design report. Eq 22 and Eq 21 were read from the garbled XML symbols.',
    'Phan 2024 symbols for units appear as uM in the XML where context requires um; I did not resolve this against the PDF. The cell-density-dependent fix equations (Eq 6) were not transcribed.',
    'No independent second-laboratory table of front speed against growth rate for the same medium was found; Liu 2019 (6 mm/h in rich TB) and Fu 2018 are in different media/geometries so are not comparable.',
    'Fu 2018, Bai 2021, Salek 2019, Keegstra 2017, Bhattacharjee 2022: I read abstracts and selected passages only, not every section.',
    'Whether Narla Eq 21 passes or fails the held-out strains is not a literature fact; I give only the arithmetic comparisons with Cremer published parameters, which are not independent of the paper authors parameter choice.',
    'The data licence of the Springer supplementary files was not found (no explicit licence); files kept only as 3 small files with hashes.',
    'OpenAlex not used per rule; no citation graph counts reported. Review literature is thin: I found no recent single review article on chemotactic range expansion; the two reviews cited (Hillen and Painter 2009; Wadhams and Armitage 2004) are of the model family and the molecular pathway, and Cremer 2019 itself summarises earlier growth-including models (ED Fig 6, not readable here).',
]

recommendations = [
    'Use the Narla closed form only as a baseline within its stated validity band (a0/a_m >> 4 with Cremer parameters, so 100 uM is fine); do not use sqrt(r) across an uptake-titration series, where the measured slope is about 1.',
    'If a law is added to the library for this track, the honest scope is algebra on Eq 21 (monotone in r and a0, independent of mu, bounded below by the Fisher speed), tagged as theorem-from-hypothesis with the PKS closure as the named hypothesis, not as a statement that colonies obey it. fisher-kpp-speed can be reused for the lower bound; turing-ddi should not be applied to this system.',
    'Treat the Phan 2024 high-density failure as the main threat to the model: any frozen prediction involving dense bulges or high attractant should be labelled as exploring the PKS breakdown.',
    'Report ratios to the Fisher speed alongside absolute speeds so that results from different media (3 to 4.3 mm/h minimal, 6 mm/h TB, 7 mm/h casamino acids) compare on one scale.',
    'Next literature step: read the Narla SI (Table S1, section S6) and the Cremer SI Text 2 to settle which parameters were tuned on which conditions.',
]

scripts = [
    'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/crossref_check.py',
    'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/crossref_check2.py',
    'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/epmc_fetch.py',
    'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/abstracts.py',
    'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/calc.py',
    'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/build_part1.py',
    'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/build.py',
]

res = dict(label='t2-patterns-deep', topic='Track 2 deep literature: chemotactic range-expansion front of E. coli in soft agar (Cremer 2019, Narla 2021)',
           summary=summary, lay_summary=lay, glossary=glossary, findings=findings, key_claims=key_claims, table=table, recommendations=recommendations,
           reproduce=reproduce, citations=citations, could_not_find=could_not_find, scripts_written=scripts)
json.dump(res, open(OUT, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
print('written', OUT, len(findings), 'findings', len(citations), 'citations', len(table), 'rows')
