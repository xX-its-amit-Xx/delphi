# Builds D:/Users/ashenoy00000/delphi-work/agents2/t1-reporter-lay.json from the hand-written content below.
# Run: python -I -X utf8 build_json.py
import json, os
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/t1-reporter-lay.json"
RAW = "https://raw.githubusercontent.com/CIDARLAB/Cello-v2-1-Core/main/library/constraints/Eco1C1G1T1.UCF.json"
LOCAL = "D:/Users/ashenoy00000/delphi-work/data/cello-ucf/Eco1C1G1T1.UCF.json"
SC = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t1-reporter-lay/"
DES = "D:/Users/ashenoy00000/delphi-work/agents/design-reporter.json"
SALIS = "https://doi.org/10.1038/nbt.1568"
NIEL = "https://doi.org/10.1126/science.aac7341"
WHILL = "https://en.wikipedia.org/wiki/Hill_equation_(biochemistry)"
WRBS = "https://en.wikipedia.org/wiki/Ribosome-binding_site"
WREP = "https://en.wikipedia.org/wiki/Repressor"
WFC = "https://en.wikipedia.org/wiki/Flow_cytometry"
LAWS = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/"

R = {}
R["label"] = "t1-reporter-lay"
R["topic"] = "Track 1 plain-language explanation: does changing only the ribosome-binding site of a repressor gate slide its switch point without changing its sharpness?"

R["summary"] = (
 "Plain-language pack for Track 1 (threshold-steepness separability in RBS-variant repressor gates, Cello libraries). "
 "I re-read the three earlier agent reports, re-derived the calibration numbers from the Cello Eco1C1G1T1 file (sha256 c702d6b9...; 20 gates, 12 measured input levels each), "
 "re-checked from the cassette part lists which gate pairs differ in exactly one part and that this part is an RBS, and checked the algebra (equal ymax, ymin and n means the curves are shifted copies). "
 "New findings that matter for the explanation: (1) the 'pure translation' picture is only approximate because the maximum output ymax also changes between RBS variants in the shipped table (PhlF P1 3.9 vs P3 6.8); "
 "(2) the law set is now 1.8.1, which pins 59 laws, and the registry entry gene-regulatory-dynamics is still an unformalised placeholder (status proposed, class gap, version 1.0.0, no Lean module), so the earlier mapper's 1.6.0 reading of it still holds; "
 "(3) no new Lean law about Hill curves or translation initiation was found in 1.8.1. "
 "The held-out libraries were deliberately NOT opened by me, so nothing here pre-judges the test. "
 "The deliverable is lay_summary, the 'how' steps, 'wrong' conditions, risks, glossary and three Q&As, all carried in the 'findings' and 'table' fields; the lay text itself is in findings with kind prefixes LAY-*."
)

R["lay_summary"] = (
 "Bacteria can be given small gene circuits that act like switches: when a signal goes up, the output goes down. "
 "Each switch has two dials we care about, how much signal it takes to flip it, and how sharply it flips. "
 "Engineers can change the first dial by editing a short stretch of DNA that sets how much of a key protein the cell makes. "
 "We ask whether that edit moves only the first dial and leaves the sharpness alone, like sliding a door along a wall without bending the door. "
 "We use a public table of measured switches, we write down what would count as failure before we test on new data, and we report any miss. "
 "No new lab work is involved."
)

