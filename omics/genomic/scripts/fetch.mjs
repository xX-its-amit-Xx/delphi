// Network step of the genomic layer. Caches everything under C:/Temp/omics-cache/genomic and logs each call.
// Ensembl REST POST /lookup/id (batches of 1000), Ensembl BioMart (paralogues), NCBI E-utilities esummary (batches of 200).
// ZFIN and Alliance bulk files are fetched with curl (see SOURCES.md); this script does not refetch cached files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CACHE = (process.env.OMICS_CACHE || 'C:/Temp/omics-cache') + '/genomic';
fs.mkdirSync(CACHE + '/ensembl', { recursive: true }); fs.mkdirSync(CACHE + '/ncbi', { recursive: true });
const genes = JSON.parse(fs.readFileSync(path.join(ROOT, 'omics/genes.json'), 'utf8')).genes;
const logFile = CACHE + '/calls.json';
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
async function call(url, opts, out) {
  if (fs.existsSync(out)) return fs.readFileSync(out, 'utf8');
  for (let i = 0; i < 4; i++) {
    const t = new Date().toISOString();
    const r = await fetch(url, opts);
    const body = await r.text();
    log.push({ url, method: opts?.method || 'GET', time: t, status: r.status, bytes: body.length, sha256: sha(body), out: path.basename(out) });
    fs.writeFileSync(logFile, JSON.stringify(log, null, 1));
    if (r.ok) { fs.writeFileSync(out, body); return body; }
    console.error('HTTP', r.status, url); await sleep(3000 * (i + 1));
  }
  throw new Error('failed ' + url);
}
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Ensembl lookup
const ens = genes.map(g => g.ensembl_gene).filter(Boolean);
let i = 0;
for (const c of chunks(ens, 1000)) {
  await call('https://rest.ensembl.org/lookup/id?expand=1', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ids: c }) }, `${CACHE}/ensembl/lookup_${i++}.json`);
  await sleep(500);
}
await call('https://rest.ensembl.org/info/data/?content-type=application/json', {}, `${CACHE}/ensembl/info_data.json`);
// NCBI esummary
const ids = genes.map(g => g.ncbi_gene).filter(Boolean);
i = 0;
for (const c of chunks(ids, 200)) {
  await call('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `db=gene&retmode=json&tool=delphi-omics&id=${c.join(',')}` }, `${CACHE}/ncbi/esummary_${i++}.json`);
  await sleep(400);
}
console.log('done', log.length, 'calls logged');

// Paralogues: Ensembl BioMart POST returned HTTP 405 (2026-11-01, release 116), so per-gene REST homology calls, 12 in flight; each call takes ~4 s server-side, so ~3 req/s
const paraFile = CACHE + "/ensembl/paralogues.jsonl";
const done = new Set(fs.existsSync(paraFile) ? fs.readFileSync(paraFile, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l).id) : []);
const todo = ens.filter(e => !done.has(e));
let nPara = 0;
async function worker() {
  while (todo.length) {
    const id = todo.shift();
    for (let k = 0; k < 4; k++) {
      const r = await fetch(`https://rest.ensembl.org/homology/id/danio_rerio/${id}?type=paralogues;format=condensed;content-type=application/json`);
      if (r.status === 429) { await sleep(Number(r.headers.get("retry-after") || 2) * 1000); continue; }
      const j = r.ok ? await r.json() : null;
      fs.appendFileSync(paraFile, JSON.stringify({ id, status: r.status, homologies: j?.data?.[0]?.homologies || [] }) + "\n");
      break;
    }
    if (++nPara % 500 === 0) console.log("paralogues", nPara);
    await sleep(450);
  }
}
log.push({ url: "https://rest.ensembl.org/homology/id/danio_rerio/{id}?type=paralogues;format=condensed", method: "GET x" + todo.length, time: new Date().toISOString(), out: "paralogues.jsonl" });
await Promise.all(Array.from({ length: 12 }, worker));
fs.writeFileSync(logFile, JSON.stringify(log, null, 1));
console.log("done");
