#!/usr/bin/env node
// Builds dashboard/public/graph.json: the project as one knowledge graph.
//
// Nodes: claims (by domain), data tests (ours and the collaborator swarm's), Lean theorems,
// datasets, taxa, the source sentence for Darwin's flying fish, and the flying-fish blueprint
// down to organ level. Every node carries its provenance: the file and, where it exists, the
// line, query id or checksum it came from. Nothing is drawn that a file does not say.
//   git fetch origin && node dashboard/build-graph.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const J = p => { try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch { return null; } };
const git = a => { try { return execSync(`git -C "${root}" ${a}`, { maxBuffer: 1 << 28 }).toString(); } catch { return ''; } };

const nodes = new Map(), links = [];
const add = (id, o) => { if (!nodes.has(id)) nodes.set(id, { id, ...o }); return nodes.get(id); };
const link = (source, target, rel) => { if (nodes.has(source) && nodes.has(target)) links.push({ source, target, rel }); };

const DOMAIN = t => /Darwin/.test(t) ? 'darwin' : /Thompson/.test(t) ? 'thompson' : /Wolfram/.test(t) ? 'wolfram' : 'mathbio';
const norm = v => { const s = String(v ?? '').toLowerCase(); return /^support/.test(s) ? 'supports' : /^refut/.test(s) ? 'refutes' : /mixed|partial/.test(s) ? 'mixed' : /inconclusive/.test(s) ? 'inconclusive' : s || 'unknown'; };

// ---- claims ----
const data = J('dashboard/public/data.json');
const claims = data?.claims || [];
const claimById = new Map(claims.map(c => [c.id, c]));
for (const c of claims) {
  add('claim:' + c.id, {
    type: 'claim', domain: DOMAIN(c.thinker || ''), label: c.label || c.id,
    info: { statement: c.statement, quote: c.quote, thinker: c.thinker, year: c.year, work: c.work, chapter: c.chapter, kind: c.kind, status: c.status },
    prov: { file: 'claim graph (dashboard/public/data.json, built from the TriG claim records)', nanopub: c.np || null, registry: c.registry || null },
    core: false
  });
}

// ---- data tests: this swarm (working tree) and the collaborator swarm (origin/main) ----
const tests = [];
const readTree = (ref) => {
  const files = ref === 'HEAD-WT'
    ? (function walk(d, acc = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (e.name === 'result.json') acc.push(path.relative(root, p).split(path.sep).join('/')); } return acc; })(path.join(root, 'claim-tests'))
    : git(`ls-tree -r --name-only ${ref}`).split(/\r?\n/).filter(l => /^claim-tests\/.+\/result\.json$/.test(l));
  for (const f of files) {
    let r = null;
    try { r = ref === 'HEAD-WT' ? JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) : JSON.parse(git(`show ${ref}:${f}`)); } catch { continue; }
    if (!r) continue;
    tests.push({ f, ref, r, swarm: ref === 'HEAD-WT' ? 'ours' : 'collaborator' });
  }
};
readTree('HEAD-WT');
readTree('origin/main');

const seen = new Set();
for (const { f, r, swarm } of tests) {
  const dir = f.replace(/\/result\.json$/, '');
  const key = swarm + ':' + dir;
  if (seen.has(key)) continue; seen.add(key);
  const cid = (r.claim_id || '').replace(/--.*$/, '');
  const tid = 'test:' + key;
  const faith = swarm === 'ours' ? J(dir + '/faithfulness.json') : null;
  add(tid, {
    type: 'test', domain: claimById.get(cid) ? DOMAIN(claimById.get(cid).thinker) : 'mathbio',
    label: `${norm(r.verdict)} — ${cid}`, verdict: norm(r.verdict), swarm,
    info: {
      hypothesis: r.hypothesis, pass: r.pass_criterion, verdict: norm(r.verdict),
      measured: r.measured ? { value: r.measured.value, unit: r.measured.unit, n: r.measured.n } : null,
      caveats: (r.caveats || []).slice(0, 4),
      faithfulness: faith ? { verdict: faith.verdict, model: faith.assessor?.model } : null
    },
    prov: { file: f, ref: swarm === 'ours' ? 'working tree / PR #36' : 'origin/main (collaborator swarm)' },
    core: true
  });
  if (claimById.has(cid)) { nodes.get('claim:' + cid).core = true; link('claim:' + cid, tid, 'tested by'); }
  for (const d of (r.datasets || [])) {
    const did = 'dataset:' + (d.id || d.name);
    add(did, {
      type: 'dataset', domain: 'none', label: d.id || d.name,
      info: { title: d.title || d.description || null, licence: d.license || d.licence || null },
      prov: { url: d.url || null, retrieved: d.retrieved_at || null, sha256: d.sha256 || null }, core: true
    });
    link(tid, did, 'uses');
  }
}

// ---- Lean theorems ----
const book = J('dashboard/public/claimbook.json');
for (const c of (book?.claims || [])) {
  const L = c.lean, thid = 'lean:' + L.theorem;
  add(thid, {
    type: 'theorem', domain: 'mathbio', label: L.theorem.replace(/^Delphi\./, ''),
    info: {
      english: L.named?.english || null, kernelChecked: L.proofScope?.kernelChecked || [], assumed: L.proofScope?.assumed || [],
      mutations: `${L.mutations.filter(m => m.outcome === 'rejected').length} of ${L.mutations.length} deliberate breakages rejected`,
      faithfulness: L.faithfulness
    },
    prov: { file: L.module, line: L.named?.line || null, browse: '../proofs/#' + c.claim_id }, core: true
  });
  if (claimById.has(c.claim_id)) { nodes.get('claim:' + c.claim_id).core = true; link('claim:' + c.claim_id, thid, 'formalised as'); }
}

