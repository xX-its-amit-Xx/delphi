#!/usr/bin/env node
// node sim-engine/scales/test/mesh.mjs
//
// The illustration meshes. A mesh is the easiest way in this repository to make something look known that is
// not: a smooth fly with a brain in it reads as "this design has a brain". So what is pinned here is the
// contract that keeps the mesh an ILLUSTRATION -- every node names a real slot of its frame, every GLB says
// schematic-illustration and THIS_IS_NOT_MORPHOMETRY, budgets hold, the holdout clade never appears -- and the
// rule that nothing launches Blender unless someone asked for meshes (proved with a sentinel that would leave
// a file behind, after first proving the sentinel works).
//
// No side effects: no bundle, ladder or GLB in the repository is written. Temporary files go to os.tmpdir().
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { meshSpec, specHash, stageKeyFor, hashInput, SCULPTED, STAGE_KEYS } from '../mesh/spec.mjs';
import { findBlender, buildMesh, meshField, wantMeshes, pruneMeshes, framesTouched, blenderWhyNot, MESH_DIR, GENERATED } from '../mesh/blender.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const FRAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'sim-engine', 'scales', 'body-frames.json'), 'utf8')).frames;
const BAKE = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'scales');
const MESH_SRC = path.join(ROOT, 'sim-engine', 'scales', 'mesh');
const RUNS = ['long-lived-fruit-fly', 'flying-mouse', 'carbon-eating-bacterium', 'xenobot'];
const STATUSES = ['cached', 'built', 'no-blender', 'failed', 'not-requested'];

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok    ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n          ' + String(e.message).split('\n').join('\n          ')); } };
const bundles = Object.fromEntries(RUNS.filter(r => fs.existsSync(path.join(BAKE, `${r}.json`))).map(r => [r, JSON.parse(fs.readFileSync(path.join(BAKE, `${r}.json`), 'utf8'))]));
const ladders = r => Object.values(bundles[r]?.ladders ?? {});
const withEnv = (vars, fn) => {
  const old = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  try { return fn(); } finally { for (const [k, v] of Object.entries(old)) { if (v == null) delete process.env[k]; else process.env[k] = v; } }
};

function readGlb(file) {
  const d = fs.readFileSync(file);
  assert.equal(d.toString('latin1', 0, 4), 'glTF', `${path.basename(file)} is not a GLB`);
  assert.equal(d.readUInt32LE(4), 2, 'glTF version 2');
  assert.equal(d.readUInt32LE(8), d.length, 'GLB length field matches the file');
  const len = d.readUInt32LE(12);
  assert.equal(d.readUInt32LE(16), 0x4E4F534A, 'first chunk is JSON');
  return { js: JSON.parse(d.toString('utf8', 20, 20 + len)), bytes: d.length };
}
const glbs = fs.existsSync(MESH_DIR) ? fs.readdirSync(MESH_DIR).filter(f => f.endsWith('.glb')) : [];

console.log('\nspec');
ok('stage keys come from keywords on the DECLARED label, per frame', () => {
  const cases = { insect: { egg: 'egg', 'third-instar larva': 'larva', 'first instar': 'larva', pupa: 'pupa', 'pupal stage': 'pupa', adult: 'adult', imago: 'adult', embryo: 'egg' },
    tetrapod: { neonate: 'neonate', newborn: 'neonate', 'juvenile, around weaning': 'juvenile', weanling: 'juvenile', adult: 'adult' },
    prokaryote: { 'lag phase': 'lag', 'exponential growth': 'growing', 'log phase': 'growing', 'stationary phase': 'stationary' },
    construct: { 'working life': 'default', adult: 'default' } };
  for (const [f, m] of Object.entries(cases)) for (const [label, key] of Object.entries(m)) assert.equal(stageKeyFor(f, label).key, key, `${f} "${label}"`);
});
ok('an unmatched label maps to the frame default and says why', () => {
  for (const [f, def] of [['insect', 'adult'], ['tetrapod', 'adult'], ['prokaryote', 'growing']]) {
    const m = stageKeyFor(f, 'a stage nobody has a word for');
    assert.equal(m.key, def); assert.equal(m.unmatched, true); assert.match(m.matched_by, /no keyword/);
  }
  const s = meshSpec({ frame: { name: 'insect' }, timeline: { points: [{ stage: 'quiescent', age_days: 3 }] } });
  assert.deepEqual(s.stages.map(x => x.key), ['adult']);
  assert.match(s.notes.join(' '), /no keyword/);
});
ok('no declared stage -> one default form per frame', () => {
  for (const [f, k] of [['insect', 'adult'], ['tetrapod', 'adult'], ['prokaryote', 'growing'], ['construct', 'default']]) {
    const s = meshSpec({ frame: { name: f }, timeline: { points: [] } });
    assert.deepEqual(s.stages.map(x => x.key), [k], f);
    assert.deepEqual(s.stage_of_point, []);
  }
});
ok('the four runs map to the stage keys their declarations imply', () => {
  const want = { 'long-lived-fruit-fly': ['egg', 'larva', 'pupa', 'adult'], 'carbon-eating-bacterium': ['lag', 'growing', 'stationary'], xenobot: ['default'] };
  for (const [r, keys] of Object.entries(want)) {
    const l = ladders(r).find(x => (x.timeline?.points ?? []).length);
    assert.ok(l, `${r} has a ladder with an age track`);
    assert.deepEqual(meshSpec(l).stages.map(s => s.key), keys, r);
  }
  const m4 = bundles['flying-mouse']?.ladders?.['4'];
  assert.deepEqual(meshSpec(m4).stages.map(s => s.key), ['neonate', 'juvenile', 'adult']);
  assert.deepEqual(meshSpec(bundles['flying-mouse'].ladders['0']).stages.map(s => s.key), ['adult']);
});
ok('specs are deterministic, and stage_of_point has one key per timeline point', () => {
  for (const r of RUNS) for (const l of ladders(r)) {
    const a = meshSpec(l), b = meshSpec(JSON.parse(JSON.stringify(l)));
    assert.deepEqual(a, b, `${r} gen ${l.generation}`);
    assert.equal(specHash(a), specHash(b));
    assert.equal(a.stage_of_point.length, (l.timeline?.points ?? []).length);
    assert.match(specHash(a), /^[0-9a-f]{12}$/);
  }
});
ok('generations that share frame + stages share one mesh hash', () => {
  const hashes = r => [...new Set(ladders(r).filter(l => (l.parts ?? []).length).map(l => specHash(meshSpec(l))))];
  assert.equal(hashes('long-lived-fruit-fly').length, 1, 'fly gens 1-4');
  assert.equal(hashes('xenobot').length, 1, 'xenobot gens 0-3');
  assert.equal(hashes('carbon-eating-bacterium').length, 1, 'bacterium gens 1-5');
  assert.equal(hashes('flying-mouse').length, 2, 'mouse: gens 0-3 declare no stage, gen 4 declares three');
});
ok('the hash moves with frame, stage keys, drivers and generator version, and with nothing else', () => {
  const l = ladders('long-lived-fruit-fly').find(x => (x.timeline?.points ?? []).length);
  const s = meshSpec(l), h = specHash(s);
  assert.equal(specHash({ ...s, stages: s.stages.map(x => ({ ...x, label: 'renamed', age_days: 99 })), notes: ['x'], driver_notes: ['y'] }), h);
  assert.notEqual(specHash({ ...s, stages: s.stages.slice(1) }), h);
  assert.notEqual(specHash({ ...s, drivers: { span: { value: 1, unit: 'bl', basis: 'declared', source: 't' } } }), h);
  assert.notEqual(specHash({ ...s, generator_version: '9.9.9+deadbeef' }), h);
  assert.deepEqual(Object.keys(hashInput(s)).sort(), ['drivers', 'frame', 'generator_version', 'stages']);
});
ok('a declared lifting area without a body length does not size the patagium, and says so', () => {
  const s = meshSpec(bundles['flying-mouse'].ladders['4']);
  assert.deepEqual(s.drivers, {});
  assert.match(s.driver_notes.join(' '), /schematic proportions/);
});
ok('every spec carries the illustration basis and THIS_IS_NOT_MORPHOMETRY', () => {
  const s = meshSpec(ladders('xenobot')[0]);
  assert.equal(s.geometry_basis, 'schematic-illustration');
  assert.match(s.THIS_IS_NOT_MORPHOMETRY, /ILLUSTRATION/);
  assert.match(s.THIS_IS_NOT_MORPHOMETRY, /not simulated/);
});

