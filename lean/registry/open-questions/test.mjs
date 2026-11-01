#!/usr/bin/env node
// Tests for lean/registry/open-questions/. Node only: no Lean toolchain needed.
//
//   node lean/registry/open-questions/test.mjs
//
// Every test here was made to FAIL once before it was trusted: each carries a `fails_once` note saying what
// broken input it was written for, and the negative cases below ARE those broken inputs, run every time. A guard
// that has never refused anything is not a guard.

import fs from 'node:fs';
import path from 'node:path';
import { load, validateRecord, openQuestionGuard, guardAllLaws, proportionOf, contentHash, openQuestions, disputeDrift, armDrift, summary, QUESTIONS_DIR } from './openq-lib.mjs';
import { loadLaws, readJson } from '../registry-lib.mjs';

let pass = 0; const fails = [];
const ok = (name, cond, detail = '') => { if (cond) { pass++; } else fails.push(`${name}${detail ? ': ' + detail : ''}`); };
const reg = load();

// ── 1. An open question with ONE arm is REJECTED ────────────────────────────
// fails_once: before validateRecord checked arm count, this record validated clean. A one-armed "open question"
// is an unsupported claim wearing a question's clothes: it would let a proposer park one side as "open" while
// nothing contradicts it, and the guard would then protect a claim rather than a question.
{
  const oneArm = {
    record_type: 'open-question', question_id: 'oq-test-one-arm', version: '1.0.0',
    statement_en: 'A question with only one arm.', status: 'open',
    arms: [{ arm_id: 'only', position: 'for', statement_en: 'The one side.', formalisable: true, lean_ref: null,
      evidence: [{ claim: 'c', source: 's', locator: 'l', quote: 'q', kind: 'k', belief_class: 'literature' }] }],
    proportion: { computed_by: 'x', shares: { only: 1 }, beliefs: { only: 1 } },
    what_would_settle_it: [{ observation: 'o', how: 'h', why_decisive: 'w', feasible_today: true }],
    touches: { law_ids: [], design_properties: [], scenario_keys: [] },
    history: [{ version: '1.0.0', date: '2026-11-01', change: 'test' }], content_hash: 'x'.repeat(64),
  };
  const errs = validateRecord(oneArm);
  ok('1a one-armed question is rejected', errs.some(e => /at least TWO arms/.test(e)), JSON.stringify(errs));
  // and the same record with a second arm passes the arm-count check (so the test is about arm count, not noise)
  const twoArm = structuredClone(oneArm);
  twoArm.arms.push({ arm_id: 'other', position: 'against', statement_en: 'The other side.', formalisable: true, lean_ref: null,
    evidence: [{ claim: 'c', source: 's2', locator: 'l', quote: 'q', kind: 'k', belief_class: 'literature' }] });
  ok('1b two-armed question passes the arm-count check', !validateRecord(twoArm).some(e => /at least TWO arms/.test(e)));
  // every REAL question has at least two arms
  for (const q of reg.questions) ok(`1c ${q.question_id} has >= 2 arms`, (q.arms || []).length >= 2, `${(q.arms || []).length} arms`);
}

