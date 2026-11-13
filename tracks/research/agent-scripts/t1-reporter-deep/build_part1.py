# Part 1: findings. Imported by build_json.py.
DOI = lambda d: "https://doi.org/" + d
UCF = "https://raw.githubusercontent.com/CIDARLAB/Cello-v2-1-Core/main/library/constraints/"
F = []


def f(claim, source, conf, quote="", value=""):
    F.append(dict(claim=claim, source=source, confidence=conf, evidence_quote=quote, value=value))


# ---- Gate design and RBS tuning
f("Cello NOT/NOR repressor gates are built so that the only handle for tuning each gate's repressor level is the RBS; the input promoter is fixed so inputs can be swapped.",
  DOI("10.1038/nchembio.1411") + " (PMC4165527 full text)", "high",
  "we define the beginning of each gate to be the transcription start site and vary the repressor level by changing the strength of the RBS.")
f("In Stanton et al. the RBS of each repressor was chosen by screening an RBS library and keeping the variant with the highest dynamic range (a selection step; RBS libraries built for 19 of 20 gates).",
  DOI("10.1038/nchembio.1411"), "high",
  "These libraries were screened and the RBS that produced the highest dynamic range was selected")
f("Stanton et al. fit every gate response to a Hill function and define K as the input at which output is half-maximal.",
  DOI("10.1038/nchembio.1411"), "high",
  "K is the threshold level of input where the output is half-maximal.")
f("Cooperativity of most TetR-family gates is about 2, consistent with dimers binding one operator; five repressors gave n > 3, the largest 6.1 (Orf2).",
  DOI("10.1038/nchembio.1411"), "high",
  "The cooperativity for the majority of gates is n ≈ 2, which is consistent with that measured for TetR, and a mechanism of dimers binding to a single operator",
  "n about 2 (most); max 6.1")
f("16 of 73 mined TetR-family repressors were orthogonal and repressed their cognate promoter 5- to 207-fold.",
  DOI("10.1038/nchembio.1411"), "high",
  "16 were identified that both strongly repress their cognate promoter (5- to 207-fold) and exhibit minimal interactions with other promoters.",
  "16 of 73; 5-207 fold")
f("Brophy and Voigt (review): a stronger or weaker RBS changes the threshold of a gate; multiple operators or operator position are other threshold knobs.",
  DOI("10.1038/nmeth.2926") + " (PMC4230274 full text)", "high",
  "Selecting a stronger or weaker RBS, adding multiple operators, or changing operator positions within the repressible promoter can change the threshold")
f("Brophy and Voigt define a gate response by three parameters: dynamic range, threshold, cooperativity.",
  DOI("10.1038/nmeth.2926"), "high",
  "the amount of input required to reach the half-maximum output (also referred to as the threshold), and 3. cooperativity of the switch")
f("Brophy and Voigt: threshold mismatches between connected gates can be corrected by parts (for example mutated RBSs) that shift individual gate thresholds.",
  DOI("10.1038/nmeth.2926"), "high",
  "Connectivity mismatches can be corrected by selecting parts that shift the thresholds of individual gates.")
f("Cello 1 (Nielsen 2016) designed 60 E. coli circuits; 45 worked in every output state and 92% of all output states matched prediction.",
  DOI("10.1126/science.aac7341") + " (abstract via Europe PMC)", "high",
  "Of these, 45 circuits performed correctly in every output state (up to 10 regulators and 55 parts), and across all circuits 92% of the output states functioned as predicted.",
  "60 circuits; 45 perfect; 92% of states")
f("Yeast Cello gates (Chen 2020): nine NOT/NOR gates with near-identical response functions and 400-fold dynamic range.",
  DOI("10.1038/s41564-020-0757-2"), "high",
  "we constructed nine NOT/NOR gates with nearly identical response functions and 400-fold dynamic range.")
f("The Bacteroides thetaiotaomicron Cello library is based on dCas9 sgRNA NOT/NOR gates, not protein repressors with RBS tuning, so it cannot test an RBS law.",
  DOI("10.1038/s41587-020-0468-5"), "medium",
  "we characterize a set of genome-integrated NOT/NOR gates based on single guide RNAs (CRISPR-dCas9) to inform a Bt user constraint file (UCF) for Cello.")
