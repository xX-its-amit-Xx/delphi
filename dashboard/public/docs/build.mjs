#!/usr/bin/env node
// Builds docs/data.json from the repository's own sources.
//
// EVERY number on the docs page is read here, at build time, from the file that owns it, and every read is
// followed by an assert. Nothing is typed into the page markup. If a source file moves or its shape changes,
// this script FAILS rather than shipping a stale figure - the same rule the deck and the pitch film run under.
//
//   node dashboard/public/docs/build.mjs            # writes data.json
//   node dashboard/public/docs/build.mjs --check    # verifies without writing

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..');
const root = path.resolve(here, '../../..');
const CHECK = process.argv.includes('--check');

const read = p => fs.readFileSync(path.resolve(root, p), 'utf8');
const readJSON = p => JSON.parse(read(p));
const must = (cond, msg) => { if (!cond) { console.error(`docs/build.mjs FAILED: ${msg}`); process.exit(1); } };

// ---------------------------------------------------------------- sources, each asserted on read

const capability = readJSON('dashboard/public/leanbio/capability.json');
must(capability?.counts, 'leanbio/capability.json has no counts block');
const C = capability.counts;
must(C.personas > 0 && C.use_cases > 0 && C.grand_questions > 0, 'capability counts are empty');

const contract = readJSON('sim-engine/contract.json');
must(Array.isArray(contract.tools) && contract.tools.length > 50, `sim-engine/contract.json has ${contract.tools?.length} tools, expected > 50`);
const toolNames = contract.tools.map(t => t.name);

const mcpSrc = read('mcp/server.mjs');
const mcpVersion = mcpSrc.match(/export const VERSION = "([^"]+)"/)?.[1];
must(mcpVersion, 'could not read VERSION from mcp/server.mjs');
// TOOLS is built by side effect at import time, so it is counted by importing the module, not by
// pattern-scanning the source (a scan returned 1, which is how this was caught).
const mcpMod = await import(url.pathToFileURL(path.resolve(root, 'mcp/server.mjs')).href);
const mcpToolCount = Array.isArray(mcpMod.TOOLS) ? mcpMod.TOOLS.length : null;
must(mcpToolCount && mcpToolCount > 20, `mcp/server.mjs exported ${mcpToolCount} tools, expected > 20`);

// The nanopub checker's own allowance for unsigned drafts. These are NOT errors and the docs say so.
const checkSrc = read('holdout/nanopubs/check.mjs');
const expectedIssuesLine = checkSrc.match(/const EXPECTED_ISSUES = \[(.*?)\];/s)?.[1];
must(expectedIssuesLine, 'could not read EXPECTED_ISSUES from holdout/nanopubs/check.mjs');
must(/no signature element/.test(expectedIssuesLine), 'EXPECTED_ISSUES no longer mentions the missing signature; re-read it before documenting it');

// The documented exemption list in the law registry.
const exposedSrc = read('lean/registry/check-exposed.mjs');
const noDesignBlock = exposedSrc.match(/NO_DESIGN_ROW\s*=\s*\{([\s\S]*?)\n\};/)?.[1];
must(noDesignBlock, 'could not read NO_DESIGN_ROW from lean/registry/check-exposed.mjs');
const noDesignCount = (noDesignBlock.match(/^\s*'[^']+':/gm) || []).length;
must(noDesignCount > 0, 'NO_DESIGN_ROW parsed to zero entries');

const lawset = readJSON('lean/registry/lawsets/current.json');
must(lawset.version, 'lawsets/current.json has no version');

// Observed nanopub failure modes come from the benchmark's own results, not from memory.
const benchResults = read('swarm/benchmark/RESULTS.md');
must(/urn:locator/.test(benchResults), 'RESULTS.md no longer records the urn:locator failure; re-read before documenting it');
must(/RDF ERROR/.test(benchResults), 'RESULTS.md no longer records the RDF ERROR failure');

// Grand questions, verbatim, with their formalisable core where one is recorded.
const gq = (capability.grand_questions || []).map(q => ({
  id: q.id ?? null,
  question: q.question || q.title || '',
  formalisable_core: q.formalisable_core || q.formalisableCore || null,
  repo_asset: q.repo_asset || q.repoAsset || null,
}));
must(gq.length === C.grand_questions, `grand_questions array (${gq.length}) disagrees with counts.grand_questions (${C.grand_questions})`);

// Which shots and clips actually exist on disk - the page must never reference one that does not.
const shotsDir = path.join(pub, 'pitch-video/shots');
const clipsDir = path.join(pub, 'pitch-video/clips');
const shots = fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir).filter(f => /\.(jpg|png)$/.test(f)) : [];
const clips = fs.existsSync(clipsDir) ? fs.readdirSync(clipsDir).filter(f => f.endsWith('.webm')) : [];
must(shots.length > 5, `expected screenshots in pitch-video/shots, found ${shots.length}`);
must(clips.length > 5, `expected clips in pitch-video/clips, found ${clips.length}`);

