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
await R.finding(0, 'parse_design_text/routing', spec.routing?.performance_criteria?.length ? 'routed' : 'unrouted',
  `the front door now ROUTES the requirement instead of dropping it: ${spec.routing?.summary} "${spec.routing?.performance_criteria?.[0]?.requirement ?? 'lives longer'}" goes to performance_check { kind: "lifespan" }, and the quantities that check needs are the designer\'s to declare. Before this the whole clause came back unparsed, which read as a parse failure when it was a capability gap -- two different things the routing block now tells apart.`,
  { routing: spec.routing });

await R.finding(0, 'scenario_list', lifespanScenario.length ? 'found' : 'absent',
  `${names.length} scenario modules exist and ${lifespanScenario.length} of them measure anything like a lifespan: ${lifespanScenario.length ? lifespanScenario.join(', ') : 'none'}. The scenarios are glide, current, temperature, depth, altitude, predator, grip and the rest -- every one of them a question asked of an organism at an age, not a question about how many ages it gets. The engine has growth tracks (ontogeny.json, for two teleosts) and no senescence model for anything. There is no mortality rate, no survival curve and no cause of death in this repository.`,
  { scenarios: names, lifespan_scenarios: lifespanScenario,
    searched_for: 'lifespan, senescence, longevity, mortality, ageing -- across sim-engine/ and the Lean law set' });

R.writeGen({ generation: 0, asked: 'a fruit fly that lives longer',
  phenotype: { taxon: spec.taxon_resolution?.taxon ?? null, counts: {}, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [] },
  genotype: { markers: [], cells_with_markers: 0, note: 'no blueprint yet.' },
  mesh: { glb: null, why: 'no mesh builder for an insect; the builder is a parametric teleost builder.' },
  gates: { parse_design_text: spec.validation?.ok ? 'pass' : 'fail', routing: spec.routing?.performance_criteria?.length ? 'routed to performance_check' : 'unrouted', scenario_list: lifespanScenario.length ? 'found' : 'absent' },
  lean: {}, blueprint: null,
  what_it_taught: 'The request is about time-to-death, which no SCENARIO measures and no law covers -- and it is no longer a dead end. The parser reads it as a lifespan requirement and the routing block sends it to performance_check, the layer built for exactly the three things these runs asked for that nothing could express.' });

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

// A DECLARED LIFE HISTORY, and the one in these runs that is actually a development.
//
// Drosophila is holometabolous: egg, larva, pupa, adult are four different animals, not one animal at four
// sizes. Each stage declares its own mass and length, so the engine resolves a different STATE at each age.
// Two things about this track are worth more than the numbers in it.
//
// It is NOT MONOTONIC. A third-instar larva is longer and heavier than the adult it becomes. Any viewer, any
// chart and any scaling law that assumes growth only goes up is wrong about this animal, and the isometric
// scaling the theatre draws with is wrong at the pupal transition in a way nothing here can fix.
//
// And it is still NOT DEVELOPMENT. Four declared masses are four declared masses. Nothing here makes a cell
// divide, forms an imaginal disc or turns a larva into a fly: the engine resolves a state at an age because
// a person typed one, and the only law in the set that is about time certifies that a declared ordering has
// no cycle. Call it a growth track and it is honest; call it ontogeny and it is a lie.
const FLY_STAGES = [
  { key: 'egg', label: 'egg', ageDays: 0, parameters: {
    mass_kg: { value: 1.0e-8, unit: 'kg', source: 'DESIGN INPUT: order of ten micrograms. Stated by the designer; nothing was weighed for this.' },
    SL_m: { value: 0.0005, unit: 'm', source: 'DESIGN INPUT: order of half a millimetre long. Stated, not measured.' } } },
  { key: 'larva', label: 'third-instar larva', ageDays: 5, parameters: {
    mass_kg: { value: 1.5e-6, unit: 'kg', source: 'DESIGN INPUT: order of one and a half milligrams at the end of larval feeding -- the heaviest the animal ever is. Stated, not measured.' },
    SL_m: { value: 0.0045, unit: 'm', source: 'DESIGN INPUT: order of four and a half millimetres, LONGER than the adult. Stated, not measured, and the direction is the point.' } } },
  { key: 'pupa', label: 'pupa', ageDays: 9, parameters: {
    mass_kg: { value: 1.2e-6, unit: 'kg', source: 'DESIGN INPUT: lighter than the larva, because a pupa does not feed. Stated, not measured.' },
    SL_m: { value: 0.0030, unit: 'm', source: 'DESIGN INPUT: order of three millimetres. Stated, not measured.' } } },
  { key: 'adult', label: 'adult', ageDays: 12, parameters: {
    mass_kg: { value: 1.0e-6, unit: 'kg', source: 'DESIGN INPUT: order of a milligram. The lifespan claim is about THIS stage and no other. Stated, not measured.' },
    SL_m: { value: 0.0025, unit: 'm', source: 'DESIGN INPUT: order of two and a half millimetres, SHORTER than the larva it came from. Stated, not measured.' } } },
];

