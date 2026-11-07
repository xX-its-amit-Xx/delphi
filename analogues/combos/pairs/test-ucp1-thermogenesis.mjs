#!/usr/bin/env node
// Tests for analogues/combos/pairs/ucp1-thermogenesis.mjs
//
//   node analogues/combos/pairs/test-ucp1-thermogenesis.mjs [--fail-once]
//
// Three things are checked harder than the rest, because they are the three ways these two dossiers
// could do damage if they were wrong:
//
//   1. PAIR 1 REACHING THE FUNCTIONAL-EQUIVALENCE CLASS ON ANYTHING OTHER THAN THE RESCUE. It is the one
//      pair in this folder that reaches the top class, so the tests check that it reaches it through
//      `rescue` being the strongest present kind, that the homology type is one-to-one on a stated
//      one-gene-per-side basis, and that the things the experiment did NOT restore are on the record in
//      the slot rather than in a comment.
//   2. PAIR 2 BEING FLATTERED INTO A CLASS. Every one of its seven kinds is absent. If any slot were
//      talked into present:true the pair would land in convergent-analogue and look like a finding, so
//      the tests pin each absence to the thing that is missing - no family assignment in any database,
//      no loss on the donor side, and a gain-of-function addition that is not a complementation.
//   3. A CITATION OR AN ACCESSION THAT NOBODY CHECKED. Every source token used in an evidence slot must
//      resolve in SOURCES, and every SOURCES entry must carry a verified_how with substance in it; every
//      literature entry must carry both a PMID and a DOI.
//
// --fail-once injects ONE fault per run and iterates over every assertion, substituting the broken value
// for that assertion alone. Each assertion must FAIL on the run that targets it. One that still passes
// under its own fault is a SURVIVOR and is asserting nothing about its subject. Faults here are predicate
// inversions and wrong-value substitutions only; no threshold is tightened to manufacture a failure.
import * as A from '../../analogy.mjs';
import * as M from './ucp1-thermogenesis.mjs';

const RANK = ['no-support', 'weak', 'moderate', 'strong', 'directly-tested'];
const rank = l => RANK.indexOf(l);
const P1 = 'ucp1-mouse-pig-knockin';
const P2 = 'dsup-hmgn1-chromatin-shield';
const LIT = ['zheng_2017', 'berg_2006', 'enerback_1997', 'pan_2019', 'hashimoto_2016', 'chavez_2019',
  'aguilar_2025', 'ricci_2021', 'escarcega_2023', 'birger_2003', 'birger_2005'];

/**
 * One pass over every assertion. `faultIndex` is the index of the single assertion whose f() returns the
 * broken value; -1 means no fault. Returns the per-assertion results in order.
 */
