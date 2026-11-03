#!/usr/bin/env node
// What this run changed, pinned.
//
//   node runs/flying-mouse/test.mjs
//
// These live here rather than beside the modules they test because several of those modules belong to other
// threads' folders (organism-design/ is the organism thread's, sim-engine/validate/physics/ the physics
// thread's) and the standing rule is not to put files in them. Every assertion is about behaviour this run
// introduced or corrected, and each names the wrong answer it exists to prevent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
let pass = 0, fail = 0;
async function ok(name, fn) {
  try { await fn(); pass++; console.log('  ok    ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n          ' + String(e.message).split('\n').join('\n          ')); }
}

console.log('\nparse-text: a clause that names an organism with no parameters');
const { parseDesignText } = await import('../../sim-engine/lib/parse-text.mjs');

await ok('the flight requirement survives the organism being unknown to the engine', () => {
  // THE BUG: `a mouse that ... supports its flight` returned criteria: []. The identical sentence with
  // "zebrafish" returned a glide criterion. One word changed and the request to fly was dropped -- and an
  // empty criteria list is the worst possible answer, because nothing downstream can then fail.
  const mouse = parseDesignText('a mouse that grows wings that can actually support its flight');
  const fish = parseDesignText('a zebrafish that grows wings that can actually support its flight');
  assert.equal(mouse.spec.criteria.length, fish.spec.criteria.length, 'the mouse must get the same criteria as the zebrafish');
  assert.equal(mouse.spec.criteria[0].scenario, 'glide');
  assert.ok(mouse.unparsed.some(u => u.organism_not_in_bundle === 'mouse'), 'and the organism is still named as one the engine has no parameters for');
});

await ok('the organism is blanked out of the clause, not left to be read as a structure word', () => {
  const r = parseDesignText('a salmon that survives 4 °C');
  assert.equal(r.spec.criteria.length, 1);
  assert.equal(r.spec.criteria[0].params.water_temperature_C, 4);
  assert.equal(r.spec.start_from.length, 0, 'start_from stays empty: there is still no parameter set, so the spec cannot validate');
});

console.log('\nlift coefficients: by clade, from a named measurement, never defaulted');
const { liftCoefficientFor, designTaxon } = await import('../../sim-engine/validate/physics/standing.mjs');

await ok('a mouse does not get a flying fish lift curve', () => {
  // THE BUG: standing.mjs carried `const CLmax = 0.78` -- a stuffed Cypselurus measured in a wind tunnel --
  // and applied it to whatever design it was handed. Asked whether a mouse's wings carry a mouse it would
  // have answered with a fish's lift curve and returned a number.
  const mouse = liftCoefficientFor('Mus musculus');
  assert.ok(mouse.ok, 'a mammal should reach the mammal entry');
  assert.notEqual(mouse.C_Lmax, 0.78, 'it must not be the flying-fish coefficient');
  assert.equal(mouse.kind, 'borrowed', 'and it is a borrow from a sugar glider, labelled as one');
  assert.match(mouse.note, /Petaurus breviceps/);
});

await ok('a clade with no measurement gets no number at all', () => {
  const r = liftCoefficientFor('Homo sapiens');
  // Theria covers us, so this one resolves; the point is the clade OUTSIDE every entry.
  const none = liftCoefficientFor('Drosophila melanogaster');
  assert.equal(none.ok, false, 'an insect reaches neither entry and must be refused');
  assert.match(none.reason, /no measured maximum lift coefficient|not in the clade table/);
  assert.ok(r.ok);
});

await ok('an unplaceable taxon is refused as unplaceable, not as out of scope', () => {
  const r = liftCoefficientFor('Glaucomys volans');
  assert.equal(r.ok, false);
  assert.match(r.reason, /not in the clade table/, 'the clade table does not hold it, and that is a different answer from "outside every entry"');
});

await ok('no taxon means no coefficient, and the refusal says why', () => {
  const r = liftCoefficientFor(null);
  assert.equal(r.ok, false);
  assert.match(r.reason, /no taxon/);
});

await ok('the teleost designs keep their coefficient, through a DECLARED borrow and not by default', () => {
  // The published verdicts for winged-zebrafish, tff and the chimera rest on Park & Choi's 0.78. The entry
  // declares borrowable_to Teleostei with the reason, so those designs are unchanged and the borrow is now
  // a stated decision instead of a silent one.
  const z = liftCoefficientFor('Danio rerio');
  assert.ok(z.ok);
  assert.equal(z.C_Lmax, 0.78);
  assert.equal(z.borrowed_via?.clade, 'Teleostei');
  assert.match(z.note, /BORROWED ACROSS A DECLARED SCOPE/);
});

