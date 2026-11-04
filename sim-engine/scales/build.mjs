#!/usr/bin/env node
// Builds the scale ladder for every generation of a run, and the index the theatre view reads.
//
//   node sim-engine/scales/build.mjs                  # every run under runs/ with a summary.json
//   node sim-engine/scales/build.mjs --run xenobot    # one run
//   node sim-engine/scales/build.mjs --quiet
//   node sim-engine/scales/build.mjs --meshes         # also build the illustration GLBs with Blender (or DELPHI_MESH=1)
//   node sim-engine/scales/build.mjs --meshes --force-meshes   # rebuild them even when cached
//
// Writes:
//   runs/<run>/scales/gen<N>.json                                   the ladder, one file per generation
//   runs/<run>/scales/index.json                                    what this run has
//   dashboard/public/blueprint3d/studio-live/scales/<run>.json      the same, bundled for the page
//   dashboard/public/blueprint3d/studio-live/scales/index.json       the run selector
//   dashboard/public/blueprint3d/studio-live/meshes/<frame>-<hash>.{glb,json}   only with --meshes / DELPHI_MESH=1
//
// MESHES. Every ladder gains `ladder.mesh` (sim-engine/scales/mesh/): the spec hash of its illustration
// mesh and whether it was built. Without --meshes or DELPHI_MESH=1 nothing launches Blender: the hash is
// still computed so the page can use a GLB an earlier build left, and the status says 'not-requested'.
// With it, a missing GLB is built synchronously (a cached one is reused instantly), so the bundle and its
// GLB appear together for a live page, and generated meshes OF THE FRAMES IT BUILT that no bundle on disk
// references any more are pruned (other frames' files are never touched).
//
// Nothing is invented for a generation that has no blueprint. The bacterium's generation 0 is a refusal and
// a refusal has no body, so it appears in the index with `body: false` and the page says so.
//
// The life-stage track is RESOLVED BY THE ENGINE, not read off a file: for each generation this script
// replays the organism the run created, then calls organism_get once per declared life stage. That means the
// ages in the theatre's scrubber are ages the engine actually resolved a STATE at, and a quantity that is
// null at one age is null because the engine said so.
import fs from 'node:fs';
import path from 'node:path';
import { TOOLS } from '../../mcp/server.mjs';
import { scaleLadder, loadScaleData, CONTRACT_VERSION } from '../lib/scales.mjs';
import * as taxonomy from '../../lib/lean-taxonomy.mjs';
import { liftCoefficientFor } from '../validate/physics/standing.mjs';
import { meshField, wantMeshes, pruneMeshes, framesTouched } from './mesh/blender.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
const byName = Object.fromEntries(TOOLS.map(([name, , , fn]) => [name, fn]));
const arg = f => process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : null;
const quiet = process.argv.includes('--quiet');
const say = (...a) => { if (!quiet) console.log(...a); };
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const exists = f => fs.existsSync(f);

const { frames, partLaws } = loadScaleData(HERE);

// Law records, from the static API mirror the dashboard already serves. A law in the table with no record
// is reported, not skipped: the table and the registry drifting apart is exactly what a reader needs told.
const LAW_DIR = path.join(ROOT, 'dashboard', 'public', 'api', 'lean', 'laws');
const lawRecords = {}, lawsMissing = [];
for (const e of partLaws.entries) {
  const f = path.join(LAW_DIR, `${e.law_id}.json`);
  if (exists(f)) lawRecords[e.law_id] = rd(f); else lawsMissing.push(e.law_id);
}
if (lawsMissing.length) say(`! ${lawsMissing.length} law(s) in part-laws.json have no record under dashboard/public/api/lean/laws/: ${lawsMissing.join(', ')}`);

// "Wrong quantity" cases: a clade for which a law's quantity does not represent the physics at all. The one
// entry so far is a steady maximum lift coefficient for an insect, and it is read from the physics layer's
// own table rather than restated here, so the two can never disagree.
const inapplicable = [];
const LC = path.join(ROOT, 'sim-engine', 'validate', 'physics', 'lift-coefficients.json');
if (exists(LC)) {
  const lc = rd(LC);
  for (const i of lc.inapplicable ?? []) {
    inapplicable.push({ clade: [i.clade], laws: partLaws.entries.filter(e => (e.needs ?? []).includes('lift_coefficient')).map(e => e.law_id),
      why: `a steady maximum lift coefficient is the WRONG QUANTITY for ${i.clade}: ${i.why ?? i.what ?? 'see sim-engine/validate/physics/lift-coefficients.json'}${i.doi ? ` (${i.doi})` : ''}` });
  }
}

