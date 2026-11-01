// Reconciliation: how a referee's written ruling and the mechanical hard gates combine into ONE verdict.
//
// This file exists so the hard gates cannot be argued away. The language-model referee writes the reasons; this code
// decides what the verdict is allowed to be given the gates. If the referee says PROMOTE and C6 says the law fires on
// a real animal, the verdict is REJECT and the referee's disagreement is recorded, not acted on.
import { nonVacuity, constantsDeclared, consistency, wildType, overlappingAccepted, implicationProbe, knownDispute } from './gates.mjs';
import { requireLock, nowIso } from './lib.mjs';

export const VERDICTS = ['PROMOTE-TO-CANDIDATE', 'NEEDS-WORK', 'REJECT', 'CONTESTED'];

/** Run every hard gate. Pure; no network, no LLM. */
export function runGates(cand, opts = {}) {
  const evidence = opts.evidenceReport || null;
  const C1 = nonVacuity(cand);
  const C2m = constantsDeclared(cand);
  const C5 = consistency(cand);
  const C6 = wildType(cand, opts);
  // C2 has a second half the fetcher owns: a constant whose source does not carry the number is not sourced.
  let C2 = C2m;
  if (evidence && C2m.verdict === 'pass' && evidence.constants?.length) {
    const bad = evidence.constants.filter(c => c.verdict === 'not-in-text' || c.verdict === 'source-unreachable');
    const soft = evidence.constants.filter(c => c.verdict === 'source-exists-text-not-retrievable');
    if (bad.length) C2 = { ...C2m, verdict: 'fail', evidence_half: 'fail', why: `${C2m.why}; but the evidence checker's GET found ${bad.length} constant(s) absent from or unreachable in the cited source: ${bad.map(c => `${c.value} (${c.verdict})`).join(', ')}` };
    else if (soft.length) C2 = { ...C2m, verdict: 'unclear', evidence_half: 'unverified', why: `${C2m.why}; ${soft.length} constant(s) sit in works that are registered but whose text could not be retrieved, so the number is UNVERIFIED in its source (a registered DOI is not evidence that a number is in the paper)` };
    else C2 = { ...C2m, evidence_half: 'pass', why: `${C2m.why}; every constant was found in its cited source by a GET` };
  }
  const disputes = knownDispute(cand);
  return { C1, C2, C5, C6, disputes,
    hard_fail: [['C1', C1], ['C2', C2], ['C6', C6]].filter(([, g]) => g.verdict === 'fail').map(([k]) => k)
      .concat(C5.verdict === 'fail' ? ['C5'] : []),
    contested: C5.verdict === 'contested',
    c1_unclear: C1.verdict === 'unclear',
    dispute_flag: disputes.verdict === 'flag',
    c6_unclear: C6.verdict === 'unclear',
    c2_unclear: C2.verdict === 'unclear',
    c5_unclear: C5.verdict === 'unclear' };
}

/** What a referee's verdict is ALLOWED to be, given the gates. */
export function allowedVerdicts(gates) {
  // CRITERIA.md 1.2.0 precedence: a hard fail outranks a contest. If a real animal violates the candidate in its own
  // scope, the candidate is wrong, which settles any contest against it rather than leaving the question open.
  if (gates.hard_fail.length) return ['REJECT'];
  if (gates.contested) return ['CONTESTED'];
  // C6 unclear (no real animal could test it), C2 unclear (a constant is unverified in its source) and C5 unclear
  // (propose.mjs proved neither a joint witness nor a contradiction) all block promotion: an untested constraint
  // does not get to turn designs dashed.
  // A candidate matching a known open dispute may be CONTESTED (it takes an arm) or fine (it does not): the referee
  // decides which, but it can never be promoted while the match stands unexplained.
  if (gates.dispute_flag) return ['CONTESTED', 'NEEDS-WORK', 'REJECT'];
  if (gates.c6_unclear || gates.c2_unclear || gates.c1_unclear || gates.C5?.verdict === 'unclear') return ['NEEDS-WORK', 'REJECT'];
  return VERDICTS.filter(v => v !== 'CONTESTED');
}

