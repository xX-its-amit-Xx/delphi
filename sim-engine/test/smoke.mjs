// node test/smoke.mjs            every check that does not need the network
// node test/smoke.mjs --network   adds the AlphaFold and ESMFold calls
//
// Network checks are opt-in because a public endpoint being down is not a defect in this code, and a
// test suite that goes red when someone else's server is busy stops being read.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const NET = process.argv.includes('--network');
const root = path.resolve(import.meta.dirname, '..');
let pass = 0, fail = 0, skip = 0;
const ok = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
};
const okAsync = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
};
const skipped = (name, why) => { console.log(`  skip  ${name} (${why})`); skip++; };

console.log('\nprovenance envelope');
const { envelope, p, param, fromParam } = await import('../lib/provenance.mjs');
ok('rejects an unknown provenance kind', () => assert.throws(() => p('x', 1, 'invented', 's'), /unknown provenance kind/));
ok('rejects a missing source', () => assert.throws(() => p('x', 1, 'measured', ''), /needs a source/));
ok('rejects a missing scope', () => assert.throws(() => envelope({}, [], ''), /scope is mandatory/));
ok('reports the weakest input, not the strongest', () => {
  const e = envelope({}, [p('a', 1, 'measured', 's'), p('b', 2, 'assumed', 's')], 'scope');
  assert.equal(e.weakest_input, 'assumed');
});
ok('fetched parameters carry their own kind, not an upgraded one', () => {
  assert.equal(fromParam('fgf8-D-yu2009').kind, 'measured-secondhand');
  assert.equal(param('shh-D-finbud').value, null, 'no Shh value may be invented');
  assert.equal(param('shh-D-finbud').kind, 'assumed');
});

console.log('\nmorphogen_diffusion');
const md = await import('../tools/morphogen-diffusion.mjs');
ok('uniform source with no decay gradient reaches the analytic plateau', () => {
  // With a source everywhere and clearance k, the steady state is exactly S/k, independent of D.
  const f = md.solve({ dims: [12, 12], spacing_um: 5, D_um2_s: 50, k_s: 1e-3, source: () => 2 });
  assert.ok(f.converged, 'did not converge');
  const expected = 2 / 1e-3;
  assert.ok(Math.abs(f.max - expected) / expected < 1e-3, `plateau ${f.max} vs analytic ${expected}`);
});
ok('1D decay matches exp(-x/lambda) away from the source', () => {
  // Long thin domain, source at one end: the interior must follow the analytic decay length.
  const D = 50, k = 5e-3, lambda = Math.sqrt(D / k);
  const h = 2, nx = 220;
  const f = md.solve({ dims: [nx, 3], spacing_um: h, D_um2_s: D, k_s: k, source: { axis: 0, from: 0, to: 1, rate: 1 } });
  assert.ok(f.converged, 'did not converge');
  const at = x => f.C[x * f.strides[0] + 1 * f.strides[1]];
  // Fit the decay between two interior points, away from the source and the far boundary.
  const x1 = 40, x2 = 120;
  const fitted = ((x2 - x1) * h) / Math.log(at(x1) / at(x2));
  assert.ok(Math.abs(fitted - lambda) / lambda < 0.05, `fitted lambda ${fitted.toFixed(1)} vs analytic ${lambda.toFixed(1)}`);
});
ok('lambda equals sqrt(D/k)', () => {
  const f = md.solve({ dims: [10, 10], spacing_um: 5, D_um2_s: 56, k_s: 1.283e-3, source: { axis: 0, from: 0, to: 1, rate: 1 } });
  assert.ok(Math.abs(f.lambda_um - Math.sqrt(56 / 1.283e-3)) < 1e-6);
});
ok('fetched defaults reproduce the independently reported gradient length', () => {
  const out = md.run({ dims: [20, 20], spacing_um: 5 });
  assert.ok(out.result.lambda_check.relative_difference < 0.06,
    `lambda check off by ${out.result.lambda_check.relative_difference}`);
});
ok('a Shh request is labelled borrowed and never invents a measured value', () => {
  const out = md.run({ morphogen: 'shh', dims: [10, 10] });
  assert.ok(out.provenance.some(q => q.kind === 'borrowed'), 'no borrowed label');
  assert.ok(/borrowed/i.test(out.scope), 'scope does not disclose the borrowing');
});
ok('refuses a source-free problem rather than returning zeros', () =>
  assert.throws(() => md.solve({ dims: [5, 5], D_um2_s: 1, k_s: 1, source: null }), /source is required/));
