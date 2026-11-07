#!/usr/bin/env node
// Tests for chromatin.mjs
//
//   node sim-engine/scales/molecular/test-chromatin.mjs [--fail-once]
//
// Six things are checked harder than the rest, because they are the six ways this module could do
// damage rather than merely be wrong.
//
//   1. THE HAND-WORKED ARITHMETIC. The length of the mouse genome as naked B-DNA is computed here from
//      LITERALS TYPED OUT OF THE RETRIEVED RECORDS - 2728206152 bp from the NCBI assembly report and
//      3.341 A/bp fitted to the 1BNA coordinates - and compared with what the module returns. The test
//      therefore fails if either constant in the module is edited, which is the whole point: the test
//      is a second, independent copy of the retrieval, not a restatement of the module's own fields.
//
//   2. REFUSALS ARE ASSERTED AS REFUSALS. packingRatio() must return null WITH A REASON for the five
//      levels that have no measured linear density, and a number for the two that do. Asserting only
//      the numbers would pass for a function that invents the other five; asserting only the nulls
//      would pass for a function that refuses everything. Both directions, every level.
//
//   3. THE THIRTY NANOMETRE FIBRE IS CONTESTED, WITH BOTH SIDES PRESENT. Its firmness must be
//      CONTESTED, its diameter must be null, both source lists must be non-empty, and every source key
//      on both lists must resolve in CITATIONS. A "contested" label with one side cited is a verdict
//      wearing a disclaimer.
//
//   4. NO SINGLE FUSED SCORE, AND NO AVERAGED DISAGREEMENT. Where two measurements disagree - 10.0 vs
//      10.4 bp per turn, 880 kb vs 185 kb domains, 19% vs 42% mitotic chromatin - the midpoint must
//      NOT appear anywhere as a value. This is asserted numerically against the actual midpoints,
//      because the failure mode is a well-meaning edit that "resolves" one of them.
//
//   5. EVERY ENTRY CARRIES verified_how AND A FIRMNESS FROM THE CLOSED VOCABULARY, and every null
//      carries a null_reason and a what_would_resolve_it. A number with no provenance is the thing
//      this repo exists to not produce.
//
//   6. THE HOLDOUT. One clade is a frozen evaluation holdout for this project. The test does not carry
//      its name: it reads the project's own roster at runtime, builds the patterns from that, and scans
//      the module source. The gate is derived from the authority rather than from a list retyped here.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own inversion asserts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from './chromatin.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

