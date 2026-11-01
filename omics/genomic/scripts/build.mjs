// Offline build of omics/genomic/annotations.jsonl.gz + MANIFEST.json from cached downloads.
// Sources: Ensembl REST (release 116), NCBI Gene esummary, ZFIN bulk downloads, Alliance 9.0.0 bulk files,
// sequences/genes.json (flying-fish orthologues). Row format: omics/SCHEMA.md.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const C = process.env.OMICS_CACHE || 'C:/Temp/omics-cache';
const GRAW = process.env.GENOTYPE_RAW || 'C:/Temp/genotype/raw';
const OUTDIR = process.env.OMICS_GENOMIC_OUT || path.join(ROOT, 'omics/genomic');
const rd = p => fs.readFileSync(p, 'utf8');
const tsv = p => (p.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(p)).toString('utf8') : rd(p)).split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mdate = p => fs.statSync(p).mtime.toISOString().slice(0, 10);

const G = JSON.parse(rd(path.join(ROOT, 'omics/genes.json')));
const byZ = new Map(G.genes.map(g => [g.zfin_id, g]));
const byEns = new Map(G.genes.filter(g => g.ensembl_gene).map(g => [g.ensembl_gene, g]));
const byNcbi = new Map(G.genes.filter(g => g.ncbi_gene).map(g => [g.ncbi_gene, g]));
const gene = g => ({ symbol: g.symbol, zfin_id: g.zfin_id, ensembl_gene: g.ensembl_gene, uniprot: g.uniprot });
const NOCTX = { anatomy: null, stage: null, cell_type: null, condition: null };

const rows = [];
const retrievals = [];
const R = (g, feature, value, unit, source, kind, evidence, extra = {}, context = NOCTX, species = 'Danio rerio') =>
  rows.push({ gene: gene(g), species, layer: 'genomic', feature, value, unit, context, source, kind, evidence, concordance: null, ...extra });
const ret = (url, file) => { retrievals.push({ url, date: mdate(file), sha256: sha(file), file: path.basename(file) }); };

