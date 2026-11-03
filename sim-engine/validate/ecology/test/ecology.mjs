#!/usr/bin/env node
// node sim-engine/validate/ecology/test/ecology.mjs
//
// The ecology layer. Runs OFFLINE, from the cache the use-case runs filled, so it neither depends on two
// public APIs being up nor hits them on every test run. A cache miss is a failed assertion with a clear
// reason, not a silently skipped test.
//
// Most of these assert the line the layer will not cross: it assembles the ingredients of "could this live
// here" from real records and refuses to finish the sum, because neither GBIF nor GloBI contains a single
// population parameter and a model built by inventing them would be a model of its author's expectations.
import assert from 'node:assert/strict';
import { ecologyCheck, setOffline } from '../index.mjs';

let pass = 0, fail = 0;
async function ok(name, fn) {
  try { await fn(); pass++; console.log('  ok    ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n          ' + String(e.message).split('\n').join('\n          ')); }
}
setOffline(true);
const SRC = s => ({ source: s });
const BOSTON = { name: 'Greater Boston', bbox: [42.3, 42.4, -71.2, -71.0], source: 'test fixture' };

console.log('\nresolution and refusals');
await ok('no taxon is a refusal: the question is about a clade in a place', async () => {
  const r = await ecologyCheck({});
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.match(r.reason, /no taxon/);
});
await ok('a name the backbone cannot match is refused, not approximated', async () => {
  // A xenobot has never been anywhere, so there is nothing to find and nothing to find it. An occurrence
  // database asked about a synthetic object must come back empty-handed and say so.
  const r = await ecologyCheck({ taxon: 'Xenobot' });
  assert.equal(r.verdict, 'cannot-evaluate');
  assert.match(r.reason, /could not match/);
});

console.log('\nreal records, with their caveats attached');
await ok('occurrence records come back with the clade resolved and the country breakdown', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster' });
  if (!r.resolved) { assert.fail('cache miss: run `node runs/long-lived-fruit-fly/run.mjs` once online to fill sim-engine/validate/ecology/cache/'); }
  assert.equal(r.resolved.canonical, 'Drosophila melanogaster');
  assert.ok(r.recorded_range.total_records > 0);
  assert.ok(r.recorded_range.countries.length > 0);
  assert.match(r.recorded_range.caveat, /presence and collector effort|bias/i,
    'an occurrence count presented without the sampling caveat is a map of where people looked, read as a map of where the organism is');
});
await ok('interaction records name real taxa and carry the study caveat', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster' });
  assert.ok(r.interactions.eatenBy.total_taxa > 0, 'GloBI records predators of this clade');
  assert.ok(r.interactions.eatenBy.taxa.every(t => typeof t.taxon === 'string' && t.taxon.length));
  assert.match(r.interactions.caveat, /not a rate/);
});
await ok('the community is scoped to the design\'s own class, and says why', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster', where: BOSTON, community_limit: 8 });
  if (!r.community) assert.fail('cache miss for the community query; re-run the fruit-fly use case online once');
  assert.equal(r.community.scoped_to.clade, 'Insecta');
  assert.ok(r.community.species.length > 0);
  assert.match(r.community.scoped_to.why, /competes? with|compete/i);
  assert.match(r.community.caveat, /record count|not how many there are/i);
});

await ok('relationships are grouped by kind: eaten is not parasitised is not mutualistic', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster' });
  const rel = r.interactions.relationships;
  assert.ok(rel.eaten?.count > 0, 'GloBI records predators of this clade');
  assert.ok(rel.mutualism_or_symbiosis?.count > 0, 'and records it pollinating carrion-scented flowers');
  assert.ok(rel.mutualism_or_symbiosis.taxa.every(t => t.taxon && t.interaction));
  assert.notEqual(rel.eaten.count, rel.parasitised_by?.count ?? -1, 'being eaten and being parasitised are different questions with different evidence');
});
await ok('the grouping says plainly that competition is NOT among the recorded relationships', async () => {
  // The one ecological relationship that leaves almost no observational trace, because it is two organisms
  // NOT doing something to each other. A list of interaction types read as a complete account of how a
  // design would fare is exactly the wrong reading, so the result forestalls it.
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster' });
  assert.match(r.interactions.relationships_note, /COMPETITION IS NOT AMONG THEM/);
  assert.match(r.interactions.relationships_note, /Nobody watches an exclusion/);
});

