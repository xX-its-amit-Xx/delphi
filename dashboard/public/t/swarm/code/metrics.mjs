#!/usr/bin/env node
// Aggregates finished runs into swarm/compare/results.json (all four arms, primary run + replicates) and,
// once the centralized arm has run, writes swarm/metrics.json with MEASURED per-queen metrics for the emperor.
// Usage: node swarm/compare/metrics.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const EXP = +arg('exp', 1);
const runsDir = path.join(here, 'runs');
const ARMS = ['single', 'isolated', 'centralized', 'decentralized'];
const QUEENS = ['q-evolution', 'q-morphology', 'q-holdout'];
const CLAIMS_N = JSON.parse(fs.readFileSync(path.join(here, EXP === 2 ? 'claims2.json' : 'claims.json'), 'utf8')).claims.length;

const finalPlanFabricated = (dir) => { // fabricated identifiers counted only in each claim's last attempt
  const vd = path.join(runsDir, dir, 'verify'); if (!fs.existsSync(vd)) return 0; const last = {};
  for (const f of fs.readdirSync(vd).sort()) { const [cid] = f.split('.'); last[cid] = f; }
  const set = new Set(); for (const f of Object.values(last)) JSON.parse(fs.readFileSync(path.join(vd, f), 'utf8')).fabricated.forEach(u => set.add(u)); return set.size; };
const runs = fs.existsSync(runsDir) ? fs.readdirSync(runsDir).filter(d => (EXP === 2) === d.startsWith('exp2-')).filter(d => fs.existsSync(path.join(runsDir, d, 'summary.json'))).map(d => { const s = JSON.parse(fs.readFileSync(path.join(runsDir, d, 'summary.json'), 'utf8')); s.fabricated_identifiers_final_plans = finalPlanFabricated(d); return { dir: d, s }; }) : [];
// Primary = earliest full run (all claims, not a test tag), as pre-registered. Later full runs are replicates.
const noModelCall = s => !s.tokens || (s.tokens.input + s.tokens.output + s.tokens.cache_read + s.tokens.cache_creation) === 0;
const infraFailures = runs.filter(r => noModelCall(r.s)).map(r => r.dir);
const full = runs.filter(r => r.s.claims === CLAIMS_N && !/-test\b/.test(r.dir) && !noModelCall(r.s)).sort((a, b) => a.s.started.localeCompare(b.s.started));
const byArm = {};
for (const arm of ARMS) {
  const rs = full.filter(r => r.s.arm === arm);
  if (!rs.length) continue;
  const strip = s => { const { per_claim, ...rest } = s; return rest; };
  byArm[arm] = { primary: { ...strip(rs[0].s), per_claim: rs[0].s.per_claim }, replicates: rs.slice(1).map(r => strip(r.s)) };
}
const beats = (a, b) => byArm[a] && byArm[b] ? (byArm[a].primary.fabricated_identifiers === 0 && byArm[a].primary.verified - byArm[b].primary.verified >= 2) : null;
const blockedWin = (a, b) => byArm[a].primary.verified - byArm[b].primary.verified >= 2 && byArm[a].primary.fabricated_identifiers > 0 ? `${a} verified more but fails the hard constraint (${byArm[a].primary.fabricated_identifiers} fabricated identifier), so no win` : null;
const comparisons = [['centralized', 'single'], ['decentralized', 'centralized'], ['centralized', 'isolated'], ['decentralized', 'single'], ['isolated', 'single']].map(([a, b]) => ({
  a, b, a_verified: byArm[a]?.primary.verified ?? null, b_verified: byArm[b]?.primary.verified ?? null,
  verdict: !byArm[a] || !byArm[b] ? 'not run' : beats(a, b) ? `${a} beats ${b}` : beats(b, a) ? `${b} beats ${a}` : blockedWin(a, b) || blockedWin(b, a) || 'no difference (under 2 claims)'
}));
const results = { built: new Date().toISOString(), experiment: EXP, rule: 'swarm/PREREG.md: A beats B if A has 0 fabricated identifiers and at least 2 more verified datasets than B. Primary = earliest full run per arm.', claims: CLAIMS_N, arms: byArm, comparisons, test_runs_ignored: runs.filter(r => !full.includes(r) && !infraFailures.includes(r.dir)).map(r => r.dir), infra_failures_excluded: infraFailures };
fs.writeFileSync(path.join(here, EXP === 2 ? 'results2.json' : 'results.json'), JSON.stringify(results, null, 1));
console.log(EXP === 2 ? 'results2.json:' : 'results.json:', Object.entries(byArm).map(([k, v]) => `${k} ${v.primary.verified}/${CLAIMS_N} fab=${v.primary.fabricated_identifiers} ${v.primary.minutes_wall}min $${v.primary.cost_usd_list}${v.replicates.length ? ` (+${v.replicates.length} rep)` : ''}`).join(' | ') || 'no full runs yet');

