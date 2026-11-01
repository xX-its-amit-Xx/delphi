// closest_relative_phenotype: embed a design's resolved STATE in a small, documented feature space and find the
// nearest REAL organisms / specimens, with the distance, the features that dominate it, and an out-of-distribution
// flag whose threshold is calibrated on held-out real specimens (never on designs).
//
// Two feature blocks, because the reference data do not all measure the same things:
//   body block (6 features, every FishShapes specimen has at least 4): log10 SL, log10 (mass / SL^3),
//     log10 depth/SL, log10 width/SL, log10 peduncle-depth / max depth, log10 peduncle-width / max width.
//     References: FishShapes v1 specimens (16 377 teleosts, measured), our real organisms (zebrafish adult and larva,
//     flying fish) and their ontogeny stages (STATE at each stage age).
//   fin block (8 features, log10(x + 0.005)): pectoral length/SL, pectoral area (both)/SL^2, pectoral span/SL,
//     pelvic length/SL, dorsal height/SL, anal height/SL, caudal upper and lower lobe/SL.
//     References: our real organisms and their stages (all 8, many ASSUMED in the parameter files) and the Daane
//     2021 sheet A beloniform species (pectoral length/SL only, measured) from sequences/progression.json.
// Distance to a reference = RMS of per-feature z-scores over the features both carry (z = diff / scale).
// Scales: body = robust SD (1.4826 MAD) over the FishShapes calibration-train split; fin = max(0.1, robust SD over
// the fin references). OOD: p = (1 + #{held-out real NN distances >= d}) / (n + 1), separately per block.
// Birds: none of these sources contain Aves; every reference passes an explicit Aves filter that is reported.
import fs from 'node:fs';
import path from 'node:path';
import { loadBundle } from '../lib/data-node.mjs';
import * as O from '../lib/organism.mjs';
import { resolveState, stageAges } from '../lib/state.mjs';

export const SEED = 20261101;
export const HOLDOUT_FRACTION = 0.2;
export const FIN_OFFSET = 0.005;
export const BODY = ['log_SL', 'log_K', 'log_depth_SL', 'log_width_SL', 'log_ped_depth', 'log_ped_width'];
export const FIN = ['pectoral_len_SL', 'pectoral_area_SL2', 'pectoral_span_SL', 'pelvic_len_SL', 'dorsal_h_SL', 'anal_h_SL', 'caudal_upper_SL', 'caudal_lower_SL'];
export const FEATURE_LABEL = {
  log_SL: 'standard length (log10 m)', log_K: 'mass / SL^3 (log10 kg m^-3; mass-length condition)', log_depth_SL: 'max body depth / SL (log10)',
  log_width_SL: 'max body width / SL (log10)', log_ped_depth: 'caudal peduncle depth / max depth (log10)', log_ped_width: 'caudal peduncle width / max width (log10)',
  pectoral_len_SL: 'pectoral fin length / SL', pectoral_area_SL2: 'pectoral area (both) / SL^2', pectoral_span_SL: 'pectoral span / SL', pelvic_len_SL: 'pelvic fin length / SL',
  dorsal_h_SL: 'dorsal fin height / SL', anal_h_SL: 'anal fin height / SL', caudal_upper_SL: 'caudal upper lobe / SL', caudal_lower_SL: 'caudal lower lobe / SL',
};
export const AVES_RE = /\b(aves|bird|birds|avian|passeri\w*|columb\w*|gallus|anas|aquila|strigi\w*|psittac\w*|apodi\w*|taeniopygia|corvus)\b/i;

const L10 = Math.log10;
const finT = x => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? L10(x + FIN_OFFSET) : null);
const posL = x => (typeof x === 'number' && x > 0 ? L10(x) : null);

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
export const robustSD = a => { const m = median(a); return 1.4826 * median(a.map(x => Math.abs(x - m))); };
export const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };

