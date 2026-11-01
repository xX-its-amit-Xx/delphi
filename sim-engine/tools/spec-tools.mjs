// Functional-criteria tools: turn a request into a DesignSpec, then design against it.
//
//   parse_design_text  text → { spec, unparsed, refused, assumptions, validation }
//   design_from_spec   spec → validate → evaluate the starting design → optimize → explain
//
// Same shape as tools/wrappers.mjs and tools/studio.mjs: schema objects plus handlers, every handler
// returning the provenance envelope. SPEC_TOOLS is the registration list (tools/SPEC-REGISTER.md).
// server.mjs is not edited from here.
//
// For an LLM agent: the agent does the language understanding and writes the DesignSpec itself
// (AGENT-GUIDE-SPEC.md). parse_design_text is a deterministic fallback and a cross-check, not a
// language model: whatever it cannot read comes back in `unparsed`, verbatim, and must be resolved
// by asking the user, never by guessing.

import { envelope, p } from '../lib/envelope.mjs';
import { parseDesignText } from '../lib/parse-text.mjs';
import { loadRegistry, validateSpec, specToObjective, evaluateDesign, explainResult, stagePoints, OPS, STAGES } from '../lib/spec.mjs';

let registryPromise = null;
const registry = () => (registryPromise ||= loadRegistry());

