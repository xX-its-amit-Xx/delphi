// SPLIT CONFORMAL OVER THE CALIBRATION TABLES THAT ALREADY EXIST.
//
// ============================== WHAT THIS ADDS, AND WHAT IT DOES NOT ==============================
// sim-engine/validate/data/joint-calibration.v1.3.0.json was built by the scorer thread and frozen on
// 2026-11-01. It holds 101-point empirical quantile tables of q = D^2/d over real positives, each scored
// with its OWN FAMILY held out of the fit: fishshapes d = 3..9 at n = 10,694, fishbase d = 3..10 at
// n = 7,100. That is conformal machinery, already written.
//
// What was missing was the statement. A quantile table alone does not say what a number means; this file
// turns a q into a CALL with a stated miscoverage rate, the finite-sample coverage bound that comes with
// it, and the assumption that bound rests on. It reads the table and nothing else: no refitting, no
// reweighting, no new model. Read-only on another thread's frozen artefact, deliberately.
//
// ============================== THE ONE THING IT WILL NOT DO ==============================
// It will not return a probability. With zero outcome labels, a number between 0 and 1 attached to a
// design would be read as P(this works) within a day of being published, by someone who did not read the
// caveat. So the return value is an INSIDE/OUTSIDE call plus the threshold and the percentile, and
// `probability()` exists only to refuse, with the reason.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TABLE_PATH = path.resolve(HERE, '../data/joint-calibration.v1.3.0.json');

export const WHAT_THIS_IS =
  'Split-conformal INSIDE/OUTSIDE calls against the distribution real animals occupy, read from the ' +
  'frozen leave-one-family-out quantile tables. It never returns a probability and never refits anything.';

let _table = null;
export function table() {
  if (!_table) _table = JSON.parse(fs.readFileSync(TABLE_PATH, 'utf8'));
  return _table;
}

export function blocks() {
  const t = table();
  return Object.fromEntries(Object.entries(t.blocks).map(([b, dims]) => [b, Object.keys(dims).map(Number).sort((x, y) => x - y)]));
}

/** Angelopoulos & Bates, Table 1: calibration points needed for a coverage slack of eps at alpha = 0.1,
 *  delta = 0.1. Quoted, not derived here. The first row is the number that matters for a lab programme. */
export const COVERAGE_SLACK_TABLE = Object.freeze({
  0.1: 22, 0.05: 102, 0.01: 2491, 0.005: 9812, 0.001: 244390,
  source: 'Angelopoulos & Bates, "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification", arXiv:2107.07511, Table 1 (alpha = 0.1, delta = 0.1).',
});

export function nForSlack(eps) {
  const key = Object.keys(COVERAGE_SLACK_TABLE).map(Number).filter(Number.isFinite).sort((a, b) => b - a).find(k => k <= eps + 1e-12);
  if (key === undefined) return { eps, n: null, why: `no tabulated value at or below eps = ${eps}; the table stops at 0.001 (n = 244,390).` };
  return {
    eps: key, n: COVERAGE_SLACK_TABLE[key],
    means: `with ${COVERAGE_SLACK_TABLE[key]} exchangeable calibration points, the realised coverage is within ${key} of 1 - alpha with probability 0.9.`,
    source: COVERAGE_SLACK_TABLE.source,
  };
}

/** The conformal threshold: the empirical ceil((n+1)(1-alpha))/n quantile of the calibration scores.
 *  The table stores 101 points (percentiles 0..100), so the index is derived and the rounding is stated. */
export function threshold({ block = 'fishshapes', d = 5, alpha = 0.05 } = {}) {
  const t = table();
  const b = t.blocks[block];
  if (!b) return { refused: true, why: `no block "${block}". Blocks: ${Object.keys(t.blocks).join(', ')}` };
  const cell = b[String(d)];
  if (!cell) return { refused: true, why: `block "${block}" has no dimension ${d}. Dimensions: ${Object.keys(b).join(', ')}` };
  if (!(alpha > 0 && alpha < 1)) return { refused: true, why: `alpha must be in (0,1), got ${alpha}` };

  const n = cell.n;
  const level = Math.ceil((n + 1) * (1 - alpha)) / n;           // the split-conformal level
  const idxExact = Math.min(100, Math.max(0, level * 100));
  const idx = Math.min(100, Math.ceil(idxExact));                // round UP: a conservative threshold
  return {
    block, d, alpha, n,
    traits: cell.traits,
    conformal_level: +level.toFixed(6),
    quantile_index_used: idx,
    quantile_index_exact: +idxExact.toFixed(4),
    threshold_q: cell.quantiles[idx],
    rounding:
      `the table stores whole percentiles, so the exact conformal level ${(level * 100).toFixed(4)} % is ` +
      `rounded UP to the ${idx}th percentile. Rounding up makes the region LARGER and the guarantee ` +
      `conservative; rounding down would quietly break it.`,
    coverage_bound: {
      lower: 1 - alpha,
      upper: +(1 - alpha + 1 / (n + 1)).toFixed(8),
      statement: `1 - alpha <= P(a real animal is called INSIDE) <= 1 - alpha + 1/(n+1), i.e. between ${(100 * (1 - alpha)).toFixed(2)} % and ${(100 * (1 - alpha + 1 / (n + 1))).toFixed(4)} %.`,
      assumption: 'exchangeability of the design with the calibration set, which a designed organism violates by construction. See target.mjs EXCHANGEABILITY.',
    },
    table_rule: table().rule,
    table_built: table().built,
  };
}

