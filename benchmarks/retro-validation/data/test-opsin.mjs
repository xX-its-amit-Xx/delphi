#!/usr/bin/env node
// Tests for benchmarks/retro-validation/data/opsin.mjs - the rod opsin lambda-max retro-validation set.
//
//   node benchmarks/retro-validation/data/test-opsin.mjs [--fail-once] [--offline]
//
// Five things are checked harder than the rest, because they are the five ways this file could do damage:
//
//   1. A FABRICATED NUMBER. The whole file is numbers attributed to papers. One invented nm value and the
//      benchmark is worse than no benchmark, because it would be scored and believed. So: every nm value
//      must carry units and a source id that resolves in CITATIONS; every source must carry a
//      verified_how; and every value we could NOT retrieve must be null with a stated reason rather than
//      a plausible round number. E122Q is the specific trap - it is the most quoted single-site shift in
//      this literature and we could not retrieve an isolated value for it, so it must be null.
//   2. AN ACCESSION THAT DOES NOT RESOLVE, OR RESOLVES TO SOMETHING ELSE. Every accession is checked
//      LIVE against rest.uniprot.org and the organism, entry name, length AND full sequence must read
//      back identical to what is embedded. An embedded sequence that has drifted from its accession is a
//      silent wrong answer for every prediction built on it.
//   3. THE NUMBERING BEING WRONG. Every site label is a bovine coordinate and no sequence in the table is
//      bovine. The check that catches a numbering error is independent of the alignment: the residue the
//      aligner finds at bovine site N must equal the FIRST LETTER OF THE CANONICAL SUBSTITUTION NAME for
//      that site (D83N -> bovine 83 is D, E122Q -> E, M207L -> M, F261Y -> F, A292S -> A). Five
//      independent chances for the numbering to be caught.
//   4. A POINT PREDICTION ESCAPING. naiveAdditivePrediction must expose no scalar lambda-max. If one
//      appears it will be read downstream as a prediction with no error bar, and the error bar is this
//      module's entire finding.
//   5. THE BENCHMARK NOT BITING. A validation set on which the model never fails is not a validation set.
//      retroValidate() must report real misses on real rows, and the worst must be large.
//
// --fail-once injects one fault into every assertion, by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own fault asserts nothing.
//
// Network: the accession checks hit rest.uniprot.org. Pass --offline to skip ONLY those, and the run
// reports how many were skipped so a green offline run cannot be mistaken for a verified one.
import * as O from './opsin.mjs';

const FAULT = process.argv.includes('--fail-once');
const OFFLINE = process.argv.includes('--offline');
let pass = 0, fail = 0, skipped = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const skip = (name, why) => { skipped++; console.log(`  skip ${name} - ${why}`); };
const f = (real, broken) => (FAULT ? broken : real);

const flat = (x) => JSON.stringify(x);
const allNmValues = () => [
  ...O.SITE_SHIFTS.map((s) => ({ where: `SITE_SHIFTS ${s.substitution}`, holder: s.shift, source: s.source, verified_how: s.verified_how })),
  ...O.MEASURED.map((r) => ({ where: `MEASURED ${r.id}`, holder: r.lambda_max, source: r.source, verified_how: r.verified_how })),
  ...O.CROSS_STUDY_PAIRINGS.map((r) => ({ where: `CROSS_STUDY ${r.organism}`, holder: r.lambda_max, source: r.lambda_max_source, verified_how: r.verified_how })),
];

console.log(`\nopsin: lambda-max from five sites, and the measurements that break it${FAULT ? '   [--fail-once: one fault per assertion]' : ''}${OFFLINE ? '   [--offline: live accession checks skipped]' : ''}\n`);

// ====================================================================================================
// 1. NO NUMBER WITHOUT UNITS, A SOURCE, AND A STATEMENT OF HOW IT WAS VERIFIED
// ====================================================================================================
{
  const vals = allNmValues();
  const noUnits = vals.filter((v) => v.holder.units !== 'nm');
  check('EVERY nm-bearing field in the file declares units: nm',
    f(noUnits.length === 0, noUnits.length !== 0), noUnits.map((v) => v.where).join(', '));

  const badSource = vals.filter((v) => !O.CITATION_IDS.includes(v.source));
  check('every nm value names a source id that resolves in CITATIONS',
    f(badSource.length === 0, badSource.length !== 0), badSource.map((v) => `${v.where}:${v.source}`).join(', '));

  const thinVerified = vals.filter((v) => typeof v.verified_how !== 'string' || v.verified_how.length < 60);
  check('every nm value carries a verified_how with substance in it, not a word',
    f(thinVerified.length === 0, thinVerified.length !== 0), thinVerified.map((v) => v.where).join(', '));

  const noDoi = O.CITATION_IDS.filter((k) => !O.CITATIONS[k].doi && !O.CITATIONS[k].retrieved);
  check('every citation carries a DOI, or a retrieval date if it is a live database',
    f(noDoi.length === 0, noDoi.length !== 0), noDoi.join(', '));

  const noHow = O.CITATION_IDS.filter((k) => typeof O.CITATIONS[k].verified_how !== 'string' || O.CITATIONS[k].verified_how.length < 80);
  check('every citation says, at length, exactly what was checked about it',
    f(noHow.length === 0, noHow.length !== 0), noHow.join(', '));

  // The two DOIs the whole RH1 half of the file rests on, as retrieved from PubMed.
  check('the Yokoyama 2008 DOI is the one PubMed returned for PMID 18768804',
    f(O.CITATIONS.yokoyama_2008_pnas.doi === '10.1073/pnas.0802426105', O.CITATIONS.yokoyama_2008_pnas.doi === '10.1073/pnas.0802426106'),
    O.CITATIONS.yokoyama_2008_pnas.doi);
  check('the Sugawara 2005 DOI is the one PubMed returned for PMID 15809435',
    f(O.CITATIONS.sugawara_2005_pnas.doi === '10.1073/pnas.0405302102', O.CITATIONS.sugawara_2005_pnas.doi === '10.1073/pnas.0405302103'),
    O.CITATIONS.sugawara_2005_pnas.doi);
  check('every citation that has a PMID has one that is all digits, so it is a real identifier shape',
    f(O.CITATION_IDS.filter((k) => O.CITATIONS[k].pmid).every((k) => /^[0-9]+$/.test(O.CITATIONS[k].pmid)),
      !O.CITATION_IDS.filter((k) => O.CITATIONS[k].pmid).every((k) => /^[0-9]+$/.test(O.CITATIONS[k].pmid))));

  check('the nm values and the citation table are deep-frozen, so nothing can be edited in by a caller',
    f(Object.isFrozen(O.CITATIONS) && Object.isFrozen(O.SITE_SHIFTS) && Object.isFrozen(O.SITE_SHIFTS[0].shift) && Object.isFrozen(O.MEASURED[0].lambda_max),
      !(Object.isFrozen(O.CITATIONS) && Object.isFrozen(O.SITE_SHIFTS) && Object.isFrozen(O.SITE_SHIFTS[0].shift) && Object.isFrozen(O.MEASURED[0].lambda_max))));
  check('MEASURED, DROPPED_ROWS, CROSS_STUDY_PAIRINGS, SEQUENCES and THE_HARD_PART are all frozen too',
    f([O.MEASURED, O.DROPPED_ROWS, O.CROSS_STUDY_PAIRINGS, O.SEQUENCES, O.THE_HARD_PART].every(Object.isFrozen),
      ![O.MEASURED, O.DROPPED_ROWS, O.CROSS_STUDY_PAIRINGS, O.SEQUENCES, O.THE_HARD_PART].every(Object.isFrozen)));
}

