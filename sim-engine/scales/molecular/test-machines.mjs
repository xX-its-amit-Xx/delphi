#!/usr/bin/env node
// Tests for machines.mjs
//
//   node sim-engine/scales/molecular/test-machines.mjs [--fail-once]
//
// Six things are checked harder than the rest, because they are the six ways this module could do damage
// rather than merely be incomplete.
//
//   1. NO NUMBER WITHOUT AN ORGANISM. Every count and every rate must name the organism it was measured
//      in. A ribosome count with no species attached is the single most reusable wrong number this file
//      could emit, because it looks finished. The assertion is positive (every value HAS an organism) and
//      not merely "no value lacks one", so a file with zero values cannot pass it.
//
//   2. THE ASYMMETRIC UNIT GATE. No envelope may be measured from a deposited coordinate file whose chain
//      count disagrees with its biological assembly. This is the check that would have caught the error in
//      THE_ASYMMETRIC_UNIT_TRAP before it reached a figure, and it is asserted in BOTH directions: the one
//      entry where the counts differ must declare that it used the expanded assembly, AND the eleven where
//      they agree must not claim an expansion they did not do. Only asserting the first would pass for a
//      rule that demands expansion everywhere.
//
//   3. NULLS ARE NULLS, NOT ZEROES OR PLACEHOLDERS. Every unretrieved value must be exactly null, carry a
//      null_reason, and carry a what_would_resolve_it. A null that is secretly 0, or a reason string of
//      "TODO", is worse than a missing field because arithmetic succeeds on it.
//
//   4. NO SINGLE FUSED SCORE. sizeLadder() may return lengths and ratios of lengths and nothing else.
//      The test enumerates its numeric leaves and asserts each is a nanometre length or a dimensionless
//      ratio whose two operands are both present, so a "fidelity: 0.87" could not be added without
//      failing.
//
//   5. ACCESSION HYGIENE. Every accession named in MACHINES.structure must appear in STRUCTURES_VERIFIED
//      with a title, a method and a resolution read back, and no accession may appear in both
//      STRUCTURES_VERIFIED and STRUCTURES_REJECTED. The rejected one must not be reachable from any
//      machine.
//
//   6. THE HOLDOUT. One clade is a frozen evaluation holdout for this project. The test does not carry its
//      name: it reads the project's own roster at runtime, builds the patterns from that, and scans this
//      module's source. The gate is derived from the authority rather than from a list retyped here, and
//      the project's own leak checker is then run as the final word.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own inversion asserts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './machines.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

const RATE_UNITS = /per second|per minute|nucleotides per second|amino acids per second|kb per minute/;

// ------------------------------------------------------------------ shape of the export
console.log('\nthe export');
{
  check('MACHINES is a non-empty array', f(Array.isArray(M.MACHINES) && M.MACHINES.length >= 8, !Array.isArray(M.MACHINES) || M.MACHINES.length < 8),
    `${M.MACHINES?.length} entries`);
  const ids = M.MACHINES.map(m => m.id);
  check('every machine id is unique', f(new Set(ids).size === ids.length, new Set(ids).size !== ids.length),
    `${new Set(ids).size} unique of ${ids.length}`);
  // The brief names eight machines that must be present. Checked by concept, not by id string, so a
  // rename cannot silently drop one.
  const required = {
    'eukaryotic 80S ribosome': m => /ribosome/.test(m.id) && /80S/.test(m.name),
    'bacterial 70S ribosome': m => /ribosome/.test(m.id) && /70S/.test(m.name),
    'RNA polymerase II': m => /rna_polymerase_II/.test(m.id),
    'a named replicative DNA polymerase': m => /dna_polymerase/.test(m.id) && typeof m.which_polymerase === 'string',
    'nucleosome core particle': m => /nucleosome/.test(m.id),
    'nuclear pore complex': m => /nuclear_pore/.test(m.id),
    'spliceosome': m => /spliceosome/.test(m.id),
    'a chaperonin': m => /chaperonin/.test(m.id),
  };
  const missing = Object.entries(required).filter(([, pred]) => !M.MACHINES.some(pred)).map(([k]) => k);
  check('all eight required machines are present', f(missing.length === 0, missing.length > 0),
    missing.length ? `missing: ${missing.join(', ')}` : 'all present');
  // Both replicative polymerases, and they must be different enzymes.
  const pols = M.MACHINES.filter(m => /dna_polymerase/.test(m.id));
  check('both the leading- and lagging-strand polymerases are carried, as separate entries',
    f(pols.length === 2 && pols[0].which_polymerase !== pols[1].which_polymerase, pols.length !== 2),
    `${pols.length} polymerase entries`);
  check('each polymerase entry says WHICH polymerase it is',
    f(pols.every(p => /Pol delta|Pol epsilon/.test(p.which_polymerase)), false),
    pols.map(p => p.which_polymerase.slice(0, 20)).join(' | '));
  check('every machine has a one-sentence what_it_does for a non-specialist',
    f(M.MACHINES.every(m => typeof m.what_it_does === 'string' && m.what_it_does.length > 40 && m.what_it_does.length < 260), false));
  check('every machine has verified_how saying what was fetched',
    f(M.MACHINES.every(m => typeof m.verified_how === 'string' && m.verified_how.length > 120 && /read back|Fetched|fetched/.test(m.verified_how)), false));
}

