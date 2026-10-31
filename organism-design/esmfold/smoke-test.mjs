#!/usr/bin/env node
// Smoke test of one hosted ESMFold service (protein structure from sequence, no GPU on our side).
//   NVIDIA_API_KEY=... node organism-design/esmfold/smoke-test.mjs [--accession P02769] [--range 25-607]   (BioNeMo NIM)
//   node organism-design/esmfold/smoke-test.mjs --host esmatlas --accession P62894                          (Meta's public ESM Atlas, no key, <= 400 aa)
// The key is read from the environment only. It is never written to disk or to the output.
// Input: a UniProt record vendored under organism-design/esmfold/inputs/<accession>.json (fetched by this script if
// missing). Output: organism-design/esmfold/runs/<accession>/{result.json,predicted.pdb}. If the API refuses
// (no key, 401, quota), result.json records that and nothing is invented.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ACC = arg('accession', 'P02769');
const RANGE = arg('range', '');            // e.g. 25-607 for the mature chain
const HOST = arg('host', 'nvidia');
const HOSTS = {
  nvidia: { endpoint: 'https://health.api.nvidia.com/v1/biology/nvidia/esmfold', host: 'NVIDIA NIM (hosted BioNeMo)', docs: 'https://build.nvidia.com/meta/esmfold', max: 1024, key: true },
  esmatlas: { endpoint: 'https://api.esmatlas.com/foldSequence/v1/pdb/', host: 'ESM Atlas public API (Meta; not BioNeMo)', docs: 'https://esmatlas.com/about#api', max: 400, key: false }
};
const H = HOSTS[HOST]; if (!H) throw new Error('unknown host ' + HOST);
const ENDPOINT = H.endpoint;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

const inDir = path.join(here, 'inputs'); fs.mkdirSync(inDir, { recursive: true });
const recPath = path.join(inDir, ACC + '.json');
if (!fs.existsSync(recPath)) {
  const res = await fetch(`https://rest.uniprot.org/uniprotkb/${ACC}.json`);
  if (!res.ok) throw new Error('UniProt ' + res.status);
  fs.writeFileSync(recPath, await res.text());
}
const recBytes = fs.readFileSync(recPath);
const rec = JSON.parse(recBytes.toString('utf8'));
const full = rec.sequence.value;
let [a, b] = RANGE ? RANGE.split('-').map(Number) : [1, full.length];
const seq = full.slice(a - 1, b);
if (!/^[ARNDCQEGHILKMFPSTWYVXBOU]+$/.test(seq) || seq.length > H.max) throw new Error(`sequence not acceptable to ${HOST} (letters, or length ${seq.length} > ${H.max})`);

const outDir = path.join(here, 'runs', ACC + (HOST === 'nvidia' ? '' : '-' + HOST)); fs.mkdirSync(outDir, { recursive: true });
const result = {
  model: { name: 'ESMFold', host: H.host, host_key: HOST, endpoint: ENDPOINT, version_reported: null, docs: H.docs },
  input: {
    uniprot_accession: ACC, protein: rec.proteinDescription?.recommendedName?.fullName?.value || null, organism: rec.organism?.scientificName || null,
    organism_ncbi_taxid: rec.organism?.taxonId || null, uniprot_sequence_version: rec.entryAudit?.sequenceVersion ?? null,
    record_file: path.relative(path.resolve(here, '../..'), recPath).replace(/\\/g, '/'), record_sha256: sha(recBytes),
    residue_range: `${a}-${b}`, length: seq.length, sequence_sha256: sha(seq)
  },
  run: { started: new Date().toISOString(), status: null, http_status: null, note: null },
  output: null
};
const key = process.env.NVIDIA_API_KEY;
if (H.key && !key) {
  result.run.status = 'not-run'; result.run.note = 'NVIDIA_API_KEY is not set in the environment. Nothing was predicted.';
} else {
  try {
    const t0 = Date.now();
    const res = HOST === 'nvidia'
      ? await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: 'Bearer ' + key, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ sequence: seq }) })
      : await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: seq });
    result.run.http_status = res.status;
    result.run.seconds = +((Date.now() - t0) / 1000).toFixed(1);
    const text = await res.text();
    if (!res.ok) { result.run.status = 'refused'; result.run.note = 'API answered ' + res.status + ': ' + text.slice(0, 300); }
    else {
      let pdb = null;
      if (HOST === 'esmatlas') pdb = /^(HEADER|ATOM)/m.test(text) ? text : null;
      else { const j = JSON.parse(text); pdb = Array.isArray(j.pdbs) ? j.pdbs[0] : (j.pdb || null); }
      const j = {};
      if (!pdb) { result.run.status = 'unexpected-response'; result.run.note = 'No pdb field. Keys: ' + Object.keys(j).join(','); fs.writeFileSync(path.join(outDir, 'raw-response.json'), text); }
      else {
        fs.writeFileSync(path.join(outDir, 'predicted.pdb'), pdb);
        // ESMFold writes per-residue pLDDT (0-100) in the B-factor column of CA atoms.
        const ca = pdb.split('\n').filter(l => l.startsWith('ATOM') && l.slice(12, 16).trim() === 'CA');
        let plddt = ca.map(l => parseFloat(l.slice(60, 66)));
        // ESM Atlas writes pLDDT on a 0-1 scale in the B-factor column; the NIM uses 0-100. Report everything on 0-100.
        const scaled = Math.max(...plddt) <= 1.0; if (scaled) plddt = plddt.map(x => x * 100);
        const mean = plddt.reduce((s, x) => s + x, 0) / plddt.length;
        const frac = th => plddt.filter(x => x >= th).length / plddt.length;
        result.run.status = 'ok';
        const title = (pdb.match(/^TITLE\s+(.*)$/m) || [])[1];
        result.model.version_reported = res.headers.get('x-model-version') || res.headers.get('nvcf-model-version') || (title ? title.trim() + ' (PDB TITLE record)' : 'ESMFold V1 per model card; header not provided');
        result.output = { pdb_file: 'predicted.pdb', plddt_scale_in_file: scaled ? '0-1, multiplied by 100 here' : '0-100', pdb_sha256: sha(pdb), residues_modelled: ca.length, plddt_mean: +mean.toFixed(2), plddt_min: Math.min(...plddt), plddt_max: Math.max(...plddt), fraction_plddt_ge_70: +frac(70).toFixed(3), fraction_plddt_ge_90: +frac(90).toFixed(3), plddt_per_residue: plddt.map(x => +x.toFixed(1)) };
      }
    }
  } catch (e) { result.run.status = 'error'; result.run.note = String(e.message || e); }
}
result.run.finished = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 1));
console.log(`${ACC} ${result.input.residue_range} (${seq.length} aa): ${result.run.status}${result.output ? `, mean pLDDT ${result.output.plddt_mean}` : ''}${result.run.note ? ' - ' + result.run.note : ''}`);