// ---------- Ensembl lookup (release 116, GRCz11)
const ENS = { db: 'Ensembl', release_or_date: 'release 116 (GRCz11)', licence: 'Ensembl: no restrictions on data use (open; cite Ensembl)' };
const ensInfo = JSON.parse(rd(`${C}/genomic/ensembl/info_data.json`));
if (ensInfo.releases?.[0]) ENS.release_or_date = `release ${ensInfo.releases[0]} (GRCz11)`;
for (const f of fs.readdirSync(`${C}/genomic/ensembl`).filter(f => f.startsWith('lookup_'))) {
  const p = `${C}/genomic/ensembl/${f}`; ret('https://rest.ensembl.org/lookup/id?expand=1 (POST, 1000 ids)', p);
  for (const [id, v] of Object.entries(JSON.parse(rd(p)))) {
    const g = byEns.get(id); if (!g || !v) continue;
    const src = { ...ENS, url: `https://rest.ensembl.org/lookup/id/${id}?expand=1`, accession: id };
    R(g, 'chromosome', String(v.seq_region_name), null, src, 'curated', 'Ensembl gene annotation (genebuild)', { assembly: v.assembly_name });
    R(g, 'gene_location', { assembly: v.assembly_name, chr: String(v.seq_region_name), start: v.start, end: v.end, strand: v.strand, length_bp: v.end - v.start + 1 }, 'bp', src, 'curated', 'Ensembl gene annotation (genebuild)');
    R(g, 'biotype', v.biotype, null, src, 'curated', `Ensembl ${v.logic_name || 'genebuild'}`);
    const tx = v.Transcript || [];
    R(g, 'transcript_count', tx.length, 'count', src, 'curated', 'Ensembl genebuild', {
      protein_coding_transcripts: tx.filter(t => t.biotype === 'protein_coding').length,
      canonical_transcript: v.canonical_transcript || null,
      canonical_exons: (tx.find(t => t.is_canonical) || {}).Exon?.length ?? null,
    });
    if (v.description) R(g, 'gene_name', v.description.replace(/\s*\[Source:.*\]$/, ''), null, src, 'curated', 'Ensembl description (imported from ZFIN)', { derived_from: 'ZFIN' });
  }
}
// paralogues + medaka orthologues: Ensembl Compara 116 TSV dump (REST homology was ~10 s/call with 503s on 2026-11-01)
const COMPARA_URL = 'https://ftp.ensembl.org/pub/release-116/tsv/ensembl-compara/homologies/danio_rerio/Compara.116.protein_default.homologies.tsv.gz';
const compF = `${C}/genomic/ensembl/compara116_drerio_filtered.tsv.gz`;
let paraGenes = 0;
retrievals.push({ url: COMPARA_URL, date: mdate(compF), sha256: rd(`${C}/genomic/ensembl/compara_dump.sha256`).split(' ')[0], note: 'streamed; kept rows with homology_species danio_rerio or oryzias_latipes (filtered copy sha256 ' + sha(compF) + ')' });
const para = new Map(), medaka = new Map();
for (const r of tsv(compF).slice(1)) {
  if (!byEns.has(r[0])) continue;
  if (r[7] === 'danio_rerio') { const a = para.get(r[0]) || []; a.push(r); para.set(r[0], a); }
  else if (r[7] === 'oryzias_latipes') { const a = medaka.get(r[0]) || []; a.push(r); medaka.set(r[0], a); }
}
for (const [id, hs] of para) {
  const g = byEns.get(id); paraGenes++;
  const src = { ...ENS, url: `https://www.ensembl.org/Danio_rerio/Gene/Compara_Paralog?g=${id}`, accession: id };
  const by = hs.reduce((a, h) => (a[h[4]] = (a[h[4]] || 0) + 1, a), {});
  R(g, 'paralog_count', hs.length, 'count', src, 'inferred-electronic', 'Ensembl Compara gene trees', { by_type: by });
  const close = hs.filter(h => h[4] === 'within_species_paralog').sort((a, b) => b[3] - a[3]);
  for (const h of close.slice(0, 10)) {
    const pg = byEns.get(h[5]);
    R(g, 'paralog', { ensembl_gene: h[5], symbol: pg?.symbol || null, zfin_id: pg?.zfin_id || null, type: h[4], identity_pct: Number(h[3]) }, null, src, 'inferred-electronic', 'Ensembl Compara gene trees', { match_key: h[5] });
  }
}
for (const [id, hs] of medaka) {
  const g = byEns.get(id);
  for (const h of hs.slice(0, 5)) R(g, 'ortholog', { species: 'Oryzias latipes', id: h[5], symbol: null, type: h[4], identity_pct: Number(h[3]), high_confidence: h[13] === '1' }, null,
    { ...ENS, url: `https://www.ensembl.org/Danio_rerio/Gene/Compara_Ortholog?g=${id}`, accession: h[5] }, 'inferred-electronic', 'Ensembl Compara gene trees',
    { note: 'medaka is the closest Ensembl-annotated relative of flying fish (both Beloniformes)', match_key: `Oryzias latipes:${h[5]}` });
}

