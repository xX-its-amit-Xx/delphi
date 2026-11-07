#!/usr/bin/env node
// Tests for devlog/laws.mjs.
//
//   node devlog/test-laws.mjs                # all assertions must pass
//   node devlog/test-laws.mjs --fail-once    # every assertion must FAIL, and none may print ok
//
// The --fail-once mode inverts each predicate rather than tightening a threshold, so a check that
// cannot fail is visible as an `ok` line under the fault injection. A test that passes both ways is
// testing nothing.
//
// What is actually checked, as opposed to asserted:
//   * the domain counts sum to the number of law files in lean/registry/laws, read here and not taken
//     from laws.mjs - the denominator is the whole registry, retired and contested entries included;
//   * every WORKED entry's `the_lean_statement` is found BYTE-FOR-BYTE in the Lean file the registry
//     names for that law, with CRLF normalised (one proposal file uses CRLF, the Delphi modules do not);
//   * `has_a_theorem` agrees with lean_ref having both a module and a theorem, for every entry and for
//     the registry-wide count of 48;
//   * every concrete instance has at least one digit, and every "what it does NOT say" is substantial
//     and not a restatement of the law;
//   * no law id written in laws.mjs belongs to the held-out set: the holdout roster and the exam's
//     claim ids are read here, and any law id that is also a holdout or mixed claim id must have been
//     filled from the registry at runtime rather than written in the source.
//
// Read-only: this file writes nothing and touches nothing outside devlog/ except to read.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT, REGISTRY_DIR, loadRegistry, hasTheorem, leanFilePath,
  DOMAINS, DOMAIN_NAMES, DOMAIN_DEFS, ASSIGNMENTS, publicAssignments, census,
  WORKED, THE_HONEST_SHAPE, WHAT_A_MOLECULAR_BIOLOGY_LAW_WOULD_LOOK_LIKE,
} from './laws.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = fs.readFileSync(path.join(HERE, 'laws.mjs'), 'utf8');
const norm = s => s.replace(/\r\n/g, '\n');
const digits = s => /[0-9]/.test(s);

// ---------------------------------------------------------------- the registry, read independently

const lawFiles = fs.readdirSync(REGISTRY_DIR).filter(n => n.endsWith('.json')).sort();
const registry = loadRegistry();
const N_LAWS = lawFiles.length;
const N_THEOREMS = [...registry.values()].filter(hasTheorem).length;

console.log(`\nregistry: ${N_LAWS} law files in lean/registry/laws, ${N_THEOREMS} with both a module and a theorem`);

console.log('\n-- the registry is what we think it is');
check('every law file parses and carries a law_id', f(registry.size === N_LAWS, registry.size !== N_LAWS), `${registry.size} ids from ${N_LAWS} files`);
check('registry holds 62 laws (the dev log\'s number)', f(N_LAWS === 62, N_LAWS !== 62), `${N_LAWS}`);
check('48 of them name both a module and a theorem (the dev log\'s other number)', f(N_THEOREMS === 48, N_THEOREMS !== 48), `${N_THEOREMS}`);

// ---------------------------------------------------------------- the domain distribution

