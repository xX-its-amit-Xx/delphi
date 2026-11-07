#!/usr/bin/env node
// Tests for analogues/combos/pairs/electric-organ.mjs
//
//   node analogues/combos/pairs/test-electric-organ.mjs [--fail-once]
//
// Five things are checked harder than the rest, because they are the five ways these dossiers could do
// damage if they were wrong:
//
//   1. A FABRICATED IDENTIFIER. A made-up DOI, PMID, accession or gene id is the worst thing this project
//      can produce, so every identifier in the file is checked against the exact set that was retrieved
//      live in the session that wrote it, and every source must carry a verified_how saying what was read
//      back. A source with a citation and no verification is treated as a failure, not as a loose end.
//   2. AN INFLATED EVIDENCE SLOT. The two slots most tempting to assert without a record - domain
//      architecture for pair 1 (the family name is right there) and rescue for pair 2 (there is a
//      mammalian-cell result that looks like one) - are checked to be ABSENT, and the near-miss result
//      is checked to be recorded as explicitly not-entered rather than silently dropped.
//   3. A BAND TYPED IN BY HAND. Every band and label is read from SCORED, which is computed at import
//      time by scoreAnalogy. The tests recompute from PAIRS and require identity, so a band cannot be
//      written into the file and a test cannot quote a band the module did not produce.
//   4. THE MISCLASSIFICATION BEING QUIETLY PRESENT RATHER THAN REPORTED. Pair 2 lands in
//      convergent-analogue, which is false for a cell pair whose shared lineage is not in doubt. The
//      finding is only worth having if it is asserted, so it is: the class is checked to BE the wrong
//      one, and SCHEMA_STRAIN is checked to name it and the mechanism that produced it.
//   5. THE SHARED-VERSUS-INDEPENDENT DUPLICATION ANSWER DRIFTING. The interpretation of pair 1 turns on
//      it, so the two source statements it rests on are checked verbatim, and the hedge in one of them
//      is checked to still be recorded as a hedge.
//
// --fail-once injects one fault per run, iterating over every assertion, by inverting its predicate or
// substituting a wrong value. Every line must then FAIL. An assertion that survives its own fault is
// asserting nothing about its subject and counts as a test failure.
import * as E from './electric-organ.mjs';
import * as A from '../../analogy.mjs';

// --fail-once substitutes the broken value for exactly ONE assertion per run and iterates over all of
// them: the parent run counts the assertions, then re-executes this file once per index with
// --fault=<i>, and requires that run to show exactly one failure. A run that still shows zero is a
// SURVIVOR, meaning assertion <i> asserts nothing about its subject. Faults are predicate inversions or
// wrong-value substitutions only; no threshold is ever tightened to manufacture a failure.
const SWEEP = process.argv.includes('--fail-once');
const FAULT_IDX = Number(process.argv.find(a => a.startsWith('--fault='))?.slice(8) ?? -1);
const QUIET = FAULT_IDX >= 0;
let pass = 0, fail = 0, nth = 0;
const names = [];
const check = (name, cond, detail = '') => {
  names.push(name);
  if (cond) { pass++; if (!QUIET) console.log(`  ok   ${name}`); }
  else { fail++; if (!QUIET) console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); }
};
const f = (real, broken) => (nth++ === FAULT_IDX ? broken : real);

const P1 = 'scn4aa-mormyroid-gymnotiform';
const P2 = 'electrocyte-skeletal-myofibre';
const pair = id => E.PAIRS.find(p => p.id === id);
const RANK = ['no-support', 'weak', 'moderate', 'strong', 'directly-tested'];
const rank = l => RANK.indexOf(l);

// The identifiers actually retrieved in the session that wrote the module. Nothing outside these sets may
// appear in the file; anything inside them was read back from a live record.
const RETRIEVED_PMIDS = ['16505358', '21127261', '24970089', '9822748', '15309633', '17077280', '18552307', '19598116'];
const RETRIEVED_DOIS = [
  '10.1073/pnas.0600160103', '10.1073/pnas.1011803107', '10.1126/science.1254432',
  '10.1523/JNEUROSCI.18-23-09924.1998', '10.1007/s00427-004-0421-5', '10.1096/fj.06-6474fje',
  '10.1242/jeb.016592', '10.1387/ijdb.082672hk',
];
const RETRIEVED_GENE_IDS = ['572442', '564977', '113588309', '113587832', '111856075', '108924827', '108941716', '100304603', '103021833', '130221051'];
// Accessions read back from a live record this session. The UniProt TSV for Mormyridae returned
// E5DMN2-E5DMN9 and E5DMP0-E5DMP4; the one for Gymnotiformes returned E5DMP6-E5DMP9 and E5DMQ0-E5DMQ2;
// the nuccore esummary returned the Sternopygus series OR839033-OR839040.
const RETRIEVED_ACCESSIONS = [
  'GU362024', 'GU362025', 'GU362026', 'XM_035533255', 'Q2XVR3', 'ENSDARG00000098738', 'ZDB-GENE-051201-2',
  ...['2', '3', '4', '5', '6', '7', '8', '9'].map(d => `E5DMN${d}`),
  ...['0', '1', '2', '3', '4', '6', '7', '8', '9'].map(d => `E5DMP${d}`),
  ...['0', '1', '2'].map(d => `E5DMQ${d}`),
  ...['33', '34', '35', '36', '37', '38', '39', '40'].map(d => `OR8390${d}`),
];

