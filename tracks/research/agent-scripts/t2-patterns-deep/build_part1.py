# Part 1: sources map and findings. Imported by build.py. Every evidence_quote is machine-checked against the saved source text.
import json, re
S = r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/'
LAW = r'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/'


def txt(n):
    return open(S + n + '.txt', encoding='utf8').read()


AB = json.load(open(S + 'abstracts.json', encoding='utf8'))
SRC = {k: txt(k) for k in ['cremer2019', 'narla2021', 'fu2018', 'liu2019', 'phan2024', 'bhatt2022', 'ni2020', 'bai2021', 'salek2019', 'keegstra2017']}
for d, k in [("10.1126/science.153.3737.708", 'adler1966'), ("10.1073/pnas.86.18.6973", 'wolfe1989'), ("10.1038/349630a0", 'budrene1991'),
             ("10.1073/pnas.1101996108", 'saragosti2011'), ("10.1016/j.bpj.2011.06.023", 'croze2011'), ("10.1073/pnas.1001994107", 'cates2010'),
             ("10.1073/pnas.0710150104", 'hallatschek2007'), ("10.1126/science.1209042", 'liu2011'), ("10.1038/s41567-021-01380-3", 'mattingly2021'),
             ("10.1007/s00285-008-0201-3", 'hillen2009'), ("10.1038/nrm1524", 'wadhams2004')]:
    SRC[k] = AB[d]['abstract']
SRC['law_kpp'] = open(LAW + 'fisher-kpp-speed.json', encoding='utf8').read()
SRC['law_turing'] = open(LAW + 'turing-ddi.json', encoding='utf8').read()

U = {
    'cremer2019': 'https://doi.org/10.1038/s41586-019-1733-y (full text via Europe PMC PMC6883170)',
    'narla2021': 'https://doi.org/10.1073/pnas.2105138118 (full text via Europe PMC PMC8640786)',
    'fu2018': 'https://doi.org/10.1038/s41467-018-04539-4 (PMC5988668)',
    'liu2019': 'https://doi.org/10.1038/s41586-019-1734-x (PMC6883132)',
    'phan2024': 'https://doi.org/10.1073/pnas.2309251121 (PMC10801886)',
    'bhatt2022': 'https://doi.org/10.7554/eLife.71226 (PMC8903832)',
    'ni2020': 'https://doi.org/10.1073/pnas.1910849117 (PMC6955288)',
    'bai2021': 'https://doi.org/10.7554/eLife.67316 (PMC8563000)',
    'salek2019': 'https://doi.org/10.1038/s41467-019-09521-2 (PMC6478840)',
    'keegstra2017': 'https://doi.org/10.7554/eLife.27455 (PMC5809149)',
    'adler1966': 'https://doi.org/10.1126/science.153.3737.708 (abstract via Europe PMC)',
    'wolfe1989': 'https://doi.org/10.1073/pnas.86.18.6973 (abstract via Europe PMC)',
    'budrene1991': 'https://doi.org/10.1038/349630a0 (abstract via Europe PMC)',
    'saragosti2011': 'https://doi.org/10.1073/pnas.1101996108 (abstract via Europe PMC)',
    'croze2011': 'https://doi.org/10.1016/j.bpj.2011.06.023 (abstract via Europe PMC)',
    'cates2010': 'https://doi.org/10.1073/pnas.1001994107 (abstract via Europe PMC)',
    'hallatschek2007': 'https://doi.org/10.1073/pnas.0710150104 (abstract via Europe PMC)',
    'liu2011': 'https://doi.org/10.1126/science.1209042 (abstract via Europe PMC)',
    'mattingly2021': 'https://doi.org/10.1038/s41567-021-01380-3 (abstract via Europe PMC)',
    'hillen2009': 'https://doi.org/10.1007/s00285-008-0201-3 (abstract via Europe PMC)',
    'wadhams2004': 'https://doi.org/10.1038/nrm1524 (abstract via Europe PMC)',
    'law_kpp': 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/fisher-kpp-speed.json (law set 1.8.1)',
    'law_turing': 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/turing-ddi.json (law set 1.8.1)',
    'own': 'own calculation, script D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-deep/calc.py on Cremer 2019 source data MOESM11/MOESM22',
}


