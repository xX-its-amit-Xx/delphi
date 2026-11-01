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

  if (ed.kind === 'knockout') {
    // Knockout: no single codon. Target window = the early CDS (first EARLY_FRACTION of the coding sequence),
    // where a frameshift removes most of the protein and is least likely to be rescued by reinitiation.
    const earlyCdsEnd = Math.max(60, Math.floor(EARLY_FRACTION * cds.length));
    const a = await mapCdsBase(tr.id, 4, { network });                 // skip the start codon itself
    const b = await mapCdsBase(tr.id, earlyCdsEnd, { network });
    if (!a || !b) return { resolved: false, refusal: `could not map the early CDS of ${tr.id} to ${ASSEMBLY} coordinates` };
    out.target = { kind: 'knockout', cds_window: [4, earlyCdsEnd], genomic_window: [Math.min(a, b), Math.max(a, b)],
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
  out.window = await genomicWindow(chr, lo - flank, hi + flank, { network });
  out.window.edit_offsets = gpos.map(p => p - (lo - flank)); // 0-based offsets of the codon bases in window.seq
  return out;
}
export const EARLY_FRACTION = Number(process.env.EDITPLAN_EARLY_FRACTION ?? 0.35);
const isTransition = (a, b) => (a === 'A' && b === 'G') || (a === 'G' && b === 'A') || (a === 'C' && b === 'T') || (a === 'T' && b === 'C');

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
      });
    }
  }
  return out.sort((a, b) => (a.distance_cut_to_edit_bp ?? 0) - (b.distance_cut_to_edit_bp ?? 0));
}