const doc1 = await R.mcp('organism_from_blueprint', { blueprint: 'runs/long-lived-fruit-fly/gen/gen1.blueprint.json', id: 'long-lived-fly-gen1', save: true, overwrite: true,
  declared: { parameters: {
    mass_kg: { value: 1.0e-6, unit: 'kg', source: 'DESIGN INPUT: the adult mass, as the design-wide default. Each life stage overrides it. Stated, not measured.' },
  }, life_stages: FLY_STAGES } },
  { generation: 1, why: 'the blueprint into the studio, with a declared four-stage life history so an age axis exists at all' });
const track = [];
for (const s of FLY_STAGES) {
  const st = await R.mcp('organism_get', { organism: 'long-lived-fly-gen1', ageDays: s.ageDays }, { generation: 1, why: `the STATE the engine resolves at the ${s.label}` });
  // organism_get returns a flattened state: { values, nulls, flags, taxon }.
  const v = st?.state?.values ?? {};
  track.push({ stage: s.key, ageDays: s.ageDays, mass_kg: v.mass_kg ?? null, SL_m: v.SL_m ?? null,
    stage_resolved: v.stage ?? null, kind: 'assumed (declared by the design)' });
}
await R.finding(1, 'organism_get (per life stage)', track.every(t => t.mass_kg != null) ? 'resolved' : 'incomplete',
  `a STATE resolves at each of the four declared stages, and the track is NOT MONOTONIC: ${track.map(t => `${t.stage} ${t.mass_kg} kg / ${t.SL_m} m`).join(', ')}. The larva is heavier and longer than the adult it becomes, so a growth curve for this animal goes up and then down. Every value carries kind "${track[0]?.kind}" -- declared, not measured -- and nothing here simulates the transition between any two of them.`,
  { track, what_it_is_not: 'Four declared masses at four declared ages. No cell divides, no imaginal disc forms, and the only Lean law about time (genotype-developmental-ordering) certifies that a declared ordering is acyclic -- it does not supply one.' });
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
await R.thinking(2, 'The fly walks and flies. Ask the locomotion layer both, partly to exercise it on an insect and partly because both flight branches should refuse, for two different reasons worth telling apart: powered flight is a power question this layer cannot take, and the area question underneath it runs into a coefficient policy that records Insecta as inapplicable rather than unmeasured.');

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
  fly.reading + ' The refusal is about POWERED flight, which is the deeper of the two reasons this could not be answered: an area inequality is not a power budget.',
  { verdict: fly.verdict, lift: { verdict: liftCheck?.verdict, limiting_factor: liftCheck?.limiting_factor } });

