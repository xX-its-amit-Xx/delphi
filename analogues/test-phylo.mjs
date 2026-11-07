#!/usr/bin/env node
// Tests for the phylogeny + phenome-alignment module.
//
//   node analogues/test-phylo.mjs [--fail-once]
//
// Four things are checked harder than the arithmetic, because they are the four ways this module could
// do damage rather than merely be wrong.
//
//   1. THE NEWICK ROUND TRIP. A parser that silently loses a branch length produces a tree whose
//      distances are wrong and whose topology is right, which is the hardest kind of wrong to notice.
//      The round trip is byte-exact, both from the canonical string and from a whitespace-laid-out one.
//
//   2. DIVERGENCE TIMES ARE NEVER A BARE NUMBER. A point date is the most copyable output this module
//      could have and the most misleading, so the test asserts the RETURN TYPE, not just the values:
//      there must be no code path that hands back something a caller can do arithmetic on without
//      having seen the interval.
//
//   3. THE NAMING TRAP IS NOT CLASSIFIED AS A MATCH. The trap case is constructed so that every cheap
//      check passes -- identical term strings, identical measurand, identical unit. If the classifier
//      ever returns same-measurement for it, every automated comparison downstream is clean and empty.
//      The test asserts both that it IS the trap and that it is NOT same-measurement, because those are
//      different failures and only one of them is caught by asserting the positive.
//
//   4. THE HOLDOUT. One clade is a frozen evaluation holdout for this project and must not appear in
//      this module. The test does not contain its name either: it reads the project's own roster at
//      runtime, builds the patterns from that, and scans both source files. So the gate is derived from
//      the authority rather than from a list a test author retyped, and nothing is leaked by the test.
//
// --fail-once injects one fault into every assertion by INVERTING its predicate. Every line must then
// FAIL. An assertion that survives its own inversion is asserting nothing, so a surviving "ok" under
// --fail-once is a bug in this file and not a pass.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from './phylo.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const T = P.defaultTree();
const TIPS = P.tips(T);

console.log(`\nphylo: ${TIPS.length} tips, ${Object.keys(P.DIVERGENCES).length} dated nodes, ${Object.keys(P.PHENOTYPE_SCALES).length} correspondence kinds\n`);

// ===================================================================================================
// 1. NEWICK -- the round trip, exactly, including branch lengths.
// ===================================================================================================
console.log('newick');
{
  const rt = P.toNewick(P.parseNewick(P.TREE.newick));
  check('TREE.newick round-trips byte-exactly through parse -> serialise',
    f(rt === P.TREE.newick, rt !== P.TREE.newick),
    rt === P.TREE.newick ? '' : `differs at char ${[...rt].findIndex((c, i) => c !== P.TREE.newick[i])}`);

  // Layout tolerance: a pretty-printed form of the SAME tree must normalise back to the canonical
  // string. This is what proves the round trip is a property of the parser and not of the input having
  // no whitespace in it.
  const viaPretty = P.toNewick(P.parseNewick(P.prettyNewick(T)));
  check('a whitespace-laid-out rendering of the tree normalises back to the canonical string',
    f(viaPretty === P.TREE.newick, viaPretty !== P.TREE.newick));

  // Branch lengths specifically. The topology surviving a round trip while the lengths are dropped is
  // the exact failure this module cannot tolerate, so the lengths are checked on their own.
  const lens = n => [(n.length == null ? 'null' : n.length), ...(n.children || []).flatMap(lens)];
  const before = lens(T).join(',');
  const after = lens(P.parseNewick(P.toNewick(T))).join(',');
  check('every branch length survives the round trip with its value',
    f(before === after && before.includes('137') && before.includes('13'), !(before === after && before.includes('137') && before.includes('13'))),
    `${before.split(',').length} lengths`);

  // Awkward length spellings, where a naive number -> string round trip loses the original.
  const odd = '((a:0.125,b:1.50)x:1e2,(c:-0.5,d:3)y:0.0)z;';
  const oddRt = P.toNewick(P.parseNewick(odd));
  check('non-integer, exponential, negative and zero branch lengths round-trip exactly',
    f(oddRt === odd, oddRt !== odd), `got ${oddRt}`);

  const q = "((a:1,'b, with comma and '' quote':2)i:3,c:4)r;";
  check('a single-quoted label containing a comma and an escaped quote round-trips',
    f(P.toNewick(P.parseNewick(q)) === q, P.toNewick(P.parseNewick(q)) !== q));

  const parsedOdd = P.parseNewick(odd);
  check('internal node labels are parsed, not discarded',
    f(parsedOdd.name === 'z' && parsedOdd.children[0].name === 'x', !(parsedOdd.name === 'z' && parsedOdd.children[0].name === 'x')),
    `root ${parsedOdd.name}, first internal ${parsedOdd.children[0].name}`);

  const threw = (fn) => { try { fn(); return false; } catch { return true; } };
  check('a tree with a dangling parenthesis is rejected rather than half-parsed',
    f(threw(() => P.parseNewick('((a:1,b:2)x:3,c:4;')), !threw(() => P.parseNewick('((a:1,b:2)x:3,c:4;'))));
  check("a ':' with no number after it is rejected",
    f(threw(() => P.parseNewick('(a:,b:2);')), !threw(() => P.parseNewick('(a:,b:2);'))));
}

