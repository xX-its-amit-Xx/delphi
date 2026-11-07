#!/usr/bin/env node
// Tests for benchmarks/retro-validation/data/ttx.mjs - the TTX-resistance retro-validation case.
//
//   node benchmarks/retro-validation/data/test-ttx.mjs [--fail-once]
//
// Six things are checked harder than the rest, because they are the six ways this file could do damage:
//
//   1. A NUMBER WITHOUT A UNIT. Half the content here is doses, and a dose without a unit is a lie that
//      looks like data. Every numeric value in every row must carry a unit string, and so must every
//      error bar, every fold-change and every derived ratio.
//   2. A NUMBER WITHOUT A RETRIEVED SOURCE. A fabricated measurement is the worst thing this project can
//      produce. Every row must name a source that exists in SOURCES, every source must carry a DOI and
//      a verified_how that says what was actually fetched, and every DOI must be shaped like a DOI.
//   3. A SUBSTITUTION WITHOUT A NUMBERING CONVENTION. D1532, D1568 and D1431 are three papers' names for
//      what their authors take to be one position. A row that names a residue without naming whose
//      numbering it is has asserted an alignment it did not do.
//   4. A CHANNEL-LEVEL MEASUREMENT CARRYING A WHOLE-ANIMAL FOLD-SHIFT. This is the specific laundering
//      this case invites: 260-fold at the channel read as 260-fold in the animal. Tested as a hard
//      structural property of every row, with the reason stated on each one.
//   5. THE SENSITIVE CONTROL GOING MISSING. Without a measured unresisted baseline the whole case is a
//      list of large numbers. One control must be measured in the same assay as the resistant case.
//   6. A FUSED SCALAR APPEARING AS THE HEADLINE. One float gets read as a probability and the per-axis
//      disagreement - which is the only useful output here - becomes invisible.
//
// --fail-once injects one fault into every assertion, by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own fault asserts nothing.
import * as T from './ttx.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const DOI_SHAPE = /^10\.\d{4,9}\/\S+$/;
const rows = T.SUBSTITUTIONS;
const numericRows = rows.filter((r) => typeof r.measured?.value === 'number');
const nulledRows = rows.filter((r) => r.measured && r.measured.value === null);

console.log(`\nttx: a quantitative, convergent retro-validation case${FAULT ? '   [--fail-once: every assertion faulted]' : ''}\n`);

// ====================================================================================================
// 1. EVERY NUMBER CARRIES A UNIT
// ====================================================================================================
{
  const noUnit = numericRows.filter((r) => typeof r.measured.unit !== 'string' || r.measured.unit.length === 0);
  check('EVERY row with a measured number carries a non-empty unit string',
    f(noUnit.length === 0, noUnit.length !== 0), noUnit.map((r) => r.id).join(', '));

  const badError = numericRows.filter((r) => r.measured.error !== null && r.measured.error !== undefined &&
    !(typeof r.measured.error.value === 'number' && typeof r.measured.error.unit === 'string' && r.measured.error.unit.length > 0 && typeof r.measured.error.kind === 'string'));
  check('every error bar that exists states a value, a unit AND what kind of error it is',
    f(badError.length === 0, badError.length !== 0), badError.map((r) => r.id).join(', '));

  const errKinds = new Set(numericRows.filter((r) => r.measured.error).map((r) => r.measured.error.kind));
  check('more than one kind of error bar is present, so the file cannot be read as one dispersion measure',
    f(errKinds.size > 1, !(errKinds.size > 1)), [...errKinds].join(' / '));

  const foldRows = rows.filter((r) => r.fold_change_as_the_source_states_it);
  const badFold = foldRows.filter((r) => typeof r.fold_change_as_the_source_states_it.value !== 'number' ||
    r.fold_change_as_the_source_states_it.unit !== 'fold (dimensionless ratio)' ||
    typeof r.fold_change_as_the_source_states_it.stated_in !== 'string');
  check('every fold-change attributed to a source carries a unit and says WHERE the source states it',
    f(badFold.length === 0, badFold.length !== 0), badFold.map((r) => r.id).join(', '));
  check('at least one row carries a source-stated fold-change, so that check has something to bite on',
    f(foldRows.length >= 5, !(foldRows.length >= 5)), `${foldRows.length}`);

  const badRef = rows.filter((r) => r.reference_channel && !(typeof r.reference_channel.id === 'string' && 'value' in r.reference_channel && 'unit' in r.reference_channel));
  check('every reference channel names the row it is, with a value and a unit',
    f(badRef.length === 0, badRef.length !== 0), badRef.map((r) => r.id).join(', '));

  const mismatched = rows.filter((r) => r.reference_channel && typeof r.measured?.value === 'number' &&
    typeof r.reference_channel.value === 'number' && r.measured.unit !== r.reference_channel.unit && !r.reference_is_not_wild_type);
  check('no row silently compares a value to a reference in DIFFERENT units',
    f(mismatched.length === 0, mismatched.length !== 0), mismatched.map((r) => `${r.id}: ${r.measured.unit} vs ${r.reference_channel.unit}`).join(', '));

  const d = T.foldOf('hague-2018-NaV1.4-LVNV');
  check('foldOf returns the unit and the derivation, not a bare number',
    f(d.unit === 'fold (dimensionless ratio)' && /derived/i.test(d.derived_by) && /NOT a value any source states/.test(d.derived_by),
      !(d.unit === 'fold (dimensionless ratio)' && /derived/i.test(d.derived_by) && /NOT a value any source states/.test(d.derived_by))));
  check('and the derived fold for the headline allele reproduces the source\'s own stated 260-fold',
    f(Math.abs(d.fold - 260) < 0.5, !(Math.abs(d.fold - 260) < 0.5)), `${d.fold}`);
  check('a derived fold whose numerator is censored is flagged as a BOUND, not reported as a ratio',
    f(T.foldOf('choudhary-2003-T759A').is_a_bound === true, T.foldOf('choudhary-2003-T759A').is_a_bound !== true));
  check('and a derived fold from an uncensored numerator is NOT flagged as a bound, so the flag discriminates',
    f(T.foldOf('choudhary-2003-D1532A').is_a_bound === false, T.foldOf('choudhary-2003-D1532A').is_a_bound !== false));
  check('every QUANTITIES entry declares a unit',
    f(T.QUANTITY_IDS.every((q) => typeof T.QUANTITIES[q].unit === 'string' && T.QUANTITIES[q].unit.length > 0),
      !T.QUANTITY_IDS.every((q) => typeof T.QUANTITIES[q].unit === 'string' && T.QUANTITIES[q].unit.length > 0)));
  const unknownQ = rows.filter((r) => !T.QUANTITY_IDS.includes(r.quantity));
  check('every row\'s quantity is drawn from the declared closed vocabulary',
    f(unknownQ.length === 0, unknownQ.length !== 0), unknownQ.map((r) => `${r.id}:${r.quantity}`).join(', '));
}

