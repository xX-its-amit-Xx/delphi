#!/usr/bin/env node
// gen.mjs -- builds validate-show/run-<case>.json by RUNNING the real validator.
//
// Nothing in here is a mock and nothing is typed in by hand. Every number in the output came back from
// sim-engine on this run; every field carries where it came from. Run it with:
//
//     node dashboard/public/validate-show/gen.mjs
//
// The exact command and the timestamp are recorded into each file's `meta`.
//
// TWO REAL SOURCES, both run here, neither substituting for the other:
//   1. validateGeneration({generated, base, desired_phenotype}) -- sim-engine/validate/pipeline/index.mjs.
//      The unifying validator. Gives the parsed ask, the sequence basis, the difference set, the functional
//      analogue, the ten scales with their per-scale coverage, the FIVE named gates, and the verdict.
//   2. scenarioRun({organism, scenario, params}) -- sim-engine/tools/studio.mjs, once per condition.
//      The pipeline only runs the criteria the desired phenotype actually asked for; the condition montage
//      flies the SAME design through eight named conditions so a viewer can see the envelope rather than
//      one number. These are additional real runs, and the page labels them as the montage, not as the gate.
//
// WHAT IS NOT HARDCODED TO ANY ONE CASE (Amit's generality requirement):
//   * the case classification (addition / subtraction / functional / blend) is DERIVED from the pipeline's
//     own difference set -- direction and ratio per changed parameter. Nothing in the logic says "fins".
//   * the criteria in act 1 are the pipeline's parse of the desired-phenotype text, including the clauses it
//     could NOT parse, which the page shows in red.
//   * the analogue, including its three different outcomes, is the pipeline's.
//   * the montage runs the same eight conditions over whatever organism it is handed.
// Adding a fifth case is adding a row to CASES, nothing else.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const RESOLVED = path.join(REPO, 'anatomy-model', 'parametric', 'resolved');
const MODELS = path.join(REPO, 'dashboard', 'public', 'blueprint3d', 'model');

// Windows: a dynamic import() of an absolute path must be a file:// URL, not 'D:\...'.
const imp = (...parts) => pathToFileURL(path.join(REPO, ...parts)).href;

const COMMAND = 'node dashboard/public/validate-show/gen.mjs';

// ---------------------------------------------------------------------------------------------------
// The subjects. A case is an organism id the sim-engine bundle already knows, plus the desired-phenotype
// TEXT a user would have typed. The text is the only prose here, and it is the INPUT to the run.
const CASES = [
  {
    id: 'winged-zebrafish', headline: true,
    desired_phenotype:
      'A zebrafish with enlarged, wing-like pectoral fins that can glide over the water after leaping, '
      + 'and that stays a healthy fish while doing it.',
  },
  {
    id: 'wingless-flying-fish',
    desired_phenotype:
      'A flying fish that keeps gliding over the water, but with ordinary pectoral fins rather than enlarged ones.',
  },
  {
    id: 'tff',
    desired_phenotype:
      'A fish that truly flies under its own power, flapping rather than only gliding, and handles high altitude.',
  },
  {
    id: 'ff-zf-chimera',
    desired_phenotype:
      'A fish halfway between a zebrafish and a flying fish that still glides over the water.',
  },
];

// The condition montage. Amit's list, each one a REAL scenario in sim-engine/scenarios/, run per case.
const CONDITIONS = [
  { key: 'calm-glide', scenario: 'glide',       label: 'Calm glide',        params: { launch_height_m: 1, ground_effect: 1 },                   blurb: 'Still air, launched from one metre above the surface.' },
  { key: 'headwind',   scenario: 'wind',        label: 'Headwind',          params: { headwind_m_s: 5, gust_m_s: 2, launch_height_m: 1 },       blurb: 'A five-metre-per-second headwind with two-metre gusts.' },
  { key: 'altitude',   scenario: 'altitude',    label: '2 km altitude',     params: { altitude_m: 2000, launch_height_m: 1 },                   blurb: 'Thin air at two kilometres: less lift and less oxygen.' },
  { key: 'cold-water', scenario: 'temperature', label: 'Cold water',        params: { water_temperature_C: 12, acclimation_temperature_C: 25 }, blurb: 'Twelve degrees, colder than it is acclimated to.' },
  { key: 'warm-water', scenario: 'temperature', label: 'Warm water',        params: { water_temperature_C: 32, acclimation_temperature_C: 25 }, blurb: 'Thirty-two degrees, warmer than it is acclimated to.' },
  { key: 'current',    scenario: 'current',     label: 'Against a current', params: { current_m_s: 0.4 },                                       blurb: 'Holding station against a forty-centimetre-per-second current.' },
  { key: 'predator',   scenario: 'predator',    label: 'Predator escape',   params: { predator_speed_ratio: 1.5 },                              blurb: 'A predator closing at one and a half times its speed.' },
  { key: 'deep-water', scenario: 'pressure',    label: 'Deep water',        params: { depth_m: 50 },                                            blurb: 'Fifty metres down, where the swim bladder compresses.' },
];

