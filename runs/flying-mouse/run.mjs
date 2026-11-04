#!/usr/bin/env node
// A FLYING MOUSE, PUT THROUGH THE WHOLE SUITE, ONE GENERATION AT A TIME.
//
//   node runs/flying-mouse/run.mjs            [--offline] [--only 2] [--no-session]
//
// The question: can a mouse grow wings that actually support its flight?
//
// This is not a demonstration of a design that works. It is a recording of a design being refused, four
// times, by four different parts of the system, and of what each refusal forced the next generation to
// change. The point is the harness: a validation suite is only worth anything if it says no to a thing that
// does not work, for a reason you can act on, and if the reason is specific enough to be wrong.
//
// Every call goes through the MCP tool registrations in mcp/server.mjs -- the same objects the server hands
// an agent -- so nothing here can work in a way the MCP surface does not. Each call's arguments and full
// result land in runs/flying-mouse/log/, each generation's state in runs/flying-mouse/gen/, and every verdict
// is posted to a Design Studio session as a `finding`, which is what dashboard/public/blueprint3d/studio-live
// reads. Re-running it reproduces the same files; the SPARQL responses come from organism-design/cache.
//
// WHAT IS REAL HERE AND WHAT IS NOT:
//   real      the taxon, the clade placement, the Uberon/CL hierarchy, the taxon-constraint refusals and
//             their counterexamples, the Lean law verdicts, the lift coefficient and its source, and the
//             arithmetic of lift against weight
//   declared  the mass, the membrane area and the airspeed. These are design inputs with their sources
//             saying so. Nobody has measured a winged mouse.
//   absent    a MEASURED surface mesh. anatomy-model/parametric is a teleost-only builder (Blender itself is
//             installed), so it builds no .glb for this animal. What the studio-live 3D view shows is the
//             ontology hierarchy, which is a different thing and is labelled as one. The scale theatre draws a
//             Blender ILLUSTRATION mesh of a generic small quadruped (sim-engine/scales/mesh/), not measured.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TOOLS } from '../../mcp/server.mjs';

// Running this opens the 3D theatre on it, live. DELPHI_OPEN=0 runs headless. See runs/_lib/studio-run.mjs.
if (process.env.DELPHI_OPEN == null) process.env.DELPHI_OPEN = '1';
if (process.env.DELPHI_MESH == null) process.env.DELPHI_MESH = '1';   // and builds the illustration mesh, headless too; DELPHI_MESH=0 skips it

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
const LOG = path.join(HERE, 'log');
const GEN = path.join(HERE, 'gen');
const argv = process.argv.slice(2);
const flag = f => argv.includes('--' + f);
const only = argv.includes('--only') ? Number(argv[argv.indexOf('--only') + 1]) : null;
for (const d of [LOG, GEN]) fs.mkdirSync(d, { recursive: true });
// A full run starts from an empty log directory. Otherwise files from an earlier run with different step
// numbering survive beside the new ones and the folder reads as though calls happened that did not.
if (only == null) for (const f of fs.readdirSync(LOG)) fs.unlinkSync(path.join(LOG, f));

const byName = Object.fromEntries(TOOLS.map(([name, description, inputSchema, fn]) => [name, { name, description, fn }]));
const journal = path.join(HERE, 'journal.jsonl');
if (!only) fs.writeFileSync(journal, '');
let step = 0;
const note = entry => { fs.appendFileSync(journal, JSON.stringify({ i: step, ...entry }) + '\n'); };

/** Call an MCP tool, log the call and the whole result, and return the result. */
async function mcp(name, args, { generation = null, why = '' } = {}) {
  const t = byName[name];
  if (!t) throw new Error(`no MCP tool "${name}" is registered; mcp/cli.mjs tools lists ${TOOLS.length}`);
  step++;
  const file = `${String(step).padStart(2, '0')}-${name}${generation != null ? `-gen${generation}` : ''}.json`;
  const t0 = Date.now();
  let out, error = null;
  try { out = await t.fn(args); } catch (e) { error = String(e?.message ?? e); out = { error }; }
  const ms = Date.now() - t0;
  fs.writeFileSync(path.join(LOG, file), JSON.stringify({ tool: name, generation, why, args, ms, result: out }, null, 1));
  note({ type: 'call', tool: name, generation, why, ms, log: `log/${file}`, error });
  if (error) console.log(`  ! ${name}: ${error.slice(0, 160)}`);
  return out?.result ?? out;
}

