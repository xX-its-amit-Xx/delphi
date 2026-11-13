import json
S = lambda d: "https://doi.org/" + d
CS = S("10.1038/s42256-025-01124-5"); DU = S("10.1093/bioinformatics/btaf040")
VO = S("10.1021/acs.jmedchem.2c00487"); LP = S("10.1021/acs.jpcb.5c08598")
KR = S("10.1021/jm300131x"); LR = S("10.1021/acs.jcim.4c00049")
RO = S("10.1038/s42004-023-01019-9"); BR = S("10.1016/j.drudis.2009.01.012")
R = {"label": "q2-literature", "topic": "Q2 binding-affinity prediction: the literature on why it fails"}
R["summary"] = (
 "Verified literature (Crossref + Europe PMC/PMC full text, fetched 2026-11-12) gives three converging explanations. "
 "(1) Leakage: Graber et al. (Nat Mach Intell 2025) find nearly 600 train-test similarities involving 49% of CASF complexes; a lookup baseline averaging the labels of the 5 most similar training complexes gets CASF2016 Pearson 0.716 / RMSE 1.517 trained on PDBbind but 0.653 / 1.648 on CleanSplit. "
 "(2) Shortcuts: Volkov 2022 report that nearest-neighbour lookups on ligands or proteins do well ('memorization largely dominates'); Durant 2025 show ligand-only (r 0.76) and protein-only (0.75) baselines near five ML scoring functions (0.74-0.82) on CASF2016, and all models fall to r 0.17-0.37 on a peptide holdout / ligand-bias-free set. "
 "(3) Noise floor: Kramer 2012 estimate mean error 0.44 pKi (SD 0.54), max R2 0.81 (r about 0.90, own sqrt) on large ChEMBL Ki sets; Landrum & Riniker 2024 find about 65% of cross-assay IC50 pairs differ by >0.3 log units (Kendall tau 0.51); Ross 2023 give pairwise experimental RMSE 0.91 kcal/mol vs FEP+ 1.25. "
 "LP-PDBBind (Li 2026) shows retraining on a leak-proof split changes scores and that original test performance was over-estimated. PLINDER (2024) and PLABench (2026 preprint) abstracts confirm the leakage framing but gave no readable key numbers. "
 "Caveats: Pafnucy/GenScore before/after numbers exist only in a figure; Volkov, Kramer, Brown and Wang full texts are paywalled so only abstract numbers are used.")
R["lay_summary"] = (
 "Computer programs that guess how tightly a drug sticks to a protein look great on the standard tests. But many test cases are near-copies of the examples the programs learned from, like a student who saw the exam questions in advance. "
 "When researchers removed the copies, scores fell, and even simple lookup tricks that ignore the physics did almost as well as fancy AI. "
 "On top of that, the lab measurements used as the answer key are themselves fuzzy: two labs measuring the same drug often disagree by a few-fold. "
 "That fuzziness sets a ceiling no program can beat, much as nobody can read a blurry ruler more precisely than its blur.")
R["glossary"] = [
 {"term": "binding affinity", "plain": "how strongly a small molecule sticks to a protein"},
 {"term": "PDBbind / CASF", "plain": "a big collection of protein-drug structures with measured stickiness (PDBbind) and its standard test subset (CASF)"},
 {"term": "data leakage", "plain": "test items that are near-copies of training items, so the test is too easy"},
 {"term": "CleanSplit / LP-PDBBind / PLINDER", "plain": "re-cut versions of the data that remove near-copies between training and test"},
 {"term": "pKi", "plain": "a log-scale measure of affinity; one unit is a ten-fold change in binding strength"},
 {"term": "kcal/mol", "plain": "an energy unit; 1 pK unit is about 1.36 kcal/mol at room temperature"},
 {"term": "Pearson r / R2", "plain": "how closely predictions track the truth; 1 is perfect, 0 is none"},
 {"term": "RMSE", "plain": "typical size of the prediction error, in the same units as the quantity"},
 {"term": "Kendall tau", "plain": "a score for how well two sets of measurements agree on ranking"},
 {"term": "FEP", "plain": "free energy perturbation; a physics simulation of how affinity changes between similar molecules"},
 {"term": "noise floor", "plain": "the error already in the measurements, which no model can go below"},
 {"term": "ligand-only / protein-only baseline", "plain": "a model shown only the drug or only the protein, yet still predicting well"},
 {"term": "IC50", "plain": "drug concentration that blocks half of an activity; a different readout from Ki"},
]
F = []
def f(claim, source, conf, quote, value=""):
    F.append(dict(claim=claim, source=source, confidence=conf, evidence_quote=quote, value=value))
