#!/usr/bin/env node
// Audits every theorem the compiler accepted against the flying fish (Exocoetidae), and grounds every piece of
// the 3D anatomy model in the theorems that constrain it (or says explicitly that none does).
//   node lean/flying-fish/audit.mjs
// -> lean/flying-fish-audit.json, lean/AUDIT-FLYING-FISH.md, lean/morphology-grounding.json
// Theorem names, modules and docstrings come from dashboard/public/t/lean/lean.json (the compiler's output);
// measured inputs come from physics/glide-data.csv, physics/allometry.json, genotype/cache/daane2021_fin_ratios.json,
// lean/bound/parameters.json and lean/bound/result.json, lean/blueprint/certificates/a-flying-fish.json and
// anatomy-model/manifest.json. The judgements (does the theorem apply, which inputs are measured, proxy or missing,
// the verdict) are written by the lean thread in JUDGEMENTS below; every number they cite is computed here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const R = JSON.parse(rd('dashboard/public/t/lean/lean.json'));
const ALLO = JSON.parse(rd('physics/allometry.json'));
const FIN = JSON.parse(rd('genotype/cache/daane2021_fin_ratios.json'));
const BP = JSON.parse(rd('lean/bound/parameters.json'));
const BR = JSON.parse(rd('lean/bound/result.json'));
const CERT = JSON.parse(rd('lean/blueprint/certificates/a-flying-fish.json'));
const MAN = JSON.parse(rd('anatomy-model/manifest.json'));
const TAXON = JSON.parse(rd('lean/blueprint/data/a-flying-fish.taxon.json'));

// ---- measured inputs, each with its file and locator ----
const csv = rd('physics/glide-data.csv').split(/\r?\n/).filter(Boolean);
const head = csv[0].split(',');
const rows = csv.slice(1).map(l => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ''])); });
const L3 = rows.find(r => /model L3/.test(r.source_locator));
const g = 9.80665, rho = 1.225; // standard gravity; sea-level air density, the lean thread's assumption (physics/results.json used the same v_min)
const W = +L3.body_mass_kg * g, S = +L3.pectoral_fin_area_m2 + +L3.pelvic_fin_area_m2 + +L3.body_planform_area_m2, CLmax = +L3.CL_max;
const vmin = Math.sqrt(2 * W / (rho * S * CLmax));
const field = rows.find(r => r.row_kind === 'field summary' && /10 to 20/.test(r.airspeed_m_s));
const fieldSpeeds = [10, 20];
const areaNeeded = v => 2 * W / (rho * v * v * CLmax);
const exp = q => ALLO.entries.find(e => e.quantity === q);
const bMass = exp('body mass vs standard length'), bArea = exp('lateral fin area vs standard length'), bWS = exp('wing loading vs standard length');
// mass vs fork length, Makiguchi 2013, 13 Cheilopogon heterurus doederleini (OLS log-log slope; narrow length range)
const mk = rows.filter(r => r.source_id === 'makiguchi-2013' && r.row_kind === 'specimen' && r.sample_size === '1');
const ols = pts => { const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n; const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0), sxy = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0); return { slope: sxy / sxx, n }; };
const mkFit = ols(mk.map(r => [Math.log(+r.body_length_m), Math.log(+r.body_mass_kg)]));
const finRatio = FIN.groups['flying fish'];
const Mproxy = 2e9; // 2N with the only published Ne (> 1e9, E. volitans, mtDNA; lean/bound/parameters.json)
const blueprintIds = new Set(TAXON.neverIn.map(x => x.term).concat(TAXON.inTaxon.map(x => x.term)));
// FishBase length-weight (physics/length-weight.csv): only rows with a locality and n > 10 are fitted field studies.
const lwCsv = rd('physics/length-weight.csv').split(/\r?\n/).filter(Boolean);
const lwHead = lwCsv[0].split(',');
const lwRows = lwCsv.slice(1).map(l => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return Object.fromEntries(lwHead.map((h, i) => [h, c[i] ?? ''])); });
const lwFitted = lwRows.filter(r => Number(r.n) > 10 && r.locality && !/not given/i.test(r.locality));
const lwText = lwFitted.map(r => `${r.species}${r.sex && r.sex !== 'unsexed' ? ' ' + r.sex : ''} b = ${r.b} (n = ${r.n}, ${r.length_type})`).join('; ');
const lwUnverified = lwRows.length - lwFitted.length;
const GE = JSON.parse(rd('physics/ground-effect.json'));
const geMax = Math.max(...GE.measured.filter(m => typeof m.drag_change === 'number').map(m => -m.drag_change));
const glideField = rows.filter(r => r.row_kind === 'field summary' && r.glide_distance_m).map(r => r.glide_distance_m);
const heightMax = +rows.find(r => r.row_kind === 'field summary' && r.height_m).height_m;
const LDtheory = +rows.find(r => r.row_kind === 'theory' && r.LD_max).LD_max;
const glideBound = (LD, d) => heightMax * LD / (1 - d);
// Physiology chain proxies (lean/eliminate/physiology-candidates.json, from physiology/ at commit a1ca4f00).
const PC = JSON.parse(rd('lean/eliminate/physiology-candidates.json')).chain_inputs;
const chainQ = +PC.cardiac_output_ml_per_s.value, chainCa = +PC.arterial_O2_content_ml_per_ml.value, chainEta = +PC.muscular_efficiency.value, chainE = +PC.oxycaloric_J_per_ml_O2.value;
const aerobicCeiling = chainEta * chainE * chainQ * chainCa;
const preqField = W * 10 / +L3.LD_max;

const SRC = {
  glide: 'physics/glide-data.csv (Park and Choi 2010 Table 1 model L3 and Table 2; field summaries citing Hertel 1966, Fish 1990, Davenport 1994)',
  allo: 'physics/allometry.json (Davenport 1992 abstract, Exocoetus obtusirostris, log-log slopes on standard length; no CI in the abstract)',
  fin: 'genotype/cache/daane2021_fin_ratios.json (Daane et al. 2021 Data S1A, 49 flying-fish museum specimens)',
  bound: 'lean/bound/parameters.json and lean/bound/result.json',
  cert: 'lean/blueprint/certificates/a-flying-fish.json and lean/blueprint/data/a-flying-fish.taxon.json',
  mk: 'physics/glide-data.csv (Makiguchi et al. 2013 Table 1, 13 Cheilopogon heterurus doederleini, fork length and mass)'
};
const f3 = x => Number(x).toFixed(3), e2 = x => Number(x).toExponential(2);

// ---- measured facts reused across rows ----
const F = {
  vmin: { name: 'v_min for specimen L3', value: +vmin.toFixed(2), unit: 'm/s', how: `sqrt(2W/(ρ S C_L,max)) with W = ${f3(W)} N (mass ${L3.body_mass_kg} kg × g), S = ${S.toFixed(6)} m² (pectoral + pelvic + body planform), C_L,max = ${CLmax}, ρ = ${rho} kg/m³ (assumed)`, status: 'computed from measured', source: SRC.glide },
  fieldSpeed: { name: 'field glide airspeed', value: field.airspeed_m_s, unit: 'm/s', status: 'secondary (field summary)', source: SRC.glide },
  bMass: { name: 'mass vs standard length exponent', value: bMass.exponent, status: 'measured (one species, abstract, no CI)', source: SRC.allo },
  bArea: { name: 'lateral fin area vs standard length exponent', value: bArea.exponent, status: 'measured (one species, abstract, no CI)', source: SRC.allo },
  bWS: { name: 'wing loading vs standard length exponent', value: bWS.exponent, status: 'measured (one species, abstract, no CI)', source: SRC.allo },
  mkFit: { name: 'mass vs fork length OLS exponent, 13 fish', value: +mkFit.slope.toFixed(2), status: 'computed from measured (narrow length range 0.257-0.340 m; not a test of the law)', source: SRC.mk },
  finLen: { name: 'pectoral fin length / standard length', value: finRatio.pectoral_over_SL_median, status: 'measured (median of 49 preserved specimens; length only)', source: SRC.fin },
  mu: { name: 'mutation rate per site per generation', value: `${e2(BP.mutationRatePerSitePerGeneration.low)} to ${e2(BP.mutationRatePerSitePerGeneration.high)}`, status: 'proxy (herring and stickleback pedigrees; no Exocoetidae estimate)', source: SRC.bound },
  T: { name: 'generations since the oldest fossil', value: `${e2(BR.generations.low)} to ${e2(BR.generations.high)}`, status: 'computed: PBDB first appearance (measured, two records from one paper) over a FishBase generation time for one species (proxy)', source: SRC.bound },
  M: { name: 'gene copies M = 2N', value: `${e2(Mproxy)} (from Ne > 1e9)`, status: 'proxy (E. volitans mitochondrial Ne, Lewallen 2016; the only Ne for the family)', source: SRC.bound },
  budget: { name: 'neutral substitution budget per site', value: `${f3(BR.neutralPerSite.low)} to ${f3(BR.neutralPerSite.high)}`, status: 'computed from the above', source: SRC.bound },
  cert: { name: 'blueprint certificate', value: `${CERT.graph.distinctTerms} terms, ${CERT.graph.distinctEdges} edges, ${CERT.taxonData.rows.neverIn} never_in_taxon and ${CERT.taxonData.rows.inTaxon} in_taxon rows`, status: 'ontology-derived (Uberon, Cell Ontology via Ubergraph), not a measurement', source: SRC.cert },
  LD: { name: 'L/D max for specimen L3', value: +L3.LD_max, status: 'measured (wind tunnel, one specimen)', source: SRC.glide },
  lw: { name: 'FishBase length-weight exponents b, fitted field studies', value: lwText, status: `measured (${lwFitted.length} fitted studies with locality and n; ${lwUnverified} further rows with b = 3.000 and n ≤ 6 are unverified FishBase estimates and are not used)`, source: 'physics/length-weight.csv (FishBase Length-Weight list page; references not shown on the page)' },
  glideField: { name: 'field glide distances', value: glideField.join(' and ') + ' m', status: 'secondary (field summaries)', source: SRC.glide },
  heightMax: { name: 'maximum recorded flight height', value: heightMax, unit: 'm', status: 'secondary (Deng 2019 citing its ref 6)', source: SRC.glide },
  LDtheory: { name: 'theoretical (L/D)max, Cheilopogon heterurus', value: LDtheory, status: 'theory-secondary (Kawachi et al. 1993 via Deng 2019)', source: SRC.glide },
  ge: { name: 'largest measured ground-effect drag reduction', value: geMax, status: 'measured (Park and Choi 2010, model L3 over water at h/b = 0.33; lift unaffected)', source: 'physics/ground-effect.json' },
  chain: { name: 'physiology chain proxies for a 0.06 kg fish: Q, Ca, η, E_O2', value: `Q ${chainQ.toFixed(5)} ml/s (cardiac.js state(1), snapper), Ca ${chainCa.toFixed(4)} ml/ml (haemoglobin.js at 15.8 kPa, trout curve, tuned warm capacity), η ${chainEta} (muscle.js, salmon ventricle), E ${chainE.toFixed(2)} J/ml (gerry2014)`, status: 'proxy (no Exocoetidae physiology exists; every value is from another teleost or tuned)', source: 'physiology/ at commit a1ca4f00, via lean/eliminate/physiology-candidates.json' },
  ceiling: { name: 'aerobic mechanical ceiling η E Q Ca for the 0.06 kg fish', value: +aerobicCeiling.toFixed(4), unit: 'W', status: 'computed from the chain proxies (sustained_le)', source: 'lean/eliminate/ledger.physiology.json' },
  preqField: { name: 'power for level flight at 10 m/s with (L/D)max 4.37', value: +preqField.toFixed(3), unit: 'W', status: 'computed from measured W and L/D (the most generous, lowest, value)', source: SRC.glide }
};
const missing = (name, note) => ({ name, status: 'missing', note });

