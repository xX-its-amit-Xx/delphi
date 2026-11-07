#!/usr/bin/env node
// Tests for dynamics.mjs
//
//   node sim-engine/scales/molecular/test-dynamics.mjs [--fail-once]
//
// This module's output is a table of numbers that will end up printed next to a moving picture, where
// nobody can check them. So the tests are weighted towards the ways a table like that goes bad rather
// than towards coverage of the arithmetic.
//
//   1. THE ARITHMETIC IS INVERTIBLE. replicationTime and originsNeeded must be exact inverses, and
//      realTimeFactor's factor must satisfy its own definition. A derived figure that cannot be
//      round-tripped is a figure nobody can audit.
//
//   2. NOTHING IS AVERAGED. Where the sources disagree, the range endpoints must BE the extreme
//      measurements, and the disagreeing entry must carry no single `value` at all. This is asserted
//      directly, because the easiest way for a later edit to ruin this file is to add a tidy mean.
//
//   3. THE INEQUALITY IS ASSERTED AT ITS WEAKEST END. The one-origin argument is computed with the
//      fastest fork and the longest S phase - the pairing most favourable to one origin. The test
//      re-derives it with the unfavourable pairing and checks the published ratio is the SMALLER one,
//      so the argument cannot have been inflated by a choice of endpoint.
//
//   4. EVERY NULL CARRIES A REASON. A recursive walk finds every `value: null` anywhere in the exports
//      and requires a `null_reason` and a `what_would_resolve_it` beside it. A null without a reason is
//      worse than a wrong number, because it looks like diligence.
//
//   5. EVERY SOURCE KEY RESOLVES, AND EVERY SOURCE WAS RETRIEVED. Each `source` in the data must name a
//      real entry in CITATIONS, and each CITATIONS entry must carry a `how` that describes a retrieval.
//      A citation with no retrieval is how a fabricated DOI gets in.
//
//   6. THE HOLDOUT. One clade is a frozen evaluation holdout. The test reads the project's own roster
//      from holdout/split.json rather than carrying any name here, and also runs the project's own leak
//      gate against this directory.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own inversion asserts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './dynamics.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

/** Every node in the exported data, with its path, so structural rules can be checked everywhere. */
function walk(node, atPath, out) {
  if (node && typeof node === 'object') {
    out.push([atPath, node]);
    for (const [k, v] of Object.entries(node)) walk(v, `${atPath}.${k}`, out);
  }
  return out;
}
const EXPORTED = [
  ['RATES', D.RATES], ['DURATIONS', D.DURATIONS], ['THE_ORIGIN_ARGUMENT', D.THE_ORIGIN_ARGUMENT],
  ['ANIMATION_HONESTY', D.ANIMATION_HONESTY], ['NUMBERS_WE_DECLINED', D.NUMBERS_WE_DECLINED], ['GENOME', D.GENOME],
];
const ALL_NODES = EXPORTED.flatMap(([n, o]) => walk(o, n, []));

// ------------------------------------------------------------------ 1. units and invertible arithmetic
console.log('\nunits');
{
  check('1.8 kb/min is exactly 30 bp/s', near(D.kbPerMinToBpPerS(f(1.8, 1.9)), 30, 1e-12),
    `got ${D.kbPerMinToBpPerS(1.8)}`);
  check('the conversion round-trips', f(near(D.bpPerSToKbPerMin(D.kbPerMinToBpPerS(1.7)), 1.7, 1e-12), false),
    `${D.bpPerSToKbPerMin(D.kbPerMinToBpPerS(1.7))}`);
  let threw = false; try { D.kbPerMinToBpPerS('fast'); } catch { threw = true; }
  check('a non-numeric rate is refused rather than producing NaN downstream', f(threw, !threw));
  check('a year is stated as the Julian year, not left ambiguous',
    near(D.SECONDS_PER_YEAR, f(365.25, 365) * 86400, 1e-9), `${D.SECONDS_PER_YEAR}`);
}

console.log('\nreplicationTime');
{
  const chr1 = D.GENOME.chromosome_1_bp;
  const r1 = D.replicationTime({ genome_bp: chr1, fork_rate_bp_s: 30, origins: 1 });
  check('one origin gives two forks', f(r1.forks === 2, r1.forks === 1), `forks ${r1.forks}`);
  check('the DNA is divided equally among the forks', near(r1.bp_per_fork, f(chr1 / 2, chr1), 1e-9));
  check('chromosome 1 from one origin at 30 bp/s takes chr1/60 seconds',
    near(r1.seconds, f(chr1 / 60, chr1 / 30), 1e-6), `${r1.seconds.toFixed(1)} s`);
  check('the hour, day and year conversions are consistent with the seconds',
    f(near(r1.hours, r1.seconds / 3600, 1e-9) && near(r1.days, r1.seconds / 86400, 1e-9) && near(r1.years, r1.seconds / D.SECONDS_PER_YEAR, 1e-9), false));
  const r10 = D.replicationTime({ genome_bp: chr1, fork_rate_bp_s: 30, origins: 10 });
  check('ten origins take exactly one tenth as long', near(r10.seconds * f(10, 11), r1.seconds, 1e-6),
    `${r1.seconds.toFixed(0)} vs ${r10.seconds.toFixed(0)}`);
  const rFast = D.replicationTime({ genome_bp: chr1, fork_rate_bp_s: 60, origins: 1 });
  check('doubling the fork rate halves the time', near(rFast.seconds * f(2, 3), r1.seconds, 1e-6));
  check('the result says it is a lower bound rather than an estimate', f(r1.is_a_lower_bound === true, r1.is_a_lower_bound !== true));
  check('the assumptions that make it a lower bound are listed, including simultaneous firing',
    f(Array.isArray(r1.assumptions) && r1.assumptions.length >= 4 && r1.assumptions.some(a => /simultaneous/i.test(a)), false),
    `${r1.assumptions?.length} assumptions`);
  for (const [label, args] of [
    ['zero origins', { genome_bp: 1e6, fork_rate_bp_s: 30, origins: 0 }],
    ['a fractional origin count', { genome_bp: 1e6, fork_rate_bp_s: 30, origins: 1.5 }],
    ['a zero-length genome', { genome_bp: 0, fork_rate_bp_s: 30, origins: 1 }],
    ['a negative fork rate', { genome_bp: 1e6, fork_rate_bp_s: -30, origins: 1 }],
  ]) {
    let t = false; try { D.replicationTime(args); } catch { t = true; }
    check(`${label} is refused rather than returning Infinity or a negative time`, f(t, !t));
  }
}

