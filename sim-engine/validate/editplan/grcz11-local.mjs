// LOCAL exhaustive off-target search against the GRCz11 primary assembly.
//
// WHY THIS EXISTS: the NCBI BLAST URL API path in editplan.mjs is correct but unusable in practice - every
// job we submitted sat in the public queue in Status=WAITING until the poll budget ran out, so every plan
// reported `ran: false` and the off-target table stayed empty. An unfilled off-target table is the single
// biggest reason a wet lab could not use one of these plans. This module fills it without a queue and
// without credentials.
//
// WHAT IT IS: a complete enumeration, not a heuristic alignment. It walks every position of both strands of
// every sequence in the primary assembly, keeps the positions whose PAM matches the nuclease's IUPAC motif,
// and for each of those counts mismatches against the spacer, keeping every site at or under the mismatch
// limit. There is no seeding step, so unlike blastn-short it cannot miss a site for want of an exact k-mer.
// For a 20-nt spacer with <= 4 mismatches this is therefore EXHAUSTIVE over the sequences indexed.
//
// WHAT IT STILL DOES NOT COVER (unchanged from the BLAST path, and stated in every result):
//   * BULGES. Cas9 tolerates DNA/RNA bulges (an insertion or deletion at the target). This counts
//     substitutions only, so a bulged off-target is invisible to it.
//   * Only the sequences in the index: the GRCz11 PRIMARY assembly (25 chromosomes, MT, unplaced scaffolds).
//     No alternative loci, no patches, and - the one that matters for a real experiment - not the genome of
//     the laboratory strain being injected. AB/TU/WIK differ from the reference at high SNP density, so a
//     site can exist in the fish that does not exist here, and vice versa.
//   * Chromatin, expression and delivery. A matched site is a SEQUENCE match. Whether Cas9 ever reaches it,
//     and whether a cut there matters, is not addressed.
//   * It is not a measurement. GUIDE-seq / CIRCLE-seq / amplicon sequencing of the actual fish is the
//     measurement; this is the list of places to look.
//
// No credentials are read or written anywhere in this file. The only network use is the one-time genome
// download, over plain anonymous HTTPS from the Ensembl FTP site.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export const ASSEMBLY = 'GRCz11';
export const GENOME_DIR = process.env.EDITPLAN_GENOME_DIR ? path.resolve(process.env.EDITPLAN_GENOME_DIR) : 'C:/Temp/grcz11';
export const FASTA_URL = 'https://ftp.ensembl.org/pub/current_fasta/danio_rerio/dna/Danio_rerio.GRCz11.dna.primary_assembly.fa.gz';
export const FASTA_FILE = path.join(GENOME_DIR, 'Danio_rerio.GRCz11.dna.primary_assembly.fa.gz');
const INDEX_DIR = path.join(GENOME_DIR, 'index');
const BIN_FILE = path.join(INDEX_DIR, 'grcz11.2bit.bin');
const MANIFEST = path.join(INDEX_DIR, 'manifest.json');
export const INDEX_FORMAT = 'one byte per base, A=0 C=1 G=2 T=3 anything-else=4, sequences concatenated in FASTA order with per-sequence offsets in manifest.json';

// code tables -------------------------------------------------------------------------------------
const CODE = new Uint8Array(256).fill(4);
CODE['A'.charCodeAt(0)] = 0; CODE['a'.charCodeAt(0)] = 0;
CODE['C'.charCodeAt(0)] = 1; CODE['c'.charCodeAt(0)] = 1;
CODE['G'.charCodeAt(0)] = 2; CODE['g'.charCodeAt(0)] = 2;
CODE['T'.charCodeAt(0)] = 3; CODE['t'.charCodeAt(0)] = 3;
const BASE = ['A', 'C', 'G', 'T', 'N'];
/** complement of a code; N (4) stays 4 */
const COMP = new Uint8Array([3, 2, 1, 0, 4]);

const IUPAC = { A: 'A', C: 'C', G: 'G', T: 'T', N: 'ACGT', R: 'AG', Y: 'CT', S: 'CG', W: 'AT', K: 'GT', M: 'AC', B: 'CGT', D: 'AGT', H: 'ACT', V: 'ACG' };
/** IUPAC letter -> bitmask over codes 0..3 */
function pamMask(letter) {
  const allowed = IUPAC[letter.toUpperCase()];
  if (!allowed) throw new Error(`not an IUPAC base: "${letter}"`);
  let m = 0;
  for (const b of allowed) m |= 1 << BASE.indexOf(b);
  return m;
}
const popcount = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

