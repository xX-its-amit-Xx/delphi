#!/usr/bin/env node
// Tests for life/fasta.mjs.
//
//   node organism-format/life/test-fasta.mjs
//   node organism-format/life/test-fasta.mjs --fail-once
//
// Under --fail-once every assertion is given a deliberately wrong predicate. EVERY line must then read
// FAIL. An assertion that still prints `ok` under its own injected fault asserts nothing about its
// subject and is not a test - which is why each fault here is an INVERSION of the real predicate rather
// than a nudged threshold: a nudged threshold is exactly the fault a weak assertion survives.
//
// The assertions that matter most are the two the module exists for: that nothing is silently dropped,
// and that a record derived from an unverified edit says so in its description line. The rest is plumbing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  wrap, header, validateSeq, editsToFasta, toFasta, parseFasta,
  normaliseEdit, normaliseGenome, editIsVerified,
  REFUSALS, WHAT_A_FASTA_LOSES, DEFAULT_WIDTH,
} from './fasta.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.join(HERE, '..', 'examples', 'winged-zebrafish.organism');

// ---------------------------------------------------------------------------------------------------
// FIXTURES. Four inputs: three edits (one of which carries no alt_seq and must be omitted) and one
// explicit cassette. The counts below are asserted, so the fixture is part of the test.
const GENOME = {
  representation: 'edit-list',
  reference: { assembly: 'GRCz11', accession: 'GCA_000002035.4', note: 'Ensembl Danio_rerio.GRCz11 primary assembly' },
  edits: [
    {
      id: 'kcnk5b-W169L', chrom: '20', start: 9232965, end: 9232966,
      ref_seq: 'G', alt_seq: 'T', kind: 'substitution',
      provenance: { kind: 'assumed', source: 'sim-engine/validate/bench/cases.mjs' },
    },
    {
      id: 'gfp-knock-in', chrom: '7', start: 1000, end: 1000,
      ref_seq: '', alt_seq: 'ACGTACGTNN', kind: 'knock-in',
      provenance: { kind: 'measured', source: 'Sanger sequencing of the donor plasmid, this lab' },
    },
    {
      // coordinates and nothing else. This is the one that must not vanish.
      id: 'coordinate-only', chrom: '3', start: 500, end: 501,
      ref_seq: 'A', kind: 'substitution',
      provenance: { kind: 'assumed', source: 'a planning spreadsheet' },
    },
  ],
  sequences: [
    {
      id: 'egfp-cassette', description: 'EGFP ORF with a 3xFLAG tag',
      seq: 'ATG' + 'ACGT'.repeat(30),
      provenance: { kind: 'measured', source: 'Addgene #00000, sequence-verified' },
    },
  ],
};
const N_INPUTS = GENOME.edits.length + GENOME.sequences.length;

/** A deterministic stand-in for a reference. Returns exactly the window asked for, nothing more. */
const FETCHER = ({ start, end }) => {
  const n = Math.max(0, end - start);
  return 'ACGT'.repeat(Math.ceil(n / 4) + 1).slice(0, n);
};

const plain = toFasta(GENOME);                                        // no reference at all
const flanked = toFasta(GENOME, { reference_fetcher: FETCHER, flank: 10 });
const rec = (res, id) => res.records.find(r => r.id === id);

// ---------------------------------------------------------------------------------------------------
console.log('\nwrapping');

