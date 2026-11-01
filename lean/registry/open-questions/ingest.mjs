#!/usr/bin/env node
// Ingest rulings from the other threads into this folder's own schema.
//
//   node lean/registry/open-questions/ingest.mjs [--write]
//
// Two producers, polled rather than given write access to these files (so this folder owns its schema and its
// versioning, and a producer cannot write a record that does not validate):
//
//   pipeline/leanbio/debate/out/records/<law_id>.json     schema leanbio-debate-record/1.0.0
//       type: failed-theorem | open-question | candidate-with-requirements | promotion-request
//       It deliberately supplies `belief_inputs` (raw evidence lists) and NO score, so the proportion is
//       computed here by pipeline/leanbio/belief.mjs and is reproducible.
//   pipeline/leanbio/out/round2-open-questions.json      the discovery agent's "provable but not checkable" list
//       {law_id, statement_en, proof_status, missing_inputs[], would_constrain_if_supplied, sources[]}
//       These become `candidate-with-requirements` records, NOT failures: CRITERIA.md routes a sound statement
//       with no shared scope to NEEDS-WORK, and the fix is to declare the quantities a design would carry.
//
// PROVENANCE CARRIED, not dropped: every ingested record keeps its ruling's criteria version and hash, and a
// `debate_limitations` note where the round has a known bound on what its label is worth.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJson, writeJson } from '../registry-lib.mjs';
// Drop keys whose value is undefined: the validator tests `key in object`, so an explicitly-undefined optional
// field fails its type check instead of being treated as absent.
const defined = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
import { ROOT, QUESTIONS_DIR, FAILED_DIR, REQUIREMENTS_DIR, NOT_CHECKABLE_DIR, contentHash, proportionOf, validateRecord, load } from './openq-lib.mjs';

const R = (...p) => path.join(ROOT, ...p);
const TODAY = new Date().toISOString().slice(0, 10);
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// This round's known limitation, recorded on every record that came out of it. A "debated" label is worth less
// than it sounds when no worker ever looked outside the repository.
const DEBATE_LIMITATION =
  'PROVENANCE BOUND on this ruling: in the round that produced it, the debate\'s critic and evidence-checker ' +
  'workers made ZERO web tool calls despite having them (recorded in pipeline/leanbio/debate/DEBATE-RESULTS.md). ' +
  'So no counterexample in this round came from the literature: every rejection was caught by a mechanical check ' +
  'against data already in the repository. The "debated" label therefore means "survived the repo\'s own gates", ' +
  'not "survived a literature search for counterexamples".';

const CLS = { 'preregistered-test': 'preregistered-test', 'repo-evidence': 'repo-evidence', literature: 'literature' };

