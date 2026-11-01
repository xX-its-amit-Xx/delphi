#!/usr/bin/env node
// Measure the known coverage gaps instead of asserting them, and write the numbers to coverage-gaps.json for the
// sweep to quote. Full pass over the five omics layers; counts rows by species and by anatomy context, so the
// sweep's "what is unknown" lines carry figures that came from the bytes rather than from a sentence someone
// wrote once. Re-run it when a layer is rebuilt:  node sim-engine/validate/pipeline/scan-gaps.mjs
//
// Reads omics/<layer>/annotations.jsonl.gz only. Writes one file, in this folder. Does not touch omics/.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '../../..');
const LAYERS = ['genomic', 'transcriptomic', 'proteomic', 'pathway', 'ptm'];
const FIN = /\bfin\b|\bfin\s|pectoral|caudal|pelvic|dorsal fin|anal fin/i;
const AVES = /\b(aves|gallus|taeniopygia|columba|passer|anas|meleagris|coturnix)\b/i;

const out = { built: new Date().toISOString(), tool: 'sim-engine/validate/pipeline/scan-gaps.mjs',
  what: 'Row counts by species and by anatomy context for each omics layer, so the multi-scale sweep can report measured coverage gaps rather than remembered ones.', layers: {} };

for (const layer of LAYERS) {
  const f = path.join(ROOT, 'omics', layer, 'annotations.jsonl.gz');
  if (!fs.existsSync(f)) { out.layers[layer] = { present: false }; continue; }
  const species = {}, kinds = {}, finAnat = {}, L = { present: true, rows: 0, rows_with_anatomy: 0, rows_with_stage: 0, rows_with_fin_anatomy: 0, rows_with_pectoral_fin_anatomy: 0, aves_rows: 0 };
  const rl = readline.createInterface({ input: fs.createReadStream(f).pipe(zlib.createGunzip()) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    L.rows++;
    species[r.species] = (species[r.species] || 0) + 1;
    if (r.kind) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    if (AVES.test(String(r.species))) L.aves_rows++;
    const a = r.context?.anatomy;
    if (a) { L.rows_with_anatomy++; const lab = a.label || a.id || ''; if (FIN.test(lab)) { L.rows_with_fin_anatomy++; finAnat[lab] = (finAnat[lab] || 0) + 1; if (/pectoral/i.test(lab)) L.rows_with_pectoral_fin_anatomy++; } }
    if (r.context?.stage) L.rows_with_stage++;
  }
  L.by_species = Object.fromEntries(Object.entries(species).sort((a, b) => b[1] - a[1]));
  L.by_kind = Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]));
  L.fin_anatomy_labels = Object.fromEntries(Object.entries(finAnat).sort((a, b) => b[1] - a[1]));
  L.exocoetid_rows = Object.entries(species).filter(([s]) => /hirundichthys|exocoet|cheilopogon|cypselurus|parexocoetus|prognichthys|fodiator|oxyporhamphus/i.test(s)).reduce((o, [s, n]) => (o[s] = n, o), {});
  L.hirundichthys_rows = Object.entries(species).filter(([s]) => /hirundichthys/i.test(s)).reduce((a, [, n]) => a + n, 0);
  out.layers[layer] = L;
  process.stderr.write(`${layer}: ${L.rows} rows, ${Object.keys(species).length} species, fin-anatomy rows ${L.rows_with_fin_anatomy} (pectoral ${L.rows_with_pectoral_fin_anatomy}), Hirundichthys ${L.hirundichthys_rows}, Aves ${L.aves_rows}\n`);
}

fs.writeFileSync(path.join(HERE, 'coverage-gaps.json'), JSON.stringify(out, null, 1));
process.stderr.write(`wrote ${path.join(HERE, 'coverage-gaps.json')}\n`);
