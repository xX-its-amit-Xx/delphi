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
import crypto from 'node:crypto';

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


// ---- open problems -> candidates -> the constraint that ruled on them (lean/eliminate ledger) ----
const ledger = J('lean/eliminate/ledger.open-problems.json');
const constraints = J('lean/constraints.json');
const cons = new Map(((constraints && (constraints.constraints || constraints)) || []).map(c => [c.id, c]));
for (const row of (ledger?.ledger || [])) {
  const pid = 'problem:' + (row.meta?.problem_id || row.id.split('/')[0]);
  add(pid, {
    type: 'problem', domain: 'none', label: String(row.problem || '').slice(0, 90),
    info: { statement: row.problem, source: row.meta?.problem_source || row.source || null },
    prov: { file: 'open-problems/problems.json', id: row.meta?.problem_id || null, retrieved: row.meta?.retrieved || null },
    core: true, ledger: true
  });
  const cid = 'cand:' + row.id;
  add(cid, {
    type: 'candidate', domain: 'none', label: String(row.description || row.id).slice(0, 90),
    verdict: /^eliminated/.test(row.verdict) ? 'eliminated' : /^consistent/.test(row.verdict) ? 'consistent' : 'cannot-rule', ledger: true, core: true,
    info: {
      statement: row.description, verdictLong: row.verdict, provenance: row.provenance,
      illustrative: !!row.uses_illustrative_values, caveat: row.eliminationCaveat || null,
      commits: row.commits || null, untranslatable: row.untranslatable || null,
      notFormalised: row.notFormalised || [],
      results: (row.results || []).map(r => ({ constraint: r.constraint, state: r.state, lemma: r.lemma, relation: r.relation, faithfulness: r.faithfulness, reason: r.reason, code: r.reasonCode }))
    },
    prov: { file: 'open-problems/candidates.formal.json', ledger: 'lean/eliminate/ledger.open-problems.json', certificates: 'lean/Delphi/Certificates/EliminationsOpenProblems.lean' }
  });
  link(pid, cid, 'candidate answer');
  for (const r of (row.results || [])) {
    const k = r.constraint;
    const st = /^eliminated/.test(r.state || '') ? 'eliminated' : /^consistent/.test(r.state || '') ? 'consistent' : null;
    if (!k || !st) continue;   // cannot-rule stays in the panel, with its reason code
    const kid = 'constraint:' + k, c = cons.get(k) || {};
    add(kid, {
      type: 'theorem', domain: 'mathbio', label: `${k}: ${String(c.property || c.name || '').slice(0, 60)}`,
      info: { english: c.property || null, relation: r.relation, mutations: null, faithfulness: r.faithfulness || c.faithfulness || null,
              kernelChecked: c.proofScope?.kernelChecked || [], assumed: c.proofScope?.assumed || [] },
      prov: { file: 'lean/constraints.json', lemma: r.lemma || c.lemma || null, theorem: c.theorem || null, module: 'lean/Delphi/Constraints.lean' },
      core: true, ledger: true
    });
    link(cid, kid, st === 'eliminated' ? 'eliminated by' : 'consistent with');
  }
}


// ---- the formal spine: every constraint -> the claim it came from; open problems clustered by claim ----
// Strong link: a theorem actually ruled on a candidate of the problem (eliminated or consistent).
// Weak link: the enumerator tagged the candidate as checkable against that theorem but no theorem
// could rule. The two are drawn and labelled differently.
const SLUG = { 'square-cube': 'C7', 'kimura-neutral-rate': 'C1', 'twofold-cost-of-sex': 'C5',
  'blueprint-well-formedness': 'C6', 'neutral-substitution-budget': 'C3b',
  'neutral-fixation-probability': 'C2', 'fisher-fundamental-theorem-haploid': 'C4' };
