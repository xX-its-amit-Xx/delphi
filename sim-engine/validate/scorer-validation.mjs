#!/usr/bin/env node
// Validates the design scorer (score.mjs) against SCORER-PREREGISTRATION.md. Run ONLY after that file's last line
// holds its sha256 (this script refuses otherwise), so no criterion can be moved after a number is seen.
//
//   node sim-engine/validate/scorer-validation.mjs            -> scorer-results.json + SCORER-RESULTS.md
//   QUICK=1 ...                                               -> smaller samples (development only; not reported)
//
// Exit code 0 even when criteria fail: failures are results, written to SCORER-RESULTS.md and kept.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadBundle } from '../lib/data-node.mjs';
import * as O from '../lib/organism.mjs';
import { stageAges } from '../lib/state.mjs';
import { assess, SCORERS } from './score.mjs';
const SCORER_FOR = () => SCORERS[process.env.SCORER_VERSION || '1.0.0'];
import { loadReferences, useSeed, mulberry32, SEED, BODY } from './phenotype.mjs';

const DIR = import.meta.dirname;
const QUICK = !!process.env.QUICK;
const VERSION = process.env.SCORER_VERSION || '1.0.0';
const N_TEST = QUICK ? 40 : 300, N_SYN = QUICK ? 40 : 300, N_ADV = QUICK ? 40 : 300, N_STAB = QUICK ? 30 : 100;
const STAB_SEEDS = [SEED, 11, 22, 33, 44];

// ---------------------------------------------------------------- pre-registration guard
const PRE = path.join(DIR, VERSION === '1.0.0' ? 'SCORER-PREREGISTRATION.md' : `SCORER-PREREGISTRATION-v${VERSION}.md`);
function checkPrereg() {
  const txt = fs.readFileSync(PRE, 'utf8').replace(/\r\n/g, '\n');
  const lines = txt.trimEnd().split('\n');
  const last = lines.pop();
  const m = last.match(/sha256 ([0-9a-f]{64})/);
  const body = lines.join('\n') + '\n';
  const h = crypto.createHash('sha256').update(body).digest('hex');
  if (!m || m[1] !== h) throw new Error(`SCORER-PREREGISTRATION.md: last line must be "sha256 <hash of everything above it>"; computed ${h}`);
  return h;
}

// ---------------------------------------------------------------- helpers
const author = 'agent:validate', reason = 'scorer validation (pre-registered)';
const auc = (pos, neg) => { let s = 0; for (const a of pos) for (const b of neg) s += a > b ? 1 : a === b ? 0.5 : 0; return pos.length && neg.length ? s / (pos.length * neg.length) : null; };
const frac = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : null);
const r4 = x => (x == null ? null : +x.toFixed(4));

async function scoreSpecimen(ref, raw, label) {
  const r = await assess({ specimen: raw, exclude: [ref.group], label, taxon: 'Teleostei', version: VERSION, lawset: process.env.LAWSET || 'current' });
  return { label, score: r.score.value, rank_score: r.score.rank_score ?? null, nearest_distance: r.verdict.closest_real_relative?.distance ?? null, plausible: r.score.plausible, P: r.score.components.P.value, L: r.score.components.L.value, limiting: r.score.components.P.limiting, nearest: r.verdict.closest_real_relative?.name };
}
async function scoreDoc(doc, label, extra = {}) {
  const r = await assess({ organism: doc, ...extra, version: VERSION, lawset: process.env.LAWSET || 'current' });
  const C = r.score.components;
  return { label, score: r.score.value, rank_score: r.score.rank_score ?? null, plausible: r.score.plausible, P: C.P.ran ? r4(C.P.value) : null, L: C.L.value, G: C.G.value, E: C.E.value, limiting: C.P.limiting,
    nearest: r.verdict.closest_real_relative?.name, nearest_distance: r.verdict.closest_real_relative?.distance, failed: r.verdict.failed, lean_new: (r.lean?.accepted?.newly_caused || []).map(v => v.constraint), g_why: C.G.why };
}
function mk(bundle, base, edits, id = 'v', genotype = null) {
  let d = { ...O.docFor(bundle, base), id };
  for (const e of edits) d = O.appendEdit(bundle, d, { author, reason, ...e });
  return genotype ? { ...d, genotype } : d;
}
const body = (param, op, value) => ({ target: { level: 'body' }, param, op, value });
const gene = (id, value) => ({ target: { level: 'gene', id }, param: 'allele', op: 'set', value });

