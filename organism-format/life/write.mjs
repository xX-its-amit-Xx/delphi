// Build a .life document, with provenance required at construction rather than checked afterwards.
//
// The .organism writer learned this the hard way: a value of the shape {v: 0.31, unknown: true} slipped
// past every provenance check downstream, because the checks ran on a document that had already been
// built. The fix is to make the invalid document hard to construct in the first place, so the builders
// here take `kind` and `scope` as REQUIRED arguments and throw without them.
//
// Throwing is the right behaviour for a writer and the wrong behaviour for a reader. read.mjs returns a
// structured refusal for a bad file it is handed, because a file that exists must be describable. This
// module refuses to create one, because nothing is lost by failing early.

import { FORMAT, STAGE_REQUIRED, TIME_UNITS, CHANNELS, NOT_ESTABLISHED_MINIMUM, REQUIRED_TOP_LEVEL } from './spec.mjs';

const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed', 'depicted'];

/** A value with provenance. There is no other kind of value in a .life. */
export function value({ v, unit = null, kind, source = null, scope, note = null }) {
  if (kind === undefined || !KINDS.includes(kind)) throw new Error(`value: kind must be one of ${KINDS.join('|')}, got ${JSON.stringify(kind)}`);
  if (!scope) throw new Error('value: scope is required - a number with no stated scope is a number about nothing');
  if (v === undefined || v === null) throw new Error('value: no value. Use unknown() instead, which is a different claim');
  if (!Number.isFinite(v) && typeof v !== 'string' && typeof v !== 'boolean') throw new Error(`value: ${JSON.stringify(v)} is not a value`);
  if ((kind === 'measured' || kind === 'measured-secondhand') && !source) throw new Error('value: a measured value must carry its source, or it is not measured');
  if (kind === 'calibrated' && !note) throw new Error('value: a calibrated value must state the measurement it was fitted to');
  return { v, unit, kind, source, scope, note };
}

/** Not established. Carries no value at all - that is the whole point, and the reader enforces it. */
export function unknown({ why, searched = null, what_would_resolve_it = null, scope }) {
  if (!why) throw new Error('unknown: why is required - "unknown" without a reason is indistinguishable from "not looked at"');
  if (!scope) throw new Error('unknown: scope is required');
  return { unknown: true, why, searched, what_would_resolve_it, scope };
}

/** A cell, with whatever channels were actually measured on it. Declaring a channel is not measuring it. */
export function cell({ id, channels = {} }) {
  if (!id) throw new Error('cell: id is required - a cell with no id cannot be tracked between stages, which is most of what a trajectory is for');
  for (const name of Object.keys(channels)) {
    if (!CHANNELS[name]) throw new Error(`cell ${id}: unknown channel "${name}". Known: ${Object.keys(CHANNELS).join(', ')}`);
  }
  const g = channels.geometry;
  if (g) {
    if (!Array.isArray(g.centre) || g.centre.length !== 3 || !g.centre.every(Number.isFinite)) throw new Error(`cell ${id}: geometry.centre must be three finite numbers`);
    if (!(Number.isFinite(g.radius) && g.radius > 0)) throw new Error(`cell ${id}: geometry.radius must be positive - a cell of zero radius cannot be rendered and is not a cell`);
  }
  const m = channels.mechanics;
  if (m && !m.method) throw new Error(`cell ${id}: mechanics without a method. An inferred modulus and an AFM modulus differ by more than their error bars`);
  const t = channels.transcriptome;
  if (t && typeof t.in_situ !== 'boolean') throw new Error(`cell ${id}: transcriptome must say whether it was measured in situ. A dissociated transcriptome has thrown away the neighbour relations a multicellularity claim is about`);
  return { id, channels };
}

/** A stage: pinned in time and in condition, with geometry whose provenance is stated. */
export function stage({ id, name, time, time_unit, temperature_C, cells = [], geometry_provenance, units = 'um', phenotype = {}, observed = true, note = null }) {
  for (const k of STAGE_REQUIRED) {
    const got = { id, name, time, time_unit, temperature_C }[k];
    if (got === undefined || got === null || got === '') throw new Error(`stage: ${k} is required (${STAGE_REQUIRED.join(', ')})`);
  }
  if (!TIME_UNITS.includes(time_unit)) throw new Error(`stage ${id}: unknown time_unit "${time_unit}". Known: ${TIME_UNITS.join(', ')}`);
  if (!Number.isFinite(temperature_C)) throw new Error(`stage ${id}: temperature_C must be a number - development rate is temperature-dependent, so a stage time without a temperature is not a stage`);
  if (cells.length && !geometry_provenance) throw new Error(`stage ${id}: cells were given with no geometry_provenance. A mesh loses its provenance the moment it leaves the file, so it must be stated here`);
  if (geometry_provenance && !KINDS.includes(geometry_provenance.kind)) throw new Error(`stage ${id}: geometry_provenance.kind must be one of ${KINDS.join('|')}`);
  return {
    id, name, time, time_unit, temperature_C, observed, note,
    geometry: cells.length || geometry_provenance ? { provenance: geometry_provenance ?? null, units, cells } : null,
    phenotype,
  };
}

/**
 * The document. `not_established` is required and is checked against NOT_ESTABLISHED_MINIMUM, because a
 * file that lists nothing it does not know is making the strongest possible claim by omission.
 */
export function life({ identity, genome, stages, provenance, not_established, describes_organism = null }) {
  if (!identity?.id) throw new Error('life: identity.id is required');
  if (!genome) throw new Error('life: genome is required - a trajectory with no genome cannot be compared to anything');
  if (!Array.isArray(stages) || !stages.length) throw new Error('life: at least one stage');
  if (!provenance) throw new Error('life: provenance block is required');
  if (!Array.isArray(not_established)) throw new Error('life: not_established must be an array, even if you think it is empty');

  const ids = new Set();
  for (const s of stages) {
    if (ids.has(s.id)) throw new Error(`life: duplicate stage id "${s.id}"`);
    ids.add(s.id);
  }
  // order is checked here too, and NOT fixed: a timeline out of order is a defect in whoever wrote it
  const units = new Set(stages.map(s => s.time_unit));
  if (units.size === 1) {
    for (let i = 1; i < stages.length; i++) {
      if (!(stages[i].time > stages[i - 1].time)) {
        throw new Error(`life: stage "${stages[i].id}" at ${stages[i].time} does not follow "${stages[i - 1].id}" at ${stages[i - 1].time}. Fix the order rather than relying on a sort, which would hide it`);
      }
    }
  }
  const missing = NOT_ESTABLISHED_MINIMUM.filter(m => !not_established.some(e => String(e.what ?? e).toLowerCase().includes(m.split(' ')[1] ?? m)));
  const doc = {
    format: FORMAT,
    identity, describes_organism, genome,
    timeline: { stages, time_units: [...units] },
    provenance, not_established,
    built_by: 'organism-format/life/write.mjs',
  };
  for (const k of REQUIRED_TOP_LEVEL) if (!(k in doc)) throw new Error(`life: missing required top-level "${k}"`);
  if (missing.length) doc.not_established_incomplete = missing;
  return doc;
}

export const WHY_THIS_THROWS =
  'a writer that accepts a bad document produces a file that outlives the session that made it. A reader ' +
  'must describe any file it is handed, because the file already exists; a writer has nothing to lose by ' +
  'refusing. The .organism writer learned this from a value of the shape {v, unknown: true}, which passed ' +
  'every downstream provenance check because it was built before anything checked it.';
