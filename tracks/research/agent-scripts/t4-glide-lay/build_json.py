"""Builds D:/Users/ashenoy00000/delphi-work/agents2/t4-glide-lay.json from the fetched sources.
Run after fetch.sh, run_check.sh and ratio.sh. Python 3 standard library only.
Also re-checks every evidence_quote against the saved source text (whitespace and ligatures normalised).
"""
import json, re, hashlib, os, sys, unicodedata

ROOT = "D:/Users/ashenoy00000/delphi-work/agents2"
SC = ROOT + "/scratch/t4-glide-lay/"
OUT = ROOT + "/t4-glide-lay.json"

def norm(s):
    s = unicodedata.normalize("NFKC", s)  # turns ligatures such as 'ffi' into letters
    return re.sub(r"\s+", " ", s).strip()

SRC = {
    "S1": ("https://arxiv.org/abs/1811.12221", SC + "1811.12221.txt"),
    "S2": ("https://arxiv.org/abs/1902.08038", SC + "1902.08038.txt"),
    "S3": ("https://github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds", SC + "lic_LICENSE.txt"),
    "S3r": ("https://github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds", SC + "repo_readme.md"),
    "S4": ("file: delphi-work/agents2/scratch/t4-glide-lay/pkl_dump.txt (from all_results_experiments.pkl in the S3 repo)", SC + "pkl_dump.txt"),
    "S5": ("file: delphi-work/agents/design-glide.json", "D:/Users/ashenoy00000/delphi-work/agents/design-glide.json"),
    "S6a": ("file: delphisci/lean/Delphi/Scaling.lean (law set 1.8.1)", "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Scaling.lean"),
    "S6b": ("file: delphisci/lean/Delphi/Flight.lean (law set 1.8.1)", "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Flight.lean"),
    "S8": ("https://export.arxiv.org/api/query?id_list=1811.12221", SC + "arx_1811.xml"),
    "S7": ("https://export.arxiv.org/api/query?id_list=1902.08038", SC + "arx_1902.xml"),
}

def F(claim, src, quote, conf="high", value=None):
    d = {"claim": claim, "source": SRC[src][0] if src in SRC else src, "confidence": conf, "evidence_quote": quote, "_k": src}
    if value is not None:
        d["value"] = value
    return d

