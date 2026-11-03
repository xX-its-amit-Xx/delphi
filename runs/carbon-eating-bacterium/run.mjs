#!/usr/bin/env node
// A BACTERIUM THAT EATS CARBON.
//
//   node runs/carbon-eating-bacterium/run.mjs [--offline]
//
// Chosen as a use case because it leaves the animals, and almost everything in this repository was built
// for animals. The interesting question was never whether the design works; it was which layers notice
// that they are being asked about a prokaryote and which quietly carry on.
//
// Five generations. The first one does not get as far as a design.
import path from 'node:path';
import { makeRun, gateOf } from '../_lib/studio-run.mjs';

const QUESTION = 'Can we design a bacterium that eats carbon, and could it live anywhere?';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const offline = process.argv.includes('--offline');
const R = makeRun({ dir: HERE, question: QUESTION, author: 'agent:carbon-bacterium' });
const bp = (g, text) => R.blueprint(g, text, { offline, runName: 'carbon-eating-bacterium' });

console.log(`\n=== ${QUESTION}\n`);
await R.open();

// ===================================================================================================
// GENERATION 0 -- ask in the words it was asked in, and find out the request has no organism in it.
// ===================================================================================================
await R.thinking(0, '"A bacterium that eats carbon" names no species and no metabolism. Ask for exactly that, and see what the blueprint tool does with a description it cannot read.');

const g0 = R.script('blueprint', process.execPath,
  ['organism-design/blueprint.mjs', 'a bacterium that eats carbon and swims', '--out', 'runs/carbon-eating-bacterium/gen/gen0.blueprint.json', ...(offline ? ['--offline'] : [])], { generation: 0 });
const refusedProperly = g0.code !== 0 && /no taxon recognised/.test(g0.stdout);
await R.finding(0, 'blueprint.mjs', refusedProperly ? 'refused' : 'built-something',
  refusedProperly
    ? 'it refuses, and names the words it could not read: bacterium, eats, carbon. None of the three is in the lexicon, so nothing in the description resolved to an organism and there is nothing to build a hierarchy of.'
    : 'it built a blueprint from a description naming no organism it could read, which is the defect this generation exists to catch.',
  { exit: g0.code, output: g0.stdout.slice(0, 1200),
    the_bug_this_replaces: 'Until this run, that description produced a blueprint of Metazoa -- ALL ANIMALS -- with 8 organ systems, 38 organs and 138 cell types. The taxon silently defaulted to the widest animal clade whenever no taxon word was recognised, on the reasoning that the widest taxon removes no structure by taxon constraint. The reasoning is sound and the behaviour was not: the fallback does not merely relax the constraints, it decides what the organism IS. The word "bacterium" sat in words_not_recognised while the tool built an animal with organs, and nothing connected the two.' });

await R.finding(0, 'the request itself', 'ambiguous',
  '"eats carbon" has at least four readings and they are different organisms: fixing CO2 from the air (autotrophy, which cyanobacteria and plants already do everywhere), oxidising hydrocarbons (Alcanivorax and the oil-degrading guild), depolymerising plastic (Ideonella sakaiensis on PET), or consuming elemental carbon, which essentially nothing does. This run takes the first reading and says so. No layer here disambiguates a request; the words are not read as English, and a tool that silently picked one of four would be guessing in the same way the Metazoa default was.',
  { readings: ['CO2 fixation (autotrophy)', 'hydrocarbon oxidation', 'plastic depolymerisation', 'elemental carbon'], taken: 'CO2 fixation', why: 'it is the reading with a real industrial chassis to name: Cupriavidus necator fixes CO2 through the Calvin cycle using hydrogen as the electron donor.' });

