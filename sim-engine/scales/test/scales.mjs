#!/usr/bin/env node
// node sim-engine/scales/test/scales.mjs
//
// The scale layer. This layer draws a body and puts statements on it, so the thing it most easily becomes is
// a picture that implies more than anyone knows. Most of what is pinned here is the line it must not cross:
// a law is never shown as supporting a part it does not reach, a declared number never reads as measured, a
// construct never wears its donor's body, and anything the layer cannot place is REPORTED rather than drawn
// somewhere plausible.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scaleLadder, loadScaleData, frameFor, lawsForPart, timeline, LEVELS, TOOL_TARGETS, CONTRACT_VERSION } from '../../lib/scales.mjs';
import * as taxonomy from '../../../lib/lean-taxonomy.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const { frames, partLaws } = loadScaleData(path.join(ROOT, 'sim-engine', 'scales'));

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok    ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n          ' + String(e.message).split('\n').join('\n          ')); } };
const node = (id, label, level, extra = {}) => ({ id, iri: `http://purl.obolibrary.org/obo/${id}`, label, level, parent: null, ...extra });
const bp = (nodes, markers = []) => ({ nodes, genome_sketch: { markers } });
const build = (o = {}) => scaleLadder({ run: 't', generation: 0, frames, partLaws, taxonomy, ...o });

console.log('\nframes');
ok('a clade picks its frame through the NCBITaxon closure', () => {
  assert.equal(frameFor({ taxon: 'Drosophila melanogaster', ancestors: taxonomy.TAXA['Drosophila melanogaster'].ancestors }, frames).name, 'insect');
  assert.equal(frameFor({ taxon: 'Mus musculus', ancestors: taxonomy.TAXA['Mus musculus'].ancestors }, frames).name, 'tetrapod');
  assert.equal(frameFor({ taxon: 'Escherichia coli', ancestors: taxonomy.TAXA['Escherichia coli'].ancestors }, frames).name, 'prokaryote');
});
ok('a construct takes the construct frame WHATEVER its donor is', () => {
  const f = frameFor({ taxon: 'Xenopus laevis', ancestors: taxonomy.TAXA['Xenopus laevis']?.ancestors ?? ['Tetrapoda'], isConstruct: true }, frames);
  assert.equal(f.name, 'construct');
  assert.match(f.why, /made_from/);
});
ok('an unknown clade gets no body plan and says which chain it checked', () => {
  const f = frameFor({ taxon: 'Nothing at all', ancestors: [] }, frames);
  assert.equal(f.name, 'unknown');
  assert.equal(f.frame.slots.length, 0);
  assert.match(f.why, /no frame declares a clade/);
});

console.log('\nplacement');
ok('a part that matches no slot is reported, never drawn at the origin', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('X_1', 'utterly unknown widget', 'organ')]) });
  assert.equal(l.unplaced.length, 1);
  assert.equal(l.parts.filter(p => p.label === 'utterly unknown widget').length, 0);
  assert.match(l.unplaced[0].why, /no slot/);
});
ok('every placed part carries a schematic basis and how it was matched', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000023', 'wing', 'organ')]) });
  const w = l.parts.find(p => p.label === 'wing');
  assert.equal(w.geometry_basis, 'schematic');
  assert.ok(w.matched_by);
  assert.equal(l.frame.geometry_basis, 'schematic');
  assert.match(l.frame.THIS_IS_NOT_MORPHOMETRY, /DECLARED/);
});
ok('a prokaryote frame refuses organ and tissue levels and says why', () => {
  const l = build({ blueprint: bp([node('body', 'cell', 'body', { taxon_label: 'Escherichia coli' }), node('UBERON_0000948', 'heart', 'organ'), node('UBERON_0002097', 'skin', 'tissue')]) });
  assert.equal(l.parts.filter(p => p.level === 'organ').length, 0);
  assert.equal(l.unplaced.length, 2);
  for (const u of l.unplaced) assert.match(u.why, /has no (organ|tissue) level/);
});
ok('a paired slot puts the two sides on opposite sides of the body', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }),
    node('UBERON_0000970', 'eye', 'organ'), node('UBERON_0000970b', 'eye', 'organ')]) });
  const eyes = l.parts.filter(p => p.slot === 'eye');
  assert.equal(eyes.length, 2);
  assert.ok(Math.sign(eyes[0].pos.z) !== Math.sign(eyes[1].pos.z), 'both eyes landed on the same side');
  assert.deepEqual(eyes.map(e => e.side).sort(), ['left', 'right']);
});
ok('the same part lands in the same place on every rebuild', () => {
  const b = bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000023', 'wing', 'organ')]);
  const a = build({ blueprint: b }).parts.find(p => p.label === 'wing').pos;
  const c = build({ blueprint: b }).parts.find(p => p.label === 'wing').pos;
  assert.deepEqual(a, c);
});