if (!QUIET) console.log(`\nelectric-organ: two dossiers on the myogenic electric organ\n`);

// ====================================================================================================
// 1. NO FABRICATED IDENTIFIERS
// ====================================================================================================
{
  const blob = JSON.stringify({ PAIRS: E.PAIRS, SOURCES: E.SOURCES, SCHEMA_STRAIN: E.SCHEMA_STRAIN, NOT_CLAIMED: E.NOT_CLAIMED });

  // PMIDs appear in prose too, inside verified_how. Every one of them must also be a retrieved PMID:
  // a prose PMID that nothing retrieved is the exact shape of a fabricated citation.
  const prosePmids = [...new Set((blob.match(/\bPMID\s*:?\s*(\d{6,9})\b/gi) || []).map(s => s.replace(/\D+/g, '')))];
  const strayProse = prosePmids.filter(p => !RETRIEVED_PMIDS.includes(p));
  check('every PMID written in prose is also one actually retrieved this session',
    f(strayProse.length === 0, strayProse.length !== 0), strayProse.join(', '));
  check('and prose PMIDs really are present, so that check has subjects rather than passing vacuously',
    f(prosePmids.length >= 6, !(prosePmids.length >= 6)), `${prosePmids.length}`);

  const declaredPmids = Object.values(E.SOURCES).map(s => s.pmid).filter(Boolean);
  const strayPmid = declaredPmids.filter(p => !RETRIEVED_PMIDS.includes(p));
  check('every declared PMID is one actually retrieved this session',
    f(strayPmid.length === 0, strayPmid.length !== 0), strayPmid.join(', '));
  check('and there are as many declared PMIDs as papers retrieved, so none was dropped either',
    f(new Set(declaredPmids).size === RETRIEVED_PMIDS.length, new Set(declaredPmids).size !== RETRIEVED_PMIDS.length),
    `${new Set(declaredPmids).size} vs ${RETRIEVED_PMIDS.length}`);

  const declaredDois = Object.values(E.SOURCES).map(s => s.doi).filter(Boolean);
  const strayDoi = declaredDois.filter(d => !RETRIEVED_DOIS.includes(d));
  check('every declared DOI is one actually retrieved this session',
    f(strayDoi.length === 0, strayDoi.length !== 0), strayDoi.join(', '));
  check('every declared DOI has the shape of a DOI rather than being a free-text citation',
    f(declaredDois.every(d => /^10\.\d{4,9}\/\S+$/.test(d)), !declaredDois.every(d => /^10\.\d{4,9}\/\S+$/.test(d))),
    declaredDois.filter(d => !/^10\.\d{4,9}\/\S+$/.test(d)).join(', '));

  const geneIds = [...new Set(blob.match(/\b(?:GeneID|Gene)\s(\d{6,9})\b/g) || [])].map(s => s.replace(/\D+/g, ''));
  const strayGene = geneIds.filter(g => !RETRIEVED_GENE_IDS.includes(g));
  check('every NCBI gene id named in the file is one read back from a live record',
    f(strayGene.length === 0, strayGene.length !== 0), strayGene.join(', '));

  const accs = [...new Set(blob.match(/\b(?:GU\d{6}|OR\d{6}|XM_\d{9}|ENSDARG\d{11}|E5DM[A-Z0-9]{2}|Q2XVR3|ZDB-GENE-[\d-]+)\b/g) || [])];
  const strayAcc = accs.filter(a => !RETRIEVED_ACCESSIONS.includes(a));
  check('every sequence or protein accession named in the file was retrieved this session',
    f(strayAcc.length === 0, strayAcc.length !== 0), strayAcc.join(', '));
  check('the accessions actually used span both lineages and both resource types, so the check has subjects',
    f(accs.includes('GU362024') && accs.includes('E5DMN3') && accs.includes('E5DMP7') && accs.includes('Q2XVR3'),
      !(accs.includes('GU362024') && accs.includes('E5DMN3') && accs.includes('E5DMP7') && accs.includes('Q2XVR3'))),
    accs.join(', '));

  const unverified = Object.entries(E.SOURCES).filter(([, s]) => typeof s.verified_how !== 'string' || s.verified_how.length < 60);
  check('EVERY source carries a verified_how with substance in it',
    f(unverified.length === 0, unverified.length !== 0), unverified.map(([k]) => k).join(', '));
  const noEndpoint = Object.entries(E.SOURCES).filter(([, s]) => !/PubMed|rest\.uniprot|api\.ncbi|rest\.ensembl|esearch|esummary|pmc\.ncbi|ortholog/i.test(s.verified_how));
  check('every verified_how names the resource or endpoint that was called, not just that checking happened',
    f(noEndpoint.length === 0, noEndpoint.length !== 0), noEndpoint.map(([k]) => k).join(', '));

  check('the file records that the brief\'s title for the Science paper was wrong and the record was used instead',
    f(/WRONG/.test(E.SOURCES.gallant_2014.verified_how) && /convergent evolution of electric organs/.test(E.SOURCES.gallant_2014.citation),
      !(/WRONG/.test(E.SOURCES.gallant_2014.verified_how) && /convergent evolution of electric organs/.test(E.SOURCES.gallant_2014.citation))));
  check('the one full text that did NOT retrieve is recorded as not retrieved rather than cited as read',
    f(/EMPTY full_text/i.test(E.SOURCES.arnegard_2010.verified_how), !/EMPTY full_text/i.test(E.SOURCES.arnegard_2010.verified_how)));
}