f("Leakage between PDBbind and CASF is widespread: nearly 600 similarities, involving 49% of CASF complexes", CS + " (PMC12552120 full text)", "high",
  "nearly 600 such similarities were detected between PDBbind training and CASF complexes, involving 49% of all CASF complexes", "~600 pairs; 49% of CASF")
f("CleanSplit filtering excluded 4% of all training complexes", "PMC12552120", "high", "Together, this filtering excluded 4% of all training complexes.", "4%")
f("Lookup baseline (mean label of 5 most similar training complexes) trained on original PDBbind: CASF2016 Pearson 0.716, RMSE 1.517 (unit as reported, pK)", "PMC12552120", "high",
  "(Pearson R = 0.716, r.m.s.e. = 1.517)", "r=0.716; RMSE=1.517")
f("Same lookup baseline on CleanSplit: Pearson 0.653, RMSE 1.648 (drop 0.063 in r and rise 0.131 in RMSE, own arithmetic in calc.py); ligand-similarity lookup 0.625 / 1.711", "PMC12552120", "high",
  "Averaging the affinity label of the five most similar training complexes resulted in an r.m.s.e. of 1.648 and a Pearson correlation of 0.653.", "r 0.716->0.653")
f("Ligand-memorisation lookup on original PDBbind reached Pearson 0.707 / RMSE 1.539", "PMC12552120", "medium",
  "(Pearson R = 0.707, r.m.s.e. = 1.539), confirming previous research on the importance of ligand memorization", "r=0.707; RMSE=1.539")
f("Pafnucy CASF2016 performance dropped substantially on CleanSplit, approaching the simple search baselines; GenScore dropped less. Exact before/after numbers are in a figure and could not be read", "PMC12552120", "medium",
  "the performance of Pafnucy on the CASF2016 benchmark dropped substantially, approaching the level of the simple search algorithms", "figure only, value not read")
f("GEMS trained on CleanSplit: CASF2016 Pearson 0.803, RMSE 1.308, vs Pafnucy 0.746/1.484 and GenScore 0.780/1.362 (all CleanSplit-trained); authors' own model, so treat as self-reported", "PMC12552120", "high",
  "With a prediction r.m.s.e. of 1.308 and a Pearson correlation of 0.803, GEMS considerably outperforms Pafnucy (r.m.s.e. = 1.484, Pearson R = 0.746) and GenScore (r.m.s.e. = 1.362, Pearson R = 0.780)", "r=0.803, RMSE=1.308")
f("Durant 2025: bias-only baselines are competitive with five published ML scoring functions on almost all benchmarks", DU + " (abstract, Europe PMC 39874452)", "high",
  "We found that these baseline models were competitive in accuracy to these MLBSFs in almost all proposed benchmarks, indicating these models only learn dataset biases.")
f("Durant Table 1, CASF2016 Pearson R: LigandBias 0.76, ProteinBias 0.75, BothBias 0.85; RFScore 0.82, PointVS 0.79, Pafnucy 0.74, SIGN 0.82, OnionNet-2 0.82; Smina 0.59", "PMC11821266 Table 1 (script extract_durant.py)", "high",
  "LigandBias | 0.76 ± 0.06 | 0.59 ± 0.03 | 0.23 ± 0.04 | 0.08 ± 0.11", "ligand-only r=0.76 vs ML 0.74-0.82")
f("Durant Table 1, 2019 Holdout Pearson R: LigandBias 0.59, BothBias 0.67, OnionNet-2 0.70; Peptides Holdout 0.23-0.37 for all models; ligand-bias-free set 0.08-0.41 (ML models 0.17-0.35)", "PMC11821266 Table 1", "high",
  "OnionNet-2 | 0.82 ± 0.04 | 0.70 ± 0.03 | 0.36 ± 0.04 | 0.35 ± 0.10", "holdout r 0.59-0.70; peptide 0.2-0.4")
f("Volkov 2022: explicit protein-ligand interaction description gave no advantage over ligand or protein descriptors; nearest-neighbour inference from the training set performs well, so memorization dominates", VO + " (abstract, Europe PMC 35608179)", "high",
  "Simple models, inferring binding affinities of test samples from that of the closest ligands or proteins in the training set, already exhibit good performances, suggesting that memorization largely dominates true learning")
