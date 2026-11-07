#!/usr/bin/env node
// Tests for budget.mjs
//
//   node sim-engine/scales/molecular/test-budget.mjs [--fail-once]
//
// Six things are checked harder than the rest, because they are the six ways this module could do
// damage rather than merely be wrong.
//
//   1. THE CUBE. Every unit conversion in a volume calculation is cubed, and an occupancy computed with
//      the linear factor instead of the cubed one comes out a thousandfold high while still LOOKING
//      like a percentage. That is the error this module made and recorded (THE_CUBE_TRAP). So the
//      factor is asserted against 1000**3 written out in this file, and the occupancy of the single
//      biggest inventory item is RE-DERIVED here from first principles - count times volume over
//      container - rather than read back from the module. A thousandfold error fails it. So does a
//      tenfold error in either direction.
//
//   2. THE DNA ARITHMETIC, HAND-WORKED. About a metre of double helix per haploid genome copy is the
//      one number in this subject that a reader will check, and it is the one an exponent slip
//      destroys. The contour length and the compaction factor are both recomputed here from the
//      sourced base-pair count and the sourced rise, with the arithmetic written out, and asserted to
//      lie strictly inside bounds an order of magnitude wide. A module that returned 0.1 m or 10 m
//      fails. So does one that returned 1.0 cm or 1.0 km.
//
//   3. DISAGREEMENTS ARE INTERVALS, NOT AVERAGES. The ribosome count spans a factor of 2.9 between two
//      primary measurements. The test asserts that the module carries BOTH ends into the occupancy and
//      that the occupancy interval is genuinely wide - a module that silently averaged would produce a
//      point, and a point is what this asserts against.
//
//   4. NULLS CARRY REASONS. Every null in the module must have both a null_reason and a
//      what_would_resolve_it. A null with no reason is worse than a guess, because it looks like rigour.
//
//   5. OCCUPANCY REFUSES RATHER THAN GUESSES. A machine with a count and no volume must throw, not be
//      scored at zero. Scoring at zero is how an inventory comes out looking complete.
//
//   6. THE HOLDOUT. One clade is a frozen evaluation holdout for this project. This test does not carry
//      its name: it reads the project's own roster at runtime, builds the patterns from that, and scans
//      the module source. The gate is derived from the authority, not from a list retyped here, and the
//      project's own leak checker is then run on the directory.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own inversion asserts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from './budget.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, relTol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= relTol * Math.abs(b);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

// ------------------------------------------------------------------ 1. the cube
console.log('\nthe cube - unit conversions in a volume calculation');
{
  // Written out rather than imported: a micrometre is 1000 nanometres, so a cubic micrometre is
  // 1000 * 1000 * 1000 cubic nanometres. This is the factor THE_CUBE_TRAP got wrong by using 1000.
  const handFactor = 1000 * 1000 * 1000;
  check('nm^3 per um^3 is the cube of the linear factor, not the linear factor',
    f(B.UNITS.nm3_per_um3, 1000) === handFactor,
    `module says ${B.UNITS.nm3_per_um3}, hand value ${handFactor}`);
  check('the linear factor itself is NOT what the module uses',
    f(B.UNITS.nm3_per_um3 !== 1000, B.UNITS.nm3_per_um3 === 1000));
  check('a dalton is one gram per mole over the exact Avogadro constant',
    f(near(B.UNITS.gram_per_dalton, 1 / 6.02214076e23, 1e-12), false),
    `${B.UNITS.gram_per_dalton}`);

  // Re-derive the biggest inventory item's occupancy here, from first principles.
  //   3,300,000 ribosomes * 2247.712 nm^3 each = 7.4174e9 nm^3
  //   2425 um^3 * 1e9 nm^3/um^3                = 2.425e12 nm^3
  //   ratio                                    = 3.0587e-3, i.e. 0.31%
  const handRiboLow = (3.3e6 * 2247.712) / (2425 * handFactor);
  const modRibo = B.WORKED_INVENTORY.in_the_whole_cell.items.ribosome.fraction[0];
  check('the ribosome occupancy re-derived here matches the module to 0.5%',
    near(f(modRibo, modRibo * 1000), handRiboLow, 5e-3),
    `module ${modRibo.toExponential(4)}, hand ${handRiboLow.toExponential(4)}`);
  // The order-of-magnitude gate: a thousandfold error, or a tenfold error either way, breaks this.
  check('ribosome occupancy is between 0.1% and 5% of the cell, so a 10x error either way fails',
    f(modRibo > 1e-3 && modRibo < 5e-2, false),
    `${(modRibo * 100).toFixed(3)}%`);
  check('the inventory total is a fraction, not a multiple, of the cell',
    f(B.WORKED_INVENTORY.in_the_whole_cell.fraction[1] < 1, B.WORKED_INVENTORY.in_the_whole_cell.fraction[1] > 1),
    `${(B.WORKED_INVENTORY.in_the_whole_cell.fraction[1] * 100).toFixed(2)}% at the high end`);
  // Dimensional check: double the container, halve every fraction. A module that mixed units somewhere
  // inside would not scale cleanly.
  const a = B.occupancy({ counts: { x: 1e6 }, volumes: { x: 1000 }, container_um3: 100 });
  const b = B.occupancy({ counts: { x: 1e6 }, volumes: { x: 1000 }, container_um3: 200 });
  check('occupancy scales exactly inversely with the container volume',
    f(near(a.fraction[0], 2 * b.fraction[0], 1e-12), false),
    `${a.fraction[0]} vs ${b.fraction[0]}`);
  // And the single hand case: 1e6 particles of 1000 nm^3 in 100 um^3 = 1e9 nm^3 in 1e11 nm^3 = 1%.
  check('a hand case comes out at exactly one per cent', f(near(a.fraction[0], 0.01, 1e-12), false), `${a.fraction[0]}`);
}

