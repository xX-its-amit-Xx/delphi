// .life -> binary STL. One stage's cell geometry, as triangles, with its provenance stamped into the
// only place a stamp survives.
//
// ============================== WHAT THIS FILE IS FOR ==============================
// organism-format/spec.mjs opens by praising the .stl for what it refuses to carry: it holds triangles,
// and anyone holding one knows exactly how much it is promising. That is true, and it is also the problem
// the moment the triangles come out of a file that DID know more. A .life stage knows whether its cell
// centres came from a confocal stack or from somebody sketching a morula. An STL cannot know that, cannot
// be told it in any field, and will be opened next week by a program that never saw the .life.
//
// So this exporter does the two things that follow from that:
//
//   1. it REFUSES to export geometry whose provenance is `assumed` or `depicted`, unless the caller says
//      in as many words that it wants a depiction (spec.mjs REFUSALS.no_unstamped_mesh), and
//   2. when it does export one, it writes the provenance into the 80-byte header AND into the suggested
//      filename, because those are the two bytes of metadata an STL has and a filename is the one a human
//      actually reads.
//
// ============================== THE SPHERE IS A DEPICTION. ALWAYS. ==============================
// This needs saying plainly, because it is the dishonest part of every mesh built this way and it does not
// go away when the input is good.
//
// A cell here is drawn as a SPHERE at its measured centre with its measured radius. Both of those numbers
// can be measurements of the highest quality and the resulting surface is still a drawing, because real
// blastomeres are not spheres. They are flattened against their neighbours, they have contact faces with
// a curvature set by the adhesion-to-cortical-tension balance, and in a compacted morula the flat parts
// are most of the cell. The sphere is the equal-volume stand-in for a shape nobody put in the file.
//
// That matters more than it sounds, because it destroys exactly the quantity .life's geometry channel
// exists to carry. spec.mjs CHANNELS.geometry.why_exposed_area says exposed surface area - the part of a
// cell facing outward rather than a neighbour - is the geometric quantity lineage bias tracks. A soup of
// interpenetrating spheres has no contact faces, so its exposed area is wrong for every cell, and it is
// wrong in the direction that makes inner cells look like outer ones. If a cell carries a measured
// `surface_area` or `exposed_surface_area`, the mesh DISAGREES with it, and exportStage says so rather
// than letting the reader assume the mesh is where the measurement went.
//
// Hence: provenance of the NUMBERS gates the export; `shape_model` on the result records that the SHAPE is
// a depiction regardless. Those are two different claims and collapsing them would be the easy lie here.

export const STL_FORMAT = 'life-stl/0.1.0';
export const FORMAT = 'life/0.1.0';

/** Provenance kinds that may not leave as a mesh without the caller asking for a depiction.
 *  Kept as data rather than an `||` in a branch so a reader can see the whole gate at once. */
export const GATED_KINDS = Object.freeze(['assumed', 'depicted']);

/** Marker spliced into the filename of a gated export. Loud, and survives being emailed. */
export const DEPICTION_MARKER = 'DEPICTION';

/**
 * What is gone the moment these bytes are written. Not a disclaimer - a list of the specific questions a
 * downstream reader will ask of the mesh and must not ask of it.
 */
export const WHAT_AN_STL_LOSES = Object.freeze({
  no_units:
    'an STL has no unit field. These coordinates are bare numbers in whatever unit the stage used (.life ' +
    'uses um). A slicer will read them as millimetres and be wrong by a thousand without complaining.',
  no_colour:
    'no per-facet colour in the standard format, so nothing carries the channel a figure would colour by ' +
    '(modulus, fate, exposed area). The mesh is the shape and only the shape.',
  no_provenance:
    'no field for where a number came from. The 80-byte header and the filename are the whole budget, ' +
    'which is why this exporter spends both of them on provenance.',
  no_cell_identity:
    'triangles are not grouped. Cell ids, parents and fate labels do not survive, so a mesh cannot be ' +
    'joined back to the .life it came from except by re-exporting it.',
  no_topology:
    'no edges, no shared vertices, no adjacency - every triangle repeats its three vertices independently. ' +
    'Which cell touches which, the thing a multicellularity claim is about, is not in the file.',
  no_measured_channels:
    'transcriptome and mechanics cannot be represented at all. There is no field they could go in.',
  so_what_a_mesh_is:
    'a picture of ONE channel (geometry) of ONE stage, with that channel\'s shape idealised to spheres. ' +
    'It is not the organism, not the stage, and not evidence for either.',
});

// ---------------------------------------------------------------------------------------------------
// GEOMETRY
// ---------------------------------------------------------------------------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;

/** The real icosahedron: 12 vertices at the cyclic permutations of (0, +-1, +-phi), 20 faces, wound
 *  counter-clockwise seen from outside so the cross-product normal points outward. */
