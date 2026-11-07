#!/usr/bin/env node
// run-myoglobin.mjs - score Case 1 of PREREGISTRATION.md against the sourced record.
//
//   node benchmarks/retro-validation/run-myoglobin.mjs [--json]
//
// Case 1 asks whether myoglobin net charge, computed from sequence by code in this repo, recovers the
// published relationship with maximum dive duration in mammals. The predictions and their refutation
// thresholds were committed BEFORE the data module existed (commit a67a0ff15).
//
// ============================== TWO THINGS WENT WRONG IN THE PRE-REGISTRATION ==============================
//
// 1. THE QUANTITY WAS MIS-SPECIFIED FROM ITS NAME. The pre-registration treats Z_Mb as a SURFACE charge
//    and says so repeatedly, reasoning that "surface means structure" and that a sequence-only charge
//    must therefore be a weaker proxy. The methods text says otherwise. Quoted in
//    data/myoglobin.mjs -> predict.mjs ZMB_CONVENTION, retrieved from a full-text methods section:
//    Z_Mb is "the sum of the charge of ALL ionizable groups in myoglobin at pH = 6.5". Not a
//    solvent-exposed subset. The structure enters only through site-specific ionisation constants.
//    So the published quantity is a sequence-level sum at pH 6.5, and the pre-registration's pH 7.4
//    is not the published convention either.
//    This file therefore reports THREE variants and names which one is the published convention:
//      (a) pH 6.5, all ionisable groups          - the published convention
//      (b) pH 7.4, all ionisable groups          - what the pre-registration committed to
//      (c) pH-independent integer charge over SOLVENT-EXPOSED residues only - what the name implies,
//          computed from structures, and reported because it was already computed. It answers a
//          different question: does restricting to the exposed subset change the ranking?
//    The pre-registered thresholds are scored against (b), because that is what was pre-registered.
//    Scoring against (a) and calling it the pre-registered result would be moving the goalposts, so
//    (a) is reported as the CORRECTED analysis, separately and explicitly.
//
// 2. THE PRE-REGISTERED SAMPLE SIZE CANNOT BE REACHED. Case 1 says "at n >= 12". The sourced record
//    yields 9 rows whose dive duration is a species maximum (the homogeneous quantity), and 11 if two
//    single-study observed maxima are mixed in. Neither reaches 12. The predictions that depend on n
//    are therefore reported as COULD_NOT_BE_TESTED_AS_WRITTEN with the underpowered result shown, not
//    quietly scored at a smaller n.
//
// Nothing here touches the network. Structures, if used, come from a local cache populated by
// fetch-structures.mjs; if the cache is absent, variant (c) is reported as unavailable rather than
// silently skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MB from './data/myoglobin.mjs';
import * as P from './predict.mjs';
import * as S from './structure.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CACHE = process.env.DELPHI_STRUCT_CACHE || 'C:/Temp/delphi-struct-cache';
const JSON_ONLY = process.argv.includes('--json');
const say = (...a) => { if (!JSON_ONLY) console.log(...a); };

// ---------------------------------------------------------------- 1. the gate, before any arithmetic
const gated = MB.ROWS.map(r => ({ row: r, gate: S.sequenceIsUsable(r.sequence) }));
const usable = gated.filter(g => g.gate.usable);
const refused = gated.filter(g => !g.gate.usable);

say(`\n${MB.ROWS.length} rows in the data module; ${usable.length} pass the sequence gate, ${refused.length} refused.`);
for (const g of refused) say(`  REFUSED  ${g.row.latin.padEnd(31)} ${g.gate.why}`);

// ---------------------------------------------------------------- 2. the three charge variants
const chargeOf = (seq) => ({
  published_pH65: P.netCharge(seq, { pH: 6.5 }),
  prereg_pH74: P.netCharge(seq, { pH: 7.4 }),
  integer: S.integerCharge(seq),
});

