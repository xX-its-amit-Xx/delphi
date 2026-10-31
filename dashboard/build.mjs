#!/usr/bin/env node
// Builds dashboard/public/data.json from the repo's own files. Run from anywhere:
//   node dashboard/build.mjs
// Everything shown on the dashboard as a count or score comes from this file, so the page
// never states a number the repo cannot reproduce. Hand-written context lives in the HTML.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const graph = rd('docs/claims.json');
const claims = graph.claims.map(c => ({
  id: c.id, label: c.label, statement: c.statement, quote: c.quote,
  thinker: c.thinker, year: c.year, work: c.work, chapter: c.chapter,
  kind: c.kind, status: c.status, testability: c.testability, truth: c.truth,
  truthBy: (c.truth_by || []).map(t => ({ a: t.assessor, p: t.p_true })),
  conf: c.assessor_confidence ?? null, np: c.nanopub, registry: c.registry
}));

// Claim tests: every claim-tests/<project>/<id>/result.json
const tests = [];
const ct = path.join(root, 'claim-tests');
for (const proj of fs.readdirSync(ct, { withFileTypes: true }).filter(d => d.isDirectory())) {
  for (const t of fs.readdirSync(path.join(ct, proj.name), { withFileTypes: true }).filter(d => d.isDirectory())) {
    const f = path.join(ct, proj.name, t.name, 'result.json');
    if (!fs.existsSync(f)) continue;
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    tests.push({
      claim_id: r.claim_id, project: proj.name, verdict: r.verdict || r.status,
      hypothesis: r.hypothesis, pass: r.pass_criterion, fail: r.fail_criterion,
      interpretation: r.interpretation, measured: r.measured || null,
      datasets: (r.datasets || []).map(d => ({ name: d.name, url: d.landing_url, doi: d.doi }))
    });
  }
}

let swarm = null;
const sp = path.join(root, 'swarm/state.json');
if (fs.existsSync(sp)) swarm = JSON.parse(fs.readFileSync(sp, 'utf8'));

// Open issues of the collaborators' repo (best effort; falls back to nothing).
let issues = [];
try {
  const res = await fetch('https://api.github.com/repos/fractastical/delphi/issues?state=all&per_page=100', { headers: { 'user-agent': 'delphisci-dashboard' } });
  if (res.ok) issues = (await res.json()).filter(i => !i.pull_request).map(i => ({ n: i.number, title: i.title, state: i.state, url: i.html_url, created: i.created_at }));
} catch { /* offline build: leave empty */ }
const cache = path.join(root, 'dashboard/issues.cache.json');
if (issues.length) fs.writeFileSync(cache, JSON.stringify(issues));
else if (fs.existsSync(cache)) issues = JSON.parse(fs.readFileSync(cache, 'utf8'));

// Count Lean files so the plan can say honestly whether step 4 has started.
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === 'node_modules' || e.name === '.git' || e.name === '.lake' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const leanFiles = walk(root).filter(f => f.endsWith('.lean')).length;
const roster = rd('swarm/roster.json');
// Lean results come from the lean thread's own report (lean/report.mjs), not from counting files.
let lean = null;
const lp = path.join(root, 'dashboard/public/t/lean/lean.json');
if (fs.existsSync(lp)) { try { const j = JSON.parse(fs.readFileSync(lp, 'utf8')); lean = { ok: !!(j.build?.ok && j.audit?.ok && j.sorryTotal === 0), sorry: j.sorryTotal, summary: j.summary, built: j.built, formalized: (j.formalized || []).map(f => ({ claim_id: f.claim_id, theorem: f.theorem, label: f.label, status: f.status })) }; } catch { lean = null; } }

// Thread status files: dashboard/public/t/<thread>/status.json (see dashboard/THREADS.md).
const threads = [];
const tdir = path.join(root, 'dashboard/public/t');
if (fs.existsSync(tdir)) for (const d of fs.readdirSync(tdir, { withFileTypes: true }).filter(x => x.isDirectory())) {
  const f = path.join(tdir, d.name, 'status.json');
  if (!fs.existsSync(f)) continue;
  try { const s = JSON.parse(fs.readFileSync(f, 'utf8')); s.hasPage = fs.existsSync(path.join(tdir, d.name, 'index.html')); s.dir = d.name; threads.push(s); }
  catch (e) { threads.push({ thread: d.name, title: d.name, state: 'blocked', headline: 'status.json is not valid JSON: ' + e.message, metrics: [], blockers: [], needs: [], next: [], dir: d.name }); }
}