findings = [
    F("The work combines 3D printing, a model and experiments to find the shape that falls slowest (arXiv abstract).", "S8",
      "combines 3D-printing, a minimal theoretical model and experiments to determine the shape of multi-winged autorotating seeds, fruits and other diaspores that provide them with the optimal wind dispersion potential i.e. minimal terminal descent velocity"),
    F("The printed fruits were made on a Formlabs Form 2 resin printer; about 5 hours per batch of 3.", "S1",
      "The synthetic fruits are produced by using the Form 2 3D-printer from Formlabs [42], relying on the stereolithography technique with a print time of about 5 hours for a batch of 3 fruits.", value="5 h per 3 fruits"),
    F("The fruit is a hollow sphere so its weight can change while its volume stays fixed.", "S1",
      "the fruit itself is designed as a hollow sphere with two holes, allowing us to vary its weight in experiments while keeping the volume fixed."),
    F("The original tank was 1.2 m tall and 25 cm across.", "S1",
      "Experiments were performed in a cylindrical water tank of a height 1.2 m and a diameter 25 cm.", value="1.2 m x 0.25 m"),
    F("Each fruit is released fully under the water surface.", "S1", "The fruit is fully immersed under the water surface before it is released."),
    F("Video was recorded from the side at 30 Hz.", "S1", "from the side of the tank at a frequency of 30Hz and a resolution of 864 × 480 pixels.", value="30 Hz"),
    F("The water test was designed to match the flow regime of wild fruits in air (Reynolds and Strouhal numbers).", "S1",
      "We design our experiments so that both the Reynolds number (Re) and the Strouhal number (St) are in direct correspondence to fruit flight in Nature."),
    F("For a given wing shape, a heavier fruit sinks faster, with speed growing like the square root of weight.", "S1",
      "for each individual wing geometry the terminal descent velocity scales as ∼√mg, consistent with experiments on wild fruits"),
    F("The paper tuned the model's drag number to match its own experiments.", "S1",
      "we reduce the value of the drag coefficient to obtain good agreement with our experiments."),
    F("The paper tested two base angles only: 0 and 35 degrees.", "S1",
      "The angle ψ between the base of the wing and the vertical direction is chosen equal to ψ = 0 ◦ or ψ = 35◦"),
    F("At base angle 35 degrees the best fold angle is lower than at 0 degrees, near KL about 1.2.", "S1",
      "the optimal fold angle has decreased, with a minimum terminal descent velocity obtained near KL≈ 1.2."),
    F("The stroboscopic test at base angle 0 put the slowest-falling fold angle near KL 2.3, in line with the model.", "S1",
      "the minimum terminal descent velocity is around KL ≈ 2.3, in accordance with predictions of the blade element model"),
    F("27 wild species have a mean fold angle KL = 1.8 +/- 0.18, close to the optimum.", "S1",
      "27 species that reside in Africa, Asia, and the Americas where they were collected in the wild, which are found to have a fold angle mean(KL) = 1.8 ± 0.18, close to the optimum.", value="1.8 +/- 0.18"),
    F("The companion letter reports an optimal fold angle for maximal flight time, and a similar angle in wild fruits.", "S2",
      "to produce a maximal flight time there is an optimal fold angle for the desiccated sepals. A similar sepal fold angle is found for a wide range of whirling fruits collected in the wild"),
    F("The code and CAD repository is MIT-licensed.", "S3", "MIT License"),
    F("The repository holds the blade-element model and a parametric CAD file.", "S3r",
      "**model**: the phenomenological blade-elements model. - **CAD**: the baseline parametric CAD file", conf="medium"),
    F("Measured: base angle 0, KL 2.31, 2.16 g key: mean descent speed 0.1011 m/s (10 drops).", "S4", "0, 26, 2.16, 10, 0.1011, 0.0029, 1.398, KL=2.31", value="0.1011 m/s"),
    F("Measured: base angle 35, KL 1.20, 2.16 g key: mean descent speed 0.0676 m/s (3 drops).", "S4", "35, 50, 2.16, 3, 0.0676, 0.0018, 0.612, KL=1.20", value="0.0676 m/s"),
    F("Ratio of those two measured speeds is 1.496 (my arithmetic: 0.1011 / 0.0676). The model predicts 1.22 and the simple disk rule 1.39 for the same pair; the earlier designer reported both.", "S5",
      "psi=0, KL 2.31 over psi=35, KL 1.2 is 1.50 measured (0.1011/0.0676 m/s, 2.16 g lead key, file all_results_experiments.pkl)", value="measured 1.496; model 1.2199; disk 1.3905"),
    F("My re-run of the earlier designer's Python port reproduces the model files stored in the repository to within 0.17% (max relative Reynolds-number difference 0.0017).", "check_out.txt",
      "port-vs-stored Re rel diff: median 0.0006 max|.| 0.0017 ; St abs diff max 0.0003", value="<= 0.17 %"),
    F("The stored model curve for base angle 15 degrees has its slowest point at Reynolds number 4352, KL 1.805.", "check_out.txt", "stored min Re 4352 at KL 1.805 St 0.608", value="Re 4352"),
    F("The earlier designer's frozen model ratio for the best 15-degree fruit (KL 1.73) over the control is 1.111; the disk rule gives 1.183.", "S5",
      "BEM: 1.111 (1.114-1.118 at the optima under all nuisance settings). Disk rule: 1.183.", value="1.111 vs 1.183"),
    F("Model prediction for a pitch 5 degree wing: sinks at 0.637 of the 15-degree speed; the disk rule predicts no change.", "S5",
      "lowering wing pitch from 15 to 5 deg cuts descent speed to 0.64 of its value; raising it to 25 deg increases it 1.50-fold. The disk rule predicts 1.00 for both.", value="0.637"),
    F("The plan specifies 21 fruits, 10 drops each, three identical control fruits that must agree within 8 percent.", "S5",
      "Void if two control fruits differ by more than 8% in u*.", conf="medium"),
    F("The registry law vmin_le says: steady lift-supported flight needs a speed of at least a minimum value set by weight, area and maximum lift coefficient.", "S6a",
      "Steady lift-supported flight at lift coefficient at most `C_L,max` needs `v ≥ v_min`."),
    F("The registry law glide_range_le bounds a steady no-thrust glide's distance by height times best lift-to-drag ratio; it does not apply to a spinning seed that sinks straight down.", "S6b",
      "the horizontal distance is at most `h (L/D)_max`.", conf="medium"),
]