// ---- per-queen metrics for the emperor, from the centralized primary run (the emperor/king/queen arm) ----
const cen = full.find(r => r.s.arm === 'centralized');
if (!cen) { console.log('metrics.json: not written (no centralized run yet, emperor stays simulated)'); process.exit(0); }
const rd = path.join(runsDir, cen.dir);
const log = fs.readFileSync(path.join(rd, 'log.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const calls = fs.readdirSync(path.join(rd, 'calls')).map(f => JSON.parse(fs.readFileSync(path.join(rd, 'calls', f), 'utf8')).meta);
const BINS = [
  ['occurrence-biodiversity', /gbif|iucn|occurrence|checklist|amphibia|avibase|ebird|biodiversity|glonaf|naturali/i],
  ['genomic-sequence', /ncbi|genome|genbank|ensembl|sequence|chromosome|ccdb|karyot/i],
  ['morphometric-anthropometric', /nhanes|growth|stature|height|weight|morpho|anthropom|measurement|skeletal|vertnet|idigbio|egg/i],
  ['fisheries-timeseries', /ices|datras|fishbase|tree.?ring|itrdb|survey|plaice|fisher/i],
  ['geological-paleo-climate', /chronostrat|macrostrat|paleobio|fossil|glacial|climate|noaa|strat|geolog|denud|weald/i],
  ['repository-other', /dryad|zenodo|figshare|pangaea|dataverse|wikidata|museum|nhm|smithsonian|.*/i]
];
const queens = QUEENS.map(q => {
  const ev = log.filter(e => e.actor === q && (e.action === 'verified' || e.action === 'unverified' || e.action === 'worker-failed'));
  const attempts = ev.length, verified = ev.filter(e => e.action === 'verified').length;
  const mine = calls.filter(c => c.label.includes('-' + q + '-'));
  const tokens = mine.reduce((s, c) => s + (c.usage ? (c.usage.input || 0) + (c.usage.output || 0) + (c.usage.cache_read || 0) + (c.usage.cache_creation || 0) : 0), 0);
  const topic = BINS.map(() => 0);
  for (const f of fs.readdirSync(path.join(rd, 'verify'))) {
    const v = JSON.parse(fs.readFileSync(path.join(rd, 'verify', f), 'utf8')); if (!v.dataset_verified) continue;
    const p = JSON.parse(fs.readFileSync(path.join(rd, 'plans', f), 'utf8'));
    const who = log.find(e => e.action === 'verified' && e.target === f.split('.')[0])?.actor; if (who !== q) continue;
    const txt = `${p.dataset.name} ${p.dataset.publisher} ${p.dataset.landing_url}`;
    const i = BINS.findIndex(([, re]) => re.test(txt)); topic[i >= 0 ? i : BINS.length - 1]++;
  }
  const n = topic.reduce((a, b) => a + b, 0);
  return { id: q, measured: attempts > 0, attempts, verified, novelty: attempts ? +(verified / attempts).toFixed(3) : 0, stale: 0, tokens, calls: mine.length, topic: n ? topic.map(x => +(x / n).toFixed(3)) : topic };
});
const metrics = {
  _note: 'MEASURED. Written by swarm/compare/metrics.mjs from the centralized (emperor/king/queen) run named in measured_from. novelty = verified-dataset rate per worker attempt for that queen; topic = share of the queen\'s verified datasets in six data-type bins (' + BINS.map(b => b[0]).join(', ') + '); tokens = all tokens its workers used. Queens absent here never ran and are not simulated.',
  measured_from: cen.dir, measured_at: new Date().toISOString(), queens: queens.filter(q => q.measured),
  unmeasured_queens: queens.filter(q => !q.measured).map(q => q.id),
  arms: Object.fromEntries(Object.entries(byArm).map(([k, v]) => { const { per_claim, ...rest } = v.primary; return [k, { ...rest, replicates: v.replicates.length }]; })),
  comparisons
};
fs.writeFileSync(EXP === 2 ? path.join(here, 'metrics2.json') : path.join(here, '..', 'metrics.json'), JSON.stringify(metrics, null, 1));
console.log('metrics.json:', metrics.queens.map(q => `${q.id} novelty ${q.novelty} (${q.verified}/${q.attempts}), ${q.tokens} tokens`).join(' | '));
