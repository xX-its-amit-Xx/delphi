#!/usr/bin/env node
// Cross-graph CLI.
//
//   node crossgraph/cli.mjs --health                      is the service up, and which surface
//   node crossgraph/cli.mjs --ground "sonic hedgehog"     string -> CURIE, with score and resolver
//   node crossgraph/cli.mjs --between hgnc:10848 chebi:4021
//   node crossgraph/cli.mjs --density ALB [--ns CHEBI]
//   node crossgraph/cli.mjs --corroborate [--co-mentions] [--max 20] [--json] [--out DIR]
//
// Every command that reaches the network says so in its output. Nothing here writes to the repository
// unless --out is given, and --out writes a report, never a claim.
import fs from 'fs';
import path from 'path';
import * as G from './cogex.mjs';
import * as C from './corroborate.mjs';

const argv = process.argv.slice(2);
const has = n => argv.includes(`--${n}`);
const val = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const RECORDS = 'pipeline/leanbio/out/records.json';

if (!argv.length || has('help')) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 14).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

if (has('health')) {
  const h = await G.health();
  console.log(`REST   ${h.rest.ok ? 'UP  ' : 'DOWN'}  ${h.rest.detail}`);
  console.log(`Cypher ${h.cypher.ok ? 'UP  ' : 'DOWN'}  ${h.cypher.detail}`);
  console.log(`\n${h.which_to_trust}`);
  process.exit(h.rest.ok ? 0 : 1);
}

if (has('ground')) {
  const text = val('ground');
  const r = await G.ground(text);
  if (!r.available) { console.error(`grounding service unavailable: ${r.why}`); process.exit(1); }
  if (!r.groundings.length) { console.log(`no grounding for "${text}"\n\n${r.empty_means}`); process.exit(0); }
  for (const g of r.groundings.slice(0, 8)) console.log(`  ${String(g.score).slice(0, 6).padEnd(7)} ${g.curie.padEnd(22)} ${String(g.name).padEnd(28)} ${g.status ?? ''} ${g.organism ?? ''}`);
  process.exit(0);
}

if (has('between')) {
  const i = argv.indexOf('--between');
  const [a, b] = [argv[i + 1], argv[i + 2]];
  const r = await G.relationsBetween(a, b);
  console.log(`${a}  <->  ${b}   status: ${r.status}`);
  if (r.status === 'refused') { for (const w of r.refused_because) console.log(`  REFUSED: ${w}`); console.log(`  ${r.this_is_not_a_negative}`); process.exit(0); }
  if (r.status === 'unavailable') { console.log(`  ${r.why}\n  ${r.this_is_not_a_negative}`); process.exit(1); }
  const p = r.profile;
  console.log(`  ${p.n_relations} relation(s), ${p.n_evidence} evidence(s), ${p.relations_with_database_evidence} database-backed, ${p.relations_with_reader_evidence_only} reader-only, max belief ${p.max_belief}`);
  for (const [t, v] of Object.entries(p.by_type)) console.log(`    ${t.padEnd(18)} ${v.relations} relation(s)  ${String(v.evidence).padStart(4)} evidence  ${v.database_backed} db-backed  belief<=${v.max_belief.toFixed(3)}`);
  if (p.relations_with_retracted_evidence) console.log(`  WARNING: ${p.relations_with_retracted_evidence} relation(s) have evidence from a retracted paper.`);
  if (r.note) console.log(`  ${r.note}`);
  if (p.n_relations === 0) console.log('  nothing found. Run --density on each side before calling this a negative.');
  process.exit(0);
}

if (has('density')) {
  const d = await G.densityProbe(val('density'), { partner_namespace: val('ns') });
  if (d.status !== 'ok') { console.error(`unavailable: ${d.why}`); process.exit(1); }
  console.log(`${d.agent}: at least ${d.distinct_partner_ids_lower_bound} distinct ${d.partner_namespace} partner(s) across ${d.statements_examined} statement(s) -> ${d.dense ? 'DENSE' : 'SPARSE'}`);
  console.log(`  ${d.why_a_lower_bound}`);
  console.log(`  ${d.threshold_is_ours}`);
  process.exit(0);
}

