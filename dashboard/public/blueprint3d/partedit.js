// partedit.js -- the geometry side of part-level editing for the blueprint3d design studio.
//
// Dependency-free ES module (no three.js import): it works on any THREE.Object3D tree by duck typing
// (traverse, name, isMesh, geometry.attributes.position.getX/setXYZ, morphAttributes, morphTargetInfluences),
// so the same file runs in the browser next to explode.html and in node for tests (dashboard/test-partedit.mjs).
//
// Exports
//   applyEdits(root, manifest, edits, opts?) -> {applied, refused, recorded, scale}
//   editableParams(manifest, partId)         -> [{param, unit, min, max, meaning, ops, modes?, default_mode?, checks}]
//   measurePart(root, partId, manifest?)     -> {objects, bbox, surface_area, volume (closed only), ...} units + metres
//   resetEdits(root)                         -> number of meshes restored
//   metresPerUnit(manifest)                  -> {m_per_unit, SL_m, SL_units, source} or {m_per_unit:null, reason}
//   resolveTarget(manifest, target)          -> {kind, parts:[object names]} or {kind:null, reason}
//   bodyCavity(root, manifest)               -> {inside(x,y,z), volume_units3, closed}: the containment test alone
//
// EDIT FORMAT (the organism document's, sim-engine/lib/organism.mjs):
//   {target:{level, id}, param, op:'set'|'scale'|'add', value, author, reason, mode?}
//   op 'scale': value is a dimensionless factor, bounded per param (min/max in editableParams).
//   op 'set'  : value is the target quantity in the param's unit (m, m2 or m3), PER PART (a bilateral id such as
//               'pectoral_fin' sets each fin to that value).
//   op 'add'  : value is a change in the param's unit, per part.
//   'set'/'add' need the metres scale; a manifest without one accepts op 'scale' only. Every op is converted to a
//   factor on the CURRENT measured value, and the factor must lie inside the param's [min, max].
//   mode (fins only): span -> 'area'   (default) span x s, chord x 1/s: area kept, aspect ratio x s^2
//                             'aspect' span x s, chord x s: aspect ratio kept, area x s^2
//                             'chord'  span x s, chord kept: area x s
//                     area -> 'aspect' (default) span and chord x sqrt(k)
//                             'span'   span kept, chord x k
//   The mode may also be written as a param suffix: 'span:aspect', 'area:span'.
//
// TARGET RESOLUTION (the manifests carry no explicit part id or parent; the object name is the part id):
//   level 'cell'   -> non-geometric at organism scale; returned in `recorded`, geometry untouched.
//   level 'body'   -> every mesh in the model (children follow: the whole organism).
//   level 'system' -> every internal part whose organ_system / organ_system_id equals id (volume only).
//   otherwise id is matched, in order, to: an object name ('pectoral_fin_L'); a bilateral base name
//   ('pectoral_fin' -> pectoral_fin_L + pectoral_fin_R, each edited about its own anchor); an ontology id
//   (ontology_id or zfa_id; 'UBERON:0000151' or 'UBERON_0000151'), keeping only the topmost matches.
//
// HIERARCHY (derived from manifest names):
//   fin rays are children of their fin membrane: pectoral_fin_ray_L_01 -> pectoral_fin_L,
//   pelvic_fin_rays_L -> pelvic_fin_L, dorsal_fin_rays -> dorsal_fin. Editing a fin applies the SAME
//   root-space transform to its rays (children follow parents). The body cavity (the parent of every internal
//   part, for containment) is the union of the skin objects (skin_L + skin_R, or ontology UBERON_0002097).
//
// ANCHORS (deterministic, from the mesh):
//   fins     : the fin BASE = centroid of the fin vertices that lie INSIDE the body cavity. The parametric build
//              plants every ray root inside the skin (anatomy-model/parametric/build.py: body_pt(t, th, 0.93, sg)
//              for pectoral/pelvic rays, 0.95 for dorsal/anal), so that band IS the fin's contact with its parent.
//              Fallback when no vertex is inside: centroid of the vertices within 5 % of the fin's extent of the
//              smallest vertex-to-skin distance. Spanwise axis u = base -> vertex centroid; plane normal n =
//              smallest principal axis of the vertices; chord w = n x u. A fin therefore grows outward from its base
//              and the base stays where it is.
//   fin rays : their parent fin's base and axes (a ray edited alone lengthens along the fin's span).
//   organs, bones, tissues, eyes : volume centroid (closed mesh) or area centroid (open mesh); axes are the
//              principal axes of the vertices (length = largest, width = middle, thickness = smallest).
//   body     : the skin's area centroid; axes are the model axes (X head-tail length, Y depth, Z width).
//
// CHECKS
//   containment: internal parts (layer organ, skeleton, muscle; not fins, rays, skin or eyes) are tested against
//     the body cavity: every sampled vertex that is inside the skin before the edit must still be inside after it
//     (ray-parity point-in-mesh against the skin triangles; rays +Z, -Z, +Y, majority vote). A failing edit is REFUSED,
//     with the largest fraction of the request that fits (bisection) and its factor. A volume edit is also refused
//     if the new volume would exceed the cavity volume. Eyes (surface organs): checked, warned, never refused.
//   Sibling organs whose bounding boxes newly intersect the edited organ are listed as warnings (schematic organs
//     already touch, so overlap is reported, not enforced).
//
// REVERSIBILITY / DETERMINISM: the first touch stores each mesh's original position, normal and morph arrays in
//   mesh.userData.partedit. applyEdits() restores them before applying the whole list in order, so calling it with
//   the organism document's full edit list is idempotent (opts.accumulate = true skips the restore). resetEdits()
//   restores and forgets them. No randomness; sampling is by fixed stride.
//
// UNITS: metres per model unit = parameters.standard_length_m / SL in model units, the SL read from the manifest
//   text ("standard_length_m / 0.8200 model units" in derived_from_the_mesh.measured_how, or "SL = 0.82 model units"
//   in units_and_axes). This is build.py's own m_per_unit = SL_m / (SL_REF_UNITS * size_rel), SL_REF_UNITS = 0.82,
//   size_rel = 1 for the resolved set. Manifests without standard_length_m (flying-fish.glb, zebrafish-adult,
//   zebrafish-larva) get model units only, metres null, and op 'scale' only.
//
// GEOMETRY: edits are written into the vertex data (positions in the mesh's local frame, morph deltas by the linear
//   part, normals by the inverse transpose), never into mesh.position/scale, so explode offsets and explode.html's
//   own Design Studio piece scaling keep working on top. Anchors and measurements use each object's REST transform
//   (manifest centre_gltf; the parametric GLBs export identity rotation and unit scale, checked in the node test),
//   so an exploded view does not move the anchors. Measurements include the current morph-target weights.
//
// LIMITS: fin thickness is not editable (the membrane is a zero-thickness sheet: Blender cannot apply a solidify
//   modifier to a mesh with shape keys); the skin is not editable on its own (edit level 'body'); tissue thickness
//   is a normal offset with thickness estimated as 2V/S (exact for a thin slab, approximate otherwise) and morph
//   deltas are not offset; girdle bones do not drag the fin; containment tests vertices (an edge can still graze
//   the skin between vertices); organ-organ collision is reported, not enforced; cell edits change no geometry.

const LIM = { len: [0.25, 4], area: [0.1, 10], vol: [0.05, 20], thick: [0.25, 4], body: [0.5, 2] };

