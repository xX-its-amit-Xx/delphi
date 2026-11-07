#!/usr/bin/env node
// Tests for provenance.mjs
//
//   node sim-engine/scales/molecular/test-provenance.mjs [--fail-once]
//
// Five things are checked harder than the rest, because they are the five ways this module could do
// damage rather than merely be wrong.
//
//   1. cite() IS TESTED IN BOTH DIRECTIONS, FOR EVERY KIND. For each kind, a complete record must PASS,
//      and each required field removed ONE AT A TIME must throw with a message that NAMES THAT FIELD.
//      Asserting only the throws would pass for `function cite() { throw new Error('no') }`, which is
//      the single easiest way to ship a validator that is really a wall. Asserting only the pass would
//      pass for a validator that does nothing. Both, per field, per kind, or neither is worth anything.
//      The required-field list is read from KINDS[kind].requires at runtime, not retyped here, so a
//      field added to the vocabulary is automatically covered and a field removed cannot leave a stale
//      assertion behind.
//
//   2. THE MESSAGE NAMES THE FIELD. A throw whose message does not contain the requirement path sends
//      the reader to read provenance.mjs instead of fixing their record. So the assertion is on the
//      message text, not merely on the fact of throwing.
//
//   3. A DEPICTION MAY NOT CARRY A NUMBER. This is the one semantic rule that stops the specific
//      failure the module exists for: a number drawn at an invented position gets read off the screen
//      and quoted, and the DEPICTED label travels with the position rather than with the number.
//
//   4. THE GATE BLOCKS, AND THE HOLE DOES NOT. audit() must return publishable=false when any claim
//      fails cite(), and publishable=true for a set containing a well-formed NOT_ESTABLISHED claim -
//      asserted separately, because a gate that blocks on both is a gate that makes the honest record
//      more expensive than quietly dropping the row.
//
//   5. THE SHIPPED EXAMPLES PASS THEIR OWN GATE. VERIFIED_EXAMPLES is the seed set the viewer will
//      render. Every entry goes through cite() and chip(), and every MEASURED entry must name an
//      organism and carry verified_how, because an example that fails the rule teaches the rule wrong.
//
// Plus the holdout check, which reads the project's own roster at runtime rather than carrying a list.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own inversion asserts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from './provenance.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

const threw = (fn) => { try { fn(); return { threw: false, message: '' }; } catch (e) { return { threw: true, message: String(e.message) }; } };
const clone = (o) => structuredClone(o);
/** Remove a dotted path, creating nothing. Used to knock out exactly one required field. */
const unset = (obj, dotted) => {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur === null || typeof cur !== 'object') return obj;
    cur = cur[parts[i]];
  }
  if (cur && typeof cur === 'object') delete cur[parts[parts.length - 1]];
  return obj;
};

// ------------------------------------------------------------------ complete fixtures, one per kind
// Each is deliberately MINIMAL-but-complete: exactly the required fields plus nothing that could be
// masking a missing one. A fixture padded with optional fields can hide a requirement that is never
// actually enforced.
const COMPLETE = {
  MEASURED: {
    id: 'fixture.measured',
    kind: 'MEASURED',
    statement: 'A rate measured in a named cell type.',
    organism: 'Mus musculus',
    what_was_measured: 'the position of a transcription wave over a time course',
    source: { doi: '10.7554/eLife.02407', pmid: 24843027 },
    verified_how: 'fixture: the DOI and PMID here are the ones retrieved for rate.pol2_elongation.mouse_es.',
  },
  DATABASE_RECORD: {
    id: 'fixture.database_record',
    kind: 'DATABASE_RECORD',
    statement: 'A record in a named service.',
    service: 'RCSB_PDB',
    accession: '1KX5',
    retrieved: '2026-11-07',
    verified_how: 'fixture: 1KX5 was fetched from data.rcsb.org in the session that wrote this file.',
  },
  TOOL_OUTPUT: {
    id: 'fixture.tool_output',
    kind: 'TOOL_OUTPUT',
    statement: 'Something a named program at a named version produced.',
    tool: 'delphisci benchmarks/retro-validation/structure.mjs',
    tool_version: '19310 bytes, sha256 cb49e827c150a2cc...',
    what_it_produced: 'per-residue solvent-accessible areas',
    verified_how: 'fixture: the tool was run on 1CRN in the session that wrote this file.',
  },
  DERIVED: {
    id: 'fixture.derived',
    kind: 'DERIVED',
    statement: 'A quantity computed here from two sourced inputs.',
    formula: 'box_edge_angstrom = voxel_spacing_angstrom * voxels_per_edge',
    inputs: ['emdb.emd-2938.voxel_spacing', 'emdb.emd-2938.box_voxels'],
  },
  DEPICTED: {
    id: 'fixture.depicted',
    kind: 'DEPICTED',
    statement: 'The positions of the drawn objects.',
    standing_in_for: 'the instantaneous arrangement of those objects in one cell, which is not measured',
    invented: 'every coordinate and every rotation, from a layout function',
  },
  NOT_ESTABLISHED: {
    id: 'fixture.not_established',
    kind: 'NOT_ESTABLISHED',
    statement: 'A quantity we could not source.',
    null_reason: 'no primary measurement was retrieved in this session',
    where_we_looked: 'three PubMed searches, listed in the claim this fixture is modelled on',
    what_would_resolve_it: 'an absolute-quantification measurement in a named cell type at a named growth state',
  },
};

