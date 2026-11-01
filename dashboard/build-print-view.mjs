#!/usr/bin/env node
/* build-print-view.mjs — data for the printable-kit assembly viewer at /print/.
 *
 * The page offers three kits behind one switcher:
 *
 *   starter  the 1:1 starter kit (10 parts)              DEFAULT
 *            print/kit-1to1/starter/   on the ff-fins design
 *   h120     the 120 mm containment-hierarchy kit (56)
 *            print/kit-120mm/          on the ff-fins design
 *   legacy   the original 100-part set, superseded
 *            print/parts/              on the 0.35-fin design, SL measured to the
 *                                      skin tip, so it is undersized
 *
 * For the two current kits, everything about a part (what it is, what it seats
 * into, what was merged, whether it passed verification and why not) is read
 * from anatomy-model/print/manifest.json. For the legacy kit it is the join of
 * parts-INFO.json and the GLB manifest, exactly as before.
 *
 * For all three, every STL on disk is parsed here and its bounding box MEASURED;
 * that gives the shared frame, each part's centroid, the explode vectors and the
 * assembly timeline, so the browser does no geometry beyond loading the meshes.
 *
 * It writes ONE file: dashboard/public/print/parts.json, and reads everything else.
 *
 *   node dashboard/build-print-view.mjs
 *   node dashboard/build-print-view.mjs --check    # report only, write nothing;
 *                                                  # exit 1 if any problem is found
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const PUB = join(HERE, 'public');
const PRINT = join(PUB, 'blueprint3d', 'print');
const OUT = join(PUB, 'print', 'parts.json');
const CHECK = process.argv.includes('--check');

const problems = [];
const fail = m => { console.error('build-print-view: ' + m); process.exit(1); };
const readJson = p => { if (!existsSync(p)) fail(`missing input ${p}`); return JSON.parse(readFileSync(p, 'utf8')); };
const r3 = n => Math.round(n * 1e3) / 1e3;
const r4 = n => Math.round(n * 1e4) / 1e4;

const PM = readJson(join(REPO, 'anatomy-model', 'print', 'manifest.json'));

/* ----------------------------------------------------------- binary STL bbox
 * 80-byte header, uint32 triangle count, 50 bytes per triangle (normal + three
 * vertices + attribute). No unit field: every file here is millimetres. */
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
  return { tris, bytes: b.length, min: min.map(r4), max: max.map(r4), size: min.map((m, i) => r4(max[i] - m)) };
}

/* ------------------------------------------------------------- the frame
 * Every kit is in the same print frame, after Blender's glTF Y-up to Z-up:
 *   +X anterior (snout)   +Y the fish's LEFT flank   +Z dorsal          */
function frameOf(rows) {
  const min = [0, 1, 2].map(a => Math.min(...rows.map(r => r.bbox.min[a])));
  const max = [0, 1, 2].map(a => Math.max(...rows.map(r => r.bbox.max[a])));
  const size = min.map((m, i) => max[i] - m);
  const mid = min.map((m, i) => m + size[i] / 2);
  return { min, max, size, mid };
}

/* ---------------------------------------------------- the explode vector
 * Each part moves along a fixed unit vector: outward from the body axis; left
 * parts +Y and right parts -Y so the halves separate; a push along the body axis
 * away from the kit's centre; and a fan of up to +-0.5 rad inside one family so
 * no two members fly along the same line. Deterministic. */
function explode(rows, fr, familyOf) {
  const fam = new Map();
  for (const r of rows) {
    const k = familyOf(r) || '(none)';
    if (!fam.has(k)) fam.set(k, []);
    fam.get(k).push(r);
  }
  for (const list of fam.values()) {
    list.sort((a, b) => b.bbox.min[0] - a.bbox.min[0] || a.id.localeCompare(b.id));
    const n = list.length;
    list.forEach((r, i) => {
      const c = [0, 1, 2].map(a => (r.bbox.min[a] + r.bbox.max[a]) / 2);
      const dy = c[1], dz = c[2] - fr.mid[2];
      let ang = Math.atan2(dz, dy);
      if (Math.hypot(dy, dz) < fr.size[2] * 0.03) ang = Math.PI / 2;   // on the axis: send it dorsally
      const spread = n > 1 ? Math.min(1.0, 0.1 * n) : 0;
      ang += spread * (i / Math.max(1, n - 1) - 0.5);
      const v = [0, Math.cos(ang), Math.sin(ang)];
      if (r.side === 'L') v[1] += 0.95;
      else if (r.side === 'R') v[1] -= 0.95;
      const ax = (c[0] - fr.mid[0]) / (fr.size[0] / 2 || 1);
      v[0] += 0.78 * Math.max(-1, Math.min(1, ax));
      const len = Math.hypot(...v) || 1;
      r.offset = v.map(x => r4(x / len));
      r.centre_mm = c.map(r4);
    });
  }
}

