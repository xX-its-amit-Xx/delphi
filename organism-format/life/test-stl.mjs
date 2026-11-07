#!/usr/bin/env node
// Tests for life/stl.mjs.
//
//   node organism-format/life/test-stl.mjs
//   node organism-format/life/test-stl.mjs --fail-once     <- EVERY line must read FAIL
//
// The second invocation is the point. Each assertion below carries a deliberately broken twin predicate,
// and the twin is always an INVERSION rather than a tightened threshold - a test that still passes with
// its fault injected is a test that was never looking at the thing it names. Run both.
//
// The STL writer is a good place to be strict, because its output is bytes and bytes can be checked
// exactly: 84 + 50n, the count field, the attribute shorts, the header. There is no "roughly correct"
// binary layout, so nothing here is allowed to assert "roughly".
import {
  icosphere, facetNormal, stageToTriangles, writeBinarySTL, exportStage, stlHeader80,
  WHAT_AN_STL_LOSES, STL_FORMAT, DEPICTION_MARKER,
} from './stl.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

// ---------------------------------------------------------------------------------------------------
// An independent reader, written from the format description rather than from stl.mjs, so a round-trip
// test is not the writer agreeing with itself.
// ---------------------------------------------------------------------------------------------------
function parseBinarySTL(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const header = new TextDecoder('ascii').decode(buf.subarray(0, 80)).replace(/\0+$/, '');
  const count = dv.getUint32(80, true);
  const triangles = [], normals = [], attrs = [];
  for (let i = 0; i < count; i++) {
    const o = 84 + 50 * i;
    normals.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]);
    const tri = [];
    for (let k = 0; k < 3; k++) {
      const p = o + 12 + 12 * k;
      tri.push([dv.getFloat32(p, true), dv.getFloat32(p + 4, true), dv.getFloat32(p + 8, true)]);
    }
    triangles.push(tri);
    attrs.push(dv.getUint16(o + 48, true));
  }
  return { header, count, triangles, normals, attrs, byte_length: buf.byteLength ?? buf.length };
}

const len = v => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = t => [0, 1, 2].map(i => (t[0][i] + t[1][i] + t[2][i]) / 3);

// ---------------------------------------------------------------------------------------------------
// Fixtures. A four-cell stage at E2.0, plus three cells that must be refused one at a time: a zero
// radius, a missing radius, and a centre that is not three numbers.
// ---------------------------------------------------------------------------------------------------
const R = 16; // um; a mouse blastomere at the 4-cell stage is of this order
const cell = (id, centre, radius, extra = {}) => ({
  id, channels: { geometry: { centre, radius, ...extra } },
});
const GOOD_CELLS = [
  cell('c1', [0, 0, 0], R),
  cell('c2', [24, 0, 0], R),
  cell('c3', [12, 21, 0], R, { surface_area: 3217, exposed_surface_area: 2100 }),
  cell('c4', [12, 7, 20], R),
];
const BAD_CELLS = [
  cell('c-zero', [50, 50, 50], 0),
  cell('c-missing', [60, 60, 60], undefined),
  cell('c-badcentre', [1, 2], R),
];
const stage = (kind, cells = GOOD_CELLS) => ({
  id: 'morula-E2.5', name: 'morula', time: 2.5, time_unit: 'E', temperature_C: 37,
  geometry: {
    provenance: { kind, source: kind === 'measured' ? 'UTMM 3DISS volume, fixture' : null, note: 'test fixture' },
    units: 'um',
    cells,
  },
});

console.log(`\nlife/stl.mjs  (${STL_FORMAT})${FAULT ? '   [--fail-once: every line below must FAIL]' : ''}\n`);