R["glossary"] = [
 {"term": "gene circuit", "plain": "A small set of genes wired together inside a cell so the cell makes a decision, such as 'make this protein only when that signal is high'."},
 {"term": "repressor", "plain": "A protein that switches a gene off by blocking it (source: Wikipedia 'Repressor': it 'inhibits the expression of one or more genes')."},
 {"term": "NOT gate", "plain": "A switch that flips its input: high signal in, low signal out, and the other way round. A repressor gate behaves this way."},
 {"term": "ribosome binding site (RBS)", "plain": "A short stretch of DNA/RNA that tells the cell's protein-making machinery where to start; a stronger one means more protein is made from the same gene."},
 {"term": "threshold (K)", "plain": "How much input signal it takes to bring the switch to its halfway point. A low K means the switch flips early."},
 {"term": "steepness (n, the Hill coefficient)", "plain": "How abrupt the flip is. A high n is like a light switch; a low n is like a dimmer."},
 {"term": "Hill curve", "plain": "The S-shaped curve (written y = ymin + (ymax - ymin) / (1 + (x/K)^n)) that describes output y as a function of input x, with floor ymin and ceiling ymax."},
 {"term": "flow cytometry", "plain": "A machine that sends cells one at a time past a laser and records how much each one glows, so thousands of cells are measured in minutes."},
 {"term": "library (UCF file)", "plain": "A public data file that lists each characterised part and gate, its measured numbers and the DNA parts it is built from."},
 {"term": "fold (as in 4-fold)", "plain": "A multiplier: a 4-fold change means the number was multiplied or divided by 4."},
 {"term": "freezing (pre-registration)", "plain": "Writing down the pass/fail rules and the scoring script, and saving them with a date, before looking at the new data, so the rules cannot be bent afterwards."},
 {"term": "held-out data", "plain": "Data kept unopened until the rules are frozen, so the test is a real test rather than a fit to what we already saw."},
 {"term": "Lean theorem", "plain": "A statement in the Lean proof language that a computer has checked step by step; it proves the maths but says nothing about whether nature obeys the assumptions."},
 {"term": "RPU", "plain": "Relative promoter units: the library's way of reporting how active a switch's input or output is, scaled against a reference part measured in the same lab."},
]

# ---------------------------------------------------------------- findings
F = []
def f(claim, source, confidence, value="", q=""):
    F.append({"claim": claim, "source": source, "confidence": confidence, "value": value, "evidence_quote": q})

# --- LAY text blocks (the explanation itself) -------------------------------------------------
f("LAY-WHAT-AND-WHY (one paragraph): Some bacteria can be given a small gene circuit that works like a switch. In the switches we study, a repressor protein turns a gene off, so more input signal gives less output, and the output follows an S-shaped curve. "
  "The curve has two main dials: the threshold, which is how much input it takes to reach the halfway point, and the steepness, which is how abruptly it flips. A short stretch of DNA called a ribosome binding site decides how much repressor protein the cell makes from the gene. "
  "Our question is whether changing only that stretch slides the threshold left or right while leaving the steepness almost untouched, like sliding a door along a wall without bending it. If that holds, an engineer could set the two dials separately. "
  "We test it on a public table of 20 measured switches from the E. coli Cello library, we write the pass/fail rules down before touching fresh data, and no new lab work is done. Honest limit: the library authors picked their RBS variants because the switches worked well, so a pass would only cover variants that passed that screen.",
  "synthesis of rows below; see each cited finding", "medium",
  q="")
f("LAY-HOW step 1: Take the public Cello table for E. coli. Think of it as a catalogue of 20 dimmer switches, each with its measured numbers, from the Nielsen 2016 design-automation work. (The table lists 20 gates, each with a threshold K and steepness n.)",
  RAW, "high", "20 gates; 20 models; 12 measured input levels per gate",
  "Hill_response ... ymin + (ymax - ymin) / (1.0 + (x / K)^n)")
f("LAY-HOW step 2: Find pairs of switches that are the same in every DNA part except the ribosome binding site. Like two cars with the same engine, body and tyres but a different fuel-flow setting. We read each switch's part list to check, instead of trusting names.",
  RAW + " (cassette part lists); script " + SC + "parts.py", "high", "")
f("LAY-HOW step 3: Write down, for each such pair, how far the threshold moved (a multiplier) and how much the steepness changed (a percentage of its average). Example: BM3R1 gates B1 and B2 have thresholds 0.04 and 0.15 (3.75 times apart) and steepness 3.4 and 2.9 (about 16 percent apart).",
  SC + "facts.py output; " + LOCAL, "high", "K 0.04 vs 0.15; n 3.4 vs 2.9; Kfold 3.75; dn 0.1587")
