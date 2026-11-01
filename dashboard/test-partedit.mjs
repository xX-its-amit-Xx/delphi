// node dashboard/test-partedit.mjs
// Tests dashboard/public/blueprint3d/partedit.js on (1) a synthetic THREE scene with known answers and (2) the real
// winged-zebrafish.glb + manifest. three.js is NOT a dependency of this repo: it is loaded from PARTEDIT_THREE
// (default C:/Temp/partedit-deps/node_modules/three, installed there with `npm install three@0.160.0`, the version
// explode.html loads from cdnjs). PARTEDIT_MODULE overrides the module under test (used to make the checks fail once
// against a deliberately broken copy). Exit code 1 on any failed check. Reported numbers are rounded to 6 significant
// figures, so ratios are compared at 2e-5.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const threeDir = process.env.PARTEDIT_THREE || 'C:/Temp/partedit-deps/node_modules/three';
const THREE = await import(pathToFileURL(path.join(threeDir, 'build/three.module.js')).href);
const { GLTFLoader } = await import(pathToFileURL(path.join(threeDir, 'examples/jsm/loaders/GLTFLoader.js')).href);
const modPath = process.env.PARTEDIT_MODULE || path.join(here, 'public/blueprint3d/partedit.js');
const PE = await import(pathToFileURL(modPath).href);

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } };
const near = (a, b, rel = 2e-5) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-30);
const snap = root => { const out = {}; root.traverse(o => { if (o.isMesh) out[o.name] = [Array.from(o.geometry.attributes.position.array), ...(o.geometry.morphAttributes.position || []).map(m => Array.from(m.array))]; }); return JSON.stringify(out); };
const posOf = (root, name) => { const m = root.getObjectByName(name); const a = m.geometry.attributes.position, P = []; for (let i = 0; i < a.count; i++) P.push([a.getX(i) + m.position.x, a.getY(i) + m.position.y, a.getZ(i) + m.position.z]); return P; };