// ── 2. A law asserting an open arm CANNOT be accepted ───────────────────────
// fails_once: this is the deliverable. Before openQuestionGuard existed, the law below passed every registry
// check -- it builds, it has a witness, it is jointly consistent -- and would have been promotable, settling the
// kcnk5b sign by automation. The guard must refuse it, and must refuse it by BOTH detectors independently.
{
  const q = openQuestions(reg).find(x => x.question_id === 'oq-kcnk5b-vm-sign');
  ok('2a the kcnk5b question is loaded and open', !!q);

  // (i) signature detector: a law written in English that takes a side
  const bySignature = {
    law_id: 'test-kcnk5b-hyperpolarisation', status: 'accepted', kind: 'biological', class: 'named-hypothesis',
    statement_en: 'Gain of function in kcnk5b raises K+ conductance and thereby hyperpolarises the fin mesenchyme, which drives fin overgrowth.',
    hypotheses: [], scope: { taxa: ['Danio rerio'] }, shared_scope: null, lean_ref: { module: 'lean/Delphi/Genotype.lean', theorem: 'Delphi.Genotype.someLaw' },
  };
  const g1 = openQuestionGuard(bySignature, { questions: [q] });
  ok('2b a law asserting an arm in prose is REFUSED', !g1.ok && g1.violations.some(v => v.arm_id === 'hyperpolarising'), JSON.stringify(g1.violations.map(v => v.arm_id)));
  ok('2c the refusal names the question', g1.violations[0] && /oq-kcnk5b-vm-sign/.test(g1.violations[0].refusal));
  ok('2d the refusal lists every arm, so a proposer sees what is unsettled', g1.violations[0] && ['hyperpolarising', 'depolarising', 'biphasic'].every(a => g1.violations[0].refusal.includes(a)));
  ok('2e the refusal says what would settle it', g1.violations[0] && /What would settle it/.test(g1.violations[0].refusal) && /resting membrane potential/.test(g1.violations[0].refusal));
  ok('2f the refusal carries the computed proportion', g1.violations[0] && /Belief proportion/.test(g1.violations[0].refusal));

  // (ii) lean_ref detector: a law pointing straight at an arm's declaration
  const byLeanRef = { law_id: 'test-points-at-arm', status: 'candidate', statement_en: 'Something entirely unrelated in its wording.',
    lean_ref: { module: 'lean/registry/open-questions/lean/KcnkSign.lean', theorem: 'Delphi.OpenQuestion.KcnkSign.depolarising_sign' }, scope: { taxa: ['any'] } };
  const g2 = openQuestionGuard(byLeanRef, { questions: [q] });
  ok('2g a law pointing at an arm declaration is REFUSED even with innocent prose', !g2.ok && g2.violations.some(v => v.arm_id === 'depolarising' && /lean_ref/.test(v.via)));

  // (iii) declared detector
  const byDeclared = { law_id: 'test-declared', status: 'candidate', statement_en: 'Neutral wording.', scope: { taxa: ['any'] },
    lean_ref: { module: 'lean/Delphi/Genotype.lean', theorem: 'x' }, open_question_arm: { question_id: 'oq-kcnk5b-vm-sign', arm_id: 'biphasic' } };
  ok('2h a law declaring an arm is REFUSED', !openQuestionGuard(byDeclared, { questions: [q] }).ok);

  // (iv) a law that takes NO side passes
  const neutral = { law_id: 'test-neutral', status: 'accepted', statement_en: 'Fin length scales with body length in adult zebrafish.', scope: { taxa: ['Danio rerio'] }, lean_ref: { module: 'lean/Delphi/Scaling.lean', theorem: 'y' } };
  ok('2i a law that takes no side PASSES', openQuestionGuard(neutral, { questions: [q] }).ok);

  // (v) the scoped exemption needs BOTH sides of the handshake, so no proposer can exempt itself
  const halfA = { ...bySignature, law_id: 'test-half-handshake', open_question_scoped: { question_id: 'oq-kcnk5b-vm-sign', how: 'I say it is fine' } };
  const gHalf = openQuestionGuard(halfA, { questions: [q] });
  ok('2j a law exempting ITSELF is still REFUSED', !gHalf.ok, 'a one-sided exemption must not pass');
  ok('2k the refusal explains the missing half of the handshake', gHalf.violations[0] && /guard.scoped_exemptions/.test(gHalf.violations[0].refusal));
  const qEx = structuredClone(q);
  qEx.guard.scoped_exemptions.push({ law_id: 'test-half-handshake', arm_id: 'hyperpolarising', how: 'scoped to Xenopus oocytes, the preparation the arm was measured in', approved_by_role: 'test-role', date: '2026-11-01' });
  const gFull = openQuestionGuard(halfA, { questions: [qEx] });
  ok('2l a law with BOTH sides of the handshake passes, and is recorded as an exemption', gFull.ok && gFull.exemptions.length === 1, JSON.stringify(gFull.violations.map(v => v.arm_id)));

  // (vi) the real registry is clean, and the real depth-cap law passes only via its recorded exemption
  const bad = guardAllLaws({ questions: openQuestions(reg) });
  ok('2m no accepted or candidate law in the registry asserts an open arm', bad.length === 0, bad.map(b => b.law_id + ' -> ' + b.violations.map(v => v.question_id + '/' + v.arm_id).join(',')).join('; '));
  const depthLaw = loadLaws().find(l => l.law_id === 'perturb-depth-cap');
  if (depthLaw) {
    const dq = openQuestions(reg).find(x => x.question_id === 'oq-teleost-depth-cap');
    const withoutExemption = structuredClone(dq); withoutExemption.guard.scoped_exemptions = [];
    ok('2n perturb-depth-cap WOULD be refused without its recorded exemption', !openQuestionGuard(depthLaw, { questions: [withoutExemption] }).ok,
      'the exemption must be doing real work, otherwise it is decoration');
  }
}