// ------------------------------------------------------------------ 1. the hand-worked case
console.log('\nthe hand-worked case - the mouse genome as naked B-DNA');
{
  // Typed out of the retrieved records, not read from the module.
  const BP = 2728206152;            // NCBI Datasets GCF_000001635.27, total_sequence_length
  const RISE_A = 3.341;             // least-squares fit to the 1BNA coordinates, this session
  const CHR1_BP = 195154279;        // Ensembl REST, longest top-level chromosome
  const NUC_UM3 = 283;              // BioNumbers 100442, species-less, TEXTBOOK_ONLY
  const P_WIDTH_A = 20.4;           // 1BNA, largest phosphorus radial distance x 2

  const expect_haploid_m = BP * RISE_A * 1e-10;                       // 0.911493675... m
  check('the module agrees with the assembly length typed out of the NCBI report',
    f(C.GENOME.total_length_bp.value, C.GENOME.total_length_bp.value + 1) === BP,
    `module ${C.GENOME.total_length_bp.value} vs retrieved ${BP}`);
  check('the module agrees with the rise fitted to the 1BNA coordinates',
    f(C.B_DNA.rise_per_bp_angstrom.value, 3.4) === RISE_A,
    `module ${C.B_DNA.rise_per_bp_angstrom.value} A/bp vs computed ${RISE_A}`);
  check('contourLength of the haploid mouse genome is 0.9115 m',
    near(C.contourLength(f(BP, Math.round(BP * 1.1))), expect_haploid_m, 1e-9),
    `${C.contourLength(BP).toFixed(6)} m, expected ${expect_haploid_m.toFixed(6)} m`);
  check('that is a little under a metre, not a few centimetres and not ten metres',
    f(C.contourLength(BP) > 0.8 && C.contourLength(BP) < 1.0, false),
    `${C.contourLength(BP).toFixed(4)} m`);
  check('contourLength is linear: one base pair is the rise, a billion is 0.3341 m',
    near(C.contourLength(f(1, 2)), 3.341e-10, 1e-22) && near(C.contourLength(1e9), 0.3341, 1e-12));
  check('the longest mouse chromosome is 65.2 mm of B-DNA',
    near(C.contourLength(f(CHR1_BP, CHR1_BP * 2)), CHR1_BP * RISE_A * 1e-10, 1e-12),
    `${(C.contourLength(CHR1_BP) * 1000).toFixed(3)} mm`);

  // the comparison with a nuclear diameter
  const d_um = Math.cbrt((6 * NUC_UM3) / Math.PI);                    // 8.1498 um sphere-equivalent
  const w = C.mouseGenomeVsNucleus();
  check('the sphere-equivalent nuclear diameter from 283 um^3 is 8.15 um',
    near(f(w.the_container.sphere_equivalent_diameter_um, w.the_container.sphere_equivalent_diameter_um * 2), d_um, 1e-4),
    `${w.the_container.sphere_equivalent_diameter_um.toFixed(4)} um, expected ${d_um.toFixed(4)}`);
  check('the genome is about 112 thousand times the width of that nucleus',
    f(near(w.linear_comparison.ratio, expect_haploid_m / (d_um * 1e-6), 1), false),
    `${Math.round(w.linear_comparison.ratio).toLocaleString()} x`);
  check('the linear ratio is five figures, not four and not six',
    f(w.linear_comparison.ratio > 1e5 && w.linear_comparison.ratio < 1e6, false),
    `${w.linear_comparison.ratio.toExponential(2)}`);

  // the volume comparison, which is the number a viewer actually needs
  const vol_per_bp = Math.PI * ((P_WIDTH_A / 2) * 1e-10) ** 2 * (RISE_A * 1e-10);
  const expect_diploid_um3 = 2 * BP * vol_per_bp * 1e18;              // 5.9596 um^3
  check('bare diploid B-DNA comes to 5.96 um^3',
    near(f(w.volume_comparison.diploid_bare_dna_um3, w.volume_comparison.diploid_bare_dna_um3 + 10), expect_diploid_um3, 1e-3),
    `${w.volume_comparison.diploid_bare_dna_um3.toFixed(4)} um^3, expected ${expect_diploid_um3.toFixed(4)}`);
  check('which is about 2% of a 283 um^3 nucleus, not 50% and not 0.01%',
    f(w.volume_comparison.fraction_of_nucleus_as_bare_dna > 0.015 && w.volume_comparison.fraction_of_nucleus_as_bare_dna < 0.030, false),
    `${(w.volume_comparison.fraction_of_nucleus_as_bare_dna * 100).toFixed(2)}%`);
  check('measured chromatin occupies roughly 14x the volume the DNA itself does',
    f(near(w.volume_comparison.ratio_chromatin_to_bare_dna, 0.30 / (expect_diploid_um3 / NUC_UM3), 0.01), false),
    `${w.volume_comparison.ratio_chromatin_to_bare_dna.toFixed(2)} x`);
  check('the comparison states that filling the nucleus with thread overstates the crowding',
    f(/overstates the crowding/.test(w.volume_comparison.the_point), false));
  check('the borrowed nuclear volume is flagged BORROWED inside the result, not only on its own entry',
    f(w.the_container.BORROWED === true && w.the_container.firmness === 'TEXTBOOK_ONLY', false),
    `BORROWED=${w.the_container.BORROWED}, firmness=${w.the_container.firmness}`);
  check('the result also carries the reason the mouse-specific value is null',
    f(typeof w.the_container.and_the_mouse_value_is === 'string' && /No primary measurement/.test(w.the_container.and_the_mouse_value_is), false));

  check('the diploid nucleosome count is about 29.8 million at the mouse ES repeat length',
    f(near(w.nucleosome_count.diploid, (2 * BP) / 183.4, 1), false),
    `${(w.nucleosome_count.diploid / 1e6).toFixed(2)} million`);
  check('the nucleosome count names the organism AND the cell type it borrowed the repeat length from',
    f(/Mus musculus/.test(w.nucleosome_count.organism) && /embryonic stem/.test(w.nucleosome_count.organism), false),
    w.nucleosome_count.organism);

  // the rise is a choice, and the choice must be visible
  const r = C.contourLengthRange(BP);
  check('contourLengthRange spans all three retrieved rise values and the spread is ~1.8%',
    f(Object.keys(r.metres).length === 3 && near(r.spread_fraction, (3.4 - 3.341) / 3.341, 1e-9), false),
    `${Object.keys(r.metres).length} values, spread ${(r.spread_fraction * 100).toFixed(2)}%`);
  check('the textbook rise gives the LARGEST answer, i.e. 3.4 A is an overestimate',
    f(r.metres.textbook === r.hi && r.metres.least_squares_1bna === r.lo, false),
    `textbook ${r.metres.textbook.toFixed(4)} m vs fitted ${r.metres.least_squares_1bna.toFixed(4)} m`);
  check('that 1.8% is 16 mm over a mouse genome, which the module says out loud',
    f(near((r.hi - r.lo) * 1000, 16, 1.5) && /16 mm/.test(C.WHAT_WE_GOT_WRONG.the_second_lesson), false),
    `${((r.hi - r.lo) * 1000).toFixed(1)} mm`);

  // refusals of bad input
  for (const [label, bad] of [['a negative count', -1], ['a string', '100'], ['NaN', NaN], ['undefined', undefined]]) {
    let threw = false; try { C.contourLength(bad); } catch { threw = true; }
    check(`contourLength refuses ${label} rather than returning NaN`, f(threw, !threw));
  }
  let threwRise = false; try { C.contourLength(100, { rise_m: 0 }); } catch { threwRise = true; }
  check('contourLength refuses a zero rise', f(threwRise, !threwRise));
}

