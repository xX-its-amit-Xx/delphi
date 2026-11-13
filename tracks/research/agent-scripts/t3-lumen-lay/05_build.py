"""Build D:/Users/ashenoy00000/delphi-work/agents2/t3-lumen-lay.json and verify every evidence_quote
verbatim against the fetched source (whitespace and case ignored). Run after 01..04:
  python -I -X utf8 05_build.py"""
import json, re, html
D = "D:/Users/ashenoy00000/delphi-work/data/lumen-lay/"
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/t3-lumen-lay.json"
norm = lambda s: re.sub(r"\s+", "", s).lower()
def strs(o):
    if isinstance(o, str): yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from strs(v)
    elif isinstance(o, list):
        for v in o: yield from strs(v)
rawtxt = lambda p: open(p, encoding="utf8").read()
TXT = {}
TXT["V"] = html.unescape(re.sub(r"<[^>]+>", " ", rawtxt(D + "vasquez_fulltext.xml")))
TXT["M"] = json.load(open(D + "europepmc_mukenhirn.json", encoding="utf8"))["resultList"]["result"][0]["abstractText"]
TXT["A"] = html.unescape(re.sub(r"<[^>]+>", " ", rawtxt(D + "arxiv_guharay.xml")))
LAPP = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/physiology-laplace.json"
TXT["LAP"] = " ".join(strs(json.load(open(LAPP, encoding="utf8"))))
DESP = "D:/Users/ashenoy00000/delphi-work/agents/design-lumen.json"
TXT["DES"] = " ".join(strs(json.load(open(DESP, encoding="utf8"))))
TXT["GH"] = rawtxt(D + "github_lumen_shape.json")
TXT["CRV"] = " ".join(strs(json.loads(rawtxt(D + "crossref_vasquez.json"))))
TXT["CRM"] = " ".join(strs(json.loads(rawtxt(D + "crossref_mukenhirn.json"))))
TXT["DC"] = rawtxt(D + "datacite_zenodo.json")
TXT["CNT"] = ""; TXT["CHK"] = ""; TXT["LS"] = ""
URL = {
 "V": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8460836/fullTextXML",
 "M": "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1016/j.devcel.2024.07.016&resultType=core&format=json",
 "A": "https://export.arxiv.org/api/query?id_list=2509.04316",
 "LAP": LAPP, "DES": DESP,
 "GH": "https://api.github.com/repos/AlexDunnLab/lumen-shape",
 "CRV": "https://api.crossref.org/works/10.1038/s41467-021-25050-3",
 "CRM": "https://api.crossref.org/works/10.1016/j.devcel.2024.07.016",
 "DC": "https://api.datacite.org/dois/10.5281/zenodo.17055495",
 "CNT": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8460836/supplementaryFiles (own counts: " + D + "counts.json, script 02_data_counts.py)",
 "CHK": "own calculation: " + D + "checks.json, script 04_checks.py",
 "LS": "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/lawset-1.8.1.json (own search, script 03_lawset_and_github.py)",
}
bad = []
def F(claim, src, conf, quote="", value=""):
    d = dict(claim=claim, source=URL[src], confidence=conf, value=value, evidence_quote=quote)
    if quote and norm(quote) not in norm(TXT[src]):
        bad.append(claim[:60]); d["confidence"] = "UNVERIFIED-QUOTE"
    return d