// ------------------------------------------------------------------ 1. no number without an organism
console.log('\nno count and no rate without an organism');
{
  const counts = M.MACHINES.flatMap(m => (m.copies_per_cell ?? []).map(c => ({ m: m.id, c })));
  const withValue = counts.filter(x => typeof x.c.value === 'number');
  check('there is at least one retrieved count to test (a file of only nulls would pass vacuously)',
    f(withValue.length >= 3, withValue.length === 0), `${withValue.length} counts carry a number`);
  const countNoOrg = withValue.filter(x => typeof x.c.organism !== 'string' || x.c.organism.length < 4);
  check('every count that carries a number names its organism',
    f(countNoOrg.length === 0, countNoOrg.length > 0),
    countNoOrg.length ? countNoOrg.map(x => x.m).join(', ') : `${withValue.length} checked`);
  const countNoCell = withValue.filter(x => typeof x.c.cell_type !== 'string' || x.c.cell_type.length < 4);
  check('every count that carries a number names its cell type',
    f(countNoCell.length === 0, countNoCell.length > 0),
    countNoCell.length ? countNoCell.map(x => x.m).join(', ') : `${withValue.length} checked`);
  const countNoGrowth = withValue.filter(x => typeof x.c.growth_state !== 'string' || x.c.growth_state.length < 4);
  check('every count that carries a number names its growth state',
    f(countNoGrowth.length === 0, countNoGrowth.length > 0),
    countNoGrowth.length ? countNoGrowth.map(x => x.m).join(', ') : `${withValue.length} checked`);
  const countNoSource = withValue.filter(x => typeof x.c.source !== 'string');
  check('every count that carries a number cites a source key',
    f(countNoSource.length === 0, countNoSource.length > 0));

  const rates = M.MACHINES.flatMap(m => (m.rate ?? []).map(r => ({ m: m.id, r })));
  const rWithValue = rates.filter(x => typeof x.r.value === 'number');
  check('there is at least one retrieved rate to test',
    f(rWithValue.length >= 5, rWithValue.length === 0), `${rWithValue.length} rates carry a number`);
  const rateNoOrg = rWithValue.filter(x => typeof x.r.organism !== 'string' || x.r.organism.length < 4);
  check('every rate that carries a number names its organism',
    f(rateNoOrg.length === 0, rateNoOrg.length > 0),
    rateNoOrg.length ? rateNoOrg.map(x => x.m).join(', ') : `${rWithValue.length} checked`);
  const rateNoUnits = rWithValue.filter(x => typeof x.r.units !== 'string' || !RATE_UNITS.test(x.r.units));
  check('every rate that carries a number carries units with a time in them',
    f(rateNoUnits.length === 0, rateNoUnits.length > 0),
    rateNoUnits.length ? rateNoUnits.map(x => `${x.m}:${x.r.units}`).join(', ') : `${rWithValue.length} checked`);
  const rateNoCond = rWithValue.filter(x => typeof x.r.conditions !== 'string' || x.r.conditions.length < 20);
  check('every rate that carries a number states its measurement conditions',
    f(rateNoCond.length === 0, rateNoCond.length > 0));
  const rateNoSource = rWithValue.filter(x => typeof x.r.source !== 'string' || !(x.r.source in M.SOURCES));
  check('every rate cites a source key that exists in SOURCES',
    f(rateNoSource.length === 0, rateNoSource.length > 0),
    rateNoSource.length ? rateNoSource.map(x => `${x.m}:${x.r.source}`).join(', ') : `${rWithValue.length} resolved`);
  // The specific trap: a microbial number sitting on a eukaryotic machine must say so out loud.
  const polII = M.MACHINES.find(m => m.id === 'rna_polymerase_II');
  const bact = polII.copies_per_cell.find(c => typeof c.value === 'number');
  check('the bacterial polymerase count on the Pol II entry is flagged as NOT a Pol II number',
    f(/NOT POL II|not a Pol II number/i.test(bact.caveat ?? ''), false),
    (bact.caveat ?? '').slice(0, 60));
}