console.log('\noriginsNeeded is the exact inverse');
{
  const chr1 = D.GENOME.chromosome_1_bp;
  for (const k of [1, 7, 115, 4096]) {
    const t = D.replicationTime({ genome_bp: chr1, fork_rate_bp_s: 28.333333333333332, origins: k });
    const back = D.originsNeeded({ genome_bp: chr1, fork_rate_bp_s: 28.333333333333332, seconds: t.seconds });
    check(`origins ${k} survives a round trip through time and back`, near(back.exact, f(k, k + 1), 1e-6),
      `got ${back.exact}`);
  }
  const frac = D.originsNeeded({ genome_bp: 1000, fork_rate_bp_s: 10, seconds: 7 });
  check('a fractional origin requirement is rounded UP, since a part of an origin cannot fire',
    f(frac.integer === Math.ceil(frac.exact) && frac.integer > frac.exact, false),
    `exact ${frac.exact.toFixed(4)} -> ${frac.integer}`);
  check('the origin requirement says it is a floor', f(frac.is_a_floor === true, frac.is_a_floor !== true));
  let threw = false; try { D.originsNeeded({ genome_bp: 1e6, fork_rate_bp_s: 30, seconds: 0 }); } catch { threw = true; }
  check('a zero time budget is refused rather than returning Infinity origins', f(threw, !threw));
}

// ------------------------------------------------------------------ 3. the inequality, at its weakest
console.log('\nthe one-origin constraint');
{
  const t = D.THE_ORIGIN_ARGUMENT;
  const G = D.GENOME.nuclear_haploid_bp, C = D.GENOME.chromosome_1_bp;
  const forkHi = D.kbPerMinToBpPerS(D.RATES.replication_fork_mammal.range.hi);
  const forkLo = D.kbPerMinToBpPerS(D.RATES.replication_fork_mammal.range.lo);
  const sLong = D.DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.hi * 3600;
  const sShort = D.DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.lo * 3600;

  const published = t.the_inequality.one_origin_whole_genome_over_longest_S;
  const recomputed = D.replicationTime({ genome_bp: G, fork_rate_bp_s: forkHi, origins: 1 }).seconds / sLong;
  check('the published genome-wide ratio is reproducible from the stated inputs',
    near(published, f(recomputed, recomputed * 2), 1e-6), `published ${published.toFixed(2)}, recomputed ${recomputed.toFixed(2)}`);

  const unfavourable = D.replicationTime({ genome_bp: G, fork_rate_bp_s: forkLo, origins: 1 }).seconds / sShort;
  check('the published ratio is the SMALLEST defensible one, not the most dramatic',
    f(published < unfavourable, published > unfavourable),
    `favourable pairing ${published.toFixed(0)}x, unfavourable ${unfavourable.toFixed(0)}x`);

  // The finding is the inequality. Asserted as an inequality, with a wide margin, not as a round number.
  check('one origin cannot replicate the genome within any observed S phase', f(published > 100, published < 1));
  check('one origin cannot replicate even chromosome 1 within any observed S phase',
    f(t.the_inequality.one_origin_chromosome_1_over_longest_S > 10, t.the_inequality.one_origin_chromosome_1_over_longest_S < 1),
    `${t.the_inequality.one_origin_chromosome_1_over_longest_S.toFixed(1)}x`);
  check('chromosome 1 alone is a weaker constraint than the whole genome, as it must be',
    f(t.the_inequality.one_origin_chromosome_1_over_longest_S < published, false));
  check('the result is labelled as an inequality rather than a quotient',
    f(/inequality/i.test(t.the_inequality.asserted_as), false));

  const floor = t.floor_on_the_origin_count.genome_wide;
  check('the origin floor is reproducible from the stated inputs',
    near(floor.exact, f(G / (2 * forkHi * sLong), G / (forkHi * sLong)), 1e-6), `${floor.exact.toFixed(2)}`);
  check('the floor is three orders of magnitude above one origin', f(floor.integer > 1000, floor.integer < 2));
  // And the honest half: the floor does NOT reach the figure usually quoted, and the module says so
  // instead of quietly reporting the quoted figure as though the arithmetic had produced it.
  check('the floor is well below the tens of thousands usually quoted, and is labelled a floor',
    f(floor.integer < 20000 && floor.is_a_floor === true, false), `floor ${floor.integer}`);
  check('the real origin count is explicitly declined rather than asserted',
    f(D.NUMBERS_WE_DECLINED.origins_fired_per_human_s_phase.value === null, D.NUMBERS_WE_DECLINED.origins_fired_per_human_s_phase?.value === 50000));
  check('the floor block names why a cell needs more origins than the floor',
    f(/throughout S|terminate/i.test(t.floor_on_the_origin_count.what_it_is_not), false));

  // The circularity is named rather than hidden: the fork rate was inferred assuming a 10 h S phase.
  check('the shared assumption between the two inputs is disclosed',
    f(/circular/i.test(Object.keys(t.inputs.observed_S_phase_s).join(',')) && /10 h/.test(t.inputs.observed_S_phase_s.circularity_warning), false));
  check('the whole-genome figure admits a genome is not one molecule',
    f(/not one molecule/i.test(t.whole_genome_one_origin.caveat), false));
  check('the per-chromosome version is flagged as the physically possible one',
    f(/one DNA molecule/i.test(t.chromosome_1_one_origin.why_this_is_the_fair_version), false));
  check('every input to the argument carries a source and a verified_how',
    f(Object.values(t.inputs).every(i => typeof i.source === 'string' && typeof i.verified_how === 'string' && i.verified_how.length > 60), false));
}

