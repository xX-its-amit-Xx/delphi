#!/usr/bin/env node
// Tests for benchmarks/retro-validation/data/myoglobin.mjs - the ground-truth table for the
// charge-against-dive-capacity retro-validation.
//
//   node benchmarks/retro-validation/data/test-myoglobin.mjs [--fail-once]
//   node benchmarks/retro-validation/data/test-myoglobin.mjs --live    # re-fetch every accession
//
// Five things are checked harder than the rest, because they are the five ways a data file like this
// does damage - and all five damage the SAME way: they put a number in front of a reader that no
// instrument produced.
//
//   1. AN ACCESSION THAT WAS NEVER RESOLVED, OR RESOLVED TO THE WRONG ANIMAL. The whole file is a
//      mapping from an animal to a sequence. If one accession is a plausible-looking string that was
//      recalled rather than fetched, every downstream result about that species is noise wearing a
//      binomial. So every row must carry the organism name READ BACK from the live response, and it
//      must match the row's own `latin`, and the stored sequence's length must match the length that
//      came back. `--live` re-fetches all of them and checks the file against the resource itself.
//   2. A MEASUREMENT WITHOUT A SOURCE. A dive duration with no DOI or PMID is indistinguishable from
//      an invented one, and this repo's worst possible output is an invented measurement. Every
//      non-null duration must carry an identifier, and every null must carry a reason instead.
//   3. A NUMBER WITHOUT UNITS. "119" is not a duration. Minutes and seconds differ by sixty, and the
//      diving literature reports both.
//   4. A ZERO STANDING IN FOR AN ABSENT MEASUREMENT. The four terrestrial anchors are the low end of
//      the axis, and four exact zeros would carry a regression on their own. They must be null, with a
//      reason, and nothing in the file may quietly coerce them to 0.
//   5. A FUSED SCORE AS A HEADLINE. The baseline probe's three axes disagree with each other. One
//      number across them would hide exactly the disagreement that makes the file worth having.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a
// wrong value. Every line must then FAIL. An assertion that survives its own inversion is asserting
// nothing about its subject and is not a test.
import * as M from './myoglobin.mjs';

const FAULT = process.argv.includes('--fail-once');
const LIVE = process.argv.includes('--live');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const ID = /^10\.\d{4,9}\/\S+$|^\d{7,8}$/; // a DOI or a PubMed id, and nothing else
const hasId = (s) => !!s && (ID.test(s.doi ?? '') || ID.test(s.pmid ?? ''));

console.log(`\nmyoglobin: a sequence, an animal, and a number somebody actually measured${FAULT ? '   [--fail-once: every assertion faulted]' : ''}\n`);

// ====================================================================================================
// 1. EVERY ACCESSION RESOLVED LIVE, TO THE RIGHT ANIMAL
// ====================================================================================================
{
  check('there are at least twelve species rows',
    f(M.ROWS.length >= 12, !(M.ROWS.length >= 12)), `${M.ROWS.length}`);
  const noReadBack = M.ROWS.filter((r) => typeof r.uniprot.organism_read_back !== 'string' || !r.uniprot.organism_read_back);
  check('EVERY row carries the organism name read back from the live UniProt response',
    f(noReadBack.length === 0, noReadBack.length !== 0), noReadBack.map((r) => r.uniprot.accession).join(', '));
  const mismatch = M.ROWS.filter((r) => r.uniprot.organism_read_back !== r.latin);
  check('and that read-back organism MATCHES the row’s own binomial, for every row',
    f(mismatch.length === 0, mismatch.length !== 0),
    mismatch.map((r) => `${r.uniprot.accession}: ${r.latin} vs ${r.uniprot.organism_read_back}`).join(' | '));
  const noDate = M.ROWS.filter((r) => r.uniprot.verified_on !== M.FETCHED_ON);
  check('every row records the date it was verified on, and it is the file’s fetch date',
    f(noDate.length === 0, noDate.length !== 0), `${M.FETCHED_ON}`);
  check('the fetch date is a plain ISO date, so it can be compared rather than read',
    f(/^\d{4}-\d{2}-\d{2}$/.test(M.FETCHED_ON), !/^\d{4}-\d{2}-\d{2}$/.test(M.FETCHED_ON)), M.FETCHED_ON);
  const noHow = M.ROWS.filter((r) => typeof r.uniprot.verified_how !== 'string' || r.uniprot.verified_how.length < 60);
  check('every row says HOW it was verified, in enough words to be checkable',
    f(noHow.length === 0, noHow.length !== 0), noHow.map((r) => r.uniprot.accession).join(', '));
  const badEndpoint = M.ROWS.filter((r) => r.uniprot.endpoint !== `https://rest.uniprot.org/uniprotkb/${r.uniprot.accession}.json`);
  check('every row records the exact URL that was fetched, built from its own accession',
    f(badEndpoint.length === 0, badEndpoint.length !== 0), badEndpoint.map((r) => r.uniprot.accession).join(', '));
  const notMyoglobin = M.ROWS.filter((r) => !/myoglobin/i.test(r.uniprot.protein_name_read_back ?? ''));
  check('the protein read back is MYOGLOBIN for every row, not merely something at that accession',
    f(notMyoglobin.length === 0, notMyoglobin.length !== 0), notMyoglobin.map((r) => `${r.uniprot.accession}:${r.uniprot.protein_name_read_back}`).join(', '));
  const noTaxon = M.ROWS.filter((r) => !Number.isInteger(r.uniprot.taxon_id_read_back) || r.uniprot.taxon_id_read_back <= 0);
  check('every row carries an NCBI taxon id read back from the response, so the organism is machine-identified too',
    f(noTaxon.length === 0, noTaxon.length !== 0), noTaxon.map((r) => r.uniprot.accession).join(', '));
  const dupTaxa = M.ROWS.map((r) => r.uniprot.taxon_id_read_back).filter((t, i, a) => a.indexOf(t) !== i);
  check('no two rows are the same taxon, so no species is double-counted in a regression',
    f(dupTaxa.length === 0, dupTaxa.length !== 0), dupTaxa.join(', '));
  const dupAcc = M.ROWS.map((r) => r.uniprot.accession).filter((x, i, a) => a.indexOf(x) !== i);
  check('no accession appears twice',
    f(dupAcc.length === 0, dupAcc.length !== 0), dupAcc.join(', '));
}