// The unsigned nanopub drafts, keyed by law id, so a law chip can name the nanopublication its claim sits
// in. Every one is an UNSIGNED DRAFT: nothing here has been published, and the chip must say so.
const NANOPUBS = {};
const NP = path.join(ROOT, 'lean', 'nanopubs', 'manifest.json');
if (exists(NP)) for (const n of (rd(NP).nanopubs ?? [])) {
  const m = /law-(.+)\.trig$/.exec(n.file ?? '');
  if (m) NANOPUBS[m[1]] = n;
}

const RUNS = path.join(ROOT, 'runs');
const only = arg('--run');
const all = fs.readdirSync(RUNS).filter(d => !d.startsWith('_') && exists(path.join(RUNS, d, 'summary.json')));
const runs = only ? [only] : all;
if (!runs.length) { console.error('no runs with a summary.json under runs/'); process.exit(1); }

const BAKE = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'scales');
fs.mkdirSync(BAKE, { recursive: true });
const index = [];
const MESHES = wantMeshes(process.argv, process.env);
const FORCE_MESHES = process.argv.includes('--force-meshes');
const BUILT = new Map();                       // one Blender build per spec per process

for (const run of runs) await build(run);

// Prune generated meshes no bundle references, but only when this build was asked to manage meshes (a plain
// rebuild after a sculptor's edit must not delete the last GLB before anyone has rebuilt it), and only files of
// the FRAMES this invocation built or reused. The keep set is read from every bundle on disk AFTER this
// invocation's own were written. So `--run xenobot --meshes` can only ever remove construct files that no
// bundle names, never a tetrapod GLB that another run's bundle (or one about to be rebuilt) still needs.
if (MESHES) {
  const keep = new Set();
  for (const f of fs.readdirSync(BAKE).filter(x => x.endsWith('.json') && x !== 'index.json')) {
    try {
      const b = rd(path.join(BAKE, f));
      for (const l of Object.values(b.ladders ?? {})) for (const k of ['glb', 'manifest']) if (l.mesh?.[k]) keep.add(path.basename(l.mesh[k]));
    } catch {}
  }
  const frames = framesTouched(BUILT);
  const removed = pruneMeshes(keep, { frames });
  if (removed.length) say(`meshes: pruned ${removed.length} stale ${[...frames].join('/')} file(s): ${removed.join(', ')}`);
}

if (!only) {
  fs.writeFileSync(path.join(BAKE, 'index.json'), JSON.stringify({
    what: 'The runs the theatre view can show. One entry per run, each pointing at its scale ladders.',
    contract_version: CONTRACT_VERSION, built: new Date().toISOString(), runs: index }, null, 1));
  say(`\nscales/index.json  ${index.length} runs`);
}

