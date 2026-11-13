import json
S = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/'
R = S + 'registry/laws/'


def F(c, s, conf, q='', v=''):
    return {"claim": c, "source": s, "confidence": conf, "evidence_quote": q, "value": v}


rows = [
    ("flight-climb-glide-law", "status=accepted v1.0.0 class=theorem; lean_ref=Delphi.glide_range_le in lean/Delphi/Flight.lean; also glide_range_le_groundEffect, climbRate_le, climb_nonneg_iff; certificate lemmas glide_range_rules_out, climb_rules_out in lean/Delphi/Constraints.lean; constraints C15,C16", R + "flight-climb-glide-law.json"),
    ("perturb-wind-glide", "status=accepted v1.0.0; lean_ref=Delphi.Perturb.wind_glide_rules_out in lean/Delphi/Perturb.lean (also glide_ground_range, glide_ground_range_le); constraint P4b; range <= h*LDmax*(1+w/u)", R + "perturb-wind-glide.json"),
    ("[claim id withheld]", "status=accepted v1.0.0; lean_ref=Delphi.powerRequired_log in lean/Delphi/Scaling.lean; vmin_le (Scaling.lean:136) and Constraints.vmin_rules_out (C9) sit under it", R + "[claim id withheld].json"),
    ("thompson1917-ch02-10", "status=accepted v1.1.0; lean_ref=Delphi.vmin_ratio in lean/Delphi/Scaling.lean (vmin_log, froude_ratio)", R + "thompson1917-ch02-10.json"),
    ("[claim id withheld]", "status=accepted v1.0.0; lean_ref=Delphi.exists_size_limit in lean/Delphi/Scaling.lean (powered-flight size ceiling; context only)", R + "[claim id withheld].json"),
    ("flight-allometry-law", "status=accepted v1.0.0; lean_ref=Delphi.vmin_powerLaw_log in lean/Delphi/Flight.lean (PowerLaw, powerLaw_ratio, powerLaw_div)", R + "flight-allometry-law.json"),
    ("scaling-area-law", "status=accepted v1.1.0; lean_ref=Delphi.areaLaw_ratio in lean/Delphi/Scaling.lean (wingLoading_ratio, wingLoading_log)", R + "scaling-area-law.json"),
    ("scaling-strength-law", "status=accepted v1.1.0; lean_ref=Delphi.breakLoad_ratio in lean/Delphi/Scaling.lean", R + "scaling-strength-law.json"),
    ("scaling-bending-law", "status=accepted v1.0.0; lean_ref=Delphi.bendingStress_ratio_body in lean/Delphi/Scaling.lean (fin/body bending; sheet variant bendingStress_ratio_sheet)", R + "scaling-bending-law.json"),
    ("perturb-isa-vmin", "status=accepted v1.0.0; lean_ref=Delphi.Perturb.vmin_isa_mono in lean/Delphi/Perturb.lean (air density with altitude)", R + "perturb-isa-vmin.json"),
    ("altitude-coupling", "status=accepted v1.0.0; lean_ref=Delphi.Altitude.feasible_downward_closed in lean/Delphi/Altitude.lean (context only)", R + "altitude-coupling.json"),
    ("E1", "status=accepted v1.0.0 class=empirical-observation; lean_ref=Delphi.Empirical.not_isometric_area in lean/Delphi/Empirical.lean (fish data; isometry fails)", R + "E1.json"),
    ("E5", "status=accepted v1.0.0; lean_ref=Delphi.Empirical.finRatio_outside in lean/Delphi/Empirical.lean (fin ratio range; fish data)", R + "E5.json"),
    ("aerobic-power-bound", "status=accepted v1.1.0; lean_ref=Delphi.sustained_flight_requires in lean/Delphi/Flight.lean (out of scope for an unpowered glide; biological bridge only)", R + "aerobic-power-bound.json"),
    ("aspect-ratio-induced-drag", "status=proposed class=gap; lean_ref.theorem=null (PLACEHOLDER, no theorem); note 'L/D enters only as a committed number'. New file MaxLiftToDrag.lean fills it in named-hypothesis form", R + "aspect-ratio-induced-drag.json"),
    ("fin-length-ratio", "status=proposed class=gap; PLACEHOLDER no theorem", R + "fin-length-ratio.json"),
    ("elastic-similarity", "status=proposed class=gap; PLACEHOLDER no theorem", R + "elastic-similarity.json"),
    ("taxiing-thrust", "status=proposed class=gap; PLACEHOLDER no theorem", R + "taxiing-thrust.json"),
    ("disc-measured-wing-loading-band / disc-flying-fish-fin-ratio-gap / disc-pectoral-length-allometry", "status=candidate, class=empirical-observation, lean_ref.theorem=null (PLACEHOLDERS; statements only in registry/proposals/*/law.lean); fish data, not binding", R + "disc-measured-wing-loading-band.json"),
]
table = [{"name": a, "fields": b, "source": c} for a, b, c in rows]