console.log('\nthe construct layer');
ok("a construct does not wear the parts its own declaration disowns", () => {
  const madeFrom = { taxon: 'Xenopus laevis', what: 'a ciliated spheroid',
    does_not_inherit: ['organ systems', 'a gut, a mouth or gonads', 'the donor body plan'] };
  const l = build({ madeFrom, blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Xenopus laevis' }),
    node('UBERON_0001555', 'digestive tract', 'organ'), node('UBERON_0000949', 'endocrine system', 'organ_system'),
    node('CL_0000066', 'ciliated epithelial cell', 'cell', { parent: null })]) });
  assert.equal(l.organism.kind, 'construct');
  const disowned = l.unplaced.filter(u => u.donors_not_the_constructs);
  assert.ok(disowned.length >= 2, 'the construct kept parts its declaration disowns');
  for (const d of disowned) assert.match(d.why, /does not inherit/);
});

ok('a construct keeps its own body, and "organ" does not disown "organism"', () => {
  const madeFrom = { taxon: 'Xenopus laevis', what: 'w', does_not_inherit: ['organ systems', 'a gut, a mouth or gonads'] };
  const l = build({ madeFrom, blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Xenopus laevis' }),
    node('UBERON_0000991', 'gonad', 'organ'), node('UBERON_0001003', 'skin epidermis', 'tissue')]) });
  assert.ok(l.parts.some(p => p.level === 'body'), 'the construct lost its own body');
  assert.ok(l.parts.some(p => p.label === 'skin epidermis'), 'an unrelated tissue was disowned');
  assert.ok(l.unplaced.some(u => u.label === 'gonad' && u.donors_not_the_constructs), '"gonads" did not disown a gonad');
});