// variant (c): exposed-residue integer charge, from cached structures
function surfaceFromCache(acc) {
  for (const name of [`AF-${acc}.pdb`, `${acc}.pdb`, `esmfold-${acc}.pdb`]) {
    const p = path.join(CACHE, name);
    if (!fs.existsSync(p)) continue;
    const atoms = S.parsePDB(fs.readFileSync(p, 'utf8'));
    const sc = S.surfaceCharge(atoms);
    const dup = S.duplicateAtomPairs(atoms);
    return { ...sc, source_file: name, structure_source: name.startsWith('esmfold') ? 'ESMFold' : 'AlphaFold DB', duplicate_atoms: dup.length, struct_seq: S.structureSequence(S.residueSasa(atoms)) };
  }
  return null;
}

const rows = usable.map(g => {
  const r = g.row, acc = r.uniprot.accession;
  const q = chargeOf(r.sequence);
  const surf = surfaceFromCache(acc);
  const d = r.max_dive_duration;
  return {
    latin: r.latin, common: r.common, clade: r.clade, habit: r.habit, accession: acc,
    charge: q,
    surface: surf ? {
      z_surface: surf.z_surface, z_surface_his_protonated: surf.z_surface_his_protonated,
      fraction_ionisable_exposed: surf.fraction_ionisable_exposed,
      structure_source: surf.structure_source, duplicate_atoms: surf.duplicate_atoms,
      struct_seq_matches_uniprot: surf.struct_seq === r.sequence,
    } : null,
    // A row can carry a max_dive_duration OBJECT whose value is null - the honest representation of
    // "no sourced duration". Testing the object rather than the value let those rows through, and
    // Math.log10(null) is -Infinity rather than an error, so the first version of this ran a
    // correlation against minus infinity. predict.mjs refused it by name, which is why this is a
    // corrected line and not a silent wrong number.
    duration: (d && Number.isFinite(d.value) && d.value > 0)
      ? { value: d.value, units: d.units, kind: d.kind, use_for_regression: MB.DURATION_KINDS[d.kind]?.use_for_regression === true }
      : null,
    duration_absent_reason: (d && !(Number.isFinite(d.value) && d.value > 0))
      ? (d.value === null ? 'no sourced duration' : `duration value ${d.value} is not a positive finite number`) : null,
  };
});

const withDur = rows.filter(r => r.duration);
const regression = withDur.filter(r => r.duration.use_for_regression);

// ---------------------------------------------------------------- 3. the statistics
function analyse(set, pick, label) {
  if (set.length < 3) return { label, n: set.length, enough: false };
  const x = set.map(pick);
  const yRaw = set.map(r => r.duration.value);
  const yLog = yRaw.map(v => Math.log10(v));
  const rs = P.spearman(x, yLog);
  const rpLog = P.pearson(x, yLog);
  const rpRaw = P.pearson(x, yRaw);
  // predict.mjs defaults its permutation statistic to PEARSON. A p value reported next to a Spearman
  // rho, but computed on Pearson, is a p value for a different number - so both are computed and each
  // is labelled with the statistic it belongs to.
  const permP = P.permutationTest(x, yLog, { iters: 20000, seed: 20261107, statistic: 'pearson' });
  const permS = P.permutationTest(x, yLog, { iters: 20000, seed: 20261107, statistic: 'spearman' });
  return {
    label, n: set.length, enough: true,
    spearman_vs_log10: +rs.toFixed(4),
    spearman_ci95: P.ciFisher(rs, set.length),
    pearson_vs_log10: +rpLog.toFixed(4),
    pearson_vs_raw_minutes: +rpRaw.toFixed(4),
    permutation_p_on_pearson: permP.p ?? permP,
    permutation_p_on_spearman: permS.p ?? permS,
    permutation_iters: 20000, permutation_seed: 20261107,
    duration_range_min: [Math.min(...yRaw), Math.max(...yRaw)],
    species: set.map(r => r.latin),
  };
}

