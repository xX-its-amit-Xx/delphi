#!/usr/bin/env node
// Builds dashboard/public/deck/data.json: the running pitch deck's numbers and, for each slide,
// whether its evidence exists yet. A slide whose inputs are missing comes out state "anticipated"
// and the deck greys it out rather than inventing a result.
//   node dashboard/build-deck.mjs      (run after build.mjs and build-evolve.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, 'public');
const out = path.join(pub, 'deck');
fs.mkdirSync(out, { recursive: true });

const read = p => { try { return JSON.parse(fs.readFileSync(path.join(pub, p), 'utf8')); } catch { return null; } };
const D = read('data.json');
const EV = read('evolve/data.json');
const VR = read('evolve/verify.json');
const PN = read('evolve/panel.json');
const LN = read('evolve/lean.json');
const threads = ['claims', 'swarm', 'holdout', 'lean', 'organism']
  .map(k => ({ k, s: read(`t/${k}/status.json`) })).filter(x => x.s);

const swm = l => {
  const sw = threads.find(t => t.k === 'swarm')?.s;
  const f = (sw?.metrics || []).find(x => x.label === l);
  return f ? f.value : null;
};
const arm = k => ({ key: k, exp1: swm(`exp1 ${k}: verified of 20`), exp2: swm(`exp2 ${k}: verified of 20`) });
const swarmArms = ['centralized', 'decentralized', 'isolated', 'single'].map(arm).filter(a => a.exp1 != null || a.exp2 != null);

const pol = (k, fam = 'all', b = 1000) => EV?.policyRows?.find(r => r.policy === k && r.family === fam && r.budget === b) || null;
const policies = ['q2c_nomodel', 'q2c', 'collective_shared', 'collective_isolated', 'directed', 'greedy']
  .map(k => { const r = pol(k); return r ? { key: k, certified: r.certified, episodes: r.episodes, rmst: r.rmst } : null; })
  .filter(Boolean);

const cert = EV?.routes?.find(r => r.certificate_path) || null;
const leanThread = threads.find(t => t.k === 'lean')?.s;


// ---- nanopub record inventory, counted from the tree (never typed by hand) ----
const repoRoot = path.resolve(here, '..');
const countDrafts = dir => {
  const d = path.join(repoRoot, dir, 'unsigned');
  if (!fs.existsSync(d)) return null;
  const files = fs.readdirSync(d).filter(f => f.endsWith('.trig'));
  let tpl = 0, human = 0;
  for (const f of files) {
    const t = fs.readFileSync(path.join(d, f), 'utf8');
    if (/wasCreatedFrom(Provenance|Pubinfo)?Template/.test(t)) tpl++;
    if (/orcid\.org\/[0-9]/.test(t)) human++;
  }
  return { drafts: files.length, withTemplateTriple: tpl, namingAHuman: human };
};
const recordSets = [
  ['lean', 'lean/nanopubs'], ['organism', 'organism-design/nanopubs'],
  ['swarm', 'swarm/nanopubs'], ['claims', 'claim-tests/nanopubs']
].map(([k, d]) => ({ thread: k, ...(countDrafts(d) || { drafts: 0 }) })).filter(r => r.drafts);
let priorProduction = null;
try {
  const mb = JSON.parse(fs.readFileSync(path.join(repoRoot, 'math-bio-theorems/nanopubs/manifest.json'), 'utf8'));
  priorProduction = { records: (mb.nanopubs || []).length, status: mb.status || null };
} catch {}
const records = {
  sets: recordSets,
  drafts: recordSets.reduce((a, r) => a + r.drafts, 0),
  signed: 0, published: 0,
  withTemplateTriple: recordSets.reduce((a, r) => a + (r.withTemplateTriple || 0), 0),
  namingAHuman: recordSets.reduce((a, r) => a + (r.namingAHuman || 0), 0),
  priorProduction
};


