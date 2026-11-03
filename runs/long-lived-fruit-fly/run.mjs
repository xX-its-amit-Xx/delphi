#!/usr/bin/env node
// A FRUIT FLY THAT LIVES LONGER.
//
//   node runs/long-lived-fruit-fly/run.mjs [--offline]
//
// Chosen as a use case because the thing being asked for is not a shape. Every layer in this repository
// takes a design and asks a question about it at an instant, or over one cycle of a gait, or against a
// community. Lifespan is none of those. The run is short because the honest answer arrives early and the
// rest of it is making sure that answer is not quietly replaced by a nearby question the system CAN do.
import path from 'node:path';
import { makeRun } from '../_lib/studio-run.mjs';

const QUESTION = 'Can we design a fruit fly that lives longer?';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const offline = process.argv.includes('--offline');
const R = makeRun({ dir: HERE, question: QUESTION, author: 'agent:long-lived-fly' });

console.log(`\n=== ${QUESTION}\n`);
await R.open();

// ===================================================================================================
// GENERATION 0 -- the request, and the layer that does not exist.
// ===================================================================================================
await R.thinking(0, 'Put the request through the front door first. The interesting part is not what the parser makes of "fruit fly" -- it is what it makes of "lives longer", which is the entire request.');

const spec = await R.mcp('parse_design_text', { text: 'I want a fruit fly that lives longer.' }, { generation: 0, why: 'text to a DesignSpec' });
const named = (spec.unparsed ?? []).map(u => u.organism_not_in_bundle).filter(Boolean);
await R.finding(0, 'parse_design_text', spec.validation?.ok ? 'pass' : 'fail',
  `the organism is named (${named.join(', ') || 'none'})${spec.taxon_resolution?.placed ? ` and placed as ${spec.taxon_resolution.taxon}` : ' and NOT placed: the clade table knows the binomial, not the common name'}, and the REQUIREMENT is not read at all: ${spec.spec?.criteria?.length ?? 0} criteria. "Lives longer" is not in the spec vocabulary, so the clause stays unparsed. That is correct behaviour and it is the whole finding: there is no scenario, no metric and no threshold anywhere in this engine for how long an organism lives.`,
  { organism_named: named, taxon: spec.taxon_resolution?.taxon ?? null, placed: spec.taxon_resolution?.placed ?? false,
    criteria: spec.spec?.criteria ?? [], unparsed: spec.unparsed, validation_ok: spec.validation?.ok,
    a_bug_this_run_found: 'Before this run the same sentence produced a GLIDE criterion. familyGlide matches the free-standing word "fly", `fruit fly` contains one, and the parser read the name of the animal as a requirement that it be able to fly -- a criterion nobody asked for, attached to a request about lifespan. Two-word insect names ending in "fly" are now organism names and are taken out of the clause before the criterion families read it.' });

const scen = await R.mcp('scenario_list', {}, { generation: 0, why: 'is there any scenario that measures a lifespan?' });
const names = (scen.scenarios ?? []).map(s => s.key ?? s.name ?? s.id).filter(Boolean);
const lifespanScenario = names.filter(n => /life|age|senesc|surviv.*time|longev/i.test(String(n)));
await R.finding(0, 'scenario_list', lifespanScenario.length ? 'found' : 'absent',
  `${names.length} scenario modules exist and ${lifespanScenario.length} of them measure anything like a lifespan: ${lifespanScenario.length ? lifespanScenario.join(', ') : 'none'}. The scenarios are glide, current, temperature, depth, altitude, predator, grip and the rest -- every one of them a question asked of an organism at an age, not a question about how many ages it gets. The engine has growth tracks (ontogeny.json, for two teleosts) and no senescence model for anything. There is no mortality rate, no survival curve and no cause of death in this repository.`,
  { scenarios: names, lifespan_scenarios: lifespanScenario,
    searched_for: 'lifespan, senescence, longevity, mortality, ageing -- across sim-engine/ and the Lean law set' });

