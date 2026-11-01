// closest_relative_genotype + genotype sanity + genotype annotations, for gene-level edits.
//
// THE HOUSE RULE (dashboard/public/blueprint3d/genotype.js): a residue is a STATE, not a phenotype. Everything here
// compares sequences and reads annotations. Nothing predicts a phenotype from a residue, and no genotype number is
// ever folded into a phenotype grade. The scorer (score.mjs) uses only SEQUENCE-LEVEL sanity (does the edit refer to
// the real reference residue, stay in frame, avoid an unintended stop) - never "this residue makes longer fins".
//
// Where an edit comes from: an organism document's gene edits (target.level 'gene', param 'allele', value an HGVS-like
// string such as 'p.W169L', 'p.Y285*', 'c.505del', 'p.T200K/+'; param 'knockout' true = gene absent; param
// 'expression_fold' = regulatory), plus an optional doc.genotype [{gene, change, zygosity, note}] for genes outside
// genotype/map.vetted.slim.json (organism_edit rejects those symbols; e.g. hhip, gja1b), which this module accepts.
//
// Sequences: sequences/alignments/<gene>.json first (MAFFT, Ensembl 116 + flying fish + gliders + controls; birds were
// never fetched). Otherwise NCBI BLAST REST (blastp vs nr, entrez_query 'NOT Aves[Organism]', polite: one request in
// flight, >= 10 s between polls, results cached in validate/cache/) on the zebrafish protein from Ensembl REST.
// CDS for nucleotide edits: Ensembl REST /sequence/id/<protein>?type=cds (cached). Domains: UniProt REST features for
// the Danio rerio entry (cached), mapped only when the UniProt length equals the alignment's zebrafish protein length.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AVES_RE } from './phenotype.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const CACHE_DIR = process.env.VALIDATE_CACHE_DIR ? path.resolve(process.env.VALIDATE_CACHE_DIR) : path.join(import.meta.dirname, 'cache');
const rd = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
export const ALIASES = { lat4a: 'slc43a2a', cx43: 'gja1b', longfin: 'kcnh2a', alf: 'kcnk5b' };
export const canon = g => ALIASES[String(g).toLowerCase()] || String(g);
export const STATE_NOT_PHENOTYPE = 'A residue is a STATE, not a phenotype (dashboard/public/blueprint3d/genotype.js). These results compare sequences only; nothing here predicts a phenotype from a residue change, and none of it is combined with a phenotype grade.';