// ------------------------------------------------------------------ 1+2. cite(), both directions, every kind
console.log('\ncite(): every kind passes complete, and throws naming each missing field');
{
  check('the fixture set covers every kind in the closed vocabulary',
    f(P.KIND_NAMES.every(k => COMPLETE[k]) && Object.keys(COMPLETE).length === P.KIND_NAMES.length, false),
    `${Object.keys(COMPLETE).length} fixtures for ${P.KIND_NAMES.length} kinds`);

  for (const kind of P.KIND_NAMES) {
    const complete = COMPLETE[kind];
    // (a) the complete record PASSES. Without this, every throw assertion below is satisfied by a
    //     function that throws unconditionally.
    const ok = threw(() => P.cite(complete));
    check(`${kind}: a complete record passes cite()`, f(!ok.threw, ok.threw), ok.message);

    // (b) each required field, removed alone, throws WITH ITS NAME in the message.
    for (const req of P.KINDS[kind].requires) {
      const broken = clone(complete);
      for (const alt of req.split('|')) unset(broken, alt);
      const r = threw(() => P.cite(broken));
      check(`${kind}: missing "${req}" throws, and the message names it`,
        f(r.threw && r.message.includes(req), !(r.threw && r.message.includes(req))),
        r.threw ? `message: ${r.message.slice(0, 120)}` : 'it did not throw at all');
    }
  }

  // Alternatives really are alternatives: one of the pair is enough.
  const onlyDoi = clone(COMPLETE.MEASURED); delete onlyDoi.source.pmid;
  const onlyPmid = clone(COMPLETE.MEASURED); delete onlyPmid.source.doi;
  check('MEASURED passes with a DOI and no PMID', f(!threw(() => P.cite(onlyDoi)).threw, threw(() => P.cite(onlyDoi)).threw));
  check('MEASURED passes with a PMID and no DOI', f(!threw(() => P.cite(onlyPmid)).threw, threw(() => P.cite(onlyPmid)).threw));

  // A field present but EMPTY is absent. This is how a provenance field becomes decorative: a template
  // fills it with '' and nobody ever answers it.
  for (const [label, blank] of [['an empty string', ''], ['whitespace', '   '], ['an empty array', []], ['null', null]]) {
    const b = clone(COMPLETE.MEASURED); b.organism = blank;
    const r = threw(() => P.cite(b));
    check(`a required field that is ${label} is treated as missing, not as filled in`,
      f(r.threw && r.message.includes('organism'), !(r.threw && r.message.includes('organism'))),
      r.threw ? r.message.slice(0, 100) : 'it passed');
  }

  // kind itself
  check('a missing "kind" throws naming kind',
    f(threw(() => P.cite({ id: 'x', statement: 'y' })).message.includes('"kind"'), false));
  check('a kind outside the closed vocabulary is refused by name',
    f(threw(() => P.cite({ ...COMPLETE.MEASURED, kind: 'PROBABLY_FINE' })).message.includes('PROBABLY_FINE'), false));
  for (const [label, bad] of [['null', null], ['a string', 'MEASURED'], ['an array', []], ['undefined', undefined]]) {
    const r = threw(() => P.cite(bad));
    check(`a claim that is ${label} is refused rather than crashing on a property read`, f(r.threw, !r.threw), r.message.slice(0, 90));
  }
  check('cite() returns a deep-frozen copy, so a validated claim cannot be edited afterwards',
    f(Object.isFrozen(P.cite(COMPLETE.MEASURED)) && Object.isFrozen(P.cite(COMPLETE.MEASURED).source), false));
  check('the returned object is a COPY: freezing it does not freeze the caller\'s input',
    f(!Object.isFrozen(COMPLETE.MEASURED), Object.isFrozen(COMPLETE.MEASURED)));
}

