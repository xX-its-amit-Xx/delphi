// node sim-engine/test/studio.mjs
// Tests for the Design Studio core: organism documents, STATE, scenario registry, tools, optimizer,
// sessions, CLI and server registration. Session/organism files go to a throwaway directory under
// C:\Temp (STUDIO_SESSIONS_DIR), never into sim-engine/sessions.
//
// MUTATE=<name> flips one expectation so each guarded check can be seen to FAIL once:
//   node sim-engine/test/studio.mjs            -> all pass
//   MUTATE=larva node sim-engine/test/studio.mjs -> the larva cross-check fails, and so on.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TMP = fs.mkdtempSync(path.join(process.platform === 'win32' ? 'C:\\Temp' : os.tmpdir(), 'studio-test-'));
process.env.STUDIO_SESSIONS_DIR = TMP;
const M = process.env.MUTATE || '';
const here = import.meta.dirname, engine = path.resolve(here, '..');
let pass = 0, fail = 0;
const ok = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message.split('\n')[0]}`); fail++; }
};

const { loadBundle } = await import('../lib/data-node.mjs');
const O = await import('../lib/organism.mjs');
const S = await import('../lib/state.mjs');
const R = await import('../scenarios/index.mjs');
const T = await import('../tools/studio.mjs');
const b = await loadBundle();
const st = (id, age, cond = {}) => S.resolveState(O.docFor(b, id), age, cond, b);
const E = (target, param, op, value, extra = {}) => ({ target, param, op, value, author: 'agent:test', reason: 'test', ...extra });

console.log('\npurity (files the browser runs)');
for (const f of ['lib/organism.mjs', 'lib/state.mjs', 'lib/envelope.mjs', 'scenarios/_example.mjs']) {
  await ok(`${f} has no static node-only import`, () => {
    const src = fs.readFileSync(path.join(engine, f), 'utf8') + (M === 'purity' && f === 'lib/state.mjs' ? "\nimport fs from 'node:fs';" : '');
    assert.ok(!/^\s*import[^;]*from\s+['"](node:|fs|path)/m.test(src), 'static node import found');
  });
}
await ok('no Aves / bird data in the bundle', () => {
  // holdout disclaimers (keys like no_bird_data) name Aves in order to exclude it; they are not data
  const s = JSON.stringify(b, (k, v) => /no_bird|holdout/i.test(k) ? undefined : v) + (M === 'aves' ? 'Aves' : '');
  assert.ok(!/\bAves\b|\bbird\b/i.test(s), 'bird data present');
});

console.log('\nSTATE against the repository data');
await ok('zebrafish-adult at its reference age reproduces the organism file', () => {
  const s = st('zebrafish-adult', 180);
  assert.equal(s.SL_m.value, b.organisms['zebrafish-adult'].parameters.standard_length_m.value);
  assert.equal(s.mass_kg.value, b.organisms['zebrafish-adult'].parameters.body_mass_kg.value);
});
await ok('zebrafish-adult age-scaled to 3 d matches the zebrafish-larva file (mass and SL, 1 %; same growth fit, so a plumbing check, not biology)', () => {
  const s = st('zebrafish-adult', M === 'larva' ? 4 : 3), L = b.organisms['zebrafish-larva'].parameters;
  assert.ok(Math.abs(s.mass_kg.value / L.body_mass_kg.value - 1) < 0.01, `mass ${s.mass_kg.value} vs ${L.body_mass_kg.value}`);
  assert.ok(Math.abs(s.SL_m.value / L.standard_length_m.value - 1) < 0.01, `SL ${s.SL_m.value} vs ${L.standard_length_m.value}`);
});
await ok('ages beyond the growth data are clamped and flagged', () => {
  const s = st('flying-fish', 400);
  assert.equal(s.SL_m.value, st('flying-fish', 365).SL_m.value);
  assert.ok(s._meta.flags.some(f => /clamped/.test(f)), 'no clamp flag');
});
await ok('every state field is present; missing ones are null + assumed + a reason (never NaN)', () => {
  const s = st('ff-zf-chimera', 60);
  for (const k of S.STATE_FIELDS) assert.ok(k in s, `missing ${k}`);
  for (const k of ['body_density_kg_m3', 'caudal_area_m2']) { assert.equal(s[k].value, null); assert.equal(s[k].kind, 'assumed'); assert.ok(s[k].reason); }
  for (const k of S.STATE_FIELDS) if (typeof s[k]?.value === 'number') assert.ok(Number.isFinite(s[k].value), k);
});
await ok('borrowed physiology is labelled borrowed, not measured', () => {
  const s = st('zebrafish-adult', 90);
  for (const k of ['red_muscle_fraction', 'gill_area_m2', 'hb_P50_kPa']) assert.equal(s[k].kind, M === 'borrowed' ? 'measured' : 'borrowed', k);
});
await ok('zebrafish swim bladder is absent before the pSB milestone and present after', () => {
  assert.equal(st('zebrafish-adult', 0).has_swimbladder.value, false);
  assert.equal(st('zebrafish-adult', 30).has_swimbladder.value, true);
});
await ok('depth raises pressure by rho g h; pO2 of air-equilibrated water does not change with depth', () => {
  const a = st('zebrafish-adult', 90), d = st('zebrafish-adult', 90, { depth_m: 100 });
  const dp = d.ambient.pressure_kPa.value - a.ambient.pressure_kPa.value;
  assert.ok(Math.abs(dp - 1023.4 * 9.80665 * 100 / 1000) < 1e-6, `dP ${dp}`);
  assert.equal(d.ambient.pO2_kPa.value, a.ambient.pO2_kPa.value);
});
await ok('superellipse area reduces to the ellipse at n = 2', () => {
  assert.ok(Math.abs(S.superellipseArea(2, 1, 2) - Math.PI * 2) < 1e-9);
});

console.log('\norganism documents');
await ok('unknown part id is rejected', () => assert.throws(() => O.appendEdit(b, O.docFor(b, 'zebrafish-adult'), E({ level: 'organ', id: M === 'part' ? 'gills_L' : 'wing_L' }, 'scale', 'set', 1)), /unknown organ/));
await ok('unknown gene symbol is rejected; a known one is accepted as recorded-only', () => {
  const d = O.docFor(b, 'zebrafish-adult');
  assert.throws(() => O.appendEdit(b, d, E({ level: 'gene', id: 'notagene' }, 'knockout', 'set', true)), /unknown gene/);
  const d2 = O.appendEdit(b, d, E({ level: 'gene', id: 'tbx5a' }, 'knockout', 'set', true));
  const s1 = S.resolveState(d, 90, {}, b), s2 = S.resolveState(d2, 90, {}, b);
  assert.equal(s2._meta.recorded_only_edits.length, 1);
  for (const k of S.STATE_FIELDS) if (k !== 'parts') assert.deepEqual(s2[k].value, s1[k].value, `${k} changed after a recorded-only edit`);
});
await ok('a personal name or e-mail as author is rejected', () => {
  for (const a of ['Amit Shenoy', 'someone@example.org']) assert.throws(() => O.checkAuthor(a), /role label/);
  assert.equal(O.checkAuthor('agent:physics'), 'agent:physics');
});
await ok('parent weights must sum to 1', () => assert.throws(() => O.createOrganism({ id: 'x', parents: [{ organism: 'flying-fish', weight: 0.6 }, { organism: 'zebrafish-adult', weight: 0.6 }] }, b), /sum to 1/));
await ok('scaling both gill parts by 2 multiplies gill area by 4', () => {
  let d = O.docFor(b, 'zebrafish-adult');
  for (const id of ['gills_L', 'gills_R']) d = O.appendEdit(b, d, E({ level: 'organ', id }, 'scale', 'set', 2));
  const r = S.resolveState(d, 90, {}, b).gill_area_m2.value / st('zebrafish-adult', 90).gill_area_m2.value;
  assert.ok(Math.abs(r - (M === 'gill' ? 2 : 4)) < 1e-9, `ratio ${r}`);
});
await ok('removing the swim bladder (scale 0) sets has_swimbladder false, kind assumed', () => {
  const d = O.appendEdit(b, O.docFor(b, 'zebrafish-adult'), E({ level: 'organ', id: 'swim_bladder' }, 'scale', 'set', 0));
  const s = S.resolveState(d, 90, {}, b);
  assert.equal(s.has_swimbladder.value, false); assert.equal(s.has_swimbladder.kind, 'assumed');
});
await ok('a parameter edit is labelled assumed and keeps the prior value in its source', () => {
  const d = O.appendEdit(b, O.docFor(b, 'zebrafish-adult'), E({ level: 'organ', id: 'pectoral_fin_L' }, 'pectoral_area_over_SL2', 'scale', 2));
  const p = O.resolveParameters(b, d).params.pectoral_area_over_SL2;
  assert.equal(p.kind, 'assumed'); assert.ok(/was 0.016/.test(p.source));
});
await ok('part hierarchy lists systems, organs and tissues with editable params', () => {
  const t = O.listParts(b, O.docFor(b, 'flying-fish'));
  const resp = t.body.systems.find(s => s.id === 'UBERON_0001004');
  assert.ok(resp && resp.organs.some(o => o.id === 'gills_L' && o.editable.some(e => e.param === 'gill_area_m2')));
  assert.ok(t.body.systems.some(s => s.tissues.some(x => x.id === 'muscle_L')));
});

console.log('\nscenario registry');
const good = (await import('../scenarios/_example.mjs')).default;
await ok('a malformed module is reported, not loaded', async () => {
  const { scenarios, errors } = await R.loadScenarios({ modules: [{ file: 'bad.mjs', module: { key: 'bad', title: 'x', group: 'weather', params: [], requires: [], run() {} } }, { file: '_example.mjs', module: good }] });
  assert.ok(errors.some(e => /group/.test(e)) && !scenarios.has('bad') && scenarios.has('_example'));
});
await ok('a scenario is not run when a required STATE field is null', () => {
  const s = { ...good, requires: [...good.requires, M === 'skip' ? 'mass_kg' : 'pcrit_kPa'] };
  const r = R.runScenario(s, st('zebrafish-adult', 90), {});
  assert.equal(r.ok, false); assert.deepEqual(r.missing, ['pcrit_kPa']);
});
await ok('results are validated against the declared metrics and provenance kinds', () => {
  const s = { ...good, run: (st_, p_) => { const r = good.run(st_, p_); r.metrics.push({ key: 'undeclared', value: 1, unit: '-', better: null, kind: 'invented', source: 'x' }); return r; } };
  const r = R.runScenario(s, st('zebrafish-adult', 90), {});
  assert.equal(r.ok, false); assert.ok(r.errors.some(e => /not in the scenario's declared metrics/.test(e)) && r.errors.some(e => /unknown kind/.test(e)));
});
await ok('out-of-range and unknown params are refused', () => {
  assert.equal(R.runScenario(good, st('zebrafish-adult', 90), { factor: 11 }).ok, false);
  assert.equal(R.runScenario(good, st('zebrafish-adult', 90), { nope: 1 }).ok, false);
});

console.log('\ntools (same handlers as MCP, CLI and HTTP)');
await ok('scenario_run returns the envelope, the lawset version and violations with parts', async () => {
  const r = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: '_example', ageDays: 90, params: { factor: 2 } });
  assert.ok(r.scope && r.weakest_input && r.result.run.ok && r.result.lawset_version);
  for (const v of r.result.violations) { assert.ok(v.law_id && v.law_version && v.lean_ref.constraint && ['physical', 'biological'].includes(v.kind) && Array.isArray(v.parts)); assert.equal(typeof v.baseline_violated, 'boolean'); }
});
await ok('an unedited organism has no NEW binding violations (baseline rows are flagged, not blamed on the edit)', async () => {
  const r = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: '_example', ageDays: 90 });
  assert.equal(r.result.new_binding_violations.length, 0);
  assert.ok(r.result.violations.every(v => v.baseline_violated === true));
});
await ok('organism_edit: tripling a 90 d flying fish\'s mass creates a NEW C7b (cube-law) violation on the body parts', async () => {
  const r = await T.organismEdit({ organism: 'flying-fish', ageDays: 90, edit: E({ level: 'body' }, 'body_mass_kg', 'scale', M === 'c7b' ? 1 : 3) });
  const v = r.result.new_binding_violations.find(x => x.lean_ref.constraint === 'C7b');
  assert.ok(v, 'no new C7b violation'); assert.ok(v.parts.includes('skin_L')); assert.equal(v.severity, 'red');
  assert.equal(r.result.doc.edits.at(-1).lawset_version, r.result.lawset_version);
});
await ok('organism_create + organism_edit persist a document; repository organisms are never overwritten', async () => {
  await T.organismCreate({ id: 'test-chimera', parents: [{ organism: 'flying-fish', weight: 0.3 }, { organism: 'zebrafish-adult', weight: 0.7 }] });
  await T.organismEdit({ organism: 'test-chimera', edit: E({ level: 'organ', id: 'gills_L' }, 'scale', 'set', 1.5) });
  const g = await T.organismGet({ organism: 'test-chimera', ageDays: 60 });
  assert.equal(g.result.origin, 'saved'); assert.equal(g.result.doc.edits.length, 1);
  await assert.rejects(T.organismCreate({ id: 'flying-fish', parents: [{ organism: 'zebrafish-adult', weight: 1 }] }), /repository organism/);
});
await ok('scenario_timecourse visits every zebrafish stage in stages.json', async () => {
  const r = await T.scenarioTimecourse({ organism: 'zebrafish-adult', scenario: '_example' });
  assert.deepEqual(r.result.stages.map(s => s.ageDays), M === 'stages' ? [0] : b.tracks.zebrafish.stages.map(s => s.age_days));
  assert.ok(r.result.stages.every(s => s.ok));
});

console.log('\noptimize');
await ok('maximising gill area per mass over gill scale drives the scale to its upper bound', async () => {
  const r = await T.optimize({ organism: 'zebrafish-adult', objective: { scenario: '_example', metric: 'gill_area_per_mass', ageDays: 90 },
    variables: [{ target: { level: 'organ', id: 'gills_L' }, param: 'scale', min: 0.5, max: 2 }], budget: 40, seed: 7 });
  assert.equal(r.result.status, 'ok');
  const x = r.result.best.values['organ:gills_L.scale'];
  assert.ok(x > (M === 'opt' ? 2.1 : 1.9), `best scale ${x}`);
});
await ok('the same seed gives the same answer', async () => {
  const a = { organism: 'zebrafish-adult', objective: { scenario: '_example', metric: 'gill_area_per_mass', ageDays: 90 }, variables: [{ target: { level: 'organ', id: 'gills_L' }, param: 'scale', min: 0.5, max: 2 }], budget: 15, seed: 3 };
  assert.deepEqual((await T.optimize(a)).result.best.values, (await T.optimize(a)).result.best.values);
});
await ok('candidates that break a Lean law are rejected with the law named', async () => {
  const r = await T.optimize({ organism: 'flying-fish', objective: { scenario: '_example', metric: 'gill_area_per_mass', ageDays: 90 },
    variables: [{ target: { level: 'body' }, param: 'body_mass_kg', min: 0.005, max: 0.2 }], budget: 30, seed: 2 });
  const lean = r.result.rejected.filter(x => x.reason === 'lean');
  assert.ok(lean.length > 0, 'no Lean rejections'); assert.ok(lean[0].laws[0].law_id && lean[0].laws[0].constraint);
});
await ok('an impossible hard constraint returns "no design meets the spec", not a best effort', async () => {
  const r = await T.optimize({ organism: 'zebrafish-adult', objective: { scenario: '_example', metric: 'gill_area_per_mass', ageDays: 90 },
    variables: [{ target: { level: 'organ', id: 'gills_L' }, param: 'scale', min: 0.5, max: 2 }],
    hard_constraints: [{ scenario: '_example', metric: 'mass_g', op: '>=', value: M === 'hard' ? 0 : 1000 }], budget: 10, seed: 1 });
  assert.equal(r.result.status, 'no design meets the spec'); assert.equal(r.result.best, null);
  assert.ok(r.result.rejected.every(x => x.reason === 'hard constraint'));
});

await ok('a flat objective returns the START design unchanged with status "no improvement", never ok', async () => {
  const r = await T.optimize({ organism: 'zebrafish-adult', objective: { scenario: '_example', metric: 'mass_g', direction: 'maximize', ageDays: 90 },
    variables: [{ target: { level: 'organ', id: 'gills_L' }, param: 'scale', min: 0.5, max: 2 }], budget: 12, seed: 4 });
  assert.equal(r.result.status, M === 'flat' ? 'ok' : 'no improvement'); assert.equal(r.result.best.values, 'start');
  assert.equal(r.result.best.doc.edits.length, 0); assert.ok(r.result.start.feasible);
});
await ok('scenario_list sees a scenario file the moment it lands (no restart)', async () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'scn-'));
  const src = fs.readFileSync(path.join(engine, 'scenarios', '_example.mjs'), 'utf8');
  fs.writeFileSync(path.join(dir, 'a.mjs'), src.replace("key: '_example'", "key: 'a_test'"));
  const one = await R.loadScenarios({ dir, bust: true });
  fs.writeFileSync(path.join(dir, 'b.mjs'), src.replace("key: '_example'", "key: 'b_test'"));
  const two = await R.loadScenarios({ dir, bust: true });
  assert.deepEqual([...one.scenarios.keys()], ['a_test']); assert.deepEqual([...two.scenarios.keys()].sort(), M === 'dyn' ? ['a_test'] : ['a_test', 'b_test']);
});
await ok("'feasible' is validated; a module without it reports null with a warning", () => {
  const noF = { ...good, run: (s_, p_) => { const r = good.run(s_, p_); delete r.feasible; return r; } };
  const r = R.runScenario(noF, st('zebrafish-adult', 90), {});
  assert.equal(r.ok, true); assert.equal(r.feasible, null); assert.ok(r.warnings?.length);
  const bad = { ...good, run: (s_, p_) => ({ ...good.run(s_, p_), feasible: 'yes' }) };
  assert.equal(R.runScenario(bad, st('zebrafish-adult', 90), {}).ok, false);
});
await ok('every envelope and contract.json carry contract_version', async () => {
  const { CONTRACT_VERSION } = await import('../lib/envelope.mjs');
  const r = await T.scenarioList();
  assert.equal(r.contract_version, CONTRACT_VERSION);
  assert.equal(JSON.parse(fs.readFileSync(path.join(engine, 'contract.json'), 'utf8')).contract_version, CONTRACT_VERSION);
});

console.log('\nco-design sessions (agents propose, humans decide)');
await ok('agent proposal -> human approval applies every edit once and records lawset version and violations', async () => {
  const o = await T.sessionOpen({ title: 'Gill study', author: 'human', organism: 'test-chimera' });
  const id = o.result.session;
  await T.sessionPost({ session: id, author: 'agent:physics', kind: 'comment', body: 'gills look small' });
  const run = await T.scenarioRun({ organism: 'test-chimera', scenario: '_example', ageDays: 60 });
  const pr = await T.sessionPost({ session: id, author: 'agent:physics', kind: 'proposal', rationale: 'more gill area per mass', evidence: [{ scenario: '_example', metrics: run.result.run.metrics }],
    edits: [E({ level: 'organ', id: 'gills_R' }, 'scale', 'set', 2), E({ level: 'organ', id: 'gills_L' }, 'scale', 'set', 2)] });
  const pid = pr.result.entry.proposal_id;
  const before = (await T.sessionRead({ session: id })).result.organism.edits.length;
  const d = await T.sessionDecide({ session: id, proposal_id: pid, decision: 'approve', decided_by_role: 'human', reason: 'agreed' });
  assert.ok(d.result.entry.lawset_version && Array.isArray(d.result.entry.violations));
  assert.equal(d.result.entry.applied.length, 2); assert.equal(d.result.entry.applied[0].approved_by, 'human'); assert.equal(d.result.entry.applied[0].proposal_id, pid);
  const r = await T.sessionRead({ session: id });
  assert.equal(r.result.organism.edits.length - before, M === 'decide' ? 3 : 2);
  assert.deepEqual(r.result.entries.map(x => x.type), ['open', 'comment', 'proposal', 'decision']);
  assert.equal(r.result.proposals[0].status, 'approved');
  await assert.rejects(T.sessionDecide({ session: id, proposal_id: pid, decision: 'reject', decided_by_role: 'human', reason: 'again' }), /already approved/);
});
await ok('an agent cannot edit directly or decide; a rejected proposal changes nothing', async () => {
  const id = (await T.sessionOpen({ title: 'Gate test', author: 'human', organism: 'test-chimera' })).result.session;
  await assert.rejects(T.sessionPost({ session: id, author: 'agent:physics', kind: 'edit', edits: [E({ level: 'organ', id: 'gills_R' }, 'scale', 'set', 3)] }), /only for author roles starting with 'human'/);
  const pid = (await T.sessionPost({ session: id, author: 'agent:physics', kind: 'proposal', rationale: 'r', edits: [E({ level: 'organ', id: 'gills_R' }, 'scale', 'set', 3)] })).result.entry.proposal_id;
  await assert.rejects(T.sessionDecide({ session: id, proposal_id: pid, decision: 'approve', decided_by_role: 'agent:physics', reason: 'self-approval' }), /starting with 'human'/);
  const n0 = (await T.sessionRead({ session: id })).result.organism.edits.length;
  await T.sessionDecide({ session: id, proposal_id: pid, decision: 'reject', decided_by_role: 'human:lead', reason: 'too big' });
  assert.equal((await T.sessionRead({ session: id })).result.organism.edits.length, n0);
  const h = await T.sessionPost({ session: id, author: 'human', kind: 'edit', edits: [E({ level: 'organ', id: 'gills_R' }, 'scale', 'set', 1.1)] });
  assert.equal(h.result.entry.applied, true);
});
await ok('a session author that is a personal identifier is refused; path traversal in ids is refused', async () => {
  await assert.rejects(T.sessionOpen({ title: 'x', author: 'jane.doe@example.org' }), /role label/);
  await assert.rejects(T.sessionRead({ session: '../../package' }), /slug/);
});

console.log('\nbundle shape (one type for node and browser)');
await ok('every bundle manifest is {objects:[...]} and every organism resolves at every stage age', () => {
  const man = M === 'shape' ? { ...b.manifests, 'zebrafish-dev-manifest.json': b.manifests['zebrafish-dev-manifest.json'].objects } : b.manifests;
  for (const [f, m] of Object.entries(man)) assert.ok(m && Array.isArray(m.objects) && m.objects.every(o => typeof o.object === 'string'), `${f} is not {objects:[{object}]}`);
  const bb = { ...b, manifests: man };
  for (const id of Object.keys(b.organisms)) for (const s of S.stageAges(bb, O.docFor(bb, id))) S.resolveState(O.docFor(bb, id), s.ageDays, {}, bb);
});
await ok('the browser bundle on disk has the same shape and organisms as the node bundle', () => {
  const f = path.resolve(engine, '..', 'dashboard', 'public', 'blueprint3d', 'engine', 'data', 'bundle.json');
  const disk = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.deepEqual(Object.keys(disk.organisms).sort(), Object.keys(b.organisms).sort());
  for (const m of Object.values(disk.manifests)) assert.ok(Array.isArray(m.objects), 'stale bundle: run node dashboard/build-engine.mjs');
  assert.ok(disk.ontogeny, 'bundle lacks ontogeny.json');
});

console.log('\npart ids and params shared with partedit.js');
const PEm = await import('../../dashboard/public/blueprint3d/partedit.js');
await ok('bilateral base names and ontology ids are accepted exactly as partedit resolves them', () => {
  const d = O.docFor(b, 'flying-fish');
  const r1 = O.resolveTarget(b, d, { level: 'organ', id: 'pectoral_fin' });
  assert.deepEqual(r1.parts, PEm.resolveTarget(O.primaryManifest(b, d), { level: 'organ', id: 'pectoral_fin' }).parts);
  assert.deepEqual(r1.parts.sort(), ['pectoral_fin_L', 'pectoral_fin_R']);
  assert.ok(O.resolveTarget(b, d, { level: 'organ', id: 'UBERON:0000151' }).parts.length >= 1);
  assert.throws(() => O.resolveTarget(b, d, { level: 'organ', id: M === 'pe' ? 'pectoral_fin' : 'pectoral_wing' }), /unknown organ/);
});
await ok('organism_list_parts lists partedit editableParams for each part', () => {
  const d = O.docFor(b, 'zebrafish-adult');
  const node = O.listParts(b, d).body.systems.flatMap(s => [...s.organs, ...s.tissues]).find(o => o.id === 'pectoral_fin_L');
  const pe = PEm.editableParams(O.primaryManifest(b, d), 'pectoral_fin_L').map(p => p.param);
  assert.deepEqual(node.editable.filter(e => e.source).map(e => e.param), pe);
});
await ok("partedit bounds and modes are enforced; fin 'area' x2 doubles STATE pectoral area, 'span:aspect' x1.1 adds x1.21", () => {
  const d0 = O.docFor(b, 'flying-fish');
  assert.throws(() => O.appendEdit(b, d0, E({ level: 'organ', id: 'pectoral_fin' }, 'area', 'scale', 50)), /outside partedit's bounds/);
  assert.throws(() => O.appendEdit(b, d0, E({ level: 'organ', id: 'pectoral_fin' }, 'span:sideways', 'scale', 1.1)), /mode/);
  const a0 = S.resolveState(d0, 365, {}, b).pectoral_area_both_m2.value;
  const d1 = O.appendEdit(b, d0, E({ level: 'organ', id: 'pectoral_fin' }, 'area', 'scale', M === 'finarea' ? 3 : 2));
  assert.ok(Math.abs(S.resolveState(d1, 365, {}, b).pectoral_area_both_m2.value / a0 - 2) < 1e-9);
  const d2 = O.appendEdit(b, d1, E({ level: 'organ', id: 'pectoral_fin' }, 'span:aspect', 'scale', 1.1));
  assert.ok(Math.abs(S.resolveState(d2, 365, {}, b).pectoral_area_both_m2.value / a0 - 2 * 1.21) < 1e-9);
});
await ok('a body "size" edit scales SL and mass at constant density (labelled as an assumption)', () => {
  const d = O.appendEdit(b, O.docFor(b, 'flying-fish'), E({ level: 'body' }, 'size', 'scale', 1.2));
  const s = S.resolveState(d, 365, {}, b);
  assert.ok(Math.abs(s.SL_m.value / 0.203 - 1.2) < 1e-9 && Math.abs(s.mass_kg.value / 0.06 - 1.728) < 1e-9);
  assert.ok(/constant density/.test(s.mass_kg.source));
});

console.log('\nontogeny.json (params/ONTOGENY.md rule)');
await ok('adult zebrafish density comes from ontogeny.json (Robertson 2008, measured) and wins over the engine null', () => {
  const s = st('zebrafish-adult', 180);
  assert.equal(s.body_density_kg_m3.value, 1010); assert.equal(s.body_density_kg_m3.kind, M === 'onto' ? 'borrowed' : 'measured');
  assert.ok(/Robertson/.test(s.body_density_kg_m3.source) && /ontogeny.json over the engine/.test(s.body_density_kg_m3.source_choice));
});
await ok('a reported range is carried as [lo, hi] with a derived midpoint (larval density 996-1000)', () => {
  const s = st('zebrafish-adult', 3).body_density_kg_m3;
  assert.deepEqual(s.range, [996, 1000]); assert.equal(s.value, 998); assert.equal(s.kind, 'derived');
});
await ok('nulls are never bridged: routine metabolic rate between the 60 d and 180 d rows stays null', () => {
  const s = st('zebrafish-adult', 120).routine_metabolic_rate_umol_g_h;
  assert.equal(s.value, M === 'bridge' ? s.value + 1 : null); assert.ok(/not bridged/.test(s.reason));
});
await ok('the larval allometry (Rombough & Drader 2009) is preferred inside its validity range', () => {
  const s = st('zebrafish-adult', 3), mg = s.mass_kg.value * 1e6;
  assert.ok(Math.abs(s.routine_metabolic_rate_umol_g_h.value - 46.1 * mg ** 0.825 / mg) < 1e-9);
  assert.ok(/Rombough/.test(s.routine_metabolic_rate_umol_g_h.source));
});
await ok('swim bladder follows the measured size threshold (pSB at 3.5 mm SL)', () => {
  assert.equal(st('zebrafish-adult', 0).has_swimbladder.value, false); assert.equal(st('zebrafish-adult', 1).has_swimbladder.value, true);
});
await ok('a two-species blend gets no single-species value (density null with a reason)', () => {
  const s = st('ff-zf-chimera', 60).body_density_kg_m3; assert.equal(s.value, null); assert.ok(s.reason);
});
await ok('larval mass carries the upper-bound flag from ontogeny.json conflicts (live mass 25-50 % below the law)', () => {
  assert.ok((st('zebrafish-adult', 10).mass_kg.flags || []).some(f => /UPPER BOUND/.test(f)));
});
await ok('fields scenarios declare in needs are present: lifting area (mesh), Qmax (borrowed), nulls with reasons', () => {
  const s = st('flying-fish', 365);
  assert.ok(Math.abs(s.lifting_area_m2.components.pectoral_m2 + s.lifting_area_m2.components.pelvic_plus_caudal_m2 - s.lifting_area_m2.value) < 1e-12);
  assert.equal(s.cardiac_output_max_ml_s.kind, 'borrowed');
  for (const k of ['myotomal_muscle_fraction', 'pcrit_kPa']) { assert.equal(s[k].value, null); assert.ok(s[k].reason); }
});

console.log('\nperturbation laws (P1-P5) fed from scenarios (lib/perturb-map.mjs)');
const Pv = (r, id) => r.result.verdicts.find(v => v.constraint === id);
await ok('unedited adult zebrafish at 28 C: P1 (thermal window) evaluates and holds', async () => {
  const r = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: 'temperature', params: { water_temperature_C: 28 } });
  assert.ok(r.result.verdicts.some(v => /^P/.test(v.constraint) && v.verdict === 'holds'), 'no P law holds');
  assert.equal(Pv(r, 'P1').verdict, 'holds');
  assert.equal(r.result.lean_inputs.spec.ct_max_C, r.result.run.metrics.find(m => m.key === 'ctmax_C').value);
});
// Severity follows the law's status as the registry states it (read, never hard-coded): accepted -> red,
// contested -> amber, candidate -> dashed ('candidate').
const SEVERITY = { accepted: 'red', contested: 'amber', candidate: 'candidate' };
await ok('zebrafish at 45 C (above CTmax): P1 violated, with the severity its registry status implies (red once accepted)', async () => {
  const r = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: 'temperature', params: { water_temperature_C: M === 'p1' ? 30 : 45 } });
  const v = r.result.violations.find(x => x.lean_ref.constraint === 'P1');
  assert.ok(v, 'P1 not violated');
  const status = r.result.verdicts.find(x => x.constraint === 'P1').status;
  assert.equal(v.severity, SEVERITY[status] || 'advisory', `status ${status} -> severity ${v.severity}`);
  assert.ok(v.parts.includes('skin_L'));
});
await ok('P3 (Boyle, v2 with rho and g) holds for a correct Boyle volume at 100 m and 1000 m', async () => {
  for (const d of [100, 1000]) {
    const r = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: 'pressure', params: { depth_m: d } });
    const sp = r.result.lean_inputs.spec;
    assert.ok(sp.water_density_kg_m3 > 0 && sp.g > 9 && sp.bladder_volume_at_depth_ml > 0, 'P3 inputs missing');
    assert.equal(r.result.verdicts.find(x => x.constraint === 'P3').verdict, M === 'p3' && d === 1000 ? 'violated' : 'holds', `depth ${d}`);
  }
});
await ok('a current above Ucrit violates P2; below it P2 holds', async () => {
  const lo = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: 'current', params: { current_m_s: 0.3 } });
  const hi = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: 'current', params: { current_m_s: 0.9 } });
  assert.equal(Pv(lo, 'P2').verdict, 'holds'); assert.equal(Pv(hi, 'P2').verdict, 'violated');
});
await ok('9000 m depth: the teleost depth cap (P3b) is contested, shown amber', async () => {
  const r = await T.scenarioRun({ organism: 'zebrafish-adult', scenario: 'pressure', params: { depth_m: M === 'p3b' ? 5000 : 9000 } });
  const v = r.result.violations.find(x => x.lean_ref.constraint === 'P3b');
  assert.ok(v, 'P3b not flagged'); assert.equal(v.severity, 'amber'); assert.equal(Pv(r, 'P3b').verdict, 'contested');
});
await ok('the Lean spec never carries a convention-mismatched input (no finArea_m2; Boyle volumes only with their rho and g)', async () => {
  for (const org of ['flying-fish', 'zebrafish-adult']) {
    const sp = (await T.scenarioRun({ organism: org, scenario: 'pressure', params: { depth_m: 50 } })).result.lean_inputs.spec;
    assert.ok(!('finArea_m2' in sp), 'finArea_m2 passed');
    if ('bladder_volume_at_depth_ml' in sp) assert.ok('water_density_kg_m3' in sp && 'g' in sp, 'Boyle volume without rho and g');
  }
});
await ok('flying-fish additions are merged as a second layer: logged, labelled, adult red muscle now the flying-fish value', () => {
  assert.ok(b.ontogeny.merge_log.length > 0 && b.ontogeny.layers.length === 2);
  const s = st('flying-fish', 365);
  assert.ok(/merged|ontogeny-flyingfish-additions|Khokiattiwong|dark/i.test(s.red_muscle_fraction.source + JSON.stringify(s.red_muscle_fraction)), 'red muscle not from the additions');
  assert.equal(s.red_muscle_fraction.kind, M === 'ffadd' ? 'borrowed' : 'derived');
  assert.ok(s.red_muscle_fraction.alternative && s.red_muscle_fraction.alternative.kind === 'borrowed', 'the trout proxy is kept as the alternative');
});
await ok('the adult flying-fish mass STATE uses stays the Park & Choi aerodynamic specimen (0.060 kg), with both roles labelled', () => {
  const s = st('flying-fish', 365);
  assert.equal(s.mass_kg.value, 0.06);
  assert.ok((s.mass_kg.flags || []).some(f => /ROLE: aerodynamic specimen/.test(f) && /0\.1316/.test(f)));
});

await ok('regression (codesign-demo): approved winged-zebrafish fin, what-if 10 m/s launch from 1 m -> C15 holds on the Lean-covered part; the total is reported separately', async () => {
  const ff = O.resolveParameters(b, O.docFor(b, 'flying-fish')).params.pectoral_area_over_SL2.value;
  const doc = O.appendEdit(b, O.docFor(b, 'winged-zebrafish'), E({ level: 'body' }, 'pectoral_area_over_SL2', 'set', ff));
  const r = await T.scenarioRun({ organism: doc, scenario: 'glide', params: { launch_height_m: 1, launch_airspeed_override_m_s: 10 } });
  const m = k => r.result.run.metrics.find(x => x.key === k).value;
  const total = m('glide_range_total_m'), lean = m('glide_range_lean_bound_m');
  assert.ok(total > lean + 1, `total ${total} should exceed the Lean-covered ${lean} (kinetic phase)`);
  const spec = M === 'c15' ? { ...r.result.lean_inputs.spec, glideDistance_m: total } : r.result.lean_inputs.spec;
  assert.equal(spec.glideDistance_m, lean, 'C15 must be fed the Lean-covered part only');
  assert.notEqual(spec.glideDistance_m, total);
  assert.equal(r.result.verdicts.find(v => v.constraint === 'C15').verdict, 'holds');
  assert.ok(/NOT covered/.test(r.result.run.metrics.find(x => x.key === 'glide_range_total_m').source));
});

console.log('\nserver and CLI');
await ok('contract.json lists all twelve studio tools (regenerate with --dump-contract)', () => {
  const c = JSON.parse(fs.readFileSync(path.join(engine, 'contract.json'), 'utf8'));
  for (const n of ['organism_create', 'organism_get', 'organism_list_parts', 'organism_edit', 'scenario_list', 'scenario_run', 'scenario_timecourse', 'optimize', 'session_open', 'session_post', 'session_decide', 'session_read'])
    assert.ok(c.tools.some(t => t.name === n), `${n} missing`);
});
await ok('the CLI runs a scenario and prints JSON', () => {
  const out = execFileSync(process.execPath, [path.join(engine, 'cli.mjs'), 'scenario', 'run', '--organism', 'zebrafish-adult', '--scenario', '_example', '--age', '90', '--param', 'factor=2', '--compact'], { encoding: 'utf8', env: process.env });
  const r = JSON.parse(out);
  assert.ok(Math.abs(r.result.run.metrics[0].value - 2 * r.result.state.values.gill_area_m2 / r.result.state.values.mass_kg) < 1e-9);
});

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed${M ? ` (MUTATE=${M})` : ''}`);
process.exit(fail ? 1 : 0);
