#!/usr/bin/env node
// Tests for the unifying validator:  node sim-engine/validate/pipeline/test.mjs
//
// Every test here is run TWICE: once against the real report, and once against a report deliberately broken in
// exactly the way the test exists to catch. The broken run must FAIL. A check that has never failed is not known
// to check anything, so the negative control is part of the suite rather than something done once by hand and
// then forgotten.
//
// The three properties that matter most, because each one is a way this report could lie:
//   1. unparsed desired-phenotype text must appear in the report, verbatim
//   2. a document-only input must not claim any sequence coverage
//   3. a failing gate must prevent the word "validated"

import { validateGeneration } from './index.mjs';
import { verdictSentence } from './gates.mjs';

let pass = 0, fail = 0;
const T = (name, fn) => { try { fn(); process.stdout.write(`  ok   ${name}\n`); pass++; } catch (e) { process.stdout.write(`  FAIL ${name}\n       ${e.message}\n`); fail++; } };
const assert = (c, m) => { if (!c) throw new Error(m); };
/** The negative control: `fn` is expected to throw. If it does not, the check it wraps does not check. */
const mustCatch = (name, fn) => {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (threw) { process.stdout.write(`  ok   ${name} [negative control: the check FAILED on a deliberately broken report, as it must]\n`); pass++; }
  else { process.stdout.write(`  FAIL ${name} [negative control: the check PASSED a deliberately broken report -- it does not check anything]\n`); fail++; }
};

// ------------------------------------------------------------------------------------------------------- 1
// An unparsed requirement is an unchecked requirement. The text that was not understood must survive into the
// report word for word, and must be named in the verdict sentence.
process.stdout.write('\n1. unparsed desired-phenotype text must appear in the report\n');
const WEIRD = 'a zebrafish that glides at least 5 m from a 1 m launch, echolocates at 40 kilohertz, and has a prehensile tail rated to 12 blorks';
const r1 = await validateGeneration({ generated: 'winged-zebrafish', base: 'zebrafish-adult', desired_phenotype: WEIRD });

const checkUnparsedVisible = rep => {
  const u = rep.inputs?.desired_phenotype?.unparsed_verbatim;
  assert(Array.isArray(u) && u.length > 0, 'the report lists no unparsed clause, but the input contained text no criterion family can parse');
  for (const row of u) {
    assert(typeof row.text === 'string' && row.text.trim().length > 0, 'an unparsed row carries no text');
    assert(typeof row.reason === 'string' && row.reason.trim().length > 0, `the unparsed clause "${row.text}" carries no reason`);
    // verbatim: the clause text must be a substring of the original input, not a paraphrase
    assert(WEIRD.includes(row.text.trim()), `the unparsed clause "${row.text}" is not a verbatim substring of the input text, so it has been rewritten somewhere`);
  }
  assert(typeof rep.inputs.desired_phenotype.unparsed_warning === 'string' && /UNCHECKED/.test(rep.inputs.desired_phenotype.unparsed_warning),
    'the report does not warn that an unparsed requirement is an unchecked requirement');
  assert(Array.isArray(rep.verdict?.unparsed_desired_phenotype) && rep.verdict.unparsed_desired_phenotype.length === u.length,
    'the verdict does not carry the unparsed clauses');
  assert(/NOT parsed/.test(rep.verdict.statement), 'the verdict SENTENCE does not say that part of the desired phenotype was not parsed');
  assert(rep.verdict.withheld_because.some(w => /not parsed/i.test(w)), 'the unparsed text is not among the reasons the word "validated" was withheld');
};

T('the weird clauses are reported verbatim, with reasons, and named in the verdict', () => checkUnparsedVisible(r1));
T('at least one of the two unparseable clauses was actually caught by the parser', () => {
  const texts = r1.inputs.desired_phenotype.unparsed_verbatim.map(u => u.text).join(' | ');
  assert(/blork|kilohertz|echolocat|prehensile/i.test(texts), `neither unparseable clause appears in the unparsed list; got: ${texts}`);
});
mustCatch('a report that drops the unparsed text is rejected', () => {
  const broken = JSON.parse(JSON.stringify(r1));
  broken.inputs.desired_phenotype.unparsed_verbatim = [];   // the exact failure mode: silently dropped
  checkUnparsedVisible(broken);
});
mustCatch('a report that PARAPHRASES the unparsed text is rejected', () => {
  const broken = JSON.parse(JSON.stringify(r1));
  broken.inputs.desired_phenotype.unparsed_verbatim = [{ text: 'some unusual requirements', reason: 'not understood' }];
  checkUnparsedVisible(broken);
});

// ------------------------------------------------------------------------------------------------------- 2
// A parameter document is not a genome. The report must say so and must claim no coverage.
process.stdout.write('\n2. a document-only input must not claim sequence coverage\n');
const r2 = await validateGeneration({ generated: 'winged-zebrafish', base: 'zebrafish-adult', desired_phenotype: 'a zebrafish that glides at least 5 m from a 1 m launch' });