// ====================================================================================================
// 2. THE SEQUENCES MATCH WHAT WAS READ BACK
// ====================================================================================================
// A sequence stored at the wrong length is the quiet version of a wrong accession: it resolves, it has
// a binomial, and the feature computed from it is wrong by however many residues are missing.
{
  const lenMismatch = M.ROWS.filter((r) => r.sequence?.length !== r.uniprot.length_read_back);
  check('every stored sequence is exactly as long as the length UniProt reported for its accession',
    f(lenMismatch.length === 0, lenMismatch.length !== 0),
    lenMismatch.map((r) => `${r.uniprot.accession}: stored ${r.sequence?.length} vs read back ${r.uniprot.length_read_back}`).join(' | '));
  const notFull = M.ROWS.filter((r) => r.uniprot.length_read_back !== 154);
  check('every kept row is full-length mammalian myoglobin at 154 aa, so no fragment is in the table',
    f(notFull.length === 0, notFull.length !== 0), notFull.map((r) => `${r.uniprot.accession}:${r.uniprot.length_read_back}`).join(', '));
  const badLetters = M.ROWS.filter((r) => !/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(r.sequence ?? ''));
  check('every sequence is standard amino-acid letters only: no X, no gap, no stop',
    f(badLetters.length === 0, badLetters.length !== 0), badLetters.map((r) => r.uniprot.accession).join(', '));
  const noMet = M.ROWS.filter((r) => !r.sequence.startsWith('M'));
  check('every sequence starts at the initiator methionine, so the numbering is comparable across rows',
    f(noMet.length === 0, noMet.length !== 0), noMet.map((r) => r.uniprot.accession).join(', '));
  // Identical sequences across species are a FACT here, not a paste error. What must not happen is them
  // going undeclared, because then they are silently several data points instead of one.
  const groups = M.identicalSequenceGroups();
  check('rows that share a byte-identical sequence are DECLARED as a group rather than left to be noticed',
    f(groups.length >= 1 && groups.every((g) => g.length >= 2), !(groups.length >= 1 && groups.every((g) => g.length >= 2))),
    groups.map((g) => g.join(' = ')).join(' | '));
  check('every declared group member is a real row, so the grouping is computed from the rows and cannot drift',
    f(groups.flat().every((l) => M.byLatin(l) !== undefined), !groups.flat().every((l) => M.byLatin(l) !== undefined)));
  check('and the groups really are identical, checked against the sequences themselves',
    f(groups.every((g) => new Set(g.map((l) => M.byLatin(l).sequence)).size === 1),
      !groups.every((g) => new Set(g.map((l) => M.byLatin(l).sequence)).size === 1)));
  check('distinctSequences() is fewer than the row count, which is the whole point of declaring the groups',
    f(M.distinctSequences() < M.ROWS.length && M.distinctSequences() === M.ROWS.length - groups.reduce((a, g) => a + g.length - 1, 0),
      !(M.distinctSequences() < M.ROWS.length && M.distinctSequences() === M.ROWS.length - groups.reduce((a, g) => a + g.length - 1, 0))),
    `${M.distinctSequences()} distinct of ${M.ROWS.length}`);
  check('regressionSet() takes at most ONE row from each identical-sequence group, so no group is counted twice',
    f(groups.every((g) => g.filter((l) => M.regressionSet().includes(M.byLatin(l))).length <= 1),
      !groups.every((g) => g.filter((l) => M.regressionSet().includes(M.byLatin(l))).length <= 1)),
    groups.map((g) => `${g.filter((l) => M.regressionSet().includes(M.byLatin(l))).length} of ${g.length}`).join(' | '));
  check('IDENTICAL_SEQUENCES_MEAN says what an identical pair with DIFFERENT durations would prove, and that the file cannot run it yet',
    f(/same input, different output/.test(M.IDENTICAL_SEQUENCES_MEAN.and_the_harder_point) && /cannot run that test yet/.test(M.IDENTICAL_SEQUENCES_MEAN.and_the_harder_point),
      !(/same input, different output/.test(M.IDENTICAL_SEQUENCES_MEAN.and_the_harder_point) && /cannot run that test yet/.test(M.IDENTICAL_SEQUENCES_MEAN.and_the_harder_point))));
  check('and it refuses to call them duplicates to be deleted',
    f(/not duplicates to be deleted/.test(M.IDENTICAL_SEQUENCES_MEAN.not_an_error), !/not duplicates to be deleted/.test(M.IDENTICAL_SEQUENCES_MEAN.not_an_error)));
  check('composition() counts residues out of the sequence rather than returning a stored value',
    f(M.composition('MKKDDEE').basic_KR === 2 && M.composition('MKKDDEE').acidic_DE === 4 && M.composition('MKKDDEE').KR_minus_DE === -2,
      !(M.composition('MKKDDEE').basic_KR === 2 && M.composition('MKKDDEE').acidic_DE === 4 && M.composition('MKKDDEE').KR_minus_DE === -2)),
    JSON.stringify(M.composition('MKKDDEE')));
  check('composition() length agrees with the sequence it was given',
    f(M.ROWS.every((r) => M.composition(r.sequence).length === r.sequence.length), !M.ROWS.every((r) => M.composition(r.sequence).length === r.sequence.length)));
}

// ====================================================================================================
// 3. EVERY NON-NULL DURATION CARRIES A SOURCE IDENTIFIER
// ====================================================================================================
// The central guard. A measurement attributed to a paper with no identifier on it cannot be checked,
// and an unverifiable measurement is indistinguishable from a fabricated one.
{
  const withD = M.withDuration();
  check('at least some rows actually carry a duration, or the file tests nothing',
    f(withD.length >= 8, !(withD.length >= 8)), `${withD.length}`);
  const noSource = withD.filter((r) => !hasId(r.max_dive_duration.source));
  check('EVERY non-null duration carries a DOI or a PubMed id for THAT number',
    f(noSource.length === 0, noSource.length !== 0), noSource.map((r) => r.latin).join(', '));
  const badIdShape = withD.filter((r) => { const s = r.max_dive_duration.source; return !(ID.test(s.doi ?? '') && ID.test(s.pmid ?? '')); });
  check('and those identifiers are well-formed: a real DOI prefix and a numeric PubMed id, both present',
    f(badIdShape.length === 0, badIdShape.length !== 0), badIdShape.map((r) => `${r.latin}: ${r.max_dive_duration.source?.doi}/${r.max_dive_duration.source?.pmid}`).join(' | '));
  const unknownSource = withD.filter((r) => !Object.values(M.SOURCES).some((s) => s.doi === r.max_dive_duration.source.doi));
  check('every duration’s source is one of the SOURCES whose retrieval is documented, not a loose citation',
    f(unknownSource.length === 0, unknownSource.length !== 0), unknownSource.map((r) => r.latin).join(', '));
  const noKind = withD.filter((r) => !M.DURATION_KIND_IDS.includes(r.max_dive_duration.kind));
  check('every non-null duration declares its DURATION_KIND from the closed vocabulary',
    f(noKind.length === 0, noKind.length !== 0), noKind.map((r) => `${r.latin}:${r.max_dive_duration.kind}`).join(', '));
  const noProvenanceFlag = withD.filter((r) => typeof r.max_dive_duration.primary_source_retrieved !== 'boolean');
  check('every non-null duration states whether the PRIMARY source behind it was retrieved',
    f(noProvenanceFlag.length === 0, noProvenanceFlag.length !== 0), noProvenanceFlag.map((r) => r.latin).join(', '));
  const unattributed = withD.filter((r) => r.max_dive_duration.primary_source_retrieved === false
    && !r.max_dive_duration.attributed_by_that_table_to && !r.max_dive_duration.caveat);
  check('where the primary source was NOT retrieved, the row says who the number is attributed to, or why to doubt it',
    f(unattributed.length === 0, unattributed.length !== 0), unattributed.map((r) => r.latin).join(', '));
  const noQuoteOrTable = withD.filter((r) => !r.max_dive_duration.quote && !r.max_dive_duration.source.table);
  check('every non-null duration points at the sentence or the table cell it was read out of',
    f(noQuoteOrTable.length === 0, noQuoteOrTable.length !== 0), noQuoteOrTable.map((r) => r.latin).join(', '));
  // At least one duration must come from a source whose primary document we actually read, or the whole
  // file is citations of citations.
  const direct = withD.filter((r) => r.max_dive_duration.primary_source_retrieved === true);
  check('at least one duration comes from a primary document that was itself retrieved',
    f(direct.length >= 1, !(direct.length >= 1)), `${direct.length}`);
  check('the best-evidenced duration is the one from a directly-retrieved species maximum',
    f(withD.some((r) => r.max_dive_duration.kind === 'species-maximum-directly-reported' && r.max_dive_duration.primary_source_retrieved === true),
      !withD.some((r) => r.max_dive_duration.kind === 'species-maximum-directly-reported' && r.max_dive_duration.primary_source_retrieved === true)));
}

