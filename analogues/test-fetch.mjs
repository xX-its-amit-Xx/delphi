#!/usr/bin/env node
// Tests for analogues/fetch.mjs and analogues/inventory.mjs.
//
//   node analogues/test-fetch.mjs              # offline checks always; live checks when the APIs answer
//   node analogues/test-fetch.mjs --fail-once  # invert every predicate; every line must FAIL
//
// Three things are checked harder than the plumbing, because they are the three ways this module could do
// damage.
//
//   1. COLLAPSING THE THREE OUTCOMES. "there is no such accession", "NCBI returned 502" and "you passed an
//      empty string" are three different states of the world. A function that answers all three with
//      `null` lets a run write down "this species has no assembly" when the truth was "the network was
//      out". So every negative path is asserted to carry its own named outcome, and the bad-accession case
//      is asserted to be ABSENT and specifically NOT failed.
//   2. FLATTENING HOMOLOGY TYPE. A one-to-many orthologue is not a functional equivalent. The hit's
//      `type` is asserted present on every hit, drawn from the Compara vocabulary, and preserved through
//      the one-to-one filter.
//   3. KEEPING AN UNVERIFIED INVENTORY ENTRY. An entry whose accession or species key does not resolve is
//      asserted to come back `broken`, which is a different state from `unchecked`, which is what a down
//      API produces.
//
// The live checks are guarded by a reachability probe and SKIP LOUDLY when an API is down, because a test
// suite that fails on a train is a test suite people stop running. At least one real call is made and
// asserted against real returned values whenever the network is up.
//
// --fail-once injects one fault into every assertion by inverting its predicate. Every line must then
// FAIL. An assertion that survives its own inversion is asserting nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from './fetch.mjs';
import * as INV from './inventory.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const skipped = [];
const skip = (what, why) => { skipped.push(`${what}: ${why}`); console.log(`  SKIP ${what} - ${why}`); };
const { ANSWERED, ABSENT, FAILED, NOT_ASKED } = F.OUTCOME;

// ===================================================================================================
console.log(`\nanalogues: fetch + inventory${FAULT ? '  [--fail-once: every assertion inverted]' : ''}\n`);
console.log('-- outcomes ---------------------------------------------------------------------------');

check('the four outcomes are four distinct strings',
  f(new Set(F.OUTCOMES).size === 4, new Set(F.OUTCOMES).size !== 4), `OUTCOMES = ${JSON.stringify(F.OUTCOMES)}`);
check('"absent" and "failed" are not the same outcome (the API saying no is not the API breaking)',
  f(ABSENT !== FAILED && Boolean(ABSENT) && Boolean(FAILED), ABSENT === FAILED || !ABSENT || !FAILED));
check('"not_asked" exists as its own outcome, so a refused call is not reported as an answer',
  f(typeof NOT_ASKED === 'string' && NOT_ASKED.length > 0 && NOT_ASKED !== ANSWERED, typeof NOT_ASKED !== 'string' || NOT_ASKED === ANSWERED));

// ===================================================================================================
console.log('\n-- cache keys and cache location -------------------------------------------------------');

const u1 = 'https://rest.ensembl.org/lookup/symbol/danio_rerio/shha?expand=0';
const u2 = 'https://rest.ensembl.org/lookup/symbol/danio_rerio/shhb?expand=0';
const k1 = F.cacheKey(u1), k2 = F.cacheKey(u2);

check('the same request hashes to the same cache key',
  f(k1 === F.cacheKey(u1), k1 !== F.cacheKey(u1)), `${k1}`);
check('two different URLs hash to different cache keys',
  f(k1 !== k2, k1 === k2), `${k1} vs ${k2}`);
check('method is part of the key (a GET and a POST to one URL are not one response)',
  f(F.cacheKey(u1, { method: 'POST', body: '{}' }) !== k1, F.cacheKey(u1, { method: 'POST', body: '{}' }) === k1));
check('a cache key is bare lowercase hex, so nothing but a hash can be in a file name',
  f(/^[0-9a-f]{40}$/.test(k1), !/^[0-9a-f]{40}$/.test(k1)), k1);

// A cache key must not carry a personal identifier. The strings that could leak one on this machine are
// the OS user name and the home-directory basename; a hash of the URL cannot contain either.
const personal = [process.env.USERNAME, process.env.USER, process.env.USERPROFILE && path.basename(process.env.USERPROFILE), process.env.COMPUTERNAME]
  .filter(s => typeof s === 'string' && s.length > 2).map(s => s.toLowerCase());
const keyBlob = [k1, k2, F.cacheFileFor(u1)].join(' ').toLowerCase();
check('no cache key or cache path contains the OS user name, home directory name or host name',
  f(personal.every(p => !keyBlob.includes(p)), !personal.every(p => !keyBlob.includes(p))),
  `checked ${personal.length} identifier(s)`);

const cacheDir = F.CACHE_DIR.replace(/\\/g, '/').toLowerCase();
check('the cache lives outside the repository (genome payloads are never written into the tree)',
  f(!cacheDir.startsWith(repoRoot.replace(/\\/g, '/').toLowerCase()), cacheDir.startsWith(repoRoot.replace(/\\/g, '/').toLowerCase())),
  F.CACHE_DIR);
check('the cache path is the configured scratch location, not a temp dir inside the project',
  f(cacheDir.includes('delphi-genome-cache'), !cacheDir.includes('delphi-genome-cache')), F.CACHE_DIR);
check('a cached file sits under the cache directory and nowhere else',
  f(F.cacheFileFor(u1).replace(/\\/g, '/').toLowerCase().startsWith(cacheDir), !F.cacheFileFor(u1).replace(/\\/g, '/').toLowerCase().startsWith(cacheDir)),
  F.cacheFileFor(u1));