findings = [
    F("Law set 1.8.1 (current.json -> lawset-1.8.1.json, created 2026-11-01T05:37:39Z) pins 59 laws: 36 accepted, 10 candidate, 7 proposed, 3 retired, 3 contested (script lawmap.py).", "lawsets/lawset-1.8.1.json; scripts/t4-glide-law/lawmap_out.txt", "high", v="59"),
    F("Exactly 14 of the 59 pinned laws have no lean_ref.theorem (placeholders): 7 proposed gaps (aspect-ratio-induced-drag, elastic-similarity, fin-length-ratio, gene-regulatory-dynamics, gill-o2-uptake, taxiing-thrust, walking-pendulum-speed), 4 disc-* empirical (3 candidate, 1 contested), fick-principle (named hypothesis), muscle-power-premise and test-loop-only-density-sanity (retired). Counted by script over registry/laws/*.json.", "registry/laws/*.json (lean_ref.theorem empty)", "high", v="14"),
    F("1.8.1 differs from 1.6.0 by six extra pins (development-growth-asymptote, fisher-kpp-speed, kimura-heterozygosity, maynardsmith-hawk-dove, test-loop-only-density-sanity, turing-ddi) and eight version bumps (E2, E3, aerobic-power-bound, fick-principle, scaling-area-law, scaling-strength-law, thompson1917-ch02-10, thompson1917-ch03-07); no glide-relevant status changed.", "scripts/t4-glide-law/lawmap_out.txt", "high"),
    F("Glide range bound: Delphi.glide_range_le (lean/Delphi/Flight.lean:115) concludes x <= h * LDmax from W*h = D*x + loss, Lift = W, Lift/D <= LDmax, loss >= 0.", "lean/Delphi/Flight.lean:115-117", "high"),
    F("aspect-ratio-induced-drag is still unformalised in 1.8.1 (no theorem). A grep of lean/Delphi/*.lean for induced, polar, C_D0, maxLD found no polar or max-L/D theorem.", "registry/laws/aspect-ratio-induced-drag.json; grep over Delphi/*.lean", "high", q="not formalised: L/D enters only as a committed number"),
    F("In the application repo Delphi.Constraints.vmin_rules_out (line 243) and aerobic_flight_rules_out (316) exist, so the 'BROKEN REFERENCE' the old map reported against upstream 1.6.0 does not hold for the 1.8.1 application copy.", "lean/Delphi/Constraints.lean:243,316", "high"),
    F("Missed or mis-framed by laws-glide.json: (1) it mapped 1.6.0 not 1.8.1; (2) it omitted Perturb.glide_ground_range and glide_ground_range_le; (3) the certificate lemmas Constraints.glide_range_rules_out (324), climb_rules_out (331), froude_rules_out; (4) Altitude.vmin_mono and demand_mono; (5) Scaling.vmin_log, wingLoading_ratio, bendingStress_ratio_sheet; (6) the count of 14 placeholders and that fin-length-ratio, elastic-similarity, taxiing-thrust are placeholders; (7) it listed the polar as missing but proved nothing.", "laws-glide.json 'existing' ids compared with the 1.8.1 list", "medium"),
    F("No law in 1.8.1 covers descent without forward travel (autorotation). The design's disk rule U ~ 1/R is an instance of Scaling.vmin_le with S = pi R^2 and an effective coefficient; glide_range_le says nothing about an autorotating fruit, as design-glide.json warned.", "lean/Delphi/Scaling.lean:136; design-glide.json risks", "medium"),
    F("New file MaxLiftToDrag.lean (imports Mathlib and Delphi.Flight) passes check.sh: errors=0 sorryAx=0 axiom-lines=5/5; all five #print axioms show only propext, Classical.choice, Quot.sound. Passed on the first run; no failed attempts.", "scripts/t4-glide-law/check_out.txt", "high", v="ALL CHECKED: no errors, no sorryAx"),
    F("Exact statement: under Polar CD0 e AR CL CD (CD = CD0 + CL^2/(pi e AR)) with CD0, e, AR, CL > 0, CL/CD <= (1/2) sqrt(pi e AR / CD0) (ld_le); attained at CL = sqrt(pi e AR CD0), CD = 2 CD0 (ld_attained); and with Lift = W, W h = D x + loss, loss >= 0, Lift/D = CL/CD, x <= h * ((1/2) sqrt(pi e AR / CD0)) (glide_range_le_aspect, built on Delphi.glide_range_le).", "scripts/t4-glide-law/MaxLiftToDrag.lean", "high"),
    F("Limits: the parabolic polar is a NAMED HYPOTHESIS, not derived from lifting-line theory; C_D0 and e are inputs; it covers forward glide, not autorotation; at the Reynolds numbers of the printed fruit (about 4000-5000 per design-glide.json) the polar may not hold. Nothing was measured.", "MaxLiftToDrag.lean header; design-glide.json", "high"),
]