/** Combine. `refereeOut` is the parsed JSON from the referee worker, or null if it failed. */
export function reconcile({ cand, gates, refereeOut, proponentOut = null, criticOut = null, evidenceReport = null, checkerOut = null }) {
  const lock = requireLock();
  const allowed = allowedVerdicts(gates);
  const said = refereeOut?.verdict && VERDICTS.includes(refereeOut.verdict) ? refereeOut.verdict : null;
  const reasons = refereeOut?.criteria || null;
  const hasReasons = reasons && Object.values(reasons).filter(x => x && typeof x.reason === 'string' && x.reason.trim().length > 15).length >= 4;

  let verdict, how;
  if (!said) { verdict = allowed[0] === 'CONTESTED' ? 'CONTESTED' : allowed.includes('NEEDS-WORK') ? 'NEEDS-WORK' : allowed[0]; how = 'the referee worker returned no parseable verdict; the gates decide and the ruling is recorded as unrefereed'; }
  else if (!allowed.includes(said)) { verdict = allowed[0]; how = `the referee said ${said}, which a hard gate forbids (${gates.contested ? 'C5 contested' : gates.hard_fail.length ? gates.hard_fail.join(', ') + ' failed' : 'C6/C2 unclear'}); a hard gate cannot be overturned by an argument, so the verdict is ${verdict} and the referee's view is recorded as a disagreement` ; }
  else if (!hasReasons) { verdict = said === 'PROMOTE-TO-CANDIDATE' ? 'NEEDS-WORK' : said; how = 'the referee gave a verdict without per-criterion reasons, which CRITERIA.md makes invalid; a promotion is downgraded to NEEDS-WORK'; }
  else { verdict = said; how = 'the referee ruled within what the gates allow, with per-criterion reasons'; }

  const soft = {
    C3: reasons?.C3_scope_honest || null,
    C4: reasons?.C4_independent || null,
    C7: reasons?.C7_not_circular || null,
  };
  // A soft fail cannot sit under a promotion, whatever the referee wrote.
  if (verdict === 'PROMOTE-TO-CANDIDATE' && Object.values(soft).some(s => s?.verdict === 'fail')) {
    const which = Object.entries(soft).filter(([, s]) => s?.verdict === 'fail').map(([k]) => k);
    verdict = 'NEEDS-WORK';
    how += `; downgraded because the referee itself marked ${which.join(', ')} as failing, which CRITERIA.md does not allow under a promotion`;
  }

  return {
    law_id: cand.law_id,
    fingerprint: cand.fingerprint,
    decided_at: nowIso(),
    criteria_version: lock.version,
    criteria_sha256: lock.criteria_sha256,
    verdict,
    how_the_verdict_was_reached: how,
    allowed_by_gates: allowed,
    open_disputes: gates.disputes,
    referee_said: said,
    gate_disagreement: said && said !== verdict ? { referee_verdict: said, final_verdict: verdict, referee_note: refereeOut?.gate_disagreement ?? null } : null,
    criteria: {
      C1_binds_something_real: { verdict: gates.C1.verdict, from_gate: true, gate_why: gates.C1.why, referee_reason: reasons?.C1_binds_something_real?.reason ?? null, rejecting_design: gates.C1.rejecting_design ?? null },
      C2_constants_sourced: { verdict: gates.C2.verdict, from_gate: true, gate_why: gates.C2.why, referee_reason: reasons?.C2_constants_sourced?.reason ?? null },
      C3_scope_honest: { verdict: soft.C3?.verdict ?? 'unclear', from_gate: false, referee_reason: soft.C3?.reason ?? 'the referee gave no reason' },
      C4_independent: { verdict: soft.C4?.verdict ?? 'unclear', from_gate: false, referee_reason: soft.C4?.reason ?? 'the referee gave no reason' },
      C5_consistent: { verdict: gates.C5.verdict, from_gate: true, gate_why: gates.C5.why, referee_reason: reasons?.C5_consistent?.reason ?? null },
      C6_wild_type_survives: { verdict: gates.C6.verdict, from_gate: true, gate_why: gates.C6.why, referee_reason: reasons?.C6_wild_type_survives?.reason ?? null,
        evaluated: gates.C6.evaluated, in_scope: gates.C6.in_scope, fired: gates.C6.fired, held: gates.C6.held.map(h => h.organism) },
      C7_not_circular: { verdict: soft.C7?.verdict ?? 'unclear', from_gate: false, referee_reason: soft.C7?.reason ?? 'the referee gave no reason' },
    },
    ruling: refereeOut?.ruling ?? null,
    needs_work: refereeOut?.needs_work ?? [],
    reject_because: verdict === 'REJECT' ? (refereeOut?.reject_because ?? null) || gateReason(gates) : null,
    contested_with: gates.C5.contested_with?.length ? gates.C5.contested_with : (verdict === 'CONTESTED' ? (refereeOut?.contested_with ?? []) : []),
    contest_settled_against_the_candidate: verdict === 'REJECT' && gates.contested
      ? `propose.mjs had this contested with ${(gates.C5.contested_with || []).join(', ') || 'an accepted law'}, but a hard gate fails: the candidate is wrong, so the contest is settled against it rather than left open (CRITERIA.md 1.2.0 precedence)` : null,
    what_a_human_should_check: refereeOut?.what_a_human_should_check ?? null,
    roles: {
      proponent: proponentOut ? { strongest_sentence: proponentOut.strongest_sentence, weakest_point: proponentOut.weakest_point, bound_kind: proponentOut.bound_kind, rules_out: proponentOut.rules_out, scope_supported: proponentOut.scope_supported, independence: proponentOut.independence } : null,
      critic: criticOut ? { worst_attack: criticOut.worst_attack, one_sentence: criticOut.one_sentence, would_allow: criticOut.would_you_let_this_constrain_a_design, attacks: criticOut.attacks } : null,
      evidence_checker: checkerOut ? { all_constants_verified: checkerOut.all_constants_verified, one_sentence: checkerOut.one_sentence, constants: checkerOut.constants, matcher_errors_found: checkerOut.matcher_errors_found } : null,
      evidence_fetch: evidenceReport ? { verdict: evidenceReport.verdict, summary: evidenceReport.summary, method: evidenceReport.method } : null,
    },
  };
}

function gateReason(gates) {
  for (const k of ['C1', 'C2', 'C6']) if (gates[k]?.verdict === 'fail') return `${k}: ${gates[k].why}`;
  if (gates.C5?.verdict === 'fail') return `C5: ${gates.C5.why}`;
  return null;
}

export { overlappingAccepted, implicationProbe };
