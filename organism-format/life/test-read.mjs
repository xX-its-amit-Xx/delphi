#!/usr/bin/env node
// Tests for the .life reader.
//
//   node organism-format/life/test-read.mjs
//   node organism-format/life/test-read.mjs --fail-once     <- every assertion must flip to FAIL
//
// Most of these check that the reader REFUSES something, because the failure mode that matters is not a
// malformed file - it is a well-formed one that has quietly lost the difference between measured and
// assumed. Two of them check something subtler: that a degraded file does not come back ok, and that a
// file in which nothing could be checked does not come back ok either.
//
// Every fixture is built inline, so each one differs from the good one in exactly one way and the test
// says which way.

import * as SPEC from './spec.mjs';
import { read, checkTimelineOrder, checkIdentity, channelCoverage, provenanceCensus, summary, usableFor } from './read.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

// ===================================================================================================
// fixtures
// ===================================================================================================

const stamp = (kind, extra = {}) => ({
  kind,
  ...(kind === 'assumed' || kind === 'depicted' ? {} : { source: 'UTMM, bioRxiv 10.64898/2026.02.23.706394' }),
  scope: 'one cell in one embryo at one time; establishes nothing about any other individual',
  ...extra,
});

const geomChannel = kind => ({
  centre: [0, 0, 0], radius: 8.2, surface_area: 845, exposed_surface_area: 410, mean_curvature: 0.122,
  provenance: stamp(kind),
});
// NOTE: this fixture used to carry `elastic_modulus_Pa: 310`, following the spec as first written. The
// spec was corrected - UTMM's per-cell channel is a RELATIVE compliance, not a modulus in pascals - and
// this reader caught the stale fixture immediately, which is the behaviour we want from it.
const mechChannel = kind => ({
  readout_kind: 'relative-compliance', readout_value: 1.14, unit: 'dimensionless (dRMSD relative to stage median)',
  is_relative: true, method: 'organelle-fluctuation inference, high-frequency', frequency_Hz: 100,
  provenance: stamp(kind),
});
const lineageChannel = kind => ({
  parent: 'c0', fate: 'EVL', fate_confidence: 0.61,
  provenance: stamp(kind),
});

/** A good .life: two stages, one observed and one filled in, every channel measured on at least one cell. */
const GOOD = () => ({
  format: SPEC.FORMAT,
  identity: { organism: 'Danio rerio, wild type', taxon: 'NCBI:txid7955', reference_assembly: 'GRCz11' },
  genome: { representation: 'reference-only', assembly: 'GRCz11', edits: [] },
  channels_declared: ['geometry', 'mechanics', 'lineage'],
  timeline: {
    stages: [
      {
        id: 's24', name: 'prim-5', time: 24, time_unit: 'hpf', temperature_C: 28.5,
        observed: true,
        measured_on: { reference_assembly: 'GRCz11' },
        geometry: {
          provenance: stamp('measured', { scope: 'cell positions in one embryo at one time; not a population statistic' }),
          cells: [
            { id: 'c1', channels: { geometry: geomChannel('measured'), mechanics: mechChannel('measured'), lineage: lineageChannel('measured-secondhand') } },
            { id: 'c2', channels: { geometry: geomChannel('measured'), mechanics: mechChannel('measured') } },
          ],
        },
        phenotype: {
          body_length_mm: { v: 2.1, unit: 'mm', kind: 'measured', source: 'Kimmel et al. 1995 staging series', scope: 'a population mean; establishes nothing about this individual' },
          pigment_density: { v: null, unknown: true, kind: 'not-established', why: 'no source reports pigment density at this stage for this line', scope: 'its absence says nothing about whether pigment is present' },
        },
      },
      {
        id: 's36', name: 'prim-25', time: 36, time_unit: 'hpf', temperature_C: 28.5,
        observed: false,
        measured_on: { reference_assembly: 'GRCz11' },
        geometry: {
          provenance: stamp('depicted', { scope: 'drawn so the trajectory can be rendered; never to be read as data' }),
          cells: [
            { id: 'c3', channels: { geometry: geomChannel('assumed'), mechanics: mechChannel('borrowed') } },
            { id: 'c4', channels: { geometry: geomChannel('assumed') } },
          ],
        },
        phenotype: {
          body_length_mm: { v: null, unknown: true, kind: 'not-established', why: 'this stage was filled in rather than observed, so no length was measured', scope: 'says nothing about the real length at 36 hpf' },
        },
      },
    ],
  },
  provenance: { written_by: 'organism-format/life/test-read.mjs', measured_on: { reference_assembly: 'GRCz11' } },
  not_established: [
    'which stages were observed and which were filled in: s24 was observed, s36 was filled in',
    'for each channel, on how many cells it was actually measured: see channelCoverage()',
    'whether the geometry is a measurement, a reconstruction, or a drawing: measured at s24, drawn at s36',
    'what the file cannot be used to simulate: anything. No value here was fitted to a model.',
  ],
});