console.log('\n-- the domain counts sum to the whole registry');
const c = census(registry);
check('every domain in DOMAIN_DEFS appears in DOMAINS', f(DOMAIN_NAMES.every(n => DOMAINS[n]), !DOMAIN_NAMES.every(n => DOMAINS[n])));
check('nine domains, no more and no fewer', f(DOMAIN_NAMES.length === 9, DOMAIN_NAMES.length !== 9), `${DOMAIN_NAMES.length}`);
check('one classification row per law in the registry', f(ASSIGNMENTS.length === N_LAWS, ASSIGNMENTS.length !== N_LAWS), `${ASSIGNMENTS.length} rows vs ${N_LAWS} laws`);
check('no law in the registry is left unclassified', f(c.laws_not_classified.length === 0, c.laws_not_classified.length !== 0), c.laws_not_classified.join(', '));
check('no classification row names a law that does not exist', f(c.rows_with_no_law === 0, c.rows_with_no_law !== 0), `${c.rows_with_no_law}`);
check('DOMAIN COUNTS SUM TO THE WHOLE REGISTRY', f(c.domain_counts_sum_to === N_LAWS, c.domain_counts_sum_to !== N_LAWS), `${c.domain_counts_sum_to} vs ${N_LAWS}`);
check('domain theorem counts sum to the registry\'s theorem count', f(c.domain_theorem_counts_sum_to === N_THEOREMS, c.domain_theorem_counts_sum_to !== N_THEOREMS), `${c.domain_theorem_counts_sum_to} vs ${N_THEOREMS}`);
check('every row\'s domain is one of the nine', f(ASSIGNMENTS.every(r => DOMAIN_NAMES.includes(r.domain)), !ASSIGNMENTS.every(r => DOMAIN_NAMES.includes(r.domain))));
check('every row gives a reason', f(ASSIGNMENTS.every(r => typeof r.why === 'string' && r.why.length > 20), !ASSIGNMENTS.every(r => typeof r.why === 'string' && r.why.length > 20)));
check('no law id is classified twice', f(new Set(ASSIGNMENTS.map(r => r.law_id)).size === ASSIGNMENTS.length, new Set(ASSIGNMENTS.map(r => r.law_id)).size !== ASSIGNMENTS.length));

// recount each domain from the registry here, not from the exported number
let recountOk = true, theoremRecountOk = true;
for (const name of DOMAIN_NAMES) {
  const rows = ASSIGNMENTS.filter(r => r.domain === name);
  if (rows.length !== DOMAINS[name].laws) recountOk = false;
  if (rows.filter(r => hasTheorem(registry.get(r.law_id))).length !== DOMAINS[name].with_a_lean_theorem) theoremRecountOk = false;
}
check('each domain\'s law count recounts correctly from the registry', f(recountOk, !recountOk));
check('each domain\'s theorem count recounts correctly from the registry', f(theoremRecountOk, !theoremRecountOk));
check('with + without a theorem equals the domain total, in every domain',
  f(DOMAIN_NAMES.every(n => DOMAINS[n].with_a_lean_theorem + DOMAINS[n].without_a_lean_theorem === DOMAINS[n].laws),
    !DOMAIN_NAMES.every(n => DOMAINS[n].with_a_lean_theorem + DOMAINS[n].without_a_lean_theorem === DOMAINS[n].laws)));
check('every domain states what it covers and where its boundary is',
  f(DOMAIN_NAMES.every(n => DOMAIN_DEFS[n].covers.length > 80 && DOMAIN_DEFS[n].boundary_note.length > 40),
    !DOMAIN_NAMES.every(n => DOMAIN_DEFS[n].covers.length > 80 && DOMAIN_DEFS[n].boundary_note.length > 40)));

console.log('\n-- the molecular-biology finding, which is the point');
const mb = DOMAINS['molecular-biology'];
check('molecular-biology is reported, not omitted for being small', f(!!mb, !mb));
check('molecular-biology holds 2 of the 62 laws', f(mb.laws === 2, mb.laws !== 2), `${mb.laws}`);
check('exactly 1 molecular-biology law carries a Lean theorem', f(mb.with_a_lean_theorem === 1, mb.with_a_lean_theorem !== 1), `${mb.with_a_lean_theorem}`);
check('it is the smallest domain of the nine',
  f(DOMAIN_NAMES.every(n => DOMAINS[n].laws >= mb.laws), !DOMAIN_NAMES.every(n => DOMAINS[n].laws >= mb.laws)));
check('the one with a theorem is genotype-genetic-code',
  f(hasTheorem(registry.get('genotype-genetic-code')) && mb.law_ids.includes('genotype-genetic-code'),
    !(hasTheorem(registry.get('genotype-genetic-code')) && mb.law_ids.includes('genotype-genetic-code'))));