findings = [
 F("Hollow spaces (lumens) forming inside solid cell masses is a key step in development, and when it goes wrong it is linked to kidney and other organ disease.", "V", "high",
   "The formation of a hollow lumen in a formerly solid mass of cells is a key developmental process whose dysregulation leads to diseases of the kidney and other organs."),
 F("The popular idea is that fluid pressure pushes the lumen open, and mouse early-embryo experiments support it.", "V", "high",
   "Hydrostatic pressure has been proposed to drive lumen expansion, a view that is supported by experiments in the mouse blastocyst."),
 F("Lumens in other tissues are irregular, with cell faces bowed inward, which hints that pressure is not always the main shaper.", "V", "high",
   "lumens formed in other tissues adopt irregular shapes with cell apical faces that are bowed inward, suggesting that pressure may not be the dominant contributor to lumen shape in all cases."),
 F("Dog-kidney (MDCK) cells in gel form hollow balls on their own within a day.", "V", "high",
   "Under these culture conditions, MDCK cells spontaneously form hollow spheroids within 24 h."),
 F("The authors describe MDCK balls as a standard cell-culture model for lumen formation.", "V", "high",
   "Madin-Darby Canine Kidney cell spheroids, a canonical cell-culture model for lumenogenesis"),
 F("Sphericity of lumens in 7-30-cell balls ranged from about 0.70 down to about 0.3. (A perfect sphere scores 1 by the definition of sphericity: background, not from this page.)", "V", "high",
   "The sphericity of lumens ranged from Ψ ~ 0.70 to very far from spherical (Ψ ~ 0.3)", "0.3 to 0.70"),
 F("A cube scores 0.81 on the same sphericity scale, so these lumens are less round than a cube.", "V", "high",
   "values substantially less spherical than, for example, a cube (Ψ = 0.81)", "0.81"),
 F("Lumens in large balls (radius about 10 micrometres, tens of cells) abruptly become rounder, sphericity about 0.7.", "V", "high",
   "lumens of large MDCK spheroids, with an estimated radius (calculated from lumen volume) of ~10 µm and tens of cells, abruptly transitioned to more spherical shapes", "radius ~10 um; sphericity ~0.7"),
 F("Inner-surface area per cell stayed about the same from 2-cell to more-than-8-cell balls.", "V", "high",
   "the average luminal surface area per cell varied only modestly between spheroids of 2 to >8 cells"),
 F("From that the authors proposed that each cell's inner (apical) surface is actively regulated and added faster than the volume it encloses, giving dented lumens.", "V", "high",
   "This observation suggested an alternate scenario in which the apical surface area per cell was actively regulated, with apical surface area added faster than the equivalent amounts of luminal volume, thus leading to the observed irregular lumen shapes."),
 F("Changing fluid pumping with the drugs ddAVP or ouabain did not strongly change lumen shape in balls of about 4 to tens of cells.", "V", "high",
   "Thus, for lumens of approximately four to tens of cells, modulating fluid pumping via ddAVP or ouabain did not strongly influence lumen shape."),
 F("Cells missing the five main claudin proteins (seals between cells) made lumens whose dentedness was not significantly different from normal.", "V", "high",
   "Cldn-qKO cells formed lumens whose solidity did not differ from wildtype to a significant degree"),
 F("Cells making extra Rab11a protein had a larger inner surface and lumens that were significantly more dented than normal balls with the same cell count.", "V", "high",
   "Rab11a-GFP spheroids generated a significantly larger apical domain and a significantly decreased solidity, compared to wildtype cells with the same number of cells"),
 F("Solidity is lumen area divided by the area of its convex hull (the tightest convex outline).", "V", "high",
   "The solidity metric is defined as the ratio of the lumen area and the area of its convex hull"),
 F("The vertex model has knobs for pressure, preferred inner and outer cell-edge lengths, and how strictly cells hold those lengths.", "V", "high",
   "This model incorporates intraluminal pressure (p), preferred apical and basal domain sizes (la, lb), and a parameter quantifying the stringency with which cells regulate the size of a given membrane domain (k)"),
 F("In the model, more pressure gives a more regular lumen at a given size.", "V", "high",
   "As expected, increasing p led to increases in solidity at a given cell number and relative lumen size"),
 F("In the model, lumens get more regular as cells are added even at zero pressure.", "V", "high",
   "Importantly, lumens tended to have higher solidity with cell number and increasing size even if luminal pressure was zero"),
 F("The model keeps pressure in it, so it can also fit cases where pressure dominates; it is not a 'pressure never matters' model.", "V", "high",
   "A physical model incorporating both cell geometry and intraluminal pressure can account for our observations as well as cases in which pressure plays a dominant role."),
 F("Two of the model's knobs (p and lb) were tuned to agree with the data, so the published fit is not a blind prediction.", "V", "high",
   "The parameters p and lb were free parameters and tuned to agree with data"),
 F("The model is a flat slice of a 3-D object.", "V", "high",
   "First, it models a two-dimensional cross-section of a three-dimensional object."),
 F("The model treats the inner and outer cell surfaces as physically identical.", "V", "high",
   "Second, the model assumes the physical properties of the cell’s apical and basolateral surfaces are identical"),
 F("For the claudin-knockout case the authors cut the model pressure ten-fold, based on measured leakiness.", "V", "high",
   "decreasing p by ten-fold, as expected from measurements of epithelial permeability"),
 F("A separate 2024 paper found that removing the ZO scaffold made MDCK lumens collapse and fold, so tight-junction proteins can matter for shape.", "M", "high",
   "the depletion of the zonula occludens scaffold resulted in lumen collapse and folding of apical membranes"),
 F("The same 2024 paper reports the claudin seal is not needed for the lumen to inflate.", "M", "high",
   "the paracellular ion barrier formed by claudin receptors is not required for the hydraulic inflation of a lumen"),
 F("A 2025 paper reports MDCK cysts also change side and bottom (lateral and basal) tensions, which an inner-surface-only model leaves out.", "A", "high",
   "the cysts respond to these perturbations by significantly modulating their lateral and basal tensions, in addition to the known modulations of pressure and apical belt tension."),
 F("The Vasquez article is open access under CC BY 4.0.", "CRV", "high", "https://creativecommons.org/licenses/by/4.0"),
 F("The 2024 Mukenhirn article carries an Elsevier text-mining licence, so its content cannot simply be redistributed.", "CRM", "medium", "https://www.elsevier.com/tdm/userlicense/1.0/"),
 F("The other-lab data set on Zenodo is CC BY 4.0.", "DC", "high", "Creative Commons Attribution 4.0 International"),
 F("The authors' simulation code is MIT-licensed and was last pushed on 2021-06-04.", "GH", "high", '"spdx_id":"MIT"', "pushed_at 2021-06-04T21:43:48Z"),
 F("Thin-walled sphere: wall stress = P r / (2 t); a wall that holds at most sigma_max caps the pressure at 2 sigma_max t / r. This is the only accepted law in law set 1.8.1 that touches pressurised cavities.", "LAP", "high",
   "For a thin-walled sphere the wall stress is P r / (2 t) and for a cylinder P r / t"),
 F("The library admits it has no real instance for that law (no wall thickness or strength has been supplied).", "LAP", "high",
   "A radius, a wall thickness and a wall strength: none exists in this project for any fish, so the bound is proved with no instance."),
 F("Law set 1.8.1 pins 59 laws; none of the registry law files or Lean files under Delphi/ mentions lumen, cyst or epithelium (own search, script 03).", "LS", "high", "", "59 laws; 0 files"),
 F("The public Source Data bundle (Europe PMC, 14,576,597 bytes) holds 6 xlsx files; the simulation sweep has 15,030 rows.", "CNT", "high", "", "sweep rows 15030; bundle 14576597 bytes; sha256 f9f6691531a59f767d2079f0ffa4301016917d1522671235cf19dfb11e79961f"),
 F("Per-lumen table (Fig 6): 53 normal, 51 Rab11a-GFP, 25 claudin-knockout rows.", "CNT", "high", "", "WT 53; Rab11a-GFP 51; Cldn_qKO 25"),
 F("Cell counts (not shape outcomes) of held-out rows: Rab11a-GFP 44 lumens with 3-10 cells and 7 with more than 10; claudin-knockout 22 with 3-10, 2 with fewer than 3, 1 with more than 10. So 8 held-out lumens exceed 10 cells.", "CHK", "high", "", "Rab11a 44/7; KO 22/2/1"),
 F("Normal-cell lumen solidity (the calibration group only): n=53, median 0.865, quartiles 0.766 to 0.952, range 0.536 to 0.975.", "CNT", "high", "", "median 0.865"),
 F("Critical correlation at the 5 percent level is 0.276 for n=51 and 0.396 for n=25 (own calculation, scipy t distribution), matching the plan's rounded 0.28 and 0.40.", "CHK", "high", "", "0.276; 0.396"),
 F("The plan's earlier pilot (not re-run by me) reports that the best published-sweep setting predicts normal-cell solidity worse than a flat average: RMSE 0.229 against 0.124.", "DES", "low",
   "Best setting by solidity+IPQ RMSE among 151 with la0 in 0.5..0.9: solidity RMSE 0.229, IPQ RMSE 0.298, both worse than the constant."),
 F("The plan states its blindness is only partial: group averages were already seen.", "DES", "high", "Blindness is partial."),
 F("The plan's writer notes the simulation code has not been run and dates from 2021.", "DES", "medium",
   "lumen_vm.py has not been run. It dates from 2021"),
]