// ------------------------------------------------------------------ 2. the DNA arithmetic, hand-worked
console.log('\nDNA in the nucleus - arithmetic re-done by hand');
{
  // Inputs, read from the module but used as INPUTS, not as answers:
  const bp = B.MACHINES.b_dna.genome.ungapped_bp;            // 2,948,318,359
  const rise_nm = B.MACHINES.b_dna.rise_per_bp_nm.straight_axis_fit; // 0.33337
  check('the sourced ungapped genome length is of the right order for this organism',
    f(bp > 2.5e9 && bp < 3.5e9, false), `${bp}`);
  check('the sourced rise per base pair is a third of a nanometre, not three or 0.03',
    f(rise_nm > 0.30 && rise_nm < 0.36, false), `${rise_nm} nm`);

  //   2,948,318,359 bp * 2 copies * 0.33337 nm = 1.9658e9 nm = 1.9658 m
  const handDiploid_m = bp * 2 * rise_nm * 1e-9;
  const modDiploid_m = B.DNA_IN_THE_NUCLEUS.contour_length_m.diploid[0];
  check('diploid contour length re-derived here matches the module',
    near(f(modDiploid_m, modDiploid_m * 10), handDiploid_m, 1e-9),
    `module ${modDiploid_m.toFixed(4)} m, hand ${handDiploid_m.toFixed(4)} m`);
  check('diploid contour length is between 0.5 and 5 metres, so a 10x error either way fails',
    f(modDiploid_m > 0.5 && modDiploid_m < 5, false), `${modDiploid_m.toFixed(3)} m`);
  check('haploid is half of diploid and triploid is three halves of it',
    f(near(B.DNA_IN_THE_NUCLEUS.contour_length_m.haploid[0] * 2, modDiploid_m, 1e-12) &&
      near(B.DNA_IN_THE_NUCLEUS.contour_length_m.hypertriploid_this_cell_line[0] * 2, modDiploid_m * 3, 1e-12), false));

  //   nuclear diameter: the sphere of 1000 um^3 has d = (6V/pi)^(1/3) = (1909.859)^(1/3) = 12.407 um
  const handDiam_um = Math.pow((6 * 1000) / Math.PI, 1 / 3);
  check('nuclear diameter is the equal-volume sphere diameter, re-derived here',
    near(f(B.CELL.nuclear_diameter.value, 6.2), handDiam_um, 1e-9),
    `module ${B.CELL.nuclear_diameter.value.toFixed(4)} um, hand ${handDiam_um.toFixed(4)} um`);
  check('the published radius for that volume, 6.2 um, is half of it to within 0.1%',
    f(near(B.CELL.nuclear_diameter.value / 2, 6.2, 1e-3), false),
    `${(B.CELL.nuclear_diameter.value / 2).toFixed(3)} um`);

  //   compaction = 1.9658 m / 12.407e-6 m = 1.584e5
  const handCompaction = handDiploid_m / (handDiam_um * 1e-6);
  const modCompaction = B.DNA_IN_THE_NUCLEUS.compaction_factor.diploid_against_nuclear_diameter[0];
  check('compaction factor re-derived here matches the module',
    near(f(modCompaction, modCompaction / 10), handCompaction, 1e-9),
    `module ${modCompaction.toExponential(3)}, hand ${handCompaction.toExponential(3)}`);
  check('compaction is of order 1e5, so a 10x error either way fails',
    f(modCompaction > 5e4 && modCompaction < 5e5, false), `${modCompaction.toExponential(2)}`);

  //   DNA's own volume: a 2.0 nm cylinder 1.9658e9 nm long is pi * 1^2 * 1.9658e9 = 6.176e9 nm^3
  //   = 6.176 um^3, which in a 1000 um^3 nucleus is 0.618%.
  const handDnaVol_um3 = (Math.PI * 1 * 1 * handDiploid_m * 1e9) / (1000 * 1000 * 1000);
  const modDnaFrac = B.DNA_IN_THE_NUCLEUS.dna_volume_in_the_nucleus.fraction_of_nuclear_volume[0];
  check('the DNA volume fraction re-derived here matches the module',
    near(f(modDnaFrac, modDnaFrac * 100), handDnaVol_um3 / 1000, 1e-6),
    `module ${(modDnaFrac * 100).toFixed(4)}%, hand ${(handDnaVol_um3 / 10).toFixed(4)}%`);
  check('DNA is UNDER two per cent of the nuclear volume: the compaction problem is about length, not volume',
    f(modDnaFrac < 0.02 && modDnaFrac > 0.001, false), `${(modDnaFrac * 100).toFixed(3)}%`);
  check('the module states that point rather than leaving the reader to infer it',
    f(/length and topology, not about\s+volume/.test(B.DNA_IN_THE_NUCLEUS.dna_volume_in_the_nucleus.the_point.replace(/\s+/g, ' ')) ||
      /not about volume/.test(B.DNA_IN_THE_NUCLEUS.dna_volume_in_the_nucleus.the_point.replace(/\s+/g, ' ')), false));

  // Nucleosome spacing: 2.948e9*2/193 = 3.055e7 in 1000 um^3 -> 30,550 per um^3 -> (1e9/30550)^(1/3) nm
  const handNucCount = (bp * 2) / 193;
  const handSpacing_nm = Math.cbrt((1000 * 1000 * 1000) / (handNucCount / 1000));
  const modSpacing_nm = B.DNA_IN_THE_NUCLEUS.nucleosome_spacing_in_the_nucleus.mean_centre_to_centre_nm[0];
  check('nucleosome mean spacing re-derived here matches the module',
    near(f(modSpacing_nm, modSpacing_nm * 2), handSpacing_nm, 1e-9),
    `module ${modSpacing_nm.toFixed(3)} nm, hand ${handSpacing_nm.toFixed(3)} nm`);
  check('nucleosomes are tens of nanometres apart, i.e. a few of their own diameters',
    f(modSpacing_nm > 20 && modSpacing_nm < 60, false), `${modSpacing_nm.toFixed(1)} nm`);
}