// ====================================================================================================
// 2. EVERY NUMBER HAS A RETRIEVED SOURCE, AND THE SOURCE SAYS WHAT WAS RETRIEVED
// ====================================================================================================
{
  const orphan = rows.filter((r) => !T.SOURCE_IDS.includes(r.source));
  check('EVERY row names a source that exists in SOURCES',
    f(orphan.length === 0, orphan.length !== 0), orphan.map((r) => `${r.id}:${r.source}`).join(', '));

  const noDoi = T.SOURCE_IDS.filter((s) => !DOI_SHAPE.test(T.SOURCES[s].doi ?? ''));
  check('EVERY source carries a DOI shaped like a DOI',
    f(noDoi.length === 0, noDoi.length !== 0), noDoi.join(', '));
  const noPmid = T.SOURCE_IDS.filter((s) => !/^\d{7,8}$/.test(T.SOURCES[s].pmid ?? ''));
  check('every source carries a PMID shaped like a PMID, so the DOI can be cross-checked',
    f(noPmid.length === 0, noPmid.length !== 0), noPmid.join(', '));

  const thinVerified = T.SOURCE_IDS.filter((s) => typeof T.SOURCES[s].verified_how !== 'string' || T.SOURCES[s].verified_how.length < 120);
  check('every source says in verified_how, at length, exactly what was retrieved and how',
    f(thinVerified.length === 0, thinVerified.length !== 0), thinVerified.join(', '));
  const noRetrievalVerb = T.SOURCE_IDS.filter((s) => !/retriev|fetch|parsed|resolved|returned/i.test(T.SOURCES[s].verified_how));
  check('and verified_how names an actual retrieval act rather than asserting the source is real',
    f(noRetrievalVerb.length === 0, noRetrievalVerb.length !== 0), noRetrievalVerb.join(', '));
  const noWhatItMeasured = T.SOURCE_IDS.filter((s) => typeof T.SOURCES[s].what_it_measured !== 'string' || T.SOURCES[s].what_it_measured.length < 60);
  check('every source states WHAT IT MEASURED, so a row cannot borrow a source\'s authority for a different assay',
    f(noWhatItMeasured.length === 0, noWhatItMeasured.length !== 0), noWhatItMeasured.join(', '));
  const noOA = T.SOURCE_IDS.filter((s) => typeof T.SOURCES[s].open_access !== 'boolean');
  check('every source records whether it was open access, which is what limits what could be read',
    f(noOA.length === 0, noOA.length !== 0), noOA.join(', '));

  const rowThin = rows.filter((r) => typeof r.verified_how !== 'string' || r.verified_how.length < 60);
  check('EVERY row carries its own verified_how, not just a source id',
    f(rowThin.length === 0, rowThin.length !== 0), rowThin.map((r) => r.id).join(', '));

  // A paywalled source must not be the origin of a point estimate.
  const paywalledWithNumbers = numericRows.filter((r) => T.SOURCES[r.source].open_access === false && r.quantity !== 'TTX-fold-change-in-Kd');
  check('no point estimate in an absolute unit is attributed to a source that was not open access',
    f(paywalledWithNumbers.length === 0, paywalledWithNumbers.length !== 0), paywalledWithNumbers.map((r) => r.id).join(', '));

  // The second-hand row must say so.
  const sh = rows.find((r) => r.id === 'geffeney-2005-I1561-secondhand');
  check('the row whose primary source could not be retrieved names that primary source explicitly',
    f(sh.primary_source_not_retrieved === 'geffeney_2005', sh.primary_source_not_retrieved !== 'geffeney_2005'), `${sh.primary_source_not_retrieved}`);
  check('it reports NO primary value, only second-hand reports, each naming who reported and who they cited',
    f(sh.measured.value === null && sh.secondhand_reports.length === 2 && sh.secondhand_reports.every((x) => x.reported_in && x.citing === 'geffeney_2005'),
      !(sh.measured.value === null && sh.secondhand_reports.length === 2 && sh.secondhand_reports.every((x) => x.reported_in && x.citing === 'geffeney_2005'))));
  check('and each second-hand report carries the caveat its own reporter stated',
    f(sh.secondhand_reports.every((x) => typeof x.caveat_the_reporter_states === 'string' && x.caveat_the_reporter_states.length > 20),
      !sh.secondhand_reports.every((x) => typeof x.caveat_the_reporter_states === 'string' && x.caveat_the_reporter_states.length > 20)));
}

// ====================================================================================================
// 3. EVERY SUBSTITUTION STATES ITS NUMBERING CONVENTION
// ====================================================================================================
{
  const noConv = rows.filter((r) => !T.NUMBERING_IDS.includes(r.numbering));
  check('EVERY row states a numbering convention drawn from NUMBERING_CONVENTIONS',
    f(noConv.length === 0, noConv.length !== 0), noConv.map((r) => `${r.id}:${r.numbering}`).join(', '));

  const convIncomplete = T.NUMBERING_IDS.filter((n) => typeof T.NUMBERING_CONVENTIONS[n].means !== 'string' ||
    typeof T.NUMBERING_CONVENTIONS[n].organism_of_the_numbering !== 'string' ||
    !T.CLADES.includes(T.NUMBERING_CONVENTIONS[n].clade_of_the_numbering));
  check('every convention says what it means, whose protein it numbers, and in which clade',
    f(convIncomplete.length === 0, convIncomplete.length !== 0), convIncomplete.join(', '));

  check('more than one convention is actually USED by the rows, so the field is load-bearing',
    f(new Set(rows.map((r) => r.numbering)).size >= 4, !(new Set(rows.map((r) => r.numbering)).size >= 4)),
    [...new Set(rows.map((r) => r.numbering))].join(', '));

  // A row naming a numbered residue must not be under a convention from a different paralogue family
  // without saying so: the rNaV1.2a rows are the test of that.
  const v12 = rows.filter((r) => r.numbering === 'rNaV1.2a');
  check('the rows measured on a DIFFERENT paralogue are under that paralogue\'s own convention, not the NaV1.4 one',
    f(v12.length >= 5 && v12.every((r) => r.channel === 'NaV1.2a'), !(v12.length >= 5 && v12.every((r) => r.channel === 'NaV1.2a'))),
    `${v12.length} rows`);
  check('and the convention itself warns that its numbers are not interchangeable with the NaV1.4 ones',
    f(/not interchangeable/i.test(T.NUMBERING_CONVENTIONS['rNaV1.2a'].means), !/not interchangeable/i.test(T.NUMBERING_CONVENTIONS['rNaV1.2a'].means)));

  check('the file states as a rule that it never translates a residue number between conventions',
    f(/never translated|No residue number in this file is translated/i.test(T.CROSS_CONVENTION_RULE.rule),
      !/never translated|No residue number in this file is translated/i.test(T.CROSS_CONVENTION_RULE.rule)));
  check('and says WHY: translating a residue number is an alignment claim',
    f(/alignment claim/i.test(T.CROSS_CONVENTION_RULE.because), !/alignment claim/i.test(T.CROSS_CONVENTION_RULE.because)));
  check('every cross-convention equivalence lives in CONVERGENCE and is attributed to the source that asserted it',
    f(T.CONVERGENCE.sets.every((s) => typeof s.asserted_by === 'string' && s.asserted_by.length > 30),
      !T.CONVERGENCE.sets.every((s) => typeof s.asserted_by === 'string' && s.asserted_by.length > 30)),
    T.CONVERGENCE.sets.filter((s) => !(typeof s.asserted_by === 'string' && s.asserted_by.length > 30)).map((s) => s.id).join(', '));

  const noSub = rows.filter((r) => typeof r.substitution !== 'string' || r.substitution.length === 0);
  check('every row names its substitution, including the rows whose substitution is "none"',
    f(noSub.length === 0, noSub.length !== 0), noSub.map((r) => r.id).join(', '));
  const badDomain = rows.filter((r) => !/^(DI|DII|DIII|DIV|DI and DIV|DIII and DIV|none \(unsubstituted\)|none \(TTX-sensitive out-group\)|whole protein|DIV \(the locus, not a single residue\)|DIV \(the locus\))$/.test(r.domain));
  check('every row states which P-loop domain it concerns, from a constrained set of spellings',
    f(badDomain.length === 0, badDomain.length !== 0), badDomain.map((r) => `${r.id}:${r.domain}`).join(' | '));
}

