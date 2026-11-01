// The ORGANISM DOCUMENT: what an agent or a human edits in the Design Studio.
//
//   { id, base: { parents: [{ organism, weight }] },
//     edits: [{ target: { level, id }, param, op: 'set'|'scale'|'add', value, author, reason, ts }],
//     notes }
//
// Pure ESM with no node-only imports: dashboard/build-engine.mjs copies this file into the browser
// engine unchanged. Every function takes the DATA BUNDLE (sim-engine/lib/data-node.mjs) as an
// argument rather than reading files.
//
// The generative model is the parametric one (anatomy-model/parametric/design-schema.json):
// parameters = SUM w_i * parent_i + edits. THE HARD CAVEAT from that schema travels with every
// resolved document: this is MORPHOLOGICAL interpolation, not genetic hybridisation.

import * as PE from './partedit-link.mjs';

export const LEVELS = ['body', 'system', 'organ', 'tissue', 'cell', 'gene'];
export const OPS = ['set', 'scale', 'add'];
export const HARD_CAVEAT = 'MORPHOLOGICAL interpolation, not genetic hybridisation (anatomy-model/parametric/design-schema.json): a blended or edited parameter set is a shape, not an organism; it says nothing about whether such an animal could be bred, is viable, or is developmentally reachable.';

// State fields an edit may override directly (body level, or the organ/tissue that owns them).
export const STATE_OVERRIDES = {
  body_density_kg_m3: { unit: 'kg/m3', owners: ['body'] },
  red_muscle_fraction: { unit: '- (of myotomal muscle mass)', owners: ['body', 'muscle_L', 'muscle_R'] },
  gill_area_m2: { unit: 'm2 (both sides)', owners: ['body', 'gills_L', 'gills_R'] },
  hb_P50_kPa: { unit: 'kPa', owners: ['body'] },
  has_swimbladder: { unit: 'bool', owners: ['body', 'swim_bladder'], boolean: true },
};
// Parameters the generator uses for mesh resolution only; not biology, not editable.
const NOT_EDITABLE = new Set(['mesh_detail']);

// Author labels are ROLES, never personal identifiers: 'human', 'agent:physics', 'agent:viz'.
export const ROLE_RE = /^[a-z][a-z0-9_-]{0,30}(:[a-z0-9_.-]{1,40}){0,3}$/;
export function checkAuthor(author) {
  if (typeof author !== 'string' || !ROLE_RE.test(author))
    throw new Error(`author must be a role label such as 'human' or 'agent:physics' (lower case, no names, no e-mail): got ${JSON.stringify(author)}`);
  return author;
}

const KIND_MAP = { measured: 'measured', derived: 'derived', assumed: 'assumed', hypothetical: 'assumed', secondary: 'measured-secondhand',
  'measured-secondhand': 'measured-secondhand', borrowed: 'borrowed', calibrated: 'calibrated', proxy: 'borrowed', tuned: 'calibrated' };
export const KIND_ORDER = ['assumed', 'borrowed', 'measured-secondhand', 'calibrated', 'derived', 'measured'];
export const mapKind = k => KIND_MAP[k] || 'assumed';
export const weakest = (...ks) => KIND_ORDER.find(k => ks.flat().includes(k)) || 'assumed';

// ---------------------------------------------------------------- base organisms
function organismOrThrow(bundle, id) {
  const o = bundle.organisms[id];
  if (!o) throw new Error(`unknown organism "${id}"; known: ${Object.keys(bundle.organisms).join(', ')}`);
  return o;
}

/** Reduce a parent list (which may name designs) to reference organisms with weights. */
export function leaves(bundle, parents, w = 1, out = {}) {
  for (const p of parents) {
    const o = organismOrThrow(bundle, p.organism);
    if (o.kind === 'reference') out[o.id] = (out[o.id] || 0) + w * p.weight;
    else leaves(bundle, o.parents, w * p.weight, out);
  }
  return out;
}

export function parameterNames(bundle) {
  return Object.keys(bundle.organisms['zebrafish-adult'].parameters).filter(k => !NOT_EDITABLE.has(k));
}

/** The manifests behind a document, primary (first parent's) first. A design without its own manifest
 *  falls back to its first parent's. Bundle manifest type (one shape, node and browser):
 *  { file, objects:[{object, label, level, layer, organ_system, organ_system_id, ontology_id, zfa_id, side,
 *    driven_by_parameters}], parameters:{standard_length_m}, units_and_axes, derived_from_the_mesh } */