f("LAY-HOW step 4: Record the spread. Across the 10 qualifying pairs in this table the largest steepness difference is 0.1587 (about 16 percent), while thresholds differ by up to 7.7 times in some pairs.",
  SC + "facts.py; " + DES, "high", "max dn 0.1587 over 10 pairs (the design report says 9; my script prints 10: 3 BM3R1, 3 PhlF, 1 QacR, 3 SrpR); max Kfold 7.667 (PhlF P1/P3)")
f("LAY-HOW step 5: Freeze the rules before testing. Save a dated file listing the pass and fail lines (for example 'steepness differs by no more than 25 percent') and the scoring program, and only then open a second, separate E. coli library. Like calling your shot before the ball is thrown.",
  DES + " (frozen_predictions P1, what_is_frozen_and_when). These are the DESIGNER's proposed rules, not yet committed by anyone.", "medium", "bound 0.25 on relative steepness difference")
f("LAY-HOW step 6: Check the measuring instrument first. Each gate also ships raw single-cell glow data (12 input levels, 250 bins each). We re-fit the curves ourselves from that raw data to see whether the published steepness numbers survive an independent fit.",
  DES + " (P3); structure confirmed in " + LOCAL + " (table of length 12 per cytometry function)", "medium", "12 levels x 250 bins")
f("LAY-HOW step 7: Score the frozen rules on the unopened library by running the saved program unchanged. Report every result, passes and misses, in a table.",
  DES + " (steps 2-3)", "medium", "")
f("LAY-HOW step 8: Look at other repressor families and at yeast and gut bacteria, where the same question can be asked, and say plainly where the sample is too small. In yeast only one pair qualifies, so no claim about all yeast is possible.",
  DES + " (P4, P5); claim about yeast from the designer's reading of SC1C1G1T1, which I did not re-check", "low", "yeast qualifying pairs = 1 (designer's count)")
f("LAY-HOW step 9: Write the maths part in the Lean proof language. The true-by-algebra part is: if two S-curves share floor, ceiling and steepness, one is the other slid sideways. The biology part (an RBS change keeps steepness) is stated as an assumption with its measured score attached, never as proved.",
  SC + "algebra.py; " + LAWS + "laws/gene-regulatory-dynamics.json", "high", "max abs difference 8.9e-16 over 10000 random trials")
f("LAY-HOW step 10: Publish what we find, including a miss. A miss would still teach something, for example that the published steepness numbers depend on how the curves were fitted.",
  DES + " (P3 refuted_if)", "medium", "")
f("LAY-WRONG (what counts as being wrong): (a) On the unopened library, two or more qualifying pairs have steepness differing by more than 25 percent, or any one by more than 40 percent. (b) The steepness gain-versus-threshold-shift score is below 6 for the median pair, or for more than one third of pairs. "
  "(c) Our own re-fit of the raw glow data disagrees with the published steepness numbers (correlation below 0.8, or any gate off by more than 1.5 times). (d) The two other predictions (the family ordering, and that thresholds are not comparable across libraries) fail as stated in their own rules. "
  "These cut-offs are the designer's proposals from the design report and are not yet frozen.",
  DES + " (frozen_predictions P1, P2, P3, P4, P6)", "medium", "0.25; 0.40; 6.0; r>=0.80; 1.5x")