// ====================================================================================================
// 2. THE REFUSALS. A VALUE WE COULD NOT RETRIEVE IS null, WITH A REASON AND A WAY OUT.
// ====================================================================================================
{
  const nulls = O.SITE_SHIFTS.filter((s) => s.shift.value === null);
  check('the file contains refusals at all: some shifts are null rather than guessed',
    f(nulls.length >= 3, !(nulls.length >= 3)), `${nulls.length} of ${O.SITE_SHIFTS.length}`);
  const badNulls = nulls.filter((s) => !s.shift.null_reason || !s.shift.what_would_have_to_be_measured);
  check('EVERY null shift states both why it is null and what would have to be measured',
    f(badNulls.length === 0, badNulls.length !== 0), badNulls.map((s) => s.substitution).join(', '));

  const e122 = O.SITE_SHIFTS.filter((s) => s.substitution === 'E122Q');
  check('E122Q - the most quoted single-site shift in this literature - is refused, not guessed',
    f(e122.length === 1 && e122[0].shift.value === null, !(e122.length === 1 && e122[0].shift.value === null)),
    flat(e122.map((s) => s.shift.value)));
  check('and the refusal says in words that splitting the published 14-20 nm range would be invented arithmetic',
    f(/14-20 nm/.test(e122[0].shift.null_reason) && /invented|we invented/i.test(e122[0].shift.null_reason),
      !(/14-20 nm/.test(e122[0].shift.null_reason) && /invented|we invented/i.test(e122[0].shift.null_reason))));
  check('shiftBand propagates the refusal: E122Q is not quantified and carries the reason forward',
    f(O.shiftBand('E122Q').quantified === false && typeof O.shiftBand('E122Q').null_reason === 'string',
      !(O.shiftBand('E122Q').quantified === false && typeof O.shiftBand('E122Q').null_reason === 'string')));
  check('shiftBand returns lo and hi as null for a refused substitution, not as 0',
    f(O.shiftBand('E122Q').lo === null && O.shiftBand('E122Q').hi === null,
      !(O.shiftBand('E122Q').lo === null && O.shiftBand('E122Q').hi === null)), flat([O.shiftBand('E122Q').lo, O.shiftBand('E122Q').hi]));
  check('a substitution no source mentions at all reports n_sources 0 rather than inventing a band',
    f(O.shiftBand('A292I').n_sources === 0 && O.shiftBand('A292I').quantified === false,
      !(O.shiftBand('A292I').n_sources === 0 && O.shiftBand('A292I').quantified === false)), flat(O.shiftBand('A292I').n_sources));
  check('M207L is refused too: it appears only inside a double, and in RH2 rather than RH1',
    f(O.SITE_SHIFTS.find((s) => s.substitution === 'M207L').shift.value === null,
      O.SITE_SHIFTS.find((s) => s.substitution === 'M207L').shift.value !== null));

  // Direction survives even where magnitude does not.
  const nullWithDirection = nulls.filter((s) => typeof s.shift.sign === 'string');
  check('a refused magnitude still records the DIRECTION the source reported',
    f(nullWithDirection.length === nulls.length, nullWithDirection.length !== nulls.length),
    `${nullWithDirection.length} of ${nulls.length}`);

  // Dropped rows.
  check('rows that could not be admitted are recorded in DROPPED_ROWS, not silently absent',
    f(O.DROPPED_ROWS.length >= 4, !(O.DROPPED_ROWS.length >= 4)), `${O.DROPPED_ROWS.length}`);
  check('every dropped row says why it was dropped',
    f(O.DROPPED_ROWS.every((r) => typeof r.why_dropped === 'string' && r.why_dropped.length > 60),
      !O.DROPPED_ROWS.every((r) => typeof r.why_dropped === 'string' && r.why_dropped.length > 60)),
    O.DROPPED_ROWS.filter((r) => !(typeof r.why_dropped === 'string' && r.why_dropped.length > 60)).map((r) => r.organism).join(', '));
  const coel = O.DROPPED_ROWS.find((r) => /Latimeria/.test(r.organism));
  check('the coelacanth RH1 - the single most-cited blue shift here - is DROPPED, because no accession resolved to it',
    f(coel !== undefined && !O.MEASURED.some((r) => /Latimeria/.test(r.organism)),
      !(coel !== undefined && !O.MEASURED.some((r) => /Latimeria/.test(r.organism)))));
  check('and its dropped record keeps the published value rather than discarding it',
    f(coel.lambda_max_reported.value === 478 && coel.lambda_max_reported.units === 'nm',
      !(coel.lambda_max_reported.value === 478 && coel.lambda_max_reported.units === 'nm')), flat(coel.lambda_max_reported));
  const conger = O.DROPPED_ROWS.find((r) => /Conger/.test(r.organism));
  check('the conger row is dropped because ONE accession cannot be assigned between TWO measured pigments',
    f(conger.lambda_max_reported.value === null && conger.lambda_max_reported.candidates.length === 2,
      !(conger.lambda_max_reported.value === null && conger.lambda_max_reported.candidates.length === 2)), flat(conger.lambda_max_reported));
  check('and it names the reason a 1 nm guess would be WORSE than an obvious one: it would be invisible',
    f(/invisible/i.test(conger.why_dropped), !/invisible/i.test(conger.why_dropped)));
}

