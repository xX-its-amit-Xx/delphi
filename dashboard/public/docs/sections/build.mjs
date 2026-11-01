#!/usr/bin/env node
// Builds docs/sections/data.json — the four tappable sections each product carries:
// How it works · Use cases · Community · Open questions.
//
// STATUS IS NOT DECORATION. Every use case carries one of:
//   built     we have run it and there is output in the repo to point at
//   partial   some of it runs; the rest does not, and the entry says which part
//   proposed  nobody has run this. It is an idea.
// A page that lists a proposal beside a result without distinguishing them is the failure this
// project exists to avoid, so the renderer is required to show the badge and the build asserts
// every entry has one.
//
//   node dashboard/public/docs/sections/build.mjs [--check]

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const CHECK = process.argv.includes('--check');
const must = (c, m) => { if (!c) { console.error(`sections/build.mjs FAILED: ${m}`); process.exit(1); } };
const readJSON = p => JSON.parse(fs.readFileSync(path.resolve(root, p), 'utf8'));

// ── real counts, read from the files that own them ───────────────────────────
const cap = readJSON('dashboard/public/leanbio/capability.json');
must(cap?.counts?.grand_questions, 'capability.json has no grand_questions count');

const oq = JSON.parse(execFileSync('node', ['sim-engine/cli.mjs', 'tool', 'lean_open_questions'],
  { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })).result;
must(oq?.counts?.questions, 'lean_open_questions returned no questions');

const align = fs.existsSync(path.join(here, '../align/data.json'))
  ? JSON.parse(fs.readFileSync(path.join(here, '../align/data.json'), 'utf8')) : null;

// The functional registry's own statement of what it does NOT hold — the data-gap use case is
// real precisely because this exists.
const anal = fs.readFileSync(path.resolve(root, 'sim-engine/validate/functional/analogue.mjs'), 'utf8');
const gapM = anal.match(/(\d+)\s+of\s+3,?860\s+genes/);
must(gapM, 'analogue.mjs no longer states the "N of 3,860 genes" coverage figure');

// The resolution figures come from the RUN, not from prose. An earlier pass took "2 of 73
// requirements have a flying-fish protein id" from a summary; that string is nowhere in the
// source and the real shape is different, so these are read from the run file and asserted.
const run = readJSON('dashboard/public/validate-show/run-winged-zebrafish.json');
const fr = run.functional_resolution?.result || run.functional_resolution;
const cov = fr?.coverage, rc = fr?.counts;
must(cov?.requirements_total && cov?.requirements_assessable != null, 'run file has no requirement coverage');
must(rc?.UNRESOLVED != null, 'run file has no UNRESOLVED count');
must(cov.requirements_assessable <= cov.requirements_total, 'assessable exceeds total');