for (const [k, c] of cons) {
  const kid = 'constraint:' + k;
  add(kid, {
    type: 'theorem', domain: 'mathbio', label: `${k}: ${String(c.property || c.label || '').slice(0, 60)}`,
    info: { english: c.property || null, relation: c.relation || null, faithfulness: c.faithfulness || null,
            kernelChecked: c.proofScope?.kernelChecked || [], assumed: c.proofScope?.assumed || [] },
    prov: { file: 'lean/constraints.json', lemma: c.lemma || null, module: c.module || 'lean/Delphi/Constraints.lean' },
    core: true, ledger: true
  });
  nodes.get(kid).formal = true;
  const clid = 'claim:' + c.claim_id;
  if (!nodes.has(clid)) add(clid, {
    type: 'claim', domain: 'mathbio', label: c.claim_id,
    info: { statement: c.property, status: 'derived here, not extracted from a source' },
    prov: { file: 'lean/constraints.json', note: 'a statement derived by the Lean thread, not a claim from the extracted corpus' },
    core: true
  });
  nodes.get(clid).formal = true;
  link(kid, clid, 'constraint from');
}
for (const n of nodes.values()) if (n.type === 'theorem') n.formal = true;
for (const l of links) {
  const a = nodes.get(l.source), b = nodes.get(l.target);
  if (l.rel === 'formalised as' && a) a.formal = true;
}
const candSrc = J('open-problems/candidates.json');
for (const c of ((candSrc && (candSrc.candidates || candSrc)) || [])) {
  const cid = 'cand:' + c.id;
  if (!nodes.has(cid)) continue;
  nodes.get(cid).formal = true;
  const pid = 'problem:' + c.problem_id;
  if (nodes.has(pid)) nodes.get(pid).formal = true;
  const ruled = new Set(links.filter(l => l.source === cid && /^(eliminated by|consistent with)$/.test(l.rel)).map(l => l.target));
  for (const slug of (c.checkable_against || [])) {
    const k = SLUG[slug]; if (!k) continue;
    const kid = 'constraint:' + k;
    if (!ruled.has(kid)) link(cid, kid, 'tagged relevant (no ruling)');
  }
}


// ---- ideas: every idea or choice adopted in the project, with its origin (decisions/ideas.json) ----
// Origin is a status-like distinction (researched / reach-synthesis / serendipitous), carried as a glyph
// and a text label, never a hue. An idea links to the nodes whose provenance file sits under a path it
// affects; where nothing matches, or too much does, it links to an area node named after the path.
const ideasFile = J('decisions/ideas.json');
// a path prefix, with '*' standing for one path segment and a trailing '/' meaning "this folder"
const globToRe = g => {
  const esc = x => x.replace(/[.+^${}()|[\]\\]/g, m => '\\' + m);
  const body = g.replace(/\/$/, '').split('*').map(esc).join('[^/]*');
  return new RegExp('^' + body + (g.endsWith('/') ? '(/|$)' : '$'));
};
const AREA_CAP = 20;
for (const it of (ideasFile?.ideas || [])) {
  const iid = 'idea:' + it.id;
  add(iid, {
    type: 'idea', domain: 'none', origin: it.origin, status: it.status || null, core: false, idea: true,
    label: String(it.idea || it.id).slice(0, 90),
    info: { statement: it.idea, origin: it.origin, status: it.status || null, sources: it.sources || [], research: it.research || null,
            evidence: it.evidence || null, alternatives_rejected: it.alternatives_rejected || null, affects: it.affects || [], decided: it.decided || null, claimed: it.claimed || null },
    prov: { file: 'decisions/ideas.json', id: it.id, evidence: it.evidence || null, research_run: it.research?.run || null }
  });
  for (const a of (it.affects || [])) {
    const re = globToRe(a);
    const hits = [...nodes.values()].filter(n => n.type !== 'idea' && n.type !== 'area' && [n.prov?.file, n.prov?.ledger].some(v => v && re.test(String(v))));
    if (hits.length && hits.length <= AREA_CAP) { for (const h of hits) link(iid, h.id, 'affects'); continue; }
    const aid = 'area:' + a;
    add(aid, { type: 'area', domain: 'none', label: a, core: false, idea: true,
      info: { note: hits.length ? `${hits.length} graph nodes carry provenance under this path; too many to draw one edge each.` : 'No node in this graph carries provenance under this path; the idea affects files the graph does not draw.', nodes_under_path: hits.length },
      prov: { file: 'decisions/ideas.json', path: a } });
    nodes.get(aid).idea = true;
    link(iid, aid, hits.length ? 'affects (area)' : 'affects (no node drawn)');
  }
}
for (const l of links) if (l.rel === 'affects') { const t = nodes.get(l.target); if (t) t.idea = true; }
const ideaCounts = [...nodes.values()].filter(n => n.type === 'idea').reduce((a, n) => (a[n.origin] = (a[n.origin] || 0) + 1, a), {});

