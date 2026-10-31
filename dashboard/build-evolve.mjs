#!/usr/bin/env node
// Builds dashboard/public/evolve/data.json from the delphi-evolve checkout next to this repo.
// Every number on the enzyme page comes from a file written by that project; nothing here is invented.
// Run:  node dashboard/build-evolve.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');                     // delphisci
const EV = path.resolve(root, '..', 'delphi-evolve');      // sibling checkout
const out = path.join(here, 'public/evolve');

const J = p => JSON.parse(fs.readFileSync(path.join(EV, p), 'utf8'));
const maybe = p => { try { return J(p); } catch { return null; } };
const r3 = n => (typeof n === 'number' ? Math.round(n * 1e6) / 1e6 : n);

if (!fs.existsSync(EV)) { console.error('delphi-evolve checkout not found at ' + EV); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const demo = J('artifacts/demo.json');
const lazysp = J('site/data/lazysp.json');
const scale = J('site/data/scale.json');
const evidence = maybe('site/data/evidence.json');
const reuse = maybe('artifacts/claim_reuse/reuse_benchmark.json');
const publication = maybe('artifacts/integration/publication.json');
const fresh = maybe('artifacts/integration/fresh-checkout-317203a0.json');
const lazyPre = maybe('artifacts/lazysp/preregistration.json');

// ---- commit + file inventory of the enzyme repo (computed here, not copied) ----
let commit = null, commitDate = null;
try {
  commit = execSync('git -C "' + EV + '" rev-parse HEAD').toString().trim();
  commitDate = execSync('git -C "' + EV + '" log -1 --format=%cI').toString().trim();
} catch {}
const walk = (dir, hit, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.lake', '__pycache__'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, hit, acc); else if (hit(e.name)) acc.push(path.relative(EV, p).replace(/\\/g, '/'));
  }
  return acc;
};
const leanFiles = walk(EV, n => n.endsWith('.lean'));
const pyFiles = walk(EV, n => n.endsWith('.py'));
const trigFiles = walk(EV, n => n.endsWith('.trig'));

// ---- policy table: artifacts/core/replay/table_primary.csv ----
const csv = fs.readFileSync(path.join(EV, 'artifacts/core/replay/table_primary.csv'), 'utf8').trim().split(/\r?\n/);
const head = csv[0].split(',');
const rows = csv.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [head[i], v])));
const policyRows = rows.map(r => ({
  family: r.family, policy: r.policy, budget: +r.budget, episodes: +r.episodes,
  certified: +r.certified, rate: +r.cert_rate, rmst: +r.rmst_assays,
  falseCerts: +r.false_certificates, abstain: +r.abstain_censored
}));

// ---- the comparison the main dashboard also ran: shared vs isolated vs one planner ----
const at = (pol, fam = 'all', b = 1000) => policyRows.find(r => r.policy === pol && r.family === fam && r.budget === b);
const collective = {
  question: 'Does sharing evidence between specialists beat one planner, on the same budget?',
  arms: [
    { key: 'collective_shared', label: 'Shared evidence (5 specialists see each other)', ...pick(at('collective_shared')) },
    { key: 'collective_shared_rr', label: 'Shared, round-robin turn order', ...pick(at('collective_shared_rr')) },
    { key: 'collective_isolated', label: 'Isolated (same 5, no shared ledger)', ...pick(at('collective_isolated')) },
    { key: 'q2c', label: 'One planner, same budget', ...pick(at('q2c')) },
    { key: 'q2c_nomodel', label: 'One planner, no model prior', ...pick(at('q2c_nomodel')) },
    { key: 'directed', label: 'Simple directed search', ...pick(at('directed')) },
    { key: 'random', label: 'Random assays', ...pick(at('random')) },
    { key: 'greedy', label: 'Greedy best-neighbour', ...pick(at('greedy')) }
  ],
  byFamily: ['A', 'B'].map(f => ({
    family: f,
    shared: pick(at('collective_shared', f)), isolated: pick(at('collective_isolated', f)),
    single: pick(at('q2c', f)), nomodel: pick(at('q2c_nomodel', f))
  }))
};
function pick(r) { return r ? { certified: r.certified, episodes: r.episodes, rate: r.rate, rmst: r.rmst, falseCerts: r.falseCerts } : null; }