// ---------------------------------------------------------------- small linear algebra (column-major 4x4, three.js layout)
const I4 = () => { const e = new Float64Array(16); e[0] = e[5] = e[10] = e[15] = 1; return e; };
function mul4(a, b) { const r = new Float64Array(16); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + rr] * b[c * 4 + k]; r[c * 4 + rr] = s; } return r; }
function trans4(x, y, z) { const e = I4(); e[12] = x; e[13] = y; e[14] = z; return e; }
function from3(L) { const e = I4(); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) e[c * 4 + r] = L[c * 3 + r]; return e; }
function inv4(a) {
  const inv = new Float64Array(16);
  inv[0] = a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10];
  inv[4] = -a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10];
  inv[8] = a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9];
  inv[12] = -a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
  inv[1] = -a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10];
  inv[5] = a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10];
  inv[9] = -a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9];
  inv[13] = a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
  inv[2] = a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6];
  inv[6] = -a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6];
  inv[10] = a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5];
  inv[14] = -a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5];
  inv[3] = -a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6];
  inv[7] = a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6];
  inv[11] = -a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5];
  inv[15] = a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
  let det = a[0]*inv[0]+a[1]*inv[4]+a[2]*inv[8]+a[3]*inv[12]; if (Math.abs(det) < 1e-300) return I4(); det = 1 / det;
  for (let i = 0; i < 16; i++) inv[i] *= det; return inv;
}
const ap = (m, x, y, z) => [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
const apL = (m, x, y, z) => [m[0]*x+m[4]*y+m[8]*z, m[1]*x+m[5]*y+m[9]*z, m[2]*x+m[6]*y+m[10]*z];
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len3 = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len3(a); return l > 1e-15 ? [a[0]/l, a[1]/l, a[2]/l] : [0, 0, 0]; };
// L = I + sum_k (s_k - 1) a_k a_k^T over orthonormal axes a_k (3x3, column-major)
function stretch(axes, factors) { const L = [1,0,0, 0,1,0, 0,0,1]; axes.forEach((a, k) => { const f = factors[k] - 1; if (!f) return; for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) L[c*3+r] += f * a[r] * a[c]; }); return L; }
function jacobi3(S) { // symmetric 3x3 [a00,a01,a02,a11,a12,a22] -> {vals, vecs} sorted descending
  const a = [[S[0], S[1], S[2]], [S[1], S[3], S[4]], [S[2], S[4], S[5]]], v = [[1,0,0],[0,1,0],[0,0,1]];
  for (let it = 0; it < 60; it++) {
    let p = 0, q = 1, mx = Math.abs(a[0][1]); if (Math.abs(a[0][2]) > mx) { p = 0; q = 2; mx = Math.abs(a[0][2]); } if (Math.abs(a[1][2]) > mx) { p = 1; q = 2; mx = Math.abs(a[1][2]); }
    if (mx < 1e-20) break;
    const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th*th + 1)), c = 1 / Math.sqrt(t*t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c*akp - s*akq; a[k][q] = s*akp + c*akq; }
    for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c*apk - s*aqk; a[q][k] = s*apk + c*aqk; }
    for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c*vkp - s*vkq; v[k][q] = s*vkp + c*vkq; }
  }
  const idx = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
  return { vals: idx.map(i => a[i][i]), vecs: idx.map(i => { const e = [v[0][i], v[1][i], v[2][i]]; // deterministic sign: largest component positive
    let m = 0; for (let k = 1; k < 3; k++) if (Math.abs(e[k]) > Math.abs(e[m]) + 1e-12) m = k; return e[m] < 0 ? e.map(x => -x) : e; }) };
}
function pca(P) { const n = P.length / 3; let cx = 0, cy = 0, cz = 0; for (let i = 0; i < n; i++) { cx += P[3*i]; cy += P[3*i+1]; cz += P[3*i+2]; } cx /= n; cy /= n; cz /= n;
  const S = [0,0,0,0,0,0]; for (let i = 0; i < n; i++) { const x = P[3*i]-cx, y = P[3*i+1]-cy, z = P[3*i+2]-cz; S[0]+=x*x; S[1]+=x*y; S[2]+=x*z; S[3]+=y*y; S[4]+=y*z; S[5]+=z*z; }
  return { mean: [cx, cy, cz], ...jacobi3(S.map(s => s / Math.max(n, 1))) }; }

// ---------------------------------------------------------------- manifest: scale, kinds, hierarchy
export function metresPerUnit(manifest) {
  const p = (manifest && manifest.parameters) || {}, SLm = Number(p.standard_length_m);
  const texts = [manifest && manifest.units_and_axes, manifest && manifest.derived_from_the_mesh && manifest.derived_from_the_mesh.measured_how].filter(Boolean).join(' \n ');
  const pats = [[/standard_length_m\s*\/\s*([0-9]*\.?[0-9]+)\s*model units/i, 'derived_from_the_mesh.measured_how'], [/\bSL\s*=\s*([0-9]*\.?[0-9]+)\s*model units/i, 'units_and_axes'], [/standard length[^=]*=\s*([0-9]*\.?[0-9]+)\s*units/i, 'units_and_axes']];
  let SLu = null, src = null; for (const [re, s] of pats) { const m = texts.match(re); if (m) { SLu = Number(m[1]); src = s; break; } }
  if (!(SLm > 0)) return { m_per_unit: null, SL_units: SLu, reason: 'the manifest has no parameters.standard_length_m, so model units cannot be converted to metres (not guessed)' };
  if (!(SLu > 0)) return { m_per_unit: null, SL_m: SLm, reason: 'the manifest states standard_length_m but not the standard length in model units' };
  return { m_per_unit: SLm / SLu, SL_m: SLm, SL_units: SLu, source: `parameters.standard_length_m (${SLm} m) / SL in model units (${SLu}, from ${src})` };
}
const nameOf = o => o.object || o.name;
const normId = s => String(s || '').trim().replace(':', '_').toUpperCase();
function rayParent(n) { let m = n.match(/^(.*_fin)_ray_(L|R)_\d+$/); if (m) return m[1] + '_' + m[2]; m = n.match(/^(.*_fin)_rays?(?:_(L|R))?$/); if (m) return m[1] + (m[2] ? '_' + m[2] : ''); m = n.match(/^(.*_fin)_ray_\d+$/); if (m) return m[1]; return null; }
function kindOf(o) {
  const n = nameOf(o);
  if (/^skin(_|$)/.test(n) || normId(o.ontology_id) === 'UBERON_0002097') return 'skin';
  if (o.level === 'cell') return 'cell';
  if (rayParent(n)) return 'fin_rays';
  if (/_fin(_L|_R)?$/.test(n)) return 'fin';
  if (o.level === 'tissue' || o.layer === 'muscle') return 'tissue';
  if (o.layer === 'organ') return 'organ';
  if (o.layer === 'skeleton') return 'skeletal';
  return 'surface_organ';
}
function graph(manifest) {
  if (manifest && manifest.__parteditGraph) return manifest.__parteditGraph;
  const objs = (manifest && manifest.objects) || [], byName = new Map(), kids = new Map(), parent = new Map();
  for (const o of objs) byName.set(nameOf(o), o);
  for (const o of objs) { const n = nameOf(o); if (kindOf(o) === 'fin_rays') { const p = rayParent(n); if (byName.has(p)) { parent.set(n, p); if (!kids.has(p)) kids.set(p, []); kids.get(p).push(n); } } }
  const g = { objs, byName, parent, kids, kind: n => byName.has(n) ? kindOf(byName.get(n)) : null, skins: objs.filter(o => kindOf(o) === 'skin').map(nameOf) };
  try { Object.defineProperty(manifest, '__parteditGraph', { value: g, enumerable: false, configurable: true }); } catch (e) { /* frozen manifest: recomputed next time */ }
  return g;
}
export function resolveTarget(manifest, target) {
  const g = graph(manifest), t = target || {}, level = String(t.level || '').toLowerCase(), id = t.id == null ? '' : String(t.id);
  if (level === 'cell') return { kind: 'cell', parts: [] };
  if (level === 'body' || id === 'body' || id === 'organism') return { kind: 'body', parts: g.objs.map(nameOf) };
  if (level === 'system') { const want = id.toLowerCase(), wid = normId(id);
    const parts = g.objs.filter(o => ['organ', 'skeletal', 'tissue'].includes(kindOf(o)) && ((o.organ_system && o.organ_system.toLowerCase() === want) || (o.organ_system_id && normId(o.organ_system_id) === wid))).map(nameOf);
    return parts.length ? { kind: 'system', parts } : { kind: null, parts: [], reason: `no internal part of the manifest has organ_system "${id}"` }; }
  if (g.byName.has(id)) return { kind: g.kind(id), parts: [id] };
  const bil = ['_L', '_R'].map(s => id + s).filter(n => g.byName.has(n));
  if (bil.length) return { kind: g.kind(bil[0]), parts: bil, bilateral: true };
  const wid = normId(id); if (wid) { let hits = g.objs.filter(o => normId(o.ontology_id) === wid || normId(o.zfa_id) === wid).map(nameOf);
    const set = new Set(hits); hits = hits.filter(n => !(g.parent.has(n) && set.has(g.parent.get(n))));
    if (hits.length) { const kinds = [...new Set(hits.map(g.kind))]; return kinds.length === 1 ? { kind: kinds[0], parts: hits, by: 'ontology id' } : { kind: null, parts: hits, reason: `ontology id ${id} maps to parts of different kinds (${kinds.join(', ')}); target one by object name` }; } }
  return { kind: null, parts: [], reason: `no object, bilateral pair or ontology id "${id}" in the manifest` };
}