// index -------------------------------------------------------------------------------------------
export function indexStatus() {
  if (!fs.existsSync(MANIFEST) || !fs.existsSync(BIN_FILE)) {
    return { built: false, genome_dir: GENOME_DIR, fasta_present: fs.existsSync(FASTA_FILE),
      how_to_build: `node sim-engine/validate/editplan/grcz11-local.mjs build   (downloads ${FASTA_URL} into ${GENOME_DIR} if absent, then writes the index; ~410 MB download, ~1.37 GB index)` };
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const size = fs.statSync(BIN_FILE).size;
  return { built: size === m.total_length, genome_dir: GENOME_DIR, assembly: m.assembly, source: m.source,
    built_at: m.built_at, n_sequences: m.sequences.length, total_length_bp: m.total_length,
    n_chromosomes: m.sequences.filter(s => s.kind === 'chromosome').length,
    index_bytes: size, format: m.format,
    ...(size === m.total_length ? {} : { built: false, problem: `index file is ${size} bytes but the manifest says ${m.total_length}: rebuild` }) };
}

/** Download the primary assembly if it is not already on disk. Anonymous HTTPS, no credentials. */
export async function downloadGenome({ onProgress } = {}) {
  if (fs.existsSync(FASTA_FILE) && fs.statSync(FASTA_FILE).size > 300e6) return { downloaded: false, already_present: FASTA_FILE, bytes: fs.statSync(FASTA_FILE).size };
  fs.mkdirSync(GENOME_DIR, { recursive: true });
  const r = await fetch(FASTA_URL, { headers: { 'User-Agent': 'delphisci-sim-engine-editplan/0.1 (research; no credentials)' } });
  if (!r.ok) throw new Error(`Ensembl FTP returned HTTP ${r.status} for ${FASTA_URL}`);
  const total = Number(r.headers.get('content-length') || 0);
  const tmp = FASTA_FILE + '.part';
  const out = fs.createWriteStream(tmp);
  let got = 0;
  for await (const chunk of r.body) { got += chunk.length; out.write(chunk); if (onProgress && got % (32 << 20) < chunk.length) onProgress(got, total); }
  await new Promise((res, rej) => out.end(err => err ? rej(err) : res()));
  fs.renameSync(tmp, FASTA_FILE);
  return { downloaded: true, file: FASTA_FILE, bytes: got, url: FASTA_URL };
}

/** Build the one-byte-per-base index from the gzipped FASTA. Streams, so memory stays flat. */
export async function buildIndex({ log = () => {} } = {}) {
  await downloadGenome({ onProgress: (g, t) => log(`download ${(g / 1e6).toFixed(0)}/${(t / 1e6).toFixed(0)} MB`) });
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  const tmpBin = BIN_FILE + '.part';
  const out = fs.createWriteStream(tmpBin);
  const sequences = [];
  let offset = 0, cur = null, pending = '';
  const buf = Buffer.allocUnsafe(1 << 20);
  let bufLen = 0;
  const flush = () => { if (bufLen) { out.write(Buffer.from(buf.subarray(0, bufLen))); bufLen = 0; } };
  const writeSeqLine = line => {
    for (let i = 0; i < line.length; i++) {
      buf[bufLen++] = CODE[line.charCodeAt(i)];
      if (bufLen === buf.length) flush();
    }
    offset += line.length; cur.length += line.length;
  };
  const gunzip = zlib.createGunzip();
  const src = fs.createReadStream(FASTA_FILE);
  src.pipe(gunzip);
  gunzip.setEncoding('latin1');
  for await (const chunk of gunzip) {
    pending += chunk;
    let nl;
    while ((nl = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, nl).replace(/\r$/, '');
      pending = pending.slice(nl + 1);
      if (line[0] === '>') {
        const name = line.slice(1).split(/\s+/)[0];
        const kind = /dna:chromosome/.test(line) ? 'chromosome' : /dna:scaffold/.test(line) ? 'scaffold' : 'other';
        cur = { name, kind, offset, length: 0 };
        sequences.push(cur);
        if (sequences.length % 100 === 0) log(`indexing: ${sequences.length} sequences, ${(offset / 1e6).toFixed(0)} Mb`);
      } else if (line) writeSeqLine(line);
    }
  }
  if (pending.trim() && pending[0] !== '>') writeSeqLine(pending.trim());
  flush();
  await new Promise((res, rej) => out.end(err => err ? rej(err) : res()));
  fs.renameSync(tmpBin, BIN_FILE);
  const manifest = { assembly: ASSEMBLY, species: 'Danio rerio', source: FASTA_URL,
    source_file: path.basename(FASTA_FILE), source_bytes: fs.statSync(FASTA_FILE).size,
    built_at: new Date().toISOString(), format: INDEX_FORMAT, total_length: offset, sequences };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  return indexStatus();
}

let MEMO_MANIFEST = null;
function manifest() { return MEMO_MANIFEST ??= JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); }

