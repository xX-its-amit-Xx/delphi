// GENOME -> FASTA. The first of the four things a .life must yield (life/spec.mjs), and the one that
// leaves the most behind.
//
// ============================== THE ONE REAL TRAP ==============================
// An edit list is a statement of INTENT. `kcnk5b-W169L, chr20:9232965 G>T, PROPOSED` is a sentence about
// what somebody means to build. It is not a sentence about a fish. The committed example in this
// repository says so in its own words - "Not built, not injected, not verified in any animal" - and that
// sentence lives in the .organism file, in a field called `status`, next to a correction about which
// published allele carries which substitution.
//
// A FASTA has no field called `status`. It has an identifier, a description line, and letters.
//
// So the moment this function runs, the design stops being a proposal and becomes a sequence. An aligner
// will happily place it. A tree builder will happily give it a branch. NEITHER CAN TELL - there is no
// signal in A, C, G and T that distinguishes a chromosome somebody sequenced from a window somebody typed.
// The output of a tree search over designed and real sequences looks exactly like the output of a tree
// search over real ones, and the designed tips are not marked unless we mark them.
//
// There is exactly one place left to say it: THE DESCRIPTION LINE. It is the last field in the pipeline
// that still belongs to us. So every record derived from an unverified edit carries, in that line,
// `verified=no` and `caveat=intent-not-observation`, and the module refuses to emit a record that would
// have nowhere to put it. That is not decoration. It is the only provenance that survives.
//
// The second-order version of the same trap, and the reason for REFUSALS.no_reconstructed_chromosome: it
// is technically easy to take an edit list plus a reference assembly and write out a whole chromosome.
// The result is 99.999 % somebody else's sequencing effort with a few letters changed, and a file called
// `designed-chr20.fa` will be read as assembled evidence by the third program that touches it. The honest
// unit is the WINDOW: the edit, its flanks if we actually have them, and nothing else.
//
// ============================== COORDINATES, HONESTLY ==============================
// This module does no coordinate translation. It passes `chrom`, `start` and `end` to the caller's
// `reference_fetcher` exactly as the file gave them, and the only arithmetic it does is `start - flank`
// and `end + flank`. The .organism example uses a 1-based VCF-style `position`; the .life edit shape in
// the ask uses `start`/`end`. Whether the fetcher reads those as 0-based half-open or 1-based inclusive is
// the FETCHER'S convention to declare, and a mismatch shows up as flanks that are off by one base. The
// description line therefore records the coordinates it was given, verbatim, so the off-by-one is at
// least visible afterwards.

import { REFUSALS as LIFE_REFUSALS } from './spec.mjs';

export const FORMAT = 'fasta (from life/0.1.0)';
export const DEFAULT_WIDTH = 70;
export const DEFAULT_FLANK = 60;

/** IUPAC nucleotide codes. Not amino acids: a genome FASTA that validates against the protein alphabet
 *  accepts `E`, `F`, `I`, `L`, `P`, `Q` and `Z` as nucleotides, which is how a frameshifted translation
 *  gets written into a file labelled "genome" and stays there. */
export const IUPAC_NUCLEOTIDE = Object.freeze({
  unambiguous: 'ACGTU',
  ambiguous: 'RYSWKMBDHVN',
  gap: '-.',
  note: 'U is accepted because an RNA cassette is a legitimate inline sequence. Mixing T and U in one record is not checked here and is not meaningful.',
  the_overlap_that_limits_this:
    'the nucleotide and amino-acid alphabets share eleven letters - A C G T N and the ambiguity codes ' +
    'R Y S W K M B D H V, every one of which is also an amino acid. So `MSWKRYVHDBN` passes this check ' +
    'and is also a peptide. An alphabet check reports bad characters; it cannot establish that a sequence ' +
    'is DNA. A protein is caught only when it happens to contain one of E F I J L O P Q X Z.',
});

const NT_SET = new Set((IUPAC_NUCLEOTIDE.unambiguous + IUPAC_NUCLEOTIDE.ambiguous).split(''));
const GAP_SET = new Set(IUPAC_NUCLEOTIDE.gap.split(''));

/**
 * What this module will not do. Frozen, because a refusal that can be reassigned at runtime is a default.
 * Each one exists because the alternative produces a file that LOOKS like sequencing output.
 */