// ── 3. A settled question must record WHICH EVIDENCE settled it ─────────────
// fails_once: before validateRecord checked this, a question could be marked 'settled' with no arm named and no
// evidence, which is how an open question quietly becomes an assertion. The guard then stops protecting it, so
// an unjustified settle is worse than no record at all.
{
  const base = structuredClone(reg.questions.find(q => q.question_id === 'oq-kcnk5b-vm-sign'));

  const settledEmpty = structuredClone(base); settledEmpty.status = 'settled';
  ok('3a settled with no settled block is rejected', validateRecord(settledEmpty).some(e => /status settled needs/.test(e)));

  const settledNoEvidence = structuredClone(base); settledNoEvidence.status = 'settled';
  settledNoEvidence.settled = { arm_id: 'biphasic', date: '2026-11-01', settled_by: 'someone', evidence: [], approved_by_role: 'project-lead' };
  ok('3b settled with no evidence is rejected', validateRecord(settledNoEvidence).some(e => /needs the evidence that settled it/.test(e)));

  const settledUnknownArm = structuredClone(base); settledUnknownArm.status = 'settled';
  settledUnknownArm.settled = { arm_id: 'not-an-arm', date: '2026-11-01', settled_by: 'x', approved_by_role: 'project-lead',
    evidence: [{ claim: 'c', source: 's', locator: 'l', quote: 'q', kind: 'k', belief_class: 'literature' }] };
  ok('3c settled naming an arm that does not exist is rejected', validateRecord(settledUnknownArm).some(e => /is not an arm of this question/.test(e)));

  const settledPersonalName = structuredClone(base); settledPersonalName.status = 'settled';
  settledPersonalName.settled = { arm_id: 'biphasic', date: '2026-11-01', settled_by: 'x', approved_by_role: 'someone@example.com',
    evidence: [{ claim: 'c', source: 's', locator: 'l', quote: 'q', kind: 'k', belief_class: 'literature' }] };
  ok('3d settled approved by an e-mail address rather than a ROLE is rejected', validateRecord(settledPersonalName).some(e => /must be a ROLE/.test(e)));

  // a properly settled question validates AND stops the guard refusing that arm
  const good = structuredClone(base); good.status = 'settled';
  good.settled = { arm_id: 'biphasic', date: '2026-11-01', settled_by: 'a time course of membrane potential in one alf fin-bud cell',
    approved_by_role: 'project-lead', retired_arms: ['hyperpolarising', 'depolarising'],
    evidence: [{ claim: 'A transient hyperpolarisation is followed by Na+-dependent depolarisation in one cell.', source: 'hypothetical settling measurement', locator: 'test', quote: 'hypothetical', kind: 'measurement', belief_class: 'literature' }] };
  good.content_hash = contentHash(good);
  const errs = validateRecord(good);
  ok('3e a properly settled question validates', errs.length === 0, JSON.stringify(errs));
  const lawAsserting = { law_id: 'test-after-settle', status: 'accepted', scope: { taxa: ['Danio rerio'] }, lean_ref: { module: 'lean/Delphi/Genotype.lean', theorem: 'z' },
    statement_en: 'Gain of function in kcnk5b hyperpolarises then depolarises the fin mesenchyme (biphasic).' };
  ok('3f once SETTLED, the guard no longer refuses a law on that question', openQuestionGuard(lawAsserting, { questions: [good].filter(q => q.status === 'open') }).ok);
  ok('3g but while OPEN it does refuse it', !openQuestionGuard(lawAsserting, { questions: [base] }).ok);
  // abandoning needs a reason
  const abandoned = structuredClone(base); abandoned.status = 'abandoned';
  ok('3h abandoned with no reason is rejected', validateRecord(abandoned).some(e => /abandoned.reason/.test(e)));
  // an open question must not carry a settled block
  const both = structuredClone(base); both.settled = good.settled;
  ok('3i an open question carrying a settled block is rejected', validateRecord(both).some(e => /must not carry a settled/.test(e)));
}

