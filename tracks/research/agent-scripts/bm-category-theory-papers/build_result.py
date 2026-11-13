"""Assemble the result JSON and verify every evidence_quote is a verbatim substring of the cited local source text.
Run: python -I build_result.py   (writes agents2/bm-category-theory-papers.json; exits 1 if any quote fails)"""
import json, re, sys, os, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from part_a_paper import A
from part_b_repo_lean import B
from part_c_rest import C, TABLE, REPRODUCE, CITATIONS, COULD_NOT, GLOSSARY, RECS
W = r"D:/Users/ashenoy00000/delphi-work/"
SC = W + "agents2/scratch/bm-category-theory-papers/"
def norm(s):
    s = html.unescape(s)
    s = s.replace("\u2009", " ").replace("\u00a0", " ").replace("\u2003", " ")
    return re.sub(r"\s+", " ", s).strip()
def rd(p): return open(p, encoding="utf-8", errors="replace").read()
cr = json.load(open(SC + "crossref-atoms.json", encoding="utf-8"))["message"]["abstract"]
cr = re.sub(r"<[^>]+>", " ", cr)
lean = rd(W + "upstream/leanbio/lean/ThompsonLaws/Hygromorphs.lean") + "\n" + rd(r"D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean")
SRC = {"paper": norm(rd(SC + "paper.txt")), "repo": norm(rd(SC + "repo_all.txt")), "panels": norm(rd(SC + "gh_panels.txt")),
       "lean": norm(lean), "atoms": norm(cr), "mrs": norm(rd(SC + "mrs.txt")), "wang": norm(rd(SC + "wang.txt"))}

def mk(rows):
    out, bad = [], []
    for claim, source, conf, value, qk, q in rows:
        d = {"claim": claim, "source": source, "confidence": conf}
        if value: d["value"] = value
        if q:
            if norm(q) in SRC[qk]: d["evidence_quote"] = q
            else: bad.append((claim[:60], qk, q))
        out.append(d)
    return out, bad
findings, bad = [], []
for rows in (A, B, C):
    f, b = mk(rows); findings += f; bad += b
# (the cited quote was dropped, not invented, if it failed to verify)

KEY = [
 {"claim": "The JMPS/arXiv paper formalises exactly one biological system, the pine cone (fibre, lamina, tissue, element, organ). Wheat awns, the flytrap, nacre and seed pods carry no equation or parameter; the pine fibre law (eq 6) has no numerical value for any tau, chi or m0.",
  "source": "https://arxiv.org/html/2604.26367v2 (Sec. 3)", "evidence_quote": "Here we instantiate $\\mathsf{Nat}$ on the hygromorphic pinecone hierarchy as an example of a natural system", "qk": "paper"},
 {"claim": "'Preserve dynamics' means the simulation condition d(alpha)_x(f(x,e)) = g(alpha(x), alpha_E(e)); what is proved is closure under composition (chain rule), while model fidelity is explicitly left to experiment, and the repo's 'verified' flag is a tolerance test on recomputed curvature plus speed/temperature windows, not a check of that condition; only equilibrium angles were measured.",
  "source": "https://arxiv.org/html/2604.26367v2 (Sec. 1) and gh_scripts/spec.py", "evidence_quote": "Here, verification is a claim about composition, not about any single model.", "qk": "paper"},
 {"claim": "Re-run this session: HygromorphCeilingCheck.lean (f <= 3/(2h), equality at m^2 n = 1, bilayer_rules_out) and a scratch copy of Hygromorphs.lean compile with errors=0 and no sorryAx; the flat-space Dyn category, Timoshenko eq 15-16, eq 13 and eq 28 are checked, the ceiling is not in the paper, and alpha_1, alpha_2, alpha_geom, alpha_3, F, eta, eq 18, Spec/Comp/pi/E are not checked.",
  "source": "local tracks/lean + upstream/leanbio/lean/ThompsonLaws/Hygromorphs.lean; logs in agents2/scratch/bm-category-theory-papers/lean-*.log", "evidence_quote": "theorem bilayer_rules_out (h m n Δε κ_claimed : ℝ) (hh : 0 < h) (hm : 0 < m) (hn : 0 < n)", "qk": "lean"},
 {"claim": "Proposition A.25 (alpha_geom is a Dyn morphism) needs tau_L = tau_T = tau_Delta and equal moisture in the two laminae, which the paper never states; with tau_L=1, tau_T=5 two states with the same (Delta_eps, m_A, m_B) have d(Delta_eps)/dt of -0.0095 and -0.0895. Also, conjugacy fixes tau, so 'F is parameter substitution' cannot cover a change of time constant.",
  "source": "own calculation: agents2/scripts/bm-category-theory-papers/closure_check.py; paper eq 6, 17, A.25, A.42", "evidence_quote": "This is exactly the element law used in Section 3.", "qk": "paper"},
]
key_claims = []
for k in KEY:
    q = k.pop("evidence_quote"); qk = k.pop("qk")
    if norm(q) in SRC[qk]: k["evidence_quote"] = q
    else: bad.append((k["claim"][:60], qk, q))
    key_claims.append(k)