f("LAY-COULD-GO-WRONG 1: Selection. The library authors kept RBS variants that gave good switches. A pass would then only say steepness is stable among variants that already passed that screen.", DES + " (risks)", "medium")
f("LAY-COULD-GO-WRONG 2: Rounding. The calibration table stores steepness to two significant figures and some thresholds to one (S1 SrpR K = 0.01), so the headline 10-fold SrpR threshold shift is not a measured 10-fold.", RAW + "; " + SC + "facts.py", "high", "n='3.4' style two-figure values; S1_SrpR K=0.01")
f("LAY-COULD-GO-WRONG 3: The picture is not an exact slide. In the shipped table the ceiling (ymax) also differs between RBS variants, e.g. PhlF P1 3.9, P2 4.1, P3 6.8 and BM3R1 B1 0.5, B3 0.8. So 'only the threshold moves' is at best approximate.", SC + "algebra.py output; " + LOCAL, "high", "PhlF ymax 3.9/4.1/6.8; BM3R1 ymax 0.5/0.5/0.8")
f("LAY-COULD-GO-WRONG 4: Few pairs. If the unopened library has fewer than four qualifying pairs, the result is underpowered and the designer's rule is to say so and not loosen the pair definition.", DES + " (risks)", "medium")
f("LAY-COULD-GO-WRONG 5: Mixed-up gates. One 'family' in the calibration table is not clean: SrpR gate S1 uses a different terminator (ECK120019600) from S2, S3, S4 (ECK120029600), so it differs in more than the RBS and is left out.", SC + "parts.py output; " + LOCAL, "high", "",
  "S1_SrpR ... ECK120019600 (terminator); S2_SrpR ... ECK120029600 (terminator)")
f("LAY-COULD-GO-WRONG 6: Wrong ruler. The input and output units (RPU) are set per library, so a threshold from one library may not compare with another library's. The designer predicts this and plans a test.", DES + " (P6)", "low")
f("LAY-Q1 'Is this a real experiment? Did anyone grow bacteria?' Answer: The bacteria were grown and measured by the original library authors (E. coli, M9 medium, 37 C, flow cytometry). Our work re-analyses their published numbers; no new lab work is planned in the tests listed.", RAW + " (header)", "high", "",
  "Measurement: flow cytometry, data processing for RPU normalization.")
f("LAY-Q2 'Could you just be fooling yourselves?' Answer: Yes, which is why the pass/fail lines and scoring program are written first, the fresh library is opened once, and an independent re-fit from raw data comes first. One earlier proposed line (steepness within 15 percent) already failed on the calibration table (0.1587), so it was dropped.", DES + " (chosen, frozen_predictions); " + SC + "facts.py", "high", "0.1587 > 0.15")
f("LAY-Q3 'Why would anyone care?' Answer: If threshold and steepness can be set separately, circuit designers get a simpler rule for tuning a switch. The original Cello paper aimed to make circuit design work like electronics design. Honest limit: this is a narrow rule for one kind of switch in one organism, not a general law of biology.", NIEL, "medium", "",
  "essentially a programming language to design computational circuits in living cells")