// ---------------------------------------------------------------- feature extraction
/** Body + fin feature vectors from raw dimensional values (null where unknown). */
export function featuresFromRaw(r) {
  const body = {
    log_SL: posL(r.SL_m), log_K: r.mass_kg > 0 && r.SL_m > 0 ? L10(r.mass_kg / r.SL_m ** 3) : null,
    log_depth_SL: posL(r.depth_SL), log_width_SL: posL(r.width_SL), log_ped_depth: posL(r.ped_depth_frac), log_ped_width: posL(r.ped_width_frac),
  };
  const fin = Object.fromEntries(FIN.map(k => [k, finT(r[k])]));
  return { body, fin };
}

/** Raw values of a resolved STATE (sim-engine/lib/state.mjs). Fin length follows partedit 'length' scale edits on
 *  the pectoral fins; area and span come from STATE, which already applies partedit fin geometry. */
export function rawFromState(state) {
  const P = state._meta?.parameters || {};
  const v = k => (P[k] && typeof P[k].value === 'number' ? P[k].value : null);
  const SL = state.SL_m?.value ?? null;
  let lenFactor = 1;
  for (const g of state._meta?.geometry || []) if (g.param === 'length' && g.op === 'scale' && (g.parts || []).some(p => /^pectoral_fin_[LR]$/.test(p))) lenFactor *= g.value;
  const area = state.pectoral_area_both_m2?.value, span = state.pectoral_span_m?.value;
  return {
    SL_m: SL, mass_kg: state.mass_kg?.value ?? null,
    depth_SL: v('body_depth_over_SL'), width_SL: v('body_width_over_SL'), ped_depth_frac: v('peduncle_depth_frac'), ped_width_frac: v('peduncle_width_frac'),
    pectoral_len_SL: v('pectoral_len_over_SL') == null ? null : v('pectoral_len_over_SL') * lenFactor,
    pectoral_area_SL2: area != null && SL ? area / SL ** 2 : v('pectoral_area_over_SL2'),
    pectoral_span_SL: span != null && SL ? span / SL : v('pectoral_span_over_SL'),
    pelvic_len_SL: v('pelvic_len_over_SL'), dorsal_h_SL: v('dorsal_height_over_SL'), anal_h_SL: v('anal_height_over_SL'),
    caudal_upper_SL: v('caudal_upper_lobe_over_SL'), caudal_lower_SL: v('caudal_lower_lobe_over_SL'),
    flight_muscle_fraction: v('flight_muscle_fraction'), section_exponent: v('body_section_exponent'),
    stage: state.stage?.value ?? null, ageDays: state.ageDays?.value ?? null,
    kinds: Object.fromEntries(['body_depth_over_SL', 'body_width_over_SL', 'peduncle_depth_frac', 'peduncle_width_frac', 'pectoral_len_over_SL', 'pectoral_area_over_SL2'].map(k => [k, P[k]?.kind ?? null])),
  };
}

