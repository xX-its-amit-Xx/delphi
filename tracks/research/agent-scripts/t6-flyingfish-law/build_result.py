import json
O = 'D:/Users/ashenoy00000/delphi-work/agents2/'
rows = {r['id']: r for r in json.load(open(O + 'scratch/t6-flyingfish-law/laws181.json'))}
rel = ['aerobic-power-bound', 'fick-principle', 'flight-allometry-law', 'flight-climb-glide-law', 'altitude-coupling',
       'scaling-area-law', 'scaling-strength-law', 'scaling-bending-law', '[claim id withheld]', '[claim id withheld]',
       'thompson1917-ch02-10', 'thompson1917-ch03-07', 'muscle-power-premise', 'perturb-thermal', 'perturb-current',
       'perturb-pressure', 'perturb-depth-cap', 'perturb-isa-vmin', 'perturb-wind-glide', 'perturb-energy-balance',
       'E1', 'E2', 'E3', 'E4', 'E5', 'E7', 'disc-flying-fish-fin-ratio-gap', 'disc-pectoral-length-allometry',
       'disc-measured-wing-loading-band', 'disc-heterurus-mass-exponent', 'blueprint-well-formedness',
       'genotype-developmental-ordering', 'genotype-genetic-code', 'genotype-pleiotropy-closure',
       'genotype-substitution-time', 'haldane-cost-of-selection', 'physiology-q10', 'physiology-laplace',
       'development-growth-asymptote', 'aspect-ratio-induced-drag', 'taxiing-thrust', 'fin-length-ratio',
       'gill-o2-uptake', 'elastic-similarity', 'gene-regulatory-dynamics', 'kimura-fixation-probability',
       'kimura-substitution-rate', 'favored-fixation-lower-bound']
P = 'lean/registry/lawsets/lawset-1.8.1.json'
R = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/"
F = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-law/DragPolarBound.lean"
table = []
for i in rel:
    r = rows[i]
    table.append(dict(name=i, fields="version=%s; pinned_status=%s; class=%s; theorem=%s; module=%s" % (
        r['ver'], r['pin_status'], r['cls'], r['theorem'] or 'NONE (placeholder)', r['module'] or 'none'),
        source=R + "registry/law-versions/%s (or laws/%s.json) and %s" % (r['src'], i, P)))
STMT = ("theorem T6.DragPolar.ld_le_bound {e AR CD0 CL CD : R} (he : 0 < e) (hAR : 0 < AR) (hCD0 : 0 < CD0) "
        "(hCL : 0 < CL) (hpolar : CD = CD0 + CL ^ 2 / (pi * e * AR)) : CL / CD <= ldBound e AR CD0, "
        "where ldBound e AR CD0 := Real.sqrt (pi * e * AR / CD0) / 2")


def f(c, s, conf='high', q=''):
    return dict(claim=c, source=s, confidence=conf, evidence_quote=q)