/** The number of value-like nodes in GOOD(), counted by hand from the fixture above. */
const GOOD_VALUES = 13;
const GOOD_CENSUS_LINE = '6 measured / 2 assumed / 2 not-established / 1 borrowed / 1 depicted / 1 measured-secondhand';

console.log(`\n.life reader${FAULT ? '  [--fail-once: every assertion below must FAIL]' : ''}\n`);

// ===================================================================================================
// 1. the good fixture
// ===================================================================================================
{
  const r = read(GOOD(), { source: 'GOOD' });
  check('a valid .life reads ok', f(r.status === 'ok', r.status !== 'ok'), `${r.status}: ${r.headline}`);
  check('ok means problems and degradations are both empty',
    f(r.problems.length === 0 && r.degradations.length === 0, r.problems.length !== 0 || r.degradations.length !== 0),
    JSON.stringify(r.problems.concat(r.degradations).slice(0, 2)));
  check('ok returns the parsed life, not null', f(r.life !== null, r.life === null));
  check('ok reports which constraints were applied, and it is not zero',
    f(r.usable.constraints_applied > 0, !(r.usable.constraints_applied > 0)), `applied ${r.usable.constraints_applied}`);
}

// ===================================================================================================
// 2. refusals
// ===================================================================================================
{
  const doc = GOOD(); delete doc.format;
  const r = read(doc);
  check('a missing format is refused', f(r.status === 'refused', r.status !== 'refused'), r.headline);
  check('a refusal is a structured result, not a throw',
    f(Array.isArray(r.problems) && r.problems.length > 0 && 'usable' in r, !(Array.isArray(r.problems) && r.problems.length > 0 && 'usable' in r)));
}
{
  const doc = GOOD(); doc.timeline.stages[1].time_unit = 'fortnights';
  const r = read(doc);
  check('an unknown time_unit is refused',
    f(r.status === 'refused' && r.problems.some(p => /fortnights/.test(p.what)),
      !(r.status === 'refused' && r.problems.some(p => /fortnights/.test(p.what)))), r.headline);
}
{
  const doc = GOOD(); doc.timeline.stages[1].id = 's24';
  const r = read(doc);
  check('a duplicate stage id is refused',
    f(r.status === 'refused' && r.problems.some(p => /duplicate stage id/.test(p.what)),
      !(r.status === 'refused' && r.problems.some(p => /duplicate stage id/.test(p.what)))), r.headline);
}
{
  const doc = GOOD(); delete doc.timeline.stages[0].temperature_C;
  const r = read(doc);
  check('a stage with no temperature_C is refused',
    f(r.status === 'refused' && r.problems.some(p => /temperature_C/.test(p.field)),
      !(r.status === 'refused' && r.problems.some(p => /temperature_C/.test(p.field)))), r.headline);
}
{
  const doc = GOOD(); doc.timeline = 'two stages, trust me';
  const r = read(doc);
  check('a timeline that is not an array is refused',
    f(r.status === 'refused' && r.problems.some(p => p.field === 'timeline'),
      !(r.status === 'refused' && r.problems.some(p => p.field === 'timeline'))), r.headline);
  check('when nothing could be checked, the result is never ok',
    f(r.status !== 'ok' && r.usable.cannot_be_used_for.length > 0, !(r.status !== 'ok' && r.usable.cannot_be_used_for.length > 0)));
}
{
  // The one a lenient reader accepts: a number smuggled through the not-established path.
  const doc = GOOD();
  doc.timeline.stages[0].phenotype.pigment_density = { v: 0.31, unknown: true, kind: 'not-established', why: 'nobody measured it', scope: 'establishes nothing at all about pigment' };
  const r = read(doc);
  check('{v: 0.31, unknown: true} is refused',
    f(r.status === 'refused' && r.problems.some(p => /unknown but carries a value/.test(p.what)),
      !(r.status === 'refused' && r.problems.some(p => /unknown but carries a value/.test(p.what)))), r.headline);
  check('the smuggled number is not counted as a provenance kind',
    f((provenanceCensus(doc).by_kind['not-established'] ?? 0) === 1, (provenanceCensus(doc).by_kind['not-established'] ?? 0) !== 1),
    JSON.stringify(provenanceCensus(doc).by_kind));
}
{
  const r = read('{ "format": "life/0.1.0", oops');
  check('malformed JSON is refused and does not throw',
    f(r.status === 'refused' && /not JSON/.test(r.problems[0].what), !(r.status === 'refused' && /not JSON/.test(r.problems[0].what))), r.headline);
}