// ------------------------------------------------------------------ crowding and specific volume
console.log('\ncrowding');
{
  // 0.3 g/mL times a specific volume in cm^3/g is dimensionless, because 1 mL = 1 cm^3.
  const vf = B.volumeFraction(0.3);
  check('volumeFraction returns an interval, both ends positive and ordered',
    f(vf.lo > 0 && vf.hi > vf.lo, vf.hi < vf.lo), `[${vf.lo.toFixed(4)}, ${vf.hi.toFixed(4)}]`);
  check('a measured microbial cytoplasm comes out between a tenth and a half of its own volume in macromolecules',
    f(B.CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.lo > 0.08 &&
      B.CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.hi < 0.5, false),
    `${(B.CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.lo * 100).toFixed(1)}-${(B.CROWDING_AS_VOLUME_FRACTION.microbe_total_macromolecules.hi * 100).toFixed(1)}%`);
  check('cytoplasm is NOT dilute: even the lowest end of the mammalian protein-only figure is above 5% of volume',
    f(B.CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only.lo > 0.05, false),
    `${(B.CROWDING_AS_VOLUME_FRACTION.mammalian_protein_only.lo * 100).toFixed(1)}%`);
  check('the mammalian figure is labelled protein-only, not total macromolecules',
    f(/not total macromolecules/.test(B.CROWDING.mammalian.quantity), false));
  check('the missing mammalian total-macromolecule measurement is a null with a reason, not a plausible number',
    f(B.CROWDING.total_macromolecule_mass_concentration_mammalian.value === null &&
      B.CROWDING.total_macromolecule_mass_concentration_mammalian.null_reason.length > 40,
      typeof B.CROWDING.total_macromolecule_mass_concentration_mammalian.value === 'number'));
  check('the microbial concentration is in grams per millilitre, not milligrams',
    f(B.CROWDING.microbe.mass_concentration.units === 'g/mL' && B.CROWDING.microbe.mass_concentration.range[0] === 0.3,
      B.CROWDING.microbe.mass_concentration.range[0] === 300));

  // The specific volume is derived, and the one check available on it is that the interval contains the
  // conventional anhydrous protein value - which is a consistency check on the METHOD, not a source.
  check('the derived specific-volume interval contains the conventional anhydrous protein value',
    f(B.SPECIFIC_VOLUME.lo < 0.73 && B.SPECIFIC_VOLUME.hi > 0.73, false),
    `[${B.SPECIFIC_VOLUME.lo.toFixed(3)}, ${B.SPECIFIC_VOLUME.hi.toFixed(3)}] cm^3/g`);
  check('and it says that containing it is a check and not a citation',
    f(/not a citation/.test(B.SPECIFIC_VOLUME.consistency_check), false));
  // Re-derive one end by hand: 142872 A^3 is 142.872 nm^3 is 1.42872e-19 cm^3; 200280 Da is
  // 200280/6.02214076e23 g = 3.3258e-19 g; the ratio is 0.4296 cm^3/g.
  const handLo = (142872 / 1000) * 1e-21 / (200280 / 6.02214076e23);
  check('the low end of the specific volume re-derived here matches the module',
    near(f(B.SPECIFIC_VOLUME.lo, B.SPECIFIC_VOLUME.lo * 2), handLo, 1e-9),
    `module ${B.SPECIFIC_VOLUME.lo.toFixed(5)}, hand ${handLo.toFixed(5)}`);

  // Mean spacing: 1,525,243 per um^3 is (1e9/1525243)^(1/3) nm = 8.69 nm.
  const handProtSpacing = Math.cbrt(1e9 / 1525243);
  check('mean protein spacing re-derived here matches the module',
    near(f(B.PROTEIN_SPACING.nm, B.PROTEIN_SPACING.nm + 10), handProtSpacing, 1e-9),
    `module ${B.PROTEIN_SPACING.nm.toFixed(3)} nm, hand ${handProtSpacing.toFixed(3)} nm`);
  check('mean protein spacing is single-digit nanometres, i.e. about one protein diameter',
    f(B.PROTEIN_SPACING.nm > 5 && B.PROTEIN_SPACING.nm < 15, false), `${B.PROTEIN_SPACING.nm.toFixed(2)} nm`);
}