// ---------------------------------------------------------------------------------------------------
console.log('icosphere');
// ---------------------------------------------------------------------------------------------------
{
  const ico = icosphere(0);
  check('icosahedron has 20 faces', f(ico.faces.length === 20, ico.faces.length !== 20), `got ${ico.faces.length}`);
  check('icosahedron has 12 vertices', f(ico.vertices.length === 12, ico.vertices.length !== 12), `got ${ico.vertices.length}`);

  // Euler: V - E + F = 2 with E = 3F/2 for a closed triangulation. Catches a face list that is 20 long
  // but wrong, which a bare count cannot.
  const edges = new Set();
  for (const [a, b, c] of ico.faces) for (const [i, j] of [[a, b], [b, c], [c, a]]) edges.add(i < j ? `${i}:${j}` : `${j}:${i}`);
  const euler = ico.vertices.length - edges.size + ico.faces.length;
  check('icosahedron is a closed surface (V-E+F=2, 30 edges)',
    f(euler === 2 && edges.size === 30, !(euler === 2 && edges.size === 30)), `V-E+F=${euler}, E=${edges.size}`);

  // every edge shared by exactly two faces, each traversed once in each direction -> consistent winding
  const dir = new Map();
  for (const [a, b, c] of ico.faces) for (const [i, j] of [[a, b], [b, c], [c, a]]) dir.set(`${i}>${j}`, (dir.get(`${i}>${j}`) ?? 0) + 1);
  const windingOk = [...dir.values()].every(n => n === 1) && dir.size === 60;
  check('icosahedron winding is consistent (each directed edge used once)',
    f(windingOk, !windingOk), `${dir.size} directed edges`);

  for (const n of [0, 1, 2, 3]) {
    const s = icosphere(n);
    const want = 20 * 4 ** n;
    check(`subdivisions=${n} gives exactly 20*4**${n} = ${want} faces`,
      f(s.faces.length === want, s.faces.length !== want), `got ${s.faces.length}`);
  }

  const s2 = icosphere(2);
  let maxErr = 0;
  for (const v of s2.vertices) maxErr = Math.max(maxErr, Math.abs(len(v) - 1));
  check('every icosphere vertex is unit length', f(maxErr < 1e-12, maxErr >= 1e-12), `max |len-1| = ${maxErr.toExponential(2)}`);

  // subdivision must share midpoints, or the vertex count explodes to 3 per face
  check('subdivision shares edge midpoints (vertices << 3*faces)',
    f(s2.vertices.length === 162 && s2.vertices.length < 3 * s2.faces.length,
      !(s2.vertices.length === 162 && s2.vertices.length < 3 * s2.faces.length)),
    `${s2.vertices.length} vertices for ${s2.faces.length} faces`);

  // no degenerate faces: three distinct vertex indices
  const degenerate = s2.faces.filter(([a, b, c]) => a === b || b === c || c === a).length;
  check('no subdivided face is degenerate', f(degenerate === 0, degenerate !== 0), `${degenerate} degenerate`);

  let threw = false;
  try { icosphere(1.5); } catch { threw = true; }
  check('icosphere refuses a non-integer subdivision count', f(threw, !threw));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nnormals');
// ---------------------------------------------------------------------------------------------------
{
  const n = facetNormal([0, 0, 0], [1, 0, 0], [0, 1, 0]);
  check('facetNormal is the normalised cross product (right-handed, +z here)',
    f(Math.abs(n[2] - 1) < 1e-15 && Math.abs(len(n) - 1) < 1e-15,
      !(Math.abs(n[2] - 1) < 1e-15 && Math.abs(len(n) - 1) < 1e-15)), JSON.stringify(n));

  const z = facetNormal([0, 0, 0], [1, 0, 0], [2, 0, 0]);
  check('a degenerate facet gets a zero normal, not NaN',
    f(z.every(c => c === 0), !z.every(c => c === 0)), JSON.stringify(z));

  // outwardness: for a sphere about the origin, the normal must agree with the facet centroid
  const { triangles } = stageToTriangles(stage('measured', [cell('c1', [0, 0, 0], R)]), { subdivisions: 2 });
  let minDot = Infinity, maxNormErr = 0;
  for (const t of triangles) {
    const nn = facetNormal(...t);
    minDot = Math.min(minDot, dot(nn, centroid(t)));
    maxNormErr = Math.max(maxNormErr, Math.abs(len(nn) - 1));
  }
  check('every facet normal points outward from the cell centre',
    f(minDot > 0, !(minDot > 0)), `min dot(normal, centroid) = ${minDot.toExponential(3)}`);
  check('every facet normal is unit length',
    f(maxNormErr < 1e-12, maxNormErr >= 1e-12), `max |len-1| = ${maxNormErr.toExponential(2)}`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nstageToTriangles');
// ---------------------------------------------------------------------------------------------------
{
  const t = stageToTriangles(stage('measured'), { subdivisions: 2 });
  check('one tessellated sphere per cell (4 cells * 320 faces)',
    f(t.triangles.length === 4 * 320 && t.cells_drawn === 4,
      !(t.triangles.length === 4 * 320 && t.cells_drawn === 4)),
    `${t.triangles.length} triangles, ${t.cells_drawn} cells`);

  // every vertex of cell c1's sphere sits at exactly radius R from its centre
  const one = stageToTriangles(stage('measured', [cell('c1', [7, -3, 11], R)]), { subdivisions: 2 });
  let worst = 0;
  for (const tri of one.triangles) for (const v of tri) worst = Math.max(worst, Math.abs(dist(v, [7, -3, 11]) - R));
  check('every sphere vertex is at distance radius from the cell centre',
    f(worst < 1e-9, worst >= 1e-9), `max |d - r| = ${worst.toExponential(2)} um`);

  const bad = stageToTriangles(stage('measured', [...GOOD_CELLS, ...BAD_CELLS]), { subdivisions: 1 });
  const zeroReported = bad.skipped.find(s => s.id === 'c-zero');
  check('a cell with radius 0 is skipped',
    f(bad.cells_drawn === 4 && bad.triangles.length === 4 * 80,
      !(bad.cells_drawn === 4 && bad.triangles.length === 4 * 80)),
    `drew ${bad.cells_drawn} of ${bad.cells_total}`);
  check('a cell with radius 0 is REPORTED, with a reason',
    f(!!zeroReported && /radius/.test(zeroReported.why), !(!!zeroReported && /radius/.test(zeroReported.why))),
    JSON.stringify(zeroReported ?? null));
  check('a missing radius and a malformed centre are skipped and reported too',
    f(bad.skipped.length === 3 && bad.skipped.some(s => s.id === 'c-missing') && bad.skipped.some(s => s.id === 'c-badcentre'),
      !(bad.skipped.length === 3 && bad.skipped.some(s => s.id === 'c-missing') && bad.skipped.some(s => s.id === 'c-badcentre'))),
    JSON.stringify(bad.skipped.map(s => s.id)));

  check('a cell carrying measured area is flagged as contradicted by the sphere model',
    f(t.disagrees_with_measured_area.includes('c3'), !t.disagrees_with_measured_area.includes('c3')),
    JSON.stringify(t.disagrees_with_measured_area));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nwriteBinarySTL: the bytes');
// ---------------------------------------------------------------------------------------------------
{
  for (const sub of [0, 1, 2]) {
    const { triangles } = stageToTriangles(stage('measured'), { subdivisions: sub });
    const buf = writeBinarySTL(triangles, { header: 'test' });
    const want = 84 + 50 * triangles.length;
    check(`subdivisions=${sub}: byte length is exactly 84 + 50*${triangles.length} = ${want}`,
      f(buf.byteLength === want, buf.byteLength !== want), `got ${buf.byteLength}`);
  }

  const empty = writeBinarySTL([]);
  check('zero triangles still writes a valid 84-byte file',
    f(empty.byteLength === 84 && parseBinarySTL(empty).count === 0,
      !(empty.byteLength === 84 && parseBinarySTL(empty).count === 0)), `${empty.byteLength} bytes`);

  const { triangles } = stageToTriangles(stage('measured'), { subdivisions: 2 });
  const buf = writeBinarySTL(triangles, { header: 'test header' });
  const p = parseBinarySTL(buf);

  check('the uint32 LE count field equals the triangle count',
    f(p.count === triangles.length, p.count !== triangles.length), `field=${p.count} triangles=${triangles.length}`);

  // the count field is at byte 80 and little-endian; read it the other way round and it must NOT match
  const beCount = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(80, false);
  check('the count field is little-endian, not big-endian',
    f(beCount !== triangles.length, beCount === triangles.length), `BE read = ${beCount}`);

  check('every attribute byte count is 0',
    f(p.attrs.every(a => a === 0), !p.attrs.every(a => a === 0)),
    `${p.attrs.filter(a => a !== 0).length} non-zero`);

  let maxNormErr = 0;
  for (const n of p.normals) maxNormErr = Math.max(maxNormErr, Math.abs(len(n) - 1));
  check('normals in the written buffer are unit length (float32 tolerance)',
    f(maxNormErr < 1e-5, maxNormErr >= 1e-5), `max |len-1| = ${maxNormErr.toExponential(2)}`);

  // round trip: parsed vertices match what was written, to float32 precision
  let maxVertErr = 0;
  for (let i = 0; i < triangles.length; i++) for (let k = 0; k < 3; k++) maxVertErr = Math.max(maxVertErr, dist(triangles[i][k], p.triangles[i][k]));
  check('round trip: parsing our own bytes recovers the same triangle count',
    f(p.triangles.length === triangles.length && p.count === triangles.length,
      !(p.triangles.length === triangles.length && p.count === triangles.length)),
    `${p.triangles.length} parsed`);
  check('round trip: every vertex survives to float32 precision',
    f(maxVertErr < 1e-3, maxVertErr >= 1e-3), `max displacement = ${maxVertErr.toExponential(2)} um`);

  // and the geometry still holds after the float32 trip
  const one = stageToTriangles(stage('measured', [cell('c1', [7, -3, 11], R)]), { subdivisions: 2 });
  const pOne = parseBinarySTL(writeBinarySTL(one.triangles, { header: 'one' }));
  let worst = 0;
  for (const tri of pOne.triangles) for (const v of tri) worst = Math.max(worst, Math.abs(dist(v, [7, -3, 11]) - R));
  check('round trip: parsed vertices are still at distance radius from the centre',
    f(worst < 1e-3, worst >= 1e-3), `max |d - r| = ${worst.toExponential(2)} um`);

  check('the header round-trips as ASCII text',
    f(p.header === 'test header', p.header !== 'test header'), JSON.stringify(p.header));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nstlHeader80');
// ---------------------------------------------------------------------------------------------------
{
  const h = stlHeader80('x'.repeat(500));
  check('the header is exactly 80 bytes however long the text is',
    f(h.length === 80, h.length !== 80), `${h.length} bytes`);
  const short = stlHeader80('ab');
  check('a short header is zero-padded, not space-padded or truncated',
    f(short[0] === 97 && short[1] === 98 && short[2] === 0 && short[79] === 0,
      !(short[0] === 97 && short[1] === 98 && short[2] === 0 && short[79] === 0)));
  const uni = stlHeader80('café μm');
  check('non-ASCII in the header is replaced, so nothing is pushed off the end mid-character',
    f(uni.every(b => b === 0 || (b >= 0x20 && b <= 0x7e)), !uni.every(b => b === 0 || (b >= 0x20 && b <= 0x7e))));
  check('a written header never begins with "solid" (which makes readers sniff ASCII STL)',
    f(!/^solid/.test(STL_FORMAT), /^solid/.test(STL_FORMAT)), STL_FORMAT);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nexportStage: the refusal (spec.mjs REFUSALS.no_unstamped_mesh)');
// ---------------------------------------------------------------------------------------------------
{
  const dep = exportStage(stage('depicted'), { subdivisions: 2 });
  check('depicted geometry is REFUSED by default, with stl = null',
    f(typeof dep.refused === 'string' && dep.refused.length > 20 && dep.stl === null,
      !(typeof dep.refused === 'string' && dep.refused.length > 20 && dep.stl === null)),
    String(dep.refused).slice(0, 60));

  const asm = exportStage(stage('assumed'), { subdivisions: 2 });
  check('assumed geometry is REFUSED by default too',
    f(!!asm.refused && asm.stl === null, !(!!asm.refused && asm.stl === null)), String(asm.refused).slice(0, 60));

  const noProv = exportStage({ id: 's', geometry: { units: 'um', cells: GOOD_CELLS } });
  check('geometry with no provenance.kind is refused (nothing to stamp with)',
    f(!!noProv.refused && noProv.stl === null, !(!!noProv.refused && noProv.stl === null)),
    String(noProv.refused).slice(0, 60));

  const noGeom = exportStage({ id: 's' });
  check('a stage with no geometry is refused rather than exported empty',
    f(!!noGeom.refused && noGeom.stl === null, !(!!noGeom.refused && noGeom.stl === null)));

  const allZero = exportStage(stage('measured', BAD_CELLS));
  check('a stage whose every cell is unusable is refused, not written as an empty mesh',
    f(!!allZero.refused && allZero.stl === null && /skipped/.test(allZero.refused),
      !(!!allZero.refused && allZero.stl === null && /skipped/.test(allZero.refused))),
    String(allZero.refused).slice(0, 60));

  check('the refusal names the escape hatch instead of just saying no',
    f(/allowDepicted/.test(dep.refused), !/allowDepicted/.test(dep.refused)));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nexportStage: the gated export');
// ---------------------------------------------------------------------------------------------------
{
  const dep = exportStage(stage('depicted'), { subdivisions: 2, allowDepicted: true });
  check('allowDepicted: true exports instead of refusing',
    f(dep.refused === null && dep.stl !== null && dep.triangle_count === 4 * 320,
      !(dep.refused === null && dep.stl !== null && dep.triangle_count === 4 * 320)),
    `${dep.triangle_count} triangles, refused=${dep.refused}`);

  check(`the suggested filename carries the .${DEPICTION_MARKER} marker`,
    f(dep.suggested_filename.includes(`.${DEPICTION_MARKER}.`) && dep.suggested_filename.endsWith('.stl'),
      !(dep.suggested_filename.includes(`.${DEPICTION_MARKER}.`) && dep.suggested_filename.endsWith('.stl'))),
    dep.suggested_filename);

  const parsed = parseBinarySTL(dep.stl);
  check('the 80-byte header states the provenance kind',
    f(parsed.header.includes('provenance=depicted'), !parsed.header.includes('provenance=depicted')),
    JSON.stringify(parsed.header));
  check('the header also names the format version and the stage id',
    f(parsed.header.includes(STL_FORMAT) && parsed.header.includes('morula-E2.5'),
      !(parsed.header.includes(STL_FORMAT) && parsed.header.includes('morula-E2.5'))),
    JSON.stringify(parsed.header));
  check(`the header repeats the ${DEPICTION_MARKER} marker inside the file`,
    f(parsed.header.includes(DEPICTION_MARKER), !parsed.header.includes(DEPICTION_MARKER)));
  check('the gated export is byte-exact: 84 + 50n',
    f(dep.byte_length === 84 + 50 * dep.triangle_count && parsed.count === dep.triangle_count,
      !(dep.byte_length === 84 + 50 * dep.triangle_count && parsed.count === dep.triangle_count)),
    `${dep.byte_length} bytes`);

  // a stage id full of path characters must not become a path
  const nasty = exportStage({ ...stage('depicted'), id: '../../etc/passwd stage' }, { allowDepicted: true });
  check('a stage id with path characters is sanitised in the suggested filename',
    f(!/[\/\\]/.test(nasty.suggested_filename) && !nasty.suggested_filename.includes('..'),
      /[\/\\]/.test(nasty.suggested_filename) || nasty.suggested_filename.includes('..')),
    nasty.suggested_filename);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nexportStage: measured geometry, and the honesty it still owes');
// ---------------------------------------------------------------------------------------------------
{
  const m = exportStage(stage('measured'), { subdivisions: 2 });
  check('measured geometry exports with no flag needed',
    f(m.refused === null && m.stl !== null && m.gated === false,
      !(m.refused === null && m.stl !== null && m.gated === false)), String(m.refused).slice(0, 60));
  check('a measured export is NOT marked as a depiction in its filename',
    f(!m.suggested_filename.includes(DEPICTION_MARKER) && m.suggested_filename === 'morula-E2.5.stl',
      !(!m.suggested_filename.includes(DEPICTION_MARKER) && m.suggested_filename === 'morula-E2.5.stl')),
    m.suggested_filename);
  check('but its header still states provenance=measured',
    f(parseBinarySTL(m.stl).header.includes('provenance=measured'),
      !parseBinarySTL(m.stl).header.includes('provenance=measured')),
    JSON.stringify(parseBinarySTL(m.stl).header));

  // the whole point of the shape_model field: measured numbers, depicted shape
  check('shape_model records that the SHAPE is depicted even on a measured export',
    f(m.shape_model.kind === 'depicted' && /not spheres/.test(m.shape_model.why_depicted),
      !(m.shape_model.kind === 'depicted' && /not spheres/.test(m.shape_model.why_depicted))),
    m.shape_model?.kind);
  check('shape_model names what the sphere model breaks (exposed surface area)',
    f(/exposed/.test(m.shape_model.what_it_breaks), !/exposed/.test(m.shape_model.what_it_breaks)));
  check('the result says the mesh contradicts the cell that carries a measured area',
    f(typeof m.contradicts_measured_area === 'string' && m.contradicts_measured_area.includes('c3'),
      !(typeof m.contradicts_measured_area === 'string' && m.contradicts_measured_area.includes('c3'))),
    String(m.contradicts_measured_area).slice(0, 50));
  check('the result says the units are lost, and names the unit that was dropped',
    f(/um/.test(m.units_lost) && m.units === 'um', !(/um/.test(m.units_lost) && m.units === 'um')));
  check('triangles_per_cell is reported so the caller can price the export',
    f(m.triangles_per_cell === 320 && m.triangle_count === m.triangles_per_cell * m.cells_drawn,
      !(m.triangles_per_cell === 320 && m.triangle_count === m.triangles_per_cell * m.cells_drawn)),
    `${m.triangles_per_cell} per cell`);

  const partial = exportStage(stage('measured', [...GOOD_CELLS, ...BAD_CELLS]), { subdivisions: 1 });
  check('a partial export reports the skipped cells on the result, not only in the mesh',
    f(partial.stl !== null && partial.skipped.length === 3 && partial.cells_drawn === 4 && partial.cells_total === 7,
      !(partial.stl !== null && partial.skipped.length === 3 && partial.cells_drawn === 4 && partial.cells_total === 7)),
    `drew ${partial.cells_drawn} of ${partial.cells_total}, skipped ${partial.skipped?.length}`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nWHAT_AN_STL_LOSES');
// ---------------------------------------------------------------------------------------------------
{
  check('WHAT_AN_STL_LOSES is frozen',
    f(Object.isFrozen(WHAT_AN_STL_LOSES), !Object.isFrozen(WHAT_AN_STL_LOSES)));
  const keys = ['no_units', 'no_colour', 'no_provenance', 'no_cell_identity', 'no_topology', 'no_measured_channels'];
  const missing = keys.filter(k => typeof WHAT_AN_STL_LOSES[k] !== 'string' || WHAT_AN_STL_LOSES[k].length < 20);
  check('it names units, colour, provenance, cell identity, topology and the measured channels',
    f(missing.length === 0, missing.length !== 0), `missing/short: ${missing.join(', ')}`);
  check('and it says plainly that a mesh is one channel of one stage',
    f(/one channel/i.test(WHAT_AN_STL_LOSES.so_what_a_mesh_is), !/one channel/i.test(WHAT_AN_STL_LOSES.so_what_a_mesh_is)));
}

// ---------------------------------------------------------------------------------------------------
const example = exportStage(stage('measured'), { subdivisions: 2 });
console.log(`\nexample: 4 cells at subdivisions=2 -> ${example.triangle_count} triangles, ${example.byte_length} bytes, ${example.suggested_filename}`);
console.log(`\n${pass} passed, ${fail} failed`);
if (FAULT && pass > 0) console.log(`SURVIVORS: ${pass} assertion(s) passed WITH the fault injected. Those tests test nothing. Fix them.`);
process.exit(fail && !FAULT ? 1 : 0);