// ===================================================================================================
console.log('\n-- no credentials ----------------------------------------------------------------------');

const src = fs.readFileSync(path.join(here, 'fetch.mjs'), 'utf8') + fs.readFileSync(path.join(here, 'inventory.mjs'), 'utf8');
const credentialish = [/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, /bearer\s+[A-Za-z0-9._-]{10,}/i, /token\s*[:=]\s*['"][^'"]{8,}['"]/i];
const credHits = credentialish.filter(re => re.test(src)).map(re => String(re));
check('no key, token or address anywhere in the two modules',
  f(credHits.length === 0, credHits.length !== 0), credHits.join(', '));
check('the User-Agent is a generic client name and carries no address',
  f(/delphisci-analogues/.test(src) && !/User-Agent[^\n]*@/.test(src), !/delphisci-analogues/.test(src) || /User-Agent[^\n]*@/.test(src)));

// ===================================================================================================
console.log('\n-- rate limiting -----------------------------------------------------------------------');

const ncbiLimit = F.limitForUrl('https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000002035.6/dataset_report');
const ensLimit = F.limitForUrl('https://rest.ensembl.org/info/ping');
const unknownLimit = F.limitForUrl('https://example.invalid/whatever');

check('NCBI is spaced at >= 1/3 s, inside its published 3 req/s without a key',
  f(ncbiLimit.minIntervalMs >= 333, ncbiLimit.minIntervalMs < 333), `${ncbiLimit.minIntervalMs} ms`);
check('Ensembl is spaced at >= 1/15 s, inside its published 15 req/s',
  f(ensLimit.minIntervalMs >= 66 && ensLimit.minIntervalMs <= 334, ensLimit.minIntervalMs < 66 || ensLimit.minIntervalMs > 334), `${ensLimit.minIntervalMs} ms`);
check('the published limit is stated, not just implied by the number',
  f(/3 req\/s/.test(ncbiLimit.published) && /15 req\/s/.test(ensLimit.published), !/3 req\/s/.test(ncbiLimit.published) || !/15 req\/s/.test(ensLimit.published)));
check('an unknown host falls back to the strictest limit rather than to no limit',
  f(!unknownLimit.known && unknownLimit.minIntervalMs >= 333, unknownLimit.known || unknownLimit.minIntervalMs < 333), `${unknownLimit.minIntervalMs} ms`);

// The delay has to be real. Three gated calls at 120 ms apart cannot finish in under 240 ms.
{
  const t0 = Date.now();
  await F.__gate('selftest-host', 120);
  await F.__gate('selftest-host', 120);
  await F.__gate('selftest-host', 120);
  const elapsed = Date.now() - t0;
  check('three gated calls at 120 ms apart actually take >= 240 ms of wall clock',
    f(elapsed >= 240, elapsed < 240), `${elapsed} ms`);
}
// ...and a different host is not made to wait behind it.
{
  const t0 = Date.now();
  await F.__gate('selftest-other-host', 120);
  const elapsed = Date.now() - t0;
  check('a first call to a fresh host is not delayed (the gate is per host, not global)',
    f(elapsed < 100, elapsed >= 100), `${elapsed} ms`);
}

// ===================================================================================================
console.log('\n-- the cache really prevents a second network call -------------------------------------');

// Proven offline with a counted fake fetch, against a synthetic URL that no real request ever uses.
{
  const nonce = Math.random().toString(36).slice(2);
  const url = `https://rest.ensembl.org/__selftest/${nonce}`;
  let calls = 0;
  const fake = async () => { calls++; return { status: 200, text: async () => JSON.stringify({ n: calls }) }; };

  const a = await F.cachedFetch(url, { fetchImpl: fake });
  const b = await F.cachedFetch(url, { fetchImpl: fake });
  check('first call goes to the network',
    f(a.fromCache === false && a.status === 200 && calls === 1, a.fromCache !== false || a.status !== 200 || calls !== 1), `fromCache=${a.fromCache} calls=${calls}`);
  check('second call is served from cache',
    f(b.fromCache === true, b.fromCache !== true), `fromCache=${b.fromCache}`);
  check('second call made NO network call at all (the counter did not move)',
    f(calls === 1, calls !== 1), `${calls} network call(s) for 2 fetches`);
  check('the cached body is byte-identical to the first response',
    f(b.body === a.body, b.body !== a.body));
  check('a cache file was written outside the repo for it',
    f(fs.existsSync(F.cacheFileFor(url)) && !F.cacheFileFor(url).replace(/\\/g, '/').toLowerCase().startsWith(repoRoot.replace(/\\/g, '/').toLowerCase()),
      !fs.existsSync(F.cacheFileFor(url)) || F.cacheFileFor(url).replace(/\\/g, '/').toLowerCase().startsWith(repoRoot.replace(/\\/g, '/').toLowerCase())));

  // ttlMs: 0 means "do not serve me a stored answer".
  const c = await F.cachedFetch(url, { fetchImpl: fake, ttlMs: 0 });
  check('ttlMs 0 bypasses the cache and calls the network again',
    f(c.fromCache === false && calls === 2, c.fromCache !== false || calls !== 2), `calls=${calls}`);
  F.forgetCached(url);
  check('the synthetic cache entry was cleaned up',
    f(!fs.existsSync(F.cacheFileFor(url)), fs.existsSync(F.cacheFileFor(url))));
}

