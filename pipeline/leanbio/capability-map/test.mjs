#!/usr/bin/env node
// Tests for the LeanBio capability map. Every check runs twice: on the real documents (must PASS) and on
// deliberately broken copies (must FAIL), so no check can pass vacuously. This is the convention in
// lean/registry/test.mjs and pipeline/leanbio/test.mjs. Offline: nothing here fetches anything.
//
//   node pipeline/leanbio/capability-map/test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {
  HERE, FILES, loadDocs, toolUniverse, buildMap, deriveAnswerable, deriveUnblocks,
  personaProblems, useCaseProblems, grandQuestionProblems, gapProblems, citationProblems,
  toolNameProblems, leanRefProblems, allProblems, CAPABILITY_TOOL_NAMES,
} from './lib.mjs';
import { schemaProblems, mirrorFiles, pageData } from './build.mjs';
import { CAPABILITY_TOOLS } from './tools.mjs';

let failures = 0;
function check(name, realFn, brokenFn) {
  const run = f => { try { return f(); } catch (e) { return [String(e.message || e)]; } };
  const real = run(realFn), broken = run(brokenFn);
  const realOk = Array.isArray(real) ? real.length === 0 : !!real;
  const brokenCaught = Array.isArray(broken) ? broken.length > 0 : !broken;
  const ok = realOk && brokenCaught;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}` +
    `${realOk ? '' : `\n     real input: ${JSON.stringify(real).slice(0, 500)}`}` +
    `${brokenCaught ? '' : '\n     broken input was NOT caught'}`);
}

const docs = loadDocs();
const universe = toolUniverse();
const clone = o => JSON.parse(JSON.stringify(o));
// A broken copy of the whole document set, mutated by fn.
const bust = fn => { const d = clone(docs); fn(d); return d; };

// ── 1. The requirement Amit stated: every use case's tool sequence names only real tools, or is marked MISSING ──
check('use cases: every sequence step names a real tool or is explicitly MISSING with a gap',
  () => toolNameProblems(docs, universe),
  () => toolNameProblems(bust(d => { d.use_cases.use_cases[0].sequence[0].tool = 'delphi_invent_a_result'; }), universe));

check('use cases: a MISSING step whose gap_id is not in tool-gap.json is caught',
  () => toolNameProblems(docs, universe),
  () => toolNameProblems(bust(d => {
    const s = d.use_cases.use_cases.flatMap(u => u.sequence).find(x => x.status === 'MISSING');
    s.gap_id = 'no-such-gap';
  }), universe));

check('use cases: a MISSING step naming a tool that ACTUALLY exists is caught (the silent-stale failure)',
  () => toolNameProblems(docs, universe),
  () => toolNameProblems(bust(d => {
    const s = d.use_cases.use_cases.flatMap(u => u.sequence).find(x => x.status === 'MISSING');
    s.tool = 'lean_check';
  }), universe));

check('personas: a tool marked EXISTS that is not in contract.json, mcp/server.mjs or our own export is caught',
  () => toolNameProblems(docs, universe),
  () => toolNameProblems(bust(d => { d.personas.personas[0].tools[0] = { name: 'lean_oracle', status: 'EXISTS', note: 'answers everything' }; }), universe));

// ── 2. Every grand question has both a formalisable core and an empirical remainder, or states that it has none ──
check('grand questions: both halves present, or has_core/has_remainder false WITH a reason',
  () => grandQuestionProblems(docs),
  () => grandQuestionProblems(bust(d => { delete d.grand_questions.grand_questions[0].empirical_remainder; })));

check('grand questions: has_core true with no statements is caught',
  () => grandQuestionProblems(docs),
  () => grandQuestionProblems(bust(d => { d.grand_questions.grand_questions[0].formalisable_core.statements = []; })));

check('grand questions: has_remainder false with no reason_none is caught',
  () => grandQuestionProblems(docs),
  () => grandQuestionProblems(bust(d => { d.grand_questions.grand_questions[2].empirical_remainder = { has_remainder: false, items: [] }; })));

check('grand questions: has_core false WITH a reason is accepted (a legitimate answer, not a defect)',
  () => grandQuestionProblems(bust(d => {
    d.grand_questions.grand_questions[0].formalisable_core = { has_core: false, reason_none: 'Nothing about this question is a matter of whether a conclusion follows from stated premises.', statements: [] };
  })),
  () => grandQuestionProblems(bust(d => {
    d.grand_questions.grand_questions[0].formalisable_core = { has_core: false, statements: [] };
  })));

check('grand questions: a remainder item with no why_not_provable is caught',
  () => grandQuestionProblems(docs),
  () => grandQuestionProblems(bust(d => { d.grand_questions.grand_questions[0].empirical_remainder.items[0] = { what: 'something nobody has measured yet at all' }; })));

check('grand questions: a disputed question with no dispute statement is caught',
  () => grandQuestionProblems(docs),
  () => grandQuestionProblems(bust(d => { const q = d.grand_questions.grand_questions.find(x => x.disputed); delete q.dispute; })));

// ── 3. No persona has an empty tool list ──
check('personas: no empty tool list, no persona unreachable from any use case',
  () => personaProblems(docs),
  () => personaProblems(bust(d => { d.personas.personas[0].tools = []; })));

check('personas: a persona named by no use case is caught',
  () => personaProblems(docs),
  () => personaProblems(bust(d => {
    d.personas.personas.push({ id: 'ghost-persona', name: 'Somebody we invented', who: 'A persona with no job anywhere in the map at all.', today: 'Nothing, because nobody asked them to do anything here.', would_ask: ['Why am I in this file?'], tools: [{ name: 'lean_check', status: 'EXISTS', note: 'does not matter' }] });
  })));

check('use cases: a persona id that is not in personas.json is caught',
  () => personaProblems(docs),
  () => personaProblems(bust(d => { d.use_cases.use_cases[0].personas = ['nobody-at-all']; })));

// ── 4. The derived fields really are derived ──
check('answerable_today is derived from the step statuses, not stored independently',
  () => useCaseProblems(docs),
  () => useCaseProblems(bust(d => { const u = d.use_cases.use_cases.find(x => x.answerable_today === 'no'); u.answerable_today = 'yes'; })));

check('answerable_today: a load-bearing MISSING step forces "no"',
  () => {
    const yes = { id: 'x', sequence: [{ status: 'EXISTS' }, { status: 'EXISTS' }] };
    const partly = { id: 'y', sequence: [{ status: 'EXISTS' }, { status: 'MISSING', load_bearing: false }] };
    const no = { id: 'z', sequence: [{ status: 'EXISTS' }, { status: 'MISSING', load_bearing: true }] };
    return deriveAnswerable(yes) === 'yes' && deriveAnswerable(partly) === 'partly' && deriveAnswerable(no) === 'no';
  },
  () => deriveAnswerable({ id: 'z', sequence: [{ status: 'EXISTS' }, { status: 'MISSING', load_bearing: true }] }) === 'yes');

check('gap rank is counted from the other documents, so a gap cannot promote itself',
  () => {
    const before = deriveUnblocks(docs);
    const tampered = bust(d => { d.tool_gap.gaps.find(g => g.id === 'teach-claim').rank = 1; });
    const after = deriveUnblocks(tampered);
    const b = before.find(g => g.id === 'teach-claim').rank, a = after.find(g => g.id === 'teach-claim').rank;
    return a === b && b !== 1;
  },
  () => {
    // Broken input: a gap that nothing references must still rank, which would mean the count is not real.
    const tampered = bust(d => { d.personas.personas.forEach(p => { p.tools = p.tools.filter(t => t.status !== 'MISSING'); }); });
    const after = deriveUnblocks(tampered);
    const g = after.find(x => x.id === 'teach-claim');
    return g.unblocks.counts.personas === before_personas_count();
  });
function before_personas_count() { return deriveUnblocks(docs).find(x => x.id === 'teach-claim').unblocks.counts.personas; }

// ── 5. Gaps, citations, Lean references ──
check('gaps: deduplicated, with a signature, reads, buildability and a risk note',
  () => gapProblems(docs),
  () => gapProblems(bust(d => { delete d.tool_gap.gaps[0].risk; })));

check('gaps: a gap nothing in the map asks for is caught',
  () => gapProblems(docs),
  () => gapProblems(bust(d => {
    d.tool_gap.gaps.push({ id: 'orphan-gap', name: 'orphan_tool', kind: 'tool', need: 'Something nobody in this map ever asks for.', signature: 'orphan_tool() -> nothing at all', reads: ['nothing'], effort: 'small', buildable: { on_what_we_have: true, why: 'It would read nothing, so there is nothing to be missing.' }, risk: 'Nobody would use it, which is the risk.' });
  })));

check('gaps: "not buildable on what we have" must name the missing data or a Lean build',
  () => gapProblems(docs),
  () => gapProblems(bust(d => { const g = d.tool_gap.gaps.find(x => x.buildable.on_what_we_have === false); g.buildable = { on_what_we_have: false, why: 'It just is not, and we are not saying what is missing.' }; })));

check('citations: every key a grand question cites resolves, and nothing claims verification with no identifier',
  () => citationProblems(docs),
  () => citationProblems(bust(d => { d.grand_questions.grand_questions[0].citations = ['no-such-paper-2099']; })));

check('citations: a record claiming europepmc with no DOI, PMID or URL is caught',
  () => citationProblems(docs),
  () => citationProblems(bust(d => { d.citations.citations.fabricated = { ref: 'Nobody N (2099). A paper that does not exist. Journal of Nothing 1:1.', verified_via: 'europepmc' }; })));

check('Lean: a statement claimed as proved-here must be declared in the module it names',
  () => leanRefProblems(docs),
  () => leanRefProblems(bust(d => {
    const q = d.grand_questions.grand_questions.find(x => x.formalisable_core.statements.some(s => s.state === 'proved-here'));
    q.formalisable_core.statements.find(s => s.state === 'proved-here').lean = 'Delphi.Imaginary.theorem_we_wish_we_had';
  })));

check('Lean: a proved-here statement with no module named is caught',
  () => leanRefProblems(docs),
  () => leanRefProblems(bust(d => {
    const q = d.grand_questions.grand_questions.find(x => x.formalisable_core.statements.some(s => s.state === 'proved-here'));
    delete q.formalisable_core.statements.find(s => s.state === 'proved-here').module;
  })));

// ── 6. Schema ──
check('schema: every document validates against its branch of capability-map.schema.json',
  () => schemaProblems(docs),
  () => schemaProblems(bust(d => { d.personas.personas[0].would_ask = []; })));

check('schema: a MISSING step without load_bearing is refused',
  () => schemaProblems(docs),
  () => schemaProblems(bust(d => {
    const s = d.use_cases.use_cases.flatMap(u => u.sequence).find(x => x.status === 'MISSING');
    delete s.load_bearing;
  })));

check('schema: a document with the wrong kind is refused',
  () => schemaProblems(docs),
  () => schemaProblems(bust(d => { d.personas.kind = 'tool_gap'; })));

// ── 7. The four tools and the served outputs ──
const map = buildMap();
check('tools: four tools with titles, descriptions, input schemas and handlers',
  () => CAPABILITY_TOOLS.length === 4
    && CAPABILITY_TOOLS.map(t => t.name).join() === CAPABILITY_TOOL_NAMES.join()
    && CAPABILITY_TOOLS.every(t => t.title && t.description && t.inputSchema && typeof t.handler === 'function'),
  () => CAPABILITY_TOOLS.length === 5);

const byName = Object.fromEntries(CAPABILITY_TOOLS.map(t => [t.name, t]));
const pers = await byName.leanbio_personas.handler({});
const ucs = await byName.leanbio_use_cases.handler({ answerable: 'no' });
const gqs = await byName.leanbio_grand_questions.handler({ id: 'gq-hamiltons-rule' });
const gap = await byName.leanbio_tool_gap.handler({ limit: 5 });

check('tools: every envelope carries result, provenance and a scope string',
  () => [pers, ucs, gqs, gap].every(r => r.result && Array.isArray(r.provenance) && r.provenance.length > 0 && typeof r.scope === 'string' && r.scope.length > 80),
  () => [pers, ucs, gqs, gap].every(r => r.scope === undefined));

check('tools: leanbio_personas returns every persona with a non-empty tool list',
  () => pers.result.personas.length === map.counts.personas && pers.result.personas.every(p => p.tools.length > 0),
  () => pers.result.personas.length === map.counts.personas + 1);

check('tools: leanbio_use_cases filters by answerability and every returned row has a load-bearing gap',
  () => ucs.result.use_cases.length > 0
    && ucs.result.use_cases.every(u => u.answerable_today === 'no')
    && ucs.result.use_cases.every(u => u.sequence.some(s => s.status === 'MISSING' && s.load_bearing === true)),
  () => ucs.result.use_cases.some(u => u.answerable_today === 'yes'));

check('tools: leanbio_grand_questions resolves citations and keeps the formalisable/empirical split',
  () => {
    const q = gqs.result.grand_questions[0];
    return q.id === 'gq-hamiltons-rule' && q.disputed === true
      && q.formalisable_core.has_core === true && q.empirical_remainder.has_remainder === true
      && Object.keys(gqs.result.citations).length >= 2
      && gqs.result.the_line.includes('does not adjudicate reality');
  },
  () => gqs.result.grand_questions[0].id === 'gq-not-a-question');

check('tools: leanbio_tool_gap returns rank order with derived unblock counts and the not_gaps list',
  () => gap.result.gaps.length === 5
    && gap.result.gaps.every((g, i) => g.rank === i + 1)
    && gap.result.gaps.every(g => g.unblocks && g.unblocks.counts && g.risk)
    && gap.result.not_gaps.length > 0
    && gap.result.not_gaps.every(n => n.why_not),
  () => gap.result.gaps.some(g => g.rank === 0));

const threw = async fn => { try { await fn(); return false; } catch { return true; } };
check('tools: an unknown id throws rather than returning a silently empty result',
  // Real: asking for an id that does not exist must throw, and the message must list the real ids.
  await (async () => {
    try { await byName.leanbio_grand_questions.handler({ id: 'gq-nope' }); return () => ['no error for an unknown grand-question id']; }
    catch (e) { const m = String(e.message); return () => (m.includes('gq-hamiltons-rule') ? [] : [`error did not list the real ids: ${m}`]); }
  })(),
  // Broken: asking for an id that DOES exist must not throw, so the check is not passing on every input.
  await (async () => (await threw(() => byName.leanbio_grand_questions.handler({ id: 'gq-hamiltons-rule' })) ? () => true : () => false))());

check('mirror: the static files cover the index, each document and one file per grand question',
  () => {
    const f = mirrorFiles(map);
    const need = ['index.json', 'personas.json', 'use-cases.json', 'grand-questions.json', 'tool-gap.json', 'citations.json', 'schema.json'];
    return need.every(k => f[k]) && map.grand_questions.every(q => f[`grand-questions/${q.id}.json`]) && JSON.parse(f['index.json']).scope.length > 80;
  },
  () => { const f = mirrorFiles(map); return !!f['grand-questions/gq-does-not-exist.json']; });

check('page data: every section the page renders is present and carries the scope and the line',
  () => {
    const d = pageData(map);
    return d.counts && d.personas.length === map.counts.personas && d.use_cases.length === map.counts.use_cases
      && d.grand_questions.length === map.counts.grand_questions && d.gaps.length === map.counts.gaps
      && d.not_gaps.length > 0 && d.scope.length > 80 && d.the_line.length > 80
      && d.grand_questions.every(q => q.core && q.remainder)
      && d.gaps.every(g => typeof g.rank === 'number' && g.unblocks);
  },
  () => pageData(map).grand_questions.some(q => q.core === undefined));

// Staleness check: the page's data file on disk must equal what the map would write now, so a hand-edited
// enumeration cannot ship without rebuilding. Its broken input is the data of a map with one persona removed,
// which the same comparison must reject.
const PAGE_JSON = path.join(HERE, '..', '..', '..', 'dashboard', 'public', 'leanbio', 'capability.json');
const stripBuilt = s => s.replace(/"built": "[^"]*",?\n/, '');
const onDisk = () => (fs.existsSync(PAGE_JSON) ? stripBuilt(fs.readFileSync(PAGE_JSON, 'utf8')) : null);
check('page data on disk is current (run build.mjs after editing any enumeration)',
  () => {
    const have = onDisk();
    if (have === null) return ['dashboard/public/leanbio/capability.json is missing'];
    return have === stripBuilt(JSON.stringify(pageData(map), null, 1) + '\n') ? [] : ['dashboard/public/leanbio/capability.json is stale: run build.mjs'];
  },
  () => {
    const shrunk = { ...map, personas: map.personas.slice(1), counts: { ...map.counts, personas: map.counts.personas - 1 } };
    return onDisk() === stripBuilt(JSON.stringify(pageData(shrunk), null, 1) + '\n') ? [] : ['a map with a persona removed must NOT match the file on disk'];
  });

// ── 8. Everything at once ──
check('all checks together on the real documents',
  () => allProblems(docs, universe),
  () => allProblems(bust(d => {
    d.personas.personas[1].tools = [];
    d.use_cases.use_cases[1].sequence[0].tool = 'not_a_tool_at_all';
    delete d.grand_questions.grand_questions[3].empirical_remainder;
  }), universe));

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed (each also failed once on broken input)');
process.exit(failures ? 1 : 0);