const AA3 = { Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C', Gln: 'Q', Glu: 'E', Gly: 'G', His: 'H', Ile: 'I', Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P', Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V', Ter: '*' };
const CODON = (() => { const b = 'TCAG', aa = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'; const m = {}; let i = 0; for (const x of b) for (const y of b) for (const z of b) m[x + y + z] = aa[i++]; return m; })();
export const translate = cds => { let p = ''; for (let i = 0; i + 3 <= cds.length; i += 3) p += CODON[cds.slice(i, i + 3).toUpperCase()] || 'X'; return p; };

// ---------------------------------------------------------------- parsing
/** Parse one change string. Returns {kind, ref, pos, alt, ...} or {kind:'unparsed'}. */
export function parseChange(s) {
  const raw = String(s || '').trim();
  const zyg = /\/\+|het/i.test(raw) ? 'heterozygous' : /hom|\/\s*p\./i.test(raw) ? 'homozygous' : null;
  const t = raw.replace(/\/\+$/, '').replace(/\s*\((het|hom)[a-z]*\)/i, '');
  let m = t.match(/^p\.\(?([A-Z][a-z]{2}|[A-Z*])(\d+)([A-Z][a-z]{2}|[A-Z*]|fs\*?\d*|del|=)\)?/);
  if (m) {
    const ref = AA3[m[1]] || m[1], pos = +m[2]; let alt = AA3[m[3]] || m[3];
    if (/^fs/.test(alt)) return { kind: 'frameshift', ref, pos, alt: 'fs', zygosity: zyg, raw };
    if (alt === 'del') return { kind: 'aa_deletion', ref, pos, alt: '-', zygosity: zyg, raw };
    if (alt === '=') return { kind: 'synonymous', ref, pos, alt: ref, zygosity: zyg, raw };
    return { kind: alt === '*' ? 'nonsense' : 'missense', ref, pos, alt, zygosity: zyg, raw };
  }
  m = t.match(/^c\.(\d+)([ACGT])>([ACGT])$/i);
  if (m) return { kind: 'nt_substitution', pos: +m[1], ref: m[2].toUpperCase(), alt: m[3].toUpperCase(), zygosity: zyg, raw };
  m = t.match(/^c\.(\d+)(?:_(\d+))?del([ACGT]*)$/i);
  if (m) return { kind: 'nt_deletion', pos: +m[1], end: m[2] ? +m[2] : +m[1], seq: m[3].toUpperCase(), zygosity: zyg, raw };
  m = t.match(/^c\.(\d+)_(\d+)ins([ACGT]+)$/i);
  if (m) return { kind: 'nt_insertion', pos: +m[1], seq: m[3].toUpperCase(), zygosity: zyg, raw };
  if (/invers|regulat|enhancer|promoter|cis-|insertion of|transgen/i.test(t)) return { kind: 'regulatory', raw, zygosity: zyg };
  return { kind: 'unparsed', raw, zygosity: zyg };
}

/** Gene edits of a document (doc.edits at level 'gene' and doc.genotype). */
export function geneEdits(doc) {
  const out = [];
  (doc.edits || []).forEach((e, i) => {
    if (e.target?.level !== 'gene') return;
    const gene = canon(e.target.id);
    if (e.param === 'allele') out.push({ gene, symbol: e.target.id, source: `edit #${i}`, ...parseChange(e.value), reason: e.reason });
    else if (e.param === 'knockout') out.push({ gene, symbol: e.target.id, source: `edit #${i}`, kind: e.value ? 'knockout' : 'restore', raw: `knockout=${e.value}`, reason: e.reason });
    else if (e.param === 'expression_fold') out.push({ gene, symbol: e.target.id, source: `edit #${i}`, kind: 'expression', fold: e.value, raw: `expression x${e.value}`, reason: e.reason });
  });
  (doc.genotype || []).forEach((g, i) => {
    const p = g.knockout ? { kind: 'knockout', raw: 'knockout' } : parseChange(g.change);
    out.push({ gene: canon(g.gene), symbol: g.gene, source: `genotype #${i}`, ...p, zygosity: g.zygosity || p.zygosity || null, note: g.note || null, nt_changes: g.nt_changes ?? null });
  });
  return out;
}

// ---------------------------------------------------------------- cached network
function cacheKey(o) { return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 32); }
export function cacheGet(o) { const f = path.join(CACHE_DIR, `${cacheKey(o)}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
function cachePut(o, v) { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(path.join(CACHE_DIR, `${cacheKey(o)}.json`), JSON.stringify({ request: o, fetched: new Date().toISOString(), value: v })); return v; }
const UA = { 'User-Agent': 'delphisci-sim-engine-validate/0.1 (research; no credentials)' };
async function fetchCached(req, { network = true, parse = 'json' } = {}) {
  const c = cacheGet(req); if (c) return { ...c, cached: true };
  if (!network) return { value: null, error: 'not cached and network disabled' };
  try {
    const r = await fetch(req.url, { method: req.method || 'GET', headers: { ...UA, ...(req.headers || {}) }, body: req.body });
    if (!r.ok) return { value: null, error: `HTTP ${r.status}` };
    const v = parse === 'json' ? await r.json() : await r.text();
    cachePut(req, v);
    return { request: req, value: v, cached: false };
  } catch (e) { return { value: null, error: e.message }; }
}

// ---------------------------------------------------------------- alignment-based comparison
const _aln = {};
export function alignmentFor(gene) {
  if (gene in _aln) return _aln[gene];
  const f = path.join(ROOT, 'sequences', 'alignments', `${gene}.json`);
  return (_aln[gene] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
}
const rowLabel = (a, k) => { const s = a.sequences[k] || {}; return { key: k, species: s.species || k, common: s.common || null, role: s.role || null }; };
function identity(x, y) { let same = 0, n = 0; for (let i = 0; i < x.length; i++) { const a = x[i], b = y[i]; if (a === '-' || b === '-' || a === 'X' || b === 'X') continue; n++; if (a === b) same++; } return n ? { pct: (100 * same) / n, aligned_pairs: n } : null; }

function knownAlleles(gene, ch) {
  const out = [];
  const a = alignmentFor(gene);
  for (const v of a?.variants || []) if (v.coord_species === 'danio_rerio' && v.pos === ch.pos && v.alt === ch.alt && v.ref === ch.ref) out.push({ id: v.id, what: v.what, source: v.source });
  const iv = rd('genotype/interventions.json').interventions;
  const tag = `${ch.ref}${ch.pos}${ch.alt === '*' ? '\\*' : ch.alt}`;
  for (const i of iv) if (String(i.gene).includes(gene) && new RegExp(`\\b${tag}`).test(`${i.lesion} ${i.id}`)) out.push({ id: i.id, what: String(i.lesion).slice(0, 200), source: 'genotype/interventions.json', evidence_grade: i.evidence_grade });
  return out;
}

/** Compare one protein-level edit against the gene's alignment. */
export function compareWithAlignment(gene, ch) {
  const a = alignmentFor(gene);
  if (!a) return { ran: false, reason: `no alignment in sequences/alignments for ${gene}` };
  const zrow = a.alignment.danio_rerio; if (!zrow) return { ran: false, reason: 'alignment has no danio_rerio row' };
  const zseq = zrow.replace(/-/g, '');
  if (!(ch.pos >= 1 && ch.pos <= zseq.length)) return { ran: true, reference_check: { ok: false, problem: `position ${ch.pos} outside the zebrafish protein (length ${zseq.length}, ${a.sequences.danio_rerio.protein_id})` } };
  let col = -1; for (let i = 0, r = 0; i < zrow.length; i++) if (zrow[i] !== '-' && ++r === ch.pos) { col = i; break; }
  const refHere = zrow[col];
  const refOk = refHere === ch.ref;
  const rows = Object.keys(a.alignment).filter(k => k !== 'danio_rerio');
  const aves = rows.filter(k => AVES_RE.test(`${k} ${a.sequences[k]?.species || ''} ${a.sequences[k]?.role || ''}`));
  const use = rows.filter(k => !aves.includes(k));
  let edited = zrow;
  if (['missense', 'nonsense', 'synonymous'].includes(ch.kind)) edited = zrow.slice(0, col) + (ch.alt === '*' ? '-' : ch.alt) + zrow.slice(col + 1);
  if (ch.kind === 'nonsense' || ch.kind === 'frameshift') edited = zrow.slice(0, col) + zrow.slice(col).replace(/[^-]/g, '-'); // protein truncated from here (frameshift: downstream not modelled)
  const ident = use.map(k => {
    const before = identity(zrow, a.alignment[k]), after = identity(edited, a.alignment[k]);
    return { ...rowLabel(a, k), residue_at_site: a.alignment[k][col], identity_before: before && +before.pct.toFixed(2), identity_after: after && +after.pct.toFixed(2), aligned_pairs_after: after?.aligned_pairs ?? 0 };
  }).filter(r => r.identity_after != null).sort((x, y) => y.identity_after - x.identity_after);
  // A partial row (Daane 2021 exon captures cover 30 % or more of the protein) can show a high identity over a short
  // stretch, so the closest species is chosen among rows aligned over >= 60 % of the zebrafish protein.
  const minPairs = Math.ceil(0.6 * edited.replace(/-/g, "").length);
  const full = ident.filter(r => r.aligned_pairs_after >= minPairs);
  const selfId = identity(edited, zrow);
  const colRes = use.map(k => a.alignment[k][col]).filter(c => c && c !== '-' && c !== 'X');
  const conservation = colRes.length ? colRes.filter(c => c === refHere).length / colRes.length : null;
  const carriers = ch.alt && ch.alt.length === 1 && ch.alt !== '*' ? use.filter(k => a.alignment[k][col] === ch.alt).map(k => rowLabel(a, k)) : [];
  return {
    ran: true, source: `sequences/alignments/${gene}.json (${a.aligner})`, zebrafish_protein: a.sequences.danio_rerio.protein_id, alignment_column_1based: col + 1,
    reference_check: { ok: refOk, reference_residue: refHere, claimed: ch.ref, ...(refOk ? {} : { problem: `the edit claims ${ch.ref}${ch.pos} but the zebrafish protein has ${refHere} at ${ch.pos}` }) },
    identity_to_unedited_zebrafish: selfId && +selfId.pct.toFixed(2), fraction_of_reference_protein_retained: +(edited.replace(/-/g, "").length / zseq.length).toFixed(4),
    closest_species: full[0] || null, closest_species_rule: `highest identity among rows aligned over >= 60 % of the zebrafish protein (>= ${minPairs} pairs); partial rows stay in identity_table`, identity_table: ident,
    site: { residues: Object.fromEntries(use.map(k => [a.sequences[k]?.species || k, a.alignment[k][col]])), conservation_vs_reference: conservation == null ? null : +conservation.toFixed(3), n_rows: colRes.length,
      conserved_flag: conservation != null && colRes.length >= 8 && conservation >= 0.9,
      conserved_rule: 'flag when >= 90 % of >= 8 non-zebrafish rows carry the zebrafish residue at this column (an alignment proxy for constraint; NOT a domain call)' },
    alt_state_in_real_organisms: { in_natural_orthologues: carriers, known_lab_or_natural_alleles: knownAlleles(gene, ch),
      exists: carriers.length > 0 || knownAlleles(gene, ch).length > 0 },
    aves_excluded: { rows_dropped: aves.length, note: 'sequences/ never fetched bird sequences (frozen holdout); the filter ran anyway' },
  };
}

// ---------------------------------------------------------------- UniProt domains (cached; optional)
export async function uniprotDomains(gene, { network = true } = {}) {
  const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(`gene_exact:${gene} AND organism_id:7955`)}&fields=accession,length,ft_domain,ft_transmem,ft_region,ft_motif&format=json&size=3`;
  const r = await fetchCached({ url }, { network });
  if (!r.value) return { ran: false, reason: r.error };
  const e = (r.value.results || [])[0];
  if (!e) return { ran: false, reason: `no UniProt Danio rerio entry with gene_exact:${gene}` };
  return { ran: true, accession: e.primaryAccession, length: e.sequence?.length, cached: r.cached, source: url,
    features: (e.features || []).map(f => ({ type: f.type, description: f.description || '', start: f.location?.start?.value, end: f.location?.end?.value })) };
}

// ---------------------------------------------------------------- CDS (Ensembl; cached) for nucleotide edits
export async function cdsFor(gene, { network = true } = {}) {
  const a = alignmentFor(gene); const pid = a?.sequences?.danio_rerio?.protein_id;
  if (!pid) return { ran: false, reason: 'no zebrafish protein id (no alignment for this gene)' };
  // type=cds needs the TRANSCRIPT id; the alignment stores the translation id, so look up its parent first.
  const lk = await fetchCached({ url: `https://rest.ensembl.org/lookup/id/${pid}?content-type=application/json` }, { network });
  const tid = lk.value?.Parent; if (!tid) return { ran: false, reason: lk.error || `no parent transcript for ${pid}` };
  const r = await fetchCached({ url: `https://rest.ensembl.org/sequence/id/${tid}?type=cds;content-type=application/json` }, { network });
  if (!r.value?.seq) return { ran: false, reason: r.error || 'no CDS returned' };
  const prot = a.alignment.danio_rerio.replace(/-/g, '');
  const tr = translate(r.value.seq).replace(/\*$/, '');
  if (tr !== prot) return { ran: false, reason: `CDS of ${tid} does not translate to the aligned protein ${pid} (${tr.length} vs ${prot.length} aa)` };
  return { ran: true, protein_id: pid, transcript_id: tid, cds: r.value.seq, cached: r.cached };
}
export function applyNt(cds, ch) {
  const i = ch.pos - 1;
  if (!(ch.pos >= 1 && ch.pos <= cds.length)) return { ok: false, problem: `c.${ch.pos} is outside the CDS (length ${cds.length})` };
  if (ch.kind === 'nt_substitution') { if (cds[i] !== ch.ref) return { ok: false, problem: `c.${ch.pos} is ${cds[i]} in the CDS, not ${ch.ref}` }; return { ok: true, seq: cds.slice(0, i) + ch.alt + cds.slice(i + 1) }; }
  if (ch.kind === 'nt_deletion') { const len = ch.end - ch.pos + 1; if (ch.seq && cds.slice(i, i + len) !== ch.seq) return { ok: false, problem: `c.${ch.pos}_${ch.end} is ${cds.slice(i, i + len)}, not ${ch.seq}` }; return { ok: true, seq: cds.slice(0, i) + cds.slice(i + len) }; }
  if (ch.kind === 'nt_insertion') return { ok: true, seq: cds.slice(0, i + 1) + ch.seq + cds.slice(i + 1) };
  return { ok: false, problem: 'not a nucleotide edit' };
}

// ---------------------------------------------------------------- BLAST (NCBI REST; polite; cached)
export async function blastProtein(seq, { network = true, maxPolls = 40, pollMs = 15000, hitlist = 50 } = {}) {
  const key = { blast: 'blastp-nr', seq, hitlist, entrez: 'NOT Aves[Organism]' };
  const c = cacheGet(key); if (c) return { ...c.value, cached: true };
  if (!network) return { ran: false, reason: 'BLAST not cached and network disabled' };
  const base = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi';
  const put = await fetch(base, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ CMD: 'Put', PROGRAM: 'blastp', DATABASE: 'nr', QUERY: seq, HITLIST_SIZE: String(hitlist), ENTREZ_QUERY: 'NOT Aves[Organism]', TOOL: 'delphisci-validate' }) }).then(r => r.text());
  const rid = (put.match(/RID = (\S+)/) || [])[1];
  if (!rid) return { ran: false, reason: 'BLAST Put returned no RID' };
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, pollMs));
    const st = await fetch(`${base}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`, { headers: UA }).then(r => r.text());
    if (/Status=WAITING/.test(st)) continue;
    if (!/Status=READY/.test(st)) return { ran: false, reason: `BLAST status not READY (${(st.match(/Status=\w+/) || ['?'])[0]})`, rid };
    const js = await fetch(`${base}?CMD=Get&FORMAT_TYPE=JSON2_S&RID=${rid}`, { headers: UA }).then(r => r.json());
    const hits = (js.BlastOutput2?.[0]?.report?.results?.search?.hits || []).map(h => ({ title: h.description?.[0]?.title, sciname: h.description?.[0]?.sciname, taxid: h.description?.[0]?.taxid, accession: h.description?.[0]?.accession,
      identity_pct: h.hsps?.[0] ? +(100 * h.hsps[0].identity / h.hsps[0].align_len).toFixed(2) : null, query_from: h.hsps?.[0]?.query_from, qseq: h.hsps?.[0]?.qseq, hseq: h.hsps?.[0]?.hseq }));
    const kept = hits.filter(h => !AVES_RE.test(`${h.title} ${h.sciname}`));
    const v = { ran: true, rid, database: 'nr', entrez_query: 'NOT Aves[Organism]', hits: kept, aves_post_filtered: hits.length - kept.length };
    cachePut(key, v); return { ...v, cached: false };
  }
  return { ran: false, reason: 'BLAST timed out', rid };
}
/** Residue in each BLAST hit at query position pos (1-based), from the HSP alignment strings. */
export function residueInHits(hits, pos) {
  return hits.map(h => {
    if (!h.qseq || !(pos >= h.query_from)) return { ...h, residue: null };
    let q = h.query_from - 1;
    for (let i = 0; i < h.qseq.length; i++) { if (h.qseq[i] !== '-') q++; if (q === pos && h.qseq[i] !== '-') return { sciname: h.sciname, accession: h.accession, identity_pct: h.identity_pct, residue: h.hseq[i] }; }
    return { sciname: h.sciname, accession: h.accession, identity_pct: h.identity_pct, residue: null };
  });
}
export async function zebrafishProtein(gene, { network = true } = {}) {
  const r = await fetchCached({ url: `https://rest.ensembl.org/lookup/symbol/danio_rerio/${encodeURIComponent(gene)}?expand=1;content-type=application/json` }, { network });
  const tr = r.value?.Transcript?.find(t => t.is_canonical) || r.value?.Transcript?.[0];
  const pid = tr?.Translation?.id; if (!pid) return { ran: false, reason: r.error || 'no canonical translation' };
  const s = await fetchCached({ url: `https://rest.ensembl.org/sequence/id/${pid}?type=protein;content-type=application/json` }, { network });
  return s.value?.seq ? { ran: true, protein_id: pid, seq: s.value.seq } : { ran: false, reason: s.error || 'no protein sequence' };
}