// ------------------------------------------------------------------ 2. refusals are refusals
console.log('\npackingRatio refuses the rungs that were never measured');
{
  const HAS = ['b_dna', 'thirty_nm_fibre'];
  const REFUSES = ['nucleosome_core_particle', 'linker_and_repeat', 'ten_nm_fibre', 'loop_domain', 'mitotic_chromosome'];

  for (const id of HAS) {
    const pr = C.packingRatio(f(id, REFUSES[0]));
    check(`packingRatio(${id}) returns a number`, typeof pr.value === 'number' && Number.isFinite(pr.value), JSON.stringify(pr.value));
  }
  for (const id of REFUSES) {
    const pr = C.packingRatio(f(id, HAS[0]));
    check(`packingRatio(${id}) returns null with a reason and a way out`,
      pr.value === null && typeof pr.null_reason === 'string' && pr.null_reason.length > 30 && typeof pr.what_would_resolve_it === 'string',
      pr.value === null ? pr.null_reason.slice(0, 60) : `got ${pr.value}`);
  }
  check('five of the seven rungs are refused, which is the honest count',
    f(C.LEVEL_IDS.filter(id => C.packingRatio(id).value === null).length === 5, false),
    `${C.LEVEL_IDS.filter(id => C.packingRatio(id).value === null).length} refused of ${C.LEVEL_IDS.length}`);
  check('B-DNA packs at 1x by construction (it IS the contour length)',
    near(C.packingRatio(f('b_dna', 'thirty_nm_fibre')).value, 1, 1e-9),
    `${C.packingRatio('b_dna').value.toFixed(6)}`);
  check('the in-vitro 30 nm fibre works out at ~61x, not the ~40x of the diagrams',
    f(C.packingRatio('thirty_nm_fibre').value > 55 && C.packingRatio('thirty_nm_fibre').value < 65, false),
    `${C.packingRatio('thirty_nm_fibre').value.toFixed(1)} x`);
  check('the 30 nm packing ratio is marked DERIVED and names the splice that makes it weak',
    f(C.packingRatio('thirty_nm_fibre').firmness === 'DERIVED' && /in dispute/.test(C.packingRatio('thirty_nm_fibre').carries_the_weakness_of), false),
    C.packingRatio('thirty_nm_fibre').firmness);
  const bogus = C.packingRatio('a_level_that_does_not_exist');
  check('an unknown level id is refused by name and the valid ids are listed',
    f(bogus.value === null && /no level with id/.test(bogus.null_reason) && bogus.null_reason.includes('b_dna'), false),
    bogus.null_reason?.slice(0, 70));

  const cp = C.coreParticleCompaction();
  check('the core particle compaction is 147 bp over a 5.15 nm disc, about 9.5x',
    f(near(cp.compaction, (147 * 3.341e-10) / (51.5e-10), 1e-6), false),
    `${cp.compaction.toFixed(3)} x`);
  check('and it warns that this is not comparable with a fibre packing ratio',
    f(/not the same quantity as a fibre packing ratio/.test(cp.caution), false));
}

