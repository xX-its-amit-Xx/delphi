#!/usr/bin/env node
// build.mjs - the bundle the /atlas/ viewer reads.
//
//   node sim-engine/scales/atlas/build.mjs
//
// The viewer zooms continuously from an embryo to a single molecular machine. Every level it draws has
// to answer the same question: which parts of this picture are measurements and which parts did we
// invent so that something could be drawn at all? This file assembles that answer alongside the
// geometry, so the viewer never has to decide it at render time.
//
// Modules that have not been written yet are NAMED as absent rather than silently dropped, and the
// viewer renders the level with an "unavailable" card instead of pretending the level does not exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as DIV from '../micro/division.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/atlas/atlas.json');

async function optional(spec) {
  try { return { mod: await import(spec), ok: true }; }
  catch (e) { return { mod: null, ok: false, why: String(e.message ?? e).slice(0, 160) }; }
}

const machines = await optional('../molecular/machines.mjs');
const chromatin = await optional('../molecular/chromatin.mjs');
const dynamics = await optional('../molecular/dynamics.mjs');
const budget = await optional('../molecular/budget.mjs');
const prov = await optional('../molecular/provenance.mjs');
// the inventory that puts measured counts on the atomistic levels, and the measured cleavage events
const counts = await optional('./counts.mjs');
const divisions = await optional('./embryo-divisions.mjs');

const absent = [];
for (const [name, m] of Object.entries({ machines, chromatin, dynamics, budget, provenance: prov })) {
  if (!m.ok) absent.push({ module: `sim-engine/scales/molecular/${name}.mjs`, why: m.why });
}
for (const [name, m] of Object.entries({ counts, 'embryo-divisions': divisions })) {
  if (!m.ok) absent.push({ module: `sim-engine/scales/atlas/${name}.mjs`, why: m.why });
}

// ---------------------------------------------------------------- the inventory, for the atomistic levels
// Every count the viewer draws comes from here, with the downsampling ratio computed in the module so a
// viewer cannot quietly draw fewer and call them all.
const DRAWN = ['ribosome', 'rna_polymerase_ii', 'dna_polymerase_delta', 'dna_polymerase_epsilon',
  'dna_polymerase_alpha_primase', 'mcm_helicase', 'proteasome_20s_core', 'chaperonin_tric',
  'spliceosome_sm_core', 'cohesin', 'condensin_i', 'tfiid'];

/* THE SIZE A COUNT NEEDS, AND WHERE THE TWO MEET.
 *
 * machines.mjs measured ten machines from deposited coordinates and recorded, for every one of them,
 * `copies_per_cell: null` with the reason "no primary measurement of ribosomes per cell for any
 * mammalian cell type was retrieved this session". counts.mjs is that measurement. So the two modules
 * close each other's hole, and the honest drawable set is their INTERSECTION: a machine is drawn only
 * if its count is measured AND its size was measured from coordinates.
 *
 * Six machines qualify. Six more have a count and no measured extent, and they are listed as present
 * and not drawn rather than drawn at an invented size. */
const SIZE_OF = {
  ribosome: 'ribosome_80S',
  rna_polymerase_ii: 'rna_polymerase_II',
  dna_polymerase_delta: 'dna_polymerase_delta_holoenzyme',
  dna_polymerase_epsilon: 'dna_polymerase_epsilon_holoenzyme',
  spliceosome_sm_core: 'spliceosome',
  chaperonin_tric: 'chaperonin_tric_cct',
};
const SIZE_CAVEAT = {
  spliceosome_sm_core:
    'the COUNT is for the Sm core, seven small proteins shared by U1, U2, U4 and U5. The SIZE is for the '
    + 'assembled spliceosome from 5XJC, which is far larger. Drawn at the assembled size, so this one '
    + 'overstates how much room the counted object takes.',
};
const machineList = machines.ok
  ? (Array.isArray(machines.mod.MACHINES) ? machines.mod.MACHINES : Object.values(machines.mod.MACHINES ?? {}))
  : [];