// ------------------------------------------------------------------ 3. disagreements stay intervals
console.log('\ndisagreements are kept, not averaged');
{
  const r = B.MACHINES.ribosome.counts.human_cell_line.range;
  check('the ribosome count is a range spanning the two primary measurements, not a point',
    f(r[0] === 3.3e6 && r[1] === 9.5e6, r[0] === r[1]), `[${r[0]}, ${r[1]}]`);
  check('the span is about a factor of three and the module says so',
    f(near(r[1] / r[0], 2.879, 0.01) && /factor of 2\.9/.test(B.RIBOSOME_COUNT_DISAGREEMENT.the_span), false),
    `ratio ${(r[1] / r[0]).toFixed(3)}`);
  check('all three reported values are recorded, including the one that is not a measurement',
    f(B.RIBOSOME_COUNT_DISAGREEMENT.the_values.length === 3 &&
      B.RIBOSOME_COUNT_DISAGREEMENT.the_values.some(v => /NOT a measurement/.test(v.kind)), false),
    `${B.RIBOSOME_COUNT_DISAGREEMENT.the_values.length} values`);
  check('the non-measurement is the middle, roundest value - the one most likely to be quoted onward',
    f(B.RIBOSOME_COUNT_DISAGREEMENT.the_values.find(v => /NOT a measurement/.test(v.kind)).count === 4.0e6, false));
  check('the module states that it did NOT take the median that its own compilation took',
    f(/not averaged, and the median was not taken/.test(B.RIBOSOME_COUNT_DISAGREEMENT.what_was_not_done), false));
  // The interval has to survive into the occupancy, which is the only place it matters.
  const occ = B.WORKED_INVENTORY.in_the_whole_cell.items.ribosome;
  check('both ends of the count reach the occupancy',
    f(occ.count[0] === r[0] && occ.count[1] === r[1], occ.count[0] === occ.count[1]));
  check('the resulting occupancy interval is wide - at least fivefold - so no reader can mistake it for a point',
    f(occ.fraction[1] / occ.fraction[0] > 5, false), `${(occ.fraction[1] / occ.fraction[0]).toFixed(1)}x`);
  check('occupancy declares that it is not a single number',
    f(B.WORKED_INVENTORY.in_the_whole_cell.is_a_single_number === false, B.WORKED_INVENTORY.in_the_whole_cell.is_a_single_number === true));

  // The protein-count disagreement, and the cell-volume chain of custody.
  check('the fourfold spread in measured protein copies per cell is recorded as a range',
    f(B.CELL.protein_copies.per_cell_range[1] / B.CELL.protein_copies.per_cell_range[0] > 3, false),
    `${(B.CELL.protein_copies.per_cell_range[1] / B.CELL.protein_copies.per_cell_range[0]).toFixed(1)}x`);
  check('the cell volume carries a chain-of-custody warning saying it was not confirmed at its primary source',
    f(/could not be confirmed at the primary source/.test(B.CELL.volume.chain_of_custody_warning), false));
  check('the cell and nuclear volumes are flagged as NOT self-consistent rather than silently paired',
    f(B.CELL.nuclear_volume.self_consistent_with_cell_volume === false,
      B.CELL.nuclear_volume.self_consistent_with_cell_volume !== false));
  check('the cell type behind the nuclear volume is marked as not established',
    f(B.CELL.nuclear_volume.cell_type_established === false, B.CELL.nuclear_volume.cell_type_established === true));
  check('the aneuploidy of the reference line is recorded, so diploid arithmetic is not applied to it silently',
    f(/[Hh]ypertriploid/.test(B.CELL.ploidy.statement) && /not 2x/.test(B.CELL.ploidy.consequence), false));
}

