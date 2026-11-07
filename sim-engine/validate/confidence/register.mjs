// THE PREDICTION REGISTER: the thing that turns a returned lab result from an anecdote into a label.
//
// ============================== WHY A REGISTER AND NOT A SPREADSHEET ==============================
// A confidence score is only worth printing if something can falsify it, and the only thing that can is
// an outcome. But an outcome is a label only if three things were fixed BEFORE it arrived:
//
//   1. WHICH prediction it tests. Without a stable id, a result attaches to whatever hypothesis the
//      result happens to fit, which is not a test of anything.
//   2. WHAT would count as right. A pass/fail criterion written after the measurement is a description.
//   3. WHICH code produced it. A prediction from scorer v1.0.0 and one from v1.3.0 are different
//      predictions, and pooling them produces a calibration curve for a model that never existed.
//
// So an id here is the SHA-256 of the prediction's own content - the design, the quantity, the criterion
// and every version string. Two identical predictions get the same id by construction, and changing any
// part of a prediction produces a different id rather than silently overwriting a record.
//
// ============================== THE REFUSAL ==============================
// calibrationSet() will not emit a calibration below 22 labels, which is the Angelopoulos & Bates
// Table 1 number for a 0.1 coverage slack at alpha = 0.1. Below that it returns the count, the shortfall
// and nothing else. A calibration curve drawn through four points looks exactly like one drawn through
// four hundred.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as TARGET from './target.mjs';
import * as CONF from './conformal.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Append-only JSONL. Nothing is committed: the register is operational data, not source. */
export const DEFAULT_STORE = path.join(HERE, 'predictions.jsonl');

export const WHAT_THIS_IS =
  'An append-only register of predictions, each with a content-hash id, a pre-registered pass/fail ' +
  'criterion, the versions that produced it, and an empty slot for what a lab observed. It is the ' +
  'difference between a returned measurement and a calibration label.';

export const REQUIRED_TO_ISSUE = ['design_id', 'quantity', 'predicted', 'criterion', 'versions'];

/** Issue a prediction. Pure: returns the record, writes nothing unless `store` is given. */
export function issue(spec, { store = null, now = null } = {}) {
  const missing = REQUIRED_TO_ISSUE.filter(k => spec?.[k] === undefined || spec[k] === null || spec[k] === '');
  if (missing.length) {
    return {
      refused: true,
      why: `a prediction cannot be issued without ${missing.join(', ')}`,
      because: {
        design_id: 'without it the result attaches to nothing',
        quantity: 'without it nobody can tell what was measured',
        predicted: 'without it there is no prediction, only a hope',
        criterion: 'a pass/fail rule written after the measurement is a description, not a test',
        versions: 'a prediction from two different model versions is two different predictions',
      },
    };
  }
  if (!spec.criterion.includes('>') && !spec.criterion.includes('<') && !spec.criterion.includes('=') && !/inside|outside|present|absent/i.test(spec.criterion)) {
    return { refused: true, why: `the criterion "${spec.criterion}" states no comparison, so no observation could fail it. A criterion nothing can fail is not a criterion.` };
  }
  const core = {
    design_id: spec.design_id,
    quantity: spec.quantity,
    predicted: spec.predicted,
    criterion: spec.criterion,
    versions: spec.versions,
    target_quantity: TARGET.CHOSEN.id,
    target_prereg_sha256: TARGET.hash().sha256,
    alpha: spec.alpha ?? null,
    notes: spec.notes ?? null,
  };
  const id = crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex').slice(0, 16);
  const record = {
    prediction_id: id,
    issued_at: now ?? null,
    ...core,
    observation: null,
    observation_attached_at: null,
    what_this_id_is: 'the SHA-256 of this prediction\'s own content, truncated to 16 hex characters. Change any field and the id changes; two identical predictions share one id.',
  };
  if (store) appendRecord(record, store);
  return record;
}

export function appendRecord(record, store = DEFAULT_STORE) {
  fs.mkdirSync(path.dirname(store), { recursive: true });
  fs.appendFileSync(store, JSON.stringify(record) + '\n');
  return store;
}