// ---------------------------------------------------------------- sets
async function buildAndScore(bundle, seedForTest = SEED) {
  const R = await loadReferences();
  const rnd = mulberry32(seedForTest + 7);
  const pick = (arr, n) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const testRefs = R.refs.filter(r => r.split === 'test' && r.id.startsWith('fishshapes:'));
  const out = { positives: {}, negatives: {} };
  // A1 held-out test-species specimens
  out.positives.A1_fishshapes_test = [];
  for (const r of pick(testRefs, N_TEST)) out.positives.A1_fishshapes_test.push(await scoreSpecimen(r, r.raw, r.name));
  // N4 synthetic perturbations of OTHER test specimens beyond the observed range
  out.negatives.N4_synthetic_beyond_range = [];
  for (const r of pick(testRefs, N_SYN)) {
    const have = BODY.filter(k => r.body[k] != null);
    const k = have[Math.floor(rnd() * have.length)], rg = R.range[k], span = rg.max - rg.min, up = rnd() < 0.5;
    const x = up ? rg.max + 0.5 * span : rg.min - 0.5 * span; const v = 10 ** x; const raw = { ...r.raw };
    if (k === 'log_SL') { const m = raw.mass_kg / raw.SL_m ** 3; raw.SL_m = v; raw.mass_kg = m * v ** 3; }
    else if (k === 'log_K') raw.mass_kg = v * raw.SL_m ** 3;
    else if (k === 'log_depth_SL') raw.depth_SL = v; else if (k === 'log_width_SL') raw.width_SL = v;
    else if (k === 'log_ped_depth') raw.ped_depth_frac = v; else if (k === 'log_ped_width') raw.ped_width_frac = v;
    out.negatives.N4_synthetic_beyond_range.push({ ...(await scoreSpecimen(r, raw, `${r.name} with ${k} ${up ? 'above' : 'below'} the FishShapes range`)), feature: k });
  }
  return out;
}