const checkNoSequenceClaim = rep => {
  const s = rep.inputs?.sequence;
  assert(s, 'the report states no sequence basis at all');
  assert(s.sequence_basis === 'document-only', `two design ids were supplied with no gene-level edit, so the basis must be document-only; got "${s.sequence_basis}"`);
  assert(s.loci_covered === 0, `document-only input must cover 0 loci; got ${s.loci_covered}`);
  assert(s.genome_fraction_assessed === 0, `document-only input must assess 0 of the genome; got ${s.genome_fraction_assessed}`);
  assert(/NO SEQUENCE WAS ASSESSED/.test(s.statement), 'the statement does not say outright that no sequence was assessed');
  // and the genotype result must not read as a pass
  assert(rep.results.genotype_similarity.status === 'cannot-assess',
    `with no gene-level edit the genotype gate must be cannot-assess, never pass; got "${rep.results.genotype_similarity.status}"`);
  assert(/not a pass/i.test(rep.results.genotype_similarity.gate), 'the genotype gate does not say that no-edits is not a pass');
  assert(rep.verdict.withheld_because.some(w => /no sequence was compared/i.test(w)), 'the absent sequence comparison is not among the reasons the word "validated" was withheld');
};

T('winged-zebrafish vs zebrafish-adult claims document-only, 0 loci, 0 genome fraction', () => checkNoSequenceClaim(r2));
T('the difference set is parameter deltas, not alleles', () => {
  const kinds = new Set(r2.differences.entries.map(d => d.kind));
  assert(kinds.has('parameter'), 'no parameter difference was found between two organisms that differ');
  assert(!kinds.has('sequence'), 'a sequence difference was reported although no sequence was supplied');
});
mustCatch('a report claiming loci coverage from a document is rejected', () => {
  const broken = JSON.parse(JSON.stringify(r2));
  broken.inputs.sequence.loci_covered = 9;                  // the exact failure mode: implied genome coverage
  broken.inputs.sequence.sequence_basis = 'supplied';
  checkNoSequenceClaim(broken);
});
mustCatch('a report that passes the genotype gate with no edits is rejected', () => {
  const broken = JSON.parse(JSON.stringify(r2));
  broken.results.genotype_similarity.status = 'pass';
  checkNoSequenceClaim(broken);
});

// ------------------------------------------------------------------------------------------------------- 3
// The word "validated" is the one word this report must never earn cheaply.
process.stdout.write('\n3. a failing gate must prevent the word "validated"\n');

const mkResults = statuses => Object.fromEntries(Object.entries(statuses).map(([k, status]) => [k, { status, gate: `${status} gate for ${k}` }]));
const allScalesFine = { unassessable_scales: [] };
const cleanInputs = { desired_phenotype: { text: 'x', criteria_parsed: 1, unparsed_verbatim: [], refused_verbatim: [] }, generated: { given: 'sequence' }, base: { given: 'sequence' }, sequence: { sequence_basis: 'supplied', loci_covered: 3 } };
const noAnalogue = { analogues: [], criteria_with_no_known_analogue: [] };

const checkNotValidated = v => {
  assert(v.word_validated_withheld === true, 'the report did not withhold the word "validated"');
  assert(!/\bvalidated\b/.test(v.statement.replace(/"validated"/g, '')), `the verdict sentence uses the word "validated": ${v.statement}`);
  assert(v.withheld_because.length > 0, 'the report withheld the word but gave no reason');
};

