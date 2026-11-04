// What an illustration mesh is built FROM, and the hash that names it.
//
// A mesh spec is the small, deterministic description that build_mesh.py turns into one GLB: which frame's
// sculptor to run, which life-stage forms to sculpt, and which declared numbers (if any) drive geometry.
// It deliberately does NOT carry which slots a ladder has. The whole frame library is sculpted every time,
// and the PAGE decides per ladder whether a slot is present, a ghost or absent. So two generations of one
// run that declare the same stages share one GLB, and a generation that gains or loses a part never
// triggers a rebuild.
//
// EVERY MESH IS AN ILLUSTRATION. A stage form (larva, pupa, neonate, stationary phase...) is a textbook
// schematic picked by the stage NAME the design declares. Nothing is interpolated between stages and
// development is not simulated; the page applies the declared length_ratio on top of the sculpt, so stage
// size differences are never baked in here.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

/** Bump the semver when the spec or the GLB contract changes shape. The source digest is appended per frame. */
export const GENERATOR_SEMVER = '0.1.0';

/** Frames that have a sculptor under frames/. Any other frame gets no mesh, and the page says so. */
export const SCULPTED = ['insect', 'tetrapod', 'prokaryote', 'construct'];

export const THIS_IS_NOT_MORPHOMETRY = 'This mesh is an ILLUSTRATION sculpted in Blender from textbook body plans. No shape, size, ' +
  'proportion or position in it was measured from any specimen; slot positions come from sim-engine/scales/body-frames.json, ' +
  'which are themselves declared. A stage form is a textbook schematic chosen by the stage name the design declares: nothing ' +
  'is interpolated between stages and development is not simulated. Never read a dimension off it.';

// Stage key by keyword on the DECLARED stage label, per frame. First match wins, so order matters
// ("pupa" must be tested before a looser larval word could claim "prepupal larva").
const RULES = {
  insect: [[/\b(egg|embryo)/i, 'egg'], [/pupa|pupal/i, 'pupa'], [/larva|instar/i, 'larva'], [/adult|imago/i, 'adult']],
  tetrapod: [[/neonate|newborn|\bpups?\b/i, 'neonate'], [/juvenile|weanling/i, 'juvenile'], [/adult/i, 'adult']],
  prokaryote: [[/\blag\b/i, 'lag'], [/exponential|growing|\blog\b/i, 'growing'], [/stationary/i, 'stationary']],
  construct: [],
};
const DEFAULT_KEY = { insect: 'adult', tetrapod: 'adult', prokaryote: 'growing', construct: 'default' };

/** The stage keys a frame's sculptor knows how to make, in a sensible display order. */
export const STAGE_KEYS = {
  insect: ['egg', 'larva', 'pupa', 'adult'],
  tetrapod: ['neonate', 'juvenile', 'adult'],
  prokaryote: ['lag', 'growing', 'stationary'],
  construct: ['default'],
};

/** Map one declared stage label to a stage key for a frame, with the reason. */
export function stageKeyFor(frame, label) {
  const def = DEFAULT_KEY[frame] ?? 'default';
  if (frame === 'construct') return { key: 'default', matched_by: 'a construct has one form: its own declaration disowns a life cycle, so every label maps to "default"' };
  for (const [re, key] of RULES[frame] ?? []) if (re.test(String(label ?? ''))) return { key, matched_by: `keyword ${re} on the declared label "${label}"` };
  return { key: def, matched_by: `no keyword for the ${frame} frame matches the declared label "${label}", so it maps to the frame's default form "${def}"`, unmatched: true };
}

// The generator version is the semver plus a digest of the sources that shape this frame's geometry, so a
// sculptor's edit invalidates exactly that frame's cache and nothing else. Line endings are normalised, so
// a checkout with CRLF and one with LF agree.
const digestCache = new Map();
export function generatorVersion(frame) {
  if (digestCache.has(frame)) return digestCache.get(frame);
  const h = crypto.createHash('sha256');
  for (const f of ['build_mesh.py', 'lib.py', path.join('frames', `${frame}.py`)]) {
    const p = path.join(HERE, f);
    h.update(f.replace(/\\/g, '/') + '\n');
    h.update(fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '<missing>');
  }
  const v = `${GENERATOR_SEMVER}+${h.digest('hex').slice(0, 8)}`;
  digestCache.set(frame, v);
  return v;
}

/**
 * The mesh spec for one ladder.
 * @returns {{frame, sculpted, generator_version, stages:[{key,label,age_days,matched_by}], drivers, driver_notes, stage_of_point, notes}}
 */
export function meshSpec(ladder) {
  const frame = ladder?.frame?.name ?? 'unknown';
  const sculpted = SCULPTED.includes(frame);
  const points = ladder?.timeline?.points ?? [];
  const notes = [];
  const stages = [];
  const stage_of_point = [];
  for (const p of points) {
    const m = stageKeyFor(frame, p.stage);
    stage_of_point.push(m.key);
    if (m.unmatched) notes.push(m.matched_by);
    if (!stages.some(s => s.key === m.key)) stages.push({ key: m.key, label: p.stage ?? null, age_days: p.age_days ?? null, matched_by: m.matched_by });
  }
  if (!stages.length) {
    const key = DEFAULT_KEY[frame] ?? 'default';
    stages.push({ key, label: null, age_days: null, matched_by: `the design declares no life stage, so the ${frame} frame's default form "${key}" is drawn` });
  }
  // Order the forms the way the frame lists them, so a spec does not depend on declaration order.
  const order = STAGE_KEYS[frame] ?? [];
  stages.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  // DRIVERS: a declared number that sizes geometry. None of the four frames has one yet that can be applied
  // honestly, and each case is written down rather than silently ignored.
  const drivers = {};
  const driver_notes = [];
  const aq = ladder?.available_quantities ?? {};
  if (frame === 'tetrapod' && aq.liftingArea_m2) {
    const hasLength = points.some(p => p.length_m != null) || aq.SL_m;
    if (!hasLength) driver_notes.push('liftingArea_m2 is declared, but no body length is, so the area cannot be expressed in body lengths: the wing_membrane is drawn at schematic proportions, not sized by the declared area.');
    else driver_notes.push('liftingArea_m2 and a body length are both declared, but this generator version does not yet size the wing_membrane from them: proportions are schematic.');
  }
  return {
    frame, sculpted, generator_version: sculpted ? generatorVersion(frame) : null,
    stages, drivers, driver_notes, stage_of_point, notes,
    geometry_basis: 'schematic-illustration', THIS_IS_NOT_MORPHOMETRY,
  };
}

/** Canonical JSON: keys sorted at every depth, so the hash never depends on insertion order. */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** The geometry-affecting part of a spec: frame, stage keys, drivers, generator version. Labels and ages are not. */
export function hashInput(spec) {
  return { frame: spec.frame, generator_version: spec.generator_version, stages: spec.stages.map(s => s.key), drivers: spec.drivers ?? {} };
}

/** sha256 of the canonical JSON of the geometry-affecting fields, first 12 hex. */
export function specHash(spec) {
  return crypto.createHash('sha256').update(canonical(hashInput(spec))).digest('hex').slice(0, 12);
}

/** The file stem a spec builds to: <frame>-<hash>. */
export const meshStem = spec => `${spec.frame}-${specHash(spec)}`;
