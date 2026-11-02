#!/usr/bin/env node
// The Design Studio tools from the shell. Same handlers as the MCP server (tools/studio.mjs); JSON out.
//
//   node sim-engine/cli.mjs organism create --id my-fish --parent flying-fish=0.5 --parent zebrafish-adult=0.5
//   node sim-engine/cli.mjs organism get --organism zebrafish-adult --age 90 --cond temperature_C=18
//   node sim-engine/cli.mjs organism parts --organism zebrafish-adult --level organ
//   node sim-engine/cli.mjs organism edit --organism my-fish --level organ --id gills_L --param scale --op scale --value 1.2 --author human --reason "bigger gills"
//   node sim-engine/cli.mjs scenario list
//   node sim-engine/cli.mjs scenario run --organism zebrafish-adult --scenario current --age 90 --param speed_m_s=0.3
//   node sim-engine/cli.mjs scenario timecourse --organism zebrafish-adult --scenario _example
//   node sim-engine/cli.mjs optimize --organism my-fish --scenario _example --metric gill_area_per_mass --var organ:gills_L.scale=0.5:2 --budget 40 --seed 3
//   node sim-engine/cli.mjs session open --title "wing study" --author human [--organism my-fish]
//   node sim-engine/cli.mjs session post --session <id> --author agent:physics --kind comment --body "..."
//   node sim-engine/cli.mjs session post --session <id> --author agent:physics --kind proposal --rationale "..." --json '{"edits":[...]}'
//   node sim-engine/cli.mjs session decide --session <id> --proposal p2 --decision approve --role human --reason "..."
//   node sim-engine/cli.mjs session read --session <id>
//   node sim-engine/cli.mjs tools                                   every registered tool name
//   node sim-engine/cli.mjs tool validate_generation --json '{"desired_phenotype":"...","generated":"winged-zebrafish","base":"zebrafish-adult"}'
// Any command also takes --json '<raw arguments object>', merged over the flags.
import * as T from './tools/studio.mjs';
import { errorEnvelope } from './lib/envelope.mjs';

