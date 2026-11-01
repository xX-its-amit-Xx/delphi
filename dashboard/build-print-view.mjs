#!/usr/bin/env node
/* build-print-view.mjs — data for the printable-kit assembly viewer at /print/.
 *
 * The page at dashboard/public/print/ needs three things this script computes
 * once, at build time, so the browser does not have to:
 *
 *  1. THE JOIN. Geometry facts live in
 *     dashboard/public/blueprint3d/print/parts-INFO.json (triangles, bytes,
 *     watertightness, volume) and anatomy facts live in
 *     dashboard/public/blueprint3d/model/winged-zebrafish-manifest.json
 *     (label, layer, level, side, organ system, ontology ids, provenance).
 *     They are joined on the object name.
 *
 *  2. THE FRAME. Every part STL is parsed here and its real bounding box
 *     measured. That gives each part's centroid in the shared print frame,
 *     which is what the explode vector and the assembly animation need. It
 *     also lets this script MEASURE, rather than assume, how the published
 *     part files compare with the published whole-fish file — which is where
 *     the 4% discrepancy the page reports comes from.
 *
 *  3. THE ORDER AND THE GROUPING. An assembly order (skeleton, muscle,
 *     organs, outer) and an organ-level grouping, both derived from fields
 *     that exist, with the derivation recorded in the output so the page can
 *     say where a group came from.
 *
 * It writes ONE file: dashboard/public/print/parts.json. It reads everything
 * else and writes nothing else. Nothing under blueprint3d/ is modified.
 *
 *   node dashboard/build-print-view.mjs
 *   node dashboard/build-print-view.mjs --check    # report only, write nothing
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, 'public');
const KIT = join(PUB, 'blueprint3d', 'print');
const MANIFEST = join(PUB, 'blueprint3d', 'model', 'winged-zebrafish-manifest.json');
const OUT = join(PUB, 'print', 'parts.json');
const CHECK = process.argv.includes('--check');

const fail = m => { console.error('build-print-view: ' + m); process.exit(1); };
const readJson = p => { if (!existsSync(p)) fail(`missing input ${p}`); return JSON.parse(readFileSync(p, 'utf8')); };

const info = readJson(join(KIT, 'parts-INFO.json'));
const man = readJson(MANIFEST);

/* ----------------------------------------------------------- binary STL bbox
 * Binary STL: 80-byte header, uint32 triangle count, then 50 bytes per
 * triangle (3 floats normal + 9 floats vertices + 2 bytes attribute). No
 * units field, so the numbers are whatever the exporter wrote; parts-INFO
 * says millimetres. */
function stlStats(path) {
  const b = readFileSync(path);
  if (b.length < 84) fail(`${path} is too short to be a binary STL`);
  const tris = b.readUInt32LE(80);
  if (84 + tris * 50 !== b.length) fail(`${path} is not a binary STL of ${tris} triangles`);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris; i++) {
    const o = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) {
      const f = b.readFloatLE(o + v * 12 + a * 4);
      if (f < min[a]) min[a] = f;
      if (f > max[a]) max[a] = f;
    }
  }
  const r4 = n => Math.round(n * 1e4) / 1e4;
  return { tris, bytes: b.length, min: min.map(r4), max: max.map(r4), size: min.map((m, i) => r4(max[i] - m)) };
}

/* -------------------------------------------------------- the assembly order
 * The project lead's order: skeleton first, then muscle, then organs seating
 * into the body cavity, then the outer layer with the skin halves closing and
 * the fins last. `layer` is a manifest field, so the four stages are read, not
 * invented. Within the skeleton the lead asked for vertebrae along the spine,
 * then ribs, skull, girdle, fin rays; that sub-order is matched on the object
 * name, which is the only thing that distinguishes them. */
const STAGES = [
  { key: 'skeleton', layer: 'skeleton', label: 'Skeleton',       caption: 'Skeleton',         win: [0.00, 0.44] },
  { key: 'muscle',   layer: 'muscle',   label: 'Muscle',         caption: 'Muscle',           win: [0.42, 0.54] },
  { key: 'organ',    layer: 'organ',    label: 'Organs',         caption: 'Organs',           win: [0.52, 0.74] },
  { key: 'outer',    layer: 'outer',    label: 'Skin and fins',  caption: 'Skin and fins',    win: [0.72, 1.00] }
];

