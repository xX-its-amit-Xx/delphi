#!/usr/bin/env node
// The automation path, and where it stops.
//
//   node pipeline/leanbio/debate/promote.mjs queue                         # the promotion requests awaiting a human
//   node pipeline/leanbio/debate/promote.mjs approve <law_id> --by human:project-lead [--note "..."] [--dry-run]
//   node pipeline/leanbio/debate/promote.mjs refuse  <law_id> --by human:project-lead --why "..."
//   node pipeline/leanbio/debate/promote.mjs flag                          # show the auto-accept flag and its state
//
// WHAT IS AUTOMATIC: a debate survivor is written to the registry as status `candidate`, by lean/registry/propose.mjs,
// in the same run as the ruling. The MCP server serves it immediately (lib/lean-source.mjs reads the registry), and
// the studio draws it DASHED, not red: a candidate is advisory and does not bind the optimizer.
//
// WHAT IS NOT AUTOMATIC: `accepted`. An accepted law turns designs RED and constrains the optimizer, so in this
// project only a human promotes one. A debate that ends PROMOTE-TO-CANDIDATE queues a promotion REQUEST carrying the
// referee's written ruling; `approve` is the one command that grants it, and it refuses without a human role.
//
// If that should ever change, it changes through ONE recorded flag (`auto_accept_on_debate_pass` in config.json,
// default false) which refuses to take effect without a decision id. Never a silent default. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { D, R, readJson, writeJson, nowIso, requireLock, sha256 } from './lib.mjs';

export const QUEUE_FILE = D('queue', 'promotion-queue.jsonl');
export const CONFIG_FILE = D('config.json');
const HUMAN_ROLE = /^human:[a-z][a-z0-9-]*$/;

export function config() {
  if (!fs.existsSync(CONFIG_FILE)) return defaultConfig();
  return { ...defaultConfig(), ...readJson(CONFIG_FILE) };
}
function defaultConfig() {
  return {
    version: 'leanbio-debate-config/1.0.0',
    auto_accept_on_debate_pass: false,
    auto_accept_decision: null,
    auto_accept_note: 'OFF BY DESIGN. With this false, a debate survivor stops at `candidate` and a human grants `accepted`. Setting it true makes a PROMOTE-TO-CANDIDATE ruling write `accepted` with no human in the loop; it then requires auto_accept_decision = {by: "human:<role>", date, where_recorded} and refuses to take effect without one, so the change is a recorded decision and not a silent default.',
    write_candidate_automatically: true,
    model: 'claude-sonnet-5-5',
  };
}

/** The flag's gate. Returns {enabled, why}. Enabled only with a recorded decision. */
export function autoAcceptState() {
  const c = config();
  if (!c.auto_accept_on_debate_pass) return { enabled: false, why: 'auto_accept_on_debate_pass is false (the default): debate survivors stop at `candidate` and a human grants `accepted`' };
  const d = c.auto_accept_decision;
  if (!d || !HUMAN_ROLE.test(String(d.by || '')) || !d.date || !d.where_recorded) {
    return { enabled: false, why: 'auto_accept_on_debate_pass is true but auto_accept_decision is missing or incomplete (needs {by: "human:<role>", date, where_recorded}); the flag refuses to take effect, because turning off the human step must be a recorded decision' };
  }
  return { enabled: true, why: `auto-accept is ON by the recorded decision of ${d.by} on ${d.date} (${d.where_recorded})` };
}

// ---------------------------------------------------------------- the queue (append-only)
export function queueEvents() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return fs.readFileSync(QUEUE_FILE, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function append(ev) { fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true }); fs.appendFileSync(QUEUE_FILE, JSON.stringify({ at: nowIso(), ...ev }) + '\n'); return ev; }

/** The queue as state: one row per law, latest event wins. */
export function queue() {
  const by = new Map();
  for (const e of queueEvents()) {
    const cur = by.get(e.law_id) || { law_id: e.law_id, history: [] };
    cur.history.push(e);
    if (e.ev === 'request') Object.assign(cur, { status: 'awaiting-human', requested_at: e.at, ruling: e.ruling, verdict: e.verdict, registry: e.registry, criteria_sha256: e.criteria_sha256, ruling_sha256: e.ruling_sha256 });
    if (e.ev === 'approve') Object.assign(cur, { status: 'approved', decided_at: e.at, decided_by: e.by, note: e.note ?? null, release_step: e.release_step ?? null });
    if (e.ev === 'refuse') Object.assign(cur, { status: 'refused', decided_at: e.at, decided_by: e.by, why: e.why });
    by.set(e.law_id, cur);
  }
  return [...by.values()];
}