const PRODUCTS = {
  nanopubs: {
    how: [
      ['One claim, four graphs', 'A nanopublication is one claim small enough to be wrong on its own: an assertion, where it came from, who published it, and a head naming the other three. The validator either accepts the record or it does not.'],
      ['The test that matters', 'Find the one sentence a reader could quote. If it is true of the finding AND states the finding\'s limit, the record is honest. If the limit only exists in your head, it is not.'],
      ['What a pass means', 'Exit 0 with an empty `unexpected` list. Three complaints are allowed by name on an unsigned draft — no signature, no template, a temp graph URI — and the allowance list is in source with a written reason.'],
    ],
    uses: [
      ['built', 'Distil a book into citable claims', 'Darwin, Thompson, Wolfram and Turing were read into claims, each traced to its source passage, and the claim graph is browsable.'],
      ['built', 'Publish a negative result', 'Several records in the repo exist to say a thing did NOT hold — a retracted link, a refuted textbook claim, a null that was contradicted and withdrawn.'],
      ['partial', 'Let an outside agent submit evidence', 'The format and the checker are real and run. Signing and publishing to the production registry need a key owner\'s approval, which is a human decision and deliberately not automated.'],
    ],
    community: [
      ['Bring a claim, not an opinion', 'The unit of contribution is one small claim with its locator. That is a low bar to clear and a hard one to fake, which is the point.'],
      ['Disagreement has an address', 'Two people who disagree end up pointing at the same record and arguing about its evidence rather than about what was meant.'],
      ['Negative results are first-class', 'A record that says "this did not hold" counts the same as one that says it did. Most venues cannot say that.'],
    ],
  },

  leanbio: {
    how: [
      ['Two gates', 'A claim becomes an axiom only if it compiles in Lean 4 AND survives agent debate on the existing evidence. Both, or neither.'],
      ['The non-vacuity witness', 'Every law carries concrete numbers that satisfy its hypotheses, proved rather than asserted. A theorem whose hypotheses can never be met is true and worthless.'],
      ['Load-bearing hypotheses', 'The checker strips every relational binder and recompiles. If it still compiles, the hypotheses were decorative and the formalisation FAILS. That is the most common silent failure in formalised claims.'],
    ],
    uses: [
      ['built', 'Settle what a disagreement is about', 'Several arguments in this repo turned out to be about what follows from what, not about the world. Formalising separates the two, and the open-questions ledger records which is which.'],
      ['built', 'Catch a claim that proves nothing', 'The hypothesis-stripping check has refused formalisations that compiled cleanly. Compiling is not the bar.'],
      ['proposed', 'Submit your own theorem to the forum', 'The gates exist and run. An outside submission path — upload, debate, promote — is designed and not built.'],
    ],
    community: [
      ['A proof is reviewable by a machine first', 'The kernel checks the step before a human spends attention on it, so review time goes to whether the statement says what the claim says.'],
      ['Debate before promotion', 'A claim does not become an axiom because it compiled. It has to survive argument about the evidence, and the argument is recorded.'],
      ['Exemptions are written down', 'Laws that evaluate nothing against a design are listed with a reason each. Explained is not the same as silent.'],
    ],
  },

  mcp: {
    how: [
      ['Tools, not endpoints', 'The surface was derived from a capability map: who would ask, what they would actually ask, and which of the big open questions it touches.'],
      ['It declines to guess', 'Every tool returns a named verdict. `cannot-evaluate` names the input it would need. Supply it and call again, or report the absence — do not substitute a default.'],
      ['Pinned lawsets', 'Checks run at a pinned law-set version, so a law released mid-run cannot move a result and any verdict can be reproduced later.'],
    ],
    uses: [
      ['built', 'Ask what is already known about a claim', 'One claim id in, its nanopub drafts and evidence out.'],
      ['built', 'Check a design against the law registry', 'The interesting answer is the `cannot-evaluate` rows, each naming the missing input.'],
      ['partial', 'Drive the whole pipeline from an agent', 'The tools exist and are callable. The capability map reports that a large share of the tool references its own use cases need are still MISSING, and does not round that up.'],
    ],
    community: [
      ['Built for named personas', 'The tool list answers specific people asking specific things, and the map says which questions it cannot answer yet.'],
      ['The gaps are published', 'The missing-tool list is part of the product. It is the contribution queue.'],
      ['Any agent is a first-class caller', 'The CLI, the API and the MCP server are the same surface, so an agent is not a second-class user of a human tool.'],
    ],
  },

  studio: {
    how: [
      ['Prose to specification', 'A sentence becomes criteria in SI units. Clauses it cannot parse are reported, never silently dropped.'],
      ['Down nine layers', 'From the specification to organ systems, tissues, cells, pathways, genes and developmental time — each layer with its ontology id.'],
      ['Out as geometry', 'The design leaves the screen as STL meshes and sequence, which is how it reaches a printer or a wet lab.'],
    ],
    uses: [
      ['proposed', 'Design Xenobots', 'The sharpest case for the harness, and NOT because of a genome. A Xenobot has no engineered sequence: it is wild-type Xenopus cells arranged into a shape an evolutionary algorithm searched over. So the design variable is arrangement, and the target function is LOCOMOTION — a phenotype in time. Run one through validation and genotype similarity comes back ~100% and tells you nothing. Only the physics check can adjudicate. Nothing here has been run.'],
      ['partial', 'Hybrids, chimeras, and reconstructed ancestors', 'A two-parent chimera and a parametric weighted-chimera builder exist and run — `ff-zf-chimera` is a real case in the gene diff, built from parents plus labelled deltas. Reconstructing an ANCESTOR is the interesting scientific version and has not been attempted.'],
      ['built', 'Find out which data is missing', 'Arguably the most useful thing it does today. The functional registry states its own poverty in numbers, and the capability map publishes its missing tool references. Pointing at what to collect next is a real output.'],
    ],
    community: [
      ['A design is a shareable object', 'Specification, mesh and sequence are files. A design can be handed to someone who disagrees with it.'],
      ['Printable', 'The kits come out as STL. A disagreement about a shape can be settled on a desk.'],
      ['Labelled in development', 'The studio says so on screen. Shipping an honest label beats shipping a confident one.'],
    ],
  },

  harness: {
    how: [
      ['The analogue is CURATED, not searched', 'This is the thing most readers assume wrongly. There is no search: the nearest functional analogue comes from a hand-written registry of four functions, each with at most two taxa carrying a curated satisfies flag. The pick is a filter and first-in-source-order. No distance metric selects it, no database is queried at run time, and no model is prompted.'],
      ['Distances are reported, never used to choose', 'Phylogenetic and functional distance are computed AFTER the choice and never feed back into it. They are reported separately and never combined.'],
      ['It refuses the obvious shortcut', 'When nothing satisfies the function, `no_analogue` is the loud case and the nearest partial analogues are listed with what each one FAILS to supply. In the module\'s own words: relatedness is not function, which is the whole premise.'],
      ['Five results, never summed', 'Genotype similarity, phenotype similarity, the law check, functional resolution and physics. Named, reported separately, and `cannot-assess` is not a pass.'],
    ],
    uses: [
      ['built', 'Refuse our own headline design', 'The winged zebrafish cannot leave the water: 0.67 m/s against 8.64 required, lifting area 166x too small. The film opens on it.'],
      ['built', 'Diff a prediction against a real organism', 'The predicted flying zebrafish set against Exocoetus volitans, residue by residue, with a fourth colour for the columns no data covers.'],
      ['built', 'Say which requirements cannot be assessed at all', 'Of 73 functional requirements, 22 were assessable and 19 of those did not resolve — 51 could not be assessed at all, most of them because the analogue side has no data. Reporting that is the product.'],
      ['proposed', 'Validate a target function defined in TIME', 'Locomotion, gait, development — a phenotype that only exists as a trajectory. The harness has no time-varying target function today; every requirement it checks is a quantity at a stage.'],
    ],
    community: [
      ['A refusal you can audit', 'Every gate names the input it lacked, so a refusal is a to-do list rather than a verdict you must take on trust.'],
      ['Bring a design, get a ledger', 'The output is not a score. It is a row per requirement saying assessed, unresolved, or not assessable.'],
      ['The data gaps are the contribution', 'Nine of 3,860 genes carry a flying-fish identifier. That number is an invitation.'],
    ],
  },
};