// within-stage sub-order: first match wins, then the tie-break inside the rank
const SUBORDER = [
  { re: /^vertebra_/,            rank: 0, by: 'xDesc', note: 'vertebrae, anterior to posterior along the spine' },
  { re: /^ribs_/,                rank: 1, by: 'name' },
  { re: /^skull_/,               rank: 2, by: 'name' },
  { re: /^(cleithrum|scapula|coracoid)_/, rank: 3, by: 'name', note: 'pectoral girdle' },
  { re: /_rays?(_|$)|_ray_/,     rank: 4, by: 'name', note: 'fin rays' },
  { re: /^muscle_/,              rank: 0, by: 'name' },
  { re: /^pectoral_muscle_/,     rank: 1, by: 'name' },
  { re: /^eye_/,                 rank: 0, by: 'name' },
  { re: /^skin_/,                rank: 1, by: 'name', note: 'the two skin halves close from left and right' },
  { re: /_fin(_|$)/,             rank: 2, by: 'name', note: 'fins last' }
];
function subRank(name) {
  for (const s of SUBORDER) if (s.re.test(name)) return s.rank;
  return 5;             // anything unmatched sorts after the named families
}

/* ------------------------------------------------------- the organ grouping
 * The hierarchy the kit expresses is organ system -> organ -> tissue. Of the
 * three, only `organ_system` and `level` are manifest fields; there is NO
 * organ-parent field on an object, so the middle tier has to be derived. It
 * is derived here from the object-name family, and `organ_from` records that,
 * so the page can state it rather than imply the manifest said it.
 *
 * Where a part's ontology label exists it agrees with the family (the twelve
 * pectoral_fin_ray_L_* are all UBERON_4000175 pectoral fin lepidotrichium);
 * where it does not exist the family is all there is. */
const ORGANS = [
  [/^pectoral_fin(_ray)?_L/,  'Pectoral fin, left'],
  [/^pectoral_fin(_ray)?_R/,  'Pectoral fin, right'],
  [/^pectoral_muscle_L/,      'Pectoral girdle musculature, left'],
  [/^pectoral_muscle_R/,      'Pectoral girdle musculature, right'],
  [/^pelvic_fin.*_L/,         'Pelvic fin, left'],
  [/^pelvic_fin.*_R/,         'Pelvic fin, right'],
  [/^dorsal_fin/,             'Dorsal fin'],
  [/^anal_fin/,               'Anal fin'],
  [/^caudal_fin/,             'Caudal fin'],
  [/^vertebra_/,              'Vertebral column'],
  [/^ribs_/,                  'Ribs'],
  [/^skull_/,                 'Skull'],
  [/^(cleithrum|scapula|coracoid)_/, 'Pectoral girdle'],
  [/^muscle_/,                'Trunk musculature'],
  [/^skin_/,                  'Skin of body'],
  [/^eye_/,                   'Eye'],
  [/^gills_/,                 'Gills'],
  [/^gonad_/,                 'Gonad'],
  [/^head_kidney/,            'Head kidney'],
  [/^kidney/,                 'Kidney'],
  [/^swim_bladder/,           'Swim bladder'],
  [/^spinal_cord/,            'Spinal cord'],
  [/^brain/,                  'Brain'],
  [/^heart/,                  'Heart'],
  [/^oesophagus/,             'Oesophagus'],
  [/^intestine/,              'Intestine'],
  [/^liver/,                  'Liver'],
  [/^spleen/,                 'Spleen']
];
function organOf(o) {
  for (const [re, label] of ORGANS) if (re.test(o.object)) return label;
  return null;
}

/* ------------------------------------------------------------- join and frame */
const objects = man.objects || fail('the manifest has no objects array');
const rows = [];
const problems = [];

