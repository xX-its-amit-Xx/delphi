import json
ROSS = "https://doi.org/10.1038/s42004-023-01019-9"
CS = "https://doi.org/10.1038/s42256-025-01124-5"
KR = "https://doi.org/10.1021/jm300131x"
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/q2-physics.json"


def f(c, s, conf, q="", v=""):
    return dict(claim=c, source=s, confidence=conf, evidence_quote=q, value=v)


findings = [
    f("A 10-fold change in Kd corresponds to RT ln10 = 1.364 kcal/mol at 298.15 K; 1.4 kcal/mol gives 10.6-fold.",
      "own calculation: scripts/q2-physics/arithmetic.py (CODATA R=8.314462 J/mol/K, T=298.15 K, 1 cal=4.184 J)", "high", "",
      "RT=0.5925 kcal/mol; RT ln10=1.3642; exp(1.4/RT)=10.62"),
    f("Lead optimisation needs about 5-fold (roughly 0.95 kcal/mol) resolution in affinity.",
      "https://doi.org/10.1021/ja512751q (abstract via Europe PMC/Crossref); conversion own calc", "high",
      "the level of accuracy that would be needed to guide lead optimization (∼5× in binding affinity)", "5x = 0.95 kcal/mol"),
    f("Independent experimental measurements of the same protein-ligand pair differ by an RMS of 0.56-0.69 pKi (0.77-0.95 kcal/mol), depending on curation.",
      ROSS + " (PMC10576784 full text), citing Kramer et al.", "high",
      "the root-mean-square difference between these independent measurements ranged from 0.56 pKi units (0.77 kcal mol−1) to 0.69 pKi units (0.95 kcal mol−1) depending on how the data was curated",
      "0.77-0.95 kcal/mol"),
    f("Kramer et al. estimate public ChEMBL Ki experimental uncertainty: mean error 0.44 pKi, SD 0.54, median 0.34; maximum squared Pearson R on large datasets 0.81.",
      KR + " (abstract)", "high",
      "The experimental uncertainty is estimated to yield a mean error of 0.44 pK(i) units, a standard deviation of 0.54 pK(i) units, and a median error of 0.34 pK(i) units. The maximum possible squared Pearson correlation coefficient (R(2)) on large data sets is estimated to be 0.81.",
      "R2max=0.81"),
    f("Kramer: models with errors below experimental uncertainty are overtrained, so experimental uncertainty is a natural upper limit on predictive performance (the statement a Lean noise-ceiling theorem would formalise).",
      KR + " (abstract)", "high",
      "experimental uncertainty defines a natural upper limit to the predictive performance possible. Models that yield errors smaller than the experimental uncertainty are necessarily overtrained."),
    f("Ross et al. survey: median RMSE between experimental assays is 0.85 kcal/mol; median pairwise RMSE of FEP+ on their benchmark is 1.08 kcal/mol.",
      ROSS + " (PMC10576784)", "high",
      "The median RMSE in the experimental survey is 0.85 kcal mol−1 and the median in the FEP+ benchmark is 1.08 kcal mol−1.", "0.85 vs 1.08 kcal/mol"),
    f("Of 13,732 FEP+ relative binding free energy predictions, 57.5% were within 1 kcal/mol of experiment and 12.9% off by more than 2; among 314,535 experimental pairs 83.0% agreed within 1 kcal/mol and 2.1% differed by more than 2.",
      ROSS + " (PMC10576784)", "high",
      "In all 13,732 FEP+ relative binding free energy predictions, 57.5% were within 1 kcal mol−1 of the experimental value and 12.9% differed by more than 2 kcal mol−1",
      "57.5% / 12.9%; 83.0% / 2.1%"),
    f("Ross et al.: experimental RMSE is about 1 kcal/mol on average, so FEP matching it on a large diverse set would be an extraordinary challenge; with careful structure preparation FEP can reach accuracy comparable to experimental reproducibility.",
      ROSS + " (PMC10576784; abstract)", "high",
      "As our experimental reproducibility survey indicated that experimental RMSE is on average ~1 kcal mol−1, it would be an extraordinary challenge to ever have an FEP method that achieves an error truly statistically indistinguishable"),
    f("FEP accuracy depends on preparation: protonation and tautomeric states of ligand and protein residues are historically difficult to assign; missing loops and flexible regions need care.",
      ROSS + " (PMC10576784)", "high",
      "A historically difficult aspect of preparing structures has been the determination of the protonation and tautomeric states of the ligands and the protein binding residues"),
    f("A trivial memorisation baseline (average labels of the 5 most similar training complexes) reaches Pearson R=0.716, RMSE=1.517 (pK units, about 2.07 kcal/mol) on CASF-2016, competitive with published deep-learning scoring functions: train-test leakage between PDBbind and CASF.",
      CS + " (PMC12552120)", "high",
      "This algorithm showed competitive CASF2016 prediction root-mean-square error (r.m.s.e.) compared with some published deep-learning-based scoring functions (Pearson R = 0.716, r.m.s.e. = 1.517).",
      "RMSE 1.517 pK = 2.07 kcal/mol (own conversion)"),
    f("After removing leakage (PDBbind CleanSplit) the search baseline drops to RMSE 1.648, R=0.653; GEMS trained on CleanSplit gets RMSE 1.308, R=0.803 (Pafnucy 1.484/0.746, GenScore 1.362/0.780).",
      CS + " (PMC12552120)", "high",
      "With a prediction r.m.s.e. of 1.308 and a Pearson correlation of 0.803, GEMS considerably outperforms Pafnucy (r.m.s.e. = 1.484, Pearson R = 0.746) and GenScore (r.m.s.e. = 1.362, Pearson R = 0.780)",
      "GEMS 1.308 pK = 1.78 kcal/mol"),
    f("The best leakage-free learned scoring function (1.308 pK, 1.78 kcal/mol) is about 1.9-2.3x the experimental pairwise RMS (0.77-0.95 kcal/mol); caveat: different quantities (absolute pK vs relative dG) and different sets.",
      "own calculation: arithmetic.py; sources CS and ROSS", "medium"),
    f("On CASF-2016, current scoring functions do better at docking power than at scoring, ranking and screening power.",
      "https://doi.org/10.1021/acs.jcim.8b00545 (abstract)", "high",
      "the performance of current scoring functions is more promising in terms of docking power than scoring, ranking, and screening power."),
    f("Entropy-enthalpy compensation: evidence for severe compensation is weak because errors in measured entropy and enthalpy are large and correlated; a limited form may be common.",
      "https://doi.org/10.1146/annurev-biophys-083012-130318 (abstract)", "high",
      "We find the evidence for severe compensation to be weak in light of the large magnitude of and correlation between errors in experimental measurements of entropic and enthalpic contributions to binding, though a limited form of compensation may be common."),
    f("Chodera and Mobley recommend assessing changes in binding free energy directly, since entropic and enthalpic changes are hard to predict or measure to useful precision.",
      "https://doi.org/10.1146/annurev-biophys-083012-130318 (abstract)", "high",
      "Given the difficulty of predicting or measuring entropic and enthalpic changes to useful precision, or using this information in design, we recommend ligand engineering efforts instead focus on computational and experimental methodologies to directly assess changes in binding free energy."),
    f("Illustration: at 298.15 K an entropy change of 10 cal/mol/K is worth T*dS = 2.98 kcal/mol (about 153-fold in K), so dH and TdS terms of several kcal/mol each can cancel to leave dG within the 1.4 kcal/mol scale.",
      "own calculation: arithmetic.py (the 153 is exp(2.98/0.5925), computed here)", "high", "", "T*dS=2.98 kcal/mol at dS=10 cal/mol/K"),
    f("Water displacement: a ligand change that displaces an ordered water can raise or lower affinity depending on the cost of removing the water versus new interactions; naive ligand-only perturbation can trap the water and mislead.",
      "https://doi.org/10.1021/ja906058w (abstract)", "high",
      "the binding affinity may diminish if the free-energy increase due to the removal of the bound water molecule is not more than compensated by the additional interactions of the water-displacing moiety."),
    f("Protonation: binding can shift pK and protonation states, making binding pH dependent, though shifts do not occur in every complex and prevalence estimates vary by complex and method.",
      "https://doi.org/10.1017/s0033583513000024 (abstract)", "high",
      "While there is no doubt that these changes occur, they do not occur all the time; the estimated prevalence varies, both between individual complexes and by method."),
    f("Flexibility: conformational selection may be far more common than believed, and a rise in k_obs with ligand concentration is not unequivocal evidence of induced fit.",
      "https://doi.org/10.1021/bi3006913 (abstract)", "high",
      "We conclude that conformational selection as a mechanism for a ligand binding to its target may be far more common than currently believed."),
    f("Residence time (dissociative half-life of the drug-target complex) is an alternative to Kd/IC50 for optimisation, with potential advantages for duration of effect and selectivity.",
      "https://doi.org/10.1038/nrd2082 (abstract)", "high",
      "This article presents an alternative perspective on drug optimization in terms of drug-target binary complex residence time, as quantified by the dissociative half-life of the drug-target binary complex."),
    f("Kinetics arithmetic: Kd=koff/kon, so Kd=1 nM is reached by (kon 1e6 /M/s, koff 1e-3 /s; residence 1000 s) or (kon 1e8, koff 0.1; residence 10 s): same dG, 100-fold different residence time.",
      "own calculation: arithmetic.py (Kd=koff/kon is the definition for 1:1 binding)", "high"),
    f("Assay conditions: mixing ChEMBL IC50 values from different assays adds moderate noise (SD only 25% larger than for Ki); a Ki-IC50 conversion factor of 2 was most reasonable.",
      "https://doi.org/10.1371/journal.pone.0061007 (abstract, PMC3628986)", "high",
      "The standard deviation of IC50 data is only 25% larger than the standard deviation of Ki data, suggesting that mixing IC50 data from different assays, even not knowing assay conditions details, only adds a moderate amount of noise"),
    f("Cheng-Prusoff (competitive inhibitor): IC50 = Ki(1+[S]/Km). At [S]=Km a 2-fold (0.41 kcal/mol) offset; at [S]=10 Km an 11-fold (1.42 kcal/mol) offset, so assay design alone can exceed the 1.4 kcal/mol scale.",
      "own calculation: arithmetic.py; formula is unverified background (standard; the 1973 paper's DOI resolved but no text was read)", "medium"),
    f("Brown et al.: expected model performance is often not supported by the underlying data because of neglected assay and prediction errors.",
      "https://doi.org/10.1016/j.drudis.2009.01.012 (abstract)", "high",
      "the expected performance of many models is simply not supported by the underlying data, because of often neglected effects of assay and prediction errors on the reliability of the predicted outcome."),
    f("Merck KGaA prospective FEP+ study: physics-based free energy calculation is regarded as the most rigorous way to estimate binding affinity; large-scale prospective use exposed limitations.",
      "https://doi.org/10.1021/acs.jcim.0c00900 (abstract)", "medium",
      "Physics-based free energy calculations are regarded as the most rigorous way to estimate binding affinity."),
    f("Relative FEP is the mature form: it predicts affinity differences for congeneric ligands with enough accuracy to add value in hit-to-lead and lead optimisation.",
      "https://doi.org/10.1021/acs.jcim.7b00564 (abstract)", "high",
      "RBFE simulations can now predict the affinity differences for congeneric ligands with sufficient accuracy and throughput to deliver considerable value in hit-to-lead and lead optimization efforts."),
    f("Noise-ceiling arithmetic: R2max = 1 - sigma^2/Var(obs). Kramer's R2max=0.81 with sigma=0.54 pK corresponds to an observed-label SD of about 1.24 pK (assuming the same sigma).",
      "own calculation: arithmetic.py", "medium", "", "SD(obs)=1.24 pK"),
    f("Cooperativity (binding at one site changing affinity at another) is a distinct non-additive effect; no numeric benchmark was extracted.",
      "https://doi.org/10.1002/anie.200902490 (title only; abstract not retrievable)", "low"),
]

