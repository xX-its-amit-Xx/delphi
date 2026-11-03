#!/usr/bin/env node
// A XENOBOT THAT SWEEPS PARTICLES INTO A PILE.
//
//   node runs/xenobot/run.mjs [--offline]
//
// Chosen as a use case because a xenobot is not an organism, and every layer here was written as though its
// subject would be one. It is an assembly of cells taken from one animal, shaped into something that animal
// never makes, which has no taxon of its own, no genome of its own, no life cycle, no ancestors and no
// occurrence records -- and which moves, and does a job. The run is mostly a map of which layers notice.
//
// The task given to it is the one xenobots are actually described doing: moving loose particles into piles.
import path from 'node:path';
import { makeRun } from '../_lib/studio-run.mjs';

const QUESTION = 'Can we design a xenobot that sweeps loose particles into a pile?';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const offline = process.argv.includes('--offline');
const R = makeRun({ dir: HERE, question: QUESTION, author: 'agent:xenobot' });

console.log(`\n=== ${QUESTION}\n`);
await R.open();

// ===================================================================================================
// GENERATION 0 -- what IS it? Every layer wants a taxon and it does not have one.
// ===================================================================================================
await R.thinking(0, 'Start with the question every layer asks first and this subject cannot answer: what taxon is it? A xenobot is built from Xenopus laevis cells, so the CELLS have a taxon. The thing does not. Find out what each layer does when handed the taxon of its parts.');

const b0 = R.blueprint(0, 'Xenopus laevis with cilia that swims', { offline, runName: 'xenobot' });
const counts = b0.counts_distinct;
await R.finding(0, 'blueprint.mjs', 'wrong-subject',
  `the blueprint comes back for ${b0.reading.taxon.label}: ${counts.organ_system} organ systems, ${counts.organ} organs, ${counts.tissue} tissues, ${counts.cell} cell types. Every term is correct and the whole thing is about the wrong subject. That is a frog. A xenobot has no organ systems, no heart, no gut and no nervous system; it is a ball of skin and heart cells with cilia on the outside. The anatomy layer can describe the DONOR and has no way to express "an assembly of cells from this donor, in an arrangement the donor never makes".`,
  { taxon: b0.reading.taxon.label, taxid: b0.reading.taxon.taxid, counts,
    structures_read: (b0.reading.anatomy_words ?? []).map(a => a.label),
    the_gap: 'There is no construct layer. The blueprint vocabulary is taxon -> organ system -> organ -> tissue -> cell, and a xenobot is a cell-level assembly with nothing above it. Uberon has no term for it because it is not anatomy, and asking for one would be asking the ontology to describe an object that did not exist when it was written.' });

const doc0 = await R.mcp('organism_from_blueprint', { blueprint: 'runs/xenobot/gen/gen0.blueprint.json', id: 'xenobot-gen0', save: true, overwrite: true },
  { generation: 0, why: 'the donor blueprint into the studio' });
await R.finding(0, 'organism_from_blueprint', doc0?.error ? 'refused' : 'pass-but-wrong-subject',
  doc0?.error ? `refuses: ${String(doc0.error).slice(0, 200)}`
    : `the document is created and it is a document about ${doc0.taxon}, placed in ${(doc0.clades ?? []).slice(0, 3).join(' < ')}. The studio accepts it because it has no way to be told that the subject is a construct: there is no field for "made from, but not an instance of".`,
  { taxon: doc0?.taxon, placed: doc0?.taxon_placed_in_clade_table, counts: doc0?.counts, parameters: doc0?.parameters });