kc = [
 dict(claim="In MDCK cell balls the lumen is often dented, not round (sphericity roughly 0.3 to 0.7), and changing pumping or removing claudins did not strongly change that.",
      source=URL["V"], evidence_quote="Thus, for lumens of approximately four to tens of cells, modulating fluid pumping via ddAVP or ouabain did not strongly influence lumen shape."),
 dict(claim="The authors' alternative: each cell makes a roughly fixed amount of inner surface, and extra inner surface (Rab11a) makes lumens more dented at the same cell count.",
      source=URL["V"], evidence_quote="Rab11a-GFP spheroids generated a significantly larger apical domain and a significantly decreased solidity, compared to wildtype cells with the same number of cells"),
 dict(claim="The published model was tuned on the data and is a 2-D slice, so a pre-registered, frozen-prediction test on unseen details is what makes this a real test; blindness is only partial.",
      source=URL["V"], evidence_quote="The parameters p and lb were free parameters and tuned to agree with data"),
 dict(claim="The law library (set 1.8.1) has no law about lumen shape; its only related law is the thin-wall Laplace bound, which has no instance, so no formal elimination can be claimed for this track yet.",
      source=URL["LAP"], evidence_quote="A radius, a wall thickness and a wall strength: none exists in this project for any fish, so the bound is proved with no instance."),
]
for k in kc:
    t = TXT["V"] if k["source"] == URL["V"] else TXT["LAP"]
    if norm(k["evidence_quote"]) not in norm(t): bad.append(k["claim"][:50])

