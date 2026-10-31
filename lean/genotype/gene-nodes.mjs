#!/usr/bin/env node
// Gene -> nodes the map links it to (direct, non-derived links only), from genotype/fin-subtree.full.json, for the
// pleiotropy-closure check: an edit to a gene must change every node the map links the gene to, so the Studio may
// not show a "fin-only" change for a gene the map links beyond the fin.
//   node lean/genotype/gene-nodes.mjs -> lean/genotype/gene-nodes.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const file = 'genotype/fin-subtree.full.json';
const F = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const labels = {};
for (const [layer, L] of Object.entries(F.layers)) for (const n of L.nodes || []) labels[n.term] = { label: n.label, level: n.level, layer, in_blueprint: n.in_blueprint };
const byGene = {};
for (const [layer, L] of Object.entries(F.layers)) for (const l of L.links || []) {
  if (l.derived) continue;
  const g = byGene[l.symbol] ||= { symbol: l.symbol, gene: l.gene, organism: l.organism?.name, nodes: {} };
  const n = g.nodes[l.blueprint_node] ||= { term: l.blueprint_node, label: labels[l.blueprint_node]?.label || null, level: labels[l.blueprint_node]?.level || layer, linkTypes: new Set(), evidence: new Set() };
  n.linkTypes.add(l.link_type); n.evidence.add(l.evidence_kind);
}
const WANT = ['kcnk5b', 'slc43a2a', 'tbx5a', 'fgf10a', 'shha', 'hoxd13a', 'hoxd13b', 'wnt5b', 'fgf24', 'prrx1a', 'lef1', 'and1', 'and2'];
const out = { generated: new Date().toISOString(), tool: 'lean/genotype/gene-nodes.mjs', source: { file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), built: F.built },
  rule: 'direct (non-derived) links only; the set is what the sources record, so an absent node is unstudied, not gene-free; nodes are ZFA terms of the pectoral-fin subtree (zebrafish anatomy), joined to the blueprint by cross-reference', genes: {} };
for (const sym of WANT) { const g = byGene[sym]; if (!g) { out.genes[sym] = null; continue; } out.genes[sym] = { ...g, nodes: Object.values(g.nodes).map(n => ({ ...n, linkTypes: [...n.linkTypes], evidence: [...n.evidence] })).sort((a, b) => a.term.localeCompare(b.term)), nodeCount: Object.keys(g.nodes).length }; }
out.allGenes = Object.keys(byGene).length;
fs.writeFileSync(path.join(here, 'gene-nodes.json'), JSON.stringify(out, null, 1));
console.log(Object.entries(out.genes).map(([k, v]) => `${k}: ${v ? v.nodeCount + ' nodes (' + v.nodes.map(n => n.label).slice(0, 6).join('; ') + (v.nodeCount > 6 ? '; ...' : '') + ')' : 'absent'}`).join('\n'));
