# Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-lean-materials-laws.json (run: python -I build_result.py)
import json, os, re
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-lean-materials-laws.json"
S = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws"
LB = "D:/Users/ashenoy00000/delphi-work/upstream/leanbio/lean/ThompsonLaws"
MG = S + "/mathlib_grep_out.txt"
AX = "[propext, Classical.choice, Quot.sound]"


def row(name, fields, source):
    return {"name": name, "fields": fields, "source": source}


table = [
    row("Rule of mixtures: Voigt (equal strain) vs Reuss (equal stress), 2-phase and n-phase ordering",
        "difficulty=easy; status=PASSED (kernel, no sorryAx); mathlib=field_simp/convexOn_zpow; reason=exact identity E_V*(f/E1+(1-f)/E2)-1 = f(1-f)(E1-E2)^2/(E1E2) makes Reuss<=Voigt a sign check, n-phase is Jensen for x^-1",
        S + "/VoigtReuss.lean"),
    row("Voigt and Reuss as PHYSICAL bounds on any microstructure (energy principles)",
        "difficulty=hard; status=not attempted; reason=needs minimum potential energy and complementary energy theorems over admissible displacement/stress fields; Mathlib has no elasticity (0 files mention Young's modulus or Voigt)",
        MG),
    row("Hashin-Shtrikman bounds (closed forms nested inside Voigt-Reuss)",
        "difficulty=moderate for the closed-form ordering HS_lower<=HS_upper inside [Reuss,Voigt] (rational-function inequalities in K,G and volume fraction); hard if derived variationally; status=not attempted",
        "https://doi.org/10.1016/0022-5096(63)90060-7 (Crossref metadata only; text not read)"),
    row("Gibson-Ashby cellular scaling E*/Es = C (rho*/rhos)^n",
        "difficulty=easy as named-hypothesis power-law algebra (rpow ratio and log-slope lemmas, same shape as CubeLaw in lean/Delphi/Scaling.lean); moderate to derive n=2 (open cell) from strut bending (rho ~ (t/l)^2, E ~ I/l^4 ~ (t/l)^4); the constant C and the choice of n for real foams are empirical, not provable; status=not attempted",
        "https://doi.org/10.1098/rspa.1982.0088 (Crossref metadata only); D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Scaling.lean"),
    row("Euler buckling of a strip: P_cr = pi^2 E I/(K L)^2, I = b t^3/12: monotonicity and scaling",
        "difficulty=easy; status=PASSED (kernel, no sorryAx); mathlib=pow_lt_pow_left0, field_simp; reason=P_cr is an explicit rational function of t and L",
        S + "/EulerBucklingStrip.lean"),
    row("Euler buckling: derive pi^2 as the first eigenvalue of y'' + (P/EI) y = 0 with pinned ends",
        "difficulty=moderate; status=not attempted; reason=sine zeros are in Mathlib (Real.sin_eq_zero_iff) and a sine-mode diffusionMode exists in Hygromorphs.lean, but obtaining the ODE from beam energy is the hard step (no beam theory in Mathlib)",
        MG),
    row("Maxwell rigidity count b - 3j + 6 = 0 and Calladine form s - m = b - 3j + 6",
        "difficulty=easy for the integer count and classification (decide on concrete cells); moderate for the s - m identity via rank-nullity (finrank_range_add_finrank_ker is in Mathlib) if the 6 trivial motions are a hypothesis; hard to PROVE that the trivial-motion space has dimension 6; status=not attempted",
        MG + " ; https://doi.org/10.1016/0020-7683(78)90052-5 (Crossref metadata only)"),
    row("Laman's theorem (generic 2-D rigidity = (2j-3)-sparse graph)",
        "difficulty=hard; status=not attempted; reason=combinatorial rigidity matroid; 0 Mathlib files mention Laman or rigidity matrices",
        "https://doi.org/10.1007/BF01534980 (Crossref metadata only); " + MG),
    row("Hollow-tube bending efficiency at fixed stiffness",
        "difficulty=moderate (done upstream); status=ALREADY IN LIBRARY (HollowTube.lean, 286 lines: gasCoreAreaFactor_strictAntiOn, massFactor_at_optimum with k*=sqrt(1-q), constrained_optimum); not re-run by me",
        LB + "/HollowTube.lean"),
    row("Swelling-induced bending: Timoshenko bilayer coefficient, ceiling 3/(2h) at m^2 n = 1",
        "difficulty=easy-moderate (done); status=ALREADY IN LIBRARY (timoshenkoCoefficient_le and bilayerCurvature_optimal in tracks/lean/HygromorphCeilingCheck.lean; equilibrium derivation bilayerCurvature_ofEquilibrium in Hygromorphs.lean line 77); NEW this run: the converse (ceiling reached ONLY at m^2 n = 1) PASSED",
        S + "/TimoshenkoCeilingUnique.lean ; D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean"),
    row("Swelling-induced bending: transient diffusion-coupled curvature, or 2-D laminate (twist, Gaussian curvature)",
        "difficulty=hard; status=not attempted; reason=needs classical laminate plate theory and a nonlinear energy argument for the narrow-to-wide strip transition; the 1-D diffusion mode (diffusionMode_heat) exists but the coupled PDE does not",
        LB + "/Hygromorphs.lean"),
    row("Second moment of area of a rectangle I = b t^3/12 as an integral of y^2",
        "difficulty=easy; status=not attempted; reason=Mathlib integral_pow gives the interval integral directly (feeds bilayer and sandwich stiffness; parallel-axis theorem is one more step)",
        MG),
    row("Poisson ratio window for an isotropic solid: nu = (3K-2G)/(2(3K+G)) lies in (-1, 1/2) when K,G > 0",
        "difficulty=easy; status=not attempted; reason=a two-line rational inequality; relevant to elastomer resins whose nu is near 1/2",
        "own analysis (algebra, not kernel-checked)"),
    row("Weibull weakest-link size effect: strength ~ V^(-1/m)",
        "difficulty=moderate; status=not attempted; reason=exp/log/rpow monotonicity; the Weibull law itself is an empirical model (named hypothesis)",
        "own analysis"),
    row("Griffith fracture criterion sigma_f = sqrt(2 E gamma/(pi a))",
        "difficulty=easy as an inequality from the formula; hard to derive from crack-tip energy release; status=not attempted",
        "own analysis"),
    row("Flory-Rehner equilibrium swelling of a crosslinked network (hydrogel resin)",
        "difficulty=moderate; status=not attempted; reason=no closed form; existence/uniqueness of the root and monotonicity in crosslink density via intermediate value theorem and strict monotonicity",
        "own analysis"),
    row("SLA cure-depth working curve Cd = Dp ln(E/Ec) and Ashby material-index algebra",
        "difficulty=easy; status=not attempted; reason=Real.log monotonicity with Dp, Ec as named per-resin hypotheses",
        "own analysis"),
]


