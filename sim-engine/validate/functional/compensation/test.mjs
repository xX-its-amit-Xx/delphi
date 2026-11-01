/**
 * compensation/test.mjs  --  node sim-engine/validate/functional/compensation/test.mjs
 *
 * The three tests the brief demands, plus the invariant that keeps this module honest.
 * Run with --prove-it to check each test can actually FAIL (it mutates inputs that should
 * flip the verdict, and complains if the verdict does not flip).
 */

import { compensationVerdict, resolveAlleleKind, casesForGene, RULES, CASES } from './classify.mjs';

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; failures.push({ name, detail }); console.log(`  FAIL  ${name}\n        ${detail}`); }
}
function section(s) { console.log(`\n${s}`); }

// Fixtures ------------------------------------------------------------------

const PECTORAL_FIN = { anatomy: { id: 'ZFA:0001161', label: 'pectoral fin', uberon: 'UBERON:0000151' },
                       stage: { id: 'ZFS:0000037', label: 'Hatching:Long-pec' } };

/** An expression block shaped like the omics transcriptomic layer. */
function expressedIn(sym, anatomy, stages) {
  return { required: PECTORAL_FIN, byGene: { [sym]: {
    expressed_in: [{ label: anatomy.label, anatomy, stages, sources: ['ZFIN', 'Bgee'], kind: ['curated', 'measured'] }],
    not_expressed_in: [], expression_level: []
  } } };
}
function notExpressedIn(sym, anatomy) {
  return { required: PECTORAL_FIN, byGene: { [sym]: {
    expressed_in: [], not_expressed_in: [{ label: anatomy.label, anatomy, stages: [], sources: ['Bgee'], kind: ['measured'] }],
    expression_level: []
  } } };
}

// ---------------------------------------------------------------------------
section('TEST 1 -- a MISSENSE allele must NOT be classed compensable');
// ---------------------------------------------------------------------------
{
  // The hostile case: everything else is maximally favourable. Real paralogue, high identity,
  // expressed in exactly the required tissue and stage. Only the allele kind refuses.
  const v = compensationVerdict({
    gene: 'vcla',
    alleleKind: 'missense',
    paralogues: [{ symbol: 'vclb', identity_pct: 85.7143, type: 'within_species_paralog' }],
    expression: expressedIn('vclb', PECTORAL_FIN.anatomy, ['Hatching:Long-pec']),
    requirement: PECTORAL_FIN,
    organism: 'Danio rerio'
  });
  check('missense is not "documented"', v.class !== 'documented', `got ${v.class}`);
  check('missense is not "plausible-by-rule"', v.class !== 'plausible-by-rule', `got ${v.class} via ${v.rule_id}`);
  check('missense transcriptional adaptation is refused by R03',
    v.rule_id === 'R03-MISSENSE-NOT-EXPECTED' || v.transcriptional_adaptation?.rule_id === 'R03-MISSENSE-NOT-EXPECTED',
    `rule_id=${v.rule_id}, ta=${JSON.stringify(v.transcriptional_adaptation)}`);

  // And the stricter form: even with NO paralogue path available, missense must be a refusal.
  const v2 = compensationVerdict({
    gene: 'vcla', alleleKind: 'missense', paralogues: [], requirement: PECTORAL_FIN, organism: 'Danio rerio'
  });
  check('missense with no compensator asserted is "not-expected"', v2.class === 'not-expected', `got ${v2.class}`);

  // In-frame and synonymous travel with missense.
  for (const k of ['in-frame-deletion', 'synonymous', 'start-loss']) {
    const vk = compensationVerdict({ gene: 'vcla', alleleKind: k, paralogues: [], requirement: PECTORAL_FIN });
    check(`'${k}' is also not compensable`, vk.class === 'not-expected', `got ${vk.class}`);
  }
}