// ===================================================================================================
// 2. MRCA
// ===================================================================================================
console.log('\nmrca');
{
  let asym = null;
  for (const a of TIPS) for (const b of TIPS) {
    if (P.mrca(T, a, b) !== P.mrca(T, b, a)) { asym = `${a} / ${b}`; break; }
  }
  check('mrca is symmetric for every pair of tips',
    f(asym === null, asym !== null), asym ? `asymmetric at ${asym}` : `${TIPS.length ** 2} ordered pairs`);

  let selfWrong = null;
  for (const a of TIPS) {
    const m = P.mrca(T, a, a);
    if (m !== P.findNode(T, a) || m.name !== a) { selfWrong = a; break; }
  }
  check("a species' MRCA with itself is itself",
    f(selfWrong === null, selfWrong !== null), selfWrong ? `wrong for ${selfWrong}` : '');

  check('the MRCA of two congeners is the genus node, not a deeper one',
    f(P.mrca(T, 'Danio_rerio', 'Danio_aesculapii').name === 'Danio', P.mrca(T, 'Danio_rerio', 'Danio_aesculapii').name !== 'Danio'),
    P.mrca(T, 'Danio_rerio', 'Danio_aesculapii').name);

  check('the MRCA of the invertebrate outgroup and any vertebrate is the root',
    f(P.mrca(T, 'Drosophila_melanogaster', 'Danio_rerio').name === P.TREE.root, P.mrca(T, 'Drosophila_melanogaster', 'Danio_rerio').name !== P.TREE.root));

  // An ancestor-descendant pair: the MRCA is the ancestor, and getting the root here instead would be
  // the classic off-by-one in a lineage-climbing implementation.
  check('the MRCA of a node and one of its own descendants is that node',
    f(P.mrca(T, 'Clupeocephala', 'Danio_rerio').name === 'Clupeocephala', P.mrca(T, 'Clupeocephala', 'Danio_rerio').name !== 'Clupeocephala'));
}