def F(claim, source, conf, quote="", value=""):
    d = {"claim": claim, "source": source, "confidence": conf, "evidence_quote": quote}
    if value:
        d["value"] = value
    return d


findings = [
    F("PASSED: reuss_le_voigt. Statement: theorem reuss_le_voigt (f E1 E2 : R) (hf0 : 0 <= f) (hf1 : f <= 1) (h1 : 0 < E1) (h2 : 0 < E2) : reuss f E1 E2 <= voigt f E1 E2, with voigt f E1 E2 = f*E1 + (1-f)*E2 and reuss f E1 E2 = 1/(f/E1 + (1-f)/E2). check.sh: errors=0 sorryAx=0 axiom-lines=5/5; axioms only the three standard ones.",
      S + "/VoigtReuss.lean ; " + S + "/VoigtReuss.axioms.log ; " + S + "/run_all.log", "high",
      "'BmMaterials.VoigtReuss.reuss_le_voigt' depends on axioms: " + AX, "pass"),
    F("PASSED: reuss_eq_voigt_iff. Statement: reuss f E1 E2 = voigt f E1 E2 <-> f*(1-f)*(E1-E2)^2 = 0 (same hypotheses). So the two bounds coincide only for a pure phase or equal moduli. Built on the exact identity voigt_mul_compliance_sub_one: voigt*(f/E1+(1-f)/E2) - 1 = f(1-f)(E1-E2)^2/(E1*E2).",
      S + "/VoigtReuss.lean", "high",
      "'BmMaterials.VoigtReuss.reuss_eq_voigt_iff' depends on axioms: " + AX, "pass"),
    F("PASSED: reuss_le_voigt_finset (n phases). Statement: for a Finset s, weights w >= 0 with sum w = 1 and moduli E > 0, reussN s w E <= voigtN s w E, with voigtN = sum w_i E_i and reussN = (sum w_i / E_i)^(-1). Proof is Jensen (ConvexOn.map_sum_le) for x^(-1) via convexOn_zpow (-1).",
      S + "/VoigtReuss.lean", "high",
      "'BmMaterials.VoigtReuss.reuss_le_voigt_finset' depends on axioms: " + AX, "pass"),
    F("PASSED: Euler buckling strip, 8 theorems, check.sh errors=0 sorryAx=0 axiom-lines=8/8. Definitions: eulerLoad E I K L = pi^2*E*I/(K*L)^2; stripI b t = b*t^3/12; eulerStrip E b t K L = eulerLoad E (stripI b t) K L.",
      S + "/EulerBucklingStrip.lean ; " + S + "/EulerBucklingStrip.axioms.log", "high",
      "'BmMaterials.EulerBuckling.eulerStrip_strictMono_thickness' depends on axioms: " + AX, "pass"),
    F("Exact Euler statements proved: (1) eulerStrip_strictMono_thickness: 0<E,b,K,L, 0<t1<t2 => eulerStrip E b t1 K L < eulerStrip E b t2 K L. (2) eulerStrip_strictAnti_length: 0<E,b,t,K, 0<L1<L2 => eulerStrip E b t K L2 < eulerStrip E b t K L1. (3) eulerStrip_thickness_scaling: eulerStrip E b (s*t) K L = s^3 * eulerStrip E b t K L. (4) eulerStrip_length_scaling (K,L,s nonzero): eulerStrip E b t K (s*L) = eulerStrip E b t K L / s^2. (5) eulerStrip_geometric_similarity: scaling b,t,L by s multiplies P_cr by s^2. (6) eulerStrip_criticalStress: P_cr/(b*t) = pi^2*E*(t/(K*L))^2/12.",
      S + "/EulerBucklingStrip.lean", "high",
      "'BmMaterials.EulerBuckling.eulerStrip_criticalStress' depends on axioms: " + AX, "pass"),
    F("NEW (extra, not requested): ceiling_only_at_optimum PASSED. Statement: 0<h, 0<m, 0<n, timoshenkoCoefficient h m n = 3/(2*h) => m^2*n = 1. With the project's timoshenkoCoefficient_le and timoshenkoCoefficient_eq_of_optimal, the ceiling 3/(2h) is attained exactly on the curve m^2 n = 1. The project file proves only 'at most' and 'equal when m^2 n = 1'; this is the missing converse. Definition copied unchanged from HygromorphCeilingCheck.lean.",
      S + "/TimoshenkoCeilingUnique.lean ; " + S + "/run_all.log", "high",
      "TimoshenkoCeilingUnique.lean                         errors=0 sorryAx=0 axiom-lines=1/1", "pass"),
    F("Negative control: check.sh FAILS (exit 1) on a file that states voigt <= reuss and closes it with sorry; its axiom line lists sorryAx. So the gate rejects a placeholder proof. The file also trips a second error (missing 'noncomputable'); the sorryAx detection is the point.",
      S + "/NegativeControl.lean ; " + S + "/run_all.log", "high",
      "'BmMaterials.Control.wrong_direction' depends on axioms: [propext, sorryAx, Classical.choice, Quot.sound]", "fail (intended)"),
    F("Failed first attempt, then fixed: EulerBucklingStrip.lean first run reported errors=2 sorryAx=2: line 72 'failed to prove strict positivity' (I had not derived 0 < L2 from L1 < L2 before calling positivity) and line 81 'No goals to be solved' (a redundant ring after field_simp). Fixed by adding hL2 := hL1.trans h and deleting the ring. The passing file is the saved one (sha256 in SHA256SUMS.txt).",
      S + "/EulerBucklingStrip.lean ; " + S + "/SHA256SUMS.txt", "high",
      "EulerBucklingStrip.lean:72:26: error: failed to prove strict positivity, but it would be possible to prove nonnegativity if desired", "fixed"),
    F("VoigtReuss.lean passes with one non-error warning: push_neg is deprecated in this Mathlib (Lean v4.35.0); it still compiles.",
      S + "/VoigtReuss.axioms.log", "high",
      "warning: `push_neg` has been deprecated. Prefer using `push Not` instead.", ""),
    F("Toolchain: Lean leanprover/lean4:v4.35.0; Mathlib rev 56a005855ea17e0b0958f73ec801ae140b0a1679 (lean/lake-manifest.json of the ScienceClaw project). check.sh printed an empty 'mathlib:' field because its grep did not find the rev line; the build itself used the pinned package.",
      "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/lake-manifest.json ; " + S + "/run_all.log", "high",
      "toolchain: leanprover/lean4:v4.35.0   mathlib: ", ""),
    F("Mathlib (pinned rev) has no material-science vocabulary: grep finds 0 files mentioning Laman, Hashin, Voigt, Reuss, buckling, Young's modulus, rigidity matrix, Gibson, Poisson ratio, Timoshenko, Griffith or Flory. It does have the general tools these laws need: finrank_range_add_finrank_ker (rank-nullity, 11 files), integral_pow, Real.sin_eq_zero_iff, convexOn_zpow. Hence each law is stated as a definition plus theorems about the formula; why the formula describes a real body stays outside the kernel.",
      MG, "high", "finrank_range_add_finrank_ker -> 11 hits", ""),
    F("Library status: HollowTube.lean (upstream leanbio, 286 lines) already holds the hollow-tube results; Hygromorphs.lean (356 lines) holds timoshenkoCoefficient, bilayerCurvature_ofEquilibrium (line 77) and diffusive scaling/mode lemmas; Mechanics.lean has stress-thickness, spine and length-weight lemmas but no beam deflection or buckling; no file in leanbio/lean/ThompsonLaws or delphisci/lean/Delphi defines a Voigt, Reuss or Euler-buckling quantity.",
      LB + " (grep of theorem/def names; wc -l)", "high",
      "def tubeSecondMoment (R k : \u211d) : \u211d := \u03c0 / 4 * R ^ 4 * (1 - k ^ 4)", ""),
    F("Scope of the 3/2 ceiling in the library: the 3/(2h) theorem is NOT in upstream lean/ThompsonLaws/Hygromorphs.lean (grep for '3 / 2' there matches only line 45, bilayerCurvature h 1 1 = 3/2 * d/h at m=n=1); it lives in the delphisci tracks/lean checkable copy. So scout-biomaterial.json's remark that the bound 'is not yet in the Lean file' is true of the upstream library and no longer true of the tracks/lean copy.",
      LB + "/Hygromorphs.lean line 45 ; D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean", "high",
      "bilayerCurvature h 1 1 \u0394\u03b5 = 3 / 2 * \u0394\u03b5 / h := by", ""),
    F("CONFIRMS laws-biomaterial.json on difficulty: its ratings agree with mine for Voigt-Reuss (easy as interval lemma; I proved it, n-phase via Jensen for 1/x rather than weighted AM-HM), Euler column (easy algebra; moderate to derive pi^2), Gibson-Ashby (easy as named hypothesis; hard to derive exponents; I rate the exponent algebra from strut geometry as moderate rather than hard), Maxwell count (easy count; moderate necessity). No material disagreement. New items it did not list: Poisson-ratio window, second moment of area by integral, Weibull size effect, Calladine form, Laman (hard).",
      "D:/Users/ashenoy00000/delphi-work/agents/laws-biomaterial.json", "medium",
      "easy for Voigt-Reuss as an interval lemma (weighted AM-HM); hard for Hashin-Shtrikman if derived variationally", ""),
    F("Water-uptake premise, pointer only (not re-fetched by me): the brief's 'stock Formlabs resins gain under 1 percent mass in 24 h' holds for Formlabs' 1 cm cube table but fails for Flexible 80A Resin V2, whose data sheet is reported as +8% mass and +3% volume after 1 day (ASTM D471). The later agent bm-resin-water-uptake-data.json already flagged this contradiction of spec-resin-chemistry.json; spec-formlabs-materials.json carries the 8% figure. I rely on those files and did not re-read the data sheet. Relevance: the Lean laws above take swelling strain as an input; they do not supply it.",
      "D:/Users/ashenoy00000/delphi-work/agents2/bm-resin-water-uptake-data.json ; D:/Users/ashenoy00000/delphi-work/agents/spec-formlabs-materials.json", "medium",
      "The earlier file's blanket statement fails for V2.", ""),
    F("Citation checks: Crossref resolved the DOIs for Timoshenko 1925 (10.1364/JOSA.11.000233), Hill 1952 (10.1088/0370-1298/65/5/307), Hashin-Shtrikman 1963 (10.1016/0022-5096(63)90060-7), Calladine 1978 (10.1016/0020-7683(78)90052-5), Laman 1970 (10.1007/BF01534980), Reuss 1929 (10.1002/zamm.19290090104), Gibson and Ashby 1982 (10.1098/rspa.1982.0088) and the mathlib paper (10.1145/3372885.3373824; arXiv 1910.09336). Metadata only: I did not read these papers. A first-guess DOI for Gibson-Ashby (10.1098/rspa.1982.0124) resolved to an unrelated satellite-orbit paper and was dropped.",
      S + "/crossref_out.txt", "high",
      "OK  10.1098/rspa.1982.0088 | Gibson | 1982 | The mechanics of three-dimensional cellular materials", ""),
]

