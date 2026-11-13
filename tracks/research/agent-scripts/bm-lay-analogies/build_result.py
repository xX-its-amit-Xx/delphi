"""Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-lay-analogies.json after (1) verifying every evidence_quote verbatim
against the fetched sources and (2) computing a readability grade for each explanation. Run order: fetch_sources.py,
verify_dois.py, calc.py, lean_demo.sh, build_result.py."""
import json, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sources_check as sc
from bank import BANK
from findings import FINDINGS

OUTFILE = "D:/Users/ashenoy00000/delphi-work/agents2/bm-lay-analogies.json"
S = sc.load()
calc = json.load(open(os.path.join(HERE, "calc_out.json")))

# ---- (1) quote verification
log = []
for f in FINDINGS:
    q = f["evidence_quote"]
    if q:
        ok = sc.norm(q) in S[f["qsrc"]]
        log.append({"claim": f["claim"][:70], "src": f["qsrc"], "found": ok, "words": len(q.split())})
        assert ok, "quote not found: " + q[:80]
        assert len(q.split()) <= 40, "quote too long: " + q[:60]
json.dump(log, open(os.path.join(HERE, "quote_check.json"), "w"), indent=1)

# ---- (2) readability: Flesch-Kincaid grade, rough syllable heuristic (own implementation)
def syl(w):
    w = w.lower(); w = re.sub(r"[^a-z]", "", w)
    if not w: return 0
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and not w.endswith("le") and n > 1: n -= 1
    return max(n, 1)
def fk(text):
    t = re.sub(r"\[[^\]]*\]", "", text)                       # drop [calc] tags
    sents = [s for s in re.split(r"(?<=[.!?])\s+", t) if s.strip()]
    words = re.findall(r"[A-Za-z]+(?:'[a-z]+)?", t)
    sy = sum(syl(w) for w in words)
    return 0.39 * len(words) / len(sents) + 11.8 * sy / len(words) - 15.59, len(sents), len(words)
read = []
for b in BANK:
    g, ns, nw = fk(b["explanation"])
    b["sentences"] = ns
    read.append({"id": b["id"], "fk_grade": round(g, 1), "sentences": ns, "words": nw})
json.dump(read, open(os.path.join(HERE, "readability.json"), "w"), indent=1)
print("readability:", [(r["id"][:2], r["fk_grade"], r["sentences"]) for r in read])

# ---- table: the bank (one row per entry) + number rows
table = []
for b in BANK:
    table.append({
        "name": b["id"] + ": " + b["topic"],
        "fields": ("explanation=" + b["explanation"] + " | everyday_comparison=" + b["everyday_comparison"] +
                   " | where_it_breaks=" + b["where_it_breaks"] + " | common_wrong_idea=" + b["common_wrong_idea"] +
                   " | sentences=" + str(b["sentences"])),
        "source": b["source"],
    })