// ---- real figures (plots made from measured data) and the two-swarm cross-check ----
let figures = [];
try { figures = JSON.parse(fs.readFileSync(path.join(out, 'fig/manifest.json'), 'utf8')); } catch {}
const crosscheck = read('crosscheck.json');

const numbers = {
  claims: D?.stats?.claims ?? D?.claims?.length ?? null,
  claimTests: (D?.tests || []).length || null,
  leanProved: D?.lean?.summary?.claimsVerified ?? null,
  leanTheorems: D?.lean?.summary?.theoremsCompiling ?? null,
  leanAssessors: D?.lean?.summary?.assessorModels ?? null,
  leanVerdicts: D?.lean?.summary?.verdictCounts ?? null,
  leanSorry: D?.lean?.sorry ?? null,
  enzymeMeasured: EV?.source?.counts?.measured_nonstop_genotypes ?? null,
  enzymeLibrary: EV?.source?.counts?.library_nonstop_genotypes ?? null,
  enzymeEpisodes: EV ? (EV.benchmark?.episodes || 0) + 300 + (EV.scale?.episodes || 0) : null,
  kappaUsed: EV?.intervalModel?.kappa ?? null,
  route: cert ? { nodes: cert.nodes, steps: cert.steps, weakest: cert.weakest_step_index, breaksAt: cert.breaks_at_kappa } : null,
  kappaSweep: EV?.kappaSweep || null,
  directOrderingsBroken: EV?.routes?.find(r => r.id === 'tempting-direct') ? true : null,
  policies,
  lazysp: EV?.lazysp?.primary || null,
  swarmArms,
  swarmFabricated: swm('exp2 decentralized: fabricated ids') === 0 ? 0 : swm('exp2 decentralized: fabricated ids'),
  panel: PN ? {
    pairs: (PN.perPair || []).length,
    results: (PN.results || []).map(r => ({ key: r.policy, certified: r.certified, episodes: r.episodes, assays: r.meanAssays })),
    separatingPairs: (PN.summary?.pairsLazyspResolvedQ2cNot || []).length,
    theirVfvsEpisodes: PN.theirPanelForComparison?.vfvsStartEpisodes ?? null,
    theirEpisodes: PN.theirPanelForComparison?.episodesPerPolicy ?? null,
    theirDistinctPairs: PN.theirPanelForComparison?.distinctPairs ?? null,
    theirLazyOnly: PN.theirPanelForComparison?.lazyspResolvedQ2cNot ?? null,
    dataCountsVerdict: PN.dataCounts?.verdict ?? null,
    finding: PN.finding || null
  } : null,
  proofs: LN ? {
    buildExit: LN.build?.exit ?? null,
    mutations: (LN.mutations || []).length,
    rejected: (LN.mutations || []).filter(m => !/STILL BUILDS/i.test(m.verdict || '')).length,
    axioms: LN.axioms?.observed || null,
    axiomsVerdict: LN.axioms?.verdict ?? null,
    generic: LN.correspondence?.generic ?? null,
    discrepancy: /does not exist|nowhere/i.test(JSON.stringify(LN)) ? true : null
  } : null,
  recount: VR ? {
    confirmed: (VR.checks || []).filter(c => c.verdict === 'confirmed').length,
    total: (VR.checks || []).length,
    unchecked: (VR.checks || []).filter(c => c.verdict === 'could-not-check').length
  } : null,
  gpu: EV?.compute ? { variants: EV.compute.variants, headline: EV.compute.headline, sizes: EV.scale?.models ?? null, allNull: EV.scale?.all_rmst_intervals_include_zero ?? null } : null,
  reuseGain: EV?.reuse?.gainOverCache ?? null,
  adapters: EV?.operationalClaims?.scenarios ? {
    total: EV.operationalClaims.scenarios.length,
    refused: EV.operationalClaims.scenarios.filter(s => s.decision === 'refuse').length
  } : null,
  records,
  figures,
  crosscheck: crosscheck ? {
    ourTests: crosscheck.counts.ourTests, theirTests: crosscheck.counts.theirTests,
    overlapping: crosscheck.counts.overlapping, agreements: crosscheck.counts.agreements,
    disagreements: crosscheck.counts.disagreements,
    ourVerdicts: crosscheck.counts.ourVerdicts, theirVerdicts: crosscheck.counts.upstreamVerdicts,
    behind: crosscheck.refs.behind, theirsDate: crosscheck.refs.theirsDate,
    differing: crosscheck.comparisons.filter(c => !c.agree).map(c => ({ claim: c.claim, ours: c.ours?.verdict, theirs: c.theirs?.verdict, kind: c.kind, ourValue: c.ours?.measured?.value, theirValue: c.theirs?.measured?.value, ourUnit: c.ours?.measured?.unit, theirUnit: c.theirs?.measured?.unit }))
  } : null,
  threads: threads.map(t => ({ key: t.k, title: t.s.title, state: t.s.state, headline: t.s.headline, updated: t.s.updated })),
  holdoutHeadline: threads.find(t => t.k === 'holdout')?.s?.headline || null,
  leanAssessment: leanThread?.headline && /faithful/i.test(leanThread.headline) ? leanThread.headline : null
};