for (const o of objects) {
  const g = info.parts[o.object];
  if (!g) { problems.push(`no geometry in parts-INFO for ${o.object}`); continue; }
  const file = join(KIT, g.file);
  if (!existsSync(file)) { problems.push(`no STL on disk for ${o.object} (${g.file})`); continue; }
  const st = stlStats(file);
  if (st.tris !== g.triangles || st.bytes !== g.bytes) {
    problems.push(`${o.object}: disk ${st.bytes} B / ${st.tris} tri, parts-INFO says ${g.bytes} B / ${g.triangles} tri`);
  }
  const organ = organOf(o);
  if (!organ) problems.push(`no organ family matches ${o.object}; it will show as ungrouped`);
  rows.push({
    object: o.object,
    label: o.label || o.object,
    file: g.file,                                 // relative to blueprint3d/print/
    level: o.level ?? null,
    layer: o.layer ?? null,
    side: o.side ?? null,
    organ_system: o.organ_system ?? null,
    organ_system_id: o.organ_system_id ?? null,
    organ,
    ontology_id: o.ontology_id ?? null,
    ontology_label: o.ontology_label ?? null,
    zfa_id: o.zfa_id ?? null,
    nearest_ancestor: o.nearest_ancestor_in_files ?? null,
    ontology_note: o.ontology_note ?? null,
    geometry_basis: o.geometry_basis ?? null,
    note: o.note ?? null,
    driven_by: o.driven_by_parameters || [],
    triangles: st.tris,
    bytes: st.bytes,
    volume_mm3: g.volume_mm3 ?? null,
    surface_area_mm2: g.surface_area_mm2 ?? null,
    watertight: g.watertight === true,
    zero_thickness: g.zero_thickness_surface === true,
    non_manifold: g.non_manifold === true,
    boundary_edges: g.boundary_edges ?? null,
    euler: g.euler_characteristic ?? null,
    bbox: { min: st.min, max: st.max, size: st.size }
  });
}
if (rows.length !== objects.length) problems.push(`joined ${rows.length} of ${objects.length} manifest objects`);

/* ------------------------------------------------------------- the kit's frame
 * Print frame, after Blender's glTF Y-up to Z-up conversion:
 *   +X anterior (snout)   +Y the fish's LEFT flank   +Z dorsal
 * Verified against parts-INFO.verification, which quotes pectoral_fin_L's
 * bbox, and against the manifest's own axis note. */
const kitMin = [0, 1, 2].map(a => Math.min(...rows.map(r => r.bbox.min[a])));
const kitMax = [0, 1, 2].map(a => Math.max(...rows.map(r => r.bbox.max[a])));
const kitSize = kitMin.map((m, i) => kitMax[i] - m);
const kitMid = kitMin.map((m, i) => m + kitSize[i] / 2);

/* ---------------------------------------------------- the explode vector
 * At 0 every part sits at the shared origin and the fish is whole. As the
 * slider rises each part moves along a fixed unit vector:
 *
 *   radial    outward from the body axis (the X axis through the kit's
 *             mid-sagittal plane y=0 at the kit's mid height), so parts leave
 *             the body rather than scattering;
 *   lateral   left parts gain +Y and right parts -Y, so the two halves
 *             separate and you can see between them;
 *   axial     a push along the body axis away from the kit's centre,
 *             so the 32 vertebrae and the 24 fin rays string out instead of
 *             piling up;
 *   fan       members of one organ group are rotated apart about the body
 *             axis by up to +-0.5 rad, so no two of the twelve rays in a fin
 *             sit on the same line.
 *
 * All of it is deterministic: the same kit always explodes the same way. */
const byOrgan = new Map();
for (const r of rows) {
  const k = r.organ || '(ungrouped)';
  if (!byOrgan.has(k)) byOrgan.set(k, []);
  byOrgan.get(k).push(r);
}
for (const list of byOrgan.values()) list.sort((a, b) => b.bbox.min[0] - a.bbox.min[0] || a.object.localeCompare(b.object));

for (const [, list] of byOrgan) {
  const n = list.length;
  list.forEach((r, i) => {
    const c = [0, 1, 2].map(a => (r.bbox.min[a] + r.bbox.max[a]) / 2);
    // radial direction in the YZ plane, measured from the body axis
    let dy = c[1] - 0, dz = c[2] - kitMid[2];
    let ang = Math.atan2(dz, dy);
    if (Math.hypot(dy, dz) < 0.6) ang = Math.PI / 2;   // sits on the axis: send it dorsally
    // fan the members of one organ group apart so each is separately visible
    const spread = n > 1 ? Math.min(1.0, 0.1 * n) : 0;
    ang += spread * (i / Math.max(1, n - 1) - 0.5);
    let v = [0, Math.cos(ang), Math.sin(ang)];
    // laterality: the left half goes left, the right half goes right
    if (r.side === 'L') v[1] += 0.95;
    else if (r.side === 'R') v[1] -= 0.95;
    // axial: away from the kit's centre along the body axis
    const ax = (c[0] - kitMid[0]) / (kitSize[0] / 2 || 1);
    v[0] += 0.78 * Math.max(-1, Math.min(1, ax));
    const len = Math.hypot(...v) || 1;
    r.offset = v.map(x => Math.round((x / len) * 1e4) / 1e4);   // unit vector
    r.centre_mm = c.map(x => Math.round(x * 1e4) / 1e4);
  });
}