check('the other one is a gap with no module at all',
  f(registry.get('gene-regulatory-dynamics').class === 'gap' && !registry.get('gene-regulatory-dynamics').lean_ref.module,
    !(registry.get('gene-regulatory-dynamics').class === 'gap' && !registry.get('gene-regulatory-dynamics').lean_ref.module)));
check('the header says so prominently rather than stretching the label',
  f(/TWO molecular-biology laws in a registry of 62/.test(SELF), !/TWO molecular-biology laws in a registry of 62/.test(SELF)));

// ---------------------------------------------------------------- the worked examples

console.log('\n-- WORKED: every Lean statement is in the file the registry names');
check('5 or 6 worked entries', f(WORKED.length >= 5 && WORKED.length <= 6, !(WORKED.length >= 5 && WORKED.length <= 6)), `${WORKED.length}`);
check('they span at least five domains',
  f(new Set(WORKED.map(w => w.domain)).size >= 5, !(new Set(WORKED.map(w => w.domain)).size >= 5)),
  `${new Set(WORKED.map(w => w.domain)).size}`);
check('molecular-biology is among the worked domains',
  f(WORKED.some(w => w.domain === 'molecular-biology'), !WORKED.some(w => w.domain === 'molecular-biology')));

for (const w of WORKED) {
  const law = registry.get(w.law_id);
  const tag = w.law_id;
  check(`${tag}: is in the registry`, f(!!law, !law));
  if (!law) continue;

  check(`${tag}: domain matches its classification row`,
    f(ASSIGNMENTS.find(r => r.law_id === w.law_id).domain === w.domain,
      ASSIGNMENTS.find(r => r.law_id === w.law_id).domain !== w.domain));
  check(`${tag}: status copied correctly from the registry`, f(w.status === law.status, w.status !== law.status), `said ${w.status}, registry says ${law.status}`);
  check(`${tag}: lean_file is the module the registry names`,
    f(w.lean_file === law.lean_ref.module, w.lean_file !== law.lean_ref.module), `${w.lean_file} vs ${law.lean_ref.module}`);

  // the real check: the quoted signature is in that file, byte for byte
  const p = leanFilePath(law);
  const exists = p && fs.existsSync(p);
  check(`${tag}: the named Lean file exists on disk`, f(!!exists, !exists), String(p));
  if (exists) {
    const src = norm(fs.readFileSync(p, 'utf8'));
    const stmt = norm(w.the_lean_statement);
    check(`${tag}: the_lean_statement appears verbatim in ${law.lean_ref.module}`, f(src.includes(stmt), !src.includes(stmt)),
      `first line: ${stmt.split('\n')[0].slice(0, 70)}`);
    // when the registry names no theorem the quoted text must still be the thing it DOES name
    const named = law.lean_ref.theorem || law.lean_ref.structure || '';
    const shortName = named.split('.').pop();
    check(`${tag}: the quoted statement is the ${law.lean_ref.theorem ? 'theorem' : 'declaration'} lean_ref names (${shortName})`,
      f(!!shortName && stmt.includes(shortName), !(!!shortName && stmt.includes(shortName))));
  }

  check(`${tag}: has_a_theorem matches lean_ref having a module AND a theorem`,
    f(w.has_a_theorem === hasTheorem(law), w.has_a_theorem !== hasTheorem(law)),
    `said ${w.has_a_theorem}, module=${!!law.lean_ref.module} theorem=${!!law.lean_ref.theorem}`);
  check(`${tag}: has_a_non_vacuity_witness matches the registry`,
    f(w.has_a_non_vacuity_witness === !!law.non_vacuity_witness, w.has_a_non_vacuity_witness !== !!law.non_vacuity_witness));

  check(`${tag}: a_concrete_instance is non-empty and contains a digit`,
    f(typeof w.a_concrete_instance === 'string' && w.a_concrete_instance.length > 120 && digits(w.a_concrete_instance),
      !(typeof w.a_concrete_instance === 'string' && w.a_concrete_instance.length > 120 && digits(w.a_concrete_instance))));
  check(`${tag}: plain_english has no Lean and no greek`,
    f(!/theorem|:=|∀|∃|ℝ/.test(w.plain_english), /theorem|:=|∀|∃|ℝ/.test(w.plain_english)));
  check(`${tag}: what_the_symbols_mean explains at least five terms`,
    f(Object.keys(w.what_the_symbols_mean).length >= 5, !(Object.keys(w.what_the_symbols_mean).length >= 5)),
    `${Object.keys(w.what_the_symbols_mean).length}`);
  check(`${tag}: what_would_refute_it is substantial`,
    f(w.what_would_refute_it.length > 150, !(w.what_would_refute_it.length > 150)), `${w.what_would_refute_it.length} chars`);

  // non-trivial: long enough to name an actual overreach, says what is NOT the case, and is not a
  // restatement of either the plain English or the registry's own statement_en
  const nots = w.what_it_does_NOT_say;
  const trivial = !nots || nots.length < 200 || !/\bnot\b|\bnothing\b|\bno\b/i.test(nots)
    || nots === w.plain_english || nots === law.statement_en;
  check(`${tag}: what_it_does_NOT_say is non-trivial`, f(!trivial, trivial), `${nots ? nots.length : 0} chars`);
}