ok('3D runs and the threshold region reports a volume', () => {
  const f = md.solve({ dims: [10, 10, 10], spacing_um: 5, D_um2_s: 50, k_s: 1e-3, source: { axis: 2, from: 0, to: 1, rate: 1 } });
  const r = md.supraThreshold(f, f.max * 0.5);
  assert.equal(r.measure_unit, 'um^3');
  assert.equal(r.extent_um.length, 3);
});
ok('calibrateThreshold hits the requested area', () => {
  const f = md.solve({ dims: [40, 40], spacing_um: 2.5, D_um2_s: 56, k_s: 1.283e-3, source: { axis: 0, from: 0, to: 2, rate: 1 } });
  const target = 0.5 * 40 * 40 * 2.5 * 2.5;
  const got = md.supraThreshold(f, md.calibrateThreshold(f, target)).measure;
  assert.ok(Math.abs(got - target) / target < 0.05, `got ${got} for target ${target}`);
});

console.log('\nprotein_structure geometry (no network)');
const ps = await import('../tools/protein-structure.mjs');
const pdbPath = path.join(root, '..', 'organism-design/esmfold/runs/P62894-esmatlas/predicted.pdb');
if (fs.existsSync(pdbPath)) {
  const A = ps.caAtoms(fs.readFileSync(pdbPath, 'utf8'));
  ok('parses CA atoms with pLDDT in the B-factor column', () => {
    assert.ok(A.length > 50, `only ${A.length} CA atoms`);
    assert.ok(A.every(a => a.b >= 0 && a.b <= 100), 'pLDDT outside 0-100');
  });
  ok('Kabsch gives zero RMSD for a rigid rotation and translation', () => {
    const th = 0.7, c = Math.cos(th), s = Math.sin(th);
    const B = A.map(a => ({ ...a, x: c * a.x - s * a.y + 13.5, y: s * a.x + c * a.y - 2.25, z: a.z + 7 }));
    const r = ps.rmsdKabsch(A, B).rmsd;
    assert.ok(r < 1e-6, `rigid motion gave RMSD ${r}, so the superposition is wrong`);
  });
  ok('Kabsch gives zero RMSD for a pure translation', () => {
    const r = ps.rmsdKabsch(A, A.map(a => ({ ...a, x: a.x + 0.5 }))).rmsd;
    assert.ok(r < 1e-6, `translation gave RMSD ${r}`);
  });
  ok('Kabsch does NOT report zero for a genuine deformation', () => {
    const B = A.map((a, i) => ({ ...a, x: a.x + (i % 7 === 0 ? 1 : 0) }));
    const r = ps.rmsdKabsch(A, B).rmsd;
    assert.ok(r > 0.1, `deformation gave RMSD ${r}, so the metric is insensitive`);
  });
  ok('Kabsch is not fooled by a reflection', () => {
    // A mirror image is not reachable by rotation; RMSD must be large, not zero.
    const B = A.map(a => ({ ...a, z: -a.z }));
    const r = ps.rmsdKabsch(A, B).rmsd;
    assert.ok(r > 0.5, `reflection gave RMSD ${r}; the determinant correction is not working`);
  });
} else skipped('Kabsch checks', 'no cached PDB in organism-design/esmfold/runs/');

console.log('\nwrappers over existing modules');
const w = await import('../tools/wrappers.mjs');
await okAsync('physiology_chain passes through the module\'s own provenance kinds', async () => {
  const o = await w.physiologyChain({ mass_kg: 0.06 });
  assert.ok(o.result.quantities.length > 20, 'too few quantities');
  assert.ok(o.provenance.length > 20, 'provenance not propagated');
  assert.ok(o.provenance.some(q => q.kind === 'calibrated'), 'the module\'s tuned values must surface as calibrated');
});
await okAsync('growth_trajectory returns a series', async () => {
  const o = await w.growthTrajectory({ series: 5, maxDays: 100 });
  assert.equal(o.result.length, 5);
});
await okAsync('lean_check says in its scope that it is not a kernel check', async () => {
  const o = await w.leanCheck({ spec: { SL_m: 0.25, mass_kg: 0.06, finArea_m2: 0.004, CLmax: 1.2, airspeed_m_s: 10 } });
  assert.match(o.scope, /NOT A KERNEL CHECK/);
});

console.log('\nnetwork');
if (!NET) skipped('AlphaFold and ESMFold', 'pass --network to run');
else {
  await okAsync('AlphaFold DB model for P62894', async () => {
    const o = await ps.run({ accession: 'P62894' });
    assert.ok(o.result.alphafold?.mean_plddt > 50, JSON.stringify(o.result.alphafold));
  });
  await okAsync('a variant whose wild-type residue is wrong is refused, not applied', async () => {
    const o = await ps.run({ accession: 'P62894', variant: 'W23R', fold_variant: false });
    assert.equal(o.result.variant.matches_sequence, false);
    assert.match(o.result.variant.error, /not W/);
  });
  await okAsync('ESMFold variant fold, or a recorded refusal', async () => {
    const o = await ps.run({ accession: 'P62894', variant: 'K23R' });
    const v = o.result.variant;
    if (v.esmfold) assert.ok(v.esmfold.ca_rmsd_angstrom >= 0);
    else { assert.ok(v.error, 'neither a fold nor an error'); console.log(`          (endpoint unavailable: ${v.error})`); }
  });
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped\n`);
process.exit(fail ? 1 : 0);