table = [
    dict(name="RT ln10 (10-fold in K)", fields="T=298.15 K; RT=0.5925 kcal/mol; RT ln10=1.364 kcal/mol; 1.4 kcal/mol=10.6x; 1.0=5.4x; 2.0=29x; 3.0=158x", source="own calc scripts/q2-physics/arithmetic.py"),
    dict(name="Expt reproducibility (Ki, Kramer 2012)", fields="mean_err=0.44 pKi (0.60 kcal/mol); SD=0.54 pKi (0.74 kcal/mol); median=0.34 pKi; R2max=0.81", source=KR),
    dict(name="Expt reproducibility (Ross 2023 survey)", fields="pairwise_RMS=0.77-0.95 kcal/mol; median_RMSE=0.85 kcal/mol; within_1kcal=83.0%; beyond_2kcal=2.1%; n_pairs=314535", source=ROSS),
    dict(name="FEP+ benchmark (Ross 2023)", fields="median_pairwise_RMSE=1.08 kcal/mol; within_1kcal=57.5%; beyond_2kcal=12.9%; n_predictions=13732", source=ROSS),
    dict(name="Search baseline, CASF-2016, original PDBbind", fields="Pearson_R=0.716; RMSE=1.517 pK (2.07 kcal/mol); n=285", source=CS),
    dict(name="Ligand-only search baseline, original PDBbind", fields="Pearson_R=0.707; RMSE=1.539 pK (2.10 kcal/mol)", source=CS),
    dict(name="Search baseline, CleanSplit", fields="Pearson_R=0.653; RMSE=1.648 pK (2.25 kcal/mol)", source=CS),
    dict(name="Ligand-only search baseline, CleanSplit", fields="Pearson_R=0.625; RMSE=1.711 pK (2.33 kcal/mol)", source=CS),
    dict(name="GEMS (CleanSplit)", fields="Pearson_R=0.803; RMSE=1.308 pK (1.78 kcal/mol)", source=CS),
    dict(name="GenScore (CleanSplit)", fields="Pearson_R=0.780; RMSE=1.362 pK (1.86 kcal/mol)", source=CS),
    dict(name="Pafnucy (CleanSplit)", fields="Pearson_R=0.746; RMSE=1.484 pK (2.02 kcal/mol)", source=CS),
    dict(name="Cheng-Prusoff offset", fields="[S]/Km=0.1,1,5,10 -> IC50/Ki=1.1,2,6,11 -> 0.06,0.41,1.06,1.42 kcal/mol", source="own calc arithmetic.py; formula unverified background (doi 10.1016/0006-2952(73)90196-2)"),
    dict(name="Kinetics at equal Kd=1 nM", fields="kon=1e6/M/s koff=1e-3/s residence=1000 s; kon=1e8 koff=0.1 residence=10 s; kon=1e5 koff=1e-4 residence=1e4 s", source="own calc arithmetic.py"),
    dict(name="Entropy term size", fields="T*dS=1.49,2.98,5.96 kcal/mol for dS=5,10,20 cal/mol/K at 298.15 K", source="own calc arithmetic.py"),
]