const byId = new Map(machineList.map((m) => [m.id, m]));
const inventory = counts.ok ? {
  cell_type: counts.mod.DATA.cell_type,
  why_this_cell: counts.mod.DATA.why_hela,
  verdict: counts.mod.DATA.verdict,
  licensed: counts.mod.DATA.licensed,
  calibration: counts.mod.DATA.calibration,
  anchor_selection: counts.mod.DATA.anchor_selection,
  held_out: counts.mod.DATA.held_out,
  table_tests: counts.mod.DATA.protein_abundance.table_tests,
  table_source: counts.mod.DATA.protein_abundance.source,
  absolute_anchor: counts.mod.DATA.absolute_anchor,
  provenance: counts.mod.PROVENANCE,
  refusals: counts.mod.REFUSALS,
  what_would_change: counts.mod.WHAT_WOULD_CHANGE_THESE_NUMBERS,
  transcriptome: counts.mod.DATA.transcriptome,
  drawn: DRAWN.map((m) => {
    const sizeId = SIZE_OF[m];
    const rec = sizeId ? byId.get(sizeId) : null;
    const dim = rec?.dimensions_nm ?? null;
    return {
      machine: m,
      spec: counts.mod.drawingSpec(m),
      size: dim ? {
        from_machine: sizeId,
        name: rec.name,
        max_extent_nm: dim.max_extent_nm,
        principal_extents_nm: dim.principal_extents_nm,
        radius_of_gyration_nm: dim.radius_of_gyration_nm,
        measured_from: dim.from,
        shape_note: dim.shape_note ?? null,
        structure: rec.structure?.primary ?? null,
        caveat: SIZE_CAVEAT[m] ?? null,
      } : null,
      size_absent_reason: dim ? null
        : 'no machine in machines.mjs has this complex measured from deposited coordinates, so it has a measured count and no measured size. Listed, not drawn.',
      what_it_does: rec?.what_it_does ?? null,
      transcript: counts.mod.transcriptShare(m) ?? counts.mod.transcriptShare(
        m === 'ribosome' ? 'ribosome_60s' : m) ?? null,
    };
  }).filter((d) => d.spec.drawable),
} : null;

/* THE SLAB, which is how a sampled population is drawn without lying about density.
 *
 * Drawing 0.7 % of the machines in 100 % of the cell gives a picture of a cell that is 99.3 % empty,
 * and budget.mjs forbids exactly that: the crowding numbers say proteins sit about 8.7 nm apart, which
 * is roughly one protein's width, so clear fluid between sparse dots is not a depiction of cytoplasm.
 *
 * So the sample is drawn at full density in a proportionally small VOLUME instead. Take the same
 * fraction of the cell that is taken of each population, and every local density in the picture is the
 * measured one. The label then names a cube of cytoplasm rather than a cell.
 */