f("Relative Promoter Unit (RPU): activity relative to reference promoter BBa_J23101; cut variation across labs and instruments by about 50%. It is the unit of x and y in Cello Hill fits.",
  DOI("10.1186/1754-1611-3-4"), "high",
  "We defined a Relative Promoter Unit (RPU) in order to report promoter characterization data in compatible units",
  "about 50% variation reduction")

# ---- Translation initiation physics
f("Shine and Dalgarno (1974) showed the 3' end of E. coli 16S rRNA can pair with a conserved sequence in ribosome binding sites; this is the physical basis of an RBS.",
  DOI("10.1073/pnas.71.4.1342"), "high",
  "The sequence A-C-C-U-C-C could recognize a conserved sequence found in the ribosome binding sites of various coliphage mRNAs")
f("The RBS Calculator predicts protein output from RBS sequence on a proportional scale; over 100 predictions were accurate within a factor of 2.3 across a 100,000-fold range.",
  DOI("10.1038/nbt.1568") + " (PMC2782888 full text)", "high",
  "Experimental validation of over 100 predictions in Escherichia coli shows that the method is accurate to within a factor of 2.3 over a range of 100,000-fold.",
  "2.3-fold error; 1e5-fold range")
f("The same RBS sequence in a different genetic context can give a different expression level (context dependence of an RBS change).",
  DOI("10.1038/nbt.1568"), "high",
  "The design method also correctly predicts that reusing a ribosome binding site sequence in different genetic contexts can result in different protein expression levels.")
f("Translation initiation rate relates to ribosome-mRNA binding free energy by a log-linear formula, fluorescence tracked initiation rate in steady-state growth, and 5' structure/standby sites modulate initiation over 100-fold.",
  DOI("10.1093/nar/gkt1139") + " (PMC3936740 full text)", "high",
  "fluorescence levels are proportional to translation initiation rates under our controlled growth conditions",
  "over 100-fold")
f("Bicistronic-design translation elements gave arbitrary genes expression within twofold of target about 93% of the time (1000-fold range): RBS context dependence can be engineered down.",
  DOI("10.1038/nmeth.2404"), "high",
  "arbitrary genes are reliably expressed to within twofold relative target expression windows with ∼93% reliability.",
  "93% within 2-fold")
f("In a 12,563-construct promoter x RBS library, protein was within twofold of a simple multiplicative model 64% of the time (RNA 80%) but the worst 5% deviated 13-fold on average. Promoter and RBS effects are close to, not exactly, separable.",
  DOI("10.1073/pnas.1301301110"), "high",
  "RNA and protein expression were within twofold of expected levels 80% and 64% of the time, respectively.",
  "64% / 80% within 2-fold; worst 5%: 13-fold")
f("Kosuri: translation rate affects mRNA stability, so an RBS change can alter transcript level as well as translation.",
  DOI("10.1073/pnas.1301301110"), "high",
  "The large dataset allowed quantitation of global effects, such as translation rate on mRNA stability and mRNA secondary structure on translation rate.")

# ---- Hill function, ultrasensitivity, noise
f("The Hill coefficient is an 'interaction' coefficient, not a count of binding sites, except under marked positive cooperativity; the Hill equation is not a physical reaction scheme for multi-site binding.",
  DOI("10.1096/fasebj.11.11.9285481"), "high",
  "only under the very specific condition of marked positive cooperativity does the Hill coefficient accurately estimate the number of binding sites.")
f("Hill form Output = Input^n/(K^n + Input^n); hemoglobin has an apparent Hill coefficient of 2.7 (textbook sigmoid).",
  DOI("10.1016/j.tibs.2014.08.003") + " (PMC4214216 full text)", "high",
  "in reality the binding curve is sigmoidal with an apparent Hill coefficient of 2.7", "n=2.7")
f("Goldbeter and Koshland 1981: covalent-modification cycles operated away from first-order kinetics give amplification equivalent to allosteric proteins with high Hill coefficients (a way to get steepness without cooperative binding).",
  DOI("10.1073/pnas.78.11.6840"), "high",
  "This amplification of the response to a stimulus can provide additional sensitivity in biological control, equivalent to that of allosteric proteins with high Hill coefficients.")
f("Repressor titration by competing binding sites both shifts and sharpens the transition of a regulated gene against repressor copy number: a mechanism coupling threshold and steepness (counter to separability).",
  DOI("10.1016/j.cell.2014.02.022") + " (PMC4080642 full text)", "medium",
  "The stronger binding sites shift and sharpen the transition of the gene of interest with respect to LacI copy number.")