// ====================================================================================================
// 4. NO ROW LAUNDERS A CHANNEL-LEVEL NUMBER INTO A WHOLE-ANIMAL FOLD-SHIFT
// ====================================================================================================
// The specific failure this case invites. 260-fold is a property of a channel in an oocyte membrane.
// feldman_2010 measures 23% of whole-animal variance at the same locus in a congener. If those two can
// be multiplied together anywhere in this file, the file is worse than nothing.
{
  const launderers = rows.filter((r) => r.whole_animal_fold_shift !== null);
  check('NO row in the file carries a whole-animal fold-shift at all',
    f(launderers.length === 0, launderers.length !== 0), launderers.map((r) => r.id).join(', '));

  const missingField = rows.filter((r) => !('whole_animal_fold_shift' in r));
  check('and the field is PRESENT on every row, so the absence is a recorded fact rather than an omission',
    f(missingField.length === 0, missingField.length !== 0), missingField.map((r) => r.id).join(', '));

  const noReason = rows.filter((r) => typeof r.whole_animal_fold_shift_absent_because !== 'string' || r.whole_animal_fold_shift_absent_because.length < 20);
  check('every row states WHY it carries no whole-animal fold-shift',
    f(noReason.length === 0, noReason.length !== 0), noReason.map((r) => r.id).join(', '));

  const badLevel = rows.filter((r) => !T.LEVEL_IDS.includes(r.measurement_level));
  check('every row declares its level of biological organisation from the closed vocabulary',
    f(badLevel.length === 0, badLevel.length !== 0), badLevel.map((r) => `${r.id}:${r.measurement_level}`).join(', '));

  const levels = new Set(rows.map((r) => r.measurement_level));
  check('all four levels are actually populated, so the distinction is doing work',
    f(levels.size === 4 && T.LEVEL_IDS.every((l) => levels.has(l)), !(levels.size === 4 && T.LEVEL_IDS.every((l) => levels.has(l)))),
    [...levels].join(', '));

  const wholeAnimal = rows.filter((r) => r.measurement_level === 'whole-animal');
  check('the whole-animal rows exist and are the ones that break the chain',
    f(wholeAnimal.length >= 2 && wholeAnimal.some((r) => r.quantity === 'variance-explained'),
      !(wholeAnimal.length >= 2 && wholeAnimal.some((r) => r.quantity === 'variance-explained'))), `${wholeAnimal.length}`);
  const v = rows.find((r) => r.id === 'feldman-2010-NaV1.4-variance-explained-T-atratus');
  check('the 23% figure is stored as a share of variance, not as a resistance level',
    f(v.measured.value === 23 && v.measured.unit === 'percent of phenotypic variance',
      !(v.measured.value === 23 && v.measured.unit === 'percent of phenotypic variance')), `${v.measured.value} ${v.measured.unit}`);
  check('and its own note says plainly that the other 77% is not in this dataset',
    f(/77%/.test(v.note) && /not in this dataset/.test(v.note), !(/77%/.test(v.note) && /not in this dataset/.test(v.note))));

  // The channel-level 260-fold must be marked as channel-level, not as organismal.
  const lvnv = rows.find((r) => r.id === 'hague-2018-NaV1.4-LVNV');
  check('the headline 260-fold row is typed as a CHANNEL-level measurement in a host cell',
    f(lvnv.measurement_level === 'channel-heterologous', lvnv.measurement_level !== 'channel-heterologous'), lvnv.measurement_level);
  check('its absent-whole-animal reason names the separate crawl-speed measurement rather than hand-waving',
    f(/crawl speed/i.test(lvnv.whole_animal_fold_shift_absent_because), !/crawl speed/i.test(lvnv.whole_animal_fold_shift_absent_because)));

  // The crawl-speed block must not carry a fold shift either.
  check('the whole-animal crawl-speed consequence reports a test statistic and an explicit null fold_shift',
    f(T.GATING_COSTS.whole_animal_consequence.fold_shift === null && /Wald chi-squared/i.test(T.GATING_COSTS.whole_animal_consequence.unit),
      !(T.GATING_COSTS.whole_animal_consequence.fold_shift === null && /Wald chi-squared/i.test(T.GATING_COSTS.whole_animal_consequence.unit))));
  check('and says the source never reported a fold-shift and this file does not manufacture one',
    f(/does not manufacture one/i.test(T.GATING_COSTS.whole_animal_consequence.fold_shift_absent_because),
      !/does not manufacture one/i.test(T.GATING_COSTS.whole_animal_consequence.fold_shift_absent_because)));

  // The cross-study 30000-fold must be OUT of SUBSTITUTIONS.
  check('the cross-study 30000-fold claim is kept OUT of the measured rows',
    f(!rows.some((r) => r.measured?.value === 30000), rows.some((r) => r.measured?.value === 30000)));
  check('and is recorded as a cross-study ratio with its own reason for exclusion',
    f(/CROSS-STUDY RATIO/i.test(T.DERIVED_AND_CROSS_STUDY.newt_30000_fold.what_kind_of_number_it_is) &&
      typeof T.DERIVED_AND_CROSS_STUDY.newt_30000_fold.why_it_is_not_in_SUBSTITUTIONS === 'string',
      !(/CROSS-STUDY RATIO/i.test(T.DERIVED_AND_CROSS_STUDY.newt_30000_fold.what_kind_of_number_it_is) &&
        typeof T.DERIVED_AND_CROSS_STUDY.newt_30000_fold.why_it_is_not_in_SUBSTITUTIONS === 'string')));
}

// ====================================================================================================
// 5. THE SENSITIVE CONTROL
// ====================================================================================================
{
  const controls = T.SPECIES.filter((s) => s.role === 'sensitive-control');
  check('a TTX-SENSITIVE control lineage is present',
    f(controls.length >= 1, !(controls.length >= 1)), controls.map((s) => s.binomial).join(', '));
  check('more than one is present, at more than one level',
    f(controls.length >= 3, !(controls.length >= 3)), `${controls.length}`);

  const measuredControl = controls.filter((s) => s.measured_rows_here.length > 0);
  check('at least one sensitive control has a MEASURED row, not merely an assertion of sensitivity',
    f(measuredControl.length >= 2, !(measuredControl.length >= 2)), measuredControl.map((s) => s.binomial).join(', '));

  // The one that matters: a sensitive baseline measured in the same assay as the resistant case.
  const amb = rows.find((r) => r.id === 'hanifin-2015-Ambystoma-mavortium-muscle');
  const tar = rows.find((r) => r.id === 'hanifin-2015-Taricha-granulosa-muscle');
  check('the sensitive muscle control and the resistant muscle case come from the SAME source',
    f(amb.source === tar.source, amb.source !== tar.source), `${amb.source} vs ${tar.source}`);
  check('they share the same assay level and the same unit, so the comparison is like for like',
    f(amb.measurement_level === tar.measurement_level && amb.measured.unit === tar.measured.unit,
      !(amb.measurement_level === tar.measurement_level && amb.measured.unit === tar.measured.unit)),
    `${amb.measured.unit} / ${tar.measured.unit}`);
  check('the control blocks at a low dose and the resistant case does not block at a dose four orders higher',
    f(amb.measured.value === 0.025 && tar.measured.value === 300, !(amb.measured.value === 0.025 && tar.measured.value === 300)),
    `${amb.measured.value} vs ${tar.measured.value} uM`);

  const roleOut = T.SPECIES.filter((s) => !T.SPECIES_ROLES.includes(s.role));
  check('every species carries a role from the closed vocabulary',
    f(roleOut.length === 0, roleOut.length !== 0), roleOut.map((s) => s.id).join(', '));
  const cladeOut = T.SPECIES.filter((s) => !T.CLADES.includes(s.clade));
  check('every species carries a clade from the declared comparative scope',
    f(cladeOut.length === 0, cladeOut.length !== 0), cladeOut.map((s) => `${s.id}:${s.clade}`).join(', '));
  const rowCladeOut = rows.filter((r) => !T.CLADES.includes(r.channel_from_clade));
  check('every row\'s channel-of-origin clade is in the declared comparative scope too',
    f(rowCladeOut.length === 0, rowCladeOut.length !== 0), rowCladeOut.map((r) => r.id).join(', '));

  const noComplications = T.SPECIES.filter((s) => !Array.isArray(s.complications) || s.complications.length === 0);
  check('EVERY species, including every control, records at least one complication',
    f(noComplications.length === 0, noComplications.length !== 0), noComplications.map((s) => s.id).join(', '));
  const noSpVerified = T.SPECIES.filter((s) => typeof s.verified_how !== 'string' || s.verified_how.length < 60);
  check('every species row says what was retrieved to support it',
    f(noSpVerified.length === 0, noSpVerified.length !== 0), noSpVerified.map((s) => s.id).join(', '));
  const badSpSources = T.SPECIES.filter((s) => !Array.isArray(s.sources) || s.sources.length === 0 || !s.sources.every((x) => T.SOURCE_IDS.includes(x)));
  check('every species cites sources that exist in SOURCES',
    f(badSpSources.length === 0, badSpSources.length !== 0), badSpSources.map((s) => s.id).join(', '));
  const badRowRefs = T.SPECIES.flatMap((s) => s.measured_rows_here.filter((id) => !T.SUBSTITUTION_IDS.includes(id)));
  check('every row a species points at actually exists, so no species claims data it does not have',
    f(badRowRefs.length === 0, badRowRefs.length !== 0), badRowRefs.join(', '));

  // The sensitive control that is ALSO the host background must say so.
  const rat = T.SPECIES.find((s) => s.id === 'rattus-norvegicus');
  check('the control that doubles as the host background for most mutants admits the conflict',
    f(/host background/i.test(rat.complications[0]) && /never evolved/i.test(rat.complications[0]),
      !(/host background/i.test(rat.complications[0]) && /never evolved/i.test(rat.complications[0]))));
}