const A = {
  published_pH65_speciesmax: analyse(regression, r => r.charge.published_pH65, 'published convention (pH 6.5, all ionisable), species maxima only'),
  prereg_pH74_speciesmax: analyse(regression, r => r.charge.prereg_pH74, 'pre-registered (pH 7.4, all ionisable), species maxima only'),
  integer_speciesmax: analyse(regression, r => r.charge.integer, 'integer (K+R)-(D+E), species maxima only'),
  prereg_pH74_allduration: analyse(withDur, r => r.charge.prereg_pH74, 'pre-registered (pH 7.4), all sourced durations including single-study maxima'),
};
const surfSet = regression.filter(r => r.surface);
if (surfSet.length >= 3) A.surface_exposed_speciesmax = analyse(surfSet, r => r.surface.z_surface, 'exposed-residue integer charge from structures, species maxima only');

// ---------------------------------------------------------------- 3b. WHY THE SIGN FLIPS
//
// The pH 6.5 sum and the pH 7.4 sum of the SAME sequences give opposite-signed relationships with
// dive duration. That is not a bug, and it is not noise: it is histidine. Between pH 6.5 and 7.4,
// with a model histidine pKa near 6.0, the protonated fraction falls from roughly a quarter to a few
// per cent, so a sequence's histidine count is almost exactly the difference between the two sums.
// Myoglobin is unusually histidine-rich (7 to 14 in this set), and the count is not flat across the
// clades being compared. This block MEASURES that explanation rather than asserting it.
function mechanism(set) {
  if (set.length < 3) return { n: set.length, enough: false };
  const seqOf = (r) => MB.ROWS.find(x => x.uniprot.accession === r.accession).sequence;
  const his = set.map(r => (seqOf(r).match(/H/g) ?? []).length);
  const delta = set.map(r => r.charge.published_pH65 - r.charge.prereg_pH74);
  const y = set.map(r => Math.log10(r.duration.value));
  return {
    n: set.length, enough: true,
    histidine_count_range: [Math.min(...his), Math.max(...his)],
    pearson_his_vs_pH_difference: +P.pearson(his, delta).toFixed(4),
    spearman_his_vs_log_duration: +P.spearman(his, y).toFixed(4),
    spearman_pH65_vs_pH74_charge: +P.spearman(set.map(r => r.charge.published_pH65), set.map(r => r.charge.prereg_pH74)).toFixed(4),
    reading:
      'if pearson_his_vs_pH_difference is 1, the whole difference between the two charge conventions ' +
      'IS the histidine count; if spearman_pH65_vs_pH74_charge is near zero, the two conventions are ' +
      'not two estimates of one quantity but two different quantities that happen to share a name.',
  };
}
const MECH = mechanism(regression);

// ---------------------------------------------------------------- 4. the anchors (prediction 4)
const anchors = rows.filter(r => MB.TERRESTRIAL_ANCHORS.includes(r.latin));
const divers = rows.filter(r => /cetacean|pinniped|sirenian/.test(r.clade) || (r.habit && /dive/i.test(r.habit)));
const anchorQ = anchors.map(r => r.charge.prereg_pH74);
const diverQ = divers.map(r => r.charge.prereg_pH74);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const anchorTest = {
  n_anchors: anchors.length, n_divers: divers.length,
  anchor_charges: anchors.map(r => ({ latin: r.latin, z: +r.charge.prereg_pH74.toFixed(3) })),
  anchor_range: anchors.length ? [+Math.min(...anchorQ).toFixed(3), +Math.max(...anchorQ).toFixed(3)] : null,
  diver_range: divers.length ? [+Math.min(...diverQ).toFixed(3), +Math.max(...diverQ).toFixed(3)] : null,
  diver_median: divers.length ? +median(diverQ).toFixed(3) : null,
  anchors_above_diver_median: anchors.filter(r => r.charge.prereg_pH74 > median(diverQ)).map(r => r.latin),
  anchor_spread_narrower_than_diver_spread: anchors.length && divers.length
    ? (Math.max(...anchorQ) - Math.min(...anchorQ)) < (Math.max(...diverQ) - Math.min(...diverQ)) : null,
};