key_claims = [
    {"claim": "Reuss <= Voigt is kernel-checked for two phases (with the equality case f(1-f)(E1-E2)^2 = 0) and for n phases, with only the three standard axioms.",
     "source": S + "/VoigtReuss.lean and VoigtReuss.axioms.log (reproduce with run_all.sh)",
     "evidence_quote": "'BmMaterials.VoigtReuss.reuss_le_voigt_finset' depends on axioms: " + AX},
    {"claim": "Euler buckling of a rectangular strip: load strictly increases with thickness, strictly decreases with length, scales as t^3 and 1/L^2, and critical stress depends on t/(K L) only; all kernel-checked as statements about the formula pi^2*E*(b t^3/12)/(K L)^2, not as a derivation of the formula.",
     "source": S + "/EulerBucklingStrip.lean and EulerBucklingStrip.axioms.log",
     "evidence_quote": "'BmMaterials.EulerBuckling.eulerStrip_strictAnti_length' depends on axioms: " + AX},
    {"claim": "The check gate is not vacuous: a file closed with sorry fails with sorryAx in its axiom list and exit 1, while the three real files exit 0.",
     "source": S + "/run_all.log",
     "evidence_quote": "'BmMaterials.Control.wrong_direction' depends on axioms: [propext, sorryAx, Classical.choice, Quot.sound]"},
    {"claim": "Mathlib at the project's pinned revision has no materials vocabulary (0 files for Voigt, Reuss, buckling, Young's modulus, Laman, rigidity matrix), so difficulty depends on whether a law is an explicit formula (easy) or needs a variational or beam-theory derivation (hard).",
     "source": MG,
     "evidence_quote": "Laman -> 0 files"},
]