// ---------------------------------------------------------------- editable params per kind
const P = (param, unit, lim, meaning, extra = {}) => ({ param, unit, min: lim[0], max: lim[1], meaning, ops: ['scale', 'set', 'add'], bounds: `op 'scale' takes a factor in [${lim[0]}, ${lim[1]}]; 'set' and 'add' take ${unit} and must imply a factor in that range`, checks: [], ...extra });
const C = { checks: ['containment'] };
const PARAMS = {
  fin: () => [
    P('length', 'm', LIM.len, "root-to-tip length along the fin's spanwise axis, stretched from the fin base (its contact band with the body); chord kept, so area scales with it; rays follow"),
    P('span', 'm', LIM.len, 'root-to-tip span from the fin base, with a mode: area (default) keeps area, chord x 1/s, aspect ratio x s^2; aspect keeps aspect ratio, chord x s, area x s^2; chord keeps chord, area x s; rays follow', { modes: ['area', 'aspect', 'chord'], default_mode: 'area' }),
    P('width', 'm', LIM.len, 'chord: in-plane extent perpendicular to the span, scaled about the fin base; rays follow', { aliases: ['chord'] }),
    P('area', 'm2', LIM.area, 'membrane area (one side) of this fin, scaled from the base: aspect (default) scales span and chord by sqrt(k); span keeps span and scales chord by k; rays follow', { modes: ['aspect', 'span'], default_mode: 'aspect' })],
  fin_rays: () => [P('length', 'm', LIM.len, "ray length along the parent fin's spanwise axis, from the parent fin's base")],
  organ: () => [
    P('volume', 'm3', LIM.vol, 'organ volume, uniform scale about its volume centroid; REFUSED if any vertex would leave the body cavity (skin) or the volume would exceed the cavity volume', C),
    P('length', 'm', LIM.len, "extent along the part's longest principal axis, about its centroid (containment checked)", C),
    P('width', 'm', LIM.len, 'extent along the middle principal axis, about its centroid (containment checked)', C),
    P('thickness', 'm', LIM.len, 'extent along the shortest principal axis, about its centroid (containment checked)', C)],
  tissue: () => [
    P('thickness', 'm', LIM.thick, 'tissue thickness: every vertex moves along its outward surface normal; thickness estimated as 2*volume/surface (exact for a thin slab); containment checked', C),
    P('volume', 'm3', LIM.vol, 'tissue volume, uniform scale about its centroid (containment checked)', C),
    P('length', 'm', LIM.len, 'extent along the longest principal axis, about its centroid (containment checked)', C),
    P('width', 'm', LIM.len, 'extent along the middle principal axis, about its centroid (containment checked)', C)],
  body: () => [
    P('length', 'm', LIM.body, 'whole-organism length (model X, head to tail) about the skin centroid; every part follows'),
    P('depth', 'm', LIM.body, 'whole-organism depth (model Y, dorsal to ventral); every part follows'),
    P('width', 'm', LIM.body, 'whole-organism width (model Z, left to right); every part follows'),
    P('size', 'm', LIM.body, 'uniform whole-organism scale (value refers to length); every part follows')],
  system: () => [P('volume', 'm3', LIM.vol, 'volume of every internal part in the system, each about its own centroid; all-or-nothing: refused if any member fails containment', C)],
};
PARAMS.skeletal = PARAMS.organ;
PARAMS.surface_organ = () => PARAMS.organ().map(p => ({ ...p, meaning: p.meaning.replace(/; REFUSED if.*$/, '; surface organ: leaving the skin is a warning, not a refusal').replace('(containment checked)', '(surface organ: leaving the skin is a warning)'), checks: ['containment-warning'] }));
const paramsFor = kind => (PARAMS[kind] || (() => []))();
export function editableParams(manifest, partId) {
  const t = typeof partId === 'object' && partId ? partId : { id: partId };
  const r = resolveTarget(manifest, t);
  if (!r.kind || r.kind === 'cell' || r.kind === 'skin') return [];
  return paramsFor(r.kind);
}

// ---------------------------------------------------------------- geometry access
function meshIndex(root) { const map = new Map(); // object name -> meshes under the named node
  root.traverse(o => { if (!o.name || map.has(o.name)) return; const ms = []; o.traverse(c => { if (c.isMesh && c.geometry && c.geometry.attributes && c.geometry.attributes.position) ms.push(c); }); if (ms.length) map.set(o.name, { node: o, meshes: ms }); });
  return map; }
function relMatrix(node, upto) { let m = I4(); for (let o = node; o && o !== upto; o = o.parent) { if (o.updateMatrix) o.updateMatrix(); m = mul4(Float64Array.from(o.matrix.elements), m); } return m; }
const grab = attr => { const n = attr.count, out = new Float32Array(n * 3); for (let i = 0; i < n; i++) { out[3*i] = attr.getX(i); out[3*i+1] = attr.getY(i); out[3*i+2] = attr.getZ(i); } return out; };
function state(mesh, entry, mobj) {
  const ud = mesh.userData || (mesh.userData = {});
  if (ud.partedit) return ud.partedit;
  const g = mesh.geometry, a = g.attributes;
  // REST transform: the named node at its manifest centre_gltf (identity rotation, unit scale in the parametric
  // exports), times the mesh's own transform below the named node (multi-primitive nodes); otherwise the current
  // node-to-root matrix, frozen at first touch.
  const c = mobj && mobj.centre_gltf;
  const rest = Array.isArray(c) && c.length === 3 ? mul4(trans4(c[0], c[1], c[2]), mesh === entry.node ? I4() : relMatrix(mesh, entry.node)) : relMatrix(mesh, null);
  ud.partedit = { rest, restInv: inv4(rest), pos: grab(a.position), normal: a.normal ? grab(a.normal) : null,
    morph: ((g.morphAttributes && g.morphAttributes.position) || []).map(grab), morphN: ((g.morphAttributes && g.morphAttributes.normal) || []).map(grab) };
  return ud.partedit;
}
function writeBack(attr, arr) { for (let i = 0; i < attr.count; i++) attr.setXYZ(i, arr[3*i], arr[3*i+1], arr[3*i+2]); attr.needsUpdate = true; }
function touched(mesh) { const g = mesh.geometry; if (g.computeBoundingBox) g.computeBoundingBox(); if (g.computeBoundingSphere) g.computeBoundingSphere(); }
function restore(mesh) { const st = mesh.userData && mesh.userData.partedit; if (!st) return false; const g = mesh.geometry;
  writeBack(g.attributes.position, st.pos); if (st.normal && g.attributes.normal) writeBack(g.attributes.normal, st.normal);
  ((g.morphAttributes && g.morphAttributes.position) || []).forEach((m, k) => st.morph[k] && writeBack(m, st.morph[k]));
  ((g.morphAttributes && g.morphAttributes.normal) || []).forEach((m, k) => st.morphN[k] && writeBack(m, st.morphN[k]));
  touched(mesh); return true; }
export function resetEdits(root) { let n = 0; root.traverse(o => { if (o.isMesh && o.userData && o.userData.partedit) { restore(o); delete o.userData.partedit; n++; } }); if (root.userData) delete root.userData.parteditLast; return n; }