/** Run a repository script and keep its output. */
function script(label, cmd, args, { generation = null } = {}) {
  step++;
  const file = `${String(step).padStart(2, '0')}-${label}${generation != null ? `-gen${generation}` : ''}.log`;
  let stdout = '', code = 0;
  try { stdout = execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { stdout = `${e.stdout ?? ''}${e.stderr ?? ''}`; code = e.status ?? 1; }
  fs.writeFileSync(path.join(LOG, file), `$ ${cmd} ${args.join(' ')}\n\n${stdout}`);
  note({ type: 'script', label, generation, cmd: `${cmd} ${args.join(' ')}`, exit: code, log: `log/${file}` });
  return { stdout, code };
}

// ---------------------------------------------------------------- the Design Studio session
let session = null;
const author = 'agent:flying-mouse';
async function finding(generation, tool, verdict, body, detail = {}) {
  note({ type: 'finding', generation, tool, verdict, body, detail });
  console.log(`  [gen ${generation}] ${tool}: ${verdict} -- ${body.slice(0, 120)}`);
  if (!session) return;
  await mcp('session_post', { session, author, kind: 'finding', tool, verdict, generation, body, detail });
}
async function thinking(generation, body) {
  note({ type: 'thinking', generation, body });
  console.log(`\n[gen ${generation}] ${body}`);
  if (session) await mcp('session_post', { session, author, kind: 'comment', body: `generation ${generation}: ${body}` });
}

// ---------------------------------------------------------------- generations
const QUESTION = 'Can a mouse grow wings that actually support its flight?';

/** Per-generation record: what was asked, what the system said, and what changed from the generation before. */
const record = [];
function writeGen(g) {
  const prev = record[record.length - 1] ?? null;
  const diff = prev ? {
    phenotype: Object.fromEntries(Object.keys(g.phenotype.counts ?? {}).map(k => [k, (g.phenotype.counts[k] ?? 0) - (prev.phenotype.counts?.[k] ?? 0)])),
    genotype_markers_added: (g.genotype.markers ?? []).filter(x => !(prev.genotype.markers ?? []).includes(x)),
    genotype_markers_removed: (prev.genotype.markers ?? []).filter(x => !(g.genotype.markers ?? []).includes(x)),
    gates_changed: Object.entries(g.gates).filter(([k, v]) => prev.gates[k] !== v).map(([k, v]) => `${k}: ${prev.gates[k] ?? 'not asked'} -> ${v}`),
  } : null;
  const out = { ...g, question: QUESTION, diff_from_previous: diff };
  record.push(out);
  fs.writeFileSync(path.join(GEN, `gen${g.generation}.json`), JSON.stringify(out, null, 1));
  // The live theatre: rebuild this run's ladder (and mesh) so an open page redraws. Off with DELPHI_OPEN=0 DELPHI_MESH=0.
  if (process.env.DELPHI_OPEN !== '0' || process.env.DELPHI_MESH !== '0') {
    try { execFileSync(process.execPath, [path.join(ROOT, 'sim-engine', 'scales', 'build.mjs'), '--run', 'flying-mouse', '--quiet', ...(process.env.DELPHI_MESH !== '0' ? ['--meshes'] : [])], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 }); } catch {}
  }
  note({ type: 'generation', ...out });
  return out;
}

// genome_sketch.markers is a LIST of {cell_label, gene_products:[{label}]}, one entry per cell type that
// carries an `expresses` annotation. Most cell types carry none, so this is a sketch of 9 cells out of 269
// and absence of a marker means nothing at all about the cell.
const markersOf = bp => [...new Set((bp.genome_sketch?.markers ?? []).flatMap(m => (m.gene_products ?? []).map(g => g.label)))].sort();
const markerCellsOf = bp => (bp.genome_sketch?.markers ?? []).map(m => ({ cell: m.cell_label, products: (m.gene_products ?? []).map(g => g.label) }));