R.writeGen({ generation: 0, asked: 'a bacterium that eats carbon and swims',
  phenotype: { taxon: null, counts: {}, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [] },
  genotype: { markers: [], cells_with_markers: 0, note: 'no blueprint was built, so there is no cell list and no markers.' },
  mesh: { glb: null, why: 'no blueprint, no hierarchy, no mesh. The mesh builder is a parametric teleost builder in any case.' },
  gates: { 'blueprint.mjs': refusedProperly ? 'refused' : 'built-something' }, lean: {}, blueprint: null,
  what_it_taught: 'The request names no organism the tool can read, and the tool now says so instead of building an animal. "Bacterium" is not a taxon word in this repository; a scientific name is the way in.' });

// ===================================================================================================
// GENERATION 1 -- name the organism, and watch the anatomy layer run out of things to say.
// ===================================================================================================
await R.thinking(1, 'Name a real chassis: Cupriavidus necator, which fixes CO2 through the Calvin cycle with hydrogen as the electron donor. It is a bacterium that eats carbon in the first sense and it is already used industrially. Scientific names did not resolve before this run either -- the refusal above advised using one while the reader could not read one -- so this also tests the fix.');

const b1 = bp(1, 'Cupriavidus necator that fixes carbon dioxide and swims');
const counts = b1.counts_distinct;
await R.finding(1, 'blueprint.mjs', 'thin',
  `the scientific name resolves (${b1.reading.taxon.label}, NCBITaxon_${b1.reading.taxon.taxid}) and the hierarchy that comes back is almost empty: ${counts.organ_system} organ system(s), ${counts.organ} organ(s), ${counts.tissue} tissue(s), ${counts.cell} cell type(s). That is not a failure of the query. Uberon is an ANIMAL anatomy ontology and the Cell Ontology is overwhelmingly animal cell types, so for a prokaryote there is almost nothing in them to find. The anatomical layer of this system has close to nothing to say about most of life, and saying that plainly is better than a thin hierarchy that looks like a result.`,
  { taxon: b1.reading.taxon.label, taxid: b1.reading.taxon.taxid, counts,
    conflicts: (b1.reading.conflicts ?? []).map(c => ({ label: c.label, axiom: c.axiom })),
    words_not_recognised: b1.reading.words_not_recognised,
    what_this_means: 'For an animal this layer returns 13 organ systems and several hundred cell types. The same tool, the same queries and the same ontologies return a handful of terms for a bacterium. The layer is not clade-general even though the code is: the DATA stops at the animals.' });

const doc1 = await R.mcp('organism_from_blueprint', { blueprint: 'runs/carbon-eating-bacterium/gen/gen1.blueprint.json', id: 'carbon-bacterium-gen1', save: true, overwrite: true,
  declared: { parameters: {
    mass_kg: { value: 1.5e-15, unit: 'kg', source: 'DESIGN INPUT: of order a picogram for a 2 um rod. Stated by the designer; no cell was weighed.' },
    body_density_kg_m3: { value: 1100, unit: 'kg/m3', source: 'DESIGN INPUT: slightly denser than water, as cells generally are. Stated, not measured.' },
  },
  // A GROWTH TRACK, NOT A DEVELOPMENT. A bacterium has no ontogeny: it does not pass through stages on the
  // way to being itself, it divides. What it does have is growth phases, and a cell in stationary phase is
  // smaller than one in exponential phase. Each stage declares its own mass, so the engine resolves a
  // different STATE at each age and the theatre's age axis shows something real rather than one flat number.
  // Every value is a design input, and the three of them are the shape of a curve nobody here measured.
  life_stages: [
    { key: 'lag', label: 'lag phase', ageDays: 0, parameters: {
      mass_kg: { value: 1.0e-15, unit: 'kg', source: 'DESIGN INPUT: a cell not yet growing, taken as a third smaller than the exponential-phase cell. Stated by the designer; no cell was weighed.' } } },
    { key: 'growing', label: 'exponential growth', ageDays: 1, parameters: {
      mass_kg: { value: 1.5e-15, unit: 'kg', source: 'DESIGN INPUT: of order a picogram for a 2 um rod. Stated by the designer; no cell was weighed.' } } },
    { key: 'stationary', label: 'stationary phase', ageDays: 3, parameters: {
      mass_kg: { value: 1.2e-15, unit: 'kg', source: 'DESIGN INPUT: smaller again once division outpaces synthesis. Stated, not measured, and the direction matters more than the number: this track does not only go up.' } } },
  ] } },
  { generation: 1, why: 'the blueprint into the Design Studio, with the two quantities the design is willing to state' });