// ---------------------------------------------------------------------------
section('TEST 2 -- a DOCUMENTED case must be recovered');
// ---------------------------------------------------------------------------
{
  const v = compensationVerdict({
    gene: 'vcla', alleleKind: 'frameshift',
    paralogues: [{ symbol: 'vclb', identity_pct: 85.7143 }],
    expression: expressedIn('vclb', PECTORAL_FIN.anatomy, ['Hatching:Long-pec']),
    requirement: PECTORAL_FIN, organism: 'Danio rerio'
  });
  check('vcla frameshift is "documented"', v.class === 'documented', `got ${v.class} via ${v.rule_id}`);
  check('it came from the case-table rule', v.rule_id === 'R09-DOCUMENTED-CASE-LOOKUP', `got ${v.rule_id}`);
  check('it names the mechanism', v.kind === 'transcriptional-adaptation', `got ${v.kind}`);
  check('it names at least one source', (v.evidence || []).length > 0, 'evidence[] empty');
  check('its source resolves to a real citation with an identifier',
    (v.evidence || []).some(e => e.citation && (e.pmid || e.pmcid || e.doi)),
    JSON.stringify((v.evidence || []).map(e => e.src)));
  check('it carries the vclb compensator', JSON.stringify(v.case?.compensator || []).includes('vclb'),
    JSON.stringify(v.case?.compensator));

  // egfl7: documented AND phenotypically rescued.
  const e = compensationVerdict({ gene: 'egfl7', alleleKind: 'frameshift', requirement: PECTORAL_FIN, organism: 'Danio rerio' });
  check('egfl7 frameshift is "documented"', e.class === 'documented', `got ${e.class}`);
  check('egfl7 is recorded as functionally rescued', e.functional_rescue === true, `got ${e.functional_rescue}`);
}

// ---------------------------------------------------------------------------
section('TEST 3 -- MISSING expression data must yield "unknown", never "plausible"');
// ---------------------------------------------------------------------------
{
  // A decay-triggering allele, a real high-identity paralogue -- and no expression evidence.
  // This is precisely the input shape that would let hope masquerade as a rule.
  const v = compensationVerdict({
    gene: 'kcnk5b', alleleKind: 'nonsense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72.0 }],
    expression: null, requirement: PECTORAL_FIN, organism: 'Danio rerio'
  });
  check('missing expression yields "unknown"', v.class === 'unknown', `got ${v.class} via ${v.rule_id}`);
  check('it is NOT "plausible-by-rule"', v.class !== 'plausible-by-rule', `got ${v.class}`);
  check('it says which input was missing', (v.inputs_missing || []).includes('expression'),
    JSON.stringify(v.inputs_missing));

  // Paralogue present and expressed in the WRONG tissue -> still not a pass.
  const v2 = compensationVerdict({
    gene: 'kcnk5b', alleleKind: 'nonsense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72.0 }],
    expression: expressedIn('kcnk5a', { id: 'ZFA:0000008', label: 'brain', uberon: 'UBERON:0000955' }, ['Adult']),
    requirement: PECTORAL_FIN, organism: 'Danio rerio'
  });
  check('expressed in the wrong tissue yields "unknown", not a pass', v2.class === 'unknown', `got ${v2.class}`);

  // Right tissue, WRONG stage -> still unknown. Stage is a real condition, not decoration.
  const v3 = compensationVerdict({
    gene: 'kcnk5b', alleleKind: 'nonsense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72.0 }],
    expression: expressedIn('kcnk5a', PECTORAL_FIN.anatomy, ['Adult']),
    requirement: PECTORAL_FIN, organism: 'Danio rerio'
  });
  check('right tissue but wrong stage yields "unknown"', v3.class === 'unknown', `got ${v3.class}`);

  // Missing paralogues (not asserted empty) must also be unknown, because our rows are asymmetric.
  const v4 = compensationVerdict({ gene: 'kcnk5b', alleleKind: 'nonsense', requirement: PECTORAL_FIN });
  check('missing paralogue list yields "unknown", not "not-expected"', v4.class === 'unknown', `got ${v4.class}`);

  // Unresolvable allele kind -> unknown.
  const v5 = compensationVerdict({ gene: 'kcnk5b', alleleKind: 'something-nobody-defined', requirement: PECTORAL_FIN });
  check('unresolvable allele kind yields "unknown"', v5.class === 'unknown', `got ${v5.class}`);
  const v6 = compensationVerdict({ gene: 'kcnk5b', alleleKind: null });
  check('null allele kind yields "unknown"', v6.class === 'unknown', `got ${v6.class}`);
}