// ====================================================================================================
// 4. NO NUMBER WITHOUT UNITS, AND NO NULL WITHOUT A REASON
// ====================================================================================================
{
  const noUnits = M.ROWS.filter((r) => r.max_dive_duration.units !== 'min');
  check('NO row has a duration field without units - null rows included, since a null is still a quantity with a unit',
    f(noUnits.length === 0, noUnits.length !== 0), noUnits.map((r) => `${r.latin}:${r.max_dive_duration.units}`).join(', '));
  const nulls = M.nullDuration();
  check('the null rows are a real part of the file, not an empty case',
    f(nulls.length >= 1, !(nulls.length >= 1)), `${nulls.length}`);
  const noReason = nulls.filter((r) => typeof r.max_dive_duration.null_reason !== 'string' || r.max_dive_duration.null_reason.length < 40);
  check('EVERY null duration carries a null_reason with substance in it',
    f(noReason.length === 0, noReason.length !== 0), noReason.map((r) => r.latin).join(', '));
  const noWhat = nulls.filter((r) => typeof r.max_dive_duration.what_would_have_to_be_measured !== 'string' || r.max_dive_duration.what_would_have_to_be_measured.length < 20);
  check('every null says what would have to be measured to fill it, so the gap is actionable',
    f(noWhat.length === 0, noWhat.length !== 0), noWhat.map((r) => r.latin).join(', '));
  const nullWithSource = nulls.filter((r) => r.max_dive_duration.source !== null);
  check('a null duration carries NO source, so no citation can be read as backing a number that is not there',
    f(nullWithSource.length === 0, nullWithSource.length !== 0), nullWithSource.map((r) => r.latin).join(', '));
  const nullWithKind = nulls.filter((r) => 'kind' in r.max_dive_duration);
  check('a null duration has no DURATION_KIND either: there is no measurement to classify',
    f(nullWithKind.length === 0, nullWithKind.length !== 0), nullWithKind.map((r) => r.latin).join(', '));
  check('no duration anywhere in the file is zero, which is how an absent measurement sneaks in as a datum',
    f(M.ROWS.every((r) => r.max_dive_duration.value !== 0), !M.ROWS.every((r) => r.max_dive_duration.value !== 0)),
    M.ROWS.filter((r) => r.max_dive_duration.value === 0).map((r) => r.latin).join(', '));
  const nonPositive = M.withDuration().filter((r) => !(r.max_dive_duration.value > 0));
  check('every present duration is a positive number of minutes',
    f(nonPositive.length === 0, nonPositive.length !== 0), nonPositive.map((r) => r.latin).join(', '));
  // The hooded seal's lower bound is a number that is NOT a maximum. It must not leak into the value.
  const lb = M.ROWS.filter((r) => r.max_dive_duration.lower_bound);
  check('a row that only has a LOWER BOUND keeps its value null and stores the bound separately',
    f(lb.length >= 1 && lb.every((r) => r.max_dive_duration.value === null && r.max_dive_duration.lower_bound.value > 0),
      !(lb.length >= 1 && lb.every((r) => r.max_dive_duration.value === null && r.max_dive_duration.lower_bound.value > 0))), `${lb.length}`);
  check('and that lower bound carries its own source identifier and the sentence it came from',
    f(lb.every((r) => hasId(r.max_dive_duration.lower_bound.source) && typeof r.max_dive_duration.lower_bound.quote === 'string'),
      !lb.every((r) => hasId(r.max_dive_duration.lower_bound.source) && typeof r.max_dive_duration.lower_bound.quote === 'string')));
}