T = lambda n, f, s: dict(name=n, fields=f, source=URL.get(s, s))
table = [
 T("Data: Vasquez 2021 Source Data bundle", "files=6 xlsx; bundle_bytes=14576597; licence=CC BY 4.0 (article); fetched=2026-11-12", "CNT"),
 T("Data: vertex-model sweep (Fig 5)", "rows=15030; knobs=n_cells,l_a,l_l,l_b,P,k; sha256=f06ddb26cbbd84e05f5a78331d541298203041fee38881a62091620f4cf46140", "CNT"),
 T("Data: per-lumen table (Fig 6)", "normal_rows=53; Rab11a_GFP_rows=51; claudin_KO_rows=25; sha256=540a426cc15df88714544267555a0a50f27bf0cb8d2bc1b5543db28cc95c63b5", "CNT"),
 T("Data: other-lab MDCK tables", "Zenodo doi=10.5281/zenodo.17055495; licence=CC BY 4.0; contents=cell counts and stain intensities, not lumen outlines (per design-lumen.json, not re-checked)", "DC"),
 T("Code: AlexDunnLab/lumen-shape", "licence=MIT; size_kb=9907; last_push=2021-06-04; run_by_us=no", "GH"),
 T("Law library", "law_set=1.8.1; laws=59; lumen_laws=0; related=physiology-laplace (accepted, no instance)", "LS"),
 T("Step 1 Pick the lab system", "plain=Dog-kidney (MDCK) cells in gel form tiny hollow balls on their own within a day. They are a standard stand-in for how hollow spaces form in organs.; like=a ring of bricks around an empty room", "V"),
 T("Step 2 Use published measurements", "plain=We do not grow cells. We reuse the authors' open tables of lumen outlines and 15,030 simulated runs, plus their open code.; like=marking someone else's recorded exam answers", "CNT"),
 T("Step 3 Score dentedness with one number", "plain=Solidity: lumen area divided by the area of the smallest convex outline around it. 1 means smooth; lower means dented.; like=stretch a rubber band round a bean-bag shape and compare the filled area", "V"),
 T("Step 4 Write down the rival guesses", "plain=The pressure-balloon guess says every lumen is round (solidity 1). Other guesses are a flat average and a straight line in cell count. The cell-geometry model must beat all of them.; like=a weather forecaster must beat 'tomorrow will be like today'", "DES"),
 T("Step 5 Reproduce first", "plain=Before trusting the published simulation, check that it can match the normal cells at all. If it cannot, we say so.; like=checking a calculator on 2+2 before the tax form", "DES"),
 T("Step 6 Tune on normal cells only", "plain=Set the model's knobs using normal cells and nothing else.; like=learning from one class's marks before guessing another class's", "DES"),
 T("Step 7 Freeze", "plain=Save the settings and the numeric predictions in a dated, fingerprinted record before any test-group result is opened.; like=a sealed envelope", "DES"),
 T("Step 8 Open the envelope once", "plain=Score the frozen model on Rab11a-extra cells, claudin-knockout cells and larger balls, and compare with the simple guesses.; like=a single, unrepeatable exam", "DES"),
 T("Step 9 Try another lab's pictures", "plain=Measure cyst photos from an independent lab, with the method written down first. If fewer than 5 lumens per cell type can be measured, report it as description only.; like=testing a recipe in a friend's kitchen", "DES"),
 T("Step 10 Report everything", "plain=Publish every prediction, including the failures; later ideas go in a separately labelled section.; like=showing the whole scoreboard, not just the wins", "DES"),
 T("Wrong if 1 (reproduction)", "plain=The model cannot beat a flat average at predicting normal-cell dentedness (error above 0.124); then it fails its own entry test.; threshold_source=design-lumen.json P1", "DES"),
 T("Wrong if 2 (stretching)", "plain=In Rab11a cells the inner edge per cell grows with ball size (rank correlation above +0.28), or in knockout cells above +0.40. That fits the pressure-stretches-cells picture instead.; bounds=0.276 and 0.396 computed here", "CHK"),
 T("Wrong if 3 (Rab11a)", "plain=For Rab11a cells the model does no better than the size-only straight line, or that line does not over-predict smoothness.; threshold_source=design-lumen.json P3", "DES"),
 T("Wrong if 4 (claudin knockout)", "plain=The size-only line is off for knockout cells by more than 0.05 on average, or the model predicts a dented lumen the knockout does not show.; threshold_source=design-lumen.json P4", "DES"),
 T("Wrong if 5 (other lab)", "plain=Normal cells from the other lab miss the size line by more than 0.106 on average, or the model explains under half of the extra dentedness in mutants.; threshold_source=design-lumen.json P6", "DES"),
 T("Risk 1 not fully blind", "plain=The authors tuned two knobs on the data, and group averages were already seen. Only per-lumen details, larger balls and other-lab pictures are unseen.", "V"),
 T("Risk 2 model may fail on normal cells", "plain=An earlier pilot, not re-run by me, found the published runs fit worse than a flat average (0.229 vs 0.124).; confidence=low", "DES"),
 T("Risk 3 flat slice of a 3-D object", "plain=The model is 2-D and treats inner and outer cell surfaces alike; a failure may be the slice's fault, not biology's.", "V"),
 T("Risk 4 small samples", "plain=Claudin-knockout lumens with 3 to 10 cells: 22. Lumens with more than 10 cells among held-out groups: 8. Wide error bars.; unit=lumens", "CHK"),
 T("Risk 5 other forces", "plain=A 2025 paper finds cysts also change side and bottom tensions, and a 2024 paper finds ZO loss collapses lumens; an inner-surface-only model may miss this.", "A"),
 T("Risk 6 code untested", "plain=The authors' code dates from 2021 and has not been run by us.", "GH"),
 T("Risk 7 too little other-lab data", "plain=Public other-lab files hold cell counts and stain brightness, not lumen outlines; we may not get enough images.; source=design-lumen.json", "DES"),
 T("Risk 8 the law library says nothing about lumens", "plain=Law set 1.8.1 has no lumen-shape law, so a computer-checked proof would only cover bookkeeping identities, not the biology.", "LS"),
 T("Question 1 Why care about the shape of a hole in a cell ball?", "answer=Hollow spaces line kidneys, liver ducts and blood vessels, and faulty lumen formation is tied to kidney and other disease. This study is basic physics; it does not diagnose or treat anything.", "V"),
 T("Question 2 Dog cells in a dish are not a human organ, so why trust this?", "answer=MDCK balls are a standard model, but they are a simplification, and the model is a 2-D slice. Other labs find extra forces. Any result applies to this system first; carrying it to organs is a separate step.", "V"),
 T("Question 3 If the paper already has the answer, is this a real test?", "answer=Partly. The authors tuned their model and group averages were already seen, so those results are replays. The real test is on unseen per-lumen details, larger balls and another lab's images, and we say which is which.", "DES"),
]
glossary = [
 dict(term="lumen", plain="The hollow space inside a tube, ball or gland made of cells."),
 dict(term="MDCK cells", plain="A line of dog kidney cells widely used in labs because they reliably form hollow balls."),
 dict(term="cyst", plain="Here, a small hollow ball of cells grown in gel."),
 dict(term="apical surface", plain="The side of a cell that faces the hollow space, like the inside wall of a room."),
 dict(term="hydrostatic pressure", plain="The push of trapped liquid against its walls, like water in a balloon."),
 dict(term="solidity", plain="Lumen area divided by the area of its tightest rubber-band outline; 1 is smooth, lower is dented."),
 dict(term="vertex model", plain="A computer model that draws each cell as a corner-linked polygon and finds the shape that uses the least energy."),
 dict(term="baseline", plain="A deliberately simple guess, such as a flat average, that a fancier model has to beat to be worth anything."),
 dict(term="freezing a prediction", plain="Saving the settings and answers in a dated, fingerprinted file before looking at the test data."),
 dict(term="knockout", plain="Cells with a chosen gene switched off, used to see what that gene does."),
]
summary = ("What we are doing and why: hollow tubes and cavities are everywhere in the body, and the shape of the hollow space (the lumen) matters, with faulty lumen formation tied to kidney and other disease. "
 "One popular idea is that fluid pressure inflates the lumen into a smooth balloon. But in a standard lab system, dog-kidney (MDCK) cell balls, the lumens are often dented, and a 2021 study (Vasquez and colleagues) suggested that the number of cells and how much inner surface each cell makes matter more than pressure. "
 "We are not running new experiments. We take that study's open measurements and open simulation and ask whether a simple cell-geometry model, tuned on normal cells only and then locked, can predict dentedness in cells it has not seen, better than simple guesses such as 'every lumen is round' or 'use the average'. "
 "Nothing here shows a cure or a medical effect; the test is partly blind and the model may fail, and we will report either outcome.")
