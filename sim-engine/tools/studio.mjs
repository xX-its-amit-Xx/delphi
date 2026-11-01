// Design Studio tools: organism documents, STATE, scenarios, optimisation and co-design sessions.
// Every handler is exported so server.mjs, cli.mjs and the HTTP bridge call the same functions, and
// every handler returns the provenance envelope { result, provenance, scope, weakest_input, counts }.
//
// Storage (append-only, gitignored): sim-engine/sessions/<id>.jsonl for sessions and
// sim-engine/sessions/organisms/<id>.json for saved organism documents. Any tool that takes
// `organism` also accepts an inline document, so callers can stay stateless.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { envelope, p } from '../lib/envelope.mjs';
import { loadBundle } from '../lib/data-node.mjs';
import * as O from '../lib/organism.mjs';
import { resolveState, stageAges, STATE_FIELDS, STATE_FIELDS_OPTIONAL } from '../lib/state.mjs';
import { leanVerdicts, lawsetVersion } from '../lib/lean.mjs';
import { loadScenarios, describeScenario, runScenario } from '../scenarios/index.mjs';

export const SESSIONS_DIR = process.env.STUDIO_SESSIONS_DIR ? path.resolve(process.env.STUDIO_SESSIONS_DIR) : path.resolve(import.meta.dirname, '..', 'sessions');
const ORG_DIR = path.join(SESSIONS_DIR, 'organisms');
const SLUG = /^[a-z0-9][a-z0-9_-]{0,62}$/;

// ---------------------------------------------------------------- helpers
function slug(id, what) { if (typeof id !== 'string' || !SLUG.test(id)) throw new Error(`${what} must be a lower-case slug`); return id; }
function savedPath(id) { return path.join(ORG_DIR, `${slug(id, 'organism id')}.json`); }
function saveDoc(doc) { fs.mkdirSync(ORG_DIR, { recursive: true }); fs.writeFileSync(savedPath(doc.id), JSON.stringify(doc, null, 1)); }

/** organism: inline doc | saved doc id | bundle organism/design id. Returns {doc, origin}. */
export async function getDoc(organism) {
  const bundle = await loadBundle();
  if (organism && typeof organism === 'object') { O.validateDoc(bundle, organism); return { doc: organism, origin: 'inline', bundle }; }
  if (typeof organism !== 'string') throw new Error('organism must be an id or an organism document');
  if (SLUG.test(organism) && fs.existsSync(savedPath(organism))) {
    const doc = JSON.parse(fs.readFileSync(savedPath(organism), 'utf8')); O.validateDoc(bundle, doc);
    return { doc, origin: 'saved', bundle };
  }
  if (bundle.organisms[organism]) return { doc: O.docFor(bundle, organism), origin: 'repository', bundle };
  throw new Error(`unknown organism "${organism}": not a saved document nor one of ${Object.keys(bundle.organisms).join(', ')}`);
}

/** The unedited base of a document: same parents, no edits. */
const baseOf = doc => ({ ...doc, edits: [] });

const ALL_FIELDS = [...STATE_FIELDS, ...STATE_FIELDS_OPTIONAL];
function stateProvenance(state) {
  const out = [];
  for (const k of ALL_FIELDS) {
    if (k === 'parts') continue;
    if (k === 'ambient') { for (const [ak, f] of Object.entries(state.ambient)) out.push(p(`ambient.${ak}`, f.value, f.kind, f.source || 'none', { unit: f.unit })); continue; }
    const f = state[k];
    out.push(p(k, f.value, f.kind, f.source || 'none', { unit: f.unit, ...(f.weakest_input ? { weakest_input: f.weakest_input } : {}), ...(f.reason ? { reason: f.reason } : {}) }));
  }
  return out;
}
/** A compact view of STATE for results: field -> value (full records stay in provenance). */
export function stateSummary(state) {
  const s = {};
  for (const k of ALL_FIELDS) {
    if (k === 'parts') continue;
    if (k === 'ambient') { s.ambient = Object.fromEntries(Object.entries(state.ambient).map(([a, f]) => [a, f.value])); continue; }
    s[k] = state[k]?.value ?? null;
  }
  return { values: s, nulls: ALL_FIELDS.filter(k => state[k]?.value === null).map(k => ({ field: k, reason: state[k].reason })), flags: state._meta.flags, taxon: state._meta.taxon };
}
const STATE_SCOPE = 'STATE comes from the parametric body plan (anatomy-model/parametric), the project growth trajectories (development/) and physiology/ constants. Many inputs are assumed or borrowed from other species; check weakest_input on each field. ' + O.HARD_CAVEAT;