// ===================================================================================================
// 3. identity drift
// ===================================================================================================
{
  const doc = GOOD();
  doc.timeline.stages[0].measured_on.reference_assembly = 'GRCz10';
  const r = read(doc);
  const id = checkIdentity(doc);
  check('an identity mismatch is refused, not warned',
    f(r.status === 'refused' && r.problems.some(p => p.refusal === 'no_identity_drift'),
      !(r.status === 'refused' && r.problems.some(p => p.refusal === 'no_identity_drift'))), r.headline);
  check('the identity mismatch is not merely a warning',
    f(!r.warnings.some(w => /identity/.test(String(w.field))), r.warnings.some(w => /identity/.test(String(w.field)))));
  check('checkIdentity names the disagreeing record',
    f(id.checked === true && id.agreed === false && id.disagreements.length === 1,
      !(id.checked === true && id.agreed === false && id.disagreements.length === 1)), JSON.stringify(id.disagreements));
}
{
  const doc = GOOD(); delete doc.genome.assembly;
  const id = checkIdentity(doc);
  check('an identity that could not be checked is not reported as agreement',
    f(id.checked === false && id.agreed === null && typeof id.why_unchecked === 'string',
      !(id.checked === false && id.agreed === null && typeof id.why_unchecked === 'string')), JSON.stringify({ checked: id.checked, agreed: id.agreed }));
  check('an unchecked identity degrades the file rather than passing it',
    f(read(doc).status === 'degraded', read(doc).status !== 'degraded'), read(doc).headline);
}

