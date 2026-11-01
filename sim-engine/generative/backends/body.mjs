// BODY level: conditional flow matching (default) or DDPM over the 7 body-shape features measured in FishShapes v1.
// Local, no credentials. Sampling is pure JS (lib/flow.mjs) from the weights train.py exported.
//
// Output per candidate: the generated body parameters (in the parametric model's own units), an ORGANISM DOCUMENT
// (base parents + body-level `set` edits) that organism_get / scenario_run / optimize accept as-is, and diagnostics
// (where each value sits among real specimens of the base family; the nearest real specimen).

import fs from 'node:fs';
import path from 'node:path';
import { loadModel, sampleOne, rng, standardise, unstandardise } from '../lib/flow.mjs';
import { parseBodyText, FEATURE_INDEX } from '../lib/text-conditions.mjs';
import { p } from '../../lib/envelope.mjs';

const HERE = import.meta.dirname;
const MODEL_DIR = path.join(HERE, '..', 'body', 'model');
const DATA_CSV = path.join(HERE, '..', 'body', 'data', 'fishshapes-derived.csv');
const MANIFEST = path.join(HERE, '..', 'body', 'data', 'fishshapes-manifest.json');

// Reference organism -> the FishShapes family whose specimens condition it. zebrafish-larva is refused: FishShapes is
// museum adults / sub-adults, and a 4 mm larva is outside the training distribution.
export const BASE_FAMILY = { 'flying-fish': 'Exocoetidae', 'zebrafish-adult': 'Cyprinidae' };
const REFUSED_BASE = { 'zebrafish-larva': 'FishShapes v1 is museum adults and sub-adults; a 4.2 mm larva is far outside the training distribution, so the body model will not generate one.' };

const FIELD = ['standard_length_m', 'body_depth_over_SL', 'body_width_over_SL', 'peduncle_depth_frac', 'peduncle_width_frac', 'fulton_K', 'head_depth_over_depth'];
const SOURCE = 'Price SA et al. (2022) FishShapes v1, Ecology 103:e3829; Zenodo 6642650 (CC0); 16 123 specimens after screening, sim-engine/generative/body/data/fishshapes-manifest.json';

const cache = {};
export function model(kind = 'fm') {
  if (cache[kind]) return cache[kind];
  const f = path.join(MODEL_DIR, `${kind}.json`);
  if (!fs.existsSync(f)) return null;
  return (cache[kind] = loadModel(JSON.parse(fs.readFileSync(f, 'utf8'))));
}
let realRows = null;
function real() {
  if (realRows) return realRows;
  const [head, ...lines] = fs.readFileSync(DATA_CSV, 'utf8').trim().split(/\r?\n/);
  const H = head.split(',');
  realRows = lines.map(l => { const v = l.split(','); const r = Object.fromEntries(H.map((h, i) => [h, v[i]])); const n = k => +r[k];
    r.x = [Math.log(n('SL_mm')), Math.log(n('depth_mm') / n('SL_mm')), Math.log(n('width_mm') / n('SL_mm')), Math.log(n('ped_depth_mm') / n('depth_mm')),
      Math.log(n('ped_width_mm') / n('width_mm')), Math.log(1e5 * n('weight_g') / n('SL_mm') ** 3), Math.log(n('head_depth_mm') / n('depth_mm'))];
    return r; });
  return realRows;
}

export function status() {
  const fm = model('fm'), dd = model('ddpm');
  let metrics = null;
  try { metrics = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, 'metrics.json'), 'utf8')); } catch { /* not trained yet */ }
  const ok = !!fm;
  return {
    level: 'body', backend: 'local', status: ok ? 'ok' : 'not trained', models: { fm: !!fm, ddpm: !!dd },
    what: 'conditional flow matching (rectified flow) and a VP-SDE diffusion (DDPM) model, MLP 3x128, trained on FishShapes v1 (16 123 teleost specimens, 6 029 species, 395 families) over 7 body-shape features; family-conditioned, with any subset of features observable',
    credentials: 'none needed',
    heldout_nll: metrics ? Object.fromEntries(Object.entries(metrics.runs || {}).map(([k, r]) => [k, r.nll_family_conditioned?.all])) : null,
    baselines: metrics ? { gaussian_family: metrics.baselines?.gaussian_family?.all, gaussian_global: metrics.baselines?.gaussian_global?.all } : null,
    can_represent: 'adult/sub-adult teleost body proportions: SL, depth/SL, width/SL, peduncle depth and width fractions, Fulton K (mass), head depth/depth',
    cannot_represent: 'fins of any kind, head length, cross-section shape, organs, larvae, development, and any non-teleost (no birds: Aves is the frozen holdout and FishShapes has none)',
  };
}