// ---------------------------------------------------------------------------------------------------
// Parameter vocabulary: a LABEL table for parameter NAMES, not case-specific content. Any design moving any
// of these gets a readable label; one moving something not listed still works through humanise().
const PARAM_LABELS = {
  standard_length_m: ['standard length', null], body_mass_kg: ['body mass', null],
  body_depth_over_SL: ['body depth', 'body'], body_width_over_SL: ['body width', 'body'],
  body_section_exponent: ['body cross-section fullness', 'body'], head_fraction_SL: ['head length', 'head'],
  peduncle_depth_frac: ['tail-base depth', 'peduncle'], peduncle_width_frac: ['tail-base width', 'peduncle'],
  pectoral_len_over_SL: ['pectoral fin length', 'pectoral fin'], pectoral_span_over_SL: ['pectoral fin span', 'pectoral fin'],
  pectoral_area_over_SL2: ['pectoral fin area', 'pectoral fin'], pectoral_ray_count: ['pectoral fin ray count', 'pectoral fin'],
  pelvic_len_over_SL: ['pelvic fin length', 'pelvic fin'], pelvic_ray_count: ['pelvic fin ray count', 'pelvic fin'],
  dorsal_height_over_SL: ['dorsal fin height', 'dorsal fin'], dorsal_ray_count: ['dorsal fin ray count', 'dorsal fin'],
  anal_height_over_SL: ['anal fin height', 'anal fin'], anal_ray_count: ['anal fin ray count', 'anal fin'],
  caudal_upper_lobe_over_SL: ['upper tail lobe length', 'caudal fin'], caudal_lower_lobe_over_SL: ['lower tail lobe length', 'caudal fin'],
  caudal_ray_count: ['tail fin ray count', 'caudal fin'], vertebra_count: ['vertebra count', 'skeleton'],
  myomere_count: ['muscle-block count', 'muscle'], flight_muscle_fraction: ['flight-muscle fraction', 'pectoral girdle muscle'],
  mesh_detail: ['mesh subdivision (a drawing setting, not anatomy)', null],
};
// Parameters about what the animal can DO rather than what shape it is. Moving one is a FUNCTIONAL change,
// and that is how `kind` tells a functional addition from a morphological one.
const FUNCTIONAL_PARAMS = new Set(['flight_muscle_fraction']);
// Parameters that only affect how the model is drawn. Moving one is not a change to the organism.
const DRAWING_ONLY = new Set(['mesh_detail']);

const humanise = p => String(p).replace(/_over_SL2$/, ' / SL^2').replace(/_over_SL$/, ' / SL').replace(/_m$/, '').replace(/_/g, ' ');
const labelOf = p => (PARAM_LABELS[p] ? PARAM_LABELS[p][0] : humanise(p));
const partOf = p => (PARAM_LABELS[p] ? PARAM_LABELS[p][1] : null);
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const MANIFEST_OF = { 'flying-fish': 'manifest.json', 'zebrafish-adult': 'manifest-adult.json', tff: 'tff-manifest.json' };
const meshFor = id => {
  if (!id) return null;
  const manifest = MANIFEST_OF[id] || `${id}-manifest.json`;
  if (!fs.existsSync(path.join(MODELS, manifest))) return null;
  const mf = readJSON(path.join(MODELS, manifest));
  const glb = mf?.file ? path.basename(mf.file) : `${id}.glb`;
  return fs.existsSync(path.join(MODELS, glb)) ? { organism: id, glb, manifest } : null;
};
const r4 = n => (typeof n === 'number' && Number.isFinite(n) ? +n.toFixed(6) : n);
const rx = n => (typeof n === 'number' && Number.isFinite(n) ? (n >= 100 || n < 0.01 ? n.toPrecision(3) : n.toFixed(2)) : '?');

// ---------------------------------------------------------------------------------------------------
/** The case classification, DERIVED from the pipeline's own difference set. Returns the sentence saying how
 *  it decided, so the page can show its reasoning rather than assert a label. */
