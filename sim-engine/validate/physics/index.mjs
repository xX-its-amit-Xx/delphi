// physics_simulation: the FIFTH named result, beside genotype_similarity, phenotype_similarity,
// lean_check and functional_resolution.
//
// ============================================================================================
// WHAT THIS RESULT MEANS, AND HOW IT DIFFERS FROM lean_check. KEEP THIS DISTINCTION SHARP.
//
//   lean_check          says the design BREAKS NO LAW. Necessary, never sufficient. A brick breaks
//                       no law of flight; it just does not fly.
//   physics_simulation  says the design ACTUALLY DOES THE THING: the real scenario modules are run
//                       through the engine at every requested life stage and the criterion is
//                       measured, with the spread of its inputs carried through.
//
// A design can pass lean_check and fail here. That is the normal case and it is the point.
// ============================================================================================
//
// THE TARGET FUNCTION comes from `opts.spec` (a DesignSpec, lib/spec.mjs) whenever one is given --
// which is how the unifying validator calls us: the desired-phenotype prompt is parsed by
// parse-text.mjs into a spec and handed down. `opts.spec` is AUTHORITATIVE. With no spec, a default
// is inferred from the design's declared intent (its name and notes) and every criterion is marked
// `inferred: true` with the words it was inferred from, so a reader is never told we were asked for
// something we chose ourselves.
//
// A CRITERION NO SCENARIO CAN MODEL IS REPORTED AS `no model` AND LISTED UNDER
// `unchecked_requirements`. It is never dropped and it never counts as met. An unchecked requirement
// that reads as a pass is the failure mode this module exists to prevent.
//
// NOTHING HERE MOVES THE COMPOSITE SCORE. It sits beside it as a gate, like the Lean gate:
// `physics_gate_failed` is true when a HARD criterion is not met.
//
// No Aves data: birds are DELPHI's frozen holdout and lib/spec.mjs refuses them at the spec level.
import path from 'node:path';
import { getDoc } from '../../tools/studio.mjs';
import { resolveState, stageAges } from '../../lib/state.mjs';
import { loadScenarios, runScenario } from '../../scenarios/index.mjs';
import { validateSpec, loadRegistry, STAGES } from '../../lib/spec.mjs';
import { flightMuscleFit } from '../sanity.mjs';
import { modelConfidence, confidenceLine, studioResults } from './provenance.mjs';
import { standingChecks } from './standing.mjs';
import { ensembleOverState } from './ensemble.mjs';

export const VERSION = '1.0.0';

export const SCOPE = 'Whether the design DOES the function asked of it, measured by running the engine\'s own scenario modules. It is not a validity claim and it is not a statement that the design is biologically possible: lean_check says no law is broken (necessary, not sufficient) and this says the function is or is not achieved in the model. Every check carries the validation status of the model behind it, and a check whose model is `circular` -- scored against a number read back from the paper it is compared with -- is not evidence however green it looks. The ensemble is an UNCERTAINTY ILLUSTRATION over stated input distributions, most of whose shapes are assumed; it is not a measured distribution of real behaviour. Control, flapping, unsteady aerodynamics, take-off power, adhesion and whole-body stability are not modelled anywhere in this engine.';