// ---- judgements, one per theorem (keyed by the compiler's name) ----
const NEUTRAL = 'yes-under-named-hypotheses: strict neutrality, constant M, Wright-Fisher reproduction, independent mutant fates; Exocoetidae are diploid sexual teleosts, so the model is of the right kind, but none of its quantities is measured for the family';
const popgenInputs = [F.M, F.mu, missing('a measured neutral substitution rate or fixation probability for any Exocoetidae locus', 'no molecular-rate study of flying fish was found')];
const JUDGE = {
  // Kimura
  'Delphi.NeutralChain.fixedBy_sub_le': { applies: NEUTRAL, inputs: [F.M], verdict: 'cannot-evaluate', why: 'the geometric error bound needs the chain (M and the kernel); with the proxy M ≈ 2e9 the bound is a statement about the model, and nothing measured on flying fish is a fixation probability at finite time' },
  'Delphi.NeutralChain.fixedBy_tendsto': { applies: NEUTRAL, inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'instantiated with the proxy M the theorem gives u = 1/M ≈ 5e-10 for one new neutral copy; no measured fixation probability exists to compare' },
  'Delphi.NeutralChain.fixationProbability_eq': { applies: NEUTRAL, inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'as fixedBy_tendsto' },
  'Delphi.wrightFisher_fixation_one': { applies: NEUTRAL, inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'u = 1/M ≈ 5e-10 with the proxy M; unmeasured' },
  'Delphi.neutral_substitution_rate': { applies: NEUTRAL, inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'k = μ needs a measured neutral substitution rate k for Exocoetidae; μ itself is a proxy from other teleosts (missing: k)' },
  'Delphi.neutral_substitution_rate_diploid': { applies: NEUTRAL, inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'as neutral_substitution_rate; the diploid form is the one that applies to a teleost' },
  'Delphi.neutral_substitution_rate_tendsto': { applies: NEUTRAL, inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'as neutral_substitution_rate' },
  // Favored
  'Delphi.FavoredChain.fixedBy_tendsto': { applies: 'yes-under-named-hypotheses: selection not opposing the mutant (s ≥ 0), constant M', inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'no measured fixation probability' },
  'Delphi.FavoredChain.fixationProbability_ge': { applies: 'yes-under-named-hypotheses: s ≥ 0', inputs: popgenInputs, verdict: 'cannot-evaluate', why: 'the floor 1/M ≈ 5e-10 with the proxy M; no measured fixation probability' },
  'Delphi.FavoredChain.fixationProbability_le_one': { applies: 'yes (a probability is at most 1)', inputs: [], verdict: 'holds', why: 'trivially; carries no information about the fish' },
  'Delphi.wrightFisherSelection_fixation_one_ge': { applies: 'yes-under-named-hypotheses: Wright-Fisher with relative fitness 1+s, s ≥ 0', inputs: popgenInputs.concat([missing('selection coefficient s of any flying-fish mutation', 'undefined')]), verdict: 'cannot-evaluate', why: 'no s and no fixation probability measured' },
  'Delphi.wrightFisher_toFavored_fixedBy': { applies: 'yes (definitional: the neutral chain viewed as a favored chain)', inputs: [], verdict: 'holds', why: 'bookkeeping identity; no empirical content' },
  'Delphi.neutral_expectedSubstitutions': { applies: NEUTRAL, inputs: [F.mu, F.T, F.budget], verdict: 'cannot-evaluate', why: `instantiated in lean/bound: μT = ${f3(BR.neutralPerSite.low)} to ${f3(BR.neutralPerSite.high)} substitutions per site over the family's duration, independent of M; this is a computation from proxies, and no measured genome-wide neutral divergence for Exocoetidae exists to compare (missing: measured divergence)` },
  'Delphi.favored_expectedSubstitutions_ge': { applies: 'yes-under-named-hypotheses: s ≥ 0 and independent fates', inputs: [F.mu, F.T, missing('the rate of mutations selection does not oppose', 'undefined')], verdict: 'cannot-evaluate', why: 'the floor is μ_f T with μ_f undefined' },
  'Delphi.expectedSubstitutions_le': { applies: 'yes-under-named-hypotheses: independent fates', inputs: [F.mu, F.T, F.M], verdict: 'cannot-evaluate', why: `the ceiling 2N μ T is vacuous with N ≈ 1e9 (${e2(2 * 1e9 * BP.mutationRatePerSitePerGeneration.high * BR.generations.high)} per site); nothing measured to compare` },
  'Delphi.wrightFisherSelection_substitutions_bounds': { applies: 'yes-under-named-hypotheses', inputs: [F.mu, F.T, F.M], verdict: 'cannot-evaluate', why: 'the two bounds above together; the quantity bounded (expected adaptive substitutions) is not measured and the requirement for a wing is undefined' },
  // Fisher
  'Delphi.select_isFreq': { applies: 'yes (bookkeeping: selection maps a frequency vector to a frequency vector)', inputs: [], verdict: 'holds', why: 'no empirical content' },
  'Delphi.fisher_fundamental_theorem': { applies: 'yes-under-named-hypotheses: one haploid or clonal locus, fixed fitnesses, infinite population; Exocoetidae are diploid, so the formalised (haploid) form is narrower than the biology (faithfulness: narrower scope)', inputs: [missing('variance in fitness at any Exocoetidae locus', 'no fitness measurements for flying fish were found'), missing('mean fitness', 'as above')], verdict: 'cannot-evaluate', why: 'no fitness variance or mean fitness measured' },
  "Delphi.fisher_fundamental_theorem'": { applies: 'as fisher_fundamental_theorem', inputs: [missing('variance in fitness', ''), missing('mean fitness', '')], verdict: 'cannot-evaluate', why: 'as above' },
  'Delphi.mean_fitness_nondecreasing': { applies: 'as fisher_fundamental_theorem', inputs: [missing('mean fitness in two consecutive generations under fixed fitnesses', '')], verdict: 'cannot-evaluate', why: 'no time series of mean fitness' },
  // Maynard Smith
  'Delphi.twofold_cost_of_sex': { applies: 'no: the theorem compares an asexual lineage with sexual females at equal fecundity; no asexual lineage of Exocoetidae is recorded in any source this project fetched, so the premise has no instance in the family', inputs: [missing('fraction of asexual females', 'no asexual Exocoetidae known to the project')], verdict: 'cannot-evaluate', why: 'premise absent; the theorem says nothing about an all-sexual family' },
  'Delphi.asexualNext_mem': { applies: 'no (as twofold_cost_of_sex; bookkeeping lemma)', inputs: [], verdict: 'cannot-evaluate', why: 'premise absent' },
  'Delphi.asexualAfter_mem': { applies: 'no (as twofold_cost_of_sex; bookkeeping lemma)', inputs: [], verdict: 'cannot-evaluate', why: 'premise absent' },
  'Delphi.twofold_cost_of_sex_n': { applies: 'no (as twofold_cost_of_sex)', inputs: [missing('fraction of asexual females over n generations', '')], verdict: 'cannot-evaluate', why: 'premise absent' },
  // Thompson
  'Delphi.cubeLaw_ratio': { applies: 'yes-under-named-hypotheses: isometric growth at constant density (the family scaled without change of shape)', inputs: [F.bMass, F.mkFit], verdict: 'holds', qualifier: `approximately: Davenport 1992 measured mass ∝ SL^${bMass.exponent} within Exocoetus obtusirostris, within 0.02 of the exact 3; the abstract gives no CI, so exactness is untested. The 13 Makiguchi fish give an OLS slope of ${mkFit.slope.toFixed(2)} over a length range too narrow to test anything`, why: 'mass grows almost exactly as the cube of standard length in the one species measured' },
  'Delphi.cubeLaw_loglog_exponent': { applies: 'as cubeLaw_ratio', inputs: [F.bMass], verdict: 'holds', qualifier: `approximately (${bMass.exponent} vs 3, no CI)`, why: 'as cubeLaw_ratio' },
  'Delphi.not_cubeLaw_of_exponent_ne_three': { applies: 'yes: the contrapositive, which the data can fire', inputs: [F.bMass], verdict: 'cannot-evaluate', qualifier: `taken literally ${bMass.exponent} ≠ 3 refutes the EXACT cube law for E. obtusirostris; without a CI the departure of 0.019 cannot be distinguished from estimation error, so the exact law is neither confirmed nor refuted`, why: 'no confidence interval in the abstract' },
  // Flight: allometry
  'Delphi.powerLaw_ratio': { applies: 'yes-under-named-hypotheses: a fitted power law W = a L^b over the size range', inputs: [F.lw, F.bMass], verdict: 'holds', qualifier: `the fitted form is the hypothesis; the seven FishBase field studies give b from 2.908 to 3.011 for five species (n 570 to 2769) and 2.208 for Hirundichthys affinis males (n 117), Davenport 2.981 for E. obtusirostris`, why: 'length-weight regressions are power laws by construction; the theorem then gives the ratio between sizes' },
  'Delphi.powerLaw_log': { applies: 'as powerLaw_ratio', inputs: [F.lw], verdict: 'holds', qualifier: 'the log-log slope IS the fitted b', why: 'as powerLaw_ratio' },
  'Delphi.powerLaw_div': { applies: 'yes-under-named-hypotheses: power laws for both weight and fin area over the same range', inputs: [F.bMass, F.bArea, F.bWS], verdict: 'cannot-evaluate', qualifier: `predicts the wing-loading exponent bW − bS = ${(bMass.exponent - bArea.exponent).toFixed(3)} from Davenport's mass and fin-area fits; Davenport's directly fitted wing-loading exponent is ${bWS.exponent}; the three are separate regressions with no confidence intervals in the abstract, so whether the 0.09 gap is estimation error cannot be decided (missing: CIs)`, why: 'no confidence intervals' },
  'Delphi.cubeLaw_powerLaw': { applies: 'yes (the cube law is the case b = 3)', inputs: [F.lw], verdict: 'holds', qualifier: 'bookkeeping; six of seven fitted Exocoetidae studies have b within 0.1 of 3, H. affinis males 2.208', why: 'identity of forms' },
  'Delphi.vmin_powerLaw_log': { applies: 'yes-under-named-hypotheses: power laws for weight and lifting area, constant ρ and C_L,max', inputs: [F.bMass, F.bArea, missing('v_min at two body sizes', '')], verdict: 'cannot-evaluate', qualifier: `predicts a v_min exponent of (${bMass.exponent} − ${bArea.exponent})/2 = ${((bMass.exponent - bArea.exponent) / 2).toFixed(3)} for E. obtusirostris instead of the isometric 0.5, i.e. larger individuals must fly relatively faster; no multi-size v_min data to test it`, why: 'no multi-size v_min' },
  // Flight: climb and glide
  'Delphi.climbRate_le': { applies: 'yes-under-named-hypotheses for a POWERED flyer (power balance); a gliding fish has no P_avail in the air, so for the real fish this concerns the launch and taxiing phase at most', inputs: [missing('P_avail (muscle power during taxiing) and P_req', '')], verdict: 'cannot-evaluate', why: 'no power data' },
  'Delphi.climb_nonneg_iff': { applies: 'as climbRate_le', inputs: [], verdict: 'cannot-evaluate', why: 'as climbRate_le' },
  'Delphi.glide_range_le': { applies: 'yes-under-named-hypotheses: one steady unpowered glide, lift equal to weight, L/D ≤ (L/D)max', inputs: [F.heightMax, F.LD, F.glideField, F.LDtheory], verdict: 'violated', qualifier: `the single-glide model's hypotheses fail for the field figures: from ${heightMax} m with the stuffed-model (L/D)max ${L3.LD_max} the bound is ${glideBound(+L3.LD_max, 0).toFixed(1)} m, below the ${glideField.join(' and ')} m reported; with the theoretical (L/D)max ${LDtheory} it is ${glideBound(LDtheory, 0).toFixed(0)} m, which covers 50 m but not 400 m. The theorem is untouched; what fails is the reading that a field flight is one unpowered glide (taxiing thrust from the tail, repeated touch-and-go and wind are outside the model)`, why: 'the pure-glide reading of the field distances is ruled out with the measured L/D' },
  'Delphi.glide_range_le_groundEffect': { applies: 'as glide_range_le, with the measured drag reduction', inputs: [F.heightMax, F.LD, F.ge, F.glideField], verdict: 'violated', qualifier: `with δ = ${geMax} the bound rises only to ${glideBound(+L3.LD_max, geMax).toFixed(1)} m, still below 50 m: ground effect alone does not close the gap with the measured L/D`, why: 'as glide_range_le' },
  // Flight: aerobic
  'Delphi.aerobic_le_Ca': { applies: 'yes-under-named-hypotheses: Fick, oxycaloric conversion, aerobic power', inputs: [missing('cardiac output Q, arterial O2 content Ca, oxycaloric equivalent E and efficiency η for Exocoetidae', 'the physics thread\'s simulator is to source these')], verdict: 'cannot-evaluate', why: 'no physiological inputs for the family' },
  'Delphi.aerobic_le_metabolic': { applies: 'as aerobic_le_Ca', inputs: [missing('Q, Ca, E, η', '')], verdict: 'cannot-evaluate', why: 'as above' },
  'Delphi.sustained_le': { applies: 'as aerobic_le_Ca', inputs: [missing('Q, Ca, E, η', '')], verdict: 'cannot-evaluate', why: 'as above' },
  'Delphi.sustained_flight_requires': { applies: 'yes-under-named-hypotheses: sustained POWERED flight with an aerobic supply (Fick); instantiated with the physiology chain\'s proxies for a 0.06 kg fish', inputs: [F.chain, F.ceiling, F.preqField, F.LD, F.vmin], verdict: 'violated', qualifier: `with the chain\'s proxies the aerobic ceiling η E Q Ca is ${aerobicCeiling.toFixed(4)} W against ${preqField.toFixed(3)} W for level flight at 10 m/s (${(W * vmin / +L3.LD_max).toFixed(3)} W at v_min), a shortfall of ${(preqField / aerobicCeiling).toFixed(0)}x even at the most generous L/D: sustained aerobic flight is ruled out for the real fish under those proxies (kernel-accepted certificate in lean/Delphi/Certificates/EliminationsPhysiology.lean). The hypotheses that could be wrong are the proxies: Q and Ca from snapper and trout, η from salmon heart muscle. What the fish does instead is glide, and burst-power on white-muscle stores, which the theorem does not bound`, why: 'instantiated with proxies; violated by a large factor' },
  'Delphi.climb_le_aerobic': { applies: 'as sustained_flight_requires', inputs: [missing('Q, Ca, E, η', '')], verdict: 'cannot-evaluate', why: 'as above' },
  'Delphi.powerLaw_crossover': { applies: 'yes-under-named-hypotheses: demand and supply as power laws in size; with R5 the demand exponent is 7/2', inputs: [missing('the supply exponent (how Q Ca scales with size in Exocoetidae)', 'physiology not sourced')], verdict: 'cannot-evaluate', qualifier: 'replaces the muscle premise: any supply exponent below 7/2 gives a size limit; whether 0.5 m flying fish are below it needs the constants', why: 'supply exponent missing' },
  // Scaling: area and wing loading
  'Delphi.areaLaw_ratio': { applies: 'yes-under-named-hypotheses: isometry of the lifting area', inputs: [F.bArea], verdict: 'violated', qualifier: `the HYPOTHESIS (fin-area isometry) fails within E. obtusirostris: measured exponent ${bArea.exponent} vs 2 (fins grow relatively smaller); the theorem itself is a conditional and is untouched`, why: 'Davenport 1992' },
  'Delphi.areaLaw_log': { applies: 'as areaLaw_ratio', inputs: [F.bArea], verdict: 'violated', qualifier: `${bArea.exponent} vs 2`, why: 'as areaLaw_ratio' },
  'Delphi.wingLoading_ratio': { applies: 'yes-under-named-hypotheses: R1 and R2', inputs: [F.bWS, F.bMass, F.bArea], verdict: 'violated', qualifier: `the hypotheses fail within E. obtusirostris: measured wing loading ∝ SL^${bWS.exponent} vs the isometric 1 (positive allometry); note the three abstract exponents are not mutually exact (${bMass.exponent} - ${bArea.exponent} = ${(bMass.exponent - bArea.exponent).toFixed(3)} vs ${bWS.exponent}), as separate fits`, why: 'Davenport 1992' },
  'Delphi.wingLoading_log': { applies: 'as wingLoading_ratio', inputs: [F.bWS], verdict: 'violated', qualifier: `${bWS.exponent} vs 1`, why: 'as wingLoading_ratio' },
  // Scaling: strength
  'Delphi.breakLoad_ratio': { applies: 'yes-under-named-hypotheses: isometric load-bearing sections (fin rays, girdle, vertebrae) and one material', inputs: [missing('breaking stress σ of fin-ray or bone material in Exocoetidae', 'not found'), missing('load-bearing cross-sections at two sizes', 'not found')], verdict: 'cannot-evaluate', why: 'no material or section data' },
  'Delphi.safetyFactor_eq': { applies: 'as breakLoad_ratio, with R1', inputs: [missing('σ, k₃ (section constant)', ''), F.bMass], verdict: 'cannot-evaluate', why: 'σ and the section constant missing' },
  'Delphi.stress_ratio': { applies: 'as breakLoad_ratio', inputs: [missing('cross-section of a load-bearing member at two sizes', '')], verdict: 'cannot-evaluate', why: 'no section data; the wing-loading form of the same lemma is evaluated under wingLoading_ratio' },
  'Delphi.safetyFactor_scaled': { applies: 'as breakLoad_ratio', inputs: [missing('reference safety factor of any flying-fish member', '')], verdict: 'cannot-evaluate', why: 'no safety factor measured' },
  'Delphi.cannot_carry': { applies: 'as breakLoad_ratio', inputs: [missing('σ, k₁, k₃', '')], verdict: 'cannot-evaluate', why: 'the size limit L_max needs σ and the shape constants; adult Exocoetidae reach 0.15-0.50 m (Davenport 1994 review) but no σ places that against a limit' },
  // Scaling: minimum speed
  'Delphi.vmin_le': { applies: 'yes: exact, no isometry; steady lift-supported flight with C_L ≤ C_L,max', inputs: [F.vmin, F.fieldSpeed, { name: 'C_L,max', value: CLmax, status: 'measured (wind tunnel, stuffed specimen, 35° attack)', source: SRC.glide }, { name: 'air density ρ', value: rho, status: 'assumed (sea level, not measured)', source: 'lean thread assumption' }], verdict: 'holds', qualifier: `v_min = ${vmin.toFixed(2)} m/s for specimen L3 is below the quoted field airspeeds ${field.airspeed_m_s} m/s, so the fish is inside its own envelope (the physics thread's interpretation B); caveat: W, S, C_L,max from 0.04-0.06 kg stuffed specimens of one species, field speeds a family-level secondary figure`, why: 'measured specimen against field speeds' },
  'Delphi.vmin_ratio': { applies: 'yes-under-named-hypotheses: R1, R2, constant ρ and C_L,max', inputs: [missing('v_min (or W, S, C_L,max) at two body sizes of one species', 'Park and Choi give one size class; Davenport gives exponents but no C_L,max'), F.bWS], verdict: 'cannot-evaluate', qualifier: `with Davenport's wing loading ∝ SL^${bWS.exponent} the hypotheses R1-R2 already fail, and the physics thread's v ∝ (W/S)^½ test was underpowered`, why: 'no multi-size v_min' },
  'Delphi.vmin_log': { applies: 'as vmin_ratio', inputs: [missing('v_min at two sizes', '')], verdict: 'cannot-evaluate', why: 'as vmin_ratio' },
  // Scaling: power
  'Delphi.powerRequired_ratio': { applies: 'yes-under-named-hypotheses: R1, R2, constant ρ, C_L,max and L/D, flight at v_min', inputs: [F.LD, missing('L/D at a second size', '')], verdict: 'cannot-evaluate', why: 'L/D measured for one specimen only (4.37); the scaling needs two sizes' },
  'Delphi.powerRequired_log': { applies: 'as powerRequired_ratio', inputs: [F.LD], verdict: 'cannot-evaluate', why: 'as powerRequired_ratio' },
  'Delphi.powerAvailable_ratio': { applies: 'yes-under-named-hypotheses: Thompson\'s muscle premise (MusclePowerLaw), contested; and a gliding fish does not fly under muscle power in the air, so the premise applies to the taxiing and launch phase if at all', inputs: [missing('muscle mass fraction f and mass-specific power p for Exocoetidae', 'the physics thread could not source either')], verdict: 'cannot-evaluate', why: 'f and p missing' },
  'Delphi.powerRatio_eq': { applies: 'as powerAvailable_ratio', inputs: [missing('f, p, L/D, ρ, C_L,max together', '')], verdict: 'cannot-evaluate', why: 'the constant c needs f and p' },
  'Delphi.exists_size_limit': { applies: 'as powerAvailable_ratio', inputs: [missing('f and p', '')], verdict: 'cannot-evaluate', why: 'the size exists in the model; whether a 0.5 m flying fish is above or below it needs f, p and the aerodynamic constants (missing: f, p)' },
  // Scaling: bending
  'Delphi.bendingStress_ratio_body': { applies: 'yes-under-named-hypotheses: fin rays and the vertebral column as slender linear-elastic beams with similar sections; for a fin under aerodynamic load the load is sheet-like (∝ area at fixed speed and C_L), so R9b rather than R9a is the natural reading for the pectoral fin', inputs: [missing('section modulus of fin rays at two sizes', ''), missing('the load family (body-like or sheet-like) for the member in question', 'an empirical fork')], verdict: 'cannot-evaluate', why: 'no section or load data' },
  'Delphi.bendingStress_log_body': { applies: 'as bendingStress_ratio_body', inputs: [missing('bending stress at two sizes', '')], verdict: 'cannot-evaluate', why: 'as above' },
  'Delphi.bendingSafety_eq': { applies: 'as bendingStress_ratio_body', inputs: [missing('σ_max of fin-ray material', '')], verdict: 'cannot-evaluate', why: 'σ_max missing' },
  'Delphi.bending_cannot_carry': { applies: 'as bendingStress_ratio_body', inputs: [missing('σ_max, k_F, k_ℓ, k_Z', '')], verdict: 'cannot-evaluate', why: 'constants missing' },
  'Delphi.bendingStress_ratio_sheet': { applies: 'yes-under-named-hypotheses: a sheet-like load (aerodynamic load on a fin ∝ fin area at fixed speed and C_L) with similar ray sections; no size limit follows', inputs: [missing('fin-ray section modulus at two sizes', ''), F.bArea], verdict: 'cannot-evaluate', qualifier: `note that with fin area ∝ SL^${bArea.exponent} (not 2) and unknown ray sections the hypotheses are not met as stated`, why: 'no section data' },
  'Delphi.bendingStress_log_sheet': { applies: 'as bendingStress_ratio_sheet', inputs: [], verdict: 'cannot-evaluate', why: 'as above' },
  // Scaling: Froude
  'Delphi.froude_ratio': { applies: 'yes-under-named-hypotheses for the swimming and taxiing phase only (equal Froude number); not for the glide', inputs: [{ name: 'launch speed', value: '3.87 to 5.15 m/s (estimated), 13 fish of one size class', status: 'estimated, one size', source: SRC.mk }, missing('speed at a second body size at equal Froude number', '')], verdict: 'cannot-evaluate', why: 'one size class' },
  // Blueprint
  'Delphi.Blueprint.Graph.transGen_trans': { applies: 'yes: to the emitted blueprint graph of Exocoetidae (536 ontology terms), as structure', inputs: [F.cert], verdict: 'holds', why: 'generic theorem instantiated by the certificate; structural, not biological' },
  'Delphi.Blueprint.Graph.partOfStar_of_edge': { applies: 'yes (structural)', inputs: [F.cert], verdict: 'holds', why: 'as transGen_trans' },
  'Delphi.Blueprint.Graph.transGen_level_lt': { applies: 'yes (structural)', inputs: [F.cert], verdict: 'holds', why: 'every edge of the emitted graph goes strictly down in level (checked by the kernel)' },
  'Delphi.Blueprint.Graph.acyclic_of_levelsDown': { applies: 'yes (structural)', inputs: [F.cert], verdict: 'holds', why: 'no term of the flying-fish blueprint is transitively part of itself (aFlyingFish_wellFormed)' },
  'Delphi.Blueprint.Graph.rooted_of': { applies: 'yes (structural)', inputs: [F.cert], verdict: 'holds', why: 'every term reaches the body root (aFlyingFish_wellFormed)' },
  'Delphi.Blueprint.Graph.levelsDown_of_check': { applies: 'yes (checker soundness)', inputs: [F.cert], verdict: 'holds', why: 'the checker accepted the data' },
  'Delphi.Blueprint.Graph.closed_of_check': { applies: 'yes (checker soundness)', inputs: [F.cert], verdict: 'holds', why: 'as above' },
  'Delphi.Blueprint.Graph.hasParent_of_check': { applies: 'yes (checker soundness)', inputs: [F.cert], verdict: 'holds', why: 'as above' },
  'Delphi.Blueprint.Graph.rooted_of_check': { applies: 'yes (checker soundness)', inputs: [F.cert], verdict: 'holds', why: 'as above' },
  'Delphi.Blueprint.TaxonData.ok_of_check': { applies: 'yes: the pinned never_in_taxon and in_taxon statements for the 536 terms against the 32 taxa containing Exocoetidae', inputs: [F.cert], verdict: 'holds', why: 'no kept term is excluded from Exocoetidae by Uberon or the Cell Ontology as served by Ubergraph; this is the one place a theorem touches the family\'s taxonomy, and it rests on the ontologies being right' },
  'Delphi.Blueprint.wellFormed_of_check': { applies: 'yes (structural)', inputs: [F.cert], verdict: 'holds', why: 'aFlyingFish_wellFormed; says the emitted anatomy is coherent under its rules, not that it is correct or complete' }
};
// Constraints: elimination lemmas, judged as filters; the few that a measured flying-fish commitment reaches get a verdict.
const CONSTR = {
  'Delphi.Constraints.ne_of_lt_intervals': ['helper', 'yes (arithmetic)', [], 'holds', 'no empirical content'],
  'Delphi.Constraints.kimura_rate_rules_out': ['filter', NEUTRAL, popgenInputs, 'cannot-evaluate', 'no measured (k, μ) pair for the family'],
  'Delphi.Constraints.kimura_rate_ratio_rules_out': ['filter', NEUTRAL, [missing('substitution rates of two Exocoetidae lineages with equal mutation rate', '')], 'cannot-evaluate', 'no lineage comparison'],
  'Delphi.Constraints.neutral_fixation_rules_out': ['filter', NEUTRAL, popgenInputs, 'cannot-evaluate', 'no committed probability'],
  'Delphi.Constraints.favored_fixation_rules_out': ['filter', 'yes-under-named-hypotheses (s ≥ 0)', popgenInputs, 'cannot-evaluate', 'no committed probability'],
  'Delphi.Constraints.supply_rules_out': ['filter', 'yes-under-named-hypotheses (independent fates)', [F.mu, F.T, F.M], 'cannot-evaluate', 'no committed expected count for a wing (undefined)'],
  "Delphi.Constraints.supply_rules_out'": ['filter', 'as supply_rules_out', [F.mu, F.T, F.M], 'cannot-evaluate', 'as above'],
  'Delphi.Constraints.fisher_rules_out': ['filter', 'yes-under-named-hypotheses (one locus, fixed fitnesses)', [missing('Δ, w̄, V for any locus', '')], 'cannot-evaluate', 'no fitness data'],
  'Delphi.Constraints.fisher_decline_rules_out': ['filter', 'as fisher_rules_out', [missing('Δ', '')], 'cannot-evaluate', 'no fitness data'],
  'Delphi.Constraints.fisher_zero_variance_rules_out': ['filter', 'as fisher_rules_out', [missing('V, Δ', '')], 'cannot-evaluate', 'no fitness data'],
  'Delphi.Constraints.twofold_factor_rules_out': ['filter', 'no (no asexual Exocoetidae known to the project)', [], 'cannot-evaluate', 'premise absent'],
  'Delphi.Constraints.twofold_rules_out': ['filter', 'no (as above)', [], 'cannot-evaluate', 'premise absent'],
  'Delphi.Constraints.cubeLaw_rules_out': ['filter', 'yes-under-named-hypotheses (isometry, constant density)', [F.bMass], 'cannot-evaluate', 'needs point ratios; the measured exponent is handled by exponent_rules_out'],
  "Delphi.Constraints.cubeLaw_rules_out'": ['filter', 'as cubeLaw_rules_out', [F.bMass], 'cannot-evaluate', 'as above'],
  'Delphi.Constraints.exponent_rules_out': ['filter', 'yes: a candidate "isometric E. obtusirostris at constant density" committing the measured exponent', [F.bMass], 'cannot-evaluate', `the lemma fires only on an interval excluding 3; the abstract gives the point ${bMass.exponent} with no CI, so no honest interval can be committed (missing: CI)`],
  'Delphi.Constraints.axial_strength_rules_out': ['filter', 'yes (dimensional)', [missing('σ, A, W, n for any member', '')], 'cannot-evaluate', 'no material or section data'],
  'Delphi.Constraints.strength_ratio_rules_out': ['filter', 'yes-under-named-hypotheses', [missing('breaking-load ratio', '')], 'cannot-evaluate', 'no data'],
  'Delphi.Constraints.giant_rules_out': ['filter', 'yes-under-named-hypotheses', [missing('reference safety factor', '')], 'cannot-evaluate', 'no safety factor measured; a scaled-up flying fish cannot be ruled on without it'],
  'Delphi.Constraints.stress_ratio_rules_out': ['filter', 'yes-under-named-hypotheses', [missing('stress ratio at two sizes', '')], 'cannot-evaluate', 'no data'],
  'Delphi.Constraints.area_ratio_rules_out': ['filter', 'yes-under-named-hypotheses', [missing('fin-area ratio at two sizes (Davenport gives an exponent, not a pair)', '')], 'cannot-evaluate', 'point ratios not available'],
  'Delphi.Constraints.area_exponent_rules_out': ['filter', 'yes: a candidate asserting fin-area isometry for E. obtusirostris', [F.bArea], 'violated', `fires if the measured ${bArea.exponent} is committed as an interval excluding 2: fin-area isometry is eliminated for E. obtusirostris, as Davenport's own abstract says; without a CI the interval is the candidate's commitment, not a measurement`],
  'Delphi.Constraints.stress_exponent_rules_out': ['filter', 'yes: a candidate asserting isometric wing loading (W/S ∝ L)', [F.bWS], 'violated', `fires if the measured ${bWS.exponent} is committed as an interval excluding 1: isometric wing loading is eliminated for E. obtusirostris (positive allometry); CI caveat as above`],
  'Delphi.Constraints.vmin_exponent_rules_out': ['filter', 'yes-under-named-hypotheses', [missing('v_min exponent across sizes', '')], 'cannot-evaluate', 'no multi-size v_min'],
  'Delphi.Constraints.vmin_rules_out': ['filter', 'yes (exact, dimensional): a claim of lift-supported flight at a stated speed', [F.vmin, F.fieldSpeed], 'holds', `the measured specimen L3 at the field speeds (10-20 m/s) is NOT ruled out (v ≥ v_min = ${vmin.toFixed(2)}); the illustrative claim of 5 m/s is ruled out (lean/eliminate/examples.json)`],
  'Delphi.Constraints.vmin_scaling_rules_out': ['filter', 'yes-under-named-hypotheses', [missing('v_min ratio across sizes', '')], 'cannot-evaluate', 'no multi-size v_min'],
  'Delphi.Constraints.powerRequired_exponent_rules_out': ['filter', 'yes-under-named-hypotheses', [missing('P_req exponent', '')], 'cannot-evaluate', 'no power data'],
  'Delphi.Constraints.bending_exponent_rules_out': ['filter', 'yes-under-named-hypotheses (R9a)', [missing('bending-stress exponent of fin rays', '')], 'cannot-evaluate', 'no data'],
  'Delphi.Constraints.bending_ratio_rules_out': ['filter', 'yes-under-named-hypotheses (R9a)', [missing('bending-stress ratio', '')], 'cannot-evaluate', 'no data'],
  'Delphi.Constraints.bending_exponent_sheet_rules_out': ['filter', 'yes-under-named-hypotheses (R9b, the natural reading for a fin under aerodynamic load)', [missing('bending-stress exponent of fin rays', '')], 'cannot-evaluate', 'no data'],
  'Delphi.Constraints.froude_rules_out': ['filter', 'yes-under-named-hypotheses (swimming phase)', [missing('speed ratio at two sizes', '')], 'cannot-evaluate', 'one size class'],
  'Delphi.Constraints.allometry_consistency_rules_out': ['filter', 'yes: a candidate committing the three Davenport exponents', [F.bMass, F.bArea, F.bWS], 'cannot-evaluate', `as points the triple (${bMass.exponent}, ${bArea.exponent}, ${bWS.exponent}) is inconsistent by ${(bWS.exponent - (bMass.exponent - bArea.exponent)).toFixed(3)}, but the three are separate fits without confidence intervals, so no honest interval commitment exists and the lemma must not be fired on points (missing: CIs)`],
  'Delphi.Constraints.aerobic_flight_rules_out': ['filter', 'yes-under-named-hypotheses (Fick, aerobic), instantiated with the physiology chain\'s proxies', [F.chain, F.ceiling, F.preqField], 'violated', `fires: ${aerobicCeiling.toFixed(4)} W < ${preqField.toFixed(3)} W for the real fish at 10 m/s and for the hypothetical flier at 7 m/s (lean/eliminate/ledger.physiology.json); the proxies, not the fish, are what the elimination rests on`],
  'Delphi.Constraints.glide_range_rules_out': ['filter', 'yes: the pure-glide reading of the field distances', [F.heightMax, F.LD, F.glideField, F.ge], 'violated', `fires: one unpowered glide of 50 m from ${heightMax} m needs (L/D)max ≥ ${(50 / heightMax).toFixed(2)} (or ${(50 / heightMax * (1 - geMax)).toFixed(2)} with the measured ground effect); the stuffed-model 4.37 fails, the theoretical 15.7 passes (lean/eliminate/examples.json)`],
  'Delphi.Constraints.climb_rules_out': ['filter', 'yes-under-named-hypotheses (powered flight)', [missing('P_avail, P_req, climb rate', '')], 'cannot-evaluate', 'no powered-flight data for a glider']
};
for (const [k, [kind, applies, inputs, verdict, why]] of Object.entries(CONSTR)) JUDGE[k] = { applies, inputs, verdict, why, kind };