key_claims = [
    {"claim": "KC1: The plan reuses a published, MIT-licensed model and CAD, and the published experiments cover only base angles 0 and 35 degrees.",
     "source": SRC["S1"][0] + " ; " + SRC["S3"][0], "evidence_quote": "The angle ψ between the base of the wing and the vertical direction is chosen equal to ψ = 0 ◦ or ψ = 35◦", "_k": "S1"},
    {"claim": "KC2: On the public data the model's predicted speed ratio between base angle 0 and 35 (1.22) already differs from the measured ratio (1.50, my arithmetic 0.1011/0.0676), so the model can fail the planned test.",
     "source": SRC["S4"][0] + " ; " + SRC["S5"][0], "evidence_quote": "psi=0, KL 2.31 over psi=35, KL 1.2 is 1.50 measured (0.1011/0.0676 m/s, 2.16 g lead key, file all_results_experiments.pkl)", "_k": "S5"},
    {"claim": "KC3: The experiment measures sinking speed of a spinning fruit in water, not forward gliding, so the registry glide-range law does not apply to it.",
     "source": SRC["S5"][0], "evidence_quote": "Stated limit: this is a sink-rate surrogate, not a forward glide, so glide_range_le does not apply.", "_k": "S5"},
    {"claim": "KC4: The 'disk rule' rival is the earlier designer's own construction, modelled on the registry law vmin_le; it is not itself a registry law.",
     "source": SRC["S5"][0] + " ; " + SRC["S6a"][0], "evidence_quote": "It is the registry law vmin_le (Scaling.lean, v >= sqrt(2W/(rho S C_max))) with S replaced by swept disk area.", "_k": "S5"},
]

what_and_why = (
    "Some tree fruits have two curved wings and spin like a helicopter blade as they fall, which slows the fall so the wind can carry them farther [S1]. "
    "Researchers 3D-printed copies of such fruits, dropped them in a water tank, and wrote a computer model that predicts how fast each shape sinks [S1, S3]. "
    "We plan to reuse their free design files and code [S3], and to write down, before printing anything, exact numbers that the published model and a much simpler rival rule predict for new shapes, including a wing-base angle of 15 degrees that the papers did not test in experiments [S1, S5]. "
    "Then we print 21 fruits, drop them, and see which rule holds up, or whether both fail [S5]. "
    "The point is that a design rule is only worth trusting if a test it was not tuned on could have shown it wrong. "
    "This is a test of sinking speed, not of forward gliding, so it is a stand-in for fin and body limits in a glide, not a glide itself [S5]. "
    "The files I read describe this as a plan; I found no results from it."
)

steps = [
    "1. Write the guesses down first. We save the model, its code and every predicted number in a file before any fruit exists, like handing in a betting slip before the race [S5].",
    "2. Check the model on old data. The earlier designer rewrote the model in modern Python, and my re-run shows it matches the authors' stored results to within 0.17 percent, like checking a new calculator on sums whose answers you already know [S5, my re-run].",
    "3. Build the video-measuring tool and test it on recorded paths. The tool follows the fruit's lowest point and its spin from side video, like testing a stopwatch on a race you already have on tape [S1, S5].",
    "4. Print 21 fruits from one recipe. In the CAD file we change only three numbers (base angle, curve, wing tilt), like baking cookies from one recipe with one setting changed each time. A batch of 3 takes about 5 hours [S1, S5].",
    "5. Make them equally heavy underwater. We add small metal shot into each hollow body until it weighs 2.60 g plus or minus 0.05 g in water, like loading coins into paper boats until they float alike [S5].",
    "6. Run sanity checks with the control fruits. Three identical copies must agree within 8 percent, or the whole test is void, like making sure a scale reads zero before weighing anything [S5].",
    "7. Drop and film. Each fruit is released fully under water and dropped 10 times in random order while a side camera films at 30 frames per second or faster, like timing runners in several heats [S1, S5].",
    "8. Score against the written guesses with the saved code, then publish every drop, including the bad ones, like opening the sealed envelope and showing all the ballots [S5].",
    "9. Ask a different person to compare wild fruits with the rule that curl should shrink as base angle grows, using pictures only, so nothing needs printing [S5].",
    "10. Turn the result into a formal check. In the project's math-proof library, a short statement says what a body of this kind cannot do, so shapes that break it are ruled out by a computer-checked rule, like a spell-checker for physics claims [S5, S6a].",
]