// ------------------------------------------------------------------ the retrieved assembly figures
console.log('\nthe assembly figures');
{
  const g = D.GENOME;
  check('chromosome 1 is the length Ensembl returned for GRCh38.p14', f(g.chromosome_1_bp === 248956422, g.chromosome_1_bp === 249250621),
    `${g.chromosome_1_bp}`);
  check('the haploid sum is the one computed from the retrieved chromosome lengths', f(g.nuclear_haploid_bp === 3088269832, g.nuclear_haploid_bp === 3200000000));
  check('the mitochondrial sequence is recorded separately from the nuclear sum',
    f(g.mitochondrial_bp === 16569 && g.nuclear_haploid_bp > g.mitochondrial_bp * 1000, false));
  check('chromosome 1 is a fraction of the haploid sum, not larger than it', f(g.chromosome_1_bp < g.nuclear_haploid_bp, g.chromosome_1_bp > g.nuclear_haploid_bp));
  check('the assembly accession is recorded, not just the assembly name',
    f(/^GCA_\d{9}\.\d+$/.test(g.accession), false), g.accession);
  check('the figures are labelled as an assembly, not as the DNA content of a cell',
    f(g.caveats.some(c => /not the DNA content of a cell/i.test(c)), false));
}

// ------------------------------------------------------------------ 2. nothing is averaged
console.log('\nthe disagreement is kept, not averaged');
{
  const p = D.RATES.transcription_pol2_mammal;
  check('the disagreeing entry carries NO single headline value',
    f(!Object.hasOwn(p, 'value'), Object.hasOwn(p, 'value')),
    Object.hasOwn(p, 'value') ? `it has value ${p.value}` : 'no value key');
  check('it states that methods disagree', f(typeof p.disagreement === 'string' && /differ/i.test(p.disagreement), false));
  check('at least four independent measurements are recorded', f(p.measurements.length >= 4, p.measurements.length >= 40),
    `${p.measurements.length} measurements`);
  const vals = p.measurements.map(m => m.value);
  check('the range endpoints ARE the extreme measurements, not a summary of them',
    f(p.range.lo === Math.min(...vals) && p.range.hi === Math.max(...vals), false),
    `range ${p.range.lo}-${p.range.hi}, measurements ${Math.min(...vals)}-${Math.max(...vals)}`);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  check('no endpoint coincides with the mean of the measurements',
    f(!near(p.range.lo, mean, 1e-9) && !near(p.range.hi, mean, 1e-9), false), `mean would be ${mean.toFixed(3)}`);
  check('the range in bp/s is the conversion of the range in kb/min, not an independent number',
    f(near(p.range_bp_s.lo, D.kbPerMinToBpPerS(p.range.lo), 1e-12) && near(p.range_bp_s.hi, D.kbPerMinToBpPerS(p.range.hi), 1e-12), false));
  check('each measurement names its own organism, cell type, method and source',
    f(p.measurements.every(m => m.organism && m.cell_type && m.method && m.source), false));
  check('the within-gene acceleration is recorded, so a constant animation speed is known to be wrong',
    f(/ACCELERATES|accelerat/i.test(p.structural_finding), false));
  check('the reporter-array measurement carries its own caveat about not being an endogenous gene',
    f(p.measurements.some(m => m.value === 4.3 && /reporter array/i.test(m.caveat ?? '')), false));
  check('the no-averaging rule is stated as a rule with a worked example',
    f(/Never average/i.test(D.WHY_NOT_AVERAGED.rule) && D.WHY_NOT_AVERAGED.worked_example.length > 100, false));

  const tb = D.RATES.translation_bacteria;
  const bvals = tb.measurements.map(m => m.value);
  check('the bacterial translation range is also its own extremes',
    f(tb.range.lo === Math.min(...bvals) && tb.range.hi === Math.max(...bvals), false), `${tb.range.lo}-${tb.range.hi}`);
  check('every bacterial translation row records its growth state, since the rate depends on it',
    f(tb.measurements.every(m => typeof m.growth_state === 'string' && m.growth_state.length > 3), false));
}