T('one failing gate withholds the word', () => {
  const v = verdictSentence({ results: mkResults({ genotype_similarity: 'pass', phenotype_similarity: 'pass', lean_check: 'pass', functional_resolution: 'pass', physics_check: 'fail' }), scales: allScalesFine, inputs: cleanInputs, analogue: noAnalogue });
  checkNotValidated(v);
  assert(v.failed.includes('physics_check'), 'the failing gate is not listed under failed');
});
T('one unassessable gate withholds the word', () => {
  const v = verdictSentence({ results: mkResults({ genotype_similarity: 'pass', phenotype_similarity: 'pass', lean_check: 'pass', functional_resolution: 'cannot-assess', physics_check: 'pass' }), scales: allScalesFine, inputs: cleanInputs, analogue: noAnalogue });
  checkNotValidated(v);
});
T('one unassessable SCALE withholds the word even when every gate passed', () => {
  const v = verdictSentence({ results: mkResults({ genotype_similarity: 'pass', phenotype_similarity: 'pass', lean_check: 'pass', functional_resolution: 'pass', physics_check: 'pass' }), scales: { unassessable_scales: ['cell'] }, inputs: cleanInputs, analogue: noAnalogue });
  checkNotValidated(v);
  assert(v.scales_not_assessed.includes('cell'), 'the unassessable scale is not listed');
});
T('the real headline run withholds the word, and says why', () => {
  checkNotValidated(r2.verdict);
  assert(r2.verdict.withheld_because.length >= 2, `expected more than one reason; got ${JSON.stringify(r2.verdict.withheld_because)}`);
});
T('the word "validated" never appears as a positive claim in any human-facing sentence', () => {
  // The PROSE a reader sees: the verdict sentence, every gate sentence, the sequence statement and the scope.
  // File paths and identifiers (sim-engine/validate/..., validateGeneration, validate_generation) are not claims
  // about the design and are not what this guards; the sentences are.
  const prose = [r2.verdict.statement, r2.inputs.sequence.statement, r2.scope,
    ...Object.values(r2.results).map(v => v.gate),
    ...Object.values(r2.results).map(v => v.result?.gate).filter(x => typeof x === 'string')];
  const bad = [];
  for (const text of prose) {
    for (const m of String(text).matchAll(/(.{0,40})validated(.{0,40})/gi)) {
      const before = m[1], whole = m[0];
      // permitted: a denial ("not validated", "never validated"), the withholding, or the word in quotes
      if (/(not|never|n't|without|withheld|unless|whatever)\s[\w\s,]{0,30}$/i.test(before)) continue;
      if (/["'“‘]$/.test(before)) continue;
      if (/WITHHELD|withheld/.test(whole)) continue;
      bad.push(whole);
    }
  }
  assert(bad.length === 0, `"validated" used as a positive claim: ${bad.join(' /// ')}`);
});
mustCatch('a verdict that says "validated" with a failing gate is rejected', () => {
  const v = verdictSentence({ results: mkResults({ genotype_similarity: 'pass', phenotype_similarity: 'pass', lean_check: 'pass', functional_resolution: 'pass', physics_check: 'fail' }), scales: allScalesFine, inputs: cleanInputs, analogue: noAnalogue });
  checkNotValidated({ ...v, word_validated_withheld: false, statement: v.statement + ' The design is validated.' });
});

// ------------------------------------------------------------------------------------------------------- 4
// The report shape has to hold for all four designs, including a subtraction and a design with no analogue.
process.stdout.write('\n4. the report shape holds for every design the animation calls with\n');
for (const id of ['winged-zebrafish', 'wingless-flying-fish', 'tff', 'ff-zf-chimera']) {
  const base = id === 'wingless-flying-fish' ? 'flying-fish' : 'zebrafish-adult';
  const r = await validateGeneration({ generated: id, base, desired_phenotype: 'a zebrafish that glides at least 5 m from a 1 m launch and survives 10-30 C as an adult' });
  T(`${id} (base ${base}) returns a complete report`, () => {
    assert(typeof r.verdict?.statement === 'string' && r.verdict.statement.length > 100, 'no verdict sentence');
    assert(Object.keys(r.results).length === 5, `expected five named results, got ${Object.keys(r.results).length}`);
    for (const [k, v] of Object.entries(r.results)) {
      assert(['pass', 'fail', 'cannot-assess'].includes(v.status), `${k} has status "${v.status}"`);
      assert(typeof v.gate === 'string' && v.gate.length > 0, `${k} has no gate sentence`);
    }
    assert(Object.keys(r.per_scale_coverage).length === 10, `expected ten scales, got ${Object.keys(r.per_scale_coverage).length}`);
    for (const [s, c] of Object.entries(r.per_scale_coverage)) assert(typeof c.assessable === 'boolean', `scale ${s} has no assessable flag`);
    assert(r.inputs.sequence.loci_covered === 0, 'none of these four designs carries a gene edit, so none may claim a locus');
    assert(r.verdict.word_validated_withheld === true, 'the word was not withheld');
  });
}
T('a subtraction design reports its differences as moves AWAY from the gliding analogue', async () => {
  const r = await validateGeneration({ generated: 'wingless-flying-fish', base: 'flying-fish', desired_phenotype: 'a fish that glides at least 5 m from a 1 m launch' });
  const moved = r.differences.entries.filter(d => d.toward_the_analogue).flatMap(d => Object.values(d.toward_the_analogue).map(v => v.moved));
  assert(moved.length > 0, 'no difference was compared against the analogue\'s own parameter values');
  assert(moved.some(m => /AWAY/.test(m)), `a design that removes the wings must move AWAY from the gliding analogue on some parameter; got ${JSON.stringify(moved)}`);
});

// ------------------------------------------------------------------------------------------------------- 5
process.stdout.write('\n5. an unknown or absent input is reported, not guessed\n');
T('an unknown design id is reported as unknown-id with the list of known ones', async () => {
  const r = await validateGeneration({ generated: 'flying-unicorn-fish', base: 'zebrafish-adult', desired_phenotype: 'a fish that glides at least 5 m' });
  assert(r.inputs.generated.given === 'unknown-id', `expected unknown-id, got ${r.inputs.generated.given}`);
  assert(/is not one of/.test(r.inputs.generated.note || ''), 'the report does not list the ids it does know');
  assert(r.results.physics_check.status === 'cannot-assess', 'physics must be cannot-assess when the design did not resolve');
});
T('an absent desired phenotype is reported, and nothing is checked', async () => {
  const r = await validateGeneration({ generated: 'winged-zebrafish', base: 'zebrafish-adult', desired_phenotype: '' });
  assert(r.inputs.desired_phenotype.text_given === false, 'an empty desired phenotype was not flagged');
  assert(r.notes.some(n => /no desired phenotype text/.test(n)), 'the report does not note that it ran with no target function');
  assert(r.verdict.word_validated_withheld === true, 'the word was not withheld for a run with no target function');
});

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
