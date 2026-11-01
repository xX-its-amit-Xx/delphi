// Builds omics/genes.json: the gene universe and its cross-reference map.
// Inputs (cached, not in the repo): C:/Temp/omics-cache/zfin/*.txt, C:/Temp/genotype/raw/ensembl_1_to_1.txt,
// C:/Temp/omics-cache/uniprot/{zf,hs}_reviewed.tsv. Offline once those exist.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CACHE = process.env.OMICS_CACHE || 'C:/Temp/omics-cache';
const GRAW = process.env.GENOTYPE_RAW || 'C:/Temp/genotype/raw';
const rd = p => fs.readFileSync(p, 'utf8');
const tsv = p => rd(p).split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const J = p => JSON.parse(rd(path.join(ROOT, p)));

// ---- universe
const universe = new Map(); // zfin_id -> {symbol, in:Set}
const add = (z, s, why) => {
  if (!z || !z.startsWith('ZDB-GENE')) return;
  const e = universe.get(z) || { symbol: s, seen: new Set(), in: new Set() };
  e.in.add(why); if (s && /^[A-Za-z0-9._:()-]+$/.test(s)) e.seen.add(s); if (!e.symbol) e.symbol = s; universe.set(z, e);
};
const pw = J('genotype/pathways.json');
for (const [k, v] of Object.entries(pw.genes)) add(k.replace(/^ZF:/, ''), v.symbol, 'genotype/pathways.json');
const cc = J('genotype/causal-chains.json');
for (const g of cc.genes) add(g.zfin_id, g.symbol, 'genotype/causal-chains.json');
const iv = J('genotype/interventions.json');
for (const x of iv.interventions) add(x.zfin_id, x.gene, 'genotype/interventions.json');

// ---- sources
const files = {
  zfin_gene_ncbi: `${CACHE}/zfin/gene.txt`, zfin_uniprot: `${CACHE}/zfin/uniprot.txt`,
  zfin_human_orthos: `${CACHE}/zfin/human_orthos.txt`, zfin_ensembl_1_to_1: `${GRAW}/ensembl_1_to_1.txt`,
  uniprot_zf_reviewed: `${CACHE}/uniprot/zf_reviewed.tsv`, uniprot_hs_reviewed: `${CACHE}/uniprot/hs_reviewed.tsv`,
};
const urls = {
  zfin_gene_ncbi: 'https://zfin.org/downloads/gene.txt', zfin_uniprot: 'https://zfin.org/downloads/uniprot.txt',
  zfin_human_orthos: 'https://zfin.org/downloads/human_orthos.txt', zfin_ensembl_1_to_1: 'https://zfin.org/downloads/ensembl_1_to_1.txt',
  uniprot_zf_reviewed: 'https://rest.uniprot.org/uniprotkb/stream?query=organism_id:7955+AND+reviewed:true&fields=accession,gene_names,xref_zfin,xref_geneid&format=tsv',
  uniprot_hs_reviewed: 'https://rest.uniprot.org/uniprotkb/stream?query=organism_id:9606+AND+reviewed:true&fields=accession,gene_names,xref_hgnc,xref_geneid&format=tsv',
};
const src = {};
for (const [k, p] of Object.entries(files)) src[k] = { url: urls[k], file: path.basename(p), sha256: sha(p), retrieved: fs.statSync(p).mtime.toISOString(), licence: k.startsWith('zfin') ? 'ZFIN: CC BY 4.0' : 'UniProt: CC BY 4.0' };
src.uniprot_zf_reviewed.release = src.uniprot_hs_reviewed.release = 'UniProt 2026_03 (02-September-2026)';

const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(v)) m.get(k).push(v); };
const ncbi = new Map(), ens = new Map(), upAll = new Map(), hum = new Map();
const zfSym = new Map();
for (const r of tsv(files.zfin_gene_ncbi)) { push(ncbi, r[0], r[3]); zfSym.set(r[0], r[2]); }
for (const r of tsv(files.zfin_ensembl_1_to_1)) { push(ens, r[0], r[3]); if (!zfSym.has(r[0])) zfSym.set(r[0], r[2]); }
for (const r of tsv(files.zfin_uniprot)) push(upAll, r[0], r[3]);
const zfRev = new Map();
for (const r of tsv(files.uniprot_zf_reviewed).slice(1)) zfRev.set(r[0], { zfin: (r[2] || '').split(';').filter(Boolean) });
const revByZfin = new Map();
for (const [acc, v] of zfRev) for (const z of v.zfin) push(revByZfin, z, acc);
const hsByHgnc = new Map();
for (const r of tsv(files.uniprot_hs_reviewed).slice(1)) for (const h of (r[2] || '').split(';').filter(Boolean)) push(hsByHgnc, h, r[0]);
for (const r of tsv(files.zfin_human_orthos)) {
  const [z, , , hsym, , omim, hncbi, hgnc, evid] = r;
  if (!hum.has(z)) hum.set(z, new Map());
  const m = hum.get(z);
  const e = m.get(hsym) || { symbol: hsym, hgnc_id: hgnc ? `HGNC:${hgnc}` : null, ncbi: hncbi || null, omim: omim || null, evidence: new Set() };
  if (evid) e.evidence.add(evid); m.set(hsym, e);
}