// ====================================================================================================
// 3. CROSS-STUDY PAIRINGS ARE QUARANTINED AND NOTHING SCORES THEM
// ====================================================================================================
{
  check('the cross-study pairings exist and are each flagged as NOT the same material',
    f(O.CROSS_STUDY_PAIRINGS.length >= 3 && O.CROSS_STUDY_PAIRINGS.every((r) => r.is_same_material === false),
      !(O.CROSS_STUDY_PAIRINGS.length >= 3 && O.CROSS_STUDY_PAIRINGS.every((r) => r.is_same_material === false))),
    `${O.CROSS_STUDY_PAIRINGS.length}`);
  check('each names the paper the SEQUENCE came from and the different paper the MEASUREMENT came from',
    f(O.CROSS_STUDY_PAIRINGS.every((r) => r.sequence_source !== r.lambda_max_source && O.CITATION_IDS.includes(r.sequence_source) && O.CITATION_IDS.includes(r.lambda_max_source)),
      !O.CROSS_STUDY_PAIRINGS.every((r) => r.sequence_source !== r.lambda_max_source && O.CITATION_IDS.includes(r.sequence_source) && O.CITATION_IDS.includes(r.lambda_max_source))));
  const quarantinedAccs = new Set(O.CROSS_STUDY_PAIRINGS.map((r) => r.uniprot));
  check('NO quarantined accession appears in MEASURED',
    f(!O.MEASURED.some((r) => quarantinedAccs.has(r.uniprot)), O.MEASURED.some((r) => quarantinedAccs.has(r.uniprot))));
  check('and retroValidate() scores none of them',
    f(!O.retroValidate().rows.some((r) => quarantinedAccs.has(r.accession)), O.retroValidate().rows.some((r) => quarantinedAccs.has(r.accession))));
  const bluest = O.CROSS_STUDY_PAIRINGS.find((r) => r.lambda_max.value === 468);
  check('the bluest pigment in the file (468 nm) is in quarantine, so the quarantine costs the benchmark its best lever',
    f(bluest !== undefined && Math.min(...O.MEASURED.map((r) => r.lambda_max.value)) > 468,
      !(bluest !== undefined && Math.min(...O.MEASURED.map((r) => r.lambda_max.value)) > 468)),
    `bluest scored row ${Math.min(...O.MEASURED.map((r) => r.lambda_max.value))} nm`);
  check('the quarantine record says so plainly rather than presenting the exclusion as costless',
    f(/costs the benchmark/i.test(bluest.why_quarantined), !/costs the benchmark/i.test(bluest.why_quarantined)));
}