/** Read one indexed sequence back as codes. */
function readSeq(fd, s) {
  const a = new Uint8Array(s.length);
  let got = 0;
  while (got < s.length) got += fs.readSync(fd, a, got, Math.min(1 << 24, s.length - got), s.offset + got);
  return a;
}
/** Decode a slice of codes to letters. */
const decode = (a, from, to) => { let s = ''; for (let i = from; i < to; i++) s += BASE[a[i]]; return s; };

/**
 * One indexed sequence as letters. Exists so a test can brute-force a naive reference scan over a small
 * sequence and compare it with scanGenome's output - which is the only way to check the exhaustiveness
 * claim rather than assert it in a comment.
 */
export function getSequence(name) {
  const st = indexStatus();
  if (!st.built) return null;
  const s = manifest().sequences.find(x => x.name === name);
  if (!s) return null;
  const fd = fs.openSync(BIN_FILE, 'r');
  try { return decode(readSeq(fd, s), 0, s.length); } finally { fs.closeSync(fd); }
}

// search ------------------------------------------------------------------------------------------
/**
 * One query = one spacer with its nuclease geometry.
 * @typedef {{spacer: string, pam: string, pam_side: '3prime'|'5prime', label?: string}} Query
 */

/**
 * Exhaustive PAM-anchored mismatch scan of the indexed assembly.
 *
 * @param {Query[]} queries  queries sharing nothing in particular; they are grouped internally by geometry so
 *                           each distinct (pam, pam_side, spacer length) costs one pass over the genome.
 * @param opts.maxMismatches substitutions allowed between the genomic protospacer and the spacer (default 4)
 * @param opts.sequences     'all' (default) | 'chromosomes' | an array of sequence names
 * @param opts.maxSitesPerQuery  stop collecting (not stop scanning) after this many sites, to bound memory
 */
export function scanGenome(queries, { maxMismatches = 4, sequences = 'all', maxSitesPerQuery = 20000, onProgress } = {}) {
  const st = indexStatus();
  if (!st.built) return { ran: false, reason: 'the local GRCz11 index is not built', index: st };
  const man = manifest();
  const wanted = sequences === 'all' ? man.sequences
    : sequences === 'chromosomes' ? man.sequences.filter(s => s.kind === 'chromosome')
    : man.sequences.filter(s => sequences.includes(s.name));
  if (!wanted.length) return { ran: false, reason: `no indexed sequence matched ${JSON.stringify(sequences)}` };

  // group by geometry
  const groups = new Map();
  for (const q of queries) {
    const spacer = q.spacer.toUpperCase();
    const key = `${q.pam}|${q.pam_side}|${spacer.length}`;
    if (!groups.has(key)) groups.set(key, { pam: q.pam.toUpperCase(), pam_side: q.pam_side, spacerLen: spacer.length, qs: [] });
    const codes = new Uint8Array(spacer.length);
    for (let i = 0; i < spacer.length; i++) codes[i] = CODE[spacer.charCodeAt(i)];
    groups.get(key).qs.push({ ...q, spacer, codes, sites: [], truncated: false });
  }

  const t0 = Date.now();
  const fd = fs.openSync(BIN_FILE, 'r');
  let scannedBp = 0;
  try {
    for (const s of wanted) {
      const g = readSeq(fd, s);
      for (const grp of groups.values()) scanOne(g, s, grp, maxMismatches, maxSitesPerQuery);
      scannedBp += s.length;
      if (onProgress) onProgress({ sequence: s.name, scanned_bp: scannedBp, total_bp: man.total_length, elapsed_ms: Date.now() - t0 });
    }
  } finally { fs.closeSync(fd); }

  const out = [];
  for (const grp of groups.values()) for (const q of grp.qs) {
    q.sites.sort((a, b) => a.n_mismatches - b.n_mismatches || (a.chromosome < b.chromosome ? -1 : 1) || a.start - b.start);
    out.push(q);
  }
  return { ran: true, elapsed_ms: Date.now() - t0, scanned_bp: scannedBp, n_sequences_scanned: wanted.length,
    max_mismatches: maxMismatches, queries: out };
}

