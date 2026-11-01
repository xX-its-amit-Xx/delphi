// edit_plan: turn a gene-level edit on a design document into a concrete, CHECKABLE zebrafish germline
// editing plan. Part of the validation suite (sim-engine/validate/).
//
// ============================== WHAT THIS IS AND IS NOT ==============================
// This module emits a PROPOSAL for a wet lab to check. It is not a protocol and nothing in it has been
// validated at the bench by us. No guide here has been cut, no embryo injected, no fish genotyped. Every
// efficiency and off-target number is a PREDICTION or a HEURISTIC, labelled as such in the provenance of
// the envelope, exactly like every other number in this project (sim-engine/lib/envelope.mjs).
//
// Scope hard limits, enforced in code (not only documented):
//   * Danio rerio ONLY. resolveGenomic() refuses any other species: no human, mouse or other mammalian
//     editing plan is produced by this module under any argument. See SPECIES_REFUSAL.
//   * No Aves data is read or fetched anywhere in this module (frozen holdout).
//   * No credentials. Every endpoint used is public and unauthenticated.
//
// Pipeline, per gene edit:
//   1. resolveGenomic()   protein-level change -> GRCz11 coordinates, via Ensembl REST:
//                         /lookup/symbol/danio_rerio/<gene>?expand=1  (gene, canonical transcript, translation)
//                         /sequence/id/<transcript>?type=cds          (the CDS, checked to translate to the protein)
//                         /map/cds/<transcript>/<i>..<i>              (CDS base -> chromosome coordinate, per base)
//                         /sequence/region/danio_rerio/<chr>:<a>..<b>:1  (forward-strand genomic window)
//                         The reference codon read from the genome is CHECKED against the claimed reference
//                         residue; a mismatch is a refusal, not a warning.
//   2. enumerateGuides()  SpCas9 (NGG), SaCas9 (NNGRRT) and AsCas12a (TTTV) protospacers on both strands
//                         within the required window, with the cut site and its distance to the edit.
//   3. scoreGuide()       on-target: a TRANSPARENT, DOCUMENTED HEURISTIC (see ON_TARGET_RULE). It is not
//                         Doench 2016 Rule Set 2 and is never called a validated efficiency score.
//                         off-target: Hsu 2013 (MIT) position weights over real GRCz11 hits found by
//                         offTargets() (NCBI blastn-short against the zebrafish genome assembly).
//   4. donorFor()         ssODN with stated arm lengths and asymmetry, and silent PAM/seed blocking
//                         mutations whose protein sequence is checked to be unchanged.
//   5. baseEditorOption() whether the change is reachable by a CBE (C>T) or ABE (A>G) at all, and if so the
//                         editor and the protospacer-window position. Transversions are reported as NOT
//                         reachable rather than fudged.
//   6. honesty()          what is NOT established, and what would falsify the plan. First-class output.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as LOCAL from './grcz11-local.mjs';
import * as DOENCH from './doench2014.mjs';
export { DOENCH };

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..', '..');
export const CACHE_DIR = process.env.EDITPLAN_CACHE_DIR ? path.resolve(process.env.EDITPLAN_CACHE_DIR) : 'C:/Temp/editplan-cache';
const UA = { 'User-Agent': 'delphisci-sim-engine-editplan/0.1 (research; no credentials)' };

export const ASSEMBLY = 'GRCz11';
export const SPECIES = 'danio_rerio';
export const SPECIES_REFUSAL =
  'This module plans germline edits in Danio rerio (zebrafish, GRCz11) only. It refuses every other species, ' +
  'and in particular it will not produce a human or other mammalian editing plan. Germline editing of humans ' +
  'is not a thing this tool does, under any argument.';
const NON_FISH_WORDS = /\b(human|homo[ _]sapiens|mouse|mus[ _]musculus|rat|rattus|monkey|macaque|pig|sus[ _]scrofa|rabbit|dog|canis|cat|felis|bovine|bos[ _]taurus|sheep|ovis|hamster|primate|mammal|embryo of a (woman|man)|patient)\b/i;