await R.finding(1, 'organism_from_blueprint', doc1?.error ? 'refused' : 'pass',
  doc1?.error ? `refuses: ${String(doc1.error).slice(0, 200)}`
    : `the document exists: taxon ${doc1.taxon}, placed in ${(doc1.clades ?? []).slice(0, 4).join(' < ')}. The clade table reaches outside the animals as of this run -- it ran from Metazoa downward before, so every bacterium, archaeon, fungus and plant was unplaceable, and unplaceable propagates: no clade scope can be decided, no reference set can say whether it is covered.`,
  { taxon: doc1?.taxon, placed: doc1?.taxon_placed_in_clade_table, clades: doc1?.clades, counts: doc1?.counts, parameters: doc1?.parameters });

const got1 = await R.mcp('organism_get', { organism: 'carbon-bacterium-gen1' }, { generation: 1, why: 'does a STATE resolve now that two quantities are declared?' });
await R.finding(1, 'organism_get', got1?.error ? 'refused' : 'ran',
  got1?.error ? 'refuses: ' + String(got1.error).slice(0, 220)
    : 'a STATE resolves for a bacterium. Two fields have values because the design declared them, every other field is null with its reason, and each declared value carries kind "assumed" and the source the designer gave -- so nothing downstream can mistake a stated picogram for a weighed one. Before this a taxon base resolved no STATE at all and organism_get refused outright, which meant no scenario, no standing check and no physics could be asked about any organism outside the bundle.',
  { declared: got1?.state?.values ? Object.entries(got1.state.values).filter(([, v]) => v !== null && typeof v !== 'object').slice(0, 6) : null,
    caveat: got1?.doc?.caveat ?? null });

const lean1 = await R.mcp('lean_check', { design: { taxon: doc1?.taxon ?? 'Cupriavidus necator', id: 'carbon-bacterium-gen1' } }, { generation: 1, why: 'which laws apply to a bacterium' });
const tally1 = (lean1.rows ?? lean1.verdicts ?? []).reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {});
await R.finding(1, 'lean_check', Object.keys(tally1).length ? 'ran' : 'empty',
  `${Object.entries(tally1).map(([k, v]) => `${v} ${k}`).join(', ')}. The law set was written about fish and the scope mechanism now correctly reports that none of it reaches a bacterium, naming the real lineage each time. A law base with nothing to say about most of life is a fact about the law base, not about the bacterium.`,
  { tally: tally1 });

R.writeGen({ generation: 1, asked: 'Cupriavidus necator that fixes carbon dioxide and swims',
  phenotype: { taxon: b1.reading.taxon.label, counts, parameters: doc1?.parameters ?? null,
    structures_requested: (b1.reading.anatomy_words ?? []).map(a => a.label),
    structures_refused: (b1.reading.conflicts ?? []).map(c => c.label), flight_structures_present: [] },
  genotype: { markers: R.markersOf(b1), by_cell: R.markerCellsOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0,
    cells_of: `${b1.genome_sketch?.cells_with_markers ?? 0} of ${b1.genome_sketch?.cells_total ?? 0} cell types`,
    note: 'Marker gene products the Cell Ontology records for the chosen cell types. For a prokaryote there are essentially no such annotations, which is the same gap as the anatomy: these are animal ontologies.' },
  mesh: { glb: null, why: 'no surface mesh: the builder is a parametric teleost builder and Blender is absent here. For a rod-shaped bacterium a mesh would be a cylinder, which is a thing a modelling tool can make and not a thing this system knows.' },
  gates: { 'blueprint.mjs': 'thin', organism_from_blueprint: doc1?.error ? 'refused' : 'pass', organism_get: got1?.error ? 'refused' : 'ran', lean_check: 'ran, no opinion' },
  lean: tally1, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: 'A scientific name now resolves, the clade table reaches bacteria, and a declared parameter set resolves a STATE, so a prokaryote gets all the way into the studio, the law check and organism_get. What it finds there is that the anatomy ontologies, the cell ontology and the law set are all animal artefacts. The pipeline is clade-general; its contents are not.' });