// ===================================================================================================
// 3. PATRISTIC DISTANCE
// ===================================================================================================
console.log('\npatristic distance');
{
  let worst = -Infinity, worstAt = null;
  for (const a of TIPS) for (const b of TIPS) for (const c of TIPS) {
    const v = P.patristicDistance(T, a, b) - P.patristicDistance(T, a, c) - P.patristicDistance(T, c, b);
    if (v > worst) { worst = v; worstAt = `${a} / ${b} via ${c}`; }
  }
  const tol = 1e-9;
  check('patristic distance satisfies the triangle inequality on every triple of tips',
    f(worst <= tol, worst > tol),
    `worst d(a,b) - d(a,c) - d(c,b) = ${worst} at ${worstAt} over ${TIPS.length ** 3} triples`);

  let asym = null;
  for (const a of TIPS) for (const b of TIPS) {
    if (P.patristicDistance(T, a, b) !== P.patristicDistance(T, b, a)) { asym = `${a} / ${b}`; break; }
  }
  check('patristic distance is symmetric', f(asym === null, asym !== null), asym ?? '');

  let selfNonZero = null;
  for (const a of TIPS) if (P.patristicDistance(T, a, a) !== 0) { selfNonZero = a; break; }
  check('the patristic distance from a tip to itself is 0', f(selfNonZero === null, selfNonZero !== null), selfNonZero ?? '');

  // Ultrametricity: the tree is declared ultrametric, and the distance code does not assume it, so the
  // two have to be checked against each other. If this fails, every date in the module is still fine
  // and every distance is subtly not twice an age.
  const rootAge = P.TREE.root_age_used_in_tree;
  const depths = [];
  (function walk(n, acc) {
    const d = acc + (n.length || 0);
    if (!n.children || !n.children.length) depths.push([n.name, d]);
    else for (const c of n.children) walk(c, d);
  })(T, 0);
  const nonUltra = depths.filter(([, d]) => Math.abs(d - rootAge) > tol).map(([n, d]) => `${n}: ${d}`);
  check('the tree is ultrametric: every tip is the root age from the root, so a distance is twice an MRCA age',
    f(nonUltra.length === 0 && depths.length === TIPS.length, !(nonUltra.length === 0 && depths.length === TIPS.length)),
    nonUltra.length ? `expected ${rootAge}; got ${nonUltra.join(', ')}` : `all ${depths.length} tips at ${rootAge} Ma deep`);

  // And the consequence, checked rather than assumed: on an ultrametric tree the patristic distance
  // between two tips is exactly twice the age of their MRCA. This is what lets a distance be read as
  // "time since divergence, doubled" instead of as an arbitrary sum.
  const mismatch = [];
  for (const a of TIPS) for (const b of TIPS) {
    if (a === b) continue;
    const node = P.mrca(T, a, b);
    const age = P.DIVERGENCES[node.name].used_in_tree;
    if (Math.abs(P.patristicDistance(T, a, b) - 2 * age) > tol) mismatch.push(`${a}/${b}`);
  }
  check('a patristic distance is exactly twice the age of the pair\'s MRCA',
    f(mismatch.length === 0, mismatch.length > 0), mismatch.length ? mismatch.slice(0, 4).join(', ') : `${TIPS.length * (TIPS.length - 1)} ordered pairs`);

  // The headline ordering claim, on the real tree.
  const congeneric = P.patristicDistance(T, 'Danio_rerio', 'Danio_aesculapii');
  const crossClass = P.patristicDistance(T, 'Danio_rerio', 'Mus_musculus');
  check('two species in the same genus are closer than two in different classes',
    f(congeneric < crossClass, congeneric >= crossClass),
    `Danio/Danio = ${congeneric} Ma, Danio/Mus = ${crossClass} Ma`);
  check('the cross-class distance is more than an order of magnitude larger, which is the point of printing it',
    f(crossClass > 10 * congeneric, crossClass <= 10 * congeneric), `${(crossClass / congeneric).toFixed(1)}x`);
  check('a same-family, different-genus pair sits between the congeneric and the cross-class distance',
    f(congeneric < P.patristicDistance(T, 'Mus_musculus', 'Rattus_norvegicus') + 1 && P.patristicDistance(T, 'Mus_musculus', 'Rattus_norvegicus') < crossClass,
      !(congeneric < P.patristicDistance(T, 'Mus_musculus', 'Rattus_norvegicus') + 1 && P.patristicDistance(T, 'Mus_musculus', 'Rattus_norvegicus') < crossClass)),
    `Mus/Rattus = ${P.patristicDistance(T, 'Mus_musculus', 'Rattus_norvegicus')} Ma`);
}