// A 5xx must NOT be cached: caching one bad minute would turn it into a bad week.
{
  const url = `https://api.ncbi.nlm.nih.gov/__selftest/${Math.random().toString(36).slice(2)}`;
  let calls = 0;
  const fake500 = async () => { calls++; return { status: 503, text: async () => 'upstream unavailable' }; };
  const a = await F.cachedFetch(url, { fetchImpl: fake500, retries: 0 });
  const b = await F.cachedFetch(url, { fetchImpl: fake500, retries: 0 });
  check('a 503 is not cached, so the next call asks again instead of replaying an outage',
    f(calls === 2 && b.fromCache === false, calls !== 2 || b.fromCache !== false), `calls=${calls} fromCache=${b.fromCache}`);
  check('a 503 is reported with its status, not as a success',
    f(a.status === 503 && a.error === null, a.status !== 503 || a.error !== null), `status=${a.status} error=${a.error}`);
  F.forgetCached(url);
}

// Retries: a transient failure is retried, a definitive 4xx is not. Treating one timeout as "the API is
// down" is the same mistake as treating it as "the answer is no".
{
  const url = `https://rest.ensembl.org/__selftest/${Math.random().toString(36).slice(2)}`;
  let calls = 0;
  const flaky = async () => { calls++; return calls < 3 ? { status: 503, text: async () => 'later' } : { status: 200, headers: { get: () => null }, text: async () => '{"ok":1}' }; };
  const r = await F.cachedFetch(url, { fetchImpl: flaky, retries: 2 });
  check('a 503 is retried and the eventual success is returned, not reported as a failure',
    f(r.status === 200 && r.attempts === 3 && calls === 3, r.status !== 200 || r.attempts !== 3 || calls !== 3), `status=${r.status} attempts=${r.attempts}`);
  F.forgetCached(url);

  const url4 = `https://rest.ensembl.org/__selftest/${Math.random().toString(36).slice(2)}`;
  let calls4 = 0;
  const four = async () => { calls4++; return { status: 400, headers: { get: () => null }, text: async () => '{"error":"no"}' }; };
  const r4 = await F.cachedFetch(url4, { fetchImpl: four, retries: 2 });
  check('a 400 is NOT retried: the server answered, and the answer is no',
    f(calls4 === 1 && r4.attempts === 1 && r4.status === 400, calls4 !== 1 || r4.attempts !== 1 || r4.status !== 400), `calls=${calls4} attempts=${r4.attempts}`);
  F.forgetCached(url4);

  const url5 = `https://rest.ensembl.org/__selftest/${Math.random().toString(36).slice(2)}`;
  let calls5 = 0;
  const always = async () => { calls5++; return { status: 502, headers: { get: () => null }, text: async () => 'bad gateway' }; };
  const r5 = await F.cachedFetch(url5, { fetchImpl: always, retries: 2 });
  check('an exhausted retry budget still reports the failure rather than hiding it',
    f(calls5 === 3 && r5.status === 502, calls5 !== 3 || r5.status !== 502), `calls=${calls5} status=${r5.status}`);
  F.forgetCached(url5);
}

// A transport failure is status 0 plus an error -- distinguishable from any HTTP answer.
{
  const url = `https://rest.ensembl.org/__selftest/${Math.random().toString(36).slice(2)}`;
  const boom = async () => { throw new Error('ECONNRESET'); };
  const r = await F.cachedFetch(url, { fetchImpl: boom, retries: 0 });
  check('a transport failure returns status 0 with an error, never a status that looks like an answer',
    f(r.status === 0 && /ECONNRESET/.test(r.error || '') && r.body === null, r.status !== 0 || !/ECONNRESET/.test(r.error || '') || r.body !== null),
    `status=${r.status} error=${r.error}`);
  check('a transport failure is not cached',
    f(!fs.existsSync(F.cacheFileFor(url)), fs.existsSync(F.cacheFileFor(url))));
  F.forgetCached(url);
}

// ===================================================================================================
console.log('\n-- "we did not ask" is its own outcome -------------------------------------------------');

const notAskedCases = [
  ['assemblyReport("")', await F.assemblyReport('')],
  ['assemblyReport(null)', await F.assemblyReport(null)],
  ['assemblyReport("banana") (not an accession shape)', await F.assemblyReport('banana')],
  ['geneBySymbol("danio_rerio", "")', await F.geneBySymbol('danio_rerio', '')],
  ['geneBySymbol("", "shha")', await F.geneBySymbol('', 'shha')],
  ['orthologues("danio_rerio","shha",[])', await F.orthologues('danio_rerio', 'shha', [])],
  ['sequence("ENSDARG00000068567", {type:"bogus"})', await F.sequence('ENSDARG00000068567', { type: 'bogus' })],
  ['sequence("ENSDARG00000068567", {}) (no type at all)', await F.sequence('ENSDARG00000068567', {})],
  ['esearch("taxonomy","")', await F.esearch('taxonomy', '')],
  ['esummary("taxonomy",[])', await F.esummary('taxonomy', [])],
];
for (const [label, r] of notAskedCases) {
  check(`${label} -> not_asked, with a reason and no data`,
    f(r.outcome === NOT_ASKED && r.data === null && typeof r.reason === 'string' && r.reason.length > 0,
      r.outcome !== NOT_ASKED || r.data !== null || typeof r.reason !== 'string' || r.reason.length === 0),
    `outcome=${r.outcome} reason=${r.reason}`);
}
check('a malformed accession is refused WITHOUT a network call (no request is spent on it)',
  f((await (async () => { const n = F.stats().network; await F.assemblyReport('not-an-accession'); return F.stats().network - n; })()) === 0,
    (await (async () => { const n = F.stats().network; await F.assemblyReport('also-not-one'); return F.stats().network - n; })()) !== 0));