f("The gene regulation function fluctuates in single cells, limiting signal transfer accuracy: a population Hill curve hides single-cell variation.",
  DOI("10.1126/science.1106914"), "high",
  "fluctuates dynamically in individual living cells, thereby limiting the accuracy with which transcriptional genetic circuits can transfer signals.")
f("Noise in a gene has intrinsic, upstream-transmitted and global parts, so output noise is not fixed by the mean transfer curve.",
  DOI("10.1126/science.1109090"), "high",
  "noise in a gene was determined by its intrinsic fluctuations, transmitted noise from upstream genes, and global noise affecting all genes.")
f("Early synthetic circuits: the toggle switch showed a 'nearly ideal switching threshold'.",
  DOI("10.1038/35002131"), "high", "exhibits a nearly ideal switching threshold.")
f("Repressilator (three repressors) oscillated with periods of hours, slower than the cell cycle.",
  DOI("10.1038/35002125"), "high",
  "The resulting oscillations, with typical periods of hours, are slower than the cell-division cycle")
f("Directed evolution turned a non-functional circuit with mismatched components into a functional one and produced a library of devices with a range of behaviours.",
  DOI("10.1073/pnas.252535999"), "high",
  "a nonfunctional circuit containing improperly matched components can evolve rapidly into a functional one.")
f("Combinatorial promoter libraries (288 promoters, up to 3 TF inputs) spanned five decades of promoter strength.",
  DOI("10.1038/msb4100187"), "high", "we observed varied promoter strength over five decades.")
f("The PLtetO-1 promoter regulated expression over up to 5000-fold with aTc, an early well-controlled inducible input.",
  DOI("10.1093/nar/25.6.1203"), "high",
  "The novel promoter PLtetO-1 allows the regulation of gene expression over an up to 5000-fold range with anhydrotetracycline (aTc)")

# ---- Measurements made in this run
f("The Cello UCF response function is the four-parameter Hill form with linear input composition x = x1 + x2.",
  UCF + "Eco1C1G1T1.UCF.json (functions collection)", "high", "ymin + (ymax - ymin) / (1.0 + (x / K)^n)")
f("Each Eco1C1G1T1 gate cassette is [ribozyme insulator, RBS, repressor CDS, terminator]; for A1_AmtR: BydvJ, A1, AmtR, L3S2P55. Variant names (A1, B1..B3, P1..P3, Q1, Q2, S1..S4) are RBS parts, so RBS-only variants can be tested from the part list.",
  UCF + "Eco1C1G1T1.UCF.json (structures and parts collections)", "high",
  '"name": "A1_AmtR_cassette", "components": [ "BydvJ", "A1", "AmtR", "L3S2P55" ]')
f("Eco1C1G1T1 is a library of TetR homologs.",
  UCF + "Eco1C1G1T1.UCF.json (header)", "high",
  "TetR homologs: PhlF, SrpR, BM3R1, HlyIIR, BetI, AmtR, AmeR, QacR, IcaRA, LitR, PsrA, LmrA")
f("Eco1C1G1T1: 20 gates, shipped n 1.4 to 4.2, K 0.01 to 0.41 RPU (41-fold span of thresholds across gates).",
  "computed: scripts/t1-reporter-deep/pairs.py on data/t1-deep/Eco1C1G1T1.UCF.json (sha256 c702d6b9...)", "high", "", "n 1.4-4.2; K 0.01-0.41 RPU")
f("Eco1C1G1T1 same-regulator pairs: 13 pairs; 10 differ in exactly one cassette position that is an RBS; 3 (all S1_SrpR vs S2/S3/S4) differ in RBS and terminator (ECK120019600 vs ECK120029600). Of the 10, 6 move K by at least 2-fold (in scope). Max relative n difference dn = |n1-n2|/mean(n) over all 13 = 0.1587 (BM3R1 B1/B2 and B2/B3, n 3.4 vs 2.9).",
  "computed: pairs.py -> scratch/t1-reporter-deep/pairs.json", "high", "", "13 / 10 / 6; max dn 0.1587")