const out = {
  builtAt: new Date().toISOString(),
  legend: {
    domains: { darwin: 'Darwin, evolution', thompson: 'Thompson, growth and form', wolfram: 'Wolfram, computation', mathbio: 'Mathematical biology (Fisher, Kimura, Hamilton, Maynard Smith, Turing)' },
    types: { problem: 'open problem', candidate: 'candidate answer', claim: 'claim', test: 'data test', theorem: 'Lean theorem or bound', dataset: 'dataset', taxon: 'taxon', source: 'source sentence', morph: 'blueprint structure', idea: 'idea or choice', area: 'repo area an idea affects' },
    origins: { researched: 'researched: survived a logged prior-art search', 'reach-synthesis': 'reach-synthesis: synthesised from other sources, not yet checked against prior art', serendipitous: 'serendipitous: arose by accident' }
  },
  counts: {
    nodes: nodes.size, links: links.length,
    byType: [...nodes.values()].reduce((a, n) => (a[n.type] = (a[n.type] || 0) + 1, a), {}),
    core: [...nodes.values()].filter(n => n.core).length,
    ideasByOrigin: ideaCounts, ideasNote: ideasFile?.note || null
  },
  nodes: [...nodes.values()], links
};
fs.writeFileSync(path.join(here, 'public/graph.json'), JSON.stringify(out));
console.log(`graph.json: ${out.counts.nodes} nodes (${out.counts.core} in the evidenced core), ${out.counts.links} links`);
console.log('  by type:', JSON.stringify(out.counts.byType));


