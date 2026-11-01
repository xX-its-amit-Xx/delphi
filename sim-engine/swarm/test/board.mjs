// Tests for the swarm board: leases, claims, expiry, dependencies, role rules, cross-process locking, and that
// results land in the codesign session as proposals (never applied edits).
//
//   node sim-engine/swarm/test/board.mjs            all checks must pass
//   node sim-engine/swarm/test/board.mjs --mutate   runs the same checks against three damaged copies of board.mjs
//                                                   (no lease expiry, no lock, no one-claim-per-role rule); each
//                                                   copy must FAIL at least one check, or the tests prove nothing.
//
// Everything is written under a throwaway directory in C:\Temp (STUDIO_SESSIONS_DIR, SWARM_BOARD_FILE), never under
// sim-engine/sessions/.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const HERE = import.meta.dirname;
const SIM = path.resolve(HERE, '..', '..');
const TMP_ROOT = process.env.SWARM_TEST_TMP || (process.platform === 'win32' ? 'C:/Temp' : os.tmpdir());

const MUTANTS = {
  'no-lease-expiry': ["if (t.status === 'claimed' && Date.parse(t.lease_until) <= now) t.status = 'expired';", ''],
  'no-lock': ["try { fd = fs.openSync(lock, 'wx'); }", "try { fd = fs.openSync(lock + Math.random(), 'wx'); }"],
  'no-one-claim-per-role': ["if (mine) return envelope(", "if (false) return envelope("],
};

if (process.argv.includes('--child-claim')) { await childClaim(); process.exit(0); }
if (process.argv.includes('--mutate')) { await mutateAll(); process.exit(0); }
const bi = process.argv.indexOf('--board');
const failed = await runChecks(bi > 0 ? process.argv[bi + 1] : path.join(HERE, '..', 'board.mjs'), { print: !process.argv.includes('--quiet') });
if (process.argv.includes('--quiet')) console.log(JSON.stringify({ failed }));
process.exit(failed ? 1 : 0);