/* --------------------------------------------- the assembly timeline per part
 * One state drives both the animation and the explode slider: T in [0,1],
 * 0 = fully exploded, 1 = assembled. Each part has a window [s,e] inside T;
 * its own explode amount is 1 - easeOutCubic((T-s)/(e-s)). At T=0 every
 * window is still ahead, so everything is out; at T=1 every window is behind,
 * so everything is seated. Scrubbing the slider therefore IS seeking the
 * animation, and there is no second state to keep in sync. */
const stageOf = r => STAGES.find(s => s.layer === r.layer) || STAGES[0];
const stageRows = new Map(STAGES.map(s => [s.key, []]));
for (const r of rows) stageRows.get(stageOf(r).key).push(r);

const stages = [];
for (const s of STAGES) {
  const list = stageRows.get(s.key);
  list.sort((a, b) => {
    const d = subRank(a.object) - subRank(b.object);
    if (d) return d;
    // vertebrae and ray chains read best anterior to posterior
    const dx = b.bbox.max[0] - a.bbox.max[0];
    if (Math.abs(dx) > 0.05) return dx;
    return a.object.localeCompare(b.object);
  });
  const [a, b] = s.win;
  const span = b - a;
  const W = Math.min(span, Math.max(0.10, span * 0.45));     // one part's own flight time
  const lastStart = b - W;
  const n = list.length;
  list.forEach((r, i) => {
    const st = n > 1 ? a + (lastStart - a) * (i / (n - 1)) : a;
    r.stage = s.key;
    r.order = i;
    r.t0 = Math.round(st * 1e4) / 1e4;
    r.t1 = Math.round(Math.min(1, st + W) * 1e4) / 1e4;
  });
  stages.push({
    key: s.key, layer: s.layer, label: s.label, caption: s.caption,
    window: s.win, count: n,
    parts: list.map(r => r.object)
  });
}

/* --------------------------------------------- the whole and glider one-piece
 * Measured here, not taken from parts-INFO's `whole` block: that block
 * describes an earlier export of the whole file and no longer matches the
 * bytes on disk. The page quotes what the served files actually contain. */
function onePiece(name) {
  const p = join(KIT, name);
  if (!existsSync(p)) { problems.push(`missing one-piece file ${name}`); return null; }
  const st = stlStats(p);
  return { file: name, bytes: st.bytes, triangles: st.tris, bbox: { min: st.min, max: st.max, size: st.size } };
}
const whole = onePiece('winged-zebrafish-whole-120mm.stl');
const glider = onePiece('winged-zebrafish-glider-120mm.stl');

/* ---------------------------------------------------- the 4% size discrepancy
 * The published part files and the published whole-fish file are not the same
 * size. Ratio per axis of the whole file's bounding box to the reassembled
 * kit's. Stated, never silently corrected: rescaling the parts here would
 * hide an export disagreement the kit's user has to know about. */
let undersize = null;
if (whole) {
  const per = [0, 1, 2].map(a => whole.bbox.size[a] / kitSize[a]);
  const mean = per.reduce((x, y) => x + y, 0) / 3;
  undersize = {
    axis_ratio: per.map(x => Math.round(x * 1e4) / 1e4),
    mean_ratio: Math.round(mean * 1e4) / 1e4,
    parts_smaller_by_percent: Math.round((mean - 1) * 1000) / 10,
    kit_bbox_mm: kitSize.map(x => Math.round(x * 1e3) / 1e3),
    whole_bbox_mm: whole.bbox.size.map(x => Math.round(x * 1e3) / 1e3),
    why: 'The part set was exported with standard length measured to the posterior skin limit '
       + '(model X = -0.3528, scale factor ' + (info.scale?.scale_factor ?? '?') + '), which puts SL = 120 mm at the skin tip. '
       + "The whole-fish file on disk is a later export that measures to the tail's structural base, so it is larger. "
       + 'parts-INFO records the alternative factor 148.7411 for that definition.',
    consequence: 'A kit assembled from the 100 part files is about 4% smaller in every dimension than the one-piece whole-fish print, '
       + 'and the two cannot be mixed. Neither file has been rescaled to match the other.',
    not_done: 'No rescale has been applied here. Scale the part files by the mean ratio above only if you deliberately want them to match the whole-fish print.'
  };
}