f("Eco1C2G2T2: all 13 same-regulator pairs differ at one RBS position; 9 have Kfold >= 2; max dn among those 9 is 0.2836 (BM3R1 B1/B2, Kfold 10.34); over all 13 the max is 0.2911 (PhlF P2/P3, Kfold 1.76, out of scope). One in-scope pair exceeds 0.25.",
  "computed: pairs.py", "high", "", "9 in scope; max dn 0.2836")
f("Eco2C1G5T1 (phage repressors): 5 in-scope RBS pairs, max dn 0.2124 (933W R8/R9, Kfold 2.70); Kfold up to 14.8 (P2 R13/R15, dn 0.053).",
  "computed: pairs.py", "high", "", "max dn 0.2124")
f("SC1C1G1T1 (yeast): only 1 pair is a one-position translation-initiation change (LexA Kozak24 vs Kozak14, Kfold 2.33, dn 0.2604). The CI and CI434 pairs have identical cassettes yet dn 0.397 and 0.015, so they differ outside the cassette and do not test translation alone.",
  "computed: pairs.py", "high", "", "n=1 pair; dn 0.2604")
f("Eco2C1G3T1 has 6 gates and no same-regulator pair, so it cannot test an RBS law.", "computed: pairs.py", "high")
f("Refit of Hill parameters from the shipped 12 x 250-bin cytometry histograms (median of each histogram, log10 least squares, 4 free parameters) reproduces the shipped values for Eco1C1G1T1: Pearson r of n = 0.977, of log K = 0.903; max refit dn over 6 in-scope pairs = 0.1153.",
  "computed: refit.py -> refit_linear.json, refit_soft_l1.json", "high", "", "r(n)=0.977; max dn 0.115")
f("The same refit on Eco1C2G2T2 depends on the loss. Plain least squares gives r(n)=0.70 and max dn 1.13 because one input level (x=0.0697 in S2_SrpR) is listed out of order with an output that belongs with the highest inputs. A robust soft-L1 fit gives r(n)=0.919, r(logK)=0.987, but max refit dn 0.4254 (S1/S4 SrpR) with 3 of 9 pairs above 0.25, against 0.2836 maximum from shipped parameters. Steepness invariance in Eco1C2G2T2 is therefore fit-dependent; no ground truth was found to decide.",
  "computed: refit.py linear and soft_l1", "medium", "", "shipped max dn 0.2836; robust refit max 0.4254")
f("Inside in-scope RBS pairs, shipped ymax changes by a median 1.11x (max 1.74x) in Eco1C1G1T1 and 1.20x (max 2.32x) in Eco1C2G2T2; shipped ymin by a median 2.17x (max 3.00x) and 1.49x (max 3.21x). An RBS change is therefore not a pure shift of the whole curve: floor and ceiling move too.",
  "computed: translation_law.py part 2", "high", "", "ymax med 1.11/1.20; ymin med 2.17/1.49")
f("Shipped parameters are rounded (n to 2 significant figures, K sometimes 0.01), so small dn and large K folds at low K are quantisation-limited; refit K folds are often smaller than shipped ones (BM3R1 B1/B3 shipped 6.5, refit 3.06).",
  "computed: pairs.py versus refit.py", "high", "", "B1/B3 Kfold 6.5 vs 3.06")
f("If repressor level is R = c*x (c = RBS translation multiplier) and promoter output is a Hill function of R, then y_c(x) = y_1(c*x): K = K_R/c with n, ymax and ymin unchanged. Numerical check: fitted K = K0/c and n = 2.8 for c = 0.25, 2, 10.",
  "derived and numerically checked: translation_law.py part 1", "high", "", "K -> K/c, n fixed")

# ---- Law library
f("In law set 1.8.1 (59 laws) the only gene-regulation law is the placeholder gene-regulatory-dynamics v1.0.0 (status proposed, class gap, no Lean module or theorem).",
  "lean/registry/lawsets/lawset-1.8.1.json ; lean/registry/laws/gene-regulatory-dynamics.json", "high",
  '"label": "Gene regulatory dynamics (not formalised)"')
f("The repo states that the Hill equation is not formalised; Altitude.lean uses only monotonicity of a Hill curve. No Lean file in lean/Delphi is named for Hill, reporter or gene regulation.",
  "lean/laws.json line 842; lean/Delphi/Altitude.lean lines 36-37", "high",
  "Arterial content nondecreasing in partial pressure (a Hill curve is, but the Hill equation, the Bohr shift and the Root effect are not formalised).")