// ====================================================================================================
// 6. NULLS ARE DECLARED, NOT GUESSED
// ====================================================================================================
{
  check('some rows have a null measured value, so the refusal machinery is exercised',
    f(nulledRows.length >= 3, !(nulledRows.length >= 3)), `${nulledRows.length}`);
  const badNull = nulledRows.filter((r) => typeof r.measured.null_reason !== 'string' || r.measured.null_reason.length < 40 ||
    typeof r.measured.what_would_have_to_be_measured !== 'string' || r.measured.what_would_have_to_be_measured.length < 40);
  check('EVERY null value carries a null_reason AND what_would_have_to_be_measured, both with substance',
    f(badNull.length === 0, badNull.length !== 0), badNull.map((r) => r.id).join(', '));
  const nullWithUnit = nulledRows.filter((r) => r.measured.unit !== null);
  check('a null value carries a null unit: no unit is asserted for a number that does not exist',
    f(nullWithUnit.length === 0, nullWithUnit.length !== 0), nullWithUnit.map((r) => r.id).join(', '));

  // Nested nulls on rows that DO have a primary value.
  const nestedNullFields = ['absolute_Kd', 'all_four_substitutions', 'per_substitution_effect'];
  const nested = rows.flatMap((r) => nestedNullFields.filter((k) => r[k]).map((k) => ({ id: r.id, k, v: r[k] })));
  check('nested nulls exist too: a row can have a measured number and still refuse a second one',
    f(nested.length >= 4, !(nested.length >= 4)), nested.map((x) => `${x.id}.${x.k}`).join(', '));
  const badNested = nested.filter((x) => x.v.value !== null || typeof x.v.null_reason !== 'string' || typeof x.v.what_would_have_to_be_measured !== 'string');
  check('and every nested null obeys the same discipline',
    f(badNested.length === 0, badNested.length !== 0), badNested.map((x) => `${x.id}.${x.k}`).join(', '));

  check('REFUSED_VALUES enumerates the numbers declined, as a list, not as a sentence',
    f(Array.isArray(T.REFUSED_VALUES) && T.REFUSED_VALUES.length >= 5, !(Array.isArray(T.REFUSED_VALUES) && T.REFUSED_VALUES.length >= 5)),
    `${T.REFUSED_VALUES.length}`);
  const badRefused = T.REFUSED_VALUES.filter((x) => typeof x.value_refused !== 'string' || typeof x.null_reason !== 'string' ||
    typeof x.what_would_have_to_be_measured !== 'string' || x.what_would_have_to_be_measured.length < 40);
  check('every refused value names the value, the reason, and what it would take',
    f(badRefused.length === 0, badRefused.length !== 0), `${badRefused.length}`);
  check('the refusals include the one that the secondary literature would have handed over for free',
    f(T.REFUSED_VALUES.some((x) => /300-fold/.test(x.value_refused)), !T.REFUSED_VALUES.some((x) => /300-fold/.test(x.value_refused))),
    T.REFUSED_VALUES.map((x) => x.value_refused.slice(0, 30)).join(' | '));
  check('and the one that would have completed the pufferfish comparison',
    f(T.REFUSED_VALUES.some((x) => /pufferfish/i.test(x.value_refused)), !T.REFUSED_VALUES.some((x) => /pufferfish/i.test(x.value_refused))));

  // The ~300-fold must appear NOWHERE as a measured value.
  check('no row anywhere carries 300 as a fold-change value: the untraceable figure is not quietly present',
    f(!rows.some((r) => r.fold_change_as_the_source_states_it?.value === 300 || (r.quantity === 'TTX-fold-change-in-Kd' && r.measured?.value === 300)),
      rows.some((r) => r.fold_change_as_the_source_states_it?.value === 300 || (r.quantity === 'TTX-fold-change-in-Kd' && r.measured?.value === 300))));
  check('and the product the maruta fold-changes invite is explicitly recorded as a declined derivation',
    f(/not a measurement of anything/i.test(T.DERIVED_AND_CROSS_STUDY.maruta_chain_not_computed.why_it_is_not_written_anywhere),
      !/not a measurement of anything/i.test(T.DERIVED_AND_CROSS_STUDY.maruta_chain_not_computed.why_it_is_not_written_anywhere)));
}

// ====================================================================================================
// 7. CENSORED VALUES ARE NOT POINT ESTIMATES
// ====================================================================================================
{
  const censored = numericRows.filter((r) => r.measured.censored);
  check('censored values exist and are flagged, not stored as point estimates',
    f(censored.length >= 4, !(censored.length >= 4)), `${censored.length}: ${censored.map((r) => r.id).join(', ')}`);
  const thinCensor = censored.filter((r) => typeof r.measured.censored !== 'string' || r.measured.censored.length < 20);
  check('every censoring flag says what KIND of bound it is, in words',
    f(thinCensor.length === 0, thinCensor.length !== 0), thinCensor.map((r) => r.id).join(', '));
  const censorWithError = censored.filter((r) => r.measured.error !== null);
  check('no censored value carries an error bar, because a bound has no dispersion',
    f(censorWithError.length === 0, censorWithError.length !== 0), censorWithError.map((r) => r.id).join(', '));

  // The two rows that share a number and mean opposite things.
  const sal = rows.find((r) => r.id === 'hanifin-2015-Salamandra-salamandra-muscle');
  const tyl = rows.find((r) => r.id === 'hanifin-2015-Tylototriton-shanjing-muscle');
  check('the two rows sharing the value 0.050 uM are distinguished ONLY by the censoring flag',
    f(sal.measured.value === tyl.measured.value && sal.measured.unit === tyl.measured.unit && sal.measured.censored === null && typeof tyl.measured.censored === 'string',
      !(sal.measured.value === tyl.measured.value && sal.measured.unit === tyl.measured.unit && sal.measured.censored === null && typeof tyl.measured.censored === 'string')),
    `${sal.measured.value}/${tyl.measured.value}, censored ${sal.measured.censored}/${String(tyl.measured.censored).slice(0, 12)}`);
  check('and one of them says in its note that value-plus-unit alone would make the two identical',
    f(/would make these two rows identical/i.test(tyl.note), !/would make these two rows identical/i.test(tyl.note)));
  check('the 300 uM resistant row is censored too: it is a dose that did NOT block',
    f(/did NOT occur|MINIMAL EFFECT/i.test(rows.find((r) => r.id === 'hanifin-2015-Taricha-granulosa-muscle').measured.censored),
      !/did NOT occur|MINIMAL EFFECT/i.test(rows.find((r) => r.id === 'hanifin-2015-Taricha-granulosa-muscle').measured.censored)));
}