// ===================================================================================================
// 4. timeline order - reported, never sorted
// ===================================================================================================
{
  const doc = GOOD();
  doc.timeline.stages[0].time = 36;
  doc.timeline.stages[1].time = 24;
  doc.timeline.stages[0].id = 's36b'; doc.timeline.stages[1].id = 's24b';
  const before = doc.timeline.stages.map(s => s.time);
  const order = checkTimelineOrder(doc.timeline);
  const r = read(doc);

  check('an out-of-order timeline is reported',
    f(order.violations.length === 1 && order.ok === false, !(order.violations.length === 1 && order.ok === false)), JSON.stringify(order.violations));
  check('checkTimelineOrder returns the offending pair',
    f(order.offending_pair?.earlier?.time === 36 && order.offending_pair?.later?.time === 24,
      !(order.offending_pair?.earlier?.time === 36 && order.offending_pair?.later?.time === 24)), JSON.stringify(order.offending_pair));
  check('the timeline is NOT silently sorted (returned order unchanged)',
    f(order.ids_in_file_order.join(',') === 's36b,s24b', order.ids_in_file_order.join(',') !== 's36b,s24b'), order.ids_in_file_order.join(','));
  check('the timeline is NOT sorted in place either',
    f(doc.timeline.stages.map(s => s.time).join(',') === before.join(','),
      doc.timeline.stages.map(s => s.time).join(',') !== before.join(',')), doc.timeline.stages.map(s => s.time).join(','));
  check('an out-of-order timeline is refused, with the pair attached',
    f(r.status === 'refused' && r.problems.some(p => p.not_sorted === true && p.offending_pair),
      !(r.status === 'refused' && r.problems.some(p => p.not_sorted === true && p.offending_pair))), r.headline);
}
{
  const doc = GOOD();
  doc.timeline.stages[1].time = 24; // equal times: two stages at one instant
  const order = checkTimelineOrder(doc.timeline);
  check('equal stage times are not "strictly increasing"',
    f(order.ok === false && /both at 24 hpf/.test(order.offending_pair.why), !(order.ok === false && /both at 24 hpf/.test(order.offending_pair.why))), JSON.stringify(order.offending_pair?.why));
}
{
  const one = [{ id: 's24', name: 'prim-5', time: 24, time_unit: 'hpf', temperature_C: 28.5 }];
  const order = checkTimelineOrder(one);
  check('one stage means no ordering constraint was applied, and that is not a pass',
    f(order.nothing_checked === true && order.ok === null && order.comparisons === 0,
      !(order.nothing_checked === true && order.ok === null && order.comparisons === 0)), JSON.stringify({ ok: order.ok, n: order.comparisons }));
}
{
  const order = checkTimelineOrder('not a timeline');
  check('checkTimelineOrder on a non-array reports nothing-checked rather than throwing',
    f(order.nothing_checked === true && order.ok === null, !(order.nothing_checked === true && order.ok === null)));
}

// ===================================================================================================
// 5. degraded is not a pass
// ===================================================================================================
{
  // No stage has measured geometry: every mesh this file exports is a depiction.
  const doc = GOOD();
  doc.timeline.stages[0].geometry.provenance = stamp('depicted', { scope: 'drawn so the trajectory can be rendered; never to be read as data' });
  for (const c of doc.timeline.stages[0].geometry.cells) {
    for (const k of Object.keys(c.channels)) c.channels[k].provenance = stamp('assumed');
  }
  const r = read(doc);
  check('a file with zero measured geometry is degraded, not ok',
    f(r.status === 'degraded', r.status !== 'degraded'), r.headline);
  check('degraded is not a pass: the result says so in usable',
    f(r.status !== 'ok' && typeof r.usable.and_it_is_degraded === 'string', !(r.status !== 'ok' && typeof r.usable.and_it_is_degraded === 'string')));
  check('degraded still returns a usable life and names the degradations',
    f(r.life !== null && r.degradations.length > 0, !(r.life !== null && r.degradations.length > 0)), `${r.degradations.length} degradation(s)`);
  check('rendering a degraded file as evidence is refused by usableFor',
    f(usableFor(r, 'compare_to_a_real_organism').excluded_kinds.includes('depicted'),
      !usableFor(r, 'compare_to_a_real_organism').excluded_kinds.includes('depicted')));
}
{
  const doc = GOOD(); doc.not_established = doc.not_established.slice(0, 2);
  const r = read(doc);
  check('not_established missing a minimum entry is degraded',
    f(r.status === 'degraded' && r.degradations.some(d => d.field === 'not_established'),
      !(r.status === 'degraded' && r.degradations.some(d => d.field === 'not_established'))), r.headline);
  check('the degradation names which minimum entries are missing',
    f((r.degradations.find(d => d.field === 'not_established')?.missing ?? []).length === 2,
      (r.degradations.find(d => d.field === 'not_established')?.missing ?? []).length !== 2));
}