// ------------------------------------------------------------------ organism discipline
console.log('\norganism discipline');
{
  const r = D.RATES;
  check('the bacterial block is marked as a different organism rather than merged',
    f(/DIFFERENT ORGANISM/.test(r.bacterial_contrast_note), false));
  for (const k of ['replication_fork_bacteria', 'transcription_bacteria', 'translation_bacteria']) {
    check(`${k} names a microbe and not a mammal`,
      f(/Escherichia coli/.test(r[k].organism) && !/human|mouse/i.test(r[k].organism), /human/i.test(r[k].organism)),
      r[k].organism);
  }
  check('the mammalian translation rate names the exact cell line it was measured in',
    f(/E14/.test(D.RATES.translation_mammal.cell_type), false), D.RATES.translation_mammal.cell_type);
  check('the mammalian translation rate is the measured 5.6 aa/s, not the ~6 used in prose',
    f(D.RATES.translation_mammal.value === 5.6, D.RATES.translation_mammal.value === 6),
    `${D.RATES.translation_mammal.value}`);
  check('the prose rounding is recorded as a caveat so the two cannot be stacked as separate evidence',
    f(D.RATES.translation_mammal.caveats.some(c => /6 codons per second/.test(c)), false));
  check('the bacterial fork value sits inside the observed range reported with it',
    f(D.RATES.replication_fork_bacteria.value >= D.RATES.replication_fork_bacteria.observed_range.lo &&
      D.RATES.replication_fork_bacteria.value <= D.RATES.replication_fork_bacteria.observed_range.hi, false),
    `${D.RATES.replication_fork_bacteria.value} in ${D.RATES.replication_fork_bacteria.observed_range.lo}-${D.RATES.replication_fork_bacteria.observed_range.hi}`);
  check('the bacterial fork carries its uncertainty as a SEM rather than as a bare number',
    f(D.RATES.replication_fork_bacteria.uncertainty.sem === 9, D.RATES.replication_fork_bacteria.uncertainty?.sem === 0));
  const contrast = D.RATES.replication_fork_bacteria.value / D.kbPerMinToBpPerS(D.RATES.replication_fork_mammal.range.hi);
  check('the stated bacterial-to-mammalian fork contrast is arithmetically what the two values give',
    f(near(contrast, 21.766666, 1e-4), false), `${contrast.toFixed(2)}x`);
  check('the mammalian fork entry admits the value is inferred from timing slopes, not measured on a fork',
    f(/INFERRED|not a single-molecule/i.test(D.RATES.replication_fork_mammal.method + D.RATES.replication_fork_mammal.caveats.join(' ')), false));
  check('the mammalian fork entry warns that its own 1.8 appears elsewhere as an assumption',
    f(D.RATES.replication_fork_mammal.caveats.some(c => /ASSUME|assumption/i.test(c) && /resolution/i.test(c)), false));
}

// ------------------------------------------------------------------ half-lives, the weakest entries
console.log('\nhalf-lives');
{
  const m = D.RATES.mrna_half_life_mammal, p = D.RATES.protein_half_life_mammal;
  check('the mRNA median is the retrieved 7.1 h in mouse embryonic stem cells',
    f(m.median.value === 7.1 && /mouse/.test(m.organism) && /embryonic stem/.test(m.cell_type), false));
  check('the mRNA entry records how many genes the median is over',
    f(m.n_genes === 19977, m.n_genes === 20000), `${m.n_genes}`);
  check('the mRNA entry says a median over a transcriptome is not any gene\'s half-life',
    f(m.caveats.some(c => /not the half-life of any gene/i.test(c)), false));
  check('the mRNA entry warns that medians differ by dataset and points at the refused one',
    f(/NUMBERS_WE_DECLINED/.test(m.medians_differ_by_dataset), false));
  check('the protein median is null, with a reason and a resolution path',
    f(p.median.value === null && p.median.null_reason.length > 60 && p.median.what_would_resolve_it.length > 40, p.median.value === 46));
  check('the protein entry still reports the measured spread it could retrieve',
    f(p.range.lo === 10 && p.range.hi === 1000 && p.range.hi_is_a_floor === true, false));
  check('the one real median the source does give is recorded with what it is a median OF',
    f(p.one_real_median.value === 111 && /20S proteasome/.test(p.one_real_median.what), false));
  check('the protein entry says cell type changes the answer',
    f(/does not exist/i.test(p.cell_type_matters), false));
  check('the protein entry explains why non-dividing cells were used',
    f(p.caveats.some(c => /dilution by growth/i.test(c)), false));
}