async function organismSets(bundle) {
  const P = {}, N = {};
  // A2 real organisms, own lineage excluded from the references
  P.A2_real_organisms_LOO = [];
  for (const [id, lineage] of [['zebrafish-adult', 'organism:zebrafish'], ['zebrafish-larva', 'organism:zebrafish'], ['flying-fish', 'organism:flying-fish']])
    P.A2_real_organisms_LOO.push(await scoreDoc(O.docFor(bundle, id), `${id} (own lineage excluded)`, { exclude: [lineage] }));
  // A3 ontogeny stages, own lineage excluded
  P.A3_ontogeny_stages_LOO = [];
  for (const [id, lineage] of [['zebrafish-adult', 'organism:zebrafish'], ['flying-fish', 'organism:flying-fish']]) {
    const doc = O.docFor(bundle, id);
    for (const s of stageAges(bundle, doc)) P.A3_ontogeny_stages_LOO.push(await scoreDoc(doc, `${id} at ${s.ageDays} d (own lineage excluded)`, { ageDays: s.ageDays, exclude: [lineage] }));
  }
  // A4 real lab mutants (zebrafish backgrounds; lineage NOT excluded: a mutant's nearest real relative is its own species)
  const Z = 'zebrafish-adult', L = 'zebrafish-larva';
  P.A4_real_mutants = [];
  const mutants = [
    ['kcnk5b alf W169L (het)', mk(bundle, Z, [gene('kcnk5b', 'p.W169L/+')])],
    ['kcnk5b alf F241Y', mk(bundle, Z, [gene('kcnk5b', 'p.F241Y')])],
    ['slc43a2a lat4a nr21 T200K (het)', mk(bundle, Z, [gene('slc43a2a', 'p.T200K/+')])],
    ['kcnh2a lfr1 Y669N', mk(bundle, Z, [gene('kcnh2a', 'p.Y669N')])],
    ['kcnh2a lfr2 L739Q', mk(bundle, Z, [gene('kcnh2a', 'p.L739Q')])],
    ['kcnh2a WL7 Y418*', mk(bundle, Z, [gene('kcnh2a', 'p.Y418*')])],
    ['kcnh2a longfin t2 inversion', mk(bundle, Z, [gene('kcnh2a', 'longfin t2 cis-regulatory inversion')])],
    ['gja1b sof j7e1 F30V', mk(bundle, Z, [], 'v', [{ gene: 'gja1b', change: 'p.F30V' }])],
    ['gja1b stp tl28d W78L', mk(bundle, Z, [], 'v', [{ gene: 'gja1b', change: 'p.W78L' }])],
    ['gja1b dmh35 G138D', mk(bundle, Z, [], 'v', [{ gene: 'gja1b', change: 'p.G138D' }])],
    ['prdm1a m805 W154* (isoform numbering does not match the canonical protein)', mk(bundle, Z, [gene('prdm1a', 'p.W154*')])],
    ['winged zebrafish: Daane 2021 kcnh2a-lof x lat4a-nr21 double het (repository design + its two edits)', mk(bundle, 'winged-zebrafish', [gene('slc43a2a', 'p.T200K/+'), gene('kcnh2a', 'longfin t2 cis-regulatory inversion')])],
    ['hhip uki Y285* larva, pectoral fin area +65 % (72 hpf)', mk(bundle, L, [body('pectoral_area_over_SL2', 'scale', 1.65)], 'v', [{ gene: 'hhip', change: 'p.Y285*' }]), { ageDays: 3 }],
    ['prdm1a tp39 hypomorph larva, pectoral fin length -30 % (4 dpf)', mk(bundle, L, [body('pectoral_len_over_SL', 'scale', 0.7)]), { ageDays: 4 }],
  ];
  for (const [label, doc, extra] of mutants) P.A4_real_mutants.push(await scoreDoc(doc, label, extra || {}));
  // N1 accepted-law breakers
  N.N1_lean_breakers = [];
  for (const [label, doc] of [
    ['flying fish, SL x3 at constant mass', mk(bundle, 'flying-fish', [body('standard_length_m', 'scale', 3)])],
    ['flying fish, SL x2 at constant mass', mk(bundle, 'flying-fish', [body('standard_length_m', 'scale', 2)])],
    ['flying fish, SL x0.4 at constant mass', mk(bundle, 'flying-fish', [body('standard_length_m', 'scale', 0.4)])],
    ['flying fish, mass x8 at constant SL', mk(bundle, 'flying-fish', [body('body_mass_kg', 'scale', 8)])],
    ['flying fish, mass x0.1 at constant SL', mk(bundle, 'flying-fish', [body('body_mass_kg', 'scale', 0.1)])],
  ]) N.N1_lean_breakers.push(await scoreDoc(doc, label));
  // N2 organs that do not fit
  N.N2_organ_does_not_fit = [];
  for (const [label, doc] of [
    ['zebrafish, flight muscle 0.30 of body mass', mk(bundle, Z, [body('flight_muscle_fraction', 'set', 0.3)])],
    ['zebrafish, flight muscle 0.50 of body mass', mk(bundle, Z, [body('flight_muscle_fraction', 'set', 0.5)])],
    ['flying fish, flight muscle 0.30 of body mass', mk(bundle, 'flying-fish', [body('flight_muscle_fraction', 'set', 0.3)])],
    ['flying fish, flight muscle 0.16 (tff value) on the unchanged body', mk(bundle, 'flying-fish', [body('flight_muscle_fraction', 'set', 0.16)])],
  ]) N.N2_organ_does_not_fit.push(await scoreDoc(doc, label));
  // N3 allometric impossibilities
  N.N3_allometric_impossible = [];
  for (const [label, doc] of [
    ['zebrafish, mass x10 at constant SL', mk(bundle, Z, [body('body_mass_kg', 'scale', 10)])],
    ['zebrafish, mass x0.1 at constant SL', mk(bundle, Z, [body('body_mass_kg', 'scale', 0.1)])],
    ['zebrafish, body depth/SL x3', mk(bundle, Z, [body('body_depth_over_SL', 'scale', 3)])],
    ['zebrafish, body width/SL x4', mk(bundle, Z, [body('body_width_over_SL', 'scale', 4)])],
    ['zebrafish, pectoral fin length x6 (0.93 SL)', mk(bundle, Z, [body('pectoral_len_over_SL', 'scale', 6)])],
    ['zebrafish, caudal lobes x4', mk(bundle, Z, [body('caudal_upper_lobe_over_SL', 'scale', 4), body('caudal_lower_lobe_over_SL', 'scale', 4)])],
    ['flying fish, pectoral span/SL x3', mk(bundle, 'flying-fish', [body('pectoral_span_over_SL', 'scale', 3)])],
    ['flying fish, peduncle depth fraction x3', mk(bundle, 'flying-fish', [body('peduncle_depth_frac', 'scale', 3)])],
  ]) N.N3_allometric_impossible.push(await scoreDoc(doc, label));
  return { P, N };
}