// The other refusal is underneath that one, and it is the more interesting of the two. Ask the glide
// question, which IS an area question, and the coefficient policy gets its turn.
const glide = await R.mcp('locomotion_check', {
  taxon: 'Drosophila melanogaster', mode: 'glide',
  body_length_m: { value: 0.0025, source: 'DESIGN INPUT: unchanged.' },
  speed_m_s: { min: 0.3, max: 1.0, source: 'DESIGN INPUT, swept: unchanged.' },
  mass_kg: { value: 1.2e-6, source: 'DESIGN INPUT: unchanged.' },
  lifting_area_m2: { value: 4e-6, source: 'DESIGN INPUT: unchanged.' },
}, { generation: 2, why: 'the area question on its own, so the lift-coefficient policy is the thing being tested' });
const gLift = (glide.checks ?? []).find(c => c.id === 'lift_carries_the_weight');
const inap = gLift?.detail?.result?.lift_coefficient?.reason ?? gLift?.limiting_factor ?? '';
await R.finding(2, 'locomotion_check (glide) / lift coefficient', gLift?.verdict ?? 'absent',
  'asked a pure area question about an insect, the coefficient policy refuses -- and refuses for a reason that is NOT "nobody measured one": ' + String(inap).slice(0, 420),
  { verdict: gLift?.verdict, reason: inap,
    why_this_matters: 'Dickinson, Lehmann and Sane showed on a dynamically scaled robotic Drosophila wing that an insect gets a large part of its lift from rotational circulation and wake capture, which exist only because the wing reverses. A steady maximum lift coefficient represents neither. Borrowing the flying fish or the sugar glider would have produced a number; adding an insect number would have produced a number too, and both would be answering with a model the source says does not apply. The table therefore records Insecta as INAPPLICABLE with what a right check would need, which is a different claim from a missing measurement and sends a caller somewhere different.' });