def F(claim, src, conf, quote='', value=''):
    return dict(claim=claim, source=U.get(src, src), confidence=conf, evidence_quote=quote, value=value, _k=src)


findings = [
    # history
    F('Classic observation: motile E. coli placed in a capillary or on agar migrate out as visible bands (rings on plates) because the cells themselves create a gradient of oxygen or an energy source and then move up it.', 'adler1966', 'high',
      'The essence of the matter is that the bacteria create a gradient of oxygen or of an energy source, and then they move preferentially in the direction of the higher concentration of the chemical.', '1966; bands and rings'),
    F('A different pattern, not a travelling front: E. coli on semi-solid agar with TCA-cycle intermediates form stationary spots or stripes that arise sequentially, driven by an attractant the cells excrete themselves.', 'budrene1991', 'high',
      'they form symmetrical arrays of spots or stripes that arise sequentially.', '1991; aggregation'),
    F('Keller and Segel gave the first mathematical travelling-wave account of the bands, but their model neglected cell growth.', 'narla2021', 'high',
      'The first attempt to understand these migrating bands mathematically was made by Keller and Segel, who recovered a traveling-wave solution using a pair of reaction–diffusion–convection equations',
      '1971 model; the original paper has no abstract in Europe PMC and was not read by me, this is Narla 2021 reporting it'),
    F('The Keller-Segel stable wave needs infinitely sensitive sensing (a_m = 0); with a finite threshold the part of the band with a < a_m cannot keep up and the band decays and slows.', 'narla2021', 'high',
      'The latter assumption of the KS model is necessary for stable traveling waves', 'a_m = 0 needed'),
    F('Cremer 2019 also states that the original Keller-Segel front is unstable given a realistic limit of chemotactic sensitivity.', 'cremer2019', 'high',
      'The original Keller–Segel front was unstable given a realistic limit of chemotactic sensitivity'),
    F('Mathematical review: Keller-Segel-type chemotaxis models are a cornerstone of the field, but some formulations show finite-time blow-up (a density spike forming in finite time).', 'hillen2009', 'high',
      'This phenomenon has been shown to lead to finite-time blow-up under certain formulations of the model', 'review, 2009'),
    F('Review of the molecular side: the E. coli signalling pathway (phosphorylated regulator acting on the flagellar motor) is a paradigm for sensory systems.', 'wadhams2004', 'high',
      'This simple pathway has provided a paradigm for sensory systems in general.', 'review, 2004'),
    # soft agar
    F('In soft agar non-chemotactic cells also swarm; tumbling lets cells back away from obstructions, and cells that tumble more formed larger swarms, so a large colony alone does not prove chemotaxis.', 'wolfe1989', 'high',
      'Surprisingly, the higher the tumble frequency, the larger the swarms.', '1989'),
    F('Agar concentration matters: front speed is weakly dependent on agar concentration below 0.25 percent (w/v) but falls sharply above it.', 'croze2011', 'high',
      'The migration front speed is weakly dependent on agar concentration at C < 0.25%, but decreases sharply above this value.', 'C = 0.15 to 0.5 % w/v'),
    F('At 0.35 percent agar the bacteria migrate as broad growth/diffusion bands because the gel suppresses chemotaxis.', 'croze2011', 'high',
      'These are growth/diffusion waves arising because of suppression of chemotaxis by the agar'),
    # Cremer
    F('Central claim of the chosen system: chemotaxis along self-generated gradients of a low-dose attractant, with an abundant primary carbon source, speeds up population expansion before nutrients run out.', 'cremer2019', 'high',
      'Chemotaxis in nutrient-replete conditions promotes the expansion of bacterial populations into unoccupied territories well before nutrients run out in the current environment.'),
    F('Navigated expansion beats unguided Fisher-Kolmogorov expansion in speed and population gain.', 'cremer2019', 'high',
      'This navigated range expansion process spreads faster and yields larger population gains than unguided expansion following the canonical Fisher-Kolmogorov dynamics'),
    F('Measured: expansion speed increases with the batch growth rate across carbon sources, for aspartate or serine as attractant, and for two other motile E. coli strains.', 'cremer2019', 'high',
      'The measured expansion speeds follow a common increasing trend with the batch culture growth rate in the respective medium'),
    F('Without a supplemented attractant, or in a Delta-tar mutant that cannot sense aspartate, expansion is much slower.', 'cremer2019', 'high',
      'In contrast, the expansion became much slower in the absence of a supplemented attractant'),
    F('Measured: swimming speed and run duration showed no substantial variation with growth rate during steady exponential growth, so cell diffusion is nearly growth-rate independent in that study.', 'cremer2019', 'high',
      'neither swimming speed nor run duration showed substantial variation at different growth rates'),
    F('Reference condition (glycerol + aspartate, confocal run): the front bulge advanced at about 3.2 mm/h, followed by a broad exponentially rising density behind it.', 'cremer2019', 'high',
      'the advance of the front bulge (~3.2 mm / h ) is steadily followed by a trailing region with a broad, exponentially increasing density profile',
      '3.2 mm/h here; the source-data table gives 3.675 mm/h for the same medium (different plates), a 13 percent gap'),
    F('Without chemotaxis the populations follow the Fisher-Kolmogorov solution with no adjustable parameters.', 'cremer2019', 'high',
      'Detailed quantitative analysis established that bacterial dynamics in these cases are indeed described by the FK solution without adjustable parameters'),
    F('Growth-Expansion model: only one parameter, the chemotactic coefficient chi0, was left free, fixed by matching the asymptotic speed in the reference condition; the others came from independent experiments or literature.', 'cremer2019', 'high',
      'only one parameter remained unknown, the chemotactic coefficient χ 0'),
    F('Model prediction confirmed: changing the attractant uptake rate hardly changed the expansion, although uptake is what builds the gradient.', 'cremer2019', 'high',
      'changing the uptake rate hardly affected the expansion dynamics, in agreement with model prediction'),
    F('A simple scaling analysis gives the square-root growth-rate dependence; the authors say the full model with growth-rate-dependent parameters describes the data with no adjustable parameters.', 'cremer2019', 'medium',
      'a simple scaling analysis captures the square-root form of the growth-rate dependence'),
    F('Speed versus attractant concentration peaks at a moderate level (long known), reproduced by the model.', 'cremer2019', 'high',
      'The model also adequately accounted for the dependence of the expansion speed on the attractant concentration, long known to peak at a moderate level'),
    F('Pioneers and settlers: cells in the front bulge drift forward; cells behind drift little and only grow, seeding the territory the front passed.', 'cremer2019', 'high',
      'cells in the front bulge region have positive drift velocities and move forward on average; they are the ‘pioneers’ of the population.'),
    # Narla
    F('At chi0 = 0 the GE model reduces to Fisher-KPP, whose speed 2 sqrt(D_rho r) is the minimum expansion speed of the system.', 'narla2021', 'high',
      'In the absence of chemotaxis ( χ 0 = 0 ), the GE model reduces to the Fisher–Kolmogorov–Petrovsky–Piskunov (F-KPP) equation', 'c_F = 2 sqrt(D_rho r)'),
    F('Derived (heuristic ansatz, checked against numerical solutions): speed is proportional to sqrt(growth rate r).', 'narla2021', 'high',
      'First, there is a square root dependence on the growth rate r', 'Eq 21: c = (chi0 - D_rho) sqrt( r (a0/a_m) / (chi0 - D_rho + D_a) )'),
    F('Derived: speed rises with the square root of relative attractant a0/a_m.', 'narla2021', 'high',
      'The expansion speed is further increased by the square root of the relative background attractant concentration'),
    F('Derived: speed is independent of attractant uptake rate mu (bulge size is inversely proportional to mu so mu cancels).', 'narla2021', 'high',
      'the expansion speed c does not depend on the specific rate of attractant uptake μ'),
    F('Validity condition of the closed form: a0/a_m much greater than 1 + D_a/(chi0 - D_rho); independent of r.', 'narla2021', 'medium', '',
      'Eq 22; equation is garbled in the PMC XML so no verbatim quote; read from extracted symbols'),
    F('Parameter ranges: D_rho about 50 um^2/s in soft agar vs 300 to 1000 um^2/s in liquid; sensitivity phi = (chi0 - D_rho)/D_rho between 2 and 8 (cited); aspartate uptake and sensing constants about 1 uM (assumed equal, a_k = a_m).', 'narla2021', 'medium',
      'D ρ ∼ 50 μ m 2 / s for E. coli swimming in soft agar ( 39 ) and D ρ ∼ 300 to 1 , 000 μ m 2 / s in liquid media', 'phi 2 to 8; a_m about 1 uM'),
    F('Predicted boost: speeds can exceed the Fisher speed by orders of magnitude when environmental attractant is high relative to the sensing limit.', 'narla2021', 'high',
      'expansion speeds can be boosted by orders of magnitude when the environmental availability of chemicals relative to the cellular limits of chemical sensing is high'),
    F('Earlier growth-including models restored stability but did not reproduce fast speeds or the rising density trailing the band.', 'narla2021', 'high',
      'they fail to reproduce experimental observations such as fast expansion speeds and a trailing region of increasing bacterial density behind the migrating band'),
    # contested
    F('Contested: the standard Patlak-Keller-Segel model with growth was never directly verified; direct fluorescent measurement of the aspartate gradient shows it fits low-density waves but diverges at high cell density.', 'phan2024', 'high',
      'While the model agreed well with our data at low cell densities, it diverged at high cell densities.', 'peak OD 0.6 (fits) vs 4.6 (fails); microchannel, not agar'),
    F('Phan 2024 proposes that attractant consumption and chemotaxis are both suppressed at higher cell densities.', 'phan2024', 'high',
      'in which both attractant consumption and bacterial chemotaxis are suppressed at higher cell densities'),
    F('Phan 2024 low-density fit: growth rate 0.38 +/- 0.02 per h; consumption 0.51 +/- 0.05; half-saturation 7.6 +/- 3.7 uM; D_B 400 +/- 100; chi 3300 +/- 230 (the XML prints the diffusion units as uM^2/s, which I read as um^2/s).', 'phan2024', 'medium',
      'These PDEs fit the data well for low cell density bacterial waves', 'alpha 0.38 +/- 0.02 /h; A_h 7.6 +/- 3.7 uM; unit-symbol caveat'),
    F('Phan 2024 wave speed 4.4 um/s at low density is 15.8 mm/h by my arithmetic (4.4 x 3.6), about four times the 3 to 5 mm/h of soft agar, so it is a different regime (assuming the XML symbol means um).', 'own', 'low', '',
      '4.4 um/s = 15.84 mm/h'),
    F('Contested or at least unreconciled: motility gene expression rises linearly as growth rate falls on poorer carbon sources (anticipatory investment), whereas Cremer 2019 found swimming speed and run time flat against growth rate in steady exponential growth.', 'ni2020', 'medium',
      'the expression of motility genes increases linearly with the decrease of growth rate on poorer carbon sources', 'different quantity (gene expression vs measured swimming); not a direct contradiction'),
    F('Ni 2020: E. coli invests more in motility in poor media, in proportion to the fitness advantage of following gradients.', 'ni2020', 'high',
      'in poor nutritional conditions, Escherichia coli increases its investment in motility in proportion to the reproductive fitness advantage provided by the ability to follow nutrient gradients'),
    # evolution, heterogeneity
    F('Evolution at the front: an optimal expansion speed exists for a given habitat size; the stable strategy is speed equal to growth rate times habitat size.', 'liu2019', 'high',
      'to expand at a speed given by the product of the growth rate and habitat size'),
    F('Experimental evolution (50 cycles, about 600 generations, 0.25 percent TB agar): ancestor speed about 6 mm/h; samples from 15 mm from the centre stayed at ancestor speed.', 'liu2019', 'high',
      '(position C, with distance X C = 15 mm) at which the expansion speed of the evolved populations fluctuated around that of the ancestor (~6 mm/h)', '6 mm/h in rich TB vs 3 to 4.3 mm/h in minimal medium (Cremer)'),
    F('Within a travelling band, clonal cells of very different chemotactic ability stay together by sorting along the gradient.', 'fu2018', 'high',
      'despite substantial differences in individual chemotactic abilities, the cells are able to migrate as a coherent group by spontaneously sorting themselves within the moving band'),
    F('In the microchannel higher aspartate gave a slower band, consistent with the peak-then-fall dose curve in agar.', 'fu2018', 'medium',
      'as the concentration of Asp increased, the speed of the band decreased'),
    F('Individual drift velocity decreases from back to front of the band, so the band is a pushed wave front.', 'bai2021', 'high',
      'enables the bacterial population to migrate as a pushed wave front'),
    F('Clonal E. coli differ strongly in chemotactic sensitivity (pathway gain).', 'salek2019', 'high',
      'strong heterogeneity in the chemotactic sensitivity coefficient exists even within clonal populations of bacteria'),
    F('Signalling is variable across and within single cells (FRET).', 'keegstra2017', 'high',
      'pervasive signaling variability, both across cells in isogenic populations and within individual cells over time'),
    F('Directional persistence of runs is larger up the gradient inside a travelling wave, improving collective migration.', 'saragosti2011', 'high',
      'not only the mean run length is longer in the direction of propagation, but also that the directional persistence is larger compared to the opposite direction'),
    F('Information limit: E. coli climb gradients within a factor of two of a theoretical bound.', 'mattingly2021', 'high',
      'Despite these limitations, E. coli climb gradients at speeds within a factor of two of the theoretical bound.'),
    F('Populations can smooth out large-scale perturbations of the front in a 3D porous medium through spatial variation of sensing.', 'bhatt2022', 'high',
      'bacterial populations autonomously smooth out large-scale perturbations in their overall morphology'),
    # other mechanisms
    F('Alternative route to stable spots and rings without chemotaxis: density-dependent motility with logistic growth (arrested phase separation).', 'cates2010', 'high',
      'No chemotaxis is assumed in the model, yet it predicts the formation of patterns strikingly similar to some of those believed to result from chemotactic behavior.'),
    F('Engineered stripes: a synthetic circuit coupling cell density to motility makes E. coli form periodic stripes in an expanding population.', 'liu2011', 'high',
      'This system enabled programmed Escherichia coli cells to form periodic stripes of high and low cell densities sequentially and autonomously.'),
    F('Genetic sectoring at the edge of expanding colonies is driven by fluctuations in a thin band of pioneers.', 'hallatschek2007', 'high',
      'The formation of these regions is driven by random fluctuations that originate in a thin band of pioneers at the expanding frontier.'),
    # laws
    F('Law set 1.8.1 pins two relevant laws, fisher-kpp-speed 1.1.0 and turing-ddi 1.1.0, both status candidate (advisory, non-binding). turing-wavelength exists as an unpinned candidate. No law covers chemotactic fronts or Keller-Segel (grep of the lean tree found none).', 'law_kpp', 'high',
      'Fisher-KPP: c^2 = 4sD is the minimum of the linear speed relation, attained at one decay rate', 'lawset-1.8.1.json created 2026-11-01'),
    F('The Fisher-KPP law explicitly does not prove a wave exists or that organisms disperse diffusively; its checkable direction is the lower bound c^2 >= 4 s D (constraint KPP1).', 'law_kpp', 'high',
      'it does not establish that a travelling wave exists, that compactly supported initial data converge to it, or that any population disperses diffusively.'),
    F('The Turing law gives linear instability of a spatial mode only, not a pattern; it does not describe the chemotactic front, which is a growth-and-drift travelling wave.', 'law_turing', 'high',
      'Establishes linear instability of a spatial mode, not that a pattern forms'),
    F('Narla states the Fisher speed is the minimum expansion speed of the GE system, so KPP1 (c^2 >= 4 s D with s = r, D = D_rho) is a testable lower bound for this track.', 'narla2021', 'medium',
      'The green dashed line represents the stable Fisher speed, c F = 2 D ρ r , the minimum expansion speed of our system.', 'link between Narla and the law is my mapping'),
]