/* --------------------------------------------- the assembly timeline
 * One number T in [0,1]: 0 = fully exploded, 1 = assembled. Each stage owns a
 * window of T, and each part inside it a sub-window [t0,t1]; the explode slider
 * IS the animation scrubber. `stages` is [{key,label,caption,win,test,sort}]. */
function timeline(rows, stages) {
  const out = [];
  const taken = new Set();
  for (const s of stages) {
    const list = rows.filter(r => !taken.has(r) && s.test(r));
    list.forEach(r => taken.add(r));
    list.sort(s.sort || ((a, b) => b.bbox.max[0] - a.bbox.max[0] || a.id.localeCompare(b.id)));
    const [a, b] = s.win;
    const span = b - a;
    const W = Math.min(span, Math.max(0.10, span * 0.45));
    const lastStart = b - W;
    const n = list.length;
    list.forEach((r, i) => {
      const st = n > 1 ? a + (lastStart - a) * (i / (n - 1)) : a;
      r.stage = s.key;
      r.order = i;
      r.t0 = r4(st);
      r.t1 = r4(Math.min(1, st + W));
    });
    out.push({ key: s.key, label: s.label, caption: s.caption || s.label, window: s.win, count: n, parts: list.map(r => r.id) });
  }
  const left = rows.filter(r => !taken.has(r));
  if (left.length) problems.push(`${left.length} part(s) fell into no assembly stage: ${left.map(r => r.id).join(', ')}`);
  return out;
}

const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());
const human = s => String(s || '').replace(/-/g, ' ');

function onePiece(rel, base, title, note) {
  const p = join(PRINT, rel);
  if (!existsSync(p)) { problems.push(`missing related file ${rel}`); return null; }
  const st = stlStats(p);
  return { title, note, href: base + rel, file: rel.split('/').pop(), bytes: st.bytes, triangles: st.tris,
           bbox: { min: st.min, max: st.max, size: st.size } };
}

function totalsOf(rows) {
  const t = { parts: rows.length, bytes: 0, triangles: 0 };
  for (const r of rows) { t.bytes += r.bytes; t.triangles += r.triangles; }
  for (const k of ['pass', 'fail', 'unverified', 'donotprint', 'unprintable']) t[k] = rows.filter(r => r.status === k).length;
  return t;
}

function frameBlock(fr, axesNote) {
  return {
    axes: axesNote || '+X anterior (snout), +Y the fish’s left flank, +Z dorsal',
    kit_bbox_mm: { min: fr.min.map(r3), max: fr.max.map(r3), size: fr.size.map(r3) },
    kit_centre_mm: fr.mid.map(r3)
  };
}

/* Status from the verification record in the print manifest.
 *   pass        every check passed
 *   donotprint  the volume cross-check failed: a shell is probably wound inside
 *               out, which is the sealed-cavity signature - inspect before printing
 *   unverified  the wall thickness could not be established (too few samples)
 *   fail        a real check failed (wall under the minimum, not watertight ...) */
function statusOf(passed, reasons) {
  if (passed) return 'pass';
  const rs = reasons || [];
  if (rs.some(r => /volume cross-check failed/i.test(r))) return 'donotprint';
  if (rs.length && rs.every(r => /NOT ESTABLISHED/.test(r))) return 'unverified';
  return 'fail';
}

function devSummary(devs) {
  return (devs || []).map(d => {
    const amt = d.total_amount_mm ?? d.amount_mm;
    const objs = (d.objects || []).filter(o => o !== '<part>' && o !== '<generated>');
    return {
      change: d.change,
      amount_mm: amt == null ? null : r3(amt),
      objects: objs.length > 6 ? objs.slice(0, 6).concat([`+${objs.length - 6} more`]) : objs,
      reason: d.reason || null
    };
  });
}