// ------------------------------------------------------------------ 2. the asymmetric unit gate
console.log('\nthe asymmetric unit gate');
{
  const V = M.STRUCTURES_VERIFIED;
  // Every entry whose chain counts are both known must have them recorded, so the gate is auditable.
  const known = Object.entries(V).filter(([, v]) => typeof v.deposited_polymer_chains === 'number' && typeof v.assembly1_polymer_chains === 'number');
  check('chain counts are recorded for the structures the envelopes come from',
    f(known.length >= 11, known.length < 11), `${known.length} entries carry both counts`);
  const differ = known.filter(([, v]) => v.deposited_polymer_chains !== v.assembly1_polymer_chains).map(([k]) => k);
  const agree = known.filter(([, v]) => v.deposited_polymer_chains === v.assembly1_polymer_chains).map(([k]) => k);
  check('the asymmetric-unit depositions are identified, and there is more than one of them',
    f(differ.length === 2 && differ.includes('7R5J') && differ.includes('7TBL'), differ.length !== 2),
    `differ: [${differ.join(', ')}]  agree: ${agree.length}`);
  // The gate is not "expand everything"; it is "expand what you measure". The second asymmetric-unit
  // deposition is carried for contrast and no envelope is taken from it, which must also be true in the
  // data rather than only in a note.
  const cited7tbl = M.MACHINES.filter(m => (m.dimensions_nm?.from ?? '').includes('7TBL')).map(m => m.id);
  check('no envelope is measured from the second asymmetric-unit deposition at all',
    f(cited7tbl.length === 0, cited7tbl.length > 0),
    cited7tbl.length ? cited7tbl.join(', ') : 'none measured from 7TBL');
  check('and the file says out loud that the constricted state therefore has no geometry',
    f(/no geometry/.test(V['7TBL'].note), false), V['7TBL'].note.slice(-60));
  // Direction A: the one that differs must say it used the EXPANDED assembly.
  const npc = M.MACHINES.find(m => m.id === 'nuclear_pore_complex');
  check('the asymmetric-unit structure\'s envelope declares that it used the expanded assembly',
    f(/EXPANDED BIOLOGICAL ASSEMBLY/.test(npc.dimensions_nm.from), false),
    npc.dimensions_nm.from.slice(0, 70));
  check('its atom count is the expanded one, not the deposited one',
    f(npc.dimensions_nm.atoms_measured > 4_000_000, npc.dimensions_nm.atoms_measured < 1_000_000),
    `${npc.dimensions_nm.atoms_measured} atoms`);
  check('the one-eighth spoke measurement is retained and labelled as one eighth',
    f(/one eighth/.test(npc.dimensions_nm.spoke_note) && Array.isArray(npc.dimensions_nm.principal_extents_of_one_spoke_nm), false));
  // Direction B: the others must NOT claim an expansion. Asserting only direction A would pass for a
  // module that claimed every envelope came from an expanded assembly.
  const others = M.MACHINES.filter(m => m.id !== 'nuclear_pore_complex' && m.dimensions_nm?.from);
  const falseClaims = others.filter(m => /EXPANDED BIOLOGICAL ASSEMBLY|assembly1/i.test(m.dimensions_nm.from)).map(m => m.id);
  check('no other envelope claims an assembly expansion it did not need',
    f(falseClaims.length === 0, falseClaims.length > 0),
    falseClaims.length ? falseClaims.join(', ') : `${others.length} checked`);
  check('every other envelope states that its deposited and assembly chain counts agree',
    f(others.every(m => /deposited chains \d+ = assembly 1 chains \d+|deposited chains \d+ = assembly ?1? ?chains/.test(m.dimensions_nm.from)), false),
    others.filter(m => !/= assembly/.test(m.dimensions_nm.from)).map(m => m.id).join(', ') || 'all state it');
  // And the recorded lesson itself.
  const t = M.THE_ASYMMETRIC_UNIT_TRAP;
  check('the trap is recorded with what happened, why it was wrong, and how it was caught',
    f(['what_happened', 'why_it_was_wrong', 'why_it_was_plausible', 'how_it_was_caught', 'the_corrected_measurement', 'the_general_lesson', 'what_changed_in_the_code'].every(k => typeof t[k] === 'string' && t[k].length > 80), false));
  check('the trap states the general rule in the imperative, not as an anecdote',
    f(/DEPOSITED COORDINATE FILE IS NOT THE BIOLOGICAL OBJECT/.test(t.the_general_lesson), false));
  check('the trap does not claim the measurement caught its own error',
    f(/Not by looking at the number/.test(t.how_it_was_caught), false));
}

// ------------------------------------------------------------------ 3. nulls are nulls
console.log('\nnulls carry reasons and are not placeholders');
{
  // Walk the whole export tree for anything that looks like an unretrieved value.
  const nulls = [];
  const walk = (node, p) => {
    if (!node || typeof node !== 'object') return;
    if (Object.hasOwn(node, 'null_reason')) nulls.push({ path: p, node });
    for (const [k, v] of Object.entries(node)) walk(v, `${p}.${k}`);
  };
  walk({ MACHINES: M.MACHINES, DISAGREEMENTS: M.DISAGREEMENTS }, '');
  check('there are unretrieved values, recorded rather than filled in',
    f(nulls.length >= 8, nulls.length === 0), `${nulls.length} nulls with reasons`);
  const notNull = nulls.filter(x => x.node.value !== null);
  check('every unretrieved value is exactly null, never 0 and never a string',
    f(notNull.length === 0, notNull.length > 0),
    notNull.length ? notNull.map(x => `${x.path}=${JSON.stringify(x.node.value)}`).join(', ') : `${nulls.length} checked`);
  const badReason = nulls.filter(x => typeof x.node.null_reason !== 'string' || x.node.null_reason.length < 30 || /^TODO|^tbd|^\?+$/i.test(x.node.null_reason));
  check('every null carries a substantive reason, not a placeholder',
    f(badReason.length === 0, badReason.length > 0),
    badReason.length ? badReason.map(x => x.path).join(', ') : `${nulls.length} checked`);
  const badResolve = nulls.filter(x => typeof x.node.what_would_resolve_it !== 'string' || x.node.what_would_resolve_it.length < 30);
  check('every null says what would resolve it',
    f(badResolve.length === 0, badResolve.length > 0),
    badResolve.length ? badResolve.map(x => x.path).join(', ') : `${nulls.length} checked`);
  const noUnits = nulls.filter(x => typeof x.node.units !== 'string' || x.node.units.length < 3);
  check('every null still names the units it would have had',
    f(noUnits.length === 0, noUnits.length > 0));
  // This is WHY the shape is an object with value:null rather than a bare null. A bare null coerces:
  // null * 2 is 0, so a downstream sum over unretrieved values returns a plausible 0 and nobody notices.
  // The container coerces to NaN instead, which propagates and is visible. The first version of this
  // assertion compared `sample.value * 2` and survived its own fault, because it was really only
  // re-checking that value === null, which the line above already does.
  const sample = nulls[0].node;
  check('the null CONTAINER coerces to NaN, so a sum over unretrieved values cannot come out as 0',
    f(Number.isNaN(sample * 2) && sample.value === null, !Number.isNaN(sample * 2)),
    `container*2 = ${sample * 2}; a bare null would have given ${null * 2}`);
  // And the positive half: at least one machine must have NO retrieved count, because pretending
  // otherwise is what this discipline exists to prevent.
  const noCount = M.MACHINES.filter(m => !(m.copies_per_cell ?? []).some(c => typeof c.value === 'number'));
  check('machines whose counts could not be sourced are left unsourced rather than guessed',
    f(noCount.length >= 4, noCount.length === 0), `${noCount.length} machines carry no count at all`);
}