// ------------------------------------------------------------------ 1. synthetic scene
console.log('synthetic scene');
function synthetic() {
  const root = new THREE.Group(), objects = [];
  const add = (name, geo, pos, meta) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); m.name = name; m.position.set(...pos); root.add(m); objects.push({ object: name, centre_gltf: pos, ...meta }); return m; };
  const skin = new THREE.IcosahedronGeometry(1, 4); skin.scale(0.4, 0.1, 0.08);
  add('skin_L', skin, [0, 0, 0], { level: 'organ', layer: 'outer', side: 'L', ontology_id: 'UBERON_0002097' });
  // fin: a flat 0.06 (chord, X) x 0.2 (span, Z) sheet; root at z = -0.05 (inside the skin), tip at z = -0.25
  const fin = new THREE.PlaneGeometry(0.06, 0.2, 4, 20); fin.rotateX(Math.PI / 2);
  fin.morphAttributes.position = [new THREE.Float32BufferAttribute(new Float32Array(fin.attributes.position.count * 3).map((_, i) => (i % 3 === 2 ? -0.01 : 0)), 3)];
  fin.morphTargetsRelative = true;
  const finMesh = add('pectoral_fin_L', fin, [0.1, 0, -0.15], { level: 'organ', layer: 'outer', side: 'L', ontology_id: 'UBERON_0000151' });
  finMesh.updateMorphTargets(); finMesh.morphTargetInfluences[0] = 0;
  add('pectoral_fin_ray_L_01', new THREE.BoxGeometry(0.004, 0.004, 0.2), [0.1, 0, -0.15], { level: 'organ', layer: 'skeleton', side: 'L' });
  add('liver', new THREE.IcosahedronGeometry(0.03, 2), [0, -0.02, 0], { level: 'organ', layer: 'organ', organ_system: 'digestive system' });
  add('muscle_L', new THREE.BoxGeometry(0.2, 0.04, 0.01), [-0.1, 0, -0.03], { level: 'tissue', layer: 'muscle', side: 'L' });
  add('eye_L', new THREE.IcosahedronGeometry(0.02, 2), [0.35, 0.01, -0.02], { level: 'organ', layer: 'outer', side: 'L' });
  const manifest = { id: 'synthetic', units_and_axes: 'test scene. SL = 0.8 model units.', parameters: { standard_length_m: 0.04 }, objects };
  return { root, manifest };
}
{
  const { root, manifest } = synthetic(); const mpu = 0.04 / 0.8;
  ok(near(PE.metresPerUnit(manifest).m_per_unit, mpu), 'metres per unit read from the manifest (0.04 m / 0.8 units)');
  const orig = snap(root);
  const m0 = PE.measurePart(root, 'pectoral_fin_L', manifest);
  ok(near(m0.surface_area_units2, 0.012, 1e-5) && near(m0.surface_area_m2, 0.012 * mpu * mpu, 1e-5), 'fin area measured from the mesh, in units and m2', m0.surface_area_m2);
  ok(m0.closed === false && m0.volume_m3 === null, 'open fin sheet: no volume');
  const lv = PE.measurePart(root, 'liver', manifest);
  ok(lv.closed === true && lv.volume_m3 > 0, 'closed liver: volume measured', lv.volume_m3);
  ok(PE.editableParams(manifest, 'pectoral_fin_L').map(p => p.param).join() === 'length,span,width,area', 'fin params');
  ok(PE.editableParams(manifest, 'muscle_L')[0].param === 'thickness', 'tissue params start with thickness');
  ok(PE.editableParams(manifest, 'skin_L').length === 0 && PE.editableParams(manifest, { level: 'cell', id: 'CL_1' }).length === 0, 'skin and cell: nothing editable');

  const fin0 = posOf(root, 'pectoral_fin_L'), base0 = fin0.filter(p => Math.abs(p[2] + 0.06) < 1e-6);
  let r = PE.applyEdits(root, manifest, [{ target: { level: 'organ', id: 'pectoral_fin_L' }, param: 'span', op: 'scale', value: 2, mode: 'chord' }]);
  let a = r.applied[0] && r.applied[0].results[0];
  ok(r.applied.length === 1 && Math.abs(a.anchor.point_units[2] + 0.06) < 1e-6, 'fin base found from the contact band (rows inside the skin, z = -0.06)', a && a.anchor);
  ok(near(a.after.area_m2 / a.before.area_m2, 2, 2e-5) && near(a.after.length_m / a.before.length_m, 2, 2e-5), 'span x2, chord mode: area x2, length x2');
  const fin1 = posOf(root, 'pectoral_fin_L');
  ok(base0.every(p => fin1.some(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-7)), 'vertices on the base line do not move (scaled about the base, not the centroid)');
  const ray = posOf(root, 'pectoral_fin_ray_L_01'); const rz = Math.min(...ray.map(p => p[2])), fz = Math.min(...fin1.map(p => p[2]));
  ok(near(rz, fz, 2e-5) && near(fz, -0.06 - 2 * 0.19, 2e-5), 'the ray (child) follows the fin to the new tip', { rz, fz });
  const md = root.getObjectByName('pectoral_fin_L').geometry.morphAttributes.position[0];
  ok(near(md.getZ(0), -0.02, 2e-5), 'morph delta along the span is transformed with the edit (-0.01 -> -0.02)', md.getZ(0));

  r = PE.applyEdits(root, manifest, [{ target: { level: 'organ', id: 'pectoral_fin' }, param: 'span', op: 'scale', value: 2 }]);
  a = r.applied[0].results[0];
  ok(near(a.after.area_m2, a.before.area_m2, 2e-5) && near(a.after.width_m / a.before.width_m, 0.5, 2e-5), 'span x2, default area mode: area kept, chord halved (bilateral id resolves to the one fin present)');
  ok(near(PE.measurePart(root, 'pectoral_fin_L', manifest).surface_area_units2, 0.012, 1e-5), 'applyEdits restarts from the originals (not cumulative)');
  r = PE.applyEdits(root, manifest, [{ target: { level: 'organ', id: 'pectoral_fin_L' }, param: 'span:aspect', op: 'scale', value: 1.5 }]);
  a = r.applied[0].results[0];
  ok(near(a.after.area_m2 / a.before.area_m2, 2.25, 2e-5), 'span x1.5, aspect mode (param suffix): area x2.25, aspect ratio kept');
  r = PE.applyEdits(root, manifest, [{ target: { level: 'organ', id: 'UBERON:0000151' }, param: 'area', op: 'set', value: 2 * 0.012 * mpu * mpu }]);
  a = r.applied[0] && r.applied[0].results[0];
  ok(a && near(a.after.area_m2, 2 * 0.012 * mpu * mpu, 2e-5) && near(a.factors.span_axis, Math.SQRT2, 2e-5), 'area set in m2 via an ontology id: exact, sqrt(2) on span and chord', a && a.factors);

  r = PE.applyEdits(root, manifest, [{ target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'scale', value: 2 }, { target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'scale', value: 15 }]);
  a = r.applied[0] && r.applied[0].results[0];
  ok(a && near(a.after.volume_m3 / a.before.volume_m3, 2, 2e-5), 'liver volume x2: measured volume ratio exactly 2', a && a.after);
  const ref = r.refused[0];
  ok(ref && /body cavity/.test(ref.reason) && ref.detail.max_factor_that_fits > 1 && ref.detail.max_factor_that_fits < 15, 'liver volume x15 more: REFUSED by containment, with the largest factor that fits', ref && ref.reason);
  r = PE.applyEdits(root, manifest, [{ target: { level: 'tissue', id: 'muscle_L' }, param: 'thickness', op: 'scale', value: 1.5 }]);
  a = r.applied[0] && r.applied[0].results[0];
  ok(a && near(a.after.thickness_estimate_m / a.before.thickness_estimate_m, 1.5, 1e-4), 'tissue thickness x1.5 along normals: 2V/S estimate x1.5', a && [a.before.thickness_estimate_m, a.after.thickness_estimate_m]);
  r = PE.applyEdits(root, manifest, [{ target: { level: 'system', id: 'digestive system' }, param: 'volume', op: 'scale', value: 1.5 }]);
  ok(r.applied[0] && r.applied[0].kind === 'system' && r.applied[0].parts.join() === 'liver', 'system edit fans out to its organs');
  r = PE.applyEdits(root, manifest, [{ target: { level: 'body', id: 'body' }, param: 'length', op: 'scale', value: 1.2 }]);
  a = r.applied[0] && r.applied[0].results[0];
  ok(a && near(a.after.length_m / a.before.length_m, 1.2, 2e-5) && a.moved.length === 6, 'body length x1.2 moves every part');
  r = PE.applyEdits(root, manifest, [
    { target: { level: 'cell', id: 'CL_0000057' }, param: 'division_rate', op: 'scale', value: 2 },
    { target: { level: 'organ', id: 'pectoral_fin_L' }, param: 'thickness', op: 'scale', value: 2 },
    { target: { level: 'organ', id: 'no_such_part' }, param: 'volume', op: 'scale', value: 2 },
    { target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'scale', value: 100 },
    { target: { level: 'organ', id: 'skin_L' }, param: 'thickness', op: 'scale', value: 2 },
    { target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'grow', value: 2 },
    { target: { level: 'organ', id: 'eye_L' }, param: 'volume', op: 'scale', value: 3 }]);
  ok(r.recorded.length === 1 && r.recorded[0].status === 'non-geometric, recorded only', 'cell edit: non-geometric, recorded only');
  ok(r.refused.length === 5, 'fin thickness, unknown part, out-of-range factor, skin, bad op: all refused', r.refused.map(x => x.reason));
  ok(r.applied.length === 1 && r.applied[0].parts[0] === 'eye_L', 'eye (surface organ) volume x3 applied');
  const noSL = { ...manifest, parameters: {}, objects: manifest.objects };
  r = PE.applyEdits(root, noSL, [{ target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'set', value: 1e-6 }]);
  ok(r.refused.length === 1 && /metres/.test(r.refused[0].reason) && r.scale.m_per_unit === null, 'no standard_length_m: metres not guessed, op set refused');

  const edits = [{ target: { level: 'organ', id: 'pectoral_fin_L' }, param: 'span', op: 'scale', value: 1.7 }, { target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'scale', value: 1.4 }, { target: { level: 'tissue', id: 'muscle_L' }, param: 'thickness', op: 'scale', value: 1.3 }];
  const r1 = PE.applyEdits(root, manifest, edits), s1 = snap(root); const r2 = PE.applyEdits(root, manifest, edits), s2 = snap(root);
  ok(s1 === s2 && JSON.stringify(r1) === JSON.stringify(r2), 'deterministic and idempotent: same edits -> identical vertices and report');
  ok(s1 !== orig, 'edits changed the geometry');
  const n = PE.resetEdits(root);
  ok(snap(root) === orig && n >= 3, 'resetEdits restores every touched mesh exactly', n);
}