// ------------------------------------------------------------------ per-kind semantic rules
console.log('\nthe rules presence alone cannot express');
{
  // DATABASE_RECORD: the service has to be one we know how to resolve, and the date has to be a date.
  const svcBad = { ...COMPLETE.DATABASE_RECORD, service: 'SOME_DATABASE' };
  check('an unknown service is refused, naming the field and listing the known ones',
    f(threw(() => P.cite(svcBad)).message.includes('"service"'), false),
    threw(() => P.cite(svcBad)).message.slice(0, 110));
  for (const [label, bad] of [['a year only', '2026'], ['a prose date', 'last Tuesday'], ['a number', 20261107], ['a malformed ISO', '2026-13-45x']]) {
    const b = { ...COMPLETE.DATABASE_RECORD, retrieved: bad };
    const r = threw(() => P.cite(b));
    check(`a retrieval date that is ${label} is refused, naming "retrieved"`,
      f(r.threw && r.message.includes('retrieved'), !(r.threw && r.message.includes('retrieved'))),
      r.threw ? r.message.slice(0, 100) : 'it passed');
  }
  check('a full ISO timestamp is accepted as a retrieval date',
    f(!threw(() => P.cite({ ...COMPLETE.DATABASE_RECORD, retrieved: '2026-11-07T14:38:00.000Z' })).threw, false));

  // DERIVED: inputs must be claim ids, not a description of inputs.
  for (const [label, bad] of [['a string', 'two EMDB records'], ['a number', 2], ['an array with an empty string', ['a', '']], ['an array of objects', [{ id: 'a' }]]]) {
    const b = { ...COMPLETE.DERIVED, inputs: bad };
    const r = threw(() => P.cite(b));
    check(`DERIVED inputs given as ${label} are refused, naming "inputs"`,
      f(r.threw && r.message.includes('inputs'), !(r.threw && r.message.includes('inputs'))),
      r.threw ? r.message.slice(0, 100) : 'it passed');
  }

  // 3. A DEPICTION MAY NOT CARRY A NUMBER.
  const depictedWithNumber = { ...COMPLETE.DEPICTED, value: { value: 412, units: 'nm' } };
  const r3 = threw(() => P.cite(depictedWithNumber));
  check('a DEPICTED claim carrying a number is refused, naming "value"',
    f(r3.threw && r3.message.includes('"value"'), !(r3.threw && r3.message.includes('"value"'))),
    r3.threw ? r3.message.slice(0, 140) : 'it passed, which is the failure this module exists to stop');
  // The other direction, and the fault here is a WRONG-VALUE substitution rather than an inversion: under
  // --fail-once the number-carrying depiction is fed in, which must throw and so must fail this line.
  check('a DEPICTED claim with no value at all passes',
    !threw(() => P.cite(f(COMPLETE.DEPICTED, depictedWithNumber))).threw);

  const notEstWithNumber = { ...COMPLETE.NOT_ESTABLISHED, value: { value: 10_000_000, units: 'ribosomes per cell' } };
  const r3b = threw(() => P.cite(notEstWithNumber));
  check('a NOT_ESTABLISHED claim carrying a number is refused: if a value was found, the kind is wrong',
    f(r3b.threw && r3b.message.includes('"value"'), !(r3b.threw && r3b.message.includes('"value"'))),
    r3b.threw ? r3b.message.slice(0, 120) : 'it passed');
  check('a NOT_ESTABLISHED claim may carry an explicit null value with a reason',
    f(!threw(() => P.cite({ ...COMPLETE.NOT_ESTABLISHED, value: { value: null, units: 'ribosomes per cell', null_reason: 'not retrieved', what_would_resolve_it: 'an absolute count' } })).threw, false));

  // the value record shape
  const vCases = [
    ['a bare number', { ...COMPLETE.MEASURED, value: 2.1 }, '"value"'],
    ['no units', { ...COMPLETE.MEASURED, value: { value: 2.1 } }, 'value.units'],
    ['a null with no reason', { ...COMPLETE.MEASURED, value: { value: null, units: 'kb/min' } }, 'value.null_reason'],
    ['a null with a reason but no remedy', { ...COMPLETE.MEASURED, value: { value: null, units: 'kb/min', null_reason: 'not retrieved' } }, 'value.what_would_resolve_it'],
    ['a string value', { ...COMPLETE.MEASURED, value: { value: 'about two', units: 'kb/min' } }, 'value.value'],
  ];
  for (const [label, bad, field] of vCases) {
    const r = threw(() => P.cite(bad));
    check(`a value given as ${label} is refused, naming ${field}`,
      f(r.threw && r.message.includes(field), !(r.threw && r.message.includes(field))),
      r.threw ? r.message.slice(0, 110) : 'it passed');
  }
  check('a value may be a RANGE, as [lo, hi], because that is how a disagreement is recorded',
    f(!threw(() => P.cite({ ...COMPLETE.MEASURED, value: { value: [0.5, 4], units: 'kb/min' } })).threw, false));
  check('a null value with both a reason and a remedy passes: a labelled null is worth more than a plausible number',
    f(!threw(() => P.cite({ ...COMPLETE.MEASURED, value: { value: null, units: 'kb/min', null_reason: 'not retrieved', what_would_resolve_it: 'a measurement in this cell type' } })).threw, false));
}