// ---------------------------------------------------------------- reference set
export const REAL_ORGANISMS = ['zebrafish-adult', 'zebrafish-larva', 'flying-fish'];
let _refs = null;
let ACTIVE_SEED = SEED;
/** Switch the species split seed (scorer stability runs only); the default is SEED. */
export function useSeed(s) { ACTIVE_SEED = s; }
export async function loadReferences({ fresh = false, seed = ACTIVE_SEED } = {}) {
  if (_refs && !fresh && _refs.seed === seed) return _refs;
  const bundle = await loadBundle();
  const ROOT = path.resolve(import.meta.dirname, '..', '..');
  const fsj = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'data', 'fishshapes-features.json'), 'utf8'));
  const prog = JSON.parse(fs.readFileSync(path.join(ROOT, 'sequences', 'progression.json'), 'utf8'));
  const finBySpecies = {};
  for (const r of prog.rows) if (/^this species|^congener/.test(r.fin_ratio?.basis || '')) finBySpecies[r.species.replace(/ /g, '_')] = { v: r.fin_ratio.pectoral_over_SL_median, n: r.fin_ratio.n_specimens, basis: r.fin_ratio.basis };
  const refs = []; const avesDropped = [];
  const push = ref => { if (AVES_RE.test(`${ref.name} ${ref.taxon || ''}`)) { avesDropped.push(ref.name); return; } refs.push(ref); };
  for (const [id, sp, fam, ord, SL, M, D, W, PD, PW] of fsj.rows) {
    const fin = finBySpecies[sp];
    const raw = { SL_m: SL, mass_kg: M, depth_SL: D / SL, width_SL: W / SL, ped_depth_frac: PD != null ? PD / D : null, ped_width_frac: PW != null ? PW / W : null, pectoral_len_SL: fin ? fin.v : null };
    push({ id: `fishshapes:${id}:${sp}`, name: sp.replace(/_/g, ' '), group: `species:${sp}`, taxon: `${fam} (${ord})`, source: 'FishShapes v1 (doi 10.1002/ecy.3829)', kind: 'measured',
      fin_note: fin ? `pectoral length/SL ${fin.v} is the species median from Daane 2021 sheet A (${fin.basis}; n ${fin.n}), attached to the species' median-SL specimen` : null,
      raw, ...featuresFromRaw(raw) });
  }
  // Daane 2021 sheet A species that FishShapes lacks: fin-only references.
  const fsSpecies = new Set(fsj.rows.map(r => r[1]));
  for (const [sp, fin] of Object.entries(finBySpecies)) if (!fsSpecies.has(sp)) {
    const raw = { pectoral_len_SL: fin.v };
    push({ id: `daane2021:${sp}`, name: sp.replace(/_/g, ' '), group: `species:${sp}`, taxon: 'Beloniformes', source: `sequences/progression.json (Daane 2021 sheet A, ${fin.basis}; n ${fin.n})`, kind: 'measured', raw, ...featuresFromRaw(raw) });
  }
  // Our real organisms, at their reference age and at every ontogeny stage age (STATE from resolveState).
  for (const oid of REAL_ORGANISMS) {
    const doc = O.docFor(bundle, oid);
    const refAge = bundle.organisms[oid].ref_age_days;
    const ages = [...new Set([refAge, ...stageAges(bundle, doc).map(s => s.ageDays)])];
    for (const age of ages) {
      let st; try { st = resolveState(doc, age, {}, bundle); } catch { continue; }
      const raw = rawFromState(st);
      const isRef = age === refAge;
      push({ id: isRef ? oid : `${oid}@${age}d`, name: isRef ? `${bundle.organisms[oid].name || oid} (repository reference organism)` : `${oid} at ${age} d (${raw.stage}; ontogeny STATE)`,
        group: `organism:${bundle.organisms[oid].track}`, taxon: bundle.organisms[oid].taxon, source: isRef ? `anatomy-model/parametric/organisms/${oid}.json` : 'sim-engine/lib/state.mjs resolveState at a stage age (params/ontogeny.json, development/)',
        kind: 'mixed (see raw.kinds; many fin and width parameters are assumed)', raw, ...featuresFromRaw(raw), organism: oid, ageDays: age });
    }
  }
  // Calibration split: hold out HOLDOUT_FRACTION of FishShapes SPECIES (seeded), so a held-out specimen's nearest
  // neighbour is never its own species: the situation of a design, which is not any catalogued species.
  const rnd = mulberry32(seed);
  const species = [...new Set(refs.filter(r => r.id.startsWith('fishshapes:')).map(r => r.group))].sort();
  // Three-way species split: 'calibration' sets the OOD distribution; 'test' is touched only by the scorer
  // validation (validate/scorer-validation.mjs); both are excluded from the calibration's train pool.
  const u = species.map(() => rnd());
  const held = new Set(species.filter((_, i) => u[i] < HOLDOUT_FRACTION));
  const test = new Set(species.filter((_, i) => u[i] >= HOLDOUT_FRACTION && u[i] < 2 * HOLDOUT_FRACTION));
  for (const r of refs) r.split = held.has(r.group) ? 'calibration' : test.has(r.group) ? 'test' : 'train';
  const train = refs.filter(r => r.split === 'train' && r.id.startsWith('fishshapes:'));
  const bodyScale = Object.fromEntries(BODY.map(k => [k, robustSD(train.map(r => r.body[k]).filter(x => x != null))]));
  // Fin references: every non-FishShapes row with a fin feature, plus ONE row per FishShapes species that has a
  // Daane fin median (its median-SL specimen), so a species median is not counted once per specimen.
  const finRefs = refs.filter(r => !r.id.startsWith('fishshapes:') && FIN.some(k => r.fin[k] != null));
  const joined = {};
  for (const r of refs) if (r.id.startsWith('fishshapes:') && r.fin.pectoral_len_SL != null) (joined[r.group] ||= []).push(r);
  for (const rows of Object.values(joined)) finRefs.push(rows.sort((a, b) => a.raw.SL_m - b.raw.SL_m)[Math.floor(rows.length / 2)]);
  // Remove the fin median from the other specimens of the species (kept on one), for the same reason.
  const keep = new Set(finRefs.map(r => r.id));
  for (const r of refs) if (r.id.startsWith('fishshapes:') && r.fin.pectoral_len_SL != null && !keep.has(r.id)) { r.fin = { ...r.fin, pectoral_len_SL: null }; r.fin_note = null; }
  const finScale = Object.fromEntries(FIN.map(k => { const xs = finRefs.map(r => r.fin[k]).filter(x => x != null); return [k, Math.max(0.1, xs.length > 2 ? robustSD(xs) : 0.1)]; }));
  // observed ranges for the allometry sanity check (all FishShapes specimens, both splits; fins: fin references)
  const range = {};
  const fsRefs = refs.filter(r => r.id.startsWith('fishshapes:'));
  for (const k of BODY) { const xs = fsRefs.map(r => r.body[k]).filter(x => x != null); range[k] = { min: Math.min(...xs), max: Math.max(...xs), p005: quantile(xs, 0.005), p995: quantile(xs, 0.995), n: xs.length, source: 'FishShapes v1, all specimens' }; }
  for (const k of FIN) { const xs = finRefs.map(r => r.fin[k]).filter(x => x != null); range[k] = xs.length ? { min: Math.min(...xs), max: Math.max(...xs), n: xs.length, source: 'fin references (our organisms + stages + Daane 2021 sheet A)' } : null; }
  _refs = { seed, test_species: test.size, refs, finRefs, bodyScale, finScale, range, held_species: held.size, n_species: species.length, aves_dropped: avesDropped,
    sources: { fishshapes: fsj.source, fishshapes_rows: fsj.n_rows_kept, progression: 'sequences/progression.json rows with basis "this species" or "congener" (Daane 2021 Data S1 sheet A)' } };
  _refs.calibration = calibrate(_refs);
  return _refs;
}

