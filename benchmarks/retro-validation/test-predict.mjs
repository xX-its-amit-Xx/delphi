#!/usr/bin/env node
// Tests for benchmarks/retro-validation/predict.mjs - the prediction functions used to make a call
// BEFORE the ground truth is looked at.
//
//   node benchmarks/retro-validation/test-predict.mjs [--fail-once]
//
// Six things are checked harder than the rest, because they are the six ways this module could do damage:
//
//   1. THE ALIGNMENT BEING WRONG. Everything downstream reads a site through it. A one-position slip in
//      the reference-to-query mapping does not crash, does not look wrong, and silently reports the shift
//      of a neighbouring residue. So the Gotoh recursion is checked against an INDEPENDENT exhaustive
//      enumeration of every possible alignment of short pairs, scored by a separate scorer that knows
//      nothing about the dynamic programme - over a hundred seeded random pairs, plus hand-worked cases
//      with a gap, plus the identity and maximality properties of aligning a sequence to itself.
//   2. A SITE THAT COULD NOT BE READ BEING COUNTED AS "NO SHIFT". An unread site and a site read as
//      identical to the reference produce the same nm. They are not the same prediction, and the one
//      that quietly drops sites is the one that reports a confident number from half a table.
//   3. A NUMBER CALLED Zmb APPEARING. The convention was retrieved and it needs a structure and
//      site-specific pKs. Any key of zmbSurfaceCharge that held a float would be read as Zmb within one
//      function call of here.
//   4. THE ARGININE pKa BEING INVENTED. No retrieved source gives one. So the top of the pH range is a
//      refusal, and the refusal is tested, because a silently extrapolated guanidinium titration is a
//      fabricated measurement with no paper to blame.
//   5. Math.random, OR THE NETWORK, GETTING IN. A p value that is not a function of its seed cannot be
//      recomputed, and a prediction function that can fetch can fetch the answer. Both are checked
//      against the source TEXT, not against behaviour, because behaviour only shows the paths taken.
//   6. A CONFIDENCE POINT WHERE AN INTERVAL BELONGS. ciFisher must return a band, say which standard
//      error form produced it, and refuse rather than fake one when n is too small.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own inversion is asserting nothing.
//
// Every sequence in this file is SYNTHETIC and is marked as such. No measurement and no taxon is
// asserted anywhere in it. The only numbers attributed to papers are the pKa values, and those are
// checked against what predict.mjs's SOURCES says was retrieved - not against anything typed here twice.
import * as P from './predict.mjs';
import { readFileSync } from 'node:fs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(String(e && e.message)) : true; } };
const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

const SRC = readFileSync(new URL('./predict.mjs', import.meta.url), 'utf8');

console.log(`\npredict: the prediction is made before the answer is looked at${FAULT ? '   [--fail-once: every assertion faulted]' : ''}\n`);