f("Volkov key numerical results (R, RMSE) could not be read: full text paywalled", "Crossref/ACS", "high", "")
f("LP-PDBBind: LP test-set RMSE (kcal/mol), original-trained vs retrained-on-LP test: Vina 2.85 vs 2.56, IGN 1.82 vs 2.16, RF-Score 1.89 vs 2.10, DeepDTA 1.34 vs 2.29; authors conclude original ML scoring functions appear to perform better than they do once leakage is controlled", LP + " (PMC13430955 Table 1)", "medium",
  "Overall the original MLSF models have seen some of the LP-PDBBind test proteins and ligands in their training, and thus they appear to perform better than they actually do", "IGN 1.82->2.16; DeepDTA 1.34->2.29")
f("LP-PDBBind, independent BDB2020+ set: retrained IGN Pearson 0.41->0.54, RF-Score 0.36->0.51, Vina 0.23->0.29, DeepDTA 0.18->0.26 (original->retrained)", LP + " (PMC13430955 Table 2)", "medium",
  "IGN 1.62 1.38± 0.09 −9~20% 0.41 0.54±0.04 RF-Score 1.80 1.61 ± 0.008 −10~11% 0.36 0.51± 0.008", "r 0.41->0.54 (IGN)")
f("PLINDER: 449,383 protein-ligand systems with leakage-minimising splits; abstract says commonly used evaluation sets suffer from leakage; demonstration model is DiffDock (poses, not affinity). No affinity numbers read", S("10.1101/2024.07.17.603955") + " (abstract, bioRxiv preprint)", "high",
  "commonly used evaluation sets suffer from training information leakage, hindering the realistic assessment of method generalization capabilities", "449,383 systems")
f("PLABench (Wang & Cheng, 2026 preprint, not peer reviewed): pretrained structure-based models best overall but with severe target-dependent variability; better structural fidelity gives no consistent gains; abstract has no numbers", S("10.64898/2026.09.17.752433") + " (abstract)", "medium",
  "increasing structural fidelity from predicted to experimental conformations yields no consistent gains", "no number")
f("Kramer 2012 noise floor: mean error 0.44 pKi, SD 0.54, median 0.34; max achievable R2 on large sets 0.81", KR + " (abstract, Europe PMC 22643060)", "high",
  "The experimental uncertainty is estimated to yield a mean error of 0.44 pK(i) units, a standard deviation of 0.54 pK(i) units, and a median error of 0.34 pK(i) units.", "0.44 pKi mean err; R2max 0.81")
f("Kramer R2 0.81 equals max Pearson r about 0.90 (own sqrt); 0.44/0.54/0.34 pKi = 0.60/0.74/0.46 kcal/mol at 298.15 K (x1.3642)", "scripts/q2-literature/calc.py", "high",
  "The maximum possible squared Pearson correlation coefficient (R2) on large data sets is estimated to be 0.81.", "r_max 0.90; 0.74 kcal/mol SD")
f("Kramer: models with errors smaller than experimental uncertainty are necessarily overtrained", KR, "high", "Models that yield errors smaller than the experimental uncertainty are necessarily overtrained.")
f("Kramer filtering: 90% of ChEMBL pairs were repeated citations of single measurements", KR, "high",
  "ChEMBL contains unit-transcription errors, undifferentiated stereoisomers, and repeated citations of single measurements (90% of all pairs).", "90% of pairs")
f("Ross 2023 summarising Kramer: RMS difference between independent measurements 0.56 pKi (0.77 kcal/mol) to 0.69 pKi (0.95 kcal/mol) depending on curation", RO + " (PMC10576784)", "high",
  "root-mean-square difference between these independent measurements ranged from 0.56 pKi units (0.77 kcal mol −1 ) to 0.69 pKi units (0.95 kcal mol −1 ) depending on how the data was curated", "0.56-0.69 pKi")
f("Brown et al. 2009 (secondhand via Ross 2023; Brown full text not read): median SD between repeat measurements 0.3 pKi (0.41 kcal/mol). Brown's own abstract has no numbers", RO + " quoting " + BR, "medium",
  "Brown et al. reported a median standard deviation between measurements of 0.3 pKi units (0.41 kcal mol)", "0.3 pKi; 0.41 kcal/mol")
f("Brown 2009 abstract: expected performance of many models is not supported by the underlying data because of neglected assay and prediction errors", BR, "high",
  "the expected performance of many models is simply not supported by the underlying data, because of often neglected effects of assay and prediction errors")