// ====================================================================================================
// 4. THE SCOPE NOTE, AND THE TABLE STAYING INSIDE IT
// ====================================================================================================
{
  check('TAXONOMIC_SCOPE states the subset in those words',
    f(/mammals and fishes only/.test(O.TAXONOMIC_SCOPE.scope), !/mammals and fishes only/.test(O.TAXONOMIC_SCOPE.scope)), O.TAXONOMIC_SCOPE.scope);
  const allowed = new Set(['bony fish', 'mammal']);
  const outside = [...O.MEASURED, ...O.CROSS_STUDY_PAIRINGS].filter((r) => !allowed.has(r.group));
  check('every row in the file declares a group inside that scope',
    f(outside.length === 0, outside.length !== 0), outside.map((r) => `${r.organism}:${r.group}`).join(', '));
  check('the scope note states what the subsetting COSTS the benchmark, not just that it happened',
    f(/weaker evidence than it looks/.test(O.TAXONOMIC_SCOPE.what_this_costs_the_benchmark),
      !/weaker evidence than it looks/.test(O.TAXONOMIC_SCOPE.what_this_costs_the_benchmark)));
  check('the table has the terrestrial mammal anchor it needs for the numbering reference',
    f(O.MEASURED.some((r) => r.group === 'mammal' && r.uniprot === 'P02699'), !O.MEASURED.some((r) => r.group === 'mammal' && r.uniprot === 'P02699')));
  check('the informative blue-shifted end is actually populated, not a single row',
    f(O.MEASURED.filter((r) => r.informative_end === 'blue-shifted').length >= 5,
      !(O.MEASURED.filter((r) => r.informative_end === 'blue-shifted').length >= 5)),
    `${O.MEASURED.filter((r) => r.informative_end === 'blue-shifted').length}`);
  check('the table reaches the 8-row target asked of it',
    f(O.MEASURED.length >= 8, !(O.MEASURED.length >= 8)), `${O.MEASURED.length} rows`);
  check('every MEASURED row has a distinct id and a distinct accession, so nothing is double-counted',
    f(new Set(O.MEASURED.map((r) => r.id)).size === O.MEASURED.length && new Set(O.MEASURED.map((r) => r.uniprot)).size === O.MEASURED.length,
      !(new Set(O.MEASURED.map((r) => r.id)).size === O.MEASURED.length && new Set(O.MEASURED.map((r) => r.uniprot)).size === O.MEASURED.length)));
  check('every MEASURED row states the assay it was measured by',
    f(O.MEASURED.every((r) => typeof r.method === 'string' && r.method.length > 20), !O.MEASURED.every((r) => typeof r.method === 'string' && r.method.length > 20)));
  check('rows measured by a difference spectrum with no dark spectrum are flagged as such',
    f(O.MEASURED.filter((r) => r.dark_spectrum_obtained === false).length === 2,
      O.MEASURED.filter((r) => r.dark_spectrum_obtained === false).length !== 2),
    flat(O.MEASURED.filter((r) => r.dark_spectrum_obtained === false).map((r) => r.id)));
  check('the one row quoted at second hand is flagged secondary_quotation, and it is the only one',
    f(O.MEASURED.filter((r) => r.secondary_quotation === true).length === 1,
      O.MEASURED.filter((r) => r.secondary_quotation === true).length !== 1),
    flat(O.MEASURED.filter((r) => r.secondary_quotation === true).map((r) => r.id)));
  check('and its verified_how admits the link in the chain that was not walked',
    f(/DID NOT RETRIEVE/.test(O.MEASURED.find((r) => r.secondary_quotation).verified_how),
      !/DID NOT RETRIEVE/.test(O.MEASURED.find((r) => r.secondary_quotation).verified_how)));
  check('partial sequences are flagged, because a partial entry can fail to cover a rule site',
    f(O.MEASURED.filter((r) => r.is_partial_sequence === true).length === 3,
      O.MEASURED.filter((r) => r.is_partial_sequence === true).length !== 3),
    `${O.MEASURED.filter((r) => r.is_partial_sequence === true).length}`);
  const lenMismatch = [...O.MEASURED, ...O.CROSS_STUDY_PAIRINGS].filter((r) => O.SEQUENCES[r.uniprot]?.length !== r.length);
  check('every row\'s declared length equals the length of its embedded sequence',
    f(lenMismatch.length === 0, lenMismatch.length !== 0), lenMismatch.map((r) => `${r.uniprot}:${r.length}vs${O.SEQUENCES[r.uniprot]?.length}`).join(', '));
  const badResidues = Object.entries(O.SEQUENCES).filter(([, s]) => !/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(s));
  check('every embedded sequence is pure one-letter amino acid code, with no stray characters from the copy',
    f(badResidues.length === 0, badResidues.length !== 0), badResidues.map(([a]) => a).join(', '));
}