// ---------------------------------------------------------------- the checks
async function runChecks(boardPath, { print }) {
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'delphi-swarm-test-'));
  process.env.STUDIO_SESSIONS_DIR = path.join(dir, 'sessions');
  process.env.SWARM_BOARD_FILE = path.join(dir, 'board', 'tasks.jsonl');
  const S = await import(pathToFileURL(path.join(SIM, 'tools', 'studio.mjs')).href ); 
  const B = await import(pathToFileURL(boardPath).href);
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); if (print) console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${!ok && detail ? '  -- ' + detail : ''}`); };
  const throws = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
  let T = Date.parse('2026-11-01T00:00:00Z');
  B.setClock(() => T);
  try {
    // A session with a saved organism, the way the recruiter makes one.
    await S.organismCreate({ id: 'swarm-test-org', parents: [{ organism: 'zebrafish-adult', weight: 1 }] });
    const sid = (await S.sessionOpen({ title: 'swarm test', author: 'agent:recruiter', organism: 'swarm-test-org' })).result.session;
    const post = a => B.swarmPostTask({ session_id: sid, posted_by_role: 'agent:recruiter', ...a }).then(r => r.result.task.task_id);

    check('posting to a missing session is refused', await throws(() => B.swarmPostTask({ session_id: 'nope-000000', kind: 'generate', title: 'x', required_role: 'agent:gen', posted_by_role: 'agent:recruiter' })));
    check('a non-agent required_role is refused', await throws(() => post({ kind: 'generate', title: 'x', required_role: 'human' })));
    const A = await post({ kind: 'generate', level: 'organ', target: 'pectoral_fin_L', title: 'fin edit', required_role: 'agent:gen', lease_s: 60 });
    const Bt = await post({ kind: 'evaluate', level: 'session', title: 'evaluate after A', required_role: 'agent:eval', depends_on: [A] });

    check('a human role cannot claim (humans decide, agents work)', await throws(() => B.swarmClaim({ role: 'human' }), /agent role/));
    check('a personal identifier is refused as a role', await throws(() => B.swarmClaim({ role: 'jane.doe@example.org' })));
    const c1 = (await B.swarmClaim({ role: 'agent:gen-1' })).result;
    check('agent:gen-1 claims the open generate task', c1.task?.task_id === A && c1.task.status === 'claimed', JSON.stringify(c1.task));
    check('the claim carries a lease of lease_s', Date.parse(c1.task.lease_until) === T + 60000, c1.task.lease_until);
    check('the claim returns the session organism as context', c1.context?.organism?.id === 'swarm-test-org');
    const c2 = (await B.swarmClaim({ role: 'agent:gen-2' })).result;
    check('a second agent gets nothing while the task is leased', c2.task === null, JSON.stringify(c2.task));
    const cE = (await B.swarmClaim({ role: 'agent:eval-1' })).result;
    check('a task whose dependency is not done is not claimable', cE.task === null && cE.waiting?.[0]?.blocked_by?.[0] === A, JSON.stringify(cE));
    const again = (await B.swarmClaim({ role: 'agent:gen-1' })).result;
    check('claiming again returns the task already held (one live claim per role)', again.already_held === true && again.task.task_id === A, JSON.stringify(again.task));
    check('submitting a task you do not hold is refused', await throws(() => B.swarmSubmit({ task_id: A, role: 'agent:gen-2', outcome: 'done', summary: 'x' }), /not held/));

    T += 61000; // the lease lapses: gen-1 is presumed dead
    const st1 = (await B.swarmStatus({ session_id: sid })).result;
    check('a lapsed lease reads as expired', st1.tasks.find(t => t.task_id === A)?.status === 'expired', st1.tasks.find(t => t.task_id === A)?.status);
    const renew = await throws(() => B.swarmClaim({ role: 'agent:gen-1', renew: true }));
    check('an expired lease cannot be renewed', renew);
    const c3 = (await B.swarmClaim({ role: 'agent:gen-2' })).result;
    check('another agent re-claims the expired task', c3.task?.task_id === A && c3.task.claimed_by_role === 'agent:gen-2' && c3.task.attempts === 2, JSON.stringify(c3.task));
    check('the expiry is logged in the event file', B.readEvents().some(e => e.ev === 'expire' && e.task_id === A && e.role === 'agent:gen-1'));
    check('the dead agent\'s late submit is refused once someone else holds the task', await throws(() => B.swarmSubmit({ task_id: A, role: 'agent:gen-1', outcome: 'done', summary: 'late' }), /not held/));

    T += 30000;
    const rn = (await B.swarmClaim({ role: 'agent:gen-2', renew: true })).result;
    check('a live lease can be renewed', Date.parse(rn.task.lease_until) === T + 60000, rn.task.lease_until);
    const edit = { target: { level: 'body', id: 'body' }, param: 'pectoral_area_over_SL2', op: 'scale', value: 1.5, reason: 'test edit; factor assumed' };
    const sub = (await B.swarmSubmit({ task_id: A, role: 'agent:gen-2', outcome: 'done', summary: 'bigger fin', edits: [edit], rationale: 'test' })).result;
    check('a done submit with edits becomes a session proposal', sub.posted.type === 'proposal' && /#p\d+$/.test(sub.result_ref), JSON.stringify(sub));
    const sr = (await S.sessionRead({ session: sid })).result;
    check('the proposal awaits a human (status open, nothing applied)', sr.proposals.length === 1 && sr.proposals[0].status === 'open' && sr.organism.edits.length === 0, JSON.stringify(sr.proposals));
    check('no kind "edit" or decision entry was written by the swarm', !sr.entries.some(e => e.type === 'edit' || e.type === 'decision'));
    check('a done task cannot be submitted twice', await throws(() => B.swarmSubmit({ task_id: A, role: 'agent:gen-2', outcome: 'done', summary: 'again' })));

    const cE2 = (await B.swarmClaim({ role: 'agent:eval-1' })).result;
    check('the dependent task unblocks once its dependency is done', cE2.task?.task_id === Bt, JSON.stringify(cE2.task));
    check('an evaluate task may not submit edits', await throws(() => B.swarmSubmit({ task_id: Bt, role: 'agent:eval-1', outcome: 'done', summary: 'x', edits: [edit] }), /findings, not edits/));
    const sE = (await B.swarmSubmit({ task_id: Bt, role: 'agent:eval-1', outcome: 'done', summary: 'evaluated', findings: { survives_20C: true } })).result;
    check('a findings-only submit becomes a session comment', sE.posted.type === 'comment', JSON.stringify(sE));

    const C = await post({ kind: 'validate', title: 'flaky', required_role: 'agent:val', lease_s: 10, max_attempts: 2 });
    await B.swarmClaim({ role: 'agent:val-1' });
    const fsub = (await B.swarmSubmit({ task_id: C, role: 'agent:val-1', outcome: 'failed', summary: 'tool error' })).result;
    const stC = (await B.swarmStatus({})).result.tasks.find(t => t.task_id === C);
    check('a failed attempt below max_attempts reopens the task', fsub.posted.type === 'comment' && stC.status === 'open' && stC.claimed_by_role === null, JSON.stringify(stC));
    await B.swarmClaim({ role: 'agent:val-2' });
    T += 11000;
    const stC2 = (await B.swarmStatus({})).result.tasks.find(t => t.task_id === C);
    check('a lease lapsing on the last attempt marks the task failed', stC2.status === 'failed', stC2.status);
    check('a failed task is not claimable', (await B.swarmClaim({ role: 'agent:val-3' })).result.task === null);

    const D = await post({ kind: 'generate', title: 'late but uncontested', required_role: 'agent:gen', lease_s: 5 });
    await B.swarmClaim({ role: 'agent:gen-3' });
    T += 6000;
    const late = (await B.swarmSubmit({ task_id: D, role: 'agent:gen-3', outcome: 'done', summary: 'slow but nobody else took it' })).result;
    check('a late submit is honoured (and flagged) when nobody re-claimed', late.late === true, JSON.stringify(late));

    const before = fs.readFileSync(path.join(process.env.STUDIO_SESSIONS_DIR, `${sid}.jsonl`), 'utf8');
    const tr = (await B.swarmTryEdits({ session_id: sid, role: 'agent:gen-1', edits: [edit], scenarios: [{ scenario: 'temperature', params: { water_temperature_C: 30 } }] })).result;
    check('swarm_try_edits returns verdicts and scenario runs', tr.steps.length === 1 && tr.runs[0]?.ok === true, JSON.stringify(tr.runs[0]).slice(0, 200));
    check('swarm_try_edits writes nothing to the session', fs.readFileSync(path.join(process.env.STUDIO_SESSIONS_DIR, `${sid}.jsonl`), 'utf8') === before);

    // Cross-process race: three processes claim at the same instant from a board with two open tasks.
    const R1 = await post({ kind: 'generate', title: 'race 1', required_role: 'agent:racer' });
    const R2 = await post({ kind: 'generate', title: 'race 2', required_role: 'agent:racer' });
    B.setClock(null); // child processes use the real clock; give the race tasks a fresh lease window
    const start = Date.now() + 1500;
    const outs = await Promise.all([1, 2, 3].map(i => runChild(boardPath, `agent:racer-${i}`, start)));
    const got = outs.map(o => o.task_id).filter(Boolean);
    check('three racing processes: exactly two claims, no task claimed twice', got.length === 2 && new Set(got).size === 2 && got.every(x => x === R1 || x === R2), JSON.stringify(outs));
    const claims = B.readEvents().filter(e => e.ev === 'claim' && (e.task_id === R1 || e.task_id === R2));
    check('the event log holds one claim per race task', claims.length === 2, JSON.stringify(claims));
  } catch (e) {
    check('no unexpected exception', false, e.stack);
  } finally { B.setClock(null); }
  const failedN = results.filter(r => !r.ok).length;
  if (print) console.log(`\n${results.length - failedN}/${results.length} checks pass (store: ${dir})`);
  return failedN;
}

function runChild(boardPath, role, start) {
  return new Promise(resolve => {
    const ch = spawn(process.execPath, [import.meta.filename, '--child-claim', boardPath, role, String(start)], { env: { ...process.env, SWARM_TEST_HOLD_MS: '150' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => err += d);
    ch.on('close', () => { try { resolve(JSON.parse(out.trim().split('\n').pop())); } catch { resolve({ role, error: err.slice(0, 300) || out.slice(0, 300) }); } });
  });
}
async function childClaim() {
  const [, , , boardPath, role, start] = process.argv;
  const B = await import(pathToFileURL(boardPath).href);
  while (Date.now() < Number(start)) { /* spin to a common start instant */ }
  try { const r = await B.swarmClaim({ role }); console.log(JSON.stringify({ role, task_id: r.result.task?.task_id ?? null })); }
  catch (e) { console.log(JSON.stringify({ role, task_id: null, error: e.message })); }
}

async function mutateAll() {
  const src = fs.readFileSync(path.join(HERE, '..', 'board.mjs'), 'utf8');
  const libUrl = pathToFileURL(path.join(SIM, 'lib')).href, toolsUrl = pathToFileURL(path.join(SIM, 'tools')).href;
  let ok = true;
  for (const [name, [from, to]] of Object.entries(MUTANTS)) {
    if (!src.includes(from)) { console.log(`MUTANT ${name}: target text not found in board.mjs; update the test`); ok = false; continue; }
    const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'delphi-swarm-mutant-'));
    const f = path.join(dir, `board-${name}.mjs`);
    fs.writeFileSync(f, src.replace(from, to).replaceAll("'../lib/", `'${libUrl}/`).replaceAll("'../tools/", `'${toolsUrl}/`));
    const n = await new Promise(res => { const ch = spawn(process.execPath, [import.meta.filename, '--board', f, '--quiet'], { stdio: ['ignore', 'pipe', 'inherit'] }); let o = ''; ch.stdout.on('data', d => o += d); ch.on('close', () => { try { res(JSON.parse(o.trim().split(/\r?\n/).pop()).failed); } catch { res(1); } }); });
    console.log(`MUTANT ${name}: ${n ? `caught (${n} check${n > 1 ? 's' : ''} fail)` : 'NOT CAUGHT: every check passed on a damaged board'}`);
    if (!n) ok = false;
  }
  if (!ok) process.exit(1);
}