// ---------------------------------------------------------------- distance and neighbours
export function dist(a, b, scale, keys) {
  let s = 0, n = 0; const contrib = {};
  for (const k of keys) { if (a[k] == null || b[k] == null) continue; const z = (a[k] - b[k]) / scale[k]; contrib[k] = z * z; s += z * z; n++; }
  return n ? { d: Math.sqrt(s / n), n, contrib } : null;
}
// Packed copy of a pool for the body block (Float64Array, NaN = missing), so calibration over ~3 000 x 13 000
// pairs runs in about a second instead of building objects per pair.
const _packed = new WeakMap();
function packed(pool, keys) {
  let p = _packed.get(pool); if (p) return p;
  const m = keys.length, a = new Float64Array(pool.length * m);
  pool.forEach((r, i) => keys.forEach((k, j) => { a[i * m + j] = r.body[k] == null ? NaN : r.body[k]; }));
  p = { a, m }; _packed.set(pool, p); return p;
}
export function nearest(q, pool, block, scale, { k = 5, exclude = () => false, minShared = block === 'body' ? 4 : 1 } = {}) {
  const keys = block === 'body' ? BODY : FIN;
  if (block === 'body') {
    const { a, m } = packed(pool, keys); const qv = keys.map(f => (q.body[f] == null ? NaN : q.body[f])); const sc = keys.map(f => scale[f]);
    const best = [];
    for (let i = 0; i < pool.length; i++) {
      let s = 0, n = 0;
      for (let j = 0; j < m; j++) { const x = a[i * m + j], y = qv[j]; if (x !== x || y !== y) continue; const z = (y - x) / sc[j]; s += z * z; n++; }
      if (n < minShared) continue;
      const d = Math.sqrt(s / n);
      if (best.length < k || d < best[best.length - 1].d) { if (exclude(pool[i])) continue; best.push({ i, d }); best.sort((u, v) => u.d - v.d); if (best.length > k) best.pop(); }
    }
    return best.map(({ i }) => ({ r: pool[i], ...dist(q.body, pool[i].body, scale, keys) }));
  }
  const out = [];
  for (const r of pool) {
    if (exclude(r)) continue;
    const x = dist(q[block], r[block], scale, keys);
    if (!x || x.n < minShared) continue;
    if (out.length < k || x.d < out[out.length - 1].d) { out.push({ r, ...x }); out.sort((a, b) => a.d - b.d); if (out.length > k) out.pop(); }
  }
  return out;
}

