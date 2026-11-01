#!/usr/bin/env node
// Builds pipeline/leanbio/out/round2-scorecard.json from (a) the pipeline's machine triage over all
// 941 records and (b) the 51 hand adjudications in adjudication.json. The two tiers are reported
// separately: tier 1 is a regex type whose precision has never been measured, tier 2 is a judgement
// on records read in full. Nothing outside tier 2 is claimed to be adjudicated.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const recs = read('pipeline/leanbio/out/records.json').records;
const adj = read('pipeline/leanbio/lean/round2/adjudication.json');
const laws = fs.readdirSync(path.join(ROOT, 'lean/registry/laws')).filter(f => f.endsWith('.json')).map(f => read('lean/registry/laws/' + f));

// ---- tier 1: machine triage over every record
const byFormalizable = {}, byRelation = {}, bySource = {};
for (const r of recs) {
  const f = (r.statement && r.statement.formalizable) || 'none';
  byFormalizable[f] = (byFormalizable[f] || 0) + 1;
  const t = (r.statement && r.statement.type) || 'none';
  byRelation[t] = (byRelation[t] || 0) + 1;
  const src = /^darwin/.test(r.id) ? 'darwin-origin' : /^thompson/.test(r.id) ? 'thompson-growth-form'
    : /^wolfram/.test(r.id) ? 'wolfram-nks' : r.origin === 'draft' ? 'thread draft' : 'math-bio-theorems or other claim';
  bySource[src] = (bySource[src] || 0) + 1;
}

// ---- tier 2: the hand adjudications
const tier2 = { FORMALISABLE_NOW: [], NEEDS_A_MISSING_CONSTANT: [], NOT_FORMALISABLE: [] };
const reasons = {};
for (const v of adj.records) {
  tier2[v.verdict.replace(/-/g, '_')].push({ id: v.id, reason: v.reason, outcome: v.outcome });
  if (v.verdict === 'NOT-FORMALISABLE') {
    const kind = (/^(vague-predicate|no-quantity|purely-historical|untestable-as-stated|methodological|duplicate-of-existing-law)/.exec(v.reason) || ['unclassified'])[0];
    reasons[kind] = (reasons[kind] || 0) + 1;
  }
}

// ---- outcomes of the formalisable ones: the honest denominator
const outcome = {};
for (const v of adj.records) {
  const k = /^PROPOSED round 2/.test(v.outcome) ? 'proposed this round (candidate)'
    : v.outcome === 'already-a-law' ? 'already in the registry'
    : /^WRITTEN BUT NOT PROPOSED/.test(v.outcome) ? 'written, not proposed (open question)'
    : /^abandoned/.test(v.outcome) ? 'abandoned with a reason'
    : 'declined (recorded in proposals.json)';
  outcome[k] = (outcome[k] || 0) + 1;
}

// ---- round-2 laws, and whether each binds anything
const mine = laws.filter(l => (l.origin || {}).by_role === 'agent:leanbio-discovery-2');
const binding = { binds_a_design_property_we_have: [], evaluable_but_inputs_unsuppliable: [], no_rule_out_direction: [] };
const SUPPLIABLE = new Set(['development-growth-asymptote']);
for (const l of mine) {
  if (!l.browser_check) binding.no_rule_out_direction.push(l.law_id);
  else if (SUPPLIABLE.has(l.law_id)) binding.binds_a_design_property_we_have.push(l.law_id);
  else binding.evaluable_but_inputs_unsuppliable.push(l.law_id);
}

const out = {
  version: 'leanbio-round2-scorecard/0.1.0',
  generated: new Date().toISOString(),
  generated_by_role: 'agent:leanbio-discovery-2',
  lawset_proposed_against: '1.7.0',
  tier1_machine_triage: {
    what_it_is: 'the pipeline\'s regex relation vocabulary (leanbio-relations/0.1.0) applied to every record. A TYPE, not a judgement; its precision has never been measured and the known failure is a hedge firing a law type.',
    records: recs.length,
    by_formalizable_field: byFormalizable,
    by_relation_type: byRelation,
    by_source: bySource,
  },
  tier2_hand_adjudication: {
    what_it_is: adj.method,
    adjudicated: adj.records.length,
    not_adjudicated: recs.length - adj.records.length,
    counts: {
      'FORMALISABLE-NOW': tier2.FORMALISABLE_NOW.length,
      'NEEDS-A-MISSING-CONSTANT': tier2.NEEDS_A_MISSING_CONSTANT.length,
      'NOT-FORMALISABLE': tier2.NOT_FORMALISABLE.length,
    },
    not_formalisable_by_reason: reasons,
    outcomes_of_the_adjudicated: outcome,
    records: adj.records,
  },
  round2_laws: {
    candidates: mine.length,
    ids: mine.map(l => ({ law_id: l.law_id, version: l.version, status: l.status, constraint: (l.constraints || [])[0] || null })),
    binding_reality: binding,
    note: 'A law that is a candidate is not a law that binds. The three buckets above are the point of this scorecard: 1 of 8 constrains a design property the engine actually supplies, 6 are well-formed rows waiting for inputs nothing in sim-engine produces, and 1 has no rule-out direction at all and was deliberately given no row.',
  },
};
fs.writeFileSync(path.join(ROOT, 'pipeline/leanbio/out/round2-scorecard.json'), JSON.stringify(out, null, 1) + '\n');
console.log('tier1 records', recs.length, '| tier1 formalizable', byFormalizable);
console.log('tier2 adjudicated', adj.records.length, out.tier2_hand_adjudication.counts);
console.log('not-formalisable reasons', reasons);
console.log('outcomes', outcome);
console.log('round2 candidates', mine.length, binding);