// ------------------------------------------------------------------ the vocabulary itself
console.log('\nthe closed vocabulary');
{
  check('all six kinds are present',
    f(['MEASURED', 'DATABASE_RECORD', 'TOOL_OUTPUT', 'DERIVED', 'DEPICTED', 'NOT_ESTABLISHED'].every(k => P.KINDS[k]), false),
    P.KIND_NAMES.join(', '));
  check('every kind has a one-line definition and a display label',
    f(P.KIND_NAMES.every(k => typeof P.KINDS[k].definition === 'string' && P.KINDS[k].definition.length > 30 && typeof P.KINDS[k].label === 'string' && P.KINDS[k].label.length > 0), false));
  check('every kind declares its own required fields, and every list is non-empty',
    f(P.KIND_NAMES.every(k => Array.isArray(P.KINDS[k].requires) && P.KINDS[k].requires.length >= 3), false));
  check('DEPICTED is the only kind flagged as depiction',
    f(P.KIND_NAMES.filter(k => P.KINDS[k].is_depiction).join(',') === 'DEPICTED', false),
    P.KIND_NAMES.filter(k => P.KINDS[k].is_depiction).join(','));
  check('DEPICTED and NOT_ESTABLISHED carry no evidential weight; the other four do',
    f(P.KINDS.DEPICTED.evidential === false && P.KINDS.NOT_ESTABLISHED.evidential === false &&
      ['MEASURED', 'DATABASE_RECORD', 'TOOL_OUTPUT', 'DERIVED'].every(k => P.KINDS[k].evidential === true), false));
  check('the vocabulary and the service list are deep-frozen',
    f(Object.isFrozen(P.KINDS) && Object.isFrozen(P.KINDS.MEASURED) && Object.isFrozen(P.KINDS.MEASURED.requires) && Object.isFrozen(P.SERVICES) && Object.isFrozen(P.SERVICES.RCSB_PDB), false));
  check('every MEASURED-style kind that claims a retrieval requires verified_how',
    f(['MEASURED', 'DATABASE_RECORD', 'TOOL_OUTPUT'].every(k => P.KINDS[k].requires.includes('verified_how')), false));
  check('DEPICTED requires that it say what it stands in for, and what exactly was invented',
    f(P.KINDS.DEPICTED.requires.includes('standing_in_for') && P.KINDS.DEPICTED.requires.includes('invented'), false));
  check('NOT_ESTABLISHED requires where we looked, not just that we failed',
    f(P.KINDS.NOT_ESTABLISHED.requires.includes('where_we_looked') && P.KINDS.NOT_ESTABLISHED.requires.includes('what_would_resolve_it'), false));
}

// ------------------------------------------------------------------ 4. audit(): the gate blocks, the hole does not
console.log('\naudit()');
{
  const good = [COMPLETE.MEASURED, COMPLETE.DATABASE_RECORD, COMPLETE.DEPICTED];
  const a = P.audit(good);
  check('a set of complete claims is publishable', f(a.publishable, !a.publishable), JSON.stringify(a.why_not).slice(0, 90));
  check('counts are reported per kind, with zeros for the kinds not used',
    f(a.by_kind.MEASURED === 1 && a.by_kind.DATABASE_RECORD === 1 && a.by_kind.DEPICTED === 1 && a.by_kind.TOOL_OUTPUT === 0 && a.by_kind.DERIVED === 0, false),
    JSON.stringify(a.by_kind));
  check('every kind appears as a key even at zero, so a UI does not have to guess the vocabulary',
    f(P.KIND_NAMES.every(k => Object.hasOwn(a.by_kind, k)), false));

  const withBroken = [...good, { id: 'oops', kind: 'MEASURED', statement: 'a rate', organism: 'Mus musculus', what_was_measured: 'something' }];
  const b = P.audit(withBroken);
  check('one incomplete claim makes the whole set unpublishable', f(b.publishable === false, b.publishable === true));
  check('the unsourced claim is listed by id and index with the reason',
    f(b.unsourced.length === 1 && b.unsourced[0].id === 'oops' && b.unsourced[0].index === 3 && /source\.doi/.test(b.unsourced[0].error), false),
    JSON.stringify(b.unsourced).slice(0, 150));
  check('why_not carries the error messages, not a count',
    f(Array.isArray(b.why_not) && b.why_not.length === 1 && b.why_not[0].includes('source.doi'), false));

  // the hole does NOT block. Asserted separately from the block, because a gate that blocks on both
  // makes the honest record more expensive than quietly dropping the row.
  const withHole = [...good, COMPLETE.NOT_ESTABLISHED];
  const h = P.audit(withHole);
  check('a well-formed NOT_ESTABLISHED claim does NOT make the set unpublishable',
    f(h.publishable === true, h.publishable === false), JSON.stringify(h.why_not).slice(0, 90));
  check('the hole is reported separately so a view can show it',
    f(h.holes.length === 1 && h.holes[0].id === 'fixture.not_established', false), JSON.stringify(h.holes).slice(0, 110));
  check('the strict reading is available without this file deciding for the caller',
    f(h.publishable_with_no_holes === false && P.audit(good).publishable_with_no_holes === true, false),
    `with hole ${h.publishable_with_no_holes}, without ${P.audit(good).publishable_with_no_holes}`);

  const weird = P.audit([{ id: 'u', kind: 'VIBES', statement: 'x' }]);
  check('an unknown kind is counted separately AND listed as unsourced',
    f(weird.unknown_kind.length === 1 && weird.unsourced.length === 1 && weird.publishable === false, false),
    JSON.stringify(weird.unknown_kind));
  check('an empty set is publishable and reports zero of everything',
    f(P.audit([]).publishable === true && P.audit([]).total === 0 && P.audit([]).by_kind.MEASURED === 0, false));
  for (const [label, bad] of [['null', null], ['an object', {}], ['a string', 'claims']]) {
    check(`audit(${label}) refuses rather than iterating nothing and reporting success`,
      f(threw(() => P.audit(bad)).threw, !threw(() => P.audit(bad)).threw));
  }
  check('audit does NOT return a single fused provenance score',
    f(!Object.keys(P.audit(good)).some(k => /score|quality|confidence|grade/i.test(k)), false),
    Object.keys(P.audit(good)).join(','));
}