fl = "https://formlabs.com/support/solvent-compatibility/"
table += [
 {"name": "Formlabs 24 h 1 cm cube weight gain (re-read 2026-11-12)",
  "fields": "Rigid 10K: water=<0.1 %, IPA=<0.1 % | Elastic 50A V2: water=0.7 %, IPA=39.2 % | Elastic 50A V1: water=2.3 %, IPA=25.6 % | Flexible 80A (version not stated): water=0.7 %, IPA=11.7 % | Silicone 40A: water=<0.1 %, IPA=5.9 % | Clear V5: water=0.9 %, IPA=0.3 %", "source": fl},
 {"name": "Flexible 80A V2 data sheet, ASTM D471 full immersion in deionized water",
  "fields": "1 day: hardness_change=-26 Shore A points, mass=+8 %, volume=+3 % | 1 week: hardness=-27, mass=+9 %, volume=+7 % | specimen thickness=not stated",
  "source": "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf"},
 {"name": "Ceiling: tightest possible radius R_min = h / (1.5 x mismatch)  [calc]",
  "fields": "h=0.4 mm: 133 / 53 / 27 / 13 mm at mismatch 0.2 / 0.5 / 1 / 2 % | h=0.8 mm: 267 / 107 / 53 / 27 mm | h=1.6 mm: 533 / 213 / 107 / 53 mm", "source": "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/calc_out.json (Rmin_table)"},
 {"name": "Mismatch needed for a target radius at the ceiling  [calc]",
  "fields": "R=50 mm: 0.533 % (h=0.4 mm), 1.067 % (0.8 mm), 2.133 % (1.6 mm) | R=25 mm: 1.067 %, 2.133 %, 4.267 % | R=100 mm: 0.267 %, 0.533 %, 1.067 %", "source": "calc_out.json (strain_needed_table)"},
 {"name": "0.7 percent water uptake in everyday units  [calc]",
  "fields": "per 1 g resin=7 mg | per 1.21 g cube=8.5 mg | drops (0.05 mL)=0.14 per g, 0.17 per cube | 8 % uptake=80 mg per g=1.6 drops | length change estimate=0.087-0.282 % | on 40 mm strip=0.035-0.113 mm | bilayer tip (h=0.8 mm, L=40 mm, ceiling, passive partner)=1.3-4.2 mm | amplification=0.75 L/h=37.5",
  "source": "https://en.wikipedia.org/wiki/Drop_(unit) ; calc_out.json"},
 {"name": "Time to 90 percent of final water, layer open on one face  [calc]",
  "fields": "D=1e-12 m2/s: 0.2 mm=9.4 h, 0.4 mm=37.7 h, 0.8 mm=150.8 h, 1.6 mm=603 h | D=1e-11: 0.94 h, 3.8 h, 15.1 h, 60.3 h | D=1e-9: 34 s, 2.3 min, 9 min, 36 min | constant=0.848 h^2/D",
  "source": "calc_out.json (t90_table)"},
 {"name": "Stiffness ratio vs curl at equal thickness  [calc]",
  "fields": "n=1: f=1.5 | n=3.5: 1.349 | n=10: 0.9959 (66 % of ceiling) | n=100: 0.2105 | n=1000: 0.0237 | at m=n^-1/2: f=1.5 for every n", "source": "calc_out.json (stiffness_table)"},
 {"name": "Pine cone scale numbers",
  "fields": "alpha=0.001 per %RH (+-0.0001) | length change 0-100 %RH=about 10 % [calc] | curvature change=1.3 cm^-1 at h=1 mm | opening angle=about 75 deg | tau=h^2/D=about 1000 s at D=1e-9 m2/s, h=1 mm | measured drying=96 h_a^1.5 min, wetting=29 h_a^1.3 min (h_a mm)",
  "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/"},
 {"name": "Thermal diffusivity (heat) vs water diffusivity",
  "fields": "steel AISI 1010=18.8 mm2/s | nylon=0.09 mm2/s | water in dense resin=about 1e-6 mm2/s (1e-12 m2/s) | ratio steel/water-in-resin=1.9e7 | 1 mm steel t90=0.045 s | 1 mm resin t90=9.8 d",
  "source": "https://en.wikipedia.org/wiki/Thermal_diffusivity ; https://pmc.ncbi.nlm.nih.gov/articles/PMC12986659/ ; calc_out.json"},
 {"name": "Readability of the nine explanations (Flesch-Kincaid grade, own heuristic)",
  "fields": "; ".join(f"{r['id'][:2]}={r['fk_grade']}" for r in read), "source": "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/readability.json"},
]

findings = [{k: v for k, v in f.items() if k != "qsrc"} for f in FINDINGS]