// ====================================================================================================
// 5. THE TERRESTRIAL ANCHORS ARE PRESENT, AND THEY ARE NULL, NOT ZERO
// ====================================================================================================
{
  for (const latin of ['Homo sapiens', 'Mus musculus', 'Equus caballus', 'Bos taurus']) {
    check(`the terrestrial anchor ${latin} is present`,
      f(M.byLatin(latin) !== undefined, M.byLatin(latin) === undefined));
  }
  check('TERRESTRIAL_ANCHORS lists exactly those four and they all resolve to rows',
    f(M.TERRESTRIAL_ANCHORS.length === 4 && M.TERRESTRIAL_ANCHORS.every((l) => M.byLatin(l) !== undefined),
      !(M.TERRESTRIAL_ANCHORS.length === 4 && M.TERRESTRIAL_ANCHORS.every((l) => M.byLatin(l) !== undefined))), M.TERRESTRIAL_ANCHORS.join(', '));
  const anchorRows = M.anchors();
  check('every anchor is marked strictly-terrestrial, so the no-dive end of the axis is explicit',
    f(anchorRows.length === 4 && anchorRows.every((r) => r.habit === 'strictly-terrestrial'),
      !(anchorRows.length === 4 && anchorRows.every((r) => r.habit === 'strictly-terrestrial'))), `${anchorRows.length}`);
  check('every anchor’s duration is NULL, not 0',
    f(anchorRows.every((r) => r.max_dive_duration.value === null), !anchorRows.every((r) => r.max_dive_duration.value === null)),
    anchorRows.map((r) => `${r.latin}:${r.max_dive_duration.value}`).join(', '));
  check('and the reason says in words why 0 would be a fabricated measurement',
    f(anchorRows.every((r) => /would be a fabricated measurement/i.test(r.max_dive_duration.null_reason)),
      !anchorRows.every((r) => /would be a fabricated measurement/i.test(r.max_dive_duration.null_reason))));
  check('the human row refuses to put a static-apnoea record in the dive-duration column, and says why',
    f(/different construct/i.test(M.byLatin('Homo sapiens').max_dive_duration.null_reason),
      !/different construct/i.test(M.byLatin('Homo sapiens').max_dive_duration.null_reason)));
  check('no anchor leaks into regressionSet(), because a null cannot be regressed',
    f(M.regressionSet().every((r) => r.habit !== 'strictly-terrestrial'), !M.regressionSet().every((r) => r.habit !== 'strictly-terrestrial')));
  check('the file spans the clades the comparison needs: cetacean, pinniped, sirenian and mustelid are all present',
    f(['cetacean', 'pinniped', 'sirenian', 'mustelid'].every((c) => M.ROWS.some((r) => r.clade === c)),
      !['cetacean', 'pinniped', 'sirenian', 'mustelid'].every((c) => M.ROWS.some((r) => r.clade === c))),
    [...new Set(M.ROWS.map((r) => r.clade))].join(', '));
  const badHabit = M.ROWS.filter((r) => !M.HABITS.includes(r.habit));
  check('every row’s habit comes from the closed HABITS vocabulary',
    f(badHabit.length === 0, badHabit.length !== 0), badHabit.map((r) => `${r.latin}:${r.habit}`).join(', '));
  const badClade = M.ROWS.filter((r) => !M.CLADES.includes(r.clade));
  check('every row’s clade comes from the closed CLADES vocabulary',
    f(badClade.length === 0, badClade.length !== 0), badClade.map((r) => `${r.latin}:${r.clade}`).join(', '));
}

// ====================================================================================================
// 6. THE PAPER'S RECORD IS HONEST ABOUT WHAT WAS NOT RETRIEVED
// ====================================================================================================
{
  check('the Mirceta record carries the DOI and PMID the file claims',
    f(M.MIRCETA_2013.doi === '10.1126/science.1234192' && M.MIRCETA_2013.pmid === '23766330',
      !(M.MIRCETA_2013.doi === '10.1126/science.1234192' && M.MIRCETA_2013.pmid === '23766330')), `${M.MIRCETA_2013.doi} / ${M.MIRCETA_2013.pmid}`);
  check('it records that there is NO PMCID, rather than leaving the field off',
    f(M.MIRCETA_2013.pmcid === null && 'pmcid' in M.MIRCETA_2013, !(M.MIRCETA_2013.pmcid === null && 'pmcid' in M.MIRCETA_2013)));
  check('it says what WAS retrieved and what was NOT, as two separate statements',
    f(/abstract/i.test(M.MIRCETA_2013.retrieved) && /full text/i.test(M.MIRCETA_2013.not_retrieved),
      !(/abstract/i.test(M.MIRCETA_2013.retrieved) && /full text/i.test(M.MIRCETA_2013.not_retrieved))));
  check('the unretrieved list names the Zmb DEFINITION specifically, not just "the paper"',
    f(/definition of Zmb/i.test(M.MIRCETA_2013.not_retrieved), !/definition of Zmb/i.test(M.MIRCETA_2013.not_retrieved)));
  check('it records the 403 from the publisher, so the attempt is on the record and not just the failure',
    f(/403/.test(M.MIRCETA_2013.verified_how), !/403/.test(M.MIRCETA_2013.verified_how)));
  check('the stored abstract says how it was obtained, so it is not a remembered paraphrase',
    f(/get_article_metadata/i.test(M.MIRCETA_2013.abstract_verified_how), !/get_article_metadata/i.test(M.MIRCETA_2013.abstract_verified_how)));
  check('the abstract stored is the real one: it names net surface charge and the 130-species phylogeny',
    f(/net surface charge/.test(M.MIRCETA_2013.abstract_retrieved) && /130-species/.test(M.MIRCETA_2013.abstract_retrieved),
      !(/net surface charge/.test(M.MIRCETA_2013.abstract_retrieved) && /130-species/.test(M.MIRCETA_2013.abstract_retrieved))));
  check('the record separates what the abstract DOES say from what it does NOT, with items in both',
    f(M.MIRCETA_2013.what_the_abstract_does_say.length >= 3 && M.MIRCETA_2013.what_the_abstract_does_NOT_say.length >= 3,
      !(M.MIRCETA_2013.what_the_abstract_does_say.length >= 3 && M.MIRCETA_2013.what_the_abstract_does_NOT_say.length >= 3)));
  check('the does-NOT list states that no per-species charge value was retrieved',
    f(M.MIRCETA_2013.what_the_abstract_does_NOT_say.some((s) => /per-species charge value/i.test(s)),
      !M.MIRCETA_2013.what_the_abstract_does_NOT_say.some((s) => /per-species charge value/i.test(s))));
  check('and the record concludes that no claim to reproduce the paper may be made',
    f(/may not claim to reproduce/i.test(M.MIRCETA_2013.therefore), !/may not claim to reproduce/i.test(M.MIRCETA_2013.therefore)));
  const noHow = Object.entries(M.SOURCES).filter(([, s]) => typeof s.verified_how !== 'string' || s.verified_how.length < 60);
  check('EVERY source in SOURCES says in verified_how exactly what was checked',
    f(noHow.length === 0, noHow.length !== 0), noHow.map(([k]) => k).join(', '));
  const secondHand = Object.entries(M.SOURCES).filter(([, s]) => s.source_kind && !s.table_credits_were_not_retrieved);
  check('every source that is a compilation or a review admits that its own citations were not retrieved',
    f(secondHand.length === 0, secondHand.length !== 0), secondHand.map(([k]) => k).join(', '));
}