/** Queue a promotion request. Called by debate.mjs for every PROMOTE-TO-CANDIDATE (and for CONTESTED, which also
 *  needs a person: two laws disagree and code must not pick). */
export function requestPromotion({ ruling, registry }) {
  const lock = requireLock();
  return append({ ev: 'request', law_id: ruling.law_id, verdict: ruling.verdict,
    criteria_version: lock.version, criteria_sha256: ruling.criteria_sha256, ruling_sha256: sha256(JSON.stringify(ruling)).slice(0, 32),
    asks: ruling.verdict === 'CONTESTED'
      ? `decide which law is wrong: ${ruling.law_id} or ${(ruling.contested_with || []).join(', ') || 'the accepted law it contradicts'}`
      : `promote ${ruling.law_id} from candidate to accepted (it will turn designs RED and constrain the optimizer)`,
    registry: registry || null,
    what_a_human_should_check: ruling.what_a_human_should_check,
    ruling });
}

// ---------------------------------------------------------------- writing the candidate (propose.mjs, never by hand)
/** Write a debate survivor to the registry as `candidate`, through the registry's own entry point. propose.mjs never
 *  writes `accepted`; that is its invariant, not ours, and we do not reach around it. */
export async function writeCandidate(cand, { lawset = null } = {}) {
  const leanFile = cand.lean?.file ? R(cand.lean.file) : null;
  if (!leanFile || !fs.existsSync(leanFile)) return { written: false, why: `no Lean file for ${cand.law_id} (${cand.lean?.file ?? 'none declared'})` };
  if (!cand.meta_path || !fs.existsSync(R(cand.meta_path))) return { written: false, why: `no meta file for ${cand.law_id}` };
  const meta = readJson(R(cand.meta_path));
  const { propose } = await import(pathToFileURL(R('lean', 'registry', 'propose.mjs')).href);
  try {
    const r = await propose(leanFile, meta, { write: true, lawsetVersion: lawset });
    return { written: r.status === 'candidate' || r.status === 'contested', status: r.status, law_id: r.law_id,
      steps: Object.fromEntries(Object.entries(r.steps || {}).map(([k, v]) => [k, v?.ok ?? v])), reasons: r.reasons || [],
      note: 'written by lean/registry/propose.mjs, which never writes `accepted`' };
  } catch (e) { return { written: false, why: String(e.message || e).slice(0, 400) }; }
}

// ---------------------------------------------------------------- the one-command approval
/** The human step. Refuses without a human role, refuses a law the debate did not pass, and records the decision
 *  before touching anything. With --dry-run it prints the plan and writes nothing. */