SUMMARY = (
 "Nine plain-language explanations were written, each with a 3-6 sentence paragraph, an everyday comparison, a note on where the comparison breaks, a one-line common wrong idea and its source; "
 "all quoted evidence was checked word for word against the pages and PDFs fetched in this run (quote_check.json; a doctored control quote correctly fails). "
 "Topics: pine cone opening (Reyssat and Mahadevan 2009: opens dry, closes wet, dead tissue works, active cells change length about 10 % between dry and saturated air), bilayer as bimetal strip, what a Lean law is, proof versus simulation, why a ceiling rules out designs, what 0.7 % water uptake means, why thin is faster, why a stiffer partner does not curl more, and why Elastic 50A swells in alcohol but not water. "
 "New beyond the earlier files: (1) the 3/2 ceiling is readable in the 1863 bimetal formula, kappa = 3/(2a) x mismatch/h with a = 1 + (square) >= 1, which I showed equals the project coefficient to 7e-16 over 200,000 random cases, so a layperson can see the ceiling without Lean; Holstov 2015 had already plotted it, so it is not a new discovery, only a newly proved one. "
 "(2) I re-ran the Lean check (5 theorems, 0 errors, 0 sorryAx) and two false versions (ceiling 7/5), which Lean refuses. "
 "(3) 0.7 % water uptake is 7 mg per gram, about a sixth of a drop for a 1.2 g cube; I estimate 0.09-0.28 % length change, and a bilayer magnifies a stretch by 0.75 L/h = 37.5 (tip moves 1.3-4.2 mm on a 40 mm, 0.8 mm strip at best). "
 "(4) CONTRADICTION: the earlier claim that every current Formlabs SLA resin gains under 1 % in water is false for Flexible 80A V2 (+8 % mass in 1 day, ASTM D471 slab); the 0.7 % is the cube test on a differently named resin row; the sibling file bm-resin-water-uptake-data.json reached the same correction and I confirm it from the PDF. "
 "(5) The 39 % isopropanol figure is Elastic 50A V2 (V1 is 25.6 %), confirmed against Rigid 10K <0.1 %. "
 "(6) The thin-is-faster rule is a 4x law only ideally; pine cones measure exponents 1.3-1.5, and bimetal heat is 19 million times faster than water in dense resin, which is where the bimetal analogy fails most. "
 "No measured humid-air swelling or water diffusivity exists for any Formlabs resin; all such figures here are labelled estimates.")

LAY = (
 "A pine cone is made of two layers stuck together. When the air dries out, one layer shrinks and the other does not, so each scale bends open. "
 "Printed plastic can do the same thing if two layers swell by different amounts, but plastic swells far less than a pine cone does. "
 "We checked, with a computer program that accepts only complete proofs, that a two-layer strip can never curl tighter than a fixed limit set by its thickness and how much it swells. "
 "That means we can rule out some shapes on paper before wasting a print. "
 "Thin strips respond faster, but the time falls with the square of the thickness, so a strip half as thick is about four times quicker in theory and about two and a half times in real cones.")

GLOSSARY = [
 {"term": "Bilayer", "plain": "Two layers stuck face to face, as in the scale of a pine cone."},
 {"term": "Bimetal strip", "plain": "Two metals bonded together that bend when heated because they expand by different amounts."},
 {"term": "Swelling mismatch (differential strain)", "plain": "How much more one layer lengthens than the other, as a fraction of its length."},
 {"term": "Curvature", "plain": "How sharply a strip bends: one divided by the radius of the circle it follows."},
 {"term": "Ceiling (upper bound)", "plain": "A limit that no choice of layers can beat; here, 1.5 times the mismatch divided by the strip's thickness."},
 {"term": "Lean", "plain": "A computer program that checks mathematical proofs step by step and refuses incomplete ones."},
 {"term": "Proof vs simulation", "plain": "A proof covers every case at once; a simulation only checks the cases it tries."},
 {"term": "Water uptake (mass percent)", "plain": "How much heavier a part gets when it absorbs water, as a percent of its starting weight."},
 {"term": "Diffusion / diffusivity D", "plain": "Slow spreading of water into a material; D says how fast, in square metres per second."},
 {"term": "Modulus (stiffness)", "plain": "How hard a material pushes back when you stretch or bend it."},
 {"term": "Hygromorph", "plain": "A material that changes shape when humidity changes."},
 {"term": "Resin / SLA", "plain": "Liquid plastic hardened by light in a printer (Form 4 uses this)."},
]