// ===================================================================================================
// 4. DIVERGENCE TIMES -- a range, always; a source, always.
// ===================================================================================================
console.log('\ndivergence times');
{
  const r = P.divergenceTime('Danio_rerio', 'Homo_sapiens');
  check('divergenceTime returns a record, never a bare number',
    f(typeof r === 'object' && r !== null, typeof r === 'number'), `typeof ${typeof r}`);
  check('divergenceTime returns a range with hi > lo',
    f(r.hi > r.lo, r.hi <= r.lo), `${r.lo}-${r.hi} ${r.unit}`);
  check('the range is flagged as an estimate, not a measurement',
    f(r.is_estimate === true && r.is_range === true, !(r.is_estimate === true && r.is_range === true)));
  check('the record carries the model-dependence caveat in words, not just a flag',
    f(/model-dependent/i.test(r.caveat) && /calibration/i.test(r.caveat), !(/model-dependent/i.test(r.caveat) && /calibration/i.test(r.caveat))));
  check('the record names the node it dates, so the claim can be checked against the tree',
    f(r.node === P.mrca(T, 'Danio_rerio', 'Homo_sapiens').name, r.node !== P.mrca(T, 'Danio_rerio', 'Homo_sapiens').name), r.node);

  // Every pair of tips, not just the one above: no pair may come back with a missing or inverted range.
  let bad = null;
  for (const a of TIPS) for (const b of TIPS) {
    if (a === b) continue;
    const d = P.divergenceTime(a, b);
    if (typeof d === 'number' || d.comparison !== 'pair' || !(d.hi > d.lo) || !(d.sources.length > 0)) { bad = `${a} / ${b}`; break; }
  }
  check('every pair of tips gets a dated range with at least one source',
    f(bad === null, bad !== null), bad ? `failed at ${bad}` : `${(TIPS.length * (TIPS.length - 1))} ordered pairs`);

  // A self-comparison is the degenerate case a dashboard will hit. It must not come back as a bare 0.
  const self = P.divergenceTime('Danio_rerio', 'Danio_rerio');
  check('a self-comparison returns a flagged record rather than a bare 0',
    f(typeof self === 'object' && self.comparison === 'self', !(typeof self === 'object' && self.comparison === 'self')));

  // EVERY DATE CARRIES A SOURCE, and the source key has to resolve.
  const missing = [];
  for (const [k, d] of Object.entries(P.DIVERGENCES)) {
    if (!Array.isArray(d.sources) || d.sources.length === 0) { missing.push(`${k}: no sources`); continue; }
    for (const s of d.sources) if (!(s in P.SOURCES)) missing.push(`${k}: unknown source key ${s}`);
  }
  check('every divergence date carries at least one source, and every source key resolves in SOURCES',
    f(missing.length === 0, missing.length > 0), missing.length ? missing.join('; ') : `${Object.keys(P.DIVERGENCES).length} dated nodes`);

  const noRange = Object.entries(P.DIVERGENCES).filter(([, d]) => !(typeof d.lo === 'number' && typeof d.hi === 'number' && d.hi > d.lo)).map(([k]) => k);
  check('no divergence record states a point date: every one has lo < hi',
    f(noRange.length === 0, noRange.length > 0), noRange.join(', '));

  const noGrade = Object.entries(P.DIVERGENCES).filter(([, d]) => !['well-constrained', 'moderate', 'poorly-constrained'].includes(d.confidence)).map(([k]) => k);
  check('every divergence record grades how much its range can be trusted',
    f(noGrade.length === 0, noGrade.length > 0), noGrade.join(', '));

  // The number baked into the Newick string must sit inside the range it was drawn from, or the tree
  // and the dates are telling two different stories.
  const outside = Object.entries(P.DIVERGENCES).filter(([, d]) => !(d.used_in_tree >= d.lo && d.used_in_tree <= d.hi)).map(([k]) => k);
  check('the single number each node contributes to the tree lies inside that node\'s published range',
    f(outside.length === 0, outside.length > 0), outside.join(', '));

  // Ages must decrease from root to tip, or the tree is not a tree of nested divergences.
  const nonMonotone = [];
  (function walk(n, parentAge) {
    const d = P.DIVERGENCES[n.name];
    const age = d ? d.used_in_tree : 0;
    if (parentAge != null && !(age < parentAge)) nonMonotone.push(`${n.name || '(tip)'} ${age} >= parent ${parentAge}`);
    for (const c of n.children || []) walk(c, age);
  })(T, null);
  check('node ages decrease monotonically from the root to every tip',
    f(nonMonotone.length === 0, nonMonotone.length > 0), nonMonotone.join('; '));
}

// ===================================================================================================
// 5. COMPARABILITY WARNINGS -- and the teleost-duplication hazard specifically.
// ===================================================================================================
console.log('\ncomparability');
{
  const far = P.comparabilityWarning('Homo_sapiens', 'Danio_rerio');
  const near = P.comparabilityWarning('Danio_rerio', 'Danio_aesculapii');
  check('a warning states the distance in words, not only as a field',
    f(far.warnings.some(w => w.includes(String(far.patristic_distance))), !far.warnings.some(w => w.includes(String(far.patristic_distance)))));
  check('the far pair is graded as a weaker functional transfer than the near pair',
    f(['weak', 'very-weak'].includes(far.transfer_strength) && far.transfer_strength !== near.transfer_strength,
      !(['weak', 'very-weak'].includes(far.transfer_strength) && far.transfer_strength !== near.transfer_strength)),
    `${near.transfer_strength} -> ${far.transfer_strength}`);
  check('a warning carries the divergence RANGE, not just a distance',
    f(far.divergence.hi > far.divergence.lo, far.divergence.hi <= far.divergence.lo));

  // The teleost case. A mammal/teleost pair must raise the duplication hazard as something separate
  // from its distance, and must say the mapping is 1:2 rather than 1:1.
  const h = far.teleost_hazard;
  check('a mammal/teleost pair raises the teleost genome duplication as a hazard',
    f(h !== null && h.kind === 'crosses-the-teleost-genome-duplication', !(h !== null && h.kind === 'crosses-the-teleost-genome-duplication')),
    h ? h.kind : 'null');
  check('the hazard states the arity: one mammalian gene may correspond to TWO fish genes',
    f(/\b2\b/.test(h.expected_arity) && /TWO/.test(h.summary), !(/\b2\b/.test(h.expected_arity) && /TWO/.test(h.summary))));
  check('the hazard is presented as additional to raw distance, not as a restatement of it',
    f(/beyond/i.test(h.why_beyond_distance) && /arity/i.test(h.why_beyond_distance), !(/beyond/i.test(h.why_beyond_distance) && /arity/i.test(h.why_beyond_distance))));
  check('the hazard names the unduplicated outgroup that would resolve the arity',
    f(h.the_outgroup_that_resolves_it.includes('Lepisosteus_oculatus'), !h.the_outgroup_that_resolves_it.includes('Lepisosteus_oculatus')));

  // The non-teleost ray-finned fish is in the roster for exactly this: a mammal/gar pair must NOT raise
  // the duplication hazard, because the gar is on the other side of it.
  const gar = P.comparabilityWarning('Homo_sapiens', 'Lepisosteus_oculatus');
  check('a mammal paired with the unduplicated ray-finned fish does NOT raise the duplication hazard',
    f(gar.teleost_hazard === null, gar.teleost_hazard !== null), gar.teleost_hazard ? gar.teleost_hazard.kind : 'null');
  check('a mammal/mammal pair raises no duplication hazard either',
    f(P.comparabilityWarning('Homo_sapiens', 'Mus_musculus').teleost_hazard === null,
      P.comparabilityWarning('Homo_sapiens', 'Mus_musculus').teleost_hazard !== null));

  // Two teleosts share the duplication, so the 1:2 problem is replaced by the lineage-specific-loss one.
  const twoFish = P.comparabilityWarning('Danio_rerio', 'Takifugu_rubripes');
  check('two teleosts get the lineage-specific-ohnolog-loss hazard instead of the 1:2 hazard',
    f(twoFish.teleost_hazard.kind === 'both-post-duplication-but-loss-is-lineage-specific',
      twoFish.teleost_hazard.kind !== 'both-post-duplication-but-loss-is-lineage-specific'),
    twoFish.teleost_hazard.kind);

  check('a comparability warning sends the caller on to the phenotype check, because distance is only half of it',
    f(/alignPhenotypes/.test(far.also_required), !/alignPhenotypes/.test(far.also_required)));
  check('a self-comparison is reported as such rather than as a distance of zero between two species',
    f(P.comparabilityWarning('Danio_rerio', 'Danio_rerio').comparison === 'self',
      P.comparabilityWarning('Danio_rerio', 'Danio_rerio').comparison !== 'self'));
}