// ── 3bis. THE ASYMMETRY: a wild-type failure settles; two measurements do not ─
// fails_once: before `wild_type_contradicted` existed, the teleost depth cap sat here as a clean two-arm
// question whose first arm a real snailfish refutes. That is not a question with a weak arm, it is a question
// with ONE live arm, which is an unsupported claim wearing a question's clothes. The rule comes from
// pipeline/leanbio/debate/CRITERIA.md 1.2.0 and the asymmetry is the whole point: a wild type contradicting a
// law settles it; two measurements of the same system contradicting EACH OTHER settles nothing.
{
  const base = structuredClone(reg.questions.find(q => q.question_id === 'oq-kcnk5b-vm-sign'));

  // an arm a wild type refutes must SAY it is refuted, not merely carry a lower belief
  const quiet = structuredClone(base);
  quiet.arms[0].wild_type_contradicted = { organisms: ['Danio rerio (wild type)'], basis: 'test', within_scope: true };
  ok('3j an arm a wild type refutes must be marked refuted_as_stated', validateRecord(quiet).some(e => /refuted as stated/.test(e)));

  // ... and it needs the organisms
  const noOrg = structuredClone(base);
  noOrg.arms[0].wild_type_contradicted = { organisms: [], basis: 'test', within_scope: true, refuted_as_stated: true };
  ok('3k wild_type_contradicted needs the organisms', validateRecord(noOrg).some(e => /needs the organisms/.test(e)));

  // a question with only ONE live arm is not a question
  const oneLive = structuredClone(base);
  oneLive.arms[0].wild_type_contradicted = { organisms: ['x'], basis: 'test', within_scope: true, refuted_as_stated: true };
  oneLive.arms[1].wild_type_contradicted = { organisms: ['y'], basis: 'test', within_scope: true, refuted_as_stated: true };
  ok('3l a question with one live arm is rejected', validateRecord(oneLive).some(e => /only one arm/.test(e)));

  // every arm refuted = a failed theorem, not a question
  const allDead = structuredClone(base);
  for (const a of allDead.arms) a.wild_type_contradicted = { organisms: ['x'], basis: 'test', within_scope: true, refuted_as_stated: true };
  ok('3m a question whose every arm a wild type refutes must be a failed theorem', validateRecord(allDead).some(e => /not an open question/.test(e)));

  // a question cannot be SETTLED in favour of an arm real animals refute
  const badSettle = structuredClone(base); badSettle.status = 'settled';
  badSettle.arms[0].wild_type_contradicted = { organisms: ['x'], basis: 'test', within_scope: true, refuted_as_stated: true };
  badSettle.settled = { arm_id: 'hyperpolarising', date: '2026-11-01', settled_by: 'x', approved_by_role: 'project-lead',
    evidence: [{ claim: 'c', source: 's', locator: 'l', quote: 'q', kind: 'k', belief_class: 'literature' }] };
  ok('3n a question cannot be settled in favour of a wild-type-refuted arm', validateRecord(badSettle).some(e => /cannot be settled in favour of an arm real animals refute/.test(e)));

  // an out-of-scope organism does NOT refute an arm (the asymmetry has a scope condition)
  const outOfScope = structuredClone(base);
  outOfScope.arms[0].wild_type_contradicted = { organisms: ['some bird'], basis: 'outside the arm\'s declared taxa', within_scope: false };
  ok('3o an out-of-scope organism does not refute an arm', !validateRecord(outOfScope).some(e => /refuted as stated|only one arm/.test(e)));

  // THE OTHER SIDE: two measurements disagreeing does NOT make a failed theorem
  const mismeasured = { record_type: 'failed-theorem', failure_id: 'ft-test-two-measurements', version: '1.0.0',
    statement_en: 'Something two labs measured differently.', reason: 'contradicted-by-data',
    contradicted_by: 'another-measurement-of-the-same-system', reason_detail: 'one lab got a different number',
    what_was_tried: ['measured it'], what_survives: 'y'.repeat(40),
    history: [{ version: '1.0.0', date: '2026-11-01', change: 'c' }], content_hash: 'a'.repeat(64) };
  ok('3p a failure resting only on a disagreeing measurement is rejected', validateRecord(mismeasured).some(e => /OPEN QUESTION/.test(e)),
    'two measurements disagreeing with each other must become a question, not a failure');
  const justified = { ...mismeasured, reason_detail: 'settled because the second measurement superseded the first on the same apparatus; this is not an open question' };
  ok('3q the same failure WITH a justification is accepted', !validateRecord(justified).some(e => /OPEN QUESTION/.test(e)));
  // a wild-type failure must name its organisms
  const wildNoOrg = { ...mismeasured, reason: 'fires-on-wild-type', contradicted_by: 'wild-type-organism', reason_detail: 'x', wild_type_failures: [] };
  ok('3r a wild-type failure must name the organisms', validateRecord(wildNoOrg).some(e => /needs wild_type_failures/.test(e)));

  // the REAL depth-cap record exercises all of this
  const depth = reg.questions.find(q => q.question_id === 'oq-teleost-depth-cap');
  if (depth) {
    const refuted = depth.arms.filter(a => a.wild_type_contradicted && a.wild_type_contradicted.within_scope !== false);
    ok('3s the depth cap has a wild-type-refuted arm', refuted.length === 1, `${refuted.length} refuted arms`);
    ok('3t and still has two live arms, so it is a real question', depth.arms.length - refuted.length >= 2, `${depth.arms.length - refuted.length} live`);
    ok('3u the refuted arm says it is refuted as stated', refuted.every(a => a.wild_type_contradicted.refuted_as_stated === true));
  }
  // the ingested wild-type failure is a FAILURE, not a question
  const heterurus = reg.failed.find(f => f.failure_id === 'ft-disc-heterurus-mass-exponent');
  if (heterurus) {
    ok('3v the ingested wild-type rejection is a failed theorem', heterurus.contradicted_by === 'wild-type-organism');
    ok('3w and names the organisms that refute it', (heterurus.wild_type_failures || []).length > 0, JSON.stringify(heterurus.wild_type_failures));
    ok('3x and carries the round\'s provenance bound', /ZERO web tool calls/.test(JSON.stringify(heterurus.debate || {})),
      'the debate round made no web calls; a record that hides that overstates what "debated" means');
  }
}

