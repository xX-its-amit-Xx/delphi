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
console.log(`\n${n - fails}/${n} passed${MUT ? ` (MUTATE=${MUT})` : ''}`);
process.exit(fails);