// ====================================================================================================
// 7. THE DIRECTION IS A SIGN WITH A SENTENCE BEHIND IT
// ====================================================================================================
{
  check('EXPECTED_DIRECTION states a sign',
    f(M.EXPECTED_DIRECTION.sign === 'positive', M.EXPECTED_DIRECTION.sign !== 'positive'), M.EXPECTED_DIRECTION.sign);
  check('and quotes the exact sentence it was taken from',
    f(/elevated myoglobin net surface charge in diving species/.test(M.EXPECTED_DIRECTION.exact_sentence_retrieved),
      !/elevated myoglobin net surface charge in diving species/.test(M.EXPECTED_DIRECTION.exact_sentence_retrieved)));
  check('and says where that sentence came from, by identifier',
    f(/23766330/.test(M.EXPECTED_DIRECTION.sentence_source), !/23766330/.test(M.EXPECTED_DIRECTION.sentence_source)));
  check('it distinguishes what the sentence LICENSES from what it does not',
    f(/divers > non-divers/.test(M.EXPECTED_DIRECTION.what_the_sentence_licenses) && /CONCENTRATION/.test(M.EXPECTED_DIRECTION.what_the_sentence_does_not_license),
      !(/divers > non-divers/.test(M.EXPECTED_DIRECTION.what_the_sentence_licenses) && /CONCENTRATION/.test(M.EXPECTED_DIRECTION.what_the_sentence_does_not_license))));
  check('it names body mass as a confound with the right sign, rather than leaving it to be discovered',
    f(M.EXPECTED_DIRECTION.how_it_could_be_wrong_here.some((s) => /body mass/i.test(s)),
      !M.EXPECTED_DIRECTION.how_it_could_be_wrong_here.some((s) => /body mass/i.test(s))));
  check('it names the possibility that the whole signal is one group contrast wearing a regression line',
    f(M.EXPECTED_DIRECTION.how_it_could_be_wrong_here.some((s) => /group contrast wearing a regression line/i.test(s)),
      !M.EXPECTED_DIRECTION.how_it_could_be_wrong_here.some((s) => /group contrast wearing a regression line/i.test(s))));
  check('PROVENANCE says the subset is mammals only and gives the repo’s scope as the reason',
    f(M.PROVENANCE.subset === 'mammals only' && /comparative scope is mammals and fishes/.test(M.PROVENANCE.why),
      !(M.PROVENANCE.subset === 'mammals only' && /comparative scope is mammals and fishes/.test(M.PROVENANCE.why))), M.PROVENANCE.subset);
  check('PROVENANCE quotes what Mirceta reported AND states what could not be quoted from it',
    f(M.PROVENANCE.what_mirceta_reported.retrieved === true && /403/.test(M.PROVENANCE.what_mirceta_reported.and_what_we_could_not_quote),
      !(M.PROVENANCE.what_mirceta_reported.retrieved === true && /403/.test(M.PROVENANCE.what_mirceta_reported.and_what_we_could_not_quote))));
  check('PROVENANCE names the shared-compiler dependence among the durations instead of burying it',
    f(/one compiler/i.test(M.PROVENANCE.dive_durations.the_uncomfortable_part), !/one compiler/i.test(M.PROVENANCE.dive_durations.the_uncomfortable_part)));
  check('PROVENANCE’s accession counts agree with the rows and the drops actually in the file',
    f(M.PROVENANCE.uniprot.n_kept === M.ROWS.length
      && M.PROVENANCE.uniprot.n_dropped_after_reading === M.ROWS_DROPPED.filter((d) => d.accession !== null).length
      && M.PROVENANCE.uniprot.n_accessions_fetched >= M.ROWS.length + M.PROVENANCE.uniprot.n_dropped_after_reading,
      !(M.PROVENANCE.uniprot.n_kept === M.ROWS.length
        && M.PROVENANCE.uniprot.n_dropped_after_reading === M.ROWS_DROPPED.filter((d) => d.accession !== null).length
        && M.PROVENANCE.uniprot.n_accessions_fetched >= M.ROWS.length + M.PROVENANCE.uniprot.n_dropped_after_reading)),
    `kept ${M.PROVENANCE.uniprot.n_kept}/${M.ROWS.length}, dropped ${M.PROVENANCE.uniprot.n_dropped_after_reading} vs ${M.ROWS_DROPPED.filter((d) => d.accession !== null).length}`);
}

// ====================================================================================================
// 8. THE DROPPED ROWS ARE ON THE RECORD
// ====================================================================================================
{
  check('ROWS_DROPPED is not empty: something was looked at and not kept',
    f(M.ROWS_DROPPED.length >= 1, !(M.ROWS_DROPPED.length >= 1)), `${M.ROWS_DROPPED.length}`);
  const noReason = M.ROWS_DROPPED.filter((d) => typeof d.reason !== 'string' || d.reason.length < 40);
  check('every dropped row says why it was dropped, with substance',
    f(noReason.length === 0, noReason.length !== 0), `${noReason.length}`);
  const noHow = M.ROWS_DROPPED.filter((d) => typeof d.verified_how !== 'string' || !/uniprot/i.test(d.verified_how));
  check('every dropped row says it was actually fetched before being dropped',
    f(noHow.length === 0, noHow.length !== 0), `${noHow.length}`);
  const stillPresent = M.ROWS_DROPPED.filter((d) => d.accession && M.ROWS.some((r) => r.uniprot.accession === d.accession));
  check('no dropped accession is also in ROWS, which would mean the drop never happened',
    f(stillPresent.length === 0, stillPresent.length !== 0), stillPresent.map((d) => d.accession).join(', '));
  check('the drops include a search NEGATIVE, so "nothing found" is recorded as a fact about the search',
    f(M.ROWS_DROPPED.some((d) => d.accession === null && typeof d.sought === 'string'),
      !M.ROWS_DROPPED.some((d) => d.accession === null && typeof d.sought === 'string')));
  check('and that negative says why the first search was the wrong search, not that the gene is absent',
    f(M.ROWS_DROPPED.some((d) => d.accession === null && /carry no gene name/i.test(d.reason)),
      !M.ROWS_DROPPED.some((d) => d.accession === null && /carry no gene name/i.test(d.reason))));
  const dropShort = M.ROWS_DROPPED.filter((d) => d.length_read_back !== null && d.length_read_back !== undefined && d.length_read_back < 154);
  check('the rows dropped for LENGTH are all genuinely shorter than full-length myoglobin',
    f(dropShort.every((d) => d.length_read_back < 154) && dropShort.length >= 1, !(dropShort.every((d) => d.length_read_back < 154) && dropShort.length >= 1)),
    dropShort.map((d) => `${d.accession}:${d.length_read_back}`).join(', '));
  const dropFullLen = M.ROWS_DROPPED.filter((d) => d.length_read_back === 154);
  check('the full-length entries that were dropped were dropped for a stated residue-level reason, not for length',
    f(dropFullLen.length >= 1 && dropFullLen.every((d) => /\b[BZX]\b|residues|ambiguous|undetermined/i.test(d.reason)),
      !(dropFullLen.length >= 1 && dropFullLen.every((d) => /\b[BZX]\b|residues|ambiguous|undetermined/i.test(d.reason)))),
    dropFullLen.map((d) => d.accession).join(', '));
}