// ---------- NCBI Gene esummary
const NCBI = { db: 'NCBI Gene', licence: 'NCBI: public domain (US government); some records carry third-party text' };
const ncbiNames = new Map();
for (const f of fs.readdirSync(`${C}/genomic/ncbi`).filter(f => f.startsWith('esummary_'))) {
  const p = `${C}/genomic/ncbi/${f}`; ret('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi (POST db=gene, 200 ids)', p);
  const j = JSON.parse(rd(p));
  for (const uid of j.result.uids) {
    const r = j.result[uid]; const g = byNcbi.get(uid); if (!g || !r) continue;
    const src = { ...NCBI, release_or_date: mdate(p), url: `https://www.ncbi.nlm.nih.gov/gene/${uid}`, accession: uid };
    if (r.chromosome) R(g, 'chromosome', String(r.chromosome), null, src, 'curated', 'NCBI Gene annotation', { assembly: r.genomicinfo?.[0]?.chraccver || null });
    const gi = r.genomicinfo?.[0];
    if (gi) R(g, 'gene_location', { assembly: gi.chraccver, chr: gi.chrloc, start: Math.min(gi.chrstart, gi.chrstop) + 1, end: Math.max(gi.chrstart, gi.chrstop) + 1, exon_count: gi.exoncount }, 'bp', src, 'curated', 'NCBI Gene annotation',
      { note: 'NCBI coordinates are on the RefSeq sequence named in assembly (not necessarily GRCz11); compare chromosome, not positions' });
    if (r.description) { R(g, 'gene_name', r.description, null, src, 'curated', 'NCBI Gene official full name (from ZFIN nomenclature)', { derived_from: 'ZFIN' }); ncbiNames.set(uid, r.description); }
    for (const a of (r.otheraliases || '').split(/,\s*/).filter(Boolean)) R(g, 'alias', a, null, src, 'curated', 'NCBI Gene other aliases');
    if (r.summary) R(g, 'summary', r.summary, null, src, /Alliance/.test(r.summary) ? 'inferred-electronic' : 'curated', /Alliance/.test(r.summary) ? 'automated description' : 'RefSeq summary',
      /Alliance/.test(r.summary) ? { derived_from: 'Alliance' } : {});
  }
}