console.log('\nlaw chips');
const flyAnc = taxonomy.TAXA['Drosophila melanogaster'].ancestors;
const wing = { id: 'UBERON_0000023', ontology_id: 'UBERON_0000023', label: 'wing', level: 'organ' };
ok('a law whose scope excludes the organism comes back out-of-scope, never as support', () => {
  const recs = { 'flight-allometry-law': { label: 'f', status: 'accepted', scope: { taxa: ['Exocoetidae'] }, lean_ref: { module: 'm' } } };
  const chips = lawsForPart(wing, { partLaws, lawRecords: recs, taxon: 'Drosophila melanogaster', ancestors: flyAnc,
    available: { mass_kg: {}, liftingArea_m2: {}, CLmax: {}, rho: {} } });
  const c = chips.find(x => x.law_id === 'flight-allometry-law');
  assert.equal(c.status, 'out-of-scope');
  assert.match(c.because, /another clade/);
});
ok('scope.taxa "any" is admitted, because it is a theorem about a model', () => {
  const recs = { 'flight-climb-glide-law': { label: 'g', status: 'accepted', scope: { taxa: ['any'] }, lean_ref: { module: 'm' } } };
  const args = { partLaws, lawRecords: recs, taxon: 'Drosophila melanogaster', ancestors: flyAnc,
    available: { mass_kg: {}, LD_max: {}, glideHeight_m: {} } };
  assert.notEqual(lawsForPart(wing, args).find(x => x.law_id === 'flight-climb-glide-law').status, 'out-of-scope');
});
ok('quantities present and no check run is NOT support', () => {
  // The first version of this test expected `supports` here, and was wrong: having the numbers a law needs
  // is not the same as anyone having evaluated it. Only a check's verdict turns a chip into support.
  const recs = { 'flight-climb-glide-law': { label: 'g', status: 'accepted', scope: { taxa: ['any'] }, lean_ref: { module: 'm' } } };
  const args = { partLaws, lawRecords: recs, taxon: 'Drosophila melanogaster', ancestors: flyAnc,
    available: { mass_kg: {}, LD_max: {}, glideHeight_m: {} } };
  const unchecked = lawsForPart(wing, args).find(x => x.law_id === 'flight-climb-glide-law');
  assert.equal(unchecked.status, 'constrains-but-not-evaluated');
  assert.match(unchecked.because, /no check in this run evaluated/);
  assert.equal(lawsForPart(wing, { ...args, verdicts: { 'flight-climb-glide-law': 'holds' } }).find(x => x.law_id === 'flight-climb-glide-law').status, 'supports');
  assert.equal(lawsForPart(wing, { ...args, verdicts: { 'flight-climb-glide-law': 'violated' } }).find(x => x.law_id === 'flight-climb-glide-law').status, 'violates');
});
ok('a law meant for the body reaches the body, and not every other part with it', () => {
  const body = { id: 'body', ontology_id: 'body', label: 'multicellular organism', level: 'body' };
  const eye = { id: 'e', ontology_id: 'e', label: 'eye', level: 'organ' };
  const a = { partLaws, lawRecords: {}, taxon: 'Mus musculus', ancestors: [] };
  assert.ok(lawsForPart(body, a).some(c => c.law_id === 'physiology-q10'), 'q10 did not reach the body');
  assert.ok(!lawsForPart(eye, a).some(c => c.law_id === 'physiology-q10'), 'q10 reached the eye');
  assert.ok(!lawsForPart(eye, a).some(c => c.law_id === 'altitude-coupling'), 'altitude-coupling reached the eye');
});
ok('a law whose quantities are missing NAMES them and does not read as a pass', () => {
  const recs = { 'flight-allometry-law': { label: 'f', status: 'accepted', scope: { taxa: ['any'] }, lean_ref: { module: 'm' } } };
  const c = lawsForPart(wing, { partLaws, lawRecords: recs, taxon: 'Mus musculus', ancestors: taxonomy.TAXA['Mus musculus'].ancestors,
    available: { mass_kg: {} } }).find(x => x.law_id === 'flight-allometry-law');
  assert.equal(c.status, 'constrains-but-not-evaluated');
  assert.ok(c.missing.includes('CLmax'), 'the missing quantity was not named');
  assert.equal(c.missing_where.CLmax, 'table');
  assert.match(c.because, /clade-scoped table/);
  assert.notEqual(c.status, 'supports');
});
ok('"the wrong quantity" is a different status from "nobody measured it"', () => {
  const recs = { 'flight-allometry-law': { label: 'f', status: 'accepted', scope: { taxa: ['any'] }, lean_ref: { module: 'm' } } };
  const inapplicable = [{ clade: ['Insecta'], laws: ['flight-allometry-law'], why: 'a steady maximum lift coefficient is the WRONG QUANTITY for an insect' }];
  const c = lawsForPart(wing, { partLaws, lawRecords: recs, taxon: 'Drosophila melanogaster', ancestors: flyAnc,
    available: { mass_kg: {}, liftingArea_m2: {}, CLmax: {}, rho: {} }, inapplicable }).find(x => x.law_id === 'flight-allometry-law');
  assert.equal(c.status, 'wrong-quantity');
  assert.match(c.because, /WRONG QUANTITY/);
});
ok('a quantity no field can hold says so, instead of asking the designer for it', () => {
  const c = lawsForPart({ id: 'h', ontology_id: 'h', label: 'heart', level: 'organ' }, { partLaws, lawRecords: {}, taxon: 'Mus musculus', ancestors: [] })
    .find(x => x.law_id === 'physiology-laplace');
  assert.deepEqual(c.cannot_be_supplied.sort(), ['vessel_radius_m', 'wall_strength_Pa', 'wall_thickness_m']);
  assert.match(c.because, /NO FIELD ANYWHERE/);
});
ok('every quantity a law needs has a declared origin', () => {
  for (const e of partLaws.entries) for (const n of e.needs ?? [])
    assert.ok(partLaws.quantities.fields[n], `${e.law_id} needs ${n}, which has no entry in quantities.fields`);
});
ok('a named check reaches its law, and the chip says it was not a kernel check', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Mus musculus' }), node('UBERON_0010856', 'patagium', 'organ')]),
    declared: { parameters: { mass_kg: { value: 0.025, source: 's' }, lifting_area_m2: { value: 0.007, source: 's' } } },
    tableQuantities: { CLmax: { basis: 'check', kind: 'measured', source: 't' } },
    states: [{ age_days: 60, stage: 'adult', state: { values: { mass_kg: 0.025, ambient: { air_density_kg_m3: 1.225 } } } }],
    journal: [{ type: 'finding', tool: 'physics_check/lifting_area_supports_mass', verdict: 'met', generation: 4 }] });
  const c = l.parts.find(p => p.label === 'patagium').laws.find(x => x.law_id === 'flight-allometry-law');
  assert.equal(c.status, 'supports');
  assert.match(c.because, /not a kernel check/);
  assert.equal(l.available_quantities.rho.kind, 'condition');
});
ok('an unformalised law never carries a proof link', () => {
  const chips = lawsForPart({ id: 'x', ontology_id: 'x', label: 'leg', level: 'organ' },
    { partLaws, lawRecords: {}, taxon: 'Drosophila melanogaster', ancestors: flyAnc, available: { leg_length_m: {} } });
  const c = chips.find(x => x.law_id === 'walking-pendulum-speed');
  assert.equal(c.theorem, null);
  assert.equal(c.proof_link, null);
  assert.equal(c.status, 'constrains-but-not-evaluated');
});
ok('a population law reaches no part of any body', () => {
  for (const level of LEVELS) {
    const chips = lawsForPart({ id: 'x', ontology_id: 'x', label: 'anything at all', level }, { partLaws, lawRecords: {}, taxon: 'Mus musculus', ancestors: [] });
    assert.equal(chips.filter(c => ['fisher-ftns', 'maynardsmith-twofold-cost', 'E6'].includes(c.law_id)).length, 0, `a population law reached a ${level}`);
  }
});
ok('a whole-body law stays on the body and is not hoisted onto every part', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Mus musculus' }), node('UBERON_0000023', 'wing', 'organ')]) });
  const uni = (l.universal_laws ?? []).map(c => c.law_id);
  assert.ok(!uni.includes('thompson1917-ch03-07'), 'the cube law was listed as reaching every part');
  assert.ok(uni.includes('blueprint-well-formedness'), 'the one truly universal law is missing');
  assert.ok(l.parts.find(p => p.level === 'body').laws.some(c => c.law_id === 'thompson1917-ch03-07'), 'the cube law left the body');
  assert.ok(!l.parts.find(p => p.slot === 'wing_membrane').laws.some(c => c.law_id === 'thompson1917-ch03-07'));
});
ok('a part no law reaches says so, rather than being left silently bare', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000970', 'eye', 'organ')]) });
  const eye = l.parts.find(p => p.slot === 'eye');
  const specific = (eye.laws ?? []).filter(c => !c.universal);
  assert.equal(specific.length, 0, 'the eye gained a specific law');
  assert.ok(eye.laws.length === 0 ? eye.no_law_reaches : true);
});