export function manifestsOf(bundle, doc) {
  const out = [];
  for (const p of doc.base.parents) {
    let o = organismOrThrow(bundle, p.organism);
    while (!o.manifest && o.parents) o = organismOrThrow(bundle, o.parents[0].organism);
    const m = bundle.manifests[o.manifest];
    if (!m || !Array.isArray(m.objects)) throw new Error(`bundle manifest "${o.manifest}" is missing or not {objects:[...]} (rebuild the bundle: node dashboard/build-engine.mjs)`);
    if (!out.includes(m)) out.push(m);
  }
  return out;
}
export const primaryManifest = (bundle, doc) => manifestsOf(bundle, doc)[0];

/** All parts the document's parents carry (union of their manifests), by part id (= GLB object name). */
export function partsOf(bundle, doc) {
  const parts = new Map();
  for (const m of manifestsOf(bundle, doc)) for (const o of m.objects) if (!parts.has(o.object)) parts.set(o.object, { ...o, id: o.object, driven_by_parameters: o.driven_by_parameters || [] });
  return parts;
}

// ---------------------------------------------------------------- targets and editable params
function systemsOf(parts, bundle) {
  const s = new Map();
  for (const p of parts.values()) {
    const key = p.organ_system_id || p.organ_system;
    if (!s.has(key)) s.set(key, { id: key, label: p.organ_system, parts: [] });
    s.get(key).parts.push(p.id);
  }
  for (const t of bundle.terms) if (t.level === 'organ_system' && !s.has(t.id)) s.set(t.id, { id: t.id, label: t.label, parts: [] });
  return s;
}

/** Resolve a target, or throw if the id is unknown. Mesh targets (system, organ, tissue) go through
 *  partedit.js resolveTarget, so the ids accepted here are exactly the ones the browser accepts: an object
 *  name, a bilateral base name ('pectoral_fin' -> _L + _R) or an ontology id (':' or '_'). An ontology term
 *  from data.json with no mesh part is accepted as recorded-only. */
export function resolveTarget(bundle, doc, target) {
  if (!target || !LEVELS.includes(target.level)) throw new Error(`target.level must be one of ${LEVELS.join(', ')}`);
  const id = target.id;
  const parts = partsOf(bundle, doc);
  const mans = manifestsOf(bundle, doc);
  const viaPE = () => {
    let last = null;
    for (const m of mans) {
      const r = PE.resolveTarget(m, { level: target.level, id });
      if (r.kind && r.kind !== 'cell') return { r, m };
      if (r.parts && r.parts.length && r.reason) throw new Error(r.reason);
      last = r;
    }
    return { r: last, m: null };
  };
  switch (target.level) {
    case 'body':
      if (id && id !== 'body') throw new Error('a body-level target has id "body" (or none)');
      return { level: 'body', id: 'body', parts: [...parts.keys()], pe_kind: 'body', manifest: mans[0] };
    case 'system': {
      const { r, m } = viaPE();
      const s = systemsOf(parts, bundle).get(id);
      if (r && r.kind === 'system') return { level: 'system', id, label: s?.label || id, parts: r.parts, pe_kind: 'system', manifest: m };
      if (s) return { level: 'system', id, label: s.label, parts: s.parts, pe_kind: null };
      throw new Error(`unknown organ system "${id}": ${r?.reason || 'not an organ_system / organ_system_id in the manifest nor a data.json organ_system term'}`);
    }
    case 'organ':
    case 'tissue': {
      const { r, m } = viaPE();
      if (r && r.kind) return { level: target.level, id, label: parts.get(r.parts[0])?.label, parts: r.parts, part: parts.get(r.parts[0]), pe_kind: r.kind, bilateral: !!r.bilateral, manifest: m };
      const term = bundle.terms.find(t => t.id === id && t.level === target.level);
      if (term) return { level: target.level, id, label: term.label, term, parts: [] };
      throw new Error(`unknown ${target.level} "${id}": ${r?.reason || 'no such part'} (partedit.js rule), and not a ${target.level} term in dashboard/public/blueprint3d/data.json`);
    }
    case 'cell': {
      const term = bundle.terms.find(t => t.id === id && t.level === 'cell');
      if (!term) throw new Error(`unknown cell type "${id}": not a CL term in dashboard/public/blueprint3d/data.json`);
      return { level: 'cell', id, label: term.label, term, parts: [] };
    }
    case 'gene':
      if (!bundle.genes.includes(id)) throw new Error(`unknown gene symbol "${id}": not in genotype/map.vetted.slim.json`);
      return { level: 'gene', id, parts: [] };
  }
}

const peParams = (manifest, target) => (manifest ? PE.editableParams(manifest, target) : []).map(p => ({ ...p, effect: 'geometry', source: 'dashboard/public/blueprint3d/partedit.js editableParams' }));