// ====================================================================================================
// 5. SITE NUMBERING. THE CHECK IS INDEPENDENT OF THE ALIGNER.
// ====================================================================================================
// Each canonical substitution name encodes the bovine residue in its first letter. If bovine position 83
// is not D, every 83 in this file is pointing at the wrong residue and so is every prediction.
{
  const canonical = [['D83N', 83, 'D'], ['E122Q', 122, 'E'], ['M207L', 207, 'M'], ['F261Y', 261, 'F'], ['A292S', 292, 'A']];
  for (const [name, site, aa] of canonical) {
    check(`bovine position ${site} is ${aa}, as the name ${name} asserts`,
      f(O.BOVINE_RH1_REFERENCE.sequence[site - 1] === aa, O.BOVINE_RH1_REFERENCE.sequence[site - 1] !== aa),
      `found ${O.BOVINE_RH1_REFERENCE.sequence[site - 1]}`);
  }
  check('RULE_SITES is exactly the five sites this benchmark predicts from',
    f(flat([...O.RULE_SITES]) === flat([83, 122, 207, 261, 292]), flat([...O.RULE_SITES]) === flat([83, 122, 207, 261, 293])), flat([...O.RULE_SITES]));
  check('the extended site list from the sources is more than twice as long as RULE_SITES, which is itself the finding',
    f(new Set([...O.EXTENDED_SITES.from_hunt_2001, ...O.EXTENDED_SITES.from_yokoyama_2008_named_in_text]).size > 2 * O.RULE_SITES.length,
      !(new Set([...O.EXTENDED_SITES.from_hunt_2001, ...O.EXTENDED_SITES.from_yokoyama_2008_named_in_text]).size > 2 * O.RULE_SITES.length)),
    `${new Set([...O.EXTENDED_SITES.from_hunt_2001, ...O.EXTENDED_SITES.from_yokoyama_2008_named_in_text]).size} sites`);

  check('bovineSiteResidue refuses a site outside the bovine sequence instead of returning undefined',
    f((() => { try { O.bovineSiteResidue('Q9PUA1', 999); return false; } catch { return true; } })(),
      (() => { try { O.bovineSiteResidue('Q9PUA1', 999); return true; } catch { return false; } })()));
  check('it reports the BOVINE residue alongside the mapped one, so a caller can see the substitution',
    f(O.bovineSiteResidue('Q9PUA1', 83).bovine_residue === 'D', O.bovineSiteResidue('Q9PUA1', 83).bovine_residue !== 'D'));

  // The deep-sea eel paralogue is the row the literature says carries D83N and A292S.
  const dso = O.siteProfile('Q9PUA1');
  check('the deep-sea eel paralogue carries D83N and A292S at the rule sites, as its blue shift requires',
    f(dso.substitutions_vs_bovine.includes('D83N') && dso.substitutions_vs_bovine.includes('A292S'),
      !(dso.substitutions_vs_bovine.includes('D83N') && dso.substitutions_vs_bovine.includes('A292S'))),
    flat([...dso.substitutions_vs_bovine]));
  const fwo = O.siteProfile('Q9PUA2');
  check('its fresh-water sister carries NO substitution at any rule site, so the pair isolates the sites',
    f(fwo.substitutions_vs_bovine.length === 0, fwo.substitutions_vs_bovine.length !== 0), flat([...fwo.substitutions_vs_bovine]));
  check('a truncated entry reports uncovered sites with a reason rather than a residue',
    f(O.bovineSiteResidue('G9HXK4', 1).covered === false && typeof O.bovineSiteResidue('G9HXK4', 1).not_covered_reason === 'string',
      !(O.bovineSiteResidue('G9HXK4', 1).covered === false && typeof O.bovineSiteResidue('G9HXK4', 1).not_covered_reason === 'string')));
  const lowId = Object.keys(O.SEQUENCES).filter((a) => O.alignmentQuality(a).identity_to_bovine < 0.6);
  check('every embedded sequence aligns to bovine at better than 60% identity, so none is a mis-pasted protein',
    f(lowId.length === 0, lowId.length !== 0), lowId.map((a) => `${a}:${O.alignmentQuality(a).identity_to_bovine}`).join(', '));
  check('the aligner is symmetric enough to be trusted: bovine against itself is 100% identity over its full length',
    f(O.align(O.BOVINE_RH1_REFERENCE.sequence, O.BOVINE_RH1_REFERENCE.sequence).identity === 1 &&
      O.align(O.BOVINE_RH1_REFERENCE.sequence, O.BOVINE_RH1_REFERENCE.sequence).aligned === 348,
      !(O.align(O.BOVINE_RH1_REFERENCE.sequence, O.BOVINE_RH1_REFERENCE.sequence).identity === 1 &&
        O.align(O.BOVINE_RH1_REFERENCE.sequence, O.BOVINE_RH1_REFERENCE.sequence).aligned === 348)));
  check('alignmentQuality says in its own field that identity is about homology and not about function',
    f(O.alignmentQuality('Q9PUA1').is_a_point_estimate_of_homology_not_of_function === true,
      O.alignmentQuality('Q9PUA1').is_a_point_estimate_of_homology_not_of_function !== true));
}

// ====================================================================================================
// 6. NO POINT PREDICTION ESCAPES
// ====================================================================================================
{
  const p = O.naiveAdditivePrediction('Q9PUA1');
  check('the prediction exposes no scalar lambda-max: point, score and lambda_max_nm are all null',
    f(p.point === null && p.score === null && p.lambda_max_nm === null, !(p.point === null && p.score === null && p.lambda_max_nm === null)),
    flat([p.point, p.score, p.lambda_max_nm]));
  check('all three are PRESENT as keys, so the absence is on the record rather than merely missing',
    f('point' in p && 'score' in p && 'lambda_max_nm' in p, !('point' in p && 'score' in p && 'lambda_max_nm' in p)));
  check('what it returns instead is a band with hi >= lo and units',
    f(p.band.hi >= p.band.lo && p.band.units === 'nm', !(p.band.hi >= p.band.lo && p.band.units === 'nm')), flat(p.band));
  check('the band is reported for EVERY row, and hi >= lo on all of them',
    f(O.MEASURED.every((r) => { const q = O.naiveAdditivePrediction(r.uniprot); return q.band.hi >= q.band.lo; }),
      !O.MEASURED.every((r) => { const q = O.naiveAdditivePrediction(r.uniprot); return q.band.hi >= q.band.lo; })));
  check('the baseline is an INTERVAL, because the two anchor measurements disagree by 2 nm',
    f(O.BASELINE.lo === 498 && O.BASELINE.hi === 500, !(O.BASELINE.lo === 498 && O.BASELINE.hi === 500)), flat([O.BASELINE.lo, O.BASELINE.hi]));
  check('and it says why rather than quietly averaging them',
    f(/import a 2 nm bias/.test(O.BASELINE.why_an_interval), !/import a 2 nm bias/.test(O.BASELINE.why_an_interval)));
  check('the prediction states that the additive model is known to be wrong, and names the evidence',
    f(/S180A\/H197Y/.test(p.the_model_is_known_to_be_wrong_because) && /Nathans 1990/.test(p.the_model_is_known_to_be_wrong_because),
      !(/S180A\/H197Y/.test(p.the_model_is_known_to_be_wrong_because) && /Nathans 1990/.test(p.the_model_is_known_to_be_wrong_because))));
  check('it says why there is no point estimate, in terms of the choice becoming invisible downstream',
    f(/invisible one function/.test(p.why_no_point_estimate), !/invisible one function/.test(p.why_no_point_estimate)));
  check('the prediction object is deep-frozen, so a caller cannot staple a scalar onto it',
    f(Object.isFrozen(p) && Object.isFrozen(p.band), !(Object.isFrozen(p) && Object.isFrozen(p.band))));

  // The loosejaw carries A292I, for which no source gives a value. The band must say it is too narrow.
  const loose = O.naiveAdditivePrediction('B4YA19');
  check('a row with an unquantified substitution reports it rather than dropping it from the list',
    f(loose.n_unquantified === 1 && loose.unquantified_substitutions[0].substitution === 'A292I',
      !(loose.n_unquantified === 1 && loose.unquantified_substitutions[0].substitution === 'A292I')), flat(loose.unquantified_substitutions));
  check('and warns that its band is NARROWER than the true uncertainty, which is the dangerous direction',
    f(/NARROWER THAN THE TRUE UNCERTAINTY/.test(loose.unknown_contributions_not_in_the_band ?? ''),
      !/NARROWER THAN THE TRUE UNCERTAINTY/.test(loose.unknown_contributions_not_in_the_band ?? '')));
  check('a row with nothing unquantified sets that warning to null rather than printing a reassurance',
    f(O.naiveAdditivePrediction('Q9PUA2').unknown_contributions_not_in_the_band === null,
      O.naiveAdditivePrediction('Q9PUA2').unknown_contributions_not_in_the_band !== null));

  // Band width must come from disagreement between published values, not from a chosen fudge factor.
  const a292s = O.shiftBand('A292S');
  check('the A292S band spans the two published values (-14 and -10 nm) rather than averaging them',
    f(a292s.lo === -14 && a292s.hi === -10, !(a292s.lo === -14 && a292s.hi === -10)), flat([a292s.lo, a292s.hi]));
  check('and it records that the width is BETWEEN BACKGROUNDS, naming them',
    f(a292s.width_is_between_backgrounds === true && a292s.backgrounds.length === 2,
      !(a292s.width_is_between_backgrounds === true && a292s.backgrounds.length === 2)), flat([...a292s.backgrounds]));
  const d83n = O.shiftBand('D83N');
  check('the D83N band spans the within-one-paper disagreement (-8 nm to -2 nm), a factor of four',
    f(d83n.lo === -8 && d83n.hi === -2, !(d83n.lo === -8 && d83n.hi === -2)), flat([d83n.lo, d83n.hi]));
  check('the D83N rows include one flagged as at or below the measurement noise',
    f(O.SITE_SHIFTS.some((s) => s.substitution === 'D83N' && s.at_or_below_noise === true),
      !O.SITE_SHIFTS.some((s) => s.substitution === 'D83N' && s.at_or_below_noise === true)));
  check('double mutants are excluded from shiftBand, so a pair effect never masquerades as a single-site one',
    f(O.SITE_SHIFTS.some((s) => s.shift.is_a_double_mutant) && O.shiftBand('E122Q/A292S').n_sources === 0,
      !(O.SITE_SHIFTS.some((s) => s.shift.is_a_double_mutant) && O.shiftBand('E122Q/A292S').n_sources === 0)));
}