console.log('\nprovenance');
ok('every law chip, check and molecule carries one of the four bases', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000023', 'wing', 'organ')],
    [{ cell: 'http://purl.obolibrary.org/obo/CL_0000066', cell_label: 'c', gene_products: [{ iri: 'http://purl.obolibrary.org/obo/PR_000001', label: 'p', ontology: 'PR' }] }]),
    journal: [{ type: 'finding', tool: 'flight_support_check', verdict: 'met', body: 'b', generation: 0 }] });
  const allowed = new Set(Object.keys(l.basis_legend));
  for (const p of l.parts) for (const c of p.laws ?? []) assert.ok(allowed.has(c.basis), `law chip basis ${c.basis}`);
  for (const c of l.checks) assert.ok(allowed.has(c.basis), `check basis ${c.basis}`);
  for (const m of l.molecules) assert.ok(allowed.has(m.basis), `molecule basis ${m.basis}`);
  assert.deepEqual([...allowed].sort(), ['check', 'declared', 'literature', 'proof']);
});
ok('a declared quantity reaches a chip as declared, never as measured', () => {
  const recs = { 'flight-climb-glide-law': { label: 'g', status: 'accepted', scope: { taxa: ['any'] }, lean_ref: { module: 'm' } } };
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Mus musculus' }), node('UBERON_0000023', 'wing', 'organ')]),
    lawRecords: recs, declared: { parameters: { mass_kg: { value: 1, source: 'a person typed it' }, LD_max: { value: 3, source: 's' }, glideHeight_m: { value: 4, source: 's' } } } });
  const c = l.parts.find(p => p.slot === 'wing_membrane').laws.find(x => x.law_id === 'flight-climb-glide-law');
  for (const s of c.supplied) assert.equal(s.basis, 'declared');
  assert.equal(l.available_quantities.mass_kg.kind, 'assumed');
});
ok('a marker molecule says it is an annotation and not a measurement', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' })],
    [{ cell: 'http://purl.obolibrary.org/obo/CL_0000066', cell_label: 'c', gene_products: [{ iri: 'http://purl.obolibrary.org/obo/PR_000001', label: 'p', ontology: 'PR' }] }]) });
  assert.equal(l.molecules.length, 1);
  assert.match(l.molecules[0].what_it_is, /not an expression measurement/);
});