let slab = null;
if (inventory) {
  const drawable = inventory.drawn.filter((d) => d.size);
  const totalMeasured = drawable.reduce((a, d) => a + d.spec.copies_per_cell, 0);
  const BUDGET = 60000;
  const fraction = Math.min(1, BUDGET / totalMeasured);
  const cellVol = budget.ok ? (budget.mod.CELL?.volume?.value ?? null) : null;
  const volume = cellVol === null ? null : cellVol * fraction;
  const side = volume === null ? null : Math.cbrt(volume);
  const members = drawable.map((d) => {
    const n = Math.max(1, Math.round(d.spec.copies_per_cell * fraction));
    // Occupied volume from the three MEASURED principal extents as an ellipsoid, not from a sphere of
    // the maximum extent. The circumscribing sphere overstates every non-spherical object - for the
    // spliceosome by more than twofold - and the anisotropy was measured, so it should be used.
    // An ellipsoid still OVERSTATES, because a molecule is not a filled solid.
    const e = d.size.principal_extents_nm;
    const vol_nm3 = Array.isArray(e) && e.length === 3
      ? (4 / 3) * Math.PI * (e[0] / 2) * (e[1] / 2) * (e[2] / 2)
      : (4 / 3) * Math.PI * (d.size.max_extent_nm / 2) ** 3;
    return {
      machine: d.machine, name: d.size.name, instances: n,
      measured_total: d.spec.copies_per_cell,
      diameter_nm: d.size.max_extent_nm,
      extents_nm: d.size.principal_extents_nm,
      structure: d.size.structure,
      caveat: d.size.caveat,
      what_it_does: d.what_it_does,
      occupied_um3: n * vol_nm3 * 1e-9,
      occupied_volume_basis: Array.isArray(e) && e.length === 3
        ? 'ellipsoid of the three measured principal extents'
        : 'sphere of the measured maximum extent, because principal extents were not recorded',
    };
  });
  const occupied = members.reduce((a, m) => a + m.occupied_um3, 0);
  slab = {
    what_it_is: 'a cube of cytoplasm holding the full measured population of every machine that has both a measured count and a measured size',
    why_a_cube_and_not_a_cell:
      'the same fraction is taken of the volume as of each population, so every local density here is the '
      + 'measured one. Drawing the sample inside a whole cell would show a cell that is 99.3 % empty, which '
      + 'budget.mjs rules out: proteins sit about 8.7 nm apart, roughly one protein wide.',
    fraction_of_a_cell: fraction,
    cell_volume_um3: cellVol,
    volume_um3: volume,
    side_um: side,
    instances: members.reduce((a, m) => a + m.instances, 0),
    machine_count: members.length,
    members,
    measured_population_represented: totalMeasured,
    occupied_volume_um3: occupied,
    occupied_volume_fraction: volume ? occupied / volume : null,
    occupied_volume_is_an_overestimate:
      'each machine is counted as a filled ellipsoid of its measured principal extents. A molecule is not '
      + 'a filled solid, so this is an upper bound on how much room these six take.',
    occupied_fraction_check: budget.ok ? {
      all_protein_fraction: budget.mod.CROWDING_AS_VOLUME_FRACTION ?? null,
      what_the_comparison_means:
        'these six machines should occupy a SMALL part of the total protein volume fraction, because they '
        + 'are six complexes out of a whole proteome. If they came out near or above the total, something '
        + 'is wrong with a count or a size.',
    } : null,
    not_drawn: inventory.drawn.filter((d) => !d.size).map((d) => ({
      machine: d.machine, copies_per_cell: d.spec.copies_per_cell, why: d.size_absent_reason,
    })),
    positions: 'DEPICTED. Positions are random within the cube with no overlap rejection and no physics. Only the counts, the sizes and therefore the density are measured.',
  };
}

// ---------------------------------------------------------------- the measured divisions
const divPath = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/embryo/embryo-divisions.json');
let measuredDivisions = null;
if (fs.existsSync(divPath)) {
  const d = JSON.parse(fs.readFileSync(divPath, 'utf8'));
  measuredDivisions = {
    file: 'embryo/embryo-divisions.json',
    events: d.division_events_usable,
    events_total: d.division_events_total,
    events_suspect: d.division_events_suspect,
    suspect_frames: d.suspect_frames,
    suspect_rule: d.suspect_rule,
    what_the_old_export_could_draw: d.what_the_old_export_could_draw,
    what_the_old_export_could_draw_why: d.what_the_old_export_could_draw_why,
    source: d.source,
    scale: d.scale,
    sigma_for_drawing: d.sigma_for_drawing,
    calibration: d.calibration,
    regularisation_floor: d.regularisation_floor,
    posterior_equals_prior: d.posterior_equals_prior,
    geometry: d.geometry,
    result: divisions.ok ? divisions.mod.RESULT : null,
    not_modelled: divisions.ok ? divisions.mod.WHAT_THIS_DOES_NOT_MODEL : null,
    normalisation: d.normalisation,
  };
} else {
  absent.push({ module: 'embryo-divisions.json', why: 'not built; run sim-engine/scales/atlas/embryo-divisions.mjs' });
}