// ---------------------------------------------------------------------------
section('TEST 4 -- the rule must be able to say "not-expected" CONFIDENTLY');
// ---------------------------------------------------------------------------
{
  const absent = compensationVerdict({
    gene: 'shha', alleleKind: 'gene-absent', paralogues: [], requirement: PECTORAL_FIN, organism: 'Danio rerio'
  });
  check('an absent gene with no compensator is "not-expected"', absent.class === 'not-expected', `got ${absent.class}`);

  const mo = compensationVerdict({ gene: 'egfl7', alleleKind: 'morpholino', requirement: PECTORAL_FIN });
  check('a morpholino knockdown is "not-expected"', mo.class === 'not-expected', `got ${mo.class} via ${mo.rule_id}`);
  check('and it is refused by R04', mo.rule_id === 'R04-KNOCKDOWN-NOT-ADAPTATION', `got ${mo.rule_id}`);

  const crispri = compensationVerdict({ gene: 'egfl7', alleleKind: 'crispri', requirement: PECTORAL_FIN });
  check('CRISPRi is "not-expected"', crispri.class === 'not-expected', `got ${crispri.class}`);

  const neg = compensationVerdict({
    gene: 'kcnk5b', alleleKind: 'nonsense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72.0 }],
    expression: notExpressedIn('kcnk5a', PECTORAL_FIN.anatomy),
    requirement: PECTORAL_FIN, organism: 'Danio rerio'
  });
  check('an asserted not_expressed_in compensator is "not-expected"', neg.class === 'not-expected', `got ${neg.class}`);
  check('and it is refused by R06', neg.rule_id === 'R06-PARALOGUE-MUST-BE-EXPRESSED', `got ${neg.rule_id}`);

  // A documented ABSENCE of compensation must be a refusal, not an unknown.
  const rnaless = compensationVerdict({ gene: 'vegfaa', alleleKind: 'promoter-deletion', requirement: PECTORAL_FIN });
  check('vegfaa promoter-less is "not-expected" from the case table', rnaless.class === 'not-expected', `got ${rnaless.class}`);
}

// ---------------------------------------------------------------------------
section('TEST 5 -- R07: documented adaptation must NOT be reported as a met requirement');
// ---------------------------------------------------------------------------
{
  const v = compensationVerdict({ gene: 'vegfaa', alleleKind: 'frameshift', requirement: PECTORAL_FIN, organism: 'Danio rerio' });
  check('vegfaa frameshift is "documented"', v.class === 'documented', `got ${v.class}`);
  check('but functional_rescue is FALSE', v.functional_rescue === false, `got ${v.functional_rescue}`);
  check('and r07_applies is set', v.r07_applies === true, `got ${v.r07_applies}`);
  check('and the why says so out loud', /not be scored as a met requirement/i.test(v.why), v.why.slice(0, 160));

  const ttn = compensationVerdict({ gene: 'ttna', alleleKind: 'nonsense', requirement: PECTORAL_FIN });
  check('ttna (protein-level compensation, not rescued) is not a pass',
    ttn.class !== 'plausible-by-rule' && ttn.functional_rescue !== true, `got ${ttn.class} / ${ttn.functional_rescue}`);
}

// ---------------------------------------------------------------------------
section('TEST 6 -- the honesty invariant: no asserted compensation without a resolved source');
// ---------------------------------------------------------------------------
{
  let threw = false;
  // Every rule that can produce an asserting class must have resolvable sources.
  const asserting = ['R09-DOCUMENTED-CASE-LOOKUP', 'R02-DECAY-TRIGGER-REQUIRED',
                     'R06-PARALOGUE-MUST-BE-EXPRESSED', 'R08-PROTEIN-FEEDBACK-IS-A-DIFFERENT-MECHANISM'];
  for (const id of asserting) {
    const r = RULES.rules.find(x => x.rule_id === id);
    const resolvable = (r.sources || []).filter(s => RULES.sources[s.src]);
    check(`${id} has at least one resolvable source`, resolvable.length > 0,
      `sources: ${JSON.stringify((r.sources || []).map(s => s.src))}`);
  }
  // Every src referenced anywhere must resolve.
  const unresolved = new Set();
  JSON.stringify(RULES).replace(/"src":"([^"]+)"/g, (m, s) => { if (!RULES.sources[s]) unresolved.add(s); return m; });
  check('every src in compensation-rules.json resolves', unresolved.size === 0, [...unresolved].join(', '));

  // Every asserting verdict carries a quote-bearing locator somewhere in evidence.
  const d = compensationVerdict({ gene: 'vcla', alleleKind: 'frameshift',
    paralogues: [{ symbol: 'vclb', identity_pct: 85.7 }],
    expression: expressedIn('vclb', PECTORAL_FIN.anatomy, ['Hatching:Long-pec']), requirement: PECTORAL_FIN });
  check('a documented verdict carries at least one verbatim quote',
    (d.evidence || []).some(e => e.quote && e.quote.length > 20), 'no quote in evidence[]');
  check('a documented verdict carries counter-evidence too',
    (d.counter_evidence || []).length > 0, 'counter_evidence[] empty');
}