/** Where does this q sit among real animals? A call, a percentile, and no probability. */
export function insideAt(q, { block = 'fishshapes', d = 5, alpha = 0.05 } = {}) {
  const th = threshold({ block, d, alpha });
  if (th.refused) return th;
  if (!(Number.isFinite(q) && q >= 0)) return { refused: true, why: `q must be a finite non-negative number, got ${q}` };
  const cell = table().blocks[block][String(d)];
  // the percentile of real animals scoring at or below this q
  let below = 0;
  while (below <= 100 && cell.quantiles[below] <= q) below++;
  const pct = Math.max(0, below - 1);
  return {
    q, block, d, alpha,
    call: q <= th.threshold_q ? 'INSIDE' : 'OUTSIDE',
    threshold_q: th.threshold_q,
    percentile_of_real_animals_at_or_below_this_q: pct,
    read_this_as:
      q <= th.threshold_q
        ? `this design's q (${q}) is inside the region where ${(100 * (1 - alpha)).toFixed(0)} % of real animals fall, on the ${cell.traits.length} traits named. It says nothing about whether the design works.`
        : `this design's q (${q}) is outside the region where ${(100 * (1 - alpha)).toFixed(0)} % of real animals fall (threshold ${th.threshold_q}). Roughly ${100 - pct} % of real animals also score worse than this, so OUTSIDE is not "impossible" - it is "unusual among measured animals".`,
    coverage_bound: th.coverage_bound,
    traits: cell.traits,
    n_calibration: th.n,
    what_this_is_not: 'This is NOT a probability, NOT a success rate, and NOT a statement about any trait outside the list above.',
  };
}

/** The refusal. Kept as a function so that calling code has somewhere to land and a reason to print. */
export function probability() {
  return {
    refused: true,
    why: 'this module will not emit a probability.',
    because: [
      'there are zero outcome labels in this repository, so no probability of success can be calibrated against anything.',
      'the quantity that IS calibrated - membership in the distribution of real animals - is not a probability of success, and publishing it as a number between 0 and 1 invites exactly that misreading.',
      'read as a probability, the existing scorer is measured to be badly calibrated: held-out family-out ECE 0.4765 and Brier 0.4648 for the shipped default, with 20,989 of 23,355 items in the top bin.',
    ],
    what_you_can_have_instead: 'insideAt(q, {alpha}) - a call, a threshold, a percentile and a coverage bound.',
    what_would_change_this: `${nForSlack(0.1).n} exchangeable outcome labels would support a coverage statement about outcomes. They do not exist yet, and a designed organism is not exchangeable with a museum specimen even then.`,
  };
}

/** A self-check: does the table actually deliver the coverage it promises, on its own points?
 *  This is the only honest internal validation available with no outcomes - and it is a sanity check on
 *  the TABLE, not evidence about any design. */
export function selfCoverage({ block = 'fishshapes', d = 5, alpha = 0.05 } = {}) {
  const th = threshold({ block, d, alpha });
  if (th.refused) return th;
  const cell = table().blocks[block][String(d)];
  // the quantiles ARE the calibration distribution, so the fraction below the threshold is read off
  // directly: the index of the threshold percentile is the empirical coverage.
  const realised = th.quantile_index_used / 100;
  return {
    block, d, alpha,
    target_coverage: 1 - alpha,
    realised_on_the_calibration_points: realised,
    within_bound: realised >= 1 - alpha - 1e-9 && realised <= 1 - alpha + 1 / (cell.n + 1) + 0.01,
    note:
      'this is coverage ON the calibration points, which is a consistency check on the table and the ' +
      'index arithmetic, not an out-of-sample result. The out-of-sample guarantee is the bound in ' +
      'threshold().coverage_bound, and it holds only under exchangeability.',
    percentile_resolution_cost:
      'because the table stores whole percentiles, the finest alpha it can serve honestly is 0.01. A ' +
      'request for alpha below that is rounded to the 100th percentile and the threshold stops moving.',
  };
}