// ====================================================================================================
// 8. CONVERGENCE - INDEPENDENT ORIGINS, AND THE ORTHOLOGY SITUATION AT THE SITE
// ====================================================================================================
{
  const sets = T.CONVERGENCE.sets;
  check('there are several convergence sets, not one worked example',
    f(sets.length >= 5, !(sets.length >= 5)), `${sets.length}`);
  const tooFew = sets.filter((s) => s.lineages.filter((l) => l.natural === true).length < 2);
  check('EVERY set lists at least two NATURAL lineages: an experimental mutant is not a lineage',
    f(tooFew.length === 0, tooFew.length !== 0), tooFew.map((s) => s.id).join(', '));
  const noOrigins = sets.filter((s) => !(Number.isInteger(s.independent_origins) && s.independent_origins >= 2));
  check('every set states an integer count of independent origins, at least two',
    f(noOrigins.length === 0, noOrigins.length !== 0), noOrigins.map((s) => s.id).join(', '));
  const noOriginsCaveat = sets.filter((s) => typeof s.independent_origins_counts_only !== 'string' || s.independent_origins_counts_only.length < 20);
  check('and says what that count does and does not include',
    f(noOriginsCaveat.length === 0, noOriginsCaveat.length !== 0), noOriginsCaveat.map((s) => s.id).join(', '));

  const noSiteOrthology = sets.filter((s) => typeof s.orthology_at_the_site !== 'string' || !/descent/i.test(s.orthology_at_the_site));
  check('EVERY set states the orthology situation AT THE SITE, in terms of descent',
    f(noSiteOrthology.length === 0, noSiteOrthology.length !== 0), noSiteOrthology.map((s) => s.id).join(', '));
  const noGeneOrthology = sets.filter((s) => typeof s.orthology_at_the_gene !== 'string');
  check('and separately the orthology situation at the GENE, which is not the same question',
    f(noGeneOrthology.length === 0, noGeneOrthology.length !== 0), noGeneOrthology.map((s) => s.id).join(', '));
  const noClass = sets.filter((s) => !/convergent-analogue/.test(s.analogy_class_this_implies));
  check('every set names the analogy class it implies, and all of them are convergent analogues',
    f(noClass.length === 0, noClass.length !== 0), noClass.map((s) => `${s.id}: ${s.analogy_class_this_implies}`).join(' | '));

  const sameResidueFalse = sets.filter((s) => s.same_residue_reached === false);
  check('some sets reached DIFFERENT residues at the same position, which is the discriminating case',
    f(sameResidueFalse.length >= 3, !(sameResidueFalse.length >= 3)), sameResidueFalse.map((s) => s.id).join(', '));
  const sameResidueTrue = sets.filter((s) => s.same_residue_reached === true);
  check('and some reached the SAME residue, so the flag is not constant',
    f(sameResidueTrue.length >= 2, !(sameResidueTrue.length >= 2)), sameResidueTrue.map((s) => s.id).join(', '));
  const noResidueNote = sets.filter((s) => typeof s.same_residue_note !== 'string' || s.same_residue_note.length < 40);
  check('every set spells out which residues were reached, not just whether they matched',
    f(noResidueNote.length === 0, noResidueNote.length !== 0), noResidueNote.map((s) => s.id).join(', '));

  const iso = sets.find((s) => s.id === 'DIV-isoleucine');
  check('the three-clade isoleucine set records three different destinations: Val, Ser/Thr and Met',
    f(/Val/.test(iso.same_residue_note) && /Ser/.test(iso.same_residue_note) && /Met/.test(iso.same_residue_note),
      !(/Val/.test(iso.same_residue_note) && /Ser/.test(iso.same_residue_note) && /Met/.test(iso.same_residue_note))));
  check('and says that a pipeline matching on substitution identity would see no analogy there at all',
    f(/no analogy here at all/i.test(iso.same_residue_note), !/no analogy here at all/i.test(iso.same_residue_note)));
  check('it also flags that most of its fish instances are a PARALOGUE comparison, not an orthologue one',
    f(/PARALOGUE/i.test(iso.orthology_at_the_gene), !/PARALOGUE/i.test(iso.orthology_at_the_gene)));

  const intra = sets.find((s) => s.id === 'intraspecific-I1561V');
  check('the intraspecific set is present: identical substitution, one species, independent origin',
    f(intra !== undefined && intra.same_residue_reached === true && intra.independent_origins === 2,
      !(intra !== undefined && intra.same_residue_reached === true && intra.independent_origins === 2)));
  check('it attributes the not-identical-by-descent finding to the paper that states it, in that paper\'s words',
    f(/not identical-by-decent|not identical by descent/i.test(intra.asserted_by) && /hague_2017/.test(intra.asserted_by),
      !(/not identical-by-decent|not identical by descent/i.test(intra.asserted_by) && /hague_2017/.test(intra.asserted_by))));

  const noAwkward = sets.filter((s) => s.id !== 'DIV-aspartate' && typeof s.the_awkward_part !== 'string');
  check('every set but one records the thing about it that does not work',
    f(noAwkward.length === 0, noAwkward.length !== 0), noAwkward.map((s) => s.id).join(', '));

  const badMeasuredRefs = sets.flatMap((s) => s.measured_where.filter((id) => !T.SUBSTITUTION_IDS.includes(id)));
  check('every row a convergence set points at exists, so no set claims a measurement it does not have',
    f(badMeasuredRefs.length === 0, badMeasuredRefs.length !== 0), badMeasuredRefs.join(', '));
  const emptyMeasured = sets.filter((s) => s.measured_where.length === 0);
  check('every set points at at least one measured row',
    f(emptyMeasured.length === 0, emptyMeasured.length !== 0), emptyMeasured.map((s) => s.id).join(', '));

  check('the counts are explicitly disclaimed as minima from particular trees, not a census',
    f(/minima/i.test(T.CONVERGENCE.not_a_count_of_convergences) && /would not mean anything/i.test(T.CONVERGENCE.not_a_count_of_convergences),
      !(/minima/i.test(T.CONVERGENCE.not_a_count_of_convergences) && /would not mean anything/i.test(T.CONVERGENCE.not_a_count_of_convergences))));

  // The premise is challenged by a retrieved source, and the challenge is carried.
  const w = T.CONVERGENCE.the_in_silico_warning;
  check('CONVERGENCE carries the retrieved source that argues positional convergence is NOT mechanistic convergence',
    f(w.source === 'geffeney_2022' && /little evidence/i.test(w.what_was_found), !(w.source === 'geffeney_2022' && /little evidence/i.test(w.what_was_found))));
  check('and says why it belongs there: otherwise the file would be selling a premise it has not established',
    f(/premise it has not established/i.test(w.why_it_belongs_here), !/premise it has not established/i.test(w.why_it_belongs_here)));
  check('the warning says what was retrieved and that only the abstract was used',
    f(/only the abstract was used/i.test(w.verified_how), !/only the abstract was used/i.test(w.verified_how)));
}