// ---------------------------------------------------------------- default target functions
// Inferred ONLY when no spec is given. Each entry says which words it matched, so the inference is
// auditable. The thresholds are deliberately the repository's own observed numbers, not round ones.
export const INFERRED_FUNCTIONS = [
  { id: 'powered-flight', match: /truly flying|powered flight|flap|sustained flight|真/i,
    why: 'the design\'s declared intent claims POWERED flight, not gliding',
    criteria: [
      { scenario: 'glide', metric: 'powered_flight_margin', op: '>=', value: 1, unit: '1', params: { launch_height_m: 1 }, stages: ['adult'], hard: true,
        source_text: 'inferred: a design that claims powered flight must have an aerobic power supply at least equal to the power level flight needs (margin >= 1)' },
      { scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 10, unit: 'm', params: { launch_height_m: 1 }, stages: ['adult'], hard: true,
        source_text: 'inferred: it must at least glide; 10 m is well inside the 5-75 m band the independent harness scores the real animal against (STUDIO-RESULTS W9)' },
    ] },
  { id: 'glide', match: /flying fish|exocoet|glide|glid|winged|wing/i,
    why: 'the design\'s declared intent is a gliding fish',
    criteria: [
      { scenario: 'glide', metric: 'glide_range_total_m', op: '>=', value: 10, unit: 'm', params: { launch_height_m: 1 }, stages: ['adult'], hard: true,
        source_text: 'inferred: a realistic glide. 10 m from a 1 m launch, inside the 5-75 m band the independent harness scores the real flying fish against (STUDIO-RESULTS W9: 36.5 m at 15 m/s, pass-rests-on-assumed)' },
      { scenario: 'glide', op: 'feasible', params: { launch_height_m: 1 }, stages: ['adult'], hard: true,
        source_text: 'inferred: lift must carry the weight at the launch speed the animal can actually reach' },
    ] },
  { id: 'swim', match: /.*/,
    why: 'no flight intent is declared, so the function taken as desired is the one every fish here has: hold station in a current',
    criteria: [
      { scenario: 'current', op: 'feasible', params: { current_m_s: 0.2 }, stages: ['adult'], hard: true,
        source_text: 'inferred: hold station at 0.2 m/s, the current scenario\'s own default test speed' },
    ] },
];

/** Words the design declares about itself, for the inference. Never personal identifiers. */
export function intentText(doc, bundle) {
  const bits = [doc?.id, doc?.notes];
  for (const p of doc?.base?.parents || []) {
    bits.push(p.organism);
    const o = bundle?.organisms?.[p.organism];
    if (o) bits.push(o.name, o.label, o.notes);
  }
  for (const e of doc?.edits || []) bits.push(e.reason);
  return bits.filter(Boolean).join(' | ');
}

export function inferFunction(doc, bundle) {
  const text = intentText(doc, bundle);
  const hit = INFERRED_FUNCTIONS.find(f => f.match.test(text)) || INFERRED_FUNCTIONS.at(-1);
  return { id: hit.id, why: hit.why, inferred_from: text.slice(0, 400),
    criteria: hit.criteria.map((c, i) => ({ id: `inferred-${hit.id}-${i + 1}`, weight: 1, ...c, inferred: true })) };
}

// ---------------------------------------------------------------- stages
const STAGE_SYNONYM = { embryo: ['hatching', 'embryo'], larva: ['larva', 'larval'], juvenile: ['juvenile'], adult: ['adult'] };
/** Map a spec stage name onto the ages this organism's own staging table has.
 *  Only the stage NAME is matched, never the whole label: the flying fish's adult label reads
 *  "adult, 365 d after hatching, SL 206.2 mm", so matching the label would make `embryo` hit the adult. */
export function agesForStage(stages, want) {
  const names = STAGE_SYNONYM[want] || [want];
  const nameOf = s => String(s.label || '').split(',')[0].trim();
  const hit = stages.filter(s => names.some(n => new RegExp(`^${n}`, 'i').test(nameOf(s))));
  // One age per stage: the LAST (largest) age in the stage, the most developed form of it.
  return hit.length ? [hit.at(-1)] : [];
}
const stageListOf = c => (c.stages === 'all' ? STAGES : Array.isArray(c.stages) ? c.stages
  : c.stages && typeof c.stages === 'object' && c.stages.ageDays ? 'ageDays' : ['adult']);

