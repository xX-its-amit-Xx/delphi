// design_score and validate_design.
//
// THE SCORE (version SCORER.version; weights fixed in SCORER-PREREGISTRATION.md before the scorer was validated):
//   P  phenotype plausibility = min(min(1,p_body/0.05), min(1,p_fin_pectoral/0.05), p_fin_envelope, organ fit)  [0, 1]
//        p_body, p_fin_pectoral: empirical p-values of the nearest-real-neighbour distance against held-out real
//        specimens (phenotype.mjs); p_fin_envelope: exp(-max excess) (UNCALIBRATED, fixed rule); organ fit: the
//        fraction of the requested flight muscle that fits (mesh, or the analytic capacity), 0 if partedit refused.
//   L  Lean = 1 if no ACCEPTED-law binding violation is newly caused by the design, else 0. Candidate and contested
//        violations are listed, never scored.
//   G  genotype sequence sanity = product over gene edits of: 0 if the edit names the wrong reference residue, lies
//        outside the protein/CDS or cannot be parsed; 0.5 if it changes a conserved alignment column to a residue no
//        real organism (natural orthologue or known allele) carries; else 1. 1 when there are no gene edits.
//        Never a phenotype prediction (STATE, not phenotype).
//   S  spec = fraction of judged spec criteria met (no-model criteria excluded); only when a spec is given.
//   E  evidence strength = map(weakest provenance kind among the inputs the score read):
//        measured 1, derived 0.9, measured-secondhand 0.8, calibrated 0.7, borrowed 0.6, assumed 0.5.
//   score = exp( sum_i w_i ln max(c_i, 0.01) / sum_i w_i ) over the components that ran,
//        w = {P .35, L .25, G .15, S .15, E .10}. "plausible" means score >= 0.5. A component that could not run is
//        dropped from the sum and listed under could_not_run; it is never imputed.
import fs from 'node:fs';
import path from 'node:path';
import { envelope, p } from '../lib/envelope.mjs';
import { loadBundle } from '../lib/data-node.mjs';
import * as O from '../lib/organism.mjs';
import { resolveState, leanSpec } from '../lib/state.mjs';
import * as LS from '../lib/lean-source.mjs';
import { getDoc } from '../tools/studio.mjs';
import { loadReferences, rawFromState, closestPhenotype } from './phenotype.mjs';
import { closestGenotype, STATE_NOT_PHENOTYPE } from './genotype.mjs';
import { phenoSanity, genoSanity } from './sanity.mjs';
import { leanByComponent } from './lean-components.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SCORER = Object.freeze({
  version: '1.0.0',
  weights: Object.freeze({ P: 0.35, L: 0.25, G: 0.15, S: 0.15, E: 0.10 }),
  floor: 0.01,
  alpha: 0.05,
  plausible_threshold: 0.5,
  evidence: Object.freeze({ measured: 1, derived: 0.9, 'measured-secondhand': 0.8, calibrated: 0.7, borrowed: 0.6, assumed: 0.5 }),
  preregistration: 'sim-engine/validate/SCORER-PREREGISTRATION.md',
});
const KIND_ORDER = ['assumed', 'borrowed', 'measured-secondhand', 'calibrated', 'derived', 'measured'];

export function composite(components) {
  let s = 0, w = 0;
  for (const [k, c] of Object.entries(components)) if (c && c.ran && typeof c.value === 'number') { s += SCORER.weights[k] * Math.log(Math.max(c.value, SCORER.floor)); w += SCORER.weights[k]; }
  return w ? Math.exp(s / w) : null;
}

function manifestFitFor(doc, bundle) {
  if (doc.edits?.length || doc.base.parents.length !== 1 || doc.base.parents[0].weight !== 1) return null;
  const id = doc.base.parents[0].organism; const o = bundle.organisms[id];
  const f = path.join(ROOT, 'dashboard/public/blueprint3d/model', o?.kind === 'reference' ? (o.manifest || `${id}-manifest.json`) : `${id}-manifest.json`);
  if (!fs.existsSync(f)) return null;
  const v = JSON.parse(fs.readFileSync(f, 'utf8')).derived_from_the_mesh?.flight_muscle_fit_fraction;
  return typeof v === 'number' ? v : null;
}

function evidenceOf(state) {
  const P = state._meta?.parameters || {};
  const kinds = [state.SL_m?.kind, state.mass_kg?.kind, ...['body_depth_over_SL', 'body_width_over_SL', 'peduncle_depth_frac', 'peduncle_width_frac', 'pectoral_len_over_SL'].map(k => O.mapKind(P[k]?.kind))].filter(Boolean);
  const weakest = KIND_ORDER.find(k => kinds.includes(k)) || 'assumed';
  return { weakest, kinds };
}