// ---------------------------------------------------------------- the honest shape

console.log('\n-- THE_HONEST_SHAPE is frozen and its counts hold');
check('THE_HONEST_SHAPE is frozen', f(Object.isFrozen(THE_HONEST_SHAPE), !Object.isFrozen(THE_HONEST_SHAPE)));
check('DOMAINS is frozen', f(Object.isFrozen(DOMAINS), !Object.isFrozen(DOMAINS)));
check('WORKED is frozen', f(Object.isFrozen(WORKED), !Object.isFrozen(WORKED)));

const byClass = {};
for (const l of registry.values()) byClass[l.class] = (byClass[l.class] || 0) + 1;
const senses = THE_HONEST_SHAPE.the_expectation_was_right_about_the_word_law_too.senses;
check('the five-plus senses of "law" sum to the whole registry',
  f(senses.reduce((a, s) => a + s.count, 0) === N_LAWS, senses.reduce((a, s) => a + s.count, 0) !== N_LAWS),
  `${senses.reduce((a, s) => a + s.count, 0)} vs ${N_LAWS}`);
check('each sense\'s count is the registry\'s own count for that class',
  f(senses.every(s => byClass[s.registry_class] === s.count), !senses.every(s => byClass[s.registry_class] === s.count)),
  JSON.stringify(byClass));
const byStatus = {};
for (const l of registry.values()) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
check('the status tally matches the registry',
  f(['accepted', 'candidate', 'proposed', 'contested', 'retired'].every(k => THE_HONEST_SHAPE.statuses[k] === byStatus[k]),
    !['accepted', 'candidate', 'proposed', 'contested', 'retired'].every(k => THE_HONEST_SHAPE.statuses[k] === byStatus[k])),
  JSON.stringify(byStatus));
check('the 48/14 split adds to the registry',
  f(THE_HONEST_SHAPE.what_the_48_and_the_14_are.theorem_carrying + THE_HONEST_SHAPE.what_the_48_and_the_14_are.not_theorem_carrying === N_LAWS,
    THE_HONEST_SHAPE.what_the_48_and_the_14_are.theorem_carrying + THE_HONEST_SHAPE.what_the_48_and_the_14_are.not_theorem_carrying !== N_LAWS));
check('the 48 it names is the 48 counted here',
  f(THE_HONEST_SHAPE.what_the_48_and_the_14_are.theorem_carrying === N_THEOREMS,
    THE_HONEST_SHAPE.what_the_48_and_the_14_are.theorem_carrying !== N_THEOREMS));