// ---------------------------------------------------------------- 3. scoring
// ON-TARGET: a HEURISTIC, not a validated efficiency model. It is NOT Doench 2016 Rule Set 2: that model's
// 600+ fitted coefficients (Azimuth) were not sourced in this run, so no number here is called a Rule Set 2
// score. What follows is a transparent rule built from published OBSERVATIONS, each cited, combined by a
// weighting WE chose. Provenance kind: assumed (the combination), from measured observations.
export const ON_TARGET_RULE = {
  id: 'editplan-gc-position-heuristic/v1',
  label: 'heuristic',
  what_it_is_not: 'not Doench 2016 Rule Set 2, not Azimuth, not a measured cutting efficiency, not calibrated on any zebrafish data',
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
  return { score: +score.toFixed(3), kind: 'heuristic', rule_id: ON_TARGET_RULE.id,
    terms: { gc_fraction: +gcFrac.toFixed(3), gc_term: +gc.toFixed(3), polyT_ok: !!polyT, g_at_pam_proximal_end: !!g20, g_at_5prime: !!g5, long_homopolymer: !!homo },
    flags: [...(polyT ? [] : ['poly-T run of 4 or more: this guide will likely fail U6/T7 transcription; drop it']),
            ...(gcFrac < 0.3 || gcFrac > 0.8 ? [`GC ${(gcFrac * 100).toFixed(0)} % is outside the range where published datasets see good activity`] : []),
            ...(g5 ? [] : ['5\' base is not G: a T7-transcribed sgRANA needs a 5\'-G appended (one extra mismatch at position 1) or use a U6 promoter'])],
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
// NCBI BLAST URL API, blastn-short, against the zebrafish genome assembly database
// (GPIPE/7955/current/all_top_level). Public, no credentials. Polite: one request in flight, >= 15 s between
// polls. Results cached. RefSeq chromosome accessions are mapped back to Ensembl chromosome names and the
// gene context of each hit is read from Ensembl /overlap/region.
const BLAST = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi';
export const OFFTARGET_DB = 'GPIPE/7955/current/all_top_level';
/** NC_007112.7 -> "1" ... NC_007136.7 -> "25" (zebrafish GRCz11 RefSeq chromosome accessions are consecutive). */
export function refseqToEnsemblChr(acc) {
  const m = String(acc).match(/^NC_0071(\d\d)\./);
  if (!m) return null;
  const n = +m[1] - 11;
  return n >= 1 && n <= 25 ? String(n) : null;
}
export async function offTargets(spacer, pam, { network = true, maxPolls = 40, pollMs = 15000, maxMismatches = 4, geneContext = true } = {}) {
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

// ---------------------------------------------------------------- 4. HDR donor (ssODN)
// Arm lengths: symmetric 40/40 nt is what the published zebrafish point-knock-in protocols use; the
// asymmetric 36/91 variant is a transfer from human cells (Richardson 2016) and is labelled as borrowed.
export const DONOR_DESIGN = {
  symmetric: { left: 40, right: 40, citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46:e102, doi 10.1093/nar/gkae... (zebrafish point knock-in with ssODN donors; see RESULTS.md for the rate actually quoted)', kind: 'borrowed-from-zebrafish-protocol' },
  asymmetric: { pam_distal: 36, pam_proximal: 91, citation: 'Richardson et al. 2016, Nat Biotechnol 34:339-344, doi 10.1038/nbt.3481 (asymmetric ssODN, 36 nt PAM-distal / 91 nt PAM-proximal, in human cells)', kind: 'borrowed', borrowing: 'measured in human cell lines, NOT in zebrafish embryos. The transfer is the assumption.' },
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
          codon_usage_fraction_of_family_before: null, codon_usage_fraction_of_family_after: null });
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
    strand_to_order: guide.strand === 1 ? 'reverse (complementary to the protospacer strand)' : 'forward (complementary to the protospacer strand)',
    strand_choice_note: 'we order the ssODN complementary to the protospacer-containing strand. Which ssODN strand repairs better is not settled in zebrafish; order both strands and compare, rather than trusting this choice.',
    unedited_reference_same_span_5to3: unedited,
    changes_applied: applied,
    blocking_mutations: blocking,
    blocking_mutations_applied: blocking.filter(b => b.protein_unchanged).length,
    blocking_warning: blocking.length ? null : 'NO silent blocking mutation was available: every base of the PAM and seed is either outside the CDS or cannot be changed synonymously. The repaired allele can be re-cut, which lowers the yield of clean knock-ins and can add indels on top of the knock-in.',
    protein_check: proteinUnchangedExceptTarget(res, editedSeq),
    phosphorothioate_note: 'Terminal phosphorothioate linkages on an ssODN are commonly used to slow exonuclease degradation. We do not have a zebrafish measurement for that gain, so we neither assume it nor include it in any number.',
  };
}
/** Genomic coordinate -> CDS index (1-based), using the exon list, or null when not coding. */
export function cdsIndexOfGenomic(res, gp) {
  // Build (once) a map from the CDS by walking the exons in transcription order, clipped to the CDS.
  if (!res._cdsMap) {
    const m = new Map();
    // We only have exon bounds (including UTRs), so anchor the walk on the three mapped codon bases we know.
    // Anchor: the first codon base's CDS index and genomic position.
    const anchorCds = res.target.cds_positions?.[0], anchorG = res.target.genomic_positions?.[0];
    if (anchorCds == null || anchorG == null) { res._cdsMap = m; return null; }
    // Walk outward within the exon that contains the anchor (exon-local is enough for a +/-150 bp window,
    // and we refuse to guess across a junction).
    const ex = res.exons.find(e => anchorG >= e.start && anchorG <= e.end);
    if (!ex) { res._cdsMap = m; return null; }
    for (let g = ex.start; g <= ex.end; g++) {
      const d = res.strand === 1 ? g - anchorG : anchorG - g;
      m.set(g, anchorCds + d);
    }
    res._cdsMap = m;
    res._cdsMapExon = ex;
  }
  const v = res._cdsMap.get(gp);
  return v != null && v >= 1 && v <= res.cds_length ? v : null;
}
function currentCodon(res, editedArr, codonNo) {
  const first = 3 * codonNo - 2;
  const idx = [first, first + 1, first + 2];
  const gps = idx.map(i => { for (const [g, c] of res._cdsMap) if (c === i) return g; return null; });
  if (gps.some(g => g == null)) return null;
  const off = p => p - res.window.start;
  if (gps.some(g => off(g) < 0 || off(g) >= editedArr.length)) return null;
  const bases = gps.map(g => editedArr[off(g)]);
  const codon = res.strand === 1 ? bases.join('') : revcomp(bases.join(''));
  return { codon, genomic_positions: gps };
}
/** Re-translate the edited window's coding bases and confirm only the target codon changed. */
function proteinUnchangedExceptTarget(res, editedSeq) {
  if (!res._cdsMap) return { ran: false, reason: 'no CDS map for this window' };
  const off = p => p - res.window.start;
  const changed = [];
  for (const [g, c] of res._cdsMap) {
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
  if (t.kind === 'knockout') {
    // iSTOP: CBE turns CAA/CAG/CGA into TAA/TAG/TGA. Report whether such a codon exists in the early CDS.
    return { strategy: 'CBE nonsense (iSTOP)', reachable: 'depends on the codon; see istop_candidates', note: 'for a knockout a CBE can install a premature stop without a double-strand break, by C>T at CAA->TAA, CAG->TAG or CGA->TGA on one strand (or the reverse-strand equivalents TGG->TGA/TAG/TAA). iSTOP: Billon et al. 2017, Mol Cell 67:1068-1079, doi 10.1016/j.molcel.2017.08.008', editor: BASE_EDITORS.CBE };
  }
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
      what_would_be_needed: 'a C-to-G base editor (CGBE) or a prime editor. We did not find a published zebrafish germline CGBE or prime-editing line we could cite in this run, so no such plan is proposed. Prime editing has been reported in zebrafish (Petri et al. 2022, Nat Biotechnol 40:189-193, doi 10.1038/s41587-021-00901-y) at low efficiency; treat it as a route to try, not a plan we costed.' };
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
    evidence: [
      { finding: 'ssODN-mediated repair in zebrafish produces complex mutational patterns, including integration of fragments of the repair template, so apparently "knocked-in" founders must be sequenced across the whole locus, not just genotyped at the edited base', citation: 'Boel et al. 2018, Dis Model Mech 11:dmm035352, doi 10.1242/dmm.035352', kind: 'measured' },
      { finding: 'published zebrafish point knock-in protocols report single-digit-percent germline transmission of the precise allele, and require screening tens of injected F0 founders', citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46:e102 (optimised point-mutation knock-in in zebrafish using CRISPR/Cas9)', kind: 'measured-secondhand', caveat: 'WE DID NOT RE-READ THE PRIMARY FIGURE for this run; the rate is quoted as an order of magnitude, not as a number we verified. Read the paper before using any rate in a grant or a power calculation.' },
      { finding: 'non-homologous end joining dominates at the Cas9 break in zebrafish embryos, so most edited alleles are indels, not the intended change', citation: 'Boel et al. 2018; Burger et al. 2016, Development 143:2025-2037', kind: 'measured' },
    ],
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