// ------------------------------------------------------------------ 4. nulls carry reasons
console.log('\nnulls');
{
  const nulls = B.nullsWithReasons();
  check('the module enumerates its own nulls', f(nulls.length >= 4, nulls.length === 0), `${nulls.length} nulls`);
  check('every null has a reason AND something that would resolve it',
    f(nulls.every(n => typeof n.null_reason === 'string' && n.null_reason.length > 30 &&
      typeof n.what_would_resolve_it === 'string' && n.what_would_resolve_it.length > 30), false),
    nulls.filter(n => !n.what_would_resolve_it).map(n => n.at).join(', ') || 'all have both');
  check('the mammalian polymerase count is null rather than borrowed from the microbial one',
    f(B.MACHINES.rna_polymerase.counts.mammalian.value === null &&
      B.MACHINES.rna_polymerase.counts.microbe.value === 4600,
      B.MACHINES.rna_polymerase.counts.mammalian.value === 4600));
  check('the DNA polymerase has neither a size nor a count, and says so twice',
    f(B.MACHINES.dna_polymerase.size.value === null && B.MACHINES.dna_polymerase.counts.mammalian.value === null,
      B.MACHINES.dna_polymerase.size.value !== null));
  check('its null reason refuses to write a remembered number rather than blaming the data',
    f(/from memory is the thing this file exists to refuse/.test(B.MACHINES.dna_polymerase.size.null_reason), false));
  check('the DNA polymerase count null names the cell-cycle problem, not just the absence of a source',
    f(/cell-cycle phase/.test(B.MACHINES.dna_polymerase.counts.mammalian.null_reason), false));
  check('the chromatin volume fraction is null rather than conflated with the DNA volume fraction',
    f(B.DNA_IN_THE_NUCLEUS.what_was_not_computed.value === null &&
      /not naked DNA/.test(B.DNA_IN_THE_NUCLEUS.what_was_not_computed.null_reason), false));
}

// ------------------------------------------------------------------ 5. occupancy refuses
console.log('\noccupancy refuses rather than guesses');
{
  let threw = false, msg = '';
  try { B.occupancy({ counts: { ribosome: 1e6, mystery: 1e6 }, volumes: { ribosome: 2248 } }); }
  catch (e) { threw = true; msg = e.message; }
  check('a machine with a count and no volume throws instead of being scored at zero',
    f(threw && /mystery/.test(msg), !threw), threw ? msg.slice(0, 80) : 'it did not throw');
  check('and the refusal says what to do about it',
    f(threw && /drop it from counts and say why/.test(msg), false));

  // A volume with no count is NOT an error - it is a machine we know the size of and not the number of,
  // which is the common case here - but it must be reported, not dropped.
  const partial = B.occupancy({ counts: { a: 10 }, volumes: { a: 100, b: 100 }, container_um3: 1 });
  check('a machine with a volume and no count is reported rather than silently dropped',
    f(partial.machines_with_no_count.length === 1 && partial.machines_with_no_count[0] === 'b',
      partial.machines_with_no_count.length === 0),
    JSON.stringify(partial.machines_with_no_count));

  for (const [label, args] of [
    ['no counts', { volumes: { a: 1 } }],
    ['no volumes', { counts: { a: 1 } }],
    ['a zero container', { counts: { a: 1 }, volumes: { a: 1 }, container_um3: 0 }],
    ['a negative container', { counts: { a: 1 }, volumes: { a: 1 }, container_um3: -5 }],
    ['a non-numeric count', { counts: { a: 'lots' }, volumes: { a: 1 } }],
    ['a three-element range', { counts: { a: [1, 2, 3] }, volumes: { a: 1 } }],
  ]) {
    let t = false;
    try { B.occupancy(args); } catch { t = true; }
    check(`occupancy refuses ${label}`, f(t, !t));
  }
  let vfThrew = false; try { B.volumeFraction(-1); } catch { vfThrew = true; }
  check('volumeFraction refuses a negative concentration', f(vfThrew, !vfThrew));
  let msThrew = false; try { B.MEAN_SPACING(0); } catch { msThrew = true; }
  check('MEAN_SPACING refuses a zero number density rather than returning Infinity', f(msThrew, !msThrew));

  // An unordered range must be normalised, not propagated, or the "lo" end of an occupancy could exceed
  // the "hi" end and every downstream comparison would silently invert.
  const swapped = B.occupancy({ counts: { a: [9, 1] }, volumes: { a: [200, 100] }, container_um3: 1 });
  check('a range given the wrong way round is ordered, not propagated',
    f(swapped.items.a.count[0] === 1 && swapped.items.a.volume_each_nm3[0] === 100 &&
      swapped.fraction[0] <= swapped.fraction[1], swapped.fraction[0] > swapped.fraction[1]));
}