wrong_if = [
    "The published model is wrong about base angle if the best 15-degree fruit's speed, as a share of the control's, is not near 1.11, or if the 0-degree fruits come out at 1.31 or more [S5].",
    "The simple disk rule is wrong if the 15-degree result is not near 1.18, or if the 0-degree fruits come out below 1.31 [S5].",
    "Both are wrong about the 55-degree fruits if the best one is not between 0.80 and 0.97 of the control's speed, or if they tumble in more than 2 of 10 drops [S5].",
    "Pitch: the model is wrong if the 5-degree tilt does not slow the fruit to about 0.64 (it fails if it is above 0.80), and the disk rule is wrong if either tilt changes speed by more than 12 percent [S5].",
    "The result does not count if three identical controls differ by more than 8 percent, and it is called inconclusive, not a pass, if the 15-degree result is too noisy to separate the two rules [S5].",
    "My own note: on public data the 0-degree speed ratio is 1.50 measured against 1.22 from the model, so the model may already fail one of these tests [S4, S5].",
]

could_go_wrong = [
    "Sinking is not gliding. A spinning fruit does not travel forward, so what we learn about fins and bodies is limited [S5].",
    "The two rules differ by only about 6.5 percent at 15 degrees (1.111 versus 1.183), and public drop-to-drop scatter is 0.3 to 7.5 percent, so noise could hide the difference [S5].",
    "The container may be too narrow. The original tank was 25 cm across and the widest fruits would be about 14 cm across, so the walls could slow them. The plan uses 40 cm or wider [S1, S5].",
    "We do not know exactly what the paper's '1.2 g' loading means. The designer inferred it and built a test to settle it, but the reading is unconfirmed [S5].",
    "Printing can warp the wings and change the curve or tilt, so each fruit is measured and excluded if out of tolerance [S5].",
    "The CAD file is for FreeCAD 0.17 and newer versions may break it, so we may have to rebuild the wing from its numbers [S3r, S5].",
    "A 5-degree wing may not start spinning, which would also count against the model [S5].",
    "Someone may already have done this. One 2024 paper on folded winged fruits had no readable abstract and was not read [S5].",
]

glossary = [
    {"term": "Autorotation", "plain": "Spinning on its own as air or water flows past, the way a maple seed twirls as it falls."},
    {"term": "Terminal descent speed", "plain": "The steady speed a falling object settles at, when the upward push of the fluid balances its weight."},
    {"term": "Fold angle (KL)", "plain": "How strongly the wing is curved: wing length divided by the radius of its curve, in radians (about 57 degrees each)."},
    {"term": "Base angle (psi)", "plain": "The angle at which each wing leaves the body, measured from straight up."},
    {"term": "Wing pitch", "plain": "The tilt of the wing surface against the flow, like tilting your hand out of a car window."},
    {"term": "Blade-element model", "plain": "A computer method that slices each wing into thin strips, adds up the push on each strip, and finds the speed where forces balance."},
    {"term": "Disk-loading rule", "plain": "A simple rival rule: sinking speed depends only on weight divided by the circle the spinning wings sweep out."},
    {"term": "Reynolds number", "plain": "A number that says whether flow is smooth and syrupy or swirly; matching it makes a water test behave like air."},
    {"term": "Strouhal number", "plain": "A number linking how fast something spins to how fast it moves; the model says it stays fixed for a given wing shape."},
    {"term": "Control fruit", "plain": "A copy of the reference shape that every other fruit is compared against, as in a taste test with one standard recipe."},
    {"term": "Freezing predictions", "plain": "Saving the guesses in a file with a fingerprint (hash) before the test, so they cannot be changed afterward."},
    {"term": "Stereolithography (SLA) 3D printing", "plain": "Printing by shining light into liquid resin so it hardens layer by layer."},
    {"term": "Surrogate", "plain": "A stand-in that is easy to build and measure, used to test an idea meant for something harder."},
]

questions = [
    {"q": "Why drop the fruits in water instead of air?",
     "a": "The authors chose water so the flow behaves like a wild fruit falling through air. They say they set it up so two flow numbers (Reynolds and Strouhal) match nature [S1]. Water makes the motion slow enough to film at 30 frames per second [S1]. Matching those numbers does not prove that every detail carries over."},
    {"q": "If the papers already tested this, why do it again?",
     "a": "They tested base angles of 0 and 35 degrees only [S1]. We would test 15 and 55 degrees and two wing tilts. The designer checked citing papers and found none varying these on printed fruits, but one paper could not be read, so this is not certain [S5]. We also use their model as a rival rather than a given."},
    {"q": "Does this tell us how animals glide?",
     "a": "No, not directly. A spinning fruit sinks straight down, and the project's glide-distance rule does not apply to it [S5, S6b]. It tests whether a simple body-and-wing rule holds up in a printed object. A true gliding test would be a follow-up [S5]."},
]