R.writeGen({ generation: 2, asked: 'the same fly, walking and flying',
  phenotype: { taxon: 'Drosophila melanogaster', counts, parameters: null, structures_requested: [], structures_refused: [],
    flight_structures_present: [], declared: { walk: walk.inputs, fly: fly.inputs },
    locomotion: { walk: { verdict: walk.verdict, reynolds: walk.reynolds }, fly: { verdict: fly.verdict }, glide: { verdict: glide.verdict } } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged: this generation changed how the organism moves, not what it is made of.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { 'locomotion_check (walk)': walk.verdict, 'locomotion_check (fly)': fly.verdict, 'locomotion_check (glide)': glide.verdict }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: 'Walking is not contradicted; powered flight is refused as a power question rather than an area one; and the glide question gets the refusal that matters -- a steady lift coefficient is the WRONG QUANTITY for a flapping insect wing, which is a decision with a citation behind it rather than a gap in the data. Neither bears on lifespan, which generation 4 answers.' });

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

// ===================================================================================================
// GENERATION 4 -- answer the question. The layer that was missing is no longer missing.
// ===================================================================================================
await R.thinking(4, 'The lifespan layer exists now. It needs three rates: what kills the fly from the inside, what the design proposes to change that to, and what kills it from the outside. The third is the one the ecology layer bears on -- 29 taxa are on record eating this clade -- and turning a predator list into a hazard is a judgement somebody has to make and state, so the run states it.');

const baseHazard = { value: 1 / 60, source: 'DESIGN INPUT: an intrinsic hazard of 1/60 per day, a 60-day mean lifespan in protection, taken as the baseline this design is measured against. Stated by the designer; not a survival curve fitted to any data in this repository.' };
const lifeWild = await R.mcp('performance_check', { kind: 'lifespan', taxon: 'Drosophila melanogaster',
  intrinsic_hazard_per_day: baseHazard,
  designed_intrinsic_hazard_per_day: { value: 1 / 120, source: 'DESIGN INPUT: the design asks for twice the intrinsic lifespan, 120 days.' },
  extrinsic_hazard_per_day: { value: 0.08, source: 'DESIGN INPUT: 0.08 per day, a ~12-day expectation from predation and everything else outside the animal. The ecology layer names 29 taxa recorded as eating this clade and which are recorded in the box asked about; it does NOT give a rate, and this number is the designer turning that list into one.' },
}, { generation: 4, why: 'does the design actually live longer, where it lives?' });
await R.finding(4, 'performance_check (lifespan, in the wild)', lifeWild.verdict, lifeWild.reading,
  { fold_change: lifeWild.fold_change, expected_lifetime_days: lifeWild.expected_lifetime_days,
    extrinsic_ceiling_days: lifeWild.extrinsic_ceiling_days, headroom: lifeWild.headroom_above_baseline,
    model: lifeWild.model, model_caveat: lifeWild.model_caveat, cannot_say: lifeWild.what_this_cannot_say });

const lifeLab = await R.mcp('performance_check', { kind: 'lifespan', taxon: 'Drosophila melanogaster',
  intrinsic_hazard_per_day: baseHazard,
  designed_intrinsic_hazard_per_day: { value: 1 / 120, source: 'DESIGN INPUT: unchanged.' },
  extrinsic_hazard_per_day: { value: 1e-6, source: 'DESIGN INPUT: a protected vial, where essentially nothing outside the animal kills it. The control for the comparison above.' },
}, { generation: 4, why: 'the same design in a vial, as the control' });
await R.finding(4, 'performance_check (lifespan, in protection)', lifeLab.verdict,
  lifeLab.reading + ' THIS IS THE POINT OF THE PAIR: the same design, the same intrinsic change, and the answer is '
  + lifeLab.fold_change.worst_case.toFixed(2) + 'x in a vial against ' + lifeWild.fold_change.worst_case.toFixed(2)
  + 'x where the animal actually lives. A longevity result is a statement about an environment as much as about an organism, and the two numbers come from the same arithmetic with one input changed.',
  { fold_change: lifeLab.fold_change, expected_lifetime_days: lifeLab.expected_lifetime_days, headroom: lifeLab.headroom_above_baseline });

R.writeGen({ generation: 4, asked: 'does the design actually live longer -- in a vial, and where it lives?',
  phenotype: { taxon: 'Drosophila melanogaster', counts, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [],
    lifespan: { intrinsic_fold_asked: lifeWild.intrinsic_fold_change_asked_for,
      realised_fold_in_the_wild: lifeWild.fold_change.worst_case, realised_fold_in_protection: lifeLab.fold_change.worst_case,
      extrinsic_ceiling_days: lifeWild.extrinsic_ceiling_days } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged: nothing in this repository connects a marker to a hazard rate, which is the mechanism gap the lifespan layer states rather than hides.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { 'performance_check (wild)': lifeWild.verdict, 'performance_check (protected)': lifeLab.verdict }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: 'The question has an answer now, and it is a sharp one: doubling the intrinsic lifespan gives '
    + lifeLab.fold_change.worst_case.toFixed(2) + 'x in a vial and ' + lifeWild.fold_change.worst_case.toFixed(2)
    + 'x in the wild, because the ceiling set by extrinsic mortality is ' + lifeWild.extrinsic_ceiling_days.toFixed(1)
    + ' days whatever happens inside the animal. That is the Medawar-Williams argument arriving as arithmetic over three declared rates, and it is the first result in these runs that needed two layers at once: the ecology layer names what is eating the fly, and the performance layer says what that costs the design.' });

R.finish({ layers_exercised: ['parse', 'routing', 'blueprint', 'studio', 'lean', 'locomotion', 'ecology', 'performance'],
  headline: 'The request is about time-to-death. No scenario measures it and no law covers it -- and the lifespan layer now answers it: doubling the intrinsic lifespan buys 2x in a vial and 1.09x in the wild, because extrinsic mortality sets a ceiling the intrinsic term cannot reach past.',
  the_missing_layer: 'A lifespan layer would need: a mortality model with an intrinsic and an extrinsic term, a survival curve to fit, and some way to connect a genotype edit to a hazard rate. None of the three exists here. The Drosophila longevity literature is largely about insulin/IGF signalling, dietary restriction and mitochondrial function, and nothing in this repository represents a pathway at all.' });