// ------------------------------------------------------------------ the inventory's own honesty
console.log('\nthe inventory says what it is missing');
{
  const c = B.WORKED_INVENTORY.compared_with_measured_crowding;
  check('the inventory accounts for a minority of measured crowding, and reports that comparison',
    f(c.inventory_as_share_of_measured[1] < 1, c.inventory_as_share_of_measured[0] > 1),
    `${(c.inventory_as_share_of_measured[0] * 100).toFixed(1)}%-${(c.inventory_as_share_of_measured[1] * 100).toFixed(1)}% of measured crowding`);
  check('it names what is missing, and names enough of it to be useful',
    f(['cytoskeleton', 'membrane', 'proteasome', 'metabolic', 'mRNA'].every(k => c.what_is_missing_and_why_it_must_be.includes(k)), false));
  check('it says the inventory CANNOT match the measurement, rather than treating the gap as a defect to be closed',
    f(/CANNOT match/.test(c.what_is_missing_and_why_it_must_be) && /evidence of an error/.test(c.what_is_missing_and_why_it_must_be), false));
  check('the direction of every bias is stated, not just its existence',
    f(['Counts:', 'Volumes:', 'Container:', 'Ploidy:'].every(k => c.direction_of_every_bias.includes(k)), false));
  check('the nucleosome count is labelled a ceiling rather than a census',
    f(/ceiling, not a census/.test(B.WORKED_INVENTORY.nucleosome_count.note), false));

  // The nucleosome count re-derived: 2,948,318,359 * 2 / 203 and / 193.
  const n = B.nucleosomeCount({});
  const handLo = (2948318359 * 2) / 203, handHi = (2948318359 * 2) / 193;
  check('the nucleosome count re-derived here matches the module at both ends',
    f(near(n.count[0], handLo, 1e-12) && near(n.count[1], handHi, 1e-12), false),
    `module [${n.count[0].toExponential(3)}, ${n.count[1].toExponential(3)}]`);
  check('it is tens of millions per diploid nucleus, so a 10x error either way fails',
    f(n.count[0] > 1e7 && n.count[1] < 1e8, false), `${(n.count[0] / 1e6).toFixed(1)}-${(n.count[1] / 1e6).toFixed(1)} million`);
  check('a wider repeat length gives fewer nucleosomes, which is the only monotonicity here that could be inverted',
    f(B.nucleosomeCount({ nrl_bp: 400 }).count[0] < B.nucleosomeCount({ nrl_bp: 200 }).count[0], false));
}