table = [
    {"name": "Stored model, base angle 0 deg (repo file model_data_psi_0.pkl)", "fields": "min_Reynolds=4709; at_KL=2.050; reproduces_within=0.17%", "source": "https://github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds ; re-run: agents2/scratch/t4-glide-lay/check_out.txt"},
    {"name": "Stored model, base angle 15 deg (model_data_camber_psi_15.0.pkl)", "fields": "min_Reynolds=4352; at_KL=1.805; Strouhal=0.608; implied_speed_m/s=0.0725 (my arithmetic 4352e-6/0.06; water kinematic viscosity 1e-6 m2/s is unverified background)", "source": "agents2/scratch/t4-glide-lay/check_out.txt"},
    {"name": "Stored model, base angle 35 deg (model_data_psi_35.pkl)", "fields": "min_Reynolds=3900; at_KL=1.315", "source": "agents2/scratch/t4-glide-lay/check_out.txt"},
    {"name": "Measured, base angle 0, KL 2.31", "fields": "mean_speed_m/s=0.1011; sd=0.0029; drops=10; load_key_g=2.16", "source": "all_results_experiments.pkl in the repo; agents2/scratch/t4-glide-lay/pkl_dump.txt"},
    {"name": "Measured, base angle 35, KL 1.20", "fields": "mean_speed_m/s=0.0676; sd=0.0018; drops=3; load_key_g=2.16", "source": "same"},
    {"name": "Speed ratio 0 deg over 35 deg", "fields": "measured=1.496 (0.1011/0.0676); model=1.2199; disk_rule=1.3905", "source": "agents/design-glide.json and agents/scratch/design-glide/frozen_predictions.json (sha256 a7c7bcaf3269111d0e5662258a4d77eef93f284431756353c001cc5a09ff3f91)"},
    {"name": "Frozen prediction, base angle 15, KL 1.73", "fields": "model_ratio=1.1108 (file value; text says 1.111); disk_ratio=1.1833", "source": "agents/scratch/design-glide/frozen_predictions.json"},
    {"name": "Frozen prediction, pitch 5 vs 15 at base angle 15", "fields": "model_ratio=0.637 (file shows 0.7076/1.1108 against the base-35 control; my arithmetic); disk_ratio=1.00", "source": "agents/scratch/design-glide/frozen_predictions.json"},
    {"name": "Planned build", "fields": "fruits=21; drops_each=10; immersed_weight_g=2.60+/-0.05; control_agreement_limit=8%; tank_width_m>=0.40; tank_height_m>=1.2; video_Hz>=30", "source": "agents/design-glide.json (plan, not yet run)"},
]

glide_gap = [
    "Any result from the planned build: I found none and none of the files I read claim one.",
    "Whether psi=15 or pitch variants were tested in later literature: only inherited from the earlier designer, who read four abstracts and could not read the 2024 folded-fruit paper; I did not search again.",
    "The Formlabs resin density and the cured weight of a fruit: not found; the designer's inference of the loading is unconfirmed.",
    "I did not re-run the earlier designer's disk-rule and pitch calculations (disk.py, predict.py); I re-ran only the model port check and the 0-degree/35-degree measured ratio. The 0.637 pitch ratio is read from the frozen file and my division of two of its entries.",
    "The registry link: the disk rule is the designer's analogue of vmin_le, not a registry law. I read the law text in the 1.8.1 working copy but did not run Lean.",
    "Crossref returned for the Wang et al. (2004) and Lentink et al. (2009) DOIs on a second try only; the first request returned an empty body. The cited facts about what those papers contain were not read by me.",
    "The wording of arXiv quotes comes from a PDF text extraction; ligatures were normalised and the 1.2 m line broke over a space in extraction.",
    "The version of the model/repo: I fetched the master branch zip on 2026-11-12; GitHub reports last push 2019-07-22.",
]