function leavesOf(bundle, O, base) {
  const parents = Array.isArray(base) ? base : base?.base?.parents || (typeof base === 'string' ? [{ organism: base, weight: 1 }] : null);
  if (!parents?.length) throw new Error('body generation needs `base`: an organism id (flying-fish, zebrafish-adult, a design id), a parent list [{organism, weight}], or an organism document');
  return { parents, leaves: O.leaves(bundle, parents) };
}

// largest-remainder split of n over weights
function apportion(n, weights) {
  const ks = Object.keys(weights); const tot = ks.reduce((a, k) => a + weights[k], 0);
  const raw = ks.map(k => n * weights[k] / tot); const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => out[i]++);
  return Object.fromEntries(ks.map((k, i) => [k, out[i]]));
}

function percentile(values, v) { let c = 0; for (const x of values) if (x <= v) c++; return values.length ? c / values.length : null; }

/**
 * generate({base, text, conditions, n, seed}) for the body level.
 * conditions: { model: 'fm'|'ddpm', keep_size: true, shape_family: 'Scombridae', sd_shift: {depth: 1, ...},
 *               observe: {body_depth_over_SL: 0.25, ...} (natural units), steps: 48 }
 */
export async function generateBody({ base, text = '', conditions = {}, n = 4, seed = 1 }, { bundle, O, parseDesignText }) {
  const kind = conditions.model || 'fm';
  const M = model(kind);
  if (!M) return { status: 'not trained', candidates: [], reason: `model/${kind}.json missing: run python sim-engine/generative/body/train.py` };
  n = Math.max(1, Math.min(64, n | 0));
  const parsed = text ? parseBodyText(text) : { attributes: [], not_generated: [], shape_family: null };
  if (!base && text && parseDesignText) {
    const ps = parseDesignText(text);
    if (ps.refused?.length) return { status: 'refused', candidates: [], refused: ps.refused };
    if (ps.spec.start_from?.length) base = ps.spec.start_from;
  }
  const { parents, leaves } = leavesOf(bundle, O, base);
  for (const id of Object.keys(leaves)) if (REFUSED_BASE[id]) return { status: 'out of training distribution', candidates: [], reason: REFUSED_BASE[id] };
  const baseDoc = Array.isArray(base) || typeof base === 'string' ? O.createOrganism({ id: 'gen-base', parents }, bundle) : base;
  const baseParams = O.resolveParameters(bundle, baseDoc);
  const baseSLmm = baseParams.params.standard_length_m?.value * 1000;

  const fidx = Object.fromEntries(M.families.map((f, i) => [f, i]));
  let shapeFam = conditions.shape_family || parsed.shape_family?.family || null;
  const notes = [];
  if (shapeFam && !(shapeFam in fidx)) { notes.push(`shape family "${shapeFam}" is not in FishShapes; ignored`); shapeFam = null; }
  const shifts = { ...Object.fromEntries(parsed.attributes.map(a => [a.feature, a.sd_shift])), ...(conditions.sd_shift || {}) };
  const keepSize = conditions.keep_size !== false && shifts.SL === undefined;
  const R = rng(seed >>> 0);
  const split = apportion(n, leaves);
  const rows = real();
  const candidates = [];
  let i = 0;
  for (const [leaf, count] of Object.entries(split)) {
    const fam = shapeFam || BASE_FAMILY[leaf];
    if (!fam) throw new Error(`no FishShapes family mapping for "${leaf}"`);
    const famRows = rows.filter(r => r.family === fam);
    const stats = M.family_stats[fam];
    const obs = new Array(M.arch.D).fill(0), mask = new Array(M.arch.D).fill(0);
    const x = new Array(M.arch.D).fill(0);
    const condLog = [];
    if (keepSize && Number.isFinite(baseSLmm)) { x[0] = Math.log(baseSLmm); mask[0] = 1; condLog.push({ feature: 'log_SL_mm', value: x[0], why: `keep the base's size (SL ${baseSLmm.toFixed(1)} mm)` }); }
    for (const [feat, k] of Object.entries(shifts)) {
      const j = FEATURE_INDEX[feat]; if (j === undefined) { notes.push(`unknown feature "${feat}" in sd_shift; ignored`); continue; }
      const ref = j === 0 && Number.isFinite(baseSLmm) ? Math.log(baseSLmm) : stats.mean[j];
      x[j] = ref + k * M.sd_within_family[j]; mask[j] = 1;
      condLog.push({ feature: M.features[j], value: x[j], why: `${j === 0 ? 'base SL' : `${fam} mean`} ${k >= 0 ? '+' : ''}${k} within-family SD` });
    }
    for (const [field, v] of Object.entries(conditions.observe || {})) {
      const j = FIELD.indexOf(field); if (j < 0 || !(v > 0)) { notes.push(`observe.${field} ignored (unknown field or non-positive)`); continue; }
      x[j] = Math.log(j === 0 ? v * 1000 : v); mask[j] = 1; condLog.push({ feature: M.features[j], value: x[j], why: `observe.${field} = ${v}` });
    }
    // Conditioning outside what the family was measured at is extrapolation: say so per candidate group.
    const extrapolated = [];
    for (let j = 0; j < M.arch.D; j++) if (mask[j] && famRows.length) {
      const vals = famRows.map(r => r.x[j]); const lo = Math.min(...vals), hi = Math.max(...vals);
      if (x[j] < lo || x[j] > hi) extrapolated.push(`${M.features[j]} = ${Math.exp(x[j]).toPrecision(4)} is outside the ${famRows.length} measured ${fam} specimens (${Math.exp(lo).toPrecision(4)} to ${Math.exp(hi).toPrecision(4)}): extrapolation`);
    }
    if (extrapolated.length) notes.push(...extrapolated);
    const shifted = new Set(Object.keys(shifts).map(f => FEATURE_INDEX[f]).filter(j => j !== undefined));
    const jitter = conditions.jitter_sd ?? 0.25;
    for (let c = 0; c < count; c++, i++) {
      // A text attribute is a target with spread, not one point: k +- jitter_sd (default 0.25) within-family SDs.
      const xc = x.map((v, j) => (shifted.has(j) && mask[j] ? v + jitter * R.normal() * M.sd_within_family[j] : v));
      const z = standardise(M, xc);
      for (let j = 0; j < M.arch.D; j++) obs[j] = mask[j] ? z[j] : 0;
      const noise = Array.from({ length: M.arch.D }, () => R.normal());
      const zs = sampleOne(M, { fam: fidx[fam], obs, mask, steps: conditions.steps || 48, noise });
      const raw = unstandardise(M, zs);
      // Observed features are GIVEN: the output carries the observed value; how far the model's own output drifted
      // from it is reported as a consistency diagnostic.
      const drift = {}; const xs = raw.slice();
      for (let j = 0; j < M.arch.D; j++) if (mask[j]) { drift[M.features[j]] = +((raw[j] - xc[j]) / M.sd[j]).toFixed(3); xs[j] = xc[j]; }
      const SLmm = Math.exp(xs[0]);
      const v = { standard_length_m: SLmm / 1000, body_depth_over_SL: Math.exp(xs[1]), body_width_over_SL: Math.exp(xs[2]),
        peduncle_depth_frac: Math.exp(xs[3]), peduncle_width_frac: Math.exp(xs[4]), fulton_K: Math.exp(xs[5]), head_depth_over_depth: Math.exp(xs[6]) };
      v.body_mass_kg = v.fulton_K * SLmm ** 3 / 1e8;
      // nearest real specimen (standardised space) and family percentiles
      let best = null;
      for (const r of rows) { let d = 0; for (let j = 0; j < 7; j++) d += ((r.x[j] - xs[j]) / M.sd[j]) ** 2; if (!best || d < best.d) best = { d, r }; }
      const pct = Object.fromEntries(FIELD.map((f, j) => [f, +percentile(famRows.map(r => r.x[j]), xs[j]).toFixed(3)]));
      const edits = [
        ...(keepSize ? [] : [['standard_length_m', v.standard_length_m]]),
        ['body_mass_kg', v.body_mass_kg], ['body_depth_over_SL', v.body_depth_over_SL], ['body_width_over_SL', v.body_width_over_SL],
        ['peduncle_depth_frac', v.peduncle_depth_frac], ['peduncle_width_frac', v.peduncle_width_frac]];
      // a base DOCUMENT keeps its own edits (fins etc.); the generated body edits are appended after them
      let doc = baseDoc.id === 'gen-base' ? O.createOrganism({ id: `gen-${kind}-${seed}-${i}`, parents, notes: `generated by the body ${kind} model from "${text}"` }, bundle)
        : { ...structuredClone(baseDoc), id: `${baseDoc.id}-gen-${kind}-${seed}-${i}`.slice(0, 63) };
      for (const [param, value] of edits)
        doc = O.appendEdit(bundle, doc, { target: { level: 'body', id: 'body' }, param, op: 'set', value: +value.toPrecision(6), author: 'agent:generative',
          reason: `body ${kind} sample ${i} (seed ${seed}; ${fam}-conditioned${condLog.length ? '; ' + condLog.map(c => c.why).join('; ') : ''}); FishShapes v1-trained, sim-engine/generative`, ts: 'generate' });
      candidates.push({
        params: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, +x.toPrecision(5)])),
        organism: doc,
        conditioned_on: { family: fam, leaf_parent: leaf, observed: condLog, extrapolated },
        diagnostics: { percentile_in_family: pct, family_n: famRows.length, observed_feature_drift_sd: drift,
          nearest_real_specimen: { species: best.r.species, family: best.r.family, SpecimenID: best.r.SpecimenID, distance_sd_units: +Math.sqrt(best.d).toFixed(3) } },
        provenance: [
          p('generated body parameters', `candidate ${i}`, 'assumed', `a sample from the ${kind === 'fm' ? 'flow-matching' : 'DDPM'} model (sim-engine/generative/body/model/${kind}.json); not a measured animal`),
          p('training data', 'FishShapes v1', 'measured', SOURCE),
        ],
        not_set_by_this_model: 'fins, head length, cross-section exponent, ray and vertebra counts, flight muscle: kept from the base parents',
      });
    }
  }
  return {
    status: 'ok', candidates, model: `body-${kind}`, parsed_text: parsed, notes,
    provenance: [p('training data', 'FishShapes v1', 'measured', SOURCE), p('model', `body-${kind}`, 'derived', `trained by sim-engine/generative/body/train.py; held-out metrics in sim-engine/generative/RESULTS.md`)],
    scope: `Each candidate is a SAMPLE from a ${kind === 'fm' ? 'conditional flow-matching' : 'diffusion'} model of adult teleost body proportions learned from FishShapes v1 museum specimens (16 123 specimens; ${rows.filter(r => r.family === 'Exocoetidae').length} flying fish, ${rows.filter(r => r.species === 'Danio_rerio').length} zebrafish among 1 268 Cyprinidae). It generates body depth, width, peduncle fractions and mass at a given size, conditioned on a family and on any observed features; it does NOT generate fins, head length, organs or development, and the "zebrafish" condition is Cyprinidae, not Danio rerio. A sample is a plausible teleost-like body shape, not a viable, buildable or developmentally reachable organism, and "deeper body" means "the family mean plus k within-family SDs", not a measured mutant.`,
  };
}