citations = [
    {"authors": "Hill, R.", "year": 1952, "title": "The Elastic Behaviour of a Crystalline Aggregate", "doi_or_arxiv": "10.1088/0370-1298/65/5/307", "verified": True, "how_verified": "Crossref works API returned this title, author and year in this run", "used_for": "Names the Voigt and Reuss averages being formalised (metadata only; text not read)"},
    {"authors": "Reuss, A.", "year": 1929, "title": "Berechnung der Fliessgrenze von Mischkristallen auf Grund der Plastizitaetsbedingung fuer Einkristalle", "doi_or_arxiv": "10.1002/zamm.19290090104", "verified": True, "how_verified": "Crossref works API returned this record in this run", "used_for": "Original Reuss (equal-stress) reference (metadata only)"},
    {"authors": "Hashin, Z.; Shtrikman, S.", "year": 1963, "title": "A variational approach to the theory of the elastic behaviour of multiphase materials", "doi_or_arxiv": "10.1016/0022-5096(63)90060-7", "verified": True, "how_verified": "Crossref works API returned this record in this run", "used_for": "Hashin-Shtrikman bounds, rated moderate/hard (metadata only)"},
    {"authors": "Gibson, L. J.; Ashby, M. F.", "year": 1982, "title": "The mechanics of three-dimensional cellular materials", "doi_or_arxiv": "10.1098/rspa.1982.0088", "verified": True, "how_verified": "Crossref works API returned this record in this run (found by bibliographic search, then fetched directly)", "used_for": "Gibson-Ashby scaling law, rated easy/moderate (metadata only)"},
    {"authors": "Timoshenko, S.", "year": 1925, "title": "Analysis of Bi-Metal Thermostats", "doi_or_arxiv": "10.1364/JOSA.11.000233", "verified": True, "how_verified": "Crossref works API returned this record in this run", "used_for": "Origin of the bilayer coefficient f(m,n) whose ceiling is in the project record (metadata only)"},
    {"authors": "Calladine, C. R.", "year": 1978, "title": "Buckminster Fuller's Tensegrity structures and Clerk Maxwell's rules for the construction of stiff frames", "doi_or_arxiv": "10.1016/0020-7683(78)90052-5", "verified": True, "how_verified": "Crossref works API returned this record in this run", "used_for": "Calladine form of the Maxwell rigidity count (metadata only)"},
    {"authors": "Laman, G.", "year": 1970, "title": "On graphs and rigidity of plane skeletal structures", "doi_or_arxiv": "10.1007/BF01534980", "verified": True, "how_verified": "Crossref works API returned this record in this run", "used_for": "Laman's theorem, rated hard (metadata only)"},
    {"authors": "The mathlib Community", "year": 2020, "title": "The Lean mathematical library", "doi_or_arxiv": "arXiv:1910.09336", "verified": True, "how_verified": "arXiv export API returned id 1910.09336v2 with this title; Crossref also resolved DOI 10.1145/3372885.3373824", "used_for": "Mathlib reference for the library the proofs run against"},
]