// ------------------------------------------------------------------ 4. no fused score
console.log('\nsizeLadder returns lengths and ratios, and nothing fused');
{
  const L = M.sizeLadder();
  check('the ladder names its sort key', f(typeof L.sort_key === 'string' && /max_extent_nm/.test(L.sort_key), false));
  check('the ladder is sorted ascending by that key',
    f(L.rungs.every((r, i) => i === 0 || r.max_extent_nm >= L.rungs[i - 1].max_extent_nm), false),
    L.rungs.map(r => r.max_extent_nm).join(' <= '));
  check('every rung carries the structure its length came from',
    f(L.rungs.every(r => typeof r.structure === 'string' && r.structure in M.STRUCTURES_VERIFIED), false));
  check('every rung but the last carries a ratio to its neighbour',
    f(L.rungs.slice(0, -1).every(r => r.ratio_to_next && typeof r.ratio_to_next.ratio === 'number'), false));
  check('the last rung has no ratio rather than a ratio of 1',
    f(L.rungs[L.rungs.length - 1].ratio_to_next === null, L.rungs[L.rungs.length - 1].ratio_to_next !== null));
  // Every ratio must be reproducible from its own two stated operands: a ratio whose operands are not
  // returned beside it is a number the reader cannot check.
  const badRatio = L.rungs.filter(r => r.ratio_to_next && !near(r.ratio_to_next.next_nm / r.ratio_to_next.this_nm, r.ratio_to_next.ratio, 0.001));
  check('every ratio equals next_nm / this_nm, both of which are returned with it',
    f(badRatio.length === 0, badRatio.length > 0),
    badRatio.length ? badRatio.map(r => r.id).join(', ') : `${L.rungs.length - 1} ratios checked`);
  // The fused-score gate: enumerate numeric leaves and insist each is a length, a ratio, an atom count
  // or a structure-count. Anything else - a "fidelity", a "confidence", a 0-to-1 quality - fails here.
  const numericLeaves = [];
  const walk = (node, p) => {
    if (typeof node === 'number') { numericLeaves.push({ path: p, v: node }); return; }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) walk(v, `${p}.${k}`);
  };
  walk(L, 'ladder');
  const ALLOWED = /(_nm|_nm\.\d+|\.ratio|_mm)$/;
  const disallowed = numericLeaves.filter(x => !ALLOWED.test(x.path));
  check('every number the ladder returns is a nanometre length or a ratio of two of them',
    f(disallowed.length === 0, disallowed.length > 0),
    disallowed.length ? disallowed.slice(0, 4).map(x => `${x.path}=${x.v}`).join(', ') : `${numericLeaves.length} numeric leaves checked`);
  check('the ladder states in its own return that it is not a score',
    f(typeof L.not_a_score === 'string' && /no fused/.test(L.not_a_score), false));
  // No key anywhere in the module may be named like a fused score.
  const src = fs.readFileSync(path.join(here, 'machines.mjs'), 'utf8');
  const scoreKeys = [...src.matchAll(/^\s*(fidelity|confidence_score|quality_score|overall_score|trust_score|accuracy_score)\s*:/gm)].map(m => m[1]);
  check('no exported field is named like a fused score',
    f(scoreKeys.length === 0, scoreKeys.length > 0), scoreKeys.join(', ') || 'none found');
  // The span is arithmetic on two of the rungs, not a summary statistic of all of them.
  check('the span is the ratio of the two extreme measured lengths',
    f(near(L.span.largest_nm / L.span.smallest_nm, L.span.ratio, 0.001), false),
    `${L.span.largest_nm} / ${L.span.smallest_nm} = ${L.span.ratio}`);
  check('the span names both endpoints by id so it cannot be read as a global statistic',
    f(typeof L.span.smallest_id === 'string' && typeof L.span.largest_id === 'string', false));
  // An entry with no measured envelope must be returned separately, not sorted in at a guess.
  check('entries without a measured envelope are returned in `unmeasured`, not placed on the ladder',
    f(Array.isArray(L.unmeasured) && L.rungs.length + L.unmeasured.length === M.MACHINES.length, false),
    `${L.rungs.length} rungs + ${L.unmeasured.length} unmeasured vs ${M.MACHINES.length} machines`);
}