// ===================================================================================================
// 6. PHENOTYPE SCALES AND ALIGNMENT
// ===================================================================================================
console.log('\nphenome alignment');
{
  const ranks = Object.values(P.PHENOTYPE_SCALES).map(s => s.rank);
  check('PHENOTYPE_SCALES enumerates all five kinds of correspondence with distinct ranks',
    f(ranks.length === 5 && new Set(ranks).size === 5, !(ranks.length === 5 && new Set(ranks).size === 5)),
    Object.keys(P.PHENOTYPE_SCALES).join(', '));
  check('PHENOTYPE_SCALES is frozen',
    f(Object.isFrozen(P.PHENOTYPE_SCALES) && Object.isFrozen(P.PHENOTYPE_SCALES['same-measurement']),
      !(Object.isFrozen(P.PHENOTYPE_SCALES) && Object.isFrozen(P.PHENOTYPE_SCALES['same-measurement']))));
  check('the numeric-comparison floor is the homologous-structure-different-measurement rank',
    f(P.NUMERIC_COMPARISON_FLOOR === P.PHENOTYPE_SCALES['homologous-structure-different-measurement'].rank,
      P.NUMERIC_COMPARISON_FLOOR !== P.PHENOTYPE_SCALES['homologous-structure-different-measurement'].rank));

  // --- the refusal that matters most: analogous function, no stated conversion ------------------
  const analog = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'swim bladder', measurement: 'organ volume', unit: 'mm^3' },
    { species: 'Callorhinchus_milii', term: 'liver', measurement: 'organ volume', unit: 'mm^3' });
  check('an analogous-function, non-homologous pair is classified as such',
    f(analog.correspondence === 'analogous-function-non-homologous', analog.correspondence !== 'analogous-function-non-homologous'),
    analog.correspondence);
  check('alignPhenotypes REFUSES a numeric comparison for analogous-function-non-homologous',
    f(analog.numeric_comparison_permitted === false, analog.numeric_comparison_permitted !== false));
  check('the refusal says why, in words a reader of the dashboard can act on',
    f(typeof analog.refusal_reason === 'string' && analog.refusal_reason.length > 40,
      !(typeof analog.refusal_reason === 'string' && analog.refusal_reason.length > 40)));
  check('the refusal returns WHAT CONVERSION would be needed instead of just saying no',
    f(analog.conversion_required !== null && Array.isArray(analog.conversion_required.needs) && analog.conversion_required.needs.length > 0,
      !(analog.conversion_required !== null && Array.isArray(analog.conversion_required.needs) && analog.conversion_required.needs.length > 0)),
    analog.conversion_required ? analog.conversion_required.kind : 'null');
  const analogConv = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'swim bladder', measurement: 'organ volume', unit: 'mm^3' },
    { species: 'Callorhinchus_milii', term: 'liver', measurement: 'organ volume', unit: 'mm^3' },
    { conversion: { quantity: 'static lift as a fraction of body weight', stated_by: 'the caller' } });
  check('an explicitly stated conversion lifts the refusal for an analogous-function pair',
    f(analogConv.numeric_comparison_permitted === true, analogConv.numeric_comparison_permitted !== true));

  // --- THE NAMING TRAP. Identical term, identical measurand, identical unit: every cheap check passes.
  const trap = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'operculum', measurement: 'operculum area', unit: 'mm^2' },
    { species: 'Homo_sapiens', term: 'operculum', measurement: 'operculum area', unit: 'mm^2' });
  check('the naming-trap case is classified as named-the-same-but-unrelated',
    f(trap.correspondence === 'named-the-same-but-unrelated', trap.correspondence !== 'named-the-same-but-unrelated'),
    trap.correspondence);
  check('the naming-trap case is NOT classified as same-measurement, despite identical term, measurand and unit',
    f(trap.correspondence !== 'same-measurement', trap.correspondence === 'same-measurement'));
  check('the naming-trap refusal is final: no conversion lifts it',
    f(trap.refusal_is_final === true && trap.numeric_comparison_permitted === false,
      !(trap.refusal_is_final === true && trap.numeric_comparison_permitted === false)));
  const trapWithConv = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'operculum', measurement: 'operculum area', unit: 'mm^2' },
    { species: 'Homo_sapiens', term: 'operculum', measurement: 'operculum area', unit: 'mm^2' },
    { conversion: { note: 'a caller trying to force it through' } });
  check('supplying a conversion does NOT get a numeric comparison past the naming trap',
    f(trapWithConv.numeric_comparison_permitted === false, trapWithConv.numeric_comparison_permitted !== false));
  check('the trap verdict names the two senses, with ids, so the reader can see what was being compared',
    f(/UBERON:2000555/.test(trap.basis) && /UBERON:0002947/.test(trap.basis), !(/UBERON:2000555/.test(trap.basis) && /UBERON:0002947/.test(trap.basis))),
    trap.basis.slice(0, 80));

  // The second trap, inside the fishes, where the shared name is even more plausible.
  const trap2 = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'fin ray', measurement: 'ray count', unit: 'count' },
    { species: 'Callorhinchus_milii', term: 'fin ray', measurement: 'ray count', unit: 'count' });
  check('a within-fishes naming trap (one dermal bone, one elastoidin rod) is caught too',
    f(trap2.correspondence === 'named-the-same-but-unrelated', trap2.correspondence !== 'named-the-same-but-unrelated'),
    trap2.correspondence);

  // The measurement-level version of the trap.
  const trap3 = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'body length', measurement: 'length', unit: 'mm' },
    { species: 'Mus_musculus', term: 'body length', measurement: 'length', unit: 'mm' });
  check('"body length" across a fish and a mammal is not a same-measurement match',
    f(trap3.correspondence !== 'same-measurement', trap3.correspondence === 'same-measurement'), trap3.correspondence);

  // --- the honest positives, so the classifier is not simply refusing everything -----------------
  const homol = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'pectoral fin', measurement: 'fin length', unit: 'mm' },
    { species: 'Mus_musculus', term: 'forelimb', measurement: 'forelimb length', unit: 'mm' });
  check('a fin and a forelimb are classified as homologous structures with different measurements',
    f(homol.correspondence === 'homologous-structure-different-measurement', homol.correspondence !== 'homologous-structure-different-measurement'),
    homol.correspondence);
  check('the fin/forelimb correspondence carries the shared ontology term that justifies it',
    f(homol.shared_reference.curie === 'UBERON:0004710', homol.shared_reference.curie !== 'UBERON:0004710'),
    String(homol.shared_reference.curie));
  check('a fin/forelimb numeric comparison still waits for a stated conversion',
    f(homol.numeric_comparison_permitted === false && homol.conversion_required !== null,
      !(homol.numeric_comparison_permitted === false && homol.conversion_required !== null)));

  const same = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'pectoral fin', measurement: 'fin length', unit: 'mm', protocol: 'to the distal tip of the longest lepidotrichium' },
    { species: 'Danio_aesculapii', term: 'pectoral fin', measurement: 'fin length', unit: 'mm', protocol: 'to the distal tip of the longest lepidotrichium' });
  check('the same measurement by the same stated protocol in two congeners IS permitted',
    f(same.correspondence === 'same-measurement' && same.numeric_comparison_permitted === true,
      !(same.correspondence === 'same-measurement' && same.numeric_comparison_permitted === true)),
    `${same.correspondence}, permitted ${same.numeric_comparison_permitted}`);
  const sameButProtocol = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'pectoral fin', measurement: 'fin length', unit: 'mm', protocol: 'A' },
    { species: 'Danio_aesculapii', term: 'pectoral fin', measurement: 'fin length', unit: 'mm', protocol: 'B' });
  check('identical measurand and unit with DIFFERENT protocols is demoted below same-measurement',
    f(sameButProtocol.correspondence !== 'same-measurement', sameButProtocol.correspondence === 'same-measurement'),
    sameButProtocol.correspondence);

  const absent = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'neuromast', measurement: 'count', unit: 'count' },
    { species: 'Homo_sapiens', term: 'neuromast', measurement: 'count', unit: 'count' });
  check('a phenotype absent in one species is no-correspondence, not a zero',
    f(absent.correspondence === 'no-correspondence' && absent.numeric_comparison_permitted === false,
      !(absent.correspondence === 'no-correspondence' && absent.numeric_comparison_permitted === false)),
    absent.correspondence);

  const unknown = P.alignPhenotypes(
    { species: 'Danio_rerio', term: 'caudal fin', measurement: 'length', unit: 'mm' },
    { species: 'Homo_sapiens', term: 'liver', measurement: 'mass', unit: 'g' });
  check('an uncurated pair of different terms falls to no-correspondence rather than being guessed at',
    f(unknown.correspondence === 'no-correspondence', unknown.correspondence !== 'no-correspondence'), unknown.correspondence);

  check('every alignment result sends the caller on to the distance check as well',
    f(/comparabilityWarning/.test(homol.also_required), !/comparabilityWarning/.test(homol.also_required)));
}