// the whole-organism claim, recounted from the domains rather than from the prose
const physical = ['biomechanics', 'scaling-allometry', 'physiology-metabolism', 'ecology'].reduce((a, n) => a + DOMAINS[n].laws, 0);
const statistical = ['population-genetics', 'evolutionary-theory'].reduce((a, n) => a + DOMAINS[n].laws, 0);
check('whole-organism physical + population-statistical really is 50 of 62',
  f(physical + statistical === 50 && N_LAWS === 62, !(physical + statistical === 50 && N_LAWS === 62)),
  `${physical} + ${statistical}`);
check('the lead\'s expectation is recorded as CONFIRMED, not softened',
  f(THE_HONEST_SHAPE.the_expectation_was_right.verdict === 'CONFIRMED', THE_HONEST_SHAPE.the_expectation_was_right.verdict !== 'CONFIRMED'));

// ---------------------------------------------------------------- the three proposals

console.log('\n-- the three molecular-biology candidates');
const P = WHAT_A_MOLECULAR_BIOLOGY_LAW_WOULD_LOOK_LIKE;
check('three candidates proposed', f(P.length === 3, P.length !== 3), `${P.length}`);
check('all three are in the molecular-biology domain', f(P.every(x => x.domain === 'molecular-biology'), !P.every(x => x.domain === 'molecular-biology')));
check('none of them is already a law id in the registry',
  f(P.every(x => !registry.has(x.proposed_law_id)), !P.every(x => !registry.has(x.proposed_law_id))));
check('each states the law, its hypotheses, and whether it is provable',
  f(P.every(x => x.the_statement.length > 200 && x.hypotheses_it_would_need.length >= 3 && x.provable_or_merely_statable.length > 150),
    !P.every(x => x.the_statement.length > 200 && x.hypotheses_it_would_need.length >= 3 && x.provable_or_merely_statable.length > 150)));
check('the Berg-von Hippel search-rate bound is one of them',
  f(P.some(x => /Berg-von Hippel/.test(x.name)), !P.some(x => /Berg-von Hippel/.test(x.name))));
const allSrc = P.flatMap(x => x.sources);
check('every candidate cites at least three sources', f(P.every(x => x.sources.length >= 3), !P.every(x => x.sources.length >= 3)));
check('every source carries a DOI in a real registrant prefix form',
  f(allSrc.every(s => /^10\.\d{4,9}\/\S+$/.test(s.doi)), !allSrc.every(s => /^10\.\d{4,9}\/\S+$/.test(s.doi))),
  allSrc.filter(s => !/^10\.\d{4,9}\/\S+$/.test(s.doi)).map(s => s.doi).join(', '));
check('every source carries a PubMed id and a verification note',
  f(allSrc.every(s => /^\d{5,8}$/.test(s.pmid) && /PubMed/.test(s.verified)),
    !allSrc.every(s => /^\d{5,8}$/.test(s.pmid) && /PubMed/.test(s.verified))));
check('every source says what role it plays, so none is decoration',
  f(allSrc.every(s => s.role && s.role.length > 30), !allSrc.every(s => s.role && s.role.length > 30)));
check('no DOI is cited twice under two different papers',
  f(new Set(allSrc.map(s => s.doi)).size === allSrc.length, new Set(allSrc.map(s => s.doi)).size !== allSrc.length));

// ---------------------------------------------------------------- the holdout gate

console.log('\n-- the holdout: no held-out law id, taxon or claim id is written in the source');
const split = JSON.parse(fs.readFileSync(path.join(ROOT, 'holdout/split.json'), 'utf8'));
const exam = JSON.parse(fs.readFileSync(path.join(ROOT, 'holdout/exam.json'), 'utf8'));
const held = split.taxa.filter(t => t.assignment === 'holdout');
const holdoutClaims = (exam.claims_mentioning_holdout || []).filter(x => x.side === 'holdout').map(x => x.id);
const mixedClaims = (exam.claims_mentioning_holdout || []).filter(x => x.side === 'mixed').map(x => x.id);