console.log('\nno Blender unless asked');
ok('the --meshes / DELPHI_MESH rule', () => {
  assert.equal(wantMeshes([], {}), false);
  assert.equal(wantMeshes(['--meshes'], {}), true);
  assert.equal(wantMeshes([], { DELPHI_MESH: '1' }), true);
  assert.equal(wantMeshes(['--meshes'], { DELPHI_MESH: '0' }), false);
  assert.equal(wantMeshes([], { DELPHI_MESH: 'yes' }), false);
});
ok('DELPHI_BLENDER=none -> no Blender, and a build says no-blender without spawning', () => {
  withEnv({ DELPHI_BLENDER: 'none' }, () => {
    assert.equal(findBlender(), null);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-mesh-test-'));
    try {
      const r = buildMesh(meshSpec(ladders('xenobot')[0]), { force: true, outDir: tmp });
      assert.equal(r.status, 'no-blender');
      assert.match(r.why, /DELPHI_BLENDER/);
      assert.equal(fs.readdirSync(tmp).length, 0, 'nothing written');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
});
ok('a DELPHI_BLENDER that points at nothing says exactly that, not "set DELPHI_BLENDER"', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-mesh-missing-'));
  const gone = path.join(tmp, 'no-such-dir', 'blender.exe');
  try {
    withEnv({ DELPHI_BLENDER: gone }, () => {
      assert.equal(findBlender(), null);
      const r = buildMesh(meshSpec(ladders('xenobot')[0]), { force: true, outDir: tmp });
      assert.equal(r.status, 'no-blender');
      assert.ok(r.why.includes(gone), `the reason does not name the path: ${r.why}`);
      assert.match(r.why, /points at .* no file exists there/);
      assert.doesNotMatch(r.why, /^Blender not found/);
    });
    withEnv({ DELPHI_BLENDER: tmp }, () => {
      assert.equal(findBlender(), null, 'a folder is not an executable');
      assert.match(blenderWhyNot(), /which is a folder/);
    });
    // positive control: with no override the generic text is used, and 'none' says it is switched off
    assert.match(blenderWhyNot({}), /^Blender not found/);
    assert.match(blenderWhyNot({ DELPHI_BLENDER: 'none' }), /switched off: DELPHI_BLENDER=none/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
ok('with DELPHI_MESH unset nothing spawns Blender (sentinel, proven live first)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-mesh-sentinel-'));
  const mark = path.join(tmp, 'SPAWNED');
  const sentinel = path.join(tmp, 'sentinel.mjs');
  fs.writeFileSync(sentinel, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(mark)}, process.argv.slice(2).join(' '));\n`);
  try {
    withEnv({ DELPHI_BLENDER: sentinel, DELPHI_MESH: undefined }, () => {
      const l = ladders('xenobot')[0];
      // 1. The sentinel works: asked explicitly to build, it IS spawned and leaves its mark (and no GLB).
      const r = buildMesh(meshSpec(l), { force: true, outDir: tmp });
      assert.ok(fs.existsSync(mark), 'the positive control did not spawn the sentinel, so the negative test would prove nothing');
      assert.equal(r.status, 'failed');
      fs.unlinkSync(mark);
      // 2. The build path with the flag unset: build.mjs computes want = wantMeshes(argv, env).
      const want = wantMeshes(['node', 'build.mjs', '--run', 'xenobot'], process.env);
      assert.equal(want, false);
      for (const r2 of RUNS) for (const lad of ladders(r2)) {
        const m = meshField(lad, { want, outDir: tmp });
        assert.equal(m.status, 'not-requested');
        assert.equal(m.blender, null);
      }
      assert.ok(!fs.existsSync(mark), 'something spawned the sentinel with DELPHI_MESH unset');
      assert.deepEqual(fs.readdirSync(tmp).sort(), ['sentinel.mjs']);
    });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
ok('build.mjs decides meshes with exactly that rule, and theatre.mjs only adds --meshes on a launch', () => {
  const b = fs.readFileSync(path.join(ROOT, 'sim-engine', 'scales', 'build.mjs'), 'utf8');
  assert.match(b, /const MESHES = wantMeshes\(process\.argv, process\.env\)/);
  assert.match(b, /ladder\.mesh = meshField\(ladder, \{ want: MESHES/);
  assert.match(b, /if \(MESHES\) \{[\s\S]*const frames = framesTouched\(BUILT\);\s*const removed = pruneMeshes\(keep, \{ frames \}\)/);
  const t = fs.readFileSync(path.join(ROOT, 'sim-engine', 'tools', 'theatre.mjs'), 'utf8');
  assert.match(t, /meshes = process\.env\.DELPHI_MESH !== '0'/);
  assert.match(t, /if \(!wanted\) \{[\s\S]*return out;\s*\}\s*\n\s*if \(wantRebuild && run\) out\.build = rebuild\(run\)/);
  const h = fs.readFileSync(path.join(ROOT, 'runs', '_lib', 'studio-run.mjs'), 'utf8');
  assert.match(h, /if \(process\.env\.DELPHI_MESH == null\) process\.env\.DELPHI_MESH = '1';/);
});
ok('a run builds its mesh headless too (DELPHI_OPEN=0), unless DELPHI_MESH=0, with room for a Blender build', () => {
  const h = fs.readFileSync(path.join(ROOT, 'runs', '_lib', 'studio-run.mjs'), 'utf8');
  assert.match(h, /const MESH = \(\) => process\.env\.DELPHI_MESH !== '0';/);
  assert.match(h, /if \(!LIVE\(\) && !MESH\(\)\) return;/, 'relive() must not skip a headless run that wants meshes');
  assert.match(h, /'--quiet', \.\.\.\(MESH\(\) \? \['--meshes'\] : \[\]\)\][\s\S]{0,120}timeout: 600000/);
  const fm = fs.readFileSync(path.join(ROOT, 'runs', 'flying-mouse', 'run.mjs'), 'utf8');
  assert.match(fm, /if \(process\.env\.DELPHI_MESH == null\) process\.env\.DELPHI_MESH = '1';/);
  assert.match(fm, /if \(process\.env\.DELPHI_OPEN !== '0' \|\| process\.env\.DELPHI_MESH !== '0'\) \{/);
  assert.match(fm, /'flying-mouse', '--quiet', \.\.\.\(process\.env\.DELPHI_MESH !== '0' \? \['--meshes'\] : \[\]\)\][^\n]*timeout: 600000/);
  assert.doesNotMatch(fm, /timeout: 180000/);
});
ok('pruneMeshes only ever touches generator-named files of the frames this invocation built', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-mesh-prune-'));
  try {
    const all = ['insect-0123456789ab.glb', 'insect-0123456789ab.json', 'insect-ffffffffffff.glb', 'tetrapod-aaaaaaaaaaaa.glb', 'tetrapod-aaaaaaaaaaaa.json', 'README.md', 'hand-made.glb'];
    for (const f of all) fs.writeFileSync(path.join(tmp, f), 'x');
    const keep = new Set(['insect-0123456789ab.glb', 'insect-0123456789ab.json']);
    // no frames: nothing is removed (a build that made no mesh has no business pruning)
    assert.deepEqual(pruneMeshes(keep, { dir: tmp }), []);
    // insect built: only the unreferenced insect file goes; the unreferenced TETRAPOD files are another frame's
    const removed = pruneMeshes(keep, { frames: ['insect'], dir: tmp });
    assert.deepEqual(removed, ['insect-ffffffffffff.glb']);
    assert.deepEqual(fs.readdirSync(tmp).sort(), all.filter(f => f !== 'insect-ffffffffffff.glb').sort());
    // positive control: with tetrapod in frames, its unreferenced files do go
    assert.deepEqual(pruneMeshes(keep, { frames: ['tetrapod'], dir: tmp }).sort(), ['tetrapod-aaaaaaaaaaaa.glb', 'tetrapod-aaaaaaaaaaaa.json']);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  // the frames come from what meshField built or reused, never from a failed or skipped build
  const built = new Map([['insect-0123456789ab', { r: { status: 'cached' } }], ['tetrapod-aaaaaaaaaaaa', { r: { status: 'failed' } }],
    ['construct-bbbbbbbbbbbb', { r: { status: 'built' } }], ['prokaryote-cccccccccccc', { r: { status: 'no-blender' } }]]);
  assert.deepEqual([...framesTouched(built)].sort(), ['construct', 'insect']);
});

console.log('\nbundles');
ok('every ladder carries a mesh block in the contract shape', () => {
  for (const r of RUNS) for (const l of ladders(r)) {
    const m = l.mesh;
    assert.ok(m, `${r} gen ${l.generation} has no ladder.mesh`);
    assert.ok(STATUSES.includes(m.status), `${r} gen ${l.generation} status ${m.status}`);
    for (const k of ['glb', 'manifest', 'hash', 'frame', 'stages', 'stage_of_point', 'blender', 'why']) assert.ok(k in m, `${r} gen ${l.generation} mesh lacks ${k}`);
    assert.equal(m.frame, l.frame.name);
    assert.equal(m.stage_of_point.length, (l.timeline?.points ?? []).length);
    if (m.hash) assert.equal(m.hash, specHash(meshSpec(l)), `${r} gen ${l.generation}: the bundle's hash is stale`);
    if (m.glb) {
      assert.match(m.glb, /^meshes\/[a-z]+-[0-9a-f]{12}\.glb$/);
      assert.equal(m.glb, `meshes/${m.frame}-${m.hash}.glb`);
      if (['built', 'cached'].includes(m.status)) assert.ok(fs.existsSync(path.join(MESH_DIR, path.basename(m.glb))), `${m.glb} is ${m.status} and missing`);
    }
  }
});
ok('a frame with no sculptor and a generation with no body get no mesh, and say why', () => {
  const b0 = bundles['carbon-eating-bacterium']?.ladders?.['0'];
  assert.equal(b0.mesh.glb, null); assert.match(b0.mesh.why, /no sculptor|no body/);
  const f0 = bundles['long-lived-fruit-fly']?.ladders?.['0'];
  assert.equal(f0.mesh.glb, null); assert.match(f0.mesh.why, /no body/);
});

console.log('\nGLBs');
ok(`there is a GLB for every sculpted frame (${glbs.length} in meshes/)`, () => {
  for (const f of SCULPTED) assert.ok(glbs.some(g => g.startsWith(`${f}-`)), `no ${f} GLB: run node sim-engine/scales/build.mjs --meshes`);
  for (const g of glbs) assert.match(g, GENERATED);
});
for (const g of glbs) {
  ok(`${g}: parses, names only real slots and sides, stage roots, extras, budget`, () => {
    const { js, bytes } = readGlb(path.join(MESH_DIR, g));
    const frame = g.split('-')[0], hash = g.slice(frame.length + 1, -4);
    const slots = Object.fromEntries((FRAMES[frame]?.slots ?? []).map(s => [s.slot, s]));
    assert.ok(Object.keys(slots).length, `unknown frame ${frame}`);
    assert.ok(bytes <= 4 * 1024 * 1024, `${bytes} bytes > 4 MB`);
    const scene = js.scenes[js.scene ?? 0], ex = scene.extras ?? {};
    assert.equal(ex.frame, frame); assert.equal(ex.spec_hash, hash);
    assert.equal(ex.geometry_basis, 'schematic-illustration');
    assert.match(String(ex.THIS_IS_NOT_MORPHOMETRY ?? ''), /ILLUSTRATION/);
    assert.ok(ex.generator_version);
    assert.ok(Array.isArray(ex.stages) && ex.stages.length, 'scene extras list the stages');
    for (const k of ex.stages) assert.ok((STAGE_KEYS[frame] ?? []).includes(k), `stage ${k} is not a ${frame} stage key`);
    const rootNames = scene.nodes.map(i => js.nodes[i].name);
    for (const k of ex.stages) assert.ok(rootNames.includes(`stage:${k}`), `no root stage:${k}`);
    const seen = new Set();
    const tris = {};
    const walk = (i, stage, owner = null) => {
      const n = js.nodes[i], e = n.extras ?? {};
      if (n.name.startsWith('slot:')) {
        const [, slot, side, idx] = n.name.split(':');
        assert.ok(slots[slot], `${n.name}: "${slot}" is not a slot of the ${frame} frame`);
        const paired = slots[slot].side === 'paired';
        const s = side ?? 'single';
        assert.ok(paired ? ['left', 'right'].includes(s) : s === 'single', `${n.name}: side ${s} for a ${slots[slot].side} slot`);
        if (idx != null) { assert.match(idx, /^\d+$/); if (slots[slot].repeat) assert.ok(Number(idx) < slots[slot].repeat, `${n.name}: repeat index`); }
        assert.equal(e.slot, slot); assert.equal(e.side, s); assert.equal(e.stage, stage);
        assert.equal(e.geometry_basis, 'schematic-illustration', `${n.name} extras.geometry_basis`);
        seen.add(slot);
      } else if (n.name.startsWith('deco:')) {
        // Every deco hangs under a slot node of its own slot. Free 'deco:body:*' pieces (an egg's chorion, styled
        // with the body) are no longer made: they are parented to a slot, so they are shown, hidden and ghosted
        // with it (or by their own extras.requires), and a GLB that still has one fails here.
        const slot = n.name.split(':')[1];
        assert.ok(slots[slot], `${n.name}: a deco must belong to a slot of the frame (a free deco:body:* is not allowed any more)`);
        assert.ok(owner, `${n.name}: a deco must hang under a slot: node`);
        assert.equal(slot, owner, `${n.name}: hangs under a slot:${owner} node but names slot ${slot}`);
        assert.equal(e.slot, slot, `${n.name}: extras.slot`);
        assert.equal(e.geometry_basis, 'schematic-illustration');
      } else if (!n.name.startsWith('stage:')) assert.fail(`node "${n.name}" is neither slot:, deco: nor stage:`);
      if (n.mesh != null) for (const p of js.meshes[n.mesh].primitives) tris[stage] = (tris[stage] ?? 0) + (p.indices != null ? js.accessors[p.indices].count : js.accessors[p.attributes.POSITION].count) / 3;
      const own = n.name.startsWith('slot:') ? n.name.split(':')[1] : owner;
      for (const c of n.children ?? []) walk(c, stage, own);
    };
    for (const i of scene.nodes) { const n = js.nodes[i]; assert.match(n.name, /^stage:/); walk(i, n.extras?.stage ?? n.name.slice(6)); }
    for (const [st, t] of Object.entries(tris)) assert.ok(t <= 150000, `stage ${st}: ${t} triangles > 150k`);
    const missing = Object.keys(slots).filter(s => !seen.has(s));
    assert.deepEqual(missing, [], `slots of the ${frame} frame with no node in any stage`);
  });
  ok(`${g}: its manifest matches it`, () => {
    const { js } = readGlb(path.join(MESH_DIR, g));
    const man = JSON.parse(fs.readFileSync(path.join(MESH_DIR, g.replace(/\.glb$/, '.json')), 'utf8'));
    const scene = js.scenes[js.scene ?? 0];
    assert.equal(man.spec_hash, scene.extras.spec_hash);
    assert.equal(man.frame, scene.extras.frame);
    assert.equal(man.generator_version, scene.extras.generator_version);
    assert.equal(man.geometry_basis, 'schematic-illustration');
    assert.match(man.THIS_IS_NOT_MORPHOMETRY, /ILLUSTRATION/);
    assert.deepEqual(man.stages.map(s => s.key), scene.extras.stages);
    assert.equal(man.glb, g);
    assert.equal(man.glb_bytes, fs.statSync(path.join(MESH_DIR, g)).size);
    assert.deepEqual(man.problems, []);
    const glbNames = js.nodes.map(n => n.name).filter(n => !n.startsWith('stage:')).sort();
    assert.deepEqual(man.nodes.map(n => n.name).sort(), glbNames, 'manifest nodes != GLB nodes');
    for (const n of man.nodes) { assert.equal(n.geometry_basis, 'schematic-illustration'); assert.ok(['schematic', 'declared'].includes(n.proportions)); }
    for (const s of man.stages) assert.ok(s.triangles <= 150000 && s.within_budget, `stage ${s.key} over budget`);
    const decl = Object.values(man.drivers ?? {});
    for (const d of decl) { assert.equal(d.basis, 'declared'); assert.ok(d.source, 'a declared driver carries its source'); }
  });
}
ok('every GLB in meshes/ is referenced by some bundle (prune keeps the folder honest)', () => {
  const refs = new Set();
  for (const r of RUNS) for (const l of ladders(r)) if (l.mesh?.glb) refs.add(path.basename(l.mesh.glb));
  for (const g of glbs) assert.ok(refs.has(g), `${g} is referenced by no bundle`);
});

console.log('\nholdout and honesty');
// sha256 (first 16 hex) of the words the holdout forbids: the class name, its common name, the words for its
// body covering. Stored as hashes so this file never contains the words it guards against.
const FORBIDDEN = new Set(['b52115ea553c55b7', 'e9d9d0f618e05c97', 'c7ea645e8c0fa309', '6687f6a53414dfcc', '4b2dec70dd266eea',
  '2024d30bbb27a048', '7a5179eecc0fe187', '7f14eadc80600546', 'ae3960d86122fb13', 'f63a5fe50aaff5dd', 'f514d030cf4ff34e']);
const tokenHit = text => [...new Set(text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [])].filter(w => FORBIDDEN.has(crypto.createHash('sha256').update(w).digest('hex').slice(0, 16)));
ok('no file under mesh/ or meshes/ (GLB JSON included) names the held-out clade or its body covering', () => {
  const files = [...fs.readdirSync(MESH_SRC, { recursive: true }).map(f => path.join(MESH_SRC, String(f))),
    ...(fs.existsSync(MESH_DIR) ? fs.readdirSync(MESH_DIR).map(f => path.join(MESH_DIR, f)) : [])].filter(f => fs.statSync(f).isFile() && !/__pycache__/.test(f));
  assert.ok(files.length > 8);
  for (const f of files) {
    const text = f.endsWith('.glb') ? JSON.stringify(readGlb(f).js) : fs.readFileSync(f, 'utf8');
    assert.deepEqual(tokenHit(text), [], `${path.relative(ROOT, f)}`);
  }
  // The positive control: the check does fire on the words it is meant to catch.
  assert.equal(tokenHit(Buffer.from('cGx1bWFnZQ==', 'base64').toString()).length, 1);
});
ok('the repository leak gate finds nothing in mesh/ or meshes/', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'holdout', 'check-leaks.mjs'), '--json', MESH_SRC, MESH_DIR], { encoding: 'utf8', cwd: ROOT });
  const j = JSON.parse(r.stdout);
  assert.deepEqual(j.hits, []);
  assert.equal(j.warns, 0);
});
ok('the page says it is an illustration, ghosts and hides honestly, and keeps the three.js fallback', () => {
  const js = fs.readFileSync(path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'theatre.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'theatre.html'), 'utf8');
  assert.match(js, /illustration sculpted in Blender — shapes are not measured/);
  assert.match(js, /nothing is interpolated between stages and development is not simulated/);
  assert.match(js, /not in this blueprint/);
  assert.match(js, /mesh not built: Blender not found \(set DELPHI_BLENDER\)/);
  assert.match(js, /mesh not built: DELPHI_BLENDER points at a file that does not exist/);
  assert.match(js, /mesh not built: DELPHI_BLENDER points at a folder/);
  assert.match(js, /mesh build failed: /);
  assert.match(js, /three\.js did not load/);
  assert.match(html, /show what this blueprint lacks/);
  assert.match(html, /cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/build\/three\.module\.js/);
  assert.match(html, /examples\/jsm\//);
  for (const k of ['mode(', 'meshState(', 'stage(']) assert.ok(js.includes(`  ${k}`), `window.THEATRE.${k} missing`);
});
ok('every sculptor exposes build(spec, lib, stage) and names nodes only through lib.part / lib.deco', () => {
  for (const f of SCULPTED) {
    const src = fs.readFileSync(path.join(MESH_SRC, 'frames', `${f}.py`), 'utf8');
    assert.match(src, /^def build\(spec, lib, stage\):/m, f);
    assert.ok(!/\['node'\]\s*=/.test(src), `${f}.py sets node names by hand`);
  }
});

// ================================================================================================================
// DEPICTS: pieces that show ONE SPECIFIC PART (node extras.requires).
// A deco is otherwise shown whenever its parent slot is: the xenobot's surface is solid, so its cilia tufts were
// drawn solid although the ladder's multiciliated cell (CL_0005012) is a ghost. A node with extras.requires is
// styled by THAT part's state (sim-engine/scales/mesh/depicts.mjs); theatre.js carries a verbatim copy of the rule.
// This section is self-contained: it imports only what it uses and reuses only readGlb / bundles / ok from above.
console.log('\ndepicts (extras.requires)');
{
  const { depictState, requiresProblems, depictsBlock } = await import('../mesh/depicts.mjs');
  const THEATRE = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'theatre.js');
  const DEPICTS = path.join(MESH_SRC, 'depicts.mjs');
  const FRAME_OF_RUN = { 'long-lived-fruit-fly': 'insect', 'flying-mouse': 'tetrapod', 'carbon-eating-bacterium': 'prokaryote', xenobot: 'construct' };
  const req = {};   // glb -> [{name, requires}]
  for (const g of glbs) req[g] = readGlb(path.join(MESH_DIR, g)).js.nodes.filter(n => n.extras?.requires != null).map(n => ({ name: n.name, requires: n.extras.requires }));
  const summary = r => ({ state: r.state, by: r.by, rep: r.rep?.id ?? null, matched: r.matched.map(p => p.id), related: r.related.map(p => p.id), valid: r.valid });
  // The theatre's copy, evaluated on its own (it is plain functions, no page state).
  const theatreSrc = fs.readFileSync(THEATRE, 'utf8');
  const theatreBlock = depictsBlock(theatreSrc);
  const theatreDepictState = theatreBlock ? new Function(`${theatreBlock}\nreturn depictState;`)() : null;

  ok('every node with extras.requires names something: a non-empty list of ontology ids or /regex/flags that compile', () => {
    let n = 0;
    for (const [g, list] of Object.entries(req)) for (const x of list) {
      n++;
      assert.ok(/^(slot|deco):/.test(x.name), `${g}: ${x.name} carries requires but is not a slot: or deco: node`);
      assert.deepEqual(requiresProblems(x.requires), [], `${g}: ${x.name}`);
    }
    assert.ok(n >= 2, `only ${n} requires node(s) found; the construct's cilia and multiciliated cells should carry it`);
    // positive control: the check does reject what it should
    assert.ok(requiresProblems([]).length && requiresProblems(['not an id']).length && requiresProblems(['/(/']).length && requiresProblems('CL_1').length);
  });
  ok('depictState: ids outrank labels; labels are a fallback; the body never satisfies; ":" equals "_"', () => {
    const P = (id, label, from, level = 'cell') => ({ id: from === 'chain' ? `ghost:${id}` : id, ontology_id: id, label, level, from });
    const ghost = P('CL_0005012', 'multiciliated epithelial cell', 'chain'), other = P('CL_4033055', 'airway submucosal gland duct multiciliated cell');
    const r1 = depictState(['CL_0005012', '/multicilia/i'], [ghost, other]);
    assert.equal(r1.state, 'ghost'); assert.equal(r1.by, 'id'); assert.equal(r1.rep, ghost); assert.deepEqual(r1.related, [other]);
    assert.equal(depictState(['CL_0005012', '/multicilia/i'], [other]).state, 'present', 'label fallback when no id is in the ladder at all');
    assert.equal(depictState(['CL_0005012', '/multicilia/i'], [ghost, other, P('CL_0005012', 'multiciliated epithelial cell')]).state, 'present');
    assert.equal(depictState(['CL:0005012'], [ghost]).state, 'ghost');
    assert.equal(depictState(['/organism/i'], [{ id: 'body', label: 'multicellular organism', level: 'body' }]).state, 'absent');
    assert.equal(depictState(['CL_0005012'], []).state, 'absent');
    assert.equal(depictState(['/cilia/'], [P('X_1', 'CILIA')]).state, 'absent', 'regex flags are honoured (no i -> case-sensitive)');
    assert.equal(depictState(['bad id', 'CL_1'], []).valid, false);
  });
  ok('theatre.js carries depicts.mjs\'s rule verbatim and uses it in classify()', () => {
    const mine = depictsBlock(fs.readFileSync(DEPICTS, 'utf8'));
    assert.ok(mine && mine.includes('function depictState('), 'depicts.mjs has no marked block');
    assert.ok(theatreBlock, 'theatre.js has no "// >>> depicts" ... "// <<< depicts" block');
    assert.equal(theatreBlock, mine, 'theatre.js\'s copy of the depicts rule differs from sim-engine/scales/mesh/depicts.mjs');
    assert.match(theatreSrc, /if \(n\.requires\) \{ const d = depictState\(n\.requires, LADDER\?\.parts \?\? \[\]\)/, 'classify() does not style requires nodes by depictState');
    assert.match(theatreSrc, /if \(n\.deco && n\.slot !== 'body' && !n\.requires\)/, 'a requires deco must not inherit its slot\'s style');
    assert.match(theatreSrc, /Array\.isArray\(u\.requires\)/, 'prepare() does not read extras.requires');
  });
  ok('...and the two copies behave identically on every bundle, for every requires node', () => {
    assert.equal(typeof theatreDepictState, 'function');
    let n = 0;
    for (const [run, frame] of Object.entries(FRAME_OF_RUN)) for (const l of ladders(run)) {
      const g = l.mesh?.glb ? path.basename(l.mesh.glb) : null;
      for (const x of (g && req[g]) ?? []) {
        assert.deepEqual(summary(theatreDepictState(x.requires, l.parts)), summary(depictState(x.requires, l.parts)), `${run} gen ${l.generation} ${x.name}`);
        n++;
      }
      assert.ok(frame);
    }
    assert.ok(n >= 8, `only ${n} comparisons`);
  });
  ok('the construct GLB: multiciliated cells and cilia are separate pieces requiring CL_0005012; the surface itself does not', () => {
    const g = glbs.find(f => f.startsWith('construct-'));
    assert.ok(g, 'no construct GLB');
    const names = Object.fromEntries(req[g].map(x => [x.name, x.requires]));
    for (const k of ['deco:surface:cilia', 'deco:surface:mcc_cells']) {
      assert.ok(names[k], `${k} carries no requires`);
      assert.ok(names[k].includes('CL_0005012'), `${k} does not require CL_0005012`);
      assert.ok(names[k].some(r => /^\/.*multicilia.*\/i$/.test(r)), `${k} has no /multicilia/i fallback`);
    }
    assert.ok(!names['slot:surface'], 'the surface slot must stay styled by its slot');
  });
  ok('xenobot: CL_0005012 is a ghost in every generation, and so every requires piece is a GHOST, never present', () => {
    const ls = ladders('xenobot');
    assert.ok(ls.length >= 4);
    for (const l of ls) {
      const mcc = (l.parts ?? []).filter(p => String(p.ontology_id).replace(':', '_') === 'CL_0005012');
      assert.ok(mcc.length && mcc.every(p => p.from === 'chain' && p.blueprint_has_it === false), `gen ${l.generation}: the fixture changed: CL_0005012 is no longer only a ghost`);
      const list = req[path.basename(l.mesh.glb)] ?? [];
      assert.ok(list.length >= 2, `gen ${l.generation}: its GLB has no requires pieces`);
      for (const x of list) {
        const r = depictState(x.requires, l.parts);
        assert.notEqual(r.state, 'present', `gen ${l.generation} ${x.name} would be drawn SOLID although the blueprint lacks the multiciliated cell`);
        assert.equal(r.state, 'ghost', `gen ${l.generation} ${x.name}`);
        assert.equal(r.rep.ontology_id, 'CL_0005012');
      }
    }
    // positive control: the same pieces ARE present for a ladder whose blueprint has the cell
    const l = ls[0], withIt = [...l.parts, { id: 'CL_0005012', ontology_id: 'CL_0005012', label: 'multiciliated epithelial cell', level: 'cell', slot: 'surface' }];
    for (const x of req[path.basename(l.mesh.glb)]) assert.equal(depictState(x.requires, withIt).state, 'present', x.name);
  });
  ok('the general rule, over every bundle: a requires piece whose matched part is only a ghost is never present', () => {
    let checked = 0;
    for (const run of Object.keys(FRAME_OF_RUN)) for (const l of ladders(run)) {
      const g = l.mesh?.glb ? path.basename(l.mesh.glb) : null;
      for (const x of (g && req[g]) ?? []) {
        const r = depictState(x.requires, l.parts);
        if (r.matched.length && r.matched.every(p => p.from === 'chain')) { assert.equal(r.state, 'ghost', `${run} gen ${l.generation} ${x.name}`); checked++; }
        if (r.state === 'present') assert.ok(r.matched.length && r.matched.every(p => p.from !== 'chain'), `${run} gen ${l.generation} ${x.name}: present without a blueprint part`);
      }
    }
    assert.ok(checked >= 4, `the rule was exercised only ${checked} time(s)`);
  });
}

// ================================================================================================================
// ILLUSTRATION NOTES, STAGE EXTENTS, AND THE TETRAPOD'S ORGAN PIECES.
console.log('\nillustration notes, stage extents, tetrapod organ pieces');
{
  const { depictState } = await import('../mesh/depicts.mjs');
  const req = {};   // glb -> [{name, requires}]  (its own copy: the depicts block above is a closed scope)
  for (const g of glbs) req[g] = readGlb(path.join(MESH_DIR, g)).js.nodes.filter(n => n.extras?.requires != null).map(n => ({ name: n.name, requires: n.extras.requires }));
  // build_mesh.py's NOTE_KEYS, read from the source so the two never drift.
  const py = fs.readFileSync(path.join(MESH_SRC, 'build_mesh.py'), 'utf8');
  const NOTE_KEYS = JSON.parse(`[${/^NOTE_KEYS = \(([^)]*)\)/m.exec(py)?.[1] ?? ''}]`.replace(/'/g, '"').replace(/,\s*\]/, ']'));
  ok('build_mesh.py folds every sculptor note key into extras.illustration_note, in the GLB and the manifest', () => {
    assert.deepEqual(NOTE_KEYS, ['illustration_note', 'note', 'schematic', 'shape_basis', 'beat', 'cells_drawn']);
    const perFrame = {};
    for (const g of glbs) {
      const { js } = readGlb(path.join(MESH_DIR, g));
      const man = JSON.parse(fs.readFileSync(path.join(MESH_DIR, g.replace(/\.glb$/, '.json')), 'utf8'));
      const manBy = new Map();
      for (const n of man.nodes) manBy.set(n.name, [...(manBy.get(n.name) ?? []), n.illustration_note ?? null]);
      for (const n of js.nodes) {
        const e = n.extras ?? {};
        const src = NOTE_KEYS.filter(k => typeof e[k] === 'string' && e[k].trim() && k !== 'illustration_note');
        if (!src.length && !e.illustration_note) continue;
        assert.equal(typeof e.illustration_note, 'string', `${g} ${n.name}: has ${src.join(', ')} but no illustration_note`);
        for (const k of src) assert.ok(e.illustration_note.includes(e[k].trim()), `${g} ${n.name}: illustration_note drops its ${k}`);
        assert.ok(Array.isArray(e.illustration_note_from) && e.illustration_note_from.length, `${g} ${n.name}: illustration_note_from`);
        if (!n.name.startsWith('stage:')) {
          assert.ok((manBy.get(n.name) ?? []).includes(e.illustration_note), `${g} ${n.name}: the manifest node does not carry the same note`);
          perFrame[g.split('-')[0]] = (perFrame[g.split('-')[0]] ?? 0) + 1;
        }
      }
    }
    // every frame's sculptor writes notes (under four different keys), so every frame must have some
    for (const f of SCULPTED) assert.ok(perFrame[f] > 0, `no ${f} node carries an illustration_note`);
  });
  ok('the page shows the clicked piece\'s illustration note under "about this drawing"', () => {
    const t = fs.readFileSync(path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'theatre.js'), 'utf8');
    assert.match(t, /const drawing = drawingNotes\(obj, n\);/, 'selectHit() does not collect the clicked piece\'s notes');
    assert.match(t, /u\.illustration_note/);
    assert.match(t, />about this drawing</);
    assert.match(t, /\$\{SEL\?\.id === p\.id \? drawingNote\(\) : ''\}/, 'partCard() does not show it');
    assert.equal((t.match(/\$\{drawingNote\(\)\}/g) ?? []).length, 2, 'slotCard() does not show it on both of its cards');
  });

  // A stage root's world extent, from the POSITION accessors' min/max through every node transform.
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
  const local = n => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy,
      2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const apply = (m, p) => [0, 1, 2].map(i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
  const extents = js => (js.scenes[js.scene ?? 0].nodes).map(ri => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], slotNodes = [];
    const walk = (i, M) => {
      const n = js.nodes[i], W = mul(M, local(n));
      if (n.mesh != null) for (const p of js.meshes[n.mesh].primitives) {
        const a = js.accessors[p.attributes.POSITION];
        for (let c = 0; c < 8; c++) { const q = apply(W, [0, 1, 2].map(k => ((c >> k) & 1 ? a.max[k] : a.min[k]))); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); } }
      }
      if (n.name.startsWith('slot:')) slotNodes.push(n.name);
      for (const c of n.children ?? []) walk(c, W);
    };
    walk(ri, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return { stage: js.nodes[ri].name.slice(6), lo, hi, slotNodes };
  });
  const slotPos = (S, side, idx) => {
    let x = S.x;
    if (S.repeat && idx != null) x += (Number(idx) - (S.repeat - 1) / 2) * (S.repeat_span ?? 0.2);
    return [2 * x, 2 * S.y, 2 * (S.z ?? 0) * (side === 'left' ? -1 : 1)];
  };
  ok('every stage extent agrees with the manifest bbox (lib.page_bbox), so the extents below are the real ones', () => {
    for (const g of glbs) {
      const man = JSON.parse(fs.readFileSync(path.join(MESH_DIR, g.replace(/\.glb$/, '.json')), 'utf8'));
      for (const e of extents(readGlb(path.join(MESH_DIR, g)).js)) {
        const b = man.stages.find(s => s.key === e.stage)?.bbox;
        assert.ok(b, `${g}: the manifest has no bbox for ${e.stage}`);
        ['x', 'y', 'z'].forEach((k, i) => { assert.ok(Math.abs(b[k][0] - e.lo[i]) < 0.02 && Math.abs(b[k][1] - e.hi[i]) < 0.02, `${g} ${e.stage} ${k}: GLB ${e.lo[i].toFixed(3)}..${e.hi[i].toFixed(3)} vs manifest ${b[k]}`); });
      }
    }
  });
  ok('construct and prokaryote stage roots are NOT normalised: each extent contains every slot position x 2 of its stage', () => {
    // The README's "about x in [-1.6, 1.6]" applies to no frame exactly. These two are sculpted at the frame's own slot
    // radii, so the tissue and cell beads (placed at slot positions x 2) land inside the drawn body.
    let n = 0;
    for (const g of glbs.filter(f => /^(construct|prokaryote)-/.test(f))) {
      const slots = Object.fromEntries(FRAMES[g.split('-')[0]].slots.map(s => [s.slot, s]));
      for (const e of extents(readGlb(path.join(MESH_DIR, g)).js)) for (const name of e.slotNodes) {
        const [, slot, side, idx] = name.split(':');
        const p = slotPos(slots[slot], side ?? 'single', idx);
        assert.ok(p.every((v, k) => v >= e.lo[k] - 1e-3 && v <= e.hi[k] + 1e-3), `${g} ${e.stage}: ${name} at ${p.map(v => v.toFixed(2))} is outside ${e.lo.map(v => v.toFixed(2))}..${e.hi.map(v => v.toFixed(2))}`);
        n++;
      }
    }
    assert.ok(n >= 40, `only ${n} slot positions checked`);
  });

  // The tetrapod's organ pieces hung under other slots (xenobot agent's table, checked against the bundles here).
  const T_REQ = { 'deco:liver:gallbladder': 'UBERON_0002110', 'deco:endocrine:parathyroid': 'UBERON_0001132', 'deco:heart:aorta': 'UBERON_0000947',
    'deco:heart:great_veins': null, 'deco:kidney:adrenal': 'UBERON_0002369', 'deco:kidney:ureter': 'UBERON_0000056', 'deco:lung:trachea': 'UBERON_0003126', 'deco:eye:lid': 'UBERON_0001711' };
  ok('tetrapod GLBs: every distinct-organ piece carries requires, and the adrenal is its own piece, not part of the ureter', () => {
    const tg = glbs.filter(f => f.startsWith('tetrapod-'));
    assert.ok(tg.length, 'no tetrapod GLB');
    for (const g of tg) {
      const names = new Map(req[g].map(x => [x.name, x.requires]));
      for (const [node, id] of Object.entries(T_REQ)) {
        assert.ok(names.has(node), `${g}: ${node} carries no requires`);
        if (id) assert.ok(names.get(node).includes(id), `${g}: ${node} does not require ${id}`);
      }
      const decos = readGlb(path.join(MESH_DIR, g)).js.nodes.filter(n => n.name.startsWith('deco:')).map(n => n.name);
      for (const generic of ['deco:head:vibrissae', 'deco:skin:fur', 'deco:spinal_cord:nerves']) if (decos.includes(generic)) assert.ok(!names.has(generic), `${g}: ${generic} is a generic feature and must not carry requires`);
    }
  });
  ok('flying-mouse: the organs its blueprint lacks are never drawn present; the ureter it has is', () => {
    let checked = 0;
    for (const l of ladders('flying-mouse')) {
      const g = l.mesh?.glb ? path.basename(l.mesh.glb) : null;
      if (!g || !req[g]) continue;
      const st = Object.fromEntries(req[g].map(x => [x.name, depictState(x.requires, l.parts)]));
      for (const k of ['deco:liver:gallbladder', 'deco:endocrine:parathyroid', 'deco:heart:aorta', 'deco:kidney:adrenal', 'deco:eye:lid', 'deco:heart:great_veins'])
        assert.notEqual(st[k]?.state, 'present', `gen ${l.generation} ${k} would be drawn solid although no blueprint part matches`);
      assert.equal(st['deco:kidney:ureter']?.state, 'present', `gen ${l.generation}: the ureter (UBERON_0000056) is in the blueprint`);
      assert.equal(st['deco:kidney:ureter']?.by, 'id');
      // the trachea is present only by the LABEL fallback (no UBERON_0003126 in the blueprint; 'tracheobronchial tree' etc.)
      assert.equal(st['deco:lung:trachea']?.state, 'present'); assert.equal(st['deco:lung:trachea']?.by, 'label');
      checked++;
    }
    assert.ok(checked >= 5, `only ${checked} generations checked`);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