// ---- trimmed landscape for the interactive route view ----
const nodes = demo.nodes.map(n => ({
  id: n.id, g: n.grid, s: r3(n.observed_score), lo: r3(n.lower), hi: r3(n.upper),
  r1: r3(n.replicate_1), r2: r3(n.replicate_2), n: n.min_input_count, k: n.evidence_kind
}));
const edges = demo.edges.map(e => [e.source, e.target, e.status === 'admissible' ? 1 : 0]);

const data = {
  builtAt: new Date().toISOString(),
  repo: { url: 'https://github.com/kganjam/delphi-evolve', commit, commitDate, leanFiles: leanFiles.length, pyFiles: pyFiles.length, trigFiles: trigFiles.length },
  generatedAt: demo.generated_at,
  source: demo.source,
  graphScope: demo.graph_scope,
  intervalModel: demo.interval_model,
  pair: demo.pair,
  nodes, edges,
  routes: demo.routes,
  kappaSweep: demo.kappa_sweep,
  policyRows,
  collective,
  lazysp: {
    ...lazysp,
    prereg: lazyPre ? {
      beforeAnyEpisode: lazyPre.registered_before_any_panel_episode ?? null,
      panelSha: lazyPre.panel_sha256 ?? null, seeds: lazyPre.seeds ?? null,
      episodesPerSeed: lazyPre.episodes_per_seed ?? null, budget: lazyPre.bmax ?? null,
      primary: lazyPre.primary_policy ?? null, comparator: lazyPre.primary_comparator ?? null,
      metrics: lazyPre.metrics ?? null, doc: lazyPre.doc ?? null
    } : null
  },
  scale,
  proof: demo.proof,
  compute: demo.compute,
  operationalClaims: demo.operational_claims,
  claims: demo.claims,
  claimsStatus: demo.claims_status,
  claimAssessments: evidence ? (evidence.claims || []).map(c => ({
    id: c.id, label: c.label, role: c.role, relation: c.relation_to_trpb_test,
    network: c.sources?.network?.nanopubs?.[0] || null,
    assessments: (c.sources?.local?.assessments || []).map(a => ({ score: a.score, verdict: a.verdict, assessor: a.assessor }))
  })) : [],
  reuse: reuse ? {
    avoidedFraction: reuse.baseline?.per_policy?.avoided_fraction ?? null,
    cacheAvoided: reuse.baseline?.per_policy?.cache_avoided ?? null,
    claimAvoided: reuse.baseline?.per_policy?.claim_avoided ?? null,
    gainOverCache: reuse.baseline?.per_policy?.claim_gain_over_cache ?? null,
    cacheEqualsClaim: reuse.baseline?.per_policy?.cache_equals_claim ?? null
  } : null,
  replayExample: {
    ...demo.replay_example,
    queries: (demo.replay_example.queries || []).slice(0, 60)
  },
  limitations: demo.limitations,
  benchmark: { episodes: demo.benchmark.metrics.episodes, seeds: demo.benchmark.metrics.seeds, policies: demo.benchmark.metrics.policies, anyFalseCert: demo.benchmark.metrics.any_false_certificate, truthOpen: demo.benchmark.metrics.truth_open_fraction },
  receipts: {
    freshCheckout: fresh ? { commit: fresh.commit, steps: fresh.steps.length, failed: fresh.steps.filter(s => s.exit !== 0).length } : null,
    release: publication ? { release: publication.github_release, files: publication.package?.files, bytes: publication.package?.bytes, site: publication.site?.url, siteStatus: publication.site?.status } : null
  }
};

fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify(data));
const kb = Math.round(fs.statSync(path.join(out, 'data.json')).size / 1024);
console.log(`evolve/data.json written (${kb} KB): ${nodes.length} nodes, ${edges.length} edges, ${policyRows.length} policy rows, ${leanFiles.length} Lean files, commit ${commit?.slice(0, 8)}`);