// Adversarial random search: designs that are CLEARLY implausible by the pre-registered predicate yet score >= 0.5.
const ADV_EDITS = [
  ['vertebra_count', 'scale', [0.2, 5]], ['pectoral_ray_count', 'scale', [0.2, 5]], ['caudal_ray_count', 'scale', [0.2, 5]], ['dorsal_ray_count', 'scale', [0.2, 5]],
  ['gill_area_m2', 'scale', [0.02, 3]], ['hb_P50_kPa', 'scale', [0.05, 20]], ['red_muscle_fraction', 'set', [0.01, 0.99]], ['body_density_kg_m3', 'set', [500, 2000]],
  ['body_mass_kg', 'scale', [0.2, 5]], ['pectoral_len_over_SL', 'scale', [0.3, 3]], ['head_fraction_SL', 'scale', [0.3, 3]], ['body_section_exponent', 'scale', [0.5, 2]],
];
export function clearlyImplausible(edits, base) {
  const why = [];
  for (const e of edits) {
    const f = e.op === 'scale' ? e.value : null;
    if (/(_ray_count|vertebra_count)$/.test(e.param) && f != null && (f >= 3 || f <= 1 / 3)) why.push(`${e.param} x${f.toFixed(2)}`);
    if (e.param === 'gill_area_m2' && f != null && f <= 0.1) why.push(`gill area x${f.toFixed(3)}`);
    if (e.param === 'hb_P50_kPa' && f != null && (f >= 10 || f <= 0.1)) why.push(`Hb P50 x${f.toFixed(2)}`);
    if (e.param === 'red_muscle_fraction' && e.value >= 0.9) why.push(`red muscle ${e.value.toFixed(2)} of myotome`);
    if (e.param === 'body_density_kg_m3' && (e.value < 800 || e.value > 1500)) why.push(`body density ${e.value.toFixed(0)} kg/m3`);
    if (e.param === 'head_fraction_SL' && f != null && (f >= 2.5 || f <= 0.4)) why.push(`head length x${f.toFixed(2)}`);
  }
  return why;
}
async function adversarial(bundle) {
  const rnd = mulberry32(SEED + 99);
  const found = [], all = [];
  for (let i = 0; i < N_ADV; i++) {
    const base = rnd() < 0.5 ? 'zebrafish-adult' : 'flying-fish';
    const n = 1 + Math.floor(rnd() * 3);
    const edits = [];
    for (let j = 0; j < n; j++) {
      const [param, op, [lo, hi]] = ADV_EDITS[Math.floor(rnd() * ADV_EDITS.length)];
      if (edits.some(e => e.param === param)) continue;
      const value = op === 'scale' ? Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo))) : lo + rnd() * (hi - lo);
      edits.push({ param, op, value: /_count$/.test(param) && op === 'set' ? Math.round(value) : value });
    }
    let doc;
    try { doc = mk(bundle, base, edits.map(e => body(e.param, e.op, e.value))); } catch (e) { continue; }
    const s = await scoreDoc(doc, `${base}: ${edits.map(e => `${e.param} ${e.op} ${e.value.toPrecision(3)}`).join(', ')}`);
    const why = clearlyImplausible(edits, base);
    all.push({ ...s, implausible_by_predicate: why });
    if (why.length && s.plausible) found.push({ ...s, implausible_by_predicate: why });
  }
  return { searched: all.length, clearly_implausible: all.filter(a => a.implausible_by_predicate.length).length, scored_plausible_anyway: found.length, failures: found.slice(0, 25) };
}

