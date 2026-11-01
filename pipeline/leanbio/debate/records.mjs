// A rejection is a result, not a bin (Amit, 2026-11-01). Every ruling emits ONE record into out/records/, in a flat
// shape another agent owns the schema for: `lean/registry/open-questions/` reads this directory and writes its own
// versioned entries. This file deliberately does NOT write into lean/registry/: that folder belongs to the
// open-questions agent and to propose.mjs, and two writers would race.
//
//   failed-theorem            the statement is settled and wrong or unsupported (vacuous, unsourced, fires on a wild type)
//   open-question             the evidence points BOTH ways: an arm per side, neither promotable while it is open
//   candidate-with-requirements  NEEDS-WORK: the referee's list of what would make it promotable travels with the law
//   promotion-request         PROMOTE-TO-CANDIDATE: already in the registry as `candidate`, queued for a human
import fs from 'node:fs';
import { D, writeJson, nowIso } from './lib.mjs';

export const RECORDS_DIR = D('out', 'records');

/** Which record type a ruling becomes, and why. The distinction the criteria already draw is reused, not re-judged. */
export function classify(ruling, cand) {
  const c = ruling.criteria;
  const bothWays = [];
  if (ruling.verdict === 'CONTESTED') bothWays.push(`propose.mjs or the dispute list puts this against ${(ruling.contested_with || []).join(', ') || 'an accepted law'}`);
  for (const h of ruling.open_disputes?.hits || []) bothWays.push(`it touches the open dispute ${h.id}: ${h.question}`);
  // a sourced counter-measurement from the critic that the proponent's own source contradicts is evidence both ways
  const fires = ruling.roles?.critic?.attacks?.find(a => a.attack === 'fires-on-real-organism');
  if (fires && ['fatal', 'serious'].includes(fires.verdict) && fires.source && fires.confidence === 'high' && c.C6_wild_type_survives.verdict !== 'fail') {
    bothWays.push(`the critic produced a sourced counter-measurement (${fires.organism}, ${fires.source}) that the repository's own wild-type data does not reproduce, so the two sources disagree`);
  }

  if (bothWays.length && ruling.verdict !== 'PROMOTE-TO-CANDIDATE') return { type: 'open-question', why: bothWays };
  if (ruling.verdict === 'REJECT') {
    const gate = ['C1_binds_something_real', 'C2_constants_sourced', 'C6_wild_type_survives'].find(k => c[k].verdict === 'fail');
    const reason = gate === 'C1_binds_something_real' ? 'vacuous: no assignment of its own quantities makes it false, so it binds no design'
      : gate === 'C2_constants_sourced' ? 'unsourced: a constant in the statement has no provenance kind, no retrievable source, or is absent from the source cited'
      : gate === 'C6_wild_type_survives' ? 'fires on a wild-type organism inside its own scope, so it is wrong about biology'
      : (ruling.reject_because || 'the referee rejected it on a soft criterion un-fixably (a definition restated, or a record bound presented as an impossibility)');
    return { type: 'failed-theorem', why: [reason], failed_gate: gate || null };
  }
  if (ruling.verdict === 'NEEDS-WORK') return { type: 'candidate-with-requirements', why: ruling.needs_work?.length ? ruling.needs_work : [unclearReason(c)] };
  return { type: 'promotion-request', why: ['the debate passed every criterion; a human decides whether it becomes accepted'] };
}
function unclearReason(c) {
  const u = Object.entries(c).find(([, v]) => v.verdict === 'unclear');
  return u ? `${u[0]} is unclear: ${u[1].gate_why || u[1].referee_reason}` : 'the referee asked for changes without listing them';
}

/** The two arms of an open question: the candidate's claim, and what stands against it. */
function arms(ruling, cand) {
  const out = [{
    arm: 'as stated by the candidate',
    law_id: cand.law_id,
    statement_en: cand.statement_en,
    lean: { file: cand.lean?.file, declaration: cand.lean?.declaration, witness: cand.lean?.witness, statement_text: cand.lean?.statement_text },
    atoms: cand.shared_scope?.atoms || [],
    evidence_for: (cand.sources || []).concat(ruling.roles?.evidence_checker?.constants?.filter(x => x.my_verdict === 'found').map(x => `${x.value} verified in ${x.source_url_fetched || 'its cited source'}`) || []),
    case_for: ruling.roles?.proponent?.strongest_sentence ?? null,
  }];
  for (const h of ruling.open_disputes?.hits || []) out.push({ arm: `the other side of ${h.id}`, law_id: null,
    statement_en: h.arms.filter(a => a).join('  ||  '), evidence_for: [h.where], case_against_the_candidate: h.question, lean: null, atoms: [] });
  if (ruling.contested_with?.length) out.push({ arm: 'the accepted law it contradicts', law_id: ruling.contested_with[0],
    statement_en: `see lean/registry/laws/${ruling.contested_with[0]}.json`, evidence_for: ['already accepted in the registry'], lean: null, atoms: [] });
  const fires = ruling.roles?.critic?.attacks?.find(a => a.attack === 'fires-on-real-organism');
  if (fires?.source && ['fatal', 'serious'].includes(fires.verdict)) out.push({ arm: 'a counter-measurement the critic found',
    law_id: null, statement_en: fires.finding, evidence_for: [fires.source], numbers: fires.numbers || {}, confidence: fires.confidence, lean: null, atoms: [] });
  return out;
}