// flying fish (Xu 2021 annotation): only where sequences/genes.json called an orthologue
const ff = new Map();
try {
  const sg = J('sequences/genes.json');
  for (const g of Object.values(sg.genes)) {
    const f = g.flying_fish || {}; const a = f.Hirundichthys_speculiger_annotated_Xu2021;
    ff.set(g.zfin_id || 'sym:' + Object.keys(sg.genes).find(k => sg.genes[k] === g), {
      species: 'Hirundichthys speculiger',
      assembly: 'GCA_018398805.1 (Xu et al. 2021 annotation, figshare 10.6084/m9.figshare.14600634.v1)',
      protein: a?.flyingfish_protein || null, reciprocal_best_hit: a?.reciprocal_best_hit ?? null,
      pident_vs_zebrafish: a?.forward_pident ?? null, used_in_alignment: f.used_in_alignment || null,
      source: 'sequences/genes.json (reciprocal best blastp vs zebrafish proteome; tblastn on the assembly where RBH failed)',
    });
  }
} catch (e) { console.error('sequences/genes.json not read:', e.message); }

// ---- assemble
const genes = [];
const cov = { total: 0, ensembl_gene: 0, ncbi_gene: 0, uniprot_any: 0, uniprot_reviewed: 0, human_ortholog: 0, human_uniprot: 0, flying_fish: 0 };
for (const [, u] of universe) { const cur = zfSym.get([...universe].find(([, v]) => v === u)[0]); if (cur) u.symbol = cur; }
for (const [z, u] of [...universe].sort((a, b) => a[1].symbol.localeCompare(b[1].symbol))) {
  const rev = (revByZfin.get(z) || []).slice().sort();
  const all = (upAll.get(z) || []).slice().sort();
  const trembl = all.filter(a => !zfRev.has(a));
  const uniprot = rev[0] || trembl[0] || null;
  const humans = [...(hum.get(z)?.values() || [])].map(h => ({
    symbol: h.symbol, hgnc_id: h.hgnc_id, ncbi: h.ncbi, omim: h.omim,
    uniprot: (h.hgnc_id && hsByHgnc.get(h.hgnc_id)?.[0]) || null,
    evidence: [...h.evidence].sort(),
    source: { symbol_hgnc_ncbi: 'zfin_human_orthos', uniprot: h.hgnc_id && hsByHgnc.get(h.hgnc_id) ? 'uniprot_hs_reviewed (HGNC xref)' : null },
  }));
  const e = {
    symbol: u.symbol, zfin_id: z, ...([...u.seen].some(x => x !== u.symbol) ? { symbols_in_genotype: [...u.seen] } : {}),
    ensembl_gene: (ens.get(z) || [])[0] || null,
    ncbi_gene: (ncbi.get(z) || [])[0] || null,
    uniprot, uniprot_status: rev[0] ? 'reviewed' : (trembl[0] ? 'unreviewed' : null),
    human_ortholog: humans[0] || null,
    flying_fish: ff.get(z) || [...u.seen, u.symbol].map(x => ff.get('sym:' + x)).find(Boolean) || null,
    in: [...u.in].sort(),
    source: {
      symbol: zfSym.has(z) ? 'zfin_gene_ncbi (current ZFIN symbol)' : 'genotype thread', ensembl_gene: ens.has(z) ? 'zfin_ensembl_1_to_1' : null,
      ncbi_gene: ncbi.has(z) ? 'zfin_gene_ncbi' : null,
      uniprot: rev[0] ? 'uniprot_zf_reviewed (ZFIN xref)' : (trembl[0] ? 'zfin_uniprot' : null),
    },
  };
  if (ens.get(z)?.length > 1) e.ensembl_gene_all = ens.get(z);
  if (rev.length > 1) e.uniprot_reviewed = rev;
  if (trembl.length) e.uniprot_trembl_n = trembl.length;
  if (humans.length > 1) e.human_orthologs_other = humans.slice(1).map(h => ({ symbol: h.symbol, hgnc_id: h.hgnc_id, ncbi: h.ncbi, uniprot: h.uniprot }));
  cov.total++; if (e.ensembl_gene) cov.ensembl_gene++; if (e.ncbi_gene) cov.ncbi_gene++; if (uniprot) cov.uniprot_any++; if (rev[0]) cov.uniprot_reviewed++;
  if (humans.length) cov.human_ortholog++; if (humans[0]?.uniprot) cov.human_uniprot++; if (e.flying_fish) cov.flying_fish++;
  genes.push(e);
}
const out = {
  title: 'DELPHI omics gene universe and cross-reference map',
  built: new Date().toISOString(), tool: 'omics/scripts/build-genes.mjs',
  species: 'Danio rerio (zebrafish), assembly GRCz11. Flying-fish (Hirundichthys speculiger) IDs only where sequences/genes.json called an orthologue (9 focal genes); the rest are not mapped, not absent.',
  universe_rule: 'every ZFIN gene in genotype/pathways.json `genes` plus genes in genotype/causal-chains.json and genotype/interventions.json',
  how_to_join: 'Layer rows carry gene.zfin_id (primary key), plus symbol, ensembl_gene, uniprot copied from here. Join on zfin_id; fall back to ensembl_gene, then uniprot.',
  constraint: 'Proxy-species identifiers. No bird (Aves) identifiers or orthologues: class Aves is the frozen holdout. Human orthologues are for borrowing annotation, labelled kind=borrowed-ortholog in layer rows.',
  sources: src, coverage: cov, genes,
};
const OUT = process.env.OMICS_GENES_OUT || path.join(ROOT, 'omics/genes.json');
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify(cov), (fs.statSync(OUT).size / 1e6).toFixed(2) + ' MB');
