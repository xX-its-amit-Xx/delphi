import fs from 'fs';
const L = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/';
const S = 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t1-reporter-law/';
const f = (claim, source, confidence, value, q) => ({ claim, source, confidence, value, evidence_quote: q || '' });
const out = {
  label: 't1-reporter-law',
  topic: 'Track 1 law map against law set 1.8.1, with a checked Lean law (Hill gate threshold-steepness separability)',
  summary: 'Law set 1.8.1 pins 59 laws (36 accepted, 10 candidate, 7 proposed, 3 contested, 3 retired); 14 pinned laws have no theorem. It contains no law about gene-regulatory input-output maps: the only entry is the placeholder gene-regulatory-dynamics (module and theorem null). Laws bearing indirectly: physiology-q10, perturb-thermal, turing-ddi (candidate; replaces the older turing-ddi-linear-condition, which is not pinned in 1.8.1), development-growth-asymptote, genotype-genetic-code, genotype-substitution-time, genotype-pleiotropy-closure, genotype-developmental-ordering, E7. The older map (laws-reporter.json, set 1.6.0) cited Delphi.Turing.* theorems that do not exist in the 1.8.1 tree (no Turing.lean in lean/Delphi; Delphi.lean does not mention Turing) and missed turing-ddi, development-growth-asymptote and the genotype-developmental-ordering law. I wrote and checked HillSeparability.lean: for a Cello-form Hill repressor gate, rescaling K is exactly a translation of the input on the log axis (n untouched), the threshold fold is K2/K1 at every activation level, and the 10-to-90 percent input span is 81^(1/n) independent of K. check.sh: errors=0, sorryAx=0, 8/8 axiom lines. This is the mathematical half only; that a real RBS change leaves n unchanged is the empirical claim the track tests and is not proved.',
  lay_summary: 'The project keeps a library of computer-checked biology rules. I searched it for rules about a gene switch that turns a reporter protein up or down and found none: the one entry is an empty placeholder. I then wrote and machine-checked a small new rule. A gene switch has a midpoint (how much input flips it) and a steepness (how sharply it flips). The rule proves that moving the midpoint just slides the whole curve sideways on a logarithmic ruler and leaves the steepness exactly as it was. Think of sliding a ruler along a table: the markings stay the same distance apart. Whether real engineered switches behave this way is a lab question the proof does not settle.',
  findings: [
    f('Law set 1.8.1 pins 59 laws: accepted 36, candidate 10, proposed 7, contested 3, retired 3.', L + 'registry/lawsets/lawset-1.8.1.json (script ' + S + 'count.mjs)', 'high', '59'),
    f('Exactly 14 pinned laws have no Lean theorem: aspect-ratio-induced-drag, disc-flying-fish-fin-ratio-gap, disc-heterurus-mass-exponent, disc-measured-wing-loading-band, disc-pectoral-length-allometry, elastic-similarity, fick-principle, fin-length-ratio, gene-regulatory-dynamics, gill-o2-uptake, muscle-power-premise, taxiing-thrust, test-loop-only-density-sanity, walking-pendulum-speed (6 of them carry a module but no theorem name: the four disc-*, fick-principle, muscle-power-premise).', S + 'count-output.txt', 'high', '14'),
    f('gene-regulatory-dynamics is the only law on regulatory dynamics: status proposed, class gap, lean_ref.module and lean_ref.theorem null, v1.0.0.', L + 'registry/laws/gene-regulatory-dynamics.json', 'high', '', '"module": null,'),
    f('physiology-q10 (accepted 1.0.0): Delphi.Physiology.q10_ratio and Delphi.Physiology.q10_log, module lean/Delphi/Physiology.lean.', L + 'Delphi/Physiology.lean', 'high', '', 'theorem q10_ratio {X0 Q10 Tref T₁ T₂ : ℝ} (hX : X0 ≠ 0) (hQ : 0 < Q10)'),
    f('perturb-thermal (accepted 1.0.0): Delphi.Perturb.thermal_rules_out, module lean/Delphi/Perturb.lean.', L + 'registry/laws/perturb-thermal.json', 'medium'),
    f('turing-ddi (candidate 1.1.0): Delphi.LeanBio.Round2.TuringDDI.turing_instability, witness Delphi.LeanBio.Round2.TuringDDI.witness, module lean/registry/proposals/turing-ddi/law.lean. Two-morphogen reaction-diffusion only.', L + 'registry/laws/turing-ddi.json', 'high', '', 'theorem turing_instability {du dv fu fv gu gv : ℝ} (h : TuringHyp du dv fu fv gu gv)'),
    f('development-growth-asymptote (candidate 1.0.0): Delphi.LeanBio.Round2.GrowthAsymptote.von_bertalanffy_asymptote, module lean/registry/proposals/development-growth-asymptote/law.lean; nearest existing analogue of shape-from-rate, scale-separately.', L + 'registry/laws/development-growth-asymptote.json', 'medium'),
    f('Accepted genotype laws: genotype-genetic-code (Delphi.Genotype.claimed_substitutions_rules_out), genotype-substitution-time (Delphi.Genotype.expectedWaitingTime_bounds), genotype-pleiotropy-closure (Delphi.Genotype.closure_of_check), genotype-developmental-ordering (Delphi.Genotype.devOrdered_of_check), all in lean/Delphi/Genotype.lean; E7 is Delphi.Empirical.cannot_score_of_lethal_before in lean/Delphi/Empirical.lean.', L + 'registry/laws/*.json', 'high'),
    f('The older map cited turing-ddi-linear-condition (Delphi.Turing.turing_instability_iff, no_instability_of_equal_diffusivity). That id is not pinned in 1.8.1, lean/Delphi has no Turing.lean, and Delphi.lean has 0 mentions of Turing.', S + 'count-output.txt; directory listing of ' + L + 'Delphi', 'high'),
    f('turing-wavelength, fisher-sex-ratio and hamilton-rule have law files but are not pinned in 1.8.1; test-loop-only-density-sanity is retired and excluded from lean_check from 1.8.1.', L + 'registry/lawsets/lawset-1.8.1.json', 'high'),
    f('HillSeparability.lean: check.sh reports errors=0 sorryAx=0 axiom-lines=8/8, ALL CHECKED; toolchain leanprover/lean4:v4.35.0; one linter warning (hn unused in repress_at_K).', S + 'check-output.txt', 'high')
  ],
  key_claims: [
    { claim: 'No pinned law in 1.8.1 formalises a gene-regulatory input-output map; gene-regulatory-dynamics is a null placeholder.', source: L + 'registry/laws/gene-regulatory-dynamics.json', evidence_quote: '"module": null,' },
    { claim: '1.8.1 pins 59 laws and exactly 14 have no theorem name.', source: S + 'count-output.txt', evidence_quote: 'pinned 59 ... no theorem 14' },
    { claim: 'HillSeparability.lean (sha256 0e19b9fc3514e9b631b498f1f8be686ec54f0f2eddbc1f2cda520195d0cf0124) checks with no errors and no sorryAx; theorems hold for all positive K, n, x, c and assume nothing about real RBS data.', source: S + 'check-output.txt', evidence_quote: 'errors=0 sorryAx=0 axiom-lines=8/8' }
  ],
  table: [
    ['gene-regulatory-dynamics', 'status=proposed; class=gap; module=null; theorem=null; version=1.0.0'],
    ['physiology-q10', 'status=accepted; module=lean/Delphi/Physiology.lean; theorem=Delphi.Physiology.q10_ratio'],
    ['perturb-thermal', 'status=accepted; module=lean/Delphi/Perturb.lean; theorem=Delphi.Perturb.thermal_rules_out'],
    ['turing-ddi', 'status=candidate; module=lean/registry/proposals/turing-ddi/law.lean; theorem=Delphi.LeanBio.Round2.TuringDDI.turing_instability'],
    ['development-growth-asymptote', 'status=candidate; module=lean/registry/proposals/development-growth-asymptote/law.lean; theorem=Delphi.LeanBio.Round2.GrowthAsymptote.von_bertalanffy_asymptote'],
    ['genotype-genetic-code', 'status=accepted; module=lean/Delphi/Genotype.lean; theorem=Delphi.Genotype.claimed_substitutions_rules_out'],
    ['genotype-substitution-time', 'status=accepted; module=lean/Delphi/Genotype.lean; theorem=Delphi.Genotype.expectedWaitingTime_bounds'],
    ['genotype-pleiotropy-closure', 'status=accepted; module=lean/Delphi/Genotype.lean; theorem=Delphi.Genotype.closure_of_check'],
    ['genotype-developmental-ordering', 'status=accepted; module=lean/Delphi/Genotype.lean; theorem=Delphi.Genotype.devOrdered_of_check'],
    ['E7', 'status=accepted; module=lean/Delphi/Empirical.lean; theorem=Delphi.Empirical.cannot_score_of_lethal_before']
  ].map(([name, fields]) => ({ name, fields, source: L + 'registry/laws/' + name + '.json' })).concat([
    { name: 'NEW HillSeparability.lean', fields: 'file=' + S + 'HillSeparability.lean; namespace=Delphi.Track1.HillSeparability; theorems=repress_scale,repress_threshold_shift,repress_at_K,hill_level,hill_level_unique,level_fold,span_81,span_independent_of_K; result=errors 0, sorryAx 0', source: S + 'check-output.txt' }
  ]),
  recommendations: [
    'Propose HillSeparability as a companion/successor of gene-regulatory-dynamics (version bump; scope.taxa engineered gates; the empirical side condition "RBS-only change leaves n unchanged" stays a named, testable hypothesis, not a theorem).',
    'Headline statements: level_fold: hill K1 n x1 = p and hill K2 n x2 = p give x2/x1 = K2/K1 for every p in (0,1). span_81: hill K n x1 = 1/10 and hill K n x2 = 9/10 give x2/x1 = 81^(1/n).',
    'Next unformalised laws for this track (from laws-reporter.json missing[]): reporter steady state and dynamic range (a0 + a h)/g, and Hill cascade composition.'
  ],
  reproduce: [
    { what: 'Pinned count, placeholder count, old-map ids', command_or_url: 'node ' + S + 'count.mjs', expected: 'pinned 59 {accepted 36, retired 3, proposed 7, candidate 10, contested 3}; no theorem 14; turing-ddi-linear-condition NOT pinned in 1.8.1' },
    { what: 'Check the Lean file (Lean v4.35.0, project Mathlib)', command_or_url: 'bash D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh ' + S + 'HillSeparability.lean', expected: 'errors=0 sorryAx=0 axiom-lines=8/8 ... ALL CHECKED: no errors, no sorryAx' }
  ],
  citations: [],
  scripts_written: [S + 'HillSeparability.lean', S + 'count.mjs', S + 'build.mjs'],
  glossary: [
    { term: 'Lean', plain: 'a proof checker that accepts a statement only if every step is verified by computer' },
    { term: 'sorryAx', plain: 'the marker Lean leaves when a proof has a hole; its absence means no holes' },
    { term: 'Hill curve', plain: 'an S-shaped curve describing how a gene switch output changes with input' },
    { term: 'threshold (K)', plain: 'the input at which the switch is half way' },
    { term: 'steepness (n)', plain: 'how sharply the switch flips' },
    { term: 'RBS', plain: 'the DNA stretch that sets how strongly a gene is translated into protein' },
    { term: 'law set', plain: 'a frozen, versioned list of checked rules' },
    { term: 'placeholder law', plain: 'a registry entry with no proof behind it' }
  ],
  could_not_find: [
    'No literature fetched, so no citations; the Cello data were not re-read in this task.',
    'Whether real RBS-only changes leave n unchanged is neither proved nor tested here.',
    'Did not run the registry test suites; lawset counts come from my own script only.',
    'check.sh printed a blank Mathlib revision (its manifest grep found nothing), so the exact Mathlib commit is not recorded.',
    'I left out one pinned law whose 1.8.1 title names a holdout taxon (frozen-holdout rule).'
  ]
};
fs.writeFileSync('D:/Users/ashenoy00000/delphi-work/agents2/t1-reporter-law.json', JSON.stringify(out, null, 1));