// ====================================================================================================
// 7. THE BENCHMARK BITES
// ====================================================================================================
{
  const v = O.retroValidate();
  check('retroValidate scores every MEASURED row, and only those',
    f(v.n === O.MEASURED.length && v.rows.length === O.MEASURED.length, !(v.n === O.MEASURED.length && v.rows.length === O.MEASURED.length)), `${v.n}`);
  check('every verdict is drawn from the closed vocabulary',
    f(v.rows.every((r) => O.VERDICTS.includes(r.verdict)), !v.rows.every((r) => O.VERDICTS.includes(r.verdict))),
    flat([...new Set(v.rows.map((r) => r.verdict))]));
  check('the counts sum to the number of rows, so every row got exactly one verdict',
    f(Object.values(v.counts).reduce((a, b) => a + b, 0) === v.n, Object.values(v.counts).reduce((a, b) => a + b, 0) !== v.n), flat(v.counts));
  check('THE MODEL ACTUALLY FAILS on real rows: some land outside the band',
    f(v.counts['outside-band-blue'] + v.counts['outside-band-red'] > 0, !(v.counts['outside-band-blue'] + v.counts['outside-band-red'] > 0)), flat(v.counts));
  check('it fails in BOTH directions, so the failure is not a fixable constant offset',
    f(v.counts['outside-band-blue'] > 0 && v.counts['outside-band-red'] > 0, !(v.counts['outside-band-blue'] > 0 && v.counts['outside-band-red'] > 0)), flat(v.counts));
  check('the worst miss is large: this is not a rounding discrepancy',
    f(v.worst_miss_nm >= 10, !(v.worst_miss_nm >= 10)), `${v.worst_miss_nm} nm`);
  check('fewer than nine of twelve rows land inside the band, so an agreement here is not the default outcome',
    f(v.counts['inside-band'] < 9, !(v.counts['inside-band'] < 9)), `${v.counts['inside-band']} of ${v.n}`);
  check('some rows have NO substitution at any rule site at all - the rule is silent about them',
    f(v.n_rows_with_no_rule_site_substitution > 0, !(v.n_rows_with_no_rule_site_substitution > 0)), `${v.n_rows_with_no_rule_site_substitution}`);
  const silentButShifted = v.rows.filter((r) => r.substitutions_at_rule_sites.length === 0 && Math.abs(r.measured_nm - 499) > 3);
  check('and at least one of those silent rows is measurably shifted anyway, which the five sites cannot explain',
    f(silentButShifted.length > 0, !(silentButShifted.length > 0)), silentButShifted.map((r) => `${r.organism} ${r.measured_nm}nm`).join(', '));
  check('no fused scalar and no accuracy figure comes out of the validation',
    f(v.fused_scalar === null && v.accuracy === null && 'fused_scalar' in v && 'accuracy' in v,
      !(v.fused_scalar === null && v.accuracy === null && 'fused_scalar' in v && 'accuracy' in v)));
  check('the headline is words, with no digits for anyone to quote as a score',
    f(/[0-9]/.test(v.headline) === false, /[0-9]/.test(v.headline) === true), v.headline.slice(0, 70));
  check('it states what a hit does NOT show, and names the overlapping-fit problem as the reason',
    f(/weak evidence/.test(v.what_a_hit_does_not_show) && /overlapping set of species/.test(v.what_a_hit_does_not_show),
      !(/weak evidence/.test(v.what_a_hit_does_not_show) && /overlapping set of species/.test(v.what_a_hit_does_not_show))));
  check('it states how many rows were excluded, so the counts cannot be read as the whole literature',
    f(new RegExp(`${O.DROPPED_ROWS.length} rows`).test(v.what_is_excluded), !new RegExp(`${O.DROPPED_ROWS.length} rows`).test(v.what_is_excluded)), v.what_is_excluded.slice(0, 60));
  check('each scored row carries its assay forward, so a 3 nm miss can be read against its precision',
    f(v.rows.every((r) => typeof r.method === 'string' && typeof r.dark_spectrum_obtained === 'boolean'),
      !v.rows.every((r) => typeof r.method === 'string' && typeof r.dark_spectrum_obtained === 'boolean')));
  check('a row inside the band reports miss 0 rather than a signed distance to a band edge',
    f(v.rows.filter((r) => r.verdict === 'inside-band').every((r) => r.miss_nm === 0),
      !v.rows.filter((r) => r.verdict === 'inside-band').every((r) => r.miss_nm === 0)));
  check('the sign of every miss agrees with its verdict, so the direction is not scrambled',
    f(v.rows.filter((r) => r.verdict === 'outside-band-blue').every((r) => r.miss_nm < 0) &&
      v.rows.filter((r) => r.verdict === 'outside-band-red').every((r) => r.miss_nm > 0),
      !(v.rows.filter((r) => r.verdict === 'outside-band-blue').every((r) => r.miss_nm < 0) &&
        v.rows.filter((r) => r.verdict === 'outside-band-red').every((r) => r.miss_nm > 0))),
    v.rows.filter((r) => r.verdict !== 'inside-band').map((r) => `${r.verdict}:${r.miss_nm}`).join(', '));
}