export function emitRecord(ruling, cand) {
  const k = classify(ruling, cand);
  const rec = {
    schema: 'leanbio-debate-record/1.0.0',
    note: 'Emitted by pipeline/leanbio/debate for lean/registry/open-questions/, which owns its own schema and versioning. This file is the debate\'s output, not a registry entry.',
    type: k.type,
    law_id: ruling.law_id,
    emitted_at: nowIso(),
    verdict: ruling.verdict,
    criteria_version: ruling.criteria_version,
    criteria_sha256: ruling.criteria_sha256,
    why: k.why,
    failed_gate: k.failed_gate ?? null,
    label: cand.label ?? null,
    statement_en: cand.statement_en ?? null,
    scope: cand.scope ?? null,
    sources: cand.sources ?? [],
    lean: { file: cand.lean?.file ?? null, declaration: cand.lean?.declaration ?? null, witness: cand.lean?.witness ?? null },
    criteria: Object.fromEntries(Object.entries(ruling.criteria).map(([n, v]) => [n, { verdict: v.verdict, reason: v.gate_why || v.referee_reason }])),
    ruling: ruling.ruling,
    requirements: ruling.verdict === 'NEEDS-WORK' ? (ruling.needs_work?.length ? ruling.needs_work : k.why) : [],
    arms: k.type === 'open-question' ? arms(ruling, cand) : null,
    what_would_settle_it: k.type === 'open-question'
      ? [ruling.what_a_human_should_check, ...(ruling.open_disputes?.hits || []).map(h => `a measurement that decides ${h.question}`),
         ruling.criteria.C6_wild_type_survives.verdict === 'unclear' ? 'a measured wild-type organism inside the law\'s scope carrying its quantities, so C6 can be evaluated at all' : null].filter(Boolean)
      : null,
    belief_inputs: { note: 'pipeline/leanbio/belief.mjs computes the belief-weighted proportion across arms; this record supplies the evidence lists it needs, not a score.',
      supporting_sources: cand.sources ?? [], preregistered_tests: (cand.evidence?.sources || []).filter(s => /claim-tests\//.test(String(s))),
      evidence_checker_verified: ruling.roles?.evidence_checker?.all_constants_verified ?? null,
      evidence_fetch_verdict: ruling.roles?.evidence_fetch?.verdict ?? null },
    promotion: { automatic_status_written: ruling.registry?.status ?? null,
      accepted_automatically: false,
      why_not: 'Only a human promotes a law to accepted in this project; see pipeline/leanbio/debate/README.md, "The automation question".' },
    retired: false, superseded_by: null,
  };
  fs.mkdirSync(RECORDS_DIR, { recursive: true });
  const file = `pipeline/leanbio/debate/out/records/${ruling.law_id}.json`;
  writeJson(D('out', 'records', `${ruling.law_id}.json`), rec);
  return { type: rec.type, file, why: k.why };
}

/** Everything emitted so far, for the open-questions agent to poll. */
export function records() {
  if (!fs.existsSync(RECORDS_DIR)) return [];
  return fs.readdirSync(RECORDS_DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(`${RECORDS_DIR}/${f}`, 'utf8')));
}

if (process.argv[1]?.endsWith('records.mjs')) {
  const rs = records();
  console.log(JSON.stringify({ dir: 'pipeline/leanbio/debate/out/records/', count: rs.length,
    by_type: rs.reduce((a, r) => ({ ...a, [r.type]: (a[r.type] || 0) + 1 }), {}),
    records: rs.map(r => ({ law_id: r.law_id, type: r.type, verdict: r.verdict, why: r.why, arms: r.arms?.length ?? null })) }, null, 1));
}