// ===================================================================================================
// 7. ONTOLOGY BACKING
// ===================================================================================================
console.log('\nontology backing');
{
  const pf = P.ontologyBacked('pectoral fin');
  check('a curated structure term returns its CURIE',
    f(pf.found === true && pf.curie === 'UBERON:0000151', !(pf.found === true && pf.curie === 'UBERON:0000151')), String(pf.curie));
  check('a curated term says it is hand-curated rather than looked up live',
    f(pf.hand_curated === true && pf.not_a_live_query === true, !(pf.hand_curated === true && pf.not_a_live_query === true)));
  check('the zebrafish-specific id is carried alongside the cross-species one',
    f(pf.also && pf.also['ZFA:0001161'] === 'pectoral fin', !(pf.also && pf.also['ZFA:0001161'] === 'pectoral fin')));

  const op = P.ontologyBacked('operculum');
  check('an ambiguous term returns ambiguous rather than a best guess',
    f(op.found === false && op.ambiguous === true && op.curie === null, !(op.found === false && op.ambiguous === true && op.curie === null)));
  check('the ambiguous term enumerates its senses, each with the group it applies to',
    f(op.senses.length >= 3 && op.senses.every(s => Array.isArray(s.groups) && s.groups.length > 0),
      !(op.senses.length >= 3 && op.senses.every(s => Array.isArray(s.groups) && s.groups.length > 0))),
    `${op.senses.length} senses`);

  const nope = P.ontologyBacked('an invented structure that is in no ontology');
  check('an uncurated term returns not-found, and says the absence is absence of curation',
    f(nope.found === false && /absence of curation/.test(nope.why), !(nope.found === false && /absence of curation/.test(nope.why))));

  const curieShape = /^(UBERON|ZFA):\d{7}$/;
  const badCuries = Object.entries(P.ONTOLOGY_TERMS).filter(([, t]) => !curieShape.test(t.curie)).map(([k]) => k);
  check('every CURIE carried in ONTOLOGY_TERMS is a well-formed UBERON or ZFA id',
    f(badCuries.length === 0, badCuries.length > 0), badCuries.join(', '));
  const noLabel = Object.entries(P.ONTOLOGY_TERMS).filter(([, t]) => !(typeof t.label === 'string' && t.label.length > 0)).map(([k]) => k);
  check('every carried CURIE records the label it resolved to, so a stale id is detectable',
    f(noLabel.length === 0, noLabel.length > 0), noLabel.join(', '));
}