// ---------------------------------------------------------------- criterion evaluation
const num = x => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const mval = (run, key) => { const m = run?.metrics?.find(x => x.key === key); return m ? num(m.value) : null; };
export function holds(op, measured, value) {
  if (op === '>=') return measured != null && measured >= value;
  if (op === '<=') return measured != null && measured <= value;
  if (op === 'survives' || op === 'feasible') return measured === true;
  return null; // maximize / minimize have no threshold: nothing to meet
}
/** What the criterion reads out of a scenario result. */
export function readCriterion(run, c) {
  if (c.op === 'survives') return { measured: run?.survives ?? null, unit: null, metric: 'survives' };
  if (c.op === 'feasible') return { measured: run?.feasible ?? null, unit: null, metric: 'feasible' };
  const m = run?.metrics?.find(x => x.key === c.metric);
  return { measured: m ? (typeof m.value === 'boolean' ? m.value : num(m.value)) : null, unit: m?.unit ?? c.unit ?? null, metric: c.metric, metric_kind: m?.kind ?? null, metric_source: m?.source ?? null, metric_reason: m?.reason ?? null };
}
/** Only params the scenario declares; an undeclared param makes runScenario refuse the whole run. */
export function filterParams(scenario, params = {}) {
  const known = new Set((scenario.params || []).map(p => p.key));
  const out = {}, dropped = [];
  for (const [k, v] of Object.entries(params)) (known.has(k) ? (out[k] = v) : dropped.push(k));
  return { params: out, dropped };
}

// ---------------------------------------------------------------- the fifth named result
/**
 * physicsCheck(design, opts)
 *   design  an organism id, an inline organism document, or {specimen} (a specimen has no STATE and
 *           is reported as `ran: false` rather than guessed at)
 *   opts    { spec, ageDays, conditions, draws, seed, ensemble, lawset, launch_height_m }
 *           `spec` is a DesignSpec and is AUTHORITATIVE when present.
 *
 * Returns the shape documented in INTERFACE.md. Never throws for a missing model: it says `no model`.
 */