// ---------- ZFIN
const ZF = { db: 'ZFIN', licence: 'ZFIN: CC BY 4.0' };
const zfDate = mdate(`${GRAW}/features-affected-genes.txt`);
// aliases
ret('https://zfin.org/downloads/aliases.txt', `${GRAW}/aliases.txt`);
for (const r of tsv(`${GRAW}/aliases.txt`)) {
  const g = byZ.get(r[0]); if (!g || !r[3]) continue;
  R(g, 'alias', r[3], null, { ...ZF, release_or_date: mdate(`${GRAW}/aliases.txt`), url: `https://zfin.org/${r[0]}`, accession: r[0] }, 'curated', 'ZFIN nomenclature');
}
// alleles per gene
ret('https://zfin.org/downloads/features-affected-genes.txt', `${GRAW}/features-affected-genes.txt`);
const alleles = new Map(); const alleleInfo = new Map();
for (const r of tsv(`${GRAW}/features-affected-genes.txt`)) {
  if (!r[0]?.startsWith('ZDB-ALT') || !byZ.has(r[4])) continue;
  const a = alleles.get(r[4]) || []; a.push(r); alleles.set(r[4], a);
  alleleInfo.set(r[0], { type: r[7], consequence: r[20] || null });
}
for (const [z, list] of alleles) {
  const by = {}; for (const r of list) by[r[7]] = (by[r[7]] || 0) + 1;
  R(byZ.get(z), 'allele_count', list.length, 'count', { ...ZF, release_or_date: zfDate, url: `https://zfin.org/${z}`, accession: z }, 'curated', 'ZFIN genomic features', { by_type: by });
}
// phenotypes (clean gene phenotype file), condition resolved as in genotype/build.py
const stageZfs = new Map(tsv(`${GRAW}/stage_ontology.txt`).map(r => [r[0], { id: r[1], label: r[2] }]));
const envOf = new Map();
for (const r of tsv(`${GRAW}/pheno_environment_fish.txt`)) { if (r.length < 3) continue; const a = envOf.get(r[0]) || []; a.push([r[2], r[1]]); envOf.set(r[0], a); }
const ONT = /^(ZFA|GO|CL|PATO|BSPO|MPATH|UBERON|CHEBI|ZFS):\d+/;
const expIdx = new Map();
for (const r of tsv(`${GRAW}/phenotype_fish.txt`)) {
  if (r.length < 23) continue;
  const tag = r.find(x => x === 'abnormal' || x === 'normal') || '';
  const k = [r[0], r[2], r[4], r[21], r.filter(x => ONT.test(x)).sort().join(','), tag].join('|');
  const s = expIdx.get(k) || new Set(); s.add(r[22]); expIdx.set(k, s);
}
const comps = new Map();
for (const r of tsv(`${GRAW}/fish_components_fish.txt`)) { const a = comps.get(r[0]) || []; a.push(r); comps.set(r[0], a); }
const uz = JSON.parse(rd(path.join(ROOT, 'genotype/cache/ubergraph_uberon_zfa_xrefs.json')));
const zfa2uberon = new Map();
for (const b of (uz.result?.results?.bindings || [])) {
  const u = (b.u?.value || b.u || '').replace(/.*\/UBERON_/, 'UBERON:'); const x = (b.x?.value || b.x || '');
  if (u && /^ZFA:/.test(x)) zfa2uberon.set(x, u);
}
const pheno = new Map();
let phRows = 0, phNonStd = 0;
ret('https://zfin.org/downloads/phenoGeneCleanData_fish.txt', `${GRAW}/phenoGeneCleanData_fish.txt`);
ret('https://zfin.org/downloads/phenotype_fish.txt', `${GRAW}/phenotype_fish.txt`);
ret('https://zfin.org/downloads/pheno_environment_fish.txt', `${GRAW}/pheno_environment_fish.txt`);
for (const r of tsv(`${GRAW}/phenoGeneCleanData_fish.txt`)) {
  if (r.length < 25 || !byZ.has(r[2])) continue;
  phRows++;
  const k = [r[18], r[20], r[21], r[23], r.filter(x => ONT.test(x)).sort().join(','), r[11]].join('|');
  const exps = expIdx.get(k) || new Set();
  const conds = [...new Set([...exps].flatMap(e => (envOf.get(e) || [['?', 'no environment row']]).map(c => c.join(' '))))];
  const standard = exps.size > 0 && conds.every(c => c.startsWith('ZECO:0000103'));
  if (!standard) phNonStd++;
  const entity = r[7] ? { id: r[7], label: r[8] } : null;
  const sub = r[3] ? { id: r[3], label: r[4] } : null;
  const comp = comps.get(r[18]) || [];
  const reagent = /MO\d|CRISPR/.test(r[19]) && !comp.some(c => c[4]?.startsWith('ZDB-ALT')) ? 'knockdown/crispant' : 'allele';
  const st = stageZfs.get(r[20]);
  const key = [r[2], r[3], r[7], r[9], r[11], r[20], standard, reagent].join('|');
  const p = pheno.get(key) || { r, entity, sub, st, standard, conds, reagent, fish: new Set(), pubs: new Set(), alleles: new Set() };
  p.fish.add(r[18]); p.pubs.add(r[23]);
  for (const c of comp) if (c[4]?.startsWith('ZDB-ALT') && c[2] === r[2]) p.alleles.add(c[4]);
  pheno.set(key, p);
}
for (const p of pheno.values()) {
  const r = p.r; const g = byZ.get(r[2]);
  const isZfa = p.entity && /^ZFA:/.test(p.entity.id);
  const anatomy = isZfa ? { ...p.entity, ...(zfa2uberon.get(p.entity.id) ? { uberon: zfa2uberon.get(p.entity.id) } : {}) } : null;
  const value = [p.sub?.label, p.entity?.label, r[10]].filter(Boolean).join(' ') + (r[11] === 'normal' ? ' (normal)' : '');
  const fish = [...p.fish];
  R(g, 'allele_phenotype', value, null,
    { ...ZF, release_or_date: zfDate, url: `https://zfin.org/${fish[0]}`, accession: fish[0], licence: ZF.licence },
    'curated', r[11] === 'abnormal' ? 'ECO:0000315 (mutant phenotype, ZFIN curated)' : 'ECO:0000315 (normal phenotype recorded)',
    {
      phenotype: { entity: p.entity, subterm: p.sub, quality: { id: r[9], label: r[10] }, tag: r[11] },
      reagent: p.reagent, alleles: [...p.alleles].slice(0, 10).map(a => ({ id: a, ...alleleInfo.get(a) })),
      n_fish: fish.length, fish: fish.slice(0, 5), pubs: [...p.pubs].slice(0, 10), standard_conditions: p.standard,
      ...(isZfa || !p.entity ? {} : { go_process: p.entity }),
    },
    { anatomy, stage: p.st ? { id: p.st.id, label: p.st.label } : null, cell_type: null, condition: p.standard ? 'standard conditions (ZECO:0000103)' : (p.conds.join('; ') || 'not resolved') });
}