console.log('\nchains and ghosts');
const chain = { requirement: 'live longer', species_caveat: 'fly data', organism: { evidence_species: ['Drosophila melanogaster'] },
  links: [{ id: 'l1', from: { level: 'molecule', label: 'dFOXO' }, to: { level: 'tissue', label: 'adult fat body', id: 'FBbt_00003209' },
    lands_on: { ontology_id: 'FBbt_00003209', label: 'adult fat body' }, evidence_grade: 'necessity', quote: 'q' }],
  missing_rungs: [{ between: ['organ', 'phenotype'], why: 'no hazard rate', what_would_be_needed: 'a fitted survival curve' }] };
ok('anatomy the literature names and the blueprint lacks becomes a ghost, marked as absent', () => {
  const l = build({ chain, blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' })]) });
  const g = l.parts.find(p => p.from === 'chain');
  assert.ok(g, 'the chain link landed nowhere at all');
  assert.equal(g.blueprint_has_it, false);
  assert.equal(g.chain_links.length, 1);
  assert.match(g.why, /does not contain it/);
  assert.ok(l.honesty.some(h => /ABSENT from the blueprint/.test(h)));
});
ok('a link about one cell type lands on that cell type, not on every cell sharing a word', () => {
  const c = { links: [{ id: 'f', from: { level: 'pathway', label: 'p' }, to: { level: 'cell', label: 'fibroblast', id: 'CL_0000057' },
    lands_on: { ontology_id: 'CL_0000057', label: 'fibroblast' }, evidence_grade: 'association' }] };
  const l = build({ chain: c, blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Mus musculus' }),
    node('UBERON_0002097', 'skin of body', 'organ'),
    node('CL_0002553', 'splenic fibroblast', 'cell', { parent: 'http://purl.obolibrary.org/obo/UBERON_0002097' }),
    node('CL_4006000', 'fibroblast of mammary gland', 'cell', { parent: 'http://purl.obolibrary.org/obo/UBERON_0002097' })]) });
  assert.equal(l.parts.filter(p => p.from !== 'chain' && (p.chain_links ?? []).length).length, 0, 'a fibroblast link landed on a specific fibroblast');
});
ok('a ghost is never invented for a refusal with no blueprint', () => {
  const l = build({ chain, blueprint: null });
  assert.equal(l.parts.length, 0);
  assert.equal(l.parts.filter(p => p.from === 'chain').length, 0);
});
ok('a pathway or a lifespan is never drawn as a body part', () => {
  const c2 = { links: [{ id: 'p', from: { level: 'molecule', label: 'm' }, to: { level: 'phenotype', label: 'determination of adult lifespan', id: 'GO_0008340' },
    lands_on: { ontology_id: 'GO_0008340', label: 'determination of adult lifespan' }, evidence_grade: 'necessity' }] };
  const l = build({ chain: c2, blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' })]) });
  assert.equal(l.parts.filter(p => p.from === 'chain').length, 0);
});
ok('a missing rung is carried through to the ladder, not dropped', () => {
  const l = build({ chain, blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' })]) });
  assert.equal(l.chain.missing_rungs.length, 1);
  assert.ok(l.honesty.some(h => /is MISSING/.test(h)));
});
ok('with no chain at all the lower rungs are declared absent, not implied', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' })]) });
  assert.equal(l.chain.present, false);
  assert.ok(l.honesty.some(h => /ABSENT, not implied/.test(h)));
});

console.log('\nchecks');
ok('a whole-organism check is attached to the body and NOT spread over parts', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000023', 'wing', 'organ')]),
    journal: [{ type: 'finding', tool: 'performance_check', verdict: 'longer', body: 'b', generation: 0 }] });
  assert.equal(l.parts.find(p => p.level === 'body').checks.length, 1);
  assert.equal(l.checks[l.parts.find(p => p.level === 'body').checks[0]].tool, 'performance_check', 'a part holds an index into the ladder checks');
  assert.equal(l.parts.find(p => p.slot === 'wing').checks.length, 0);
  assert.equal(TOOL_TARGETS.performance_check.parts, null);
});
ok('a part-specific check reaches the part it is about and no other', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000023', 'wing', 'organ'), node('UBERON_0000970', 'eye', 'organ')]),
    journal: [{ type: 'finding', tool: 'flight_support_check', verdict: 'met', body: 'b', generation: 0 }] });
  assert.equal(l.parts.find(p => p.slot === 'wing').checks.length, 1);
  assert.equal(l.parts.find(p => p.slot === 'eye').checks.length, 0);
});