// ---- NEW_MODULE_JUDGEMENTS: genotype, physiology, the empirical layer, altitude ----
// Written against the real flying fish, as every other row is: "holds" only where measured or recorded
// values satisfy the statement, "violated" where they contradict it, "cannot-evaluate" where an input the
// statement needs is not measured for Exocoetidae. Zebrafish records are NOT flying-fish measurements, so
// rows that rest on them say so.
const noFish = what => missing(what + ' for Exocoetidae', 'undefined');
const GENOTYPE = {
  'Delphi.Genotype.minSubst_le': ['law', 'yes (the standard code applies to any teleost)', [], 'holds', 'the code distance bounds the Hamming distance of any codon pair; the project records one flying-fish amino-acid change, slc43a2a F326L (Daane 2021), and the code allows it in one substitution'],
  'Delphi.Genotype.claimed_substitutions_rules_out': ['filter', 'yes: a claim about a flying-fish substitution', [], 'holds', 'applied to F326L (Phe to Leu, minSubst 1) the claim of one substitution is NOT ruled out; the controls (the same change in zero, and Met to Trp in one) are'],
  'Delphi.Genotype.phe_leu_one': ['law', 'yes (the change the project records)', [], 'holds', 'kernel-evaluated on the code table: UUU to UUA, exactly the F326L claim'],
  'Delphi.Genotype.trp_stop_one': ['law', 'yes (a property of the code)', [], 'holds', 'kernel-evaluated; no flying-fish nonsense mutation is recorded in this project'],
  'Delphi.Genotype.met_trp_two': ['law', 'yes (a property of the code)', [], 'holds', 'kernel-evaluated; carries no information about the fish beyond the code'],
  'Delphi.Genotype.devOrdered_acyclic': ['law', 'no: the certified graph is zebrafish anatomy (ZFA) with ZFIN stages, not Exocoetidae', [noFish('a staged develops_from graph')], 'cannot-evaluate', 'no flying-fish developmental series exists in this project; the certificate is about the zebrafish fin subtree'],
  'Delphi.Genotype.devOrdered_of_check': ['law', 'no: as devOrdered_acyclic', [noFish('a staged develops_from graph')], 'cannot-evaluate', 'the 8 certified edges are zebrafish; nothing here is a flying-fish stage'],
  'Delphi.Genotype.closure_of_check': ['law', 'no: the map is zebrafish links joined to the blueprint', [noFish('a gene-to-structure map')], 'cannot-evaluate', 'the gene reach comes from ZFIN and Bgee rows for Danio rerio; no Exocoetidae expression data is in this project'],
  'Delphi.Genotype.closure_violated': ['filter', 'no: as closure_of_check', [noFish('a gene-to-structure map')], 'cannot-evaluate', 'it fires on a Studio view built from the zebrafish map, not on a measurement of a flying fish'],
  'Delphi.Genotype.expectedWaitingTime_neutral': ['law', 'yes-under-named-hypotheses: neutral, constant M and mu', popgenInputs, 'cannot-evaluate', 'the neutral waiting time N/mu needs a required substitution count N, which is undefined for any flying-fish trait, and mu is a proxy from other teleosts'],
  'Delphi.Genotype.expectedWaitingTime_bounds': ['law', 'yes-under-named-hypotheses: independent sequential fixations', popgenInputs.concat([noFish('a required number of substitutions')]), 'cannot-evaluate', 'both bounds need N; no wing requirement in substitutions is defined anywhere in this project'],
  'Delphi.Genotype.too_little_time_rules_out': ['filter', 'yes-under-named-hypotheses', popgenInputs.concat([noFish('a required number of substitutions')]), 'cannot-evaluate', 'with the fossil duration (about 4.8e7 generations at one year) and the proxy M and mu the model allows any N up to about 4.8e8, so it rules out nothing about the fish; it fires only on a control'],
  'Delphi.Genotype.haldane_time_lower': ['law', 'yes-under-named-hypotheses: Haldane\'s cost accounting, contested', [noFish('a reproductive excess'), noFish('a cost per substitution'), noFish('a required number of substitutions')], 'cannot-evaluate', 'no reproductive excess, cost or requirement is measured for Exocoetidae; the bound is proved FROM the hypothesis, which this project neither proves nor endorses'],
  'Delphi.Genotype.haldane_rules_out': ['filter', 'yes-under-named-hypotheses: as haldane_time_lower', [noFish('a reproductive excess'), noFish('a cost per substitution')], 'cannot-evaluate', 'fires only on a control with illustrative numbers']
};
const PHYSIOLOGY = {
  'Delphi.Physiology.q10_ratio': ['law', 'yes-under-named-hypotheses: a rate that follows a Q10 law', [noFish('a Q10 for any rate')], 'cannot-evaluate', 'the chain scales muscle rates with Q10 values from scup (Rome 1992); no flying-fish Q10 exists, and the conditions file fixes 25 C so no instance is evaluated'],
  'Delphi.Physiology.q10_log': ['law', 'yes-under-named-hypotheses: as q10_ratio', [noFish('a Q10 for any rate')], 'cannot-evaluate', 'as q10_ratio'],
  'Delphi.Physiology.sphereWallStress_mono': ['law', 'yes (a thin wall is a thin wall)', [noFish('a vessel or swim-bladder radius'), noFish('a wall thickness')], 'cannot-evaluate', 'no radius or thickness for any flying-fish vessel or swim bladder is in this project'],
  'Delphi.Physiology.laplace_pressure_limit': ['law', 'yes-under-named-hypotheses: thin wall, static pressure', [noFish('a wall strength'), noFish('a wall thickness'), noFish('a radius')], 'cannot-evaluate', 'proved with no instance: the three inputs are unmeasured for Exocoetidae'],
  'Delphi.Physiology.hoop_pressure_limit': ['law', 'yes-under-named-hypotheses: as laplace_pressure_limit', [noFish('a wall strength'), noFish('a wall thickness'), noFish('a radius')], 'cannot-evaluate', 'as laplace_pressure_limit']
};
const EMPIRICAL = {
  'Delphi.Empirical.not_isometric_area': ['law', 'yes: the observation is measured ON a flying fish (Davenport 1992, Exocoetus obtusirostris)', [F.bArea], 'violated', `fin area grows as SL^${bArea.exponent}, so the isometric exponent 2 is excluded: this is the measurement that makes nine audit rows read "violated"`],
  'Delphi.Empirical.loading_rises': ['law', 'yes: measured within a flying-fish species', [F.bWS], 'holds', `wing loading grows as SL^${bWS.exponent} > 1, so a bigger fish of the species is more loaded than isometry predicts`],
  'Delphi.Empirical.weight_ratio_band': ['law', 'yes: the band is six fitted field studies of five flying-fish species', [F.bMass], 'holds', 'the fitted exponents 2.908 to 3.011 all lie in [2.90, 3.02], so the band holds on the project\'s own table (the H. affinis male row at 2.208 is excluded and named)'],
  'Delphi.Empirical.weight_ratio_rules_out': ['filter', 'yes: a design committing a mass exponent', [F.bMass], 'holds', 'it rules out a design claiming the male-only 2.208 as the family exponent; the measured rows themselves are not ruled out'],
  'Delphi.Empirical.aerobicCeiling_le': ['law', 'yes-under-named-hypotheses: the measured teleost ranges, applied at the measured mass', [F.chain], 'holds', 'inside the ranges the physiology chain cites, the sustained aerobic ceiling at 0.06 kg is at most 0.0458 W; the chain\'s own proxies give 0.0357 W, which satisfies it'],
  'Delphi.Empirical.no_aerobic_flight_above_ceiling': ['filter', 'yes-under-named-hypotheses: Fick plus the measured ranges', [F.chain, F.preqField], 'violated', 'fires on the real fish: level flight at 10 m/s with the measured L/D 4.37 needs 1.3473 W against a ceiling of 0.0458 W for EVERY teleost the ranges allow, a factor of about 29'],
  'Delphi.Empirical.stored_power_le': ['law', 'yes-under-named-hypotheses: no gill ventilation in air', [noFish('an O2 store carried into the air')], 'cannot-evaluate', 'no blood volume or venous reserve is measured for Exocoetidae, so the store must be committed; with an illustrative 1 ml the bound forbids a minute of powered flight and allows two seconds'],
  'Delphi.Empirical.finRatio_outside': ['law', 'yes: 49 measured flying-fish specimens', [], 'holds', 'pectoral/SL of the measured specimens runs 0.406 to 0.823 (median 0.687), and the theorem only says a value outside that is above or below it: a statement about the record, never an impossibility'],
  'Delphi.Empirical.requiredFor_not_propagated_of_check': ['law', 'no: a convention about this project\'s map, not a property of animals', [], 'cannot-evaluate', 'it checks the map\'s derived links against a rule the project adopted; no measurement enters'],
  'Delphi.Empirical.requiredFor_propagated_violates': ['filter', 'no: as requiredFor_not_propagated_of_check', [], 'cannot-evaluate', 'as requiredFor_not_propagated_of_check'],
  'Delphi.Empirical.cannot_score_of_lethal_before': ['filter', 'no: the lethal levers are zebrafish alleles', [noFish('a lethal stage')], 'cannot-evaluate', 'the two instantiated rows (ezh2, wls) are Danio rerio; lethality in zebrafish is not a flying-fish measurement'],
  'Delphi.Empirical.empirical_nonvacuous': ['law', 'yes: the witness is built from the project\'s own measured numbers', [F.bArea, F.bWS, F.bMass, F.chain], 'holds', 'the measured numbers satisfy every observation at once, so the empirical layer cannot be eliminating candidates by contradiction'],
  'Delphi.Empirical.measured_ceiling_le': ['law', 'yes: the chain\'s own proxies', [F.chain], 'holds', 'the chain\'s ceiling 0.0357 W is inside the 0.0458 W bound the measured ranges allow'],
  'Delphi.Empirical.ezh2_cannot_be_scored': ['filter', 'no: a zebrafish allele', [], 'cannot-evaluate', 'the genotype thread records death and scoring both at 48 hpf for ezh2 in zebrafish; nothing about a flying fish'],
  'Delphi.Empirical.wls_rays_cannot_be_scored': ['filter', 'no: a zebrafish allele', [], 'cannot-evaluate', 'death by 12 dpf against ray parameters from 45 dpf, in zebrafish']
};
const ALTITUDE = {
  'Delphi.Altitude.vmin_mono': ['law', 'yes-under-named-hypotheses: a monotone atmosphere', [F.vmin, F.LD, F.finLen], 'cannot-evaluate', 'the direction is proved for any such atmosphere; no flying fish is observed at altitude, and the project\'s conditions are sea level'],
  'Delphi.Altitude.demand_mono': ['law', 'yes-under-named-hypotheses: as vmin_mono, with L/D fixed', [F.vmin, F.LD], 'cannot-evaluate', 'as vmin_mono; the physics thread\'s 1000 m candidates are a hypothetical design, not an observation'],
  'Delphi.Altitude.supply_anti': ['law', 'yes-under-named-hypotheses: arterial content nondecreasing in O2 partial pressure', [F.chain], 'cannot-evaluate', 'the Hill curve of the chain is monotone, but no flying-fish blood is measured at any altitude'],
  'Delphi.Altitude.feasible_downward_closed': ['law', 'yes-under-named-hypotheses: the monotone atmosphere and supply', [F.chain, F.preqField], 'cannot-evaluate', 'a statement about the model at all heights; the real fish is already infeasible at the ground, which is the case the next row covers'],
  'Delphi.Altitude.ceiling': ['filter', 'yes-under-named-hypotheses', [F.chain, F.preqField], 'cannot-evaluate', 'the ceiling is proved to exist as a boundary of a downward-closed set; its value is not computed and no flying fish is observed climbing'],
  'Delphi.Altitude.infeasible_at_ground_infeasible_everywhere': ['filter', 'yes-under-named-hypotheses: Fick and the monotone atmosphere', [F.chain, F.preqField], 'violated', 'fires on the real fish: its oxygen budget cannot pay for level flight at sea level (C14), so under this model it cannot at any height, and altitude explains nothing about it'],
  'Delphi.Altitude.demand_anti_area': ['law', 'yes-under-named-hypotheses: lift-supported flight at a fixed height', [F.vmin, F.LD], 'holds', 'a larger lifting area lowers the power required at a fixed height, which the measured specimen satisfies trivially; it is the only direction in which wing and oxygen budget can be traded'],
};
for (const [k, [kind, applies, inputs, verdict, why]] of Object.entries({ ...GENOTYPE, ...PHYSIOLOGY, ...EMPIRICAL, ...ALTITUDE })) JUDGE[k] = { applies, inputs, verdict, why, kind };

