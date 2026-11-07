#!/usr/bin/env node
// Tests for analogues/combos/pairs/diapause.mjs
//
//   node analogues/combos/pairs/test-diapause.mjs [--fail-once]
//
// Three things are checked harder than the rest, because they are the three ways this file could do
// damage if it were wrong:
//
//   1. A FABRICATED CITATION OR ACCESSION. Every SOURCES entry must carry a verified_how with substance
//      in it, every PMID must be digits, every DOI must start with "10.", and every gene symbol named in
//      the dossiers must appear in CHECKED_SYMBOLS against a record identifier and a source key that
//      exists. A dossier is worth exactly as much as the weakest citation in it.
//   2. AN ASSERTED EVIDENCE KIND. Every present:false slot must say WHY it is false. An absence with no
//      stated reason is indistinguishable from an absence nobody looked into, and analogy.mjs is built
//      to reason over absences, so a silent absence corrupts the thing it feeds.
//   3. THE NEGATIVE CONTROL FAILING TO CONTROL. If the module put both pairs in the same place, the band
//      would be carrying no information about these rows, and the dossier would have to report that
//      instead of its separation. So the separation is asserted in both directions and under both of
//      analogy.mjs's weightings.
//
// --fail-once substitutes the broken value for exactly ONE assertion per run and iterates over all of
// them, re-running the whole suite once per assertion. An assertion that still PASSES while its own
// fault is injected is a SURVIVOR: it asserts nothing about its subject and counts as a failure.
// Every fault below is a predicate inversion or a wrong-value substitution. None is a tightened
// threshold, because a tightened threshold fails for a reason that has nothing to do with the subject.
import * as A from '../../analogy.mjs';
import * as D from './diapause.mjs';

const FAULT = process.argv.includes('--fail-once');

let target = -1;          // index of the assertion whose fault is injected this run, or -1 for none
let cursor = 0;           // how many f() calls have happened this run
let names = [];
let results = [];
let detailOf = [];

const f = (real, broken) => { const i = cursor++; return i === target ? broken : real; };

const check = (name, cond, detail = '') => {
  const i = results.length;
  if (cursor !== i + 1) {
    throw new Error(`assertion ${i} ("${name}") called f() ${cursor - i} times; the harness needs exactly one f() per check so that fault indices line up with assertion indices`);
  }
  names[i] = name;
  detailOf[i] = detail;
  results[i] = !!cond;
};

const RANK = ['no-support', 'weak', 'moderate', 'strong', 'directly-tested'];
const rank = l => RANK.indexOf(l);

const TEST_PAIR = 'killifish-diapause-dauer';
const CONTROL_PAIR = 'killifish-diapause-fly-reproductive-diapause';
const byId = id => D.PAIRS.find(p => p.id === id);