async function build(run) {
  const RUN = path.join(RUNS, run);
  if (!exists(RUN)) { console.error(`no run at runs/${run}`); process.exit(1); }
  const OUT = path.join(RUN, 'scales');
  fs.mkdirSync(OUT, { recursive: true });
  const summary = rd(path.join(RUN, 'summary.json'));
  const journalFile = path.join(RUN, 'journal.jsonl');
  const journal = exists(journalFile) ? fs.readFileSync(journalFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

  // The declared organism each generation created, taken from the call the run actually made.
  const LOG = path.join(RUN, 'log');
  const creates = {};
  if (exists(LOG)) for (const f of fs.readdirSync(LOG).filter(x => x.endsWith('.json'))) {
    const j = rd(path.join(LOG, f));
    if (!['organism_create', 'organism_from_blueprint'].includes(j.tool)) continue;
    if (!j.args?.declared) continue;
    const g = j.generation ?? 0;
    creates[g] = { tool: j.tool, args: j.args };
  }

  // The taxon audit, if it has been run. Its absence is reported per part rather than assumed benign.
  const auditFile = path.join(OUT, 'taxon-audit.json');
  const taxonAudit = exists(auditFile) ? rd(auditFile) : null;

  const chainFile = path.join(RUNS, '_chains', `${run}.json`);
  const chain = exists(chainFile) ? rd(chainFile) : null;

  const gens = fs.readdirSync(path.join(RUN, 'gen')).filter(f => /^gen\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3))).map(f => rd(path.join(RUN, 'gen', f)));

  const made = [];
  for (const gen of gens) {
    const g = gen.generation;
    const bpPath = gen.blueprint ? path.join(RUN, gen.blueprint) : null;
    const blueprint = bpPath && exists(bpPath) ? rd(bpPath) : null;

    // Resolve a STATE at every declared life stage, by replaying the run's own creation call.
    const states = [];
    let stateNote = null;
    const create = creates[g] ?? lastBefore(creates, g);
    if (!create) stateNote = 'no generation of this run created an organism with declared parameters, so the engine resolved no STATE and there is no age axis. The body is drawn at one unspecified moment.';
    else {
      try {
        const doc = await byName[create.tool](create.args);
        const id = doc?.result?.doc?.id ?? doc?.result?.organism?.id ?? doc?.organism?.id ?? doc?.result?.id ?? doc?.id;
        const stages = create.args.declared?.life_stages ?? [];
        if (!id) stateNote = `replaying ${create.tool} returned no organism id, so no STATE could be resolved`;
        else if (!stages.length) stateNote = 'the design declares no life stage, so there is a single unnamed moment and no age axis';
        else for (const s of stages) {
          const got = await byName.organism_get({ organism: id, ageDays: s.ageDays });
          const st = got?.result?.state ?? got?.state ?? null;
          states.push({ age_days: s.ageDays, stage: s.label ?? s.key, state: st,
            declared_here: Object.keys(s.parameters ?? {}) });
        }
      } catch (e) { stateNote = `the engine refused to resolve a STATE for this generation: ${String(e?.message ?? e)}`; }
    }

    const ladder = scaleLadder({
      run, generation: g, asked: gen.asked, blueprint, gen, journal: journal.filter(e => e.generation === g),
      lawRecords, chain, frames, partLaws, taxonomy, states, inapplicable,
      madeFrom: create?.args?.made_from ?? null, declared: create?.args?.declared ?? null,
      taxonAudit: taxonAudit?.generations?.[g] ?? null,
      tableQuantities: clmaxFor(gen?.phenotype?.taxon ?? null),
    });
    if (stateNote) { ladder.timeline.note = stateNote; ladder.honesty.push(stateNote); }
    if (lawsMissing.length) ladder.honesty.push(`${lawsMissing.length} law(s) named in part-laws.json have no registry record in this deployment (${lawsMissing.join(', ')}), so their chips carry no proof link.`);
    ladder.mesh = meshField(ladder, { want: MESHES, force: FORCE_MESHES, built: BUILT });
    ladder.taxon_audit = taxonAudit?.generations?.[g] ? { counts: taxonAudit.generations[g].counts, total: taxonAudit.generations[g].total,
      headline: taxonAudit.headline, what_it_shows: taxonAudit.what_it_shows, verdicts: taxonAudit.verdicts, built: taxonAudit.built }
      : { absent: 'no taxon audit for this generation: run node sim-engine/scales/audit-taxon.mjs' };
    ladder.gates = gen.gates ?? null;
    ladder.what_it_taught = gen.what_it_taught ?? null;

    fs.writeFileSync(path.join(OUT, `gen${g}.json`), JSON.stringify(ladder, null, 1));
    made.push({ generation: g, asked: gen.asked, body: Boolean(blueprint),
      parts: ladder.counts.parts, unplaced: ladder.counts.unplaced, law_chips: ladder.counts.law_chips,
      law_status: ladder.counts.law_status, ladder: ladder.counts.ladder, ages: states.map(s => s.age_days),
      frame: ladder.frame.name, chain_links: ladder.counts.chain_links,
      mesh: { status: ladder.mesh.status, hash: ladder.mesh.hash, glb: ladder.mesh.glb ?? null } });
    say(`  ${run} gen${g}: ${ladder.counts.parts} parts (${ladder.counts.unplaced} unplaced), ${ladder.counts.law_chips} law chips, ${states.length} age(s), frame ${ladder.frame.name}`);
  }

  // The law records travel WITH the bundle, so a chip in the theatre can show the Lean theorem itself --
  // its statement, its module and line, its source text, its pin status and the claim and nanopub it came
  // from -- rather than linking away to a file the reader has to go and interpret. A proof a person cannot
  // see is indistinguishable from a proof that does not exist.
  const usedLaws = new Set();
  for (const m of made) {
    const l = rd(path.join(OUT, `gen${m.generation}.json`));
    for (const p of l.parts) for (const c of p.laws ?? []) usedLaws.add(c.law_id);
    for (const c of l.universal_laws ?? []) usedLaws.add(c.law_id);
  }
  const laws = {};
  for (const id of usedLaws) {
    const r = lawRecords[id];
    const np = NANOPUBS[id] ?? null;
    // A REFERENCE, not a copy. The registry record under dashboard/public/api/lean/laws/ is the canonical one
    // and the page fetches it when a chip is opened, so the proof on screen is always the current one. Copying
    // its text here duplicated every statement into four more files, and with it every example clade the
    // registry's prose mentions.
    laws[id] = r ? {
      law_id: id, theorem: r.lean_ref?.theorem ?? r.lean?.theorem ?? null,
      module: r.lean_ref?.module ?? r.lean?.module ?? null, line: r.lean?.line ?? null,
      api: `../../api/lean/laws/${id}.json`,
      nanopub: np ? { file: np.file, status: np.status, claim: np.claim, law: np.law, evidence: np.evidence,
                      theorems: np.theorems ?? [], trusty_uri: np.trustyUri ?? null } : null,
    } : { law_id: id, missing_record: `no record under dashboard/public/api/lean/laws/${id}.json in this deployment` };
  }

  const bundle = {
    contract_version: CONTRACT_VERSION, run, question: summary.question, built: new Date().toISOString(),
    generations: made, laws,
    ladders: Object.fromEntries(made.map(m => [m.generation, rd(path.join(OUT, `gen${m.generation}.json`))])),
    chain: chain ? { present: true, requirement: chain.requirement, species_caveat: chain.species_caveat,
      links: chain.links ?? [], missing_rungs: chain.missing_rungs ?? [], organism: chain.organism ?? null,
      verification: chain.verification ?? null, protocol: chain.protocol ?? null }
      : { present: false, why: `no runs/_chains/${run}.json: no molecule-to-organ ladder has been built for this run, so its lower rungs are empty rather than guessed` },
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ ...bundle, ladders: undefined }, null, 1));
  // Minified: this copy is read only by the page. The human-readable record is runs/<run>/scales/.
  fs.writeFileSync(path.join(BAKE, `${run}.json`), JSON.stringify(bundle));
  index.push({ run, question: summary.question, file: `${run}.json`, generations: made.length,
    frames: [...new Set(made.map(m => m.frame))], chain: bundle.chain.present,
    chain_links: (chain?.links ?? []).length, parts_max: Math.max(0, ...made.map(m => m.parts)) });
  say(`${run}: ${made.length} generation(s) -> runs/${run}/scales/`);
  // One line per run, always printed (even --quiet): a mesh that silently fell back is worth knowing about.
  const byHash = new Map();
  for (const m of made) { const k = `${m.mesh.status}|${m.mesh.glb ?? m.frame}`; byHash.set(k, [...(byHash.get(k) ?? []), m.generation]); }
  const why = [...new Set(Object.values(bundle.ladders).map(l => l.mesh?.status === 'failed' || l.mesh?.status === 'no-blender' ? l.mesh.why : null).filter(Boolean))];
  const parts = [...byHash].map(([k, g]) => { const [st, f] = k.split('|'); return `${path.basename(f)} ${st} (gen ${g.join(',')})`; });
  console.log(`  mesh ${run}: ${parts.join('; ')}${why.length ? ` -- ${why[0].split(/\r?\n/)[0].slice(0, 200)}` : ''}`);
}

function lastBefore(map, g) {
  const ks = Object.keys(map).map(Number).filter(k => k <= g).sort((a, b) => b - a);
  return ks.length ? map[ks[0]] : null;
}

// CLmax for the organism's clade, from the physics layer's own table and lookup, so the two can never
// disagree. A clade with no entry, or one listed as inapplicable, supplies nothing.
function clmaxFor(taxon) {
  if (!taxon) return null;
  try {
    const r = liftCoefficientFor(taxon);
    if (!r?.ok) return null;
    return { CLmax: { basis: r.entry?.kind === 'measured' ? 'check' : 'declared', kind: r.entry?.kind ?? 'unknown',
      source: `sim-engine/validate/physics/lift-coefficients.json: ${r.entry?.clade} ${r.C_Lmax}${r.sd != null ? ` +/- ${r.sd}` : ''}, ${r.entry?.measured_on ?? ''}`.trim() } };
  } catch { return null; }
}