// ===================================================================================================
// 8. THE NAMING TRAP RECORD
// ===================================================================================================
console.log('\nthe naming trap');
{
  const t = P.THE_NAMING_TRAP;
  check('THE_NAMING_TRAP is frozen',
    f(Object.isFrozen(t) && Object.isFrozen(t.primary_case), !(Object.isFrozen(t) && Object.isFrozen(t.primary_case))));
  check('the primary case names two structures with different CURIEs under a shared common name',
    f(t.primary_case.structure_a.curie !== t.primary_case.structure_b.curie && /fin ray/.test(t.primary_case.name),
      !(t.primary_case.structure_a.curie !== t.primary_case.structure_b.curie && /fin ray/.test(t.primary_case.name))),
    `${t.primary_case.structure_a.curie} vs ${t.primary_case.structure_b.curie}`);
  check('the primary case says what going wrong looks like, concretely, more than once',
    f(Array.isArray(t.primary_case.what_going_wrong_looks_like) && t.primary_case.what_going_wrong_looks_like.length >= 3,
      !(Array.isArray(t.primary_case.what_going_wrong_looks_like) && t.primary_case.what_going_wrong_looks_like.length >= 3)));
  check('the primary case states the tell: the ontology disagreeing with the name',
    f(/grouping class/.test(t.primary_case.the_tell), !/grouping class/.test(t.primary_case.the_tell)));
  check('the trap record is backed by sources rather than asserted',
    f(t.primary_case.sources.length > 0 && t.primary_case.sources.every(s => s in P.SOURCES),
      !(t.primary_case.sources.length > 0 && t.primary_case.sources.every(s => s in P.SOURCES))));
  check('the record admits that a CURIE makes a correspondence checkable without making it true',
    f(/does not make it true/.test(t.third_case.why_it_matters_here), !/does not make it true/.test(t.third_case.why_it_matters_here)));
  check('the measurement-level version of the trap is recorded with the size of the error it causes',
    f(/10-25%/.test(t.measurement_case.size_of_the_error), !/10-25%/.test(t.measurement_case.size_of_the_error)));
}