// ===================================================================================================
// GENERATION 2 -- the locomotion layer, and a theorem that ends the argument.
// ===================================================================================================
await R.thinking(2, 'The design says "swims". A blueprint cannot answer that: a part list describes one instant and swimming is a cycle. Ask the locomotion layer for the obvious first design -- a paddle that opens and closes, the way anything our size would swim.');

const paddle = await R.mcp('locomotion_check', {
  taxon: 'Cupriavidus necator', mode: 'swim', medium: 'water',
  body_length_m: { value: 2.0e-6, source: 'DESIGN INPUT: a 2 um rod, the order of size Cupriavidus necator is described at. Not a measurement made here.' },
  speed_m_s: { min: 1e-5, max: 5e-5, source: 'DESIGN INPUT, swept: 10-50 um/s, the order of speed asked of the design. Not measured on any cell here.' },
  gait: { reciprocal: true, degrees_of_freedom: 1, description: 'a single hinged paddle that opens and closes, driven faster on the power stroke than on the recovery stroke', source: 'DESIGN INPUT: the first design proposed for this organism' },
}, { generation: 2, why: 'does a paddle move a bacterium?' });
const pch = (paddle.checks ?? []).find(c => c.id === 'reciprocal_stroke_at_low_reynolds');
await R.finding(2, 'locomotion_check', paddle.verdict,
  `${paddle.reading} This is the strongest verdict anything in this repository can return short of Lean: not "unlikely", not "inefficient", but zero net displacement per cycle, at any beat frequency, for any organism whose stroke retraces its own path at this Reynolds number. Driving the power stroke faster than the recovery stroke -- the obvious fix, and the one intuition suggests -- changes nothing, because in the Stokes limit the displacement depends on the PATH through configuration space and not on the rate.`,
  { verdict: paddle.verdict, reynolds: paddle.reynolds, theorem: pch?.detail?.source, doi: pch?.detail?.doi,
    limiting_factor: pch?.limiting_factor, what_would_fix_it: pch?.detail?.what_would_fix_it });