export const REFUSALS = Object.freeze({
  no_reconstructed_chromosome:
    'it will NOT emit a whole reconstructed chromosome from an edit list plus a reference it does not ' +
    'have. Even with the reference in hand it will not: the product is a reference genome with a few ' +
    'letters changed, and shipping one as "the designed genome" invites it to be treated as assembled ' +
    'evidence for an animal that does not exist. The emitted unit is the edited window.',
  no_invented_reference:
    'it will NOT invent reference sequence. No N-padding to reach a requested flank length, no inferring ' +
    'a flank from a neighbouring edit, no filling `ref_seq` in from the alt. If no reference is supplied, ' +
    'the record carries only what the edit itself carries and says `genomic_context=absent` in its ' +
    'description line.',
  no_record_without_alt:
    'it will NOT emit a record for an edit whose `alt_seq` is absent. An edit that names coordinates and ' +
    'no replacement sequence is a coordinate, and a FASTA record invented from a coordinate is a guess ' +
    'with an identifier.',
  no_silent_drop:
    'it will NOT silently drop an edit or a sequence. Everything in the input appears either in `records` ' +
    'or in `omitted` with a reason, and `records.length + omitted.length` equals the number of inputs. A ' +
    'FASTA that is quietly short by one edit is the worst output here, because the file looks complete.',
  no_empty_record:
    'it will NOT emit a zero-length record. A deletion whose `alt_seq` is the empty string has no ' +
    'sequence of its own; with flanks it is emitted as the post-deletion junction, and without them it is ' +
    'omitted, because a `>id` followed by nothing parses as a sequence of length zero and aligns to ' +
    'everything.',
  no_unstamped_record:
    'it will NOT emit a record whose description line lacks provenance. Carried from .life: ' +
    LIFE_REFUSALS.no_unstamped_mesh.split('.')[0] + ' - and a FASTA loses its provenance exactly as a mesh does.',
});

/**
 * Everything the FASTA does not carry. Frozen and deliberately unflattering: this is the list a reader of
 * the FASTA alone cannot reconstruct, and therefore the list of things the .life must be consulted for.
 */
export const WHAT_A_FASTA_LOSES = Object.freeze([
  'provenance, beyond whatever fits in the description line. `kind`, `scope`, `source` and the whole ' +
    'value() discipline of organism-format/spec.mjs do not survive. The description line is a consolation, ' +
    'not an equivalent: it is free text that no downstream tool parses.',
  'coordinates, once the window is extracted. The record is a string of letters; which chromosome and ' +
    'which base it started at are in the description line and nowhere a tool will look.',
  'phase and ploidy. Nothing here says whether two edits are on the same chromosome copy, whether the ' +
    'organism is heterozygous, or whether the alt is one allele of two. A diploid design and a haploid ' +
    'one produce identical FASTA.',
  'zygosity and dominance. The example`s own largest schedule finding - that the allele is dominant, so ' +
    'an F1 suffices - is unexpressible in FASTA.',
  'whether the sequence exists in any physical tube. This is the big one. There is no character in the ' +
    'nucleotide alphabet that means "never synthesised", so a window typed from a paper and a window read ' +
    'off a sequencer are byte-identical on disk.',
  'the edits that were considered and REJECTED. The .organism carries them (`edits_considered_and_rejected`) ' +
    'and they are often the most informative part of a design. A FASTA has no place for a path not taken.',
  'the stage. A .life is a trajectory; a genome FASTA is timeless. Nothing in the output says which stage, ' +
    'or whether the edit is expressed at any of them.',
]);

// ---------------------------------------------------------------------------------------------------
// WRAPPING AND HEADERS

/**
 * FASTA line wrapping. `width` is the maximum residues per line; a sequence of exactly `width` is one
 * line, not one line and an empty one.
 */
export function wrap(seq, width = DEFAULT_WIDTH) {
  const s = String(seq ?? '');
  const w = Number(width);
  if (!Number.isInteger(w) || w < 1) throw new RangeError(`wrap: width must be a positive integer, got ${JSON.stringify(width)}`);
  if (s.length === 0) return '';
  const out = [];
  for (let i = 0; i < s.length; i += w) out.push(s.slice(i, i + w));
  return out.join('\n');
}

/** Whitespace and `=` are the two characters that break a `key=value` description line, so they are
 *  replaced rather than emitted. An empty field becomes `unstated`, because a key with no value reads as
 *  though the question was never asked. */
