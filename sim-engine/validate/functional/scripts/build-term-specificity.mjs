#!/usr/bin/env node
// Build functional/data/term-specificity.json: how many genes of the annotated universe carry each pathway / GO /
// Reactome term. The ANALOGOUS_SET class needs this, because "both proteins are in the membrane" is shared by 760
// of 3,856 genes and licenses nothing; a term carried by a handful of genes is real evidence that two genes act in
// the same specific process. The rule is therefore a measured specificity, not a hand-written blocklist.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const txt = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'omics', 'pathway', 'annotations.jsonl.gz'))).toString('utf8');
const FEATURES = ['go_process', 'go_function', 'go_component', 'pathway_member', 'reaction'];
const m = new Map(); const universe = new Set(); let rows = 0;
for (const line of txt.split('\n')) {
  if (!line.trim()) continue;
  let r; try { r = JSON.parse(line); } catch { continue; }
  rows++;
  const gene = r.gene?.zfin_id || r.gene?.symbol; if (gene) universe.add(gene);
  if (!FEATURES.includes(r.feature)) continue;
  const id = r.source?.accession || r.value;
  const k = `${r.feature}|${id}`;
  if (!m.has(k)) m.set(k, { feature: r.feature, term: String(r.value), id: r.source?.accession || null, genes: new Set() });
  m.get(k).genes.add(gene);
}
// Stored as a flat {"<feature>|<id>": n_genes} map: the term's label and feature already come from the gene
// card, so repeating them here only costs repo space (the project keeps files under ~1 MB).
const by_term = {};
for (const [k, v] of m) by_term[k] = v.genes.size;
fs.writeFileSync(path.join(HERE, '..', 'data', 'term-specificity.json'), JSON.stringify({
  title: 'How many genes of the annotated universe carry each pathway / GO / Reactome term',
  built: new Date().toISOString(), tool: 'sim-engine/validate/functional/scripts/build-term-specificity.mjs',
  source: 'omics/pathway/annotations.jsonl.gz (the omics pathway layer, 97k rows, GO + Reactome + WikiPathways + KEGG crosswalk)',
  format: 'by_term maps "<feature>|<accession or value>" to the number of genes in the annotated universe carrying that term',
  rows_read: rows, genes_with_pathway_rows: universe.size, terms: Object.keys(by_term).length, by_term,
}));
console.log(`${Object.keys(by_term).length} terms over ${universe.size} genes`);