// ---- the flying fish: source sentence, taxon, Lean budget, blueprint to organ level ----
const ff = J('organism-design/examples/a-flying-fish.json');
const bound = J('lean/bound/result.json');
add('source:darwin-flying-fish', {
  type: 'source', domain: 'darwin', label: 'Darwin, Origin ch. VI: flying-fish',
  info: { quote: 'it is conceivable that flying-fish, which now glide far through the air, slightly rising and turning by the aid of their fluttering fins, might have been modified into perfectly winged animals' },
  prov: { file: 'darwin-origin/inputs/pg1228.txt', line: '5639-5642' }, core: true
});
add('taxon:exocoetidae', {
  type: 'taxon', domain: 'none', label: 'Exocoetidae (flying fishes)',
  info: { gbif: 2968, ncbi: 76072, wikidata: 'Q183686', genome: 'GCA_018398805.1, Hirundichthys speculiger, scaffold level' },
  prov: { file: 'organisms/darwin-origin/ch05-06/taxa/exocoetidae.json' }, core: true
});
link('source:darwin-flying-fish', 'taxon:exocoetidae', 'names');
if (bound) {
  add('bound:exocoetidae', {
    type: 'theorem', domain: 'mathbio', label: 'substitution budget, Exocoetidae',
    info: { verdict: 'inconclusive', note: 'neutral budget 0.053-0.451 substitutions per site over 4.8e7-9.3e7 generations, independent of population size; does not bound adaptive substitutions from above' },
    prov: { file: 'lean/bound/result.json', theorem: 'lean/Delphi/Favored.lean' }, core: true
  });
  link('taxon:exocoetidae', 'bound:exocoetidae', 'bounded by');
  for (const n of nodes.values()) if (n.type === 'theorem' && /Favored/.test(n.id)) link(n.id, 'bound:exocoetidae', 'instantiated as');
}
if (ff) {
  const body = 'morph:' + ff.reading.taxon.term;
  add(body, {
    type: 'morph', scale: 'body', domain: 'none', label: 'blueprint: a flying fish',
    info: { counts: ff.counts_distinct || ff.counts, unread: ff.reading.words_not_recognised || [], note: 'An anatomy from ontology terms, not an organism. Nothing here is observed or measured.' },
    prov: { file: 'organism-design/examples/a-flying-fish.json', queries: Object.keys(ff.queries || {}).length + ' stored SPARQL queries' }, core: true
  });
  link('taxon:exocoetidae', body, 'designed as');
  if (nodes.has('bound:exocoetidae')) link('bound:exocoetidae', body, 'cites (not support)');
  const q = ff.queries || {};
  for (const n of ff.nodes || []) {
    if (!['organ_system', 'organ'].includes(n.level)) continue;   // tissues and cells are counted in the body node
    const nid = 'morph:' + n.id;
    const qq = q[n.via] || null;
    add(nid, {
      type: 'morph', scale: n.level, domain: 'none', label: n.label,
      info: { term: n.id, relation: n.relation, named: !!n.named_in_description, note: n.note || null },
      prov: { iri: n.iri, query: n.via || null, endpoint: qq?.endpoint || null, retrieved: qq?.retrieved || null },
      core: true
    });
  }
  for (const n of ff.nodes || []) {
    if (!['organ_system', 'organ'].includes(n.level)) continue;
    const parentId = n.parent ? 'morph:' + n.parent.split('/').pop() : null;
    link(parentId && nodes.has(parentId) ? parentId : body, 'morph:' + n.id, n.relation || 'part_of');
  }
}

// ---- taxa named by evidenced claims (keeps the graph legible) ----
const inv = J('dashboard/public/inventory.json');
for (const t of (inv?.taxa || [])) {
  const hits = (t.cl || []).filter(c => nodes.get('claim:' + c)?.core);
  if (!hits.length) continue;
  const tid = 'taxon:' + (t.id?.ncbi || t.n);
  add(tid, { type: 'taxon', domain: 'none', label: t.n, info: { rank: t.r, class: t.l?.c, genomes: t.g?.t ?? null }, prov: { gbif: t.id?.gbif || null, ncbi: t.id?.ncbi || null }, core: true });
  for (const c of hits) link('claim:' + c, tid, 'mentions');
}

const out = {
  builtAt: new Date().toISOString(),
  legend: {
    domains: { darwin: 'Darwin, evolution', thompson: 'Thompson, growth and form', wolfram: 'Wolfram, computation', mathbio: 'Mathematical biology (Fisher, Kimura, Hamilton, Maynard Smith, Turing)' },
    types: { claim: 'claim', test: 'data test', theorem: 'Lean theorem or bound', dataset: 'dataset', taxon: 'taxon', source: 'source sentence', morph: 'blueprint structure' }
  },
  counts: {
    nodes: nodes.size, links: links.length,
    byType: [...nodes.values()].reduce((a, n) => (a[n.type] = (a[n.type] || 0) + 1, a), {}),
    core: [...nodes.values()].filter(n => n.core).length
  },
  nodes: [...nodes.values()], links
};
fs.writeFileSync(path.join(here, 'public/graph.json'), JSON.stringify(out));
console.log(`graph.json: ${out.counts.nodes} nodes (${out.counts.core} in the evidenced core), ${out.counts.links} links`);
console.log('  by type:', JSON.stringify(out.counts.byType));