async function blueprint(generation, text) {
  const out = path.join('runs', 'flying-mouse', 'gen', `gen${generation}.blueprint.json`);
  const r = script('blueprint', process.execPath, ['organism-design/blueprint.mjs', text, '--out', out, ...(flag('offline') ? ['--offline'] : [])], { generation });
  const f = path.join(ROOT, out);
  if (!fs.existsSync(f)) throw new Error(`blueprint.mjs wrote nothing for generation ${generation}:\n${r.stdout.slice(0, 1200)}`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

// ===================================================================================================
// GENERATION 0 -- ask for wings, in those words, and see what the ontologies do with the request.
// ===================================================================================================
async function gen0() {
  const generation = 0;
  await thinking(generation, 'Ask for exactly what was asked for: a mouse with wings that support its flight. No cleverness -- the first thing worth knowing is what the system says to the request as posed.');

  const spec = await mcp('parse_design_text', { text: 'I want to make a flying mouse: a mouse that grows wings that can actually support its flight.' }, { generation, why: 'the front door: text to a DesignSpec' });
  await finding(generation, 'parse_design_text', spec.validation?.ok ? 'pass' : 'fail',
    `the organism is placed as ${spec.taxon_resolution?.taxon} (taxid ${spec.taxon_resolution?.taxid}) and the flight requirement is read as a criterion, but validation stays false: there is no reference parameter set for this clade, so no criterion can be evaluated yet.`,
    { taxon: spec.taxon_resolution?.taxon, taxid: spec.taxon_resolution?.taxid, clades: spec.taxon_resolution?.clades,
      criteria: spec.spec?.criteria?.map(c => ({ scenario: c.scenario, op: c.op, metric: c.metric ?? null })), validation_ok: spec.validation?.ok,
      what_is_missing: spec.taxon_resolution?.what_is_missing });

  const bp = await blueprint(generation, 'a mouse with wings that can support its flight');
  const conflicts = bp.reading.conflicts ?? [];
  const cx = bp.reading.conflict_counterexamples ?? [];
  const alts = [...new Set(conflicts.flatMap(c => (c.function_alternatives ?? []).flatMap(f => f.allowed_for_this_taxon.map(a => a.label))))];
  const subs = conflicts.filter(c => c.substituted_by);
  await finding(generation, 'blueprint.mjs', conflicts.length ? 'refused' : 'pass',
    conflicts.length
      ? `Uberon refuses the requested structure: ${conflicts.map(c => `"${c.label}" is never_in_taxon ${(c.never_in_taxon ?? []).map(n => n.label).join(' + ')}`).join('; ')}. It does allow ${alts.join(' and ')} here for the same function.`
      : 'the requested structure was accepted',
    { taxon: bp.reading.taxon.label, counts: bp.counts_distinct, conflicts, counterexamples: cx, alternatives_allowed: alts });

  // The substitution is the part that is easy to miss, and the part that would have misled me.
  if (subs.length) {
    await finding(generation, 'blueprint.mjs/substitution', 'substituted',
      `the blueprint DOES contain a flight-related structure, and not because the request was honoured: ${subs.map(c => c.substitution_warning).join(' ')} I read this hierarchy as "no flight structure" on the first pass and was wrong; the tool now says it in the result rather than leaving it to be inferred from a node list.`,
      { substituted: subs.map(c => ({ refused: c.label, by: c.substituted_by })), promoted: bp.reading.structures_promoted_from_function_words });
  }

  if (cx.length) {
    await finding(generation, 'blueprint.mjs/axiom-audit', 'contradicted',
      `the axiom that refused the request is contradicted by this repository's own data: ${cx.map(x => `${x.taxon} (taxid ${x.taxid}), written in organisms/merged/taxa.json as "${x.common_names.join('", "')}", is inside ${x.inside_clade}`).join('; ')}. A gliding rodent is inside the clade for which the gliding membrane is asserted never to occur. The structure is still kept out -- an ontology defect is a decision for a person, not something a blueprint run overrules.`,
      { counterexamples: cx });
  }

  const doc = await mcp('organism_from_blueprint', { blueprint: path.join('runs', 'flying-mouse', 'gen', `gen${generation}.blueprint.json`), id: `flying-mouse-gen${generation}`, save: true, overwrite: true },
    { generation, why: 'blueprint into the Design Studio' });
  await finding(generation, 'organism_from_blueprint', 'pass',
    `the document exists and is real where it can be: taxon ${doc.taxon}, placed in ${doc.clades?.slice(0, 4).join(' < ')}, ${doc.counts?.organ} organs and ${doc.counts?.cell} cell types from the ontologies. Every parameter is null, with the reason: this engine holds measured body-plan parameters for its own teleosts only.`,
    { taxon: doc.taxon, placed: doc.taxon_placed_in_clade_table, counts: doc.counts, parameters: doc.parameters, what_runs_now: doc.what_runs_now });

  const lean = await mcp('lean_check', { design: { taxon: doc.taxon, id: `flying-mouse-gen${generation}` } }, { generation, why: 'Lean for biology: which laws even apply to this animal' });
  const tally = (lean.rows ?? lean.verdicts ?? []).reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {});
  await finding(generation, 'lean_check', Object.keys(tally).length ? 'ran' : 'empty',
    `the law layer runs and has no opinion yet: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', ')}. Every out-of-scope verdict names this animal's real lineage, and every cannot-evaluate names the body-plan quantity it wanted.`,
    { tally, lawset: lean.lawset_version ?? null });

  const gates = {};
  for (const [tool, args] of [
    ['organism_get', { organism: `flying-mouse-gen${generation}` }],
    ['physics_check', { organism: `flying-mouse-gen${generation}` }],
    ['closest_relative_phenotype', { organism: `flying-mouse-gen${generation}` }],
    ['closest_relative_genotype', { organism: `flying-mouse-gen${generation}` }],
    ['functional_resolution', { organism: `flying-mouse-gen${generation}`, desired_phenotype: 'a mouse that flies under its own power on grown wings' }],
  ]) {
    const r = await mcp(tool, args, { generation, why: 'the validation harness, asked about an animal it holds no parameters for' });
    const refused = !!(r?.error || r?.ran === false || r?.cannot_assess || r?.gate === 'cannot-assess');
    // A gate's own sentence can be a paragraph. The strip needs a token; the sentence goes in the detail.
    const sentence = String(r?.gate ?? r?.verdict ?? 'ran');
    gates[tool] = refused ? 'refused' : sentence.length > 24 ? 'ran, no verdict' : sentence;
    await finding(generation, tool, gates[tool],
      refused ? `refuses by name: ${String(r?.error ?? r?.reason ?? r?.cannot_assess?.reason ?? 'no reference set covers this clade').slice(0, 280)}`
        : `ran, and reached no verdict: "${sentence}"`,
      { refused, gate_sentence: sentence, reason: r?.error ?? r?.reason ?? r?.cannot_assess ?? null,
        ...(tool === 'functional_resolution' ? { function_asked_for: r?.closest_functional_analogue?.function ?? null,
          function_signal: r?.closest_functional_analogue?.function_signal ?? null,
          analogue_found: r?.closest_functional_analogue?.name ?? null,
          why_no_analogue: 'the functional registry holds no powered flier: birds are the frozen held-out clade and no bat is in it, so there is no real organism here to compare a powered-flight design against' } : {}) });
  }

  const fs0 = await mcp('flight_support_check', { taxon: doc.taxon, question: QUESTION }, { generation, why: 'the aerodynamic question, with nothing declared yet' });
  gates.flight_support_check = fs0.verdict;
  await finding(generation, 'flight_support_check', fs0.verdict,
    `asked whether the wings carry the mouse with nothing declared, it refuses and names each missing quantity rather than defaulting one: ${(fs0.what_is_missing ?? []).join('; ')}.`,
    { what_is_missing: fs0.what_is_missing, reason: fs0.reason });

  return writeGen({ generation, asked: 'a mouse with wings that can support its flight',
    phenotype: { taxon: bp.reading.taxon.label, counts: bp.counts_distinct, parameters: doc.parameters,
      structures_requested: bp.reading.anatomy_words.map(a => a.label), structures_refused: conflicts.map(c => c.label),
      flight_structures_present: (bp.reading.structures_promoted_from_function_words ?? []).map(x => x.label),
      flight_structures_present_note: 'These were NOT asked for. They are in the blueprint because the word "flight" was recognised and the ontology records them as capable of it for this taxon; the structure that WAS asked for was refused. See conflicts[].substitution_warning.' },
    genotype: { markers: markersOf(bp), by_cell: markerCellsOf(bp), cells_of: `${bp.genome_sketch?.cells_with_markers ?? 0} of ${bp.genome_sketch?.cells_total ?? 0} cell types`, cells_with_markers: bp.genome_sketch?.cells_with_markers ?? 0,
      note: 'marker gene products the Cell Ontology records for the chosen cell types. It is a sketch of what those cells express, not a genome and not a genotype anyone sequenced.' },
    mesh: { glb: null, why: 'no measured surface mesh. anatomy-model/parametric is a teleost-only builder (Blender is installed; that is not the reason); the studio-live 3D view is the ontology hierarchy, which is structure without shape. The scale theatre shows an illustration mesh from sim-engine/scales/mesh/, not a measurement.' },
    gates, lean: tally, blueprint: `gen/gen${generation}.blueprint.json`,
    what_it_taught: 'The request as posed cannot be built: Uberon asserts that a wing never occurs in Glires, so the blueprint of a winged mouse has no wing in it -- and TWO OTHER STRUCTURES IN ITS PLACE, promoted from the word "flight", which the first reading of this hierarchy missed entirely. The refusal is contradicted by the project inventory, which holds a gliding rodent inside that same clade. Separately, every harness tool refuses for want of a parameter set -- correctly, and by name.' });
}

// ===================================================================================================
// GENERATION 1 -- take the structure the ontology DOES allow, and declare the first aerodynamic inputs.
// ===================================================================================================
async function gen1() {
  const generation = 1;
  await thinking(generation, 'Generation 0 refused "wing" and named what it does allow here: the styliform cartilage and the styliform element, the wrist strut that tensions a gliding membrane. So name the mammalian glider outright -- a patagium AND a styliform cartilage -- and see which half the ontology will give. Then declare the three quantities the aerodynamics needs, each with a source saying it is a design input and not a measurement.');

  const bp = await blueprint(generation, 'a mouse with a patagium and a styliform cartilage that can support its flight');
  const asked = (bp.reading.anatomy_words ?? []).map(a => a.label);
  const conflicts = bp.reading.conflicts ?? [];
  const refused = conflicts.map(c => c.label);
  const present = [...new Set(bp.nodes.filter(n => asked.includes(n.label)).map(n => n.label))];
  await finding(generation, 'blueprint.mjs', refused.length ? 'part-refused' : 'pass',
    `asked for a patagium and a styliform cartilage, the ontology gives one and refuses the other: ${present.join(', ') || 'nothing'} is in the hierarchy, and ${refused.join(', ')} ${refused.length === 1 ? 'is' : 'are'} never_in_taxon ${[...new Set(conflicts.flatMap(c => (c.never_in_taxon ?? []).map(n => n.label)))].join(' + ')}. A mouse may have the strut that tensions a flight membrane and may not have the membrane. That is the shape of the whole result: the skeleton of flight is permitted in this clade and the surface that would carry the air is not.`,
    { asked, present, refused, counts: bp.counts_distinct,
      counterexamples: (bp.reading.conflict_counterexamples ?? []).map(x => ({ taxon: x.taxon, inside_clade: x.inside_clade, common_names: x.common_names })) });

  const doc = await mcp('organism_from_blueprint', { blueprint: path.join('runs', 'flying-mouse', 'gen', `gen${generation}.blueprint.json`), id: `flying-mouse-gen${generation}`, save: true, overwrite: true },
    { generation, why: 'the revised blueprint into the studio' });

  // The three declared quantities. The membrane area is the design's own proposal; the launch speed is what a
  // jumping mouse is asked to reach; the mass is swept, because "a mouse weighs 25 g" is a claim about a
  // population and the answer can change inside it.
  const inputs = {
    mass_kg: { min: 0.015, max: 0.030, source: 'DESIGN INPUT, swept: the mass the wings are asked to carry. No measurement of any mouse is asserted here; the range is stated by the designer and the verdict is reported across all of it.' },
    lifting_area_m2: { value: 0.0070, source: 'DESIGN INPUT: 70 cm2 of membrane, roughly a mouse-sized body outline spread between fore and hind limbs. It is what this generation proposes, not a measurement.' },
    airspeed_m_s: { min: 2.0, max: 3.0, source: 'DESIGN INPUT: the airspeed a mouse-sized jump launch is asked to reach. Not measured on any animal here.' },
  };
  const r = await mcp('flight_support_check', { taxon: doc.taxon, ...inputs }, { generation, why: 'does lift carry the weight at the speed a jump can give it?' });
  await finding(generation, 'flight_support_check', r.verdict, r.reading,
    { lift_over_weight: r.lift_over_weight, area_required_m2: r.best_corner?.area_required_m2, minimum_airspeed_m_s: r.minimum_airspeed_m_s,
      C_Lmax: r.lift_coefficient?.C_Lmax, C_Lmax_kind: r.lift_coefficient?.kind, C_Lmax_source: r.lift_coefficient?.source, C_Lmax_caveat: r.lift_coefficient?.caveat,
      weakest_input: r.weakest_input, inputs: r.inputs });

  const lean = await mcp('lean_check', { design: { taxon: doc.taxon, id: `flying-mouse-gen${generation}` } }, { generation, why: 'the law layer, on the revised design' });
  const tally = (lean.rows ?? lean.verdicts ?? []).reduce((a, x) => ({ ...a, [x.verdict]: (a[x.verdict] ?? 0) + 1 }), {});

  return writeGen({ generation, asked: 'a mouse with a patagium and a styliform cartilage that can support its flight',
    phenotype: { taxon: bp.reading.taxon.label, counts: bp.counts_distinct, parameters: doc.parameters,
      structures_requested: asked, structures_refused: refused, flight_structures_present: present,
      declared: Object.fromEntries(Object.entries(r.inputs ?? {}).map(([k, v]) => [k, v])) },
    genotype: { markers: markersOf(bp), by_cell: markerCellsOf(bp), cells_of: `${bp.genome_sketch?.cells_with_markers ?? 0} of ${bp.genome_sketch?.cells_total ?? 0} cell types`, cells_with_markers: bp.genome_sketch?.cells_with_markers ?? 0, note: 'as generation 0; the diff shows what the new structure brought with it.' },
    mesh: { glb: null, why: 'unchanged: no surface mesh exists for this animal.' },
    gates: { flight_support_check: r.verdict }, lean: tally, blueprint: `gen/gen${generation}.blueprint.json`,
    what_it_taught: `Half the request is buildable: the ontology allows the styliform cartilage in a mouse and refuses the patagium in the same breath, so the strut is in the hierarchy and the membrane is not. With the three quantities declared, the aerodynamics stops refusing and returns a number, and the number is a no: ${r.reading}` });
}

// ===================================================================================================
// GENERATION 2 -- act on the shortfall. The check named two levers; take the one with a precedent.
// ===================================================================================================
async function gen2() {
  const generation = 2;
  await thinking(generation, 'Generation 1 is short by a factor of 2.6 and the check named both ways out: 180 cm2 of membrane at a jump launch, or 4.8 m/s at the 70 cm2 proposed. The second has a precedent -- Bishop 2006 launched flying squirrels from 4 m, and a 4 m drop is worth about 8.9 m/s before drag -- so this generation stops asking the mouse to jump into flight and lets it fall into a glide. That is a change to the question as much as to the animal, and it is recorded as one.');

  const doc = `flying-mouse-gen1`;
  const taxon = 'Mus musculus';
  const inputs = {
    mass_kg: { min: 0.015, max: 0.030, source: 'DESIGN INPUT, swept, unchanged from generation 1.' },
    lifting_area_m2: { value: 0.0070, source: 'DESIGN INPUT, unchanged from generation 1: 70 cm2 of membrane.' },
    airspeed_m_s: { min: 4.8, max: 8.9, source: 'DESIGN INPUT: a drop rather than a jump. 8.9 m/s is sqrt(2gh) for the h = 4 m launch height Bishop 2006 (J Exp Biol 209:689-701, doi 10.1242/jeb.02062) used for Glaucomys volans, ignoring drag, so it is an upper bound on what the drop can give; 4.8 m/s is the minimum generation 1 said this area needs at the light end. Neither is a measured airspeed of anything.' },
  };
  const r = await mcp('flight_support_check', { taxon, ...inputs }, { generation, why: 'the same wings, entered from a drop instead of a jump' });
  await finding(generation, 'flight_support_check', r.verdict, r.reading,
    { lift_over_weight: r.lift_over_weight, minimum_airspeed_m_s: r.minimum_airspeed_m_s, corners: r.corners,
      C_Lmax: r.lift_coefficient?.C_Lmax, C_Lmax_kind: r.lift_coefficient?.kind, C_Lmax_caveat: r.lift_coefficient?.caveat, weakest_input: r.weakest_input });

  // The caveat is not a footnote: the only mammal coefficient here was measured on animals losing height.
  await finding(generation, 'flight_support_check/caveat', 'qualified',
    'the coefficient that produced this verdict was measured on gliding mammals that were NOT supporting their own weight. Bishop 2007 (doi 10.1242/jeb.002071) reports Petaurus breviceps accelerating downward at 1.0 +/- 0.5 m/s2 in the same glides the 1.48 came from, and states that body weight was not fully supported by aerodynamic force. So "carries" here means the steady-state inequality closes at an airspeed only a fall can supply, using a coefficient borrowed from animals that were themselves descending.',
    { C_Lmax_caveat: r.lift_coefficient?.caveat, source: r.lift_coefficient?.source, doi: r.lift_coefficient?.doi });

  const bp = JSON.parse(fs.readFileSync(path.join(GEN, 'gen1.blueprint.json'), 'utf8'));
  return writeGen({ generation, asked: 'the generation-1 animal, entering flight from a 4 m drop instead of a jump',
    phenotype: { taxon, counts: bp.counts_distinct, parameters: null,
      structures_requested: bp.reading.anatomy_words.map(a => a.label), structures_refused: (bp.reading.conflicts ?? []).map(c => c.label),
      flight_structures_present: [...new Set(bp.nodes.filter(n => (bp.reading.anatomy_words ?? []).map(a => a.label).includes(n.label)).map(n => n.label))],
      declared: r.inputs ?? null },
    genotype: { markers: markersOf(bp), by_cell: markerCellsOf(bp), cells_of: `${bp.genome_sketch?.cells_with_markers ?? 0} of ${bp.genome_sketch?.cells_total ?? 0} cell types`, cells_with_markers: bp.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged from generation 1: this generation changed the question, not the animal.' },
    mesh: { glb: null, why: 'unchanged: no surface mesh exists for this animal.' },
    gates: { flight_support_check: r.verdict }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
    what_it_taught: `Lift reaches weight, but only at an airspeed a fall supplies, and only under a coefficient borrowed from animals that were themselves losing height. ${r.reading}` });
}

// ===================================================================================================
// GENERATION 3 -- ask the question that was actually asked. "Support its flight" means flight, not falling.
// ===================================================================================================
async function gen3() {
  const generation = 3;
  await thinking(generation, 'Generation 2 closed the inequality by letting the animal fall. That is a glide, and the question was flight -- wings that SUPPORT it. So ask the check the question as posed, with powered flight stated, and see whether it has the decency to refuse.');

  const r = await mcp('flight_support_check', { taxon: 'Mus musculus', powered: true, question: QUESTION,
    mass_kg: { min: 0.015, max: 0.030, source: 'DESIGN INPUT, swept, unchanged.' },
    lifting_area_m2: { value: 0.0070, source: 'DESIGN INPUT, unchanged.' },
    airspeed_m_s: { min: 4.8, max: 8.9, source: 'DESIGN INPUT, unchanged.' },
  }, { generation, why: 'the question as asked: powered flight, not a glide' });
  await finding(generation, 'flight_support_check', r.verdict,
    `asked about powered flight it refuses, and says why the refusal is not pedantry: ${r.reason}`,
    { what_is_missing: r.what_is_missing, what_this_can_answer: r.what_this_can_answer });

  const pc = await mcp('physics_check', { organism: 'flying-mouse-gen1' }, { generation, why: 'the full physics path, one more time, on the revised design' });
  await finding(generation, 'physics_check', pc?.ran === false ? 'refused' : 'ran',
    pc?.ran === false ? `still refuses, and should: ${String(pc.reason ?? '').slice(0, 260)}` : 'ran',
    { ran: pc?.ran, reason: pc?.reason ?? null });

  const bp = JSON.parse(fs.readFileSync(path.join(GEN, 'gen1.blueprint.json'), 'utf8'));
  return writeGen({ generation, asked: 'powered flight: wings that support the animal, not a membrane that slows its fall',
    phenotype: { taxon: 'Mus musculus', counts: bp.counts_distinct, parameters: null,
      structures_requested: bp.reading.anatomy_words.map(a => a.label), structures_refused: (bp.reading.conflicts ?? []).map(c => c.label),
      flight_structures_present: [...new Set(bp.nodes.filter(n => (bp.reading.anatomy_words ?? []).map(a => a.label).includes(n.label)).map(n => n.label))], declared: null },
    genotype: { markers: markersOf(bp), by_cell: markerCellsOf(bp), cells_of: `${bp.genome_sketch?.cells_with_markers ?? 0} of ${bp.genome_sketch?.cells_total ?? 0} cell types`, cells_with_markers: bp.genome_sketch?.cells_with_markers ?? 0, note: 'unchanged.' },
    mesh: { glb: null, why: 'unchanged: no surface mesh exists for this animal.' },
    gates: { flight_support_check: r.verdict, physics_check: pc?.ran === false ? 'refused' : 'ran' }, lean: {}, blueprint: 'gen/gen1.blueprint.json',
    what_it_taught: 'The question as asked is not answerable by this repository, and the system says so instead of answering a nearby question it can do. An area check cannot settle a power question; what is missing is a lift coefficient measured through a wingbeat and a flight-muscle power density for the clade.' });
}

// ===================================================================================================
// GENERATION 4 -- stop asking one check in isolation. Put the declared design through the WHOLE pipeline.
// ===================================================================================================
async function gen4() {
  const generation = 4;
  await thinking(generation, 'Generations 1 to 3 asked flight_support_check directly, because physics_check refused outright: it runs scenario modules over a resolved STATE, a taxon base resolved no STATE at all, and that was the end of it for any organism outside the bundle. A design can now DECLARE the quantities it is willing to state, each with a source, and they enter STATE as kind "assumed". So declare them and run the real pipeline.');

  const declared = { parameters: {
    mass_kg: { value: 0.025, unit: 'kg', source: 'DESIGN INPUT: the mass the wings are asked to carry. Stated by the designer; no mouse was weighed for this.' },
    lifting_area_m2: { value: 0.0070, unit: 'm2', source: 'DESIGN INPUT: 70 cm2 of membrane, the area this design proposes.' },
    launch_airspeed_m_s: { value: 8.9, unit: 'm/s', source: 'DESIGN INPUT: sqrt(2gh) for the h = 4 m launch height Bishop 2006 used for Glaucomys volans, ignoring drag, so an upper bound on what a drop can give. Not a measured airspeed of anything.' },
  },
  // A declared growth track, so the age axis resolves a different STATE at each stage rather than one
  // number repeated. The lifting area is declared ONLY at the adult, because this design is a claim about an
  // adult mouse: a pup has no membrane and the honest result at that age is a null with a reason, not a
  // smaller wing. Every value is a design input; no mouse was weighed for any of them.
  life_stages: [
    { key: 'neonate', label: 'neonate', ageDays: 1, parameters: {
      mass_kg: { value: 0.0015, unit: 'kg', source: 'DESIGN INPUT: order of a gram and a half at birth. Stated by the designer; no mouse was weighed.' } } },
    { key: 'juvenile', label: 'juvenile, around weaning', ageDays: 21, parameters: {
      mass_kg: { value: 0.010, unit: 'kg', source: 'DESIGN INPUT: order of ten grams around weaning. Stated, not measured.' } } },
    { key: 'adult', label: 'adult', ageDays: 60, parameters: {
      mass_kg: { value: 0.025, unit: 'kg', source: 'DESIGN INPUT: the mass the wings are asked to carry. Stated by the designer; no mouse was weighed for this.' },
      lifting_area_m2: { value: 0.0070, unit: 'm2', source: 'DESIGN INPUT: 70 cm2 of membrane, the area this design proposes. Declared at the adult stage only, because the claim is about an adult.' } } },
  ] };

  const doc = await mcp('organism_create', { id: 'flying-mouse-declared', taxon: 'Mus musculus', overwrite: true, declared,
    notes: 'the generation-1 animal with the three aerodynamic quantities declared, so the whole physics pipeline can be run on it' },
    { generation, why: 'a taxon base WITH a declared parameter set' });
  await finding(generation, 'organism_create (declared)', doc?.error ? 'refused' : 'pass',
    doc?.error ? `refuses: ${String(doc.error).slice(0, 200)}`
      : 'the document carries three declared quantities, each with a source saying the designer stated it. The caveat on the document says so too, and every value enters STATE as kind "assumed" so the weakest-input machinery and every model_confidence downstream carry it.',
    { declared: Object.keys(declared.parameters), caveat: doc?.doc?.caveat ?? null });

  const got = await mcp('organism_get', { organism: 'flying-mouse-declared' }, { generation, why: 'does a STATE resolve for a mouse now?' });
  await finding(generation, 'organism_get', got?.error ? 'refused' : 'ran',
    got?.error ? `still refuses: ${String(got.error).slice(0, 200)}`
      : 'a STATE resolves for a mouse. Three fields have values because the design declared them; every other field is null with its reason. In generation 0 this tool refused outright, and that refusal blocked everything built on a STATE -- which is every scenario and every standing check.',
    { declared_fields: Object.keys(declared.parameters) });

  const pc = await mcp('physics_check', { organism: 'flying-mouse-declared' }, { generation, why: 'the whole physics pipeline, on a mouse' });
  const standing = pc?.standing_checks ?? [];
  const lift = standing.find(c => c.id === 'lifting_area_supports_mass');
  await finding(generation, 'physics_check', pc?.ran === false ? 'refused' : 'ran',
    pc?.ran === false ? `still refuses: ${String(pc.reason ?? '').slice(0, 220)}`
      : `it runs. ${standing.length} standing checks, and each one that cannot answer now names the STATE field it wanted instead of the whole tool refusing: ${standing.map(c => `${c.id}=${c.status}`).join(', ')}.`,
    { ran: pc?.ran, standing: standing.map(c => ({ id: c.id, status: c.status, limiting_factor: c.limiting_factor })) });

  await finding(generation, 'physics_check/lifting_area_supports_mass', lift?.status ?? 'absent',
    lift && lift.status !== 'no model'
      ? `the aerodynamic verdict now comes out of the FULL pipeline rather than a check called by hand: ${lift.measured != null ? `${(lift.measured * 1e4).toFixed(1)} cm2 against the ${(lift.threshold * 1e4).toFixed(1)} cm2 needed` : 'see detail'}, with C_Lmax ${lift.detail?.C_Lmax} taken by clade and labelled ${lift.detail?.C_Lmax_kind}. Same number as generation 2 reached directly, by a different route, which is the point: the layers agree because they share one coefficient policy.`
      : `could not be evaluated: ${lift?.limiting_factor ?? 'check absent'}`,
    { status: lift?.status, measured_m2: lift?.measured, threshold_m2: lift?.threshold, detail: lift?.detail });

  return writeGen({ generation, asked: 'the generation-1 animal with its three quantities declared, through the whole physics pipeline',
    phenotype: { taxon: 'Mus musculus', counts: null, parameters: 'declared',
      structures_requested: [], structures_refused: [], flight_structures_present: [],
      declared: Object.fromEntries(Object.entries(declared.parameters).map(([k, v]) => [k, { min: v.value, max: v.value, unit: v.unit, kind: 'assumed', source: v.source }])) },
    genotype: { markers: [], cells_with_markers: 0, note: 'unchanged: this generation declared quantities, not genes.' },
    mesh: { glb: null, why: 'unchanged: no surface mesh exists for this animal.' },
    gates: { organism_create: doc?.error ? 'refused' : 'pass', organism_get: got?.error ? 'refused' : 'ran',
      physics_check: pc?.ran === false ? 'refused' : 'ran', lifting_area_supports_mass: lift?.status ?? 'absent' },
    lean: {}, blueprint: 'gen/gen1.blueprint.json',
    what_it_taught: `The refusals in generation 0 were not about the mouse. organism_get and physics_check refused because a taxon base resolved no STATE, and a design that declares its quantities -- with sources, as every other check in this repository already required -- resolves one. physics_check now runs on a mouse and each standing check that still cannot answer names the field it wanted. The aerodynamic verdict agrees with the one generation 2 got by calling the check directly.` });
}

// ---------------------------------------------------------------- run
console.log(`\n=== ${QUESTION}\n`);
if (!flag('no-session')) {
  const s = await mcp('session_open', { title: 'flying mouse: can a mouse grow wings that support its flight', author, run: 'flying-mouse' }, { why: 'the Design Studio co-design log this run writes to, and the 3D theatre it opens' });
  if (s?.theatre?.url) console.log(`theatre: ${s.theatre.url}${s.theatre.launched ? '  (opened)' : ''}`);
  session = s.session;
  console.log(`session: ${session}  (sim-engine/sessions/${session}.jsonl)`);
  fs.writeFileSync(path.join(HERE, 'session.txt'), session + '\n');
}

const gens = [gen0, gen1, gen2, gen3, gen4];
for (let i = 0; i < gens.length; i++) { if (only != null && only !== i) continue; await gens[i](); }

const summary = { question: QUESTION, built: new Date().toISOString(), session,
  generations: record.map(g => ({ generation: g.generation, asked: g.asked, gates: g.gates, what_it_taught: g.what_it_taught })),
  verdict: record.find(g => g.generation === 3)?.what_it_taught ?? null,
  tool_calls: step, journal: 'journal.jsonl', logs: 'log/' };
fs.writeFileSync(path.join(HERE, 'summary.json'), JSON.stringify(summary, null, 1));
console.log(`\n${step} tool calls and scripts, all logged under runs/flying-mouse/log/`);
console.log(`generations: ${record.map(g => `${g.generation}:${Object.values(g.gates).join('/')}`).join('  ')}`);