citations = [
    {"authors": "Fauli RA, Rabault J, Carlson A", "year": 2019, "title": "Effect of wing fold angles on the terminal descent velocity of double-winged autorotating seeds, fruits, and other diaspores", "venue": "Physical Review E 100, 013108",
     "doi_or_arxiv": "10.1103/physreve.100.013108 ; arXiv:1811.12221", "verified": True,
     "how_verified": "Fetched https://api.crossref.org/works/10.1103/physreve.100.013108 (title and authors match) and https://export.arxiv.org/api/query?id_list=1811.12221 on 2026-11-12; PDF text read",
     "used_for": "Method, tank, printer, base angles tested, wild fruit fold angle"},
    {"authors": "Rabault J, Fauli RA, Carlson A", "year": 2019, "title": "Curving to Fly: Synthetic Adaptation Unveils Optimal Flight Performance of Whirling Fruits", "venue": "Physical Review Letters 122, 024501",
     "doi_or_arxiv": "10.1103/physrevlett.122.024501 ; arXiv:1902.08038", "verified": True,
     "how_verified": "Fetched https://api.crossref.org/works/10.1103/physrevlett.122.024501 and the arXiv export API on 2026-11-12; abstract read",
     "used_for": "Optimal fold angle and wild-fruit comparison"},
    {"authors": "Wang ZJ, Birch JM, Dickinson MH", "year": 2004, "title": "Unsteady forces and flows in low Reynolds number hovering flight: two-dimensional computations vs robotic wing experiments", "venue": "Journal of Experimental Biology",
     "doi_or_arxiv": "10.1242/jeb.00739", "verified": True,
     "how_verified": "Fetched https://api.crossref.org/works/10.1242/jeb.00739 on 2026-11-12; title and authors match; also listed as reference [52] in the arXiv 1811.12221 text",
     "used_for": "Source of the wing lift and drag curves the model builds on"},
    {"authors": "Lentink D, Dickson WB, van Leeuwen JL, Dickinson MH", "year": 2009, "title": "Leading-Edge Vortices Elevate Lift of Autorotating Plant Seeds", "venue": "Science",
     "doi_or_arxiv": "10.1126/science.1174196", "verified": True,
     "how_verified": "Fetched https://api.crossref.org/works/10.1126/science.1174196 on 2026-11-12; title matches; paper not read",
     "used_for": "Background pointer only: autorotating seeds"},
]