key_claims = [
    dict(claim="Experimental replicate disagreement is about 0.8-0.95 kcal/mol RMS (0.56-0.69 pKi), so experimental noise sets a floor on any model's measurable error and a ceiling R2 near 0.81 for large public Ki sets.",
         source=ROSS + " ; " + KR,
         evidence_quote="the root-mean-square difference between these independent measurements ranged from 0.56 pKi units (0.77 kcal mol−1) to 0.69 pKi units (0.95 kcal mol−1) depending on how the data was curated"),
    dict(claim="Rigorous FEP reaches median pairwise RMSE 1.08 kcal/mol vs 0.85 for experiment on a carefully prepared benchmark: near, not at, the noise floor.",
         source=ROSS, evidence_quote="The median RMSE in the experimental survey is 0.85 kcal mol−1 and the median in the FEP+ benchmark is 1.08 kcal mol−1."),
    dict(claim="Learned scoring functions are further from the floor (best leakage-free RMSE 1.308 pK, about 1.8 kcal/mol), and a no-physics lookup of similar training complexes gets 1.517 pK on the leaky split, so CASF numbers partly reflect memorisation.",
         source=CS, evidence_quote="Averaging the affinity label of the five most similar training complexes resulted in an r.m.s.e. of 1.648 and a Pearson correlation of 0.653."),
    dict(claim="1.4 kcal/mol is a 10.6-fold change in K at 298 K (RT ln10 = 1.364 kcal/mol gives exactly 10-fold).",
         source="own calculation scripts/q2-physics/arithmetic.py", evidence_quote=""),
]

