#!/usr/bin/env node
// Validate the LeanBio capability map and write its derived outputs.
//
//   node pipeline/leanbio/capability-map/build.mjs            validate, then write out/ and the dashboard data
//   node pipeline/leanbio/capability-map/build.mjs --check     validate only; non-zero exit on any problem or drift
//   node pipeline/leanbio/capability-map/build.mjs --mirror    print the static-API files as JSON (no write)
//
// Validation is two layers. The JSON Schema (capability-map.schema.json, draft 2020-12, via ajv) checks shape.
// lib.mjs checks the things a schema cannot: that every EXISTS or PARTIAL tool name is a real tool, that every
// MISSING name is NOT, that each grand question states both a formalisable core and an empirical remainder (or
// says it has none and why), that no persona has an empty tool list, that every Lean declaration claimed as
// proved-here really is declared in the module it names, and that no gap asserts its own rank.
//
// Outputs:
//   out/capability-map.json        the whole map with every derived field filled in
//   out/tool-gap-ranked.json       the gap list in rank order with its unblock counts
//   ../../../dashboard/public/leanbio/capability.json      the page's data (every number on the page comes from here)
//   static mirror files, for dashboard/build-lean-api.mjs to publish under /api/lean/capability/
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { HERE, ROOT, FILES, MAP_VERSION, SCOPE, readJson, exists, rel, loadDocs, toolUniverse, buildMap, allProblems } from './lib.mjs';

const OUT = path.join(HERE, 'out');
const DASH = path.join(ROOT, 'dashboard', 'public', 'leanbio');

// A document's `kind` selects its branch of the schema, so validate against that branch alone. Validating the
// whole oneOf instead reports every non-matching branch's errors too, which buries the one real problem.
const BRANCH = { personas: 'personasDoc', use_cases: 'useCasesDoc', grand_questions: 'grandQuestionsDoc', tool_gap: 'toolGapDoc', citations: 'citationsDoc' };