key = [
    F("Delphi.glide_range_le is the registered glide bound and takes L/D only as a committed number.", "lean/Delphi/Flight.lean:115 and registry/laws/flight-climb-glide-law.json", "high", "theorem glide_range_le {W h D x LDmax loss Lift : ℝ}"),
    F("aspect-ratio-induced-drag is a placeholder in 1.8.1 with no theorem.", "registry/laws/aspect-ratio-induced-drag.json", "high", "not formalised: L/D enters only as a committed number"),
    F("14 of 59 pinned laws have no Lean theorem.", "lawset-1.8.1.json plus registry/laws/*.json", "high"),
    F("MaxLiftToDrag.lean checks with no errors and no sorryAx and composes with Delphi.glide_range_le.", "scripts/t4-glide-law/check_out.txt", "high"),
]

out = {
    "label": "t4-glide-law",
    "topic": "Track 4 law map against law set 1.8.1, with one new checked Lean law",
    "summary": "Mapped Track 4 (passive glide, printed autorotating-fruit design) onto law set 1.8.1 of the application repo (59 pinned laws, 14 placeholders with no theorem). Registered glide laws: glide_range_le, wind_glide_rules_out, vmin_le/vmin_ratio and the allometry and scaling theorems; all take L/D as a committed number. The most valuable easy missing law is max L/D from aspect ratio on a parabolic polar, composed with glide_range_le. I wrote it as MaxLiftToDrag.lean and it checks with no errors and no sorryAx. The earlier map used 1.6.0 and listed this gap without proving anything. Autorotation (sink without forward travel) has no registry law; the design's disk rule is only an instance of vmin_le.",
    "lay_summary": "The project keeps a library of rules that a design must obey, each backed by a computer-checked proof. I looked up which rules apply to a small printed glider. They cap how far it can travel from a given height, but only if you already know its best glide ratio. That ratio depends on how long and thin the wings are, and no rule linked the two. I wrote and machine-checked that missing rule: long, thin wings glide further, but never past a limit set by their shape. Think of a paper dart: a longer wingspan helps, but only up to a point. The rule assumes a simple standard model of drag, so it is a limit under that assumption, not a measurement.",
    "findings": findings,
    "key_claims": key,
    "table": table,
    "glossary": [
        {"term": "Lean", "plain": "A proof checker that only accepts a proof if every step is valid."},
        {"term": "sorryAx", "plain": "A marker Lean uses when a proof has a hole in it."},
        {"term": "law set", "plain": "A frozen list of rules the project checks designs against."},
        {"term": "placeholder law", "plain": "A rule listed in the library but with no proof yet."},
        {"term": "lift-to-drag ratio (L/D)", "plain": "How far a glider moves forward for each unit it falls."},
        {"term": "aspect ratio", "plain": "Wingspan squared divided by wing area: how long and thin a wing is."},
        {"term": "drag polar", "plain": "A formula giving a wing's drag from its lift."},
        {"term": "autorotation", "plain": "Spinning like a maple seed as it falls, with no forward glide."},
        {"term": "named hypothesis", "plain": "An assumption written down openly and used as the starting point of a proof."},
    ],
    "reproduce": [
        {"what": "Recount the law set and diff against 1.6.0", "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-law/lawmap.py", "expected": "1.8.1 pinned 59, 1.6.0 pinned 53; Counter accepted 36, candidate 10, proposed 7, retired 3, contested 3"},
        {"what": "Check the new Lean file (Lean v4.35.0 via elan in C:/Temp/elan, project Mathlib)", "command_or_url": "bash D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-law/MaxLiftToDrag.lean", "expected": "errors=0 sorryAx=0 axiom-lines=5/5 and ALL CHECKED: no errors, no sorryAx"},
        {"what": "Confirm no polar or max L/D theorem exists", "command_or_url": "grep -rniE 'induced|polar|C_D0|maxLD' D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/*.lean", "expected": "only glide-range hits, none about a polar"},
    ],
    "citations": [],
    "could_not_find": [
        "No citation was fetched this run, so citations is empty; the parabolic polar is textbook background (unverified here) and the Spedding and McArthur and Park and Choi DOIs in the older file were not re-verified by me.",
        "I did not derive the polar from lifting-line theory; Mathlib has no such library, so it stays a named hypothesis.",
        "I read only lean_ref names for candidates, not the bodies of registry/proposals/*/law.lean.",
        "Not covered: an autorotation disk-loading law, static stability, Reynolds dependence of C_Lmax and C_D0.",
    ],
    "scripts_written": [
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-law/MaxLiftToDrag.lean",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-law/lawmap.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-law/out.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-law/check_out.txt",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-law/lawmap_out.txt",
    ],
    "recommendations": [
        "Propose MaxLiftToDrag.lean to the lean thread as the formalisation of aspect-ratio-induced-drag (theorem-from-hypothesis, polar as named hypothesis), plus a Constraints.lean rule-out lemma.",
        "Next easy laws: launch-energy range bound x <= (h + v0^2/2g) LDmax, and fin cantilever deflection as named-hypothesis algebra.",
        "For the autorotating-fruit design, state the disk rule as an instance of vmin_le and treat any glide claim as untested.",
    ],
}
json.dump(out, open('D:/Users/ashenoy00000/delphi-work/agents2/t4-glide-law.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(findings))