// ====================================================================================================
// 2. THE SCHEMA IS THE HOUSE SCHEMA, AND EVERY ABSENCE SAYS WHY
// ====================================================================================================
{
  check('both dossiers are present and no others',
    f(E.PAIRS.length === 2 && E.PAIRS.map(p => p.id).join() === `${P1},${P2}`,
      !(E.PAIRS.length === 2 && E.PAIRS.map(p => p.id).join() === `${P1},${P2}`)), E.PAIRS.map(p => p.id).join(', '));
  check('PAIRS is frozen, like the module it mirrors',
    f(Object.isFrozen(E.PAIRS) === true, Object.isFrozen(E.PAIRS) !== true));

  const missingKinds = E.PAIRS.filter(p => A.EVIDENCE_IDS.some(k => !(k in p.evidence)));
  check('every pair carries all seven evidence kinds explicitly, so no kind is absent by omission',
    f(missingKinds.length === 0, missingKinds.length !== 0), missingKinds.map(p => p.id).join(', '));

  const absentNoWhy = E.PAIRS.flatMap(p => A.EVIDENCE_IDS
    .filter(k => p.evidence[k].present === false && typeof p.evidence[k].why !== 'string')
    .map(k => `${p.id}:${k}`));
  check('EVERY absent evidence kind states what is missing, in a why',
    f(absentNoWhy.length === 0, absentNoWhy.length !== 0), absentNoWhy.join(', '));

  const presentNoWhat = E.PAIRS.flatMap(p => A.EVIDENCE_IDS
    .filter(k => p.evidence[k].present === true && typeof p.evidence[k].what !== 'string')
    .map(k => `${p.id}:${k}`));
  check('every present evidence kind says what the evidence IS',
    f(presentNoWhat.length === 0, presentNoWhat.length !== 0), presentNoWhat.join(', '));

  const shortNote = E.PAIRS.filter(p => typeof p.note !== 'string' || p.note.length < 200);
  check('both notes are long enough to carry the reasoning rather than a label',
    f(shortNote.length === 0, shortNote.length !== 0), shortNote.map(p => p.id).join(', '));
  const synthetic = E.PAIRS.filter(p => /SYNTHETIC|illustrative/i.test(p.note));
  check('neither dossier is synthetic or illustrative: both are real pairs with real records',
    f(synthetic.length === 0, synthetic.length !== 0), synthetic.map(p => p.id).join(', '));

  const notEnoughDbs = E.PAIRS.filter(p => p.databases_searched.length < A.MIN_DATABASES);
  check('both pairs searched at least MIN_DATABASES resources',
    f(notEnoughDbs.length === 0, notEnoughDbs.length !== 0), notEnoughDbs.map(p => p.id).join(', '));
  const searchNoWhat = E.PAIRS.filter(p => typeof p.analogue_search?.what !== 'string');
  check('both pairs say what their function-first search actually was, not just that it happened',
    f(searchNoWhat.length === 0, searchNoWhat.length !== 0), searchNoWhat.map(p => p.id).join(', '));
  const dcNotStated = E.PAIRS.filter(p => p.developmental_context?.difference_stated !== true);
  check('both pairs state their developmental-context difference',
    f(dcNotStated.length === 0, dcNotStated.length !== 0), dcNotStated.map(p => p.id).join(', '));
}

// ====================================================================================================
// 3. THE TWO SLOTS THAT WERE TEMPTING TO INFLATE ARE ABSENT, AND THE NEAR-MISSES ARE ON THE RECORD
// ====================================================================================================
{
  const d1 = pair(P1).evidence['domain-architecture'];
  check('pair 1 does NOT assert domain architecture from the sodium-channel family name',
    f(d1.present === false, d1.present !== false), `present ${d1.present}`);
  check('and its why names the measured reason: the records on both sides are partial',
    f(/967|944/.test(d1.why) && /1829/.test(d1.why) && /partial/i.test(d1.why),
      !(/967|944/.test(d1.why) && /1829/.test(d1.why) && /partial/i.test(d1.why))), d1.why.slice(0, 90));
  check('and it names the reference gene whose architecture WAS read, so the yardstick is not mistaken for the subject',
    f(/Q2XVR3/.test(d1.why) && /NON-ELECTRIC|non-electric/.test(d1.why), !(/Q2XVR3/.test(d1.why) && /NON-ELECTRIC|non-electric/.test(d1.why))));

  const r2 = pair(P2).evidence['rescue'];
  check('pair 2 does NOT enter the mouse-cell MRF conversion result as a rescue',
    f(r2.present === false, r2.present !== false), `present ${r2.present}`);
  check('and the near-miss result is named in the slot rather than dropped',
    f(/Kim 2009/.test(r2.why), !/Kim 2009/.test(r2.why)), r2.why.slice(0, 90));
  check('the source entry for that result states explicitly why it is not rescue, in three reasons',
    f(typeof E.SOURCES.kim_2009.why_it_is_NOT_entered_as_rescue_for_pair_2 === 'string' && /\(1\)/.test(E.SOURCES.kim_2009.why_it_is_NOT_entered_as_rescue_for_pair_2) && /\(3\)/.test(E.SOURCES.kim_2009.why_it_is_NOT_entered_as_rescue_for_pair_2),
      !(typeof E.SOURCES.kim_2009.why_it_is_NOT_entered_as_rescue_for_pair_2 === 'string' && /\(1\)/.test(E.SOURCES.kim_2009.why_it_is_NOT_entered_as_rescue_for_pair_2) && /\(3\)/.test(E.SOURCES.kim_2009.why_it_is_NOT_entered_as_rescue_for_pair_2))));

  check('neither pair claims a rescue, so neither is directly tested',
    f(E.SCORED[P1].directly_tested === false && E.SCORED[P2].directly_tested === false,
      !(E.SCORED[P1].directly_tested === false && E.SCORED[P2].directly_tested === false)));
  check('and each verdict says so in its gaps rather than leaving it to be noticed',
    f([P1, P2].every(id => E.SCORED[id].gaps.some(g => /no direct functional test/.test(g))),
      ![P1, P2].every(id => E.SCORED[id].gaps.some(g => /no direct functional test/.test(g)))));

  const o1 = pair(P1).evidence['sequence-orthology'];
  check('pair 1 enters NO pairwise identity figure, since none was computed',
    f(o1.identity === null, o1.identity !== null), `identity ${o1.identity}`);
  check('and says why the slot is null instead of leaving the absence unexplained',
    f(typeof o1.why_no_identity === 'string' && /not.*computed|no pairwise alignment/i.test(o1.why_no_identity),
      !(typeof o1.why_no_identity === 'string' && /not.*computed|no pairwise alignment/i.test(o1.why_no_identity))));
}