# --- discrete factual claims -------------------------------------------------------------------
f("A repressor gate's response is the Hill curve y = ymin + (ymax - ymin)/(1 + (x/K)^n), shipped as the library's response function.", RAW, "high", "", "ymin + (ymax - ymin) / (1.0 + (x / K)^n)")
f("The Eco1C1G1T1 library describes itself as holding TetR-family repressors.", RAW, "high", "", "TetR homologs: PhlF, SrpR, BM3R1, HlyIIR, BetI, AmtR, AmeR, QacR, IcaRA, LitR, PsrA, LmrA")
f("The file has 20 gates, 20 models, 20 structures and 42 functions (20 toxicity-type, 20 cytometry, plus the response and input-composition functions).", LOCAL + " via " + SC + "facts.py", "high", "gates=20; models=20; structures=20; functions=42")
f("Eco1C1G1T1 file: 4,834,067 bytes, sha256 c702d6b9b11bcd3c4fb9f7a77d24af1b549cecf3e7184b3a36692873735cd6f0, fetched from the raw GitHub URL on 2026-11-12 by an earlier agent into the data folder and re-hashed by me.", LOCAL, "high", "4834067 bytes")
f("The Cello repository holding the library is licensed Apache-2.0 (GitHub API, last push 2024-09-16).", "https://api.github.com/repos/CIDARLAB/Cello-v2-1-Core", "high", "Apache-2.0; pushed 2024-09-16", "")
f("The measurements were made in E. coli NEB 10-beta at 37 C in M9 minimal medium, with a 5-hour growth after induction, read by flow cytometry.", RAW + " (header collection)", "high", "37 C; 5 h", "Growth: shaking incubator for 5 hours.")
f("The library converts fluorescence to RPU using a reference measurement standard.", RAW + " (measurement_std)", "high", "", "RPU = (YFP - YFP0)/(YFPRPUG - YFP0)")
f("BM3R1 gates B1, B2, B3 have the same cassette except the RBS part (B1, B2, B3, each of type rbs). Their (ymax, ymin, K, n) are B1 (0.5, 0.004, 0.04, 3.4), B2 (0.5, 0.005, 0.15, 2.9), B3 (0.8, 0.01, 0.26, 3.4).", SC + "parts.py and facts.py outputs; " + LOCAL, "high", "B1 K=0.04 n=3.4; B2 K=0.15 n=2.9; B3 K=0.26 n=3.4")
f("PhlF gates P1, P2, P3 differ only in RBS: (ymax, ymin, K, n) = (3.9, 0.01, 0.03, 4.0), (4.1, 0.02, 0.13, 3.9), (6.8, 0.02, 0.23, 4.2).", SC + "algebra.py and parts.py outputs", "high", "K 0.03 -> 0.23 (7.67x); n 4.0 -> 4.2 (dn 0.0488)")
f("Over the 10 RBS-only gate pairs printed by facts.py (3 BM3R1, 3 PhlF, 1 QacR, 3 SrpR; the design report counted 9), the maximum relative steepness difference dn = |n1-n2|/mean(n) is 0.1587 (BM3R1 B1/B2 and B2/B3).", SC + "facts.py output", "high", "max dn = 0.1587")
f("QacR Q1 vs Q2 (RBS-only): K 0.05 vs 0.21 (4.2x), n 2.7 vs 2.4 (dn 0.1176).", SC + "facts.py output", "high", "Kfold 4.200; dn 0.1176")
f("SrpR S2/S3/S4 (same terminator ECK120029600) have K 0.04, 0.06, 0.1 and n 2.6, 2.8, 2.8; so the largest K fold among them is 2.5.", SC + "facts.py output", "high", "Kfold max 2.500; dn max 0.0741")
f("SrpR gate S1 has a different terminator from S2-S4, so a K-ratio of S1 (K=0.01) to S4 (K=0.1) is not an RBS-only comparison.", SC + "parts.py output", "high", "", "S1_SrpR ... ECK120019600 (terminator)")
f("Shipped steepness values are rounded to two figures (n = 3.4, 2.9); the Eco2C1G5T1 library ships longer decimals according to the design report (not re-checked by me).", DES + " (model.fitted_and_on_what)", "low", "")
f("If two Hill curves share ymax, ymin and n, then y2(x) = y1(x*K1/K2) exactly: maximum absolute difference 8.9e-16 over 10,000 random trials, as expected from (x/K2)^n = ((x K1/K2)/K1)^n.", SC + "algebra.py", "high", "8.88e-16")
f("The raw single-cell data in the library is a table of 12 input levels per gate, each with 250 bins (checked: table length 12 for B1_BM3R1_cytometry; bin array begins 0.001, 0.00105...).", LOCAL + " via " + SC + "parts.py", "high", "12 levels; 250 bins per designer's report")
f("A ribosome binding site recruits the ribosome that starts making protein from an mRNA.", WRBS, "high", "", "a sequence of nucleotides upstream of the start codon of an mRNA transcript that is responsible for the recruitment of a ribosome during the initiation of translation")
f("Designed ribosome binding sites can control how much protein is made: a published method predicted expression over a 100,000-fold range to within a factor of 2.3 in E. coli.", SALIS, "high", "factor 2.3; 100,000-fold", "accurate to within a factor of 2.3 over a range of 100,000-fold")
f("A repressor is a protein that stops a gene being read by binding DNA near it.", WREP, "high", "", "a DNA- or RNA-binding protein that inhibits the expression of one or more genes by binding to the operator or associated silencers")
f("Flow cytometry measures cells one at a time with a laser, and tens of thousands of cells can be read quickly.", WFC, "high", "", "Tens of thousands of cells can be quickly examined and the data gathered are processed by a computer.")
f("The Hill equation describes a response to a ligand concentration; it is the standard S-curve used for such dose-response behaviour.", WHILL, "medium", "", "the Hill equation proper reflects the cellular or tissue response to the ligand")
f("The Cello design-automation paper describes a programming language for designing circuits in living cells, built as plasmids in E. coli.", NIEL, "high", "", "essentially a programming language to design computational circuits in living cells")
f("The mechanism claim that an RBS change affects mainly the amount of repressor protein (and not its cooperativity) is a hypothesis; the Salis abstract supports only that RBS strength controls protein level. It is unverified background, and the planned test does not rely on it.", SALIS + "; " + DES + " (honest_gaps)", "low")
f("Law-set check: lean/registry/lawsets/current.json points to version 1.8.1 (file lawset-1.8.1.json), which pins 59 laws (my count). The earlier law-mapper used 1.6.0.", LAWS + "lawsets/current.json and lawsets/lawset-1.8.1.json", "high", "version 1.8.1; 59 laws", "\"version\": \"1.8.1\"")
f("In law set 1.8.1 the registry entry gene-regulatory-dynamics is still version 1.0.0, status proposed, class gap, with lean_ref.module = null; it describes a gap, not a theorem. No law file in laws/ mentions translation initiation, and the only file mentioning a Hill curve is altitude-coupling (oxygen binding, unrelated) (grep).", LAWS + "laws/gene-regulatory-dynamics.json", "medium", "status proposed; module null", "\"statement_en\": \"How a gene edit changes a structure quantitatively (bioelectric kcnk5b, slc43a2a transport).\"")
f("Held-out libraries (Eco1C2G2T2, Eco2C1G3T1, Bth1C1G1T1) were not opened by me, so no holdout number appears in this report.", "this report", "high")
R["findings"] = F