/* ================================================================ STARTER */
function starterKit() {
  const S = PM.life_size_1to1?.starter_kit_1to1 || fail('manifest has no life_size_1to1.starter_kit_1to1');
  const base = '../blueprint3d/print/kit-1to1/starter/';
  const dir = join(PRINT, 'kit-1to1', 'starter');
  const rows = [];
  for (const [id, p] of Object.entries(S.parts)) {
    const f = join(dir, p.file);
    if (!existsSync(f)) { problems.push(`starter: no STL on disk for ${id}`); continue; }
    const st = stlStats(f);
    const [, grp, part] = id.split('__');
    const kind = /body-case/.test(grp) ? 'case' : (p.level === 'tissue' ? 'tissue' : 'organ');
    const reasons = p.failure_reasons || [];
    rows.push({
      id, file: p.file,
      label: cap(human(grp)) + ' — ' + human(part),
      kind, level: p.level, side: p.side,
      system: p.system, organ: p.organ,
      ontology_id: p.ontology_id || null, ontology_label: null,
      seats_into: p.seats_into || null, holds: null,
      merge: p.merge || null, source_count: p.source_object_count ?? (p.source_objects || []).length,
      sources: p.source_objects || [],
      notes: p.notes || [], deviations: devSummary(p.deviations),
      wall: p.verification?.wall_thickness || null,
      status: statusOf(p.PASSED === true, reasons), reasons,
      triangles: st.tris, bytes: st.bytes, bbox: { min: st.min, max: st.max, size: st.size }
    });
    if (p.PASSED == null) problems.push(`starter: ${id} has no verification verdict in the manifest`);
  }
  // the kit's own assembly order: the left case half is the tray everything seats
  // into, the right half closes over it last (README, "Assembly order")
  const by = re => r => re.test(r.id);
  const stages = timeline(rows, [
    { key: 'tray',  label: 'Left case half — the tray', caption: 'The tray: left case half', win: [0.00, 0.14], test: by(/half-L$/) },
    { key: 'axial', label: 'Spine and skull block',     win: [0.12, 0.38], test: by(/__(axial|cranium)__/) },
    { key: 'soft',  label: 'Viscera block and muscle',  win: [0.36, 0.62], test: by(/__(viscera|myotome)__/) },
    { key: 'fins',  label: 'Fin plates',                win: [0.60, 0.84], test: by(/fin__plate/) },
    { key: 'close', label: 'Right case half closes',    caption: 'Closing: right case half on the midline pins', win: [0.82, 1.00], test: by(/half-R$/) }
  ]);
  const fr = frameOf(rows);
  explode(rows, fr, r => r.organ);
  for (const r of rows) {
    r.g = {
      tier:  [{ case: 'Body case', organ: 'Organ pieces', tissue: 'Tissue pieces' }[r.kind], r.system],
      stage: [stages.find(s => s.key === r.stage)?.label || r.stage, null],
      status:[STATUS_LABEL[r.status], null]
    };
  }
  const L = PM.life_size_1to1;
  const coupon = L.fit_test_coupon;
  const t = totalsOf(rows);
  if (t.pass !== rows.length) problems.push(`starter: ${rows.length - t.pass} part(s) do not pass; the switcher label says all pass`);
  return {
    id: 'starter',
    title: '1:1 starter kit',
    menu: `1:1 starter (${rows.length} parts)`,
    current: true,
    stl_base: base,
    scale_line: `Life size: ${S.scale.print_standard_length_mm} mm standard length, ${S.scale.mm_per_model_unit} mm per model unit.`,
    design: S.design,
    explode_mm: r3(fr.size[0] * 0.72),
    frame: frameBlock(fr),
    totals: t,
    stages,
    color_by: 'kind',
    group_modes: [
      { key: 'tier', label: 'Case → pieces (by organ system)' },
      { key: 'stage', label: 'Assembly order' },
      { key: 'status', label: 'Verification' }
    ],
    group_order: { tier: ['Body case', 'Organ pieces', 'Tissue pieces'], stage: stages.map(s => s.label) },
    pills: [
      { cls: 'hyp', text: 'Hypothetical animal' },
      { cls: 'ok', text: `${t.pass} of ${t.parts} pass` },
      { cls: 'warn', text: 'Hierarchy flattened' }
    ],
    banner: [
      { cls: 'viol', head: 'This animal is hypothetical.', text: PM.hypothetical_note },
      { cls: 'warn', head: 'What this kit deliberately abandons.', text: S.ANATOMY_DELIBERATELY_ABANDONED },
      { cls: 'warn', head: 'The hierarchy is flattened.', text: S.hierarchy_note },
      { cls: 'ok', head: 'Print the coupon first, then pick the socket.',
        text: 'Print the fit-test coupon before anything else: five blind D-sockets at 0.05, 0.08, 0.10, 0.12 and 0.16 mm radial clearance, labelled, with six identical pegs. '
            + 'The tightest socket a peg enters by hand without forcing, and holds without glue, is the clearance to build at. '
            + `This kit is built at ${S.sla_values.radial_clearance_mm} mm; if the coupon picks another, rebuild with that number (anatomy-model/print/README.md).`,
        link: coupon ? { href: '../blueprint3d/print/kit-1to1/' + coupon.file, text: 'Download the coupon' } : null }
    ],
    about: [
      { title: 'The SLA values this kit is built on', rows: [
          ['Resin', S.sla_values.resin],
          ['Minimum wall', S.sla_values.min_wall_mm + ' mm'],
          ['Minimum handleable part', S.sla_values.min_handleable_part_mm + ' mm'],
          ['Peg', `${S.sla_values.peg_diameter_mm} mm diameter × ${S.sla_values.peg_length_mm} mm, D-keyed`],
          ['Radial clearance', S.sla_values.radial_clearance_mm + ' mm (confirm with the coupon)'],
          ['Case wall', S.sla_values.case_wall_mm + ' mm']],
        paras: ['Every peg and socket has a raised index triangle beside it; align the triangles and the part is the right way round. Nothing needs glue. The two case halves mate on three keyed midline pins.'] },
      { title: 'Design', rows: [
          ['Design', S.design.id],
          ['pectoral_len_over_SL', String(S.design.pectoral_len_over_SL)],
          ['Basis', S.design.basis],
          ['Design file', S.design.design_file]],
        paras: [] }
    ],
    related: [
      coupon && onePiece('kit-1to1/' + coupon.file, '../blueprint3d/print/', 'Fit-test coupon — print this first',
        'One STL holding seven solids: the socket bar with five labelled clearances and six pegs. Pick the clearance before printing the kit.'),
      L.ff_fins_solid_1to1_GLIDER && onePiece('kit-1to1/' + L.ff_fins_solid_1to1_GLIDER.file, '../blueprint3d/print/', 'The same fish, one piece — the one to throw',
        'Solid, life size, with an open 2.6 × 9 mm ballast bore at the snout. Not a kit part: the assembled kit will not fly (joints, gaps, stepped surfaces). Glide performance is unverified.')
    ].filter(Boolean),
    parts: rows
  };
}