// ---------------------------------------------------------------- 5. score the pre-registration
const P1 = A.prereg_pH74_speciesmax;
const verdicts = [
  {
    id: 'case1-direction', predicted: 'positive sign of the charge/duration relationship',
    refuted_if: 'the point estimate of Spearman rho is negative',
    observed: P1.enough ? `Spearman rho = ${P1.spearman_vs_log10} (n = ${P1.n})` : `n = ${P1.n}, not analysable`,
    verdict: !P1.enough ? 'COULD_NOT_BE_TESTED' : P1.spearman_vs_log10 < 0 ? 'REFUTED' : 'SUPPORTED',
  },
  {
    id: 'case1-strength', predicted: 'Spearman rho in 0.50-0.85 with permutation p < 0.05 at n >= 12',
    refuted_if: 'rho < 0.40 or p >= 0.05',
    observed: P1.enough ? `rho = ${P1.spearman_vs_log10}, p = ${P1.permutation_p_two_sided}, n = ${P1.n}` : 'not analysable',
    verdict: 'COULD_NOT_BE_TESTED_AS_WRITTEN',
    why: `the pre-registered n >= 12 is not reachable from the sourced record: ${regression.length} rows carry a species-maximum duration and ${withDur.length} carry any sourced duration. The result at n = ${P1.n} is shown and is underpowered, not a pass or a fail of the prediction as written.`,
    underpowered_result: P1.enough ? (P1.spearman_vs_log10 >= 0.40 && P1.permutation_p_on_spearman < 0.05 ? 'would have been inside the band' : 'would have been outside the band') : null,
  },
  {
    id: 'case1-rank-beats-linear', predicted: 'Spearman(charge, log duration) exceeds Pearson(charge, raw minutes)',
    refuted_if: 'Pearson on raw minutes >= Spearman on log duration',
    observed: P1.enough ? `Spearman(log) = ${P1.spearman_vs_log10}, Pearson(raw) = ${P1.pearson_vs_raw_minutes}` : 'not analysable',
    verdict: !P1.enough ? 'COULD_NOT_BE_TESTED' : P1.pearson_vs_raw_minutes >= P1.spearman_vs_log10 ? 'REFUTED' : 'SUPPORTED',
  },
  {
    id: 'case1-anchors', predicted: 'terrestrial anchors sit at the low-charge end with a narrower spread than the divers',
    refuted_if: 'any strictly terrestrial mammal exceeds the median diver charge',
    observed: `anchor range ${JSON.stringify(anchorTest.anchor_range)} vs diver range ${JSON.stringify(anchorTest.diver_range)}, diver median ${anchorTest.diver_median}; anchors above it: ${anchorTest.anchors_above_diver_median.length ? anchorTest.anchors_above_diver_median.join(', ') : 'none'}`,
    verdict: anchorTest.anchors_above_diver_median.length ? 'REFUTED' : 'SUPPORTED',
    secondary: `spread narrower than divers: ${anchorTest.anchor_spread_narrower_than_diver_spread}`,
  },
  {
    id: 'case1-sequence-only-loses-something',
    predicted: 'directional only: sequence-only charge recovers the relationship LESS well than the published surface quantity',
    verdict: 'MIS-SPECIFIED',
    why: 'the premise was wrong. Z_Mb as published is a sum over ALL ionisable groups at pH 6.5, not a ' +
      'solvent-exposed subset, so there is no "surface" quantity for the sequence-only one to fall short of. ' +
      'The exposed-subset variant computed here is an ADDITION to the published quantity, not a reproduction of it.',
    exposed_subset_result: A.surface_exposed_speciesmax
      ? `exposed-residue charge gives Spearman rho = ${A.surface_exposed_speciesmax.spearman_vs_log10} at n = ${A.surface_exposed_speciesmax.n}, against ${P1.spearman_vs_log10} for the sequence sum at n = ${P1.n}`
      : `no structure cache at ${CACHE}: run fetch-structures.mjs first`,
  },
];