// ------------------------------------------------------------------ share()
console.log('\nshare()');
{
  const mk = (n, kind) => Array.from({ length: n }, (_, i) => ({ ...COMPLETE[kind], id: `${kind}.${i}` }));
  const half = [...mk(2, 'DEPICTED'), ...mk(2, 'MEASURED')];
  const s = P.share(half);
  check('the depicted fraction is a count over a count', f(s.depicted === 2 && s.total === 4 && s.fraction === 0.5, false),
    `${s.depicted}/${s.total} = ${s.fraction}`);
  check('exactly half is NOT "mostly depicted"', f(s.mostly_depicted === false, s.mostly_depicted === true));
  const mostly = [...mk(3, 'DEPICTED'), ...mk(1, 'MEASURED')];
  check('three quarters IS "mostly depicted", which is the flag that moves the disclosure above the fold',
    f(P.share(mostly).mostly_depicted === true, false), `fraction ${P.share(mostly).fraction}`);
  check('any depiction at all sets say_at_top', f(P.share([...mk(1, 'DEPICTED'), ...mk(99, 'MEASURED')]).say_at_top === true, false));
  check('a view with no depiction does not set say_at_top, and says so in the headline',
    f(P.share(mk(3, 'MEASURED')).say_at_top === false && /Nothing in this view is depicted/.test(P.share(mk(3, 'MEASURED')).headline), false));
  check('the headline names the numerator and the denominator rather than just a number',
    f(/3 of 4 elements/.test(P.share(mostly).headline), false), P.share(mostly).headline.slice(0, 80));
  check('an empty view has a null fraction, not a 0 that reads as "no depiction here"',
    f(P.share([]).fraction === null && P.share([]).total === 0, P.share([]).fraction === 0));
  for (const [label, bad] of [['null', null], ['an object', {}]]) {
    check(`share(${label}) refuses rather than returning 0`, f(threw(() => P.share(bad)).threw, !threw(() => P.share(bad)).threw));
  }
}