// ---------------------------------------------------------------- annotations from genotype/
let _ann = null;
function annSources() {
  if (_ann) return _ann;
  const cc = rd('genotype/causal-chains.json'), iv = rd('genotype/interventions.json'), sl = rd('genotype/sequence-layer.json'), pw = rd('genotype/pathways.slim.json');
  const mp = rd('genotype/map.vetted.slim.json');
  return (_ann = { cc, iv, sl, pw, mp });
}
export function annotations(gene) {
  const { cc, iv, sl, pw, mp } = annSources();
  const chain = cc.genes.find(g => g.symbol === gene);
  const cross = (cc.cross_gene || []).filter(x => String(x.claim).includes(gene)).map(x => ({ claim: x.claim, evidence_grade: x.evidence_grade }));
  const ivs = iv.interventions.filter(i => String(i.gene).split(/[^a-z0-9]+/i).includes(gene));
  const zfin = chain?.zfin_id || ivs.find(i => i.zfin_id)?.zfin_id || null;
  const pws = zfin ? (pw.genes[`ZF:${zfin}`] || []) : [];
  const pwNames = [...new Set(pws.map(x => x[0]))].map(id => ({ id, name: pw.pathways[id]?.name || null, source: pw.pathways[id]?.source || null }));
  const finPw = Object.entries(pw.fin_pathways || {}).filter(([, gs]) => (Array.isArray(gs) ? gs : []).some(g => String(g).includes(gene))).map(([id]) => ({ id, name: pw.pathways[id]?.name || null }));
  const orth = [...(sl.orthologues_resolved || []), ...(sl.orthologues_not_resolved || [])].find(o => o.gene === gene);
  const mapHit = JSON.stringify(mp.focus_genes || {}).includes(`"symbol":"${gene}"`) || JSON.stringify(mp.layers || {}).includes(`"symbol":"${gene}"`);
  return {
    gene, zfin_id: zfin,
    in_vetted_map: mapHit,
    causal_chain: chain ? { chain_strength: chain.chain_strength, best_grade: chain.best_grade, weakest_grade: chain.weakest_grade, chain_complete: chain.chain_complete, weakest_link: chain.weakest_link, gaps: chain.gaps, n_sources: chain.n_sources, source: 'genotype/causal-chains.json' } : null,
    cross_gene_caveats: cross,
    interventions: ivs.map(i => ({ id: i.id, parameter: i.parameter, direction: i.direction, level: i.level, evidence_grade: i.evidence_grade, lesion: String(i.lesion || '').slice(0, 160) })),
    flying_fish_orthologue: orth ? { protein: orth.flying_fish_protein, percent_identity_to_zebrafish: orth.percent_identity_to_zebrafish, reciprocal_best_hit: orth.reciprocal_best_hit, ...(orth.why_not_an_orthologue_call ? { NOT_AN_ORTHOLOGUE_CALL: orth.why_not_an_orthologue_call } : {}), source: 'genotype/sequence-layer.json' } : null,
    pathways: { n: pwNames.length, fin_pathways: finPw, first: pwNames.slice(0, 12), source: 'genotype/pathways.slim.json (GO:BP, Reactome, KEGG; membership is not causation)' },
  };
}