// effective root-space positions (base + current morph influences): what is on screen
function rootPositions(mesh, st) {
  const g = mesh.geometry, a = g.attributes.position, n = a.count, out = new Float64Array(3 * n);
  const ms = (g.morphAttributes && g.morphAttributes.position) || [], w = mesh.morphTargetInfluences || [], rel = g.morphTargetsRelative !== false;
  let wsum = 0; for (let k = 0; k < ms.length; k++) wsum += w[k] || 0;
  for (let i = 0; i < n; i++) {
    let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    if (ms.length && wsum) {
      if (rel) { for (let k = 0; k < ms.length; k++) { const wk = w[k] || 0; if (wk) { x += wk * ms[k].getX(i); y += wk * ms[k].getY(i); z += wk * ms[k].getZ(i); } } }
      else { let X = x * (1 - wsum), Y = y * (1 - wsum), Z = z * (1 - wsum); for (let k = 0; k < ms.length; k++) { const wk = w[k] || 0; X += wk * ms[k].getX(i); Y += wk * ms[k].getY(i); Z += wk * ms[k].getZ(i); } x = X; y = Y; z = Z; }
    }
    const p = ap(st.rest, x, y, z); out[3*i] = p[0]; out[3*i+1] = p[1]; out[3*i+2] = p[2];
  }
  return out;
}
function triangles(mesh) { const g = mesh.geometry, n = g.attributes.position.count, idx = g.index, T = [];
  if (idx) { for (let i = 0; i + 2 < idx.count; i += 3) T.push(idx.getX(i), idx.getX(i+1), idx.getX(i+2)); } else for (let i = 0; i + 2 < n; i += 3) T.push(i, i+1, i+2);
  return T; }
// a part view: the meshes of a set of object names with root-space positions
function view(ctx, names) {
  const items = [];
  for (const nm of names) { const e = ctx.index.get(nm); if (!e) continue; for (const m of e.meshes) { const st = state(m, e, ctx.g.byName.get(nm)); items.push({ name: nm, mesh: m, st, P: rootPositions(m, st), T: triangles(m) }); } }
  return items;
}
function allPoints(items) { let n = 0; for (const it of items) n += it.P.length; const P = new Float64Array(n); let o = 0; for (const it of items) { P.set(it.P, o); o += it.P.length; } return P; }

// measurement in model units: bbox, area, closedness (joint weld across the items), volume, centroid
function measureItems(items) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  let area = 0, vol = 0; const ac = [0, 0, 0], vc = [0, 0, 0];
  const weld = new Map(), edges = new Map(); let wid = 0; const q = 1e-6;
  const key = (x, y, z) => Math.round(x / q) + ',' + Math.round(y / q) + ',' + Math.round(z / q);
  for (const it of items) { const Pp = it.P;
    for (let i = 0; i < Pp.length; i += 3) for (let k = 0; k < 3; k++) { if (Pp[i+k] < mn[k]) mn[k] = Pp[i+k]; if (Pp[i+k] > mx[k]) mx[k] = Pp[i+k]; }
    const W = new Int32Array(Pp.length / 3); for (let i = 0; i < W.length; i++) { const kk = key(Pp[3*i], Pp[3*i+1], Pp[3*i+2]); let w = weld.get(kk); if (w === undefined) { w = wid++; weld.set(kk, w); } W[i] = w; }
    const T = it.T; for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t+1], c = T[t+2];
      const A = [Pp[3*a], Pp[3*a+1], Pp[3*a+2]], B = [Pp[3*b], Pp[3*b+1], Pp[3*b+2]], Cc = [Pp[3*c], Pp[3*c+1], Pp[3*c+2]];
      const ar = 0.5 * len3(cross(sub(B, A), sub(Cc, A))); area += ar;
      for (let k = 0; k < 3; k++) ac[k] += ar * (A[k] + B[k] + Cc[k]) / 3;
      const v6 = dot(A, cross(B, Cc)) / 6; vol += v6; for (let k = 0; k < 3; k++) vc[k] += v6 * (A[k] + B[k] + Cc[k]) / 4;
      const wa = W[a], wb = W[b], wc = W[c]; if (wa === wb || wb === wc || wa === wc) continue; // degenerate after weld
      for (const [u, v] of [[wa, wb], [wb, wc], [wc, wa]]) { const ek = u < v ? u + '_' + v : v + '_' + u; edges.set(ek, (edges.get(ek) || 0) + 1); } } }
  let open = 0, nonman = 0; for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) nonman++; }
  const closed = edges.size > 0 && open === 0 && nonman === 0;
  const centroid = closed && Math.abs(vol) > 1e-18 ? vc.map(x => x / vol) : (area > 0 ? ac.map(x => x / area) : [(mn[0]+mx[0])/2, (mn[1]+mx[1])/2, (mn[2]+mx[2])/2]);
  return { bbox: { min: mn, max: mx, size: mx.map((v, k) => v - mn[k]) }, area, closed, volume: closed ? Math.abs(vol) : null, open_edges: open, nonmanifold_edges: nonman, centroid };
}

// ---------------------------------------------------------------- body cavity: ray-parity point-in-mesh, 2D grids
function buildCavity(ctx) {
  const items = view(ctx, ctx.g.skins); if (!items.length) return null;
  const tris = []; for (const it of items) for (let t = 0; t < it.T.length; t += 3) { const tri = []; for (let k = 0; k < 3; k++) { const i = it.T[t+k]; tri.push(it.P[3*i], it.P[3*i+1], it.P[3*i+2]); } tris.push(tri); }
  const M = measureItems(items), mn = M.bbox.min, mx = M.bbox.max, N = 48;
  const mk = (a, b) => { const cells = new Map(), sa = (mx[a] - mn[a]) / N || 1, sb = (mx[b] - mn[b]) / N || 1;
    tris.forEach((tr, ti) => { const ia0 = Math.floor((Math.min(tr[a], tr[3+a], tr[6+a]) - mn[a]) / sa), ia1 = Math.floor((Math.max(tr[a], tr[3+a], tr[6+a]) - mn[a]) / sa), ib0 = Math.floor((Math.min(tr[b], tr[3+b], tr[6+b]) - mn[b]) / sb), ib1 = Math.floor((Math.max(tr[b], tr[3+b], tr[6+b]) - mn[b]) / sb);
      for (let i = ia0; i <= ia1; i++) for (let j = ib0; j <= ib1; j++) { const k = i * 100003 + j; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(ti); } });
    return { a, b, sa, sb, cells }; };
  const gy = mk(0, 2), gz = mk(0, 1); // rays along Y use an (x,z) grid; rays along Z an (x,y) grid
  const crossings = (G, axis, sign, p) => { const list = G.cells.get(Math.floor((p[G.a] - mn[G.a]) / G.sa) * 100003 + Math.floor((p[G.b] - mn[G.b]) / G.sb)); if (!list) return 0; let c = 0;
    for (const ti of list) { const tr = tris[ti], ax = [tr[G.a], tr[3+G.a], tr[6+G.a]], bx = [tr[G.b], tr[3+G.b], tr[6+G.b]];
      const d = (bx[1] - bx[2]) * (ax[0] - ax[2]) + (ax[2] - ax[1]) * (bx[0] - bx[2]); if (Math.abs(d) < 1e-24) continue;
      const l1 = ((bx[1] - bx[2]) * (p[G.a] - ax[2]) + (ax[2] - ax[1]) * (p[G.b] - bx[2])) / d, l2 = ((bx[2] - bx[0]) * (p[G.a] - ax[2]) + (ax[0] - ax[2]) * (p[G.b] - bx[2])) / d, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue; const h = l1 * tr[axis] + l2 * tr[3+axis] + l3 * tr[6+axis]; if ((h - p[axis]) * sign > 0) c++; }
    return c; };
  const J = [1.37e-7, 0.71e-7, 1.13e-7]; // fixed jitter so rays do not run exactly along shared edges
  const inside = (x, y, z) => { if (x < mn[0] || x > mx[0] || y < mn[1] || y > mx[1] || z < mn[2] || z > mx[2]) return false; const p = [x + J[0], y + J[1], z + J[2]];
    // +Z and -Z cross the midline seam between skin_L and skin_R transversally (a ray along Y or X lying in the seam
    // plane z = 0 can slip between the two halves); +Y breaks ties
    return (crossings(gz, 2, 1, p) & 1) + (crossings(gz, 2, -1, p) & 1) + (crossings(gy, 1, 1, p) & 1) >= 2; };
  return { inside, volume: M.volume, closed: M.closed, bbox: M.bbox, points: allPoints(items), centroid: M.centroid, area: M.area };
}
function cavity(ctx) { if (ctx.cav === null) ctx.cav = buildCavity(ctx) || false; return ctx.cav || null; }
function sampleIdx(n, max) { const step = Math.max(1, Math.ceil(n / max)), out = []; for (let i = 0; i < n; i += step) out.push(i); return out; }