// The generated art. Decoration, not evidence - but the page references each file by name, so a
// missing one must fail the build rather than render as a broken frame.
const artDir = path.join(here, 'art');
const ART = ['planes.jpg', 'fish.jpg', 'graph.jpg', 'form.jpg', 'blueprint.webm', 'lab.webm'];
const art = fs.existsSync(artDir) ? fs.readdirSync(artDir) : [];
for (const f of ART) must(art.includes(f), `docs/art/${f} is referenced by the page but is not on disk`);
// And every art reference in the page must be one of those files, so a typo cannot ship.
const pageHtml = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
for (const m of pageHtml.matchAll(/(?:src|href)="art\/([^"]+)"/g)) {
  must(ART.includes(m[1]), `the page references art/${m[1]}, which is not in the art inventory`);
}

// The five named validation results, read from the pipeline rather than listed from memory.
const pipelineSrc = read('sim-engine/validate/pipeline/index.mjs');
const FIVE = ['genotype_similarity', 'phenotype_similarity', 'lean_check', 'functional_resolution', 'physics'];
for (const f of FIVE) must(pipelineSrc.includes(f), `the validation pipeline no longer mentions ${f}`);

// What is NOT built. Asserted ABSENT, so the docs cannot quietly start claiming it.
const simTree = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'sessions') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.mjs')) simTree.push(p);
  }
})(path.join(root, 'sim-engine'));
// Word-boundary only: "provisional" and "DanioVision" are not vision models.
const anyVLM = simTree.some(p => /\bVLM\b|\bvision[\s_-]?(model|language)|mesh[\s_]?segment|segment[\s_]?mesh/i.test(fs.readFileSync(p, 'utf8')));
must(!anyVLM, 'something in sim-engine now looks like mesh/VLM segmentation - the docs list it as NOT BUILT and must be updated');

const data = {
  generated_at: new Date().toISOString(),
  generated_by: 'dashboard/public/docs/build.mjs',
  sources: {
    capability: 'dashboard/public/leanbio/capability.json',
    contract: 'sim-engine/contract.json',
    hosted_mcp: 'mcp/server.mjs',
    nanopub_checker: 'holdout/nanopubs/check.mjs',
    law_registry: 'lean/registry/check-exposed.mjs',
    lawset: 'lean/registry/lawsets/current.json',
    benchmark: 'swarm/benchmark/RESULTS.md',
    validation_pipeline: 'sim-engine/validate/pipeline/index.mjs',
  },
  counts: {
    sim_engine_tools: contract.tools.length,
    hosted_mcp_tools: mcpToolCount,
    hosted_mcp_version: mcpVersion,
    personas: C.personas,
    use_cases: C.use_cases,
    grand_questions: C.grand_questions,
    real_tools: C.real_tools,
    tool_references: C.tool_references,
    tool_reference_status: C.tool_reference_status,
    use_cases_by_answerability: C.use_cases_by_answerability,
    gaps: C.gaps,
    documented_exemptions: noDesignCount,
    lawset_version: lawset.version,
  },
  tool_names: toolNames,
  grand_questions: gq,
  five_results: FIVE,
  assets: { shots, clips, art: ART },
};

if (CHECK) { console.log('docs/build.mjs --check: all sources read and asserted OK'); process.exit(0); }

fs.writeFileSync(path.join(here, 'data.json'), JSON.stringify(data, null, 1));
console.log(`docs/data.json written: ${data.counts.sim_engine_tools} sim-engine tools, ${data.counts.hosted_mcp_tools} hosted tools, ${gq.length} grand questions, ${shots.length} shots, ${clips.length} clips`);