/** A debate record's belief_inputs -> evidence items in this folder's schema. */
function evidenceFrom(bi, { side = 'support' } = {}) {
  const out = [];
  for (const s of bi?.supporting_sources || []) out.push({ claim: 'cited in support by the debate record', source: String(s), locator: String(s), quote: String(s), kind: 'source cited by the debate proponent (not re-read here)', belief_class: /^(physics|lean|sim-engine|anatomy|omics|genotype|structures|sequences|development)\//.test(String(s)) ? 'repo-evidence' : 'literature', belief_key: String(s), side });
  for (const t of bi?.preregistered_tests || []) out.push({ claim: 'a pre-registered test bearing on the statement', source: String(t.claim_id || t.id || t), locator: String(t.file || t.claim_id || t), quote: String(t.verdict || t), kind: 'pre-registered test result', belief_class: 'preregistered-test', belief_key: String(t.claim_id || t.id || t), side: /refut|contradict|fail/i.test(String(t.verdict || '')) ? 'contradict' : side });
  for (const c of bi?.contradicting_sources || []) out.push({ claim: 'cited as contradicting by the debate record', source: String(c), locator: String(c), quote: String(c), kind: 'source cited by the debate critic (not re-read here)', belief_class: 'repo-evidence', belief_key: String(c), side: 'contradict' });
  return out;
}

export function ingestDebate({ write = false } = {}) {
  const dir = R('pipeline', 'leanbio', 'debate', 'out', 'records');
  if (!exists(dir)) return { source: dir, found: 0, written: [], skipped: ['directory does not exist'] };
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const written = [], skipped = [];
  for (const f of files) {
    const rec = readJson(path.join(dir, f));
    if (!String(rec.schema || '').startsWith('leanbio-debate-record/')) { skipped.push(`${f}: unknown schema ${rec.schema}`); continue; }
    const prov = { from: `pipeline/leanbio/debate/out/records/${f}`, verdict: rec.verdict, criteria_version: rec.criteria_version,
      criteria_sha256: rec.criteria_sha256, emitted_at: rec.emitted_at, failed_gate: rec.failed_gate || null,
      criteria: rec.criteria || null, ruling: rec.ruling || null, debate_limitations: DEBATE_LIMITATION };

    if (rec.type === 'failed-theorem') {
      // THE ASYMMETRY. A wild-type failure inside the statement's own scope SETTLES it against the statement,
      // so it is a failure and not an open question. Any other defeat must say why it is settled.
      const wild = rec.failed_gate === 'C6_wild_type_survives' || /wild[- ]type/i.test(String(rec.why || []).concat(rec.ruling || ''));
      // The ruling states a COUNT but names only the first organism explicitly, so record both and say which is
      // which. Listing one name where the ruling says five would understate the evidence; inventing four names
      // would be worse.
      const c6 = String(rec.criteria?.C6_wild_type_survives?.reason || '');
      const named = [...c6.matchAll(/([A-Z][a-z]+ [a-z]+(?: [a-z]+)?)\s*\(/g)].map(m => m[1]);
      const countM = /fires on (\d+) wild-type organism/.exec(c6);
      const organisms = [
        ...named,
        ...(countM && Number(countM[1]) > named.length
          ? [`and ${Number(countM[1]) - named.length} further wild-type organism(s) inside the declared scope, counted but NOT individually named in the debate ruling (see debate.criteria.C6_wild_type_survives.reason; the underlying rows are in the cited data file)`]
          : []),
      ];
      const reason = wild ? 'fires-on-wild-type'
        : /vacuous|tautolog/i.test(String(rec.why)) ? 'vacuous'
        : /unsourced|no source/i.test(String(rec.why)) ? 'unsourced'
        : /circular|fitted to the data/i.test(String(rec.why)) ? 'unprovable-as-stated' : 'contradicted-by-data';
      const out = defined({
        record_type: 'failed-theorem', failure_id: 'ft-' + slug(rec.law_id), version: '1.0.0',
        statement_en: rec.statement_en, reason,
        contradicted_by: wild ? 'wild-type-organism' : 'a-proof',
        wild_type_failures: wild ? (organisms.length ? organisms : ['see criteria.C6_wild_type_survives.reason']) : undefined,
        reason_detail: [...(rec.why || []), rec.ruling].filter(Boolean).join(' '),
        what_was_tried: Object.entries(rec.criteria || {}).map(([k, v]) => `${k}: ${v.verdict} -- ${v.reason}`),
        what_survives: rec.what_survives || (wild
          ? `The DATA survives: the measurements the statement was fitted to are unaffected, and so is the finding that real organisms inside the declared scope do not obey it. What fails is the statement, and the reason is recorded so the discovery agent does not resubmit it unchanged. The wild-type check that caught it is the mechanical gate, not a literature search -- see the provenance bound below.`
          : 'Recorded so the statement is not reproposed unchanged; see reason_detail for what specifically fails.'),
        lean_ref: rec.lean ? { module: rec.lean.file || null, theorem: rec.lean.declaration || null, witness: rec.lean.witness || null } : null,
        evidence: evidenceFrom(rec.belief_inputs),
        sources: rec.sources || [], touches: { law_ids: [rec.law_id] }, do_not_repropose: true,
        found_by: `Ruled REJECT by the LeanBio debate (${rec.criteria_version}) and routed here as a failed-theorem under CRITERIA.md "Record types emitted". ${wild ? 'The defeat is a WILD-TYPE failure inside the statement\'s own scope, which settles the matter against the statement rather than opening a question: no two measurements disagree here, a real animal simply does not obey it.' : ''}`,
        origin: { by_role: 'leanbio-debate', kind: 'agent' }, debate: prov,
        history: [{ version: '1.0.0', date: TODAY, change: `ingested from ${prov.from} (verdict ${rec.verdict}, failed gate ${rec.failed_gate || 'n/a'}, criteria ${rec.criteria_version})` }],
      });
      out.content_hash = contentHash(out);
      const errs = validateRecord(out);
      if (errs.length) { skipped.push(`${f}: would not validate: ${errs.join('; ')}`); continue; }
      if (write) writeJson(path.join(FAILED_DIR, out.failure_id + '.json'), out);
      written.push({ file: `failed/${out.failure_id}.json`, type: 'failed-theorem', reason, contradicted_by: out.contradicted_by });

    } else if (rec.type === 'candidate-with-requirements') {
      const out = defined({
        record_type: 'candidate-with-requirements', requirement_id: 'cr-' + slug(rec.law_id), version: '1.0.0',
        law_id: rec.law_id, statement_en: rec.statement_en, verdict: 'NEEDS-WORK',
        not_checkable_because: (rec.requirements || []).length && /shared scope|no atoms|not checkable/i.test(String(rec.requirements))
          ? 'declares no shared scope, so the Studio has nothing to evaluate: provable but NOT CHECKABLE (CRITERIA.md C1 unclear). This is not a failure; the fix is to declare the quantities a design would have to carry.' : undefined,
        missing_inputs: (rec.requirements || []).length ? rec.requirements.map(String) : ['see the per-criterion reasons in `debate.criteria`'],
        would_constrain_if_supplied: rec.would_constrain_if_supplied || `Once the listed inputs are declared, this statement binds designs through ${rec.law_id} and can be reproposed. Until then it is sound and unevaluable, which is why it is recorded here rather than as a failure.`,
        lean_ref: rec.lean ? { module: rec.lean.file || null, theorem: rec.lean.declaration || null, witness: rec.lean.witness || null } : null,
        origin: { by_role: 'leanbio-debate', kind: 'agent' }, debate: prov,
        history: [{ version: '1.0.0', date: TODAY, change: `ingested from ${prov.from} (verdict ${rec.verdict}, criteria ${rec.criteria_version})` }],
      });
      out.content_hash = contentHash(out);
      const errs = validateRecord(out);
      if (errs.length) { skipped.push(`${f}: would not validate: ${errs.join('; ')}`); continue; }
      if (write) writeJson(path.join(REQUIREMENTS_DIR, out.requirement_id + '.json'), out);
      written.push({ file: `requirements/${out.requirement_id}.json`, type: 'candidate-with-requirements', missing: out.missing_inputs.length });

    } else if (rec.type === 'open-question') {
      // An open question from the debate: arms come from the ruling, the PROPORTION is computed here.
      const out = defined({
        record_type: 'open-question', question_id: 'oq-' + slug(rec.law_id), version: '1.0.0',
        statement_en: rec.question || rec.statement_en, status: 'open',
        arms: (rec.arms || []).map((a, i) => ({ arm_id: a.arm_id || slug(a.position || ('arm-' + i)), position: a.position || (i === 0 ? 'for' : 'against'),
          statement_en: a.statement_en || a.statement, formalisable: a.formalisable !== false, not_formalisable_because: a.not_formalisable_because ?? null,
          lean_ref: a.lean_ref ?? null, wild_type_contradicted: a.wild_type_contradicted ?? null,
          evidence: (a.evidence && a.evidence.length ? a.evidence : evidenceFrom(rec.belief_inputs)) })),
        what_would_settle_it: rec.what_would_settle_it || [],
        touches: { law_ids: [rec.law_id], design_properties: [], scenario_keys: [] },
        guard: { dispute_id: null, keywords: [], arm_signatures: {}, scoped_exemptions: [] },
        exclusivity: { kind: 'stated-not-proved', statement: rec.ruling || 'Opposed arms recorded by the debate; no contradiction proved here.' },
        found_by: `Ruled REJECT-because-the-evidence-points-both-ways by the LeanBio debate (${rec.criteria_version}) and routed here as an open-question under CRITERIA.md "Record types emitted". No arm may constrain a design while the question is open.`,
        origin: { by_role: 'leanbio-debate', kind: 'agent' }, debate: prov,
        history: [{ version: '1.0.0', date: TODAY, change: `ingested from ${prov.from} (verdict ${rec.verdict}, criteria ${rec.criteria_version})` }],
      });
      skipped.push(`${f}: open-question needs hand review before writing (arms and what_would_settle_it must be checked against the sources); draft prepared, not written`);
      written.push({ file: `questions/${out.question_id}.json`, type: 'open-question', note: 'DRAFT ONLY, not written: needs hand review' });
    } else skipped.push(`${f}: type ${rec.type} is handled by the registry, not here`);
  }
  return { source: dir, found: files.length, written, skipped };
}

/** Reasons that mean the statement was NEVER ATTEMPTED, so the record is not a result about it. */
function neverAttempted(reasonText) {
  const t = String(reasonText || '');
  if (/never compiled|ran out of lake-lock|not attempted in Lean/i.test(t)) return { reason: 'not-attempted-no-build-time', attempted: false };
  if (/deliberately NOT proposed|deliberately not proposed/i.test(t)) return { reason: 'deliberately-not-proposed', attempted: false };
  if (/NEEDS-A-MISSING-CONSTANT|missing constant|exactly ONE number is absent/i.test(t)) return { reason: 'abandoned-for-lack-of-a-constant', attempted: false };
  if (/abandoned on cost|abandoned for lack of lake-lock|order of magnitude beyond/i.test(t)) return { reason: 'abandoned-on-cost', attempted: false };
  return null;
}

export async function ingestNotCheckable({ write = false } = {}) {
  const f = R('pipeline', 'leanbio', 'out', 'round2-open-questions.json');
  if (!exists(f)) return { source: f, found: 0, written: [], skipped: ['file does not exist yet'] };
  const raw = readJson(f);
  const rows = Array.isArray(raw) ? raw : (raw.requirements || raw.records || raw.laws || raw.questions || []);
  const failedRows = Array.isArray(raw) ? [] : (raw.failed_theorems || []);
  const written = [], skipped = [];

  // ── statements NEVER ATTEMPTED, or abandoned on cost / a missing constant ──
  // These are NOT "we tried and could not establish this". Conflating the two would overstate how much has been
  // tried, so each carries attempted: false and a proof_status saying plainly that Lean never checked it.
  for (const r of failedRows) {
    const id = r.failure_id || ('ft-' + slug(r.law_id || r.statement_en || ''));
    const na = neverAttempted(r.reason) || neverAttempted(r.reason_detail);
    const out = defined({
      record_type: 'failed-theorem', failure_id: id.startsWith('ft-') ? id : 'ft-' + slug(id), version: r.version || '1.0.0',
      statement_en: r.statement_en,
      reason: na ? na.reason : (r.reason_category || 'unprovable-as-stated'),
      attempted: na ? false : undefined,
      proof_status: na
        ? (r.proof_status || `NEVER COMPILED: Lean has not checked this statement. ${String(r.reason || '').slice(0, 400)} It must NOT be read as a result about the statement -- nothing was established and nothing was refuted.`)
        : r.proof_status,
      reason_detail: String(r.reason || r.reason_detail || ''),
      // The producing file writes what_was_tried as a STRING for some rows and an array for others; normalise.
      what_was_tried: (Array.isArray(r.what_was_tried) ? r.what_was_tried.map(String).filter(Boolean)
        : r.what_was_tried ? [String(r.what_was_tried)] : []).length
        ? (Array.isArray(r.what_was_tried) ? r.what_was_tried.map(String).filter(Boolean) : [String(r.what_was_tried)])
        : [na ? 'Nothing was attempted in Lean. The statement was written and queued; the reason it was not attempted is recorded in reason_detail.' : 'see reason_detail'],
      what_survives: r.what_survives || (na
        ? 'The STATEMENT survives intact as a candidate: it was never tested, so nothing about it has been learned, and it remains available to propose. What is recorded is the reason it was not attempted, so the next round does not rediscover the same queue item and so nobody mistakes an untried statement for a defeated one.'
        : 'see reason_detail'),
      lean_ref: r.lean_ref ?? null, sources: r.sources || [],
      touches: r.law_id ? { law_ids: [r.law_id] } : undefined,
      do_not_repropose: na ? false : true,
      found_by: `Emitted by the LeanBio discovery agent (round 2) into pipeline/leanbio/out/round2-open-questions.json and ingested here. ${na ? 'Classified as NEVER ATTEMPTED: this is a record of a statement that was not tried, not of one that failed.' : ''}`,
      origin: r.origin || { by_role: 'leanbio-discovery', kind: 'agent' },
      history: r.history && r.history.length ? r.history : [{ version: '1.0.0', date: TODAY, change: 'ingested from pipeline/leanbio/out/round2-open-questions.json' }],
    });
    out.content_hash = contentHash(out);
    const errs = validateRecord(out);
    if (errs.length) { skipped.push(`${out.failure_id}: would not validate: ${errs.join('; ')}`); continue; }
    if (write) writeJson(path.join(FAILED_DIR, out.failure_id + '.json'), out);
    written.push({ file: `failed/${out.failure_id}.json`, reason: out.reason, attempted: out.attempted !== false });
  }

  for (const r of rows) {
    if (!r.law_id || !r.statement_en) { skipped.push(`a row without law_id or statement_en`); continue; }

    // ── THE FOURTH TYPE. A statement no input can ever make bind is not input-starved. Routing it to a
    // requirements record would turn its most careful finding into a false to-do, so it gets its own type and
    // its missing_inputs are DROPPED rather than carried with a caveat shouted inside them.
    const inPrinciple = /not-checkable-in-principle|no rule-?out direction/i.test(`${r.verdict} ${r.not_checkable_because}`)
      || (r.missing_inputs || []).some(x => /DOES NOT MAKE THE LAW BIND|no input makes/i.test(String(x)))
      || /^\s*nothing\b/i.test(String(r.would_constrain_if_supplied || ''));
    if (inPrinciple) {
      const out = defined({
        record_type: 'not-checkable-in-principle',
        not_checkable_id: 'nc-' + slug(r.law_id), version: r.version || '1.0.0', law_id: r.law_id,
        statement_en: r.statement_en,
        proof_status: r.proof_status || 'The statement itself is sound and is a candidate law; being unevaluable over a design is not the same as being unproved.',
        not_checkable_because: r.not_checkable_because,
        why_no_input_would_help: `No input makes this bind. ${String(r.would_constrain_if_supplied || '')} The inputs the producing record listed (${(r.missing_inputs || []).map(x => String(x).split('--')[0].trim()).filter(Boolean).join('; ') || 'none'}) are the quantities the statement is ABOUT, not quantities whose absence is the problem: supplying them yields a law that still rules nothing out.`,
        false_positive_if_forced: r.false_positive_if_forced || String(r.not_checkable_because || ''),
        what_it_would_take: r.what_it_would_take || (/claim-level|explicitly CLAIMS/i.test(String(r.would_constrain_if_supplied || '')) ? String(r.would_constrain_if_supplied) : null),
        block_considered_and_rejected: /block_considered_and_rejected|browser_check_absent/i.test(String(r.not_checkable_because || '')) ? "the law's meta, under browser_check_absent.block_considered_and_rejected" : null,
        lean_ref: r.lean_ref ?? null, sources: r.sources || [],
        found_by: `Emitted by the LeanBio discovery agent (round 2) as a requirements record whose own verdict read "${r.verdict}". Re-typed here: a statement no input can make bind is neither waiting for data nor wrong, and carrying it as a requirements record would have read as "supply these numbers and the law will work", which its own not_checkable_because denies. The producing agent had flagged this by shouting the caveat inside its missing_inputs strings; that workaround is what prompted the new type.`,
        origin: r.origin || { by_role: 'leanbio-discovery', kind: 'agent' },
        history: [...(r.history || []), { version: r.version || '1.0.0', date: TODAY, change: 're-typed from candidate-with-requirements to not-checkable-in-principle on ingest; missing_inputs dropped, since no input makes this statement bind and a list of them reads as a to-do' }],
      });
      out.content_hash = contentHash(out);
      const errs = validateRecord(out);
      if (errs.length) { skipped.push(`${out.not_checkable_id}: would not validate: ${errs.join('; ')}`); continue; }
      if (write) writeJson(path.join(NOT_CHECKABLE_DIR, out.not_checkable_id + '.json'), out);
      written.push({ file: `not-checkable/${out.not_checkable_id}.json`, type: 'not-checkable-in-principle', retyped_from: 'candidate-with-requirements' });
      continue;
    }

    const out = {
      record_type: 'candidate-with-requirements', requirement_id: 'cr-' + slug(r.law_id), version: '1.0.0',
      law_id: r.law_id, statement_en: r.statement_en, verdict: 'NEEDS-WORK',
      not_checkable_because: `PROVABLE BUT NOT CHECKABLE. ${r.proof_status ? 'Proof status: ' + r.proof_status + '. ' : ''}The statement is sound and nothing in the design can be fed to it, so the Studio would report it as checked while nothing was checked. CRITERIA.md routes this to NEEDS-WORK, never to a rejection: the fix is to declare the quantities a design would have to carry.`,
      missing_inputs: (r.missing_inputs || []).map(String),
      would_constrain_if_supplied: r.would_constrain_if_supplied || 'not stated by the producing agent',
      sources: r.sources || [],
      origin: { by_role: 'leanbio-discovery', kind: 'agent' },
      produced_by: { from: 'pipeline/leanbio/out/round2-open-questions.json', proof_status: r.proof_status ?? null },
      history: [{ version: '1.0.0', date: TODAY, change: 'ingested from pipeline/leanbio/out/round2-open-questions.json (the discovery agent\'s provable-but-not-checkable list)' }],
    };
    if (!out.missing_inputs.length) { skipped.push(`${r.law_id}: no missing_inputs, which is the whole content of a requirements record`); continue; }

    // COLLISION. The debate agent and the discovery agent both ruled on several of the same laws, so a plain
    // write would silently drop whichever landed first -- losing the debate's per-criterion verdicts or the
    // discovery agent's input list. Two independent agents listing what a law needs is more informative than
    // either alone, so merge: union the inputs (deduplicated on the quantity name before any '--' caveat) and
    // keep both producers' provenance.
    const existingPath = path.join(REQUIREMENTS_DIR, out.requirement_id + '.json');
    if (exists(existingPath)) {
      const prev = readJson(existingPath);
      const nameOf = x => String(x).split('--')[0].trim().toLowerCase();
      const seen = new Set((prev.missing_inputs || []).map(nameOf));
      const added = out.missing_inputs.filter(x => !seen.has(nameOf(x)));
      const merged = { ...prev,
        missing_inputs: [...(prev.missing_inputs || []), ...added],
        would_constrain_if_supplied: prev.would_constrain_if_supplied && prev.would_constrain_if_supplied.length > (out.would_constrain_if_supplied || '').length ? prev.would_constrain_if_supplied : out.would_constrain_if_supplied,
        not_checkable_because: prev.not_checkable_because || out.not_checkable_because,
        ruled_by: [...new Set([...(prev.ruled_by || [prev.origin?.by_role].filter(Boolean)), out.origin?.by_role].filter(Boolean))],
        produced_by: prev.produced_by || out.produced_by,
        discovery: out.produced_by || null,
        version: prev.version,
        history: [...(prev.history || []), { version: prev.version, date: TODAY, change: `merged a second, independent ruling on the same law from ${out.origin?.by_role || 'another agent'} (pipeline/leanbio/out/round2-open-questions.json): ${added.length} further missing input(s) added, ${out.missing_inputs.length - added.length} already listed. Both producers' provenance kept; neither ruling overwrites the other.` }],
      };
      merged.content_hash = contentHash(merged);
      const mErrs = validateRecord(merged);
      if (mErrs.length) { skipped.push(`${out.requirement_id}: merge would not validate: ${mErrs.join('; ')}`); continue; }
      if (write) writeJson(existingPath, merged);
      written.push({ file: `requirements/${out.requirement_id}.json`, law_id: r.law_id, merged_with: prev.origin?.by_role || 'existing record', inputs_added: added.length, inputs_total: merged.missing_inputs.length });
      continue;
    }
    out.content_hash = contentHash(out);
    const errs = validateRecord(out);
    if (errs.length) { skipped.push(`${r.law_id}: would not validate: ${errs.join('; ')}`); continue; }
    if (write) writeJson(path.join(REQUIREMENTS_DIR, out.requirement_id + '.json'), out);
    written.push({ file: `requirements/${out.requirement_id}.json`, law_id: r.law_id, missing: out.missing_inputs.length });
  }
  return { source: f, found: rows.length, written, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const write = process.argv.includes('--write');
  const a = ingestDebate({ write });
  const b = await ingestNotCheckable({ write });
  process.stdout.write(JSON.stringify({ write, debate: a, not_checkable: b }, null, 2) + '\n');
  if (!write) console.error('\n(dry run: pass --write to create the records)');
}