/** ajv validation of each document against its branch of the schema. Returns a list of problems. */
export function schemaProblems(docs = loadDocs()) {
  const schema = readJson(FILES.schema);
  const ajv = new (Ajv2020.default || Ajv2020)({ allErrors: true, strict: false });
  ajv.addSchema(schema, schema.$id);
  const bad = [];
  for (const [name, doc] of Object.entries(docs)) {
    const branch = BRANCH[name] || BRANCH[doc.kind];
    if (!branch) { bad.push(`${name}: unknown document kind ${JSON.stringify(doc.kind)}`); continue; }
    if (doc.kind !== name) bad.push(`${name}: kind is ${JSON.stringify(doc.kind)}, expected ${JSON.stringify(name)}`);
    const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/${branch}` });
    if (validate(doc)) continue;
    const seen = new Set();
    for (const e of (validate.errors || []).slice(0, 40)) {
      const msg = `${name}${e.instancePath}: ${e.message}${e.params && Object.keys(e.params).length ? ' ' + JSON.stringify(e.params) : ''}`;
      if (!seen.has(msg)) { seen.add(msg); bad.push(msg); }
    }
  }
  return bad;
}

/** The files this build would write under the static API mirror, keyed by their path under /api/lean/capability/. */
export function mirrorFiles(map = buildMap()) {
  const f = {};
  const put = (k, v) => { f[k] = JSON.stringify(v, null, 1) + '\n'; };
  const endpoints = {
    index: 'index.json',
    personas: 'personas.json',
    use_cases: 'use-cases.json',
    grand_questions: 'grand-questions.json',
    grand_question: 'grand-questions/<id>.json',
    tool_gap: 'tool-gap.json',
    citations: 'citations.json',
    schema: 'schema.json',
  };
  put('index.json', {
    api: 'delphisci LeanBio capability map, static mirror',
    version: 1,
    map_version: MAP_VERSION,
    as_of: map.as_of,
    counts: map.counts,
    the_line: map.the_line,
    personas: map.personas.map(p => ({ id: p.id, name: p.name, tools: p.tools.length, missing: p.tools.filter(t => t.status === 'MISSING').length })),
    use_cases: map.use_cases.map(u => ({ id: u.id, question: u.question, answerable_today: u.answerable_today, uncomfortable: !!u.uncomfortable })),
    grand_questions: map.grand_questions.map(q => ({ id: q.id, name: q.name, disputed: !!q.disputed, core_strength: q.formalisable_core.strength || null, remainder_share: q.empirical_remainder.share || null, href: `grand-questions/${q.id}.json` })),
    tool_gap: map.gaps.map(g => ({ id: g.id, name: g.name, kind: g.kind, effort: g.effort, rank: g.rank, score: g.unblocks.score, buildable_now: g.buildable.on_what_we_have })),
    endpoints,
    scope: SCOPE,
  });
  put('personas.json', { map_version: MAP_VERSION, as_of: map.as_of, count: map.personas.length, personas: map.personas, scope: map.docs.personas.scope });
  put('use-cases.json', { map_version: MAP_VERSION, as_of: map.as_of, count: map.use_cases.length, by_answerability: map.counts.use_cases_by_answerability, use_cases: map.use_cases, scope: map.docs.use_cases.scope });
  put('grand-questions.json', { map_version: MAP_VERSION, as_of: map.as_of, count: map.grand_questions.length, the_line: map.the_line, grand_questions: map.grand_questions, citations: map.citations, scope: map.docs.grand_questions.scope });
  for (const q of map.grand_questions) {
    const cites = Object.fromEntries((q.citations || []).filter(k => map.citations[k]).map(k => [k, map.citations[k]]));
    put(`grand-questions/${q.id}.json`, { map_version: MAP_VERSION, as_of: map.as_of, the_line: map.the_line, ...q, citations_resolved: cites, scope: map.docs.grand_questions.scope });
  }
  put('tool-gap.json', { map_version: MAP_VERSION, as_of: map.as_of, count: map.gaps.length, by_kind: map.counts.gaps_by_kind, gaps: map.gaps, not_gaps: map.not_gaps, scope: map.docs.tool_gap.scope });
  put('citations.json', { map_version: MAP_VERSION, as_of: map.as_of, count: Object.keys(map.citations).length, citations: map.citations, scope: map.docs.citations.scope });
  f['schema.json'] = fs.readFileSync(FILES.schema, 'utf8');
  return f;
}

/** The page's data file: small, flat and sufficient, so the page fetches once and computes nothing it cannot show. */
export function pageData(map = buildMap()) {
  return {
    _about: 'Written by pipeline/leanbio/capability-map/build.mjs. Every number on /leanbio/capability.html comes from this file.',
    built: new Date().toISOString(),
    map_version: MAP_VERSION,
    as_of: map.as_of,
    scope: SCOPE,
    the_line: map.the_line,
    counts: map.counts,
    personas: map.personas.map(p => ({
      id: p.id, name: p.name, who: p.who, today: p.today, is_us: !!p.is_us, honesty: p.honesty,
      would_ask: p.would_ask,
      tools: p.tools.map(t => ({ name: t.name, status: t.status, note: t.note, gap_id: t.gap_id || null })),
      counts: ['EXISTS', 'PARTIAL', 'MISSING'].reduce((a, s) => ((a[s] = p.tools.filter(t => t.status === s).length), a), {}),
      use_cases: p.use_cases || [],
    })),
    use_cases: map.use_cases.map(u => ({
      id: u.id, question: u.question, personas: u.personas, scale: u.scale || [],
      answerable_today: u.answerable_today, uncomfortable: !!u.uncomfortable,
      sequence: u.sequence.map(s => ({ step: s.step, tool: s.tool, status: s.status, why: s.why, gap_id: s.gap_id || null, load_bearing: s.load_bearing ?? null })),
      missing: u.missing || [], worked_example: u.worked_example || null, does_not_establish: u.does_not_establish,
    })),
    grand_questions: map.grand_questions.map(q => ({
      id: q.id, name: q.name, question: q.question, disputed: !!q.disputed, dispute: q.dispute || null,
      core: {
        has_core: q.formalisable_core.has_core, strength: q.formalisable_core.strength || null,
        reason_none: q.formalisable_core.reason_none || null,
        statements: (q.formalisable_core.statements || []).map(s => ({ claim: s.claim, settles: s.settles, lean: s.lean || null, module: s.module || null, law_id: s.law_id || null, state: s.state || null })),
        proved_here: (q.formalisable_core.statements || []).filter(s => s.state === 'proved-here').length,
        total: (q.formalisable_core.statements || []).length,
      },
      remainder: {
        has_remainder: q.empirical_remainder.has_remainder, share: q.empirical_remainder.share || null,
        items: q.empirical_remainder.items || [],
      },
      in_repo: q.in_repo || [],
      real_assets: (q.in_repo || []).filter(r => r.strength === 'real').length,
      tools_needed: q.tools_needed,
      open_problem_ids: q.open_problem_ids || [],
      citations: (q.citations || []).map(k => ({ key: k, ...(map.citations[k] || {}) })),
    })),
    gaps: map.gaps.map(g => ({
      id: g.id, name: g.name, kind: g.kind, need: g.need, signature: g.signature, reads: g.reads,
      effort: g.effort, buildable: g.buildable, surfaces: g.surfaces || [], nearest_existing: g.nearest_existing || [],
      risk: g.risk, rank: g.rank, unblocks: g.unblocks,
    })),
    not_gaps: map.not_gaps,
    tool_universe: map.tool_universe,
  };
}

function writeIfChanged(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (exists(p) && fs.readFileSync(p, 'utf8') === text) return false;
  fs.writeFileSync(p, text);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const docs = loadDocs();
  const problems = [...schemaProblems(docs), ...allProblems(docs, toolUniverse())];
  if (problems.length) {
    console.error(`capability map: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const map = buildMap();
  if (args.includes('--mirror')) { console.log(JSON.stringify(mirrorFiles(map), null, 1)); return; }

  const files = {
    [path.join(OUT, 'capability-map.json')]: JSON.stringify(map, null, 1) + '\n',
    [path.join(OUT, 'tool-gap-ranked.json')]: JSON.stringify({ map_version: MAP_VERSION, as_of: map.as_of, ranking: 'derived by build.mjs; see lib.mjs deriveUnblocks', gaps: map.gaps.map(g => ({ rank: g.rank, id: g.id, name: g.name, kind: g.kind, effort: g.effort, buildable_now: g.buildable.on_what_we_have, score: g.unblocks.score, counts: g.unblocks.counts, personas: g.unblocks.personas, use_cases: g.unblocks.use_cases, grand_questions: g.unblocks.grand_questions })), scope: SCOPE }, null, 1) + '\n',
    [path.join(DASH, 'capability.json')]: JSON.stringify(pageData(map), null, 1) + '\n',
  };

  if (check) {
    // The page data embeds a build timestamp, so compare everything except that line.
    const stale = Object.entries(files).filter(([p, text]) => {
      if (!exists(p)) return true;
      const strip = s => s.replace(/"built": "[^"]*",?\n/, '');
      return strip(fs.readFileSync(p, 'utf8')) !== strip(text);
    });
    if (stale.length) {
      console.error(`capability map: ${stale.length} output(s) stale; run node ${rel(path.join(HERE, 'build.mjs'))}`);
      for (const [p] of stale) console.error(`  - ${rel(p)}`);
      process.exit(1);
    }
    console.log(`capability map OK (${map.counts.personas} personas, ${map.counts.use_cases} use cases, ${map.counts.grand_questions} grand questions, ${map.counts.gaps} gaps; outputs current)`);
    return;
  }

  let n = 0;
  for (const [p, text] of Object.entries(files)) if (writeIfChanged(p, text)) { n++; console.log(`wrote ${rel(p)}`); }
  console.log(`capability map ${MAP_VERSION}: ${map.counts.personas} personas, ${map.counts.use_cases} use cases ` +
    `(${map.counts.use_cases_by_answerability.yes || 0} answerable today, ${map.counts.use_cases_by_answerability.partly || 0} partly, ${map.counts.use_cases_by_answerability.no || 0} not), ` +
    `${map.counts.grand_questions} grand questions (${map.counts.grand_questions_with_real_repo_asset} with something real here), ` +
    `${map.counts.gaps} gaps, ${map.counts.citations} fetched citations. ${n} file(s) changed.`);
  console.log(`top gaps: ${map.gaps.slice(0, 5).map(g => `${g.rank}. ${g.name} (${g.unblocks.score}, ${g.effort})`).join('  ')}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('build.mjs')) main();