could_not_find = [
    "Lean formalisations of the textbook materials laws elsewhere (Voigt-Reuss, buckling, Gibson-Ashby): an arXiv export-API search for Lean + elasticity and Lean 4 + continuum mechanics returned nothing relevant; I did not search GitHub or Zulip, so 'no prior art' is NOT established, only 'none found in Mathlib at the pinned rev and none in leanbio/delphisci'.",
    "Content of the cited papers: I verified that each DOI resolves in Crossref, but did not read Hill, Reuss, Hashin-Shtrikman, Gibson-Ashby, Timoshenko, Calladine or Laman, so I make no claim about what they say. The textbook forms of the formulas are unverified background; the Lean definitions state exactly what was proved.",
    "A Lean proof of the Euler formula itself (derivation of pi^2 from the beam equation), of Voigt/Reuss as physical bounds, of Hashin-Shtrikman, of Gibson-Ashby exponents from strut bending, of Calladine's count, of Laman: rated but not attempted; only the two requested easy laws plus one extra (ceiling uniqueness) were written and checked.",
    "Any measured hygroscopic expansion coefficient or water diffusivity for a Formlabs resin: not searched, outside this specialist's scope; the Lean laws take strain as an input. See bm-resin-water-uptake-data.json for that gap.",
    "I did not re-run the project's own HygromorphCeilingCheck.lean or HollowTube.lean; their pass status is the project record, not something I re-measured. Only my own files were run.",
    "Resource gate: at the start free C: read 0.40 GB (below the 1 GB limit), so I wrote files and ran nothing heavy; it later read 3.0 and then 5.6 GB (RAM 35 percent free, D: 9.5 GB) before the first Lean run, and I ran one Lean process at a time. The first reading alone would have blocked the run.",
]