// ====================================================================================================
// 1. THE MODULE HOLDS NO DATA, IMPORTS NOTHING, AND CANNOT REACH THE NETWORK
// ====================================================================================================
// Checked against the source text rather than against behaviour, because behaviour only exercises the
// code paths this test happens to take.
{
  const importLines = SRC.split('\n').filter(l => /^\s*import\s/.test(l) || /\bawait\s+import\s*\(/.test(l) || /\brequire\s*\(/.test(l));
  check('predict.mjs imports nothing at all - no data module, no builtin, nothing',
    f(importLines.length === 0, importLines.length !== 0), importLines.join(' | '));
  check('no sibling data module is named anywhere in the source, not even in a comment as a path',
    f(/from\s+['"]\.\//.test(SRC) === false, /from\s+['"]\.\//.test(SRC) === true));
  check('Math.random is never CALLED in the source',
    f(/Math\.random\s*\(/.test(SRC) === false, /Math\.random\s*\(/.test(SRC) === true));
  const mrNonComment = SRC.split('\n').filter(l => l.includes('Math.random') && !/^\s*\/\//.test(l));
  check('and its name appears outside a comment in exactly one place: the SOURCES note saying mulberry32 is not it',
    f(mrNonComment.length === 1 && P.SOURCES.statistics.mulberry32.includes('is not Math.random'),
      !(mrNonComment.length === 1 && P.SOURCES.statistics.mulberry32.includes('is not Math.random'))), `${mrNonComment.length} line(s)`);
  check('fetch does not appear in the source',
    f(/\bfetch\s*\(/.test(SRC) === false, /\bfetch\s*\(/.test(SRC) === true));
  check('no http(s) URL is dereferenced at runtime: the only ones present are inside comments or SOURCES strings',
    f(SRC.split('\n').filter(l => /https?:\/\//.test(l) && !/^\s*\/\//.test(l) && !/'|"|`/.test(l)).length === 0,
      SRC.split('\n').filter(l => /https?:\/\//.test(l) && !/^\s*\/\//.test(l) && !/'|"|`/.test(l)).length !== 0));
  check('XMLHttpRequest, dns, net and child_process appear nowhere',
    f(/XMLHttpRequest|node:dns|node:net|child_process/.test(SRC) === false, /XMLHttpRequest|node:dns|node:net|child_process/.test(SRC) === true));
  // The data in the module is zero biological rows. The only sequences present are in demo(), labelled.
  check('demo() labels every value it returns as SYNTHETIC',
    f(/EVERY VALUE BELOW IS SYNTHETIC/.test(P.demo().note), !/EVERY VALUE BELOW IS SYNTHETIC/.test(P.demo().note)));
  check('the module header says in words that sequences and tables arrive as ARGUMENTS',
    f(/arrive as ARGUMENTS/.test(SRC), !/arrive as ARGUMENTS/.test(SRC)));
}

// ====================================================================================================
// 2. SOURCES: EVERY NUMBER ATTRIBUTED TO A PAPER SAYS HOW IT WAS RETRIEVED
// ====================================================================================================
{
  check('SOURCES is deep-frozen',
    f(Object.isFrozen(P.SOURCES) && Object.isFrozen(P.SOURCES.thurlkill_2006), !(Object.isFrozen(P.SOURCES) && Object.isFrozen(P.SOURCES.thurlkill_2006))));
  const withDoi = Object.entries(P.SOURCES).filter(([, v]) => v && v.doi);
  check('there are at least seven cited sources carrying a DOI',
    f(withDoi.length >= 7, !(withDoi.length >= 7)), `${withDoi.length}`);
  const badDoi = withDoi.filter(([, v]) => !/^10\.\d{4,9}\/\S+$/.test(v.doi));
  check('every DOI is shaped like a DOI',
    f(badDoi.length === 0, badDoi.length !== 0), badDoi.map(([k, v]) => `${k}:${v.doi}`).join(', '));
  const noVerify = withDoi.filter(([, v]) => typeof v.verified_how !== 'string' || v.verified_how.length < 80);
  check('EVERY cited source states, with substance, what was actually retrieved and by what route',
    f(noVerify.length === 0, noVerify.length !== 0), noVerify.map(([k]) => k).join(', '));
  const noDate = withDoi.filter(([, v]) => !/2026-11-07/.test(v.verified_how));
  check('every verified_how names the date the retrieval happened',
    f(noDate.length === 0, noDate.length !== 0), noDate.map(([k]) => k).join(', '));
  check('the paywalled source says so and says that NOTHING is attributed to its unread methods',
    f(/subscription-only/.test(P.SOURCES.mirceta_2013.what_was_NOT_retrieved) && /NO number and NO calculation convention is attributed/.test(P.SOURCES.mirceta_2013.what_was_NOT_retrieved),
      !(/subscription-only/.test(P.SOURCES.mirceta_2013.what_was_NOT_retrieved) && /NO number and NO calculation convention is attributed/.test(P.SOURCES.mirceta_2013.what_was_NOT_retrieved))));
  check('the source whose tables were not retrieved says which tables they were',
    f(/tables/i.test(P.SOURCES.mclellan_1984.what_was_NOT_retrieved), !/tables/i.test(P.SOURCES.mclellan_1984.what_was_NOT_retrieved)));
  check('the BLOSUM62 source states that the integers were downloaded and transcribed, not typed from memory',
    f(/NOT typed from memory/.test(P.SOURCES.henikoff_1992.verified_how) && /ftp\.ncbi\.nlm\.nih\.gov/.test(P.SOURCES.henikoff_1992.verified_how),
      !(/NOT typed from memory/.test(P.SOURCES.henikoff_1992.verified_how) && /ftp\.ncbi\.nlm\.nih\.gov/.test(P.SOURCES.henikoff_1992.verified_how))));
  check('the affine-gap algorithm is attributed to Gotoh rather than to the 1970 paper it is not in',
    f(/Gotoh/.test(P.SOURCES.needleman_wunsch_1970.note) && /not the 1970 paper/.test(P.SOURCES.needleman_wunsch_1970.note),
      !(/Gotoh/.test(P.SOURCES.needleman_wunsch_1970.note) && /not the 1970 paper/.test(P.SOURCES.needleman_wunsch_1970.note))));
  check('the statistics entry states that no value is attributed to any paper, and names the two estimator CHOICES',
    f(/1\/sqrt\(n-3\)/.test(P.SOURCES.statistics.note) && /CHOICES/.test(P.SOURCES.statistics.note),
      !(/1\/sqrt\(n-3\)/.test(P.SOURCES.statistics.note) && /CHOICES/.test(P.SOURCES.statistics.note))));
  check('the mammal-only scope of the comparative sources is recorded as a provenance note',
    f(/MAMMALS ONLY/.test(SRC) && /comparative scope \(mammals and fishes\)/.test(SRC), !(/MAMMALS ONLY/.test(SRC) && /comparative scope \(mammals and fishes\)/.test(SRC))));
}

// ====================================================================================================
// 3. THE pKa SETS ARE THE RETRIEVED VALUES, AND ARGININE IS A REFUSAL
// ====================================================================================================
{
  const T = P.PKA_THURLKILL_2006, G = P.PKA_GRIMSLEY_2009_FOLDED;
  check('both pKa sets are deep-frozen',
    f(Object.isFrozen(T) && Object.isFrozen(T.cationic) && Object.isFrozen(G) && Object.isFrozen(G.anionic),
      !(Object.isFrozen(T) && Object.isFrozen(T.cationic) && Object.isFrozen(G) && Object.isFrozen(G.anionic))));
  // Quoted from the abstract of PMID 16597822: alpha-carboxyl 3.67, Asp 3.67, Glu 4.25, His 6.54,
  // alpha-amino 8.00, Cys 8.55, Tyr 9.84, Lys 10.40.
  check('the Thurlkill set carries exactly the eight values that abstract enumerates',
    f(T.anionic.C_TERMINUS === 3.67 && T.anionic.D === 3.67 && T.anionic.E === 4.25 && T.cationic.H === 6.54 &&
      T.cationic.N_TERMINUS === 8.00 && T.anionic.C === 8.55 && T.anionic.Y === 9.84 && T.cationic.K === 10.40,
      !(T.anionic.C_TERMINUS === 3.67 && T.anionic.D === 3.67 && T.anionic.E === 4.25 && T.cationic.H === 6.54 &&
        T.cationic.N_TERMINUS === 8.00 && T.anionic.C === 8.55 && T.anionic.Y === 9.84 && T.cationic.K === 10.40)),
    JSON.stringify({ ...T.anionic, ...T.cationic }));
  check('and its stated errors are carried too, so the second decimal is not read as exact',
    f(T.stated_error.Y === 0.11 && T.stated_error.K === 0.08 && T.stated_error.E === 0.05,
      !(T.stated_error.Y === 0.11 && T.stated_error.K === 0.08 && T.stated_error.E === 0.05)));
  // Quoted from the abstract of PMID 19177368: Asp 3.5+/-1.2 (139); Glu 4.2+/-0.9 (153); His 6.6+/-1.0
  // (131); Cys 6.8+/-2.7 (25); Tyr 10.3+/-1.2 (20); Lys 10.5+/-1.1 (35); C-term 3.3+/-0.8 (22);
  // N-term 7.7+/-0.5 (16).
  check('the folded-protein set carries the eight averages that abstract enumerates',
    f(G.anionic.D === 3.5 && G.anionic.E === 4.2 && G.cationic.H === 6.6 && G.anionic.C === 6.8 &&
      G.anionic.Y === 10.3 && G.cationic.K === 10.5 && G.anionic.C_TERMINUS === 3.3 && G.cationic.N_TERMINUS === 7.7,
      !(G.anionic.D === 3.5 && G.anionic.E === 4.2 && G.cationic.H === 6.6 && G.anionic.C === 6.8 &&
        G.anionic.Y === 10.3 && G.cationic.K === 10.5 && G.anionic.C_TERMINUS === 3.3 && G.cationic.N_TERMINUS === 7.7)),
    JSON.stringify({ ...G.anionic, ...G.cationic }));
  check('with their standard deviations and their measurement counts',
    f(G.stated_sd.D === 1.2 && G.n_measurements.D === 139 && G.stated_sd.C === 2.7 && G.n_measurements.C === 25,
      !(G.stated_sd.D === 1.2 && G.n_measurements.D === 139 && G.stated_sd.C === 2.7 && G.n_measurements.C === 25)));
  check('and a statement that the SPREAD, not the mean, is what a sequence-only model has to live with',
    f(/second decimal of anything this function returns is decoration/.test(G.the_spread_is_the_message),
      !/second decimal of anything this function returns is decoration/.test(G.the_spread_is_the_message)));

  const A = P.PKA_ARG_UNMEASURED;
  check('the arginine pKa is null rather than a number',
    f(A.value === null, A.value !== null), `${A.value}`);
  check('and it states WHY it is null by naming what each compilation does and does not report',
    f(/Thurlkill et al. 2006 enumerate/.test(A.null_reason) && /Arg appears in neither/.test(A.null_reason),
      !(/Thurlkill et al. 2006 enumerate/.test(A.null_reason) && /Arg appears in neither/.test(A.null_reason))));
  check('and what would have to be measured to fill it',
    f(typeof A.what_would_have_to_be_measured === 'string' && A.what_would_have_to_be_measured.length > 120,
      !(typeof A.what_would_have_to_be_measured === 'string' && A.what_would_have_to_be_measured.length > 120)));
  check('both pKa sets point at the SAME refusal object, so neither can quietly acquire an Arg value',
    f(T.arg === A && G.arg === A, !(T.arg === A && G.arg === A)));
  check('neither set has an R key in its cationic table',
    f(!('R' in T.cationic) && !('R' in G.cationic), ('R' in T.cationic) || ('R' in G.cationic)));
  check('the Thurlkill entry records that Nozaki & Tanford was NOT retrieved and none of its numbers appear',
    f(/NOT retrieved for this file and none of its numbers appear/.test(T.note), !/NOT retrieved for this file and none of its numbers appear/.test(T.note)));
  check('the pH window\'s upper bound is exactly the arginine refusal\'s own bound',
    f(P.PH_RANGE.max === A.valid_below_pH, P.PH_RANGE.max !== A.valid_below_pH), `${P.PH_RANGE.max} vs ${A.valid_below_pH}`);
  check('and the window says why each end is where it is',
    f(P.PH_RANGE.why_min.length > 60 && /PKA_ARG_UNMEASURED/.test(P.PH_RANGE.why_max),
      !(P.PH_RANGE.why_min.length > 60 && /PKA_ARG_UNMEASURED/.test(P.PH_RANGE.why_max))));
  check('the ambiguity codes are refused by name, each with the reason it is an ambiguity',
    f(/one unit of charge/.test(P.AMBIGUOUS_OR_UNSUPPORTED.B) && /one-unit ambiguity/.test(P.AMBIGUOUS_OR_UNSUPPORTED.Z) && 'X' in P.AMBIGUOUS_OR_UNSUPPORTED,
      !(/one unit of charge/.test(P.AMBIGUOUS_OR_UNSUPPORTED.B) && /one-unit ambiguity/.test(P.AMBIGUOUS_OR_UNSUPPORTED.Z) && 'X' in P.AMBIGUOUS_OR_UNSUPPORTED)));
}

// ====================================================================================================
// 4. netCharge: HENDERSON-HASSELBALCH, CHECKED AGAINST ARITHMETIC DONE BY HAND
// ====================================================================================================
// The single-residue peptide 'K' at pH 7.4 with the Thurlkill set:
//   Lys          f+ = 1/(1 + 10^(7.4 - 10.40)) = 1/(1 + 10^-3.00)  = 0.99900100
//   N-terminus   f+ = 1/(1 + 10^(7.4 -  8.00)) = 1/(1 + 10^-0.60)  = 0.79924001
//   C-terminus   f- = 1/(1 + 10^(3.67 - 7.40)) = 1/(1 + 10^-3.73)  = 0.99981382
//   net = 0.99900100 + 0.79924001 - 0.99981382 = 0.79842719
{
  check('netCharge("K") at pH 7.4 matches the hand-worked Henderson-Hasselbalch sum to 7 decimals',
    f(near(P.netCharge('K'), 0.7984272, 5e-7), !near(P.netCharge('K'), 0.7984272, 5e-7)), `${P.netCharge('K')}`);
  // 'D' at pH 7.4: Asp f- = 1/(1+10^(3.67-7.4)) = 0.99981382; termini as above.
  //   net = 0.79924001 - 0.99981382 - 0.99981382 = -1.20038763
  check('netCharge("D") at pH 7.4 matches its own hand-worked sum',
    f(near(P.netCharge('D'), -1.2003876, 5e-7), !near(P.netCharge('D'), -1.2003876, 5e-7)), `${P.netCharge('D')}`);
  check('a non-ionisable residue leaves only the two terminal groups',
    f(near(P.netCharge('A'), 0.79924001 - 0.99981382, 5e-7), !near(P.netCharge('A'), 0.79924001 - 0.99981382, 5e-7)), `${P.netCharge('A')}`);
  check('turning the termini off removes exactly those two groups',
    f(near(P.netCharge('A', { includeTermini: false }), 0, 1e-12), !near(P.netCharge('A', { includeTermini: false }), 0, 1e-12)),
    `${P.netCharge('A', { includeTermini: false })}`);
  check('basic residues raise the net charge and acidic residues lower it',
    f(P.netCharge('KKKK') > P.netCharge('AAAA') && P.netCharge('DDDD') < P.netCharge('AAAA'),
      !(P.netCharge('KKKK') > P.netCharge('AAAA') && P.netCharge('DDDD') < P.netCharge('AAAA'))),
    `${P.netCharge('KKKK').toFixed(3)} / ${P.netCharge('AAAA').toFixed(3)} / ${P.netCharge('DDDD').toFixed(3)}`);

  // A titration curve is monotone decreasing in pH. If any step rises, a sign is inverted somewhere.
  const probe = 'MKDEHRYCWKKDDEEHH';
  let monotone = true, worst = '';
  let prev = Infinity;
  for (let k = 20; k <= 104; k++) {
    const pH = k / 10;
    const v = P.netCharge(probe, { pH });
    if (!(v < prev + 1e-12)) { monotone = false; worst = `pH ${pH.toFixed(1)}: ${v} after ${prev}`; }
    prev = v;
  }
  check('net charge decreases monotonically across the whole valid pH window (SYNTHETIC probe peptide)',
    f(monotone === true, monotone !== true), worst);
  check('the same peptide is net positive at the acid end and net negative at the basic end',
    f(P.netCharge(probe, { pH: 2.0 }) > 0 && P.netCharge(probe, { pH: 10.4 }) < 0,
      !(P.netCharge(probe, { pH: 2.0 }) > 0 && P.netCharge(probe, { pH: 10.4 }) < 0)),
    `${P.netCharge(probe, { pH: 2.0 }).toFixed(2)} .. ${P.netCharge(probe, { pH: 10.4 }).toFixed(2)}`);

  // Arginine is pinned at exactly +1: three Args minus three Alas is exactly 3, not 2.999something.
  check('each arginine contributes exactly +1, with no titration term at all',
    f(P.netCharge('RRR') - P.netCharge('AAA') === 3, P.netCharge('RRR') - P.netCharge('AAA') !== 3),
    `${P.netCharge('RRR') - P.netCharge('AAA')}`);
  check('and that pinning makes Arg differ from Lys, which IS titrated',
    f(P.netCharge('RRR') > P.netCharge('KKK'), !(P.netCharge('RRR') > P.netCharge('KKK'))),
    `${P.netCharge('RRR')} vs ${P.netCharge('KKK')}`);
  check('a breakdown of an Arg-containing sequence carries the refusal object with it',
    f(P.chargeBreakdown('RA').arg_treatment === P.PKA_ARG_UNMEASURED, P.chargeBreakdown('RA').arg_treatment !== P.PKA_ARG_UNMEASURED));
  check('and the Arg group row reports a null pKa naming the refusal, rather than a number',
    f(P.chargeBreakdown('RA').groups.find(g => g.group === 'Arg').pKa === null &&
      P.chargeBreakdown('RA').groups.find(g => g.group === 'Arg').pKa_is_null_because === 'PKA_ARG_UNMEASURED',
      !(P.chargeBreakdown('RA').groups.find(g => g.group === 'Arg').pKa === null &&
        P.chargeBreakdown('RA').groups.find(g => g.group === 'Arg').pKa_is_null_because === 'PKA_ARG_UNMEASURED')));
  check('a sequence with no Arg reports arg_treatment null rather than attaching an irrelevant caveat',
    f(P.chargeBreakdown('AA').arg_treatment === null, P.chargeBreakdown('AA').arg_treatment !== null));

  // The refusals.
  check('pH at the arginine bound is REFUSED, and the message names arginine as the reason',
    f(throwsWith(() => P.netCharge('K', { pH: 10.5 }), /Arg/) === true, throwsWith(() => P.netCharge('K', { pH: 10.5 }), /Arg/) !== true));
  check('pH above the bound is refused too',
    f(throwsWith(() => P.netCharge('K', { pH: 12 })) === true, throwsWith(() => P.netCharge('K', { pH: 12 })) !== true));
  check('pH below the acid bound is refused, naming the acid-denaturation reason',
    f(throwsWith(() => P.netCharge('K', { pH: 1.9 }), /acid-denatured|outside/) === true,
      throwsWith(() => P.netCharge('K', { pH: 1.9 }), /acid-denatured|outside/) !== true));
  check('pH just inside each bound is accepted, so the refusal is a boundary and not a blockade',
    f(Number.isFinite(P.netCharge('K', { pH: 2.0 })) && Number.isFinite(P.netCharge('K', { pH: 10.4 })),
      !(Number.isFinite(P.netCharge('K', { pH: 2.0 })) && Number.isFinite(P.netCharge('K', { pH: 10.4 })))));
  for (const amb of ['X', 'B', 'Z', 'U']) {
    check(`an ambiguity or unsupported code (${amb}) is refused rather than given a charge`,
      f(throwsWith(() => P.netCharge(`AA${amb}AA`)) === true, throwsWith(() => P.netCharge(`AA${amb}AA`)) !== true));
  }
  check('an empty sequence is refused rather than returning 0',
    f(throwsWith(() => P.netCharge('   '), /[Ee]mpty/) === true, throwsWith(() => P.netCharge('   '), /[Ee]mpty/) !== true));
  check('a non-string sequence is refused',
    f(throwsWith(() => P.netCharge(42)) === true, throwsWith(() => P.netCharge(42)) !== true));
  check('an unknown pKa set name is refused rather than silently falling back to the default',
    f(throwsWith(() => P.netCharge('K', { pKaSet: 'nozaki-tanford' }), /unknown pKa set/) === true,
      throwsWith(() => P.netCharge('K', { pKaSet: 'nozaki-tanford' }), /unknown pKa set/) !== true));
  check('both pKa sets are selectable by name and give DIFFERENT answers, so the choice is a real one',
    f(P.netCharge('ACA', { pKaSet: 'thurlkill-2006' }) !== P.netCharge('ACA', { pKaSet: 'grimsley-2009-folded' }),
      P.netCharge('ACA', { pKaSet: 'thurlkill-2006' }) === P.netCharge('ACA', { pKaSet: 'grimsley-2009-folded' })),
    `${P.netCharge('ACA')} vs ${P.netCharge('ACA', { pKaSet: 'grimsley-2009-folded' })}`);
  // Cys is 8.55 in model peptides and 6.8 in folded proteins, so at pH 7.4 the two sets disagree by
  // more than half a charge unit on a single cysteine. That gap is the honest size of the choice.
  check('the disagreement on one cysteine at pH 7.4 is larger than half a charge unit',
    f(Math.abs(P.netCharge('ACA') - P.netCharge('ACA', { pKaSet: 'grimsley-2009-folded' })) > 0.5,
      !(Math.abs(P.netCharge('ACA') - P.netCharge('ACA', { pKaSet: 'grimsley-2009-folded' })) > 0.5)));
  check('the breakdown is frozen and states what it is NOT',
    f(Object.isFrozen(P.chargeBreakdown('KD')) && /Not Zmb/.test(P.chargeBreakdown('KD').what_this_is_not),
      !(Object.isFrozen(P.chargeBreakdown('KD')) && /Not Zmb/.test(P.chargeBreakdown('KD').what_this_is_not))));
  check('positive and negative contributions are reported separately, not only their difference',
    f(near(P.chargeBreakdown('KD').positive - P.chargeBreakdown('KD').negative, P.netCharge('KD'), 1e-12),
      !near(P.chargeBreakdown('KD').positive - P.chargeBreakdown('KD').negative, P.netCharge('KD'), 1e-12)));
  check('the two fraction helpers are complementary at equal pH and pKa',
    f(near(P.fracProtonated(7, 7), 0.5, 1e-12) && near(P.fracDeprotonated(7, 7), 0.5, 1e-12),
      !(near(P.fracProtonated(7, 7), 0.5, 1e-12) && near(P.fracDeprotonated(7, 7), 0.5, 1e-12))));
  check('and they move in opposite directions as pH rises',
    f(P.fracProtonated(8, 7) < P.fracProtonated(6, 7) && P.fracDeprotonated(8, 7) > P.fracDeprotonated(6, 7),
      !(P.fracProtonated(8, 7) < P.fracProtonated(6, 7) && P.fracDeprotonated(8, 7) > P.fracDeprotonated(6, 7))));
}

// ====================================================================================================
// 5. Zmb: NO KEY OF THIS OBJECT HOLDS A NUMBER CALLED Zmb
// ====================================================================================================
{
  const seq = 'MKAHDEHCWRGSTKDEHHLAVFPNQ';     // SYNTHETIC
  const noHis = 'MKADEYCWRGSTKDEQQLAVFPNQ';     // SYNTHETIC, histidine-free
  const v = P.zmbSurfaceCharge(seq);

  check('zmb.value is null',
    f(v.zmb.value === null, v.zmb.value !== null), `${v.zmb.value}`);
  check('zmb is an object carrying a refusal, not a number anyone can read as Zmb',
    f(typeof v.zmb === 'object' && typeof v.zmb.null_reason === 'string' && typeof v.zmb.what_would_have_to_be_measured === 'string',
      !(typeof v.zmb === 'object' && typeof v.zmb.null_reason === 'string' && typeof v.zmb.what_would_have_to_be_measured === 'string')));
  const numericTopLevel = Object.entries(v).filter(([k, x]) => typeof x === 'number' && /zmb/i.test(k)).map(([k]) => k);
  check('NO key whose name contains "zmb" holds a number',
    f(numericTopLevel.length === 0, numericTopLevel.length !== 0), numericTopLevel.join(', '));
  check('no variant is recommended: the caller is made to choose by name',
    f(v.recommended_variant === null && v.caller_must_choose === true, !(v.recommended_variant === null && v.caller_must_choose === true)));
  check('and it says why picking one would be the error this function exists to prevent',
    f(/the error this function exists to prevent/.test(v.recommended_variant_is_null_because),
      !/the error this function exists to prevent/.test(v.recommended_variant_is_null_because)));
  const want = ['seq_net_charge_pH74', 'seq_net_charge_pH65', 'his_counted_full_pH65', 'his_excluded_pH65'];
  check('all four named sequence-only variants are present and finite',
    f(want.every(k => Number.isFinite(v.variants[k])), !want.every(k => Number.isFinite(v.variants[k]))), JSON.stringify(v.variants));
  check('every variant carries a note saying what it is and is not comparable to',
    f(want.every(k => typeof v.variant_notes[k] === 'string' && v.variant_notes[k].length > 40),
      !want.every(k => typeof v.variant_notes[k] === 'string' && v.variant_notes[k].length > 40)));
  check('the two histidine bounds differ by exactly the histidine count, in charge units',
    f(near(v.variants.his_counted_full_pH65 - v.variants.his_excluded_pH65, v.n_histidine, 1e-9),
      !near(v.variants.his_counted_full_pH65 - v.variants.his_excluded_pH65, v.n_histidine, 1e-9)),
    `${v.variants.his_counted_full_pH65 - v.variants.his_excluded_pH65} vs ${v.n_histidine}`);
  check('and they really do bracket the Henderson-Hasselbalch value at the same pH',
    f(v.variants.his_excluded_pH65 < v.variants.seq_net_charge_pH65 && v.variants.seq_net_charge_pH65 < v.variants.his_counted_full_pH65,
      !(v.variants.his_excluded_pH65 < v.variants.seq_net_charge_pH65 && v.variants.seq_net_charge_pH65 < v.variants.his_counted_full_pH65)),
    JSON.stringify(v.variants));
  check('the pH 6.5 and pH 7.4 variants are different numbers, so the convention\'s pH is load-bearing',
    f(v.variants.seq_net_charge_pH65 !== v.variants.seq_net_charge_pH74, v.variants.seq_net_charge_pH65 === v.variants.seq_net_charge_pH74));
  check('at pH 6.5 the histidines are near half-titrated, so the bracket is wide relative to the value',
    f(v.histidine_bracket_width >= 3 && Math.abs(v.variants.seq_net_charge_pH65) < v.histidine_bracket_width,
      !(v.histidine_bracket_width >= 3 && Math.abs(v.variants.seq_net_charge_pH65) < v.histidine_bracket_width)),
    `width ${v.histidine_bracket_width}, value ${v.variants.seq_net_charge_pH65.toFixed(2)}`);
  const w = P.zmbSurfaceCharge(noHis);
  check('a histidine-free sequence collapses the bracket to zero width, and the bounds meet the value',
    f(w.histidine_bracket_width === 0 && near(w.variants.his_excluded_pH65, w.variants.seq_net_charge_pH65, 1e-12) && near(w.variants.his_counted_full_pH65, w.variants.seq_net_charge_pH65, 1e-12),
      !(w.histidine_bracket_width === 0 && near(w.variants.his_excluded_pH65, w.variants.seq_net_charge_pH65, 1e-12) && near(w.variants.his_counted_full_pH65, w.variants.seq_net_charge_pH65, 1e-12))),
    JSON.stringify(w.variants));

  const C = P.ZMB_CONVENTION;
  check('the convention is a VERBATIM quote, with the source and the section it came from named',
    f(C.quoted_from === 'he_2021' && /Methods/.test(C.quote_location) && C.quote.length > 150,
      !(C.quoted_from === 'he_2021' && /Methods/.test(C.quote_location) && C.quote.length > 150)));
  check('the quote states the pH, and the recorded pH matches it rather than being set independently',
    f(C.quote.includes('pH = 6.5') && C.pH === 6.5, !(C.quote.includes('pH = 6.5') && C.pH === 6.5)), `${C.pH}`);
  check('and the pH used by the variants is read from the convention, not duplicated',
    f(v.pH_of_the_convention === C.pH, v.pH_of_the_convention !== C.pH));
  check('the convention answers the buried-residue question explicitly: the sum is over ALL ionizable groups',
    f(/NOT a solvent-exposed subset/.test(C.scope_of_the_sum) && /ionizable groups/.test(C.quote),
      !(/NOT a solvent-exposed subset/.test(C.scope_of_the_sum) && /ionizable groups/.test(C.quote))));
  check('it records that the calculation needs a structure AND site-specific pKs',
    f(C.requires_structure === true && C.requires_site_specific_pKs === true && C.site_specific_pKs_source === 'mclellan_1984',
      !(C.requires_structure === true && C.requires_site_specific_pKs === true && C.site_specific_pKs_source === 'mclellan_1984')));
  check('it enumerates at least three distinct things that could NOT be reproduced here',
    f(C.what_could_NOT_be_reproduced.length >= 3, !(C.what_could_NOT_be_reproduced.length >= 3)), `${C.what_could_NOT_be_reproduced.length}`);
  check('one of them is explicitly that no reported Zmb value for any species is written here',
    f(C.what_could_NOT_be_reproduced.some(s => /no reported Zmb value for any species/i.test(s)),
      !C.what_could_NOT_be_reproduced.some(s => /no reported Zmb value for any species/i.test(s))));
  check('it distinguishes what the retrieved abstract DOES support from what a method would',
    f(/It is not a method/.test(C.what_the_abstract_of_mirceta_2013_does_support),
      !/It is not a method/.test(C.what_the_abstract_of_mirceta_2013_does_support)));
  check('the whole result is frozen, so no caller can staple a Zmb float onto it',
    f(Object.isFrozen(v) && Object.isFrozen(v.variants) && Object.isFrozen(v.zmb), !(Object.isFrozen(v) && Object.isFrozen(v.variants) && Object.isFrozen(v.zmb))));
}

// ====================================================================================================
// 6. BLOSUM62 WAS TRANSCRIBED CORRECTLY
// ====================================================================================================
{
  const letters = [...P.BLOSUM62_ALPHABET];
  check('the matrix covers 24 symbols: the 20 standard residues, B, Z, X and the stop character',
    f(letters.length === 24 && letters.includes('*') && 'ACDEFGHIKLMNPQRSTVWY'.split('').every(c => letters.includes(c)),
      !(letters.length === 24 && letters.includes('*') && 'ACDEFGHIKLMNPQRSTVWY'.split('').every(c => letters.includes(c)))), `${letters.length}`);
  const asym = [];
  for (const a of letters) for (const b of letters) if (P.BLOSUM62[a][b] !== P.BLOSUM62[b][a]) asym.push(`${a}${b}`);
  check('the matrix is symmetric everywhere',
    f(asym.length === 0, asym.length !== 0), asym.slice(0, 10).join(', '));
  const notMax = [];
  for (const a of P.STANDARD_AA) {
    for (const b of P.STANDARD_AA) if (b !== a && P.BLOSUM62[a][b] >= P.BLOSUM62[a][a]) notMax.push(`${a}/${b}`);
  }
  check('over the 20 standard residues the diagonal is the STRICT row maximum (so self-alignment is uniquely optimal)',
    f(notMax.length === 0, notMax.length !== 0), notMax.slice(0, 10).join(', '));
  check('five spot values match the NCBI matrix file: W/W 11, C/C 9, A/A 4, K/R 2, W/C -2',
    f(P.BLOSUM62.W.W === 11 && P.BLOSUM62.C.C === 9 && P.BLOSUM62.A.A === 4 && P.BLOSUM62.K.R === 2 && P.BLOSUM62.W.C === -2,
      !(P.BLOSUM62.W.W === 11 && P.BLOSUM62.C.C === 9 && P.BLOSUM62.A.A === 4 && P.BLOSUM62.K.R === 2 && P.BLOSUM62.W.C === -2)),
    `${P.BLOSUM62.W.W}/${P.BLOSUM62.C.C}/${P.BLOSUM62.A.A}/${P.BLOSUM62.K.R}/${P.BLOSUM62.W.C}`);
  check('the matrix is frozen',
    f(Object.isFrozen(P.BLOSUM62) && Object.isFrozen(P.BLOSUM62.A), !(Object.isFrozen(P.BLOSUM62) && Object.isFrozen(P.BLOSUM62.A))));
  check('the gap defaults state the cost formula in words and say they are not measurements',
    f(P.GAP_DEFAULTS.cost_of_gap_of_length_k === 'gapOpen + k * gapExtend' && /not measurements/.test(P.GAP_DEFAULTS.these_are_not_measurements),
      !(P.GAP_DEFAULTS.cost_of_gap_of_length_k === 'gapOpen + k * gapExtend' && /not measurements/.test(P.GAP_DEFAULTS.these_are_not_measurements))));
  check('and the stated single-residue gap cost agrees with the stated formula and defaults',
    f(P.GAP_DEFAULTS.cost_of_a_single_residue_gap === P.GAP_DEFAULTS.gapOpen + 1 * P.GAP_DEFAULTS.gapExtend,
      P.GAP_DEFAULTS.cost_of_a_single_residue_gap !== P.GAP_DEFAULTS.gapOpen + 1 * P.GAP_DEFAULTS.gapExtend));
}

// ====================================================================================================
// 7. THE ALIGNMENT IS CORRECT - CHECKED AGAINST EXHAUSTIVE ENUMERATION
// ====================================================================================================
// An INDEPENDENT scorer and an INDEPENDENT enumerator. scoreAlignmentIndependently walks a pair of
// gapped strings and charges gapOpen + k*gapExtend per maximal gap run; it knows nothing about the
// dynamic programme. allAlignments emits every way two sequences can be laid against each other. The
// maximum over that set is the correct global affine score by definition, so if the DP disagrees on any
// pair, the DP is wrong.
function scoreAlignmentIndependently(ar, aq, M, open, ext) {
  let s = 0, run = 0, runType = null;
  const closeRun = () => { if (run > 0) { s -= open + run * ext; run = 0; runType = null; } };
  for (let c = 0; c < ar.length; c++) {
    const x = ar[c], y = aq[c];
    if (x !== '-' && y !== '-') { closeRun(); s += M[x][y]; }
    else if (y === '-') { if (runType !== 'A') { closeRun(); runType = 'A'; } run++; }
    else { if (runType !== 'B') { closeRun(); runType = 'B'; } run++; }
  }
  closeRun();
  return s;
}
function bestByEnumeration(a, b, M, open, ext) {
  let best = -Infinity;
  const ar = [], aq = [];
  (function rec(i, j) {
    if (i === a.length && j === b.length) {
      const s = scoreAlignmentIndependently(ar, aq, M, open, ext);
      if (s > best) best = s;
      return;
    }
    if (i < a.length && j < b.length) { ar.push(a[i]); aq.push(b[j]); rec(i + 1, j + 1); ar.pop(); aq.pop(); }
    if (i < a.length) { ar.push(a[i]); aq.push('-'); rec(i + 1, j); ar.pop(); aq.pop(); }
    if (j < b.length) { ar.push('-'); aq.push(b[j]); rec(i, j + 1); ar.pop(); aq.pop(); }
  })(0, 0);
  return best;
}
{
  // Hand-worked case, with a gap. ref ACDEF, query ACEF (the D is missing).
  //   A/A 4 + C/C 9 + [gap of length 1: -(11 + 1*1) = -12] + E/E 5 + F/F 6 = 12
  const h = P.alignToReference('ACEF', 'ACDEF');
  check('the hand-worked gapped case scores exactly 12 with the default 11/1 affine penalties',
    f(h.score === 12, h.score !== 12), `${h.score}`);
  check('and the gap lands on the deleted reference position, 3',
    f(h.refToQuery[3] === null, h.refToQuery[3] !== null), JSON.stringify(h.refToQuery));
  check('with every other reference position mapped in order',
    f(h.refToQuery[1] === 1 && h.refToQuery[2] === 2 && h.refToQuery[4] === 3 && h.refToQuery[5] === 4,
      !(h.refToQuery[1] === 1 && h.refToQuery[2] === 2 && h.refToQuery[4] === 3 && h.refToQuery[5] === 4)), JSON.stringify(h.refToQuery));
  check('the aligned strings show the gap in the query, not in the reference',
    f(h.aligned.ref === 'ACDEF' && h.aligned.query === 'AC-EF', !(h.aligned.ref === 'ACDEF' && h.aligned.query === 'AC-EF')),
    `${h.aligned.ref} / ${h.aligned.query}`);
  // With gapOpen 0 the same gap costs 1, so the score rises from 12 to 23. If the open term were being
  // ignored, both runs would give the same answer.
  check('setting gapOpen to 0 changes the score by exactly the open term',
    f(P.alignToReference('ACEF', 'ACDEF', { gapOpen: 0, gapExtend: 1 }).score === 23,
      P.alignToReference('ACEF', 'ACDEF', { gapOpen: 0, gapExtend: 1 }).score !== 23),
    `${P.alignToReference('ACEF', 'ACDEF', { gapOpen: 0, gapExtend: 1 }).score}`);
  // Two separate single gaps must cost two opens; one gap of length two must cost one. If the affine
  // bookkeeping were linear, these two would differ by nothing.
  const twoRuns = scoreAlignmentIndependently('ABCDEF'.replace(/[^A-Z]/g, ''), 'A-C-EF', P.BLOSUM62, 11, 1);
  check('the independent scorer charges two opens for two runs and one for a run of two',
    f(scoreAlignmentIndependently('ACDEF', 'A--EF', P.BLOSUM62, 11, 1) > scoreAlignmentIndependently('ACDEF', 'A-D-F', P.BLOSUM62, 11, 1),
      !(scoreAlignmentIndependently('ACDEF', 'A--EF', P.BLOSUM62, 11, 1) > scoreAlignmentIndependently('ACDEF', 'A-D-F', P.BLOSUM62, 11, 1))),
    `${scoreAlignmentIndependently('ACDEF', 'A--EF', P.BLOSUM62, 11, 1)} vs ${scoreAlignmentIndependently('ACDEF', 'A-D-F', P.BLOSUM62, 11, 1)} (ref ${twoRuns})`);

  // Self-alignment: the identity mapping, the maximal score, no gaps.
  const self = 'MKAHDEYCWRGSTKDEQHLAVFPNQ';   // SYNTHETIC
  const s = P.alignToReference(self, self);
  let diag = 0; for (const c of self) diag += P.BLOSUM62[c][c];
  check('aligning a sequence to itself gives the identity mapping',
    f(s.refToQuery.slice(1).every((qp, k) => qp === k + 1), !s.refToQuery.slice(1).every((qp, k) => qp === k + 1)), JSON.stringify(s.refToQuery.slice(1, 6)));
  check('and the sum of the diagonal as its score, with no gap columns',
    f(s.score === diag && s.n_gap_columns === 0, !(s.score === diag && s.n_gap_columns === 0)), `${s.score} vs ${diag}`);
  check('and identity exactly 1',
    f(s.identity === 1, s.identity !== 1), `${s.identity}`);
  check('that self score is the MAXIMUM over every possible alignment (checked by enumeration on a short prefix)',
    f(P.alignToReference(self.slice(0, 6), self.slice(0, 6)).score === bestByEnumeration(self.slice(0, 6), self.slice(0, 6), P.BLOSUM62, 11, 1),
      P.alignToReference(self.slice(0, 6), self.slice(0, 6)).score !== bestByEnumeration(self.slice(0, 6), self.slice(0, 6), P.BLOSUM62, 11, 1)));

  // The main event: exhaustive agreement over many seeded random pairs, across three gap settings.
  const rnd = P.mulberry32(20261107);
  const randSeq = (n) => Array.from({ length: n }, () => P.STANDARD_AA[Math.floor(rnd() * 20)]).join('');
  const mismatches = [];
  let nPairs = 0;
  for (const [open, ext] of [[11, 1], [0, 2], [4, 3]]) {
    for (let t = 0; t < 40; t++) {
      const n = 1 + Math.floor(rnd() * 5), m = 1 + Math.floor(rnd() * 5);
      const r = randSeq(n), q = randSeq(m);
      const dp = P.alignToReference(q, r, { gapOpen: open, gapExtend: ext });
      const bf = bestByEnumeration(r, q, P.BLOSUM62, open, ext);
      nPairs++;
      if (dp.score !== bf) mismatches.push(`${r}/${q} open${open} ext${ext}: dp ${dp.score} vs bf ${bf}`);
      // And the traceback it returned must itself score to the score it reported.
      const re = scoreAlignmentIndependently(dp.aligned.ref, dp.aligned.query, P.BLOSUM62, open, ext);
      if (re !== dp.score) mismatches.push(`${r}/${q} open${open} ext${ext}: traceback rescored ${re} != ${dp.score}`);
    }
  }
  check(`the dynamic programme agrees with exhaustive enumeration on all ${nPairs} seeded random pairs, at three gap settings`,
    f(mismatches.length === 0, mismatches.length !== 0), mismatches.slice(0, 4).join(' | '));
  check('and the alignment it returns always rescores, independently, to the score it reported',
    f(mismatches.filter(m => /rescored/.test(m)).length === 0, mismatches.filter(m => /rescored/.test(m)).length !== 0));
  check('the enumeration test was not vacuous: it covered at least a hundred pairs',
    f(nPairs >= 100, !(nPairs >= 100)), `${nPairs}`);

  // Structural invariants on a realistic-length SYNTHETIC pair.
  const refL = 'MKAHDEYCWRGSTKDEQHLAVFPNQGTRESDIKLMNWYVHQ';
  const qryL = 'MKAHNEYCWRGSTKEQHLAVFPNQGGTRESDIKLWYVHQ';
  const a = P.alignToReference(qryL, refL);
  check('the aligned strings reconstruct both inputs once gaps are stripped',
    f(a.aligned.ref.replace(/-/g, '') === refL && a.aligned.query.replace(/-/g, '') === qryL,
      !(a.aligned.ref.replace(/-/g, '') === refL && a.aligned.query.replace(/-/g, '') === qryL)));
  const inverseOk = a.refToQuery.every((qp, i) => i === 0 || qp === null || a.queryToRef[qp] === i);
  check('refToQuery and queryToRef are mutual inverses wherever both are defined',
    f(inverseOk === true, inverseOk !== true));
  const injective = (() => { const seen = new Set(); for (let i = 1; i <= a.ref_length; i++) { const qp = a.refToQuery[i]; if (qp === null) continue; if (seen.has(qp)) return false; seen.add(qp); } return true; })();
  check('the mapping is injective: no two reference positions read the same query residue',
    f(injective === true, injective !== true));
  const increasing = (() => { let last = 0; for (let i = 1; i <= a.ref_length; i++) { const qp = a.refToQuery[i]; if (qp === null) continue; if (qp <= last) return false; last = qp; } return true; })();
  check('and order-preserving, as a global alignment must be',
    f(increasing === true, increasing !== true));
  check('score is symmetric in the two sequences',
    f(P.alignToReference(qryL, refL).score === P.alignToReference(refL, qryL).score,
      P.alignToReference(qryL, refL).score !== P.alignToReference(refL, qryL).score),
    `${P.alignToReference(qryL, refL).score} vs ${P.alignToReference(refL, qryL).score}`);
  check('the result is deterministic: two runs give byte-identical alignments',
    f(JSON.stringify(P.alignToReference(qryL, refL).aligned) === JSON.stringify(P.alignToReference(qryL, refL).aligned) &&
      P.alignToReference(qryL, refL).aligned.ref === a.aligned.ref,
      !(JSON.stringify(P.alignToReference(qryL, refL).aligned) === JSON.stringify(P.alignToReference(qryL, refL).aligned) &&
        P.alignToReference(qryL, refL).aligned.ref === a.aligned.ref)));
  check('identity is reported with its denominator named, not as a bare ratio',
    f(/excluding gap columns/.test(a.identity_denominator), !/excluding gap columns/.test(a.identity_denominator)));
  check('and the alignment carries the twilight-zone warning, so a low-identity mapping is not read as a fact',
    f(/30% pairwise identity/.test(a.what_this_is_not), !/30% pairwise identity/.test(a.what_this_is_not)));
  check('tie-breaking is declared, so "deterministic" is a statement a reader can check',
    f(/deterministic: match state/.test(a.tie_breaking), !/deterministic: match state/.test(a.tie_breaking)));
  check('alignment refuses an empty sequence rather than returning an empty mapping',
    f(throwsWith(() => P.alignToReference('', 'ACDEF'), /[Ee]mpty/) === true, throwsWith(() => P.alignToReference('', 'ACDEF'), /[Ee]mpty/) !== true));
  check('alignment refuses a negative gap-extend, since costs are given as positive numbers',
    f(throwsWith(() => P.alignToReference('ACDEF', 'ACDEF', { gapExtend: -1 }), /gapExtend/) === true,
      throwsWith(() => P.alignToReference('ACDEF', 'ACDEF', { gapExtend: -1 }), /gapExtend/) !== true));
  check('alignment refuses a residue the supplied matrix does not score',
    f(throwsWith(() => P.alignToReference('ACDEF', 'ACDEF', { matrix: { A: { A: 1 } } }), /not in the scoring matrix/) === true,
      throwsWith(() => P.alignToReference('ACDEF', 'ACDEF', { matrix: { A: { A: 1 } } }), /not in the scoring matrix/) !== true));
  check('the alignment result is frozen',
    f(Object.isFrozen(a) && Object.isFrozen(a.refToQuery), !(Object.isFrozen(a) && Object.isFrozen(a.refToQuery))));
}

// ====================================================================================================
// 8. READING A SITE IN REFERENCE NUMBERING
// ====================================================================================================
{
  const ref = 'ACDEF', qry = 'ACEF';
  const aln = P.alignToReference(qry, ref);
  check('a site that maps reads the right residue, and reports the query position it came from',
    f(P.residueAtRefPos(aln, qry, 4).residue === 'E' && P.residueAtRefPos(aln, qry, 4).query_position === 3,
      !(P.residueAtRefPos(aln, qry, 4).residue === 'E' && P.residueAtRefPos(aln, qry, 4).query_position === 3)),
    JSON.stringify(P.residueAtRefPos(aln, qry, 4)));
  check('a site over a gap returns null with the reason named, not the neighbouring residue',
    f(P.residueAtRefPos(aln, qry, 3).residue === null && /alignment-gap/.test(P.residueAtRefPos(aln, qry, 3).reason),
      !(P.residueAtRefPos(aln, qry, 3).residue === null && /alignment-gap/.test(P.residueAtRefPos(aln, qry, 3).reason))),
    JSON.stringify(P.residueAtRefPos(aln, qry, 3)));
  check('a site past the end of the reference returns null with its own reason',
    f(P.residueAtRefPos(aln, qry, 99).residue === null && /past the end/.test(P.residueAtRefPos(aln, qry, 99).reason),
      !(P.residueAtRefPos(aln, qry, 99).residue === null && /past the end/.test(P.residueAtRefPos(aln, qry, 99).reason))));
  check('position numbering is 1-based: position 0 is refused rather than silently meaning the first residue',
    f(throwsWith(() => P.residueAtRefPos(aln, qry, 0), /1-based/) === true, throwsWith(() => P.residueAtRefPos(aln, qry, 0), /1-based/) !== true));
  check('the first and last reference positions read correctly, so the 1-based offset is right at both ends',
    f(P.residueAtRefPos(aln, qry, 1).residue === 'A' && P.residueAtRefPos(aln, qry, 5).residue === 'F',
      !(P.residueAtRefPos(aln, qry, 1).residue === 'A' && P.residueAtRefPos(aln, qry, 5).residue === 'F')));
}

// ====================================================================================================
// 9. predictLambdaMax: THE SITES IT COULD NOT READ ARE PART OF THE ANSWER
// ====================================================================================================
// All sequences, shifts and baselines below are SYNTHETIC. No spectral measurement is asserted.
{
  const ref = 'MKAHDEYCWRGSTKDEQHLAVFPNQ';
  const sub = 'MKAHNEYCWRGSTKDEQQLAVFPNQ';     // ref 5 D->N, ref 18 H->Q
  const gapped = 'MKAHDEYCWRGSTKDEQLAVFPNQ';    // ref 18 deleted
  const shifts = [
    { site: 5, from: 'D', shifts: { N: -14 } },      // SYNTHETIC
    { site: 18, from: 'H', shifts: { Q: 7 } },       // SYNTHETIC
  ];

  const p = P.predictLambdaMax(sub, ref, shifts, { baseline: 500 });
  check('two substitutions in the table sum onto the baseline: 500 - 14 + 7 = 493',
    f(p.nm === 493, p.nm !== 493), `${p.nm}`);
  check('both applied shifts are itemised with the substitution that produced them',
    f(p.applied.length === 2 && p.applied[0].from === 'D' && p.applied[0].to === 'N' && p.applied[1].shift_nm === 7,
      !(p.applied.length === 2 && p.applied[0].from === 'D' && p.applied[0].to === 'N' && p.applied[1].shift_nm === 7)),
    JSON.stringify(p.applied));
  check('and the total shift is reported separately from the baselined wavelength',
    f(p.total_shift_nm === -7 && p.baseline === 500, !(p.total_shift_nm === -7 && p.baseline === 500)), `${p.total_shift_nm}`);
  check('with all sites read, nothing is unmatched and the flag says so',
    f(p.all_sites_read === true && p.unmatched_sites.length === 0 && p.sites_read === 2 && p.sites_total === 2,
      !(p.all_sites_read === true && p.unmatched_sites.length === 0 && p.sites_read === 2 && p.sites_total === 2)));

  // THE CENTRAL GUARD: an unread site must not look like a site read as identical to the reference.
  const g = P.predictLambdaMax(gapped, ref, shifts, { baseline: 500 });
  check('a site lost to an alignment gap appears in unmatched_sites, by number and with the reason',
    f(g.unmatched_sites.some(u => u.site === 18 && u.reason === 'alignment-gap'), !g.unmatched_sites.some(u => u.site === 18 && u.reason === 'alignment-gap')),
    JSON.stringify(g.unmatched_sites));
  check('and it is NOT counted as read',
    f(g.sites_read === 1 && g.sites_total === 2 && g.all_sites_read === false,
      !(g.sites_read === 1 && g.sites_total === 2 && g.all_sites_read === false)), `${g.sites_read}/${g.sites_total}`);
  check('the fraction read is reported, so a partial prediction cannot be quoted as a whole one',
    f(g.fraction_of_sites_read === 0.5, g.fraction_of_sites_read !== 0.5), `${g.fraction_of_sites_read}`);
  check('every site is accounted for exactly once: applied + reference-state + unmatched equals the table size',
    f(g.applied.length + g.reference_state_sites.length + g.unmatched_sites.length === g.sites_total,
      g.applied.length + g.reference_state_sites.length + g.unmatched_sites.length !== g.sites_total));
  check('and the module says in words that an unread site was not given a shift of zero as a decision',
    f(/was NOT given a shift of zero as a decision/.test(g.unread_sites_are_not_zero), !/was NOT given a shift of zero as a decision/.test(g.unread_sites_are_not_zero)));
  // The two predictions that would be confused: one site read as reference-state, one site unread.
  const refState = P.predictLambdaMax(ref, ref, shifts, { baseline: 500 });
  check('a sequence identical to the reference gives the baseline back, with both sites in reference_state',
    f(refState.nm === 500 && refState.reference_state_sites.length === 2 && refState.all_sites_read === true,
      !(refState.nm === 500 && refState.reference_state_sites.length === 2 && refState.all_sites_read === true)));
  check('and it is DISTINGUISHABLE from the gapped case despite both having nm at or near the baseline',
    f(refState.all_sites_read !== g.all_sites_read && refState.sites_read !== g.sites_read,
      !(refState.all_sites_read !== g.all_sites_read && refState.sites_read !== g.sites_read)),
    `${refState.sites_read}/${refState.sites_total} vs ${g.sites_read}/${g.sites_total}`);

  // A substitution the table says nothing about: read, but not interpretable.
  const odd = 'MKAHWEYCWRGSTKDEQHLAVFPNQ';     // ref 5 D->W, which no shift covers
  const o = P.predictLambdaMax(odd, ref, shifts, { baseline: 500 });
  check('a substitution absent from the shift table is unmatched with its own distinct reason',
    f(o.unmatched_sites.some(u => u.site === 5 && u.reason === 'substitution-not-in-shift-table' && u.observed_residue === 'W'),
      !o.unmatched_sites.some(u => u.site === 5 && u.reason === 'substitution-not-in-shift-table' && u.observed_residue === 'W')),
    JSON.stringify(o.unmatched_sites));
  check('and the shift it does not have is not applied: the total moves only by the site that was covered',
    f(o.total_shift_nm === 0 && o.nm === 500, !(o.total_shift_nm === 0 && o.nm === 500)), `${o.total_shift_nm}`);
  check('the unmatched entry lists which residues the table DOES cover, so the gap in the table is visible',
    f(o.unmatched_sites.find(u => u.site === 5).shifts_available_for.join(',') === 'N',
      o.unmatched_sites.find(u => u.site === 5).shifts_available_for.join(',') !== 'N'));

  // A reference-numbering slip is the commonest way this goes silently wrong.
  const wrongFrom = [{ site: 5, from: 'E', shifts: { N: -14 } }];
  const wf = P.predictLambdaMax(sub, ref, wrongFrom, { baseline: 500 });
  check('a shift table that disagrees with the reference sequence about the reference residue is refused at that site',
    f(wf.unmatched_sites.some(u => u.reason === 'reference-residue-mismatch' && u.expected_in_table === 'E' && u.found_in_refSeq === 'D'),
      !wf.unmatched_sites.some(u => u.reason === 'reference-residue-mismatch' && u.expected_in_table === 'E' && u.found_in_refSeq === 'D')),
    JSON.stringify(wf.unmatched_sites));
  check('and no shift is applied through the mismatch',
    f(wf.total_shift_nm === 0, wf.total_shift_nm !== 0), `${wf.total_shift_nm}`);
  check('a site past the end of the reference is unmatched rather than throwing or wrapping',
    f(P.predictLambdaMax(sub, ref, [{ site: 999, shifts: { N: 1 } }], { baseline: 500 }).unmatched_sites[0].reason === 'site-past-end-of-reference',
      P.predictLambdaMax(sub, ref, [{ site: 999, shifts: { N: 1 } }], { baseline: 500 }).unmatched_sites[0].reason !== 'site-past-end-of-reference'));

  // No baseline: the shift alone must not be returned wearing the name nm.
  const nb = P.predictLambdaMax(sub, ref, shifts, {});
  check('with no baseline, nm is null rather than the bare shift',
    f(nb.nm === null && nb.total_shift_nm === -7, !(nb.nm === null && nb.total_shift_nm === -7)), `${nb.nm}`);
  check('and it says why, naming the unit error it is refusing to make',
    f(/unit error with a plausible-looking magnitude/.test(nb.nm_is_null_because), !/unit error with a plausible-looking magnitude/.test(nb.nm_is_null_because)));
  check('and what would have to be measured to supply one',
    f(typeof nb.what_would_have_to_be_measured === 'string' && /lambda-max of the reference/.test(nb.what_would_have_to_be_measured),
      !(typeof nb.what_would_have_to_be_measured === 'string' && /lambda-max of the reference/.test(nb.what_would_have_to_be_measured))));
  check('with a baseline, those two null-explaining fields go away rather than lingering as noise',
    f(p.nm_is_null_because === null && p.what_would_have_to_be_measured === null, !(p.nm_is_null_because === null && p.what_would_have_to_be_measured === null)));

  // No band, and the additivity assumption owned.
  check('no interval is invented around the prediction: band.value is null with its reason',
    f(p.band.value === null && /carries no residual/.test(p.band.null_reason), !(p.band.value === null && /carries no residual/.test(p.band.null_reason))));
  check('and the band says what would have to be measured to form one',
    f(/per-site standard errors/.test(p.band.what_would_have_to_be_measured), !/per-site standard errors/.test(p.band.what_would_have_to_be_measured)));
  check('the additivity assumption is declared as THIS function\'s, not the literature\'s',
    f(p.additivity_assumed === true && /That assumption is this/.test(p.additivity_note) && /function's/.test(p.additivity_note),
      !(p.additivity_assumed === true && /That assumption is this/.test(p.additivity_note) && /function's/.test(p.additivity_note))));
  check('the alignment the sites were read through is summarised, so a bad alignment is visible in the result',
    f(Number.isFinite(p.alignment_summary.score) && p.alignment_summary.ref_length === ref.length,
      !(Number.isFinite(p.alignment_summary.score) && p.alignment_summary.ref_length === ref.length)));

  // Refusals.
  check('an empty shift table is refused, because a prediction from zero tuned sites is the baseline',
    f(throwsWith(() => P.predictLambdaMax(sub, ref, [], { baseline: 500 }), /zero tuned sites/) === true,
      throwsWith(() => P.predictLambdaMax(sub, ref, [], { baseline: 500 }), /zero tuned sites/) !== true));
  check('a duplicated site is refused, because an additive model would count it twice',
    f(throwsWith(() => P.predictLambdaMax(sub, ref, [shifts[0], shifts[0]], { baseline: 500 }), /appears twice/) === true,
      throwsWith(() => P.predictLambdaMax(sub, ref, [shifts[0], shifts[0]], { baseline: 500 }), /appears twice/) !== true));
  check('a non-integer site number is refused',
    f(throwsWith(() => P.predictLambdaMax(sub, ref, [{ site: 5.5, shifts: { N: 1 } }], { baseline: 500 })) === true,
      throwsWith(() => P.predictLambdaMax(sub, ref, [{ site: 5.5, shifts: { N: 1 } }], { baseline: 500 })) !== true));
  check('a non-finite shift value is refused rather than propagating a NaN into nm',
    f(throwsWith(() => P.predictLambdaMax(sub, ref, [{ site: 5, shifts: { N: 'lots' } }], { baseline: 500 })) === true,
      throwsWith(() => P.predictLambdaMax(sub, ref, [{ site: 5, shifts: { N: 'lots' } }], { baseline: 500 })) !== true));
  check('the prediction is frozen',
    f(Object.isFrozen(p) && Object.isFrozen(p.band), !(Object.isFrozen(p) && Object.isFrozen(p.band))));
}

// ====================================================================================================
// 10. CORRELATION, AGAINST ARITHMETIC DONE BY HAND
// ====================================================================================================
// xs = [1,2,3,4,5], ys = [2,4,5,4,5]. mean x = 3, mean y = 4.
//   dx = [-2,-1,0,1,2], dy = [-2,0,1,0,1]
//   sum dx*dy = 4+0+0+0+2 = 6 ; sum dx^2 = 10 ; sum dy^2 = 6
//   r = 6 / sqrt(60) = 0.7745966692414834
{
  const xs = [1, 2, 3, 4, 5], ys = [2, 4, 5, 4, 5];
  check('pearson matches the hand-worked 6/sqrt(60) to full double precision',
    f(P.pearson(xs, ys) === 6 / Math.sqrt(60), P.pearson(xs, ys) !== 6 / Math.sqrt(60)), `${P.pearson(xs, ys)}`);
  check('a sequence against itself is exactly +1, and against its negation exactly -1',
    f(P.pearson(xs, xs) === 1 && P.pearson(xs, xs.map(v => -v)) === -1, !(P.pearson(xs, xs) === 1 && P.pearson(xs, xs.map(v => -v)) === -1)));
  check('pearson is invariant to a positive affine rescaling of either input',
    f(near(P.pearson(xs, ys), P.pearson(xs.map(v => 3 * v + 7), ys), 1e-12), !near(P.pearson(xs, ys), P.pearson(xs.map(v => 3 * v + 7), ys), 1e-12)));

  // Mid-ranks: [10,20,20,30] -> [1, 2.5, 2.5, 4].
  check('ranks uses mid-ranks for ties, so the tied pair shares 2.5',
    f(JSON.stringify(P.ranks([10, 20, 20, 30])) === '[1,2.5,2.5,4]', JSON.stringify(P.ranks([10, 20, 20, 30])) !== '[1,2.5,2.5,4]'),
    JSON.stringify(P.ranks([10, 20, 20, 30])));
  check('ranks is order-correct on an unsorted input',
    f(JSON.stringify(P.ranks([5, 1, 9, 3])) === '[3,1,4,2]', JSON.stringify(P.ranks([5, 1, 9, 3])) !== '[3,1,4,2]'), JSON.stringify(P.ranks([5, 1, 9, 3])));
  check('ranks of an all-tied vector are all the same mid-rank, which is why spearman then refuses',
    f(JSON.stringify(P.ranks([7, 7, 7])) === '[2,2,2]' && throwsWith(() => P.spearman([7, 7, 7], [1, 2, 3]), /zero variance/),
      !(JSON.stringify(P.ranks([7, 7, 7])) === '[2,2,2]' && throwsWith(() => P.spearman([7, 7, 7], [1, 2, 3]), /zero variance/))));

  // A perfect monotone but strongly nonlinear relation: spearman must be exactly 1, pearson must not be.
  const cubic = [1, 8, 27, 64, 125];
  check('a perfect monotone nonlinear relation gives spearman exactly 1',
    f(P.spearman(xs, cubic) === 1, P.spearman(xs, cubic) !== 1), `${P.spearman(xs, cubic)}`);
  check('and pearson strictly less than 1 on the same data, which is the whole reason both exist',
    f(P.pearson(xs, cubic) < 1 && P.pearson(xs, cubic) > 0.9, !(P.pearson(xs, cubic) < 1 && P.pearson(xs, cubic) > 0.9)), `${P.pearson(xs, cubic)}`);
  check('spearman survives a monotone transform of either axis unchanged',
    f(P.spearman(xs, ys) === P.spearman(xs.map(v => Math.exp(v)), ys), P.spearman(xs, ys) !== P.spearman(xs.map(v => Math.exp(v)), ys)));

  check('zero variance is refused rather than returning 0, which would read as "no relation"',
    f(throwsWith(() => P.pearson([1, 1, 1], [1, 2, 3]), /zero variance/) === true, throwsWith(() => P.pearson([1, 1, 1], [1, 2, 3]), /zero variance/) !== true));
  check('a length mismatch is refused',
    f(throwsWith(() => P.pearson([1, 2, 3], [1, 2]), /length mismatch/) === true, throwsWith(() => P.pearson([1, 2, 3], [1, 2]), /length mismatch/) !== true));
  check('fewer than three points is refused',
    f(throwsWith(() => P.pearson([1, 2], [3, 4]), /not a statistic/) === true, throwsWith(() => P.pearson([1, 2], [3, 4]), /not a statistic/) !== true));
  check('a non-finite value is refused, and the message says the caller must drop pairs and record the drop',
    f(throwsWith(() => P.pearson([1, 2, NaN], [1, 2, 3]), /dropped by the caller, pairwise/) === true,
      throwsWith(() => P.pearson([1, 2, NaN], [1, 2, 3]), /dropped by the caller, pairwise/) !== true));
}

// ====================================================================================================
// 11. ciFisher RETURNS A BAND, OR REFUSES
// ====================================================================================================
// r = 0.7745966692414834, n = 5. z = artanh(r) = 1.03172...; se = 1/sqrt(5-3) = 0.70710678...
//   lo = tanh(z - 1.959964*se) = -0.34008203518751035
//   hi = tanh(z + 1.959964*se) =  0.9842357551507267
{
  const r = 6 / Math.sqrt(60);
  const ci = P.ciFisher(r, 5);
  check('the 95% interval matches the hand-worked Fisher-z bounds to 10 decimals',
    f(near(ci.lo, -0.34008203518751035, 1e-10) && near(ci.hi, 0.9842357551507267, 1e-10),
      !(near(ci.lo, -0.34008203518751035, 1e-10) && near(ci.hi, 0.9842357551507267, 1e-10))), `${ci.lo} .. ${ci.hi}`);
  check('the interval brackets r and has positive width',
    f(ci.lo < r && r < ci.hi && ci.width > 0, !(ci.lo < r && r < ci.hi && ci.width > 0)));
  check('it is flagged as an interval and names the standard-error form that produced it',
    f(ci.is_an_interval === true && ci.se_form === '1/sqrt(n-3)', !(ci.is_an_interval === true && ci.se_form === '1/sqrt(n-3)')));
  check('and says plainly that the interval, not r, is the result',
    f(/The interval is the result/.test(ci.not_a_point), !/The interval is the result/.test(ci.not_a_point)));
  check('and states the normality assumption, and that applying it to a Spearman r is rougher',
    f(/bivariate normality/.test(ci.assumes) && /Spearman/.test(ci.assumes), !(/bivariate normality/.test(ci.assumes) && /Spearman/.test(ci.assumes))));
  check('a bigger sample at the same r gives a strictly narrower interval',
    f(P.ciFisher(r, 50).width < P.ciFisher(r, 5).width, !(P.ciFisher(r, 50).width < P.ciFisher(r, 5).width)),
    `${P.ciFisher(r, 50).width.toFixed(4)} vs ${P.ciFisher(r, 5).width.toFixed(4)}`);
  check('at this n the interval crosses zero, so a r of 0.77 on five points supports no sign claim',
    f(ci.lo < 0 && ci.hi > 0, !(ci.lo < 0 && ci.hi > 0)), `${ci.lo.toFixed(3)} .. ${ci.hi.toFixed(3)}`);
  const small = P.ciFisher(0.9, 3);
  check('n = 3 is refused: lo and hi are null with the reason that 1/sqrt(n-3) is undefined',
    f(small.lo === null && small.hi === null && /undefined for n <= 3/.test(small.null_reason),
      !(small.lo === null && small.hi === null && /undefined for n <= 3/.test(small.null_reason))));
  check('and the refusal says what would have to be measured instead of inventing a band',
    f(/More paired observations/.test(small.what_would_have_to_be_measured), !/More paired observations/.test(small.what_would_have_to_be_measured)));
  const perfect = P.ciFisher(1, 10);
  check('a perfect r collapses the interval, and that is reported as DEGENERATE, not as precision',
    f(perfect.degenerate === true && perfect.is_an_interval === false && /NOT a statement that the correlation is known exactly/.test(perfect.degenerate_reason),
      !(perfect.degenerate === true && perfect.is_an_interval === false && /NOT a statement that the correlation is known exactly/.test(perfect.degenerate_reason))));
  check('an r outside [-1, 1] is refused',
    f(throwsWith(() => P.ciFisher(1.2, 10), /must be in/) === true, throwsWith(() => P.ciFisher(1.2, 10), /must be in/) !== true));
  check('the z quantile is the two-sided 0.975 normal quantile to 12 decimals',
    f(near(P.Z_975, 1.959963984540054, 1e-12), !near(P.Z_975, 1.959963984540054, 1e-12)), `${P.Z_975}`);
  check('the result is frozen',
    f(Object.isFrozen(ci), !Object.isFrozen(ci)));
}

// ====================================================================================================
// 12. THE PERMUTATION TEST IS SEEDED, REPRODUCIBLE, AND NOT SIGNIFICANT WHEN IT SHOULD NOT BE
// ====================================================================================================
{
  const xs = [1, 2, 3, 4, 5, 6], ys = [3, 1, 4, 2, 6, 5];
  const a1 = P.permutationTest(xs, ys, { iters: 2000, seed: 42 });
  const a2 = P.permutationTest(xs, ys, { iters: 2000, seed: 42 });
  check('the same seed gives bit-identical p, n_ge and observed statistic',
    f(a1.p === a2.p && a1.n_ge === a2.n_ge && a1.observed === a2.observed, !(a1.p === a2.p && a1.n_ge === a2.n_ge && a1.observed === a2.observed)),
    `${a1.p} vs ${a2.p}`);
  check('the seed is reported back, with a one-line recipe for reproducing the p exactly',
    f(a1.seed === 42 && /seed: 42/.test(a1.reproduce_with) && a1.deterministic === true, !(a1.seed === 42 && /seed: 42/.test(a1.reproduce_with) && a1.deterministic === true)),
    a1.reproduce_with);
  check('a different seed gives a different draw, so the seed is actually driving the shuffling',
    f(P.permutationTest(xs, ys, { iters: 2000, seed: 7 }).n_ge !== a1.n_ge || P.permutationTest(xs, ys, { iters: 2000, seed: 7 }).p !== a1.p,
      !(P.permutationTest(xs, ys, { iters: 2000, seed: 7 }).n_ge !== a1.n_ge || P.permutationTest(xs, ys, { iters: 2000, seed: 7 }).p !== a1.p)));
  check('the observed statistic is the same one pearson would give',
    f(a1.observed === P.pearson(xs, ys), a1.observed !== P.pearson(xs, ys)));

  // Exhaustive cross-check. For n = 6 there are 720 permutations, so the exact two-sided p is
  // computable and the Monte Carlo estimate must converge to it.
  const permsOf = (arr) => { if (arr.length <= 1) return [arr]; const out = []; for (let i = 0; i < arr.length; i++) { const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]; for (const q of permsOf(rest)) out.push([arr[i], ...q]); } return out; };
  const all = permsOf(ys);
  const absObs = Math.abs(P.pearson(xs, ys));
  const ge = all.filter(q => Math.abs(P.pearson(xs, q)) >= absObs - 1e-12).length;
  const pExact = ge / all.length;
  const mc = P.permutationTest(xs, ys, { iters: 20000, seed: 5 });
  check('the exhaustive enumeration itself is sane: 720 permutations and a p strictly inside (0, 1)',
    f(all.length === 720 && pExact > 0 && pExact < 1, !(all.length === 720 && pExact > 0 && pExact < 1)), `${all.length}, p_exact ${pExact}`);
  check('the Monte Carlo p converges to the exact permutation p within 0.02 at 20000 draws',
    f(near(mc.p, pExact, 0.02), !near(mc.p, pExact, 0.02)), `mc ${mc.p.toFixed(4)} vs exact ${pExact}`);

  // A relation with essentially no signal must NOT come out significant. The pair below was found by a
  // seeded search for |r| near 0.12 and is reproducible: mulberry32(2024), 12 points.
  const nx = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const nullY = [5, 6, 2, 11, 7, 3, 8, 9, 12, 1, 10, 4];
  const nullR = P.pearson(nx, nullY);
  check('the designed null pair really is near-null: |r| below 0.2 on twelve points',
    f(Math.abs(nullR) < 0.2, !(Math.abs(nullR) < 0.2)), `${nullR}`);
  const nullP = P.permutationTest(nx, nullY, { iters: 5000, seed: 1 });
  check('an obviously null relation does NOT come out significant',
    f(nullP.p > 0.05, !(nullP.p > 0.05)), `p ${nullP.p.toFixed(4)}`);
  check('in fact it comes out thoroughly unremarkable, p above 0.3',
    f(nullP.p > 0.3, !(nullP.p > 0.3)), `p ${nullP.p.toFixed(4)}`);
  check('and its confidence interval straddles zero, which is the same message in the other units',
    f(P.ciFisher(nullR, nx.length).lo < 0 && P.ciFisher(nullR, nx.length).hi > 0,
      !(P.ciFisher(nullR, nx.length).lo < 0 && P.ciFisher(nullR, nx.length).hi > 0)));

  // A strong relation must come out small, so the test discriminates rather than always saying "null".
  const strong = P.permutationTest([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], { iters: 2000, seed: 1 });
  check('a perfect relation comes out below 0.005, so the test is not uniformly conservative',
    f(strong.p < 0.005, !(strong.p < 0.005)), `p ${strong.p}`);
  check('p can never be exactly 0, and the floor is reported with what it means',
    f(strong.p > 0 && strong.p_floor === 1 / 2001 && /upper bound on p, not a small p value/.test(strong.p_at_floor_means),
      !(strong.p > 0 && strong.p_floor === 1 / 2001 && /upper bound on p, not a small p value/.test(strong.p_at_floor_means))),
    `${strong.p} floor ${strong.p_floor}`);
  check('the p-value estimator is stated as a formula rather than left to be inferred',
    f(/\(1 \+ #\{ \|stat_perm\| >= \|stat_obs\| \}\) \/ \(1 \+ iters\)/.test(a1.p_definition), !/\(1 \+ #\{ \|stat_perm\| >= \|stat_obs\| \}\) \/ \(1 \+ iters\)/.test(a1.p_definition)));
  check('it says a p is not an effect size and must be quoted next to the interval',
    f(/not an effect size/.test(a1.not_a_fused_score) && /ciFisher/.test(a1.not_a_fused_score), !(/not an effect size/.test(a1.not_a_fused_score) && /ciFisher/.test(a1.not_a_fused_score))));
  check('and it says what the test does NOT test, including the single-leverage-point problem',
    f(/leverage point/.test(a1.what_it_tests) && /causal/.test(a1.what_it_tests), !(/leverage point/.test(a1.what_it_tests) && /causal/.test(a1.what_it_tests))));

  // The spearman variant must actually be a different test.
  const nonRank = [3, 1, 4, 2, 600, 5];
  check('the spearman variant gives the rank statistic as observed, differing from the pearson one',
    f(P.permutationTest(xs, nonRank, { iters: 1000, seed: 3, statistic: 'spearman' }).observed !== P.permutationTest(xs, nonRank, { iters: 1000, seed: 3, statistic: 'pearson' }).observed,
      !(P.permutationTest(xs, nonRank, { iters: 1000, seed: 3, statistic: 'spearman' }).observed !== P.permutationTest(xs, nonRank, { iters: 1000, seed: 3, statistic: 'pearson' }).observed)),
    `${P.permutationTest(xs, nonRank, { iters: 1000, seed: 3, statistic: 'spearman' }).observed} vs ${P.permutationTest(xs, nonRank, { iters: 1000, seed: 3, statistic: 'pearson' }).observed}`);
  check('and the spearman observed statistic equals spearman() on the same data',
    f(near(P.permutationTest(xs, nonRank, { iters: 100, seed: 3, statistic: 'spearman' }).observed, P.spearman(xs, nonRank), 1e-12),
      !near(P.permutationTest(xs, nonRank, { iters: 100, seed: 3, statistic: 'spearman' }).observed, P.spearman(xs, nonRank), 1e-12)));
  check('an unknown statistic is refused rather than silently defaulting to pearson',
    f(throwsWith(() => P.permutationTest(xs, ys, { statistic: 'kendall' }), /must be one of/) === true,
      throwsWith(() => P.permutationTest(xs, ys, { statistic: 'kendall' }), /must be one of/) !== true));
  check('a non-integer seed is refused, naming unreproducibility as the reason',
    f(throwsWith(() => P.permutationTest(xs, ys, { seed: 0.5 }), /unreproducible/) === true, throwsWith(() => P.permutationTest(xs, ys, { seed: 0.5 }), /unreproducible/) !== true));
  check('zero iterations is refused',
    f(throwsWith(() => P.permutationTest(xs, ys, { iters: 0 }), /positive integer/) === true, throwsWith(() => P.permutationTest(xs, ys, { iters: 0 }), /positive integer/) !== true));
  check('the result is frozen and names the PRNG',
    f(Object.isFrozen(a1) && a1.prng === 'mulberry32', !(Object.isFrozen(a1) && a1.prng === 'mulberry32')));

  // The PRNG itself.
  const g1 = P.mulberry32(1), g2 = P.mulberry32(1), g3 = P.mulberry32(2);
  const take = (g, k) => Array.from({ length: k }, () => g());
  const s1 = take(g1, 8), s2 = take(g2, 8), s3 = take(g3, 8);
  check('mulberry32 gives the same stream for the same seed and a different one for a different seed',
    f(JSON.stringify(s1) === JSON.stringify(s2) && JSON.stringify(s1) !== JSON.stringify(s3),
      !(JSON.stringify(s1) === JSON.stringify(s2) && JSON.stringify(s1) !== JSON.stringify(s3))));
  check('its output stays in [0, 1) and is not constant',
    f(s1.every(v => v >= 0 && v < 1) && new Set(s1).size === 8, !(s1.every(v => v >= 0 && v < 1) && new Set(s1).size === 8)));
  const many = take(P.mulberry32(12345), 20000);
  check('and it is roughly uniform over 20000 draws, so the shuffles are not biased to one corner',
    f(Math.abs(many.reduce((a, b) => a + b, 0) / many.length - 0.5) < 0.01, !(Math.abs(many.reduce((a, b) => a + b, 0) / many.length - 0.5) < 0.01)),
    `mean ${(many.reduce((a, b) => a + b, 0) / many.length).toFixed(4)}`);
}

// ====================================================================================================
// 13. demo() RUNS, AND SHOWS THE REFUSALS RATHER THAN HIDING THEM
// ====================================================================================================
{
  const d = P.demo();
  check('demo() runs end to end without touching anything outside the module',
    f(Number.isFinite(d.net_charge_ref_pH74) && Number.isFinite(d.pearson), !(Number.isFinite(d.net_charge_ref_pH74) && Number.isFinite(d.pearson))));
  check('and its Zmb value is null, like every other Zmb in this module',
    f(d.zmb_value === null, d.zmb_value !== null), `${d.zmb_value}`);
  check('its gapped example really does lose a site, so the demo exercises the guard rather than only the happy path',
    f(d.predicted_through_a_gap.all_sites_read === false && d.predicted_through_a_gap.sites_read < d.predicted_through_a_gap.sites_total,
      !(d.predicted_through_a_gap.all_sites_read === false && d.predicted_through_a_gap.sites_read < d.predicted_through_a_gap.sites_total)),
    `${d.predicted_through_a_gap.sites_read}/${d.predicted_through_a_gap.sites_total}`);
  check('and its substituted example applies both synthetic shifts',
    f(d.predicted.applied.length === 2 && d.predicted.nm === 493, !(d.predicted.applied.length === 2 && d.predicted.nm === 493)), `${d.predicted.nm}`);
  check('every exported constant object is frozen',
    f([P.SOURCES, P.PKA_THURLKILL_2006, P.PKA_GRIMSLEY_2009_FOLDED, P.PKA_SETS, P.PKA_ARG_UNMEASURED, P.PH_RANGE, P.AMBIGUOUS_OR_UNSUPPORTED, P.BLOSUM62, P.GAP_DEFAULTS, P.ZMB_CONVENTION, P.PERMUTATION_STATISTICS].every(Object.isFrozen),
      ![P.SOURCES, P.PKA_THURLKILL_2006, P.PKA_GRIMSLEY_2009_FOLDED, P.PKA_SETS, P.PKA_ARG_UNMEASURED, P.PH_RANGE, P.AMBIGUOUS_OR_UNSUPPORTED, P.BLOSUM62, P.GAP_DEFAULTS, P.ZMB_CONVENTION, P.PERMUTATION_STATISTICS].every(Object.isFrozen)));
}

// ====================================================================================================
console.log(`\n${pass} pass, ${fail} fail`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had its predicate inverted or its value replaced with a wrong one. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