// ---------------------------------------------------------------- main
const hash = checkPrereg();
const t0 = Date.now();
const bundle = await loadBundle();
await loadReferences();
const spec = await buildAndScore(bundle);
const org = await organismSets(bundle);
const positives = { ...spec.positives, ...org.P }, negatives = { ...spec.negatives, ...org.N };
const posScores = Object.values(positives).flat().map(x => x.score), negScores = Object.values(negatives).flat().map(x => x.score);
const plausibleRate = rows => frac(rows, r => r.plausible);
// calibration table
const bins = [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0001];
const calib = bins.slice(0, -1).map((lo, i) => { const hi = bins[i + 1]; const p = posScores.filter(s => s >= lo && s < hi).length, n = negScores.filter(s => s >= lo && s < hi).length; return { bin: `[${lo}, ${Math.min(hi, 1)})`, positives: p, negatives: n, fraction_positive: p + n ? r4(p / (p + n)) : null }; });
// stability across species-split seeds (A1-type positives vs N4-type negatives, smaller samples)
const stab = [];
for (const s of STAB_SEEDS) {
  useSeed(s); const R = await loadReferences({ fresh: true, seed: s });
  const rnd = mulberry32(s + 7); const test = R.refs.filter(r => r.split === 'test' && r.id.startsWith('fishshapes:'));
  const pick = n => { const a = [...test]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const pos = [], neg = [];
  for (const r of pick(N_STAB)) pos.push((await scoreSpecimen(r, r.raw, r.name)).score);
  for (const r of pick(N_STAB)) { const raw = { ...r.raw, mass_kg: r.raw.mass_kg * (rnd() < 0.5 ? 12 : 1 / 12) }; neg.push((await scoreSpecimen(r, raw, r.name)).score); }
  stab.push({ seed: s, threshold_body: r4(R.calibration.body.threshold), auc: r4(auc(pos, neg)), sensitivity: r4(frac(pos, x => x >= SCORER_FOR().plausible_threshold)), specificity: r4(frac(neg, x => x < SCORER_FOR().plausible_threshold)) });
}
useSeed(SEED); await loadReferences({ fresh: true, seed: SEED });
const adv = await adversarial(bundle);

const thr = stab.map(s => s.threshold_body), aucs = stab.map(s => s.auc);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length; const sd = a => Math.sqrt(mean(a.map(x => (x - mean(a)) ** 2)));
const famNeg = Object.fromEntries(Object.entries(negatives).map(([k, v]) => [k, r4(frac(v, r => !r.plausible))]));
const crit = [
  { id: 'C1', text: '>= 90 % of held-out test-species FishShapes specimens score plausible', value: r4(plausibleRate(positives.A1_fishshapes_test)), pass: plausibleRate(positives.A1_fishshapes_test) >= 0.9 },
  { id: 'C2', text: 'all 3 real organisms score plausible with their own lineage excluded', value: r4(plausibleRate(positives.A2_real_organisms_LOO)), pass: plausibleRate(positives.A2_real_organisms_LOO) === 1 },
  { id: 'C3', text: '>= 90 % of ontogeny stages score plausible with their own lineage excluded', value: r4(plausibleRate(positives.A3_ontogeny_stages_LOO)), pass: plausibleRate(positives.A3_ontogeny_stages_LOO) >= 0.9 },
  { id: 'C4', text: '>= 80 % of real lab mutants score plausible', value: r4(plausibleRate(positives.A4_real_mutants)), pass: plausibleRate(positives.A4_real_mutants) >= 0.8 },
  { id: 'C5', text: '>= 90 % of all negatives score implausible, and every negative family >= 80 %', value: { all: r4(frac(Object.values(negatives).flat(), r => !r.plausible)), ...famNeg }, pass: frac(Object.values(negatives).flat(), r => !r.plausible) >= 0.9 && Object.values(famNeg).every(v => v >= 0.8) },
  { id: 'C6', text: 'AUC (all positives vs all negatives) >= 0.90', value: r4(auc(posScores, negScores)), pass: auc(posScores, negScores) >= 0.9 },
  { id: 'C7', text: 'across 5 species-split seeds: AUC range <= 0.05 and body-threshold relative SD <= 10 %', value: { auc_range: r4(Math.max(...aucs) - Math.min(...aucs)), threshold_rel_sd: r4(sd(thr) / mean(thr)) }, pass: Math.max(...aucs) - Math.min(...aucs) <= 0.05 && sd(thr) / mean(thr) <= 0.1 },
  { id: 'C8', text: 'adversarial search finds no clearly-implausible design (pre-registered predicate) that scores plausible', value: { searched: adv.searched, clearly_implausible: adv.clearly_implausible, scored_plausible_anyway: adv.scored_plausible_anyway }, pass: adv.scored_plausible_anyway === 0 },
];
// v1.1.1 resolution criteria (rank_score)
if (SCORER_FOR().rank) {
  const all = [...Object.values(positives).flat(), ...Object.values(negatives).flat()];
  const distinct = new Set(all.map(x => x.rank_score)).size / all.length;
  const rp = Object.values(positives).flat().map(x => x.rank_score), rn = Object.values(negatives).flat().map(x => x.rank_score);
  const a1 = positives.A1_fishshapes_test.filter(x => x.nearest_distance != null);
  const rk = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
  const sp = (x, y) => { const rx = rk(x), ry = rk(y), n = x.length, mx = (n - 1) / 2; let s1 = 0, s2 = 0, s3 = 0; for (let i = 0; i < n; i++) { s1 += (rx[i] - mx) * (ry[i] - mx); s2 += (rx[i] - mx) ** 2; s3 += (ry[i] - mx) ** 2; } return s1 / Math.sqrt(s2 * s3); };
  const rho = sp(a1.map(x => x.rank_score), a1.map(x => x.nearest_distance));
  const v110 = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'scorer-results.v1.1.0.json'), 'utf8')).criteria.find(c => c.id === 'C6').value; } catch { return null; } })();
  crit.push(
    { id: 'R1', text: '>= 90 % of validation rows have a distinct rank_score', value: r4(distinct), pass: distinct >= 0.9 },
    { id: 'R2', text: 'rank_score AUC (all positives vs all negatives) >= the v1.1.0 score AUC', value: { rank_auc: r4(auc(rp, rn)), v110_auc: v110 }, pass: v110 != null && auc(rp, rn) >= v110 },
    { id: 'R3', text: 'among A1 held-out specimens, Spearman(rank_score, nearest-real-neighbour distance) <= -0.5', value: r4(rho), pass: rho <= -0.5 });
}
const res = { prereg_sha256: hash, scorer: SCORER_FOR(), quick: QUICK, ran: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), criteria: crit,
  auc_by_family: Object.fromEntries(Object.entries(negatives).map(([k, v]) => [k, r4(auc(posScores, v.map(x => x.score)))])),
  sensitivity_by_family: Object.fromEntries(Object.entries(positives).map(([k, v]) => [k, r4(plausibleRate(v))])), calibration: calib, stability: stab, adversarial: adv, positives, negatives };
fs.writeFileSync(path.join(DIR, QUICK ? `scorer-results.quick.v${VERSION}.json` : VERSION === '1.0.0' ? 'scorer-results.json' : `scorer-results.v${VERSION}.json`), JSON.stringify(res, null, 1));
for (const c of crit) console.log(c.id, c.pass ? 'PASS' : 'FAIL', JSON.stringify(c.value), '-', c.text);
console.log('seconds', res.seconds);