/* =================================================================== H120 */
const SYS_ORDER = ['musculoskeletal', 'nervous', 'sense-organ', 'respiratory', 'circulatory', 'digestive',
                   'hematopoietic', 'renal', 'reproductive', 'gas-bladder', 'integumental'];
const sysRank = s => { const i = SYS_ORDER.indexOf(s); return i < 0 ? 99 : i; };

function h120Kit() {
  const K = PM.kit_120mm || fail('manifest has no kit_120mm');
  const base = '../blueprint3d/print/kit-120mm/';
  const dir = join(PRINT, 'kit-120mm');
  const rows = [];
  for (const [id, p] of Object.entries(K.parts)) {
    const f = join(dir, p.file);
    if (!existsSync(f)) { problems.push(`h120: no STL on disk for ${id}`); continue; }
    const st = stlStats(f);
    const reasons = p.failure_reasons || [];
    rows.push({
      id, file: p.file,
      label: cap(p.organ) + (p.part && p.part !== 'organ' ? ' — ' + p.part : ''),
      kind: p.kind, level: p.level, side: p.side,
      system: p.system, organ: p.organ,
      ontology_id: p.ontology_id || null, ontology_label: p.ontology_label || null,
      seats_into: p.seats_into || null, holds: p.holds || null,
      merge: (p.merged_from || []).length ? `${p.merged_from.length} -> 1` : (p.source_objects || []).length > 1 ? `${p.source_objects.length} -> 1` : null,
      source_count: (p.source_objects || []).length, sources: p.source_objects || [],
      notes: p.notes || [], deviations: devSummary(p.deviations),
      wall: p.verification?.wall_thickness || null,
      status: statusOf(p.PASSED === true, reasons), reasons,
      triangles: st.tris, bytes: st.bytes, bbox: { min: st.min, max: st.max, size: st.size }
    });
    if (p.PASSED == null) problems.push(`h120: ${id} has no verification verdict in the manifest`);
  }
  // the parent of a seated part must exist in the kit
  const ids = new Set(rows.map(r => r.id));
  for (const r of rows) if (r.seats_into && !ids.has(r.seats_into)) problems.push(`h120: ${r.id} seats into ${r.seats_into}, which is not in the kit`);

  const carrierRank = new Map(rows.filter(r => r.kind === 'carrier')
    .sort((a, b) => sysRank(a.system) - sysRank(b.system) || a.id.localeCompare(b.id))
    .map((r, i) => [r.id, i]));
  const bySys = (a, b) => sysRank(a.system) - sysRank(b.system) || b.bbox.max[0] - a.bbox.max[0] || a.id.localeCompare(b.id);
  const byParent = (a, b) => (carrierRank.get(a.seats_into) ?? 99) - (carrierRank.get(b.seats_into) ?? 99) || b.bbox.max[0] - a.bbox.max[0] || a.id.localeCompare(b.id);
  // README assembly order: left case half (the tray) -> system carriers ->
  // organs into their carriers -> tissues -> right case half closes
  const stages = timeline(rows, [
    { key: 'tray',     label: 'Left case halves — the tray', caption: 'The tray: left case halves', win: [0.00, 0.12], test: r => r.kind === 'case' && r.side === 'L' },
    { key: 'carriers', label: 'Organ-system carriers', win: [0.10, 0.34], test: r => r.kind === 'carrier', sort: (a, b) => carrierRank.get(a.id) - carrierRank.get(b.id) },
    { key: 'organs',   label: 'Organs into their systems', win: [0.32, 0.76], test: r => r.kind === 'organ', sort: byParent },
    { key: 'tissues',  label: 'Tissues', win: [0.74, 0.88], test: r => r.kind === 'tissue', sort: bySys },
    { key: 'close',    label: 'Right case halves close', caption: 'Closing: right case halves', win: [0.86, 1.00], test: r => r.kind === 'case' && r.side === 'R' }
  ]);
  const fr = frameOf(rows);
  explode(rows, fr, r => r.kind === 'carrier' ? 'carrier:' + r.system : r.organ);
  const parentLabel = new Map(rows.map(r => [r.id, r.label]));
  for (const r of rows) {
    const tier = { case: '1 · Body case', carrier: '2 · Organ-system carriers', organ: '3 · Organs', tissue: '4 · Tissues' }[r.kind];
    r.g = {
      tier:   [tier, r.kind === 'case' ? null : human(r.system)],
      parent: [r.seats_into ? 'Seats into: ' + (parentLabel.get(r.seats_into) || r.seats_into) : 'Top level (the body case)', null],
      stage:  [stages.find(s => s.key === r.stage)?.label || r.stage, null],
      status: [STATUS_LABEL[r.status], null]
    };
  }
  const dnp = rows.filter(r => r.status === 'donotprint');
  if (dnp.length !== 2) problems.push(`h120: expected exactly 2 do-not-print parts (brain, head kidney), found ${dnp.length}: ${dnp.map(r => r.id).join(', ')}`);
  const t = totalsOf(rows);
  if (t.pass !== K.n_passed) problems.push(`h120: ${t.pass} parts pass here but the manifest says ${K.n_passed}`);
  return {
    id: 'h120',
    title: '120 mm containment-hierarchy kit',
    menu: `120 mm hierarchy kit (${rows.length} parts)`,
    current: true,
    stl_base: base,
    scale_line: `${K.scale.print_standard_length_mm} mm standard length, ${r4(K.scale.scale_factor_vs_life)}× life size.`,
    design: K.design,
    explode_mm: r3(fr.size[0] * 0.62),
    frame: frameBlock(fr),
    totals: t,
    stages,
    color_by: 'kind',
    group_modes: [
      { key: 'tier', label: 'Case → system carriers → organs → tissues' },
      { key: 'parent', label: 'What each part seats into' },
      { key: 'stage', label: 'Assembly order' },
      { key: 'status', label: 'Verification' }
    ],
    group_order: {
      tier: ['1 · Body case', '2 · Organ-system carriers', '3 · Organs', '4 · Tissues'],
      stage: stages.map(s => s.label),
      status: ['Do not print — inspect first', 'Fails a check', 'Wall not established', 'Passes every check']
    },
    pills: [
      { cls: 'hyp', text: 'Hypothetical animal' },
      { cls: 'ok', text: `${t.pass} of ${t.parts} pass` },
      { cls: 'bad', text: `${t.donotprint} do not print` }
    ],
    banner: [
      { cls: 'viol', head: 'This animal is hypothetical.', text: PM.hypothetical_note },
      { cls: 'ok', head: 'Organ system → organ → tissue, as physical parts.', text: K.what },
      { cls: 'bad', head: `${t.donotprint} parts: do not print without inspecting them.`,
        text: dnp.map(r => `${r.label} (${r.id}): ${r.reasons[0].replace(/\.?$/, '.')}`).join(' ') + ' This is the same signature as the sealed-cavity bug recorded in the README.' },
      { cls: 'warn', head: `${t.parts - t.pass} of ${t.parts} parts fail a check, and none was dropped.`,
        text: `${t.fail} fail a real check (a wall under the 1.2 mm minimum, or not watertight), ${t.unverified} could not have their wall measured with enough samples to judge, and ${t.donotprint} fail the volume cross-check. Every reason is in the parts list.` }
    ],
    about: [
      { title: 'Design and scale', rows: [
          ['Design', K.design.id],
          ['pectoral_len_over_SL', String(K.design.pectoral_len_over_SL)],
          ['Basis', K.design.basis],
          ['Scale', `${K.scale.print_standard_length_mm} mm SL, ${r4(K.scale.mm_per_model_unit)} mm per model unit`],
          ['Not the same design as', K.not_the_same_design_as]],
        paras: [] },
      { title: 'How the hierarchy is built', rows: [
          ['Body case', `${rows.filter(r => r.kind === 'case').length} pieces: the skin halves, split fore and aft to fit a 200 mm plate`],
          ['Organ-system carriers', `${rows.filter(r => r.kind === 'carrier').length} trays, generated as printing fixtures (not anatomy); each legs into a case half`],
          ['Organs', `${rows.filter(r => r.kind === 'organ').length} pieces, each pegged into its system's carrier on a boss of its true anatomical height`],
          ['Tissues', `${rows.filter(r => r.kind === 'tissue').length} pieces (axial and pectoral muscle)`]],
        paras: ['Joinery: D-keyed peg into a matching socket, one rotation only, with a raised index triangle beside each. Parent of every part is the manifest field seats_into.',
                'Cell tokens and register cards are designed for this scale but are not among these 56 files; the 75-cell-type register is in the manifest as data.'] }
    ],
    related: [
      onePiece('winged-zebrafish-whole-120mm.stl', '../blueprint3d/print/', 'Whole animal, one piece, 120 mm',
        'A DIFFERENT design (the 0.35-fin winged zebrafish), so it is not what this kit assembles into.'),
      onePiece('winged-zebrafish-glider-120mm.stl', '../blueprint3d/print/', 'Glider, one piece, 120 mm',
        'Also the 0.35-fin design. Hollowed with a SEALED cavity: add a drain hole before resin printing.')
    ].filter(Boolean),
    parts: rows
  };
}

