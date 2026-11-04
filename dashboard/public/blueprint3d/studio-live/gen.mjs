#!/usr/bin/env node
// Bakes the snapshot that studio-live.html reads when no studio server is running.
//
//   node dashboard/public/blueprint3d/studio-live/gen.mjs [--run flying-mouse]
//
// Two sources, both already on disk and neither reshaped here:
//   sim-engine/sessions/<id>.jsonl    the Design Studio session log: the agent's comments and its findings,
//                                     in order, each with the tool, the verdict and the numbers as the tool
//                                     reported them
//   runs/<run>/gen/gen*.json          per-generation phenotype, genotype, declared inputs and gates
//
// The hierarchy for the 3D view is SLIMMED from each generation's blueprint: the blueprints are half a
// megabyte each, mostly provenance and pruning records, and the page needs ids, labels, levels and parents.
// The slim copy says what it dropped, and the full blueprint stays beside it in the run folder.
//
// This is a REPLAY. The page polls a live studio when one is reachable (POST /tool/session_read) and falls
// back to this file otherwise, and it says on screen which of the two it is showing -- a page that cannot
// tell you whether it is live is worse than one that is honestly stale.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
// With no --run, every run under runs/ that has a summary.json is baked, plus an index the page's run
// selector reads. A use case that has not been run yet simply is not in the index; nothing is invented for it.
const ROOT_RUNS = path.join(ROOT, 'runs');
const only = process.argv.includes('--run') ? process.argv[process.argv.indexOf('--run') + 1] : null;
const all = fs.readdirSync(ROOT_RUNS).filter(d => !d.startsWith('_') && fs.existsSync(path.join(ROOT_RUNS, d, 'summary.json')));
const runs = only ? [only] : all;
if (!runs.length) { console.error('no runs with a summary.json under runs/'); process.exit(1); }
const index = [];
for (const r of runs) bake(r);
if (!only) {
  fs.writeFileSync(path.join(HERE, 'index.json'), JSON.stringify({
    what: 'The runs studio-live.html can show. Each entry points at the baked replay of one Design Studio run.',
    built: new Date().toISOString(), runs: index }, null, 1));
  console.log(`index.json  ${index.length} runs`);
}

function bake(run) {
const RUN = path.join(ROOT, 'runs', run);
if (!fs.existsSync(RUN)) { console.error(`no run at runs/${run}`); process.exit(1); }

const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const summary = rd(path.join(RUN, 'summary.json'));
const sessionId = fs.existsSync(path.join(RUN, 'session.txt')) ? fs.readFileSync(path.join(RUN, 'session.txt'), 'utf8').trim() : summary.session;
const sessionFile = path.join(ROOT, 'sim-engine', 'sessions', `${sessionId}.jsonl`);
const entries = fs.existsSync(sessionFile) ? fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];

// Per generation: the record, plus a slim hierarchy for the 3D view.
const LEVELS = ['body', 'organ_system', 'organ', 'tissue', 'cell'];
const gens = fs.readdirSync(path.join(RUN, 'gen')).filter(f => /^gen\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3))).map(f => rd(path.join(RUN, 'gen', f)));