// ---------- Alliance
const AL = { db: 'Alliance of Genome Resources', release_or_date: 'Alliance 9.0.0', licence: 'Alliance: CC BY 4.0' };
const alDir = `${C}/genomic/alliance`;
// gene descriptions
ret('https://fms.alliancegenome.org/download/GENE-DESCRIPTION-TSV_ZFIN.tsv.gz', `${alDir}/GENE-DESCRIPTION-TSV_ZFIN.tsv.gz`);
for (const r of tsv(`${alDir}/GENE-DESCRIPTION-TSV_ZFIN.tsv.gz`)) {
  const g = byZ.get((r[0] || '').replace('ZFIN:', '')); if (!g || !r[2] || /^No description/.test(r[2])) continue;
  R(g, 'summary', r[2], null, { ...AL, url: `https://www.alliancegenome.org/gene/ZFIN:${g.zfin_id}`, accession: `ZFIN:${g.zfin_id}` }, 'inferred-electronic', 'Alliance automated gene description');
}
// orthology (stringent), zebrafish -> others. Alliance species set has no birds; filter anyway.
const AVES = /aves|gallus|taeniopygia|meleagris|anas |columba|coturnix/i;
ret('https://fms.alliancegenome.org/download/ORTHOLOGY-ALLIANCE_COMBINED.tsv.gz', `${alDir}/ORTHOLOGY-ALLIANCE_COMBINED.tsv.gz`);
let orthoDroppedBird = 0;
for (const r of tsv(`${alDir}/ORTHOLOGY-ALLIANCE_COMBINED.tsv.gz`)) {
  if (r[3] !== 'Danio rerio') continue;
  const g = byZ.get(r[0].replace('ZFIN:', '')); if (!g) continue;
  if (AVES.test(r[7])) { orthoDroppedBird++; continue; }
  if (!['Homo sapiens', 'Mus musculus', 'Xenopus tropicalis'].includes(r[7])) continue;
  R(g, 'ortholog', { species: r[7], id: r[4], symbol: r[5] }, null, { ...AL, url: `https://www.alliancegenome.org/gene/ZFIN:${g.zfin_id}#orthology`, accession: r[4] },
    'inferred-electronic', `orthology algorithms ${r[9]}/${r[10]} (${r[8]})`, { best_score: r[11] === 'Yes', best_reverse: r[12] === 'Yes', match_key: `${r[7]}:${r[5].toUpperCase()}` });
}
// ZFIN curated human orthologues (second, independent-method source for the same feature)
ret('https://zfin.org/downloads/human_orthos.txt', `${C}/zfin/human_orthos.txt`);
const zho = new Map();
for (const r of tsv(`${C}/zfin/human_orthos.txt`)) {
  if (!byZ.has(r[0])) continue; const k = r[0] + '|' + r[3];
  const e = zho.get(k) || { z: r[0], sym: r[3], hgnc: r[7], ncbi: r[6], ev: new Set(), pubs: new Set() }; e.ev.add(r[8]); e.pubs.add(r[9]); zho.set(k, e);
}
for (const e of zho.values()) R(byZ.get(e.z), 'ortholog', { species: 'Homo sapiens', id: e.hgnc ? `HGNC:${e.hgnc}` : null, symbol: e.sym }, null,
  { ...ZF, release_or_date: mdate(`${C}/zfin/human_orthos.txt`), url: `https://zfin.org/${e.z}/orthologs`, accession: e.hgnc ? `HGNC:${e.hgnc}` : null }, 'curated',
  `ZFIN curated orthology: ${[...e.ev].join(', ')}`, { ncbi: e.ncbi, pubs: [...e.pubs].slice(0, 5), match_key: `Homo sapiens:${e.sym.toUpperCase()}` });
