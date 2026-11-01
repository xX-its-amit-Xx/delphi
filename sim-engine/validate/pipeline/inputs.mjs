// What was actually supplied, and what sequence coverage that buys. Amit's signature takes "generated genomic
// sequence + base genomic sequence", and this project does not have either for any design: a DELPHI design is a
// parent parameter set plus deltas, with gene-level edits where it has any. So this module answers one question
// honestly and up front -- WHAT WAS GIVEN -- and refuses to let a document stand in for a genome.
//
//   sequence_basis: 'supplied'                      real sequence was handed in; loci_covered = records given
//                   'reconstructed-at-edited-loci'  a document with gene-level edits; sequence exists only at
//                                                   those loci, mapped through editplan's Ensembl GRCz11 coords
//                   'document-only'                 a document with no gene-level edit: NO sequence of any kind.
//                                                   loci_covered = 0. This is the usual case in this repo.
//
// A validator that reported a whole-genome comparison from a parameter document would be the dishonest failure
// mode, so `loci_covered` and `genome_fraction_assessed` are emitted on every call, including when they are 0.

import fs from 'node:fs';
import path from 'node:path';

const NUC = /^[ACGTUNRYKMSWBDHVacgtunrykmswbdhv\s>*-]+$/;
const DOC_LIKE = o => o && typeof o === 'object' && (Array.isArray(o.edits) || o.base || o.parents);

/** Zebrafish GRCz11 total assembly length, for the honest denominator under genome_fraction_assessed.
 *  Ensembl release 116 / GCA_000002035.4 (danio_rerio), primary assembly. */
export const GRCZ11_BP = 1_373_471_384;
export const GRCZ11_SOURCE = 'Ensembl GRCz11 (GCA_000002035.4) primary assembly total length; the denominator for genome_fraction_assessed';

/** Parse FASTA. Returns [{id, description, seq}]; a headerless blob becomes one anonymous record. */
export function parseFasta(text) {
  const out = [];
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('>')) { cur = { id: line.slice(1).trim().split(/\s+/)[0] || `record-${out.length + 1}`, description: line.slice(1).trim(), seq: '' }; out.push(cur); continue; }
    if (!line.trim()) continue;
    if (!cur) { cur = { id: 'record-1', description: '(no FASTA header given)', seq: '' }; out.push(cur); }
    cur.seq += line.replace(/\s+/g, '');
  }
  return out;
}

const alphabetOf = seq => {
  const s = seq.replace(/[\s-]/g, '').toUpperCase();
  if (!s) return 'empty';
  const acgtun = (s.match(/[ACGTUN]/g) || []).length;
  return acgtun / s.length >= 0.9 ? 'nucleotide' : 'other (not >=90% ACGTUN; treated as given, not as a genome)';
};

/**
 * Resolve one side of the comparison (`generated` or `base`).
 * Accepts: a design id, an inline organism document, a path to a FASTA/plain sequence file, or a raw sequence
 * string. Says which, and never upgrades one to another.
 */