f("Landrum & Riniker 2024: IC50 pairs from different ChEMBL assays, minimal curation: ~65% differ by >0.3 log units, 27% by >1 log unit, Kendall tau 0.51", LR + " (PMC10934815)", "high",
  "almost 65% of the points differ by more than 0.3 log units, 27% differ by more than one log unit, and the correlation between the assays, as measured by Kendall's τ, is only 0.51", "65% >0.3; 27% >1; tau 0.51")
f("Landrum & Riniker: maximal curation: 48% >0.3 log, 13% >1 log, tau 0.71; Ki assays show similar noise", LR, "high",
  "48% of the points differ by more than 0.3 log units, 13% by more than one log unit, and Kendall's τ is 0.71", "48%; 13%; tau 0.71")
f("Ross 2023 Table 3: experimental pairwise RMSE 0.91 [0.83,1.11] kcal/mol (MUE 0.67) vs FEP+ pairwise RMSE 1.25 [1.17,1.33] (MUE 0.98)", RO + " (PMC10576784)", "high",
  "Pairwise RMSE (kcal mol −1 ) 0.91 [0.83, 1.11] 1.25 [1.17, 1.33] Pairwise MUE (kcal mol −1 ) 0.67 [0.61, 0.83] 0.98 [0.91, 1.05]", "exp 0.91 vs FEP+ 1.25 kcal/mol")
f("Ross 2023: with careful structure preparation FEP can reach accuracy comparable to experimental reproducibility", RO + " (abstract)", "high",
  "When careful preparation of protein and ligand structures is undertaken, FEP can achieve accuracy comparable to experimental reproducibility.")
f("Ross: one experimental assay comparison (SPR vs mass spectrometry, carbonic anhydrase) had RMSE >2.5 kcal/mol, larger than any FEP graph", RO, "high",
  "the experimental survey contains one assay comparison that has an RMSE >2.5 kcal mol −1 , which is larger than any of the errors encountered in the FEP benchmark", ">2.5 kcal/mol")
f("Wang et al. 2015 (FEP+): retrospective results over 200 ligands; lead optimisation needs about 5x accuracy in affinity. Numerical RMSE not readable (paywalled)", S("10.1021/ja512751q") + " (abstract)", "medium",
  "retrospective results encompassing 200 ligands and a wide variety of chemical perturbations", "200 ligands")