// ===================================================================================================
// 6. channel coverage - counts, not booleans
// ===================================================================================================
{
  const doc = GOOD(); doc.channels_declared = ['geometry', 'mechanics', 'lineage', 'transcriptome'];
  const cov = channelCoverage(doc);
  const r = read(doc);
  check('channelCoverage returns counts, not booleans',
    f(typeof cov.channels.geometry.cells_measured === 'number' && typeof cov.channels.geometry.stages_measured === 'number',
      !(typeof cov.channels.geometry.cells_measured === 'number' && typeof cov.channels.geometry.stages_measured === 'number')));
  check('geometry: measured on 2 of 4 cells across 1 of 2 stages',
    f(cov.channels.geometry.cells_measured === 2 && cov.channels.geometry.cells_total === 4 && cov.channels.geometry.stages_measured === 1,
      !(cov.channels.geometry.cells_measured === 2 && cov.channels.geometry.cells_total === 4 && cov.channels.geometry.stages_measured === 1)),
    cov.channels.geometry.headline);
  check('mechanics: present on 3 of 4 cells, measured on 2',
    f(cov.channels.mechanics.cells_present === 3 && cov.channels.mechanics.cells_measured === 2,
      !(cov.channels.mechanics.cells_present === 3 && cov.channels.mechanics.cells_measured === 2)), cov.channels.mechanics.headline);
  check('a declared-but-absent channel reports 0, not false',
    f(cov.channels.transcriptome.declared === true && cov.channels.transcriptome.cells_present === 0 && cov.channels.transcriptome.cells_measured === 0,
      !(cov.channels.transcriptome.declared === true && cov.channels.transcriptome.cells_present === 0 && cov.channels.transcriptome.cells_measured === 0)),
    cov.channels.transcriptome.headline);
  check('a channel declared and present on zero cells degrades the file',
    f(r.status === 'degraded' && cov.declared_but_absent.join() === 'transcriptome',
      !(r.status === 'degraded' && cov.declared_but_absent.join() === 'transcriptome')), r.headline);
}
{
  // declared, present, and measured on nothing: the "3 of 400 cells" case, at four cells.
  const doc = GOOD();
  for (const s of doc.timeline.stages) for (const c of s.geometry.cells) if (c.channels.lineage) c.channels.lineage.provenance = stamp('assumed');
  const cov = channelCoverage(doc);
  check('present is not measured: a channel of guesses reports cells_measured 0',
    f(cov.channels.lineage.cells_present === 1 && cov.channels.lineage.cells_measured === 0,
      !(cov.channels.lineage.cells_present === 1 && cov.channels.lineage.cells_measured === 0)), cov.channels.lineage.headline);
  check('a declared channel measured on no cell degrades the file',
    f(read(doc).status === 'degraded' && cov.declared_but_unmeasured.join() === 'lineage',
      !(read(doc).status === 'degraded' && cov.declared_but_unmeasured.join() === 'lineage')));
}
{
  const doc = GOOD(); for (const s of doc.timeline.stages) s.geometry.cells = [];
  const cov = channelCoverage(doc);
  check('no cells at all means nothing was counted, which is not full coverage',
    f(cov.nothing_checked === true && cov.cells_total === 0 && read(doc).status !== 'ok',
      !(cov.nothing_checked === true && cov.cells_total === 0 && read(doc).status !== 'ok')));
}