SUMMARY = (
"IN PLAIN LANGUAGE. The paper treats each size level of a material (a fibre, a layer, a strip, a whole pine-cone scale) as a small machine that takes in a stimulus such as humidity and changes shape. Each step that rolls a fine level up into a coarser one is a 'morphism'. A morphism 'preserves dynamics' if letting the fine machine run and then summarising gives the same result as summarising first and then letting the coarse machine run. The authors chain five such levels for the pine cone, swap the biological numbers for printable-plastic numbers, and print four bending and twisting strips whose measured angles land within one standard deviation of prediction. "
"PRECISELY. Objects of Dyn are triples (X,E,f) with xdot=f(x,e); morphisms are smooth pairs (alpha,alpha_E) with d(alpha)_x f(x,e) = g(alpha(x),alpha_E(e)) (eq 4). Only the pine cone is instantiated: fibre relaxation law (eq 6), lamina average (eq 8), two-lamina stack with cos^2/sin^2 projection (eq 13-14), element curvature kappa=C_geom*d_eps with the Timoshenko coefficient (eq 15-16), organ angle theta=L*kappa (eq 18). Wheat awns, seed pods, the flytrap and nacre get one motivating sentence and no equation or parameter, so the brief's premise for them is wrong (confirming the earlier agent). No numeric tau, chi or m0 is given in the paper; the only numbers live in Grasshopper material panels, which I decoded (PA6-GF E=2850 MPa, PA612-CF15 5140, PLA 3500, PLA-CF 6000, plus pine_sclereid E=30 MPa and pine_sclerenchyma E=650 MPa). "
"PROVED vs EXPERIMENT. On paper the authors prove only structural facts (Dyn is a category by the chain rule; F, pi, E are functors; several scale maps are morphisms), many of them definitional; they say plainly that model fidelity 'remains empirical'. The experiment is four strips (n=3,3,4,3), equilibrium angles only, no time data. WHAT THE CODE COMPUTES: closed-form equilibrium algebra (eps=chi*du, Timoshenko, angle=degrees(kappa*L)); Nat and Art run identical code on different panels; alpha_1 is run with N=1; 'verified' is a 5-percent tolerance and window check, not the simulation condition; the twist reuses the bending coefficient. I reproduced one of four Table 3 predictions (41.3 degrees at du=1.0) and give the implied step for the others (0.53, 92.4 K, 71.1 K). "
"NEW HERE. I compiled the Lean files this session (no errors, standard axioms only). The Timoshenko ceiling f<=3/2 with equality at m^2 n=1 is machine-checked and is not in the paper; the paper's printed pairs sit at 97.8 to 98.2 percent of it. I found two unstated hypotheses behind the paper's alpha_geom proposition (equal relaxation times and equal laminar moisture) and a scalar proof that no change of coordinates can turn one relaxation time into another, so 'F is parameter substitution' needs a time-rescaling. From Atoms to Swarms (Buehler, ChemRxiv 2026-05-07) is an Account that calls category theory 'a vocabulary, not a source of theorems'; only its abstract was readable (HTTP 403 on the body). Ranked formalisation targets and the joint-paper additions are in findings and recommendations."
)

LAY = ("Think of a pine cone scale as a tiny machine: when the air gets damp it bends, and the paper describes that machine as a stack of simple steps from a single fibre up to the whole scale. The authors use a branch of mathematics to say that each step must respect how the thing changes in time, and then they print plastic strips that bend or twist in water or heat. "
"Their strips matched the predicted angles, but they only measured the final bend, not how fast it happens, and they did not check the maths with a computer. "
"We re-ran the computer proof checker on our own results and it passed: it proves that no two-layer strip can bend more than a fixed amount, and the authors' strips are already about 98 percent of the way to that limit. "
"We also found two quiet conditions the authors' argument needs, and the code does not test the key rule at all. "
"A joint paper could add a design that a checked theorem rejects, a timing test, and a version for resin and powder printers.")

out = {
 "label": "bm-category-theory-papers",
 "topic": "Category theory for materials: Marom-Tibbits-Zardini-Buehler and the Atoms to Swarms spine",
 "summary": SUMMARY, "lay_summary": LAY,
 "findings": findings, "key_claims": key_claims, "reproduce": REPRODUCE, "citations": CITATIONS,
 "could_not_find": COULD_NOT, "glossary": GLOSSARY, "recommendations": RECS, "table": TABLE,
 "scripts_written": [W + "agents2/scripts/bm-category-theory-papers/" + n for n in
   ["html2txt.py", "fetch_repo.py", "gh_panels.py", "reproduce_pipeline.py", "closure_check.py", "check_no_numbers.py", "ceiling_fraction.py", "part_a_paper.py", "part_b_repo_lean.py", "part_c_rest.py", "build_result.py"]],
}
os.makedirs(W + "agents2", exist_ok=True)
json.dump(out, open(W + "agents2/bm-category-theory-papers.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("findings", len(findings), "key_claims", len(key_claims), "unverified quotes", len(bad))
for b in bad: print("BAD QUOTE:", b)
sys.exit(1 if bad else 0)