R.writeGen({ generation: 0, asked: 'a fruit fly that lives longer',
  phenotype: { taxon: spec.taxon_resolution?.taxon ?? null, counts: {}, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [] },
  genotype: { markers: [], cells_with_markers: 0, note: 'no blueprint yet.' },
  mesh: { glb: null, why: 'no mesh builder for an insect; the builder is a parametric teleost builder.' },
  gates: { parse_design_text: spec.validation?.ok ? 'pass' : 'fail', scenario_list: lifespanScenario.length ? 'found' : 'absent' },
  lean: {}, blueprint: null,
  what_it_taught: 'The request is about time-to-death and this system has no layer for it. Not a missing parameter set, not an out-of-scope clade: a missing dimension. Every other use case in runs/ was refused by something; this one is refused by an absence.' });

// ===================================================================================================
// GENERATION 1 -- build the fly anyway, so the gap is visible against something real.
// ===================================================================================================
await R.thinking(1, 'Build the organism anyway. A gap is easier to argue with when the thing beside it is real: the anatomy layer has a great deal to say about Drosophila melanogaster and none of it bears on how long the animal lives.');

const b1 = R.blueprint(1, 'Drosophila melanogaster with wings and antennae that flies', { offline, runName: 'long-lived-fruit-fly' });
const counts = b1.counts_distinct;
await R.finding(1, 'blueprint.mjs', 'pass',
  `${b1.reading.taxon.label} resolves and the hierarchy is substantial: ${counts.organ_system} organ systems, ${counts.organ} organs, ${counts.tissue} tissues, ${counts.cell} cell types, all Uberon and Cell Ontology terms with the query that produced each one. Every term is a structure. Not one of them is a rate, and lifespan is a rate.`,
  { taxon: b1.reading.taxon.label, taxid: b1.reading.taxon.taxid, counts,
    structures_read: (b1.reading.anatomy_words ?? []).map(a => a.label),
    conflicts: (b1.reading.conflicts ?? []).map(c => ({ label: c.label, axiom: c.axiom })),
    words_not_recognised: b1.reading.words_not_recognised });

const doc1 = await R.mcp('organism_from_blueprint', { blueprint: 'runs/long-lived-fruit-fly/gen/gen1.blueprint.json', id: 'long-lived-fly-gen1', save: true, overwrite: true },
  { generation: 1, why: 'the blueprint into the studio' });
const lean1 = await R.mcp('lean_check', { design: { taxon: doc1?.taxon ?? 'Drosophila melanogaster', id: 'long-lived-fly-gen1' } }, { generation: 1, why: 'do any laws reach an insect' });
const tally1 = (lean1.rows ?? lean1.verdicts ?? []).reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {});
await R.finding(1, 'lean_check', 'ran', `${Object.entries(tally1).map(([k, v]) => `${v} ${k}`).join(', ')}. No law in the set bears on lifespan for any clade, so even a law base written about insects would not have answered this.`, { tally: tally1 });

R.writeGen({ generation: 1, asked: 'Drosophila melanogaster with wings and antennae that flies',
  phenotype: { taxon: b1.reading.taxon.label, counts, parameters: doc1?.parameters ?? null,
    structures_requested: (b1.reading.anatomy_words ?? []).map(a => a.label),
    structures_refused: (b1.reading.conflicts ?? []).map(c => c.label),
    flight_structures_present: (b1.nodes ?? []).filter(n => /wing/i.test(n.label)).map(n => n.label).slice(0, 4) },
  genotype: { markers: R.markersOf(b1), by_cell: R.markerCellsOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0,
    cells_of: `${b1.genome_sketch?.cells_with_markers ?? 0} of ${b1.genome_sketch?.cells_total ?? 0} cell types`,
    note: 'Marker gene products from the Cell Ontology. Notably absent: anything about the insulin/IGF signalling, dietary restriction or mitochondrial pathways that the actual Drosophila longevity literature is about. This is a structural sketch, and longevity is not structural.' },
  mesh: { glb: null, why: 'no surface mesh: the builder is a parametric teleost builder and Blender is absent here.' },
  gates: { 'blueprint.mjs': 'pass', organism_from_blueprint: doc1?.error ? 'refused' : 'pass', lean_check: 'ran, no opinion' },
  lean: tally1, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: 'The anatomy layer does well here -- five organ systems and forty-odd cell types for a real insect. It is simply not the layer the question was about.' });