async function specComponent(spec, doc) {
  const S = await import('../lib/spec.mjs');
  const reg = await S.loadRegistry();
  const v = S.validateSpec(spec, reg);
  if (!v.ok) return { ran: false, reason: `spec invalid: ${v.errors.join('; ')}` };
  const evals = await S.evaluateDesign(v.spec, doc, reg);
  const rows = [];
  for (const c of v.spec.criteria) for (const [stage, e] of Object.entries(evals[c.id] || {})) rows.push({ criterion: c.id, scenario: c.scenario, stage, ...S.judge(c, e.run, e.state) });
  const judged = rows.filter(r => r.verdict === 'met' || r.verdict === 'failed');
  if (!judged.length) return { ran: false, reason: 'every criterion came back no-model', rows };
  return { ran: true, value: judged.filter(r => r.verdict === 'met').length / judged.length, rows };
}

/** Core: everything about one design. args: {organism | specimen, ageDays, conditions, spec, exclude, containment,
 *  network, blast, lawset}. Returns a plain object (the tools wrap it in the envelope). */
export async function assess(args = {}) {
  const t0 = Date.now();
  await loadReferences();
  const bundle = await loadBundle();
  const out = { scorer: SCORER };
  let raw, state = null, doc = null, geno = { n_edits: 0, edits: [] }, lean = null, ev;
  if (args.specimen) {
    raw = { ...args.specimen };
    ev = { weakest: args.specimen_kind || 'measured', kinds: [args.specimen_kind || 'measured'] };
    const lspec = { SL_m: raw.SL_m, mass_kg: raw.mass_kg, ...(raw.pectoral_len_SL != null ? { finLength_SL: raw.pectoral_len_SL } : {}), taxon: args.taxon || 'Teleostei', life_stage: 'adult' };
    const r = await LS.checkDesign(lspec, args.lawset || 'current');
    const acc = r.violations.filter(v => v.status === 'accepted' && v.binding);
    lean = { lawset_version: r.lawset, spec: lspec, accepted: { newly_caused: acc.map(v => ({ law_id: v.law_id, law_version: v.version, constraint: v.constraint, message: v.message })), also_in_real_parent: [] },
      candidate: r.violations.filter(v => v.status === 'candidate'), contested: r.violations.filter(v => v.status === 'contested'), counts: r.summary, components: [], note: 'specimen: no parent organism, so every accepted binding violation counts as newly caused' };
    out.design = { kind: 'specimen', label: args.label || 'specimen record' };
  } else {
    const g = await getDoc(args.organism); doc = g.doc;
    state = resolveState(doc, args.ageDays, args.conditions || {}, bundle);
    raw = rawFromState(state);
    ev = evidenceOf(state);
    geno = await closestGenotype(doc, { network: args.network !== false, blast: !!args.blast });
    const gEdits = geno.edits.map(e => e.lean_genotype_edit).filter(Boolean);
    lean = await leanByComponent(doc, bundle, { ageDays: args.ageDays, conditions: args.conditions || {}, lawset: args.lawset || 'current', genotypeEdits: gEdits });
    out.design = { kind: 'organism', id: doc.id, parents: doc.base.parents, n_edits: doc.edits.length, ageDays: state.ageDays?.value, stage: state.stage?.value, origin: g.origin };
  }
  const pheno = await closestPhenotype(raw, { exclude: args.exclude || [] });
  const manifestFit = doc ? manifestFitFor(doc, bundle) : null;
  const pSan = await phenoSanity(raw, { state, bundle, doc, manifestFit, containment: args.containment });
  const gSan = genoSanity(geno);

  // ---- components
  const C = {};
  const ps = [];
  // Calibrated blocks enter as min(1, p / alpha): a real held-out specimen is in the upper (1 - alpha) of the
  // calibration distribution with probability 1 - alpha, so it gets full credit; the tail decays linearly.
  if (pheno.body.ran) ps.push({ part: 'p_body', p: pheno.body.p_value, value: Math.min(1, pheno.body.p_value / SCORER.alpha) });
  if (pheno.fin.ran) ps.push({ part: 'p_fin_pectoral', p: pheno.fin.p_value, value: Math.min(1, pheno.fin.p_value / SCORER.alpha) });
  if (pheno.fin_envelope.features.length) ps.push({ part: 'p_fin_envelope (uncalibrated)', value: pheno.fin_envelope.p_value });
  const fit = pSan.find(c => c.id === 'organ_fit:flight_muscle');
  if (fit && typeof fit.value === 'number') ps.push({ part: 'organ_fit:flight_muscle', value: fit.value });
  const cont = pSan.find(c => c.id === 'organ_fit:containment');
  if (cont && cont.status === 'failed') ps.push({ part: 'organ_fit:containment', value: 0 });
  C.P = ps.length ? { ran: true, value: Math.min(...ps.map(x => x.value)), parts: ps, limiting: ps.reduce((a, b) => (b.value < a.value ? b : a)).part } : { ran: false, reason: 'no phenotype feature could be compared' };
  const newly = lean?.accepted?.newly_caused || [];
  C.L = lean ? { ran: true, value: newly.length ? 0 : 1, newly_caused_accepted: newly, candidate_listed_not_scored: lean.candidate.length, contested_listed_not_scored: lean.contested.length,
    evaluated: lean.counts ? lean.counts.violated + lean.counts.holds : null, cannot_evaluate: lean.counts?.cannot_evaluate ?? null, out_of_scope: lean.counts?.out_of_scope ?? null } : { ran: false, reason: 'Lean not run' };
  if (geno.n_edits) {
    let g = 1; const why = [];
    for (const e of geno.edits) {
      const ck = id => e.checks.find(c => c.id === id);
      if (ck('parse')?.status === 'failed' || ck('reference_residue')?.status === 'failed') { g *= 0; why.push(`${e.edit.gene} ${e.edit.raw}: ${ck('parse')?.detail || ck('reference_residue').detail}`); continue; }
      const cons = ck('conserved_site')?.status === 'flagged', exists = e.comparison?.alt_state_in_real_organisms?.exists;
      if (cons && exists === false) { g *= 0.5; why.push(`${e.edit.gene} ${e.edit.raw}: conserved column changed to a state no real organism in the panel carries`); }
    }
    C.G = { ran: true, value: g, why, note: STATE_NOT_PHENOTYPE };
  } else C.G = { ran: true, value: 1, why: ['no gene-level edits'], note: STATE_NOT_PHENOTYPE };
  if (args.spec && doc) { try { C.S = await specComponent(args.spec, doc); } catch (e) { C.S = { ran: false, reason: e.message }; } }
  else C.S = { ran: false, reason: args.spec ? 'a spec needs an organism document, not a specimen' : 'no spec given' };
  C.E = { ran: true, value: SCORER.evidence[ev.weakest] ?? 0.5, weakest_kind: ev.weakest };
  const score = composite(C);

  // ---- verdict (never "valid")
  const all = [...pSan.map(c => ({ ...c, family: 'phenotype' })), ...gSan.map(c => ({ ...c, family: 'genotype' }))];
  const by = s => all.filter(c => c.status === s).map(c => c.id);
  const closest = pheno.closest_real_relative;
  out.verdict = {
    statement: `Not a validity claim. Score ${score == null ? 'n/a' : score.toFixed(3)} (${score >= SCORER.plausible_threshold ? 'plausible' : 'implausible'} by the pre-registered 0.5 cut on what was checked). `
      + `Closest real relative: ${closest ? `${closest.name} (distance ${closest.distance}${pheno.body.ran ? `, body p ${pheno.body.p_value}` : ''})` : 'none'}. `
      + `Checks passed ${by('passed').length}, failed ${by('failed').length}, flagged ${by('flagged').length}, could not run ${by('could-not-run').length}. `
      + `Lean: ${newly.length} accepted-law violation(s) newly caused; ${lean?.candidate?.length || 0} candidate and ${lean?.contested?.length || 0} contested listed separately.`,
    passed: by('passed'), failed: by('failed'), flagged: by('flagged'), could_not_run: [...by('could-not-run'), ...Object.entries(C).filter(([, c]) => !c.ran).map(([k, c]) => `component ${k}: ${c.reason}`)],
    closest_real_relative: closest, closest_real_relative_fins: pheno.closest_real_relative_fins, ood: pheno.ood,
  };
  out.score = { value: score == null ? null : +score.toFixed(4), plausible: score != null && score >= SCORER.plausible_threshold, components: C,
    formula: 'exp(sum w_i ln max(c_i,0.01) / sum w_i) over components that ran; w = P .35, L .25, G .15, S .15, E .10' };
  out.phenotype = pheno; out.genotype = geno; out.sanity = { phenotype: pSan, genotype: gSan }; out.lean = lean;
  out.ms = Date.now() - t0;
  return out;
}