// ---------------------------------------------------------------------------
section('TEST 7 -- data integrity of the case table');
// ---------------------------------------------------------------------------
{
  check('the case table has both directions',
    CASES.cases.some(c => c.adaptation === true) && CASES.cases.some(c => c.phenotype_rescued === false),
    'one direction missing');
  const noAves = !/\b(aves|bird|chicken|gallus|zebra finch|taeniopygia|columba)\b/i.test(JSON.stringify(CASES) + JSON.stringify(RULES));
  check('no Aves data anywhere in the rule base or case table', noAves, 'an Aves term appears');
  const noCreds = !/(api[_-]?key|secret|password|bearer\s|ghp_|sk-)/i.test(JSON.stringify(CASES) + JSON.stringify(RULES));
  check('no credentials in the data files', noCreds, 'a credential-shaped string appears');
  check('every case row names its evidence',
    CASES.cases.every(c => Array.isArray(c.evidence) && c.evidence.length > 0),
    CASES.cases.filter(c => !c.evidence?.length).map(c => c.case_id).join(', '));
  check('vcla resolves in the case table', casesForGene('vcla').length > 0, 'not found');
  check('allele kinds in case rows all resolve',
    CASES.cases.every(c => resolveAlleleKind(c.allele_kind) !== null),
    CASES.cases.filter(c => !resolveAlleleKind(c.allele_kind)).map(c => `${c.case_id}:${c.allele_kind}`).join(', '));
}

// ---------------------------------------------------------------------------
// --prove-it : show that each test CAN fail, so a green run means something
// ---------------------------------------------------------------------------
if (process.argv.includes('--prove-it')) {
  section('PROVE-IT -- flipping each decisive input must flip the verdict');
  const fin = PECTORAL_FIN;

  // T1 proof: change ONLY the allele kind from missense to nonsense; the refusal must lift.
  const a = compensationVerdict({ gene: 'kcnk5b', alleleKind: 'missense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72 }],
    expression: expressedIn('kcnk5a', fin.anatomy, ['Hatching:Long-pec']), requirement: fin });
  const b = compensationVerdict({ gene: 'kcnk5b', alleleKind: 'nonsense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72 }],
    expression: expressedIn('kcnk5a', fin.anatomy, ['Hatching:Long-pec']), requirement: fin });
  check('PROOF T1: allele kind alone changes the verdict (missense vs nonsense)',
    a.class !== b.class, `missense=${a.class}, nonsense=${b.class} -- if equal, TEST 1 proves nothing`);

  // T3 proof: adding expression alone must change unknown -> plausible.
  const c = compensationVerdict({ gene: 'kcnk5b', alleleKind: 'nonsense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72 }], expression: null, requirement: fin });
  check('PROOF T3: expression data alone changes the verdict',
    c.class === 'unknown' && b.class === 'plausible-by-rule',
    `without expression=${c.class}, with expression=${b.class} -- if equal, TEST 3 proves nothing`);

  // T4 proof: not_expressed_in alone must change unknown -> not-expected.
  const d = compensationVerdict({ gene: 'kcnk5b', alleleKind: 'nonsense',
    paralogues: [{ symbol: 'kcnk5a', identity_pct: 72 }],
    expression: notExpressedIn('kcnk5a', fin.anatomy), requirement: fin });
  check('PROOF T4: an asserted absence of expression is distinguishable from no data',
    d.class === 'not-expected' && c.class === 'unknown',
    `not_expressed=${d.class}, no_data=${c.class} -- these must NOT be the same class`);

  // T2 proof: a gene absent from the case table must not come back "documented".
  const e = compensationVerdict({ gene: 'a-gene-that-does-not-exist', alleleKind: 'frameshift',
    paralogues: [{ symbol: 'nope', identity_pct: 90 }],
    expression: expressedIn('nope', fin.anatomy, ['Hatching:Long-pec']), requirement: fin });
  check('PROOF T2: an unlisted gene is never "documented"', e.class !== 'documented', `got ${e.class}`);

  // T6 proof: the invariant actually throws when a rule has no resolvable source.
  const saved = RULES.sources;
  let didThrow = false;
  try {
    RULES.sources = {}; // every src now unresolvable
    compensationVerdict({ gene: 'vcla', alleleKind: 'frameshift',
      paralogues: [{ symbol: 'vclb', identity_pct: 85.7 }],
      expression: expressedIn('vclb', fin.anatomy, ['Hatching:Long-pec']), requirement: fin });
  } catch { didThrow = true; } finally { RULES.sources = saved; }
  check('PROOF T6: the honesty invariant throws when sources cannot be resolved', didThrow,
    'it did NOT throw -- the invariant is decorative and TEST 6 proves nothing');
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(64)}`);
console.log(`pass ${pass}   fail ${fail}`);
if (fail) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
}
process.exit(fail ? 1 : 0);
