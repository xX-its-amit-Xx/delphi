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

const absent = [];
for (const [name, m] of Object.entries({ machines, chromatin, dynamics, budget, provenance: prov })) {
  if (!m.ok) absent.push({ module: `sim-engine/scales/molecular/${name}.mjs`, why: m.why });
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
  genome: chromatin.ok ? (chromatin.mod.GENOME ?? null) : null,
  thirty_nm_problem: chromatin.ok ? (chromatin.mod.THE_THIRTY_NANOMETRE_PROBLEM ?? null) : null,
  rates: dynamics.ok ? (dynamics.mod.RATES ?? null) : null,
  durations: dynamics.ok ? (dynamics.mod.DURATIONS ?? null) : null,
  origin_argument: dynamics.ok ? (dynamics.mod.THE_ORIGIN_ARGUMENT ?? null) : null,
  animation_honesty: dynamics.ok ? (dynamics.mod.ANIMATION_HONESTY ?? null) : null,
  cell: budget.ok ? (budget.mod.CELL ?? null) : null,
  crowding: budget.ok ? (budget.mod.CROWDING ?? null) : null,
  dna_in_the_nucleus: budget.ok ? (budget.mod.DNA_IN_THE_NUCLEUS ?? null) : null,
  what_this_rules_out: budget.ok ? (budget.mod.WHAT_THIS_RULES_OUT ?? null) : null,
  provenance_kinds: prov.ok ? (prov.mod.KINDS ?? null) : null,
  provenance_rule: prov.ok ? (prov.mod.THE_RULE ?? null) : null,
};

// ---------------------------------------------------------------- the levels the viewer offers
const LEVELS = [
  { id: 'embryo-measured', label: 'Embryo, measured', metres: 5e-4, available: !!(measuredEmbryo && !measuredEmbryo.error),
    one_line: 'real cell positions tracked over 17.5 hours of development', kind: 'MEASURED' },
  { id: 'cleavage', label: 'Cleavage', metres: 8e-5, available: !!cleavage,
    one_line: 'one cell becoming sixteen, with volume conserved at every instant', kind: 'DEPICTED' },
  { id: 'cell', label: 'A single cell', metres: 2e-5, available: !!molecular.cell,
    one_line: 'the volume everything else has to fit inside', kind: 'MEASURED' },
  { id: 'nucleus', label: 'Nucleus and chromatin', metres: 6e-6, available: !!molecular.chromatin_levels,
    one_line: 'two metres of DNA in a nucleus a few microns across', kind: 'MEASURED' },
  { id: 'fibre', label: 'The chromatin fibre', metres: 3e-8, available: !!molecular.chromatin_levels,
    one_line: 'nucleosomes, and the fibre that may not exist', kind: 'CONTESTED' },
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
  molecular,
  modules_absent: absent,
  built: '2026-11-07',
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(bundle, null, 1));

console.log(`levels: ${LEVELS.filter(l => l.available).length}/${LEVELS.length} available`);
for (const l of LEVELS) console.log(`  ${l.available ? 'ok ' : '-- '} ${l.id.padEnd(18)} ${l.one_line}`);
if (cleavage) console.log(`cleavage: ${cleavage.stages.length} stages, ${cleavage.plan.steps.length} divisions, ${cleavage.plan.unbalanced_steps.length} not lineage-animatable`);
if (measuredEmbryo && !measuredEmbryo.error) console.log(`measured embryo: ${measuredEmbryo.manifest.frames} frames, ${measuredEmbryo.division_events.length} drawable division events, counts ${measuredEmbryo.count_growth.first} -> ${measuredEmbryo.count_growth.last}`);
if (absent.length) console.log(`absent modules: ${absent.map(a => a.module.split('/').pop()).join(', ')}`);
console.log(`written to ${path.relative(ROOT, OUT).split(path.sep).join('/')} (${fs.statSync(OUT).size} bytes)`);
