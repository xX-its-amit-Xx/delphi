// Sanity checks on a design: phenotype (allometry within the observed range across species, the body's mass fits
// its envelope, organs fit the body, stage consistency) and genotype (from genotype.mjs per-edit checks plus the
// causal-chain caveats in genotype/causal-chains.json). Every check returns
// {id, status: passed | failed | flagged | could-not-run, detail, inputs?, source}.
//   failed  = the check ran and the design is outside what the reference data allow
//   flagged = worth a human look; not counted against the design by the scorer
import { loadReferences, BODY, FEATURE_LABEL, finEnvelope, featuresFromRaw, quantile } from './phenotype.mjs';

// Flight-muscle capacity, derived from the two meshes in which the requested muscle did NOT fit (the mesh builder
// clips it to what fits inside the skin): capacity / (SL^3 * depth/SL * width/SL). tff and ff-zf-chimera manifests,
// derived_from_the_mesh.flight_muscle_volume_realized_m3. Applying it to other bodies is an ASSUMED transfer.
export const FLIGHT_MUSCLE_CAPACITY = {
  values: [
    { design: 'tff', realized_m3: 2.6741441482882703e-6, SL_m: 0.203, depth_SL: 0.17, width_SL: 0.136 },
    { design: 'ff-zf-chimera', realized_m3: 5.606074412905417e-7, SL_m: 0.1209, depth_SL: 0.21175, width_SL: 0.1355 },
  ].map(v => ({ ...v, c: v.realized_m3 / (v.SL_m ** 3 * v.depth_SL * v.width_SL) })),
  muscle_density_kg_m3: 1060, // implied by every manifest: target_m3 = flight_muscle_fraction x mass / 1060
  source: 'dashboard/public/blueprint3d/model/{tff,ff-zf-chimera}-manifest.json derived_from_the_mesh (mesh clip); transfer to other bodies assumed',
};
const capC = () => { const cs = FLIGHT_MUSCLE_CAPACITY.values.map(v => v.c); return { mean: cs.reduce((a, b) => a + b, 0) / cs.length, min: Math.min(...cs), max: Math.max(...cs) }; };

export function flightMuscleFit(raw) {
  const f = raw.flight_muscle_fraction, M = raw.mass_kg, SL = raw.SL_m, d = raw.depth_SL, w = raw.width_SL;
  if (![f, M, SL, d, w].every(x => typeof x === 'number' && x >= 0)) return null;
  if (f === 0) return { fit: 1, fit_range: [1, 1], target_m3: 0, capacity_m3: null };
  const target = (f * M) / FLIGHT_MUSCLE_CAPACITY.muscle_density_kg_m3;
  const c = capC(); const env = SL ** 3 * d * w;
  return { fit: Math.min(1, (c.mean * env) / target), fit_range: [Math.min(1, (c.min * env) / target), Math.min(1, (c.max * env) / target)], target_m3: target, capacity_m3: c.mean * env };
}

const INTERNAL = /^(swim_bladder|gills_|heart|liver|gut|intestine|stomach|kidney|brain|spinal_cord|gonad|spleen|pectoral_muscle_|muscle_|vertebra|ribs_|skull_|cleithrum_|scapula_|coracoid_)/;

