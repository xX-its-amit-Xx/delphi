// Try to BREAK the scorer: search for designs that score >= the plausible cut although a biologist (or plain geometry)
// rules them out. Two searches, both seeded:
//  A. specimen space (the 7 numbers the phenotype block reads): random search then hill-climbing, restricted to
//     designs that violate a HARD constraint the evaluator fixed before running:
//       H1 fill factor mass / (1000 kg/m3 x SL x depth x width) > 1.1  (denser than a solid water-density box that
//          encloses the fish: needs tissue density > 1100 kg/m3 even if the fish filled its bounding box)
//       H2 fill factor < 0.05 (the fish occupies < 5 % of its bounding box at water density: a balloon/kite)
//       H3 peduncle depth > 1.05 x maximum body depth, or peduncle width > 1.05 x maximum width (the minimum of a
//          profile exceeding its maximum: contradiction by definition)
//       H4 pectoral fin longer than 1.5 SL on a fish heavier than 5 kg
//  B. organism-document space: edits to quantities the scorer does not read (gills, Hb P50, ray/vertebra counts,
//     density, red muscle, head length), judged by the same predicate as SCORER-PREREGISTRATION.md C8, to confirm or
//     refute the scorer agent's own C8 count independently.
import { mulberry32, r4 } from './stats.mjs';
import { loadBundle } from '../../lib/data-node.mjs';
import * as O from '../../lib/organism.mjs';

const lu = (rnd, lo, hi) => Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo)));
export function hardViolations(x) {
  const why = [];
  if (x.SL_m && x.mass_kg && x.depth_SL && x.width_SL) {
    const fill = x.mass_kg / (1000 * x.SL_m ** 3 * x.depth_SL * x.width_SL);
    if (fill > 1.1) why.push(`H1 fill factor ${fill.toFixed(2)} > 1.1 (denser than a water-density box enclosing it)`);
    if (fill < 0.05) why.push(`H2 fill factor ${fill.toFixed(3)} < 0.05`);
  }
  if (x.ped_depth_frac != null && x.ped_depth_frac > 1.05) why.push(`H3 peduncle depth ${x.ped_depth_frac.toFixed(2)} x max body depth`);
  if (x.ped_width_frac != null && x.ped_width_frac > 1.05) why.push(`H3 peduncle width ${x.ped_width_frac.toFixed(2)} x max body width`);
  if (x.pectoral_len_SL != null && x.pectoral_len_SL > 1.5 && x.mass_kg > 5) why.push(`H4 pectoral fin ${x.pectoral_len_SL.toFixed(2)} SL on a ${x.mass_kg.toFixed(1)} kg fish`);
  return why;
}
function sample(rnd) {
  return { SL_m: lu(rnd, 0.01, 2), mass_kg: null, K: lu(rnd, 1, 100), depth_SL: lu(rnd, 0.05, 0.8), width_SL: lu(rnd, 0.03, 0.4), ped_depth_frac: lu(rnd, 0.05, 2), ped_width_frac: lu(rnd, 0.05, 2), pectoral_len_SL: rnd() < 0.5 ? lu(rnd, 0.05, 2) : null };
}
const toRaw = x => { const r = { SL_m: x.SL_m, mass_kg: x.K * x.SL_m ** 3, depth_SL: x.depth_SL, width_SL: x.width_SL, ped_depth_frac: x.ped_depth_frac, ped_width_frac: x.ped_width_frac }; if (x.pectoral_len_SL != null) r.pectoral_len_SL = x.pectoral_len_SL; return r; };
function jitter(rnd, x, s) { const y = { ...x }; for (const k of ['SL_m', 'K', 'depth_SL', 'width_SL', 'ped_depth_frac', 'ped_width_frac', 'pectoral_len_SL']) if (y[k] != null) y[k] *= Math.exp((rnd() - 0.5) * 2 * s); return y; }

// SCORER-PREREGISTRATION.md C8 predicate, re-implemented from the text (not imported).
const ADV_EDITS = [
  ['vertebra_count', 'scale', [0.2, 5]], ['pectoral_ray_count', 'scale', [0.2, 5]], ['caudal_ray_count', 'scale', [0.2, 5]], ['dorsal_ray_count', 'scale', [0.2, 5]],
  ['gill_area_m2', 'scale', [0.02, 3]], ['hb_P50_kPa', 'scale', [0.05, 20]], ['red_muscle_fraction', 'set', [0.01, 0.99]], ['body_density_kg_m3', 'set', [500, 2000]], ['head_fraction_SL', 'scale', [0.3, 3]],
];
function c8(e) {
  const f = e.op === 'scale' ? e.value : null;
  if (/(_ray_count|vertebra_count)$/.test(e.param) && (f >= 3 || f <= 1 / 3)) return `${e.param} x${f.toFixed(2)}`;
  if (e.param === 'gill_area_m2' && f <= 0.1) return `gill area x${f.toFixed(3)}`;
  if (e.param === 'hb_P50_kPa' && (f >= 10 || f <= 0.1)) return `Hb P50 x${f.toFixed(2)}`;
  if (e.param === 'red_muscle_fraction' && e.value >= 0.9) return `red muscle ${e.value.toFixed(2)}`;
  if (e.param === 'body_density_kg_m3' && (e.value < 800 || e.value > 1500)) return `density ${e.value.toFixed(0)} kg/m3`;
  if (e.param === 'head_fraction_SL' && (f >= 2.5 || f <= 0.4)) return `head x${f.toFixed(2)}`;
  return null;
}