// ---------------------------------------------------------------- anchors and frames
function finFrame(ctx, finName) {
  const items = view(ctx, [finName]); if (!items.length) return null;
  const P = allPoints(items), n = P.length / 3, cav = cavity(ctx);
  let band = [], method = '';
  if (cav) { for (let i = 0; i < n; i++) if (cav.inside(P[3*i], P[3*i+1], P[3*i+2])) band.push(i); method = 'fin base = centroid of the fin vertices inside the body cavity (its contact band with the skin)'; }
  if (band.length < 2 || band.length > 0.6 * n) { // fallback: the band closest to the skin's vertices
    band = []; const S = cav ? cav.points : null;
    if (S) { const d = new Float64Array(n); let dmin = Infinity;
      for (let i = 0; i < n; i++) { let b = Infinity; for (let j = 0; j < S.length; j += 3) { const dx = P[3*i]-S[j], dy = P[3*i+1]-S[j+1], dz = P[3*i+2]-S[j+2], q = dx*dx+dy*dy+dz*dz; if (q < b) b = q; } d[i] = Math.sqrt(b); if (d[i] < dmin) dmin = d[i]; }
      const span = Math.sqrt(Math.max(pca(P).vals[0], 0)) * 3.46, tol = dmin + 0.05 * span; for (let i = 0; i < n; i++) if (d[i] <= tol) band.push(i);
      method = 'fin base = centroid of the fin vertices closest to the skin (within 5 % of the fin extent of the minimum distance)'; }
  }
  if (!band.length) return null;
  const a = [0, 0, 0]; for (const i of band) for (let k = 0; k < 3; k++) a[k] += P[3*i+k] / band.length;
  const pc = pca(P); let u = nrm(sub(pc.mean, a));
  if (len3(sub(pc.mean, a)) < 1e-9) { u = pc.vecs[0]; method += '; spanwise axis = principal axis (base at the centroid)'; }
  let nn = pc.vecs[2]; if (Math.abs(dot(nn, u)) > 0.95) nn = pc.vecs[1];
  const w = nrm(cross(nn, u)); nn = nrm(cross(u, w));
  return { anchor: a, axes: { u, w, n: nn }, method, band: band.length, of: n, fromBase: true };
}
function extents(P, a, axes) { const r = {}; for (const [k, ax] of Object.entries(axes)) { let lo = Infinity, hi = -Infinity; for (let i = 0; i < P.length; i += 3) { const s = (P[i]-a[0])*ax[0] + (P[i+1]-a[1])*ax[1] + (P[i+2]-a[2])*ax[2]; if (s < lo) lo = s; if (s > hi) hi = s; } r[k] = { lo, hi, ext: hi - lo }; } return r; }

// ---------------------------------------------------------------- transforms
function linearCandidate(items, a, L) { return items.map(it => { const Q = new Float64Array(it.P.length); for (let i = 0; i < Q.length; i += 3) { const d0 = it.P[i]-a[0], d1 = it.P[i+1]-a[1], d2 = it.P[i+2]-a[2]; Q[i] = a[0] + L[0]*d0 + L[3]*d1 + L[6]*d2; Q[i+1] = a[1] + L[1]*d0 + L[4]*d1 + L[7]*d2; Q[i+2] = a[2] + L[2]*d0 + L[5]*d1 + L[8]*d2; } return Q; }); }
function commitLinear(items, a, L) {
  const A = mul4(trans4(a[0], a[1], a[2]), mul4(from3(L), trans4(-a[0], -a[1], -a[2])));
  const seen = new Set();
  for (const it of items) { if (seen.has(it.mesh)) continue; seen.add(it.mesh);
    const M = mul4(it.st.restInv, mul4(A, it.st.rest)), Ni = inv4(M), g = it.mesh.geometry, pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const p = ap(M, pa.getX(i), pa.getY(i), pa.getZ(i)); pa.setXYZ(i, p[0], p[1], p[2]); } pa.needsUpdate = true;
    const rel = g.morphTargetsRelative !== false;
    for (const m of ((g.morphAttributes && g.morphAttributes.position) || [])) { for (let i = 0; i < m.count; i++) { const p = (rel ? apL : ap)(M, m.getX(i), m.getY(i), m.getZ(i)); m.setXYZ(i, p[0], p[1], p[2]); } m.needsUpdate = true; }
    const nT = [Ni[0], Ni[4], Ni[8], 0, Ni[1], Ni[5], Ni[9], 0, Ni[2], Ni[6], Ni[10], 0, 0, 0, 0, 1]; // (M^-1)^T
    const fixN = attr => { if (!attr) return; for (let i = 0; i < attr.count; i++) { const v = nrm(apL(nT, attr.getX(i), attr.getY(i), attr.getZ(i))); attr.setXYZ(i, v[0], v[1], v[2]); } attr.needsUpdate = true; };
    fixN(g.attributes.normal); touched(it.mesh); }
}
// welded, area-weighted outward vertex normals in root space (outward from the sign of the enclosed volume)
function vertexNormals(items) {
  const q = 1e-6, key = (x, y, z) => Math.round(x / q) + ',' + Math.round(y / q) + ',' + Math.round(z / q), acc = new Map();
  const keys = items.map(it => { const K = []; for (let i = 0; i < it.P.length; i += 3) K.push(key(it.P[i], it.P[i+1], it.P[i+2])); return K; });
  let sv = 0;
  items.forEach((it, m) => { const Pp = it.P, T = it.T; for (let t = 0; t < T.length; t += 3) { const ia = T[t], ib = T[t+1], ic = T[t+2];
    const A = [Pp[3*ia], Pp[3*ia+1], Pp[3*ia+2]], B = [Pp[3*ib], Pp[3*ib+1], Pp[3*ib+2]], Cc = [Pp[3*ic], Pp[3*ic+1], Pp[3*ic+2]], cr = cross(sub(B, A), sub(Cc, A)); sv += dot(A, cross(B, Cc));
    for (const i of [ia, ib, ic]) { const k = keys[m][i]; const v = acc.get(k) || [0, 0, 0]; v[0] += cr[0]; v[1] += cr[1]; v[2] += cr[2]; acc.set(k, v); } } });
  const s = sv < 0 ? -1 : 1;
  return items.map((it, m) => { const N = new Float64Array(it.P.length); keys[m].forEach((k, i) => { const v = nrm(acc.get(k) || [0, 0, 0]); N[3*i] = s * v[0]; N[3*i+1] = s * v[1]; N[3*i+2] = s * v[2]; }); return N; });
}
function offsetCandidate(items, N, d) { return items.map((it, m) => { const Q = new Float64Array(it.P.length); for (let i = 0; i < Q.length; i++) Q[i] = it.P[i] + d * N[m][i]; return Q; }); }
function commitOffset(items, N, d) { items.forEach((it, m) => { const pa = it.mesh.geometry.attributes.position, R = it.st.restInv;
  for (let i = 0; i < pa.count; i++) { const o = apL(R, d * N[m][3*i], d * N[m][3*i+1], d * N[m][3*i+2]); pa.setXYZ(i, pa.getX(i) + o[0], pa.getY(i) + o[1], pa.getZ(i) + o[2]); } pa.needsUpdate = true; touched(it.mesh); }); }
const measureCand = (items, cand) => measureItems(items.map((it, m) => ({ P: cand[m], T: it.T })));
// 1-D secant solve of f(x) = 0 from x0 (used to hit an exact measured area or thickness on curved meshes)
function secant(f, x0, rel = 1e-7) { let a = x0, b = x0 * 1.02 + (x0 === 0 ? 1e-6 : 0), fa = f(a), fb = f(b);
  for (let i = 0; i < 12 && Math.abs(fb) > rel && fb !== fa; i++) { const c = b - fb * (b - a) / (fb - fa); a = b; fa = fb; b = c; fb = f(b); }
  return { x: b, residual: fb }; }