// ------------------------------------------------------------------ chip()
console.log('\nchip()');
{
  const c = P.chip(COMPLETE.MEASURED);
  check('a badge is plain data with exactly label, kind, href and title',
    f(Object.keys(c).sort().join(',') === 'href,kind,label,title', false), Object.keys(c).sort().join(','));
  check('a MEASURED badge resolves to a DOI URL',
    f(c.href === 'https://doi.org/10.7554/eLife.02407', false), String(c.href));
  const pmidOnly = clone(COMPLETE.MEASURED); delete pmidOnly.source.doi;
  check('with no DOI, a MEASURED badge falls back to the PubMed record URL',
    f(P.chip(pmidOnly).href === 'https://pubmed.ncbi.nlm.nih.gov/24843027/', false), String(P.chip(pmidOnly).href));
  check('a DATABASE_RECORD badge resolves to the service record URL with the accession substituted',
    f(P.chip(COMPLETE.DATABASE_RECORD).href === 'https://www.rcsb.org/structure/1KX5', false),
    String(P.chip(COMPLETE.DATABASE_RECORD).href));
  check('a service whose record URL was never confirmed gets a NULL href, not a link nobody has opened',
    f(P.chip({ ...COMPLETE.DATABASE_RECORD, service: 'EMDB', accession: 'EMD-2938' }).href === null, false),
    String(P.chip({ ...COMPLETE.DATABASE_RECORD, service: 'EMDB', accession: 'EMD-2938' }).href));
  check('ENSEMBL also gets a null href, because rest.ensembl.org never answered',
    f(P.SERVICES.ENSEMBL.url_confirmed === false && P.SERVICES.ENSEMBL.record_url === null &&
      P.chip({ ...COMPLETE.DATABASE_RECORD, service: 'ENSEMBL', accession: 'ENSG00000181222' }).href === null, false));
  check('a service marked unconfirmed says WHY it is unconfirmed',
    f(Object.values(P.SERVICES).filter(s => !s.url_confirmed).every(s => typeof s.url_unconfirmed_reason === 'string' && s.url_unconfirmed_reason.length > 30), false));
  check('every service entry carries verified_how',
    f(Object.values(P.SERVICES).every(s => typeof s.verified_how === 'string' && s.verified_how.length > 40), false));
  check('a DEPICTED badge has no href and its hover text says the position was invented',
    f(P.chip(COMPLETE.DEPICTED).href === null && /Invented for the drawing/.test(P.chip(COMPLETE.DEPICTED).title) && /No evidential weight/.test(P.chip(COMPLETE.DEPICTED).title), false),
    P.chip(COMPLETE.DEPICTED).title.slice(0, 90));
  check('a DERIVED badge names the formula and its inputs in the hover text',
    f(/box_edge_angstrom/.test(P.chip(COMPLETE.DERIVED).title) && /emdb\.emd-2938\.voxel_spacing/.test(P.chip(COMPLETE.DERIVED).title), false));
  check('a TOOL_OUTPUT badge says the tool is the source, not a measurement',
    f(/The tool is the source, not a measurement/.test(P.chip(COMPLETE.TOOL_OUTPUT).title), false));
  check('a NOT_ESTABLISHED badge carries where we looked and what would resolve it',
    f(/Looked in:/.test(P.chip(COMPLETE.NOT_ESTABLISHED).title) && /Would be resolved by:/.test(P.chip(COMPLETE.NOT_ESTABLISHED).title), false));
  check('an incomplete claim gets NO badge at all: chip() throws rather than rendering a blank one',
    f(threw(() => P.chip({ id: 'x', kind: 'MEASURED', statement: 'y' })).threw, false));
  check('a badge contains no HTML and no styling',
    f(!/[<>]|class=|style=|#[0-9a-f]{6}/i.test(JSON.stringify(P.chip(COMPLETE.MEASURED))), false),
    JSON.stringify(P.chip(COMPLETE.MEASURED)).slice(0, 110));
  check('the badge label is the kind\'s display label, not the kind constant',
    f(c.label === P.KINDS.MEASURED.label && c.label !== 'MEASURED', false), c.label);
}

// ------------------------------------------------------------------ 5. the shipped examples pass their own gate
console.log('\nthe shipped examples');
{
  const E = P.VERIFIED_EXAMPLES;
  const errors = E.map((e, i) => ({ i, id: e.id, ...P.check(e) })).filter(r => !r.ok);
  check('every shipped example passes cite()', f(errors.length === 0, errors.length > 0),
    errors.length ? `${errors.length} failed, first: ${errors[0].id} - ${errors[0].error?.slice(0, 110)}` : `${E.length} examples`);
  check('every shipped example produces a badge', f(E.every(e => threw(() => P.chip(e)).threw === false), false));
  check('the example set is publishable and has at least one labelled hole, so both paths are exercised',
    f(P.audit(E).publishable === true && P.audit(E).holes.length >= 1, false),
    `publishable ${P.audit(E).publishable}, holes ${P.audit(E).holes.length}`);
  check('the example set exercises every kind in the vocabulary',
    f(P.KIND_NAMES.every(k => P.audit(E).by_kind[k] >= 1), false), JSON.stringify(P.audit(E).by_kind));
  check('every example that claims a retrieval carries verified_how naming a request and a read-back',
    f(E.filter(e => ['MEASURED', 'DATABASE_RECORD', 'TOOL_OUTPUT'].includes(e.kind))
      .every(e => /GET |MCP|fetch|Retrieved/i.test(e.verified_how) && /[Rr]ead back|returned|read off/.test(e.verified_how)), false));
  check('every MEASURED example names an organism and a cell type, because a number without them is not about anything',
    f(E.filter(e => e.kind === 'MEASURED').every(e => typeof e.organism === 'string' && e.organism.length > 2 && typeof e.cell_type === 'string' && e.cell_type.length > 2), false),
    E.filter(e => e.kind === 'MEASURED').map(e => e.organism).join(' | '));
  check('every DEPICTED example says what it stands in for and what exactly was invented',
    f(E.filter(e => e.kind === 'DEPICTED').every(e => e.standing_in_for.length > 30 && e.invented.length > 30), false));
  check('no DEPICTED example carries a number',
    f(E.filter(e => e.kind === 'DEPICTED').every(e => e.value === undefined), false));
  check('every DERIVED example names its formula and lists input ids that are present in the set',
    f(E.filter(e => e.kind === 'DERIVED').every(e => e.formula.includes('=') && e.inputs.every(i => E.some(x => x.id === i))), false));

  // THE DISAGREEMENT IS KEPT, NOT AVERAGED. Three retrieved Pol II elongation measurements span two
  // orders of magnitude. The honest record is three claims with their organisms and methods, not one
  // number. An averaged 18 kb/min would be a number no experiment supports.
  const rates = E.filter(e => e.id.startsWith('rate.pol2_elongation'));
  check('the Pol II elongation disagreement is recorded as separate measurements, not averaged into one',
    f(rates.length === 3, rates.length === 1), `${rates.length} separate rate claims`);
  check('the three rate claims name three different organism/cell-type contexts',
    f(new Set(rates.map(r => `${r.organism}|${r.cell_type}`)).size === 3, false),
    rates.map(r => r.cell_type.slice(0, 28)).join(' / '));
  check('the fast outlier is kept with its own source rather than dropped as an anomaly',
    f(rates.some(r => r.value.value === 50 && r.source.pmid === 22015688), false));
  check('the slow and fast claims disagree by more than an order of magnitude, and both are present',
    f(Math.max(...rates.map(r => Array.isArray(r.value.value) ? r.value.value[1] : r.value.value)) /
      Math.min(...rates.map(r => Array.isArray(r.value.value) ? r.value.value[0] : r.value.value)) > 10, false));

  // The per-cell machine count is a bacterial, stationary-phase number, and it says so.
  const ecoli = E.find(e => e.id === 'count.machines_per_cell.ecoli_stationary');
  check('the only per-cell machine count we could source carries an explicit organism warning',
    f(typeof ecoli.organism_warning === 'string' && /NOT a count for an animal cell/.test(ecoli.organism_warning), false));
  check('the mammalian ribosome count is a NOT_ESTABLISHED hole with the exact searches that failed',
    f(E.find(e => e.id === 'count.ribosomes_per_cell.mammalian_embryonic').kind === 'NOT_ESTABLISHED' &&
      /PubMed/.test(E.find(e => e.id === 'count.ribosomes_per_cell.mammalian_embryonic').where_we_looked), false));
  check('the derived ribosome size claim is labelled a BOUND, not a diameter',
    f(/BOUNDS/.test(E.find(e => e.id === 'derived.ribosome_box_bound').statement) &&
      /not a measurement of it/.test(E.find(e => e.id === 'derived.ribosome_box_bound').statement), false));
  check('the derived bound arithmetic is the one stated: 1.1 A/voxel x 300 voxels = 330 A',
    f(E.find(e => e.id === 'emdb.emd-2938.voxel_spacing').value.value *
      E.find(e => e.id === 'emdb.emd-2938.box_voxels').value.value ===
      E.find(e => e.id === 'derived.ribosome_box_bound').value.value, false),
    `${E.find(e => e.id === 'emdb.emd-2938.voxel_spacing').value.value} * ${E.find(e => e.id === 'emdb.emd-2938.box_voxels').value.value}`);
  check('the yeast polymerase structure is labelled as yeast and warns against relabelling it',
    f(/Saccharomyces cerevisiae/.test(E.find(e => e.id === 'pdb.1i6h.pol2').organism) &&
      /not a structure of a mammalian polymerase/.test(E.find(e => e.id === 'pdb.1i6h.pol2').verified_how), false));
}

// ------------------------------------------------------------------ the rule and the recorded lesson
console.log('\nthe rule and the recorded lesson');
{
  const R = P.THE_RULE;
  check('THE_RULE states why DEPICTED is first-class, what goes wrong without it, and the hard part',
    f(['one_line', 'why_it_is_first_class', 'what_goes_wrong_without_it', 'what_it_buys', 'the_hard_part', 'and_the_counts']
      .every(k => typeof R[k] === 'string' && R[k].length > 40), false));
  check('THE_RULE names the real alternative: not fewer inventions, but drawing nothing',
    f(/has to put the ribosome SOMEWHERE/.test(R.why_it_is_first_class), false));
  check('THE_RULE names the specific dishonesty a missing DEPICTED kind causes: a fake nearby citation',
    f(/nearest citation to hand/.test(R.what_goes_wrong_without_it), false));
  check('THE_RULE insists standing_in_for is the field people leave blank',
    f(/leave blank/.test(R.the_hard_part) && /decoration/.test(R.the_hard_part), false));

  const S = P.WHY_NOT_A_PROVENANCE_SCORE;
  check('the refusal to produce a fused provenance score is written down',
    f(['the_temptation', 'why_not', 'what_is_returned_instead', 'the_one_fraction'].every(k => typeof S[k] === 'string' && S[k].length > 40), false));
  check('it explains why share()\'s single fraction is not an exception',
    f(/one count over the total with its numerator named/.test(S.the_one_fraction), false));

  const G = P.THE_GUESSED_PMID;
  check('the guessed-identifier mistake is recorded with what happened and how it was caught',
    f(['what_happened', 'why_it_matters_more_than_an_ordinary_mistake', 'how_it_was_caught', 'the_general_lesson', 'what_changed_in_the_code']
      .every(k => typeof G[k] === 'string' && G[k].length > 60), false));
  check('the lesson is stated as the general rule, not as a one-off slip',
    f(/AN IDENTIFIER IS NOT EVIDENCE THAT IT IS THE RIGHT IDENTIFIER/.test(G.the_general_lesson), false));
  check('it records that the wrong identifiers all returned valid-looking records',
    f(/HTTP 200 with a title/.test(G.why_it_matters_more_than_an_ordinary_mistake), false));
  check('it says what changed in the code as a result',
    f(/verified_how/.test(G.what_changed_in_the_code), false));

  check('known limitations state that the gate checks filled-in, not true',
    f(P.KNOWN_LIMITATIONS.some(l => /not that it is TRUE/.test(l)), false), `${P.KNOWN_LIMITATIONS.length} limitations`);
  check('known limitations admit the dangling-input gap and the unresolved service URLs',
    f(P.KNOWN_LIMITATIONS.some(l => /dangling input/.test(l)) && P.KNOWN_LIMITATIONS.some(l => /503/.test(l)), false));
  check('known limitations name the NOT_ESTABLISHED judgement call as a judgement',
    f(P.KNOWN_LIMITATIONS.some(l => /judgement, not a derivation/.test(l)), false));
  check('the prose blocks and the limitation list are frozen',
    f(Object.isFrozen(P.THE_RULE) && Object.isFrozen(P.KNOWN_LIMITATIONS) && Object.isFrozen(P.THE_GUESSED_PMID) && Object.isFrozen(P.VERIFIED_EXAMPLES) && Object.isFrozen(P.VERIFIED_EXAMPLES[0]), false));
  check('worked() runs and reports the audit rather than a score',
    f(/publishable: true/.test(P.worked()) && !/score/i.test(P.worked()), false));
}

// ------------------------------------------------------------------ the holdout
console.log('\nthe holdout');
{
  // Read the SAME source the project's own leak checker reads (holdout/split.json, assignment
  // "holdout") rather than a path guessed here, and build the patterns from that.
  const splitPath = path.join(root, 'holdout/split.json');
  let terms = [], loadedFrom = null, loadError = null;
  try {
    const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    terms = (split.taxa ?? []).filter(t => t.assignment === 'holdout')
      .flatMap(t => [t.name, t.slug, t.latin, t.scientific_name, t.common_name, t.taxon].filter(x => typeof x === 'string'))
      .map(s => s.toLowerCase());
    loadedFrom = 'holdout/split.json (assignment === "holdout")';
  } catch (e) { loadError = String(e.message).slice(0, 90); }

  const src = (fs.readFileSync(path.join(here, 'provenance.mjs'), 'utf8') +
    fs.readFileSync(path.join(here, 'test-provenance.mjs'), 'utf8')).toLowerCase();
  const hits = [...new Set(terms)].filter(t => t.length > 4 && src.includes(t));
  check('the held-out roster was read from the project\'s own split file',
    f(terms.length > 20, terms.length === 0), loadedFrom ? `${terms.length} names from ${loadedFrom}` : `could not load: ${loadError}`);
  check('no held-out taxon name appears in this module or its test',
    f(hits.length === 0 && terms.length > 20, false),
    hits.length ? `${hits.length} hit(s): ${hits.slice(0, 3).join(', ')}` : `${new Set(terms).size} names checked`);
  const { spawnSync } = await import('node:child_process');
  const gate = spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), 'sim-engine/scales/molecular'], { cwd: root, encoding: 'utf8' });
  check('the project leak gate passes on this directory', f(gate.status === 0, gate.status !== 0),
    (gate.stdout ?? '').trim().split('\n').pop() ?? `exit ${gate.status}`);
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion should have failed)' : ''}`);
if (FAULT) {
  console.log(fail === pass + fail
    ? `all ${fail} assertions failed under their own fault: no survivors`
    : `SURVIVORS: ${pass} assertion(s) still passed with a fault injected - those assert nothing`);
}
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