/* ================================================================= LEGACY
 * The original 100-part set, unchanged in substance from the previous build of
 * this page: joined from parts-INFO.json and the GLB manifest. */
const LAYER_STAGES = [
  { key: 'skeleton', layer: 'skeleton', label: 'Skeleton',      win: [0.00, 0.44] },
  { key: 'muscle',   layer: 'muscle',   label: 'Muscle',        win: [0.42, 0.54] },
  { key: 'organ',    layer: 'organ',    label: 'Organs',        win: [0.52, 0.74] },
  { key: 'outer',    layer: 'outer',    label: 'Skin and fins', win: [0.72, 1.00] }
];
const SUBORDER = [
  { re: /^vertebra_/, rank: 0 }, { re: /^ribs_/, rank: 1 }, { re: /^skull_/, rank: 2 },
  { re: /^(cleithrum|scapula|coracoid)_/, rank: 3 }, { re: /_rays?(_|$)|_ray_/, rank: 4 },
  { re: /^muscle_/, rank: 0 }, { re: /^pectoral_muscle_/, rank: 1 },
  { re: /^eye_/, rank: 0 }, { re: /^skin_/, rank: 1 }, { re: /_fin(_|$)/, rank: 2 }
];
const subRank = n => { for (const s of SUBORDER) if (s.re.test(n)) return s.rank; return 5; };
const ORGANS = [
  [/^pectoral_fin(_ray)?_L/, 'Pectoral fin, left'], [/^pectoral_fin(_ray)?_R/, 'Pectoral fin, right'],
  [/^pectoral_muscle_L/, 'Pectoral girdle musculature, left'], [/^pectoral_muscle_R/, 'Pectoral girdle musculature, right'],
  [/^pelvic_fin.*_L/, 'Pelvic fin, left'], [/^pelvic_fin.*_R/, 'Pelvic fin, right'],
  [/^dorsal_fin/, 'Dorsal fin'], [/^anal_fin/, 'Anal fin'], [/^caudal_fin/, 'Caudal fin'],
  [/^vertebra_/, 'Vertebral column'], [/^ribs_/, 'Ribs'], [/^skull_/, 'Skull'],
  [/^(cleithrum|scapula|coracoid)_/, 'Pectoral girdle'], [/^muscle_/, 'Trunk musculature'],
  [/^skin_/, 'Skin of body'], [/^eye_/, 'Eye'], [/^gills_/, 'Gills'], [/^gonad_/, 'Gonad'],
  [/^head_kidney/, 'Head kidney'], [/^kidney/, 'Kidney'], [/^swim_bladder/, 'Swim bladder'],
  [/^spinal_cord/, 'Spinal cord'], [/^brain/, 'Brain'], [/^heart/, 'Heart'], [/^oesophagus/, 'Oesophagus'],
  [/^intestine/, 'Intestine'], [/^liver/, 'Liver'], [/^spleen/, 'Spleen']
];
const organOf = n => { for (const [re, l] of ORGANS) if (re.test(n)) return l; return null; };