cits = [
    ("Wang L, Wu Y, Deng Y, et al.", 2015, "Accurate and Reliable Prediction of Relative Ligand Binding Potency in Prospective Drug Discovery by Way of a Modern Free-Energy Calculation Protocol and Force Field", "10.1021/ja512751q", "FEP+ ~5x target; abstract only", "JACS", True),
    ("Ross GA, et al.", 2023, "The maximal and current accuracy of rigorous protein-ligand binding free energy calculations", "10.1038/s42004-023-01019-9", "FEP vs experimental reproducibility", "Communications Chemistry", True),
    ("Kramer C, Kalliokoski T, Gedeck P, Vulpetti A", 2012, "The Experimental Uncertainty of Heterogeneous Public Ki Data", "10.1021/jm300131x", "Ki noise, R2max=0.81", "J Med Chem", True),
    ("Kalliokoski T, Kramer C, Vulpetti A, Gedeck P", 2013, "Comparability of Mixed IC50 Data - A Statistical Analysis", "10.1371/journal.pone.0061007", "assay mixing noise", "PLoS ONE", True),
    ("Su M, et al.", 2018, "Comparative Assessment of Scoring Functions: The CASF-2016 Update", "10.1021/acs.jcim.8b00545", "CASF benchmark; scoring power weak", "J Chem Inf Model", True),
    ("Graber D, et al.", 2025, "Resolving data bias improves generalization in binding affinity prediction", "10.1038/s42256-025-01124-5", "leakage, baselines, CleanSplit numbers", "Nature Machine Intelligence", True),
    ("Chodera JD, Mobley DL", 2013, "Entropy-Enthalpy Compensation: Role and Ramifications in Biomolecular Ligand Recognition and Design", "10.1146/annurev-biophys-083012-130318", "compensation", "Annu Rev Biophys", True),
    ("Copeland RA, et al.", 2006, "Drug-target residence time and its implications for lead optimization", "10.1038/nrd2082", "residence time", "Nat Rev Drug Discov", True),
    ("Michel J, Tirado-Rives J, Jorgensen WL", 2009, "Energetics of Displacing Water Molecules from Protein Binding Sites: Consequences for Ligand Optimization", "10.1021/ja906058w", "water", "JACS", True),
    ("Cournia Z, Allen B, Sherman W", 2017, "Relative Binding Free Energy Calculations in Drug Discovery: Recent Advances and Practical Considerations", "10.1021/acs.jcim.7b00564", "RBFE overview", "J Chem Inf Model", True),
    ("Schindler CEM, et al.", 2020, "Large-Scale Assessment of Binding Free Energy Calculations in Active Drug Discovery Projects", "10.1021/acs.jcim.0c00900", "prospective FEP+", "J Chem Inf Model", True),
    ("Brown SP, Muchmore SW, Hajduk PJ", 2009, "Healthy skepticism: assessing realistic model performance", "10.1016/j.drudis.2009.01.012", "assay error limits models", "Drug Discov Today", True),
    ("Onufriev AV, Alexov E", 2013, "Protonation and pK changes in protein-ligand binding", "10.1017/s0033583513000024", "protonation", "Q Rev Biophys", True),
    ("Vogt AD, Di Cera E", 2012, "Conformational Selection or Induced Fit? A Critical Appraisal of the Kinetic Mechanism", "10.1021/bi3006913", "flexibility", "Biochemistry", True),
    ("Mobley DL, Gilson MK", 2017, "Predicting Binding Free Energies: Frontiers and Benchmarks", "10.1146/annurev-biophys-070816-033654", "challenges review (abstract only)", "Annu Rev Biophys", True),
    ("Cheng Y, Prusoff WH", 1973, "Relationship between the inhibition constant (KI) and the concentration of inhibitor which causes 50 per cent inhibition (I50) of an enzymatic reaction", "10.1016/0006-2952(73)90196-2", "IC50 to Ki (existence only)", "Biochem Pharmacol", False),
    ("Hunter CA, Anderson HL", 2009, "What is Cooperativity?", "10.1002/anie.200902490", "cooperativity concept (title only)", "Angew Chem Int Ed", False),
]
citations = []
for a, y, t, d, u, v, ab in cits:
    citations.append(dict(
        authors=a, year=y, title=t, venue=v, doi_or_arxiv=d, verified=True, used_for=u,
        how_verified="Crossref https://api.crossref.org/works/" + d + " resolved in this run (title and year matched)"
        + ("; abstract read via Europe PMC/Crossref" if ab else "; no abstract available, existence only")))