const { loadBundle } = await import('../../sim-engine/lib/data-node.mjs');
await ok('a design that blends reference organisms takes its dominant parent\'s taxon', async () => {
  const bundle = await loadBundle();
  const doc = { id: 'winged-zebrafish', base: { parents: [{ organism: 'zebrafish-adult', weight: 0.7 }, { organism: 'flying-fish', weight: 0.3 }] } };
  const t = designTaxon(doc, bundle);
  assert.equal(t.taxon, 'Danio rerio');
  assert.match(t.from, /dominant parent/, 'and it says the taxon is the parent\'s, which is weaker than the design having one');
});

console.log('\nflight_support_check: the one aerodynamic question, for any clade');
const { flightSupportCheck } = await import('../../sim-engine/validate/physics/flight-support.mjs');
const SRC = s => ({ source: s });
const M = { value: 0.025, ...SRC('design input') }, S = { value: 0.007, ...SRC('design input') }, V = { value: 3, ...SRC('design input') };

await ok('a bare number is refused by name', () => {
  const r = flightSupportCheck({ taxon: 'Mus musculus', mass_kg: 0.025, lifting_area_m2: S, airspeed_m_s: V });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.match(r.reason, /mass_kg.*no source|bare number/s);
});

await ok('a missing quantity is named, never defaulted', () => {
  const r = flightSupportCheck({ taxon: 'Mus musculus', mass_kg: M, airspeed_m_s: V });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.ok(r.what_is_missing.some(x => /lifting_area_m2/.test(x)));
  assert.match(r.reason, /cannot be defaulted/);
});

await ok('an unknown provenance kind is refused rather than written into a result', () => {
  const r = flightSupportCheck({ taxon: 'Mus musculus', mass_kg: { ...M, kind: 'eyeballed' }, lifting_area_m2: S, airspeed_m_s: V });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.match(r.reason, /not one of the repository/);
});

await ok('powered flight is refused as a power question, with what an answer would need', () => {
  const r = flightSupportCheck({ taxon: 'Mus musculus', powered: true, mass_kg: M, lifting_area_m2: S, airspeed_m_s: V });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.equal(r.ran, false);
  assert.match(r.reason, /POWERED flight/);
  assert.ok(r.what_is_missing.some(x => /wingbeat/.test(x)));
  assert.ok(r.what_this_can_answer, 'and it says what it CAN answer, so the refusal is useful');
});

await ok('the arithmetic is right, and the verdict covers the whole stated range', () => {
  const r = flightSupportCheck({ taxon: 'Mus musculus', mass_kg: { min: 0.015, max: 0.030, ...SRC('design input, swept') }, lifting_area_m2: S, airspeed_m_s: { min: 2, max: 3, ...SRC('design input, swept') } });
  assert.equal(r.verdict, 'does-not-carry');
  // L/W at the best corner: 0.5*1.225*9*0.007*1.48 / (0.015*9.80665)
  const expect = (0.5 * 1.225 * 9 * 0.007 * 1.48) / (0.015 * 9.80665);
  assert.ok(Math.abs(r.lift_over_weight.best - expect) < 1e-9, `best L/W ${r.lift_over_weight.best} != ${expect}`);
  assert.ok(r.lift_over_weight.worst < r.lift_over_weight.best);
  assert.match(r.reading, /At no corner/);
});

await ok('a range whose answer changes inside it is reported as changing, not as a pass', () => {
  const r = flightSupportCheck({ taxon: 'Mus musculus', mass_kg: { min: 0.015, max: 0.030, ...SRC('swept') }, lifting_area_m2: S, airspeed_m_s: { min: 4.8, max: 8.9, ...SRC('swept') } });
  assert.equal(r.verdict, 'carries-only-in-part-of-the-stated-range');
  assert.ok(r.lift_over_weight.worst < 1 && r.lift_over_weight.best > 1);
  assert.match(r.reading, /has not been shown to fly/);
});

await ok('the caveat that the coefficient came from animals losing height is in the result', () => {
  const r = flightSupportCheck({ taxon: 'Mus musculus', mass_kg: M, lifting_area_m2: S, airspeed_m_s: V });
  assert.ok(r.caveats.some(c => /not fully supported|STALLED/.test(c)), 'Bishop 2007 states weight was not fully supported; a verdict built on that coefficient must carry it');
  assert.match(r.lift_coefficient.source, /Bishop/);
});

console.log('\nblueprint: a refusal that can be checked');
const bp = JSON.parse(fs.readFileSync(path.join(HERE, 'gen', 'gen0.blueprint.json'), 'utf8'));