// ===================================================================================================
// 9. THE HOLDOUT GATE
// ---------------------------------------------------------------------------------------------------
// The held-out clade must not appear in either file of this module. This test does not contain its name
// either: it reads the project's own roster (holdout/split.json) at run time, builds the patterns from
// that -- including the class-level name, which it takes from `split.clade` rather than spelling out --
// and scans both source files. Genus-rank names are matched case-sensitively and everything else
// case-insensitively, mirroring holdout/check-leaks.mjs, because a case-insensitive genus pattern fires
// on every binomial that reuses the word as a species epithet.
// ===================================================================================================
console.log('\nholdout gate');
{
  const splitPath = path.join(root, 'holdout', 'split.json');
  const haveRoster = fs.existsSync(splitPath);
  const files = ['phylo.mjs', 'test-phylo.mjs'].map(n => path.join(here, n));
  const text = Object.fromEntries(files.map(p => [path.basename(p), fs.readFileSync(p, 'utf8')]));

  check('the roster that defines the holdout is readable, so this gate is derived and not retyped',
    f(haveRoster === true, haveRoster !== true), splitPath);

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const leaks = [];
  let nPatterns = 0;
  if (haveRoster) {
    const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    const held = split.taxa.filter(t => t.assignment === 'holdout');
    const pats = [];
    for (const t of held) {
      pats.push(new RegExp(`\\b${esc(t.name)}\\b`, t.rank === 'genus' ? '' : 'i'));
      if (t.slug && t.slug.includes('-')) pats.push(new RegExp(`\\b${esc(t.slug)}\\b`, 'i'));
    }
    // The class-level name, taken from the roster rather than written here.
    if (split.clade) pats.push(new RegExp(`\\b${esc(split.clade)}\\b`));
    nPatterns = pats.length;
    for (const [name, body] of Object.entries(text)) {
      body.split(/\r?\n/).forEach((line, i) => {
        for (const re of pats) if (re.test(line)) leaks.push(`${name}:${i + 1}`);
      });
    }
  }
  check('neither source file of this module names any held-out taxon or the held-out class',
    f(leaks.length === 0, leaks.length > 0),
    leaks.length ? leaks.slice(0, 5).join(', ') : `${nPatterns} patterns from the roster, checked against ${files.length} files`);

  // Every tip is on the declared roster, which is the positive form of the same guarantee: the tree
  // cannot have acquired a tip from anywhere other than TAXA.
  const offRoster = TIPS.filter(n => !P.TAXA.some(t => t.name === n));
  check('every tip of the tree is on the module\'s declared roster',
    f(offRoster.length === 0, offRoster.length > 0), offRoster.join(', '));

  // And the omission is declared, in words, without naming what is omitted.
  const om = P.TREE.omission;
  check('the tree declares that it omits something, and says what that does to a reading of it',
    f(om.declared === true && om.what.length > 40 && om.consequence_for_reading_the_tree.length > 40,
      !(om.declared === true && om.what.length > 40 && om.consequence_for_reading_the_tree.length > 40)));
  check('the omission notice does not itself name the omitted clade',
    f(leaks.length === 0 && /not named anywhere/.test(om.what), !(leaks.length === 0 && /not named anywhere/.test(om.what))));
}

// ===================================================================================================
console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion was inverted, so every line above must read FAIL)' : ''}\n`);
process.exit(fail && !FAULT ? 1 : 0);