// ======================================================================================
// ---- blueprint3d/data.json: the flying-fish blueprint for the 3D view (viz thread) ----
// Every number here is read from organism-design/examples/a-flying-fish.json, the Lean
// certificate in dashboard/public/t/lean/lean.json, and (when it exists) genotype/map.json.
// Distinct terms are drawn once; every placement (part_of edge) is kept as an edge.
// ======================================================================================
{
  const bpPath = 'organism-design/examples/a-flying-fish.json';
  const bp = J(bpPath);
  const lean = J('dashboard/public/t/lean/lean.json');
  if (bp) {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, bpPath))).digest('hex');
    const cert = (lean?.blueprintCertificates || []).find(c => c.name === 'a-flying-fish') || null;
    const byIri = new Map((bp.nodes || []).map(n => [n.iri, n.id]));
    const iriId = s => byIri.get(s) || String(s || '').split('/').pop();
    const terms = new Map(), edges = [];
    const KEEP = ['major_organ', 'named_in_description', 'taxon_evidence', 'taxon_evidence_query', 'stated_in_taxon', 'cell_types_recorded', 'organs_available_in_system', 'tissues_available_in_organ', 'cell_types_available_in_organ', 'added_because', 'taxon', 'taxon_label'];
    for (const n of bp.nodes || []) {
      const t = terms.get(n.id) || { id: n.id, iri: n.iri, label: n.label, level: n.level, ontology: n.ontology, via: n.via || null, parents: [], placements: 0 };
      t.placements++;
      for (const k of KEEP) if (n[k] !== undefined && t[k] === undefined) t[k] = n[k];
      if (n.parent) {
        const p = iriId(n.parent);
        t.parents.push({ id: p, relation: n.relation, via: n.via || null });
        edges.push({ part: n.id, whole: p, relation: n.relation, via: n.via || null });
      }
      terms.set(n.id, t);
    }
    const byLevel = {};
    for (const t of terms.values()) byLevel[t.level] = (byLevel[t.level] || 0) + 1;
    // Does any Lean theorem, lemma, formalised claim or constraint mention a term of this blueprint? Counted, not assumed.
    const leanText = JSON.stringify([lean?.theorems, lean?.lemmas, lean?.formalized, lean?.constraints]);
    const bioMentioned = [...terms.keys()].filter(id => /^(UBERON|CL)_\d+$/.test(id) && leanText.includes(id));

    // genotype map: optional, written by the genotype thread. Tolerant of a few plausible shapes;
    // links whose node is not a term of this blueprint are dropped and counted.
    const gmRaw = J('genotype/map.json');
    let genotype = null;
    if (gmRaw) {
      genotype = { file: 'genotype/map.json', raw_keys: Array.isArray(gmRaw) ? ['<array>'] : Object.keys(gmRaw), note: gmRaw.note || gmRaw.caveat || gmRaw.honesty || null, built: gmRaw.built || gmRaw.generated || null, links: [], dropped_unknown_node: 0 };
      const arr = Array.isArray(gmRaw) ? gmRaw : (gmRaw.links || gmRaw.map || gmRaw.edges || gmRaw.nodes || []);
      const rows = Array.isArray(arr) ? arr : Object.entries(arr).flatMap(([node, v]) => (Array.isArray(v) ? v : (v.genes || [])).map(g => ({ node, ...(typeof g === 'string' ? { gene: g } : g) })));
      for (const r of rows) {
        const node = iriId(r.node || r.blueprint_node || r.term || r.iri || r.uberon || r.cl || '');
        const gs = Array.isArray(r.genes) ? r.genes : [r];
        for (const g of gs) {
          const L = { node, gene: g.gene || g.symbol || g.name || g.id || null, gene_id: g.gene_id || g.ensembl || g.zfin || g.ncbi_gene || null,
            link: g.link || g.type || g.relation || r.link || r.type || r.relation || null,
            organism: g.organism || g.source_organism || g.species || r.organism || r.source_organism || r.species || null,
            source: g.source || g.evidence || r.source || null, retrieved: g.retrieved || r.retrieved || null };
          if (terms.has(node)) genotype.links.push(L); else genotype.dropped_unknown_node++;
        }
      }
      genotype.nodes_with_genes = new Set(genotype.links.map(l => l.node)).size;
      genotype.organisms = [...new Set(genotype.links.map(l => l.organism).filter(Boolean))];
      genotype.link_types = genotype.links.reduce((a, l) => (a[l.link || 'untyped'] = (a[l.link || 'untyped'] || 0) + 1, a), {});
    }
    const out3d = {
      builtAt: new Date().toISOString(),
      source: { file: bpPath, built: bp.built, tool: bp.tool, sha256: sha },
      description: bp.input?.description || null,
      taxon: bp.reading?.taxon || null,
      reading: { anatomy_words: bp.reading?.anatomy_words || [], anatomy_words_subsumed: bp.reading?.anatomy_words_subsumed || [], words_not_recognised: bp.reading?.words_not_recognised || [], conflicts: bp.reading?.conflicts || [] },
      holdout: bp.holdout || null,
      counts_distinct: bp.counts_distinct || null, counts_placements: bp.counts || null, counts_note: bp.counts_note || null,
      counts_computed_here: { distinct_terms: terms.size, edges: edges.length, byLevel },
      limits: bp.limits || null,
      pruning: bp.pruning ? { note: bp.pruning.note, totals: bp.pruning.totals, organs_cut: (bp.pruning.organs || []).length,
        tissues_per_organ: (bp.pruning.tissues_per_organ || []).map(x => ({ parent: iriId(x.parent), kept: x.kept, available: x.available, omitted: x.omitted })),
        cells_per_organ: (bp.pruning.cells_per_organ || []).map(x => ({ parent: iriId(x.parent), kept: x.kept, available: x.available, omitted: x.omitted })) } : null,
      honesty: bp.honesty || [],
      genome_sketch: bp.genome_sketch ? { label: bp.genome_sketch.label, note: bp.genome_sketch.note, cells_with_markers: bp.genome_sketch.cells_with_markers, cells_total: bp.genome_sketch.cells_total, via: bp.genome_sketch.via,
        markers: (bp.genome_sketch.markers || []).map(m => ({ cell: iriId(m.cell), cell_label: m.cell_label, gene_products: m.gene_products })) } : null,
      queries: Object.fromEntries(Object.entries(bp.queries || {}).map(([k, q]) => [k, { purpose: q.purpose, endpoint: q.endpoint, sparql: q.sparql, retrieved: q.retrieved, rows: q.rows, cached: q.cached }])),
      terms: [...terms.values()], edges,
      certificate: cert ? {
        file: 'dashboard/public/t/lean/lean.json', key: 'blueprintCertificates[0]', generated: cert.generated, tool: cert.tool, leanModule: cert.leanModule, theory: cert.theory,
        blueprint_sha256: cert.blueprint?.sha256 || null, matches_file_now: (cert.blueprint?.sha256 || null) === sha, current: cert.current, verified: cert.verified,
        theorems: cert.theorems, audit: cert.audit, compile: cert.compile, graph: cert.graph, taxonData: cert.taxonData,
        kernelChecked: cert.kernelChecked || [], assumed: cert.assumed || [],
        covers_note: 'The certificate is about the whole graph: acyclicity, rootedness, taxon consistency and the per-level counts are properties of the node set and the edge set together, so every node is inside its scope.',
        biological_statements: { nodes_mentioned_in_any_lean_statement: bioMentioned.length, nodes_mentioned: bioMentioned,
          checked_against: 'every theorem, lemma, formalised claim and constraint listed in dashboard/public/t/lean/lean.json, searched for this blueprint\'s term ids' }
      } : null,
      genotype
    };
    const dir = path.join(here, 'public/blueprint3d'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(out3d));
    console.log(`blueprint3d/data.json: ${terms.size} distinct terms, ${edges.length} edges, byLevel ${JSON.stringify(byLevel)}; certificate ${cert ? (out3d.certificate.matches_file_now ? 'matches the file' : 'STALE: hash differs') : 'missing'}; lean statements mentioning a term: ${bioMentioned.length}; genotype ${genotype ? genotype.links.length + ' links' : 'map.json not present'}`);
  } else console.log('blueprint3d: organism-design/examples/a-flying-fish.json not found; nothing written');
}