function legacyKit() {
  const info = readJson(join(PRINT, 'parts-INFO.json'));
  const man = readJson(join(PUB, 'blueprint3d', 'model', 'winged-zebrafish-manifest.json'));
  const flagLine = 'A single-layer sheet with no interior — zero wall thickness — so a slicer has nothing to fill; it needs a solidify/thicken pass (roughly 0.8–1.2 mm) first.';
  const rows = [];
  for (const o of man.objects) {
    const g = info.parts[o.object];
    if (!g) { problems.push(`legacy: no geometry in parts-INFO for ${o.object}`); continue; }
    const f = join(PRINT, g.file);
    if (!existsSync(f)) { problems.push(`legacy: no STL on disk for ${o.object}`); continue; }
    const st = stlStats(f);
    const z = g.zero_thickness_surface === true;
    rows.push({
      id: o.object, file: g.file,
      label: o.label || o.object,
      kind: o.layer, layer: o.layer, level: o.level, side: o.side,
      system: o.organ_system, organ: organOf(o.object),
      ontology_id: o.ontology_id || null, ontology_label: o.ontology_label || null,
      seats_into: null, holds: null, merge: null, source_count: 1, sources: [o.object],
      notes: [o.note, o.geometry_basis ? 'geometry basis: ' + o.geometry_basis : null].filter(Boolean),
      deviations: [], wall: null,
      status: z ? 'unprintable' : 'pass',
      reasons: z ? [flagLine] : [],
      triangles: st.tris, bytes: st.bytes, bbox: { min: st.min, max: st.max, size: st.size }
    });
  }
  const stages = timeline(rows, LAYER_STAGES.map(s => ({
    ...s, test: r => r.layer === s.layer,
    sort: (a, b) => subRank(a.id) - subRank(b.id) || (Math.abs(b.bbox.max[0] - a.bbox.max[0]) > 0.05 ? b.bbox.max[0] - a.bbox.max[0] : a.id.localeCompare(b.id))
  })));
  const fr = frameOf(rows);
  explode(rows, fr, r => r.organ);
  for (const r of rows) {
    r.g = {
      tier:   [r.system, r.organ || '(no organ family)'],
      stage:  [stages.find(s => s.key === r.stage)?.label, null],
      status: [r.status === 'pass' ? 'Watertight closed solid' : 'Will not print — zero-thickness sheet', null]
    };
  }
  // the size disagreement, measured, never rescaled
  const whole = onePiece('winged-zebrafish-whole-120mm.stl', '../blueprint3d/print/', 'Whole animal, one piece, 120 mm',
    'The one-piece file this set is smaller than.');
  let pct = null, per = null;
  if (whole) {
    per = [0, 1, 2].map(a => whole.bbox.size[a] / fr.size[a]);
    pct = Math.round((per.reduce((x, y) => x + y, 0) / 3 - 1) * 1000) / 10;
  }
  const t = totalsOf(rows);
  const pec = man.provenance_per_parameter?.pectoral_len_over_SL || {};
  return {
    id: 'legacy',
    title: 'Legacy 120 mm set (superseded)',
    menu: `legacy 120 mm (superseded, ${pct ?? '?'}% undersized)`,
    current: false,
    stl_base: '../blueprint3d/print/',
    scale_line: `Exported at scale factor ${info.scale?.scale_factor ?? '?'} with standard length measured to the skin tip (0.8528 model units), not the hypural plate (0.82).`,
    design: { id: 'winged-zebrafish', pectoral_len_over_SL: man.parameters?.pectoral_len_over_SL, basis: 'CHOSEN, not measured' },
    explode_mm: 92,
    frame: frameBlock(fr),
    totals: t,
    stages,
    color_by: 'layer',
    group_modes: [
      { key: 'tier', label: 'Organ system → organ' },
      { key: 'stage', label: 'Layer (assembly order)' },
      { key: 'status', label: 'Printability' }
    ],
    group_order: { stage: stages.map(s => s.label) },
    pills: [
      { cls: 'hyp', text: 'Hypothetical animal' },
      { cls: 'bad', text: `Superseded · ~${pct}% undersized` },
      { cls: 'warn', text: `${t.unprintable} parts unprintable` }
    ],
    banner: [
      { cls: 'bad', head: 'Superseded.', text: 'This is the first, fast export of the 100 GLB objects. It is replaced by the 1:1 starter kit and the 120 mm hierarchy kit and will be removed. It has no joinery, no thickening and no verification beyond watertightness.' },
      { cls: 'bad', head: `About ${pct}% undersized.`,
        text: per ? `Measured: the whole-fish file is ${per.map(x => ((x - 1) * 100).toFixed(1) + '%').join(' / ')} larger in X / Y / Z. Standard length was measured to the posterior skin tip (0.8528 model units) instead of the hypural plate (0.82), so every part is small. Nothing has been rescaled.` : 'The whole-fish file could not be measured.' },
      { cls: 'warn', head: `${t.unprintable} of the ${t.parts} parts will not print.`, text: flagLine },
      { cls: 'viol', head: 'Hypothetical, and the fins are a chosen value.',
        text: `The design uses pectoral_len_over_SL = ${man.parameters?.pectoral_len_over_SL}, an assumed delta; the flying fish's measured median is 0.687 (Daane 2021). ${pec.delta?.reason || ''}` }
    ],
    about: [
      { title: 'Where the grouping comes from', rows: [
          ['Organ system', 'the GLB manifest field organ_system, verbatim'],
          ['Organ', 'DERIVED here from the object-name family; the GLB manifest has no organ-parent field'],
          ['Layer', 'the GLB manifest field layer, which also sets the assembly order']],
        paras: ['Not done to this set: ' + (info.processing?.not_done || []).join(' ')] }
    ],
    related: [whole].filter(Boolean),
    parts: rows
  };
}