function tok(v) {
  if (v === null || v === undefined) return 'unstated';
  const s = String(v).trim().replace(/\s+/g, '_').replace(/=/g, '-');
  return s.length ? s : 'unstated';
}

/**
 * A FASTA description line: `>id key=value key=value`.
 *
 * Provenance is forced in. If the caller supplies no `provenance` field, one is added reading `UNSTATED`,
 * because the alternative is a record that looks clean and carries nothing - and the description line is
 * the only place a FASTA has for it (see REFUSALS.no_unstamped_record).
 */
export function header(id, fields = {}) {
  const parts = [];
  const f = { ...fields };
  if (!('provenance' in f) || f.provenance === null || f.provenance === undefined || String(f.provenance).trim() === '') {
    f.provenance = 'UNSTATED-no-provenance-was-supplied-for-this-record';
  }
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue;
    parts.push(`${tok(k)}=${tok(v)}`);
  }
  return `>${tok(id)}${parts.length ? ' ' + parts.join(' ') : ''}`;
}

/**
 * Reject characters outside the IUPAC nucleotide codes. Returns the OFFENDING CHARACTERS, not a boolean:
 * "invalid" sends a caller looking through 40 kb by eye, whereas "`Z` at offset 11" is actionable. A
 * boolean is also the shape that gets ignored.
 */
export function validateSeq(seq, { alphabet = null, gaps = false } = {}) {
  const s = String(seq ?? '');
  const allowed = alphabet
    ? new Set(String(alphabet).toUpperCase().split(''))
    : new Set([...NT_SET, ...(gaps ? GAP_SET : [])]);
  const at = [];
  const offending = [];
  const seen = new Set();
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (allowed.has(c.toUpperCase())) continue;
    at.push({ char: c, index: i });
    if (!seen.has(c)) { seen.add(c); offending.push(c); }
  }
  return {
    ok: offending.length === 0,
    length: s.length,
    offending,                       // the characters themselves, unique, in order of first appearance
    at: at.slice(0, 32),             // where, capped: a wholly wrong alphabet should not print a novel
    n_offending: at.length,
    alphabet: alphabet ? String(alphabet) : IUPAC_NUCLEOTIDE.unambiguous + IUPAC_NUCLEOTIDE.ambiguous + (gaps ? IUPAC_NUCLEOTIDE.gap : ''),
    why: offending.length
      ? `${at.length} character(s) outside the nucleotide alphabet: ${offending.map(c => JSON.stringify(c)).join(', ')}. A genome FASTA that carries these is either a protein sequence, a wrapped line that was not unwrapped, or a parsing accident.`
      : null,
  };
}

// ---------------------------------------------------------------------------------------------------
// NORMALISATION
//
// Two edit shapes exist in this repository and they are not the same. organism-format/examples/
// winged-zebrafish.organism writes `{gene, change, coordinates:{chromosome, position, ref, alt}, status,
// source}`; the .life edit shape is `{chrom, start, end, ref_seq, alt_seq, kind, provenance}`. Reading
// only one of them would make this module inapplicable to the only real file in the repository, so both
// are accepted and normalised here, in one visible place, rather than with `??` scattered through the
// emitter.

/** Flatten either edit shape into one. Returns `{..., shape}` naming which it recognised. */
export function normaliseEdit(e, i = 0) {
  const c = e?.coordinates ?? {};
  const ref_seq = e?.ref_seq ?? c.ref ?? c.ref_seq ?? null;
  const alt_seq = e?.alt_seq ?? c.alt ?? c.alt_seq ?? null;
  const start = e?.start ?? c.start ?? c.position ?? null;
  let end = e?.end ?? c.end ?? null;
  if (end === null && start !== null) end = typeof ref_seq === 'string' ? Number(start) + ref_seq.length : Number(start);
  const provenance = e?.provenance
    ?? (e?.source ? { kind: 'unstated', source: e.source } : null);
  return {
    id: e?.id ?? e?.gene ?? `edit-${i}`,
    chrom: e?.chrom ?? e?.chromosome ?? c.chromosome ?? c.chrom ?? null,
    start, end, ref_seq, alt_seq,
    kind: e?.kind ?? e?.class ?? null,
    gene: e?.gene ?? null,
    change: e?.change ?? null,
    status: e?.status ?? null,
    provenance,
    shape: ('coordinates' in (e ?? {})) ? 'organism/0.1.0' : 'life/0.1.0',
    raw: e,
  };
}