const SCOPE = 'A validation report, not a validity claim. Phenotype plausibility compares a handful of SL-normalised shape features with real specimens (FishShapes v1 teleosts, our three real organisms and their stages, Daane 2021 fin ratios); it says nothing about features it does not read (ray and vertebra counts, internal anatomy beyond the flight-muscle budget, physiology, development). Genotype results are sequence STATES compared with real orthologues, never phenotype predictions. Lean is a floating-point evaluation of the law formulas, not a kernel check, and most laws cannot evaluate from STATE. Birds (Aves) are a frozen holdout and are excluded from every reference set. ' + O.HARD_CAVEAT;

function provOf(r) {
  const R = [p('FishShapes v1 specimens', r.phenotype?.body?.calibration_n ?? null, 'measured', 'Price et al. 2022 Ecology 103:e3829, doi 10.1002/ecy.3829; Zenodo 6642650 (sim-engine/validate/data/fishshapes-features.json)'),
    p('OOD threshold (body)', r.phenotype?.body?.threshold ?? null, 'derived', 'sim-engine/validate/phenotype.mjs calibrate(): 99th percentile of held-out-species NN distances'),
    p('fin envelope rule', null, 'assumed', 'phenotype.mjs finEnvelope: fixed, uncalibrated rule'),
    p('flight-muscle capacity', null, 'borrowed', 'sanity.mjs FLIGHT_MUSCLE_CAPACITY: from the tff and ff-zf-chimera mesh clips, transferred to other bodies'),
    p('score weights', SCORER.version, 'assumed', 'score.mjs SCORER, fixed in SCORER-PREREGISTRATION.md before validation')];
  if (r.score?.components?.E) R.push(p('evidence: weakest input kind', r.score.components.E.weakest_kind, 'derived', 'resolved STATE field kinds'));
  return R;
}