// disease: zebrafish models (curated by ZFIN, served by Alliance) and human-ortholog disease (borrowed)
ret('https://fms.alliancegenome.org/download/DISEASE-ALLIANCE_ZFIN.tsv.gz', `${alDir}/DISEASE-ALLIANCE_ZFIN.tsv.gz`);
const dz = new Map();
for (const r of tsv(`${alDir}/DISEASE-ALLIANCE_ZFIN.tsv.gz`)) {
  if (r[2] !== 'gene' || /via_orthology/.test(r[5])) continue; const z = r[3].replace('ZFIN:', ''); if (!byZ.has(z)) continue;
  const k = z + '|' + r[6]; const e = dz.get(k) || { z, doid: r[6], name: r[7], assoc: new Set(), refs: new Set(), ev: new Set() };
  e.assoc.add(r[5]); e.refs.add(r[15]); e.ev.add(r[13]); dz.set(k, e);
}
for (const e of dz.values()) R(byZ.get(e.z), 'disease_model', { id: e.doid, label: e.name }, null,
  { db: 'Alliance (from ZFIN)', release_or_date: AL.release_or_date, url: `https://www.alliancegenome.org/gene/ZFIN:${e.z}#disease-associations`, accession: e.doid, licence: AL.licence },
  'curated', [...e.ev].join(','), { association: [...e.assoc], refs: [...e.refs].slice(0, 5), match_key: e.doid });
ret('https://fms.alliancegenome.org/download/DISEASE-ALLIANCE_HUMAN.tsv.gz', `${alDir}/DISEASE-ALLIANCE_HUMAN.tsv.gz`);
const hgncToZ = new Map();
for (const g of G.genes) { const hs = [g.human_ortholog, ...(g.human_orthologs_other || [])].filter(Boolean); for (const h of hs) if (h.hgnc_id) { const a = hgncToZ.get(h.hgnc_id) || []; a.push(g.zfin_id); hgncToZ.set(h.hgnc_id, a); } }
const dh = new Map();
for (const r of tsv(`${alDir}/DISEASE-ALLIANCE_HUMAN.tsv.gz`)) {
  if (r[2] !== 'gene' || !hgncToZ.has(r[3])) continue;
  if (/via_orthology/.test(r[5])) continue; // human annotations inferred from model organisms: circular here
  for (const z of hgncToZ.get(r[3])) {
    const k = z + '|' + r[3] + '|' + r[6]; const e = dh.get(k) || { z, hgnc: r[3], hsym: r[4], doid: r[6], name: r[7], assoc: new Set(), src: new Set(), refs: new Set() };
    e.assoc.add(r[5]); e.src.add(r[17]); e.refs.add(r[15]); dh.set(k, e);
  }
}
for (const e of dh.values()) R(byZ.get(e.z), 'human_disease_association', { id: e.doid, label: e.name }, null,
  { db: 'Alliance (human orthologue)', release_or_date: AL.release_or_date, url: `https://www.alliancegenome.org/gene/${e.hgnc}#disease-associations`, accession: e.hgnc, licence: AL.licence },
  'borrowed-ortholog', 'disease annotation of the human orthologue', { human_gene: { symbol: e.hsym, hgnc_id: e.hgnc }, contributing_sources: [...e.src], negative: [...e.assoc].every(a => /not_/.test(a)), association: [...e.assoc], refs: [...e.refs].slice(0, 5), match_key: e.doid });