# --- key claims --------------------------------------------------------------------------------
R["key_claims"] = [
 {"claim": "In the public Cello E. coli table, within the 10 gate pairs that differ only in the RBS part, the largest relative difference in steepness n is 0.1587 while the threshold K differs by up to 7.7 times.",
  "source": LOCAL + " (re-fetch: " + RAW + "); script " + SC + "facts.py",
  "evidence_quote": "B1_BM3R1 K 0.04 n 3.4; B2_BM3R1 K 0.15 n 2.9; P1_PhlF K 0.03 n 4.0; P3_PhlF K 0.23 n 4.2 (value rows of the models collection)"},
 {"claim": "If two switches share floor, ceiling and steepness, the one with the higher threshold is the other slid sideways on a log-input axis; but in the shipped table the ceiling also differs between RBS variants, so the slide is only approximate.",
  "source": SC + "algebra.py; " + LOCAL,
  "evidence_quote": "ymin + (ymax - ymin) / (1.0 + (x / K)^n)"},
 {"claim": "The test's pass/fail lines are the designer's proposals (0.25, 0.40, 6.0, r>=0.80) and are not yet frozen; the held-out library has not been opened.",
  "source": DES + " (frozen_predictions)", "evidence_quote": ""},
 {"claim": "The law registry has no theorem for this: gene-regulatory-dynamics is a placeholder in law set 1.8.1.",
  "source": LAWS + "laws/gene-regulatory-dynamics.json",
  "evidence_quote": "\"status\": \"proposed\", \"class\": \"gap\""},
]

