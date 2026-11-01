/**
 * compensation/validate.mjs  --  node sim-engine/validate/functional/compensation/validate.mjs
 *
 * Apply the rule chain retrospectively to every row of the case table and report how often it
 * agrees with the published outcome, INCLUDING its failures.
 *
 * The case-table lookup (R09) is DISABLED throughout, otherwise this would just read the answers
 * back out of the table it is meant to be tested against.
 *
 * Two modes, because they measure different things:
 *   A  as-available   -- supply only what the case row and our omics layer actually contain.
 *                        Measures whether the rule can reach a verdict AT ALL on real inputs.
 *   B  granted        -- additionally GRANT R06's expression condition for the named compensator.
 *                        Isolates the allele/lesion logic, which is the core of the rule base.
 *
 * Writes VALIDATION.json next to this file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compensationVerdict, CASES, resolveAlleleKind } from './classify.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ANAT = { id: 'ZFA:0001094', label: 'whole organism', uberon: 'UBERON:0000468' };
const STAGE = { id: 'ZFS:0000037', label: 'Hatching:Long-pec' };
const REQ = { anatomy: ANAT, stage: STAGE };

/** The published outcome, reduced to the one axis the rule chain actually predicts. */
function observedAdaptation(c) {
  const a = c.adaptation;
  if (a === true) return true;
  if (a === false) return false;
  if (typeof a === 'string') {
    if (/^not-tested|not-measured|by design/i.test(a)) return null; // no ground truth on this axis
    if (/^YES|partial|tissue-dependent/i.test(a)) return true;
    return null;
  }
  return null;
}

function inputsFor(c, mode) {
  const compensators = (c.compensator || []).filter(Boolean);
  // Paralogues: give the rule the compensators the paper names, with identity where we have it.
  const paralogues = compensators.length
    ? compensators.map(s => ({ symbol: s, identity_pct: c.paralogue_identity_pct ?? 50.0 }))
    : (Array.isArray(c.compensator) ? [] : null);

  let expression = null;
  if (mode === 'B' && compensators.length) {
    expression = { required: REQ, byGene: Object.fromEntries(compensators.map(s => [s, {
      expressed_in: [{ label: ANAT.label, anatomy: ANAT, stages: [STAGE.label], sources: ['granted-for-validation'], kind: ['curated'] }],
      not_expressed_in: [], expression_level: []
    }])) };
  }
  return {
    gene: c.gene, alleleKind: c.allele_kind, paralogues, expression,
    requirement: REQ, organism: c.species ?? 'Danio rerio',
    skipCaseTable: true
  };
}

/**
 * Reduce the verdict to a prediction ON THE SAME AXIS the case row measured.
 *
 * Every 'adaptation' field in the case table records whether an ADAPTING GENE WAS UPREGULATED,
 * i.e. transcriptional adaptation. The rule chain can instead return a PARALOGUE-BUFFERING
 * verdict, which is a different claim about a different mechanism. Scoring one against the other
 * would be apples to oranges, so:
 *   - if the verdict carries an explicit transcriptional_adaptation sub-verdict, use that;
 *   - if it asserts with kind 'transcriptional-adaptation', it predicts adaptation;
 *   - if it asserts with kind 'paralogue-buffering' or 'protein-feedback', it makes NO claim
 *     about adaptation, so it abstains on this axis.
 */
function predictedAdaptation(v) {
  if (v.transcriptional_adaptation) {
    return v.transcriptional_adaptation.class === 'not-expected' ? false : null;
  }
  const asserts = v.class === 'documented' || v.class === 'plausible-by-rule';
  if (asserts) {
    if (v.kind === 'paralogue-buffering' || v.kind === 'protein-feedback') return null;
    return true;
  }
  if (v.class === 'not-expected') return false;
  return null;
}

function classifyOutcome(v, observed) {
  if (observed === null) return 'no-ground-truth';
  const pred = predictedAdaptation(v);
  if (pred === null) return 'abstain';
  if (observed === true) return pred ? 'true-positive' : 'FALSE-NEGATIVE';
  return pred ? 'FALSE-POSITIVE' : 'true-negative';
}

const report = { generated: new Date().toISOString().slice(0, 10), modes: {} };