/** Flatten either genome shape: `{reference:{assembly, accession}}` or a bare `{assembly, assembly_source}`. */
export function normaliseGenome(genome) {
  const g = genome ?? {};
  const ref = g.reference ?? {};
  return {
    representation: g.representation ?? null,
    assembly: ref.assembly ?? g.assembly ?? null,
    accession: ref.accession ?? g.accession ?? g.assembly_source ?? null,
    reference_note: ref.note ?? null,
    edits: (Array.isArray(g.edits) ? g.edits : []).map(normaliseEdit),
    sequences: Array.isArray(g.sequences) ? g.sequences
      : Array.isArray(g.inline_sequences) ? g.inline_sequences
        : g.inline_sequences && typeof g.inline_sequences === 'object'
          ? Object.entries(g.inline_sequences).map(([id, seq]) => ({ id, seq, provenance: null }))
          : [],
  };
}

/**
 * Is this edit an observation or an intention? Unverified unless something in the file positively says
 * otherwise - the default has to fall this way, because a missing `provenance` block is overwhelmingly
 * more likely to mean "nobody recorded it" than "it was sequenced".
 */
export function editIsVerified(edit) {
  const k = edit?.provenance?.kind ?? null;
  const measured = k === 'measured' || k === 'measured-secondhand';
  const status = String(edit?.status ?? '');
  const disclaims = /proposed|not built|not injected|not verified|planned|intended|in silico/i.test(status);
  return { verified: Boolean(measured) && !disclaims, provenance_kind: k, status: edit?.status ?? null };
}

// ---------------------------------------------------------------------------------------------------
// EMISSION

function stampFields(edit, g, extra) {
  const v = editIsVerified(edit);
  return {
    assembly: g.assembly ?? 'UNNAMED',
    chrom: edit.chrom,
    start: edit.start,
    end: edit.end,
    edit_kind: edit.kind,
    ...(edit.gene ? { gene: edit.gene } : {}),
    ...(edit.change ? { change: edit.change } : {}),
    ...extra,
    provenance: edit.provenance
      ? `${edit.provenance.kind ?? 'unstated'}:${edit.provenance.source ?? 'no-source'}`
      : 'absent-from-the-edit',
    verified: v.verified ? 'yes' : 'no',
    ...(v.verified ? {} : { caveat: 'intent-not-observation: this sequence may never have been synthesised' }),
    ...(edit.status ? { status: edit.status } : {}),
  };
}

function flanksFor(edit, g, fetcher, flank) {
  // Not having flanks is a normal outcome, not an error. What is NOT allowed is manufacturing them.
  const none = { left: '', right: '', context: 'absent', why: 'no reference_fetcher was supplied, so no genomic context could be read' };
  if (typeof fetcher !== 'function') return none;
  if (edit.chrom === null || edit.start === null || edit.end === null) {
    return { ...none, why: 'the edit does not carry chrom/start/end, so no window could be requested' };
  }
  const ask = (start, end) => {
    if (end <= start) return '';
    let s;
    try { s = fetcher({ assembly: g.assembly, chrom: edit.chrom, start, end }); }
    catch { return null; }
    if (typeof s !== 'string' || s.length === 0) return null;
    return validateSeq(s).ok ? s : null;   // a fetcher that returns prose is not a reference
  };
  const L = ask(Number(edit.start) - flank, Number(edit.start)) || '';
  const R = ask(Number(edit.end), Number(edit.end) + flank) || '';
  if (!L && !R) {
    return { ...none, context: 'absent', why: 'the reference_fetcher returned no usable sequence for either flank' };
  }
  return {
    left: L, right: R,
    context: (L && R) ? 'both-flanks' : L ? 'left-flank-only' : 'right-flank-only',
    why: null,
  };
}

/**
 * One record per edit: the ALT window, with flanks when - and only when - a reference was actually read.
 *
 * `reference_fetcher({assembly, chrom, start, end})` returns the reference sequence for that window as a
 * string, or anything falsy when it cannot. It is called twice per edit, once per flank, and its
 * coordinate convention is its own (see the note at the top of this file). Returning a non-nucleotide
 * string is treated as a failure, not as sequence.
 *
 * Returns `{records, omitted}`. Every edit lands in exactly one of them.
 */