await ok('a refused structure names the axiom and the clade it is asserted over', () => {
  const c = (bp.reading.conflicts ?? []).find(x => x.label === 'wing');
  assert.ok(c, 'wing should be refused for a mouse');
  assert.ok((c.never_in_taxon ?? []).some(n => n.label === 'Glires'), 'and the forbidding clade must be named, not just "the taxon constraints"');
  assert.match(c.axiom, /never_in_taxon/);
});

await ok('the axiom is checked against the project inventory and the counterexample is reported', () => {
  const cx = bp.reading.conflict_counterexamples ?? [];
  const p = cx.find(x => x.taxon === 'Pteromyini');
  assert.ok(p, 'organisms/merged/taxa.json holds Pteromyini, "flying squirrels", and NCBI puts it inside Glires');
  assert.equal(p.inside_clade, 'Glires');
  assert.ok(p.common_names.some(n => /flying/i.test(n)));
  assert.match(p.reading, /Either that name is wrong or the axiom is too wide/);
});

await ok('a substitution is reported, not left to be inferred from a node list', () => {
  // THE BUG I HIT MYSELF: "wing" was refused and the blueprint still contained a styliform cartilage and a
  // styliform element, promoted from the word "flight". I read that hierarchy as "no flight structure" and
  // was wrong. A substitution nobody reports is indistinguishable from the request being honoured.
  const c = (bp.reading.conflicts ?? []).find(x => x.substituted_by);
  assert.ok(c, 'the refused structure should carry what stands in its place');
  assert.ok(c.substituted_by.some(x => /styliform/.test(x.label)));
  assert.match(c.substitution_warning, /READ THE HIERARCHY ACCORDINGLY/);
  const promoted = bp.reading.structures_promoted_from_function_words ?? [];
  assert.ok(promoted.length, 'and the promoted structures are listed with why each is there');
  assert.ok(promoted.every(x => x.note.includes('The description did not name it.')));
});

await ok('the ontology\'s own alternative is attached to the refusal', () => {
  const c = (bp.reading.conflicts ?? []).find(x => (x.function_alternatives ?? []).length);
  assert.ok(c, 'a refusal should carry what the ontology DOES allow here for the same function');
  const labels = c.function_alternatives.flatMap(f => f.allowed_for_this_taxon.map(a => a.label));
  assert.ok(labels.some(l => /styliform/.test(l)));
});

await ok('every structure the tool recommends is a word the tool can read back', async () => {
  // The first time round it was not: blueprint.mjs answered "the ontology allows the styliform cartilage"
  // and then could not parse "a mouse with a styliform cartilage", because the lexicon had no entry for it.
  const lex = JSON.parse(fs.readFileSync(path.join(ROOT, 'organism-design', 'lexicon.json'), 'utf8'));
  const words = new Set(Object.keys(lex.anatomy_words).map(w => w.toLowerCase()));
  const recommended = (bp.reading.conflicts ?? []).flatMap(c => (c.function_alternatives ?? []).flatMap(f => f.allowed_for_this_taxon.map(a => a.label.toLowerCase())));
  assert.ok(recommended.length, 'this blueprint should have recommended something');
  for (const r of recommended) assert.ok(words.has(r), `the tool recommends "${r}" and the lexicon cannot read it back`);
});

console.log('\nthe run itself');
await ok('all four generations are recorded, each with what it taught', () => {
  const s = JSON.parse(fs.readFileSync(path.join(HERE, 'summary.json'), 'utf8'));
  assert.equal(s.generations.length, 4);
  for (const g of s.generations) { assert.ok(g.what_it_taught, `generation ${g.generation} must say what it taught`); assert.ok(Object.keys(g.gates).length); }
});

await ok('no generation claims the animal flies', () => {
  const gens = [0, 1, 2, 3].map(i => JSON.parse(fs.readFileSync(path.join(HERE, 'gen', `gen${i}.json`), 'utf8')));
  const verdicts = gens.flatMap(g => Object.values(g.gates));
  assert.ok(!verdicts.includes('carries'), `no gate may read plainly "carries": ${verdicts.join(', ')}`);
  assert.ok(gens.every(g => g.mesh.glb === null), 'and no generation may claim a mesh that was never built');
});

await ok('every declared quantity carries a source saying it is a design input', () => {
  for (const i of [1, 2]) {
    const g = JSON.parse(fs.readFileSync(path.join(HERE, 'gen', `gen${i}.json`), 'utf8'));
    for (const [k, v] of Object.entries(g.phenotype.declared ?? {})) {
      assert.ok(v.source && /DESIGN INPUT/.test(v.source), `gen ${i} ${k} must say it is a design input, not a measurement`);
      assert.equal(v.kind, 'assumed');
    }
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