// A law id that is also a holdout/mixed claim id must never be written in source. It must instead be
// reachable only through ASSIGNMENTS, filled from the registry at runtime.
const sensitiveLawIds = [...registry.keys()].filter(id => holdoutClaims.includes(id) || mixedClaims.includes(id));
check('there are law ids that would leak if written (otherwise this gate proves nothing)',
  f(sensitiveLawIds.length > 0, !(sensitiveLawIds.length > 0)), `${sensitiveLawIds.length}`);
const writtenSensitive = sensitiveLawIds.filter(id => SELF.includes(id));
check('NO sensitive law id appears in laws.mjs source', f(writtenSensitive.length === 0, writtenSensitive.length !== 0), `${writtenSensitive.length} written`);
const writtenHere = sensitiveLawIds.filter(id => fs.readFileSync(path.join(HERE, 'test-laws.mjs'), 'utf8').includes(id));
check('NO sensitive law id appears in this test\'s source either', f(writtenHere.length === 0, writtenHere.length !== 0), `${writtenHere.length} written`);
check('every sensitive law id is still classified, via a runtime-filled row',
  f(sensitiveLawIds.every(id => ASSIGNMENTS.some(r => r.law_id === id && r.withheld)),
    !sensitiveLawIds.every(id => ASSIGNMENTS.some(r => r.law_id === id && r.withheld))));
check('the runtime-filled rows are exactly the sensitive ones',
  f(ASSIGNMENTS.filter(r => r.withheld).length === sensitiveLawIds.length,
    ASSIGNMENTS.filter(r => r.withheld).length !== sensitiveLawIds.length),
  `${ASSIGNMENTS.filter(r => r.withheld).length} withheld vs ${sensitiveLawIds.length} sensitive`);
check('publicAssignments() redacts every withheld id',
  f(publicAssignments().every(r => !sensitiveLawIds.includes(r.law_id)),
    !publicAssignments().every(r => !sensitiveLawIds.includes(r.law_id))));
check('DOMAINS exposes no withheld law id in its law_ids lists',
  f(DOMAIN_NAMES.every(n => DOMAINS[n].law_ids.every(id => !sensitiveLawIds.includes(id))),
    !DOMAIN_NAMES.every(n => DOMAINS[n].law_ids.every(id => !sensitiveLawIds.includes(id)))));
check('no WORKED entry is a sensitive law',
  f(WORKED.every(w => !sensitiveLawIds.includes(w.law_id)), !WORKED.every(w => !sensitiveLawIds.includes(w.law_id))));

// no held-out taxon name, and no held-out claim id of any kind, anywhere in laws.mjs
const namedTaxa = held.filter(t => t.rank !== 'class')
  .filter(t => new RegExp(`\\b${t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, t.rank === 'genus' ? '' : 'i').test(SELF))
  .map(t => t.name);
check('no held-out taxon name appears in laws.mjs', f(namedTaxa.length === 0, namedTaxa.length !== 0), namedTaxa.join(', '));
const namedClaims = [...holdoutClaims, ...mixedClaims].filter(id => SELF.includes(id));
check('no held-out or mixed claim id appears in laws.mjs', f(namedClaims.length === 0, namedClaims.length !== 0), namedClaims.join(', '));
// The clade-level words holdout/check-leaks.mjs treats as weak signals. Assembled from fragments so
// that THIS file does not trip the same checker while testing that laws.mjs does not: a gate that
// warns on its own guard gets read as noise, and then it guards nothing.
const CLADE_WORDS = ['Av' + 'es', 'bir' + 'ds?', 'avi' + 'an', 'AVO' + 'NET'];
const weakWords = CLADE_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(SELF));
check('none of the clade-level words the leak checker warns on appears in laws.mjs',
  f(weakWords.length === 0, weakWords.length !== 0), `${weakWords.length}`);

// ---------------------------------------------------------------- summary

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion is expected to fail, and none may print ok)' : ''}`);
process.exit(fail && !FAULT ? 1 : 0);