function icosahedron() {
  const vertices = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ].map(normalise);
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { vertices, faces };
}

function normalise([x, y, z]) {
  const n = Math.hypot(x, y, z);
  if (!(n > 0)) throw new Error('stl: cannot normalise a zero-length vector');
  return [x / n, y / n, z / n];
}

/**
 * A unit icosphere: an icosahedron with every triangle split four ways `subdivisions` times, each new
 * vertex pushed back out onto the unit sphere.
 *
 * Face count is exactly 20 * 4**subdivisions, which is the useful property - the caller can price the
 * export before running it. Vertex count is NOT 3x the face count because midpoints are shared between
 * the two triangles on each edge; sharing them is what keeps the surface watertight at this stage, even
 * though writeBinarySTL then throws the sharing away (see WHAT_AN_STL_LOSES.no_topology).
 *
 * @param {number} subdivisions integer >= 0
 * @returns {{vertices: number[][], faces: number[][]}}
 */
export function icosphere(subdivisions = 0) {
  if (!Number.isInteger(subdivisions) || subdivisions < 0) {
    throw new TypeError(`stl: subdivisions must be an integer >= 0, got ${subdivisions}`);
  }
  let { vertices, faces } = icosahedron();
  for (let s = 0; s < subdivisions; s++) {
    const midpoints = new Map();
    const midpoint = (i, j) => {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      const hit = midpoints.get(key);
      if (hit !== undefined) return hit;
      const a = vertices[i], b = vertices[j];
      vertices.push(normalise([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]));
      const idx = vertices.length - 1;
      midpoints.set(key, idx);
      return idx;
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      // winding of each child matches the parent, so outward stays outward
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return { vertices, faces };
}

/** Outward facet normal from the vertex winding, by cross product, normalised.
 *  Returns [0,0,0] for a degenerate triangle rather than NaNs - a zero normal is what the STL spec says
 *  to write when a normal cannot be computed, and NaNs would silently poison every reader downstream. */
export function facetNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(n[0], n[1], n[2]);
  if (!(len > 0)) return [0, 0, 0];
  return [n[0] / len, n[1] / len, n[2] / len];
}

/**
 * One tessellated sphere per cell, at the cell's centre, scaled by its radius.
 *
 * Cells with a missing or non-positive radius are SKIPPED AND REPORTED, never drawn at some default size.
 * A cell drawn at a made-up radius is indistinguishable in the output from a measured one, which is the
 * single failure mode this whole directory is arranged against.
 *
 * The spheres interpenetrate where cells touch. That is left alone deliberately: a boolean union would
 * produce a smooth blob that looks MORE like an embryo while being further from the data, and the contact
 * faces it invented would be the exact quantity CHANNELS.geometry says lineage bias tracks.
 *
 * @returns {{triangles: number[][][], skipped: object[], cells_drawn: number, units: string|null,
 *            disagrees_with_measured_area: string[]}}
 */
export function stageToTriangles(stage, { subdivisions = 2 } = {}) {
  const geom = stage?.geometry ?? null;
  const cells = Array.isArray(geom?.cells) ? geom.cells : [];
  const unit = icosphere(subdivisions);
  const triangles = [];
  const skipped = [];
  const disagrees = [];
  let drawn = 0;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const id = cell?.id ?? `#${i}`;
    const g = cell?.channels?.geometry ?? null;
    const centre = g?.centre;
    const radius = g?.radius;

    if (!g) { skipped.push({ id, why: 'no geometry channel on this cell' }); continue; }
    if (!Array.isArray(centre) || centre.length !== 3 || !centre.every(Number.isFinite)) {
      skipped.push({ id, why: `centre is not three finite numbers (${JSON.stringify(centre)})` });
      continue;
    }
    if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
      skipped.push({ id, why: `radius is missing or not positive (${JSON.stringify(radius)})` });
      continue;
    }

    // If the cell carries a measured area, the sphere contradicts it. Say which cells, not just that it
    // happens, so a reader can check the worst ones.
    if (Number.isFinite(g.surface_area) || Number.isFinite(g.exposed_surface_area)) disagrees.push(id);

    for (const [ia, ib, ic] of unit.faces) {
      triangles.push([
        place(unit.vertices[ia], centre, radius),
        place(unit.vertices[ib], centre, radius),
        place(unit.vertices[ic], centre, radius),
      ]);
    }
    drawn++;
  }

  return {
    triangles,
    skipped,
    cells_drawn: drawn,
    cells_total: cells.length,
    units: geom?.units ?? null,
    disagrees_with_measured_area: disagrees,
  };
}

function place(v, centre, radius) {
  return [centre[0] + v[0] * radius, centre[1] + v[1] * radius, centre[2] + v[2] * radius];
}

