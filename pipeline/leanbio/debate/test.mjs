#!/usr/bin/env node
// Tests for the debate. Every check is run twice: once on input it must REJECT, once on input it must ACCEPT, so a
// check that always says "reject" fails the suite. `--mutate` then breaks each gate on purpose and asserts the suite
// NOTICES - a test that cannot fail is not a test.
//
//   node pipeline/leanbio/debate/test.mjs
//   node pipeline/leanbio/debate/test.mjs --mutate
//
// No network and no worker invocation: the gates are pure, and that is the point. The language-model roles supply
// reasons; these three criteria are decided by code precisely so they can be tested.
import fs from 'node:fs';
import { D, readJson, evalAtoms, evalAtom, statementConstants, inScope, touchesHoldout, criteriaHash, requireLock } from './lib.mjs';
import { nonVacuity, constantsDeclared, consistency, wildType } from './gates.mjs';
import { runGates, reconcile, allowedVerdicts } from './referee.mjs';
import { findNumber, parseSource, numberForms } from './evidence.mjs';
import { constantsOf, statementText, normalise } from './candidates.mjs';
import { autoAcceptState, config } from './promote.mjs';

const MUTATE = process.argv.includes('--mutate');
let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${note ? ' :: ' + note : ''}`); } };
const section = s => console.log(`\n${s}`);

// ---------------------------------------------------------------- fixtures
const SOURCED = 'physics/glide-data.csv (sha256 bc24245b5163723b), Park and Choi 2010 Table 1';

/** A real, well-formed candidate: the measured flying-fish wing-loading band. The positive control for all three
 *  rejection tests - if the suite rejects this too, the criteria reject everything and mean nothing. */
const GOOD = {
  law_id: 'test-good-wing-loading-band',
  statement_en: 'Every measured flying-fish specimen in the project has wing loading between 37.025 and 46.375 N/m^2 (n = 4).',
  lean: { structure: 'Test.WingLoadingBand', witness: 'Test.witness', statement_text: 'structure WingLoadingBand where\n  wingLoading : ℝ\n  lo : 37.025 ≤ wingLoading\n  hi : wingLoading ≤ 46.375' },
  shared_scope: { atoms: ['37.025 ≤ q.wingLoading', 'q.wingLoading ≤ 46.375'], quantities: { wingLoading: { unit: 'N/m^2' } }, witness_values: { wingLoading: '41.7' } },
  scope: { taxa: ['Exocoetidae'], life_stages: [], ranges: {} },
  constants: [{ value: '37.025', unit: 'N/m^2', kind: 'derived', source: SOURCED }, { value: '46.375', unit: 'N/m^2', kind: 'derived', source: SOURCED }],
  propose_status: 'candidate', evidence: {}, sources: [SOURCED],
};

/** Vacuous: a square is non-negative for every real, so no assignment of its quantities makes it false. It is a
 *  theorem; it is not a law, because it would never turn a design dashed. */
const VACUOUS = {
  ...GOOD, law_id: 'test-vacuous-square',
  statement_en: 'For every organism, the square of its body mass is non-negative.',
  lean: { structure: 'Test.Vacuous', witness: 'Test.witness', statement_text: 'structure Vacuous where\n  bodyMass : ℝ\n  nonneg : bodyMass * bodyMass ≥ 0' },
  shared_scope: { atoms: ['q.bodyMass * q.bodyMass ≥ 0'], quantities: { bodyMass: { unit: 'kg' } }, witness_values: { bodyMass: '0.06' } },
  constants: [],
};

/** An unsourced constant: the number is in the statement, but its provenance kind is `assumed` - a placeholder
 *  chosen by whoever wrote the law, not a measurement. A second one names no source at all. */
const UNSOURCED = {
  ...GOOD, law_id: 'test-unsourced-constant',
  statement_en: 'No flying fish exceeds a wing loading of 52.4 N/m^2 (a round number we picked).',
  lean: { structure: 'Test.Unsourced', witness: 'Test.witness', statement_text: 'structure Unsourced where\n  wingLoading : ℝ\n  cap : wingLoading ≤ 52.4' },
  shared_scope: { atoms: ['q.wingLoading ≤ 52.4'], quantities: { wingLoading: { unit: 'N/m^2' } }, witness_values: { wingLoading: '41.7' } },
  constants: [{ value: '52.4', unit: 'N/m^2', kind: 'assumed', source: 'chosen so the model matches the four specimens' }],
};
const NO_SOURCE_AT_ALL = {
  ...UNSOURCED, law_id: 'test-constant-with-no-source',
  constants: [{ value: '52.4', unit: 'N/m^2', kind: 'measured', source: null }],
};
const UNDECLARED = { ...UNSOURCED, law_id: 'test-undeclared-constant', constants: [] };

/** Fires on a wild-type organism: real Cypselurus hiraii specimens measure 37.0 to 46.4 N/m^2, so a law capping
 *  flying fish at 30 N/m^2 is contradicted by four real animals inside its own declared scope. */
const FIRES = {
  ...GOOD, law_id: 'test-fires-on-wild-type',
  statement_en: 'No flying fish has a wing loading above 30 N/m^2.',
  lean: { structure: 'Test.Fires', witness: 'Test.witness', statement_text: 'structure Fires where\n  wingLoading : ℝ\n  cap : wingLoading ≤ 30.0' },
  shared_scope: { atoms: ['q.wingLoading ≤ 30.0'], quantities: { wingLoading: { unit: 'N/m^2' } }, witness_values: { wingLoading: '25.0' } },
  constants: [{ value: '30.0', unit: 'N/m^2', kind: 'derived', source: SOURCED }],
};

/** Out of scope for every wild-type organism we hold: C6 cannot be evaluated, so the law may reach NEEDS-WORK and
 *  never PROMOTE. This is the honest-ignorance case, and it must not read as a pass. */
const UNTESTABLE = {
  ...GOOD, law_id: 'test-no-wild-type-in-scope',
  scope: { taxa: ['Cephalopoda'], life_stages: [], ranges: {} },
};

// ---------------------------------------------------------------- the mutants (--mutate)
// Each mutant is a plausible WEAKENING of a gate. The suite must notice every one.
// `hard_fail` is derived from the gate verdicts, so a mutant must re-derive it or it is not really weakening the gate.
const rederive = g => ({ ...g, hard_fail: ['C1', 'C2', 'C6', 'C5'].filter(k => g[k]?.verdict === 'fail'),
  c6_unclear: g.C6?.verdict === 'unclear', c2_unclear: g.C2?.verdict === 'unclear' });
const MUTANTS = {
  'C1 accepts a tautology (the rejecting-design search is skipped)': g => rederive({ ...g, C1: { ...g.C1, verdict: 'pass', why: 'MUTANT' } }),
  'C2 accepts an assumed constant': g => rederive({ ...g, C2: { ...g.C2, verdict: 'pass', why: 'MUTANT' } }),
  'C6 reports out-of-scope instead of firing': g => rederive({ ...g, C6: { ...g.C6, verdict: 'pass', fired: [], why: 'MUTANT' } }),
  'the hard-fail list is dropped': g => ({ ...g, hard_fail: [], c6_unclear: false, c2_unclear: false }),
};

function verdictFor(cand, mutate = null) {
  let gates = runGates(cand, {});
  if (mutate) gates = mutate(gates);
  // A referee that argues for promotion every single time: the reconciliation must not let it through.
  const refereeAlwaysPromotes = {
    role: 'referee', law_id: cand.law_id, verdict: 'PROMOTE-TO-CANDIDATE',
    criteria: Object.fromEntries(['C1_binds_something_real', 'C2_constants_sourced', 'C3_scope_honest', 'C4_independent', 'C5_consistent', 'C6_wild_type_survives', 'C7_not_circular']
      .map(k => [k, { verdict: 'pass', reason: 'a referee that waves everything through, used by the test suite to prove the gates bind' }])),
    ruling: 'promote it, it looks fine to me', needs_work: [],
  };
  return reconcile({ cand, gates, refereeOut: refereeAlwaysPromotes });
}

// ---------------------------------------------------------------- 1. the criteria are fixed and hashed
section('the criteria lock');
{
  const lock = requireLock();
  ok('CRITERIA.md hashes to criteria.lock.json', lock.criteria_sha256 === criteriaHash());
  ok('the lock records that it was cut before any debate ran', lock.locked_before_any_debate === true, JSON.stringify(lock.locked_before_any_debate));
  // the check must fail on a changed file
  const real = fs.readFileSync(D('CRITERIA.md'), 'utf8');
  try {
    fs.writeFileSync(D('CRITERIA.md'), real + '\n<!-- a criterion someone slipped in after the fact -->\n');
    let threw = false;
    try { requireLock(); } catch { threw = true; }
    ok('requireLock() refuses when CRITERIA.md changed under the lock', threw);
  } finally { fs.writeFileSync(D('CRITERIA.md'), real); }
  ok('the lock passes again once the file is restored', requireLock().criteria_sha256 === criteriaHash());
}

// ---------------------------------------------------------------- 2. THE THREE REQUIRED REJECTIONS
section('a deliberately vacuous law must be rejected (C1)');
{
  const r = verdictFor(VACUOUS);
  ok('verdict is REJECT', r.verdict === 'REJECT', r.verdict);
  ok('C1 is the gate that failed', r.criteria.C1_binds_something_real.verdict === 'fail', JSON.stringify(r.criteria.C1_binds_something_real));
  ok('the reason says no assignment makes it false', /tautology|no assignment/i.test(r.criteria.C1_binds_something_real.gate_why), r.criteria.C1_binds_something_real.gate_why);
  ok('a referee voting PROMOTE did not change it', r.gate_disagreement?.referee_verdict === 'PROMOTE-TO-CANDIDATE' && r.verdict === 'REJECT');
  // the same check must NOT reject the real law
  const g = verdictFor(GOOD);
  ok('the same check passes C1 on the real wing-loading band', g.criteria.C1_binds_something_real.verdict === 'pass', g.criteria.C1_binds_something_real.gate_why);
  ok('and it names the design the real law rejects', !!g.criteria.C1_binds_something_real.rejecting_design, JSON.stringify(g.criteria.C1_binds_something_real.rejecting_design));
}

section('a law with an unsourced constant must be rejected (C2)');
{
  for (const [name, fx, want] of [['kind: assumed', UNSOURCED, /assumed|placeholder/i], ['no source string', NO_SOURCE_AT_ALL, /no retrievable source/i], ['not declared at all', UNDECLARED, /not in meta.constants|no provenance/i]]) {
    const r = verdictFor(fx);
    ok(`verdict is REJECT (${name})`, r.verdict === 'REJECT', r.verdict);
    ok(`C2 is the gate that failed (${name})`, r.criteria.C2_constants_sourced.verdict === 'fail', JSON.stringify(r.criteria.C2_constants_sourced));
    ok(`the reason names the defect (${name})`, want.test(r.criteria.C2_constants_sourced.gate_why), r.criteria.C2_constants_sourced.gate_why);
  }
  const g = verdictFor(GOOD);
  ok('the same check passes C2 when both constants are derived and sourced', g.criteria.C2_constants_sourced.verdict === 'pass', g.criteria.C2_constants_sourced.gate_why);
  // and the evidence half: a constant the GET did not find in its source fails C2 too
  const gates = runGates(GOOD, { evidenceReport: { constants: [{ value: '37.025', verdict: 'not-in-text' }, { value: '46.375', verdict: 'found' }], summary: {} } });
  ok('a constant absent from its cited source fails C2 even when declared', gates.C2.verdict === 'fail', gates.C2.why);
  const gates2 = runGates(GOOD, { evidenceReport: { constants: [{ value: '37.025', verdict: 'found' }, { value: '46.375', verdict: 'found' }], summary: {} } });
  ok('and passes when the GET found both', gates2.C2.verdict === 'pass', gates2.C2.why);
}

section('a law that fires on a wild-type organism must be rejected (C6)');
{
  const r = verdictFor(FIRES);
  ok('verdict is REJECT', r.verdict === 'REJECT', r.verdict);
  ok('C6 is the gate that failed', r.criteria.C6_wild_type_survives.verdict === 'fail', JSON.stringify(r.criteria.C6_wild_type_survives));
  ok('the ruling names a real animal and its numbers', /Cypselurus|Cheilopogon|Hirundichthys/.test(r.criteria.C6_wild_type_survives.gate_why), r.criteria.C6_wild_type_survives.gate_why);
  ok('the firing organisms are recorded with their source', (r.criteria.C6_wild_type_survives.fired || []).every(f => f.source && f.locator), JSON.stringify(r.criteria.C6_wild_type_survives.fired?.[0]));
  const g = verdictFor(GOOD);
  ok('the same check passes C6 on the real band (it holds for every in-scope specimen)', g.criteria.C6_wild_type_survives.verdict === 'pass', g.criteria.C6_wild_type_survives.gate_why);
  ok('and it says how many real animals it was evaluated against', g.criteria.C6_wild_type_survives.evaluated >= 4, String(g.criteria.C6_wild_type_survives.evaluated));
  // a specimen whose fins were folded is not a lifting configuration and must not be used to refute a wing loading
  // Regression: a law with no atoms once collected a free C6 `pass`, because every in-scope organism counted as
  // evaluated and nothing could fire. A vacuous pass is the one outcome C6 must never produce.
  {
    const noAtoms = { ...GOOD, law_id: 'test-c6-no-atoms', shared_scope: { atoms: [], quantities: {}, witness_values: {} } };
    const c6 = wildType(noAtoms, {});
    ok('C6 on a law with no atoms is unclear, never pass', c6.verdict === 'unclear', c6.verdict + ': ' + c6.why);
    ok('and the reason says it is untested rather than satisfied', /untested, not satisfied/.test(c6.why), c6.why);
  }
  const w = wildType(GOOD, {});
  ok('a fins-folded specimen is excluded from an area-derived check, with the reason recorded', w.skipped.some(s => /fins folded/i.test(s.why || '')), JSON.stringify(w.skipped.slice(0, 2)));
}

// ---------------------------------------------------------------- 3. the untestable case is not a pass
section('a law no real animal can test may not be promoted');
{
  const r = verdictFor(UNTESTABLE);
  ok('verdict is NEEDS-WORK, not PROMOTE', r.verdict === 'NEEDS-WORK', r.verdict);
  ok('C6 is unclear, not pass', r.criteria.C6_wild_type_survives.verdict === 'unclear', r.criteria.C6_wild_type_survives.verdict);
  ok('allowedVerdicts excludes PROMOTE when C6 is unclear', !allowedVerdicts(runGates(UNTESTABLE, {})).includes('PROMOTE-TO-CANDIDATE'));
}

// ---------------------------------------------------------------- 4. the gates bind the referee
section('a hard gate cannot be argued away');
{
  for (const [name, fx] of [['vacuous', VACUOUS], ['unsourced', UNSOURCED], ['fires on a wild type', FIRES]]) {
    const r = verdictFor(fx);
    ok(`a PROMOTE vote is recorded as a disagreement, not acted on (${name})`, r.verdict === 'REJECT' && r.gate_disagreement && /hard gate/i.test(r.how_the_verdict_was_reached), r.how_the_verdict_was_reached);
  }
  // a referee with no reasons cannot promote
  const gates = runGates(GOOD, { evidenceReport: { constants: GOOD.constants.map(c => ({ value: c.value, verdict: 'found' })), summary: {} } });
  const bare = reconcile({ cand: GOOD, gates, refereeOut: { verdict: 'PROMOTE-TO-CANDIDATE', criteria: {} } });
  ok('a verdict with no per-criterion reasons is downgraded to NEEDS-WORK', bare.verdict === 'NEEDS-WORK', bare.how_the_verdict_was_reached);
  // a referee that fails a soft criterion cannot promote either
  const softFail = reconcile({ cand: GOOD, gates, refereeOut: { verdict: 'PROMOTE-TO-CANDIDATE',
    criteria: Object.fromEntries(['C1_binds_something_real', 'C2_constants_sourced', 'C3_scope_honest', 'C4_independent', 'C5_consistent', 'C6_wild_type_survives', 'C7_not_circular']
      .map(k => [k, { verdict: k === 'C3_scope_honest' ? 'fail' : 'pass', reason: 'a reason long enough to count as one for the purposes of this test' }])) } });
  ok('a soft criterion the referee itself failed blocks promotion', softFail.verdict === 'NEEDS-WORK', softFail.how_the_verdict_was_reached);
  // and the real law, refereed properly, DOES promote - otherwise nothing could ever pass
  const good = reconcile({ cand: GOOD, gates, refereeOut: { verdict: 'PROMOTE-TO-CANDIDATE',
    criteria: Object.fromEntries(['C1_binds_something_real', 'C2_constants_sourced', 'C3_scope_honest', 'C4_independent', 'C5_consistent', 'C6_wild_type_survives', 'C7_not_circular']
      .map(k => [k, { verdict: 'pass', reason: 'a reason long enough to count as one for the purposes of this test' }])), ruling: 'promote' } });
  ok('a clean law with a reasoned ruling reaches PROMOTE-TO-CANDIDATE', good.verdict === 'PROMOTE-TO-CANDIDATE', good.how_the_verdict_was_reached);
}

// ---------------------------------------------------------------- 5. consistency and contestation
section('C5: consistency with the accepted set');
{
  ok('a contested candidate gets CONTESTED, not REJECT', verdictFor({ ...GOOD, law_id: 'test-contested', propose_status: 'contested', contested_with: ['perturb-depth-cap'] }).verdict === 'CONTESTED');
  ok('a `proposed` candidate (no joint witness proved) cannot be promoted', !allowedVerdicts(runGates({ ...GOOD, propose_status: 'proposed' }, {})).includes('PROMOTE-TO-CANDIDATE'));
  ok('an unknown propose status is unclear, not a fail', consistency({ propose_status: 'something-else' }).verdict === 'unclear');
  // Regression: a MISSING status was reported as `fail`, which made a REJECT out of a law whose board task had not
  // been posted yet. A metadata gap must not read as a scientific verdict.
  ok('a MISSING propose status is unclear, not a fail', consistency({}).verdict === 'unclear', consistency({}).why);
  ok('and it says the gap is metadata, not an inconsistency', /metadata gap, not an inconsistency/.test(consistency({}).why));
  ok('a status propose.mjs already refused is a fail', consistency({ propose_status: 'rejected' }).verdict === 'fail');
  ok('a missing status still blocks promotion', !allowedVerdicts(runGates({ ...GOOD, propose_status: null }, {})).includes('PROMOTE-TO-CANDIDATE'));
}

// ---------------------------------------------------------------- 6. nothing is accepted automatically
section('the automation stops at candidate');
{
  const st = autoAcceptState();
  ok('auto-accept is OFF by default', st.enabled === false, st.why);
  ok('config.auto_accept_on_debate_pass is false', config().auto_accept_on_debate_pass === false);
  // the flag refuses to take effect without a recorded decision
  const saved = fs.existsSync(D('config.json')) ? fs.readFileSync(D('config.json'), 'utf8') : null;
  try {
    fs.writeFileSync(D('config.json'), JSON.stringify({ ...config(), auto_accept_on_debate_pass: true, auto_accept_decision: null }, null, 1));
    ok('setting the flag true with no recorded decision does NOT enable it', autoAcceptState().enabled === false, autoAcceptState().why);
    fs.writeFileSync(D('config.json'), JSON.stringify({ ...config(), auto_accept_on_debate_pass: true, auto_accept_decision: { by: 'human:project-lead', date: '2026-11-01', where_recorded: 'decisions/example.md' } }, null, 1));
    ok('with a recorded decision it does enable (so the flag is real, not decoration)', autoAcceptState().enabled === true, autoAcceptState().why);
    fs.writeFileSync(D('config.json'), JSON.stringify({ ...config(), auto_accept_on_debate_pass: true, auto_accept_decision: { by: 'amit', date: '2026-11-01', where_recorded: 'x' } }, null, 1));
    ok('a personal identifier instead of a human role does not enable it', autoAcceptState().enabled === false, autoAcceptState().why);
  } finally { if (saved != null) fs.writeFileSync(D('config.json'), saved); else fs.unlinkSync(D('config.json')); }
  const { approve } = await import('./promote.mjs');
  let threw = null;
  try { await approve('test-good-wing-loading-band', { by: 'agent:law-critic' }); } catch (e) { threw = e.message; }
  ok('approve refuses an agent role', /must be a human role/i.test(threw || ''), threw || 'it did not refuse');
  threw = null;
  try { await approve('a-law-nobody-queued', { by: 'human:project-lead' }); } catch (e) { threw = e.message; }
  ok('approve refuses a law that is not in the queue', /no promotion request/i.test(threw || ''), threw || 'it did not refuse');
}

// ---------------------------------------------------------------- 7. the pieces the gates rest on
section('the atom evaluator, the constant finder and the holdout guard');
{
  ok('a chained Lean inequality evaluates', evalAtom('37.025 ≤ q.wingLoading', { wingLoading: 41.7 }) === true);
  ok('a false atom is false, not null', evalAtom('q.wingLoading ≤ 30', { wingLoading: 41.7 }) === false);
  ok('a missing quantity is null, not false', evalAtom('q.wingLoading ≤ 30', {}) === null);
  ok('Lean syntax the evaluator does not know is null, never a pass', evalAtom('∀ x, q.mass ≤ x', { mass: 1 }) === null);
  ok('a conjunction with one unknown atom cannot-evaluate', evalAtoms(['q.a ≤ 1', '∑ q.b ≤ 2'], { a: 0.5, b: 1 }).verdict === 'cannot-evaluate');
  ok('structural literals are not treated as empirical constants', !statementConstants('wingLoading ≤ 1 ∧ mass ≥ 0').length);
  ok('a real constant is found', statementConstants('37.025 ≤ wingLoading').includes('37.025'));
  ok('scope: a species is inside its family', inScope('Cypselurus hiraii', { taxa: ['Exocoetidae'] }));
  ok('scope: a bat is not inside Exocoetidae', !inScope('Plecotus auritus', { taxa: ['Exocoetidae'] }));
  ok('scope: an empty taxa list matches everything (C3 judges whether that is honest)', inScope('Danio rerio', { taxa: [] }));
  ok('the holdout guard catches the clade name', !!touchesHoldout('wing loading in Aves'));
  ok('the holdout guard catches a common name', !!touchesHoldout('measured in a pigeon'));
  ok('the holdout guard passes a fish', !touchesHoldout('Cypselurus hiraii wing loading'));
  ok('normalise() withholds a candidate that touches the holdout', normalise({ meta: { law_id: 'x', statement_en: 'birds glide', lean: {} } }).withheld === true);
  ok('the wild-type dossier contains no bird', !touchesHoldout(JSON.stringify(readJson(D('wildtype.json')).organisms)));
  ok('number forms include a rounding a paper might print', numberForms(37.025).some(f => f.form === '37.03'));
  ok('the matcher does not match inside a longer number', !findNumber(3.011, 'the value 13.0115 appears', 't').found);
  ok('parseSource finds a DOI', parseSource('doi:10.1016/j.cub.2021.08.054 Data S1').doi === '10.1016/j.cub.2021.08.054');
  // Regression: the first real run reported a cited file hash as mismatched because the checker normalised CRLF to
  // LF before hashing. The repository's provenance strings hash the RAW BYTES, so a declared hash must match either
  // form. Two referees wrote a needs-work item on the strength of that bug; this test is why it cannot recur.
  {
    const { repoFile } = await import('./evidence.mjs');
    const r = repoFile('genotype/cache/daane2021_data_s1A_fin_measurements.csv', '9c941299f5869e56');
    if (r.exists) {
      ok('a declared file hash over the RAW BYTES verifies', r.hash_ok === true, JSON.stringify({ declared: r.declared_hash, raw: r.sha256_raw_bytes, lf: r.sha256_lf_normalised }));
      ok('and the report says which form matched', r.hash_matched === 'raw bytes', String(r.hash_matched));
      ok('a wrong hash still fails', repoFile('genotype/cache/daane2021_data_s1A_fin_measurements.csv', 'deadbeefdeadbeef').hash_ok === false);
    } else { ok('the cited cache file is present to check the hash against', false, 'the file is missing'); }
  }
  ok('parseSource finds a repo file and its hash', parseSource(SOURCED).repo === 'physics/glide-data.csv' && parseSource(SOURCED).hash === 'bc24245b5163723b');
  ok('constantsOf infers a kind and says it inferred it', constantsOf({ shared_scope: { atoms: ['37.025 ≤ q.w'] }, sources: [SOURCED], evidence: { support: { values_N_m2: [37.026] } } }, '').every(c => c.kind_inferred === true));
  ok('statementText pulls a structure body out of Lean source', /wingLoading/.test(statementText('structure Band where\n  wingLoading : ℝ\n  lo : 37.0 ≤ wingLoading\n\n', 'Band') || ''));
}

// ---------------------------------------------------------------- 8. --mutate: the suite must notice a weakened gate
if (MUTATE) {
  section('--mutate: every weakened gate must be caught');
  const cases = [['vacuous', VACUOUS, 'C1 accepts a tautology (the rejecting-design search is skipped)'],
    ['unsourced', UNSOURCED, 'C2 accepts an assumed constant'],
    ['fires on a wild type', FIRES, 'C6 reports out-of-scope instead of firing']];
  for (const [name, fx, mutantName] of cases) {
    const r = verdictFor(fx, MUTANTS[mutantName]);
    ok(`mutant "${mutantName}" lets ${name} through, so the real gate is what rejects it`, r.verdict !== 'REJECT', `mutant still gave ${r.verdict}, so this test would pass even with the gate broken`);
  }
  for (const [name, fx] of cases.map(c => [c[0], c[1]])) {
    const r = verdictFor(fx, MUTANTS['the hard-fail list is dropped']);
    ok(`dropping the hard-fail list lets ${name} through`, r.verdict !== 'REJECT', `still ${r.verdict}`);
  }
}

// ---------------------------------------------------------------- 9. the queue -> approve path, end to end
section('the promotion queue and the one-command approval, end to end');
{
  // A real queue file would be the project's; this runs against a throwaway copy so the test never touches it.
  const realQueue = D('queue', 'promotion-queue.jsonl');
  const backup = fs.existsSync(realQueue) ? fs.readFileSync(realQueue, 'utf8') : null;
  try {
    if (backup != null) fs.unlinkSync(realQueue);
    const { requestPromotion, queue, approve, refuse } = await import('./promote.mjs');
    const gates = runGates(GOOD, { evidenceReport: { constants: GOOD.constants.map(c => ({ value: c.value, verdict: 'found' })), summary: {} } });
    const reasons = Object.fromEntries(['C1_binds_something_real', 'C2_constants_sourced', 'C3_scope_honest', 'C4_independent', 'C5_consistent', 'C6_wild_type_survives', 'C7_not_circular']
      .map(k => [k, { verdict: 'pass', reason: 'a reason long enough to count as one for the purposes of this test' }]));
    const ruling = reconcile({ cand: GOOD, gates, refereeOut: { verdict: 'PROMOTE-TO-CANDIDATE', ruling: 'a reasoned ruling for the test', criteria: reasons, what_a_human_should_check: 'the n of 4' } });
    ok('the fixture law reaches PROMOTE-TO-CANDIDATE', ruling.verdict === 'PROMOTE-TO-CANDIDATE', ruling.verdict);
    requestPromotion({ ruling, registry: { written: false, why: 'the test does not write the registry' } });
    const row = queue().find(q => q.law_id === GOOD.law_id);
    ok('a promotion request is queued awaiting a human', row && row.status === 'awaiting-human', JSON.stringify(row && row.status));
    ok('the queued request carries the written ruling and the criteria hash', !!(row.ruling && row.ruling.ruling) && row.criteria_sha256 === requireLock().criteria_sha256);
    ok('the request names the consequence it asks a human to accept', /turn designs RED/.test(row.history[0].asks), row.history[0].asks);
    let threw = null;
    try { await approve(GOOD.law_id, { by: 'human:project-lead', dryRun: true }); } catch (e) { threw = e.message; }
    ok('approve refuses a law that is not in the registry (so nothing was written behind the registry)', /not in the registry/.test(threw || ''), threw || 'it did not refuse');
    const ref = refuse(GOOD.law_id, { by: 'human:project-lead', why: 'the test refuses it so nothing is left pending' });
    ok('refuse records a human decision with a reason', ref.refused === true && queue().find(q => q.law_id === GOOD.law_id).status === 'refused');
    let t2 = null;
    try { refuse(GOOD.law_id, { by: 'human:project-lead' }); } catch (e) { t2 = e.message; }
    ok('refuse without a reason is rejected', /--why is required/.test(t2 || ''), t2 || 'it did not refuse');
  } finally {
    if (backup != null) fs.writeFileSync(realQueue, backup);
    else if (fs.existsSync(realQueue)) fs.unlinkSync(realQueue);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