// ---- build the audit ----
const audited = Object.fromEntries(R.audit.theorems.map(a => [a.theorem, a.axioms]));
const theorems = R.theorems.map(t => {
  const full = t.file.includes('Genotype') ? `Delphi.Genotype.${t.name}` : t.file.includes('Physiology') ? `Delphi.Physiology.${t.name}` : t.file.includes('Empirical') ? `Delphi.Empirical.${t.name}` : t.file.includes('Altitude') ? `Delphi.Altitude.${t.name}` : t.file.includes('Blueprint') ? `Delphi.Blueprint.${t.name}` : t.file.includes('Constraints') ? `Delphi.Constraints.${t.name}` : t.file.includes('Favored') && /^(fixedBy_tendsto|fixationProbability_ge|fixationProbability_le_one)$/.test(t.name) ? `Delphi.FavoredChain.${t.name}` : t.file.includes('Kimura') && /^(fixedBy_sub_le|fixedBy_tendsto|fixationProbability_eq)$/.test(t.name) ? `Delphi.NeutralChain.${t.name}` : `Delphi.${t.name}`;
  const j = JUDGE[full];
  if (!j) throw new Error('no judgement for ' + full);
  return { theorem: full, module: t.file, line: t.line, doc: t.doc, axioms: audited[full] ?? null, kind: j.kind || (t.file.includes('Constraints') ? 'filter' : 'law'), appliesToExocoetidae: j.applies, appliesClass: null, inputs: j.inputs, verdict: j.verdict, qualifier: j.qualifier || null, why: j.why };
});
const counts = s => Object.fromEntries([...new Set(theorems.map(s))].map(v => [v, theorems.filter(t => s(t) === v).length]));
const classOfText = x => x.startsWith('yes-under') ? 'yes-under-named-hypotheses' : x.startsWith('yes') ? 'yes' : x.startsWith('no') ? 'no' : null;
const applyClass = t => t.appliesClass;
for (const t of theorems) {
  let a = t.appliesToExocoetidae, cls = classOfText(a);
  if (!cls && a.startsWith('as ')) { const refName = a.slice(3).split(/[ ,;:]/)[0]; const ref = theorems.find(x => x.theorem.endsWith('.' + refName)); if (ref) { cls = classOfText(ref.appliesToExocoetidae); t.appliesToExocoetidae = `${cls} (${a})`; } }
  t.appliesClass = cls || 'other';
}
const inputStatus = t => { const st = t.inputs.map(i => i.status || ''); return st.some(s => s.startsWith('measured')) ? 'has measured inputs' : st.some(s => s.startsWith('computed')) ? 'computed from measured and proxy' : st.some(s => s.startsWith('proxy')) ? 'proxy only' : st.length === 0 ? 'no inputs needed' : 'missing inputs only'; };
const summary = {
  theorems: theorems.length, measuredFacts: Object.values(F).map(x => ({ name: x.name, value: x.value, unit: x.unit || null, status: x.status, source: x.source })),
  verdicts: counts(t => t.verdict), applies: counts(applyClass), inputs: counts(inputStatus),
  headline: `Of ${theorems.length} theorems, ${theorems.filter(t => t.verdict === 'holds').length} hold when instantiated on the flying fish (the blueprint certificate's ${theorems.filter(t => t.module.includes('Blueprint')).length} structural theorems, the exact minimum-speed bound on the Park and Choi specimen, the cube law approximately on Davenport's exponent, and ${theorems.filter(t => t.verdict === 'holds' && !t.module.includes('Blueprint') && !/vmin|cubeLaw/.test(t.theorem)).length} bookkeeping lemmas), ${theorems.filter(t => t.verdict === 'violated').length} have their isometry hypotheses violated by Davenport's within-species exponents (fin area ${bArea.exponent} vs 2, wing loading ${bWS.exponent} vs 1), and ${theorems.filter(t => t.verdict === 'cannot-evaluate').length} cannot be evaluated because an input is missing: a neutral substitution rate or fixation probability for the family, fitness variance at any locus, an asexual lineage (none known), material strength and section data for fin rays and bone, muscle fraction and power, and v_min or L/D at a second body size.`,
  notMeasuredForExocoetidae: ['mutation rate (proxy from herring and stickleback)', 'effective population size for the family (one mitochondrial Ne for E. volitans)', 'any neutral substitution rate', 'fitness variance at any locus', 'breaking stress and cross-sections of fin rays or bone', 'muscle mass fraction and mass-specific power', 'v_min, L/D or C_L,max at more than one body size', 'confidence intervals on the Davenport 1992 exponents (abstract only)'],
  generated: new Date().toISOString(), tool: 'lean/flying-fish/audit.mjs', leanReport: R.built
};
fs.writeFileSync(path.join(root, 'lean/flying-fish-audit.json'), JSON.stringify({ summary, theorems }, null, 1));

