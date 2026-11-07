#!/usr/bin/env node
// THE END-TO-END DEMONSTRATION: take the worked example and actually produce the artefacts the format
// promises, then say what each one lost on the way out.
//
//   node organism-format/life/export-all.mjs
//
// spec.mjs lists four things a .life must yield - a genome as FASTA, a mesh per stage as binary STL, a
// phenotype vector per stage, and provenance for every number. A list of four things is a claim, and the
// only way to check a claim like that is to run it against the one real file in the directory and look at
// the bytes. So this script reads examples/mouse-preimplantation.life through read.mjs, exports every
// stage through stl.mjs, the genome through fasta.mjs, and compares the example to ITSELF through
// compare.mjs, where both distances must come out exactly 0 or something in the chain is broken.
//
// TWO THINGS THIS SCRIPT IS ARRANGED TO SHOW, which a demo that only printed successes would hide.
//
// 1. A REFUSAL IS A CORRECT OUTCOME. Two of the exports here refuse by default: the STL gate refuses
//    every stage of this example because its geometry is `depicted`, and the FASTA refuses the genome
//    because a reference-only genome has no edits and no inline sequences and a reconstructed chromosome
//    is not fasta.mjs's to emit. Neither is a crash and neither is a bug. The script prints the refusal
//    and carries on, because a demo that died on the first refusal would teach the reader that refusals
//    are failures - and then the next person would add a flag to turn them off.
//
// 2. WHAT THE EXPORTS LOSE IS PRINTED, NOT SUMMARISED. The lists come from stl.mjs WHAT_AN_STL_LOSES and
//    fasta.mjs WHAT_A_FASTA_LOSES, quoted rather than restated. A paraphrase here would drift from the
//    exporter it describes, and the drift would be invisible: the demo would keep printing a reassuring
//    list of losses while the exporter lost something else.

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import assert from 'node:assert/strict';

import { read } from './read.mjs';
import { exportStage, WHAT_AN_STL_LOSES, DEPICTION_MARKER, SHAPE_MODEL } from './stl.mjs';
import { toFasta, WHAT_A_FASTA_LOSES } from './fasta.mjs';
import { compare } from './compare.mjs';
import * as SPEC from './spec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(HERE, 'examples', 'mouse-preimplantation.life');
const OUT_DIR = join(HERE, 'examples', 'exports');

/** Every artefact written, or refused, in one list. The summary table is printed from this and nothing
 *  else, so a line in the table cannot disagree with what is on disk. */
const produced = [];
/** Every refusal, in the order it happened. Printed at the end as well as where it occurred, because a
 *  refusal scrolled past in the middle of 500 lines of output is a refusal nobody read. */
const refusals = [];