function classify(diffs, resolved, parentSets) {
  const parents = resolved.parents || [];
  const entries = (diffs?.entries || []).filter(e => e.kind === 'parameter' && !DRAWING_ONLY.has(e.parameter));

  const changed = entries.map(e => ({
    parameter: e.parameter, label: labelOf(e.parameter), part: partOf(e.parameter),
    from: r4(e.base_value), to: r4(e.generated_value), direction: e.direction ?? null,
    factor: r4(e.ratio), delta: typeof e.base_value === 'number' && typeof e.generated_value === 'number' ? r4(e.generated_value - e.base_value) : null,
    functional: FUNCTIONAL_PARAMS.has(e.parameter),
    kind: e.generated_kind ?? null, source: e.generated_source ?? null,
    base_kind: e.base_kind ?? null,
    toward_the_analogue: e.toward_the_analogue ?? null,
  }));

  const ups = changed.filter(c => c.direction === 'increase'), downs = changed.filter(c => c.direction === 'decrease');
  const direction = ups.length && downs.length ? 'mixed' : ups.length ? 'increase' : downs.length ? 'decrease' : 'none';
  const fnMoved = changed.filter(c => c.functional);
  const blend = parents.length > 1;
  const pList = parents.map(p => `${Math.round(p.weight * 100)}% ${p.organism}`).join(' + ');

  let kind, how;
  if (blend) {
    kind = 'blend';
    how = `anatomy-model/parametric/resolved/${resolved.id}.json declares TWO parents (${pList}), so every parameter is a weighted mean `
      + `of the two rather than a parent value plus a delta. The validator's difference set against the base reports ${changed.length} changed `
      + `parameter(s); for a blend these are the places the two parents disagree, not a deliberate edit. This is a BLEND.`;
  } else if (fnMoved.length) {
    kind = fnMoved.every(c => c.direction === 'decrease') ? 'functional-subtraction' : 'functional-addition';
    how = `the difference set includes ${fnMoved.map(c => c.parameter).join(', ')}, which is about what the animal can DO rather than what shape it is `
      + `(${fnMoved.map(c => `${c.label} ${c.direction}d ${rx(c.factor)}x`).join('; ')}), so this is a FUNCTIONAL change. Derived from the validator's own `
      + `difference set between ${resolved.id} and its base.`;
  } else if (direction === 'increase') {
    kind = 'morphological-addition';
    how = `all ${ups.length} changed parameter(s) are LARGER in the design than in its base (${ups.map(c => `${c.label} x${rx(c.factor)}`).join('; ')}), `
      + `and none is a functional parameter, so this is a MORPHOLOGICAL ADDITION. Derived from the validator's difference set.`;
  } else if (direction === 'decrease') {
    kind = 'morphological-subtraction';
    how = `all ${downs.length} changed parameter(s) are SMALLER in the design than in its base (${downs.map(c => `${c.label} x${rx(c.factor)}`).join('; ')}), `
      + `and none is a functional parameter, so this is a MORPHOLOGICAL SUBTRACTION. The question therefore flips from "does the new function appear?" `
      + `to "what did removing this cost?". Derived from the validator's difference set.`;
  } else if (direction === 'mixed') {
    kind = 'morphological-mixed';
    how = `${ups.length} parameter(s) are larger and ${downs.length} smaller than the base, with no functional parameter moved, so the change is MIXED morphology.`;
  } else {
    kind = 'none';
    how = `the validator's difference set is empty: no parameter differs from the base. This is a control, not a design.`;
  }
  return { kind, direction, parents, changed, n_differences: diffs?.n ?? changed.length, kind_derived_from: how };
}

/** Did this montage condition pass? Read from the run's OWN metrics. Where the run states no requirement the
 *  answer is 'cannot-evaluate', never a pass. */