console.log('\nthe holdout');
await ok('nothing from the frozen holdout clade reaches the result', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster', where: BOSTON, community_limit: 8 });
  assert.ok(r.community.holdout_filtered, 'the filter must report itself even when it drops nothing');
  for (const s of r.community.species) assert.notEqual(s.class, r.community.holdout_filtered.clade);
  assert.match(r.community.holdout_filtered.note, /INCOMPLETE BY DESIGN/,
    'a community with a whole class removed must say so: in most terrestrial boxes that is a large and central omission');
});
await ok('a design inside the holdout clade is refused outright', async () => {
  const r = await ecologyCheck({ taxon: 'Passer domesticus' });
  // Offline, this may refuse for want of a cached match rather than for the holdout. Either refusal is
  // correct; what must never happen is a result full of records for a held-out clade.
  assert.notEqual(r.ran, true);
  assert.ok(['refused', 'cannot-evaluate'].includes(r.verdict));
});
await ok('NOTHING from the holdout clade is ever written to the cache', async () => {
  // THE BUG: the downstream filter was perfect and the raw responses were cached on the way past. A first
  // unscoped community query returned 28 bird species, all 28 were dropped from the result, and all 28 were
  // in sim-engine/validate/ecology/cache/ by then, about to be committed. The frozen holdout is a rule
  // about what may be IN the repository, not about what may appear in a result.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'cache');
  if (!fs.existsSync(dir)) return;
  const ranks = o => [o?.kingdom, o?.phylum, o?.class, o?.order, o?.family, o?.genus].filter(Boolean);
  const bad = [];
  for (const f of fs.readdirSync(dir)) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    if (ranks(j).includes('Aves') || (Array.isArray(j.results) && j.results.some(x => ranks(x).includes('Aves')))) bad.push(f);
  }
  assert.equal(bad.length, 0, `${bad.length} cached response(s) hold a record inside the frozen holdout clade: ${bad.slice(0, 3).join(', ')}`);
});

console.log('\ncompetition: only from declared parameters');
await ok('no declared parameters means no outcome, and the refusal names the missing ones', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster' });
  assert.equal(r.competition, null);
  assert.match(r.reading, /NOT been evaluated|has NOT been evaluated/);
});
await ok('a bare number is refused, exactly as everywhere else in the repository', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster',
    competition: { invader: { K: 100 }, resident: { name: 'x', K: { value: 200, ...SRC('fixture') } },
      alpha_resident_on_invader: { value: 0.5, ...SRC('fixture') }, alpha_invader_on_resident: { value: 0.5, ...SRC('fixture') } } });
  assert.equal(r.competition.verdict, 'cannot-evaluate');
  assert.match(r.competition.reason, /bare number/);
});
await ok('mutual invasibility is computed exactly, and all four outcomes are reachable', async () => {
  const run = async (Ki, Kr, aRI, aIR) => (await ecologyCheck({ taxon: 'Drosophila melanogaster',
    competition: { invader: { K: { value: Ki, ...SRC('fixture') } }, resident: { name: 'resident', K: { value: Kr, ...SRC('fixture') } },
      alpha_resident_on_invader: { value: aRI, ...SRC('fixture') }, alpha_invader_on_resident: { value: aIR, ...SRC('fixture') } } })).competition;
  // invader K below alpha * resident K -> cannot invade when rare -> excluded
  assert.equal((await run(100, 1000, 0.9, 0.3)).outcome, 'resident-excludes-invader');
  // each limits itself more than the other -> both invade -> coexistence
  assert.equal((await run(1000, 1000, 0.5, 0.5)).outcome, 'coexistence');
  // each suppresses the other more than itself -> neither invades -> priority effect
  assert.equal((await run(1000, 1000, 1.5, 1.5)).outcome, 'founder-control');
  // the invader is the stronger competitor on these numbers
  assert.equal((await run(1000, 100, 0.3, 0.9)).outcome, 'invader-excludes-resident');
});
await ok('the outcome is labelled a property of the declared numbers, not a measurement', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster',
    competition: { invader: { K: { value: 100, ...SRC('declared by the designer') } }, resident: { name: 'r', K: { value: 1000, ...SRC('declared') } },
      alpha_resident_on_invader: { value: 0.9, ...SRC('declared') }, alpha_invader_on_resident: { value: 0.3, ...SRC('declared') } } });
  assert.equal(r.competition.verdict, 'outcompeted');
  assert.match(r.competition.model_caveat, /no space|no evolution/);
  assert.match(r.competition.model_caveat, /property of the four numbers/);
  for (const v of Object.values(r.competition.parameters)) assert.ok(v.source, 'every parameter must carry its source into the result');
});

console.log('\nwhat it refuses to claim');
await ok('the result always states what it cannot say, including the holdout gap', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster', where: BOSTON, community_limit: 8 });
  assert.ok(r.what_this_cannot_say.length >= 4);
  assert.ok(r.what_this_cannot_say.some(x => /outcompeted/.test(x)));
  assert.ok(r.what_this_cannot_say.some(x => /abundan/.test(x)));
  assert.ok(r.what_this_cannot_say.some(x => /Aves|holdout|filtered/i.test(x)));
  assert.ok(r.what_this_cannot_say.some(x => /its CLADE|a design is by construction not its clade/.test(x)),
    'the interaction records are for the clade, and a design is not its clade');
});
await ok('every outbound call is recorded with its purpose, cached or not', async () => {
  const r = await ecologyCheck({ taxon: 'Drosophila melanogaster' });
  assert.ok(r.queries.length > 0);
  for (const q of r.queries) { assert.ok(q.purpose, 'a query with no stated purpose cannot be audited'); assert.ok(q.url); assert.ok(q.from); }
  assert.ok(r.queries.every(q => q.from !== 'network'), 'this suite runs offline and must not reach the network');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
