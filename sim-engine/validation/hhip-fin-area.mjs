// The registered test from PREREGISTRATION.md. Run AFTER that file was written; the criteria here
// are copied from it and must not be edited to match an outcome.
//
//   node validation/hhip-fin-area.mjs [--json]
//
// hhip loss of function removes a ligand sink, so the ONLY parameter that differs between the
// wild-type and mutant runs is the clearance k, reduced by the unmeasured fraction f that Hhip
// contributes to total clearance.

import fs from 'node:fs';
import path from 'node:path';
import { solve, supraThreshold, calibrateThreshold } from '../tools/morphogen-diffusion.mjs';
import { param } from '../lib/provenance.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const asJson = process.argv.includes('--json');

// ── The target, read from the repository rather than retyped ────────────────
const iv = JSON.parse(fs.readFileSync(path.join(root, 'genotype/interventions.json'), 'utf8'));
const records = Object.values(iv).find(v => Array.isArray(v) && v.length > 50);
const pick = id => { const r = records.find(x => x.id === id); if (!r) throw new Error(`missing record ${id}`); return r; };
const areaRec = pick('hhip-uki-loss-fin-area');
const dvRec = pick('hhip-uki-loss-fin-dorsoventral');
const apRec = pick('hhip-uki-loss-fin-anteroposterior-no-change');

const MEASURED = {
  area_ratio: 1 + areaRec.effect_size.value / 100,          // 1.65
  dv_ratio: 1 + dvRec.effect_size.value / 100,              // 1.50
  ap_ratio: null,                                           // reported not significant
  area_ratio_implied_by_dv: 1 + dvRec.effect_size.value / 100, // 1.50, since A/P is unchanged
  source: `${areaRec.sources[0].first_author} ${areaRec.sources[0].year}, PMID ${areaRec.sources[0].pmid}`,
};

// ── Parameters, fetched. Only k differs between the two runs. ───────────────
const D = param('fgf8a-D-fast-endogenous').value;        // 56 um^2/s, measured (borrowed for Shh)
const halfLife = param('fgf8-residence-time').value;     // 9 min, measured-secondhand
const k_wt = Math.log(2) / (halfLife * 60);

// Geometry: assumed. Axis 0 = anteroposterior with the ZPA as a posterior strip; axis 1 = dorsoventral.
const DIMS = [60, 60], SPACING = 2.5;
const SOURCE = { axis: 0, from: 0, to: 2, rate: 1 };

const F_BAND = [0.25, 0.75];     // Hhip's share of total clearance; pre-declared, not fitted
const PHI_BAND = [0.2, 0.8];     // wild-type occupancy fraction; pre-declared in amendment 4a
const grid = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

const wt = solve({ dims: DIMS, spacing_um: SPACING, D_um2_s: D, k_s: k_wt, source: SOURCE });
const domainArea = DIMS[0] * DIMS[1] * SPACING * SPACING;

// The mutant field depends only on f, never on phi, so solve each f once. (Solving inside both
// loops gave the same answers forty-nine times over and took minutes instead of seconds.)
const fValues = grid(F_BAND[0], F_BAND[1], 7);
const mutantFields = new Map(
  fValues.map(f => [f, solve({ dims: DIMS, spacing_um: SPACING, D_um2_s: D, k_s: k_wt * (1 - f), source: SOURCE })]));

const rows = [];
for (const phi of grid(PHI_BAND[0], PHI_BAND[1], 7)) {
  // ONE calibration, to the wild type only: theta set so the WT region occupies phi of the domain.
  const theta = calibrateThreshold(wt, phi * domainArea);
  const wtRegion = supraThreshold(wt, theta);
  for (const f of fValues) {
    // The mutant differs in k and in nothing else. theta is NOT recalibrated.
    const mutRegion = supraThreshold(mutantFields.get(f), theta);
    rows.push({
      phi, f,
      area_ratio: mutRegion.measure / wtRegion.measure,
      ap_ratio: wtRegion.extent_um[0] ? mutRegion.extent_um[0] / wtRegion.extent_um[0] : null,
      dv_ratio: wtRegion.extent_um[1] ? mutRegion.extent_um[1] / wtRegion.extent_um[1] : null,
      saturated: mutRegion.measure >= domainArea * 0.999,
    });
  }
}