// containment: sampled vertices inside the cavity before the edit must stay inside
function containment(cav, items, cand) {
  let bad = 0, tested = 0;
  items.forEach((it, m) => { for (const i of sampleIdx(it.P.length / 3, 400)) { if (!cav.inside(it.P[3*i], it.P[3*i+1], it.P[3*i+2])) continue; tested++; const Q = cand[m]; if (!cav.inside(Q[3*i], Q[3*i+1], Q[3*i+2])) bad++; } });
  return { ok: bad === 0, outside: bad, tested };
}

// ---------------------------------------------------------------- main
const toM = (x, mpu, pow = 1) => (mpu && x != null ? x * Math.pow(mpu, pow) : null);
const r6 = x => (x == null || !isFinite(x) ? x : Number(x.toPrecision(6)));
function factorFor(edit, current, lim, mpu, unitPow) {
  const v = Number(edit.value); if (edit.value === null || edit.value === '' || !isFinite(v)) return { err: `value ${JSON.stringify(edit.value)} is not a number` };
  let k;
  if (edit.op === 'scale') k = v;
  else if (edit.op === 'set' || edit.op === 'add') {
    if (!mpu) return { err: `op '${edit.op}' needs metres, but this model has no metres scale; use op 'scale'` };
    if (!(current > 0)) return { err: 'the current value could not be measured, so set/add cannot be converted to a factor' };
    const cur = current * Math.pow(mpu, unitPow); k = edit.op === 'set' ? v / cur : (cur + v) / cur; }
  else return { err: `op must be 'set', 'scale' or 'add' (got ${JSON.stringify(edit.op)})` };
  if (!(k > 0)) return { err: `the edit implies a factor of ${r6(k)}; a part cannot be scaled to zero or negative size` };
  if (k < lim[0] - 1e-12 || k > lim[1] + 1e-12) return { err: `factor ${r6(k)} is outside the allowed range [${lim[0]}, ${lim[1]}] for this param` };
  return { k };
}

export function applyEdits(root, manifest, edits, opts = {}) {
  const sc = metresPerUnit(manifest), mpu = sc.m_per_unit;
  const ctx = { manifest, g: graph(manifest), index: meshIndex(root), cav: null };
  if (root.userData) root.userData.parteditManifest = manifest;
  if (opts.accumulate !== true) root.traverse(o => { if (o.isMesh) restore(o); });
  const applied = [], refused = [], recorded = [];
  (edits || []).forEach((edit, ei) => {
    try { const out = applyOne(ctx, edit, mpu);
      if (out.refused) refused.push({ edit, index: ei, reason: out.refused, ...(out.detail ? { detail: out.detail } : {}) });
      else if (out.recorded) recorded.push({ edit, index: ei, status: 'non-geometric, recorded only', reason: out.recorded });
      else applied.push({ edit, index: ei, status: 'geometric', ...out }); }
    catch (e) { refused.push({ edit, index: ei, reason: 'internal error: ' + (e && e.message || e) }); }
  });
  if (root.userData) root.userData.parteditLast = { manifest_id: manifest && manifest.id, n_applied: applied.length, n_refused: refused.length, n_recorded: recorded.length };
  return { applied, refused, recorded, scale: sc };
}

function measureSummary(items, mpu, frame) {
  const M = measureItems(items), out = { area_m2: toM(M.area, mpu, 2), volume_m3: M.closed ? toM(M.volume, mpu, 3) : null, closed: M.closed, bbox_m: mpu ? M.bbox.size.map(x => r6(x * mpu)) : null, area_units2: M.area, volume_units3: M.closed ? M.volume : null };
  if (frame) { const e = extents(allPoints(items), frame.anchor, frame.axes), Lu = frame.fromBase ? e.u.hi : e.u.ext; out.length_m = toM(Lu, mpu); out.width_m = toM(e.w.ext, mpu); out.thickness_m = toM(e.n.ext, mpu); out.length_units = Lu; out.width_units = e.w.ext; out.thickness_units = e.n.ext; if (frame.fromBase) out.length_axis_extent_m = toM(e.u.ext, mpu); }
  for (const k of Object.keys(out)) if (typeof out[k] === 'number') out[k] = r6(out[k]);
  return out;
}

function applyOne(ctx, edit, mpu) {
  if (!edit || typeof edit !== 'object') return { refused: 'edit is not an object' };
  const target = edit.target || {}, level = String(target.level || '').toLowerCase();
  if (level === 'cell') return { recorded: 'cell-level edits have no geometry at organism scale; the edit stays in the organism document but no vertex moves' };
  const r = resolveTarget(ctx.manifest, target);
  if (!r.kind) return { refused: r.reason || 'unknown target' };
  if (r.kind === 'cell') return { recorded: 'cell-level part; no geometry at organism scale' };
  let [param, modeSuffix] = String(edit.param || '').toLowerCase().split(':'); if (param === 'chord') param = 'width';
  const mode = (edit.mode ? String(edit.mode).toLowerCase() : modeSuffix) || null;
  if (r.kind === 'skin') return { refused: param === 'thickness' ? 'the skin is a zero-thickness shell in these models; thickness has no geometry here (record it at tissue or cell level)' : 'the skin is the body cavity every internal part is checked against; edit level "body" to reshape the organism' };
  const specs = paramsFor(r.kind), spec = specs.find(p => p.param === param);
  if (!spec) return { refused: `param "${edit.param}" is not editable on a ${r.kind.replace('_', ' ')} (editable: ${specs.map(p => p.param).join(', ') || 'none'})${r.kind === 'fin' && param === 'thickness' ? '; the fin membrane is a zero-thickness sheet (no solidify on a mesh with morph targets)' : ''}` };
  if (mode && !spec.modes) return { refused: `param ${param} takes no mode (got "${mode}")` };
  if (spec.modes && mode && !spec.modes.includes(mode)) return { refused: `mode "${mode}" is not one of ${spec.modes.join(', ')} for ${param}` };
  const lim = [spec.min, spec.max], present = r.parts.filter(n => ctx.index.has(n));
  if (!present.length) return { refused: `none of the target's objects (${r.parts.slice(0, 4).join(', ')}) is in the loaded scene` };
  if (r.kind === 'body') return editBody(ctx, edit, param, lim, mpu);
  if (r.kind === 'system') { // all-or-nothing fan-out over member parts
    const subs = present.map(n => planOrgan(ctx, n, ctx.g.kind(n), edit, param, lim, mpu));
    const bad = subs.filter(s => s.refused); if (bad.length) return { refused: `system edit refused: ${bad.length} of ${subs.length} members fail (${bad.slice(0, 3).map(b => b.part + ': ' + b.refused).join('; ')})`, detail: bad.map(b => ({ part: b.part, reason: b.refused, ...(b.detail || {}) })) };
    subs.forEach(s => s.commit()); return { kind: 'system', parts: subs.map(s => s.part), results: subs.map(s => ({ part: s.part, factors: s.factors, anchor: s.anchor, before: s.before, after: s.after() })) };
  }
  const plans = present.map(n => (r.kind === 'fin' || r.kind === 'fin_rays') ? planFin(ctx, n, r.kind, edit, param, mode || spec.default_mode || null, lim, mpu) : planOrgan(ctx, n, r.kind, edit, param, lim, mpu));
  const bad = plans.filter(p => p.refused);
  if (bad.length) return { refused: bad.map(b => (plans.length > 1 ? b.part + ': ' : '') + b.refused).join('; '), detail: plans.length > 1 ? bad.map(b => ({ part: b.part, reason: b.refused, ...(b.detail || {}) })) : bad[0].detail };
  plans.forEach(p => p.commit());
  const res = { kind: r.kind, parts: plans.map(p => p.part), results: plans.map(p => ({ part: p.part, moved: p.moved, anchor: p.anchor, factors: p.factors, before: p.before, after: p.after(), ...(p.warnings && p.warnings.length ? { warnings: p.warnings } : {}) })) };
  if (r.kind === 'fin' && present.length === 2 && /^pectoral_fin_/.test(present[0])) res.pair = pairMeasure(ctx, present, mpu);
  return res;
}