export async function run({ designScore, quick, log }) {
  // ---- A. specimen space
  const rnd = mulberry32(424242);
  const N = quick ? 150 : 1500;
  const tried = []; let nViol = 0, nViolPlaus = 0;
  const score = async x => { const raw = toRaw(x); const r = await designScore({ specimen: raw, label: 'adversarial' }, { network: false }); return { x, raw, score: r.score, comp: Object.fromEntries(Object.entries(r.components).map(([k, c]) => [k, c?.ran ? r4(c.value) : null])), nearest: r.verdict?.closest_real_relative?.name, d: r.verdict?.closest_real_relative?.distance, failed_checks: r.verdict?.failed || [] }; };
  for (let i = 0; i < N; i++) {
    const x = sample(rnd); const why = hardViolations(toRaw(x)); if (!why.length) continue;
    const s = await score(x); nViol++; if (s.score >= 0.5) nViolPlaus++; tried.push({ ...s, why });
  }
  tried.sort((a, b) => b.score - a.score);
  // hill-climb from the top 5, staying inside the violating region
  const climbed = [];
  for (const start of tried.slice(0, 5)) {
    let cur = start;
    for (let it = 0; it < (quick ? 15 : 60); it++) {
      const y = jitter(rnd, cur.x, 0.15); const why = hardViolations(toRaw(y)); if (!why.length) continue;
      const s = await score(y); if (s.score > cur.score || (s.score === cur.score && why.length > cur.why.length)) cur = { ...s, why };
    }
    climbed.push(cur);
  }
  const allA = [...tried, ...climbed].sort((a, b) => b.score - a.score || b.why.length - a.why.length);
  const byRule = {}; for (const t of tried) for (const w of t.why) { const k = w.slice(0, 2); (byRule[k] ||= { n: 0, plausible: 0 }); byRule[k].n++; if (t.score >= 0.5) byRule[k].plausible++; }
  log(`adversarial A: ${nViolPlaus}/${nViol} hard-violating specimens score >= 0.5; best ${allA[0]?.score}`);

  // ---- B. organism-document space (C8 replication)
  const bundle = await loadBundle();
  const r2 = mulberry32(20261200 + 1);
  const NB = quick ? 30 : 150; const docs = []; let bImpl = 0, bImplPlaus = 0;
  for (let i = 0; i < NB; i++) {
    const base = r2() < 0.5 ? 'zebrafish-adult' : 'flying-fish';
    const n = 1 + Math.floor(r2() * 3), edits = [];
    for (let j = 0; j < n; j++) { const [param, op, [lo, hi]] = ADV_EDITS[Math.floor(r2() * ADV_EDITS.length)]; if (edits.some(e => e.param === param)) continue; edits.push({ param, op, value: op === 'scale' ? lu(r2, lo, hi) : lo + r2() * (hi - lo) }); }
    let d = { ...O.docFor(bundle, base), id: `adv-${i}` };
    try { for (const e of edits) d = O.appendEdit(bundle, d, { author: 'agent:evaluator', reason: 'adversarial search (independent evaluation)', target: { level: 'body' }, param: e.param, op: e.op, value: e.value }); } catch (e) { continue; }
    const why = edits.map(c8).filter(Boolean);
    let r; try { r = await designScore(d, { network: false }); } catch (e) { continue; }
    const row = { base, edits: edits.map(e => `${e.param} ${e.op} ${e.value.toPrecision(3)}`), why, score: r4(r.score), comp: Object.fromEntries(Object.entries(r.components).map(([k, c]) => [k, c?.ran ? r4(c.value) : null])) };
    docs.push(row); if (why.length) { bImpl++; if (r.score >= 0.5) bImplPlaus++; }
  }
  docs.sort((a, b) => (b.why.length > 0) - (a.why.length > 0) || b.score - a.score);
  log(`adversarial B: ${bImplPlaus}/${bImpl} clearly-implausible documents score >= 0.5`);
  const best = allA[0];
  return {
    headline: { specimen_space: `${nViolPlaus}/${nViol}`, document_space_C8: `${bImplPlaus}/${bImpl}`, best_attack_score: best?.score },
    specimen_space: { searched: N, hard_violating_scored: nViol, scored_plausible: nViolPlaus, frac_plausible: r4(nViolPlaus / nViol), by_rule: byRule,
      best: allA.slice(0, 10).map(a => ({ score: a.score, why: a.why, raw: Object.fromEntries(Object.entries(a.raw).map(([k, v]) => [k, +(+v).toPrecision(3)])), comp: a.comp, nearest: a.nearest, d: a.d, sanity_checks_failed_but_unscored: a.failed_checks })),
      scores: tried.map(t => r4(t.score)) },
    document_space: { searched: docs.length, clearly_implausible: bImpl, scored_plausible: bImplPlaus, frac_plausible: r4(bImplPlaus / bImpl), examples: docs.slice(0, 12) },
  };
}