// ------------------------------------------------------------------ 5. accession hygiene
console.log('\naccessions and sources');
{
  const V = M.STRUCTURES_VERIFIED;
  const cited = new Set(M.MACHINES.flatMap(m => [m.structure?.primary, ...(m.structure?.also ?? [])]).filter(Boolean));
  const unknown = [...cited].filter(id => !(id in V));
  check('every accession a machine cites is recorded in STRUCTURES_VERIFIED',
    f(unknown.length === 0, unknown.length > 0), unknown.join(', ') || `${cited.size} accessions`);
  const thin = [...cited].filter(id => {
    const v = V[id];
    return typeof v.title_read_back !== 'string' || typeof v.method !== 'string' || typeof v.resolution_A !== 'number';
  });
  check('every cited accession has a title, a method and a resolution read back from the service',
    f(thin.length === 0, thin.length > 0), thin.join(', ') || `${cited.size} verified`);
  const noOrg = [...cited].filter(id => !Array.isArray(V[id].source_organisms) || V[id].source_organisms.length === 0);
  check('every cited accession records the source organisms the service returned',
    f(noOrg.length === 0, noOrg.length > 0), noOrg.join(', ') || `${cited.size} checked`);
  // Methods must be real experimental methods, not model predictions.
  const methods = new Set([...cited].map(id => V[id].method));
  check('every method read back is an experimental one (X-ray or electron microscopy)',
    f([...methods].every(x => /X-RAY DIFFRACTION|ELECTRON MICROSCOPY/.test(x)), false), [...methods].join(' | '));
  // The rejected accession must be recorded and must not be reachable from any machine.
  check('at least one accession was tried, failed and was recorded rather than dropped',
    f(M.STRUCTURES_REJECTED.length >= 1, M.STRUCTURES_REJECTED.length === 0));
  const rej = M.STRUCTURES_REJECTED[0];
  check('the rejection records the HTTP status the service actually returned',
    f(/404/.test(rej.what_happened), false), rej.what_happened.slice(0, 60));
  const leaked = M.STRUCTURES_REJECTED.filter(r => cited.has(r.id) || (r.id in V));
  check('no rejected accession is cited by a machine or listed as verified',
    f(leaked.length === 0, leaked.length > 0), leaked.map(r => r.id).join(', ') || 'none leaked');
  // Sources: every key must carry a citation and a readback, and every DOI must look like a DOI.
  const srcKeys = Object.keys(M.SOURCES);
  check('SOURCES is populated', f(srcKeys.length >= 15, srcKeys.length < 15), `${srcKeys.length} sources`);
  const noRead = srcKeys.filter(k => typeof M.SOURCES[k].read_back !== 'string' || M.SOURCES[k].read_back.length < 40);
  check('every source records what was actually read back from it, not a paraphrase of its topic',
    f(noRead.length === 0, noRead.length > 0), noRead.join(', ') || `${srcKeys.length} checked`);
  const badDoi = srcKeys.filter(k => { const d = M.SOURCES[k].doi; return d !== null && !/^10\.\d{4,9}\//.test(d); });
  check('every non-null DOI has the shape of a DOI',
    f(badDoi.length === 0, badDoi.length > 0), badDoi.map(k => `${k}:${M.SOURCES[k].doi}`).join(', ') || 'all well formed');
  const badPmid = srcKeys.filter(k => { const p = M.SOURCES[k].pmid; return p !== null && !/^\d{5,9}$/.test(p); });
  check('every non-null PMID is digits only',
    f(badPmid.length === 0, badPmid.length > 0), badPmid.map(k => `${k}:${M.SOURCES[k].pmid}`).join(', ') || 'all well formed');
  // The one source whose PMID the service returned as null must be null, not invented.
  check('a source whose PMID the service did not return is recorded as null, not guessed',
    f(M.SOURCES.yuan_2020_pole.pmid === null, M.SOURCES.yuan_2020_pole.pmid !== null),
    `pmid=${JSON.stringify(M.SOURCES.yuan_2020_pole.pmid)}`);
  check('that source says in its readback that the id came back null',
    f(/NULL PubMed id/i.test(M.SOURCES.yuan_2020_pole.read_back), false));
  // Every source key must be referenced by something, or it is decoration.
  const srcJson = JSON.stringify({ m: M.MACHINES, d: M.DISAGREEMENTS, t: M.TEXTBOOK_ONLY, s: M.STRUCTURES_VERIFIED });
  const orphan = srcKeys.filter(k => !srcJson.includes(`"${k}"`));
  check('every source key is actually cited somewhere',
    f(orphan.length === 0, orphan.length > 0), orphan.join(', ') || `${srcKeys.length} all cited`);
}

// ------------------------------------------------------------------ measurements against independent facts
console.log('\nthe envelopes against things known independently of this code');
{
  // The chaperonin is the size landmark precisely because its symmetry is exact: a sevenfold double ring
  // must measure the same across both cross-axes. If the envelope code were inventing anisotropy - a
  // broken eigenvector routine, say - this is the assertion that would move.
  const groel = M.MACHINES.find(m => m.id === 'chaperonin_groel_groes');
  const [a, b, c] = groel.dimensions_nm.principal_extents_nm;
  check('the sevenfold chaperonin barrel measures equal across both cross-axes',
    f(near(b, c, 0.15), near(b, c * 1.5, 0.15)), `${a} x ${b} x ${c} nm`);
  check('and is longer along its barrel axis than across it', f(a > b * 1.2, a < b));
  // The nuclear pore ring, measured in its own frame, must also come out circular.
  const npc = M.MACHINES.find(m => m.id === 'nuclear_pore_complex');
  const [p, q] = npc.dimensions_nm.bounding_box_nm;
  check('the eightfold pore ring measures equal across both in-plane directions',
    f(near(p, q, 0.2), near(p, q * 1.3, 0.2)), `${p} x ${q} nm in plane`);
  // Every principal extent list must be sorted descending, because ENVELOPE_METHOD says it is.
  const withExtents = M.MACHINES.filter(m => Array.isArray(m.dimensions_nm?.principal_extents_nm));
  const unsorted = withExtents.filter(m => { const e = m.dimensions_nm.principal_extents_nm; return !(e[0] >= e[1] && e[1] >= e[2]); });
  check('principal extents are reported sorted descending, as the method states',
    f(unsorted.length === 0, unsorted.length > 0), unsorted.map(m => m.id).join(', ') || `${withExtents.length} checked`);
  // The maximum atom-pair distance can never be smaller than the largest principal extent. This is a
  // geometric identity, so a violation is an arithmetic bug, not a biological surprise.
  const impossible = withExtents.filter(m => m.dimensions_nm.max_extent_nm < m.dimensions_nm.principal_extents_nm[0] - 1e-9);
  check('the greatest atom-pair distance is never less than the largest principal extent',
    f(impossible.length === 0, impossible.length > 0),
    impossible.map(m => m.id).join(', ') || `${withExtents.length} checked`);
  // Radius of gyration must be well inside half the diameter for any real body.
  const badRg = withExtents.filter(m => { const d = m.dimensions_nm; return !(d.radius_of_gyration_nm > 0 && d.radius_of_gyration_nm < d.max_extent_nm / 2); });
  check('every radius of gyration lies strictly inside half the greatest extent',
    f(badRg.length === 0, badRg.length > 0), badRg.map(m => m.id).join(', ') || `${withExtents.length} checked`);
  // The nucleosome: the DNA wrap and the octamer are read off the deposition, so they must match it.
  const nuc = M.MACHINES.find(m => m.id === 'nucleosome_core_particle');
  check('the nucleosome DNA wrap matches the chain inventory read back from its structure',
    f(nuc.dna_wrapped_bp.value === 147 && /147 nt/.test(M.STRUCTURES_VERIFIED['1KX5'].chain_inventory_read_back), nuc.dna_wrapped_bp.value === 146),
    `${nuc.dna_wrapped_bp.value} bp`);
  check('the other nucleosome structure\'s different wrap is recorded as a different construct, not an error bar',
    f(nuc.dna_wrapped_bp.also.value === 146 && /different constructs/.test(nuc.dna_wrapped_bp.also.note), false));
  check('the histone octamer count is 8 and is said to be read off the deposition',
    f(nuc.histone_stoichiometry.value === 8 && /read off the deposition/.test(nuc.histone_stoichiometry.read_back), nuc.histone_stoichiometry.value === 10));
  // The chaperonin stoichiometry likewise.
  check('the chaperonin stoichiometry is 14 + 7, as the deposition lists it',
    f(groel.subunit_stoichiometry.groEL_chains === 14 && groel.subunit_stoichiometry.groES_chains === 7,
      groel.subunit_stoichiometry.groEL_chains === 7),
    `${groel.subunit_stoichiometry.groEL_chains} + ${groel.subunit_stoichiometry.groES_chains}`);
  check('those chain counts add up to the deposited polymer chain count the service returned',
    f(groel.subunit_stoichiometry.groEL_chains + groel.subunit_stoichiometry.groES_chains === M.STRUCTURES_VERIFIED['1AON'].deposited_polymer_chains, false),
    `14+7 vs ${M.STRUCTURES_VERIFIED['1AON'].deposited_polymer_chains} deposited`);
  // The nucleosome upper bound must be arithmetic on the two numbers stated beside it, and must be a
  // BOUND, i.e. computed from the core wrap with no linker.
  const bound = nuc.copies_per_cell[0].what_is_known;
  check('the nucleosome count upper bound is exactly diploid genome / core wrap',
    f(bound.hard_upper_bound === Math.floor(bound.diploid_genome_bp / nuc.dna_wrapped_bp.value), false),
    `${bound.hard_upper_bound} vs ${Math.floor(bound.diploid_genome_bp / nuc.dna_wrapped_bp.value)}`);
  check('the diploid genome figure is twice the retrieved haploid chromosome sum',
    f(bound.diploid_genome_bp === 2 * 3088286401, bound.diploid_genome_bp === 3088286401),
    `${bound.diploid_genome_bp}`);
  check('the bound is labelled a strict upper bound and warned against being read as a count',
    f(/strict upper bound/.test(bound.hard_upper_bound_note) && /must not be read as one/.test(bound.hard_upper_bound_note), false));
  check('the nucleosome count itself is still a null, because the repeat length was not retrieved',
    f(nuc.copies_per_cell[0].value === null, nuc.copies_per_cell[0].value === bound.hard_upper_bound));
}

// ------------------------------------------------------------------ disagreements kept as disagreements
console.log('\ndisagreements, kept rather than averaged');
{
  const D = M.DISAGREEMENTS;
  check('disagreements are recorded', f(D.length >= 4, D.length === 0), `${D.length} recorded`);
  check('every disagreement carries at least two values',
    f(D.every(d => Array.isArray(d.values) && d.values.length >= 2), false),
    D.filter(d => (d.values ?? []).length < 2).map(d => d.quantity).join(', ') || 'all do');
  check('every disagreement says why it was not averaged, or why it was recorded',
    f(D.every(d => typeof (d.why_not_averaged ?? d.why_recorded) === 'string' && (d.why_not_averaged ?? d.why_recorded).length > 60), false));
  check('every disagreement says what would resolve it, even when the answer is nothing',
    f(D.every(d => typeof d.what_would_resolve_it === 'string' && d.what_would_resolve_it.length > 20), false));
  // The threefold ribosome spread is the headline one, and both of its numbers must be present with the
  // earlier one flagged second-hand.
  const ribo = D.find(d => /ribosomes per cell/.test(d.quantity));
  const vals = ribo.values.map(v => v.value).sort((x, y) => x - y);
  check('the threefold ribosome disagreement carries both numbers, not their mean',
    f(vals[0] === 18000 && vals[1] === 55000, vals.includes(36500)), `[${vals.join(', ')}]`);
  // 36500 is the mean of 18000 and 55000. The fault substitutes a string that IS present, so the
  // predicate is exercised rather than merely asserted.
  const forbidden = f('36500', '55000');
  check('and the mean of the two appears nowhere in the disagreement',
    !JSON.stringify(ribo).includes(forbidden), `searched for "${forbidden}"`);
  check('the second-hand number is flagged as second-hand',
    f(/second_hand_warning/.test(JSON.stringify(Object.keys(ribo))) && /NOT retrieved from its own publication/i.test(ribo.second_hand_warning), false));
  // The same flag must appear wherever that number is reused in MACHINES.
  const r70 = M.MACHINES.find(m => m.id === 'ribosome_70S');
  const old = r70.copies_per_cell.find(c => c.value === 18000);
  check('the second-hand count is flagged again where it is reused on the machine entry',
    f(/SECOND-HAND/i.test(old.caveat), false), old.caveat.slice(0, 50));
  // The agreeing pair must be present too: recording only the disagreements would mislead.
  const agree = D.find(d => /15%/.test(d.spread ?? ''));
  check('a case where two methods AGREE is recorded alongside the disagreements',
    f(agree !== undefined && /BECAUSE it is small/.test(agree.why_recorded), agree === undefined));
  // The pore diameter disagreement must keep the unsourced side as a null rather than cite a number.
  const dia = D.find(d => /outer diameter/.test(d.quantity));
  check('the unsourced side of the pore-diameter disagreement is a null, not an invented rival number',
    f(dia.values.some(v => v.value === null) && dia.values.some(v => v.value === 159.7), dia.values.every(v => typeof v.value === 'number')),
    dia.values.map(v => String(v.value)).join(' vs '));
  // Textbook-only figures: each must say what is asserted instead.
  check('textbook-only figures are listed and each says what is asserted in its place',
    f(M.TEXTBOOK_ONLY.length >= 3 && M.TEXTBOOK_ONLY.every(t => /NOT RETRIEVED/.test(t.status) && typeof t.what_is_asserted_instead === 'string' && t.what_is_asserted_instead.length > 40), false),
    `${M.TEXTBOOK_ONLY.length} refused`);
  // And none of the refused numbers may be smuggled into MACHINES as a value.
  const machinesJson = JSON.stringify(M.MACHINES);
  const smuggled = [/"value":\s*10000000\b/, /"value":\s*200\s*,[^}]*repeat/i].filter(re => re.test(machinesJson));
  check('no refused textbook figure appears as a value in MACHINES',
    f(smuggled.length === 0, smuggled.length > 0), `${smuggled.length} smuggled`);
}

// ------------------------------------------------------------------ what a depiction cannot show
console.log('\nwhat a depiction cannot show');
{
  const W = M.WHAT_A_DEPICTION_CANNOT_SHOW;
  const required = ['it_is_not_a_static_object', 'the_surface_is_a_threshold_not_a_boundary', 'what_is_modelled_is_not_what_is_there', 'it_diffuses', 'it_is_crowded', 'the_positions_are_invented', 'rates_are_averages_over_populations', 'one_organism_is_not_another'];
  const missing = required.filter(k => typeof W[k] !== 'string' || W[k].length < 150);
  check('all the required points are present and are prose, not slogans',
    f(missing.length === 0, missing.length > 0), missing.join(', ') || `${required.length} points`);
  check('it says the drawn surface is a chosen density threshold, not a boundary',
    f(/isosurface|ISOSURFACE/.test(W.the_surface_is_a_threshold_not_a_boundary) && /line in nature where the molecule stops/.test(W.the_surface_is_a_threshold_not_a_boundary), false));
  check('it says the positions are invented, in those terms',
    f(/invented|generated/.test(W.the_positions_are_invented) && /no measurement/i.test(W.the_positions_are_invented), false));
  check('it names the pore\'s missing disordered mass as the concrete case of what is not modelled',
    f(/70 of about 120 MDa|50 MDa/.test(W.what_is_modelled_is_not_what_is_there), false));
  check('the crowding point uses a count from this file rather than an adjective',
    f(/55,000/.test(W.it_is_crowded), false));
  check('the diffusion point cites a measured coefficient from a source in SOURCES',
    f(/0\.04 square micrometres per second/.test(W.it_diffuses) && /Bakshi/.test(W.it_diffuses), false));
  check('the headline admits this applies to this viewer too, not only to other people\'s figures',
    f(/including this one/.test(W.headline), false));
  check('known limitations name the nulls, the surface offset and the cross-organism mixing',
    f(M.KNOWN_LIMITATIONS.some(l => /nulls with reasons/.test(l)) &&
      M.KNOWN_LIMITATIONS.some(l => /molecular surfaces/.test(l)) &&
      M.KNOWN_LIMITATIONS.some(l => /composite across organisms/.test(l)), false),
    `${M.KNOWN_LIMITATIONS.length} limitations`);
}

// ------------------------------------------------------------------ freezing and provenance of the method
console.log('\nfreezing and method');
{
  const frozen = ['MACHINES', 'SOURCES', 'STRUCTURES_VERIFIED', 'STRUCTURES_REJECTED', 'ENVELOPE_METHOD', 'DISAGREEMENTS', 'TEXTBOOK_ONLY', 'WHAT_A_DEPICTION_CANNOT_SHOW', 'KNOWN_LIMITATIONS', 'THE_ASYMMETRIC_UNIT_TRAP', 'SERVICES_CALLED'];
  const notFrozen = frozen.filter(k => !Object.isFrozen(M[k]));
  check('every exported constant is frozen', f(notFrozen.length === 0, notFrozen.length > 0), notFrozen.join(', ') || `${frozen.length} frozen`);
  // Deep, not shallow: a frozen array of mutable objects is not frozen.
  check('the freeze is deep, not shallow',
    f(Object.isFrozen(M.MACHINES[0]) && Object.isFrozen(M.MACHINES[0].dimensions_nm), false));
  let threw = false;
  try { 'use strict'; M.MACHINES[0].dimensions_nm.max_extent_nm = 999; } catch { threw = true; }
  check('a write to a nested measurement does not take effect',
    f(M.MACHINES[0].dimensions_nm.max_extent_nm !== 999, M.MACHINES[0].dimensions_nm.max_extent_nm === 999),
    threw ? 'it threw' : `value is still ${M.MACHINES[0].dimensions_nm.max_extent_nm}`);
  check('the envelope method states the assembly precondition that the trap taught',
    f(/assembly1_polymer_chains differs from deposited_polymer_chains/.test(M.ENVELOPE_METHOD.assembly_rule), false));
  check('the envelope method says what the envelope is NOT',
    f(/not a molecular surface/i.test(M.ENVELOPE_METHOD.what_this_is_not) && /MODELLED ATOMS/.test(M.ENVELOPE_METHOD.what_this_is_not), false));
  check('the services actually called are recorded as repeatable URL templates',
    f(/data\.rcsb\.org\/rest\/v1\/core\/entry/.test(M.SERVICES_CALLED.rcsb_entry) && /rest\.uniprot\.org/.test(M.SERVICES_CALLED.uniprot), false));
  check('the retrieval date is recorded', f(/^\d{4}-\d{2}-\d{2}$/.test(M.RETRIEVED_ON), !/^\d{4}/.test(M.RETRIEVED_ON)));
  check('worked() runs and prints the ladder, the nulls and the refusals',
    f((() => { const w = M.worked(); return /SIZE LADDER/.test(w) && /NOT RETRIEVED/.test(w) && /FIGURES REFUSED/.test(w); })(), false));
}

// ------------------------------------------------------------------ 6. the holdout
console.log('\nthe holdout');
{
  // Read the SAME source the project's own leak checker reads (holdout/split.json, assignment "holdout"),
  // rather than a path guessed here, and build the patterns from it at runtime.
  const splitPath = path.join(root, 'holdout/split.json');
  let terms = [], loadedFrom = null, loadError = null;
  try {
    const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    terms = (split.taxa ?? []).filter(t => t.assignment === 'holdout')
      .flatMap(t => [t.name, t.slug, t.latin, t.scientific_name, t.common_name, t.taxon].filter(x => typeof x === 'string'))
      .map(s => s.toLowerCase());
    loadedFrom = 'holdout/split.json (assignment === "holdout")';
  } catch (e) { loadError = String(e.message).slice(0, 90); }

  const src = (fs.readFileSync(path.join(here, 'machines.mjs'), 'utf8') +
    fs.readFileSync(path.join(here, 'test-machines.mjs'), 'utf8')).toLowerCase();
  const hits = [...new Set(terms)].filter(t => t.length > 4 && src.includes(t));
  check('the held-out roster was read from the project\'s own split file',
    f(terms.length > 20, terms.length === 0), loadedFrom ? `${terms.length} names from ${loadedFrom}` : `could not load: ${loadError}`);
  check('no held-out taxon name appears in this module or its test',
    f(hits.length === 0 && terms.length > 20, false),
    hits.length ? `${hits.length} hit(s): ${hits.slice(0, 3).join(', ')}` : `${new Set(terms).size} names checked`);
  // And the authority itself, not our reimplementation of it.
  const { spawnSync } = await import('node:child_process');
  const gate = spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), 'sim-engine/scales/molecular'], { cwd: root, encoding: 'utf8' });
  check('the project leak gate passes on this directory', f(gate.status === 0, gate.status !== 0),
    (gate.stdout ?? '').trim().split('\n').pop() ?? `exit ${gate.status}`);
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion should have failed)' : ''}`);
if (FAULT) {
  console.log(fail === pass + fail
    ? `all ${fail} assertions failed under their own fault: no survivors`
    : `SURVIVORS: ${pass} assertion(s) still passed with a fault injected - those assert nothing`);
}
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