const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const out = {
  built: new Date().toISOString(),
  graphBuilt: graph.built,
  claims, tests, swarm, issues, leanFiles, lean, roster, threads,
  stats: {
    total: claims.length,
    byThinker: count(claims, c => c.thinker),
    byStatus: count(claims, c => c.status),
    byKind: count(claims, c => c.kind),
    byRegistry: count(claims, c => String(c.registry))
  }
};
fs.mkdirSync(path.join(root, 'dashboard/public'), { recursive: true });
fs.writeFileSync(path.join(root, 'dashboard/public/data.json'), JSON.stringify(out));
console.log(`data.json: ${claims.length} claims, ${tests.length} claim tests, ${issues.length} issues, swarm ${swarm ? swarm.mode : 'none'}`);

// ---------------------------------------------------------------------------------------------
// Species inventory: organisms/merged (built by the collaborators' agents from Darwin and Thompson)
// plus NCBI genome-assembly counts fetched by dashboard/fetch-genomes.mjs (cached, timestamped).
// ---------------------------------------------------------------------------------------------
{
  const taxa = rd('organisms/merged/taxa.json');
  const mentions = rd('organisms/merged/mentions.json');
  const gpath = path.join(root, 'dashboard/genomes.cache.json');
  const genomes = fs.existsSync(gpath) ? JSON.parse(fs.readFileSync(gpath, 'utf8')) : {};
  const claimIds = new Set(claims.map(c => c.id));
  const firstQuote = {};
  for (const m of mentions) if (!firstQuote[m.taxon_key]) firstQuote[m.taxon_key] = { q: String(m.quote || '').slice(0, 220), w: m.name_as_written, p: m.project };
  const rec = taxa.map(t => {
    const id = t.identifiers || {}, g = id.ncbi_taxid ? genomes[id.ncbi_taxid] : null;
    return {
      k: t.key, n: t.accepted_name, r: t.rank, v: (t.vernacular || []).slice(0, 3),
      l: { p: t.lineage?.phylum || '', c: t.lineage?.class || '', o: t.lineage?.order || '', f: t.lineage?.family || '' },
      id: { gbif: id.gbif_usage_key || null, ncbi: id.ncbi_taxid || null, wd: id.wikidata_qid || null, worms: id.worms_aphia_id || null },
      pr: t.projects, mc: t.mention_count, nd: (t.datasets || []).length,
      cl: (t.mentioned_in || []).filter(c => claimIds.has(c)).slice(0, 8), ncl: (t.mentioned_in || []).length,
      g: g ? { t: g.total, ref: g.reference, acc: g.best?.acc || null, lvl: g.best?.level || null } : null,
      q: firstQuote[t.key] || null
    };
  });
  const gcount = Object.keys(genomes).length;
  const inv = { built: new Date().toISOString(), genomesRetrieved: gcount ? Object.values(genomes)[0].retrieved : null, genomeTaxids: gcount, taxa: rec };
  fs.writeFileSync(path.join(root, 'dashboard/public/inventory.json'), JSON.stringify(inv));
  const esc = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const head = ['taxon', 'rank', 'class', 'order', 'family', 'common_names', 'projects', 'mentions', 'gbif_key', 'ncbi_taxid', 'wikidata', 'genome_assemblies', 'ncbi_reference_genomes', 'best_assembly', 'datasets'];
  const csv = [head.join(',')].concat(rec.map(r => [r.n, r.r, r.l.c, r.l.o, r.l.f, r.v.join('; '), r.pr.join('; '), r.mc, r.id.gbif, r.id.ncbi, r.id.wd, r.g?.t, r.g?.ref, r.g?.acc, r.nd].map(esc).join(','))).join('\n');
  fs.writeFileSync(path.join(root, 'dashboard/public/species-inventory.csv'), csv);
  console.log(`inventory.json: ${rec.length} taxa, genome data for ${gcount} taxids`);
}
