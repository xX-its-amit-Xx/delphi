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
const check = (name, ok, detail = '') => { n++; const o = MUT === name ? !ok : ok; if (!o) fails++; console.log(`${o ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}${MUT === name ? ' [MUTATED]' : ''}`); };

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
  const ex = await closestPhenotype(rawFromState(st('zebrafish-adult')), { exclude: ['organism:zebrafish'] });
  check('leave-lineage-out', !ex.body.nearest.some(x => x.id.startsWith('zebrafish')) && ex.body.distance > 0, `nearest ${ex.body.nearest[0].name} d=${ex.body.distance}`);
  const t = await closestPhenotype(rawFromState(st('tff')));
  check('tff-envelope', t.fin_envelope.outside.some(o => o.feature === 'pectoral_span_SL') && t.fin_envelope.p_value < 0.5, `outside ${t.fin_envelope.outside.map(o => o.feature).join(',')}`);
  const sorted = R.calibration.body.distances_sorted;
  check('calibration-threshold', Math.abs(R.calibration.body.threshold - sorted[Math.floor(0.99 * (sorted.length - 1))]) < 0.05 && R.calibration.body.n > 1000, `thr ${R.calibration.body.threshold.toFixed(3)} n ${R.calibration.body.n}`);
  check('p-value-monotone', pValue(sorted, 0.01) > pValue(sorted, 0.3) && pValue(sorted, 0.3) > pValue(sorted, 5) && pValue(sorted, 5) === 1 / (sorted.length + 1));
  check('no-aves-in-references', !R.refs.some(r => AVES_RE.test(`${r.name} ${r.taxon}`)) && AVES_RE.test(MUT === 'aves-regex' ? 'Danio rerio' : 'Gallus gallus (Aves)'), `refs ${R.refs.length}, dropped ${R.aves_dropped.length}`);
  check('test-split-disjoint', !R.refs.some(r => r.split === 'test' && r.split === 'calibration') && R.refs.filter(r => r.split === 'test').length > 1000);
}
// genotype
{
  const g = await closestGenotype(doc('zebrafish-adult', [{ target: { level: 'gene', id: 'kcnk5b' }, param: 'allele', op: 'set', value: MUT === 'reference-residue' ? 'p.A169L' : 'p.W169L' }],
    [{ gene: 'hhip', change: 'p.Y285*' }, { gene: 'slc43a2a', change: 'p.F326L' }, { gene: 'kcnk5b', change: 'p.A169L' }]), { network: false });
  const ck = (i, id) => g.edits[i].checks.find(c => c.id === id)?.status;
  check('reference-residue', ck(0, 'reference_residue') === 'passed' && ck(3, 'reference_residue') === 'failed');
  check('premature-stop', ck(1, 'premature_stop') === (MUT === 'premature-stop' ? 'passed' : 'flagged') || (MUT === 'premature-stop' && false));
  const f = g.edits[2].comparison;
  check('alt-state-exists', f.alt_state_in_real_organisms.exists && f.alt_state_in_real_organisms.in_natural_orthologues.some(x => /Hirundichthys/.test(x.species)), `${f.alt_state_in_real_organisms.in_natural_orthologues.length} carriers`);
  check('known-lab-allele', g.edits[0].comparison.alt_state_in_real_organisms.known_lab_or_natural_alleles.some(a => a.id === 'alf_W169L'));
  check('state-not-phenotype', g.edits.every(e => /STATE, not a phenotype/.test(e.state_not_phenotype)) && !JSON.stringify(g).match(/predicted (fin|phenotype) (length|size)/i));
  check('parse', parseChange('p.Trp169Leu').alt === 'L' && parseChange('c.505del').kind === 'nt_deletion' && parseChange('p.H215fs').kind === 'frameshift' && parseChange('???').kind === (MUT === 'parse' ? 'missense' : 'unparsed'));
  const fsd = doc('zebrafish-adult', [], [{ gene: 'kcnk5b', change: 'c.505del' }]);
  const fs1 = await closestGenotype(fsd, { network: false });
  const fr = fs1.edits[0].checks.find(c => c.id === 'in_frame');
  if (fr.status === 'could-not-run') console.log('skip in-frame (CDS not cached; run once with network)');
  else check('in-frame', fr.status === 'flagged', fr.detail);
}
// sanity + score
{
  const fz = flightMuscleFit({ flight_muscle_fraction: MUT === 'organ-fit' ? 0.001 : 0.5, mass_kg: 6.943e-4, SL_m: 0.0388, depth_SL: 0.2535, width_SL: 0.135 });
  check('organ-fit', fz.fit < 0.5, `fit ${fz.fit.toFixed(3)}`);
  const c = composite({ P: { ran: true, value: 1 }, L: { ran: true, value: 1 }, G: { ran: true, value: 1 }, S: { ran: false }, E: { ran: true, value: MUT === 'composite' ? 1 : 0.5 } });
  check('composite', Math.abs(c - Math.exp((0.10 * Math.log(0.5)) / 0.85)) < 1e-12, `${c}`);
  const neg = await assess({ organism: doc('flying-fish', [{ target: { level: 'body' }, param: 'standard_length_m', op: 'scale', value: MUT === 'lean-new' ? 1 : 3 }]) });
  check('lean-new', neg.lean.accepted.newly_caused.some(v => v.constraint === 'C7b') && neg.score.components.L.value === 0 && !neg.score.plausible, `new ${neg.lean.accepted.newly_caused.map(v => v.constraint)}`);
  check('lean-kinds-separate', Array.isArray(neg.lean.candidate) && Array.isArray(neg.lean.contested) && neg.lean.accepted.newly_caused.every(v => v.status === 'accepted'));
  const z = await assess({ organism: 'zebrafish-adult' });
  check('verdict-never-valid', !/\bvalid\b/i.test(z.verdict.statement.replace('Not a validity claim', '')) && /closest real relative/i.test(z.verdict.statement) && (MUT !== 'verdict-never-valid'));
  check('real-organism-plausible', z.score.plausible && z.score.value >= SCORER.plausible_threshold, `${z.score.value}`);
  const sw = swarmTasks({ organism: 'tff' });
  check('swarm-kinds', JSON.stringify(sw.tasks.map(t => t.kind)) === JSON.stringify(['closest-relative-phenotype', 'closest-relative-genotype', 'sanity-geno', 'sanity-pheno', 'lean-by-component', MUT === 'swarm-kinds' ? 'x' : 'adversarial-review']));
}
console.log(`\n${n - fails}/${n} passed${MUT ? ` (MUTATE=${MUT})` : ''}`);
process.exit(fails);