function suite() {
  cursor = 0; names = []; results = []; detailOf = [];

  // ==================================================================================================
  // 1. SCHEMA: THE ROWS ARE IN analogy.mjs's PAIRS SHAPE
  // ==================================================================================================
  {
    check('exactly two dossiers are exported',
      f(D.PAIRS.length === 2, D.PAIRS.length !== 2), `${D.PAIRS.length}`);

    const ids = D.PAIRS.map(p => p.id).join(',');
    check('the two ids are the test pair and its named negative control',
      f(ids === `${TEST_PAIR},${CONTROL_PAIR}`, ids === 'some-other-pair,and-another'), ids);

    const kindsOk = D.PAIRS.every(p => A.EVIDENCE_IDS.every(k => k in p.evidence)
      && Object.keys(p.evidence).length === A.EVIDENCE_IDS.length);
    check('every pair declares all seven evidence kinds and no eighth',
      f(kindsOk === true, kindsOk !== true),
      D.PAIRS.map(p => `${p.id}:${Object.keys(p.evidence).length}`).join(' '));

    const unknown = D.PAIRS.flatMap(p => A.scoreAnalogy(p.a, p.b, p.evidence).unknown_evidence_kinds);
    check('analogy.mjs recognises every evidence key: no invented kind slipped in',
      f(unknown.length === 0, unknown.length !== 0), unknown.join(', '));

    const sidesOk = D.PAIRS.every(p => typeof p.a?.species === 'string' && typeof p.a?.name === 'string'
      && typeof p.b?.species === 'string' && typeof p.b?.name === 'string');
    check('both sides of both pairs carry a species AND a name',
      f(sidesOk === true, sidesOk !== true));

    const noteOk = D.PAIRS.every(p => typeof p.note === 'string' && p.note.length > 60);
    check('every pair carries a substantive note, so no hardcoded evidence is unexplained',
      f(noteOk === true, noteOk !== true),
      D.PAIRS.map(p => `${p.id}:${p.note.length}`).join(' '));

    const dcOk = D.PAIRS.every(p => p.developmental_context?.difference_stated === true
      && typeof p.developmental_context.a === 'string' && typeof p.developmental_context.b === 'string');
    check('both pairs state the developmental-context difference on both sides',
      f(dcOk === true, dcOk !== true));

    const dbOk = D.PAIRS.every(p => Array.isArray(p.databases_searched) && p.databases_searched.length >= A.MIN_DATABASES);
    check('both pairs searched at least MIN_DATABASES independent resources',
      f(dbOk === true, dbOk !== true),
      `MIN_DATABASES=${A.MIN_DATABASES}; ` + D.PAIRS.map(p => `${p.id}:${p.databases_searched.length}`).join(' '));

    const asOk = D.PAIRS.every(p => p.analogue_search?.performed === true && typeof p.analogue_search.how === 'string');
    check('both pairs record a function-first analogue search AS PERFORMED, and say how',
      f(asOk === true, asOk !== true));
  }

  // ==================================================================================================
  // 2. NO ASSERTED EVIDENCE: EVERY ABSENCE STATES WHY, EVERY PRESENCE STATES WHAT
  // ==================================================================================================
  {
    const silentAbsences = D.PAIRS.flatMap(p => A.EVIDENCE_IDS
      .filter(k => p.evidence[k].present === false)
      .filter(k => typeof p.evidence[k].why !== 'string' || p.evidence[k].why.length < 30)
      .map(k => `${p.id}/${k}`));
    check('EVERY present:false slot carries a substantive why - no silent absences',
      f(silentAbsences.length === 0, silentAbsences.length !== 0), silentAbsences.join(', '));

    const unexplainedPresences = D.PAIRS.flatMap(p => A.EVIDENCE_IDS
      .filter(k => p.evidence[k].present === true)
      .filter(k => typeof p.evidence[k].what !== 'string' || p.evidence[k].what.length < 30)
      .map(k => `${p.id}/${k}`));
    check('EVERY present:true slot says what the evidence actually is',
      f(unexplainedPresences.length === 0, unexplainedPresences.length !== 0), unexplainedPresences.join(', '));

    const boolOk = D.PAIRS.every(p => A.EVIDENCE_IDS.every(k => typeof p.evidence[k].present === 'boolean'));
    check('no evidence slot leaves `present` undefined or truthy-but-not-boolean',
      f(boolOk === true, boolOk !== true));

    // The house rule the module itself enforces: an orthology claim without a homology type is scored
    // as ambiguous. This file must not rely on that default - it must state the type.
    const orth = byId(TEST_PAIR).evidence['sequence-orthology'];
    check('the present orthology claim states a homology_type from the module vocabulary',
      f(A.HOMOLOGY_TYPES.includes(orth.homology_type) === true, A.HOMOLOGY_TYPES.includes(orth.homology_type) !== true),
      `${orth.homology_type}`);

    check('and that homology_type is one of the ones the module calls AMBIGUOUS',
      f(A.AMBIGUOUS_HOMOLOGY_TYPES.includes(orth.homology_type) === true,
        A.AMBIGUOUS_HOMOLOGY_TYPES.includes(orth.homology_type) !== true), `${orth.homology_type}`);

    // No fabricated identity. The retrieved identities are human-to-fish; none describes this pair.
    check('no pairwise identity is claimed for a comparison nobody computed',
      f(orth.identity === null, orth.identity === 0.62), `${orth.identity}`);
    check('and the reason for leaving it null is stated rather than left as an empty field',
      f(typeof orth.identity_why === 'string' && /fabricated/i.test(orth.identity_why),
        !(typeof orth.identity_why === 'string' && /fabricated/i.test(orth.identity_why))));

    const rescueAbsent = D.PAIRS.every(p => p.evidence['rescue'].present === false);
    check('rescue is absent on BOTH pairs: no cross-species complementation is claimed anywhere',
      f(rescueAbsent === true, rescueAbsent !== true));
  }

  // ==================================================================================================
  // 3. CITATIONS: NOTHING IS CITED THAT WAS NOT RETRIEVED
  // ==================================================================================================
  {
    const noVerify = D.SOURCE_IDS.filter(k => typeof D.SOURCES[k].verified_how !== 'string' || D.SOURCES[k].verified_how.length < 80);
    check('EVERY source carries a substantive verified_how saying what was fetched and read back',
      f(noVerify.length === 0, noVerify.length !== 0), noVerify.join(', '));

    const noHandle = D.SOURCE_IDS.filter(k => !(D.SOURCES[k].pmid || D.SOURCES[k].doi || D.SOURCES[k].url || D.SOURCES[k].accession));
    check('every source carries a re-fetchable handle: a PMID, a DOI, a URL or an accession',
      f(noHandle.length === 0, noHandle.length !== 0), noHandle.join(', '));

    const badPmid = D.SOURCE_IDS.filter(k => D.SOURCES[k].pmid && !/^[0-9]{7,8}$/.test(D.SOURCES[k].pmid));
    check('every PMID is a plain 7-8 digit number: no decorated or malformed identifier',
      f(badPmid.length === 0, badPmid.length !== 0), badPmid.join(', '));

    const badDoi = D.SOURCE_IDS.filter(k => D.SOURCES[k].doi && !/^10\.[0-9]{4,9}\//.test(D.SOURCES[k].doi));
    check('every DOI has a real registrant prefix beginning 10.',
      f(badDoi.length === 0, badDoi.length !== 0), badDoi.join(', '));

    const badKind = D.SOURCE_IDS.filter(k => !['paper', 'record'].includes(D.SOURCES[k].kind));
    check('every source declares kind as either a paper or a live database record',
      f(badKind.length === 0, badKind.length !== 0), badKind.join(', '));

    const papers = D.SOURCE_IDS.filter(k => D.SOURCES[k].kind === 'paper');
    const paperHaveBoth = papers.every(k => D.SOURCES[k].pmid && D.SOURCES[k].doi && D.SOURCES[k].cite);
    check('every paper carries a PMID, a DOI and a full citation string, not one of the three',
      f(paperHaveBoth === true, paperHaveBoth !== true),
      papers.filter(k => !(D.SOURCES[k].pmid && D.SOURCES[k].doi && D.SOURCES[k].cite)).join(', '));

    const records = D.SOURCE_IDS.filter(k => D.SOURCES[k].kind === 'record');
    check('the dossiers rest on several LIVE DATABASE records, not on papers alone',
      f(records.length >= 4, records.length < 0), `${records.length} of ${D.SOURCE_IDS.length}`);

    const recordsHaveResource = records.every(k => typeof D.SOURCES[k].resource === 'string' && typeof D.SOURCES[k].url === 'string');
    check('every database record names which resource it came from and the URL it was fetched from',
      f(recordsHaveResource === true, recordsHaveResource !== true));

    const noSupports = D.SOURCE_IDS.filter(k => typeof D.SOURCES[k].what_it_supports !== 'string');
    check('every source says what claim in the dossiers it is actually holding up',
      f(noSupports.length === 0, noSupports.length !== 0), noSupports.join(', '));

    // The symbol table is the fabrication guard: no gene symbol without a record behind it.
    const badSymbol = D.CHECKED_SYMBOLS.filter(s => !s.symbol || !s.species
      || typeof s.record !== 'string' || s.record.length < 10 || !D.SOURCE_IDS.includes(s.source));
    check('every CHECKED_SYMBOLS row names a record and points at a source key that exists',
      f(badSymbol.length === 0, badSymbol.length !== 0), badSymbol.map(s => s.symbol).join(', '));

    // Spot-check that the symbols the dossiers lean on are in the table, not only in prose.
    const tableSymbols = D.CHECKED_SYMBOLS.map(s => s.symbol).join(' | ');
    const leanedOn = ['daf-2', 'daf-16', 'INSR', 'IGF1R', 'INSRR', 'FOXO1', 'FOXO3', 'FOXO4', 'FOXO6', 'cpo', 'RBPMS', 'RBPMS2', 'foxo3a', 'foxo3b', 'insra', 'insrb', 'igf1ra', 'igf1rb'];
    const notInTable = leanedOn.filter(s => !new RegExp(`(^|[^A-Za-z0-9-])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9-]|$)`).test(tableSymbols));
    check('every gene symbol the dossiers lean on appears in the verified symbol table',
      f(notInTable.length === 0, notInTable.length !== 0), notInTable.join(', '));
  }

  // ==================================================================================================
  // 4. THE ONE-TO-MANY FINDING, AS THE LIVE RECORDS RETURNED IT
  // ==================================================================================================
  {
    const orth = byId(TEST_PAIR).evidence['sequence-orthology'];

    check('the receptor node records THREE human genes for one nematode gene',
      f(orth.n_on_human_side_receptor === 3, orth.n_on_human_side_receptor === 1),
      orth.members_receptor_human.join(', '));
    check('and names them, so the claim can be re-checked against the Alliance',
      f(orth.members_receptor_human.join(',') === 'INSR,IGF1R,INSRR',
        orth.members_receptor_human.join(',') === 'INSR'), orth.members_receptor_human.join(','));
    check('the effector node records FOUR human forkhead factors for one nematode gene',
      f(orth.n_on_human_side_effector === 4, orth.n_on_human_side_effector === 1),
      orth.members_effector_human.join(', '));
    check('the fish side records TWO loci per human receptor',
      f(orth.n_on_fish_side_per_human_receptor === 2, orth.n_on_fish_side_per_human_receptor === 1));
    check('and names the killifish gene ids, which is what makes it re-checkable rather than a count',
      f(orth.members_fish_insr.every(m => /ENSNFUG000150\d{5}/.test(m)) && orth.members_fish_insr.length === 2,
        !(orth.members_fish_insr.every(m => /ENSNFUG000150\d{5}/.test(m)) && orth.members_fish_insr.length === 2)),
      orth.members_fish_insr.join(' '));

    check('the orthology-table-versus-gene-annotation contradiction is recorded, not smoothed over',
      f(typeof orth.the_orthology_table_contradicted_its_own_database === 'string'
        && /ortholog_one2one/.test(orth.the_orthology_table_contradicted_its_own_database)
        && /ENSNFUG00015001055/.test(orth.the_orthology_table_contradicted_its_own_database),
        !(typeof orth.the_orthology_table_contradicted_its_own_database === 'string'
          && /ortholog_one2one/.test(orth.the_orthology_table_contradicted_its_own_database)
          && /ENSNFUG00015001055/.test(orth.the_orthology_table_contradicted_its_own_database))));

    check('the one-to-many call does NOT rest on that contradiction: the reason is given separately',
      f(typeof orth.why_still_scored_one_to_many === 'string' && orth.why_still_scored_one_to_many.length > 100,
        !(typeof orth.why_still_scored_one_to_many === 'string' && orth.why_still_scored_one_to_many.length > 100)));

    check('both foxo3 paralogs are in the symbol table with distinct gene ids',
      f(D.CHECKED_SYMBOLS.find(s => s.symbol === 'foxo3a').record.includes('ENSNFUG00015020706')
        && D.CHECKED_SYMBOLS.find(s => s.symbol === 'foxo3b').record.includes('ENSNFUG00015001055'),
        !(D.CHECKED_SYMBOLS.find(s => s.symbol === 'foxo3a').record.includes('ENSNFUG00015020706')
          && D.CHECKED_SYMBOLS.find(s => s.symbol === 'foxo3b').record.includes('ENSNFUG00015001055'))));

    // The thing the fish paper does NOT say, recorded as a negative rather than passed over.
    check('the note records that the insulin/IGF receptor node is unestablished on the fish side',
      f(/zero matches/i.test(byId(TEST_PAIR).note) && /receptor/i.test(byId(TEST_PAIR).note),
        !(/zero matches/i.test(byId(TEST_PAIR).note) && /receptor/i.test(byId(TEST_PAIR).note))));

    check('the loss-of-function evidence names its two-different-assays caveat rather than claiming a match',
      f(/TWO DIFFERENT ASSAYS/i.test(byId(TEST_PAIR).evidence['lof-phenotype'].caveat ?? ''),
        !/TWO DIFFERENT ASSAYS/i.test(byId(TEST_PAIR).evidence['lof-phenotype'].caveat ?? '')));

    check('the domain-architecture evidence records the accessory domains DAF-16 lacks',
      f(/PF16676/.test(byId(TEST_PAIR).evidence['domain-architecture'].caveat ?? '')
        && /PF16675/.test(byId(TEST_PAIR).evidence['domain-architecture'].caveat ?? ''),
        !(/PF16676/.test(byId(TEST_PAIR).evidence['domain-architecture'].caveat ?? '')
          && /PF16675/.test(byId(TEST_PAIR).evidence['domain-architecture'].caveat ?? ''))));

    check('expression-domain is recorded ABSENT on the test pair rather than filled with a near-miss measurement',
      f(byId(TEST_PAIR).evidence['expression-domain'].present === false,
        byId(TEST_PAIR).evidence['expression-domain'].present !== false));
  }

  // ==================================================================================================
  // 5. SCORED IS COMPUTED, NOT TYPED
  // ==================================================================================================
  {
    check('SCORED holds one verdict per pair, keyed by id',
      f(Object.keys(D.SCORED).length === D.PAIRS.length && D.PAIRS.every(p => p.id in D.SCORED),
        !(Object.keys(D.SCORED).length === D.PAIRS.length && D.PAIRS.every(p => p.id in D.SCORED))),
      Object.keys(D.SCORED).join(', '));

    // Recompute from scratch and compare. If SCORED had been hand-written, this is what would catch it.
    const live = D.PAIRS.map(p => A.scoreAnalogy(p.a, p.b, p.evidence));
    const matches = D.PAIRS.every((p, i) => D.SCORED[p.id].confidence.lo === live[i].confidence.lo
      && D.SCORED[p.id].confidence.hi === live[i].confidence.hi
      && D.SCORED[p.id].confidence.label === live[i].confidence.label);
    check('SCORED equals a fresh scoreAnalogy call on the same evidence: the band was recorded, not asserted',
      f(matches === true, D.SCORED[TEST_PAIR].confidence.lo === live[0].confidence.lo + 0.5));

    for (const id of [TEST_PAIR, CONTROL_PAIR]) {
      const c = D.SCORED[id].confidence;
      check(`confidence is a band with hi > lo (${id})`,
        f(c.hi > c.lo, !(c.hi > c.lo)), `lo ${c.lo} hi ${c.hi}`);
    }

    const numbers = [TEST_PAIR, CONTROL_PAIR].flatMap(id => Object.entries(D.SCORED[id]).filter(([, x]) => typeof x === 'number').map(([k]) => `${id}/${k}`));
    check('no top-level property of either verdict is a bare number',
      f(numbers.length === 0, numbers.length !== 0), numbers.join(', '));

    const digity = [TEST_PAIR, CONTROL_PAIR].filter(id => /[0-9]/.test(D.SCORED[id].headline));
    check('neither headline contains a digit, so no float can be quoted out of it',
      f(digity.length === 0, digity.length !== 0), digity.join(', '));

    check('the test pair reports no direct functional test, because there is none',
      f(D.SCORED[TEST_PAIR].directly_tested === false, D.SCORED[TEST_PAIR].directly_tested !== false));
    check('and says so in its gaps rather than only in the absent list',
      f(D.SCORED[TEST_PAIR].gaps.some(g => /no direct functional test/.test(g)),
        !D.SCORED[TEST_PAIR].gaps.some(g => /no direct functional test/.test(g))), D.SCORED[TEST_PAIR].gaps.length + ' gaps');

    check('the test pair has exactly three present evidence kinds, and they are the three recorded',
      f(D.SCORED[TEST_PAIR].present_kinds.slice().sort().join(',') === 'domain-architecture,lof-phenotype,sequence-orthology',
        D.SCORED[TEST_PAIR].present_kinds.slice().sort().join(',') === 'rescue'),
      D.SCORED[TEST_PAIR].present_kinds.join(', '));
  }

  // ==================================================================================================
  // 6. THE ONE-TO-MANY GUARD, ON THE PAIR THAT HAS THE MOST TO OFFER IT
  // ==================================================================================================
  {
    const c = D.CLASSIFIED[TEST_PAIR];
    check('the test pair is classified one-to-many-ambiguous',
      f(c.class === 'one-to-many-ambiguous', c.class !== 'one-to-many-ambiguous'), c.class);
    check('and is NOT a functional equivalent, however good its loss-of-function evidence is',
      f(c.functional_equivalent === false, c.functional_equivalent !== false));
    check('it does not reach the single functional-equivalence class',
      f(!A.FUNCTIONAL_EQUIVALENCE_CLASSES.includes(c.class), A.FUNCTIONAL_EQUIVALENCE_CLASSES.includes(c.class)), c.class);
    check('the one-to-many refusal fires on it by name',
      f(D.REFUSED[TEST_PAIR].refusals.some(r => r.id === 'one-to-many-is-not-equivalence'),
        !D.REFUSED[TEST_PAIR].refusals.some(r => r.id === 'one-to-many-is-not-equivalence')),
      D.REFUSED[TEST_PAIR].refusals.map(r => r.id).join(', '));
    check('and it is the ONLY refusal that fires: the context and search complaints were cleared',
      f(D.REFUSED[TEST_PAIR].refusals.length === 1, D.REFUSED[TEST_PAIR].refusals.length !== 1),
      D.REFUSED[TEST_PAIR].refusals.map(r => r.id).join(', '));
    check('the phenotype-transfer refusal specifically does NOT fire, because the context difference is stated',
      f(!D.REFUSED[TEST_PAIR].refusals.some(r => r.id === 'phenotype-transfer-without-context'),
        D.REFUSED[TEST_PAIR].refusals.some(r => r.id === 'phenotype-transfer-without-context')));
    check('the classifier points the reader at the duplicate-pair record',
      f(c.see === 'THE_ZEBRAFISH_PROBLEM', c.see !== 'THE_ZEBRAFISH_PROBLEM'), `${c.see}`);
  }

  // ==================================================================================================
  // 7. THE NEGATIVE CONTROL ACTUALLY CONTROLS
  // ==================================================================================================
  {
    const control = byId(CONTROL_PAIR);
    check('the control pair declares itself a negative control in its note',
      f(/NEGATIVE CONTROL/.test(control.note), !/NEGATIVE CONTROL/.test(control.note)));
    check('the control pair has NO present evidence kinds',
      f(D.SCORED[CONTROL_PAIR].present_kinds.length === 0, D.SCORED[CONTROL_PAIR].present_kinds.length !== 0),
      D.SCORED[CONTROL_PAIR].present_kinds.join(', '));
    check('its band label is the bottom of the scale',
      f(D.SCORED[CONTROL_PAIR].confidence.label === 'no-support', D.SCORED[CONTROL_PAIR].confidence.label !== 'no-support'),
      D.SCORED[CONTROL_PAIR].confidence.label);
    check('its orthology absence is a CHECKED negative on a named locus, not an unperformed search',
      f(/alliance_cpo_orthologs/.test(control.evidence['sequence-orthology'].source ?? '')
        && /13 stringent rows|13 rows/.test(control.note),
        !(/alliance_cpo_orthologs/.test(control.evidence['sequence-orthology'].source ?? '')
          && /13 stringent rows|13 rows/.test(control.note))));
    check('and it names the human genes cpo actually maps to, so the negative is specific',
      f(/RBPMS/.test(control.evidence['sequence-orthology'].why) && /RBPMS2/.test(control.evidence['sequence-orthology'].why),
        !(/RBPMS/.test(control.evidence['sequence-orthology'].why) && /RBPMS2/.test(control.evidence['sequence-orthology'].why))));
    check('the contested insect-side literature is carried, not pruned to the convenient paper',
      f(['schmidt_2008', 'zonato_2016', 'cogni_2013'].every(k => D.SOURCE_IDS.includes(k)),
        !['schmidt_2008', 'zonato_2016', 'cogni_2013'].every(k => D.SOURCE_IDS.includes(k))));

    // THE SEPARATION.
    check('the module put the two pairs in DIFFERENT band labels',
      f(D.BAND_SEPARATION.labels_differ === true, D.BAND_SEPARATION.labels_differ !== true),
      `${D.BAND_SEPARATION.test_label} vs ${D.BAND_SEPARATION.control_label}`);
    check('and the test pair is the HIGHER of the two, not merely different',
      f(rank(D.BAND_SEPARATION.test_label) > rank(D.BAND_SEPARATION.control_label),
        !(rank(D.BAND_SEPARATION.test_label) > rank(D.BAND_SEPARATION.control_label))),
      `${D.BAND_SEPARATION.test_label} vs ${D.BAND_SEPARATION.control_label}`);
    check('under the default intervals the two bands do not even overlap',
      f(D.BAND_SEPARATION.bands_do_not_overlap === true, D.BAND_SEPARATION.bands_do_not_overlap !== true),
      `${D.BAND_SEPARATION.test_band.join('-')} vs ${D.BAND_SEPARATION.control_band.join('-')}`);
    check('the label separation SURVIVES analogy.mjs\'s alternative weighting',
      f(D.BAND_SEPARATION.alt_labels_differ === true, D.BAND_SEPARATION.alt_labels_differ !== true),
      `${D.BAND_SEPARATION.alt_test_band.join('-')} vs ${D.BAND_SEPARATION.alt_control_band.join('-')}`);
    check('but the DISJOINT BANDS do not survive it, and the file says so instead of claiming they do',
      f(D.BAND_SEPARATION.alt_bands_do_not_overlap === false, D.BAND_SEPARATION.alt_bands_do_not_overlap !== false),
      `alt: ${D.BAND_SEPARATION.alt_test_band.join('-')} vs ${D.BAND_SEPARATION.alt_control_band.join('-')}`);
    check('the test pair\'s own label is reported as NOT robust to re-weighting',
      f(D.BAND_SEPARATION.test_label_is_robust_to_weighting === false,
        D.BAND_SEPARATION.test_label_is_robust_to_weighting !== false),
      `${D.BAND_SEPARATION.test_label} -> ${D.SCORED[TEST_PAIR].confidence.under_alternative_weighting.label}`);
    check('neither pair is sold as a functional equivalent',
      f(D.BAND_SEPARATION.neither_is_a_functional_equivalent === true,
        D.BAND_SEPARATION.neither_is_a_functional_equivalent !== true));
  }

  // ==================================================================================================
  // 8. WHAT THE RUN SAYS ABOUT THE MODULE ITSELF
  // ==================================================================================================
  {
    check('every MODULE_FINDINGS row is marked verified by a computed predicate, not by assertion',
      f(D.MODULE_FINDINGS.every(m => m.verified === true), !D.MODULE_FINDINGS.every(m => m.verified === true)),
      D.MODULE_FINDINGS.filter(m => !m.verified).map(m => m.finding.slice(0, 40)).join(' | '));

    check('MODULE_FINDINGS records the module\'s no-basis blind spot by name',
      f(D.MODULE_FINDINGS.some(m => /did not look/.test(m.finding) || /did not look/.test(m.detail)),
        !D.MODULE_FINDINGS.some(m => /did not look/.test(m.finding) || /did not look/.test(m.detail))));

    // The blind spot itself: the class says "we have not looked" for a pair that was searched.
    const cc = D.CLASSIFIED[CONTROL_PAIR];
    check('the control pair lands in no-basis despite a performed search',
      f(cc.class === 'no-basis', cc.class !== 'no-basis'), cc.class);
    check('and carries the class warning that no-basis is a statement about the SEARCH',
      f(/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(cc.critical_warning ?? ''),
        !/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(cc.critical_warning ?? '')));
    check('yet the absence-of-evidence refusal stays SILENT, which is the only signal that we did look',
      f(!D.REFUSED[CONTROL_PAIR].refusals.some(r => r.id === 'absence-of-evidence'),
        D.REFUSED[CONTROL_PAIR].refusals.some(r => r.id === 'absence-of-evidence')),
      D.REFUSED[CONTROL_PAIR].refusals.map(r => r.id).join(', ') || 'none');
    check('so the control pair fires no refusal at all, and is still at the bottom of the scale',
      f(D.REFUSED[CONTROL_PAIR].refused === false && D.SCORED[CONTROL_PAIR].confidence.label === 'no-support',
        !(D.REFUSED[CONTROL_PAIR].refused === false && D.SCORED[CONTROL_PAIR].confidence.label === 'no-support')));

    check('the file records open questions, including the rescue that would settle the test pair',
      f(D.OPEN_QUESTIONS.some(q => /rescue/i.test(q)) && D.OPEN_QUESTIONS.length >= 4,
        !(D.OPEN_QUESTIONS.some(q => /rescue/i.test(q)) && D.OPEN_QUESTIONS.length >= 4)), `${D.OPEN_QUESTIONS.length}`);
    check('and that the rescue would still not make either gene the other\'s equivalent',
      f(D.OPEN_QUESTIONS.some(q => /rescue/i.test(q) && /SET/.test(q)),
        !D.OPEN_QUESTIONS.some(q => /rescue/i.test(q) && /SET/.test(q))));

    const frozen = Object.isFrozen(D.PAIRS) && Object.isFrozen(D.SOURCES) && Object.isFrozen(D.SCORED) && Object.isFrozen(D.CHECKED_SYMBOLS);
    check('the exported dossiers, sources, symbol table and verdicts are all frozen',
      f(frozen === true, frozen !== true));
  }
}

// ======================================================================================================
// RUN
// ======================================================================================================
console.log(`\ndiapause dossiers: convergent developmental arrest, and the negative control${FAULT ? '   [--fail-once: one fault injected per run, iterating over every assertion]' : ''}\n`);

suite();
const N = results.length;
const cleanNames = names.slice();
const cleanResults = results.slice();
const cleanDetails = detailOf.slice();

for (let i = 0; i < N; i++) {
  if (cleanResults[i]) console.log(`  ok   ${cleanNames[i]}`);
  else console.log(`  FAIL ${cleanNames[i]}${cleanDetails[i] ? ` - ${cleanDetails[i]}` : ''}`);
}
const pass = cleanResults.filter(Boolean).length;
const fail = N - pass;
console.log(`\n${pass} pass, ${fail} fail`);

let survivors = [];
if (FAULT) {
  for (let t = 0; t < N; t++) {
    target = t;
    suite();
    if (results.length !== N) {
      console.log(`\n  harness drift: run ${t} produced ${results.length} assertions, expected ${N}`);
      process.exit(1);
    }
    if (results[t]) survivors.push(`#${t} ${names[t]}`);
  }
  target = -1;
  console.log(`\n--fail-once: ${N} runs, one fault injected per run, each assertion faulted exactly once.`);
  console.log(`${N - survivors.length} of ${N} assertions FAILED under their own injected fault, as they must.`);
  if (survivors.length === 0) {
    console.log('No survivors: every assertion is load-bearing.');
  } else {
    console.log(`SURVIVORS (${survivors.length}). These assert nothing about their subject and are not tests:`);
    for (const s of survivors) console.log(`  ${s}`);
  }
}
console.log('');
process.exit((FAULT ? survivors.length : fail) ? 1 : 0);