R["findings"] = F
R["table"] = [
 {"name": "CleanSplit lookup baseline (5 nearest complexes), CASF2016", "fields": "pearson_r_PDBbind=0.716; rmse_PDBbind=1.517; pearson_r_CleanSplit=0.653; rmse_CleanSplit=1.648; unit=pK (as reported)", "source": CS},
 {"name": "CleanSplit-trained models, CASF2016", "fields": "GEMS r=0.803 rmse=1.308; GenScore r=0.780 rmse=1.362; Pafnucy r=0.746 rmse=1.484", "source": CS},
 {"name": "CleanSplit train-test overlap", "fields": "similar_pairs=~600; casf_complexes_affected=49%; train_removed=4%", "source": CS},
 {"name": "Durant ToolBoxSF, CASF2016 Pearson r", "fields": "LigandBias=0.76; ProteinBias=0.75; BothBias=0.85; RFScore=0.82; PointVS=0.79; Pafnucy=0.74; SIGN=0.82; OnionNet2=0.82; Smina=0.59", "source": DU},
 {"name": "Durant, 2019 Holdout / Peptides Holdout Pearson r", "fields": "LigandBias=0.59/0.23; BothBias=0.67/0.35; OnionNet2=0.70/0.36; Pafnucy=0.60/0.37; Smina=0.36/0.19", "source": DU},
 {"name": "LP-PDBBind LP-test RMSE kcal/mol (original-trained / retrained)", "fields": "Vina=2.85/2.56; IGN=1.82/2.16; RFScore=1.89/2.10; DeepDTA=1.34/2.29", "source": LP},
 {"name": "LP-PDBBind BDB2020+ Pearson r (original -> retrained)", "fields": "Vina=0.23->0.29; IGN=0.41->0.54; RFScore=0.36->0.51; DeepDTA=0.18->0.26", "source": LP},
 {"name": "Kramer 2012 ChEMBL Ki noise", "fields": "mean_err=0.44 pKi; sd=0.54 pKi; median_err=0.34 pKi; max_R2=0.81; max_r=0.90 (calc); sd_in_kcal=0.74 (calc)", "source": KR},
 {"name": "Landrum-Riniker 2024 cross-assay IC50 noise", "fields": "minimal curation: frac>0.3log=65%; frac>1log=27%; tau=0.51 | maximal: 48%; 13%; tau=0.71", "source": LR},
 {"name": "Ross 2023 experimental vs FEP+ (pairwise relative)", "fields": "exp_RMSE=0.91 kcal/mol; FEP+_RMSE=1.25 kcal/mol; exp_MUE=0.67; FEP+_MUE=0.98", "source": RO},
 {"name": "Brown 2009 repeat-measurement SD (secondhand via Ross)", "fields": "median_sd=0.3 pKi (0.41 kcal/mol)", "source": RO},
]
R["key_claims"] = [
 {"claim": "Train-test leakage between PDBbind and CASF is large: ~600 similar pairs, 49% of CASF complexes", "source": CS, "evidence_quote": F[0]["evidence_quote"]},
 {"claim": "A label-lookup baseline with no physics gets CASF2016 Pearson 0.716 on PDBbind and 0.653 on CleanSplit", "source": CS, "evidence_quote": F[3]["evidence_quote"]},
 {"claim": "Ligand-only and protein-only bias models match published ML scoring functions on CASF2016 (r 0.76/0.75 vs 0.74-0.82)", "source": DU + " ; PMC11821266 Table 1", "evidence_quote": F[7]["evidence_quote"]},
 {"claim": "Noise floor for heterogeneous Ki: mean error 0.44 pKi, SD 0.54, max R2 0.81 (Kramer 2012); cross-assay IC50 Kendall tau only 0.51 (Landrum 2024)", "source": KR + " ; " + LR, "evidence_quote": "The maximum possible squared Pearson correlation coefficient (R2) on large data sets is estimated to be 0.81."},
]
D = "D:/Users/ashenoy00000/delphi-work/"
R["reproduce"] = [
 {"what": "Resolve DOIs (Crossref + arXiv)", "command_or_url": "python " + D + "agents2/scripts/q2-literature/search.py \"<paper title>\"", "expected": "Python 3.14 stdlib only; returns DOIs listed in citations"},
 {"what": "Abstracts via Europe PMC", "command_or_url": "python epmc.py 10.1021/jm300131x 10.1021/acs.jmedchem.2c00487 (same folder)", "expected": "Kramer 0.44/0.54/0.34 pKi and R2 0.81; Volkov 'memorization largely dominates'"},
 {"what": "Download full texts to " + D + "data/q2-literature/", "command_or_url": "python fetchpmc.py PMC12552120 PMC11821266 PMC10934815 PMC10576784 ; LP-PDBBind: curl 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=PMC13430955&retmode=xml' (Europe PMC returned HTTP 500 for this one)", "expected": "sha256: PMC12552120 8ceecb15...ece662; PMC11821266 addf858c...739349; PMC10934815 dcce5b03...ac3e; PMC10576784 f371d2e3...ebb1d; PMC13430955 8a30474e...53625 (full hashes in scratch/q2-literature/fetchlog.txt and sha256sum of the files)"},
 {"what": "Extract Durant Table 1", "command_or_url": "python extract_durant.py", "expected": "LigandBias | 0.76 | 0.59 | 0.23 | 0.08 etc."},
 {"what": "Arithmetic", "command_or_url": "python calc.py", "expected": "1.3642 kcal/mol per pK; r ceiling 0.900; 0.44 pKi = 0.60 kcal/mol"},
]
cit = []
HOW = "Crossref works API returned matching title/DOI/authors on 2026-11-12; abstract (and full text where noted) read via Europe PMC/PMC"
def c(a, y, t, d, u, v):
    cit.append(dict(authors=a, year=y, title=t, doi_or_arxiv=d, verified=True, used_for=u, venue=v, how_verified=HOW))
