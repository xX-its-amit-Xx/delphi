import json
L = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-theory-lean/Q2Theory.lean"
thm = [
    ("cov_sq_le", "Cauchy-Schwarz for the covariance form"),
    ("attenuation", "(a) cov(p,y+e)^2*(vy+s2) <= var p * var(y+e) * vy, given cov(y,e)=0, cov(p,e)=0"),
    ("pearson_attenuation", "(a) r^2 <= vy/(vy+s2) and |r| <= sqrt(vy/(vy+s2))"),
    ("attenuation_tight", "(a) truth as predictor attains r^2 = vy/(vy+s2)"),
    ("total_variance", "(b) var y = between + within"),
    ("var_group_pred", "(b) var of target-only group-mean predictor = between"),
    ("cov_group_pred", "(b) cov(group-mean predictor, y) = between"),
    ("r2_target_only", "(b) r^2 of target-only predictor = between/total"),
    ("target_only_floor", "(b) any f(target) has MSE >= within; group means attain it"),
    ("no_within_signal", "(b) residual of group means has zero covariance with every f(target)"),
    ("cycle_zero_of_potential", "(c) d a b = f b - f a sums to 0 on a closed walk"),
    ("cycle_zero_of_additive", "(c) path-additive predictor sums to 0 on a closed walk"),
    ("residual_cycle_zero", "(c) errors of additive predictor vs additive truth sum to 0 on a closed walk"),
    ("deviations_not_independent", "(c) cycle-closed per-edge errors pairwise uncorrelated imply all second moments 0"),
    ("exchangeable_cycle_deviations", "(c) exchangeable cycle errors: s+(n-1)c=0, correlation -1/(n-1)"),
    ("eliminate", "(d) claimed r with vy < r^2 (vy+s2) is impossible for any noise-blind predictor"),
]
res = {
    "label": "q2-theory-lean",
    "topic": "Q2 binding-affinity prediction: what is mathematically impossible, in Lean",
    "summary": "All four requested statements (a)-(d) were stated and proved in Lean 4 (v4.35.0, Mathlib at the delphisci/lean pin) in one self-contained file, Q2Theory.lean. check.sh reports errors=0, sorryAx=0, 16/16 #print axioms lines; every theorem depends only on propext, Classical.choice, Quot.sound. The setting is a finite probability space (weights summing to 1); independence is weakened to uncorrelatedness, which makes the theorems stronger. Key caveat: the attenuation bound needs the predictor to be uncorrelated with the assay noise (cov(p,e)=0); without it the bound is false (p = y_obs gives r=1). Nothing was tested on data; this track is statements and proofs only. Nothing requested failed to prove; the first compiles had errors (a rewrite in var_add, an argument name in sum_fibers, and a check.sh false positive on theorem names containing the word 'error', which I renamed) that were fixed.",
    "lay_summary": "We wrote four facts as computer-checked proofs. First, if the lab measurement of binding strength is noisy, no model that has not seen that noise can match the measurements better than a fixed ceiling set by how big the noise is compared with the real spread. Think of trying to match a ruler that wobbles: even a perfect model looks imperfect. Second, a model that only knows which protein it is looking at can explain the differences between proteins but nothing about differences among drugs for the same protein. Third, energies around a closed loop of chemical changes must add to zero, so a model's mistakes around that loop cannot all be independent. Fourth, if someone claims a score above the ceiling, the proof shows the claim cannot be right for that noise level.",
    "glossary": [
        {"term": "Lean 4", "plain": "A proof checker: a program that accepts a mathematical proof only if every step is valid."},
        {"term": "Mathlib", "plain": "The large shared library of already-proved mathematics that Lean proofs build on."},
        {"term": "Pearson r", "plain": "A number from -1 to 1 saying how closely two lists of numbers rise and fall together."},
        {"term": "variance", "plain": "How spread out a set of numbers is."},
        {"term": "covariance", "plain": "How much two lists of numbers move together, before scaling."},
        {"term": "attenuation", "plain": "The shrinking of a measured correlation caused by noise in the measurement."},
        {"term": "thermodynamic cycle", "plain": "A loop of changes that returns to its starting state, so the total energy change is zero."},
        {"term": "sorryAx", "plain": "The marker Lean leaves when a proof has a gap; its absence means no gaps."},
        {"term": "uncorrelated", "plain": "Having zero covariance; a weaker condition than independent."},
    ],
    "key_claims": [
        {"claim": "Attenuation: for y_obs=y+e with cov(y,e)=0 and a predictor p with cov(p,e)=0, Pearson r(p,y_obs)^2 <= var y/(var y + var e), hence |r| <= sqrt of that; proved as Q2.pearson_attenuation, tight via Q2.attenuation_tight.", "source": L, "evidence_quote": "theorem pearson_attenuation ... (pearson P p (fun ω => y ω + e ω)) ^ 2 ≤ var P y / (var P y + var P e) ∧"},
        {"claim": "Law of total variance on pooled data and target-only predictor: var y = between + within; a target-only predictor has r^2 = between/total and cannot reduce MSE below within.", "source": L, "evidence_quote": "theorem total_variance (hm : IsGroupMean P g y m) : var P y = between P g y m + within P g y m"},
        {"claim": "Cycle closure: a path-additive predictor sums to zero around closed walks; with an additive truth the errors also sum to zero, so pairwise-uncorrelated cycle errors are impossible unless all are zero; exchangeable errors have correlation -1/(n-1).", "source": L, "evidence_quote": "s + ((n : ℝ) - 1) * c = 0"},
        {"claim": "The kernel check passed: errors=0, sorryAx=0, 16/16 axiom lines, axioms only propext, Classical.choice, Quot.sound.", "source": "D:/Users/ashenoy00000/delphi-work/agents2/scratch/q2-theory-lean/check.log", "evidence_quote": "Q2Theory.lean errors=0 sorryAx=0 axiom-lines=16/16"},
    ],
    "table": [{"name": "Q2." + n, "fields": "statement=" + d + "; axioms=propext,Classical.choice,Quot.sound; status=proved", "source": L} for n, d in thm],
    "recommendations": [
        "To test (a) on data, take replicate-measurement variance s2 from assays (same compound measured repeatedly) and compare the observed model r via Q2.eliminate; any r with vy < r^2(vy+s2) is impossible for a noise-blind model.",
        "Test (b) by computing the target-mean baseline r^2 = between/total on pooled PDBbind-type data and comparing with the model r^2; the gap above it is within-target skill.",
        "For (c), the exchangeable result predicts error correlation -1/(n-1) around an n-edge relative free-energy cycle; check against cycle-closure residuals in published edge errors.",
    ],
    "reproduce": [
        {"what": "Kernel-check the whole file", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-theory-lean/run_check.sh", "expected": "Q2Theory.lean errors=0 sorryAx=0 axiom-lines=16/16, then ALL CHECKED: no errors, no sorryAx (about 15 s; needs elan at C:/Temp/elan, Lean v4.35.0 and the Mathlib pinned in delphisci/lean)"},
        {"what": "File integrity", "command_or_url": "sha256sum D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-theory-lean/Q2Theory.lean", "expected": "33861c42c333465cf60dc29ef014d2c7f54e46e64d53205e19948a5b38c1e44c"},
    ],
    "citations": [
        {"authors": "Spearman, C.", "year": 1904, "title": "The Proof and Measurement of Association between Two Things", "doi_or_arxiv": "10.2307/1412159", "verified": True, "how_verified": "Crossref API https://api.crossref.org/works/10.2307/1412159 returned this title, author Spearman, The American Journal of Psychology, 1904", "used_for": "Historical origin of correction for attenuation (idea behind part a); not load-bearing", "venue": "The American Journal of Psychology"}
    ],
    "could_not_find": [
        "No empirical test on public data was run; this task was statements and proofs only.",
        "Independence is not formalised measure-theoretically: hypotheses are uncorrelatedness (cov=0, E[e_i e_j]=0) on finite probability spaces, which independence plus mean zero implies. General probability spaces are not covered.",
        "Attenuation requires cov(predictor, noise)=0; a predictor trained on the same noisy labels can correlate with the noise and the bound then fails. This is a hypothesis, not a theorem about all models.",
        "A literature citation on ChEMBL experimental uncertainty was dropped: the DOI tried resolved on Crossref to an unrelated docking paper, so it was not used.",
        "Part (c) does not model specific free-energy software; additive means d a c = d a b + d b c.",
    ],
    "scripts_written": [L, "D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-theory-lean/run_check.sh", "D:/Users/ashenoy00000/delphi-work/agents2/scripts/q2-theory-lean/make_json.py"],
}
res["findings"] = [
    {"claim": "Lean theorem " + r["name"] + " proved: " + r["fields"].split(";")[0][len("statement="):],
     "source": L, "confidence": "high (Lean kernel check, no sorryAx)",
     "evidence_quote": "", "value": "proved"}
    for r in res["table"]
]
json.dump(res, open("D:/Users/ashenoy00000/delphi-work/agents2/q2-theory-lean.json", "w"), indent=1, ensure_ascii=False)
print(len(res["findings"]))
