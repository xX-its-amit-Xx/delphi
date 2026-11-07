#!/usr/bin/env node
// fetch-structures.mjs - populate the local structure cache the exposed-residue variant needs.
//
//   node benchmarks/retro-validation/fetch-structures.mjs [--force]
//
// Structures go to a cache OUTSIDE the repo (C:/Temp/delphi-struct-cache by default, override with
// DELPHI_STRUCT_CACHE). A few hundred kilobytes each; they are reproducible from the accession and do
// not belong in git.
//
// This file is the only one in the retro-validation set that touches the network, and it is separate
// from the predictors on purpose: a predictor that can fetch is a predictor that can be contaminated
// by a lookup between the prediction and the scoring.
//
// TWO THINGS THAT COST TIME AND ARE WORTH LEAVING WRITTEN DOWN:
//   1. EBI returns HTTP 403 to a request with no User-Agent. Node's fetch sends none. The symptom is
//      not an auth error, it is twenty-five accessions all reported as "no model available", which
//      looks exactly like a real absence. Send the header.
//   2. AlphaFold DB model file names carry a version (…-model_v6.pdb today, v4 a while ago). Build the
//      URL from the API's own pdbUrl field rather than from a guessed filename.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = process.env.DELPHI_STRUCT_CACHE || 'C:/Temp/delphi-struct-cache';
const FORCE = process.argv.includes('--force');
const UA = { 'User-Agent': 'delphisci-retro-validation/0.1 (research)' };

async function retry(fn, n = 3, waitMs = 1500) {
  let last;
  for (let i = 0; i < n; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise(s => setTimeout(s, waitMs * (i + 1))); }
  }
  throw last;
}

/** AlphaFold DB, by UniProt accession. Returns {pdb, url, version} or {absent: why}. */
export async function alphafold(acc) {
  const meta = await retry(async () => {
    const r = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${acc}`, { headers: UA, signal: AbortSignal.timeout(45000) });
    if (r.status === 404) return { absent: `AlphaFold DB has no entry for ${acc} (HTTP 404)` };
    if (!r.ok) throw new Error(`prediction API HTTP ${r.status}`);
    return { json: await r.json() };
  });
  if (meta.absent) return meta;
  const rec = meta.json?.[0];
  if (!rec?.pdbUrl) return { absent: `AlphaFold entry for ${acc} carries no pdbUrl` };
  const pdb = await retry(async () => {
    const r = await fetch(rec.pdbUrl, { headers: UA, signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw new Error(`model file HTTP ${r.status}${r.status === 403 ? ' (send a User-Agent)' : ''}`);
    return r.text();
  });
  return { pdb, url: rec.pdbUrl, version: rec.latestVersion ?? null, plddt: rec.globalMetricValue ?? null };
}

/** Public ESMFold, for accessions AlphaFold DB has no model for. A DIFFERENT model source: label it. */
export async function esmfold(seq) {
  return retry(async () => {
    const r = await fetch('https://api.esmatlas.com/foldSequence/v1/pdb/', {
      method: 'POST', headers: { ...UA, 'content-type': 'text/plain' }, body: seq, signal: AbortSignal.timeout(180000),
    });
    if (!r.ok) throw new Error(`ESMFold HTTP ${r.status}`);
    const t = await r.text();
    if (!t.includes('ATOM')) throw new Error('ESMFold returned no ATOM records');
    return t;
  }, 4, 6000);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('fetch-structures.mjs')) {
  const MB = await import('./data/myoglobin.mjs');
  const S = await import('./structure.mjs');
  fs.mkdirSync(CACHE, { recursive: true });
  const log = [];
  for (const r of MB.ROWS) {
    const acc = r.uniprot.accession;
    const gate = S.sequenceIsUsable(r.sequence);
    if (!gate.usable) { log.push({ acc, latin: r.latin, skipped: `sequence gate: ${gate.why}` }); continue; }
    const af = path.join(CACHE, `AF-${acc}.pdb`), esm = path.join(CACHE, `esmfold-${acc}.pdb`);
    if (!FORCE && (fs.existsSync(af) || fs.existsSync(esm))) { log.push({ acc, latin: r.latin, cached: true }); continue; }
    let res;
    try { res = await alphafold(acc); } catch (e) { res = { absent: `AlphaFold fetch failed: ${e.message}` }; }
    if (res.pdb) {
      fs.writeFileSync(af, res.pdb);
      const seqFromStruct = S.structureSequence(S.residueSasa(S.parsePDB(res.pdb), { points: 16 }));
      log.push({ acc, latin: r.latin, source: 'AlphaFold DB', version: res.version, plddt: res.plddt, seq_matches: seqFromStruct === r.sequence });
      console.log(`AF   ${acc.padEnd(11)}${r.latin.padEnd(31)}v${res.version} pLDDT ${res.plddt} seq match ${seqFromStruct === r.sequence}`);
      continue;
    }
    try {
      const pdb = await esmfold(r.sequence);
      fs.writeFileSync(esm, pdb);
      const seqFromStruct = S.structureSequence(S.residueSasa(S.parsePDB(pdb), { points: 16 }));
      log.push({ acc, latin: r.latin, source: 'ESMFold', why_not_alphafold: res.absent, seq_matches: seqFromStruct === r.sequence });
      console.log(`ESM  ${acc.padEnd(11)}${r.latin.padEnd(31)}(${res.absent}) seq match ${seqFromStruct === r.sequence}`);
    } catch (e) {
      log.push({ acc, latin: r.latin, failed: `${res.absent}; ESMFold also failed: ${e.message}` });
      console.log(`MISS ${acc.padEnd(11)}${r.latin.padEnd(31)}${res.absent}; ESMFold: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(CACHE, 'manifest.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), cache: CACHE, log }, null, 1));
  const n = (k) => log.filter(l => l.source === k).length;
  console.log(`\n${log.length} rows: ${n('AlphaFold DB')} from AlphaFold DB, ${n('ESMFold')} folded with ESMFold, ${log.filter(l => l.cached).length} already cached, ${log.filter(l => l.failed).length} unavailable, ${log.filter(l => l.skipped).length} skipped by the sequence gate`);
  const mismatched = log.filter(l => l.seq_matches === false);
  if (mismatched.length) console.log(`WARNING: ${mismatched.length} structure(s) whose residue sequence does NOT match the UniProt sequence: ${mismatched.map(m => m.acc).join(', ')}`);
  console.log(`cache: ${CACHE}`);
}