function passOf(cond, metrics) {
  const m = k => metrics.find(x => x.key === k);
  const val = k => { const x = m(k); return x && typeof x.value === 'number' ? x.value : null; };
  const out = [];
  const add = (id, label, value, unit, status, requirement, source) => out.push({ id, label, value: r4(value), unit, status, requirement, source });

  if (cond.scenario === 'glide' || cond.scenario === 'wind' || cond.scenario === 'altitude') {
    const launch = val('launch_airspeed_m_s'), vmin = val('v_min_m_s');
    const range = val('glide_range_total_m') ?? val('ground_distance_total_m') ?? val('glide_range_lean_bound_m');
    if (launch != null && vmin != null) add('can-leave-water', 'Launch speed reaches the minimum flying speed', launch, 'm/s', launch >= vmin ? 'pass' : 'fail', `launch speed >= v_min (${r4(vmin)} m/s)`, m('launch_airspeed_m_s')?.source || null);
    else add('can-leave-water', 'Launch speed reaches the minimum flying speed', null, 'm/s', 'cannot-evaluate', 'v_min or launch speed not computed for this organism', null);
    if (range != null) add('glide-range', 'Any distance covered through the air', range, 'm', range > 0 ? 'pass' : 'fail', 'a glide distance greater than zero', m('glide_range_lean_bound_m')?.source || null);
    const pf = m('powered_flight_margin');
    if (pf) add('powered-flight', 'Aerobic power covers powered flight', typeof pf.value === 'number' ? pf.value : null, pf.unit || '-', typeof pf.value === 'number' ? (pf.value >= 1 ? 'pass' : 'fail') : 'cannot-evaluate', 'margin >= 1 (aerobic power available / power required)', pf.source || null);
    const hyp = m('hypoxia_margin_kPa');
    if (hyp) add('oxygen', 'Oxygen partial pressure stays above the hypoxia threshold', typeof hyp.value === 'number' ? hyp.value : null, 'kPa', typeof hyp.value === 'number' ? (hyp.value > 0 ? 'pass' : 'fail') : 'cannot-evaluate', 'margin above zero', hyp.source || null);
    const gust = m('gust_stall_margin_m_s');
    if (gust) add('gust-stall', 'Margin before a gust stalls it', typeof gust.value === 'number' ? gust.value : null, 'm/s', typeof gust.value === 'number' ? (gust.value > 0 ? 'pass' : 'fail') : 'cannot-evaluate', 'margin above zero', gust.source || null);
  }
  if (cond.scenario === 'temperature') {
    const marg = val('thermal_margin_C');
    add('thermal', 'Stays inside its critical thermal limits', marg, '°C', marg == null ? 'cannot-evaluate' : marg > 0 ? 'pass' : 'fail', 'margin to CTmax/CTmin above zero', m('thermal_margin_C')?.source || null);
    const u = val('ucrit_relative');
    if (u != null) add('swim-capacity', 'Swimming capacity retained at this temperature', u, '-', u >= 0.5 ? 'pass' : 'fail', 'at least half of its capacity at the acclimation temperature', m('ucrit_relative')?.source || null);
  }
  if (cond.scenario === 'current') {
    const marg = val('speed_margin_m_s');
    add('hold-station', 'Can swim faster than the current', marg, 'm/s', marg == null ? 'cannot-evaluate' : marg > 0 ? 'pass' : 'fail', 'top speed above the current speed', m('speed_margin_m_s')?.source || null);
    const frac = val('current_fraction_of_ucrit');
    if (frac != null) add('sustainable', 'The current is within sustainable (not burst) swimming', frac, '-', frac <= 1 ? 'pass' : 'fail', 'current <= critical swimming speed', m('current_fraction_of_ucrit')?.source || null);
  }
  if (cond.scenario === 'predator') {
    const p = val('escape_probability');
    add('escape', 'Escapes the strike', p, '-', p == null ? 'cannot-evaluate' : p >= 0.5 ? 'pass' : 'fail', 'escape probability at least one half', m('escape_probability')?.source || null);
    const ae = m('aerial_escape_available');
    if (ae) add('aerial-escape', 'Can escape into the air', ae.value, '-', ae.value === true || ae.value === 1 ? 'pass' : ae.value === false || ae.value === 0 ? 'fail' : 'cannot-evaluate', 'an aerial escape is available at this size and speed', ae.source || null);
  }
  if (cond.scenario === 'pressure') {
    const marg = val('depth_limit_margin_m');
    add('depth', 'Stays above its depth ceiling', marg, 'm', marg == null ? 'cannot-evaluate' : marg > 0 ? 'pass' : 'fail', 'margin to the piezolyte depth ceiling above zero', m('depth_limit_margin_m')?.source || null);
    const nb = val('negative_buoyancy_fraction');
    if (nb != null) add('buoyancy', 'Swim bladder still supports it', nb, '-', nb <= 0.1 ? 'pass' : 'fail', 'negative buoyancy no more than a tenth of body weight', m('negative_buoyancy_fraction')?.source || null);
  }
  return out;
}

const rollup = checks => {
  if (!checks.length) return 'cannot-evaluate';
  if (checks.some(c => c.status === 'fail')) return 'fail';
  if (checks.every(c => c.status === 'cannot-evaluate')) return 'cannot-evaluate';
  return checks.some(c => c.status === 'cannot-evaluate') ? 'pass-with-gaps' : 'pass';
};

/** Pull every ensemble the physics gate produced, so the page can show the SPREAD and never one flattering
 *  line. An ensemble whose draws all failed is the most informative kind and is kept, not dropped. */