function calibrate(R) {
  const t0 = Date.now();
  const calBody = R.refs.filter(r => r.split === 'calibration' && r.id.startsWith('fishshapes:'));
  const poolBody = R.refs.filter(r => r.split === 'train');
  const bodyD = [];
  for (const q of calBody) { const nn = nearest(q, poolBody, 'body', R.bodyScale, { k: 1 }); if (nn.length) bodyD.push(nn[0].d); }
  // fin block: leave-one-GROUP-out over the fin references (a real organism's own ontogeny stages are its group)
  const finD = [];
  for (const q0 of R.finRefs) {
    if (q0.fin.pectoral_len_SL == null) continue;
    const q = { body: q0.body, fin: { pectoral_len_SL: q0.fin.pectoral_len_SL } };
    const nn = nearest(q, R.finRefs, 'fin', R.finScale, { k: 1, exclude: r => r.group === q0.group || r.fin.pectoral_len_SL == null });
    if (nn.length) finD.push({ id: q0.id, d: nn[0].d, nn: nn[0].r.id });
  }
  const bodyQ = q => quantile(bodyD, q);
  return {
    body: { n: bodyD.length, held_out_species: R.held_species, distances_sorted: [...bodyD].sort((a, b) => a - b), p50: bodyQ(0.5), p90: bodyQ(0.9), p95: bodyQ(0.95), p99: bodyQ(0.99), max: Math.max(...bodyD),
      threshold: bodyQ(0.99), threshold_rule: '99th percentile of nearest-neighbour distances of held-out-species FishShapes specimens to the train pool' },
    fin: { n: finD.length, rows: finD, distances_sorted: finD.map(x => x.d).sort((a, b) => a - b), max: Math.max(...finD.map(x => x.d)), threshold: Math.max(...finD.map(x => x.d)),
      threshold_rule: 'pectoral length/SL only: maximum leave-one-group-out nearest-neighbour distance among the fin references (n is small; see n)' },
    ms: Date.now() - t0,
  };
}

export const pValue = (sorted, d) => { let c = 0; for (let i = sorted.length - 1; i >= 0 && sorted[i] >= d - 1e-12; i--) c++; return (1 + c) / (sorted.length + 1); };