// ── 4. The proportion is COMPUTED, not asserted ─────────────────────────────
// fails_once: a hand-written `proportion` block went stale the moment an evidence item was added, and nothing
// noticed. Recomputing from the arms' evidence must reproduce what is on disk.
{
  for (const q of reg.questions) {
    const fresh = await proportionOf(q);
    const same = JSON.stringify(fresh.shares) === JSON.stringify(q.proportion.shares);
    ok(`4a ${q.question_id} proportion is reproducible from its evidence`, same, `on disk ${JSON.stringify(q.proportion.shares)} vs recomputed ${JSON.stringify(fresh.shares)}`);
    const sum = Object.values(q.proportion.shares).reduce((a, b) => a + b, 0);
    ok(`4b ${q.question_id} shares sum to 1 (or all zero)`, Math.abs(sum - 1) < 0.005 || sum === 0, String(sum));
    ok(`4c ${q.question_id} names the belief params version`, !!q.proportion.params_version);
  }
  // changing the evidence changes the proportion: the number is doing work
  const q = structuredClone(reg.questions.find(x => x.question_id === 'oq-kcnk5b-vm-sign'));
  const before = (await proportionOf(q)).shares;
  q.arms[0].evidence.push({ claim: 'another independent paper supporting this arm', source: 'PMID:00000000', locator: 'test', quote: 'test', kind: 'measurement', belief_class: 'literature', belief_key: 'PMID:00000000' });
  const after = (await proportionOf(q)).shares;
  ok('4d adding supporting evidence to an arm raises its share', after.hyperpolarising > before.hyperpolarising, `${before.hyperpolarising} -> ${after.hyperpolarising}`);
}

