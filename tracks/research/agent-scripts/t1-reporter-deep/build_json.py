# Assemble agents2/t1-reporter-deep.json and check that every evidence_quote appears verbatim in a fetched source.
# Run: python build_json.py   (after verify_dois.py, fetch_epmc.py, pairs.py, refit.py, translation_law.py and the efetch downloads)
import sys, json, re, glob, os, hashlib
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_part1 import F, DOI

AG = "D:/Users/ashenoy00000/delphi-work/agents2/"
SC = AG + "scratch/t1-reporter-deep/"
DATA = "D:/Users/ashenoy00000/delphi-work/data/t1-deep/"
LEAN = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/"

# ---------- corpus for the verbatim check
def norm(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&")
    return re.sub(r"\s+", " ", s)
corpus = []
for p in glob.glob(SC + "*.xml"):
    corpus.append(norm(open(p, encoding="utf-8").read()))
epmc = json.load(open(SC + "epmc.json"))
corpus.append(norm(" ".join(v["abstract"] for v in epmc.values())))
for p in glob.glob(DATA + "*.UCF.json"):
    corpus.append(norm(open(p, encoding="utf-8").read()))
for p in (LEAN + "laws.json", LEAN + "registry/laws/gene-regulatory-dynamics.json", LEAN + "Delphi/Altitude.lean"):
    corpus.append(norm(open(p, encoding="utf-8").read()))
big = "\n".join(corpus)
bad = []
for x in F:
    q = x["evidence_quote"]
    if not q:
        continue
    nq = norm(q)
    if len(nq.split()) > 40:
        bad.append(("too long", nq[:60]))
    # UCF JSON has escaped quotes; compare also with escapes
    if nq not in big and nq.replace('"', '\\"') not in big and norm(nq.replace("’", "'")) not in big:
        bad.append(("not found", nq[:80]))
print("quote problems:", bad)

# ---------- citations from Crossref record
cr = json.load(open(SC + "crossref.json"))
use = {
 "10.1126/science.aac7341": "Cello design automation; E. coli gate libraries (Eco1C1G1T1 etc.) and 92% output states",
 "10.1038/nbt.1568": "RBS Calculator: RBS sequence to expression on a proportional scale; context dependence",
 "10.1038/nmeth.2404": "Bicistronic translation elements; reliability of RBS-defined expression",
 "10.1038/nchembio.1411": "Origin of the TetR-homolog NOT gates; RBS tuned to set repressor level; Hill fits, n about 2",
 "10.1073/pnas.1301301110": "Promoter x RBS composability at 12,563 constructs; limits of separability",
 "10.1016/j.tibs.2014.08.003": "Review: Hill function and ultrasensitivity",
 "10.1096/fasebj.11.11.9285481": "Review: what the Hill coefficient does and does not mean",
 "10.1073/pnas.78.11.6840": "Zero-order ultrasensitivity (alternative route to steepness)",
 "10.1038/35002125": "Repressilator",
 "10.1038/35002131": "Toggle switch",
 "10.1073/pnas.252535999": "Directed evolution of circuit parameters",
 "10.1126/science.1106914": "Single-cell gene regulation function and its fluctuation",
 "10.1038/msb4100187": "Combinatorial promoter library, five decades of strength",
 "10.1038/nmeth.2926": "Review of circuit design principles and tuning knobs (RBS shifts threshold)",
 "10.1186/1754-1611-3-4": "RPU unit used for Cello x and y",
 "10.1038/s41564-020-0757-2": "Yeast Cello gates (SC1C1G1T1 library)",
 "10.1038/s41587-020-0468-5": "Bacteroides Cello library (sgRNA gates; excluded as RBS test)",
 "10.1038/s41596-021-00675-2": "Cello 2.0 protocol (UCF format)",
 "10.1093/nar/gkt1139": "Biophysical model of translation initiation rate",
 "10.1073/pnas.71.4.1342": "Shine-Dalgarno: ribosome binding site pairing",
 "10.1016/j.cell.2014.02.022": "Repressor titration shifts and sharpens transitions",
 "10.1093/nar/25.6.1203": "PLtetO-1 inducible promoter, 5000-fold range",
 "10.1126/science.1109090": "Noise propagation in gene networks",
}
cites = []
for d, u in use.items():
    r = cr[d]
    assert r["ok"], d
    cites.append(dict(authors=", ".join(r["authors"][:3]) + (" et al." if len(r["authors"]) > 3 else ""),
                      year=r["year"], title=re.sub(r"\s+", " ", re.sub("<[^>]+>", "", r["title"])).strip(),
                      doi_or_arxiv=d, verified=True, venue=r["container"], used_for=u,
                      how_verified="Crossref API https://api.crossref.org/works/%s fetched 2026-11-12 (title, year, journal matched); abstract via Europe PMC REST search DOI query%s"
                      % (d, "; full text read via NCBI efetch" if d in ("10.1038/nchembio.1411", "10.1038/nmeth.2926", "10.1038/nbt.1568", "10.1093/nar/gkt1139", "10.1016/j.cell.2014.02.022", "10.1016/j.tibs.2014.08.003", "10.1038/msb4100187") else " (abstract only; full text not retrieved)")))

# ---------- table rows
UCFU = "https://raw.githubusercontent.com/CIDARLAB/Cello-v2-1-Core/main/library/constraints/"
pairs = json.load(open(SC + "pairs.json"))
table = []
for L, note in (("Eco1C1G1T1", "E. coli, TetR homologs, calibration"), ("Eco1C2G2T2", "E. coli, second set"), ("Eco2C1G3T1", "E. coli, no same-regulator pair"), ("Eco2C1G5T1", "E. coli, phage repressors"), ("SC1C1G1T1", "S. cerevisiae")):
    p = pairs[L]
    table.append(dict(name="UCF library " + L + " (" + note + ")",
                      fields="gates=%d; same_regulator_pairs=%d; one_position_RBS_pairs=%d; in_scope_pairs_Kfold>=2=%d; max_dn_in_scope=%s (relative n difference, unitless); n_range=%.2f-%.2f; K_range_RPU=%.3f-%.3f"
                      % (p["n_gates"], p["n_same_regulator_pairs"], p["n_one_position_rbs"], p["n_inscope"], p["max_dn_inscope"], p["n_range"][0], p["n_range"][1], p["K_range"][0], p["K_range"][1]),
                      source=UCFU + L + ".UCF.json"))
for L in ("Eco1C1G1T1", "Eco1C2G2T2", "Eco2C1G5T1", "SC1C1G1T1"):
    for q in pairs[L]["pairs"]:
        if q["kind"] == "one-position" and q["diff_types"] == ["rbs"]:
            table.append(dict(name="%s pair %s vs %s" % (L, q["a"], q["b"]),
                              fields="K_a=%s RPU; K_b=%s RPU; Kfold=%s; n_a=%s; n_b=%s; dn=%s; S=log2(Kfold)/dn=%s; differing_parts=%s"
                              % (q["Ka"], q["Kb"], q["Kfold"], q["na"], q["nb"], q["dn"], q["S"], q["diff_parts"]),
                              source=UCFU + L + ".UCF.json"))
table += [
 dict(name="Refit vs shipped, Eco1C1G1T1 (20 gates, least squares)", fields="r_n=0.977; r_logK=0.903; max_dn_in_scope_refit=0.1153; max_dn_in_scope_shipped=0.1587", source="scratch/t1-reporter-deep/refit_linear.json (computed by refit.py)"),
 dict(name="Refit vs shipped, Eco1C2G2T2 (18 gates, soft-L1 loss)", fields="r_n=0.919; r_logK=0.987; max_dn_in_scope_refit=0.4254; max_dn_in_scope_shipped=0.2836; pairs_above_0.25_refit=3 of 9", source="scratch/t1-reporter-deep/refit_soft_l1.json (computed by refit.py soft_l1)"),
 dict(name="Refit vs shipped, Eco1C2G2T2 (plain least squares)", fields="r_n=0.701; r_logK=0.707; max_dn_in_scope_refit=1.1258 (driven by one out-of-order input level)", source="scratch/t1-reporter-deep/refit_linear.json"),
 dict(name="Refit vs shipped, SC1C1G1T1 (yeast)", fields="r_n=0.504; r_logK=0.822; LexA pair dn_refit=0.2316 vs 0.2604 shipped", source="scratch/t1-reporter-deep/refit_linear.json"),
 dict(name="ymax/ymin change within in-scope RBS pairs", fields="Eco1C1G1T1: ymax_ratio_median=1.11, max=1.74; ymin_ratio_median=2.17, max=3.00 | Eco1C2G2T2: ymax_median=1.20, max=2.32; ymin_median=1.49, max=3.21", source="computed by translation_law.py"),
 dict(name="RBS Calculator accuracy (Salis 2009)", fields="error_factor=2.3; range=100000-fold; validation_predictions>100", source=DOI("10.1038/nbt.1568")),
 dict(name="Promoter x RBS composability (Kosuri 2013)", fields="constructs=12563; protein_within_2fold=64%; RNA_within_2fold=80%; worst_5pct_deviation=13-fold", source=DOI("10.1073/pnas.1301301110")),
 dict(name="Bicistronic elements (Mutalik 2013)", fields="dynamic_range=1000-fold; within_2fold_of_target=93%", source=DOI("10.1038/nmeth.2404")),
 dict(name="TetR-homolog repressor library (Stanton 2014)", fields="repressors_mined=73; orthogonal=16; repression=5-207 fold; typical_n=2; max_n=6.1 (Orf2)", source=DOI("10.1038/nchembio.1411")),
 dict(name="Cello 1 circuits (Nielsen 2016)", fields="circuits=60; fully_correct=45; output_states_correct=92%", source=DOI("10.1126/science.aac7341")),
 dict(name="Timeline of key experiments", fields="1974 Shine-Dalgarno RBS pairing; 1981 Goldbeter-Koshland; 1997 PLtetO-1, Hill misuse (Weiss); 2000 toggle and repressilator; 2002 directed evolution of a circuit; 2005 single-cell GRF and noise propagation; 2007 combinatorial promoters; 2009 RBS Calculator and RPU; 2013 BCD, composability, TetR-homolog gates; 2014 Brophy-Voigt review, titration effect; 2016 Cello; 2020 yeast and Bacteroides Cello; 2022 Cello 2.0 protocol", source="see citations (all Crossref-verified)"),
]

summary = """STATE OF THE ART, built from the ground up. Each step is tagged [measured], [derived] or [assumed].

1. A gene is read in two steps. DNA is copied into messenger RNA (transcription) and the ribosome reads the RNA to make protein (translation). A ribosome binding site (RBS), the stretch of RNA just before the protein-coding part, controls how often ribosomes start. [measured] Shine and Dalgarno 1974 showed the ribosomal RNA end can pair with a conserved sequence in ribosome binding sites. Salis 2009: a model of RBS sequence predicted protein output within a factor of 2.3 over a 100,000-fold range for more than 100 designs; Espah Borujeni 2014: initiation rate follows binding free energy log-linearly and 5' structure moves it over 100-fold.

2. A repressor gate. A repressor protein sits on a promoter and blocks transcription of a reporter. More input promoter activity makes more repressor, so reporter output falls. [measured] The shipped curves (Cello UCF files) have the form y = ymin + (ymax - ymin)/(1 + (x/K)^n), x and y in relative promoter units (RPU, a ratio to promoter BBa_J23101). K is the input giving half-maximum output (the threshold); n is the steepness; ymax and ymin are the ON and OFF levels.

3. What n means. [derived/contested] The Hill form is a curve fit. Weiss 1997: the exponent is an interaction coefficient and equals the binding-site count only under strong cooperativity. TetR-family gates mostly show n about 2 (a dimer on one operator); some show n up to 6.1 [measured, Stanton 2014]. Steeper responses can also come from other mechanisms such as zero-order ultrasensitivity (Goldbeter-Koshland 1981) or repressor titration (Brewster 2014), which couple position and steepness.

4. Why an RBS change should move K but not n. [assumed] Repressor level R is proportional to (input promoter activity x) times (a translation multiplier c set by the RBS); promoter occupancy is a Hill function of R; dilution and degradation are linear; nothing else changes. [derived] Then y_c(x) = y_1(c x), K -> K/c, and n, ymax, ymin are untouched (checked numerically in translation_law.py). This is the claim 'threshold and steepness are separable design axes'. The reviews (Brophy and Voigt 2014) say RBS changes the threshold and that cooperativity or DNA looping is a different knob; they do not state exact n invariance, and I found no paper that tests it directly.

5. What the Cello data show. [measured, by me from the shipped files] Cassette = ribozyme insulator, RBS, repressor, terminator. Among pairs of gates with the same repressor that differ at exactly one position, being an RBS and moving K at least 2-fold: Eco1C1G1T1 has 6, max relative n difference dn = 0.1587; Eco1C2G2T2 has 9, max 0.2836 (shipped parameters); the phage-repressor set has 5, max 0.2124; yeast has 1, dn 0.2604. The earlier SrpR 'RBS-only family of 4' in Eco1C1G1T1 is not RBS-only: S1 differs from S2 to S4 also in terminator. Re-fitting the raw cytometry histograms reproduces shipped n in Eco1C1G1T1 (r = 0.977) but in Eco1C2G2T2 the answer depends on the fitting loss: a robust fit gives max dn 0.4254 and three of nine pairs above 0.25. Also ymin changes 1.5 to 2.2 fold (median) and ymax 1.1 to 1.2 fold (median) inside these pairs, so an RBS swap is not a pure sideways shift of the whole curve.

6. Why the data are less decisive than they look. [measured] The RBS in each library was picked by screening for dynamic range (Stanton 2014), so the variants are survivors. Shipped parameters are rounded to 2 significant figures. The Eco1C2G2T2 library was already summarised by the earlier scout, so it is not an untouched test set. Kosuri 2013: translation affects mRNA stability, and protein is within 2-fold of a multiplicative model only 64% of the time (worst 5% off by 13-fold), so promoter and RBS effects are not exactly independent.

7. Order of the key experiments: Shine-Dalgarno 1974; Goldbeter-Koshland 1981; Lutz-Bujard 1997; toggle switch and repressilator 2000; directed evolution of a circuit 2002; single-cell regulation function and noise 2005; combinatorial promoters 2007; RBS Calculator and RPU 2009; bicistronic elements, composability library and TetR-homolog gates 2013; circuit-design review 2014; Cello 2016; yeast and Bacteroides Cello 2020; Cello 2.0 protocol 2022. Best reviews: Brophy and Voigt 2014 (10.1038/nmeth.2926), Ferrell and Ha 2014 (10.1016/j.tibs.2014.08.003), Weiss 1997 (10.1096/fasebj.11.11.9285481).

8. Open problems. (a) No published direct test of n invariance under RBS-only change with matched cassettes and raw single-cell data. (b) Which fit gives the truth for Eco1C2G2T2. (c) Whether ymin/ymax drift is basal-leak physics or a measurement floor. (d) Eukaryotes: only one genuine one-position yeast pair. (e) The law library (set 1.8.1, 59 laws) still has no Hill or reporter law; gene-regulatory-dynamics is an empty placeholder."""

lay = ("A gene can be thought of as a dimmer switch: the more signal comes in, the lower the output light of a gate falls, along an S-shaped curve. Two numbers describe the S: where it bends (the threshold) and how sharply it bends (the steepness). Engineers can weaken or strengthen the 'start here' site that tells the cell's protein-making machines how often to read a repressor gene. Simple arithmetic says that should slide the S left or right without changing its sharpness, like sliding a ruler along a table. In the public data from the Cello gate libraries, that is roughly true for many gates but not exactly: the sharpness drifts by up to about a quarter in some pairs and the top and bottom of the curve also move. Whether the sharpness stays put is still an open question, because one of the datasets gives different answers depending on how the curve is fitted.")

glossary = [
 dict(term="gene", plain="a stretch of DNA that holds instructions for making one protein"),
 dict(term="repressor", plain="a protein that switches a gene off by sitting on its DNA"),
 dict(term="gate", plain="a small genetic part that turns an input signal into an output, like a switch in an electric circuit"),
 dict(term="RBS (ribosome binding site)", plain="the RNA stretch that tells the protein-making machine where and how strongly to start"),
 dict(term="ribosome", plain="the cell's machine that builds proteins from RNA instructions"),
 dict(term="promoter", plain="the DNA stretch where reading of a gene starts; its activity sets how much RNA is made"),
 dict(term="threshold (K)", plain="the input level at which the output is halfway between its high and low values"),
 dict(term="steepness (Hill coefficient, n)", plain="how sharply the output changes around the threshold"),
 dict(term="Hill function", plain="a standard S-shaped curve with a threshold and a steepness"),
 dict(term="RPU (relative promoter unit)", plain="promoter activity measured as a ratio to a standard reference promoter"),
 dict(term="dn", plain="the difference of two steepness values divided by their average, so 0.25 means a quarter apart"),
 dict(term="Kfold", plain="the larger threshold of a pair divided by the smaller"),
 dict(term="cytometry", plain="measuring light from thousands of single cells one by one"),
 dict(term="UCF", plain="the data file that lists the parts and measured curves of a gate library for the Cello software"),
 dict(term="cassette", plain="the short DNA unit holding one gate's repressor gene with its supporting parts"),
 dict(term="terminator", plain="the DNA signal that stops RNA copying"),
 dict(term="ultrasensitivity", plain="a response that switches from low to high over a narrow input range"),
 dict(term="mRNA", plain="the temporary RNA copy of a gene that the ribosome reads"),
]

key_claims = [
 dict(claim="In Cello-style repressor gates the repressor level is set by choosing the RBS (the input promoter is fixed), so an RBS swap is the designed way to move the threshold.",
      source=DOI("10.1038/nchembio.1411") + " (PMC4165527 full text, fetched via NCBI efetch 2026-11-12)",
      evidence_quote="we define the beginning of each gate to be the transcription start site and vary the repressor level by changing the strength of the RBS."),
 dict(claim="Under the assumptions that repressor level is proportional to input times an RBS multiplier and occupancy is a Hill function of repressor, an RBS change rescales K by 1/c and leaves n, ymax, ymin unchanged (derived, not measured).",
      source="scripts/t1-reporter-deep/translation_law.py part 1 (own calculation: y_c(x) = y_1(c x))",
      evidence_quote=""),
 dict(claim="In the shipped Eco1C1G1T1 library the largest relative n difference among same-repressor pairs is 0.1587, while Eco1C2G2T2 reaches 0.2836 in an in-scope pair, and a robust refit of its raw histograms gives up to 0.4254; invariance of n is approximate and fit-dependent.",
      source="computed from " + UCFU + "Eco1C1G1T1.UCF.json and Eco1C2G2T2.UCF.json (sha256 in data/t1-deep/SHA256.txt) by pairs.py and refit.py",
      evidence_quote="ymin + (ymax - ymin) / (1.0 + (x / K)^n)"),
 dict(claim="An RBS swap is not a pure translation of the whole curve: in-scope pairs show median ymin changes of 2.17x (Eco1C1G1T1) and 1.49x (Eco1C2G2T2).",
      source="computed by translation_law.py part 2 from the same UCF files",
      evidence_quote=""),
]

could = [
 "No paper was found that tests directly whether the Hill coefficient is preserved under RBS-only changes of a repressor gate. Statements that RBS shifts the threshold come from reviews and design papers (Stanton 2014, Brophy and Voigt 2014); invariance of n is my analysis of shipped parameters.",
 "The Nielsen 2016 Science paper and its supplement were not retrievable as full text (paywalled; not in Europe PMC open access); only the abstract was read. Same for Mutalik 2013, Weiss 1997, Rosenfeld 2005, Pedraza 2005, Elowitz 2000, Gardner 2000, Chen 2020, Jones 2022 (abstract only). Their cited numbers come from abstracts.",
 "Stanton 2014 supplementary tables 3-5 (RBS libraries, selected RBS, fitted parameters) were not fetched; I could not read the figure of per-gate dynamic range from the supplement.",
 "RBS Calculator predictions for the RBS sequences in the UCF libraries were not computed (the tool is not installed locally and was not run), so I cannot say whether K fold tracks predicted translation-rate fold; this is the most direct available test of c in K -> K/c.",
 "I could not decide which fit of Eco1C2G2T2 is right: shipped parameters (max dn 0.2836) or a robust refit of the histograms (max 0.4254). At least one input level in S2_SrpR is listed out of order with a suspicious output; I did not investigate the other 17 gates by hand.",
 "Bth1C1G1T1 was not downloaded (15 MB, sgRNA gates, repressor identities unclear); Eco2C1G3T1 has no usable pair. The yeast arm has one true pair, so it supports no conclusion about eukaryotes.",
 "Whether the original authors fitted Hill parameters themselves or the Cello toolchain re-derived them was not determined; I did not read the Cello fitting code.",
 "OpenAlex was not used (budget exhausted). No Lean was run. The law library is unchanged: no Hill or reporter law exists in set 1.8.1.",
 "Eco1C2G2T2 had already been summarised by the earlier scout (family K folds and n CVs), so it is not an untouched holdout for any prediction frozen after that scout run; the orchestrator should decide whether the pre-registration is affected.",
]

recs = [
 "Do not freeze 'n is invariant under RBS-only change' with a single numeric bound on shipped parameters: the bound that holds in Eco1C1G1T1 (0.1587) already fails by the shipped numbers in Eco1C2G2T2 (0.2836) and by robust refit (0.4254). Freeze the refit procedure (loss function, treatment of out-of-order input levels) before looking at holdout numbers.",
 "State the law as the derived translation identity y_c(x) = y_1(c x) with named hypotheses (R proportional to c*x, occupancy Hill in R, linear loss) and test ymin and ymax separately; ymin moved by a median 1.5 to 2.2x.",
 "Use only the 6 + 9 + 5 + 1 genuinely one-position RBS pairs; exclude the SrpR S1 pairs (terminator also differs) and the yeast CI and CI434 pairs (no cassette difference).",
 "If a real test is wanted, compute RBS Calculator predicted translation-rate ratios for each pair and check Kfold against them; and look for a second source of raw single-cell data with RBS-only variants.",
 "Add a Hill-function module and reporter steady-state law to lean/Delphi as the earlier law-mapper proposed; the 1.8.1 registry still has only the empty gene-regulatory-dynamics placeholder.",
]

reproduce = [
 dict(what="Verify every cited DOI against Crossref (python 3.14, standard library only)", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t1-reporter-deep/verify_dois.py", expected="Each listed DOI prints True with the title; the entries Minami, Ramani, Wilson, Vilar, Golding, Volfson, Gottlieb resolve to unrelated papers and are not cited"),
 dict(what="Fetch abstracts and PMC ids from Europe PMC", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t1-reporter-deep/fetch_epmc.py", expected="23 lines of DOI, PMCID, OA flag, abstract length; writes scratch/t1-reporter-deep/epmc.json"),
 dict(what="Fetch OA full text (NCBI efetch) for quote checks", command_or_url="curl -A delphi-research/0.1 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=4165527&rettype=xml' (also ids 4230274, 4214216, 3936740, 4080642) and https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2782888/fullTextXML (also PMC2132448)", expected="XML files of 100-250 KB; then python scripts/t1-reporter-deep/grep_text.py FILE 'regex' to print context"),
 dict(what="Fetch the five Cello UCF libraries (about 10 MB total) and hash them", command_or_url="for f in Eco1C1G1T1 Eco1C2G2T2 Eco2C1G3T1 Eco2C1G5T1 SC1C1G1T1: curl -O https://raw.githubusercontent.com/CIDARLAB/Cello-v2-1-Core/main/library/constraints/$f.UCF.json ; sha256sum", expected="sizes 4834067, 2610885, 864264, 46518, 1744232 bytes; Eco1C1G1T1 sha256 c702d6b9b11bcd3c4fb9f7a77d24af1b549cecf3e7184b3a36692873735cd6f0 (all in data/t1-deep/SHA256.txt; fetched 2026-11-12)"),
 dict(what="Pair analysis", command_or_url="python -I scripts/t1-reporter-deep/pairs.py", expected="Eco1C1G1T1 n_inscope=6 max_dn 0.1587; Eco1C2G2T2 n_inscope=9 max_dn 0.2836; Eco2C1G5T1 5 / 0.2124; SC1C1G1T1 1 / 0.2604"),
 dict(what="Refit from cytometry histograms (numpy 2.5.3, scipy 1.18.1; run without -I so site packages load)", command_or_url="python scripts/t1-reporter-deep/refit.py linear ; python scripts/t1-reporter-deep/refit.py soft_l1", expected="Eco1C1G1T1 corr n 0.977, max dn about 0.115; Eco1C2G2T2 linear: corr n 0.70, max dn 1.13; soft_l1: corr n 0.919, max dn 0.4254; SC1C1G1T1 max dn 0.23"),
 dict(what="Derivation check and ymax/ymin drift", command_or_url="python scripts/t1-reporter-deep/translation_law.py", expected="fitted K = K0/c and n = 2.8 for c = 0.25, 2, 10; ymin ratio medians 2.17 and 1.49"),
 dict(what="Assemble this file and check each quote against the fetched sources", command_or_url="python scripts/t1-reporter-deep/build_json.py", expected="'quote problems: []' and a written agents2/t1-reporter-deep.json"),
 dict(what="Law library state", command_or_url="python -c \"import json;l=json.load(open('D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/lawset-1.8.1.json'));print(l['version'],len(l['laws']),[x['law_id'] for x in l['laws'] if 'gene' in x['law_id']])\"", expected="1.8.1 59 ['gene-regulatory-dynamics']"),
]

scripts = ["verify_dois.py", "fetch_epmc.py", "grep_text.py", "pairs.py", "refit.py", "translation_law.py", "build_part1.py", "build_json.py"]
scripts = [AG + "scripts/t1-reporter-deep/" + s for s in scripts]

out = dict(label="t1-reporter-deep",
           topic="Track 1 deep literature: threshold-steepness separability in translation-initiation-variant repressor gates (Cello gate libraries)",
           summary=summary, lay_summary=lay, glossary=glossary, findings=F, key_claims=key_claims,
           table=table, reproduce=reproduce, citations=cites, could_not_find=could, recommendations=recs,
           scripts_written=scripts)
if bad:
    print("NOT WRITING: fix quotes")
    sys.exit(1)
json.dump(out, open(AG + "t1-reporter-deep.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("written", len(F), "findings", len(cites), "citations", len(table), "table rows")