export function editsToFasta(genome, { reference_fetcher = null, flank = DEFAULT_FLANK, width = DEFAULT_WIDTH, alphabet = null } = {}) {
  const g = normaliseGenome(genome);
  const records = [];
  const omitted = [];

  for (const edit of g.edits) {
    if (edit.alt_seq === null || edit.alt_seq === undefined) {
      omitted.push({
        id: edit.id, from: 'edit', refusal: 'no_record_without_alt', why: REFUSALS.no_record_without_alt,
        what_would_fix_it: 'add `alt_seq` (the replacement sequence) to the edit, or accept that this edit is a coordinate and not a sequence',
      });
      continue;
    }
    const alt = String(edit.alt_seq);
    const v = validateSeq(alt, { alphabet });
    if (!v.ok) {
      omitted.push({
        id: edit.id, from: 'edit', refusal: 'invalid_alphabet', why: v.why, offending: v.offending,
        what_would_fix_it: 'correct the alt_seq, or pass an explicit `alphabet` if this really is a different alphabet',
      });
      continue;
    }
    const fl = flanksFor(edit, g, reference_fetcher, flank);
    const seq = fl.left + alt + fl.right;
    if (seq.length === 0) {
      omitted.push({
        id: edit.id, from: 'edit', refusal: 'no_empty_record', why: REFUSALS.no_empty_record,
        what_would_fix_it: 'supply a reference_fetcher so the deletion can be emitted as its post-deletion junction',
      });
      continue;
    }
    const fields = stampFields(edit, g, {
      window: alt.length === 0 ? 'deletion-junction' : 'alt',
      alt_bp: alt.length,
      ref_bp: edit.ref_seq === null ? 'unstated' : String(edit.ref_seq).length,
      genomic_context: fl.context,
      left_flank_bp: fl.left.length,
      right_flank_bp: fl.right.length,
      ...(fl.context === 'absent'
        ? { warning: `window-without-genomic-context: ${fl.why}. This record is the edited bases alone; it has no flanking reference sequence and must not be aligned as though it were a locus.` }
        : {}),
      coordinate_convention: 'as-given-in-the-file; this module does no 0-based/1-based translation',
    });
    records.push({
      id: edit.id, from: 'edit', input_id: edit.id, seq, width,
      fields, description: header(edit.id, fields).replace(/^>\S*\s?/, ''),
      verified: editIsVerified(edit).verified,
      has_genomic_context: fl.context !== 'absent',
    });
  }
  return { records, omitted };
}

/** Record ids must be unique or the FASTA cannot be parsed back. Collisions are renamed, visibly. */
function uniquify(records) {
  const seen = new Map();
  for (const r of records) {
    const base = tok(r.id);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if (n > 1) {
      r.id = `${base}.dup${n}`;
      r.fields = { ...r.fields, id_collision: `renamed from ${base}: two inputs claimed the same id, and a FASTA with a duplicate id cannot be parsed back` };
    } else {
      r.id = base;
    }
    r.description = header(r.id, r.fields).replace(/^>\S*\s?/, '');
  }
  return records;
}

/**
 * The whole genome as FASTA: explicit `sequences` first (a cassette, a transgene - things with no
 * reference to diff against), then one window per edit.
 *
 * Returns `{fasta, records, omitted, refused, accounting}`. `omitted` lists everything that could not be
 * emitted AND WHY, and `accounting` is the invariant worth asserting: inputs in, records plus omissions
 * out, nothing lost in the middle.
 */