// ------------------------------------------------------------------ 3. the thirty nanometre problem
console.log('\nthe thirty nanometre problem');
{
  const L = C.LEVELS.find(l => l.id === 'thirty_nm_fibre');
  check('the 30 nm fibre is marked CONTESTED, not MEASURED and not TEXTBOOK_ONLY',
    f(L.firmness, 'MEASURED_IN_VITRO') === 'CONTESTED', L.firmness);
  check('its diameter is null, because 33/44 nm in vitro and ~17 nm in situ are not one number',
    f(L.dimension.value === null && typeof L.dimension.null_reason === 'string', false),
    `value ${L.dimension.value}`);
  check('the null_reason names both the in-vitro classes and the in-situ distribution',
    f(/33 nm and 44 nm/.test(L.dimension.null_reason) && /17 nm/.test(L.dimension.null_reason), false));
  check('the in-vitro measurements are still recorded on the entry, not discarded',
    f(L.dimension.measured_in_vitro.class_a_nm === 33 && L.dimension.measured_in_vitro.class_b_nm === 44, false));
  check('the in-situ mean and its standard deviation are both recorded',
    f(L.dimension.measured_in_situ_mean_nm === 16.9 && L.dimension.measured_in_situ_sd_nm === 8.2, false));
  check('the standard deviation is wide enough to cover both 10 nm and 25 nm, which is the finding',
    f(L.dimension.measured_in_situ_mean_nm - L.dimension.measured_in_situ_sd_nm < 10 &&
      L.dimension.measured_in_situ_mean_nm + L.dimension.measured_in_situ_sd_nm > 24, false),
    `${L.dimension.measured_in_situ_mean_nm} +/- ${L.dimension.measured_in_situ_sd_nm} nm`);

  const sides = L.contested_sides;
  check('both sides of the dispute are cited, each with at least two sources',
    f(sides.exists_as_a_regular_fibre.length >= 2 && sides.not_present_in_bulk_chromatin_in_cells.length >= 2, false),
    `${sides.exists_as_a_regular_fibre.length} for / ${sides.not_present_in_bulk_chromatin_in_cells.length} against`);
  check('the in-between study is recorded as its own category, not folded into either side',
    f(Array.isArray(sides.present_but_a_minority_with_no_higher_order_repeat) && sides.present_but_a_minority_with_no_higher_order_repeat.includes('wako_2020'), false));
  check('the disagreement WITHIN the in-vitro camp is recorded too',
    f(/inconsistent with two-start/.test(sides.and_the_in_vitro_side_disagrees_with_itself), false));

  const T = C.THE_THIRTY_NANOMETRE_PROBLEM;
  const prose = ['one_sentence', 'what_is_not_in_dispute', 'what_is_actually_in_dispute', 'the_evidence_for_the_fibre',
    'the_evidence_against_it_being_in_cells', 'the_study_that_splits_the_difference', 'why_the_textbook_figure_persists', 'what_would_settle_it'];
  check('the problem is written out as plain prose in every required section',
    f(prose.every(k => typeof T[k] === 'string' && T[k].length > 120), false),
    prose.filter(k => !(typeof T[k] === 'string' && T[k].length > 120)).join(',') || 'all present');
  check('it concedes what is NOT in dispute, rather than only arguing one way',
    f(/No side of the argument disputes any of these/.test(T.what_is_not_in_dispute), false));
  check('it states the dispute as being about a LEVEL OF ORGANISATION, not about whether the fibre exists',
    f(/LEVEL OF ORGANISATION/.test(T.what_is_actually_in_dispute), false));
  check('it notes that the in-situ side itself allows a folded 30-nm fibre under some conditions',
    f(/folded 30-nm fiber/.test(T.what_is_actually_in_dispute), false));
  check('it records that Finch and Klug measured a 110 A pitch, not a 30 nm diameter',
    f(/the famous 30 nm is the correlated thread, not the measured pitch/.test(T.the_evidence_for_the_fibre), false));
  check('it names three independent in-situ methods, not one',
    f(/cryo-electron/.test(T.the_evidence_against_it_being_in_cells) &&
      /X-ray scattering/.test(T.the_evidence_against_it_being_in_cells) &&
      /tomography/.test(T.the_evidence_against_it_being_in_cells), false));
  check('it says why the textbook figure survives, and that illustratability is the wrong reason',
    f(/illustratable, which is exactly the wrong reason/.test(T.why_the_textbook_figure_persists), false));

  const draw = T.what_a_viewer_should_therefore_draw;
  check('there is explicit drawing guidance, at least five instructions',
    f(Array.isArray(draw) && draw.length >= 5, false), `${draw.length} instructions`);
  check('the guidance forbids a solenoid in a nucleus in so many words',
    f(draw.some(s => /Do not draw a solenoid/.test(s)), false));
  check('the guidance gives a measured target to hit instead of a shape to copy',
    f(draw.some(s => /chromatin volume fraction/.test(s) && /30%/.test(s)), false));
  check('the guidance tells the viewer to label which rungs are measured',
    f(draw.some(s => /which rungs are measured/.test(s)), false));
  check('every source key on both sides of the dispute resolves in CITATIONS',
    f([...T.sources_for_the_fibre, ...T.sources_against_it_in_cells, T.source_in_between, T.source_for_the_motion]
      .every(k => Object.hasOwn(C.CITATIONS, k)), false),
    [...T.sources_for_the_fibre, ...T.sources_against_it_in_cells].filter(k => !Object.hasOwn(C.CITATIONS, k)).join(',') || 'all resolve');
}

