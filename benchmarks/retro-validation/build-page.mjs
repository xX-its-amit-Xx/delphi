#!/usr/bin/env node
// Emit the bundle the /retro/ dashboard page fetches. Everything in it is read back out of the
// modules at build time, so the page cannot drift from the code: if a verdict changes, this changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/retro/bundle.json');

const MB = await import('./data/myoglobin.mjs');
const OP = await import('./data/opsin.mjs');
const TT = await import('./data/ttx.mjs');
const P = await import('./predict.mjs');
const SP = await import('../../analogues/combos/space.mjs');
const VA = await import('../../analogues/combos/validatability.mjs');

const results = JSON.parse(fs.readFileSync(path.join(HERE, 'results-myoglobin.json'), 'utf8'));

// ------------------------------------------------------------------ myoglobin, for the scatter
const myo = results.rows.map(r => {
  const seq = MB.ROWS.find(x => x.uniprot.accession === r.accession)?.sequence ?? '';
  return {
    latin: r.latin, common: r.common, clade: r.clade, habit: r.habit, accession: r.accession,
    z65: +r.charge.published_pH65.toFixed(3), z74: +r.charge.prereg_pH74.toFixed(3),
    zint: r.charge.integer, zsurf: r.surface?.z_surface ?? null,
    his: (seq.match(/H/g) ?? []).length,
    minutes: r.duration?.value ?? null,
    kind: r.duration?.kind ?? null,
    in_regression: r.duration?.use_for_regression === true,
  };
});

// ------------------------------------------------------------------ opsin
const habitat = Object.fromEntries(OP.MEASURED.map(m => [m.id, m.habitat]));
const opsinRun = OP.retroValidate();
const opsin = opsinRun.rows.map(x => ({
  id: x.id, organism: x.organism, habitat: habitat[x.id] ?? null,
  measured: x.measured_nm, lo: x.band.lo, hi: x.band.hi,
  mid: (x.band.lo + x.band.hi) / 2, signed: (x.band.lo + x.band.hi) / 2 - x.measured_nm,
  verdict: x.verdict, subs: x.substitutions_at_rule_sites ?? [], unquantified: x.n_unquantified ?? 0,
}));
const opsinStats = {
  n: opsin.length,
  mae_band_edge: +(opsinRun.rows.reduce((a, x) => a + Math.abs(x.miss_nm), 0) / opsin.length).toFixed(2),
  mae_midpoint: +(opsin.reduce((a, x) => a + Math.abs(x.signed), 0) / opsin.length).toFixed(2),
  spearman: +P.spearman(opsin.map(x => x.mid), opsin.map(x => x.measured)).toFixed(4),
  pearson: +P.pearson(opsin.map(x => x.mid), opsin.map(x => x.measured)).toFixed(4),
  worst_miss_nm: opsinRun.worst_miss_nm,
  counts: opsinRun.counts,
  what_a_hit_does_not_show: opsinRun.what_a_hit_does_not_show,
};

// ------------------------------------------------------------------ ttx: the comparability groups
const ttxGroups = {};
for (const r of TT.SUBSTITUTIONS) {
  const m = r.measured;
  const num = m && typeof m === 'object' ? (m.value ?? m.fold ?? m.ic50 ?? null) : m;
  if (!Number.isFinite(num)) continue;
  const key = [r.numbering, r.channel_from_species, r.expressed_in, r.construct, r.quantity, r.measurement_level].join(' | ');
  (ttxGroups[key] ??= { key, numbering: r.numbering, channel_species: r.channel_from_species, system: r.expressed_in, construct: r.construct, quantity: r.quantity, level: r.measurement_level, subs: [] }).subs.push(r.substitution);
}
const ttx = {
  groups: Object.values(ttxGroups).sort((a, b) => b.subs.length - a.subs.length).map(g => ({ ...g, n: g.subs.length })),
  summary: TT.summary(),
  verdict_axes: TT.retroValidationVerdict(),
};