/** Editable params for a resolved target. effect: 'parameter' (moves a parametric body-plan
 *  parameter), 'state' (overrides a STATE field), 'geometry' (partedit.js geometric param, or the
 *  engine's uniform 'scale'), 'recorded-only' (kept and shown, but NO model consumes it). */
export function editableParams(bundle, doc, resolved) {
  const out = [];
  const add = (param, effect, unit, note) => out.push({ param, effect, unit, ...(note ? { note } : {}) });
  const ref = bundle.organisms['zebrafish-adult'].parameters;
  if (resolved.level === 'body') {
    for (const k of parameterNames(bundle)) add(k, 'parameter', unitOf(k), null);
    for (const [k, v] of Object.entries(STATE_OVERRIDES)) if (v.owners.includes('body')) add(k, 'state', v.unit);
    out.push(...peParams(resolved.manifest || primaryManifest(bundle, doc), { level: 'body', id: 'body' }));
  } else if (resolved.level === 'system') {
    add('scale', 'geometry', '-', `engine-only uniform scale on every part in the system (${resolved.parts.length} parts); partedit equivalent: volume`);
    if (resolved.pe_kind) out.push(...peParams(resolved.manifest, { level: 'system', id: resolved.id }));
  } else if (resolved.pe_kind) {
    add('scale', 'geometry', '-', 'engine-only uniform scale about the part centroid (partedit equivalent: volume or area); pectoral fins, gills and the swim bladder feed STATE (area ~ scale^2; scale 0 removes the swim bladder)');
    out.push(...peParams(resolved.manifest, { level: resolved.level, id: resolved.id }));
    const all = partsOf(bundle, doc);
    const driven = new Set(resolved.parts.flatMap(pid => all.get(pid)?.driven_by_parameters || []));
    for (const k of driven) if (k in ref && !NOT_EDITABLE.has(k)) add(k, 'parameter', unitOf(k), 'body-plan parameter this part is generated from; applies to both sides. Length, span and area are separate parameters: moving one does not move the others (the parametric designs move them together explicitly)');
    for (const [k, v] of Object.entries(STATE_OVERRIDES)) if (v.owners.some(o => resolved.parts.includes(o))) add(k, 'state', v.unit);
  } else if (resolved.level === 'gene') {
    for (const k of ['expression_fold', 'knockout', 'allele']) add(k, 'recorded-only', k === 'knockout' ? 'bool' : (k === 'allele' ? 'text' : '-'), 'no genotype-to-phenotype model is wired into STATE; the edit is recorded and shown, never propagated');
  } else {
    add('scale', 'recorded-only', '-', 'ontology term with no mesh part in this organism; recorded, not propagated');
    if (resolved.level === 'cell') add('density_fold', 'recorded-only', '-', 'no cell-level model consumes this; recorded only');
  }
  return out;
}

function unitOf(k) {
  if (k.endsWith('_m')) return 'm';
  if (k.endsWith('_kg')) return 'kg';
  if (k.endsWith('_count')) return 'count';
  return '-';
}

// ---------------------------------------------------------------- documents
export function createOrganism({ id, parents, notes = '' }, bundle) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(id)) throw new Error('id must be a lower-case slug (a-z, 0-9, -, _)');
  if (!Array.isArray(parents) || !parents.length) throw new Error('base.parents must be a non-empty list of {organism, weight}');
  for (const p of parents) { organismOrThrow(bundle, p.organism); if (!(typeof p.weight === 'number' && p.weight > 0)) throw new Error('each parent weight must be a positive number'); }
  const sum = parents.reduce((a, p) => a + p.weight, 0);
  if (Math.abs(sum - 1) > 1e-6) throw new Error(`parent weights must sum to 1 (got ${sum})`);
  return { id, base: { parents: parents.map(p => ({ organism: p.organism, weight: p.weight })) }, edits: [], notes, caveat: HARD_CAVEAT };
}

/** A document for one of the bundle's own organisms or designs, unedited. */
export function docFor(bundle, organismId) {
  organismOrThrow(bundle, organismId);
  return createOrganism({ id: organismId, parents: [{ organism: organismId, weight: 1 }], notes: `the repository's own ${organismId}, unedited` }, bundle);
}