/** Nearest real relatives for a raw feature record (from rawFromState or a specimen). */
export async function closestPhenotype(raw, { k = 5, exclude = [] } = {}) {
  const R = await loadReferences();
  const q = featuresFromRaw(raw);
  const ex = new Set(exclude);
  const excl = r => ex.has(r.id) || ex.has(r.group) || (r.organism && ex.has(r.organism));
  const fmt = (nn, block) => nn.map(x => {
    const tot = Object.values(x.contrib).reduce((s, v) => s + v, 0);
    return { id: x.r.id, name: x.r.name, taxon: x.r.taxon, source: x.r.source, kind: x.r.kind, distance: +x.d.toFixed(4), shared_features: x.n,
      dominant_features: Object.entries(x.contrib).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, c]) => ({ feature: f, label: FEATURE_LABEL[f], share: tot ? +(c / tot).toFixed(3) : 0, design: +q[block][f].toFixed(4), relative: +x.r[block][f].toFixed(4) })),
      ...(x.r.fin_note && block === 'fin' ? { note: x.r.fin_note } : {}) };
  });
  const block = (name, pool, scale, cal) => {
    const keys = name === 'body' ? BODY : FIN;
    const have = keys.filter(f => q[name][f] != null);
    if (!have.length) return { ran: false, reason: `the design has none of the ${name} features` };
    const nn = nearest(q, pool, name, scale, { k, exclude: excl });
    if (!nn.length) return { ran: false, reason: 'no reference shares enough features' };
    const d = nn[0].d;
    return { ran: true, features_present: have, nearest: fmt(nn, name), distance: +d.toFixed(4), p_value: +pValue(cal.distances_sorted, d).toFixed(4), threshold: +cal.threshold.toFixed(4), ood: d > cal.threshold, calibration_n: cal.n, threshold_rule: cal.threshold_rule };
  };
  const body = block('body', R.refs, R.bodyScale, R.calibration.body);
  // Fin block, pectoral length only: the one fin feature with measured references across species (Daane 2021).
  const qp = { body: q.body, fin: { pectoral_len_SL: q.fin.pectoral_len_SL } };
  let fin;
  if (qp.fin.pectoral_len_SL == null) fin = { ran: false, reason: 'the design has no pectoral fin length' };
  else {
    const nn = nearest(qp, R.finRefs, 'fin', R.finScale, { k, exclude: r => excl(r) || r.fin.pectoral_len_SL == null });
    const d = nn[0].d, cal = R.calibration.fin;
    fin = { ran: true, features_present: ['pectoral_len_SL'], nearest: fmt(nn, 'fin'), distance: +d.toFixed(4), p_value: +pValue(cal.distances_sorted, d).toFixed(4), threshold: +cal.threshold.toFixed(4), ood: d > cal.threshold, calibration_n: cal.n, threshold_rule: cal.threshold_rule };
  }
  const envelope = finEnvelope(q.fin, R);
  return { query: { body: q.body, fin: q.fin }, body, fin, fin_envelope: envelope,
    closest_real_relative: body.ran ? body.nearest[0] : (fin.ran ? fin.nearest[0] : null),
    closest_real_relative_fins: fin.ran ? fin.nearest[0] : null,
    ood: [body, fin].some(b => b.ran && b.ood) || envelope.outside.length > 0, excluded: [...ex],
    aves_excluded: { rule: 'explicit Aves filter on every reference name and taxon (frozen holdout); FishShapes and Daane 2021 are fish-only', dropped: R.aves_dropped.length } };
}

// The other seven fin features have references only in our own organisms and their stages (two lineages, many values
// assumed), so no distance threshold can be calibrated for them. Instead an ENVELOPE rule, fixed in advance:
// excess_k = how far the design lies outside [min, max] of the references for feature k, in units of that feature's
// scale (0 inside). p_envelope = exp(-max excess). UNCALIBRATED: stated as such wherever it is reported.
export function finEnvelope(fin, R) {
  const rows = []; let worst = 0;
  for (const k of FIN) {
    const x = fin[k], rg = R.range[k];
    if (x == null || !rg) continue;
    const e = Math.max(0, (x - rg.max) / R.finScale[k], (rg.min - x) / R.finScale[k]);
    const un = t => +(10 ** t - FIN_OFFSET).toPrecision(3); // back from log10(x + 0.005) to x (a ratio to SL or SL^2)
    rows.push({ feature: k, label: FEATURE_LABEL[k], design: un(x), min: un(rg.min), max: un(rg.max), n_refs: rg.n, excess: +e.toFixed(3) });
    worst = Math.max(worst, e);
  }
  return { rule: 'p = exp(-max excess); excess = distance outside the real-reference range in scale units (log10(x+0.005)); UNCALIBRATED (references: 2 lineages + 9 measured beloniform species for pectoral length)',
    p_value: +Math.exp(-worst).toFixed(4), max_excess: +worst.toFixed(3), outside: rows.filter(r => r.excess > 0), features: rows };
}