// A slide is live when the evidence it needs exists. Anticipated slides name what they are waiting for.
const have = v => v !== null && v !== undefined && !(Array.isArray(v) && !v.length);
const slides = [
  { id: 'title', state: 'live' },
  { id: 'question', state: have(numbers.claims) ? 'live' : 'anticipated', needs: 'the claim graph' },
  { id: 'gap', state: have(numbers.claims) && have(numbers.claimTests) ? 'live' : 'anticipated', needs: 'claim tests' },
  { id: 'pipeline', state: 'live' },
  { id: 'route', state: have(numbers.route) ? 'live' : 'anticipated', needs: 'a certified route' },
  { id: 'scoreboard', state: have(numbers.policies) ? 'live' : 'anticipated', needs: 'the replay benchmark' },
  { id: 'twist', state: have(numbers.panel) ? 'live' : 'anticipated', needs: 'our own fresh panel' },
  { id: 'swarm', state: have(numbers.swarmArms) ? 'live' : 'anticipated', needs: 'the swarm experiments' },
  { id: 'crosscheck', state: crosscheck && crosscheck.counts.overlapping ? 'live' : 'anticipated', needs: 'results from the collaborator swarm to compare against' },
  { id: 'proof', state: have(numbers.proofs) ? 'live' : 'anticipated', needs: 'an independent proof rebuild' },
  { id: 'nulls', state: have(numbers.gpu) ? 'live' : 'anticipated', needs: 'the GPU sweep' },
  { id: 'wing', state: 'anticipated', needs: 'a printed wing and a matched scaled control; no specimen, no scan, no measurement exists' },
  { id: 'scales', state: 'partial', needs: 'records at every scale for one species' },
  { id: 'records', state: records.drafts ? 'partial' : 'anticipated', needs: 'a signing key owner; records are drafted and validated but unsigned' },
  { id: 'honest', state: 'live' },
  { id: 'ask', state: 'live' }
];

// The event gives three minutes. These six carry the spoken pitch; the rest are there for questions.
const CORE = ['title', 'question', 'route', 'swarm', 'crosscheck', 'ask'];
slides.forEach(s2 => { s2.core = CORE.includes(s2.id); });

const data = {
  builtAt: new Date().toISOString(),
  deadline: '2026-11-01T18:00:00Z',
  slides, numbers,
  progress: {
    live: slides.filter(s => s.state === 'live').length,
    partial: slides.filter(s => s.state === 'partial').length,
    anticipated: slides.filter(s => s.state === 'anticipated').length,
    total: slides.length,
    core: slides.filter(s2 => s2.core).length
  }
};
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify(data, null, 1));
console.log(`deck/data.json: ${data.progress.live} live, ${data.progress.partial} partial, ${data.progress.anticipated} anticipated of ${data.progress.total} slides`);