// ------------------------------------------------------------------ durations
console.log('\ndurations');
{
  const c = D.DURATIONS.cultured_mammalian_cell_cycle;
  for (const ph of ['G1', 'S', 'G2']) {
    check(`${ph} is a range with lo <= hi`, f(c.phases[ph].range.lo <= c.phases[ph].range.hi, c.phases[ph].range.lo > c.phases[ph].range.hi),
      `${c.phases[ph].range.lo}-${c.phases[ph].range.hi} h`);
  }
  check('S is the longest phase in this data, which is why the origin argument uses it',
    f(c.phases.S.range.hi > c.phases.G1.range.hi && c.phases.S.range.hi > c.phases.G2.range.hi, false));
  check('M is a single value rather than a fabricated range', f(c.phases.M.value === 0.5 && !c.phases.M.range, false));
  check('the three cell lines the ranges come from are named',
    f(c.cell_lines.length === 3 && c.cell_lines.every(l => /,/.test(l)), c.cell_lines?.length === 1),
    `${c.cell_lines.length} lines`);
  check('whether the figures are means or medians is left open rather than decided for the source',
    f(/does not say mean or median/i.test(c.statistic), false));
  check('the unattributed phases say they are unattributed',
    f(c.phases.S.attributed === null && typeof c.phases.S.attribution_note === 'string', c.phases.S.attributed === 'U2OS'));
  const b = D.totalCycleBounds();
  check('the cycle bounds are the sums of the per-phase extremes',
    f(near(b.lo_hours, c.phases.G1.range.lo + c.phases.S.range.lo + c.phases.G2.range.lo + c.phases.M.value, 1e-9) &&
      near(b.hi_hours, c.phases.G1.range.hi + c.phases.S.range.hi + c.phases.G2.range.hi + c.phases.M.value, 1e-9), false),
    `${b.lo_hours}-${b.hi_hours} h`);
  check('the bounds are labelled as bounds and not as a cell cycle',
    f(/No cell line is claimed/i.test(b.these_are_bounds_not_cells) && /bound/i.test(c.why_no_single_cycle_is_given), false));
  check('the low bound is below the high bound and both are plausible cell cycles',
    f(b.lo_hours < b.hi_hours && b.lo_hours > 10 && b.hi_hours < 30, b.lo_hours > b.hi_hours), `${b.lo_hours}-${b.hi_hours}`);
}

console.log('\ncleavage-stage cycles');
{
  const cl = D.DURATIONS.cleavage_stage_embryo_cycles;
  const ins = cl.organisms.insect;
  check('the insect cycles are the retrieved 9, 10, 12, 21 and 65 min',
    f(ins.cycles.map(x => x.duration).join(',') === '9,10,12,21,65', false),
    ins.cycles.map(x => x.duration).join(','));
  let lengthening = true;
  for (let i = 1; i < ins.cycles.length; i++) if (ins.cycles[i].duration < ins.cycles[i - 1].duration) lengthening = false;
  check('the cycles lengthen monotonically towards the transition', f(lengthening, !lengthening));
  check('cycle 14 is flagged as a minimum, since it varies by position in the embryo',
    f(ins.cycles[4].duration_is_a_minimum === true && /SHORTEST/.test(ins.cycles[4].note), false));
  check('the temperature the insect cycles were timed at is recorded', f(ins.temperature.value === 25, ins.temperature?.value === 37));
  check('the envelope-free portion of mitosis is kept, not folded into the cycle length',
    f(ins.cycles.slice(0, 4).map(x => x.mitosis_without_nuclear_envelope).join(',') === '3,3,3,5', false));

  const fish = cl.organisms.fish;
  check('the fish cycle period is the retrieved 15 min', f(fish.cycle_period.value === 15, fish.cycle_period?.value === 20));
  check('the fish temperature is null with a reason, because the retrieved abstract did not state it',
    f(fish.temperature.value === null && /does not state/i.test(fish.temperature.null_reason) && fish.temperature.what_would_resolve_it.length > 30, fish.temperature?.value === 28.5));

  const amph = cl.organisms.amphibian;
  check('the amphibian cleavage count is retrieved but the cycle duration is refused',
    f(amph.n_rapid_synchronous_cleavages === 12 && amph.cycle_period.value === null, amph.cycle_period?.value === 30));
  check('the refusal names the commonly quoted figure as not retrieved rather than writing it',
    f(/not retrieved and is therefore not written/i.test(amph.cycle_period.null_reason), false));

  check('the no-gap-phases claim is sourced, and the source is marked as a review',
    f(cl.structural_source === 'farrell_ofarrell_2014' && cl.structural_source_is_a_review === true, cl.structural_source_is_a_review === false));
  check('the structural point quotes the no-gap-phases wording rather than paraphrasing it into a fact',
    f(/no gap phases/.test(cl.the_structural_point), false));
  const cc = D.cleavageContrast();
  check('the cleavage contrast is computed from the two sourced figures',
    f(near(cc.ratio, (D.DURATIONS.cultured_mammalian_cell_cycle.phases.S.range.lo * 60) / ins.cycles[0].duration, 1e-9), false),
    `${cc.ratio.toFixed(1)}x`);
  check('an entire embryonic nuclear cycle is shorter than a cultured S phase by more than an order of magnitude',
    f(cc.ratio > 10, cc.ratio < 1), `${cc.ratio.toFixed(1)}x`);
  check('the contrast says it is between developmental modes, not between species',
    f(/not between species/i.test(cc.not_the_same_organism), false));
  check('no mammalian cleavage figure is borrowed from these embryos',
    f(D.NUMBERS_WE_DECLINED.mammalian_cleavage_cycle_duration.value === null &&
      cl.caveats.some(x => /None of these is a mammal/.test(x)), false));
}