summary = (
    "Two easy textbook laws were written and kernel-checked with the project script (check.sh): "
    "(1) Voigt-Reuss ordering, reuss_le_voigt for two phases with equality exactly when f(1-f)(E1-E2)^2 = 0, plus an n-phase version via Jensen for x^-1; "
    "(2) Euler buckling of a strip, P_cr = pi^2 E (b t^3/12)/(K L)^2, strictly increasing in thickness, strictly decreasing in length, scaling as t^3 and 1/L^2 (and s^2 under uniform scaling), with critical stress depending only on t/(K L). "
    "Both: errors=0, sorryAx=0, only propext/Classical.choice/Quot.sound. One extra also passed: the Timoshenko ceiling 3/(2h) is attained only on m^2 n = 1 (the project record proved 'at most' and 'equal when m^2 n = 1', not the converse). "
    "A negative control with sorry correctly failed. One first attempt failed (two errors in the Euler file) and was fixed. "
    "The statements prove facts about the formulas; they do not derive the formulas from elasticity (Mathlib at the pinned rev has no elasticity vocabulary: 0 files). "
    "Ratings: easy = Voigt-Reuss (done), Euler monotonicity (done), Gibson-Ashby as named-hypothesis exponent algebra, I = b t^3/12 by integral_pow, Poisson-ratio window, Griffith inequality, cure-depth log curve; "
    "moderate = Hashin-Shtrikman closed-form ordering, Gibson-Ashby exponents from strut geometry, Euler eigenvalue derivation, Calladine count via rank-nullity, Weibull size effect, Flory-Rehner; "
    "hard = Voigt/Reuss as physical bounds (energy principles), Laman, laminate-plate-theory bending with twist, diffusion-coupled transient bending. Hollow tube and Timoshenko swelling bending are already in the library. "
    "This confirms laws-biomaterial.json's difficulty ratings (no material disagreement) and adds items it lacked. Water-uptake premise: 'under 1 percent' fails for Flexible 80A V2 (+8 percent mass, per later project files, not re-fetched by me)."
)