let _scn = null;
async function scenarios(fresh = false) { if (!_scn || fresh) _scn = await loadScenarios({ bust: fresh }); return _scn; }
async function scenarioOrThrow(key) {
  const { scenarios: m, errors } = await scenarios(true);
  const s = m.get(key);
  if (!s) throw new Error(`unknown scenario "${key}"; available: ${[...m.keys()].join(', ') || 'none'}${errors.length ? ` (modules with errors: ${errors.length}; see scenario_list)` : ''}`);
  return s;
}

// ---------------------------------------------------------------- schemas
const ORG = { description: 'Organism: a saved document id, a repository organism/design id (flying-fish, zebrafish-adult, zebrafish-larva, tff, winged-zebrafish, wingless-flying-fish, ff-zf-chimera), or an inline organism document.', anyOf: [{ type: 'string' }, { type: 'object' }] };
const AGE = { type: 'number', description: 'Age in days after hatching. Default: the reference age of the dominant parent. Ages outside the growth data are clamped and flagged.' };
const COND = { type: 'object', description: 'Conditions: temperature_C, salinity_psu, depth_m, altitude_m, air_O2_fraction, medium. Unset values come from conditions/baseline.json.' };
const MEASURED = { type: 'object', description: 'Optional values measured on the edited mesh by dashboard/public/blueprint3d/partedit.js measurePart: {pectoral_area_both_m2, pectoral_span_m, lifting_area_m2}. They replace the parameter-model values in STATE (kind derived).' };
const LAWSET = { type: 'string', description: "Lean lawset version (default 'current'). Read from the law registry via lib/lean-source.mjs." };
const TARGET = { type: 'object', properties: { level: { enum: O.LEVELS }, id: { type: 'string' } }, required: ['level'] };
const EDIT = { type: 'object', description: 'One edit. author is a ROLE label (human, agent:physics), never a personal identifier.',
  properties: { target: TARGET, param: { type: 'string' }, op: { enum: O.OPS }, value: {}, author: { type: 'string' }, reason: { type: 'string' } },
  required: ['target', 'param', 'op', 'value', 'author', 'reason'] };