// ---------------------------------------------------------------- the cleavage level, from the .life file
const lifePath = path.join(ROOT, 'organism-format/life/examples/mouse-preimplantation.life');
let cleavage = null, cleavageError = null;
try {
  const life = JSON.parse(fs.readFileSync(lifePath, 'utf8'));
  const stages = life.timeline.stages.map(s => ({
    id: s.id, name: s.name ?? s.id, time: s.time ?? null, time_unit: s.time_unit ?? null,
    temperature_C: s.temperature_C ?? null,
    provenance: s.geometry?.provenance?.kind ?? null,
    cells: s.geometry.cells.map(c => ({
      id: c.id,
      centre: c.channels.geometry.centre,
      radius: c.channels.geometry.radius,
      exposed_surface_area: c.channels.geometry.exposed_surface_area ?? null,
    })),
  }));
  const plan = DIV.plan(stages);
  cleavage = {
    source_file: 'organism-format/life/examples/mouse-preimplantation.life',
    organism: life.describes_organism ?? life.identity ?? null,
    stages,
    plan: {
      steps: plan.steps.map(s => ({
        from: s.from, to: s.to, parents: s.parents, daughters: s.daughters,
        lineage_animatable: s.pairing.balanced,
        why_not: s.pairing.why_not,
        pairs: s.pairing.balanced ? s.pairing.pairs : null,
        volume_ratio: s.volume_ratio, volume_conserved: s.volume_conserved,
        from_time: s.from_time, to_time: s.to_time, time_unit: s.time_unit,
        packing_to: {
          overlapping: s.packing_to.overlapping, pairs: s.packing_to.pairs,
          fraction: s.packing_to.fraction_of_pairs_overlapping,
          worst: s.packing_to.worst_overlap_fraction,
        },
      })),
      all_balanced: plan.all_balanced,
      unbalanced_steps: plan.unbalanced_steps,
      any_interpenetration: plan.any_interpenetration,
    },
    packing_impossibility: {
      claim: DIV.THE_PACKING_IMPOSSIBILITY.claim,
      max_packing_fraction: DIV.THE_PACKING_IMPOSSIBILITY.max_packing_fraction_infinite,
      source: DIV.THE_PACKING_IMPOSSIBILITY.max_packing_fraction_source,
      envelope_growth_required: DIV.THE_PACKING_IMPOSSIBILITY.envelope_growth_required(2),
      options: DIV.THE_PACKING_IMPOSSIBILITY.the_three_options,
      what_the_embryo_does: DIV.THE_PACKING_IMPOSSIBILITY.what_the_embryo_actually_does,
    },
    provenance: DIV.PROVENANCE,
    not_modelled: DIV.WHAT_THIS_DOES_NOT_MODEL,
  };
} catch (e) { cleavageError = String(e.message).slice(0, 200); }

// ---------------------------------------------------------------- the measured embryo, from IDR
const embryoDir = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/embryo');
let measuredEmbryo = null;
try {
  const man = JSON.parse(fs.readFileSync(path.join(embryoDir, 'embryo-manifest.json'), 'utf8'));
  const tracks = JSON.parse(fs.readFileSync(path.join(embryoDir, 'embryo-tracks.json'), 'utf8')).tracks;
  const withParent = tracks.filter(t => t.parent_track !== null && t.parent_track !== undefined);
  const ids = new Set(tracks.map(t => t.id));
  const resolvable = withParent.filter(t => ids.has(t.parent_track));
  // A division we can actually DRAW needs the parent track present too, so we know where it came from.
  const events = resolvable.map(t => {
    const parent = tracks.find(p => p.id === t.parent_track);
    const fi = parent.frames.indexOf(t.birth_frame - 1);
    return {
      frame: t.birth_frame,
      elapsed_h: +(t.birth_frame * man.frame_interval_s / 3600).toFixed(3),
      parent_track: t.parent_track, daughter_track: t.id,
      parent_xyz: fi >= 0 ? parent.xyz[fi] : null,
      daughter_xyz: t.xyz[0] ?? null,
    };
  }).filter(e => e.parent_xyz && e.daughter_xyz);
  measuredEmbryo = {
    cloud_url: '../embryo/embryo-cloud.f16',
    tracks_url: '../embryo/embryo-tracks.json',
    manifest: {
      source: man.source, frames: man.frames, frame_interval_s: man.frame_interval_s,
      coordinates: man.coordinates, clock: man.clock, covers: man.covers,
      tracks: man.tracks, cloud: { file: man.cloud.file, points: man.cloud.points, layout: man.cloud.layout },
      index: man.cloud.index,
    },
    per_frame_counts: man.per_frame.counts,
    division_events: events,
    division_events_note:
      `${tracks.length} tracks survive the minimum-length filter; ${withParent.length} of them record a parent, ` +
      `but only ${resolvable.length} have that parent ALSO in the file, because the filter severed the rest. ` +
      `So ${events.length} division(s) can be drawn as measured events. The filter, not the data, is the limit: ` +
      `a re-export keeping short tracks would recover far more.`,
    count_growth: {
      first: man.per_frame.counts[0],
      last: man.per_frame.counts[man.per_frame.counts.length - 1],
      note: 'the detected-cell count rises over the recording. That rise IS division happening, but a count ' +
        'is not an event: without lineage links it says that cells divided, not which ones.',
    },
  };
} catch (e) { measuredEmbryo = { error: String(e.message).slice(0, 200) }; }