// ---- markdown ----
const byModule = {}; for (const t of theorems) (byModule[t.module] ||= []).push(t);
let md = `# Every theorem against the flying fish (Exocoetidae)\n\nGenerated ${summary.generated} by \`lean/flying-fish/audit.mjs\` from \`lean.json\` (built ${R.built}) and the data files named below. One row per theorem the compiler accepted: whether it applies to Exocoetidae, which inputs are measured for flying fish, which are proxies, which are missing, and the verdict when instantiated. "Holds" and "violated" are about the model's hypotheses meeting the data; a theorem is never falsified by data, its hypotheses are.\n\n## Summary\n\n${summary.headline}\n\n| Verdict | Theorems |\n|---|---|\n${Object.entries(summary.verdicts).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\n| Applies to Exocoetidae | Theorems |\n|---|---|\n${Object.entries(summary.applies).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\n## Measured facts used (each with its file)\n\n| Fact | Value | Status | Source |\n|---|---|---|---|\n${summary.measuredFacts.map(f => `| ${f.name} | ${f.value}${f.unit ? ' ' + f.unit : ''} | ${f.status} | ${f.source} |`).join('\n')}\n\nNot measured for Exocoetidae at all: ${summary.notMeasuredForExocoetidae.join('; ')}.\n\n`;
for (const [m, ts] of Object.entries(byModule)) {
  md += `## ${m}\n\n| Theorem | Applies | Inputs (measured / proxy / missing) | Verdict | Why |\n|---|---|---|---|---|\n`;
  for (const t of ts) md += `| \`${t.theorem.replace(/^Delphi\./, '')}\` | ${t.appliesToExocoetidae} | ${t.inputs.length ? t.inputs.map(i => `${i.name}: **${(i.status || '').split(' ')[0]}**${i.value !== undefined ? ` (${i.value}${i.unit ? ' ' + i.unit : ''})` : ''}`).join('; ') : 'none'} | **${t.verdict}**${t.qualifier ? ' (' + t.qualifier + ')' : ''} | ${t.why} |\n`;
  md += '\n';
}
fs.writeFileSync(path.join(root, 'lean/AUDIT-FLYING-FISH.md'), md);