export const SCHEMAS = {
  organism_create: { title: 'Create an organism document', description: 'New organism document from weighted parents (reference organisms or designs; weights sum to 1). Saved under sim-engine/sessions/organisms/.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, parents: { type: 'array', items: { type: 'object', properties: { organism: { type: 'string' }, weight: { type: 'number' } }, required: ['organism', 'weight'] } }, notes: { type: 'string' }, overwrite: { type: 'boolean' } }, required: ['id', 'parents'] } },
  organism_get: { title: 'Get an organism document and its STATE', description: 'Returns the document and, at the given age and conditions, the resolved STATE with per-field provenance.',
    inputSchema: { type: 'object', properties: { organism: ORG, ageDays: AGE, conditions: COND, measured: MEASURED }, required: ['organism'] } },
  organism_list_parts: { title: 'Editable part hierarchy', description: 'body -> organ system -> organ -> tissue (mesh parts from the organism manifest) plus ontology tissue/cell terms and gene symbols, with the editable params at each level and what each edit affects.',
    inputSchema: { type: 'object', properties: { organism: ORG, level: { enum: O.LEVELS, description: 'Optional: return only this level.' } }, required: ['organism'] } },
  organism_edit: { title: 'Append an edit and re-check the Lean laws', description: 'Validates the target against the manifest/ontology/gene list (unknown ids are rejected), appends the edit, resolves STATE and returns Lean verdicts plus violations (red), contested (amber) and whether the unedited base also violates each.',
    inputSchema: { type: 'object', properties: { organism: ORG, edit: EDIT, new_id: { type: 'string', description: 'When editing a repository organism, save the result under this id.' }, ageDays: AGE, conditions: COND, lawset: LAWSET }, required: ['organism', 'edit'] } },
  scenario_list: { title: 'List scenarios', description: 'Every scenario module in sim-engine/scenarios with params, required STATE fields, declared metrics and model card. Modules that fail the interface are listed under errors.',
    inputSchema: { type: 'object', properties: {} } },
  scenario_run: { title: 'Run a scenario', description: 'Run one scenario on an organism at one age. Never runs when a required STATE field is null.',
    inputSchema: { type: 'object', properties: { organism: ORG, scenario: { type: 'string' }, params: { type: 'object' }, ageDays: AGE, conditions: COND, measured: MEASURED, lawset: LAWSET }, required: ['organism', 'scenario'] } },
  scenario_timecourse: { title: 'Run a scenario across development', description: 'The same scenario at every developmental stage in anatomy-model/parametric/stages.json for the organism\'s parents: per-stage metrics, survives, limiting, Lean violations.',
    inputSchema: { type: 'object', properties: { organism: ORG, scenario: { type: 'string' }, params: { type: 'object' }, conditions: COND, lawset: LAWSET }, required: ['organism', 'scenario'] } },
  optimize: { title: 'Optimise a design against a scenario metric', description: 'Seeded random-restart hill climb over decision variables [{target,param,min,max}]. A candidate is rejected if it creates a NEW binding Lean violation (strict: any binding violation) or breaks a hard constraint; every rejection is returned with the law or constraint it broke. If no candidate is feasible the result says "no design meets the spec".',
    inputSchema: { type: 'object', properties: {
      organism: ORG,
      objective: { type: 'object', properties: { scenario: { type: 'string' }, metric: { type: 'string' }, params: { type: 'object' }, ageDays: AGE, conditions: COND, direction: { enum: ['maximize', 'minimize'] } }, required: ['scenario', 'metric'] },
      variables: { type: 'array', items: { type: 'object', properties: { target: TARGET, param: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' } }, required: ['target', 'param', 'min', 'max'] } },
      hard_constraints: { type: 'array', description: 'Each: {scenario, metric, op:"<="|">="|"==", value, params?, ageDays?} or {scenario, survives:true} or {scenario, feasible:true} or {state_field, op, value}.', items: { type: 'object' } },
      budget: { type: 'integer', description: 'Evaluations (default 60, max 400), including the start design.' }, restarts: { type: 'integer' }, seed: { type: 'integer' }, strict: { type: 'boolean' }, lawset: LAWSET,
      tolerance: { type: 'number', description: 'Relative improvement over the START design a candidate must exceed (default 0.001 = 0.1 %). Below it the result is status "no improvement" and the start design is returned unchanged.' },
    }, required: ['organism', 'objective', 'variables'] } },
  session_open: { title: 'Open a co-design session', description: 'Append-only JSONL log under sim-engine/sessions/. Optionally bound to a saved organism document that kind:"edit" posts modify.',
    inputSchema: { type: 'object', properties: { title: { type: 'string' }, organism: { type: 'string', description: 'Saved organism document id (create it first).' }, author: { type: 'string' } }, required: ['title', 'author'] } },
  session_post: { title: 'Post to a co-design session', description: "kind 'comment' | 'proposal' (edits + rationale + the scenario results that motivated them; validated, NOT applied; gets a proposal_id for session_decide) | 'edit' (applied at once; only for author roles starting with 'human'). author is a role label, never a personal identifier.",
    inputSchema: { type: 'object', properties: { session: { type: 'string' }, author: { type: 'string' }, kind: { enum: ['comment', 'proposal', 'edit'] }, body: { type: 'string' },
      edits: { type: 'array', items: EDIT, description: 'Edits (author is taken from the post).' }, edit: EDIT, rationale: { type: 'string', description: 'Required for a proposal.' },
      evidence: { type: 'array', items: { type: 'object' }, description: 'Scenario results (or other tool results) that motivated the proposal; stored verbatim.' }, lawset: LAWSET }, required: ['session', 'author', 'kind'] } },
  session_decide: { title: 'Approve or reject a proposal', description: "Applies (approve) or rejects a proposal posted to a session. decided_by_role must be a role label starting with 'human' (agents propose, humans decide). Approval applies every edit of the proposal atomically to the session's organism and records the lawset version and the Lean violations at that moment.",
    inputSchema: { type: 'object', properties: { session: { type: 'string' }, proposal_id: { type: 'string' }, decision: { enum: ['approve', 'reject'] }, decided_by_role: { type: 'string' }, reason: { type: 'string' }, lawset: LAWSET }, required: ['session', 'proposal_id', 'decision', 'decided_by_role', 'reason'] } },
  session_read: { title: 'Read a co-design session', description: 'Every entry (or those after `since`), plus the current organism document if the session has one.',
    inputSchema: { type: 'object', properties: { session: { type: 'string' }, since: { type: 'integer', description: 'Return entries with seq > since.' } }, required: ['session'] } },
};

// ---------------------------------------------------------------- organism tools
export async function organismCreate(args = {}) {
  const bundle = await loadBundle();
  if (bundle.organisms[args.id]) throw new Error(`"${args.id}" is a repository organism id; choose another id`);
  const doc = O.createOrganism({ id: args.id, parents: args.parents, notes: args.notes || '' }, bundle);
  if (fs.existsSync(savedPath(doc.id)) && !args.overwrite) throw new Error(`organism "${doc.id}" already exists (pass overwrite:true to replace it)`);
  saveDoc(doc);
  return envelope({ doc, saved: `sessions/organisms/${doc.id}.json` },
    doc.base.parents.map(x => p(`parent ${x.organism}`, x.weight, 'assumed', 'weight chosen by the caller')),
    'A document only: no STATE is resolved and nothing is checked against the Lean laws until organism_get or organism_edit. ' + O.HARD_CAVEAT);
}

export async function organismGet(args = {}) {
  const { doc, origin, bundle } = await getDoc(args.organism);
  const state = resolveState(doc, args.ageDays, args.conditions || {}, bundle, { measured: args.measured });
  return envelope({ doc, origin, state: stateSummary(state), parts: state.parts, recorded_only_edits: state._meta.recorded_only_edits, parameters: state._meta.parameters },
    stateProvenance(state), STATE_SCOPE);
}

export async function organismListParts(args = {}) {
  const { doc, bundle } = await getDoc(args.organism);
  const tree = O.listParts(bundle, doc);
  let result = tree;
  if (args.level) {
    const flat = [];
    if (args.level === 'body') flat.push({ id: 'body', editable: tree.body.editable });
    for (const s of tree.body.systems) {
      if (args.level === 'system') flat.push({ id: s.id, label: s.label, editable: s.editable });
      for (const n of [...s.organs, ...s.tissues]) if (n.level === args.level) flat.push(n);
    }
    if (args.level === 'tissue' || args.level === 'cell') flat.push(...tree.ontology[args.level].map(t => ({ ...t, editable: [{ param: 'scale', effect: 'recorded-only' }] })));
    if (args.level === 'gene') flat.push({ genes: bundle.genes, editable: tree.genes.editable, effect: 'recorded-only' });
    result = { level: args.level, items: flat };
  }
  return envelope(result, [p('part hierarchy', 'manifest + ontology', 'derived', 'dashboard/public/blueprint3d/model/*-manifest.json; dashboard/public/blueprint3d/data.json; genotype/map.vetted.slim.json')],
    "Lists what can be edited and what each edit feeds. 'recorded-only' edits (genes, cells, ontology terms without a mesh part) are stored and shown but NO model consumes them: an edit there changes no number anywhere.");
}

export async function organismEdit(args = {}) {
  const { doc, origin, bundle } = await getDoc(args.organism);
  const lv = await lawsetVersion(args.lawset);
  let next = O.appendEdit(bundle, doc, { ...args.edit, lawset_version: lv });
  let saved = null;
  if (origin === 'saved') { saveDoc(next); saved = next.id; }
  else if (origin === 'repository' && args.new_id) {
    if (bundle.organisms[args.new_id]) throw new Error('new_id collides with a repository organism');
    if (fs.existsSync(savedPath(args.new_id))) throw new Error(`organism "${args.new_id}" already exists`);
    next = { ...next, id: slug(args.new_id, 'new_id'), notes: `edited from the repository's ${doc.id}` };
    saveDoc(next); saved = next.id;
  }
  const state = resolveState(next, args.ageDays, args.conditions || {}, bundle);
  const base = resolveState(baseOf(next), args.ageDays, args.conditions || {}, bundle);
  const lean = await leanVerdicts(state, { lawset: args.lawset, baselineState: base });
  const edit = next.edits.at(-1);
  const recorded = state._meta.recorded_only_edits.some(r => r.index === next.edits.length - 1);
  return envelope({ doc: next, saved, origin, edit, edit_effect: recorded ? 'recorded-only: no model consumes this edit; no number changed' : 'applied',
    state: stateSummary(state), parts: state.parts, lawset_version: lean.lawset_version, verdicts: lean.verdicts, violations: lean.violations,
    new_binding_violations: lean.new_binding_violations, lean_kernel_note: lean.kernel },
  [...stateProvenance(state), p('Lean verdicts', lean.lawset_version, 'derived', 'lib/lean-source.mjs checkDesign -> lean/eliminate/browser-check.mjs (floating point, not a kernel check)')],
  'NOT A KERNEL CHECK: Lean verdicts are floating-point evaluations of the Lean-backed formulas on this STATE. "holds" never means feasible. Rows marked baseline_violated are also violated by the unedited base organism (several compare implied scaling exponents against one flying-fish reference specimen), so they describe that comparison, not this edit. ' + STATE_SCOPE);
}

// ---------------------------------------------------------------- scenarios
export async function scenarioList() {
  const { scenarios: m, errors } = await scenarios(true);
  return envelope({ scenarios: [...m.values()].map(describeScenario), errors },
    [p('scenario registry', [...m.keys()], 'derived', 'sim-engine/scenarios/*.mjs, validated by scenarios/index.mjs')],
    'A listing. Each scenario states its own validity and sources in its model card; _example is an interface test, not a model.');
}

async function runOne(doc, bundle, s, args, ageDays) {
  const state = resolveState(doc, ageDays, args.conditions || {}, bundle, { measured: args.measured });
  const run = runScenario(s, state, args.params || {});
  const base = resolveState(baseOf(doc), ageDays, args.conditions || {}, bundle);
  const lean = await leanVerdicts(state, { lawset: args.lawset, baselineState: base });
  return { state, run, lean };
}

export async function scenarioRun(args = {}) {
  const { doc, bundle } = await getDoc(args.organism);
  const s = await scenarioOrThrow(args.scenario);
  const { state, run, lean } = await runOne(doc, bundle, s, args, args.ageDays);
  const prov = [...(run.ok ? run.provenance : []), ...stateProvenance(state)];
  return envelope({ scenario: s.key, run, state: stateSummary(state), lawset_version: lean.lawset_version, verdicts: lean.verdicts, violations: lean.violations,
    new_binding_violations: lean.new_binding_violations, out_of_validity: run.ok && !run.validity.inRange ? run.validity : null },
  prov, `${run.ok ? run.scope : `Scenario did not run: ${run.error}`} Out-of-validity results are reported under out_of_validity and are NOT law violations. ${STATE_SCOPE}`);
}

export async function scenarioTimecourse(args = {}) {
  const { doc, bundle } = await getDoc(args.organism);
  const s = await scenarioOrThrow(args.scenario);
  const stages = stageAges(bundle, doc);
  const rows = []; const prov = [];
  for (const st of stages) {
    const { state, run, lean } = await runOne(doc, bundle, s, args, st.ageDays);
    rows.push({ ageDays: st.ageDays, stage_key: st.key, stage: state.stage.value, label: st.label, track: st.track, SL_m: state.SL_m.value, mass_kg: state.mass_kg.value,
      ok: run.ok, metrics: run.ok ? run.metrics : null, survives: run.ok ? run.survives : null, feasible: run.ok ? run.feasible : null, feasibility_note: run.ok ? (run.feasibility_note ?? null) : null, limiting: run.ok ? run.limiting : null,
      validity: run.ok ? run.validity : null, error: run.ok ? null : run.error, missing: run.missing || null,
      violations: lean.violations, new_binding_violations: lean.new_binding_violations, flags: state._meta.flags });
    if (run.ok) prov.push(...run.provenance.map(q => ({ ...q, quantity: `${st.key}: ${q.quantity}` })));
  }
  const lv = await lawsetVersion(args.lawset);
  return envelope({ scenario: s.key, organism: doc.id, lawset_version: lv, stages: rows },
    prov.length ? prov : [p('timecourse', null, 'assumed', 'no stage ran')],
    'One scenario evaluated at each stage age in anatomy-model/parametric/stages.json. Between-stage behaviour is not sampled. Early-stage STATE leans on assumed ramps (see each field kind). ' + O.HARD_CAVEAT);
}

// ---------------------------------------------------------------- optimize
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(rnd) { const u = Math.max(rnd(), 1e-12), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const cmp = (a, op, b) => (op === '<=' ? a <= b : op === '>=' ? a >= b : op === '<' ? a < b : op === '>' ? a > b : op === '==' ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) : false);

export async function optimize(args = {}) {
  const { doc, bundle } = await getDoc(args.organism);
  const obj = args.objective || {};
  const s = await scenarioOrThrow(obj.scenario);
  const declared = s.metrics?.find(m => m.key === obj.metric);
  if (s.metrics && !declared) throw new Error(`metric "${obj.metric}" is not declared by scenario ${s.key}: ${s.metrics.map(m => m.key).join(', ')}`);
  const vars = args.variables || [];
  if (!vars.length) throw new Error('variables must list at least one {target, param, min, max}');
  for (const v of vars) {
    if (!(v.max > v.min)) throw new Error(`variable ${v.param}: max must exceed min`);
    O.validateEdit(bundle, doc, { target: v.target, param: v.param, op: 'set', value: v.min, author: 'agent:optimizer', reason: 'bounds check' });
  }
  const dir = obj.direction || (declared?.better === 'lower' ? 'minimize' : 'maximize');
  const budget = Math.min(400, Math.max(1, args.budget ?? 60));
  const restarts = Math.max(1, args.restarts ?? 4);
  const rnd = mulberry32(args.seed ?? 1);
  const hard = args.hard_constraints || [];
  const lv = await lawsetVersion(args.lawset);
  const conditions = obj.conditions || {};
  const baseState = resolveState(baseOf(doc), obj.ageDays, conditions, bundle);
  const baseLean = await leanVerdicts(baseState, { lawset: args.lawset });
  const baseViol = new Set(baseLean.violations.map(v => v.lean_ref.constraint));
  const others = new Map();
  for (const h of hard) if (h.scenario && !others.has(h.scenario)) others.set(h.scenario, await scenarioOrThrow(h.scenario));

  const toVals = x => x.map((u, i) => vars[i].min + u * (vars[i].max - vars[i].min));
  const docAt = vals => vars.reduce((d, v, i) => O.appendEdit(bundle, d, { target: v.target, param: v.param, op: 'set', value: vals[i], author: 'agent:optimizer', reason: `optimize ${s.key}.${obj.metric} (${dir})`, ts: 'optimize', lawset_version: lv }), doc);
  const tol = args.tolerance ?? 1e-3;
  const trace = []; const rejected = []; let best = null; let evals = 0;

  async function evaluateDoc(d, values) {
    evals++;
    const state = resolveState(d, obj.ageDays, conditions, bundle);
    const lean = await leanVerdicts(state, { lawset: args.lawset });
    const binding = lean.violations.filter(v => v.binding && !v.contested);
    const broke = args.strict ? binding : binding.filter(v => !baseViol.has(v.lean_ref.constraint));
    if (broke.length) { rejected.push({ eval: evals, values, reason: 'lean', laws: broke.map(v => ({ law_id: v.law_id, law_version: v.law_version, constraint: v.lean_ref.constraint, theorem: v.lean_ref.theorem, message: v.message, parts: v.parts })) }); return null; }
    const run = runScenario(s, state, obj.params || {});
    if (!run.ok) { rejected.push({ eval: evals, values, reason: 'scenario', error: run.error, missing: run.missing }); return null; }
    const m = run.metrics.find(q => q.key === obj.metric);
    if (!m || typeof m.value !== 'number') { rejected.push({ eval: evals, values, reason: 'objective metric null or missing', metric: obj.metric }); return null; }
    for (const h of hard) {
      let actual, ok, label;
      if (h.state_field) { actual = state[h.state_field]?.value; label = `${h.state_field} ${h.op} ${h.value}`; ok = typeof actual === 'number' && cmp(actual, h.op, h.value); }
      else {
        const hs = others.get(h.scenario);
        const hstate = h.ageDays !== undefined && h.ageDays !== obj.ageDays ? resolveState(d, h.ageDays, h.conditions || conditions, bundle) : state;
        const hr = hs.key === s.key && !h.params && hstate === state ? run : runScenario(hs, hstate, h.params || {});
        if (!hr.ok) { actual = null; ok = false; label = `${h.scenario}: ${hr.error}`; }
        else if (h.survives !== undefined) { actual = hr.survives; ok = hr.survives === h.survives; label = `${h.scenario}.survives == ${h.survives}`; }
        else if (h.feasible !== undefined) { actual = hr.feasible; ok = hr.feasible === h.feasible; label = `${h.scenario}.feasible == ${h.feasible}`; }
        else { const q = hr.metrics.find(z => z.key === h.metric); actual = q?.value ?? null; label = `${h.scenario}.${h.metric} ${h.op} ${h.value}`; ok = typeof actual === 'number' && cmp(actual, h.op, h.value); }
      }
      if (!ok) { rejected.push({ eval: evals, values, reason: 'hard constraint', constraint: label, actual }); return null; }
    }
    const score = dir === 'maximize' ? m.value : -m.value;
    return { eval: evals, values, metric: m.value, score, doc: d, run, lean };
  }
  const evaluate = async x => {
    const vals = toVals(x);
    const rec = await evaluateDoc(docAt(vals), Object.fromEntries(vars.map((v, i) => [`${v.target.level}:${v.target.id || 'body'}.${v.param}`, vals[i]])));
    if (rec && (!best || rec.score > best.score)) best = rec;
    return rec;
  };

  // The START design is always scored first: a candidate must beat it by more than the tolerance.
  const start = await evaluateDoc(doc, 'start (unchanged document)');
  trace.push({ eval: evals, restart: null, values: 'start', metric: start?.metric ?? null, accepted: !!start });
  const perRestart = Math.max(1, Math.floor((budget - 1) / restarts));
  for (let r = 0; r < restarts && evals < budget; r++) {
    let x = vars.map(() => rnd());
    let cur = await evaluate(x); trace.push({ eval: evals, restart: r, values: toVals(x), metric: cur?.metric ?? null, accepted: !!cur });
    let sigma = 0.25; const stop = Math.min(budget, evals + perRestart - 1);
    while (evals < stop) {
      const y = x.map(u => Math.min(1, Math.max(0, u + sigma * gauss(rnd))));
      const c = await evaluate(y);
      const better = c && (!cur || c.score > cur.score);
      trace.push({ eval: evals, restart: r, values: toVals(y), metric: c?.metric ?? null, accepted: !!better });
      if (better) { x = y; cur = c; sigma = Math.min(0.5, sigma * 1.3); } else sigma = Math.max(0.01, sigma * 0.8);
    }
  }

  const scope = `Seeded random-restart hill climb (seed ${args.seed ?? 1}, ${evals} evaluations including the start design): a local search, not a global optimum. A candidate counts only if it beats the start design by more than ${tol * 100} % (relative). Constraint: no ${args.strict ? '' : 'NEW '}binding Lean violation (floating point, not a kernel check)${hard.length ? ' and every hard constraint' : ''}. The objective is only as good as the scenario model and the STATE inputs it rests on; an optimised design is a shape, not a viable organism. ` + O.HARD_CAVEAT;
  const prov = [p('optimizer', 'random-restart hill climb', 'derived', 'sim-engine/tools/studio.mjs optimize'), p('tolerance', tol, 'assumed', 'relative improvement required over the start design (caller or default 0.001)')];
  const common = { objective: { scenario: s.key, metric: obj.metric, direction: dir }, tolerance: tol, evaluations: evals, rejected, trace, lawset_version: lv, baseline_violations: [...baseViol],
    start: start ? { metric: start.metric, feasible: true } : { metric: null, feasible: false, why: rejected.find(x => x.values === 'start (unchanged document)') || null } };
  if (!best && !start) return envelope({ status: 'no design meets the spec', best: null, ...common }, prov, scope);
  const beats = best && (!start || best.score - start.score > tol * Math.max(Math.abs(start.score), 1e-12));
  if (!beats) {
    return envelope({ status: 'no improvement', best: { values: 'start', metric: start.metric, doc, run: start.run, violations: start.lean.violations },
      note: best ? `best candidate ${best.metric} does not beat the start ${start.metric} by more than the tolerance; the start design is returned unchanged` : 'no feasible candidate; the start design is returned unchanged', ...common },
    [...start.run.provenance, ...prov], scope);
  }
  return envelope({ status: 'ok', best: { values: best.values, metric: best.metric, improvement: start ? best.metric - start.metric : null, doc: best.doc, run: best.run, violations: best.lean.violations },
    feasible_candidates: trace.filter(t => t.metric !== null).length, ...(start ? {} : { note: 'the start design itself does not meet the constraints' }), ...common },
  [...best.run.provenance, ...prov], scope);
}

// ---------------------------------------------------------------- sessions
function sessionPath(id) { return path.join(SESSIONS_DIR, `${slug(id, 'session id')}.jsonl`); }
function readSession(id) {
  const f = sessionPath(id);
  if (!fs.existsSync(f)) throw new Error(`no session "${id}"`);
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}
function append(id, entry) { fs.appendFileSync(sessionPath(id), JSON.stringify(entry) + '\n'); }
const SESSION_SCOPE = 'A co-design log. Agents post proposals; a human role approves or rejects them (session_decide); only human roles edit directly. Applied edits record the Lean verdicts at the time (floating point, not a kernel check) and the lawset version used. Authors are role labels, not people.';

export async function sessionOpen(args = {}) {
  O.checkAuthor(args.author);
  if (typeof args.title !== 'string' || !args.title.trim()) throw new Error('title is required');
  if (args.organism) { const { origin } = await getDoc(args.organism); if (origin !== 'saved') throw new Error('a session organism must be a saved document (organism_create first)'); }
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  const base = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'session';
  const id = `${base}-${crypto.randomBytes(3).toString('hex')}`;
  const entry = { seq: 0, type: 'open', ts: new Date().toISOString(), title: args.title, organism: args.organism || null, author: args.author, lawset_version: await lawsetVersion() };
  append(id, entry);
  return envelope({ session: id, entry }, [p('session', id, 'assumed', 'opened by the caller')], SESSION_SCOPE);
}

// Agents propose, humans decide. Direct edits and decisions need a role starting with 'human'.
const HUMAN_ROLE = /^human(:|$)/;
const violationsBrief = r => r.result.violations.map(v => ({ law_id: v.law_id, law_version: v.law_version, constraint: v.lean_ref.constraint, severity: v.severity, baseline_violated: v.baseline_violated, parts: v.parts }));

/** Apply edits in order to a saved document, atomically: all validate or nothing is written. */
async function applyEdits(organism, edits, extra, lawset) {
  const { doc, origin, bundle } = await getDoc(organism);
  if (origin !== 'saved') throw new Error('only a saved organism document can be edited from a session');
  const lv = await lawsetVersion(lawset);
  let next = doc;
  edits.forEach((e, i) => { try { next = O.appendEdit(bundle, next, { ...e, ...extra, lawset_version: lv }); } catch (err) { throw new Error(`edit ${i}: ${err.message} (nothing applied)`); } });
  saveDoc(next);
  const st = resolveState(next, undefined, {}, bundle);
  const lean = await leanVerdicts(st, { lawset, baselineState: resolveState(baseOf(next), undefined, {}, bundle) });
  return { doc: next, applied: next.edits.slice(doc.edits.length), lawset_version: lv, violations: violationsBrief({ result: lean }) };
}

export async function sessionPost(args = {}) {
  O.checkAuthor(args.author);
  if (!['comment', 'proposal', 'edit'].includes(args.kind)) throw new Error("kind must be 'comment', 'proposal' or 'edit'");
  const log = readSession(args.session);
  const head = log[0];
  const lv = await lawsetVersion(args.lawset);
  const entry = { seq: log.length, type: args.kind, ts: new Date().toISOString(), author: args.author, body: args.body || '', lawset_version: lv };
  if (args.kind === 'comment' && !entry.body) throw new Error('a comment needs a body');
  if (args.kind !== 'comment') {
    const edits = (args.edits || (args.edit ? [args.edit] : [])).map(e => ({ ...e, author: args.author, reason: e.reason || args.rationale || args.body }));
    if (!edits.length) throw new Error(`a ${args.kind} needs edits`);
    if (!head.organism) throw new Error('this session has no organism; open one with organism set');
    if (args.kind === 'proposal') {
      if (typeof args.rationale !== 'string' || !args.rationale.trim()) throw new Error('a proposal needs a rationale');
      const { doc, bundle } = await getDoc(head.organism);
      let scratch = doc; // validate in order, as they would be applied; nothing is saved
      edits.forEach((e, i) => { try { scratch = O.appendEdit(bundle, scratch, { ...e, ts: entry.ts }); } catch (err) { throw new Error(`proposal edit ${i}: ${err.message}`); } });
      Object.assign(entry, { proposal_id: `p${entry.seq}`, edits, rationale: args.rationale, evidence: args.evidence || [], status: 'open' });
    } else {
      if (!HUMAN_ROLE.test(args.author)) throw new Error(`direct edits are only for author roles starting with 'human' (got '${args.author}'); post a proposal instead and a human role decides it with session_decide`);
      const r = await applyEdits(head.organism, edits, {}, args.lawset);
      Object.assign(entry, { edits: r.applied, applied: true, violations: r.violations, lawset_version: r.lawset_version });
    }
  }
  append(args.session, entry);
  return envelope({ session: args.session, entry }, [p('session entry', entry.seq, 'assumed', `posted by ${args.author}`)], SESSION_SCOPE);
}

export async function sessionDecide(args = {}) {
  O.checkAuthor(args.decided_by_role);
  if (!HUMAN_ROLE.test(args.decided_by_role)) throw new Error(`proposals are decided by a role starting with 'human' (got '${args.decided_by_role}')`);
  if (!['approve', 'reject'].includes(args.decision)) throw new Error("decision must be 'approve' or 'reject'");
  if (typeof args.reason !== 'string' || !args.reason.trim()) throw new Error('a decision needs a reason');
  const log = readSession(args.session);
  const prop = log.find(e => e.type === 'proposal' && e.proposal_id === args.proposal_id);
  if (!prop) throw new Error(`no proposal "${args.proposal_id}" in session ${args.session}`);
  const prior = log.find(e => e.type === 'decision' && e.proposal_id === args.proposal_id);
  if (prior) throw new Error(`proposal ${args.proposal_id} was already ${prior.decision === 'approve' ? 'approved' : 'rejected'} by ${prior.decided_by_role} (seq ${prior.seq})`);
  const lv = await lawsetVersion(args.lawset);
  const entry = { seq: log.length, type: 'decision', ts: new Date().toISOString(), proposal_id: args.proposal_id, decision: args.decision, decided_by_role: args.decided_by_role, reason: args.reason, lawset_version: lv };
  if (args.decision === 'approve') {
    const r = await applyEdits(log[0].organism, prop.edits, { proposal_id: args.proposal_id, approved_by: args.decided_by_role }, args.lawset);
    Object.assign(entry, { applied: r.applied, violations: r.violations, lawset_version: r.lawset_version });
  }
  append(args.session, entry);
  return envelope({ session: args.session, entry }, [p('decision', args.decision, 'assumed', `decided by ${args.decided_by_role}`)], SESSION_SCOPE);
}

export async function sessionRead(args = {}) {
  const log = readSession(args.session);
  const entries = args.since != null ? log.filter(e => e.seq > args.since) : log;
  let doc = null;
  if (log[0].organism) { try { doc = (await getDoc(log[0].organism)).doc; } catch (e) { doc = { error: e.message }; } }
  const proposals = log.filter(e => e.type === 'proposal').map(e => { const d = log.find(x => x.type === 'decision' && x.proposal_id === e.proposal_id); return { proposal_id: e.proposal_id, author: e.author, edits: e.edits.length, status: d ? (d.decision === 'approve' ? 'approved' : 'rejected') : 'open', decided_by_role: d?.decided_by_role ?? null }; });
  return envelope({ session: args.session, title: log[0].title, entries, count: log.length, proposals, organism: doc },
    [p('session log', log.length, 'assumed', `sim-engine/sessions/${args.session}.jsonl`)], SESSION_SCOPE);
}

// ---------------------------------------------------------------- registration list
export const STUDIO_TOOLS = [
  ['organism_create', organismCreate], ['organism_get', organismGet], ['organism_list_parts', organismListParts], ['organism_edit', organismEdit],
  ['scenario_list', scenarioList], ['scenario_run', scenarioRun], ['scenario_timecourse', scenarioTimecourse], ['optimize', optimize],
  ['session_open', sessionOpen], ['session_post', sessionPost], ['session_decide', sessionDecide], ['session_read', sessionRead],
].map(([name, handler]) => ({ name, ...SCHEMAS[name], handler }));
