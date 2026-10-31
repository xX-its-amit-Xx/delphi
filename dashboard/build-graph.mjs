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
// rulings per constraint from lean/constraints.json: how many open-problem candidates each theorem reached,
// and, where it reached none, the Lean thread's stated reason (shown as "unreached: <reason>" on the node)
for (const [k, c] of cons) {
  const n = nodes.get('constraint:' + k); if (!n) continue;
  const r = c.openProblemRulings || null;
  n.info.rulings = r;
  n.info.whyNoCandidate = c.whyNoCandidate || null;
  n.unreached = !!(r && r.reached === 0);
  if (n.unreached) n.unreachedWhy = c.whyNoCandidate || 'no candidate reached this constraint (no reason given in the file)';
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

    // genotype map, written by the genotype thread (genotype/map.json, organised by layer). Term ids there
    // use 'UBERON:0000151'; the blueprint uses 'UBERON_0000151'. Per node we keep the counts of direct and
    // derived genes by link type, and a capped list of the stored direct links (required/sufficient first).
    // Every gene link was measured in a proxy species (zebrafish, medaka); none is flying-fish data.
    // GATE (hub, 2026-10-31): the map is drawn only when the genotype thread marks it vetted, either as a separate
    // slimmed genotype/map.vetted.json or as a top-level "vetted": true in genotype/map.json. Until then the page
    // says the file exists and why nothing is drawn. Only the per-node summary below ever reaches the browser.
    // Lookup order: the committed slim vetted map first, then the full vetted map, then map.json only if it says vetted.
    // Test fixtures never go under genotype/ (that folder belongs to the Genotype thread): VIZ_GENOTYPE_MAP=<absolute path>
    // points the builder at a fixture kept under C:/Temp instead, for local previews only.
    const noMap = process.env.VIZ_TEST_NO_MAP === '1';
    const fixture = process.env.VIZ_GENOTYPE_MAP ? (() => { try { return JSON.parse(fs.readFileSync(process.env.VIZ_GENOTYPE_MAP, 'utf8')); } catch { return null; } })() : null;
    const gmSlim = fixture || (noMap ? null : J('genotype/map.vetted.slim.json'));
    const gmVetted = gmSlim || noMap ? null : J('genotype/map.vetted.json');
    const gmFull = gmSlim || gmVetted || noMap ? null : J('genotype/map.json');
    // VIZ_UNGATED_TEST=1 lets the viz thread preview the renderer locally; never deploy a build made with it.
    const gmRaw = gmSlim || gmVetted || (gmFull && (gmFull.vetted === true || process.env.VIZ_UNGATED_TEST === '1') ? gmFull : null);
    const gmSource = fixture ? `TEST FIXTURE ${process.env.VIZ_GENOTYPE_MAP} (never deploy)` : gmSlim ? 'genotype/map.vetted.slim.json' : gmVetted ? 'genotype/map.vetted.json' : 'genotype/map.json';
    let genotype = null;
    if (!gmRaw && gmFull) {
      genotype = { file: 'genotype/map.json', gated: true, built: gmFull.built || null,
        reason: 'genotype/map.json exists but is not marked vetted (no top-level "vetted": true and no genotype/map.vetted.json). It is the background agent\'s unvetted output, so no gene is drawn until the Genotype session marks it ready.',
        nodes: {}, links: {}, coverage: {} };
    }
    if (gmRaw && gmRaw.layers) {
      const nid = s => String(s || '').replace(':', '_');
      const CAP = 40;
      const KIND_RANK = k => /single|in situ|immunost/i.test(k || '') ? 0 : /bulk|RNA Seq/i.test(k || '') ? 2 : 1;
      const short = o => /Danio/.test(o?.name || '') ? 'zebrafish' : /Oryzias/.test(o?.name || '') ? 'medaka' : (o?.name || 'unstated');
      genotype = { file: gmSource, built: gmRaw.built || null, tool: gmRaw.tool || null, title: gmRaw.title || null, vetted: gmRaw.vetted === true || !!gmSlim, vetted_flag_in_file: gmRaw.vetted === true, vetting: gmRaw.vetting || null, slimming: gmRaw.slimming || null,
        constraint: gmRaw.constraint || null, causation_warning: gmRaw.causation_warning || null,
        link_types: gmRaw.link_types || null, propagation_rules: gmRaw.propagation_rules || null, not_sourced: gmRaw.not_sourced || [],
        proxy_organisms: gmRaw.summary?.proxy_organisms || [], blueprint_sha256: gmRaw.blueprint?.sha256 || null, matches_blueprint_now: (gmRaw.blueprint?.sha256 || null) === sha,
        summary: { direct_links: gmRaw.summary?.direct_links ?? null, direct_links_by_type: gmRaw.summary?.direct_links_by_type || null, genes_by_organism: gmRaw.summary?.genes_by_organism || null, derived_links_stored: gmRaw.summary?.derived_links_stored ?? null, storage: gmRaw.summary?.storage || null },
        coverage: {}, nodes: {}, links: {}, omitted: {}, fin_size: null, cap_per_type: CAP };
      for (const [layer, L] of Object.entries(gmRaw.layers)) {
        genotype.coverage[layer] = L.coverage || null;
        for (const n of (L.nodes || [])) {
          const id = nid(n.term); if (!terms.has(id)) continue;
          genotype.nodes[id] = { direct: !!n.direct, derived_only: !!n.derived_only,
            expressed_in: n.direct_expressed_in_genes || 0, required_for: n.direct_required_for_genes || 0, sufficient_for: n.direct_sufficient_for_genes || 0,
            derived_expressed_in: n.derived_expressed_in_genes || 0, derived_required_for: n.derived_required_for_genes || 0 };
        }
        const byNode = new Map();
        for (const l of (L.links || [])) { if (l.derived) continue; const id = nid(l.blueprint_node); if (!terms.has(id)) continue; if (!byNode.has(id)) byNode.set(id, []); byNode.get(id).push(l); }
        for (const [id, ls] of byNode) {
          const out = [], om = {};
          for (const type of ['sufficient for', 'required for', 'expressed in']) {
            const grp = ls.filter(l => l.link_type === type).sort((a, b) => KIND_RANK(a.evidence_kind) - KIND_RANK(b.evidence_kind) || String(a.symbol).localeCompare(String(b.symbol)));
            // one row per gene symbol + organism + kind, so the same gene from two databases is not two rows
            const seen = new Set(), rows = [];
            for (const l of grp) { const k = `${l.symbol}|${short(l.organism)}|${l.evidence_kind}`; if (seen.has(k)) continue; seen.add(k); rows.push(l); }
            if (rows.length > CAP) om[type] = rows.length - CAP;
            for (const l of rows.slice(0, CAP)) out.push({ gene: l.gene || null, symbol: l.symbol || null, organism: short(l.organism), taxon: l.organism?.taxon || null, link: l.link_type, kind: l.evidence_kind || null,
              db: l.source?.database || null, url: l.source?.url || null, retrieved: l.source?.retrieved || null, stage: l.stage?.period || l.stage?.bgee || null,
              finding: l.finding || l.evidence?.finding || null });
          }
          genotype.links[id] = out; if (Object.keys(om).length) genotype.omitted[id] = om;
        }
      }
      if (gmRaw.fin_size) genotype.fin_size = { why: gmRaw.fin_size.why || null,
        verified_leads: (gmRaw.fin_size.verified_leads || []).map(v => ({ gene: v.gene, organism: v.organism, finding: v.finding, link_type: v.link_type, citations: (v.citations || []).map(c => typeof c === 'string' ? c : (c.pmid ? 'PMID ' + c.pmid + (c.doi ? ' doi ' + c.doi : '') : JSON.stringify(c))) })),
        zfin_fin_size_genes: gmRaw.fin_size.zfin_fin_size_genes ? { definition: gmRaw.fin_size.zfin_fin_size_genes.definition, count: gmRaw.fin_size.zfin_fin_size_genes.count } : null };
      // ---- for the explode view: a gene index (symbol -> the nodes it touches by STORED direct record), the breadth
      // table (counts per layer, all direct records, full map only), Daane 2021 fin proportions, and the fin subtree.
      // The stored rows are complete for 'required for' and 'sufficient for' links and for the focus and fin-size genes;
      // other 'expressed in' rows live in genotype/expression_index.json.gz and are counted in breadth, not located.
      const gidx = {};
      const full = gmSlim ? (noMap ? null : J('genotype/map.vetted.json')) : (gmVetted || null);   // the full map's rows when present
      const geneSrc = full || gmRaw;
      const fullForBreadth = full || ((gmRaw.genes && typeof gmRaw.genes === 'object' && !gmRaw.genes.note) ? gmRaw : null);
      for (const [layer, L] of Object.entries((geneSrc || gmRaw).layers)) {
        for (const l of (L.links || [])) {
          if (l.derived || !l.symbol) continue;
          const id = nid(l.blueprint_node); if (!terms.has(id)) continue;
          const g = gidx[l.symbol] || (gidx[l.symbol] = { nodes: {}, organisms: new Set(), ids: new Set() });
          const types = g.nodes[id] || (g.nodes[id] = []);
          const t = l.link_type === 'sufficient for' ? 'S' : l.link_type === 'required for' ? 'R' : 'E';
          if (!types.includes(t)) types.push(t);
          g.organisms.add(short(l.organism)); if (l.gene) g.ids.add(l.gene);
        }
      }
      const breadthBySymbol = {};
      for (const [gid, g] of Object.entries(fullForBreadth?.genes || {})) {
        if (!g || !g.symbol || !g.breadth) continue;
        const b = breadthBySymbol[g.symbol] || (breadthBySymbol[g.symbol] = { direct: 0, layers: {}, types: {}, ids: [] });
        b.direct += g.breadth.blueprint_nodes_direct || 0; b.ids.push(gid);
        for (const [k, v] of Object.entries(g.breadth.layers || {})) b.layers[k] = (b.layers[k] || 0) + v;
        for (const k of ['expressed in', 'required for', 'sufficient for']) if (g.breadth[k]) b.types[k] = (b.types[k] || 0) + g.breadth[k];
      }

      genotype.gene_index_note = `symbol -> nodes with a stored direct record (${Object.keys(gidx).length} genes from ${full ? 'genotype/map.vetted.json' : gmSource}); complete for required-for and sufficient-for links and for the focus and fin-size genes, partial for expressed-in; breadth counts cover every direct record` + (fullForBreadth?.genes ? '' : ' (breadth table not in this checkout)');
      genotype.breadth_available = !!fullForBreadth?.genes;
      const mfp = (geneSrc || gmRaw).fin_size?.measured_fin_proportions || gmRaw.fin_size?.measured_fin_proportions || null;
      genotype.fin_proportions = mfp ? { source: mfp.source || null, n_specimens: mfp.n_specimens ?? null, by_group: mfp.pectoral_over_SL_by_group || null } : null;
      // the fin subtree (genotype/fin-subtree.json): the zebrafish pectoral fin (ZFA) and its parts below the
      // blueprint's pectoral fin, with proxy-fish links re-attached to the exact structure each record names.
      // Kept per node: label, level, parent (first part_of edge), counts, xrefs; links capped like the map.
      const fsub = J('genotype/fin-subtree.json');
      if (fsub && fsub.layers) {
        const F = { file: 'genotype/fin-subtree.json', built: fsub.built || null, tool: fsub.tool || null, vetted: fsub.vetted === true,
          organ: nid(fsub.blueprint_join?.pectoral_fin_uberon || 'UBERON:0000151'), zfa_root: fsub.blueprint_join?.pectoral_fin_zfa || 'ZFA:0001161',
          join_note: fsub.blueprint_join?.note || null, constraint: fsub.constraint || null, causation_warning: fsub.causation_warning || null,
          propagation_rules: fsub.propagation_rules || null, summary: { zfa_terms: fsub.summary?.zfa_terms ?? null, links: fsub.summary?.links ?? null, links_by_type: fsub.summary?.links_by_type || null, links_by_level: fsub.summary?.links_by_level || null, zfin_phenotype_rejected: fsub.summary?.zfin_phenotype_rows?.rejected || null },
          coverage: {}, nodes: {}, links: {}, omitted: fsub.slimming?.links_omitted_by_node_and_type || {}, edges: [], wing_genes: null, single_cell_leads: null, sources: Object.keys(fsub.sources || {}) };
        const parentOf = {};
        for (const e of (fsub.edges || [])) { F.edges.push({ child: e.child, parent: e.parent, rel: e.rel }); if (e.rel === 'part_of' && !parentOf[e.child]) parentOf[e.child] = e.parent; }
        for (const [layer, L] of Object.entries(fsub.layers)) {
          F.coverage[layer] = L.coverage || null;
          for (const n of (L.nodes || [])) {
            F.nodes[n.term] = { label: n.label, level: layer, parent: n.parent || parentOf[n.term] || null, depth: n.depth_below_pectoral_fin ?? null,
              direct: !!n.direct, expressed_in: n.direct_expressed_in_genes || 0, required_for: n.direct_required_for_genes || 0, sufficient_for: n.direct_sufficient_for_genes || 0,
              uberon_xref: n.uberon_xref || [], cl_xref: n.cl_xref || null, in_blueprint: !!n.in_blueprint, zebrafish_only: !!n.zebrafish_only, structure: n.structure || null, cell_type: n.cell_type || null,
              stage_range: n.stage_range ? (Array.isArray(n.stage_range.periods) ? n.stage_range.periods.join('..') : (n.stage_range.span || n.stage_range.period || null)) : null };
          }
          const byNode = {};
          for (const l of (L.links || [])) { if (l.derived) continue; (byNode[l.blueprint_node] || (byNode[l.blueprint_node] = [])).push(l); }
          for (const [id, ls] of Object.entries(byNode)) {
            const rank = { 'sufficient for': 0, 'required for': 1, 'expressed in': 2 };
            F.links[id] = ls.sort((a, b) => rank[a.link_type] - rank[b.link_type] || KIND_RANK(a.evidence_kind) - KIND_RANK(b.evidence_kind) || String(a.symbol).localeCompare(String(b.symbol)))
              .map(l => ({ gene: l.gene || null, symbol: l.symbol || null, organism: short(l.organism), link: l.link_type, kind: l.evidence_kind || null, db: l.source?.database || null, url: l.source?.url || null, retrieved: l.source?.retrieved || null,
                stage: l.stage?.period || l.stage?.span || (typeof l.stage === 'string' ? l.stage : null), finding: l.finding || null }));
            // the fin subtree's rows also feed the gene lens, keyed by ZFA id
            for (const l of ls) { if (!l.symbol) continue; const g = gidx[l.symbol] || (gidx[l.symbol] = { nodes: {}, organisms: new Set(), ids: new Set() });
              const types = g.nodes[id] || (g.nodes[id] = []); const t = l.link_type === 'sufficient for' ? 'S' : l.link_type === 'required for' ? 'R' : 'E'; if (!types.includes(t)) types.push(t); g.organisms.add(short(l.organism)); if (l.gene) g.ids.add(l.gene); }
          }
        }
        if (fsub.wing_genes) F.wing_genes = { honest_summary: fsub.wing_genes._honest_summary || null,
          genes: Object.fromEntries(Object.entries(fsub.wing_genes).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, { links_in_fin_subtree: v.links_in_fin_subtree ?? null, deepest_level_reached: v.deepest_level_reached || null, nodes: v.nodes_level_type_stage || [], zfin_rows: v.all_zfin_rows_for_this_gene ? Object.keys(v.all_zfin_rows_for_this_gene).length : null }])) };
        if (fsub.single_cell_leads) F.single_cell_leads = { note: fsub.single_cell_leads.note || null, n_series: (fsub.single_cell_leads.series || []).length, fin_in_title: (fsub.single_cell_leads.series || []).filter(x => x.fin_in_title).length };
        genotype.fin_subtree = F;
      } else genotype.fin_subtree = null;
      genotype.gene_index = Object.fromEntries(Object.entries(gidx).map(([sym, g]) => [sym, { nodes: g.nodes, organisms: [...g.organisms], ids: [...g.ids], breadth: breadthBySymbol[sym] || null }]));
      genotype.nodes_with_direct = Object.values(genotype.nodes).filter(n => n.direct).length;
      genotype.nodes_with_derived_only = Object.values(genotype.nodes).filter(n => n.derived_only).length;
      genotype.links_stored_here = Object.values(genotype.links).reduce((a, l) => a + l.length, 0);
    } else if (!gmRaw && !gmFull) {
      // Neither map is in this checkout (the vetted map is 14.7 MB and was not committed). Rather than silently
      // dropping the genes, carry the genotype block of the previous build of this file and say so on the page.
      const prev = J('dashboard/public/blueprint3d/data.json');
      if (prev?.genotype && !prev.genotype.gated && !prev.genotype.error && prev.genotype.nodes) {
        genotype = { ...prev.genotype, carried_from_previous_build: prev.genotype.carried_from_previous_build || prev.builtAt,
          carried_note: `no genotype map (map.vetted.slim.json, map.vetted.json) is in this checkout; the gene records shown were read from it by the build of ${prev.genotype.carried_from_previous_build || prev.builtAt} and carried forward unchanged.` };
      }
    } else if (gmRaw) {
      genotype = { file: gmSource, error: 'the map has no layers block; shape not understood, nothing drawn', nodes: {}, links: {}, coverage: {} };
    }
    // ---- provenance index for the 3D fish (viz thread): everything a node's panel can trace, read from files ----
    // constraints that apply: C6 (the blueprint certificate) to every node; the strength, v_min and bending
    // constraints to skeleton and fin parts, as the hub specified. Each carries its proofScope so the page can say
    // what is about the model and what is about the fish (nothing here is about the fish).
    const consList = (constraints && (constraints.constraints || constraints)) || [];
    const pick = ids => consList.filter(c => ids.includes(c.id)).map(c => ({ id: c.id, property: c.property || null, label: c.label || null, lemma: c.lemma || null, theorem: c.theorem || null, module: c.module || null, claim_id: c.claim_id || null,
      status: c.status || null, faithfulness: c.faithfulness || null, relation: c.relation || null, requires: c.requires || null, appliesWhen: c.appliesWhen || null, assumptionsText: c.assumptionsText || null,
      proofScope: c.proofScope || null, openProblemRulings: c.openProblemRulings || null, whyNoCandidate: c.whyNoCandidate || null }));
    const provConstraints = { all: pick(['C6']), skeleton_fin: pick(['C8', 'C8c', 'C9', 'C12']) };
    // nanopub drafts: which terms, constraints and claim ids each unsigned draft mentions (unsigned drafts, nothing published)
    const npRe = /(UBERON[_:]\d{7}|CL[_:]\d{7}|ZFA[_:]\d{7}|NCBITaxon[_:]\d+)/g;
    const claimIds = new Set([...claimById.keys(), ...consList.map(c => c.claim_id).filter(Boolean)]);
    const nanopubs = [];
    for (const dir of ['lean', 'genotype', 'physics', 'organism-design', 'holdout']) {
      const d = path.join(root, dir, 'nanopubs', 'unsigned'); if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d).filter(x => x.endsWith('.trig'))) {
        const t = fs.readFileSync(path.join(d, f), 'utf8');
        const title = (t.match(/(?:dct:title|rdfs:label)\s+"((?:[^"\\]|\\.)*)"/) || [])[1] || f;
        const terms = [...new Set([...t.matchAll(npRe)].map(m => m[1].replace(':', '_')))];
        const cons = [...new Set([...t.matchAll(/\b(C\d{1,2}[bc]?)\b/g)].map(m => m[1]))].filter(k => consList.some(c => c.id === k));
        const claims = [...claimIds].filter(id => t.includes(id));
        const np = `${dir}/nanopubs/unsigned/${f}`;
        if (terms.length || cons.length || claims.length || dir === 'physics') nanopubs.push({ file: np, dir, title: title.replace(/\\"/g, '"').slice(0, 160), terms, constraints: cons, claims });
      }
    }
    // physics: figures and verdicts for the pectoral fin
    const phys = J('physics/results.json'), physStatus = J('dashboard/public/t/physics/status.json');
    const physFigs = ['vmin-band.svg', 'bridge.svg', 'envelope.svg'].filter(f => fs.existsSync(path.join(here, 'public/t/physics', f))).map(f => ({ file: 't/physics/' + f, name: f.replace('.svg', '') }));
    const physics = phys ? { file: 'physics/results.json', computed_at: phys.computed_at || null, overall: phys.overall || null, verdicts: phys.verdicts || null, headline: physStatus?.headline || null, status_file: 'dashboard/public/t/physics/status.json', page: 't/physics/', figures: physFigs } : null;
    // explicit graph links into blueprint (morph) nodes: never text-matched
    const graphLinks = {};
    for (const l of links) {
      const a = l.source, b = l.target; const m = a.startsWith('morph:') ? a : b.startsWith('morph:') ? b : null; if (!m) continue;
      const o = m === a ? b : a; if (o.startsWith('morph:')) continue;
      const on = nodes.get(o); const key = m.replace('morph:', ''); if (!on) continue;
      (graphLinks[key] || (graphLinks[key] = [])).push({ id: o, label: on.label, type: on.type, rel: l.rel, out: m === a, browse: 'graph/?view=flyingfish' });
    }
    const provenance = { constraints: provConstraints, nanopubs, physics, graph_links: graphLinks,
      note: 'Constraints apply by level as stated in constraints.applies; every proofScope is about the stated model, not about any fish. Nanopub drafts are unsigned and unpublished. Graph links are the explicit edges of dashboard/public/graph.json, never text matches.',
      applies: { all: provConstraints.all.map(c => c.id), skeleton_fin: provConstraints.skeleton_fin.map(c => c.id) } };
    const out3d = {
      builtAt: new Date().toISOString(),
      provenance,
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
    console.log(`blueprint3d/data.json: ${terms.size} distinct terms, ${edges.length} edges, byLevel ${JSON.stringify(byLevel)}; certificate ${cert ? (out3d.certificate.matches_file_now ? 'matches the file' : 'STALE: hash differs') : 'missing'}; lean statements mentioning a term: ${bioMentioned.length}; genotype ${genotype ? (genotype.carried_from_previous_build ? `CARRIED from the build of ${genotype.carried_from_previous_build} (no map in this checkout)` : genotype.gated ? 'present but NOT vetted: gated, nothing drawn' : genotype.error || `${genotype.nodes_with_direct} nodes with direct records, ${genotype.links_stored_here} links kept`) : 'map.json not present'}`);
  } else console.log('blueprint3d: organism-design/examples/a-flying-fish.json not found; nothing written');
}