lean_rec = (
    "Lean-capturable (theorems from explicit hypotheses): (1) dG = -RT ln K, so a factor 10 in K is RT ln10; (2) noise ceiling: for label = truth + independent noise of variance s^2 with observed variance V, any predictor's squared correlation with the observed label is at most 1 - s^2/V and its expected squared error against one measurement is at least s^2; "
    "(3) pairwise replicate RMS = sqrt2 * sigma; (4) additivity of dG around thermodynamic cycles, so an RBFE graph is identifiable only up to a constant; (5) Kd = koff/kon, so equal dG allows different residence times and no function of dG alone predicts residence; (6) Cheng-Prusoff offset; "
    "(7) compensation: with dG = dH - T dS, dH and T dS can both move while dG stays fixed, so enthalpy alone does not identify dG; (8) a nearest-neighbour memoriser has error bounded by label variation among similar inputs, so benchmark skill under leakage is not evidence of physics. "
    "None of these were compiled in this run; they are proposals.")

res = dict(
    label="q2-physics",
    topic="Q2 binding-affinity prediction: the physics that models skip",
    summary=(
        "Binding affinity is hard in principle because the quantity is a small difference of large, compensating terms (dG = dH - TdS; a 10 cal/mol/K entropy change is 2.98 kcal/mol at 298 K), the useful resolution is 0.5-1.4 kcal/mol (5-10x in K; RT ln10 = 1.364 kcal/mol), and the labels are noisy: independent experiments agree to only 0.77-0.95 kcal/mol RMS (Ross 2023), with R2max about 0.81 on public Ki sets (Kramer 2012). "
        "Relative FEP reaches median pairwise RMSE 1.08 kcal/mol against an experimental 0.85 on a carefully prepared benchmark, near the floor, but only after protonation, tautomers, poses, waters and flexible loops were fixed by hand. "
        "Learned scoring functions reach RMSE 1.3-1.5 pK (1.8-2.1 kcal/mol) and a pure lookup of similar training complexes gets 1.517 pK on the leaky CASF split, so much benchmark skill is memorisation (Graber 2025). "
        "A Lean statement can capture the arithmetic and statistical ceilings (log conversion, noise floor, Kd = koff/kon, Cheng-Prusoff, cycle additivity); the sizes of sigma, prevalence of compensation, water and protonation effects, and model generalisation are empirical. No Lean was compiled in this run."),
    lay_summary=(
        "Drug makers want to predict how tightly a small molecule sticks to a protein. The difference between a good and a mediocre drug can be tiny, about the energy of one weak bond, and 1.4 kcal/mol of energy already means a tenfold change in stickiness. "
        "It is like weighing a ship's captain by weighing the ship with and without him: two huge numbers, and a small error in either swamps the answer. "
        "Even the lab measurements disagree with each other by about that much, so no model can honestly be judged better than the lab noise. "
        "Heavy physics simulations get close to that limit but need expert care, while many machine-learning models score well mostly because their test questions resemble their training answers."),
    glossary=[
        dict(term="binding affinity", plain="how strongly a molecule sticks to its protein partner"),
        dict(term="kcal/mol", plain="a unit of energy per mole of molecules; 1 kcal is 4184 joules"),
        dict(term="Kd / Ki / IC50", plain="concentrations that measure how tightly a molecule binds or how strongly it blocks"),
        dict(term="pK", plain="minus the base-10 log of Kd or Ki; one unit is a tenfold change"),
        dict(term="entropy", plain="a measure of disorder or freedom to wiggle"),
        dict(term="enthalpy", plain="the heat released or taken up as bonds form"),
        dict(term="free-energy perturbation (FEP)", plain="a computer simulation that slowly turns one molecule into another to estimate the energy difference"),
        dict(term="scoring function", plain="a fast formula or model that gives a docked molecule a binding score"),
        dict(term="RMSE", plain="the typical size of a prediction error"),
        dict(term="residence time", plain="how long a molecule stays stuck before it falls off"),
        dict(term="desolvation", plain="stripping water off a molecule or pocket so they can touch"),
        dict(term="protonation state", plain="which spots on a molecule carry an extra hydrogen ion, which changes its charge"),
        dict(term="tautomer", plain="a form of the same molecule with a hydrogen moved to another place"),
        dict(term="data leakage", plain="test questions that are nearly copies of training examples"),
        dict(term="Lean", plain="a proof checker that verifies mathematical statements by machine"),
    ],
    findings=findings,
    key_claims=key_claims,
    table=table,
    recommendations=[
        lean_rec,
        "Empirical (needs data, not Lean): size of sigma per assay type; prevalence and magnitude of compensation; water-network energetics; protonation shifts; induced fit versus selection; cooperativity; whether a given deep model generalises. Test the Lean noise-ceiling statement against public replicate data (ChEMBL pairs, Ross survey) and the CleanSplit versus original PDBbind results.",
        "Convert pK to kcal/mol explicitly (x1.364). Ross reports relative dG pairwise errors, Graber reports absolute pK errors, so do not compare 1.08 kcal/mol and 1.308 pK directly.",
    ],
    reproduce=[
        dict(what="1.4 kcal/mol arithmetic, noise ceiling, kinetics, Cheng-Prusoff", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/arithmetic.py (Python 3.14)", expected="RT ln10 = 1.3642 kcal/mol; exp(1.4/RT)=10.62; Kramer-implied SD(obs)=1.24 pK"),
        dict(what="Crossref DOI lookup", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/lookup.py q.json out.json", expected="DOIs such as 10.1038/s42004-023-01019-9 and 10.1021/jm300131x returned"),
        dict(what="Fetch abstracts (Crossref + Europe PMC)", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/abstracts.py out.json 10.1021/jm300131x 10.1038/s42004-023-01019-9", expected="Kramer abstract contains 'R(2)) on large data sets is estimated to be 0.81'"),
        dict(what="Ross 2023 full text (open access)", command_or_url="curl -A delphi-research/0.1 https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10576784/fullTextXML (saved in agents2/scratch/q2-physics, 162763 bytes, sha256 f371d2e373306588d11b695b8de21b253a90293d6a15884f635bcf927bdebb1d, fetched 2026-11-12)", expected="text contains 'median in the FEP+ benchmark is 1.08 kcal mol'"),
        dict(what="Graber 2025 full text (open access)", command_or_url="curl -A delphi-research/0.1 https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12552120/fullTextXML (182530 bytes, sha256 8ceecb1594f1e74c4a7d7a54355912f7c7c305cc4a784e58ee716a7ee5ece662)", expected="text contains 'r.m.s.e. of 1.308 and a Pearson correlation of 0.803'"),
        dict(what="Kalliokoski 2013 full text", command_or_url="curl -A delphi-research/0.1 https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3628986/fullTextXML (88000 bytes, sha256 613621947a6e53fd9aa7da6c27e99d3c969fbb61edb4e3c0410c637a7ad35a95)", expected="IC50 SD about 25% larger than Ki SD"),
        dict(what="Rebuild this JSON", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/build_result.py", expected="writes D:/Users/ashenoy00000/delphi-work/agents2/q2-physics.json"),
    ],
    citations=citations,
    could_not_find=[
        "Wang et al. 2015 FEP+ headline error (mean unsigned error) - paywalled; only the abstract (5x goal, ~200 ligands) was read; no value used.",
        "Original CASF-2016 scoring-power numbers for classical functions (Vina, Glide): paper paywalled, only abstract read; the Graber table is a figure and its Vina/Glide values could not be read.",
        "Quantitative magnitudes for water displacement, protonation shifts, induced-fit penalties and cooperativity: only qualitative abstract statements fetched; no numbers claimed.",
        "Hunter & Anderson 2009 and Cheng & Prusoff 1973: DOIs resolve but no abstract/text retrievable; the Cheng-Prusoff formula is unverified background (standard) with my arithmetic on top.",
        "Absolute binding free energy (ABFE) benchmark RMSE: Mobley & Gilson 2017 abstract has no numbers; not stated.",
        "No Lean file was written, compiled or checked (repo is read-only here; the lean/ registry contains no affinity statements as far as a grep for noise/reliab/affinity found); recommendations are proposals only.",
        "Kramer's 0.54 pKi SD may refer to pairwise differences; the abstract does not say, so the sqrt2 conversion is applied only to Ross's RMS differences (assumption flagged).",
        "Ross experimental vs FEP+ comparison (0.85 vs 1.08) involves different sets/quantities, so it is suggestive not a strict test; a Gaussian with sigma=1.08 would give 64.6% within 1 kcal/mol versus the reported 57.5% (heavier tails).",
    ],
    scripts_written=[
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/lookup.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/abstracts.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/arithmetic.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-physics/build_result.py",
    ],
)
with open(OUT, "w", encoding="utf8") as fh:
    json.dump(res, fh, indent=1, ensure_ascii=False)
print("ok", len(findings), len(table), len(citations))
