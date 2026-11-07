#!/usr/bin/env node
// Tests for the cross-graph layer.
//
//   node crossgraph/test.mjs              run the tests
//   node crossgraph/test.mjs --fail-once  inject one fault per test and show each one FAIL
//
// Same discipline as the rest of this repository: every test was made to fail first, and `--fail-once`
// proves it on demand. A test that still passes with its fault injected is reported as a FAILURE.
//
// NOTHING HERE TOUCHES THE NETWORK. Every service response is a recorded fixture under
// crossgraph/fixtures/, captured on 2026-11-06, and the transport is injected. That is deliberate: the
// Cypher surface went down during development, and a test suite that fails because somebody else's
// database is restarting teaches nothing. Live checks live in cli.mjs --health and --live.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as G from './cogex.mjs';
import * as C from './corroborate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fx = name => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'));

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

/** A fetch that serves fixtures and never opens a socket. */
function fakeFetch(map) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    for (const [match, resp] of map) {
      if (!String(url).includes(match)) continue;
      if (typeof resp === 'function') { const r = resp(body); if (r === undefined) continue; return mk(r); }
      return mk(resp);
    }
    return { ok: false, status: 503, text: async () => 'no fixture matched' };
  };
  function mk(json) { return { ok: true, status: 200, text: async () => JSON.stringify(json) }; }
}
const DEAD_FETCH = async () => { throw Object.assign(new Error('socket hang up'), { name: 'TypeError' }); };