export function resolveSide(value, { role, knownOrganismIds = [], simRoot = '.' } = {}) {
  const base = { role, given: null, supplied_as: null };
  if (value == null) return { ...base, given: 'absent', note: `no ${role} was supplied` };

  if (DOC_LIKE(value)) {
    return { ...base, given: 'document', supplied_as: 'inline organism document', id: value.id ?? null, document: value };
  }
  if (typeof value !== 'string') return { ...base, given: 'unusable', note: `${role} must be a design id, an organism document, a sequence file path or a sequence string; got ${typeof value}` };

  const s = value.trim();

  // A design id in the repository bundle or a saved document wins over a file-path reading, so that
  // "--generated winged-zebrafish" is never mistaken for a sequence.
  if (knownOrganismIds.includes(s)) return { ...base, given: 'design-id', supplied_as: 'repository design id', id: s };

  // A file?
  let p = null;
  try {
    const cand = path.isAbsolute(s) ? s : path.resolve(simRoot, s);
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) p = cand;
  } catch { /* not a path */ }
  if (p) {
    const text = fs.readFileSync(p, 'utf8');
    if (/^\s*[[{]/.test(text)) {
      try {
        const o = JSON.parse(text);
        if (DOC_LIKE(o)) return { ...base, given: 'document', supplied_as: `organism document read from ${s}`, id: o.id ?? null, document: o, file: s };
      } catch { /* fall through to sequence */ }
    }
    const recs = parseFasta(text);
    if (recs.length && recs.some(r => r.seq.length)) {
      return { ...base, given: 'sequence', supplied_as: `${text.trimStart().startsWith('>') ? 'FASTA' : 'plain sequence'} file ${s}`, file: s,
        records: recs.map(r => ({ id: r.id, description: r.description, length_bp: r.seq.length, alphabet: alphabetOf(r.seq) })),
        total_length_bp: recs.reduce((a, r) => a + r.seq.length, 0), sequences: recs };
    }
    return { ...base, given: 'unusable', supplied_as: `file ${s}`, note: `${s} is neither an organism document nor a readable FASTA/plain sequence` };
  }

  // A raw sequence pasted in?
  if (s.length >= 20 && NUC.test(s)) {
    const recs = parseFasta(s);
    return { ...base, given: 'sequence', supplied_as: 'sequence string passed directly', records: recs.map(r => ({ id: r.id, description: r.description, length_bp: r.seq.length, alphabet: alphabetOf(r.seq) })),
      total_length_bp: recs.reduce((a, r) => a + r.seq.length, 0), sequences: recs };
  }

  // An id we do not know. Say so with the list, rather than guessing a near match.
  return { ...base, given: 'unknown-id', supplied_as: 'a string that is neither a known design id, an existing file, nor a sequence',
    id: s, note: `"${s}" is not one of ${knownOrganismIds.join(', ')}, is not a file on disk, and does not read as a sequence` };
}

/**
 * The sequence-coverage statement for the pair. `editedLoci` is the list of gene-level edits found in the
 * generated document (empty for every parameter-only design in this repository).
 */
export function sequenceBasis({ generated, base, editedLoci = [], reconstruction = null }) {
  const bothSequence = generated.given === 'sequence' && base.given === 'sequence';
  if (bothSequence) {
    const loci = Math.min(generated.records.length, base.records.length);
    return {
      sequence_basis: 'supplied',
      loci_covered: loci,
      generated_records: generated.records.length, base_records: base.records.length,
      total_length_bp: { generated: generated.total_length_bp, base: base.total_length_bp },
      genome_fraction_assessed: +(generated.total_length_bp / GRCZ11_BP).toFixed(8),
      genome_fraction_denominator: GRCZ11_SOURCE,
      statement: `Real sequence was supplied for both sides: ${generated.records.length} generated record(s) (${generated.total_length_bp} bp) against ${base.records.length} base record(s) (${base.total_length_bp} bp). That is ${(generated.total_length_bp / GRCZ11_BP * 100).toFixed(5)} % of GRCz11 by length. Nothing outside these records was compared.`,
    };
  }
  if (generated.given === 'sequence' || base.given === 'sequence') {
    const seqSide = generated.given === 'sequence' ? 'generated' : 'base';
    const docSide = seqSide === 'generated' ? base : generated;
    return { sequence_basis: 'document-only', loci_covered: 0, genome_fraction_assessed: 0, genome_fraction_denominator: GRCZ11_SOURCE,
      statement: `A sequence was supplied for the ${seqSide} side only; the ${docSide.role} side is a ${docSide.given}. A sequence cannot be compared with a parameter document, so NO sequence comparison was made: loci_covered = 0.` };
  }
  if (editedLoci.length) {
    const ok = (reconstruction?.loci || []).filter(l => l.reconstructed).length;
    return {
      sequence_basis: 'reconstructed-at-edited-loci',
      loci_covered: ok,
      loci_requested: editedLoci.length,
      genome_fraction_assessed: reconstruction?.bp_covered ? +(reconstruction.bp_covered / GRCZ11_BP).toFixed(10) : 0,
      genome_fraction_denominator: GRCZ11_SOURCE,
      reconstruction,
      statement: `No generated genome exists. The design is its base plus edits, so sequence was reconstructed at the EDITED LOCI ONLY: ${ok} of ${editedLoci.length} edited locus/loci, through the editplan thread's Ensembl GRCz11 coordinate mapping (sim-engine/validate/editplan/editplan.mjs resolveGenomic). Every base outside those windows is the base organism's by construction and was NOT compared.`,
    };
  }
  return {
    sequence_basis: 'document-only', loci_covered: 0, genome_fraction_assessed: 0, genome_fraction_denominator: GRCZ11_SOURCE,
    statement: 'NO SEQUENCE WAS ASSESSED. Both sides were given as documents/design ids, and the generated document carries no gene-level edit, so there is no locus at which a generated sequence differs from the base and nothing to reconstruct. The differences between these two organisms are morphological parameter deltas, not alleles. loci_covered = 0; no part of the genome was compared.',
  };
}

/** Gene-level edits in a document, in the shape the scorer's `genotype_similarity` reads. */
export function geneEditsOf(doc) {
  const edits = Array.isArray(doc?.edits) ? doc.edits : [];
  return edits.filter(e => e && (e.level === 'gene' || e.gene || e.genotype || e.raw));
}

/**
 * Reconstruct sequence at the edited loci, reusing the editplan thread's coordinate mapping. Never invents a
 * window: a locus that could not be resolved is reported with its reason and does not count towards coverage.
 */
export async function reconstructAtEditedLoci(editedLoci, { editplan, network = false } = {}) {
  if (!editplan?.ok) return { ran: false, reason: editplan?.reason || 'the editplan module is absent', loci: editedLoci.map(e => ({ edit: e, reconstructed: false, reason: 'editplan absent' })) };
  const loci = [];
  let bp = 0;
  for (const e of editedLoci) {
    const gene = e.gene ?? e.target ?? null;
    const spec = e.raw ?? e.genotype ?? e.edit ?? null;
    if (!gene || !spec) { loci.push({ edit: e, reconstructed: false, reason: 'the edit names no gene and/or no edit spec, so no locus can be resolved' }); continue; }
    try {
      const res = await editplan.m.resolveGenomic(gene, spec, { network });
      const win = res?.window ?? res?.genomic_window ?? null;
      const len = (win?.seq?.length) ?? (res?.sequence?.length) ?? null;
      if (len) bp += len;
      loci.push({ edit: e, gene, spec, reconstructed: !!len, assembly: editplan.m.ASSEMBLY, chromosome: res?.chr ?? res?.chromosome ?? null,
        position: res?.genomic_position ?? res?.position ?? null, window_bp: len, source: 'editplan resolveGenomic (Ensembl REST, GRCz11)',
        ...(len ? {} : { reason: 'resolveGenomic returned no sequence window' + (network ? '' : ' (network disabled: pass --network to fetch)') }) });
    } catch (err) {
      loci.push({ edit: e, gene, spec, reconstructed: false, reason: `editplan resolveGenomic failed: ${err.message}` });
    }
  }
  return { ran: true, loci, bp_covered: bp, mapping: 'reused from sim-engine/validate/editplan/editplan.mjs (not duplicated here)' };
}