// ------------------------------------------------------------------ animation honesty
console.log('\nanimation honesty');
{
  const r = D.realTimeFactor({ steps_per_second: 5.6 });
  check('a 5.6 aa/s ribosome gives 5.6/60 steps per frame at 60 fps',
    near(r.steps_per_frame_at_real_time, f(5.6 / 60, 1), 1e-12), `${r.steps_per_frame_at_real_time.toFixed(6)}`);
  check('the factor satisfies its own definition: factor x steps-per-frame = the target',
    f(near(r.factor * r.steps_per_frame_at_real_time, r.steps_per_frame_target, 1e-12), false));
  check('frames-per-step is the reciprocal of steps-per-frame',
    f(near(r.frames_per_step_at_real_time * r.steps_per_frame_at_real_time, 1, 1e-12), false));
  // The surprise this module exists to record: the mammalian ribosome needs SPEEDING UP, not slowing.
  check('a mammalian ribosome must be sped up to give one residue per frame',
    f(r.direction === 'speed up' && r.factor > 1, r.direction === 'slow down'),
    `${r.direction} x${r.factor.toFixed(2)}`);
  const fast = D.realTimeFactor({ steps_per_second: 900 });
  check('a 900 nt/s polymerase must be slowed down', f(fast.direction === 'slow down' && fast.factor < 1, fast.direction === 'speed up'),
    `${fast.direction} x${fast.factor.toFixed(4)}`);
  const exact = D.realTimeFactor({ steps_per_second: 60 });
  check('a process at exactly the frame rate needs neither', f(exact.direction === 'real time' && exact.factor === 1, exact.direction === 'speed up'));
  for (const [label, args] of [['a zero frame rate', { steps_per_second: 10, fps: 0 }], ['a zero rate', { steps_per_second: 0 }], ['a zero target', { steps_per_second: 10, steps_per_frame_target: 0 }]]) {
    let t = false; try { D.realTimeFactor(args); } catch { t = true; }
    check(`${label} is refused rather than returning Infinity`, f(t, !t));
  }
  check('the frame-rate criterion is labelled a convention, not a property of the eye',
    f(/convention/i.test(r.criterion_is_a_convention) && /Neither is a retrieved property/i.test(r.criterion_is_a_convention), false));
  check('the missing perceptual measurement is recorded as a refusal',
    f(D.NUMBERS_WE_DECLINED.human_flicker_fusion.value === null && /convention/i.test(D.NUMBERS_WE_DECLINED.human_flicker_fusion.null_reason), false));

  const A = D.ANIMATION_HONESTY;
  check('a factor is given per process rather than one global slow-motion number',
    f(Object.keys(A.per_process).length >= 5, Object.keys(A.per_process).length <= 1),
    `${Object.keys(A.per_process).length} processes`);
  check('every animated process names its organism and its source',
    f(Object.values(A.per_process).every(p => typeof p.organism === 'string' && typeof p.source === 'string'), false));
  check('every animated process names what one step IS',
    f(Object.values(A.per_process).every(p => /^one /.test(p.step)), false));
  for (const [k, p] of Object.entries(A.per_process)) {
    const re = D.realTimeFactor({ steps_per_second: p.steps_per_second });
    check(`${k}: the published factor is reproducible from its rate`, near(p.factor, f(re.factor, re.factor * 2), 1e-12));
  }
  const mam = ['ribosome_mammal', 'pol2_mammal', 'replication_fork_mammal'];
  check('all three mammalian machines come out needing to be sped up, not slowed down',
    f(mam.every(k => A.per_process[k].direction === 'speed up'), false),
    mam.map(k => `${k}:${A.per_process[k].direction}`).join(' '));
  check('both bacterial polymerases come out needing to be slowed down',
    f(['replication_fork_bacteria', 'pol3_bacteria_isolated'].every(k => A.per_process[k].direction === 'slow down'), false));
  const w = A.whole_process_at_real_time;
  check('the S phase frame count is seconds times the frame rate, recomputed',
    f(near(w.longest_observed_S_phase.frames_at_60fps, w.longest_observed_S_phase.seconds * 60, 1e-6), false),
    `${w.longest_observed_S_phase.frames_at_60fps}`);
  check('the S phase seconds match the sourced hours',
    f(near(w.longest_observed_S_phase.seconds, w.longest_observed_S_phase.hours * 3600, 1e-9), false));
  check('one S phase in real time is millions of frames, which is the part that must be compressed',
    f(w.longest_observed_S_phase.frames_at_60fps > 1e6, w.longest_observed_S_phase.frames_at_60fps < 1e3));
  check('the cell scale needs far more compression than any molecule',
    f(w.longest_observed_S_phase.frames_at_60fps / A.per_process.pol3_bacteria_isolated.steps_per_second > 1000, false));
  check('the viewer is told to display the real rate, the playback factor and the depiction warning',
    f(A.what_a_viewer_must_display.length === 3 && A.what_a_viewer_must_display.some(x => /depiction/.test(x)), false));
}