export async function physicsCheck(design, opts = {}) {
  const t0 = Date.now();
  const base = { ran: false, version: VERSION, scope: SCOPE };
  if (!design || design.specimen) return { ...base, reason: design?.specimen ? 'a specimen is a shape measurement, not an organism document: it has no STATE, so no scenario can be run on it and nothing is assumed in its place' : 'no design was given' };

  let doc, bundle;
  try { ({ doc, bundle } = await getDoc(design)); }
  catch (e) { return { ...base, reason: `the design could not be resolved to an organism document: ${e.message}` }; }

  const { scenarios, errors: scenarioErrors } = await loadScenarios();
  const stages = stageAges(bundle, doc);
  const draws = opts.ensemble === false ? 0 : Math.max(0, opts.draws ?? 200);
  const seed = opts.seed ?? 'delphi-v1';
  const conditions = opts.conditions || {};

  // ---- the target function
  let target, criteria;
  if (opts.spec) {
    let v = { ok: true, errors: [], warnings: [], spec: opts.spec };
    try { v = validateSpec(JSON.parse(JSON.stringify(opts.spec)), await loadRegistry({ simRoot: path.resolve(import.meta.dirname, '..', '..') })); }
    catch (e) { v = { ok: false, errors: [`the spec could not be validated: ${e.message}`], warnings: [], spec: opts.spec }; }
    criteria = (v.spec?.criteria || []).map((c, i) => ({ id: c.id || `spec-${i + 1}`, inferred: false, ...c }));
    target = { source: 'spec', spec_ok: v.ok, spec_errors: v.errors || [], spec_warnings: v.warnings || [],
      statement: 'The target function is the DesignSpec handed in by the caller (parsed from the desired-phenotype prompt). It is authoritative: nothing was inferred.',
      n_criteria: criteria.length };
    if (!criteria.length) target.statement += ' The spec carried NO criteria, so no function was checked; that is not a pass.';
  } else {
    const inf = inferFunction(doc, bundle);
    criteria = inf.criteria;
    target = { source: 'inferred', inferred_function: inf.id, why: inf.why, inferred_from: inf.inferred_from, n_criteria: criteria.length,
      statement: `NO SPEC WAS GIVEN, so the target function was INFERRED from the design's declared intent (${inf.why}). It is what we chose to test, not what we were asked for. Pass opts.spec to test the real requirement.` };
  }

  // ---- per criterion, per stage
  const stateCache = new Map();
  const stateAt = age => { const k = String(age); if (!stateCache.has(k)) stateCache.set(k, resolveState(doc, age, conditions, bundle)); return stateCache.get(k); };
  const out = [];
  const unchecked = [];
  const usedStages = new Map();

  for (const c of criteria) {
    const s = scenarios.get(c.scenario);
    const wanted = stageListOf(c);
    const rows = [];
    if (!s) {
      const why = scenarioErrors.find(e => e.startsWith(`${c.scenario}.mjs`))
        ? `scenario "${c.scenario}" failed to load: ${scenarioErrors.find(e => e.startsWith(`${c.scenario}.mjs`))}`
        : `no scenario module "${c.scenario}" exists in sim-engine/scenarios/ (available: ${[...scenarios.keys()].join(', ')})`;
      out.push({ ...criterionHead(c), status: 'no model', per_stage: [], limiting_factor: why,
        model_confidence: modelConfidence({ extra: { statement: `NO MODEL: ${why}. This requirement was NOT checked; it is not met and it is not unmet.` } }) });
      unchecked.push({ criterion: c.id, scenario: c.scenario, metric: c.metric ?? c.op, hard: !!c.hard, why });
      continue;
    }
    const ages = wanted === 'ageDays'
      ? stages.filter(x => x.ageDays >= c.stages.ageDays.min && x.ageDays <= c.stages.ageDays.max).map(x => ({ stage: `ageDays ${x.ageDays}`, row: x }))
      : wanted.flatMap(w => { const a = agesForStage(stages, w); return a.length ? a.map(row => ({ stage: w, row })) : [{ stage: w, row: null }]; });
    if (opts.ageDays != null) ages.length = 0, ages.push({ stage: 'caller ageDays', row: { ageDays: opts.ageDays, key: 'caller', label: `age ${opts.ageDays} d` } });

    for (const { stage, row } of ages) {
      if (!row) {
        rows.push({ stage, ageDays: null, status: 'no model', measured: null, threshold: c.value ?? true, limiting_factor: `this organism's own staging table (anatomy-model/parametric/stages.json) has no "${stage}" stage, so the criterion could not be evaluated there`,
          model_confidence: modelConfidence({ scenario: s, run: null, metricKey: c.metric }) });
        unchecked.push({ criterion: c.id, scenario: c.scenario, metric: c.metric ?? c.op, hard: !!c.hard, stage, why: `no "${stage}" stage for this organism` });
        continue;
      }
      usedStages.set(row.ageDays, { stage, ...row });
      const st = stateAt(row.ageDays);
      const { params, dropped } = filterParams(s, c.params || {});
      const run = runScenario(s, st, params);
      const read = readCriterion(run, c);
      const mc = modelConfidence({ scenario: s, run: run.ok ? run : null, metricKey: c.metric });
      let status, limiting;
      if (run.ok === false) {
        status = 'no model';
        limiting = run.skipped ? `the scenario was not run: ${run.error}` : `the scenario could not run: ${run.error}`;
        unchecked.push({ criterion: c.id, scenario: c.scenario, metric: c.metric ?? c.op, hard: !!c.hard, stage, why: limiting });
      } else if (c.op === 'maximize' || c.op === 'minimize') {
        status = 'no threshold'; limiting = `a ${c.op} criterion has no threshold, so nothing can be "met"; the measured value is reported`;
      } else if (read.measured == null) {
        status = 'no model';
        limiting = read.metric_reason || (c.op === 'feasible' ? 'the scenario reports feasible = null: it does not model whether this behaviour is possible for this organism' : c.op === 'survives' ? 'the scenario reports survives = null: it does not model survival of this condition' : `metric "${c.metric}" was not computable on this STATE`);
        unchecked.push({ criterion: c.id, scenario: c.scenario, metric: c.metric ?? c.op, hard: !!c.hard, stage, why: limiting });
      } else {
        const ok = holds(c.op, read.measured, c.value);
        status = ok ? 'met' : 'not met';
        limiting = ok ? null : (run.feasibility_note || run.limiting || `${read.metric} = ${fmt(read.measured)} does not satisfy ${c.op} ${fmt(c.value ?? true)}`);
      }

      // ---- the ensemble for this criterion at this stage
      let ens = null;
      if (draws > 0 && run.ok !== false) {
        const launchH = (c.params?.launch_height_m ?? opts.launch_height_m ?? 1);
        // The engine's OWN launch speed for this STATE. The 15-20 m/s taxi band is measured for adult
        // flying fish only, so the band is drawn only when the engine itself credits this stage with a
        // taxi speed; otherwise a larva would be handed an adult take-off speed. See ensemble.mjs.
        const v0 = mval(run, 'launch_airspeed_m_s');
        const e = await ensembleOverState({ state: st, draws, seed: `${seed}|${c.id}|${row.ageDays}`, launch_height_m: launchH,
          launch_airspeed_m_s: v0, allow_launch_draw: v0 != null && v0 >= 15,
          runOne: (drawState, drawParams) => { const { params: pp } = filterParams(s, { ...params, ...drawParams }); return runScenario(s, drawState, pp); } });
        const vals = e.rows.map(r => readCriterion(r.result, c).measured);
        const numeric = vals.filter(v => typeof v === 'number' && Number.isFinite(v));
        const achieved = vals.filter(v => holds(c.op, typeof v === 'boolean' ? v : v, c.value) === true).length;
        const stat = numeric.length ? e.summarise(numeric) : { n: 0, median: null, p5: null, p95: null, min: null, max: null, mean: null };
        ens = { source: e.source, file: e.file, ...(e.fell_back_because ? { fell_back_because: e.fell_back_because } : {}), seed: e.seed, draws: e.draws,
          fraction_achieved: +(achieved / e.draws).toFixed(4), draws_achieved: achieved,
          median: stat.median, p5: stat.p5, p95: stat.p95, min: stat.min, max: stat.max, n_numeric: stat.n,
          unit: read.unit, species_gate: e.species_gate, not_drawn: e.not_drawn, sea_state: e.sea_state, distributions: e.distributions, note: e.note,
          rule: 'fraction_achieved is the share of draws in which the criterion holds. A design that achieves its function in a minority of draws has NOT achieved it: when fraction_achieved < 0.5 the status below is "not met" however the single deterministic run came out.' };
        if (status === 'met' && ens.fraction_achieved < 0.5) {
          status = 'not met';
          limiting = `the single deterministic run meets this criterion, but it holds in only ${(ens.fraction_achieved * 100).toFixed(1)} % of ${ens.draws} draws over the stated input distributions (median ${fmt(ens.median)}${read.unit ? ' ' + read.unit : ''}, 5-95 % ${fmt(ens.p5)} to ${fmt(ens.p95)}): the inputs do not support the claim`;
        }
        else if (status === 'not met') {
          limiting = `${limiting} [achieved in ${(ens.fraction_achieved * 100).toFixed(1)} % of ${ens.draws} draws over the stated input distributions; median ${fmt(ens.median)}${read.unit ? ' ' + read.unit : ''}, 5-95 % ${fmt(ens.p5)} to ${fmt(ens.p95)}]`;
          if (ens.fraction_achieved >= 0.5) ens.disagrees_with_point_estimate = `the deterministic run does NOT meet this criterion but ${(ens.fraction_achieved * 100).toFixed(1)} % of draws do; the engine's own single number sits low in the band (for the glide scenario it takes 15 m/s, the LOWER edge of the measured 15-20 m/s launch band)`;
        }
      }

      rows.push({ stage, ageDays: row.ageDays, stage_label: row.label, SL_m: st.SL_m?.value ?? null, mass_kg: st.mass_kg?.value ?? null,
        status, measured: read.measured, metric: read.metric, metric_kind: read.metric_kind ?? null, unit: read.unit,
        threshold: c.op === 'feasible' || c.op === 'survives' ? true : (c.value ?? null), op: c.op,
        limiting_factor: limiting, out_of_validity: run.ok && run.validity?.inRange === false ? run.validity.notes : null,
        dropped_params: dropped.length ? dropped : null, ensemble: ens, model_confidence: mc,
        statement: `${status}${status === 'met' || status === 'not met' ? ` (${confidenceLine(mc)})` : ''}`,
      });
    }
    const roll = rollup(rows);
    out.push({ ...criterionHead(c), status: roll.status, stages_met: roll.met, stages_total: rows.length, per_stage: rows,
      limiting_factor: roll.limiting, model_confidence: rows.find(r => r.model_confidence)?.model_confidence ?? null });
  }

  // ---- standing checks at every stage the function was evaluated at (adult if none)
  const standStages = usedStages.size ? [...usedStages.values()] : agesForStage(stages, 'adult').map(r => ({ stage: 'adult', ...r }));
  const gl = scenarios.get('glide'), cu = scenarios.get('current');
  const standing = [];
  for (const sr of standStages) {
    const st = stateAt(sr.ageDays);
    const runs = { glide: gl ? runScenario(gl, st, filterParams(gl, { launch_height_m: opts.launch_height_m ?? 1 }).params) : null,
      current: cu ? runScenario(cu, st, filterParams(cu, {}).params) : null };
    for (const chk of standingChecks({ state: st, runs, scenarios: { glide: gl, current: cu }, doc, bundle, flightMuscleFit }))
      standing.push({ stage: sr.stage, ageDays: sr.ageDays, ...chk });
  }

  // ---- the gate
  const hard = out.filter(c => c.hard !== false);
  const failed = hard.filter(c => c.status === 'not met');
  const noModel = hard.filter(c => c.status === 'no model');
  const met = hard.filter(c => c.status === 'met');
  const standingFailed = standing.filter(s => s.status === 'not met');
  const physics_gate_failed = failed.length > 0;
  const gate_status = failed.length ? 'fail' : noModel.length ? 'incomplete' : hard.length ? 'pass' : 'nothing checked';
  const function_achieved = hard.length > 0 && failed.length === 0 && noModel.length === 0;

  const gate = [
    noModel.length ? `INCOMPLETE: ${noModel.length} of ${hard.length} hard criteria have NO MODEL and were NOT checked (${noModel.map(c => `${c.scenario}/${c.metric || c.op}`).join(', ')}). The gate below does not cover them.` : null,
    failed.length ? `FAIL: the design does not do what was asked. ${failed.length} hard criterion(s) not met: ${failed.map(c => `${c.scenario}/${c.metric || c.op} -- ${c.limiting_factor}`).join(' | ')}` : null,
    !failed.length && !noModel.length && hard.length ? `Every hard criterion is met (${met.map(c => `${c.scenario}/${c.metric || c.op}`).join(', ')}). This is a model result, not a demonstration: ${out.filter(c => c.model_confidence?.circular).length} of ${out.length} criteria rest on a model the independent harness calls circular.` : null,
    !hard.length ? 'NOTHING WAS CHECKED: the target function carried no hard criterion, which is not a pass.' : null,
    standingFailed.length ? `Standing physical checks failed (reported beside the gate, not folded into it): ${standingFailed.map(s => `${s.id}@${s.stage} -- ${s.limiting_factor}`).join(' | ')}` : null,
  ].filter(Boolean).join(' ');

  const circular = [...out.flatMap(c => (c.model_confidence?.circular ? [{ where: `criterion ${c.id} (${c.scenario}/${c.metric || c.op})`, why: c.model_confidence.circular_inputs }] : [])),
    ...standing.filter(s => s.model_confidence?.circular).map(s => ({ where: `standing check ${s.id}@${s.stage}`, why: s.model_confidence.circular_inputs }))];
  const restsOnAssumed = [...out.filter(c => c.model_confidence?.validated === 'rests-on-assumed').map(c => `criterion ${c.id} (${c.scenario}/${c.metric || c.op}): weakest input ${c.model_confidence.weakest_input_kind}`),
    ...standing.filter(s => s.model_confidence?.validated === 'rests-on-assumed').map(s => `standing check ${s.id}@${s.stage}: weakest input ${s.model_confidence.weakest_input_kind}`)];

  return {
    ran: true, version: VERSION,
    design: { id: doc.id, parents: doc.base?.parents ?? [], n_edits: (doc.edits || []).length, species: stateAt(standStages[0]?.ageDays ?? stages.at(-1).ageDays)?.species?.value ?? null },
    target_function: target,
    criteria: out,
    standing_checks: standing,
    unchecked_requirements: unchecked,
    function_achieved,
    physics_gate_failed, gate_status, gate,
    summary: { hard_criteria: hard.length, met: met.length, not_met: failed.length, no_model: noModel.length,
      standing_checks: standing.length, standing_failed: standingFailed.length, standing_no_model: standing.filter(s => s.status === 'no model').length },
    model_honesty: { circular_checks: circular, rests_on_assumed: restsOnAssumed,
      independent_harness: studioResults().error || `sim-engine/validation/studio-results.json, generated ${studioResults().generated_at}`,
      statement: 'STUDIO-FINDINGS.md\'s one honest sentence applies to everything above: every numeric wild-type value that lands in band is read straight from the paper it is scored against. The negative controls (a zebrafish that cannot glide, a wingless flying fish that cannot glide, a TFF that cannot pay for powered flight) are the part of this result that is NOT circular, because they turn on inequalities between independently sourced quantities rather than on a fitted number.' },
    scenario_errors: scenarioErrors,
    scope: SCOPE, ms: Date.now() - t0,
  };
}