const STATUS_LABEL = {
  pass: 'Passes every check',
  fail: 'Fails a check',
  unverified: 'Wall not established',
  donotprint: 'Do not print — inspect first',
  unprintable: 'Will not print — zero-thickness sheet'
};

/* =================================================================== build */
const kits = [starterKit(), h120Kit(), legacyKit()];
const out = {
  generated: new Date().toISOString().slice(0, 10),
  generator: 'dashboard/build-print-view.mjs',
  default_kit: 'starter',
  sources: {
    print_manifest: 'anatomy-model/print/manifest.json',
    legacy: 'dashboard/public/blueprint3d/print/parts-INFO.json + dashboard/public/blueprint3d/model/winged-zebrafish-manifest.json',
    measured_here: 'every bounding box was measured by parsing the binary STL on disk'
  },
  units: 'millimetres (binary STL carries no unit field; slicers assume mm)',
  status_labels: STATUS_LABEL,
  what_this_is_not: PM.what_this_is_not || [],
  kits
};

console.log('build-print-view');
for (const k of kits) {
  const t = k.totals;
  console.log(`  ${k.id.padEnd(8)} ${String(t.parts).padStart(3)} parts  ${(t.bytes / 1048576).toFixed(1).padStart(5)} MB  `
    + `pass ${t.pass}  fail ${t.fail}  unverified ${t.unverified}  do-not-print ${t.donotprint}  unprintable ${t.unprintable}  `
    + `bbox ${k.frame.kit_bbox_mm.size.map(n => n.toFixed(1)).join(' x ')} mm`);
  for (const s of k.stages) console.log(`             stage ${s.key.padEnd(9)} ${String(s.count).padStart(3)}  T ${s.window.join('-')}`);
  console.log(`             menu  "${k.menu}"`);
}
if (problems.length) { console.log('  PROBLEMS'); for (const p of problems) console.log('    ' + p); }
else console.log('  no problems');

if (CHECK) { console.log('\n  --check: nothing written'); process.exit(problems.length ? 1 : 0); }
writeFileSync(OUT, JSON.stringify(out));
console.log(`\n  wrote      dashboard/public/print/parts.json  (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
if (problems.length) process.exitCode = 1;