// ------------------------------------------------------------------ 4. every null carries a reason
console.log('\nrefusals');
{
  const nulls = ALL_NODES.filter(([, n]) => Object.hasOwn(n, 'value') && n.value === null);
  check('the exports contain several refused values, not zero', f(nulls.length >= 6, nulls.length >= 600),
    `${nulls.length} refused values`);
  const bad = nulls.filter(([, n]) => typeof n.null_reason !== 'string' || n.null_reason.length < 40 || typeof n.what_would_resolve_it !== 'string' || n.what_would_resolve_it.length < 20);
  check('every refused value carries a null_reason and a what_would_resolve_it',
    f(bad.length === 0, bad.length !== 0),
    bad.length ? `missing on ${bad.map(([p]) => p).slice(0, 3).join(', ')}` : `${nulls.length} checked`);
  const decl = Object.entries(D.NUMBERS_WE_DECLINED);
  check('the refusals are collected in one place a reader can audit', f(decl.length >= 5, decl.length <= 1), `${decl.length} entries`);
  check('every collected refusal says what was WANTED, not only what is missing',
    f(decl.every(([, v]) => typeof v.wanted === 'string' && v.wanted.length > 20), false));
  check('the corrected-paper refusal explains that the figures may be superseded',
    f(/supersede/i.test(D.NUMBERS_WE_DECLINED.mrna_half_life_parallel_labelling.null_reason), false));
  check('the textbook cell-cycle quartet is refused as textbook-only and points at the measured entry',
    f(/textbook summary/i.test(D.NUMBERS_WE_DECLINED.textbook_cell_cycle_quartet.null_reason) &&
      /cultured_mammalian_cell_cycle/.test(D.NUMBERS_WE_DECLINED.textbook_cell_cycle_quartet.use_instead), false));
  check('the refusal for the scanned 1994 issue distinguishes direction retrieved from digits not retrieved',
    f(/digits were not/i.test(D.NUMBERS_WE_DECLINED.bacterial_transcription_absolute_1994.null_reason), false));
  check('the stripped-numbers refusal says the prose survived and the numbers did not',
    f(/numbers did not/i.test(D.NUMBERS_WE_DECLINED.bacterial_fork_velocity_oscillation_values.null_reason), false));
}

// ------------------------------------------------------------------ 5. sources resolve and were fetched
console.log('\nprovenance');
{
  const keys = new Set(Object.keys(D.CITATIONS));
  const refs = [];
  for (const [p, n] of ALL_NODES) {
    for (const field of ['source', 'structural_source', 'petryk_source']) {
      const v = n[field];
      if (typeof v === 'string') refs.push([`${p}.${field}`, v]);
      else if (Array.isArray(v)) v.forEach((x, i) => typeof x === 'string' && refs.push([`${p}.${field}[${i}]`, x]));
    }
  }
  check('the data actually references sources', f(refs.length >= 20, refs.length === 0), `${refs.length} references`);
  const dangling = refs.filter(([, v]) => !keys.has(v));
  check('every source key resolves to a CITATIONS entry', f(dangling.length === 0, dangling.length !== 0),
    dangling.length ? `dangling: ${dangling.slice(0, 3).map(([p, v]) => `${p}=${v}`).join(', ')}` : `${refs.length} references, ${keys.size} citations`);
  const used = new Set(refs.map(([, v]) => v));
  check('no citation is listed that nothing uses, except the ones used only in prose',
    f([...keys].filter(k => !used.has(k)).every(k => ['vogel_jensen_1994', 'huang_2023', 'schwanhausser_2011'].includes(k)), false),
    `unused: ${[...keys].filter(k => !used.has(k)).join(', ') || 'none'}`);

  const cits = Object.entries(D.CITATIONS);
  check('every citation records HOW it was retrieved, at length',
    f(cits.every(([, c]) => typeof c.how === 'string' && c.how.length > 80), false),
    cits.filter(([, c]) => (c.how ?? '').length <= 80).map(([k]) => k).join(', ') || 'all fine');
  check('every retrieval mentions a concrete fetch rather than just naming a database',
    f(cits.every(([, c]) => /PubMed MCP|live fetch|Live GET/.test(c.how)), false));
  const withDoi = cits.filter(([, c]) => c.doi);
  check('every DOI has the shape of a DOI', f(withDoi.every(([, c]) => /^10\.\d{4,9}\/\S+$/.test(c.doi)), false),
    withDoi.filter(([, c]) => !/^10\.\d{4,9}\/\S+$/.test(c.doi)).map(([k]) => k).join(', ') || `${withDoi.length} DOIs`);
  const withPmid = cits.filter(([, c]) => c.pmid);
  check('every PMID is a bare digit string', f(withPmid.every(([, c]) => /^\d{5,9}$/.test(c.pmid)), false));
  check('the two citations whose numbers could NOT be read say so in their own how',
    f(/EMPTY body/.test(D.CITATIONS.vogel_jensen_1994.how) && /stripped the inline numeric values/.test(D.CITATIONS.huang_2023.how), false));
  check('the paywalled citation records the 303 redirect rather than implying it was read',
    f(/303 redirect/.test(D.CITATIONS.schwanhausser_2011.how), false));
  check('the corrected paper is cited together with its corrigendum',
    f(D.CITATIONS.schwanhausser_2011.corrigendum_doi === '10.1038/nature11848' && /Corrigendum/.test(D.CITATIONS.schwanhausser_2011.cite), false));
  check('the review is labelled a review inside its own citation text',
    f(/REVIEW, not a primary measurement/.test(D.CITATIONS.farrell_ofarrell_2014.cite), false));

  // Every rate entry that carries a number must carry its provenance with it, not only in CITATIONS.
  const rateEntries = Object.entries(D.RATES).filter(([, v]) => v && typeof v === 'object');
  const thin = rateEntries.filter(([, v]) => !v.organism || !v.cell_type || !v.verified_how || v.verified_how.length < 60);
  check('every rate entry names its organism and cell type and carries a verified_how',
    f(thin.length === 0, thin.length !== 0), thin.map(([k]) => k).join(', ') || `${rateEntries.length} entries`);
  const unsourced = rateEntries.filter(([, v]) => !v.doi && !v.pmid && !v.source);
  check('every rate entry carries a DOI, a PMID or a source key', f(unsourced.length === 0, unsourced.length !== 0),
    unsourced.map(([k]) => k).join(', ') || 'all sourced');
  const noCaveat = rateEntries.filter(([, v]) => !Array.isArray(v.caveats) || v.caveats.length === 0);
  check('every rate entry carries at least one caveat', f(noCaveat.length === 0, noCaveat.length !== 0),
    noCaveat.map(([k]) => k).join(', ') || `${rateEntries.length} entries`);
}