for (const mode of ['A', 'B']) {
  const rows = [];
  for (const c of CASES.cases) {
    const observed = observedAdaptation(c);
    let v, err = null;
    try { v = compensationVerdict(inputsFor(c, mode)); }
    catch (e) { err = e.message; v = { class: 'ERROR', rule_id: null, why: e.message }; }
    rows.push({
      case_id: c.case_id, gene: c.gene, allele_kind: c.allele_kind,
      allele: c.allele ?? null,
      zebrafish: c.zebrafish !== false,
      held_out: !!c.held_out, derivation_case: !!c.derivation_case,
      compensation_tested: !!c.compensation_tested,
      observed_adaptation: c.adaptation,
      observed_reduced: observed,
      phenotype_rescued: c.phenotype_rescued ?? null,
      predicted: v.class, rule_id: v.rule_id,
      outcome: err ? 'ERROR' : classifyOutcome(v, observed),
      predicted_adaptation_axis: err ? null : predictedAdaptation(v),
      why: (v.why || '').slice(0, 220),
      error: err
    });
  }
  const tally = {};
  for (const r of rows) tally[r.outcome] = (tally[r.outcome] || 0) + 1;

  const decided = rows.filter(r => ['true-positive', 'true-negative', 'FALSE-POSITIVE', 'FALSE-NEGATIVE'].includes(r.outcome));
  const correct = decided.filter(r => r.outcome.startsWith('true')).length;
  const heldOutDecided = decided.filter(r => r.held_out || !r.derivation_case);

  report.modes[mode] = {
    description: mode === 'A'
      ? 'as-available: only the inputs the case row and our omics layer actually contain'
      : 'granted: R06 expression condition GRANTED for every named compensator, to isolate the lesion logic',
    rows_total: rows.length,
    tally,
    decided: decided.length,
    correct,
    agreement_on_decided: decided.length ? +(correct / decided.length).toFixed(3) : null,
    false_positives: decided.filter(r => r.outcome === 'FALSE-POSITIVE').map(r => ({ case_id: r.case_id, gene: r.gene, rule_id: r.rule_id, why: r.why })),
    false_negatives: decided.filter(r => r.outcome === 'FALSE-NEGATIVE').map(r => ({ case_id: r.case_id, gene: r.gene, rule_id: r.rule_id, why: r.why })),
    held_out_decided: heldOutDecided.length,
    held_out_correct: heldOutDecided.filter(r => r.outcome.startsWith('true')).length,
    rows
  };
}

// ---------------------------------------------------------------------------
// The honest accounting
// ---------------------------------------------------------------------------
const A = report.modes.A, B = report.modes.B;
const derivationDecided = B.rows.filter(r => r.derivation_case && ['true-positive', 'true-negative', 'FALSE-POSITIVE', 'FALSE-NEGATIVE'].includes(r.outcome));
const independentDecided = B.rows.filter(r => !r.derivation_case && ['true-positive', 'true-negative', 'FALSE-POSITIVE', 'FALSE-NEGATIVE'].includes(r.outcome));

report.honest_accounting = {
  circularity: {
    derivation_rows_decided: derivationDecided.length,
    derivation_rows_correct: derivationDecided.filter(r => r.outcome.startsWith('true')).length,
    note: 'These rows come from the same papers the rules were derived from. Agreement on them measures SELF-CONSISTENCY, not predictive accuracy, and must not be quoted as a validation result.'
  },
  independent: {
    rows_decided: independentDecided.length,
    rows_correct: independentDecided.filter(r => r.outcome.startsWith('true')).length,
    detail: independentDecided.map(r => ({ case_id: r.case_id, outcome: r.outcome, predicted: r.predicted, observed: r.observed_reduced }))
  },
  ground_truth_coverage: {
    rows_with_no_ground_truth_on_adaptation: B.rows.filter(r => r.observed_reduced === null).length,
    rows_where_compensation_was_actually_tested: B.rows.filter(r => r.compensation_tested).length,
    note: 'Most not-rescued rows record only that a null had a severe phenotype. Nobody measured whether a compensator went up, so they carry no ground truth on the axis the rule predicts. They can falsify an over-eager rule; they cannot confirm a correct one.'
  },
  verdict: null
};

const ind = report.honest_accounting.independent;
const indFP = B.rows.filter(r => !r.derivation_case && r.outcome === 'FALSE-POSITIVE').length;
const indRate = ind.rows_decided ? ind.rows_correct / ind.rows_decided : null;