KEY_CLAIMS = [
 {"claim": "A pine-cone scale is a two-layer structure that opens when dried and closes when wetted, and dead fallen cones keep doing this, so the explanation needs no living process.",
  "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/",
  "evidence_quote": "But when dead fallen dry cones are moved into a humid environment, they close and open again when dried, an experiment that may be repeated many times."},
 {"claim": "The curl ceiling kappa <= 1.5 x mismatch / h is both Lean-checked (this run: 5 theorems, 0 errors, 0 sorryAx) and visible in the classical 1863 bimetal formula, where kappa = 3/(2a) x mismatch/h and a = 1 + a square >= 1; it is not new (Holstov 2015 plotted it) but its proof is.",
  "source": "https://en.wikipedia.org/wiki/Bimetallic_strip ; HygromorphCeilingCheck.lean ; https://ndownloader.figshare.com/files/69786426",
  "evidence_quote": "Plotting f(m,n) for a wide range of possible stiffness ratios shows that the maximum value of the function remains constant at 1.5"},
 {"claim": "Formlabs' 0.7 % is a 24-hour weight gain of a 1 cm cube for the rows Flexible 80A and Elastic 50A V2, not an equilibrium value and not a size change; Flexible 80A V2 gains +8 % mass in one day by another method, so no single 'water uptake of Formlabs resins' exists.",
  "source": "https://formlabs.com/support/solvent-compatibility/ ; https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf",
  "evidence_quote": "Formlabs measures resistance to solvents by observing, measuring, and weighing printed cubes (originally measuring 1 cm × 1 cm × 1 cm) before and after immersion in a solvent for 24 hours."},
 {"claim": "Diffusion time scales as thickness squared in the ideal case (4x for double thickness), but pine-cone data give exponents 1.5 (drying) and 1.3 (wetting), so real strips are 2.5 to 4 times faster when half as thick.",
  "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/",
  "evidence_quote": "the shrinking (drying) time varies as τ d = 96 h a 1.5 min and the swelling (wetting) time varies as τ d = 29 h a 1.3 min (where h a is in mm)"},
]
for k, src in zip(KEY_CLAIMS, ["reyssat", "holstov", "formlabs", "reyssat"]):
    assert sc.norm(k["evidence_quote"]) in S[src], k["claim"][:40]