// ---------- flying fish (Xu 2021 annotation via sequences/genes.json)
for (const g of G.genes.filter(g => g.flying_fish?.protein)) {
  R(g, 'ortholog', { species: 'Hirundichthys speculiger', id: g.flying_fish.protein, symbol: null, pident_vs_zebrafish: g.flying_fish.pident_vs_zebrafish, reciprocal_best_hit: g.flying_fish.reciprocal_best_hit }, null,
    { db: 'Xu et al. 2021 annotation (figshare 10.6084/m9.figshare.14600634.v1)', release_or_date: '2021', url: 'https://doi.org/10.3389/fgene.2021.695700', accession: g.flying_fish.protein, licence: 'Frontiers in Genetics article CC BY 4.0; figshare data CC BY 4.0' },
    'predicted', 'reciprocal best blastp (sequences/genes.json)', { note: 'orthologue call made in this project; the Xu 2021 genome has no expression or phenotype data', match_key: `Hirundichthys speculiger:${g.flying_fish.protein}` },
    NOCTX, 'Danio rerio');
}

// flying-fish assembly record (NCBI Datasets): checked for gene annotation; none, so no per-gene NCBI rows
const ffDs = `${C}/genomic/ncbi_datasets/GCA_018398805.1.json`;
let ffAnnotation = 'not checked';
if (fs.existsSync(ffDs)) { ret('https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/GCA_018398805.1/dataset_report', ffDs); ffAnnotation = JSON.parse(rd(ffDs)).reports?.[0]?.annotation_info ? 'NCBI annotation present' : 'no NCBI gene annotation (annotation_info absent); gene models only in the Xu 2021 figshare release'; }

// ---------- write
rows.sort((a, b) => a.gene.symbol.localeCompare(b.gene.symbol) || a.feature.localeCompare(b.feature));
fs.mkdirSync(OUTDIR, { recursive: true });
const out = path.join(OUTDIR, 'annotations.jsonl.gz');
fs.writeFileSync(out, zlib.gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { level: 9 }));
const bySource = {}, byFeature = {}; const genesCovered = new Set();
for (const r of rows) {
  const s = bySource[r.source.db] || (bySource[r.source.db] = { rows: 0, genes: new Set() }); s.rows++; s.genes.add(r.gene.zfin_id);
  byFeature[r.feature] = (byFeature[r.feature] || 0) + 1; genesCovered.add(r.gene.zfin_id);
}
for (const s of Object.values(bySource)) s.genes = s.genes.size;
const manifest = {
  layer: 'genomic', built: new Date().toISOString(), tool: 'omics/genomic/scripts/build.mjs', rows: rows.length,
  genes_universe: G.genes.length, genes_covered: genesCovered.size, by_source: bySource, by_feature: byFeature,
  notes: {
    zfin_phenotype_rows_in_universe: phRows, zfin_phenotype_rows_not_standard_or_ambiguous: phNonStd,
    genes_with_paralogues: paraGenes, alliance_bird_orthologues_dropped: orthoDroppedBird,
    zfa_to_uberon_xrefs: zfa2uberon.size, flying_fish_assembly_GCA_018398805_1: ffAnnotation,
  },
  files: { 'annotations.jsonl.gz': { bytes: fs.statSync(out).size, sha256: sha(out) } },
  retrievals, status: process.env.OMICS_STATUS || 'done',
};
fs.writeFileSync(path.join(OUTDIR, 'MANIFEST.json'), JSON.stringify(manifest, null, 1));
console.log(rows.length, 'rows', (manifest.files['annotations.jsonl.gz'].bytes / 1e6).toFixed(2), 'MB', JSON.stringify(byFeature));
console.log(JSON.stringify(manifest.notes));