const rule = (ch = '=') => console.log(ch.repeat(96));
function section(n, title) {
  console.log('');
  rule();
  console.log(`${n}. ${title}`);
  rule();
}
const bytes = n => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} B`;
const shortPath = p => relative(HERE, p).replace(/\\/g, '/');

/** Print a block of `key: sentence` pairs with the sentences wrapped, because an 800-character line in a
 *  terminal is a line nobody finishes reading - and these are the lines that matter most. */
function printLosses(obj, indent = '  ') {
  const entries = Array.isArray(obj) ? obj.map((v, i) => [`(${i + 1})`, v]) : Object.entries(obj);
  for (const [k, v] of entries) {
    const label = `${indent}${k}: `;
    const width = 94 - label.length;
    const words = String(v).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      if (line && (line + ' ' + w).length > width) { lines.push(line); line = w; }
      else line = line ? `${line} ${w}` : w;
    }
    if (line) lines.push(line);
    console.log(label + lines[0]);
    for (const l of lines.slice(1)) console.log(' '.repeat(label.length) + l);
  }
}

// ===================================================================================================
// 1. READ: the status and the provenance census
// ===================================================================================================

section(1, 'READ  -  the file, its status, and its provenance census');

const text = readFileSync(EXAMPLE, 'utf8');
const res = read(text, { source: shortPath(EXAMPLE) });

console.log(`source:  ${shortPath(EXAMPLE)}  (${bytes(Buffer.byteLength(text, 'utf8'))})`);
console.log(`status:  ${res.status.toUpperCase()}`);
console.log(`         ${res.headline}`);
console.log('');
console.log(`census:  ${res.census.line}`);
console.log(`         ${res.census.total} value(s): ${res.census.may_be_treated_as_data} may be treated as data, ` +
  `${res.census.may_not_be_treated_as_data} may not, ${res.census.not_established} are not established at all.`);
console.log('');
console.log(`constraints: ${res.usable.constraints_applied} applied` +
  (res.usable.constraints_not_applied.length
    ? `, ${res.usable.constraints_not_applied.length} could not be applied: ${res.usable.constraints_not_applied.join('; ')}`
    : ''));
console.log('             (nothing checked is not a pass: an unapplied constraint degrades the file.)');

if (res.status === 'refused') {
  console.log('');
  console.log('The example was REFUSED, so nothing below could be exported from it. Problems:');
  for (const p of res.problems) console.log(`  - ${p.field}: ${p.what}`);
  process.exitCode = 1;
  rule();
  process.exit();
}

console.log('');
console.log(`channel coverage, over ${res.coverage.cells_total} cell(s) in ${res.coverage.stages_with_cells} of ${res.coverage.stages_total} stage(s):`);
for (const [name, c] of Object.entries(res.coverage.channels)) {
  if (c.cells_present === 0 && !c.declared) continue;
  console.log(`  ${name.padEnd(14)} ${c.headline}`);
}

console.log('');
console.log(`DEGRADED is not a pass. ${res.degradations.length} degradation(s) a reader must be told:`);
for (const d of res.degradations) console.log(`  - ${d.field}: ${d.what}`);

// ===================================================================================================
// 2. THE STL GATE: what happens when nobody asks for a depiction
// ===================================================================================================

section(2, 'STL GATE  -  the export refuses first, and that is the design');

const stages = res.life.timeline.stages;
const gated = [];
for (const s of stages) {
  const attempt = exportStage(s);                     // no allowDepicted: the default path
  if (attempt.refused) gated.push({ id: s.id, why: attempt.refused });
}

console.log(`${gated.length} of ${stages.length} stage(s) refused to export without { allowDepicted: true }.`);
console.log('');
if (gated.length) {
  console.log(`the refusal, in full, for ${JSON.stringify(gated[0].id)}:`);
  printLosses({ refused: gated[0].why }, '  ');
  if (gated.length > 1) {
    console.log('');
    console.log(`the other ${gated.length - 1} stage(s) refused for the same reason: ` +
      gated.slice(1).map(g => g.id).join(', '));
  }
  refusals.push(...gated.map(g => ({ where: `stl.mjs exportStage(${g.id})`, why: g.why })));
} else {
  console.log('No stage refused, which means every stage in this example carries measured geometry.');
  console.log('That is not true of the committed example, so if you are reading this the file has changed.');
}

// ===================================================================================================
// 3. STL EXPORT: one binary STL per stage, with DEPICTION in the name
// ===================================================================================================

section(3, 'STL EXPORT  -  one binary STL per stage, { allowDepicted: true }');

console.log('The example\'s geometry is `depicted`, so the flag has to be typed at the call site and the');
console.log(`filenames carry the ${DEPICTION_MARKER} marker. That marker is the point, not a nuisance: it is the`);
console.log('one piece of provenance that survives an STL being emailed.');
console.log('');

mkdirSync(OUT_DIR, { recursive: true });

const stlRows = [];
for (const s of stages) {
  const r = exportStage(s, { allowDepicted: true, subdivisions: 2 });
  if (r.refused) {
    console.log(`  ${String(s.id).padEnd(12)} REFUSED  ${r.refused}`);
    refusals.push({ where: `stl.mjs exportStage(${s.id}, {allowDepicted:true})`, why: r.refused });
    produced.push({ artefact: `${s.id} (STL)`, written: false, bytes: 0, note: 'refused' });
    continue;
  }
  const path = join(OUT_DIR, r.suggested_filename);
  writeFileSync(path, r.stl);
  const onDisk = statSync(path).size;
  assert.equal(onDisk, r.byte_length, `${r.suggested_filename}: ${onDisk} bytes on disk, exporter said ${r.byte_length}`);
  assert.equal(onDisk, 84 + 50 * r.triangle_count, `${r.suggested_filename}: not 84 + 50n bytes`);
  stlRows.push(r);
  produced.push({
    artefact: `${s.id} (STL)`, written: true, bytes: onDisk,
    path: shortPath(path),
    note: `${r.triangle_count} triangles, ${r.cells_drawn}/${r.cells_total} cells, provenance=${r.provenance_kind}`,
  });
  console.log(`  ${String(s.id).padEnd(12)} ${r.suggested_filename.padEnd(28)} ${String(r.triangle_count).padStart(5)} tri  ` +
    `${bytes(onDisk).padStart(11)}  cells ${r.cells_drawn}/${r.cells_total}  units=${r.units ?? 'UNSTATED'}`);
  if (r.skipped.length) for (const sk of r.skipped) console.log(`      skipped ${sk.id}: ${sk.why}`);
  if (r.contradicts_measured_area) console.log(`      ${r.contradicts_measured_area}`);
}

if (stlRows.length) {
  console.log('');
  console.log(`the 80-byte header of the last one, which is all the metadata an STL has:`);
  console.log(`  ${JSON.stringify(stlRows[stlRows.length - 1].header_text)}` +
    (stlRows[stlRows.length - 1].header_truncated ? '   (TRUNCATED to 80 bytes)' : ''));
  console.log('');
  console.log('and the shape model, recorded on every result whatever the provenance of the numbers was:');
  printLosses({ model: SHAPE_MODEL.model, kind: SHAPE_MODEL.kind, what_it_breaks: SHAPE_MODEL.what_it_breaks }, '  ');
}

// ===================================================================================================
// 4. FASTA EXPORT
// ===================================================================================================

section(4, 'FASTA EXPORT  -  the genome, or the refusal to invent one');

const fasta = toFasta(res.life.genome);

console.log(`genome representation: ${res.life.genome.representation}` +
  `, assembly ${JSON.stringify(res.life.genome.reference?.assembly ?? res.life.genome.assembly ?? null)}`);
console.log(`accounting: ${fasta.accounting.inputs} input(s) in -> ${fasta.accounting.emitted} record(s) + ` +
  `${fasta.accounting.omitted} omission(s) out.  balanced: ${fasta.accounting.balanced}`);
console.log('');

for (const r of fasta.refused) {
  console.log(`REFUSED (${r.refusal}): ${r.asked_for}`);
  printLosses({ why: r.why }, '  ');
  refusals.push({ where: `fasta.mjs toFasta (${r.refusal})`, why: r.why });
}
for (const o of fasta.omitted) {
  console.log(`OMITTED ${o.id} (${o.refusal})`);
  printLosses({ why: o.why, ...(o.what_would_fix_it ? { what_would_fix_it: o.what_would_fix_it } : {}) }, '  ');
  refusals.push({ where: `fasta.mjs omitted ${o.id} (${o.refusal})`, why: o.why });
}

if (fasta.records.length === 0) {
  console.log('');
  console.log('0 records, so NO .fa FILE WAS WRITTEN. A zero-byte FASTA is the one output worse than none:');
  console.log('it is a file called a genome that a pipeline will open, parse without complaint, and treat as');
  console.log('an empty genome rather than as an absent one. fasta.mjs refuses an empty RECORD for the same');
  console.log('reason, and this script will not route around its own module\'s refusal by writing the file here.');
  produced.push({ artefact: 'genome (FASTA)', written: false, bytes: 0, note: '0 records: refused, see above' });
} else {
  const path = join(OUT_DIR, 'genome.fa');
  writeFileSync(path, fasta.fasta, 'utf8');
  const onDisk = statSync(path).size;
  console.log(`${fasta.records.length} record(s) written to ${shortPath(path)}  (${bytes(onDisk)})`);
  console.log(`  ${fasta.unverified_records} of ${fasta.records.length} record(s) are UNVERIFIED (verified=no in the description line)`);
  console.log(`  ${fasta.records_without_genomic_context} edit record(s) carry no flanking reference sequence`);
  for (const r of fasta.records) console.log(`  >${r.id}  ${r.seq.length} bp  verified=${r.verified ? 'yes' : 'no'}`);
  produced.push({
    artefact: 'genome (FASTA)', written: true, bytes: onDisk, path: shortPath(path),
    note: `${fasta.records.length} record(s), ${fasta.unverified_records} unverified`,
  });
}

// ===================================================================================================
// 5. COMPARE THE EXAMPLE TO ITSELF
// ===================================================================================================

section(5, 'COMPARE  -  the example against itself, where both distances must be exactly 0');

// The weakest possible test of a distance function and the one it must not fail. A file compared with
// itself has distance 0 on every axis; anything else means the alignment dropped a stage, a trait was
// read differently on the two sides, or an edit key is not stable. It is also the only comparison in this
// directory whose answer is known in advance, which is what makes it worth asserting rather than printing.
const self = compare(res.life, res.life);

console.log(`stage pairs aligned: ${self.alignment.n_pairs} of ${stages.length}` +
  `   unpaired: ${self.alignment.unpaired_a.length} / ${self.alignment.unpaired_b.length}`);
console.log('');
console.log(`phenotypic distance: ${self.phenotypic.distance}` +
  `   over ${self.phenotypic.n_traits_used} trait component(s), ${self.phenotypic.n_excluded} excluded`);
console.log(`genetic distance:    ${self.genetic.distance}` +
  `   edits ${self.genetic.n_edits_a} vs ${self.genetic.n_edits_b}, assembly ${JSON.stringify(self.genetic.assembly)}`);
console.log(`combined distance:   ${self.combined_distance}   <- null on purpose: ${SPEC.REFUSALS.no_single_number_distance.split('.')[0]}.`);

assert.strictEqual(self.phenotypic.distance, 0,
  `phenotypic distance of a file against itself must be exactly 0, got ${self.phenotypic.distance}`);
assert.strictEqual(self.genetic.distance, 0,
  `genetic distance of a file against itself must be exactly 0, got ${self.genetic.distance}`);
assert.ok(self.phenotypic.n_traits_used > 0,
  'a distance of 0 over 0 traits is not agreement: n_traits_used must be positive, or the 0 above means nothing');
assert.strictEqual(self.combined_distance, null, 'combined_distance must stay null');
console.log('');
console.log(`both distances asserted === 0, over ${self.phenotypic.n_traits_used} trait component(s) from ` +
  `${self.phenotypic.n_stage_pairs} stage pair(s).`);
console.log('n_traits_used is asserted positive too, because a distance of 0 over 0 traits is not agreement -');
console.log('it is the coverage confound wearing the answer\'s clothes (compare.mjs WHAT_A_DISTANCE_HIDES).');

if (self.phenotypic.n_excluded) {
  console.log('');
  console.log(`${self.phenotypic.n_excluded} trait component(s) were excluded even comparing the file to itself.`);
  const why = new Map();
  for (const p of self.phenotypic.per_stage_pair) for (const e of p.excluded_because) {
    const k = `${e.trait}: ${e.why}`;
    why.set(k, (why.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...why].sort()) console.log(`  ${n}x  ${k}`);
  console.log('  Those are the traits this format carries and this distance cannot subtract. They are counted,');
  console.log('  never coerced: true - false = 1 is a number with no units.');
}
for (const w of self.warnings) console.log(`  warning: ${w.what}`);
for (const r of self.refused) console.log(`  refused: ${r.refusal}: ${r.why}`);

// ===================================================================================================
// 6. WHAT THE EXPORTS LOST
// ===================================================================================================

section(6, 'WHAT EACH EXPORT LOST  -  quoted from the exporters, not restated here');

console.log('stl.mjs WHAT_AN_STL_LOSES');
console.log('');
printLosses(WHAT_AN_STL_LOSES);
console.log('');
console.log('  and the one that is specific to this run:');
if (stlRows.length) printLosses({ units_lost: stlRows[0].units_lost }, '  ');

console.log('');
rule('-');
console.log('fasta.mjs WHAT_A_FASTA_LOSES');
console.log('');
printLosses(WHAT_A_FASTA_LOSES);

console.log('');
rule('-');
console.log('and the fourth thing, which is the only one that does not survive export AT ALL:');
console.log('');
printLosses({
  provenance: 'neither an STL nor a FASTA has a field for where a number came from. ' +
    `This run exported ${res.census.total} provenance-carrying value(s) - ${res.census.line} - into ` +
    `${produced.filter(p => p.written).length} file(s) that between them carry ${stlRows.length} 80-byte ` +
    'header(s) and one filename marker. That is the whole budget. Everything else is in the .life or nowhere.',
});

// ===================================================================================================
// 7. SUMMARY
// ===================================================================================================

section(7, 'SUMMARY  -  what was produced');

const totalLabel = `${produced.filter(p => p.written).length} file(s) written`;
const w0 = Math.max(10, totalLabel.length, ...produced.map(p => p.artefact.length));
const w1 = Math.max(9, ...produced.map(p => bytes(p.bytes).length));
console.log(`  ${'artefact'.padEnd(w0)}  ${'bytes'.padStart(w1)}  file / reason`);
console.log(`  ${'-'.repeat(w0)}  ${'-'.repeat(w1)}  ${'-'.repeat(44)}`);
for (const p of produced) {
  console.log(`  ${p.artefact.padEnd(w0)}  ${(p.written ? bytes(p.bytes) : '-').padStart(w1)}  ` +
    `${p.written ? p.path : `NOT WRITTEN: ${p.note}`}`);
  if (p.written && p.note) console.log(`  ${' '.repeat(w0)}  ${' '.repeat(w1)}  ${p.note}`);
}
const totalBytes = produced.filter(p => p.written).reduce((n, p) => n + p.bytes, 0);
console.log(`  ${'-'.repeat(w0)}  ${'-'.repeat(w1)}  ${'-'.repeat(44)}`);
console.log(`  ${totalLabel.padEnd(w0)}  ${bytes(totalBytes).padStart(w1)}  ${shortPath(OUT_DIR)}/`);

console.log('');
console.log(`${refusals.length} refusal(s) along the way, every one a correct outcome:`);
for (const r of refusals) console.log(`  - ${r.where}`);
console.log('');
console.log(`The file is ${res.status.toUpperCase()}. ${res.census.line}.`);
console.log(`Not one of the ${stlRows.length} mesh(es) above is evidence: ${res.usable.rendering_as_evidence}.`);
console.log('');
rule();