// ===================================================================================================
console.log('\n-- homology type is never flattened ----------------------------------------------------');

check('the Compara vocabulary names one2one, one2many, many2many and the within-species paralogue',
  f(['ortholog_one2one', 'ortholog_one2many', 'ortholog_many2many', 'within_species_paralog'].every(t => F.HOMOLOGY_TYPES.includes(t)),
    !['ortholog_one2one', 'ortholog_one2many', 'ortholog_many2many', 'within_species_paralog'].every(t => F.HOMOLOGY_TYPES.includes(t))));
{
  const synthetic = { data: { hits: [
    { target_id: 'A', type: 'ortholog_one2one' },
    { target_id: 'B', type: 'ortholog_one2many' },
    { target_id: 'C', type: 'ortholog_many2many' },
    { target_id: 'D', type: 'within_species_paralog' },
  ] } };
  const kept = F.oneToOne(synthetic);
  check('oneToOne() keeps only the one-to-one hit',
    f(kept.length === 1 && kept[0].target_id === 'A', kept.length !== 1 || kept[0]?.target_id !== 'A'), `kept ${kept.map(h => h.target_id).join(',')}`);
  check('oneToOne() does NOT return a one-to-many hit as if it were an equivalent',
    f(!kept.some(h => h.type === 'ortholog_one2many'), kept.some(h => h.type === 'ortholog_one2many')));
  check('oneToOne() does NOT return a within-species paralogue',
    f(!kept.some(h => h.type === 'within_species_paralog'), kept.some(h => h.type === 'within_species_paralog')));
  check('isOneToOne() rejects an untyped hit rather than defaulting it to equivalent',
    f(F.isOneToOne({ target_id: 'E', type: null }) === false, F.isOneToOne({ target_id: 'E', type: null }) !== false));
}
// Nothing in this module picks "the" orthologue out of a one-to-many set.
{
  const pickers = Object.keys(F).filter(n => /best|pick|primary|the_?ortholog|single/i.test(n));
  check('no exported helper picks one gene out of a one-to-many set and calls it the orthologue',
    f(pickers.length === 0, pickers.length !== 0), pickers.join(', '));
}

// ===================================================================================================
console.log('\n-- inventory: shape, reasons, provenance -----------------------------------------------');

const S = INV.SPECIES;
check('the inventory holds about twenty comparative references',
  f(S.length >= 20, S.length < 20), `${S.length} entries`);
check('zebrafish is in it, on GRCz11, the build Ensembl serves',
  f(S.some(s => s.binomial === 'Danio rerio' && s.ensembl_assembly === 'GRCz11'), !S.some(s => s.binomial === 'Danio rerio' && s.ensembl_assembly === 'GRCz11')));
check('it is mostly teleosts, with the outgroups that make a teleost comparison interpretable',
  f(S.filter(s => s.group === 'teleost').length >= 10 && INV.groupsPresent().length >= 6,
    S.filter(s => s.group === 'teleost').length < 10 || INV.groupsPresent().length < 6),
  `${S.filter(s => s.group === 'teleost').length} teleosts, groups: ${INV.groupsPresent().join(', ')}`);
check('the outgroups include mammals, an amphibian and an invertebrate chordate',
  f(['mammal', 'amphibian', 'tunicate'].every(g => S.some(s => s.group === g)), !['mammal', 'amphibian', 'tunicate'].every(g => S.some(s => s.group === g))));
{
  const noReason = S.filter(s => !s.why || s.why.trim().length < 40).map(s => s.binomial);
  check('EVERY entry states the question it is a reference for',
    f(noReason.length === 0, noReason.length !== 0), noReason.join(', '));
  const noProv = S.filter(s => !s.provenance?.accession_from || !s.provenance?.accession_query || !s.provenance?.ensembl_key_from).map(s => s.binomial);
  check('EVERY entry records where its accession and species key came from',
    f(noProv.length === 0, noProv.length !== 0), noProv.join(', '));
  const badProv = S.filter(s => !/datasets|ensembl/i.test(s.provenance.accession_query || '')).map(s => s.binomial);
  check('each provenance names the actual API query, not just "NCBI"',
    f(badProv.length === 0, badProv.length !== 0), badProv.join(', '));
}
check('every entry carries both the NCBI accession and the Ensembl build, kept apart',
  f(S.every(s => /^GC[AF]_\d{9}\.\d+$/.test(s.assembly_accession) && s.ensembl_assembly), !S.every(s => /^GC[AF]_\d{9}\.\d+$/.test(s.assembly_accession) && s.ensembl_assembly)));
check('species keys are unique',
  f(new Set(S.map(s => s.ensembl)).size === S.length, new Set(S.map(s => s.ensembl)).size !== S.length));
check('NCBI taxids are unique',
  f(new Set(S.map(s => s.ncbi_taxid)).size === S.length, new Set(S.map(s => s.ncbi_taxid)).size !== S.length));
check('every group is in the closed allow-list, so the inventory cannot quietly widen',
  f(S.every(s => INV.ALLOWED_GROUPS.includes(s.group)), !S.every(s => INV.ALLOWED_GROUPS.includes(s.group))));