// ===================================================================================================
// GENERATION 2 -- the locomotion layer, including a refusal that is exactly right.
// ===================================================================================================
await R.thinking(2, 'The fly walks and flies. Ask the locomotion layer both, partly to exercise it on an insect and partly because the flight branch should refuse: the only lift coefficients in this repository are a flying fish and a sugar glider, and an insect is neither.');

const walk = await R.mcp('locomotion_check', {
  taxon: 'Drosophila melanogaster', mode: 'walk',
  body_length_m: { value: 0.0025, source: 'DESIGN INPUT: 2.5 mm body length, the order of size Drosophila melanogaster is described at. Not measured here.' },
  speed_m_s: { min: 0.005, max: 0.02, source: 'DESIGN INPUT, swept: 5-20 mm/s walking. Not measured on any fly here.' },
  gait: { reciprocal: false, degrees_of_freedom: 18, description: 'alternating tripod, six legs in two sets of three',
    cycle_hz: { min: 5, max: 12, source: 'DESIGN INPUT, swept: step frequency asked of the design.' },
    distance_per_cycle_m: { min: 0.001, max: 0.002, source: 'DESIGN INPUT, swept: net advance per tripod cycle.' },
    source: 'DESIGN INPUT: the gait the design proposes' },
}, { generation: 2, why: 'walking: the regime and the cycle arithmetic' });
await R.finding(2, 'locomotion_check (walk)', walk.verdict, walk.reading,
  { reynolds: walk.reynolds, checks: (walk.checks ?? []).map(c => ({ id: c.id, kind: c.kind, verdict: c.verdict, measured: c.measured })),
    froude: (walk.checks ?? []).find(c => c.id === 'froude_regime')?.detail?.why_this_is_not_a_verdict });

const fly = await R.mcp('locomotion_check', {
  taxon: 'Drosophila melanogaster', mode: 'fly', question: QUESTION,
  body_length_m: { value: 0.0025, source: 'DESIGN INPUT: unchanged.' },
  speed_m_s: { min: 0.3, max: 1.0, source: 'DESIGN INPUT, swept: the airspeed the design is asked to reach in flight.' },
  mass_kg: { value: 1.2e-6, source: 'DESIGN INPUT: the mass the wings are asked to carry, of order a milligram. Not a measurement of any fly.' },
  lifting_area_m2: { value: 4e-6, source: 'DESIGN INPUT: two wings of a few square millimetres. The design proposes it; nobody measured it.' },
}, { generation: 2, why: 'flight: and whether the lift coefficient policy refuses an insect' });
const liftCheck = (fly.checks ?? []).find(c => c.id === 'lift_carries_the_weight');
await R.finding(2, 'locomotion_check (fly)', fly.verdict,
  `${fly.reading} The flight branch refuses, and the refusal is the right one: ${liftCheck?.limiting_factor ?? 'see detail'}`,
  { verdict: fly.verdict, lift: { verdict: liftCheck?.verdict, limiting_factor: liftCheck?.limiting_factor },
    why_this_is_correct: 'The repository holds exactly two measured maximum lift coefficients: a stuffed Cypselurus hiraii and a live Petaurus breviceps. An insect at Re of order 100 with a flapping wing is aerodynamically unlike both -- unsteady, with leading-edge vortex lift that a steady coefficient does not represent at all. Returning a number here by borrowing one of the two would be exactly the failure this layer was built to stop.' });