// ====================================================================================================
// 8. THE HARD PART SAYS THE HARD THING
// ====================================================================================================
{
  const H = O.THE_HARD_PART;
  check('THE_HARD_PART covers all four weaknesses the brief names: epistasis, numbering, method, fitted-on-overlap',
    f([H.epistasis, H.numbering_drift, H.method_differences, H.overlapping_fit].every((a) => Array.isArray(a) && a.length >= 3),
      ![H.epistasis, H.numbering_drift, H.method_differences, H.overlapping_fit].every((a) => Array.isArray(a) && a.length >= 3)));
  check('the headline says the rule looks like physics and acts like a correlation',
    f(/looks like physics and acts like a correlation/.test(H.headline), !/looks like physics and acts like a correlation/.test(H.headline)));
  check('the epistasis case names the measured interaction term that broke additivity in the rule\'s OWN regression',
    f(H.epistasis.some((s) => /-7 and -28/.test(s) && /\+11 nm/.test(s)), !H.epistasis.some((s) => /-7 and -28/.test(s) && /\+11 nm/.test(s))));
  check('it names the within-one-paper factor-of-three disagreement for D83N',
    f(H.epistasis.some((s) => /factor of three/.test(s)), !H.epistasis.some((s) => /factor of three/.test(s))));
  check('it carries the hardest counterexample: two canonical sites measured as INERT in the bovine background',
    f(H.epistasis.some((s) => /Nathans 1990/.test(s) && /inert/.test(s)), !H.epistasis.some((s) => /Nathans 1990/.test(s) && /inert/.test(s))));
  check('and the measured magnitude of opsin epistasis, as a count of blocked mutational paths',
    f(H.epistasis.some((s) => /4,008/.test(s) && /5,040/.test(s)), !H.epistasis.some((s) => /4,008/.test(s) && /5,040/.test(s))));
  check('the numbering section says the module aligns rather than offsets, and why an offset would be wrong',
    f(H.numbering_drift.some((s) => /aligns rather than offsets/.test(s)), !H.numbering_drift.some((s) => /aligns rather than offsets/.test(s))));
  check('it names the 207/208 disagreement between sources instead of silently picking one',
    f(H.numbering_drift.some((s) => /site 208/.test(s) && /names 207/.test(s)), !H.numbering_drift.some((s) => /site 208/.test(s) && /names 207/.test(s))));
  check('the method section says the between-assay disagreement is comparable to the effects being predicted',
    f(H.method_differences.some((s) => /comparable to the whole/.test(s)), !H.method_differences.some((s) => /comparable to the whole/.test(s))));
  check('it names the chromophore (A1/A2) confound that the file does not control',
    f(H.method_differences.some((s) => /A1\/A2|A1:A2/.test(s)), !H.method_differences.some((s) => /A1\/A2|A1:A2/.test(s))));
  check('the overlapping-fit section admits these are IN-SAMPLE residuals for part of the table',
    f(H.overlapping_fit.some((s) => /in-sample|IN-SAMPLE/.test(s)), !H.overlapping_fit.some((s) => /in-sample|IN-SAMPLE/.test(s))));
  check('and admits the leakage runs in the flattering direction',
    f(H.overlapping_fit.some((s) => /flatters the method/.test(s)), !H.overlapping_fit.some((s) => /flatters the method/.test(s))));
  check('it credits the source authors with having said the sites do not combine the same way twice',
    f(/does not involve a common subset/.test(H.and_the_rule_was_never_claimed_to_do_this) && /the over-claim would be ours/.test(H.and_the_rule_was_never_claimed_to_do_this),
      !(/does not involve a common subset/.test(H.and_the_rule_was_never_claimed_to_do_this) && /the over-claim would be ours/.test(H.and_the_rule_was_never_claimed_to_do_this))));
  check('it names what would make this a real benchmark, including the two conspicuous nulls',
    f(H.what_would_make_this_a_real_benchmark.some((s) => /E122Q/.test(s) && /M207L/.test(s)),
      !H.what_would_make_this_a_real_benchmark.some((s) => /E122Q/.test(s) && /M207L/.test(s))));
  check('WHAT_THIS_IS says the module exists to be scored against INCLUDING WHEN IT FAILS',
    f(/including when it fails/.test(O.WHAT_THIS_IS), !/including when it fails/.test(O.WHAT_THIS_IS)));
}