// ====================================================================================================
// 9. WHY_THIS_IS_A_GOOD_TEST AND WHY_IT_MIGHT_NOT_BE
// ====================================================================================================
{
  check('WHY_THIS_IS_A_GOOD_TEST gives several independent reasons, not one restated',
    f(T.WHY_THIS_IS_A_GOOD_TEST.reasons.length >= 6, !(T.WHY_THIS_IS_A_GOOD_TEST.reasons.length >= 6)), `${T.WHY_THIS_IS_A_GOOD_TEST.reasons.length}`);
  check('it names the quantitative requirement first: a number with a unit, or there is nothing to score',
    f(/number with a unit/i.test(T.WHY_THIS_IS_A_GOOD_TEST.reasons[0]), !/number with a unit/i.test(T.WHY_THIS_IS_A_GOOD_TEST.reasons[0])));
  check('it names the sensitive control measured in the same assay as a reason',
    f(T.WHY_THIS_IS_A_GOOD_TEST.reasons.some((r) => /SENSITIVE CONTROL IS MEASURED IN THE SAME ASSAY/i.test(r)),
      !T.WHY_THIS_IS_A_GOOD_TEST.reasons.some((r) => /SENSITIVE CONTROL IS MEASURED IN THE SAME ASSAY/i.test(r))));
  check('it names the imperfect convergence as a VIRTUE, because it discriminates between matching methods',
    f(T.WHY_THIS_IS_A_GOOD_TEST.reasons.some((r) => /IMPERFECT, WHICH IS BETTER/i.test(r)),
      !T.WHY_THIS_IS_A_GOOD_TEST.reasons.some((r) => /IMPERFECT, WHICH IS BETTER/i.test(r))));

  const bad = T.WHY_IT_MIGHT_NOT_BE.reasons;
  check('WHY_IT_MIGHT_NOT_BE gives at least as many reasons as WHY_THIS_IS_A_GOOD_TEST',
    f(bad.length >= T.WHY_THIS_IS_A_GOOD_TEST.reasons.length, !(bad.length >= T.WHY_THIS_IS_A_GOOD_TEST.reasons.length)),
    `${bad.length} against ${T.WHY_THIS_IS_A_GOOD_TEST.reasons.length}`);
  const thin = bad.filter((r) => typeof r.the_problem !== 'string' || r.the_problem.length < 100 || typeof r.what_would_fix_it !== 'string');
  check('every objection states the problem at length AND what would fix it, rather than only obstructing',
    f(thin.length === 0, thin.length !== 0), thin.map((r) => r.id).join(', '));

  // The three the task cares about specifically.
  const cross = bad.find((r) => r.id === 'cross-lab-and-cross-system-incomparability');
  check('the cross-lab objection is present and quantifies itself rather than gesturing',
    f(cross !== undefined && /1\.35x/.test(cross.the_measured_size_of_it), !(cross !== undefined && /1\.35x/.test(cross.the_measured_size_of_it))));
  check('it names the four expression systems and both estimands',
    f(/HEK-293/.test(cross.the_problem) && /IC50 and Kd|IC50/.test(cross.the_problem) && /Kd/.test(cross.the_problem),
      !(/HEK-293/.test(cross.the_problem) && /IC50/.test(cross.the_problem) && /Kd/.test(cross.the_problem))));
  check('and states what it rules out: ordering two substitutions whose effects are smaller than the disagreement',
    f(/cannot be ordered/i.test(cross.what_it_rules_out) && /2-fold/.test(cross.what_it_rules_out),
      !(/cannot be ordered/i.test(cross.what_it_rules_out) && /2-fold/.test(cross.what_it_rules_out))));

  const nonadd = bad.find((r) => r.id === 'non-additivity-and-the-background');
  check('the non-additivity objection is present and cites the measured case from a single paper',
    f(nonadd !== undefined && /G1718T is 2-fold alone and adds a further 3-fold/.test(nonadd.the_problem),
      !(nonadd !== undefined && /G1718T is 2-fold alone and adds a further 3-fold/.test(nonadd.the_problem))));
  check('it rules out summing per-substitution shifts to predict a multi-substitution allele',
    f(/Summing per-substitution fold-shifts/i.test(nonadd.what_it_rules_out), !/Summing per-substitution fold-shifts/i.test(nonadd.what_it_rules_out)));
  check('and it says NON-ADDITIVITY rather than EPISTASIS, and says why that distinction was kept',
    f(/says NON-ADDITIVITY and not EPISTASIS/i.test(nonadd.note), !/says NON-ADDITIVITY and not EPISTASIS/i.test(nonadd.note)));

  const levels = bad.find((r) => r.id === 'levels-are-not-rungs-on-one-ladder');
  check('the levels objection is present and cites the 23% figure as the thing that breaks the chain',
    f(levels !== undefined && /23%/.test(levels.the_problem), !(levels !== undefined && /23%/.test(levels.the_problem))));
  check('it states that no row carries a whole-animal fold-shift and that a TEST enforces it',
    f(/enforced by a test/i.test(levels.what_it_rules_out), !/enforced by a test/i.test(levels.what_it_rules_out)));
  check('and it quotes the source conceding that pore mutations are not the sole determinant',
    f(/not the sole determinant of whole-animal TTX resistance/.test(levels.the_problem),
      !/not the sole determinant of whole-animal TTX resistance/.test(levels.the_problem)));

  check('the objections include the one about what got measured being a sample of experimenters\' attention',
    f(bad.some((r) => r.id === 'selection-on-what-got-measured'), !bad.some((r) => r.id === 'selection-on-what-got-measured')));
  check('and the one about the secondary literature having drifted from its own primary tables',
    f(bad.some((r) => r.id === 'the-secondary-literature-has-drifted'), !bad.some((r) => r.id === 'the-secondary-literature-has-drifted')));
}

// ====================================================================================================
// 10. THE DISCREPANCIES WERE FOUND BY READING BOTH SOURCES
// ====================================================================================================
{
  const keys = Object.keys(T.DISCREPANCIES).filter((k) => k !== 'what_this_block_is');
  check('several discrepancies are recorded, not one',
    f(keys.length >= 4, !(keys.length >= 4)), keys.join(', '));
  const badSrc = keys.filter((k) => !Array.isArray(T.DISCREPANCIES[k].sources) || !T.DISCREPANCIES[k].sources.every((s) => T.SOURCE_IDS.includes(s)));
  check('every discrepancy names the sources it is between, and they all exist',
    f(badSrc.length === 0, badSrc.length !== 0), badSrc.join(', '));
  const badVerified = keys.filter((k) => typeof T.DISCREPANCIES[k].verified_how !== 'string' || !/this session|parsed|retrieved/i.test(T.DISCREPANCIES[k].verified_how));
  check('every discrepancy says it was found by retrieving BOTH sides, not asserted from memory',
    f(badVerified.length === 0, badVerified.length !== 0), badVerified.join(', '));

  const asp = T.DISCREPANCIES.asp_to_asn_fold_attribution;
  check('the untraceable ~300-fold is recorded with the primary table\'s own three values against it',
    f(/1480/.test(asp.the_disagreement) && /7620/.test(asp.the_disagreement) && /3190/.test(asp.the_disagreement),
      !(/1480/.test(asp.the_disagreement) && /7620/.test(asp.the_disagreement) && /3190/.test(asp.the_disagreement))));
  check('its derived folds are labelled as derived here, not attributed to either paper',
    f(/ttx\.mjs/.test(asp.all_three_folds_derived_by), !/ttx\.mjs/.test(asp.all_three_folds_derived_by)));
  check('and it traces how far the untraceable figure travelled: onto an amphibian substitution never expressed',
    f(/never been expressed/.test(asp.why_it_matters), !/never been expressed/.test(asp.why_it_matters)));

  const thr = T.DISCREPANCIES.thr_fold_attribution;
  check('the Thr-substitution mis-citation is recorded, naming the Alanine row as the one that fits the range',
    f(/ALANINE substitution/i.test(thr.the_disagreement) && /not Ile, Asp or Lys/i.test(thr.the_disagreement),
      !(/ALANINE substitution/i.test(thr.the_disagreement) && /not Ile, Asp or Lys/i.test(thr.the_disagreement))));
  check('and it declines to blame either paper\'s own data',
    f(/Nothing is wrong with either paper's own data/.test(thr.why_it_matters), !/Nothing is wrong with either paper's own data/.test(thr.why_it_matters)));

  const bg = T.DISCREPANCIES.background_dependence;
  check('the background-dependence disagreement is recorded, and is NOT overstated as a contradiction',
    f(/Not exactly/.test(bg.is_it_a_contradiction) && /BINDING/.test(bg.is_it_a_contradiction) && /GATING/.test(bg.is_it_a_contradiction),
      !(/Not exactly/.test(bg.is_it_a_contradiction) && /BINDING/.test(bg.is_it_a_contradiction) && /GATING/.test(bg.is_it_a_contradiction))));
  check('and the file states that it does not assert epistasis for TTX binding as a result',
    f(/does not assert that epistasis.*has been demonstrated/i.test(bg.what_this_file_does_about_it),
      !/does not assert that epistasis.*has been demonstrated/i.test(bg.what_this_file_does_about_it)));

  const lab = T.DISCREPANCIES.between_lab_wild_type;
  check('the between-lab wild-type disagreement names both numbers and both labs\' assays',
    f(/48\.6/.test(lab.the_disagreement) && /36 nM/.test(lab.the_disagreement), !(/48\.6/.test(lab.the_disagreement) && /36 nM/.test(lab.the_disagreement))));
  check('and the derived ratio in DERIVED_AND_CROSS_STUDY matches it and is labelled derived',
    f(Math.abs(T.DERIVED_AND_CROSS_STUDY.between_lab_wild_type.ratio - 48.6 / 36) < 1e-9 && /ttx\.mjs/.test(T.DERIVED_AND_CROSS_STUDY.between_lab_wild_type.derived_by),
      !(Math.abs(T.DERIVED_AND_CROSS_STUDY.between_lab_wild_type.ratio - 48.6 / 36) < 1e-9 && /ttx\.mjs/.test(T.DERIVED_AND_CROSS_STUDY.between_lab_wild_type.derived_by))));
  check('and it says plainly that two numbers are not a distribution',
    f(/do not give a distribution/i.test(lab.what_it_does_not_mean), !/do not give a distribution/i.test(lab.what_it_does_not_mean)));
}