// ====================================================================================================
// 4. THE ORTHOLOGY CALL, AND THE HOLE IN IT
// ====================================================================================================
{
  const o = pair(P1).evidence['sequence-orthology'];
  check('pair 1 states a homology_type, which is what makes the orthology claim usable at all',
    f(A.HOMOLOGY_TYPES.includes(o.homology_type), !A.HOMOLOGY_TYPES.includes(o.homology_type)), `${o.homology_type}`);
  check('the type is one-to-one, and the verdict reports the same type rather than a default',
    f(o.homology_type === 'one-to-one' && E.SCORED[P1].homology_type === 'one-to-one',
      !(o.homology_type === 'one-to-one' && E.SCORED[P1].homology_type === 'one-to-one')), `${E.SCORED[P1].homology_type}`);
  check('so no one-to-many refusal fires on pair 1, and the file does not need one',
    f(!A.AMBIGUOUS_HOMOLOGY_TYPES.includes(o.homology_type), A.AMBIGUOUS_HOMOLOGY_TYPES.includes(o.homology_type)));
  check('the one-to-one claim is backed by the counted shape of a real ortholog group, not by an assertion',
    f(/266/.test(o.what) && /one per species|one gene per species/i.test(o.what), !(/266/.test(o.what) && /one per species|one gene per species/i.test(o.what))), o.what.slice(0, 80));

  check('THE HOLE IS RECORDED: no scn4aa is annotated in the mormyroid reference genome',
    f(typeof o.the_hole_in_this_call === 'string' && /NO scn4aa/.test(o.the_hole_in_this_call) && /Paramormyrops kingsleyae/.test(o.the_hole_in_this_call),
      !(typeof o.the_hole_in_this_call === 'string' && /NO scn4aa/.test(o.the_hole_in_this_call) && /Paramormyrops kingsleyae/.test(o.the_hole_in_this_call))));
  check('and the hole is shown to be specific to scn4aa: the sibling ohnolog IS in its own ortholog group',
    f(/scn4ab/.test(o.the_hole_in_this_call) && /111856075/.test(E.SOURCES.ncbi_ortholog_group_scn4ab.record),
      !(/scn4ab/.test(o.the_hole_in_this_call) && /111856075/.test(E.SOURCES.ncbi_ortholog_group_scn4ab.record))));
  check('the absence is attributed to the annotation and NOT to the biology',
    f(E.NOT_CLAIMED.some(s => /annotation gap, not a biological absence/.test(s)),
      !E.NOT_CLAIMED.some(s => /annotation gap, not a biological absence/.test(s))));
  check('the genome is shown to be annotated, so the absence is in an annotation rather than in a gap',
    f(/44,677/.test(E.SOURCES.ncbi_gene_paramormyrops.verified_how), !/44,677/.test(E.SOURCES.ncbi_gene_paramormyrops.verified_how)));
  check('the method-dependence of a single resource\'s orthology graph is named, with the house citation',
    f(/Altenhoff/.test(o.the_hole_in_this_call), !/Altenhoff/.test(o.the_hole_in_this_call)));

  // The withdrawn gene record. Two esearch hits for scn4ab would read as one-to-many to anything naive.
  check('the withdrawn duplicate gene record is recorded, so two hits were not read as one-to-many',
    f(/withdrawn|status 1/.test(E.SOURCES.ncbi_gene_danio_scn4ab.verified_how) && /652950/.test(E.SOURCES.ncbi_gene_danio_scn4ab.verified_how),
      !(/withdrawn|status 1/.test(E.SOURCES.ncbi_gene_danio_scn4ab.verified_how) && /652950/.test(E.SOURCES.ncbi_gene_danio_scn4ab.verified_how))));
}