lay = ("Some organs are hollow, and the shape of the hollow space inside matters. A common idea says the liquid inside puffs it into a smooth balloon. "
 "But in dog kidney cells grown as tiny balls, the hollow space is often dented, as if the cells were bricks that each bring a fixed length of wall. "
 "We are testing that bricks idea with a computer model: we set it up using normal cells, lock the settings in a dated file, and only then see how it does on cells it has never seen. "
 "It must beat very simple guesses, like 'it is always round' or 'it is the average'. If it fails, that is a result too, and we will say so.")
recs = [
 "Say 'predict first, then look', not 'we proved'. Tell the reader the test is partly blind (the authors tuned two knobs; group averages were seen).",
 "Say 'pressure matters less than expected in this system', not 'pressure does not matter': the model keeps pressure, and a 2024 paper finds tight-junction loss collapses lumens.",
 "Before any scoring, re-run the WT-only reproduction gate yourself; the 0.229 vs 0.124 pilot figure is from an earlier agent and unchecked.",
 "Do not describe any Lean result as support for the biology: law set 1.8.1 has no lumen law and the only related law (thin-wall Laplace) has no instance.",
]
could = [
 "Did not re-run the earlier designer's pilot, so the 0.229 vs 0.124 comparison (published sweep worse than a flat average on normal cells) is unverified by me.",
 "Deliberately did not read the shape outcomes of Rab11a-GFP or claudin-knockout lumens, to keep the downstream test blind; only row counts and cell counts were read. Also did not read the full text of the 2024 Developmental Cell paper (abstract only).",
 "Did not run the authors' simulation code (lumen_vm.py) or open the figures; no figure value was read.",
 "Could not confirm any public per-lumen shape table from a second lab; the Zenodo record's contents are as described by design-lumen.json, not re-inspected this run.",
 "Found no law in law set 1.8.1 that constrains lumen shape; the earlier law-mapper's cell-geometry laws (Plateau junction etc.) are not in this version of the repo.",
 "The everyday comparisons (bricks, sealed envelope, etc.) are illustrations, not sourced claims.",
]
S = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t3-lumen-lay/"
reproduce = [
 dict(what="Fetch web sources (full text, Crossref, arXiv, DataCite, GitHub-free; Europe PMC) and record bytes and sha256", command_or_url="python -I -X utf8 " + S + "01_fetch_sources.py", expected="8 sources ok:true; Vasquez full text about 207,945 bytes (may change slightly if Europe PMC updates it)"),
 dict(what="Download the Source Data bundle (about 14.6 MB; can take several minutes) and count rows", command_or_url="python " + S + "02_data_counts.py  (Python 3.14.2, pandas 3.0.6, openpyxl; not -I because pandas is in the user site)", expected="sweep_rows 15030; Fig 6 rows WT 53, Rab11a-GFP 51, Cldn_qKO 25; WT solidity median 0.865; fig5 sha256 f06ddb26...f46140"),
 dict(what="Check the law set and the repo metadata (read-only)", command_or_url="python -I -X utf8 " + S + "03_lawset_and_github.py", expected="law set 1.8.1, 59 laws; no file mentions lumen/cyst/epitheli; MIT licence; pushed_at 2021-06-04"),
 dict(what="Own calculations (critical correlations, covariate counts)", command_or_url="python " + S + "04_checks.py  (scipy)", expected="rho_crit_n51 0.276; rho_crit_n25 0.396; N_at_ceiling 12.63; counts as in findings"),
 dict(what="Rebuild this JSON and check every evidence_quote verbatim", command_or_url="python -I -X utf8 " + S + "05_build.py", expected="'quotes failing: 0'"),
]
cit = [
 dict(authors="Vasquez CG, Vachharajani VT, Garzon-Coral C, Dunn AR", year=2021, title="Physical basis for the determination of lumen shape in a simple epithelium", venue="Nature Communications", doi_or_arxiv="10.1038/s41467-021-25050-3", verified=True, used_for="Main system, data, model and most quoted facts", how_verified="Crossref https://api.crossref.org/works/10.1038/s41467-021-25050-3 fetched 2026-11-12 (title, authors, CC BY licence); full text from Europe PMC PMC8460836"),
 dict(authors="Mukenhirn M, Wang CH, Guyomar T, Bovyn MJ, Staddon MF, et al.", year=2024, title="Tight junctions control lumen morphology via hydrostatic pressure and junctional tension", venue="Developmental Cell", doi_or_arxiv="10.1016/j.devcel.2024.07.016", verified=True, used_for="Caveat that tight-junction loss collapses lumens", how_verified="Crossref fetched 2026-11-12; abstract via Europe PMC search API (PMID 39137775); full text not read"),
 dict(authors="Guha Ray C, Mukenhirn M, Honigmann A, Haas PA", year=2025, title="Control of lumen morphology by lateral and basal cell surfaces", venue="arXiv; PRX Life 4, 013037 (2026)", doi_or_arxiv="arXiv:2509.04316 / 10.1103/2y72-hnp2", verified=True, used_for="Caveat that side and bottom tensions also change", how_verified="arXiv export API fetched 2026-11-12 (abstract); journal DOI 10.1103/2y72-hnp2 resolved on Crossref the same day (PRX Life, 2026-03-30)"),
 dict(authors="Guha Ray C, Mukenhirn M, Honigmann A, Haas P", year=2025, title="Data for 'Control of lumen morphology by lateral and basal cell surfaces'", venue="Zenodo", doi_or_arxiv="10.5281/zenodo.17055495", verified=True, used_for="Candidate other-lab data (licence)", how_verified="DataCite https://api.datacite.org/dois/10.5281/zenodo.17055495 fetched 2026-11-12; rights CC BY 4.0"),
]
res = dict(label="t3-lumen-lay", topic="Track 3 plain-language explanation: MDCK cyst lumen shape (Vasquez 2021) and its vertex model",
 summary=summary, lay_summary=lay, findings=findings, key_claims=kc, reproduce=reproduce, citations=cit, could_not_find=could,
 glossary=glossary, recommendations=recs, table=table,
 scripts_written=[S + f for f in ("01_fetch_sources.py", "02_data_counts.py", "03_lawset_and_github.py", "04_checks.py", "05_build.py")])
json.dump(res, open(OUT, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("quotes failing:", len(bad), bad)
print("findings", len(findings), "table", len(table), "wrote", OUT)