lay_summary = (
    "A law of materials is only as trustworthy as the arithmetic behind it, so we asked a proof-checking program to confirm that arithmetic. "
    "We tested two simple laws. The first says a mix of stiff and soft material is stiffer when the parts are forced to stretch together, like planks side by side, than when they share the same pull, like layers stacked end to end. "
    "The second says a thin ruler squeezed from its ends gives way at a load that grows very fast with thickness (eight times for double) and drops fast with length. "
    "Both checks passed, and a deliberately sloppy proof was rejected, so the checker is doing its job. "
    "The checker confirms the formulas are consistent; it does not prove that a real printed part follows them, which still needs measurement."
)

glossary = [
    {"term": "Lean / kernel", "plain": "A proof-checking program; its small core (the kernel) accepts a proof only if every step is valid."},
    {"term": "Mathlib", "plain": "The large shared library of checked mathematics that Lean proofs build on."},
    {"term": "sorryAx", "plain": "The marker Lean leaves when a proof contains a placeholder instead of a real step."},
    {"term": "Voigt bound", "plain": "The stiffness of a mix if all parts are forced to stretch equally: the plain volume-weighted average."},
    {"term": "Reuss bound", "plain": "The stiffness of a mix if all parts carry the same pull: a weighted average of softness, inverted."},
    {"term": "Euler buckling", "plain": "Sudden sideways bending of a slender strip pushed from its ends."},
    {"term": "Young's modulus", "plain": "How much a material resists stretching."},
    {"term": "Second moment of area", "plain": "A shape number saying how hard the cross-section is to bend."},
    {"term": "Bilayer", "plain": "Two glued layers; if one swells more, the strip curves."},
    {"term": "Timoshenko ceiling", "plain": "The upper limit 3/2 on how much a two-layer strip can curve per unit swelling difference, per unit thickness."},
    {"term": "Jensen's inequality", "plain": "A rule that an average of a bowl-shaped function is at least the function of the average."},
    {"term": "Rank-nullity", "plain": "A counting rule for linear equations: unknowns equal independent constraints plus free movements."},
    {"term": "Hashin-Shtrikman bounds", "plain": "Tighter limits than Voigt and Reuss on the stiffness of a two-material mix."},
    {"term": "Gibson-Ashby scaling", "plain": "A rule for how a foam or lattice gets stiffer as it gets denser."},
    {"term": "Maxwell rigidity count", "plain": "Counting bars against joints to tell whether a frame is stiff or floppy."},
    {"term": "Negative control", "plain": "A test built to fail, to prove the checker can fail."},
]