export function validateEdit(bundle, doc, edit) {
  if (!edit || typeof edit !== 'object') throw new Error('edit must be an object');
  if (!OPS.includes(edit.op)) throw new Error(`op must be one of ${OPS.join(', ')}`);
  checkAuthor(edit.author);
  if (typeof edit.reason !== 'string' || !edit.reason.trim()) throw new Error('every edit needs a reason');
  const resolved = resolveTarget(bundle, doc, edit.target);
  const allowed = editableParams(bundle, doc, resolved);
  const [base, suffixMode] = String(edit.param).split(':');
  const spec = allowed.find(a => a.param === base);
  if (!spec) throw new Error(`param "${edit.param}" is not editable on ${resolved.level} "${resolved.id}"; editable: ${allowed.map(a => a.param).join(', ')}`);
  const mode = edit.mode || suffixMode;
  if (mode && !(spec.modes || []).includes(mode)) throw new Error(`mode "${mode}" is not valid for ${base}; modes: ${(spec.modes || []).join(', ') || 'none'}`);
  if (spec.source && spec.ops && !spec.ops.includes(edit.op)) throw new Error(`${base} takes ops ${spec.ops.join(', ')}`);
  if (spec.source && edit.op === 'scale' && (edit.value < spec.min || edit.value > spec.max)) throw new Error(`${base}: scale factor ${edit.value} outside partedit's bounds [${spec.min}, ${spec.max}]`);
  if (spec.source && edit.op === 'set' && !(edit.value > 0)) throw new Error(`${base}: 'set' needs a positive value in ${spec.unit}`);
  const isBool = spec.unit === 'bool', isText = spec.unit === 'text';
  if (isBool) { if (edit.op !== 'set' || typeof edit.value !== 'boolean') throw new Error(`${edit.param} takes op 'set' with a boolean value`); }
  else if (isText) { if (edit.op !== 'set' || typeof edit.value !== 'string') throw new Error(`${edit.param} takes op 'set' with a text value`); }
  else if (!(typeof edit.value === 'number' && Number.isFinite(edit.value))) throw new Error(`${edit.param} needs a finite numeric value`);
  if (spec.param === 'scale' && edit.op !== 'add' && edit.value < 0) throw new Error('a scale cannot be negative');
  return { resolved, spec: { ...spec, mode: mode || spec.default_mode || null } };
}

/** Append an edit (validated) and return a NEW document; the input is not mutated. */
export function appendEdit(bundle, doc, edit, now = () => new Date().toISOString()) {
  const e = { target: { level: edit.target.level, id: edit.target.level === 'body' ? 'body' : edit.target.id }, param: edit.param, op: edit.op,
    value: edit.value, author: edit.author, reason: edit.reason, ts: edit.ts || now(),
    ...Object.fromEntries(['mode', 'lawset_version', 'proposal_id', 'approved_by'].filter(k => edit[k] != null).map(k => [k, edit[k]])) };
  validateEdit(bundle, doc, e);
  return { ...doc, edits: [...doc.edits, e] };
}

export function validateDoc(bundle, doc) {
  if (!doc || typeof doc !== 'object' || !doc.base) throw new Error('not an organism document');
  createOrganism({ id: doc.id, parents: doc.base.parents }, bundle);
  doc.edits.forEach((e, i) => { try { validateEdit(bundle, doc, e); } catch (err) { throw new Error(`edit ${i}: ${err.message}`); } });
  return true;
}

const applyOp = (op, cur, v) => (op === 'set' ? v : op === 'scale' ? cur * v : cur + v);

/** Resolve the document at its reference age: blended parameters with provenance, part scales,
 *  state overrides, and the edits that have no physical effect (recorded only). */