// ------------------------------------------------------------------ 4. no fused score, no averaged disagreement
console.log('\ndisagreements are kept, not averaged');
{
  const raw = fs.readFileSync(path.join(here, 'chromatin.mjs'), 'utf8');
  const src = raw.replace(/\n\s*\/\/\s*/g, ' ').replace(/[ \t]+/g, ' '); // unwrap comment lines so prose assertions are not defeated by line breaks

  check('both helical repeats are present and the midpoint 10.2 is not',
    f(C.B_DNA.bp_per_turn_crystal.value === 10.06 && C.B_DNA.bp_per_turn_solution.value === 10.4 && !/\b10\.2\b/.test(src), false));
  check('the helical-repeat entry says in words that it is NOT averaged',
    f(/NOT averaged/.test(C.B_DNA.helical_repeat_disagreement.resolution), false));
  check('the solution repeat carries its own probable error, not a bare point value',
    f(C.B_DNA.bp_per_turn_solution.uncertainty === 0.1, false));

  const dom = C.LEVELS.find(l => l.id === 'loop_domain').size_bp;
  check('both domain medians are present and neither is a blend of the two',
    f(dom.mouse_topological_domain_median === 880000 && dom.human_contact_domain_median === 185000, false));
  const mid = (880000 + 185000) / 2;
  check(`the midpoint ${mid} appears nowhere in the source`,
    f(!src.includes(String(mid)) && !src.includes('532500'), false));
  check('the domain disagreement is attributed to assay and segmentation, not to species',
    f(/not a species difference/.test(dom.disagreement) && /segmentation choice/.test(dom.disagreement), false));
  check('both domain sources are named on the disagreement itself',
    f(dom.both_sources.length === 2 && dom.both_sources.every(k => Object.hasOwn(C.CITATIONS, k)), false));

  const mit = C.LEVELS.find(l => l.id === 'mitotic_chromosome').chromatin_volume_fraction;
  check('the two mitotic chromatin fractions are both kept at 19% and 42%',
    f(mit.value === 0.19 && mit.and_an_independent_estimate.value === 0.42, false));
  check('their factor-of-two gap is named as the honest uncertainty, not reconciled',
    f(/Not averaged/.test(mit.disagreement) && /factor of two/.test(mit.disagreement), false));

  check('no exported name contains "score", and there is no fused compaction figure',
    f(!Object.keys(C).some(k => /score/i.test(k)) && !/compaction_score|packing_score|overall_score/i.test(src), false),
    Object.keys(C).filter(k => /score/i.test(k)).join(',') || 'none');
  check('the header says there will be no fused compaction score',
    f(/no fused "compaction score" anywhere here/.test(src), false));
}