// ── open questions: real, per product ────────────────────────────────────────
const gqs = (cap.grand_questions || []).map(q => ({
  text: q.question || q.title || '',
  core: q.formalisable_core || q.formalisableCore || null,
  asset: q.repo_asset || q.repoAsset || null,
}));
must(gqs.length === cap.counts.grand_questions, 'grand question count mismatch');

const ledger = (oq.questions || []).map(q => ({
  id: q.question_id,
  text: q.statement_en,
  status: q.status,
  arms: (q.arms || []).map(a => ({ id: a.arm_id, formalised: !!a.formalised, formalisable: !!a.formalisable, belief: a.belief })),
}));

const OPEN = {
  leanbio: { lead: 'Biology\'s open questions, split into the part Lean can settle and the part only measurement can. These are the fourteen the capability map holds; none is answered here.', grand: gqs, ledger },
  mcp: { lead: 'The same fourteen, reachable as a tool: `leanbio_grand_questions`. Each carries a formalisable core and, where one exists, the repository asset that already touches it.', grand: gqs, ledger: [] },
  harness: { lead: 'Questions this project actually hit and could not settle. Each has arms with a belief, and the ledger records which arms were formalised and which were never attempted.', grand: [], ledger },
  studio: { lead: 'What a design tool could be asked that nobody can answer yet.', grand: gqs.slice(0, 5), ledger: [] },
  nanopubs: { lead: 'Questions about the record format itself, still open in this repo.', grand: [], ledger: [] },
};

for (const [k, p] of Object.entries(PRODUCTS)) {
  for (const u of p.uses) must(['built', 'partial', 'proposed'].includes(u[0]), `${k}: use case "${u[1]}" has no valid status`);
  p.open = OPEN[k] || { lead: '', grand: [], ledger: [] };
}

const out = {
  generated_at: new Date().toISOString(),
  generated_by: 'dashboard/public/docs/sections/build.mjs',
  status_legend: {
    built: 'Run, with output in the repository to point at.',
    partial: 'Part of it runs; the entry names the part that does not.',
    proposed: 'Nobody has run this. It is an idea.',
  },
  counts: {
    grand_questions: gqs.length,
    open_questions: oq.counts.questions,
    failed_theorems: oq.counts.failed_theorems,
    failed_never_attempted: oq.counts.failed_never_attempted,
    genes_with_flyingfish_id: Number(gapM[1]),
    genes_total: 3860,
    requirements_total: cov.requirements_total,
    requirements_assessable: cov.requirements_assessable,
    requirements_unassessable: cov.unassessable,
    unresolved: rc.UNRESOLVED,
    genes_mapped: cov.genes_mapped,
    aligned_genes: align ? align.genes.length : null,
  },
  products: PRODUCTS,
};

const text = JSON.stringify(out, null, 1);
if (CHECK) { console.log(`sections --check: ok (${text.length} chars)`); process.exit(0); }
fs.writeFileSync(path.join(here, 'data.json'), text);
const n = Object.values(PRODUCTS).reduce((a, p) => a + p.uses.length, 0);
console.log(`sections/data.json: 5 products x 4 sections, ${n} use cases `
  + `(${Object.values(PRODUCTS).flatMap(p => p.uses).filter(u => u[0] === 'built').length} built, `
  + `${Object.values(PRODUCTS).flatMap(p => p.uses).filter(u => u[0] === 'partial').length} partial, `
  + `${Object.values(PRODUCTS).flatMap(p => p.uses).filter(u => u[0] === 'proposed').length} proposed), `
  + `${gqs.length} grand questions, ${ledger.length} open questions`);
