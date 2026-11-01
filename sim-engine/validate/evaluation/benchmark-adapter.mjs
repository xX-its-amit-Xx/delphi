// Turns the pre-registered benchmark (sim-engine/validate/benchmark/, built by another agent) into the evaluator's
// item shape. Protocol (BENCHMARK-PREREGISTRATION.md section 1): the scorer sees ONLY params (plus doc where present;
// the scorer has no lean_spec input, which is reported). No taxon, label or any other field is passed.
//   { id, y: 1 positive | 0 negative | null unlabelled, type, design (first argument of designScore), taxon (for the
//     audit and the family bootstrap only; never passed), self_ref_ids, organism_group, bench_exclude: {split: [...]},
//     audit_sets, scorer_readable, ... }
import fs from 'node:fs';
import path from 'node:path';
const VAL = path.resolve(import.meta.dirname, '..');
const BENCH = path.join(VAL, 'benchmark');

// Benchmark params -> the scorer's specimen record (field names from phenotype.mjs featuresFromRaw / rawFromState).
// Every other param is NOT read by the scorer; that is reported, not imputed. fork_length_m is not converted to SL.
export const PARAM_TO_RAW = { standard_length_m: 'SL_m', body_mass_kg: 'mass_kg', body_depth_over_SL: 'depth_SL', body_width_over_SL: 'width_SL', peduncle_depth_frac: 'ped_depth_frac', peduncle_width_frac: 'ped_width_frac',
  pectoral_len_over_SL: 'pectoral_len_SL', pectoral_area_over_SL2: 'pectoral_area_SL2', pectoral_span_over_SL: 'pectoral_span_SL', pelvic_len_over_SL: 'pelvic_len_SL', dorsal_height_over_SL: 'dorsal_h_SL', anal_height_over_SL: 'anal_h_SL',
  caudal_upper_lobe_over_SL: 'caudal_upper_SL', caudal_lower_lobe_over_SL: 'caudal_lower_SL' };
export const SCORER_READS = Object.keys(PARAM_TO_RAW);
const BODY_PARAMS = ['standard_length_m', 'body_mass_kg', 'body_depth_over_SL', 'body_width_over_SL', 'peduncle_depth_frac', 'peduncle_width_frac'];
const readable = p => BODY_PARAMS.filter(k => p[k] != null).length >= 4 || p.pectoral_len_over_SL != null;
const readJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