R["table"] = [
 {"name": "BM3R1 B1", "fields": "ymax=0.5 RPU; ymin=0.004 RPU; K=0.04 RPU; n=3.4 (dimensionless); rbs=B1", "source": RAW},
 {"name": "BM3R1 B2", "fields": "ymax=0.5 RPU; ymin=0.005 RPU; K=0.15 RPU; n=2.9; rbs=B2", "source": RAW},
 {"name": "BM3R1 B3", "fields": "ymax=0.8 RPU; ymin=0.01 RPU; K=0.26 RPU; n=3.4; rbs=B3", "source": RAW},
 {"name": "PhlF P1", "fields": "ymax=3.9 RPU; ymin=0.01 RPU; K=0.03 RPU; n=4.0; rbs=P1", "source": RAW},
 {"name": "PhlF P2", "fields": "ymax=4.1 RPU; ymin=0.02 RPU; K=0.13 RPU; n=3.9; rbs=P2", "source": RAW},
 {"name": "PhlF P3", "fields": "ymax=6.8 RPU; ymin=0.02 RPU; K=0.23 RPU; n=4.2; rbs=P3", "source": RAW},
 {"name": "QacR Q1 vs Q2", "fields": "K=0.05 vs 0.21 RPU (4.2x); n=2.7 vs 2.4; dn=0.1176", "source": RAW},
 {"name": "SrpR S2, S3, S4", "fields": "K=0.04, 0.06, 0.1 RPU; n=2.6, 2.8, 2.8; ymax=2.1 RPU each; max Kfold=2.5", "source": RAW},
 {"name": "SrpR S1 (excluded)", "fields": "K=0.01 RPU; n=2.9; terminator=ECK120019600 (S2-S4 use ECK120029600)", "source": RAW},
 {"name": "Pair summary (10 RBS-only pairs)", "fields": "max dn=0.1587; max Kfold=7.667 (PhlF P1/P3); min Kfold=1.5 (SrpR S2/S3)", "source": SC + "facts.py"},
 {"name": "Eco1C1G1T1 file", "fields": "bytes=4834067; sha256=c702d6b9b11bcd3c4fb9f7a77d24af1b549cecf3e7184b3a36692873735cd6f0; gates=20; licence=Apache-2.0", "source": RAW},
 {"name": "Law set", "fields": "version=1.8.1; pinned laws=59; gene-regulatory-dynamics: status=proposed, class=gap, version=1.0.0", "source": LAWS + "lawsets/lawset-1.8.1.json"},
]

R["recommendations"] = [
 "Use the lay_summary and LAY-* findings as the public text; keep the 'not an exact slide' caveat (ymax also changes) in it.",
 "Before freezing, add the observation that ymax varies between RBS variants and decide whether the frozen statement should also bound the change in ymax.",
 "Re-point the registry work at law set 1.8.1; the placeholder gene-regulatory-dynamics 1.0.0 is the entry a successor law would supersede.",
 "Keep the held-out libraries unopened until the scoring program is committed.",
]

R["reproduce"] = [
 {"what": "Hash the calibration file", "command_or_url": "python -I -X utf8 " + SC + "facts.py " + LOCAL, "expected": "bytes 4834067, sha256 c702d6b9b11bcd3c4fb9f7a77d24af1b549cecf3e7184b3a36692873735cd6f0, 20 gates, and 10 PAIR lines with max dn=0.1587 (Python 3.14)"},
 {"what": "Re-fetch the file to compare", "command_or_url": RAW, "expected": "same size and sha256"},
 {"what": "Check part types and the SrpR S1 terminator difference", "command_or_url": "python -I -X utf8 " + SC + "parts.py " + LOCAL, "expected": "B1/B2/B3 cassettes differ only in an 'rbs' part; S1_SrpR has ECK120019600, S2-S4 have ECK120029600; B1_BM3R1_cytometry table length 12"},
 {"what": "Check the slide algebra and the ymax spread", "command_or_url": "python -I -X utf8 " + SC + "algebra.py " + LOCAL, "expected": "max abs diff ~1e-15; PhlF ymax 3.9, 4.1, 6.8"},
 {"what": "Check citations", "command_or_url": "https://api.crossref.org/works/10.1126/science.aac7341 and https://api.crossref.org/works/10.1038/nbt.1568", "expected": "titles 'Genetic circuit design automation' (Science 2016) and 'Automated design of synthetic ribosome binding sites to control protein expression' (Nature Biotechnology 2009)"},
 {"what": "Check law set version", "command_or_url": "read " + LAWS + "lawsets/current.json and laws/gene-regulatory-dynamics.json", "expected": "version 1.8.1; status proposed, lean_ref.module null"},
 {"what": "Rebuild this report", "command_or_url": "python -I -X utf8 " + SC + "build_json.py", "expected": "writes " + OUT},
]