R.writeGen({ generation: 0, asked: 'the donor organism, as the nearest thing the layers can represent',
  phenotype: { taxon: b0.reading.taxon.label, counts, parameters: doc0?.parameters ?? null,
    structures_requested: (b0.reading.anatomy_words ?? []).map(a => a.label),
    structures_refused: (b0.reading.conflicts ?? []).map(c => c.label), flight_structures_present: [],
    subject_note: 'This phenotype is the DONOR\'s, not the construct\'s. Nothing in the record below describes a xenobot.' },
  genotype: { markers: R.markersOf(b0), by_cell: R.markerCellsOf(b0), cells_with_markers: b0.genome_sketch?.cells_with_markers ?? 0,
    cells_of: `${b0.genome_sketch?.cells_with_markers ?? 0} of ${b0.genome_sketch?.cells_total ?? 0} cell types`,
    note: 'Markers of Xenopus laevis cell types. A xenobot has the donor\'s genome unedited -- that is the point of it -- so the genotype layer is the one layer whose answer is arguably right, and it is right by accident: it was asked about the donor.' },
  mesh: { glb: null, why: 'no surface mesh. A xenobot is the one subject in runs/ whose shape is genuinely designed rather than inherited, and it is the one this repository has no builder for: anatomy-model/parametric is a parametric teleost builder.' },
  gates: { 'blueprint.mjs': 'wrong-subject', organism_from_blueprint: doc0?.error ? 'refused' : 'pass-but-wrong-subject' },
  lean: {}, blueprint: 'gen/gen0.blueprint.json',
  what_it_taught: 'Handed a construct, every layer that wants a taxon takes the donor\'s and carries on. Nothing is wrong with any individual answer and the subject is wrong throughout. This is the failure mode the rest of this repository has spent two runs removing from the clade logic, appearing again one level up: not a wrong clade, a wrong KIND of thing.' });

// ===================================================================================================
// GENERATION 1 -- locomotion, where the subject finally is the construct.
// ===================================================================================================
await R.thinking(1, 'The locomotion layer is the first one that does not need to know what kind of thing this is. It needs a length, a speed, a medium and a gait. A xenobot has all four, and the taxon it carries is only used for the flight modes. Ask it about ciliary swimming.');

const cil = await R.mcp('locomotion_check', {
  taxon: 'Xenopus laevis', mode: 'ciliary', medium: 'water',
  body_length_m: { min: 5e-4, max: 1e-3, source: 'DESIGN INPUT, swept: 0.5-1 mm across, the order of size a xenobot is described at. Not measured here.' },
  speed_m_s: { min: 1e-4, max: 5e-4, source: 'DESIGN INPUT, swept: 0.1-0.5 mm/s. The speed the design is asked for; not measured on any construct here.' },
  gait: { reciprocal: false, degrees_of_freedom: 4,
    description: 'cilia beating in metachronal waves: the power stroke is extended and nearly straight, the recovery stroke is curled and close to the surface, so the two follow DIFFERENT paths',
    cycle_hz: { min: 10, max: 30, source: 'DESIGN INPUT, swept: ciliary beat frequency asked of the design.' },
    distance_per_cycle_m: { min: 5e-6, max: 2e-5, source: 'DESIGN INPUT, swept: net advance per beat.' },
    source: 'DESIGN INPUT: the propulsion the design proposes, which is the propulsion xenobots are described using' },
}, { generation: 1, why: 'does a ciliated millimetre-scale construct move, and does its beat produce its speed?' });
const th = (cil.checks ?? []).find(c => c.id === 'reciprocal_stroke_at_low_reynolds');
await R.finding(1, 'locomotion_check', cil.verdict,
  `${cil.reading} Re is of order ${cil.reynolds.max.toExponential(1)}, which the convention in media.json puts inside the creeping regime, though at the very top of it where inertia is beginning to matter. The asymmetry between the power and recovery strokes is exactly what the theorem requires: two paths, not one path retraced. That asymmetry is the reason cilia are shaped the way they are, and it is a property of the GAIT, which no part list contains.`,
  { verdict: cil.verdict, reynolds: cil.reynolds, theorem: { verdict: th?.verdict, reading: th?.reading },
    checks: (cil.checks ?? []).map(c => ({ id: c.id, kind: c.kind, verdict: c.verdict })) });