export async function loadBenchmark() {
  const devF = path.join(BENCH, 'dev', 'items.jsonl'), hoF = path.join(BENCH, 'heldout', 'items.jsonl');
  if (!fs.existsSync(devF) || !fs.existsSync(hoF)) throw new Error('benchmark files missing: ' + devF);
  const fsj = JSON.parse(fs.readFileSync(path.join(VAL, 'data', 'fishshapes-features.json'), 'utf8'));
  const lot2ref = new Map(); for (const r of fsj.rows) lot2ref.set(String(r[0]), `fishshapes:${r[0]}:${r[1]}`);
  const unmapped = new Set();
  const refIdsFor = specs => { const out = []; for (const s of specs || []) { let m;
    if ((m = s.match(/^fishshapes-lot:(.+)$/))) { const id = lot2ref.get(m[1]); if (id) out.push(id); else unmapped.add(s); }
    else if (/^(zf-wt-baseline|zf-mutant|ontogeny:zebrafish)/.test(s)) out.push('organism:zebrafish');
    else if (/^(ontogeny:flying|parkchoi:)/.test(s)) out.push('organism:flying-fish');
  } return [...new Set(out)]; };
  const conv = (d, partition) => {
    const isNeg = d.label === 'negative', isPos = d.label === 'positive';
    const t = d.taxon || {}, base = t.base_taxon || {};
    const tax = { species: t.species || base.species || null, genus: t.genus || base.genus || null, family: t.family || base.family || null, family_alt: t.family_alt || null, order: t.order || base.order || null };
    let design;
    if (d.doc) design = d.doc;
    else { const raw = {}; for (const [k, v] of Object.entries(d.params || {})) if (PARAM_TO_RAW[k] && typeof v === 'number') raw[PARAM_TO_RAW[k]] = v; design = { specimen: raw }; }
    const ex = d.exclusion || {};
    const refs = refIdsFor(ex.specimen);
    const orgGroups = refs.filter(r => r.startsWith('organism:'));
    const spEx = (ex.species || []).map(s => `species:${s.replace(/ /g, '_')}`), famEx = (ex.family || []).map(f => `family:${f}`);
    const donor0 = (d.donors || [])[0] || '';
    const src = isPos ? (d.subset === 'fishshapes_specimen' ? 'fishshapes' : d.subset === 'fishbase_picture' ? 'fishbase' : 'curated') : (/^fs-/.test(donor0) ? 'fishshapes' : /^fb-/.test(donor0) ? 'fishbase' : 'synthetic');
    const altered = d.trait_donor ? Object.keys(d.trait_donor).filter(k => d.trait_donor[k] !== donor0) : (d.extrapolation ? [d.extrapolation.trait] : null);
    return {
      id: d.id, label: d.description || d.note || d.id, y: isPos ? 1 : isNeg ? 0 : null,
      type: isPos ? `real: ${d.subset}` : isNeg ? `negative: ${d.neg_type}` : 'unlabelled: own model', subset: d.subset || d.neg_type || 'own', source_ds: src,
      difficulty: d.difficulty || null, partition, design, taxon: tax,
      self_ref_ids: refs.filter(r => !r.startsWith('organism:')), organism_group: orgGroups[0] || null,
      bench_exclude: { specimen: refs, species: [...refs, ...spEx], family: [...refs, ...spEx, ...famEx] },
      audit_sets: { species: (ex.species || []).map(s => s.toLowerCase()), family: (ex.family || []).map(s => s.toLowerCase()) },
      scorer_readable: !!d.doc || readable(d.params || {}),
      altered_traits_read_by_scorer: altered == null ? null : altered.filter(k => PARAM_TO_RAW[k]).length,
      paired_baseline: d.paired_baseline || null, has_lean_spec: !!d.lean_spec,
    };
  };
  const dev = readJsonl(devF).map(d => conv(d, 'dev')), ho = readJsonl(hoF).map(d => conv(d, 'heldout'));
  const ownF = path.join(BENCH, 'dev', 'own-models.jsonl');
  const own = fs.existsSync(ownF) ? readJsonl(ownF).map(d => conv(d, 'own')) : [];
  const devL = dev.filter(i => i.y != null), hoL = ho.filter(i => i.y != null);
  const unl = [...dev.filter(i => i.y == null), ...ho.filter(i => i.y == null), ...own];
  const controls = JSON.parse(fs.readFileSync(path.join(BENCH, 'build', 'lean-controls.json'), 'utf8')).controls || [];
  return {
    source: 'sim-engine/validate/benchmark v1 (pre-registered; built by another agent)',
    devLabelled: devL, heldoutLabelled: hoL, unlabelled: unl, controls,
    notes: [
      `dev labelled ${devL.length}; held-out labelled ${hoL.length}; unlabelled own models ${unl.length}.`,
      `FishShapes lots named in exclusion lists with no row in the scorer's reference data (nothing to exclude): ${unmapped.size}.`,
      `The scorer reads these benchmark params: ${SCORER_READS.join(', ')}. Every other param (eye, head, jaw, mouth, pre-fin distances, caudal-fin shape, airspeed, CLmax, glide claims, organ volumes, fork length) is invisible to it.`,
      'The scorer has no lean_spec input, so items whose implausibility lives only in lean_spec (flight claims) are scored on params alone.',
      'Genus-out: the scorer\'s leave-out matcher (phenotype.mjs excludeMatcher) has no genus key, so per splits.json that split is NOT RUN.',
    ],
  };
}