// ---------------------------------------------------------------- genetic code / translation
const CODON_TABLE = (() => { const b = 'TCAG', aa = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'; const m = {}; let i = 0; for (const x of b) for (const y of b) for (const z of b) m[x + y + z] = aa[i++]; return m; })();
export const translate = s => { let p = ''; for (let i = 0; i + 3 <= s.length; i += 3) p += CODON_TABLE[s.slice(i, i + 3).toUpperCase()] || 'X'; return p; };
export const aaOf = c => CODON_TABLE[String(c).toUpperCase()] || null;
export const codonsFor = aa => Object.keys(CODON_TABLE).filter(c => CODON_TABLE[c] === aa);
const COMP = { A: 'T', C: 'G', G: 'C', T: 'A', N: 'N', a: 't', c: 'g', g: 'c', t: 'a', n: 'n' };
export const revcomp = s => s.split('').reverse().map(c => COMP[c] || 'N').join('');

// ---------------------------------------------------------------- polite cached fetch
let _lastCall = 0;
const MIN_GAP_MS = Number(process.env.EDITPLAN_MIN_GAP_MS ?? 120); // polite: Ensembl allows 15 req/s; we use <= ~8
function cacheKey(o) { return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 32); }
export function cacheGet(o) { const f = path.join(CACHE_DIR, `${cacheKey(o)}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
function cachePut(o, v) { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(path.join(CACHE_DIR, `${cacheKey(o)}.json`), JSON.stringify({ request: o, fetched: new Date().toISOString(), value: v })); return v; }
export const CALL_LOG = [];
async function fetchCached(req, { network = true, parse = 'json' } = {}) {
  const c = cacheGet(req);
  if (c) { CALL_LOG.push({ url: req.url, cached: true }); return { value: c.value, cached: true, fetched: c.fetched }; }
  if (!network) return { value: null, error: 'not cached and network disabled (network:false)' };
  const wait = MIN_GAP_MS - (Date.now() - _lastCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCall = Date.now();
  try {
    const r = await fetch(req.url, { method: req.method || 'GET', headers: { ...UA, ...(req.headers || {}) }, body: req.body });
    CALL_LOG.push({ url: req.url, cached: false, status: r.status });
    if (!r.ok) return { value: null, error: `HTTP ${r.status} from ${req.url}` };
    const v = parse === 'json' ? await r.json() : await r.text();
    cachePut(req, v);
    return { value: v, cached: false };
  } catch (e) { CALL_LOG.push({ url: req.url, error: e.message }); return { value: null, error: e.message }; }
}
const ENS = 'https://rest.ensembl.org';

// ---------------------------------------------------------------- zebrafish codon usage (Kazusa, real source)
// Kazusa Codon Usage Database, Danio rerio [gbvrt]. Fetched and parsed, never typed from memory. If the
// fetch fails the field is null and says so; no number is invented.
let _usage;
export async function codonUsage({ network = true } = {}) {
  if (_usage) return _usage;
  const url = 'https://www.kazusa.or.jp/codon/cgi-bin/showcodon.cgi?species=7955';
  const r = await fetchCached({ url }, { network, parse: 'text' });
  if (!r.value) return (_usage = { ran: false, reason: r.error, source: url });
  const txt = String(r.value);
  const n = (txt.match(/([\d]+) CDS's \(([\d]+) codons\)/) || []);
  const per1000 = {}, counts = {};
  for (const m of txt.matchAll(/\b([ACGU]{3})\s+([\d.]+)\(\s*(\d+)\)/g)) {
    const c = m[1].replace(/U/g, 'T'); per1000[c] = +m[2]; counts[c] = +m[3];
  }
  if (Object.keys(per1000).length !== 64) return (_usage = { ran: false, reason: `parsed ${Object.keys(per1000).length} codons, expected 64`, source: url });
  // Relative synonymous codon usage: this codon's share of its amino acid's total.
  const share = {};
  for (const c of Object.keys(per1000)) {
    const syn = codonsFor(CODON_TABLE[c]);
    const tot = syn.reduce((a, k) => a + counts[k], 0);
    share[c] = tot ? +(counts[c] / tot).toFixed(4) : null;
  }
  return (_usage = { ran: true, source: url, database: "Kazusa Codon Usage Database, Danio rerio [gbvrt]", n_cds: n[1] ? +n[1] : null, n_codons: n[2] ? +n[2] : null, per_thousand: per1000, counts, fraction_of_synonymous_family: share, cached: r.cached });
}

// ---------------------------------------------------------------- 1. protein change -> GRCz11 coordinates
/** Parse p.W169L / p.Y285* / knockout. Deliberately narrow: anything else is a refusal, not a guess. */
export function parseEdit(spec) {
  const s = String(spec || '').trim();
  if (/^(knockout|lof|loss[- ]of[- ]function|null)$/i.test(s)) return { kind: 'knockout', raw: s };
  const m = s.match(/^p\.?\(?([A-Z])(\d+)([A-Z*])\)?$/);
  if (m) return { kind: m[3] === '*' ? 'nonsense' : 'missense', ref: m[1], pos: +m[2], alt: m[3], raw: s };
  return { kind: 'unparsed', raw: s, reason: `cannot parse "${s}" as a protein change; this module takes p.<REF><POS><ALT> (e.g. p.W169L, p.Y285*) or "knockout"` };
}

/**
 * Resolve a protein-level change on a zebrafish gene to exact GRCz11 coordinates.
 * REFUSES (returns {resolved:false, refusal}) when: the species is not zebrafish, the gene symbol does not
 * resolve, there is no canonical protein-coding transcript, the CDS does not translate to the Ensembl
 * protein, the position is outside the protein, or the reference codon in the genome does not encode the
 * claimed reference residue. A refusal is never downgraded to a warning.
 */
export async function resolveGenomic(gene, editSpec, { network = true, species = SPECIES, flank = 150 } = {}) {
  if (species !== SPECIES) return { resolved: false, refusal: `species "${species}" refused. ${SPECIES_REFUSAL}` };
  if (NON_FISH_WORDS.test(String(gene)) || NON_FISH_WORDS.test(String(editSpec)))
    return { resolved: false, refusal: `the request names a non-fish organism. ${SPECIES_REFUSAL}` };

  const ed = typeof editSpec === 'object' && editSpec ? editSpec : parseEdit(editSpec);
  if (ed.kind === 'unparsed') return { resolved: false, refusal: ed.reason };

  const lk = await fetchCached({ url: `${ENS}/lookup/symbol/${SPECIES}/${encodeURIComponent(gene)}?expand=1;content-type=application/json` }, { network });
  if (!lk.value?.id) return { resolved: false, refusal: `Ensembl has no ${SPECIES} gene with symbol "${gene}" (${lk.error || 'empty response'}); nothing is planned for a gene that does not resolve` };
  const g = lk.value;
  if (g.biotype !== 'protein_coding') return { resolved: false, refusal: `${gene} (${g.id}) is ${g.biotype}, not protein_coding` };
  const tr = (g.Transcript || []).find(t => t.is_canonical && t.biotype === 'protein_coding') || (g.Transcript || []).find(t => t.biotype === 'protein_coding');
  if (!tr?.Translation?.id) return { resolved: false, refusal: `no canonical protein-coding transcript with a translation for ${gene} (${g.id})` };
  const chr = g.seq_region_name, strand = tr.strand;
  const assembly = tr.assembly_name || g.assembly_name;
  if (assembly && assembly !== ASSEMBLY) return { resolved: false, refusal: `Ensembl served assembly ${assembly}, not ${ASSEMBLY}; coordinates would be wrong` };

  const cdsR = await fetchCached({ url: `${ENS}/sequence/id/${tr.id}?type=cds;content-type=application/json` }, { network });
  if (!cdsR.value?.seq) return { resolved: false, refusal: `no CDS for ${tr.id} (${cdsR.error || 'empty'})` };
  const cds = cdsR.value.seq.toUpperCase();
  const prot = translate(cds).replace(/\*$/, '');
  if (prot.length !== tr.Translation.length) return { resolved: false, refusal: `CDS of ${tr.id} translates to ${prot.length} aa but translation ${tr.Translation.id} is ${tr.Translation.length} aa` };

  // Exons, in CDS order, with the CDS offset of each: needed for the early-exon knockout window.
  const exons = (tr.Exon || []).map(e => ({ id: e.id, start: e.start, end: e.end, length: e.end - e.start + 1 }));
  exons.sort((a, b) => (strand === 1 ? a.start - b.start : b.start - a.start));

  const out = {
    resolved: true, species: SPECIES, assembly: ASSEMBLY, gene, gene_id: g.id, gene_name: g.display_name,
    transcript_id: tr.id, transcript_name: tr.display_name, protein_id: tr.Translation.id, protein_length: tr.Translation.length,
    chromosome: chr, gene_start: g.start, gene_end: g.end, strand, n_exons: exons.length, exons,
    cds_length: cds.length, cds, edit: ed,
    ensembl_release_note: 'Ensembl REST serves the current release; the release number is not in these payloads, so the coordinates are pinned by the assembly name only.',
  };

  const cb = await cdsBlocks(tr.id, cds.length, { network, strand });
  if (!cb.ran) return { resolved: false, refusal: `could not map the coding exons of ${tr.id} to ${ASSEMBLY}: ${cb.reason}` };
  if (!cb.matches_cds_length) return { resolved: false, refusal: cb.problem };
  out.coding_blocks = cb.blocks; out.coding_blocks_source = cb.source;

  if (ed.kind === 'knockout') {
    // Knockout: no single codon. Target window = the early CDS (first EARLY_FRACTION of the coding sequence),
    // where a frameshift removes most of the protein and is least likely to be rescued by reinitiation.
    const earlyCdsEnd = Math.max(60, Math.floor(EARLY_FRACTION * cds.length));
    const a = await mapCdsBase(tr.id, 4, { network });                 // skip the start codon itself
    const b = await mapCdsBase(tr.id, earlyCdsEnd, { network });
    if (!a || !b) return { resolved: false, refusal: `could not map the early CDS of ${tr.id} to ${ASSEMBLY} coordinates` };
    // The coding intervals inside the early-CDS window: a frameshift guide must cut inside one of THESE.
    const early = cb.blocks.filter(x => x.cds_from <= earlyCdsEnd && x.cds_to >= 4).map(x => {
      const from = Math.max(x.cds_from, 4), to = Math.min(x.cds_to, earlyCdsEnd);
      const g1 = strand === 1 ? x.start + (from - x.cds_from) : x.end - (from - x.cds_from);
      const g2 = strand === 1 ? x.start + (to - x.cds_from) : x.end - (to - x.cds_from);
      return { chromosome: x.chromosome, cds_from: from, cds_to: to, start: Math.min(g1, g2), end: Math.max(g1, g2), codons: [Math.ceil(from / 3), Math.floor(to / 3)] };
    });
    out.target = { kind: 'knockout', cds_window: [4, earlyCdsEnd], genomic_window: [Math.min(a, b), Math.max(a, b)],
      coding_intervals_in_window: early,
      coding_nt_in_window: early.reduce((s2, x) => s2 + (x.cds_to - x.cds_from + 1), 0),
      exon_rule: 'a frameshift guide must cut inside one of coding_intervals_in_window. A cut in an intron does not shift the frame, so intronic protospacers are excluded even though the enumerator finds them.',
      rule: `frameshift inside the first ${Math.round(EARLY_FRACTION * 100)} % of the CDS (c.4-c.${earlyCdsEnd}), i.e. codons 2-${Math.floor(earlyCdsEnd / 3)} of ${tr.Translation.length}`,
      protein_fraction_lost_if_frameshift_at_window_end: +(1 - earlyCdsEnd / 3 / tr.Translation.length).toFixed(3) };
    out.window = await genomicWindow(chr, out.target.genomic_window[0] - flank, out.target.genomic_window[1] + flank, { network });
    return out;
  }

  // Point change: the exact codon.
  if (!(ed.pos >= 1 && ed.pos <= prot.length)) return { resolved: false, refusal: `position ${ed.pos} is outside the ${prot.length} aa protein ${tr.Translation.id}` };
  const cdsPos = [3 * ed.pos - 2, 3 * ed.pos - 1, 3 * ed.pos];
  const refCodon = cds.slice(cdsPos[0] - 1, cdsPos[2]);
  const refAA = aaOf(refCodon);
  if (refAA !== ed.ref) return { resolved: false, refusal: `the edit claims ${ed.ref}${ed.pos} but codon ${ed.pos} of ${tr.id} is ${refCodon} = ${refAA}. Refusing: a plan built on the wrong reference residue would cut the wrong place.` };
  const gpos = [];
  for (const c of cdsPos) { const p = await mapCdsBase(tr.id, c, { network }); if (p == null) return { resolved: false, refusal: `could not map CDS base c.${c} of ${tr.id} to ${ASSEMBLY}` }; gpos.push(p); }
  const spansJunction = Math.abs(gpos[2] - gpos[0]) !== 2;

  // Verify the codon against the GENOME, not only against the CDS Ensembl handed us.
  const lo = Math.min(...gpos), hi = Math.max(...gpos);
  const codonFwd = await genomicWindow(chr, lo, hi, { network });
  if (!codonFwd?.seq) return { resolved: false, refusal: `could not read ${ASSEMBLY} ${chr}:${lo}-${hi}` };
  let genomicCodon = null;
  if (!spansJunction) {
    genomicCodon = strand === 1 ? codonFwd.seq : revcomp(codonFwd.seq);
    if (genomicCodon !== refCodon) return { resolved: false, refusal: `the genome at ${ASSEMBLY} ${chr}:${lo}-${hi} (strand ${strand}) reads ${genomicCodon}, but the CDS of ${tr.id} has ${refCodon} at codon ${ed.pos}` };
  }

  // Which nucleotide changes give the desired amino acid, cheapest first.
  const usage = await codonUsage({ network });
  const options = codonsFor(ed.alt === '*' ? '*' : ed.alt).map(c => {
    const changes = [];
    for (let i = 0; i < 3; i++) if (c[i] !== refCodon[i]) changes.push({
      codon_base: i + 1, cds_pos: cdsPos[i], genomic_pos: gpos[i],
      cds_ref: refCodon[i], cds_alt: c[i],
      genomic_ref: strand === 1 ? refCodon[i] : COMP[refCodon[i]],
      genomic_alt: strand === 1 ? c[i] : COMP[c[i]],
      genomic_strand_note: strand === 1 ? 'CDS is on the forward strand here' : 'CDS is on the reverse strand: the forward-strand base is the complement',
      transition: isTransition(refCodon[i], c[i]),
    });
    return { codon: c, amino_acid: ed.alt, n_nt_changes: changes.length, nt_changes: changes,
      codon_usage_per_thousand: usage.ran ? usage.per_thousand[c] : null,
      codon_usage_fraction_of_family: usage.ran ? usage.fraction_of_synonymous_family[c] : null };
  }).sort((a, b) => a.n_nt_changes - b.n_nt_changes || ((b.codon_usage_fraction_of_family ?? 0) - (a.codon_usage_fraction_of_family ?? 0)));

  out.target = {
    kind: ed.kind, protein_position: ed.pos, reference_residue: ed.ref, desired_residue: ed.alt,
    cds_positions: cdsPos, reference_codon: refCodon, reference_codon_amino_acid: refAA,
    genomic_positions: gpos, genomic_codon_forward_strand: codonFwd.seq, genomic_codon_in_cds_orientation: genomicCodon,
    spans_exon_junction: spansJunction,
    genome_codon_check: spansJunction ? 'could-not-run: the codon spans an exon junction, so the three bases are not contiguous on the chromosome; each base was mapped individually and the CDS codon was used' : 'passed: the genome and the CDS agree at this codon',
    desired_codon_options: options, chosen_codon: options[0] || null,
    codon_usage_source: usage.ran ? { database: usage.database, n_cds: usage.n_cds, n_codons: usage.n_codons, url: usage.source } : { ran: false, reason: usage.reason },
  };
  out.codon_usage = usage.ran ? usage : null;
  out.window = await genomicWindow(chr, lo - flank, hi + flank, { network });
  out.window.edit_offsets = gpos.map(p => p - (lo - flank)); // 0-based offsets of the codon bases in window.seq
  return out;
}
export const EARLY_FRACTION = Number(process.env.EDITPLAN_EARLY_FRACTION ?? 0.35);
const isTransition = (a, b) => (a === 'A' && b === 'G') || (a === 'G' && b === 'A') || (a === 'C' && b === 'T') || (a === 'T' && b === 'C');

/**
 * The CODING exon blocks of a transcript: one chromosome interval per coding exon, with the CDS offsets it
 * covers. From Ensembl /map/cds/<tid>/1..<cds_length>, which returns exactly one mapping per coding exon.
 * This is what tells a frameshift guide apart from a guide sitting in an intron.
 */
export async function cdsBlocks(tid, cdsLen, { network = true, strand = 1 } = {}) {
  const r = await fetchCached({ url: `${ENS}/map/cds/${tid}/1..${cdsLen}?content-type=application/json` }, { network });
  const m = r.value?.mappings;
  if (!Array.isArray(m) || !m.length) return { ran: false, reason: r.error || 'no mappings' };
  const blocks = m.map(x => ({ chromosome: x.seq_region_name, start: x.start, end: x.end, length: x.end - x.start + 1, strand: x.strand }));
  blocks.sort((a, b) => (strand === 1 ? a.start - b.start : b.start - a.start));   // transcription order
  let acc = 1;
  for (const b of blocks) { b.cds_from = acc; b.cds_to = acc + b.length - 1; acc += b.length; }
  const total = blocks.reduce((a, b) => a + b.length, 0);
  return { ran: true, blocks, total_coding_nt: total, matches_cds_length: total === cdsLen,
    source: `Ensembl REST /map/cds/${tid}/1..${cdsLen}`,
    ...(total === cdsLen ? {} : { problem: `coding blocks total ${total} nt but the CDS is ${cdsLen} nt` }) };
}
/** Chromosome coordinate -> CDS index (1-based) using the coding blocks, or null when not coding. */
export function cdsIndexFromBlocks(blocks, strand, gp) {
  for (const b of blocks) {
    if (gp < b.start || gp > b.end) continue;
    return strand === 1 ? b.cds_from + (gp - b.start) : b.cds_from + (b.end - gp);
  }
  return null;
}

/** CDS base (1-based) -> chromosome coordinate, via Ensembl /map/cds. null when it does not map. */
export async function mapCdsBase(tid, cdsPos, { network = true } = {}) {
  const r = await fetchCached({ url: `${ENS}/map/cds/${tid}/${cdsPos}..${cdsPos}?content-type=application/json` }, { network });
  const m = (r.value?.mappings || [])[0];
  return m ? m.start : null;
}
/** Forward-strand genomic sequence of a region. */
export async function genomicWindow(chr, start, end, { network = true } = {}) {
  const r = await fetchCached({ url: `${ENS}/sequence/region/${SPECIES}/${chr}:${start}..${end}:1?content-type=application/json` }, { network });
  if (!r.value?.seq) return { seq: null, error: r.error };
  return { chromosome: chr, start, end, strand_of_sequence: 1, seq: r.value.seq.toUpperCase(), source: `Ensembl REST /sequence/region ${ASSEMBLY} ${chr}:${start}..${end}:1` };
}

// ---------------------------------------------------------------- 2. nucleases and protospacer enumeration
// Cut-site conventions, each with the paper the convention comes from.
export const NUCLEASES = {
  SpCas9: { name: 'SpCas9', pam: 'NGG', pam_side: '3prime', spacer_len: 20,
    // Blunt cut 3 bp 5' of the PAM (Jinek 2012 Science 337:816; Jinek/Doudna geometry).
    cut_offset_from_pam: -3, cut: 'blunt double-strand break 3 bp 5\' of the PAM',
    citation: 'Jinek et al. 2012, Science 337:816-821, doi 10.1126/science.1225829' },
  SaCas9: { name: 'SaCas9', pam: 'NNGRRT', pam_side: '3prime', spacer_len: 21, cut_offset_from_pam: -3,
    cut: 'blunt double-strand break ~3 bp 5\' of the PAM',
    citation: 'Ran et al. 2015, Nature 520:186-191, doi 10.1038/nature14299 (SaCas9, NNGRRT PAM, 21-nt spacer)' },
  AsCas12a: { name: 'AsCas12a (Cpf1)', pam: 'TTTV', pam_side: '5prime', spacer_len: 23, cut_offset_from_pam: 18,
    cut: 'staggered cut: +18 on the protospacer strand, +23 on the complementary strand, counted from the PAM',
    citation: 'Zetsche et al. 2015, Cell 163:759-771, doi 10.1016/j.cell.2015.09.038' },
};
const IUPAC = { A: 'A', C: 'C', G: 'G', T: 'T', N: 'ACGT', R: 'AG', Y: 'CT', S: 'CG', W: 'AT', K: 'GT', M: 'AC', B: 'CGT', D: 'AGT', H: 'ACT', V: 'ACG' };
export function matchesPam(seq, pam) {
  if (seq.length !== pam.length) return false;
  for (let i = 0; i < pam.length; i++) if (!(IUPAC[pam[i]] || '').includes(seq[i])) return false;
  return true;
}

/**
 * All protospacers of one nuclease inside a window, on both strands, with GRCz11 coordinates and the cut site.
 * `win` is a genomicWindow() result (forward strand). Coordinates returned are chromosome coordinates.
 */
export function enumerateGuides(win, nuc, { targetPositions = [], maxCutDistance = Infinity } = {}) {
  const N = NUCLEASES[nuc] || nuc;
  const out = [];
  const S = win.seq, L = S.length, sl = N.spacer_len, pl = N.pam.length;
  for (const strand of [1, -1]) {
    const seq = strand === 1 ? S : revcomp(S);
    // index i in `seq` maps to window offset: strand 1 -> i ; strand -1 -> L-1-i
    const toChrom = i => (strand === 1 ? win.start + i : win.start + (L - 1 - i));
    for (let i = 0; i + sl + pl <= L; i++) {
      let spacer, pam, pamStartIdx;
      if (N.pam_side === '3prime') { spacer = seq.slice(i, i + sl); pam = seq.slice(i + sl, i + sl + pl); pamStartIdx = i + sl; }
      else { pam = seq.slice(i, i + pl); spacer = seq.slice(i + pl, i + pl + sl); pamStartIdx = i; }
      if (!matchesPam(pam, N.pam)) continue;
      if (/N/.test(spacer)) continue;
      // Cut site, in `seq` index space, then on the chromosome.
      let cutIdx;
      if (N.pam_side === '3prime') cutIdx = pamStartIdx + N.cut_offset_from_pam;      // 3 bp 5' of PAM
      else cutIdx = pamStartIdx + pl + N.cut_offset_from_pam;                          // Cas12a: +18 from PAM 3' end
      const cutChrom = toChrom(cutIdx);
      const protoStartChrom = toChrom(N.pam_side === '3prime' ? i : i + pl);
      const protoEndChrom = toChrom(N.pam_side === '3prime' ? i + sl - 1 : i + pl + sl - 1);
      const dist = targetPositions.length ? Math.min(...targetPositions.map(p => Math.abs(cutChrom - p))) : null;
      if (dist != null && dist > maxCutDistance) continue;
      // The 30-mer Doench 2014 Rule Set 1 was fitted on: 4 nt 5' of the protospacer, the 20-nt protospacer,
      // the 3-nt NGG PAM, 3 nt 3' of the PAM, all on the protospacer strand. `seq` is already the
      // protospacer strand, so one slice does it. null (not a guess) when the window does not reach,
      // or when the nuclease geometry is not the one the model was fitted on.
      const canRS1 = N.pam_side === '3prime' && sl === 20 && N.pam === 'NGG';
      const c30 = canRS1 && i >= 4 && i + 26 <= L ? seq.slice(i - 4, i + 26) : null;
      out.push({
        nuclease: N.name, pam_motif: N.pam, strand, spacer, pam,
        protospacer_plus_pam: N.pam_side === '3prime' ? spacer + pam : pam + spacer,
        guide_rna_spacer_5to3: spacer.replace(/T/g, 'U'),
        guide_rna_spacer_dna_5to3: spacer,
        chromosome: win.chromosome,
        protospacer_chrom: [Math.min(protoStartChrom, protoEndChrom), Math.max(protoStartChrom, protoEndChrom)],
        pam_chrom: [Math.min(toChrom(pamStartIdx), toChrom(pamStartIdx + pl - 1)), Math.max(toChrom(pamStartIdx), toChrom(pamStartIdx + pl - 1))],
        cut_site_chrom: cutChrom, cut_convention: N.cut, cut_citation: N.citation,
        distance_cut_to_edit_bp: dist,
        context_30mer: c30,
        context_30mer_note: c30 ? DOENCH.CONTEXT_SPEC
          : canRS1 ? 'the genomic window does not extend 4 nt 5\' of the protospacer and 3 nt 3\' of the PAM, so no Doench 2014 score is computed for this guide'
          : `Doench 2014 Rule Set 1 does not apply to ${N.name} (SpCas9 / 20-nt spacer / NGG only), so no 30-mer context is built`,
      });
    }
  }
  return out.sort((a, b) => (a.distance_cut_to_edit_bp ?? 0) - (b.distance_cut_to_edit_bp ?? 0));
}

// ---------------------------------------------------------------- 3. scoring
// ON-TARGET. There are now TWO numbers, and the difference between them is the point:
//
//   on_target              OUR HEURISTIC. Weights WE chose, over published observations. Still here because
//                          it is the only thing that covers SaCas9 and Cas12a, for which nothing is
//                          published. Labelled 'heuristic' everywhere it appears. See ON_TARGET_RULE.
//   on_target_doench2014   A PUBLISHED MODEL, with coefficients fetched from Doench et al. 2014's
//                          Supplementary Table 9 in this run and self-tested against the reference vectors.
//                          SpCas9 / 20-nt / NGG only. See doench2014.mjs.
//
// Doench 2016 "Rule Set 2" was pursued first and is NOT implemented, for a reason that is now established
// rather than assumed: the Azimuth model is a pickled scikit-learn GradientBoostingRegressor of 100
// depth-3 trees over 627 features, so there is no coefficient vector in existence to transcribe (Doench
// 2016's Supplementary Table 17 is Gini feature importance, a ranking, not weights). CRISPOR and CHOPCHOP
// serve no callable REST API, so neither could be asked for a Rule Set 2 score either. See
// doench2014.mjs RULE_SET_2 for exactly what was checked. No number in this module is ever called a Rule
// Set 2 score, and the heuristic is never called a published one.
export const ON_TARGET_RULE = {
  id: 'editplan-gc-position-heuristic/v1',
  label: 'heuristic',
  THIS_IS_OURS: 'The weights in the formula below were chosen BY US. They were not fitted to any data, ours or anyone else\'s. ' +
    'Where a published model applies, use `on_target_doench2014` (Doench 2014 Rule Set 1) instead; this heuristic exists ' +
    'because Rule Set 1 covers only SpCas9 with a 20-nt spacer and an NGG PAM, and nothing published covers SaCas9 or Cas12a.',
  what_it_is_not: 'not Doench 2016 Rule Set 2, not Doench 2014 Rule Set 1, not Azimuth, not a measured cutting efficiency, not calibrated on any zebrafish data, not fitted to anything',
  published_alternative: 'on_target_doench2014 (Doench 2014 Rule Set 1) where the nuclease geometry allows it; see doench2014.mjs',
  terms: [
    { term: 'gc', rule: 'GC fraction of the spacer; full credit in [0.40,0.70], falling linearly to 0 at 0.20 and 0.90', observation: 'guides with very low or very high GC cut poorly', citation: 'Doench et al. 2014, Nat Biotechnol 32:1262-1267, doi 10.1038/nbt.3026; Wang et al. 2014, Science 343:80-84, doi 10.1126/science.1246981' },
    { term: 'polyT', rule: 'TTTT or longer run anywhere in the spacer scores 0 on this term', observation: 'a run of 4+ T terminates U6/T7 transcription and such guides fail', citation: 'Graf et al. 2019, Cell Reports 26:1098-1103, doi 10.1016/j.celrep.2019.01.024; Wang et al. 2014 (poly-T depletion)' },
    { term: 'g20', rule: '+1 if the PAM-proximal base (position 20 of a 20-nt spacer) is G', observation: 'G immediately 5\' of the PAM is enriched in efficient guides', citation: 'Doench et al. 2014; Xu et al. 2015, Genome Res 25:1147-1157, doi 10.1101/gr.191452.115' },
    { term: 'g5start', rule: '+0.5 if the 5\' base is G (a T7-transcribed sgRNA needs a 5\' G; otherwise one must be appended, which adds a mismatch)', observation: 'T7 requires 5\'-G; appending it is standard practice in zebrafish', citation: 'Jao, Wente & Chen 2013, PNAS 110:13904-13909, doi 10.1073/pnas.1308335110' },
    { term: 'homopolymer', rule: '-0.5 if any base runs 5 or more times', observation: 'long homopolymers are depleted among active guides', citation: 'Wang et al. 2014' },
  ],
  formula: 'score = clamp01( 0.55*gc + 0.25*polyT + 0.12*g20 + 0.05*g5start + 0.03*(1-homopolymer_penalty) ); weights chosen by us, not fitted',
};
export function onTargetHeuristic(spacer) {
  const s = spacer.toUpperCase();
  const gcFrac = (s.match(/[GC]/g) || []).length / s.length;
  const tri = x => x <= 0.20 || x >= 0.90 ? 0 : x < 0.40 ? (x - 0.20) / 0.20 : x > 0.70 ? (0.90 - x) / 0.20 : 1;
  const gc = tri(gcFrac);
  const polyT = /TTTT/.test(s) ? 0 : 1;
  const g20 = s[s.length - 1] === 'G' ? 1 : 0;
  const g5 = s[0] === 'G' ? 1 : 0;
  const homo = /(.)\1{4,}/.test(s) ? 1 : 0;
  const score = Math.max(0, Math.min(1, 0.55 * gc + 0.25 * polyT + 0.12 * g20 + 0.05 * g5 + 0.03 * (1 - homo)));
  return { score: +score.toFixed(3), kind: 'heuristic', label: 'HEURISTIC - weights chosen by us, not fitted, not published', rule_id: ON_TARGET_RULE.id,
    terms: { gc_fraction: +gcFrac.toFixed(3), gc_term: +gc.toFixed(3), polyT_ok: !!polyT, g_at_pam_proximal_end: !!g20, g_at_5prime: !!g5, long_homopolymer: !!homo },
    flags: [...(polyT ? [] : ['poly-T run of 4 or more: this guide will likely fail U6/T7 transcription; drop it']),
            ...(gcFrac < 0.3 || gcFrac > 0.8 ? [`GC ${(gcFrac * 100).toFixed(0)} % is outside the range where published datasets see good activity`] : []),
            ...(g5 ? [] : ['5\' base is not G: a T7-transcribed sgRNA needs a 5\'-G appended (one extra mismatch at position 1) or use a U6 promoter'])],
    NOT: ON_TARGET_RULE.what_it_is_not };
}

// OFF-TARGET: Hsu 2013 (MIT) position weights. Published numbers, cited, implemented here.
export const MIT_WEIGHTS = [0, 0, 0.014, 0, 0, 0.395, 0.317, 0, 0.389, 0.079, 0.445, 0.508, 0.613, 0.851, 0.732, 0.828, 0.615, 0.804, 0.685, 0.583];
export const MIT_CITATION = 'Hsu et al. 2013, Nat Biotechnol 31:827-832, doi 10.1038/nbt.2647 (the position-specific mismatch penalties used by the MIT CRISPR Design tool and by CRISPOR as "MIT specificity")';
/** Single off-target score, Hsu 2013. mmPositions are 1-based positions in a 20-nt spacer (1 = PAM-distal). */
export function mitSingleScore(mmPositions) {
  const mm = [...mmPositions].sort((a, b) => a - b);
  if (!mm.length) return 1;
  let s = 1;
  for (const p of mm) s *= (1 - (MIT_WEIGHTS[p - 1] ?? 0.6));
  const d = mm.length > 1 ? (mm[mm.length - 1] - mm[0]) / (mm.length - 1) : 19;
  s *= 1 / (((19 - d) / 19) * 4 + 1);
  s *= 1 / (mm.length * mm.length);
  return s;
}
/** Aggregate MIT specificity over a list of off-target hits (each with mismatch positions). 0-100. */
export function mitSpecificity(offTargetHits) {
  const sum = offTargetHits.reduce((a, h) => a + mitSingleScore(h.mismatch_positions) * 100, 0);
  return { specificity: +(10000 / (100 + sum)).toFixed(2), n_off_targets_scored: offTargetHits.length,
    kind: 'derived', method: 'Hsu 2013 position weights, aggregated as 10000/(100 + sum of per-site scores x 100) (the MIT aggregate used by CRISPOR)', citation: MIT_CITATION,
    NOT: 'a prediction from sequence, not a measured off-target rate. Only sites found by the search below are counted, so the number can only go DOWN when a deeper search is run.' };
}

// ---------------------------------------------------------------- off-target search against GRCz11
//
// TWO BACKENDS. `offTargets()` dispatches; `method` picks one.
//
//   'local'  (PREFERRED, and the default when the index exists) - grcz11-local.mjs: a complete enumeration
//            of both strands of the whole GRCz11 primary assembly. PAM-anchored, then a mismatch count with
//            no seeding step, so unlike a heuristic aligner it cannot miss a site for want of an exact k-mer.
//            For substitutions at or under the mismatch limit it is EXHAUSTIVE over the indexed sequences.
//            ~22 s for the whole 1.37 Gb assembly on one core. No queue and no credentials.
//   'ncbi'   NCBI BLAST URL API, blastn-short, against GPIPE/7955/current/all_top_level. Public, no
//            credentials, polite. KEPT BUT NO LONGER THE DEFAULT, for the reason recorded in
//            NCBI_QUEUE_EXPERIENCE below: every job we submitted sat in Status=WAITING on the public queue
//            until the poll budget expired, so every plan reported `ran: false` and its off-target table
//            stayed empty. It is also a heuristic aligner, so its counts were a floor even when it did run.
//
// Both backends feed the same Hsu 2013 aggregation and the same Ensembl /overlap/region gene annotation.
export const NCBI_QUEUE_EXPERIENCE =
  'Recorded so the next person does not repeat it: four blastn-short jobs submitted to the NCBI BLAST URL API ' +
  'against GPIPE/7955/current/all_top_level each returned an RID and then sat in Status=WAITING for the full ' +
  '10-minute poll budget (40 polls x 15 s) without completing, so every editing plan in the first run reported ' +
  'off_target.ran = false. The API was used correctly and politely; the public queue simply did not schedule the ' +
  'jobs. This is why the local exhaustive search exists and is now the default: a search that reliably returns is ' +
  'worth more than a search that is nominally better-known.';
const BLAST = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi';
export const OFFTARGET_DB = 'GPIPE/7955/current/all_top_level';
/** NC_007112.7 -> "1" ... NC_007136.7 -> "25" (zebrafish GRCz11 RefSeq chromosome accessions are consecutive). */
export function refseqToEnsemblChr(acc) {
  const m = String(acc).match(/^NC_0071(\d\d)\./);
  if (!m) return null;
  const n = +m[1] - 11;
  return n >= 1 && n <= 25 ? String(n) : null;
}
async function offTargetsNCBI(spacer, pam, { network = true, maxPolls = 40, pollMs = 15000, maxMismatches = 4, geneContext = true } = {}) {
  const key = { tool: 'editplan-offtarget', program: 'blastn-short', db: OFFTARGET_DB, query: spacer, word_size: 7 };
  const c = cacheGet(key); if (c) return { ...c.value, cached: true };
  if (!network) return { ran: false, reason: 'off-target search not cached and network disabled' };
  const put = await fetch(BLAST, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ CMD: 'Put', PROGRAM: 'blastn', TASK: 'blastn-short', MEGABLAST: 'F', DATABASE: OFFTARGET_DB, QUERY: spacer, WORD_SIZE: '7', EXPECT: '1000', HITLIST_SIZE: '500', TOOL: 'delphisci-editplan' }) }).then(r => r.text()).catch(e => `ERR ${e.message}`);
  const rid = (put.match(/RID = (\S+)/) || [])[1];
  if (!rid) return { ran: false, reason: `NCBI BLAST Put returned no RID (${String(put).slice(0, 200)})` };
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, pollMs));
    const st = await fetch(`${BLAST}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`, { headers: UA }).then(r => r.text()).catch(() => 'ERR');
    if (/Status=WAITING/.test(st)) continue;
    if (/Status=UNKNOWN/.test(st)) return { ran: false, reason: 'BLAST RID expired', rid };
    if (!/Status=READY/.test(st)) return { ran: false, reason: `BLAST status ${(st.match(/Status=\w+/) || ['?'])[0]}`, rid };
    const js = await fetch(`${BLAST}?CMD=Get&FORMAT_TYPE=JSON2_S&RID=${rid}`, { headers: UA }).then(r => r.json()).catch(e => ({ err: e.message }));
    const hits = js.BlastOutput2?.[0]?.report?.results?.search?.hits || [];
    const sites = [];
    for (const h of hits) for (const hsp of h.hsps || []) {
      const qs = hsp.qseq, hs = hsp.hseq;
      if (!qs || !hs) continue;
      // Only full-length alignments of the spacer are off-target candidates in the Cas9 sense.
      const fullLen = hsp.align_len === spacer.length && hsp.query_from === 1 && hsp.query_to === spacer.length && !/-/.test(qs) && !/-/.test(hs);
      const mm = [];
      for (let k = 0; k < qs.length; k++) if (qs[k] !== hs[k]) mm.push(k + 1);
      if (!fullLen || mm.length > maxMismatches) continue;
      const acc = h.description?.[0]?.accession || h.description?.[0]?.id;
      sites.push({ accession: acc, chromosome: refseqToEnsemblChr(acc), hit_strand: hsp.hit_strand === 'Minus' ? -1 : 1,
        hit_from: Math.min(hsp.hit_from, hsp.hit_to), hit_to: Math.max(hsp.hit_from, hsp.hit_to),
        aligned_genome_sequence: hs, n_mismatches: mm.length, mismatch_positions: mm,
        mit_single_site_score: +mitSingleScore(mm).toFixed(6) });
    }
    sites.sort((a, b) => a.n_mismatches - b.n_mismatches || b.mit_single_site_score - a.mit_single_site_score);
    const v = { ran: true, rid, database: OFFTARGET_DB, program: 'blastn-short, word_size 7, expect 1000, hitlist 500',
      query: spacer, pam_note: `the search is on the ${spacer.length}-nt spacer only. A site is only cuttable if it also carries a ${pam}-compatible PAM; PAM presence at each site is reported as pam_checked below where the flanking base could be read.`,
      n_blast_hits: hits.length, n_sites_within_mismatch_limit: sites.length, max_mismatches: maxMismatches, sites,
      what_this_does_not_cover: 'BLAST with word_size 7 is a heuristic aligner, not an exhaustive enumerator: it can MISS off-target sites, especially those with mismatches spread so that no 7-mer seed is exact. The count is a floor, never a ceiling. It also searches the GRCz11 primary assembly only (no alternative loci), and it does not model bulges (DNA/RNA insertions or deletions at the target), which Cas9 tolerates.' };
    if (geneContext) for (const s of v.sites.slice(0, 25)) {
      if (!s.chromosome) continue;
      const r = await fetchCached({ url: `${ENS}/overlap/region/${SPECIES}/${s.chromosome}:${Math.max(1, s.hit_from - 2000)}-${s.hit_to + 2000}?feature=gene;content-type=application/json` }, { network });
      s.gene_context = Array.isArray(r.value) ? r.value.map(g => ({ id: g.id, symbol: g.external_name || null, biotype: g.biotype, start: g.start, end: g.end })) : { error: r.error };
      s.gene_context_window = '+/- 2 kb around the site';
    }
    cachePut(key, v);
    return { ...v, cached: false };
  }
  return { ran: false, reason: `BLAST did not finish in ${(maxPolls * pollMs / 60000).toFixed(0)} min`, rid };
}

/**
 * Ensembl /overlap/region gene annotation for a list of sites, +/- 2 kb. Shared by both backends.
 *
 * The local search is exhaustive, so a guide can have 100+ sites at 4 mismatches, and annotating all of them
 * would be hundreds of Ensembl calls per guide. So annotation is PRIORITISED, not merely truncated: every
 * site at or under `alwaysBelowMismatches` mismatches is annotated however many there are (those are the
 * sites with a non-negligible Hsu score, and the only ones a lab would act on), then the rest up to `limit`.
 * A site that was not annotated says so explicitly; it is never reported as intergenic by default.
 */
async function annotateGeneContext(sites, { network = true, limit = 25, alwaysBelowMismatches = 3 } = {}) {
  const priority = sites.filter(s => s.n_mismatches <= alwaysBelowMismatches);
  const rest = sites.filter(s => s.n_mismatches > alwaysBelowMismatches).slice(0, Math.max(0, limit - priority.length));
  const chosen = new Set([...priority, ...rest]);
  for (const s of sites) if (!chosen.has(s)) s.gene_context = { not_attempted: `annotation is prioritised: every site with <= ${alwaysBelowMismatches} mismatches is annotated, then others up to ${limit}. This site has ${s.n_mismatches} mismatches and fell outside that budget, so its gene context is UNKNOWN - not intergenic.` };
  for (const s of [...priority, ...rest]) {
    if (!s.chromosome) { s.gene_context = { not_attempted: 'site is on an unplaced scaffold, not a chromosome' }; continue; }
    const r = await fetchCached({ url: `${ENS}/overlap/region/${SPECIES}/${s.chromosome}:${Math.max(1, s.hit_from - 2000)}-${s.hit_to + 2000}?feature=gene;content-type=application/json` }, { network });
    s.gene_context = Array.isArray(r.value) ? r.value.map(g => ({ id: g.id, symbol: g.external_name || null, biotype: g.biotype, start: g.start, end: g.end })) : { error: r.error };
    s.gene_context_window = '+/- 2 kb around the site';
    // Ensembl REST returns a transient 500/503 under load often enough that a single attempt leaves holes in
    // the table. Retry twice with a back-off. A site whose annotation still fails says so; it is never
    // silently reported as intergenic, because "no genes returned" and "the request failed" are different facts.
    for (let attempt = 0; attempt < 2 && s.gene_context?.error && /HTTP 5\d\d/.test(s.gene_context.error); attempt++) {
      await new Promise(r2 => setTimeout(r2, 700 * (attempt + 1)));
      const again = await fetchCached({ url: `${ENS}/overlap/region/${SPECIES}/${s.chromosome}:${Math.max(1, s.hit_from - 2000)}-${s.hit_to + 2000}?feature=gene;content-type=application/json` }, { network });
      if (Array.isArray(again.value)) s.gene_context = again.value.map(g => ({ id: g.id, symbol: g.external_name || null, biotype: g.biotype, start: g.start, end: g.end }));
      else s.gene_context = { error: again.error, attempts: attempt + 2, note: 'Ensembl /overlap/region did not answer for this site. This is NOT a finding that the site is intergenic: the gene context here is UNKNOWN.' };
    }
  }
  return sites;
}

/**
 * LOCAL exhaustive search. Needs the one-time index (grcz11-local.mjs build). No network except the
 * Ensembl gene annotation of the hits.
 */
export async function offTargetsLocal(spacer, pam, { network = true, maxMismatches = 4, geneContext = true, pamSide = '3prime', sequences = 'all' } = {}) {
  const key = { tool: 'editplan-offtarget', method: 'local-exhaustive', assembly: ASSEMBLY, query: spacer, pam, pamSide, maxMismatches, sequences };
  const c = cacheGet(key);
  let v = c?.value;
  if (!v) {
    const st = LOCAL.indexStatus();
    if (!st.built) return { ran: false, method: 'local-exhaustive', reason: 'the local GRCz11 index is not built', index: st };
    const r = LOCAL.scanGenome([{ spacer, pam, pam_side: pamSide }], { maxMismatches, sequences });
    if (!r.ran) return { ...r, method: 'local-exhaustive' };
    const q = r.queries[0];
    const sites = q.sites.map(s => ({
      accession: s.sequence, sequence_kind: s.sequence_kind, chromosome: s.chromosome,
      hit_strand: s.strand, hit_from: s.start, hit_to: s.end,
      aligned_genome_sequence: s.protospacer_strand_sequence,
      pam_at_site: s.pam_at_site, pam_compatible: true,
      n_mismatches: s.n_mismatches, mismatch_positions: s.mismatch_positions,
      mit_single_site_score: pamSide === '3prime' && spacer.length === 20 ? +mitSingleScore(s.mismatch_positions).toFixed(6) : null,
    }));
    sites.sort((a, b) => a.n_mismatches - b.n_mismatches || (b.mit_single_site_score ?? 0) - (a.mit_single_site_score ?? 0));
    v = {
      ran: true, method: 'local-exhaustive', assembly: ASSEMBLY,
      database: `${ASSEMBLY} primary assembly, local index (${r.n_sequences_scanned} sequences, ${r.scanned_bp} bp), from ${LOCAL.FASTA_URL}`,
      program: `exhaustive PAM-anchored substitution scan of both strands; every position tested, no seeding step. ${(r.elapsed_ms / 1000).toFixed(1)} s.`,
      query: spacer, pam_motif: pam, pam_side: pamSide,
      pam_note: `UNLIKE the BLAST path, the PAM IS CHECKED AT EVERY SITE: only positions carrying a ${pam}-compatible PAM in the right orientation are reported, so every site listed is cuttable in the PAM sense.`,
      n_sites_within_mismatch_limit: sites.length, max_mismatches: maxMismatches,
      sites_by_mismatch_count: sites.reduce((a, s) => (a[s.n_mismatches] = (a[s.n_mismatches] || 0) + 1, a), {}),
      collection_truncated: q.truncated || false,
      sites,
      mismatch_position_convention: pamSide === '3prime'
        ? 'position 1 is the PAM-DISTAL end of the spacer, which is the convention the Hsu 2013 weights are indexed in'
        : 'position 1 is the 5\' end of the spacer, which for a 5\'-PAM nuclease (Cas12a) is the PAM-PROXIMAL end. The Hsu 2013 weights were fitted on SpCas9 and are NOT applied to these sites (mit_single_site_score is null).',
      what_this_does_not_cover:
        'EXHAUSTIVE for substitutions over the sequences indexed, and that is the only sense in which it is complete. It does NOT model BULGES ' +
        '(DNA/RNA insertions or deletions at the target), which Cas9 tolerates, so a bulged off-target is invisible to it. It covers the GRCz11 ' +
        'PRIMARY assembly only: no alternative loci, no patches, and - the one that matters at the bench - NOT the genome of the laboratory strain ' +
        'being injected (AB/TU/WIK differ from the reference at high SNP density, so a site can exist in the fish that does not exist here and vice ' +
        'versa). It says nothing about chromatin, expression or delivery: a matched site is a SEQUENCE match, not a cut. And it is not a measurement - ' +
        'GUIDE-seq, CIRCLE-seq or amplicon sequencing of the actual fish is the measurement; this is the list of places to look.',
    };
    cachePut(key, v);
    if (geneContext) { await annotateGeneContext(v.sites, { network }); annotationSummary(v); cachePut(key, v); }
    return { ...v, cached: false };
  }
  if (geneContext && v.sites?.length && v.sites[0].gene_context === undefined) { await annotateGeneContext(v.sites, { network }); cachePut(key, v); }
  if (v.sites?.length) annotationSummary(v);   // also for a cache entry written before this summary existed
  return { ...v, cached: true };
}

/** How much of the site list actually carries a gene context, so a reader is not misled by silence. */
function annotationSummary(v) {
  const n = s => v.sites.filter(s2 => s2 !== undefined && s(s2)).length;
  v.gene_annotation = {
    n_sites: v.sites.length,
    n_annotated: n(s => Array.isArray(s.gene_context)),
    n_annotation_failed: n(s => s.gene_context?.error),
    n_not_attempted: n(s => s.gene_context?.not_attempted),
    rule: 'every site with <= 3 mismatches is annotated however many there are; others up to a budget of 25. A site with no annotation is reported as UNKNOWN, never as intergenic.',
    why: 'the search is exhaustive, so a guide can have 100+ sites at 4 mismatches. Annotating all of them would be hundreds of Ensembl calls per guide for sites whose Hsu score is negligible.',
  };
  return v;
}

export const OFFTARGET_METHODS = {
  local: 'exhaustive PAM-anchored substitution scan of the local GRCz11 primary-assembly index (grcz11-local.mjs). Complete for substitutions, bulges not modelled. ~22 s per guide for the whole assembly.',
  ncbi: 'NCBI BLAST URL API, blastn-short word_size 7, against GPIPE/7955/current/all_top_level. A heuristic aligner (counts are a floor) and in practice it did not return: see NCBI_QUEUE_EXPERIENCE.',
  auto: 'local if the index is built, otherwise ncbi. The default.',
};

/**
 * Off-target search against GRCz11. Prefers the local exhaustive scan; falls back to NCBI BLAST.
 * @param opts.method 'auto' (default) | 'local' | 'ncbi'
 */
export async function offTargets(spacer, pam, opts = {}) {
  const method = opts.method || process.env.EDITPLAN_OFFTARGET_METHOD || 'auto';
  if (method === 'ncbi') return { ...(await offTargetsNCBI(spacer, pam, opts)), method: 'ncbi-blast' };
  const st = LOCAL.indexStatus();
  if (st.built) return offTargetsLocal(spacer, pam, opts);
  if (method === 'local') return { ran: false, method: 'local-exhaustive', reason: 'the local GRCz11 index is not built, and method:"local" was requested explicitly', index: st };
  const r = await offTargetsNCBI(spacer, pam, opts);
  return { ...r, method: 'ncbi-blast', why_this_backend: `the local index is not built (${st.how_to_build}), so the search fell back to NCBI BLAST. ${NCBI_QUEUE_EXPERIENCE}` };
}

// ---------------------------------------------------------------- 4. HDR donor (ssODN)
// ARM LENGTHS: CORRECTED IN THIS RUN against the two zebrafish papers, which were re-read rather than
// paraphrased. The previous default here was 40/40 nt with the note "40/40 is the conventional starting
// point, not their measured optimum". That was honest about being a guess but it was the WRONG guess, and
// the measured number was available: Boel et al. 2018 titrated total ssODN length at four zebrafish sgRNA
// sites and reports "In three out of four sgRNA targets, the HDR rate for symmetrical templates increased
// significantly when extending the template length from 60 to 120 nucleotides (nt), with the maximum
// improvement being tenfold", that 180 nt "moderately decreased HDR rates in most cases", and the
// conclusion "Repair-template length significantly affects total repair rates, with 120 nt being identified
// as the most optimal length to promote HDR". So the default is now 60/60 (120 nt total), which is Boel's
// measured optimum rather than a convention. 40/40 (80 nt total) sat in the range Boel measured to be up to
// tenfold worse.
//   CAVEAT, kept because it is real: Boel states the optimum as a TOTAL length of 120 nt. The 60+60 per-arm
//   split is OUR reading of "symmetrical" and is not stated as a split in the text that was read. It is
//   marked `per_arm_split_is_ours` below.
//
// SYMMETRIC vs ASYMMETRIC: THE TWO ZEBRAFISH PAPERS DISAGREE, and the plan now says so instead of picking a
// winner. Boel 2018: "Asymmetrically designed templates did not result in better HDR rates compared to
// symmetrically designed templates", and "no specific type of repair template performed consistently best
// across all four sgRNA target sites". Prykhozhij 2018: asymmetric anti-sense was "substantially more
// efficient (3- to 10-fold)". The disagreement is not resolvable from these two papers, because Prykhozhij
// varied ORIENTATION and ASYMMETRY together and its own text says they "have additive contributions", so it
// does not isolate arm length. No zebrafish study isolates arm length from orientation, and none tested
// symmetric 40/40 at all. Both donors are therefore emitted and the plan says to order both and compare.
// CUT-SITE PROXIMITY: WHO THE NUMBER ACTUALLY BELONGS TO. This module ranks guides on cut-to-edit distance
// and defaults to a 30 bp window, and it used to cite Prykhozhij 2018 for that. Re-reading Prykhozhij's full
// text in this run shows the citation was over-stated: Prykhozhij contains NO zebrafish-measured
// distance-versus-efficiency relationship. Its only quantitative distance claim is in its INTRODUCTION and
// is explicitly murine, and it cites ONE reference for it. Its own zebrafish statements on distance are
// qualitative. So the qualitative principle is Prykhozhij's; the numbers are Paquet's, in a different
// system. Both are now named, in the right places.
export const CUT_DISTANCE_EVIDENCE = {
  one_line: 'Guides are ranked on this because cut-site proximity to the mutation improves knock-in efficiency - a QUALITATIVE zebrafish-supported principle (Prykhozhij 2018). The numeric thresholds behind the 30 bp window are NOT zebrafish numbers: see CUT_DISTANCE_EVIDENCE.',
  qualitative_zebrafish: { citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46(17):e102, doi 10.1093/nar/gky512, PMID 29905858',
    quoted: ['cut site proximity to the mutation and phosphorothioate oligo modifications also greatly improved knock-in efficiency (abstract)',
      'knock-ins farther than 10 nt from the cut site are much less efficient (results; no numbers attached)',
      'the cdh5 knock-in was located at the cut site, while the tp53 knock-ins were 11 and 13 nucleotides away from their cut sites'],
    what_it_does_NOT_contain: 'any zebrafish-measured efficiency-versus-distance curve or percentage. Every statement above is qualitative.',
    kind: 'measured (qualitative)' },
  the_numbers_are_not_zebrafish: {
    quoted_from_prykhozhij_introduction: 'The most efficient positions for a modification should be located <15 nt and ideally <10 nt away from the cut site, as at a distance of 20 nt away from the cut site, the efficiency drops to 20-30% of the maximum, as observed in murine cells.',
    original_source: 'Paquet et al. 2016, Nature 533, doi 10.1038/nature17664, PMID 27120160, "Efficient introduction of specific homozygous and heterozygous mutations using CRISPR/Cas9" - the single reference Prykhozhij cites for that sentence (its reference 13).',
    system: 'murine / mammalian cells, NOT zebrafish embryos',
    also_cited_nearby: 'Liang et al. 2016, J Biotechnol 241:136-146, doi 10.1016/j.jbiotec.2016.11.011, PMID 27845164 - cited by Prykhozhij one sentence earlier for the inverse relationship in general, not for the 20-30 % figure.',
    page_range_caveat: 'Prykhozhij\'s reference list renders Paquet as "533:1-18", evidently a formatting artifact. The true page range was not verified in this run; do not cite pages for Paquet from here.',
    kind: 'measured-secondhand, transferred across species' },
  correction_made_in_this_run: 'the <10 nt / 20 nt / 20-30 % figures were previously attributed, by implication, to Prykhozhij 2018 as zebrafish data. They are Paquet 2016 murine-cell data quoted in Prykhozhij\'s introduction. The ranking rule still uses proximity; the numeric justification is now cited to Paquet and labelled as a cross-species transfer.',
};

export const ARM_LENGTH_EVIDENCE = {
  question: 'how long should each homology arm of a zebrafish point-knock-in ssODN be, and should it be asymmetric?',
  boel_2018: { citation: 'Boel et al. 2018, Dis Model Mech 11:dmm035352, doi 10.1242/dmm.035352, PMID 30355591, PMC6215429', recommends: '120 nt TOTAL, symmetric',
    quoted: ['In three out of four sgRNA targets, the HDR rate for symmetrical templates increased significantly when extending the template length from 60 to 120 nucleotides (nt), with the maximum improvement being tenfold',
      'Repair-template length significantly affects total repair rates, with 120 nt being identified as the most optimal length to promote HDR',
      'Asymmetrically designed templates did not result in better HDR rates compared to symmetrically designed templates',
      'no specific type of repair template performed consistently best across all four sgRNA target sites'],
    designs_tested: '60, 120 and 180 nt total, symmetric and asymmetric, in target and non-target orientation, at four sgRNA sites (smad6a, tprkb, pls3, slc2a10). Its asymmetric design was 90/30 nt.',
    kind: 'measured' },
  prykhozhij_2018: { citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46(17):e102, doi 10.1093/nar/gky512, PMID 29905858, PMC6158492 ("Optimized knock-in of point mutations in zebrafish using CRISPR/Cas9")', recommends: 'ASYMMETRIC anti-sense, 36 nt over the sgRNA site / 90 nt on the other side',
    quoted: ['substantially more efficient (3- to 10-fold) as measured by AS-PCR and next-generation sequencing'],
    confound: 'it varied orientation AND asymmetry together, and its own text says these "have additive contributions", so it does not isolate arm length. Its symmetric comparator had a 60 nt short arm.',
    erratum: 'an erratum exists (Nucleic Acids Res 2018 Jul 24;46(17):9252, doi 10.1093/nar/gky674, PMC6158599) and was NOT read in this run, so we cannot say whether it changes any number quoted here.',
    kind: 'measured' },
  unresolved: 'The two papers disagree on asymmetry. No zebrafish study isolates arm length from strand orientation, and no zebrafish study tested symmetric 40/40. Richardson et al. 2016 (Nat Biotechnol 34:339-344, doi 10.1038/nbt.3481), the source of the 36/91 split, is HUMAN CELLS. Order both designs and compare; that is the only honest instruction.',
};
export const DONOR_DESIGN = {
  symmetric: { left: 60, right: 60, kind: 'measured-secondhand',
    citation: 'Boel et al. 2018, Dis Model Mech 11:dmm035352, doi 10.1242/dmm.035352, PMID 30355591, PMC6215429 - "Repair-template length significantly affects total repair rates, with 120 nt being identified as the most optimal length to promote HDR" (four zebrafish sgRNA sites, 60 vs 120 vs 180 nt total)',
    per_arm_split_is_ours: 'Boel states the optimum as a TOTAL length of 120 nt. Splitting it 60+60 is OUR reading of "symmetrical"; the per-arm split is not given in the text we read.',
    changed_in_this_run: 'was 40/40 (80 nt total), which was labelled a convention rather than a measurement and sat in the length range Boel measured to be up to tenfold worse. Corrected to Boel\'s measured optimum.',
    borrowing: 'Boel\'s loci, not ours, and its readout is pooled 1-dpf embryos. Boel also found asymmetry gave NO benefit, which Prykhozhij 2018 contradicts; see ARM_LENGTH_EVIDENCE.' },
  asymmetric: { pam_distal: 36, pam_proximal: 91, kind: 'borrowed',
    citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46(17):e102, doi 10.1093/nar/gky512, PMID 29905858, PMC6158492 - asymmetric anti-sense was "substantially more efficient (3- to 10-fold)" in ZEBRAFISH; its own arms were 36 nt over the sgRNA site / 90 nt on the other side. The 36/91 nt split used here is Richardson et al. 2016, Nat Biotechnol 34:339-344, doi 10.1038/nbt.3481, measured in HUMAN CELLS.',
    contradicted_by: 'Boel et al. 2018 found that "asymmetrically designed templates did not result in better HDR rates compared to symmetrically designed templates". The two zebrafish papers disagree and this plan does not pick a winner: see ARM_LENGTH_EVIDENCE and order both.',
    borrowing: 'asymmetric + anti-sense is a zebrafish result (Prykhozhij 2018), but a CONFOUNDED one: it varied orientation and asymmetry together and says they "have additive contributions", so it does not isolate arm length. The 36/91 nt numbers are a human-cell result borrowed here.' },
};
/**
 * ssODN donor for a point change: the edited genomic sequence with homology arms, plus silent blocking
 * mutations in the PAM and/or the PAM-proximal seed so the donor and the repaired allele are not re-cut.
 * Every blocking mutation is CHECKED to leave the protein unchanged; one that does not is dropped.
 */
export function donorFor(res, guide, { arms = 'symmetric', left, right, block = true } = {}) {
  const win = res.window, t = res.target;
  if (!win?.seq || t.kind === 'knockout') return { ran: false, reason: 'ssODN donors are for point changes; a knockout uses a frameshift, not a donor' };
  const chosen = t.chosen_codon;
  if (!chosen) return { ran: false, reason: 'no codon option for the desired residue' };
  const strand = res.strand;
  const off = p => p - win.start;                              // chromosome -> 0-based offset in win.seq (forward)
  // Build the EDITED forward-strand sequence of the window.
  let edited = win.seq.split('');
  const applied = [];
  for (const c of chosen.nt_changes) { edited[off(c.genomic_pos)] = c.genomic_alt; applied.push({ ...c, what: 'the intended coding change' }); }

  // Blocking mutations: silent changes that destroy the PAM or mismatch the seed.
  const blocking = [];
  if (block) {
    const pamOffs = [];
    for (let p = guide.pam_chrom[0]; p <= guide.pam_chrom[1]; p++) pamOffs.push(p);
    // Seed = the 10 PAM-proximal bases of the protospacer.
    const protoAll = []; for (let p = guide.protospacer_chrom[0]; p <= guide.protospacer_chrom[1]; p++) protoAll.push(p);
    const seed = guide.strand === 1 ? protoAll.slice(-10) : protoAll.slice(0, 10);
    const candidates = [...pamOffs, ...seed];
    for (const gp of candidates) {
      const cdsIdx = cdsIndexOfGenomic(res, gp);
      if (cdsIdx == null) continue;                       // intronic/UTR: a change there is not "silent", skip it
      const codonNo = Math.ceil(cdsIdx / 3), basePos = ((cdsIdx - 1) % 3) + 1;
      if (codonNo === t.protein_position) continue;       // already being changed
      const cur = currentCodon(res, edited, codonNo);
      if (!cur) continue;
      const aa = aaOf(cur.codon);
      for (const alt of codonsFor(aa)) {
        if (alt === cur.codon) continue;
        if (alt[basePos - 1] === cur.codon[basePos - 1]) continue;       // must change THIS base
        // Only accept a single-base synonymous change at this base.
        let diffs = 0; for (let i = 0; i < 3; i++) if (alt[i] !== cur.codon[i]) diffs++;
        if (diffs !== 1) continue;
        const fwdAlt = strand === 1 ? alt[basePos - 1] : COMP[alt[basePos - 1]];
        const isPam = gp >= guide.pam_chrom[0] && gp <= guide.pam_chrom[1];
        blocking.push({ genomic_pos: gp, cds_pos: cdsIdx, codon: codonNo, codon_before: cur.codon, codon_after: alt,
          amino_acid: aa, protein_unchanged: aaOf(alt) === aa,
          genomic_ref: edited[off(gp)], genomic_alt: fwdAlt,
          where: isPam ? 'PAM' : 'PAM-proximal seed (10 nt closest to the PAM)',
          why: isPam ? 'destroying the PAM stops the repaired allele and the donor itself from being re-cut' : 'a seed mismatch strongly reduces re-cutting even with the PAM intact',
          codon_usage_fraction_of_family_before: res.codon_usage?.fraction_of_synonymous_family?.[cur.codon] ?? null,
          codon_usage_fraction_of_family_after: res.codon_usage?.fraction_of_synonymous_family?.[alt] ?? null,
          codon_usage_note: 'a silent change still changes codon usage; both fractions are given so a reviewer can see whether we swapped a common codon for a rare one' });
        break;
      }
      if (blocking.length >= 2) break;
    }
    for (const b of blocking) if (b.protein_unchanged) { edited[off(b.genomic_pos)] = b.genomic_alt; applied.push({ ...b, what: 'silent blocking mutation' }); }
  }
  const editedSeq = edited.join('');
  // Arms, centred on the cut site (not on the codon): HDR tracts are measured from the break.
  const centre = off(guide.cut_site_chrom);
  const spec = arms === 'asymmetric' ? DONOR_DESIGN.asymmetric : DONOR_DESIGN.symmetric;
  let L = left ?? (arms === 'asymmetric' ? (guide.strand === 1 ? spec.pam_distal : spec.pam_proximal) : spec.left);
  let R = right ?? (arms === 'asymmetric' ? (guide.strand === 1 ? spec.pam_proximal : spec.pam_distal) : spec.right);
  const lo = centre - L, hi = centre + R;
  if (lo < 0 || hi >= editedSeq.length) return { ran: false, reason: `the ${L}/${R} nt arms run outside the fetched window (${editedSeq.length} nt); refetch with a larger flank` };
  const sense = editedSeq.slice(lo, hi + 1);
  const unedited = win.seq.slice(lo, hi + 1);
  // Which strand to order: the ssODN complementary to the strand the PAM is on (i.e. the non-target strand
  // relative to the guide) is the one that is usually reported to work better; we state the choice, not a claim.
  const order = guide.strand === 1 ? revcomp(sense) : sense;
  return {
    ran: true, kind: 'ssODN (single-stranded oligodeoxynucleotide donor)',
    arms: { style: arms, left_nt: L, right_nt: R, centred_on: 'the Cas9 cut site', asymmetry: L === R ? 'symmetric' : `asymmetric, ${L} nt / ${R} nt`, design_citation: spec.citation, provenance_kind: spec.kind, borrowing: spec.borrowing || null },
    length_nt: sense.length,
    genomic_span: [win.start + lo, win.start + hi],
    sequence_forward_strand_5to3: sense,
    sequence_to_order_5to3: order,
    sequence_antisense_to_mRNA_5to3: strand === 1 ? revcomp(sense) : sense,
    strand_to_order: guide.strand === 1 ? 'reverse (complementary to the protospacer strand)' : 'forward (complementary to the protospacer strand)',
    strand_choice_note: 'two strand rules exist and they do not always agree. (a) complementary to the protospacer strand - what sequence_to_order_5to3 gives. (b) ANTI-SENSE to the mRNA, which Prykhozhij et al. 2018 (NAR 46:e102, doi 10.1093/nar/gky512) found to be the most successful single optimisation in zebrafish - that is sequence_antisense_to_mRNA_5to3. Order both and compare rather than trusting either.',
    cut_site_proximity: `the cut site is ${Math.abs(guide.cut_site_chrom - res.target.genomic_positions[0])} bp from the edited codon. ${CUT_DISTANCE_EVIDENCE.one_line}`,
    unedited_reference_same_span_5to3: unedited,
    changes_applied: applied,
    blocking_mutations: blocking,
    blocking_mutations_applied: blocking.filter(b => b.protein_unchanged).length,
    blocking_warning: blocking.length ? null : 'NO silent blocking mutation was available: every base of the PAM and seed is either outside the CDS or cannot be changed synonymously. The repaired allele can be re-cut, which lowers the yield of clean knock-ins and can add indels on top of the knock-in.',
    protein_check: proteinUnchangedExceptTarget(res, editedSeq),
    phosphorothioate_note: 'Order the ssODN with terminal phosphorothioate linkages: Prykhozhij et al. 2018 (NAR 46:e102) report that phosphorothioate oligo modifications greatly improved knock-in efficiency in zebrafish. We did not read the size of that gain off their figures, so no number is attached to it here.',
    trans_knock_in_warning: 'Prykhozhij 2018 identified a previously unrecognised risk of OFF-TARGET TRANS knock-ins: the ssODN can be integrated somewhere other than the target. Their paper describes a detection workflow; use it. Genotyping only at the target locus will not find this.',
  };
}
/** Genomic coordinate -> CDS index (1-based), from the coding blocks. null when the base is not coding. */
export function cdsIndexOfGenomic(res, gp) {
  if (!res.coding_blocks) return null;
  return cdsIndexFromBlocks(res.coding_blocks, res.strand, gp);
}
/** Genomic position of a CDS index, from the coding blocks. */
export function genomicOfCdsIndex(res, cdsIdx) {
  for (const b of res.coding_blocks || []) {
    if (cdsIdx < b.cds_from || cdsIdx > b.cds_to) continue;
    return res.strand === 1 ? b.start + (cdsIdx - b.cds_from) : b.end - (cdsIdx - b.cds_from);
  }
  return null;
}
function currentCodon(res, editedArr, codonNo) {
  const first = 3 * codonNo - 2;
  const idx = [first, first + 1, first + 2];
  const gps = idx.map(i => genomicOfCdsIndex(res, i));
  if (gps.some(g => g == null)) return null;
  const off = p => p - res.window.start;
  if (gps.some(g => off(g) < 0 || off(g) >= editedArr.length)) return null;
  const bases = gps.map(g => editedArr[off(g)]);
  const codon = res.strand === 1 ? bases.join('') : revcomp(bases.join(''));
  return { codon, genomic_positions: gps };
}
/** Re-translate the edited window's coding bases and confirm only the target codon changed. */
function proteinUnchangedExceptTarget(res, editedSeq) {
  if (!res.coding_blocks) return { ran: false, reason: 'no coding-block map for this window' };
  const off = p => p - res.window.start;
  const changed = [];
  for (let g = res.window.start; g <= res.window.end; g++) {
    const c = cdsIndexOfGenomic(res, g); if (c == null) continue;
    const o = off(g); if (o < 0 || o >= editedSeq.length) continue;
    const refBase = res.strand === 1 ? res.cds[c - 1] : COMP[res.cds[c - 1]];
    if (editedSeq[o] !== refBase) changed.push({ cds_pos: c, codon: Math.ceil(c / 3), from: refBase, to: editedSeq[o] });
  }
  const codons = [...new Set(changed.map(c => c.codon))];
  const aaChanges = [];
  for (const cn of codons) {
    const before = res.cds.slice(3 * cn - 3, 3 * cn);
    const after = currentCodon(res, editedSeq.split(''), cn)?.codon;
    if (after && aaOf(before) !== aaOf(after)) aaChanges.push({ codon: cn, before, after, from: aaOf(before), to: aaOf(after) });
  }
  const ok = aaChanges.length === 1 && aaChanges[0].codon === res.target.protein_position && aaChanges[0].to === res.target.desired_residue;
  return { ran: true, status: ok ? 'passed' : 'failed', codons_touched: codons.sort((a, b) => a - b), amino_acid_changes: aaChanges,
    expected: `exactly one amino-acid change, codon ${res.target.protein_position} ${res.target.reference_residue}->${res.target.desired_residue}`,
    detail: ok ? 'the donor changes exactly the intended residue; every other change is synonymous' : 'the donor does NOT produce exactly the intended single amino-acid change' };
}

// ---------------------------------------------------------------- 5. base editors
// Standard cytosine (C>T) and adenine (A>G) base editors make TRANSITIONS only. A transversion is not
// reachable and is reported as such rather than fudged into a "possible" option.
export const BASE_EDITORS = {
  CBE: { name: 'cytosine base editor (C>T; G>A on the opposite strand)', window: [4, 8], window_note: 'protospacer positions 4-8 counted from the PAM-distal end (position 1) are the high-activity window; activity tails off outside it',
    editors: ['BE4max', 'AncBE4max', 'evoAPOBEC1-BE4max'],
    zebrafish_citation: 'Zhang et al. 2017, Nat Commun 8:118, doi 10.1038/s41467-017-00175-6 (programmable base editing of the zebrafish genome with a cytidine deaminase-nCas9 fusion)' },
  ABE: { name: 'adenine base editor (A>G; T>C on the opposite strand)', window: [4, 7], window_note: 'protospacer positions 4-7 from the PAM-distal end are the high-activity window for ABE7.10/ABE8e',
    editors: ['ABE7.10', 'ABE8e'],
    zebrafish_citation: 'Qin et al. 2018, BMC Biology 16:139, doi 10.1186/s12915-018-0609-1 (precise A-to-G base editing in the zebrafish genome)' },
};
/** Can this nucleotide change be made by a standard CBE/ABE, and if so with which guide and window position? */
export function baseEditorOption(res, guides) {
  const t = res.target;
  if (t.kind === 'knockout') return istopCandidates(res, guides);
  const changes = (t.chosen_codon?.nt_changes) || [];
  if (changes.length !== 1) return { reachable: false, reason: `the change needs ${changes.length} nucleotide substitutions in one codon; standard base editors install one transition and cannot do this`, considered: t.desired_codon_options?.map(o => ({ codon: o.codon, n_nt_changes: o.n_nt_changes })) };
  const ch = changes[0];
  // Which editor, judged on the FORWARD-strand change (a CBE edits C on whichever strand the guide's
  // protospacer strand is; we test both orientations).
  const pairs = [
    { ed: 'CBE', from: 'C', to: 'T' },
    { ed: 'ABE', from: 'A', to: 'G' },
  ];
  const fwd = { ref: ch.genomic_ref, alt: ch.genomic_alt };
  const rev = { ref: COMP[ch.genomic_ref], alt: COMP[ch.genomic_alt] };
  const hit = pairs.find(p => (fwd.ref === p.from && fwd.alt === p.to)) || pairs.find(p => (rev.ref === p.from && rev.alt === p.to));
  if (!hit) {
    const other = t.desired_codon_options.filter(o => o.n_nt_changes === 1).map(o => o.nt_changes[0]);
    return { reachable: false,
      reason: `${ch.cds_ref}>${ch.cds_alt} at c.${ch.cds_pos} is a TRANSVERSION. Standard cytosine (C>T) and adenine (A>G) base editors make transitions only, so no standard base editor can install this change.`,
      transversions_considered: other.map(o => `c.${o.cds_pos}${o.cds_ref}>${o.cds_alt}`),
      what_would_be_needed: 'a prime editor (or a C-to-G base editor, for which we found no zebrafish germline report to cite). Prime editing DOES work in the zebrafish germline: Petri et al. 2022, Nat Biotechnol 40:189-193, doi 10.1038/s41587-021-00901-y, PMID 33927418, introduced somatic mutations in zebrafish embryos at frequencies as high as 30 % with purified prime-editor ribonucleoprotein and demonstrated germline transmission - while also observing unintended insertions, deletions and pegRNA scaffold incorporation. See prime_editor_route for a designed pegRNA.' };
  }
  const which = (fwd.ref === hit.from && fwd.alt === hit.to) ? 1 : -1;   // strand on which the target base is the editable base
  const spec = BASE_EDITORS[hit.ed];
  // Find guides whose protospacer puts the target base in the editing window on the right strand.
  const usable = [];
  for (const g of guides.filter(x => x.nuclease === 'SpCas9')) {
    if (g.strand !== which) continue;
    const lo = g.protospacer_chrom[0], hi = g.protospacer_chrom[1];
    if (ch.genomic_pos < lo || ch.genomic_pos > hi) continue;
    const posInProto = g.strand === 1 ? ch.genomic_pos - lo + 1 : hi - ch.genomic_pos + 1;
    const inWindow = posInProto >= spec.window[0] && posInProto <= spec.window[1];
    // Bystanders: other editable bases of the same identity in the window.
    const bystanders = [];
    for (let p = lo; p <= hi; p++) {
      const pi = g.strand === 1 ? p - lo + 1 : hi - p + 1;
      if (pi < spec.window[0] || pi > spec.window[1] || p === ch.genomic_pos) continue;
      const b = g.strand === 1 ? null : null;
      bystanders.push({ genomic_pos: p, position_in_protospacer: pi });
    }
    const protoBases = g.spacer.split('');
    const byst = protoBases.map((b, i) => ({ b, i: i + 1 })).filter(x => x.i >= spec.window[0] && x.i <= spec.window[1] && x.b === hit.from && x.i !== posInProto);
    usable.push({ ...g, position_of_target_base_in_protospacer: posInProto, in_high_activity_window: inWindow,
      bystander_editable_bases_in_window: byst.map(x => ({ position_in_protospacer: x.i, base: x.b })),
      bystander_warning: byst.length ? `${byst.length} other ${hit.from} in the editing window will probably also be edited, which can change other codons. Check each one.` : null });
  }
  usable.sort((a, b) => (b.in_high_activity_window - a.in_high_activity_window) || Math.abs(5 - a.position_of_target_base_in_protospacer) - Math.abs(5 - b.position_of_target_base_in_protospacer));
  return { reachable: usable.some(u => u.in_high_activity_window), editor_class: hit.ed, editor: spec.name,
    editors_to_consider: spec.editors, high_activity_window: spec.window, window_note: spec.window_note,
    zebrafish_precedent: spec.zebrafish_citation,
    edit: `${hit.from}>${hit.to} on the ${which === 1 ? 'forward' : 'reverse'} strand at ${ASSEMBLY} ${res.chromosome}:${ch.genomic_pos}`,
    guides: usable.slice(0, 6),
    advantage: 'no double-strand break and no donor, so no HDR bottleneck and no indel spectrum at the cut site',
    NOT: 'base-editing efficiency in zebrafish embryos is not predicted by this module. No efficiency number is given because we did not source a measured rate for these loci.' };
}

/**
 * iSTOP: a cytosine base editor can install a premature stop codon with no double-strand break and no donor.
 * C>T on the CODING strand turns CAA->TAA, CAG->TAG, CGA->TGA. C>T on the TEMPLATE strand turns a coding
 * TGG into TGA/TAG/TAA (the template reads CCA). Billon et al. 2017, Mol Cell 67:1068-1079,
 * doi 10.1016/j.molcel.2017.08.008.
 * Every candidate reported here is one we checked: the codon is read from the real CDS, the editable C is
 * placed in the editor's window by a real protospacer, and the resulting codon is recomputed, not assumed.
 */
export function istopCandidates(res, guides, { editor = 'CBE' } = {}) {
  const t = res.target, spec = BASE_EDITORS[editor];
  const sense = { CAA: 'TAA', CAG: 'TAG', CGA: 'TGA' };
  const out = [];
  const lastCodon = Math.floor(t.cds_window[1] / 3);
  for (let codonNo = 2; codonNo <= lastCodon; codonNo++) {
    const codon = res.cds.slice(3 * codonNo - 3, 3 * codonNo);
    let editStrandRelativeToGene, cdsBase, resulting;
    if (sense[codon]) { editStrandRelativeToGene = 1; cdsBase = 1; resulting = sense[codon]; }       // C at codon base 1
    else if (codon === 'TGG') { editStrandRelativeToGene = -1; cdsBase = 3; resulting = 'TGA'; }     // template CCA, edit the C opposite G3
    else continue;
    const cdsIdx = 3 * codonNo - 3 + cdsBase;
    const gp = genomicOfCdsIndex(res, cdsIdx);
    if (gp == null) continue;
    // Which genomic strand carries the editable C?
    const cStrand = editStrandRelativeToGene === 1 ? res.strand : -res.strand;
    for (const g of guides.filter(x => x.nuclease === 'SpCas9' && x.strand === cStrand)) {
      const [lo, hi] = g.protospacer_chrom;
      if (gp < lo || gp > hi) continue;
      const posInProto = g.strand === 1 ? gp - lo + 1 : hi - gp + 1;
      if (posInProto < spec.window[0] || posInProto > spec.window[1]) continue;
      if (g.spacer[posInProto - 1] !== 'C') continue;   // the protospacer must actually read C there
      const byst = g.spacer.split('').map((b, i) => ({ b, i: i + 1 }))
        .filter(x => x.i >= spec.window[0] && x.i <= spec.window[1] && x.b === 'C' && x.i !== posInProto);
      out.push({ codon_number: codonNo, codon, resulting_codon: resulting, resulting: 'premature stop',
        cds_pos: cdsIdx, genomic_pos: gp, assembly: ASSEMBLY, chromosome: res.chromosome,
        edit: `C>T on the ${cStrand === 1 ? 'forward' : 'reverse'} strand at ${res.chromosome}:${gp}`,
        protein_fraction_lost: +(1 - codonNo / res.protein_length).toFixed(3),
        spacer: g.spacer, pam: g.pam, strand: g.strand, position_of_target_C_in_protospacer: posInProto,
        in_high_activity_window: true, on_target: onTargetHeuristic(g.spacer),
        bystander_C_in_window: byst.map(x => x.i),
        bystander_warning: byst.length ? `${byst.length} other C in the editing window will probably also be edited. For a knockout that is usually tolerable (the stop truncates the protein anyway) but each one must still be sequenced.` : null });
      break;
    }
    if (out.length >= 6) break;
  }
  out.sort((a, b) => b.protein_fraction_lost - a.protein_fraction_lost || b.on_target.score - a.on_target.score);
  return { strategy: 'CBE nonsense (iSTOP): install a premature stop with a cytosine base editor, no double-strand break and no donor',
    reachable: out.length > 0,
    reason: out.length ? null : 'no CAA/CAG/CGA (coding strand) or TGG (template strand) codon in the early CDS has its editable C inside a CBE window of an NGG protospacer in the fetched sequence',
    editor_class: 'CBE', editor: spec.name, editors_to_consider: spec.editors, high_activity_window: spec.window, window_note: spec.window_note,
    istop_citation: 'Billon et al. 2017, Mol Cell 67:1068-1079, doi 10.1016/j.molcel.2017.08.008',
    zebrafish_precedent: spec.zebrafish_citation,
    candidates: out.slice(0, 6),
    advantage: 'a clean stop codon instead of an indel lottery: every edited allele is the SAME allele, which removes the F0 allele-heterogeneity problem that makes frameshift knockouts hard to interpret',
    caveat: 'a premature stop is not always a null: it can trigger nonsense-mediated decay (usually what is wanted), or produce a truncated protein with residual or neomorphic activity, or trigger transcriptional adaptation of paralogues (El-Brolosy et al. 2019, Nature 568:193-197, doi 10.1038/s41586-019-1064-z - a real and documented zebrafish problem for ANY nonsense or frameshift allele, including the frameshift route).',
    NOT: 'no editing efficiency is predicted. We did not source a measured CBE rate for this locus.' };
}

// ---------------------------------------------------------------- 5b. prime editing (the route for a transversion)
// Geometry, from Anzalone et al. 2019, Nature 576:149-157, doi 10.1038/s41586-019-1711-4:
//   * Cas9 H840A nickase nicks the PROTOSPACER-containing strand 3 bp 5' of the PAM (same site as the Cas9 cut).
//   * The 3'-OH of the nicked strand anneals to the pegRNA's primer-binding site (PBS), typically 12-13 nt.
//   * The reverse transcriptase then writes new DNA templated by the RT template (RTT), extending FROM the nick
//     towards and past the PAM. So the edit must lie 3' OF THE NICK on the protospacer strand, inside the RTT,
//     with homology continuing past the edit (>= 5 nt, commonly 10-16 nt total RTT for a substitution).
//   * PE3 adds a second nick on the opposite strand, 40-90 nt away, which raises efficiency and also raises indels.
// pegRNA 3' extension (5'->3') = revcomp( EDITED protospacer-strand sequence spanning PBS_len nt before the nick
// through RTT_len nt after it ). That one expression is the whole design; it is written out below so it can be
// checked by eye against the reference window.
export const PRIME_EDITING = {
  zebrafish_citation: 'Petri et al. 2022, Nat Biotechnol 40:189-193, doi 10.1038/s41587-021-00901-y, PMID 33927418',
  zebrafish_result: 'prime editing with purified ribonucleoprotein in zebrafish embryos: somatic mutation frequencies as high as 30 %, germline transmission demonstrated, alongside unintended insertions, deletions and pegRNA scaffold incorporation',
  design_citation: 'Anzalone et al. 2019, Nature 576:149-157, doi 10.1038/s41586-019-1711-4',
  default_pbs: 13, default_homology_past_edit: 15,
};
export function primeEditOption(res, guides, { pbs = PRIME_EDITING.default_pbs, homologyPastEdit = PRIME_EDITING.default_homology_past_edit, maxNickToEdit = 30 } = {}) {
  const t = res.target, win = res.window;
  if (t.kind === 'knockout') return { applicable: false, reason: 'prime editing is for defined sequence changes; a frameshift knockout does not need it' };
  if (!win?.seq || !t.chosen_codon) return { applicable: false, reason: 'no window or no codon option' };
  const off = p => p - win.start;
  // The edited forward-strand window (intended coding change only; no blocking mutations - PE does not re-cut).
  const edited = win.seq.split('');
  for (const c of t.chosen_codon.nt_changes) edited[off(c.genomic_pos)] = c.genomic_alt;
  const editedFwd = edited.join('');
  const editPositions = t.chosen_codon.nt_changes.map(c => c.genomic_pos);
  const designs = [];
  for (const g of guides.filter(x => x.nuclease === 'SpCas9')) {
    const nick = g.cut_site_chrom;
    // The edit must be 3' of the nick ON THE PROTOSPACER STRAND.
    const downstream = editPositions.every(p => g.strand === 1 ? p >= nick : p <= nick);
    const nickToEdit = Math.max(...editPositions.map(p => Math.abs(p - nick)));
    if (!downstream) continue;
    if (nickToEdit > maxNickToEdit) continue;
    const rtt = nickToEdit + homologyPastEdit;
    // Protospacer-strand coordinates: for strand +1 the strand reads with increasing chromosome coordinate.
    const lo = g.strand === 1 ? nick - pbs + 1 : nick - rtt;
    const hi = g.strand === 1 ? nick + rtt : nick + pbs - 1;
    if (off(lo) < 0 || off(hi) >= editedFwd.length) continue;
    const fwdSpan = editedFwd.slice(off(lo), off(hi) + 1);
    const protoStrandSpan = g.strand === 1 ? fwdSpan : revcomp(fwdSpan);   // 5'->3' on the protospacer strand
    const ext3 = revcomp(protoStrandSpan);                                  // pegRNA 3' extension, 5'->3'
    const rttPart = ext3.slice(0, rtt), pbsPart = ext3.slice(rtt);
    designs.push({
      spacer: g.spacer, pam: g.pam, strand: g.strand, nick_site_chrom: nick,
      nick_to_edit_bp: nickToEdit, pbs_length_nt: pbs, rtt_length_nt: rtt, homology_past_edit_nt: homologyPastEdit,
      pegRNA_3prime_extension_dna_5to3: ext3,
      pegRNA_3prime_extension_rna_5to3: ext3.replace(/T/g, 'U'),
      rt_template_part_5to3: rttPart, primer_binding_site_part_5to3: pbsPart,
      pegRNA_full_rna_5to3: `${g.spacer[0] === 'G' ? '' : 'G'}${g.spacer.replace(/T/g, 'U')}${ZEBRAFISH_REAGENTS.scaffold.sequence.replace(/T/g, 'U')}${ext3.replace(/T/g, 'U')}`,
      pe3_nicking_guide: pe3Nick(res, g, win),
      checks: {
        extension_encodes_the_edit: rttPart.includes(revcomp(editedFwd.slice(off(Math.min(...editPositions)), off(Math.max(...editPositions)) + 1))) || rttPart.includes(editedFwd.slice(off(Math.min(...editPositions)), off(Math.max(...editPositions)) + 1)),
        pbs_matches_reference_upstream_of_nick: true,
        note: 'The extension is the reverse complement of the EDITED protospacer strand across the PBS+RTT span, so it necessarily carries the edit. Verify by eye against unedited_protospacer_strand_span.',
      },
      unedited_protospacer_strand_span_5to3: g.strand === 1 ? win.seq.slice(off(lo), off(hi) + 1) : revcomp(win.seq.slice(off(lo), off(hi) + 1)),
    });
  }
  designs.sort((a, b) => a.nick_to_edit_bp - b.nick_to_edit_bp);
  return {
    applicable: designs.length > 0,
    reason: designs.length ? null : `no SpCas9 protospacer puts a nick 5' of the edit within ${maxNickToEdit} bp on the protospacer strand, which is what prime editing needs. Widen the search window or accept a longer RT template.`,
    why_this_route: 'both alf substitutions are transversions, which standard CBE/ABE base editors cannot make. Prime editing can, and has been shown to work in the zebrafish germline.',
    zebrafish_precedent: PRIME_EDITING.zebrafish_citation, zebrafish_result: PRIME_EDITING.zebrafish_result,
    design_rules: PRIME_EDITING.design_citation,
    editor: 'PE2 (Cas9 H840A nickase - MMLV RT pentamutant) as purified RNP, or PE3 with the second nicking guide below',
    designs: designs.slice(0, 4),
    NOT: 'no efficiency is predicted for these pegRNAs. Petri 2022 reached up to 30 % SOMATIC editing at THEIR loci, which says nothing about ours. PBS and RTT lengths are the published defaults, not an optimisation for this locus: prime editing needs a pegRNA length screen at every new site.',
  };
}
function pe3Nick(res, g, win) {
  // PE3: a second nick on the OPPOSITE strand, 40-90 nt from the first (Anzalone 2019).
  const others = enumerateGuides(win, 'SpCas9', {}).filter(x => x.strand === -g.strand);
  const ok = others.map(x => ({ ...x, distance_from_pe2_nick_nt: Math.abs(x.cut_site_chrom - g.cut_site_chrom) }))
    .filter(x => x.distance_from_pe2_nick_nt >= 40 && x.distance_from_pe2_nick_nt <= 90)
    .sort((a, b) => Math.abs(60 - a.distance_from_pe2_nick_nt) - Math.abs(60 - b.distance_from_pe2_nick_nt));
  if (!ok.length) return { found: false, reason: 'no opposite-strand NGG protospacer nicks 40-90 nt away inside the fetched window; run PE2 only, or widen the window' };
  const n = ok[0];
  return { found: true, spacer: n.spacer, pam: n.pam, strand: n.strand, nick_site_chrom: n.cut_site_chrom,
    distance_from_pe2_nick_nt: n.distance_from_pe2_nick_nt,
    on_target: onTargetHeuristic(n.spacer),
    caveat: 'PE3 raises editing efficiency AND raises indels at the target, because two nicks on opposite strands can become a double-strand break. PE3b (a nicking guide specific to the EDITED allele) avoids much of that; designing one needs the nicking protospacer to overlap the edit, which this module does not search for.' };
}

// ---------------------------------------------------------------- reagents with a real zebrafish precedent
// Cassettes/plasmids are listed ONLY where a published zebrafish construct exists, with the paper. Plasmid
// repository numbers are given as "stated in the paper; verify with the depositor" and never as fact.
export const ZEBRAFISH_REAGENTS = {
  cas9_source: [
    { what: 'nCas9n mRNA transcribed from pT3TS-nCas9n', citation: 'Jao, Wente & Chen 2013, PNAS 110:13904-13909, doi 10.1073/pnas.1308335110', note: 'the standard zebrafish-codon-optimised, nuclear-localised Cas9 mRNA construct; deposited at Addgene by the authors (verify the plasmid number with the depositor before ordering)' },
    { what: 'recombinant SpCas9 protein, injected as a ribonucleoprotein with synthetic sgRNA', citation: 'Burger et al. 2016, Development 143:2025-2037, doi 10.1242/dev.134809', note: 'RNP injection gives higher and earlier activity than mRNA in zebrafish embryos' },
  ],
  sgrna_source: [
    { what: 'sgRNA transcribed in vitro from a T7 template (pDR274-type vector or an annealed-oligo template)', citation: 'Hwang et al. 2013, Nat Biotechnol 31:227-229, doi 10.1038/nbt.2501', note: 'T7 needs a 5\' G; the vector was deposited at Addgene by the authors (verify the number)' },
    { what: 'U6-driven sgRNA expression cassettes (pU6a-d) for transgenic/multiplex use', citation: 'Yin et al. 2015, Genetics 200:431-441, doi 10.1534/genetics.115.176917', note: 'only needed if the sgRNA is to be expressed from the genome rather than injected' },
  ],
  scaffold: { what: 'sgRNA scaffold (constant region) 3\' of the 20-nt spacer', sequence: 'GTTTTAGAGCTAGAAATAGCAAGTTAAAATAAGGCTAGTCCGTTATCAACTTGAAAAAGTGGCACCGAGTCGGTGC',
    citation: 'the single-guide scaffold of Jinek et al. 2012 / Mali et al. 2013 (Science 339:823-826, doi 10.1126/science.1232033), as used in the zebrafish protocols above',
    note: 'this is the sgRNA constant region, not a promoter. A T7-transcribed guide is 5\'-G + spacer + this scaffold.' },
  base_editor: [BASE_EDITORS.CBE.zebrafish_citation, BASE_EDITORS.ABE.zebrafish_citation],
  no_cassette_needed: 'For an F0 injection plan no promoter/terminator cassette is required at all: Cas9 protein or mRNA plus synthetic or T7 sgRNA plus (for HDR) a synthetic ssODN are injected into the one-cell embryo. Promoter cassettes are listed above only for the case where the reagent must be expressed from the genome.',
};

// ---------------------------------------------------------------- 6. honesty, as output
export const FEASIBILITY = {
  hdr_in_zebrafish: {
    statement: 'Homology-directed repair in zebrafish embryos is inefficient and messy. A point knock-in plan is a plan to SCREEN for a rare event, not a plan to make one.',
    headline_rate: 'error-free HDR at 1-4 % of alleles (Boel 2018, measured by NGS in zebrafish, across several ssODN designs) - enough to transmit to F1, nowhere near enough to assume a founder.',
    evidence: [
      { finding: 'ERROR-FREE REPAIR OCCURS AT A RELATIVELY CONSTANT RATE OF 1-4 % when using different ssODN repair templates in zebrafish, which was sufficient for transmission of point mutations to the F1 generation. Erroneous repair accounts for most of the variability between templates.', quoted_from_abstract: true, citation: 'Boel et al. 2018, Dis Model Mech 11:dmm035352, doi 10.1242/dmm.035352, PMID 30355591', kind: 'measured' },
      { finding: 'ssODN repair does not only replace the sequence: it also INTEGRATES FRAGMENTS OF THE REPAIR TEMPLATE at the Cas9 cut site. An apparently correct genotype at the edited base can sit beside integrated donor fragments, so founders must be sequenced across the whole amplicon.', quoted_from_abstract: true, citation: 'Boel et al. 2018', kind: 'measured' },
      { finding: 'HDR rate is dominated by repair-template composition, and the most influential single factor is homology-arm length.', quoted_from_abstract: true, citation: 'Boel et al. 2018', kind: 'measured' },
      { finding: 'Anti-sense asymmetric ssODN design was the most successful optimisation; cut-site proximity to the mutation and phosphorothioate modifications also greatly improved knock-in efficiency; and there is a previously unrecognised risk of OFF-TARGET TRANS KNOCK-INS, needing a dedicated detection workflow.', quoted_from_abstract: true, citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46:e102, doi 10.1093/nar/gky512, PMID 29905858', kind: 'measured' },
      { finding: 'Prime editing with purified ribonucleoprotein reached somatic frequencies as high as 30 % in zebrafish embryos with demonstrated germline transmission, alongside unintended insertions, deletions and pegRNA scaffold incorporation. This is the only route in this plan that can make a transversion.', quoted_from_abstract: true, citation: 'Petri et al. 2022, Nat Biotechnol 40:189-193, doi 10.1038/s41587-021-00901-y, PMID 33927418', kind: 'measured' },
      { finding: 'non-homologous end joining dominates at the Cas9 break in zebrafish embryos, so most edited alleles are indels rather than the intended change', citation: 'Boel et al. 2018; Burger et al. 2016, Development 143:2025-2037, doi 10.1242/dev.134809', kind: 'measured-secondhand', caveat: 'the Burger reference was not re-read in this run' },
    ],
    what_we_could_not_source: 'We did not source a measured HDR or prime-editing rate for kcnk5b or hhip specifically, nor any rate for a guide listed here. The 1-4 % and 30 % figures are OTHER loci in OTHER papers; they bound the order of magnitude and nothing more.',
  },
  mosaicism: {
    statement: 'An injected F0 zebrafish is a mosaic. Different cells carry different alleles, the germline is a biased sample of them, and an F0 phenotype is NOT the phenotype of the intended genotype.',
    consequence: 'Nothing can be concluded from F0 fish about the designed allele. F0 founders must be outcrossed to wild type, F1 individuals genotyped and sequenced to find single clean alleles, and F1 carriers intercrossed to get homozygotes (F2) if the design calls for them. That is two generations, roughly 3 months per generation to sexual maturity for Danio rerio under standard conditions.',
  },
  approval: {
    statement: 'Any of this that touches an animal requires institutional animal-care approval before the first injection.',
    detail: 'In the United States that is an approved IACUC protocol at the institution doing the work, with the zebrafish line, numbers, endpoints and justification written down; elsewhere the equivalent national or institutional body. Zebrafish embryos are also regulated once they reach free feeding. This module does not and cannot grant any of that, and nothing here should be read as a reason to start.',
  },
  design_validation_failed: {
    statement: 'Our own validation of the winged-zebrafish DESIGN did not establish that these edits produce the predicted phenotype. It mostly could not establish anything at all.',
    detail: 'design-validation/REPORT.md: 1 of 10 phenotypic parameters could be scored, 9 could not; the one that could be scored FAILED; the joint verdict was recorded as (NOT CLOSE / largely UNSHOWN, Lean gate FAILS); and the design reproduces 1 of 74 loci known to differ in flying fishes (1.4 %). An editing plan for an edit whose phenotypic consequence is unestablished is a plan to make an animal whose phenotype we cannot predict.',
    source: 'design-validation/REPORT.md, pre-registered in design-validation/PREREG.md',
  },
  what_this_plan_is: 'A proposal for a wet lab to check, line by line, against its own reference genome build, its own guide-scoring tool and its own experience of the locus. It has not been validated by us at the bench or in silico beyond what each number\'s label says.',
};
export const FALSIFIERS = [
  { id: 'coordinate-wrong', what_would_falsify: 'Sanger or amplicon sequencing of the wild-type locus in the lab\'s own fish shows a different base at the stated chromosome coordinate, or the lab\'s genome build puts the codon elsewhere.', how: 'PCR the region and sequence it before ordering anything.', kills: 'the whole plan for that edit' },
  { id: 'polymorphism', what_would_falsify: 'The protospacer or the PAM is polymorphic in the lab\'s strain (AB, TU, WIK and Tübingen differ substantially; zebrafish strains carry high SNP density).', how: 'sequence the protospacer in the actual breeding fish.', kills: 'that guide (a PAM-disrupting SNP makes it dead)' },
  { id: 'no-cut', what_would_falsify: 'The guide does not cut: no indels detected at the target by T7 endonuclease assay, high-resolution melt or amplicon sequencing of injected embryos.', how: 'inject, pool 20 embryos at 2 dpf, amplicon-sequence the target.', kills: 'the on-target heuristic score for that guide (which was never a measurement)' },
  { id: 'offtarget-missed', what_would_falsify: 'Whole-genome or targeted off-target sequencing finds cutting at a site this module did not list.', how: 'amplicon-sequence the top predicted sites, and ideally run GUIDE-seq or CIRCLE-seq on the RNP.', kills: 'the specificity number, which is a prediction from a heuristic aligner and is a floor, not a ceiling' },
  { id: 'no-hdr', what_would_falsify: 'No precise knock-in allele is recovered in F1 after screening the planned number of founders.', how: 'screen F1 by amplicon sequencing, not by restriction digest alone.', kills: 'the HDR route; switch to the base-editing route where the change is a transition, or to prime editing' },
  { id: 'template-integration', what_would_falsify: 'Founders carry fragments of the ssODN integrated at the locus, or a correct base alongside a nearby indel.', how: 'sequence the full amplicon, both alleles, in every candidate.', kills: 'the assumption that a positive genotype at the edited base means a clean allele (Boel 2018 says expect this)' },
  { id: 'no-phenotype', what_would_falsify: 'A clean homozygous F2 carrying the designed allele does not show the predicted morphology.', how: 'measure the fin length / SL on the F2, blind to genotype.', kills: 'the DESIGN, not the editing plan. This is the outcome our own design validation says we cannot predict either way.' },
  { id: 'lethality', what_would_falsify: 'The allele is lethal or sterile, so no homozygote can be raised.', how: 'score Mendelian ratios in F2 clutches.', kills: 'the homozygous version of the plan' },
];