reproduce = [
    {"what": "Run all Lean checks, one process at a time (needs Lean v4.35.0 via elan at C:/Temp/elan and the project's Mathlib)", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws/run_all.sh", "expected": "VoigtReuss, EulerBucklingStrip, TimoshenkoCeilingUnique: 'ALL CHECKED: no errors, no sorryAx', exit=0; NegativeControl: FAILED, exit=1 (about 15 s each)"},
    {"what": "Check one file with the project script", "command_or_url": "bash D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws/VoigtReuss.lean", "expected": "errors=0 sorryAx=0 axiom-lines=5/5 (one push_neg deprecation warning)"},
    {"what": "See full per-theorem axiom lists", "command_or_url": "cat D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws/VoigtReuss.axioms.log and EulerBucklingStrip.axioms.log in the same folder", "expected": "Each theorem 'depends on axioms: [propext, Classical.choice, Quot.sound]'"},
    {"what": "Confirm file integrity", "command_or_url": "cd D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws && sha256sum -c SHA256SUMS.txt", "expected": "all OK for the .lean files and run_all.sh"},
    {"what": "Re-grep Mathlib for materials vocabulary", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws/mathlib_grep.sh", "expected": "0 files for Laman, Hashin, Voigt, Reuss, buckling, Young's modulus, rigidity matrix; finrank_range_add_finrank_ker has hits"},
    {"what": "Re-resolve citations in Crossref", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws/crossref_check.sh 10.1088/0370-1298/65/5/307 10.1098/rspa.1982.0088 10.1364/JOSA.11.000233", "expected": "OK lines with Hill 1952, Gibson 1982, Timoshenko 1925"},
    {"what": "Rebuild this JSON", "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-lean-materials-laws/build_result.py", "expected": "writes D:/Users/ashenoy00000/delphi-work/agents2/bm-lean-materials-laws.json"},
]

recommendations = [
    "Add VoigtReuss.lean and EulerBucklingStrip.lean to the project as a MaterialsLaws module (owner decision; I did not touch the repos). Keep the header caveat that only the formulas are proved.",
    "Next easy wins: I = b t^3/12 via integral_pow, then a sandwich-panel stiffness (parallel axis), the Poisson window, and the cure-depth log curve.",
    "Next moderate, most useful for the bilayer design: Hashin-Shtrikman closed-form ordering inside [Reuss, Voigt], and a Flory-Rehner monotonicity theorem for hydrogel-resin swelling.",
    "Add a rules_out wrapper for Euler buckling (a claimed load above P_cr cannot be carried) in the style of bilayer_rules_out, so the design pipeline can eliminate a strut.",
    "Move timoshenkoCoefficient_le, bilayerCurvature_optimal and the new ceiling_only_at_optimum into upstream Hygromorphs.lean; today the 3/2 ceiling is absent from the library proper.",
]

res = {
    "label": "bm-lean-materials-laws",
    "topic": "Which materials laws can be formalised in Lean next, and prove two",
    "summary": summary, "lay_summary": lay_summary, "table": table, "findings": findings,
    "key_claims": key_claims, "glossary": glossary, "reproduce": reproduce, "citations": citations,
    "could_not_find": could_not_find, "recommendations": recommendations,
    "scripts_written": [S + "/" + f for f in ["VoigtReuss.lean", "EulerBucklingStrip.lean", "TimoshenkoCeilingUnique.lean", "NegativeControl.lean", "run_all.sh", "mathlib_grep.sh", "crossref_check.sh", "build_result.py"]],
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(res, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
chk = json.load(open(OUT, encoding="utf8"))
print("wrote", OUT, len(chk["findings"]), "findings", len(chk["table"]), "rows")
txt = json.dumps(chk).lower()
assert not re.search(r"\b([held-out clade]|[held-out clade]|[held-out clade]|feather|beak)", txt), "holdout word present"
for k in chk["key_claims"] + chk["findings"]:
    assert len(k["evidence_quote"].split()) <= 40, k["claim"][:40]