// ---------------------------------------------------------------- 6. report
const out = {
  what_this_is: 'Case 1 of PREREGISTRATION.md, scored against the sourced record. The pre-registration is commit a67a0ff15 and predates the data module.',
  fetched_on: MB.FETCHED_ON,
  gate: { rows: MB.ROWS.length, usable: usable.length, refused: refused.map(g => ({ latin: g.row.latin, why: g.gate.why })) },
  zmb_convention: P.ZMB_CONVENTION,
  analyses: A,
  why_the_sign_flips: MECH,
  anchors: anchorTest,
  verdicts,
  rows,
};
const outPath = path.join(HERE, 'results-myoglobin.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));

if (JSON_ONLY) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

say(`\n--- charges (pH 7.4 as pre-registered; published convention is pH 6.5) ---`);
say('species                        clade        Z(6.5)  Z(7.4)  Zint  Zsurf  dive(min)  kind');
for (const r of [...rows].sort((a, b) => b.charge.prereg_pH74 - a.charge.prereg_pH74)) {
  say(`${r.latin.padEnd(31)}${String(r.clade).padEnd(13)}${r.charge.published_pH65.toFixed(2).padStart(6)}${r.charge.prereg_pH74.toFixed(2).padStart(8)}${String(r.charge.integer).padStart(6)}${String(r.surface ? r.surface.z_surface : '-').padStart(7)}${String(r.duration ? r.duration.value : '-').padStart(11)}  ${r.duration ? r.duration.kind : ''}`);
}

say(`\n--- correlations ---`);
for (const [k, a] of Object.entries(A)) {
  if (!a.enough) { say(`${k}: n = ${a.n}, too few rows`); continue; }
  const ci = a.spearman_ci95?.lo !== undefined ? [+a.spearman_ci95.lo.toFixed(3), +a.spearman_ci95.hi.toFixed(3)] : a.spearman_ci95;
  const pS = Number(a.permutation_p_on_spearman), pP = Number(a.permutation_p_on_pearson);
  say(`${a.label}`);
  say(`  n = ${a.n}  Spearman(log10 min) = ${a.spearman_vs_log10}  CI95 ${JSON.stringify(ci)}  perm p on Spearman = ${Number.isFinite(pS) ? pS.toFixed(4) : 'n/a'}`);
  say(`  Pearson(log10) = ${a.pearson_vs_log10}  Pearson(raw min) = ${a.pearson_vs_raw_minutes}  perm p on Pearson = ${Number.isFinite(pP) ? pP.toFixed(4) : 'n/a'}`);
}

if (MECH.enough) {
  say(`\n--- why the two conventions disagree ---`);
  say(`  histidines per myoglobin in the regression set: ${MECH.histidine_count_range[0]} to ${MECH.histidine_count_range[1]}`);
  say(`  Pearson(histidine count, Z(6.5) - Z(7.4))  = ${MECH.pearson_his_vs_pH_difference}`);
  say(`  Spearman(histidine count, log10 duration)  = ${MECH.spearman_his_vs_log_duration}`);
  say(`  Spearman(Z(6.5), Z(7.4)) across species    = ${MECH.spearman_pH65_vs_pH74_charge}`);
}

say(`\n--- the pre-registered predictions ---`);
for (const v of verdicts) {
  say(`\n[${v.verdict}] ${v.id}\n  predicted: ${v.predicted}`);
  if (v.refuted_if) say(`  refuted if: ${v.refuted_if}`);
  if (v.observed) say(`  observed: ${v.observed}`);
  if (v.why) say(`  why: ${v.why}`);
  if (v.underpowered_result) say(`  underpowered: ${v.underpowered_result}`);
  if (v.exposed_subset_result) say(`  exposed subset: ${v.exposed_subset_result}`);
  if (v.secondary) say(`  also: ${v.secondary}`);
}
const tally = verdicts.reduce((a, v) => { a[v.verdict] = (a[v.verdict] ?? 0) + 1; return a; }, {});
say(`\n${Object.entries(tally).map(([k, n]) => `${n} ${k}`).join(', ')}`);
say(`written to ${path.relative(ROOT, outPath).split(path.sep).join('/')}`);