// ------------------------------------------------------------------ the recorded lesson, and freezing
console.log('\nthe recorded lesson');
{
  const t = D.THE_SIXTY_HERTZ_COINCIDENCE;
  const required = ['what_we_expected', 'what_the_numbers_said', 'why_we_had_it_backwards', 'what_actually_needs_compressing', 'what_changed_in_the_design', 'the_general_lesson'];
  check('the lesson records the expectation, the finding, the diagnosis and the design change',
    f(required.every(k => typeof t[k] === 'string' && t[k].length > 80), false),
    required.filter(k => (t[k] ?? '').length <= 80).join(', ') || 'all present');
  check('it states that the expectation was wrong in the opposite direction',
    f(/too SLOW|opposite/.test(t.what_the_numbers_said), false));
  check('it names the actual confusion: a spatial factor applied to the time axis',
    f(/time axis|in TIME/.test(t.why_we_had_it_backwards), false));
  check('the lesson is generalised to the checking of presuppositions',
    f(/presupposition/i.test(t.the_general_lesson), false));
  check('the design change it caused is named concretely',
    f(/ANIMATION_HONESTY/.test(t.what_changed_in_the_design), false));
  check('the limitations include the circularity and the kinetics that are simply absent',
    f(D.KNOWN_LIMITATIONS.some(l => /circular/i.test(l)) && D.KNOWN_LIMITATIONS.some(l => /nucleosome/i.test(l)), false),
    `${D.KNOWN_LIMITATIONS.length} limitations`);
  check('the limitations say the module is not a simulation and supplies no geometry',
    f(D.KNOWN_LIMITATIONS.some(l => /no positions|no geometry/i.test(l)), false));
  check('the limitations admit the half-life pair is the weakest part of the file',
    f(D.KNOWN_LIMITATIONS.some(l => /weakest/i.test(l)), false));

  for (const [name, o] of [...EXPORTED, ['CITATIONS', D.CITATIONS], ['KNOWN_LIMITATIONS', D.KNOWN_LIMITATIONS], ['WHY_NOT_AVERAGED', D.WHY_NOT_AVERAGED], ['THE_SIXTY_HERTZ_COINCIDENCE', D.THE_SIXTY_HERTZ_COINCIDENCE]]) {
    check(`${name} is frozen`, f(Object.isFrozen(o), !Object.isFrozen(o)));
  }
  check('the freeze is DEEP: nested measurement rows cannot be edited',
    f(Object.isFrozen(D.RATES.transcription_pol2_mammal.measurements) &&
      Object.isFrozen(D.RATES.transcription_pol2_mammal.measurements[0]) &&
      Object.isFrozen(D.DURATIONS.cleavage_stage_embryo_cycles.organisms.insect.cycles[0]), false));
  let mutated = false;
  try { D.RATES.translation_mammal.value = 99; } catch { /* strict mode throws */ }
  if (D.RATES.translation_mammal.value === 99) mutated = true;
  check('a write to a published rate does not take effect', f(!mutated, mutated));
  check('worked() prints the inequality and the refusal count',
    f(/ONE-ORIGIN CONSTRAINT/.test(D.worked()) && /REFUSED: \d+ numbers/.test(D.worked()), false));
}

// ------------------------------------------------------------------ 6. the holdout
console.log('\nthe holdout');
{
  const splitPath = path.join(root, 'holdout/split.json');
  let terms = [], loadedFrom = null, loadError = null;
  try {
    const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    terms = (split.taxa ?? []).filter(t => t.assignment === 'holdout')
      .flatMap(t => [t.name, t.latin, t.scientific_name, t.common_name, t.taxon, t.slug].filter(x => typeof x === 'string'))
      .map(s => s.toLowerCase());
    loadedFrom = 'holdout/split.json (assignment === "holdout")';
  } catch (e) { loadError = String(e.message).slice(0, 90); }

  const src = (fs.readFileSync(path.join(here, 'dynamics.mjs'), 'utf8') +
    fs.readFileSync(path.join(here, 'test-dynamics.mjs'), 'utf8')).toLowerCase();
  const hits = [...new Set(terms)].filter(t => t.length > 4 && src.includes(t));
  check('the held-out roster was read from the project\'s own split file',
    f(terms.length > 20, terms.length === 0), loadedFrom ? `${terms.length} names from ${loadedFrom}` : `could not load: ${loadError}`);
  check('no held-out taxon name appears in this module or its test',
    f(hits.length === 0 && terms.length > 20, false),
    hits.length ? `${hits.length} hit(s): ${hits.slice(0, 3).join(', ')}` : `${new Set(terms).size} names checked`);
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