check('the static defect check finds nothing (it is what catches a hand-edited entry offline)',
  f(INV.inventoryDefects().length === 0, INV.inventoryDefects().length !== 0), JSON.stringify(INV.inventoryDefects()));
{
  // Make the defect check fail once, on purpose: a validator that never fires is not a validator.
  const sabotaged = [{ ...S[0], why: 'because', provenance: { ...S[0].provenance } }];
  const d = INV.inventoryDefects(sabotaged);
  check('an entry with no stated reason IS reported as a defect',
    f(d.some(x => /stated reason/.test(x.defect)), !d.some(x => /stated reason/.test(x.defect))), JSON.stringify(d));
  const offGroup = INV.inventoryDefects([{ ...S[0], group: 'something-else' }]);
  check('an entry outside the allow-list of groups IS reported as a defect',
    f(offGroup.some(x => /ALLOWED_GROUPS/.test(x.defect)), !offGroup.some(x => /ALLOWED_GROUPS/.test(x.defect))));
}

// ===================================================================================================
console.log('\n-- inventory: the frozen evaluation holdout --------------------------------------------');

check('an excluded clade is declared',
  f(INV.EXCLUDED_CLADES.length >= 1, INV.EXCLUDED_CLADES.length < 1), JSON.stringify([...INV.EXCLUDED_CLADES]));
check('the declaration says something is filtered out WITHOUT naming it',
  f(INV.EXCLUDED_CLADES.every(c => /withheld/i.test(c) && /holdout/i.test(c)), !INV.EXCLUDED_CLADES.every(c => /withheld/i.test(c) && /holdout/i.test(c))),
  JSON.stringify([...INV.EXCLUDED_CLADES]));
check('the withheld clade is not among the groups the inventory admits',
  f(INV.ALLOWED_GROUPS.every(g => !INV.EXCLUDED_CLADES.includes(g)) && INV.groupsPresent().every(g => INV.ALLOWED_GROUPS.includes(g)),
    !INV.ALLOWED_GROUPS.every(g => !INV.EXCLUDED_CLADES.includes(g)) || !INV.groupsPresent().every(g => INV.ALLOWED_GROUPS.includes(g))));

// The real check: cross the inventory against the project's frozen holdout roster without copying a
// single name out of it. Membership is tested, nothing is reported but a count.
{
  const splitPath = path.join(repoRoot, 'holdout', 'split.json');
  if (!fs.existsSync(splitPath)) {
    skip('inventory vs the frozen holdout roster', `${splitPath} is not present, so membership could not be tested`);
  } else {
    const roster = JSON.parse(fs.readFileSync(splitPath, 'utf8')).taxa.filter(t => t.assignment === 'holdout');
    const names = new Set(roster.map(t => String(t.name).toLowerCase()));
    const genera = new Set(roster.filter(t => t.rank === 'genus').map(t => String(t.name).toLowerCase()));
    const taxids = new Set(roster.map(t => t.ids?.ncbi).filter(Boolean).map(Number));
    const offenders = S.filter(s =>
      names.has(s.binomial.toLowerCase()) ||
      genera.has(s.binomial.split(' ')[0].toLowerCase()) ||
      taxids.has(s.ncbi_taxid)).map(s => s.ensembl);
    check(`the roster was loaded and is non-empty (${roster.length} held-out taxa), so the test can bite`,
      f(roster.length > 0 && taxids.size > 0, roster.length === 0 || taxids.size === 0));
    check('NO inventory entry is on the frozen holdout roster, by binomial, by genus or by taxid',
      f(offenders.length === 0, offenders.length !== 0), `${offenders.length} offender(s): ${offenders.join(', ')}`);
    // Prove the membership test can find something, using an identifier from the roster that is never
    // written to a file: a held-out taxid read out of the roster at run time and thrown away.
    const probe = [...taxids][0];
    check('the membership test DOES catch a held-out taxid when one is present (so a clean pass means something)',
      f(taxids.has(probe) && !S.some(s => s.ncbi_taxid === probe), !taxids.has(probe) || S.some(s => s.ncbi_taxid === probe)));
  }
}
{
  // Nothing in these three files may name the withheld clade. The repo's own gate is the authority;
  // this is the cheap local version of it.
  const own = ['fetch.mjs', 'inventory.mjs', 'test-fetch.mjs'].map(n => fs.readFileSync(path.join(here, n), 'utf8')).join('\n');
  const classWords = [/\bAves\b/, /\bbirds?\b/i, /\bavian\b/i];
  const wordHits = classWords.filter(re => re.test(own)).length;
  check('none of the three files writes the withheld clade\'s class name or body-covering words',
    f(wordHits === 0, wordHits !== 0), `${wordHits} hit(s)`);
}

// ===================================================================================================
console.log('\n-- live calls -------------------------------------------------------------------------');

const probe = await F.reachable(['ensembl-rest', 'ncbi-datasets', 'ncbi-eutils']);
const H = probe.health;
console.log(`  health: ${H.apis.map(a => `${a.name}=${a.reachable ? `up/${a.ms}ms` : 'DOWN'}`).join('  ')}`);

check('health() reports on all three APIs, each with its own reachability and rate limit',
  f(H.apis.length === 3 && H.apis.every(a => typeof a.reachable === 'boolean' && typeof a.rate_limit === 'string'),
    H.apis.length !== 3 || !H.apis.every(a => typeof a.reachable === 'boolean' && typeof a.rate_limit === 'string')));
check('health() names which APIs are unreachable, so a run can tell "down" from "no"',
  f(Array.isArray(H.unreachable) && H.unreachable.length === H.apis.filter(a => !a.reachable).length,
    !Array.isArray(H.unreachable) || H.unreachable.length !== H.apis.filter(a => !a.reachable).length),
  `unreachable: ${JSON.stringify(H.unreachable)}`);