// ------------------------------------------------------------------ provenance on every entry
console.log('\nprovenance');
{
  const needVerified = [
    ['CELL.volume', B.CELL.volume],
    ['CELL.nuclear_volume', B.CELL.nuclear_volume],
    ['CELL.ploidy', B.CELL.ploidy],
    ['CELL.protein_copies', B.CELL.protein_copies],
    ['CROWDING.microbe', B.CROWDING.microbe],
    ['CROWDING.mammalian', B.CROWDING.mammalian],
    ['SPECIFIC_VOLUME', B.SPECIFIC_VOLUME],
    ['MACHINES.ribosome', B.MACHINES.ribosome],
    ['MACHINES.nucleosome', B.MACHINES.nucleosome],
    ['MACHINES.rna_polymerase', B.MACHINES.rna_polymerase],
    ['MACHINES.b_dna.genome', B.MACHINES.b_dna.genome],
    ['MACHINES.b_dna.rise_per_bp_nm', B.MACHINES.b_dna.rise_per_bp_nm],
    ['MACHINES.nucleosome.spacing', B.MACHINES.nucleosome.spacing],
  ];
  const without = needVerified.filter(([, v]) => typeof v.verified_how !== 'string' || v.verified_how.length < 60).map(([k]) => k);
  check('every retrieved entry carries a verified_how saying what was fetched and read back',
    f(without.length === 0, false), without.length ? without.join(', ') : `${needVerified.length} entries checked`);
  check('verified_how entries name a concrete endpoint or accession, not just "the literature"',
    f(needVerified.every(([, v]) => /rcsb\.org|ncbi\.nlm|api\.ncbi|PMC\d|PMID \d|europepmc|Europe PMC|PubMed record/i.test(v.verified_how)), false));
  check('the organism is named on every count, and the cell type where there is one',
    f(B.MACHINES.ribosome.counts.human_cell_line.organism === 'Homo sapiens' &&
      B.MACHINES.ribosome.counts.human_cell_line.cell_type === 'HeLa' &&
      B.MACHINES.ribosome.counts.microbe.organism === 'Escherichia coli', false));
  check('the microbial count carries its growth state, because a count per cell depends on it',
    f(/growth rate 1\.11/.test(B.MACHINES.ribosome.counts.microbe.growth_state), false));
  check('the computed rise per base pair is labelled as computed from coordinates, with the method written out',
    f(/power iteration|principal axis/.test(B.MACHINES.b_dna.rise_per_bp_nm.how_it_was_computed) &&
      /36\.670/.test(B.MACHINES.b_dna.rise_per_bp_nm.how_it_was_computed), false));
  check('the bend correction is stated as a correction with its size, not folded in silently',
    f(/0\.46%/.test(B.MACHINES.b_dna.rise_per_bp_nm.bend_correction), false));
  check('the per-step spread in rise is reported, so "0.34 nm" is not presented as a constant',
    f(B.MACHINES.b_dna.rise_per_bp_nm.per_step_range_nm[1] / B.MACHINES.b_dna.rise_per_bp_nm.per_step_range_nm[0] > 1.3, false),
    `${B.MACHINES.b_dna.rise_per_bp_nm.per_step_range_nm.join(' - ')} nm`);
  check('the gapped and ungapped genome lengths are both carried, with the choice made visible',
    f(B.MACHINES.b_dna.genome.haploid_bp > B.MACHINES.b_dna.genome.ungapped_bp &&
      /4\.9%/.test(B.MACHINES.b_dna.genome.which_to_use), false));

  // The completeness diagnostic, which is what justifies deriving no volume from a deposited mass.
  check('the completeness diagnostic ranks the 1.9 A crystal structure as the only complete model',
    f(B.MACHINES.nucleosome.daltons_per_deposited_atom < 15 &&
      B.MACHINES.ribosome.daltons_per_deposited_atom > 17 &&
      B.MACHINES.rna_polymerase.daltons_per_deposited_atom > 18, false),
    `${B.MACHINES.nucleosome.daltons_per_deposited_atom.toFixed(1)} / ${B.MACHINES.ribosome.daltons_per_deposited_atom.toFixed(1)} / ${B.MACHINES.rna_polymerase.daltons_per_deposited_atom.toFixed(1)} Da per atom`);
  check('and the model_is_complete flags agree with it',
    f(B.MACHINES.nucleosome.model_is_complete === true && B.MACHINES.ribosome.model_is_complete === false,
      B.MACHINES.ribosome.model_is_complete === true));
  check('the method says explicitly that no volume is derived from a deposited molecular weight',
    f(/No volume here is converted from a deposited molecular weight/.test(B.VOLUME_METHOD.not_derived_from_mass), false));
  check('each structure volume is an interval whose two ends are labelled by their direction of error',
    f(/underestimates/.test(B.VOLUME_METHOD.why_an_interval) && /overestimates/.test(B.VOLUME_METHOD.why_an_interval), false));
  check('the van der Waals end really is below the dilated end for all three structures',
    f([B.MACHINES.ribosome, B.MACHINES.nucleosome, B.MACHINES.rna_polymerase]
      .every(m => m.vdw_union_nm3 < m.dilated_union_nm3), false));
  // A ribosome is larger than a pre-initiation complex is larger than a nucleosome. If any volume were
  // transcribed into the wrong slot, this ordering would break.
  check('the three computed volumes are in the right order relative to one another',
    f(B.MACHINES.nucleosome.vdw_union_nm3 < B.MACHINES.rna_polymerase.vdw_union_nm3 &&
      B.MACHINES.rna_polymerase.vdw_union_nm3 < B.MACHINES.ribosome.vdw_union_nm3, false));
  // And the ribosome's measured span is the one a viewer will draw, so pin it.
  check('the ribosome is tens of nanometres across, not hundreds and not single digits',
    f(B.MACHINES.ribosome.bounding_box_A.every(a => a > 250 && a < 320), false),
    `${B.MACHINES.ribosome.bounding_box_A.join(' x ')} A`);
  check('the polymerase entry refuses to be called a polymerase',
    f(/NOT the polymerase alone/.test(B.MACHINES.rna_polymerase.what) && B.MACHINES.rna_polymerase.polymer_entities === 23, false));
}

// ------------------------------------------------------------------ what the numbers forbid
console.log('\nwhat this rules out');
{
  const r = B.WHAT_THIS_RULES_OUT;
  check('at least the three required depictions are ruled out', f(r.length >= 3, r.length === 0), `${r.length} items`);
  check('every item names the depiction, the number that forbids it, and what to do instead',
    f(r.every(i => typeof i.depiction === 'string' && typeof i.forbidden_by === 'string' &&
      typeof i.the_number === 'function' && typeof i.what_the_viewer_must_do_instead === 'string'), false));
  const rendered = r.map(i => i.the_number());
  check('every the_number() evaluates to a string containing a digit, i.e. it really is tied to a number',
    f(rendered.every(s => typeof s === 'string' && /\d/.test(s)), false));
  const all = JSON.stringify(rendered) + JSON.stringify(r.map(i => i.depiction + i.forbidden_by));
  check('the sparse-cytoplasm depiction is ruled out and tied to the crowding figure',
    f(/sparse cytoplasm/i.test(all) && /CROWDING/.test(all), false));
  check('the nucleus-with-free-space depiction is ruled out and tied to the nucleosome spacing',
    f(/free space around the chromosomes/i.test(all) && /nucleosome_spacing_in_the_nucleus/.test(all), false));
  check('the oversized-ribosome depiction is ruled out and tied to the count and the cell volume',
    f(/ribosome drawn at/i.test(all) && /counts\.human_cell_line/.test(all) && /CELL\.volume/.test(all), false));
  check('the oversized-ribosome item computes an actual maximum drawable diameter',
    f(/largest they could be drawn is a sphere of \d+ nm/.test(r[2].the_number()), false), r[2].the_number().slice(-90));
  check('the nucleus item also rules out the OPPOSITE error of a DNA-stuffed nucleus',
    f(typeof r[1].the_opposite_error_is_also_ruled_out === 'function' &&
      /two orders of magnitude/.test(r[1].the_opposite_error_is_also_ruled_out()), false));
  check('the spacing-and-rise item exists, because drawing one value everywhere is its own error',
    f(r.some(i => /One nucleosome spacing drawn everywhere/.test(i.depiction)), false));
}