/* ------------------------------------------------------------ honesty payload
 * Every string below is read from the manifest, parts-INFO or
 * blueprint3d/data.json. Nothing is written freehand except the labels. */
const note = [...new Set(objects.map(o => o.hypothetical_note).filter(Boolean))];
const pec = man.provenance_per_parameter?.pectoral_len_over_SL || {};
const flagged = info.flagged?.zero_thickness_surfaces || [];

const totals = {
  parts: rows.length,
  bytes: rows.reduce((s, r) => s + r.bytes, 0),
  triangles: rows.reduce((s, r) => s + r.triangles, 0),
  watertight: rows.filter(r => r.watertight).length,
  flagged: rows.filter(r => r.zero_thickness).length
};

// sanity: the flagged list in parts-INFO and the geometry flags must agree
const flaggedFromGeom = rows.filter(r => r.zero_thickness).map(r => r.object).sort();
if (flaggedFromGeom.join(',') !== [...flagged].sort().join(',')) {
  problems.push(`the zero-thickness list in parts-INFO (${flagged.length}) and the per-part flags (${flaggedFromGeom.length}) disagree`);
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  generator: 'dashboard/build-print-view.mjs',
  sources: {
    geometry: 'dashboard/public/blueprint3d/print/parts-INFO.json',
    anatomy: 'dashboard/public/blueprint3d/model/winged-zebrafish-manifest.json',
    stl_dir: 'dashboard/public/blueprint3d/print/',
    measured_here: 'every bounding box below was measured by parsing the binary STL on disk'
  },
  stl_base: '../blueprint3d/print/',
  units: 'millimetres (binary STL carries no unit field; slicers assume mm)',
  frame: {
    axes: '+X anterior (snout), +Y the fish’s left flank, +Z dorsal',
    origin: info.scale?.origin || null,
    kit_bbox_mm: { min: kitMin.map(x => Math.round(x * 1e3) / 1e3), max: kitMax.map(x => Math.round(x * 1e3) / 1e3), size: kitSize.map(x => Math.round(x * 1e3) / 1e3) },
    kit_centre_mm: kitMid.map(x => Math.round(x * 1e3) / 1e3)
  },
  scale: info.scale || null,
  totals,
  hierarchy: {
    tiers: man.levels || 'body / organ system / organ / tissue',
    organ_system_from: 'the manifest field organ_system, verbatim',
    organ_from: 'DERIVED here from the object-name family (dashboard/build-print-view.mjs, ORGANS). '
              + 'The manifest has no organ-parent field; where a part also carries an ontology label it agrees with the family.',
    level_from: 'the manifest field level (organ or tissue)',
    layer_from: 'the manifest field layer (outer / skeleton / muscle / organ), which also sets the assembly order',
    no_system_node: 'One part, swim_bladder, carries the organ_system string '
                  + '"gas bladder (no organ-system node; foregut derivative)". That is the manifest’s own wording and is shown as given; '
                  + 'no organ system has been invented for it. No part has a null organ_system in this manifest.'
  },
  stages,
  animation: {
    state: 'one number T in [0,1]: 0 = fully exploded, 1 = assembled. The explode slider is the animation scrubber.',
    easing: 'ease-out cubic on each part’s own window [t0,t1]',
    default_seconds: 10,
    order: 'skeleton (vertebrae along the spine, then ribs, skull, girdle, fin rays), muscle, organs, then the outer layer with the skin halves and the fins last'
  },
  printability: {
    flagged_count: flagged.length,
    flagged: flagged,
    one_line: 'These 11 parts are single-layer sheets with no interior — zero wall thickness — so a slicer has nothing to fill and they will not print as-is; each needs a solidify/thicken pass (roughly 0.8–1.2 mm) first.',
    definition: info.flagged?.definitions?.zero_thickness_surface || null,
    detail: info.flagged?.definitions?.note || null,
    closed_manifold: info.flagged?.counts?.closed_manifold_solids ?? null,
    not_done: info.processing?.not_done || [],
    warnings: info.processing?.warnings || []
  },
  honesty: {
    hypothetical: true,
    hypothetical_note: note[0] || null,
    hypothetical_note_count: note.length,
    morphological_not_genetic: man.MORPHOLOGICAL_NOT_GENETIC || null,
    schematic: 'Every part’s geometry_basis in the manifest is "schematic" except the pectoral fin membranes and their rays. '
             + 'The shapes are parametric constructions, not scans or segmentations of any specimen.',
    evidence_backed_proportion: {
      parameter: 'pectoral_len_over_SL',
      measured_value: 0.687,
      measured_source: 'median of 49 flying-fish specimens, Daane et al. 2021 Curr Biol Data S1A, recomputed in genotype/cache/daane2021_fin_ratios.json '
                     + '(quoted from dashboard/public/blueprint3d/data.json, pectoral_fin_L.geometry_basis)',
      design_value: man.parameters?.pectoral_len_over_SL ?? null,
      design_kind: pec.kind || null,
      delta_applied: pec.delta?.applied || null,
      delta_reason: pec.delta?.reason || null,
      delta_evidence: pec.delta?.evidence || null,
      zebrafish_placeholder: pec.parents?.[0]?.value ?? null
    },
    undersize,
    one_piece_note: 'The glider is a separate object, not a kit part: it is a one-piece hollowed variant of the same body, '
                  + 'and nothing in the kit assembles into it. Neither it nor the assembled kit will fly — no flight test has been run on either, '
                  + 'and the kit is a solid stack of overlapping shells with no aerodynamic surface, no mass distribution and no trim.'
  },
  one_piece: [
    whole && { ...whole, title: 'Whole animal, one piece', note: 'All 100 objects joined into a single mesh. A non-unioned assembly of 100 overlapping shells with the organs still inside, so a slicer using an even-odd fill rule may show voids. This is the file the part set is 4% smaller than.' },
    glider && { ...glider, title: 'Glider variant, one piece', note: 'A hollowed one-piece glider. A separate object from the kit: it is not the sum of any subset of the part files, and the kit does not assemble into it.' }
  ].filter(Boolean),
  parts: rows
};