// ── The criteria, copied from PREREGISTRATION.md section 4 ──────────────────
const areaRatios = rows.map(r => r.area_ratio);
const lo = Math.min(...areaRatios), hi = Math.max(...areaRatios);

// P1 sign: every point in the band must give a ratio > 1.
const P1 = { id: 'P1-sign', criterion: 'mutant area ratio > 1 for every (f, phi)',
  pass: rows.every(r => r.area_ratio > 1),
  observed: `range ${lo.toFixed(3)} to ${hi.toFixed(3)}`,
  weight: 'weak by declaration: lowering clearance can hardly shrink a supra-threshold region' };

// P2 anisotropy: dD/V > dA/P everywhere, and the A/P change small enough to read as "not significant".
const dvGtAp = rows.every(r => r.dv_ratio != null && r.ap_ratio != null && r.dv_ratio > r.ap_ratio);
const apMax = Math.max(...rows.map(r => r.ap_ratio ?? 0));
const P2 = { id: 'P2-anisotropy', criterion: 'dorsoventral increase exceeds anteroposterior increase everywhere, and A/P change < 20%',
  pass: dvGtAp && apMax < 1.2,
  observed: `D/V > A/P at every grid point: ${dvGtAp}; largest A/P ratio ${apMax.toFixed(3)}`,
  weight: 'carries the evidential weight: independent of phi, and nothing was arranged to produce it' };

// P3 magnitude: the measurement, or the D/V-implied reading of it, inside the spanned range.
const spans = x => x >= lo && x <= hi;
const P3 = { id: 'P3-magnitude', criterion: 'measured 1.65, or the D/V-implied 1.50, lies inside the range the model spans',
  pass: spans(MEASURED.area_ratio) || spans(MEASURED.area_ratio_implied_by_dv),
  observed: `model spans ${lo.toFixed(3)} to ${hi.toFixed(3)}; measured 1.650 inside: ${spans(1.65)}; D/V-implied 1.500 inside: ${spans(1.5)}`,
  weight: 'demoted by amendment 4a: a two-parameter family spanning a target shows consistency, never prediction' };

const checks = [P1, P2, P3];
const headline = !P2.pass ? 'FAIL on the criterion that mattered'
  : P1.pass && P3.pass ? 'PASS on all three, with P3 reading as consistency only'
  : 'MIXED';

const out = {
  test: 'hhip loss of function vs pectoral fin size at 72 hpf',
  preregistration: 'sim-engine/PREREGISTRATION.md',
  measured: MEASURED,
  model: { D_um2_s: D, half_life_min: halfLife, k_wt_s: k_wt, lambda_um: Math.sqrt(D / k_wt),
    domain_um: [DIMS[0] * SPACING, DIMS[1] * SPACING], f_band: F_BAND, phi_band: PHI_BAND,
    calibrations_to_wild_type: 1, parameters_fitted_to_the_mutant: 0 },
  checks, headline,
  saturated_points: rows.filter(r => r.saturated).length,
  grid_points: rows.length,
  rows: asJson ? rows : undefined,
};

if (asJson) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`\n${out.test}`);
  console.log(`measured: area x${MEASURED.area_ratio} (${MEASURED.source}), D/V x${MEASURED.dv_ratio}, A/P not significant`);
  console.log(`model: lambda ${out.model.lambda_um.toFixed(0)} um on a ${out.model.domain_um.join(' x ')} um domain; ` +
    `${out.model.calibrations_to_wild_type} calibration to wild type, ${out.model.parameters_fitted_to_the_mutant} fitted to the mutant`);
  console.log(`grid: ${out.grid_points} points, ${out.saturated_points} of them saturating the domain\n`);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id}\n        criterion: ${c.criterion}\n        observed:  ${c.observed}\n        weight:    ${c.weight}`);
  console.log(`\n${headline}\n`);
}
process.exitCode = P2.pass ? 0 : 1;