// ------------------------------------------------------------------ the recorded lesson
console.log('\nthe recorded lesson');
{
  const t = B.THE_CUBE_TRAP;
  check('the trap is recorded with what happened, why it was wrong, how it was caught and what changed',
    f(['what_happened', 'why_it_was_wrong', 'why_it_nearly_survived', 'how_it_was_caught', 'the_general_lesson', 'what_changed_in_the_code']
      .every(k => typeof t[k] === 'string' && t[k].length > 60), false));
  check('it names the actual wrong number that was produced, not a sanitised version',
    f(/306%/.test(t.what_happened), false));
  check('it names the factor and where it came from',
    f(/factor of a thousand/.test(t.why_it_was_wrong) && /LINEAR/.test(t.why_it_was_wrong), false));
  check('it does not claim the occupancy arithmetic caught its own error',
    f(/Not by the occupancy arithmetic/.test(t.how_it_was_caught), false));
  check('it names the independent route that did catch it',
    f(/mass/i.test(t.how_it_was_caught) && /disagreed by exactly 1e3/.test(t.how_it_was_caught), false));
  check('the lesson is general enough to transfer: it is about cubes, not about this one number',
    f(/EVERY UNIT CONVERSION IN A VOLUME CALCULATION IS CUBED/.test(t.the_general_lesson), false));
  check('it records that a plausible wrong answer recruits the real uncertainties as cover',
    f(/recruits the real uncertainties as cover/.test(t.why_it_nearly_survived), false));
  check('known limitations are recorded and include the two that undermine the most downstream numbers',
    f(B.KNOWN_LIMITATIONS.length >= 7 &&
      B.KNOWN_LIMITATIONS.some(l => /could not be confirmed at its primary source/.test(l)) &&
      B.KNOWN_LIMITATIONS.some(l => /do not fit\s+together/.test(l.replace(/\s+/g, ' ')) || /do not fit together/.test(l)), false),
    `${B.KNOWN_LIMITATIONS.length} limitations`);
  check('the limitations admit that the file contains no rates at all',
    f(B.KNOWN_LIMITATIONS.some(l => /Nothing here is a rate/.test(l)), false));
  check('exported constants are deep-frozen, including nested objects',
    f(Object.isFrozen(B.CELL) && Object.isFrozen(B.CROWDING) && Object.isFrozen(B.MACHINES) &&
      Object.isFrozen(B.MACHINES.ribosome.counts) && Object.isFrozen(B.WHAT_THIS_RULES_OUT) &&
      Object.isFrozen(B.KNOWN_LIMITATIONS) && Object.isFrozen(B.UNITS), false));
  // Same predicate, wrong pattern substituted under fault: names that DO exist, so the "no export
  // matches" claim must then be false. (The first version of this line injected a pattern that was
  // also absent, so both branches came out true and the line survived its own fault, asserting
  // nothing. --fail-once caught it.)
  check('no export is a single fused score',
    !Object.keys(B).some(k => f(/score|index|rating/i, /CELL|CROWDING|MACHINES/).test(k)),
    Object.keys(B).join(','));
  check('worked() runs and prints the comparison against measured crowding',
    f(/measured protein fraction/.test(B.worked()), false));
}

// ------------------------------------------------------------------ 6. the holdout
console.log('\nthe holdout');
{
  const splitPath = path.join(root, 'holdout/split.json');
  let terms = [], loadedFrom = null, loadError = null;
  try {
    const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    terms = (split.taxa ?? []).filter(t => t.assignment === 'holdout')
      .flatMap(t => [t.name, t.slug, t.latin, t.scientific_name, t.common_name, t.taxon].filter(x => typeof x === 'string'))
      .map(s => s.toLowerCase());
    loadedFrom = 'holdout/split.json (assignment === "holdout")';
  } catch (e) { loadError = String(e.message).slice(0, 90); }

  const src = (fs.readFileSync(path.join(here, 'budget.mjs'), 'utf8') +
    fs.readFileSync(path.join(here, 'test-budget.mjs'), 'utf8')).toLowerCase();
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