// tip-to-tip lateral span and both-fin area in build.py's convention (span = lateral extent; area = membrane, one side)
function pairMeasure(ctx, names, mpu) { const items = view(ctx, names), P = allPoints(items); let lo = Infinity, hi = -Infinity; for (let i = 2; i < P.length; i += 3) { if (P[i] < lo) lo = P[i]; if (P[i] > hi) hi = P[i]; } const M = measureItems(items);
  return { tip_to_tip_span_m: r6(toM(hi - lo, mpu)), area_both_m2: r6(toM(M.area, mpu, 2)), aspect_ratio: r6(Math.pow(hi - lo, 2) / M.area), span2_over_area_both: r6(Math.pow(hi - lo, 2) / M.area), convention: 'span = lateral (model Z) extent tip to tip; aspect_ratio = span^2 / area of BOTH fins (Park & Choi 2010 S^2/A1, verified against their Table 1 mean chord); same number build.py stores as pectoral_aspect_ratio' }; }

function planFin(ctx, name, kind, edit, param, mode, lim, mpu) {
  const finName = kind === 'fin_rays' ? ctx.g.parent.get(name) : name;
  const fr = finName && finFrame(ctx, finName); if (!fr) return { part: name, refused: 'could not locate the fin base (no fin vertices near the body cavity)' };
  const movedNames = (kind === 'fin' ? [name, ...(ctx.g.kids.get(name) || [])] : [name]).filter(n => ctx.index.has(n));
  const own = view(ctx, [name]), items = view(ctx, movedNames);
  const e0 = extents(allPoints(own), fr.anchor, fr.axes), M0 = measureItems(own);
  let cur, pow = 1; if (param === 'area') { cur = M0.area; pow = 2; } else if (param === 'width') cur = e0.w.ext; else cur = e0.u.hi;
  const f = factorFor(edit, cur, lim, mpu, pow); if (f.err) return { part: name, refused: f.err };
  const k = f.k; let su = 1, sw = 1;
  if (param === 'length') su = k;
  else if (param === 'width') sw = k;
  else if (param === 'span') { su = k; sw = mode === 'aspect' ? k : mode === 'chord' ? 1 : 1 / k; }
  else if (param === 'area') { if (mode === 'span') sw = k; else { su = Math.sqrt(k); sw = su; } }
  // the fin is a curved sheet, so a plane stretch does not scale its area exactly: when the param or mode fixes
  // the area (span:area keeps it, span:aspect wants A*s^2, area wants A*k), the free factor is solved on the mesh
  let areaTarget = null;
  if (param === 'span' && mode !== 'chord') areaTarget = mode === 'aspect' ? M0.area * k * k : M0.area;
  if (param === 'area') areaTarget = M0.area * k;
  if (areaTarget != null) {
    const areaWith = (a, b) => measureCand(own, linearCandidate(own, fr.anchor, stretch([fr.axes.u, fr.axes.w], [a, b]))).area;
    if (param === 'area' && mode !== 'span') { const s = secant(x => areaWith(x, x) / areaTarget - 1, su).x; su = s; sw = s; }
    else sw = secant(x => areaWith(su, x) / areaTarget - 1, sw).x;
    if (!(su > 0 && sw > 0)) return { part: name, refused: 'could not find stretch factors that give the requested area on this mesh' };
  }
  const L = stretch([fr.axes.u, fr.axes.w], [su, sw]);
  const before = measureSummary(own, mpu, fr);
  return { part: name, moved: movedNames, factor: k, factors: { requested: r6(k), span_axis: r6(su), chord_axis: r6(sw), mode: (param === 'span' || param === 'area') ? mode : null, area_target_m2: areaTarget != null ? r6(toM(areaTarget, mpu, 2)) : null, area_target_units2: areaTarget != null ? r6(areaTarget) : null },
    anchor: { method: (kind === 'fin_rays' ? `parent fin ${finName}: ` : '') + fr.method, point_units: fr.anchor.map(r6), point_m: mpu ? fr.anchor.map(x => r6(x * mpu)) : null, band_vertices: `${fr.band} of ${fr.of}`, axes: { span: fr.axes.u.map(r6), chord: fr.axes.w.map(r6), normal: fr.axes.n.map(r6) } },
    before, commit: () => commitLinear(items, fr.anchor, L), after: () => measureSummary(view(ctx, [name]), mpu, fr) };
}