/** The hot loop. PAM-anchored on the single most restrictive PAM position, then a mismatch count with early exit. */
function scanOne(g, seqInfo, grp, maxMm, cap) {
  const P = grp.pam.length, L = grp.spacerLen, S = P + L;
  const spOff = grp.pam_side === '3prime' ? 0 : P;       // spacer offset inside the site, protospacer-strand coords
  const pamOff = grp.pam_side === '3prime' ? L : 0;
  const masks = new Int32Array(P);
  for (let j = 0; j < P; j++) masks[j] = pamMask(grp.pam[j]);
  // check the most restrictive PAM positions first; drop fully degenerate (N) positions entirely
  const order = [...Array(P).keys()].filter(j => popcount(masks[j]) < 4).sort((a, b) => popcount(masks[a]) - popcount(masks[b]));
  const nOrd = order.length;
  const n = g.length;
  const qs = grp.qs, nq = qs.length;
  const last = n - S;

  for (let w = 0; w <= last; w++) {
    // ---- plus strand: protospacer-strand index t maps to g[w + t]
    let ok = true;
    for (let o = 0; o < nOrd; o++) { const j = order[o]; if (!((masks[j] >> g[w + pamOff + j]) & 1)) { ok = false; break; } }
    if (ok) {
      const b = w + spOff;
      for (let qi = 0; qi < nq; qi++) {
        const q = qs[qi], c = q.codes;
        let mm = 0, bad = false;
        for (let k = 0; k < L; k++) { const gb = g[b + k]; if (gb === 4) { bad = true; break; } if (gb !== c[k]) { if (++mm > maxMm) break; } }
        if (!bad && mm <= maxMm) record(q, g, seqInfo, w, S, 1, spOff, pamOff, P, L, c, cap);
      }
    }
    // ---- minus strand: protospacer-strand index t maps to COMP[g[w + S - 1 - t]]
    ok = true;
    const e = w + S - 1;
    for (let o = 0; o < nOrd; o++) { const j = order[o]; if (!((masks[j] >> COMP[g[e - pamOff - j]]) & 1)) { ok = false; break; } }
    if (ok) {
      const b = e - spOff;
      for (let qi = 0; qi < nq; qi++) {
        const q = qs[qi], c = q.codes;
        let mm = 0, bad = false;
        for (let k = 0; k < L; k++) { const gb = g[b - k]; if (gb === 4) { bad = true; break; } if (COMP[gb] !== c[k]) { if (++mm > maxMm) break; } }
        if (!bad && mm <= maxMm) record(q, g, seqInfo, w, S, -1, spOff, pamOff, P, L, c, cap);
      }
    }
  }
}

function record(q, g, seqInfo, w, S, strand, spOff, pamOff, P, L, codes, cap) {
  if (q.sites.length >= cap) { q.truncated = true; return; }
  // protospacer-strand letters and mismatch positions (1-based in the spacer, 1 = PAM-distal for a 3' PAM)
  let proto = '', pam = '';
  const mmPos = [];
  if (strand === 1) {
    for (let k = 0; k < L; k++) { const gb = g[w + spOff + k]; proto += BASE[gb]; if (gb !== codes[k]) mmPos.push(k + 1); }
    for (let j = 0; j < P; j++) pam += BASE[g[w + pamOff + j]];
  } else {
    const e = w + S - 1;
    for (let k = 0; k < L; k++) { const gb = COMP[g[e - spOff - k]]; proto += BASE[gb]; if (gb !== codes[k]) mmPos.push(k + 1); }
    for (let j = 0; j < P; j++) pam += BASE[COMP[g[e - pamOff - j]]];
  }
  q.sites.push({
    sequence: seqInfo.name, sequence_kind: seqInfo.kind,
    chromosome: seqInfo.kind === 'chromosome' ? seqInfo.name : null,
    // 1-based inclusive forward-strand coordinates of the whole site (protospacer + PAM)
    start: w + 1, end: w + S, strand,
    protospacer_strand_sequence: proto, pam_at_site: pam,
    n_mismatches: mmPos.length, mismatch_positions: mmPos,
  });
}

// CLI -------------------------------------------------------------------------------------------
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const cmd = process.argv[2];
  const log = m => process.stderr.write(m + '\n');
  if (cmd === 'build') buildIndex({ log }).then(s => console.log(JSON.stringify(s, null, 2))).catch(e => { log('FAILED: ' + e.message); process.exit(1); });
  else if (cmd === 'status') console.log(JSON.stringify(indexStatus(), null, 2));
  else if (cmd === 'scan') {
    const spacer = process.argv[3], pam = process.argv[4] || 'NGG', side = process.argv[5] || '3prime';
    const seqs = process.argv[6] ? process.argv[6].split(',') : 'all';
    const r = scanGenome([{ spacer, pam, pam_side: side }], { sequences: seqs, onProgress: p => log(`  ${p.sequence} ${(p.scanned_bp / 1e6).toFixed(0)} Mb / ${(p.total_bp / 1e6).toFixed(0)} Mb  ${(p.elapsed_ms / 1000).toFixed(0)} s`) });
    console.log(JSON.stringify(r.ran ? { ...r, queries: r.queries.map(q => ({ spacer: q.spacer, n_sites: q.sites.length, by_mismatch: q.sites.reduce((a, s) => (a[s.n_mismatches] = (a[s.n_mismatches] || 0) + 1, a), {}), first: q.sites.slice(0, 10) })) } : r, null, 2));
  } else console.log('usage: grcz11-local.mjs build | status | scan <spacer> [pam] [3prime|5prime] [seq,seq]');
}