export function toFasta(genome, {
  reference_fetcher = null,
  flank = DEFAULT_FLANK,
  width = DEFAULT_WIDTH,
  alphabet = null,
  reconstruct_chromosomes = false,
} = {}) {
  const g = normaliseGenome(genome);
  const records = [];
  const omitted = [];
  const refused = [];

  if (reconstruct_chromosomes) {
    refused.push({ asked_for: 'reconstruct_chromosomes', refusal: 'no_reconstructed_chromosome', why: REFUSALS.no_reconstructed_chromosome });
  }

  // ---- explicit sequences ------------------------------------------------------------------------
  for (let i = 0; i < g.sequences.length; i++) {
    const s = g.sequences[i] ?? {};
    const id = s.id ?? `sequence-${i}`;
    if (typeof s.seq !== 'string' || s.seq.length === 0) {
      omitted.push({
        id, from: 'sequence', refusal: 'no_empty_record',
        why: `${REFUSALS.no_empty_record} This entry carries ${s.seq === undefined ? 'no `seq` field' : JSON.stringify(String(s.seq).slice(0, 20))}.`,
        what_would_fix_it: 'supply the literal sequence, or remove the entry rather than shipping an empty one',
      });
      continue;
    }
    const v = validateSeq(s.seq, { alphabet });
    if (!v.ok) {
      omitted.push({ id, from: 'sequence', refusal: 'invalid_alphabet', why: v.why, offending: v.offending });
      continue;
    }
    const p = s.provenance ?? null;
    const measured = p?.kind === 'measured' || p?.kind === 'measured-secondhand';
    const fields = {
      ...(s.description ? { description: s.description } : {}),
      length_bp: s.seq.length,
      origin: 'inline-fasta: no reference to diff against, so the sequence is carried literally',
      genomic_context: 'not-applicable: this sequence is not a window into an assembly',
      provenance: p ? `${p.kind ?? 'unstated'}:${p.source ?? 'no-source'}` : 'absent-from-the-sequence',
      verified: measured ? 'yes' : 'no',
      ...(measured ? {} : { caveat: 'intent-not-observation: this sequence may never have been synthesised' }),
    };
    records.push({
      id, from: 'sequence', input_id: id, seq: s.seq, width, fields,
      description: header(id, fields).replace(/^>\S*\s?/, ''),
      verified: measured, has_genomic_context: false,
    });
  }

  // ---- edit windows ------------------------------------------------------------------------------
  const fromEdits = editsToFasta(genome, { reference_fetcher, flank, width, alphabet });
  records.push(...fromEdits.records);
  omitted.push(...fromEdits.omitted);

  if (g.representation === 'reference-only' && records.length === 0 && omitted.length === 0) {
    refused.push({
      asked_for: 'a FASTA from a reference-only genome', refusal: 'no_reconstructed_chromosome',
      why: 'a reference-only genome has no edits and no inline sequences: the FASTA for it is the published assembly, which is not this module\'s to emit. ' + REFUSALS.no_reconstructed_chromosome,
    });
  }

  uniquify(records);
  const fasta = records.map(r => `${header(r.id, r.fields)}\n${wrap(r.seq, r.width ?? width)}\n`).join('');
  const n_in = g.sequences.length + g.edits.length;

  return {
    fasta,
    records,
    omitted,
    refused,
    accounting: {
      inputs: n_in,
      emitted: records.length,
      omitted: omitted.length,
      balanced: records.length + omitted.length === n_in,
      why_it_matters: REFUSALS.no_silent_drop,
    },
    unverified_records: records.filter(r => !r.verified).length,
    records_without_genomic_context: records.filter(r => r.from === 'edit' && !r.has_genomic_context).length,
    what_this_fasta_loses: WHAT_A_FASTA_LOSES,
  };
}

/**
 * Parse a FASTA back. Here so that the round trip is checkable by anyone, not only by the test: a writer
 * whose output nothing can read is a writer with no test. Description lines are returned as text AND as
 * parsed `key=value` fields, with the caveat that the fields were never a real format - they are ours.
 */
export function parseFasta(text) {
  const records = [];
  let cur = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (line.startsWith('>')) {
      if (cur) records.push(cur);
      const sp = line.indexOf(' ');
      const id = sp === -1 ? line.slice(1) : line.slice(1, sp);
      const description = sp === -1 ? '' : line.slice(sp + 1);
      const fields = {};
      for (const t of description.split(' ')) {
        const eq = t.indexOf('=');
        if (eq > 0) fields[t.slice(0, eq)] = t.slice(eq + 1);
      }
      cur = { id, description, fields, seq: '' };
      continue;
    }
    if (cur && line.length) cur.seq += line.trim();
  }
  if (cur) records.push(cur);
  return records;
}

export const WHY_EACH_RULE = Object.freeze({
  provenance_in_the_description_line:
    'because it is the last field in the pipeline that belongs to us. An aligner sees only letters.',
  window_not_chromosome:
    'because a reconstructed chromosome is somebody else`s sequencing effort with a few letters changed, ' +
    'and it will be read as assembled evidence.',
  omitted_with_a_reason:
    'because a FASTA that is quietly short by one edit looks complete, and the missing edit is usually the ' +
    'one that could not be specified - which is to say, the interesting one.',
  offending_characters_not_a_boolean:
    'because "invalid" sends the caller reading 40 kb by eye, and a boolean is the shape that gets ignored.',
  unverified_by_default:
    'because a missing provenance block means nobody recorded it far more often than it means it was sequenced.',
});