export function load(store = DEFAULT_STORE) {
  if (!fs.existsSync(store)) return [];
  return fs.readFileSync(store, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

/** Attach an observation. Append-only: this returns a NEW record, it never edits one in place. */
export function attach(prediction, observation, { validator = null, now = null } = {}) {
  if (!prediction?.prediction_id) return { refused: true, why: 'not a prediction record' };
  if (prediction.observation) {
    return {
      refused: true,
      why: `prediction ${prediction.prediction_id} already carries an observation.`,
      what_to_do: 'issue a new prediction, or record the second observation as a replication with its own id. Overwriting would silently discard a result, which is the one thing an append-only register exists to prevent.',
    };
  }
  const check = validator ? validator(observation) : null;
  return {
    ...prediction,
    observation,
    observation_attached_at: now ?? null,
    validation: check,
    usable_as_a_label: check ? check.usable_as_a_label === true : null,
    why_not_usable: check && check.usable_as_a_label === false ? check.blockers : null,
  };
}

/** Did the observation satisfy the criterion? Mechanical where it can be, refused where it cannot. */
export function grade(record) {
  if (!record?.observation) return { graded: false, why: 'no observation attached' };
  if (record.usable_as_a_label === false) {
    return { graded: false, why: 'the observation did not pass its own gates, so it cannot grade a prediction', blockers: record.why_not_usable };
  }
  const m = /^(.*?)\s*(>=|<=|>|<|==|=)\s*(-?[\d.]+)\s*$/.exec(String(record.criterion));
  if (!m) {
    return {
      graded: false,
      why: `the criterion "${record.criterion}" is not a numeric comparison this function can evaluate.`,
      what_to_do: 'grade it by hand and record WHO graded it. A criterion a machine cannot check is not wrong - it just cannot be graded without a person, and the person should be named.',
    };
  }
  const value = Number(record.observation.value ?? record.observation.measured ?? NaN);
  if (!Number.isFinite(value)) return { graded: false, why: 'the observation carries no numeric value to compare' };
  const [, , op, rhsRaw] = m;
  const rhs = Number(rhsRaw);
  const pass = op === '>=' ? value >= rhs : op === '<=' ? value <= rhs : op === '>' ? value > rhs : op === '<' ? value < rhs : value === rhs;
  return { graded: true, pass, observed: value, criterion: record.criterion, how: `${value} ${op} ${rhs} is ${pass}` };
}

/** The calibration set, and the refusal that guards it. */
export function calibrationSet(records, { alpha = 0.1, eps = 0.1 } = {}) {
  const graded = records.map(r => ({ r, g: grade(r) })).filter(x => x.g.graded);
  const need = CONF.nForSlack(eps);
  if (graded.length < need.n) {
    return {
      refused: true,
      n_labels: graded.length,
      n_needed: need.n,
      shortfall: need.n - graded.length,
      why: `a calibration needs ${need.n} exchangeable labels for a coverage slack of ${need.eps} at alpha = ${alpha}; ${graded.length} are graded.`,
      source: need.source,
      what_you_may_say_instead:
        graded.length === 0
          ? 'nothing numeric. With zero labels the honest output is the provenance and evaluability statement, not a score.'
          : `that ${graded.length} prediction(s) have been graded, with their individual pass/fail. Individual results are reportable; a calibration is not.`,
      and_the_deeper_problem:
        'even at ' + need.n + ' labels the exchangeability the guarantee needs is violated, because a ' +
        'designed organism is not drawn from the distribution of the calibration points. See target.mjs.',
    };
  }
  const passes = graded.filter(x => x.g.pass).length;
  return {
    n_labels: graded.length,
    n_pass: passes,
    empirical_hit_rate: +(passes / graded.length).toFixed(4),
    alpha,
    coverage_slack: need,
    caveat: 'marginal only, and not valid per design class: conditional coverage is impossible in general.',
  };
}

/** What the register can say with no labels at all - which is what it will say for a long time. */
export function statusWithNoLabels(records = []) {
  const set = calibrationSet(records);
  return {
    predictions_issued: records.length,
    predictions_with_an_observation: records.filter(r => r.observation).length,
    predictions_graded: records.map(grade).filter(g => g.graded).length,
    calibration: set.refused ? null : set,
    what_may_be_published_today: [
      'the provenance of every input, from the kind vocabulary already applied to ~950 parameter entries',
      'the evaluability of each pre-registered axis, which design-validation/scorecard.json puts at 1 scored of 10 declared',
      'an INSIDE/OUTSIDE call against the distribution of real animals, as a coverage statement',
    ],
    what_may_not: [
      'a probability that a design works',
      'a calibration curve',
      'any number described as "confidence" without the reference set named in the same sentence',
    ],
    the_number_that_changes_this: set.refused ? set.n_needed : null,
  };
}