// ====================================================================================================
// 5. THE SHARED-VERSUS-INDEPENDENT DUPLICATION ANSWER, AND THE HEDGE IN IT
// ====================================================================================================
{
  const z = E.SOURCES.zakon_2006, a = E.SOURCES.arnegard_2010;
  check('the duplication is reported as SHARED and old, from the sentence that says so',
    f(a.what_it_states_that_is_used_here.some(s => /more than 100 million years following the origin/.test(s)),
      !a.what_it_states_that_is_used_here.some(s => /more than 100 million years following the origin/.test(s))));
  check('so what each lineage did independently is the CO-OPTION, and the note says that',
    f(/co-option/i.test(pair(P1).note) && /SHARED/.test(pair(P1).note), !(/co-option/i.test(pair(P1).note) && /SHARED/.test(pair(P1).note))));
  check('THE HEDGE SURVIVES: the whole-genome-duplication attribution is recorded as hedged in the source',
    f(z.what_it_states_that_is_used_here.some(s => /likely the result of a genomewide duplication/.test(s)),
      !z.what_it_states_that_is_used_here.some(s => /likely the result of a genomewide duplication/.test(s))));
  check('and the file does not upgrade the hedge into a claim of its own',
    f(E.NOT_CLAIMED.some(s => /definitely a whole-genome duplication/.test(s)),
      !E.NOT_CLAIMED.some(s => /definitely a whole-genome duplication/.test(s))));
  check('the source is recorded as presenting no synteny analysis, which is what would settle it',
    f(z.what_it_states_that_is_used_here.some(s => /no synteny or chromosomal analysis is presented/.test(s)),
      !z.what_it_states_that_is_used_here.some(s => /no synteny or chromosomal analysis is presented/.test(s))));

  const syn = pair(P1).evidence['synteny'];
  check('so pair 1 marks synteny ABSENT rather than passing chromosome placement off as synteny',
    f(syn.present === false, syn.present !== false), `present ${syn.present}`);
  check('and the chromosome placements that WERE checked are recorded, with what they are not',
    f(/different chromosomes/.test(syn.why) && /not a synteny check|No flanking-gene/i.test(syn.why),
      !(/different chromosomes/.test(syn.why) && /not a synteny check|No flanking-gene/i.test(syn.why))), syn.why.slice(0, 90));
  check('the weaker check is labelled as weaker in its own source entry, by naming what it is not',
    f(/It is not synteny/.test(E.SOURCES.chromosomal_placements_checked.what_it_is_not),
      !/It is not synteny/.test(E.SOURCES.chromosomal_placements_checked.what_it_is_not)));
  check('and the absent kind is named as the one that would settle the pair\'s central question',
    f(/main way to tell an ohnolog pair apart/.test(syn.why_it_matters_here_more_than_usual),
      !/main way to tell an ohnolog pair apart/.test(syn.why_it_matters_here_more_than_usual)));
}

// ====================================================================================================
// 6. THE EXPRESSION CORRESPONDENCE, AND THE SPECIES THAT BREAKS IT
// ====================================================================================================
{
  const ex = pair(P1).evidence['expression-domain'];
  check('pair 1 rests partly on a shared novel expression domain, entered as present',
    f(ex.present === true, ex.present !== true));
  check('AND the species that breaks the correspondence is carried in the same slot',
    f(/Apteronotus leptorhynchus/.test(ex.caveat) && /retains|retained/.test(ex.caveat),
      !(/Apteronotus leptorhynchus/.test(ex.caveat) && /retains|retained/.test(ex.caveat))), ex.caveat.slice(0, 90));
  check('the exception is quoted from the source rather than paraphrased into agreement',
    f(E.SOURCES.zakon_2006.what_it_states_that_is_used_here.some(s => /but in the muscle of A\. leptorhynchus/.test(s)),
      !E.SOURCES.zakon_2006.what_it_states_that_is_used_here.some(s => /but in the muscle of A\. leptorhynchus/.test(s))));
  check('and the file refuses the clade-level generalisation outright, naming the species',
    f(E.NOT_CLAIMED.some(s => /property of either electric lineage/.test(s) && /Apteronotus leptorhynchus retains it/.test(s)),
      !E.NOT_CLAIMED.some(s => /property of either electric lineage/.test(s) && /Apteronotus leptorhynchus retains it/.test(s))));
  check('the standing transcript-is-not-protein caveat is carried on pair 1\'s expression slot too',
    f(/transcript presence is not protein presence/i.test(ex.second_caveat), !/transcript presence is not protein presence/i.test(ex.second_caveat)));

  const ex2 = pair(P2).evidence['expression-domain'];
  check('pair 2\'s expression slot carries the MEASURED instance of that caveat, not the generic warning',
    f(/do not contain MCK, MHCs, or tropomyosin or troponin-T proteins/.test(ex2.caveat_that_is_the_whole_point),
      !/do not contain MCK, MHCs, or tropomyosin or troponin-T proteins/.test(ex2.caveat_that_is_the_whole_point)));
  check('and records that the authors themselves report the expression match as not explaining the difference',
    f(/not associated with a partial expression of MRFs/.test(ex2.second_caveat), !/not associated with a partial expression of MRFs/.test(ex2.second_caveat)));
  check('the single-copy MRF genes are recorded, so no duplicate pair confounds the within-species comparison',
    f(/single MyoD, myogenin, myf5 and MRF4 gene/.test(E.SOURCES.kim_2008.what_it_states_that_is_used_here[0]),
      !/single MyoD, myogenin, myf5 and MRF4 gene/.test(E.SOURCES.kim_2008.what_it_states_that_is_used_here[0])));
  check('pair 2 takes both sides from one species, which is what removes the tissue-vocabulary confound',
    f(pair(P2).a.species === pair(P2).b.species, pair(P2).a.species !== pair(P2).b.species),
    `${pair(P2).a.species} vs ${pair(P2).b.species}`);
}