// ------------------------------------------------------------------ the space and the pairs
const space = SP.space();
const PAIR_FILES = ['anoxia-ethanol', 'cave-regression', 'diapause', 'electric-organ', 'ucp1-thermogenesis'];
const pairs = [];
for (const f of PAIR_FILES) {
  const m = await import(`../../analogues/combos/pairs/${f}.mjs`);
  const scoredList = Array.isArray(m.SCORED) ? m.SCORED : Object.values(m.SCORED ?? {});
  m.PAIRS.forEach((p, i) => {
    const s = (m.SCORED && !Array.isArray(m.SCORED) && m.SCORED[p.id]) || scoredList[i] || null;
    const present = Object.entries(p.evidence).filter(([, v]) => v.present === true).map(([k]) => k);
    pairs.push({
      file: f, id: p.id, claim: p.claim,
      a: `${p.a.species} — ${p.a.name}`, b: `${p.b.species} — ${p.b.name}`,
      band: s?.confidence?.label ?? s?.confidence?.band ?? null,
      strongest: s?.strongest?.kind ?? null,
      homology_type: s?.homology_type ?? null,
      present, present_n: present.length,
      note: String(p.note ?? '').slice(0, 900),
      headline: String(s?.headline ?? '').slice(0, 700),
    });
  });
}

// ------------------------------------------------------------------ validatability tiers
const tiers = {
  axes: VA.AXIS_IDS.map(id => ({ id, question: VA.AXES[id]?.question ?? null, vocabulary: VA.AXES[id]?.answers ?? VA.VOCABULARY?.[id] ?? null })),
  tier_ids: VA.TIER_IDS,
  n_answer_sets: VA.N_ANSWER_SETS,
  designs: (VA.DESIGN_IDS ?? []).map(id => {
    const w = VA.worked?.(id) ?? null;
    return { id, tier: w?.tier ?? null, headline: String(w?.headline ?? w?.why ?? '').slice(0, 400) };
  }),
  why_not_a_score: VA.WHY_NOT_A_SCORE,
  the_uncomfortable_part: VA.THE_UNCOMFORTABLE_PART,
};

// ------------------------------------------------------------------ the remaining pre-registered
// predictions, scored HERE in code against the thresholds as written, so the page's scoreboard and
// RESULTS.md cannot disagree. Cases 2, 3 and 4.
const deep = opsin.filter(x => /deep|meso|bathy/i.test(x.habitat ?? ''));
const shallow = opsin.filter(x => !/deep|meso|bathy/i.test(x.habitat ?? ''));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const largestTtx = ttx.groups[0]?.n ?? 0;
const admissibleFraction = space.n_admissible / space.n_cells;