console.log('\nthe age axis');
ok('a declared track resolves a ratio per age and says which quantity it came from', () => {
  const t = timeline({ states: [
    { age_days: 0, stage: 'egg', state: { values: { SL_m: 0.0005, mass_kg: 1e-8 } } },
    { age_days: 5, stage: 'larva', state: { values: { SL_m: 0.0045, mass_kg: 1.5e-6 } } }] });
  assert.equal(t.points[0].length_ratio, 1);
  assert.equal(t.points[1].length_ratio, 9);
  assert.match(t.points[1].ratio_from, /declared length/);
});
ok('with a mass only, the ratio comes from the cube law and names it', () => {
  const t = timeline({ states: [
    { age_days: 1, stage: 'a', state: { values: { mass_kg: 0.001 } } },
    { age_days: 2, stage: 'b', state: { values: { mass_kg: 0.008 } } }] });
  assert.equal(Math.round(t.points[1].length_ratio * 1000) / 1000, 2);
  assert.match(t.points[1].ratio_from, /cube law/);
});
ok('a non-monotonic track is preserved, not sorted or smoothed into growth', () => {
  const t = timeline({ states: [
    { age_days: 0, stage: 'egg', state: { values: { SL_m: 1 } } },
    { age_days: 5, stage: 'larva', state: { values: { SL_m: 9 } } },
    { age_days: 12, stage: 'adult', state: { values: { SL_m: 5 } } }] });
  assert.deepEqual(t.points.map(p => p.length_ratio), [1, 9, 5]);
});
ok('the age axis never claims to be development, and says order is not modelled', () => {
  const t = timeline({ states: [{ age_days: 0, stage: 'a', state: { values: { mass_kg: 1 } } }] });
  assert.match(t.not_a_simulation, /not development being simulated/);
  assert.equal(t.order_of_appearance.modelled, false);
  assert.match(t.scaling.under, /isometry/);
  assert.ok(t.scaling.falsified_for);
});
ok('with nothing declared the body is drawn at one size and says so', () => {
  const t = timeline({ states: [{ age_days: 0, stage: 'a', state: { values: {} } }] });
  assert.equal(t.points[0].length_ratio, null);
  assert.match(t.points[0].ratio_from, /neither a length nor a mass/);
});