REPRODUCE = [
 {"what": "Fetch every public page/PDF used, record URL/date/bytes/sha256 (python 3, pypdf 6.19.0)", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/fetch_sources.py", "expected": "'ok <name> <bytes>' lines; MANIFEST.json in D:/Users/ashenoy00000/delphi-work/data/bm-lay/. holstov2015.pdf sha256 starts 20901bd2a597; 17 MB total."},
 {"what": "Verify DOIs at Crossref/DataCite", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/verify_dois.py", "expected": "title/year for each DOI; 10.1126/science.1140097 resolves to a DIFFERENT paper (wheat awns) and is not cited."},
 {"what": "All arithmetic (ceiling table, sampling, Euler polynomial, uptake in drops, Crank constants, steel vs water)", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/calc.py", "expected": "villarceau diff ~7e-16; sampling max 1.49999999997; Euler failure at n=40 (1681); 0.7 % -> 7 mg/g, 0.14 drop/g; crank tau90 0.848; calc_out.json written."},
 {"what": "Lean kernel check plus two deliberately false claims (needs elan toolchain in C:/Temp/elan, project Mathlib; one Lean process; ~15 s; writes nothing in the repo)", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/lean_demo.sh", "expected": "'errors=0 sorryAx=0 axiom-lines=5/5', 'ALL CHECKED'; then two 'error: linarith failed to find a contradiction' for the 7/5 claim; sorry version lists sorryAx. Output saved in scratch/bm-lay-analogies/lean_check_out.txt."},
 {"what": "Check every evidence quote verbatim against the fetched sources, compute readability, write the result file", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/build_result.py", "expected": "no assertion error; quote_check.json (all found=true); readability.json; D:/Users/ashenoy00000/delphi-work/agents2/bm-lay-analogies.json"},
 {"what": "By hand: Formlabs table row", "command_or_url": "https://formlabs.com/support/solvent-compatibility/", "expected": "Elastic 50A Resin V2: Isopropyl Alcohol 39.2, Water 0.7; Rigid 10K: <0.1 and <0.1 (page may change)."},
]

CITATIONS = [
 {"authors": "Reyssat E, Mahadevan L", "year": 2009, "title": "Hygromorphs: from pine cones to biomimetic bilayers", "doi_or_arxiv": "10.1098/rsif.2009.0184", "verified": True, "how_verified": "Crossref https://api.crossref.org/works/10.1098/rsif.2009.0184 returned title, J R Soc Interface, 2009; full text read at https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/", "used_for": "pine cone mechanism, dead tissue, alpha, opening angle, tau = h^2/D and measured exponents, f(m,n) limits", "venue": "J. R. Soc. Interface 6(39):951-957"},
 {"authors": "Timoshenko S", "year": 1925, "title": "Analysis of Bi-Metal Thermostats", "doi_or_arxiv": "10.1364/JOSA.11.000233", "verified": True, "how_verified": "Crossref returned title, Journal of the Optical Society of America, 1925; text not read (cited via Reyssat and Holstov)", "used_for": "origin of the bilayer equation used for bimetal strips and hygromorphs", "venue": "J. Opt. Soc. Am. 11:233"},
 {"authors": "Holstov A, Bridgens B, Farmer G", "year": 2015, "title": "Hygromorphic materials for sustainable responsive architecture", "doi_or_arxiv": "10.1016/j.conbuildmat.2015.08.136", "verified": True, "how_verified": "Crossref returned title and authors (Holstov; Bridgens; Farmer), Construction and Building Materials, 2015; DataCite 10.25405/ncl.34238076 resolves to the open copy; PDF fetched, sha256 20901bd2...", "used_for": "maximum of f(m,n) stays at 1.5; 60 % loss at equal thickness", "venue": "Constr. Build. Mater."},
 {"authors": "Dawson J, Vincent JFV, Rocca A-M", "year": 1997, "title": "How pine cones open", "doi_or_arxiv": "10.1038/37745", "verified": True, "how_verified": "Crossref returned title 'How pine cones open', Nature, 1997-12-18; article text NOT read, cited only as the reference Reyssat and Mahadevan give for the cell-level mechanism", "used_for": "background reference for the cone mechanism (claims rest on Reyssat, not on this paper)", "venue": "Nature 390:668"},
 {"authors": "de Moura L, Ullrich S", "year": 2021, "title": "The Lean 4 Theorem Prover and Programming Language", "doi_or_arxiv": "10.1007/978-3-030-79876-5_37", "verified": True, "how_verified": "Crossref returned title, Lecture Notes in Computer Science, 2021; abstract/text not read", "used_for": "citation for what Lean 4 is", "venue": "CADE-28, LNCS 12699"},
 {"authors": "The mathlib Community", "year": 2020, "title": "The lean mathematical library", "doi_or_arxiv": "10.1145/3372885.3373824", "verified": True, "how_verified": "Crossref returned title and venue (CPP 2020); text not read", "used_for": "the proof file imports Mathlib; citation for that library", "venue": "CPP 2020"},
 {"authors": "Porojan L, Bejan A, Vasiliu R, Gherban R", "year": 2026, "title": "Surface Characteristics and Hydrolytic Stability in Milled and 3D-Printed PMMA Dental Materials", "doi_or_arxiv": "10.3390/polym18050597", "verified": True, "how_verified": "Crossref returned title and authors, Polymers 2026; full text read at https://pmc.ncbi.nlm.nih.gov/articles/PMC12986659/", "used_for": "order-of-magnitude water diffusivity (0.85e-12 m2/s) of a printed methacrylate resin (not a Formlabs resin)", "venue": "Polymers 18(5):597"},
]

COULD_NOT = [
 "A measured hygroscopic strain, humid-air uptake or water diffusivity for ANY Formlabs resin or powder: still none in the sources read (agrees with the earlier files and bm-resin-water-uptake-data.json). Every strain and timing figure for Formlabs materials here is an estimate and labelled so.",
 "The size and density of the Flexible 80A V2 and Elastic 50A specimens. I used Clear Resin V5's density (1.21 g/cm3) as a stand-in for the 1 cm cube mass, and the Flexible 80A V2 data sheet does not state slab thickness.",
 "Why the Flexible 80A V2 table's volume column looks inconsistent with its mass column for solvents (isooctane +56 % mass, +164 % volume); the water-derived strain per percent mass (0.12) is therefore low confidence.",
 "The full text of Dawson, Vincent and Rocca 1997 and of Timoshenko 1925 (paywalled); their roles rest on Reyssat and Mahadevan and Holstov. I also tried a DOI from memory for a pine-cone paper by Elbaum et al.; it resolved to a different paper (wheat awns), so I dropped it rather than cite it.",
 "A source for why the soft Elastic 50A resin takes up isopropanol but not water (general polymer chemistry), for the cooking comparison (heat spreading by the same square law, not tested here), and for the statement that pine-cone scales' purpose is seed release; none is load-bearing.",
 "The ETH beech numbers (0.91 to 1.53 of the ceiling) were not re-derived; they come from the sibling file bm-wood-cellulose-hygromorphs.json.",
 "Any test of the explanations on real non-scientist readers; the 9th-grade level is checked only by a Flesch-Kincaid estimate (my own syllable heuristic), which counts neither numbers nor technical terms well.",
 "Europe PMC full-text XML for Reyssat returned HTTP 500; the PMC HTML page was used instead (same text).",
 "Whether other Lean theorems in the project beyond the five in HygromorphCeilingCheck.lean hold; only that file was run.",
]

RECS = [
 "Always say 'mass percent in a 24 h cube test' when quoting a Formlabs water uptake, and never 'water uptake of Formlabs resins' as one figure: Flexible 80A V2 is +8 % in a day.",
 "When explaining the ceiling to the architecture practice, show the 1863 formula (a = 1 + square) beside the Lean proof: a layperson can see that no choice beats 1.5, and credit Holstov 2015 for the numerical observation.",
 "State the limits of Lean every time it is mentioned: it proves the maths of the model, not that a printed strip will behave.",
 "Measure it: coupon strips of Rigid 10K and Flexible 80A V2 weighed and measured at 24 h, 1 week and equilibrium would turn every labelled estimate here (strain per percent mass, D) into data.",
 "If a hands-on demo is wanted for visitors, use the paper-and-tape curl or a real pine cone in a bowl of water (cone closes, then reopens on drying) as the opening act before showing the printed sample.",
]

result = {
 "label": "bm-lay-analogies",
 "topic": "Plain-language explanations that are also correct",
 "summary": SUMMARY, "lay_summary": LAY, "glossary": GLOSSARY,
 "findings": findings, "key_claims": KEY_CLAIMS, "table": table,
 "recommendations": RECS, "reproduce": REPRODUCE, "citations": CITATIONS, "could_not_find": COULD_NOT,
 "scripts_written": [
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/fetch_sources.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/verify_dois.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/calc.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/lean_demo.sh",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/sources_check.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/bank.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/findings.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lay-analogies/build_result.py"],
}
json.dump(result, open(OUTFILE, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wrote", OUTFILE, os.path.getsize(OUTFILE), "bytes;", len(findings), "findings;", len(table), "table rows")