export async function designScore(args = {}) {
  const r = await assess(args);
  return envelope({ design: r.design, score: r.score, verdict: r.verdict, scorer: r.scorer,
    genotype_summary: r.genotype.edits.map(e => ({ gene: e.edit.gene, edit: e.edit.raw, checks: e.checks, closest_species: e.comparison?.closest_species ? { species: e.comparison.closest_species.species, identity_after: e.comparison.closest_species.identity_after } : null,
      alt_state_exists_in_real_organism: e.comparison?.alt_state_in_real_organisms ?? null, annotations: e.annotations })) }, provOf(r), SCOPE);
}

export async function validateDesign(args = {}) {
  const r = await assess(args);
  const res = { design: r.design, verdict: r.verdict, score: r.score, closest_relative_phenotype: r.phenotype, closest_relative_genotype: r.genotype, sanity: r.sanity, lean_by_component: r.lean, scorer: r.scorer, ms: r.ms };
  if (args.swarm) res.swarm = swarmTasks(args, r);
  return envelope(res, provOf(r), SCOPE);
}

// ---------------------------------------------------------------- swarm mode
// The swarm board (sim-engine/swarm/, another thread, tool swarm_post_task) did not exist when this was written,
// so the tasks are emitted as JSON in a neutral shape {id, kind, title, tool, args, depends_on, acceptance}. When
// swarm/ lands, each task maps onto one swarm_post_task call (see tools/VALIDATE-REGISTER.md).
export function swarmTasks(args, r = null) {
  const design = args.organism ?? { specimen: args.specimen };
  const id = typeof args.organism === 'string' ? args.organism : (args.organism?.id || 'specimen');
  const swarmDir = path.join(ROOT, 'sim-engine', 'swarm');
  const T = (kind, title, tool, extra, acceptance, deps = []) => ({ id: `validate:${id}:${kind}`, kind, title, tool, args: { organism: design, ...extra }, depends_on: deps.map(d => `validate:${id}:${d}`), acceptance });
  return {
    board_present: fs.existsSync(swarmDir), post_with: 'swarm_post_task (sim-engine/swarm/, when present); until then, run each task with its tool',
    tasks: [
      T('closest-relative-phenotype', 'Nearest real organisms/specimens to the design', 'closest_relative_phenotype', { exclude: args.exclude || [] }, 'reports nearest real relatives with distances, dominant features and the OOD flag against the calibrated threshold; no bird data'),
      T('closest-relative-genotype', 'Edited sequences vs real orthologues', 'closest_relative_genotype', { blast: false }, '% identity, closest species, whether each edited residue state exists in any real organism; STATE, never phenotype'),
      T('sanity-geno', 'Genotype sanity (frame, stop, reference residue, conserved site, causal-chain caveats)', 'sanity_check_design', { family: 'genotype' }, 'every gene edit has a status per check'),
      T('sanity-pheno', 'Phenotype sanity (allometry range, mass fits body, organ fit, stage consistency)', 'sanity_check_design', { family: 'phenotype' }, 'every check passed/failed/flagged/could-not-run with its inputs'),
      T('lean-by-component', 'Lean verdicts grouped by part/system and gene', 'lean_by_component', {}, 'each verdict carries law id, version, status, deciding inputs; accepted kept apart from candidate/contested'),
      T('adversarial-review', 'Try to break the verdict', null, {}, 'an independent reviewer argues the design is implausible in a way the checks missed (features not read, assumed inputs, uncalibrated rules) and posts each gap as a finding',
        ['closest-relative-phenotype', 'closest-relative-genotype', 'sanity-geno', 'sanity-pheno', 'lean-by-component']),
    ],
    ...(r ? { current_score: r.score.value } : {}),
  };
}