// ---------------------------------------------------------------------------------------------------
// THE BYTES
// ---------------------------------------------------------------------------------------------------

/**
 * The 80-byte header, as ASCII, zero-padded and truncated so it is exactly 80 bytes whatever it is given.
 *
 * Two traps worth naming. Non-ASCII would take more than one byte per character and silently push the
 * useful part off the end, so anything outside printable ASCII becomes a space. And a header beginning
 * with the five letters `solid` makes some readers sniff the file as ASCII STL and fail to parse it, so
 * every header this file writes starts with STL_FORMAT instead.
 */
export function stlHeader80(text) {
  const out = new Uint8Array(80); // zero-filled: valid padding per the de-facto spec
  const clean = String(text ?? '').replace(/[^\x20-\x7e]/g, ' ').slice(0, 80);
  for (let i = 0; i < clean.length; i++) out[i] = clean.charCodeAt(i) & 0x7f;
  return out;
}

/**
 * Real binary STL. Exactly 84 + 50*n bytes:
 *
 *   [0, 80)    header, free-form bytes, no structure, read by nobody but stamped by us
 *   [80, 84)   uint32 LE triangle count
 *   then n * { 12 float32 LE: normal xyz, v1 xyz, v2 xyz, v3 xyz ; uint16 LE attribute byte count = 0 }
 *
 * Little-endian throughout, which is the format rather than a choice. The attribute byte count is where
 * some tools smuggle colour; this writer puts a hard zero there, because a colour nobody can interpret
 * without knowing which vendor's convention it follows is worse than no colour.
 *
 * @param {number[][][]} triangles  each [[x,y,z],[x,y,z],[x,y,z]]
 * @returns {Buffer|Uint8Array}
 */
export function writeBinarySTL(triangles, { header = `${STL_FORMAT} unstamped` } = {}) {
  if (!Array.isArray(triangles)) throw new TypeError('stl: triangles must be an array');
  const n = triangles.length;
  const bytes = 84 + 50 * n;
  const buf = typeof Buffer !== 'undefined' ? Buffer.alloc(bytes) : new Uint8Array(bytes);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const head = stlHeader80(header);
  for (let i = 0; i < 80; i++) buf[i] = head[i];
  view.setUint32(80, n, true);

  let off = 84;
  for (let t = 0; t < n; t++) {
    const tri = triangles[t];
    if (!Array.isArray(tri) || tri.length !== 3) throw new TypeError(`stl: triangle ${t} is not 3 vertices`);
    const [a, b, c] = tri;
    const nrm = facetNormal(a, b, c);
    for (const comp of nrm) { view.setFloat32(off, comp, true); off += 4; }
    for (const v of [a, b, c]) {
      if (!Array.isArray(v) || v.length !== 3) throw new TypeError(`stl: triangle ${t} has a bad vertex`);
      for (const comp of v) { view.setFloat32(off, comp, true); off += 4; }
    }
    view.setUint16(off, 0, true); off += 2; // attribute byte count
  }
  if (off !== bytes) throw new Error(`stl: wrote ${off} bytes, expected ${bytes}`); // can't happen; says so if it does
  return buf;
}

// ---------------------------------------------------------------------------------------------------
// THE GATE
// ---------------------------------------------------------------------------------------------------

/**
 * Export one stage, or refuse to.
 *
 * This is the entry point everything else should go through, because it is the only one that applies
 * spec.mjs REFUSALS.no_unstamped_mesh:
 *
 *   geometry.provenance.kind in GATED_KINDS  ->  { refused: <reason>, stl: null }
 *   ...unless allowDepicted: true            ->  exported, with DEPICTION in the filename and the
 *                                                provenance kind in the 80-byte header.
 *
 * `allowDepicted` is a flag and not a config default on purpose. The caller has to type it at the call
 * site, next to the thing it is about, where a reviewer reading the diff will see it.
 *
 * The result always carries `shape_model`, whatever the provenance was, because the sphere is a depiction
 * of shape even when the centre and radius are measured. See the header comment of this file.
 *
 * @returns {{refused: string|null, stl: Buffer|Uint8Array|null, ...}}
 */