// ------------------------------------------------------------------ 5. provenance on every entry
console.log('\nprovenance');
{
  const src = fs.readFileSync(path.join(here, 'chromatin.mjs'), 'utf8').replace(/\n\s*\/\/\s*/g, ' ');

  check('there are at least six levels and they are in the stated order, helix first and chromosome last',
    f(C.LEVELS.length >= 6 && C.LEVELS[0].id === 'b_dna' && C.LEVELS[C.LEVELS.length - 1].id === 'mitotic_chromosome', false),
    C.LEVEL_IDS.join(' -> '));
  check('every required rung of the hierarchy is present',
    f(['b_dna', 'nucleosome_core_particle', 'linker_and_repeat', 'ten_nm_fibre', 'thirty_nm_fibre', 'loop_domain', 'mitotic_chromosome']
      .every(id => C.LEVEL_IDS.includes(id)), false));
  check('every level has a verified_how of real length',
    f(C.LEVELS.every(l => typeof l.verified_how === 'string' && l.verified_how.length > 80), false),
    C.LEVELS.filter(l => !(l.verified_how?.length > 80)).map(l => l.id).join(',') || 'all present');
  check('every verified_how names something fetched: a service, a PDB id, a PMID or a PMC id',
    f(C.LEVELS.every(l => /rcsb\.org|PMID|PMC\d|rest\.ensembl|api\.ncbi|bionumbers/i.test(l.verified_how)), false),
    C.LEVELS.filter(l => !/rcsb\.org|PMID|PMC\d|rest\.ensembl|api\.ncbi|bionumbers/i.test(l.verified_how)).map(l => l.id).join(',') || 'all name a fetch');
  check('every level firmness is a key of the closed FIRMNESS vocabulary',
    f(C.LEVELS.every(l => C.FIRMNESS_VALUES.includes(l.firmness)), false),
    C.LEVELS.filter(l => !C.FIRMNESS_VALUES.includes(l.firmness)).map(l => `${l.id}:${l.firmness}`).join(',') || 'all valid');
  check('every level source key resolves in CITATIONS, including the also_sources',
    f(C.LEVELS.every(l => Object.hasOwn(C.CITATIONS, l.source) && (l.also_sources ?? []).every(k => Object.hasOwn(C.CITATIONS, k))), false));
  check('every citation carries a `gives` line saying what was read out of it',
    f(Object.values(C.CITATIONS).every(c => typeof c.gives === 'string' && c.gives.length > 40), false),
    Object.entries(C.CITATIONS).filter(([, c]) => !(c.gives?.length > 40)).map(([k]) => k).join(',') || 'all present');
  check('every citation carries a DOI or a service URL - nothing is cited by author and year alone',
    f(Object.values(C.CITATIONS).every(c => typeof c.doi === 'string' || typeof c.url === 'string'), false),
    Object.entries(C.CITATIONS).filter(([, c]) => !c.doi && !c.url).map(([k]) => k).join(',') || 'all identified');
  check('every level states its organism and whether that organism was established',
    f(C.LEVELS.every(l => Object.hasOwn(l, 'organism') && typeof l.organism_established === 'boolean'), false));
  check('the one level whose organism cannot be established says so and says why',
    f(C.LEVELS.filter(l => l.organism_established === false).length === 1 &&
      /reconstituted array has no cell type/.test(C.LEVELS.find(l => l.organism_established === false).organism_note), false),
    `${C.LEVELS.filter(l => l.organism_established === false).length} unestablished`);
  check('the mouse-specific level names the cell type, not just the species',
    f(/embryonic stem cells/.test(C.LEVELS.find(l => l.id === 'linker_and_repeat').cell_type), false));
  check('every null dimension carries BOTH a null_reason and a what_would_resolve_it',
    f(C.LEVELS.filter(l => l.dimension.value === null)
      .every(l => typeof l.dimension.null_reason === 'string' && typeof l.dimension.what_would_resolve_it === 'string'), false),
    `${C.LEVELS.filter(l => l.dimension.value === null).length} null dimensions`);
  check('at least three dimensions ARE null - the ladder is not fully measured and does not pretend to be',
    f(C.LEVELS.filter(l => l.dimension.value === null).length >= 3, false),
    `${C.LEVELS.filter(l => l.dimension.value === null).length} of ${C.LEVELS.length}`);
  check('every level says what a viewer gets right at that zoom level',
    f(C.LEVELS.every(l => typeof l.what_a_viewer_gets_right_here === 'string' && l.what_a_viewer_gets_right_here.length > 40), false));

  // the live-verified genome record
  check('the genome names both the RefSeq and GenBank accessions it was verified against',
    f(C.GENOME.accession_refseq === 'GCF_000001635.27' && C.GENOME.accession_genbank === 'GCA_000001635.9', false));
  check('the assembly name and date came back from the services, not from memory',
    f(C.GENOME.assembly_name === 'GRCm39' && C.GENOME.assembly_date === '2020-06', false));
  check('the ungapped length is recorded too, and 2.7% of the assembly is gap',
    f(near((C.GENOME.total_length_bp.value - C.GENOME.total_ungapped_length_bp.value) / C.GENOME.total_length_bp.value, 0.027, 0.001), false),
    `${(((C.GENOME.total_length_bp.value - C.GENOME.total_ungapped_length_bp.value) / C.GENOME.total_length_bp.value) * 100).toFixed(2)}% gap`);
  check('the chromosome count is 21 as the assembly reports it, with the haploid 20 distinguished',
    f(C.GENOME.chromosome_sequences_in_assembly.value === 21 && /is 20/.test(C.GENOME.chromosome_sequences_in_assembly.not_the_same_as), false));
  check('the longest chromosome is 1 and is longer than every other recorded length',
    f(C.GENOME.longest_chromosome.length_bp > C.GENOME.second_longest_chromosome.length_bp &&
      C.GENOME.longest_chromosome.length_bp > C.GENOME.x_chromosome_length_bp, false),
    `${C.GENOME.longest_chromosome.length_bp} > ${C.GENOME.second_longest_chromosome.length_bp}`);
  check('the chromosome lengths sum to less than the assembly total (scaffolds are not chromosomes)',
    f(C.GENOME.longest_chromosome.length_bp + C.GENOME.second_longest_chromosome.length_bp + C.GENOME.x_chromosome_length_bp < C.GENOME.total_length_bp.value, false));
  check('the genome verified_how names both services and says they agree',
    f(/api\.ncbi/.test(C.GENOME.verified_how) && /rest\.ensembl/.test(C.GENOME.verified_how) && /agree on the assembly identity/.test(C.GENOME.verified_how), false));

  // the null that matters most
  const nd = C.NUCLEAR_SPACE.mouse_nuclear_diameter;
  check('the mouse nuclear diameter is null with a reason and a route to resolving it',
    f(nd.value === null && nd.null_reason.length > 80 && /embryonic stem cells would be the right cell type/.test(nd.what_would_resolve_it), false));
  check('the borrowed nuclear volume is TEXTBOOK_ONLY with its organism unestablished',
    f(C.NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.firmness === 'TEXTBOOK_ONLY' &&
      C.NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.organism_established === false, false));
  check('its range spans a factor of about 7.6, which is why it is not quoted as a value',
    f(near(C.NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.hi / C.NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.lo, 7.6, 0.1), false),
    `${(C.NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.hi / C.NUCLEAR_SPACE.mammalian_tissue_culture_nuclear_volume.lo).toFixed(2)} x`);
  check('the measured chromatin volume concentrations carry organism, cell type and firmness',
    f(['interphase_chromatin_volume_concentration', 'mitotic_chromatin_volume_concentration']
      .every(k => C.NUCLEAR_SPACE[k].organism === 'Homo sapiens' && typeof C.NUCLEAR_SPACE[k].cell_type === 'string' && C.NUCLEAR_SPACE[k].firmness === 'MEASURED_IN_SITU'), false));
  check('the one in-vivo motion number is marked organism-unestablished because the abstract did not say',
    f(C.NUCLEAR_SPACE.nucleosome_motion_in_living_cells.organism_established === false &&
      C.NUCLEAR_SPACE.nucleosome_motion_in_living_cells.firmness === 'MEASURED_IN_VIVO', false));

  // the recorded lesson
  const g = C.WHAT_WE_GOT_WRONG;
  check('the lesson is recorded with what happened, why it mattered, and what was done',
    f(['what_happened', 'why_it_mattered', 'what_the_resolution_probably_is', 'what_we_did_about_it', 'the_general_lesson', 'the_second_lesson']
      .every(k => typeof g[k] === 'string' && g[k].length > 100), false));
  check('it records the actual discrepancy: 1.81 computed against 1.65 quoted',
    f(/1\.810/.test(g.what_happened) && /1\.65/.test(g.what_happened), false));
  check('it does not claim to have reconciled them',
    f(/not asserted a reconciliation we did\s+not verify/.test(g.what_we_did_about_it.replace(/\s+/g, ' ')) ||
      /did not confirm|was not confirmed/.test(g.what_we_did_about_it), false));
  check('the level entry itself carries both figures and the unconfirmed explanation',
    f(C.LEVELS.find(l => l.id === 'nucleosome_core_particle').superhelical_turns.value === 1.81 &&
      C.LEVELS.find(l => l.id === 'nucleosome_core_particle').superhelical_turns.the_textbook_figure === 1.65, false));
  check('the 146 vs 147 base-pair difference is recorded as two structures, not a correction',
    f(/not a correction of a count/.test(C.LEVELS.find(l => l.id === 'nucleosome_core_particle').bp_wrapped.note), false));

  check('known limitations include the missing mouse nucleus, the in-vitro splice and the human cell lines',
    f(C.KNOWN_LIMITATIONS.some(l => /nuclear diameter or nuclear volume for any named mouse/.test(l)) &&
      C.KNOWN_LIMITATIONS.some(l => /splice/.test(l)) &&
      C.KNOWN_LIMITATIONS.some(l => /cultured human cells/.test(l)), false),
    `${C.KNOWN_LIMITATIONS.length} limitations`);
  check('known limitations admit the module is entirely time-averaged',
    f(C.KNOWN_LIMITATIONS.some(l => /Nothing here is dynamic/.test(l)), false));
  check('every exported constant is deep-frozen, including nested objects and arrays',
    f([C.LEVELS, C.CITATIONS, C.FIRMNESS, C.GENOME, C.B_DNA, C.NUCLEAR_SPACE, C.THE_THIRTY_NANOMETRE_PROBLEM, C.WHAT_WE_GOT_WRONG, C.KNOWN_LIMITATIONS]
      .every(Object.isFrozen) &&
      Object.isFrozen(C.LEVELS[0].dimension) &&
      Object.isFrozen(C.THE_THIRTY_NANOMETRE_PROBLEM.what_a_viewer_should_therefore_draw), false));
  check('the module declares itself an evidence layer with no rendering code',
    f(/It renders nothing/.test(src) && !/canvas|THREE\.|WebGL/.test(src), false));
  check('worked() prints the ladder, the problem and the hand-worked case',
    f(/THE THIRTY NANOMETRE PROBLEM/.test(C.worked()) && /THE HAND-WORKED CASE/.test(C.worked()) && /0\.9115 m/.test(C.worked()), false));
}

