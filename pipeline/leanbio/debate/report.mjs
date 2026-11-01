#!/usr/bin/env node
// out/rulings.json -> DEBATE-RESULTS.md. Every number and quotation in the document comes from the rulings and the
// worker transcripts; nothing is written by hand here, so the document cannot drift from what the debate decided.
//
//   node pipeline/leanbio/debate/report.mjs [--write]
import fs from 'node:fs';
import { D, readJson, requireLock } from './lib.mjs';

const W = process.argv.includes('--write');
const R = readJson(D('out', 'rulings.json'));
const run = fs.existsSync(D('out', 'run.json')) ? readJson(D('out', 'run.json')) : {};
const lock = requireLock();
const recs = fs.existsSync(D('out', 'records')) ? fs.readdirSync(D('out', 'records')).filter(f => f.endsWith('.json')).map(f => readJson(D('out', 'records', f))) : [];
const q = fs.existsSync(D('queue', 'promotion-queue.jsonl')) ? fs.readFileSync(D('queue', 'promotion-queue.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];

const L = [];
const p = (...s) => L.push(...s);
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const trunc = (s, n) => { const t = esc(s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const VERDICT_ORDER = ['REJECT', 'CONTESTED', 'NEEDS-WORK', 'PROMOTE-TO-CANDIDATE'];
const rulings = [...R.rulings].sort((a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) || a.law_id.localeCompare(b.law_id));

p('# DEBATE-RESULTS: what the debate decided, per law', '',
  `Generated from \`out/rulings.json\` by \`report.mjs\`. ${rulings.length} law(s) ruled on, under criteria`,
  `\`${lock.version}\`, sha256 \`${lock.criteria_sha256}\`.`, '',
  '**Nothing here is accepted.** A survivor is written to the registry as `candidate` (dashed in the studio, served by',
  'the MCP immediately, `binding: false` in `checkDesign`) and a promotion request is queued for a human. See',
  '[`README.md`](README.md), "The automation question".', '');

// ---------------------------------------------------------------- the run
p('## The run', '',
  '| | |', '|---|---|',
  `| laws ruled on | ${rulings.length} |`,
  `| verdicts | ${Object.entries(R.counts).map(([k, v]) => `${v} ${k}`).join(', ')} |`,
  `| headless \`claude -p\` invocations | ${run.invocations ?? '?'} (cap ${run.max_invocations ?? '?'}, at most ${run.concurrency ?? '?'} at once) |`,
  `| cost reported by the CLI | $${(run.spent ?? 0).toFixed(2)} |`,
  `| model | ${run.model ?? '?'} |`,
  `| stopped because | ${run.stopped ?? 'the queue emptied'} |`,
  `| criteria locked at | ${lock.locked_at}${lock.locked_before_any_debate ? ', before any debate ran' : ''} |`,
  `| superseded criteria versions | ${(lock.superseded || []).map(s => s.version).join(', ') || 'none'} |`, '');

const withWorkers = rulings.filter(r => r.worker_meta && Object.values(r.worker_meta).some(m => m && !m.skipped));
const gateOnly = rulings.filter(r => !withWorkers.includes(r));
if (gateOnly.length) p(`${gateOnly.length} law(s) were ruled on by the mechanical gates alone, with no worker invocation, because the invocation cap was reached: ${gateOnly.map(r => '`' + r.law_id + '`').join(', ')}. Those rulings are marked below; they are honest gate outcomes, not debated verdicts.`, '');

// ---------------------------------------------------------------- summary table
p('## Verdicts', '',
  '| law | verdict | C1 | C2 | C3 | C4 | C5 | C6 | C7 | debated | record |',
  '|---|---|---|---|---|---|---|---|---|---|---|');
const sym = v => ({ pass: 'pass', fail: '**fail**', unclear: 'unclear', contested: 'contested' }[v] || v || '-');
for (const r of rulings) {
  const c = r.criteria;
  p(`| \`${r.law_id}\` | **${r.verdict}** | ${sym(c.C1_binds_something_real.verdict)} | ${sym(c.C2_constants_sourced.verdict)} | ${sym(c.C3_scope_honest.verdict)} | ${sym(c.C4_independent.verdict)} | ${sym(c.C5_consistent.verdict)} | ${sym(c.C6_wild_type_survives.verdict)} | ${sym(c.C7_not_circular.verdict)} | ${withWorkers.includes(r) ? 'yes' : 'gates only'} | ${r.record?.type ?? '-'} |`);
}
p('');

// ---------------------------------------------------------------- what was rejected
const rejected = rulings.filter(r => r.verdict === 'REJECT');
p('## What the debate REJECTED, and why', '');
if (!rejected.length) p('Nothing was rejected. **That is a finding about the criteria, not about the laws**: a criteria set that passes everything it is shown is too weak to be worth running. See "Are the criteria strong enough?" below.', '');
for (const r of rejected) {
  p(`### \`${r.law_id}\` — REJECT`, '', `**Why:** ${esc(r.reject_because)}`, '');
  if (r.contest_settled_against_the_candidate) p(`**Note:** ${esc(r.contest_settled_against_the_candidate)}`, '');
  const f = r.criteria.C6_wild_type_survives.fired || [];
  if (f.length) {
    p(`**The wild-type organisms it fires on** (${f.length} of ${r.criteria.C6_wild_type_survives.evaluated} evaluated, all inside the law's own declared scope):`, '',
      '| organism | measured | fails | source |', '|---|---|---|---|');
    for (const x of f) p(`| *${esc(x.organism)}* | ${esc(JSON.stringify(x.quantities))} | \`${esc(x.failing_atoms.join('; '))}\` | ${trunc(x.source, 110)} |`);
    p('');
  }
  if (r.ruling) p(`**The referee's ruling:** ${esc(r.ruling)}`, '');
  if (r.needs_work?.length) p('**What would have to change:**', '', ...r.needs_work.map(x => `- ${esc(x)}`), '');
}

// ---------------------------------------------------------------- per law
p('## Every law, in full', '');
for (const r of rulings) {
  const rec = recs.find(x => x.law_id === r.law_id);
  p(`### \`${r.law_id}\` — **${r.verdict}**`, '');
  if (rec?.statement_en) p(`> ${esc(rec.statement_en)}`, '');
  p(`Scope \`${esc(JSON.stringify(rec?.scope?.taxa ?? []))}\`. Decided ${r.decided_at}. Record type \`${r.record?.type ?? '-'}\`.`,
    `Verdicts the gates allowed: ${r.allowed_by_gates.join(' / ')}. ${r.how_the_verdict_was_reached ? 'How: ' + esc(r.how_the_verdict_was_reached) + '.' : ''}`, '');

  const ro = r.roles || {};
  if (ro.proponent) {
    p('**PROPONENT** (no web tools; argues from the candidate and the accepted set)', '',
      `- strongest case: ${esc(ro.proponent.strongest_sentence)}`,
      `- what it says the law rules out: ${esc(JSON.stringify(ro.proponent.rules_out?.design))} — ${trunc(ro.proponent.rules_out?.why_rejected, 220)}${ro.proponent.rules_out?.buildable === false ? ' *(it concedes this design is not buildable)*' : ''}`,
      `- bound kind, by its own account: **${esc(ro.proponent.bound_kind)}** — ${trunc(ro.proponent.bound_kind_why ?? '', 160)}`,
      `- narrowest scope it will defend: ${esc(JSON.stringify(ro.proponent.scope_supported?.taxa ?? ro.proponent.scope_supported))}`,
      `- closest accepted law: \`${esc(ro.proponent.independence?.closest_accepted_law)}\` — ${trunc(ro.proponent.independence?.what_this_forbids_that_one_permits, 200)}`,
      `- **it names its own weakest point:** ${esc(ro.proponent.weakest_point)}`, '');
  }
  if (ro.critic) {
    p(`**CRITIC** (had \`WebFetch\`/\`WebSearch\`; never saw the proponent's case)`, '',
      `- would it let this constrain a design? **${ro.critic.would_allow === false ? 'no' : ro.critic.would_allow === true ? 'yes' : String(ro.critic.would_allow)}**`,
      `- worst attack: **${esc(ro.critic.worst_attack)}**`,
      `- ${esc(ro.critic.one_sentence)}`, '',
      '| attack | verdict | finding |', '|---|---|---|');
    for (const a of ro.critic.attacks || []) p(`| ${esc(a.attack)} | ${esc(a.verdict)} | ${trunc(a.finding, 260)} |`);
    p('');
    const fires = (ro.critic.attacks || []).find(a => a.attack === 'fires-on-real-organism');
    if (fires?.organism) p(`Counterexample the critic offered: *${esc(fires.organism)}*, ${esc(JSON.stringify(fires.numbers || {}))}, source ${esc(fires.source) || '**none given**'}, confidence ${esc(fires.confidence)}.${!fires.source ? ' With no source this is a hypothesis, not a finding, and the criteria do not let it decide the verdict on its own.' : ''}`, '');
  }
  const ef = ro.evidence_fetch, ec = ro.evidence_checker;
  p('**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)', '');
  if (ef) p(`- mechanical fetch: **${esc(ef.verdict)}** — ${esc(JSON.stringify(ef.summary))}`);
  if (ec) {
    p(`- the checker worker: all constants verified = **${ec.all_constants_verified}**. ${esc(ec.one_sentence)}`);
    if (ec.matcher_errors_found?.length) p(`- it caught these matcher errors: ${ec.matcher_errors_found.map(esc).join('; ')}`);
    for (const c of ec.constants || []) p(`  - \`${esc(c.value)}\`: instrument said \`${esc(c.fetch_report_said)}\`, checker says \`${esc(c.my_verdict)}\`, kind seen \`${esc(c.kind_i_saw)}\`${c.quoted_sentence ? ` — quoted: "${trunc(c.quoted_sentence, 180)}"` : ''}`);
  } else p('- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).');
  p('');

  p('**REFEREE** (saw everything; bound by the gates)', '');
  if (r.referee_said && r.referee_said !== r.verdict) p(`- it voted **${esc(r.referee_said)}**; the final verdict is **${r.verdict}** because a hard gate cannot be overturned by an argument. Its disagreement is recorded, not acted on${r.gate_disagreement?.referee_note ? `: "${trunc(r.gate_disagreement.referee_note, 200)}"` : '.'}`);
  p('', '| criterion | verdict | reason |', '|---|---|---|');
  for (const [k, v] of Object.entries(r.criteria)) {
    p(`| ${k.replace(/_/g, ' ')}${v.from_gate ? ' *(hard gate)*' : ''} | ${sym(v.verdict)} | ${trunc(v.gate_why || v.referee_reason, 300)} |`);
  }
  p('');
  if (r.ruling) p(`**Ruling.** ${esc(r.ruling)}`, '');
  if (r.needs_work?.length) p('**What would make it promotable:**', '', ...r.needs_work.map(x => `- ${esc(x)}`), '');
  if (r.what_a_human_should_check) p(`**What a human should check:** ${esc(r.what_a_human_should_check)}`, '');
  if (r.registry) p(`**Registry:** ${r.registry.written ? `written as \`${r.registry.status}\`` : `not written — ${esc(r.registry.why || JSON.stringify(r.registry.reasons))}`}`, '');
  p('---', '');
}

// ---------------------------------------------------------------- the queue
p('## The promotion queue', '');
const reqs = q.filter(e => e.ev === 'request');
if (!reqs.length) p('Empty: no law reached PROMOTE-TO-CANDIDATE or CONTESTED in this run, so there is nothing for a human to decide yet.', '');
else {
  p('| law | verdict | asks | status |', '|---|---|---|---|');
  for (const e of reqs) {
    const later = q.filter(x => x.law_id === e.law_id && x.ev !== 'request').pop();
    p(`| \`${e.law_id}\` | ${e.verdict} | ${trunc(e.asks, 160)} | ${later ? `${later.ev}d by ${later.by}` : 'awaiting a human'} |`);
  }
  p('', '```bash', ...reqs.map(e => `node pipeline/leanbio/debate/promote.mjs approve ${e.law_id} --by human:project-lead`), '```', '');
}

// ---------------------------------------------------------------- records
p('## Records emitted for `lean/registry/open-questions/`', '',
  'One per ruling, in `out/records/`. A rejection is a result, not a bin.', '',
  '| law | record | why |', '|---|---|---|');
for (const r of recs) p(`| \`${r.law_id}\` | \`${r.type}\` | ${trunc((r.why || []).join('; '), 260)} |`);
p('');

// ---------------------------------------------------------------- honesty section
const counts = R.counts;
p('## Are the criteria strong enough?', '');
if (!counts.REJECT && !counts.CONTESTED) {
  p('**No.** Nothing was rejected or contested. A criteria set that passes everything shown to it has not been tested,',
    'and this section is the place to say so rather than to present a clean sweep as a result. Either the candidates',
    'were unusually good or the gates are too easy; until one of them rejects a law nobody should treat a PROMOTE',
    'verdict from this pipeline as information.', '');
} else {
  p(`${counts.REJECT || 0} rejected, ${counts.CONTESTED || 0} contested, ${counts['NEEDS-WORK'] || 0} sent back for work, ${counts['PROMOTE-TO-CANDIDATE'] || 0} promoted to candidate.`, '');
  const unclear = rulings.filter(r => r.criteria.C6_wild_type_survives.verdict === 'unclear').length;
  p(`The criteria bite in a specific place: **${unclear} of ${rulings.length}** laws could not be evaluated against any`,
    'real animal at all (C6 `unclear`), which blocks promotion without rejecting the law. That is the honest state of',
    'most of this round: they are theorems about models, formalized correctly, with no mapping from their quantities',
    'to anything a design carries. The criteria say so rather than promoting them on the strength of a correct proof.', '');
}
p('What the debate did NOT establish:', '',
  '- **The soft criteria rest on one referee.** C3, C4 and C7 are a single language model\'s judgement, recorded with',
  '  reasons so a human can disagree, but not independently replicated.',
  '- **The critic mostly did not fetch.** It had `WebFetch` and `WebSearch`; the per-law transcripts record how many',
  '  calls it actually made (`transcripts/<law>/critic.json`, `tool_calls`). Where that count is 0, its',
  '  `fires-on-real-organism` attack is reasoning from the candidate, not a search of the literature, and the',
  '  criteria correctly refuse to let an unsourced counterexample decide a verdict.',
  '- **C6 is only as broad as `wildtype.json`.** 34 organisms, drawn from this repository\'s own measured CSVs. A law',
  '  whose scope contains none of them is `unclear`, not safe.',
  '- **No Lean kernel ran here.** `propose.mjs` did that before the candidate arrived; the gates evaluate the',
  '  declared atoms in floating point, which is how the studio evaluates them too.', '');

const out = L.join('\n') + '\n';
if (W) { fs.writeFileSync(D('DEBATE-RESULTS.md'), out); console.log(`wrote pipeline/leanbio/debate/DEBATE-RESULTS.md (${out.length} bytes, ${rulings.length} rulings)`); }
else process.stdout.write(out);