export function exportStage(stage, { subdivisions = 2, allowDepicted = false } = {}) {
  const base = {
    format: STL_FORMAT,
    stage_id: stage?.id ?? null,
    refused: null,
    stl: null,
    suggested_filename: null,
    header_text: null,
    triangle_count: 0,
    byte_length: 0,
    shape_model: SHAPE_MODEL,
    what_an_stl_loses: WHAT_AN_STL_LOSES,
  };

  const geom = stage?.geometry ?? null;
  if (!geom) {
    return { ...base, refused: 'no geometry on this stage: there is nothing to export. An empty mesh would read as an empty embryo.' };
  }
  const kind = geom?.provenance?.kind ?? null;
  if (!kind) {
    return {
      ...base,
      refused: 'geometry has no provenance.kind, so the mesh could not be stamped. ' +
        'spec.mjs WHY_EACH_RULE.provenance_on_geometry: a mesh loses its provenance the moment it leaves the file.',
    };
  }

  const gated = GATED_KINDS.includes(kind);
  if (gated && !allowDepicted) {
    return {
      ...base,
      provenance: geom.provenance,
      refused:
        `geometry provenance is "${kind}", which is not a measurement, and an STL has no field that could ` +
        `say so to the next reader. Pass { allowDepicted: true } to export it anyway; the file will be ` +
        `named *.${DEPICTION_MARKER}.stl and its header will say "${kind}". ` +
        `(spec.mjs REFUSALS.no_unstamped_mesh)`,
    };
  }

  const tess = stageToTriangles(stage, { subdivisions });
  if (tess.triangles.length === 0) {
    return {
      ...base,
      provenance: geom.provenance,
      skipped: tess.skipped,
      refused:
        `no cell had a usable centre and a positive radius, so the mesh would be empty - which a reader ` +
        `cannot tell from an embryo with no cells. ${tess.skipped.length} cell(s) skipped: ` +
        tess.skipped.map(s => `${s.id} (${s.why})`).join('; '),
    };
  }

  const id = String(stage?.id ?? 'unknown-stage');
  const header_text = `${STL_FORMAT} stage=${id} provenance=${kind}` +
    (tess.units ? ` units=${tess.units}` : ' units=UNSTATED') +
    (gated ? ` ${DEPICTION_MARKER}` : '');
  const stl = writeBinarySTL(tess.triangles, { header: header_text });

  // A stage id is author-supplied text, and this filename is a suggestion a caller will plausibly hand
  // straight to fs.writeFileSync. Dropping the path separators is not enough: keeping `.` for the sake of
  // ids like "morula-E2.5" leaves `..` intact, and `../../etc/passwd` sanitises to `..-..-etc-passwd`,
  // which still traverses. So collapse dot runs and strip leading dots and dashes as well. (The test
  // caught this; the first version of this line shipped the traversal.)
  const safeId = id
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\-]+/, '')
    .slice(0, 120) || 'unknown-stage';
  const suggested_filename = gated ? `${safeId}.${DEPICTION_MARKER}.stl` : `${safeId}.stl`;

  return {
    ...base,
    stl,
    provenance: geom.provenance,
    provenance_kind: kind,
    gated,
    suggested_filename,
    header_text,
    header_truncated: header_text.length > 80,
    triangle_count: tess.triangles.length,
    byte_length: stl.byteLength ?? stl.length,
    cells_drawn: tess.cells_drawn,
    cells_total: tess.cells_total,
    skipped: tess.skipped,
    units: tess.units,
    units_lost:
      `coordinates are in ${tess.units ?? 'an unstated unit'} and the STL does not record that. ` +
      `Whoever opens it will guess, and most tools guess millimetres.`,
    subdivisions,
    triangles_per_cell: 20 * 4 ** subdivisions,
    contradicts_measured_area: tess.disagrees_with_measured_area.length > 0
      ? `the sphere model overrides measured area on ${tess.disagrees_with_measured_area.length} cell(s): ` +
        `${tess.disagrees_with_measured_area.join(', ')}. The mesh is not where those measurements went; ` +
        `read them from the .life, not off this surface.`
      : null,
  };
}

/** Recorded on every result, refusal or not. The shape is a depiction even when the numbers are not. */
export const SHAPE_MODEL = Object.freeze({
  model: 'one sphere per cell, centred on the cell centre, radius = the cell radius',
  kind: 'depicted',
  why_depicted:
    'real blastomeres are not spheres. They are flattened against their neighbours, with contact faces ' +
    'whose curvature is set by the adhesion-to-cortical-tension balance, and in a compacted morula those ' +
    'flat faces are most of the cell surface. An equal-volume sphere is a stand-in for a shape that is ' +
    'not in the file, so the SHAPE of this mesh is `depicted` even when the centre and the radius are ' +
    '`measured`.',
  what_it_breaks:
    'exposed surface area, which CHANNELS.geometry calls the geometric quantity lineage bias tracks. ' +
    'Spheres interpenetrate instead of making contact faces, so every cell\'s exposed area is too large ' +
    'and inner cells are made to look like outer ones.',
  what_would_fix_it:
    'segmented cell surfaces from the imaging volume, or a stated mechanical model (Surface Evolver / ' +
    'cell-cortex energy minimisation) exported as a `derived` mesh with its rule named.',
});