const hierarchies = {};
for (const g of gens) {
  // A generation can have no blueprint at all -- the bacterium's generation 0 is a refusal, and a refusal
  // has no hierarchy to draw. The page shows the panels and says so rather than failing to build.
  if (!g.blueprint) continue;
  const bpPath = path.join(RUN, g.blueprint.replace(/^gen\//, 'gen/'));
  if (!fs.existsSync(bpPath)) continue;
  const bp = rd(bpPath);
  const key = g.blueprint;
  if (hierarchies[key]) continue;
  const refused = new Set((bp.reading.conflicts ?? []).map(c => c.label));
  const asked = new Set((bp.reading.anatomy_words ?? []).map(a => a.label));
  hierarchies[key] = {
    taxon: bp.reading.taxon.label, taxid: bp.reading.taxon.taxid,
    counts: bp.counts_distinct,
    nodes: bp.nodes.map(n => ({ id: n.id, label: n.label, level: n.level, parent: n.parent,
      ...(asked.has(n.label) ? { asked: true } : {}), ...(/styliform/i.test(n.label) ? { flight: true } : {}) })),
    refused: [...refused],
    conflicts: (bp.reading.conflicts ?? []).map(c => ({ label: c.label, axiom: c.axiom, never_in_taxon: (c.never_in_taxon ?? []).map(n => n.label),
      counterexamples: (c.counterexamples ?? []).map(x => ({ taxon: x.taxon, taxid: x.taxid, inside_clade: x.inside_clade, common_names: x.common_names, reading: x.reading })),
      alternatives: (c.function_alternatives ?? []).flatMap(f => f.allowed_for_this_taxon.map(a => a.label)) })),
    dropped_from_the_blueprint: ['queries (13-15 SPARQL bodies with their responses)', 'pruning (what the per-parent limits cut)', 'genome_sketch markers (kept per generation in gen*.json instead)', 'per-node provenance', 'honesty block'],
    full: `runs/${run}/${g.blueprint}`,
  };
}

const out = {
  what: `A replay of one Design Studio run: ${summary.question}`,
  built_by: 'node dashboard/public/blueprint3d/studio-live/gen.mjs',
  built: new Date().toISOString(),
  is_live: false,
  live_hint: 'studio-live.html polls POST /tool/session_read on a running sim-engine/http.mjs and shows that instead when it answers. Start one with: node sim-engine/http.mjs',
  run, question: summary.question, session: sessionId, verdict: summary.verdict,
  tool_calls: summary.tool_calls,
  sources: { session: `sim-engine/sessions/${sessionId}.jsonl`, generations: `runs/${run}/gen/gen*.json`, logs: `runs/${run}/log/`, journal: `runs/${run}/journal.jsonl` },
  entries, generations: gens, hierarchies,
  honesty: {
    mesh: 'No generation of this animal has a measured surface mesh. anatomy-model/parametric is a parametric TELEOST-only builder, so no .glb of this animal was built by it (Blender itself is installed; that was never the reason). The 3D view here draws the ONTOLOGY HIERARCHY -- which structures the design has and what contains what -- and that is structure without shape: it cannot be flown, measured for area, or printed. The scale theatre (studio-live/theatre.html) now shows a Blender ILLUSTRATION mesh from sim-engine/scales/mesh/, sculpted from a textbook body plan and not measured.',
    declared: 'The mass, membrane area and airspeed in generations 1-3 are DESIGN INPUTS. Each carries a source string saying so. Nobody has measured a winged mouse and nothing here pretends otherwise.',
    verdicts: 'Every verdict on this page is the string the tool itself returned, with the numbers it returned, copied from the session log. Nothing is recomputed here and nothing is rounded for display except where the page shows a fixed number of decimals.',
  },
};
const dest = path.join(HERE, `${run}.json`);
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
// runs/flying-mouse was the first, and run.json is the name the page fell back to before there were several.
if (run === 'flying-mouse') fs.writeFileSync(path.join(HERE, 'run.json'), JSON.stringify(out, null, 1));
const kb = (fs.statSync(dest).size / 1024).toFixed(0);
index.push({ run, question: summary.question, file: `${run}.json`, generations: gens.length,
  layers: summary.layers_exercised ?? null, headline: summary.headline ?? null, verdict: summary.verdict ?? null });
console.log(`${path.relative(ROOT, dest).replace(/\\/g, '/')}  ${kb} KB`);
console.log(`  ${gens.length} generations, ${entries.length} session entries, ${Object.keys(hierarchies).length} hierarchies (${Object.values(hierarchies).map(h => h.nodes.length).join(', ') || 'none'} nodes)`);
}