/** Phenotype sanity. raw from phenotype.rawFromState; ctx {state, bundle, doc, manifest, containment}. */
export async function phenoSanity(raw, ctx = {}) {
  const R = await loadReferences();
  const checks = [];
  const add = (id, status, detail, extra = {}) => checks.push({ id, status, detail, ...extra });
  const q = featuresFromRaw(raw);
  // 1. allometry: each body feature within the range observed across 16 377 FishShapes specimens
  for (const k of BODY) {
    const x = q.body[k], rg = R.range[k];
    if (x == null) { add(`range:${k}`, 'could-not-run', `${FEATURE_LABEL[k]}: the design has no value`); continue; }
    const st = x >= rg.p005 && x <= rg.p995 ? 'passed' : x >= rg.min && x <= rg.max ? 'flagged' : 'failed';
    add(`range:${k}`, st, `${FEATURE_LABEL[k]} = ${x.toFixed(3)}; FishShapes range ${rg.min.toFixed(3)} to ${rg.max.toFixed(3)} (0.5-99.5 %: ${rg.p005.toFixed(3)} to ${rg.p995.toFixed(3)}; n ${rg.n})`, { source: rg.source });
  }
  // 2. fin features: envelope of the fin references (UNCALIBRATED; flagged, not failed)
  const env = finEnvelope(q.fin, R);
  add('fin_envelope', env.outside.length ? 'flagged' : 'passed', env.outside.length ? `outside the real-reference range: ${env.outside.map(o => `${o.feature} ${o.design} vs [${o.min}, ${o.max}] (excess ${o.excess})`).join('; ')}` : 'every fin feature inside the range of the fin references', { rule: env.rule });
  // 3. mass fits the body envelope: fill = mass / (1000 kg m^-3 * SL * depth * width), against FishShapes
  if (raw.mass_kg > 0 && raw.SL_m > 0 && raw.depth_SL > 0 && raw.width_SL > 0) {
    if (!R._fill) { const xs = R.refs.filter(r => r.id.startsWith('fishshapes:')).map(r => r.raw.mass_kg / (1000 * r.raw.SL_m ** 3 * r.raw.depth_SL * r.raw.width_SL)); R._fill = { min: Math.min(...xs), max: Math.max(...xs), p005: quantile(xs, 0.005), p995: quantile(xs, 0.995), n: xs.length }; }
    const fill = raw.mass_kg / (1000 * raw.SL_m ** 3 * raw.depth_SL * raw.width_SL), F = R._fill;
    const st = fill >= F.p005 && fill <= F.p995 ? 'passed' : fill >= F.min && fill <= F.max ? 'flagged' : 'failed';
    add('mass_fits_body', st, `fill factor mass / (rho_water x SL x depth x width) = ${fill.toFixed(3)}; FishShapes ${F.min.toFixed(3)} to ${F.max.toFixed(3)} (0.5-99.5 %: ${F.p005.toFixed(3)} to ${F.p995.toFixed(3)}; n ${F.n})`, { inputs: { mass_kg: raw.mass_kg, SL_m: raw.SL_m, depth_SL: raw.depth_SL, width_SL: raw.width_SL } });
  } else add('mass_fits_body', 'could-not-run', 'needs mass, SL, depth/SL and width/SL');
  // 4. organs fit the body: flight muscle (analytic capacity from the clipped meshes; the mesh's own fit fraction
  //    when the design is an unedited repository design with a manifest), and partedit containment results if given.
  const fm = flightMuscleFit(raw);
  const mf = ctx.manifestFit;
  if (mf != null) add('organ_fit:flight_muscle', mf >= 0.95 ? 'passed' : 'failed', `mesh: ${(mf * 100).toFixed(1)} % of the requested flight-muscle volume fits inside the skin (manifest derived_from_the_mesh.flight_muscle_fit_fraction)${fm ? `; analytic estimate ${(fm.fit * 100).toFixed(1)} %` : ''}`, { value: mf, source: 'manifest (mesh)' });
  else if (fm) add('organ_fit:flight_muscle', fm.fit >= 0.95 ? 'passed' : 'failed', `analytic: ${(fm.fit * 100).toFixed(1)} % (range ${(fm.fit_range[0] * 100).toFixed(0)}-${(fm.fit_range[1] * 100).toFixed(0)} %) of the requested flight muscle (${raw.flight_muscle_fraction} of body mass) fits, using the capacity per body envelope of the two clipped meshes (an assumed transfer)`, { value: fm.fit, source: FLIGHT_MUSCLE_CAPACITY.source });
  else add('organ_fit:flight_muscle', 'could-not-run', 'needs flight_muscle_fraction, mass, SL, depth and width');
  const grown = Object.entries(ctx.state?.parts || {}).filter(([pid, p]) => INTERNAL.test(pid) && (p.scale ?? 1) > 1.0001).map(([pid, p]) => ({ part: pid, scale: p.scale }));
  if (Array.isArray(ctx.containment) && ctx.containment.length) {
    const refused = ctx.containment.filter(c => c.refused);
    add('organ_fit:containment', refused.length ? 'failed' : 'passed', refused.length ? `partedit refused: ${refused.map(c => `${c.part}: ${c.refused}`).join('; ')}` : `partedit containment passed for ${ctx.containment.length} edited part(s)`, { source: 'dashboard/public/blueprint3d/partedit.js (mesh containment, passed in by the caller)' });
  } else if (grown.length) add('organ_fit:containment', 'could-not-run', `internal part(s) enlarged (${grown.map(g => `${g.part} x${g.scale}`).join(', ')}): containment needs the mesh (partedit.js in the browser); pass its results as containment [{part, refused}]`);
  else add('organ_fit:containment', 'passed', 'no internal part is enlarged by an edit');
  // 5. stage consistency: SL against the growth track at the same age; swim bladder against the inflation milestone
  const st = ctx.state, b = ctx.bundle;
  if (st && b) {
    const lv = st._meta?.leaves || {}; const dom = Object.entries(lv).sort((x, y) => y[1] - x[1])[0]?.[0];
    const track = dom && b.organisms[dom]?.track ? b.tracks[b.organisms[dom].track] : null;
    const age = st.ageDays?.value;
    if (track && typeof age === 'number') {
      const row = track.dense.reduce((best, r) => (Math.abs(r.ageDays - age) < Math.abs(best.ageDays - age) ? r : best), track.dense[0]);
      const ratio = raw.SL_m / row.SL_m;
      add('stage:size', ratio >= 0.5 && ratio <= 2 ? 'passed' : 'failed', `SL ${raw.SL_m?.toPrecision(3)} m at ${age} d (${st.stage?.value}) vs the ${dom} growth track ${row.SL_m.toPrecision(3)} m at ${row.ageDays} d: ratio ${ratio.toFixed(2)} (rule: 0.5-2)`, { source: track.source });
      const sb = st.has_swimbladder?.value;
      if (typeof sb === 'boolean') add('stage:swim_bladder', sb === row.swimbladder ? 'passed' : (!sb ? 'flagged' : 'failed'), `swim bladder ${sb ? 'present' : 'absent'}; the growth track has it ${row.swimbladder ? 'inflated' : 'not yet inflated'} at ${row.ageDays} d${!sb && row.swimbladder ? ' (an edit removed it: possible, flagged)' : ''}`);
    } else add('stage:size', 'could-not-run', 'no growth track for the dominant parent');
  } else add('stage:size', 'could-not-run', 'needs a resolved STATE (specimen records have no stage)');
  // 6. counts with no reference data across species: reported, never scored
  const P = st?._meta?.parameters || {};
  const counts = ['pectoral_ray_count', 'pelvic_ray_count', 'dorsal_ray_count', 'anal_ray_count', 'caudal_ray_count', 'vertebra_count'].filter(k => P[k]?.edited);
  if (counts.length) add('uncovered:counts', 'flagged', `edited counts with no cross-species reference in this validator: ${counts.map(k => `${k}=${P[k].value}`).join(', ')} (nothing checks them)`);
  return checks;
}