// ====================================================================================================
// 8b. THE AMBIGUITY TRAP
// ====================================================================================================
// This section exists because the assertion "sequences are standard letters" was written as a
// formality and failed on three of twenty-six rows on its first run.
{
  check('SEQUENCE_AMBIGUITY explains what B and Z actually mean, rather than calling them invalid characters',
    f(/Asp-or-Asn/.test(M.SEQUENCE_AMBIGUITY.the_problem) && /Glu-or-Gln/.test(M.SEQUENCE_AMBIGUITY.the_problem),
      !(/Asp-or-Asn/.test(M.SEQUENCE_AMBIGUITY.the_problem) && /Glu-or-Gln/.test(M.SEQUENCE_AMBIGUITY.the_problem))));
  check('it says WHY the ambiguity is fatal for this feature specifically, not generically bad',
    f(/exactly the two ambiguities that matter for a NET CHARGE/.test(M.SEQUENCE_AMBIGUITY.why_it_is_fatal_HERE_specifically),
      !/exactly the two ambiguities that matter for a NET CHARGE/.test(M.SEQUENCE_AMBIGUITY.why_it_is_fatal_HERE_specifically)));
  check('it compares the resulting error bar against the spread of the feature, which is what makes it fatal rather than untidy',
    f(/wider than the signal/.test(M.SEQUENCE_AMBIGUITY.why_it_is_fatal_HERE_specifically), !/wider than the signal/.test(M.SEQUENCE_AMBIGUITY.why_it_is_fatal_HERE_specifically)));
  check('the rule is to DROP, explicitly not to patch, vote or borrow from a relative',
    f(/not patched, not majority-voted, not filled in from a relative/.test(M.SEQUENCE_AMBIGUITY.so_the_rule_here),
      !/not patched, not majority-voted, not filled in from a relative/.test(M.SEQUENCE_AMBIGUITY.so_the_rule_here)));
  check('it lists the exact entries dropped for this, with their ambiguous-residue counts',
    f(M.SEQUENCE_AMBIGUITY.what_was_dropped_for_this.length === 3 && M.SEQUENCE_AMBIGUITY.what_was_dropped_for_this.every((s) => /\d/.test(s)),
      !(M.SEQUENCE_AMBIGUITY.what_was_dropped_for_this.length === 3 && M.SEQUENCE_AMBIGUITY.what_was_dropped_for_this.every((s) => /\d/.test(s)))),
    M.SEQUENCE_AMBIGUITY.what_was_dropped_for_this.join(' | '));
  const listedAccs = M.SEQUENCE_AMBIGUITY.what_was_dropped_for_this.map((s) => s.split(' ')[0]);
  check('and every entry it lists is really in ROWS_DROPPED and really absent from ROWS',
    f(listedAccs.every((a) => M.ROWS_DROPPED.some((d) => d.accession === a)) && listedAccs.every((a) => !M.ROWS.some((r) => r.uniprot.accession === a)),
      !(listedAccs.every((a) => M.ROWS_DROPPED.some((d) => d.accession === a)) && listedAccs.every((a) => !M.ROWS.some((r) => r.uniprot.accession === a)))),
    listedAccs.join(', '));
  check('it states the general lesson that a reviewed entry is not automatically the better entry',
    f(/not automatically the better entry/.test(M.SEQUENCE_AMBIGUITY.the_general_lesson), !/not automatically the better entry/.test(M.SEQUENCE_AMBIGUITY.the_general_lesson)));
  check('it records that a test caught this rather than claiming foresight',
    f(/written as a formality and failed on first run/.test(M.SEQUENCE_AMBIGUITY.how_this_was_caught),
      !/written as a formality and failed on first run/.test(M.SEQUENCE_AMBIGUITY.how_this_was_caught)));
  // A replaced row must say it was replaced, and a CONGENER substitution must say it is a different species.
  const replaced = M.ROWS.filter((r) => typeof r.accession_note === 'string');
  check('every row that replaced a dropped accession carries a note saying so',
    f(replaced.length >= 2, !(replaced.length >= 2)), `${replaced.length}`);
  const congener = M.byLatin('Castor canadensis');
  check('the congener substitution says in capitals that it is a DIFFERENT SPECIES, not a better entry for the same one',
    f(congener !== undefined && /DIFFERENT SPECIES/.test(congener.accession_note), !(congener !== undefined && /DIFFERENT SPECIES/.test(congener.accession_note))));
  check('and the species it replaced is NOT in the rows, so no reader can think both are present',
    f(M.byLatin('Castor fiber') === undefined, M.byLatin('Castor fiber') !== undefined));
  check('the muskrat was dropped outright rather than substituted, since no clean entry existed',
    f(M.ROWS.every((r) => r.clade !== 'rodent' || r.latin !== 'Ondatra zibethicus') && M.ROWS_DROPPED.some((d) => d.organism_read_back === 'Ondatra zibethicus'),
      !(M.ROWS.every((r) => r.clade !== 'rodent' || r.latin !== 'Ondatra zibethicus') && M.ROWS_DROPPED.some((d) => d.organism_read_back === 'Ondatra zibethicus'))));
}

// ====================================================================================================
// 9. NO FUSED SCORE, AND THE CRUDE FEATURE IS NOT CALLED Zmb
// ====================================================================================================
{
  const p = M.baselineProbe();
  check('the baseline probe exposes no fused score',
    f(p.fused_score === null && p.overall_verdict === null && 'fused_score' in p,
      !(p.fused_score === null && p.overall_verdict === null && 'fused_score' in p)));
  const axisNumbers = Object.entries(p).filter(([, v]) => typeof v === 'number').map(([k]) => k);
  check('no top-level property of the probe is a bare number',
    f(axisNumbers.length === 0, axisNumbers.length !== 0), axisNumbers.join(', '));
  const axes = Object.values(p.axes);
  check('the probe reports three separate axes, each with its own verdict',
    f(axes.length === 3 && axes.every((a) => M.PROBE_VERDICTS.includes(a.verdict)),
      !(axes.length === 3 && axes.every((a) => M.PROBE_VERDICTS.includes(a.verdict)))), axes.map((a) => a.verdict).join(', '));
  check('every axis says what its verdict MEANS, in words',
    f(axes.every((a) => typeof a.means === 'string' && a.means.length > 60), !axes.every((a) => typeof a.means === 'string' && a.means.length > 60)));
  check('the probe carries the NOT_ZMB warning with it, so the crude feature cannot be quoted as Zmb',
    f(p.feature_is_not_zmb === M.NOT_ZMB.warning && /IS NOT Zmb/.test(p.feature_is_not_zmb),
      !(p.feature_is_not_zmb === M.NOT_ZMB.warning && /IS NOT Zmb/.test(p.feature_is_not_zmb))));
  check('NOT_ZMB enumerates what a real Zmb would need, rather than only objecting',
    f(M.NOT_ZMB.what_a_real_Zmb_would_need.length >= 4, !(M.NOT_ZMB.what_a_real_Zmb_would_need.length >= 4)), `${M.NOT_ZMB.what_a_real_Zmb_would_need.length}`);
  check('NOT_ZMB names the pH as unknown to this file, which is the specific thing that makes a charge a charge',
    f(/pH is not known to this file/i.test(M.NOT_ZMB.what_a_real_Zmb_would_need.join(' ')),
      !/pH is not known to this file/i.test(M.NOT_ZMB.what_a_real_Zmb_would_need.join(' '))));
  check('the module exports no function or constant that computes a net surface charge, so none can be mistaken for one',
    f(!Object.keys(M).some((k) => /^(zmb|netSurfaceCharge|charge)$/i.test(k)), Object.keys(M).some((k) => /^(zmb|netSurfaceCharge|charge)$/i.test(k))),
    Object.keys(M).filter((k) => /charge|zmb/i.test(k)).join(', '));
  check('the probe refuses to report a p-value, and says why n and non-independence forbid it',
    f(/No p-value is reported/.test(p.axes.within_diver_ordering.not_a_p_value) && /phylogenetically independent/.test(p.axes.within_diver_ordering.not_a_p_value),
      !(/No p-value is reported/.test(p.axes.within_diver_ordering.not_a_p_value) && /phylogenetically independent/.test(p.axes.within_diver_ordering.not_a_p_value))));
  check('the probe states what it does NOT show, including that it says nothing about Mirceta’s result',
    f(p.what_this_does_and_does_not_show.some((s) => /^DOES NOT SHOW: anything about Mirceta/.test(s)),
      !p.what_this_does_and_does_not_show.some((s) => /^DOES NOT SHOW: anything about Mirceta/.test(s))));
  check('summary() exports no score either',
    f(M.summary().not_a_score === null && 'not_a_score' in M.summary(), !(M.summary().not_a_score === null && 'not_a_score' in M.summary())));
  check('summary()’s headline is a sentence, not a value, and carries no decimal point',
    f(typeof M.summary().headline === 'string' && !/\d/.test(M.summary().headline), !(typeof M.summary().headline === 'string' && !/\d/.test(M.summary().headline))),
    M.summary().headline.slice(0, 60));
}