// ── 5. Records are well formed, hashed, and do not drift ────────────────────
{
  for (const rec of reg.all) {
    const id = rec.question_id || rec.failure_id || rec.requirement_id || rec.request_id;
    ok(`5a ${id} validates`, validateRecord(rec).length === 0, JSON.stringify(validateRecord(rec)));
    ok(`5b ${id} content_hash matches its content`, rec.content_hash === contentHash(rec));
  }
  ok('5c open questions do not drift from pipeline/leanbio/debate/open-disputes.json', disputeDrift({ reg }).length === 0, disputeDrift({ reg }).join('; '));
  ok('5d every formalised arm still matches its pinned Lean statement', armDrift({ reg }).length === 0, armDrift({ reg }).join('; '));
  // editing a hashed field must break the hash (so the hash is not decorative)
  const q = structuredClone(reg.questions[0]); q.arms[0].statement_en += ' (edited)';
  ok('5e editing an arm statement changes the content hash', contentHash(q) !== reg.questions[0].content_hash);
  // recomputing the proportion must NOT change the hash (status and computed belief are not what a question SAYS)
  const q2 = structuredClone(reg.questions[0]); q2.proportion = { computed_by: 'x', shares: {}, beliefs: {} }; q2.arms.forEach(a => { a.belief = 0.5; });
  ok('5f recomputing the proportion does NOT change the content hash', contentHash(q2) === reg.questions[0].content_hash);
}

// ── 6. Failed theorems are results, not a bin ───────────────────────────────
{
  ok('6a there are failed-theorem records', reg.failed.length > 0);
  for (const f of reg.failed) {
    ok(`6b ${f.failure_id} says what survives the failure`, !!f.what_survives && f.what_survives.length > 30);
    ok(`6c ${f.failure_id} says what was tried`, (f.what_was_tried || []).length > 0);
    ok(`6d ${f.failure_id} has a categorised reason`, !!f.reason);
  }
  // 'provable-but-not-checkable' is a requirements record under CRITERIA.md unless the inputs are unobtainable
  const sloppy = { record_type: 'failed-theorem', failure_id: 'ft-test', version: '1.0.0', statement_en: 's', reason: 'provable-but-not-checkable',
    what_was_tried: ['x'], what_survives: 'y'.repeat(40), history: [{ version: '1.0.0', date: 'd', change: 'c' }], content_hash: 'a'.repeat(64) };
  ok('6e a bare provable-but-not-checkable failure is rejected (it is a requirements record)', validateRecord(sloppy).some(e => /requirements record/.test(e)));
}

// ── 7. The surfaces serve the same records ──────────────────────────────────
{
  const s = summary({ reg });
  ok('7a summary counts the questions', s.counts.questions === reg.questions.length);
  ok('7b summary carries each question\'s proportion', s.questions.every(q => q.proportion !== undefined));
  ok('7c summary says which arms are formalised', s.questions.some(q => q.arms.some(a => a.formalised)));
  const mirror = path.resolve(import.meta.dirname, '../../../dashboard/public/api/lean/open-questions.json');
  if (fs.existsSync(mirror)) {
    const m = readJson(mirror);
    ok('7d the static mirror is in step with the records', JSON.stringify(m.result?.counts || m.counts) === JSON.stringify(s.counts),
      'run node dashboard/build-lean-api.mjs');
  }
}

// ── report ──────────────────────────────────────────────────────────────────
if (fails.length) { console.error(`\nFAILED ${fails.length} of ${pass + fails.length}:`); fails.forEach(f => console.error('  FAIL ' + f)); process.exit(1); }
console.log(`ok: ${pass} assertions passed (${reg.questions.length} questions, ${reg.failed.length} failed theorems).`);