// ====================================================================================================
// 9. THE ACCESSIONS RESOLVE, LIVE, TO WHAT THIS FILE SAYS THEY ARE
// ====================================================================================================
// An embedded sequence that has drifted from its accession is a wrong answer for every prediction built
// on it, and nothing else in this test suite can see it.
{
  const rows = [
    { uniprot: O.BOVINE_RH1_REFERENCE.accession, organism: O.BOVINE_RH1_REFERENCE.organism, uniprot_entry: O.BOVINE_RH1_REFERENCE.uniprot_entry, length: O.BOVINE_RH1_REFERENCE.length, id: 'BOVINE_RH1_REFERENCE' },
    ...O.MEASURED.filter((r) => r.uniprot !== 'P02699'),
    ...O.CROSS_STUDY_PAIRINGS,
  ];
  if (OFFLINE) {
    skip(`all ${rows.length} live accession checks`, '--offline was passed; a green run here is NOT a verified run');
  } else {
    const results = await Promise.all(rows.map(async (r) => {
      try {
        const res = await fetch(`https://rest.uniprot.org/uniprotkb/${r.uniprot}.json?fields=accession,id,organism_name,sequence,length`, { headers: { accept: 'application/json' } });
        if (!res.ok) return { r, error: `HTTP ${res.status}` };
        const j = await res.json();
        return { r, j };
      } catch (e) { return { r, error: String(e.message ?? e) }; }
    }));

    const errored = results.filter((x) => x.error);
    check(`all ${rows.length} accessions were reachable at rest.uniprot.org`,
      f(errored.length === 0, errored.length !== 0), errored.map((x) => `${x.r.uniprot}:${x.error}`).join(', '));

    const ok = results.filter((x) => x.j);
    const wrongAcc = ok.filter((x) => x.j.primaryAccession !== x.r.uniprot);
    check('every accession read back its own primaryAccession, so none is a redirect to another entry',
      f(wrongAcc.length === 0, wrongAcc.length !== 0), wrongAcc.map((x) => `${x.r.uniprot}->${x.j.primaryAccession}`).join(', '));

    const wrongOrg = ok.filter((x) => x.j.organism?.scientificName !== x.r.organism);
    check('every accession read back the ORGANISM this file claims for it',
      f(wrongOrg.length === 0, wrongOrg.length !== 0), wrongOrg.map((x) => `${x.r.uniprot}: ${x.j.organism?.scientificName} != ${x.r.organism}`).join(' | '));

    const wrongEntry = ok.filter((x) => x.r.uniprot_entry && x.j.uniProtkbId !== x.r.uniprot_entry);
    check('every accession read back the ENTRY NAME this file claims for it',
      f(wrongEntry.length === 0, wrongEntry.length !== 0), wrongEntry.map((x) => `${x.r.uniprot}: ${x.j.uniProtkbId}`).join(' | '));

    const wrongLen = ok.filter((x) => x.j.sequence?.length !== x.r.length);
    check('every accession read back the LENGTH this file records',
      f(wrongLen.length === 0, wrongLen.length !== 0), wrongLen.map((x) => `${x.r.uniprot}: ${x.j.sequence?.length} != ${x.r.length}`).join(' | '));

    const wrongSeq = ok.filter((x) => x.j.sequence?.value !== O.SEQUENCES[x.r.uniprot]);
    check('every EMBEDDED SEQUENCE is byte-identical to the live UniProt sequence',
      f(wrongSeq.length === 0, wrongSeq.length !== 0), wrongSeq.map((x) => x.r.uniprot).join(', '));

    const bov = ok.find((x) => x.r.uniprot === 'P02699');
    check('the bovine reference sequence matches UniProt AND its length is the 348 residues expected for bovine rhodopsin',
      f(bov !== undefined && bov.j.sequence.length === 348 && bov.j.sequence.value === O.BOVINE_RH1_REFERENCE.sequence && bov.j.uniProtkbId === 'OPSD_BOVIN',
        !(bov !== undefined && bov.j.sequence.length === 348 && bov.j.sequence.value === O.BOVINE_RH1_REFERENCE.sequence && bov.j.uniProtkbId === 'OPSD_BOVIN')),
      `${bov?.j?.sequence?.length} aa, ${bov?.j?.uniProtkbId}`);
    check('and the bovine site numbering is taken from that read-back length, not from a constant that could disagree with it',
      f(bov !== undefined && O.BOVINE_RH1_REFERENCE.sequence.length === bov.j.sequence.length && Math.max(...O.RULE_SITES) <= bov.j.sequence.length,
        !(bov !== undefined && O.BOVINE_RH1_REFERENCE.sequence.length === bov.j.sequence.length && Math.max(...O.RULE_SITES) <= bov.j.sequence.length)));
  }
}

// ====================================================================================================
console.log(`\n${pass} pass, ${fail} fail${skipped ? `, ${skipped} skipped` : ''}`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had a fault injected. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
if (OFFLINE && !FAULT) console.log('\nNOTE: --offline. The accessions were NOT verified in this run.');
process.exit(fail && !FAULT ? 1 : 0);