{
  const lines = wrap('A'.repeat(70), 70).split('\n');
  check('a sequence of exactly the wrap width is ONE line, not one line and an empty one',
    f(lines.length === 1 && lines[0].length === 70,
      !(lines.length === 1 && lines[0].length === 70)),
    `${lines.length} line(s): ${lines.map(l => l.length).join(',')}`);
}
{
  const lines = wrap('A'.repeat(71), 70).split('\n');
  check('a sequence one over the wrap width is two lines of 70 and 1',
    f(lines.length === 2 && lines[0].length === 70 && lines[1].length === 1,
      !(lines.length === 2 && lines[0].length === 70 && lines[1].length === 1)),
    lines.map(l => l.length).join(','));
}
{
  const lines = wrap('A'.repeat(140)).split('\n');
  check(`the default wrap width is ${DEFAULT_WIDTH}`,
    f(DEFAULT_WIDTH === 70 && lines.length === 2 && lines.every(l => l.length === 70),
      !(DEFAULT_WIDTH === 70 && lines.length === 2 && lines.every(l => l.length === 70))),
    `${lines.length} line(s)`);
}
{
  const empty = wrap('', 70);
  check('an empty sequence wraps to an empty string, not to a bare newline',
    f(empty === '', empty !== ''), JSON.stringify(empty));
}
{
  let threw = false;
  try { wrap('ACGT', 0); } catch { threw = true; }
  check('a wrap width of zero throws rather than looping forever',
    f(threw === true, threw !== true));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nthe alphabet');

{
  const v = validateSeq('ACGZTQ');
  check('validateSeq returns the offending characters, and catches a Z',
    f(v.ok === false && v.offending.includes('Z'),
      !(v.ok === false && v.offending.includes('Z'))),
    JSON.stringify(v.offending));
}
{
  const v = validateSeq('ACGZTQ');
  check('it returns them rather than a boolean: both bad characters and their offsets',
    f(Array.isArray(v.offending) && v.offending.length === 2 && v.at[0].index === 3 && v.at[0].char === 'Z',
      !(Array.isArray(v.offending) && v.offending.length === 2 && v.at[0].index === 3 && v.at[0].char === 'Z')),
    JSON.stringify(v.at));
}
{
  const v = validateSeq('ACGTURYSWKMBDHVNacgtn');
  check('the full IUPAC nucleotide set, in either case, is accepted',
    f(v.ok === true && v.offending.length === 0,
      !(v.ok === true && v.offending.length === 0)),
    JSON.stringify(v.offending));
}
{
  const v = validateSeq('ACGT\nACGT');
  check('whitespace inside a sequence is an offending character, because a record cannot carry it',
    f(v.ok === false && v.offending.includes('\n'),
      !(v.ok === false && v.offending.includes('\n'))),
    JSON.stringify(v.offending));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nthe emitted file');

{
  const headers = plain.fasta.split('\n').filter(l => l.startsWith('>'));
  check('every record starts with > , and there is exactly one header per record',
    f(headers.length === plain.records.length && headers.length > 0 && headers.every(h => h.startsWith('>')),
      !(headers.length === plain.records.length && headers.length > 0 && headers.every(h => h.startsWith('>')))),
    `${headers.length} header(s), ${plain.records.length} record(s)`);
}
{
  const parsed = parseFasta(plain.fasta);
  const dirty = parsed.filter(r => /\s/.test(r.seq));
  check('an unwrapped record sequence contains no whitespace',
    f(parsed.length > 0 && dirty.length === 0,
      !(parsed.length > 0 && dirty.length === 0)),
    `${dirty.length} record(s) with whitespace`);
}
{
  const ids = plain.records.map(r => r.id);
  check('record ids are unique, or the FASTA cannot be parsed back at all',
    f(new Set(ids).size === ids.length, !(new Set(ids).size === ids.length)),
    ids.join(','));
}
{
  const bad = plain.records.filter(r => !/\bprovenance=/.test(r.description));
  check('every description line carries provenance, because the FASTA has nowhere else for it',
    f(bad.length === 0 && plain.records.length > 0,
      !(bad.length === 0 && plain.records.length > 0)),
    `${bad.length} record(s) unstamped`);
}
{
  const h = header('some id', { chrom: '20' });
  check('header() forces provenance in even when the caller supplies none',
    f(h.startsWith('>some_id ') && /provenance=UNSTATED/.test(h),
      !(h.startsWith('>some_id ') && /provenance=UNSTATED/.test(h))),
    h);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nnothing is silently dropped');

{
  const o = plain.omitted.find(x => x.id === 'coordinate-only');
  check('an edit with no alt_seq is OMITTED, with a reason, and never silently dropped',
    f(Boolean(o) && o.refusal === 'no_record_without_alt' && typeof o.why === 'string' && o.why.length > 40,
      !(Boolean(o) && o.refusal === 'no_record_without_alt' && typeof o.why === 'string' && o.why.length > 40)),
    o ? o.refusal : 'not in omitted');
}
{
  check('and it is nowhere in records: omitted means omitted',
    f(rec(plain, 'coordinate-only') === undefined, rec(plain, 'coordinate-only') !== undefined));
}
{
  const a = plain.accounting;
  check(`omitted + records accounts for every input (${N_INPUTS} in)`,
    f(a.inputs === N_INPUTS && plain.records.length + plain.omitted.length === N_INPUTS && a.balanced === true,
      !(a.inputs === N_INPUTS && plain.records.length + plain.omitted.length === N_INPUTS && a.balanced === true)),
    `${a.inputs} in, ${plain.records.length} emitted, ${plain.omitted.length} omitted`);
}
{
  // the same invariant with the reference present: flanks must not change what gets emitted
  const a = flanked.accounting;
  check('the accounting holds with a reference supplied too',
    f(a.balanced === true && flanked.records.length === plain.records.length,
      !(a.balanced === true && flanked.records.length === plain.records.length)),
    `${flanked.records.length} vs ${plain.records.length}`);
}
{
  const g = { representation: 'edit-list', reference: { assembly: 'GRCz11' }, edits: [
    { id: 'del-only', chrom: '1', start: 10, end: 20, ref_seq: 'ACGTACGTAC', alt_seq: '', kind: 'deletion', provenance: { kind: 'assumed', source: 'x' } },
  ] };
  const noRef = toFasta(g);
  const withRef = toFasta(g, { reference_fetcher: FETCHER, flank: 8 });
  check('a deletion with an empty alt and no flanks is omitted, not emitted as a zero-length record',
    f(noRef.records.length === 0 && noRef.omitted[0]?.refusal === 'no_empty_record' && withRef.records.length === 1,
      !(noRef.records.length === 0 && noRef.omitted[0]?.refusal === 'no_empty_record' && withRef.records.length === 1)),
    `${noRef.records.length} without ref, ${withRef.records.length} with`);
}
{
  const g = { representation: 'edit-list', reference: { assembly: 'GRCz11' }, edits: [
    { id: 'protein-by-accident', chrom: '1', start: 1, end: 2, ref_seq: 'A', alt_seq: 'MEEPQSD', kind: 'substitution', provenance: { kind: 'assumed', source: 'x' } },
  ] };
  const r = toFasta(g);
  // NOTE, and it is not a nitpick: the offending characters here are E, P and Q - NOT M and S, which are
  // legitimate IUPAC ambiguity codes (A-or-C, G-or-C). The nucleotide and amino-acid alphabets overlap on
  // eleven letters, so a protein sequence is caught only if it happens to contain one of the nine letters
  // that are not nucleotides. `MSWKRYVHDBN` validates cleanly as a nucleotide sequence and is also a
  // perfectly good peptide. This check therefore establishes that bad characters are REPORTED, and does
  // not establish that a protein sequence cannot get through. Nothing in an alphabet check can.
  check('an alt_seq outside the nucleotide alphabet is omitted with its offending characters',
    f(r.records.length === 0 && r.omitted[0]?.refusal === 'invalid_alphabet' && r.omitted[0].offending.join('') === 'EPQ',
      !(r.records.length === 0 && r.omitted[0]?.refusal === 'invalid_alphabet' && r.omitted[0].offending.join('') === 'EPQ')),
    JSON.stringify(r.omitted[0]?.offending ?? null));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nit does not invent reference sequence');

{
  const r = rec(plain, 'kcnk5b-W169L');
  check('with no reference supplied, the record is the alt bases ALONE - no padding, no inferred flanks',
    f(r.seq === 'T' && r.has_genomic_context === false,
      !(r.seq === 'T' && r.has_genomic_context === false)),
    JSON.stringify(r.seq));
}
{
  const r = rec(plain, 'kcnk5b-W169L');
  check('and it says so explicitly: genomic_context=absent plus a warning in the description line',
    f(/genomic_context=absent/.test(r.description) && /window-without-genomic-context/.test(r.description),
      !(/genomic_context=absent/.test(r.description) && /window-without-genomic-context/.test(r.description))),
    r.description.slice(0, 80));
}
{
  const r = rec(flanked, 'kcnk5b-W169L');
  const expect = FETCHER({ start: 9232955, end: 9232965 }) + 'T' + FETCHER({ start: 9232966, end: 9232976 });
  check('with a reference supplied, the record is left flank + alt + right flank, exactly',
    f(r.seq === expect && r.seq.length === 21 && /genomic_context=both-flanks/.test(r.description),
      !(r.seq === expect && r.seq.length === 21 && /genomic_context=both-flanks/.test(r.description))),
    `${r.seq.length} bp`);
}
{
  const dead = () => null;                       // a fetcher that cannot answer
  const r = toFasta(GENOME, { reference_fetcher: dead, flank: 10 });
  const one = rec(r, 'kcnk5b-W169L');
  check('a reference_fetcher that returns nothing yields a window, not a fabricated one',
    f(one.seq === 'T' && one.has_genomic_context === false,
      !(one.seq === 'T' && one.has_genomic_context === false)),
    JSON.stringify(one.seq));
}
{
  const prose = () => 'sorry, no reference available';
  const r = toFasta(GENOME, { reference_fetcher: prose, flank: 10 });
  const one = rec(r, 'kcnk5b-W169L');
  check('a fetcher that returns prose is treated as a failure, not as sequence',
    f(one.seq === 'T', one.seq !== 'T'), JSON.stringify(one.seq));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nintent is not observation');

{
  const r = rec(plain, 'kcnk5b-W169L');     // provenance kind `assumed`
  check('an unverified edit says so in its description line: verified=no and the caveat spelled out',
    f(r.verified === false && /verified=no/.test(r.description) && /intent-not-observation/.test(r.description),
      !(r.verified === false && /verified=no/.test(r.description) && /intent-not-observation/.test(r.description))),
    r.description.slice(0, 90));
}
{
  const r = rec(plain, 'gfp-knock-in');     // provenance kind `measured`
  check('a measured edit is marked verified=yes and carries no caveat',
    f(r.verified === true && /verified=yes/.test(r.description) && !/intent-not-observation/.test(r.description),
      !(r.verified === true && /verified=yes/.test(r.description) && !/intent-not-observation/.test(r.description))),
    r.description.slice(0, 90));
}
{
  const e = normaliseEdit({ id: 'x', alt_seq: 'A', provenance: { kind: 'measured', source: 's' }, status: 'PROPOSED. Not built, not injected.' });
  check('a status that disclaims the build overrides a measured provenance claim',
    f(editIsVerified(e).verified === false, editIsVerified(e).verified !== false));
}
{
  check('toFasta counts its unverified records, so a caller cannot miss them',
    f(plain.unverified_records === 1 && plain.records_without_genomic_context === 2,
      !(plain.unverified_records === 1 && plain.records_without_genomic_context === 2)),
    `${plain.unverified_records} unverified, ${plain.records_without_genomic_context} contextless`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nthe refusals');

{
  check('REFUSALS is frozen, and names the three refusals that matter',
    f(Object.isFrozen(REFUSALS) && 'no_reconstructed_chromosome' in REFUSALS && 'no_record_without_alt' in REFUSALS && 'no_silent_drop' in REFUSALS,
      !(Object.isFrozen(REFUSALS) && 'no_reconstructed_chromosome' in REFUSALS && 'no_record_without_alt' in REFUSALS && 'no_silent_drop' in REFUSALS)));
}
{
  const r = toFasta(GENOME, { reconstruct_chromosomes: true, reference_fetcher: FETCHER });
  const got = r.refused.find(x => x.refusal === 'no_reconstructed_chromosome');
  // the refusal must be recorded AND the output must be unchanged: every record is still a window or a
  // cassette, and the record count matches the run that never asked for a chromosome.
  const unchanged = r.records.length === flanked.records.length && r.records.every(x => x.from === 'edit' || x.from === 'sequence');
  check('asking for a whole reconstructed chromosome is REFUSED, even with a reference in hand',
    f(Boolean(got) && unchanged, !(Boolean(got) && unchanged)),
    got ? `refused; ${r.records.length} window(s) emitted instead` : 'no refusal recorded');
}
{
  const r = toFasta({ representation: 'reference-only', reference: { assembly: 'GRCz11' } });
  check('a reference-only genome yields no FASTA and says why: the assembly is not ours to emit',
    f(r.fasta === '' && r.refused.some(x => x.refusal === 'no_reconstructed_chromosome'),
      !(r.fasta === '' && r.refused.some(x => x.refusal === 'no_reconstructed_chromosome'))),
    `${r.refused.length} refusal(s)`);
}
{
  check('WHAT_A_FASTA_LOSES is frozen and names the four losses that bite',
    f(Object.isFrozen(WHAT_A_FASTA_LOSES)
      && WHAT_A_FASTA_LOSES.some(s => /provenance/i.test(s))
      && WHAT_A_FASTA_LOSES.some(s => /coordinates/i.test(s))
      && WHAT_A_FASTA_LOSES.some(s => /phase and ploidy/i.test(s))
      && WHAT_A_FASTA_LOSES.some(s => /physical tube/i.test(s)),
      !(Object.isFrozen(WHAT_A_FASTA_LOSES)
        && WHAT_A_FASTA_LOSES.some(s => /provenance/i.test(s))
        && WHAT_A_FASTA_LOSES.some(s => /coordinates/i.test(s))
        && WHAT_A_FASTA_LOSES.some(s => /phase and ploidy/i.test(s))
        && WHAT_A_FASTA_LOSES.some(s => /physical tube/i.test(s)))),
    `${WHAT_A_FASTA_LOSES.length} note(s)`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\nround trip');

{
  const parsed = parseFasta(flanked.fasta);
  const sameIds = parsed.map(r => r.id).join('|') === flanked.records.map(r => r.id).join('|');
  const sameSeqs = parsed.every((p, i) => p.seq === flanked.records[i].seq);
  check('parsing our own FASTA back recovers the same record ids and the same sequences',
    f(parsed.length === flanked.records.length && sameIds && sameSeqs,
      !(parsed.length === flanked.records.length && sameIds && sameSeqs)),
    `${parsed.length} parsed, ids ${sameIds}, seqs ${sameSeqs}`);
}
{
  // a record longer than one wrapped line, so the round trip actually exercises unwrapping
  const long = flanked.records.find(r => r.seq.length > DEFAULT_WIDTH);
  const back = parseFasta(flanked.fasta).find(r => r.id === long.id);
  check('a record longer than one line survives the wrap/unwrap round trip byte for byte',
    f(long.seq.length > DEFAULT_WIDTH && back.seq === long.seq,
      !(long.seq.length > DEFAULT_WIDTH && back.seq === long.seq)),
    `${long.id}: ${long.seq.length} bp`);
}
{
  const back = parseFasta(plain.fasta).find(r => r.id === 'kcnk5b-W169L');
  check('the provenance stamp survives the round trip as a parseable field',
    f(back.fields.verified === 'no' && back.fields.provenance.startsWith('assumed:'),
      !(back.fields.verified === 'no' && back.fields.provenance.startsWith('assumed:'))),
    JSON.stringify(back.fields.provenance));
}

// ---------------------------------------------------------------------------------------------------
console.log('\nthe committed example, which uses the OTHER edit shape');

{
  const have = fs.existsSync(EXAMPLE);
  const doc = have ? JSON.parse(fs.readFileSync(EXAMPLE, 'utf8')) : null;
  const g = have ? normaliseGenome(doc.genome) : null;
  check('the .organism example normalises: coordinates.{chromosome,position,ref,alt} -> chrom/start/ref_seq/alt_seq',
    f(have && g.assembly === 'GRCz11' && g.edits.length === 1 && g.edits[0].chrom === '20' && g.edits[0].alt_seq === 'T' && g.edits[0].shape === 'organism/0.1.0',
      !(have && g.assembly === 'GRCz11' && g.edits.length === 1 && g.edits[0].chrom === '20' && g.edits[0].alt_seq === 'T' && g.edits[0].shape === 'organism/0.1.0')),
    have ? `${g.edits.length} edit(s) against ${g.assembly}` : 'example file missing');

  const r = have ? toFasta(doc.genome) : null;
  check('and it emits one window, marked unverified, because its own status says PROPOSED',
    f(have && r.records.length === 1 && r.accounting.balanced === true && r.records[0].verified === false && /status=PROPOSED/.test(r.records[0].description),
      !(have && r.records.length === 1 && r.accounting.balanced === true && r.records[0].verified === false && /status=PROPOSED/.test(r.records[0].description))),
    have ? r.records[0]?.description.slice(0, 70) : 'example file missing');
}

// ---------------------------------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (FAULT) {
  console.log(`--fail-once: ${pass} assertion(s) survived their own injected fault.` +
    (pass === 0 ? ' Zero survivors: every assertion bites.' : ' Each survivor asserts nothing about its subject and is not a test.'));
}
process.exit(fail && !FAULT ? 1 : 0);