// ===================================================================================================
// 7. the provenance census
// ===================================================================================================
{
  const doc = GOOD();
  const c = provenanceCensus(doc);
  check(`provenanceCensus totals the ${GOOD_VALUES} values in the fixture`,
    f(c.total === GOOD_VALUES, c.total !== GOOD_VALUES), `got ${c.total}: ${c.paths.join(' ')}`);
  check('the by_kind counts sum to the total',
    f(Object.values(c.by_kind).reduce((a, b) => a + b, 0) === c.total, Object.values(c.by_kind).reduce((a, b) => a + b, 0) !== c.total));
  check('the census line reads like the .organism one',
    f(c.line === GOOD_CENSUS_LINE, c.line !== GOOD_CENSUS_LINE), c.line);
  check('the census splits data from not-data',
    f(c.may_be_treated_as_data === 7 && c.may_not_be_treated_as_data === 4,
      !(c.may_be_treated_as_data === 7 && c.may_not_be_treated_as_data === 4)),
    `${c.may_be_treated_as_data} data / ${c.may_not_be_treated_as_data} not`);
  check('a file with no provenance at all reports nothing_counted, not a clean census',
    f(provenanceCensus({ format: SPEC.FORMAT }).nothing_counted === true, provenanceCensus({ format: SPEC.FORMAT }).nothing_counted !== true));
}
{
  const doc = GOOD();
  doc.timeline.stages[0].geometry.cells[0].channels.mechanics.provenance = { kind: 'vibes', source: 'x', scope: 'this is a long enough scope string' };
  const r = read(doc);
  check('a kind outside the vocabulary degrades the file rather than being counted as one',
    f(r.status === 'degraded' && provenanceCensus(doc).unrecognised_kinds.length === 1,
      !(r.status === 'degraded' && provenanceCensus(doc).unrecognised_kinds.length === 1)), r.headline);
}
{
  const doc = GOOD();
  delete doc.timeline.stages[0].geometry.cells[0].channels.geometry.provenance.source;
  const r = read(doc);
  check('a measured value with no source degrades the file',
    f(r.status === 'degraded' && provenanceCensus(doc).missing_source.length === 1,
      !(r.status === 'degraded' && provenanceCensus(doc).missing_source.length === 1)), r.headline);
}

// ===================================================================================================
// 8. summary
// ===================================================================================================
{
  const doc = GOOD();
  const s = summary(doc);
  check('summary says how many stages were observed and how many filled in',
    f(/2 stage\(s\): 1 observed, 1 filled in/.test(s), !/2 stage\(s\): 1 observed, 1 filled in/.test(s)), s.split('\n')[0]);
  check('summary carries the provenance census line',
    f(s.includes(GOOD_CENSUS_LINE), !s.includes(GOOD_CENSUS_LINE)));
  check('summary says what the file cannot be used for',
    f(/It cannot be used for:/.test(s) && /not assert that it is enough to simulate/.test(s),
      !(/It cannot be used for:/.test(s) && /not assert that it is enough to simulate/.test(s))));
  check('summary names the per-channel counts rather than a boolean',
    f(/geometry: measured on 2 of 4 cells/.test(s), !/geometry: measured on 2 of 4 cells/.test(s)));
  check('summary on a file with no timeline does not throw',
    f(/describes no trajectory/.test(summary({ format: SPEC.FORMAT })), !/describes no trajectory/.test(summary({ format: SPEC.FORMAT }))));
}

// ===================================================================================================
// 9. usableFor
// ===================================================================================================
{
  const r = read(GOOD());
  check('usableFor refuses every purpose on a refused file',
    f(usableFor(read({ format: 'nope' }), 'render').allowed === false, usableFor(read({ format: 'nope' }), 'render').allowed !== false));
  check('usableFor("publish_a_number") excludes everything that is not measured',
    f(usableFor(r, 'publish_a_number').n_excluded === 7, usableFor(r, 'publish_a_number').n_excluded !== 7),
    `excluded ${usableFor(r, 'publish_a_number').n_excluded}: ${usableFor(r, 'publish_a_number').excluded_kinds.join(', ')}`);
  check('usable names the stages whose mesh may be used as evidence',
    f(/only for the 1 stage/.test(r.usable.rendering_as_evidence), !/only for the 1 stage/.test(r.usable.rendering_as_evidence)), r.usable.rendering_as_evidence);
}

// ===================================================================================================
console.log(`\n  ${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: 0 passed is the correct result)' : ''}\n`);
process.exit(fail && !FAULT ? 1 : 0);