if (has('corroborate')) {
  if (!fs.existsSync(RECORDS)) { console.error(`${RECORDS} not found. Run from the repository root.`); process.exit(2); }
  const records = JSON.parse(fs.readFileSync(RECORDS, 'utf8')).records;
  const rep = await C.report(records, { include_co_mentions: has('co-mentions'), max_pairs: Number(val('max', '25')) });
  if (has('json')) { console.log(JSON.stringify(rep, null, 1)); process.exit(0); }

  const bar = '='.repeat(100);
  console.log(`\n${bar}\n CROSS-GRAPH CORROBORATION against ${rep.source.service}\n${bar}`);
  console.log(`\n${rep.what_this_is}\n`);
  console.log(`records examined          ${rep.counts.records_examined}`);
  console.log(`asserted pairs            ${rep.counts.asserted_pairs}`);
  console.log(`co-mention pairs          ${rep.counts.co_mention_pairs}${has('co-mentions') ? '' : '  (not queried; pass --co-mentions)'}`);
  console.log(`self-loops excluded       ${rep.counts.self_loops_excluded}`);
  console.log(`pairs queried             ${rep.counts.pairs_queried}`);
  if (rep.cap_disclosure) console.log(`CAP                       ${rep.cap_disclosure}`);

  console.log('\n-- VERDICTS --------------------------------------------------------------------------------');
  for (const [v, n] of Object.entries(rep.tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${v}`);
  console.log(`\n  ${rep.how_to_read_the_tally}`);

  if (rep.grounding_quality.pairs_with_a_suspect_grounding) {
    console.log('\n-- GROUNDING QUALITY, WHICH IS A FINDING ABOUT US ------------------------------------------');
    console.log(`  ${rep.grounding_quality.pairs_with_a_suspect_grounding} pair(s) carry a suspect grounding; ${rep.grounding_quality.negatives_suppressed} negative verdict(s) suppressed as a result.`);
    console.log(`  ${rep.grounding_quality.what_this_measures}`);
    for (const g of rep.grounding_quality.flags) {
      console.log(`\n  ${g.record_id.slice(0, 60)}   ${g.pair}`);
      for (const f of g.flags) console.log(`    [${f.severity}] ${f.kind}: ${f.detail}`);
    }
  }

  if (rep.read_the_expressibility_warnings_first) {
    console.log('\n-- READ THIS FIRST -------------------------------------------------------------------------');
    console.log(`  ${rep.read_the_expressibility_warnings_first}`);
    for (const w of rep.expressibility_warnings) {
      console.log(`\n  ${w.record_id}  (verdict was: ${w.verdict})`);
      console.log(`    ${w.why}`);
      if (w.how_the_mistyping_happens) console.log(`    ${w.how_the_mistyping_happens}`);
      console.log(`    WHAT TO DO: ${w.what_to_do}`);
    }
  }

  console.log('\n-- PER PAIR --------------------------------------------------------------------------------');
  for (const r of rep.results) {
    console.log(`\n  ${r.verdict.toUpperCase()}  ${r.record_id}${r.draft ? '  [draft]' : ''}`);
    console.log(`    ${r.kind === 'asserted' ? `asserts ${r.asserted_type}` : 'co-mention only'}: ${r.a} (${r.a_name}) / ${r.b} (${r.b_name})`);
    console.log(`    ${r.why}`);
    console.log(`    counts against our claim: ${r.is_this_evidence_against_our_claim ? 'YES' : 'no'} - ${r.because ?? ''}`);
    if (r.caution) console.log(`    CAUTION: ${r.caution}`);
  }

  if (rep.self_loops.length) {
    console.log('\n-- EXCLUDED SELF-LOOPS ---------------------------------------------------------------------');
    for (const s of rep.self_loops) console.log(`  ${s.record_id}  ${s.a}\n    ${s.why_excluded}`);
  }

  console.log('\n-- PROVENANCE OF THE GRAPH ITSELF ----------------------------------------------------------');
  console.log(`  operator      ${rep.source.operator}`);
  console.log(`  measured      ${rep.source.measured_size.nodes.toLocaleString()} nodes, ${rep.source.measured_size.relationships.toLocaleString()} relationships on ${rep.source.measured_size.measured_on}`);
  console.log(`  code licence  ${rep.source.code_licence}`);
  console.log(`  DATA licence  ${rep.source.data_licence}`);
  console.log(`  citation      ${rep.source.citable_paper}`);

  const out = val('out');
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    const p = path.join(out, 'corroboration.json');
    fs.writeFileSync(p, JSON.stringify(rep, null, 1));
    console.log(`\n  written to ${p}`);
  }
  console.log(`\n${bar}\n A missing relation means the assembled literature does not contain the statement. It does not\n mean the statement is false. Nothing here is a verdict on a claim.\n${bar}\n`);
  process.exit(0);
}

console.error('no command given. Try --help');
process.exit(2);