const bad = await R.mcp('locomotion_check', {
  taxon: 'Xenopus laevis', mode: 'ciliary', medium: 'water',
  body_length_m: { min: 5e-4, max: 1e-3, source: 'DESIGN INPUT: unchanged.' },
  speed_m_s: { min: 1e-4, max: 5e-4, source: 'DESIGN INPUT: unchanged.' },
  gait: { reciprocal: true, degrees_of_freedom: 1, description: 'a single flap that extends and retracts along the same path, faster out than back', source: 'DESIGN INPUT: the obvious simpler alternative, offered to see whether the layer catches it' },
}, { generation: 1, why: 'the control: would the layer catch a reciprocal design at this size?' });
await R.finding(1, 'locomotion_check (control)', bad.verdict,
  `the same construct with a single-hinge flap instead of cilia: ${bad.verdict}. ${bad.reading} This is the control for the check above -- a layer that returned "fine" for both would not be telling us anything about either.`,
  { verdict: bad.verdict, reynolds: bad.reynolds });

R.writeGen({ generation: 1, asked: 'a 0.5-1 mm ciliated construct swimming at 0.1-0.5 mm/s',
  phenotype: { taxon: 'Xenopus laevis (donor)', counts, parameters: null, structures_requested: ['cilia'], structures_refused: [], flight_structures_present: [],
    declared: cil.inputs ?? null,
    locomotion: { mode: 'ciliary', verdict: cil.verdict, reynolds: cil.reynolds, control_with_reciprocal_gait: bad.verdict } },
  genotype: { markers: R.markersOf(b0), cells_with_markers: b0.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged: the construct is unedited donor cells.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { locomotion_check: cil.verdict, 'locomotion_check (control)': bad.verdict }, lean: {}, blueprint: 'gen/gen0.blueprint.json',
  what_it_taught: `The locomotion layer is the only one in this run whose subject is actually the construct, because it asks for quantities rather than for an identity. The ciliary design is not contradicted; the same construct with a single-hinge flap is ${bad.verdict === 'impossible' ? 'impossible by theorem' : bad.verdict}, which is the control that makes the first answer worth having.` });

// ===================================================================================================
// GENERATION 2 -- the task. "Sweeps particles into a pile" is not a locomotion mode.
// ===================================================================================================
await R.thinking(2, 'The design was asked to DO something: move loose particles into piles. That is not a shape, not a gait and not a scenario in this engine. Ask the functional layer, which is the one that exists to say what a design is for.');

const fn = await R.mcp('functional_resolution', { organism: 'xenobot-gen0',
  desired_phenotype: 'a millimetre-scale ciliated construct that pushes loose particles into piles as it moves' },
  { generation: 2, why: 'is the TASK expressible anywhere in this system?' });
await R.finding(2, 'functional_resolution', fn?.gate ? 'ran, no verdict' : 'refused',
  `the function registry holds four functions, all of them about fish and flight, and nothing about manipulating objects. The closest analogue it can name is ${fn?.closest_functional_analogue?.name ?? 'none'}. A task -- a thing the organism DOES TO THE WORLD, as distinct from a way it moves -- has no representation here at all.`,
  { gate: fn?.gate ?? null, function_asked_for: fn?.closest_functional_analogue?.function ?? null,
    function_signal: fn?.closest_functional_analogue?.function_signal ?? null,
    analogue: fn?.closest_functional_analogue?.name ?? null,
    the_gap: 'Three dimensions were asked for across these runs and the system has layers for two. Shape: the blueprint. Motion: the locomotion layer, added in this run. Task -- what the thing accomplishes, with what effect on what else -- has nothing. For a xenobot that is the entire point of the object.' });

R.writeGen({ generation: 2, asked: 'the task: sweeping loose particles into piles',
  phenotype: { taxon: 'Xenopus laevis (donor)', counts, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [],
    task: { asked: 'push loose particles into piles', representable: false, why: 'no task layer exists; the functional registry holds four fish-and-flight functions' } },
  genotype: { markers: R.markersOf(b0), cells_with_markers: b0.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { functional_resolution: fn?.gate ? 'ran, no verdict' : 'refused' }, lean: {}, blueprint: 'gen/gen0.blueprint.json',
  what_it_taught: 'The task is not expressible. Shape has a layer and motion now has one; what the organism DOES has neither a vocabulary nor a check, and for this subject that is the whole design brief.' });

// ===================================================================================================
// GENERATION 3 -- the world. An occurrence database cannot be asked about something that never existed.
// ===================================================================================================
await R.thinking(3, 'Last, the ecology layer, which should refuse hardest of all. Occurrence records are records of somebody finding the thing somewhere. A xenobot has never been anywhere outside a dish, so there is nothing to find and nothing to find it.');

const eco = await R.mcp('ecology_check', { taxon: 'Xenobot', offline }, { generation: 3, why: 'ask the occurrence databases about a thing that has no records, and check it refuses' });
await R.finding(3, 'ecology_check (as a construct)', eco.verdict ?? 'refused',
  `asked about "Xenobot" the layer ${eco.ran ? 'returned something' : 'refuses'}: ${String(eco.reason ?? eco.reading ?? '').slice(0, 260)}`,
  { verdict: eco.verdict, reason: eco.reason ?? null, resolved: eco.resolved ?? null });

const ecoDonor = await R.mcp('ecology_check', { taxon: 'Xenopus laevis',
  where: { name: 'the Western Cape, South Africa', bbox: [-34.4, -33.6, 18.3, 19.1], source: 'DESIGN INPUT: part of the donor species\' native range, chosen by the designer as the only place with any bearing on this subject at all.' },
  community_limit: 8, offline }, { generation: 3, why: 'the donor, which does have records -- and whether they transfer' });
await R.finding(3, 'ecology_check (donor)', ecoDonor.verdict ?? 'assembled',
  `${ecoDonor.reading} Every number here is about Xenopus laevis. A xenobot is 0.5 mm of ciliated donor tissue with no mouth, no gut, no gonads and a working life of days; it shares the genome and nothing else that an ecologist would use. Transferring this community, these predators or this range to the construct would be the error this whole run is about, so the run states the records and does not transfer them.`,
  { recorded_range: ecoDonor.recorded_range?.reading, community_scope: ecoDonor.community?.scoped_to?.clade,
    community: (ecoDonor.community?.species ?? []).map(s => `${s.species} (${s.records})`),
    recorded_predators: ecoDonor.interactions?.eatenBy?.total_taxa,
    cannot_say: ecoDonor.what_this_cannot_say });

R.writeGen({ generation: 3, asked: 'could it exist anywhere outside a dish',
  phenotype: { taxon: 'Xenopus laevis (donor)', counts, parameters: null, structures_requested: [], structures_refused: [], flight_structures_present: [],
    ecology: { as_construct: eco.verdict ?? 'refused',
      donor_records: ecoDonor.recorded_range?.total_records ?? null,
      donor_community_n: ecoDonor.community?.species?.length ?? 0,
      donor_predators: ecoDonor.interactions?.eatenBy?.total_taxa ?? 0,
      transfers_to_the_construct: false } },
  genotype: { markers: R.markersOf(b0), cells_with_markers: b0.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged.' },
  mesh: { glb: null, why: 'unchanged.' },
  gates: { 'ecology_check (as a construct)': eco.verdict ?? 'refused', 'ecology_check (donor)': ecoDonor.verdict ?? 'assembled' },
  lean: {}, blueprint: 'gen/gen0.blueprint.json',
  what_it_taught: 'Asked about the construct, the occurrence databases have nothing, which is the correct and only possible answer: they record where people found things, and nobody has ever found one. Asked about the donor they answer fully, and none of that answer is about the construct. An ecology layer handed a synthetic object can say where its parts came from and nothing whatever about where it could live.' });

R.finish({ layers_exercised: ['blueprint', 'studio', 'locomotion', 'functional', 'ecology'],
  headline: 'A xenobot is not an organism, and the layers that need it to be one take the donor\'s identity and carry on. The locomotion layer is the only one whose subject is really the construct, because it asks for quantities instead of an identity.',
  the_missing_layers: ['a CONSTRUCT layer: "made from taxon X, not an instance of it" is not expressible anywhere, so the donor\'s taxon, clades, anatomy and ecology are all silently inherited',
    'a TASK layer: what the design does to the world. Shape has a layer, motion now has one, and what the thing accomplishes has neither vocabulary nor check -- which for this subject is the entire brief.'] });