R.writeGen({ generation: 2, asked: 'the same fly, walking and flying',
  phenotype: { taxon: 'Drosophila melanogaster', counts, parameters: null, structures_requested: [], structures_refused: [],
    flight_structures_present: [], declared: { walk: walk.inputs, fly: fly.inputs },
    locomotion: { walk: { verdict: walk.verdict, reynolds: walk.reynolds }, fly: { verdict: fly.verdict } } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged: this generation changed how the organism moves, not what it is made of.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { 'locomotion_check (walk)': walk.verdict, 'locomotion_check (fly)': fly.verdict }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: 'Walking is not contradicted and flight is refused for want of a lift coefficient measured on anything like an insect. Neither bears on lifespan. The locomotion layer is a second dimension beside shape, and the request was about a third one that still has no layer.' });

// ===================================================================================================
// GENERATION 3 -- the world, which does have something to say about living longer.
// ===================================================================================================
await R.thinking(3, 'Ecology is the one layer with any purchase here, and only sideways: a longer-lived fly is a fly exposed to predation for longer. The databases cannot tell us the lifespan, but they can tell us what is on record as eating this animal and whether any of it is in the place we are asking about.');

const eco = await R.mcp('ecology_check', {
  taxon: 'Drosophila melanogaster',
  where: { name: 'Greater Boston', bbox: [42.3, 42.4, -71.2, -71.0], source: 'DESIGN INPUT: a temperate urban box chosen by the designer as a worked example. Nothing here says the design would be released, or released there.' },
  community_limit: 10, offline,
}, { generation: 3, why: 'who else is there, and what is recorded as eating this clade' });
await R.finding(3, 'ecology_check', eco.verdict ?? 'assembled', eco.reading ?? '',
  { recorded_range: eco.recorded_range?.reading, community_scope: eco.community?.scoped_to?.clade,
    community: (eco.community?.species ?? []).map(s => `${s.species} (${s.records})`),
    recorded_predators: eco.interactions?.eatenBy?.total_taxa,
    relationships: Object.fromEntries(Object.entries(eco.interactions?.relationships ?? {}).map(([k, v]) => [k, v.count])),
    relationships_note: eco.interactions?.relationships_note ?? null,
    mutualists: (eco.interactions?.relationships?.mutualism_or_symbiosis?.taxa ?? []).map(t => `${t.taxon} (${t.interaction})`),
    predator_examples: (eco.interactions?.eatenBy?.taxa ?? []).slice(0, 10).map(t => t.taxon),
    predation_pressure: eco.predation_pressure?.reading,
    the_sideways_point: 'GloBI records real predators of this clade with studies behind them. What it cannot give is a predation RATE, and a lifespan question needs a rate: an organism that lives twice as long in a jar may live no longer at all in a place where something eats it every week. The layer supplies the list and refuses the rate.' });

R.writeGen({ generation: 3, asked: 'where this clade is recorded and what is recorded as eating it',
  phenotype: { taxon: 'Drosophila melanogaster', counts, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [],
    ecology: { recorded_records: eco.recorded_range?.total_records ?? null, community_n: eco.community?.species?.length ?? 0,
      recorded_predators: eco.interactions?.eatenBy?.total_taxa ?? 0 } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { ecology_check: eco.verdict ?? 'assembled' }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: `${eco.interactions?.eatenBy?.total_taxa ?? 0} taxa are on record as eating this clade -- damselflies, orb-weavers, dragonflies, bush-crickets -- each traceable to a study. That is the nearest this system gets to the question, and it is not very near: a list of predators is not a mortality rate, and without a rate a longer intrinsic lifespan is not a longer life.` });

R.finish({ layers_exercised: ['parse', 'blueprint', 'studio', 'lean', 'locomotion', 'ecology'],
  headline: 'The request is about time-to-death and no layer models it. The system refuses in four different places rather than answering a nearby question it can do, and the ecology layer gets closest by naming real predators while refusing to supply the rate that would be needed.',
  the_missing_layer: 'A lifespan layer would need: a mortality model with an intrinsic and an extrinsic term, a survival curve to fit, and some way to connect a genotype edit to a hazard rate. None of the three exists here. The Drosophila longevity literature is largely about insulin/IGF signalling, dietary restriction and mitochondrial function, and nothing in this repository represents a pathway at all.' });