R.writeGen({ generation: 2, asked: 'the same organism, swimming with a hinged paddle',
  phenotype: { taxon: 'Cupriavidus necator', counts, parameters: null, structures_requested: ['paddle'], structures_refused: [], flight_structures_present: [],
    declared: paddle.inputs ?? null, locomotion: { mode: 'swim', verdict: paddle.verdict, reynolds: paddle.reynolds } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged: this generation changed how the organism moves, not what it is made of. That is the point of a separate locomotion layer.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { locomotion_check: paddle.verdict }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: 'IMPOSSIBLE, by a theorem rather than a simulation. At Re of order 1e-5 a time-reversible stroke returns the body exactly where it began, so the paddle design does not move slowly: it does not move. This is a verdict no shape-only layer could ever have reached, because nothing is wrong with the paddle as a structure.' });

// ===================================================================================================
// GENERATION 3 -- break the symmetry, the way bacteria actually did.
// ===================================================================================================
await R.thinking(3, 'The theorem names its own escape: break the time-reversal symmetry. A rotating helix traces a loop in configuration space rather than retracing a line, and a loop encloses area, and enclosed area is displacement. That is what a flagellum is. Declare the cycle too, so the arithmetic can be checked against the speed asked for.');

const flag = await R.mcp('locomotion_check', {
  taxon: 'Cupriavidus necator', mode: 'swim', medium: 'water',
  body_length_m: { value: 2.0e-6, source: 'DESIGN INPUT: unchanged from generation 2.' },
  speed_m_s: { min: 1e-5, max: 5e-5, source: 'DESIGN INPUT, swept: unchanged from generation 2.' },
  gait: { reciprocal: false, degrees_of_freedom: 3, description: 'a rotating helical flagellum driven by a reversible motor: the helix traces a loop in configuration space, not a line retraced',
    cycle_hz: { min: 50, max: 150, source: 'DESIGN INPUT, swept: the rotation rate the design asks of its motor. Not a measurement of any flagellum here.' },
    distance_per_cycle_m: { min: 2e-7, max: 5e-7, source: 'DESIGN INPUT, swept: net advance per revolution, a fraction of a body length. Not measured here.' },
    source: 'DESIGN INPUT: the second design, chosen because the theorem in generation 2 named exactly this escape' },
}, { generation: 3, why: 'does a rotary flagellum escape the theorem, and does its cycle produce the speed?' });
const cyc = (flag.checks ?? []).find(c => c.id === 'cycle_produces_the_speed');
await R.finding(3, 'locomotion_check', flag.verdict, flag.reading,
  { verdict: flag.verdict, checks: (flag.checks ?? []).map(c => ({ id: c.id, kind: c.kind, verdict: c.verdict })),
    cycle_check: cyc ? { verdict: cyc.verdict, speed_from_cycle_m_s: cyc.detail?.speed_from_cycle_m_s, speed_declared_m_s: cyc.detail?.speed_declared_m_s } : null,
    what_this_is_not: flag.what_this_layer_cannot_say });

R.writeGen({ generation: 3, asked: 'the same organism, swimming with a rotating helical flagellum',
  phenotype: { taxon: 'Cupriavidus necator', counts, parameters: null, structures_requested: ['flagellum'], structures_refused: [], flight_structures_present: [],
    declared: flag.inputs ?? null, locomotion: { mode: 'swim', verdict: flag.verdict, reynolds: flag.reynolds } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { locomotion_check: flag.verdict }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: `The theorem no longer binds it and the declared cycle is consistent with the declared speed. That is NOT a finding that it swims: there is no motor model, no torque, no energy budget and no control here. It is the absence of a contradiction, which is the most this layer is able to offer.` });

// ===================================================================================================
// GENERATION 4 -- the world. Everything above asked whether the organism is possible.
// ===================================================================================================
await R.thinking(4, 'Every layer so far asked whether the design is internally possible. None of them asked the question that decides whether most organisms exist: is there anywhere it could live that is not already full of something better at living there? Carbon fixation is the most thoroughly occupied trade on the planet.');

const eco = await R.mcp('ecology_check', {
  taxon: 'Cupriavidus necator',
  where: { name: 'the Rhine-Main agricultural belt, Germany', bbox: [49.8, 50.2, 8.4, 8.9],
    source: 'DESIGN INPUT: a temperate agricultural soil box chosen by the designer as a candidate release site. Cupriavidus necator is a soil organism; nothing here says this particular box is suitable.' },
  community_limit: 10, offline,
}, { generation: 4, why: 'where is this clade recorded, what else is there, and what is recorded as interacting with it' });
await R.finding(4, 'ecology_check', eco.verdict ?? 'assembled', eco.reading ?? 'no reading',
  { recorded_range: eco.recorded_range, community_scope: eco.community?.scoped_to?.clade ?? null,
    community: (eco.community?.species ?? []).map(s => `${s.species} (${s.records} records)`),
    interactions: { eatenBy: eco.interactions?.eatenBy?.total_taxa, eats: eco.interactions?.eats?.total_taxa, interactsWith: eco.interactions?.interactsWith?.total_taxa },
    relationships: Object.fromEntries(Object.entries(eco.interactions?.relationships ?? {}).map(([k, v]) => [k, v.count])),
    relationships_note: eco.interactions?.relationships_note ?? null,
    mutualists: (eco.interactions?.relationships?.mutualism_or_symbiosis?.taxa ?? []).map(t => `${t.taxon} (${t.interaction})`),
    predation_pressure: eco.predation_pressure, cannot_say: eco.what_this_cannot_say });

await R.thinking(4, 'The databases hold no population parameter, so the tool will not say whether the design is outcompeted -- it will only say so from numbers somebody declares. Declare them, as the designer\'s own estimates, and let the criterion run. The answer is then a property of those four numbers and the run says so.');

const comp = await R.mcp('ecology_check', {
  taxon: 'Cupriavidus necator', offline,
  competition: {
    invader: { K: { value: 1e8, source: 'DESIGN INPUT: cells per gram of soil the designed strain is assumed to reach alone. An estimate by the designer, not a measurement; soil carrying capacities for a specific strain are not in GBIF or GloBI and were not looked up.' } },
    resident: { name: 'resident soil autotroph guild', K: { value: 1e9, source: 'DESIGN INPUT: the standing community assumed an order of magnitude denser, on the reasoning that it is already there and adapted. An estimate, not a measurement.' } },
    alpha_resident_on_invader: { value: 0.9, source: 'DESIGN INPUT: residents assumed to suppress the invader almost as strongly as the invader suppresses itself, because they compete for the same inorganic carbon and the same electron donors.' },
    alpha_invader_on_resident: { value: 0.3, source: 'DESIGN INPUT: the invader assumed to suppress residents weakly, being rare and novel.' },
  },
}, { generation: 4, why: 'the mutual invasibility criterion, from declared parameters' });
const cm = comp.competition;
await R.finding(4, 'ecology_check/competition', cm?.verdict ?? 'cannot-evaluate', cm?.reading ?? 'not evaluated',
  { outcome: cm?.outcome, criterion: cm?.criterion, parameters: cm?.parameters, model_caveat: cm?.model_caveat });

R.writeGen({ generation: 4, asked: 'could this organism establish anywhere, against what is already there',
  phenotype: { taxon: 'Cupriavidus necator', counts, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [],
    ecology: { recorded_records: eco.recorded_range?.total_records ?? null, community_n: eco.community?.species?.length ?? 0,
      recorded_predators: eco.interactions?.eatenBy?.total_taxa ?? 0, competition: cm?.outcome ?? null } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { ecology_check: eco.verdict ?? 'assembled', competition: cm?.verdict ?? 'cannot-evaluate' }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: `On the designer's own four numbers the strain cannot invade when rare: at the resident guild's carrying capacity its per-capita growth rate is negative, so it is excluded. That outcome is a property of those four numbers and not a measurement of anything, and the run says so twice. What the real databases contribute is the other half: where the clade is actually recorded, what is actually in the chosen box, and what is actually recorded as interacting with it -- facts with studies behind them, and no population parameter anywhere among them.` });

// ===================================================================================================
// GENERATION 5 -- the thing the request actually asked for. "Eats carbon" finally reaches a check.
// ===================================================================================================
await R.thinking(5, 'Four generations in and nothing has yet checked the thing the request was about. "Eats carbon" was unreadable to the parser and unanswerable by every layer. Both are fixed: the parser reads it as a mass-balance requirement, the routing block sends it to performance_check, and conservation of mass does the rest.');

const spec5 = await R.mcp('parse_design_text', { text: 'Cupriavidus necator that eats carbon dioxide and swims' }, { generation: 5, why: 'does the front door read the metabolism now?' });
await R.finding(5, 'parse_design_text/routing', spec5.routing?.performance_criteria?.length ? 'routed' : 'unrouted',
  'the metabolism is read and routed: ' + spec5.routing?.summary + ' Where the words went before was nowhere: the clause came back unparsed and the request to EAT CARBON, which is the entire design, reached no check at all.',
  { routing: spec5.routing, performance_criteria: spec5.spec?.performance_criteria });

const bad = await R.mcp('performance_check', { kind: 'mass_balance', taxon: 'Cupriavidus necator',
  carbon_uptake_mol_per_day: { value: 1.0e-14, source: 'DESIGN INPUT: the carbon the design claims to take up per cell per day. Stated by the designer; no uptake rate was measured here.' },
  carbon_into_biomass_mol_per_day: { value: 8.0e-15, source: 'DESIGN INPUT: the carbon the design claims to turn into new biomass -- an 80 percent yield, which is where a designer optimistic about a chassis tends to land.' },
  carbon_respired_mol_per_day: { value: 4.0e-15, source: 'DESIGN INPUT: the carbon the design concedes it respires.' },
}, { generation: 5, why: 'the first set of numbers the designer proposed' });
await R.finding(5, 'performance_check (mass balance)', bad.verdict, bad.reading,
  { carbon_in: bad.carbon_in_mol_per_day, carbon_out: bad.carbon_out_mol_per_day, yield: bad.biomass_yield_C_per_C,
    model: bad.model, model_caveat: bad.model_caveat });

const good = await R.mcp('performance_check', { kind: 'mass_balance', taxon: 'Cupriavidus necator',
  carbon_uptake_mol_per_day: { value: 1.0e-14, source: 'DESIGN INPUT: unchanged.' },
  carbon_into_biomass_mol_per_day: { value: 5.5e-15, source: 'DESIGN INPUT, CORRECTED on the previous answer: a 55 percent yield, which is what is left once the respiration the design already conceded is paid for. The design did not get better; the claim got arithmetically possible.' },
  carbon_respired_mol_per_day: { value: 4.0e-15, source: 'DESIGN INPUT: unchanged.' },
}, { generation: 5, why: 'the same design with a claim that does not break conservation of mass' });
await R.finding(5, 'performance_check (mass balance, corrected)', good.verdict,
  good.reading + ' The correction is the loop doing its job: the first set of numbers was not pessimistic or optimistic, it was impossible, and the check said which atoms were missing rather than scoring the design badly.',
  { carbon_in: good.carbon_in_mol_per_day, carbon_out: good.carbon_out_mol_per_day, yield: good.biomass_yield_C_per_C,
    changed: 'carbon_into_biomass 8.0e-15 -> 5.5e-15 mol C/day', cannot_say: good.what_this_cannot_say });

R.writeGen({ generation: 5, asked: 'does the carbon add up?',
  phenotype: { taxon: 'Cupriavidus necator', counts, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [],
    metabolism: { first_claim: bad.verdict, corrected: good.verdict,
      biomass_yield_C_per_C: good.biomass_yield_C_per_C, changed: 'carbon_into_biomass 8.0e-15 -> 5.5e-15 mol C/day' } },
  genotype: { markers: R.markersOf(b1), cells_with_markers: b1.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged: nothing here connects a gene to a flux, which is the mechanism gap the mass-balance check states rather than hides.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { routing: spec5.routing?.performance_criteria?.length ? 'routed to performance_check' : 'unrouted',
    'performance_check (first claim)': bad.verdict, 'performance_check (corrected)': good.verdict },
  lean: {}, blueprint: 'gen/gen1.blueprint.json',
  what_it_taught: 'The request is answerable at last. The first numbers the designer proposed claimed more carbon leaving as biomass and CO2 than entered, which conservation of mass forbids outright -- and the check said impossible rather than unlikely. Corrected, the balance holds at a 55 percent yield. What the check still cannot say is everything about whether the organism could do it: no transporter kinetics, no energy budget, and carbon fixation is expensive in ATP rather than in carbon.' });

R.finish({ layers_exercised: ['blueprint', 'studio', 'lean', 'locomotion', 'ecology', 'routing', 'performance'],
  headline: 'Asked for a bacterium, the blueprint tool used to build an animal. Asked to swim with a paddle, the locomotion layer returns impossible by theorem. Asked whether it could live somewhere, the ecology layer assembles real records and refuses to predict exclusion from them. And asked whether it eats carbon -- which is the whole request, and reached no check at all until this round -- the mass balance says the first numbers proposed were impossible, and says which atoms were missing.' });