// ====================================================================================================
// 11. NO FUSED SCALAR, EVER
// ====================================================================================================
{
  const v = T.retroValidationVerdict();
  const topLevelNumbers = Object.entries(v).filter(([, x]) => typeof x === 'number').map(([k]) => k);
  check('NO top-level property of the verdict is a bare number',
    f(topLevelNumbers.length === 0, topLevelNumbers.length !== 0), topLevelNumbers.join(', '));
  check('fused_scalar, score, probability and retro_validatability are all explicitly null, not absent',
    f(v.fused_scalar === null && v.score === null && v.probability === null && v.retro_validatability === null &&
      'fused_scalar' in v && 'retro_validatability' in v,
      !(v.fused_scalar === null && v.score === null && v.probability === null && v.retro_validatability === null && 'fused_scalar' in v && 'retro_validatability' in v)));
  check('the headline is a sentence, not a value',
    f(typeof v.headline === 'string' && v.headline.length > 60, !(typeof v.headline === 'string' && v.headline.length > 60)));
  check('the headline contains NO digits at all, so no float can be quoted out of it',
    f(/[0-9]/.test(v.headline) === false, /[0-9]/.test(v.headline) === true), v.headline.slice(0, 70));
  check('every axis gets a verdict from the closed vocabulary',
    f(T.AXIS_IDS.every((a) => T.VERDICT_VOCABULARY.includes(v.axes[a].verdict)), !T.AXIS_IDS.every((a) => T.VERDICT_VOCABULARY.includes(v.axes[a].verdict))),
    JSON.stringify(v.axis_verdicts));
  check('the axes do NOT all agree, so a single word could not stand in for them',
    f(new Set(Object.values(v.axis_verdicts)).size >= 3, !(new Set(Object.values(v.axis_verdicts)).size >= 3)),
    [...new Set(Object.values(v.axis_verdicts))].join(', '));
  check('at least one axis is CONTRADICTED by a retrieved source, not merely unsupported',
    f(Object.values(v.axis_verdicts).includes('contradicted'), !Object.values(v.axis_verdicts).includes('contradicted')));
  check('and it is the mechanistic-convergence axis, which is the premise of the whole case',
    f(v.axis_verdicts['mechanistic-convergence'] === 'contradicted', v.axis_verdicts['mechanistic-convergence'] !== 'contradicted'));
  const noFix = T.AXIS_IDS.filter((a) => typeof v.axes[a].what_would_raise_it !== 'string' || v.axes[a].what_would_raise_it.length < 10);
  check('every axis names what would raise it, including the two that are already maximal',
    f(noFix.length === 0, noFix.length !== 0), noFix.join(', '));
  const noBecause = T.AXIS_IDS.filter((a) => typeof v.axes[a].because !== 'string' || v.axes[a].because.length < 80);
  check('every axis verdict carries its reasoning, at length',
    f(noBecause.length === 0, noBecause.length !== 0), noBecause.join(', '));
  check('the confidence is a BAND with hi > lo',
    f(v.band.hi > v.band.lo, !(v.band.hi > v.band.lo)), `${v.band.lo} - ${v.band.hi}`);
  check('the band is not collapsible to a point, and says so',
    f(v.band.is_a_band_not_a_point === true && v.band.hi - v.band.lo > 0.3, !(v.band.is_a_band_not_a_point === true && v.band.hi - v.band.lo > 0.3)),
    `width ${(v.band.hi - v.band.lo).toFixed(2)}`);
  check('the width is explained as axis DISAGREEMENT, not as model imprecision',
    f(/axes disagree with each other, not because the estimate is imprecise/i.test(v.band.width_is_the_message),
      !/axes disagree with each other, not because the estimate is imprecise/i.test(v.band.width_is_the_message)));
  check('the band says in words that it is not a probability, and why',
    f(/no reference class/i.test(v.band.not_a_probability), !/no reference class/i.test(v.band.not_a_probability)));
  check('the label_span shows the band crosses several labels rather than hiding it',
    f(v.band.label_span.length >= 3, !(v.band.label_span.length >= 3)), v.band.label_span.join('/'));
  check('the verdict carries WHY_NOT_ONE_NUMBER with it, so a caller cannot get the band without the caveat',
    f(v.why_no_fused_scalar === T.WHY_NOT_ONE_NUMBER, v.why_no_fused_scalar !== T.WHY_NOT_ONE_NUMBER));
  check('WHY_NOT_ONE_NUMBER gives more than one reason and names the probability misreading',
    f(T.WHY_NOT_ONE_NUMBER.the_argument.length >= 4 && T.WHY_NOT_ONE_NUMBER.the_argument.some((s) => /read as a probability/i.test(s)),
      !(T.WHY_NOT_ONE_NUMBER.the_argument.length >= 4 && T.WHY_NOT_ONE_NUMBER.the_argument.some((s) => /read as a probability/i.test(s)))));
  check('the verdict names the ONE axis whose next experiment is worth running',
    f(/per-substitution-attribution/.test(v.the_axis_that_decides_the_next_experiment), !/per-substitution-attribution/.test(v.the_axis_that_decides_the_next_experiment)));
  check('every axis declares what it asks',
    f(T.AXIS_IDS.every((a) => typeof T.AXES[a].asks === 'string' && T.AXES[a].asks.endsWith('?')),
      !T.AXIS_IDS.every((a) => typeof T.AXES[a].asks === 'string' && T.AXES[a].asks.endsWith('?'))));
  check('the verdict object is frozen, so a caller cannot staple a scalar onto it downstream',
    f(Object.isFrozen(v) === true, Object.isFrozen(v) !== true));

  const s = T.summary();
  check('summary() reports no fused scalar either',
    f(s.fused_scalar === null && 'fused_scalar' in s, !(s.fused_scalar === null && 'fused_scalar' in s)));
  check('summary()\'s headline measurement states the value, the error, the n AND the DOI',
    f(/13000/.test(s.headline_measurement) && /1800/.test(s.headline_measurement) && /n=11/.test(s.headline_measurement) && /10\.1002\/evl3\.76/.test(s.headline_measurement),
      !(/13000/.test(s.headline_measurement) && /1800/.test(s.headline_measurement) && /n=11/.test(s.headline_measurement) && /10\.1002\/evl3\.76/.test(s.headline_measurement))));
  check('summary() pairs the headline with the warning that breaks the level chain, with its own DOI',
    f(/23%/.test(s.headline_warning) && /10\.1098\/rspb\.2010\.0748/.test(s.headline_warning) && /no row in this file carries a whole-animal fold-shift/i.test(s.headline_warning),
      !(/23%/.test(s.headline_warning) && /10\.1098\/rspb\.2010\.0748/.test(s.headline_warning) && /no row in this file carries a whole-animal fold-shift/i.test(s.headline_warning))));
  check('summary() counts the nulls and the censored rows, not only the numbers',
    f(s.n_nulled >= 3 && s.n_censored >= 4, !(s.n_nulled >= 3 && s.n_censored >= 4)), `${s.n_nulled} null, ${s.n_censored} censored`);
  check('summary() reports at least one sensitive control',
    f(s.n_sensitive_controls >= 1, !(s.n_sensitive_controls >= 1)), `${s.n_sensitive_controls}`);
  check('summary() breaks the rows down by level AND by numbering convention, so neither can be averaged away',
    f(Object.keys(s.rows_by_level).length === 4 && Object.keys(s.rows_by_numbering_convention).length === T.NUMBERING_IDS.length,
      !(Object.keys(s.rows_by_level).length === 4 && Object.keys(s.rows_by_numbering_convention).length === T.NUMBERING_IDS.length)));
  check('the row counts by level sum to the number of rows, so each row got exactly one level',
    f(Object.values(s.rows_by_level).reduce((a, b) => a + b, 0) === s.n_rows, Object.values(s.rows_by_level).reduce((a, b) => a + b, 0) !== s.n_rows));
}