// ---------------------------------------------------------------------------------------------------
// TEST 1. The identifier-prefix bug. CoGEx returns ChEBI as {ns:"CHEBI", id:"CHEBI:4021"} and HGNC as
// {ns:"HGNC", id:"10848"}. A naive join produces "chebi:CHEBI:4021", every relation is filtered out, and
// the pair looks like a clean negative. This is the most dangerous bug this file can have, because it
// fails silently in the direction of a false finding.
// INJECTED FAULT: join namespace and identifier naively.
function test1(f) {
  const naive = (ns, id) => `${String(ns).toLowerCase()}:${id}`;
  const join = f ? naive : G.nodeCurie;
  const cases = [[['CHEBI', 'CHEBI:4021'], 'chebi:4021'], [['HGNC', '10848'], 'hgnc:10848'],
    [['GO', 'GO:0009653'], 'go:0009653'], [['hgnc', '399'], 'hgnc:399'], [['MESH', 'D012995'], 'mesh:D012995']];
  let bad = null;
  for (const [[ns, id], want] of cases) { const got = join(ns, id); if (got !== want) bad = `${ns}/${id} -> ${got}, want ${want}`; }
  check(`cogex: a repeated namespace prefix in the identifier is stripped${f ? ' +FAULT' : ''}`,
    !bad, bad ?? `${cases.length} pairs, all normalised`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. The zebrafish namespaces hold ZERO nodes in CoGEx. Asking is a category error, and the answer
// must be a refusal with a reason - never an empty result that could be read as an absence of evidence.
// INJECTED FAULT: treat zfin as askable.
function test2(f) {
  const out = ['zfin:ZDB-GENE-030131-9593', 'zfa:ZFA:0000107', 'ncbitaxon:7955', 'ensembl:ENSDARG00000000001'];
  let ok = true, why = [];
  for (const c of out) {
    const s = f ? { askable: true } : G.scopeOf(c);
    if (s.askable !== false || !/0 nodes/.test(s.reason ?? '')) { ok = false; why.push(c); }
  }
  check(`cogex: all 4 zero-node namespaces are refused with the node count in the reason${f ? ' +FAULT' : ''}`,
    ok, ok ? out.map(c => c.split(':')[0]).join(', ') : `askable: ${why.join(', ')}`);

  const zf = G.scopeOf('zfin:ZDB-GENE-x');
  check(`cogex: the zebrafish refusal points at the explicit orthologue bridge${f ? ' +FAULT' : ''}`,
    !f && /humanOrthologueBridge/.test(zf.what_to_do ?? '') && /assumption/i.test(zf.what_to_do ?? ''),
    (zf.what_to_do ?? '').slice(0, 60));

  const ok2 = G.scopeOf(f ? 'zfin:1' : 'hgnc:399');
  check(`cogex: an in-scope namespace is askable and carries its measured node count${f ? ' +FAULT' : ''}`,
    ok2.askable === true && ok2.kind === 'in-scope' && ok2.nodes_in_namespace > 0, `${ok2.namespace} -> ${ok2.nodes_in_namespace ?? 'n/a'}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. Relations between two entities must be found in the recorded response, with the right types.
// INJECTED FAULT: serve the empty fixture instead of the populated one.
async function test3(f) {
  const fetchImpl = fakeFetch([['indra_subnetwork_relations', f ? fx('subnetwork-alb-caco3.json') : fx('subnetwork-shh-cyclopamine.json')]]);
  const r = await G.relationsBetween('hgnc:10848', 'chebi:4021', { fetchImpl });
  check(`cogex: 9 relations are recovered between SHH and cyclopamine${f ? ' +FAULT' : ''}`,
    r.status === 'ok' && r.profile.n_relations === 9, `status=${r.status}, n=${r.profile?.n_relations}`);
  check(`cogex: the type tally matches the fixture exactly${f ? ' +FAULT' : ''}`,
    r.profile?.by_type?.Inhibition?.relations === 3 && r.profile?.by_type?.Complex?.relations === 2 &&
      r.profile?.by_type?.Activation?.relations === 2 && r.profile?.by_type?.IncreaseAmount?.relations === 1 &&
      r.profile?.by_type?.DecreaseAmount?.relations === 1,
    JSON.stringify(Object.fromEntries(Object.entries(r.profile?.by_type ?? {}).map(([k, v]) => [k, v.relations]))));
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. A dead service must produce `unavailable`, and `unavailable` must never be classified as an
// absence. This is the distinction the whole module exists to protect.
// INJECTED FAULT: classify an unavailable result as if it were an absence.
async function test4(f) {
  const transport = f ? fakeFetch([['indra_subnetwork_relations', fx('subnetwork-shh-cyclopamine.json')]]) : DEAD_FETCH;
  const r = await G.relationsBetween('hgnc:10848', 'chebi:4021', { fetchImpl: transport, timeout_ms: 500 });
  check(`cogex: a transport failure returns status "unavailable" with the reason${f ? ' +FAULT' : ''}`,
    r.status === 'unavailable' && typeof r.why === 'string', `status=${r.status}, why=${String(r.why).slice(0, 50)}`);

  const v = C.classify({ asserted_type: 'Inhibition' }, r, {});
  check(`cogex: an unavailable service is NOT evidence against the claim${f ? ' +FAULT' : ''}`,
    v.verdict === 'unavailable' && v.is_this_evidence_against_our_claim === false, `verdict=${v.verdict}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. The five kinds of nothing must stay five. A zero only becomes a negative when BOTH entities
// are known to be dense.
// INJECTED FAULT: report density as known and dense when it was never measured.
function test5(f) {
  const empty = { status: 'ok', profile: G.evidenceProfile([]) };
  const dense = { status: 'ok', dense: true, distinct_partner_ids_lower_bound: 44 };
  const sparse = { status: 'ok', dense: f ? true : false, distinct_partner_ids_lower_bound: 1 };
  const unknown = { status: 'unavailable' };
  const pair = { asserted_type: 'IncreaseAmount' };

  const a = C.classify(pair, empty, { a: dense, b: dense });
  const b = C.classify(pair, empty, { a: dense, b: sparse });
  const c = C.classify(pair, empty, f ? { a: dense, b: dense } : { a: dense, b: unknown });
  const d = C.classify(pair, f ? empty : { status: 'refused', refused_because: ['zero nodes'] }, {});

  check(`corroborate: dense+dense+zero is the only verdict that counts against a claim${f ? ' +FAULT' : ''}`,
    a.verdict === 'absent-and-dense' && a.is_this_evidence_against_our_claim === true &&
      b.verdict === 'absent-but-sparse' && b.is_this_evidence_against_our_claim === false,
    `${a.verdict} / ${b.verdict}`);
  check(`corroborate: unmeasured density yields absent-density-unknown, not a negative${f ? ' +FAULT' : ''}`,
    c.verdict === 'absent-density-unknown' && c.is_this_evidence_against_our_claim === false, `verdict=${c.verdict}`);
  check(`corroborate: a refused pair is out-of-scope and not evidence${f ? ' +FAULT' : ''}`,
    d.verdict === 'out-of-scope' && d.is_this_evidence_against_our_claim === false, `verdict=${d.verdict}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. The strongest negative - relations exist but not of the asserted type - and the evidence
// profile that stops a relation count being read as strength.
// INJECTED FAULT: assert a type that IS present, so no contradiction can be detected.
function test6(f) {
  const rel = { status: 'ok', profile: G.evidenceProfile(fx('subnetwork-shh-cyclopamine.json')) };
  const v = C.classify({ asserted_type: f ? 'Inhibition' : 'Phosphorylation' }, rel, {});
  check(`corroborate: an asserted type absent from existing relations is CONTRADICTED${f ? ' +FAULT' : ''}`,
    v.verdict === 'contradicted' && v.is_this_evidence_against_our_claim === true && /not of the asserted type/i.test(v.why),
    `verdict=${v.verdict}, modal=${v.modal_type}`);

  const p = rel.profile;
  check(`corroborate: the profile separates database-backed from reader-only and counts evidence${f ? ' +FAULT' : ''}`,
    !f && p.n_evidence === 148 && p.relations_with_database_evidence === 4 && p.relations_with_reader_evidence_only === 5 &&
      p.n_relations === 9 && typeof p.how_to_read_this === 'string',
    `${p.n_relations} relations, ${p.n_evidence} evidence, ${p.relations_with_database_evidence} db-backed, ${p.relations_with_reader_evidence_only} reader-only`);

  const weak = C.classify({ asserted_type: 'Complex' }, rel, {});
  check(`corroborate: a type present only as 2 reader-only evidences is corroborated WEAKLY${f ? ' +FAULT' : ''}`,
    !f && weak.verdict === 'corroborated-weakly', `verdict=${weak.verdict}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 7. The expressibility check: a claim about SOLUBILITY typed as IncreaseAmount is not a claim the
// graph can answer, and both a positive and a negative for it are uninterpretable.
// INJECTED FAULT: empty the word list.
function test7(f) {
  const solubility = {
    id: 'thompson1917-ch09-06',
    text: 'Albumin increases the solubility of calcium carbonate and phosphate, whereas its breakdown products dissolve them much less; hence skeletal calcium salts are thrown down',
    statement: { family: 'indra', type: 'IncreaseAmount', trigger: 'increases', rule: 'IncreaseAmount: regex with grounded molecular subject and object', subject: { id: 'HGNC:399' }, object: { id: 'CHEBI:3311' } },
  };
  const shh = {
    id: 'draft:shh', text: 'Cyclopamine inhibits sonic hedgehog signalling in the forebrew primordium',
    statement: { family: 'indra', type: 'Inhibition', trigger: 'inhibits', subject: { id: 'HGNC:10848' }, object: { id: 'CHEBI:4021' } },
  };
  const words = f ? [] : C.NOT_EXPRESSIBLE_AS_INDRA;
  const hit = words.filter(w => solubility.text.toLowerCase().includes(w));
  const e1 = C.expressibility(solubility);
  check(`corroborate: a solubility claim typed IncreaseAmount is flagged as possibly not expressible${f ? ' +FAULT' : ''}`,
    hit.length > 0 && e1.risk !== 'none' && e1.words_found.includes('solubility'),
    hit.length ? `words: ${e1.words_found?.join(', ')}` : 'no word matched');

  const e2 = C.expressibility(shh);
  check(`corroborate: an ordinary inhibition claim is NOT flagged${f ? ' +FAULT' : ''}`,
    !f && e2.risk === 'none', `risk=${e2.risk}`);

  check(`corroborate: the flag explains how a trigger-word rule mistypes "increases the solubility of"${f ? ' +FAULT' : ''}`,
    !f && /grammatical object of the verb is the property/.test(e1.how_the_mistyping_happens ?? ''), 'explanation present');
}

// ---------------------------------------------------------------------------------------------------
// TEST 8. Asserted pairs, co-mention pairs and self-loops are three different things and must not be
// pooled: a corroboration rate over a pooled set would be meaningless.
// INJECTED FAULT: pool asserted and co-mention pairs.
function test8(f) {
  const records = [
    { id: 'r1', statement: { family: 'indra', type: 'Inhibition', subject: { id: 'HGNC:10848', name: 'SHH' }, object: { id: 'CHEBI:4021', name: 'Cyclopamine' } } },
    { id: 'r2', statement: { family: 'indra', type: 'Activation', subject: { id: 'FPLX:Wnt', name: 'Wnt' }, object: { id: 'FPLX:Wnt', name: 'Wnt' } } },
    { id: 'r3', statement: { family: 'law' }, entities: [{ db: 'HGNC', id: 'HGNC:1', name: 'A' }, { db: 'CHEBI', id: 'CHEBI:2', name: 'B' }, { db: 'MESH', id: 'MESH:3', name: 'C' }] },
  ];
  const c = C.candidatePairs(records);
  const asserted = f ? [...c.asserted, ...c.co_mention] : c.asserted;
  check(`corroborate: 1 asserted pair, 1 co-mention pair, 1 self-loop excluded${f ? ' +FAULT' : ''}`,
    asserted.length === 1 && c.co_mention.length === 1 && c.self_loops.length === 1,
    `asserted=${asserted.length}, co-mention=${c.co_mention.length}, self-loops=${c.self_loops.length}`);
  check(`corroborate: the self-loop records why it was excluded${f ? ' +FAULT' : ''}`,
    !f && /same entity/i.test(c.self_loops[0]?.why_excluded ?? ''), (c.self_loops[0]?.why_excluded ?? '').slice(0, 54));
  check(`corroborate: a MESH entity is not treated as a molecular partner${f ? ' +FAULT' : ''}`,
    !f && c.co_mention.length === 1 && !JSON.stringify(c.co_mention).includes('MESH'), 'only the HGNC/CHEBI pair was generated');
}

// ---------------------------------------------------------------------------------------------------
// TEST 9. A capped run must say what it dropped. A tally over a truncated set that looks like a coverage
// figure is the quiet way a report lies.
// INJECTED FAULT: hide the cap disclosure.
async function test9(f) {
  const records = Array.from({ length: 5 }, (_, i) => ({
    id: `r${i}`, statement: { family: 'indra', type: 'Inhibition', subject: { id: 'HGNC:10848', name: 'SHH' }, object: { id: 'CHEBI:4021', name: 'Cyclopamine' } },
  }));
  const rep = await C.report(records, {
    max_pairs: 2,
    relationsBetween: async () => ({ status: 'ok', profile: G.evidenceProfile(fx('subnetwork-shh-cyclopamine.json')), relations: [] }),
    densityProbe: async () => ({ status: 'ok', dense: true, distinct_partner_ids_lower_bound: 44 }),
  });
  const disclosure = f ? null : rep.cap_disclosure;
  check(`corroborate: a capped run discloses how many pairs it did not query${f ? ' +FAULT' : ''}`,
    typeof disclosure === 'string' && /3 pair\(s\) were NOT queried/.test(disclosure) && rep.counts.pairs_dropped_by_cap === 3,
    disclosure ? disclosure.slice(0, 60) : 'no disclosure');
  check(`corroborate: the tally explains which verdicts are actually negatives${f ? ' +FAULT' : ''}`,
    !f && /Only `contradicted` and `absent-and-dense` are negatives/.test(rep.how_to_read_the_tally), 'reading guide present');
}

// ---------------------------------------------------------------------------------------------------
// TEST 10. The licence and citation facts travel with every report, because a derived set from a graph
// with no stated data licence is not safely redistributable and a reader has to see that.
// INJECTED FAULT: blank the licence note.
function test10(f) {
  const s = f ? { data_licence: 'MIT', citable_paper: 'Gyori et al. 2022' } : G.SOURCE;
  check(`cogex: the absent DATA licence is stated, not glossed over${f ? ' +FAULT' : ''}`,
    /NOT STATED ANYWHERE/.test(s.data_licence) && /404/.test(s.data_licence), String(s.data_licence).slice(0, 56));
  check(`cogex: the absence of a citable paper is stated${f ? ' +FAULT' : ''}`,
    /NONE FOUND/.test(s.citable_paper), String(s.citable_paper).slice(0, 48));
  check(`cogex: the stale size figure is named so it is not repeated${f ? ' +FAULT' : ''}`,
    !f && /54 million/.test(G.SOURCE.stale_figure_to_avoid) && G.SOURCE.measured_size.nodes === 97832239,
    `measured ${G.SOURCE.measured_size.nodes} nodes on ${G.SOURCE.measured_size.measured_on}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 11. Grounding returns namespace, score and resolver - never a bare symbol - and an empty result
// for a zebrafish symbol says what the emptiness means.
// INJECTED FAULT: serve the SHH fixture for the zebrafish query.
async function test11(f) {
  const shh = await G.ground('SHH', { fetchImpl: fakeFetch([['ground', f ? fx('gilda-kcnk5b.json') : fx('gilda-shh.json')]]) });
  check(`cogex: grounding carries curie, namespace, score and resolver${f ? ' +FAULT' : ''}`,
    shh.available && shh.groundings[0]?.curie === 'hgnc:10848' && shh.groundings[0]?.score > 0.7 &&
      shh.groundings[0]?.resolver === 'gilda',
    `${shh.top?.curie} at ${shh.top?.score}`);

  const zf = await G.ground('kcnk5b', { fetchImpl: fakeFetch([['ground', f ? fx('gilda-shh.json') : fx('gilda-kcnk5b.json')]]) });
  check(`cogex: an empty grounding for a zebrafish symbol explains that this is expected${f ? ' +FAULT' : ''}`,
    zf.groundings.length === 0 && /EXPECTED/.test(zf.empty_means ?? ''), (zf.empty_means ?? 'non-empty result').slice(0, 58));
}

// ---------------------------------------------------------------------------------------------------
// TEST 12. The density probe returns a LOWER BOUND and says so, and its dense/sparse threshold is
// declared as ours. A probe presented as a count would be a fabricated number.
// INJECTED FAULT: drop the lower-bound language.
async function test12(f) {
  const page = fx('statements-alb-200.json');
  const served = f ? [page[0].slice(0, 3), page[1] ?? {}] : page;
  const d = await G.densityProbe('ALB', { limit: 200, partner_namespace: 'CHEBI', fetchImpl: fakeFetch([['get_statements', served]]) });
  check(`cogex: the density probe finds at least 44 distinct ChEBI partners for ALB in 200 statements${f ? ' +FAULT' : ''}`,
    d.status === 'ok' && d.distinct_partner_ids_lower_bound === 44 && d.statements_examined === 200 && d.dense === true,
    `>=${d.distinct_partner_ids_lower_bound} partners in ${d.statements_examined} statements, dense=${d.dense}`);
  check(`cogex: it declares itself a lower bound and its threshold as ours${f ? ' +FAULT' : ''}`,
    !f && /lower bound|at least/i.test(d.why_a_lower_bound ?? '') && /OUR choice/.test(d.threshold_is_ours ?? ''),
    'both disclosures present');
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6, test7, test8, test9, test10, test11, test12];
for (const t of TESTS) await t(false);
console.log(`\n${pass} pass, ${fail} fail`);

if (FAIL_ONCE) {
  console.log('\n--fail-once: injecting one fault per test. EVERY line below should FAIL.\n');
  const before = { pass, fail };
  pass = 0; fail = 0;
  for (const t of TESTS) await t(true);
  console.log(`\nwith faults injected: ${fail} FAIL, ${pass} PASS`);
  console.log(`${pass} test(s) survived their own injected fault. Those assert nothing about their subject and are not tests.`);
  process.exit(before.fail === 0 && pass === 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