const SPEC_SCHEMA = {
  type: 'object',
  description: 'A DesignSpec (sim-engine/lib/spec.mjs).',
  properties: {
    start_from: { type: 'array', items: { type: 'object', properties: { organism: { type: 'string', description: 'zebrafish-adult, zebrafish-larva, flying-fish, tff, winged-zebrafish, wingless-flying-fish, ff-zf-chimera' }, weight: { type: 'number' } }, required: ['organism', 'weight'] }, description: 'Parents and weights; weights sum to 1. Birds are refused (frozen holdout).' },
    base_edits: { type: 'array', items: { type: 'object' }, description: 'Optional organism.mjs edits applied before optimizing: {target:{level,id}, param, op:"set"|"scale"|"add", value}.' },
    criteria: { type: 'array', items: { type: 'object', properties: {
      scenario: { type: 'string', description: 'A key from scenario_list.' },
      params: { type: 'object', description: 'Scenario parameters (aliases such as water_temp_C or pressure_kPa are mapped and converted; the result says so).' },
      metric: { type: 'string', description: 'A metric key the scenario declares. Not needed for op "survives".' },
      op: { enum: OPS, description: 'survives = the organism lives (run().survives); feasible = the behaviour is possible (run().feasible: can glide, hold station, grip, escape).' },
      value: { type: 'number' }, unit: { type: 'string' },
      stages: { description: `'all', a list of ${STAGES.join('/')}, or {ageDays:{min,max}} (days after hatching). Default ['adult'].` },
      weight: { type: 'number', description: 'Soft-criterion weight (default 1).' },
      hard: { type: 'boolean', description: 'Default: true for >=, <=, survives; false (and must be) for maximize/minimize.' },
    }, required: ['scenario', 'op'] } },
    editable: { type: 'array', items: { type: 'object', properties: { target: { type: 'object', properties: { level: { type: 'string' }, id: { type: 'string' } } }, param: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' } }, required: ['target', 'param'] }, description: 'Decision variables. Use organism_list_parts for valid targets and params.' },
    constraints: { type: 'object', properties: { lean: { const: 'must-hold' } } },
  },
  required: ['start_from', 'criteria'],
};

// ── parse_design_text ──────────────────────────────────────────────────────
export const parseSchema = {
  title: 'Parse a design request (plain English) into a DesignSpec',
  description:
    'Deterministic, rule-based parser (no LLM). Returns the DesignSpec it could read, every piece of text it could NOT read (`unparsed`, verbatim, with the reason), requests it refused (`refused`: birds are a frozen holdout; Lean laws cannot be waived), every default it applied (`assumptions`), and the spec validated against the engine (`validation`). An agent should resolve every unparsed item with the user before calling design_from_spec.',
  inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The request, e.g. "a zebrafish that glides at least 30 m from 1 m, survives 4 °C to 32 °C, outswims a 0.3 m/s current as a larva and adult".' } }, required: ['text'] },
};

export async function parseDesignTextTool(args = {}) {
  const r = parseDesignText(args.text);
  const reg = await registry();
  const v = validateSpec(r.spec, reg);
  return envelope({ ...r, validation: { ok: v.ok, errors: v.errors, warnings: v.warnings, normalised_spec: v.spec }, engine: reg.sources },
    [p('parser', 'sim-engine/lib/parse-text.mjs', 'derived', 'Rule-based; no model, no network. The same text always gives the same spec.')],
    'A parse of the words, not an understanding of the request. Anything the rules do not cover is in `unparsed` and was NOT turned into a criterion; ' +
    'defaults the parser applied are in `assumptions`. Validation checks names, units and ranges against the scenario modules; it says nothing about whether the design can meet the criteria.');
}

// ── design_from_spec ───────────────────────────────────────────────────────
export const designSchema = {
  title: 'Design an organism that meets a functional spec',
  description:
    'Validates the DesignSpec against the engine (unknown scenarios, metrics, units, parts and params are rejected with the reason), evaluates the starting design on every criterion at every requested stage, runs the `optimize` tool over the editable parameters with the hard criteria as constraints and the Lean laws holding, then explains the result per criterion and per stage: met / failed / no-model, with the limiting factor and the weakest provenance kind behind each verdict. A design "meets the spec" only if every hard criterion holds at every requested stage and no Lean law is violated; a criterion with no model counts as NOT met.',
  inputSchema: { type: 'object', properties: {
    spec: SPEC_SCHEMA,
    text: { type: 'string', description: 'Alternative to spec: parsed with parse_design_text first; refused or unparsed text stops the run.' },
    budget: { type: 'integer', description: 'Optimizer evaluations (default 60, max 400).' },
    seed: { type: 'integer' }, restarts: { type: 'integer' },
    strict: { type: 'boolean', description: 'Reject ANY binding Lean violation, including ones the unedited parents already have (default: reject only NEW ones, as optimize does).' },
    evaluate_only: { type: 'boolean', description: 'Skip the optimizer: validate and explain the starting design only.' },
  } },
};

// Lean verdicts for a document at the ages the spec visits, in the {id, holds} form explainResult takes.
async function leanFor(doc, baseDoc, ages, reg, strict) {
  const { leanVerdicts } = await import('../lib/lean.mjs');
  const out = [];
  for (const age of ages) {
    const state = reg.resolveState(doc, age, {});
    const base = reg.resolveState(baseDoc, age, {});
    const r = await leanVerdicts(state, { baselineState: base });
    for (const v of r.violations) {
      const isNew = v.baseline_violated === false;
      out.push({ id: v.law_id || v.lean_ref?.constraint, constraint: v.lean_ref?.constraint, ageDays: age, binding: !!v.binding, contested: !!v.contested,
        new: isNew, message: v.message, parts: v.parts,
        holds: !(v.binding && !v.contested && (strict || isNew)) });
    }
  }
  return out;
}

// Pick the one metric the single-objective optimizer climbs. The rest of the spec is still checked
// afterwards by explainResult, so the choice affects search direction, never the verdict.
function chooseObjective(spec, reg) {
  const soft = spec.criteria.filter(c => !c.hard && c.metric).sort((a, b) => b.weight - a.weight);
  const pick = soft.find(c => c.op === 'maximize' || c.op === 'minimize') || soft[0]
    || spec.criteria.find(c => c.hard && c.metric && (c.op === '>=' || c.op === '<='));
  if (pick) return { criterion: pick.id, scenario: pick.scenario, metric: pick.metric, params: pick.params,
    direction: pick.op === 'minimize' || pick.op === '<=' ? 'minimize' : 'maximize', surrogate: false };
  // survives/feasible-only spec: climb the first declared better-is-higher metric of the first hard scenario
  for (const c of spec.criteria) {
    const m = (reg.scenarios[c.scenario]?.metrics || []).find(x => x.better === 'higher' && !/bool/.test(x.unit || ''));
    if (m) return { criterion: c.id, scenario: c.scenario, metric: m.key, params: c.params, direction: 'maximize', surrogate: true,
      note: `no numeric criterion: the optimizer climbs ${c.scenario}.${m.key} (declared better=higher) as a surrogate for "survives"` };
  }
  return null;
}

// Hard criteria → optimize's hard_constraints, one per (criterion, stage age).
function hardConstraints(spec, table) {
  const out = [], skipped = [];
  for (const c of spec.criteria.filter(c => c.hard)) for (const pt of stagePoints(c, table)) {
    if (c.op === 'survives') out.push({ scenario: c.scenario, survives: true, params: c.params, ageDays: pt.ageDays });
    else if (c.op === 'feasible') out.push({ scenario: c.scenario, feasible: true, params: c.params, ageDays: pt.ageDays });
    else if (c.unit === 'BL/s' && !/bl_s$/i.test(c.metric)) skipped.push({ id: c.id, why: 'BL/s threshold on an m/s metric: checked after optimisation, not inside it' });
    else out.push({ scenario: c.scenario, metric: c.metric, op: c.op, value: c.value, params: c.params, ageDays: pt.ageDays });
  }
  return { out, skipped };
}

export async function designFromSpec(args = {}) {
  const reg = await registry();
  const prov = [p('spec engine', 'sim-engine/lib/spec.mjs', 'derived', 'validateSpec, specToObjective, explainResult: no new empirical content.')];
  let parsed = null, input = args.spec;
  if (!input && typeof args.text === 'string') {
    parsed = parseDesignText(args.text);
    if (parsed.refused.length || parsed.unparsed.length)
      return envelope({ status: 'needs clarification', parsed }, prov, 'Nothing was designed: part of the request was refused or not understood. Resolve every refused and unparsed item, then call again with a spec.');
    input = parsed.spec;
  }
  if (!input) throw new Error('design_from_spec needs `spec` (a DesignSpec) or `text`');

  const v = validateSpec(input, reg);
  if (!v.ok) return envelope({ status: 'invalid', validation: { errors: v.errors, warnings: v.warnings }, parsed }, prov,
    'Nothing was designed or evaluated: the spec names something the engine does not have, or is self-contradictory. Fix each error and call again.');
  const spec = v.spec;
  const objective = specToObjective(spec);
  const baseDoc = reg.docFor(spec);
  const table = reg.stagesFor(baseDoc);
  const ages = [...new Set(spec.criteria.flatMap(c => stagePoints(c, table).map(x => x.ageDays)))];

  // 1. the starting design
  const baseEvals = await evaluateDesign(spec, baseDoc, reg);
  const baseLean = await leanFor(baseDoc, baseDoc, ages, reg, !!args.strict);
  const baseline = Object.fromEntries(spec.criteria.filter(c => c.op === 'maximize' || c.op === 'minimize').map(c => {
    const vals = Object.values(baseEvals[c.id] || {}).map(e => e.run?.metrics?.find(m => m.key === c.metric)?.value).filter(x => typeof x === 'number');
    return [c.id, vals.length ? Math.min(...vals) : null];
  }));
  const baseExplain = explainResult(spec, baseEvals, { lean: baseLean, baseline });

  const result = { status: null, validation: { warnings: v.warnings }, spec, objective: objective.describe, starting_design: { doc: baseDoc, explanation: baseExplain } };
  const ranged = (spec.editable || []).filter(e => typeof e.min === 'number' && typeof e.max === 'number' && e.max > e.min);
  if (args.evaluate_only || !ranged.length) {
    result.status = 'evaluated-only';
    result.reason = args.evaluate_only ? 'evaluate_only was set' : 'no editable parameter with a range: there is nothing to optimise';
    result.meets = baseExplain.meets; result.summary = baseExplain.summary;
    return envelope(result, prov, scopeText(false));
  }

  // 2. optimise
  const obj = chooseObjective(spec, reg);
  if (!obj) { result.status = 'no-objective'; result.reason = 'no criterion maps to a scenario metric the optimizer can climb'; result.meets = baseExplain.meets; result.summary = baseExplain.summary; return envelope(result, prov, scopeText(false)); }
  const objCrit = spec.criteria.find(c => c.id === obj.criterion);
  const objAge = stagePoints(objCrit, table)[0]?.ageDays;
  const { out: hard, skipped } = hardConstraints(spec, table);
  let opt;
  try {
    const { optimize } = await import('./studio.mjs');
    opt = await optimize({ organism: baseDoc, objective: { scenario: obj.scenario, metric: obj.metric, params: obj.params, ageDays: objAge, direction: obj.direction },
      variables: ranged.map(e => ({ target: e.target, param: e.param, min: e.min, max: e.max })), hard_constraints: hard,
      budget: args.budget, seed: args.seed, restarts: args.restarts, strict: !!args.strict });
  } catch (e) {
    result.status = 'optimizer-error'; result.error = e.message; result.meets = baseExplain.meets; result.summary = baseExplain.summary;
    return envelope(result, prov, scopeText(false));
  }
  const o = opt.result;
  result.optimizer = { objective: { ...obj, ageDays: objAge }, hard_constraints: hard.length, not_passed_to_optimizer: skipped,
    // optimize reports feasible_candidates on 'ok'; on 'no improvement' count them from its trace
    status: o.status, evaluations: o.evaluations, feasible_candidates: feasibleCount(o), rejected_count: o.rejected?.length ?? 0,
    start: o.start ?? null, note: o.note ?? null,
    rejected_sample: (o.rejected || []).slice(0, 8), best_values: o.best?.values ?? null, scope: opt.scope };
  prov.push(...(opt.provenance || []));

  // 3. re-check the best design on the WHOLE spec, at every stage, with Lean
  if (!o.best) {
    result.status = 'no design meets the spec';
    result.meets = false;
    result.summary = `No candidate in ${o.evaluations} evaluations satisfied the hard criteria and the Lean laws together. The starting design: ${baseExplain.summary}`;
    return envelope(result, prov, scopeText(true));
  }
  const bestDoc = o.best.doc;
  const bestEvals = await evaluateDesign(spec, bestDoc, reg);
  const bestLean = await leanFor(bestDoc, baseDoc, ages, reg, !!args.strict);
  const bestExplain = explainResult(spec, bestEvals, { lean: bestLean, baseline });
  result.status = bestExplain.meets ? 'meets the spec' : 'best found does not meet the spec';
  result.meets = bestExplain.meets;
  result.summary = bestExplain.summary;
  result.design = { doc: bestDoc, explanation: bestExplain };
  return envelope(result, prov, scopeText(true));
}

export function feasibleCount(o) {
  if (typeof o?.feasible_candidates === 'number') return o.feasible_candidates;
  return (o?.trace || []).filter(x => x.metric !== null && x.values !== 'start').length;
}

function scopeText(optimised) {
  return (optimised ? 'A local, seeded search (the optimize tool) over the editable parameters, climbing one metric; every other criterion is re-checked on the result at every requested stage. Not a global optimum. ' : '') +
    'Verdicts are only as good as the scenario models and the STATE inputs they rest on; each criterion row carries the weakest provenance kind behind it and the model\'s limiting factor. ' +
    'Lean verdicts are floating-point evaluations of the Lean-backed formulas, not kernel checks; by default only NEW binding violations (absent from the unedited parents) fail a design. ' +
    'A "no-model" criterion is not met. A designed parameter set is a shape, not a viable organism: MORPHOLOGICAL interpolation, not genetic hybridisation.';
}

export const SPEC_TOOLS = [
  { name: 'parse_design_text', ...parseSchema, handler: args => parseDesignTextTool(args) },
  { name: 'design_from_spec', ...designSchema, handler: args => designFromSpec(args) },
];