// ====================================================================================================
// 10. THE PROBE'S OWN ARITHMETIC, AND THE RESULT IT FOUND
// ====================================================================================================
// These assert the computation, not the biology. If the data change the verdicts may change, and that
// is the point of recomputing them rather than storing them.
{
  const p = M.baselineProbe();
  const c = (r) => M.composition(r.sequence).KR_minus_DE;
  check('the anchor-separation axis agrees with a hand recomputation from the sequences',
    f(p.axes.anchor_separation.verdict === (Math.max(...M.anchors().map(c)) < Math.max(...M.divers().map(c)) && M.anchors().every((r) => c(r) <= 0) ? 'separates' : 'does-not-separate'),
      p.axes.anchor_separation.verdict !== (Math.max(...M.anchors().map(c)) < Math.max(...M.divers().map(c)) && M.anchors().every((r) => c(r) <= 0) ? 'separates' : 'does-not-separate')),
    p.axes.anchor_separation.verdict);
  check('the terrestrial anchors do in fact separate on the crude feature, which is the only part of the claim the abstract licenses',
    f(p.axes.anchor_separation.verdict === 'separates', p.axes.anchor_separation.verdict !== 'separates'),
    `anchor values ${p.axes.anchor_separation.anchor_values.join(', ')}`);
  check('the within-diver rank correlation is reported with its n, and the n is the regression set’s size',
    f(p.axes.within_diver_ordering.n === M.regressionSet().length, p.axes.within_diver_ordering.n !== M.regressionSet().length),
    `${p.axes.within_diver_ordering.n} vs ${M.regressionSet().length}`);
  check('the rank correlation is a number in [-1, 1]',
    f(p.axes.within_diver_ordering.spearman_rho >= -1 && p.axes.within_diver_ordering.spearman_rho <= 1,
      !(p.axes.within_diver_ordering.spearman_rho >= -1 && p.axes.within_diver_ordering.spearman_rho <= 1)),
    `${p.axes.within_diver_ordering.spearman_rho}`);
  check('and on this subset it is NEGATIVE: the crude feature orders dive capacity backwards',
    f(p.axes.within_diver_ordering.spearman_rho < 0 && p.axes.within_diver_ordering.verdict === 'inverted',
      !(p.axes.within_diver_ordering.spearman_rho < 0 && p.axes.within_diver_ordering.verdict === 'inverted')),
    `rho ${p.axes.within_diver_ordering.spearman_rho?.toFixed(3)}, verdict ${p.axes.within_diver_ordering.verdict}`);
  check('that inversion is the second falsifier in WHAT_WOULD_FALSIFY, which was written before the probe ran',
    f(/no better than chance/.test(M.WHAT_WOULD_FALSIFY.falsifiers[1]), !/no better than chance/.test(M.WHAT_WOULD_FALSIFY.falsifiers[1])));
  check('both sirenians sit with the terrestrial anchors on the crude feature, and the probe says so',
    f(p.axes.sirenian_placement.verdict === 'with-terrestrial-anchors' && p.axes.sirenian_placement.values.length === 2,
      !(p.axes.sirenian_placement.verdict === 'with-terrestrial-anchors' && p.axes.sirenian_placement.values.length === 2)),
    p.axes.sirenian_placement.values.map((v) => `${v.latin}:${v.value}`).join(', '));
  check('the sirenian axis admits the file cannot tell whether that is the feature failing or the biology, because those durations are null',
    f(/cannot say whether/.test(p.axes.sirenian_placement.means) && M.ROWS.filter((r) => r.clade === 'sirenian').every((r) => r.max_dive_duration.value === null),
      !(/cannot say whether/.test(p.axes.sirenian_placement.means) && M.ROWS.filter((r) => r.clade === 'sirenian').every((r) => r.max_dive_duration.value === null))));
  // regressionSet() must exclude the lower-bound rows BY THEIR KIND, not by hand.
  const excluded = M.withDuration().filter((r) => !M.regressionSet().includes(r));
  check('regressionSet() excludes exactly the rows whose DURATION_KIND says not to use them',
    f(excluded.length > 0 && excluded.every((r) => M.DURATION_KINDS[r.max_dive_duration.kind].use_for_regression === false),
      !(excluded.length > 0 && excluded.every((r) => M.DURATION_KINDS[r.max_dive_duration.kind].use_for_regression === false))),
    excluded.map((r) => `${r.latin}:${r.max_dive_duration.kind}`).join(' | '));
  check('the excluded rows are the one-study observed maxima, i.e. the lower bounds',
    f(excluded.every((r) => r.max_dive_duration.kind === 'observed-maximum-in-one-study'), !excluded.every((r) => r.max_dive_duration.kind === 'observed-maximum-in-one-study')));
  check('every DURATION_KIND declares whether it may be regressed, and at least one says no',
    f(M.DURATION_KIND_IDS.every((k) => typeof M.DURATION_KINDS[k].use_for_regression === 'boolean') && M.DURATION_KIND_IDS.some((k) => M.DURATION_KINDS[k].use_for_regression === false),
      !(M.DURATION_KIND_IDS.every((k) => typeof M.DURATION_KINDS[k].use_for_regression === 'boolean') && M.DURATION_KIND_IDS.some((k) => M.DURATION_KINDS[k].use_for_regression === false))));
}