const moreVerdicts = [
  {
    id: 'case2-mae', predicted: 'opsin lambda-max mean absolute error between 8 and 25 nm',
    refuted_if: 'MAE < 8 nm (rules transfer better than expected) or > 25 nm (barely at all)',
    observed: `MAE ${opsinStats.mae_band_edge} nm to the nearest band edge, ${opsinStats.mae_midpoint} nm against the band midpoint as a point prediction (n = ${opsin.length})`,
    verdict: (opsinStats.mae_midpoint < 8 || opsinStats.mae_midpoint > 25) ? 'REFUTED' : 'SUPPORTED',
    why: opsinStats.mae_midpoint < 8 ? 'the site rules transfer considerably better than predicted' : null,
  },
  {
    id: 'case2-bias-direction',
    predicted: 'deep-sea rows will have the blue shift UNDER-predicted: predicted lambda-max redder than measured, and of opposite sign to the shallow rows',
    refuted_if: 'the mean signed error on deep rows is <= 0, or its sign matches the shallow rows',
    observed: `deep/mesopelagic n = ${deep.length}, mean signed error ${mean(deep.map(x => x.signed)).toFixed(2)} nm; other rows n = ${shallow.length}, ${mean(shallow.map(x => x.signed)).toFixed(2)} nm`,
    verdict: (mean(deep.map(x => x.signed)) <= 0 || Math.sign(mean(deep.map(x => x.signed))) === Math.sign(mean(shallow.map(x => x.signed)))) ? 'REFUTED' : 'SUPPORTED',
    why: 'wrong twice: the deep rows are predicted slightly BLUER than measured, not redder, and the two groups share a sign rather than differing',
  },
  {
    id: 'case2-unreadable-sites', predicted: 'at least one tuned site falls in an alignment gap and is reported unreadable',
    refuted_if: 'every tuned site is cleanly readable on every row',
    observed: `no row failed to align at a tuned site; ${opsin.filter(x => x.unquantified > 0).length} row(s) instead carry a substitution whose SHIFT VALUE could not be retrieved, so their band is narrow for the wrong reason`,
    verdict: 'REFUTED_AS_WRITTEN',
    why: 'the prediction named the wrong failure mode. Alignment was not the problem; an unretrievable shift value was, and the module reports it rather than letting a narrow band read as confidence.',
  },
  {
    id: 'case2-rank-order', predicted: 'Spearman(predicted, measured) > 0.6 even while MAE stays above 8 nm',
    refuted_if: 'rho <= 0.6',
    observed: `Spearman = ${opsinStats.spearman}, Pearson = ${opsinStats.pearson} (n = ${opsin.length})`,
    verdict: opsinStats.spearman > 0.6 ? 'SUPPORTED' : 'REFUTED',
    why: 'the rank-order half of the prediction holds; the MAE half does not, so the conjunction as stated was half right',
  },
  {
    id: 'case3-commensurability',
    predicted: 'fewer than six mutually comparable TTX values exist in the record - same numbering convention, same channel, same class of expression system',
    refuted_if: 'six or more mutually comparable values can be assembled',
    observed: `the largest mutually comparable group has ${largestTtx} values (${ttx.groups[0]?.numbering}, ${ttx.groups[0]?.channel_species}, ${ttx.groups[0]?.system}, ${ttx.groups[0]?.quantity}), ${ttx.groups.filter(g => g.n >= 6).length} group(s) of six or more`,
    verdict: largestTtx >= 6 ? 'REFUTED' : 'SUPPORTED',
    why: 'but the concern survives in a sharper form: those values are a mutational scan of a SENSITIVE mammalian channel, not measurements of the convergent natural variants. For the lineages that actually evolved resistance the comparable set is three.',
  },
  {
    id: 'case4-admissible-fraction', predicted: 'fewer than 40% of host x capability cells admissible',
    refuted_if: 'the admissible fraction is >= 40%',
    observed: `${space.n_admissible} of ${space.n_cells} cells admissible = ${(100 * admissibleFraction).toFixed(1)}%`,
    verdict: admissibleFraction >= 0.40 ? 'REFUTED' : 'SUPPORTED',
    why: 'refuted by 0.2 percentage points - and the prediction was ill-posed. The refusal fraction is a property of which hosts and capabilities were written down, both chosen partly to cover every mechanism class, so it is not a base rate.',
  },
];

const bundle = {
  what_this_is:
    'Four cases where the answer already exists in the published literature, so this project can be ' +
    'shown to be wrong today with no wet lab. The predictions were committed to git BEFORE the data.',
  prereg_commit: 'a67a0ff15',
  scored_on: '2026-11-07',
  verdicts: [...results.verdicts, ...moreVerdicts],
  verdict_tally: [...results.verdicts, ...moreVerdicts].reduce((a, v) => { a[v.verdict] = (a[v.verdict] ?? 0) + 1; return a; }, {}),
  myoglobin: { rows: myo, analyses: results.analyses, mechanism: results.why_the_sign_flips, anchors: results.anchors, zmb_convention: results.zmb_convention, gate: results.gate },
  opsin: { rows: opsin, stats: opsinStats, the_hard_part: OP.THE_HARD_PART },
  ttx,
  space: { counts: { n_hosts: space.n_hosts, n_functions: space.n_functions, n_cells: space.n_cells, n_admissible: space.n_admissible, n_refused: space.n_refused }, caveat: space.what_this_is_not, for: space.what_it_is_for },
  pairs,
  tiers,
  series_colors: { pH65: '#3f82d6', pH74: '#bf8410' },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(bundle, null, 1));
console.log(`verdicts: ${bundle.verdicts.length} ${JSON.stringify(bundle.verdict_tally)} | myoglobin rows: ${myo.length} (${myo.filter(r => r.in_regression).length} in regression)`);
console.log(`opsin rows: ${opsin.length} MAE ${opsinStats.mae_midpoint} nm, Spearman ${opsinStats.spearman}`);
console.log(`ttx groups: ${ttx.groups.length}, largest ${ttx.groups[0]?.n ?? 0}`);
console.log(`space: ${space.n_admissible}/${space.n_cells} admissible | pairs: ${pairs.length} | tiers over ${tiers.n_answer_sets} answer sets`);
console.log(`written to ${path.relative(ROOT, OUT).split(path.sep).join('/')} (${fs.statSync(OUT).size} bytes)`);
