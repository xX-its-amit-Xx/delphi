#!/usr/bin/env node
// Slims the real claim graph down to what the swarm-expansion beat draws, so that beat animates
// this repository's actual literature tree and not a decorative one. Reads dashboard/public/graph.json
// (1,245 nodes / 387 links) and writes pitch-video/tree.json: the per-domain node counts, a sample of
// real labels to surface during the expansion, and the real link endpoints reduced to indices.
//
//   node dashboard/public/pitch-video/build-tree.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..');
const g = JSON.parse(fs.readFileSync(path.join(pub, 'graph.json'), 'utf8'));

const DOMAIN_ORDER = ['darwin', 'thompson', 'wolfram', 'mathbio', 'none'];
const DOMAIN_LABEL = { darwin: 'Darwin', thompson: 'Thompson', wolfram: 'Wolfram', mathbio: 'mathematical biology', none: 'the project itself' };

// Keep every node, but only the three fields the canvas needs.
const nodes = g.nodes.map(n => ({
  d: DOMAIN_ORDER.indexOf(n.domain || 'none'),
  t: n.type,
  c: n.core ? 1 : 0
}));
const index = new Map(g.nodes.map((n, i) => [n.id, i]));
const links = g.links.map(l => [index.get(l.source), index.get(l.target)]).filter(p => p[0] != null && p[1] != null);

// Real labels to flash during the expansion, spread evenly through each kind so the sample is not
// just the first few rows of the file.
const pick = (type, n) => {
  const pool = g.nodes.filter(x => x.type === type && x.label && x.label.length > 16);
  const step = Math.max(1, Math.floor(pool.length / n));
  return pool.filter((_, i) => i % step === 0).slice(0, n)
    .map(x => ({ t: type, d: DOMAIN_ORDER.indexOf(x.domain || 'none'),
                 l: x.label.length > 92 ? x.label.slice(0, 90) + '…' : x.label }));
};

const out = {
  _about: 'Written by pitch-video/build-tree.mjs from dashboard/public/graph.json. Every count and every link here is in that file; nothing is generated.',
  built: new Date().toISOString(),
  source: 'dashboard/public/graph.json',
  counts: g.counts,
  byDomain: DOMAIN_ORDER.map((d, i) => ({ key: d, label: DOMAIN_LABEL[d], n: nodes.filter(n => n.d === i).length })),
  nodes, links,
  labels: [...pick('theorem', 9), ...pick('test', 6), ...pick('problem', 5), ...pick('claim', 10)]
};
fs.writeFileSync(path.join(here, 'tree.json'), JSON.stringify(out));
const kb = Math.round(fs.statSync(path.join(here, 'tree.json')).size / 1024);
console.log(`tree.json  ${kb} KB  ${nodes.length} nodes, ${links.length} links, ${out.labels.length} labels`);
console.log(out.byDomain.map(d => `  ${String(d.n).padStart(4)}  ${d.label}`).join('\n'));