// ====================================================================================================
// 7. SCORED IS COMPUTED, NOT TYPED
// ====================================================================================================
{
  check('SCORED has one verdict per pair and no others',
    f(Object.keys(E.SCORED).length === 2 && P1 in E.SCORED && P2 in E.SCORED,
      !(Object.keys(E.SCORED).length === 2 && P1 in E.SCORED && P2 in E.SCORED)), Object.keys(E.SCORED).join(', '));

  // Recompute from PAIRS and require identity. A hand-written band cannot survive this.
  for (const p of E.PAIRS) {
    const fresh = A.scoreAnalogy(p.a, p.b, p.evidence);
    check(`the recorded band for ${p.id} is exactly what scoreAnalogy returns`,
      f(fresh.confidence.lo === E.SCORED[p.id].confidence.lo && fresh.confidence.hi === E.SCORED[p.id].confidence.hi && fresh.confidence.label === E.SCORED[p.id].confidence.label,
        !(fresh.confidence.lo === E.SCORED[p.id].confidence.lo && fresh.confidence.hi === E.SCORED[p.id].confidence.hi && fresh.confidence.label === E.SCORED[p.id].confidence.label)),
      `${E.SCORED[p.id].confidence.lo}-${E.SCORED[p.id].confidence.hi} ${E.SCORED[p.id].confidence.label}`);
  }

  for (const id of [P1, P2]) {
    const c = E.SCORED[id].confidence;
    check(`${id}: confidence is a band with hi > lo`, f(c.hi > c.lo, !(c.hi > c.lo)), `${c.lo}-${c.hi}`);
    check(`${id}: no top-level property of the verdict is a bare number`,
      f(Object.values(E.SCORED[id]).every(v => typeof v !== 'number'), !Object.values(E.SCORED[id]).every(v => typeof v !== 'number')));
    check(`${id}: the headline carries no digits, so no float can be quoted out of it`,
      f(/[0-9]/.test(E.SCORED[id].headline) === false, /[0-9]/.test(E.SCORED[id].headline) === true), E.SCORED[id].headline.slice(0, 60));
  }

  check('pair 1 bands no higher than moderate, because its two present kinds are both correlates',
    f(rank(E.SCORED[P1].confidence.label) <= rank('moderate'), !(rank(E.SCORED[P1].confidence.label) <= rank('moderate'))),
    E.SCORED[P1].confidence.label);
  check('pair 2 bands lower than pair 1, and the file does not dress that up',
    f(E.SCORED[P2].confidence.hi < E.SCORED[P1].confidence.hi, !(E.SCORED[P2].confidence.hi < E.SCORED[P1].confidence.hi)),
    `${E.SCORED[P2].confidence.hi} vs ${E.SCORED[P1].confidence.hi}`);
  check('BOTH labels move under the alternative weighting, so neither word is the evidence talking',
    f([P1, P2].every(id => E.SCORED[id].confidence.label_is_robust_to_weighting === false),
      ![P1, P2].every(id => E.SCORED[id].confidence.label_is_robust_to_weighting === false)),
    [P1, P2].map(id => `${id}:${E.SCORED[id].confidence.label}->${E.SCORED[id].confidence.under_alternative_weighting.label}`).join(' | '));
  check('and each verdict says in words that the moved label was ours rather than the biology\'s',
    f([P1, P2].every(id => /is ours, not the biology/.test(E.SCORED[id].confidence.if_the_label_moved)),
      ![P1, P2].every(id => /is ours, not the biology/.test(E.SCORED[id].confidence.if_the_label_moved))));
  check('neither pair clears the functional-equivalence bar',
    f([P1, P2].every(id => E.CLASSIFIED[id].functional_equivalent === false),
      ![P1, P2].every(id => E.CLASSIFIED[id].functional_equivalent === false)));
  check('neither pair fires a refusal, and the refusals are therefore discriminating rather than silent',
    f([P1, P2].every(id => E.REFUSALS[id].refused === false), ![P1, P2].every(id => E.REFUSALS[id].refused === false)),
    [P1, P2].map(id => `${id}:${E.REFUSALS[id].refusals.map(r => r.id).join('/')}`).join(' | '));
}