export function resolveParameters(bundle, doc) {
  validateDoc(bundle, doc);
  const schemaRule = k => (/_count$/.test(k) ? 'round' : 'arithmetic');
  const params = {};
  for (const k of Object.keys(bundle.organisms['zebrafish-adult'].parameters)) {
    let v = 0; const kinds = []; const src = [];
    for (const p of doc.base.parents) {
      const e = bundle.organisms[p.organism].parameters[k];
      if (!e || typeof e.value !== 'number') { v = null; break; }
      v += p.weight * e.value; kinds.push(mapKind(e.kind)); src.push(`${Math.round(p.weight * 100)}% ${p.organism}: ${e.source}`);
    }
    if (v !== null && schemaRule(k) === 'round') v = Math.round(v);
    params[k] = v === null ? { value: null, kind: 'assumed', source: 'none', reason: 'a parent lacks this parameter' }
      : { value: v, kind: weakest(kinds), source: src.join(' | ') };
  }
  const partScale = {};
  const geometry = [];
  const overrides = {};
  const recorded = [];
  doc.edits.forEach((e, i) => {
    const { resolved, spec } = validateEdit(bundle, doc, e);
    const tag = `edit #${i} by ${e.author}: ${e.reason}`;
    if (spec.effect === 'parameter') {
      const cur = params[e.param];
      if (cur.value === null && e.op !== 'set') throw new Error(`edit ${i}: cannot ${e.op} a parameter with no value`);
      params[e.param] = { value: applyOp(e.op, cur.value, e.value), kind: 'assumed', source: `${tag} (was ${cur.value}, ${cur.kind})`, edited: true };
    } else if (spec.effect === 'geometry' && spec.param === 'scale') {
      for (const pid of resolved.parts) partScale[pid] = applyOp(e.op, partScale[pid] ?? 1, e.value);
    } else if (spec.effect === 'geometry' && resolved.pe_kind === 'body') {
      // Whole-body geometric edits (partedit body length/depth/width/size) move the body-plan parameters.
      // Mass follows the volume at constant density: an assumption, stated in the source.
      const SL = params.standard_length_m.value, D = params.body_depth_over_SL.value * SL, W = params.body_width_over_SL.value * SL;
      const cur = { length: SL, size: SL, depth: D, width: W }[spec.param];
      const f = e.op === 'scale' ? e.value : e.op === 'set' ? e.value / cur : (cur + e.value) / cur;
      if (!(f > 0)) throw new Error(`edit ${i}: body ${spec.param} would become non-positive`);
      const mv = (k, g, why) => { const c = params[k]; params[k] = { value: c.value * g, kind: 'assumed', source: `${tag} [partedit body ${spec.param} x${f.toPrecision(4)}${why ? `; ${why}` : ''}] (was ${c.value}, ${c.kind})`, edited: true }; };
      const cdens = 'mass follows volume at constant density (assumed)';
      if (spec.param === 'length') { mv('standard_length_m', f); mv('body_mass_kg', f, cdens); mv('body_depth_over_SL', 1 / f, 'absolute depth kept'); mv('body_width_over_SL', 1 / f, 'absolute width kept'); }
      else if (spec.param === 'size') { mv('standard_length_m', f); mv('body_mass_kg', f ** 3, cdens); }
      else if (spec.param === 'depth') { mv('body_depth_over_SL', f); mv('body_mass_kg', f, cdens); }
      else if (spec.param === 'width') { mv('body_width_over_SL', f); mv('body_mass_kg', f, cdens); }
    } else if (spec.effect === 'geometry') {
      geometry.push({ index: i, parts: resolved.parts, pe_kind: resolved.pe_kind, param: spec.param, mode: spec.mode, op: e.op, value: e.value, unit: spec.unit, tag });
    } else if (spec.effect === 'state') {
      (overrides[e.param] ||= []).push({ op: e.op, value: e.value, source: tag });
    } else recorded.push({ index: i, ...e, effect: 'recorded-only', note: spec.note });
  });
  return { params, partScale, geometry, overrides, recorded, leaves: leaves(bundle, doc.base.parents), caveat: HARD_CAVEAT };
}

/** The part hierarchy body -> system -> organ -> tissue -> cell, with editable params per level. */
export function listParts(bundle, doc) {
  const parts = partsOf(bundle, doc);
  const body = { level: 'body', id: 'body', editable: editableParams(bundle, doc, resolveTarget(bundle, doc, { level: 'body' })), systems: [] };
  for (const s of systemsOf(parts, bundle).values()) {
    if (!s.parts.length) continue;
    const sys = { level: 'system', id: s.id, label: s.label, editable: editableParams(bundle, doc, resolveTarget(bundle, doc, { level: 'system', id: s.id })), organs: [], tissues: [] };
    for (const pid of s.parts) {
      const part = parts.get(pid);
      let editable;
      try { editable = editableParams(bundle, doc, resolveTarget(bundle, doc, { level: part.level === 'tissue' ? 'tissue' : 'organ', id: pid })); } catch (e) { editable = [{ error: e.message }]; }
      const node = { level: part.level, id: pid, label: part.label, ontology_id: part.ontology_id, side: part.side, editable };
      (part.level === 'tissue' ? sys.tissues : sys.organs).push(node);
    }
    body.systems.push(sys);
  }
  const ontology = { note: 'ontology terms from dashboard/public/blueprint3d/data.json (flying-fish blueprint). Terms without a mesh part are editable only as recorded-only.',
    tissue: bundle.terms.filter(t => t.level === 'tissue').map(t => ({ id: t.id, label: t.label, parents: t.parents })),
    cell: bundle.terms.filter(t => t.level === 'cell').map(t => ({ id: t.id, label: t.label, parents: t.parents })) };
  return { body, ontology, genes: { count: bundle.genes.length, source: 'genotype/map.vetted.slim.json', editable: ['expression_fold', 'knockout', 'allele'], effect: 'recorded-only' } };
}