reproduce = [
    {"what": "Fetch the primary sources (Crossref, arXiv, repo README and licence) and print size and sha256", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-lay/fetch.sh (needs curl; two Crossref calls may return empty on a first try; rerun)", "expected": "9 files in agents2/scratch/t4-glide-lay; physreve json 7549 bytes; LICENSE fetch is a 404 note, use lic_LICENSE.txt"},
    {"what": "Download the MIT repo zip (3.07 MB) to D: and unzip", "command_or_url": "curl -L -o repo.zip https://codeload.github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds/zip/refs/heads/master into D:/Users/ashenoy00000/delphi-work/data/glide-seeds/", "expected": "3065098 bytes, sha256 c9c2d661...1fbe51b on 2026-11-12 (changes only if the repo changes)"},
    {"what": "Re-run the model port check against the stored model files (Python 3.14 with numpy 2.5.3, scipy 1.18.1)", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-lay/run_check.sh", "expected": "max relative Reynolds difference at most 0.0017 for all five files; psi=15 minimum Re 4352 at KL 1.805"},
    {"what": "Dump measured speeds and compute the 0/35 degree ratio", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-lay/ratio.sh", "expected": "rows '0, 26, 2.16, 10, 0.1011 ...' and '35, 50, 2.16, 3, 0.0676 ...'; ratio 1.496"},
    {"what": "Rebuild this JSON and re-check every evidence quote against the saved sources", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-lay/build_json.py", "expected": "prints 'quotes checked: N ok, 0 missing' and writes agents2/t4-glide-lay.json"},
    {"what": "Read the registry laws at 1.8.1", "command_or_url": "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/current.json then lean/Delphi/Scaling.lean and lean/Delphi/Flight.lean", "expected": "version 1.8.1; theorems vmin_le and glide_range_le present"},
]


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


# Evidence-quote check
cache = {}
def text_for(k):
    if k not in cache:
        p = SRC[k][1] if k in SRC else SC + k
        cache[k] = norm(open(p, encoding="utf8", errors="replace").read())
    return cache[k]

ok, missing = 0, []
for item in findings + key_claims:
    q = item.get("evidence_quote", "")
    k = item.pop("_k")
    if not q:
        continue
    # allow a '...' elision of the quote only through exact-substring tests of its parts
    parts = [norm(x) for x in re.split(r" - |\*\*", q) if len(norm(x)) > 12] or [norm(q)]
    t = text_for(k)
    # ligature-free comparison of symbols the PDF extractor renders with spaces
    tt = t.replace(" ◦", "◦").replace("1 .2", "1.2")
    qq = [p.replace(" ◦", "◦") for p in parts]
    al=lambda x: re.sub(r'[^0-9a-z]','',x.lower())  # fallback ignores line-break hyphens and spacing
    if all(p in tt for p in qq) or all(al(p) in al(tt) for p in qq):
        ok += 1
    else:
        missing.append((item["claim"][:60], q[:60]))
print("quotes checked: %d ok, %d missing" % (ok, len(missing)))
for m in missing:
    print("MISSING", m)

summary = what_and_why + "\n\nHOW\n" + "\n".join(steps) + "\n\nWHAT WOULD COUNT AS WRONG\n" + "\n".join("- " + x for x in wrong_if) + "\n\nWHAT COULD GO WRONG\n" + "\n".join("- " + x for x in could_go_wrong) + "\n\nQUESTIONS\n" + "\n".join("Q: %s\nA: %s" % (q["q"], q["a"]) for q in questions) + "\n\nSource tags: S1 arXiv 1811.12221; S2 arXiv 1902.08038; S3 MIT repo jerabaul29/EffectFoldAngleAutorotatingSeeds; S4 repo pickle dump (my re-run); S5 delphi-work/agents/design-glide.json (earlier designer, partly re-run); S6a/S6b law set 1.8.1 Scaling.lean / Flight.lean."

lay_summary = (
    "Some tree fruits have two curved wings and spin as they fall, like a helicopter blade, which slows them down so the wind can carry them far. "
    "Scientists 3D-printed such fruits, dropped them in water, and built a computer model that guesses how fast each shape sinks. "
    "We want to write our guesses in a sealed file first, along with the guesses of a much simpler rival rule, and then print 21 new shapes and drop them. "
    "Think of it as calling the score before the match: if both rules miss, that is a real result. "
    "It measures sinking, not sideways gliding, so it is a stand-in test, and so far it is a plan with no results."
)

out = {
    "label": "t4-glide-lay",
    "topic": "Track 4 plain-language explanation: printed double-winged autorotating fruits and the blade-element model",
    "summary": summary,
    "lay_summary": lay_summary,
    "what_and_why": what_and_why,
    "steps": steps,
    "wrong_if": wrong_if,
    "could_go_wrong": could_go_wrong,
    "questions": questions,
    "findings": findings,
    "key_claims": key_claims,
    "table": table,
    "glossary": glossary,
    "recommendations": [
        "Before publishing the lay text, ask the authors what their '1.2 g' loading means; this is the largest unresolved input [S5].",
        "Say aloud in any talk that this tests sinking speed, not gliding, and that the disk rule is our own construction.",
        "Check the lay text's numbers against agents/scratch/design-glide/frozen_predictions.json (sha256 a7c7bcaf3269111d0e5662258a4d77eef93f284431756353c001cc5a09ff3f91) before freezing.",
    ],
    "reproduce": reproduce,
    "citations": citations,
    "could_not_find": glide_gap,
    "scripts_written": [ROOT + "/scripts/t4-glide-lay/" + f for f in ("fetch.sh", "run_check.sh", "ratio.sh", "build_json.py")],
    "source_hashes": {
        "repo.zip_2026-11-12": "c9c2d6617b120bd398c4e3e8e5e1a0e8bd4a82b7dbc5d73b0a551b1205fbe51b (3065098 bytes)",
        "1811.12221.pdf": "695a826495a602874c19ccd2a456439bf82f8ce168d690469cbf816b75535caf (3146306 bytes)",
        "1902.08038.pdf": "5c4c086f40f6a3999385f8b148566969728d24e2a09cbd22277c43a04aed635a (1557171 bytes)",
        "Scaling.lean": sha(SRC["S6a"][1]),
        "Flight.lean": sha(SRC["S6b"][1]),
        "design-glide.json": sha(SRC["S5"][1]),
    },
    "lawset_read": "1.8.1 (lean/registry/lawsets/current.json -> lawset-1.8.1.json)",
}
json.dump(out, open(OUT, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wrote", OUT, os.path.getsize(OUT))