// ====================================================================================================
// 8. THE MISCLASSIFICATION IS ASSERTED, NOT MENTIONED
// ====================================================================================================
// Pair 2's class is wrong. A prose note saying so is worth little; an assertion that the wrong class is
// what comes out, plus an assertion that the file names the mechanism, is worth something.
{
  const c2 = E.CLASSIFIED[P2];
  check('pair 2 is classified convergent-analogue - the WRONG class for a cell pair sharing a lineage',
    f(c2.class === 'convergent-analogue', c2.class !== 'convergent-analogue'), `class ${c2.class}`);
  check('and that class\'s stated meaning really does say "no shared ancestry", so the clash is real',
    f(/no shared ancestry/.test(A.CLASSES['convergent-analogue'].means), !/no shared ancestry/.test(A.CLASSES['convergent-analogue'].means)));
  check('while the dossier itself records that side (a) DERIVES from side (b), from a primary source',
    f(/derives from striated myofibers/.test(E.SOURCES.unguez_zakon_1998.what_it_states_that_is_used_here[0]),
      !/derives from striated myofibers/.test(E.SOURCES.unguez_zakon_1998.what_it_states_that_is_used_here[0])));
  check('SCHEMA_STRAIN names the clash and attributes it to homology_type "none" being overloaded',
    f(/overloaded/.test(E.SCHEMA_STRAIN['none-means-two-different-things'].the_mechanism) && E.SCHEMA_STRAIN['none-means-two-different-things'].pair === P2,
      !(/overloaded/.test(E.SCHEMA_STRAIN['none-means-two-different-things'].the_mechanism) && E.SCHEMA_STRAIN['none-means-two-different-things'].pair === P2)));
  check('and it says why the existing structure pairs in analogy.mjs never exposed it',
    f(/insect-wing-pectoral-fin/.test(E.SCHEMA_STRAIN['none-means-two-different-things'].what_would_fix_it),
      !/insect-wing-pectoral-fin/.test(E.SCHEMA_STRAIN['none-means-two-different-things'].what_would_fix_it)));

  const c1 = E.CLASSIFIED[P1];
  check('pair 1 is classified orthologous-untested: orthology wins the branch and convergence is lost',
    f(c1.class === 'orthologous-untested', c1.class !== 'orthologous-untested'), `class ${c1.class}`);
  check('convergent-analogue is therefore UNREACHABLE for pair 1, which is the point of the finding',
    f(A.classify({ ...pair(P1), evidence: pair(P1).evidence }).class !== 'convergent-analogue',
      A.classify({ ...pair(P1), evidence: pair(P1).evidence }).class === 'convergent-analogue'));
  check('and removing only the orthology slot would flip it, showing the branch order is what did it',
    f(A.classify({ ...pair(P1), evidence: { ...pair(P1).evidence, 'sequence-orthology': { present: false } } }).class === 'convergent-analogue',
      A.classify({ ...pair(P1), evidence: { ...pair(P1).evidence, 'sequence-orthology': { present: false } } }).class !== 'convergent-analogue'));
  const ocStrain = E.SCHEMA_STRAIN['orthology-and-convergence-are-not-alternatives'];
  check('SCHEMA_STRAIN defends the code\'s precedence rather than only complaining about it',
    f(typeof ocStrain.why_the_code_is_right === 'string' && /dead experiment/.test(ocStrain.why_the_code_is_right),
      !(typeof ocStrain.why_the_code_is_right === 'string' && /dead experiment/.test(ocStrain.why_the_code_is_right))));
  check('and proposes a fix that is not a reordering of the branches',
    f(/Not a reordering/.test(ocStrain.what_would_fix_it_in_the_module), !/Not a reordering/.test(ocStrain.what_would_fix_it_in_the_module)));

  const strain = Object.keys(E.SCHEMA_STRAIN).filter(k => k !== 'what_did_NOT_strain');
  check('every strain point names a pair, a mechanism and a fix, so none is a shrug',
    f(strain.every(k => typeof E.SCHEMA_STRAIN[k].pair === 'string' && Object.keys(E.SCHEMA_STRAIN[k]).some(f2 => /fix/.test(f2))),
      !strain.every(k => typeof E.SCHEMA_STRAIN[k].pair === 'string' && Object.keys(E.SCHEMA_STRAIN[k]).some(f2 => /fix/.test(f2)))),
    strain.join(', '));
  check('and the parts of the schema that HELD are recorded too, so the critique is not one-sided',
    f(E.SCHEMA_STRAIN.what_did_NOT_strain.length >= 3, !(E.SCHEMA_STRAIN.what_did_NOT_strain.length >= 3)),
    `${E.SCHEMA_STRAIN.what_did_NOT_strain.length}`);
}