const criterionHead = c => ({ id: c.id, scenario: c.scenario, metric: c.metric ?? null, op: c.op, value: c.value ?? null, unit: c.unit ?? null,
  stages: c.stages ?? ['adult'], hard: c.hard !== false, weight: c.weight ?? 1, inferred: !!c.inferred, source_text: c.source_text ?? null, params: c.params ?? {} });

function rollup(rows) {
  if (!rows.length) return { status: 'no model', met: 0, limiting: 'no stage was evaluated' };
  const met = rows.filter(r => r.status === 'met').length;
  const notMet = rows.filter(r => r.status === 'not met');
  const noModel = rows.filter(r => r.status === 'no model');
  if (notMet.length) return { status: 'not met', met, limiting: notMet.map(r => `${r.stage}: ${r.limiting_factor}`).join(' | ') };
  if (met === 0 && noModel.length) return { status: 'no model', met, limiting: noModel.map(r => `${r.stage}: ${r.limiting_factor}`).join(' | ') };
  if (noModel.length) return { status: 'met in part', met, limiting: `met at ${met} stage(s); NO MODEL at ${noModel.map(r => r.stage).join(', ')}, so those stages are unchecked` };
  if (rows.every(r => r.status === 'no threshold')) return { status: 'no threshold', met, limiting: rows[0].limiting_factor };
  return { status: 'met', met, limiting: null };
}
const fmt = x => (typeof x === 'number' ? (Math.abs(x) >= 1000 || (x !== 0 && Math.abs(x) < 1e-3) ? x.toExponential(3) : +x.toFixed(4)) : String(x));