// ---------------------------------------------------------------- per-edit evaluation
/** Everything about one gene edit: sequence comparison, sanity checks, annotations. Network is optional. */
export async function evaluateGeneEdit(ed, { network = true, blast = false } = {}) {
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  const out = { edit: ed, annotations: annotations(ed.gene) };
  if (ed.kind === 'unparsed') { add('parse', 'failed', `could not parse "${ed.raw}" (use p.W169L, p.Y285*, p.H215fs, c.505A>G, c.505del, or knockout)`); return { ...out, checks, comparison: { ran: false, reason: 'unparsed' } }; }
  const aln = alignmentFor(ed.gene);
  if (['missense', 'nonsense', 'synonymous', 'frameshift', 'aa_deletion'].includes(ed.kind)) {
    if (aln) {
      const c = compareWithAlignment(ed.gene, ed); out.comparison = c;
      add('reference_residue', c.reference_check.ok ? 'passed' : 'failed', c.reference_check.ok ? `zebrafish ${c.zebrafish_protein} has ${ed.ref} at ${ed.pos}` : c.reference_check.problem);
      const dom = await uniprotDomains(ed.gene, { network });
      const zlen = aln.alignment.danio_rerio.replace(/-/g, '').length;
      if (dom.ran && dom.length === zlen) {
        const hit = dom.features.filter(f => f.start <= ed.pos && ed.pos <= f.end);
        out.domains = { uniprot: dom.accession, features_at_site: hit, source: dom.source, cached: dom.cached };
        add('annotated_domain', hit.length ? 'flagged' : 'passed', hit.length ? `residue ${ed.pos} lies in ${hit.map(f => `${f.type}${f.description ? ` (${f.description})` : ''} ${f.start}-${f.end}`).join('; ')} (UniProt ${dom.accession})` : `no UniProt domain/transmembrane/region/motif feature covers residue ${ed.pos} (UniProt ${dom.accession})`);
      } else add('annotated_domain', 'could-not-run', dom.ran ? `UniProt ${dom.accession} length ${dom.length} differs from the aligned Ensembl protein (${zlen}); positions not mapped` : dom.reason);
      if (c.ran && c.site) add('conserved_site', c.site.conserved_flag ? 'flagged' : 'passed', `${(c.site.conservation_vs_reference * 100).toFixed(0)} % of ${c.site.n_rows} orthologue rows carry ${c.reference_check.reference_residue} (${c.site.conserved_rule})`);
    } else {
      // BLAST fallback on the Ensembl protein
      const zp = await zebrafishProtein(ed.gene, { network });
      if (!zp.ran) { add('reference_residue', 'could-not-run', `no alignment in sequences/ and Ensembl lookup failed: ${zp.reason}`); out.comparison = { ran: false, reason: zp.reason }; }
      else {
        const ok = zp.seq[ed.pos - 1] === ed.ref;
        add('reference_residue', ok ? 'passed' : 'failed', ok ? `Ensembl ${zp.protein_id} has ${ed.ref} at ${ed.pos}` : `Ensembl ${zp.protein_id} has ${zp.seq[ed.pos - 1] || 'nothing'} at ${ed.pos}, not ${ed.ref}`);
        if (blast) {
          const b = await blastProtein(zp.seq, { network });
          if (b.ran) {
            const res = residueInHits(b.hits, ed.pos);
            const carriers = res.filter(h => h.residue === ed.alt);
            out.comparison = { ran: true, source: `NCBI BLAST blastp nr (RID ${b.rid}; ${b.cached ? 'cached' : 'fetched'}; entrez_query NOT Aves[Organism])`, closest_species: b.hits.find(h => !/Danio rerio/i.test(h.sciname || '')) || null,
              hits: res.slice(0, 15), alt_state_in_real_organisms: { in_natural_orthologues: carriers.map(h => ({ species: h.sciname, accession: h.accession })), exists: carriers.length > 0 }, aves_excluded: { entrez: 'NOT Aves[Organism]', post_filtered: b.aves_post_filtered } };
          } else out.comparison = { ran: false, reason: b.reason };
        } else out.comparison = { ran: false, reason: 'gene not in sequences/alignments; BLAST fallback not requested (pass blast:true; NCBI REST, a few minutes, cached)' };
      }
    }
    if (ed.kind === 'nonsense' || ed.kind === 'frameshift') add('premature_stop', 'flagged', `${ed.raw} truncates the protein at residue ${ed.pos}: a loss-of-function STATE (this is a sequence statement, not a phenotype prediction)`);
    else add('premature_stop', 'passed', 'single-residue change; no stop introduced');
    add('in_frame', ed.kind === 'frameshift' ? 'flagged' : 'passed', ed.kind === 'frameshift' ? 'frameshift by construction' : 'protein-level substitution keeps the frame');
  } else if (['nt_substitution', 'nt_deletion', 'nt_insertion'].includes(ed.kind)) {
    const cd = await cdsFor(ed.gene, { network });
    if (!cd.ran) { add('in_frame', 'could-not-run', cd.reason); add('premature_stop', 'could-not-run', cd.reason); }
    else {
      const ap = applyNt(cd.cds, ed);
      if (!ap.ok) add('reference_residue', 'failed', ap.problem);
      else {
        add('reference_residue', 'passed', `CDS ${cd.protein_id} matches the stated reference`);
        const frame = ap.seq.length % 3 === 0; add('in_frame', frame ? 'passed' : 'flagged', frame ? 'edited CDS length is a multiple of 3' : `edited CDS length ${ap.seq.length} is not a multiple of 3: frameshift`);
        const p0 = translate(cd.cds), p1 = translate(ap.seq); const stop = p1.indexOf('*');
        const early = stop >= 0 && stop < p0.replace(/\*$/, '').length;
        add('premature_stop', early ? 'flagged' : 'passed', early ? `stop at residue ${stop + 1} of ${p0.length - 1}: truncation STATE` : 'no premature stop');
        let diff = -1; for (let i = 0; i < Math.min(p0.length, p1.length); i++) if (p0[i] !== p1[i]) { diff = i; break; }
        out.protein_effect = diff < 0 ? 'synonymous' : `first changed residue ${diff + 1}: ${p0[diff]} -> ${p1[diff]}`;
        if (diff >= 0 && aln && p1[diff] !== '*') out.comparison = compareWithAlignment(ed.gene, { kind: 'missense', ref: p0[diff], pos: diff + 1, alt: p1[diff] });
      }
    }
  } else if (ed.kind === 'knockout') {
    add('gene_presence', 'flagged', `gene ${ed.gene} absent: compared against real organisms by whether they carry the gene (see orthologue rows)`);
    out.comparison = aln ? { ran: true, source: `sequences/alignments/${ed.gene}.json`, gene_present_in: Object.keys(aln.alignment).filter(k => !AVES_RE.test(k)).map(k => aln.sequences[k]?.species || k),
      gene_absent_in_panel: 'see sequences/README.md coverage table ("-" = no orthologue returned)' } : { ran: false, reason: 'no alignment' };
  } else if (ed.kind === 'regulatory' || ed.kind === 'expression') {
    add('coding_change', 'passed', 'no coding change: regulatory or expression edit; protein identity unchanged');
    out.comparison = { ran: true, identity_to_unedited_zebrafish: 100, note: 'regulatory edits leave the protein unchanged; real regulatory alleles of this gene are listed under annotations.interventions' };
  }
  // G1 input: the claimed number of nucleotide substitutions, when the edit is a protein substitution.
  out.lean_genotype_edit = ed.kind === 'missense' ? { gene: ed.gene, wt_aa: ed.ref, mut_aa: ed.alt, substitutions: ed.nt_changes ?? 1, substitutions_kind: ed.nt_changes != null ? 'stated' : 'assumed (single-nucleotide edit; the design did not state it)' } : null;
  return { ...out, checks, state_not_phenotype: STATE_NOT_PHENOTYPE };
}

export async function closestGenotype(doc, opts = {}) {
  const eds = geneEdits(doc);
  const per = [];
  for (const e of eds) per.push(await evaluateGeneEdit(e, opts));
  return { n_edits: eds.length, edits: per, note: eds.length ? null : 'no gene-level edits in this design: nothing to compare (the design carries the parents\' reference genotype by construction, which is a statement about the document, not a genome)', state_not_phenotype: STATE_NOT_PHENOTYPE };
}
