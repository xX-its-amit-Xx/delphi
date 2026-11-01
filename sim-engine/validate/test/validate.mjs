#!/usr/bin/env node
// Tests for sim-engine/validate. Every check can be made to fail on purpose: MUTATE=<check name> perturbs that
// check's input (or flips its expectation), so a check that can never fail is caught. Exit code = failures.
//   node sim-engine/validate/test/validate.mjs
//   MUTATE=zebrafish-self node sim-engine/validate/test/validate.mjs     (must exit non-zero)
import { loadBundle } from '../../lib/data-node.mjs';
import * as O from '../../lib/organism.mjs';
import { resolveState } from '../../lib/state.mjs';
import { loadReferences, rawFromState, closestPhenotype, AVES_RE, pValue } from '../phenotype.mjs';
import { closestGenotype, parseChange, cacheGet } from '../genotype.mjs';
import { composite, assess, swarmTasks, SCORER } from '../score.mjs';
import { flightMuscleFit } from '../sanity.mjs';

const MUT = process.env.MUTATE || '';
let fails = 0, n = 0;
// MUTATE never flips a verdict; it perturbs the INPUT of the named check, so the check itself must catch it.
const M = name => MUT === name;
const check = (name, ok, detail = '') => { n++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}${M(name) ? ' [MUTATED input]' : ''}`); };

const bundle = await loadBundle();
const R = await loadReferences();
const st = id => resolveState(O.docFor(bundle, id), undefined, {}, bundle);
const doc = (base, edits, genotype) => { let d = { ...O.docFor(bundle, base), id: 't' }; for (const e of edits) d = O.appendEdit(bundle, d, { author: 'agent:test', reason: 'test', ...e }); return genotype ? { ...d, genotype } : d; };

// phenotype
{
  const raw = rawFromState(st('zebrafish-adult'));
  if (MUT === 'zebrafish-self') raw.SL_m *= 1.5;
  const r = await closestPhenotype(raw);
  check('zebrafish-self', r.body.nearest[0].id === 'zebrafish-adult' && r.body.distance < 1e-9, `nearest ${r.body.nearest[0].id} d=${r.body.distance}`);
  const ex = await closestPhenotype(rawFromState(st('zebrafish-adult')), { exclude: M('leave-lineage-out') ? [] : ['organism:zebrafish'] });
  check('leave-lineage-out', !ex.body.nearest.some(x => x.id.startsWith('zebrafish')) && ex.body.distance > 0, `nearest ${ex.body.nearest[0].name} d=${ex.body.distance}`);
  const t = await closestPhenotype(rawFromState(st(M('tff-envelope') ? 'zebrafish-adult' : 'tff')));
  check('tff-envelope', t.fin_envelope.outside.some(o => o.feature === 'pectoral_span_SL') && t.fin_envelope.p_value < 0.5, `outside ${t.fin_envelope.outside.map(o => o.feature).join(',')}`);
  const sorted = R.calibration.body.distances_sorted;
  check('calibration-threshold', Math.abs(R.calibration.body.threshold - sorted[M('calibration-threshold') ? 0 : Math.floor(0.99 * (sorted.length - 1))]) < 0.05 && R.calibration.body.n > 1000, `thr ${R.calibration.body.threshold.toFixed(3)} n ${R.calibration.body.n}`);
  check('p-value-monotone', pValue(sorted, M('p-value-monotone') ? 0.3 : 0.01) > pValue(sorted, M('p-value-monotone') ? 0.01 : 0.3) && pValue(sorted, 0.3) > pValue(sorted, 5) && pValue(sorted, 5) === 1 / (sorted.length + 1));
  check('no-aves-in-references', !R.refs.some(r => AVES_RE.test(`${r.name} ${r.taxon}`)) && AVES_RE.test(M('no-aves-in-references') ? 'Danio rerio' : 'Gallus gallus (Aves)') && !AVES_RE.test('Scarus psittacus Scaridae (Perciformes)'), `refs ${R.refs.length}, dropped ${R.aves_dropped.length}`);
  check('test-split-disjoint', !R.refs.some(r => r.split === 'test' && r.split === 'calibration') && R.refs.filter(r => r.split === 'test').length > (M('test-split-disjoint') ? 1e9 : 1000));
}
// genotype
{
  const g = await closestGenotype(doc('zebrafish-adult', [{ target: { level: 'gene', id: 'kcnk5b' }, param: 'allele', op: 'set', value: M('reference-residue') ? 'p.A169L' : M('known-lab-allele') ? 'p.W169F' : 'p.W169L' }],
    [{ gene: 'hhip', change: M('premature-stop') ? 'p.Y285F' : 'p.Y285*' }, { gene: 'slc43a2a', change: M('alt-state-exists') ? 'p.F326W' : 'p.F326L' }, { gene: 'kcnk5b', change: 'p.A169L' }]), { network: false });
  const ck = (i, id) => g.edits[i].checks.find(c => c.id === id)?.status;
  check('reference-residue', ck(0, 'reference_residue') === 'passed' && ck(3, 'reference_residue') === 'failed');
  check('premature-stop', ck(1, 'premature_stop') === 'flagged');
  const f = g.edits[2].comparison;
  check('alt-state-exists', f.alt_state_in_real_organisms.exists && f.alt_state_in_real_organisms.in_natural_orthologues.some(x => /Hirundichthys/.test(x.species)), `${f.alt_state_in_real_organisms.in_natural_orthologues.length} carriers`);
  check('known-lab-allele', g.edits[0].comparison.alt_state_in_real_organisms.known_lab_or_natural_alleles.some(a => a.id === 'alf_W169L'));
  check('state-not-phenotype', g.edits.every(e => /STATE, not a phenotype/.test(M('state-not-phenotype') ? 'phenotype predicted' : e.state_not_phenotype)) && !JSON.stringify(g).match(/predicted (fin|phenotype) (length|size)/i));
  check('parse', parseChange('p.Trp169Leu').alt === 'L' && parseChange('c.505del').kind === 'nt_deletion' && parseChange('p.H215fs').kind === 'frameshift' && parseChange(M('parse') ? 'p.W169L' : '???').kind === 'unparsed');
  const fsd = doc('zebrafish-adult', [], [{ gene: 'kcnk5b', change: M('in-frame') ? 'c.505_507del' : 'c.505del' }]);
  const fs1 = await closestGenotype(fsd, { network: false });
  const fr = fs1.edits[0].checks.find(c => c.id === 'in_frame');
  if (fr.status === 'could-not-run') console.log('skip in-frame (CDS not cached; run once with network)');
  else check('in-frame', fr.status === 'flagged', fr.detail);
}
// sanity + score
{
  const fz = flightMuscleFit({ flight_muscle_fraction: M('organ-fit') ? 0.001 : 0.5, mass_kg: 6.943e-4, SL_m: 0.0388, depth_SL: 0.2535, width_SL: 0.135 });
  check('organ-fit', fz.fit < 0.5, `fit ${fz.fit.toFixed(3)}`);
  const c = composite({ P: { ran: true, value: 1 }, L: { ran: true, value: 1 }, G: { ran: true, value: 1 }, S: { ran: false }, E: { ran: true, value: M('composite') ? 1 : 0.5 } });
  check('composite', Math.abs(c - Math.exp((0.10 * Math.log(0.5)) / 0.85)) < 1e-12, `${c}`);
  const neg = await assess({ organism: doc('flying-fish', [{ target: { level: 'body' }, param: 'standard_length_m', op: 'scale', value: M('lean-new') ? 1 : 3 }]) });
  check('lean-new', neg.lean.accepted.newly_caused.some(v => v.constraint === 'C7b') && neg.score.components.L.value === 0 && !neg.score.plausible, `new ${neg.lean.accepted.newly_caused.map(v => v.constraint)}`);
  check('lean-kinds-separate', Array.isArray(M('lean-kinds-separate') ? null : neg.lean.candidate) && Array.isArray(neg.lean.contested) && neg.lean.accepted.newly_caused.every(v => v.status === 'accepted'));
  const z = await assess({ organism: 'zebrafish-adult' });
  const zr = M('real-organism-plausible') ? await assess({ organism: 'tff' }) : z;
  check('verdict-never-valid', !/\bvalid\b/i.test((z.verdict.statement + (M('verdict-never-valid') ? ' The design is valid.' : '')).replace('Not a validity claim', '')) && /closest real relative/i.test(z.verdict.statement));
  check('real-organism-plausible', zr.score.plausible && zr.score.value >= SCORER.plausible_threshold, `${zr.score.value}`);
  const sw = swarmTasks({ organism: 'tff' });
  if (M('swarm-kinds')) sw.tasks.pop();
  check('swarm-kinds', JSON.stringify(sw.tasks.map(t => t.kind)) === JSON.stringify(['closest-relative-phenotype', 'closest-relative-genotype', 'sanity-geno', 'sanity-pheno', 'lean-by-component', 'adversarial-review']));
}
// versions
{
  const { SCORERS, designScore } = await import('../score.mjs');
  check('versions-frozen', !!(SCORERS['1.0.0'] && SCORERS['1.1.0']) && JSON.stringify(SCORERS['1.0.0'].weights) === JSON.stringify(SCORERS[M('versions-frozen') ? '9.9.9' : '1.1.0']?.weights));
  const st11 = (await import('../sanity.mjs')).stateEnvelope;
  const bad = resolveState(doc('zebrafish-adult', [{ target: { level: 'body' }, param: 'gill_area_m2', op: 'scale', value: M('state-envelope') ? 1 : 0.05 }]), undefined, {}, bundle);
  const se = st11(bad, rawFromState(bad));
  check('state-envelope', se.outside.some(o => o.field === 'gill_area_per_kg') && se.p_value < 0.01, `p ${se.p_value}`);
  const a = await designScore('zebrafish-adult', { version: '1.1.0', reference_set_excluding: M('leave-out-family') ? [] : ['family:Cyprinidae'] });
  check('leave-out-family', !/Cyprinidae|Danio/.test(`${a.closest_real_relative.taxon}`), `${a.closest_real_relative.name} ${a.closest_real_relative.taxon}`);
}
// three named results
{
  const { designScore } = await import('../score.mjs');
  const r = await designScore(doc('flying-fish', [{ target: { level: 'body' }, param: 'standard_length_m', op: 'scale', value: M('three-results-lean-gate') ? 1 : 3 }]), { version: '1.2.0' });
  check('three-results-lean-gate', r.lean_gate_failed === true && /^FAIL/.test(r.lean_check.gate) && r.lean_check.accepted_violations.every(v => v.inputs) && r.genotype_similarity && r.phenotype_similarity.closest_real_relative, r.lean_check.gate.slice(0, 50));
}
// Every version must survive BOTH benchmark-shaped inputs: a bare {specimen} and a {params} item. The shipped
// entry point is score.mjs designScore; a crash here makes a blind benchmark run meaningless rather than a fail.
{
  const { designScore } = await import('../score.mjs');
  const SPEC = { SL_m: 0.0388, mass_kg: 0.0006943, depth_SL: 0.2535, width_SL: 0.135, ped_depth_frac: 0.38, ped_width_frac: 0.4 };
  const PARAMS = { standard_length_m: 0.0388, body_mass_kg: 0.0006943, body_depth_over_SL: 0.2535, body_width_over_SL: 0.135, peduncle_depth_frac: 0.38, peduncle_width_frac: 0.4 };
  const bad = [];
  for (const version of ['1.0.0', '1.1.0', '1.1.1', '1.2.0']) {
    for (const [shape, design] of [['specimen', { specimen: M('every-version-no-crash') ? { depth_SL: 0.25 } : SPEC }], ['params', { params: PARAMS }]]) {
      let r = null, err = null;
      try { r = await designScore(design, { version, network: false }); } catch (e) { err = e.message; }
      const ok = !err && r && typeof r.score === 'number' && !r.error;
      if (!ok) bad.push(`${version}/${shape}: ${err || r?.error || 'score ' + JSON.stringify(r?.score)}`);
    }
  }
  // No MUTATE knob: this check was SEEN to fail against the pre-fix file, 7 of these 8 combinations
  // (SCORER-RESULTS.md, deviation 3). The guards it covers are exercised by 'three-results-guards' below.
  check('every-version-no-crash', bad.length === 0, bad.join(' | ') || 'all 8 version/shape combinations returned a numeric score');

  // The guards themselves: threeResults must survive blocks that did not run. MUTATE makes state_envelope.outside
  // throw on access, which is what an unguarded `.outside.map(...)` did, so the check is seen to be sensitive.
  const { threeResults } = await import('../score.mjs');
  const stub = {
    genotype: { edits: [] },
    phenotype: { body: { ran: false, reason: 'no body features' }, fin: { ran: true }, ood: false },
    state_envelope: M('three-results-guards') ? new Proxy({}, { get: () => { throw new Error('unguarded .outside'); } }) : { ran: false, reason: 'specimen record: no STATE' },
    lean: { counts: null, components: [{ component: { level: 'body', id: 'body' } }] },
    verdict: { closest_real_relative: null },
  };
  let t3 = null, t3err = null;
  try { t3 = threeResults(stub); } catch (e) { t3err = e.message; }
  check('three-results-guards', !t3err && t3 && t3.phenotype_similarity.physiology_envelope_outside === null && t3.lean_check.by_component.length === 1, t3err || 'blocks that did not run are reported as null, not crashed on');
}
// v1.3.0 joint term: it must see a shuffled decoy (correlations broken, every marginal realistic), which is what
// per-trait envelopes cannot do. MUTATE feeds a REAL specimen instead, so the check is seen to be sensitive.
{
  const { jointTerm, fitBlock, inverse } = await import('../joint.mjs');
  const real = { standard_length_m: 0.0961, body_mass_kg: 0.0101, body_depth_over_SL: 0.2437, body_width_over_SL: 0.1049, peduncle_depth_frac: 0.3416, peduncle_width_frac: 0.3932 };
  // same marginals, recombined: a long thin body with a deep-bodied fish's depth and a deep peduncle
  const decoy = { standard_length_m: 0.0961, body_mass_kg: 0.0101, body_depth_over_SL: 0.62, body_width_over_SL: 0.1049, peduncle_depth_frac: 0.95, peduncle_width_frac: 0.3932 };
  const rr = jointTerm(real, {}), rd = jointTerm(M('joint-sees-broken-correlations') ? real : decoy, {});
  check('joint-sees-broken-correlations', rr.ran && rd.ran && rr.p_value > 0.05 && rd.p_value < 0.01 && rd.top_broken_pairs.length > 0,
    `real p ${rr.p_value}, recombined p ${rd.p_value}${rd.top_broken_pairs?.[0] ? ` (worst pair ${rd.top_broken_pairs[0].traits.join(' x ')}, r=${rd.top_broken_pairs[0].correlation_in_real_fish})` : ''}`);
  // family-held-out fitting must be an exact subtraction, not a refit on everything
  const all = fitBlock('fishshapes', {}), out = fitBlock('fishshapes', { excludeFamilies: M('joint-family-held-out') ? [] : ['Cyprinidae'] });
  check('joint-family-held-out', all.ran && out.ran && out.n < all.n && out.held_out_families.length === 1 && Math.abs(out.mu[0] - all.mu[0]) > 1e-9,
    `n ${all.n} -> ${out.n} with Cyprinidae held out`);
  check('joint-inverse', (() => { const A = [[2, 0.3], [0.3, 1]], I = inverse(A); const p = I[0][0] * A[0][0] + I[0][1] * A[1][0]; return Math.abs(p - (M('joint-inverse') ? 0 : 1)) < 1e-9; })());
}
console.log(`\n${n - fails}/${n} passed${MUT ? ` (MUTATE=${MUT})` : ''}`);
process.exit(fails);