// ====================================================================================================
// 11. FROZEN, AND HONEST ABOUT ITS GAPS
// ====================================================================================================
{
  for (const [name, obj] of [['ROWS', M.ROWS], ['SOURCES', M.SOURCES], ['MIRCETA_2013', M.MIRCETA_2013],
    ['EXPECTED_DIRECTION', M.EXPECTED_DIRECTION], ['PROVENANCE', M.PROVENANCE], ['DURATION_KINDS', M.DURATION_KINDS],
    ['ROWS_DROPPED', M.ROWS_DROPPED], ['NOT_ZMB', M.NOT_ZMB], ['WHAT_WOULD_FALSIFY', M.WHAT_WOULD_FALSIFY], ['UNCERTAINTIES', M.UNCERTAINTIES]]) {
    check(`${name} is frozen`, f(Object.isFrozen(obj) === true, Object.isFrozen(obj) !== true));
  }
  check('the freeze is DEEP: a row’s nested duration object cannot be edited either',
    f(M.ROWS.every((r) => Object.isFrozen(r.max_dive_duration) && Object.isFrozen(r.uniprot)),
      !M.ROWS.every((r) => Object.isFrozen(r.max_dive_duration) && Object.isFrozen(r.uniprot))));
  check('UNCERTAINTIES is a real list, not a gesture',
    f(M.UNCERTAINTIES.length >= 6, !(M.UNCERTAINTIES.length >= 6)), `${M.UNCERTAINTIES.length}`);
  check('UNCERTAINTIES states the null count, and it matches the file',
    f(M.UNCERTAINTIES.some((u) => u.includes(`${M.withDuration().length} of ${M.ROWS.length} rows have a duration`)
      || u.includes(`${M.withDuration().length} of ${M.ROWS.length}`) || u.includes(`${M.nullDuration().length} are null`)),
      !M.UNCERTAINTIES.some((u) => u.includes(`${M.withDuration().length} of ${M.ROWS.length}`) || u.includes(`${M.nullDuration().length} are null`))),
    `${M.withDuration().length} with, ${M.nullDuration().length} null`);
  check('UNCERTAINTIES names body mass as a correlate the file does not carry',
    f(M.UNCERTAINTIES.some((u) => /body mass, which this file does not carry/i.test(u)),
      !M.UNCERTAINTIES.some((u) => /body mass, which this file does not carry/i.test(u))));
  check('UNCERTAINTIES names the extreme-value-with-effort problem for a maximum',
    f(M.UNCERTAINTIES.some((u) => /grows with tagging effort/i.test(u)), !M.UNCERTAINTIES.some((u) => /grows with tagging effort/i.test(u))));
  check('WHAT_WOULD_FALSIFY lists several falsifiers, including the sea otter check',
    f(M.WHAT_WOULD_FALSIFY.falsifiers.length >= 4 && M.WHAT_WOULD_FALSIFY.falsifiers.some((s) => /sea otter/i.test(s)),
      !(M.WHAT_WOULD_FALSIFY.falsifiers.length >= 4 && M.WHAT_WOULD_FALSIFY.falsifiers.some((s) => /sea otter/i.test(s)))));
  check('WHAT_WOULD_FALSIFY also states what this file CANNOT falsify, which is the paper itself',
    f(/Mirceta/.test(M.WHAT_WOULD_FALSIFY.what_this_file_cannot_falsify) && /negative result about OUR feature/.test(M.WHAT_WOULD_FALSIFY.what_this_file_cannot_falsify),
      !(/Mirceta/.test(M.WHAT_WOULD_FALSIFY.what_this_file_cannot_falsify) && /negative result about OUR feature/.test(M.WHAT_WOULD_FALSIFY.what_this_file_cannot_falsify))));
  check('summary() counts agree with the rows: with-duration plus null equals the row count',
    f(M.summary().n_with_duration + M.summary().n_null_duration === M.ROWS.length,
      M.summary().n_with_duration + M.summary().n_null_duration !== M.ROWS.length),
    `${M.summary().n_with_duration} + ${M.summary().n_null_duration} vs ${M.ROWS.length}`);
  check('the sea otter row is present and flags that a fully aquatic mammal has a very short maximum',
    f(M.byLatin('Enhydra lutris kenyoni')?.max_dive_duration.value < 10 && /aquatic means long/.test(M.byLatin('Enhydra lutris kenyoni').max_dive_duration.caveat),
      !(M.byLatin('Enhydra lutris kenyoni')?.max_dive_duration.value < 10 && /aquatic means long/.test(M.byLatin('Enhydra lutris kenyoni').max_dive_duration.caveat))),
    `${M.byLatin('Enhydra lutris kenyoni')?.max_dive_duration.value} min`);
  const subspecies = M.ROWS.filter((r) => r.latin.split(' ').length === 3);
  check('every subspecies-level row carries a taxon_note about the mismatch rather than passing as a species',
    f(subspecies.length >= 1 && subspecies.every((r) => typeof r.taxon_note === 'string' && r.taxon_note.length > 40),
      !(subspecies.length >= 1 && subspecies.every((r) => typeof r.taxon_note === 'string' && r.taxon_note.length > 40))),
    subspecies.map((r) => r.latin).join(', '));
}

// ====================================================================================================
// 12. OPTIONAL: RE-FETCH EVERY ACCESSION AND CHECK THE FILE AGAINST THE RESOURCE
// ====================================================================================================
// Not counted above, because the suite must run offline. With --live it is the real check: the stored
// organism, length and sequence are compared against UniProt as it is right now.
if (LIVE) {
  console.log('\n  --live: re-fetching every accession from UniProt\n');
  for (const r of M.ROWS) {
    let d;
    try { d = await (await fetch(r.uniprot.endpoint)).json(); }
    catch (e) { check(`LIVE ${r.uniprot.accession} fetched`, f(false, true), String(e)); continue; }
    check(`LIVE ${r.uniprot.accession} still resolves to ${r.latin} with the stored sequence`,
      f(d.organism?.scientificName === r.uniprot.organism_read_back && d.sequence?.value === r.sequence,
        !(d.organism?.scientificName === r.uniprot.organism_read_back && d.sequence?.value === r.sequence)),
      `${d.organism?.scientificName}, len ${d.sequence?.length}`);
  }
}

// ====================================================================================================
console.log(`\n${pass} pass, ${fail} fail`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had its predicate inverted or its value replaced. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