// ------------------------------------------------------------------ 6. the holdout
console.log('\nthe holdout');
{
  // Read the SAME source the project's own leak checker reads (holdout/split.json, assignment
  // "holdout"), rather than a path guessed here, and build the patterns from it rather than retyping
  // any name into this file.
  const splitPath = path.join(root, 'holdout/split.json');
  let terms = [], loadedFrom = null, loadError = null;
  try {
    const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    terms = (split.taxa ?? []).filter(t => t.assignment === 'holdout')
      .flatMap(t => [t.name, t.slug, t.latin, t.scientific_name, t.common_name, t.taxon].filter(x => typeof x === 'string'))
      .map(s => s.toLowerCase());
    loadedFrom = 'holdout/split.json (assignment === "holdout")';
  } catch (e) { loadError = String(e.message).slice(0, 90); }

  const src = (fs.readFileSync(path.join(here, 'chromatin.mjs'), 'utf8') +
    fs.readFileSync(path.join(here, 'test-chromatin.mjs'), 'utf8')).toLowerCase();
  const hits = [...new Set(terms)].filter(t => t.length > 4 && src.includes(t));
  check('the held-out roster was read from the project\'s own split file',
    f(terms.length > 20, terms.length === 0), loadedFrom ? `${terms.length} names from ${loadedFrom}` : `could not load: ${loadError}`);
  check('no held-out taxon name appears in this module or its test',
    f(hits.length === 0 && terms.length > 20, false),
    hits.length ? `${hits.length} hit(s): ${hits.slice(0, 3).join(', ')}` : `${new Set(terms).size} names checked`);
  // And the authority itself, not our reimplementation of it:
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