// ---------------------------------------------------------------- molecular levels, when present
const molecular = {
  machines: machines.ok ? (machines.mod.MACHINES ?? null) : null,
  size_ladder: machines.ok && machines.mod.sizeLadder ? machines.mod.sizeLadder() : null,
  what_a_depiction_cannot_show: machines.ok ? (machines.mod.WHAT_A_DEPICTION_CANNOT_SHOW ?? null) : null,
  chromatin_levels: chromatin.ok ? (chromatin.mod.LEVELS ?? null) : null,
  chromatin_citations: chromatin.ok ? (chromatin.mod.CITATIONS ?? null) : null,
  genome: chromatin.ok ? (chromatin.mod.GENOME ?? null) : null,
  thirty_nm_problem: chromatin.ok ? (chromatin.mod.THE_THIRTY_NANOMETRE_PROBLEM ?? null) : null,
  rates: dynamics.ok ? (dynamics.mod.RATES ?? null) : null,
  durations: dynamics.ok ? (dynamics.mod.DURATIONS ?? null) : null,
  origin_argument: dynamics.ok ? (dynamics.mod.THE_ORIGIN_ARGUMENT ?? null) : null,
  animation_honesty: dynamics.ok ? (dynamics.mod.ANIMATION_HONESTY ?? null) : null,
  cell: budget.ok ? (budget.mod.CELL ?? null) : null,
  crowding: budget.ok ? (budget.mod.CROWDING ?? null) : null,
  crowding_volume_fraction: budget.ok ? (budget.mod.CROWDING_AS_VOLUME_FRACTION ?? null) : null,
  protein_spacing: budget.ok ? (budget.mod.PROTEIN_SPACING ?? null) : null,
  // budget.mjs reports that the sourced cell volume and the sourced nuclear volume are not mutually
  // consistent. A viewer that draws both without saying so is asserting a cell that does not add up.
  cell_self_consistency: budget.ok && /NOT self-consistent/.test(String(budget.mod.worked?.() ?? ''))
    ? 'The sourced cell volume and the sourced nuclear volume are NOT self-consistent with each other: '
      + 'they come from different compilations, and the nucleus drawn here is the one the nuclear-volume '
      + 'source implies, not one derived from the cell. budget.mjs flags this rather than reconciling it.'
    : null,
  dna_in_the_nucleus: budget.ok ? (budget.mod.DNA_IN_THE_NUCLEUS ?? null) : null,
  what_this_rules_out: budget.ok ? (budget.mod.WHAT_THIS_RULES_OUT ?? null) : null,
  provenance_kinds: prov.ok ? (prov.mod.KINDS ?? null) : null,
  provenance_rule: prov.ok ? (prov.mod.THE_RULE ?? null) : null,
};