// ====================================================================================================
// 9. THE SLOT THAT DOES NOT EXIST, AND THE ONE USED BACKWARDS
// ====================================================================================================
{
  const lof2 = pair(P2).evidence['lof-phenotype'];
  check('the denervation result is NOT entered as a loss-of-function phenotype',
    f(lof2.present === false, lof2.present !== false), `present ${lof2.present}`);
  check('but it is described in the slot, with its numbers, so the evidence is not lost with the slot',
    f(/spinal transection|denervation/.test(lof2.why) && /sarcomere/.test(lof2.why),
      !(/spinal transection|denervation/.test(lof2.why) && /sarcomere/.test(lof2.why))), lof2.why.slice(0, 90));
  check('and the missing slot is named as a schema gap with a proposed eighth kind',
    f(/eighth kind/.test(E.SCHEMA_STRAIN['no-slot-for-a-cell-state-perturbation'].what_would_fix_it),
      !/eighth kind/.test(E.SCHEMA_STRAIN['no-slot-for-a-cell-state-perturbation'].what_would_fix_it)));
  check('the cost is identified as arithmetical: lof-phenotype is one of the high-value-if-missing kinds',
    f(/lower bound/.test(E.SCHEMA_STRAIN['no-slot-for-a-cell-state-perturbation'].the_consequence_is_arithmetical_not_only_cosmetic),
      !/lower bound/.test(E.SCHEMA_STRAIN['no-slot-for-a-cell-state-perturbation'].the_consequence_is_arithmetical_not_only_cosmetic)));
  // And the arithmetic really does bite: adding the slot back moves the lower bound.
  const withLof = A.scoreAnalogy(pair(P2).a, pair(P2).b, { ...pair(P2).evidence, 'lof-phenotype': { present: true } });
  check('and it demonstrably bites: entering that slot would raise pair 2\'s lower bound',
    f(withLof.confidence.lo > E.SCORED[P2].confidence.lo, !(withLof.confidence.lo > E.SCORED[P2].confidence.lo)),
    `${withLof.confidence.lo} vs ${E.SCORED[P2].confidence.lo}`);

  const pos2 = pair(P2).evidence['positional-correspondence'];
  check('shared cell lineage had to go into the positional slot, and the slot says so',
    f(pos2.present === true && /CELL LINEAGE/.test(pos2.caveat), !(pos2.present === true && /CELL LINEAGE/.test(pos2.caveat))));
  check('and the inversion is named: the evidence that should upgrade the pair is scored AS the weak kind',
    f(/BREAK the circularity/.test(pos2.caveat) && /Nakamura 2016/.test(pos2.caveat),
      !(/BREAK the circularity/.test(pos2.caveat) && /Nakamura 2016/.test(pos2.caveat))));
  check('analogy.mjs really does name shared cell lineage as the circularity-breaker, so the complaint lands',
    f(/shared cell lineage/.test(A.CLASSES['positional-only'].upgrade), !/shared cell lineage/.test(A.CLASSES['positional-only'].upgrade)));
  check('positional-correspondence really is the weakest base interval, so "backwards" is the right word',
    f(A.EVIDENCE_KINDS['positional-correspondence'].band[1] === Math.min(...A.EVIDENCE_IDS.map(k => A.EVIDENCE_KINDS[k].band[1])),
      A.EVIDENCE_KINDS['positional-correspondence'].band[1] !== Math.min(...A.EVIDENCE_IDS.map(k => A.EVIDENCE_KINDS[k].band[1]))));
}

// ====================================================================================================
// 10. WHAT IS NOT CLAIMED
// ====================================================================================================
{
  check('NOT_CLAIMED is a list with substance, not a disclaimer line',
    f(E.NOT_CLAIMED.length >= 5 && E.NOT_CLAIMED.every(s => typeof s === 'string' && s.length > 60),
      !(E.NOT_CLAIMED.length >= 5 && E.NOT_CLAIMED.every(s => typeof s === 'string' && s.length > 60))), `${E.NOT_CLAIMED.length}`);
  check('it disclaims the substitutability reading of pair 1 explicitly',
    f(E.NOT_CLAIMED.some(s => /can do the other's job/.test(s)), !E.NOT_CLAIMED.some(s => /can do the other's job/.test(s))));
  check('it disclaims the module\'s own label for pair 2, naming it a misclassification',
    f(E.NOT_CLAIMED.some(s => /misclassification/.test(s)), !E.NOT_CLAIMED.some(s => /misclassification/.test(s))));
  check('it records that this file speaks to two lineages and not to the other independent origins',
    f(E.NOT_CLAIMED.some(s => /six times/.test(s)), !E.NOT_CLAIMED.some(s => /six times/.test(s))));
  check('the six-times figure is attributed to the paper that states it rather than asserted',
    f(E.SOURCES.gallant_2014.what_it_states_that_is_used_here.some(s => /evolved six times in fishes/.test(s)),
      !E.SOURCES.gallant_2014.what_it_states_that_is_used_here.some(s => /evolved six times in fishes/.test(s))));
  const noLimits = Object.entries(E.SOURCES).filter(([, s]) => !s.what_it_does_not_state && !s.what_it_does_not_establish && !s.what_it_is_not && !s.why_it_is_NOT_entered_as_rescue_for_pair_2 && !s.why_this_source_is_the_important_one_here && !s.why_this_matters && !s.what_it_establishes);
  check('every source states either its limits or exactly what it establishes, so none is a bare citation',
    f(noLimits.length === 0, noLimits.length !== 0), noLimits.map(([k]) => k).join(', '));
}

// ====================================================================================================
if (QUIET) {
  // One injected fault. The parent reads this line.
  console.log(`FAULT ${FAULT_IDX} fail=${fail}`);
  process.exit(0);
}

console.log(`\n${pass} pass, ${fail} fail`);

if (SWEEP) {
  const { execFileSync } = await import('node:child_process');
  const self = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const survivors = [];
  let ran = 0;
  for (let i = 0; i < names.length; i++) {
    const out = execFileSync(process.execPath, [self, `--fault=${i}`], { encoding: 'utf8' });
    const m = /FAULT \d+ fail=(\d+)/.exec(out);
    ran++;
    if (!m || Number(m[1]) !== 1) survivors.push(`#${i} ${names[i]}${m ? ` (fail=${m[1]})` : ' (no result line)'}`);
  }
  console.log(`\n--fail-once: ${ran} runs, one fault per run, iterating over every assertion. ${survivors.length} survived.`);
  if (survivors.length) {
    for (const s of survivors) console.log(`  SURVIVOR ${s}`);
    console.log('SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
    process.exit(1);
  }
  console.log('No survivors: every assertion is load-bearing.');
  process.exit(0);
}

process.exit(fail ? 1 : 0);