/** Genotype sanity: the per-edit checks from genotype.mjs plus causal-chain caveats. */
export function genoSanity(genoResult) {
  const out = [];
  for (const e of genoResult.edits) {
    for (const c of e.checks) out.push({ id: `${e.edit.gene}:${c.id}`, gene: e.edit.gene, edit: e.edit.raw, status: c.status, detail: c.detail });
    const cc = e.annotations?.causal_chain;
    if (cc) out.push({ id: `${e.edit.gene}:causal_chain_caveat`, gene: e.edit.gene, edit: e.edit.raw, status: 'flagged', detail: `causal chain strength ${cc.chain_strength} (weakest grade ${cc.weakest_grade}); weakest link: ${String(cc.weakest_link || '').slice(0, 300)}`, source: 'genotype/causal-chains.json' });
    for (const x of e.annotations?.cross_gene_caveats || []) out.push({ id: `${e.edit.gene}:cross_gene`, gene: e.edit.gene, status: 'flagged', detail: `${x.claim.slice(0, 240)} [${x.evidence_grade}]`, source: 'genotype/causal-chains.json cross_gene' });
    if (e.annotations?.flying_fish_orthologue?.NOT_AN_ORTHOLOGUE_CALL) out.push({ id: `${e.edit.gene}:orthology`, gene: e.edit.gene, status: 'flagged', detail: e.annotations.flying_fish_orthologue.NOT_AN_ORTHOLOGUE_CALL.slice(0, 240), source: 'genotype/sequence-layer.json' });
  }
  return out;
}