// ---------------------------------------------------------------- the levels the viewer offers
const LEVELS = [
  { id: 'embryo-measured', label: 'Embryo, measured', metres: 5e-4, available: !!(measuredEmbryo && !measuredEmbryo.error),
    one_line: 'real cell positions tracked over 17.5 hours of development', kind: 'MEASURED' },
  { id: 'divisions-measured', label: 'Cleavage, measured', metres: 2e-4, available: !!measuredDivisions,
    one_line: `${measuredDivisions?.events ?? 0} real parent-and-two-daughter events, at their measured separations`,
    kind: 'MEASURED' },
  { id: 'cleavage', label: 'Cleavage, solved', metres: 8e-5, available: !!cleavage,
    one_line: 'one cell becoming sixteen, with volume conserved at every instant', kind: 'DEPICTED' },
  { id: 'cell', label: 'A single cell', metres: 2e-5, available: !!molecular.cell,
    one_line: 'the volume everything else has to fit inside', kind: 'MEASURED' },
  { id: 'nucleus', label: 'Nucleus and chromatin', metres: 6e-6, available: !!molecular.chromatin_levels,
    one_line: 'two metres of DNA in a nucleus a few microns across', kind: 'MEASURED' },
  { id: 'fibre', label: 'The chromatin fibre', metres: 3e-8, available: !!molecular.chromatin_levels,
    one_line: 'nucleosomes, and the fibre that may not exist', kind: 'CONTESTED' },
  { id: 'crowd', label: 'The crowd, counted', metres: slab?.side_um ? slab.side_um * 1e-6 : 1e-7,
    available: !!(slab && slab.instances),
    one_line: slab
      ? `every machine in a ${slab.side_um.toFixed(2)} um cube, at the measured density - ${slab.instances.toLocaleString('en-GB')} of them`
      : 'the measured population of one cell', kind: 'MEASURED' },
  { id: 'machines', label: 'Molecular machines', metres: 2e-8, available: !!molecular.machines,
    one_line: 'ribosomes, polymerases, drawn at their measured sizes', kind: 'MEASURED' },
];

const bundle = {
  what_this_is:
    'a continuous zoom from a tracked embryo down to a single molecular machine. The POSITIONS at the ' +
    'molecular end are invented - there is no simulation of physics here - but every size, count, rate ' +
    'and spacing is a measured value with a source, so what is drawn correctly is separable from what ' +
    'is drawn merely plausibly.',
  the_honest_header:
    'Two different kinds of picture are stitched together here. The embryo is a MEASUREMENT: those are ' +
    'real tracked cells from a published light-sheet dataset. Everything from the cell inwards is a ' +
    'DEPICTION built to measured dimensions. The viewer marks which is which at every level, because ' +
    'the two look equally convincing and are not equally trustworthy.',
  levels: LEVELS,
  cleavage, cleavage_error: cleavageError,
  measured_embryo: measuredEmbryo,
  measured_divisions: measuredDivisions,
  inventory, slab,
  molecular,
  modules_absent: absent,
  built: '2026-11-08',
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(bundle, null, 1));

console.log(`levels: ${LEVELS.filter(l => l.available).length}/${LEVELS.length} available`);
for (const l of LEVELS) console.log(`  ${l.available ? 'ok ' : '-- '} ${l.id.padEnd(18)} ${l.one_line}`);
if (cleavage) console.log(`cleavage: ${cleavage.stages.length} stages, ${cleavage.plan.steps.length} divisions, ${cleavage.plan.unbalanced_steps.length} not lineage-animatable`);
if (measuredEmbryo && !measuredEmbryo.error) console.log(`measured embryo: ${measuredEmbryo.manifest.frames} frames, ${measuredEmbryo.division_events.length} drawable division events, counts ${measuredEmbryo.count_growth.first} -> ${measuredEmbryo.count_growth.last}`);
if (absent.length) console.log(`absent modules: ${absent.map(a => a.module.split('/').pop()).join(', ')}`);
console.log(`written to ${path.relative(ROOT, OUT).split(path.sep).join('/')} (${fs.statSync(OUT).size} bytes)`);
