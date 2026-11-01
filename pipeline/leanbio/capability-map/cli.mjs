#!/usr/bin/env node
// CLI for the LeanBio capability map. Same handlers as the four MCP tools, so the answers cannot diverge.
// Prints JSON by default; --table prints the compact human view.
//
//   node pipeline/leanbio/capability-map/cli.mjs overview
//   node pipeline/leanbio/capability-map/cli.mjs personas [--id reviewer-editor] [--needs-tool premise_check] [--status MISSING] [--brief] [--table]
//   node pipeline/leanbio/capability-map/cli.mjs use-cases [--id uc-which-laws-violated] [--persona student] [--answerable no] [--tool lean_check] [--uses-gap scale-coverage] [--uncomfortable] [--worked] [--limit 10] [--table]
//   node pipeline/leanbio/capability-map/cli.mjs grand-questions [--id gq-hamiltons-rule] [--disputed] [--core-strength strong] [--section core|remainder|in_repo|tools] [--no-citations] [--table]
//   node pipeline/leanbio/capability-map/cli.mjs tool-gap [--id scale-coverage] [--kind lean-module] [--effort small] [--buildable-now] [--unblocks-persona student] [--unblocks-question gq-hamiltons-rule] [--limit 10] [--table]
//   node pipeline/leanbio/capability-map/cli.mjs line            the one paragraph on what Lean can and cannot settle
//   node pipeline/leanbio/capability-map/cli.mjs tools           the real tool universe the EXISTS marks are checked against
//
// The same subcommands are proposed for mcp/cli.mjs and sim-engine/cli.mjs in CAPABILITY-REGISTER.md; until the hub
// applies those patches, this file is the CLI.
import { buildMap, MAP_VERSION } from './lib.mjs';
import { personas, useCases, grandQuestions, toolGap } from './tools.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const has = f => argv.includes(`--${f}`);
const val = (f, d) => { const i = argv.indexOf(`--${f}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const num = (f, d) => { const v = val(f); return v === undefined ? d : Number(v); };
const out = o => console.log(JSON.stringify(o, null, 2));
const table = has('table');
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);

function usage(code = 0) {
  console.log(`leanbio capability map ${MAP_VERSION}

  overview                      counts, the honest shape of the map
  personas                      who could use Lean for Bio, and the tools each needs
  use-cases                     one row per job: the tool sequence today, and what is missing
  grand-questions               the big questions, split into formalisable core and empirical remainder
  tool-gap                      the deduplicated gap list, ranked by how much each unblocks
  line                          what Lean can and cannot settle, in one paragraph
  tools                         the real tool universe the EXISTS marks are checked against

Add --table for the human view. Every flag is listed in the header of this file.`);
  process.exit(code);
}

switch (cmd) {
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    usage(0);
    break;

  case 'overview': {
    const m = buildMap();
    if (!table) { out({ version: m.version, as_of: m.as_of, counts: m.counts, scope: m.scope }); break; }
    const c = m.counts;
    console.log(`capability map ${m.version} (as of ${m.as_of})\n`);
    console.log(`  personas         ${c.personas}`);
    console.log(`  use cases        ${c.use_cases}   (${c.use_cases_by_answerability.yes || 0} answerable today, ${c.use_cases_by_answerability.partly || 0} partly, ${c.use_cases_by_answerability.no || 0} not)`);
    console.log(`  grand questions  ${c.grand_questions}   (${c.grand_questions_with_formalisable_core} with a formalisable core, ${c.grand_questions_with_real_repo_asset} with something real in this repo)`);
    console.log(`  tool gaps        ${c.gaps}   (${Object.entries(c.gaps_by_kind).map(([k, v]) => `${v} ${k}`).join(', ')})`);
    console.log(`  deliberately absent  ${c.not_gaps}`);
    console.log(`  citations        ${c.citations}  (all fetched)`);
    console.log(`  real tools       ${c.real_tools}   referenced ${c.tool_references} times: ${c.tool_reference_status.EXISTS} EXISTS, ${c.tool_reference_status.PARTIAL} PARTIAL, ${c.tool_reference_status.MISSING} MISSING`);
    console.log(`\nscope: ${m.scope}`);
    break;
  }

  case 'line':
    console.log(buildMap().the_line);
    break;

  case 'tools': {
    const m = buildMap();
    if (!table) { out({ count: m.tool_universe.length, tools: m.tool_universe }); break; }
    for (const t of m.tool_universe) console.log(`${pad(t.name, 28)} ${t.origins.join(', ')}`);
    console.log(`\n${m.tool_universe.length} tools (sim-engine/contract.json, mcp/server.mjs, and this folder's own export pending registration)`);
    break;
  }

  case 'personas': {
    const r = await personas({ id: val('id'), text: val('text'), needs_tool: val('needs-tool'), status: val('status'), brief: has('brief') });
    if (!table) { out(r); break; }
    for (const p of r.result.personas) {
      const counts = ['EXISTS', 'PARTIAL', 'MISSING'].map(s => `${(p.tools || []).filter(t => (t.status || String(t).split(':')[1]) === s).length} ${s}`).join(', ');
      console.log(`\n${p.id}  ${p.name}${p.is_us ? '  [this project]' : ''}`);
      console.log(`  who:    ${p.who}`);
      if (p.today) console.log(`  today:  ${p.today}`);
      console.log(`  tools:  ${counts}`);
      for (const t of p.tools || []) console.log(`    ${pad(typeof t === 'string' ? t : t.name, 30)} ${typeof t === 'string' ? '' : t.status}`);
      if (p.honesty) console.log(`  careful: ${p.honesty}`);
    }
    console.log(`\n${r.result.total} of ${r.result.of} personas`);
    break;
  }

  case 'use-cases': {
    const r = await useCases({
      id: val('id'), persona: val('persona'), answerable: val('answerable'), tool: val('tool'),
      uses_gap: val('uses-gap'), uncomfortable: has('uncomfortable') ? true : undefined,
      worked_only: has('worked'), text: val('text'), limit: num('limit', 50),
    });
    if (!table) { out(r); break; }
    for (const u of r.result.use_cases) {
      console.log(`\n[${u.answerable_today.toUpperCase()}] ${u.id}${u.uncomfortable ? '  (uncomfortable)' : ''}`);
      console.log(`  ${u.question}`);
      for (const s of u.sequence) console.log(`   ${s.step}. ${pad(s.tool, 28)} ${pad(s.status, 8)}${s.status === 'MISSING' ? ` -> gap ${s.gap_id}${s.load_bearing ? ' (load-bearing)' : ''}` : ''}`);
      if (u.worked_example) console.log(`  worked: ${u.worked_example.result}`);
      console.log(`  limit:  ${u.does_not_establish}`);
    }
    console.log(`\n${r.result.total} of ${r.result.of} use cases; ${JSON.stringify(r.result.by_answerability)}`);
    break;
  }

  case 'grand-questions': {
    const r = await grandQuestions({
      id: val('id'), disputed: has('disputed') ? true : undefined,
      has_repo_asset: has('has-repo-asset') ? true : undefined,
      core_strength: val('core-strength'), section: val('section', 'all'),
      with_citations: !has('no-citations'),
    });
    if (!table) { out(r); break; }
    console.log(r.result.the_line + '\n');
    for (const q of r.result.grand_questions) {
      console.log(`\n${q.id}  ${q.name}${q.disputed ? '  [DISPUTED]' : ''}`);
      console.log(`  ${q.question}`);
      if (q.dispute) console.log(`  dispute: ${q.dispute}`);
      const fc = q.formalisable_core, er = q.empirical_remainder;
      if (fc) {
        console.log(`  (a) FORMALISABLE CORE (${fc.has_core ? fc.strength : 'none: ' + fc.reason_none}):`);
        for (const s of fc.statements || []) console.log(`      - [${s.state}] ${s.claim}\n        settles: ${s.settles}${s.lean ? `\n        lean: ${s.lean}` : ''}`);
      }
      if (er) {
        console.log(`  (b) EMPIRICAL REMAINDER (${er.has_remainder ? er.share + ' of the question' : 'none: ' + er.reason_none}):`);
        for (const i of er.items || []) console.log(`      - ${i.what}\n        why no proof: ${i.why_not_provable}${i.measurement ? `\n        measurement: ${i.measurement}` : ''}`);
      }
      if (q.in_repo) {
        console.log(`  (c) IN THIS REPO:`);
        for (const x of q.in_repo) console.log(`      - [${x.strength}] ${x.ref}\n        ${x.note}`);
      }
      if (q.tools_needed) {
        console.log(`  (d) TOOLS NEEDED:`);
        for (const t of q.tools_needed) console.log(`      ${pad(t.name, 32)} ${t.status}${t.gap_id ? ` (gap ${t.gap_id})` : ''}`);
      }
    }
    console.log(`\n${r.result.total} of ${r.result.of} grand questions; ${r.result.with_real_repo_asset} have something real in this repo`);
    break;
  }

  case 'tool-gap': {
    const r = await toolGap({
      id: val('id'), kind: val('kind'), effort: val('effort'),
      buildable_now: has('buildable-now') ? true : (has('not-buildable-now') ? false : undefined),
      unblocks_persona: val('unblocks-persona'), unblocks_question: val('unblocks-question'),
      limit: num('limit', 30), include_not_gaps: !has('no-not-gaps'),
    });
    if (!table) { out(r); break; }
    for (const g of r.result.gaps) {
      const c = g.unblocks.counts;
      console.log(`\n${String(g.rank).padStart(2)}. ${g.name}  [${g.kind}, ${g.effort}, ${g.buildable.on_what_we_have ? 'buildable now' : 'needs data or Lean work'}]`);
      console.log(`    need:      ${g.need}`);
      console.log(`    signature: ${g.signature}`);
      console.log(`    reads:     ${g.reads.join('; ')}`);
      console.log(`    unblocks:  ${c.personas} personas, ${c.use_cases} use cases, ${c.grand_questions} grand questions (${c.blocking_use_cases} of them answerable only with it) -> score ${g.unblocks.score}`);
      if ((g.nearest_existing || []).length) console.log(`    nearest:   ${g.nearest_existing.join(', ')}`);
      console.log(`    risk:      ${g.risk}`);
    }
    if (r.result.not_gaps) {
      console.log(`\nDELIBERATELY ABSENT (not gaps):`);
      for (const n of r.result.not_gaps) console.log(`  - ${n.name}${n.owner ? ` [${n.owner}]` : ''}\n    ${n.why_not}`);
    }
    console.log(`\n${r.result.total} of ${r.result.of} gaps; ${JSON.stringify(r.result.by_kind)}`);
    break;
  }

  default:
    console.error(`unknown subcommand ${JSON.stringify(cmd)}`);
    usage(2);
}