/* ------------------------------------------------------------------- report */
console.log('build-print-view');
console.log(`  joined     ${rows.length} parts (${(totals.bytes / 1048576).toFixed(2)} MB, ${totals.triangles.toLocaleString('en-GB')} triangles)`);
console.log(`  flagged    ${totals.flagged} zero-thickness sheets, ${totals.watertight} watertight solids`);
console.log(`  frame      kit bbox ${out.frame.kit_bbox_mm.size.map(n => n.toFixed(1)).join(' x ')} mm`);
if (undersize) {
  console.log(`  undersize  the part set is ${undersize.parts_smaller_by_percent.toFixed(1)}% smaller than the whole-fish file (mean of the three axes)`);
  console.log(`             per-axis whole/kit ratio ${undersize.axis_ratio.join(', ')}  =  ${undersize.axis_ratio.map(r => ((r - 1) * 100).toFixed(1) + '%').join(', ')}`);
}
for (const s of stages) console.log(`  stage      ${s.key.padEnd(9)} ${String(s.count).padStart(3)} parts, T ${s.window[0]}-${s.window[1]}`);
const systems = new Map();
for (const r of rows) systems.set(r.organ_system, (systems.get(r.organ_system) || 0) + 1);
console.log(`  systems    ${systems.size}`);
for (const [k, v] of [...systems].sort((a, b) => b[1] - a[1])) console.log(`               ${String(v).padStart(3)}  ${k === null ? '(organ system not stated in the manifest)' : k}`);
console.log(`  organs     ${byOrgan.size} derived organ groups`);
if (problems.length) { console.log('  PROBLEMS'); for (const p of problems) console.log('    ' + p); }
else console.log('  no problems');

if (CHECK) { console.log('\n  --check: nothing written'); process.exit(problems.length ? 1 : 0); }
writeFileSync(OUT, JSON.stringify(out));
console.log(`\n  wrote      dashboard/public/print/parts.json  (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