console.log('\nthe taxon audit');
ok('a part is told whether the ontology places it in this organism', () => {
  const audit = { total: 1, counts: { 'placed-vacuously': 1 }, parts: [{ iri: 'http://purl.obolibrary.org/obo/UBERON_0000023', id: 'UBERON_0000023',
    label: 'wing', verdict: 'placed-vacuously', why: 'only Bilateria', in_taxon: ['Bilateria'], ranks_above_the_organism: 33 }] };
  const l = build({ taxonAudit: audit, blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000023', 'wing', 'organ')]) });
  assert.equal(l.parts.find(p => p.slot === 'wing').taxon_evidence.verdict, 'placed-vacuously');
  assert.ok(l.honesty.some(h => /BARELY PLACES THIS BODY/.test(h)));
});
ok('with no audit a part says it was not audited, rather than looking fine', () => {
  const l = build({ blueprint: bp([node('body', 'multicellular organism', 'body', { taxon_label: 'Drosophila melanogaster' }), node('UBERON_0000023', 'wing', 'organ')]) });
  assert.equal(l.parts.find(p => p.slot === 'wing').taxon_evidence.verdict, 'not-audited');
});

console.log('\nthe built artifacts');
ok('every run in the index has a ladder, and every ladder is on this contract', () => {
  const idx = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'scales', 'index.json');
  if (!fs.existsSync(idx)) return;                       // not built in this checkout; the builder is tested by running it
  const index = JSON.parse(fs.readFileSync(idx, 'utf8'));
  assert.equal(index.contract_version, CONTRACT_VERSION);
  for (const r of index.runs) {
    const b = JSON.parse(fs.readFileSync(path.join(path.dirname(idx), r.file), 'utf8'));
    assert.equal(b.contract_version, CONTRACT_VERSION, `${r.run} is on ${b.contract_version}`);
    assert.ok(Object.keys(b.ladders).length >= 1, `${r.run} has no ladder`);
    for (const l of Object.values(b.ladders)) {
      assert.ok(Array.isArray(l.honesty) && l.honesty.length, `${r.run} gen ${l.generation} carries no honesty notes`);
      for (const p of l.parts) assert.equal(p.geometry_basis, 'schematic', `${r.run}: a part claims non-schematic geometry`);
    }
    for (const [id, law] of Object.entries(b.laws ?? {})) {
      if (law.missing_record) continue;
      if (law.theorem) assert.ok(law.module, `${id} has a theorem and no module`);
      else assert.equal(law.lean_source ?? null, null, `${id} has no theorem but carries source text`);
    }
  }
});
ok('no ladder anywhere carries a bird record', () => {
  const dir = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'scales');
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/"class"\s*:\s*"Aves"/.test(s), `${f} carries a class: Aves record`);
    assert.ok(!/NCBITaxon[_:]8782\b/.test(s), `${f} names the held-out clade by id`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