// ---- morphology grounding, keyed by manifest object name ----
const T = n => theorems.find(t => t.theorem === n) ? n : (() => { throw new Error('unknown theorem ' + n); })();
const inBlueprint = o => o.ontology_id ? (blueprintIds.has('http://purl.obolibrary.org/obo/' + o.ontology_id) ? 'present in the certified blueprint (term is a node of the well-formed graph)' : 'ontology term not in the certified blueprint') : 'no ontology id on this piece';
const finAreaRows = fieldSpeeds.map(v => ({ airspeed_m_s: v, lifting_area_needed_m2: +areaNeeded(v).toFixed(6) }));
const WING = {
  theorems: [T('Delphi.vmin_le'), T('Delphi.Constraints.vmin_rules_out'), T('Delphi.areaLaw_ratio'), T('Delphi.wingLoading_ratio'), T('Delphi.vmin_ratio'), T('Delphi.vmin_powerLaw_log'), T('Delphi.powerRequired_ratio'), T('Delphi.glide_range_le')],
  how: `Wing size: vmin_le bounds the lifting area from below for a given mass and speed, S ≥ 2W/(ρ v² C_L,max). For specimen L3 (W = ${f3(W)} N, C_L,max = ${CLmax}, ρ = ${rho}) the area needed is ${finAreaRows.map(r => `${r.lifting_area_needed_m2} m² at ${r.airspeed_m_s} m/s`).join(' and ')}; the measured lifting area (pectoral + pelvic + body planform) is ${S.toFixed(6)} m², so at the low end of the field speeds the fins are about as large as the bound requires and at 20 m/s four times larger. areaLaw_ratio and wingLoading_ratio say how S and W/S would scale under isometry; Davenport 1992 measures ${bArea.exponent} and ${bWS.exponent} instead, so isometry fails within E. obtusirostris. vmin_ratio and powerRequired_ratio give the √L and L^3.5 scalings under the named hypotheses; not evaluated (one size class). The fin LENGTH ratio 0.687 (Daane 2021) is an input the model carries; no theorem constrains fin length as such, nor aspect ratio or fin shape.`,
  numbers: { W_N: +W.toFixed(4), S_measured_m2: +S.toFixed(6), CLmax, rho, vmin_m_s: +vmin.toFixed(2), areaNeeded: finAreaRows, finLengthOverSL: finRatio.pectoral_over_SL_median, davenportExponents: { massVsSL: bMass.exponent, finAreaVsSL: bArea.exponent, wingLoadingVsSL: bWS.exponent } },
  notConstrained: ['fin length as a fraction of standard length (0.687 is an input, not a theorem)', 'aspect ratio (9.0-10.7, Park and Choi) and its effect on L/D', 'fin shape, dihedral, spread', 'the four-wing (pelvic) contribution beyond its area']
};
const RAY = {
  theorems: [T('Delphi.bendingStress_ratio_sheet'), T('Delphi.bendingStress_ratio_body'), T('Delphi.bending_cannot_carry'), T('Delphi.Constraints.bending_exponent_sheet_rules_out'), T('Delphi.Constraints.bending_exponent_rules_out')],
  how: 'Fin rays as slender beams (R9): under the aerodynamic load on a fin, which scales with fin area at fixed speed and C_L, the load is sheet-like, so bendingStress_ratio_sheet applies and predicts size-independent ray stress under similar sections, with no size limit; under a body-like load (R9a) stress ∝ L and a limit follows. Which applies is the empirical fork; inputs (ray section modulus, σ_max) are missing, so nothing is evaluated.',
  notConstrained: ['ray count (14 is illustrative)', 'ray branching and segmentation', 'ray material (lepidotrichia) strength']
};
const SKELETON = {
  theorems: [T('Delphi.breakLoad_ratio'), T('Delphi.safetyFactor_eq'), T('Delphi.cannot_carry'), T('Delphi.Constraints.giant_rules_out'), T('Delphi.Constraints.axial_strength_rules_out'), T('Delphi.bendingStress_ratio_body')],
  how: 'Load-bearing skeleton (vertebrae, ribs, skull, pectoral girdle): R7 gives breaking load ∝ L² and safety factor ∝ 1/L under isometric sections and one material; R9a gives bending stress ∝ L for a body-like load. Both apply to a scaled-up flying fish only with σ, section constants and a reference safety factor, none of which is measured; cannot-evaluate. The counts (40 vertebrae) are illustrative in the manifest.',
  notConstrained: ['vertebra count and shape', 'skull shape', 'girdle geometry']
};
const MUSCLE = { theorems: [T('Delphi.powerAvailable_ratio'), T('Delphi.exists_size_limit'), T('Delphi.powerRatio_eq'), T('Delphi.sustained_le'), T('Delphi.sustained_flight_requires'), T('Delphi.climb_le_aerobic'), T('Delphi.powerLaw_crossover')], how: 'Trunk musculature: Thompson\'s muscle premise (power available = f p M) is carried only as a NAMED HYPOTHESIS (powerAvailable_ratio, exists_size_limit). The aerobic bound replaces it with a derived ceiling: sustained mechanical power ≤ η E_O2 Q (Ca − Cv) ≤ η E_O2 Q Ca (sustained_le), so sustained powered flight needs η E_O2 Q Ca ≥ P_req (sustained_flight_requires) and climb is bounded by the excess (climb_le_aerobic); the crossover theorem gives a size limit for any supply exponent below 7/2. Q, Ca, E and η are unmeasured for Exocoetidae, and a gliding fish does not fly under muscle power, so these constrain the taxiing and launch phase of the real fish and are the central check for a designed powered variant.', notConstrained: ['myomere count (32, illustrative)', 'muscle fraction f', 'mass-specific power p', 'contraction frequency', 'anaerobic burst power'] };
const BODY = { theorems: [T('Delphi.cubeLaw_ratio'), T('Delphi.cubeLaw_loglog_exponent'), T('Delphi.not_cubeLaw_of_exponent_ne_three'), T('Delphi.powerLaw_ratio'), T('Delphi.powerLaw_div'), T('Delphi.wingLoading_ratio'), T('Delphi.glide_range_le'), T('Delphi.glide_range_le_groundEffect'), T('Delphi.sustained_flight_requires'), T('Delphi.powerLaw_crossover'), T('Delphi.froude_ratio'), T('Delphi.neutral_expectedSubstitutions'), T('Delphi.Blueprint.wellFormed_of_check')], how: `Whole body: the cube law relates size to mass (Davenport: mass ∝ SL^${bMass.exponent}, within 0.02 of 3, no CI); wing loading W/S follows from mass and fin area (measured ${bWS.exponent}, isometry would give 1); froude_ratio constrains swimming and taxiing speed across sizes at equal Froude number (not evaluated, one size class); the substitution budget (neutral_expectedSubstitutions) bounds the lineage's neutral change over its fossil duration, independent of population size; wellFormed_of_check certifies the emitted anatomy graph. Adult length 0.15-0.50 m (Davenport 1994 review) is the size range these apply to.`, notConstrained: ['body depth and width, head shape (schematic in the manifest)', 'density (assumed constant)', 'the value of any size limit'] };
const NONE = reason => ({ theorems: [], how: `no theorem constrains this part: ${reason}`, notConstrained: ['everything about it'] });
const ORGAN = (name) => ({ theorems: [T('Delphi.Blueprint.wellFormed_of_check'), T('Delphi.Blueprint.TaxonData.ok_of_check')], how: `${name}: no theorem constrains its size, shape or function. Where the piece carries an ontology id that is a node of the certified blueprint, the only grounding is structural: its placement under its organ system is part of a graph the kernel checked to be acyclic, rooted and not excluded from Exocoetidae by the ontologies' taxon statements.`, notConstrained: ['size, shape, position, function'] });
const grounding = {};
for (const o of MAN.objects) {
  const n = o.object; let gnd;
  if (/^pectoral_fin_[LR]$/.test(n)) gnd = WING;
  else if (/^pectoral_fin_ray_/.test(n)) gnd = RAY;
  else if (/^pelvic_fin_[LR]$/.test(n)) gnd = { ...WING, how: 'Pelvic fin (the second wing of a four-winger): enters the lifting area S of vmin_le as A2 in Park and Choi (0.001837 m² for L3; folded in model M); otherwise as the pectoral fin.', notConstrained: ['pelvic fin size relative to pectoral', 'ray count (6, illustrative)'] };
  else if (/^pelvic_fin_rays_/.test(n)) gnd = RAY;
  else if (/^(dorsal|anal)_fin$/.test(n)) gnd = NONE('the dorsal and anal fins are not part of the lifting area in the Park and Choi reference area, and no formalised law concerns them');
  else if (/^(dorsal|anal)_fin_rays$/.test(n)) gnd = { ...RAY, how: 'Dorsal and anal fin rays as beams (R9): the same bending lemmas would apply with their own load; no data; the fins themselves carry no lift in the model.' };
  else if (n === 'caudal_fin') gnd = { theorems: [T('Delphi.froude_ratio')], how: 'Caudal fin (the propulsor for taxiing and launch): no theorem constrains its shape or the longer lower lobe; froude_ratio constrains only how the swimming speed it produces scales across sizes at equal Froude number, and the launch speed is measured for one size class only (Makiguchi 2013, 3.87-5.15 m/s, estimated).', notConstrained: ['lobe asymmetry', 'ray count (19, illustrative)', 'taxiing thrust'] };
  else if (n === 'caudal_fin_rays') gnd = { ...RAY, how: 'Caudal fin rays as beams under the taxiing load (R9): no data; which load family applies is not known.' };
  else if (/^muscle_/.test(n)) gnd = MUSCLE;
  else if (/^(vertebra_|ribs_|skull_|cleithrum_|scapula_|coracoid_)/.test(n)) gnd = SKELETON;
  else if (/^skin_/.test(n)) gnd = { theorems: [T('Delphi.areaLaw_ratio')], how: 'Skin: under isometry its area scales as L² (areaLaw_ratio), which says nothing about the fish beyond the hypothesis; the body planform area (A3 in Park and Choi, 0.004474 m² for L3) is part of the lifting area in vmin_le. Scale pattern is a procedural texture, not data.', notConstrained: ['scale count and pattern', 'colour'] };
  else if (/^eye_/.test(n)) gnd = NONE('no formalised law concerns vision or eye size');
  else if (n === 'heart') gnd = { theorems: [T('Delphi.sustained_le'), T('Delphi.sustained_flight_requires'), T('Delphi.Blueprint.wellFormed_of_check')], how: 'Heart: cardiac output Q enters the aerobic bound (sustained power ≤ η E_O2 Q Ca); Q is unmeasured for Exocoetidae, so the bound cannot be evaluated; structurally the term is a node of the certified blueprint.', notConstrained: ['chamber sizes and shape', 'stroke volume and heart rate', 'Q itself'] };
  else if (/^gills_/.test(n)) gnd = { theorems: [T('Delphi.sustained_le'), T('Delphi.sustained_flight_requires'), T('Delphi.Blueprint.wellFormed_of_check')], how: 'Gills: arterial O2 content Ca (set by gill exchange) enters the aerobic bound; the gill-exchange link itself (water O2 and gill area to Ca) is NOT formalised and is the first link the physics simulator needs; Ca is unmeasured for Exocoetidae.', notConstrained: ['gill area, lamellar geometry, diffusion', 'arch and filament counts (illustrative)'] };
  else gnd = ORGAN(o.label);
  grounding[n] = { label: o.label, ontology_id: o.ontology_id || null, level: o.level, organ_system: o.organ_system, layer: o.layer, geometry_basis: o.geometry_basis, blueprint: inBlueprint(o), theorems: gnd.theorems.map(th => { const t = theorems.find(x => x.theorem === th); return { theorem: th, module: t.module, verdict: t.verdict, applies: applyClass(t) }; }), how: gnd.how, numbers: gnd.numbers || null, notConstrained: gnd.notConstrained };
}
const gsum = { objects: Object.keys(grounding).length, withTheorems: Object.values(grounding).filter(g => g.theorems.length).length, withNone: Object.values(grounding).filter(g => !g.theorems.length).length, inCertifiedBlueprint: Object.values(grounding).filter(g => g.blueprint.startsWith('present')).length, generated: new Date().toISOString(), tool: 'lean/flying-fish/audit.mjs', manifest: 'anatomy-model/manifest.json', note: 'Keyed by manifest object name. "theorems" lists what constrains the part and the audit verdict of each; "how" says in what way; "notConstrained" lists what no theorem touches. Organs are grounded only structurally through the blueprint certificate where their ontology id is a node of it. Nothing here says the model is correct; it says which parts a machine-checked statement reaches.' };
fs.writeFileSync(path.join(root, 'lean/morphology-grounding.json'), JSON.stringify({ summary: gsum, grounding }, null, 1));
console.log(JSON.stringify({ theorems: theorems.length, verdicts: summary.verdicts, applies: summary.applies, grounding: gsum, vmin: +vmin.toFixed(3), areaNeeded: finAreaRows, mkSlope: +mkFit.slope.toFixed(3) }));