export async function approve(lawId, { by, note = null, dryRun = false } = {}) {
  if (!HUMAN_ROLE.test(String(by || ''))) throw new Error(`--by must be a human role such as human:project-lead (got ${JSON.stringify(by)}). An agent role cannot approve: that is the whole point of the queue.`);
  const row = queue().find(q => q.law_id === lawId);
  if (!row) throw new Error(`no promotion request for ${lawId}; the queue holds: ${queue().map(q => q.law_id).join(', ') || '(nothing)'}`);
  if (row.status === 'approved') return { already: true, ...row };
  if (row.verdict !== 'PROMOTE-TO-CANDIDATE') throw new Error(`${lawId} has verdict ${row.verdict}, not PROMOTE-TO-CANDIDATE; only a law the debate passed can be approved here (a CONTESTED law needs a human ruling on which law is wrong, recorded by hand)`);
  const lawFile = R('lean', 'registry', 'laws', `${lawId}.json`);
  if (!fs.existsSync(lawFile)) throw new Error(`${lawId} is not in the registry (${path.relative(R(), lawFile)}); the debate's candidate write must have failed, so there is nothing to accept`);
  const law = readJson(lawFile);
  const plan = { law_id: lawId, from_status: law.status, to_status: 'accepted', approval: { approved_by_role: by, date: nowIso().slice(0, 10), basis: `debate ruling under ${row.criteria_sha256?.slice(0, 16)}...`, ruling_sha256: row.ruling_sha256, note },
    then: `node lean/registry/release.mjs <next semver> "accept ${lawId} after debate" && node dashboard/build-lean-api.mjs && node lean/registry/check-exposed.mjs` };
  if (dryRun) return { dry_run: true, plan, ruling: row.ruling };
  // The approval is recorded in the law file, which is what release.mjs checks for; the version is bumped and the
  // content hash recomputed with the registry's own function, so nothing is edited behind the registry's back.
  const { contentHash } = await import(pathToFileURL(R('lean', 'registry', 'registry-lib.mjs')).href);
  const next = { ...law, status: 'accepted', approval: plan.approval,
    version: bump(law.version), history: [...(law.history || []), { version: bump(law.version), date: plan.approval.date, change: `accepted by ${by} after the LeanBio debate (criteria ${row.criteria_sha256?.slice(0, 16)}..., ruling ${row.ruling_sha256})` }] };
  next.content_hash = contentHash(next);
  writeJson(lawFile, next);
  append({ ev: 'approve', law_id: lawId, by, note, release_step: plan.then, law_version: next.version });
  return { approved: true, law_id: lawId, by, version: next.version, next_step: plan.then };
}

export function refuse(lawId, { by, why }) {
  if (!HUMAN_ROLE.test(String(by || ''))) throw new Error('--by must be a human role such as human:project-lead');
  if (!why) throw new Error('--why is required: a refusal without a reason tells the discovery agent nothing');
  const row = queue().find(q => q.law_id === lawId);
  if (!row) throw new Error(`no promotion request for ${lawId}`);
  append({ ev: 'refuse', law_id: lawId, by, why });
  return { refused: true, law_id: lawId, by, why };
}

const bump = v => { const p = String(v || '1.0.0').split('.').map(Number); p[1] = (p[1] || 0) + 1; p[2] = 0; return p.join('.'); };

// ---------------------------------------------------------------- CLI
if (process.argv[1]?.endsWith('promote.mjs')) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = n => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : null; };
  const has = n => rest.includes(`--${n}`);
  try {
    if (cmd === 'queue' || !cmd) {
      const q = queue();
      const st = autoAcceptState();
      console.log(`promotion queue: ${q.length} law(s)\nauto-accept: ${st.enabled ? 'ON' : 'OFF'} - ${st.why}\n`);
      for (const r of q) {
        console.log(`${r.status.toUpperCase().padEnd(15)} ${r.law_id}  [${r.verdict}]`);
        console.log(`  asks: ${r.history.find(h => h.ev === 'request')?.asks ?? ''}`);
        if (r.ruling?.ruling) console.log(`  ruling: ${String(r.ruling.ruling).replace(/\s+/g, ' ').slice(0, 300)}`);
        if (r.registry) console.log(`  registry: status ${r.registry.status ?? '(not written)'}${r.registry.why ? ' - ' + r.registry.why : ''}`);
        if (r.status === 'awaiting-human') console.log(`  approve with: node pipeline/leanbio/debate/promote.mjs approve ${r.law_id} --by human:project-lead`);
        if (r.status === 'approved') console.log(`  approved by ${r.decided_by}; next: ${r.release_step}`);
        if (r.status === 'refused') console.log(`  refused by ${r.decided_by}: ${r.why}`);
        console.log('');
      }
      if (!q.length) console.log('(nothing queued yet; run the debate)');
    } else if (cmd === 'approve') {
      console.log(JSON.stringify(await approve(rest[0], { by: flag('by'), note: flag('note'), dryRun: has('dry-run') }), null, 1));
    } else if (cmd === 'refuse') {
      console.log(JSON.stringify(refuse(rest[0], { by: flag('by'), why: flag('why') }), null, 1));
    } else if (cmd === 'flag') {
      console.log(JSON.stringify({ config: config(), state: autoAcceptState() }, null, 1));
    } else { console.error(`unknown command ${cmd}`); process.exit(2); }
  } catch (e) { console.error('refused: ' + e.message); process.exit(1); }
}