const argv = process.argv.slice(2);
const [group, cmd] = argv;
const flags = {}; const multi = { parent: [], param: [], cond: [], var: [], hard: [] };
for (let i = 2; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2); const v = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  if (k in multi && !(k === 'param' && !v.includes('='))) multi[k].push(v); else flags[k] = v; // --param name (edits) vs --param key=value (scenarios)
}
const val = v => (v === 'true' ? true : v === 'false' ? false : v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
const kv = list => Object.fromEntries(list.map(s => { const i = s.indexOf('='); if (i < 0) throw new Error(`expected key=value, got "${s}"`); return [s.slice(0, i), val(s.slice(i + 1))]; }));
const num = k => (flags[k] !== undefined ? Number(flags[k]) : undefined);
const raw = flags.json ? JSON.parse(flags.json) : {};
const target = () => ({ level: flags.level, ...(flags.id ? { id: flags.id } : {}) });
function parseVar(s) { // level:id.param=min:max  (body.param=min:max for body)
  const m = /^([a-z]+)(?::([^.=]+))?\.([A-Za-z0-9_]+)=([-0-9.e]+):([-0-9.e]+)$/.exec(s);
  if (!m) throw new Error(`--var must look like organ:gills_L.scale=0.5:2 or body.standard_length_m=0.02:0.05; got "${s}"`);
  return { target: { level: m[1], ...(m[2] ? { id: m[2] } : {}) }, param: m[3], min: Number(m[4]), max: Number(m[5]) };
}

const COMMANDS = {
  'organism create': () => T.organismCreate({ id: flags.id, parents: multi.parent.map(s => { const [organism, w] = s.split('='); return { organism, weight: Number(w ?? 1) }; }), notes: flags.notes, overwrite: flags.overwrite === 'true', ...raw }),
  'organism get': () => T.organismGet({ organism: flags.organism, ageDays: num('age'), conditions: kv(multi.cond), ...raw }),
  'organism parts': () => T.organismListParts({ organism: flags.organism, level: flags.level, ...raw }),
  'organism edit': () => T.organismEdit({ organism: flags.organism, new_id: flags['new-id'], ageDays: num('age'), conditions: kv(multi.cond), lawset: flags.lawset,
    edit: { target: target(), param: flags.param, op: flags.op || 'set', value: val(flags.value), author: flags.author, reason: flags.reason }, ...raw }),
  'scenario list': () => T.scenarioList(),
  'scenario run': () => T.scenarioRun({ organism: flags.organism, scenario: flags.scenario, ageDays: num('age'), params: kv(multi.param), conditions: kv(multi.cond), lawset: flags.lawset, ...raw }),
  'scenario timecourse': () => T.scenarioTimecourse({ organism: flags.organism, scenario: flags.scenario, params: kv(multi.param), conditions: kv(multi.cond), lawset: flags.lawset, ...raw }),
  'optimize': () => T.optimize({ organism: flags.organism, objective: { scenario: flags.scenario, metric: flags.metric, params: kv(multi.param), ageDays: num('age'), conditions: kv(multi.cond), ...(flags.direction ? { direction: flags.direction } : {}) },
    variables: multi.var.map(parseVar), hard_constraints: multi.hard.map(h => JSON.parse(h)), budget: num('budget'), restarts: num('restarts'), seed: num('seed'), strict: flags.strict === 'true', lawset: flags.lawset, ...raw }),
  'session open': () => T.sessionOpen({ title: flags.title, author: flags.author, organism: flags.organism, ...raw }),
  'session post': () => T.sessionPost({ session: flags.session, author: flags.author, kind: flags.kind, body: flags.body, rationale: flags.rationale, lawset: flags.lawset,
    ...(flags.param ? { edit: { target: target(), param: flags.param, op: flags.op || 'set', value: val(flags.value), reason: flags.reason || flags.body } } : {}), ...raw }),
  'session decide': () => T.sessionDecide({ session: flags.session, proposal_id: flags.proposal, decision: flags.decision, decided_by_role: flags.role, reason: flags.reason, lawset: flags.lawset, ...raw }),
  'session read': () => T.sessionRead({ session: flags.session, since: num('since'), ...raw }),
};

// `tool <name>` and `tools`: a generic passthrough to EVERY tool the MCP server registers, so a tool added to
// server.mjs is reachable from the shell with no change here. The studio verbs above stay as they are; this is
// the only way to reach validate_generation, functional_resolution, physics_check, edit_plan, lean_open_* and
// anything registered later. Arguments come from --json, or from --key value flags for the simple cases.
if (group === 'tools' || group === 'tool') {
  const { TOOLS } = await import('./server.mjs');
  if (group === 'tools') {
    process.stdout.write(JSON.stringify({ count: TOOLS.length, tools: TOOLS.map(t => ({ name: t.name, title: t.title })) }, null, 1) + '\n');
    process.exit(0);
  }
  const name = cmd;
  const t = TOOLS.find(x => x.name === name);
  if (!t) {
    process.stderr.write(`unknown tool: ${name}\nknown: ${TOOLS.map(x => x.name).join(', ')}\n`);
    process.exit(2);
  }
  // Flags other than --json are passed through as-is, with numbers and booleans coerced; --json wins.
  const flat = Object.fromEntries(Object.entries(flags).filter(([k]) => k !== 'json' && k !== 'compact').map(([k, v]) => [k, val(v)]));
  try {
    const out = await t.handler({ ...flat, ...raw });
    process.stdout.write(JSON.stringify(out, null, flags.compact ? 0 : 1) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify(errorEnvelope(name, e, { tool: name }), null, 1) + '\n');
    process.exit(1);
  }
  process.exit(0);
}

const key = group === 'optimize' ? 'optimize' : `${group} ${cmd}`;
const fn = COMMANDS[key];
if (!fn) {
  process.stderr.write(`usage: node sim-engine/cli.mjs <${Object.keys(COMMANDS).join(' | ')}> [--flags]\n(see the header of sim-engine/cli.mjs for examples)\n`);
  process.exit(2);
}
try {
  const out = await fn();
  process.stdout.write(JSON.stringify(out, null, flags.compact ? 0 : 1) + '\n');
} catch (e) {
  process.stdout.write(JSON.stringify(errorEnvelope(key, e, { command: key }), null, 1) + '\n');
  process.exit(1);
}
