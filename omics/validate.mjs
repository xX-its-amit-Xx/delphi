#!/usr/bin/env node
// Schema validator for omics layer rows (see omics/SCHEMA.md).
// Usage: node omics/validate.mjs <annotations.jsonl[.gz]> [more files]   (or: --self-test)
// Exit 0 when every row is valid, 1 otherwise. Prints counts and the first errors.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

export const LAYERS = ['genomic', 'transcriptomic', 'proteomic', 'pathway', 'ptm'];
export const KINDS = ['measured', 'curated', 'inferred-electronic', 'predicted', 'borrowed-ortholog'];
const CTX = ['anatomy', 'stage', 'cell_type', 'condition'];
// Bird taxa (class Aves): frozen holdout. Genus/common names likely to appear in orthology or species fields.
const AVES = /\b(aves|gallus|chicken|taeniopygia|zebra ?finch|meleagris|turkey|anas\b|duck|columba|pigeon|coturnix|quail|ficedula|flycatcher|parus|serinus|canary|melopsittacus|budgerigar|aquila|eagle|falco|strigops|ostrich|struthio|dromaius|emu|bird|avian)\b/i;

export function validateRow(r, expectLayer) {
  const e = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) return ['row is not an object'];
  const g = r.gene;
  if (!g || typeof g !== 'object') e.push('gene missing');
  else {
    if (!g.symbol || typeof g.symbol !== 'string') e.push('gene.symbol missing');
    if (r.species === 'Danio rerio' && !(g.zfin_id && /^ZDB-GENE-/.test(g.zfin_id))) e.push('gene.zfin_id missing/invalid for zebrafish row');
  }
  if (!r.species || typeof r.species !== 'string') e.push('species missing');
  if (!LAYERS.includes(r.layer)) e.push(`layer invalid: ${r.layer}`);
  else if (expectLayer && r.layer !== expectLayer) e.push(`layer ${r.layer} != folder ${expectLayer}`);
  if (!r.feature || typeof r.feature !== 'string' || !/^[a-z][a-z0-9_]*$/.test(r.feature)) e.push(`feature invalid: ${r.feature}`);
  if (!('value' in r) || r.value === undefined || r.value === null || r.value === '') e.push('value missing');
  else if (JSON.stringify(r.value).length > 4096) e.push('value too large (>4 KB)');
  if (!('unit' in r)) e.push('unit key missing (use null)');
  const c = r.context;
  if (!c || typeof c !== 'object') e.push('context missing');
  else {
    for (const k of CTX) if (!(k in c)) e.push(`context.${k} key missing (use null)`);
    for (const k of ['anatomy', 'stage', 'cell_type']) {
      const o = c[k];
      if (o == null) continue;
      if (typeof o !== 'object' || !o.id || !/^[A-Za-z_]+:\S+$/.test(o.id)) e.push(`context.${k}.id must be a CURIE`);
    }
  }
  const s = r.source;
  if (!s || typeof s !== 'object') e.push('source missing');
  else {
    if (!s.db) e.push('source.db missing');
    if (!s.url) e.push('source.url missing');
    for (const k of ['release_or_date', 'accession', 'licence']) if (!(k in s)) e.push(`source.${k} key missing (use null)`);
  }
  if (!KINDS.includes(r.kind)) e.push(`kind invalid: ${r.kind}`);
  if (!('evidence' in r)) e.push('evidence key missing (use null)');
  if (AVES.test(r.species || '') || AVES.test(JSON.stringify(r.gene || {})) || (r.feature === 'ortholog' && AVES.test(JSON.stringify(r.value)))) e.push('bird (Aves) data: frozen holdout');
  return e;
}

export async function validateFile(file, { maxErrors = 20 } = {}) {
  const layer = LAYERS.find(l => file.replace(/\\/g, '/').includes(`/${l}/`));
  let stream = fs.createReadStream(file);
  if (file.endsWith('.gz')) stream = stream.pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let n = 0, bad = 0; const errors = []; const genes = new Set(); const bySource = {}; const byFeature = {};
  for await (const line of rl) {
    if (!line.trim()) continue;
    n++;
    let r; try { r = JSON.parse(line); } catch { bad++; if (errors.length < maxErrors) errors.push(`line ${n}: not JSON`); continue; }
    const e = validateRow(r, layer);
    if (e.length) { bad++; if (errors.length < maxErrors) errors.push(`line ${n}: ${e.join('; ')}`); continue; }
    genes.add(r.gene.zfin_id || r.gene.symbol);
    bySource[r.source.db] = (bySource[r.source.db] || 0) + 1;
    byFeature[r.feature] = (byFeature[r.feature] || 0) + 1;
  }
  return { file, layer, rows: n, invalid: bad, genes: genes.size, bySource, byFeature, errors, ok: n > 0 && bad === 0 };
}

function selfTest() {
  const good = { gene: { symbol: 'kcnk5b', zfin_id: 'ZDB-GENE-040426-1297', ensembl_gene: 'ENSDARG00000012390', uniprot: null }, species: 'Danio rerio', layer: 'genomic', feature: 'allele_phenotype', value: 'pectoral fin increased size', unit: null, context: { anatomy: { id: 'ZFA:0001161', label: 'pectoral fin' }, stage: null, cell_type: null, condition: null }, source: { db: 'ZFIN', release_or_date: '2026-10-31', url: 'https://zfin.org', accession: null, licence: 'CC BY 4.0' }, kind: 'curated', evidence: 'IMP', concordance: null };
  const cases = [
    ['good row', good, true],
    ['missing kind', { ...good, kind: undefined }, false],
    ['bad layer', { ...good, layer: 'epigenomic' }, false],
    ['no zfin id', { ...good, gene: { symbol: 'x' } }, false],
    ['bird species', { ...good, species: 'Gallus gallus' }, false],
    ['bird ortholog', { ...good, feature: 'ortholog', value: { species: 'Taeniopygia guttata', id: 'X' } }, false],
    ['anatomy not CURIE', { ...good, context: { ...good.context, anatomy: { label: 'fin' } } }, false],
    ['context key missing', { ...good, context: { anatomy: null } }, false],
    ['wrong folder', good, false, 'pathway'],
  ];
  let fail = 0;
  for (const [name, row, want, layer] of cases) {
    const got = validateRow(row, layer).length === 0;
    if (got !== want) { fail++; console.log(`FAIL ${name}: expected ${want ? 'valid' : 'invalid'}`); } else console.log(`ok   ${name}`);
  }
  return fail === 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === '--self-test') { process.exit(selfTest() ? 0 : 1); }
  let allOk = true;
  for (const f of args) {
    const r = await validateFile(f);
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${f}: ${r.rows} rows, ${r.invalid} invalid, ${r.genes} genes`);
    console.log('  by source:', JSON.stringify(r.bySource));
    console.log('  by feature:', JSON.stringify(r.byFeature));
    for (const e of r.errors) console.log('  ' + e);
    if (!r.ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}