function ensemblesFrom(physics) {
  const out = [];
  for (const c of physics?.criteria || []) {
    for (const st of c.per_stage || []) {
      if (!st.ensemble) continue;
      const e = st.ensemble;
      out.push({
        criterion: c.id, scenario: c.scenario, stage: st.stage, stage_label: st.stage_label ?? null,
        metric: st.metric ?? null, unit: e.unit ?? st.unit ?? null, status: st.status ?? null,
        draws: e.draws ?? null, draws_achieved: e.draws_achieved ?? null, fraction_achieved: e.fraction_achieved ?? null,
        median: r4(e.median), p5: r4(e.p5), p95: r4(e.p95), min: r4(e.min), max: r4(e.max), n_numeric: e.n_numeric ?? null,
        seed: e.seed ?? null, source: e.source ?? null, file: e.file ?? null,
        species_gate: e.species_gate ?? null, note: e.note ?? null, distributions: e.distributions ?? null,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
async function main() {
  const T = await import(imp('sim-engine', 'tools', 'studio.mjs'));

  // The unifying pipeline. Ask for it; do not assume it.
  let P = null, pipelineName = 'assembled-from-parts', pipelineNote = null;
  try {
    const m = await import(imp('sim-engine', 'validate', 'pipeline', 'index.mjs'));
    if (typeof m.validateGeneration === 'function') { P = m; pipelineName = 'validateGeneration'; }
  } catch (e) { pipelineNote = `sim-engine/validate/pipeline/index.mjs could not be imported: ${e.message}`; }
  if (!P) throw new Error(`the unifying pipeline is not importable, so this run would not be a real validation. ${pipelineNote || ''}`);

  const parentCache = {};
  const loadResolved = id => (parentCache[id] ??= fs.existsSync(path.join(RESOLVED, `${id}.json`)) ? readJSON(path.join(RESOLVED, `${id}.json`)) : null);

  const index = [];
  for (const C of CASES) {
    process.stderr.write(`\n=== ${C.id} ===\n`);
    const resolved = loadResolved(C.id);
    if (!resolved) { process.stderr.write(`  SKIP: no resolved/${C.id}.json\n`); continue; }
    for (const p of resolved.parents || []) loadResolved(p.organism);

    // The base: the design's own heaviest parent, from its resolved parameter set. For a two-parent blend the
    // comparison can only be against ONE base, so the other parent is named and the limitation recorded.
    const parents = resolved.parents || [];
    const sorted = [...parents].sort((a, b) => b.weight - a.weight);
    const baseId = sorted[0]?.organism ?? null;
    const baseNote = parents.length > 1
      ? `This design has ${parents.length} parents (${parents.map(p => `${Math.round(p.weight * 100)}% ${p.organism}`).join(' + ')}). `
        + `validateGeneration compares against ONE base, so "${baseId}" was used and the contribution of `
        + `${parents.filter(p => p.organism !== baseId).map(p => p.organism).join(', ')} is NOT represented in the difference set. `
        + `A difference reported here may be inherited from the other parent rather than designed.`
      : null;

    // -------- the real validator
    process.stderr.write(`  validateGeneration(generated=${C.id}, base=${baseId}) ... `);
    const t0 = Date.now();
    const V = await P.validateGeneration({ generated: C.id, base: baseId, desired_phenotype: C.desired_phenotype, opts: { network: false } });
    process.stderr.write(`${Date.now() - t0} ms\n`);

    const R = V.results || {};
    const dp = V.inputs?.desired_phenotype || {};
    const cls = classify(V.differences, resolved, parentCache);
    const physics = R.physics_check?.result || null;

    // -------- the condition montage: additional real scenario runs
    const conditions = [];
    for (const cond of CONDITIONS) {
      process.stderr.write(`  scenario ${cond.scenario} (${cond.key}) ... `);
      let run = null, error = null;
      try {
        const out = await T.scenarioRun({ organism: C.id, scenario: cond.scenario, ageDays: 180, params: cond.params });
        run = (out.result ?? out).run ?? null;
      } catch (e) { error = e.message; }
      const metrics = run?.metrics || [];
      const checks = error ? [] : passOf(cond, metrics);
      const status = error ? 'cannot-evaluate' : run?.ok === false ? 'cannot-evaluate' : rollup(checks);
      process.stderr.write(`${status}\n`);
      conditions.push({
        key: cond.key, scenario: cond.scenario, label: cond.label, blurb: cond.blurb, params_sent: cond.params,
        ran: !error && !!run,
        reason: error || (run?.ok === false ? (run.reason || 'the scenario reported it could not run on this organism') : null),
        status, checks,
        metrics: metrics.map(m => ({ key: m.key, label: m.label, value: r4(m.value), unit: m.unit, kind: m.kind ?? null, source: m.source ?? null, better: m.better ?? null })),
        notes: run?.notes ?? null,
      });
    }
    const failedConds = conditions.filter(c => c.status === 'fail');
    const okConds = conditions.filter(c => c.status === 'pass' || c.status === 'pass-with-gaps');
    const naConds = conditions.filter(c => c.status === 'cannot-evaluate');

    // -------- the five gates, verbatim statuses from the pipeline
    const GATE_LABELS = {
      genotype_similarity: 'Genotype similarity', phenotype_similarity: 'Phenotype similarity',
      lean_check: 'Lean-backed laws', functional_resolution: 'Functional resolution', physics_check: 'Physics check',
    };
    const gates = Object.entries(GATE_LABELS).map(([id, label]) => ({
      id, label,
      status: R[id]?.status ?? 'cannot-assess',
      why: R[id]?.gate ?? 'this gate reported nothing',
      gate_set_by: R[id]?.gate_set_by ?? null,
    }));

    // -------- the scales, with their reasons, and which are gaps
    const scaleObj = V.scales?.scales || {};
    const cov = V.per_scale_coverage || {};
    const scales = Object.entries(scaleObj).map(([id, s]) => ({
      id,
      label: id.replace(/_/g, ' '),
      assessable: cov[id]?.assessable ?? s.assessable ?? null,
      known: s.known ?? [],
      n_known: (s.known || []).length,
      unknown: s.unknown ?? [],
      coverage: cov[id] ?? null,
    }));
    const unassessable = V.scales?.unassessable_scales ?? [];

    // -------- the function at stake, for the analogue act's four stories (needed by the gap list below)
    const an = V.analogue || {};
    const firstAnalogue = (an.analogues || [])[0] || null;
    const noKnown = (an.criteria_with_no_known_analogue || []).length;
    const nCrit = (dp.criteria || []).length;
    const fnStatus = cls.kind.endsWith('subtraction') ? 'lost' : cls.kind === 'blend' ? 'retained' : cls.kind === 'none' ? 'none-claimed' : 'gained';

    // -------- the gaps, rendered as gaps. Every one carries the validator's own words.
    const gaps = [];
    const pushGap = (id, scale, reason, where) => { if (reason) gaps.push({ id, scale, reason: String(reason), where }); };
    // The sequence basis: the single most important honesty item on the page.
    if (V.inputs?.sequence) pushGap('sequence-basis', 'genomic sequence', V.inputs.sequence.statement, 'sim-engine/validate/pipeline/inputs.mjs (sequence_basis, loci_covered, genome_fraction_assessed)');
    // Every gate that could not be assessed.
    for (const g of gates) if (String(g.status).startsWith('cannot')) pushGap(`gate-${g.id}`, `gate: ${g.label}`, g.why, `the ${g.gate_set_by ?? 'pipeline'} set this gate`);
    // Every scale the validator itself listed as unassessable, with its stated reason.
    for (const id of unassessable) {
      const s = scaleObj[id];
      pushGap(`scale-${id}`, `scale: ${id.replace(/_/g, ' ')}`, (s?.unknown || []).join(' ') || `the ${id} scale was not assessed`, 'sim-engine/validate/pipeline scales.scales');
    }
    // The analogue's own data poverty, in its own words.
    for (const a of an.analogues || []) if (a.data_poor_statement) pushGap(`analogue-${a.id || a.name}`, 'the analogue itself', a.data_poor_statement, 'analogue registry data_poor_statement');
    for (const c of an.criteria_with_no_known_analogue || []) pushGap(`no-analogue-${c.id || c.criterion || 'criterion'}`, 'functional analogue', c.reason || c.why || JSON.stringify(c), 'analogue.criteria_with_no_known_analogue');
    // The request itself could not be stated as a test at all.
    if (nCrit === 0) pushGap('not-expressible', 'the request itself',
      'NOT ONE clause of this request could be turned into a checkable criterion, so no analogue was looked up and nothing was tested. '
      + 'The reasons the validator gave, clause by clause, are in ask.unparsed. This is not a pass.',
      'pipeline inputs.desired_phenotype.criteria is empty');
    // Standing physical checks that failed, which sit beside the gate rather than inside it.
    for (const s of physics?.standing_checks || []) {
      if (String(s.status || '').toLowerCase().startsWith('fail')) pushGap(`standing-${s.id || gaps.length}`, 'standing physical check', s.statement ?? s.message ?? 'a standing physical check failed', 'sim-engine/validate/physics standing_checks (reported beside the gate, not folded into it)');
    }
    // Clauses of the ask that were never checked.
    for (const u of dp.unparsed_verbatim || []) pushGap(`unparsed-${gaps.length}`, 'the request itself', `This clause of the request was NOT parsed and therefore NOT checked: "${typeof u === 'string' ? u : u.text || JSON.stringify(u)}"`, 'pipeline inputs.desired_phenotype.unparsed_verbatim');
    for (const u of dp.refused_verbatim || []) pushGap(`refused-${gaps.length}`, 'the request itself', `This clause was REFUSED: "${typeof u === 'string' ? u : u.text || JSON.stringify(u)}"`, 'pipeline inputs.desired_phenotype.refused_verbatim');
    // Montage conditions that could not be decided.
    for (const c of naConds) pushGap(`condition-${c.key}`, `condition: ${c.label}`, c.reason || 'this scenario produced no check that could be decided for this organism', `sim-engine/scenarios/${c.scenario}.mjs`);

    // -------- the mesh for act 2
    const manifestName = { 'flying-fish': 'manifest.json', 'zebrafish-adult': 'manifest-adult.json', tff: 'tff-manifest.json' }[C.id] || `${C.id}-manifest.json`;
    const mf = fs.existsSync(path.join(MODELS, manifestName)) ? readJSON(path.join(MODELS, manifestName)) : null;
    const baseManifestName = { 'flying-fish': 'manifest.json', 'zebrafish-adult': 'manifest-adult.json', tff: 'tff-manifest.json' }[baseId] || `${baseId}-manifest.json`;

    // -------- the function at stake, for the analogue act's three stories

    const out = {
      meta: {
        case: C.id, generated_by: COMMAND, generated_at: new Date().toISOString(),
        pipeline: pipelineName,
        pipeline_call: `validateGeneration({ generated: '${C.id}', base: '${baseId}', desired_phenotype: <the text in ask.text>, opts: { network: false } })`,
        pipeline_module: 'sim-engine/validate/pipeline/index.mjs',
        montage_call: `scenarioRun({ organism: '${C.id}', scenario: <each of ${CONDITIONS.length}>, ageDays: 180, params: <as recorded per condition> })`,
        tool: V.tool ?? null, version: V.version ?? null, signature: V.signature ?? null, ms: V.ms ?? null,
        base_used: baseId, base_note: baseNote,
        honesty: 'Every number in this file came back from sim-engine on the run recorded above. No value was typed in or carried over from another case. '
          + 'A gate that could not be assessed is reported as cannot-assess, which is NOT a pass. The condition montage is a set of additional real '
          + 'scenario runs, not the physics gate: the gate is results.physics_check.',
      },
      case: {
        id: C.id, name: resolved.name ?? C.id, headline: !!C.headline, hypothetical: resolved.hypothetical ?? null,
        ...cls,
        // FOUR distinct stories, and which one holds is read off the run, not asserted:
        //   'gained'/'lost'/'retained'   -- an analogue exists and the function was added, removed or kept
        //   no_real_organism_has_it      -- criteria exist but NO analogue is known for them
        //   not_expressible              -- the request could not be turned into a single checkable criterion,
        //                                   so nothing was looked up and nothing was checked. Not a pass.
        function: {
          name: firstAnalogue?.function?.label ?? firstAnalogue?.function ?? null,
          id: firstAnalogue?.function?.id ?? null,
          status: nCrit === 0 ? 'not-expressible' : fnStatus,
          analogue_has: !!firstAnalogue,
          analogue_lookup_happened: nCrit > 0,
          no_real_organism_has_it: nCrit > 0 && noKnown >= nCrit,
          not_expressible: nCrit === 0,
          not_expressible_reasons: nCrit === 0 ? (dp.unparsed_verbatim || []).map(u => (typeof u === 'string' ? { text: u, reason: null } : { text: u.text ?? null, reason: u.reason ?? null })) : [],
          not_expressible_statement: nCrit === 0
            ? 'The validator could not turn a single clause of this request into a checkable criterion, so no analogue was looked up and no criterion was tested. '
              + 'That is not a failure of the design and it is certainly not a pass: it means the thing being asked for cannot currently be stated as a test.'
            : null,
          criteria_with_no_known_analogue: noKnown,
          criteria_total: nCrit,
        },
      },
      ask: {
        text: dp.text ?? C.desired_phenotype,
        spec: dp.spec ?? null,
        criteria: dp.criteria ?? [],
        unparsed: dp.unparsed_verbatim ?? [],
        refused: dp.refused_verbatim ?? [],
        rule: 'Parsed by the validator itself (sim-engine/validate/pipeline). A clause it could not parse was NOT checked by anything downstream, and is shown in red.',
      },
      sequence: V.inputs?.sequence ?? null,
      inputs: { generated: V.inputs?.generated ?? null, base: V.inputs?.base ?? null },
      design: {
        id: C.id, name: resolved.name ?? C.id, hypothetical: resolved.hypothetical ?? null,
        parents, base_used: baseId,
        glb: mf?.file ? path.basename(mf.file) : `${C.id}.glb`, manifest: manifestName,
        base_glb: `${baseId}.glb`, base_manifest: baseManifestName,
        units_and_axes: mf?.units_and_axes ?? null,
        morphological_not_genetic: mf?.MORPHOLOGICAL_NOT_GENETIC ?? resolved.caveat ?? null,
        generative_model: mf?.generative_model ?? null,
        edits: [],
        parameters: Object.fromEntries(Object.entries(resolved.parameter_detail || {}).map(([k, v]) => [k, { value: r4(v.value), kind: v.kind ?? null, source: v.source ?? null, label: labelOf(k), part: partOf(k) }])),
        lean_recheck: resolved.lean_recheck ?? null,
      },
      differences: V.differences ?? null,
      analogue: {
        ...an,
        analogues: (an.analogues || []).map(a => ({
          ...a,
          // Resolved HERE so the page never guesses a filename: null means this repo genuinely holds no
          // mesh for that analogue, and the act says so instead of drawing a stand-in.
          mesh: meshFor(a.repo_organism || a.organism || a.id),
        })),
        rule: 'chosen by FUNCTION, not relatedness. The phylogenetic and functional distances are reported separately and never combined.' },
      scales, unassessable_scales: unassessable,
      scales_note: V.scales?.note ?? null,
      anatomy_reached: V.scales?.anatomy_reached ?? null,
      gene_set: V.scales?.gene_set ?? null,
      genotype_similarity: R.genotype_similarity ?? null,
      phenotype_similarity: R.phenotype_similarity ?? null,
      lean_check: R.lean_check ?? null,
      functional_resolution: R.functional_resolution ?? null,
      physics_check: R.physics_check ?? null,
      // The standing physical checks are reported BESIDE the gate, never folded into it: a design can carry a
      // failing standing check while the gate itself checked nothing. Surfaced so the page can show both.
      standing_checks: (physics?.standing_checks || []).map(s => ({
        id: s.id ?? null, stage: s.stage ?? null, status: s.status ?? null,
        statement: s.statement ?? s.message ?? s.why ?? null,
        quantity: s.quantity ?? null, value: r4(s.value), unit: s.unit ?? null,
        requirement: s.requirement ?? null, source: s.source ?? null, kind: s.kind ?? null,
      })),
      ensembles: ensemblesFrom(physics),
      conditions,
      verdict: {
        sentence: V.verdict?.statement ?? null,
        word_validated_withheld: V.verdict?.word_validated_withheld ?? null,
        passed: V.verdict?.passed ?? [], failed: V.verdict?.failed ?? [], could_not_assess: V.verdict?.could_not_assess ?? [],
        gates,
        montage_counts: { conditions_total: conditions.length, passed: okConds.length, failed: failedConds.length, unassessable: naConds.length },
        composite_score_from_the_scorer: V.composite_score_from_the_scorer ?? null,
        rule: 'The verdict is the validator\'s own SENTENCE, not a number. A gate that could not be assessed is not a passed one.',
      },
      notes: V.notes ?? null,
      gaps,
    };

    const file = path.join(HERE, `run-${C.id}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
    process.stderr.write(`  -> run-${C.id}.json (${(fs.statSync(file).size / 1024).toFixed(0)} kB)  gates: `
      + gates.map(g => `${g.id.split('_')[0]}=${g.status}`).join(' ') + `\n  montage: ${okConds.length} pass / ${failedConds.length} fail / ${naConds.length} n-a; gaps: ${gaps.length}; scales unassessable: ${unassessable.join(',') || 'none'}\n`);

    index.push({
      case: C.id, name: resolved.name ?? C.id, headline: !!C.headline,
      kind: cls.kind, direction: cls.direction,
      function: out.case.function.name, function_status: out.case.function.status,
      no_real_organism_has_it: out.case.function.no_real_organism_has_it,
      not_expressible: out.case.function.not_expressible,
      criteria_total: nCrit,
      file: `run-${C.id}.json`,
      base_used: baseId,
      gates: Object.fromEntries(gates.map(g => [g.id, g.status])),
      montage_counts: out.verdict.montage_counts,
      gaps: gaps.length, unassessable_scales: unassessable,
      desired_phenotype: C.desired_phenotype,
      n_differences: cls.n_differences,
    });
  }

  const idx = {
    meta: {
      generated_by: COMMAND, generated_at: new Date().toISOString(), pipeline: pipelineName,
      what: 'The case index for validate-show. Each entry is one real validation run of one design; the page\'s case selector reads this.',
    },
    cases: index,
  };
  fs.writeFileSync(path.join(HERE, 'runs.json'), JSON.stringify(idx, null, 1));
  process.stderr.write(`\nwrote runs.json with ${index.length} case(s)\n`);
}

main().catch(e => { console.error(e.stack); process.exit(1); });