function run(faultIndex, log) {
  let ai = 0;                                     // assertion index; f() owns the increment
  const results = [];
  const f = (real, broken) => (ai++ === faultIndex ? broken : real);
  const check = (name, cond, detail = '') => {
    const i = ai - 1;                             // the index f() just consumed
    const ok = cond === true;
    results.push({ i, name, ok, detail });
    if (log) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ` - ${detail}` : ''}`);
  };

  const pair = id => M.PAIRS.find(p => p.id === id);
  const p1 = pair(P1), p2 = pair(P2);
  const s1 = M.SCORED[P1], s2 = M.SCORED[P2];
  const c1 = M.CLASSIFIED[P1], c2 = M.CLASSIFIED[P2];
  const r1 = M.REFUSALS[P1], r2 = M.REFUSALS[P2];

  // ==================================================================================================
  // 1. SCHEMA: the rows are in analogy.mjs's shape, not in a shape of their own
  // ==================================================================================================
  {
    const ids = M.PAIRS.map(p => p.id);
    check('the module exports exactly the two expected pairs, by id',
      f(ids.length === 2 && ids[0] === P1 && ids[1] === P2,
        !(ids.length === 2 && ids[0] === P1 && ids[1] === P2)), ids.join(', '));

    const wrongKeys = M.PAIRS.filter(p => {
      const ks = Object.keys(p.evidence);
      return ks.length !== A.EVIDENCE_IDS.length || !A.EVIDENCE_IDS.every(k => ks.includes(k));
    });
    check('every pair declares all seven evidence kinds and no kind outside EVIDENCE_IDS',
      f(wrongKeys.length === 0, wrongKeys.length !== 0), wrongKeys.map(p => p.id).join(', '));

    const absentNoWhy = M.PAIRS.flatMap(p => A.EVIDENCE_IDS
      .filter(k => p.evidence[k].present === false)
      .filter(k => typeof p.evidence[k].why !== 'string' || p.evidence[k].why.length < 30)
      .map(k => `${p.id}:${k}`));
    check('every ABSENT slot says in a why what is missing, at length',
      f(absentNoWhy.length === 0, absentNoWhy.length !== 0), absentNoWhy.join(', '));

    const presentNoWhat = M.PAIRS.flatMap(p => A.EVIDENCE_IDS
      .filter(k => p.evidence[k].present === true)
      .filter(k => !['what', 'result', 'homology_type_basis'].some(fld => typeof p.evidence[k][fld] === 'string'))
      .map(k => `${p.id}:${k}`));
    check('every PRESENT slot states what was measured or what the basis is',
      f(presentNoWhat.length === 0, presentNoWhat.length !== 0), presentNoWhat.join(', '));

    const orthTyped = M.PAIRS.filter(p => p.evidence['sequence-orthology'].present === true)
      .every(p => A.HOMOLOGY_TYPES.includes(p.evidence['sequence-orthology'].homology_type));
    check('any PRESENT sequence-orthology slot carries a homology_type drawn from HOMOLOGY_TYPES',
      f(orthTyped === true, orthTyped !== true));

    const noAmbiguous = M.PAIRS.filter(p =>
      A.AMBIGUOUS_HOMOLOGY_TYPES.includes(p.evidence['sequence-orthology'].homology_type));
    check('no pair here hides behind an unstated or ambiguous homology type',
      f(noAmbiguous.length === 0, noAmbiguous.length !== 0), noAmbiguous.map(p => p.id).join(', '));

    const ctxStated = M.PAIRS.every(p => p.developmental_context?.difference_stated === true
      && typeof p.developmental_context.a === 'string' && typeof p.developmental_context.b === 'string');
    check('both pairs state the developmental-context difference on BOTH sides, not just the flag',
      f(ctxStated === true, ctxStated !== true));

    const enoughDbs = M.PAIRS.every(p => Array.isArray(p.databases_searched) && p.databases_searched.length >= A.MIN_DATABASES);
    check(`both pairs searched at least MIN_DATABASES (${A.MIN_DATABASES}) resources`,
      f(enoughDbs === true, enoughDbs !== true), M.PAIRS.map(p => `${p.id}:${p.databases_searched.length}`).join(', '));
  }

  // ==================================================================================================
  // 2. THE CITATIONS: nothing is cited that was not checked
  // ==================================================================================================
  {
    const unresolved = M.SOURCE_TOKENS_USED.filter(t => !(t in M.SOURCES));
    check('every source token used in an evidence slot resolves to a SOURCES entry',
      f(unresolved.length === 0, unresolved.length !== 0), unresolved.join(', '));

    check('evidence slots actually cite sources rather than citing nothing',
      f(M.SOURCE_TOKENS_USED.length >= 8, !(M.SOURCE_TOKENS_USED.length >= 8)), `${M.SOURCE_TOKENS_USED.length}`);

    const noVerified = Object.entries(M.SOURCES)
      .filter(([, v]) => typeof v.verified_how !== 'string' || v.verified_how.length < 60)
      .map(([k]) => k);
    check('EVERY SOURCES entry carries a verified_how saying what was fetched and read back',
      f(noVerified.length === 0, noVerified.length !== 0), noVerified.join(', '));

    const litMissingIds = LIT.filter(k => !(k in M.SOURCES)
      || !/^\d{7,8}$/.test(M.SOURCES[k]?.pmid ?? '')
      || !/^10\.\d{4,9}\//.test(M.SOURCES[k]?.doi ?? ''));
    check('every literature source carries a well-formed PMID and a well-formed DOI',
      f(litMissingIds.length === 0, litMissingIds.length !== 0), litMissingIds.join(', '));

    const dbEntries = Object.keys(M.SOURCES).filter(k => !LIT.includes(k));
    check('the database records are carried as their own SOURCES entries, separately from the papers',
      f(dbEntries.length >= 10, !(dbEntries.length >= 10)), `${dbEntries.length}`);

    const noFakeDoiOnDbRecords = dbEntries.filter(k => 'doi' in M.SOURCES[k] || 'pmid' in M.SOURCES[k]);
    check('no database record is dressed up with a PMID or DOI it does not have',
      f(noFakeDoiOnDbRecords.length === 0, noFakeDoiOnDbRecords.length !== 0), noFakeDoiOnDbRecords.join(', '));
  }

  // ==================================================================================================
  // 3. PAIR 1: the rescue is real, and it is the reason the pair reaches the top class
  // ==================================================================================================
  {
    check('pair 1 classifies as orthologous-and-functionally-tested',
      f(c1.class === 'orthologous-and-functionally-tested', c1.class !== 'orthologous-and-functionally-tested'), c1.class);
    check('pair 1 is the one pair in this file marked a functional equivalent',
      f(c1.functional_equivalent === true && c2.functional_equivalent === false,
        !(c1.functional_equivalent === true && c2.functional_equivalent === false)),
      `${c1.functional_equivalent} / ${c2.functional_equivalent}`);
    check('pair 1 reaches that class through a DIRECT functional test, not through orthology quality',
      f(s1.directly_tested === true && s1.strongest.kind === 'rescue',
        !(s1.directly_tested === true && s1.strongest.kind === 'rescue')), s1.strongest?.kind);
    check('pair 1\'s homology type is one-to-one',
      f(s1.homology_type === 'one-to-one', s1.homology_type !== 'one-to-one'), s1.homology_type);
    check('and the one-to-one call is justified by a stated one-gene-per-side count, not asserted',
      f(/exactly one/i.test(p1.evidence['sequence-orthology'].homology_type_basis),
        !/exactly one/i.test(p1.evidence['sequence-orthology'].homology_type_basis)));
    check('the rescue slot names the locus the cassette went into',
      f(/porcine endogenous UCP1 locus/.test(p1.evidence['rescue'].into_what),
        !/porcine endogenous UCP1 locus/.test(p1.evidence['rescue'].into_what)), p1.evidence['rescue'].into_what);
    check('the rescue slot names the donor construct, promoter included',
      f(/adiponectin/i.test(p1.evidence['rescue'].what_was_introduced),
        !/adiponectin/i.test(p1.evidence['rescue'].what_was_introduced)));
    check('the rescue slot states the assay rather than only the outcome',
      f(/rectal temperature/i.test(p1.evidence['rescue'].assay) && /4 h at 4 C/.test(p1.evidence['rescue'].assay),
        !(/rectal temperature/i.test(p1.evidence['rescue'].assay) && /4 h at 4 C/.test(p1.evidence['rescue'].assay))));
    check('the rescue slot records what was NOT rescued, naming daily energy expenditure',
      f(/daily energy expenditure/i.test(p1.evidence['rescue'].what_was_NOT_rescued),
        !/daily energy expenditure/i.test(p1.evidence['rescue'].what_was_NOT_rescued)));
    check('and records that the expression is ectopic rather than at native dose from native regulation',
      f(/ectopic/i.test(p1.evidence['rescue'].what_was_NOT_rescued),
        !/ectopic/i.test(p1.evidence['rescue'].what_was_NOT_rescued)));
    check('the rescue is marked DIRECTIONAL, so it is not read as mutual substitutability',
      f(/reverse was not attempted/i.test(p1.evidence['rescue'].direction),
        !/reverse was not attempted/i.test(p1.evidence['rescue'].direction)), p1.evidence['rescue'].direction);
    check('no identity value is entered for pair 1, and the omission is explained',
      f(p1.evidence['sequence-orthology'].identity === null
        && /LOW QUALITY PROTEIN/.test(p1.evidence['sequence-orthology'].identity_not_stated_why),
        !(p1.evidence['sequence-orthology'].identity === null
          && /LOW QUALITY PROTEIN/.test(p1.evidence['sequence-orthology'].identity_not_stated_why))),
      String(p1.evidence['sequence-orthology'].identity));
    check('the synteny slot gives coordinates on BOTH assemblies, not a synteny-table assertion',
      f(/NC_000074\.7/.test(p1.evidence['synteny'].what) && /NC_139390\.1/.test(p1.evidence['synteny'].what),
        !(/NC_000074\.7/.test(p1.evidence['synteny'].what) && /NC_139390\.1/.test(p1.evidence['synteny'].what))));
    check('and the synteny slot says in its own words that it is no evidence about function',
      f(/nothing whatsoever about function/i.test(p1.evidence['synteny'].what_it_does_not_establish),
        !/nothing whatsoever about function/i.test(p1.evidence['synteny'].what_it_does_not_establish)));
    check('the loss-of-function slot records that the two phenotypes DIVERGE on adiposity',
      f(/NOT obese/.test(p1.evidence['lof-phenotype'].caveat_the_phenotypes_also_diverge),
        !/NOT obese/.test(p1.evidence['lof-phenotype'].caveat_the_phenotypes_also_diverge)));
    check('and records the paralogue-compensation proposal as a proposal, not as a measurement',
      f(/not a measurement/i.test(p1.evidence['lof-phenotype'].caveat_the_phenotypes_also_diverge),
        !/not a measurement/i.test(p1.evidence['lof-phenotype'].caveat_the_phenotypes_also_diverge)));
    check('pair 1\'s expression-domain slot is ABSENT, and its why names the missing brown depot',
      f(p1.evidence['expression-domain'].present === false
        && /no classical brown adipose tissue/i.test(p1.evidence['expression-domain'].why),
        !(p1.evidence['expression-domain'].present === false
          && /no classical brown adipose tissue/i.test(p1.evidence['expression-domain'].why))));
    check('pair 1\'s domain-architecture slot is ABSENT, and its why names the LOW QUALITY protein flag',
      f(p1.evidence['domain-architecture'].present === false
        && /LOW QUALITY PROTEIN/.test(p1.evidence['domain-architecture'].why),
        !(p1.evidence['domain-architecture'].present === false
          && /LOW QUALITY PROTEIN/.test(p1.evidence['domain-architecture'].why))));
    check('no one-to-many refusal fires on pair 1, so the top class was not reached past a live guard',
      f(!r1.refusals.some(x => x.id === 'one-to-many-is-not-equivalence'),
        r1.refusals.some(x => x.id === 'one-to-many-is-not-equivalence')), r1.refusals.map(x => x.id).join(', '));
    check('pair 1\'s band label is at least strong, and it got there with rescue present',
      f(rank(s1.confidence.label) >= rank('strong') && s1.present_kinds.includes('rescue'),
        !(rank(s1.confidence.label) >= rank('strong') && s1.present_kinds.includes('rescue'))),
      `${s1.confidence.label} / ${s1.present_kinds.join(',')}`);
    check('pair 1 is still not certain: the band top stays below 1',
      f(s1.confidence.hi < 1, !(s1.confidence.hi < 1)), `hi ${s1.confidence.hi}`);
    check('pair 1\'s note says the class understates how much the rescue left unrestored',
      f(/still not a clean substitution/i.test(p1.note), !/still not a clean substitution/i.test(p1.note)));
  }

  // ==================================================================================================
  // 4. PAIR 2: all seven absent, and the module answers with a refusal rather than a score
  // ==================================================================================================
  {
    check('pair 2 assembles to ZERO present evidence kinds',
      f(s2.present_kinds.length === 0, s2.present_kinds.length !== 0), s2.present_kinds.join(', '));
    check('pair 2 classifies as no-basis',
      f(c2.class === 'no-basis', c2.class !== 'no-basis'), c2.class);
    check('and the no-basis class carries its warning that this is about the SEARCH, not the biology',
      f(/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(c2.critical_warning ?? ''),
        !/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(c2.critical_warning ?? '')));
    check('the module answers pair 2 with a REFUSAL, not merely with a low band',
      f(r2.refused === true && r2.refusals.some(x => x.id === 'absence-of-evidence'),
        !(r2.refused === true && r2.refusals.some(x => x.id === 'absence-of-evidence'))),
      r2.refusals.map(x => x.id).join(', '));
    check('pair 2\'s homology_type is recorded as none rather than left undefined',
      f(s2.homology_type === 'none', s2.homology_type !== 'none'), s2.homology_type);
    check('pair 2\'s rescue absence distinguishes a gain-of-function ADDITION from a complementation',
      f(/is not complementation of an absence/i.test(p2.evidence['rescue'].why),
        !/is not complementation of an absence/i.test(p2.evidence['rescue'].why)));
    check('and it names the concrete experiment that would fill the slot, in a published assay',
      f(/Hmgn1-\/- mouse embryonic fibroblasts/.test(p2.evidence['rescue'].the_experiment_that_would_fill_this_slot),
        !/Hmgn1-\/- mouse embryonic fibroblasts/.test(p2.evidence['rescue'].the_experiment_that_would_fill_this_slot)));
    check('pair 2\'s lof absence says it is ONE-SIDED, with the donor side empty',
      f(/One-sided/i.test(p2.evidence['lof-phenotype'].why) && /no Dsup loss-of-function in any tardigrade/i.test(p2.evidence['lof-phenotype'].why),
        !(/One-sided/i.test(p2.evidence['lof-phenotype'].why) && /no Dsup loss-of-function in any tardigrade/i.test(p2.evidence['lof-phenotype'].why))));
    check('pair 2\'s orthology absence rests on FOUR named resources, not on one lookup',
      f(/InterPro/.test(p2.evidence['sequence-orthology'].why)
        && /UniProtKB/.test(p2.evidence['sequence-orthology'].why)
        && /NCBI Gene/.test(p2.evidence['sequence-orthology'].why)
        && /ortholog set/.test(p2.evidence['sequence-orthology'].why),
        !(/InterPro/.test(p2.evidence['sequence-orthology'].why)
          && /UniProtKB/.test(p2.evidence['sequence-orthology'].why)
          && /NCBI Gene/.test(p2.evidence['sequence-orthology'].why)
          && /ortholog set/.test(p2.evidence['sequence-orthology'].why))));
    check('and it states a limit on its own negative rather than selling it as exhaustive',
      f(/not a census of the genomes/i.test(p2.evidence['sequence-orthology'].how_strong_is_this_negative),
        !/not a census of the genomes/i.test(p2.evidence['sequence-orthology'].how_strong_is_this_negative)));
    check('pair 2\'s domain-architecture absence refuses to read one shared motif as a shared architecture',
      f(/not a shared architecture/i.test(p2.evidence['domain-architecture'].why),
        !/not a shared architecture/i.test(p2.evidence['domain-architecture'].why)));
    check('and the HMGN-like motif finding is kept on the record rather than dropped with the slot',
      f(/HMGN-like motif/.test(p2.evidence['domain-architecture'].why) && /HMGN/.test(p2.note),
        !(/HMGN-like motif/.test(p2.evidence['domain-architecture'].why) && /HMGN/.test(p2.note))));
    check('pair 2 records the function-first search as NOT performed, with the reason it was not',
      f(p2.analogue_search.performed === false && /sequence-first route/i.test(p2.analogue_search.why),
        !(p2.analogue_search.performed === false && /sequence-first route/i.test(p2.analogue_search.why))));
    check('pair 2\'s note carries the cell-type qualification that the protective claim fails in neurons',
      f(/doubtful surrogate/i.test(p2.note), !/doubtful surrogate/i.test(p2.note)));
    check('pair 2\'s note also carries that the mechanism may not be purely physical shielding',
      f(/may not be only physical shielding/i.test(p2.note), !/may not be only physical shielding/i.test(p2.note)));
    check('pair 2\'s band is at the floor: no-support, with the top no higher than one tenth',
      f(s2.confidence.label === 'no-support' && s2.confidence.hi <= 0.10,
        !(s2.confidence.label === 'no-support' && s2.confidence.hi <= 0.10)),
      `${s2.confidence.label} ${s2.confidence.lo}-${s2.confidence.hi}`);
    check('pair 2 is NOT promoted to convergent-analogue by the strength of its prose',
      f(c2.class !== 'convergent-analogue', c2.class === 'convergent-analogue'), c2.class);
  }

  // ==================================================================================================
  // 5. SCORED IS COMPUTED, NOT WRITTEN
  // ==================================================================================================
  {
    const keys = Object.keys(M.SCORED);
    check('SCORED carries exactly one verdict per pair, keyed by pair id',
      f(keys.length === M.PAIRS.length && M.PAIRS.every(p => p.id in M.SCORED),
        !(keys.length === M.PAIRS.length && M.PAIRS.every(p => p.id in M.SCORED))), keys.join(', '));

    const recomputed = M.PAIRS.every(p => {
      const live = A.scoreAnalogy(p.a, p.b, p.evidence);
      const held = M.SCORED[p.id];
      return live.confidence.lo === held.confidence.lo
        && live.confidence.hi === held.confidence.hi
        && live.confidence.label === held.confidence.label;
    });
    check('each held band equals what scoreAnalogy returns now, so none of it was typed in by hand',
      f(recomputed === true, recomputed !== true));

    const bands = M.PAIRS.every(p => M.SCORED[p.id].confidence.hi > M.SCORED[p.id].confidence.lo);
    check('every band has hi > lo, so no verdict collapses to a point',
      f(bands === true, bands !== true),
      M.PAIRS.map(p => `${p.id}:${M.SCORED[p.id].confidence.lo}-${M.SCORED[p.id].confidence.hi}`).join(' '));

    const digitFree = M.PAIRS.every(p => /[0-9]/.test(M.SCORED[p.id].headline) === false);
    check('no headline carries a digit, so no float can be quoted out of either verdict',
      f(digitFree === true, digitFree !== true));

    const noScalar = M.PAIRS.every(p => {
      const v = M.SCORED[p.id];
      return Object.values(v).every(x => typeof x !== 'number')
        && v.fused_scalar === null && v.score === null && v.probability === null;
    });
    check('neither verdict exposes a fused scalar at the top level, by any of its aliases',
      f(noScalar === true, noScalar !== true));

    const agree = M.PAIRS.every(p => M.CLASSIFIED[p.id].homology_type === M.SCORED[p.id].homology_type);
    check('SCORED and CLASSIFIED agree on the homology type for every pair',
      f(agree === true, agree !== true));

    const altReported = M.PAIRS.every(p => typeof M.SCORED[p.id].confidence.under_alternative_weighting.label === 'string');
    check('both verdicts carry the band recomputed under the alternative weighting',
      f(altReported === true, altReported !== true));

    check('the two pairs land in DIFFERENT classes, so the file is not two copies of one verdict',
      f(c1.class !== c2.class, c1.class === c2.class), `${c1.class} / ${c2.class}`);
  }

  return results;
}

// ====================================================================================================
const FAIL_ONCE = process.argv.includes('--fail-once');
const base = run(-1, !FAIL_ONCE);
const pass = base.filter(r => r.ok).length;
const fail = base.length - pass;

if (!FAIL_ONCE) {
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

console.log(`\nucp1-thermogenesis: --fail-once over ${base.length} assertions`);
console.log(`  clean run: ${pass} pass, ${fail} fail\n`);
const survivors = [];
for (let i = 0; i < base.length; i++) {
  const r = run(i, false)[i];
  if (!r) { survivors.push({ i, name: `(assertion ${i} did not execute)` }); continue; }
  if (r.ok) survivors.push(r);
}
for (const s of survivors) console.log(`  SURVIVOR  [${s.i}] ${s.name}`);
console.log(`\n  ${base.length} assertions, each faulted once in its own run. ${survivors.length} survived.`);
console.log(survivors.length === 0
  ? '  No survivors: every assertion is load-bearing.'
  : '  SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
process.exit(survivors.length || fail ? 1 : 0);