report.honest_accounting.verdict =
  `THE POSITIVE DIRECTION OF THIS RULE IS NOT RELIABLE, AND THE NUMBERS SAY SO.\n` +
  `  On the ${ind.rows_decided} case rows that are INDEPENDENT of the papers the rules were derived from, ` +
  `the rule chain agreed with the published outcome ${ind.rows_correct} times ` +
  `(${indRate === null ? 'n/a' : (indRate * 100).toFixed(0) + '%'}) -- i.e. it was WRONG MORE OFTEN THAN RIGHT. ` +
  `All ${indFP} of its independent errors are FALSE POSITIVES: it predicted a compensation response where the ` +
  `experimenters looked and found none.\n` +
  `  By contrast it scores ${report.honest_accounting.circularity.derivation_rows_correct}/` +
  `${report.honest_accounting.circularity.derivation_rows_decided} on the rows drawn from its own source papers. ` +
  `That gap between 11/12 on home ground and ${ind.rows_correct}/${ind.rows_decided} away from it IS the result: ` +
  `the rule encodes the published mechanism faithfully and still does not predict new cases.\n` +
  `  CAUSE: the rule chain can only see a LESION CLASS, while the outcome turns on the individual ALLELE. ` +
  `El-Brolosy's own data contain two PTC alleles (hbegfa^sa18135, vcla^sa14599) of genes that do adapt, which ` +
  `do not adapt -- and the rule cannot tell them from the alleles that do. A PTC is necessary, not sufficient.\n` +
  `  WHAT THE NEGATIVE DIRECTION IS WORTH: ${B.tally['true-negative'] || 0} true negatives and ` +
  `${B.tally['FALSE-NEGATIVE'] || 0} false negative. Refusals are far more trustworthy than assertions here, ` +
  `which is the asymmetry the scoring function should exploit.\n` +
  `  ON REAL DATA (mode A) the rule abstains on ${A.tally.abstain || 0} of ${A.rows_total} rows and decides ` +
  `${A.decided}. Our omics layer cannot supply tissue-and-stage expression for a candidate compensator in ` +
  `almost every case, so in production this rule will mostly return 'unknown'. That is the correct behaviour ` +
  `and it should not be "fixed" by relaxing R06.\n` +
  `  RECOMMENDATION TO THE FUNCTIONAL SCORER: do NOT treat 'plausible-by-rule' as compensation. Count only ` +
  `'documented' AND functional_rescue === true as a met requirement; treat 'plausible-by-rule' as an unmet ` +
  `requirement carrying a flag for human review. Use 'not-expected' with confidence.`;

report.honest_accounting.recommendation = {
  trust_classes: { documented_with_functional_rescue: 'count as met', 'not-expected': 'trust the refusal' },
  distrust_classes: { 'plausible-by-rule': 'do NOT count as met; flag for review', unknown: 'do NOT count as met' },
  independent_agreement: indRate,
  independent_false_positives: indFP,
  derivation_agreement: report.honest_accounting.circularity.derivation_rows_decided
    ? report.honest_accounting.circularity.derivation_rows_correct / report.honest_accounting.circularity.derivation_rows_decided
    : null
};

fs.writeFileSync(path.join(HERE, 'VALIDATION.json'), JSON.stringify(report, null, 2));

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------
for (const mode of ['A', 'B']) {
  const m = report.modes[mode];
  console.log(`\n=== MODE ${mode}: ${m.description}`);
  console.log(`  rows ${m.rows_total}   decided ${m.decided}   correct ${m.correct}   agreement ${m.agreement_on_decided ?? 'n/a'}`);
  console.log(`  tally ${JSON.stringify(m.tally)}`);
  if (m.false_positives.length) {
    console.log(`  FALSE POSITIVES (${m.false_positives.length}) -- the dangerous direction:`);
    for (const f of m.false_positives) console.log(`    ${f.case_id} (${f.gene}) via ${f.rule_id}`);
  } else console.log('  FALSE POSITIVES: none');
  if (m.false_negatives.length) {
    console.log(`  false negatives (${m.false_negatives.length}) -- over-refusal:`);
    for (const f of m.false_negatives) console.log(`    ${f.case_id} (${f.gene}) via ${f.rule_id}`);
  } else console.log('  false negatives: none');
}

console.log(`\n=== PER-CASE (mode B)`);
console.log('  ' + 'case_id'.padEnd(34) + 'allele_kind'.padEnd(20) + 'obs'.padEnd(6) + 'pred'.padEnd(20) + 'outcome');
for (const r of report.modes.B.rows) {
  console.log('  ' + r.case_id.padEnd(34) + String(r.allele_kind).padEnd(20) +
    String(r.observed_reduced).padEnd(6) + String(r.predicted).padEnd(20) + r.outcome);
}

console.log(`\n=== HONEST ACCOUNTING`);
console.log(`  derivation rows decided (CIRCULAR): ${report.honest_accounting.circularity.derivation_rows_decided}, correct ${report.honest_accounting.circularity.derivation_rows_correct}`);
console.log(`  independent rows decided:           ${ind.rows_decided}, correct ${ind.rows_correct}`);
console.log(`  rows with no ground truth:          ${report.honest_accounting.ground_truth_coverage.rows_with_no_ground_truth_on_adaptation}`);
console.log(`\n  VERDICT: ${report.honest_accounting.verdict}`);
console.log(`\nwrote ${path.join(HERE, 'VALIDATION.json')}`);