// ------------------------------------------------------------------ 2. the real winged-zebrafish model
console.log('winged-zebrafish.glb');
{
  const B = path.join(here, 'public/blueprint3d/model');
  const manifest = JSON.parse(fs.readFileSync(path.join(B, 'winged-zebrafish-manifest.json'), 'utf8'));
  const buf = fs.readFileSync(path.join(B, 'winged-zebrafish.glb'));
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  const root = gltf.scene, orig = snap(root);
  const restOK = manifest.objects.every(o => { const m = root.getObjectByName(o.object); return m && m.quaternion.equals(new THREE.Quaternion()) && m.scale.equals(new THREE.Vector3(1, 1, 1)) && m.position.distanceTo(new THREE.Vector3(...o.centre_gltf)) < 1e-4; });
  ok(restOK, 'every GLB node sits at its manifest centre_gltf with identity rotation and unit scale (rest-transform assumption)');
  const sc = PE.metresPerUnit(manifest);
  ok(near(sc.m_per_unit, 0.0388 / 0.82), 'metres per unit = 0.0388 m / 0.82 units', sc);
  const pair = PE.measurePart(root, 'pectoral_fin', manifest).pair, dm = manifest.derived_from_the_mesh;
  ok(near(pair.tip_to_tip_span_m, dm.pectoral_span_m, 0.005), `measured pectoral span ${pair.tip_to_tip_span_m} m matches the build's ${dm.pectoral_span_m} m`);
  ok(near(pair.area_both_m2, dm.pectoral_area_both_m2, 0.005), `measured pectoral area (both) ${pair.area_both_m2} m2 matches the build's ${dm.pectoral_area_both_m2} m2`);

  const finBefore = posOf(root, 'pectoral_fin_L');
  const r = PE.applyEdits(root, manifest, [
    { target: { level: 'organ', id: 'pectoral_fin' }, param: 'span', op: 'scale', value: 1.5, author: 'test', reason: 'longer, narrower fin at fixed area' },
    { target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'scale', value: 1.3 },
    { target: { level: 'organ', id: 'liver' }, param: 'volume', op: 'scale', value: 8 },
    { target: { level: 'tissue', id: 'muscle_L' }, param: 'thickness', op: 'scale', value: 1.2 },
    { target: { level: 'cell', id: 'CL_0000057' }, param: 'proliferation', op: 'scale', value: 2 }]);
  const f = r.applied.find(x => x.index === 0), fl = f && f.results[0];
  ok(fl && /inside the body cavity/.test(fl.anchor.method), 'pectoral fin base found by contact with the skin', fl && fl.anchor);
  ok(fl && near(fl.after.area_m2, fl.before.area_m2, 2e-5) && near(fl.after.length_m / fl.before.length_m, 1.5, 2e-5), 'span x1.5 area mode on the curved real fin: area kept exactly, length x1.5', fl && [fl.before, fl.after]);
  // independent of the reported anchor: the fin vertex nearest the body midline (|z| smallest, the root) barely moves,
  // the one farthest out (the tip) moves a lot
  const finAfter = posOf(root, 'pectoral_fin_L');
  const moved = finBefore.map((p, i) => ({ z: Math.abs(p[2]), mv: Math.hypot(finAfter[i][0] - p[0], finAfter[i][1] - p[1], finAfter[i][2] - p[2]) })).sort((x, y) => x.z - y.z);
  ok(moved[0].mv < 0.1 * moved[moved.length - 1].mv, 'the fin root (nearest the midline) moves far less than the tip', [moved[0], moved[moved.length - 1]]);
  ok(fl.moved.length === 13, 'the 12 pectoral rays follow the fin');
  ok(r.applied.find(x => x.index === 1) && near(r.applied.find(x => x.index === 1).results[0].after.volume_m3 / r.applied.find(x => x.index === 1).results[0].before.volume_m3, 1.3, 2e-5), 'liver volume x1.3 applied, measured ratio 1.3');
  const lr = r.refused.find(x => x.index === 2);
  ok(lr && /body cavity/.test(lr.reason), 'liver volume x8 refused: it would leave the body cavity', lr && lr.reason);
  ok(r.applied.some(x => x.index === 3), 'trunk muscle thickness x1.2 applied');
  ok(r.recorded.length === 1, 'cell edit recorded only');
  console.log('    pair after:', JSON.stringify(f.pair));
  PE.resetEdits(root);
  ok(snap(root) === orig, 'resetEdits restores the GLB exactly');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