R["citations"] = [
 {"authors": "Nielsen AAK, Der BS, Shin J, Vaidyanathan P, et al.", "year": 2016, "title": "Genetic circuit design automation", "doi_or_arxiv": "10.1126/science.aac7341", "verified": True, "venue": "Science", "used_for": "Source of the Cello gate libraries and the 'programming language for living cells' framing", "how_verified": "Crossref API api.crossref.org/works/10.1126/science.aac7341 resolved in this run (title, Science, April 2016, first author Nielsen); abstract text read from the same record"},
 {"authors": "Salis HM, Mirsky EA, Voigt CA", "year": 2009, "title": "Automated design of synthetic ribosome binding sites to control protein expression", "doi_or_arxiv": "10.1038/nbt.1568", "verified": True, "venue": "Nature Biotechnology", "used_for": "RBS design controls protein expression level (factor 2.3 over 100,000-fold)", "how_verified": "Crossref API resolved in this run; abstract read through Europe PMC REST search on the DOI"},
 {"authors": "Taketani M, Zhang J, Zhang S, Triassi AJ, et al.", "year": 2020, "title": "Genetic circuit design automation for the gut resident species Bacteroides thetaiotaomicron", "doi_or_arxiv": "10.1038/s41587-020-0468-5", "verified": True, "venue": "Nature Biotechnology", "used_for": "Origin of the gut-bacterium library (not opened by me)", "how_verified": "Crossref API resolved in this run"},
 {"authors": "Chen Y, Zhang S, Young EM, Jones TS, et al.", "year": 2020, "title": "Genetic circuit design automation for yeast", "doi_or_arxiv": "10.1038/s41564-020-0757-2", "verified": True, "venue": "Nature Microbiology", "used_for": "Origin of the yeast library mentioned in step 8", "how_verified": "Crossref API resolved in this run"},
]

R["could_not_find"] = [
 "I did not independently re-check the designer's yeast counts (one qualifying pair), the Eco2C1G5T1 values, or any held-out-library number, by choice: the held-out files stay unopened so the later test is real.",
 "I did not read the Cello fitting code, so I cannot say whether the library's fitting procedure constrains n. The designer flagged this as a hypothesis too.",
 "I could not read any numeric value of the raw cytometry fit myself (the refit is step 6, not done); no refit number is claimed.",
 "No published source I fetched states that RBS changes leave Hill steepness unchanged; the 'slide not bend' picture is the hypothesis under test, not a documented fact. The Salis abstract only supports that RBS design controls protein level.",
 "Wikipedia pages were used only for plain-language definitions (RBS, repressor, flow cytometry, Hill equation); I did not find a peer-reviewed page quote for each and the quotes are from the live article as fetched on 2026-11-12.",
 "Reading level (about 9th grade) was judged by eye, not with a readability tool.",
 "I did not run a Lean process or check the Lean library for a Hill-curve lemma; the law-set check was of registry JSON only.",
]
R["scripts_written"] = [SC + "facts.py", SC + "parts.py", SC + "algebra.py", SC + "build_json.py"]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(R, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote", OUT, len(F), "findings")
