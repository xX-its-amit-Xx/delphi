#!/usr/bin/env node
// lean-rounds.test: a design re-validated after a new law lands must report it under newly_violated_since.
//
//   node sim-engine/validate/lean-rounds.test.mjs
//
// Every assertion runs against REAL released law sets in lean/registry/lawsets/, not a synthetic fixture, so it
// also fails if the registry's own history stops supporting the case. Nothing here runs Lean or lake, and
// nothing is written to disk.
//
// These assertions FAILED before sim-engine/validate/lean-rounds.mjs existed: validate_design ran one Lean
// round, against whatever law set happened to be current, and reported nothing about whether that was the law
// set the design had been judged under. A design that was valid last week and is not valid today was invisible.
import assert from 'node:assert/strict';
import { leanRounds, lawsetOfDesign, cmpLawset } from './lean-rounds.mjs';

process.env.LEANBIO_REMOTE = 'off';

let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n       ${e.message.split('\n')[0]}`); } };

// A zebrafish adult whose body temperature is above the CTmax it itself commits: perturb-thermal's P1 row
// (the thermal window) says violated, and that law was admitted to the law sets after 1.0.0.
const THERMAL = { taxon: 'Danio rerio', life_stage: 'adult', SL_m: 0.04, mass_kg: 0.0009,
  body_temperature_C: 45, ct_min_C: 6, ct_max_C: 41, sustained_power_W: 0.01 };

await t('a law admitted after the design was made shows up under newly_violated_since', async () => {
  const r = await leanRounds({ design: THERMAL, from: '1.0.0' });
  assert.ok(r.round1.lawset_version === '1.0.0', `round 1 ran against ${r.round1.lawset_version}, not 1.0.0`);
  assert.ok(cmpLawset(r.round2.lawset_version, '1.0.0') > 0, 'round 2 must use a later law set than round 1');
  const hit = r.newly_violated_since.find(v => v.law_id === 'perturb-thermal' && v.constraint === 'P1');
  assert.ok(hit, `newly_violated_since did not name perturb-thermal/P1; it has ${JSON.stringify(r.newly_violated_since.map(v => v.law_id + '/' + v.constraint))}`);
  assert.equal(hit.binding, true, 'the violation must be binding: perturb-thermal is accepted in the current set');
  assert.equal(hit.law_base_change.kind, 'admitted', 'the row must say the law was ADMITTED since, not merely that the design now fails it');
  assert.ok(/did not change, the law base did/.test(hit.why), `the "why" must say the design did not move: got "${hit.why}"`);
  assert.equal(r.verdict_changed, true);
  assert.equal(r.binding_newly_violated_since.length >= 1, true);
});

await t('round 1 reproduces the OLD verdict: the law is simply absent from the law set it was made under', async () => {
  const r = await leanRounds({ design: THERMAL, from: '1.0.0' });
  assert.equal(r.round1.violations.some(v => v.law_id === 'perturb-thermal'), false, 'round 1 must not report a law that law set 1.0.0 does not pin');
  assert.ok(r.round1.excluded.some(e => e.law_id === 'perturb-thermal' && /not in lawset/.test(e.why)),
    'round 1 must say WHY the law is silent (excluded: not in lawset), not merely omit it');
  assert.ok(r.round2.violations.some(v => v.law_id === 'perturb-thermal'), 'round 2 must report it');
});

await t('a law promoted to accepted shows up under newly_binding_since, not newly_violated_since', async () => {
  // Law set 1.5.0 raised perturb-thermal from candidate to accepted. The violation existed in 1.4.0 too; what
  // changed is that it started counting: grey in the Studio under 1.4.0, red under 1.5.0.
  const r = await leanRounds({ design: THERMAL, from: '1.4.0', to: '1.5.0' });
  assert.equal(r.newly_violated_since.length, 0, 'the violation is not new, so newly_violated_since must be empty');
  const hit = r.newly_binding_since.find(v => v.law_id === 'perturb-thermal');
  assert.ok(hit, `newly_binding_since did not name perturb-thermal; it has ${JSON.stringify(r.newly_binding_since.map(v => v.law_id))}`);
  assert.equal(hit.was.status, 'candidate');
  assert.equal(hit.status, 'accepted');
  assert.equal(hit.binding, true);
  assert.equal(r.verdict_changed, true, 'a violation becoming binding IS a change of verdict');
});

await t('both rounds record their law-set version and the time they ran', async () => {
  const r = await leanRounds({ design: THERMAL, from: '1.3.0' });
  for (const [label, x] of [['round1', r.round1], ['round2', r.round2]]) {
    assert.match(x.lawset_version, /^\d+\.\d+\.\d+$/, `${label}.lawset_version`);
    assert.match(x.ran_at, /^\d{4}-\d{2}-\d{2}T.*Z$/, `${label}.ran_at`);
    assert.ok(x.lawset_basis, `${label}.lawset_basis must say where its law set came from`);
  }
  assert.ok(r.law_base_moved.releases_between.length >= 1, 'the report must name the releases between the two rounds');
});

await t('identical law sets are reported as identical BY CONSTRUCTION, never as "nothing has changed"', async () => {
  const r = await leanRounds({ design: THERMAL });
  assert.equal(r.rounds_identical, true);
  assert.equal(r.round1.lawset_basis, 'unknown', 'a raw spec records no law set');
  assert.match(r.round1.lawset_basis_detail, /identical by construction, not by evidence/);
  assert.equal(r.verdict_changed, false);
});

await t('a violation that appears with NO law change is reported apart, as a caller bug', async () => {
  const r = await leanRounds({ design: THERMAL, from: '1.0.0' });
  assert.deepEqual(r.newly_violated_without_a_law_change, [],
    'with the same numbers in both rounds this must be empty; anything here means the two rounds were given different inputs');
});

await t('the law set a design was made under is read off its edits, not guessed', async () => {
  assert.equal(lawsetOfDesign({ edits: [{ lawset_version: '1.2.0' }, { lawset_version: '1.5.0' }, { lawset_version: '1.4.0' }] }).version, '1.5.0',
    'the NEWEST stamped law set is the one the design was last edited under');
  assert.equal(lawsetOfDesign({ edits: [{ lawset_version: '1.2.0' }] }).basis, 'document-edit');
  assert.equal(lawsetOfDesign({ lawset_version: '1.1.0', edits: [] }).basis, 'document-field');
  assert.equal(lawsetOfDesign({ edits: [] }).basis, 'unknown');
  assert.equal(lawsetOfDesign({ edits: [{ lawset_version: '1.2.0' }] }, '1.0.0').basis, 'explicit', 'an explicit round-1 law set wins');
});

await t('validate_design reports BOTH rounds, with the law-set version and timestamp of each', async () => {
  const { VALIDATE_TOOLS } = await import('../tools/validate-tools.mjs');
  const T = Object.fromEntries(VALIDATE_TOOLS.map(x => [x.name, x]));
  const out = await T.validate_design.handler({ organism: 'zebrafish-adult', network: false, made_under_lawset: '1.0.0' });
  const lr = out.result.lean_rounds;
  assert.ok(lr && lr.round1 && lr.round2, 'result.lean_rounds must carry both rounds');
  assert.equal(lr.round1.lawset_version, '1.0.0');
  assert.ok(lr.round2.lawset_version !== '1.0.0');
  assert.ok(Array.isArray(lr.newly_violated_since), 'newly_violated_since must always be present, even when empty');
  assert.ok(out.result.lean_rounds_headline, 'the headline must be lifted out of the report');
  assert.match(out.scope, /round 1 against law set 1\.0\.0/, 'the scope prose must say which law set each round used');
  assert.ok(out.provenance.some(p => p.quantity === 'round 1 law set'), 'both law sets must be in the provenance');
});

console.log(failed ? `\n${failed} assertion(s) failed.` : '\nall assertions passed.');
process.exit(failed ? 1 : 0);