function planOrgan(ctx, name, kind, edit, param, lim, mpu) {
  const items = view(ctx, [name]); if (!items.length) return { part: name, refused: 'not in the scene' };
  const M0 = measureItems(items), P = allPoints(items), pc = pca(P), anchor = M0.centroid;
  const axes = { u: pc.vecs[0], w: pc.vecs[1], n: pc.vecs[2] }, frame = { anchor, axes }, ex = extents(P, anchor, axes);
  const internal = kind === 'organ' || kind === 'skeletal' || kind === 'tissue';
  const cav = cavity(ctx), warnings = [];
  let make, commit, desc, k = null;
  if (param === 'thickness' && kind === 'tissue') {
    const t0 = M0.closed ? 2 * M0.volume / M0.area : null; let d;
    if (edit.op === 'add') { if (!mpu) return { part: name, refused: "op 'add' needs metres, but this model has no metres scale" }; const v = Number(edit.value); if (!isFinite(v)) return { part: name, refused: 'value is not a number' };
      d = v / mpu / 2; if (t0) { k = (t0 + 2 * d) / t0; if (!(k > 0) || k < lim[0] || k > lim[1]) return { part: name, refused: `the offset implies a thickness factor of ${r6(k)}, outside [${lim[0]}, ${lim[1]}]` }; } }
    else { if (!t0) return { part: name, refused: 'the tissue mesh is not closed, so its thickness (2V/S) cannot be measured; use op "add" with a metre offset' };
      const f = factorFor(edit, t0, lim, mpu, 1); if (f.err) return { part: name, refused: f.err }; k = f.k; d = (k - 1) * t0 / 2; }
    const N = vertexNormals(items);
    if (t0 && k != null) { // a solid is not a thin slab: solve d so that the measured 2V/S equals k*t0
      const th = dd => { const M = measureCand(items, offsetCandidate(items, N, dd)); return M.closed ? 2 * M.volume / M.area : NaN; };
      const sol = secant(dd => th(dd) / (k * t0) - 1, d); if (isFinite(sol.x) && Math.abs(sol.residual) < 1e-3) d = sol.x; }
    make = s => offsetCandidate(items, N, d * s); commit = s => commitOffset(items, N, d * s);
    desc = { requested: k != null ? r6(k) : null, normal_offset_m: r6(toM(d, mpu)), normal_offset_units: r6(d), thickness_target_m: t0 && k != null ? r6(toM(k * t0, mpu)) : null, method: 'every vertex moves d along its welded outward normal; d solved so the thickness estimate 2V/S reaches the target' };
  } else {
    let cur, pow = 1;
    if (param === 'volume') { if (M0.closed) { cur = M0.volume; pow = 3; } else if (edit.op !== 'scale') return { part: name, refused: 'the mesh is not closed, so its volume cannot be measured; use op "scale"' }; else cur = 1; }
    else cur = { length: ex.u.ext, width: ex.w.ext, thickness: ex.n.ext }[param];
    const f = factorFor(edit, cur, lim, mpu, pow); if (f.err) return { part: name, refused: f.err }; k = f.k;
    const axis = { length: axes.u, width: axes.w, thickness: axes.n }[param];
    const Ls = s => { const kk = 1 + (k - 1) * s; return param === 'volume' ? stretch([axes.u, axes.w, axes.n], [Math.cbrt(kk), Math.cbrt(kk), Math.cbrt(kk)]) : stretch([axis], [kk]); };
    make = s => linearCandidate(items, anchor, Ls(s)); commit = s => commitLinear(items, anchor, Ls(s));
    desc = { requested: r6(k), linear: param === 'volume' ? r6(Math.cbrt(k)) + ' on each principal axis' : r6(k) + ' on the ' + { length: 'longest', width: 'middle', thickness: 'shortest' }[param] + ' principal axis' };
  }
  if (internal || kind === 'surface_organ') {
    if (!cav) { if (internal && (k == null || k > 1)) return { part: name, refused: 'no body cavity (skin) in this model, so containment cannot be checked; growing an internal part is refused' }; }
    else {
      const c1 = containment(cav, items, make(1));
      if (!c1.ok) {
        if (internal) { let lo = 0, hi = 1; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (containment(cav, items, make(mid)).ok) lo = mid; else hi = mid; }
          const kfit = k != null ? 1 + (k - 1) * lo : null;
          return { part: name, refused: `would leave the body cavity: ${c1.outside} of ${c1.tested} sampled vertices now inside the skin would end up outside it; the largest change that fits is ${r6(lo * 100)} % of the request${kfit != null ? ` (factor ${r6(kfit)})` : ''}`, detail: { containment: c1, max_fraction_that_fits: r6(lo), max_factor_that_fits: kfit != null ? r6(kfit) : null } }; }
        warnings.push(`surface organ: ${c1.outside} of ${c1.tested} sampled vertices leave the skin (reported, not refused)`);
      }
      if (internal && param === 'volume' && cav.volume && M0.closed && M0.volume * k > cav.volume) return { part: name, refused: `new volume ${r6(toM(M0.volume * k, mpu, 3))} m3 would exceed the body cavity volume ${r6(toM(cav.volume, mpu, 3))} m3` };
      if (kind === 'organ') { // newly overlapping sibling bounding boxes: warning only
        const bb = arrs => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const A of arrs) for (let i = 0; i < A.length; i += 3) for (let j = 0; j < 3; j++) { if (A[i+j] < mn[j]) mn[j] = A[i+j]; if (A[i+j] > mx[j]) mx[j] = A[i+j]; } return { mn, mx }; };
        const hit = (a, b) => a.mn.every((v, j) => v <= b.mx[j] && a.mx[j] >= b.mn[j]);
        const b0 = bb(items.map(i => i.P)), b1 = bb(make(1));
        const newly = ctx.g.objs.filter(o => kindOf(o) === 'organ' && nameOf(o) !== name && ctx.index.has(nameOf(o))).map(nameOf).filter(s => { const b = bb(view(ctx, [s]).map(i => i.P)); return hit(b1, b) && !hit(b0, b); });
        if (newly.length) warnings.push('bounding box now overlaps ' + newly.join(', ') + ' (organ collision is reported, not enforced)'); }
    }
  }
  const before = measureSummary(items, mpu, frame);
  if (param === 'thickness' && kind === 'tissue') before.thickness_estimate_m = M0.closed ? r6(toM(2 * M0.volume / M0.area, mpu)) : null;
  return { part: name, moved: [name], factor: k, factors: desc, warnings,
    anchor: { method: M0.closed ? 'volume centroid of the closed mesh; axes = principal axes of the vertices' : 'area centroid of the open mesh; axes = principal axes of the vertices', point_units: anchor.map(r6), point_m: mpu ? anchor.map(x => r6(x * mpu)) : null, axes: { length: axes.u.map(r6), width: axes.w.map(r6), thickness: axes.n.map(r6) } },
    before, commit: () => commit(1),
    after: () => { const v = view(ctx, [name]), s = measureSummary(v, mpu, frame); if (param === 'thickness' && kind === 'tissue') { const M = measureItems(v); s.thickness_estimate_m = M.closed ? r6(toM(2 * M.volume / M.area, mpu)) : null; } return s; } };
}

function editBody(ctx, edit, param, lim, mpu) {
  const names = ctx.g.objs.map(nameOf).filter(n => ctx.index.has(n));
  const skin = view(ctx, ctx.g.skins), ref = skin.length ? skin : view(ctx, names);
  const M0 = measureItems(ref), anchor = M0.centroid, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const cur = { length: M0.bbox.size[0], depth: M0.bbox.size[1], width: M0.bbox.size[2], size: M0.bbox.size[0] }[param];
  const f = factorFor(edit, cur, lim, mpu, 1); if (f.err) return { refused: f.err };
  const k = f.k, L = param === 'size' ? stretch([X, Y, Z], [k, k, k]) : stretch([{ length: X, depth: Y, width: Z }[param]], [k]);
  const sum = items => { const M = measureItems(items); return { length_m: r6(toM(M.bbox.size[0], mpu)), depth_m: r6(toM(M.bbox.size[1], mpu)), width_m: r6(toM(M.bbox.size[2], mpu)), skin_area_m2: r6(toM(M.area, mpu, 2)), body_volume_m3: M.closed ? r6(toM(M.volume, mpu, 3)) : null, skin_closed: M.closed }; };
  const before = sum(ref); commitLinear(view(ctx, names), anchor, L); ctx.cav = null;
  return { kind: 'body', parts: ['body'], results: [{ part: 'body', moved: names, factors: { requested: r6(k), axis: param }, anchor: { method: 'area centroid of the skin; axes = model X (length), Y (depth), Z (width)', point_units: anchor.map(r6), point_m: mpu ? anchor.map(x => r6(x * mpu)) : null }, before, after: sum(skin.length ? view(ctx, ctx.g.skins) : view(ctx, names)) }] };
}

// ---------------------------------------------------------------- measurePart
export function measurePart(root, partId, manifest) {
  manifest = manifest || (root.userData && root.userData.parteditManifest) || { objects: [] };
  const ctx = { manifest, g: graph(manifest), index: meshIndex(root), cav: null };
  const t = typeof partId === 'object' && partId ? partId : { id: partId };
  let r = resolveTarget(manifest, t);
  if (!r.kind && ctx.index.has(String(t.id))) r = { kind: 'unlisted', parts: [String(t.id)] }; // a mesh the manifest does not list
  if (!r.parts.length) return { part: t.id, error: r.reason || 'unknown part' };
  const names = r.parts.filter(n => ctx.index.has(n)), items = view(ctx, names); if (!items.length) return { part: t.id, error: 'not in the scene' };
  const sc = metresPerUnit(manifest), mpu = sc.m_per_unit, M = measureItems(items);
  const out = { part: t.id, kind: r.kind, objects: names, units: { m_per_unit: mpu, source: sc.source || sc.reason },
    bbox: { min_units: M.bbox.min.map(r6), max_units: M.bbox.max.map(r6), size_units: M.bbox.size.map(r6), size_m: mpu ? M.bbox.size.map(x => r6(x * mpu)) : null },
    surface_area_units2: r6(M.area), surface_area_m2: r6(toM(M.area, mpu, 2)), closed: M.closed, open_edges: M.open_edges,
    volume_units3: M.closed ? r6(M.volume) : null, volume_m3: M.closed ? r6(toM(M.volume, mpu, 3)) : null,
    volume_note: M.closed ? 'closed mesh: divergence-theorem volume' : `open surface (${M.open_edges} boundary edges after welding): no volume` };
  if (r.kind === 'fin' || r.kind === 'fin_rays') {
    out.fins = names.map(n => { const fr = finFrame(ctx, r.kind === 'fin_rays' ? ctx.g.parent.get(n) : n); if (!fr) return { part: n, error: 'no fin base found' }; const s = measureSummary(view(ctx, [n]), mpu, fr); return { part: n, base_units: fr.anchor.map(r6), base_method: fr.method, length_m: s.length_m, width_m: s.width_m, area_m2: s.area_m2 }; });
    if (names.length === 2 && /^pectoral_fin_/.test(names[0])) out.pair = pairMeasure(ctx, names, mpu); }
  return out;
}

// ---------------------------------------------------------------- bodyCavity: the containment test on its own
// returns {inside(x, y, z) -> bool in root model units, volume_units3, closed} or null when the model has no skin
export function bodyCavity(root, manifest) {
  const ctx = { manifest, g: graph(manifest), index: meshIndex(root), cav: null }, c = cavity(ctx);
  return c ? { inside: c.inside, volume_units3: c.volume, closed: c.closed, bbox: c.bbox } : null;
}