// ====================================================================================================
// 12. FROZEN, AND THE GATING COST TRAVELS WITH THE BENEFIT
// ====================================================================================================
{
  for (const [name, obj] of [['SOURCES', T.SOURCES], ['SUBSTITUTIONS', T.SUBSTITUTIONS], ['SPECIES', T.SPECIES],
    ['CONVERGENCE', T.CONVERGENCE], ['WHY_THIS_IS_A_GOOD_TEST', T.WHY_THIS_IS_A_GOOD_TEST],
    ['WHY_IT_MIGHT_NOT_BE', T.WHY_IT_MIGHT_NOT_BE], ['DISCREPANCIES', T.DISCREPANCIES],
    ['REFUSED_VALUES', T.REFUSED_VALUES], ['NUMBERING_CONVENTIONS', T.NUMBERING_CONVENTIONS],
    ['GATING_COSTS', T.GATING_COSTS], ['MEASUREMENT_LEVELS', T.MEASUREMENT_LEVELS]]) {
    check(`${name} is frozen`, f(Object.isFrozen(obj) === true, Object.isFrozen(obj) !== true));
  }
  check('the freeze is DEEP: a nested row cannot be mutated',
    f(Object.isFrozen(T.SUBSTITUTIONS[0].measured) === true, Object.isFrozen(T.SUBSTITUTIONS[0].measured) !== true));
  check('and deep on the nested arrays inside CONVERGENCE too',
    f(Object.isFrozen(T.CONVERGENCE.sets[0].lineages) === true, Object.isFrozen(T.CONVERGENCE.sets[0].lineages) !== true));

  // The cost is in the same clone as the benefit.
  const act = T.GATING_COSTS.measured.find((m) => /activation/.test(m.what));
  check('the gating cost is recorded with units on both the ancestral and the resistant value',
    f(act.ancestral.unit === 'mV' && act.resistant_LVNV.unit === 'mV', !(act.ancestral.unit === 'mV' && act.resistant_LVNV.unit === 'mV')));
  check('the shift is labelled as derived here and cross-checked against the source\'s own wording',
    f(/ttx\.mjs/.test(act.shift.derived_by) && /20 mV shift/.test(act.shift.derived_by), !(/ttx\.mjs/.test(act.shift.derived_by) && /20 mV shift/.test(act.shift.derived_by))));
  check('and the shift reproduces the difference of the two table values',
    f(Math.abs(act.shift.value - (act.resistant_LVNV.value - act.ancestral.value)) < 1e-9,
      !(Math.abs(act.shift.value - (act.resistant_LVNV.value - act.ancestral.value)) < 1e-9)), `${act.shift.value}`);
  check('the gating-cost block records that the cost appeared in one lineage and not the other',
    f(/not a cost of resistance/i.test(T.GATING_COSTS.the_asymmetry_worth_noticing) && /particular allele/i.test(T.GATING_COSTS.the_asymmetry_worth_noticing),
      !(/not a cost of resistance/i.test(T.GATING_COSTS.the_asymmetry_worth_noticing) && /particular allele/i.test(T.GATING_COSTS.the_asymmetry_worth_noticing))));
  check('and that the mechanistic link to performance is explicitly untested, in the source\'s words',
    f(/still remains untested/.test(T.GATING_COSTS.whole_animal_consequence.what_it_does_not_show),
      !/still remains untested/.test(T.GATING_COSTS.whole_animal_consequence.what_it_does_not_show)));

  // Construct types: the measured-in-a-stranger problem must be visible.
  const badConstruct = rows.filter((r) => !Object.keys(T.CONSTRUCT_TYPES).includes(r.construct));
  check('every row declares its construct type from the closed vocabulary',
    f(badConstruct.length === 0, badConstruct.length !== 0), badConstruct.map((r) => `${r.id}:${r.construct}`).join(', '));
  const nativeCloned = rows.filter((r) => r.construct === 'native-cloned-variant');
  check('at least a few rows are NATIVE cloned variants, so the file is not all mammalian stand-ins',
    f(nativeCloned.length >= 5, !(nativeCloned.length >= 5)), `${nativeCloned.length}`);
  const mutantsInRat = rows.filter((r) => r.construct === 'site-directed-mutant' && r.channel_from_clade === 'mammal');
  check('and the file records that MOST quantified substitutions were measured in a clade that never evolved them',
    f(mutantsInRat.length > nativeCloned.length, !(mutantsInRat.length > nativeCloned.length)),
    `${mutantsInRat.length} mammalian mutants against ${nativeCloned.length} native cloned variants`);
  check('that imbalance is named as an objection in its own right',
    f(T.WHY_IT_MIGHT_NOT_BE.reasons.some((r) => r.id === 'the-measured-and-the-natural-are-mostly-different-channels'),
      !T.WHY_IT_MIGHT_NOT_BE.reasons.some((r) => r.id === 'the-measured-and-the-natural-are-mostly-different-channels')));

  check('WHAT_THIS_IS names the three things kept separate: convention, construct, level',
    f(/numbering convention/i.test(T.WHAT_THIS_IS) && /construct/i.test(T.WHAT_THIS_IS) && /level of biological organisation/i.test(T.WHAT_THIS_IS),
      !(/numbering convention/i.test(T.WHAT_THIS_IS) && /construct/i.test(T.WHAT_THIS_IS) && /level of biological organisation/i.test(T.WHAT_THIS_IS))));
  check('every row id is unique, so nothing is double-counted',
    f(new Set(T.SUBSTITUTION_IDS).size === T.SUBSTITUTION_IDS.length, new Set(T.SUBSTITUTION_IDS).size !== T.SUBSTITUTION_IDS.length));
  check('every species id is unique too',
    f(new Set(T.SPECIES_IDS).size === T.SPECIES_IDS.length, new Set(T.SPECIES_IDS).size !== T.SPECIES_IDS.length));
}

// ====================================================================================================
console.log(`\n${pass} pass, ${fail} fail`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above was faulted. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