findings = [
    f("Law set 1.8.1 (current.json -> lawset-1.8.1.json, created 2026-11-01T05:37:39Z, previous 1.8.0) pins 59 laws: 36 accepted, 10 candidate, 7 proposed, 3 retired, 3 contested (counted by dump_laws.py / a Counter in session).", R + "registry/lawsets/lawset-1.8.1.json"),
    f("14 pinned laws have no Lean theorem name: aspect-ratio-induced-drag, disc-flying-fish-fin-ratio-gap, disc-heterurus-mass-exponent, disc-measured-wing-loading-band, disc-pectoral-length-allometry, elastic-similarity, fick-principle (named-hypothesis), fin-length-ratio, gene-regulatory-dynamics, gill-o2-uptake, muscle-power-premise (retired), taxiing-thrust, test-loop-only-density-sanity (retired), walking-pendulum-speed. The other 45 carry a theorem name; verify_names.py found a declaration of that short name in the named module for all 45.", R + "registry/law-versions/*.json; scripts/verify_names.py"),
    f("Since the 1.6.0 set the old map used, 1.8.1 added development-growth-asymptote, fisher-kpp-speed, kimura-heterozygosity, maynardsmith-hawk-dove, turing-ddi (all candidate, non-binding) and test-loop-only-density-sanity (retired); removed none; bumped E2 1.1.0, E3 2.1.0, aerobic-power-bound 1.1.0, fick-principle 1.3.0, scaling-area-law 1.1.0, scaling-strength-law 1.1.0, thompson1917-ch02-10 1.1.0, thompson1917-ch03-07 1.1.0.", R + "registry/lawsets/lawset-1.6.0.json vs lawset-1.8.1.json (set diff run in session); registry/CHANGELOG.md", "high", "Changed - E2 1.0.0 -> 1.1.0 - aerobic-power-bound 1.0.0 -> 1.1.0 - fick-principle 1.2.0 -> 1.3.0"),
    f("laws-flyingfish.json cites E3 2.0.0 and fick-principle 1.1.0; in 1.8.1 they are E3 2.1.0 and fick-principle 1.3.0, so the older map's version numbers are stale.", "D:/Users/ashenoy00000/delphi-work/agents/laws-flyingfish.json vs lawset-1.8.1.json"),
    f("The older map's 'BROKEN REFERENCE' (vmin_rules_out and aerobic_flight_rules_out undefined; C8-C16 lemmas missing from Constraints.lean) is true of the split-out leanbio 1.6.0 tree but NOT of the application repo: lean/Delphi/Constraints.lean defines vmin_rules_out (line 243), aerobic_flight_rules_out (316), glide_range_rules_out (324), climb_rules_out (331) and froude_rules_out (338).", R + "Delphi/Constraints.lean", "high", "theorem vmin_rules_out {ρ S C Cmax W v : ℝ} (hρ : 0 < ρ) (hS : 0 < S)"),
    f("The application repo's lean/Delphi.lean imports Scaling, Flight, Genotype, Physiology, Empirical, Altitude, Perturb, Hydrostatics and Constraints, so the track's core modules are in its default import closure; the older map's 'not in the default build' finding applies to leanbio, not here.", R + "Delphi.lean"),
    f("The registry laws/ folder has 62 files; 3 are not pinned by 1.8.1 (fisher-sex-ratio, hamilton-rule, turing-wavelength). The older map's 11 unpinned laws (cell geometry, crystals) are not in this registry at all.", R + "registry/laws/ vs lawset-1.8.1.json"),
    f("Flying-fish-specific laws in 1.8.1 are placeholders or candidates without a theorem: disc-flying-fish-fin-ratio-gap, disc-measured-wing-loading-band, disc-pectoral-length-allometry (candidate) and disc-heterurus-mass-exponent (contested). The proved Lean content that touches the fish is Delphi.Certificates.AFlyingFish (aFlyingFish_wellFormed etc., under blueprint-well-formedness) and the Eliminations*/FinDevelopment certificates, which are not registry laws themselves.", R + "registry/laws/disc-*.json; Delphi/Certificates/"),
    f("Missed or only partly seen by the older map: physiology-q10 and physiology-laplace (Delphi.Physiology.q10_ratio, laplace_pressure_limit); the Delphi.Altitude helpers vmin_mono, demand_mono, supply_anti, demand_anti_area under altitude-coupling; Delphi.Hydro.closed_bladder_rules_out; Delphi.Scaling.froude_ratio and Constraints.froude_rules_out (no registry law pins froude); development-growth-asymptote (von Bertalanffy, candidate) for fin growth; and the seven pinned gaps aspect-ratio-induced-drag, taxiing-thrust, gill-o2-uptake, fin-length-ratio, elastic-similarity, gene-regulatory-dynamics, walking-pendulum-speed.", R + "Delphi/*.lean; registry/laws", "medium"),
    f("The gap aspect-ratio-induced-drag (status proposed, class gap, lean_ref.theorem null) states 'not formalised: L/D enters only as a committed number'. A grep of the application repo's lean/ tree for induced/polar/aspect matched no .lean file.", R + "registry/laws/aspect-ratio-induced-drag.json"),
    f("NEW LAW CHECKED: " + STMT + ". check.sh reported 'errors=0 sorryAx=0 axiom-lines=6/6' and 'ALL CHECKED: no errors, no sorryAx'; axioms are propext, Classical.choice, Quot.sound only. Toolchain leanprover/lean4:v4.35.0.", F, "high", "ALL CHECKED: no errors, no sorryAx"),
    f("The same file also proves (all checked): ld_sq_le (core algebra, (CL/CD)^2 <= 1/(4 k CD0)), ld_bound_attained (equality at CL = sqrt(pi e AR CD0), non-vacuity), ldBound_strictMono (bound strictly increasing in AR), glide_range_le_polar (composes Delphi.glide_range_le: x <= h * ldBound), glide_range_polar_rules_out (False if the claimed range exceeds h*ldBound).", F),
    f("First compile attempt FAILED (errors=2, sorryAx=3: a rewrite on an unresolved metavariable in ld_le_bound); fixed by stating the polar with k = 1/(pi e AR) explicitly; the second run passed. Only the second result is reported as passing.", F),
]
res = dict(
    label="t6-flyingfish-law",
    topic="Track 6 law map against law set 1.8.1 with a checked Lean law (parabolic drag polar L/D bound)",
    summary="Mapped Track 6 against the application repo's law set 1.8.1 (59 pinned laws; 45 with a Lean theorem verified present in the named module, 14 placeholders with none). 48 relevant laws are in 'table' with registry id, version, status, theorem and module. The older map used leanbio 1.6.0: its versions are stale (E3 2.0.0, fick 1.1.0), its 'broken reference' finding does not hold in the application repo (vmin_rules_out etc. are defined in Constraints.lean), and it missed physiology, Hydro, altitude helpers, froude and the growth-asymptote candidate. Chosen missing law: the parabolic drag polar bound C_L/C_D <= (1/2) sqrt(pi e AR / C_D0), which closes the registry gap aspect-ratio-induced-drag. It is in DragPolarBound.lean, composed with Delphi.glide_range_le, and passes check.sh with no errors and no sorryAx (first attempt failed, then fixed). It is a theorem about a MODEL (the parabolic polar is a hypothesis); no flying-fish C_D0, e or AR was measured here, so it is not yet an empirical test.",
    lay_summary="A flying fish glides because its long fins give lift, but the fins also cause drag. Engineers know a rule: the longer and thinner the wing, the better the glide ratio, up to a limit. The project's rulebook had this rule only as a note saying 'not written down yet'. I wrote it as a short mathematical proof, and a computer proof-checker confirmed every step. On a simple drag model, the glide ratio can never beat half the square root of a number built from the wing shape. The proof links to the existing rule on how far a glide can go from a given height. It only holds if the fish's real drag follows that simple model, which nobody has measured yet.",
    glossary=[dict(term="law set", plain="a numbered, frozen list of the rules the project checks designs against"),
              dict(term="Lean", plain="a proof-checking program that accepts a statement only if every step is justified"),
              dict(term="sorryAx", plain="the marker Lean leaves when a proof has a hole"),
              dict(term="placeholder law", plain="a rule listed in the rulebook with no machine-checked proof yet"),
              dict(term="glide ratio (L/D)", plain="how many metres you travel forward per metre you drop"),
              dict(term="aspect ratio", plain="wingspan squared divided by wing area; large means long and thin"),
              dict(term="drag polar", plain="a formula giving total drag from lift"),
              dict(term="registry gap", plain="a rule the project knows it lacks")],
    findings=findings,
    key_claims=[
        dict(claim="Law set 1.8.1 pins 59 laws, 14 of which have no Lean theorem; the 45 named theorems exist in their modules.", source="lawset-1.8.1.json + law-versions + verify_names.py", evidence_quote=""),
        dict(claim="The application repo's Constraints.lean defines vmin_rules_out, aerobic_flight_rules_out and glide_range_rules_out, so the older map's broken-reference finding does not apply there.", source=R + "Delphi/Constraints.lean lines 243, 316, 324", evidence_quote="theorem vmin_rules_out {ρ S C Cmax W v : ℝ} (hρ : 0 < ρ) (hS : 0 < S)"),
        dict(claim="DragPolarBound.lean passes check.sh with errors=0 sorryAx=0 and standard axioms only; the first attempt had errors.", source=F, evidence_quote="ALL CHECKED: no errors, no sorryAx")],
    recommendations=["Register DragPolarBound as a candidate law replacing the gap aspect-ratio-induced-drag (owner decision; nothing was written into the repo).",
                     "Cite or measure C_D0, span efficiency and aspect ratio for a flying-fish specimen before using ldBound as an elimination test; until then it is model-conditional.",
                     "Pin the unregistered helpers (froude, Hydro) to a law."],
    reproduce=[dict(what="Rebuild law table", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-law/dump_laws.py", expected="59 laws printed, last line '14 without theorem'"),
               dict(what="Check theorem names exist", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-law/verify_names.py | grep -c OK", expected="45 (no MISSING lines)"),
               dict(what="Check the Lean file (Lean v4.35.0, project Mathlib, elan in C:/Temp/elan)", command_or_url="bash D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh " + F, expected="errors=0 sorryAx=0 axiom-lines=6/6; ALL CHECKED: no errors, no sorryAx"),
               dict(what="Rebuild this JSON", command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-law/build_result.py", expected="prints 48")],
    citations=[],
    could_not_find=["No literature citation was fetched (the task was repository mapping), so citations is empty; no flying-fish C_D0, span efficiency or aspect ratio value was read, so the bound is not instantiated numerically.",
                    "Whether every Constraints rules_out lemma (about 34) is registered under a law id was not exhaustively mapped via constraints.json.",
                    "Did not run a full lake build of the repo, only the single file through check.sh."],
    table=table,
    scripts_written=["dump_laws.py", "verify_names.py", "DragPolarBound.lean", "build_result.py"])
res['new_law'] = dict(file=F, statement=STMT, result="check.sh: errors=0 sorryAx=0 axiom-lines=6/6; ALL CHECKED")
json.dump(res, open(O + 't6-flyingfish-law.json', 'w', encoding='utf8'), indent=1, ensure_ascii=False)
print(len(table))