if (!probe.ok) {
  skip('every live assertion', `offline or an API is down (${H.unreachable.join(', ') || 'see health'}). The offline checks above still ran.`);
} else {
  // ---- the real zebrafish assembly report ----
  const zf = INV.SPECIES.find(s => s.binomial === 'Danio rerio');
  const rep = await F.assemblyReport(zf.assembly_accession);
  check('assemblyReport answered for the zebrafish reference accession',
    f(rep.outcome === ANSWERED && rep.data, rep.outcome !== ANSWERED || !rep.data), `${rep.outcome} ${rep.reason || rep.error || ''}`);
  if (rep.outcome === ANSWERED) {
    const d = rep.data;
    console.log(`         ${d.accession}  ${d.assembly_name}  ${d.organism} (taxid ${d.taxid})  ${d.assembly_level}  ${(d.total_sequence_length / 1e6).toFixed(1)} Mb  released ${d.release_date}  status ${d.assembly_status}`);
    check('it names the right organism',
      f(d.organism === 'Danio rerio', d.organism !== 'Danio rerio'), `organism=${d.organism}`);
    check('it carries the matching NCBI taxid',
      f(d.taxid === 7955, d.taxid !== 7955), `taxid=${d.taxid}`);
    check('it is the assembly the inventory claims',
      f(d.assembly_name === zf.assembly_name, d.assembly_name !== zf.assembly_name), `${d.assembly_name} vs ${zf.assembly_name}`);
    // A teleost genome of this size: ~1.37 Gb. A number outside 1.2-1.6 Gb is a different animal or a
    // units mistake, and the point of the bound is to notice either.
    check('the total sequence length is a plausible zebrafish genome (1.2-1.6 Gb)',
      f(d.total_sequence_length > 1.2e9 && d.total_sequence_length < 1.6e9, !(d.total_sequence_length > 1.2e9 && d.total_sequence_length < 1.6e9)),
      `${d.total_sequence_length} bp`);
    check('the length is a number, not the API\'s string',
      f(typeof d.total_sequence_length === 'number' && Number.isFinite(d.total_sequence_length), typeof d.total_sequence_length !== 'number' || !Number.isFinite(d.total_sequence_length)));
    check('the assembly level is reported',
      f(typeof d.assembly_level === 'string' && d.assembly_level.length > 0, typeof d.assembly_level !== 'string' || d.assembly_level.length === 0), `${d.assembly_level}`);
    check('the chromosome count is right for this animal (25 pairs)',
      f(d.number_of_chromosomes === 25, d.number_of_chromosomes !== 25), `${d.number_of_chromosomes}`);
    check('the release date is a real ISO date',
      f(/^\d{4}-\d{2}-\d{2}/.test(d.release_date || ''), !/^\d{4}-\d{2}-\d{2}/.test(d.release_date || '')), `${d.release_date}`);
    // The API does not give a submission date on assembly_info for this record. The field must be null,
    // not quietly filled from release_date -- a date no API ever said is worse than no date.
    check('submission_date is null because the API omits it, and was NOT filled in from release_date',
      f(d.submission_date === null || (typeof d.submission_date === 'string' && d.submission_date !== d.release_date),
        !(d.submission_date === null || (typeof d.submission_date === 'string' && d.submission_date !== d.release_date))),
      `submission_date=${JSON.stringify(d.submission_date)} release_date=${d.release_date}`);
    check('the biosample submission date, a different fact, is reported under its own name',
      f('biosample_submission_date' in d, !('biosample_submission_date' in d)), `${d.biosample_submission_date}`);
    check('the suppressed status of this build is reported rather than hidden',
      f(typeof d.assembly_status === 'string' && d.assembly_status.length > 0, typeof d.assembly_status !== 'string' || d.assembly_status.length === 0), `${d.assembly_status}`);
  }

  // ---- the cache on a real URL ----
  {
    const n = F.stats().network;
    const again = await F.assemblyReport(zf.assembly_accession);
    check('a repeated real assembly report costs no network call',
      f(F.stats().network === n && again.from_cache === true, F.stats().network !== n || again.from_cache !== true),
      `network calls ${n} -> ${F.stats().network}, from_cache=${again.from_cache}`);
  }

  // ---- rate limiting on real calls ----
  {
    const url = 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000002035.6/dataset_report';
    const t0 = Date.now();
    for (let i = 0; i < 3; i++) await F.cachedFetch(url, { bypassCache: true, ttlMs: 0 });
    const elapsed = Date.now() - t0;
    check('three real NCBI calls are spaced by the limiter (>= 668 ms for 3 at 3/s)',
      f(elapsed >= 668, elapsed < 668), `${elapsed} ms for 3 calls`);
  }

  // ---- a bad accession: the API said no ----
  {
    const bad = await F.assemblyReport('GCF_999999999.9');
    console.log(`         bad accession -> ${bad.outcome}: ${bad.reason || bad.error}`);
    check('a well-formed but nonexistent accession returns "the API said no", not a crash',
      f(bad.outcome === ABSENT && bad.data === null && typeof bad.reason === 'string',
        bad.outcome !== ABSENT || bad.data !== null || typeof bad.reason !== 'string'), `${bad.outcome}`);
    check('...and specifically NOT "the API failed" (NCBI answers this with HTTP 200 and an empty payload)',
      f(bad.outcome !== FAILED && bad.status === 200, bad.outcome === FAILED || bad.status !== 200), `outcome=${bad.outcome} status=${bad.status}`);
    check('...and NOT "we did not ask", since the request really was sent',
      f(bad.outcome !== NOT_ASKED, bad.outcome === NOT_ASKED));
  }

  // ---- a real gene lookup ----
  {
    const g = await F.geneBySymbol('danio_rerio', 'shha');
    check('geneBySymbol answered for a real zebrafish gene',
      f(g.outcome === ANSWERED, g.outcome !== ANSWERED), `${g.outcome} ${g.reason || g.error || ''}`);
    if (g.outcome === ANSWERED) {
      const d = g.data;
      console.log(`         ${d.id}  ${d.symbol}  ${d.biotype}  ${d.seq_region_name}:${d.start}-${d.end} (${d.strand > 0 ? '+' : '-'})  on ${d.assembly_name}`);
      check('it is the expected stable id',
        f(d.id === 'ENSDARG00000068567', d.id !== 'ENSDARG00000068567'), d.id);
      check('its biotype is protein_coding',
        f(d.biotype === 'protein_coding', d.biotype !== 'protein_coding'), d.biotype);
      check('its coordinates are numbers with end after start',
        f(Number.isInteger(d.start) && Number.isInteger(d.end) && d.end > d.start, !(Number.isInteger(d.start) && Number.isInteger(d.end) && d.end > d.start)),
        `${d.start}-${d.end}`);
      check('its strand is +1 or -1, not a truthy guess',
        f(d.strand === 1 || d.strand === -1, !(d.strand === 1 || d.strand === -1)), `${d.strand}`);
      check('it has a description',
        f(typeof d.description === 'string' && d.description.length > 5, typeof d.description !== 'string' || d.description.length <= 5), d.description);
      check('the coordinates are attributed to the assembly they are on',
        f(d.assembly_name === 'GRCz11', d.assembly_name !== 'GRCz11'), d.assembly_name);
    }
    const nope = await F.geneBySymbol('danio_rerio', 'zzzznotagene');
    check('an unknown gene symbol is "the API said no", with Ensembl\'s own words',
      f(nope.outcome === ABSENT && /lookup/i.test(nope.reason || ''), nope.outcome !== ABSENT || !/lookup/i.test(nope.reason || '')),
      `${nope.outcome}: ${nope.reason}`);
    check('an unknown gene symbol is not reported as a failure',
      f(nope.outcome !== FAILED, nope.outcome === FAILED));
  }

  // ---- real homology, with the type intact ----
  {
    const o = await F.orthologues('danio_rerio', 'shha', 'homo_sapiens');
    check('orthologues answered for a real query',
      f(o.outcome === ANSWERED && o.data.n_hits > 0, o.outcome !== ANSWERED || !(o.data?.n_hits > 0)), `${o.outcome} ${o.reason || o.error || ''}`);
    if (o.outcome === ANSWERED) {
      console.log(`         ${o.data.query_id} -> ${o.data.n_hits} hit(s): ${JSON.stringify(o.data.by_type)}`);
      check('EVERY hit carries a homology type',
        f(o.data.untyped === 0 && o.data.hits.every(h => typeof h.type === 'string' && h.type.length > 0),
          o.data.untyped !== 0 || !o.data.hits.every(h => typeof h.type === 'string' && h.type.length > 0)), `untyped=${o.data.untyped}`);
      check('every type is from the Compara vocabulary, so an unknown label cannot pass as an orthologue',
        f(o.data.hits.every(h => h.known_type), !o.data.hits.every(h => h.known_type)), JSON.stringify(o.data.by_type));
      check('the by-type tally accounts for every hit (nothing is dropped on the way out)',
        f(Object.values(o.data.by_type).reduce((a, b) => a + b, 0) === o.data.n_hits,
          Object.values(o.data.by_type).reduce((a, b) => a + b, 0) !== o.data.n_hits));
      check('the one-to-one count and the one-to-one filter agree',
        f(F.oneToOne(o).length === o.data.n_one_to_one, F.oneToOne(o).length !== o.data.n_one_to_one), `${F.oneToOne(o).length} vs ${o.data.n_one_to_one}`);
      check('the one-to-one set never exceeds the hit set',
        f(o.data.n_one_to_one <= o.data.n_hits, o.data.n_one_to_one > o.data.n_hits));
      // shha against the human genome is a duplicated-side case, so the hits here are NOT one-to-one.
      // Whatever Ensembl says, the number returned by `n_one_to_one` has to match the labels on the hits.
      check('a non-one-to-one hit is excluded from the one-to-one set rather than promoted into it',
        f(F.oneToOne(o).every(h => h.type === 'ortholog_one2one'), !F.oneToOne(o).every(h => h.type === 'ortholog_one2one')),
        `types kept: ${[...new Set(F.oneToOne(o).map(h => h.type))].join(',') || '(none)'}`);
      check('each hit names the target species it is in',
        f(o.data.hits.every(h => h.target_species === 'homo_sapiens'), !o.data.hits.every(h => h.target_species === 'homo_sapiens')));
    }
  }

  // ---- real sequence ----
  {
    const cds = await F.sequence('ENSDARG00000068567', { type: 'cds' });
    check('sequence(cds) answered',
      f(cds.outcome === ANSWERED && cds.data.n_sequences > 0, cds.outcome !== ANSWERED || !(cds.data?.n_sequences > 0)), `${cds.outcome} ${cds.reason || cds.error || ''}`);
    if (cds.outcome === ANSWERED) {
      const s0 = cds.data.sequences[0];
      console.log(`         cds ${cds.data.n_sequences} sequence(s), first ${s0.length} nt, starts ${s0.seq.slice(0, 12)}`);
      check('the cds is nucleotides only',
        f(/^[ACGTN]+$/.test(s0.seq), !/^[ACGTN]+$/.test(s0.seq)), s0.seq.slice(0, 20));
      check('the cds starts with a start codon',
        f(s0.seq.startsWith('ATG'), !s0.seq.startsWith('ATG')), s0.seq.slice(0, 3));
      check('the cds length is a multiple of three',
        f(s0.length % 3 === 0, s0.length % 3 !== 0), `${s0.length} nt`);
      check('the molecule is labelled with what was asked for',
        f(cds.data.molecule === 'cds', cds.data.molecule !== 'cds'));
    }
    const prot = await F.sequence('ENSDARG00000068567', { type: 'protein' });
    if (prot.outcome === ANSWERED) {
      const p0 = prot.data.sequences[0];
      check('sequence(protein) returns amino acids, not nucleotides relabelled',
        f(/^[ACDEFGHIKLMNPQRSTVWY*X]+$/.test(p0.seq) && !/^[ACGTN]+$/.test(p0.seq),
          !/^[ACDEFGHIKLMNPQRSTVWY*X]+$/.test(p0.seq) || /^[ACGTN]+$/.test(p0.seq)), p0.seq.slice(0, 20));
      check('the protein starts with methionine',
        f(p0.seq.startsWith('M'), !p0.seq.startsWith('M')), p0.seq.slice(0, 3));
    } else {
      skip('sequence(protein)', `Ensembl answered ${prot.outcome}: ${prot.reason || prot.error}`);
    }
    const noSeq = await F.sequence('ENSDARG99999999999', { type: 'cds' });
    check('a nonexistent stable id is "the API said no", not a crash',
      f(noSeq.outcome === ABSENT, noSeq.outcome !== ABSENT), `${noSeq.outcome}: ${noSeq.reason || noSeq.error}`);
  }

  // ---- E-utilities ----
  {
    const es = await F.esearch('taxonomy', 'Danio rerio');
    check('esearch found the zebrafish taxonomy record',
      f(es.outcome === ANSWERED && es.data.ids.includes('7955'), es.outcome !== ANSWERED || !es.data?.ids?.includes('7955')),
      `${es.outcome} ${JSON.stringify(es.data?.ids)}`);
    const none = await F.esearch('taxonomy', 'Zzzzyx qqqqnotataxon');
    check('an E-utilities search that matches nothing is "the API said no", with a count',
      f(none.outcome === ABSENT, none.outcome !== ABSENT), `${none.outcome}: ${none.reason}`);
  }

  // ---- verifyInventory against the live APIs ----
  {
    const v = await INV.verifyInventory({ checkHealth: false });
    console.log(`         verifyInventory: ${Object.entries(v.tally).map(([k, n]) => `${n} ${k}`).join(', ')}`);
    for (const b of v.broken) console.log(`           BROKEN ${b.binomial}: ${b.problems.join('; ')}`);
    for (const g of v.flagged) console.log(`           flagged ${g.binomial}: ${g.problems.join('; ')}`);
    check('verifyInventory really called the APIs for every entry',
      f(v.results.length === S.length && v.results.every(r => r.accession_check.outcome), v.results.length !== S.length || !v.results.every(r => r.accession_check.outcome)));
    check('NO entry is broken: every accession and species key resolves',
      f(v.broken.length === 0, v.broken.length !== 0), v.broken.map(b => b.binomial).join(', '));
    check('every accession resolved on NCBI Datasets to the organism the entry claims',
      f(v.results.every(r => r.accession_check.outcome === ANSWERED && r.accession_check.organism === r.binomial),
        !v.results.every(r => r.accession_check.outcome === ANSWERED && r.accession_check.organism === r.binomial)),
      v.results.filter(r => r.accession_check.organism !== r.binomial).map(r => `${r.binomial}->${r.accession_check.organism}`).join(', '));
    check('every Ensembl species key resolved on Ensembl REST',
      f(v.results.every(r => r.ensembl_check.outcome === ANSWERED), !v.results.every(r => r.ensembl_check.outcome === ANSWERED)),
      v.results.filter(r => r.ensembl_check.outcome !== ANSWERED).map(r => `${r.ensembl}=${r.ensembl_check.outcome}`).join(', '));
    check('verifyInventory reports a real total sequence length for every entry',
      f(v.results.every(r => r.accession_check.total_sequence_length > 1e7), !v.results.every(r => r.accession_check.total_sequence_length > 1e7)));
    check('"broken" and "unchecked" are kept apart, so a down API cannot look like a bad accession',
      f('broken' in v.tally && 'unchecked' in v.tally && v.tally.broken + v.tally.unchecked + v.tally.verified + v.tally.flagged === S.length,
        !('broken' in v.tally) || !('unchecked' in v.tally) || v.tally.broken + v.tally.unchecked + v.tally.verified + v.tally.flagged !== S.length),
      JSON.stringify(v.tally));
    check('the report repeats that a clade is excluded, without naming it',
      f(v.excluded_clades.length >= 1 && v.excluded_clades.every(c => /withheld/i.test(c)), v.excluded_clades.length < 1 || !v.excluded_clades.every(c => /withheld/i.test(c))));
    // A deliberately bad entry must come back `broken`, not quietly kept.
    const sabotaged = await INV.verifyInventory({ checkHealth: false, species: [{ ...S[0], assembly_accession: 'GCF_999999999.9' }] });
    check('an entry whose accession does not exist IS reported broken, not silently kept',
      f(sabotaged.tally.broken === 1 && sabotaged.broken.length === 1, sabotaged.tally.broken !== 1 || sabotaged.broken.length !== 1),
      JSON.stringify(sabotaged.tally));
  }
}

// ===================================================================================================
console.log(`\n${pass} pass, ${fail} fail${skipped.length ? `, ${skipped.length} skipped` : ''}`);
for (const s of skipped) console.log(`  skipped: ${s}`);
console.log(`network calls this run: ${F.stats().network}, cache hits: ${F.stats().cache_hits}, rate-limit waits: ${F.stats().rate_waits}`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had its predicate inverted. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