c("Graber, Stockinger, Meyer et al.", 2025, "Resolving data bias improves generalization in binding affinity prediction", "10.1038/s42256-025-01124-5", "CleanSplit leakage numbers", "Nature Machine Intelligence")
c("Durant, Boyles, Birchall et al.", 2025, "Robustly interrogating machine learning-based scoring functions: what are they learning?", "10.1093/bioinformatics/btaf040", "ligand/protein-only baselines", "Bioinformatics")
c("Volkov, Turk, Drizard, Martin, Hoffmann, Gaston-Mathe, Rognan", 2022, "On the Frustration to Predict Binding Affinities from Protein-Ligand Structures with Deep Neural Networks", "10.1021/acs.jmedchem.2c00487", "memorization finding (abstract only)", "J Med Chem")
c("Li, Guan, Zhang et al.", 2026, "Leak Proof PDBBind: A Reorganized Data Set of Protein-Ligand Complexes for More Generalizable Binding Affinity Prediction", "10.1021/acs.jpcb.5c08598", "LP-PDBBind retraining", "J Phys Chem B")
c("Durairaj, Adeshina, Cao et al.", 2024, "PLINDER: The protein-ligand interactions dataset and evaluation resource", "10.1101/2024.07.17.603955", "PLINDER (preprint, abstract)", "bioRxiv")
c("Wang, Cheng", 2026, "Leakage-controlled benchmarking reveals generalization limits of deep learning for protein-ligand binding affinity prediction", "10.64898/2026.09.17.752433", "PLABench (preprint, abstract)", "preprint")
c("Kramer, Kalliokoski, Gedeck, Vulpetti", 2012, "The Experimental Uncertainty of Heterogeneous Public Ki Data", "10.1021/jm300131x", "noise floor (abstract)", "J Med Chem")
c("Brown, Muchmore, Hajduk", 2009, "Healthy skepticism: assessing realistic model performance", "10.1016/j.drudis.2009.01.012", "assay-error argument (abstract)", "Drug Discovery Today")
c("Landrum, Riniker", 2024, "Combining IC50 or Ki Values from Different Sources Is a Source of Significant Noise", "10.1021/acs.jcim.4c00049", "cross-assay noise", "J Chem Inf Model")
c("Ross, Lu, Scarabelli et al.", 2023, "The maximal and current accuracy of rigorous protein-ligand binding free energy calculations", "10.1038/s42004-023-01019-9", "FEP vs experimental accuracy", "Communications Chemistry")
c("Wang, Wu, Deng, Kim et al.", 2015, "Accurate and Reliable Prediction of Relative Ligand Binding Potency in Prospective Drug Discovery by Way of a Modern Free-Energy Calculation Protocol and Force Field", "10.1021/ja512751q", "FEP+ (abstract only)", "J Am Chem Soc")
R["citations"] = cit
R["could_not_find"] = [
 "Durant et al. 2024 PLINDER-era affinity results, and any further Durant work beyond ToolBoxSF (Bioinformatics 2025): not located or not read.",
 "Volkov 2022 R and RMSE values: full text paywalled; only abstract used.",
 "Pafnucy and GenScore CASF2016 before/after CleanSplit values: shown only in Fig. 3 of Graber et al.; not read.",
 "Kramer 2012, Brown 2009 and Wang 2015 full texts (paywalled). Brown's 0.3 pKi median SD is secondhand through Ross 2023. Wang 2015 FEP+ RMSE not verified (any figure from memory is unverified background and not used).",
 "PLINDER affinity numbers and PLABench numeric results: abstracts contain none; full texts not fetched.",
 "Other 2024-2026 benchmark papers (OOD affinity benchmarks, co-folding affinity heads) were not searched exhaustively; OpenAlex avoided as instructed.",
 "Kramer's R2 ceiling 0.81 applies to large ChEMBL Ki sets; a PDBbind/CASF-specific ceiling was not computed because PDBbind label SD was not downloaded.",
]
R["recommendations"] = [
 "Lean statement: with label-noise variance se2 and label variance sy2, Pearson r <= sqrt(1 - se2/sy2). Kramer's R2max 0.81 with se 0.54 pKi implies sy about 1.24 pKi (own arithmetic: 0.54^2/0.19 = 1.535, sqrt 1.24); test on public PDBbind/CASF labels once downloaded.",
 "Formalise the label-lookup baseline as a model class; the CASF2016 r of 0.716 (PDBbind) vs 0.653 (CleanSplit) is a ready public test of the leakage statement.",
 "Keep the noise estimates separate: Kramer (cross-lab ChEMBL Ki, SD 0.54 pKi), Brown (internal repeats, median SD 0.3 pKi, secondhand) and Ross (pairwise relative RMSE 0.91 kcal/mol) measure different things.",
]
json.dump(R, open(D + "agents2/q2-literature.json", "w"), indent=1, ensure_ascii=False)
print("ok", len(F))
